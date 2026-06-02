## Expected outcome: Deny (round 0) → Approve (round 1, Plan Internal Appeal)

### Round 0 — `(Medicaid, 0)` initial coverage determination

**Ruling:** Deny

**Reasoning:**

The arbiter is expected to rule Deny at round 0. The round-0 packet contains
three references: an FDA-label-indication slice confirming dulaglutide's on-label
type 2 diabetes indication (reference index 0), a formulary-entry slice quoting
the Centene Medi-Cal PA criteria for GLP-1 agonists (reference index 1), and a
price-benchmark slice (reference index 2).

The formulary-entry slice (reference index 1) makes all three PA criteria explicit:
1. Diagnosis of type 2 diabetes mellitus — met; documented in the clinical note.
2. A1c ≥7.5% on maximum-tolerated metformin — met; most recent A1c is 7.6%,
   documented within six weeks of the request date.
3. Documented prior trial of an SGLT2 inhibitor for ≥90 consecutive days OR a
   documented contraindication or intolerance to all SGLT2 inhibitors —
   **NOT MET; no such documentation is present in the round-0 packet.**

The round-0 packet does not include SGLT2-inhibitor trial documentation or any
documentation of a contraindication or intolerance. Per the PA criteria slice, requests
that omit this documentation must be denied as incomplete. The arbiter denies on this
basis.

**Cited references:** [0, 1]  
**Used reference indices:** [0, 1]  
**Denial reason:** "PA criteria criterion 3 not satisfied — missing SGLT2-inhibitor
trial documentation (≥90-day course) or contraindication/intolerance documentation."  
**Stage after ruling:** `(Medicaid, 0)` → `Denied`; Plan Internal Appeal
`(Medicaid, 1)` becomes `current` per R14a sequencing.

---

### Round 1 — `(Medicaid, 1)` Plan Internal Appeal

**Ruling:** Approve

**Appeal arc (what the round-1 packet adds):**

The provider files a Plan Internal Appeal within the 60-day federal-floor window
(42 CFR §438.402). The appeal packet supplements the round-0 evidence by adding
the missing criterion-3 documentation — specifically, a chart extract confirming
that Patient C trialed empagliflozin 10 mg daily for 96 consecutive days
(approximately 14 weeks), discontinued due to recurrent urinary tract infections
documented across two office visits. This constitutes a documented intolerance to
an SGLT2 inhibitor.

The round-1 appeal packet therefore contains:
- Reference index 0 (unchanged): FDA-label-indication slice for dulaglutide.
- Reference index 1 (unchanged): Centene Medi-Cal formulary-entry PA criteria slice.
- Reference index 2 (unchanged): price-benchmark slice.
- Reference index 3 (new): clinical chart extract documenting empagliflozin 10 mg
  daily, 96-day trial, discontinued for recurrent urinary tract infections
  (slice.kind: `guideline-recommendation`, locator pointing to the clinic's
  documented trial dates and discontinuation note).

With all three PA criteria now demonstrated — (1) T2DM diagnosis, (2) A1c 7.6%
on max-tolerated metformin, (3) documented SGLT2-inhibitor intolerance — the
arbiter is expected to rule Approve.

**Cited references (round 1):** [0, 1, 3]  
**Used reference indices:** [0, 1, 3]  
**Settlement amount (R24 cost-band):** settled within the NADAC/Cost Plus band
anchored to the price-benchmark reference (index 2). Band upper bound:
≈ $748 per pen × 4 pens = ≈ $2,993 for the 28-day supply; arbiter resolves the
exact band at ruling time.  
**Stage after ruling:** `(Medicaid, 1)` → `Approved` → `Settled`;
External Medical Review / State Fair Hearing `(Medicaid, 2)` renders as `skipped`
since the round-1 ruling was Approve.

---

### Appeal-ladder stages rendered in the UI (R15)

| Round | On-chain key | UI stage label |
|-------|-------------|---------------|
| 0 | `(Medicaid, 0)` | Initial Coverage Determination |
| 1 | `(Medicaid, 1)` | Plan Internal Appeal |
| 2 | `(Medicaid, 2)` | External Medical Review / State Fair Hearing *(skipped)* |

### Regression-detection notes

This case exercises SPEC-0004 §2.4 R14a (sequencing predicate: round 1 requires round 0
ruled Deny) and the §2.5 R17 two-round Medicaid MCO ladder. An arbiter-model swap that
produces Approve at round 0 — bypassing the SGLT2-inhibitor gap — is a regression
signal. A swap that denies at round 1 despite the added empagliflozin intolerance
documentation is also a regression signal.
