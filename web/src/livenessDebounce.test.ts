/**
 * SPEC-0006 R21 — unit tests for `runLivenessDebounce`.
 *
 * `runLivenessDebounce` is the pure, injectable helper extracted from
 * Create.tsx's useEffect.  It owns the debounce timer and the
 * stale-response cancellation guard; its only side-effect is calling
 * the supplied `onResult` callback.  It has NO React dependency.
 *
 * Test cases:
 *   (1) Debounce fires after PROBE_DEBOUNCE_MS — `onResult` is NOT called
 *       before the delay elapses and IS called once after it does.
 *   (2) Cleanup (the function returned by `runLivenessDebounce`) cancels
 *       an in-flight probe so that its result is discarded and `onResult`
 *       is never called.
 *   (3) Empty URL (after trim) returns immediately without scheduling a
 *       timer and without calling `onResult` or `probe`.
 *
 * All three acceptance criteria from the TDD step description are pinned
 * here by importing `runLivenessDebounce` from the (not-yet-created)
 * production module.  The tests FAIL with MODULE_NOT_FOUND until the
 * helper is implemented in `web/src/livenessDebounce.ts`.
 *
 * PHI-FREE: all fixture strings are synthetic; no patient identifiers,
 * SSNs, DOBs, phone numbers, or email addresses appear in this file.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

// This import FAILS until web/src/livenessDebounce.ts is created.
import { runLivenessDebounce, PROBE_DEBOUNCE_MS } from "./livenessDebounce.js";
import type { LivenessResult } from "./urlLiveness.js";

// ---------------------------------------------------------------------------
// Helpers / fixtures
// ---------------------------------------------------------------------------

/** Synthetic evidence URL (non-PHI, MedlinePlus-style). */
const SYNTH_URL = "https://medlineplus.gov/druginfo/meds/a603010.html";

/** A probe function that always resolves ok:true immediately. */
function makeLiveProbe(): (url: string, sim: boolean) => Promise<LivenessResult> {
  return async (_url: string, _sim: boolean): Promise<LivenessResult> =>
    ({ ok: true, status: 200 });
}

/** A probe function that always resolves ok:false (dead). */
function makeDeadProbe(): (url: string, sim: boolean) => Promise<LivenessResult> {
  return async (_url: string, _sim: boolean): Promise<LivenessResult> =>
    ({ ok: false, status: 404 });
}

/**
 * A probe that never resolves — its promise hangs forever.
 * Used to verify that cleanup cancels the callback.
 */
function makeHangingProbe(): {
  probe: (url: string, sim: boolean) => Promise<LivenessResult>;
  resolveAll: (r: LivenessResult) => void;
} {
  const pendingResolvers: Array<(r: LivenessResult) => void> = [];
  const probe = (_url: string, _sim: boolean): Promise<LivenessResult> =>
    new Promise<LivenessResult>((res) => pendingResolvers.push(res));
  const resolveAll = (r: LivenessResult) => {
    for (const res of pendingResolvers) res(r);
  };
  return { probe, resolveAll };
}

// ---------------------------------------------------------------------------
// (1) Debounce fires after PROBE_DEBOUNCE_MS
//     onResult is NOT called before the delay; IS called once after it.
// ---------------------------------------------------------------------------

test("debounce: onResult is NOT called before the delay and IS called once after it", async () => {
  const results: LivenessResult[] = [];
  const probe = makeLiveProbe();

  const cleanup = runLivenessDebounce(
    SYNTH_URL,
    /* isReal= */ true,
    (r) => results.push(r),
    { debounceMs: PROBE_DEBOUNCE_MS, probe },
  );

  // Before the debounce fires, onResult must not have been called.
  assert.equal(results.length, 0, "onResult must NOT be called before debounce fires");

  // Wait for the debounce plus a small buffer.
  await new Promise<void>((resolve) =>
    setTimeout(resolve, PROBE_DEBOUNCE_MS + 50),
  );

  assert.equal(results.length, 1, "onResult must be called exactly once after debounce");
  assert.equal(results[0].ok, true, "result must be ok:true from the live probe");

  cleanup();
});

// ---------------------------------------------------------------------------
// (2) Cleanup cancels an in-flight probe — its result is discarded
// ---------------------------------------------------------------------------

