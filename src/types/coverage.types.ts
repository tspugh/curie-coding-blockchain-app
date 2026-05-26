/**
 * TypeScript mirror of `contracts/contracts/CoverageNegotiation.sol` (SPEC-0001 §3).
 *
 * These types are the single shared vocabulary for the whole library: the
 * simulated backend, the real (ethers) backend, the client interface, and the
 * UI all speak in terms of the shapes declared here. They mirror the contract's
 * state enum, the `Negotiation` / `Position` structs, its verdict vocabulary,
 * and its events EXACTLY so that switching backends never changes the data the
 * caller sees.
 *
 * HARD INVARIANT (R4): nothing here carries PHI or raw content. Only hashes
 * (`bytes32` as 0x-hex strings), opaque refs, amounts (`bigint`), state, ids,
 * and timestamps cross this boundary — identical to the on-chain record.
 */

/**
 * Negotiation lifecycle state. Numeric values match the Solidity `enum State`
 * declaration order EXACTLY (Open = 0 … Withdrawn = 8) so the same integer the
 * contract returns maps to the same member here.
 */
export enum State {
  Open = 0,
  Ready = 1,
  UnderReview = 2,
  EvidenceRequested = 3,
  Approved = 4,
  Denied = 5,
  Appealed = 6,
  Settled = 7,
  Withdrawn = 8,
}

/** Human-readable name for a {@link State} value (for the UI / logs). */
export const STATE_NAMES: Readonly<Record<State, string>> = {
  [State.Open]: "Open",
  [State.Ready]: "Ready",
  [State.UnderReview]: "UnderReview",
  [State.EvidenceRequested]: "EvidenceRequested",
  [State.Approved]: "Approved",
  [State.Denied]: "Denied",
  [State.Appealed]: "Appealed",
  [State.Settled]: "Settled",
  [State.Withdrawn]: "Withdrawn",
};

/**
 * The agent's verdict vocabulary (R6). These are the only three strings the
 * contract's `handleResponse` decodes into routed states; any other value is
 * treated as `need_more_evidence` (retriable).
 */
export type Verdict = "approve" | "deny" | "need_more_evidence";

/** A single party's negotiating position — mirrors `struct Position`. */
export interface Position {
  /** Proposed amount; meaningful only when `submitted` is true. */
  readonly proposedAmount: bigint;
  /** Whether this party has submitted their position. */
  readonly submitted: boolean;
}

/**
 * Full per-contract record — mirrors `struct Negotiation` field-for-field.
 * `bytes32` values are represented as 0x-prefixed 32-byte hex strings.
 */
export interface Negotiation {
  /** Profile/agent id of the initiator. */
  readonly initiatorId: bigint;
  /** Profile/agent id of the destination party. */
  readonly destinationId: bigint;
  /** Opaque reference to the drug under negotiation. */
  readonly drugRef: string;
  /** keccak256 of the off-chain patient note. */
  readonly noteHash: string;
  /** Benchmark band lower bound. */
  readonly priceFloor: bigint;
  /** Benchmark band upper bound. */
  readonly priceCeil: bigint;
  /** Opaque ref to the latest off-chain evidence. */
  readonly evidenceUri: string;
  /** The initiator's position. */
  readonly initiatorPosition: Position;
  /** The destination party's position. */
  readonly destinationPosition: Position;
  /** Amount recorded at settlement (within band); 0 until settled. */
  readonly agreedAmount: bigint;
  /** Current lifecycle state. */
  readonly state: State;
  /** In-flight Somnia agent request id (0 if none). */
  readonly pendingRequestId: bigint;
  /** Block/wall-clock timestamp (seconds) the contract was created. */
  readonly createdAt: bigint;
  /** After this timestamp a stuck ruling may time out (0 if no request). */
  readonly rulingDeadline: bigint;
  /** Whether the record exists (always true for a returned view). */
  readonly exists: boolean;
}

/**
 * UI-friendly projection of a {@link Negotiation}: the raw record plus the
 * contract id and decoded helpers the views need. This is what the UI table /
 * detail pages render.
 */
