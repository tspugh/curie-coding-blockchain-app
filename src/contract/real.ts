/**
 * RealBackend — ethers v6 binding to the deployed `CoverageNegotiation` contract
 * on Somnia testnet (SPEC-0001 R11/R14, revised 2026-05-27 — AI necessity-arbiter
 * model). Reads go through the provider, writes are signed by the
 * {@link RealWallet}'s signer, and events come from provider log filters (R16).
 * It implements the SAME {@link CoverageNegotiationClient} as the simulated
 * backend so the calling code path is identical across modes.
 *
 * NOTE on the agent fee (R9): the writes that fire the native arbiter
 * (`requestAdjudication` / `submitEvidence` / `appeal`) are `payable`. A real
 * ruling requires the contract to be funded so it can forward the per-request
 * deposit; this client sends the tx and the platform later calls `handleResponse`
 * back into the contract, surfaced here as a `Ruled` event via the subscription.
 */
import { ethers } from "ethers";

import {
  type CoverageEvent,
  type CoverageEventListener,
  type CoverageEventName,
  type Decision,
  type Negotiation,
  type NegotiationView,
  PayerLine,
  State,
  STATE_NAMES,
  TERMINAL_STATES,
  type Unsubscribe,
} from "../types/coverage.types.js";
import type { RealWallet } from "../wallet/wallet.js";
import { COVERAGE_NEGOTIATION_ABI } from "./abi.js";
import type {
  CoverageNegotiationClient,
  CreateContractParams,
  EventFilter,
  PolicyCommitment,
  PriceBasis,
} from "./types.js";

/** Options for {@link RealBackend}. */
export interface RealBackendOptions {
  /** Deployed contract address; falls back to `COVERAGE_CONTRACT_ADDRESS` env. */
  readonly contractAddress?: string;
  /**
   * Value (wei) to attach to agent-firing writes to fund the per-request fee
   * (R9). Defaults to 0 (assumes the contract is pre-funded).
   */
  readonly agentFeeValue?: bigint;
  /**
   * Block number at (or just before) the contract deployment. Used as the floor
   * for historical event scans. Somnia testnet RPC caps `eth_getLogs` to 1000
   * blocks per request; without a floor, `getEvents` falls back to scanning
   * `latest - DEFAULT_LOOKBACK_BLOCKS` so the dashboard always loads.
   */
  readonly deploymentBlock?: number;
}

/**
 * Default lookback window (blocks) when no `deploymentBlock` is configured.
 * Somnia testnet block time ≈ 1.3s, so 10_000 ≈ 3.5 hours — enough to render
 * the demo session's just-completed flow without overwhelming the RPC with
 * paged queries. Configure `VITE_DEPLOYMENT_BLOCK` for the full history.
 */
const DEFAULT_LOOKBACK_BLOCKS = 10_000;

/** Somnia testnet RPC's per-request `eth_getLogs` window cap. */
const LOG_PAGE_SIZE = 1_000;

/**
 * Raw `Negotiation` tuple returned by ethers — field order matches the Solidity
 * struct (and `abi.ts`) EXACTLY. 38 fields (added lastRequestId, agentEvidenceUrl,
 * agentPromptHint per SPEC-0006 R14/R15; added agentPhase, pendingDecideFee,
 * pendingFeePayer per Amendment 0007 phase 1).
 */
