// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @title Somnia native agent-platform interfaces (local vendored mirror)
/// @notice Vendored re-statement of the canonical Solidity interfaces published
///         at https://docs.somnia.network/agents/invoking-agents/from-solidity.
///         **SPEC-0001 R19** governs this file: Solidity has no on-chain
///         interface registry, so this source MUST exist and MUST byte-match
///         the upstream so `solc` emits selectors the deployed `AgentPlatform`
///         actually responds to. Only the subset Coverage Negotiation uses
///         is declared.
///
///         Upstream URL: https://docs.somnia.network/agents/invoking-agents/from-solidity
///         Context7 source-of-truth: /websites/somnia_network
///         Last verified against upstream: 2026-05-29.
///
///         Any change to this file MUST update the verified date above and
///         cite the upstream diff in the commit body (SPEC-0001 R19). A
///         drift-detection script is planned (SPEC-0001 R19, future tick).

/// @dev Consensus mode for an advanced request (unused by createRequest defaults).
enum ConsensusType {
    Majority,
    Threshold
}

/// @dev Lifecycle status of an agent request / response. Values are positional
///      and MUST match the platform: None=0, Pending=1, Success=2, Failed=3, TimedOut=4.
enum ResponseStatus {
    None,
    Pending,
    Success,
    Failed,
    TimedOut
}

/// @dev One validator's response to a request. `result` is the consensus-encoded
///      output; `receipt` is a pointer to the off-chain execution receipt.
struct Response {
    address validator;
    bytes result;
    ResponseStatus status;
    uint256 receipt;
    uint256 timestamp;
    uint256 executionCost;
}

/// @dev Full on-chain record of a request, passed back to the callback.
struct Request {
    uint256 id;
    address requester;
    address callbackAddress;
    bytes4 callbackSelector;
    address[] subcommittee;
    Response[] responses;
    uint256 responseCount;
    uint256 failureCount;
    uint256 threshold;
    uint256 createdAt;
    uint256 deadline;
    ResponseStatus status;
    ConsensusType consensusType;
    uint256 remainingBudget;
    uint256 perAgentBudget;
}

/// @notice Interface a contract calls to fire a native Somnia agent request.
interface IAgentRequester {
    /// @notice Create a standard agent request; msg.value funds the request budget.
    /// @param agentId The registered agent to run.
    /// @param callbackAddress Address the platform calls back on completion.
    /// @param callbackSelector 4-byte selector of the callback function.
    /// @param payload ABI-encoded input for the agent.
    /// @return requestId Identifier of the created request.
    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);

    /// @notice Required msg.value for a standard request (validators paid on execution).
    function getRequestDeposit() external view returns (uint256);
}

/// @notice Interface a contract implements to receive agent responses.
interface IAgentRequesterHandler {
    /// @notice Platform callback delivering the consensus result + receipt.
    function handleResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory details
    ) external;
}
