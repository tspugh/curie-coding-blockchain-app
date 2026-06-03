import { ethers, network } from "hardhat";

/**
 * SPEC-0004 §2.7 R25 probe (option a2): read the on-chain AgentRegistry
 * entry for the LLM Parse Website base agent and surface its IPFS metadata.
 *
 * Purpose: read the on-chain AgentRegistry entry and surface IPFS metadata.
 * The on-chain registry struct holds `string ipfsMetadata` — that blob is
 * the authoritative-but-off-chain descriptor for the agent's ABI surface.
 * Useful for comparing a deployed agent's capabilities against what the
 * CoverageNegotiation contract expects (SPEC-0006 R11: inferString,
 * selector 0xfe7ca098).
 *
 * Read-only. No transactions. Safe to run from any (even un-funded)
 * wallet — the script does not require `accounts: [PRIVATE_KEY]`.
 *
 * Env knobs:
 *   AGENT_REGISTRY_ADDRESS  default 0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A
 *                           (per PR #14 / Somnia agent explorer)
 *   AGENT_ID                default 12875401142070969085 (LLM Parse Website)
 *   IPFS_GATEWAY            default https://ipfs.io/ipfs/
 *
 * Run: npx --prefix contracts hardhat run scripts/probe-agent-abi.ts --network somniaTestnet
 */
async function main() {
  const REGISTRY = process.env.AGENT_REGISTRY_ADDRESS
    ?? "0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A";
  const AGENT_ID = BigInt(process.env.AGENT_ID ?? "12875401142070969085");
  const IPFS_GATEWAY = process.env.IPFS_GATEWAY ?? "https://ipfs.io/ipfs/";

  console.log(`network:           ${network.name}`);
  console.log(`registry:          ${REGISTRY}`);
  console.log(`agent id:          ${AGENT_ID}`);
  console.log(`ipfs gateway:      ${IPFS_GATEWAY}`);
  console.log("─".repeat(70));

  // Minimal ABI mirroring the somnia-agent-kit AgentRegistry surface
  // documented at docs/reference/somnia-agent-kit/agent-registry.md.
  // Only the read functions we need to probe option (a2).
  const REGISTRY_ABI = [
    "function getAgent(uint256 _agentId) external view returns (tuple(string name, string description, string ipfsMetadata, address owner, bool isActive, uint256 registeredAt, uint256 lastUpdated, string[] capabilities, uint256 executionCount))",
    "function getTotalAgents() external view returns (uint256)",
  ];

  const provider = ethers.provider;
  const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, provider);

  let total: bigint | null = null;
  try {
    total = await registry.getTotalAgents();
    console.log(`registry getTotalAgents(): ${total}`);
  } catch (err) {
    console.log(`registry getTotalAgents() reverted: ${(err as Error).message}`);
    console.log("(Either the address isn't an AgentRegistry, or the ABI shape differs.)");
  }

  let agent;
  try {
    agent = await registry.getAgent(AGENT_ID);
  } catch (err) {
    console.log(`registry getAgent(${AGENT_ID}) reverted: ${(err as Error).message}`);
    console.log("(Either the agent id isn't registered here, or the ABI shape differs.)");
    return;
  }

  console.log("\n=== Agent struct ===");
  console.log(`  name:           ${agent.name}`);
  console.log(`  description:    ${agent.description}`);
  console.log(`  ipfsMetadata:   ${agent.ipfsMetadata}`);
  console.log(`  owner:          ${agent.owner}`);
  console.log(`  isActive:       ${agent.isActive}`);
  console.log(`  registeredAt:   ${agent.registeredAt}`);
  console.log(`  lastUpdated:    ${agent.lastUpdated}`);
  console.log(`  capabilities:   ${JSON.stringify(agent.capabilities)}`);
  console.log(`  executionCount: ${agent.executionCount}`);

  const cid = String(agent.ipfsMetadata ?? "").trim();
  if (!cid) {
    console.log("\nNo ipfsMetadata set on this agent. Option (a2) is out — proceed to (c) self-deploy.");
    return;
  }

  // Strip ipfs:// prefix or trailing path if present.
  const cleanCid = cid.replace(/^ipfs:\/\//, "").replace(/\/$/, "");
  const url = IPFS_GATEWAY.endsWith("/")
    ? `${IPFS_GATEWAY}${cleanCid}`
    : `${IPFS_GATEWAY}/${cleanCid}`;

  console.log(`\nFetching IPFS metadata at ${url} …`);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) {
      console.log(`IPFS gateway returned HTTP ${res.status} ${res.statusText}`);
      return;
    }
    const text = await res.text();
    console.log("\n=== IPFS metadata (raw) ===");
    console.log(text.length > 4000 ? text.slice(0, 4000) + "\n… [truncated]" : text);

    // If it looks like JSON, try to pretty-print + flag any "abi" / "selector" / "signature" fields.
    try {
      const obj = JSON.parse(text);
      const interesting: Record<string, unknown> = {};
      for (const k of Object.keys(obj)) {
        if (/abi|selector|signature|function|method|interface|schema/i.test(k)) {
          interesting[k] = obj[k];
        }
      }
      if (Object.keys(interesting).length) {
        console.log("\n=== Interesting fields (likely ABI-related) ===");
        console.log(JSON.stringify(interesting, null, 2));
      } else {
        console.log("\n(No ABI-shaped keys found. Option (a2) does NOT resolve R25 from this metadata.)");
      }
    } catch {
      console.log("\n(Metadata is not JSON — opaque to automated ABI extraction.)");
    }
  } catch (err) {
    console.log(`IPFS fetch failed: ${(err as Error).message}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
