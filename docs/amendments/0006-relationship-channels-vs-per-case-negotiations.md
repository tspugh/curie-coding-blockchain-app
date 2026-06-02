# A-0006: Reframe contracts as provider↔insurer channels; cases flow as evidence under them

> **Status:** Proposed
> **Date:** 2026-05-30
> **Affects:** [`contracts/contracts/CoverageNegotiation.sol`](../../contracts/contracts/CoverageNegotiation.sol), [`docs/specs/0001-mvp0-coverage-negotiation.md`](../specs/0001-mvp0-coverage-negotiation.md), [`docs/specs/0004-data-and-evidence-model.md`](../specs/0004-data-and-evidence-model.md), and any future SPEC-0006 that implements the channel model.
> **Supersedes:** none. Refines the entity model assumed by SPEC-0001 §3 (one `Negotiation` struct per coverage-exception request); does not invalidate any existing amendment.
>
> Today the on-chain entity is a **per-case** `Negotiation`: one struct bundles the provider address, the insurer address, one drug, one justification, one state machine, one policy attachment. There is no first-class "relationship" object. This amendment proposes a **two-tier** model — a long-lived `Channel` per `(provider, insurer, payerLine)` triple, with short-lived `Case` records flowing under it — to better mirror real-world payer↔provider master agreements and unlock first-class relationship views. The amendment captures the decision; an implementation spec (likely SPEC-0006) would follow, and the contract would be regenerated against it rather than hand-patched.

---

## Context

The discussion started from a UX-shaped question: should "the contract" be reframed as the *channel* between two parties, with patient cases submitted into it as evidence — rather than a fresh contract per case? The question is deeper than it sounds, because it forces an entity-model choice that the current spec made implicitly.

### What the current model is

[`CoverageNegotiation.sol`](../../contracts/contracts/CoverageNegotiation.sol) stores one `Negotiation` struct per coverage-exception request. Every record carries:

- `providerAddr` + `insurerAddr` (auth source of truth, duplicated on every record)
- `payerLine` (PartD / Commercial / Medicaid)
- The drug, quantity, days supply, justification hash, evidence ref
- The policy attached by the insurer at `insurerEngage` (re-attached per request)
- The full state machine (`Open → Ready → UnderReview → ...`)
- Round/ladder counters, ruling fields, settlement marker

The relationship between Provider X and Insurer Y is *implicit* — it exists only as "all `Negotiation` records where these two addresses appear." Aggregate questions ("what is Insurer Y's approval rate against Provider X this quarter?") require scanning the registry and grouping client-side; the chain has no view of the relationship as a thing.

### What real-world healthcare looks like

Payer↔provider arrangements are structurally two-tier:

1. **Master agreement** between the entities — network participation, fee schedule reference, attached policies (with version history), the appeal-ladder template that governs disputes under that line of business. Long-lived; renegotiated annually or quarterly, not per case.
2. **Per-case authorization requests** — each prior auth / coverage exception is a discrete case under the master agreement. Short-lived; gets a case ID and goes through a defined lifecycle.

The current contract collapses both tiers onto the case tier. That is fine for an MVP0 demo with one case per scenario, but it leaves money on the table for the V1 product story.

## Decision

Adopt a **two-tier** entity model.

### Tier 1 — `Channel` (the relationship)

One channel per `(providerAddr, insurerAddr, payerLine)` triple. (Three keys, not two: a provider can have a Part-D channel and a Commercial channel with the same insurer; these are different master agreements and should be different channels.) A channel holds:

- The address pair (the canonical auth source — moved off the case)
- The payer line (determines the appeal-ladder template)
- An evolving **policy catalog**: each entry is `{ policyHash, policyUri, attachedAt, version }`. Cases pin a specific entry at adjudication time.
- Aggregate counters: cases filed, approved, denied, deadlocked, settled — emitted as derived events or maintained on the channel for cheap reads.
- Optional fee-schedule reference (out of scope for V1; placeholder field).
- Channel state: `Open` / `Paused` / `Closed`. A closed channel rejects new cases; existing cases finish under their pinned policy version.

### Tier 2 — `Case` (what `Negotiation` is today, minus the relationship fields)

A case references its parent channel. It carries:

- The drug, quantity, days supply, justification hash, evidence ref (unchanged)
- `pinnedPolicyVersion` — which entry in the channel's catalog this case is being adjudicated against
- The full state machine, exactly as it is today (`Open → Ready → UnderReview → ...`)
- Round counters, ruling fields, settlement marker
- Inherits the payer line and address pair from the parent channel (not duplicated)

Channel creation is **explicit** via `openChannel(insurerAddr, payerLine)` (provider-called) or `openChannel(providerAddr, payerLine)` (insurer-called — either party can initiate). The alternative — lazy auto-creation on first `createContract` — is rejected because it hides the relationship-establishment step, which is exactly the thing the demo wants to make visible.

### Spec-driven follow-through

Per the [project rule](../../CLAUDE.md) ("regenerate, don't migrate"), this amendment does not propose patching `CoverageNegotiation.sol` in place. The path is:

