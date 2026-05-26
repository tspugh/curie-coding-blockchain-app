# SPEC-0001: MVP0 — Coverage-exception negotiation loop

Status: Draft · Owner: tspugh · Date: 2026-05-26

## 1. Summary & user story

The minimum end-to-end loop for Curie Negotiation Protocol: a provider and an insurer
argue a drug coverage / formulary-exception request, an on-chain AI mediator rules each
round against a **public** formulary, and approved coverage settles through escrow — no
PHI on-chain. MVP0 is a **deterministic skeleton + one real on-chain agent call**.

> As a **provider**, I want to request a drug coverage exception and have an impartial
> on-chain mediator rule it against a public formulary, so that the decision and its
> settlement are fast, fair, and auditable.
>
> As a **payer (insurer)**, I want every position and ruling recorded on neutral rails,
> so that I can trust the outcome without trusting the other party's back office.

## 2. Requirements

- **R1 (MUST)** A (synthetic) de-identified note is committed once as the shared substrate; its keccak256 hash is on-chain and both parties can verify their copy matches.
- **R2 (MUST)** A provider submits a coverage/exception request for a drug (RxNorm/NDC) citing a public-evidence URL, with a public-benchmark price band `[priceFloor, priceCeil]`.
- **R3 (MUST)** A mediator ruling is produced by a **real** native Somnia agent call (LLM Parse Website over a public formulary fixture) returning `approve | deny | need_more_evidence`, with a public receipt reference.
- **R4 (MUST)** `need_more_evidence` returns the flow to the provider for more public evidence and re-ruling; `deny` allows an appeal with new public evidence and re-ruling.
- **R5 (MUST)** On `approve`, escrow settles only at an amount within `[priceFloor, priceCeil]`.
- **R6 (MUST)** State transitions are guarded; the ruling callback is callable only by the Somnia platform address.
- **R7 (MUST)** No PHI is ever placed on-chain or passed to the agent; only the de-identified note, public references, hashes, rulings, and settlement.
- **R8 (SHOULD)** Anyone can monitor a contract and its external-party engagements over JSON-RPC (events + live subscription).
- **R9 (SHOULD)** A deterministic fallback yields the same verdict shape if the agent call is slow/unavailable, so the loop never blocks.

## 3. Technical documentation

**On-chain/off-chain boundary.** Public/off-chain: synthetic de-identified note text,
public formulary fixture, cited public evidence (URLs), public price benchmarks.
On-chain: `noteHash`, `drugRef`, evidence URI refs, rulings + rationale/receipt refs,
price band, escrow + settlement, state, agent IDs, timestamps, events.

**Contract — `CoverageNegotiation.sol`**
- States: `Requested`, `UnderReview`, `EvidenceRequested`, `Approved`, `Denied`, `Appealed`, `Settled`, `Withdrawn`.
- Functions: `submitRequest(providerId, payerId, drugRef, noteHash, requestedAmount, priceFloor, priceCeil, evidenceUri)`; `requestRuling(reqId)`; `handleRuling(reqId, verdict, rationaleHash, receiptId)` *(platform-only)*; `submitEvidence(reqId, evidenceUri)`; `appeal(reqId, evidenceUri)`; `settle(reqId)`; `withdraw(reqId)`.
- Events: `RequestSubmitted`, `NoteCommitted`, `RulingRequested`, `Ruled`, `EvidenceSubmitted`, `Appealed`, `Settled`, `Withdrawn`.
- Guards: strict per-state `require`s; `handleRuling` gated to the platform address; settlement amount asserted within `[priceFloor, priceCeil]`.

**Mediator (the hero call).** On `requestRuling`, the contract calls the Somnia LLM
Parse Website base agent via `createRequest` with payload = public formulary fixture URL
+ request context (drug + cited evidence URL) + `ExtractString` `options=["approve","deny","need_more_evidence"]`. The platform invokes `handleRuling` with the verdict + `receiptId`. Deterministic fallback (R9) mirrors the verdict shape.

**Pricing.** Hybrid benchmark band: `priceFloor`/`priceCeil` from public benchmarks
(NADAC / Cost Plus / GoodRx), fixture values per drug for MVP0; settlement bounded by the band.

