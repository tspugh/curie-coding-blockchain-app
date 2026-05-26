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
/// @notice System of record for the Curie MVP0 coverage-exception negotiation loop
///         (SPEC-0001 §3). Two parties open a contract, each submit a price position,
///         and once both are in either may raise a dispute. A dispute fires a
///         native Somnia agent that rules `approve | deny | need_more_evidence`
///         against a published Medicare Part D formulary; the platform calls back
///         into this contract with the verdict + receipt.
/// @dev HARD INVARIANT (R4): no PHI / no raw content is ever stored. Only keccak256
///      hashes, opaque refs (bytes32), amounts, state, ids, and timestamps live
///      on-chain. Settlement (R8) is an event marker only — no token transfer.
/// @dev TRUST MODEL (v0): identities are app-level profile/agent ids (`uint256`),
///      NOT `msg.sender`. Under the single-shared-wallet model (R12/R13) both parties
///      may transact from one address, so the contract intentionally does not bind
///      `msg.sender` to a party — lifecycle authorization is delegated to the app
///      layer. On-chain caller binding / KYC is out of v0 scope (SPEC-0001 §7). The
///      ONE call that is strictly gated is the platform callback `handleResponse`,
///      which only the agent-platform address may invoke. The agent-firing entry
///      points are `nonReentrant` and follow checks-effects-interactions so the
///      single external call (`platform.createRequest`) cannot re-enter the state
///      machine.
contract CoverageNegotiation is Ownable, ReentrancyGuard, IAgentRequesterHandler {
    // ---------------------------------------------------------------------
    // State machine (SPEC-0001 §3 "State machine" table — implemented exactly)
    // ---------------------------------------------------------------------
    enum State {
        Open,
        Ready,
        UnderReview,
        EvidenceRequested,
        Approved,
        Denied,
        Appealed,
        Settled,
        Withdrawn
    }

    /// @dev A single party's negotiating position. `proposedAmount` is meaningful
    ///      only once `submitted` is true.
    struct Position {
        uint256 proposedAmount;
        bool submitted;
    }

    /// @dev Per-contract record. Holds only hashes/refs/amounts/state/ids/timestamps.
    struct Negotiation {
        uint256 initiatorId; // profile/agent id of the initiator
        uint256 destinationId; // profile/agent id of the destination party
        bytes32 drugRef; // opaque reference to the drug under negotiation
        bytes32 noteHash; // keccak256 of the off-chain patient note
        uint256 priceFloor; // benchmark band lower bound
        uint256 priceCeil; // benchmark band upper bound
        bytes32 evidenceUri; // opaque ref to the latest off-chain evidence
        Position initiatorPosition;
        Position destinationPosition;
        uint256 agreedAmount; // amount recorded at settlement (within band)
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

    /// @notice Registered agent id to run for dispute resolution.
    uint256 public agentId;

    /// @notice Extra per-agent reward forwarded on top of getRequestDeposit() (R9).
    uint256 public agentReward;

    /// @notice Window (seconds) from a dispute firing to when a ruling may time out.
    uint256 public rulingTimeout = 1 hours;

    /// @dev Auto-incrementing contract id.
    uint256 private _nextId = 1;

    mapping(uint256 => Negotiation) private _negotiations;

    /// @dev Maps an in-flight agent requestId back to its negotiation id.
    mapping(uint256 => uint256) private _requestToNegotiation;

    // ---------------------------------------------------------------------
    // Events (SPEC-0001 §3 — names implemented exactly)
    // ---------------------------------------------------------------------
    event ContractCreated(
        uint256 indexed reqId,
        uint256 indexed initiatorId,
        uint256 indexed destinationId,
        bytes32 drugRef,
        uint256 priceFloor,
        uint256 priceCeil
    );
    event ContentCommitted(uint256 indexed reqId, bytes32 contentHash, bytes32 uri);
    event PositionSubmitted(uint256 indexed reqId, uint256 indexed partyId, uint256 proposedAmount);
    event ContractReady(uint256 indexed reqId);
    event DisputeSubmitted(uint256 indexed reqId, uint256 indexed byPartyId);
    event RulingRequested(uint256 indexed reqId, uint256 indexed requestId, uint256 fee);
    event Ruled(uint256 indexed reqId, uint256 indexed requestId, string verdict, uint256 receiptId);
    event RulingTimedOut(uint256 indexed reqId, uint256 indexed requestId);
    event FeedbackPosted(uint256 indexed reqId, bytes32 msgHash, bytes32 uri);
    event EvidenceSubmitted(uint256 indexed reqId, bytes32 evidenceUri);
    event Appealed(uint256 indexed reqId, bytes32 evidenceUri);
    event Settled(uint256 indexed reqId, uint256 agreedAmount);
    event Withdrawn(uint256 indexed reqId);
    event FundsWithdrawn(address indexed to, uint256 amount);

    // ---------------------------------------------------------------------
    // Constructor / admin
    // ---------------------------------------------------------------------

    /// @param platform_ Somnia agent platform address (use a mock in tests).
    /// @param agentId_ Registered agent id used to resolve disputes.
    constructor(address platform_, uint256 agentId_) Ownable(msg.sender) {
        platform = IAgentRequester(platform_);
        agentId = agentId_;
    }

    /// @notice Owner-settable platform address (e.g. to repoint at a mock or new deploy).
    function setPlatform(address platform_) external onlyOwner {
        platform = IAgentRequester(platform_);
    }

    /// @notice Owner-settable agent id.
    function setAgentId(uint256 agentId_) external onlyOwner {
        agentId = agentId_;
    }

    /// @notice Owner-settable extra per-agent reward added to the platform deposit (R9).
    function setAgentReward(uint256 agentReward_) external onlyOwner {
        agentReward = agentReward_;
    }

    /// @notice Owner-settable ruling timeout window in seconds.
    function setRulingTimeout(uint256 seconds_) external onlyOwner {
        rulingTimeout = seconds_;
    }

    /// @notice Reclaim contract ETH — e.g. per-request fees refunded by the platform
    ///         on a timed-out ruling (R9), or any surplus sent to fund agent fees.
    /// @dev Owner only. The contract holds no user deposits (settlement is an event
    ///      marker, R8), so its balance is purely the agent-fee float.
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

    /// @notice Create a coverage-negotiation contract in `Open`.
    /// @dev Self-contract (initiatorId == destinationId) is permitted (R13).
    ///      Stores only the note hash and refs — never raw content (R3/R4).
    /// @return reqId The new contract id.
    function createContract(
        uint256 initiatorId,
        uint256 destinationId,
        bytes32 drugRef,
        bytes32 noteHash,
        uint256 priceFloor,
        uint256 priceCeil,
        bytes32 evidenceUri
    ) external returns (uint256 reqId) {
        require(priceFloor <= priceCeil, "band: floor>ceil");

        reqId = _nextId++;
        Negotiation storage n = _negotiations[reqId];
        n.initiatorId = initiatorId;
        n.destinationId = destinationId;
        n.drugRef = drugRef;
        n.noteHash = noteHash;
        n.priceFloor = priceFloor;
        n.priceCeil = priceCeil;
        n.evidenceUri = evidenceUri;
        n.state = State.Open;
        n.createdAt = block.timestamp;
        n.exists = true;

        emit ContractCreated(reqId, initiatorId, destinationId, drugRef, priceFloor, priceCeil);
    }

    /// @notice Attach an off-chain content commitment (hash + opaque ref) to a contract.
    /// @dev Records only the hash and uri; never the content itself (R3/R4).
    function attachContent(uint256 reqId, bytes32 contentHash, bytes32 uri) external {
        Negotiation storage n = _get(reqId);
        require(_isActive(n.state), "not active");
        n.noteHash = contentHash;
        n.evidenceUri = uri;
        emit ContentCommitted(reqId, contentHash, uri);
    }

    /// @notice Submit a party's proposed amount (position). Each party may submit once.
    /// @dev When BOTH parties have submitted, the contract advances Open -> Ready and
    ///      emits ContractReady (R5). `partyId` must be the initiator or destination id.
    function submitPosition(
        uint256 reqId,
        uint256 partyId,
        uint256 proposedAmount,
        bytes32 contentHash,
        bytes32 uri
    ) external {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Open, "not Open");

        bool isInitiator = partyId == n.initiatorId;
        bool isDestination = partyId == n.destinationId;
        require(isInitiator || isDestination, "unknown party");

        // For a self-contract both positions are submitted by the same id; the first
        // call fills the initiator slot, the second fills the destination slot.
        if (isInitiator && !n.initiatorPosition.submitted) {
            n.initiatorPosition = Position(proposedAmount, true);
        } else if (isDestination && !n.destinationPosition.submitted) {
            n.destinationPosition = Position(proposedAmount, true);
        } else {
            revert("position already submitted");
        }

        if (contentHash != bytes32(0)) {
            n.noteHash = contentHash;
            emit ContentCommitted(reqId, contentHash, uri);
        }

        emit PositionSubmitted(reqId, partyId, proposedAmount);

        if (n.initiatorPosition.submitted && n.destinationPosition.submitted) {
            n.state = State.Ready;
            emit ContractReady(reqId);
        }
    }

    /// @notice Raise a dispute. Only valid in `Ready` (both positions in) (R5/R6).
    /// @dev Fires the native Somnia agent and moves to UnderReview. Forwards the
    ///      per-request fee (R9). Payable so callers fund the request.
    function submitDispute(uint256 reqId, uint256 byPartyId) external payable nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Ready, "dispute: not Ready");
        require(byPartyId == n.initiatorId || byPartyId == n.destinationId, "unknown party");

        emit DisputeSubmitted(reqId, byPartyId);
        _fireAgent(reqId, n);
    }

    /// @notice Submit additional evidence while in `EvidenceRequested`; re-fires the agent.
    /// @dev Records only the opaque evidence ref (R3/R4) and returns to UnderReview.
    function submitEvidence(uint256 reqId, bytes32 evidenceUri) external payable nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.EvidenceRequested, "evidence: wrong state");
        n.evidenceUri = evidenceUri;
        emit EvidenceSubmitted(reqId, evidenceUri);
        _fireAgent(reqId, n);
    }

    /// @notice Appeal a denial; re-fires the agent. Valid only from `Denied`.
    /// @dev Marks the negotiation Appealed transiently then UnderReview via _fireAgent.
    function appeal(uint256 reqId, bytes32 evidenceUri) external payable nonReentrant {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Denied, "appeal: not Denied");
        n.evidenceUri = evidenceUri;
        n.state = State.Appealed;
        emit Appealed(reqId, evidenceUri);
        _fireAgent(reqId, n);
    }

    /// @notice Post off-chain feedback/conversation. Allowed in any active state; no
    ///         state change (R7). Stores only the message hash + opaque ref.
    function postFeedback(uint256 reqId, bytes32 msgHash, bytes32 uri) external {
        Negotiation storage n = _get(reqId);
        require(_isActive(n.state), "feedback: not active");
        emit FeedbackPosted(reqId, msgHash, uri);
    }

    /// @notice Settle an approved contract by recording the agreed amount (R8).
    /// @dev EVENT MARKER ONLY — no token transfer. Amount must be within the band.
    function settle(uint256 reqId, uint256 agreedAmount) external {
        Negotiation storage n = _get(reqId);
        require(n.state == State.Approved, "settle: not Approved");
        require(agreedAmount >= n.priceFloor && agreedAmount <= n.priceCeil, "settle: out of band");
        n.agreedAmount = agreedAmount;
        n.state = State.Settled;
        emit Settled(reqId, agreedAmount);
    }

    /// @notice Withdraw a contract from any pre-`Settled` state.
    /// @dev Clears any in-flight agent request mapping so a late platform callback can
    ///      never mutate a withdrawn negotiation (its `requestId` no longer resolves —
    ///      the callback reverts at the unknown-request guard) and stale `requestId`
    ///      bookkeeping cannot collide with a future request.
    function withdraw(uint256 reqId) external {
        Negotiation storage n = _get(reqId);
        require(n.state != State.Settled && n.state != State.Withdrawn, "withdraw: terminal");
        _clearRequest(n);
        n.state = State.Withdrawn;
        emit Withdrawn(reqId);
    }

    /// @notice Keeper-callable timeout: after the ruling deadline, route a stuck
    ///         UnderReview contract to the retriable EvidenceRequested state.
    function onRulingTimeout(uint256 reqId) external {
        Negotiation storage n = _get(reqId);
        require(n.state == State.UnderReview, "timeout: not UnderReview");
        require(n.rulingDeadline != 0 && block.timestamp >= n.rulingDeadline, "timeout: too early");
        uint256 requestId = n.pendingRequestId;
        _clearRequest(n);
        n.state = State.EvidenceRequested;
        emit RulingTimedOut(reqId, requestId);
    }

    // ---------------------------------------------------------------------
    // Platform callback
    // ---------------------------------------------------------------------

    /// @notice Somnia platform callback delivering the agent's verdict (R6/R9).
    /// @dev DESIGN NOTE: SPEC-0001 §3 describes `handleRuling(reqId, verdict,
    ///      rationaleHash, receiptId)`, but the real Somnia platform calls the
    ///      fixed `IAgentRequesterHandler.handleResponse(requestId, responses,
    ///      status, details)` signature (confirmed via Context7). We implement the
    ///      REAL signature so this works against the live platform, and decode the
    ///      verdict string (`approve|deny|need_more_evidence`) and `receipt` from
    ///      responses[0]. The decoded verdict + receiptId are surfaced via the
    ///      `Ruled` event, preserving the spec's intent. The agent's selector
    ///      passed to createRequest is therefore `handleResponse.selector`.
    ///      Gated to the platform address. Failed/TimedOut route to the retriable
    ///      EvidenceRequested state (state-machine table).
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

        // Failed / TimedOut (or any non-success) -> retriable EvidenceRequested.
        if (status != ResponseStatus.Success || responses.length == 0) {
            n.state = State.EvidenceRequested;
            emit Ruled(reqId, requestId, "timeout", 0);
            return;
        }

        string memory verdict = abi.decode(responses[0].result, (string));
        uint256 receiptId = responses[0].receipt;

        bytes32 v = keccak256(bytes(verdict));
        if (v == keccak256(bytes("approve"))) {
            n.state = State.Approved;
        } else if (v == keccak256(bytes("deny"))) {
            n.state = State.Denied;
        } else if (v == keccak256(bytes("need_more_evidence"))) {
            n.state = State.EvidenceRequested;
        } else {
            // Unrecognized verdict — treat as needing more evidence (retriable).
            n.state = State.EvidenceRequested;
        }

        emit Ruled(reqId, requestId, verdict, receiptId);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Full on-chain record for a contract. Exposes only hashes/refs/amounts/
    ///         state/ids/timestamps — there is no raw-content field to leak (T1).
    function getNegotiation(uint256 reqId) external view returns (Negotiation memory) {
        return _get(reqId);
    }

    /// @notice Current state of a contract.
    function stateOf(uint256 reqId) external view returns (State) {
        return _get(reqId).state;
    }

    /// @notice The on-chain note-content hash for off-chain verification (R3).
    function noteHashOf(uint256 reqId) external view returns (bytes32) {
        return _get(reqId).noteHash;
    }

    /// @notice Number of contracts created so far.
    function count() external view returns (uint256) {
        return _nextId - 1;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    /// @dev Fire a native agent request, forwarding the per-request fee (R9), record
    ///      the pending requestId, set the ruling deadline, and move to UnderReview.
    function _fireAgent(uint256 reqId, Negotiation storage n) internal {
        // Payload carries only refs/hashes/amounts — never raw content (R4). The
        // agent rules against the published formulary; this is the dispute context.
        bytes memory payload = abi.encode(
            reqId,
            n.drugRef,
            n.noteHash,
            n.priceFloor,
            n.priceCeil,
            n.initiatorPosition.proposedAmount,
            n.destinationPosition.proposedAmount,
            n.evidenceUri
        );

        uint256 fee = platform.getRequestDeposit() + agentReward;

        // Effects before interaction (CEI): mark UnderReview + set the deadline first,
        // so any reentrant lifecycle call sees a non-firing state and reverts. The
        // public entry points are also `nonReentrant` for defense in depth.
        n.rulingDeadline = block.timestamp + rulingTimeout;
        n.state = State.UnderReview;

        // Interaction: fire the native Somnia agent, forwarding the per-request fee (R9).
        uint256 requestId = platform.createRequest{value: fee}(
            agentId,
            address(this),
            this.handleResponse.selector,
            payload
        );

        // Post-interaction bookkeeping that needs the returned id.
        n.pendingRequestId = requestId;
        _requestToNegotiation[requestId] = reqId;

        emit RulingRequested(reqId, requestId, fee);
    }

    /// @dev Clear the in-flight request bookkeeping for a negotiation.
    function _clearRequest(Negotiation storage n) internal {
        if (n.pendingRequestId != 0) {
            delete _requestToNegotiation[n.pendingRequestId];
            n.pendingRequestId = 0;
        }
        n.rulingDeadline = 0;
    }

    /// @dev Load an existing negotiation or revert.
    function _get(uint256 reqId) internal view returns (Negotiation storage n) {
        n = _negotiations[reqId];
        require(n.exists, "unknown contract");
    }

    /// @dev True for any non-terminal (pre-Settled, non-Withdrawn) state.
    function _isActive(State s) internal pure returns (bool) {
        return s != State.Settled && s != State.Withdrawn;
    }

    /// @dev Accept ETH so the contract can be funded to pay agent fees.
    receive() external payable {}
}
