/**
 * SPEC-0006 R21 — URL reachability probe, server-side fetch logic.
 *
 * This module contains the pure async logic for the `GET /__probe` Vite
 * dev-server middleware (see vite.config.ts `urlProbePlugin`). Keeping it
 * separate makes the logic unit-testable without spinning up a Vite server.
 *
 * Strategy (deliberate HEAD-drop, documented per N1 review note):
 *   Spec §3.9 describes HEAD-first with a Range-GET fallback.  This
 *   implementation issues a single Range-GET directly — HEAD is omitted.
 *   Rationale: the probe runs server-side (no CORS restriction), so the
 *   CORS-workaround motivation for HEAD disappears.  A Range-GET is
 *   universally supported and avoids the two-round-trip cost.  The
 *   `redirect: "follow"` + `status < 400` combination means a followed-3xx
 *   also reads ok:true (belt-and-braces for servers that return bare 3xx
 *   without Location).
 *
 * PHI-FREE: this module handles only public evidence URLs; no patient
 * identifiers, SSNs, DOBs, phone numbers or email addresses are involved.
 */

/** The structured payload returned by the `/__probe` endpoint. */
export type ProbeResult =
  | { ok: true; status: number }
  | { ok: false; status: number; error?: string };

/**
 * Fetch `url` server-side with a Range-GET, returning a structured
 * `ProbeResult`.  Never throws.
 *
 * Behaviour:
 *   - Issues `GET <url>` with `Range: bytes=0-0` and a 10 s AbortSignal.
 *   - Any HTTP 2xx or 3xx status → `{ ok: true, status }`.
 *   - Any HTTP 4xx or 5xx status → `{ ok: false, status }`.
 *   - Network error or AbortError (timeout) → `{ ok: false, status: 0, error }`.
 *
 * @param url     - The target URL to probe.
 * @param timeout - Abort timeout in milliseconds (default 10 000 ms).
 */
export async function executeProbe(
  url: string,
  timeout = 10_000,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timerId);
    const ok = response.status >= 200 && response.status < 400;
    if (ok) {
      return { ok: true, status: response.status };
    }
    return { ok: false, status: response.status };
  } catch (err) {
    clearTimeout(timerId);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, error: message };
  }
}
