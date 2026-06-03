/**
 * Tests for `web/src/urlLiveness.ts` — SPEC-0006 R21 pre-submit evidence-URL
 * liveness check.
 *
 * Covers:
 *   - Cache hit: a second call for the same URL within 24 h returns the cached
 *     result without issuing a new fetch.
 *   - Cache miss / TTL-expiry: a stale entry (ts injected via seedLivenessCacheEntry)
 *     triggers a re-fetch.
 *   - Sim-mode bypass: in simulated mode `probeUrlLiveness` resolves immediately
 *     without any network I/O.
 *   - Non-2xx response: `/__probe` returning `{ ok: false, status: 404 }` →
 *     `probeUrlLiveness` resolves `{ ok: false }`.
 *   - Network error: fetch to `/__probe` throwing → `probeUrlLiveness`
 *     resolves `{ ok: false }`.
 *   - Result shape: `ok: true` carries `status`; `ok: false` carries `status`
 *     and optional `error` — all fields the Create.tsx error banner needs.
 *
 * PHI-FREE: all fixture strings are synthetic; no patient identifiers,
 * SSNs, DOBs, phone numbers, or email addresses appear anywhere in this file.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  probeUrlLiveness,
  clearLivenessCache,
  seedLivenessCacheEntry,
  formatLivenessError,
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
  global.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
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
    assert.equal(first.ok, true, "first call should return ok:true");
    assert.equal(fetchCallCount, 1, "first call must issue exactly one fetch");

    // Second call: must NOT re-fetch.
    const second = await probeUrlLiveness(SYNTHETIC_URL, /* sim= */ false);
    assert.equal(second.ok, true, "second call should return cached ok:true");
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
  // Behavioral test: inject a stale entry (ts=0, well beyond the 24 h TTL)
  // via the seedLivenessCacheEntry back-door, then call probeUrlLiveness and
  // assert that it issues a new fetch (TTL-expiry → re-fetch path).
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

    // Sanity: confirm LIVENESS_CACHE_TTL_MS is 24 h.
    assert.equal(
      LIVENESS_CACHE_TTL_MS,
      24 * 60 * 60 * 1000,
      "LIVENESS_CACHE_TTL_MS must equal 24 h in ms",
    );

    // Seed a stale entry: ts=0 means it expired (Date.now() - 0 >> TTL).
    seedLivenessCacheEntry(SYNTHETIC_URL, { ok: true, status: 200 }, 0);

    // The cache has an entry, but it is stale — must re-fetch.
    assert.equal(fetchCallCount, 0, "no fetch before calling probeUrlLiveness");
    const result = await probeUrlLiveness(SYNTHETIC_URL, /* sim= */ false);
    assert.equal(result.ok, true, "probe should return ok:true from fresh fetch");
    assert.equal(fetchCallCount, 1, "stale entry must trigger exactly one re-fetch");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Sim-mode bypass
// ---------------------------------------------------------------------------

test("sim mode: probeUrlLiveness resolves ok:true immediately without fetching", async () => {
  let fetchCalled = false;
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    fetchCalled = true;
    throw new Error("fetch must not be called in sim mode");
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(SYNTHETIC_URL, /* sim= */ true);
    assert.equal(result.ok, true, "sim mode must return ok:true");
    assert.equal(fetchCalled, false, "sim mode must NOT call fetch");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

test("sim mode: returns ok:true even for a URL that would otherwise be dead", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    throw new Error("fetch must not be called in sim mode");
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ true);
    assert.equal(result.ok, true);
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Non-2xx → ok: false — result carries status and optional error
// ---------------------------------------------------------------------------

test("non-2xx probe response: probeUrlLiveness resolves ok:false with status", async () => {
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
    assert.equal(result.ok, false, "non-2xx probe payload must return ok:false");
    assert.equal(result.status, 404, "status must be forwarded from proxy payload");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

test("non-2xx probe response: 500 internal server error → ok:false with error string", async () => {
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
    assert.equal(result.ok, false);
    assert.equal(result.status, 500);
    // error field must be passed through so Create.tsx can interpolate it
    assert.ok(
      !result.ok && result.error === "server error",
      "error string must be forwarded from proxy payload",
    );
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

test("non-2xx probe response: 403 forbidden → ok:false", async () => {
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
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// Network error → ok: false, error carries the thrown message
// ---------------------------------------------------------------------------

test("network error: fetch throws → probeUrlLiveness resolves ok:false (not throw)", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    throw new TypeError("Failed to fetch");
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(result.ok, false, "network error must return ok:false (not throw)");
    assert.ok(
      !result.ok && typeof result.error === "string" && result.error.length > 0,
      "error must carry the thrown message so the UI can interpolate it",
    );
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

test("network error: AbortError (timeout) → probeUrlLiveness resolves ok:false", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const err = new DOMException("The operation was aborted.", "AbortError");
    throw err;
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(result.ok, false, "AbortError (timeout) must return ok:false (not throw)");
    assert.ok(
      !result.ok && typeof result.error === "string",
      "AbortError message must be captured in error field",
    );
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
    assert.equal(first.ok, false);
    assert.equal(fetchCallCount, 1);

    const second = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(second.ok, false, "second call must return cached ok:false");
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
// Result shape: ok:true carries status field (needed for potential future use)
// ---------------------------------------------------------------------------

test("ok:true result carries the status field from the proxy payload", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify({ ok: true, status: 200 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(SYNTHETIC_URL, /* sim= */ false);
    assert.equal(result.ok, true);
    assert.equal(result.status, 200, "ok:true result must carry status from proxy");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

// ---------------------------------------------------------------------------
// formatLivenessError — pins the spec-mandated banner interpolation contract
// (calls the REAL exported function from urlLiveness.ts, not local copies)
// ---------------------------------------------------------------------------

test("formatLivenessError: HTTP status → 'evidence URL unreachable (HTTP 404) — fix…'", () => {
  // Directly calls the exported production function — test fails if the
  // function is deleted or the spec string changes.
  const banner = formatLivenessError({ ok: false, status: 404 });
  assert.ok(
    banner.includes("HTTP 404"),
    `banner must include 'HTTP 404'; got: ${banner}`,
  );
  assert.ok(
    banner.includes("evidence URL unreachable"),
    `banner must start with spec prefix; got: ${banner}`,
  );
  assert.ok(
    banner.includes("fix the URL or pick a known drug from the list"),
    `banner must include affordance; got: ${banner}`,
  );
});

test("formatLivenessError: network error → 'evidence URL unreachable (Failed to fetch) — fix…'", () => {
  const banner = formatLivenessError({ ok: false, status: 0, error: "Failed to fetch" });
  assert.ok(
    banner.includes("Failed to fetch"),
    `banner must include thrown message; got: ${banner}`,
  );
  assert.ok(
    banner.includes("evidence URL unreachable"),
    `banner must start with spec prefix; got: ${banner}`,
  );
  assert.ok(
    banner.includes("fix the URL or pick a known drug from the list"),
    `banner must include affordance; got: ${banner}`,
  );
});

test("formatLivenessError: missing error and status=0 → 'network error' fallback", () => {
  // ok:false with no error and status=0 — must fall back to 'network error'
  const banner = formatLivenessError({ ok: false, status: 0 });
  assert.ok(
    banner.includes("network error"),
    `banner must include 'network error' fallback; got: ${banner}`,
  );
});

test("formatLivenessError: ok:true result → empty string (no-op for callers that don't branch)", () => {
  // Must return empty string so callers can call it unconditionally.
  const banner = formatLivenessError({ ok: true, status: 200 });
  assert.equal(banner, "", "ok:true must return empty string");
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
