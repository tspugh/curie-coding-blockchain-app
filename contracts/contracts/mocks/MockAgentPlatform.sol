// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {
    IAgentRequester,
    IAgentRequesterHandler,
    ResponseStatus
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

    /// @notice Drive a successful approval ruling back into the target.
    ///         Encodes output as the real platform does: output[0]=status byte,
    ///         output[1:]=abi.encode(uint256) where 1=approve, 0=deny.
    /// @param approve True for an Approve ruling, false for Deny.
    function triggerRuling(address target, uint256 requestId, bool approve) external {
        uint256 approvedVal = approve ? 1 : 0;
        bytes memory output = bytes.concat(
            bytes1(uint8(ResponseStatus.Success)),
            abi.encode(approvedVal)
        );
        IAgentRequesterHandler(target).handleResponse(requestId, output);
    }

    /// @notice Drive a failed/timed-out outcome back into the target.
    function triggerFailure(address target, uint256 requestId, ResponseStatus status) external {
        bytes memory output = bytes.concat(bytes1(uint8(status)));
        IAgentRequesterHandler(target).handleResponse(requestId, output);
    }
}
