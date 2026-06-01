/**
 * SPEC-0001 R19 drift-check for `contracts/contracts/ISomniaAgent.sol`.
 *
 * R19 requires the vendored Solidity interface to byte-match the upstream
 * (https://docs.somnia.network/agents/invoking-agents/from-solidity) so
 * `solc` emits the same selectors the deployed `AgentPlatform` responds to.
 *
 * This v0 form pins a keccak256 of the file. ANY local edit changes the hash
 * and the test fails — forcing the editor to:
 *   1. Re-verify the file byte-matches upstream (or document the upstream diff).
 *   2. Update the verified-against-upstream date in the file header.
 *   3. Bump FROZEN_INTERFACE_HASH below to the new keccak256.
 *   4. Cite the upstream diff in the commit body (per R19).
 *
 * If the file is renamed, moved, or deleted the test ALSO fails on the fs read,
 * surfacing the rename explicitly rather than silently dropping the gate.
 *
 * Recompute locally with:
 *   node -e "const fs=require('fs'),{ethers}=require('ethers');
 *     console.log(ethers.keccak256(ethers.toUtf8Bytes(
 *       fs.readFileSync('contracts/contracts/ISomniaAgent.sol','utf8'))))"
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { ethers } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * keccak256 of `contracts/contracts/ISomniaAgent.sol` as of the last reviewer
 * verification against upstream (header date 2026-05-29). Bump this and the
 * file header's "Last verified against upstream" date together.
 */
const FROZEN_INTERFACE_HASH =
  "0x5036e6ca31886f6ff3b6c0864632d8d11749dd5b59d5af4c06a6afbd6929016a";

test("ISomniaAgent.sol matches the frozen R19 verification hash", () => {
  // Walk up from src/protocol/ to the repo root, then dive into contracts/.
  const path = join(__dirname, "..", "..", "contracts", "contracts", "ISomniaAgent.sol");
  const src = readFileSync(path, "utf8");
  const actual = ethers.keccak256(ethers.toUtf8Bytes(src));

  assert.equal(
    actual,
    FROZEN_INTERFACE_HASH,
    `ISomniaAgent.sol changed since the last R19 verification.\n` +
      `Expected: ${FROZEN_INTERFACE_HASH}\n` +
      `Got:      ${actual}\n` +
      `If the edit was intentional, re-verify byte-match against upstream\n` +
      `(https://docs.somnia.network/agents/invoking-agents/from-solidity),\n` +
      `update the "Last verified against upstream" date in the file header,\n` +
      `bump FROZEN_INTERFACE_HASH here, and cite the upstream diff in the commit body.`,
  );
});