export interface NegotiationView {
  /** On-chain contract id (`reqId`). */
  readonly reqId: bigint;
  /** The underlying record. */
  readonly negotiation: Negotiation;
  /** Current state. */
  readonly state: State;
  /** Human-readable state name. */
  readonly stateName: string;
  /** Whether both parties have submitted a position (dispute is possible). */
  readonly bothPositionsSubmitted: boolean;
  /** Whether a dispute may currently be raised (state === Ready). */
  readonly disputable: boolean;
  /** Whether the contract has reached a terminal state (Settled/Withdrawn). */
  readonly terminal: boolean;
}

// ---------------------------------------------------------------------------
// Event types — mirror the contract's `event` declarations (SPEC-0001 §3).
// Each carries only ids/hashes/refs/amounts/state, never raw content.
// ---------------------------------------------------------------------------

/** Discriminator for the union of negotiation events. */
export type CoverageEventName =
  | "ContractCreated"
  | "ContentCommitted"
  | "PositionSubmitted"
  | "ContractReady"
  | "DisputeSubmitted"
  | "RulingRequested"
  | "Ruled"
  | "RulingTimedOut"
  | "FeedbackPosted"
  | "EvidenceSubmitted"
  | "Appealed"
  | "Settled"
  | "Withdrawn";

interface BaseEvent {
  /** Contract id the event pertains to. */
  readonly reqId: bigint;
  /** Optional transaction hash (present for real-chain events). */
  readonly txHash?: string;
  /** Optional block number (present for real-chain events). */
  readonly blockNumber?: number;
}

export interface ContractCreatedEvent extends BaseEvent {
  readonly name: "ContractCreated";
  readonly initiatorId: bigint;
  readonly destinationId: bigint;
  readonly drugRef: string;
  readonly priceFloor: bigint;
  readonly priceCeil: bigint;
}

export interface ContentCommittedEvent extends BaseEvent {
  readonly name: "ContentCommitted";
  readonly contentHash: string;
  readonly uri: string;
}

export interface PositionSubmittedEvent extends BaseEvent {
  readonly name: "PositionSubmitted";
  readonly partyId: bigint;
  readonly proposedAmount: bigint;
}

export interface ContractReadyEvent extends BaseEvent {
  readonly name: "ContractReady";
}

export interface DisputeSubmittedEvent extends BaseEvent {
  readonly name: "DisputeSubmitted";
  readonly byPartyId: bigint;
}

export interface RulingRequestedEvent extends BaseEvent {
  readonly name: "RulingRequested";
  readonly requestId: bigint;
  readonly fee: bigint;
}

export interface RuledEvent extends BaseEvent {
  readonly name: "Ruled";
  readonly requestId: bigint;
  /** Raw verdict string emitted by the contract ("timeout" on failure). */
  readonly verdict: string;
  readonly receiptId: bigint;
}

export interface RulingTimedOutEvent extends BaseEvent {
  readonly name: "RulingTimedOut";
  readonly requestId: bigint;
}

export interface FeedbackPostedEvent extends BaseEvent {
  readonly name: "FeedbackPosted";
  readonly msgHash: string;
  readonly uri: string;
}

export interface EvidenceSubmittedEvent extends BaseEvent {
  readonly name: "EvidenceSubmitted";
  readonly evidenceUri: string;
}

export interface AppealedEvent extends BaseEvent {
  readonly name: "Appealed";
  readonly evidenceUri: string;
}

export interface SettledEvent extends BaseEvent {
  readonly name: "Settled";
  readonly agreedAmount: bigint;
}

export interface WithdrawnEvent extends BaseEvent {
  readonly name: "Withdrawn";
}

/** Discriminated union of every negotiation event the contract can emit. */
export type CoverageEvent =
  | ContractCreatedEvent
  | ContentCommittedEvent
  | PositionSubmittedEvent
  | ContractReadyEvent
  | DisputeSubmittedEvent
  | RulingRequestedEvent
  | RuledEvent
  | RulingTimedOutEvent
  | FeedbackPostedEvent
  | EvidenceSubmittedEvent
  | AppealedEvent
  | SettledEvent
  | WithdrawnEvent;

/** Listener invoked for every emitted {@link CoverageEvent}. */
export type CoverageEventListener = (event: CoverageEvent) => void;

/** Unsubscribe handle returned by event subscriptions. */
export type Unsubscribe = () => void;

/**
 * Wallet operating mode (R11). The same calling code runs in either mode; only
 * the signer/provider differs.
 */
export type WalletMode = "simulated" | "real";
