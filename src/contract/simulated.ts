/**
 * SimulatedBackend — an in-memory state machine that MIRRORS
 * `CoverageNegotiation.sol` EXACTLY (SPEC-0001 §3, revised 2026-05-27 — AI
 * necessity-arbiter model): same states, same transitions, same state guards,
 * same events, and a MOCKED necessity arbiter that stands in for the Somnia
 * platform's `handleResponse` callback.
 *
 * This lets the whole app + tests run end-to-end with no chain, no funds, and no
 * real agent (R14). The guards and event sequence match the Solidity `require`s
 * and `emit`s so the simulated path is behaviourally indistinguishable from the
 * real one through the shared {@link CoverageNegotiationClient}.
 *
 * AUTH PARITY (R11/R12, Finding-2 fix 2026-05-27): simulated mode NOW models
 * `msg.sender` via an {@link SimulatedBackend.activeAddress active address} so it
 * enforces the SAME wallet gates the contract does, with matching revert
 * messages — closing the gap where dev/CI could mask an R11 auth regression.
 * Party actions require the caller ∈ {providerAddr, insurerAddr}; `insurerEngage`
 * is insurer-only; `submitEvidence`/`refuse` are provider-only;
 * `requestAdjudication`/`appeal`/`accept`/`settle`/`withdraw`/`postFeedback`/
 * `onRulingTimeout` are party-gated; `createContract` must come from the declared
 * provider address. Reads stay public (no gate). Under the single-shared-wallet
 * model (R12) provider==insurer so the one address passes and `partyId`
 * distinguishes the side. The active address defaults to a wildcard that satisfies
 * every gate (back-compat for callers that never set one) — set it (constructor
 * `caller` option, {@link SimulatedBackend.setCaller}, or {@link SimulatedBackend.connect})
 * to exercise the gates.
 *
 * Arbiter ruling (R6): `requestAdjudication` / `submitEvidence` / `appeal` move
 * to `UnderReview` and schedule a deterministic decision (default Approve,
 * configurable), delivered after `autoResolveMs` OR immediately when the caller
 * invokes the explicit {@link SimulatedBackend.resolve} hook — mimicking the
 * platform calling `handleResponse` back into the contract. On Approve the
 * covered amount is computed DETERMINISTICALLY as
 * `min(requested, costPlusUnitPrice * quantity)` (R6a) — the arbiter config
 * supplies the per-unit Cost Plus price (the cap basis) and the NADAC floor
 * reference, never the covered amount. NADAC is stored as a floor reference only.
 */
import { ethers } from "ethers";

import {
  type CoverageEvent,
  type CoverageEventListener,
  Decision,
  type Negotiation,
  type NegotiationView,
  PayerLine,
  State,
  STATE_NAMES,
  TERMINAL_STATES,
  type Unsubscribe,
} from "../types/coverage.types.js";
import type {
  CoverageNegotiationClient,
  CreateContractParams,
  EventFilter,
  PolicyCommitment,
  PriceBasis,
} from "./types.js";

/** 0x + 64 zeros — the bytes32 zero sentinel (matches Solidity `bytes32(0)`). */
export const ZERO_HASH = ethers.ZeroHash;

/** Default appeal round cap (mirrors the contract's `maxRounds = 3`, R6c). */
const DEFAULT_MAX_ROUNDS = 3n;

/**
 * Wildcard active-address sentinel: when the backend's caller is this value the
 * R11 gates all pass (back-compat for callers that never set an address). It is
 * an impossible real address (not 20 bytes), so it can never collide with a
 * party wallet.
 */
export const ANY_CALLER = "*";

/** Tunables for the mocked necessity arbiter (R6/R6a/R6b). */
export interface SimulatedAgentOptions {
  /**
   * The {@link Decision} the mocked arbiter returns. May be a fixed value or a
   * function of the negotiation (e.g. rule by round). Default: {@link Decision.Approve}.
   */
  readonly decision?: Decision | ((n: Negotiation, reqId: bigint) => Decision);
  /**
   * The Mark Cuban Cost Plus PER-UNIT price the arbiter looks up. It is the cap
   * basis for the deterministic `min(requested, costPlusUnitPrice * quantity)` on
   * approve (R6a) — never the covered amount itself. May be fixed or a function.
   * Default: a per-unit price that makes the cap non-binding, i.e.
   * `ceil(requestedAmount / quantity)`, so `coveredAmount === requestedAmount`
   * unless overridden. Set it lower to demonstrate the cap binding.
   */
  readonly costPlusUnitPrice?: bigint | ((n: Negotiation, reqId: bigint) => bigint);
  /**
   * The NADAC acquisition-cost PER-UNIT FLOOR reference the arbiter looks up
   * (R6a/R10). Stored on the record for transparency; it is a floor reference
   * only and NEVER enters the cap math. May be fixed or a function. Default: 0.
   */
  readonly nadacUnitPrice?: bigint | ((n: Negotiation, reqId: bigint) => bigint);
  /** Hash of the arbiter's rationale. Default: `ethers.id("rationale")`. */
  readonly rationaleHash?: string;
  /** The policy clause the arbiter relied on (R6). Default: `ethers.id("clause")`. */
  readonly clauseRef?: string;
  /** Public standard cited for a policy flag (R6b). Default: `ethers.id("standard")`. */
  readonly standardRef?: string;
  /** Off-chain receipt pointer to surface in the `Ruled` event. Default: the request id. */
  readonly receiptId?: bigint;
  /**
   * SPEC-0004 §3.5 R23: clause indices voided per R23's on-label-policy-void path.
   * Emitted as the 8th arg of the `Ruled` event. Default: [].
   */
  readonly policyVoidedClauseIndices?: number[];
  /**
   * SPEC-0004 §3.5 R11: packet-entry indices the ruling relied on.
   * Emitted as the 9th arg of the `Ruled` event. Default: [].
   */
  readonly usedReferenceIndices?: number[];
  /**
   * SPEC-0004 §3.5 R11: leaf hashes for the cited references (replay-verification anchor).
   * Emitted as the 10th arg of the `Ruled` event. Default: [].
   */
  readonly usedLeafHashes?: `0x${string}`[];
  /**
   * Auto-resolve delay in ms after the agent fires. `0` (default) means the
   * ruling is delivered on the next macrotask; set higher to mimic latency. Set
   * `autoResolve: false` to require the explicit {@link SimulatedBackend.resolve}.
   */
  readonly autoResolveMs?: number;
  /** When false, no auto-resolve; callers must invoke `resolve()`. */
  readonly autoResolve?: boolean;
  /** Appeal round cap before `Deadlocked` (R6c). Default: 3. */
  readonly maxRounds?: bigint;
  /**
   * The acting wallet address used to enforce the R11 address gates — the
   * simulated stand-in for `msg.sender`. When omitted, a wildcard
   * ({@link ANY_CALLER}) is used and every gate passes (back-compat). Set it (or
   * call {@link SimulatedBackend.setCaller} / {@link SimulatedBackend.connect}) to
   * enforce the same auth the contract does. Compared case-insensitively, so it
   * need not be checksummed.
   */
  readonly caller?: string;
}

