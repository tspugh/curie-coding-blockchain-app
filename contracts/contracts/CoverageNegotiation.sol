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

/// @title ILLMInferenceAgent
/// @notice Canonical on-chain interface for the Somnia LLM Inference agent (SPEC-0006 R11).
/// @dev Selector keccak256("inferString(string,string,bool,string[])")[0:4] = 0xfe7ca098;
///      agentId 12847293847561029384 on Somnia testnet.
interface ILLMInferenceAgent {
    function inferString(
        string memory prompt,
        string memory system,
        bool chainOfThought,
        string[] memory allowedValues
    ) external returns (string memory);
}

/// @title ILLMParseWebsiteAgent
/// @notice Canonical on-chain interface for the Somnia LLM Parse Website agent (A0007).
/// @dev Selector keccak256("ExtractString(string,string,string[],string,string,bool,uint8,uint8)")[0:4] = 0xc2dd1a7a;
///      agentId 12875401142070969085 on Somnia testnet.
interface ILLMParseWebsiteAgent {
    function ExtractString(
        string memory key,
        string memory description,
        string[] memory allowedValues,
        string memory prompt,
        string memory url,
        bool resolveUrl,
        uint8 numPages,
        uint8 confidenceThreshold
    ) external returns (string memory);
}

/// @title CoverageNegotiation
/// @notice System of record for the Curie drug coverage-exception flow: a provider
///         files a request against a named insurer, the insurer engages by attaching
///         a policy and funding escrow, and a two-agent Somnia pipeline (scrape →
///         decide) rules approve/deny/needs-more-info/policy-invalid. Either party
///         may accept or appeal; mutual accept settles real escrow on-chain.
/// @dev HARD INVARIANT (R4): no PHI / raw content is ever stored or placed in an agent
///      payload — only hashes, opaque bytes32 refs, amounts, decision codes, state,
///      ids, addresses, and timestamps live on-chain.
/// @dev AUTH (R11): party actions are gated to `msg.sender ∈ {providerAddr, insurerAddr}`;
///      `insurerEngage` is insurer-only, `submitEvidence`/`refuse` provider-only,
///      `createContract` provider-only. `providerAddr == insurerAddr` is rejected at
///      `createContract` (SPEC-0004 R2b). The `handleResponse` callback is gated to the
///      agent-platform address. Agent-firing entry points are `nonReentrant` and follow CEI.
contract CoverageNegotiation is Ownable, ReentrancyGuard, IAgentRequesterHandler {
    // ---------------------------------------------------------------------
    // State machine
    // ---------------------------------------------------------------------

    /// @dev Payer line governing the appeal ladder (SPEC-0004 R13). Selects the
    ///      regulatory stage names the UI renders; not enforced on-chain in v0 (R14b).
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

    /// @dev Two-agent pipeline phase for an in-flight adjudication (A0007). None: no
    ///      agent in flight. Scraping: LLM Parse Website running. Deciding: LLM
    ///      Inference running (after the scrape callback).
    enum AgentPhase { None, Scraping, Deciding }

    /// @dev The agent's necessity ruling, mapping the inferString allowed-values
    ///      vocabulary (SPEC-0006 R11/R24) to on-chain decision codes.
    enum Decision {
        Approve, // 0  "approve"
        Deny, // 1  "deny"
        NeedMoreEvidence, // 2  "needs_more_info"
        PolicyInvalid // 3  "policy_invalid"
    }

    /// @notice De-identified provider attestation for a patient-specific policy clause
    ///         (A0012 / SPEC-0007 R5/R13).
    /// @dev The on-chain shape is CLOSED — `{bytes32, bool, bytes32}` — so free text and
    ///      the 18 HIPAA Safe-Harbor identifiers are structurally unrepresentable; no PHI
    ///      can enter this channel (R6). The agent RECORDS and TRUSTS these; it does not
    ///      verify the patient facts behind them.
    struct Attestation {
        bytes32 clauseId; // opaque id of the attested clause (keccak of clause label, set off-chain)
        bool attested; // provider's de-identified yes/no for that clause
        bytes32 evidenceUriHash; // optional keccak of a DE-IDENTIFIED supporting URL (0 if none)
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
        uint256 escrowAmount; // ETH locked at insurerEngage; released/refunded at settle or terminal (A0008)
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
        // ROUND SEMANTICS: two NON-interchangeable counters.
        //   `round` (R6c) — total adjudication cycles: set to 1 at the first
        //   requestAdjudication, incremented on every subsequent agent fire
        //   (submitEvidence AND appeal). Deadlock cap is `round >= maxRounds`. NOT
        //   "number of appeals".
        //   `appealRound` (SPEC-0004 R13) — position in the payer-line ladder: 0 at
        //   creation (Initial Determination), incremented in `appeal()` ONLY (not in
        //   submitEvidence, which stays in the same stage). The deadlock-cap short-circuit
        //   in `appeal()` skips the bump, so a deadlock leaves it at the last fired value.
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
        AgentPhase agentPhase; // current two-agent pipeline phase (A0007)
        uint256 pendingDecideFee; // parked LLM Inference fee for phase 2 (A0007)
        address pendingFeePayer; // payer address to refund parked decide fee on failure
    }

    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    /// @notice Canonical LLM Inference agent id, Somnia testnet (SPEC-0006 R11).
    /// @dev Hard-coded so the contract always fires the correct agent; `setAgentId`
    ///      overrides for demo/testing only.
    uint256 public constant LLM_INFERENCE_AGENT_ID = 12847293847561029384;

    /// @notice Canonical LLM Parse Website (scrape) agent id, Somnia testnet (A0007).
    uint256 public constant LLM_PARSE_WEBSITE_AGENT_ID = 12875401142070969085;

    /// @notice Maximum on-chain rationale length in bytes (SPEC-0006 R26). Longer
    ///         rationale is truncated and gets a horizontal-ellipsis sentinel (U+2026).
    uint256 public constant MAX_RATIONALE_BYTES = 4096;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Somnia agent platform (IAgentRequester) this contract fires requests at.
    IAgentRequester public platform;

    /// @notice Registered agent id used for the decide phase. Initialised to
    ///         `LLM_INFERENCE_AGENT_ID` by the constructor; `setAgentId` overrides for testing.
    uint256 public agentId;

    /// @notice Extra per-agent reward forwarded on top of getRequestDeposit() (R9).
    uint256 public agentReward;

    /// @notice Window (seconds) from adjudication firing to when a ruling may time out.
    uint256 public rulingTimeout = 1 hours;

    /// @notice Maximum adjudication rounds before an appeal forces `Deadlocked` (R6c).
    uint256 public maxRounds = 3;

    /// @notice The reqId currently being fired at the agent platform; 0 outside an active fire.
    /// @dev Set just before `platform.createRequest` and cleared after, so a probe/indexer
    ///      can read which negotiation is mid-fire without decoding the payload. State is set
    ///      to `UnderReview` before this is written, preserving the CEI invariant.
    uint256 public currentlyFiringReqId;

    /// @dev Auto-incrementing request id.
    uint256 private _nextId = 1;

    /// @dev Sum of all live escrow balances (set at insurerEngage, cleared at settle/terminal).
    ///      Used by withdrawFunds to prevent draining escrow (A0008 §4).
    uint256 private _totalEscrowHeld;

    mapping(uint256 => Negotiation) private _negotiations;

    /// @dev De-identified attestations per negotiation (A0012 / SPEC-0007 R5/R13). Kept
    ///      OUT of the Negotiation struct so the getNegotiation tuple shape is unchanged;
    ///      read via getAttestations(reqId).
    mapping(uint256 => Attestation[]) private _attestations;

    /// @dev Upper bound on attestations per negotiation — a gas-griefing guard so the
    ///      decide-time conjunction loop can never be made unbounded by the caller.
    uint256 public constant MAX_ATTESTATIONS = 32;

    /// @dev Maps an in-flight agent requestId back to its negotiation id.
    mapping(uint256 => uint256) private _requestToNegotiation;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    /// @notice Emitted on every agent fire (SPEC-0004 §3.5) so off-chain indexers can
    ///         correlate the on-chain ruling request with the off-chain packet body.
    /// @dev Both `packetRoot` and `packetUrl` currently carry the bytes32 evidenceUri.
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

    /// @notice Emitted when a ruling is finalized (SPEC-0006 R24). The contract
    ///         receives only a decision token; rationale is committed separately via
    ///         `commitRationale`.
    event Ruled(
        uint256 indexed reqId,
        uint256 indexed requestId,
        Decision decision,
        uint256 coveredAmount
    );

    /// @notice Emitted when the keeper commits a rationale for a finalized ruling
    ///         (SPEC-0006 R24/R26, A0007 §5). `rationale` is the truncated free-text
    ///         reasoning (≤ MAX_RATIONALE_BYTES + "…" sentinel). `requestId` and
    ///         `decision` are indexed so indexers can filter without full log decoding.
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
    /// @dev `refundedToInsurer` = escrowAmount − coveredAmount on Approved; full escrowAmount
    ///      on Denied (A0008 §2).
    event Settled(uint256 indexed reqId, uint256 coveredAmount, uint256 refundedToInsurer);
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
    /// @dev The anonymous second parameter is ignored — `agentId` is always set to the
    ///      canonical `LLM_INFERENCE_AGENT_ID`. Signature retained for deploy/test compat.
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

    /// @notice Reclaim contract ETH — e.g. platform fee refunds (R9) or surplus pre-funded
    ///         via `receive`.
    /// @dev Owner only. Bounded to `address(this).balance - _totalEscrowHeld` so the owner
    ///      can never drain live escrow (A0008 §4).
    function withdrawFunds(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "funds: zero addr");
        uint256 drainable = address(this).balance - _totalEscrowHeld;
        require(amount <= drainable, "funds: insufficient");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "funds: transfer failed");
        emit FundsWithdrawn(to, amount);
    }

    // ---------------------------------------------------------------------
    // Lifecycle functions
    // ---------------------------------------------------------------------

    /// @notice File a coverage-exception request as the provider → `Open` (R2).
    /// @dev Provider-only (R11); stores only the justification hash + opaque refs (R3/R4).
    ///      Rejects providerAddr == insurerAddr (SPEC-0004 R2b).
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
        require(quantity > 0, "qty: zero");
        require(providerAddr != insurerAddr, "create: self-contract"); // SPEC-0004 R2b
        // SPEC-0006 R14: URL must be 1..512 bytes.
        require(
            bytes(agentEvidenceUrl_).length > 0 && bytes(agentEvidenceUrl_).length <= 512,
            "evidence: url required"
        );
        // SPEC-0006 R15: hint must be 1..1024 bytes and free of the patient-name pattern
        // (defense-in-depth PHI guard).
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
    ///         (hash on-chain, body off-chain/public) and depositing escrow → `Ready` (R5).
    /// @dev Insurer-only (R11). Adjudication cannot run until this is called.
    ///      A0008 §1: `msg.value` must be >= `requestedAmount` (escrow must fully cover
    ///      the claim). Any surplus above `requestedAmount` is refunded immediately to
    ///      the insurer (CEI + nonReentrant). `escrowAmount` is set to `requestedAmount`.
    function insurerEngage(uint256 reqId, bytes32 policyHash, bytes32 policyUri) external payable nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Open, "engage: not Open");
        require(msg.sender == n.insurerAddr, "auth: not insurer");
        require(policyHash != bytes32(0), "policy: empty");
        require(msg.value >= n.requestedAmount, "escrow: underfunded");

        uint256 escrow = n.requestedAmount;
        uint256 refund = msg.value - escrow;

        // Effects before interactions (CEI).
        n.policyHash = policyHash;
        n.policyUri = policyUri;
        n.escrowAmount = escrow;
        n.state = State.Ready;
        _totalEscrowHeld += escrow;

        emit InsurerEngaged(reqId, policyHash, policyUri);
        emit ContractReady(reqId);

        // Refund any overpayment above requestedAmount to the insurer (CEI-safe — state committed above).
        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            require(ok, "escrow: refund failed");
        }
    }

    /// @notice Fire the two-agent pipeline to adjudicate from `Ready` → `UnderReview`
    ///         (R6/R9). Payable: `msg.value` must fund BOTH the scrape and decide fees (A0007).
    /// @dev Either party may trigger adjudication (R11). This overload records no
    ///      attestations — a public-only policy.
    function requestAdjudication(uint256 reqId) external payable nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Ready, "adjudicate: not Ready");
        _onlyParty(n);
        _startAdjudication(reqId, n);
    }

    /// @notice Provider requests adjudication AND supplies the de-identified attestations
    ///         for the policy's patient-specific clauses (A0012 / SPEC-0007 R5/R13).
    /// @dev Provider-only: the provider holds the clinical facts to attest (R13). The
    ///      closed `{bytes32,bool,bytes32}` shape carries no PHI (R6). At decide time
    ///      Approve requires EVERY attestation affirmative (R7); a false one downgrades
    ///      to needs-more-info (T3). Stored under `reqId`, read by `_handleDecideResponse`
    ///      after the async scrape→decide round-trip.
    function requestAdjudication(uint256 reqId, Attestation[] calldata attestations)
        external
        payable
        nonReentrant
    {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Ready, "adjudicate: not Ready");
        require(msg.sender == n.providerAddr, "auth: not provider"); // R13: provider supplies attestations
        require(attestations.length <= MAX_ATTESTATIONS, "attest: too many");

        delete _attestations[reqId]; // overwrite any prior set for a clean record
        for (uint256 i = 0; i < attestations.length; i++) {
            _attestations[reqId].push(attestations[i]);
        }

        _startAdjudication(reqId, n);
    }

    /// @dev Shared kick-off for both `requestAdjudication` overloads. Internal so
    ///      `msg.sender` (the original caller / fee payer) is preserved for `_fireScrape`.
    function _startAdjudication(uint256 reqId, Negotiation storage n) internal {
        n.round = 1;
        emit AdjudicationRequested(reqId);
        _fireScrape(reqId, n, msg.sender);
    }

    /// @notice Read the de-identified attestations recorded for a negotiation (R13 UI).
    function getAttestations(uint256 reqId) external view returns (Attestation[] memory) {
        _get(reqId); // revert on unknown reqId
        return _attestations[reqId];
    }

    /// @dev R7 conjunction: true iff EVERY recorded attestation is affirmative; vacuously
    ///      true with none (a public-only policy). Enforced HERE deterministically rather
    ///      than by the LLM, since clauseId is opaque on-chain.
    function _allAttestationsAffirmative(uint256 reqId) internal view returns (bool) {
        Attestation[] storage atts = _attestations[reqId];
        for (uint256 i = 0; i < atts.length; i++) {
            if (!atts[i].attested) return false;
        }
        return true;
    }

    /// @notice Provider submits a new public evidence URL from `EvidenceRequested`,
    ///         re-firing the pipeline (round++) → `UnderReview` (R6/R9). At the round cap,
    ///         routes to terminal `Deadlocked` without firing, so a needs-more-info ↔
    ///         submitEvidence cycle can't loop forever.
    /// @dev Provider-only (R11). Payable; same fee model as `requestAdjudication`/`appeal`.
    function submitEvidence(uint256 reqId, string calldata newEvidenceUrl) external payable nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.EvidenceRequested, "evidence: wrong state");
        require(msg.sender == n.providerAddr, "auth: not provider");
        // A0009: re-scrape targets this NEW URL (1..512 bytes, mirroring R14).
        require(
            bytes(newEvidenceUrl).length > 0 && bytes(newEvidenceUrl).length <= 512,
            "evidence: url required"
        );

        // Round cap: deadlock instead of re-firing. No agent fires, so refund the caller's
        // full msg.value (R9) and refund the full escrow to the insurer (A0008). CEI:
        // terminal state set before refunds, guarded by `nonReentrant`.
        if (n.round >= maxRounds) {
            uint256 escrow = n.escrowAmount;
            address insurerAddr = n.insurerAddr;

            _clearRequest(n);
            n.state = State.Deadlocked;
            n.escrowAmount = 0;
            _totalEscrowHeld -= escrow;

            emit Deadlocked(reqId, n.round);

            if (msg.value > 0) {
                (bool ok, ) = payable(msg.sender).call{value: msg.value}("");
                require(ok, "fee: refund failed");
            }
            if (escrow > 0) {
                (bool ok2, ) = payable(insurerAddr).call{value: escrow}("");
                require(ok2, "deadlock: escrow refund failed");
            }
            return;
        }

        // A0009: point the scrape at the NEW URL; keep a keccak audit hash for the event
        // (no raw text on-chain). `_fireScrape` reads `n.agentEvidenceUrl`.
        n.agentEvidenceUrl = newEvidenceUrl;
        n.evidenceUri = keccak256(bytes(newEvidenceUrl));
        n.round += 1;
        emit EvidenceSubmitted(reqId, n.evidenceUri);
        _fireScrape(reqId, n, msg.sender);
    }

    /// @notice Appeal a `Denied` ruling with a NEW public evidence URL (R6c). Denied-only:
    ///         only a Deny justifies advancing the ladder (SPEC-0004 §2.4 R14a). Re-fires
    ///         the pipeline (round++) under the round cap; at the cap routes to terminal
    ///         `Deadlocked`.
    /// @dev Either party may appeal (R11); `partyId` must be a party. An appeal MUST carry
    ///      new evidence — an empty URL reverts (T6).
    function appeal(
        uint256 reqId,
        uint256 partyId,
        string calldata newEvidenceUrl,
        bytes32 reasonHash
    ) external payable nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Denied, "appeal: prior ruling not Deny");
        _onlyParty(n);
        require(partyId == n.providerId || partyId == n.insurerId, "appeal: unknown party");
        // A0009: an appeal supplies a NEW public evidence URL to re-scrape.
        require(
            bytes(newEvidenceUrl).length > 0 && bytes(newEvidenceUrl).length <= 512,
            "appeal: needs evidence"
        );

        // Round cap: deadlock instead of re-firing. No agent fires, so refund the caller's
        // full msg.value (R9) and refund the full escrow to the insurer (A0008). CEI:
        // terminal state set before refunds, guarded by `nonReentrant`.
        if (n.round >= maxRounds) {
            uint256 escrow = n.escrowAmount;
            address insurerAddr = n.insurerAddr;

            _clearRequest(n);
            n.state = State.Deadlocked;
            n.escrowAmount = 0;
            _totalEscrowHeld -= escrow;

            emit Deadlocked(reqId, n.round);

            if (msg.value > 0) {
                (bool ok, ) = payable(msg.sender).call{value: msg.value}("");
                require(ok, "fee: refund failed");
            }
            if (escrow > 0) {
                (bool ok2, ) = payable(insurerAddr).call{value: escrow}("");
                require(ok2, "deadlock: escrow refund failed");
            }
            return;
        }

        // A0009: re-scrape the new URL; keep a keccak audit hash for the event.
        n.agentEvidenceUrl = newEvidenceUrl;
        n.evidenceUri = keccak256(bytes(newEvidenceUrl));
        n.rationaleHash = reasonHash; // appellant's stated reason ref
        n.round += 1;
        n.appealRound += 1;
        emit Appealed(reqId, partyId, n.evidenceUri, n.round);
        _fireScrape(reqId, n, msg.sender);
    }

    /// @notice Accept the current ruling (R6c). From `Approved`/`Denied`. When BOTH
    ///         parties have accepted, the request becomes settleable.
    /// @dev Either party may accept (R11); `partyId` selects which accept flag.
    function accept(uint256 reqId, uint256 partyId) external {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Approved || n.state == State.Denied, "accept: not ruled");
        _onlyParty(n);

        // SECURITY (C1): bind the accept flag to msg.sender — a party may set ONLY its own
        // flag. Otherwise a party could pass the COUNTERPARTY's partyId to flip both flags
        // and `settle()` unilaterally, bypassing the R6c accept-vs-appeal choice. partyId
        // must name the caller's own role (kept for the Accepted event / ABI stability).
        if (msg.sender == n.providerAddr) {
            require(partyId == n.providerId, "accept: not your party");
            n.providerAccepted = true;
        } else {
            require(partyId == n.insurerId, "accept: not your party");
            n.insurerAccepted = true;
        }
        emit Accepted(reqId, partyId);
    }

    /// @notice Settle a mutually-accepted ruling → `Settled` (R8 / A0008).
    ///         Approved path: transfers `coveredAmount` ETH → provider; refunds any
    ///         remainder (`escrowAmount - coveredAmount`) → insurer.
    ///         Denied path: refunds full `escrowAmount` → insurer; provider gets nothing.
    /// @dev CEI: state → `Settled` and `escrowAmount = 0` committed BEFORE every
    ///      `.call{value}`. `nonReentrant` guards the entry point.
    function settle(uint256 reqId) external nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Approved || n.state == State.Denied, "settle: not ruled");
        _onlyParty(n);
        require(n.providerAccepted && n.insurerAccepted, "settle: not both accepted");

        uint256 escrow = n.escrowAmount;
        uint256 covered = n.coveredAmount;
        address providerAddr = n.providerAddr;
        address insurerAddr = n.insurerAddr;

        // CEI: commit state before any external calls.
        _clearRequest(n);
        n.state = State.Settled;
        n.escrowAmount = 0;
        _totalEscrowHeld -= escrow;

        // A0008 §2: refundedToInsurer = escrow − covered (0 when denied and covered == 0).
        uint256 refundedToInsurer = escrow - covered;
        emit Settled(reqId, covered, refundedToInsurer);

        if (covered > 0) {
            (bool okP, ) = payable(providerAddr).call{value: covered}("");
            require(okP, "settle: provider transfer failed");
        }
        uint256 remainder = escrow - covered;
        if (remainder > 0) {
            (bool okI, ) = payable(insurerAddr).call{value: remainder}("");
            require(okI, "settle: insurer refund failed");
        }
    }

    /// @notice Provider refuses the insurer's stated terms → `ProviderRefused` (R7).
    ///         Valid from `Ready` onward while pre-terminal (terms have been attached).
    ///         A0008: refunds the full `escrowAmount` to the insurer.
    /// @dev Provider-only (R11). Records an optional reason hash.
    ///      CEI: state → `ProviderRefused` and `escrowAmount = 0` committed before `.call{value}`.
    function refuse(uint256 reqId, bytes32 reasonHash) external nonReentrant {
        Negotiation storage n = _get(reqId);
        require(msg.sender == n.providerAddr, "auth: not provider");
        require(_refusable(n.state), "refuse: not refusable");

        uint256 escrow = n.escrowAmount;
        address insurerAddr = n.insurerAddr;

        // CEI: commit state before external call.
        _clearRequest(n);
        n.state = State.ProviderRefused;
        n.escrowAmount = 0;
        _totalEscrowHeld -= escrow;

        emit ProviderRefused(reqId, reasonHash);

        if (escrow > 0) {
            (bool ok, ) = payable(insurerAddr).call{value: escrow}("");
            require(ok, "refuse: escrow refund failed");
        }
    }

    /// @notice Withdraw a request from any pre-terminal state → `Withdrawn`.
    ///         A0008: refunds the full `escrowAmount` to the insurer.
    /// @dev Either party may withdraw (R11). Clears any in-flight agent request so a
    ///      late platform callback can never mutate a withdrawn negotiation.
    ///      CEI: state → `Withdrawn` and `escrowAmount = 0` committed before `.call{value}`.
    function withdraw(uint256 reqId) external nonReentrant {
        Negotiation storage n = _get(reqId);
        _onlyParty(n);
        require(!_terminal(n.state), "withdraw: terminal");

        uint256 escrow = n.escrowAmount;
        address insurerAddr = n.insurerAddr;

        // CEI: commit state before external call.
        _clearRequest(n);
        n.state = State.Withdrawn;
        n.escrowAmount = 0;
        _totalEscrowHeld -= escrow;

        emit Withdrawn(reqId);

        if (escrow > 0) {
            (bool ok, ) = payable(insurerAddr).call{value: escrow}("");
            require(ok, "withdraw: escrow refund failed");
        }
    }

    /// @notice Keeper-callable timeout: after the ruling deadline, route a stuck
    ///         `UnderReview` request to the retriable `EvidenceRequested` state.
    /// @dev R9 / A0007: must refund any parked `pendingDecideFee` to `pendingFeePayer`
    ///      and reset `agentPhase` regardless of phase, or a scrape/decide that never
    ///      calls back would strand the decide-fee ETH in the contract.
    function onRulingTimeout(uint256 reqId) external {
        Negotiation storage n = _get(reqId);
        require(n.state == State.UnderReview, "timeout: not UnderReview");
        require(n.rulingDeadline != 0 && block.timestamp >= n.rulingDeadline, "timeout: too early");
        uint256 requestId = n.pendingRequestId;

        // Capture and clear parked decide-fee bookkeeping before the refund (CEI).
        uint256 refund = n.pendingDecideFee;
        address payer  = n.pendingFeePayer;
        n.pendingDecideFee = 0;
        n.pendingFeePayer  = address(0);
        n.agentPhase       = AgentPhase.None;

        _clearRequest(n);
        n.state = State.EvidenceRequested;
        emit RulingTimedOut(reqId, requestId);
        emit EvidenceRequested(reqId);

        // R9: refund the parked decide fee to the original payer (if any).
        if (refund > 0) {
            (bool ok, ) = payable(payer).call{value: refund}("");
            require(ok, "fee: refund failed");
        }
    }

    /// @notice Post off-chain feedback/conversation. Allowed in any active state; no
    ///         state change. Stores only the message hash + opaque ref (R4).
    function postFeedback(uint256 reqId, bytes32 msgHash, bytes32 uri) external {
        Negotiation storage n = _get(reqId);
        _onlyParty(n);
        require(!_terminal(n.state), "feedback: terminal");
        emit FeedbackPosted(reqId, msgHash, uri);
    }

    /// @notice Keeper (owner in v0) commits the receipt-sourced rationale for a finalized
    ///         ruling (SPEC-0006 R26). `rationale` is truncated to MAX_RATIONALE_BYTES + "…"
    ///         if longer. Callable from any post-ruling state.
    /// @dev No PHI in any argument (R4). clauseReference/standardReference are hashed to
    ///      bytes32 for storage; the full strings are emitted only in the event.
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

    /// @notice Somnia platform callback delivering an agent result; branches on
    ///         `agentPhase` (SPEC-0006 R24–R26, A0007). Scraping: fire the decide agent on
    ///         success, else refund the parked fee and route to EvidenceRequested. Deciding:
    ///         map the decision token to a terminal/retriable state.
    /// @dev Gated to `msg.sender == platform`. This selector is passed to
    ///      `platform.createRequest` as `callbackSelector`.
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

        if (n.agentPhase == AgentPhase.Scraping) {
            _handleScrapeResponse(reqId, requestId, responses, status, n);
        } else {
            _handleDecideResponse(reqId, requestId, responses, status, n);
        }
    }

    /// @dev Handle a callback from the LLM Parse Website (scrape) agent.
    ///      On Success: decode the evidence string and fire the LLM Inference agent
    ///      (phase 2) using the parked pendingDecideFee. On non-success: refund the
    ///      parked fee and route to EvidenceRequested.
    function _handleScrapeResponse(
        uint256 reqId,
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Negotiation storage n
    ) internal {
        _clearRequest(n);

        // Non-success / empty scrape: refund parked decide fee and route to retriable state.
        if (status != ResponseStatus.Success || responses.length == 0) {
            uint256 refund = n.pendingDecideFee;
            address payer = n.pendingFeePayer;
            n.pendingDecideFee = 0;
            n.pendingFeePayer = address(0);
            n.agentPhase = AgentPhase.None;
            n.state = State.EvidenceRequested;
            emit RulingTimedOut(reqId, requestId);
            emit EvidenceRequested(reqId);
            if (refund > 0) {
                (bool ok, ) = payable(payer).call{value: refund}("");
                require(ok, "fee: refund failed");
            }
            return;
        }

        // Decode the extracted evidence string returned by ExtractString.
        string memory evidence = abi.decode(responses[0].result, (string));

        // Fire LLM Inference (phase 2) with the parked decide fee. Clear BOTH parked
        // fields once consumed — leaving pendingFeePayer set would be dead state (LOW-4).
        uint256 decideFee = n.pendingDecideFee;
        n.pendingDecideFee = 0;
        n.pendingFeePayer  = address(0);
        n.agentPhase = AgentPhase.Deciding;

        _fireDecide(reqId, n, decideFee, evidence);
    }

    /// @dev Handle a callback from the LLM Inference (decide) agent.
    ///      Decodes the single string decision token and transitions state.
    function _handleDecideResponse(
        uint256 reqId,
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Negotiation storage n
    ) internal {
        _clearRequest(n);
        n.agentPhase = AgentPhase.None;

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

        // A0012 (SPEC-0007 R7): deterministic attestation conjunction enforced on-chain
        // (the agent can't evaluate opaque clauseIds). A false attestation downgrades
        // Approve to needs-more-info so the provider can correct it (T3). Vacuously true,
        // hence a no-op, for public-only policies.
        if (decision == Decision.Approve && !_allAttestationsAffirmative(reqId)) {
            decision = Decision.NeedMoreEvidence;
        }

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
            // A0008: refund full escrow to insurer (CEI: state + escrowAmount = 0 set first).
            uint256 escrow = n.escrowAmount;
            address insurerAddr = n.insurerAddr;

            n.coveredAmount = 0;
            n.state = State.PolicyInvalidated;
            n.escrowAmount = 0;
            _totalEscrowHeld -= escrow;

            emit Ruled(reqId, requestId, decision, 0);
            emit PolicyInvalidated(reqId, bytes32(0), bytes32(0));
            // RulingRationale is emitted by the keeper via commitRationale (SPEC-0006 R26).

            if (escrow > 0) {
                (bool ok, ) = payable(insurerAddr).call{value: escrow}("");
                require(ok, "policy_invalid: escrow refund failed");
            }
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
        return Decision.NeedMoreEvidence; // unknown token: retriable, never terminal
    }

    /// @dev Truncate a rationale string to MAX_RATIONALE_BYTES bytes, appending the
    ///      HORIZONTAL ELLIPSIS (U+2026, 3 UTF-8 bytes) sentinel when truncated.
    ///      Operates on raw bytes to avoid Solidity string re-encoding issues.
    function _truncateRationale(string calldata s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length <= MAX_RATIONALE_BYTES) {
            return string(b);
        }
        bytes memory result = new bytes(MAX_RATIONALE_BYTES + 3);
        for (uint256 i = 0; i < MAX_RATIONALE_BYTES; i++) {
            result[i] = b[i];
        }
        // UTF-8 encoding of U+2026 HORIZONTAL ELLIPSIS: 0xE2 0x80 0xA6.
        result[MAX_RATIONALE_BYTES]     = 0xE2;
        result[MAX_RATIONALE_BYTES + 1] = 0x80;
        result[MAX_RATIONALE_BYTES + 2] = 0xA6;
        return string(result);
    }

    /// @dev Phase 1 of the pipeline (A0007): fire LLM Parse Website (ExtractString,
    ///      0xc2dd1a7a) against n.agentEvidenceUrl, parking the decide fee in
    ///      n.pendingDecideFee for phase 2.
    ///      FEE MODEL (R9): one msg.value funds BOTH fees = 2 × (getRequestDeposit() +
    ///      agentReward). Exactly the scrape fee is forwarded now, the decide fee is parked,
    ///      any excess is refunded — caller ETH is never retained.
    /// @param payer The caller funding this fire (refund recipient for any overpayment).
    function _fireScrape(uint256 reqId, Negotiation storage n, address payer) internal {
        uint256 perCallFee = platform.getRequestDeposit() + agentReward;
        uint256 totalRequired = perCallFee * 2;
        require(msg.value >= totalRequired, "fee: underfunded");
        uint256 refund = msg.value - totalRequired;

        // Park the decide fee for use in the Scraping callback.
        n.pendingDecideFee = perCallFee;
        n.pendingFeePayer = payer;
        n.agentPhase = AgentPhase.Scraping;
        n.totalFees += perCallFee; // scrape fee portion of accumulated fees (R8)

        // Build the ExtractString payload (A0007).
        string[] memory scrapeAllowedValues = new string[](0); // free-text extraction
        // A0011: source-agnostic, diagnosis-TARGETED, VERBATIM extraction. A generic
        // summarizing prompt silently dropped the requested indication (openFDA Humira →
        // plaque-psoriasis denial). Quote rather than summarize, and key extraction on this
        // request's indication (n.agentPromptHint) so the same goal works on an FDA label
        // AND on a prose compendia source supplied on appeal (A0009).
        bytes memory payload = abi.encodeWithSelector(
            ILLMParseWebsiteAgent.ExtractString.selector,
            "evidence",
            "Drug coverage evidence from the provided URL",
            scrapeAllowedValues,
            string(abi.encodePacked(
                "Extract VERBATIM (quote the relevant text; do NOT summarize) any passage that establishes whether the drug is FDA-approved, OR supported by recognized clinical compendia/guidelines, for the indication in this request: ",
                n.agentPromptHint,
                " Also extract any dosing or quantity limits stated for the drug. Do not summarize or omit the requested indication."
            )),
            n.agentEvidenceUrl,
            // F2: follow redirects + read multiple pages. The prior `false`/`1` (page 1, no
            // redirects) choked on prose/compendia appeal sources, indistinguishable from a
            // real needs_more_info, so the verbatim goal couldn't reach the support passage.
            true, // resolveUrl: follow redirects
            5,    // numPages: compendia/prose sources span pages
            0     // confidenceThreshold: no minimum
        );

        // Effects before interaction (CEI).
        n.rulingDeadline = block.timestamp + rulingTimeout;
        n.state = State.UnderReview;

        // SPEC-0004 §3.5: emit PacketSubmitted before the external call.
        emit PacketSubmitted(reqId, n.round, n.evidenceUri, n.evidenceUri);

        currentlyFiringReqId = reqId;

        // Interaction: fire LLM Parse Website, forwarding exactly the scrape fee.
        uint256 requestId = platform.createRequest{value: perCallFee}(
            LLM_PARSE_WEBSITE_AGENT_ID,
            address(this),
            this.handleResponse.selector,
            payload
        );

        currentlyFiringReqId = 0;

        n.pendingRequestId = requestId;
        _requestToNegotiation[requestId] = reqId;

        emit RulingRequested(reqId, requestId, perCallFee);

        // Refund any overpayment to the caller (CEI-safe — state fully committed above).
        if (refund > 0) {
            (bool ok, ) = payable(payer).call{value: refund}("");
            require(ok, "fee: refund failed");
        }
    }

    /// @dev Minimal uint8 → decimal string (0..255). Inlined rather than pulling
    ///      OpenZeppelin `Strings`, whose `Bytes.sol` dependency uses the Cancun
    ///      `mcopy` opcode this build's EVM target does not emit.
    function _u8ToString(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint8 len;
        for (uint8 j = v; j != 0; j /= 10) {
            len++;
        }
        bytes memory b = new bytes(len);
        for (uint8 k = len; v != 0; v /= 10) {
            k--;
            b[k] = bytes1(uint8(48 + (v % 10)));
        }
        return string(b);
    }

    /// @dev A0010: render the appeal-ladder rung as a prompt clause so the
    ///      decide agent knows which regulatory stage it is ruling at. Composed
    ///      only of enum labels + an integer — no free text, no PHI (R4).
    function _ladderContext(PayerLine line, uint8 round) internal pure returns (string memory) {
        string memory lineName = line == PayerLine.PartD
            ? "PartD"
            : line == PayerLine.Commercial
                ? "Commercial"
                : "Medicaid";
        return string(abi.encodePacked(
            " Appeal context: ",
            lineName,
            " review ladder, stage ",
            _u8ToString(round),
            " (stage 0 = initial determination); apply progressively stricter medical-necessity scrutiny at higher stages."
        ));
    }

    /// @dev Phase 2 of the pipeline (A0007): fire LLM Inference (inferString, 0xfe7ca098)
    ///      with the decide fee parked by `_fireScrape`, called from the Scraping callback
    ///      after a successful scrape. CEI: the caller (`_handleScrapeResponse`) commits the
    ///      agentPhase / pendingDecideFee effects before this interaction.
    function _fireDecide(
        uint256 reqId,
        Negotiation storage n,
        uint256 decideFee,
        string memory evidence
    ) internal {
        n.totalFees += decideFee; // decide-fee portion of accumulated fees (R8)

        string[] memory allowedValues = new string[](4);
        allowedValues[0] = "approve";
        allowedValues[1] = "deny";
        allowedValues[2] = "needs_more_info";
        allowedValues[3] = "policy_invalid";

        bytes memory payload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferString.selector,
            string(abi.encodePacked(
                n.agentPromptHint,
                _ladderContext(n.payerLine, n.appealRound), // A0010: rung → prompt
                " Evidence URL: ", n.agentEvidenceUrl,
                " Extracted evidence: ", evidence,
                // A0011: broaden the rubric — legitimate off-label use is covered too.
                " Treat the indication as covered (approve) if the extracted evidence shows the drug is FDA-approved OR supported by recognized clinical compendia/guidelines for this indication; otherwise deny, or reply needs_more_info if the evidence is insufficient.",
                // A0012 (R7/R9): de-identified attestation context. The provider asserts the
                // patient-specific criteria; these are recorded and trusted, not independently
                // verified. The affirmative-conjunction is enforced deterministically on-chain.
                " Provider de-identified attestations for patient-specific criteria are ",
                _allAttestationsAffirmative(reqId) ? "all affirmative" : "NOT all affirmative",
                ".",
                " Reply with exactly one of the allowed values."
            )),
            "You are a medical necessity arbiter. Evaluate the drug coverage request and return exactly one decision token.",
            true, // chainOfThought: enabled per SPEC-0006 §3.6.1
            allowedValues
        );

        currentlyFiringReqId = reqId;
        uint256 decideRequestId = platform.createRequest{value: decideFee}(
            agentId,
            address(this),
            this.handleResponse.selector,
            payload
        );
        currentlyFiringReqId = 0;

        n.pendingRequestId = decideRequestId;
        _requestToNegotiation[decideRequestId] = reqId;
        n.rulingDeadline = block.timestamp + rulingTimeout;

        emit RulingRequested(reqId, decideRequestId, decideFee);
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
