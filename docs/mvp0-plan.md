# MVP0 Plan — Curie Negotiation Protocol

**Phase:** MVP0 — end-to-end drug coverage-exception arbitration loop

---

## Goal

The minimum working end-to-end flow that demonstrates **Curie Negotiation Protocol**:

> A provider and an insurer argue a drug coverage / formulary-exception request; an
> on-chain AI mediator rules each round against a **public** formulary; approved
> coverage settles through escrow — no PHI on-chain.

MVP0 is a **deterministic skeleton + one real on-chain agent call**: the contract
lifecycle, escrow, the de-identified-note commitment, and a synthetic exchange run
reliably, with a single genuine native-agent ruling (`LLM Parse Website` over a public
formulary fixture) as the centerpiece that proves the chain's agent layer is
load-bearing.

The loop a viewer watches:

1. A (synthetic) **de-identified note** is committed on-chain by hash; both parties can verify they hold the same note.
2. **Provider** submits a coverage/exception request for a drug (RxNorm/NDC) citing a public-evidence URL.
3. **Mediator** (native Somnia agent) reads the public formulary fixture and rules `approve | deny | need_more_evidence`, with a receipt.
4. On `need_more_evidence`, provider submits a public-evidence reference; mediator re-rules.
5. On `approve`, **escrow settles** within a public-benchmark price band; `Settled` event fires.
6. UI renders the timeline from events, with explorer links and the mediator's receipt.

---

## In Scope

### Smart Contract — `CoverageNegotiation.sol`

- **States:** `Requested`, `UnderReview`, `EvidenceRequested`, `Approved`, `Denied`, `Appealed`, `Settled`, `Withdrawn`
- **Shared substrate:** `noteHash` (keccak256 of the de-identified note) committed at request; note text emitted in an event / Somnia Data Stream so both parties verify `keccak256(note) == noteHash`.
- **Core functions:**
  - `submitRequest(providerId, payerId, drugRef, noteHash, requestedAmount, priceFloor, priceCeil, evidenceUri)` → `Requested`
  - `requestRuling(reqId)` → fires the native agent (see Mediator) → `UnderReview`
  - `handleRuling(reqId, verdict, rationaleHash, receiptId)` *(platform callback only)* → `Approved` / `Denied` / `EvidenceRequested`
  - `submitEvidence(reqId, evidenceUri)` when `EvidenceRequested` → `UnderReview`
  - `appeal(reqId, evidenceUri)` when `Denied` → `UnderReview`
  - `settle(reqId)` when `Approved` → `Settled` (escrow release, amount within `[priceFloor, priceCeil]`)
  - `withdraw(reqId)` → `Withdrawn`
- **Events:** `RequestSubmitted`, `NoteCommitted`, `RulingRequested`, `Ruled`, `EvidenceSubmitted`, `Appealed`, `Settled`, `Withdrawn`
- **Guards:** strict per-state `require`s; `handleRuling` restricted to the Somnia platform address.
- **Escrow:** funds held at `submitRequest` (or `approve`), released on `settle` within the price band; refundable on `Denied`/`Withdrawn`.

### Mediator — one real native-agent ruling (the hero)

- On `requestRuling`, the contract calls the Somnia **LLM Parse Website** base agent via `createRequest` with a payload: the public **formulary fixture URL**, the request context (drug + cited evidence URL), and `ExtractString` `options=["approve","deny","need_more_evidence"]`.
- The agent reads the formulary, rules, and the platform invokes `handleRuling` with the verdict + a `receiptId` pointer (the public receipt).
- **Deterministic fallback:** if the agent call is slow/unavailable, a deterministic stub produces the same verdict shape so the loop never blocks. (Real coverage decisions take days; on-chain callback latency is comfortably within tolerance.)

### Pricing — hybrid benchmark band

