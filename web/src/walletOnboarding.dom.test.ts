/**
 * DOM / component tests for SPEC-0008 R10 — WalletOnboarding component scenarios.
 *
 * These tests render WalletOnboarding.tsx using React SSR (react-dom/server
 * renderToString) with a jsdom environment for localStorage. They are the
 * component-level complement to the pure-helper tests in walletOnboarding.test.ts.
 *
 * Collected by the `web/src/**\/*.test.ts` glob in the project test runner.
 *
 * Six SPEC-0008 R10 component scenarios tested here:
 *   DOM-T1 (R1)  — no-wallet render → modal + backdrop visible; load disabled.
 *   DOM-T2 (R3)  — valid key prefill → address derived + shown; load enabled;
 *                  invalid prefill → error shown; load still disabled.
 *   DOM-T3 (R4)  — insurer empty → modal renders; load enabled (provider valid);
 *                  insurer field labelled "(optional — defaults to provider)".
 *   DOM-T4 (R6)  — force-prompt prefill from env keys → both fields pre-filled;
 *                  both addresses shown; load enabled.
 *   DOM-T5 (R5)  — env-keys-present/unforced scenario: hasUsableProviderKey returns
 *                  true → needsWallet = false → WalletOnboarding NOT rendered.
 *   DOM-T6 (R7)  — after localStorage write, hasUsableProviderKey returns true →
 *                  gate clears without reload in the force-prompt=false path.
 *
 * DRY invariant (F3): WalletOnboarding must use the shared `deriveAddress` from
 * walletKeys.ts, not a local `tryDeriveAddress`. This is enforced here by
 * confirming the component source does not contain the local helper definition.
 *
 * Force-prompt loop invariant (F5): When VITE_FORCE_WALLET_PROMPT=1 and the user
 * successfully loads keys (writes to localStorage), re-evaluating the gate with
 * `hasUsableProviderKey()` must return true — so after reload the gate condition
 * `!hasUsableProviderKey() || forcePrompt` must be false. The fix requires the gate
 * to check localStorage FIRST and short-circuit `forcePrompt` once a valid key is
 * stored — so that the forcePrompt path does not cause an unbreakable loop.
 *
 * PHI-FREE: all key values are the public Hardhat/Anvil test vectors from the
 * Ethereum toolchain test suite. They hold no real funds and carry no patient data.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createRequire } from "node:module";

// ---------------------------------------------------------------------------
// Environment bootstrap: make React + jsdom available to the component.
// WalletOnboarding.tsx uses the `react-jsx` transform, which requires React in
// scope. We set globalThis.React so the legacy-compat shim works in Node.
// ---------------------------------------------------------------------------

// We use createRequire to pull jsdom from the project's node_modules.
const req = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { JSDOM } = req("jsdom") as typeof import("jsdom");

// React must be importable as an ES module in the tsx runtime.
import React from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

// Set up a jsdom window so localStorage + DOM APIs are available.
const dom = new JSDOM("<!DOCTYPE html><body><div id='root'></div></body>", {
  url: "http://localhost/",
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.localStorage = dom.window.localStorage;

// ---------------------------------------------------------------------------
// Synthetic secp256k1 test keys (PHI-free — Hardhat/Anvil public test vectors)
// ---------------------------------------------------------------------------

/** Public Hardhat/Anvil test vector #0. Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 */
const PROVIDER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/** Public Hardhat/Anvil test vector #1. Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 */
const INSURER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

/** A string that is NOT a valid secp256k1 key — triggers the invalid-key error path. */
const BAD_KEY = "not-a-valid-key";

// ---------------------------------------------------------------------------
// Import the component + helpers (after DOM globals are set)
// ---------------------------------------------------------------------------
import { renderToString } from "react-dom/server";
import { WalletOnboarding } from "./components/WalletOnboarding.js";
import { hasUsableProviderKey } from "./walletKeys.js";

// ---------------------------------------------------------------------------
// Helper: render the component to HTML string and inspect it.
// ---------------------------------------------------------------------------
function render(props: Parameters<typeof WalletOnboarding>[0]): string {
  return renderToString(React.createElement(WalletOnboarding, props));
}

