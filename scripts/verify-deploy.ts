#!/usr/bin/env tsx
/**
 * verify-deploy — read-only sanity check that a deployed
 * `CoverageNegotiation` contract is correctly configured for SPEC-0006
 * canonical platform mode (LLM Inference agent, inferString selector).
 *
 * Reads from `.env`:
 *   VITE_PRIVATE_KEY      — used only to derive the operator address;
 *                           NO transactions are sent.
 *   VITE_CONTRACT_ADDRESS — the deployed contract to verify.
 *   VITE_RPC_URL          — optional override of the Somnia testnet RPC.
 *
 * Usage:
 *   npm run verify-deploy           # checks the configured contract
 *   tsx scripts/verify-deploy.ts    # same, standalone
 *
 * Exit codes:
 *   0 — all checks PASS
 *   1 — env missing, RPC failure, or one or more checks FAILED
 */

import { existsSync, readFileSync } from "node:fs";
import { ethers } from "ethers";

function loadEnv(path = ".env"): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2]!.trim();
    v = v.replace(/^["']|["']$/g, "");
    out[m[1]!] = v;
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };

function require_(name: string): string {
  const v = env[name];
  if (!v || v.length === 0) {
    console.error(`✗ verify-deploy: ${name} not set in .env or environment`);
    process.exit(1);
  }
  return v;
}

const PRIVATE_KEY = require_("VITE_PRIVATE_KEY");
const CONTRACT_ADDRESS = require_("VITE_CONTRACT_ADDRESS");
const RPC_URL =
  env.VITE_RPC_URL ?? env.RPC_URL ?? "https://api.infra.testnet.somnia.network/";

// Canonical LLM Inference agent id (SPEC-0006 R11).
const LLM_INFERENCE_AGENT_ID = 12847293847561029384n;

// Minimal view-only ABI — only what we need to check.
const ABI = [
  "function platform() external view returns (address)",
  "function agentId() external view returns (uint256)",
  "function agentReward() external view returns (uint256)",
  "function rulingTimeout() external view returns (uint256)",
  "function maxRounds() external view returns (uint256)",
  "function owner() external view returns (address)",
] as const;

interface Check {
  name: string;
  actual: string;
  expected?: string;
  pass: boolean;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const operatorAddr = wallet.address;
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  console.log(`verify-deploy`);
  console.log(`  rpc:      ${RPC_URL}`);
  console.log(`  contract: ${CONTRACT_ADDRESS}`);
  console.log(`  operator: ${operatorAddr}`);
  console.log();

  const checks: Check[] = [];

  // 1. Bytecode exists at the address.
  const code = await provider.getCode(CONTRACT_ADDRESS);
  const codeBytes = (code.length - 2) / 2;
  checks.push({
    name: "bytecode exists",
    actual: `${codeBytes} bytes`,
    pass: codeBytes > 0,
  });
  if (codeBytes === 0) {
    printResults(checks);
    process.exit(1);
  }

  // 2. platform is set (nonzero address — canonical platform mode).
  const platform: string = await contract.platform();
  checks.push({
    name: "platform set (nonzero)",
    actual: platform,
    pass: platform !== ethers.ZeroAddress,
  });

  // 3. agentId == canonical LLM Inference agent id (SPEC-0006 R11).
  const agentId: bigint = await contract.agentId();
  checks.push({
    name: "agentId == LLM Inference agent (SPEC-0006 R11)",
    actual: agentId.toString(),
    expected: LLM_INFERENCE_AGENT_ID.toString(),
    pass: agentId === LLM_INFERENCE_AGENT_ID,
  });

  // 4. agentReward informational.
  const agentReward: bigint = await contract.agentReward();
  checks.push({
    name: "agentReward (informational)",
    actual: `${agentReward} wei (${ethers.formatEther(agentReward)} ETH)`,
    pass: true,
  });

  // 5. rulingTimeout > 0.
  const rulingTimeout: bigint = await contract.rulingTimeout();
  checks.push({
    name: "rulingTimeout > 0",
    actual: `${rulingTimeout} seconds`,
    pass: rulingTimeout > 0n,
  });

  // 6. maxRounds >= 1 per the contract's R6c invariant.
  const maxRounds: bigint = await contract.maxRounds();
  checks.push({
    name: "maxRounds >= 1",
    actual: maxRounds.toString(),
    pass: maxRounds >= 1n,
  });

  // 7. owner informational (admin calls go through the owner).
  const owner: string = await contract.owner();
  checks.push({
    name: "owner (informational)",
    actual: owner,
    pass: true,
  });

  printResults(checks);
  const allPass = checks.every((c) => c.pass);
  process.exit(allPass ? 0 : 1);
}

function printResults(checks: Check[]) {
  console.log("checks:");
  let maxName = 0;
  for (const c of checks) maxName = Math.max(maxName, c.name.length);
  for (const c of checks) {
    const mark = c.pass ? "✓" : "✗";
    const pad = c.name.padEnd(maxName);
    if (c.expected !== undefined) {
      console.log(`  ${mark} ${pad}  expected=${c.expected}  actual=${c.actual}`);
    } else {
      console.log(`  ${mark} ${pad}  ${c.actual}`);
    }
  }
  const passCount = checks.filter((c) => c.pass).length;
  console.log(`\n${passCount}/${checks.length} checks passed`);
}

main().catch((err) => {
  console.error(`✗ verify-deploy: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
