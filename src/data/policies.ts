/**
 * SPEC-0005 R14 — curated insurance-policy library for the insurer's engage flow.
 *
 * The insurer picks from this library (or composes a custom policy per R15) at
 * engage time. Each policy is a fully synthetic, demo-purposed document with
 * the structural shape the protocol needs: a stable id, a human label, a
 * 1-line summary, and an ordered list of clauses. Each clause carries:
 *   - `id` — stable clause identifier (e.g. "PD-ADA-09").
 *   - `text` — the clause body, single-spaced.
 *   - `voids?` — true when the clause is the demo "bad" clause that R23's
 *     on-label-policy-void path is expected to flag (amendment 0005). The
 *     arbiter's R23 logic consumes this flag to populate
 *     `policyVoidedClauseIndices` on the Ruled event.
 *
 * **PHI-free by construction**: no patient identifiers, no provider names,
 * no real plan IDs. Plan names are clearly synthetic ("Demo Health Plan",
 * "example-plan.test", etc.).
 *
 * The four curated policies span the three payer lines + the demo's
 * known-bad policy used in Scenario C2.
 */
import { PayerLine } from "../protocol/ladders.js";

/** A single clause inside a curated policy. */
export interface PolicyClause {
  readonly id: string;
  readonly text: string;
  /** When true, R23's policy-void path expects to flag this clause. */
  readonly voids?: true;
}

/** A curated policy the insurer can pick from the library. */
export interface CuratedPolicy {
  readonly id: string;
  readonly name: string;
  readonly payerLine: PayerLine;
  readonly summary: string;
  readonly clauses: ReadonlyArray<PolicyClause>;
}

export const POLICY_LIBRARY: ReadonlyArray<CuratedPolicy> = Object.freeze([
  // ── 1. Part D formulary (demo-canonical compliant) ──────────────────────
  Object.freeze({
    id: "partd-formulary-adalimumab",
    name: "Part D formulary — Adalimumab (Specialty Tier 5)",
    payerLine: PayerLine.PartD,
    summary:
      "Medicare Part D exception-criteria for adalimumab with documented step-therapy + safety screening.",
    clauses: [
      Object.freeze({
        id: "PD-ADA-01",
        text:
          "Covered with prior authorization for moderate-to-severe chronic plaque psoriasis when (a) BSA >= 10% OR PASI >= 12, AND (b) trial-and-failure or intolerance of >= 1 preferred conventional systemic therapy (e.g. methotrexate), AND (c) no active serious infection and latent TB screening performed.",
      }),
      Object.freeze({
        id: "PD-ADA-02",
        text:
          "Step-therapy exception applies when a preferred agent is contraindicated or not tolerated, with documentation.",
      }),
    ],
  }),

  // ── 2. Commercial PA-required (demo-canonical compliant) ────────────────
  Object.freeze({
    id: "commercial-pa-etanercept",
    name: "Commercial PA-required — Etanercept (Specialty)",
    payerLine: PayerLine.Commercial,
    summary:
      "Demo Commercial plan prior-authorization criteria for etanercept with rheumatology-led documentation.",
    clauses: [
      Object.freeze({
        id: "COM-ETA-01",
        text:
          "Prior authorization required for biologic DMARDs in rheumatoid arthritis. Requires rheumatologist consult note, baseline labs (CBC, LFT, TB screen), and trial-and-failure of methotrexate at full effective dose for >= 3 months unless contraindicated.",
      }),
      Object.freeze({
        id: "COM-ETA-02",
        text:
          "Renewal at 6 months requires documented DAS28 improvement or comparable PRO; non-response shifts the patient to a tier-3 alternative.",
      }),
    ],
  }),

  // ── 3. Medicaid step-therapy (demo-canonical compliant) ─────────────────
  Object.freeze({
    id: "medicaid-step-dulaglutide",
    name: "Medicaid step-therapy — Dulaglutide (GLP-1)",
    payerLine: PayerLine.Medicaid,
    summary:
      "Demo Medicaid MCO step-therapy for GLP-1s in type-2 diabetes with required SGLT2-inhibitor trial.",
    clauses: [
      Object.freeze({
        id: "MED-DUL-01",
        text:
          "GLP-1 receptor agonists covered for T2DM with HbA1c >= 7.5% after a documented >= 3-month trial of metformin AT EFFECTIVE DOSE, plus a documented >= 8-week trial of an SGLT2 inhibitor (e.g. empagliflozin or dapagliflozin) unless contraindicated.",
      }),
      Object.freeze({
        id: "MED-DUL-02",
        text:
          "Step-therapy exception applies when SGLT2 inhibitors are contraindicated (e.g. recurrent genitourinary infection, prior DKA, or eGFR < 30) with explicit documentation.",
      }),
    ],
  }),

  // ── 4. Demo's known-bad policy (R23 flags the voids:true clause) ────────
  Object.freeze({
    id: "demo-bad-adalimumab-noncompliant",
    name: "DEMO ONLY — Non-compliant Adalimumab clause (R23 trigger)",
    payerLine: PayerLine.PartD,
    summary:
      "Synthetic non-compliant Part D policy used by Scenario C2 to demonstrate the R23 on-label-policy-void path (amendment 0005).",
    clauses: [
      Object.freeze({
        id: "PD-ADA-09",
        text:
          "Adalimumab is NOT covered for plaque psoriasis under any circumstances, and step-therapy exceptions do not apply to this indication. This clause contradicts the FDA-approved label for adalimumab in moderate-to-severe chronic plaque psoriasis; the arbiter must flag and void it.",
        voids: true,
      }),
    ],
  }),
]);

/** Look up a curated policy by its stable id. */
export function getCuratedPolicy(id: string): CuratedPolicy | undefined {
  return POLICY_LIBRARY.find((p) => p.id === id);
}

/** All curated policies that target a given payer line. */
export function policiesForLine(line: PayerLine): readonly CuratedPolicy[] {
  return POLICY_LIBRARY.filter((p) => p.payerLine === line);
}
