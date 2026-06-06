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
///         Under SPEC-0006 R24–R26 the contract decodes a single ABI-encoded
///         `string` decision token from `responses[0].result`; `triggerRuling`
///         encodes that token accordingly.
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

    /// @notice Drive a successful necessity ruling back into the target as the
    ///         platform would, encoding a single ABI-encoded string decision token
    ///         (SPEC-0006 R24–R26). The contract's `handleResponse` decodes
    ///         `responses[0].result` as `abi.decode(..., (string))` and maps the
    ///         token to a Decision.
    /// @param target The CoverageNegotiation contract (implements handleResponse).
    /// @param requestId The request to resolve.
    /// @param decisionToken One of "approve", "deny", "needs_more_info", "policy_invalid".
    function triggerRuling(address target, uint256 requestId, string calldata decisionToken) external {
        Response[] memory responses = new Response[](1);
        responses[0] = Response({
            validator: address(this),
            result: abi.encode(decisionToken),
            status: ResponseStatus.Success,
            receipt: 0,
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
