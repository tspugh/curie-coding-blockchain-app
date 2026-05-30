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
  extractRevertReason,
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

// ---------------------------------------------------------------------------
// extractRevertReason — probe order + edge cases
// ---------------------------------------------------------------------------

test("extractRevertReason: ethers v6 `.reason` wins over `.shortMessage` and `.message`", () => {
  const err = {
    reason: "auth: not insurer",
    shortMessage: 'execution reverted: "auth: not insurer"',
    message: "Error: execution reverted: noisy stack trace",
  };
  assert.equal(extractRevertReason(err), "auth: not insurer");
});

test("extractRevertReason: viem/wagmi `.shortMessage` wins over `.message` when no `.reason`", () => {
  const err = {
    shortMessage: "User rejected the request.",
    message: "noisy wrapped message",
  };
  assert.equal(extractRevertReason(err), "User rejected the request.");
});

test("extractRevertReason: falls back to `.message` when neither `.reason` nor `.shortMessage`", () => {
  const err = { message: "generic Error.message" };
  assert.equal(extractRevertReason(err), "generic Error.message");
});

test("extractRevertReason: empty-string `.reason` falls through to the next probe", () => {
  const err = { reason: "", shortMessage: "clean copy" };
  assert.equal(extractRevertReason(err), "clean copy");
});

test("extractRevertReason: returns undefined for null/undefined/primitive", () => {
  assert.equal(extractRevertReason(null), undefined);
  assert.equal(extractRevertReason(undefined), undefined);
  assert.equal(extractRevertReason("string error"), undefined);
  assert.equal(extractRevertReason(42), undefined);
});

test("extractRevertReason: returns undefined when no probe field is a string", () => {
  const err = { reason: 123, shortMessage: false, message: null };
  assert.equal(extractRevertReason(err), undefined);
});

test("extractRevertReason + mapRevertReason: end-to-end on a typical ethers v6 error shape", () => {
  const err = {
    reason: "auth: not insurer",
    message: 'execution reverted: "auth: not insurer" (action="estimateGas", ...)',
  };
  const entry = mapRevertReason(extractRevertReason(err));
  assert.equal(entry.headline, "Only the insurer can attach a policy");
  assert.ok(entry.details.length > 0);
});

// SPEC-0005 R17: wrapper-error substring matching for RPC / wallet errors
// that don't come from the contract's require strings but still need a
// friendly headline.

test("mapRevertReason: maps 'account does not exist' to the no-funds headline", () => {
  const entry = mapRevertReason("account does not exist");
  assert.equal(entry.headline, "Wallet has no funds on Somnia testnet");
  assert.ok(/faucet/i.test(entry.details));
  assert.ok(/testnet\.somnia\.network/i.test(entry.details));
});

test("mapRevertReason: maps the ethers v6 'could not coalesce error' wrapper", () => {
  // This is the exact form the user pastes from ErrorCard's tech details.
  const raw =
    'could not coalesce error (error={ "code": -32000, "data": "0x02", "message": "account does not exist" }, code=UNKNOWN_ERROR, version=6.16.0)';
  const entry = mapRevertReason(raw);
  assert.equal(entry.headline, "Wallet has no funds on Somnia testnet");
});

test("mapRevertReason: maps 'insufficient funds for gas' to the gas headline", () => {
  const entry = mapRevertReason("insufficient funds for gas * price + value");
  assert.equal(entry.headline, "Wallet balance too low to pay gas");
});

test("mapRevertReason: explicit contract revert wins over wrapper substring match", () => {
  // If the raw revert is an exact contract message, the exact-string map
  // should win even if a wrapper substring could also match. Guard against
  // future wrapper patterns shadowing real reverts.
  const entry = mapRevertReason("auth: not insurer");
  assert.equal(entry.headline, "Only the insurer can attach a policy");
});
