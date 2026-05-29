/**
 * Unit tests for REVERT_REASON_MAP and mapRevertReason (SPEC-0003 R16).
 *
 * Pins the five baseline contract error strings from the loop-state.md
 * acceptance criterion and the generic-fallback behaviour.
 *
 * Run via: node --import tsx --test src/protocol/revertReasonMap.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REVERT_REASON_MAP,
  mapRevertReason,
} from "./revertReasonMap.js";

// ---------------------------------------------------------------------------
// Baseline keys required by loop-state.md acceptance criterion (SPEC-0003 R16)
// ---------------------------------------------------------------------------
const BASELINE_KEYS = [
  "engage: not Open",
  "adjudicate: not Ready",
  "fee: underfunded",
  "auth: not a party",
  "appeal: needs evidence",
] as const;

// ---------------------------------------------------------------------------
// 1. REVERT_REASON_MAP contains at least the 5 baseline entries
// ---------------------------------------------------------------------------
test("REVERT_REASON_MAP contains all 5 baseline contract error strings", () => {
  for (const key of BASELINE_KEYS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(REVERT_REASON_MAP, key),
      `Missing baseline key: "${key}"`,
    );
  }
});

// ---------------------------------------------------------------------------
// 2. Each baseline entry has non-empty headline and details strings
// ---------------------------------------------------------------------------
test("Each baseline entry has non-empty headline and details", () => {
  for (const key of BASELINE_KEYS) {
    const entry = REVERT_REASON_MAP[key as keyof typeof REVERT_REASON_MAP];
    assert.equal(typeof entry.headline, "string", `${key}: headline must be a string`);
    assert.ok(entry.headline.length > 0, `${key}: headline must be non-empty`);
    assert.equal(typeof entry.details, "string", `${key}: details must be a string`);
    assert.ok(entry.details.length > 0, `${key}: details must be non-empty`);
  }
});

// ---------------------------------------------------------------------------
// 3. mapRevertReason returns correct entry for each known revert string
// ---------------------------------------------------------------------------
test("mapRevertReason returns the correct entry for each known revert string", () => {
  for (const key of BASELINE_KEYS) {
    const entry = mapRevertReason(key);
    assert.ok(entry.headline.length > 0, `${key}: returned headline must be non-empty`);
    assert.equal(
      entry.headline,
      REVERT_REASON_MAP[key as keyof typeof REVERT_REASON_MAP].headline,
      `${key}: mapRevertReason headline must match map entry`,
    );
  }
});

// ---------------------------------------------------------------------------
// 4. mapRevertReason(undefined) returns the generic fallback entry
// ---------------------------------------------------------------------------
test("mapRevertReason(undefined) returns generic fallback with non-empty headline + details", () => {
  const fallback = mapRevertReason(undefined);
  assert.ok(typeof fallback.headline === "string", "fallback.headline must be a string");
  assert.ok(fallback.headline.length > 0, "fallback.headline must be non-empty");
  assert.ok(typeof fallback.details === "string", "fallback.details must be a string");
  assert.ok(fallback.details.length > 0, "fallback.details must be non-empty");
});

// ---------------------------------------------------------------------------
// 5. mapRevertReason(unknownString) returns generic fallback AND preserves raw string in details
// ---------------------------------------------------------------------------
test("mapRevertReason with unknown string returns fallback and embeds raw string in details", () => {
  const raw = "some unknown revert string xyz123";
  const entry = mapRevertReason(raw);
  // Must still be a fallback entry (headline non-empty)
  assert.ok(entry.headline.length > 0, "fallback for unknown must have non-empty headline");
  // The raw input must appear somewhere in details so no info is lost to the user
  assert.ok(
    entry.details.includes(raw),
    `fallback details must contain the raw input string "${raw}"`,
  );
});

// ---------------------------------------------------------------------------
// 6. REVERT_REASON_MAP is frozen (Object.freeze enforced)
// ---------------------------------------------------------------------------
test("REVERT_REASON_MAP is frozen", () => {
  assert.ok(
    Object.isFrozen(REVERT_REASON_MAP),
    "REVERT_REASON_MAP must be Object.freeze()-d",
  );
});

// ---------------------------------------------------------------------------
// 7. headline length is reasonable (≤ 80 chars) for all baseline entries
// ---------------------------------------------------------------------------
test("Each baseline entry headline is ≤ 80 characters (UI headline guard)", () => {
  for (const key of BASELINE_KEYS) {
    const { headline } = REVERT_REASON_MAP[key as keyof typeof REVERT_REASON_MAP];
    assert.ok(
      headline.length <= 80,
      `${key}: headline too long (${headline.length} chars) — must be ≤ 80 for UI`,
    );
  }
});

// ---------------------------------------------------------------------------
// 8. details is informative (≥ 30 chars) for all baseline entries
// ---------------------------------------------------------------------------
test("Each baseline entry details is ≥ 30 characters (rules out one-word stubs)", () => {
  for (const key of BASELINE_KEYS) {
    const { details } = REVERT_REASON_MAP[key as keyof typeof REVERT_REASON_MAP];
    assert.ok(
      details.length >= 30,
      `${key}: details too short (${details.length} chars) — must be ≥ 30`,
    );
  }
});

// ---------------------------------------------------------------------------
// 9. headline does not restate the contract error verbatim (plain English, not raw revert)
// ---------------------------------------------------------------------------
test("No baseline entry headline equals the raw contract revert string verbatim", () => {
  for (const key of BASELINE_KEYS) {
    const { headline } = REVERT_REASON_MAP[key as keyof typeof REVERT_REASON_MAP];
    assert.notEqual(
      headline,
      key,
      `${key}: headline must not be the raw revert string — write plain English instead`,
    );
  }
});
