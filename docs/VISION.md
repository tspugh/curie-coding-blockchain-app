# Curie Negotiation Protocol — Product Vision

**One-liner.** Curie Negotiation Protocol is an agent-mediated drug coverage-exception
protocol: a provider and an insurer argue a coverage / formulary-exception request, an
on-chain AI mediator rules each round against **public** formularies, clinical
evidence, and price benchmarks, and approved coverage settles through escrow — with
**no protected health information on-chain**.

## The Problem

Getting a prescribed drug covered is a slow, opaque back-and-forth. When a drug is
non-formulary or gated by step therapy / prior authorization, the provider must file a
coverage determination or exception, the plan asks for justification, decisions take
days, and denials escalate through a multi-level appeal process. The criteria the plan
applies — and the evidence that would satisfy them — are rarely visible to the other
side. The process is a chain of private handoffs with no neutral, auditable record.

## The Goal

Build a neutral, agent-native protocol for arguing and settling drug coverage
exceptions. Provider and payer submit their positions, an impartial AI mediator rules
each round **against public references** (the plan's published formulary, public
clinical evidence, public price benchmarks), every step is a tamper-evident on-chain
record, and approved coverage settles automatically — without trusting either party's
back office to adjudicate fairly or to remember what was argued.

## The Product Idea

A coverage request flows through the protocol as a prior-authorization-shaped exchange
anchored on Somnia. A **de-identified patient note** is committed once as the shared
factual substrate — both sides verify they hold the byte-identical note via its
on-chain hash. The **provider** requests coverage or a formulary exception for a drug
(RxNorm/NDC), citing public evidence (a clinical guideline, an FDA label,
comparative-effectiveness data) by reference. The **AI mediator** — a native Somnia
agent — reads the **public** formulary criteria and the cited public evidence and
rules: **approve**, **deny** (with reasons), or **request more evidence**. Each ruling
is an on-chain state transition with an auditable receipt. The parties loop until
resolved or the appeal path is exhausted; on approval, **escrow settles** at a price
within a public-benchmark band.

The product is the *neutral mediation and its auditable record* — not a coverage engine
for any one plan. The mediator's value is judgment over unstructured evidence, grounded
entirely in public sources.

## Differentiation

Prior authorization today is a single-payer black box. Curie sits on neutral rails any
provider and any payer can transact on:

- **Impartial AI mediation as a first-class protocol**, grounded in public references — not one plan's internal rules engine.
- **Tamper-evident audit trail** of every position, ruling, and rationale, with the mediator's receipt attached.
- **Programmable settlement** — escrow releases on agreement, bounded by a public price benchmark.
- **Verifiable shared ground truth** — the de-identified note is hash-committed, so neither side can argue a different record.
- **Portable reasoning** — the exchange replays deterministically for a downstream auditor or appeal.

## Technical Architecture

Somnia provides the chain — high-throughput, sub-second finality fast enough that the
exchange feels interactive — **and the agent layer**. The AI mediator runs as a native
Somnia agent (`LLM Parse Website` over public formularies/evidence, `inferToolsChat`
for multi-step reasoning), so its judgment is consensus-verified and its receipt is
public. This is the load-bearing use of the chain: the mediator's reasoning is the
product, and it operates only on public data.

A smart contract holds the coverage-exception lifecycle state machine (Requested →
UnderReview → {Approved | Denied | EvidenceRequested} → Appealed → Settled), the
de-identified-note hash commitment, and escrow. Provider and payer are TypeScript
services on `somnia-agent-kit`, each with an on-chain identity. Public evidence stays at
its public source and is fetched on demand; only references, rulings, the exchange
transcript, and settlement touch the chain.

## Privacy

**No PHI on-chain, and none through the agent.** The native agent's inputs, outputs, and
receipts are public on-chain by construction, so the protocol operates on a
**de-identified note** plus public references only. Arguments stay at the drug +
formulary + public-evidence level — never a real patient chart. Robust de-identification
(HIPAA Safe Harbor / Expert Determination) is a production obligation; current
development uses **synthetic notes**.
