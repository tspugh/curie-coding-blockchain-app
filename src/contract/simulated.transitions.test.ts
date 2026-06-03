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

// ---------------------------------------------------------------------
// Amendment 0008 §1-§3: SimulatedBackend escrow accounting parity
// (F4 fix: behavioral tests replace the A0008-SIM source-text assertions)
// ---------------------------------------------------------------------

const REQUESTED = 5000n;

function paramsWithAmount(requestedAmount: bigint): CreateContractParams {
  return params({ requestedAmount });
}

/** Drive to Ready state with a specific requestedAmount. */
async function toReady(b: SimulatedBackend, requestedAmount: bigint): Promise<bigint> {
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(paramsWithAmount(requestedAmount));
  b.setCaller(INSURER);
  // Exact deposit (no depositAmount arg → defaults to requestedAmount).
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  return reqId;
}

test("A0008-SIM-BEH: insurerEngage underfund throws 'escrow: underfunded'", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(paramsWithAmount(REQUESTED));
  b.setCaller(INSURER);
  // Pass depositAmount strictly less than requestedAmount.
  await rejects(
    () => b.insurerEngage(reqId, POLICY_HASH, POLICY_URI, REQUESTED - 1n),
    "escrow: underfunded",
  );
});

test("A0008-SIM-BEH: exact deposit sets escrowAmount == requestedAmount", async () => {
  const b = backend();
  const reqId = await toReady(b, REQUESTED);
  const n = await b.getNegotiation(reqId);
  assert.equal(n.escrowAmount, REQUESTED, "escrowAmount must equal requestedAmount after exact engage");
});

test("A0008-SIM-BEH: settle-approve zeroes escrowAmount (Settled state)", async () => {
  const b = backend();
  const reqId = await toReady(b, REQUESTED);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.Approve);
  assert.equal(await b.stateOf(reqId), State.Approved);
  b.setCaller(PROVIDER);
  await b.accept(reqId, PROVIDER_ID);
  b.setCaller(INSURER);
  await b.accept(reqId, INSURER_ID);
  b.setCaller(PROVIDER);
  await b.settle(reqId);
  assert.equal(await b.stateOf(reqId), State.Settled);
  const n = await b.getNegotiation(reqId);
  assert.equal(n.escrowAmount, 0n, "escrowAmount must be 0 after settle");
});

test("A0008-SIM-BEH: settle-deny zeroes escrowAmount (Settled state)", async () => {
  const b = backend();
  const reqId = await toReady(b, REQUESTED);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.Deny);
  assert.equal(await b.stateOf(reqId), State.Denied);
  b.setCaller(PROVIDER);
  await b.accept(reqId, PROVIDER_ID);
  b.setCaller(INSURER);
  await b.accept(reqId, INSURER_ID);
  b.setCaller(PROVIDER);
  await b.settle(reqId);
  assert.equal(await b.stateOf(reqId), State.Settled);
  const n = await b.getNegotiation(reqId);
  assert.equal(n.escrowAmount, 0n, "escrowAmount must be 0 after deny+settle");
});

test("A0008-SIM-BEH: refuse zeroes escrowAmount (ProviderRefused terminal)", async () => {
  const b = backend();
  const reqId = await toReady(b, REQUESTED);
  b.setCaller(PROVIDER);
  await b.refuse(reqId, REASON_HASH);
  assert.equal(await b.stateOf(reqId), State.ProviderRefused);
  const n = await b.getNegotiation(reqId);
  assert.equal(n.escrowAmount, 0n, "escrowAmount must be 0 after refuse");
});

test("A0008-SIM-BEH: withdraw zeroes escrowAmount (Withdrawn terminal)", async () => {
  const b = backend();
  const reqId = await toReady(b, REQUESTED);
  b.setCaller(INSURER);
  await b.withdraw(reqId);
  assert.equal(await b.stateOf(reqId), State.Withdrawn);
  const n = await b.getNegotiation(reqId);
  assert.equal(n.escrowAmount, 0n, "escrowAmount must be 0 after withdraw");
});

