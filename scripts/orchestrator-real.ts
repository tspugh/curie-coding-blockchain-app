#!/usr/bin/env tsx
/**
 * Self-hosted necessity-arbiter orchestrator (Amendment 0006).
 *
 * Long-running script that acts as the agent platform from the deployed
 * `CoverageNegotiation` contract's point of view. When the contract is in
 * selfHosted mode (Amendment 0006 Tick B, contract commit 9db79d7), every
 * `requestAdjudication` / `submitEvidence` / `appeal` emits a
 * `RulingRequested(reqId, requestId, fee)` event. This script subscribes to
 * those events, reads the negotiation context, computes a ruling, encodes the
 * 10-tuple result the contract decodes, and submits it back via
 * `handleResponse` from the orchestrator wallet (== platform address).
 *
 * THIS LANDING (R25 Tick A, tick 120):
 * - Chain plumbing: event subscription, contract reads, handleResponse calls.
 * - STUB ruling logic: always Approve with deterministic costPlus / NADAC.
 *   The actual LLM call (Claude via the Anthropic SDK per Amendment 0006
 *   OQ-0006-1) is queued as the next-tick swap — replace `computeStubRuling`
 *   with the LLM-driven version. The chain plumbing here is the load-bearing
 *   risk; the LLM is just a function-shape swap.
 *
 * Reads from .env:
 *   VITE_PRIVATE_KEY            — orchestrator's signing key (== platform addr)
 *   VITE_CONTRACT_ADDRESS       — deployed CoverageNegotiation address (must
 *                                 have been redeployed AND configured via
 *                                 setPlatformSelfHosted(orchestratorAddr))
 *   VITE_RPC_URL                — Somnia testnet RPC (default: testnet)
 *   ORCHESTRATOR_POLL_MS        — fallback poll interval if WS subscription
 *                                 drops (default: 10_000)
 *
 * Usage:
 *   tsx scripts/orchestrator-real.ts                # subscribe + serve forever
 *   tsx scripts/orchestrator-real.ts --once         # process one event then exit
 *
 * Exit codes:
 *   0  — normal shutdown (SIGINT/SIGTERM)
 *   2  — env or contract misconfiguration (orchestrator not the configured
 *        platform; selfHosted not enabled; missing env var)
 *   3  — RPC / WebSocket connection failure that cannot be recovered
 */

import { existsSync, readFileSync } from "node:fs";
import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Env loader (mirrors scripts/register-agent.mjs — no dotenv dep)
// ---------------------------------------------------------------------------

