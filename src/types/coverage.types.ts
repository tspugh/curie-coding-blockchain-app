/**
 * TypeScript mirror of `contracts/contracts/CoverageNegotiation.sol` (SPEC-0001,
 * revised 2026-05-27 — AI necessity-arbiter model).
 *
 * These types are the single shared vocabulary for the whole library: the
 * simulated backend, the real (ethers) backend, the client interface, and the
 * UI all speak in terms of the shapes declared here. They mirror the contract's
 * `State` / `Decision` enums, the `Negotiation` struct, and its events EXACTLY,
 * so switching backends never changes the data the caller sees.
 *
 * HARD INVARIANT (R4): nothing here carries PHI or raw content. Only hashes
 * (`bytes32` as 0x-hex strings), opaque refs, amounts (`bigint`), decision
 * codes, state, ids, addresses, and timestamps cross this boundary — identical
 * to the on-chain record.
 */

import { PayerLine } from "../protocol/ladders.js";

/** Re-export for consumers that deep-import from this module. */
export { PayerLine } from "../protocol/ladders.js";

/**
 * Request lifecycle state. Numeric values match the Solidity `enum State`
 * declaration order EXACTLY (Open = 0 … Withdrawn = 10).
 */
export enum State {
  Open = 0,
  Ready = 1,
  UnderReview = 2,
  EvidenceRequested = 3,
  Approved = 4,
  Denied = 5,
  Settled = 6,
  Deadlocked = 7,
  PolicyInvalidated = 8,
  ProviderRefused = 9,
  Withdrawn = 10,
}

/** Human-readable name for a {@link State} value (for the UI / logs). */
export const STATE_NAMES: Readonly<Record<State, string>> = {
  [State.Open]: "Open",
  [State.Ready]: "Ready",
  [State.UnderReview]: "UnderReview",
  [State.EvidenceRequested]: "EvidenceRequested",
  [State.Approved]: "Approved",
  [State.Denied]: "Denied",
  [State.Settled]: "Settled",
  [State.Deadlocked]: "Deadlocked",
  [State.PolicyInvalidated]: "PolicyInvalidated",
  [State.ProviderRefused]: "ProviderRefused",
  [State.Withdrawn]: "Withdrawn",
};

/** Terminal states (no further transitions) — mirror of the contract's `_terminal`. */
export const TERMINAL_STATES: ReadonlySet<State> = new Set([
  State.Settled,
  State.Deadlocked,
  State.PolicyInvalidated,
  State.ProviderRefused,
  State.Withdrawn,
]);

/**
 * The agent's necessity ruling (R6) plus the policy-void outcome (R6b). Numeric
 * values match the Solidity `enum Decision` declaration order EXACTLY.
 */
export enum Decision {
  Approve = 0,
  Deny = 1,
  NeedMoreEvidence = 2,
  PolicyInvalid = 3,
}

/** Human-readable name for a {@link Decision} (the `approve|deny|…` vocabulary). */
export const DECISION_NAMES: Readonly<Record<Decision, string>> = {
  [Decision.Approve]: "approve",
  [Decision.Deny]: "deny",
  [Decision.NeedMoreEvidence]: "need_more_evidence",
  [Decision.PolicyInvalid]: "policy_invalid",
};

/**
 * Full per-request record — mirrors `struct Negotiation` field-for-field, in
 * declaration order (so the ethers tuple decode lines up). `bytes32` values are
 * 0x-prefixed 32-byte hex strings; addresses are 0x-prefixed 20-byte hex.
 */
