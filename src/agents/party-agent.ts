/**
 * PartyAgent — an off-chain actor that represents ONE negotiating party
 * (provider or insurer) and drives the contract on its behalf (SPEC-0001 §4
 * deliverable: `src/agents/*`, revised 2026-05-27 — AI necessity-arbiter model).
 * It submits txs and reads/watches events through the shared
 * {@link CoverageNegotiationClient}; the necessity ruling itself is
 * contract-native (fired by the contract on adjudication), so a PartyAgent never
 * adjudicates — it only acts as a party.
 *
 * HARD INVARIANT (R4): all free text — the justification, the policy body,
 * evidence, feedback, and an appeal's stated reason — is hashed into the
 * off-chain {@link ContentStore} here; only the resulting `keccak256` hash (or an
 * opaque ref) ever crosses into a contract call.
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
  /** This party's wallet address (auth — R11). */
  readonly address: string;
  /** Human label for transcripts/logs. */
  readonly label: string;
}

/** Inputs for {@link PartyAgent.fileRequest} (provider opens — R2). */
export interface FileRequestInput {
  /** The insurer's on-chain party id (may equal this party's — self-claim, R13). */
  readonly insurerId: bigint;
  /** The insurer's wallet address (under one shared wallet, equals the provider's — R12). */
  readonly insurerAddr: string;
  /** Drug name; hashed to an opaque `bytes32` drugRef. */
  readonly drug: string;
  /** Off-chain de-identified justification text; only its hash is committed (R3/R4). */
  readonly justification: string;
  /** The provider's billed / requested amount. */
  readonly requestedAmount: bigint;
  /** Optional public-evidence text; only its hash crosses (R4). Omit for none. */
  readonly evidence?: string;
}

/** An off-chain party actor bound to one identity. */
export class PartyAgent {
  constructor(private readonly deps: PartyAgentDeps) {}

  get partyId(): bigint {
    return this.deps.partyId;
  }
  get address(): string {
    return this.deps.address;
  }
  get label(): string {
    return this.deps.label;
  }

  /**
   * File a coverage-exception request as the provider → `Open` (R2). The
   * justification (and any evidence) is stored off-chain; only its hash/ref is
   * committed (R3/R4).
   */
  async fileRequest(input: FileRequestInput): Promise<bigint> {
    const justificationHash = this.hash(input.justification);
    const evidenceUri = input.evidence === undefined ? ZERO_HASH : this.hash(input.evidence);
    return this.deps.negotiation.createContract({
      providerId: this.partyId,
      insurerId: input.insurerId,
      providerAddr: this.address,
      insurerAddr: input.insurerAddr,
      drugRef: ethers.keccak256(ethers.toUtf8Bytes(input.drug)),
      requestedAmount: input.requestedAmount,
      justificationHash,
      evidenceUri,
    });
  }

  /**
   * Engage a filed request as the insurer by attaching the governing policy →
   * `Ready` (R5). The policy body is stored off-chain; only its hash + ref cross.
   */
  async engage(reqId: bigint, policyText: string, policyUri?: string): Promise<void> {
    const policyHash = this.hash(policyText);
    const uri = policyUri === undefined ? this.hash(`${policyText}#uri`) : policyUri;
    await this.deps.negotiation.insurerEngage(reqId, policyHash, uri);
  }

  /** Fire the necessity arbiter from `Ready` → `UnderReview` (R6/R9). */
  async requestAdjudication(reqId: bigint): Promise<void> {
    await this.deps.negotiation.requestAdjudication(reqId);
  }

  /** Submit more public evidence from `EvidenceRequested`; re-fires the agent (R6c). */
  async submitEvidence(reqId: bigint, evidence = "evidence"): Promise<void> {
    await this.deps.negotiation.submitEvidence(reqId, this.hash(evidence));
  }

  /**
   * Appeal a ruling with NEW public evidence (R6c). Both the evidence and the
   * stated reason are hashed off-chain (R4).
   */
  async appeal(reqId: bigint, evidence = "appeal-evidence", reason = "appeal-reason"): Promise<void> {
    await this.deps.negotiation.appeal(reqId, this.partyId, this.hash(evidence), this.hash(reason));
  }

  /** Accept the current ruling for this party (R6c). */
  async accept(reqId: bigint): Promise<void> {
    await this.deps.negotiation.accept(reqId, this.partyId);
  }

  /** Settle a mutually-accepted ruling → `Settled` (event marker, R8). */
  async settle(reqId: bigint): Promise<void> {
    await this.deps.negotiation.settle(reqId);
  }

  /** Refuse the insurer's terms → `ProviderRefused` (provider-only — R7). */
  async refuse(reqId: bigint, reason = "refused"): Promise<void> {
    await this.deps.negotiation.refuse(reqId, this.hash(reason));
  }

  /** Post off-chain feedback; only the message hash crosses the boundary (R4). */
  async postFeedback(reqId: bigint, message: string): Promise<void> {
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
  readonly wallet: { readonly address: string };
  readonly profiles: {
    getProfile(id: string): { partyId: bigint; label: string } | undefined;
    listProfiles(): ReadonlyArray<{ id: string; partyId: bigint; label: string }>;
  };
}