// ---------------------------------------------------------------------------
// DOM-T1 (R1): No-wallet render — modal blocks; backdrop visible; load disabled.
// ---------------------------------------------------------------------------

test("DOM-T1 (R1): WalletOnboarding renders modal + backdrop when no prefill", () => {
  const html = render({ onLoaded: () => {} });

  assert.ok(
    html.includes("modal-backdrop"),
    "DOM-T1: backdrop element must be rendered (dims the app behind the modal)",
  );
  assert.ok(
    html.includes("wallet-onboarding-modal"),
    "DOM-T1: modal dialog must be rendered with data-testid wallet-onboarding-modal",
  );
  assert.ok(
    html.includes("provider-key-input"),
    "DOM-T1: provider key input must be present",
  );
  assert.ok(
    html.includes("insurer-key-input"),
    "DOM-T1: insurer key input must be present",
  );
});

test("DOM-T1 (R1): Load button is disabled when provider field is empty", () => {
  const html = render({ onLoaded: () => {} });

  // The Load button must be disabled when no key is provided.
  assert.ok(
    html.includes('disabled=""') || html.includes("disabled"),
    "DOM-T1: Load wallets button must be disabled when provider key is empty",
  );
});

test("DOM-T1 (R1): Provider and insurer inputs are masked (type=password)", () => {
  const html = render({ onLoaded: () => {} });

  // Both inputs must be type=password (masked by default).
  const providerPasswordCount = (html.match(/type="password"/g) ?? []).length;
  assert.ok(
    providerPasswordCount >= 2,
    `DOM-T1: both provider and insurer inputs must be type=password (masked), found ${providerPasswordCount}`,
  );
});

// ---------------------------------------------------------------------------
// DOM-T2 (R3): Valid key prefill → address derived + displayed; load enabled.
//              Invalid key prefill → error shown; load disabled.
// ---------------------------------------------------------------------------

test("DOM-T2 (R3): Valid provider key prefill shows derived address", () => {
  const html = render({ onLoaded: () => {}, prefillProvider: PROVIDER_KEY });

  // The derived address for PROVIDER_KEY is 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266.
  assert.ok(
    html.includes("0xf39F") || html.includes("provider-key-input-address"),
    "DOM-T2: derived provider address must be shown after valid prefill",
  );
});

test("DOM-T2 (R3): Load button is enabled after valid provider key prefill", () => {
  const html = render({ onLoaded: () => {}, prefillProvider: PROVIDER_KEY });

  // Load button must NOT be disabled when a valid provider key is pre-filled.
  assert.equal(
    html.includes('disabled=""'),
    false,
    "DOM-T2: Load wallets button must be enabled after valid provider key prefill",
  );
});

test("DOM-T2 (R3): Invalid key prefill shows inline error and keeps load disabled", () => {
  const html = render({ onLoaded: () => {}, prefillProvider: BAD_KEY });

  // An error element must appear for the invalid key.
  assert.ok(
    html.includes("provider-key-input-error"),
    "DOM-T2: inline error element must render for invalid provider key",
  );
  // Load button must remain disabled.
  assert.ok(
    html.includes('disabled=""') || html.includes("disabled"),
    "DOM-T2: Load button must remain disabled for invalid provider key",
  );
});

