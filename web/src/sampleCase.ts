/**
 * The synthetic demo case, mirrored from `demo-data/sample-case.md` so the
 * Create view's "Load sample case" button can prefill the form, and the Detail
 * view can load the compliant / non-compliant policy text (SPEC-0001 §4).
 *
 * SYNTHETIC — no PHI. The justification text only ever goes into the off-chain
 * content store; only its hash is committed on-chain (R3/R4). The price refs
 * mirror `demo-data/price-benchmarks.md` (per-unit Cost Plus + NADAC — the
 * 2026-05-27 SPEC-0001 cap-resolution); the policy snippets mirror
 * `demo-data/formulary-part-d.{json,html}` (compliant) and
 * `demo-data/policy-noncompliant.md` (the clause that contradicts the FDA label,
 * to demo PolicyInvalidated — R6b).
 */
export interface SampleCase {
  /** De-identified clinical justification note (off-chain → hash only). */
  readonly justification: string;
  /** Drug name (→ opaque bytes32 drugRef via hashContent). */
  readonly drug: string;
  /** The provider's billed / requested amount (R2). */
  readonly requestedAmount: string;
  /** Dispensed units — DRIVES the deterministic cap; integer > 0 (R2/R6a). */
  readonly quantity: string;
  /** Expected days supply — necessity context only, NOT a price input (R2). */
  readonly daysSupply: string;
  /** A public-evidence ref/URL (openFDA / DailyMed label). */
  readonly evidenceRef: string;
  /** Compliant Part D exception-criteria policy snippet (off-chain → hash). */
  readonly policyText: string;
  /** A policy clause that contradicts the FDA label — drives PolicyInvalidated (R6b). */
  readonly nonCompliantPolicyText: string;
  /** The offending clause id flagged in the non-compliant policy (R6b gotcha). */
  readonly nonCompliantClauseId: string;
  /** A public policy URL/ref recorded alongside the policy hash. */
  readonly policyRef: string;
  /** Mark Cuban Cost Plus PER-UNIT retail price — cap basis (cap = ×quantity) (R6a/R10). */
  readonly costPlusUnitPrice: string;
  /** NADAC PER-UNIT acquisition-cost floor reference (never the cap) (R6a/R10). */
  readonly nadacUnitPrice: string;
  /**
   * Demo additional evidence the provider submits when the AI requests more information.
   * Pre-fills the evidence textarea in the EvidenceRequested state.
   */
  readonly additionalEvidenceRef: string;
}

export const SAMPLE_CASE: SampleCase = {
  justification: [
    "46-year-old patient with moderate-to-severe chronic plaque psoriasis (BSA ~12%,",
    "PASI 14). Documented inadequate response to an 8-week trial of methotrexate",
    "(intolerance: transaminitis) and to topical high-potency corticosteroids.",
    "No active infection; latent TB screen negative; hepatitis panel negative.",
    "Prescriber requests coverage of adalimumab per step-therapy exception:",
    "preferred conventional systemic therapy tried and failed. Filed as a Part D",
    "formulary coverage exception with prior authorization.",
  ].join(" "),
  drug: "Adalimumab (RxNorm 1366724 / NDC 00074-3799-02)",
  requestedAmount: "5200",
  // 2 prefilled pens — the cap driver (NDC-pinned dispensed units, R2/R6a).
  quantity: "2",
  // 28-day supply — necessity-utilization context only, NOT a price input (R2).
  daysSupply: "28",
  evidenceRef:
    "https://api.fda.gov/drug/label.json?search=openfda.brand_name:HUMIRA — indication: moderate-to-severe chronic plaque psoriasis",
  policyText: [
    "Part D exception-criteria policy — Adalimumab (Specialty Tier 5).",
    "Clause PD-ADA-01: Covered with prior authorization for moderate-to-severe",
    "chronic plaque psoriasis when (a) BSA >= 10% OR PASI >= 12, AND (b) trial-and-",
    "failure or intolerance of >= 1 preferred conventional systemic therapy",
    "(e.g. methotrexate), AND (c) no active serious infection and latent TB",
    "screening performed. Step-therapy exception PD-ADA-02 applies when a preferred",
    "agent is contraindicated or not tolerated, with documentation.",
  ].join(" "),
  nonCompliantPolicyText: [
    "Part D exception-criteria policy — Adalimumab (Specialty Tier 5).",
    "Clause PD-ADA-09 (NON-COMPLIANT): Adalimumab is NOT covered for plaque",
    "psoriasis under any circumstances, and step-therapy exceptions do not apply",
    "to this indication. — This clause contradicts the FDA-approved label",
    "indication for adalimumab in moderate-to-severe chronic plaque psoriasis",
    "(openFDA HUMIRA label), so the arbiter must flag it and void the contract.",
  ].join(" "),
  nonCompliantClauseId: "PD-ADA-09",
  policyRef:
    "https://example-plan.test/part-d/exception-criteria/adalimumab (synthetic published policy)",
  // Per-unit price refs (price-benchmarks.md). Cost Plus cap = 2100 × quantity 2 =
  // 4200 (< requested 5200) so an approve ruling visibly shows the cap binding.
  // NADAC is the acquisition-cost FLOOR reference only (never the cap).
  costPlusUnitPrice: "2100",
  nadacUnitPrice: "2000",
  additionalEvidenceRef: [
    "https://pubmed.ncbi.nlm.nih.gov/16952715/ — REVEAL Phase 3 RCT:",
    "adalimumab achieved PASI 75 in 71% of patients at week 16 vs 7% placebo (p<0.001)",
    "in adults with moderate-to-severe chronic plaque psoriasis.",
    "Step-therapy exception criteria met: prior methotrexate failure documented",
    "(intolerance: transaminitis). Patient meets FDA-approved indication.",
  ].join(" "),
};
