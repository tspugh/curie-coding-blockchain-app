/**
 * SimulatedBackend — an in-memory state machine that MIRRORS
 * `CoverageNegotiation.sol` EXACTLY (SPEC-0001 §3): same states, same
 * transitions, same guards, same events, and a MOCKED native agent ruling that
 * stands in for the Somnia platform's `handleResponse` callback.
 *
 * This lets the whole app + tests run end-to-end with no chain, no funds, and
 * no real agent (R11). The guards/reverts and event sequence match the Solidity
 * `require`s and `emit`s so the simulated path is behaviourally indistinguishable
 * from the real one through the shared {@link CoverageNegotiationClient}.
 *
 * Agent ruling (R6): `submitDispute` / `submitEvidence` / `appeal` move to
 * `UnderReview` and schedule a deterministic verdict (default "approve",
 * configurable), delivered after `autoResolveMs` OR immediately when the caller
 * invokes the explicit {@link SimulatedBackend.resolve} hook — mimicking the
 * platform calling `handleResponse` back into the contract.
 */
import { ethers } from "ethers";

import {
  type CoverageEvent,
  type CoverageEventListener,
  type Negotiation,
  type NegotiationView,
  type Position,
  State,
  STATE_NAMES,
  type Unsubscribe,
  type Verdict,
} from "../types/coverage.types.js";
import type {
  CoverageNegotiationClient,
  CreateContractParams,
  SubmitPositionParams,
} from "./types.js";

/** 0x + 64 zeros — the bytes32 zero sentinel (matches Solidity `bytes32(0)`). */
export const ZERO_HASH = ethers.ZeroHash;

/** Tunables for the mocked agent. */
export interface SimulatedAgentOptions {
  /**
   * Verdict the mocked agent returns. May be a fixed {@link Verdict} or a
   * function of the negotiation (e.g. rule by where positions sit in the band).
   * Default: always "approve".
   */
  readonly verdict?: Verdict | ((n: Negotiation, reqId: bigint) => Verdict);
  /**
   * Auto-resolve delay in ms after a dispute fires. `0` (default) means the
   * verdict is delivered on the next microtask; set higher to mimic latency.
   * Set `autoResolve: false` to require the explicit {@link SimulatedBackend.resolve}
   * hook instead.
   */
  readonly autoResolveMs?: number;
  /** When false, no auto-resolve; callers must invoke `resolve()`. */
  readonly autoResolve?: boolean;
}

interface SimNegotiation {
  initiatorId: bigint;
  destinationId: bigint;
  drugRef: string;
  noteHash: string;
  priceFloor: bigint;
  priceCeil: bigint;
  evidenceUri: string;
  initiatorPosition: Position;
  destinationPosition: Position;
  agreedAmount: bigint;
  state: State;
  pendingRequestId: bigint;
  createdAt: bigint;
  rulingDeadline: bigint;
  exists: boolean;
}

/** In-memory backend behind the shared client interface. */
export class SimulatedBackend implements CoverageNegotiationClient {
  readonly mode = "simulated" as const;

  private readonly negotiations = new Map<bigint, SimNegotiation>();
  private readonly requestToReq = new Map<bigint, bigint>();
  private readonly listeners = new Set<CoverageEventListener>();
  private nextId = 1n;
  private nextRequestId = 1n;
  private readonly agent: Required<SimulatedAgentOptions>;
  private readonly pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(agent: SimulatedAgentOptions = {}) {
    this.agent = {
      verdict: agent.verdict ?? "approve",
      autoResolveMs: agent.autoResolveMs ?? 0,
      autoResolve: agent.autoResolve ?? true,
    };
  }

  // ---------------------------------------------------------------------
  // Writes (mirror Solidity lifecycle functions + guards)
  // ---------------------------------------------------------------------

  async createContract(params: CreateContractParams): Promise<bigint> {
    if (params.priceFloor > params.priceCeil) throw new Error("band: floor>ceil");

    const reqId = this.nextId++;
    const now = BigInt(Math.floor(Date.now() / 1000));
    this.negotiations.set(reqId, {
      initiatorId: params.initiatorId,
      destinationId: params.destinationId,
      drugRef: params.drugRef,
      noteHash: params.noteHash,
      priceFloor: params.priceFloor,
      priceCeil: params.priceCeil,
      evidenceUri: params.evidenceUri,
      initiatorPosition: { proposedAmount: 0n, submitted: false },
      destinationPosition: { proposedAmount: 0n, submitted: false },
      agreedAmount: 0n,
      state: State.Open,
      pendingRequestId: 0n,
      createdAt: now,
      rulingDeadline: 0n,
      exists: true,
    });

    this.emit({
      name: "ContractCreated",
      reqId,
      initiatorId: params.initiatorId,
      destinationId: params.destinationId,
      drugRef: params.drugRef,
      priceFloor: params.priceFloor,
      priceCeil: params.priceCeil,
    });
    return reqId;
  }