/** Mutable in-memory mirror of `struct Negotiation`. */
interface SimNegotiation {
  providerId: bigint;
  insurerId: bigint;
  providerAddr: string;
  insurerAddr: string;
  drugRef: string;
  requestedAmount: bigint;
  quantity: bigint;
  daysSupply: bigint;
  justificationHash: string;
  evidenceUri: string;
  policyHash: string;
  policyUri: string;
  coveredAmount: bigint;
  /** ETH locked at insurerEngage; released/refunded at settle or terminal (A0008). */
  escrowAmount: bigint;
  costPlusUnitPrice: bigint;
  nadacUnitPrice: bigint;
  rationaleHash: string;
  clauseRef: string;
  standardRef: string;
  lastDecision: Decision;
  hasRuling: boolean;
  round: bigint;
  payerLine: PayerLine;
  appealRound: number;
  providerAccepted: boolean;
  insurerAccepted: boolean;
  totalFees: bigint;
  state: State;
  pendingRequestId: bigint;
  createdAt: bigint;
  rulingDeadline: bigint;
  exists: boolean;
  agentEvidenceUrl: string; // per-neg evidence URL (SPEC-0006 R14)
  agentPromptHint: string;  // per-neg prompt hint (SPEC-0006 R15)
  agentPhase: number;       // two-agent phase tracker (0=None/1=Scraping/2=Deciding — Amendment 0007)
  pendingDecideFee: bigint; // parked LLM Inference fee for pending Decide-phase call (Amendment 0007)
  pendingFeePayer: string;  // address of the fee payer for the parked decide fee (Amendment 0007)
}

/**
 * Module-level mutable for the next `policyVoidedClauseIndices` value to emit
 * in the simulated `Ruled` event (SPEC-0004 §3.5 R23). Reset to `[]` after each use.
 * Use {@link setNextPolicyVoidedClauseIndices} to prime a one-shot populated value.
 */
let _nextPolicyVoidedClauseIndices: number[] = [];

/**
 * Set the `policyVoidedClauseIndices` array that will be emitted in the NEXT
 * `Ruled` event from any {@link SimulatedBackend} instance. Consumed once then
 * reset to `[]`. Used by future browser-verify scenarios that drive the R23
 * Approve-with-voided-clauses path; the web layer's own `setNext…` helpers
 * live in `web/src/client.ts` and target their own backend wrapper.
 */
export function setNextPolicyVoidedClauseIndices(arr: number[]): void {
  _nextPolicyVoidedClauseIndices = arr;
}

/**
 * Module-level mutable for the next `usedReferenceIndices` value to emit in the
 * simulated `Ruled` event (SPEC-0004 §3.5 R11). Reset to `[]` after each use.
 * Use {@link setNextUsedReferenceIndices} to prime a one-shot populated value.
 */
let _nextUsedReferenceIndices: number[] = [];

/**
 * Set the `usedReferenceIndices` array that will be emitted in the NEXT `Ruled`
 * event from any {@link SimulatedBackend} instance. Consumed once then reset to
 * `[]`. Used by future browser-verify scenarios that drive the R11
 * ruling-citation-replay path; the web layer's own `setNext…` helpers live in
 * `web/src/client.ts` and target their own backend wrapper.
 */
export function setNextUsedReferenceIndices(arr: number[]): void {
  _nextUsedReferenceIndices = arr;
}

/**
 * Module-level mutable for the next `usedLeafHashes` value to emit in the
 * simulated `Ruled` event (SPEC-0004 §3.5 R11). Reset to `[]` after each use.
 * Use {@link setNextUsedLeafHashes} to prime a one-shot populated value.
 */
let _nextUsedLeafHashes: `0x${string}`[] = [];

