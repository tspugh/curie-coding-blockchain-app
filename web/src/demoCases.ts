/**
 * Curated demo cases for the Create view's "Load a demo" dropdown.
 *
 * Each case is a synthetic, PHI-free drug × indication scenario. Selecting one populates
 * the Create form; the `drug` resolves through `drugEvidenceMap` (brand → canonical) to
 * auto-fill the evidence URL + prompt hint. Amounts are small symbolic wei values so the
 * demo is cheap to run on testnet.
 *
 * Every `drug` MUST resolve in `drugEvidenceMap` (asserted in demoCases.test.ts) so the
 * dropdown can never offer an option that fails to auto-fill.
 */
// Import the lib via the built dist (the `@lib` alias target) so this module is resolvable
// by the node/tsx test runner — which does not honor the Vite alias (see attestations.ts).
import { PayerLine } from "../../dist/index.js";

export interface DemoCase {
  readonly id: string;
  /** Dropdown label, e.g. "Adalimumab (Humira) — plaque psoriasis". */
  readonly label: string;
  /** Drug name passed to applyDrugLookup (a brand name resolves via drugEvidenceMap). */
  readonly drug: string;
  /** De-identified clinical justification (off-chain → hash only). */
  readonly justification: string;
  readonly payerLine: PayerLine;
  readonly requestedAmount: string;
  readonly quantity: string;
  readonly daysSupply: string;
}

const AMT = "5200";

export const DEMO_CASES: ReadonlyArray<DemoCase> = Object.freeze([
  {
    id: "adalimumab-psoriasis",
    label: "Adalimumab (Humira) — plaque psoriasis",
    drug: "Humira",
    justification:
      "Adult with moderate-to-severe chronic plaque psoriasis; inadequate response to topical therapy and one conventional systemic agent. Requesting adalimumab per FDA-approved indication.",
    payerLine: PayerLine.PartD,
    requestedAmount: AMT,
    quantity: "2",
    daysSupply: "28",
  },
  {
    id: "semaglutide-t2dm",
    label: "Semaglutide (Ozempic) — type 2 diabetes",
    drug: "Ozempic",
    justification:
      "Adult with type 2 diabetes, HbA1c above goal on metformin. Requesting semaglutide per FDA-approved indication for glycemic control.",
    payerLine: PayerLine.Commercial,
    requestedAmount: AMT,
    quantity: "1",
    daysSupply: "28",
  },
  {
    id: "ustekinumab-crohns",
    label: "Ustekinumab (Stelara) — Crohn's disease",
    drug: "Stelara",
    justification:
      "Adult with moderately-to-severely active Crohn's disease; inadequate response to conventional therapy. Requesting ustekinumab per FDA-approved indication.",
    payerLine: PayerLine.Commercial,
    requestedAmount: AMT,
    quantity: "1",
    daysSupply: "56",
  },
  {
    id: "lecanemab-alzheimers",
    label: "Lecanemab (Leqembi) — early Alzheimer's",
    drug: "Leqembi",
    justification:
      "Patient with mild cognitive impairment / mild dementia due to Alzheimer's disease, amyloid-confirmed. Requesting lecanemab per FDA-approved indication.",
    payerLine: PayerLine.PartD,
    requestedAmount: AMT,
    quantity: "1",
    daysSupply: "28",
  },
  {
    id: "tirzepatide-t2dm",
    label: "Tirzepatide (Mounjaro) — type 2 diabetes",
    drug: "Mounjaro",
    justification:
      "Adult with type 2 diabetes inadequately controlled on first-line therapy. Requesting tirzepatide per FDA-approved indication for glycemic control.",
    payerLine: PayerLine.Commercial,
    requestedAmount: AMT,
    quantity: "1",
    daysSupply: "28",
  },
  {
    id: "dupilumab-derm",
    label: "Dupilumab (Dupixent) — atopic dermatitis",
    drug: "Dupixent",
    justification:
      "Adult with moderate-to-severe atopic dermatitis inadequately controlled with topical prescription therapies. Requesting dupilumab per FDA-approved indication.",
    payerLine: PayerLine.Commercial,
    requestedAmount: AMT,
    quantity: "2",
    daysSupply: "28",
  },
]);

export function getDemoCase(id: string): DemoCase | undefined {
  return DEMO_CASES.find((c) => c.id === id);
}
