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

```bash
npm install
cp .env.example .env   # set SOMNIA_NETWORK; add PRIVATE_KEY for write access
npm run dev            # runs src/index.ts under tsx, connects to Somnia
```

`npm run dev` connects to the configured network and prints a connection
summary — the smoke test that chain plumbing works before protocol logic is
layered on.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run `src/index.ts` with hot reload (`tsx watch`). |
| `npm run build` | Type-check and emit JS to `dist/`. |
| `npm start` | Run the built output from `dist/`. |
| `npm run typecheck` | Type-check without emitting. |

## Project layout

```
.
├── CLAUDE.md              # working philosophy, layout, constraints, cross-repo policy — read first
├── LICENSE                # proprietary; all rights reserved
├── .mcp.json              # Context7 MCP server (live Somnia docs)
├── .env.example
├── src/
│   ├── index.ts           # entry point: connect to Somnia, print summary
│   ├── config/
│   │   ├── networks.ts    # Somnia network params (typed source of truth)
│   │   └── env.ts         # environment loading + validation
│   └── somnia/
│       └── kit.ts         # SomniaAgentKit factory — the chain connection core
├── docs/
│   ├── specs/             # fleshed-out build specs (requirements, tests, acceptance)
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
