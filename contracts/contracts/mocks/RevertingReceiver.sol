// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @title RevertingReceiver
/// @notice Test double whose `receive()` always reverts, used to exercise the failed-
///         transfer `require` branch in `withdrawFunds` (the `.call{value}` returns false).
contract RevertingReceiver {
    receive() external payable {
        revert("RevertingReceiver: nope");
    }
}
