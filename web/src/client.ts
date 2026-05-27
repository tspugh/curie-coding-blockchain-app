/**
 * Single shared {@link CurieClient} for the whole UI, in simulated mode.
 *
 * The mocked necessity arbiter's ruling is fixed at client construction, but the
 * demo needs the UI to pick a {@link Decision} (and the price refs) per
 * adjudication. We bridge that WITHOUT widening the shared interface: the client
 * is built with `decision`/`costPlusUnitPrice`/`nadacUnitPrice` FUNCTIONS that
 * read module-level mutables, and the detail view flips those just before
 * `requestAdjudication`. ~1.2s later the subscription delivers the `Ruled`
 * event (mimicking the contract-native callback — R6/R6a/R6b).
 *
 * Per the 2026-05-27 SPEC-0001 cap-resolution, the covered amount on approve is
 * `min(requested, costPlusUnitPrice × quantity)` — the Mark Cuban Cost Plus
 * PER-UNIT price drives the cap; NADAC is a recorded floor reference only. There
 * is no single `benchmarkCap` anymore (replaced here).
 *
 * The clause + public-standard refs the arbiter cites are fixed, meaningful
 * hashes set at construction; they surface in the `Ruled` / `PolicyFlagged` /
 * `PolicyInvalidated` events and the ruling / gotcha panels. They are tied to
 * the demo fixtures (clause PD-ADA-09 vs. the FDA HUMIRA label) so the R3 gotcha
 * panel can match them against `demo-data/`.
 */
import {
  createClient,
  Decision,
  hashContent,
  DEFAULT_PROFILES,
  type CurieClient,
  type Negotiation,
} from "@lib";

/** Decision the next fired adjudication will resolve to (read by the arbiter fn). */
let nextDecision: Decision = Decision.Approve;

/**
 * Mark Cuban Cost Plus PER-UNIT price fed into the deterministic
 * `min(requested, unit × quantity)` on approve (R6a). `null` means "let the
 * backend default it" (a per-unit price that makes the cap non-binding, i.e.
 * covered === requested) unless the demo overrides it to show the cap binding.
 */
let nextCostPlusUnitPrice: bigint | null = null;

/** NADAC PER-UNIT acquisition-cost floor reference (recorded, never the cap). */
let nextNadacUnitPrice: bigint | null = null;

/**
 * Clause ref the arbiter cites (R6). Tied to the demo's non-compliant clause
 * PD-ADA-09 so the R3 gotcha panel can match it to `demo-data/policy-noncompliant.md`.
 */
export const CLAUSE_REF = hashContent("clause:PD-ADA-09");

/**
 * Public standard ref cited when a clause is flagged non-compliant (R6b). Tied
 * to the FDA HUMIRA plaque-psoriasis label fixture
 * (`demo-data/fda-indication-adalimumab.json`).
 */
export const STANDARD_REF = hashContent(
  "standard:fda-label-indication:HUMIRA:plaque-psoriasis",
);

/** Set the {@link Decision} the simulated arbiter returns for the next adjudication. */
export function setNextDecision(d: Decision): void {
  nextDecision = d;
}

/** The current pending decision (for showing the selected value in the UI). */
export function getNextDecision(): Decision {
  return nextDecision;
}

/** Set the Mark Cuban Cost Plus per-unit price for the next approve ruling (R6a). */
export function setNextCostPlusUnitPrice(p: bigint): void {
  nextCostPlusUnitPrice = p;
}

/** The current pending Cost Plus per-unit price, or `null` to use the backend default. */
export function getNextCostPlusUnitPrice(): bigint | null {
  return nextCostPlusUnitPrice;
}

/** Set the NADAC per-unit floor reference for the next ruling (R6a/R10). */
export function setNextNadacUnitPrice(p: bigint): void {
  nextNadacUnitPrice = p;
}

/** The current pending NADAC per-unit floor reference, or `null` for the default. */
export function getNextNadacUnitPrice(): bigint | null {
  return nextNadacUnitPrice;
}

/**
 * The one client the UI holds. Simulated mode is passed EXPLICITLY so the
 * browser never reads `process.env`. `autoResolveMs` mimics agent latency so
 * the timeline visibly transitions Ready → UnderReview → Ruled.
 *
 * A third **Observer** profile (party 99) is registered for the R6 role/wallet-
 * gating demo: it can read everything but is not a party to any request, so
 * every gated action is hidden and an explicit non-party attempt is rejected.
 */
export const client: CurieClient = createClient({
  wallet: { mode: "simulated" },
  profiles: {
    profiles: [
      ...DEFAULT_PROFILES,
      { id: "observer", label: "Observer", partyId: 99n },
    ],
  },
  contract: {
    simulated: {
      autoResolveMs: 1200,
      decision: () => nextDecision,
      // Deterministic covered amount = min(requested, costPlusUnitPrice × quantity)
      // — never AI-chosen (R6a). When the demo hasn't set a price the backend
      // defaults the per-unit price so the cap is non-binding (covered == requested);
      // setting a lower per-unit price demonstrates the cap binding via min().
      costPlusUnitPrice: (n: Negotiation) =>
        nextCostPlusUnitPrice ??
        (n.quantity > 0n
          ? (n.requestedAmount + n.quantity - 1n) / n.quantity
          : n.requestedAmount),
      // NADAC per-unit acquisition-cost FLOOR reference (recorded; never the cap).
      nadacUnitPrice: () => nextNadacUnitPrice ?? 0n,
      clauseRef: CLAUSE_REF,
      standardRef: STANDARD_REF,
    },
  },
});

// Acceptable only because this is the simulated, no-funds demo wallet: expose
// the client for debugging and agent-browser tests.
(window as unknown as { __curie: CurieClient }).__curie = client;
