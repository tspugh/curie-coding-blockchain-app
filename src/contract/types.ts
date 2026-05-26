/**
 * The ONE interface every backend implements (SPEC-0001 R11). The simulated
 * and real backends are behind this identical surface, so the calling code path
 * never changes with the wallet mode.
 *
 * Method/argument names mirror `CoverageNegotiation.sol` (SPEC-0001 §3). The
 * `byPartyId` / `partyId` arguments default to the active profile's party id
 * when the client is bound to a profile, but are accepted explicitly here so
 * the backend contract is self-contained.
 */
import type {
  CoverageEventListener,
  Negotiation,
  NegotiationView,
  State,
  Unsubscribe,
  WalletMode,
} from "../types/coverage.types.js";

/** Inputs for {@link CoverageNegotiationClient.createContract}. */
export interface CreateContractParams {
  readonly initiatorId: bigint;
  readonly destinationId: bigint;
  /** Opaque 0x-bytes32 reference to the drug under negotiation. */
  readonly drugRef: string;
  /** keccak256 of the off-chain note (commit the hash only — R3/R4). */
  readonly noteHash: string;
  readonly priceFloor: bigint;
  readonly priceCeil: bigint;
  /** Opaque 0x-bytes32 ref to off-chain evidence (use ZERO_HASH if none). */
  readonly evidenceUri: string;
}

/** Inputs for {@link CoverageNegotiationClient.submitPosition}. */
export interface SubmitPositionParams {
  readonly reqId: bigint;
  readonly partyId: bigint;
  readonly proposedAmount: bigint;
  /** Optional new note hash to commit alongside the position (or ZERO_HASH). */
  readonly contentHash: string;
  readonly uri: string;
}

/**
 * Backend-agnostic coverage-negotiation client. Both backends expose exactly
 * this. All writes mirror the contract's lifecycle functions; reads mirror its
 * views; `subscribe` streams the contract's events (R16).
 */
export interface CoverageNegotiationClient {
  /** The wallet mode this client is operating in. */
  readonly mode: WalletMode;

  // --- Writes (mirror the contract's lifecycle functions) ---

  /** Create a contract in `Open`; returns the new `reqId`. */
  createContract(params: CreateContractParams): Promise<bigint>;

  /** Attach an off-chain content commitment (hash + opaque ref). */
  attachContent(reqId: bigint, contentHash: string, uri: string): Promise<void>;

  /** Submit a party's position; both parties in → `Ready` (R5). */
  submitPosition(params: SubmitPositionParams): Promise<void>;

  /** Raise a dispute (only in `Ready`); fires the agent → `UnderReview` (R6). */
  submitDispute(reqId: bigint, byPartyId: bigint): Promise<void>;

  /** Post off-chain feedback; no state change (R7). */
  postFeedback(reqId: bigint, msgHash: string, uri: string): Promise<void>;

  /** Submit evidence from `EvidenceRequested`; re-fires the agent. */
  submitEvidence(reqId: bigint, evidenceUri: string): Promise<void>;

  /** Appeal a denial from `Denied`; re-fires the agent. */
  appeal(reqId: bigint, evidenceUri: string): Promise<void>;

  /** Settle an approved contract (event marker, within band — R8). */
  settle(reqId: bigint, agreedAmount: bigint): Promise<void>;

  /** Withdraw from any pre-`Settled` state. */
  withdraw(reqId: bigint): Promise<void>;

  // --- Reads (mirror the contract's views) ---

  /** Full on-chain record for a contract. */
  getNegotiation(reqId: bigint): Promise<Negotiation>;

  /** UI projection of a contract (state, flags, names). */
  getNegotiationView(reqId: bigint): Promise<NegotiationView>;

  /** Current state of a contract. */
  stateOf(reqId: bigint): Promise<State>;

  /** Number of contracts created so far. */
  count(): Promise<bigint>;

  // --- Events (R16) ---

  /**
   * Subscribe to negotiation events. Returns an unsubscribe handle. The
   * listener fires for every emitted event in both backends.
   */
  subscribe(listener: CoverageEventListener): Unsubscribe;

  /** Release any underlying resources (real backend: detaches log listeners). */
  close(): Promise<void>;
}
