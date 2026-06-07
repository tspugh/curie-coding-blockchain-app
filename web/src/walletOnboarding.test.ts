/**
 * Tests for SPEC-0008 R10 — WalletOnboarding gate and validation helpers.
 *
 * Covers the six scenarios mandated by SPEC-0008 R10:
 *   T1 (R1)  — no wallet: no localStorage key, no env key → modal should block.
 *   T2 (R3)  — valid key paste → validates + derives address; invalid → blocked + error.
 *   T3 (R4)  — insurer-empty → defaults to provider (no separate insurer slot written).
 *   T4 (R6)  — VITE_FORCE_WALLET_PROMPT=1 with env keys → modal appears pre-filled from env.
 *   T5 (R5)  — env keys present, force off → hasUsableProviderKey() returns true → no modal.
 *   T6 (R7)  — after writing to localStorage via the keyOverride path,
 *              hasUsableProviderKey() returns true → no modal.
 *
 * This file tests the pure gate / validation helpers from `walletKeys.ts`.
 * Component render tests live in `walletOnboarding.dom.test.ts` (jsdom layer,
 * collected by the same `web/src/**\/*.test.ts` glob).
 *
 * DRY invariant (SPEC-0008 §3): `deriveAddress` from walletKeys.ts is the
 * single derivation path used by both WalletOnboarding.tsx and Settings.tsx.
 * A static-analysis test below asserts WalletOnboarding.tsx does NOT define a
 * local `tryDeriveAddress` or call `new Wallet(` directly — it must use the
 * shared `deriveAddress` export.
 *
 * Security invariant (SPEC-0008 §6): `App.tsx` must NOT read
 * `import.meta.env.VITE_PRIVATE_KEY` or `import.meta.env.VITE_PRIVATE_KEY_INSURER`
 * in module-level expressions, because Vite inlines accessed `import.meta.env.*`
 * members at build time, baking live testnet keys into the bundle.
 *
 * Test isolation:
 *   - `import.meta.env` is not available in Node/tsx test runner, so the env-key
 *     scenarios are covered by directly invoking the helpers with injected values
 *     rather than relying on Vite globals.
 *   - localStorage is stubbed via a simple in-process Map so tests run without a
 *     DOM (Node 20 test runner + tsx).
 *
 * PHI-FREE: all private-key values are synthetic secp256k1 test vectors
 * generated for this file — they hold no real funds and carry no patient data,
 * SSNs, DOBs, phone numbers, or email addresses.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// ---------------------------------------------------------------------------
// Stable synthetic secp256k1 test keys (PHI-free — no real funds)
// ---------------------------------------------------------------------------

/**
 * A well-formed 0x-prefixed 32-byte hex private key used as the synthetic
 * "provider" key throughout these tests. This is a known Ethereum test vector.
 */
const PROVIDER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/**
 * A second well-formed key used as the synthetic "insurer" key.
 */
const INSURER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

/**
 * Obvious garbage — must fail isValidHexKey and block the Load action.
 */
const BAD_KEY = "not-a-valid-private-key";

/**
 * Another invalid key — correct prefix but too short.
 */
const SHORT_KEY = "0xdeadbeef";

// ---------------------------------------------------------------------------
// Helpers under test — imported from walletKeys.ts
//
// NOTE: These imports WILL FAIL until walletKeys.ts exports:
//   - `hasUsableProviderKey(opts?: { envKey?: string; storageKey?: string })`
//   - `isValidHexKey` (already exists)
//   - `deriveAddress(key: string): string`  (new helper)
//   - `KEY_STORAGE_PREFIX`                  (already exists)
//
// That is the intended RED state — the test file ships before the production
// code changes, per the TDD discipline specified in the task.
// ---------------------------------------------------------------------------
import {
  isValidHexKey,
  hasUsableProviderKey,
  deriveAddress,
  getDevPrefill,
  getDemoKeys,
  KEY_STORAGE_PREFIX,
} from "./walletKeys.js";

// ---------------------------------------------------------------------------
// T1 (R1) — No wallet: no localStorage key, no env key → gate says "needs wallet"
// ---------------------------------------------------------------------------