/**
 * Set the `usedLeafHashes` array that will be emitted in the NEXT `Ruled` event
 * from any {@link SimulatedBackend} instance. Consumed once then reset to `[]`.
 * Used by future browser-verify scenarios that drive the R11
 * ruling-citation-replay path; the web layer's own `setNext…` helpers live in
 * `web/src/client.ts` and target their own backend wrapper.
 */
export function setNextUsedLeafHashes(arr: `0x${string}`[]): void {
  _nextUsedLeafHashes = arr;
}

/**
 * Returns true when `s` contains the patient-name pattern [A-Z][a-z]+ [A-Z]
 * (uppercase letter, one-or-more lowercase letters, a space, uppercase letter).
 * Mirrors the Solidity `_containsNamePattern` defense-in-depth PHI guard (SPEC-0006 R15).
 */
function _containsNamePattern(s: string): boolean {
  return /[A-Z][a-z]+ [A-Z]/.test(s);
}

/** In-memory backend behind the shared client interface. */
export class SimulatedBackend implements CoverageNegotiationClient {
  readonly mode = "simulated" as const;

  private readonly negotiations = new Map<bigint, SimNegotiation>();
  private readonly requestToReq = new Map<bigint, bigint>();
  private readonly listeners = new Set<CoverageEventListener>();
  /** Recorded event log, in emission order — the simulated `eth_getLogs` (R16/T10). */
  private readonly history: CoverageEvent[] = [];
  private nextId = 1n;
  private nextRequestId = 1n;
  private readonly agent: SimulatedAgentOptions;
  private readonly maxRounds: bigint;
  private readonly pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  /** Lower-cased acting address (the simulated `msg.sender`), or {@link ANY_CALLER}. */
  private caller: string;

  constructor(agent: SimulatedAgentOptions = {}) {
    this.agent = agent;
    this.maxRounds = agent.maxRounds ?? DEFAULT_MAX_ROUNDS;
    this.caller = agent.caller ? agent.caller.toLowerCase() : ANY_CALLER;
  }

  // ---------------------------------------------------------------------
  // Active-address (simulated msg.sender) — R11 auth parity
  // ---------------------------------------------------------------------

  /** The current acting address (the simulated `msg.sender`), lower-cased, or {@link ANY_CALLER}. */
  get activeAddress(): string {
    return this.caller;
  }

  /**
   * Set the acting wallet address used to enforce the R11 gates — the simulated
   * analogue of choosing which signer sends the next write. Pass {@link ANY_CALLER}
   * to disable gating. Returns `this` for fluent use (`backend.setCaller(addr)`).
   */
  setCaller(address: string): this {
    this.caller = address === ANY_CALLER ? ANY_CALLER : address.toLowerCase();
    return this;
  }

  // ---------------------------------------------------------------------
  // Writes (mirror Solidity lifecycle functions + state guards)
  // ---------------------------------------------------------------------

  async createContract(params: CreateContractParams): Promise<bigint> {
    if (params.providerAddr === ethers.ZeroAddress || params.insurerAddr === ethers.ZeroAddress) {
      throw new Error("addr: zero");
    }
    // R11: createContract must come from the declared provider address (matches the
    // contract's `require(msg.sender == providerAddr, "auth: not provider")`).
    if (!this.is(params.providerAddr)) throw new Error("auth: not provider");
    if (params.quantity <= 0n) throw new Error("qty: zero");
    // SPEC-0004 R2b: rejects providerAddr == insurerAddr (supersedes SPEC-0001 R13's
    // permissive self-claim — the demo explicitly does not support self-contracting).
    if (params.providerAddr.toLowerCase() === params.insurerAddr.toLowerCase()) {
      throw new Error("create: self-contract");
    }
    // SPEC-0006 R14: URL must be 1..512 bytes.
    if (!params.agentEvidenceUrl || new TextEncoder().encode(params.agentEvidenceUrl).length > 512) {
      throw new Error("evidence: url required");
    }
    // SPEC-0006 R15: hint must be 1..1024 bytes and must not contain a patient-name pattern.
    if (
      !params.agentPromptHint ||
      new TextEncoder().encode(params.agentPromptHint).length > 1024 ||
      _containsNamePattern(params.agentPromptHint)
    ) {
      throw new Error("evidence: hint required");
    }

    const reqId = this.nextId++;
    const now = BigInt(Math.floor(Date.now() / 1000));
    this.negotiations.set(reqId, {
      providerId: params.providerId,
      insurerId: params.insurerId,
      providerAddr: params.providerAddr,
      insurerAddr: params.insurerAddr,
      drugRef: params.drugRef,
      requestedAmount: params.requestedAmount,
      quantity: params.quantity,
      daysSupply: params.daysSupply,
      justificationHash: params.justificationHash,
      evidenceUri: params.evidenceUri,
      policyHash: ZERO_HASH,
      policyUri: ZERO_HASH,
      coveredAmount: 0n,
      escrowAmount: 0n,
      costPlusUnitPrice: 0n,
      nadacUnitPrice: 0n,
      rationaleHash: ZERO_HASH,
      clauseRef: ZERO_HASH,
      standardRef: ZERO_HASH,
      lastDecision: Decision.Approve,
      hasRuling: false,
      round: 0n,
      payerLine: params.payerLine,
      appealRound: 0,
      providerAccepted: false,
      insurerAccepted: false,
      totalFees: 0n,
      state: State.Open,
      pendingRequestId: 0n,
      createdAt: now,
      rulingDeadline: 0n,
      exists: true,
      agentEvidenceUrl: params.agentEvidenceUrl,
      agentPromptHint: params.agentPromptHint,
      agentPhase: 0,
      pendingDecideFee: 0n,
      pendingFeePayer: ethers.ZeroAddress,
    });

    this.emit({
      name: "ContractCreated",
      reqId,
      providerId: params.providerId,
      insurerId: params.insurerId,
      providerAddr: params.providerAddr,
      insurerAddr: params.insurerAddr,
      drugRef: params.drugRef,
      requestedAmount: params.requestedAmount,
      quantity: params.quantity,
      daysSupply: params.daysSupply,
    });
    if (params.justificationHash !== ZERO_HASH) {
      this.emit({
        name: "ContentCommitted",
        reqId,
        contentHash: params.justificationHash,
        uri: params.evidenceUri,
      });
    }
    return reqId;
  }