test("A0008-SIM-BEH: Deadlocked path zeroes escrowAmount", async () => {
  // maxRounds=1 → first appeal deadlocks immediately.
  const b = new SimulatedBackend({ autoResolve: false, maxRounds: 1n });
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(paramsWithAmount(REQUESTED));
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.Deny);
  assert.equal(await b.stateOf(reqId), State.Denied);
  // Appeal at the cap → Deadlocked.
  b.setCaller(PROVIDER);
  await b.appeal(reqId, PROVIDER_ID, EVIDENCE_URI, REASON_HASH);
  assert.equal(await b.stateOf(reqId), State.Deadlocked);
  const n = await b.getNegotiation(reqId);
  assert.equal(n.escrowAmount, 0n, "escrowAmount must be 0 after Deadlocked");
});

test("A0008-SIM-BEH: PolicyInvalidated path zeroes escrowAmount", async () => {
  const b = new SimulatedBackend({ autoResolve: false, decision: Decision.PolicyInvalid });
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(paramsWithAmount(REQUESTED));
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.PolicyInvalid);
  assert.equal(await b.stateOf(reqId), State.PolicyInvalidated);
  const n = await b.getNegotiation(reqId);
  assert.equal(n.escrowAmount, 0n, "escrowAmount must be 0 after PolicyInvalidated");
});

test("A0008-SIM-BEH: Settled event carries refundedToInsurer field (not feePerParty)", async () => {
  const b = backend();
  const reqId = await toReady(b, REQUESTED);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.Approve);
  b.setCaller(PROVIDER);
  await b.accept(reqId, PROVIDER_ID);
  b.setCaller(INSURER);
  await b.accept(reqId, INSURER_ID);
  b.setCaller(PROVIDER);
  await b.settle(reqId);

  const events = await b.getEvents({ reqId });
  const settledEv = events.find((e) => e.name === "Settled");
  assert.ok(settledEv, "Settled event must be emitted");
  assert.equal(settledEv.name, "Settled");
  // After Approve with default cap-non-binding: coveredAmount == requestedAmount → refundedToInsurer == 0.
  assert.ok("refundedToInsurer" in settledEv, "Settled event must have refundedToInsurer field");
  assert.ok(!("feePerParty" in settledEv), "Settled event must NOT have legacy feePerParty field");
});

test("A0008-SIM-BEH: Settled event on Denied path emits refundedToInsurer == escrow (full refund)", async () => {
  // F6 fix: assert the value of refundedToInsurer on a Denied settle, not just field presence.
  // On Deny: coveredAmount==0, so refundedToInsurer == escrowAmount == REQUESTED.
  const b = backend();
  const reqId = await toReady(b, REQUESTED);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.Deny);
  assert.equal(await b.stateOf(reqId), State.Denied);
  b.setCaller(PROVIDER);
  await b.accept(reqId, PROVIDER_ID);
  b.setCaller(INSURER);
  await b.accept(reqId, INSURER_ID);
  b.setCaller(PROVIDER);
  await b.settle(reqId);

  const events = await b.getEvents({ reqId });
  const settledEv = events.find((e) => e.name === "Settled");
  assert.ok(settledEv, "Settled event must be emitted on Denied settle");
  assert.equal(settledEv.name, "Settled");
  // On Deny: coveredAmount==0 → refundedToInsurer == full escrow == REQUESTED.
  assert.ok("refundedToInsurer" in settledEv, "Settled event must have refundedToInsurer field");
  assert.equal(
    (settledEv as { name: "Settled"; reqId: bigint; coveredAmount: bigint; refundedToInsurer: bigint }).refundedToInsurer,
    REQUESTED,
    "refundedToInsurer must equal full escrow (REQUESTED) on Denied settle",
  );
  assert.equal(
    (settledEv as { name: "Settled"; reqId: bigint; coveredAmount: bigint; refundedToInsurer: bigint }).coveredAmount,
    0n,
    "coveredAmount must be 0 on Denied settle",
  );
});