test("DOM-T2 (R3): WalletOnboarding derives address via the shared deriveAddress from walletKeys (DRY — F3)", () => {
  // SPEC-0008 §3 requires derivation to go through walletKeys.deriveAddress,
  // not a locally-defined tryDeriveAddress. This test asserts the component
  // source does NOT contain the local helper — it FAILS until WalletOnboarding.tsx
  // is refactored to import+use deriveAddress from walletKeys.ts.
  const src = readFileSync(
    new URL("./components/WalletOnboarding.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(
    src.includes("tryDeriveAddress"),
    false,
    "DOM-T2 (F3 DRY): WalletOnboarding.tsx must not define or use a local tryDeriveAddress — " +
    "use shared deriveAddress() from walletKeys.ts (SPEC-0008 §3)",
  );
  assert.equal(
    src.includes("new Wallet("),
    false,
    "DOM-T2 (F3 DRY): WalletOnboarding.tsx must not call new Wallet() directly — " +
    "use shared deriveAddress() from walletKeys.ts (SPEC-0008 §3)",
  );
  assert.match(
    src,
    /import[^;]*deriveAddress[^;]*walletKeys/,
    "DOM-T2 (F3 DRY): WalletOnboarding.tsx must import deriveAddress from walletKeys.ts",
  );
});

// ---------------------------------------------------------------------------
// DOM-T3 (R4): Insurer empty → load enabled (provider valid); insurer optional label.
// ---------------------------------------------------------------------------

test("DOM-T3 (R4): Insurer field has optional label (defaults to provider)", () => {
  const html = render({ onLoaded: () => {}, prefillProvider: PROVIDER_KEY });

  assert.ok(
    html.includes("optional") && html.includes("defaults to provider"),
    "DOM-T3: insurer key field must include '(optional — defaults to provider)' label",
  );
});

test("DOM-T3 (R4): Load enabled when provider valid and insurer empty", () => {
  const html = render({
    onLoaded: () => {},
    prefillProvider: PROVIDER_KEY,
    prefillInsurer: "",
  });

  assert.equal(
    html.includes('disabled=""'),
    false,
    "DOM-T3: Load button must be enabled when provider is valid and insurer is empty",
  );
});

test("DOM-T3 (R4): Load disabled when provider valid but insurer has invalid key", () => {
  const html = render({
    onLoaded: () => {},
    prefillProvider: PROVIDER_KEY,
    prefillInsurer: BAD_KEY,
  });

  assert.ok(
    html.includes('disabled=""') || html.includes("disabled"),
    "DOM-T3: Load button must be disabled when insurer field has an invalid key",
  );
  assert.ok(
    html.includes("insurer-key-input-error"),
    "DOM-T3: inline error must show for invalid insurer key",
  );
});

// ---------------------------------------------------------------------------
// DOM-T4 (R6): Force-prompt prefill from both env keys → addresses shown; load enabled.
// ---------------------------------------------------------------------------

test("DOM-T4 (R6): Both keys pre-filled → provider and insurer addresses shown", () => {
  const html = render({
    onLoaded: () => {},
    prefillProvider: PROVIDER_KEY,
    prefillInsurer: INSURER_KEY,
  });

  assert.ok(
    html.includes("provider-key-input-address"),
    "DOM-T4: provider address must be shown when pre-filled from env",
  );
  assert.ok(
    html.includes("insurer-key-input-address"),
    "DOM-T4: insurer address must be shown when pre-filled from env",
  );
});

test("DOM-T4 (R6): Both keys pre-filled → load enabled (no disabled attribute)", () => {
  const html = render({
    onLoaded: () => {},
    prefillProvider: PROVIDER_KEY,
    prefillInsurer: INSURER_KEY,
  });

  assert.equal(
    html.includes('disabled=""'),
    false,
    "DOM-T4: Load button must be enabled when both env keys are pre-filled and valid",
  );
});

// ---------------------------------------------------------------------------
// DOM-T5 (R5): Env keys present, forcePrompt off → hasUsableProviderKey true → no modal.
// ---------------------------------------------------------------------------

test("DOM-T5 (R5): hasUsableProviderKey returns true for env key → gate skips modal", () => {
  // Simulate the App.tsx gate: needsWallet = !hasUsableProviderKey() || forcePrompt.
  // With a valid env key injected and forcePrompt=false → needsWallet=false → no modal.
  const gateResult = hasUsableProviderKey({
    storageOverride: null,
    envKey: PROVIDER_KEY,
  });
  assert.equal(
    gateResult,
    true,
    "DOM-T5: gate must skip the modal (hasUsableProviderKey=true) when env key is valid + forcePrompt=false",
  );
});

// ---------------------------------------------------------------------------
// DOM-T6 (R7): After localStorage write, gate clears — no reload needed (unforced).
//
// Also tests the force-prompt loop fix (F5): the gate condition for the
// non-force path must see a valid localStorage key and return true, so that
// even if forcePrompt is a build-time constant, a gate implementation that
// checks localStorage first (before applying forcePrompt) can clear.
//
// The current broken gate: needsWallet = !hasUsableProviderKey() || forcePrompt
//   → forcePrompt=true makes this ALWAYS true even after load, causing an
//     inescapable modal loop (F5).
// The fixed gate: needsWallet = !hasUsableProviderKey()  (localStorage wins;
//   forcePrompt only triggers when there is NO usable key yet, not afterwards).
// ---------------------------------------------------------------------------

test("DOM-T6 (R7): hasUsableProviderKey returns true after simulated localStorage write", () => {
  // After the user pastes a key and clicks Load, it's written to localStorage.
  // Simulated here via storageOverride (production reads real localStorage).
  const gateAfterWrite = hasUsableProviderKey({
    storageOverride: PROVIDER_KEY,
    envKey: undefined,
  });
  assert.equal(
    gateAfterWrite,
    true,
    "DOM-T6: localStorage key written by WalletOnboarding.handleLoad must make gate true",
  );
});

test("DOM-T6 (F5 loop fix): gate needsWallet must be false once valid localStorage key exists, even with forcePrompt=true", () => {
  // SPEC-0008 §5 T4: 'loading proceeds against the env wallets'. After loading,
  // the gate must clear. The broken implementation: gate = !hasUsable() || forcePrompt
  // keeps needsWallet=true forever when forcePrompt is a build-time=1 constant.
  //
  // Correct gate semantics: hasUsableProviderKey returns true once localStorage is
  // written → needsWallet should become false regardless of forcePrompt.
  // The fix: gate = !hasUsableProviderKey() where forcePrompt only adds to the
  // initial condition (before any key is loaded), OR forcePrompt skips IF
  // localStorage already has a valid key.
  //
  // We test the INTENDED post-load state:
  //   localStorage has valid key → hasUsableProviderKey=true → !hasUsable()=false
  //   → even with forcePrompt=true, the gate must evaluate to false once the key exists.
  //
  // This test documents the required behavior. It FAILS until App.tsx is fixed
  // to not use the `|| forcePrompt` unconditional override.
  const hasKeyInStorage = hasUsableProviderKey({
    storageOverride: PROVIDER_KEY,
    envKey: undefined,
  });

  // Simulate the gate logic with the CORRECT semantics:
  // gate = !hasUsableProviderKey()  (localStorage key takes priority over forcePrompt)
  const correctGate = !hasKeyInStorage; // should be false (no modal needed)

  // Simulate the gate logic with the BROKEN semantics (current App.tsx):
  const forcePromptOn = true;
  const brokenGate = !hasKeyInStorage || forcePromptOn; // always true → infinite loop!

  assert.equal(
    correctGate,
    false,
    "DOM-T6 (F5): correct gate (localStorage key wins) must be false after writing key",
  );
  assert.equal(
    brokenGate,
    true,
    "DOM-T6 (F5): broken gate (|| forcePrompt) is always true — documents the bug",
  );

  // The actual test assertion: the gate that App.tsx uses must match `correctGate`
  // (false), not `brokenGate` (true). We inspect App.tsx source to confirm it
  // does NOT use the `|| forcePrompt` unconditional pattern after keys are loaded.
  const appSrc = readFileSync(
    new URL("./App.tsx", import.meta.url),
    "utf8",
  );

  // The broken pattern: `!hasUsableProviderKey() || forcePrompt` as the gate
  // This pattern makes forcePrompt=true override any loaded key → infinite loop.
  // The fix: use `!hasUsableProviderKey()` alone for the steady-state gate,
  // or use `forcePrompt && !hasUsableProviderKey()` for the initial-only force.
  const hasBrokenGatePattern = /!hasUsableProviderKey\(\)\s*\|\|\s*forcePrompt/.test(appSrc);
  assert.equal(
    hasBrokenGatePattern,
    false,
    "DOM-T6 (F5): App.tsx must not use `!hasUsableProviderKey() || forcePrompt` as the gate — " +
    "this causes an inescapable modal loop when VITE_FORCE_WALLET_PROMPT=1 is set (F5). " +
    "Use `!hasUsableProviderKey()` and handle forcePrompt only for the initial render, " +
    "or gate forcePrompt on there being no localStorage key.",
  );
});

// ---------------------------------------------------------------------------
// PHI-free invariant for this test file
// ---------------------------------------------------------------------------

test("DOM NO-PHI: no SSN/DOB/phone/email patterns in synthetic fixtures", () => {
  const fixtures = [PROVIDER_KEY, INSURER_KEY, BAD_KEY];
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