  async attachContent(reqId: bigint, contentHash: string, uri: string): Promise<void> {
    const n = this.must(reqId);
    if (!this.isActive(n.state)) throw new Error("not active");
    n.noteHash = contentHash;
    n.evidenceUri = uri;
    this.emit({ name: "ContentCommitted", reqId, contentHash, uri });
  }

  async submitPosition(params: SubmitPositionParams): Promise<void> {
    const { reqId, partyId, proposedAmount, contentHash, uri } = params;
    const n = this.must(reqId);
    if (n.state !== State.Open) throw new Error("not Open");

    const isInitiator = partyId === n.initiatorId;
    const isDestination = partyId === n.destinationId;
    if (!isInitiator && !isDestination) throw new Error("unknown party");

    // Self-contract: first call fills initiator slot, second fills destination.
    if (isInitiator && !n.initiatorPosition.submitted) {
      n.initiatorPosition = { proposedAmount, submitted: true };
    } else if (isDestination && !n.destinationPosition.submitted) {
      n.destinationPosition = { proposedAmount, submitted: true };
    } else {
      throw new Error("position already submitted");
    }

    if (contentHash !== ZERO_HASH) {
      n.noteHash = contentHash;
      this.emit({ name: "ContentCommitted", reqId, contentHash, uri });
    }

    this.emit({ name: "PositionSubmitted", reqId, partyId, proposedAmount });

    if (n.initiatorPosition.submitted && n.destinationPosition.submitted) {
      n.state = State.Ready;
      this.emit({ name: "ContractReady", reqId });
    }
  }

  async submitDispute(reqId: bigint, byPartyId: bigint): Promise<void> {
    const n = this.must(reqId);
    if (n.state !== State.Ready) throw new Error("dispute: not Ready");
    if (byPartyId !== n.initiatorId && byPartyId !== n.destinationId) {
      throw new Error("unknown party");
    }
    this.emit({ name: "DisputeSubmitted", reqId, byPartyId });
    this.fireAgent(reqId, n);
  }

  async submitEvidence(reqId: bigint, evidenceUri: string): Promise<void> {
    const n = this.must(reqId);
    if (n.state !== State.EvidenceRequested) throw new Error("evidence: wrong state");
    n.evidenceUri = evidenceUri;
    this.emit({ name: "EvidenceSubmitted", reqId, evidenceUri });
    this.fireAgent(reqId, n);
  }

  async appeal(reqId: bigint, evidenceUri: string): Promise<void> {
    const n = this.must(reqId);
    if (n.state !== State.Denied) throw new Error("appeal: not Denied");
    n.evidenceUri = evidenceUri;
    n.state = State.Appealed;
    this.emit({ name: "Appealed", reqId, evidenceUri });
    this.fireAgent(reqId, n);
  }

  async postFeedback(reqId: bigint, msgHash: string, uri: string): Promise<void> {
    const n = this.must(reqId);
    if (!this.isActive(n.state)) throw new Error("feedback: not active");
    this.emit({ name: "FeedbackPosted", reqId, msgHash, uri });
  }

  async settle(reqId: bigint, agreedAmount: bigint): Promise<void> {
    const n = this.must(reqId);
    if (n.state !== State.Approved) throw new Error("settle: not Approved");
    if (agreedAmount < n.priceFloor || agreedAmount > n.priceCeil) {
      throw new Error("settle: out of band");
    }
    n.agreedAmount = agreedAmount;
    n.state = State.Settled;
    this.emit({ name: "Settled", reqId, agreedAmount });
  }

  async withdraw(reqId: bigint): Promise<void> {
    const n = this.must(reqId);
    if (n.state === State.Settled || n.state === State.Withdrawn) {
      throw new Error("withdraw: terminal");
    }
    n.state = State.Withdrawn;
    this.emit({ name: "Withdrawn", reqId });
  }

  /**
   * Keeper-style timeout: route a stuck `UnderReview` to retriable
   * `EvidenceRequested` (mirrors `onRulingTimeout`). Ignores the deadline check
   * so tests can force it; production uses the real contract.
   */
  async onRulingTimeout(reqId: bigint): Promise<void> {
    const n = this.must(reqId);
    if (n.state !== State.UnderReview) throw new Error("timeout: not UnderReview");
    const requestId = n.pendingRequestId;
    this.clearRequest(n);
    n.state = State.EvidenceRequested;
    this.emit({ name: "RulingTimedOut", reqId, requestId });
  }

  // ---------------------------------------------------------------------
  // Reads (mirror Solidity views)
  // ---------------------------------------------------------------------