type RawNegotiation = readonly [
  bigint, // [0]  providerId
  bigint, // [1]  insurerId
  string, // [2]  providerAddr
  string, // [3]  insurerAddr
  string, // [4]  drugRef
  bigint, // [5]  requestedAmount
  bigint, // [6]  quantity
  bigint, // [7]  daysSupply
  string, // [8]  justificationHash
  string, // [9]  evidenceUri
  string, // [10] policyHash
  string, // [11] policyUri
  bigint, // [12] coveredAmount
  bigint, // [13] escrowAmount (ETH locked at insurerEngage — A0008)
  bigint, // [14] costPlusUnitPrice
  bigint, // [15] nadacUnitPrice
  string, // [16] rationaleHash
  string, // [17] clauseRef
  string, // [18] standardRef
  bigint | number, // [19] lastDecision (uint8)
  bigint, // [20] lastRequestId
  boolean, // [21] hasRuling
  string, // [22] agentEvidenceUrl
  string, // [23] agentPromptHint
  bigint, // [24] round
  bigint | number, // [25] payerLine (uint8)
  bigint | number, // [26] appealRound (uint8)
  boolean, // [27] providerAccepted
  boolean, // [28] insurerAccepted
  bigint, // [29] totalFees
  bigint | number, // [30] state (uint8)
  bigint, // [31] pendingRequestId
  bigint, // [32] createdAt
  bigint, // [33] rulingDeadline
  boolean, // [34] exists
  bigint | number, // [35] agentPhase (uint8, AgentPhase enum — Amendment 0007 phase 1)
  bigint, // [36] pendingDecideFee (parked LLM Inference fee for phase 2 — Amendment 0007)
  string, // [37] pendingFeePayer (address of the fee payer for the parked decide fee)
];

/**
 * Decode a raw 38-element `getNegotiation` tuple (as returned by ethers) into a
 * typed {@link Negotiation} object. Exported for unit-testing without a live chain
 * — callers may construct a synthetic tuple and verify the positional mapping.
 *
 * @internal test-seam — production code must go through {@link RealBackend.getNegotiation}.
 */
export function decodeNegotiationRaw(raw: readonly unknown[]): Negotiation {
  return {
    providerId: raw[0] as bigint,
    insurerId: raw[1] as bigint,
    providerAddr: raw[2] as string,
    insurerAddr: raw[3] as string,
    drugRef: raw[4] as string,
    requestedAmount: raw[5] as bigint,
    quantity: raw[6] as bigint,
    daysSupply: raw[7] as bigint,
    justificationHash: raw[8] as string,
    evidenceUri: raw[9] as string,
    policyHash: raw[10] as string,
    policyUri: raw[11] as string,
    coveredAmount: raw[12] as bigint,
    escrowAmount: raw[13] as bigint,
    costPlusUnitPrice: raw[14] as bigint,
    nadacUnitPrice: raw[15] as bigint,
    rationaleHash: raw[16] as string,
    clauseRef: raw[17] as string,
    standardRef: raw[18] as string,
    lastDecision: Number(raw[19]) as Decision,
    hasRuling: raw[21] as boolean,
    round: raw[24] as bigint,
    payerLine: Number(raw[25]) as PayerLine,
    appealRound: Number(raw[26]),
    providerAccepted: raw[27] as boolean,
    insurerAccepted: raw[28] as boolean,
    totalFees: raw[29] as bigint,
    state: Number(raw[30]) as State,
    pendingRequestId: raw[31] as bigint,
    createdAt: raw[32] as bigint,
    rulingDeadline: raw[33] as bigint,
    exists: raw[34] as boolean,
    agentEvidenceUrl: raw[22] as string,
    agentPromptHint: raw[23] as string,
    agentPhase: Number(raw[35]),
    pendingDecideFee: raw[36] as bigint,
    pendingFeePayer: raw[37] as string,
  };
}

/** Raw `priceBasisOf` tuple returned by ethers — matches the view's return order. */
type RawPriceBasis = readonly [
  bigint, // requestedAmount
  bigint, // quantity
  bigint, // costPlusTotal
  bigint, // nadacFloorTotal
  bigint, // coveredAmount
];

/** ethers tx overrides (value for payable agent-firing calls). */
type Overrides = { value?: bigint };

/**
 * Typed view of the `CoverageNegotiation` contract's methods. ethers' dynamic
 * `Contract` indexer types each method as possibly-`undefined` under strict TS;
 * declaring the exact callable surface here keeps the call sites clean and
 * checked. Writes return a `ContractTransactionResponse`; reads return decoded
 * values.
 */