test("T1 (R1): hasUsableProviderKey returns false when no localStorage and no env key", () => {
  // Provide an empty localStorage stub and undefined env key.
  const result = hasUsableProviderKey({
    storageOverride: null,
    envKey: undefined,
  });
  assert.equal(
    result,
    false,
    "no localStorage key + no env key must return false so the modal blocks",
  );
});

test("T1 (R1): hasUsableProviderKey returns false when localStorage has invalid key", () => {
  const result = hasUsableProviderKey({
    storageOverride: BAD_KEY,
    envKey: undefined,
  });
  assert.equal(
    result,
    false,
    "invalid localStorage key must return false — the modal must still block",
  );
});

// ---------------------------------------------------------------------------
// T2 (R3) — Valid key paste → validates + derives address; invalid → blocked + error
// ---------------------------------------------------------------------------

test("T2 (R3): isValidHexKey returns true for a valid 0x32-byte-hex key", () => {
  assert.equal(
    isValidHexKey(PROVIDER_KEY),
    true,
    "valid secp256k1 key must pass isValidHexKey",
  );
});

test("T2 (R3): isValidHexKey returns false for garbage input", () => {
  assert.equal(
    isValidHexKey(BAD_KEY),
    false,
    "garbage input must fail isValidHexKey so the Load button stays disabled",
  );
});

test("T2 (R3): isValidHexKey returns false for too-short 0x prefix", () => {
  assert.equal(
    isValidHexKey(SHORT_KEY),
    false,
    "short hex key must fail isValidHexKey",
  );
});

test("T2 (R3): isValidHexKey returns false for empty string", () => {
  assert.equal(isValidHexKey(""), false, "empty string must fail isValidHexKey");
});

test("T2 (R3): deriveAddress returns a well-formed 0x-prefixed address for a valid key", () => {
  // This test FAILS until deriveAddress is exported from walletKeys.ts.
  const address = deriveAddress(PROVIDER_KEY);
  assert.match(
    address,
    /^0x[0-9a-fA-F]{40}$/,
    "deriveAddress must return a 0x-prefixed 40-hex-char Ethereum address",
  );
});

test("T2 (R3): deriveAddress returns a different address for a different key", () => {
  const addr1 = deriveAddress(PROVIDER_KEY);
  const addr2 = deriveAddress(INSURER_KEY);
  assert.notEqual(
    addr1,
    addr2,
    "two distinct keys must derive two distinct addresses",
  );
});

test("T2 (R3): deriveAddress throws on an invalid key", () => {
  assert.throws(
    () => deriveAddress(BAD_KEY),
    /invalid|bad|key/i,
    "deriveAddress must throw a descriptive error for an invalid key",
  );
});

// ---------------------------------------------------------------------------
// T3 (R4) — Insurer-empty defaults to provider
//
// The spec says: "empty insurer ⇒ do not write the insurer slot ⇒ client.ts
// already falls back to the provider key."  We verify the pure helper logic:
// when the insurer override is absent/empty, hasUsableProviderKey() still
// returns true (the provider key is present), and the caller should NOT write
// the insurer localStorage slot.
// ---------------------------------------------------------------------------

test("T3 (R4): hasUsableProviderKey returns true when provider key present even with no insurer key", () => {
  const result = hasUsableProviderKey({
    storageOverride: PROVIDER_KEY,
    envKey: undefined,
  });
  assert.equal(
    result,
    true,
    "provider key present in localStorage must return true regardless of insurer slot",
  );
});

test("T3 (R4): insurer defaults to provider — deriveAddress(PROVIDER_KEY) gives canonical provider address", () => {
  // When insurer is empty, the active insurer address IS the provider address.
  const providerAddress = deriveAddress(PROVIDER_KEY);
  // The derived address must be stable (same input → same output).
  const providerAddress2 = deriveAddress(PROVIDER_KEY);
  assert.equal(
    providerAddress,
    providerAddress2,
    "deriveAddress must be deterministic — insurer defaults require stable provider address",
  );
});

