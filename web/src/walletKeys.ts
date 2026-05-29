/**
 * Shared constants and helpers for the SPEC-0003 §2.9 R42 runtime-configurable
 * wallet keys. Consumers: `client.ts` (reads keys at module init) and
 * `views/Settings.tsx` (writes keys from the UI panel). Centralising here
 * prevents the storage-key prefix and the hex-validation regex from drifting
 * apart — both files must agree on shape exactly or saved keys vanish.
 */

/** localStorage key prefix for runtime-configurable wallet private keys. */
export const KEY_STORAGE_PREFIX = "curie:" as const;

/**
 * Stable shape for a private key (0x-prefixed 32-byte hex). Used for both
 * storage validation and UI input validation. Case-insensitive on the hex
 * digits; the `0X` prefix is intentionally rejected to match `ethers.Wallet`'s
 * input requirement.
 */
export const HEX_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

/** True when `s` matches {@link HEX_KEY_RE} — a valid 0x32-byte-hex key. */
export function isValidHexKey(s: string): boolean {
  return HEX_KEY_RE.test(s);
}
