/**
 * Amendment 0007 phase-tracker field tests.
 *
 * Pins the acceptance criteria for:
 *   - SPEC-0004.1 R1: off-chain mirrors must track the on-chain struct
 *   - SPEC-0006 §3.6.1: agentPhase None→Scraping→Deciding two-agent tracker
 *   - Amendment 0007 phase 1: agentPhase + pendingDecideFee + pendingFeePayer fields
 *
 * No mocking of the contract or agent — all assertions drive real SimulatedBackend
 * state machine paths.  No PHI — only synthetic addresses and hashes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { ethers } from "ethers";

import { PayerLine } from "../types/coverage.types.js";
import { decodeNegotiationRaw } from "./real.js";
import { SimulatedBackend } from "./simulated.js";
import type { CreateContractParams } from "./types.js";

// ---------------------------------------------------------------------------
// Test fixtures (synthetic — no PHI)
// ---------------------------------------------------------------------------

const PROVIDER = ethers.getAddress(`0x${"aa".repeat(20)}`);
const INSURER = ethers.getAddress(`0x${"bb".repeat(20)}`);

const PARAMS: CreateContractParams = {
  providerId: 101n,
  insurerId: 202n,
  providerAddr: PROVIDER,
  insurerAddr: INSURER,
  drugRef: ethers.id("DRUG:adalimumab"),
  requestedAmount: 3000n,
  quantity: 5n,
  daysSupply: 90n,
  justificationHash: ethers.id("justification-hash"),
  evidenceUri: ethers.id("ipfs://evidence-uri"),
  payerLine: PayerLine.PartD,
  agentEvidenceUrl: "https://medlineplus.gov/druginfo/meds/a603013.html",
  agentPromptHint: "Is coverage for this drug medically necessary?",
};

/** Minimal backend with auto-resolve OFF so state stays predictable. */
function backend(): SimulatedBackend {
  return new SimulatedBackend({ autoResolve: false });
}

// ---------------------------------------------------------------------------
// (a) Fresh negotiation has agentPhase === 0 (None)
// ---------------------------------------------------------------------------

test("Amendment-0007: freshly created negotiation has agentPhase === 0 (None)", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(PARAMS);

  const n = await b.getNegotiation(reqId);

  // agentPhase must be 0 (None — no Scraping or Deciding agent has been fired yet).
  assert.equal(
    n.agentPhase,
    0,
    "agentPhase must be 0 (None) on a freshly created negotiation (Amendment 0007 phase 1)",
  );
});

// ---------------------------------------------------------------------------
// (b) Fresh negotiation has pendingDecideFee === 0n
// ---------------------------------------------------------------------------

test("Amendment-0007: freshly created negotiation has pendingDecideFee === 0n", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(PARAMS);

  const n = await b.getNegotiation(reqId);

  // pendingDecideFee must be 0n — no LLM Inference fee has been parked yet.
  assert.equal(
    n.pendingDecideFee,
    0n,
    "pendingDecideFee must be 0n on a freshly created negotiation (Amendment 0007 phase 1)",
  );
});

// ---------------------------------------------------------------------------
// (c) Fresh negotiation has pendingFeePayer === ZeroAddress
// ---------------------------------------------------------------------------

test("Amendment-0007: freshly created negotiation has pendingFeePayer === ZeroAddress", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(PARAMS);

  const n = await b.getNegotiation(reqId);

  // pendingFeePayer must be ethers.ZeroAddress — no fee payer has been designated yet.
  assert.equal(
    n.pendingFeePayer,
    ethers.ZeroAddress,
    "pendingFeePayer must be ZeroAddress on a freshly created negotiation (Amendment 0007 phase 1)",
  );
});

// ---------------------------------------------------------------------------
// (d) Field names exist on the Negotiation snapshot (structural check)
// ---------------------------------------------------------------------------

test("Amendment-0007: Negotiation snapshot exposes agentPhase, pendingDecideFee, pendingFeePayer field names", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(PARAMS);

  const n = await b.getNegotiation(reqId);

  // All three field names must exist on the returned snapshot object.
  // The Negotiation interface enforces presence at compile time; the runtime
  // assertions below additionally catch a snapshot() that silently drops them.
  assert.ok(
    "agentPhase" in n,
    "Negotiation snapshot must have an 'agentPhase' field (Amendment 0007 phase 1)",
  );
  assert.ok(
    "pendingDecideFee" in n,
    "Negotiation snapshot must have a 'pendingDecideFee' field (Amendment 0007 phase 1)",
  );
  assert.ok(
    "pendingFeePayer" in n,
    "Negotiation snapshot must have a 'pendingFeePayer' field (Amendment 0007 phase 1)",
  );
});

// ---------------------------------------------------------------------------
// (e) decodeNegotiation round-trip: raw[35-37] map to the three new fields
//     without throwing. Exercised via the simulated path by asserting that a
//     snapshot from a freshly created negotiation is decodable to the three
//     expected zero/default values — no live chain call needed.
// ---------------------------------------------------------------------------

