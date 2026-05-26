/**
 * Orchestrator (SPEC-0001 §4): drives a full coverage-exception negotiation
 * between a provider and a payer {@link PartyAgent} over the shared client,
 * watching events to assemble a transcript. It submits txs and watches events —
 * the ruling is contract-native (fired by the contract on dispute).
 *
 * The same script runs in either wallet mode (R11): in simulated mode the mocked
 * agent resolves the dispute; in real mode the Somnia platform calls back. The
 * orchestrator just waits for the contract to leave `UnderReview`.
 */
import type { PartyAgent } from "./agents/party-agent.js";
import type { CoverageNegotiationClient } from "./contract/types.js";
import {
  type CoverageEvent,
  State,
  STATE_NAMES,
  type Unsubscribe,
} from "./types/coverage.types.js";

/** A negotiation to run end-to-end. */
export interface NegotiationScript {
  readonly drug: string;
  readonly note: string;
  readonly priceFloor: bigint;
  readonly priceCeil: bigint;
  /** The provider's proposed amount. */
  readonly providerAmount: bigint;
  /** The payer's proposed amount. */
  readonly payerAmount: bigint;
  /** Who raises the dispute once both positions are in. Default: provider. */
  readonly disputeBy?: "provider" | "payer";
  /** If the ruling approves, settle at this amount (within band). Omit to stop at Approved. */
  readonly settleAmount?: bigint;
  /** How long to wait for the ruling callback before giving up (ms). Default 8000. */
  readonly rulingTimeoutMs?: number;
}

/** The outcome of {@link runNegotiation}. */
export interface NegotiationTranscript {
  readonly reqId: bigint;
  readonly finalState: State;
  readonly finalStateName: string;
  /** The agent verdict from the latest `Ruled` event, if any. */
  readonly verdict?: string;
  /** Every event observed during the run, in arrival order. */
  readonly events: readonly CoverageEvent[];
}

/**
 * Run the provider→payer loop: provider opens the contract and submits its
 * position, the payer submits its position (→ `Ready`), the chosen party
 * disputes (fires the agent → `UnderReview`), the orchestrator awaits the ruling,
 * and — if `approve`d and `settleAmount` is given — the provider settles.
 */
export async function runNegotiation(
  negotiation: CoverageNegotiationClient,
  provider: PartyAgent,
  payer: PartyAgent,
  script: NegotiationScript,
): Promise<NegotiationTranscript> {
  const events: CoverageEvent[] = [];
  const unsubscribe: Unsubscribe = negotiation.subscribe((e) => events.push(e));

  try {
    const reqId = await provider.openContract({
      counterpartyId: payer.partyId,
      drug: script.drug,
      note: script.note,
      priceFloor: script.priceFloor,
      priceCeil: script.priceCeil,
    });

    await provider.proposePosition(reqId, script.providerAmount);
    await payer.proposePosition(reqId, script.payerAmount); // both in -> Ready

    const disputer = script.disputeBy === "payer" ? payer : provider;
    await disputer.dispute(reqId); // fires the contract-native agent -> UnderReview

    await waitForRuling(negotiation, reqId, script.rulingTimeoutMs ?? 8000);

    const verdict = lastVerdict(events);
    const afterRuling = await negotiation.stateOf(reqId);
    if (afterRuling === State.Approved && script.settleAmount !== undefined) {
      await provider.settle(reqId, script.settleAmount);
    }

    const finalState = await negotiation.stateOf(reqId);
    return {
      reqId,
      finalState,
      finalStateName: STATE_NAMES[finalState],
      ...(verdict !== undefined ? { verdict } : {}),
      events: [...events],
    };
  } finally {
    unsubscribe();
  }
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

function lastVerdict(events: readonly CoverageEvent[]): string | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e && e.name === "Ruled") return e.verdict;
  }
  return undefined;
}
