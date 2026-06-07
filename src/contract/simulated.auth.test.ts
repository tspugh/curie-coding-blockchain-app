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
    agentEvidenceUrl: "https://medlineplus.gov/druginfo/meds/a603010.html",
    agentPromptHint: "Is coverage for this drug medically necessary and FDA-approved?",
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

test("C1: a party cannot flip the OTHER party's accept flag (no unilateral settle)", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.Approve);
  assert.equal(await b.stateOf(reqId), State.Approved);

  // Neither party can accept on the other's behalf.
  b.setCaller(PROVIDER);
  await rejects(() => b.accept(reqId, INSURER_ID), "accept: not your party");
  b.setCaller(INSURER);
  await rejects(() => b.accept(reqId, PROVIDER_ID), "accept: not your party");

  // Provider accepts its own flag → still cannot settle alone (insurer consent required).
  b.setCaller(PROVIDER);
  await b.accept(reqId, PROVIDER_ID);
  await rejects(() => b.settle(reqId), "settle: not both accepted");

  // Insurer accepts its own flag → settle now succeeds.
  b.setCaller(INSURER);
  await b.accept(reqId, INSURER_ID);
  await b.settle(reqId);
  assert.equal(await b.stateOf(reqId), State.Settled);
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

test("UNIT-2-followup-B (sim): createContract guards order — addr: zero precedes create: self-contract", async () => {
  // Pins the simulated backend's revert ordering to match the on-chain contract.
  // If sim and real diverge here, the same input would produce different revert
  // strings across modes — silent test-fidelity regression.
  const ZERO = "0x0000000000000000000000000000000000000000";
  const b = backend();
  b.setCaller(PROVIDER);
  const expect = async (
    providerAddr: string,
    insurerAddr: string,
    msg: string,
  ): Promise<void> => {
    await assert.rejects(
      () => b.createContract(params({ providerAddr, insurerAddr })),
      (e: unknown) => {
        assert.equal((e as Error).message, msg);
        return true;
      },
    );
  };
  await expect(ZERO, PROVIDER, "addr: zero");
  await expect(PROVIDER, ZERO, "addr: zero");
  await expect(ZERO, ZERO, "addr: zero"); // NOT "create: self-contract"
  await expect(PROVIDER, PROVIDER, "create: self-contract");
});

test("ANY_CALLER wildcard preserves back-compat (no gating)", async () => {
  const b = new SimulatedBackend({ autoResolve: false }); // default caller is ANY_CALLER
  assert.equal(b.activeAddress, ANY_CALLER);
  const reqId = await b.createContract(params());
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI); // would be insurer-only if gated
  await b.requestAdjudication(reqId);
  assert.equal(await b.stateOf(reqId), State.UnderReview);
});

// -----------------------------------------------------------------------
// UNIT-2-followup-A (simulated parity): appeal() reverts from every
// non-Denied state with "appeal: prior ruling not Deny".
//
// Mirrors the hardhat parameterized suite in CoverageNegotiation.test.ts.
// Uses ANY_CALLER (wildcard) so auth gates don't mask the state-guard check.
// -----------------------------------------------------------------------
test("UNIT-2-followup-A (sim): appeal reverts from every non-Denied state", async () => {
  // Helper: fresh backend with autoResolve OFF (wildcard caller for state-guard isolation).
  function fresh() {
    return new SimulatedBackend({ autoResolve: false });
  }

  // Helper: create → engage → adjudicate (leaves negotiation UnderReview).
  async function cea(b: SimulatedBackend) {
    const reqId = await b.createContract(params());
    await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
    await b.requestAdjudication(reqId);
    return reqId;
  }

  const assertReverts = async (fn: () => Promise<unknown>) =>
    rejects(fn, "appeal: prior ruling not Deny");

  // Ready
  {
    const b = fresh();
    const reqId = await b.createContract(params());
    await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
    assert.equal(await b.stateOf(reqId), State.Ready);
    await assertReverts(() => b.appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH));
  }

  // UnderReview
  {
    const b = fresh();
    const reqId = await cea(b);
    assert.equal(await b.stateOf(reqId), State.UnderReview);
    await assertReverts(() => b.appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH));
  }

  // EvidenceRequested
  {
    const b = fresh();
    const reqId = await cea(b);
    b.resolve(reqId, Decision.NeedMoreEvidence);
    assert.equal(await b.stateOf(reqId), State.EvidenceRequested);
    await assertReverts(() => b.appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH));
  }

  // Approved
  {
    const b = fresh();
    const reqId = await cea(b);
    b.resolve(reqId, Decision.Approve);
    assert.equal(await b.stateOf(reqId), State.Approved);
    await assertReverts(() => b.appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH));
  }

  // Settled (Approved → both accept → settle)
  {
    const b = fresh();
    const reqId = await cea(b);
    b.resolve(reqId, Decision.Approve);
    await b.accept(reqId, PROVIDER_ID);
    await b.accept(reqId, INSURER_ID);
    await b.settle(reqId);
    assert.equal(await b.stateOf(reqId), State.Settled);
    await assertReverts(() => b.appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH));
  }

  // Deadlocked (maxRounds=1: first Deny → appeal cap-deadlocks → second appeal from Deadlocked)
  {
    const b = new SimulatedBackend({ autoResolve: false, maxRounds: 1n });
    const reqId = await cea(b);
    b.resolve(reqId, Decision.Deny);
    // First appeal at round == maxRounds transitions to Deadlocked (no agent fire).
    await b.appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH);
    assert.equal(await b.stateOf(reqId), State.Deadlocked);
    await assertReverts(() => b.appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH));
  }

  // PolicyInvalidated
  {
    const b = fresh();
    const reqId = await cea(b);
    b.resolve(reqId, Decision.PolicyInvalid);
    assert.equal(await b.stateOf(reqId), State.PolicyInvalidated);
    await assertReverts(() => b.appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH));
  }

  // ProviderRefused (create → engage → provider refuses)
  {
    const b = fresh();
    const reqId = await b.createContract(params());
    await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
    await b.refuse(reqId, REASON_HASH);
    assert.equal(await b.stateOf(reqId), State.ProviderRefused);
    await assertReverts(() => b.appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH));
  }

  // Withdrawn (create → withdraw before any engage)
  {
    const b = fresh();
    const reqId = await b.createContract(params());
    await b.withdraw(reqId);
    assert.equal(await b.stateOf(reqId), State.Withdrawn);
    await assertReverts(() => b.appeal(reqId, INSURER_ID, EVIDENCE_URI, REASON_HASH));
  }
});
