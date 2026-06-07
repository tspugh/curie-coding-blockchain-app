/**
 * The ONE interface every backend implements (SPEC-0001 R11). The simulated and
 * real backends sit behind this identical surface, so the calling code path
 * never changes with the wallet mode (R14).
 *
 * Method/argument names mirror `CoverageNegotiation.sol` (SPEC-0001 §3, revised
 * 2026-05-27 — AI necessity-arbiter model). The `partyId` arguments identify the
 * acting party at the app level; under the single-shared-wallet model (R12) the
 * trusted distinction between provider and insurer IS the `partyId`.
 *
 * HARD INVARIANT (R4): every argument crossing this boundary is a hash, opaque
 * ref, amount, id, address, or decision code — never raw content / PHI.
 */
import type {
  Attestation,
  CoverageEvent,
  CoverageEventListener,
  Negotiation,
  NegotiationView,
  PayerLine,
  State,
  Unsubscribe,
  WalletMode,
} from "../types/coverage.types.js";

/**
 * Inputs for {@link CoverageNegotiationClient.createContract} — mirror the
 * Solidity `createContract` parameters in order (R2). The caller (provider)
 * supplies both wallet addresses; under the single-wallet model they are equal
 * (R12), and a self-claim where provider == insurer is permitted (R13).
 */
export interface CreateContractParams {
  /** App-level party id of the provider (initiator). */
  readonly providerId: bigint;
  /** App-level party id of the insurer (destination). */
  readonly insurerId: bigint;
  /** Provider wallet address (auth — R11); msg.sender must equal this on-chain. */
  readonly providerAddr: string;
  /** Insurer wallet address (auth — R11). */
  readonly insurerAddr: string;
  /**
   * Payer line governing the appeal ladder (SPEC-0004 R13). Determines the
   * stage names + window/threshold table the UI renders against.
   */
  readonly payerLine: PayerLine;
  /** Opaque 0x-bytes32 RxNorm/NDC drug reference. */
  readonly drugRef: string;
  /** The provider's billed / requested amount. */
  readonly requestedAmount: bigint;
  /** Dispensed units (NDC-pinned) — DRIVES the deterministic cap; must be > 0 (R2/R6a). */
  readonly quantity: bigint;
  /** Optional clinical-utilization context (necessity reasoning, NOT price) (R2). */
  readonly daysSupply: bigint;
  /** keccak256 of the de-identified justification (commit the hash only — R3/R4). */
  readonly justificationHash: string;
  /** Opaque 0x-bytes32 ref to the public-evidence doc (use ZERO_HASH if none). */
  readonly evidenceUri: string;
  /**
   * Per-negotiation public evidence URL embedded in the `inferString` prompt (SPEC-0006 R14).
   * Must be a non-empty string — the contract reverts with `"evidence: url required"` if empty.
   */
  readonly agentEvidenceUrl: string;
  /**
   * Per-negotiation prompt hint embedded in the `inferString` prompt (SPEC-0006 R15).
   * Must be a non-empty string — the contract reverts with `"evidence: hint required"` if empty.
   */
  readonly agentPromptHint: string;
}

/** Filter for {@link CoverageNegotiationClient.getEvents} (historical reconstruction). */
export interface EventFilter {
  /** Restrict to a single contract (the indexed `reqId` topic). */
  readonly reqId?: bigint;
  /** First block to scan (real backend). Defaults to 0 / genesis. */
  readonly fromBlock?: number;
  /** Last block to scan (real backend). Defaults to "latest". */
  readonly toBlock?: number;
}

/** The insurer's attached policy commitment (hash + opaque ref) — see `policyOf` (R5). */
export interface PolicyCommitment {
  /** keccak256 of the insurer's policy body. */
  readonly policyHash: string;
  /** Opaque ref to the public policy body. */
  readonly policyUri: string;
}

/**
 * The deterministic price-basis breakdown behind a covered amount — see
 * `priceBasisOf` (R6a/R10). All totals are per-unit price × quantity; the
 * covered amount is `min(requestedAmount, costPlusTotal)` on approve (NADAC is a
 * stored floor reference only, never the cap).
 */
export interface PriceBasis {
  /** The provider's billed / requested amount. */
  readonly requestedAmount: bigint;
  /** Dispensed units the totals are computed against. */
  readonly quantity: bigint;
  /** Mark Cuban Cost Plus cap total = costPlusUnitPrice × quantity (the cap basis). */
  readonly costPlusTotal: bigint;
  /** NADAC acquisition-cost floor total = nadacUnitPrice × quantity (reference only). */
  readonly nadacFloorTotal: bigint;
  /** Deterministic covered amount = min(requestedAmount, costPlusTotal) on approve; else 0. */
  readonly coveredAmount: bigint;
}

/**
 * Backend-agnostic coverage-negotiation client. Both backends expose exactly
 * this. Writes mirror the contract's lifecycle functions; reads mirror its
 * views; `subscribe` streams the contract's events (R16).
 */
export interface CoverageNegotiationClient {
  /** The wallet mode this client is operating in. */
  readonly mode: WalletMode;

  // --- Writes (mirror the contract's lifecycle functions) ---

  /** Provider files a coverage-exception request → `Open`; returns the new `reqId` (R2). */
  createContract(params: CreateContractParams): Promise<bigint>;

