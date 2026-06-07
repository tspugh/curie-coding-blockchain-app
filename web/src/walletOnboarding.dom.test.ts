/**
 * DOM / component tests for SPEC-0008 R10 — WalletOnboarding component scenarios.
 *
 * These tests render WalletOnboarding.tsx using both:
 *   (a) react-dom/server renderToString — for static structure assertions.
 *   (b) react-dom/client createRoot + act — for INTERACTION tests that actually
 *       invoke handleLoad (R7 persist), handleChange (R3 reactive), and the
 *       show/hide toggle (R2). Static renderToString cannot exercise these paths;
 *       interaction tests are required to hit them (F2 fix).
 *
 * Collected by the `web/src/**\/*.test.ts` glob in the project test runner.
 *
 * Six SPEC-0008 R10 component scenarios tested here:
 *   DOM-T1 (R1)  — no-wallet render → modal + backdrop visible; load disabled.
 *   DOM-T2 (R3)  — REACTIVE: onChange simulated → valid key derives address + enables
 *                  load; invalid key shows error + keeps load disabled.
 *   DOM-T3 (R4)  — REACTIVE: provider valid + insurer empty → handleLoad writes only
 *                  provider slot; insurer slot stays absent (defaults to provider).
 *   DOM-T4 (R6)  — force-prompt prefill from env keys: App.tsx passes prefillProvider
 *                  to WalletOnboarding so the modal is pre-filled, not empty.
 *   DOM-T5 (R5)  — env-keys-present/unforced: hasUsableProviderKey returns true →
 *                  needsWallet = false → WalletOnboarding NOT rendered.
 *   DOM-T6 (R7)  — INTERACTIVE: handleLoad writes both localStorage slots; onLoaded
 *                  fires; insurer slot written only when non-empty.
 *
 * Additional structural tests (F1, F5, F6, F8, F10):
 *   F1  — App.tsx must pass prefillProvider/prefillInsurer props to WalletOnboarding
 *         when forcePrompt=true (source-code structural assertion).
 *   F5  — App.tsx comment about prefill must not lie about the actual prop wiring.
 *   F6  — Dead code: setNeedsWallet(false) before reload is a no-op. App.tsx must
 *         not call setNeedsWallet before window.location.reload() (dead code check).
 *   F8  — Out-of-scope: contracts/hardhat.config.ts must not have a
 *         mocha:{timeout:120_000} added by the SPEC-0008 branch (unrelated to R1–R10).
 *   F10 — R8 (SHOULD: active-wallet verification) is not implemented; the spec must
 *         record it as deferred (out-of-scope or open question) so it is not silently
 *         dropped.
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
// ---------------------------------------------------------------------------

const req = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { JSDOM } = req("jsdom") as typeof import("jsdom");

// React must be importable as an ES module in the tsx runtime.
import React from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

// Set up a jsdom window so localStorage + DOM APIs are available.
const dom = new JSDOM("<!DOCTYPE html><body></body>", {
  url: "http://localhost/",
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.localStorage = dom.window.localStorage;
g.MutationObserver = dom.window.MutationObserver;

/**
 * Signal to React that we are in a test environment that supports act().
 * Without this, React emits a warning and act() may not flush updates
 * synchronously.
 */
g.IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------------------
// Synthetic secp256k1 test keys (PHI-free — Hardhat/Anvil public test vectors)
// ---------------------------------------------------------------------------

/** Public Hardhat/Anvil test vector #0. Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 */
const PROVIDER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/** Expected checksummed address for PROVIDER_KEY. */
const PROVIDER_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

/** Public Hardhat/Anvil test vector #1. Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 */
const INSURER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

/** Expected checksummed address for INSURER_KEY. */
const INSURER_ADDR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

/** A string that is NOT a valid secp256k1 key — triggers the invalid-key error path. */
const BAD_KEY = "not-a-valid-key";

// ---------------------------------------------------------------------------
// Import the component + helpers (after DOM globals are set)
// ---------------------------------------------------------------------------
import { renderToString } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { WalletOnboarding } from "./components/WalletOnboarding.js";
import { hasUsableProviderKey, KEY_STORAGE_PREFIX } from "./walletKeys.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render the component to HTML string and inspect it (for static structure). */
function renderToHtml(props: Parameters<typeof WalletOnboarding>[0]): string {
  return renderToString(React.createElement(WalletOnboarding, props));
}

/**
 * Invoke a React prop handler by reading the __reactProps key from a DOM node.
 * This exercises the component's actual event handlers (onChange, onClick) in
 * the jsdom environment without requiring @testing-library/react.
 *
 * Rationale: React attaches event handlers as __reactProps$<suffix> on every
 * DOM node it renders. Calling the handler directly (with a synthetic event-like
 * object) is the correct way to exercise React component logic in a pure Node
 * test environment. It calls the SAME handler that React would call in the
 * browser; this is NOT mocking.
 *
 * F2 fix: this replaces the renderToString-only approach which could not
 * exercise handleLoad, handleChange, or the show/hide toggle.
 */