// ---------------------------------------------------------------------
// commitRationale — SPEC-0006 R24/R25/R26, Amendment 0007 §5
// ---------------------------------------------------------------------
//
// These tests pin the acceptance criteria:
//   (1) commitRationale emits RulingRationale with decision=Deny after a Deny ruling
//       (complements (2) which verifies Approve — together they validate the decision
//       field is derived from ruling state, not hard-coded)
//   (2) SimulatedBackend.commitRationale emits RulingRationale with correct fields
//       after an Approve ruling
//   (3) Events are scoped per reqId — a commit on reqIdA does not appear on reqIdB
//   (4) abi.ts COVERAGE_NEGOTIATION_ABI contains the commitRationale function entry
//   (5) commitRationale is rejected when called after a NeedMoreEvidence outcome
//   (6) rationale > 4096 bytes is truncated to match on-chain behaviour (R26)

// (1) Behavioral: commitRationale after a Deny ruling emits RulingRationale with
//     decision === Decision.Deny. Complements test (2) which verifies the Approve
//     path; together they ensure the decision field is derived from the ruling
//     state, not hard-coded. A SUT that always emits Decision.Approve would pass
//     test (2) but fail here.
test("commitRationale: emitted RulingRationale event carries decision=Deny after a Deny ruling", async () => {
  const b = new SimulatedBackend({ autoResolve: false });
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.Deny);
  assert.equal(await b.stateOf(reqId), State.Denied,
    "state after Deny ruling must be Denied");

  await b.commitRationale(reqId, "Not covered under formulary exclusion", "clause-2a", "CMS-2025");

  const events = await b.getEvents({ reqId });
  const rationaleEvs = events.filter((e) => e.name === "RulingRationale");
  assert.equal(rationaleEvs.length, 1, "exactly one RulingRationale event must be emitted");

  const ev = rationaleEvs[0];
  assert.ok(ev !== undefined, "RulingRationale event must be present");
  assert.equal(
    (ev as { name: "RulingRationale"; decision: number }).decision,
    Decision.Deny,
    "decision field must equal Decision.Deny when ruling was Deny — not hard-coded to Approve",
  );
});

// (2) Behavioral: commitRationale emits RulingRationale with correct field values.
//     Drives the full path: createContract → insurerEngage → requestAdjudication
//     → resolve(Approve) → commitRationale → assert event shape.
test("commitRationale: emits RulingRationale event with correct rationale/decision/reqId after ruling", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.Approve);
  assert.equal(await b.stateOf(reqId), State.Approved);

  const RATIONALE = "Drug is FDA-approved and medically necessary per clinical criteria";
  const CLAUSE_REF = "PartD-formulary-clause-3";
  const STANDARD_REF = "FDA-LABEL-2024-adalimumab";

  await b.commitRationale(reqId, RATIONALE, CLAUSE_REF, STANDARD_REF);

  const events = await b.getEvents({ reqId });
  const rationaleEvs = events.filter((e) => e.name === "RulingRationale");
  assert.equal(rationaleEvs.length, 1, "exactly one RulingRationale event must be emitted");

  const ev = rationaleEvs[0];
  assert.ok(ev !== undefined, "RulingRationale event must be present");
  assert.equal(ev.name, "RulingRationale");
  assert.equal(ev.reqId, reqId, "reqId must match");
  // decision field: Approve === 0
  assert.equal(
    (ev as { name: "RulingRationale"; decision: number }).decision,
    Decision.Approve,
    "decision must match the ruling decision",
  );
  assert.equal(
    (ev as { name: "RulingRationale"; rationale: string }).rationale,
    RATIONALE,
    "rationale must carry the committed text verbatim",
  );
  assert.equal(
    (ev as { name: "RulingRationale"; clauseReference: string }).clauseReference,
    CLAUSE_REF,
    "clauseReference must carry the committed clause ref",
  );
  assert.equal(
    (ev as { name: "RulingRationale"; standardReference: string }).standardReference,
    STANDARD_REF,
    "standardReference must carry the committed standard ref",
  );
});

