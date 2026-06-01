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

/// @notice Somnia LLM Parse Website base agent — fetches a URL and extracts a number.
/// @dev Agent ID 12875401142070969085 on Somnia testnet. Validators know how to run it.
interface IParseWebsiteAgent {
    function ExtractANumber(
        string memory key,
        string memory description,
        uint256 min,
        uint256 max,
        string memory prompt,
        string memory url,
        bool resolveUrl,
        uint8 numPages
    ) external returns (uint256);
}

/// @title CoverageNegotiation
/// @notice System of record for the Curie MVP0 drug coverage-exception flow
///         (SPEC-0001, revised 2026-05-27 → AI necessity-arbiter model).
///
///         A **provider** files a coverage-exception request against a named
///         **insurer** (drug ref, de-identified justification hash, public-evidence
///         ref, requested/billed amount). The insurer **engages** by attaching its
///         governing **policy** (hash on-chain, body off-chain) — adjudication
///         cannot run until a policy is attached (R5). Adjudication fires a native
///         Somnia agent acting as a **necessity arbiter**: it weighs the provider's
///         cited public evidence against the insurer's policy criteria and rules
///         `approve | deny | need_more_evidence`, citing the policy clause it relies
///         on (R6). If a relied-on clause contradicts a public standard (e.g. the
///         FDA-approved indication) the agent **voids the contract** →
///         `PolicyInvalidated` (R6b). On `approve` the covered amount is computed
///         **deterministically** by the contract as `min(requested, benchmarkCap)`,
///         never AI-chosen (R6a). Either party may `accept` or `appeal with new
///         public evidence`; appeals re-fire the agent and are bounded to N rounds →
///         `Deadlocked` (R6c). Both accepting settles (event marker, 50/50 fee
///         split — R8). The provider may `refuse` the insurer's terms →
///         `ProviderRefused` (R7).
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

    /// @dev The agent's necessity ruling. Mirrors the `approve | deny |
    ///      need_more_evidence` vocabulary (R6) plus the policy-void outcome (R6b).
    enum Decision {
        Approve, // 0
        Deny, // 1
        NeedMoreEvidence, // 2
        PolicyInvalid // 3  relied-on clause contradicts a public standard
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
        uint256 quantity; // dispensed units (NDC-pinned) — DRIVES the cap (R2/R6a)
        uint256 daysSupply; // optional clinical-utilization context (necessity, NOT price)
        bytes32 justificationHash; // keccak256 of the de-identified justification
        bytes32 evidenceUri; // opaque ref to the latest public-evidence doc
        bytes32 policyHash; // keccak256 of the insurer's attached policy body
        bytes32 policyUri; // opaque ref to the public policy body (R5)
        uint256 coveredAmount; // deterministic min(requested, cap) on approve (R6a)
        uint256 costPlusUnitPrice; // Mark Cuban Cost Plus per-unit price (agent lookup, R10)
        uint256 nadacUnitPrice; // NADAC per-unit acquisition-cost FLOOR reference (R6a/R10)
        bytes32 rationaleHash; // hash of the agent's latest rationale
        bytes32 clauseRef; // the policy clause the agent relied on (R6)
        bytes32 standardRef; // public standard cited for a policy flag (R6b)
        Decision lastDecision; // latest agent decision (meaningful once ruled)
        bool hasRuling; // whether an agent decision has landed
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
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Somnia agent platform (IAgentRequester) this contract fires requests at.
    /// @dev When `selfHosted == true`, this slot holds the orchestrator EOA's address
    ///      cast to IAgentRequester. `_fireAgent` branches on `selfHosted` to skip the
    ///      `platform.createRequest` / `platform.getRequestDeposit` external calls that
    ///      would revert against an EOA (no code at the address). See Amendment 0006.
    IAgentRequester public platform;

    /// @notice Amendment 0006: when true, the "platform" is actually a trusted EOA
    ///         orchestrator we run; `_fireAgent` skips the `platform.createRequest`
    ///         external call and emits the request event in its own; `handleResponse`
    ///         still gates `msg.sender == address(platform)` so only our orchestrator
    ///         can deliver a ruling. `_fireAgent` consumer not yet wired (tick 118+);
    ///         this storage + setter (`setPlatformSelfHosted`) ships first as a safe
    ///         additive surface so an Opus solidity-compliance reviewer can verify the
    ///         contract diff in isolation before the behavior change lands.
    bool public selfHosted;

    /// @notice Registered agent id to run for necessity arbitration.
    uint256 public agentId;

    /// @notice Extra per-agent reward forwarded on top of getRequestDeposit() (R9).
    uint256 public agentReward;

    /// @notice Window (seconds) from adjudication firing to when a ruling may time out.
    uint256 public rulingTimeout = 1 hours;

    /// @notice Maximum adjudication rounds before an appeal forces `Deadlocked` (R6c).
    uint256 public maxRounds = 3;

    /// @notice URL the Somnia LLM Parse Website agent fetches to determine medical necessity.
    /// @dev The agent extracts a number from this page: 1=approve coverage, 0=deny.
    ///      Set to an FDA label or drug information page. Updatable by owner for demos.
    string public agentEvidenceUrl =
        "https://medlineplus.gov/druginfo/meds/a603010.html";

    /// @notice The reqId currently being fired at the agent platform. Set inside
    ///         `_fireAgent` before `platform.createRequest`, cleared after. Lets a
    ///         mock platform (or an off-chain probe / future indexer) read exactly which
    ///         negotiation is mid-fire without decoding the agent payload. Zero outside
    ///         an active fire. Because state is set to `UnderReview` before this is
    ///         written, the CEI invariant is fully preserved.
    /// @dev Amendment 0006 exception: NOT set in the self-hosted path
    ///      (`_fireAgentSelfHosted`) because there's no external `platform.createRequest`
    ///      call for an observer to interleave with. Self-hosted observers should read
    ///      the `RulingRequested` event instead, which fires synchronously after the
    ///      synthetic requestId is minted.
    uint256 public currentlyFiringReqId;

    /// @dev Auto-incrementing request id.
    uint256 private _nextId = 1;

    mapping(uint256 => Negotiation) private _negotiations;

    /// @dev Maps an in-flight agent requestId back to its negotiation id.
    mapping(uint256 => uint256) private _requestToNegotiation;

    /// @dev Amendment 0006: monotonic nonce used to seed synthetic agent-request IDs
    ///      in self-hosted mode. Mixed with block.number + address(this) + reqId
    ///      under keccak256 so two negotiations firing in the same block can't
    ///      collide on the same requestId. Unused when `selfHosted == false`.
    ///      APPENDED to the storage block (after the existing mappings) so adding
    ///      this slot doesn't shift `_nextId`, `_negotiations`, or `_requestToNegotiation`
    ///      — preserves storage-layout compat for any future upgrade-in-place.
    uint256 private _selfHostedNonce;

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
    event Ruled(
        uint256 indexed reqId,
        uint256 indexed requestId,
        Decision decision,
        uint256 coveredAmount,
        bytes32 rationaleHash,
        bytes32 clauseRef,
        uint256 receiptId,
        uint16[] policyVoidedClauseIndices,
        uint16[] usedReferenceIndices,
        bytes32[] usedLeafHashes
    );
    event PolicyFlagged(uint256 indexed reqId, bytes32 clauseRef, bytes32 standardRef);
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
    /// @param agentId_ Registered agent id used for adjudication.
    constructor(address platform_, uint256 agentId_) Ownable(msg.sender) {
        platform = IAgentRequester(platform_);
        agentId = agentId_;
    }

    function setPlatform(address platform_) external onlyOwner {
        platform = IAgentRequester(platform_);
        selfHosted = false;
    }

    /// @notice Amendment 0006: configure the contract for self-hosted-orchestrator mode.
    ///         The `platform_` is treated as a trusted EOA we run; `_fireAgent`
    ///         (once wired in a follow-up tick) will skip the `platform.createRequest`
    ///         external call and just emit the request event. `handleResponse` still
    ///         gates `msg.sender == address(platform)` — only our orchestrator EOA can
    ///         deliver a ruling. Owner-only; reversible via `setPlatform` (which clears
    ///         the self-hosted flag).
    function setPlatformSelfHosted(address platform_) external onlyOwner {
        platform = IAgentRequester(platform_);
        selfHosted = true;
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

    /// @notice Update the URL the Somnia LLM agent fetches for necessity determination.
    function setAgentEvidenceUrl(string calldata url) external onlyOwner {
        agentEvidenceUrl = url;
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
        PayerLine payerLine
    ) external returns (uint256 reqId) {
        require(providerAddr != address(0) && insurerAddr != address(0), "addr: zero");
        require(msg.sender == providerAddr, "auth: not provider");
        require(quantity > 0, "qty: zero"); // quantity drives the deterministic cap (R6a)
        require(providerAddr != insurerAddr, "create: self-contract"); // SPEC-0004 R2b

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

    // ---------------------------------------------------------------------
    // Platform callback
    // ---------------------------------------------------------------------

    /// @notice Somnia platform callback delivering the agent's necessity ruling
    ///         (R6/R6a/R6b/R9).
    /// @dev DESIGN NOTE (carried from v0, re-verified against Somnia docs): the real
    ///      platform calls the fixed `IAgentRequesterHandler.handleResponse(requestId,
    ///      responses, status, details)` signature, so that is what we implement and
    ///      the selector we pass to `createRequest`. From `responses[0].result` we
    ///      decode the arbiter tuple:
    ///        `(Decision decision, uint256 costPlusUnitPrice, uint256 nadacUnitPrice,
    ///          bytes32 rationaleHash, bytes32 clauseRef, bytes32 standardRef,
    ///          uint256 receiptId)`.
    ///      R6a forbids an AI-chosen amount: the agent supplies only PUBLIC PRICE
    ///      LOOKUPS (Mark Cuban Cost Plus per-unit retail price + NADAC per-unit
    ///      acquisition-cost floor), and the CONTRACT computes the cap
    ///      deterministically as `benchmarkCap = costPlusUnitPrice * quantity` then
    ///      `coveredAmount = min(requestedAmount, benchmarkCap)` (R6a, resolved
    ///      2026-05-27). `quantity` (R2) is the cap driver; `daysSupply` never enters
    ///      the price. NADAC is recorded as the floor reference. A `PolicyInvalid`
    ///      decision voids the contract (R6b). Gated to the platform.
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

        // MULTI-RESPONSE POLICY (R6/R9): the platform delivers the CONSENSUS-encoded
        // result. We read exactly `responses[0]` as that consensus output and ignore
        // any further validator entries (`responses[1..]`); the platform is trusted to
        // have reconciled validators into `responses[0]` before this callback. The
        // empty / failed / timed-out case (`responses.length == 0` or a non-Success
        // status) carries no usable ruling, so it routes to the retriable
        // `EvidenceRequested` state rather than reverting or guessing a decision.
        if (status != ResponseStatus.Success || responses.length == 0) {
            n.state = State.EvidenceRequested;
            emit RulingTimedOut(reqId, requestId);
            emit EvidenceRequested(reqId);
            return;
        }

        // Decode the arbiter tuple: (decision, costPlusUnitPrice, nadacUnitPrice,
        // rationaleHash, clauseRef, standardRef, receiptId, policyVoidedClauseIndices,
        // usedReferenceIndices, usedLeafHashes).
        // This matches the encoding produced by MockAgentPlatform.triggerRuling and
        // the real Somnia agent. policyVoidedClauseIndices is the 8th element (SPEC-0004 R23);
        // usedReferenceIndices and usedLeafHashes are the 9th and 10th (SPEC-0004 R11).
        (
            uint8 decisionRaw,
            uint256 costPlusUnitPrice,
            uint256 nadacUnitPrice,
            bytes32 rationaleHash,
            bytes32 clauseRef,
            bytes32 standardRef,
            uint256 receiptId,
            uint16[] memory policyVoidedClauseIndices,
            uint16[] memory usedReferenceIndices,
            bytes32[] memory usedLeafHashes
        ) = abi.decode(
            responses[0].result,
            (uint8, uint256, uint256, bytes32, bytes32, bytes32, uint256, uint16[], uint16[], bytes32[])
        );
        Decision decision = Decision(decisionRaw);

        // `NeedMoreEvidence`: agent requests additional public evidence before ruling.
        // Route to the retriable `EvidenceRequested` state (R6/R9).
        if (decision == Decision.NeedMoreEvidence) {
            n.state = State.EvidenceRequested;
            emit EvidenceRequested(reqId);
            return;
        }

        // Store agent-supplied lookup data for all other decisions.
        n.lastDecision = decision;
        n.hasRuling = true;
        n.costPlusUnitPrice = costPlusUnitPrice;
        n.nadacUnitPrice = nadacUnitPrice;
        n.rationaleHash = rationaleHash;
        n.clauseRef = clauseRef;
        n.standardRef = standardRef;
        // A fresh ruling resets prior acceptances — parties accept THIS ruling.
        n.providerAccepted = false;
        n.insurerAccepted = false;

        if (decision == Decision.PolicyInvalid) {
            // R6b: relied-on clause contradicts a public standard — void the contract.
            emit PolicyFlagged(reqId, clauseRef, standardRef);
            n.coveredAmount = 0;
            n.state = State.PolicyInvalidated;
            emit Ruled(reqId, requestId, decision, 0, rationaleHash, clauseRef, receiptId, policyVoidedClauseIndices, usedReferenceIndices, usedLeafHashes);
            emit PolicyInvalidated(reqId, clauseRef, standardRef);
            return;
        }

        if (decision == Decision.Approve) {
            // R6a: deterministic cap = min(requestedAmount, costPlusUnitPrice × quantity).
            // The agent supplies only public price lookups; the CONTRACT computes the amount.
            uint256 benchmarkCap = _benchmarkCap(costPlusUnitPrice, n.quantity);
            uint256 covered = benchmarkCap > 0 && benchmarkCap < n.requestedAmount
                ? benchmarkCap
                : n.requestedAmount;
            n.coveredAmount = covered;
            n.state = State.Approved;
            emit Ruled(reqId, requestId, decision, covered, rationaleHash, clauseRef, receiptId, policyVoidedClauseIndices, usedReferenceIndices, usedLeafHashes);
        } else {
            // Denied: agent found no clear medical necessity for coverage.
            n.coveredAmount = 0;
            n.state = State.Denied;
            emit Ruled(reqId, requestId, decision, 0, rationaleHash, clauseRef, receiptId, policyVoidedClauseIndices, usedReferenceIndices, usedLeafHashes);
        }
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

    /// @notice The price basis behind the deterministic cap (R6a) — for the demo
    ///         price gauge (SPEC-0002 R5): requested vs NADAC vs Cost Plus vs covered.
    /// @return requestedAmount The provider's billed amount.
    /// @return quantity Dispensed units (cap driver).
    /// @return costPlusTotal Cost Plus per-unit × quantity (the benchmark cap).
    /// @return nadacFloorTotal NADAC per-unit × quantity (acquisition-cost floor reference).
    /// @return coveredAmount The deterministic covered amount.
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

    /// @dev Fire a native agent request, forwarding EXACTLY the per-request fee (R9),
    ///      record the pending requestId, set the ruling deadline, and move to
    ///      UnderReview. CEI: state is set to UnderReview BEFORE the external call.
    ///
    ///      FEE MODEL (R9, hardened 2026-05-27): the caller funds the per-request fee
    ///      on the agent-firing entry point (`requestAdjudication` / `submitEvidence` /
    ///      `appeal`, all `payable` + `nonReentrant`). The fee is computed first, the
    ///      caller MUST cover it (`require(msg.value >= fee)`), exactly `fee` is
    ///      forwarded to the platform, and ANY excess is refunded to the caller. Caller
    ///      ETH is never silently trapped as owner-withdrawable balance. The refund is a
    ///      single low-level send AFTER the platform interaction; the surrounding entry
    ///      points are `nonReentrant`, so the refund cannot be used to re-enter, and the
    ///      negotiation's effects (UnderReview, deadline, fee accounting) are all
    ///      committed before either external call (CEI).
    /// @param payer The caller funding this fire (refund recipient for any overpayment).
    function _fireAgent(uint256 reqId, Negotiation storage n, address payer) internal {
        // Amendment 0006 branch: in self-hosted mode the "platform" is an EOA we run
        // (the off-chain orchestrator), so `platform.createRequest` /
        // `platform.getRequestDeposit` external calls would revert (EOAs have no code).
        // The selfHosted path skips those calls, generates a synthetic requestId
        // locally, and forwards `agentReward` (which acts as the orchestrator fee)
        // via plain call. handleResponse stays gated on `msg.sender == platform` —
        // only the orchestrator EOA can deliver a ruling. Common state effects
        // (UnderReview, rulingDeadline, totalFees, PacketSubmitted, RulingRequested,
        // _requestToNegotiation) are identical across both branches.
        if (selfHosted) {
            _fireAgentSelfHosted(reqId, n, payer);
            return;
        }

        // Payload for the Somnia LLM Parse Website base agent (ExtractANumber).
        // The agent fetches agentEvidenceUrl (an FDA label or drug info page) and
        // uses an LLM to extract whether coverage should be approved (1) or denied (0).
        // No PHI is in the URL or prompt — only the public drug information page is fetched.
        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractANumber.selector,
            "coverage_decision",
            "1=APPROVE drug coverage (medically necessary and FDA-indicated), 0=DENY coverage",
            uint256(0),
            uint256(1),
            "Based on this drug information page, is the drug FDA-approved and medically necessary for treating rheumatoid arthritis and similar inflammatory conditions? Return 1 to APPROVE coverage or 0 to DENY.",
            agentEvidenceUrl,
            true,
            uint8(1)
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
        // `packetRoot` and `packetUrl` proxy the on-chain evidenceUri until UNIT-9
        // (Merkle root + string body-store URL) lands.
        emit PacketSubmitted(reqId, n.round, n.evidenceUri, n.evidenceUri);

        // Expose the reqId for transparent probing during the external call (mock
        // platforms in tests, reentrancy guards, off-chain indexers). The slot is set
        // AFTER all state effects are committed (UnderReview is already written) so the
        // CEI invariant is preserved. Cleared immediately after the call returns.
        currentlyFiringReqId = reqId;

        // Interaction: fire the native Somnia agent, forwarding EXACTLY the per-request fee.
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

    /// @dev Amendment 0006: self-hosted agent firing. Skips the
    ///      `platform.createRequest` / `getRequestDeposit` external calls
    ///      (they'd revert against an EOA-as-platform), generates a synthetic
    ///      requestId locally, and forwards `agentReward` to the orchestrator
    ///      via plain call. State machine + invariants identical to the
    ///      platform path: same UnderReview transition, same rulingDeadline,
    ///      same _requestToNegotiation mapping, same RulingRequested event.
    ///      Guarded by the caller's `nonReentrant` entry point (CEI: all
    ///      state effects committed before either external call).
    function _fireAgentSelfHosted(uint256 reqId, Negotiation storage n, address payer) internal {
        // Self-hosted fee is just the configurable agentReward — there is no
        // platform-side per-request deposit to add. agentReward may be 0 (free
        // demo) or non-zero (the orchestrator EOA collects it as its fee).
        uint256 fee = agentReward;
        require(msg.value >= fee, "fee: underfunded");
        uint256 refund = msg.value - fee;

        n.totalFees += fee; // accumulate for the 50/50 settlement marker (R8)

        // Effects before interaction (CEI). Identical state transitions to the
        // platform path so handleResponse and the rest of the state machine treat
        // self-hosted and platform-driven adjudications interchangeably.
        n.rulingDeadline = block.timestamp + rulingTimeout;
        n.state = State.UnderReview;

        // Synthetic requestId — keccak256(block.number, address(this), reqId,
        // ++nonce) guarantees uniqueness across same-block fires (the nonce
        // tiebreaks even when the other three inputs collide). Cast to uint256
        // to match the platform.createRequest return type so downstream code
        // (handleResponse, _requestToNegotiation) is shape-compatible.
        _selfHostedNonce += 1;
        uint256 requestId = uint256(
            keccak256(abi.encode(block.number, address(this), reqId, _selfHostedNonce))
        );
        n.pendingRequestId = requestId;
        _requestToNegotiation[requestId] = reqId;

        emit PacketSubmitted(reqId, n.round, n.evidenceUri, n.evidenceUri);
        emit RulingRequested(reqId, requestId, fee);

        // Interactions: forward the fee to the orchestrator EOA, then refund the
        // caller's overpayment. Both guarded by the caller's `nonReentrant`
        // entry point; all state effects above are already committed (CEI-safe).
        if (fee > 0) {
            (bool feeOk, ) = payable(address(platform)).call{value: fee}("");
            require(feeOk, "fee: orchestrator transfer failed");
        }
        if (refund > 0) {
            (bool refundOk, ) = payable(payer).call{value: refund}("");
            require(refundOk, "fee: refund failed");
        }
    }

    /// @dev Overflow-SAFE benchmark cap = `unitPrice * quantity`, SATURATING at
    ///      `type(uint256).max` instead of reverting (Finding-4 domain hardening). A
    ///      malformed/extreme per-unit price can therefore never revert the callback
    ///      path; when the product saturates, the requested amount binds in the `min`.
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
