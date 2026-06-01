/**
 * Tests for SPEC-0004 §2.3 + §3.4 evidence-packet hash formulas.
 *
 * Every formula assertion computes the expected hash independently (using
 * ethers primitives) and pins the implementation against it. If the impl
 * drifts from the spec formula, these tests fail loud.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { ethers } from "ethers";

import {
  EvidenceReference,
  EvidenceSlice,
  merkleLeaf,
  merkleRoot,
  sliceHash,
} from "./packet.js";

// ---------------------------------------------------------------------------
// Shared synthetic test data (no real FDA/CMS URLs)
// ---------------------------------------------------------------------------

const sliceA: EvidenceSlice = {
  text: "Drug X is indicated for condition Y per section 1.",
  kind: "fda-label-indication",
};

const sliceB: EvidenceSlice = {
  text: "Drug X is contraindicated for patients with allergy Z.",
  kind: "fda-label-contraindication",
};

const sliceC: EvidenceSlice = {
  text: "Guideline recommends Drug X as first-line for condition Y.",
  kind: "guideline-recommendation",
};

const sliceD: EvidenceSlice = {
  text: "Drug X price benchmark: WAC 120 USD per unit.",
  kind: "price-benchmark",
};

// Fixed synthetic contentHashes (32-byte hex literals).
const hashAllZero = `0x${"00".repeat(32)}` as `0x${string}`;
const hashAllA = `0x${"aa".repeat(32)}` as `0x${string}`;
const hashAllB = `0x${"bb".repeat(32)}` as `0x${string}`;
const hashAllC = `0x${"cc".repeat(32)}` as `0x${string}`;

const refA: EvidenceReference = {
  url: "https://example.com/fda/drug-x-label",
  contentHash: hashAllZero,
  slice: sliceA,
};

const refB: EvidenceReference = {
  url: "https://example.com/cms/guideline-y",
  contentHash: hashAllA,
  slice: sliceB,
};

const refC: EvidenceReference = {
  url: "https://example.com/payer/formulary-q4",
  contentHash: hashAllB,
  slice: sliceC,
};

const refD: EvidenceReference = {
  url: "https://example.com/benchmark/drug-x-wac",
  contentHash: hashAllC,
  slice: sliceD,
};

// Shared ethers helpers used inline throughout.
const coder = ethers.AbiCoder.defaultAbiCoder();

function computeSliceHash(slice: EvidenceSlice): string {
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(slice)));
}

function computeMerkleLeaf(ref: EvidenceReference): string {
  return ethers.keccak256(
    coder.encode(
      ["string", "bytes32", "bytes32"],
      [ref.url, ref.contentHash, computeSliceHash(ref.slice)]
    )
  );
}

function sortedPairHash(a: string, b: string): string {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return ethers.keccak256(
    ethers.solidityPacked(["bytes32", "bytes32"], [lo, hi])
  );
}

// ---------------------------------------------------------------------------
// Test 1: sliceHash determinism
// ---------------------------------------------------------------------------
test("sliceHash determinism — same slice produces identical hash on repeated calls", () => {
  const h1 = sliceHash(sliceA);
  const h2 = sliceHash(sliceA);
  assert.equal(h1, h2);
});

// ---------------------------------------------------------------------------
// Test 2: sliceHash differs across distinct slices
// ---------------------------------------------------------------------------
test("sliceHash differs when slice.text differs", () => {
  const hA = sliceHash(sliceA);
  const hB = sliceHash(sliceB);
  assert.notEqual(hA, hB);
});

// ---------------------------------------------------------------------------
// Test 3: sliceHash formula reproducibility (pinned against spec formula)
// ---------------------------------------------------------------------------
test("sliceHash matches keccak256(utf8(JSON.stringify(slice))) computed inline", () => {
  const expected = computeSliceHash(sliceA);
  assert.equal(sliceHash(sliceA), expected);
});

// ---------------------------------------------------------------------------
// Test 4: merkleLeaf formula reproducibility (pinned against spec formula)
// ---------------------------------------------------------------------------
test("merkleLeaf matches keccak256(abi.encode([string,bytes32,bytes32],[url,contentHash,sliceHash])) computed inline", () => {
  const expected = computeMerkleLeaf(refA);
  assert.equal(merkleLeaf(refA), expected);
});

// ---------------------------------------------------------------------------
// Test 5: merkleLeaf differs across refs — change url / contentHash / slice
// ---------------------------------------------------------------------------
test("merkleLeaf differs when url changes (same contentHash + slice)", () => {
  const refAlt: EvidenceReference = { ...refA, url: "https://example.com/alt/label" };
  assert.notEqual(merkleLeaf(refA), merkleLeaf(refAlt));
});

test("merkleLeaf differs when contentHash changes (same url + slice)", () => {
  const refAlt: EvidenceReference = { ...refA, contentHash: hashAllA };
  assert.notEqual(merkleLeaf(refA), merkleLeaf(refAlt));
});

test("merkleLeaf differs when slice changes (same url + contentHash)", () => {
  const refAlt: EvidenceReference = { ...refA, slice: sliceB };
  assert.notEqual(merkleLeaf(refA), merkleLeaf(refAlt));
});

// ---------------------------------------------------------------------------
// Test 6: Empty packet root === bytes32(0)
// ---------------------------------------------------------------------------
test("merkleRoot([]) returns the all-zero bytes32", () => {
  const expected = `0x${"00".repeat(32)}`;
  assert.equal(merkleRoot([]), expected);
});

// ---------------------------------------------------------------------------
// Test 7: Single-entry root === the leaf itself (no additional hashing)
// ---------------------------------------------------------------------------
test("merkleRoot([refA]) equals merkleLeaf(refA) exactly", () => {
  assert.equal(merkleRoot([refA]), merkleLeaf(refA));
});

// ---------------------------------------------------------------------------
// Test 8: Two-entry root — pinned against manually-computed sorted-pair hash
// ---------------------------------------------------------------------------
test("merkleRoot([refA, refB]) matches manually-computed sorted-pair hash", () => {
  const leafA = computeMerkleLeaf(refA);
  const leafB = computeMerkleLeaf(refB);
  const expected = sortedPairHash(leafA, leafB);
  assert.equal(merkleRoot([refA, refB]), expected);
});

// ---------------------------------------------------------------------------
// Test 9: Two-entry root order-independence (sorted pairs — n=2 only)
// ---------------------------------------------------------------------------
test("merkleRoot order-independence within a single pair (n=2 only)", () => {
  assert.equal(merkleRoot([refA, refB]), merkleRoot([refB, refA]));
});

// ---------------------------------------------------------------------------
// Test 10: Three-entry root (odd → duplicate-last) — pinned manually
// ---------------------------------------------------------------------------
test("merkleRoot([refA, refB, refC]) matches manually-computed three-leaf root with duplicate-last", () => {
  const leafA = computeMerkleLeaf(refA);
  const leafB = computeMerkleLeaf(refB);
  const leafC = computeMerkleLeaf(refC);

  // Level 1: [leafA, leafB, leafC] — odd, duplicate last → [leafA, leafB, leafC, leafC]
  // Pair 0: sort(leafA, leafB) → parentAB
  const parentAB = sortedPairHash(leafA, leafB);
  // Pair 1: sort(leafC, leafC) → parentCC (sorted pair of identical values)
  const parentCC = sortedPairHash(leafC, leafC);

  // Level 2: [parentAB, parentCC] — even
  const expected = sortedPairHash(parentAB, parentCC);

  assert.equal(merkleRoot([refA, refB, refC]), expected);
});

// ---------------------------------------------------------------------------
// M2 — Literal-pinned anchor tests (tick-38 strict-review M2)
// These literals were computed once via one-shot node invocations and frozen.
// If the implementation AND the ethers helper drift together, the frozen
// literal will still catch the divergence.
// ---------------------------------------------------------------------------

// Frozen literal — recompute with:
// node -e "const {ethers}=require('ethers');const s={text:'Drug X is indicated for condition Y per section 1.',kind:'fda-label-indication'};console.log(ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(s))));" # tick-38 strict-review M2 anchor
const LITERAL_SLICE_A_HASH = "0x92e2e1fcf74c960bec560529e4f7a01c9620f62db10899f1fef3726b3ad170a9";

// Frozen literal — recompute with:
// node -e "const {ethers}=require('ethers');const coder=ethers.AbiCoder.defaultAbiCoder();const sh=ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({text:'Drug X is indicated for condition Y per section 1.',kind:'fda-label-indication'})));console.log(ethers.keccak256(coder.encode(['string','bytes32','bytes32'],['https://example.com/fda/drug-x-label','0x'+'00'.repeat(32),sh])));" # tick-38 strict-review M2 anchor
const LITERAL_LEAF_A = "0x19c237fc6adde7400e4574c865557d4b6f8fc946431bb894555ef0de32b482a4";

// Frozen literal — recompute with:
// node -e "const {ethers}=require('ethers');const coder=ethers.AbiCoder.defaultAbiCoder();const shA=ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({text:'Drug X is indicated for condition Y per section 1.',kind:'fda-label-indication'})));const shB=ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({text:'Drug X is contraindicated for patients with allergy Z.',kind:'fda-label-contraindication'})));const lA=ethers.keccak256(coder.encode(['string','bytes32','bytes32'],['https://example.com/fda/drug-x-label','0x'+'00'.repeat(32),shA]));const lB=ethers.keccak256(coder.encode(['string','bytes32','bytes32'],['https://example.com/cms/guideline-y','0x'+'aa'.repeat(32),shB]));const [lo,hi]=lA<lB?[lA,lB]:[lB,lA];console.log(ethers.keccak256(ethers.solidityPacked(['bytes32','bytes32'],[lo,hi])));" # tick-38 strict-review M2 anchor
const LITERAL_ROOT_AB = "0x8f166e4b8f0c37c4ae00648bc459d019e8c5c92d670d4efd5c40c8a5d47a7004";

test("sliceHash(sliceA) matches frozen literal — M2 anchor", () => {
  assert.equal(sliceHash(sliceA), LITERAL_SLICE_A_HASH);
});

test("merkleLeaf(refA) matches frozen literal — M2 anchor", () => {
  assert.equal(merkleLeaf(refA), LITERAL_LEAF_A);
});

test("merkleRoot([refA, refB]) matches frozen literal — M2 anchor", () => {
  assert.equal(merkleRoot([refA, refB]), LITERAL_ROOT_AB);
});

// ---------------------------------------------------------------------------
// L2 — Edge-case tests
// ---------------------------------------------------------------------------

// Frozen literal — recompute with:
// node -e "const {ethers}=require('ethers');console.log(ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({text:''}))));" # tick-38 strict-review M2 anchor
const LITERAL_EMPTY_TEXT_HASH = "0xd75f3b1c74c582b95b4471e0b038877b941b00fba85fc6e8785800016f7343c1";

test("sliceHash({text:''}) matches frozen literal — L2 empty-text edge case", () => {
  const emptySlice: EvidenceSlice = { text: "" };
  assert.equal(sliceHash(emptySlice), LITERAL_EMPTY_TEXT_HASH);
});

test("sliceHash with kind:undefined equals sliceHash without kind (JSON.stringify drops undefined) — L2", () => {
  const sliceNoKind: EvidenceSlice = { text: "x" };
  // Cast through `any` because exactOptionalPropertyTypes prevents assigning `undefined`
  // directly to an optional field — but we want to verify the runtime JSON.stringify behaviour.
  const sliceUndefinedKind: EvidenceSlice = { text: "x", kind: undefined } as any;
  // JSON.stringify skips undefined properties; both should serialize identically.
  assert.equal(sliceHash(sliceNoKind), sliceHash(sliceUndefinedKind));
  // Differs from a slice with an actual kind value.
  const sliceWithKind: EvidenceSlice = { text: "x", kind: "fda-label-indication" };
  assert.notEqual(sliceHash(sliceNoKind), sliceHash(sliceWithKind));
});

test("sliceHash with populated locator is deterministic and differs from same slice without locator — L2", () => {
  const sliceWithLocator: EvidenceSlice = {
    text: "Evidence text.",
    kind: "fda-label-indication",
    locator: { section: "4.1", page: 12 },
  };
  const sliceWithoutLocator: EvidenceSlice = {
    text: "Evidence text.",
    kind: "fda-label-indication",
  };
  // Determinism: same result on repeated calls.
  assert.equal(sliceHash(sliceWithLocator), sliceHash(sliceWithLocator));
  // Asymmetry: locator changes the hash.
  assert.notEqual(sliceHash(sliceWithLocator), sliceHash(sliceWithoutLocator));
});

// Frozen literal — recompute with:
// node -e "const {ethers}=require('ethers');const coder=ethers.AbiCoder.defaultAbiCoder();function sh(s){return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(s)));}function lf(r){return ethers.keccak256(coder.encode(['string','bytes32','bytes32'],[r.url,r.contentHash,sh(r.slice)]));}function sph(a,b){const[lo,hi]=a<b?[a,b]:[b,a];return ethers.keccak256(ethers.solidityPacked(['bytes32','bytes32'],[lo,hi]));}const lA=lf({url:'https://example.com/fda/drug-x-label',contentHash:'0x'+'00'.repeat(32),slice:{text:'Drug X is indicated for condition Y per section 1.',kind:'fda-label-indication'}});const lB=lf({url:'https://example.com/cms/guideline-y',contentHash:'0x'+'aa'.repeat(32),slice:{text:'Drug X is contraindicated for patients with allergy Z.',kind:'fda-label-contraindication'}});const lC=lf({url:'https://example.com/payer/formulary-q4',contentHash:'0x'+'bb'.repeat(32),slice:{text:'Guideline recommends Drug X as first-line for condition Y.',kind:'guideline-recommendation'}});const lD=lf({url:'https://example.com/benchmark/drug-x-wac',contentHash:'0x'+'cc'.repeat(32),slice:{text:'Drug X price benchmark: WAC 120 USD per unit.',kind:'price-benchmark'}});const pAB=sph(lA,lB);const pCD=sph(lC,lD);console.log(sph(pAB,pCD));" # tick-38 strict-review M2 anchor
const LITERAL_ROOT_4_LEAF = "0xfa47aa5b8d5f4528ead1fe0af3e1c56aa3fa70d68788744440b670be62f2f30f";

test("merkleRoot 4-leaf: no duplicate-last branch hit (4→2→1), matches frozen literal — L2", () => {
  // Trace: pair(leafA,leafB)=parentAB; pair(leafC,leafD)=parentCD; root=pair(parentAB,parentCD).
  // Level shrinks 4→2→1 with no odd-level padding — confirming duplicate-last is NOT triggered.
  const leafA = computeMerkleLeaf(refA);
  const leafB = computeMerkleLeaf(refB);
  const leafC = computeMerkleLeaf(refC);
  const leafD = computeMerkleLeaf(refD);
  const parentAB = sortedPairHash(leafA, leafB);
  const parentCD = sortedPairHash(leafC, leafD);
  const expected = sortedPairHash(parentAB, parentCD);
  assert.equal(expected, LITERAL_ROOT_4_LEAF);
  assert.equal(merkleRoot([refA, refB, refC, refD]), LITERAL_ROOT_4_LEAF);
});

// ---------------------------------------------------------------------------
// L3 — 4-leaf order is NOT globally independent (per-pair only)
// ---------------------------------------------------------------------------

test("merkleRoot order-independence is per-pair, not global: swapping leaves across pairs changes root — L3", () => {
  // [refA, refB, refC, refD]: pairs are (A,B) and (C,D).
  // [refA, refC, refB, refD]: pairs are (A,C) and (B,D) — different pairings → different root.
  // (Note: reversing the whole array keeps the same pairs due to sorted-pair symmetry,
  // so we swap B↔C instead, which genuinely changes the pair groupings.)
  assert.notEqual(
    merkleRoot([refA, refB, refC, refD]),
    merkleRoot([refA, refC, refB, refD])
  );
});

// ---------------------------------------------------------------------------
// L4 — JSON key-insertion-order regression
// ---------------------------------------------------------------------------

test("sliceHash is key-order-sensitive: JSON.stringify preserves insertion order — regression-pinned per JSDoc gotcha", () => {
  // NOTE: If this test is deliberately broken in the future, it likely means a
  // RFC-8785 JCS canonicalization upgrade has been applied (which would sort keys).
  // In that case, update the JSDoc and delete or invert this test.
  const sliceTextThenKind: EvidenceSlice = { text: "T", kind: "fda-label-indication" };
  // Same logical fields, opposite insertion order — JSON.stringify produces different string.
  const sliceKindThenText: any = {};
  sliceKindThenText.kind = "fda-label-indication";
  sliceKindThenText.text = "T";
  assert.notEqual(sliceHash(sliceTextThenKind), sliceHash(sliceKindThenText));
});