// (3) Isolation: commitRationale for reqId A must not emit events on reqId B.
//     Verifies that the simulated event log is scoped per-reqId and that
//     a commitRationale call affects only the targeted negotiation.
test("commitRationale: events are scoped per reqId — commit on A does not appear on B", async () => {
  const b = backend();

  // Create two independent negotiations.
  b.setCaller(PROVIDER);
  const reqIdA = await b.createContract(params());
  const reqIdB = await b.createContract(params());

  // Advance both to a terminal ruling state.
  for (const reqId of [reqIdA, reqIdB]) {
    b.setCaller(INSURER);
    await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
    b.setCaller(PROVIDER);
    await b.requestAdjudication(reqId);
  }
  b.resolve(reqIdA, Decision.Approve);
  b.resolve(reqIdB, Decision.Deny);

  // Commit rationale only for reqIdA.
  await b.commitRationale(reqIdA, "FDA-approved for this indication", "clause-A1", "CMS-2025-A");

  // reqIdA must have exactly one RulingRationale event.
  const eventsA = await b.getEvents({ reqId: reqIdA });
  const rationaleA = eventsA.filter((e) => e.name === "RulingRationale");
  assert.equal(rationaleA.length, 1, "reqIdA must have exactly one RulingRationale event");

  // reqIdB must have zero RulingRationale events — the commit was for A, not B.
  const eventsB = await b.getEvents({ reqId: reqIdB });
  const rationaleB = eventsB.filter((e) => e.name === "RulingRationale");
  assert.equal(rationaleB.length, 0, "reqIdB must have no RulingRationale events after committing on A");
});

// (4) commitRationale reverts when no ruling has been issued yet (parity with
//     the Solidity `require(n.hasRuling, "rationale: no ruling yet")`).
test("commitRationale: rejects with 'rationale: no ruling yet' when called before ruling", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  // State is Ready — no ruling issued.
  await rejects(
    () => b.commitRationale(reqId, "some rationale", "clause", "standard"),
    "rationale: no ruling yet",
  );
});

// (4b) NeedMoreEvidence outcome does NOT set hasRuling — commitRationale must
//      reject after a NeedMoreEvidence verdict, mirroring chain behaviour
//      (_handleDecideResponse L894-903: returns before setting hasRuling).
test("commitRationale: rejects after NeedMoreEvidence outcome (hasRuling not set)", async () => {
  const b = new SimulatedBackend({ autoResolve: false });
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  // Deliver a NeedMoreEvidence verdict — hasRuling must NOT be set.
  b.resolve(reqId, Decision.NeedMoreEvidence);
  assert.equal(await b.stateOf(reqId), State.EvidenceRequested,
    "state after NeedMoreEvidence must be EvidenceRequested");
  // commitRationale must reject because hasRuling is still false.
  await rejects(
    () => b.commitRationale(reqId, "no ruling yet", "clause", "standard"),
    "rationale: no ruling yet",
  );
});