  /**
   * A0008 §1: `depositAmount` mirrors the on-chain `msg.value` — must be >= `requestedAmount`
   * ("escrow: underfunded" if not). Any surplus above `requestedAmount` is silently discarded
   * in the simulation (the contract refunds it; in-memory mode there is no ETH to refund).
   * `escrowAmount` is set to `requestedAmount`.
   *
   * Default: `requestedAmount` (exact required amount). Pass a lower value explicitly to
   * test the "escrow: underfunded" rejection path. Old callers that omit this parameter
   * are backward-compatible — they implicitly deposit exactly the required amount.
   */
  async insurerEngage(reqId: bigint, policyHash: string, policyUri: string, depositAmount?: bigint): Promise<void> {
    const n = this.must(reqId);
    if (n.state !== State.Open) throw new Error("engage: not Open");
    this.onlyInsurer(n); // R11: insurer-only
    if (policyHash === ZERO_HASH) throw new Error("policy: empty");
    const effectiveDeposit = depositAmount ?? n.requestedAmount;
    if (effectiveDeposit < n.requestedAmount) throw new Error("escrow: underfunded");

    n.policyHash = policyHash;
    n.policyUri = policyUri;
    n.escrowAmount = n.requestedAmount;
    n.state = State.Ready;

    this.emit({ name: "InsurerEngaged", reqId, policyHash, policyUri });
    this.emit({ name: "ContractReady", reqId });
  }

  async requestAdjudication(reqId: bigint): Promise<void> {
    const n = this.must(reqId);
    if (n.state !== State.Ready) throw new Error("adjudicate: not Ready");
    this.onlyParty(n); // R11: either party may adjudicate
    n.round = 1n;
    this.emit({ name: "AdjudicationRequested", reqId });
    this.fireAgent(reqId, n);
  }

  async submitEvidence(reqId: bigint, newEvidenceUrl: string): Promise<void> {
    const n = this.must(reqId);
    if (n.state !== State.EvidenceRequested) throw new Error("evidence: wrong state");
    this.onlyProvider(n); // R11: provider-only
    // A0009: a new public evidence URL the re-scrape targets (1..512 bytes).
    if (newEvidenceUrl.length === 0 || newEvidenceUrl.length > 512)
      throw new Error("evidence: url required");

    // A0008 §3 / contract parity: at the round cap the submission deadlocks instead of
    // re-firing (mirrors CoverageNegotiation.sol L502-521). CEI order: state + escrow
    // zeroed before emitting, matching the Solidity commit-before-transfer pattern.
    if (n.round >= this.maxRounds) {
      this.clearRequest(n);
      n.state = State.Deadlocked;
      n.escrowAmount = 0n;
      this.emit({ name: "Deadlocked", reqId, rounds: n.round });
      return;
    }

    // A0009: repoint the scrape target at the new URL (parity with the contract).
    n.agentEvidenceUrl = newEvidenceUrl;
    n.evidenceUri = newEvidenceUrl;
    n.round += 1n;
    this.emit({ name: "EvidenceSubmitted", reqId, evidenceUri: newEvidenceUrl });
    this.fireAgent(reqId, n);
  }

  async appeal(
    reqId: bigint,
    partyId: bigint,
    newEvidenceUrl: string,
    reasonHash: string,
  ): Promise<void> {
    const n = this.must(reqId);
    // SPEC-0004 §2.4 R14a: only a Deny justifies advancing the ladder.
    if (n.state !== State.Denied) {
      throw new Error("appeal: prior ruling not Deny");
    }
    this.onlyParty(n); // R11: either party may appeal
    if (partyId !== n.providerId && partyId !== n.insurerId) {
      throw new Error("appeal: unknown party");
    }
    // A0009: an appeal supplies a new public evidence URL to re-scrape.
    if (newEvidenceUrl.length === 0 || newEvidenceUrl.length > 512)
      throw new Error("appeal: needs evidence");

    // Bounded to N rounds: at the cap an appeal deadlocks instead of re-firing (R6c).
    if (n.round >= this.maxRounds) {
      this.clearRequest(n);
      n.state = State.Deadlocked;
      n.escrowAmount = 0n; // A0008 §3: full escrow refunded to insurer (in-memory: just zero it)
      this.emit({ name: "Deadlocked", reqId, rounds: n.round });
      return;
    }

    // A0009: re-scrape the new URL (parity with the contract).
    n.agentEvidenceUrl = newEvidenceUrl;
    n.evidenceUri = newEvidenceUrl;
    n.rationaleHash = reasonHash;
    n.round += 1n;
    n.appealRound += 1;
    this.emit({ name: "Appealed", reqId, partyId, evidenceUri: newEvidenceUrl, round: n.round });
    this.fireAgent(reqId, n);
  }

