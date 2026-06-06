/**
 * SPEC-0006 R21 — pure, injectable helper for the evidence-URL liveness
 * debounce used by Create.tsx's useEffect.
 *
 * `runLivenessDebounce` owns the debounce timer and the stale-response
 * cancellation guard.  Its only side-effect is calling the supplied
 * `onResult` callback once the probe resolves (if neither the timer nor the
 * in-flight probe has been cancelled).
 *
 * Design contract:
 *   - No React import — this is a pure function, usable in Node test runners
 *     without jsdom or a React renderer.
 *   - The caller (Create.tsx's useEffect) is responsible for:
 *       (a) calling the returned cleanup when the effect re-runs or unmounts,
 *       (b) skipping the call entirely in sim mode.
 *   - If `url.trim() === ""` the function returns immediately: no timer is
 *     scheduled, no probe is called, and `onResult` is never invoked.
 *
 * PHI-FREE: this module handles only public evidence URLs; no patient
 * identifiers, SSNs, DOBs, phone numbers, or email addresses are involved.
 */

import type { LivenessResult } from "./urlLiveness.js";
import { probeUrlLiveness } from "./urlLiveness.js";

/** Debounce delay for evidence-URL liveness probes (ms). */
export const PROBE_DEBOUNCE_MS = 600;

/** Injectable probe function signature — matches `probeUrlLiveness`. */
export type ProbeFunction = (url: string, sim: boolean) => Promise<LivenessResult>;

/** Options bag for `runLivenessDebounce`. */
export interface LivenessDebounceOptions {
  /** Debounce delay in ms. Defaults to PROBE_DEBOUNCE_MS. */
  readonly debounceMs?: number;
  /** Probe function. Defaults to `probeUrlLiveness`. */
  readonly probe?: ProbeFunction;
}

/**
 * Schedule a debounced liveness probe for `url`.
 *
 * @param url      - The evidence URL to probe (trimmed internally).
 * @param isReal   - Whether the app is in real (on-chain) mode.  When `false`,
 *                   `sim=true` is passed to the probe so the probe function can
 *                   short-circuit network I/O if desired.  The helper itself
 *                   still schedules and calls `onResult` — the sim-mode
 *                   short-circuit in Create.tsx is enforced by the caller, not
 *                   by this helper.
 * @param onResult - Callback invoked with the probe result once the debounce
 *                   fires and the probe resolves, unless cancelled first.
 * @param options  - Optional overrides for `debounceMs` and `probe` (for
 *                   testing).
 * @returns A cleanup function.  Call it to cancel any pending timer and set
 *          the stale-response guard so an already-in-flight probe's result is
 *          discarded when it eventually resolves.
 */
export function runLivenessDebounce(
  url: string,
  isReal: boolean,
  onResult: (result: LivenessResult) => void,
  options: LivenessDebounceOptions = {},
): () => void {
  const trimmed = url.trim();
  if (trimmed === "") {
    // Empty URL — nothing to probe; return a no-op cleanup.
    return () => { /* no-op */ };
  }

  const debounceMs = options.debounceMs ?? PROBE_DEBOUNCE_MS;
  const probe = options.probe ?? probeUrlLiveness;

  let cancelled = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  timerId = setTimeout(() => {
    timerId = null;
    void probe(trimmed, !isReal).then((result) => {
      if (!cancelled) {
        onResult(result);
      }
    });
  }, debounceMs);

  return () => {
    cancelled = true;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };
}
