/**
 * PartyAgent — an off-chain actor that represents ONE negotiating party
 * (provider or payer) and drives the contract on its behalf (SPEC-0001 §4
 * deliverable: `src/agents/*`). It submits txs and reads/watches events through
 * the shared {@link CoverageNegotiationClient}; the AI ruling itself is
 * contract-native (fired by the contract on dispute), so a PartyAgent never
 * adjudicates — it only acts as a party.
 *
 * HARD INVARIANT (R4): note/feedback/evidence TEXT is hashed into the off-chain
 * {@link ContentStore} here; only the resulting `keccak256` hash (or an opaque
 * ref) ever crosses into a contract call.
 */
import { ethers } from "ethers";

import { ContentStore } from "../content/content.js";
import type { CoverageNegotiationClient } from "../contract/types.js";

const ZERO_HASH = ethers.ZeroHash;

/** What a PartyAgent needs: the shared client + an off-chain content store. */
export interface PartyAgentDeps {
  readonly negotiation: CoverageNegotiationClient;
  readonly content: ContentStore;
  /** This party's on-chain id (its profile's `partyId`). */
  readonly partyId: bigint;
  /** Human label for transcripts/logs. */
  readonly label: string;
}

/** Inputs for {@link PartyAgent.openContract}. */
export interface OpenContractInput {
  /** The other party's on-chain id (may equal this party's — self-contract, R13). */
  readonly counterpartyId: bigint;
  /** Drug name; hashed to an opaque `bytes32` drugRef. */
  readonly drug: string;
  /** Off-chain note text; only its hash is committed (R3/R4). */
  readonly note: string;
  readonly priceFloor: bigint;
  readonly priceCeil: bigint;
}

/** An off-chain party actor bound to one identity. */
export class PartyAgent {
  constructor(private readonly deps: PartyAgentDeps) {}

  get partyId(): bigint {
    return this.deps.partyId;
  }
  get label(): string {
    return this.deps.label;
  }

  /** Open a new contract as the initiator; stores the note off-chain (R3/R4). */
  async openContract(input: OpenContractInput): Promise<bigint> {
    const noteHash = this.deps.content.put(input.note).hash;
    return this.deps.negotiation.createContract({
      initiatorId: this.partyId,
      destinationId: input.counterpartyId,
      drugRef: ethers.keccak256(ethers.toUtf8Bytes(input.drug)),
      noteHash,
      priceFloor: input.priceFloor,
      priceCeil: input.priceCeil,
      evidenceUri: ZERO_HASH,
    });
  }

  /** Submit this party's proposed amount (position). */
  async proposePosition(reqId: bigint, amount: bigint): Promise<void> {
    await this.deps.negotiation.submitPosition({
      reqId,
      partyId: this.partyId,
      proposedAmount: amount,
      contentHash: ZERO_HASH,
      uri: ZERO_HASH,
    });
  }

  /** Raise a dispute (fires the contract-native agent). */
  async dispute(reqId: bigint): Promise<void> {
    await this.deps.negotiation.submitDispute(reqId, this.partyId);
  }

  /** Appeal a denial; re-fires the agent. Evidence text is hashed off-chain. */
  async appeal(reqId: bigint, evidence = "appeal"): Promise<void> {
    await this.deps.negotiation.appeal(reqId, this.hash(evidence));
  }

  /** Submit more evidence from `EvidenceRequested`; re-fires the agent. */
  async submitEvidence(reqId: bigint, evidence = "evidence"): Promise<void> {
    await this.deps.negotiation.submitEvidence(reqId, this.hash(evidence));
  }

  /** Settle an approved contract within the band (event marker, R8). */
  async settle(reqId: bigint, amount: bigint): Promise<void> {
    await this.deps.negotiation.settle(reqId, amount);
  }

  /** Post off-chain feedback; only the message hash crosses the boundary (R7/R4). */
  async postFeedback(reqId: bigint, message: string): Promise<void> {
    this.deps.content.put(message);
    await this.deps.negotiation.postFeedback(reqId, this.hash(message), ZERO_HASH);
  }

  private hash(text: string): string {
    return this.deps.content.put(text).hash;
  }
}

/** Minimal client surface the agent factories bind to (a `CurieClient` satisfies it). */
export interface AgentClient {
  readonly negotiation: CoverageNegotiationClient;
  readonly content: ContentStore;
  readonly profiles: {
    getProfile(id: string): { partyId: bigint; label: string } | undefined;
    listProfiles(): ReadonlyArray<{ id: string; partyId: bigint; label: string }>;
  };
}