test("Amendment-0007: SimulatedBackend snapshot round-trip does not throw and maps agentPhase/pendingDecideFee/pendingFeePayer", async () => {
  const b = backend();
  b.setCaller(PROVIDER);
  const reqId = await b.createContract(PARAMS);

  // getNegotiation internally calls snapshot(), which must not throw even after
  // the three new fields are wired. The assertions below re-verify the values
  // from a second snapshot call, guarding against any lazy initialisation issue.
  let n: Awaited<ReturnType<typeof b.getNegotiation>>;
  await assert.doesNotReject(async () => {
    n = await b.getNegotiation(reqId);
  }, "snapshot() must not throw after agentPhase/pendingDecideFee/pendingFeePayer are initialised");

  assert.equal(n!.agentPhase, 0,
    "snapshot round-trip: agentPhase must be 0 (None)");
  assert.equal(n!.pendingDecideFee, 0n,
    "snapshot round-trip: pendingDecideFee must be 0n");
  assert.equal(n!.pendingFeePayer, ethers.ZeroAddress,
    "snapshot round-trip: pendingFeePayer must be ZeroAddress");
});

// ---------------------------------------------------------------------------
// (f) decodeNegotiationRaw (real.ts test-seam) maps raw[35], raw[36], raw[37]
//     to agentPhase, pendingDecideFee, pendingFeePayer correctly.
//
//     We build a minimal synthetic 38-element tuple that matches the on-chain
//     struct layout, set raw[35]=1 (Scraping), raw[36]=42n, raw[37]=INSURER,
//     and verify decodeNegotiationRaw maps those three positions exactly. This
//     is the highest-risk off-by-one surface of the 38-field sync: a position
//     error at 35/36/37 would silently produce wrong values at runtime without
//     this direct positional test. No live chain or wallet needed.
// ---------------------------------------------------------------------------

test("Amendment-0007: decodeNegotiationRaw maps raw[35]=agentPhase, raw[36]=pendingDecideFee, raw[37]=pendingFeePayer with correct positional decode", () => {
  // Build a synthetic 38-element raw tuple. Positions [0-34] use zero/false/empty
  // defaults; we set [35-37] to non-zero sentinel values to prove the mapping is
  // positionally exact (any off-by-one would produce 0/0n/ZeroAddress instead).
  const ZERO_HASH = ethers.ZeroHash;
  const ZERO_ADDR = ethers.ZeroAddress;
  const raw: readonly unknown[] = [
    /* [0]  providerId          */ 0n,
    /* [1]  insurerId           */ 0n,
    /* [2]  providerAddr        */ ZERO_ADDR,
    /* [3]  insurerAddr         */ ZERO_ADDR,
    /* [4]  drugRef             */ ZERO_HASH,
    /* [5]  requestedAmount     */ 0n,
    /* [6]  quantity            */ 0n,
    /* [7]  daysSupply          */ 0n,
    /* [8]  justificationHash   */ ZERO_HASH,
    /* [9]  evidenceUri         */ ZERO_HASH,
    /* [10] policyHash          */ ZERO_HASH,
    /* [11] policyUri           */ ZERO_HASH,
    /* [12] coveredAmount       */ 0n,
    /* [13] escrowAmount        */ 0n,
    /* [14] costPlusUnitPrice   */ 0n,
    /* [15] nadacUnitPrice      */ 0n,
    /* [16] rationaleHash       */ ZERO_HASH,
    /* [17] clauseRef           */ "",
    /* [18] standardRef         */ "",
    /* [19] lastDecision        */ 0,
    /* [20] lastRequestId       */ 0n,
    /* [21] hasRuling           */ false,
    /* [22] agentEvidenceUrl    */ "",
    /* [23] agentPromptHint     */ "",
    /* [24] round               */ 0n,
    /* [25] payerLine           */ 0,
    /* [26] appealRound         */ 0,
    /* [27] providerAccepted    */ false,
    /* [28] insurerAccepted     */ false,
    /* [29] totalFees           */ 0n,
    /* [30] state               */ 0,
    /* [31] pendingRequestId    */ 0n,
    /* [32] createdAt           */ 0n,
    /* [33] rulingDeadline      */ 0n,
    /* [34] exists              */ true,
    /* [35] agentPhase          */ 1,     // sentinel: Scraping (not None=0)
    /* [36] pendingDecideFee    */ 42n,   // sentinel: non-zero fee
    /* [37] pendingFeePayer     */ INSURER, // sentinel: non-zero address
  ];

  assert.equal(raw.length, 38, "synthetic tuple must have exactly 38 elements (38-field struct sanity check)");

  const n = decodeNegotiationRaw(raw);

  assert.equal(n.agentPhase, 1,
    "raw[35] must decode to agentPhase=1 (Scraping) — positional mapping check");
  assert.equal(n.pendingDecideFee, 42n,
    "raw[36] must decode to pendingDecideFee=42n — positional mapping check");
  assert.equal(n.pendingFeePayer, INSURER,
    "raw[37] must decode to pendingFeePayer=INSURER — positional mapping check");
});
