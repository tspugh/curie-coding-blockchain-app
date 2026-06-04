#!/usr/bin/env tsx
/**
 * Curie rationale keeper (SPEC-0006 R24/R25, Amendment 0007 §5).
 *
 * Watches the deployed CoverageNegotiation contract for `Ruled` events (a
 * finalized approve / deny / policy-invalid ruling) and, for each, surfaces the
 * AI's reasoning on-chain by calling `commitRationale(reqId, rationale,
 * clauseReference, standardReference)`. That emits `RulingRationale`, which the
 * web app's R25 card renders.
 *
 * R0-COMPLIANCE: this keeper does NOT compute or shape any ruling. The decision,
 * coveredAmount, and state transition are finalized on-chain by the agent
 * callback BEFORE this keeper ever runs; it only transcribes the already-produced
 * reasoning. `commitRationale` is owner-gated and cannot mutate the ruling.
 *
 * Reasoning source (in priority order):
 *   1. The Somnia receipt for the decide request (real LLM chain-of-thought). The
 *      receipt data API is not yet pinned down; we best-effort a few endpoint
 *      shapes and use the receipt's `reasoning` step if reachable.
 *   2. On-chain fallback: the decide-phase `RequestCreated` payload (emitted by
 *      the canonical platform) carries the `inferString` prompt, which embeds the
 *      LLM-Parse-Website scraped evidence ("Extracted evidence: …") plus the
 *      coverage question. We compose a verifiable trace from that + the decision.
 *
 * Run:  tsx scripts/keeper.ts            (daemon; polls every POLL_MS)
 *       tsx scripts/keeper.ts --once     (process the current backlog and exit)
 *
 * Reads from .env: PRIVATE_KEY (owner/keeper), VITE_CONTRACT_ADDRESS,
 * VITE_DEPLOYMENT_BLOCK (scan floor), VITE_SOMNIA_NETWORK (testnet|mainnet).
 */
import { existsSync, readFileSync } from "node:fs";
import {
  AbiCoder,
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  ZeroHash,
  id,
  toBeHex,
  zeroPadValue,
} from "ethers";

const PLATFORM_TESTNET = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
const PLATFORM_MAINNET = "0x5E5205CF39E766118C01636bED000A54D93163E6";
const RPC_TESTNET = "https://api.infra.testnet.somnia.network/";
const RPC_MAINNET = "https://api.infra.mainnet.somnia.network/";
const LLM_INFERENCE_AGENT_ID = "12847293847561029384";
const POLL_MS = 15_000;
const LOG_PAGE = 1000; // Somnia testnet getLogs cap

function loadEnv(path = ".env"): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = { ...loadEnv(), ...process.env };
const ONCE = process.argv.includes("--once");

const network = (env.VITE_SOMNIA_NETWORK ?? env.SOMNIA_NETWORK ?? "testnet").toLowerCase();
const isMainnet = network === "mainnet";
const RPC = env.SOMNIA_RPC_URL || (isMainnet ? RPC_MAINNET : RPC_TESTNET);
const PLATFORM = isMainnet ? PLATFORM_MAINNET : PLATFORM_TESTNET;
const CONTRACT = env.VITE_CONTRACT_ADDRESS ?? env.COVERAGE_CONTRACT_ADDRESS;
const KEY = env.PRIVATE_KEY ?? env.VITE_PRIVATE_KEY;
if (!CONTRACT) throw new Error("VITE_CONTRACT_ADDRESS not set");
if (!KEY) throw new Error("PRIVATE_KEY not set");

const provider = new JsonRpcProvider(RPC);
const wallet = new Wallet(KEY, provider);
const DECISION_LABELS = ["Approve", "Deny", "NeedMoreEvidence", "PolicyInvalid"];

const NEG_TUPLE =
  "tuple(uint256 providerId,uint256 insurerId,address providerAddr,address insurerAddr,bytes32 drugRef,uint256 requestedAmount,uint256 quantity,uint256 daysSupply,bytes32 justificationHash,bytes32 evidenceUri,bytes32 policyHash,bytes32 policyUri,uint256 coveredAmount,uint256 escrowAmount,uint256 costPlusUnitPrice,uint256 nadacUnitPrice,bytes32 rationaleHash,bytes32 clauseRef,bytes32 standardRef,uint8 lastDecision,uint256 lastRequestId,bool hasRuling,string agentEvidenceUrl,string agentPromptHint,uint256 round,uint8 payerLine,uint8 appealRound,bool providerAccepted,bool insurerAccepted,uint256 totalFees,uint8 state,uint256 pendingRequestId,uint256 createdAt,uint256 rulingDeadline,bool exists,uint8 agentPhase,uint256 pendingDecideFee,address pendingFeePayer)";
const contract = new Contract(
  CONTRACT,
  [
    `function getNegotiation(uint256 reqId) external view returns (${NEG_TUPLE})`,
    "function commitRationale(uint256 reqId, string rationale, string clauseReference, string standardReference) external",
    "event Ruled(uint256 indexed reqId, uint256 indexed requestId, uint8 decision, uint256 coveredAmount)",
  ],
  wallet,
);
const RULED_TOPIC = id("Ruled(uint256,uint256,uint8,uint256)");
const platformIface = new Interface([
  "event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, uint256 perAgentBudget, bytes payload, address[] subcommittee)",
]);
const RC_TOPIC = platformIface.getEvent("RequestCreated")!.topicHash;
const abi = AbiCoder.defaultAbiCoder();

const log = (...a: unknown[]) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

