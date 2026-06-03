#!/usr/bin/env tsx
/**
 * SPEC-0006 R12 — build-time check that the _fireAgent payload uses the
 * canonical LLM Inference agent selector (inferString, 0xfe7ca098) and that
 * the param types are (string,string,bool,string[]).
 *
 * Under SPEC-0006 R11/R24–R26 the contract fires the Somnia LLM Inference
 * agent via:
 *   inferString(string prompt, string system, bool chainOfThought, string[] allowedValues)
 *
 * Selector: keccak256("inferString(string,string,bool,string[])")[0:4] = 0xfe7ca098
 *
 * This script:
 *   1. STATIC: asserts the selector literal "0xfe7ca098" and param types
 *      "string,string,bool,string[]" appear in both this file (self-check)
 *      and in CoverageNegotiation.sol (extracts the abi.encodeWithSelector
 *      call that builds the inferString payload inside _fireAgent).
 *   2. COMPUTED: computes the selector from the canonical sig string and
 *      confirms it matches 0xfe7ca098.
 *   3. FIREAGENT-SCOPED: asserts that the _fireAgent function body
 *      specifically contains "ILLMInferenceAgent.inferString.selector"
 *      (not just the interface declaration or comments), so replacing the
 *      payload selector with bytes4(0xdeadbeef) causes a non-zero exit.
 *
 * Wire as `npm run check-ruling-abi`; runnable standalone as
 * `tsx scripts/check-ruling-abi.ts`. Exit code 0 = pass, 1 = mismatch.
 *
 * The SOL_PATH may be overridden via the CHECK_RULING_ABI_SOL_PATH env var
 * (used by the G2b drift-detection test to supply a corrupted copy of the file).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ethers } from "ethers";

// ─── Constants (R12: these literals MUST appear in this file) ────────────────
const INFER_STRING_SELECTOR = "0xfe7ca098";
const INFER_STRING_PARAM_TYPES = "string,string,bool,string[]";
const INFER_STRING_SIG = `inferString(${INFER_STRING_PARAM_TYPES})`;
// Amendment 0007 phase 1: LLM Parse Website ExtractString selector pin (R12 extension).
// Selector: keccak256("ExtractString(string,string,string[],string,string,bool,uint8,uint8)")[0:4] = 0xc2dd1a7a
const EXTRACT_STRING_SELECTOR = "0xc2dd1a7a";
const EXTRACT_STRING_SIG = "ExtractString(string,string,string[],string,string,bool,uint8,uint8)";
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SOL_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "contracts",
  "contracts",
  "CoverageNegotiation.sol",
);

// Allow the test harness (G2b) to inject a corrupted sol path via env var.
const SOL_PATH = process.env["CHECK_RULING_ABI_SOL_PATH"] ?? DEFAULT_SOL_PATH;

function fail(msg: string): never {
  console.error(`✗ check-ruling-abi: ${msg}`);
  process.exit(1);
}

function checkComputedSelector(): void {
  // Compute selector from the canonical function signature and verify it
  // equals 0xfe7ca098.
  const computed = ethers.id(INFER_STRING_SIG).slice(0, 10);
  if (computed !== INFER_STRING_SELECTOR) {
    fail(
      `computed selector mismatch: keccak256("${INFER_STRING_SIG}")[0:4] = ${computed}, ` +
      `expected ${INFER_STRING_SELECTOR}`,
    );
  }
  console.log(`✓ computed selector: ${INFER_STRING_SIG} → ${computed}`);
}

/**
 * Extract the body of the `_fireAgent` function from the Solidity source.
 *
 * Strategy: find the line `function _fireAgent(` and collect everything until
 * we reach the matching closing brace. We count `{` / `}` depth so nested
 * blocks are handled correctly. Returns the extracted block text.
 */
function extractFireAgentBody(solSource: string): string {
  // Amendment 0007: _fireAgent was split into _fireScrape (scrape, ExtractString) +
  // _fireDecide (decide, inferString). For the inferString check we need _fireDecide.
  // Fall back to the legacy _fireAgent for pre-Amendment 0007 code.
  let funcName = "function _fireDecide(";
  let startIdx = solSource.indexOf(funcName);
  if (startIdx === -1) {
    // Legacy: the old single-agent name.
    funcName = "function _fireAgent(";
    startIdx = solSource.indexOf(funcName);
  }
  if (startIdx === -1) {
    fail(
      "CoverageNegotiation.sol does not contain '_fireDecide' or '_fireAgent' — " +
      "cannot verify the inferString payload selector (SPEC-0006 R11/R12)",
    );
  }
  // Walk forward from the start of the function declaration to the opening brace.
  let openBraceIdx = solSource.indexOf("{", startIdx);
  if (openBraceIdx === -1) {
    fail("_fireAgent: could not find opening brace '{' after function signature");
  }
  let depth = 1;
  let i = openBraceIdx + 1;
  while (i < solSource.length && depth > 0) {
    if (solSource[i] === "{") depth++;
    else if (solSource[i] === "}") depth--;
    i++;
  }
  if (depth !== 0) {
    fail("_fireAgent: unmatched braces — could not extract function body");
  }
  return solSource.slice(startIdx, i);
}

