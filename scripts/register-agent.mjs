/**
 * Register the Curie necessity-arbiter agent on Somnia AgentRegistry (testnet).
 *
 * Prerequisites:
 *   1. Generate a wallet: node -e "const {ethers}=require('ethers'); const w=ethers.Wallet.createRandom(); console.log('Address:',w.address,'\\nKey:',w.privateKey)"
 *   2. Fund the address at https://somnia-dripper.netlify.app/
 *   3. Set PRIVATE_KEY in .env (copy from .env.example)
 *
 * Run: node scripts/register-agent.mjs
 *
 * On success, prints the AGENT_ID — record it in .env before deploying the contract.
 *
 * Somnia testnet contract addresses (from somnia-agent-kit README, 2026-05-28):
 *   AgentRegistry:  0xC9f3452090EEB519467DEa4a390976D38C008347
 *   AgentExecutor:  0x157C56dEdbAB6caD541109daabA4663Fc016026e  ← AGENT_PLATFORM_ADDRESS
 *   AgentManager:   0x77F6dC5924652e32DBa0B4329De0a44a2C95691E
 *   AgentVault:     0x7cEe3142A9c6d15529C322035041af697B2B5129
 */

import { readFileSync, existsSync } from "node:fs";
import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Load .env manually (no dotenv dependency needed for a simple script)
// ---------------------------------------------------------------------------
function loadEnv() {
  const path = new URL("../.env", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  if (!existsSync(path)) {
    console.error("❌  .env not found — copy .env.example to .env and set PRIVATE_KEY");
    process.exit(1);
  }
  const lines = readFileSync(path, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Constants — Somnia Shannon testnet
// ---------------------------------------------------------------------------
const TESTNET_RPC = "https://dream-rpc.somnia.network";
const CHAIN_ID = 50312;
const AGENT_REGISTRY_ADDRESS = "0xC9f3452090EEB519467DEa4a390976D38C008347";
const AGENT_EXECUTOR_ADDRESS = "0x157C56dEdbAB6caD541109daabA4663Fc016026e";

// Minimal ABI — only what we need
const REGISTRY_ABI = [
  "function registerAgent(string name, string description, string metadataURI, string[] capabilities) returns (uint256)",
  "function getTotalAgents() view returns (uint256)",
  "function getAgent(uint256 agentId) view returns (tuple(uint256 id, address owner, string name, string description, string metadataURI, string[] capabilities, bool active, uint256 registeredAt))",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string name)",
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌  PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  console.log("Connecting to Somnia Shannon testnet…");
  const provider = new ethers.JsonRpcProvider(TESTNET_RPC, {
    chainId: CHAIN_ID,
    name: "somnia-testnet",
  });

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Wallet address: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`STT balance: ${ethers.formatEther(balance)} STT`);

  if (balance === 0n) {
    console.error("❌  Wallet has 0 STT — fund it at https://somnia-dripper.netlify.app/ first");
    process.exit(1);
  }

  const registry = new ethers.Contract(AGENT_REGISTRY_ADDRESS, REGISTRY_ABI, wallet);

  // Check how many agents are already registered (our ID will be total+1 or from event)
  const before = await registry.getTotalAgents();
  console.log(`Agents registered so far: ${before}`);

  // AgentRegistry requires a non-empty metadataURI. Use a minimal JSON pinned to
  // IPFS via a well-known public CID. For a real deployment, replace this with
  // an actual CID pointing to your agent's metadata JSON.
  const metadataURI =
    "ipfs://QmPK1s3pNYLi9ERiq3BDxKa4XosgWwFRQUydHUtz4YgpqB";

  console.log("Registering Curie Necessity Arbiter agent…");
  const tx = await registry.registerAgent(
    "Curie Necessity Arbiter",
    "AI arbiter for drug coverage-exception adjudication on Somnia. Determines medical necessity and computes deterministic covered amounts for insurance coverage requests.",
    metadataURI,
    ["medical-necessity", "coverage-adjudication", "drug-coverage"],
  );

  console.log(`Transaction submitted: ${tx.hash}`);
  console.log("Waiting for confirmation…");
  const receipt = await tx.wait(1);
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  // Parse AgentRegistered event from receipt
  const iface = new ethers.Interface(REGISTRY_ABI);
  let agentId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "AgentRegistered") {
        agentId = parsed.args.agentId;
        break;
      }
    } catch {
      // not this ABI
    }
  }

  if (agentId === null) {
    // Fallback: total after registration
    const after = await registry.getTotalAgents();
    agentId = after; // last registered = total count (IDs start at 1)
  }

  console.log("\n✅  Agent registered successfully!");
  console.log("─".repeat(50));
  console.log(`AGENT_ID=${agentId}`);
  console.log(`AGENT_PLATFORM_ADDRESS=${AGENT_EXECUTOR_ADDRESS}`);
  console.log("─".repeat(50));
  console.log("\nNext steps:");
  console.log("1. Add these to your .env:");
  console.log(`   AGENT_ID=${agentId}`);
  console.log(`   AGENT_PLATFORM_ADDRESS=${AGENT_EXECUTOR_ADDRESS}`);
  console.log("2. Deploy the contract:  npm --prefix contracts run deploy");
  console.log("3. Copy COVERAGE_CONTRACT_ADDRESS from deploy output into .env");
  console.log("4. Rebuild + deploy:     npm run web:build");
}

main().catch((err) => {
  console.error("❌ ", err.message ?? err);
  process.exit(1);
});