- `priceFloor`/`priceCeil` derived from public benchmarks (NADAC / Cost Plus / GoodRx), passed at `submitRequest`.
- Settlement amount must fall within the band; out-of-band proposals are rejected/arbitrated.
- For MVP0 the band is a fixture value per drug; live benchmark fetch is P1.

### Roles & app flow

- **Roles:** provider, payer (insurer), patient/uploader, mediator agent.
- **Flow:** upload patient details → app **strips to a (synthetic) de-identified note** → commit note + `submitRequest` → parties argue (evidence/appeal) → mediator rules each round → escrow settles.

### Monitoring / "contract browser"

A view (and the underlying JSON-RPC calls) so anyone can watch a given contract and its engagements with external parties:

| Need | JSON-RPC method(s) |
|---|---|
| Read contract state / a request | `eth_call` |
| Historical rulings/events | `eth_getLogs` (≤1000-block ranges) |
| Live updates | `eth_subscribe` → `logs`, `newHeads`; Somnia `somnia_finishedTransactions`, `somnia_watch` |
| Tx outcome / receipt | `eth_getTransactionReceipt`, `eth_getTransactionByHash` |
| Submit + await | `eth_sendRawTransaction`, Somnia `realtime_sendRawTransaction` |

### UI — minimal dashboard

- "Run scenario" control; negotiation timeline rendered from events (state transitions, who argued what, rulings).
- Somnia explorer links per tx; the mediator's **receipt** viewable.
- Note-verification badge ("your copy matches the on-chain hash").
- Privacy panel: "Off-chain/public source: formulary, evidence | On-chain: note hash, references, rulings, settlement."

---

## Out of Scope (MVP1+)

Real de-identification pipeline / real PHI; real formulary & payer integrations; the
full named appeal ladder; live benchmark price fetch; mock stablecoin (event-only
settlement is fine for v0); provider/payer reputation; multi-tenant; subgraph indexing;
ZK proofs; mobile UI.

---

## Architecture

```
        Upload patient details ──▶ de-identify (synthetic) ──▶ de-identified note
                                                                    │ keccak256
        ┌──────────────────┐                       ┌───────────────▼──────────┐
        │  Provider agent   │                       │  Payer agent (insurer)   │
        │  (TypeScript)     │                       │  (TypeScript)            │
        │  request + cite   │                       │  positions / accept band │
        └─────────┬─────────┘                       └───────────┬──────────────┘
                  │ tx                                           │ tx
                  ▼                                              ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │            Somnia testnet (chain 50312)                           │
        │  CoverageNegotiation.sol  ── requestRuling ──▶  LLM Parse Website  │
        │  (lifecycle, noteHash,    ◀── handleRuling ───   (native agent)    │
        │   escrow, events)              verdict+receipt    over public      │
        │                                                   formulary URL    │
        │  AgentRegistry (somnia-agent-kit) — agent identity                 │
        └───────────────────────────────┬──────────────────────────────────┘
                  events + view calls    │   JSON-RPC (eth_getLogs / eth_subscribe / somnia_watch)
                                         ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │  Dashboard: timeline · explorer links · mediator receipt · note   │
        │  verification · privacy panel                                     │
        └──────────────────────────────────────────────────────────────────┘

PUBLIC / OFF-CHAIN: synthetic de-identified note text, public formulary fixture,
  cited public evidence (URLs), public price benchmarks.
ON-CHAIN: noteHash, drugRef, evidence URI refs, rulings + rationale/receipt refs,
  price band, escrow + settlement, state, agent IDs, timestamps, events.
```

---

## Implementation steps (high level)

