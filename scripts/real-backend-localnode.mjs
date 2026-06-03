/**
 * Real-backend integration test against a LOCAL Hardhat node (SPEC-0001 T7/R11/R16,
 * revised 2026-05-27 — AI necessity-arbiter model).
 *
 * Exercises the library's REAL code path — `RealBackend` (ethers v6 vs a *deployed*
 * contract + live event subscription) — without a funded testnet wallet, by:
 *   1. deploying MockAgentPlatform + CoverageNegotiation to a local Hardhat node,
 *   2. driving the full lifecycle through `RealBackend` (the same
 *      `CoverageNegotiationClient` interface the web app uses),
 *   3. delivering the necessity ruling via the mock platform's callback (the real
 *      Somnia native-agent execution is the ONLY part that needs testnet — R9),
 *   4. cross-checking that `SimulatedBackend` produces the IDENTICAL state
 *      sequence (proving "same code path in both modes" — R11/R14), and
 *   5. confirming the live event subscription delivers the timeline (R16).
 *
 * Flow: Open -> Ready -> UnderReview -> Approved -> Settled.
 *
 * Run via scripts/real-backend-localnode.sh (starts the node, builds, tears down).
 * Reads the compiled Hardhat artifacts from contracts/artifacts/ and the library
 * from dist/ — so `npm run build` and a contracts compile must precede it.
 *
 * SPEC-0006 R11/R24: MockAgentPlatform.triggerRuling now takes a single string
 * decision token (e.g. "approve") instead of the old 10-field struct. The
 * contract's handleResponse decodes that string and maps it to a Decision.
 * On approve, coveredAmount = requestedAmount (no AI-chosen price cap).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

import { RealBackend } from "../dist/contract/real.js";
import { SimulatedBackend } from "../dist/contract/simulated.js";
import { Decision, State, STATE_NAMES } from "../dist/types/coverage.types.js";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
// Hardhat node's deterministic account #0 — a throwaway local key, never real funds.
const KEY = process.env.LOCAL_KEY ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
// SPEC-0004 R2b: providerAddr != insurerAddr per request. The Hardhat node ships
// with 10 pre-funded accounts; use #1 as the insurer-side default so the localnode
// harness exercises the multi-wallet model.
const INSURER_KEY = process.env.LOCAL_INSURER_KEY ?? "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const AGENT_ID = 7n;

const ZERO = ethers.ZeroHash;
const DRUG = ethers.id("DRUG:adalimumab");
const JUSTIFICATION = ethers.id("synthetic-justification-content");
const POLICY = ethers.id("insurer-policy-body");
const POLICY_URI = ethers.id("insurer-policy-uri");
const REQUESTED = 2000n;
const QUANTITY = 2n; // dispensed units
const DAYS_SUPPLY = 28n; // clinical context only — never enters the price math (R2)
// In string-token mode, approve sets coveredAmount = requestedAmount (no AI price cap).
const COVERED_ON_APPROVE = REQUESTED;
const FEE = ethers.parseEther("0.01"); // > mock deposit (0.001)

function artifact(rel) {
  const path = fileURLToPath(new URL(`../contracts/artifacts/${rel}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Wait until `pred()` is true or `ms` elapses (for async event delivery). */
