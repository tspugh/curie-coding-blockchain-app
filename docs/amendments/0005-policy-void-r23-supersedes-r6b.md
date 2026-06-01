# Amendment 0005 — SPEC-0004 R23 supersedes SPEC-0001 R6b for the on-label policy-void case

**Date:** 2026-05-29
**Status:** Adopted
**Authored from:** strict-review finding (tick 9, UNIT-3b) flagging that the
`commercial-policy-void` curated scenario cannot satisfy both R6b and R23 because
they prescribe opposite rulings for the same fact pattern.

## The conflict

- **SPEC-0001 R6b** (policy compliance / void): "If a policy clause the agent
  relies on contradicts a cited public standard (FDA-approved indication /
  guideline), the agent emits `PolicyFlagged(clauseRef, standardRef)` and routes
  the contract to terminal `PolicyInvalidated` — the whole request is voided
  (incentivising compliant policy). No silent override."
- **SPEC-0004 §2.6 R23** (on-label policy-void rule, 2026-05-29): "If the policy
  clause cited in a denial is contradicted by an FDA-label slice the arbiter
  accepts… the arbiter MUST rule `Approve` and emit a
  `policyVoidedClauseIndices: number[]` field in the ruling payload identifying
  which policy-quote leaves are invalidated… This is the SPEC-0002 set-piece and
  the `commercial-policy-void` curated case's outcome."

R6b says the contract is voided (request denied). R23 says the request is
approved (with the clause flagged). For the same fact pattern (policy clause
contradicts FDA-label), the two rules dictate opposite outcomes.

## Resolution: R23 wins

R23 supersedes R6b for the **on-label policy-void case** because:

1. **R23 is more recent.** SPEC-0004 (2026-05-29) post-dates the SPEC-0001
   author of R6b; the author of SPEC-0004 was aware of R6b's existence (R6b is
   transitively referenced from §2.4 line 42) and chose a different outcome.
2. **R23 is more specific.** It explicitly names the `commercial-policy-void`
   curated case and the SPEC-0002 set-piece demo flow. R6b is the general
   state-machine routing rule.
3. **R23 better aligns with R6b's stated motivation.** R6b's parenthetical
   ("incentivising compliant policy") is achieved by R23 too — approving the
   request *with the clause flagged* tells the payer "your policy contradicts
   public standards and we're going around it," which is a stronger incentive
   than terminally voiding one contract.
4. **R23 is provider-friendly.** Patients get their drug, providers get paid,
   payers are publicly flagged for non-compliant policy. R6b leaves the patient
   without the drug because the protocol cleared its throat.
5. **The R23 path retains the R6b semantics in the payload.** The `Approved`
   event's `policyVoidedClauseIndices: number[]` carries the same information
   that `PolicyFlagged(clauseRef, standardRef)` would have, just embedded in
   the success ruling rather than emitted alongside a terminal route.

## What changes

- **SPEC-0001 R6b** is REPLACED in scope: "policy clause contradicts public
  standard" is no longer a terminal-`PolicyInvalidated` route. Instead:
  - The arbiter rules `Approve` with `policyVoidedClauseIndices: number[]`
    populated (R23).
  - The `PolicyFlagged(clauseRef, standardRef)` event is REPURPOSED as an
    annotation event emitted alongside `Ruled(... decision=Approve ...)`, not
    as a separate state route.
  - The `PolicyInvalidated` terminal state remains in the SPEC-0001 R6b state
    machine but is now reserved for a strictly NARROWER condition: the agent
    cannot find any valid ruling because every policy clause it consulted is
    non-compliant (a meta-policy failure, not a per-request void). This is an
    EDGE case in v0 and may be removed in v1.
- **SPEC-0004 R23** stands as written. It is the canonical on-label policy-void
  rule.
- **The `commercial-policy-void` curated case** ships with
  `expected-outcome.md` documenting:
  - Ruling: `Approve`
  - Settlement: R24 cost-band (computed per-fixture)
  - `policyVoidedClauseIndices: [1]` (index of the policy-clause reference in
    the packet)
  - Timeline annotation: `policy clause 1 — VOIDED by FDA label §1 INDICATIONS AND USAGE`

## Implementation impact

This amendment is **non-code-changing for tick 9** — it documents the
resolution so the fixture can adopt the R23 path coherently. The contract's
`handleResponse` decode path (which currently routes the `PolicyInvalid`
decision to terminal `PolicyInvalidated`) is unchanged for now; once the
SPEC-0004 Phase 1 contract work (R23 ruling-payload decode) lands, the
arbiter's `Approve` + `policyVoidedClauseIndices` ruling will flow through the
existing `Approve` path with the indices payload attached. No state-machine
change required; only the ruling-payload schema changes.

A future tick should:
- Update SPEC-0001 §3 R6b prose to match this amendment.
- Add `policyVoidedClauseIndices` to the `Ruled` event payload in §3.5.
- Tighten SPEC-0004 §3.4's ruling type to expose `policyVoidedClauseIndices`
  on the Approved branch (the type already has it as `?: number[]`, line 490).

## Test impact

- `src/protocol/scenarios.commercial-policy-void.test.ts` is updated this tick
  to assert the R23 outcome in `expected-outcome.md` (Approve, not
  PolicyInvalidated).
- The `PolicyInvalidated` symbol in the test is REMOVED from the
  expected-outcome assertion; the test now reads the `## Expected outcome:`
  header line and verifies it names `Approve` with a reference to the
  policy-void escape hatch.