**Monitoring (contract browser).** `eth_call` (state), `eth_getLogs` (history, ≤1000-block
ranges), `eth_subscribe` → `logs`/`newHeads` + Somnia `somnia_finishedTransactions`/`somnia_watch`
(live), `eth_getTransactionReceipt` (outcomes), `eth_sendRawTransaction` / Somnia
`realtime_sendRawTransaction` (submit).

**Network.** Somnia testnet — chain `50312`, RPC `https://api.infra.testnet.somnia.network/`
(see [`../../src/config/networks.ts`](../../src/config/networks.ts)); identity via
`somnia-agent-kit` `AgentRegistry`. App flow: upload patient details → strip to a
synthetic de-identified note → commit + `submitRequest` → argue → rule → settle.

```
Provider/Payer agents ──tx──▶ CoverageNegotiation.sol ──requestRuling──▶ LLM Parse Website
                                  ▲  └──handleRuling (verdict+receipt)──┘   (public formulary)
        JSON-RPC (eth_getLogs / eth_subscribe / somnia_watch) ──▶ Dashboard (timeline, receipt, note check)
```

## 4. Deliverables

- `contracts/CoverageNegotiation.sol` + `contracts/test/CoverageNegotiation.test.ts` + `contracts/scripts/deploy.ts` + `hardhat.config.ts` (chain 50312).
- `src/agents/{provider-agent,payer-agent,mediator}.ts`, `src/orchestrator.ts`, `src/types/coverage.types.ts`, `src/index.ts` (demo runner).
- `demo-data/notes/synthetic-note-001.json`, `demo-data/formularies/formulary-fixture-001.*`, `demo-data/prices/price-bands-001.json`.
- `web/` timeline + monitoring dashboard (events, explorer links, mediator receipt, note-verification badge, privacy panel).
- Deployed testnet address recorded in `.env.example` / README.

## 5. Test cases

- **T1 (R1,R7):** note committed; `keccak256(note)` equals on-chain `noteHash`; no PHI in any on-chain field or agent payload.
- **T2 (R2):** `submitRequest` → `Requested`; emits `RequestSubmitted` + `NoteCommitted`.
- **T3 (R3):** `requestRuling` → `UnderReview`; a real agent call yields a verdict and `handleRuling` records it with a `receiptId`.
- **T4 (R4):** `need_more_evidence` → `submitEvidence` → re-rule → `approve`; `deny` → `appeal` → re-rule.
- **T5 (R5):** `settle` succeeds within the band; reverts for an amount outside `[priceFloor, priceCeil]`.
- **T6 (R6):** invalid transitions revert (e.g., `settle` on `Requested`); `handleRuling` reverts for a non-platform caller.
- **T7 (R8):** a client reconstructs the full timeline from `eth_getLogs` and receives live updates via subscription.
- **T8 (R9):** with the agent stubbed, the loop still completes via the deterministic fallback.

## 6. Pass / fail criteria

**PASS — all must hold:**
- [ ] `CoverageNegotiation.sol` compiles clean and deploys to Somnia testnet (chain 50312), returning an address.
- [ ] T2–T6 pass in the contract test suite; T1, T7, T8 pass end-to-end.
- [ ] At least one **real** native-agent ruling is produced on testnet with a viewable receipt (R3).
- [ ] One command runs the full synthetic scenario; the dashboard renders the timeline with explorer links, the mediator receipt, and the note-verification badge.
- [ ] Both parties can verify `keccak256(note) == noteHash`.

**FAIL — any triggers rejection:**
- Any PHI (or any non-synthetic identifier) appears on-chain or in an agent payload.
- The mediator ruling is entirely faked (no real agent call path exists at all).
- An invalid state transition does not revert, or `handleRuling` accepts a non-platform caller.
- Escrow settles outside `[priceFloor, priceCeil]`.

## 7. Out of scope

Real de-identification pipeline / real PHI; real formulary & payer integrations; the
full named appeal ladder (redetermination → independent review → hearing); live
benchmark price fetch; mock-stablecoin transfer (event-only settlement is fine for v0);
provider/payer reputation; multi-tenant; subgraph indexing; ZK proofs; mobile UI.

## 8. Open questions

1. Settlement asset for v0 — event-only vs. a mock test token? — priority: medium
2. Formulary fixture source — a published Medicare Part D formulary vs. a synthetic published-formulary fixture? — priority: high
3. Does `requestRuling` fire the agent directly from the contract, or via an off-chain orchestrator that submits the agent request and relays `handleRuling`? — priority: high