interface CoverageContract extends ethers.BaseContract {
  createContract(
    providerId: bigint,
    insurerId: bigint,
    providerAddr: string,
    insurerAddr: string,
    drugRef: string,
    requestedAmount: bigint,
    quantity: bigint,
    daysSupply: bigint,
    justificationHash: string,
    evidenceUri: string,
    payerLine: number,
    agentEvidenceUrl: string,
    agentPromptHint: string,
  ): Promise<ethers.ContractTransactionResponse>;
  insurerEngage(reqId: bigint, policyHash: string, policyUri: string, overrides?: Overrides): Promise<ethers.ContractTransactionResponse>;
  requestAdjudication(reqId: bigint, overrides?: Overrides): Promise<ethers.ContractTransactionResponse>;
  submitEvidence(reqId: bigint, evidenceUri: string, overrides?: Overrides): Promise<ethers.ContractTransactionResponse>;
  appeal(
    reqId: bigint,
    partyId: bigint,
    evidenceUri: string,
    reasonHash: string,
    overrides?: Overrides,
  ): Promise<ethers.ContractTransactionResponse>;
  accept(reqId: bigint, partyId: bigint): Promise<ethers.ContractTransactionResponse>;
  settle(reqId: bigint): Promise<ethers.ContractTransactionResponse>;
  refuse(reqId: bigint, reasonHash: string): Promise<ethers.ContractTransactionResponse>;
  withdraw(reqId: bigint): Promise<ethers.ContractTransactionResponse>;
  onRulingTimeout(reqId: bigint): Promise<ethers.ContractTransactionResponse>;
  postFeedback(reqId: bigint, msgHash: string, uri: string): Promise<ethers.ContractTransactionResponse>;
  commitRationale(reqId: bigint, rationale: string, clauseReference: string, standardReference: string): Promise<ethers.ContractTransactionResponse>;
  getNegotiation(reqId: bigint): Promise<RawNegotiation>;
  stateOf(reqId: bigint): Promise<bigint | number>;
  coveredAmountOf(reqId: bigint): Promise<bigint>;
  priceBasisOf(reqId: bigint): Promise<RawPriceBasis>;
  roundOf(reqId: bigint): Promise<bigint>;
  policyOf(reqId: bigint): Promise<readonly [string, string]>;
  count(): Promise<bigint>;
}

/**
 * SPEC-0003 §2.2 R8. Shape dispatched on `txEvents` after each `tx.wait()`.
 * Strings are used for the bigint fields (`value`, `gasUsed`, `gasPrice`) so
 * the same shape can be serialized to the JSONL ledger via the dev-server
 * sink without JSON-stringify blowing up on bigints.
 */
export interface TxConfirmedDetail {
  method: string;
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gasUsed: string;
  gasPrice: string;
  blockNumber: number;
  ts: number;
}

export class RealBackend implements CoverageNegotiationClient {
  readonly mode = "real" as const;

  /**
   * SPEC-0003 §2.2 R8. Dispatches `tx-confirmed` (`CustomEvent<TxConfirmedDetail>`)
   * after every write method's `tx.wait()`. Subscribed to by the web client's
   * `txLogger` (POST → /__log/tx) and the in-UI TxMonitor.
   */
  readonly txEvents = new EventTarget();

  private readonly contract: CoverageContract & ethers.Contract;
  private readonly provider: ethers.Provider;
  private readonly agentFeeValue: bigint;
  private readonly deploymentBlock?: number;
  /** Maps a user listener to the ethers listeners we attached, for cleanup. */
  private readonly attached = new Map<
    CoverageEventListener,
    Array<{ event: string; fn: (...args: unknown[]) => void }>
  >();

  constructor(wallet: RealWallet, options: RealBackendOptions = {}) {
    const address = options.contractAddress ?? process.env.COVERAGE_CONTRACT_ADDRESS?.trim();
    if (!address) {
      throw new Error(
        "RealBackend requires a contract address (option contractAddress or COVERAGE_CONTRACT_ADDRESS env).",
      );
    }
    this.provider = wallet.provider;
    this.agentFeeValue = options.agentFeeValue ?? 0n;
    if (options.deploymentBlock !== undefined) this.deploymentBlock = options.deploymentBlock;
    // Bind with the signer so write methods are sendable; reads still work.
    this.contract = new ethers.Contract(
      address,
      COVERAGE_NEGOTIATION_ABI,
      wallet.signer,
    ) as CoverageContract & ethers.Contract;
  }

  // ---------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------

