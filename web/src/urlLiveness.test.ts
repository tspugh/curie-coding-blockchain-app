/**
 * Tests for `web/src/urlLiveness.ts` — SPEC-0006 R21 pre-submit evidence-URL
 * liveness check.
 *
 * Covers:
 *   - Cache hit: a second call for the same URL within 24 h returns the cached
 *     result without issuing a new fetch.
 *   - Cache TTL: a within-24 h hit is reused; past the TTL it re-fetches —
 *     verified deterministically via the injected `now` clock (no back-door).
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

test("cache TTL: a hit within 24 h is reused; past the TTL it re-fetches (injected clock)", async () => {
  // Behavioral test using the injected `now` clock — no cache back-door. We
  // populate the cache at logical time t0, confirm a call just before the TTL
  // boundary is a cache hit (no new fetch), and a call just past it re-fetches.
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

    const t0 = 1_000_000_000;

    // 1) First call at t0 populates the cache (one fetch).
    const r1 = await probeUrlLiveness(SYNTHETIC_URL, /* sim= */ false, t0);
    assert.equal(r1.ok, true);
    assert.equal(fetchCallCount, 1, "first call must fetch");

    // 2) Call just BEFORE the TTL boundary → cache hit, no new fetch.
    const r2 = await probeUrlLiveness(SYNTHETIC_URL, false, t0 + LIVENESS_CACHE_TTL_MS - 1);
    assert.equal(r2.ok, true);
    assert.equal(fetchCallCount, 1, "within-TTL call must be served from cache");

    // 3) Call just AT/PAST the TTL boundary → stale, must re-fetch.
    const r3 = await probeUrlLiveness(SYNTHETIC_URL, false, t0 + LIVENESS_CACHE_TTL_MS);
    assert.equal(r3.ok, true);
    assert.equal(fetchCallCount, 2, "expired entry must trigger exactly one re-fetch");
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
// Branch coverage: ?? fallbacks and non-Error throw path
//
// These tests exercise the four branches that were previously uncovered (c8
// branch counts = 0) to bring livenessDebounce.ts and urlLiveness.ts above
// the 85% branch threshold:
//
//   B1 (line 107): `json.status ?? 200` — payload has ok:true but no status field
//   B2 (line 109): `json.status ?? 0`   — payload has ok:false, error, but no status
//   B3 (line 111): `json.status ?? 0`   — payload has ok:false, no error, no status
//   B4 (line 116): `String(err)`        — catch block receives a non-Error value
//
// All fixture values are synthetic; no patient data, SSNs, DOBs, or PHI.
// ---------------------------------------------------------------------------

test("B1 (line 107): ok:true with no status field in payload uses 200 default", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    // Omit the `status` field so `json.status` is undefined → triggers the `?? 200` branch.
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(SYNTHETIC_URL, /* sim= */ false);
    assert.equal(result.ok, true, "B1: ok must be true");
    // json.status is undefined → result.status = undefined ?? 200 = 200
    assert.equal(result.status, 200, "B1: missing status field must default to 200 via ?? operator");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

test("B2 (line 109): ok:false + error field, no status → status defaults to 0", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    // Provide error but omit status so `json.status` is undefined → triggers `?? 0` branch.
    return new Response(JSON.stringify({ ok: false, error: "connection refused" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(result.ok, false, "B2: ok must be false");
    assert.equal(result.status, 0, "B2: missing status with error must default to 0 via ?? operator");
    assert.ok(!result.ok && result.error === "connection refused", "B2: error must be forwarded");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

test("B3 (line 111): ok:false, no error, no status → status defaults to 0", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    // Omit both error and status — hits the else branch with `?? 0`.
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(result.ok, false, "B3: ok must be false");
    assert.equal(result.status, 0, "B3: missing status in else branch must default to 0 via ?? operator");
  } finally {
    global.fetch = originalFetch;
    clearLivenessCache();
  }
});

test("B4 (line 116): catch receives a non-Error value → String(err) path", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    // Throw a plain string, not an Error instance, so `err instanceof Error` is false.
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw "connection reset by peer";
  };

  try {
    clearLivenessCache();
    const result = await probeUrlLiveness(DEAD_URL, /* sim= */ false);
    assert.equal(result.ok, false, "B4: non-Error throw must resolve ok:false");
    assert.ok(
      !result.ok && typeof result.error === "string" && result.error.length > 0,
      "B4: error field must be populated via String(err) when err is not an Error instance",
    );
    // String("connection reset by peer") === "connection reset by peer"
    assert.ok(
      !result.ok && result.error !== undefined && result.error.includes("connection reset by peer"),
      `B4: String(err) must include the thrown string; got: ${!result.ok ? result.error : ""}`,
    );
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
