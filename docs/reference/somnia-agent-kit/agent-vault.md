# AgentVault Technical Reference

> **Source:** https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/agent-vault
> **Fetched:** 2026-05-14 via WebFetch (AI-summarised — see [`PROVENANCE.md`](PROVENANCE.md))

## Contract Responsibilities

AgentVault manages funds for AI agents through secure storage, daily spending controls, and multi-token support. The contract uses **agent addresses (not IDs)** as vault identifiers.

## Data Structures

```solidity
struct Vault {
    uint256 nativeBalance;
    mapping(address => uint256) tokenBalances;
    address[] allowedTokens;
    uint256 dailyLimit;
    uint256 dailySpent;
    uint256 lastResetTime;
    bool isActive;
}
```

The contract maintains `mapping(address => Vault) private vaults` and `mapping(address => bool) public registeredAgents`.

## Core Functions

**Vault Creation:**

```solidity
function createVault(address agent, uint256 dailyLimit)
    external onlyOwner
```

Requires daily limits between 0.01 and 100 ether. Restricted to contract owner.

**Native Token Operations:**

```solidity
function depositNative(address agent)
    external payable nonReentrant

function withdrawNative(
    address agent,
    address payable recipient,
    uint256 amount
) external nonReentrant
```

Deposits accept any amount; withdrawals require agent or owner authorisation and must not exceed remaining daily allocation.

**ERC20 Token Operations:**

```solidity
function depositToken(
    address agent,
    address token,
    uint256 amount
) external nonReentrant

function withdrawToken(
    address agent,
    address token,
    address recipient,
    uint256 amount
) external nonReentrant
```

Deposits require prior token allowance; withdrawals check daily limits and vault status.

**Token Management:**

```solidity
function allowToken(address agent, address token) external onlyOwner
function disallowToken(address agent, address token) external onlyOwner
```

Owner controls which ERC20 tokens can be deposited.

**Limit & Status Control:**

```solidity
function updateDailyLimit(address agent, uint256 newLimit)
    external onlyOwner

function activateVault(address agent) external onlyOwner
function deactivateVault(address agent) external onlyOwner
```

## Deposit / Withdrawal Flow

**Native deposits:** Direct value transfer with event emission. Increases `nativeBalance` immediately.

**Native withdrawals:** Verify caller (agent or owner), check vault active status, validate sufficient balance, enforce daily limit, transfer funds, emit event.

**ERC20 deposits:** Require token in whitelist, `transferFrom` user to contract, increment `tokenBalances[token]`, emit event.

**ERC20 withdrawals:** Similar validation as native (caller, status, balance), daily-limit enforcement applies, transfer tokens, emit event.

## Daily Limit Enforcement

The model tracks spending via `dailySpent` and `lastResetTime`. Withdrawals (both token types) check:

```
remaining = dailyLimit - dailySpent
```

If the requested amount exceeds remaining allocation, transaction reverts. Limits reset automatically every 24 hours from the last reset timestamp.

## Events

Emitted: `VaultCreated`, `NativeDeposit`, `NativeWithdraw`, `TokenDeposit`, `TokenWithdraw`, `DailyLimitUpdated`, `TokenAllowed`, `TokenDisallowed`, `VaultActivated`, `VaultDeactivated`.

## Access Controls

- **Contract Owner:** Creates vaults, updates daily limits, manages token whitelists, controls vault activation.
- **Agent Address:** Can withdraw from their own vault.
- **Public:** Can deposit to any active vault.
- **Reentrancy Guard:** All state-changing functions protected via `nonReentrant` modifier.

All functions use `nonReentrant` to prevent reentrancy attacks. Vault operations require the vault to be active unless otherwise specified.

## Related contracts

[AgentRegistry](agent-registry.md), [AgentManager](agent-manager.md), [AgentExecutor](agent-executor.md).