  /**
   * SPEC-0003 §2.2 R8. Awaits the tx, then the receipt, dispatches a
   * `tx-confirmed` event carrying the gas + value + hash for the UI / dev
   * ledger, and returns the receipt for callers that need it (e.g.
   * `createContract` reads the `ContractCreated` event off it).
   */
  private async _send(
    method: string,
    value: bigint,
    txPromise: Promise<ethers.ContractTransactionResponse>,
  ): Promise<ethers.ContractTransactionReceipt | null> {
    const tx = await txPromise;
    const receipt = await tx.wait();
    if (receipt) {
      const detail: TxConfirmedDetail = {
        method,
        hash: receipt.hash,
        from: receipt.from,
        to: receipt.to,
        value: value.toString(),
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice.toString(),
        blockNumber: receipt.blockNumber,
        ts: Date.now(),
      };
      this.txEvents.dispatchEvent(new CustomEvent("tx-confirmed", { detail }));
    }
    return receipt;
  }

  async createContract(params: CreateContractParams): Promise<bigint> {
    const receipt = await this._send(
      "createContract",
      0n,
      this.contract.createContract(
        params.providerId,
        params.insurerId,
        params.providerAddr,
        params.insurerAddr,
        params.drugRef,
        params.requestedAmount,
        params.quantity,
        params.daysSupply,
        params.justificationHash,
        params.evidenceUri,
        params.payerLine,
        params.agentEvidenceUrl,
        params.agentPromptHint,
      ),
    );
    // Recover reqId from the ContractCreated event (return values aren't
    // available from a mined tx; the event's first topic carries reqId).
    const reqId = receipt ? this.extractReqIdFromReceipt(receipt) : undefined;
    if (reqId === undefined) {
      // Fall back to count() if the event couldn't be parsed.
      return this.count();
    }
    return reqId;
  }

  async insurerEngage(reqId: bigint, policyHash: string, policyUri: string, depositAmount?: bigint): Promise<void> {
    // A0008: default to requestedAmount (exact required escrow) when caller omits depositAmount,
    // matching the SimulatedBackend default (depositAmount ?? n.requestedAmount). This ensures
    // both backends behave identically when depositAmount is omitted.
    const value = depositAmount ?? (await this.getNegotiation(reqId)).requestedAmount;
    await this._send(
      "insurerEngage",
      value,
      this.contract.insurerEngage(reqId, policyHash, policyUri, { value }),
    );
  }

  async requestAdjudication(reqId: bigint): Promise<void> {
    await this._send(
      "requestAdjudication",
      this.agentFeeValue,
      this.contract.requestAdjudication(reqId, { value: this.agentFeeValue }),
    );
  }

  async submitEvidence(reqId: bigint, evidenceUri: string): Promise<void> {
    await this._send(
      "submitEvidence",
      this.agentFeeValue,
      this.contract.submitEvidence(reqId, evidenceUri, { value: this.agentFeeValue }),
    );
  }

  async appeal(
    reqId: bigint,
    partyId: bigint,
    evidenceUri: string,
    reasonHash: string,
  ): Promise<void> {
    await this._send(
      "appeal",
      this.agentFeeValue,
      this.contract.appeal(reqId, partyId, evidenceUri, reasonHash, {
        value: this.agentFeeValue,
      }),
    );
  }

  async accept(reqId: bigint, partyId: bigint): Promise<void> {
    await this._send("accept", 0n, this.contract.accept(reqId, partyId));
  }

  async settle(reqId: bigint): Promise<void> {
    await this._send("settle", 0n, this.contract.settle(reqId));
  }

  async refuse(reqId: bigint, reasonHash: string): Promise<void> {
    await this._send("refuse", 0n, this.contract.refuse(reqId, reasonHash));
  }

  async withdraw(reqId: bigint): Promise<void> {
    await this._send("withdraw", 0n, this.contract.withdraw(reqId));
  }

  async onRulingTimeout(reqId: bigint): Promise<void> {
    await this._send("onRulingTimeout", 0n, this.contract.onRulingTimeout(reqId));
  }

  async postFeedback(reqId: bigint, msgHash: string, uri: string): Promise<void> {
    await this._send("postFeedback", 0n, this.contract.postFeedback(reqId, msgHash, uri));
  }