export interface Negotiation {
  /** App-level party id of the provider (initiator). */
  readonly providerId: bigint;
  /** App-level party id of the insurer (destination). */
  readonly insurerId: bigint;
  /** Provider wallet address (auth — R11). */
  readonly providerAddr: string;
  /** Insurer wallet address (auth — R11). */
  readonly insurerAddr: string;
  /** Opaque RxNorm/NDC drug reference. */
  readonly drugRef: string;
  /** The provider's billed / requested amount. */
  readonly requestedAmount: bigint;
  /** Dispensed units (NDC-pinned) — DRIVES the deterministic cap (R2/R6a). */
  readonly quantity: bigint;
  /** Optional clinical-utilization context (necessity reasoning, NOT price) (R2). */
  readonly daysSupply: bigint;
  /** keccak256 of the de-identified justification. */
  readonly justificationHash: string;
  /** Opaque ref to the latest public-evidence doc. */
  readonly evidenceUri: string;
  /** keccak256 of the insurer's attached policy body (R5). */
  readonly policyHash: string;
  /** Opaque ref to the public policy body (R5). */
  readonly policyUri: string;
  /** Deterministic covered amount = min(requested, cap) on approve; else 0 (R6a). */
  readonly coveredAmount: bigint;
  /** ETH locked at insurerEngage; released/refunded at settle or terminal (A0008). */
  readonly escrowAmount: bigint;
  /** Mark Cuban Cost Plus per-unit price the agent looked up (cap basis — R6a/R10). */
  readonly costPlusUnitPrice: bigint;
  /** NADAC per-unit acquisition-cost FLOOR reference (R6a/R10). */
  readonly nadacUnitPrice: bigint;
  /** Hash of the agent's latest rationale. */
  readonly rationaleHash: string;
  /** The policy clause the agent relied on (R6). */
  readonly clauseRef: string;
  /** Public standard cited for a policy flag (R6b). */
  readonly standardRef: string;
  /** Latest agent decision (meaningful once `hasRuling`). */
  readonly lastDecision: Decision;
  /** Whether an agent decision has landed. */
  readonly hasRuling: boolean;
  /** Adjudication round count (bounded to maxRounds — R6c). */
  readonly round: bigint;
  /** Payer line governing the appeal ladder (SPEC-0004 R13). */
  readonly payerLine: PayerLine;
  /** Current position in the payer-line appeal ladder (0 = Initial Determination). */
  readonly appealRound: number;
  /** Whether the provider has accepted the current ruling. */
  readonly providerAccepted: boolean;
  /** Whether the insurer has accepted the current ruling. */
  readonly insurerAccepted: boolean;
  /** Accumulated agent fees (basis for the 50/50 settlement marker — R8). */
  readonly totalFees: bigint;
  /** Current lifecycle state. */
  readonly state: State;
  /** In-flight Somnia agent request id (0 if none). */
  readonly pendingRequestId: bigint;
  /** Block/wall-clock timestamp (seconds) the request was created. */
  readonly createdAt: bigint;
  /** After this timestamp a stuck ruling may time out (0 if no request). */
  readonly rulingDeadline: bigint;
  /** Whether the record exists (always true for a returned view). */
  readonly exists: boolean;
  /** Per-negotiation public evidence URL for the LLM agent (SPEC-0006 R14). */
  readonly agentEvidenceUrl: string;
  /** Per-negotiation prompt hint embedded in the inferString call (SPEC-0006 R15). */
  readonly agentPromptHint: string;
}

/**
 * UI-friendly projection of a {@link Negotiation}: the raw record plus the
 * request id and decoded helpers the views need.
 */
export interface NegotiationView {
  /** On-chain request id (`reqId`). */
  readonly reqId: bigint;
  /** The underlying record. */
  readonly negotiation: Negotiation;
  /** Current state. */
  readonly state: State;
  /** Human-readable state name. */
  readonly stateName: string;
  /** Whether the insurer has attached a policy (state ≥ Ready). */
  readonly policyAttached: boolean;
  /** Whether adjudication may currently be requested (state === Ready). */
  readonly adjudicable: boolean;
  /** Whether a ruling is in hand to accept/appeal (Approved/Denied). */
  readonly ruled: boolean;
  /** Whether both parties have accepted the current ruling (settleable). */
  readonly bothAccepted: boolean;
  /** Whether the request has reached a terminal state. */
  readonly terminal: boolean;
}

// ---------------------------------------------------------------------------
// Event types — mirror the contract's `event` declarations (SPEC-0001 §3).
// Each carries only ids/hashes/refs/amounts/codes, never raw content.
// ---------------------------------------------------------------------------

/** Discriminator for the union of negotiation events. */
export type CoverageEventName =
  | "ContractCreated"
  | "ContentCommitted"
  | "InsurerEngaged"
  | "ContractReady"
  | "AdjudicationRequested"
  | "PacketSubmitted"
  | "RulingRequested"
  | "Ruled"
  | "RulingRationale"
  | "PolicyInvalidated"
  | "EvidenceRequested"
  | "EvidenceSubmitted"
  | "Appealed"
  | "Accepted"
  | "Settled"
  | "Deadlocked"
  | "ProviderRefused"
  | "Withdrawn"
  | "RulingTimedOut"
  | "FeedbackPosted";

interface BaseEvent {
  /** Request id the event pertains to. */
  readonly reqId: bigint;
  /** Optional transaction hash (present for real-chain events). */
  readonly txHash?: string;
  /** Optional block number (present for real-chain events). */
  readonly blockNumber?: number;
}

export interface ContractCreatedEvent extends BaseEvent {
  readonly name: "ContractCreated";
  readonly providerId: bigint;
  readonly insurerId: bigint;
  readonly providerAddr: string;
  readonly insurerAddr: string;
  readonly drugRef: string;
  readonly requestedAmount: bigint;
  readonly quantity: bigint;
  readonly daysSupply: bigint;
}

export interface ContentCommittedEvent extends BaseEvent {
  readonly name: "ContentCommitted";
  readonly contentHash: string;
  readonly uri: string;
}