// (5) R26 truncation: rationale > 4096 bytes is truncated to MAX_RATIONALE_BYTES + "…"
//     before being emitted and hashed. This mirrors _truncateRationale in Solidity
//     (CoverageNegotiation.sol L1053-1067). A 4500-char input must appear as a
//     4096-byte prefix + "…" in the emitted event, and the stored hash must match
//     keccak256 of the truncated form (not the raw input).
test("commitRationale: rationale > 4096 bytes is truncated to 4096 bytes + '…' sentinel (R26)", async () => {
  const b = new SimulatedBackend({ autoResolve: false });
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.Approve);
  assert.equal(await b.stateOf(reqId), State.Approved);

  // Build a 4500-character synthetic rationale (all ASCII — no PHI, each byte = 1 byte).
  const LONG_RATIONALE = "A".repeat(4500);

  await b.commitRationale(reqId, LONG_RATIONALE, "clause-long", "standard-long");

  const events = await b.getEvents({ reqId });
  const rationaleEvs = events.filter((e) => e.name === "RulingRationale");
  assert.equal(rationaleEvs.length, 1);

  const ev = rationaleEvs[0];
  assert.ok(ev !== undefined);
  const emittedRationale = (ev as { name: "RulingRationale"; rationale: string }).rationale;

  // The emitted string must end with "…" (U+2026) and the byte-length of the part
  // before the ellipsis must be exactly MAX_RATIONALE_BYTES (4096).
  assert.ok(emittedRationale.endsWith("…"),
    "truncated rationale must end with the '…' sentinel (U+2026)");
  const beforeEllipsis = emittedRationale.slice(0, -1); // remove "…" (single char)
  const encodedPrefix = new TextEncoder().encode(beforeEllipsis);
  assert.equal(encodedPrefix.length, 4096,
    "prefix before '…' must be exactly 4096 UTF-8 bytes");

  // The stored rationaleHash must match keccak256(truncated), not keccak256(raw).
  const n = await b.getNegotiation(reqId);
  const expectedHash = ethers.keccak256(ethers.toUtf8Bytes(emittedRationale));
  assert.equal(n.rationaleHash, expectedHash,
    "stored rationaleHash must be keccak256 of the truncated string");
});

test("commitRationale: a multi-byte codepoint split at the 4096-byte boundary still byte-matches the chain hash (R26/R47 parity)", async () => {
  const b = new SimulatedBackend({ autoResolve: false });
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.Approve);
  assert.equal(await b.stateOf(reqId), State.Approved);

  // 4095 ASCII bytes + 'é' (UTF-8 C3 A9, 2 bytes): the 4096-byte truncation
  // boundary falls BETWEEN the two bytes of 'é', so a decode→re-encode round-trip
  // would corrupt boundary byte 4096 (0xC3) to U+FFFD (EF BF BD) and diverge the
  // hash from the chain. All synthetic — no PHI.
  const RATIONALE = "a".repeat(4095) + "é" + "x".repeat(200);

  await b.commitRationale(reqId, RATIONALE, "clause-mb", "standard-mb");

  // Authoritative truncation, built exactly as CoverageNegotiation.sol does:
  // the first 4096 RAW UTF-8 bytes + the 3 ellipsis bytes (E2 80 A6).
  const encoded = new TextEncoder().encode(RATIONALE);
  assert.ok(encoded.length > 4096, "fixture must exceed the 4096-byte cap");
  const rawTruncated = new Uint8Array(4096 + 3);
  rawTruncated.set(encoded.subarray(0, 4096));
  rawTruncated.set([0xe2, 0x80, 0xa6], 4096);
  assert.equal(rawTruncated[4095], 0xc3,
    "boundary byte 4096 must be the lead byte of 'é' (proves the split is mid-codepoint)");

  const expectedHash = ethers.keccak256(rawTruncated);

  const n = await b.getNegotiation(reqId);
  assert.equal(n.rationaleHash, expectedHash,
    "rationaleHash must be keccak256 over the RAW byte-truncation (chain-identical), not a decode→re-encode round-trip");

  // Regression guard: the buggy round-trip form MUST differ here — proving the
  // sim hashes raw bytes, not the U+FFFD-corrupted re-encoded string.
  const events = await b.getEvents({ reqId });
  const ev = events.find((e) => e.name === "RulingRationale");
  assert.ok(ev !== undefined);
  const emitted = (ev as { name: "RulingRationale"; rationale: string }).rationale;
  const roundTripHash = ethers.keccak256(ethers.toUtf8Bytes(emitted));
  assert.notEqual(n.rationaleHash, roundTripHash,
    "decode→re-encode hash must diverge at a mid-codepoint boundary — the old bug");
});

