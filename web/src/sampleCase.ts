/**
 * The synthetic demo case, mirrored from `demo-data/sample-case.md` so the
 * Create view's "Load sample case" button can prefill the form, and the Detail
 * view can load the compliant / non-compliant policy text (SPEC-0001 §4).
 *
 * SYNTHETIC — no PHI. The justification text only ever goes into the off-chain
 * content store; only its hash is committed on-chain (R3/R4). The benchmark cap
 * mirrors `demo-data/price-benchmarks.md`; the policy snippets mirror
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
  /** A public-evidence ref/URL (openFDA / DailyMed label). */
  readonly evidenceRef: string;
  /** Compliant Part D exception-criteria policy snippet (off-chain → hash). */
  readonly policyText: string;
  /** A policy clause that contradicts the FDA label — drives PolicyInvalidated (R6b). */
  readonly nonCompliantPolicyText: string;
  /** A public policy URL/ref recorded alongside the policy hash. */
  readonly policyRef: string;
  /** The NADAC / Mark Cuban Cost Plus benchmark cap (R6a/R10). */
  readonly benchmarkCap: string;
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
  policyRef:
    "https://example-plan.test/part-d/exception-criteria/adalimumab (synthetic published policy)",
  // Benchmark cap from NADAC / Mark Cuban Cost Plus refs (price-benchmarks.md).
  // Lower than the requested 5200 so an approve ruling visibly shows min().
  benchmarkCap: "4200",
};
