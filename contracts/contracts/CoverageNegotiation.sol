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
///      A third, unrelated wallet reverts. Reads are public (no gate). Under the
///      single-shared-wallet model (R12) both addresses are equal and the parties
///      are distinguished by the trusted app-level `partyId` argument. The platform
///      callback `handleResponse` is gated to the agent-platform address. Agent-
///      firing entry points are `nonReentrant` and follow checks-effects-interactions.
contract CoverageNegotiation is Ownable, ReentrancyGuard, IAgentRequesterHandler {
    // ---------------------------------------------------------------------
    // State machine (SPEC-0001 §3 "State machine" table — implemented exactly)
    // ---------------------------------------------------------------------
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
        bytes32 justificationHash; // keccak256 of the de-identified justification
        bytes32 evidenceUri; // opaque ref to the latest public-evidence doc
        bytes32 policyHash; // keccak256 of the insurer's attached policy body
        bytes32 policyUri; // opaque ref to the public policy body (R5)
        uint256 coveredAmount; // deterministic min(requested, cap) on approve (R6a)
        bytes32 rationaleHash; // hash of the agent's latest rationale
        bytes32 clauseRef; // the policy clause the agent relied on (R6)
        bytes32 standardRef; // public standard cited for a policy flag (R6b)
        Decision lastDecision; // latest agent decision (meaningful once ruled)
        bool hasRuling; // whether an agent decision has landed
        uint256 round; // adjudication round count (bounded to maxRounds — R6c)
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
    IAgentRequester public platform;

    /// @notice Registered agent id to run for necessity arbitration.
    uint256 public agentId;

    /// @notice Extra per-agent reward forwarded on top of getRequestDeposit() (R9).
    uint256 public agentReward;

    /// @notice Window (seconds) from adjudication firing to when a ruling may time out.
    uint256 public rulingTimeout = 1 hours;

    /// @notice Maximum adjudication rounds before an appeal forces `Deadlocked` (R6c).
    uint256 public maxRounds = 3;

    /// @dev Auto-incrementing request id.
    uint256 private _nextId = 1;

    mapping(uint256 => Negotiation) private _negotiations;

    /// @dev Maps an in-flight agent requestId back to its negotiation id.
    mapping(uint256 => uint256) private _requestToNegotiation;

    // ---------------------------------------------------------------------
    // Events (SPEC-0001 §3 — names implemented exactly)
    // ---------------------------------------------------------------------
    event ContractCreated(
        uint256 indexed reqId,
        uint256 indexed providerId,
        uint256 indexed insurerId,
        address providerAddr,
        address insurerAddr,
        bytes32 drugRef,
        uint256 requestedAmount
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
        uint256 receiptId
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
    ///         on a timed-out ruling (R9), or surplus sent to fund agent fees.
    /// @dev Owner only. Settlement is an event marker (R8), so the balance is purely
    ///      the agent-fee float.
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
    /// @dev Caller MUST be the provider address (R11). Self-claim (providerAddr ==
    ///      insurerAddr / providerId == insurerId) is permitted (R13). Stores only
    ///      the justification hash + opaque refs — never raw content (R3/R4).
    /// @return reqId The new request id.
    function createContract(
        uint256 providerId,
        uint256 insurerId,
        address providerAddr,
        address insurerAddr,
        bytes32 drugRef,
        uint256 requestedAmount,
        bytes32 justificationHash,
        bytes32 evidenceUri
    ) external returns (uint256 reqId) {
        require(providerAddr != address(0) && insurerAddr != address(0), "addr: zero");
        require(msg.sender == providerAddr, "auth: not provider");

        reqId = _nextId++;
        Negotiation storage n = _negotiations[reqId];
        n.providerId = providerId;
        n.insurerId = insurerId;
        n.providerAddr = providerAddr;
        n.insurerAddr = insurerAddr;
        n.drugRef = drugRef;
        n.requestedAmount = requestedAmount;
        n.justificationHash = justificationHash;
        n.evidenceUri = evidenceUri;
        n.state = State.Open;
        n.createdAt = block.timestamp;
        n.exists = true;

        emit ContractCreated(
            reqId, providerId, insurerId, providerAddr, insurerAddr, drugRef, requestedAmount
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
        _fireAgent(reqId, n);
    }

    /// @notice Provider submits more public evidence of necessity from
    ///         `EvidenceRequested`; re-fires the agent → `UnderReview`, round++ (R6c).
    /// @dev Provider-only (R11). Records only the opaque evidence ref (R3/R4).
    function submitEvidence(uint256 reqId, bytes32 evidenceUri) external payable nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.EvidenceRequested, "evidence: wrong state");
        require(msg.sender == n.providerAddr, "auth: not provider");
        require(evidenceUri != bytes32(0), "evidence: empty");

        n.evidenceUri = evidenceUri;
        n.round += 1;
        emit EvidenceSubmitted(reqId, evidenceUri);
        _fireAgent(reqId, n);
    }

    /// @notice Appeal a ruling with NEW public evidence of necessity (R6c). From
    ///         `Approved`/`Denied`. Re-fires the agent (round++) while under the
    ///         round cap; at the cap (`round >= maxRounds`) without mutual accept it
    ///         routes to terminal `Deadlocked`.
    /// @dev Either party may appeal (R11); `partyId` must be a party to the request.
    ///      An appeal MUST carry new public evidence — an empty `evidenceUri`
    ///      (price-only / free-prose appeal) reverts (T6).
    function appeal(
        uint256 reqId,
        uint256 partyId,
        bytes32 evidenceUri,
        bytes32 reasonHash
    ) external payable nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Approved || n.state == State.Denied, "appeal: not ruled");
        _onlyParty(n);
        require(partyId == n.providerId || partyId == n.insurerId, "appeal: unknown party");
        require(evidenceUri != bytes32(0), "appeal: needs evidence");

        // Bounded to N rounds: at the cap, an appeal deadlocks instead of re-firing.
        if (n.round >= maxRounds) {
            _clearRequest(n);
            n.state = State.Deadlocked;
            emit Deadlocked(reqId, n.round);
            return;
        }

        n.evidenceUri = evidenceUri;
        n.rationaleHash = reasonHash; // carry the appellant's stated reason ref
        n.round += 1;
        emit Appealed(reqId, partyId, evidenceUri, n.round);
        _fireAgent(reqId, n);
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
    ///        `(Decision decision, uint256 benchmarkCap, bytes32 rationaleHash,
    ///          bytes32 clauseRef, bytes32 standardRef, uint256 receiptId)`.
    ///      SPEC-0001 §3 names a `coveredAmount` field in this tuple, but R6a forbids
    ///      an AI-chosen amount: we therefore treat the decoded amount as the public
    ///      price `benchmarkCap` and the CONTRACT computes the covered amount
    ///      deterministically as `min(requestedAmount, benchmarkCap)` (R6a). A
    ///      `PolicyInvalid` decision voids the contract (R6b). Gated to the platform.
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

        // Failed / TimedOut / empty consensus -> retriable EvidenceRequested.
        if (status != ResponseStatus.Success || responses.length == 0) {
            n.state = State.EvidenceRequested;
            emit RulingTimedOut(reqId, requestId);
            emit EvidenceRequested(reqId);
            return;
        }

        (
            Decision decision,
            uint256 benchmarkCap,
            bytes32 rationaleHash,
            bytes32 clauseRef,
            bytes32 standardRef,
            uint256 receiptId
        ) = abi.decode(responses[0].result, (Decision, uint256, bytes32, bytes32, bytes32, uint256));

        n.lastDecision = decision;
        n.hasRuling = true;
        n.rationaleHash = rationaleHash;
        n.clauseRef = clauseRef;
        n.standardRef = standardRef;
        // A fresh ruling resets prior acceptances — parties accept THIS ruling.
        n.providerAccepted = false;
        n.insurerAccepted = false;

        if (decision == Decision.PolicyInvalid) {
            // R6b: a relied-on clause contradicts a public standard — void the contract.
            n.coveredAmount = 0;
            n.state = State.PolicyInvalidated;
            emit PolicyFlagged(reqId, clauseRef, standardRef);
            emit Ruled(reqId, requestId, decision, 0, rationaleHash, clauseRef, receiptId);
            emit PolicyInvalidated(reqId, clauseRef, standardRef);
            return;
        }

        if (decision == Decision.Approve) {
            // R6a: deterministic covered amount — never AI-chosen.
            uint256 covered = n.requestedAmount < benchmarkCap ? n.requestedAmount : benchmarkCap;
            n.coveredAmount = covered;
            n.state = State.Approved;
            emit Ruled(reqId, requestId, decision, covered, rationaleHash, clauseRef, receiptId);
        } else if (decision == Decision.Deny) {
            n.coveredAmount = 0;
            n.state = State.Denied;
            emit Ruled(reqId, requestId, decision, 0, rationaleHash, clauseRef, receiptId);
        } else {
            // NeedMoreEvidence
            n.state = State.EvidenceRequested;
            emit Ruled(reqId, requestId, decision, 0, rationaleHash, clauseRef, receiptId);
            emit EvidenceRequested(reqId);
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

    /// @dev Fire a native agent request, forwarding the per-request fee (R9), record
    ///      the pending requestId, set the ruling deadline, and move to UnderReview.
    ///      CEI: state is set to UnderReview BEFORE the external call.
    function _fireAgent(uint256 reqId, Negotiation storage n) internal {
        // Payload carries ONLY the de-identified extract: drug ref, requested amount,
        // the public policy ref, and the public-evidence ref — never raw content (R4).
        bytes memory payload = abi.encode(
            reqId,
            n.drugRef,
            n.requestedAmount,
            n.policyHash,
            n.policyUri,
            n.evidenceUri
        );

        uint256 fee = platform.getRequestDeposit() + agentReward;
        n.totalFees += fee; // accumulate for the 50/50 settlement marker (R8)

        // Effects before interaction (CEI).
        n.rulingDeadline = block.timestamp + rulingTimeout;
        n.state = State.UnderReview;

        // Interaction: fire the native Somnia agent, forwarding the per-request fee.
        uint256 requestId = platform.createRequest{value: fee}(
            agentId,
            address(this),
            this.handleResponse.selector,
            payload
        );

        n.pendingRequestId = requestId;
        _requestToNegotiation[requestId] = reqId;

        emit RulingRequested(reqId, requestId, fee);
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
