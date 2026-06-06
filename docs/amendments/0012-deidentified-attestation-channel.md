# Amendment 0012 — De-identified attestation channel

**Status:** Proposed (2026-06-06)
**Affects:** SPEC-0001 R4 (no PHI on-chain), SPEC-0006 evidence model. Implements
SPEC-0007 R5–R7.

## Context

Most prior-authorization criteria are **patient-specific** — step therapy ("failed
methotrexate ≥ 3 months"), severity ("BSA ≥ 10%"), safety ("TB screened"). Those facts
are **PHI**, and the suite invariant forbids PHI on-chain. Today the clinical
justification is *hashed* (R4), so the agent cannot read it at all — meaning the agent
has **no way to evaluate the patient-specific clauses**, and a policy that contains them
cannot be adjudicated end-to-end.

HIPAA Safe Harbor: data with **none of the 18 identifiers** is **de-identified** and not
PHI. A structured boolean — "step-therapy clause satisfied: true", with no name, no MRN,
no dates, no free narrative — is de-identified and therefore safe to surface to the agent.

## Decision

Add a **de-identified attestation channel** to the negotiation:

- The provider supplies `{clauseId, attested: bool}` entries for each **attested** clause
  (SPEC-0007 R5). These are **structured booleans only** — no free clinical text, none of
  the 18 HIPAA identifiers.
- The decide synthesis reads the attestations alongside the public-clause verdicts and
  approves **iff** every public clause is satisfied by evidence **and** every attested
  clause has an affirmative attestation (SPEC-0007 R7).
- The contract's existing name-pattern PHI guard is **extended to reject free-text /
  narrative** in the attestation channel — only the closed `{id, bool}` shape is accepted.
- The agent **records and trusts** attestations; it does **not** independently verify
  them. The UI must label attested clauses as *provider-asserted, not agent-verified* so
  the trust model is honest.
- Storage shape — **on-chain structured booleans (SPEC-0007 OQ2 resolved 2026-06-06).**
  Each attestation is stored on the negotiation as `{bytes32 clauseId, bool attested}`
  (e.g. a fixed-size array or a `clauseId → bool` mapping). No hash/reveal indirection: a
  clause id + a boolean is self-evidently non-PHI, cheap to store, and read directly by the
  decide synthesis. The guard rejects anything but this closed shape.

## Consequences

- A policy with patient-specific clauses becomes adjudicable without any PHI on-chain.
- A clear **trust boundary**: public clauses are *verified*; attested clauses are
  *asserted*. This must be visible in the UI and the rationale (R9), so no one mistakes an
  attestation for an independent check.
- De-identification assurance rests on attestations staying **structured booleans**; any
  future free-text attestation would require Expert-Determination review rather than Safe
  Harbor (SPEC-0007 OQ4) — so the schema deliberately forbids free text.
- **PHI routing (SPEC-0007 R11):** any clause that *cannot* be reduced to a public check
  or a de-identified boolean is **flagged "requires direct off-chain communication"** and
  handled provider↔payer out-of-band — it never enters the protocol. The demo build carries
  **no PHI path at all**; this keeps the trust/safety story clean and sidesteps the
  Expert-Determination question entirely.
- Redeploy required (new negotiation field + guard).

## Test impact

Pins SPEC-0007 T3, T6, T7. Add: a guard test rejecting narrative/identifier-bearing
attestation input; a flow test where a missing/false attestation blocks Approve; a
no-PHI scan over the attestation channel.