/** Best-effort: fetch the decide request's receipt reasoning. Returns null if unreachable. */
async function fetchReceiptReasoning(requestId: bigint): Promise<string | null> {
  const host = isMainnet
    ? "https://receipts.mainnet.agents.somnia.host"
    : "https://receipts.testnet.agents.somnia.host";
  const candidates = [
    `${host}?requestId=${requestId}`,
    `${host}/api/receipts/${requestId}`,
    `${host}/receipts/${requestId}`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const body = (await res.json()) as { steps?: Array<{ name?: string; content?: string }> };
      const step = body.steps?.find((s) => s.name === "reasoning" && s.content);
      if (step?.content) return step.content;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Decode the decide `inferString` prompt from the platform RequestCreated payload. */
async function fetchDecidePrompt(requestId: bigint, fromBlock: number): Promise<string | null> {
  const idTopic = zeroPadValue(toBeHex(requestId), 32);
  const head = await provider.getBlockNumber();
  for (let from = fromBlock; from <= head; from += LOG_PAGE) {
    const to = Math.min(from + LOG_PAGE - 1, head);
    const logs = await provider
      .getLogs({ address: PLATFORM, fromBlock: from, toBlock: to, topics: [RC_TOPIC, idTopic] })
      .catch(() => []);
    if (logs.length) {
      const payload: string = platformIface.parseLog(logs[0]!)!.args.payload;
      // inferString(string prompt, string system, bool, string[])
      try {
        const [prompt] = abi.decode(["string", "string", "bool", "string[]"], "0x" + payload.slice(10));
        return prompt as string;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Compose a verifiable on-chain rationale from the decide prompt + decision. */
function composeRationale(decisionLabel: string, prompt: string | null): string {
  if (!prompt) {
    return `The validator subcommittee ruled: ${decisionLabel}. (Reasoning trace unavailable — decide prompt not recoverable.)`;
  }
  // The prompt embeds "Extracted evidence: <scraped text>" from the scrape phase.
  const evMatch = prompt.match(/Extracted evidence:\s*([\s\S]*)$/i);
  const evidence = evMatch ? evMatch[1]!.trim() : prompt.trim();
  return (
    `AI ruling: ${decisionLabel}.\n\n` +
    `The medical-necessity arbiter (Somnia LLM Inference, validator subcommittee, ` +
    `chain-of-thought) reached this decision over the following public evidence ` +
    `scraped on-chain by the LLM Parse Website agent:\n\n${evidence}`
  );
}

async function processRuled(
  reqId: bigint,
  decideRequestId: bigint,
  decision: number,
  ruledBlock: number,
): Promise<void> {
  const n = await contract.getNegotiation(reqId);
  if (n.rationaleHash !== ZeroHash) {
    return; // already committed (idempotent)
  }
  if (!n.hasRuling) {
    return; // not a final ruling (e.g. needs_more_info routes elsewhere)
  }
  const decisionLabel = DECISION_LABELS[decision] ?? `Decision(${decision})`;

  const receipt = await fetchReceiptReasoning(decideRequestId);
  let rationale: string;
  if (receipt) {
    rationale = `AI ruling: ${decisionLabel}.\n\n${receipt}`;
    log(`reqId ${reqId}: using Somnia receipt reasoning (${receipt.length} chars)`);
  } else {
    const prompt = await fetchDecidePrompt(decideRequestId, Math.max(0, ruledBlock - 200));
    rationale = composeRationale(decisionLabel, prompt);
    log(`reqId ${reqId}: receipt unreachable; composed on-chain trace (${rationale.length} chars)`);
  }

  const clauseReference = n.agentPromptHint || "(policy attached on-chain by hash)";
  const standardReference = n.agentEvidenceUrl || "(public evidence URL)";

  log(`reqId ${reqId}: committing rationale (decision=${decisionLabel})…`);
  const tx = await contract.commitRationale(reqId, rationale, clauseReference, standardReference);
  const r = await tx.wait();
  log(`reqId ${reqId}: committed in ${r?.hash} (block ${r?.blockNumber}) → RulingRationale emitted`);
}

async function scanOnce(fromBlock: number): Promise<number> {
  const head = await provider.getBlockNumber();
  let processed = 0;
  for (let from = fromBlock; from <= head; from += LOG_PAGE) {
    const to = Math.min(from + LOG_PAGE - 1, head);
    const logs = await provider
      .getLogs({ address: CONTRACT, fromBlock: from, toBlock: to, topics: [RULED_TOPIC] })
      .catch(() => []);
    for (const l of logs) {
      const reqId = BigInt(l.topics[1]!);
      const decideRequestId = BigInt(l.topics[2]!);
      const [decision] = abi.decode(["uint8", "uint256"], l.data);
      try {
        await processRuled(reqId, decideRequestId, Number(decision), Number(l.blockNumber));
        processed++;
      } catch (err) {
        log(`reqId ${reqId}: ERROR — ${(err as Error).message}`);
      }
    }
  }
  return head;
}

async function main() {
  const deployBlock = Number(env.VITE_DEPLOYMENT_BLOCK ?? "0") || (await provider.getBlockNumber()) - 10_000;
  log(`keeper online — contract ${CONTRACT} on ${network}, owner ${wallet.address}`);
  log(`scanning Ruled events from block ${deployBlock}${ONCE ? " (--once)" : `, polling every ${POLL_MS / 1000}s`}`);
  let cursor = deployBlock;
  for (;;) {
    cursor = (await scanOnce(cursor)) + 1;
    if (ONCE) {
      log("done (--once)");
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
main().catch((e) => {
  console.error("keeper fatal:", e);
  process.exit(1);
});