function loadEnv(path = ".env"): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    v = v.replace(/^["']|["']$/g, "");
    out[m[1]] = v;
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };

function require_(name: string): string {
  const v = env[name];
  if (!v || v.length === 0) {
    console.error(`ERROR: ${name} not set in .env or environment`);
    process.exit(2);
  }
  return v;
}

const PRIVATE_KEY = require_("VITE_PRIVATE_KEY");
const CONTRACT_ADDRESS = require_("VITE_CONTRACT_ADDRESS");
const RPC_URL = env.VITE_RPC_URL ?? env.RPC_URL ?? "https://api.infra.testnet.somnia.network/";
const POLL_MS = Number(env.ORCHESTRATOR_POLL_MS ?? "10000");
const ONCE = process.argv.includes("--once");

// ---------------------------------------------------------------------------
// Minimal ABI — only what the orchestrator needs. handleResponse takes the
// full (Response[], ResponseStatus, Request) tuple even though the contract
// ignores the Request struct after the platform-address gate.
// ---------------------------------------------------------------------------

const CONTRACT_ABI = [
  "function selfHosted() external view returns (bool)",
  "function platform() external view returns (address)",
  "function getNegotiation(uint256 reqId) external view returns (tuple(uint256 providerId, uint256 insurerId, address providerAddr, address insurerAddr, bytes32 drugRef, uint256 requestedAmount, uint256 quantity, uint256 daysSupply, bytes32 justificationHash, bytes32 evidenceUri, bytes32 policyHash, bytes32 policyUri, uint256 coveredAmount, uint256 costPlusUnitPrice, uint256 nadacUnitPrice, bytes32 rationaleHash, bytes32 clauseRef, bytes32 standardRef, uint8 lastDecision, bool hasRuling, uint256 round, uint8 payerLine, uint8 appealRound, bool providerAccepted, bool insurerAccepted, uint256 totalFees, uint8 state, uint256 pendingRequestId, uint256 createdAt, uint256 rulingDeadline, bool exists))",
  "function handleResponse(uint256 requestId, tuple(address validator, bytes result, uint8 status, uint256 receipt, uint256 timestamp, uint256 executionCost)[] responses, uint8 status, tuple(uint256 id, address requester, address callbackAddress, bytes4 callbackSelector, address[] subcommittee, tuple(address validator, bytes result, uint8 status, uint256 receipt, uint256 timestamp, uint256 executionCost)[] responses, uint256 responseCount, uint256 failureCount, uint256 threshold, uint256 createdAt, uint256 deadline, uint8 status_, uint8 consensusType, uint256 remainingBudget, uint256 perAgentBudget) request) external",
  "event RulingRequested(uint256 indexed reqId, uint256 indexed requestId, uint256 fee)",
] as const;

// Decision enum mirrors contracts/contracts/CoverageNegotiation.sol :91-96.
const Decision = { Approve: 0, Deny: 1, NeedMoreEvidence: 2, PolicyInvalid: 3 } as const;
const ResponseStatus = { None: 0, Pending: 1, Success: 2, Failed: 3, TimedOut: 4 } as const;

interface NegotiationRow {
  requestedAmount: bigint;
  quantity: bigint;
  // ... lots more, but the stub only reads these.
}

// ---------------------------------------------------------------------------
// Stub ruling — to be replaced by Claude SDK call in the next tick.
// Returns Approve with costPlus=200 wei and NADAC=180 wei (both per-unit),
// so the contract's deterministic cap = min(requested, 200*quantity).
// ---------------------------------------------------------------------------

interface StubRuling {
  decision: number;
  costPlusUnitPrice: bigint;
  nadacUnitPrice: bigint;
  rationaleHash: string;
  clauseRef: string;
  standardRef: string;
  receiptId: bigint;
  policyVoidedClauseIndices: number[];
  usedReferenceIndices: number[];
  usedLeafHashes: string[];
}

function computeStubRuling(_n: NegotiationRow): StubRuling {
  const ZERO_HASH = "0x" + "00".repeat(32);
  return {
    decision: Decision.Approve,
    costPlusUnitPrice: 200n,
    nadacUnitPrice: 180n,
    rationaleHash: ethers.id("stub:approve:rationale"),
    clauseRef: ethers.id("stub:approve:clause"),
    standardRef: ZERO_HASH,
    receiptId: 0n,
    policyVoidedClauseIndices: [],
    usedReferenceIndices: [],
    usedLeafHashes: [],
  };
}

// ---------------------------------------------------------------------------
// Ruling encoder — produces the bytes the contract decodes (10-tuple).
// Tuple order must match `_fireAgent` → handleResponse decoder.
// ---------------------------------------------------------------------------

function encodeRuling(r: StubRuling): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "uint8", "uint256", "uint256",
      "bytes32", "bytes32", "bytes32",
      "uint256",
      "uint16[]", "uint16[]", "bytes32[]",
    ],
    [
      r.decision, r.costPlusUnitPrice, r.nadacUnitPrice,
      r.rationaleHash, r.clauseRef, r.standardRef,
      r.receiptId,
      r.policyVoidedClauseIndices, r.usedReferenceIndices, r.usedLeafHashes,
    ],
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

  console.log(`orchestrator wallet: ${wallet.address}`);
  console.log(`contract:            ${CONTRACT_ADDRESS}`);
  console.log(`rpc:                 ${RPC_URL}`);

  const isSelfHosted = await contract.selfHosted();
  const platformAddr = await contract.platform();
  if (!isSelfHosted) {
    console.error("ERROR: contract is NOT in selfHosted mode. Run setPlatformSelfHosted first.");
    process.exit(2);
  }
  if (platformAddr.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(`ERROR: contract.platform() = ${platformAddr}; orchestrator wallet = ${wallet.address}. Mismatch — handleResponse would revert with "callback: not platform".`);
    process.exit(2);
  }
  console.log("✓ contract is in selfHosted mode AND platform == orchestrator wallet");

  const emptyRequest = makeEmptyRequest(CONTRACT_ADDRESS);

  async function handleEvent(reqId: bigint, requestId: bigint) {
    console.log(`[reqId=${reqId} requestId=${requestId}] processing`);
    const n = await contract.getNegotiation(reqId);
    const ruling = computeStubRuling(n);
    const response = {
      validator: wallet.address,
      result: encodeRuling(ruling),
      status: ResponseStatus.Success,
      receipt: ruling.receiptId,
      timestamp: 0n,
      executionCost: 0n,
    };
    const tx = await contract.handleResponse(requestId, [response], ResponseStatus.Success, emptyRequest);
    const receipt = await tx.wait();
    console.log(`[reqId=${reqId}] ruling delivered: decision=${ruling.decision} tx=${receipt?.hash ?? tx.hash}`);
  }

  contract.on(
    "RulingRequested",
    async (reqId: bigint, requestId: bigint) => {
      try {
        await handleEvent(reqId, requestId);
        if (ONCE) {
          console.log("--once: exiting after first event");
          process.exit(0);
        }
      } catch (err) {
        console.error(`[reqId=${reqId} requestId=${requestId}] handler failed:`, err);
      }
    },
  );

  console.log(`subscribed to RulingRequested; ${ONCE ? "--once mode" : "serving forever"} (Ctrl-C to exit)`);

  // Belt + braces: the WebSocket subscription via contract.on uses HTTP polling
  // when the provider doesn't have a WS endpoint. Either way, the script holds
  // open via the polling loop ethers maintains. No manual keep-alive needed.

  process.on("SIGINT", () => { console.log("SIGINT — shutting down"); process.exit(0); });
  process.on("SIGTERM", () => { console.log("SIGTERM — shutting down"); process.exit(0); });

  void POLL_MS; // reserved for explicit poll fallback in a future tick
}

function makeEmptyRequest(contractAddress: string) {
  return {
    id: 0n,
    requester: contractAddress,
    callbackAddress: contractAddress,
    callbackSelector: "0x00000000",
    subcommittee: [],
    responses: [],
    responseCount: 0n,
    failureCount: 0n,
    threshold: 0n,
    createdAt: 0n,
    deadline: 0n,
    status_: ResponseStatus.Success,
    consensusType: 0,
    remainingBudget: 0n,
    perAgentBudget: 0n,
  };
}

main().catch((err) => { console.error(err); process.exit(3); });