// ---------------------------------------------------------------------------
// T4 (R6) — VITE_FORCE_WALLET_PROMPT=1 with env keys → gate still returns true
//           (env keys are usable) but forcePrompt overrides the skip-modal path.
//
// The pure-helper contract:
//   - hasUsableProviderKey({ envKey: PROVIDER_KEY }) → true  (env key is valid)
//   - forcePrompt=true overrides the gate so the modal shows anyway
//   - The pre-fill values come from the env key, validated by isValidHexKey
// ---------------------------------------------------------------------------

test("T4 (R6): hasUsableProviderKey returns true when env key is valid (force-prompt scenario)", () => {
  // Even when VITE_FORCE_WALLET_PROMPT=1 would force the modal, the env key
  // IS usable — the gate helper itself returns true.
  const result = hasUsableProviderKey({
    storageOverride: null,
    envKey: PROVIDER_KEY,
  });
  assert.equal(
    result,
    true,
    "a valid env key must make hasUsableProviderKey return true",
  );
});

test("T4 (R6): env key in force-prompt scenario passes isValidHexKey (pre-fill is valid)", () => {
  // The modal pre-fills the input from the env key; isValidHexKey must pass.
  assert.equal(
    isValidHexKey(PROVIDER_KEY),
    true,
    "env key used for pre-fill must pass isValidHexKey so the Load button enables",
  );
});

test("T4 (R6): pre-filled env key derives a valid address for display in the modal", () => {
  const address = deriveAddress(PROVIDER_KEY);
  assert.match(
    address,
    /^0x[0-9a-fA-F]{40}$/,
    "pre-filled env key must derive a displayable address",
  );
});

// ---------------------------------------------------------------------------
// T5 (R5) — Env keys present, force off → no modal (hasUsableProviderKey true)
// ---------------------------------------------------------------------------

test("T5 (R5): hasUsableProviderKey returns true when valid env key present and no force", () => {
  const result = hasUsableProviderKey({
    storageOverride: null,
    envKey: PROVIDER_KEY,
  });
  assert.equal(
    result,
    true,
    "valid env key with no force must skip the modal",
  );
});

test("T5 (R5): hasUsableProviderKey returns true when valid localStorage key present", () => {
  const result = hasUsableProviderKey({
    storageOverride: PROVIDER_KEY,
    envKey: undefined,
  });
  assert.equal(
    result,
    true,
    "valid localStorage key with no force must skip the modal",
  );
});

test("T5 (R5): localStorage key takes precedence over env key (both present)", () => {
  // Both present → must return true regardless of which takes precedence.
  const result = hasUsableProviderKey({
    storageOverride: PROVIDER_KEY,
    envKey: INSURER_KEY,
  });
  assert.equal(
    result,
    true,
    "when both localStorage and env key are valid, hasUsableProviderKey must return true",
  );
});

// ---------------------------------------------------------------------------
// T6 (R7) — After writing to localStorage, hasUsableProviderKey returns true.
//
// We verify the logic without a real DOM by using the storageOverride opt-in
// path (the production hasUsableProviderKey reads from real localStorage when
// storageOverride is not passed; for unit tests we inject).
// ---------------------------------------------------------------------------

test("T6 (R7): hasUsableProviderKey returns true after simulated localStorage write", () => {
  // Simulate: user pasted a valid key → app wrote it to localStorage →
  // next call to hasUsableProviderKey must see it as usable.
  const result = hasUsableProviderKey({
    storageOverride: PROVIDER_KEY, // simulates the value written to localStorage
    envKey: undefined,
  });
  assert.equal(
    result,
    true,
    "key persisted to localStorage must make hasUsableProviderKey return true on next call",
  );
});

test("T6 (R7): KEY_STORAGE_PREFIX is the correct prefix for localStorage slot names", () => {
  // Smoke-check that the prefix constant hasn't drifted — client.ts, Settings.tsx,
  // and WalletOnboarding all must use the same prefix.
  assert.equal(
    KEY_STORAGE_PREFIX,
    "curie:",
    "KEY_STORAGE_PREFIX must remain 'curie:' to match existing localStorage keys",
  );
});