1. **Scaffold** — Hardhat in `contracts/`; root TS app on `somnia-agent-kit`; network = chain `50312` / `https://api.infra.testnet.somnia.network/` (see [`../src/config/networks.ts`](../src/config/networks.ts)).
2. **`CoverageNegotiation.sol`** — states, guards, events, `noteHash` commitment, escrow; `handleRuling` gated to the platform address.
3. **Contract tests** — happy path (approve→settle), evidence-requested→approved, denied→appealed; guard reverts; note-hash commitment; escrow within band.
4. **Deploy** to Somnia testnet; record address.
5. **Provider/payer agents** — deterministic TypeScript on `somnia-agent-kit`; build request, commit note, submit/evidence/appeal.
6. **Mediator hero call** — wire `requestRuling` → LLM Parse Website over the formulary fixture → `handleRuling`; deterministic fallback.
7. **Monitoring + UI** — event listener via `eth_subscribe`/`somnia_watch`; timeline + receipts + note verification + privacy panel.
8. **Synthetic data** — de-identified note fixture(s), public formulary fixture, price-band fixtures, scenarios.

---

## Acceptance criteria

- [ ] `CoverageNegotiation.sol` compiles clean; deploys to Somnia testnet (chain `50312`); returns an address.
- [ ] `submitRequest` → `Requested`, commits `noteHash`, emits `RequestSubmitted` + `NoteCommitted`.
- [ ] `requestRuling` → `UnderReview`; a **real** LLM Parse Website agent call returns a verdict and `handleRuling` records it with a receipt reference.
- [ ] `need_more_evidence` → `submitEvidence` → re-rule → `approve` works; `denied` → `appeal` → re-rule works.
- [ ] `settle` releases escrow only within `[priceFloor, priceCeil]`; emits `Settled`.
- [ ] Invalid transitions revert; `handleRuling` rejects non-platform callers.
- [ ] Both parties can verify `keccak256(note) == noteHash`; **no PHI** anywhere on-chain (synthetic note only).
- [ ] One command runs the full synthetic scenario; the UI renders the timeline with explorer links and the mediator receipt.

---

## Dependencies

| Service | For | Required? |
|---|---|---|
| Somnia testnet RPC (`https://api.infra.testnet.somnia.network/`, chain `50312`) | deploy + interaction | Yes |
| Somnia LLM Parse Website base agent | the mediator ruling | Yes (with deterministic fallback) |
| `somnia-agent-kit@^3.0.11` | identity, contract bindings | Yes |
| `AgentRegistry` (somnia-agent-kit) | provider/payer identity | Yes |
| Somnia testnet faucet (STT) | gas + agent fees | Yes |
| Somnia explorer (`https://shannon-explorer.somnia.network/`) | verify txs | Helpful |

Environment: `PRIVATE_KEY`, `SOMNIA_NETWORK=testnet`, `COVERAGE_CONTRACT_ADDRESS` (after deploy), formulary fixture URL.

---

## File tree (after MVP0)

```
.
├── CLAUDE.md · LICENSE · README.md · .mcp.json · .env.example
├── contracts/
│   ├── hardhat.config.ts            # Somnia testnet (chain 50312)
│   ├── CoverageNegotiation.sol
│   ├── test/CoverageNegotiation.test.ts
│   └── scripts/deploy.ts
├── src/
│   ├── index.ts                     # demo runner
│   ├── config/{networks.ts,env.ts}
│   ├── somnia/kit.ts
│   ├── types/coverage.types.ts
│   ├── agents/{provider-agent.ts,payer-agent.ts,mediator.ts}
│   └── orchestrator.ts
├── demo-data/
│   ├── notes/synthetic-note-001.json        # de-identified, synthetic
│   ├── formularies/formulary-fixture-001.*  # public-style formulary fixture
│   └── prices/price-bands-001.json          # public-benchmark bands
└── web/                              # timeline + monitoring dashboard
```

---

## Decisions

- **TypeScript only** (per [`../CLAUDE.md`](../CLAUDE.md)); contract tests via Hardhat.
- **No PHI on-chain**; de-identified/synthetic note only; the agent sees only public data + the de-identified note.
- **Hybrid price band** from public benchmarks; settlement bounded by the band.
- **One real native-agent ruling** is the load-bearing AI step; everything else deterministic for reliability.
- **Settlement event-only for v0**; mock-stablecoin transfer is P1/P2.