  async getNegotiation(reqId: bigint): Promise<Negotiation> {
    return this.snapshot(this.must(reqId));
  }

  async getNegotiationView(reqId: bigint): Promise<NegotiationView> {
    const n = this.must(reqId);
    return this.toView(reqId, n);
  }

  async stateOf(reqId: bigint): Promise<State> {
    return this.must(reqId).state;
  }

  async count(): Promise<bigint> {
    return this.nextId - 1n;
  }

  // ---------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------

  subscribe(listener: CoverageEventListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async close(): Promise<void> {
    for (const t of this.pendingTimers) clearTimeout(t);
    this.pendingTimers.clear();
    this.listeners.clear();
  }

  // ---------------------------------------------------------------------
  // Mocked agent + internals
  // ---------------------------------------------------------------------

  /**
   * Deliver a verdict for an in-flight request, mimicking the platform calling
   * `handleResponse`. If `verdict` is omitted, uses the configured default.
   * Available for tests / manual control even when auto-resolve is on.
   */
  resolve(reqId: bigint, verdict?: Verdict): void {
    const n = this.negotiations.get(reqId);
    if (!n || n.state !== State.UnderReview) return;
    const v = verdict ?? this.computeVerdict(n, reqId);
    this.deliverRuling(reqId, n, v);
  }

  /** Fire the mocked agent: move to UnderReview, schedule/await the callback. */
  private fireAgent(reqId: bigint, n: SimNegotiation): void {
    const requestId = this.nextRequestId++;
    n.pendingRequestId = requestId;
    n.rulingDeadline = BigInt(Math.floor(Date.now() / 1000)) + 3600n;
    n.state = State.UnderReview;
    this.requestToReq.set(requestId, reqId);

    // Fee is mocked (no funds in simulated mode); emit a nominal 0 fee.
    this.emit({ name: "RulingRequested", reqId, requestId, fee: 0n });

    if (this.agent.autoResolve) {
      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        this.resolve(reqId);
      }, this.agent.autoResolveMs);
      // Do not keep the event loop alive solely for a mocked ruling.
      if (typeof timer.unref === "function") timer.unref();
      this.pendingTimers.add(timer);
    }
  }

  private computeVerdict(n: SimNegotiation, reqId: bigint): Verdict {
    return typeof this.agent.verdict === "function"
      ? this.agent.verdict(this.snapshot(n), reqId)
      : this.agent.verdict;
  }

  /** Mirror of the contract's `handleResponse` verdict routing. */
  private deliverRuling(reqId: bigint, n: SimNegotiation, verdict: Verdict): void {
    const requestId = n.pendingRequestId;
    this.clearRequest(n);

    if (verdict === "approve") {
      n.state = State.Approved;
    } else if (verdict === "deny") {
      n.state = State.Denied;
    } else {
      n.state = State.EvidenceRequested;
    }

    // Receipt id is mocked; deterministic per request for traceability.
    this.emit({ name: "Ruled", reqId, requestId, verdict, receiptId: requestId });
  }

  private clearRequest(n: SimNegotiation): void {
    if (n.pendingRequestId !== 0n) {
      this.requestToReq.delete(n.pendingRequestId);
      n.pendingRequestId = 0n;
    }
    n.rulingDeadline = 0n;
  }

  private must(reqId: bigint): SimNegotiation {
    const n = this.negotiations.get(reqId);
    if (!n || !n.exists) throw new Error("unknown contract");
    return n;
  }

  private isActive(s: State): boolean {
    return s !== State.Settled && s !== State.Withdrawn;
  }

  private snapshot(n: SimNegotiation): Negotiation {
    return {
      initiatorId: n.initiatorId,
      destinationId: n.destinationId,
      drugRef: n.drugRef,
      noteHash: n.noteHash,
      priceFloor: n.priceFloor,
      priceCeil: n.priceCeil,
      evidenceUri: n.evidenceUri,
      initiatorPosition: { ...n.initiatorPosition },
      destinationPosition: { ...n.destinationPosition },
      agreedAmount: n.agreedAmount,
      state: n.state,
      pendingRequestId: n.pendingRequestId,
      createdAt: n.createdAt,
      rulingDeadline: n.rulingDeadline,
      exists: n.exists,
    };
  }

  private toView(reqId: bigint, n: SimNegotiation): NegotiationView {
    const both = n.initiatorPosition.submitted && n.destinationPosition.submitted;
    return {
      reqId,
      negotiation: this.snapshot(n),
      state: n.state,
      stateName: STATE_NAMES[n.state],
      bothPositionsSubmitted: both,
      disputable: n.state === State.Ready,
      terminal: n.state === State.Settled || n.state === State.Withdrawn,
    };
  }

  private emit(event: CoverageEvent): void {
    for (const l of this.listeners) l(event);
  }
}
