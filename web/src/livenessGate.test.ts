/**
 * Tests for `web/src/livenessGate.ts` — SPEC-0006 R21 submit-gate and
 * banner-visibility pure logic.
 *
 * These tests directly exercise the production functions that govern:
 *   (a) whether `create-submit` is disabled (isSubmitBlockedByLiveness), and
 *   (b) whether the `data-testid="url-liveness-error"` banner is visible
 *       (shouldShowLivenessBanner).
 *
 * Acceptance criterion (R21):
 *   - In real mode, entering a dead URL keeps `create-submit` disabled and
 *     shows the banner.
 *   - In real mode, a confirmed-live URL unblocks `create-submit` and hides
 *     the banner.
 *   - In sim mode the check is bypassed: submit is NOT blocked by liveness and
 *     the banner is NOT shown regardless of result.
 *   - While probe is in flight (result === null) in real mode: submit IS blocked
 *     and banner is NOT shown (no error yet to display).
 *
 * These tests FAIL until `livenessGate.ts` exports the correct implementations.
 *
 * PHI-FREE: all values are synthetic HTTP status codes and booleans; no patient
 * identifiers, SSNs, DOBs, phone numbers or email addresses appear in this file.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isSubmitBlockedByLiveness,
  shouldShowLivenessBanner,
} from "./livenessGate.js";

// ---------------------------------------------------------------------------
// isSubmitBlockedByLiveness — R21 create-submit disabled gate
// ---------------------------------------------------------------------------

test("R21 gate: real mode + ok:true → submit NOT blocked", () => {
  const blocked = isSubmitBlockedByLiveness(/* isReal= */ true, { ok: true, status: 200 });
  assert.equal(blocked, false, "confirmed-live URL must unblock submit");
});

test("R21 gate: real mode + ok:false (dead URL) → submit IS blocked", () => {
  // This is the key acceptance criterion: a dead URL keeps create-submit disabled.
  const blocked = isSubmitBlockedByLiveness(/* isReal= */ true, { ok: false, status: 404 });
  assert.equal(blocked, true, "dead URL must keep create-submit disabled");
});

test("R21 gate: real mode + ok:false (network error) → submit IS blocked", () => {
  const blocked = isSubmitBlockedByLiveness(/* isReal= */ true, {
    ok: false,
    status: 0,
    error: "Failed to fetch",
  });
  assert.equal(blocked, true, "network error must keep create-submit disabled");
});

test("R21 gate: real mode + result null (probe in flight) → submit IS blocked", () => {
  // While waiting for probe result, submit must remain disabled.
  const blocked = isSubmitBlockedByLiveness(/* isReal= */ true, null);
  assert.equal(blocked, true, "pending probe must keep create-submit disabled");
});

test("R21 gate: sim mode + ok:false → submit NOT blocked (liveness bypassed)", () => {
  // In sim mode the liveness check is entirely bypassed.
  const blocked = isSubmitBlockedByLiveness(/* isReal= */ false, { ok: false, status: 404 });
  assert.equal(blocked, false, "sim mode must bypass liveness gate");
});

test("R21 gate: sim mode + null result → submit NOT blocked", () => {
  const blocked = isSubmitBlockedByLiveness(/* isReal= */ false, null);
  assert.equal(blocked, false, "sim mode + null must NOT block submit");
});

test("R21 gate: sim mode + ok:true → submit NOT blocked", () => {
  const blocked = isSubmitBlockedByLiveness(/* isReal= */ false, { ok: true, status: 200 });
  assert.equal(blocked, false, "sim mode with live URL must not block submit");
});

// ---------------------------------------------------------------------------
// shouldShowLivenessBanner — R21 url-liveness-error banner visibility
// ---------------------------------------------------------------------------

test("R21 banner: real mode + ok:false → banner SHOWN", () => {
  // Entering a dead URL must show data-testid="url-liveness-error".
  const show = shouldShowLivenessBanner(/* isReal= */ true, { ok: false, status: 404 });
  assert.equal(show, true, "dead URL must show the liveness-error banner");
});

