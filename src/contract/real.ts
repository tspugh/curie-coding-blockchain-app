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
}

/**
 * Raw `Negotiation` tuple returned by ethers — field order matches the Solidity
 * struct (and `abi.ts`) EXACTLY. 25 fields.
 */
type RawNegotiation = readonly [
  bigint, // providerId
  bigint, // insurerId
  string, // providerAddr
  string, // insurerAddr
  string, // drugRef
  bigint, // requestedAmount
  string, // justificationHash
  string, // evidenceUri
  string, // policyHash
  string, // policyUri
  bigint, // coveredAmount
  string, // rationaleHash
  string, // clauseRef
  string, // standardRef
  bigint | number, // lastDecision (uint8)
  boolean, // hasRuling
  bigint, // round
  boolean, // providerAccepted
  boolean, // insurerAccepted
  bigint, // totalFees
  bigint | number, // state (uint8)
  bigint, // pendingRequestId
  bigint, // createdAt
  bigint, // rulingDeadline
  boolean, // exists
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
    justificationHash: string,
    evidenceUri: string,
  ): Promise<ethers.ContractTransactionResponse>;
  insurerEngage(reqId: bigint, policyHash: string, policyUri: string): Promise<ethers.ContractTransactionResponse>;
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
  getNegotiation(reqId: bigint): Promise<RawNegotiation>;
  stateOf(reqId: bigint): Promise<bigint | number>;
  coveredAmountOf(reqId: bigint): Promise<bigint>;
  roundOf(reqId: bigint): Promise<bigint>;
  policyOf(reqId: bigint): Promise<readonly [string, string]>;
  count(): Promise<bigint>;
}

export class RealBackend implements CoverageNegotiationClient {
  readonly mode = "real" as const;

  private readonly contract: CoverageContract & ethers.Contract;
  private readonly provider: ethers.Provider;
  private readonly agentFeeValue: bigint;
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

  async createContract(params: CreateContractParams): Promise<bigint> {
    const tx = await this.contract.createContract(
      params.providerId,
      params.insurerId,
      params.providerAddr,
      params.insurerAddr,
      params.drugRef,
      params.requestedAmount,
      params.justificationHash,
      params.evidenceUri,
    );
    const receipt = await tx.wait();
    // Recover reqId from the ContractCreated event (return values aren't
    // available from a mined tx; the event's first topic carries reqId).
    const reqId = this.extractReqIdFromReceipt(receipt);
    if (reqId === undefined) {
      // Fall back to count() if the event couldn't be parsed.
      return this.count();
    }
    return reqId;
  }

  async insurerEngage(reqId: bigint, policyHash: string, policyUri: string): Promise<void> {
    const tx = await this.contract.insurerEngage(reqId, policyHash, policyUri);
    await tx.wait();
  }

  async requestAdjudication(reqId: bigint): Promise<void> {
    const tx = await this.contract.requestAdjudication(reqId, { value: this.agentFeeValue });
    await tx.wait();
  }

  async submitEvidence(reqId: bigint, evidenceUri: string): Promise<void> {
    const tx = await this.contract.submitEvidence(reqId, evidenceUri, { value: this.agentFeeValue });
    await tx.wait();
  }

  async appeal(
    reqId: bigint,
    partyId: bigint,
    evidenceUri: string,
    reasonHash: string,
  ): Promise<void> {
    const tx = await this.contract.appeal(reqId, partyId, evidenceUri, reasonHash, {
      value: this.agentFeeValue,
    });
    await tx.wait();
  }

  async accept(reqId: bigint, partyId: bigint): Promise<void> {
    const tx = await this.contract.accept(reqId, partyId);
    await tx.wait();
  }

  async settle(reqId: bigint): Promise<void> {
    const tx = await this.contract.settle(reqId);
    await tx.wait();
  }

  async refuse(reqId: bigint, reasonHash: string): Promise<void> {
    const tx = await this.contract.refuse(reqId, reasonHash);
    await tx.wait();
  }

  async withdraw(reqId: bigint): Promise<void> {
    const tx = await this.contract.withdraw(reqId);
    await tx.wait();
  }

  async onRulingTimeout(reqId: bigint): Promise<void> {
    const tx = await this.contract.onRulingTimeout(reqId);
    await tx.wait();
  }

  async postFeedback(reqId: bigint, msgHash: string, uri: string): Promise<void> {
    const tx = await this.contract.postFeedback(reqId, msgHash, uri);
    await tx.wait();
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
    "RulingRequested",
    "Ruled",
    "PolicyFlagged",
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
    const from = filter.fromBlock ?? 0;
    const to = filter.toBlock ?? "latest";
    const collected: Array<{ ev: CoverageEvent; block: number; index: number }> = [];

    for (const name of RealBackend.EVENT_NAMES) {
      // reqId is the first (indexed) topic of every event, so the named filter
      // narrows the `eth_getLogs` query to a single contract when requested.
      const make = this.contract.filters[name] as unknown as (
        reqId?: bigint,
      ) => ethers.DeferredTopicFilter;
      const topic = filter.reqId === undefined ? make() : make(filter.reqId);
      const logs = await this.contract.queryFilter(topic, from, to);
      for (const log of logs) {
        const el = log as ethers.EventLog;
        collected.push({
          ev: this.buildEvent(name, [...el.args], {
            txHash: el.transactionHash,
            blockNumber: el.blockNumber,
          }),
          block: el.blockNumber,
          index: el.index,
        });
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
      case "RulingRequested":
        return { name, reqId, requestId: a[1] as bigint, fee: a[2] as bigint, ...meta };
      case "Ruled":
        return {
          name,
          reqId,
          requestId: a[1] as bigint,
          decision: Number(a[2]) as Decision,
          coveredAmount: a[3] as bigint,
          rationaleHash: a[4] as string,
          clauseRef: a[5] as string,
          receiptId: a[6] as bigint,
          ...meta,
        };
      case "PolicyFlagged":
        return { name, reqId, clauseRef: a[1] as string, standardRef: a[2] as string, ...meta };
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
        return { name, reqId, coveredAmount: a[1] as bigint, feePerParty: a[2] as bigint, ...meta };
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
    return {
      providerId: raw[0],
      insurerId: raw[1],
      providerAddr: raw[2],
      insurerAddr: raw[3],
      drugRef: raw[4],
      requestedAmount: raw[5],
      justificationHash: raw[6],
      evidenceUri: raw[7],
      policyHash: raw[8],
      policyUri: raw[9],
      coveredAmount: raw[10],
      rationaleHash: raw[11],
      clauseRef: raw[12],
      standardRef: raw[13],
      lastDecision: Number(raw[14]) as Decision,
      hasRuling: raw[15],
      round: raw[16],
      providerAccepted: raw[17],
      insurerAccepted: raw[18],
      totalFees: raw[19],
      state: Number(raw[20]) as State,
      pendingRequestId: raw[21],
      createdAt: raw[22],
      rulingDeadline: raw[23],
      exists: raw[24],
    };
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
