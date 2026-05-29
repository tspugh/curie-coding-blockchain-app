# AGENTS.md

Authoritative tech-stack and architectural constraints for any coding agent working in
this repo. Sister file to [`CLAUDE.md`](CLAUDE.md) (working philosophy, layout) and
[`docs/VISION.md`](docs/VISION.md) (product). If anything in `CLAUDE.md` contradicts
this file, **this file wins** for tech-stack and on-chain interface decisions.

## What this repo is

Curie Negotiation Protocol — agent-mediated drug coverage-exception arbitration on
Somnia. The contract holds the exchange's lifecycle state machine, a de-identified
note hash commitment, and settlement escrow. The on-chain AI mediator is invoked
through Somnia's native agent platform. See [`docs/VISION.md`](docs/VISION.md) and
[`docs/specs/0001-mvp0-coverage-negotiation.md`](docs/specs/0001-mvp0-coverage-negotiation.md).

## Stack — the official Somnia stack

Use these — they are the **official** Somnia developer surface and what this repo's
contract already targets:

- **TypeScript** — application code, agent clients, scripts, tests. No polyglot
  backend.
- **viem** — wallet, RPC, signed transactions, view calls, event subscriptions.
  Prefer viem primitives over hand-rolled `ethers` or ad-hoc HTTP.
- **`@somnia-chain/reactivity`** — reactive on-chain state subscriptions; the
  preferred way to track lifecycle state and event streams in clients.
- **`@somnia-chain/streams`** — streamed agent / event data when reactivity isn't
  enough on its own.
- **On-chain `IAgentRequester` / `IAgentRequesterHandler` interfaces** — the
  contract-side surface for invoking the native Somnia agent platform and receiving
  callbacks. **The deployed contract in this repo already implements these directly**
  (see [`contracts/contracts/ISomniaAgent.sol`](contracts/contracts/ISomniaAgent.sol)
  and [`contracts/contracts/CoverageNegotiation.sol`](contracts/contracts/CoverageNegotiation.sol)).

### `somnia-agent-kit` is NOT the SDK

The npm package `somnia-agent-kit` (third-party, authored by `xuanbach0212` /
`tylerdao`) shipped earlier in this repo as a placeholder while the official Somnia
SDK surface was being firmed up. **It is not the Somnia SDK.** It is being removed.

- The **on-chain** side already uses the official `IAgentRequester` /
  `IAgentRequesterHandler` interfaces — no change needed there.
- The **client/TypeScript** side should target **viem + `@somnia-chain/reactivity` +
  `@somnia-chain/streams`** for any new code, and existing `somnia-agent-kit` call
  sites should be migrated out (tracked separately — **don't** mix the two in one
  change).

If a coding agent finds itself adding `somnia-agent-kit` to a new file, stop and ask.

## On-chain only — no REST

- **No REST APIs.** Reach the chain via RPC, signed transactions, view calls, and
  event subscriptions (viem + reactivity + streams). Reads come from contract
  calls or event streams; writes from signed transactions. Off-chain glue
  *orchestrates*; it is not the system of record.
- **No bypass.** Do not introduce a side-channel HTTP/gRPC/WebSocket/queue API
  that lets one party submit a packet, ruling, or settlement off-chain and then
  "reconcile later." If you think you need one, that's a spec change — propose
  it (see [`docs/amendments/README.md`](docs/amendments/README.md)) before
  writing code.
- The native Somnia agent platform is invoked **through the contract** via
  `IAgentRequester`; the callback returns through `IAgentRequesterHandler`. That
  is the protocol's only path to the AI mediator.

## Privacy — a hard rule

**PHI never goes on-chain. PHI never goes through the native agent.** Only
opaque IDs, hashes, references to *public* sources, public price amounts, and
settlement details may cross either boundary. Anywhere a data flow is
described, be explicit about on-chain vs. off-chain.

Current development uses **synthetic, de-identified** notes only. Robust
de-identification (HIPAA Safe Harbor / Expert Determination) is a production
obligation.

## Sourced claims only

Any factual claim that lands in a spec, README, or amendment — denial rates,
Somnia throughput, formulary statistics, drug-coverage numbers, regulatory
deadlines — **must be sourced**. Link to the upstream document. Unsourced
quantitative claims block merges.

## Looking up library / SDK docs

Use the **Context7 MCP** (server configured in [`.mcp.json`](.mcp.json)) for
current docs on any library, SDK, framework, or API — **especially Somnia** —
instead of relying on training data. Query `/websites/somnia_network` for
Somnia directly.

## Hard rules — summary

- TypeScript only. No polyglot backend.
- Chain-native via **viem + `@somnia-chain/reactivity` + `@somnia-chain/streams`**.
- Contract uses **`IAgentRequester` / `IAgentRequesterHandler`** for the native
  Somnia agent platform — keep it that way.
- **`somnia-agent-kit` is not the SDK** and is being removed. Don't add new uses.
- **No REST.** No off-chain side-channels for protocol-level state.
- **No PHI on-chain, and none through the native agent.**
- Sourced claims only.
- Specs first: update [`docs/specs/`](docs/specs/) before (or alongside) the code.
