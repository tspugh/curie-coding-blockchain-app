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
 * THIS LANDING (R25 Tick A LLM swap, tick 122):
 * - Chain plumbing (tick 120): event subscription, contract reads,
 *   handleResponse calls.
 * - LLM ruling via Anthropic SDK (`claude-opus-4-7`) with `messages.parse`
 *   + a Zod schema (structured-output, no manual JSON parsing) + prompt
 *   caching on the static arbiter system prompt (~90% read discount on
 *   repeated rulings). The orchestrator wraps the LLM's semantic ruling
 *   (decision + per-unit prices + free-text rationale/clause refs) into
 *   the 10-tuple the contract decodes — hashing the free-text fields to
 *   bytes32 via `ethers.id` so chain storage stays opaque (SPEC-0004 R1:
 *   no PHI on-chain). If `ANTHROPIC_API_KEY` is not set, falls back to
 *   the deterministic stub from tick 120 (so the script still runs in
 *   CI / keyless dev environments).
 *
 * Reads from .env:
 *   VITE_PRIVATE_KEY            — orchestrator's signing key (== platform addr)
 *   VITE_CONTRACT_ADDRESS       — deployed CoverageNegotiation address (must
 *                                 have been redeployed AND configured via
 *                                 setPlatformSelfHosted(orchestratorAddr))
 *   VITE_RPC_URL                — Somnia testnet RPC (default: testnet)
 *   ORCHESTRATOR_POLL_MS        — fallback poll interval if WS subscription
 *                                 drops (default: 10_000)
 *   ANTHROPIC_API_KEY           — Claude API key (optional; falls back to
 *                                 deterministic stub if unset)
 *   ANTHROPIC_MODEL             — override default `claude-opus-4-7`
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
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ethers } from "ethers";
import * as z from "zod/v4";

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
const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY ?? "";
const ANTHROPIC_MODEL = env.ANTHROPIC_MODEL ?? "claude-opus-4-7";

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
  daysSupply: bigint;
  payerLine: number;
  appealRound: number;
  drugRef: string;
  evidenceUri: string;
  policyHash: string;
  policyUri: string;
  justificationHash: string;
}

const ZERO_HASH = "0x" + "00".repeat(32);

// ---------------------------------------------------------------------------
// Ruling shape — the 10-tuple `_fireAgent` decodes via handleResponse.
// ---------------------------------------------------------------------------

interface Ruling {
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

// ---------------------------------------------------------------------------
// Stub ruling — fallback when ANTHROPIC_API_KEY is unset (CI / dev).
// Returns Approve with costPlus=200 wei and NADAC=180 wei (per-unit),
// so the contract's deterministic cap = min(requested, 200*quantity).
// ---------------------------------------------------------------------------

function computeStubRuling(_n: NegotiationRow): Ruling {
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
// LLM-driven ruling (Anthropic SDK) — the v1 arbiter.
//
// Scope: only on-chain fields drive the LLM in v1. The deployed contract
// stores `evidenceUri` / `policyUri` / `drugRef` as bytes32 refs, not full
// content (SPEC-0004 R1 keeps PHI off-chain). Off-chain content fetching
// keyed by those refs is a future tick — not required for the LLM swap.
//
// Output shape — Zod schema mirrors the Ruling tuple but in LLM-friendly
// terms: prices as decimal strings (safe for 256-bit wei), free-text
// rationale + clause + standard refs (orchestrator hashes them via
// `ethers.id` to bytes32 for the contract). Bounded enum + bounded
// array sizes prevent runaway output.
// ---------------------------------------------------------------------------

const claude: Anthropic | null = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// Sanity cap ~10^12 ether — 9 orders of magnitude above Somnia testnet faucet
// drip (~1000 STT = 10^21 wei); 7 orders below uint256 max (~1.16*10^77). Tight
// enough to block hallucinated absurdities; loose enough to never bind in v1.
const WEI_CAP = 10n ** 30n;
const weiAmount = z
  .string()
  .regex(/^[0-9]+$/, "wei amounts must be decimal integers ≥ 0")
  .refine((s) => BigInt(s) <= WEI_CAP, "wei amounts must be ≤ 10^30");

const LLM_RULING_SCHEMA = z
  .object({
    decision: z.enum(["Approve", "Deny", "NeedMoreEvidence", "PolicyInvalid"]),
    costPlusUnitPriceWei: weiAmount.describe(
      "Cost-plus per-unit reference price in wei (decimal integer string, 0 ≤ v ≤ 10^30).",
    ),
    nadacUnitPriceWei: weiAmount.describe(
      "NADAC per-unit reference price in wei (decimal integer string, 0 ≤ v ≤ 10^30).",
    ),
    rationale: z
      .string()
      .min(1)
      .max(2000)
      .describe("Plain-text rationale for the decision; never repeats PHI. Hashed to bytes32 for on-chain storage."),
    clauseReference: z
      .string()
      .min(1)
      .max(500)
      .describe("Plain-text identifier of the payer policy clause cited; hashed to bytes32 for on-chain storage."),
    standardReference: z
      .string()
      .max(500)
      .describe("Plain-text identifier of the clinical standard cited (e.g. FDA label, NCCN guideline); empty if none. Hashed to bytes32 for on-chain storage."),
    policyVoidedClauseIndices: z
      .array(z.number().int().min(0).max(65535))
      .max(64)
      .describe("Indices of policy clauses voided by this ruling (uint16, 0-indexed). Empty unless decision == PolicyInvalid."),
    usedReferenceIndices: z
      .array(z.number().int().min(0).max(65535))
      .max(64)
      .describe("Indices of evidence references used by this ruling (uint16, 0-indexed). May be empty in v1 (no off-chain refs)."),
  })
  .superRefine((r, ctx) => {
    if (r.decision !== "PolicyInvalid" && r.policyVoidedClauseIndices.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "policyVoidedClauseIndices must be empty unless decision == PolicyInvalid",
        path: ["policyVoidedClauseIndices"],
      });
    }
  });