1. Accept this amendment.
2. Author **SPEC-0006 — relationship channels** to the [spec-author](../../.claude/skills/spec-author/SKILL.md) standard, capturing requirements, technical documentation, deliverables, test cases, and pass/fail criteria for the two-tier model.
3. Regenerate the contract from the updated spec set. SPEC-0001's state machine survives intact on the case tier; the channel tier is additive.

## Consequences

### Wins

- **Real relationship dashboards.** "Show me how Aetna has treated St. Mary's this quarter" becomes a single channel read, not a registry scan + client-side group-by.
- **Policy versioning for free.** The insurer publishes Policy v3.2 into the channel's catalog once; cases pin which version they were adjudicated against. The current `insurerEngage` re-attaches the same policy on every case — that redundancy disappears, and the audit trail gets a real "the policy changed on date X" entry.
- **Auth gate simplification.** The `providerAddr != insurerAddr` guard, the `_onlyParty` check, and the `msg.sender == providerAddr` checks all collapse onto the channel. Cases inherit the gate from their parent.
- **Cleaner ladder semantics.** The appeal-ladder template (`LADDERS[payerLine]`) is a property of the channel, not the case. The case just tracks its current rung. This makes SPEC-0004 §2.4 R13's `(payerLine, appealRound)` index a derived view rather than a per-case duplicate.
- **Closes the door on a class of inconsistency bugs** where the same `(provider, insurer)` pair could appear with differing payer lines across cases without anything noticing.

### Costs

- **Two registries, more events, larger spec surface.** Non-trivial for a hackathon timeline.
- **One additional setup step.** "Open the channel before filing the first case" is honest but adds friction. The demo will need to surface channel creation as a deliberate UX moment rather than smuggle it in.
- **Migration story** for any pre-existing per-case data (none in production today, so this is theoretical — but worth naming).
- **Storage layout churn in the contract.** A regenerate-don't-migrate posture means the deployed address changes; any indexer / front-end references update accordingly.

### Non-changes

- The agent-firing path, the `handleResponse` decode, R23 / `policyVoidedClauseIndices`, the deterministic `_benchmarkCap`, and the 50/50 settlement marker (R8) all remain on the case tier and are unaffected by this amendment.
- The PHI invariant (R3/R4) is unchanged — channel records only carry the address pair, payer line, policy hashes/URIs, and counters, all already-on-chain-safe categories.

## Alternatives considered

### Per-patient contracts (rejected)

Keying the on-chain entity on patient would force a PHI consideration. Even with an opaque hashed patient ref, it would (a) put the patient at the center of the chain model when the project's hard rule is that PHI never goes on-chain, and (b) fragment poorly for patients with multiple drugs across multiple insurers. **The patient is properly a property of the off-chain case packet, not an on-chain sharding key.**

### Per-state / per-jurisdiction contracts (rejected)

State (NY vs CA Medicaid, Part D vs commercial) is an **attribute**, not a sharding key. The payer line is already on the negotiation today, and `(payerLine, appealRound)` indexes the ladder. Sharding by jurisdiction would conflate "which ladder applies" (a property) with "which entity is this" (an identity), and would not survive contact with a multi-state insurer.

### Per-case only — status quo (rejected for V1, kept for MVP0)

Clean isolation, simple state machine, easy to demo — these are real virtues, and they are the reason the current model is correct **for MVP0**. The cost is that the relationship is implicit, policy attachment is redundant per case, and relationship-level analytics require client-side aggregation. Accepted as the V0/MVP0 model; rejected as the V1 endpoint.

### Lazy channel auto-creation (rejected)

Auto-creating the channel on first `createContract` removes the setup step but hides the relationship-establishment moment that the product story wants to elevate. Worse, it forces a branch in `createContract` (channel exists vs. doesn't) and makes the auth gate ambiguous (the first case's caller becomes the de facto channel opener, which is exactly the kind of implicit-trust pattern we want to avoid). Explicit `openChannel` wins on clarity.

## Open questions

1. **Channel key precision.** Is `(providerAddr, insurerAddr, payerLine)` the right triple, or should it be `(providerOrgId, insurerOrgId, payerLine)` keyed on the app-level party IDs with the addresses as a property? The latter lets an organization rotate wallets without breaking the channel; the former is simpler and matches today's auth model.
2. **Channel closure semantics.** When a channel is `Closed`, do in-flight cases continue under their pinned policy version, or do they get force-routed to a terminal state? Lean: continue, but reject new cases.
3. **Policy catalog growth bound.** A channel that runs for years could accumulate many policy versions. Hard cap, soft cap (oldest archived), or unbounded with a paginated read?
4. **Aggregate counters on-chain vs. derived.** Maintaining cases-filed / approved / denied counters on the channel struct costs gas on every case transition. The alternative is to derive these views off-chain from events. Lean: derive off-chain; the on-chain counters are not load-bearing.
5. **Scope of SPEC-0006.** Should the channel spec also subsume the appeal-ladder template (currently in SPEC-0004 §2.4 R13–R16), or leave SPEC-0004 as the canonical ladder spec and have SPEC-0006 reference it?
6. **MVP0 demo impact.** Does V0 demo continue to ship the per-case-only model, with channels arriving in V1? Lean: yes — this amendment captures the V1 direction without disturbing the demo path.
