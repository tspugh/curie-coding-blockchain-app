/**
 * Curated demo cases for the Create view's "Load a demo" dropdown.
 *
 * Each case is a synthetic, PHI-free drug × indication scenario. Selecting one populates
 * the Create form; the `drug` resolves through `drugEvidenceMap` (brand → canonical) to
 * auto-fill the evidence URL + prompt hint. Amounts are small symbolic STT decimals so the
 * demo is cheap to run on testnet (the Create form parses them via ethers parseEther).
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
  /** Amount of STT requested (a decimal string parsed via ethers parseEther). */
  readonly requestedAmount: string;
  readonly quantity: string;
  readonly daysSupply: string;
}

export const DEMO_CASES: ReadonlyArray<DemoCase> = Object.freeze([
  {
    id: "adalimumab-psoriasis",
    label: "Adalimumab (Humira) — plaque psoriasis",
    drug: "Adalimumab (Humira)",
    justification:
      "Adult with moderate-to-severe chronic plaque psoriasis; inadequate response to topical therapy and one conventional systemic agent. Requesting adalimumab per FDA-approved indication.",
    payerLine: PayerLine.PartD,
    requestedAmount: "0.005",
    quantity: "2",
    daysSupply: "28",
  },
  {
    // SPEC-0007 §3.7 off-label worked example. Paired with the
    // `commercial-pa-bupropion-adhd` policy. Starts on the FDA WELLBUTRIN source, which does
    // NOT list ADHD → expected DENY (off-label). The approve path is an appeal with a
    // compendia source (SPEC-0010). PayerLine Commercial matches the bupropion policy.
    id: "bupropion-adhd",
    label: "Bupropion (Wellbutrin) — ADHD (off-label, expect Deny)",
    drug: "Bupropion (Wellbutrin)",
    justification:
      "Adult with attention-deficit/hyperactivity disorder (ADHD) inadequately controlled on first-line options; clinician requests bupropion off-label. Off-label use; appeal with compendia support if denied.",
    payerLine: PayerLine.Commercial,
    requestedAmount: "0.001",
    quantity: "1",
    daysSupply: "30",
  },
]);

export function getDemoCase(id: string): DemoCase | undefined {
  return DEMO_CASES.find((c) => c.id === id);
}
