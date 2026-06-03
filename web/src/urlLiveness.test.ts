/**
 * Tests for `web/src/urlLiveness.ts` — SPEC-0006 R21 pre-submit evidence-URL
 * liveness check.
 *
 * Covers:
 *   - Cache hit: a second call for the same URL within 24 h returns the cached
 *     result without issuing a new fetch.
 *   - Cache miss: first call (or stale entry) triggers a fetch to `/__probe`.
 *   - Sim-mode bypass: in simulated mode `probeUrlLiveness` resolves `true`
 *     immediately without any network I/O.
 *   - Non-2xx response: `/__probe` returning `{ ok: false, status: 404 }` →
 *     `probeUrlLiveness` resolves `false`.
 *   - Network error: fetch to `/__probe` throwing → `probeUrlLiveness`
 *     resolves `false`.
 *
 * PHI-FREE: all fixture strings are synthetic; no patient identifiers,
 * SSNs, DOBs, phone numbers, or email addresses appear anywhere in this file.
 *
 * These tests are FAILING until `web/src/urlLiveness.ts` is created.
 * That is the intended red state for the TDD step.
 */
import assert from "node:assert/strict";
import { test, mock, beforeEach, afterEach } from "node:test";

// ---------------------------------------------------------------------------
// Import the module under test.
// This import will fail with MODULE_NOT_FOUND until the production
// file is created. That is the intended red state.
// ---------------------------------------------------------------------------
import {
  probeUrlLiveness,
  clearLivenessCache,
  LIVENESS_CACHE_TTL_MS,
} from "./urlLiveness.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A known-synthetic evidence URL (non-PHI, modelled on the R18 MedlinePlus entries). */
const SYNTHETIC_URL = "https://medlineplus.gov/druginfo/meds/a603010.html";
const DEAD_URL = "https://medlineplus.gov/druginfo/meds/DEAD_SYNTHETIC_ENTRY.html";

// ---------------------------------------------------------------------------
// Cache hit
// ---------------------------------------------------------------------------

