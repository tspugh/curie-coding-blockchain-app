/**
 * Shared 10-tuple ABI shape for arbiter rulings.
 *
 * The on-chain `CoverageNegotiation.handleResponse` (contract source line ~661)
 * decodes `responses[0].result` as:
 *
 *     abi.decode(
 *       responses[0].result,
 *       (uint8, uint256, uint256, bytes32, bytes32, bytes32, uint256, uint16[], uint16[], bytes32[])
 *     )
 *
 * The off-chain orchestrator (`scripts/orchestrator-real.ts`) must encode every
 * ruling using the SAME tuple shape, or the contract will revert or decode wrong
 * fields. This module is the single source of truth for both sides — the
 * orchestrator imports `RULING_ABI_TYPES` + `encodeRuling`, and the build-time
 * check (`scripts/check-ruling-abi.ts`, SPEC-0004 §2.7 R26 repurposed under
 * Amendment 0006) asserts the local list matches the canonical contract decoder
 * literal AND that round-trip encode → decode preserves every field.
 *
 * If you change the on-chain decoder, change this file too — the check will
 * fail loud at build time if they drift.
 */

import { ethers } from "ethers";

export const Decision = { Approve: 0, Deny: 1, NeedMoreEvidence: 2, PolicyInvalid: 3 } as const;

export const ZERO_HASH = "0x" + "00".repeat(32);

export interface Ruling {
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

/**
 * The 10-tuple encoder type list, in the SAME order the contract decoder
 * destructures. Order is load-bearing — swapping any two elements silently
 * corrupts rulings (e.g. costPlusUnitPrice ↔ nadacUnitPrice would still type-check
 * but yield wrong on-chain settlement caps).
 */
export const RULING_ABI_TYPES: readonly string[] = [
  "uint8", "uint256", "uint256",
  "bytes32", "bytes32", "bytes32",
  "uint256",
  "uint16[]", "uint16[]", "bytes32[]",
];

export function encodeRuling(r: Ruling): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    [...RULING_ABI_TYPES],
    [
      r.decision, r.costPlusUnitPrice, r.nadacUnitPrice,
      r.rationaleHash, r.clauseRef, r.standardRef,
      r.receiptId,
      r.policyVoidedClauseIndices, r.usedReferenceIndices, r.usedLeafHashes,
    ],
  );
}