  async accept(reqId: bigint, partyId: bigint): Promise<void> {
    const n = this.must(reqId);
    if (n.state !== State.Approved && n.state !== State.Denied) {
      throw new Error("accept: not ruled");
    }
    this.onlyParty(n); // R11: either party may accept
    if (partyId === n.providerId) {
      n.providerAccepted = true;
    } else if (partyId === n.insurerId) {
      n.insurerAccepted = true;
    } else {
      throw new Error("accept: unknown party");
    }
    this.emit({ name: "Accepted", reqId, partyId });
  }

  async settle(reqId: bigint): Promise<void> {
    const n = this.must(reqId);
    if (n.state !== State.Approved && n.state !== State.Denied) {
      throw new Error("settle: not ruled");
    }
    this.onlyParty(n); // R11: either party may settle
    if (!n.providerAccepted || !n.insurerAccepted) throw new Error("settle: not both accepted");

    // A0008 §2: compute the refund to insurer = escrow − coveredAmount.
    const escrow = n.escrowAmount;
    const covered = n.coveredAmount;
    const refundedToInsurer = escrow - covered;

    // CEI parity: zero escrowAmount before emitting (mirrors on-chain commit-before-transfer).
    this.clearRequest(n);
    n.state = State.Settled;
    n.escrowAmount = 0n;

    this.emit({ name: "Settled", reqId, coveredAmount: covered, refundedToInsurer });
  }

  async refuse(reqId: bigint, reasonHash: string): Promise<void> {
    const n = this.must(reqId);
    this.onlyProvider(n); // R11: provider-only (matches contract check order)
    if (!this.refusable(n.state)) throw new Error("refuse: not refusable");
    this.clearRequest(n);
    n.state = State.ProviderRefused;
    n.escrowAmount = 0n; // A0008 §3: full escrow refunded to insurer (in-memory: just zero it)
    this.emit({ name: "ProviderRefused", reqId, reasonHash });
  }

  async withdraw(reqId: bigint): Promise<void> {
    const n = this.must(reqId);
    this.onlyParty(n); // R11: either party may withdraw
    if (TERMINAL_STATES.has(n.state)) throw new Error("withdraw: terminal");
    this.clearRequest(n);
    n.state = State.Withdrawn;
    n.escrowAmount = 0n; // A0008 §3: full escrow refunded to insurer (in-memory: just zero it)
    this.emit({ name: "Withdrawn", reqId });
  }

  /**
   * Keeper-style timeout: route a stuck `UnderReview` to retriable
   * `EvidenceRequested` (mirrors `onRulingTimeout`). Skips the deadline check so
   * tests can force it; the real contract enforces the deadline.
   */
  async onRulingTimeout(reqId: bigint): Promise<void> {
    const n = this.must(reqId);
    if (n.state !== State.UnderReview) throw new Error("timeout: not UnderReview");
    const requestId = n.pendingRequestId;
    this.clearRequest(n);
    n.state = State.EvidenceRequested;
    this.emit({ name: "RulingTimedOut", reqId, requestId });
    this.emit({ name: "EvidenceRequested", reqId });
  }

  async postFeedback(reqId: bigint, msgHash: string, uri: string): Promise<void> {
    const n = this.must(reqId);
    this.onlyParty(n); // R11: either party may post feedback
    if (TERMINAL_STATES.has(n.state)) throw new Error("feedback: terminal");
    this.emit({ name: "FeedbackPosted", reqId, msgHash, uri });
  }

  /**
   * Keeper commits the receipt-sourced rationale for a finalized ruling
   * (SPEC-0006 R25/R26). Mirrors `CoverageNegotiation.sol:commitRationale`:
   * - Requires `hasRuling` (reverts on NeedMoreEvidence outcomes, matching chain).
   * - Truncates rationale to MAX_RATIONALE_BYTES (4096) bytes + "…" U+2026 sentinel
   *   when longer (mirrors `_truncateRationale` in Solidity L1053-1067, R26).
   * - Stores keccak256 of the TRUNCATED string (not the raw input) so the hash
   *   matches the on-chain value for inputs > 4096 bytes.
   * - Emits `RulingRationale` with the truncated rationale.
   * In simulation mode the owner check is skipped (no wallet concept), but the
   * `hasRuling` guard is enforced so simulated tests catch the pre-ruling misuse.
   */
  async commitRationale(
    reqId: bigint,
    rationale: string,
    clauseReference: string,
    standardReference: string,
  ): Promise<void> {
    const n = this.must(reqId);
    if (!n.hasRuling) throw new Error("rationale: no ruling yet");

    // Truncate rationale to MAX_RATIONALE_BYTES (4096) bytes + "…" sentinel (R26).
    // Mirrors CoverageNegotiation.sol:_truncateRationale (L1053-1067). We work in
    // RAW BYTES, not a re-encoded string: the contract hashes over the truncated
    // byte array, and for an input whose 4096-byte boundary splits a multi-byte
    // codepoint, decoding-then-re-encoding would corrupt the boundary byte to
    // U+FFFD and diverge the hash. So hash over the bytes; decode only for display.
    const truncatedBytes = SimulatedBackend.truncateRationaleBytes(rationale);
    const truncated = new TextDecoder().decode(truncatedBytes);

    // Store keccak256 of the TRUNCATED BYTES (byte-identical to on-chain
    // keccak256(bytes(_truncateRationale(rationale))) for any input length).
    n.rationaleHash = ethers.keccak256(truncatedBytes);
    n.clauseRef = ethers.keccak256(ethers.toUtf8Bytes(clauseReference));
    n.standardRef = ethers.keccak256(ethers.toUtf8Bytes(standardReference));

    // pendingRequestId is always 0 here: clearRequest zeros it before any ruling
    // delivery, and commitRationale is only callable after hasRuling is set (which
    // requires a ruling, which requires clearRequest to have run). Recover the
    // requestId from the most recent Ruled event instead.
    this.emit({
      name: "RulingRationale",
      reqId,
      requestId: this.lastRulingRequestId(reqId),
      decision: n.lastDecision,
      rationale: truncated,
      clauseReference,
      standardReference,
    });
  }

