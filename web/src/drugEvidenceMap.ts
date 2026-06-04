/**
 * Curated drug → evidence map covering the six SPEC-0006 R18 examples.
 *
 * Keys are lowercase INN (International Nonproprietary Name) strings.
 * Brand-name aliases are resolved to the same entry via BRAND_ALIASES below.
 *
 * PHI-FREE: no patient identifiers, SSNs, DOBs, phone numbers or email
 * addresses appear anywhere in this module.
 */

export interface EvidenceEntry {
  /** Public URL to drug-specific evidence (FDA label, NLM MedlinePlus drug page, etc.) */
  readonly evidenceUrl: string;
  /** Drug-specific prompt hint passed to the on-chain LLM inference agent. */
  readonly promptHint: string;
}

/**
 * Record keyed by lowercase INN.
 * Covers all six R18 drugs: Adalimumab, Semaglutide, Ustekinumab,
 * Lecanemab, Tirzepatide, Dupilumab.
 */
export const DRUG_EVIDENCE_MAP: Readonly<Record<string, EvidenceEntry>> = {
  // Evidence URLs MUST be scraper-friendly static HTML for the Somnia LLM Parse
  // Website agent (verified 2026-06-04). Wikipedia drug pages are used: every one
  // returns static HTML with the drug's FDA-approval + indication content in the
  // raw markup (free-probe verified), and the Adalimumab page is PROVEN to scrape
  // successfully on-chain (testnet requestId 4435826 → Success). The prior
  // MedlinePlus URLs were inconsistent (ustekinumab/dupilumab render the drug
  // content via JS → empty scrape; the Lecanemab FDA PDF was a 404 + non-HTML).
  // promptHints state a concrete FDA-approved indication + an explicit decision
  // rubric so the medical-necessity arbiter (LLM Inference) can return a clean
  // verdict from the scraped evidence — `needs_more_info` is confined to "the
  // evidence does not establish FDA approval". Phrasing avoids adjacent
  // Title-Case words (the contract's PHI name-pattern guard `[A-Z][a-z]+ [A-Z]`)
  // and contains no patient identifiers (synthetic indication only).
  adalimumab: {
    evidenceUrl: "https://en.wikipedia.org/wiki/Adalimumab",
    promptHint:
      "A patient with moderate-to-severe plaque psoriasis and inadequate response to topical therapy requests adalimumab (Humira). Based on the public drug evidence provided, reply approve if adalimumab is FDA-approved for this indication and the request is medically necessary; reply deny if it is not an approved use; reply needs_more_info only if the evidence does not establish FDA approval.",
  },
  semaglutide: {
    evidenceUrl: "https://en.wikipedia.org/wiki/Semaglutide",
    promptHint:
      "A patient with type 2 diabetes and established cardiovascular disease requests semaglutide (Ozempic). Based on the public drug evidence provided, reply approve if semaglutide is FDA-approved for this indication and the request is medically necessary; reply deny if it is not an approved use; reply needs_more_info only if the evidence does not establish FDA approval.",
  },
  ustekinumab: {
    evidenceUrl: "https://en.wikipedia.org/wiki/Ustekinumab",
    promptHint:
      "A patient with moderately-to-severely active Crohn's disease after anti-tnf failure requests ustekinumab (Stelara). Based on the public drug evidence provided, reply approve if ustekinumab is FDA-approved for this indication and the request is medically necessary; reply deny if it is not an approved use; reply needs_more_info only if the evidence does not establish FDA approval.",
  },
  lecanemab: {
    evidenceUrl: "https://en.wikipedia.org/wiki/Lecanemab",
    promptHint:
      "A patient with early Alzheimer's disease and biomarker-confirmed amyloid pathology requests lecanemab (Leqembi). Based on the public drug evidence provided, reply approve if lecanemab is FDA-approved for this indication and the request is medically necessary; reply deny if it is not an approved use; reply needs_more_info only if the evidence does not establish FDA approval.",
  },
  tirzepatide: {
    evidenceUrl: "https://en.wikipedia.org/wiki/Tirzepatide",
    promptHint:
      "A patient with type 2 diabetes and inadequate glycaemic control on metformin requests tirzepatide (Mounjaro). Based on the public drug evidence provided, reply approve if tirzepatide is FDA-approved for this indication and the request is medically necessary; reply deny if it is not an approved use; reply needs_more_info only if the evidence does not establish FDA approval.",
  },
  dupilumab: {
    evidenceUrl: "https://en.wikipedia.org/wiki/Dupilumab",
    promptHint:
      "A patient with severe eosinophilic asthma uncontrolled on high-dose inhaled corticosteroids requests dupilumab (Dupixent). Based on the public drug evidence provided, reply approve if dupilumab is FDA-approved for this indication and the request is medically necessary; reply deny if it is not an approved use; reply needs_more_info only if the evidence does not establish FDA approval.",
  },
};

/**
 * Brand-name → INN alias table.
 * Keys are lowercase brand names; values are the canonical key in
 * DRUG_EVIDENCE_MAP.
 */
const BRAND_ALIASES: Readonly<Record<string, string>> = {
  humira: "adalimumab",
  ozempic: "semaglutide",
  wegovy: "semaglutide",
  stelara: "ustekinumab",
  leqembi: "lecanemab",
  mounjaro: "tirzepatide",
  zepbound: "tirzepatide",
  dupixent: "dupilumab",
};

/**
 * Normalise a raw drug-field string for lookup:
 * 1. Trim whitespace.
 * 2. Strip any parenthetical suffix (e.g. RxNorm/NDC trailers or brand hints).
 * 3. Lowercase and collapse internal whitespace.
 */
function normalise(raw: string): string {
  return raw
    .trim()
    .replace(/\s*\(.*$/, "") // strip from first '(' to end
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Case-insensitive, prefix-strip lookup.
 *
 * Returns the `EvidenceEntry` for the drug, or `null` when the name is
 * unknown (manual-override / whitespace-only input).
 *
 * Lookup order:
 *   1. Direct match on the normalised INN key.
 *   2. Brand-name alias resolution.
 */
export function evidenceForDrug(rawName: string): EvidenceEntry | null {
  const key = normalise(rawName);
  if (key === "") return null;

  const direct = DRUG_EVIDENCE_MAP[key];
  if (direct !== undefined) return direct;

  const innKey = BRAND_ALIASES[key];
  if (innKey !== undefined) {
    const byAlias = DRUG_EVIDENCE_MAP[innKey];
    if (byAlias !== undefined) return byAlias;
  }

  return null;
}
