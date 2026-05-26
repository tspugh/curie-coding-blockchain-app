/**
 * Real-backend integration test against a LOCAL Hardhat node (SPEC-0001 T7/R11/R16).
 *
 * Exercises the library's REAL code path — `RealBackend` (ethers v6 vs a *deployed*
 * contract + live event subscription) — without a funded testnet wallet, by:
 *   1. deploying MockAgentPlatform + CoverageNegotiation to a local Hardhat node,
 *   2. driving the full lifecycle through `RealBackend` (the same
 *      `CoverageNegotiationClient` interface the web app uses),
 *   3. delivering the agent ruling via the mock platform's callback (the real
 *      Somnia native-agent execution is the ONLY part that needs testnet — R9),
 *   4. cross-checking that `SimulatedBackend` produces the IDENTICAL state
 *      sequence (proving "same code path in both modes" — R11), and
 *   5. confirming the live event subscription delivers the timeline (R16).
 *
 * Run via scripts/real-backend-localnode.sh (starts the node, builds, tears down).
 * Reads the compiled Hardhat artifacts from contracts/artifacts/ and the library
 * from dist/ — so `npm run build` and a contracts compile must precede it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

import { RealBackend } from "../dist/contract/real.js";
import { SimulatedBackend } from "../dist/contract/simulated.js";
import { State, STATE_NAMES } from "../dist/types/coverage.types.js";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
// Hardhat node's deterministic account #0 — a throwaway local key, never real funds.
const KEY = process.env.LOCAL_KEY ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const AGENT_ID = 7n;

const ZERO = ethers.ZeroHash;
const DRUG = ethers.id("DRUG:adalimumab");
const NOTE = ethers.id("synthetic-note-content");
const FLOOR = 1000n;
const CEIL = 2000n;
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
    initiatorId: 11n,
    destinationId: 22n,
    drugRef: DRUG,
    noteHash: NOTE,
    priceFloor: FLOOR,
    priceCeil: CEIL,
    evidenceUri: ZERO,
  });
  await snap(reqId);
  check("createContract -> Open (reqId returned)", reqId === 1n && realStates.at(-1) === State.Open);

  // R4: only the hash is on-chain — the getter exposes no raw-content field.
  const n0 = await real.getNegotiation(reqId);
  check("on-chain record carries the note HASH, not content", n0.noteHash === NOTE);

  await real.submitPosition({ reqId, partyId: 11n, proposedAmount: 1200n, contentHash: ZERO, uri: ZERO });
  await snap(reqId);
  check("one position -> still Open (R5)", realStates.at(-1) === State.Open);

  await real.submitPosition({ reqId, partyId: 22n, proposedAmount: 1800n, contentHash: ZERO, uri: ZERO });
  await snap(reqId);
  check("both positions -> Ready (R5)", realStates.at(-1) === State.Ready);

  await real.submitDispute(reqId, 11n);
  await snap(reqId);
  check("submitDispute fires the agent -> UnderReview (R6/R9)", realStates.at(-1) === State.UnderReview);

  // Deliver the ruling the way the platform would: callback into the contract.
  const mockAsSigner = new ethers.Contract(mockAddr, mockArt.abi, signer);
  const requestId = await mockAsSigner.lastRequestId();
  await (await mockAsSigner.triggerRuling(contractAddr, requestId, "approve", 123n)).wait();
  await snap(reqId);
  check("platform callback (approve) -> Approved", realStates.at(-1) === State.Approved);

  await real.settle(reqId, 1500n);
  await snap(reqId);
  const nFinal = await real.getNegotiation(reqId);
  check("settle within band -> Settled, agreed recorded", realStates.at(-1) === State.Settled && nFinal.agreedAmount === 1500n);

  // --- R16: the subscription delivered the key timeline events ---
  const got = await until(() => {
    const names = new Set(events.map((e) => e.name));
    return ["ContractCreated", "ContractReady", "RulingRequested", "Ruled", "Settled"].every((x) => names.has(x));
  });
  check("live subscription delivered the timeline (R16)", got);
  const ruled = events.find((e) => e.name === "Ruled");
  check("Ruled event carries the agent verdict + receipt", ruled?.verdict === "approve" && ruled?.receiptId === 123n);

  unsub();
  await real.close();

  // --- R11/T7: SimulatedBackend yields the IDENTICAL state sequence ---
  const sim = new SimulatedBackend({ autoResolve: false });
  const simStates = [];
  const sreqId = await sim.createContract({
    initiatorId: 11n, destinationId: 22n, drugRef: DRUG, noteHash: NOTE,
    priceFloor: FLOOR, priceCeil: CEIL, evidenceUri: ZERO,
  });
  simStates.push(await sim.stateOf(sreqId));
  await sim.submitPosition({ reqId: sreqId, partyId: 11n, proposedAmount: 1200n, contentHash: ZERO, uri: ZERO });
  simStates.push(await sim.stateOf(sreqId));
  await sim.submitPosition({ reqId: sreqId, partyId: 22n, proposedAmount: 1800n, contentHash: ZERO, uri: ZERO });
  simStates.push(await sim.stateOf(sreqId));
  await sim.submitDispute(sreqId, 11n);
  simStates.push(await sim.stateOf(sreqId));
  sim.resolve(sreqId, "approve");
  simStates.push(await sim.stateOf(sreqId));
  await sim.settle(sreqId, 1500n);
  simStates.push(await sim.stateOf(sreqId));
  await sim.close();

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
