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
  CoverageEvent,
  CoverageEventListener,
  Negotiation,
  NegotiationView,
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
  /** Opaque 0x-bytes32 RxNorm/NDC drug reference. */
  readonly drugRef: string;
  /** The provider's billed / requested amount. */
  readonly requestedAmount: bigint;
  /** keccak256 of the de-identified justification (commit the hash only — R3/R4). */
  readonly justificationHash: string;
  /** Opaque 0x-bytes32 ref to the public-evidence doc (use ZERO_HASH if none). */
  readonly evidenceUri: string;
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

  /** Insurer attaches its governing policy (hash + ref) → `Ready` (R5). */
  insurerEngage(reqId: bigint, policyHash: string, policyUri: string): Promise<void>;

  /** Fire the necessity arbiter from `Ready` → `UnderReview` (payable, R6/R9). */
  requestAdjudication(reqId: bigint): Promise<void>;

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

  // --- Reads (mirror the contract's views) ---

  /** Full on-chain record for a contract. */
  getNegotiation(reqId: bigint): Promise<Negotiation>;

  /** UI projection of a contract (state, flags, names). */
  getNegotiationView(reqId: bigint): Promise<NegotiationView>;

  /** Current state of a contract. */
  stateOf(reqId: bigint): Promise<State>;

  /** The deterministic covered amount (0 unless approved+computed — R6a). */
  coveredAmountOf(reqId: bigint): Promise<bigint>;

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
   */
  getEvents(filter?: EventFilter): Promise<CoverageEvent[]>;

  /**
   * Subscribe to negotiation events. Returns an unsubscribe handle. The listener
   * fires for every emitted event in both backends.
   */
  subscribe(listener: CoverageEventListener): Unsubscribe;

  /** Release any underlying resources (real backend: detaches log listeners). */
  close(): Promise<void>;
}
