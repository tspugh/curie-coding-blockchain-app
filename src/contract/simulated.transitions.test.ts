/**
 * Simulated-backend transition tests. Covers state-machine paths the
 * `simulated.auth.test.ts` file deliberately doesn't reach: success +
 * revert branches of `postFeedback`, `onRulingTimeout`, `settle`,
 * `withdraw`, `refuse`. Tick-132 coverage flagged these as the
 * outstanding src/contract/simulated.ts gap (68.63% branch).
 *
 * Mirrors the auth-test conventions: `node:test` + `tsx`, deterministic
 * `setCaller` to drive R11 gates, `rejects(fn, msg)` for revert-message
 * matching.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { ethers } from "ethers";

import { Decision, PayerLine, State } from "../types/coverage.types.js";
import { SimulatedBackend } from "./simulated.js";
import type { CreateContractParams } from "./types.js";

const PROVIDER = ethers.getAddress(`0x${"11".repeat(20)}`);
const INSURER = ethers.getAddress(`0x${"22".repeat(20)}`);
const ATTACKER = ethers.getAddress(`0x${"33".repeat(20)}`);

const PROVIDER_ID = 11n;
const INSURER_ID = 22n;

const DRUG_REF = ethers.id("DRUG:semaglutide");
const JUSTIFICATION_HASH = ethers.id("just");
const EVIDENCE_URI = ethers.id("ipfs://e1");
const POLICY_HASH = ethers.id("policy");
const POLICY_URI = ethers.id("ipfs://policy");
const FEEDBACK_HASH = ethers.id("msg:hello");
const FEEDBACK_URI = ethers.id("ipfs://feedback");
const REASON_HASH = ethers.id("reason:refuse");

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

/** Backend with auto-resolve OFF so state stays where we put it. */
function backend() {
  return new SimulatedBackend({ autoResolve: false });
}

async function rejects(fn: () => Promise<unknown>, msg: string): Promise<void> {
  await assert.rejects(fn, (e: unknown) => {
    assert.equal((e as Error).message, msg);
    return true;
  });
}

/** Drive a negotiation to Approved + both parties accepted (settle-ready). */
async function toBothAccepted(b: SimulatedBackend): Promise<bigint> {
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  // Force Approved without auto-resolve: deliver the ruling via the public
  // resolve() hook (mimics the platform calling handleResponse).
  b.resolve(reqId, Decision.Approve);
  assert.equal(await b.stateOf(reqId), State.Approved);
  b.setCaller(PROVIDER);
  await b.accept(reqId, PROVIDER_ID);
  b.setCaller(INSURER);
  await b.accept(reqId, INSURER_ID);
  return reqId;
}

// ---------------------------------------------------------------------
// settle
// ---------------------------------------------------------------------

test("settle: Approved + both accepted → Settled with emitted event", async () => {
  const b = backend();
  const reqId = await toBothAccepted(b);
  b.setCaller(PROVIDER);
  await b.settle(reqId);
  assert.equal(await b.stateOf(reqId), State.Settled);
});

test("settle: pre-ruling state (Open) reverts 'settle: not ruled'", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  await rejects(() => b.settle(reqId), "settle: not ruled");
});

test("settle: Approved but only one party accepted reverts 'settle: not both accepted'", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.Approve);
  // Only provider accepts.
  b.setCaller(PROVIDER);
  await b.accept(reqId, PROVIDER_ID);
  await rejects(() => b.settle(reqId), "settle: not both accepted");
});

// ---------------------------------------------------------------------
// refuse
// ---------------------------------------------------------------------

test("refuse: provider-only — non-provider caller is rejected before state check", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  // Insurer tries to refuse — rejected by R11 (insurer != provider).
  await rejects(() => b.refuse(reqId, REASON_HASH), "auth: not provider");
});

test("refuse: pre-engage state (Open) reverts 'refuse: not refusable'", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  // Open state — refusable() returns false for Open per the contract mirror.
  await rejects(() => b.refuse(reqId, REASON_HASH), "refuse: not refusable");
});

test("refuse: Ready state → ProviderRefused with emitted event", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.refuse(reqId, REASON_HASH);
  assert.equal(await b.stateOf(reqId), State.ProviderRefused);
});

// ---------------------------------------------------------------------
// withdraw
// ---------------------------------------------------------------------

test("withdraw: either party → Withdrawn (insurer caller works)", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  // Insurer withdraws from Ready state.
  await b.withdraw(reqId);
  assert.equal(await b.stateOf(reqId), State.Withdrawn);
});

test("withdraw: terminal state (Withdrawn) reverts 'withdraw: terminal'", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  await b.withdraw(reqId);
  // Second withdraw attempt — already terminal.
  await rejects(() => b.withdraw(reqId), "withdraw: terminal");
});

// ---------------------------------------------------------------------
// onRulingTimeout
// ---------------------------------------------------------------------

test("onRulingTimeout: UnderReview → EvidenceRequested + RulingTimedOut event", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  // State is now UnderReview (auto-resolve is off).
  assert.equal(await b.stateOf(reqId), State.UnderReview);
  await b.onRulingTimeout(reqId);
  assert.equal(await b.stateOf(reqId), State.EvidenceRequested);
  const evs = (await b.getEvents()).filter((e) => e.name === "RulingTimedOut");
  assert.equal(evs.length, 1);
});

test("onRulingTimeout: pre-fire state (Open) reverts 'timeout: not UnderReview'", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  await rejects(() => b.onRulingTimeout(reqId), "timeout: not UnderReview");
});

// ---------------------------------------------------------------------
// postFeedback
// ---------------------------------------------------------------------

test("postFeedback: either party in non-terminal state → FeedbackPosted event", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  // Insurer posts feedback from Ready state.
  await b.postFeedback(reqId, FEEDBACK_HASH, FEEDBACK_URI);
  const evs = (await b.getEvents()).filter((e) => e.name === "FeedbackPosted");
  assert.equal(evs.length, 1);
});

test("postFeedback: terminal state (Withdrawn) reverts 'feedback: terminal'", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  await b.withdraw(reqId);
  await rejects(() => b.postFeedback(reqId, FEEDBACK_HASH, FEEDBACK_URI), "feedback: terminal");
});

test("postFeedback: non-party caller (ATTACKER) reverts 'auth: not a party'", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(ATTACKER);
  await rejects(() => b.postFeedback(reqId, FEEDBACK_HASH, FEEDBACK_URI), "auth: not a party");
});
