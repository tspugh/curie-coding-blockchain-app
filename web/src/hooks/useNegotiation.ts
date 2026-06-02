/** SPEC-0003 §2.3 R13 — re-fetches negotiation view, policy, and price-basis on every tx-confirmed event keyed to reqId; exposes an imperative refetch handle. */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CoverageEvent,
  type NegotiationView,
  type PolicyCommitment,
  type PriceBasis,
} from "@lib";
import { client } from "../client.js";

export interface UseNegotiationResult {
  view: NegotiationView | null;       // null while loading
  policy: PolicyCommitment | null;    // null while loading or no policy yet
  priceBasis: PriceBasis | null;      // null while loading; only populated after a ruling
  error: string | null;               // last fetch error message; null on success
  refetch: () => void;                // imperative refetch (e.g. from action panel after a write)
}

export function useNegotiation(
  reqId: bigint,
  events: readonly CoverageEvent[],
): UseNegotiationResult {
  const [view, setView] = useState<NegotiationView | null>(null);
  const [policy, setPolicy] = useState<PolicyCommitment | null>(null);
  const [priceBasis, setPriceBasis] = useState<PriceBasis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Incrementing counter drives imperative refetch without bypassing the
  // useEffect dependency list — each bump causes the effect to re-run.
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Track the reqId seen on the *previous* effect run so we can clear state
  // when reqId changes (different negotiation = show nothing until loaded).
  const prevReqIdRef = useRef<bigint | null>(null);

  useEffect(() => {
    // Clear stale data when switching to a different negotiation.
    if (prevReqIdRef.current !== reqId) {
      setView(null);
      setPolicy(null);
      setPriceBasis(null);
      prevReqIdRef.current = reqId;
    }

    let cancelled = false;

    (async () => {
      try {
        const v = await client.negotiation.getNegotiationView(reqId);
        const p = await client.negotiation.policyOf(reqId);
        const pb =
          v.ruled || v.terminal
            ? await client.negotiation.priceBasisOf(reqId)
            : null;
        if (!cancelled) {
          setView(v);
          setPolicy(p);
          setPriceBasis(pb);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          // Keep last-good view/policy/priceBasis so the UI doesn't flash
          // empty on a transient network blip (SPEC-0003 §2.3 R13).
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  // refetchTrigger is intentionally included so the imperative refetch()
  // call re-runs this same effect path.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqId, events, refetchTrigger]);

  const refetch = useCallback(() => {
    setRefetchTrigger((n) => n + 1);
  }, []);

  return { view, policy, priceBasis, error, refetch };
}
