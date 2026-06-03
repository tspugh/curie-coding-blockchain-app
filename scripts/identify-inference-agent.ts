/**
 * identify-inference-agent.ts
 *
 * Uses the documented LLM Inference ABIs (provided directly by Somnia docs)
 * to compute canonical selectors, then cross-references against unique
 * agentIds + selectors found on-chain via RequestCreated events on the
 * canonical SomniaAgents contract. Goal: pin down the LLM Inference
 * agentId by matching selector + cost-per-agent.
 *
 * Read-only. No STT spent.
 *
 * Run: tsx scripts/identify-inference-agent.ts [--range 50000]
 */

import { ethers } from "ethers";

const NETWORKS = {
  testnet: {
    rpc: "https://api.infra.testnet.somnia.network/",
    address: "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776",
    chainId: 50312,
  },
  mainnet: {
    rpc: "https://api.infra.mainnet.somnia.network/",
    address: "0x5E5205CF39E766118C01636bED000A54D93163E6",
    chainId: 5031,
  },
} as const;
type NetworkName = keyof typeof NETWORKS;

// === Canonical LLM Inference ABIs (from Somnia docs verbatim) ===
const LLM_INFERENCE_ABI = [
  {
    name: "inferString",
    canonical: "inferString(string,string,bool,string[])",
    inputs: ["prompt (string)", "system (string)", "chainOfThought (bool)", "allowedValues (string[])"],
    output: "string",
  },
  {
    name: "inferNumber",
    canonical: "inferNumber(string,string,int256,int256,bool)",
    inputs: ["prompt", "system", "minValue (int256)", "maxValue (int256)", "chainOfThought (bool)"],
    output: "int256",
  },
  {
    name: "inferChat",
    canonical: "inferChat(string[],string[],bool)",
    inputs: ["roles (string[])", "messages (string[])", "chainOfThought (bool)"],
    output: "string",
  },
  {
    name: "inferToolsChat",
    canonical: "inferToolsChat(string[],string[],string[],(string,string)[],uint256,bool)",
    inputs: ["roles", "messages", "mcpServerUrls (string[])", "onchainTools ((string,string)[])", "maxIterations (uint256)", "chainOfThought (bool)"],
    output: "(string,string,string[],string[],string[],bytes[])",
  },
];

// === Other known base-agent selectors for elimination ===
const OTHER_AGENT_ABIS = [
  // JSON API
  { canonical: "fetchUint(string,string,uint8)", name: "fetchUint (JSON API)" },
  { canonical: "fetchString(string,string)", name: "fetchString (JSON API)" },
  // LLM Parse Website (legacy base agent — superseded by LLM Inference in SPEC-0006)
  { canonical: "ExtractString(string,string,string[],string,string,bool,uint8,uint8)", name: "ExtractString variant (LLM Parse Website)" },
];

function selectorOf(canonical: string): string {
  return ethers.id(canonical).slice(0, 10);
}

function formatSTT(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n) / 10n ** 14n;
  return `${whole}.${frac.toString().padStart(4, "0")} STT`;
}