async function until(pred, ms = 10000, step = 100) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, step));
  }
  return false;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  provider.pollingInterval = 150; // snappy event polling for the test
  // NonceManager serializes nonces across the rapid back-to-back deploys/sends.
  const baseSigner = new ethers.Wallet(KEY, provider);
  const address = baseSigner.address;
  const signer = new ethers.NonceManager(baseSigner);
  // Insurer-side signer (SPEC-0004 R2b: distinct from provider for createContract).
  const insurerAddress = new ethers.Wallet(INSURER_KEY, provider).address;

  // --- Deploy the mock platform + the contract to the local node ---
  const mockArt = artifact("contracts/mocks/MockAgentPlatform.sol/MockAgentPlatform.json");
  const covArt = artifact("contracts/CoverageNegotiation.sol/CoverageNegotiation.json");

  const mock = await new ethers.ContractFactory(mockArt.abi, mockArt.bytecode, signer).deploy();
  await mock.waitForDeployment();
  const mockAddr = await mock.getAddress();

  const contract = await new ethers.ContractFactory(covArt.abi, covArt.bytecode, signer).deploy(
    mockAddr,
    AGENT_ID,
  );
  await contract.waitForDeployment();
  const contractAddr = await contract.getAddress();

  // --- Build the REAL backend over a structural RealWallet (provider+signer) ---
  // The provider sends txs; `insurerAddress` is the distinct counterparty per R2b.
  const wallet = { mode: "real", address, signer, provider };
  const real = new RealBackend(wallet, { contractAddress: contractAddr, agentFeeValue: FEE });

  // R16: live event subscription — collect the timeline as it lands.
  const events = [];
  const unsub = real.subscribe((e) => events.push(e));

  // Record the observed state after each step, to compare against simulated.
  const realStates = [];
  const snap = async (reqId) => realStates.push(Number(await real.stateOf(reqId)));

  let passed = 0;
  const check = (desc, cond) => {
    assert.ok(cond, desc);
    console.log(`  ✓ ${desc}`);
    passed += 1;
  };

  // --- Drive the full lifecycle through RealBackend ---
  const reqId = await real.createContract({
    providerId: 11n,
    insurerId: 22n,
    providerAddr: address,
    insurerAddr: insurerAddress,
    payerLine: 0, // PayerLine.PartD
    drugRef: DRUG,
    requestedAmount: REQUESTED,
    quantity: QUANTITY,
    daysSupply: DAYS_SUPPLY,
    justificationHash: JUSTIFICATION,
    evidenceUri: ZERO,
    agentEvidenceUrl: "https://medlineplus.gov/druginfo/meds/a603010.html",
    agentPromptHint: "Is this drug medically necessary for the patient's condition?",
  });
  await snap(reqId);
  check("createContract -> Open (reqId returned)", reqId === 1n && realStates.at(-1) === State.Open);

  // R4: only the hash is on-chain — the getter exposes no raw-content field.
  const n0 = await real.getNegotiation(reqId);
  check("on-chain record carries the justification HASH, not content", n0.justificationHash === JUSTIFICATION);

  await real.insurerEngage(reqId, POLICY, POLICY_URI);
  await snap(reqId);
  check("insurerEngage attaches policy -> Ready (R5)", realStates.at(-1) === State.Ready);
  const pol = await real.policyOf(reqId);
  check("policyOf returns the attached commitment (R5)", pol.policyHash === POLICY && pol.policyUri === POLICY_URI);

  await real.requestAdjudication(reqId);
  await snap(reqId);
  check("requestAdjudication fires the agent -> UnderReview (R6/R9)", realStates.at(-1) === State.UnderReview);

  // Deliver the ruling the way the platform would: callback into the contract.
  // SPEC-0006 R11/R24: MockAgentPlatform.triggerRuling takes a single string token
  // (the inferString return value). The contract decodes it into a Decision enum.
  const mockAsSigner = new ethers.Contract(mockAddr, mockArt.abi, signer);
  const requestId = await mockAsSigner.lastRequestId();
  await (await mockAsSigner.triggerRuling(contractAddr, requestId, "approve")).wait();
  await snap(reqId);
  check("platform callback (approve) -> Approved", realStates.at(-1) === State.Approved);

  // In string-token mode, approve sets coveredAmount = requestedAmount (SPEC-0006).
  const covered = await real.coveredAmountOf(reqId);
  check(
    "covered amount equals requestedAmount on approve (string-token model — SPEC-0006)",
    covered === COVERED_ON_APPROVE && covered === REQUESTED,
  );

  // Both parties accept the ruling, then settle (single wallet acts as both — R12).
  await real.accept(reqId, 11n);
  await real.accept(reqId, 22n);
  await real.settle(reqId);
  await snap(reqId);
  const nFinal = await real.getNegotiation(reqId);
  check(
    "both accept + settle -> Settled, covered recorded",
    realStates.at(-1) === State.Settled && nFinal.coveredAmount === COVERED_ON_APPROVE,
  );

  // --- R16: the subscription delivered the key timeline events ---
  const got = await until(() => {
    const names = new Set(events.map((e) => e.name));
    return ["ContractCreated", "ContractReady", "RulingRequested", "Ruled", "Accepted", "Settled"].every((x) =>
      names.has(x),
    );
  });
  check("live subscription delivered the timeline (R16)", got);
  const ruled = events.find((e) => e.name === "Ruled");
  // New 4-arg Ruled event: (reqId, requestId, decision, coveredAmount) — SPEC-0006 R24.
  check(
    "Ruled event carries the decision + coveredAmount (new 4-arg shape — SPEC-0006 R24)",
    ruled?.decision === Decision.Approve && ruled?.coveredAmount === COVERED_ON_APPROVE,
  );

  // --- T10/R16: reconstruct the timeline from eth_getLogs, independently ---
  // A FRESH backend with no live subscription rebuilds the full history from logs.
  const fresh = new RealBackend(wallet, { contractAddress: contractAddr });
  const history = await fresh.getEvents({ reqId });
  const histNames = history.map((e) => e.name);
  check(
    `getEvents reconstructs the timeline from eth_getLogs (R16/T10): [${histNames.join(", ")}]`,
    ["ContractCreated", "InsurerEngaged", "ContractReady", "AdjudicationRequested", "RulingRequested", "Ruled", "Accepted", "Settled"].every(
      (n) => histNames.includes(n),
    ),
  );
  check(
    "reconstructed events are chronological with block metadata",
    history.length >= 8 &&
      history.every((e) => typeof e.blockNumber === "number") &&
      history.every((e, i) => i === 0 || e.blockNumber >= history[i - 1].blockNumber),
  );
  const ruledFromLogs = history.find((e) => e.name === "Ruled");
  check(
    "reconstructed Ruled carries decision + coveredAmount (new 4-arg shape)",
    ruledFromLogs?.decision === Decision.Approve && ruledFromLogs?.coveredAmount === COVERED_ON_APPROVE,
  );
  await fresh.close();

  unsub();
  await real.close();

  // --- R11/T7: SimulatedBackend yields the IDENTICAL state sequence ---
  const sim = new SimulatedBackend({
    autoResolve: false,
    decision: Decision.Approve,
  });
  const simStates = [];
  const sreqId = await sim.createContract({
    providerId: 11n,
    insurerId: 22n,
    providerAddr: address,
    insurerAddr: insurerAddress,
    payerLine: 0, // PayerLine.PartD
    drugRef: DRUG,
    requestedAmount: REQUESTED,
    quantity: QUANTITY,
    daysSupply: DAYS_SUPPLY,
    justificationHash: JUSTIFICATION,
    evidenceUri: ZERO,
    agentEvidenceUrl: "https://medlineplus.gov/druginfo/meds/a603010.html",
    agentPromptHint: "Is this drug medically necessary for the patient's condition?",
  });
  simStates.push(await sim.stateOf(sreqId));
  await sim.insurerEngage(sreqId, POLICY, POLICY_URI);
  simStates.push(await sim.stateOf(sreqId));
  await sim.requestAdjudication(sreqId);
  simStates.push(await sim.stateOf(sreqId));
  sim.resolve(sreqId, Decision.Approve);
  simStates.push(await sim.stateOf(sreqId));
  await sim.accept(sreqId, 11n);
  await sim.accept(sreqId, 22n);
  await sim.settle(sreqId);
  simStates.push(await sim.stateOf(sreqId));

  // In string-token mode, covered = requestedAmount on approve.
  check(
    "simulated covered amount equals requestedAmount on approve (string-token model)",
    (await sim.coveredAmountOf(sreqId)) === REQUESTED,
  );

  // The simulated backend exposes the same getEvents() reconstruction (R16/T10).
  const simHistory = await sim.getEvents({ reqId: sreqId });
  check(
    `simulated getEvents returns the recorded timeline: [${simHistory.map((e) => e.name).join(", ")}]`,
    simHistory.length >= 6 && simHistory[0]?.name === "ContractCreated" && simHistory.at(-1)?.name === "Settled",
  );
  await sim.close();

  // The real sequence has one extra UnderReview-vs-Approved snapshot alignment;
  // both should read: Open, Ready, UnderReview, Approved, Settled.
  check(
    `simulated & real share the SAME state sequence (R11): [${simStates.map((s) => STATE_NAMES[s]).join(" -> ")}]`,
    JSON.stringify(simStates) === JSON.stringify(realStates),
  );

  console.log(`\nreal-backend local-node integration: ${passed} checks passed`);
  provider.destroy();
}

main().catch((err) => {
  console.error("\n✗ real-backend integration FAILED:", err.message ?? err);
  process.exit(1);
});
