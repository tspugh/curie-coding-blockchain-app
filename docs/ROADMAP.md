# Roadmap

The delivery plan for **Curie Negotiation Protocol** — agent-mediated drug
coverage-exception arbitration on Somnia.

## North-star

An **impartial AI mediator on neutral rails** that rules a provider↔payer coverage
dispute against **public** references (a published formulary, public clinical evidence,
public price benchmarks), records every position and ruling as a tamper-evident,
replayable on-chain trail, and settles approved coverage through escrow.

## What the product must prove

- **Both the agent and the chain are load-bearing.** The AI mediator's judgment over
  unstructured public evidence is the centerpiece; the chain provides the neutral
  record, identity, and settlement. Remove either and the system collapses.
- **The agent is genuinely AI** — it weighs a free-text evidence argument against
  free-text formulary criteria, not a lookup.
- **No PHI, by construction** — the native agent is public; the protocol runs on a
  de-identified/synthetic note plus public references only.
- **A clean, legible loop**: request → ruling → rebuttal → ruling → settle, every step
  on the explorer with the mediator's receipt attached.

## The lifecycle (prior-authorization-shaped)

```
Requested ──▶ (mediator rules) ──▶ { Approved | Denied | EvidenceRequested }
EvidenceRequested ──▶ provider submits public evidence ──▶ (re-rule)
Denied ──▶ provider appeals with new public evidence ──▶ (re-rule)
Approved ──▶ escrow settles (within a public-benchmark price band)
            also: Withdrawn
```

This mirrors the real coverage-determination → supporting-statement → decision → appeal
process, abstracted to public evidence + a de-identified note. The back-and-forth comes
from the lifecycle; the mediator is invoked each round.

## Pricing model

**Hybrid benchmark band.** The mediator publishes a neutral fair-price band from public
benchmarks (NADAC, Mark Cuban Cost Plus, GoodRx). Provider and payer settle within the
band; the mediator arbitrates if a proposed price falls outside it. Pricing is grounded
in public data and kept distinct from the coverage ruling.

## Somnia surface

- **Agent layer:** `LLM Parse Website` `ExtractString(... options=["approve","deny","need_more_evidence"] ...)` over a public formulary/evidence URL; `inferToolsChat` for multi-step reasoning. Each call yields a public receipt.
- **State + settlement:** the coverage-exception contract on Somnia testnet (chain `50312`, `https://api.infra.testnet.somnia.network/`); identity via `somnia-agent-kit` `AgentRegistry`.
- **Monitoring / contract browser:** JSON-RPC for watching the contract and its engagements with external parties — `eth_call`, `eth_getLogs`, `eth_subscribe` (`logs` / `newHeads`, plus Somnia's `somnia_finishedTransactions` / `somnia_watch`), `eth_getTransactionReceipt`, `realtime_sendRawTransaction`. Full list in [`mvp0-plan.md`](./mvp0-plan.md).

## Path to v0

The detailed v0 spec is in [`mvp0-plan.md`](./mvp0-plan.md). v0 is a **deterministic
skeleton + one real on-chain agent call**: the contract lifecycle, escrow, the
de-identified-note commitment, and a synthetic exchange run reliably, with a single
genuine native-agent ruling (Parse Website over a public formulary fixture) as the
centerpiece that proves the agent is load-bearing.

### Phased

- **Phase 1 — Skeleton + truth.** Coverage-exception contract (states, guards, events,
  note-hash commitment, escrow); deploy to Somnia testnet; deterministic provider/payer
  flows; minimal UI that renders the timeline from events. *Exit: a request goes
  Requested → ruling → Settled on-chain.*
- **Phase 2 — The hero call + protocol feel.** Wire one real native-agent ruling over a
  public formulary fixture; show its receipt; both-party note-hash verification; three
  synthetic scenarios (clean approve, evidence-requested-then-approved,
  denied-then-appealed).
- **Phase 3 — Somnia-native polish + monitoring.** Live event listener
  (`eth_subscribe` / `somnia_watch`); the contract-browser view; hybrid price-band
  settlement; explorer links; architecture/privacy panel.
- **Phase 4 — Harden + present.** Deterministic fallback if the agent call is
  slow/fails; README, architecture diagram, walkthrough, seed data, reset control.

## Feature priority

**P0 (must have)**
- Coverage-exception contract on Somnia (lifecycle, guards, events, escrow)
- De-identified-note hash commitment + both-party verification
- Deterministic provider/payer exchange + synthetic notes/formulary fixtures
- One real native-agent ruling with a viewable receipt
- Timeline UI from events + explorer links

**P1 (strong polish)**
- Live event listener / contract-browser monitoring view
- Hybrid price-band settlement (public benchmarks)
- Three scenarios incl. denied-then-appealed
- Agent identity via `AgentRegistry`
- Architecture/privacy panel

**P2 (stretch)**
- Named appeal levels (redetermination → independent review → hearing)
- Provider/payer reputation
- Mock-stablecoin settlement
- Multiple formulary fixtures

**P3 (not now)**
- Real de-identification pipeline / real PHI
- Real payer/formulary integrations
- Production auth, real payment rails, full compliance

## What to cut aggressively

Real de-identification, real EHR/formulary integration, real payment rails, the full
appeal ladder, ZK proofs, multi-tenant. These are roadmap, not v0.

## What to over-invest in

The one real agent ruling and its receipt (proof the chain's agent layer is
load-bearing), the public-data privacy story, and a legible timeline a viewer
understands in under a minute.