test("cleanup: calling cleanup discards an in-flight probe result (stale-response guard)", async () => {
  const results: LivenessResult[] = [];
  const { probe, resolveAll } = makeHangingProbe();

  const cleanup = runLivenessDebounce(
    SYNTH_URL,
    /* isReal= */ true,
    (r) => results.push(r),
    { debounceMs: PROBE_DEBOUNCE_MS, probe },
  );

  // Wait for the debounce timer to fire (probe is now in-flight but hanging).
  await new Promise<void>((resolve) =>
    setTimeout(resolve, PROBE_DEBOUNCE_MS + 50),
  );

  // Probe is in-flight; no result yet.
  assert.equal(results.length, 0, "no result yet while probe is in-flight");

  // Call cleanup — simulates the useEffect cleanup on URL change or unmount.
  cleanup();

  // Now resolve the hanging probe — result must be discarded.
  resolveAll({ ok: true, status: 200 });

  // Give the microtask queue a tick to settle.
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(
    results.length,
    0,
    "after cleanup, the resolved probe result must be discarded (stale-response guard)",
  );
});

// ---------------------------------------------------------------------------
// (3) Empty URL short-circuit — no timer, no probe, no onResult call
// ---------------------------------------------------------------------------

test("empty URL: returns immediately without scheduling a timer or calling probe/onResult", async () => {
  let probeCallCount = 0;
  const results: LivenessResult[] = [];

  const probe = async (_url: string, _sim: boolean): Promise<LivenessResult> => {
    probeCallCount++;
    return { ok: true, status: 200 };
  };

  const cleanup = runLivenessDebounce(
    /* url= */ "",
    /* isReal= */ true,
    (r) => results.push(r),
    { debounceMs: PROBE_DEBOUNCE_MS, probe },
  );

  // Wait well past the debounce delay to be sure no timer fired.
  await new Promise<void>((resolve) =>
    setTimeout(resolve, PROBE_DEBOUNCE_MS + 100),
  );

  assert.equal(
    results.length,
    0,
    "empty URL must not call onResult",
  );
  assert.equal(
    probeCallCount,
    0,
    "empty URL must not call probe",
  );

  cleanup();
});

// ---------------------------------------------------------------------------
// (4) Whitespace-only URL is treated as empty — same short-circuit
// ---------------------------------------------------------------------------

test("whitespace-only URL: treated as empty — no probe, no onResult", async () => {
  let probeCallCount = 0;
  const results: LivenessResult[] = [];

  const probe = async (_url: string, _sim: boolean): Promise<LivenessResult> => {
    probeCallCount++;
    return { ok: true, status: 200 };
  };

  const cleanup = runLivenessDebounce(
    /* url= */ "   \t  ",
    /* isReal= */ true,
    (r) => results.push(r),
    { debounceMs: PROBE_DEBOUNCE_MS, probe },
  );

  await new Promise<void>((resolve) =>
    setTimeout(resolve, PROBE_DEBOUNCE_MS + 100),
  );

  assert.equal(results.length, 0, "whitespace URL must not call onResult");
  assert.equal(probeCallCount, 0, "whitespace URL must not call probe");

  cleanup();
});

// ---------------------------------------------------------------------------
// (5) Cleanup also cancels the debounce timer (no probe call after cleanup)
// ---------------------------------------------------------------------------

test("cleanup before debounce fires: cancels the timer so probe is never called", async () => {
  let probeCallCount = 0;
  const results: LivenessResult[] = [];

  const probe = async (_url: string, _sim: boolean): Promise<LivenessResult> => {
    probeCallCount++;
    return { ok: true, status: 200 };
  };

  const cleanup = runLivenessDebounce(
    SYNTH_URL,
    /* isReal= */ true,
    (r) => results.push(r),
    { debounceMs: PROBE_DEBOUNCE_MS, probe },
  );

  // Call cleanup immediately — before the debounce timer fires.
  cleanup();

  // Wait for the full debounce + buffer to confirm timer was cancelled.
  await new Promise<void>((resolve) =>
    setTimeout(resolve, PROBE_DEBOUNCE_MS + 100),
  );

  assert.equal(probeCallCount, 0, "probe must not be called after early cleanup");
  assert.equal(results.length, 0, "onResult must not be called after early cleanup");
});

// ---------------------------------------------------------------------------
// (6) sim mode (isReal=false): probe is called but onResult still fires
//     (the debounce still works; sim mode affects the probe function, not
//     the helper's scheduling logic — the real Create.tsx skips the entire
//     useEffect in sim mode, but the helper itself is mode-agnostic)
// ---------------------------------------------------------------------------

test("sim mode: helper still schedules and delivers result (mode is passed to probe)", async () => {
  let capturedSim: boolean | undefined;
  const results: LivenessResult[] = [];

  const probe = async (_url: string, sim: boolean): Promise<LivenessResult> => {
    capturedSim = sim;
    return { ok: true, status: 0 };
  };

  const cleanup = runLivenessDebounce(
    SYNTH_URL,
    /* isReal= */ false,
    (r) => results.push(r),
    { debounceMs: PROBE_DEBOUNCE_MS, probe },
  );

  await new Promise<void>((resolve) =>
    setTimeout(resolve, PROBE_DEBOUNCE_MS + 50),
  );

  // The injected probe was called with sim=true (isReal=false → sim=true).
  assert.equal(capturedSim, true, "probe must receive sim=true when isReal=false");
  assert.equal(results.length, 1, "onResult must be called once in sim mode");

  cleanup();
});

