/**
 * Appeal-ladder definitions for the three payer lines supported in v0
 * (SPEC-0004 R13/R15/R17). Each payer line has an ordered array of
 * `LadderRow` entries, one per appeal stage (round 0 = Initial Determination).
 *
 * `thresholdCents` and `windowDays` are DOCUMENTED-ONLY in v0 per spec R14b —
 * the contract does NOT enforce them; they are surfaced in the UI so users
 * understand the regulatory context for each stage.
 */

/** The three payer lines the v0 appeal ladder covers (SPEC-0004 R13). */
export enum PayerLine {
  PartD = 0,
  Commercial = 1,
  Medicaid = 2,
}

/** One stage in an appeal ladder. */
export interface LadderRow {
  /** Human-readable stage name. */
  readonly name: string;
  /** Short description of what this stage represents. */
  readonly description: string;
  /** Regulatory citation for the stage. */
  readonly citation: { readonly label: string; readonly url: string };
  /**
   * Statutory window (days) to file this appeal, or null if not applicable /
   * not defined for this stage. Documented-only in v0 (SPEC-0004 R14b).
   */
  readonly windowDays: number | null;
  /**
   * Minimum amount-in-controversy threshold (cents) to access this stage, or
   * null if none applies. Documented-only in v0 (SPEC-0004 R14b).
   */
  readonly thresholdCents: number | null;
}

/**
 * Canonical appeal-ladder table for all three payer lines.
 * Index 0 is always "Initial Determination" (round 0 per prototype data.jsx).
 * Subsequent indices are appeal rounds 1, 2, … (SPEC-0004 R15/R17).
 */
export const LADDERS: Record<PayerLine, readonly LadderRow[]> = {
  [PayerLine.PartD]: [
    {
      name: "Initial Determination",
      description: "Plan-level coverage decision before any appeal.",
      citation: {
        label: "CMS Pub. 100-18 Ch. 18 §40",
        url: "https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Internet-Only-Manuals-IOMs-Items/CMS019326",
      },
      windowDays: null,
      thresholdCents: null,
    },
    {
      name: "Redetermination",
      description: "Plan-level reconsideration; first appeal stage.",
      citation: {
        label: "CMS Pub. 100-18 Ch. 18 §60",
        url: "https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Internet-Only-Manuals-IOMs-Items/CMS019326",
      },
      windowDays: 60,
      thresholdCents: null,
    },
    {
      name: "IRE Reconsideration",
      description: "Independent Review Entity (CMS-contracted external reviewer).",
      citation: {
        label: "42 CFR §423.600",
        url: "https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-423/subpart-M/section-423.600",
      },
      windowDays: 60,
      thresholdCents: null,
    },
    {
      name: "ALJ / OMHA Hearing",
      description: "Administrative Law Judge hearing at OMHA.",
      citation: {
        label: "42 CFR §423.2014",
        url: "https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-423/subpart-U/section-423.2014",
      },
      windowDays: 60,
      thresholdCents: 20_000,
    },
    {
      name: "Medicare Appeals Council",
      description: "Federal review of an OMHA decision; out of scope for v0.",
      citation: {
        label: "42 CFR §423.2102",
        url: "https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-423/subpart-U/section-423.2102",
      },
      windowDays: null,
      thresholdCents: null,
    },
  ],
  [PayerLine.Commercial]: [
    {
      name: "Initial Determination",
      description: "Payer's first coverage decision.",
      citation: {
        label: "29 CFR §2560.503-1",
        url: "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XXV/subchapter-L/part-2560/section-2560.503-1",
      },
      windowDays: null,
      thresholdCents: null,
    },
    {
      name: "Internal Appeal",
      description: "Payer-level reconsideration (ERISA-regulated plans).",
      citation: {
        label: "29 CFR §2560.503-1(h)",
        url: "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XXV/subchapter-L/part-2560/section-2560.503-1",
      },
      windowDays: 180,
      thresholdCents: null,
    },
    {
      name: "External Review",
      description: "Independent external review (state-managed or HHS-administered).",
      citation: {
        label: "45 CFR §147.136",
        url: "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-147/section-147.136",
      },
      windowDays: 120,
      thresholdCents: null,
    },
  ],
  [PayerLine.Medicaid]: [
    {
      name: "Initial Determination",
      description: "MCO's first coverage decision (managed-care plan).",
      citation: {
        label: "42 CFR §438.402",
        url: "https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-C/part-438/subpart-F/section-438.402",
      },
      windowDays: null,
      thresholdCents: null,
    },
    {
      name: "Plan Internal Appeal",
      description: "Managed-care plan's internal appeal (federal floor: 60 days to file).",
      citation: {
        label: "42 CFR §438.402",
        url: "https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-C/part-438/subpart-F/section-438.402",
      },
      windowDays: 60,
      thresholdCents: null,
    },
    {
      name: "External Medical Review / State Fair Hearing",
      description: "External + state hearing paths (collapsed into one round in v0).",
      citation: {
        label: "42 CFR §438.408",
        url: "https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-C/part-438/subpart-F/section-438.408",
      },
      windowDays: 120,
      thresholdCents: null,
    },
  ],
};

/**
 * Return the stage name for a given payer line + appeal round, or `"—"` when
 * the round is out of range or the line is unrecognised.
 *
 * @param line  The payer line governing this negotiation.
 * @param round The appeal round index (0 = Initial Determination).
 */
export function stageNameFor(line: PayerLine, round: number): string {
  const ladder = LADDERS[line];
  if (!ladder) return "—";
  return ladder[round]?.name ?? "—";
}