  async commitRationale(
    reqId: bigint,
    rationale: string,
    clauseReference: string,
    standardReference: string,
  ): Promise<void> {
    await this._send(
      "commitRationale",
      0n,
      this.contract.commitRationale(reqId, rationale, clauseReference, standardReference),
    );
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  async getNegotiation(reqId: bigint): Promise<Negotiation> {
    const raw = (await this.contract.getNegotiation(reqId)) as RawNegotiation;
    return this.decodeNegotiation(raw);
  }

  async getNegotiationView(reqId: bigint): Promise<NegotiationView> {
    const n = await this.getNegotiation(reqId);
    const ruled = n.state === State.Approved || n.state === State.Denied;
    return {
      reqId,
      negotiation: n,
      state: n.state,
      stateName: STATE_NAMES[n.state],
      policyAttached: n.state >= State.Ready && n.policyHash !== ethers.ZeroHash,
      adjudicable: n.state === State.Ready,
      ruled,
      bothAccepted: n.providerAccepted && n.insurerAccepted,
      terminal: TERMINAL_STATES.has(n.state),
    };
  }

  async stateOf(reqId: bigint): Promise<State> {
    const raw = (await this.contract.stateOf(reqId)) as bigint | number;
    return Number(raw) as State;
  }

  async coveredAmountOf(reqId: bigint): Promise<bigint> {
    return (await this.contract.coveredAmountOf(reqId)) as bigint;
  }

  async priceBasisOf(reqId: bigint): Promise<PriceBasis> {
    const [requestedAmount, quantity, costPlusTotal, nadacFloorTotal, coveredAmount] =
      (await this.contract.priceBasisOf(reqId)) as RawPriceBasis;
    return { requestedAmount, quantity, costPlusTotal, nadacFloorTotal, coveredAmount };
  }

  async roundOf(reqId: bigint): Promise<bigint> {
    return (await this.contract.roundOf(reqId)) as bigint;
  }

  async policyOf(reqId: bigint): Promise<PolicyCommitment> {
    const [policyHash, policyUri] = (await this.contract.policyOf(reqId)) as readonly [string, string];
    return { policyHash, policyUri };
  }

  async count(): Promise<bigint> {
    return (await this.contract.count()) as bigint;
  }

  // ---------------------------------------------------------------------
  // Events (provider log subscriptions — R16)
  // ---------------------------------------------------------------------

  /** Every event name the contract emits — the set scanned by getEvents/subscribe. */
  private static readonly EVENT_NAMES: readonly CoverageEventName[] = [
    "ContractCreated",
    "ContentCommitted",
    "InsurerEngaged",
    "ContractReady",
    "AdjudicationRequested",
    "PacketSubmitted",
    "RulingRequested",
    "Ruled",
    "RulingRationale",
    "PolicyInvalidated",
    "EvidenceRequested",
    "EvidenceSubmitted",
    "Appealed",
    "Accepted",
    "Settled",
    "Deadlocked",
    "ProviderRefused",
    "Withdrawn",
    "RulingTimedOut",
    "FeedbackPosted",
  ];

  async getEvents(filter: EventFilter = {}): Promise<CoverageEvent[]> {
    // Resolve absolute block bounds. Somnia testnet RPC caps `eth_getLogs` to
    // 1000 blocks per request — so unbounded "fromBlock: 0" calls revert with
    // "block range exceeds 1000" and the dashboard stays empty (the
    // diagnostic that drove this fix). Page the range in `LOG_PAGE_SIZE`
    // chunks, floored at `deploymentBlock` (or `latest - DEFAULT_LOOKBACK_BLOCKS`
    // when the deploy block isn't configured). For efficiency we do ONE
    // `eth_getLogs` per page against the whole contract address and decode each
    // log against the event registry, rather than 20 calls per page (one per
    // event name); that keeps a fresh-page load to ~LOOKBACK / 1000 RPC calls
    // (≈10 for the default lookback).
    const latest = await this.provider.getBlockNumber();
    const toAbs = filter.toBlock ?? latest;
    const floor =
      this.deploymentBlock ?? Math.max(0, latest - DEFAULT_LOOKBACK_BLOCKS);
    const fromAbs = filter.fromBlock ?? floor;
    const reqIdTopic =
      filter.reqId !== undefined
        ? ethers.zeroPadValue(ethers.toBeHex(filter.reqId), 32)
        : null;

    const iface = this.contract.interface;
    const contractAddr = await this.contract.getAddress();
    const eventSet = new Set<string>(RealBackend.EVENT_NAMES);

    const collected: Array<{ ev: CoverageEvent; block: number; index: number }> = [];

    // Build the page ranges, then fetch them in BOUNDED-PARALLEL batches.
    // Somnia testnet produces ~10 blocks/sec, so a day-old deploymentBlock is
    // ~900k blocks = ~900 `eth_getLogs` pages. Sequential paging takes ~160s
    // (the timeline shows "No events yet" for minutes); batched-parallel paging
    // cuts a full hydration to ~25s while staying within the RPC's tolerance
    // (verified: concurrency 24–40 over 900 pages returns 0 page errors).
    const ranges: Array<[number, number]> = [];
    for (let start = fromAbs; start <= toAbs; start += LOG_PAGE_SIZE) {
      ranges.push([start, Math.min(start + LOG_PAGE_SIZE - 1, toAbs)]);
    }
    const PAGE_CONCURRENCY = 24;
    for (let i = 0; i < ranges.length; i += PAGE_CONCURRENCY) {
      const batch = ranges.slice(i, i + PAGE_CONCURRENCY);
      const pageResults = await Promise.all(
        batch.map(([start, end]) =>
          this.provider
            .getLogs({
              address: contractAddr,
              fromBlock: start,
              toBlock: end,
              // Every event in EVENT_NAMES has `reqId` as the first indexed
              // topic, so topics[1] == reqId-padded-bytes32 when a single
              // negotiation is asked for. `topics[0]` (signature) stays open —
              // we filter by name below.
              ...(reqIdTopic !== null ? { topics: [null, reqIdTopic] } : {}),
            })
            // Tolerate a transient single-page failure rather than abort the
            // whole hydration; a missed page just omits a few events until the
            // next refresh.
            .catch(() => [] as ethers.Log[]),
        ),
      );
      for (const logs of pageResults) {
        for (const log of logs) {
          let parsed: ethers.LogDescription | null;
          try {
            parsed = iface.parseLog(log);
          } catch {
            continue;
          }
          if (!parsed || !eventSet.has(parsed.name)) continue;
          const name = parsed.name as CoverageEventName;
          collected.push({
            ev: this.buildEvent(name, [...parsed.args], {
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
            }),
            block: log.blockNumber,
            index: log.index,
          });
        }
      }
    }
    // Chronological order: block, then log index within a block.
    collected.sort((a, b) => a.block - b.block || a.index - b.index);
    return collected.map((c) => c.ev);
  }

  subscribe(listener: CoverageEventListener): Unsubscribe {
    const handlers: Array<{ event: string; fn: (...args: unknown[]) => void }> = [];

    for (const name of RealBackend.EVENT_NAMES) {
      const fn = (...args: unknown[]): void => {
        // ethers passes a ContractEventPayload (with `.log`) as the final arg;
        // older shapes pass the EventLog directly. Handle both.
        const last = args[args.length - 1] as { log?: ethers.EventLog } & ethers.EventLog;
        const log = (last?.log ?? last) as ethers.EventLog;
        listener(
          this.buildEvent(name, args.slice(0, -1), {
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
          }),
        );
      };
      void this.contract.on(name, fn);
      handlers.push({ event: name, fn });
    }

    this.attached.set(listener, handlers);
    return () => {
      for (const h of handlers) void this.contract.off(h.event, h.fn);
      this.attached.delete(listener);
    };
  }

  /** Decode a contract event's positional args into a typed {@link CoverageEvent}. */
  private buildEvent(
    name: CoverageEventName,
    a: readonly unknown[],
    meta: { txHash: string; blockNumber: number },
  ): CoverageEvent {
    const reqId = a[0] as bigint;
    switch (name) {
      case "ContractCreated":
        return {
          name,
          reqId,
          providerId: a[1] as bigint,
          insurerId: a[2] as bigint,
          providerAddr: a[3] as string,
          insurerAddr: a[4] as string,
          drugRef: a[5] as string,
          requestedAmount: a[6] as bigint,
          quantity: a[7] as bigint,
          daysSupply: a[8] as bigint,
          ...meta,
        };
      case "ContentCommitted":
        return { name, reqId, contentHash: a[1] as string, uri: a[2] as string, ...meta };
      case "InsurerEngaged":
        return { name, reqId, policyHash: a[1] as string, policyUri: a[2] as string, ...meta };
      case "ContractReady":
        return { name, reqId, ...meta };
      case "AdjudicationRequested":
        return { name, reqId, ...meta };
      case "PacketSubmitted":
        return {
          name,
          reqId,
          round: a[1] as bigint,
          packetRoot: a[2] as string,
          packetUrl: a[3] as string,
          ...meta,
        };
      case "RulingRequested":
        return { name, reqId, requestId: a[1] as bigint, fee: a[2] as bigint, ...meta };
      case "Ruled":
        // SPEC-0006 R24: 4-arg shape: (reqId indexed, requestId indexed, decision indexed, coveredAmount).
        // Rationale is now emitted separately via the RulingRationale event (commitRationale).
        return {
          name,
          reqId,
          requestId: a[1] as bigint,
          decision: Number(a[2]) as Decision,
          coveredAmount: a[3] as bigint,
          ...meta,
        };
      case "RulingRationale":
        // SPEC-0006 R24–R26: emitted by commitRationale.
        // Args: (reqId indexed, requestId indexed, decision indexed, rationale string,
        //        clauseReference string, standardReference string)
        return {
          name,
          reqId,
          requestId: a[1] as bigint,
          decision: Number(a[2]) as Decision,
          rationale: a[3] as string,
          clauseReference: a[4] as string,
          standardReference: a[5] as string,
          ...meta,
        };
      case "PolicyInvalidated":
        return { name, reqId, clauseRef: a[1] as string, standardRef: a[2] as string, ...meta };
      case "EvidenceRequested":
        return { name, reqId, ...meta };
      case "EvidenceSubmitted":
        return { name, reqId, evidenceUri: a[1] as string, ...meta };
      case "Appealed":
        return {
          name,
          reqId,
          partyId: a[1] as bigint,
          evidenceUri: a[2] as string,
          round: a[3] as bigint,
          ...meta,
        };
      case "Accepted":
        return { name, reqId, partyId: a[1] as bigint, ...meta };
      case "Settled":
        // A0008 §2: third arg is refundedToInsurer (renamed from feePerParty).
        return { name, reqId, coveredAmount: a[1] as bigint, refundedToInsurer: a[2] as bigint, ...meta };
      case "Deadlocked":
        return { name, reqId, rounds: a[1] as bigint, ...meta };
      case "ProviderRefused":
        return { name, reqId, reasonHash: a[1] as string, ...meta };
      case "Withdrawn":
        return { name, reqId, ...meta };
      case "RulingTimedOut":
        return { name, reqId, requestId: a[1] as bigint, ...meta };
      case "FeedbackPosted":
        return { name, reqId, msgHash: a[1] as string, uri: a[2] as string, ...meta };
      default:
        throw new Error(`unknown event ${String(name)}`);
    }
  }

  async close(): Promise<void> {
    for (const [, handlers] of this.attached) {
      for (const h of handlers) await this.contract.off(h.event, h.fn);
    }
    this.attached.clear();
    // Tear down the provider's network polling so the process can exit.
    if (this.provider instanceof ethers.JsonRpcProvider) {
      this.provider.destroy();
    }
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private decodeNegotiation(raw: RawNegotiation): Negotiation {
    return decodeNegotiationRaw(raw);
  }

  private extractReqIdFromReceipt(
    receipt: ethers.ContractTransactionReceipt | null,
  ): bigint | undefined {
    if (!receipt) return undefined;
    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (parsed?.name === "ContractCreated") {
          return parsed.args[0] as bigint;
        }
      } catch {
        // Not one of our events; skip.
      }
    }
    return undefined;
  }
}
