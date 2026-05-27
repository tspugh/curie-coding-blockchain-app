/**
 * Off-chain content store + keccak256 commitment (SPEC-0001 R3/R4, T1).
 *
 * This is the mechanism that keeps PHI / notes OFF the chain: raw content
 * (patient notes, evidence text, feedback messages) lives only here, in memory,
 * keyed by its `keccak256` hash. Only that hash is ever committed on-chain. A
 * verification helper lets either party confirm their local copy matches the
 * on-chain `noteHash` (R3 — "both parties can verify their copy matches").
 *
 * HARD INVARIANT (R4): callers must commit `hash` on-chain, never the content.
 */
import { ethers } from "ethers";

/**
 * Compute the `keccak256` hash of a UTF-8 string, returned as a 0x-prefixed
 * 32-byte hex string — identical to Solidity's `keccak256(bytes(content))`,
 * so an off-chain hash and an on-chain `noteHash` are directly comparable.
 */
export function hashContent(content: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(content));
}

/** The result of storing content: its hash, for on-chain commitment. */
export interface StoredContent {
  /** keccak256 of the content — commit THIS on-chain (never the content). */
  readonly hash: string;
  /** The content length in bytes (metadata only; never goes on-chain). */
  readonly byteLength: number;
}

/**
 * In-memory, content-addressed store. Holds raw off-chain content keyed by its
 * keccak256 hash. Framework-agnostic; a real deployment would back this with a
 * durable off-chain store, but the interface and the on-chain boundary are the
 * same.
 */
export class ContentStore {
  private readonly byHash = new Map<string, string>();

  /**
   * Store content and return its hash. Idempotent: storing the same content
   * twice yields the same hash and overwrites harmlessly.
   */
  put(content: string): StoredContent {
    const hash = hashContent(content);
    this.byHash.set(hash, content);
    return { hash, byteLength: ethers.toUtf8Bytes(content).length };
  }

  /** Retrieve content by its hash, or `undefined` if not held locally. */
  get(hash: string): string | undefined {
    return this.byHash.get(this.normalize(hash));
  }

  /** Whether content for `hash` is held locally. */
  has(hash: string): boolean {
    return this.byHash.has(this.normalize(hash));
  }

  /**
   * Verify that a candidate content string matches an on-chain note hash (R3).
   * Recomputes keccak256 over the content and compares case-insensitively to
   * the supplied on-chain hash.
   */
  verify(content: string, onChainHash: string): boolean {
    return hashContent(content).toLowerCase() === this.normalize(onChainHash);
  }

  /** Number of distinct contents held. */
  get size(): number {
    return this.byHash.size;
  }

  private normalize(hash: string): string {
    return hash.toLowerCase();
  }
}

/**
 * Static verification helper for callers that don't hold a store: does
 * `content` hash to `onChainHash`?
 */
export function verifyContent(content: string, onChainHash: string): boolean {
  return hashContent(content).toLowerCase() === onChainHash.toLowerCase();
}
