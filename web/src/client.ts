/**
 * Single shared {@link CurieClient} for the whole UI, in simulated mode.
 *
 * The mocked agent's verdict is fixed at client construction, but the demo
 * needs the UI to pick a verdict per dispute. We bridge that WITHOUT widening
 * the shared interface: the client is built with a `verdict` function that
 * reads a module-level mutable variable, and the detail view flips that
 * variable via {@link setNextVerdict} just before raising a dispute. ~1.2s
 * later the subscription delivers the `Ruled` event (contract-native callback).
 */
import { createClient, type CurieClient, type Verdict } from "@lib";

/** Verdict the next fired dispute will resolve to (read by the agent fn). */
let nextVerdict: Verdict = "approve";

/** Set the verdict the simulated agent will return for the next dispute. */
export function setNextVerdict(v: Verdict): void {
  nextVerdict = v;
}

/** The current pending verdict (for showing the selected value in the UI). */
export function getNextVerdict(): Verdict {
  return nextVerdict;
}

/**
 * The one client the UI holds. Simulated mode is passed EXPLICITLY so the
 * browser never reads `process.env`. `autoResolveMs` mimics agent latency so
 * the timeline visibly transitions Open → … → Ruled.
 */
export const client: CurieClient = createClient({
  wallet: { mode: "simulated" },
  contract: {
    simulated: {
      autoResolveMs: 1200,
      verdict: () => nextVerdict,
    },
  },
});

// Acceptable only because this is the simulated, no-funds demo wallet: expose
// the client for debugging and agent-browser tests.
(window as unknown as { __curie: CurieClient }).__curie = client;
