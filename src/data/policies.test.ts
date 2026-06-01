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
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { PayerLine } from "../protocol/ladders.js";
import {
  POLICY_LIBRARY,
  type CuratedPolicy,
  getCuratedPolicy,
  policiesForLine,
} from "./policies.js";

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
