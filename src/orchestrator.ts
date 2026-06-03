/**
 * Orchestrator (SPEC-0001 §4, revised 2026-05-27 — AI necessity-arbiter model):
 * drives a full coverage-exception negotiation between a provider and an insurer
 * {@link PartyAgent} over the shared client, watching events to assemble a
 * transcript. It submits txs and watches events — the necessity ruling is
 * contract-native (fired by the contract on adjudication).
 *
 * The same script runs in either wallet mode (R14): in simulated mode the mocked
 * arbiter resolves the request; in real mode the Somnia platform calls back. The
 * orchestrator just waits for the contract to leave `UnderReview`.
 *
 * Flow: provider files the request → insurer engages (attaches policy) →
 * requestAdjudication → await ruling → on Approved (or, by config, after handling
 * a need_more_evidence retry) both parties accept → settle. Deny stops at Denied;
 * need_more_evidence optionally submits evidence and re-fires; policy_invalid ends
 * at PolicyInvalidated; an appeal at the round cap ends at Deadlocked.
 */
import type { PartyAgent } from "./agents/party-agent.js";
import type { CoverageNegotiationClient, PriceBasis } from "./contract/types.js";
import {
  type CoverageEvent,
  Decision,
  DECISION_NAMES,
  PayerLine,
  State,
  STATE_NAMES,
  type Unsubscribe,
} from "./types/coverage.types.js";

/** What to do once a ruling lands. */
export type PostRulingAction =
  | "accept-and-settle" // on Approved/Denied: both accept, then settle
  | "appeal" // appeal with new evidence (re-fire, or deadlock at the cap)
  | "submit-evidence" // from EvidenceRequested: provider submits more evidence
  | "stop"; // leave the request in its post-ruling state

/** A negotiation to run end-to-end. */
export interface NegotiationScript {
  readonly drug: string;
  /** De-identified justification text; only its hash is committed (R3/R4). */
  readonly justification: string;
  /** The insurer's governing policy text; only its hash + ref are committed (R5). */
  readonly policyText: string;
  /** Optional initial public-evidence text the provider cites. */
  readonly evidenceRef?: string;
  /** The provider's billed / requested amount. */
  readonly requestedAmount: bigint;
  /** Dispensed units (NDC-pinned) — DRIVES the deterministic cap; must be > 0 (R2/R6a). */
  readonly quantity: bigint;
  /** Optional clinical-utilization context (necessity reasoning, NOT price) (R2). */
  readonly daysSupply?: bigint;
  /** Payer line governing the appeal ladder (SPEC-0004 R13). */
  readonly payerLine: PayerLine;
  /**
   * What to do once the first ruling lands. Default: `accept-and-settle` on a
   * ruled state, `submit-evidence` on EvidenceRequested, else `stop`.
   */
  readonly onRuling?: PostRulingAction;
  /**
   * If the ruling after `submit-evidence` is Approved/Denied, this follow-up
   * action runs (e.g. `accept-and-settle`, or `appeal` to drive to Deadlocked).
   * Default: `accept-and-settle`.
   */
  readonly afterEvidence?: PostRulingAction;
  /** How long to wait for each ruling callback before giving up (ms). Default 8000. */
  readonly rulingTimeoutMs?: number;
}

/** The outcome of {@link runNegotiation}. */
export interface NegotiationTranscript {
  readonly reqId: bigint;
  readonly finalState: State;
  readonly finalStateName: string;
  /** The latest agent decision (from the last `Ruled` event), if any. */
  readonly decision?: Decision;
  /** Human-readable name of {@link decision} (the `approve|deny|…` vocabulary). */
  readonly decisionName?: string;
  /** The deterministic covered amount on the final state (R6a). */
  readonly coveredAmount: bigint;
  /**
   * The deterministic price-basis breakdown (requested, quantity, Cost Plus cap
   * total, NADAC floor total, covered) behind the covered amount (R6a/R10).
   */
  readonly priceBasis: PriceBasis;
  /** The policy clause the arbiter relied on, if a ruling landed (R6). */
  readonly clauseRef?: string;
  /** The final adjudication round count (R6c). */
  readonly round: bigint;
  /** Every event observed during the run, in arrival order. */
  readonly events: readonly CoverageEvent[];
}

/**
 * Run the provider→insurer loop: provider files the request, the insurer engages
 * (attaching its policy → `Ready`), the provider requests adjudication (fires the
 * arbiter → `UnderReview`), the orchestrator awaits the ruling, and then performs
 * the configured post-ruling action — by default both parties accept and the
 * provider settles.
 */