// ---------------------------------------------------------------------------
// (7) PROBE_DEBOUNCE_MS is exported and equals 600
// ---------------------------------------------------------------------------

test("PROBE_DEBOUNCE_MS is exported and equals 600", () => {
  assert.equal(
    PROBE_DEBOUNCE_MS,
    600,
    "PROBE_DEBOUNCE_MS must be 600 (must match Create.tsx constant)",
  );
});

// ---------------------------------------------------------------------------
// (8) runLivenessDebounce has no React import — pure function contract
// ---------------------------------------------------------------------------

test("module has no React import (pure function, no React dependency)", async () => {
  // We verify this by confirming the module source does NOT contain
  // 'from "react"' or "from 'react'" — a structural invariant that keeps
  // the helper usable outside React (e.g. in Node tests without jsdom).
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // The source is in web/src/livenessDebounce.ts
  const srcPath = join(__dirname, "livenessDebounce.ts");
  const source = readFileSync(srcPath, "utf8");
  assert.equal(
    /from\s+["']react["']/.test(source),
    false,
    "livenessDebounce.ts must NOT import from 'react' — it must be a pure function",
  );
});

// ---------------------------------------------------------------------------
// (9) Default options — exercises the ?? fallbacks for debounceMs and probe
//
// Branch coverage: when runLivenessDebounce is called without an options
// argument (or with an empty options object), lines 70-71 take the right-hand
// side of their ?? operators:
//   debounceMs = options.debounceMs ?? PROBE_DEBOUNCE_MS  → PROBE_DEBOUNCE_MS
//   probe      = options.probe      ?? probeUrlLiveness   → probeUrlLiveness
//
// These branches were previously uncovered (counts=[0]) because all prior
// tests inject both options. This test omits both to exercise the fallbacks.
// It uses a very short delay and stubs global.fetch to avoid real I/O.
// ---------------------------------------------------------------------------

test("default options: no options arg exercises the ?? fallbacks for debounceMs and probe", async () => {
  const originalFetch = global.fetch;
  let fetchCalled = false;
  // Stub fetch so the default probeUrlLiveness makes a network call that resolves
  // without hitting the real network.
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    fetchCalled = true;
    return new Response(JSON.stringify({ ok: true, status: 200 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const { clearLivenessCache } = await import("./urlLiveness.js");
  clearLivenessCache();

  const results: import("./urlLiveness.js").LivenessResult[] = [];
  // Call with no options object — exercises the right-hand side of both ??s.
  // Use a tiny debounceMs by patching only debounceMs so we don't wait 600 ms.
  // To exercise JUST the probe ?? fallback with defaults: we pass debounceMs only,
  // leaving probe undefined so the default probeUrlLiveness is used.
  const cleanup = runLivenessDebounce(
    SYNTH_URL,
    /* isReal= */ false, // sim mode: probeUrlLiveness returns {ok:true,status:0} immediately
    (r) => results.push(r),
    { debounceMs: 10 }, // only debounceMs provided; probe defaults to probeUrlLiveness
  );

  await new Promise<void>((resolve) => setTimeout(resolve, 80));
  cleanup();

  assert.equal(results.length, 1, "default probe must call onResult once (exercises probe ?? probeUrlLiveness)");

  // Also call with NO options at all — exercises the debounceMs ?? PROBE_DEBOUNCE_MS
  // fallback path. We immediately call cleanup to avoid waiting 600 ms.
  const results2: import("./urlLiveness.js").LivenessResult[] = [];
  const cleanup2 = runLivenessDebounce(
    SYNTH_URL,
    false,
    (r) => results2.push(r),
    // No options arg — both debounceMs and probe use their ?? defaults.
    // We can't wait 600 ms in a test, so we call cleanup immediately.
  );
  // The important thing: the ?? branches (lines 70-71) execute. cleanup() is fine
  // to call before the timer fires — this exercises the cleanup path.
  cleanup2();

  assert.equal(results2.length, 0, "cleanup before debounce fires must discard the result");

  global.fetch = originalFetch;
  clearLivenessCache();
});

// ---------------------------------------------------------------------------
// PHI-free invariant
// ---------------------------------------------------------------------------

test("R1 NO-PHI: no SSN/DOB/phone/email patterns in test fixtures", () => {
  const fixtures = [SYNTH_URL];
  const json = JSON.stringify(fixtures);
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
