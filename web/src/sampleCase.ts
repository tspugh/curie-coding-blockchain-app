/**
 * The synthetic demo case, mirrored from `demo-data/sample-case.md` so the
 * Create view's "Load sample case" button can prefill the form (SPEC-0001 §4).
 *
 * SYNTHETIC — no PHI. The note text only ever goes into the off-chain content
 * store; only its hash is committed on-chain (R3/R4). The band matches the
 * benchmark in `demo-data/formulary-part-d.{json,html}`.
 */
export interface SampleCase {
  readonly note: string;
  readonly drug: string;
  readonly priceFloor: string;
  readonly priceCeil: string;
  /** Suggested positions / settlement to walk the flow (see the markdown). */
  readonly providerPosition: string;
  readonly payerPosition: string;
  readonly settlement: string;
}

export const SAMPLE_CASE: SampleCase = {
  note: [
    "46-year-old patient with moderate-to-severe chronic plaque psoriasis (BSA ~12%,",
    "PASI 14). Documented inadequate response to an 8-week trial of methotrexate",
    "(intolerance: transaminitis) and to topical high-potency corticosteroids.",
    "No active infection; latent TB screen negative; hepatitis panel negative.",
    "Prescriber requests coverage of adalimumab per step-therapy exception:",
    "preferred conventional systemic therapy tried and failed. Requested as a",
    "formulary coverage exception with prior authorization.",
  ].join(" "),
  drug: "Adalimumab",
  priceFloor: "2800",
  priceCeil: "5200",
  providerPosition: "5000",
  payerPosition: "3000",
  settlement: "3600",
};
