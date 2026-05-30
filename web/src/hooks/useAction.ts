// SPEC-0003 R13/R14 — in-flight guard + error surfacing for every tx-firing action.
// SPEC-0005 R19 — pre-flight balance check at write-tx fire.

import { useRef, useState } from "react";
import {
  extractRevertReason,
  mapRevertReason,
  type RevertReasonEntry,
} from "../../../src/protocol/revertReasonMap.js";
import { useWalletBalance } from "./useWalletBalance.js";
import { AGENT_FEE_RESERVE_WEI } from "../config.js";

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

  // Live balance for the active signer; `null` in simulated mode (no provider).
  // SPEC-0005 R19 uses this to short-circuit BEFORE fn() is invoked so the
  // user sees a friendly headline instead of the raw RPC "account does not
  // exist" / "insufficient funds for gas" wrapper.
  const { wei: balanceWei } = useWalletBalance();

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
      // SPEC-0005 R19: pre-flight balance check. Sim mode bypasses
      // (balanceWei === null — no provider, so no chain to pay for). In real
      // mode, short-circuit when the wallet can't cover the next-step agent
      // fee reserve. Routing through mapRevertReason keeps the headline
      // copy in one place (R17).
      if (balanceWei !== null && balanceWei < AGENT_FEE_RESERVE_WEI) {
        const entry = mapRevertReason("account does not exist");
        setError(entry);
        throw new Error("preflight: wallet balance below agent-fee reserve");
      }

      const result = await fn();
      return result;
    } catch (err: unknown) {
      // Only re-map if we didn't already set the entry via the preflight
      // branch above (which would leave `error` non-null on rethrow).
      const raw = extractRevertReason(err);
      const entry = mapRevertReason(raw);
      setError((prev) => prev ?? entry);
      throw err;
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  };

  return { pending, error, run };
}

