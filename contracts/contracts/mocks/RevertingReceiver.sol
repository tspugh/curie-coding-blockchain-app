// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @title RevertingReceiver
/// @notice Test double whose `receive()` always reverts. Used in hardhat tests
///         to exercise the `require(ok, "...")` branches that follow native
///         `.call{value: x}("")` patterns — `withdrawFunds` (require
///         `"funds: transfer failed"`) and the self-hosted
///         `_fireAgentSelfHosted` fee-transfer path (require
///         `"fee: orchestrator transfer failed"`). When this contract is set as
///         the recipient/platform, the inner `.call` returns `false` and the
///         require fires the "transfer failed" / "orchestrator transfer failed"
///         branch in CoverageNegotiation.sol.
contract RevertingReceiver {
    receive() external payable {
        revert("RevertingReceiver: nope");
    }
}
