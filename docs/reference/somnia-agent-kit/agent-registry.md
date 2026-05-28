# AgentRegistry Technical Reference

> **Source:** https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/agent-registry
> **Fetched:** 2026-05-14 via WebFetch (AI-summarised — see [`PROVENANCE.md`](PROVENANCE.md))

## Contract Responsibilities

AgentRegistry manages AI agent lifecycle on the Somnia blockchain: registration, discovery, ownership control, metadata storage via IPFS, and status management.

## Core Data Structure

**Agent Struct:**

```solidity
struct Agent {
    string name;
    string description;
    string ipfsMetadata;
    address owner;
    bool isActive;
    uint256 registeredAt;
    uint256 lastUpdated;
    string[] capabilities;
    uint256 executionCount;
}
```

## Primary Functions

**Registration:**

```solidity
function registerAgent(
    string memory _name,
    string memory _description,
    string memory _ipfsMetadata,
    string[] memory _capabilities
) external returns (uint256)
```

Returns unique agent ID. Accessible by anyone. Emits `AgentRegistered`.

**Retrieval:**

```solidity
function getAgent(uint256 _agentId)
    external view returns (Agent memory)
```

Public read function returning complete agent details.

**Updates (owner-only):**

```solidity
function updateAgent(
    uint256 _agentId,
    string memory _name,
    string memory _description,
    string memory _ipfsMetadata,
    string[] memory _capabilities
) external
```

Restricted to agent owner. Emits `AgentUpdated`.

**Status Control (owner-only):**

```solidity
function setAgentStatus(
    uint256 _agentId,
    bool _isActive
) external
```

Toggles activation/deactivation. Emits `AgentStatusChanged`.

**Ownership Transfer (owner-only):**

```solidity
function transferAgentOwnership(
    uint256 _agentId,
    address _newOwner
) external
```

New owner cannot be zero address. Emits `AgentOwnershipTransferred`.

## Query Functions

- `getTotalAgents() external view returns (uint256)` — Total registered count
- `getAgentsByOwner(address _owner) external view returns (uint256[] memory)` — Owner's agents

**Note:** No `getAllAgents()` method exists; iteration required via agent ID loop.

## Events Emitted

```solidity
event AgentRegistered(
    uint256 indexed agentId,
    address indexed owner,
    string name
);

event AgentUpdated(uint256 indexed agentId);

event AgentStatusChanged(
    uint256 indexed agentId,
    bool isActive
);

event AgentOwnershipTransferred(
    uint256 indexed agentId,
    address indexed previousOwner,
    address indexed newOwner
);
```

## Access Control

- **Public Functions:** `registerAgent()`, all query/view functions
- **Owner-Only Functions:** `updateAgent()`, `setAgentStatus()`, `transferAgentOwnership()`

## Error Conditions

Owner verification required for restricted operations. New owner address validation prevents zero-address assignment. Non-existent agent queries fail silently in iteration contexts.

## Related Contracts

AgentRegistry integrates with [AgentManager](agent-manager.md) (task management), [AgentVault](agent-vault.md) (fund management), and [AgentExecutor](agent-executor.md) (task execution).
