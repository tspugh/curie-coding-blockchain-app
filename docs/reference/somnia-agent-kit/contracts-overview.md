# Smart Contracts: Overview

> **Source:** https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/contracts-overview
> **Fetched:** 2026-05-14 via WebFetch (AI-summarised — see [`PROVENANCE.md`](PROVENANCE.md))

## Core Contracts (4 total)

The kit ships with four interconnected smart contracts:

1. **AgentRegistry.sol** (`0xC9f3452090EEB519467DEa4a390976D38C008347`)
   - Purpose: "Manages agent registration, discovery, and metadata"
   - Key operations: register, update, activate/deactivate agents; transfer ownership

2. **AgentManager.sol** (`0x77F6dC5924652e32DBa0B4329De0a44a2C95691E`)
   - Purpose: "Handles task creation, assignment, and lifecycle management"
   - Task statuses: Pending (0), InProgress (1), Completed (2), Cancelled (3)

3. **AgentVault.sol** (`0x7cEe3142A9c6d15529C322035041af697B2B5129`)
   - Purpose: "Manages agent funds with daily limits and multi-token support"
   - Supports native and ERC20 token deposits/withdrawals with daily limit enforcement
   - Note: "Vault uses agent addresses (not IDs) for all operations"

4. **AgentExecutor.sol** (`0x157C56dEdbAB6caD541109daabA4663Fc016026e`)
   - Purpose: "Handles task execution with authorization and gas management"
   - Core functions: authorize agents, execute tasks, retrieve execution details

## Contract Relationships

The workflow flows through these dependencies:

- User registers agent via **AgentRegistry** → obtains agent info
- User creates tasks via **AgentManager** (requires agent info)
- User deposits funds via **AgentVault** (uses agent address, not ID)
- **AgentManager** triggers **AgentExecutor** to run tasks using funds from **AgentVault**

## Typical Agent Workflow

1. Initialize SDK with contract addresses and network configuration
2. Register new agent via `registerAgent()` in AgentRegistry
3. Create vault for agent (requires agent address from registry, not agent ID)
4. Deposit funds via vault's `depositNative()` or `depositToken()` methods
5. Create tasks via `createTask()` in AgentManager with task data and payment
6. Trigger task execution, which calls AgentExecutor for authorisation and execution

## Deployment & Network Details

**Somnia Testnet:**

- Chain ID: 50311
- RPC: `https://dream-rpc.somnia.network`
- Explorer: `https://somnia-devnet.socialscan.io`
- Currency: STT (Somnia Test Token)

Mainnet listed as "Coming soon"

Deployment uses Hardhat with commands: `npx hardhat run scripts/deploy.ts --network testnet`

## Related documentation

- [`agent-registry.md`](agent-registry.md)
- [`agent-manager.md`](agent-manager.md)
- [`agent-vault.md`](agent-vault.md)
- [`agent-executor.md`](agent-executor.md)
- [`sdk-usage.md`](sdk-usage.md)

The upstream page also notes a dynamic query mechanism: append `?ask=<question>` to fetch targeted documentation answers.
