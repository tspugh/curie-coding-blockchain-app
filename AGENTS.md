# AGENTS.md

Guidance for AI coding agents (Claude, Codex, Cursor, etc.) working in the
**Curie Claims Protocol application repository**. Read this first.

## What this repo is

The application code for Curie Claims Protocol — agentic medical-claims
negotiation and settlement on Somnia. This is where code is written and
committed regularly.

The **research, specs, and strategy** that inform this app live in the
surrounding **spec repository** one directory up (`curie-coding-blockchain`).
That repository is *external* to this one — see the cross-repo policy below.

## Tech stack

- **Language:** TypeScript only. No Rust, no Python services, no polyglot backend.
- **Core SDK:** [`somnia-agent-kit`](https://github.com/xuanbach0212/somnia-agent-kit) —
  provides `SomniaAgentKit`, on-chain contract bindings (`AgentRegistry`,
  `AgentManager`, `AgentExecutor`, `AgentVault`), LLM adapters, token managers,
  and the autonomous agent runtime. Prefer its abstractions over hand-rolling
  ethers/viem calls.
- **Network config:** [`src/config/networks.ts`](./src/config/networks.ts) is the
  typed source of truth for Somnia network parameters.

## Architectural constraints

- **No REST.** No Express/Fastify/Koa REST routes or HTTP-CRUD layers. State
  lives on-chain; interact via RPC, signed transactions, view calls, and event
  subscriptions. Propose any non-chain interface (gRPC, WebSocket, tRPC, queue)
  before building.
- **Chain-native first.** Reads come from contract calls or event streams;
  writes come from signed transactions. Off-chain glue orchestrates only.
- **No PHI on-chain.** Only hashes, lifecycle state, agent addresses,
  timestamps, settlement amounts, and signatures/attestations are anchored.

## Cross-repo policy (the external repository)

The spec repository one level up is **external** to this app. Our policy:

- **Do not copy proprietary information from the external repository into this
  repository** — not its research notes, specs, market analysis, domain docs,
  or any other content — without an explicit human in the loop.
- Documentation that the **user explicitly instructs** to be authored *in this
  repository* is fine.
- When you believe app code or docs need a fact, number, or design decision that
  currently lives only in the external repo, **stop and ask a human** to approve
  bringing it in, rather than copying it yourself.

## License

This repository is **proprietary** (see [LICENSE](./LICENSE)). All rights
reserved; no copying, distribution, or derivative works without written
permission.
