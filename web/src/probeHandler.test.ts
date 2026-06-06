/**
 * Tests for `web/src/probeHandler.ts` — SPEC-0006 R21 `/__probe` middleware
 * server-side fetch logic.
 *
 * Covers the cases referenced in the spec test matrix (§5.5 T19/T20/T21) as
 * unit tests with a mocked global.fetch so no real HTTP connections are made:
 *
 *   T19 analogue — 2xx response → ok:true with status forwarded.
 *   T20 analogue — 4xx response → ok:false with status forwarded.
 *   T21 analogue — AbortError (timeout) → ok:false with error string.
 *
 * Additional coverage:
 *   - Range-GET header is included in the outbound request.
 *   - 3xx response → ok:true (redirect:follow means 3xx reaches ok:true;
 *     the < 400 bound handles unreachable 3xx as well — belt-and-braces).
 *   - 5xx response → ok:false with status.
 *   - Network error (TypeError) → ok:false with error string.
 *   - { ok, status, error? } shape invariants.
 *   - executeProbe never throws; always resolves.
 *
 * PHI-FREE: all fixture strings are synthetic; no patient identifiers,
 * SSNs, DOBs, phone numbers, or email addresses appear in this file.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { executeProbe, type ProbeResult } from "./probeHandler.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SYNTHETIC_URL = "https://medlineplus.gov/druginfo/meds/a603010.html";

// Module-level capture used by tests that inspect the outbound request.
// Stored as a tuple [url, init] to avoid exactOptionalPropertyTypes issues
// with the RequestInit interface.
let lastFetchUrl: string | null = null;
let lastFetchInit: RequestInit | null = null;

function mockFetch(
  response: { status: number } | { throw: Error },
): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    lastFetchUrl = typeof input === "string" ? input : input.toString();
    lastFetchInit = init ?? null;
    if ("throw" in response) throw response.throw;
    return new Response("", { status: response.status });
  };
}

// ---------------------------------------------------------------------------
// T19 analogue — 2xx → ok:true
// ---------------------------------------------------------------------------

test("T19 analogue: 200 OK → ok:true with status forwarded", async () => {
  const original = global.fetch;
  global.fetch = mockFetch({ status: 200 });
  try {
    const result = await executeProbe(SYNTHETIC_URL);
    assert.equal(result.ok, true, "200 must map to ok:true");
    assert.equal(result.status, 200, "status must be forwarded");
  } finally {
    global.fetch = original;
  }
});

test("T19 analogue: 206 Partial Content → ok:true (Range-GET success)", async () => {
  const original = global.fetch;
  global.fetch = mockFetch({ status: 206 });
  try {
    const result = await executeProbe(SYNTHETIC_URL);
    assert.equal(result.ok, true, "206 Partial Content must map to ok:true");
    assert.equal(result.status, 206, "status must be forwarded");
  } finally {
    global.fetch = original;
  }
});

test("T19 analogue: 301 redirect (no follow) → ok:true (< 400 gate)", async () => {
  const original = global.fetch;
  global.fetch = mockFetch({ status: 301 });
  try {
    const result = await executeProbe(SYNTHETIC_URL);
    assert.equal(result.ok, true, "3xx with redirect:follow is already resolved to 2xx; bare 3xx still < 400 → ok:true");
  } finally {
    global.fetch = original;
  }
});

// ---------------------------------------------------------------------------
// T20 analogue — 4xx → ok:false
// ---------------------------------------------------------------------------

test("T20 analogue: 404 Not Found → ok:false with status 404", async () => {
  const original = global.fetch;
  global.fetch = mockFetch({ status: 404 });
  try {
    const result = await executeProbe(SYNTHETIC_URL);
    assert.equal(result.ok, false, "404 must map to ok:false");
    assert.equal(result.status, 404, "status must be forwarded");
    // no error field on HTTP failure (error is reserved for thrown exceptions)
    if (!result.ok) {
      assert.equal(result.error, undefined, "4xx result must not carry an error string");
    }
  } finally {
    global.fetch = original;
  }
});

test("T20 analogue: 403 Forbidden → ok:false with status 403", async () => {
  const original = global.fetch;
  global.fetch = mockFetch({ status: 403 });
  try {
    const result = await executeProbe(SYNTHETIC_URL);
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  } finally {
    global.fetch = original;
  }
});

test("T20 analogue: 500 Internal Server Error → ok:false with status 500", async () => {
  const original = global.fetch;
  global.fetch = mockFetch({ status: 500 });
  try {
    const result = await executeProbe(SYNTHETIC_URL);
    assert.equal(result.ok, false, "5xx must map to ok:false");
    assert.equal(result.status, 500, "status must be forwarded");
  } finally {
    global.fetch = original;
  }
});

// ---------------------------------------------------------------------------
// T21 analogue — AbortError (timeout) → ok:false with error string
// ---------------------------------------------------------------------------

test("T21 analogue: AbortError → ok:false with error string (never throws)", async () => {
  const original = global.fetch;
  global.fetch = mockFetch({
    throw: new DOMException("The operation was aborted.", "AbortError"),
  });
  try {
    const result = await executeProbe(SYNTHETIC_URL);
    assert.equal(result.ok, false, "AbortError must map to ok:false");
    assert.equal(result.status, 0, "AbortError must report status 0");
    assert.ok(
      !result.ok && typeof result.error === "string" && result.error.length > 0,
      "AbortError message must be in the error field",
    );
  } finally {
    global.fetch = original;
  }
});

// ---------------------------------------------------------------------------
// Range-GET header — verifies the outbound request uses Range: bytes=0-0
// ---------------------------------------------------------------------------

test("outbound request uses Range: bytes=0-0 header", async () => {
  const original = global.fetch;
  lastFetchUrl = null;
  lastFetchInit = null;
  global.fetch = mockFetch({ status: 200 });
  try {
    await executeProbe(SYNTHETIC_URL);
    // Use assert.ok (not null check + throw) so TypeScript sees the
    // post-assert code as reachable; capture in a non-null assertion.
    assert.ok(lastFetchInit !== null, "fetch must have been called");
    const rangeHeader = (
      (lastFetchInit as RequestInit).headers as Record<string, string> | undefined
    )?.Range;
    assert.equal(rangeHeader, "bytes=0-0", "Range header must be bytes=0-0");
  } finally {
    global.fetch = original;
    lastFetchUrl = null;
    lastFetchInit = null;
  }
});

test("outbound request is issued to the target URL, not a proxy", async () => {
  const original = global.fetch;
  lastFetchUrl = null;
  global.fetch = mockFetch({ status: 200 });
  try {
    await executeProbe(SYNTHETIC_URL);
    if (lastFetchUrl === null) throw new Error("fetch was not called");
    assert.equal(lastFetchUrl, SYNTHETIC_URL, "fetch must target the raw URL");
  } finally {
    global.fetch = original;
    lastFetchUrl = null;
  }
});

// ---------------------------------------------------------------------------
// Network error — TypeError (DNS / connection refused) → ok:false
// ---------------------------------------------------------------------------

test("network error (TypeError) → ok:false with error string (never throws)", async () => {
  const original = global.fetch;
  global.fetch = mockFetch({ throw: new TypeError("Failed to fetch") });
  try {
    const result = await executeProbe(SYNTHETIC_URL);
    assert.equal(result.ok, false, "network error must map to ok:false");
    assert.equal(result.status, 0, "network error must report status 0");
    assert.ok(
      !result.ok && typeof result.error === "string" && result.error.includes("Failed to fetch"),
      "error field must carry the thrown message",
    );
  } finally {
    global.fetch = original;
  }
});

// ---------------------------------------------------------------------------
// Result shape invariants
// ---------------------------------------------------------------------------

test("ok:true result shape: has ok=true and status fields, no error field", async () => {
  const original = global.fetch;
  global.fetch = mockFetch({ status: 200 });
  try {
    const result: ProbeResult = await executeProbe(SYNTHETIC_URL);
    assert.equal(result.ok, true);
    assert.ok("status" in result, "ok:true result must have status field");
    assert.ok(!("error" in result), "ok:true result must not have error field");
  } finally {
    global.fetch = original;
  }
});

test("ok:false result shape (HTTP error): has ok=false, status, no error", async () => {
  const original = global.fetch;
  global.fetch = mockFetch({ status: 404 });
  try {
    const result: ProbeResult = await executeProbe(SYNTHETIC_URL);
    assert.equal(result.ok, false);
    assert.ok("status" in result, "ok:false result must have status field");
    assert.equal(result.status, 404);
  } finally {
    global.fetch = original;
  }
});

test("ok:false result shape (thrown error): has ok=false, status=0, error string", async () => {
  const original = global.fetch;
  global.fetch = mockFetch({ throw: new TypeError("connection refused") });
  try {
    const result: ProbeResult = await executeProbe(SYNTHETIC_URL);
    assert.equal(result.ok, false);
    assert.equal(result.status, 0);
    assert.ok(!result.ok && typeof result.error === "string");
  } finally {
    global.fetch = original;
  }
});

// ---------------------------------------------------------------------------
// PHI-free invariant
// ---------------------------------------------------------------------------

test("R1 NO-PHI: no SSN/DOB/phone/email patterns in test fixtures", () => {
  const fixtures = [SYNTHETIC_URL];
  const json = JSON.stringify(fixtures);
  assert.equal(/\b\d{3}-\d{2}-\d{4}\b/.test(json), false, "SSN-shaped");
  assert.equal(/"\d{4}-\d{2}-\d{2}"/.test(json), false, "DOB-shaped");
  assert.equal(/\(\d{3}\)\s?\d{3}-\d{4}/.test(json), false, "phone (xxx)");
  assert.equal(/\b\d{3}-\d{3}-\d{4}\b/.test(json), false, "phone xxx-xxx-xxxx");
  assert.equal(
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(json),
    false,
    "email-shaped",
  );
});
