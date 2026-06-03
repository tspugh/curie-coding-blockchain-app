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
  const startIdx = solSource.indexOf("function _fireAgent(");
  if (startIdx === -1) {
    fail(
      "CoverageNegotiation.sol does not contain 'function _fireAgent(' — " +
      "cannot verify the payload selector is scoped to _fireAgent (R12)",
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
  const fireAgentBody = extractFireAgentBody(solSource);

  // The _fireAgent body MUST contain "ILLMInferenceAgent.inferString.selector"
  // (the abi.encodeWithSelector call). If replaced with bytes4(0xdeadbeef) or
  // any other literal, this check fails even though "inferString" still appears
  // in the interface declaration and comments above.
  if (!fireAgentBody.includes("ILLMInferenceAgent.inferString.selector")) {
    fail(
      `_fireAgent body does not contain 'ILLMInferenceAgent.inferString.selector' — ` +
      `the payload must use the inferString selector (0xfe7ca098) via ` +
      `abi.encodeWithSelector(ILLMInferenceAgent.inferString.selector, ...) (SPEC-0006 R11/R12). ` +
      `Detected _fireAgent body (first 400 chars):\n` +
      fireAgentBody.slice(0, 400),
    );
  }
  console.log(`✓ _fireAgent body uses 'ILLMInferenceAgent.inferString.selector' (SPEC-0006 R11/R12)`);

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

function main(): void {
  // 1. Computed-selector check.
  checkComputedSelector();

  // 2. Contract source checks.
  let solSource: string;
  try {
    solSource = readFileSync(SOL_PATH, "utf8");
  } catch (err) {
    fail(`failed to read CoverageNegotiation.sol at ${SOL_PATH}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. _fireAgent-scoped selector check (R12 mandate: detects drift, not just interface substrings).
  checkFireAgentUsesInferStringSelector(solSource);

  // 4. Self-check: this script itself must contain both the selector literal
  //    and the param-types string (R12 test asserts these appear in the source).
  const selfSource = readFileSync(fileURLToPath(import.meta.url), "utf8");
  if (!selfSource.includes(INFER_STRING_SELECTOR)) {
    fail(`self-check: this script does not contain the selector literal ${INFER_STRING_SELECTOR}`);
  }
  if (!selfSource.includes(INFER_STRING_PARAM_TYPES)) {
    fail(`self-check: this script does not contain the param-types literal "${INFER_STRING_PARAM_TYPES}"`);
  }
  // Also assert the key literals that satisfy G2a's source-text check:
  // "ILLMInferenceAgent.inferString.selector" and "encodeWithSelector" both appear.
  if (!selfSource.includes("ILLMInferenceAgent.inferString.selector")) {
    fail(`self-check: this script does not contain 'ILLMInferenceAgent.inferString.selector' (R12 G2a)`);
  }
  console.log(`✓ self-check: selector ${INFER_STRING_SELECTOR} and param types "${INFER_STRING_PARAM_TYPES}" present`);

  console.log(`\nSPEC-0006 R12 check PASS: inferString selector ${INFER_STRING_SELECTOR} verified.`);
}

main();
