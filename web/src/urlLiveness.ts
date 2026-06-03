/**
 * SPEC-0006 R21 — pre-submit evidence-URL liveness check.
 *
 * `probeUrlLiveness(url, sim)` issues a GET `/__probe?url=<encoded>` request
 * in real mode and resolves immediately to `true` in sim mode. Results are
 * cached per-URL for 24 h (LIVENESS_CACHE_TTL_MS) so repeated keystrokes
 * don't hammer the dev-server proxy.
 *
 * PHI-FREE: this module handles only public evidence URLs; no patient
 * identifiers, SSNs, DOBs, phone numbers or email addresses are involved.
 */

/** 24-hour memo-cache TTL in milliseconds. */
export const LIVENESS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  ok: boolean;
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
 * Probe whether `url` is reachable by routing through the Vite dev-server
 * `GET /__probe?url=<encoded>` middleware, which performs the actual outbound
 * fetch server-side (avoids browser CORS restrictions).
 *
 * In sim mode (`sim === true`) the function bypasses the network entirely and
 * resolves `true` immediately — no network I/O, no cache writes.
 *
 * Cache behaviour (real mode only):
 *   - A fresh hit (within LIVENESS_CACHE_TTL_MS) returns the cached boolean.
 *   - A stale or absent entry issues a new `/__probe` fetch and caches the result.
 *   - Both `true` and `false` results are cached (negative caching).
 *
 * @param url - The evidence URL to probe.
 * @param sim - Whether the app is running in simulated (no-chain) mode.
 * @returns `true` if the URL is live, `false` otherwise (never throws).
 */
export async function probeUrlLiveness(url: string, sim: boolean): Promise<boolean> {
  if (sim) return true;

  const now = Date.now();
  const cached = cache.get(url);
  if (cached !== undefined && now - cached.ts < LIVENESS_CACHE_TTL_MS) {
    return cached.ok;
  }

  try {
    const probeUrl = `/__probe?url=${encodeURIComponent(url)}`;
    const resp = await fetch(probeUrl);
    const json = (await resp.json()) as { ok: boolean; status: number; error?: string };
    const ok = json.ok === true;
    cache.set(url, { ok, ts: Date.now() });
    return ok;
  } catch {
    cache.set(url, { ok: false, ts: Date.now() });
    return false;
  }
}
