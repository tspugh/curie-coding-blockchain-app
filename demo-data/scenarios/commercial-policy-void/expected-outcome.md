## Expected outcome: Approve (R23 policy-void escape hatch)

**Ruling:** Approve (round 0, `payerLine: Commercial`) with
`policyVoidedClauseIndices: [1]`.

**Reasoning:**

The arbiter is expected to rule Approve at round 0 via SPEC-0004 §2.6 R23 — the
on-label policy-void escape hatch. Per amendment
[`0005-policy-void-r23-supersedes-r6b.md`](../../../docs/amendments/0005-policy-void-r23-supersedes-r6b.md),
R23 supersedes SPEC-0001 R6b for the on-label policy-void case: instead of
routing the contract to terminal `PolicyInvalidated`, the arbiter approves the
request and emits the voided clause indices in the ruling payload.

The provider's packet contains an FDA-label-indication slice (reference index 0)
confirming that etanercept carries an FDA-approved indication for active
psoriatic arthritis without any imaging prerequisite — the label requires only
that the patient has an inadequate response to prior DMARD therapy.

The insurer's attached policy (Aetna Clinical Policy Bulletin 0792, reference
index 1) requires documentation of peripheral joint involvement **confirmed by
qualifying imaging** (erosive changes on plain radiographs, or bone marrow edema
on MRI) as a condition of medical necessity for etanercept in psoriatic
arthritis. The clinical note for Patient B records only non-erosive soft-tissue
swelling on plain radiographs and no MRI, which the policy deems insufficient.

The policy clause is at parse-level odds with the FDA-approved indication: the
FDA label grants no imaging prerequisite for psoriatic arthritis — it requires
only active disease and inadequate prior therapy, both of which are documented
here. The policy clause adds a gating criterion that contradicts the publicly
established standard for on-label use.

Per SPEC-0004 §2.6 R23, when a relied-on policy clause contradicts an FDA-label
slice the arbiter accepts, the arbiter MUST rule `Approve` and emit
`policyVoidedClauseIndices: number[]` identifying the voided clause. The
timeline renders the annotation as `policy clause 1 — VOIDED by FDA label §1
INDICATIONS AND USAGE` (R12 provenance).

**Cited references:**
- Reference index 0 (`fda-label-indication`): etanercept DailyMed label —
  psoriatic arthritis indication, no imaging prerequisite.
- Reference index 1 (`guideline-recommendation`): Aetna CPB 0792 — payer
  guideline whose imaging-confirmation requirement contradicts the FDA-label
  indication standard. The R23 detection consumes this slice's `text` against
  the FDA-label slice's `text` to identify the contradiction.

**Used reference indices:** [0, 1]
**Policy-voided clause indices:** [1]
**Settlement amount (R24 cost-band):** `min(requestedAmount, R24_band_upper)`
where `R24_band_upper` is derived from the NADAC + Cost Plus benchmark inputs
the arbiter pulls at submission time (for this fixture, the band is the
price-benchmark reference index 2; the demo arbiter will compute the exact
amount at ruling time).
**Stage after ruling:** `(Commercial, 0)` settles to `Approved` → `Settled`;
Internal Appeal (Commercial, 1) and External Review (Commercial, 2) render as
`skipped` since the round-0 ruling was Approve.