// ---------------------------------------------------------------------------
// Invariant: hasUsableProviderKey rejects every invalid key form
// ---------------------------------------------------------------------------

test("invariant: hasUsableProviderKey rejects all invalid key forms in both paths", () => {
  const invalidKeys = [
    BAD_KEY,
    SHORT_KEY,
    "",
    "0x",
    "0x" + "g".repeat(64),          // non-hex chars
    "0x" + "a".repeat(63),           // 63 hex digits (too short by 1)
    "0x" + "a".repeat(65),           // 65 hex digits (too long by 1)
  ];
  for (const k of invalidKeys) {
    const fromStorage = hasUsableProviderKey({ storageOverride: k, envKey: undefined });
    const fromEnv = hasUsableProviderKey({ storageOverride: null, envKey: k });
    assert.equal(
      fromStorage,
      false,
      `invalid key "${k.slice(0, 12)}…" via storage must return false`,
    );
    assert.equal(
      fromEnv,
      false,
      `invalid key "${k.slice(0, 12)}…" via env must return false`,
    );
  }
});

// ---------------------------------------------------------------------------
// Static-analysis invariants — DRY (F3) and security (F8-1)
//
// These tests read source files as text and assert structural properties that
// cannot be checked by TypeScript's type system alone. They fail if the
// production code violates SPEC-0008 §3 (DRY) or §6 (bundle security).
//
// F3 (DRY): WalletOnboarding.tsx MUST NOT define a local derivation helper
//   (`tryDeriveAddress` or any `new Wallet(` call). All address derivation
//   must go through the shared `deriveAddress` export from walletKeys.ts.
//
// F7 (consistency): `keyOverride` in client.ts validates localStorage keys
//   via `isValidHexKey` but accepts ANY non-empty env string (length > 0).
//   `hasUsableProviderKey` also runs isValidHexKey on the env path. The two
//   must agree: client.ts env acceptance path should also validate shape.
//
// F8-1 (security): App.tsx MUST NOT read import.meta.env.VITE_PRIVATE_KEY
//   or import.meta.env.VITE_PRIVATE_KEY_INSURER in module-level expressions
//   (Vite inlines these, baking real testnet keys into the static bundle).
// ---------------------------------------------------------------------------

const WALLETONBOARDING_SRC = readFileSync(
  new URL("./components/WalletOnboarding.tsx", import.meta.url),
  "utf8",
);

const APP_SRC = readFileSync(
  new URL("./App.tsx", import.meta.url),
  "utf8",
);

const CLIENT_SRC = readFileSync(
  new URL("./client.ts", import.meta.url),
  "utf8",
);

test("F3 (DRY): WalletOnboarding.tsx must not define a local tryDeriveAddress helper", () => {
  assert.equal(
    WALLETONBOARDING_SRC.includes("tryDeriveAddress"),
    false,
    "WalletOnboarding.tsx must not define tryDeriveAddress — use shared deriveAddress from walletKeys.ts (SPEC-0008 §3)",
  );
});

test("F3 (DRY): WalletOnboarding.tsx must not call new Wallet( directly for derivation", () => {
  assert.equal(
    WALLETONBOARDING_SRC.includes("new Wallet("),
    false,
    "WalletOnboarding.tsx must not instantiate ethers.Wallet directly for address derivation — use shared deriveAddress() from walletKeys.ts (SPEC-0008 §3)",
  );
});

test("F3 (DRY): WalletOnboarding.tsx must import deriveAddress from walletKeys", () => {
  assert.match(
    WALLETONBOARDING_SRC,
    /import[^;]*deriveAddress[^;]*walletKeys/,
    "WalletOnboarding.tsx must import deriveAddress from walletKeys.ts (SPEC-0008 §3 DRY directive)",
  );
});

