/**
 * Unit tests for the LADDERS constant and stageNameFor helper (SPEC-0004 R15/R17).
 *
 * Run via: node --import tsx --test "src/**\/*.test.ts"
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { LADDERS, PayerLine, stageNameFor } from "./ladders.js";

test("LADDERS[PartD] has 5 entries", () => {
  assert.equal(LADDERS[PayerLine.PartD].length, 5);
});

test("LADDERS[Commercial] has 3 entries", () => {
  assert.equal(LADDERS[PayerLine.Commercial].length, 3);
});

test("LADDERS[Medicaid] has 3 entries", () => {
  assert.equal(LADDERS[PayerLine.Medicaid].length, 3);
});

test("LADDERS[PartD][3] is ALJ / OMHA Hearing (spec R15)", () => {
  assert.equal(LADDERS[PayerLine.PartD][3]?.name, "ALJ / OMHA Hearing");
});

test("LADDERS[Commercial][1].windowDays === 180", () => {
  assert.equal(LADDERS[PayerLine.Commercial][1]?.windowDays, 180);
});

test("LADDERS[Medicaid][2].name is External Medical Review / State Fair Hearing", () => {
  assert.equal(
    LADDERS[PayerLine.Medicaid][2]?.name,
    "External Medical Review / State Fair Hearing",
  );
});

test("LADDERS[PartD][3].thresholdCents === 20_000 (= $200, spec R14b documented)", () => {
  assert.equal(LADDERS[PayerLine.PartD][3]?.thresholdCents, 20_000);
});

test("stageNameFor(PartD, 0) === 'Initial Determination'", () => {
  assert.equal(stageNameFor(PayerLine.PartD, 0), "Initial Determination");
});

test("stageNameFor(PartD, 99) falls back to '—' (out-of-range round)", () => {
  assert.equal(stageNameFor(PayerLine.PartD, 99), "—");
});

test("stageNameFor with negative round falls back to '—'", () => {
  assert.equal(stageNameFor(PayerLine.PartD, -1), "—");
});

test("stageNameFor with invalid PayerLine falls back to '—'", () => {
  // Cast a clearly-invalid numeric value through the enum type.
  assert.equal(stageNameFor(99 as PayerLine, 0), "—");
});

/**
 * Pin EVERY spec R15 stage name so a rename anywhere drifts the build.
 * (Spec-0004 §2.4 R15 + §2.5 R17.)
 */
test("LADDERS pins every spec R15 stage name verbatim", () => {
  // PartD ladder (5 entries; round 0 is Initial Determination + 4 named appeal stages).
  assert.equal(LADDERS[PayerLine.PartD][0]?.name, "Initial Determination");
  assert.equal(LADDERS[PayerLine.PartD][1]?.name, "Redetermination");
  assert.equal(LADDERS[PayerLine.PartD][2]?.name, "IRE Reconsideration");
  assert.equal(LADDERS[PayerLine.PartD][3]?.name, "ALJ / OMHA Hearing");
  assert.equal(LADDERS[PayerLine.PartD][4]?.name, "Medicare Appeals Council");
  // Commercial ladder.
  assert.equal(LADDERS[PayerLine.Commercial][0]?.name, "Initial Determination");
  assert.equal(LADDERS[PayerLine.Commercial][1]?.name, "Internal Appeal");
  assert.equal(LADDERS[PayerLine.Commercial][2]?.name, "External Review");
  // Medicaid ladder (R17 MCO variant).
  assert.equal(LADDERS[PayerLine.Medicaid][0]?.name, "Initial Determination");
  assert.equal(LADDERS[PayerLine.Medicaid][1]?.name, "Plan Internal Appeal");
  assert.equal(
    LADDERS[PayerLine.Medicaid][2]?.name,
    "External Medical Review / State Fair Hearing",
  );
});

/**
 * Pin the documented-only window/threshold values (R14b deferred enforcement).
 * If these drift, the UI's R21 ladder context stops matching the source-of-truth.
 */
test("LADDERS pins windowDays + thresholdCents per tech-design", () => {
  // PartD windows.
  assert.equal(LADDERS[PayerLine.PartD][0]?.windowDays, null);
  assert.equal(LADDERS[PayerLine.PartD][1]?.windowDays, 60);
  assert.equal(LADDERS[PayerLine.PartD][2]?.windowDays, 60);
  assert.equal(LADDERS[PayerLine.PartD][3]?.windowDays, 60);
  // Only (PartD, 3) has a documented threshold ($200 in cents).
  assert.equal(LADDERS[PayerLine.PartD][3]?.thresholdCents, 20_000);
  // Commercial / Medicaid windows.
  assert.equal(LADDERS[PayerLine.Commercial][1]?.windowDays, 180);
  assert.equal(LADDERS[PayerLine.Commercial][2]?.windowDays, 120);
  assert.equal(LADDERS[PayerLine.Medicaid][1]?.windowDays, 60);
  assert.equal(LADDERS[PayerLine.Medicaid][2]?.windowDays, 120);
  // No other thresholds in v0.
  assert.equal(LADDERS[PayerLine.Commercial][1]?.thresholdCents, null);
  assert.equal(LADDERS[PayerLine.Medicaid][1]?.thresholdCents, null);
});

/**
 * Every entry must carry a non-empty `description` + `citation.label` + `citation.url`
 * (SPEC-0004 R21 requires both for the in-UI ladder context).
 */
test("Every LADDERS entry has non-empty description + citation", () => {
  for (const line of [PayerLine.PartD, PayerLine.Commercial, PayerLine.Medicaid]) {
    for (const row of LADDERS[line]) {
      assert.ok(row.description.length > 0, `${PayerLine[line]} missing description`);
      assert.ok(row.citation.label.length > 0, `${PayerLine[line]} missing citation.label`);
      assert.ok(
        row.citation.url.startsWith("http"),
        `${PayerLine[line]} citation.url should be http(s)`,
      );
    }
  }
});
