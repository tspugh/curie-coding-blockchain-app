## Expected outcome: Approve

**Ruling:** Approve (round 0, `payerLine: PartD`)

**Reasoning:**

The arbiter is expected to approve this prior-authorization request at round 0.
Adalimumab appears on the SilverScript Part D formulary (S5810-001, effective
2026-01-01) as a Tier 5 Specialty drug covered with prior authorization and
step-therapy restrictions (reference index 1 — formulary-entry slice).

The step-therapy requirement is satisfied: the packet documents two failed
conventional DMARD trials (methotrexate, discontinued for hepatotoxicity;
leflunomide, discontinued for peripheral neuropathy) and a medical contraindication
to the third option (sulfasalazine — sulfa allergy). The FDA label confirms
rheumatoid arthritis as an on-label indication for adalimumab (reference index 0 —
fda-label-indication slice). No FDA-label contraindications apply.

Settlement amount is clamped to `min(requestedAmount, costPlusUnitPrice × quantity)`
= `min(5200, 2100 × 2)` = **4200** per the R24 cost-band rule (reference index 2 —
price-benchmark slice).

**Used reference indices:** [0, 1, 2]  
**No policy-void clause:** not applicable (compliant formulary policy).  
**Stage after ruling:** `(PartD, 0)` terminal — approved; rounds 1–3 render as `skipped`.
