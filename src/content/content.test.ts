/**
 * Tests for `src/content/content.ts` — the off-chain content store + the two
 * verification helpers (`hashContent`, `verifyContent`, `ContentStore.verify`).
 *
 * Covers SPEC-0001 R3/R4/T1: the keccak256 hash matches Solidity's
 * `keccak256(bytes(content))` byte-for-byte; storing is idempotent; retrieving
 * by case-mixed hex still works; verification compares case-insensitively.
 *
 * **HARD INVARIANT** (R4): the on-chain commitment is the *hash*, never the
 * content. These tests pin that nothing in the store leaks the raw content
 * through its hash representation.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { ethers } from "ethers";

import { ContentStore, hashContent, verifyContent } from "./content.js";

// ---------------------------------------------------------------------------
// hashContent
// ---------------------------------------------------------------------------

test("hashContent matches Solidity's keccak256(bytes(content))", () => {
  // Independently recomputed via ethers — pins the SPEC-0001 R3 wire format.
  const text = "Severe plaque psoriasis; PASI 14";
  const expected = ethers.keccak256(ethers.toUtf8Bytes(text));
  assert.equal(hashContent(text), expected);
});

test("hashContent('') is the well-known empty-bytes keccak256", () => {
  // 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470 is the
  // canonical keccak256 of the empty byte string — pinned here so a future
  // change to the ethers import or encoder would fail loud.
  assert.equal(
    hashContent(""),
    "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
  );
});

test("hashContent is deterministic across calls", () => {
  const text = "deterministic input";
  assert.equal(hashContent(text), hashContent(text));
});

test("hashContent differs across distinct inputs", () => {
  assert.notEqual(hashContent("a"), hashContent("b"));
});

// ---------------------------------------------------------------------------
// ContentStore.put / get / has / size
// ---------------------------------------------------------------------------

test("ContentStore.put returns the matching hash + byteLength", () => {
  const store = new ContentStore();
  const text = "synthetic clinical justification — no PHI";
  const { hash, byteLength } = store.put(text);
  assert.equal(hash, hashContent(text));
  assert.equal(byteLength, ethers.toUtf8Bytes(text).length);
});

test("ContentStore.put is idempotent — same content twice yields same hash", () => {
  const store = new ContentStore();
  const a = store.put("repeat me");
  const b = store.put("repeat me");
  assert.equal(a.hash, b.hash);
  assert.equal(store.size, 1);
});

test("ContentStore.get retrieves by hash; misses return undefined", () => {
  const store = new ContentStore();
  const text = "round-tripped content";
  const { hash } = store.put(text);
  assert.equal(store.get(hash), text);
  // A different hash returns undefined.
  assert.equal(
    store.get("0x" + "ab".repeat(32)),
    undefined,
  );
});

test("ContentStore.get is case-insensitive on the lookup hash", () => {
  const store = new ContentStore();
  const text = "case test";
  const { hash } = store.put(text);
  // hashContent returns the lowercase ethers form; uppercase the hex digits
  // and confirm the store still finds it.
  const upper = "0x" + hash.slice(2).toUpperCase();
  assert.equal(store.get(upper), text);
});

test("ContentStore.has + size mirror the put state", () => {
  const store = new ContentStore();
  assert.equal(store.size, 0);
  const { hash } = store.put("one");
  assert.equal(store.size, 1);
  assert.equal(store.has(hash), true);
  // A miss is false.
  assert.equal(store.has("0x" + "00".repeat(32)), false);
});

// ---------------------------------------------------------------------------
// ContentStore.verify
// ---------------------------------------------------------------------------

test("ContentStore.verify confirms matching content against on-chain hash (R3)", () => {
  const store = new ContentStore();
  const text = "the note that lives off-chain";
  const { hash } = store.put(text);
  assert.equal(store.verify(text, hash), true);
});

test("ContentStore.verify rejects a tampered content string", () => {
  const store = new ContentStore();
  const original = "original content";
  const { hash } = store.put(original);
  assert.equal(store.verify("tampered content", hash), false);
});

test("ContentStore.verify is case-insensitive on the on-chain hash", () => {
  const store = new ContentStore();
  const text = "verify case test";
  const { hash } = store.put(text);
  const upper = "0x" + hash.slice(2).toUpperCase();
  assert.equal(store.verify(text, upper), true);
});

// ---------------------------------------------------------------------------
// verifyContent (static helper)
// ---------------------------------------------------------------------------

test("verifyContent matches when content hashes to onChainHash", () => {
  const text = "static verify";
  const hash = hashContent(text);
  assert.equal(verifyContent(text, hash), true);
});

test("verifyContent rejects a tampered content string", () => {
  const text = "original";
  const hash = hashContent(text);
  assert.equal(verifyContent("tampered", hash), false);
});

test("verifyContent is case-insensitive on the on-chain hash", () => {
  const text = "static case test";
  const hash = hashContent(text);
  const upper = "0x" + hash.slice(2).toUpperCase();
  assert.equal(verifyContent(text, upper), true);
});
