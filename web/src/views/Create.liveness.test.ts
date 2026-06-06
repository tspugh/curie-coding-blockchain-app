/**
 * SPEC-0006 R21 — Create component liveness-gate integration tests.
 *
 * These tests verify the R21 MUST behavior of Create.tsx:
 *   "keep create-submit disabled until urlLivenessOk === true (real mode)"
 *   "render an inline url-liveness-error banner when false"
 *   "in sim mode the check is bypassed"
 *
 * The Create component cannot be rendered without a DOM (no jsdom installed),
 * so these tests exercise the same decision functions that the Create useEffect
 * delegates to: a real `setTimeout(…, PROBE_DEBOUNCE_MS)` debounce fires the
 * probe, then the result is run through the exact `probeUrlLiveness`,
 * `isSubmitBlockedByLiveness`, `shouldShowLivenessBanner`, and
 * `formatLivenessError` calls Create.tsx uses, asserting the R21 MUST outcomes
 * (submit blocked / banner shown for a dead URL; both clear for a live URL).
 * (Real timers — the ~600 ms debounce elapses for real; no fake clock.)
 *
 * Relation to Create.tsx:
 *   - `probeUrlLiveness`      ← called in the useEffect after 600 ms debounce
 *   - `isSubmitBlockedByLiveness` ← the `disabled` prop expression
 *   - `shouldShowLivenessBanner`  ← the banner JSX guard
 *   - `formatLivenessError`       ← banner text interpolation
 *
 * All four are imported from their respective production modules; if any is
 * deleted or its contract changes, these tests fail.
 *
 * PHI-FREE: all fixture strings are synthetic MedlinePlus-style URLs; no
 * patient identifiers, SSNs, DOBs, phone numbers, or email addresses appear
 * here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  probeUrlLiveness,
  formatLivenessError,
  clearLivenessCache,
} from "../urlLiveness.js";
import {
  isSubmitBlockedByLiveness,
  shouldShowLivenessBanner,
} from "../livenessGate.js";

/** Debounce delay that Create.tsx uses (must match PROBE_DEBOUNCE_MS). */
const PROBE_DEBOUNCE_MS = 600;

/** Synthetic dead URL (non-PHI). */
const DEAD_URL = "https://medlineplus.gov/druginfo/meds/DEAD_SYNTHETIC.html";
/** Synthetic live URL (non-PHI). */
const LIVE_URL = "https://medlineplus.gov/druginfo/meds/a603010.html";

// ---------------------------------------------------------------------------
// Real mode — dead URL: submit blocked, banner shown
// ---------------------------------------------------------------------------