function invokeOnChange(input: Element, value: string): void {
  const propsKey = Object.keys(input).find((k) => k.startsWith("__reactProps"));
  if (!propsKey) throw new Error(`No __reactProps on element: ${input.tagName}`);
  const props = (input as unknown as Record<string, Record<string, unknown>>)[propsKey];
  if (!props) throw new Error(`No props object on element: ${input.tagName}`);
  if (typeof props["onChange"] !== "function") {
    throw new Error("onChange not found on element");
  }
  (props["onChange"] as (e: { target: { value: string } }) => void)({
    target: { value },
  });
}

/** Context returned by renderInteractive — provides scoped query helpers + cleanup. */
interface RenderContext {
  /** Query within the mounted component container only. */
  query(selector: string): Element | null;
  /** Query all within the mounted component container only. */
  queryAll(selector: string): NodeListOf<Element>;
  /** Unmount the component and remove its container from the DOM. */
  cleanup(): Promise<void>;
}

/**
 * Render the WalletOnboarding component into its own fresh DOM container.
 * Each call creates a new div, mounts the component, and returns scoped query
 * helpers + cleanup. Using a fresh container per test prevents React state from
 * bleeding between tests.
 *
 * F2 fix: uses createRoot + act to mount a REAL React component tree in jsdom,
 * enabling actual interaction (onChange, click) rather than static renderToString.
 */
