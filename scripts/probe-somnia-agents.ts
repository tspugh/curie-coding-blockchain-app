/**
 * probe-somnia-agents.ts
 *
 * Read-only enumeration of agentIds actually in use on the canonical
 * Somnia testnet SomniaAgents contract (0x037Bb9C…). We need this because
 * the docs only publish the LLM Parse Website agentId — not LLM Inference,
 * which is the one Curie wants. Strategy: scan recent `RequestCreated`
 * events, extract every distinct `agentId`, group by the first 4 bytes of
 * `payload` (the selector validators decode against), and report.
 *
 * No transactions sent; no STT spent. Safe to run any time.
 *
 * Run: tsx scripts/probe-somnia-agents.ts
 *      tsx scripts/probe-somnia-agents.ts --range 200000
 */

import { ethers } from "ethers";

const RPC = "https://api.infra.testnet.somnia.network/";
const SOMNIA_AGENTS = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

// agentIds we've already identified from documentation. Add as we learn.
const KNOWN_AGENTS: Record<string, string> = {
  "12875401142070969085": "LLM Parse Website",
};

// Heuristic selector → likely-method-name table. Selectors are
// keccak256(canonicalSignature).slice(0, 4). Without the docs publishing
// the exact registered ABIs, we compute candidates from likely shapes and
// match against what we see on chain. Add candidates here as we narrow.
const LIKELY_INFERENCE_SHAPES = [
  // Guesses based on the documented method names (parameter types are
  // unknown; these are best-effort starting points).
  "inferString(string)",
  "inferString(string,string)",
  "inferString(string,uint256)",
  "inferString(string,string,uint256)",
  "inferNumber(string,uint256,uint256)",
  "inferNumber(string,int256,int256)",
  "inferChat(string[],string[])",
  "inferChat(bytes)",
  "inferToolsChat(string[],string[],(string,string)[])",
  "runInference(string)",
  "complete(string)",
];

function computeSelectors(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const sig of LIKELY_INFERENCE_SHAPES) {
    const hash = ethers.id(sig);
    const selector = hash.slice(0, 10); // 0x + 4 bytes
    out[selector] = sig;
  }
  return out;
}

function formatSTT(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n) / 10n ** 14n; // 4 decimal places
  return `${whole}.${frac.toString().padStart(4, "0")} STT`;
}

async function main() {
  const args = process.argv.slice(2);
  let range = 50_000;
  const idx = args.indexOf("--range");
  if (idx >= 0 && args[idx + 1]) range = parseInt(args[idx + 1], 10);

  const provider = new ethers.JsonRpcProvider(RPC);
  const iface = new ethers.Interface([
    "event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, uint256 perAgentBudget, bytes payload, address[] subcommittee)",
  ]);
  const topicHash = iface.getEvent("RequestCreated")!.topicHash;

  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - range);

  console.log(`SomniaAgents:    ${SOMNIA_AGENTS}`);
  console.log(`Event topic:     ${topicHash}`);
  console.log(`Latest block:    ${latest}`);
  console.log(`Block range:     ${fromBlock}..${latest} (${range} blocks)`);
  console.log("");

  // Paginate to avoid RPC range limits. Somnia testnet RPC caps at 1000.
  const PAGE = 1_000;
  const allLogs: ethers.Log[] = [];
  for (let start = fromBlock; start <= latest; start += PAGE) {
    const end = Math.min(start + PAGE - 1, latest);
    try {
      const logs = await provider.getLogs({
        address: SOMNIA_AGENTS,
        topics: [topicHash],
        fromBlock: start,
        toBlock: end,
      });
      if (logs.length > 0) {
        process.stdout.write(`  blocks ${start}..${end}: ${logs.length} events\n`);
      }
      allLogs.push(...logs);
    } catch (err) {
      process.stdout.write(`  blocks ${start}..${end}: ERROR ${(err as Error).message}\n`);
    }
  }

  console.log("");
  console.log(`Total RequestCreated events found: ${allLogs.length}`);
  console.log("");

  if (allLogs.length === 0) {
    console.log("No events in this range. Try a larger --range (e.g. 200000 or 500000).");
    console.log("If still none, the canonical address may have been recently deployed");
    console.log("OR no public callers are using it yet on testnet.");
    return;
  }

  // Group by agentId.
  type Entry = {
    count: number;
    selectors: Map<string, number>;
    budgets: Set<bigint>;
    samples: Array<{ block: number; tx: string; payloadLen: number }>;
  };
  const byAgentId = new Map<string, Entry>();

  for (const log of allLogs) {
    const parsed = iface.parseLog(log);
    if (!parsed) continue;
    const agentId = (parsed.args.agentId as bigint).toString();
    const payload = parsed.args.payload as string;
    const selector = payload.length >= 10 ? payload.slice(0, 10) : "0x";
    const budget = parsed.args.perAgentBudget as bigint;

    if (!byAgentId.has(agentId)) {
      byAgentId.set(agentId, {
        count: 0,
        selectors: new Map(),
        budgets: new Set(),
        samples: [],
      });
    }
    const e = byAgentId.get(agentId)!;
    e.count++;
    e.selectors.set(selector, (e.selectors.get(selector) ?? 0) + 1);
    e.budgets.add(budget);
    if (e.samples.length < 3) {
      e.samples.push({
        block: log.blockNumber,
        tx: log.transactionHash,
        payloadLen: (payload.length - 2) / 2,
      });
    }
  }

  const likelyInference = computeSelectors();

  console.log(`=== Unique agentIds observed (${byAgentId.size}) ===`);
  console.log("");

  const sorted = [...byAgentId.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [agentId, e] of sorted) {
    const known = KNOWN_AGENTS[agentId] ?? "(unknown — candidate for LLM Inference or other base agent)";
    console.log(`agentId: ${agentId}`);
    console.log(`  label:           ${known}`);
    console.log(`  total calls:     ${e.count}`);
    console.log(`  perAgentBudget values seen:`);
    for (const b of e.budgets) {
      console.log(`    ${formatSTT(b)}`);
    }
    console.log(`  payload selectors used:`);
    const sortedSels = [...e.selectors.entries()].sort((a, b) => b[1] - a[1]);
    for (const [sel, cnt] of sortedSels) {
      const match = likelyInference[sel];
      const tag = match ? `  ← matches candidate: ${match}` : "";
      console.log(`    ${sel}  (${cnt} calls)${tag}`);
    }
    console.log(`  sample tx hashes:`);
    for (const s of e.samples) {
      console.log(`    block ${s.block}  ${s.tx}  payload=${s.payloadLen} bytes`);
    }
    console.log("");
  }

  console.log("=== Candidate selectors computed from documented method names ===");
  for (const [sel, sig] of Object.entries(likelyInference)) {
    console.log(`  ${sel}  ${sig}`);
  }
  console.log("");
  console.log("To inspect a specific transaction's full payload:");
  console.log("  curl -X POST $RPC -H 'Content-Type: application/json' \\");
  console.log("    -d '{\"jsonrpc\":\"2.0\",\"method\":\"eth_getTransactionByHash\",\"params\":[\"0x...\"],\"id\":1}'");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
