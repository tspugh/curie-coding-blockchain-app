# Curie

**Patient-facing medical bill split & instant settlement on [Somnia](https://somnia.network).**

A patient ↔ provider ↔ insurer network. A provider posts a bill; an insurer
agent computes the coverage split (patient responsibility vs. plan
responsibility) off-chain; the patient approves; and a smart contract escrows and
**atomically splits the payment to the provider in one instant transaction** —
**without putting any clinical data on-chain**. Built for the
[Somnia Agentathon](https://www.encodeclub.com/programmes/agentathon)
(Encode Club × Somnia) in TypeScript on top of
[`somnia-agent-kit`](https://github.com/xuanbach0212/somnia-agent-kit).

> This is the **application repository**. The research, specs, and strategy that
> inform it live in the surrounding **spec repository** one level up
> (`curie-coding-blockchain`). See [AGENTS.md](./AGENTS.md) for the boundary
> between the two and the rules for working across it.

## Why this needs both an agent and a blockchain

- **Why agents** — payer↔provider settlement is becoming machine-to-machine. An
  insurer agent computes the coverage split, a provider agent reconciles it, and
  a patient agent can auto-approve under a spend cap — coordination that
  autonomous agents handle well.
- **Why blockchain** — not for storing records, but for neutral shared state,
  instant programmable settlement, tamper-evident audit, and resilience against a
  single clearinghouse being the whole country's payment rail.
- **Why Somnia** — the demo is an instant three-way payment split with state
  updates fast enough to feel interactive. Somnia's high throughput and
  sub-second finality are used as a real ingredient, not just a deployment target.

## Privacy boundary (hard rule)

No clinical data ever goes on-chain. On-chain you see only **opaque bill IDs
(hashes), amounts, the computed split, pseudonymous participant addresses, and
approval/settlement events**. The bill's clinical context and the benefit-rule
reasoning behind a split stay **off-chain**. The chain moves money and records
state; it never sees what the care was for.

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
summary — the smoke test that chain plumbing works before settlement logic is
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
├── AGENTS.md              # tech constraints + cross-repo policy — read first
├── CLAUDE.md              # working philosophy + folder layout
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
- **No clinical data on-chain.** Opaque IDs, hashes, amounts, and settlement only.

## License

Proprietary. All rights reserved — see [LICENSE](./LICENSE). No copying,
distribution, or derivative works without written permission.
