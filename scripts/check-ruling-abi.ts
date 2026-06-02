#!/usr/bin/env tsx
/**
 * R26 (repurposed under Amendment 0006) — build-time check that the
 * orchestrator's ruling encoder produces bytes the on-chain
 * `CoverageNegotiation.handleResponse` decoder accepts.
 *
 * Original R26 (SPEC-0004 §2.7) was a guard against ABI drift between the
 * deployed Somnia LLM Parse Website agent and our contract's selector. Under
 * Amendment 0006 we self-host the arbiter via `scripts/orchestrator-real.ts`,
 * so the "external agent ABI" no longer exists. R26's repurposed target (per
 * SPEC-0004 §2.7 Amendment 0006 status block, tick 123): assert that the
 * orchestrator's encoder tuple shape matches the contract's decoder tuple
 * shape, and that round-trip encode → decode preserves every field bit-for-bit.
 *
 * Two checks:
 *
 *   1. STATIC: the orchestrator-side `RULING_ABI_TYPES` (from
 *      `scripts/lib/ruling-abi.ts`) must match the contract decoder type list
 *      extracted at run time from `contracts/contracts/CoverageNegotiation.sol`
 *      via `extractContractDecoderTypes()` below. Parsing the .sol file
 *      directly removes the dual-update failure mode of a hand-copied literal
 *      (closes tick-124 strict-review NIT-1): if the Solidity decoder is
 *      edited, the extractor pulls the new shape automatically and this check
 *      compares against current truth, not a stale snapshot.
 *
 *   2. ROUND-TRIP: five sample rulings (one per Decision enum value plus a
 *      schema-ceiling sample) are encoded with the orchestrator path, then
 *      decoded with the contract's type list. Every field must equal the
 *      original. Exercises the actual ethers ABI codec — catches subtler
 *      issues than the static check alone (e.g. uint16[] empty arrays,
 *      bytes32 padding, bigint→uint256 boundary).
 *
 * Wire as `npm run check-ruling-abi`; runnable standalone as
 * `tsx scripts/check-ruling-abi.ts`. Exit code 0 = match, 1 = mismatch.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ethers } from "ethers";
import { Decision, encodeRuling, RULING_ABI_TYPES, type Ruling, ZERO_HASH } from "./lib/ruling-abi.js";

// Source path resolved relative to this script: scripts/check-ruling-abi.ts →
// ../contracts/contracts/CoverageNegotiation.sol. Holds whether tsx is invoked
// from repo root, from contracts/, or anywhere else.
const SOL_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "contracts",
  "contracts",
  "CoverageNegotiation.sol",
);

/**
 * Extract the canonical contract decoder type list by parsing the
 * `abi.decode(responses[0].result, (TYPES))` call in CoverageNegotiation.sol.
 * Fails loud if the call cannot be located or the tuple cannot be parsed —
 * a regression that moves or renames the decoder MUST surface as a check
 * failure rather than a silent fall-through to a stale literal.
 */
function extractContractDecoderTypes(solSource: string): string[] {
  // Matches: abi.decode(<whitespace>responses[0].result,<whitespace>(<TYPES>))
  // The TYPES capture group is `[^)]*` — correct as long as the tuple does
  // not nest another `)`-bearing type (none of our types do; the loud
  // failure mode here is exactly what we want if that ever changes).
  const pattern = /\babi\.decode\s*\(\s*responses\[0\]\.result\s*,\s*\(\s*([^)]*)\s*\)\s*\)/;
  const match = solSource.match(pattern);
  if (!match || !match[1]) {
    throw new Error(
      `could not locate 'abi.decode(responses[0].result, (...))' in CoverageNegotiation.sol — ` +
      `the decoder may have been renamed, moved, or wrapped in a struct. ` +
      `Update the extractor pattern in scripts/check-ruling-abi.ts and re-run.`,
    );
  }
  const types = match[1].split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (types.length === 0) {
    throw new Error("extracted contract decoder tuple is empty");
  }
  return types;
}

