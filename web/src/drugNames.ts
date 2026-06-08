/**
 * Reverse-map a known drug's on-chain ref back to a human-readable name for
 * display. The contract stores `drugRef = keccak256(utf8(medication string))`
 * (the literal name the provider entered), so the raw value renders as an opaque
 * hash like `0x9513…33d2` — unreadable for a demo viewer. The drug name is NOT
 * PHI, so we can safely show it; we just recompute the hashes of the names we
 * already know (the demo cases + the curated drug-evidence map) and match. This
 * adds NOTHING on-chain and only resolves drugs we can anticipate — anything
 * unknown falls back to the caller's short-hash.
 */
import { hashContent } from "@lib";
import { DEMO_CASES } from "./demoCases.js";
import { DRUG_EVIDENCE_MAP } from "./drugEvidenceMap.js";

const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// hash(lowercased) → display name, built once from every drug name we know.
const REF_TO_NAME = new Map<string, string>();
const remember = (name: string): void => {
  if (name) REF_TO_NAME.set(hashContent(name).toLowerCase(), name);
};
// The demo cases hash these exact medication strings (e.g. "Adalimumab (Humira)").
for (const c of DEMO_CASES) remember(c.drug);
// Plus the curated INN names a user might type directly (e.g. "Adalimumab").
for (const inn of Object.keys(DRUG_EVIDENCE_MAP)) {
  remember(inn);
  remember(titleCase(inn));
}

/** Human name for an on-chain drug ref, or `null` if it isn't a known drug. */
export function drugNameForRef(ref: string): string | null {
  return REF_TO_NAME.get(ref.toLowerCase()) ?? null;
}
