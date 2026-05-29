/**
 * SPEC-0004 §2.3 evidence-packet types + Merkle-root helpers.
 *
 * R9: parties collect public-reference evidence off-chain.
 * R10: each round's packet is structured slices, committed via Merkle root.
 * R11: rulings cite (referenceIndex, leafHash) — consumers use {@link merkleLeaf}.
 *
 * Hash formula (R10, §3.4):
 *   sliceHash = keccak256(utf8(JSON.stringify(slice)))
 *   leaf      = keccak256(abi.encode(string url, bytes32 contentHash, bytes32 sliceHash))
 *   root      = sorted-pair Merkle root (duplicate-last on odd levels)
 *
 * Empty-packet convention: root === bytes32(0) (no leaves to commit).
 */
import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Types — SPEC-0004 §3.4
// ---------------------------------------------------------------------------

export type SliceKind =
  | "fda-label-indication"
  | "fda-label-contraindication"
  | "guideline-recommendation"
  | "formulary-entry"
  | "price-benchmark";

export type EvidenceSlice = {
  text: string;
  kind?: SliceKind;
  locator?: { section?: string; page?: number; cssPath?: string };
};

export type EvidenceReference = {
  url: string;
  /** keccak256 of source bytes at fetch time */
  contentHash: `0x${string}`;
  slice: EvidenceSlice;
};

export type Packet = {
  references: EvidenceReference[];
  submittedAt: number;
  submittedBy: `0x${string}`;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const coder = ethers.AbiCoder.defaultAbiCoder();

/**
 * keccak256(utf8(JSON.stringify(slice))).
 *
 * Key-ordering matters: callers must author the slice object in canonical
 * (insertion) order — `{ text, kind, locator }` — because JSON.stringify
 * preserves insertion order. No canonicalization library is used (out of scope
 * for v0).
 */
export function sliceHash(slice: EvidenceSlice): `0x${string}` {
  return ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(slice))
  ) as `0x${string}`;
}

/**
 * keccak256(abi.encode(string url, bytes32 contentHash, bytes32 sliceHash))
 * per SPEC-0004 §3.4 R10. Used by ruling-citation consumers (R11).
 */
export function merkleLeaf(ref: EvidenceReference): `0x${string}` {
  return ethers.keccak256(
    coder.encode(
      ["string", "bytes32", "bytes32"],
      [ref.url, ref.contentHash, sliceHash(ref.slice)]
    )
  ) as `0x${string}`;
}

/**
 * Sorted-pair Merkle root over {@link merkleLeaf} values (R10).
 *
 * Conventions:
 * - Empty packet → `bytes32(0)` (no leaves to commit).
 * - Single leaf  → returned as-is (no additional hashing).
 * - Multi-leaf   → pair-hash with two design choices that future on-chain
 *   verifiers MUST match (SPEC-0004 §3.4 is silent; pinned here):
 *     • Duplicate-last on odd levels (Bitcoin convention; NOT OpenZeppelin's
 *       `StandardMerkleTree`, which promotes lone nodes instead).
 *     • Sorted pairs — `keccak256(min(L,R) ‖ max(L,R))` — matching OZ's on-chain
 *       `MerkleProof.verify`, so a future verifier can use that library without
 *       flipping proofs.
 *
 *   Revisit when SPEC-0004 Phase 5's on-chain `PacketSubmitted` consumer lands.
 */
export function merkleRoot(refs: EvidenceReference[]): `0x${string}` {
  if (refs.length === 0) {
    return `0x${"00".repeat(32)}`;
  }

  let level: `0x${string}`[] = refs.map(merkleLeaf);

  if (level.length === 1) {
    return level[0] as `0x${string}`;
  }

  while (level.length > 1) {
    if (level.length % 2 !== 0) {
      level.push(level[level.length - 1] as `0x${string}`);
    }

    const next: `0x${string}`[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i] as `0x${string}`;
      const b = level[i + 1] as `0x${string}`;
      // Sort pair → root matches OZ MerkleProof.verify (R10 forward-compat).
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const packed = ethers.solidityPacked(["bytes32", "bytes32"], [lo, hi]);
      next.push(ethers.keccak256(packed) as `0x${string}`);
    }
    level = next;
  }

  return level[0] as `0x${string}`;
}