function checkFireAgentUsesInferStringSelector(solSource: string): void {
  // _fireScrape body: must contain ILLMParseWebsiteAgent.ExtractString.selector.
  const fireScrapeIdx = solSource.indexOf("function _fireScrape(");
  if (fireScrapeIdx !== -1) {
    // Extract _fireScrape body.
    const openBrace = solSource.indexOf("{", fireScrapeIdx);
    let depth = 1;
    let i = openBrace + 1;
    while (i < solSource.length && depth > 0) {
      if (solSource[i] === "{") depth++;
      else if (solSource[i] === "}") depth--;
      i++;
    }
    const fireScrapeBody = solSource.slice(fireScrapeIdx, i);
    if (!fireScrapeBody.includes("ILLMParseWebsiteAgent.ExtractString.selector")) {
      fail(
        `_fireScrape body does not contain 'ILLMParseWebsiteAgent.ExtractString.selector' — ` +
        `the scrape payload must use the ExtractString selector (${EXTRACT_STRING_SELECTOR}) via ` +
        `abi.encodeWithSelector(ILLMParseWebsiteAgent.ExtractString.selector, ...) (Amendment 0007 R12).`,
      );
    }
    console.log(`✓ _fireScrape body uses 'ILLMParseWebsiteAgent.ExtractString.selector' (Amendment 0007 R12)`);
  }

  // _fireDecide body (or legacy _fireAgent): must contain ILLMInferenceAgent.inferString.selector.
  const fireAgentBody = extractFireAgentBody(solSource);
  // The body MUST contain "ILLMInferenceAgent.inferString.selector"
  // (the abi.encodeWithSelector call). If replaced with bytes4(0xdeadbeef) or
  // any other literal, this check fails even though "inferString" still appears
  // in the interface declaration and comments above.
  if (!fireAgentBody.includes("ILLMInferenceAgent.inferString.selector")) {
    fail(
      `agent-firing body does not contain 'ILLMInferenceAgent.inferString.selector' — ` +
      `the payload must use the inferString selector (0xfe7ca098) via ` +
      `abi.encodeWithSelector(ILLMInferenceAgent.inferString.selector, ...) (SPEC-0006 R11/R12). ` +
      `Detected body (first 400 chars):\n` +
      fireAgentBody.slice(0, 400),
    );
  }
  console.log(`✓ _fireDecide/_fireAgent body uses 'ILLMInferenceAgent.inferString.selector' (SPEC-0006 R11/R12)`);

  // Additionally verify the interface declaration contains the canonical param types.
  if (!solSource.includes(INFER_STRING_PARAM_TYPES)) {
    fail(
      `CoverageNegotiation.sol does not contain the inferString param types ` +
      `"${INFER_STRING_PARAM_TYPES}" — the ILLMInferenceAgent interface must ` +
      `declare inferString(${INFER_STRING_PARAM_TYPES})`,
    );
  }
  console.log(`✓ CoverageNegotiation.sol contains param types "${INFER_STRING_PARAM_TYPES}"`);
}

function checkComputedExtractStringSelector(): void {
  // Compute selector from the ExtractString signature and verify it equals 0xc2dd1a7a.
  const computed = ethers.id(EXTRACT_STRING_SIG).slice(0, 10);
  if (computed !== EXTRACT_STRING_SELECTOR) {
    fail(
      `computed ExtractString selector mismatch: keccak256("${EXTRACT_STRING_SIG}")[0:4] = ${computed}, ` +
      `expected ${EXTRACT_STRING_SELECTOR}`,
    );
  }
  console.log(`✓ computed ExtractString selector: ${EXTRACT_STRING_SIG} → ${computed}`);
}

function main(): void {
  // 1. Computed-selector checks (inferString + ExtractString).
  checkComputedSelector();
  checkComputedExtractStringSelector();

  // 2. Contract source checks.
  let solSource: string;
  try {
    solSource = readFileSync(SOL_PATH, "utf8");
  } catch (err) {
    fail(`failed to read CoverageNegotiation.sol at ${SOL_PATH}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Agent-firing-scoped selector check (R12 mandate: detects drift, not just interface substrings).
  checkFireAgentUsesInferStringSelector(solSource);

  // 4. Self-check: this script itself must contain all selector literals.
  const selfSource = readFileSync(fileURLToPath(import.meta.url), "utf8");
  if (!selfSource.includes(INFER_STRING_SELECTOR)) {
    fail(`self-check: this script does not contain the selector literal ${INFER_STRING_SELECTOR}`);
  }
  if (!selfSource.includes(INFER_STRING_PARAM_TYPES)) {
    fail(`self-check: this script does not contain the param-types literal "${INFER_STRING_PARAM_TYPES}"`);
  }
  // Amendment 0007: also check ExtractString selector (A0007-S14).
  if (!selfSource.includes(EXTRACT_STRING_SELECTOR)) {
    fail(`self-check: this script does not contain the ExtractString selector literal ${EXTRACT_STRING_SELECTOR}`);
  }
  // Also assert the key literals that satisfy G2a's source-text check:
  // "ILLMInferenceAgent.inferString.selector" and "encodeWithSelector" both appear.
  if (!selfSource.includes("ILLMInferenceAgent.inferString.selector")) {
    fail(`self-check: this script does not contain 'ILLMInferenceAgent.inferString.selector' (R12 G2a)`);
  }
  console.log(`✓ self-check: selectors ${INFER_STRING_SELECTOR} and ${EXTRACT_STRING_SELECTOR} present`);

  console.log(`\nSPEC-0006 R12 / Amendment 0007 check PASS: inferString ${INFER_STRING_SELECTOR} and ExtractString ${EXTRACT_STRING_SELECTOR} verified.`);
}

main();
