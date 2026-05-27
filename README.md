# Curie

**Agent-mediated drug coverage decisions, settled on [Somnia](https://somnia.network).**

Curie resolves drug coverage and exception requests between payers and providers.
A provider requests coverage — or a tier/formulary exception — for a drug; an AI
mediator adjudicates the request against the payer's published formulary, public
clinical evidence, and public price benchmarks over a transparent, auditable
exchange; and the outcome (approval, denial with reasons, or a request for more
evidence) is recorded on-chain, with approved coverage settling through escrow.

**No protected health information enters the protocol.** Requests are argued at
the level of the drug, the formulary, and public clinical evidence — never a
patient's record.

> This is the application repository. The research, specs, and strategy that
> inform it live in the surrounding spec repository one level up
> (`curie-coding-blockchain`). See [CLAUDE.md](./CLAUDE.md) for the boundary
> between the two and the rules for working across it.

## How it works

1. A provider submits a coverage/exception request for a drug (identified by
   RxNorm/NDC), citing public evidence — a clinical guideline, an FDA label,
   comparative-effectiveness data — by reference.
2. An **AI mediator** reads the payer's published formulary criteria and the
   cited public evidence and rules: **approve**, **deny** (with reasons), or
   **request more evidence**.
3. The exchange runs as a state machine — request, evidence submission, rebuttal,
   appeal — each round adjudicated by the mediator and recorded on-chain.
4. Approved coverage **settles through escrow**, bounded by public price
   benchmarks.

> **MVP0 scope (SPEC-0001):** the contract + state machine, the simulated↔real
> wallet path, the three-view web app, and a native-agent dispute ruling are
> built and tested. v0 settlement is an **event marker** (no token transfer);
> real escrow, PHI redaction, and identity verification are out of scope. See
> [`docs/specs/0001-mvp0-coverage-negotiation.md`](./docs/specs/0001-mvp0-coverage-negotiation.md).

## Why an agent, why a blockchain, why Somnia

- **Why an agent** — adjudicating a coverage exception means weighing a free-text
  clinical-evidence argument against free-text formulary criteria. That is
  judgment, not a lookup.
- **Why a blockchain** — a neutral, tamper-evident record of who argued what, how
  the mediator ruled and why, and how it settled — auditable by both parties,
  owned by neither.
- **Why Somnia** — the mediator's reasoning runs as consensus-verified, on-chain
  inference that reads public sources directly, and settlement is instant.

## Privacy boundary (hard rule)

No clinical records on-chain, ever. On-chain: a **non-identifying drug request
descriptor**, **public-evidence references**, the **mediator's rulings and
rationale**, the **exchange transcript**, and **settlement**. Cited evidence
stays at its public source and is read on demand; the chain holds references,
rulings, and receipts.

## Somnia networks

| | Testnet (Shannon) | Mainnet |
|---|---|---|
| Chain ID | `50312` | `5031` |
| Currency | `STT` | `SOMI` |
| RPC | `https://api.infra.testnet.somnia.network/` | `https://api.infra.mainnet.somnia.network/` |
| WebSocket | `wss://api.infra.testnet.somnia.network/ws` | `wss://api.infra.mainnet.somnia.network/ws` |
| Explorer | https://shannon-explorer.somnia.network/ | https://explorer.somnia.network/ |
| Faucet | https://testnet.somnia.network/ | https://stakely.io/faucet/somnia-somi |

These are mirrored in [`src/config/networks.ts`](./src/config/networks.ts), the
typed source of truth for the app.

## Quick start

The MVP0 (SPEC-0001) runs end-to-end with **no wallet and no chain** — the
default `simulated` mode mirrors the contract in memory and mocks the agent
ruling, so you can drive the whole flow locally:

```bash
npm install
npm run build          # compile the TS library to dist/ (the web app imports it)
npm run web:dev        # serve the web app (Overview / Create / Maintain) in simulated mode
```

Open the app, click **Load sample case**, file a request as the provider, switch
to the insurer profile to **attach a policy & engage**, **request adjudication**,
and watch the (mocked) necessity arbiter rule `approve | deny |
need_more_evidence` (or void the contract on a non-compliant policy clause) — then
accept and settle, or appeal with new evidence. The copy-pasteable case + the
Part D / openFDA / NADAC + Cost Plus / non-compliant-policy fixtures live in
[`demo-data/`](./demo-data/).

The legacy chain smoke test still exists: `cp .env.example .env` then
`npm run dev` connects to the configured network and prints a summary.

## Smart contract, deployment & wallet modes

The system of record is [`contracts/contracts/CoverageNegotiation.sol`](./contracts/contracts/CoverageNegotiation.sol)
(Hardhat, Solidity 0.8.24, OpenZeppelin `Ownable` + `ReentrancyGuard`). It
implements the full SPEC-0001 §3 state machine (provider files → insurer attaches
policy → adjudication → ruling → accept/appeal/refuse → settle) and fires a
**native Somnia agent** as a necessity arbiter on `requestAdjudication` via
`createRequest`; the platform calls `handleResponse` back into the same contract
with the decision + cited clause + receipt, and the contract computes the covered
amount deterministically as `min(requested, benchmarkCap)` (the
[`ISomniaAgent.sol`](./contracts/contracts/ISomniaAgent.sol) interface is
verified field-for-field against the Somnia docs).

```bash
npm --prefix contracts run compile      # build artifacts + typechain
npm --prefix contracts run test         # Hardhat suite (T1–T10 + security), 10 passing
npm --prefix contracts run deploy:somnia  # deploy to Somnia testnet (chain 50312)
```

**Wallet modes (R11), one code path:**

- **Simulated** (default) — `SOMNIA_WALLET_MODE=simulated`. No funds; the agent
  ruling is mocked. Used by the web app, the library, and CI.
- **Real** — `SOMNIA_WALLET_MODE=real` + a funded `PRIVATE_KEY`. The library's
  `RealBackend` talks to the deployed contract over ethers and a **real** native
  agent produces the ruling (the per-request fee is charged on execution — R9).

**Deploying + wiring the real path** (all via [`.env`](./.env.example)):

1. Set `PRIVATE_KEY`, `AGENT_PLATFORM_ADDRESS`, and `AGENT_ID`, then
   `npm --prefix contracts run deploy:somnia`.
2. Record the printed address in `COVERAGE_CONTRACT_ADDRESS` (and below) — this
   is what `RealBackend` reads.
3. Run with `SOMNIA_WALLET_MODE=real`.

**Deployed testnet address:** _not yet deployed — requires a funded testnet
wallet. Record the Shannon address here and in `.env` once deployed._

## Scripts

| Script | Purpose |
|---|---|
| `npm run build` | Type-check the library and emit JS to `dist/` (the web app imports it). |
| `npm run typecheck` | Type-check without emitting. |
| `npm run web:dev` / `web:build` / `web:preview` | Run / build / preview the web app. |
| `npm run test:e2e` | agent-browser end-to-end suite over the web app (see [`web/tests/agent-browser/`](./web/tests/agent-browser/)). |
| `npm run dev` / `start` | Legacy chain smoke test (`src/index.ts`). |
| `npm --prefix contracts run compile` / `test` / `deploy:somnia` | Hardhat compile / test / deploy. |

## Project layout

```
.
├── CLAUDE.md              # working philosophy, layout, constraints, cross-repo policy — read first
├── LICENSE                # proprietary; all rights reserved
├── .mcp.json              # Context7 MCP server (live Somnia docs)
├── .env.example
├── contracts/             # Hardhat workspace
│   ├── contracts/         # CoverageNegotiation.sol, ISomniaAgent.sol, mocks/
│   ├── test/              # CoverageNegotiation.test.ts (T1–T10 + security)
│   └── scripts/deploy.ts  # deploy to Somnia testnet (chain 50312)
├── src/                   # framework-agnostic TS library (the app surface)
│   ├── index.ts           # createClient(config): wallet + profiles + content + negotiation
│   ├── wallet/            # pluggable signer: simulated ↔ real (R11)
│   ├── profiles/          # app-level identities + switching (R12/R13)
│   ├── content/           # off-chain content store + keccak256 commitment (R3/R4)
│   ├── contract/          # CoverageNegotiationClient: SimulatedBackend + RealBackend + ABI
│   ├── config/            # networks.ts (typed source of truth) + env.ts
│   └── somnia/kit.ts      # SomniaAgentKit factory
├── web/                   # Vite + React SPA (Overview / Create / Maintain)
│   └── tests/agent-browser/  # end-to-end browser suite (npm run test:e2e)
├── demo-data/             # synthetic sample case + Part D formulary fixtures (no PHI)
├── docs/
│   ├── specs/             # fleshed-out build specs (requirements, tests, acceptance)
│   ├── progress/          # implementation progress log
│   ├── research/          # research notes (pre-decision)
│   └── documentation/     # hard Somnia API/code docs, copied down
├── package.json
└── tsconfig.json
```

## Architectural rules

- **TypeScript only.** No polyglot backend.
- **No REST.** Clients reach the chain via RPC, signed transactions, view calls,
  and event subscriptions through `somnia-agent-kit`.
- **Chain-native state.** Contracts are the system of record; off-chain code
  orchestrates, it does not replace.
- **No clinical data on-chain.** Non-identifying descriptors, public-evidence
  references, rulings, and settlement only.

## License

Proprietary. All rights reserved — see [LICENSE](./LICENSE). No copying,
distribution, or derivative works without written permission.
