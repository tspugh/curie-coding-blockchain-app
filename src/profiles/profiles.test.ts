/**
 * Tests for `DEFAULT_PROFILES`. Pins the demo metadata so the Settings UI
 * (`web/src/views/Settings.tsx`) always has informative sub-lines per
 * tick-22 NIT 4 closure.
 *
 * Run via: node --import tsx --test "src/**\/*.test.ts"
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_PROFILES } from "./profiles.js";

test("DEFAULT_PROFILES has the two baseline profiles (provider, insurer)", () => {
  const ids = DEFAULT_PROFILES.map((p) => p.id);
  assert.deepEqual(ids, ["provider", "insurer"]);
});

test("Each default profile has a label, partyId, and a non-empty description", () => {
  for (const p of DEFAULT_PROFILES) {
    assert.ok(typeof p.label === "string" && p.label.length > 0, `${p.id}: label`);
    assert.ok(typeof p.partyId === "bigint" && p.partyId > 0n, `${p.id}: partyId`);
    assert.ok(
      typeof p.description === "string" && p.description.length >= 20,
      `${p.id}: description must be ≥ 20 chars (got ${p.description?.length ?? 0})`,
    );
  }
});

test("Default profile descriptions end with a period (sentence punctuation)", () => {
  for (const p of DEFAULT_PROFILES) {
    assert.ok(
      p.description?.endsWith("."),
      `${p.id}: description should be a complete sentence ending with "."`,
    );
  }
});