type LlmRuling = z.infer<typeof LLM_RULING_SCHEMA>;

const ARBITER_SYSTEM_PROMPT = `You are Curie's necessity-arbiter agent — a third-party adjudicator for drug \
coverage exception requests between healthcare providers and insurers on the Somnia blockchain.

YOUR ROLE
You receive a structured coverage-exception request and must return a deterministic, schema-conformant ruling. \
You are the only off-chain decision authority — the contract enforces your output verbatim.

DECISION RUBRIC
- Approve: requested-amount-per-unit is ≤ ~30% above the cost-plus reference, days-supply is clinically \
plausible (≤ 90 days for chronic; ≤ 30 for acute), and no obvious policy violation.
- NeedMoreEvidence: requested-amount-per-unit is 30%–150% above cost-plus, OR days-supply is borderline \
unusual, OR appealRound == 0 and evidence is thin. Use this to push the provider to supplement evidence \
rather than denying outright on first pass.
- Deny: requested-amount-per-unit > 150% of cost-plus, OR days-supply is implausible, OR appealRound ≥ 2 \
and the provider has had two chances to justify.
- PolicyInvalid: only when the cited policy is structurally broken (e.g. self-contradictory clauses). Very \
rare. When chosen, populate policyVoidedClauseIndices with the offending clause indices.

PRICE CALIBRATION (v1 synthetic baseline)
Both prices are per-unit, in wei. Use these baselines unless the on-chain context strongly suggests otherwise:
- costPlusUnitPriceWei: baseline 200 wei. Scale up to 250 for high-cost specialty drugs (drugRef hash starts \
with high nibbles); scale down to 150 for generics (drugRef hash starts with low nibbles). Keep ≤ 1000.
- nadacUnitPriceWei: baseline 180 wei. Typically 10% below cost-plus. Keep ≤ 1000.

APPEAL ESCALATION
appealRound 0: first pass — be willing to ask for evidence.
appealRound 1: second pass — provider has supplemented; lean toward Approve or Deny.
appealRound ≥ 2: terminal — Approve or Deny, no further NeedMoreEvidence.

CONSTRAINTS (HARD)
- NEVER include PHI in rationale, clauseReference, or standardReference. The contract hashes these to bytes32 \
but a leaky free-text field is still a privacy violation upstream of the hash.
- Wei amounts MUST be non-negative decimal integer strings ≤ 10^30.
- rationale ≤ 2000 chars; clauseReference + standardReference ≤ 500 chars each.
- For decisions other than PolicyInvalid, policyVoidedClauseIndices MUST be empty.

INPUT SHAPE
You will receive a JSON object describing the on-chain negotiation row (requestedAmount in wei, quantity, \
daysSupply, payerLine 0=Commercial 1=Medicare 2=Medicaid, appealRound, and bytes32 refs for drug, evidence, \
policy, justification). v1 has no off-chain content fetch — judge from the structured fields alone. The bytes32 \
refs are opaque; use the requestedAmount/quantity/daysSupply ratios as the primary signal.

OUTPUT
Return ONLY the structured ruling matching the provided schema. No prose outside the schema.`;