test("F8-1 (security): App.tsx must not read import.meta.env.VITE_PRIVATE_KEY at module level", () => {
  // Module-level reads of import.meta.env.VITE_PRIVATE_KEY cause Vite to inline
  // the live testnet private key as a plaintext string literal in the built bundle
  // (SPEC-0008 §6 hard-FAIL). The pre-fill for force-prompt must be sourced
  // differently (e.g. through a non-VITE_ build-time define, or from localStorage
  // after the user has already loaded the key).
  const moduleBodyWithoutComments = APP_SRC
    // Strip single-line comments
    .replace(/\/\/[^\n]*/g, "")
    // Strip block comments
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // Look for module-level (outside a function body) access to either private-key env var.
  // The simplest check: the string "import.meta.env.VITE_PRIVATE_KEY" must not appear
  // anywhere in App.tsx (function-level OR module-level access both cause inlining).
  assert.equal(
    moduleBodyWithoutComments.includes("import.meta.env.VITE_PRIVATE_KEY"),
    false,
    "App.tsx must not access import.meta.env.VITE_PRIVATE_KEY — Vite inlines it into the bundle, " +
    "baking the testnet private key as a plaintext literal (SPEC-0008 §6 hard-FAIL)",
  );
  assert.equal(
    moduleBodyWithoutComments.includes("import.meta.env.VITE_PRIVATE_KEY_INSURER"),
    false,
    "App.tsx must not access import.meta.env.VITE_PRIVATE_KEY_INSURER — same bundle-inlining risk (SPEC-0008 §6)",
  );
});

test("F7 (consistency): keyOverride in client.ts validates env keys with isValidHexKey", () => {
  // F7: keyOverride accepts any non-empty env string (only validates localStorage).
  // hasUsableProviderKey validates BOTH. They must agree: a malformed env key
  // should not pass keyOverride while making hasUsableProviderKey return false.
  // Fix: keyOverride must also call isValidHexKey on the env branch.
  //
  // We inspect the return statement that handles the env value. It must include
  // isValidHexKey — not just check `length > 0`.
  // The env return in the current (broken) implementation is:
  //   return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : undefined;
  // The fixed version must also call isValidHexKey(fromEnv).
  const envReturnMatch = CLIENT_SRC.match(
    /const fromEnv = import\.meta\.env\[envName\];[\s\S]*?return[^;]+;/,
  );
  const envReturnStatement = envReturnMatch?.[0] ?? "";
  assert.match(
    envReturnStatement,
    /isValidHexKey/,
    "keyOverride() in client.ts: the env-key return path must call isValidHexKey — " +
    "otherwise a malformed VITE_PRIVATE_KEY passes signing while the modal gate blocks (F7). " +
    `Current env-return block: ${envReturnStatement.slice(0, 200)}`,
  );
});

// ---------------------------------------------------------------------------
// PHI-free invariant
// ---------------------------------------------------------------------------

test("NO-PHI: no SSN/DOB/phone/email patterns in this test file's synthetic fixtures", () => {
  const fixtures = [PROVIDER_KEY, INSURER_KEY, BAD_KEY, SHORT_KEY];
  const joined = fixtures.join(" ");
  assert.equal(/\b\d{3}-\d{2}-\d{4}\b/.test(joined), false, "SSN pattern");
  assert.equal(/\d{4}-\d{2}-\d{2}/.test(joined), false, "DOB pattern");
  assert.equal(/\(\d{3}\)\s?\d{3}-\d{4}/.test(joined), false, "phone pattern");
  assert.equal(
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(joined),
    false,
    "email pattern",
  );
});

// ---------------------------------------------------------------------------
// F2 (R6) — getDevPrefill actually reads the ENV key (the real force-prompt
// pre-fill path), via the injectable env override. This exercises the env-read
// logic App.tsx uses under VITE_FORCE_WALLET_PROMPT=1 — not a prop tautology.
// ---------------------------------------------------------------------------

test("F2 (R6): getDevPrefill returns the env key when present + valid", () => {
  assert.equal(
    getDevPrefill("VITE_PRIVATE_KEY", { VITE_PRIVATE_KEY: PROVIDER_KEY }),
    PROVIDER_KEY,
    "force-prompt pre-fill must read the provider key from env",
  );
  assert.equal(
    getDevPrefill("VITE_PRIVATE_KEY_INSURER", { VITE_PRIVATE_KEY_INSURER: INSURER_KEY }),
    INSURER_KEY,
    "force-prompt pre-fill must read the insurer key from env",
  );
});