  /**
   * Byte-level mirror of `CoverageNegotiation.sol:_truncateRationale` (L1053-1067).
   * Returns the RAW truncated bytes: the first MAX_RATIONALE_BYTES (4096) UTF-8
   * bytes of `s`, plus the 3-byte ellipsis sentinel (U+2026 = E2 80 A6) when
   * truncation occurs. This is the authoritative form — `keccak256` over these
   * bytes equals the on-chain `rationaleHash` even when the 4096-byte boundary
   * splits a multi-byte codepoint (where a decode→re-encode round-trip would
   * corrupt the boundary to U+FFFD and diverge the hash).
   */
  static truncateRationaleBytes(s: string): Uint8Array {
    const MAX_BYTES = 4096;
    const encoded = new TextEncoder().encode(s);
    if (encoded.length <= MAX_BYTES) return encoded;
    const result = new Uint8Array(MAX_BYTES + 3);
    result.set(encoded.subarray(0, MAX_BYTES));
    result.set([0xe2, 0x80, 0xa6], MAX_BYTES); // U+2026 HORIZONTAL ELLIPSIS
    return result;
  }

  /**
   * Display form of {@link truncateRationaleBytes}: decodes the truncated bytes
   * to a string (a split trailing codepoint renders as U+FFFD — identical to how
   * any UTF-8 consumer renders the contract's raw-byte `RulingRationale.rationale`
   * field). Use {@link truncateRationaleBytes} for hashing, this for display.
   */
  static truncateRationale(s: string): string {
    return new TextDecoder().decode(SimulatedBackend.truncateRationaleBytes(s));
  }

  /**
   * Recover the requestId from the most recent `Ruled` event for `reqId`.
   * Used by `commitRationale` after `pendingRequestId` has been cleared
   * (clearRequest zeros it at ruling delivery).
   */
  private lastRulingRequestId(reqId: bigint): bigint {
    for (let i = this.history.length - 1; i >= 0; i--) {
      const e = this.history[i];
      if (e && e.reqId === reqId && e.name === "Ruled") {
        return (e as { name: "Ruled"; requestId: bigint }).requestId;
      }
    }
    return 0n;
  }

  // ---------------------------------------------------------------------
  // Reads (mirror Solidity views)
  // ---------------------------------------------------------------------

  async getNegotiation(reqId: bigint): Promise<Negotiation> {
    return this.snapshot(this.must(reqId));
  }

  async getNegotiationView(reqId: bigint): Promise<NegotiationView> {
    return this.toView(reqId, this.must(reqId));
  }

  async stateOf(reqId: bigint): Promise<State> {
    return this.must(reqId).state;
  }

  async coveredAmountOf(reqId: bigint): Promise<bigint> {
    return this.must(reqId).coveredAmount;
  }

  async priceBasisOf(reqId: bigint): Promise<PriceBasis> {
    const n = this.must(reqId);
    return {
      requestedAmount: n.requestedAmount,
      quantity: n.quantity,
      costPlusTotal: n.costPlusUnitPrice * n.quantity,
      nadacFloorTotal: n.nadacUnitPrice * n.quantity,
      coveredAmount: n.coveredAmount,
    };
  }

  async roundOf(reqId: bigint): Promise<bigint> {
    return this.must(reqId).round;
  }

  async policyOf(reqId: bigint): Promise<PolicyCommitment> {
    const n = this.must(reqId);
    return { policyHash: n.policyHash, policyUri: n.policyUri };
  }

  async count(): Promise<bigint> {
    return this.nextId - 1n;
  }

  // ---------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------

  async getEvents(
    filter: EventFilter = {},
    onBatch?: (batch: CoverageEvent[]) => void,
  ): Promise<CoverageEvent[]> {
    // The recorded log IS the simulated chain history (no blocks to scan).
    const all =
      filter.reqId === undefined
        ? this.history
        : this.history.filter((e) => e.reqId === filter.reqId);
    const copy = all.map((e) => ({ ...e }));
    // No paging in memory: deliver the whole history as a single batch so the
    // progressive-consumer code path behaves identically against either backend.
    if (onBatch && copy.length > 0) onBatch(copy);
    return copy;
  }

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
  // Mocked arbiter + internals
  // ---------------------------------------------------------------------