// (6) abi.ts must include the commitRationale function signature. This is a
//     build-time/import check: we import the ABI and assert the function entry
//     is present.
test("commitRationale: COVERAGE_NEGOTIATION_ABI contains the commitRationale function entry", async () => {
  // Dynamic import so the test runner itself stays importable even before abi.ts
  // is updated (the test fails at the assertion, not at module load).
  const { COVERAGE_NEGOTIATION_ABI } = await import("./abi.js");
  const hasEntry = (COVERAGE_NEGOTIATION_ABI as readonly string[]).some(
    (entry) =>
      typeof entry === "string" &&
      entry.includes("commitRationale") &&
      entry.includes("function"),
  );
  assert.ok(
    hasEntry,
    "COVERAGE_NEGOTIATION_ABI must include a 'function commitRationale(...)' entry (SPEC-0006 R24)",
  );
});

// (6) Chronological ordering: multiple commitRationale calls (across rounds)
//     produce events in round order (stacked by round, last-commit-wins for
//     the current round's rationale).
test("commitRationale: second call for same reqId appends a second RulingRationale event (per-round chronology)", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(params());
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  b.resolve(reqId, Decision.Deny);
  assert.equal(await b.stateOf(reqId), State.Denied);

  // First commitRationale (round 1 denial).
  await b.commitRationale(reqId, "Denied: not medically necessary at this dose", "clause-1", "standard-1");

  // Appeal and second ruling.
  b.setCaller(PROVIDER);
  await b.appeal(reqId, PROVIDER_ID, EVIDENCE_URI, REASON_HASH);
  b.resolve(reqId, Decision.Approve);
  assert.equal(await b.stateOf(reqId), State.Approved);

  // Second commitRationale (round 2 approval after appeal).
  await b.commitRationale(reqId, "Approved: new evidence confirms medical necessity", "clause-2", "standard-2");

  const events = await b.getEvents({ reqId });
  const rationaleEvs = events.filter((e) => e.name === "RulingRationale");
  assert.equal(rationaleEvs.length, 2, "two commitRationale calls must emit two RulingRationale events");

  // Events must appear in emission order (chronological — first denial, then approval).
  const ev0 = rationaleEvs[0];
  const ev1 = rationaleEvs[1];
  assert.ok(ev0 !== undefined && ev1 !== undefined, "both RulingRationale events must be present");
  assert.equal(
    (ev0 as { name: "RulingRationale"; decision: number }).decision,
    Decision.Deny,
    "first RulingRationale must reflect the Deny ruling",
  );
  assert.equal(
    (ev1 as { name: "RulingRationale"; decision: number }).decision,
    Decision.Approve,
    "second RulingRationale must reflect the Approve ruling after appeal",
  );
});

test("A0008-SIM-BEH: submitEvidence round-cap -> Deadlocked + escrowAmount=0n (parity with contract L502-521)", async () => {
  // F3 fix: SimulatedBackend.submitEvidence must mirror the Solidity round-cap branch
  // (CoverageNegotiation.sol L502-521): at round >= maxRounds, routes to Deadlocked
  // and zeroes escrowAmount instead of re-firing the agent.
  const b = new SimulatedBackend({ autoResolve: false, maxRounds: 1n });
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(paramsWithAmount(REQUESTED));
  b.setCaller(INSURER);
  await b.insurerEngage(reqId, POLICY_HASH, POLICY_URI);
  // Drive to EvidenceRequested (round=1 after requestAdjudication + NeedMoreEvidence verdict).
  b.setCaller(PROVIDER);
  await b.requestAdjudication(reqId);
  // maxRounds=1; round becomes 1 during fireAgent. Resolve with NeedMoreEvidence so
  // the state lands in EvidenceRequested (mirrors contract's submitEvidence round-cap path).
  b.resolve(reqId, Decision.NeedMoreEvidence);
  assert.equal(await b.stateOf(reqId), State.EvidenceRequested);
  // round is now 1 == maxRounds. submitEvidence should deadlock instead of re-firing.
  b.setCaller(PROVIDER);
  await b.submitEvidence(reqId, EVIDENCE_URI);
  assert.equal(await b.stateOf(reqId), State.Deadlocked, "submitEvidence at round cap must → Deadlocked");
  const n = await b.getNegotiation(reqId);
  assert.equal(n.escrowAmount, 0n, "escrowAmount must be 0 after submitEvidence → Deadlocked");
});
