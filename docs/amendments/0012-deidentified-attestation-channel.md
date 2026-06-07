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
  clause has an affirmative attestation (SPEC-0007 R7). **Mechanism (decided 2026-06-07):**
  `clauseId` is an opaque `bytes32` on-chain, so the agent literally cannot reason about
  attestations per-clause. The "every attested clause affirmative" conjunction is therefore
  enforced **deterministically in the contract** (`_handleDecideResponse`): a `false`
  attestation downgrades an agent `approve` to `needs-more-info` (→ `EvidenceRequested`,
  T3). You do not ask an LLM to compute a boolean AND. The decide prompt still *states*
  whether attestations are "all affirmative" (R9 honest rationale), but the gate is the
  contract's, not the model's.
- **Entry point — function OVERLOAD, not a bare signature change (decided 2026-06-07).**
  R13's `requestAdjudication(reqId, attestations)` is added as a SECOND overload alongside
  the existing `requestAdjudication(reqId)`. The 1-arg form means "public-only policy, no
  attestations" (vacuously affirmative); the 2-arg form is **provider-only** (the provider
  holds the clinical facts) and carries the `Attestation[]`. This keeps the change purely
  *additive*: the existing demo/A0011 path keeps working through 1-arg, and ~80 existing
  call sites need no rewrite. (ethers v6 requires the full signature
  `requestAdjudication(uint256)` / `requestAdjudication(uint256,(bytes32,bool,bytes32)[])`
  to disambiguate overloaded names — a mechanical change at the ethers boundary only.)
- **The closed `{bytes32, bool, bytes32}` shape IS the PHI guard.** Free text / narrative /
  the 18 HIPAA identifiers are structurally unrepresentable in fixed-size words, so no
  separate name-pattern check is needed on this channel — the type system rejects narrative
  at the ABI boundary. A `MAX_ATTESTATIONS` (32) bound guards the decide-time loop against
  gas griefing.
- The agent **records and trusts** attestations; it does **not** independently verify
  them. The UI must label attested clauses as *provider-asserted, not agent-verified* so
  the trust model is honest.
- Storage shape — **on-chain structured booleans (SPEC-0007 OQ2 resolved 2026-06-06).**
  Each attestation is stored as `{bytes32 clauseId, bool attested, bytes32 evidenceUriHash}`
  (R13) in a `mapping(uint256 reqId => Attestation[])` kept OUT of the `Negotiation` struct
  (so the `getNegotiation` tuple shape is unchanged; read via `getAttestations(reqId)`). The
  optional `evidenceUriHash` is the keccak of a **de-identified** supporting URL (R5),
  `0x0` when none — no content on-chain. No hash/reveal indirection on the clause id+bool: a
  clause id + a boolean is self-evidently non-PHI, cheap to store, and read directly by the
  decide synthesis.

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
