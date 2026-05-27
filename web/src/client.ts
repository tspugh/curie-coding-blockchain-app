/**
 * Single shared {@link CurieClient} for the whole UI, in simulated mode.
 *
 * The mocked necessity arbiter's ruling is fixed at client construction, but the
 * demo needs the UI to pick a {@link Decision} (and a benchmark cap) per
 * adjudication. We bridge that WITHOUT widening the shared interface: the client
 * is built with `decision`/`benchmarkCap` FUNCTIONS that read module-level
 * mutables, and the detail view flips those just before `requestAdjudication`.
 * ~1.2s later the subscription delivers the `Ruled` event (mimicking the
 * contract-native callback — R6/R6a/R6b).
 *
 * The clause + public-standard refs the arbiter cites are fixed, meaningful
 * hashes set at construction; they surface in the `Ruled` / `PolicyFlagged` /
 * `PolicyInvalidated` events and the ruling panel.
 */
import {
  createClient,
  Decision,
  hashContent,
  type CurieClient,
} from "@lib";

/** Decision the next fired adjudication will resolve to (read by the arbiter fn). */
let nextDecision: Decision = Decision.Approve;

/**
 * Public benchmark cap fed into the deterministic `min(requested, cap)` on
 * approve (R6a). `null` means "use the request's own requestedAmount" so the
 * covered amount equals the request unless the demo overrides it to show min().
 */
let nextBenchmarkCap: bigint | null = null;

/** Clause ref the arbiter cites (R6) — meaningful, opaque bytes32. */
export const CLAUSE_REF = hashContent("clause:part-d-step-therapy-exception");

/** Public standard ref cited when a clause is flagged non-compliant (R6b). */
export const STANDARD_REF = hashContent("standard:fda-label-indication-psoriasis");

/** Set the {@link Decision} the simulated arbiter returns for the next adjudication. */
export function setNextDecision(d: Decision): void {
  nextDecision = d;
}

/** The current pending decision (for showing the selected value in the UI). */
export function getNextDecision(): Decision {
  return nextDecision;
}

/** Set the public benchmark cap for the next approve ruling (R6a). */
export function setNextBenchmarkCap(c: bigint): void {
  nextBenchmarkCap = c;
}

/** The current pending benchmark cap, or `null` to default to requestedAmount. */
export function getNextBenchmarkCap(): bigint | null {
  return nextBenchmarkCap;
}

/**
 * The one client the UI holds. Simulated mode is passed EXPLICITLY so the
 * browser never reads `process.env`. `autoResolveMs` mimics agent latency so
 * the timeline visibly transitions Ready → UnderReview → Ruled.
 */
export const client: CurieClient = createClient({
  wallet: { mode: "simulated" },
  contract: {
    simulated: {
      autoResolveMs: 1200,
      decision: () => nextDecision,
      // Deterministic covered amount = min(requested, cap) — never AI-chosen
      // (R6a). Default the cap to the request's own amount so covered == requested
      // unless the demo sets a lower cap to demonstrate min().
      benchmarkCap: (n) => nextBenchmarkCap ?? n.requestedAmount,
      clauseRef: CLAUSE_REF,
      standardRef: STANDARD_REF,
    },
  },
});

// Acceptable only because this is the simulated, no-funds demo wallet: expose
// the client for debugging and agent-browser tests.
(window as unknown as { __curie: CurieClient }).__curie = client;
