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

/// @dev Minimal view used to probe the requesting contract's state mid-`createRequest`.
interface IStateProbe {
    function stateOf(uint256 reqId) external view returns (uint8);
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

        // Probe the requester's state mid-call (reqId is the first word of payload).
        // A view call — no state change — so it is safe for every test.
        uint256 reqIdFromPayload;
        assembly {
            reqIdFromPayload := calldataload(payload.offset)
        }
        observedStateDuringCreate = IStateProbe(callbackAddress).stateOf(reqIdFromPayload);
    }

    /// @notice Drive a successful ruling back into the target as the platform would.
    /// @param target The CoverageNegotiation contract (implements handleResponse).
    /// @param requestId The request to resolve.
    /// @param verdict One of "approve" | "deny" | "need_more_evidence".
    /// @param receiptId Off-chain receipt pointer to surface.
    function triggerRuling(
        address target,
        uint256 requestId,
        string calldata verdict,
        uint256 receiptId
    ) external {
        Response[] memory responses = new Response[](1);
        responses[0] = Response({
            validator: address(this),
            result: abi.encode(verdict),
            status: ResponseStatus.Success,
            receipt: receiptId,
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