export interface InsurerEngagedEvent extends BaseEvent {
  readonly name: "InsurerEngaged";
  readonly policyHash: string;
  readonly policyUri: string;
}

export interface ContractReadyEvent extends BaseEvent {
  readonly name: "ContractReady";
}

export interface AdjudicationRequestedEvent extends BaseEvent {
  readonly name: "AdjudicationRequested";
}

export interface RulingRequestedEvent extends BaseEvent {
  readonly name: "RulingRequested";
  readonly requestId: bigint;
  readonly fee: bigint;
}

/**
 * SPEC-0004 §3.5 PacketSubmitted: emitted on every agent fire (initial
 * `requestAdjudication`, `submitEvidence`, and `appeal`) so off-chain indexers
 * and the Curie packet store can correlate the on-chain ruling request with the
 * off-chain packet body. `packetRoot` and `packetUrl` carry the evidenceUri
 * (bytes32) until UNIT-9 lands the Merkle root + the body-store URL.
 */
export interface PacketSubmittedEvent extends BaseEvent {
  readonly name: "PacketSubmitted";
  readonly round: bigint;
  readonly packetRoot: string;
  readonly packetUrl: string;
}

/**
 * SPEC-0006 R24: 4-arg Ruled event emitted by handleResponse.
 * Shape: (reqId indexed, requestId indexed, decision indexed, coveredAmount).
 * The rationale is now committed separately via commitRationale → RulingRationale event.
 */
export interface RuledEvent extends BaseEvent {
  readonly name: "Ruled";
  readonly requestId: bigint;
  readonly decision: Decision;
  readonly coveredAmount: bigint;
}

/**
 * SPEC-0006 R24–R26: emitted by commitRationale after the keeper transcribes
 * the agent's chain-of-thought from the receipt.
 * Shape: (reqId indexed, requestId indexed, decision indexed, rationale string,
 *         clauseReference string, standardReference string).
 */
export interface RulingRationaleEvent extends BaseEvent {
  readonly name: "RulingRationale";
  readonly requestId: bigint;
  readonly decision: Decision;
  readonly rationale: string;
  readonly clauseReference: string;
  readonly standardReference: string;
}

export interface PolicyInvalidatedEvent extends BaseEvent {
  readonly name: "PolicyInvalidated";
  readonly clauseRef: string;
  readonly standardRef: string;
}

export interface EvidenceRequestedEvent extends BaseEvent {
  readonly name: "EvidenceRequested";
}

export interface EvidenceSubmittedEvent extends BaseEvent {
  readonly name: "EvidenceSubmitted";
  readonly evidenceUri: string;
}

export interface AppealedEvent extends BaseEvent {
  readonly name: "Appealed";
  readonly partyId: bigint;
  readonly evidenceUri: string;
  readonly round: bigint;
}

export interface AcceptedEvent extends BaseEvent {
  readonly name: "Accepted";
  readonly partyId: bigint;
}

export interface SettledEvent extends BaseEvent {
  readonly name: "Settled";
  readonly coveredAmount: bigint;
  /** ETH refunded to the insurer: escrowAmount − coveredAmount on Approved; full escrow on Denied (A0008 §2). */
  readonly refundedToInsurer: bigint;
}

export interface DeadlockedEvent extends BaseEvent {
  readonly name: "Deadlocked";
  readonly rounds: bigint;
}

export interface ProviderRefusedEvent extends BaseEvent {
  readonly name: "ProviderRefused";
  readonly reasonHash: string;
}

export interface WithdrawnEvent extends BaseEvent {
  readonly name: "Withdrawn";
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

/** Discriminated union of every negotiation event the contract can emit. */
export type CoverageEvent =
  | ContractCreatedEvent
  | ContentCommittedEvent
  | InsurerEngagedEvent
  | ContractReadyEvent
  | AdjudicationRequestedEvent
  | PacketSubmittedEvent
  | RulingRequestedEvent
  | RuledEvent
  | RulingRationaleEvent
  | PolicyInvalidatedEvent
  | EvidenceRequestedEvent
  | EvidenceSubmittedEvent
  | AppealedEvent
  | AcceptedEvent
  | SettledEvent
  | DeadlockedEvent
  | ProviderRefusedEvent
  | WithdrawnEvent
  | RulingTimedOutEvent
  | FeedbackPostedEvent;

/** Listener invoked for every emitted {@link CoverageEvent}. */
export type CoverageEventListener = (event: CoverageEvent) => void;

/** Unsubscribe handle returned by event subscriptions. */
export type Unsubscribe = () => void;

/**
 * Wallet operating mode (R14). The same calling code runs in either mode; only
 * the signer/provider differs.
 */
export type WalletMode = "simulated" | "real";
