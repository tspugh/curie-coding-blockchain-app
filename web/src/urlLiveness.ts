/**
 * SPEC-0006 R21 — pre-submit evidence-URL liveness check.
 *
 * `probeUrlLiveness(url, sim)` issues a GET `/__probe?url=<encoded>` request
 * in real mode and resolves immediately to `{ ok: true }` in sim mode. Results
 * are cached per-URL for 24 h (LIVENESS_CACHE_TTL_MS) so repeated keystrokes
 * don't hammer the dev-server proxy.
 *
 * The return type carries the full proxy payload (`ok`, `status`, `error`) so
 * that callers can interpolate the spec-mandated inline error message via
 * `formatLivenessError`:
 *   "evidence URL unreachable (HTTP <code> or <error>) — fix the URL or pick
 *    a known drug from the list"
 *
 * PHI-FREE: this module handles only public evidence URLs; no patient
 * identifiers, SSNs, DOBs, phone numbers or email addresses are involved.
 */

/** 24-hour memo-cache TTL in milliseconds. */
export const LIVENESS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** The structured result returned by `probeUrlLiveness`. */
export type LivenessResult =
  | { ok: true; status: number }
  | { ok: false; status: number; error?: string };

interface CacheEntry {
  result: LivenessResult;
  ts: number;
}

/** Module-level per-URL memo cache. */
const cache = new Map<string, CacheEntry>();

/**
 * Clear the memo cache. Exported for tests that need a clean slate between
 * assertions.
 */
export function clearLivenessCache(): void {
  cache.clear();
}

/**
 * Format the detail portion of the R21 error banner for a failed liveness
 * result.
 *
 * Returns the spec-mandated full string:
 *   "evidence URL unreachable (HTTP <code>) — fix the URL or pick a known drug from the list"
 * or
 *   "evidence URL unreachable (<error message>) — fix the URL or pick a known drug from the list"
 *
 * Only meaningful when `result.ok === false`; calling it on an ok:true result
 * is a no-op that returns an empty string so callers never need to branch.
 *
 * PHI-FREE: only forwards HTTP status codes and network error strings; no
 * patient identifiers are involved.
 */
export function formatLivenessError(result: LivenessResult): string {
  if (result.ok) return "";
  const detail =
    result.status > 0
      ? `HTTP ${result.status}`
      : result.error ?? "network error";
  return `evidence URL unreachable (${detail}) — fix the URL or pick a known drug from the list`;
}

/**
 * Probe whether `url` is reachable by routing through the Vite dev-server
 * `GET /__probe?url=<encoded>` middleware, which performs the actual outbound
 * fetch server-side (avoids browser CORS restrictions).
 *
 * In sim mode (`sim === true`) the function bypasses the network entirely and
 * resolves `{ ok: true, status: 0 }` immediately — no network I/O, no cache
 * writes.
 *
 * Cache behaviour (real mode only):
 *   - A fresh hit (within LIVENESS_CACHE_TTL_MS) returns the cached result.
 *   - A stale or absent entry issues a new `/__probe` fetch and caches the
 *     result.
 *   - Both `ok: true` and `ok: false` results are cached (negative caching).
 *
 * @param url - The evidence URL to probe.
 * @param sim - Whether the app is running in simulated (no-chain) mode.
 * @param now - Injectable clock (ms epoch); defaults to `Date.now()`. Tests pass
 *   an explicit value to exercise the TTL-expiry path deterministically without
 *   reaching into the cache — there is no production cache-mutation seam.
 * @returns A `LivenessResult`; never throws.
 */
export async function probeUrlLiveness(
  url: string,
  sim: boolean,
  now: number = Date.now(),
): Promise<LivenessResult> {
  if (sim) return { ok: true, status: 0 };

  const cached = cache.get(url);
  if (cached !== undefined && now - cached.ts < LIVENESS_CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const probeUrl = `/__probe?url=${encodeURIComponent(url)}`;
    const resp = await fetch(probeUrl);
    const json = (await resp.json()) as { ok: boolean; status: number; error?: string };
    let result: LivenessResult;
    if (json.ok === true) {
      result = { ok: true, status: json.status ?? 200 };
    } else if (json.error !== undefined) {
      result = { ok: false, status: json.status ?? 0, error: json.error };
    } else {
      result = { ok: false, status: json.status ?? 0 };
    }
    cache.set(url, { result, ts: now });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result: LivenessResult = { ok: false, status: 0, error: message };
    cache.set(url, { result, ts: now });
    return result;
  }
}
