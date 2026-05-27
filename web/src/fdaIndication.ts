/**
 * Typed loader for the synthetic FDA-indication fixture
 * (`demo-data/fda-indication-adalimumab.json`), used by the R3 policy-void
 * "gotcha" panel: the FDA-approved indication is shown beside the struck-through
 * non-compliant policy clause to make the void legible (SPEC-0002 R3).
 *
 * SYNTHETIC — no PHI; an openFDA-shaped label snippet for the adalimumab /
 * HUMIRA plaque-psoriasis indication. Imported (not inlined) so the fixture is
 * the single source of truth; resolveJsonModule + Vite handle the JSON import.
 */
import fixture from "../../demo-data/fda-indication-adalimumab.json";

export interface FdaIndicationFixture {
  readonly openfda: {
    readonly brand_name: readonly string[];
    readonly generic_name: readonly string[];
    readonly rxcui: readonly string[];
    readonly product_ndc: readonly string[];
  };
  readonly indications_and_usage: readonly string[];
}

export const FDA_INDICATION: FdaIndicationFixture = fixture;

/** Brand/generic display line (e.g. "HUMIRA (adalimumab)"). */
export const FDA_DRUG_LABEL = `${FDA_INDICATION.openfda.brand_name[0]} (${(
  FDA_INDICATION.openfda.generic_name[0] ?? ""
).toLowerCase()})`;

/** The FDA-approved indication paragraph (cited beside the voided clause). */
export const FDA_INDICATION_TEXT = FDA_INDICATION.indications_and_usage[0] ?? "";

/** A public openFDA label URL for the cited standard. */
export const FDA_LABEL_URL =
  "https://api.fda.gov/drug/label.json?search=openfda.brand_name:HUMIRA";
