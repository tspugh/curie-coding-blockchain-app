// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {
    IAgentRequester,
    IAgentRequesterHandler,
    Response,
    Request,
    ResponseStatus,
    ConsensusType
} from "../ISomniaAgent.sol";

/// @dev Probe interface for verifying the requesting contract's state mid-`createRequest`.
///      `currentlyFiringReqId` exposes which negotiation is in-flight; `stateOf` reads
///      that negotiation's state. Together they confirm the CEI invariant (UnderReview
///      is set before the external platform call) without needing to decode the payload.
interface IFiringProbe {
    function stateOf(uint256 reqId) external view returns (uint8);
    function currentlyFiringReqId() external view returns (uint256);
}

/// @title MockAgentPlatform
/// @notice Test double for the Somnia agent platform. Records the last
///         createRequest args and can call back into a target contract as if it
///         were the real platform, driving the full dispute -> ruling flow locally.
contract MockAgentPlatform is IAgentRequester {
    uint256 public deposit = 0.001 ether;
    uint256 public nextRequestId = 1;

    // Last createRequest call, captured for assertions.
    uint256 public lastAgentId;
    address public lastCallbackAddress;
    bytes4 public lastCallbackSelector;
    bytes public lastPayload;
    uint256 public lastValue;
    uint256 public lastRequestId;
    uint256 public createRequestCalls;

    /// @notice The requesting contract's state observed DURING createRequest. Lets a
    ///         test prove checks-effects-interactions: the negotiation is already in
    ///         UnderReview (2) before the external agent call returns.
    uint8 public observedStateDuringCreate;

    /// @inheritdoc IAgentRequester
    function getRequestDeposit() external view returns (uint256) {
        return deposit;
    }

    /// @notice Owner-free setter so tests can vary the deposit.
    function setDeposit(uint256 deposit_) external {
        deposit = deposit_;
    }

    /// @inheritdoc IAgentRequester
    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId) {
        require(msg.value >= deposit, "mock: underfunded");
        requestId = nextRequestId++;

        lastAgentId = agentId;
        lastCallbackAddress = callbackAddress;
        lastCallbackSelector = callbackSelector;
        lastPayload = payload;
        lastValue = msg.value;
        lastRequestId = requestId;
        createRequestCalls += 1;

        // Probe the requester's state mid-call using the transparency slot.
        // `currentlyFiringReqId()` returns exactly which negotiation is being fired,
        // eliminating any payload-decoding assumptions. A view call — no state change.
        uint256 reqId = IFiringProbe(callbackAddress).currentlyFiringReqId();
        observedStateDuringCreate = IFiringProbe(callbackAddress).stateOf(reqId);
    }

    /// @dev The arbiter ruling fields the contract decodes from `responses[0].result`.
    ///      Passed as one calldata struct to keep `triggerRuling` off the stack limit.
    struct Ruling {
        uint8 decision; // 0=approve,1=deny,2=need_more_evidence,3=policy_invalid
        uint256 costPlusUnitPrice; // Mark Cuban Cost Plus per-unit; contract caps at × quantity
        uint256 nadacUnitPrice; // NADAC per-unit acquisition-cost floor reference
        bytes32 rationaleHash;
        bytes32 clauseRef; // policy clause the agent relied on
        bytes32 standardRef; // public standard cited for a policy flag (R6b)
        uint256 receiptId; // off-chain receipt pointer to surface
        uint16[] policyVoidedClauseIndices; // SPEC-0004 §3.5 R23: clause indices voided on policy-void path
        uint16[] usedReferenceIndices; // SPEC-0004 §3.5 R11: packet entry indices the ruling relied on
        bytes32[] usedLeafHashes; // SPEC-0004 §3.5 R11: leaf hashes for cited references (replay-verification anchor)
    }

    /// @notice Drive a successful necessity ruling back into the target as the
    ///         platform would, encoding the arbiter tuple the contract decodes:
    ///         `(decision, costPlusUnitPrice, nadacUnitPrice, rationaleHash, clauseRef,
    ///         standardRef, receiptId, policyVoidedClauseIndices, usedReferenceIndices,
    ///         usedLeafHashes)`.
    /// @param target The CoverageNegotiation contract (implements handleResponse).
    /// @param requestId The request to resolve.
    /// @param r The ruling fields (see {@link Ruling}).
    function triggerRuling(address target, uint256 requestId, Ruling calldata r) external {
        Response[] memory responses = new Response[](1);
        responses[0] = Response({
            validator: address(this),
            result: abi.encode(
                r.decision, r.costPlusUnitPrice, r.nadacUnitPrice, r.rationaleHash, r.clauseRef, r.standardRef, r.receiptId, r.policyVoidedClauseIndices, r.usedReferenceIndices, r.usedLeafHashes
            ),
            status: ResponseStatus.Success,
            receipt: r.receiptId,
            timestamp: block.timestamp,
            executionCost: deposit
        });

        IAgentRequesterHandler(target).handleResponse(
            requestId,
            responses,
            ResponseStatus.Success,
            _emptyRequest(requestId, target)
        );
    }

    /// @notice Drive a failed/timed-out outcome back into the target.
    function triggerFailure(
        address target,
        uint256 requestId,
        ResponseStatus status
    ) external {
        Response[] memory empty = new Response[](0);
        IAgentRequesterHandler(target).handleResponse(
            requestId,
            empty,
            status,
            _emptyRequest(requestId, target)
        );
    }

    function _emptyRequest(uint256 requestId, address target) internal view returns (Request memory r) {
        r.id = requestId;
        r.requester = target;
        r.callbackAddress = target;
        r.status = ResponseStatus.Success;
        r.consensusType = ConsensusType.Majority;
        r.createdAt = block.timestamp;
    }
}
