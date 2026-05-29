// SPEC-0003 R13/R14 — in-flight guard + error surfacing for every tx-firing action.

import { useRef, useState } from "react";
import {
  extractRevertReason,
  mapRevertReason,
  type RevertReasonEntry,
} from "../../../src/protocol/revertReasonMap.js";

/**
 * Wraps an async write function with:
 *   - `pending` — true while the call is in flight.
 *   - `error` — the mapped revert reason from the most recent failure, or null.
 *   - `run` — invokes `fn`. On success returns the result. On error, sets
 *     `error` and rethrows so the caller may handle it.
 *
 * In-flight guard (R14): if `run()` is called while `pending` is true, the
 * duplicate call is rejected immediately with an Error("in-flight"). This is
 * a hard reject rather than coalescing to the existing promise because
 * callers may supply different `fn` closures on each render cycle; coalescing
 * across potentially-different closures is semantically unsound. The UI
 * disables the button on `pending === true` so this guard is a safety net, not
 * normal control flow.
 *
 * State clears: `pending` and `error` reset at the start of each new `run()`
 * call. No timer-based clears, no cleanup-only effects.
 *
 * @param fn - The async write function to wrap. Should be stable (memoized)
 *   or accepted that a new closure reference does NOT restart in-flight state.
 */
export function useAction<T>(
  fn: () => Promise<T>,
): { pending: boolean; error: RevertReasonEntry | null; run: () => Promise<T> } {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<RevertReasonEntry | null>(null);

  // Track in-flight state in a ref so `run` closure can read the current
  // value without becoming stale across renders.
  const inFlightRef = useRef(false);

  const run = async (): Promise<T> => {
    if (inFlightRef.current) {
      throw new Error("in-flight");
    }

    // Clear previous error, mark as in-flight.
    inFlightRef.current = true;
    setPending(true);
    setError(null);

    try {
      const result = await fn();
      return result;
    } catch (err: unknown) {
      const raw = extractRevertReason(err);
      const entry = mapRevertReason(raw);
      setError(entry);
      throw err;
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  };

  return { pending, error, run };
}

