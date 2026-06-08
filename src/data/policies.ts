/**
 * SPEC-0005 R14 — curated insurance-policy library for the insurer's engage flow.
 * SPEC-0007 R1/R2/R5 — clause typing (public / attested) + Attestation interface.
 *
 * The insurer picks from this library (or composes a custom policy per R15) at
 * engage time. Each policy is a fully synthetic, demo-purposed document with
 * the structural shape the protocol needs: a stable id, a human label, a
 * 1-line summary, and an ordered list of clauses. Each clause carries:
 *   - `id` — stable clause identifier (e.g. "PD-ADA-09").
 *   - `text` — the clause body, single-spaced.
 *   - `type` — "public" (agent-adjudicated from a named authoritative source)
 *     or "attested" (provider supplies a de-identified boolean; agent records
 *     but cannot independently verify).
 *   - `check?` — present iff type === "public": { kind, param, sourceUrl }.
 *   - `voids?` — true when the clause is the demo "bad" clause that R23's
 *     on-label-policy-void path is expected to flag (amendment 0005). The
 *     arbiter's R23 logic consumes this flag to populate
 *     `policyVoidedClauseIndices` on the Ruled event.
 *
 * **PHI-free by construction**: no patient identifiers, no provider names,
 * no real plan IDs. Plan names are clearly synthetic ("Demo Health Plan",
 * "example-plan.test", etc.).
 *
 * The curated policies span the three payer lines + the demo's known-bad
 * policy used in Scenario C2, plus the SPEC-0007 worked examples (§3.6
 * plaque-psoriasis Commercial PA, §3.7 bupropion×ADHD off-label).
 */
import { PayerLine } from "../protocol/ladders.js";

// ---------------------------------------------------------------------------
// Source-URL constants (SPEC-0007 §3.5 / §3.7)
// ---------------------------------------------------------------------------

/** openFDA HUMIRA label endpoint — §3.5 plaque-psoriasis indication source. */
export const OPENFDA_HUMIRA_URL =
  "https://api.fda.gov/drug/label.json?search=openfda.brand_name:HUMIRA&limit=1";

/** openFDA WELLBUTRIN label endpoint — §3.7 bupropion×ADHD deny-path source. */
export const OPENFDA_WELLBUTRIN_URL =
  "https://api.fda.gov/drug/label.json?search=openfda.brand_name:WELLBUTRIN&limit=1";

/**
 * §3.7 bupropion×ADHD APPROVE-path (appeal) source — NCBI E-utilities `efetch` for the
 * Cochrane systematic review PMID 28965364 ("Antidepressants for ADHD in adults"). Returns
 * a clean ~5 KB structured abstract (the FDA-JSON of the literature) whose CONCLUSIONS state
 * bupropion's efficacy for ADHD — recognized compendia/guideline-level SUPPORT (not merely
 * "off-label use"), so the broadened rubric (R4) flips the appeal to Approve. Reputable +
 * PMID-anchored + scraper-friendly. See docs/research/evidence-source-provenance.md.
 */
export const COCHRANE_BUPROPION_ADHD_URL =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=28965364&rettype=abstract&retmode=text";

// ---------------------------------------------------------------------------
// Types (SPEC-0007 §3.1)
// ---------------------------------------------------------------------------

export type ClauseType = "public" | "attested";
export type PublicCheckKind = "indication" | "dosing";

/** A single clause inside a curated policy. */
export interface PolicyClause {
  readonly id: string;
  readonly text: string;
  /** SPEC-0007 R1 — every clause carries a type. */
  readonly type: ClauseType;
  /**
   * SPEC-0007 R2 — present iff type === "public".
   * Names the check kind, the parameter (diagnosis or "qty/days"), and an
   * authoritative public source URL for this clause.
   */
  readonly check?: {
    readonly kind: PublicCheckKind;
    readonly param: string;
    readonly sourceUrl: string;
  };
  /** When true, R23's policy-void path expects to flag this clause. */
  readonly voids?: true;
}

/**
 * SPEC-0007 R5 — Provider-supplied, de-identified attestation.
 * NO patient identifiers, NO free clinical narrative, NO PHI.
 * The optional evidenceUrl is a link to de-identified supporting material
 * (the attested-side equivalent of a public clause's sourceUrl).
 */
