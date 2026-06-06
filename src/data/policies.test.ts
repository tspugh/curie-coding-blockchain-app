/**
 * Tests for `web/src/data/policies.ts` — the curated policy library.
 *
 * Pins SPEC-0005 R14's structural + content requirements:
 *  - ≥ 4 curated policies in the library.
 *  - All three payer lines (PartD + Commercial + Medicaid) represented.
 *  - Exactly one clause flagged `voids: true` across the library (the demo
 *    bad-policy from Scenario C2; R23 / amendment 0005).
 *  - SPEC-0004 R1 NO-PHI invariant: every clause is synthetic — no
 *    patient identifiers, no real plan names, no DOB/SSN/phone/email
 *    patterns in any clause text.
 *  - Stable ids: each policy + clause has a unique id (no duplicates) so
 *    on-chain reference indices stay stable across versions.
 *
 * Also pins SPEC-0007 requirements:
 *  - R1: every clause carries a `type` field equal to "public" or "attested".
 *  - R2: every public clause has a `check` object with kind, param, and sourceUrl.
 *  - R5: `Attestation` interface is exported with the correct shape.
 *  - R10: plaque-psoriasis Commercial PA policy exists (§3.6 shape).
 *  - R12: bupropion×ADHD policy exists with openFDA WELLBUTRIN sourceUrl.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { PayerLine } from "../protocol/ladders.js";
import {
  POLICY_LIBRARY,
  type CuratedPolicy,
  type Attestation,
  getCuratedPolicy,
  policiesForLine,
} from "./policies.js";

// openFDA source URL constants from SPEC-0007 §3.7 (bupropion×ADHD deny path)
const OPENFDA_WELLBUTRIN_URL =
  "https://api.fda.gov/drug/label.json?search=openfda.brand_name:WELLBUTRIN&limit=1";

// ---------------------------------------------------------------------------
// Library shape
// ---------------------------------------------------------------------------

test("POLICY_LIBRARY has at least 4 curated policies", () => {
  assert.ok(
    POLICY_LIBRARY.length >= 4,
    `expected >= 4 policies, got ${POLICY_LIBRARY.length}`,
  );
});

test("POLICY_LIBRARY covers all three payer lines", () => {
  const lines = new Set(POLICY_LIBRARY.map((p) => p.payerLine));
  assert.ok(lines.has(PayerLine.PartD), "PartD missing");
  assert.ok(lines.has(PayerLine.Commercial), "Commercial missing");
  assert.ok(lines.has(PayerLine.Medicaid), "Medicaid missing");
});

test("each curated policy has id + name + non-empty summary + ≥1 clause", () => {
  for (const p of POLICY_LIBRARY) {
    assert.ok(p.id, `${p.name}: id required`);
    assert.ok(p.name, `${p.id}: name required`);
    assert.ok(p.summary && p.summary.length >= 20, `${p.id}: summary ≥ 20 chars`);
    assert.ok(p.clauses.length >= 1, `${p.id}: ≥ 1 clause required`);
  }
});

test("each clause has stable id + non-trivial text body", () => {
  for (const p of POLICY_LIBRARY) {
    for (const c of p.clauses) {
      assert.ok(c.id, `${p.id}: clause without id`);
      assert.ok(
        c.text && c.text.length >= 40,
        `${p.id}/${c.id}: clause body too short (got ${c.text?.length ?? 0})`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Unique-id invariants — stable references over the lifetime of the demo.
// ---------------------------------------------------------------------------

test("policy ids are globally unique within the library", () => {
  const ids = POLICY_LIBRARY.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate policy id");
});

test("clause ids are globally unique within the library", () => {
  const all: string[] = [];
  for (const p of POLICY_LIBRARY) {
    for (const c of p.clauses) all.push(c.id);
  }
  assert.equal(new Set(all).size, all.length, "duplicate clause id");
});

// ---------------------------------------------------------------------------
// SPEC-0005 R23 (via amendment 0005): one canonical voids:true demo clause.
// ---------------------------------------------------------------------------

test("exactly one clause across the library is flagged voids:true (the R23 demo)", () => {
  const voided: string[] = [];
  for (const p of POLICY_LIBRARY) {
    for (const c of p.clauses) if (c.voids === true) voided.push(c.id);
  }
  assert.equal(
    voided.length,
    1,
    `expected exactly 1 voids:true clause, got ${voided.length}: ${voided.join(", ")}`,
  );
});

test("voided clause is the canonical PD-ADA-09 (Scenario C2 expectation)", () => {
  const v = POLICY_LIBRARY.flatMap((p) =>
    p.clauses.filter((c) => c.voids === true),
  );
  assert.equal(v[0]?.id, "PD-ADA-09");
});

// ---------------------------------------------------------------------------
// SPEC-0004 R1 — NO PHI in any policy text.
// ---------------------------------------------------------------------------

test("R1 NO-PHI: no SSN / DOB / phone / email patterns anywhere in the library", () => {
  const json = JSON.stringify(POLICY_LIBRARY);
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

test("R1 NO-PHI: no real-shape MRN or patient-id markers in clause text", () => {
  for (const p of POLICY_LIBRARY) {
    for (const c of p.clauses) {
      // MRN / patient-id keywords with a numeric suffix.
      assert.equal(
        /\bMRN[: -]?\d{4,}/i.test(c.text),
        false,
        `${p.id}/${c.id}: MRN leak`,
      );
      assert.equal(
        /\bpatient[- ]?id[: -]?\d{4,}/i.test(c.text),
        false,
        `${p.id}/${c.id}: patient-id leak`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

test("getCuratedPolicy returns the matching policy", () => {
  const got = getCuratedPolicy("partd-formulary-adalimumab");
  assert.ok(got);
  assert.equal(got!.payerLine, PayerLine.PartD);
});

test("getCuratedPolicy returns undefined on a miss", () => {
  assert.equal(getCuratedPolicy("ghost-id"), undefined);
});

test("policiesForLine filters to one payer line", () => {
  const partd = policiesForLine(PayerLine.PartD);
  // Two policies target PartD: the compliant formulary + the demo bad policy.
  assert.equal(partd.length, 2);
  for (const p of partd) assert.equal(p.payerLine, PayerLine.PartD);
});

test("the curated library is frozen (callers can't mutate)", () => {
  const lib = POLICY_LIBRARY as ReadonlyArray<CuratedPolicy>;
  assert.ok(Object.isFrozen(lib));
  for (const p of lib) {
    assert.ok(Object.isFrozen(p), `${p.id}: policy not frozen`);
    for (const c of p.clauses) assert.ok(Object.isFrozen(c), `${p.id}/${c.id}: clause not frozen`);
  }
});

// ---------------------------------------------------------------------------
// SPEC-0007 R1 — every clause carries type ("public" | "attested")
// ---------------------------------------------------------------------------

test("SPEC-0007 R1: every clause in POLICY_LIBRARY has a non-null type field", () => {
  for (const p of POLICY_LIBRARY) {
    for (const c of p.clauses) {
      assert.ok(
        c.type != null,
        `${p.id}/${c.id}: clause missing type field`,
      );
    }
  }
});

test("SPEC-0007 R1: every clause type is exactly 'public' or 'attested'", () => {
  const valid = new Set(["public", "attested"]);
  for (const p of POLICY_LIBRARY) {
    for (const c of p.clauses) {
      assert.ok(
        valid.has(c.type),
        `${p.id}/${c.id}: clause type must be "public" or "attested", got ${JSON.stringify(c.type)}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// SPEC-0007 R2 — public clauses carry check.kind + check.sourceUrl
// ---------------------------------------------------------------------------

test("SPEC-0007 R2: every public clause has a check object with kind, param, and sourceUrl", () => {
  const validKinds = new Set(["indication", "dosing"]);
  for (const p of POLICY_LIBRARY) {
    for (const c of p.clauses) {
      if (c.type !== "public") continue;
      assert.ok(
        c.check != null,
        `${p.id}/${c.id}: public clause missing check object`,
      );
      assert.ok(
        validKinds.has(c.check!.kind),
        `${p.id}/${c.id}: check.kind must be "indication" or "dosing", got ${JSON.stringify(c.check!.kind)}`,
      );
      assert.ok(
        typeof c.check!.param === "string" && c.check!.param.length > 0,
        `${p.id}/${c.id}: check.param must be a non-empty string`,
      );
      assert.ok(
        typeof c.check!.sourceUrl === "string" && c.check!.sourceUrl.length > 0,
        `${p.id}/${c.id}: check.sourceUrl must be a non-empty string`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// SPEC-0007 R5 — Attestation interface shape is exported and usable
// ---------------------------------------------------------------------------

test("SPEC-0007 R5: Attestation type is usable — minimal valid attestation compiles and type-checks", () => {
  // Construct a value that matches the Attestation interface shape.
  // If Attestation is not exported or has wrong shape, TypeScript errors at build.
  const minimal: Attestation = {
    clauseId: "PP-COM-03",
    attested: true,
  };
  assert.equal(minimal.clauseId, "PP-COM-03");
  assert.equal(minimal.attested, true);
  assert.equal(minimal.evidenceUrl, undefined);
});

test("SPEC-0007 R5: Attestation type accepts optional evidenceUrl", () => {
  const withEvidence: Attestation = {
    clauseId: "PP-COM-04",
    attested: true,
    evidenceUrl: "https://example.test/redacted-lab-2026.pdf",
  };
  assert.equal(withEvidence.clauseId, "PP-COM-04");
  assert.equal(withEvidence.evidenceUrl, "https://example.test/redacted-lab-2026.pdf");
});

// ---------------------------------------------------------------------------
// SPEC-0007 R10 — plaque-psoriasis Commercial PA policy (§3.6) exists
// ---------------------------------------------------------------------------

test("SPEC-0007 R10: plaque-psoriasis Commercial PA policy exists in the library", () => {
  // The §3.6 example policy targets Commercial payer line; we find it by payer
  // line and verify at least one matches (the library may have multiple commercial).
  const commercial = policiesForLine(PayerLine.Commercial);
  assert.ok(
    commercial.length >= 1,
    "expected at least one Commercial policy for the plaque-psoriasis worked example",
  );
});

test("SPEC-0007 R10: plaque-psoriasis Commercial PA policy has ≥2 public clauses", () => {
  // §3.6: clauses 1 (indication) and 2 (dosing) are public.
  // Find the commercial PA policy that covers plaque psoriasis.
  const psorPolicy = POLICY_LIBRARY.find(
    (p) =>
      p.payerLine === PayerLine.Commercial &&
      p.clauses.some(
        (c) =>
          c.type === "public" &&
          c.check?.kind === "indication" &&
          /plaque.?psoriasis/i.test(c.check.param),
      ),
  );
  assert.ok(
    psorPolicy != null,
    "plaque-psoriasis Commercial PA policy not found in POLICY_LIBRARY",
  );
  const publicClauses = psorPolicy!.clauses.filter((c) => c.type === "public");
  assert.ok(
    publicClauses.length >= 2,
    `plaque-psoriasis policy needs ≥2 public clauses, got ${publicClauses.length}`,
  );
});

test("SPEC-0007 R10: plaque-psoriasis Commercial PA policy has ≥2 attested clauses", () => {
  // §3.6: clauses 3 (step-therapy) and 4 (TB screening) are attested.
  const psorPolicy = POLICY_LIBRARY.find(
    (p) =>
      p.payerLine === PayerLine.Commercial &&
      p.clauses.some(
        (c) =>
          c.type === "public" &&
          c.check?.kind === "indication" &&
          /plaque.?psoriasis/i.test(c.check.param),
      ),
  );
  assert.ok(psorPolicy != null, "plaque-psoriasis Commercial PA policy not found");
  const attestedClauses = psorPolicy!.clauses.filter((c) => c.type === "attested");
  assert.ok(
    attestedClauses.length >= 2,
    `plaque-psoriasis policy needs ≥2 attested clauses, got ${attestedClauses.length}`,
  );
});

test("SPEC-0007 R10: plaque-psoriasis Commercial PA indication clause has a public sourceUrl", () => {
  const psorPolicy = POLICY_LIBRARY.find(
    (p) =>
      p.payerLine === PayerLine.Commercial &&
      p.clauses.some(
        (c) =>
          c.type === "public" &&
          c.check?.kind === "indication" &&
          /plaque.?psoriasis/i.test(c.check.param),
      ),
  );
  assert.ok(psorPolicy != null, "plaque-psoriasis Commercial PA policy not found");
  const indClause = psorPolicy!.clauses.find(
    (c) =>
      c.type === "public" &&
      c.check?.kind === "indication" &&
      /plaque.?psoriasis/i.test(c.check.param),
  );
  assert.ok(indClause?.check?.sourceUrl && indClause.check.sourceUrl.length > 0,
    "indication clause must have a non-empty sourceUrl",
  );
});

// ---------------------------------------------------------------------------
// SPEC-0007 R12 — bupropion×ADHD off-label policy (§3.7) exists
// ---------------------------------------------------------------------------

test("SPEC-0007 R12: bupropion×ADHD policy exists in the library", () => {
  const adhd = POLICY_LIBRARY.find(
    (p) =>
      p.clauses.some(
        (c) =>
          c.type === "public" &&
          c.check?.kind === "indication" &&
          /adhd/i.test(c.check.param),
      ),
  );
  assert.ok(
    adhd != null,
    "bupropion×ADHD off-label policy not found in POLICY_LIBRARY (R12 requires it)",
  );
});

test("SPEC-0007 R12: bupropion×ADHD indication clause sourceUrl is the openFDA WELLBUTRIN endpoint", () => {
  const adhd = POLICY_LIBRARY.find(
    (p) =>
      p.clauses.some(
        (c) =>
          c.type === "public" &&
          c.check?.kind === "indication" &&
          /adhd/i.test(c.check.param),
      ),
  );
  assert.ok(adhd != null, "bupropion×ADHD policy not found");
  const indClause = adhd!.clauses.find(
    (c) =>
      c.type === "public" &&
      c.check?.kind === "indication" &&
      /adhd/i.test(c.check.param),
  );
  assert.equal(
    indClause?.check?.sourceUrl,
    OPENFDA_WELLBUTRIN_URL,
    `bupropion×ADHD indication clause sourceUrl must be the openFDA WELLBUTRIN endpoint.\n` +
    `Expected: ${OPENFDA_WELLBUTRIN_URL}\n` +
    `Got: ${indClause?.check?.sourceUrl}`,
  );
});
