/**
 * Tests for `src/wallet/wallet.ts` — the `SimulatedWallet` class + the
 * `createWallet` factory (SPEC-0001 R11).
 *
 * `RealWallet` construction is exempt from unit testing per the loop's
 * no-mock invariant — it requires an actual ethers JsonRpcProvider + a real
 * private key and is exercised via the testnet-mode browser-verify harness
 * instead. The factory's REAL branch is exercised here only through its
 * error guards (missing key / malformed key), which run synchronously and
 * don't touch a network.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { ethers } from "ethers";

import { SimulatedWallet, createWallet } from "./wallet.js";

// ---------------------------------------------------------------------------
// Reset SOMNIA_WALLET_MODE / PRIVATE_KEY between tests so we don't accidentally
// pick up a host-env variable.
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = {
  SOMNIA_WALLET_MODE: process.env.SOMNIA_WALLET_MODE,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  SOMNIA_NETWORK: process.env.SOMNIA_NETWORK,
};

function withEnv(
  env: Record<string, string | undefined>,
  fn: () => void,
): void {
  const overrides = Object.entries(env);
  const saved: Record<string, string | undefined> = {};
  for (const [k] of overrides) saved[k] = process.env[k];
  try {
    for (const [k, v] of overrides) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const [k] of overrides) {
      const original = saved[k];
      if (original === undefined) delete process.env[k];
      else process.env[k] = original;
    }
  }
}

// ---------------------------------------------------------------------------
// SimulatedWallet
// ---------------------------------------------------------------------------

test("SimulatedWallet has mode 'simulated' + null signer + null provider", () => {
  const w = new SimulatedWallet("seed-A");
  assert.equal(w.mode, "simulated");
  assert.equal(w.signer, null);
  assert.equal(w.provider, null);
});

test("SimulatedWallet's address is the trailing 20 bytes of keccak256(seed), checksummed", () => {
  const seed = "deterministic-test-seed";
  const w = new SimulatedWallet(seed);
  // Independently recompute via ethers + assert byte-for-byte match.
  const digest = ethers.keccak256(ethers.toUtf8Bytes(seed));
  const expected = ethers.getAddress("0x" + digest.slice(-40));
  assert.equal(w.address, expected);
});

test("SimulatedWallet is deterministic — same seed → same address", () => {
  const a = new SimulatedWallet("repeat-seed");
  const b = new SimulatedWallet("repeat-seed");
  assert.equal(a.address, b.address);
});

test("SimulatedWallet distinguishes different seeds", () => {
  const a = new SimulatedWallet("seed-A");
  const b = new SimulatedWallet("seed-B");
  assert.notEqual(a.address, b.address);
});

test("SimulatedWallet default seed yields a stable, non-zero address", () => {
  const w = new SimulatedWallet();
  // Address must be a checksummed 20-byte 0x...
  assert.match(w.address, /^0x[0-9a-fA-F]{40}$/);
  assert.notEqual(w.address.toLowerCase(), "0x" + "00".repeat(20));
});

// ---------------------------------------------------------------------------
// createWallet — simulated branch
// ---------------------------------------------------------------------------

test("createWallet defaults to simulated mode when nothing is set", () => {
  withEnv(
    { SOMNIA_WALLET_MODE: undefined, PRIVATE_KEY: undefined },
    () => {
      const w = createWallet();
      assert.equal(w.mode, "simulated");
      assert.ok(w instanceof SimulatedWallet);
    },
  );
});

test("createWallet forwards the seed to SimulatedWallet", () => {
  const seed = "factory-seed";
  const w = createWallet({ mode: "simulated", seed });
  const expected = new SimulatedWallet(seed).address;
  assert.equal(w.address, expected);
});

test("createWallet reads SOMNIA_WALLET_MODE=simulated from env when no explicit mode", () => {
  withEnv(
    { SOMNIA_WALLET_MODE: "simulated", PRIVATE_KEY: undefined },
    () => {
      assert.equal(createWallet().mode, "simulated");
    },
  );
});

test("createWallet throws on a malformed SOMNIA_WALLET_MODE env var", () => {
  withEnv({ SOMNIA_WALLET_MODE: "garbage" }, () => {
    assert.throws(
      () => createWallet(),
      /Invalid SOMNIA_WALLET_MODE/,
    );
  });
});

// ---------------------------------------------------------------------------
// createWallet — real-mode error guards
// (RealWallet construction is exempt; only the synchronous validation guards
// run here, no network is touched.)
// ---------------------------------------------------------------------------

test("createWallet real mode throws when no private key is provided", () => {
  withEnv({ PRIVATE_KEY: undefined }, () => {
    assert.throws(
      () => createWallet({ mode: "real" }),
      /Real wallet mode requires a private key/,
    );
  });
});

test("createWallet real mode throws when the private key is malformed", () => {
  assert.throws(
    () => createWallet({ mode: "real", privateKey: "not-a-hex-key" }),
    /must be a 0x-prefixed 32-byte hex string/,
  );
});

test("createWallet real mode throws when the private key is short", () => {
  assert.throws(
    () => createWallet({ mode: "real", privateKey: "0xabcdef" }),
    /must be a 0x-prefixed 32-byte hex string/,
  );
});

// Sanity: make sure host-env wasn't polluted by the env-mutating helpers.
test("ORIGINAL_ENV is restored after the env-mutating tests", () => {
  assert.equal(process.env.SOMNIA_WALLET_MODE, ORIGINAL_ENV.SOMNIA_WALLET_MODE);
  assert.equal(process.env.PRIVATE_KEY, ORIGINAL_ENV.PRIVATE_KEY);
  assert.equal(process.env.SOMNIA_NETWORK, ORIGINAL_ENV.SOMNIA_NETWORK);
});
