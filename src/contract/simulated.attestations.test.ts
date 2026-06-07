/**
 * Simulated-backend tests for the A0012 de-identified attestation channel
 * (SPEC-0007 R5/R7/R13). Mirrors the contract-layer Hardhat tests so the two
 * backends stay behaviourally identical behind the shared client interface (R14).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { ethers } from "ethers";

import { type Attestation, Decision, PayerLine, State } from "../types/coverage.types.js";
import { SimulatedBackend } from "./simulated.js";
import type { CreateContractParams } from "./types.js";

const PROVIDER = ethers.getAddress(`0x${"11".repeat(20)}`);
const INSURER = ethers.getAddress(`0x${"22".repeat(20)}`);
const POLICY_HASH = ethers.id("policy");
const POLICY_URI = ethers.id("ipfs://policy");
const CLAUSE_STEP = ethers.id("step-therapy");
const CLAUSE_SAFETY = ethers.id("tb-screening");
const URI_HASH = ethers.id("https://example.org/deidentified-lab");

function params(): CreateContractParams {
  return {
    providerId: 11n,
    insurerId: 22n,
    providerAddr: PROVIDER,
    insurerAddr: INSURER,
    drugRef: ethers.id("DRUG:adalimumab"),
    requestedAmount: 2000n,
    quantity: 1n,
    daysSupply: 30n,
    justificationHash: ethers.id("just"),
    evidenceUri: ethers.id("ipfs://e1"),
    payerLine: PayerLine.Commercial,
    agentEvidenceUrl: "https://api.fda.gov/drug/label.json?search=openfda.brand_name:HUMIRA&limit=1",
    agentPromptHint: "Adalimumab for plaque psoriasis — FDA-approved and medically necessary?",
  };
}

const att = (clauseId: string, attested: boolean, evidenceUriHash = ethers.ZeroHash): Attestation => ({
  clauseId,
  attested,
  evidenceUriHash,
});

/** Create → engage → adjudicate(provider) with the given attestations; autoResolve off. */
async function ready(b: SimulatedBackend, attestations: Attestation[]): Promise<bigint> {
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId, attestations);
  return reqId;
}

test("A0012 R13: insurer cannot supply attestations (provider-only path)", async () => {
  const b = new SimulatedBackend({ autoResolve: false });
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  // Insurer attempts to adjudicate WITH attestations → provider-only revert.
  await assert.rejects(
    () => b.requestAdjudication(reqId, [att(CLAUSE_STEP, true)]),
    (e: unknown) => (e as Error).message === "auth: not provider",
  );
});

test("A0012 R5/R13: attestations are stored and read back via getAttestations", async () => {
  const b = new SimulatedBackend({ autoResolve: false });
  const reqId = await ready(b, [att(CLAUSE_STEP, true, URI_HASH), att(CLAUSE_SAFETY, false)]);
  const stored = await b.getAttestations(reqId);
  assert.equal(stored.length, 2);
  assert.deepEqual(stored[0], { clauseId: CLAUSE_STEP, attested: true, evidenceUriHash: URI_HASH });
  assert.equal(stored[1]?.attested, false);
});

test("A0012 T1/R7: all attestations affirmative + approve → Approved", async () => {
  const b = new SimulatedBackend({ autoResolve: false });
  const reqId = await ready(b, [att(CLAUSE_STEP, true), att(CLAUSE_SAFETY, true)]);
  b.resolve(reqId, Decision.Approve);
  assert.equal(await b.stateOf(reqId), State.Approved);
});

test("A0012 T3/R7: a FALSE attestation downgrades approve → needs-more-info (EvidenceRequested)", async () => {
  const b = new SimulatedBackend({ autoResolve: false });
  const reqId = await ready(b, [att(CLAUSE_STEP, true), att(CLAUSE_SAFETY, false)]);
  b.resolve(reqId, Decision.Approve); // agent says approve…
  assert.equal(await b.stateOf(reqId), State.EvidenceRequested); // …but the gate blocks it
  const n = await b.getNegotiation(reqId);
  assert.equal(n.hasRuling, false);
});

test("A0012 R7 (vacuous): public-only policy (no attestations) approves normally", async () => {
  const b = new SimulatedBackend({ autoResolve: false });
  const reqId = await ready(b, []);
  b.resolve(reqId, Decision.Approve);
  assert.equal(await b.stateOf(reqId), State.Approved);
  assert.equal((await b.getAttestations(reqId)).length, 0);
});

test("A0012: a false attestation does NOT block a Deny (only downgrades Approve)", async () => {
  const b = new SimulatedBackend({ autoResolve: false });
  const reqId = await ready(b, [att(CLAUSE_STEP, false)]);
  b.resolve(reqId, Decision.Deny);
  assert.equal(await b.stateOf(reqId), State.Denied);
});

test("A0012 guard: more than MAX_ATTESTATIONS reverts", async () => {
  const b = new SimulatedBackend({ autoResolve: false });
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  const tooMany = Array.from({ length: 33 }, (_, i) => att(ethers.id(`c${i}`), true));
  await assert.rejects(
    () => b.requestAdjudication(reqId, tooMany),
    (e: unknown) => (e as Error).message === "attest: too many",
  );
});