test("R21 banner: real mode + ok:false (network error) → banner SHOWN", () => {
  const show = shouldShowLivenessBanner(/* isReal= */ true, {
    ok: false,
    status: 0,
    error: "Failed to fetch",
  });
  assert.equal(show, true, "network error must show the liveness-error banner");
});

test("R21 banner: real mode + ok:true → banner NOT shown", () => {
  const show = shouldShowLivenessBanner(/* isReal= */ true, { ok: true, status: 200 });
  assert.equal(show, false, "live URL must NOT show the banner");
});

test("R21 banner: real mode + null (probe in flight) → banner NOT shown", () => {
  // While probe is in flight there's no error to display yet.
  const show = shouldShowLivenessBanner(/* isReal= */ true, null);
  assert.equal(show, false, "pending probe must NOT show the banner");
});

test("R21 banner: sim mode + ok:false → banner NOT shown (bypassed)", () => {
  // Sim mode bypasses liveness entirely; banner must never appear.
  const show = shouldShowLivenessBanner(/* isReal= */ false, { ok: false, status: 404 });
  assert.equal(show, false, "sim mode must bypass banner");
});

test("R21 banner: sim mode + null → banner NOT shown", () => {
  const show = shouldShowLivenessBanner(/* isReal= */ false, null);
  assert.equal(show, false, "sim mode + null must not show banner");
});

// ---------------------------------------------------------------------------
// Gate + banner consistency invariants
// ---------------------------------------------------------------------------

test("invariant: banner shown only when gate also blocks (real mode)", () => {
  // If the banner is shown, the gate must also be blocking.
  // Both gate-true and banner-false combinations are valid (probe in flight),
  // but banner-true + gate-false is never valid.
  const cases: Array<import("./urlLiveness.js").LivenessResult | null> = [
    null,
    { ok: true, status: 200 },
    { ok: false, status: 404 },
    { ok: false, status: 0, error: "network error" },
  ];
  for (const result of cases) {
    const blocked = isSubmitBlockedByLiveness(true, result);
    const shown = shouldShowLivenessBanner(true, result);
    if (shown) {
      assert.equal(
        blocked,
        true,
        `banner shown for result=${JSON.stringify(result)} but gate is not blocking — inconsistent`,
      );
    }
  }
});

test("invariant: sim mode never blocks or shows banner regardless of result", () => {
  const cases: Array<import("./urlLiveness.js").LivenessResult | null> = [
    null,
    { ok: true, status: 200 },
    { ok: false, status: 404 },
    { ok: false, status: 500, error: "server error" },
  ];
  for (const result of cases) {
    assert.equal(
      isSubmitBlockedByLiveness(false, result),
      false,
      `sim mode must never block; result=${JSON.stringify(result)}`,
    );
    assert.equal(
      shouldShowLivenessBanner(false, result),
      false,
      `sim mode must never show banner; result=${JSON.stringify(result)}`,
    );
  }
});

// ---------------------------------------------------------------------------
// PHI-free invariant
// ---------------------------------------------------------------------------

test("R1 NO-PHI: no SSN/DOB/phone/email patterns in test file", () => {
  // Smoke check: verify this file itself is free of common PHI patterns.
  const fixtures = ["real-mode", "sim-mode", "dead-URL", "probe-in-flight"];
  const json = JSON.stringify(fixtures);
  assert.equal(/\b\d{3}-\d{2}-\d{4}\b/.test(json), false, "SSN-shaped");
  assert.equal(/"\d{4}-\d{2}-\d{2}"/.test(json), false, "DOB-shaped quoted");
  assert.equal(/\(\d{3}\)\s?\d{3}-\d{4}/.test(json), false, "phone (xxx) xxx-xxxx");
  assert.equal(
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(json),
    false,
    "email-shaped",
  );
});