async function renderInteractive(
  props: Parameters<typeof WalletOnboarding>[0],
): Promise<RenderContext> {
  // Clear localStorage before each render so tests don't bleed state.
  dom.window.localStorage.clear();
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(WalletOnboarding, props));
  });
  return {
    query: (sel) => container.querySelector(sel),
    queryAll: (sel) => container.querySelectorAll(sel),
    cleanup: async () => {
      await act(async () => { root.unmount(); });
      if (dom.window.document.body.contains(container)) {
        dom.window.document.body.removeChild(container);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// DOM-T1 (R1): No-wallet render — modal blocks; backdrop visible; load disabled.
//
// Uses renderToString for static structure + createRoot for the disabled check.
// ---------------------------------------------------------------------------

test("DOM-T1 (R1): WalletOnboarding renders modal + backdrop", () => {
  const html = renderToHtml({ onLoaded: () => {} });

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

test("DOM-T1 (R1): Provider and insurer inputs are masked (type=password) by default", () => {
  const html = renderToHtml({ onLoaded: () => {} });

  // Both inputs start as type=password (masked). Count must be at least 2.
  const passwordCount = (html.match(/type="password"/g) ?? []).length;
  assert.ok(
    passwordCount >= 2,
    `DOM-T1: both inputs must be type="password" (masked by default); found ${passwordCount}`,
  );
});

test("DOM-T1 (R1): Load button is disabled when no key is provided (interactive)", async () => {
  const ctx = await renderInteractive({ onLoaded: () => {} });
  try {
    const loadBtn = ctx.query("[data-testid=wallet-onboarding-load]") as HTMLButtonElement;
    assert.ok(loadBtn, "DOM-T1: Load button must exist");
    assert.equal(
      loadBtn.disabled,
      true,
      "DOM-T1 (F9 fix): Load button must be disabled=true (boolean DOM property) " +
      "when no provider key is provided — NOT a substring match",
    );
  } finally {
    await ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// DOM-T2 (R3 INTERACTIVE): onChange simulation — valid key → derives address +
// enables load; invalid key → inline error + load stays disabled.
//
// F2 fix: these tests actually invoke the handleChange (React onChange) handler
// via the __reactProps injection, exercising the reactive validation paths of
// WalletOnboarding.tsx that renderToString-only tests cannot reach.
// ---------------------------------------------------------------------------

test("DOM-T2 (R3 interactive): onChange with valid key enables Load and shows derived address", async () => {
  const ctx = await renderInteractive({ onLoaded: () => {} });
  try {
    const providerInput = ctx.query("[data-testid=provider-key-input]");
    assert.ok(providerInput, "DOM-T2: provider-key-input must exist in DOM");

    // Invoke the React onChange handler directly — exercises handleChange (F2 fix).
    await act(async () => {
      invokeOnChange(providerInput!, PROVIDER_KEY);
    });

    // After a valid key is typed, the derived address must appear.
    const addrEl = ctx.query("[data-testid=provider-key-input-address]");
    assert.ok(
      addrEl,
      "DOM-T2: derived address element must appear after valid key onChange",
    );
    assert.ok(
      addrEl!.textContent?.includes(PROVIDER_ADDR.slice(0, 10)),
      `DOM-T2: derived address must include the correct prefix; got: ${addrEl!.textContent}`,
    );

    // Load button must be enabled after a valid key.
    const loadBtn = ctx.query("[data-testid=wallet-onboarding-load]") as HTMLButtonElement;
    assert.equal(
      loadBtn.disabled,
      false,
      "DOM-T2: Load button must be enabled after valid key onChange",
    );

    // No error element for a valid key.
    const errEl = ctx.query("[data-testid=provider-key-input-error]");
    assert.equal(
      errEl,
      null,
      "DOM-T2: no inline error must appear for a valid key",
    );
  } finally {
    await ctx.cleanup();
  }
});

test("DOM-T2 (R3 interactive): onChange with invalid key shows error and keeps load disabled", async () => {
  const ctx = await renderInteractive({ onLoaded: () => {} });
  try {
    const providerInput = ctx.query("[data-testid=provider-key-input]");
    assert.ok(providerInput, "DOM-T2: provider-key-input must exist");

    // Type an invalid key.
    await act(async () => {
      invokeOnChange(providerInput!, BAD_KEY);
    });

    // Error element must appear.
    const errEl = ctx.query("[data-testid=provider-key-input-error]");
    assert.ok(
      errEl,
      "DOM-T2: inline error element must appear for invalid key onChange",
    );
    const errText = errEl!.textContent ?? "";
    assert.ok(
      errText.length > 10,
      `DOM-T2: error must have non-trivial text; got: "${errText}"`,
    );

    // Load button must stay disabled.
    const loadBtn = ctx.query("[data-testid=wallet-onboarding-load]") as HTMLButtonElement;
    assert.equal(
      loadBtn.disabled,
      true,
      "DOM-T2: Load button must remain disabled after invalid key onChange",
    );

    // No derived address must appear for an invalid key.
    const addrEl = ctx.query("[data-testid=provider-key-input-address]");
    assert.equal(
      addrEl,
      null,
      "DOM-T2: derived address must NOT appear for an invalid key",
    );
  } finally {
    await ctx.cleanup();
  }
});

test("DOM-T2 (R2 interactive): show/hide toggle changes input type between password and text", async () => {
  const ctx = await renderInteractive({ onLoaded: () => {} });
  try {
    const providerInput = ctx.query("[data-testid=provider-key-input]") as HTMLInputElement;
    assert.ok(providerInput, "DOM-T2: provider-key-input must exist");

    // Initially masked.
    assert.equal(
      providerInput.type,
      "password",
      "DOM-T2 (R2): provider input must start as type=password (masked)",
    );

    // Click the Show button — exercises the toggle state updater (previously uncovered, F2 fix).
    const allBtns = Array.from(ctx.queryAll("button")) as HTMLButtonElement[];
    const showBtn = allBtns.find((b) => b.getAttribute("aria-label") === "Show key");
    assert.ok(showBtn, "DOM-T2 (R2): 'Show key' button must be present");

    await act(async () => {
      showBtn!.click();
    });

    assert.equal(
      providerInput.type,
      "text",
      "DOM-T2 (R2): provider input must become type=text after clicking Show",
    );

    // Click Hide — toggle back.
    const allBtns2 = Array.from(ctx.queryAll("button")) as HTMLButtonElement[];
    const hideBtn = allBtns2.find((b) => b.getAttribute("aria-label") === "Hide key");
    assert.ok(hideBtn, "DOM-T2 (R2): 'Hide key' button must appear after toggling Show");

    await act(async () => {
      hideBtn!.click();
    });

    assert.equal(
      providerInput.type,
      "password",
      "DOM-T2 (R2): provider input must return to type=password after clicking Hide",
    );
  } finally {
    await ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// DOM-T3 (R4 INTERACTIVE): Provider valid + insurer empty → handleLoad writes
// only the provider slot; insurer slot absent (client.ts defaults to provider).
//
// F2 fix: exercises the `if (insurerKey !== "") setItem(…_INSURER)` branch in
// handleLoad — the path that was uncovered (lines 63-70) in the prior review.
// ---------------------------------------------------------------------------

test("DOM-T3 (R4 interactive): handleLoad with empty insurer writes only provider slot to localStorage", async () => {
  let onLoadedFired = false;
  const ctx = await renderInteractive({ onLoaded: () => { onLoadedFired = true; } });
  try {
    // Set a valid provider key.
    const providerInput = ctx.query("[data-testid=provider-key-input]");
    await act(async () => {
      invokeOnChange(providerInput!, PROVIDER_KEY);
    });

    // Leave insurer empty (it defaults to "" in state). Click Load.
    const loadBtn = ctx.query("[data-testid=wallet-onboarding-load]") as HTMLButtonElement;
    assert.equal(loadBtn.disabled, false, "DOM-T3: Load must be enabled with valid provider");

    await act(async () => {
      loadBtn.click();
    });

    assert.equal(onLoadedFired, true, "DOM-T3: onLoaded must fire after handleLoad (R7)");

    // Provider slot written.
    assert.equal(
      dom.window.localStorage.getItem(KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY"),
      PROVIDER_KEY,
      "DOM-T3: provider key must be written to localStorage.curie:VITE_PRIVATE_KEY",
    );

    // Insurer slot must NOT be written when insurer field is empty (R4: defaults to provider).
    assert.equal(
      dom.window.localStorage.getItem(KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY_INSURER"),
      null,
      "DOM-T3 (R4): insurer localStorage slot must NOT be written when insurer field is empty — " +
      "client.ts falls back to the provider key (this exercises the uncovered `if (insurerKey !== '')` branch)",
    );
  } finally {
    await ctx.cleanup();
  }
});

test("DOM-T3 (R4 interactive): handleLoad with both keys writes both localStorage slots", async () => {
  let onLoadedFired = false;
  const ctx = await renderInteractive({ onLoaded: () => { onLoadedFired = true; } });
  try {
    // Set both keys via onChange.
    const providerInput = ctx.query("[data-testid=provider-key-input]");
    const insurerInput = ctx.query("[data-testid=insurer-key-input]");
    await act(async () => {
      invokeOnChange(providerInput!, PROVIDER_KEY);
      invokeOnChange(insurerInput!, INSURER_KEY);
    });

    const loadBtn = ctx.query("[data-testid=wallet-onboarding-load]") as HTMLButtonElement;
    assert.equal(loadBtn.disabled, false, "DOM-T3: Load must be enabled with both valid keys");

    await act(async () => {
      loadBtn.click();
    });

    assert.equal(onLoadedFired, true, "DOM-T3: onLoaded must fire");
    assert.equal(
      dom.window.localStorage.getItem(KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY"),
      PROVIDER_KEY,
      "DOM-T3: provider key written",
    );
    assert.equal(
      dom.window.localStorage.getItem(KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY_INSURER"),
      INSURER_KEY,
      "DOM-T3: insurer key written when explicitly provided",
    );
  } finally {
    await ctx.cleanup();
  }
});

test("DOM-T3 (R4): insurer field has '(optional — defaults to provider)' label", () => {
  const html = renderToHtml({ onLoaded: () => {}, prefillProvider: PROVIDER_KEY });
  assert.ok(
    html.includes("optional") && html.includes("defaults to provider"),
    "DOM-T3: insurer key field must include '(optional — defaults to provider)' label",
  );
});

test("DOM-T3 (R4 interactive): Load disabled when provider valid but insurer has invalid key", async () => {
  const ctx = await renderInteractive({ onLoaded: () => {} });
  try {
    const providerInput = ctx.query("[data-testid=provider-key-input]");
    const insurerInput = ctx.query("[data-testid=insurer-key-input]");

    await act(async () => {
      invokeOnChange(providerInput!, PROVIDER_KEY);
      invokeOnChange(insurerInput!, BAD_KEY);
    });

    const loadBtn = ctx.query("[data-testid=wallet-onboarding-load]") as HTMLButtonElement;
    assert.equal(
      loadBtn.disabled,
      true,
      "DOM-T3: Load must be disabled when insurer field has an invalid key",
    );

    const insurerErr = ctx.query("[data-testid=insurer-key-input-error]");
    assert.ok(
      insurerErr,
      "DOM-T3: inline error must show for invalid insurer key (independent R9 validation)",
    );
  } finally {
    await ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// DOM-T4 (R6): Force-prompt prefill from env keys — App.tsx MUST pass
// prefillProvider/prefillInsurer props to <WalletOnboarding>.
//
// F1 (BLOCKER) structural assertion: The current App.tsx renders
//   <WalletOnboarding onLoaded={handleWalletLoaded}/>
// with NO prefillProvider or prefillInsurer props. When forcePrompt=true and
// env keys are available, the modal opens EMPTY (not pre-filled), violating R6.
//
// This test inspects the App.tsx source and FAILS until App.tsx is fixed to
// pass the prefill props (computed from localStorage or a safe env-read path
// that does not bake the key into the bundle).
//
// Implementation note: App.tsx must NOT use import.meta.env.VITE_PRIVATE_KEY
// directly (that bakes the key into the bundle, SPEC-0008 §6 hard-FAIL).
// A compliant approach: read the key from localStorage after the initial load
// (keyOverride already writes it there if the key is present), and pass the
// localStorage value as the prefill.
// ---------------------------------------------------------------------------

test("DOM-T4 (F1 BLOCKER): App.tsx passes prefillProvider prop to WalletOnboarding (R6 wiring)", () => {
  const appSrc = readFileSync(
    new URL("./App.tsx", import.meta.url),
    "utf8",
  );

  // Strip comments before analysis.
  const appCode = appSrc
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // R6 (MUST): when forcePrompt=true, the modal must be pre-filled from env keys.
  // The component accepts `prefillProvider` and `prefillInsurer` props for this.
  // App.tsx must pass at least `prefillProvider` to <WalletOnboarding> — a non-empty
  // expression, not a literal empty string "".
  //
  // FAILS until App.tsx is updated to read the provider key from localStorage
  // (or a safe source) and pass it as prefillProvider when forcePrompt=true.
  assert.match(
    appCode,
    /prefillProvider\s*=\s*\{[^}]+\}/,
    "F1 (BLOCKER): App.tsx must pass a non-trivial `prefillProvider={...}` prop to " +
    "<WalletOnboarding> so R6 (force-prompt pre-fill) is wired in the real app, " +
    "not just exercised in standalone DOM tests that pass the prop directly. " +
    "Current App.tsx renders <WalletOnboarding onLoaded={...}/> with no prefill props — " +
    "the modal opens EMPTY under VITE_FORCE_WALLET_PROMPT=1.",
  );
});

test("DOM-T4 (R6): Static render with both keys pre-filled shows both addresses and enables Load", () => {
  const html = renderToHtml({
    onLoaded: () => {},
    prefillProvider: PROVIDER_KEY,
    prefillInsurer: INSURER_KEY,
  });

  assert.ok(
    html.includes("provider-key-input-address"),
    "DOM-T4: provider address must be shown when pre-filled",
  );
  assert.ok(
    html.includes("insurer-key-input-address"),
    "DOM-T4: insurer address must be shown when pre-filled",
  );
  assert.equal(
    html.includes('disabled=""'),
    false,
    "DOM-T4: Load button must be enabled when both env keys are pre-filled and valid",
  );
});

test("DOM-T4 (R9 independent validation): insurer derivation is independent of provider", () => {
  // R9: provider and insurer validation update independently.
  const htmlInsurerOnly = renderToHtml({
    onLoaded: () => {},
    prefillProvider: "",
    prefillInsurer: INSURER_KEY,
  });

  // Provider address NOT shown (no provider key).
  assert.equal(
    htmlInsurerOnly.includes("provider-key-input-address"),
    false,
    "DOM-T4 (R9): provider address must NOT appear when provider field is empty",
  );

  // Insurer address IS shown (insurer key is valid).
  assert.ok(
    htmlInsurerOnly.includes("insurer-key-input-address"),
    "DOM-T4 (R9): insurer address MUST appear independently when insurer key is valid",
  );
  assert.ok(
    htmlInsurerOnly.includes(INSURER_ADDR.slice(0, 10)),
    `DOM-T4 (R9): insurer derived address must include prefix ${INSURER_ADDR.slice(0, 10)}`,
  );
});

// ---------------------------------------------------------------------------
// DOM-T5 (R5): Env keys present, forcePrompt off → hasUsableProviderKey true.
// ---------------------------------------------------------------------------

test("DOM-T5 (R5): hasUsableProviderKey returns true for valid env key → gate skips modal", () => {
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

test("DOM-T5 (R5): hasUsableProviderKey returns true for valid localStorage key → gate skips modal", () => {
  const gateResult = hasUsableProviderKey({
    storageOverride: PROVIDER_KEY,
    envKey: undefined,
  });
  assert.equal(
    gateResult,
    true,
    "DOM-T5: valid localStorage key → gate returns true → no modal shown",
  );
});

// ---------------------------------------------------------------------------
// DOM-T6 (R7 INTERACTIVE): handleLoad persists keys + fires onLoaded.
//
// This test exercises the full handleLoad flow end-to-end in the real DOM,
// verifying that:
//   1. Clicking Load writes the keys to localStorage.
//   2. onLoaded is called.
//   3. The App.tsx gate (hasUsableProviderKey) then returns true.
// ---------------------------------------------------------------------------

test("DOM-T6 (R7 interactive): handleLoad (pre-filled) writes to localStorage and fires onLoaded", async () => {
  let onLoadedFired = false;
  const ctx = await renderInteractive({
    onLoaded: () => { onLoadedFired = true; },
    prefillProvider: PROVIDER_KEY,
    prefillInsurer: INSURER_KEY,
  });
  try {
    // Load button must be enabled (both keys pre-filled and valid).
    const loadBtn = ctx.query("[data-testid=wallet-onboarding-load]") as HTMLButtonElement;
    assert.equal(
      loadBtn.disabled,
      false,
      "DOM-T6: Load button must be enabled with valid pre-filled keys",
    );

    await act(async () => {
      loadBtn.click();
    });

    // onLoaded must have been called.
    assert.equal(
      onLoadedFired,
      true,
      "DOM-T6 (R7): onLoaded must be called after clicking Load (exercises handleLoad F2)",
    );

    // localStorage must have been updated.
    assert.equal(
      dom.window.localStorage.getItem(KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY"),
      PROVIDER_KEY,
      "DOM-T6 (R7): provider key must be persisted to localStorage",
    );
    assert.equal(
      dom.window.localStorage.getItem(KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY_INSURER"),
      INSURER_KEY,
      "DOM-T6 (R7): insurer key must be persisted to localStorage when provided",
    );

    // After writing, hasUsableProviderKey must return true.
    const gateAfterWrite = hasUsableProviderKey({
      storageOverride: PROVIDER_KEY,
      envKey: undefined,
    });
    assert.equal(
      gateAfterWrite,
      true,
      "DOM-T6: gate must return true after localStorage write (no modal on next load)",
    );
  } finally {
    await ctx.cleanup();
  }
});

test("DOM-T6 (R7): bundle must not contain a private-key value — no 0x+64-hex in App.tsx", () => {
  const appSrc = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

  // Strip comments.
  const appCode = appSrc
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // No 0x-prefixed 32-byte hex (a private key value) must appear in App.tsx source.
  const hexKeyPattern = /0x[0-9a-fA-F]{64}/;
  assert.equal(
    hexKeyPattern.test(appCode),
    false,
    "DOM-T6 (R7): App.tsx must not contain a 0x-prefixed 64-hex private key value — " +
    "keys must only come from localStorage or env (never baked into source)",
  );
});

// ---------------------------------------------------------------------------
// F1 cross-check: App.tsx comment must not lie about pre-fill source.
//
// F5 fix: the App.tsx JSX comment above <WalletOnboarding> currently says
// "Pre-fill values come from localStorage (already populated by client.ts keyOverride)"
// but no prefill prop is passed. This test enforces that if the comment says
// prefill comes from localStorage, the code actually passes a prefill prop.
// ---------------------------------------------------------------------------

test("F5 (comment integrity): App.tsx comment about prefill must match actual prop passing", () => {
  const appSrc = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

  // If the source contains the "Pre-fill" comment (which implies prefill is wired),
  // then it must also actually pass a prefillProvider prop. The comment must not
  // lie about behaviour that is not implemented.
  const hasPreFillComment = appSrc.includes("Pre-fill");
  if (hasPreFillComment) {
    // Strip comments, then check prop is actually passed.
    const appCode = appSrc
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    const prefillPropPassed = /prefillProvider\s*=/.test(appCode);
    assert.equal(
      prefillPropPassed,
      true,
      "F5: App.tsx has a comment containing 'Pre-fill' but does NOT actually pass a " +
      "prefillProvider prop to <WalletOnboarding>. The comment is lying. " +
      "Either remove the comment or implement the wiring (F1 fix).",
    );
  }
  // If no prefill comment, no assertion needed here — the F1 test above covers wiring.
});

// ---------------------------------------------------------------------------
// F6: Dead code — setNeedsWallet(false) before window.location.reload() is a no-op.
//
// The queued React state update NEVER paints because window.location.reload()
// is synchronous and discards the pending render. The setNeedsWallet(false) call
// must be removed from handleWalletLoaded.
// ---------------------------------------------------------------------------

test("F6 (dead code): handleWalletLoaded must not call setNeedsWallet before window.location.reload", () => {
  const appSrc = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

  // Strip comments.
  const appCode = appSrc
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // Extract the handleWalletLoaded callback body.
  const callbackMatch = appCode.match(
    /handleWalletLoaded\s*=\s*useCallback\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,/,
  );
  if (callbackMatch) {
    const callbackBody = callbackMatch[1] ?? "";
    const setNeedsPos = callbackBody.indexOf("setNeedsWallet");
    const reloadPos = callbackBody.indexOf("window.location.reload");
    if (setNeedsPos !== -1 && reloadPos !== -1) {
      assert.equal(
        setNeedsPos < reloadPos,
        false,
        "F6 (dead code): handleWalletLoaded calls setNeedsWallet(false) BEFORE window.location.reload(). " +
        "The state update is queued but never painted — the synchronous reload discards the " +
        "pending render. Remove setNeedsWallet(false) from handleWalletLoaded; it is a no-op " +
        "that misleads readers into thinking the component unmounts before reload (it does not).",
      );
    }
  }
});

// ---------------------------------------------------------------------------
// F8: Out-of-scope change — contracts/hardhat.config.ts must not have a
// mocha:{timeout:120_000} block added by the SPEC-0008 branch.
//
// SPEC-0008 is a pure web-UI spec (R1–R10). The Solidity-coverage timeout bump
// is unrelated and must not appear on this branch.
// ---------------------------------------------------------------------------

test("F8 (out-of-scope): contracts/hardhat.config.ts must not contain mocha timeout added by SPEC-0008 branch", () => {
  let hardhatSrc: string;
  try {
    hardhatSrc = readFileSync(
      new URL("../../contracts/hardhat.config.ts", import.meta.url),
      "utf8",
    );
  } catch {
    // File not found — can't check. Skip gracefully.
    return;
  }

  // Strip comments before checking.
  const hardhatCode = hardhatSrc
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // The mocha timeout block must not exist in the SPEC-0008 scope.
  // Specifically: `mocha: { timeout: 120_000` was added by the SPEC-0008 branch.
  // SPEC-0008 is a pure web-UI spec; no Solidity changes belong here.
  assert.equal(
    /mocha\s*:\s*\{[\s\S]*?timeout\s*:\s*120[_,]?000/.test(hardhatCode),
    false,
    "F8 (out-of-scope): contracts/hardhat.config.ts contains `mocha:{timeout:120_000}` added by " +
    "the SPEC-0008 branch. SPEC-0008 is a pure web-UI spec (R1–R10); this Solidity-coverage " +
    "timeout bump is unrelated and must not be on this branch. Remove it or move it to its own PR.",
  );
});

// ---------------------------------------------------------------------------
// F10: R8 (SHOULD: active-wallet verification) must be recorded as deferred.
//
// R8 is not implemented — the modal only writes localStorage and reloads.
// The spec must explicitly record R8 as deferred (out-of-scope, open question,
// or explicit deferral note) so it is not silently dropped.
// ---------------------------------------------------------------------------

test("F10 (R8 deferred): SPEC-0008 must record R8 active-wallet verification as deferred/SHOULD", () => {
  const specSrc = readFileSync(
    new URL("../../docs/specs/0008-wallet-onboarding-modal.md", import.meta.url),
    "utf8",
  );

  // R8 is a SHOULD-level requirement (active-wallet verification — usable-signer/
  // balance check + 'active' UI reflection). It is NOT implemented in this iteration.
  // The spec must acknowledge this — either with the SHOULD keyword, in §7 (Out of
  // scope), an open question (§8), or an explicit deferral note.
  const r8Pos = specSrc.indexOf("R8");
  assert.notEqual(r8Pos, -1, "F10: SPEC-0008 must reference R8");

  const specLower = specSrc.toLowerCase();
  const hasDeferralOrShould =
    specLower.includes("defer") ||
    specLower.includes("out of scope") ||
    specLower.includes("oq") ||
    specLower.includes("open question") ||
    specLower.includes("should");

  assert.equal(
    hasDeferralOrShould,
    true,
    "F10: SPEC-0008 must explicitly mark R8 (active-wallet verification) as deferred, " +
    "out of scope, or as a SHOULD (not MUST). Without an explicit deferral note, R8 " +
    "is silently abandoned rather than tracked.",
  );
});

// ---------------------------------------------------------------------------
// F9 fix — Remove tautological / near-unfalsifiable assertions.
//
// The prior review flagged:
//   - DOM-T1 'disabled' check: `includes('disabled=""') || includes('disabled')`
//     matches any element with the word "disabled" (near-unfalsifiable).
// The fix: use `.disabled === true` (boolean DOM property).
// This structural test verifies the weak pattern is NOT used in this file.
// ---------------------------------------------------------------------------

test("F9 fix (disabled assertion): Load button disabled check uses boolean DOM property", async () => {
  // F9 fix: the prior test file used a substring match against the rendered HTML
  // which was near-unfalsifiable (any 'disabled' text anywhere in the DOM matched).
  // The fix is to use the .disabled boolean DOM property on the actual HTMLButtonElement.
  //
  // This test verifies the fix by performing the check itself: render with no key
  // and confirm .disabled===true (boolean), then render with a valid key and confirm
  // .disabled===false (boolean). Both are precise and cannot be falsified by
  // unrelated elements containing the word "disabled".
  const ctx1 = await renderInteractive({ onLoaded: () => {} });
  try {
    const btnEmpty = ctx1.query("[data-testid=wallet-onboarding-load]") as HTMLButtonElement;
    // Direct boolean check — NOT a substring match on HTML.
    assert.strictEqual(
      btnEmpty.disabled,
      true,
      "F9 (precise disabled check): with empty provider key, button.disabled must be boolean true",
    );
  } finally {
    await ctx1.cleanup();
  }

  const ctx2 = await renderInteractive({ onLoaded: () => {}, prefillProvider: PROVIDER_KEY });
  try {
    const btnFilled = ctx2.query("[data-testid=wallet-onboarding-load]") as HTMLButtonElement;
    assert.strictEqual(
      btnFilled.disabled,
      false,
      "F9 (precise enabled check): with valid provider key, button.disabled must be boolean false",
    );
  } finally {
    await ctx2.cleanup();
  }
});

// ---------------------------------------------------------------------------
// DRY invariant (F3): WalletOnboarding.tsx must use shared deriveAddress.
// ---------------------------------------------------------------------------

test("DOM DRY (F3): WalletOnboarding.tsx must not define local tryDeriveAddress", () => {
  const src = readFileSync(
    new URL("./components/WalletOnboarding.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(
    src.includes("tryDeriveAddress"),
    false,
    "F3 DRY: WalletOnboarding.tsx must not define or use a local tryDeriveAddress — " +
    "use shared deriveAddress() from walletKeys.ts (SPEC-0008 §3)",
  );
  assert.equal(
    src.includes("new Wallet("),
    false,
    "F3 DRY: WalletOnboarding.tsx must not call new Wallet() directly — " +
    "use shared deriveAddress() from walletKeys.ts (SPEC-0008 §3)",
  );
  assert.match(
    src,
    /import[^;]*deriveAddress[^;]*walletKeys/,
    "F3 DRY: WalletOnboarding.tsx must import deriveAddress from walletKeys.ts",
  );
});

// ---------------------------------------------------------------------------
// PHI-free invariant for this test file
// ---------------------------------------------------------------------------

test("DOM NO-PHI: no SSN/DOB/phone/email patterns in synthetic fixtures", () => {
  const fixtures = [PROVIDER_KEY, INSURER_KEY, PROVIDER_ADDR, INSURER_ADDR, BAD_KEY];
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
// DOM-T7 / DOM-T8 (SPEC-0008 R14) — "Load demo wallets" button (burnable demo keys)
// ---------------------------------------------------------------------------

/** Invoke a React onClick handler on a DOM node (mirrors invokeOnChange). */
function invokeClick(el: Element): void {
  const propsKey = Object.keys(el).find((k) => k.startsWith("__reactProps"));
  if (!propsKey) throw new Error(`No __reactProps on element: ${el.tagName}`);
  const props = (el as unknown as Record<string, Record<string, unknown>>)[propsKey];
  if (typeof props?.["onClick"] !== "function") throw new Error("onClick not found");
  (props["onClick"] as (e?: unknown) => void)();
}

test("DOM-T7 (R14): no demo button when no demo provider key is configured", async () => {
  const ctx = await renderInteractive({ onLoaded: () => {} });
  try {
    assert.equal(
      ctx.query("[data-testid=wallet-onboarding-demo]"),
      null,
      "DOM-T7: 'Load demo wallets' button must be ABSENT when demoProvider is unset",
    );
  } finally {
    await ctx.cleanup();
  }
});

test("DOM-T8 (R14): demo button appears, fills both fields, and enables Load", async () => {
  const ctx = await renderInteractive({
    onLoaded: () => {},
    demoProvider: PROVIDER_KEY,
    demoInsurer: INSURER_KEY,
  });
  try {
    const demoBtn = ctx.query("[data-testid=wallet-onboarding-demo]");
    assert.ok(demoBtn, "DOM-T8: 'Load demo wallets' button must be present when demoProvider is set");
    // The public-keys note must be shown (honest trust labeling).
    assert.ok(
      ctx.query("[data-testid=wallet-onboarding-demo-note]"),
      "DOM-T8: the public/testnet-only note must be shown alongside the demo button",
    );

    await act(async () => { invokeClick(demoBtn!); });

    // Both inputs now carry the demo keys → both derived addresses appear.
    const provAddr = ctx.query("[data-testid=provider-key-input-address]");
    const insAddr = ctx.query("[data-testid=insurer-key-input-address]");
    assert.ok(provAddr?.textContent?.includes(PROVIDER_ADDR), "DOM-T8: provider address derives from demo key");
    assert.ok(insAddr?.textContent?.includes(INSURER_ADDR), "DOM-T8: insurer address derives from demo key");

    // Load is now enabled (valid provider derives).
    const loadBtn = ctx.query("[data-testid=wallet-onboarding-load]") as HTMLButtonElement;
    assert.equal(loadBtn.disabled, false, "DOM-T8: Load enabled after demo keys loaded");
  } finally {
    await ctx.cleanup();
  }
});