let CONTRACT_DECODER_TYPES: readonly string[];
try {
  const solSource = readFileSync(SOL_PATH, "utf8");
  CONTRACT_DECODER_TYPES = extractContractDecoderTypes(solSource);
} catch (err) {
  console.error(`✗ check-ruling-abi: failed to load contract decoder types from ${SOL_PATH}`);
  console.error(`  ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

function fail(msg: string): never {
  console.error(`✗ check-ruling-abi: ${msg}`);
  process.exit(1);
}

function checkTypeListsMatch(): void {
  if (RULING_ABI_TYPES.length !== CONTRACT_DECODER_TYPES.length) {
    fail(`tuple length mismatch: encoder has ${RULING_ABI_TYPES.length}, contract decoder has ${CONTRACT_DECODER_TYPES.length}`);
  }
  for (let i = 0; i < RULING_ABI_TYPES.length; i++) {
    if (RULING_ABI_TYPES[i] !== CONTRACT_DECODER_TYPES[i]) {
      fail(`tuple element ${i} mismatch: encoder="${RULING_ABI_TYPES[i]}", contract="${CONTRACT_DECODER_TYPES[i]}"`);
    }
  }
  console.log(`✓ static check: encoder type list matches contract decoder (${RULING_ABI_TYPES.length} elements)`);
}

function roundTrip(r: Ruling, label: string): void {
  const encoded = encodeRuling(r);
  const decoded = ethers.AbiCoder.defaultAbiCoder().decode([...CONTRACT_DECODER_TYPES], encoded);

  const [
    decision,
    costPlusUnitPrice,
    nadacUnitPrice,
    rationaleHash,
    clauseRef,
    standardRef,
    receiptId,
    policyVoidedClauseIndices,
    usedReferenceIndices,
    usedLeafHashes,
  ] = decoded as unknown as [
    bigint, bigint, bigint,
    string, string, string,
    bigint,
    bigint[], bigint[], string[],
  ];

  if (Number(decision) !== r.decision) {
    fail(`[${label}] decision mismatch: encoded=${r.decision}, decoded=${decision}`);
  }
  if (costPlusUnitPrice !== r.costPlusUnitPrice) {
    fail(`[${label}] costPlusUnitPrice mismatch: encoded=${r.costPlusUnitPrice}, decoded=${costPlusUnitPrice}`);
  }
  if (nadacUnitPrice !== r.nadacUnitPrice) {
    fail(`[${label}] nadacUnitPrice mismatch: encoded=${r.nadacUnitPrice}, decoded=${nadacUnitPrice}`);
  }
  if (rationaleHash.toLowerCase() !== r.rationaleHash.toLowerCase()) {
    fail(`[${label}] rationaleHash mismatch: encoded=${r.rationaleHash}, decoded=${rationaleHash}`);
  }
  if (clauseRef.toLowerCase() !== r.clauseRef.toLowerCase()) {
    fail(`[${label}] clauseRef mismatch: encoded=${r.clauseRef}, decoded=${clauseRef}`);
  }
  if (standardRef.toLowerCase() !== r.standardRef.toLowerCase()) {
    fail(`[${label}] standardRef mismatch: encoded=${r.standardRef}, decoded=${standardRef}`);
  }
  if (receiptId !== r.receiptId) {
    fail(`[${label}] receiptId mismatch: encoded=${r.receiptId}, decoded=${receiptId}`);
  }
  if (policyVoidedClauseIndices.length !== r.policyVoidedClauseIndices.length) {
    fail(`[${label}] policyVoidedClauseIndices length mismatch: encoded=${r.policyVoidedClauseIndices.length}, decoded=${policyVoidedClauseIndices.length}`);
  }
  for (let i = 0; i < policyVoidedClauseIndices.length; i++) {
    if (Number(policyVoidedClauseIndices[i]!) !== r.policyVoidedClauseIndices[i]!) {
      fail(`[${label}] policyVoidedClauseIndices[${i}] mismatch: encoded=${r.policyVoidedClauseIndices[i]}, decoded=${policyVoidedClauseIndices[i]}`);
    }
  }
  if (usedReferenceIndices.length !== r.usedReferenceIndices.length) {
    fail(`[${label}] usedReferenceIndices length mismatch: encoded=${r.usedReferenceIndices.length}, decoded=${usedReferenceIndices.length}`);
  }
  for (let i = 0; i < usedReferenceIndices.length; i++) {
    if (Number(usedReferenceIndices[i]!) !== r.usedReferenceIndices[i]!) {
      fail(`[${label}] usedReferenceIndices[${i}] mismatch: encoded=${r.usedReferenceIndices[i]}, decoded=${usedReferenceIndices[i]}`);
    }
  }
  if (usedLeafHashes.length !== r.usedLeafHashes.length) {
    fail(`[${label}] usedLeafHashes length mismatch: encoded=${r.usedLeafHashes.length}, decoded=${usedLeafHashes.length}`);
  }
  for (let i = 0; i < usedLeafHashes.length; i++) {
    if (usedLeafHashes[i]!.toLowerCase() !== r.usedLeafHashes[i]!.toLowerCase()) {
      fail(`[${label}] usedLeafHashes[${i}] mismatch: encoded=${r.usedLeafHashes[i]}, decoded=${usedLeafHashes[i]}`);
    }
  }
  console.log(`✓ round-trip [${label}]: ${(encoded.length - 2) / 2} bytes; all ${RULING_ABI_TYPES.length} fields preserved`);
}

function main(): void {
  // Check 1: static type-list equality.
  checkTypeListsMatch();

  // Check 2: round-trip five sample rulings (one per Decision enum value
  // plus a schema-ceiling sample). Each sample exercises a different mix of
  // empty vs populated arrays to hit the dynamic-tail boundary in the ethers
  // ABI codec.
  roundTrip(
    {
      decision: Decision.Approve,
      costPlusUnitPrice: 200n,
      nadacUnitPrice: 180n,
      rationaleHash: ethers.id("approve:rationale"),
      clauseRef: ethers.id("approve:clause"),
      standardRef: ZERO_HASH,
      receiptId: 0n,
      policyVoidedClauseIndices: [],
      usedReferenceIndices: [],
      usedLeafHashes: [],
    },
    "Approve (all empty arrays)",
  );
  roundTrip(
    {
      decision: Decision.Deny,
      costPlusUnitPrice: 999_999n,
      nadacUnitPrice: 888_888n,
      rationaleHash: ethers.id("deny:cost-too-high"),
      clauseRef: ethers.id("deny:clause:max-unit-price"),
      standardRef: ethers.id("deny:standard:fda-label"),
      receiptId: 12345n,
      policyVoidedClauseIndices: [],
      usedReferenceIndices: [0, 1, 2, 65535],
      usedLeafHashes: [ethers.id("leaf:a"), ethers.id("leaf:b")],
    },
    "Deny (populated arrays, max uint16)",
  );
  roundTrip(
    {
      decision: Decision.NeedMoreEvidence,
      costPlusUnitPrice: 0n,
      nadacUnitPrice: 0n,
      rationaleHash: ethers.id("nme:insufficient-justification"),
      clauseRef: ethers.id("nme:clause:evidence-required"),
      standardRef: ZERO_HASH,
      receiptId: 0n,
      policyVoidedClauseIndices: [],
      usedReferenceIndices: [],
      usedLeafHashes: [],
    },
    "NeedMoreEvidence (zero prices)",
  );
  roundTrip(
    {
      decision: Decision.PolicyInvalid,
      costPlusUnitPrice: 1n,
      nadacUnitPrice: 1n,
      rationaleHash: ethers.id("policyinvalid:self-contradiction"),
      clauseRef: ethers.id("policyinvalid:clause:1-and-7"),
      standardRef: ethers.id("policyinvalid:standard:none"),
      receiptId: 999n,
      policyVoidedClauseIndices: [1, 7, 42, 1024],
      usedReferenceIndices: [],
      usedLeafHashes: [ethers.id("leaf:c"), ethers.id("leaf:d"), ethers.id("leaf:e")],
    },
    "PolicyInvalid (voided clauses populated)",
  );
  // Schema-ceiling sample: per LLM_RULING_SCHEMA in orchestrator-real.ts, wei
  // amounts cap at 10^30 (well below uint256 max) and arrays cap at 64 elements.
  // Exercises the largest valid payload the encoder will ever emit at runtime.
  const maxArr64 = Array.from({ length: 64 }, (_, i) => i);
  const maxLeafHashes64 = Array.from({ length: 64 }, (_, i) => ethers.id(`leaf:ceiling:${i}`));
  roundTrip(
    {
      decision: Decision.Approve,
      costPlusUnitPrice: 10n ** 30n,
      nadacUnitPrice: 10n ** 30n - 1n,
      rationaleHash: ethers.id("ceiling:rationale"),
      clauseRef: ethers.id("ceiling:clause"),
      standardRef: ethers.id("ceiling:standard"),
      receiptId: 2n ** 256n - 1n,
      policyVoidedClauseIndices: maxArr64,
      usedReferenceIndices: maxArr64,
      usedLeafHashes: maxLeafHashes64,
    },
    "Schema ceiling (10^30 wei, 64-element arrays, max receiptId)",
  );

  console.log(`\nR26 build-time check PASS: orchestrator encoder ↔ contract decoder shape preserved.`);
}

main();
