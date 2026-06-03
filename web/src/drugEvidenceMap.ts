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
  adalimumab: {
    evidenceUrl:
      "https://medlineplus.gov/druginfo/meds/a603010.html",
    promptHint:
      "Evaluate whether adalimumab (Humira) is medically necessary and FDA-approved for the stated indication, referencing current ACCP/ACR criteria and biosimilar step-therapy requirements.",
  },
  semaglutide: {
    evidenceUrl:
      "https://medlineplus.gov/druginfo/meds/a618008.html",
    promptHint:
      "Evaluate whether semaglutide (Ozempic/Wegovy) is medically necessary and FDA-approved for the stated indication, referencing ADA glycaemic-control guidelines and BMI/comorbidity criteria for the obesity indication.",
  },
  ustekinumab: {
    evidenceUrl:
      "https://medlineplus.gov/druginfo/meds/a611003.html",
    promptHint:
      "Evaluate whether ustekinumab (Stelara) is medically necessary and FDA-approved for the stated indication, referencing AAD/ACG moderate-to-severe disease criteria and prior biologic step-therapy history.",
  },
  lecanemab: {
    evidenceUrl:
      "https://www.accessdata.fda.gov/drugsatfda_docs/label/2023/761269s001lbl.pdf",
    promptHint:
      "Evaluate whether lecanemab (Leqembi) is medically necessary and FDA-approved for the stated indication, referencing the accelerated approval criteria for early Alzheimer's disease, confirmed amyloid pathology requirements, and CMS coverage conditions.",
  },
  tirzepatide: {
    evidenceUrl:
      "https://medlineplus.gov/druginfo/meds/a622044.html",
    promptHint:
      "Evaluate whether tirzepatide (Mounjaro/Zepbound) is medically necessary and FDA-approved for the stated indication, referencing ADA glucose-lowering algorithm for type 2 diabetes or SURMOUNT trial BMI/comorbidity criteria for the obesity indication.",
  },
  dupilumab: {
    evidenceUrl:
      "https://medlineplus.gov/druginfo/meds/a617010.html",
    promptHint:
      "Evaluate whether dupilumab (Dupixent) is medically necessary and FDA-approved for the stated indication, referencing AAD/AAAAI moderate-to-severe disease criteria, ICS or topical corticosteroid step-therapy requirements, and the approved age range for the specific indication.",
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