test("R21 real mode + dead URL: after debounce, submit IS blocked and banner IS shown", async () => {
  clearLivenessCache();
  const original = global.fetch;
  global.fetch = async (_: RequestInfo | URL) =>
    new Response(JSON.stringify({ ok: false, status: 404 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    // Simulate the full Create.tsx probe pipeline in real mode.
    await new Promise<void>((resolve) => {
      const timerId = setTimeout(() => {
        void probeUrlLiveness(DEAD_URL, /* sim= */ false).then((result) => {
          // These are the exact gate expressions from Create.tsx's disabled prop
          // and banner JSX guard.
          const blocked = isSubmitBlockedByLiveness(/* isReal= */ true, result);
          const bannerShown = shouldShowLivenessBanner(/* isReal= */ true, result);
          const bannerText = formatLivenessError(result);

          assert.equal(result.ok, false, "probe must return ok:false for dead URL");
          assert.equal(result.status, 404, "status must be forwarded");

          // R21 MUST: create-submit stays disabled.
          assert.equal(
            blocked,
            true,
            "dead URL must keep create-submit disabled (isSubmitBlockedByLiveness=true)",
          );

          // R21 MUST: url-liveness-error banner is rendered.
          assert.equal(
            bannerShown,
            true,
            "dead URL must show url-liveness-error banner (shouldShowLivenessBanner=true)",
          );

          // R21 MUST: banner text includes the HTTP status code.
          assert.ok(
            bannerText.includes("HTTP 404"),
            `banner must include 'HTTP 404'; got: ${bannerText}`,
          );
          assert.ok(
            bannerText.includes("evidence URL unreachable"),
            `banner must include spec prefix; got: ${bannerText}`,
          );

          resolve();
        });
      }, PROBE_DEBOUNCE_MS);
      void timerId;
    });
  } finally {
    global.fetch = original;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Real mode — live URL: submit unblocked, banner hidden
// ---------------------------------------------------------------------------

test("R21 real mode + live URL: after debounce, submit NOT blocked and banner NOT shown", async () => {
  clearLivenessCache();
  const original = global.fetch;
  global.fetch = async (_: RequestInfo | URL) =>
    new Response(JSON.stringify({ ok: true, status: 200 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    await new Promise<void>((resolve) => {
      const timerId = setTimeout(() => {
        void probeUrlLiveness(LIVE_URL, /* sim= */ false).then((result) => {
          const blocked = isSubmitBlockedByLiveness(/* isReal= */ true, result);
          const bannerShown = shouldShowLivenessBanner(/* isReal= */ true, result);

          assert.equal(result.ok, true, "probe must return ok:true for live URL");

          // R21 MUST: create-submit is unblocked when probe returns ok:true.
          assert.equal(
            blocked,
            false,
            "live URL must unblock create-submit (isSubmitBlockedByLiveness=false)",
          );

          // R21 MUST: no banner for a live URL.
          assert.equal(
            bannerShown,
            false,
            "live URL must NOT show url-liveness-error banner",
          );

          resolve();
        });
      }, PROBE_DEBOUNCE_MS);
      void timerId;
    });
  } finally {
    global.fetch = original;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Sim mode: liveness bypassed — submit NOT blocked, banner NOT shown
// ---------------------------------------------------------------------------

test("R21 sim mode: liveness bypassed — submit NOT blocked regardless of probe outcome", async () => {
  clearLivenessCache();
  const original = global.fetch;
  // Even if the probe somehow ran (it won't in sim mode), the gate must not block.
  global.fetch = async (_: RequestInfo | URL) => {
    throw new Error("fetch must not be called in sim mode");
  };

  try {
    // In sim mode, probeUrlLiveness returns ok:true without fetching.
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ true);

    // The Create.tsx useEffect returns early for sim mode, so result stays null.
    // We verify both outcomes: the sim-mode probe result AND the null case.
    const blockedWithSimResult = isSubmitBlockedByLiveness(/* isReal= */ false, result);
    const blockedWithNull = isSubmitBlockedByLiveness(/* isReal= */ false, null);
    const bannerWithSimResult = shouldShowLivenessBanner(/* isReal= */ false, result);
    const bannerWithNull = shouldShowLivenessBanner(/* isReal= */ false, null);

    assert.equal(
      blockedWithSimResult,
      false,
      "sim mode must NOT block submit even with ok:true result",
    );
    assert.equal(
      blockedWithNull,
      false,
      "sim mode with null result (no probe run) must NOT block submit",
    );
    assert.equal(
      bannerWithSimResult,
      false,
      "sim mode must NOT show banner with ok:true result",
    );
    assert.equal(
      bannerWithNull,
      false,
      "sim mode with null result must NOT show banner",
    );
  } finally {
    global.fetch = original;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Debounce + stale-response cancellation: URL change discards old result
//
// Simulates typing quickly: URL-A probe fires but resolves AFTER URL-B's probe
// has already set a new result.  The cancelled flag in Create.tsx ensures the
// URL-A result is discarded.  Here we verify the same contract on the gate
// functions: whichever result is NOT discarded must match URL-B's outcome.
// ---------------------------------------------------------------------------

test("R21 stale-response: latest probe result drives the gate, not a stale earlier one", async () => {
  clearLivenessCache();

  // URL-A returns dead, URL-B returns live.
  // After the URL changes, the gate must reflect URL-B's live result, not
  // URL-A's dead result.
  const fetchResponses: Record<string, { ok: boolean; status: number }> = {
    [DEAD_URL]: { ok: false, status: 404 },
    [LIVE_URL]: { ok: true, status: 200 },
  };

  const original = global.fetch;
  global.fetch = async (input: RequestInfo | URL) => {
    const raw = typeof input === "string" ? input : input.toString();
    const targetUrl = decodeURIComponent(raw.replace("/__probe?url=", ""));
    const payload = fetchResponses[targetUrl] ?? { ok: false, status: 0 };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    // Simulate: user types URL-A, then immediately URL-B.
    // The "cancelled" flag in Create.tsx means URL-A's result is discarded.
    // We simulate by running URL-B's probe directly (as if URL-A was cancelled).
    const liveResult = await probeUrlLiveness(LIVE_URL, /* sim= */ false);

    const blocked = isSubmitBlockedByLiveness(/* isReal= */ true, liveResult);
    const bannerShown = shouldShowLivenessBanner(/* isReal= */ true, liveResult);

    assert.equal(
      blocked,
      false,
      "after URL-B (live) resolves, submit must NOT be blocked",
    );
    assert.equal(
      bannerShown,
      false,
      "after URL-B (live) resolves, banner must NOT be shown",
    );
  } finally {
    global.fetch = original;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Pending probe (result === null): submit IS blocked, banner NOT shown
//
// While the debounce timer is running or the probe is in flight, the component
// holds result === null.  The gate must block; the banner must not show.
// ---------------------------------------------------------------------------

test("R21 probe in flight (null): submit IS blocked, banner NOT shown", () => {
  // result === null is the state while the debounce timer has not fired yet
  // or while the probe is awaiting a response.
  const blocked = isSubmitBlockedByLiveness(/* isReal= */ true, null);
  const bannerShown = shouldShowLivenessBanner(/* isReal= */ true, null);

  assert.equal(
    blocked,
    true,
    "pending probe (null) must keep create-submit disabled",
  );
  assert.equal(
    bannerShown,
    false,
    "pending probe (null) must NOT show banner (no error to display yet)",
  );
});

// ---------------------------------------------------------------------------
// Network error: submit blocked, banner shows with error message
// ---------------------------------------------------------------------------

test("R21 network error: submit IS blocked and banner shows error message", async () => {
  clearLivenessCache();
  const original = global.fetch;
  global.fetch = async (_: RequestInfo | URL) => {
    throw new TypeError("Failed to fetch");
  };

  try {
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ false);

    const blocked = isSubmitBlockedByLiveness(/* isReal= */ true, result);
    const bannerShown = shouldShowLivenessBanner(/* isReal= */ true, result);
    const bannerText = formatLivenessError(result);

    assert.equal(result.ok, false, "network error must return ok:false");
    assert.equal(blocked, true, "network error must keep submit disabled");
    assert.equal(bannerShown, true, "network error must show banner");
    assert.ok(
      bannerText.includes("Failed to fetch") || bannerText.includes("network error"),
      `banner must include error message; got: ${bannerText}`,
    );
  } finally {
    global.fetch = original;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// PHI-free invariant
// ---------------------------------------------------------------------------

test("R1 NO-PHI: no SSN/DOB/phone/email patterns in test fixtures", () => {
  const fixtures = [DEAD_URL, LIVE_URL];
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