async function main() {
  const args = process.argv.slice(2);
  let range = 50_000;
  const rangeIdx = args.indexOf("--range");
  if (rangeIdx >= 0 && args[rangeIdx + 1]) range = parseInt(args[rangeIdx + 1], 10);

  let network: NetworkName = "testnet";
  const netIdx = args.indexOf("--network");
  if (netIdx >= 0 && args[netIdx + 1]) {
    const n = args[netIdx + 1];
    if (n === "testnet" || n === "mainnet") network = n;
    else throw new Error(`unknown --network ${n}; use testnet or mainnet`);
  }
  const RPC = NETWORKS[network].rpc;
  const SOMNIA_AGENTS = NETWORKS[network].address;
  console.log(`Network: ${network} (chain ${NETWORKS[network].chainId})`);

  // === Step 1: compute canonical selectors ===
  console.log("=== Canonical LLM Inference selectors (from docs) ===");
  const inferenceSelectors = new Map<string, string>();
  for (const a of LLM_INFERENCE_ABI) {
    const sel = selectorOf(a.canonical);
    inferenceSelectors.set(sel, a.canonical);
    console.log(`  ${sel}  ${a.canonical}`);
  }
  console.log();
  console.log("=== Other known base-agent selectors (for elimination) ===");
  const otherSelectors = new Map<string, string>();
  for (const a of OTHER_AGENT_ABIS) {
    const sel = selectorOf(a.canonical);
    otherSelectors.set(sel, a.name);
    console.log(`  ${sel}  ${a.name}  [${a.canonical}]`);
  }
  console.log();

  // === Step 2: scan recent events ===
  const provider = new ethers.JsonRpcProvider(RPC);
  const iface = new ethers.Interface([
    "event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, uint256 perAgentBudget, bytes payload, address[] subcommittee)",
  ]);
  const topicHash = iface.getEvent("RequestCreated")!.topicHash;
  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - range);

  console.log(`Probing ${SOMNIA_AGENTS} blocks ${fromBlock}..${latest} (range ${range})`);
  console.log();

  const PAGE = 1_000;
  type EventData = { agentId: string; selector: string; budget: bigint; block: number; tx: string; payloadLen: number };
  const events: EventData[] = [];

  for (let start = fromBlock; start <= latest; start += PAGE) {
    const end = Math.min(start + PAGE - 1, latest);
    try {
      const logs = await provider.getLogs({
        address: SOMNIA_AGENTS,
        topics: [topicHash],
        fromBlock: start,
        toBlock: end,
      });
      for (const log of logs) {
        const parsed = iface.parseLog(log);
        if (!parsed) continue;
        const payload = parsed.args.payload as string;
        events.push({
          agentId: (parsed.args.agentId as bigint).toString(),
          selector: payload.length >= 10 ? payload.slice(0, 10) : "0x",
          budget: parsed.args.perAgentBudget as bigint,
          block: log.blockNumber,
          tx: log.transactionHash,
          payloadLen: (payload.length - 2) / 2,
        });
      }
    } catch (err) {
      process.stdout.write(`  blocks ${start}..${end}: ERROR ${(err as Error).message}\n`);
    }
  }

  console.log(`Found ${events.length} RequestCreated events.`);
  console.log();

  // === Step 3: aggregate ===
  type Entry = {
    count: number;
    selectors: Map<string, number>;
    budgets: Set<bigint>;
    samples: EventData[];
  };
  const byAgentId = new Map<string, Entry>();
  for (const ev of events) {
    if (!byAgentId.has(ev.agentId)) {
      byAgentId.set(ev.agentId, { count: 0, selectors: new Map(), budgets: new Set(), samples: [] });
    }
    const e = byAgentId.get(ev.agentId)!;
    e.count++;
    e.selectors.set(ev.selector, (e.selectors.get(ev.selector) ?? 0) + 1);
    e.budgets.add(ev.budget);
    if (e.samples.length < 2) e.samples.push(ev);
  }

  // === Step 4: classify each agentId ===
  console.log("=== Per-agentId classification ===");
  console.log();
  for (const [agentId, e] of [...byAgentId.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`agentId: ${agentId}`);
    console.log(`  calls: ${e.count}`);
    const budgetList = [...e.budgets].map(b => formatSTT(b)).join(", ");
    console.log(`  perAgentBudget: ${budgetList}`);
    console.log(`  selectors used:`);
    let identifiedAs: string | null = null;
    for (const [sel, cnt] of [...e.selectors.entries()].sort((a, b) => b[1] - a[1])) {
      const inferenceMatch = inferenceSelectors.get(sel);
      const otherMatch = otherSelectors.get(sel);
      let tag = "";
      if (inferenceMatch) {
        tag = `  ← LLM INFERENCE method: ${inferenceMatch}`;
        identifiedAs = "LLM Inference";
      } else if (otherMatch) {
        tag = `  ← ${otherMatch}`;
        if (!identifiedAs) identifiedAs = otherMatch;
      }
      console.log(`    ${sel}  ${cnt} call(s)${tag}`);
    }
    console.log(`  → identified as: ${identifiedAs ?? "UNKNOWN (custom agent OR our docs are stale on signatures)"}`);
    console.log(`  sample tx: ${e.samples[0]?.tx ?? "n/a"} (block ${e.samples[0]?.block ?? "n/a"}, payload ${e.samples[0]?.payloadLen ?? 0} bytes)`);
    console.log();
  }

  // === Step 5: highlight LLM Inference candidates ===
  const inferenceMatches: string[] = [];
  for (const [agentId, e] of byAgentId.entries()) {
    for (const sel of e.selectors.keys()) {
      if (inferenceSelectors.has(sel)) inferenceMatches.push(agentId);
    }
  }
  const uniqueMatches = [...new Set(inferenceMatches)];
  console.log("=== Verdict ===");
  if (uniqueMatches.length === 0) {
    console.log("No agentId observed using a documented LLM Inference selector in this range.");
    console.log("Possible reasons:");
    console.log("  - LLM Inference is lower-traffic; widen --range");
    console.log("  - Docs ABI shape differs slightly from on-chain registration");
    console.log("  - LLM Inference is not yet registered on testnet");
  } else {
    console.log(`Candidate LLM Inference agentId(s): ${uniqueMatches.join(", ")}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
