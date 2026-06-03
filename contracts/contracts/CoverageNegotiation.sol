// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    IAgentRequester,
    IAgentRequesterHandler,
    Response,
    Request,
    ResponseStatus
} from "./ISomniaAgent.sol";

/// @notice Somnia LLM Inference agent — canonical on-chain interface (SPEC-0006 R11).
/// @dev   Selector computed as keccak256("inferString(string,string,bool,string[])")[0:4] = 0xfe7ca098.
///        agentId 12847293847561029384 on Somnia testnet.
interface ILLMInferenceAgent {
    function inferString(
        string memory prompt,
        string memory system,
        bool chainOfThought,
        string[] memory allowedValues
    ) external returns (string memory);
}

/// @title CoverageNegotiation
/// @notice System of record for the Curie MVP0 drug coverage-exception flow
///         (SPEC-0001, revised 2026-05-27 → AI necessity-arbiter model).
///
///         A **provider** files a coverage-exception request against a named
///         **insurer** (drug ref, de-identified justification hash, public-evidence
///         ref, requested/billed amount). The insurer **engages** by attaching its
///         governing **policy** (hash on-chain, body off-chain) — adjudication
///         cannot run until a policy is attached (R5). Adjudication fires the
///         canonical Somnia LLM Inference agent (`inferString`, agentId
///         12847293847561029384) which returns a single decision token
///         (`approve | deny | needs_more_info | policy_invalid`). `handleResponse`
///         maps that token to Decision + emits `RulingRationale` (SPEC-0006
///         R24–R26). On `approve` the covered amount is set to `requestedAmount`
///         (no AI-chosen price cap; deterministic). Either party may `accept` or
///         `appeal with new public evidence`; appeals re-fire the agent and are
///         bounded to N rounds → `Deadlocked` (R6c). Both accepting settles (event
///         marker, 50/50 fee split — R8). The provider may `refuse` the insurer's
///         terms → `ProviderRefused` (R7).
///
/// @dev HARD INVARIANT (R4): no PHI / no raw content is ever stored, nor placed in
///      the agent payload. Only keccak256 hashes, opaque refs (bytes32), amounts,
///      decision codes, state, ids, addresses, and timestamps live on-chain.
/// @dev AUTH (R11): every party action is gated to `msg.sender ∈ {providerAddr,
///      insurerAddr}`; `insurerEngage` is insurer-only, `submitEvidence`/`refuse`
///      are provider-only, `createContract` must come from the provider address.
///      A third, unrelated wallet reverts. Reads are public (no gate). SPEC-0004
///      R2b supersedes SPEC-0001 R12/R13: `providerAddr == insurerAddr` is rejected
///      at `createContract` — the two addresses MUST be distinct per request.
///      `partyId` still distinguishes which side of an action the caller represents
///      when the same EOA holds multiple party roles across DIFFERENT requests; never
///      within a single request. The platform callback `handleResponse` is gated to
///      the agent-platform address. Agent-firing entry points are `nonReentrant`
///      and follow checks-effects-interactions.
contract CoverageNegotiation is Ownable, ReentrancyGuard, IAgentRequesterHandler {
    // ---------------------------------------------------------------------
    // State machine (SPEC-0001 §3 "State machine" table — implemented exactly)
    // ---------------------------------------------------------------------

    /// @dev Payer line governing the appeal ladder (SPEC-0004 R13). Determines
    ///      the regulatory stage names the UI renders against. Stored on the
    ///      Negotiation struct; documented-only in v0 (R14b — not enforced on-chain).
    enum PayerLine { PartD, Commercial, Medicaid }

    enum State {
        Open, // 0  provider filed; awaiting insurer policy attach
        Ready, // 1  insurer engaged (policy attached); adjudicable
        UnderReview, // 2  agent firing / awaiting ruling
        EvidenceRequested, // 3  agent asked for more evidence (retriable)
        Approved, // 4  ruling: approve (coveredAmount set)
        Denied, // 5  ruling: deny (coveredAmount 0)
        Settled, // 6  terminal: both accepted + settled (marker)
        Deadlocked, // 7  terminal: appeal bound (N rounds) exhausted
        PolicyInvalidated, // 8  terminal: relied-on clause non-compliant (voided)
        ProviderRefused, // 9  terminal: provider rejected the insurer's terms
        Withdrawn // 10 terminal: either party withdrew
    }

    /// @dev The agent's necessity ruling. Maps the inferString allowed-values token
    ///      vocabulary (SPEC-0006 R11/R24) to on-chain decision codes.
    enum Decision {
        Approve, // 0  "approve"
        Deny, // 1  "deny"
        NeedMoreEvidence, // 2  "needs_more_info"
        PolicyInvalid // 3  "policy_invalid"
    }

    /// @dev Per-request record. Holds only hashes/refs/amounts/codes/state/ids/
    ///      addresses/timestamps — never raw content (R3/R4).
    struct Negotiation {
        uint256 providerId; // app-level party id of the provider (initiator)
        uint256 insurerId; // app-level party id of the insurer (destination)
        address providerAddr; // provider wallet (auth — R11)
        address insurerAddr; // insurer wallet (auth — R11)
        bytes32 drugRef; // opaque RxNorm/NDC drug reference
        uint256 requestedAmount; // provider's billed / requested amount
        uint256 quantity; // dispensed units (NDC-pinned)
        uint256 daysSupply; // optional clinical-utilization context
        bytes32 justificationHash; // keccak256 of the de-identified justification
        bytes32 evidenceUri; // opaque ref to the latest public-evidence doc
        bytes32 policyHash; // keccak256 of the insurer's attached policy body
        bytes32 policyUri; // opaque ref to the public policy body (R5)
        uint256 coveredAmount; // requestedAmount on approve, 0 on deny
        uint256 costPlusUnitPrice; // reserved; 0 in string-token mode (SPEC-0006)
        uint256 nadacUnitPrice; // reserved; 0 in string-token mode (SPEC-0006)
        bytes32 rationaleHash; // hash of the agent's latest rationale (set by commitRationale)
        bytes32 clauseRef; // policy clause reference (set by commitRationale)
        bytes32 standardRef; // public standard reference (set by commitRationale)
        Decision lastDecision; // latest agent decision (meaningful once ruled)
        uint256 lastRequestId; // requestId from the ruling that set lastDecision
        bool hasRuling; // whether an agent decision has landed
        string agentEvidenceUrl; // per-neg public evidence URL for the LLM agent (SPEC-0006 R14)
        string agentPromptHint; // per-neg prompt hint embedded in the inferString call (SPEC-0006 R15)
        // ROUND SEMANTICS: this struct carries TWO related counters that are NOT
        // interchangeable. Read both before reasoning about appeal state.
        //
        //   `round` (R6c) — TOTAL adjudication cycles. SET to 1 at the first
        //   `requestAdjudication` and INCREMENTED on each subsequent agent fire
        //   (`submitEvidence` AND `appeal`). The deadlock cap is `round >= maxRounds`.
        //   Read as "how many times the agent has been asked to rule", NEVER as
        //   "number of appeals so far".
        //
        //   `appealRound` (SPEC-0004 R13) — POSITION IN THE PAYER-LINE LADDER. 0 at
        //   creation (Initial Determination); INCREMENTED in `appeal()` ONLY (NOT in
        //   `submitEvidence`, since submitting more evidence stays in the same ladder
        //   stage). On the deadlock-cap short-circuit path in `appeal()` the bump is
        //   skipped, so a deadlock leaves `appealRound` at the last successfully-fired
        //   value. `(payerLine, appealRound)` indexes the static `LADDERS` table the
        //   UI/library renders against (R15/R16).
        uint256 round; // total adjudication cycles (bounded to maxRounds — R6c)
        PayerLine payerLine; // payer line governing the appeal ladder (SPEC-0004 R13)
        uint8 appealRound; // current position in the payer-line ladder (0 = Initial Determination)
        bool providerAccepted; // provider accepted the current ruling
        bool insurerAccepted; // insurer accepted the current ruling
        uint256 totalFees; // accumulated agent fees (50/50 split marker — R8)
        State state;
        uint256 pendingRequestId; // in-flight Somnia agent request id (0 if none)
        uint256 createdAt;
        uint256 rulingDeadline; // after this, onRulingTimeout may route to retriable
        bool exists;
    }

    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    /// @notice Canonical LLM Inference agent id (Somnia testnet, SPEC-0006 R11).
    ///         Hard-coded so the contract always fires the correct agent regardless
    ///         of the `agentId` storage slot value. `setAgentId` overrides for
    ///         demo/testing purposes only.
    uint256 public constant LLM_INFERENCE_AGENT_ID = 12847293847561029384;

    /// @notice Maximum on-chain rationale length in bytes (SPEC-0006 R26).
    ///         Rationale longer than this is truncated to MAX_RATIONALE_BYTES chars
    ///         + a HORIZONTAL ELLIPSIS sentinel (U+2026, 3 UTF-8 bytes).
    uint256 public constant MAX_RATIONALE_BYTES = 4096;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Somnia agent platform (IAgentRequester) this contract fires requests at.
    IAgentRequester public platform;

    /// @notice Registered agent id used for adjudication. Defaults to
    ///         `LLM_INFERENCE_AGENT_ID` but may be overridden by `setAgentId`
    ///         for testing. The constructor initialises this to `LLM_INFERENCE_AGENT_ID`
    ///         regardless of the `agentId_` argument (which is retained for
    ///         test-harness compatibility — passing 0 still yields the canonical id).
    uint256 public agentId;

    /// @notice Extra per-agent reward forwarded on top of getRequestDeposit() (R9).
    uint256 public agentReward;

    /// @notice Window (seconds) from adjudication firing to when a ruling may time out.
    uint256 public rulingTimeout = 1 hours;

    /// @notice Maximum adjudication rounds before an appeal forces `Deadlocked` (R6c).
    uint256 public maxRounds = 3;

    /// @notice The reqId currently being fired at the agent platform. Set inside
    ///         `_fireAgent` before `platform.createRequest`, cleared after. Lets a
    ///         mock platform (or an off-chain probe / future indexer) read exactly which
    ///         negotiation is mid-fire without decoding the agent payload. Zero outside
    ///         an active fire. Because state is set to `UnderReview` before this is
    ///         written, the CEI invariant is fully preserved.
    uint256 public currentlyFiringReqId;

    /// @dev Auto-incrementing request id.
    uint256 private _nextId = 1;

    mapping(uint256 => Negotiation) private _negotiations;

    /// @dev Maps an in-flight agent requestId back to its negotiation id.
    mapping(uint256 => uint256) private _requestToNegotiation;

    // ---------------------------------------------------------------------
    // Events (SPEC-0001 §3 — names implemented exactly)
    // ---------------------------------------------------------------------

    /// @notice SPEC-0004 §3.5. Emitted on every agent fire (initial requestAdjudication and
    ///         every appeal/submitEvidence) so off-chain indexers + the Curie packet store
    ///         can correlate the on-chain ruling request with the off-chain packet body.
    ///         `packetRoot` is the bytes32 evidenceUri until UNIT-9 (Merkle root) lands;
    ///         `packetUrl` is also a bytes32 until UNIT-9 swaps to a string body-store URL.
    event PacketSubmitted(
        uint256 indexed reqId,
        uint256 indexed round,
        bytes32 packetRoot,
        bytes32 packetUrl
    );

    event ContractCreated(
        uint256 indexed reqId,
        uint256 indexed providerId,
        uint256 indexed insurerId,
        address providerAddr,
        address insurerAddr,
        bytes32 drugRef,
        uint256 requestedAmount,
        uint256 quantity,
        uint256 daysSupply
    );
    event ContentCommitted(uint256 indexed reqId, bytes32 contentHash, bytes32 uri);
    event InsurerEngaged(uint256 indexed reqId, bytes32 policyHash, bytes32 policyUri);
    event ContractReady(uint256 indexed reqId);
    event AdjudicationRequested(uint256 indexed reqId);
    event RulingRequested(uint256 indexed reqId, uint256 indexed requestId, uint256 fee);

    /// @notice Emitted when a ruling is finalized (SPEC-0006 R24). Under the
    ///         inferString model the contract receives only a decision token from the
    ///         agent; rationale text is committed separately via `commitRationale`.
    event Ruled(
        uint256 indexed reqId,
        uint256 indexed requestId,
        Decision decision,
        uint256 coveredAmount
    );

    /// @notice Emitted when the keeper commits a rationale for a finalized ruling
    ///         (SPEC-0006 R24/R26, Amendment 0007 §5). `rationale` is the truncated
    ///         free-text reasoning (≤ MAX_RATIONALE_BYTES chars + "…" sentinel if
    ///         truncated). `requestId` and `decision` are indexed so off-chain
    ///         indexers can filter rationale by request or decision without full
    ///         log decoding.
    event RulingRationale(
        uint256 indexed reqId,
        uint256 indexed requestId,
        uint8 indexed decision,
        string rationale,
        string clauseReference,
        string standardReference
    );

    event PolicyInvalidated(uint256 indexed reqId, bytes32 clauseRef, bytes32 standardRef);
    event EvidenceRequested(uint256 indexed reqId);
    event EvidenceSubmitted(uint256 indexed reqId, bytes32 evidenceUri);
    event Appealed(uint256 indexed reqId, uint256 indexed partyId, bytes32 evidenceUri, uint256 round);
    event Accepted(uint256 indexed reqId, uint256 indexed partyId);
    event Settled(uint256 indexed reqId, uint256 coveredAmount, uint256 feePerParty);
    event Deadlocked(uint256 indexed reqId, uint256 rounds);
    event ProviderRefused(uint256 indexed reqId, bytes32 reasonHash);
    event Withdrawn(uint256 indexed reqId);
    event RulingTimedOut(uint256 indexed reqId, uint256 indexed requestId);
    event FeedbackPosted(uint256 indexed reqId, bytes32 msgHash, bytes32 uri);
    event FundsWithdrawn(address indexed to, uint256 amount);

    // ---------------------------------------------------------------------
    // Constructor / admin
    // ---------------------------------------------------------------------

    /// @param platform_ Somnia agent platform address (use a mock in tests).
    /// @dev   The second constructor parameter (agentId) is intentionally
    ///        anonymous — the canonical `LLM_INFERENCE_AGENT_ID` constant is
    ///        always written to storage regardless of what callers pass.
    ///        Signature retained for backwards-compat with existing deploy scripts
    ///        and test harnesses.
    constructor(address platform_, uint256) Ownable(msg.sender) {
        platform = IAgentRequester(platform_);
        agentId = LLM_INFERENCE_AGENT_ID;
    }

    function setPlatform(address platform_) external onlyOwner {
        platform = IAgentRequester(platform_);
    }

    function setAgentId(uint256 agentId_) external onlyOwner {
        agentId = agentId_;
    }

    function setAgentReward(uint256 agentReward_) external onlyOwner {
        agentReward = agentReward_;
    }

    function setRulingTimeout(uint256 seconds_) external onlyOwner {
        rulingTimeout = seconds_;
    }

    /// @notice Owner-settable appeal round cap N (R6c). Must be >= 1.
    function setMaxRounds(uint256 maxRounds_) external onlyOwner {
        require(maxRounds_ >= 1, "maxRounds: < 1");
        maxRounds = maxRounds_;
    }

    /// @notice Reclaim contract ETH — e.g. per-request fees refunded by the platform
    ///         on a timed-out ruling (R9), or surplus deliberately sent (via `receive`)
    ///         to pre-fund agent fees.
    /// @dev Owner only. Settlement is an event marker (R8), so any balance is purely the
    ///      agent-fee float. NOTE (Finding-1): the agent-firing entry points forward
    ///      EXACTLY the per-request fee and refund overpayment to the caller, so misrouted
    ///      caller ETH is NOT trapped here — `withdrawFunds` is not a sink for it.
    function withdrawFunds(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "funds: zero addr");
        require(amount <= address(this).balance, "funds: insufficient");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "funds: transfer failed");
        emit FundsWithdrawn(to, amount);
    }

    // ---------------------------------------------------------------------
    // Lifecycle functions
    // ---------------------------------------------------------------------

    /// @notice File a coverage-exception request as the provider → `Open` (R2).
    /// @dev Caller MUST be the provider address (R11). Stores only the justification
    ///      hash + opaque refs — never raw content (R3/R4).
    ///      SPEC-0004 R2b: rejects providerAddr == insurerAddr (supersedes SPEC-0001
    ///      R13's permissive self-claim — the demo explicitly does not support
    ///      single-party self-contracting).
    /// @return reqId The new request id.
    function createContract(
        uint256 providerId,
        uint256 insurerId,
        address providerAddr,
        address insurerAddr,
        bytes32 drugRef,
        uint256 requestedAmount,
        uint256 quantity,
        uint256 daysSupply,
        bytes32 justificationHash,
        bytes32 evidenceUri,
        PayerLine payerLine,
        string calldata agentEvidenceUrl_,
        string calldata agentPromptHint_
    ) external returns (uint256 reqId) {
        require(providerAddr != address(0) && insurerAddr != address(0), "addr: zero");
        require(msg.sender == providerAddr, "auth: not provider");
        require(quantity > 0, "qty: zero"); // quantity drives the deterministic cap (R6a)
        require(providerAddr != insurerAddr, "create: self-contract"); // SPEC-0004 R2b
        // SPEC-0006 R14: URL must be 1..512 bytes.
        require(
            bytes(agentEvidenceUrl_).length > 0 && bytes(agentEvidenceUrl_).length <= 512,
            "evidence: url required"
        );
        // SPEC-0006 R15: hint must be 1..1024 bytes and must not contain a bracketed
        // patient-name pattern ([A-Z][a-z]+ [A-Z]) — defense-in-depth PHI guard.
        require(
            bytes(agentPromptHint_).length > 0 && bytes(agentPromptHint_).length <= 1024
            && !_containsNamePattern(agentPromptHint_),
            "evidence: hint required"
        );

        reqId = _nextId++;
        Negotiation storage n = _negotiations[reqId];
        n.providerId = providerId;
        n.insurerId = insurerId;
        n.providerAddr = providerAddr;
        n.insurerAddr = insurerAddr;
        n.drugRef = drugRef;
        n.requestedAmount = requestedAmount;
        n.quantity = quantity;
        n.daysSupply = daysSupply;
        n.justificationHash = justificationHash;
        n.evidenceUri = evidenceUri;
        n.payerLine = payerLine;
        n.appealRound = 0;
        n.agentEvidenceUrl = agentEvidenceUrl_;
        n.agentPromptHint = agentPromptHint_;
        n.state = State.Open;
        n.createdAt = block.timestamp;
        n.exists = true;

        emit ContractCreated(
            reqId, providerId, insurerId, providerAddr, insurerAddr,
            drugRef, requestedAmount, quantity, daysSupply
        );
        if (justificationHash != bytes32(0)) {
            emit ContentCommitted(reqId, justificationHash, evidenceUri);
        }
    }

    /// @notice Insurer engages a filed request by attaching its governing policy
    ///         (hash on-chain, body off-chain/public) → `Ready` (R5).
    /// @dev Insurer-only (R11). Adjudication cannot run until this is called.
    function insurerEngage(uint256 reqId, bytes32 policyHash, bytes32 policyUri) external {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Open, "engage: not Open");
        require(msg.sender == n.insurerAddr, "auth: not insurer");
        require(policyHash != bytes32(0), "policy: empty");

        n.policyHash = policyHash;
        n.policyUri = policyUri;
        n.state = State.Ready;

        emit InsurerEngaged(reqId, policyHash, policyUri);
        emit ContractReady(reqId);
    }

    /// @notice Fire the native agent to adjudicate (only from `Ready`) → `UnderReview`
    ///         (R6/R9). Payable so callers fund the per-request fee.
    /// @dev Either party may trigger adjudication (R11). Requires an attached policy
    ///      (guaranteed by the `Ready` precondition — R5).
    function requestAdjudication(uint256 reqId) external payable nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Ready, "adjudicate: not Ready");
        _onlyParty(n);

        n.round = 1; // first adjudication round
        emit AdjudicationRequested(reqId);
        _fireAgent(reqId, n, msg.sender);
    }

    /// @notice Provider submits more public evidence of necessity from
    ///         `EvidenceRequested` → fires the agent directly (round++) → `UnderReview`
    ///         (R6/R9). Payable so the caller funds the per-request fee, identical fee
    ///         model to `requestAdjudication` and `appeal`. At the round cap, routes
    ///         to terminal `Deadlocked` without firing — mirroring `appeal`'s behavior
    ///         so a NeedMoreEvidence ↔ submitEvidence cycle can't loop indefinitely.
    /// @dev Provider-only (R11). Records only the opaque evidence ref (R3/R4).
    function submitEvidence(uint256 reqId, bytes32 evidenceUri) external payable nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.EvidenceRequested, "evidence: wrong state");
        require(msg.sender == n.providerAddr, "auth: not provider");
        require(evidenceUri != bytes32(0), "evidence: empty");

        // Bounded to N rounds: at the cap, the submission deadlocks instead of re-firing.
        // No agent fires → refund the caller's full `msg.value` (R9: never silently retain
        // caller ETH). Mirrors `appeal`'s cap logic; the function's `nonReentrant` modifier
        // guards the refund (CEI: terminal state set first).
        if (n.round >= maxRounds) {
            _clearRequest(n);
            n.state = State.Deadlocked;
            emit Deadlocked(reqId, n.round);
            if (msg.value > 0) {
                (bool ok, ) = payable(msg.sender).call{value: msg.value}("");
                require(ok, "fee: refund failed");
            }
            return;
        }

        n.evidenceUri = evidenceUri;
        n.round += 1;
        emit EvidenceSubmitted(reqId, evidenceUri);
        _fireAgent(reqId, n, msg.sender);
    }

    /// @notice Appeal a ruling with NEW public evidence of necessity (R6c). From
    ///         `Denied` ONLY (R14a: only a Deny justifies advancing the ladder;
    ///         appealing an Approved ruling is non-sensical — you already got what
    ///         you asked for, possibly capped). Re-fires the agent (round++) while
    ///         under the round cap; at the cap (`round >= maxRounds`) without mutual
    ///         accept it routes to terminal `Deadlocked`.
    /// @dev Either party may appeal (R11); `partyId` must be a party to the request.
    ///      An appeal MUST carry new public evidence — an empty `evidenceUri`
    ///      (price-only / free-prose appeal) reverts (T6).
    ///      SPEC-0004 §2.4 R14a: `requestAdjudication(round=N)` is refused unless
    ///      `round=N-1` was ruled Deny. In this contract's model that gate lives here
    ///      on `appeal()`.
    function appeal(
        uint256 reqId,
        uint256 partyId,
        bytes32 evidenceUri,
        bytes32 reasonHash
    ) external payable nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Denied, "appeal: prior ruling not Deny");
        _onlyParty(n);
        require(partyId == n.providerId || partyId == n.insurerId, "appeal: unknown party");
        require(evidenceUri != bytes32(0), "appeal: needs evidence");

        // Bounded to N rounds: at the cap, an appeal deadlocks instead of re-firing.
        // No agent fires, so no fee is charged — refund the caller's full `msg.value`
        // rather than trapping it (R9: never silently retain caller ETH). Guarded by
        // the function's `nonReentrant` modifier; the terminal state is set first (CEI).
        if (n.round >= maxRounds) {
            _clearRequest(n);
            n.state = State.Deadlocked;
            emit Deadlocked(reqId, n.round);
            if (msg.value > 0) {
                (bool ok, ) = payable(msg.sender).call{value: msg.value}("");
                require(ok, "fee: refund failed");
            }
            return;
        }

        n.evidenceUri = evidenceUri;
        n.rationaleHash = reasonHash; // carry the appellant's stated reason ref
        n.round += 1;
        n.appealRound += 1;
        emit Appealed(reqId, partyId, evidenceUri, n.round);
        _fireAgent(reqId, n, msg.sender);
    }

    /// @notice Accept the current ruling (R6c). From `Approved`/`Denied`. When BOTH
    ///         parties have accepted, the request becomes settleable.
    /// @dev Either party may accept (R11); `partyId` selects which accept flag.
    function accept(uint256 reqId, uint256 partyId) external {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Approved || n.state == State.Denied, "accept: not ruled");
        _onlyParty(n);

        if (partyId == n.providerId) {
            n.providerAccepted = true;
        } else if (partyId == n.insurerId) {
            n.insurerAccepted = true;
        } else {
            revert("accept: unknown party");
        }
        emit Accepted(reqId, partyId);
    }

    /// @notice Settle a mutually-accepted ruling → `Settled` (R8). EVENT MARKER ONLY
    ///         (no token transfer): records the covered amount + the 50/50 per-party
    ///         fee split derived from the accumulated agent fees.
    function settle(uint256 reqId) external {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Approved || n.state == State.Denied, "settle: not ruled");
        _onlyParty(n);
        require(n.providerAccepted && n.insurerAccepted, "settle: not both accepted");

        uint256 feePerParty = n.totalFees / 2;
        _clearRequest(n);
        n.state = State.Settled;
        emit Settled(reqId, n.coveredAmount, feePerParty);
    }

    /// @notice Provider refuses the insurer's stated terms → `ProviderRefused` (R7).
    ///         Valid from `Ready` onward while pre-terminal (terms have been attached).
    /// @dev Provider-only (R11). Records an optional reason hash.
    function refuse(uint256 reqId, bytes32 reasonHash) external {
        Negotiation storage n = _get(reqId);
        require(msg.sender == n.providerAddr, "auth: not provider");
        require(_refusable(n.state), "refuse: not refusable");
        _clearRequest(n);
        n.state = State.ProviderRefused;
        emit ProviderRefused(reqId, reasonHash);
    }

    /// @notice Withdraw a request from any pre-terminal state → `Withdrawn`.
    /// @dev Either party may withdraw (R11). Clears any in-flight agent request so a
    ///      late platform callback can never mutate a withdrawn negotiation.
    function withdraw(uint256 reqId) external {
        Negotiation storage n = _get(reqId);
        _onlyParty(n);
        require(!_terminal(n.state), "withdraw: terminal");
        _clearRequest(n);
        n.state = State.Withdrawn;
        emit Withdrawn(reqId);
    }

    /// @notice Keeper-callable timeout: after the ruling deadline, route a stuck
    ///         `UnderReview` request to the retriable `EvidenceRequested` state.
    function onRulingTimeout(uint256 reqId) external {
        Negotiation storage n = _get(reqId);
        require(n.state == State.UnderReview, "timeout: not UnderReview");
        require(n.rulingDeadline != 0 && block.timestamp >= n.rulingDeadline, "timeout: too early");
        uint256 requestId = n.pendingRequestId;
        _clearRequest(n);
        n.state = State.EvidenceRequested;
        emit RulingTimedOut(reqId, requestId);
        emit EvidenceRequested(reqId);
    }

    /// @notice Post off-chain feedback/conversation. Allowed in any active state; no
    ///         state change. Stores only the message hash + opaque ref (R4).
    function postFeedback(uint256 reqId, bytes32 msgHash, bytes32 uri) external {
        Negotiation storage n = _get(reqId);
        _onlyParty(n);
        require(!_terminal(n.state), "feedback: terminal");
        emit FeedbackPosted(reqId, msgHash, uri);
    }

    /// @notice Keeper commits the receipt-sourced rationale for a finalized ruling
    ///         (SPEC-0006 R26). Callable by the owner in v0 (keeper role is the owner).
    ///         `rationale` is truncated to MAX_RATIONALE_BYTES bytes + "…" sentinel if
    ///         longer. Callable from any post-ruling state (Approved, Denied,
    ///         PolicyInvalidated, Settled).
    /// @dev No PHI in rationale/clauseReference/standardReference (R4). The contract
    ///      hashes clauseReference and standardReference to bytes32 for storage; the
    ///      full strings are emitted only in the event for off-chain consumers.
    function commitRationale(
        uint256 reqId,
        string calldata rationale,
        string calldata clauseReference,
        string calldata standardReference
    ) external onlyOwner {
        Negotiation storage n = _get(reqId);
        require(n.hasRuling, "rationale: no ruling yet");

        // Truncate rationale to MAX_RATIONALE_BYTES bytes + "…" sentinel if needed.
        string memory truncated = _truncateRationale(rationale);

        // Store hashes of the reference strings (on-chain opaque; R4).
        n.rationaleHash = keccak256(bytes(truncated));
        n.clauseRef = keccak256(bytes(clauseReference));
        n.standardRef = keccak256(bytes(standardReference));

        emit RulingRationale(reqId, n.lastRequestId, uint8(n.lastDecision), truncated, clauseReference, standardReference);
    }

    // ---------------------------------------------------------------------
    // Platform callback
    // ---------------------------------------------------------------------

    /// @notice Somnia platform callback delivering the agent's necessity ruling
    ///         (SPEC-0006 R24/R25/R26).
    /// @dev The LLM Inference agent (`inferString`) returns a single ABI-encoded
    ///      `string` token from the `allowedValues` list:
    ///        "approve"        → Decision.Approve  → Approved state
    ///        "deny"           → Decision.Deny     → Denied state
    ///        "needs_more_info"→ Decision.NeedMoreEvidence → EvidenceRequested
    ///        "policy_invalid" → Decision.PolicyInvalid   → PolicyInvalidated
    ///      Any unknown/malformed token is treated defensively as
    ///      `needs_more_info` (routes to `EvidenceRequested`) — the contract does
    ///      not trust a garbage token to advance to a terminal state.
    ///
    ///      Gated to `msg.sender == platform`. The `handleResponse` selector is
    ///      what the contract passes to `platform.createRequest` as `callbackSelector`.
    function handleResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external override {
        require(msg.sender == address(platform), "callback: not platform");

        uint256 reqId = _requestToNegotiation[requestId];
        require(reqId != 0, "callback: unknown request");

        Negotiation storage n = _negotiations[reqId];
        require(n.state == State.UnderReview, "callback: not UnderReview");

        _clearRequest(n);

        // Non-success / empty response: route to retriable EvidenceRequested.
        if (status != ResponseStatus.Success || responses.length == 0) {
            n.state = State.EvidenceRequested;
            emit RulingTimedOut(reqId, requestId);
            emit EvidenceRequested(reqId);
            return;
        }

        // Decode the single string decision token returned by inferString.
        string memory token = abi.decode(responses[0].result, (string));
        Decision decision = _tokenToDecision(token);

        // Route NeedMoreEvidence immediately (no further state to set).
        if (decision == Decision.NeedMoreEvidence) {
            n.state = State.EvidenceRequested;
            emit EvidenceRequested(reqId);
            return;
        }

        // For all other decisions, record the ruling and reset acceptances.
        n.lastDecision = decision;
        n.lastRequestId = requestId;
        n.hasRuling = true;
        n.providerAccepted = false;
        n.insurerAccepted = false;

        if (decision == Decision.PolicyInvalid) {
            // R6b: policy void — terminal state, covered = 0.
            n.coveredAmount = 0;
            n.state = State.PolicyInvalidated;
            emit Ruled(reqId, requestId, decision, 0);
            emit PolicyInvalidated(reqId, bytes32(0), bytes32(0));
            // RulingRationale is emitted by the keeper via commitRationale (SPEC-0006 R26).
            return;
        }

        if (decision == Decision.Approve) {
            // Approved: covered = requestedAmount (no AI-chosen price cap — SPEC-0006).
            n.coveredAmount = n.requestedAmount;
            n.state = State.Approved;
            emit Ruled(reqId, requestId, decision, n.requestedAmount);
        } else {
            // Denied: covered = 0.
            n.coveredAmount = 0;
            n.state = State.Denied;
            emit Ruled(reqId, requestId, decision, 0);
        }
        // RulingRationale is emitted by the keeper via commitRationale (SPEC-0006 R26).
    }

    // ---------------------------------------------------------------------
    // Views (public reads — no auth gate, R11)
    // ---------------------------------------------------------------------

    /// @notice Full on-chain record. Exposes only hashes/refs/amounts/codes/state/
    ///         ids/addresses/timestamps — there is no raw-content field to leak (T1).
    function getNegotiation(uint256 reqId) external view returns (Negotiation memory) {
        return _get(reqId);
    }

    function stateOf(uint256 reqId) external view returns (State) {
        return _get(reqId).state;
    }

    /// @notice The deterministic covered amount (0 unless approved+computed) (R6a).
    function coveredAmountOf(uint256 reqId) external view returns (uint256) {
        return _get(reqId).coveredAmount;
    }

    /// @notice The price basis (SPEC-0006: costPlus/NADAC are 0 in string-token mode;
    ///         retained for API compatibility with the demo price gauge).
    function priceBasisOf(uint256 reqId)
        external
        view
        returns (
            uint256 requestedAmount,
            uint256 quantity,
            uint256 costPlusTotal,
            uint256 nadacFloorTotal,
            uint256 coveredAmount
        )
    {
        Negotiation storage n = _get(reqId);
        return (
            n.requestedAmount,
            n.quantity,
            _benchmarkCap(n.costPlusUnitPrice, n.quantity),
            _benchmarkCap(n.nadacUnitPrice, n.quantity),
            n.coveredAmount
        );
    }

    /// @notice Current adjudication round count (R6c).
    function roundOf(uint256 reqId) external view returns (uint256) {
        return _get(reqId).round;
    }

    /// @notice The insurer's attached policy commitment (hash + opaque ref) (R5).
    function policyOf(uint256 reqId) external view returns (bytes32 policyHash, bytes32 policyUri) {
        Negotiation storage n = _get(reqId);
        return (n.policyHash, n.policyUri);
    }

    function count() external view returns (uint256) {
        return _nextId - 1;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    /// @dev Returns true when `s` contains the patient-name pattern [A-Z][a-z]+ [A-Z]
    ///      (uppercase letter, one-or-more lowercase letters, a space, uppercase letter).
    ///      Used as a defense-in-depth PHI guard on agentPromptHint (SPEC-0006 R15).
    ///      PHI-freeness remains the caller's responsibility; this rejects common
    ///      patterns only.
    function _containsNamePattern(string calldata s) internal pure returns (bool) {
        bytes memory b = bytes(s);
        uint256 len = b.length;
        // Need at least 4 bytes: A a(+) SPACE A.
        if (len < 4) return false;
        for (uint256 i = 0; i + 3 < len; ) {
            uint8 c0 = uint8(b[i]);
            // State machine: looking for A a+ SPACE A
            if (c0 >= 65 && c0 <= 90) { // 'A'..'Z'
                uint256 j = i + 1;
                // Consume one or more lowercase letters.
                while (j < len && uint8(b[j]) >= 97 && uint8(b[j]) <= 122) { // 'a'..'z'
                    j++;
                }
                // Must have advanced at least one lowercase.
                if (j > i + 1 && j + 1 < len) {
                    uint8 sp = uint8(b[j]);
                    uint8 c2 = uint8(b[j + 1]);
                    if (sp == 32 && c2 >= 65 && c2 <= 90) { // space + uppercase
                        return true;
                    }
                }
            }
            unchecked { i++; }
        }
        return false;
    }

    /// @dev Map an inferString allowedValues token to Decision.
    ///      Unknown tokens fall through to NeedMoreEvidence (defensive fallback —
    ///      the contract never transitions to a terminal state on a garbage token).
    function _tokenToDecision(string memory token) internal pure returns (Decision) {
        bytes32 h = keccak256(bytes(token));
        if (h == keccak256(bytes("approve")))           return Decision.Approve;
        if (h == keccak256(bytes("deny")))              return Decision.Deny;
        if (h == keccak256(bytes("needs_more_info")))   return Decision.NeedMoreEvidence;
        if (h == keccak256(bytes("policy_invalid")))    return Decision.PolicyInvalid;
        // Unknown token: treat as NeedMoreEvidence (retriable, not terminal).
        return Decision.NeedMoreEvidence;
    }

    /// @dev Truncate a rationale string to MAX_RATIONALE_BYTES bytes, appending the
    ///      HORIZONTAL ELLIPSIS (U+2026, 3 UTF-8 bytes) sentinel when truncated.
    ///      Operates on raw bytes to avoid Solidity string re-encoding issues.
    function _truncateRationale(string calldata s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length <= MAX_RATIONALE_BYTES) {
            return string(b);
        }
        // Truncate at MAX_RATIONALE_BYTES bytes and append "…" (3-byte UTF-8 U+2026).
        bytes memory result = new bytes(MAX_RATIONALE_BYTES + 3);
        for (uint256 i = 0; i < MAX_RATIONALE_BYTES; i++) {
            result[i] = b[i];
        }
        // UTF-8 encoding of U+2026 HORIZONTAL ELLIPSIS: 0xE2 0x80 0xA6
        result[MAX_RATIONALE_BYTES]     = 0xE2;
        result[MAX_RATIONALE_BYTES + 1] = 0x80;
        result[MAX_RATIONALE_BYTES + 2] = 0xA6;
        return string(result);
    }

    /// @dev Fire a native agent request, forwarding EXACTLY the per-request fee (R9),
    ///      record the pending requestId, set the ruling deadline, and move to
    ///      UnderReview. CEI: state is set to UnderReview BEFORE the external call.
    ///
    ///      Payload: `inferString(prompt, system, chainOfThought, allowedValues)` —
    ///      the canonical Somnia LLM Inference agent selector `0xfe7ca098` (SPEC-0006
    ///      R11). The prompt embeds the per-negotiation `n.agentEvidenceUrl` and
    ///      `n.agentPromptHint` (caller-supplied; PHI-freeness is the caller's
    ///      responsibility — the contract's R15 guard rejects common patient-name
    ///      patterns as defense-in-depth, but cannot guarantee all forms of PHI).
    ///
    ///      FEE MODEL (R9): caller funds the per-request fee on the agent-firing entry
    ///      point. Fee = getRequestDeposit() + agentReward. Caller must cover it;
    ///      exactly `fee` is forwarded; any excess is refunded. Never retains caller ETH.
    /// @param payer The caller funding this fire (refund recipient for any overpayment).
    function _fireAgent(uint256 reqId, Negotiation storage n, address payer) internal {
        // Build the inferString payload (SPEC-0006 R11).
        // inferString(string prompt, string system, bool chainOfThought, string[] allowedValues)
        // Selector: 0xfe7ca098 = keccak256("inferString(string,string,bool,string[])")[0:4]
        string[] memory allowedValues = new string[](4);
        allowedValues[0] = "approve";
        allowedValues[1] = "deny";
        allowedValues[2] = "needs_more_info";
        allowedValues[3] = "policy_invalid";

        bytes memory payload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferString.selector,
            string(abi.encodePacked(
                n.agentPromptHint,
                " Evidence URL: ", n.agentEvidenceUrl,
                " Reply with exactly one of the allowed values."
            )),
            "You are a medical necessity arbiter. Evaluate the drug coverage request and return exactly one decision token.",
            true, // chainOfThought: enabled per SPEC-0006 §3.6.1 — enriches receipt reasoning for commitRationale (R24–R26)
            allowedValues
        );

        uint256 fee = platform.getRequestDeposit() + agentReward;
        // R9: the caller must fund at least the per-request fee. We forward EXACTLY the
        // fee and refund the rest; we never retain caller ETH as a hidden owner sink.
        require(msg.value >= fee, "fee: underfunded");
        uint256 refund = msg.value - fee;

        n.totalFees += fee; // accumulate for the 50/50 settlement marker (R8)

        // Effects before interaction (CEI).
        n.rulingDeadline = block.timestamp + rulingTimeout;
        n.state = State.UnderReview;

        // SPEC-0004 §3.5: emit PacketSubmitted before the external call (CEI-safe — all
        // state effects above are already committed). `n.round` already holds the round
        // being requested: requestAdjudication sets it to 1 before calling _fireAgent;
        // submitEvidence and appeal each do `n.round += 1` before calling _fireAgent.
        emit PacketSubmitted(reqId, n.round, n.evidenceUri, n.evidenceUri);

        // Expose the reqId for transparent probing during the external call (mock
        // platforms in tests, reentrancy guards, off-chain indexers). The slot is set
        // AFTER all state effects are committed (UnderReview is already written) so the
        // CEI invariant is preserved. Cleared immediately after the call returns.
        currentlyFiringReqId = reqId;

        // Interaction: fire the native Somnia LLM Inference agent, forwarding EXACTLY the fee.
        uint256 requestId = platform.createRequest{value: fee}(
            agentId,
            address(this),
            this.handleResponse.selector,
            payload
        );

        currentlyFiringReqId = 0;

        n.pendingRequestId = requestId;
        _requestToNegotiation[requestId] = reqId;

        emit RulingRequested(reqId, requestId, fee);

        // Refund any overpayment to the caller. Guarded by the caller's `nonReentrant`
        // entry point; all state effects above are already committed (CEI-safe).
        if (refund > 0) {
            (bool ok, ) = payable(payer).call{value: refund}("");
            require(ok, "fee: refund failed");
        }
    }

    /// @dev Overflow-SAFE benchmark cap = `unitPrice * quantity`, SATURATING at
    ///      `type(uint256).max` instead of reverting (Finding-4 domain hardening).
    ///      In string-token mode both prices are 0, so this always returns 0.
    ///      Retained for `priceBasisOf` API compat.
    function _benchmarkCap(uint256 unitPrice, uint256 quantity) internal pure returns (uint256) {
        if (unitPrice == 0 || quantity == 0) return 0;
        unchecked {
            uint256 product = unitPrice * quantity;
            // Detect overflow: if dividing back doesn't recover the price, it wrapped.
            if (product / quantity != unitPrice) return type(uint256).max;
            return product;
        }
    }

    function _clearRequest(Negotiation storage n) internal {
        if (n.pendingRequestId != 0) {
            delete _requestToNegotiation[n.pendingRequestId];
            n.pendingRequestId = 0;
        }
        n.rulingDeadline = 0;
    }

    function _get(uint256 reqId) internal view returns (Negotiation storage n) {
        n = _negotiations[reqId];
        require(n.exists, "unknown contract");
    }

    /// @dev Gate to the two registered party wallets (R11). Under a single shared
    ///      wallet both addresses are equal, so the one wallet always passes and the
    ///      app-level partyId is the trusted distinction (R12).
    function _onlyParty(Negotiation storage n) internal view {
        require(msg.sender == n.providerAddr || msg.sender == n.insurerAddr, "auth: not a party");
    }

    /// @dev Terminal (no further transitions) states.
    function _terminal(State s) internal pure returns (bool) {
        return s == State.Settled
            || s == State.Deadlocked
            || s == State.PolicyInvalidated
            || s == State.ProviderRefused
            || s == State.Withdrawn;
    }

    /// @dev `refuse` is valid from `Ready` onward while pre-terminal (R7): the
    ///      insurer's terms have been attached, and the request hasn't ended.
    function _refusable(State s) internal pure returns (bool) {
        if (s == State.Open) return false; // no terms attached yet
        return !_terminal(s);
    }

    /// @dev Accept ETH so the contract can be funded to pay agent fees.
    receive() external payable {}
}
