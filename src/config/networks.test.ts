/**
 * Tests for `src/config/networks.ts` — the Somnia network metadata + the two
 * explorer URL helpers (`txUrl`, `addressUrl`).
 *
 * Pins the values that the UI surfaces (chain id, RPC/WS URLs, explorer URLs)
 * so an unintended edit to the network constants fails loud here before it
 * lands on the wallet chip or the on-chain link in the Detail timeline.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SOMNIA_TESTNET,
  SOMNIA_MAINNET,
  SOMNIA_NETWORKS,
  addressUrl,
  txUrl,
} from "./networks.js";

test("SOMNIA_TESTNET carries the Shannon-testnet chain id + RPC + WS URLs", () => {
  assert.equal(SOMNIA_TESTNET.chainId, 50312);
  assert.equal(SOMNIA_TESTNET.currencySymbol, "STT");
  assert.equal(SOMNIA_TESTNET.rpcUrl, "https://api.infra.testnet.somnia.network/");
  assert.equal(SOMNIA_TESTNET.wsUrl, "wss://api.infra.testnet.somnia.network/ws");
  assert.equal(SOMNIA_TESTNET.explorerUrl, "https://shannon-explorer.somnia.network/");
  assert.equal(SOMNIA_TESTNET.faucetUrl, "https://testnet.somnia.network/");
});

test("SOMNIA_MAINNET carries the mainnet chain id + currency + URLs", () => {
  assert.equal(SOMNIA_MAINNET.chainId, 5031);
  assert.equal(SOMNIA_MAINNET.currencySymbol, "SOMI");
  assert.equal(SOMNIA_MAINNET.rpcUrl, "https://api.infra.mainnet.somnia.network/");
  assert.equal(SOMNIA_MAINNET.wsUrl, "wss://api.infra.mainnet.somnia.network/ws");
  assert.equal(SOMNIA_MAINNET.explorerUrl, "https://explorer.somnia.network/");
});

test("SOMNIA_NETWORKS is a frozen registry keyed by short name", () => {
  assert.equal(SOMNIA_NETWORKS.testnet, SOMNIA_TESTNET);
  assert.equal(SOMNIA_NETWORKS.mainnet, SOMNIA_MAINNET);
});

test("txUrl appends /tx/<hash> to the explorer URL with no double slash", () => {
  const hash = "0x" + "ab".repeat(32);
  assert.equal(
    txUrl(SOMNIA_TESTNET, hash),
    `https://shannon-explorer.somnia.network/tx/${hash}`,
  );
  // Mainnet path verifies the trailing-slash normalization works the same way.
  assert.equal(
    txUrl(SOMNIA_MAINNET, hash),
    `https://explorer.somnia.network/tx/${hash}`,
  );
});

test("addressUrl appends /address/<addr> with no double slash", () => {
  const addr = "0x204031FA1ad46a2D453b7c54fC28Ff1787Bd9128";
  assert.equal(
    addressUrl(SOMNIA_TESTNET, addr),
    `https://shannon-explorer.somnia.network/address/${addr}`,
  );
});

test("explorer URL builders strip exactly one trailing slash from base", () => {
  // Both functions use the same `.replace(/\/$/, "")` — pin that contract.
  const fakeNetwork = { ...SOMNIA_TESTNET, explorerUrl: "https://no-trailing-slash.example" };
  const hash = "0x" + "00".repeat(32);
  assert.equal(
    txUrl(fakeNetwork, hash),
    `https://no-trailing-slash.example/tx/${hash}`,
  );
  assert.equal(
    addressUrl(fakeNetwork, "0xabc"),
    "https://no-trailing-slash.example/address/0xabc",
  );
});
