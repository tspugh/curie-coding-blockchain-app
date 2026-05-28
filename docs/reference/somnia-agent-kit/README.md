# Somnia Agent Kit — local reference

Local copy of selected pages from the [Somnia Agent Kit documentation](https://somnia-agent-kit.gitbook.io/somnia-agent-kit/) (fetched 2026-05-14). The kit is the **core SDK** for this project; see [`AGENTS.md`](../../../AGENTS.md) for project direction.

## Why this is here

This project is TypeScript on `somnia-agent-kit` + the Somnia L1 blockchain. These pages are the **primary reference** for designing the on-chain agreement layer, agent identity, claim/case lifecycle, payment escrow, and chain-side execution authorisation. The contracts map directly onto the insurance↔hospital workflow this project disrupts:

| Contract | Role in this project |
|---|---|
| `AgentRegistry` | Registers hospital agents, insurer agents, coding agents — the identity surface |
| `AgentManager` | Claim/coding cases as tasks with status (Pending → InProgress → Completed/Cancelled) |
| `AgentVault` | Payment escrow with daily limits; supports native STT + ERC20 tokens |
| `AgentExecutor` | Authorisation, gas budgeting, and chain-side execution |

## Index

- [`contracts-overview.md`](contracts-overview.md) — the four contracts, deployed addresses, end-to-end workflow
- [`agent-registry.md`](agent-registry.md) — `Agent` struct, register / update / status / transfer flow
- [`agent-manager.md`](agent-manager.md) — `Task` struct, lifecycle, payment flow
- [`agent-vault.md`](agent-vault.md) — `Vault` struct, daily-limit model, native + ERC20 operations
- [`agent-executor.md`](agent-executor.md) — authorisation, gas controls, execution events
- [`sdk-usage.md`](sdk-usage.md) — `SomniaAgentKit` initialisation, manager surface, typical TypeScript usage
- [`PROVENANCE.md`](PROVENANCE.md) — capture method and caveats

## Suggested read order

1. `contracts-overview.md` — system shape.
2. `agent-manager.md` + `agent-vault.md` — most relevant for claim / payment design.
3. `sdk-usage.md` — TypeScript entry points.
4. `agent-registry.md` + `agent-executor.md` — identity and authorisation deep dives.

## Authoritative source

When the local copy and the upstream gitbook diverge, **upstream wins**. These files are AI-summarized fetches; for production code, cross-check the source URLs listed in [`PROVENANCE.md`](PROVENANCE.md).

Mainnet addresses are listed as "Coming soon" upstream — testnet only (chain ID 50311) as of fetch date.