  /**
   * Deliver a ruling for an in-flight request, mimicking the platform calling
   * `handleResponse`. If `decision` is omitted, uses the configured arbiter.
   * Available for tests / manual control even when auto-resolve is on.
   */
  resolve(reqId: bigint, decision?: Decision): void {
    const n = this.negotiations.get(reqId);
    if (!n || n.state !== State.UnderReview) return;
    const d = decision ?? this.computeDecision(n, reqId);
    this.deliverRuling(reqId, n, d);
  }

  /** Fire the mocked arbiter: move to UnderReview, schedule/await the callback. */
  private fireAgent(reqId: bigint, n: SimNegotiation): void {
    const requestId = this.nextRequestId++;
    // Fee is mocked (no funds in simulated mode); accumulate a nominal 0 (R8).
    const fee = 0n;
    n.totalFees += fee;
    n.pendingRequestId = requestId;
    n.rulingDeadline = BigInt(Math.floor(Date.now() / 1000)) + 3600n;
    n.state = State.UnderReview;
    this.requestToReq.set(requestId, reqId);

    // SPEC-0004 §3.5: PacketSubmitted before RulingRequested mirrors the on-chain
    // ordering (event emitted inside `_fireAgent` before `platform.createRequest`).
    // packetRoot + packetUrl both carry evidenceUri until UNIT-9 wires the Merkle
    // root + body-store URL.
    this.emit({
      name: "PacketSubmitted",
      reqId,
      round: n.round,
      packetRoot: n.evidenceUri,
      packetUrl: n.evidenceUri,
    });
    this.emit({ name: "RulingRequested", reqId, requestId, fee });

    if (this.agent.autoResolve ?? true) {
      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        this.resolve(reqId);
      }, this.agent.autoResolveMs ?? 0);
      // Do not keep the event loop alive solely for a mocked ruling.
      if (typeof timer.unref === "function") timer.unref();
      this.pendingTimers.add(timer);
    }
  }

  private computeDecision(n: SimNegotiation, reqId: bigint): Decision {
    const cfg = this.agent.decision ?? Decision.Approve;
    return typeof cfg === "function" ? cfg(this.snapshot(n), reqId) : cfg;
  }

  /**
   * The Cost Plus per-unit price the arbiter looks up. Default: a per-unit price
   * that makes the cap non-binding — `ceil(requestedAmount / quantity)` — so
   * `coveredAmount === requestedAmount` unless overridden.
   */
  private computeCostPlusUnitPrice(n: SimNegotiation, reqId: bigint): bigint {
    const cfg =
      this.agent.costPlusUnitPrice ??
      (n.quantity > 0n ? (n.requestedAmount + n.quantity - 1n) / n.quantity : n.requestedAmount);
    return typeof cfg === "function" ? cfg(this.snapshot(n), reqId) : cfg;
  }

  /** The NADAC per-unit floor reference the arbiter looks up. Default: 0. */
  private computeNadacUnitPrice(n: SimNegotiation, reqId: bigint): bigint {
    const cfg = this.agent.nadacUnitPrice ?? 0n;
    return typeof cfg === "function" ? cfg(this.snapshot(n), reqId) : cfg;
  }

  /** Mirror of the contract's `handleResponse` decision routing (R6/R6a/R6b). */
  private deliverRuling(reqId: bigint, n: SimNegotiation, decision: Decision): void {
    const requestId = n.pendingRequestId;
    this.clearRequest(n);

    const rationaleHash = this.agent.rationaleHash ?? ethers.id("rationale");
    const clauseRef = this.agent.clauseRef ?? ethers.id("clause");
    const standardRef = this.agent.standardRef ?? ethers.id("standard");
    const receiptId = this.agent.receiptId ?? requestId;

    n.lastDecision = decision;
    // hasRuling is set ONLY for terminal/ruled decisions (mirrors Solidity
    // _handleDecideResponse L894-903: NeedMoreEvidence returns before setting hasRuling).
    // commitRationale guards on hasRuling, so after a NeedMoreEvidence outcome the
    // sim must REJECT commitRationale, matching the chain behaviour.
    n.hasRuling = decision !== Decision.NeedMoreEvidence;
    n.rationaleHash = rationaleHash;
    n.clauseRef = clauseRef;
    n.standardRef = standardRef;
    // A fresh ruling stores the per-unit prices the arbiter looked up: Cost Plus
    // (the cap basis) and NADAC (the floor reference) (R6a/R10).
    n.costPlusUnitPrice = this.computeCostPlusUnitPrice(n, reqId);
    n.nadacUnitPrice = this.computeNadacUnitPrice(n, reqId);
    // A fresh ruling resets prior acceptances — parties accept THIS ruling.
    n.providerAccepted = false;
    n.insurerAccepted = false;

    // SPEC-0004 §3.5 R23: consume the next one-shot policyVoidedClauseIndices if set,
    // otherwise fall back to the agent config, then [].
    let policyVoidedClauseIndices: number[];
    if (_nextPolicyVoidedClauseIndices.length > 0) {
      policyVoidedClauseIndices = _nextPolicyVoidedClauseIndices;
      _nextPolicyVoidedClauseIndices = [];
    } else {
      policyVoidedClauseIndices = this.agent.policyVoidedClauseIndices ?? [];
    }

    // SPEC-0004 §3.5 R11: consume the next one-shot usedReferenceIndices if set,
    // otherwise fall back to the agent config, then [].
    let usedReferenceIndices: number[];
    if (_nextUsedReferenceIndices.length > 0) {
      usedReferenceIndices = _nextUsedReferenceIndices;
      _nextUsedReferenceIndices = [];
    } else {
      usedReferenceIndices = this.agent.usedReferenceIndices ?? [];
    }

    // SPEC-0004 §3.5 R11: consume the next one-shot usedLeafHashes if set,
    // otherwise fall back to the agent config, then [].
    let usedLeafHashes: `0x${string}`[];
    if (_nextUsedLeafHashes.length > 0) {
      usedLeafHashes = _nextUsedLeafHashes;
      _nextUsedLeafHashes = [];
    } else {
      usedLeafHashes = this.agent.usedLeafHashes ?? [];
    }

    if (decision === Decision.PolicyInvalid) {
      // R6b: a relied-on clause contradicts a public standard — void the contract.
      // SPEC-0006 R24: emit 4-arg Ruled (no PolicyFlagged — removed from contract).
      n.coveredAmount = 0n;
      n.state = State.PolicyInvalidated;
      n.escrowAmount = 0n; // A0008 §3: full escrow refunded to insurer (in-memory: just zero it)
      this.emit({ name: "Ruled", reqId, requestId, decision, coveredAmount: 0n });
      this.emit({ name: "PolicyInvalidated", reqId, clauseRef, standardRef });
      return;
    }

    if (decision === Decision.Approve) {
      // SPEC-0006 R24: on approve, coveredAmount = requestedAmount (no AI price cap).
      const covered = n.requestedAmount;
      n.coveredAmount = covered;
      n.state = State.Approved;
      this.emit({ name: "Ruled", reqId, requestId, decision, coveredAmount: covered });
    } else if (decision === Decision.Deny) {
      n.coveredAmount = 0n;
      n.state = State.Denied;
      this.emit({ name: "Ruled", reqId, requestId, decision, coveredAmount: 0n });
    } else {
      // NeedMoreEvidence
      n.state = State.EvidenceRequested;
      this.emit({ name: "EvidenceRequested", reqId });
    }
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

  /** True when the active address satisfies a gate against `expected` (wildcard always passes). */
  private is(expected: string): boolean {
    if (this.caller === ANY_CALLER) return true;
    return this.caller === expected.toLowerCase();
  }

  /** Mirror of `_onlyParty`: caller ∈ {providerAddr, insurerAddr} (R11), else "auth: not a party". */
  private onlyParty(n: SimNegotiation): void {
    if (this.is(n.providerAddr) || this.is(n.insurerAddr)) return;
    throw new Error("auth: not a party");
  }

  /** Gate to the insurer wallet (R11) — matches the contract's "auth: not insurer". */
  private onlyInsurer(n: SimNegotiation): void {
    if (!this.is(n.insurerAddr)) throw new Error("auth: not insurer");
  }

  /** Gate to the provider wallet (R11) — matches the contract's "auth: not provider". */
  private onlyProvider(n: SimNegotiation): void {
    if (!this.is(n.providerAddr)) throw new Error("auth: not provider");
  }

  /** Mirror of the contract's `_refusable`: `Ready` onward while pre-terminal (R7). */
  private refusable(s: State): boolean {
    if (s === State.Open) return false;
    return !TERMINAL_STATES.has(s);
  }

  private snapshot(n: SimNegotiation): Negotiation {
    return {
      providerId: n.providerId,
      insurerId: n.insurerId,
      providerAddr: n.providerAddr,
      insurerAddr: n.insurerAddr,
      drugRef: n.drugRef,
      requestedAmount: n.requestedAmount,
      quantity: n.quantity,
      daysSupply: n.daysSupply,
      justificationHash: n.justificationHash,
      evidenceUri: n.evidenceUri,
      policyHash: n.policyHash,
      policyUri: n.policyUri,
      coveredAmount: n.coveredAmount,
      escrowAmount: n.escrowAmount,
      costPlusUnitPrice: n.costPlusUnitPrice,
      nadacUnitPrice: n.nadacUnitPrice,
      rationaleHash: n.rationaleHash,
      clauseRef: n.clauseRef,
      standardRef: n.standardRef,
      lastDecision: n.lastDecision,
      hasRuling: n.hasRuling,
      round: n.round,
      payerLine: n.payerLine,
      appealRound: n.appealRound,
      providerAccepted: n.providerAccepted,
      insurerAccepted: n.insurerAccepted,
      totalFees: n.totalFees,
      state: n.state,
      pendingRequestId: n.pendingRequestId,
      createdAt: n.createdAt,
      rulingDeadline: n.rulingDeadline,
      exists: n.exists,
      agentEvidenceUrl: n.agentEvidenceUrl,
      agentPromptHint: n.agentPromptHint,
      agentPhase: n.agentPhase,
      pendingDecideFee: n.pendingDecideFee,
      pendingFeePayer: n.pendingFeePayer,
    };
  }

  private toView(reqId: bigint, n: SimNegotiation): NegotiationView {
    const ruled = n.state === State.Approved || n.state === State.Denied;
    return {
      reqId,
      negotiation: this.snapshot(n),
      state: n.state,
      stateName: STATE_NAMES[n.state],
      policyAttached: n.state >= State.Ready && n.policyHash !== ZERO_HASH,
      adjudicable: n.state === State.Ready,
      ruled,
      bothAccepted: n.providerAccepted && n.insurerAccepted,
      terminal: TERMINAL_STATES.has(n.state),
    };
  }

  private emit(event: CoverageEvent): void {
    this.history.push(event);
    for (const l of this.listeners) l(event);
  }
}