function buildArbiterUserMessage(reqId: bigint, n: NegotiationRow): string {
  const perUnitWei = n.quantity > 0n ? n.requestedAmount / n.quantity : n.requestedAmount;
  const payerLineLabels = ["Commercial", "Medicare", "Medicaid"] as const;
  const payerLineLabel = payerLineLabels[n.payerLine] ?? `Unknown(${n.payerLine})`;
  return JSON.stringify(
    {
      reqId: reqId.toString(),
      requestedAmountWei: n.requestedAmount.toString(),
      quantity: n.quantity.toString(),
      daysSupply: n.daysSupply.toString(),
      derivedPerUnitWei: perUnitWei.toString(),
      payerLine: n.payerLine,
      payerLineLabel,
      appealRound: n.appealRound,
      drugRef: n.drugRef,
      evidenceUri: n.evidenceUri,
      policyHash: n.policyHash,
      policyUri: n.policyUri,
      justificationHash: n.justificationHash,
    },
    null,
    2,
  );
}

function decisionFromName(name: LlmRuling["decision"]): number {
  switch (name) {
    case "Approve": return Decision.Approve;
    case "Deny": return Decision.Deny;
    case "NeedMoreEvidence": return Decision.NeedMoreEvidence;
    case "PolicyInvalid": return Decision.PolicyInvalid;
  }
}

function assembleRulingFromLlm(llm: LlmRuling): Ruling {
  return {
    decision: decisionFromName(llm.decision),
    costPlusUnitPrice: BigInt(llm.costPlusUnitPriceWei),
    nadacUnitPrice: BigInt(llm.nadacUnitPriceWei),
    rationaleHash: ethers.id(llm.rationale),
    clauseRef: ethers.id(llm.clauseReference),
    standardRef: llm.standardReference ? ethers.id(llm.standardReference) : ZERO_HASH,
    receiptId: 0n,
    policyVoidedClauseIndices: llm.policyVoidedClauseIndices,
    usedReferenceIndices: llm.usedReferenceIndices,
    usedLeafHashes: [],
  };
}

async function computeRuling(reqId: bigint, n: NegotiationRow): Promise<Ruling> {
  if (!claude) {
    console.log(`[reqId=${reqId}] ANTHROPIC_API_KEY not set — using deterministic stub ruling`);
    return computeStubRuling(n);
  }
  try {
    const response = await claude.messages.parse({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        format: zodOutputFormat(LLM_RULING_SCHEMA),
        effort: "high",
      },
      system: [
        {
          type: "text",
          text: ARBITER_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        { role: "user", content: buildArbiterUserMessage(reqId, n) },
      ],
    });
    if (!response.parsed_output) {
      console.warn(`[reqId=${reqId}] Claude did not return parseable output (stop_reason=${response.stop_reason}); falling back to stub`);
      return computeStubRuling(n);
    }
    const usage = response.usage;
    console.log(
      `[reqId=${reqId}] LLM ruling: decision=${response.parsed_output.decision} ` +
      `usage(input=${usage.input_tokens ?? 0} cache_read=${usage.cache_read_input_tokens ?? 0} ` +
      `cache_write=${usage.cache_creation_input_tokens ?? 0} output=${usage.output_tokens})`,
    );
    return assembleRulingFromLlm(response.parsed_output);
  } catch (err) {
    console.warn(`[reqId=${reqId}] LLM call failed (${err instanceof Error ? err.message : String(err)}); falling back to stub`);
    return computeStubRuling(n);
  }
}

// ---------------------------------------------------------------------------
// Ruling encoder — produces the bytes the contract decodes (10-tuple).
// Tuple order must match `_fireAgent` → handleResponse decoder.
// ---------------------------------------------------------------------------

function encodeRuling(r: Ruling): string {
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
    const raw = await contract.getNegotiation(reqId);
    const n: NegotiationRow = {
      requestedAmount: BigInt(raw.requestedAmount),
      quantity: BigInt(raw.quantity),
      daysSupply: BigInt(raw.daysSupply),
      payerLine: Number(raw.payerLine),
      appealRound: Number(raw.appealRound),
      drugRef: String(raw.drugRef),
      evidenceUri: String(raw.evidenceUri),
      policyHash: String(raw.policyHash),
      policyUri: String(raw.policyUri),
      justificationHash: String(raw.justificationHash),
    };
    const ruling = await computeRuling(reqId, n);
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