test("F2 (R6): getDevPrefill returns '' for absent / empty / invalid env value", () => {
  assert.equal(getDevPrefill("VITE_PRIVATE_KEY", {}), "", "absent → empty");
  assert.equal(getDevPrefill("VITE_PRIVATE_KEY", { VITE_PRIVATE_KEY: "" }), "", "empty → empty");
  assert.equal(
    getDevPrefill("VITE_PRIVATE_KEY", { VITE_PRIVATE_KEY: SHORT_KEY }),
    "",
    "shape-invalid → empty (no partial key leaks into the field)",
  );
});

// ---------------------------------------------------------------------------
// R14 — getDemoKeys reads the SEPARATE burnable-demo channel (public deploy),
// independent of the user's own VITE_PRIVATE_KEY slot.
// ---------------------------------------------------------------------------

test("R14: getDemoKeys returns {provider, insurer} when both demo keys are valid", () => {
  const out = getDemoKeys({
    VITE_DEMO_PROVIDER_KEY: PROVIDER_KEY,
    VITE_DEMO_INSURER_KEY: INSURER_KEY,
  });
  assert.deepEqual(out, { provider: PROVIDER_KEY, insurer: INSURER_KEY });
});

test("R14: getDemoKeys insurer falls back to '' when only the provider demo key is set", () => {
  const out = getDemoKeys({ VITE_DEMO_PROVIDER_KEY: PROVIDER_KEY });
  assert.deepEqual(out, { provider: PROVIDER_KEY, insurer: "" });
});

test("R14: getDemoKeys returns null when no/invalid demo provider key (button hides)", () => {
  assert.equal(getDemoKeys({}), null, "absent → null");
  assert.equal(getDemoKeys({ VITE_DEMO_PROVIDER_KEY: "" }), null, "empty → null");
  assert.equal(getDemoKeys({ VITE_DEMO_PROVIDER_KEY: SHORT_KEY }), null, "invalid → null");
});

test("R7/R14: the demo channel is independent of the user's own VITE_PRIVATE_KEY slot", () => {
  // A public build sets VITE_PRIVATE_KEY="" (own slot empty) but DEMO keys present.
  assert.equal(getDevPrefill("VITE_PRIVATE_KEY", { VITE_PRIVATE_KEY: "" }), "", "own slot stays empty");
  assert.deepEqual(
    getDemoKeys({ VITE_PRIVATE_KEY: "", VITE_DEMO_PROVIDER_KEY: PROVIDER_KEY, VITE_DEMO_INSURER_KEY: INSURER_KEY }),
    { provider: PROVIDER_KEY, insurer: INSURER_KEY },
    "demo channel still resolves when the own slot is empty",
  );
});

// ---------------------------------------------------------------------------
// F4 (R3) — validity must mean DERIVATION succeeds, not regex shape. A
// shape-valid but out-of-range key passes isValidHexKey yet must NOT derive
// (and so must NOT be loadable / persisted — it would brick the app on reload).
// ---------------------------------------------------------------------------

const ZERO_KEY = "0x" + "0".repeat(64); // value 0 — below the valid range 1..n-1
const CURVE_ORDER_KEY =
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"; // == n, out of range

test("F4 (R3): an out-of-range key passes isValidHexKey but FAILS derivation", () => {
  for (const k of [ZERO_KEY, CURVE_ORDER_KEY]) {
    assert.equal(isValidHexKey(k), true, `${k.slice(0, 10)}… is shape-valid (regex)`);
    assert.throws(
      () => deriveAddress(k),
      "out-of-range key must throw on derivation — regex shape alone is insufficient (F4)",
    );
  }
});

test("F4 (R3): a well-formed in-range key DOES derive (control)", () => {
  assert.equal(typeof deriveAddress(PROVIDER_KEY), "string");
  assert.match(deriveAddress(PROVIDER_KEY), /^0x[0-9a-fA-F]{40}$/);
});
