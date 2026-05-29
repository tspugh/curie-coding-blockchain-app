/**
 * Simulated-backend auth-parity tests (Finding-2). Proves the SimulatedBackend
 * enforces the SAME R11 address gates the Solidity contract does, with matching
 * revert messages — so dev/CI can no longer mask an auth regression.
 *
 * Runs on Node's built-in test runner via tsx (no extra deps):
 *   node --import tsx --test src/contract/simulated.auth.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { ethers } from "ethers";

import { Decision, PayerLine, State } from "../types/coverage.types.js";
import { ANY_CALLER, SimulatedBackend } from "./simulated.js";
import type { CreateContractParams } from "./types.js";

const PROVIDER = ethers.getAddress(`0x${"11".repeat(20)}`);
const INSURER = ethers.getAddress(`0x${"22".repeat(20)}`);
const ATTACKER = ethers.getAddress(`0x${"33".repeat(20)}`);

const PROVIDER_ID = 11n;
const INSURER_ID = 22n;

const DRUG_REF = ethers.id("DRUG:semaglutide");
const JUSTIFICATION_HASH = ethers.id("just");
const EVIDENCE_URI = ethers.id("ipfs://e1");
const EVIDENCE_URI_2 = ethers.id("ipfs://e2");
const POLICY_HASH = ethers.id("policy");
const POLICY_URI = ethers.id("ipfs://policy");
const REASON_HASH = ethers.id("reason");

function params(over: Partial<CreateContractParams> = {}): CreateContractParams {
  return {
    providerId: PROVIDER_ID,
    insurerId: INSURER_ID,
    providerAddr: PROVIDER,
    insurerAddr: INSURER,
    drugRef: DRUG_REF,
    requestedAmount: 2000n,
    quantity: 10n,
    daysSupply: 30n,
    justificationHash: JUSTIFICATION_HASH,
    evidenceUri: EVIDENCE_URI,
    payerLine: PayerLine.PartD,
    ...over,
  };
}

/** A backend with auto-resolve OFF so the negotiation stays UnderReview deterministically. */
function backend() {
  return new SimulatedBackend({ autoResolve: false });
}

async function rejects(fn: () => Promise<unknown>, msg: string): Promise<void> {
  await assert.rejects(fn, (e: unknown) => {
    assert.equal((e as Error).message, msg);
    return true;
  });
}

test("createContract: only the declared provider address may file", async () => {
  const b = backend();
  b.setCaller(ATTACKER);
  await rejects(() => b.createContract(params()), "auth: not provider");
  // Provider succeeds.
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  assert.equal(reqId, 1n);
});

test("insurerEngage: insurer-only", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(PROVIDER); // provider is not the insurer
  await rejects(() => b.insurerEngage(reqId, POLICY_HASH, POLICY_URI), "auth: not insurer");
  b.setCaller(ATTACKER);
  await rejects(() => b.insurerEngage(reqId, POLICY_HASH, POLICY_URI), "auth: not insurer");
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  assert.equal(await b.stateOf(reqId), State.Ready);
});

test("party actions reject a third wallet with matching messages", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);

  // Third wallet on every gated action.
  b.setCaller(ATTACKER);
  await rejects(() => b.requestAdjudication(reqId), "auth: not a party");
  await rejects(() => b.refuse(reqId, REASON_HASH), "auth: not provider");
  await rejects(() => b.withdraw(reqId), "auth: not a party");
  await rejects(() => b.postFeedback(reqId, REASON_HASH, EVIDENCE_URI), "auth: not a party");

  // A party can adjudicate.
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  assert.equal(await b.stateOf(reqId), State.UnderReview);

  // Drive to EvidenceRequested and prove submitEvidence is provider-only.
  b.resolve(reqId, Decision.NeedMoreEvidence);
  assert.equal(await b.stateOf(reqId), State.EvidenceRequested);
  b.setCaller(ATTACKER);
  await rejects(() => b.submitEvidence(reqId, EVIDENCE_URI_2), "auth: not provider");
  b.setCaller(INSURER);
  await rejects(() => b.submitEvidence(reqId, EVIDENCE_URI_2), "auth: not provider");
  b.setCaller(PROVIDER);
  await b.submitEvidence(reqId, EVIDENCE_URI_2);

  // Drive to a ruling; appeal/accept/settle reject the attacker.
  b.resolve(reqId, Decision.Deny);
  assert.equal(await b.stateOf(reqId), State.Denied);
  b.setCaller(ATTACKER);
  await rejects(() => b.appeal(reqId, PROVIDER_ID, EVIDENCE_URI, REASON_HASH), "auth: not a party");
  await rejects(() => b.accept(reqId, PROVIDER_ID), "auth: not a party");
  await rejects(() => b.settle(reqId), "auth: not a party");

  // Reads stay public for anyone (attacker still set as caller).
  assert.equal(await b.stateOf(reqId), State.Denied);
  const n = await b.getNegotiation(reqId);
  assert.equal(n.providerAddr, PROVIDER);
});

test("R2b (SPEC-0004 §2.1): self-contract (providerAddr == insurerAddr) is rejected at createContract", async () => {
  // SPEC-0004 R2b supersedes SPEC-0001 R13's permissive self-claim. The single-shared-wallet
  // scenario that was valid under R13 is no longer supported.
  const b = backend();
  const solo = PROVIDER;
  b.setCaller(solo);
  await assert.rejects(
    () => b.createContract(params({ providerAddr: solo, insurerAddr: solo })),
    (e: unknown) => {
      assert.equal((e as Error).message, "create: self-contract");
      return true;
    },
  );
});

test("ANY_CALLER wildcard preserves back-compat (no gating)", async () => {
  const b = new SimulatedBackend({ autoResolve: false }); // default caller is ANY_CALLER
  assert.equal(b.activeAddress, ANY_CALLER);
  const reqId = await b.createContract(params());
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI); // would be insurer-only if gated
  await b.requestAdjudication(reqId);
  assert.equal(await b.stateOf(reqId), State.UnderReview);
});