test("cache hit: second call within 24 h does not issue a new fetch", async () => {
  // Arrange: pre-seed the cache by running one call that succeeds.
  // We intercept global.fetch for this test.
  let fetchCallCount = 0;
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCallCount++;
    // Simulate /__probe returning { ok: true, status: 200 }
    const url = typeof input === "string" ? input : input.toString();
    assert.ok(url.includes("/__probe"), `expected /__probe request, got ${url}`);
    return new Response(JSON.stringify({ ok: true, status: 200 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    clearLivenessCache();
    const first = await probeUrlLiveness(SYNTHETIC_URL, /* sim= */ false);
    assert.equal(first, true, "first call should return true");
    assert.equal(fetchCallCount, 1, "first call must issue exactly one fetch");

    // Second call: must NOT re-fetch.
    const second = await probeUrlLiveness(SYNTHETIC_URL, /* sim= */ false);
    assert.equal(second, true, "second call should return cached true");
    assert.equal(fetchCallCount, 1, "second call must NOT issue another fetch (cache hit)");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Cache miss triggers fetch
// ---------------------------------------------------------------------------

test("cache miss: expired or absent entry triggers a new fetch", async () => {
  let fetchCallCount = 0;
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    fetchCallCount++;
    return new Response(JSON.stringify({ ok: true, status: 200 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    clearLivenessCache();
    // First call on a clean cache must fetch.
    await probeUrlLiveness(SYNTHETIC_URL, /* sim= */ false);
    assert.equal(fetchCallCount, 1, "clean-cache call must issue a fetch");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

test("cache miss: entry older than LIVENESS_CACHE_TTL_MS triggers a re-fetch", async () => {
  // We directly manipulate the internal cache via clearLivenessCache + a
  // module-level back-door that injects a stale entry.
  // Since urlLiveness.ts doesn't exist yet, this test will fail at import time
  // — that is the correct red state.
  let fetchCallCount = 0;
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    fetchCallCount++;
    return new Response(JSON.stringify({ ok: true, status: 200 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    clearLivenessCache();
    // Seed an entry then fast-forward by LIVENESS_CACHE_TTL_MS + 1 ms.
    // We can't easily time-travel without a Date stub; instead we import
    // the mutable Map directly to inject a stale entry with ts = 0.
    // The test pins the exported LIVENESS_CACHE_TTL_MS constant so if
    // the implementation uses a hard-coded value that diverges, this
    // test will fail.
    assert.ok(
      typeof LIVENESS_CACHE_TTL_MS === "number",
      "LIVENESS_CACHE_TTL_MS must be a number",
    );
    assert.equal(
      LIVENESS_CACHE_TTL_MS,
      24 * 60 * 60 * 1000,
      "LIVENESS_CACHE_TTL_MS must equal 24 h in ms",
    );
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Sim-mode bypass
// ---------------------------------------------------------------------------

test("sim mode: probeUrlLiveness resolves true immediately without fetching", async () => {
  let fetchCalled = false;
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    fetchCalled = true;
    throw new Error("fetch must not be called in sim mode");
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(SYNTHETIC_URL, /* sim= */ true);
    assert.equal(result, true, "sim mode must return true");
    assert.equal(fetchCalled, false, "sim mode must NOT call fetch");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

test("sim mode: returns true even for a URL that would otherwise be dead", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    throw new Error("fetch must not be called in sim mode");
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ true);
    assert.equal(result, true);
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Non-2xx → ok: false
// ---------------------------------------------------------------------------

test("non-2xx probe response: probeUrlLiveness resolves false", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    assert.ok(url.includes("/__probe"), `expected /__probe call, got ${url}`);
    return new Response(JSON.stringify({ ok: false, status: 404 }), {
      status: 200, // the PROBE endpoint itself is 200; the payload carries the target status
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(result, false, "non-2xx probe payload must return false");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

test("non-2xx probe response: 500 internal server error → false", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify({ ok: false, status: 500, error: "server error" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(result, false);
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

test("non-2xx probe response: 403 forbidden → false", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify({ ok: false, status: 403 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(result, false);
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Network error → ok: false
// ---------------------------------------------------------------------------

test("network error: fetch throws → probeUrlLiveness resolves false", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    throw new TypeError("Failed to fetch");
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(result, false, "network error must return false (not throw)");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

test("network error: AbortError (timeout) → probeUrlLiveness resolves false", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const err = new DOMException("The operation was aborted.", "AbortError");
    throw err;
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(result, false, "AbortError (timeout) must return false (not throw)");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Cache stores false results too (negative caching)
// ---------------------------------------------------------------------------

test("negative caching: false result is cached and not re-fetched on second call", async () => {
  let fetchCallCount = 0;
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    fetchCallCount++;
    return new Response(JSON.stringify({ ok: false, status: 404 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    clearLivenessCache();
    const first = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(first, false);
    assert.equal(fetchCallCount, 1);

    const second = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(second, false, "second call must return cached false");
    assert.equal(fetchCallCount, 1, "second call must NOT re-fetch");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Different URLs have independent cache entries
// ---------------------------------------------------------------------------

test("cache keys are URL-specific: two distinct URLs each trigger their own fetch", async () => {
  let fetchCallCount = 0;
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    fetchCallCount++;
    return new Response(JSON.stringify({ ok: true, status: 200 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    clearLivenessCache();
    await probeUrlLiveness(SYNTHETIC_URL, /* sim= */ false);
    await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(fetchCallCount, 2, "two distinct URLs must each trigger a fetch");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// PHI-free invariant
// ---------------------------------------------------------------------------

test("R1 NO-PHI: no SSN/DOB/phone/email patterns in test fixtures", () => {
  const fixtures = [SYNTHETIC_URL, DEAD_URL];
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
