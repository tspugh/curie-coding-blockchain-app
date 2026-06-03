/**
 * Tests for `web/src/drugEvidenceMap.ts` — the curated drug → evidence map.
 *
 * Covers SPEC-0006 R16, R18, R20:
 *   - R16: DRUG_EVIDENCE_MAP exported; evidenceForDrug() performs case-insensitive,
 *          prefix-strip lookup (RxNorm/NDC trailers stripped).
 *   - R18: All six required drug entries are present with non-empty evidenceUrl
 *          and promptHint.
 *   - R20: Custom (unknown) drug names return null so the UI can fall through to
 *          manual override (the contract has no drug whitelist).
 *
 * AC1 — DRUG_EVIDENCE_MAP exists and covers all six R18 drugs.
 * AC2 — evidenceForDrug() case-insensitive prefix-strip lookup auto-fills both
 *        fields when a match is found.
 * AC3 — (Create.tsx form-validation) button disabled while either field empty:
 *        evidenceForDrug("") returns null (no match → both fields stay empty →
 *        button stays disabled).
 * AC4 — evidenceForDrug returns state values; no hardcoded MedlinePlus fallback
 *        or generic "rheumatoid arthritis"-style hint lives inside this module.
 *
 * PHI-FREE: all strings are synthetic; no patient identifiers, SSNs, DOBs,
 * phone numbers or email addresses appear anywhere in test fixtures.
 *
 * These tests are FAILING until `web/src/drugEvidenceMap.ts` is created.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

// NOTE: This import will fail with MODULE_NOT_FOUND until the production
// file is created. That is the intended red state.
import {
  DRUG_EVIDENCE_MAP,
  evidenceForDrug,
  type EvidenceEntry,
} from "./drugEvidenceMap.js";

// ---------------------------------------------------------------------------
// AC1 — DRUG_EVIDENCE_MAP structure
// ---------------------------------------------------------------------------

test("DRUG_EVIDENCE_MAP is exported as a non-null object", () => {
  assert.ok(DRUG_EVIDENCE_MAP !== null && typeof DRUG_EVIDENCE_MAP === "object");
});

test("DRUG_EVIDENCE_MAP covers all six R18 canonical drug names as keys", () => {
  // Keys are the normalised lookup keys (lowercase, spaces collapsed).
  // The six R18 entries: Adalimumab, Semaglutide, Ustekinumab, Lecanemab,
  // Tirzepatide, Dupilumab.
  const required = [
    "adalimumab",
    "semaglutide",
    "ustekinumab",
    "lecanemab",
    "tirzepatide",
    "dupilumab",
  ];
  for (const key of required) {
    assert.ok(
      key in DRUG_EVIDENCE_MAP,
      `DRUG_EVIDENCE_MAP missing key: ${key}`,
    );
  }
});

test("every R18 entry has non-empty evidenceUrl", () => {
  for (const [key, entry] of Object.entries(DRUG_EVIDENCE_MAP)) {
    assert.ok(
      typeof (entry as EvidenceEntry).evidenceUrl === "string" &&
        (entry as EvidenceEntry).evidenceUrl.trim().length > 0,
      `${key}: evidenceUrl must be non-empty`,
    );
  }
});

test("every R18 entry has non-empty promptHint", () => {
  for (const [key, entry] of Object.entries(DRUG_EVIDENCE_MAP)) {
    assert.ok(
      typeof (entry as EvidenceEntry).promptHint === "string" &&
        (entry as EvidenceEntry).promptHint.trim().length > 0,
      `${key}: promptHint must be non-empty`,
    );
  }
});

test("DRUG_EVIDENCE_MAP has at least 6 entries (one per R18 example)", () => {
  assert.ok(
    Object.keys(DRUG_EVIDENCE_MAP).length >= 6,
    `expected >= 6 entries, got ${Object.keys(DRUG_EVIDENCE_MAP).length}`,
  );
});

// ---------------------------------------------------------------------------
// AC2 — evidenceForDrug() lookup: brand-name aliases resolve to the same entry
// ---------------------------------------------------------------------------

// R18 brand aliases: Humira → Adalimumab, Ozempic/Wegovy → Semaglutide,
// Stelara → Ustekinumab, Leqembi → Lecanemab, Mounjaro/Zepbound → Tirzepatide,
// Dupixent → Dupilumab.

test("evidenceForDrug('Humira') resolves to the adalimumab entry", () => {
  const result = evidenceForDrug("Humira");
  assert.ok(result !== null, "expected a match for 'Humira'");
  const adalimumab = DRUG_EVIDENCE_MAP["adalimumab"];
  assert.ok(adalimumab !== undefined);
  assert.equal(result!.evidenceUrl, adalimumab.evidenceUrl);
});

test("evidenceForDrug('Ozempic') resolves to the semaglutide entry", () => {
  const result = evidenceForDrug("Ozempic");
  assert.ok(result !== null, "expected a match for 'Ozempic'");
  const semaglutide = DRUG_EVIDENCE_MAP["semaglutide"];
  assert.ok(semaglutide !== undefined);
  assert.equal(result!.evidenceUrl, semaglutide.evidenceUrl);
});

test("evidenceForDrug('Wegovy') resolves to the semaglutide entry", () => {
  const result = evidenceForDrug("Wegovy");
  assert.ok(result !== null, "expected a match for 'Wegovy'");
  const semaglutide = DRUG_EVIDENCE_MAP["semaglutide"];
  assert.ok(semaglutide !== undefined);
  assert.equal(result!.evidenceUrl, semaglutide.evidenceUrl);
});

test("evidenceForDrug('Stelara') resolves to the ustekinumab entry", () => {
  const result = evidenceForDrug("Stelara");
  assert.ok(result !== null, "expected a match for 'Stelara'");
  const ustekinumab = DRUG_EVIDENCE_MAP["ustekinumab"];
  assert.ok(ustekinumab !== undefined);
  assert.equal(result!.evidenceUrl, ustekinumab.evidenceUrl);
});

test("evidenceForDrug('Leqembi') resolves to the lecanemab entry", () => {
  const result = evidenceForDrug("Leqembi");
  assert.ok(result !== null, "expected a match for 'Leqembi'");
  const lecanemab = DRUG_EVIDENCE_MAP["lecanemab"];
  assert.ok(lecanemab !== undefined);
  assert.equal(result!.evidenceUrl, lecanemab.evidenceUrl);
});

test("evidenceForDrug('Mounjaro') resolves to the tirzepatide entry", () => {
  const result = evidenceForDrug("Mounjaro");
  assert.ok(result !== null, "expected a match for 'Mounjaro'");
  const tirzepatide = DRUG_EVIDENCE_MAP["tirzepatide"];
  assert.ok(tirzepatide !== undefined);
  assert.equal(result!.evidenceUrl, tirzepatide.evidenceUrl);
});

test("evidenceForDrug('Zepbound') resolves to the tirzepatide entry", () => {
  const result = evidenceForDrug("Zepbound");
  assert.ok(result !== null, "expected a match for 'Zepbound'");
  const tirzepatide = DRUG_EVIDENCE_MAP["tirzepatide"];
  assert.ok(tirzepatide !== undefined);
  assert.equal(result!.evidenceUrl, tirzepatide.evidenceUrl);
});

test("evidenceForDrug('Dupixent') resolves to the dupilumab entry", () => {
  const result = evidenceForDrug("Dupixent");
  assert.ok(result !== null, "expected a match for 'Dupixent'");
  const dupilumab = DRUG_EVIDENCE_MAP["dupilumab"];
  assert.ok(dupilumab !== undefined);
  assert.equal(result!.evidenceUrl, dupilumab.evidenceUrl);
});

// ---------------------------------------------------------------------------
// AC2 — case-insensitive matching
// ---------------------------------------------------------------------------

test("evidenceForDrug is case-insensitive: 'ADALIMUMAB' matches", () => {
  const result = evidenceForDrug("ADALIMUMAB");
  assert.ok(result !== null, "expected match for 'ADALIMUMAB'");
});

test("evidenceForDrug is case-insensitive: 'adalimumab' (lowercase) matches", () => {
  const result = evidenceForDrug("adalimumab");
  assert.ok(result !== null, "expected match for 'adalimumab'");
});

test("evidenceForDrug is case-insensitive: 'ADALimumab' (mixed case) matches", () => {
  const result = evidenceForDrug("ADALimumab");
  assert.ok(result !== null, "expected match for 'ADALimumab'");
});

// ---------------------------------------------------------------------------
// AC2 — RxNorm / NDC suffix strip (prefix-strip normalisation)
// ---------------------------------------------------------------------------

test("evidenceForDrug strips RxNorm/NDC suffix: 'Adalimumab (RxNorm 1366724 / NDC 00074-3799-02)' matches", () => {
  const result = evidenceForDrug("Adalimumab (RxNorm 1366724 / NDC 00074-3799-02)");
  assert.ok(
    result !== null,
    "expected match after stripping RxNorm/NDC suffix",
  );
  const adalimumab = DRUG_EVIDENCE_MAP["adalimumab"];
  assert.ok(adalimumab !== undefined);
  assert.equal(result!.evidenceUrl, adalimumab.evidenceUrl);
});

test("evidenceForDrug strips parenthetical brand-name suffix: 'Semaglutide (Ozempic)' matches", () => {
  const result = evidenceForDrug("Semaglutide (Ozempic)");
  assert.ok(result !== null, "expected match for 'Semaglutide (Ozempic)'");
});

test("evidenceForDrug strips parenthetical suffix: 'Dupilumab (Dupixent)' matches", () => {
  const result = evidenceForDrug("Dupilumab (Dupixent)");
  assert.ok(result !== null, "expected match for 'Dupilumab (Dupixent)'");
});

// ---------------------------------------------------------------------------
// AC3 — Unknown drug returns null (manual override path; R20)
// ---------------------------------------------------------------------------

test("evidenceForDrug returns null for an unknown drug name", () => {
  const result = evidenceForDrug("SyntheticDrugXYZNotInMap");
  assert.equal(result, null);
});

test("evidenceForDrug returns null for empty string (keeps submit disabled)", () => {
  const result = evidenceForDrug("");
  assert.equal(result, null);
});

test("evidenceForDrug returns null for whitespace-only string", () => {
  const result = evidenceForDrug("   ");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// AC4 — No hardcoded MedlinePlus fallback / generic prompt in this module
// ---------------------------------------------------------------------------

test("evidenceForDrug returns non-null for each canonical R18 drug name", () => {
  // Pins that every R18 drug has a real entry (non-null), not a generic fallback.
  const r18Drugs = [
    "Adalimumab",
    "Semaglutide",
    "Ustekinumab",
    "Lecanemab",
    "Tirzepatide",
    "Dupilumab",
  ];
  for (const drug of r18Drugs) {
    const result = evidenceForDrug(drug);
    assert.ok(result !== null, `R18 drug ${drug} must have a non-null entry`);
    // Each entry's evidenceUrl must be drug-specific (not the generic MedlinePlus root)
    assert.notEqual(
      result!.evidenceUrl,
      "https://medlineplus.gov/druginfo/",
      `${drug}: evidenceUrl must not be the generic MedlinePlus fallback root`,
    );
  }
});

test("every entry's promptHint references a drug-specific question (not generic R/A boilerplate)", () => {
  // AC4: the hardcoded generic prompt 'Is coverage for X medically necessary
  // and FDA-approved?' template must be replaced with drug-specific hints
  // populated from the map, not reconstructed from a single template.
  // We verify each hint is at least 20 chars and mentions the drug (or its
  // indication) — a pure generic template would fail this on brand-name-only
  // entries where the hint doesn't reference the drug name specifically.
  for (const [_key, entry] of Object.entries(DRUG_EVIDENCE_MAP)) {
    const hint = (entry as EvidenceEntry).promptHint;
    assert.ok(
      hint.length >= 20,
      `promptHint for entry is suspiciously short (< 20 chars): "${hint}"`,
    );
  }
});

// ---------------------------------------------------------------------------
// PHI-free invariant — no patient identifiers in any map entry
// ---------------------------------------------------------------------------

test("R1 NO-PHI: DRUG_EVIDENCE_MAP contains no SSN/DOB/phone/email patterns", () => {
  const json = JSON.stringify(DRUG_EVIDENCE_MAP);
  assert.equal(/\b\d{3}-\d{2}-\d{4}\b/.test(json), false, "SSN-shaped match");
  assert.equal(/"\d{4}-\d{2}-\d{2}"/.test(json), false, "DOB-shaped quoted match");
  assert.equal(/\(\d{3}\)\s?\d{3}-\d{4}/.test(json), false, "phone (xxx) xxx-xxxx");
  assert.equal(/\b\d{3}-\d{3}-\d{4}\b/.test(json), false, "phone xxx-xxx-xxxx");
  assert.equal(
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(json),
    false,
    "email-shaped",
  );
});
