# AgentManager Technical Reference

> **Source:** https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/agent-manager
> **Fetched:** 2026-05-14 via WebFetch (AI-summarised — see [`PROVENANCE.md`](PROVENANCE.md))

## Contract Overview

AgentManager handles the complete task lifecycle for AI agents on the Somnia blockchain, managing creation, assignment, execution, and completion.

**Testnet address:** `0x77F6dC5924652e32DBa0B4329De0a44a2C95691E`

## Task Data Structure

The core `Task` struct contains:

- `uint256 agentId` — assigned agent identifier
- `address requester` — task creator address
- `string taskData` — JSON-encoded task specification
- `uint256 payment` — reward amount in STT tokens
- `TaskStatus status` — current state
- `uint256 createdAt` and `completedAt` — timestamps
- `string result` — completion output

## Task Lifecycle & Status Enum

Tasks progress through four states:

- **Pending (0)** — newly created, awaiting agent acceptance
- **InProgress (1)** — agent actively working
- **Completed (2)** — successfully finished
- **Cancelled (3)** — terminated with refund

## Core Functions

**createTask:**

```solidity
function createTask(
    uint256 _agentId,
    string memory _taskData
) external payable returns (uint256)
```

Initiates task creation; payment transmitted via transaction value. Returns task ID. Emits `TaskCreated` event containing taskId, agentId, requester address, and payment amount.

**getTask:**

```solidity
function getTask(uint256 _taskId)
    external view
    returns (
        uint256 agentId,
        address requester,
        string memory taskData,
        uint256 payment,
        TaskStatus status,
        uint256 createdAt,
        uint256 completedAt,
        string memory result
    )
```

Retrieves all task metadata; read-only view function.

**startTask:**

```solidity
function startTask(uint256 _taskId) external
```

Transitions task from Pending to InProgress. Only callable by agent owner. Emits `TaskStarted` event with taskId and timestamp.

**completeTask:**

```solidity
function completeTask(
    uint256 _taskId,
    string memory _result
) external
```

Marks task Completed with result data. Accepts tasks in InProgress or Pending status. Emits `TaskCompleted` event containing taskId, result string, and timestamp.

**failTask:**

```solidity
function failTask(uint256 _taskId) external
```

Terminates InProgress task and refunds requester. Emits `TaskFailed` event with taskId and timestamp.

**cancelTask:**

```solidity
function cancelTask(uint256 _taskId) external
```

Removes Pending tasks with requester refund. Only the task creator can invoke. Emits `TaskCancelled` event with taskId and timestamp.

## Events

The contract emits five primary events: `TaskCreated` (indexes taskId, agentId, requester), `TaskStarted`, `TaskCompleted`, `TaskFailed`, and `TaskCancelled` — all including relevant metadata for monitoring.

## Payment Flow & Access Control

Payment transfers through `msg.value` in `createTask()` as a payable transaction. Refunds occur automatically when tasks fail or are cancelled. Access restrictions:

- Only **agent owners** can call `startTask()`.
- Only **requesters** can cancel via `cancelTask()`.
- Task state validation prevents invalid transitions (e.g., completing non-InProgress tasks fails).

## Key Relationships

AgentManager integrates with [AgentRegistry](agent-registry.md) (agent lookups), [AgentVault](agent-vault.md) (fund management), and [AgentExecutor](agent-executor.md) (execution handling). Task creation requires a valid `agentId`; payment must accompany creation transactions to ensure appropriate incentive mechanisms.