  /**
   * Insurer attaches its governing policy (hash + ref) and deposits escrow → `Ready` (R5).
   * A0008: `depositAmount` is the ETH value forwarded as escrow (msg.value). Must be >=
   * `requestedAmount`; any surplus is refunded. Defaults to `requestedAmount` (the exact
   * required escrow) on both the real and simulated backends when omitted, so old callers
   * that omit this argument continue to work and will escrow exactly the requested amount.
   */
  insurerEngage(reqId: bigint, policyHash: string, policyUri: string, depositAmount?: bigint): Promise<void>;

  /**
   * Fire the necessity arbiter from `Ready` → `UnderReview` (payable, R6/R9).
   *
   * A0012 / SPEC-0007 R5/R13: the provider may pass de-identified `attestations` for the
   * policy's patient-specific (attested) clauses. Omit (or pass `[]`) for a public-only
   * policy. With attestations, Approve requires EVERY attestation affirmative (R7) — a
   * false one downgrades to needs-more-info. Attestations carry NO PHI (closed
   * `{clauseId, attested, evidenceUriHash}` shape).
   */
  requestAdjudication(reqId: bigint, attestations?: Attestation[]): Promise<void>;

  /** Provider submits more public evidence from `EvidenceRequested`; re-fires the agent (R6c). */
  submitEvidence(reqId: bigint, evidenceUri: string): Promise<void>;

  /**
   * Appeal a ruling with NEW public evidence from `Approved`/`Denied`; re-fires
   * the agent (round++) until the round cap, then → `Deadlocked` (R6c).
   */
  appeal(reqId: bigint, partyId: bigint, evidenceUri: string, reasonHash: string): Promise<void>;

  /** Accept the current ruling for `partyId` (from `Approved`/`Denied`) (R6c). */
  accept(reqId: bigint, partyId: bigint): Promise<void>;

  /** Settle a mutually-accepted ruling → `Settled` (event marker, 50/50 split — R8). */
  settle(reqId: bigint): Promise<void>;

  /** Provider refuses the insurer's terms (from `Ready` onward) → `ProviderRefused` (R7). */
  refuse(reqId: bigint, reasonHash: string): Promise<void>;

  /** Withdraw from any pre-terminal state → `Withdrawn`. */
  withdraw(reqId: bigint): Promise<void>;

  /** Keeper timeout: route a stuck `UnderReview` past its deadline → `EvidenceRequested`. */
  onRulingTimeout(reqId: bigint): Promise<void>;

  /** Post off-chain feedback; no state change (R4 — only the hash + ref cross). */
  postFeedback(reqId: bigint, msgHash: string, uri: string): Promise<void>;

  /**
   * Keeper commits the receipt-sourced rationale for a finalized ruling
   * (SPEC-0006 R25/R26). Owner-only on-chain; emits `RulingRationale` with the
   * rationale text, policy-clause reference, and public-standard reference.
   * Called after `handleResponse` lands a ruling so the off-chain keeper can
   * transcribe the agent's chain-of-thought onto the record without PHI (R4).
   */
  commitRationale(reqId: bigint, rationale: string, clauseReference: string, standardReference: string): Promise<void>;

  // --- Reads (mirror the contract's views) ---

  /** Full on-chain record for a contract. */
  getNegotiation(reqId: bigint): Promise<Negotiation>;

  /** De-identified attestations recorded for a contract (A0012 / SPEC-0007 R13). */
  getAttestations(reqId: bigint): Promise<Attestation[]>;

  /** UI projection of a contract (state, flags, names). */
  getNegotiationView(reqId: bigint): Promise<NegotiationView>;

  /** Current state of a contract. */
  stateOf(reqId: bigint): Promise<State>;

  /** The deterministic covered amount (0 unless approved+computed — R6a). */
  coveredAmountOf(reqId: bigint): Promise<bigint>;

  /** The deterministic price-basis breakdown behind the covered amount (R6a/R10). */
  priceBasisOf(reqId: bigint): Promise<PriceBasis>;

  /** Current adjudication round count (R6c). */
  roundOf(reqId: bigint): Promise<bigint>;

  /** The insurer's attached policy commitment (R5). */
  policyOf(reqId: bigint): Promise<PolicyCommitment>;

  /** Number of contracts created so far. */
  count(): Promise<bigint>;

  // --- Events (R16) ---

  /**
   * Reconstruct the historical event timeline (R16/T10). The real backend reads
   * it from `eth_getLogs` (`queryFilter`); the simulated backend returns its
   * recorded in-memory log. Events are returned in chronological order and may
   * be narrowed by {@link EventFilter} (e.g. a single `reqId`).
   *
   * `onBatch`, when supplied, is invoked with each page-batch of events as it is
   * fetched — newest activity first — so a consumer can paint the most recent
   * events within ~1s instead of waiting for a full multi-minute log sweep to
   * resolve. Each batch is chronologically sorted within itself; the final
   * resolved array remains the complete chronological timeline.
   */
  getEvents(
    filter?: EventFilter,
    onBatch?: (batch: CoverageEvent[]) => void,
  ): Promise<CoverageEvent[]>;

  /**
   * Subscribe to negotiation events. Returns an unsubscribe handle. The listener
   * fires for every emitted event in both backends.
   */
  subscribe(listener: CoverageEventListener): Unsubscribe;

  /** Release any underlying resources (real backend: detaches log listeners). */
  close(): Promise<void>;
}
