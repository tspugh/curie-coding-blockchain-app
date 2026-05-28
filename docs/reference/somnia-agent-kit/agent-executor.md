# AgentExecutor Technical Reference

> **Source:** https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/agent-executor
> **Fetched:** 2026-05-14 via WebFetch (AI-summarised — see [`PROVENANCE.md`](PROVENANCE.md))

## Contract Responsibilities

The AgentExecutor manages agent task execution through a secure framework featuring "role-based access control, gas limits, and execution fees." It enables on-chain agent code execution with authorisation verification and resource management.

**Testnet address:** `0x157C56dEdbAB6caD541109daabA4663Fc016026e`

## Core Data Structures

`ExecutionContext` tracks task metadata:

- Agent address and unique `taskId`
- Requester identity and timestamp
- Gas limit and transaction value
- Status enum (`Pending`, `Success`, `Failed`, `Reverted`)
- `result` bytes for output data

## Function Signatures

**Authorisation:**

```solidity
function authorizeAgent(address agent)
    external onlyRole(ADMIN_ROLE)

function revokeAgent(address agentAddress) external

function isAgentAuthorized(address agentAddress)
    external view returns (bool)
```

**Task Execution:**

```solidity
function executeTask(
    address agent,
    bytes memory data,
    uint256 gasLimit
) external payable returns (bytes32 taskId)
```

Requires minimum execution fee in `msg.value` and restricts execution to "authorized agent contract" addresses.

**Query Functions:**

```solidity
function getExecution(bytes32 taskId)
    external view returns (ExecutionContext memory)

function getAgentExecutionCount(address agentAddress)
    external view returns (uint256)
```

**Admin Configuration:**

```solidity
function setExecutionFee(uint256 newFee) external
function setMaxGasLimit(uint256 limit) external
function withdrawFees(address recipient) external
```

## Task Execution Flow

1. Admin authorises agent contract via `authorizeAgent()`.
2. User calls `executeTask()` with agent address, encoded task data, and gas limit.
3. Transaction includes execution fee as payment.
4. `ExecutionQueued` event emitted with `taskId`.
5. Task executes within specified gas budget.
6. `ExecutionCompleted` event fires upon completion with status and result.
7. Results retrievable via `getExecution(taskId)`.

## Authorisation Model

The contract enforces "only authorized agents can execute" tasks through role-based mechanisms. Only addresses with `ADMIN_ROLE` can authorise/revoke agents. Task execution validates agent authorisation before proceeding.

## Gas Management

Two gas controls:

- Per-task `gasLimit` parameter prevents individual task overruns.
- Global "Max Gas Limit" enforced via `setMaxGasLimit()` prevents systemic issues.

Execution fees provide additional spam protection through economic incentives.

## Events Emitted

```solidity
event ExecutionQueued(
    bytes32 indexed taskId,
    address agent,
    address requester
);

event ExecutionCompleted(
    bytes32 indexed taskId,
    uint256 status,
    bytes result
);

event AgentAuthorized(
    address indexed agent,
    address authorizer
);

event AgentRevoked(
    address indexed agent,
    address revoker
);
```

## Access Controls

Layered security:

- **`ADMIN_ROLE`:** authorisation, revocation, fee management, withdrawal.
- **Public:** task submission (with fee payment).
- **View functions:** query execution status and agent state.

## Security Features

- Role-Based Access Control
- Agent authorisation requirements
- Gas limits
- Execution fees for spam prevention
- Reentrancy protection for safe external calls

## Related contracts

[AgentRegistry](agent-registry.md), [AgentManager](agent-manager.md), [AgentVault](agent-vault.md).