export interface Attestation {
  readonly clauseId: string;
  readonly attested: boolean;
  /**
   * Optional link to DE-IDENTIFIED supporting evidence.
   * On-chain stores only the URL or its keccak hash, never content.
   * Omit if the support cannot be de-identified.
   */
  readonly evidenceUrl?: string;
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
        type: "public" as ClauseType,
        text:
          "Covered with prior authorization for moderate-to-severe chronic plaque psoriasis when (a) BSA >= 10% OR PASI >= 12, AND (b) trial-and-failure or intolerance of >= 1 preferred conventional systemic therapy (e.g. methotrexate), AND (c) no active serious infection and latent TB screening performed.",
        check: {
          kind: "indication" as PublicCheckKind,
          param: "plaque psoriasis",
          sourceUrl: OPENFDA_HUMIRA_URL,
        },
      }),
      Object.freeze({
        id: "PD-ADA-02",
        type: "attested" as ClauseType,
        text:
          "Step-therapy exception applies when a preferred agent is contraindicated or not tolerated, with documentation.",
      }),
    ],
  }),

  // NOTE: the former Commercial-Etanercept (#2) and Medicaid-Dulaglutide (#3) policies were
  // removed (2026-06-07) — they had no paired evidence/demo case (no drugEvidenceMap entry,
  // not in the Create demo dropdown), so the demo could never run them end-to-end. The
  // library now holds only drugs with a coherent policy + evidence pairing: adalimumab
  // (the §3.6 Commercial + Part D worked example, + the demo-bad clause) and bupropion
  // (the §3.7 off-label example). See demoCases.ts / drugEvidenceMap.ts.

  // ── Demo's known-bad policy (R23 flags the voids:true clause) ───────────
  Object.freeze({
    id: "demo-bad-adalimumab-noncompliant",
    name: "Demo only — Non-compliant adalimumab clause",
    payerLine: PayerLine.PartD,
    summary:
      "A sample non-compliant Part D policy whose clause contradicts the FDA-approved label, so the AI flags it and voids the policy.",
    clauses: [
      Object.freeze({
        id: "PD-ADA-09",
        type: "public" as ClauseType,
        text:
          "Adalimumab is NOT covered for plaque psoriasis under any circumstances, and step-therapy exceptions do not apply to this indication. This clause contradicts the FDA-approved label for adalimumab in moderate-to-severe chronic plaque psoriasis; the arbiter must flag and void it.",
        check: {
          kind: "indication" as PublicCheckKind,
          param: "plaque psoriasis",
          sourceUrl: OPENFDA_HUMIRA_URL,
        },
        voids: true,
      }),
    ],
  }),

  // ── 5. SPEC-0007 §3.6 — Specialty biologic plaque-psoriasis Commercial PA ──
  Object.freeze({
    id: "commercial-pa-adalimumab-plaque-psoriasis",
    name: "Specialty biologic — moderate-to-severe plaque psoriasis (Commercial PA)",
    payerLine: PayerLine.Commercial,
    summary:
      "Commercial prior-authorization policy for adalimumab in moderate-to-severe plaque psoriasis: two public clauses (FDA indication + labeled dosing) and two clauses the provider attests to (step-therapy trial + TB screening).",
    clauses: [
      Object.freeze({
        id: "PP-COM-01",
        type: "public" as ClauseType,
        text:
          "The drug is FDA-approved or compendia-supported for moderate-to-severe plaque psoriasis, as established by the authoritative label source.",
        check: {
          kind: "indication" as PublicCheckKind,
          param: "plaque psoriasis",
          sourceUrl: OPENFDA_HUMIRA_URL,
        },
      }),
      Object.freeze({
        id: "PP-COM-02",
        type: "public" as ClauseType,
        text:
          "Requested quantity is within FDA-labeled dosing for adalimumab in plaque psoriasis (no more than 2 pens per 28-day supply for maintenance dosing).",
        check: {
          kind: "dosing" as PublicCheckKind,
          param: "2 pens / 28 days",
          sourceUrl: OPENFDA_HUMIRA_URL,
        },
      }),
      Object.freeze({
        id: "PP-COM-03",
        type: "attested" as ClauseType,
        text:
          "Trial-and-failure or documented contraindication to at least one conventional systemic therapy (e.g. methotrexate, cyclosporine, or acitretin) prior to biologic initiation.",
      }),
      Object.freeze({
        id: "PP-COM-04",
        type: "attested" as ClauseType,
        text:
          "TB screening (TST or IGRA) performed prior to initiation; no active serious infection present (HUMIRA boxed-warning criterion satisfied).",
      }),
    ],
  }),

  // ── 6. SPEC-0007 §3.7 — Non-stimulant for ADHD (Commercial PA) ──────────
  Object.freeze({
    id: "commercial-pa-bupropion-adhd",
    name: "Non-stimulant for ADHD (Commercial PA) — bupropion off-label",
    payerLine: PayerLine.Commercial,
    summary:
      "Commercial prior-authorization policy for bupropion in ADHD — an off-label use. On the FDA label, ADHD is not an approved indication, so the initial review denies. An appeal that cites a recognized clinical-evidence source supporting bupropion for ADHD can flip the decision to approve.",
    clauses: [
      Object.freeze({
        id: "ADHD-BUP-01",
        type: "public" as ClauseType,
        text:
          "The drug is FDA-approved or compendia-supported for attention-deficit/hyperactivity disorder (ADHD). On initial review, the openFDA WELLBUTRIN label lists only major depressive disorder and seasonal affective disorder — not ADHD — resulting in a deny; appeal with a recognized compendia or guideline source supporting the off-label use satisfies this clause.",
        check: {
          kind: "indication" as PublicCheckKind,
          param: "ADHD",
          sourceUrl: OPENFDA_WELLBUTRIN_URL,
        },
      }),
      Object.freeze({
        id: "ADHD-BUP-02",
        type: "public" as ClauseType,
        text:
          "Requested quantity is within labeled dosing for bupropion (no more than 450 mg per day, consistent with labeled maximum for any approved indication).",
        check: {
          kind: "dosing" as PublicCheckKind,
          param: "450 mg / day",
          sourceUrl: OPENFDA_WELLBUTRIN_URL,
        },
      }),
      Object.freeze({
        id: "ADHD-BUP-03",
        type: "attested" as ClauseType,
        text:
          "Trial-and-failure or documented contraindication to a preferred stimulant medication (e.g. amphetamine salts or methylphenidate) prior to non-stimulant initiation.",
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