export async function runNegotiation(
  negotiation: CoverageNegotiationClient,
  provider: PartyAgent,
  insurer: PartyAgent,
  script: NegotiationScript,
): Promise<NegotiationTranscript> {
  const events: CoverageEvent[] = [];
  const unsubscribe: Unsubscribe = negotiation.subscribe((e) => events.push(e));
  const timeout = script.rulingTimeoutMs ?? 8000;

  try {
    const reqId = await provider.fileRequest({
      insurerId: insurer.partyId,
      insurerAddr: insurer.address,
      payerLine: script.payerLine,
      drug: script.drug,
      justification: script.justification,
      requestedAmount: script.requestedAmount,
      quantity: script.quantity,
      ...(script.daysSupply !== undefined ? { daysSupply: script.daysSupply } : {}),
      ...(script.evidenceRef !== undefined ? { evidence: script.evidenceRef } : {}),
    });

    await insurer.engage(reqId, script.policyText); // attach policy -> Ready (R5)
    await provider.requestAdjudication(reqId); // fire the arbiter -> UnderReview (R6)
    await waitForRuling(negotiation, reqId, timeout);

    // First ruling handling.
    let state = await negotiation.stateOf(reqId);
    const firstAction =
      script.onRuling ??
      (state === State.EvidenceRequested ? "submit-evidence" : "accept-and-settle");
    await applyAction(negotiation, provider, insurer, reqId, state, firstAction, timeout);

    // If we just submitted evidence, a fresh ruling landed — run the follow-up.
    if (firstAction === "submit-evidence") {
      state = await negotiation.stateOf(reqId);
      const follow = script.afterEvidence ?? "accept-and-settle";
      await applyAction(negotiation, provider, insurer, reqId, state, follow, timeout);
    }

    return buildTranscript(negotiation, reqId, events);
  } finally {
    unsubscribe();
  }
}

/** Perform a single post-ruling action against the current state. */
async function applyAction(
  negotiation: CoverageNegotiationClient,
  provider: PartyAgent,
  insurer: PartyAgent,
  reqId: bigint,
  state: State,
  action: PostRulingAction,
  timeout: number,
): Promise<void> {
  const ruled = state === State.Approved || state === State.Denied;

  if (action === "accept-and-settle") {
    if (!ruled) return; // nothing to accept (e.g. PolicyInvalidated / EvidenceRequested)
    await provider.accept(reqId);
    await insurer.accept(reqId);
    await provider.settle(reqId);
    return;
  }

  if (action === "appeal") {
    if (!ruled) return;
    await provider.appeal(reqId);
    // An appeal either re-fires the arbiter (→ UnderReview) or deadlocks at the cap.
    if ((await negotiation.stateOf(reqId)) === State.UnderReview) {
      await waitForRuling(negotiation, reqId, timeout);
    }
    return;
  }

  if (action === "submit-evidence") {
    if (state !== State.EvidenceRequested) return;
    await provider.submitEvidence(reqId);
    await waitForRuling(negotiation, reqId, timeout);
    return;
  }
  // "stop": leave as-is.
}

/** Poll until the contract leaves `UnderReview` (the ruling landed) or time out. */
async function waitForRuling(
  negotiation: CoverageNegotiationClient,
  reqId: bigint,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await negotiation.stateOf(reqId)) !== State.UnderReview) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function buildTranscript(
  negotiation: CoverageNegotiationClient,
  reqId: bigint,
  events: readonly CoverageEvent[],
): Promise<NegotiationTranscript> {
  const n = await negotiation.getNegotiation(reqId);
  const priceBasis = await negotiation.priceBasisOf(reqId);
  const lastRuled = lastRuledEvent(events);
  const lastRationale = lastRulingRationaleEvent(events);
  const decision = lastRuled?.decision;
  // clauseRef comes from the RulingRationale event (committed by the keeper post-ruling,
  // SPEC-0006 R24–R26) rather than from Ruled (which is now a 4-arg event with no clauseRef).
  const clauseRef = lastRationale?.clauseReference;
  return {
    reqId,
    finalState: n.state,
    finalStateName: STATE_NAMES[n.state],
    ...(decision !== undefined ? { decision, decisionName: DECISION_NAMES[decision] } : {}),
    coveredAmount: n.coveredAmount,
    priceBasis,
    ...(clauseRef !== undefined ? { clauseRef } : {}),
    round: n.round,
    events: [...events],
  };
}

function lastRuledEvent(
  events: readonly CoverageEvent[],
): Extract<CoverageEvent, { name: "Ruled" }> | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e && e.name === "Ruled") return e;
  }
  return undefined;
}

function lastRulingRationaleEvent(
  events: readonly CoverageEvent[],
): Extract<CoverageEvent, { name: "RulingRationale" }> | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e && e.name === "RulingRationale") return e;
  }
  return undefined;
}
