/**
 * RealBackend — ethers v6 binding to the deployed `CoverageNegotiation` contract
 * on Somnia testnet (SPEC-0001 R11). Reads go through the provider, writes are
 * signed by the {@link RealWallet}'s signer, and events come from provider log
 * filters (R16). It implements the SAME {@link CoverageNegotiationClient} as the
 * simulated backend so the calling code path is identical across modes.
 *
 * NOTE on the agent fee (R9): writes that fire the native agent
 * (`submitDispute` / `submitEvidence` / `appeal`) are `payable`. A real ruling
 * requires the contract to be funded so it can forward the per-request deposit;
 * this client sends the tx and the platform later calls `handleResponse` back
 * into the contract, surfaced here as a `Ruled` event via the subscription.
 */
import { ethers } from "ethers";

import {
  type CoverageEvent,
  type CoverageEventListener,
  type CoverageEventName,
  type Negotiation,
  type NegotiationView,
  type Position,
  State,
  STATE_NAMES,
  type Unsubscribe,
} from "../types/coverage.types.js";
import type { RealWallet } from "../wallet/wallet.js";
import { COVERAGE_NEGOTIATION_ABI } from "./abi.js";
import type {
  CoverageNegotiationClient,
  CreateContractParams,
  EventFilter,
  SubmitPositionParams,
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

/** Raw shape returned by ethers for the `getNegotiation` tuple. */
type RawPosition = readonly [bigint, boolean];
type RawNegotiation = readonly [
  bigint, bigint, string, string, bigint, bigint, string,
  RawPosition, RawPosition, bigint, bigint | number, bigint, bigint, bigint, boolean,
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
    initiatorId: bigint, destinationId: bigint, drugRef: string, noteHash: string,
    priceFloor: bigint, priceCeil: bigint, evidenceUri: string,
  ): Promise<ethers.ContractTransactionResponse>;
  attachContent(reqId: bigint, contentHash: string, uri: string): Promise<ethers.ContractTransactionResponse>;
  submitPosition(
    reqId: bigint, partyId: bigint, proposedAmount: bigint, contentHash: string, uri: string,
  ): Promise<ethers.ContractTransactionResponse>;
  submitDispute(reqId: bigint, byPartyId: bigint, overrides?: Overrides): Promise<ethers.ContractTransactionResponse>;
  submitEvidence(reqId: bigint, evidenceUri: string, overrides?: Overrides): Promise<ethers.ContractTransactionResponse>;
  appeal(reqId: bigint, evidenceUri: string, overrides?: Overrides): Promise<ethers.ContractTransactionResponse>;
  postFeedback(reqId: bigint, msgHash: string, uri: string): Promise<ethers.ContractTransactionResponse>;
  settle(reqId: bigint, agreedAmount: bigint): Promise<ethers.ContractTransactionResponse>;
  withdraw(reqId: bigint): Promise<ethers.ContractTransactionResponse>;
  getNegotiation(reqId: bigint): Promise<RawNegotiation>;
  stateOf(reqId: bigint): Promise<bigint | number>;
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
      params.initiatorId,
      params.destinationId,
      params.drugRef,
      params.noteHash,
      params.priceFloor,
      params.priceCeil,
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

  async attachContent(reqId: bigint, contentHash: string, uri: string): Promise<void> {
    const tx = await this.contract.attachContent(reqId, contentHash, uri);
    await tx.wait();
  }

  async submitPosition(params: SubmitPositionParams): Promise<void> {
    const tx = await this.contract.submitPosition(
      params.reqId,
      params.partyId,
      params.proposedAmount,
      params.contentHash,
      params.uri,
    );
    await tx.wait();
  }

  async submitDispute(reqId: bigint, byPartyId: bigint): Promise<void> {
    const tx = await this.contract.submitDispute(reqId, byPartyId, { value: this.agentFeeValue });
    await tx.wait();
  }

  async submitEvidence(reqId: bigint, evidenceUri: string): Promise<void> {
    const tx = await this.contract.submitEvidence(reqId, evidenceUri, { value: this.agentFeeValue });
    await tx.wait();
  }

  async appeal(reqId: bigint, evidenceUri: string): Promise<void> {
    const tx = await this.contract.appeal(reqId, evidenceUri, { value: this.agentFeeValue });
    await tx.wait();
  }

  async postFeedback(reqId: bigint, msgHash: string, uri: string): Promise<void> {
    const tx = await this.contract.postFeedback(reqId, msgHash, uri);
    await tx.wait();
  }

  async settle(reqId: bigint, agreedAmount: bigint): Promise<void> {
    const tx = await this.contract.settle(reqId, agreedAmount);
    await tx.wait();
  }

  async withdraw(reqId: bigint): Promise<void> {
    const tx = await this.contract.withdraw(reqId);
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
    const both = n.initiatorPosition.submitted && n.destinationPosition.submitted;
    return {
      reqId,
      negotiation: n,
      state: n.state,
      stateName: STATE_NAMES[n.state],
      bothPositionsSubmitted: both,
      disputable: n.state === State.Ready,
      terminal: n.state === State.Settled || n.state === State.Withdrawn,
    };
  }

  async stateOf(reqId: bigint): Promise<State> {
    const raw = (await this.contract.stateOf(reqId)) as bigint | number;
    return Number(raw) as State;
  }

  async count(): Promise<bigint> {
    return (await this.contract.count()) as bigint;
  }

  // ---------------------------------------------------------------------
  // Events (provider log subscriptions — R16)
  // ---------------------------------------------------------------------

  /** Every event name the contract emits — the set scanned by getEvents/subscribe. */
  private static readonly EVENT_NAMES = [
    "ContractCreated", "ContentCommitted", "PositionSubmitted", "ContractReady",
    "DisputeSubmitted", "RulingRequested", "Ruled", "RulingTimedOut",
    "FeedbackPosted", "EvidenceSubmitted", "Appealed", "Settled", "Withdrawn",
  ] as const;

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
        listener(this.buildEvent(name, args.slice(0, -1), {
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
        }));
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
        return { name, reqId, initiatorId: a[1] as bigint, destinationId: a[2] as bigint, drugRef: a[3] as string, priceFloor: a[4] as bigint, priceCeil: a[5] as bigint, ...meta };
      case "ContentCommitted":
        return { name, reqId, contentHash: a[1] as string, uri: a[2] as string, ...meta };
      case "PositionSubmitted":
        return { name, reqId, partyId: a[1] as bigint, proposedAmount: a[2] as bigint, ...meta };
      case "ContractReady":
        return { name, reqId, ...meta };
      case "DisputeSubmitted":
        return { name, reqId, byPartyId: a[1] as bigint, ...meta };
      case "RulingRequested":
        return { name, reqId, requestId: a[1] as bigint, fee: a[2] as bigint, ...meta };
      case "Ruled":
        return { name, reqId, requestId: a[1] as bigint, verdict: a[2] as string, receiptId: a[3] as bigint, ...meta };
      case "RulingTimedOut":
        return { name, reqId, requestId: a[1] as bigint, ...meta };
      case "FeedbackPosted":
        return { name, reqId, msgHash: a[1] as string, uri: a[2] as string, ...meta };
      case "EvidenceSubmitted":
        return { name, reqId, evidenceUri: a[1] as string, ...meta };
      case "Appealed":
        return { name, reqId, evidenceUri: a[1] as string, ...meta };
      case "Settled":
        return { name, reqId, agreedAmount: a[1] as bigint, ...meta };
      case "Withdrawn":
        return { name, reqId, ...meta };
      default:
        throw new Error(`unknown event ${name}`);
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
    const toPosition = (p: RawPosition): Position => ({
      proposedAmount: p[0],
      submitted: p[1],
    });
    return {
      initiatorId: raw[0],
      destinationId: raw[1],
      drugRef: raw[2],
      noteHash: raw[3],
      priceFloor: raw[4],
      priceCeil: raw[5],
      evidenceUri: raw[6],
      initiatorPosition: toPosition(raw[7]),
      destinationPosition: toPosition(raw[8]),
      agreedAmount: raw[9],
      state: Number(raw[10]) as State,
      pendingRequestId: raw[11],
      createdAt: raw[12],
      rulingDeadline: raw[13],
      exists: raw[14],
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
