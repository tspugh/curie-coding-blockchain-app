/**
 * Shared constants and helpers for the SPEC-0003 §2.9 R42 runtime-configurable
 * wallet keys. Consumers: `client.ts` (reads keys at module init) and
 * `views/Settings.tsx` (writes keys from the UI panel). Centralising here
 * prevents the storage-key prefix and the hex-validation regex from drifting
 * apart — both files must agree on shape exactly or saved keys vanish.
 *
 * SPEC-0008: also exports `hasUsableProviderKey` (startup gate) and
 * `deriveAddress` (live address derivation for WalletOnboarding + Settings).
 */
import { computeAddress } from "ethers";

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

/**
 * Derive the 0x-prefixed Ethereum address from a hex private key.
 *
 * Uses `ethers.computeAddress` (secp256k1 pubkey → keccak → address), which
 * is the same path used by `ethers.Wallet`. Throws a descriptive error for
 * invalid keys so callers surface useful messages to the UI.
 *
 * PHI note: no patient data is passed here — this is key material only.
 */
export function deriveAddress(privateKey: string): string {
  if (!isValidHexKey(privateKey)) {
    throw new Error(`invalid private key: must be 0x-prefixed 32-byte hex`);
  }
  return computeAddress(privateKey);
}

/**
 * Options for {@link hasUsableProviderKey}. Both fields are optional; omitting
 * them causes the function to read from the real `window.localStorage` and (in
 * a browser/Vite context) from `import.meta.env.VITE_PRIVATE_KEY`. Supplying
 * them is the unit-test injection path — avoids DOM + Vite globals in Node.
 */
export interface HasUsableProviderKeyOpts {
  /**
   * If set, use this value instead of reading `curie:VITE_PRIVATE_KEY` from
   * real localStorage. `null` means "empty / not stored".
   */
  storageOverride?: string | null;
  /**
   * If set, use this value instead of reading `import.meta.env.VITE_PRIVATE_KEY`.
   * `undefined` means "no env key".
   */
  envKey?: string | undefined;
}

/**
 * True when a **valid** provider private key is available from either
 * localStorage (`curie:VITE_PRIVATE_KEY`) or the env (`VITE_PRIVATE_KEY`).
 *
 * SPEC-0008 R1/R5 gate helper: the startup modal shows only when this returns
 * `false` (or when `VITE_FORCE_WALLET_PROMPT=1` overrides it).
 *
 * When called without options it reads the real localStorage and env, making
 * it suitable for production use in `App.tsx`. Passing `opts` is the unit-test
 * injection path (no DOM, no Vite globals required).
 */
export function hasUsableProviderKey(opts?: HasUsableProviderKeyOpts): boolean {
  let storageValue: string | null;
  if (opts && "storageOverride" in opts) {
    storageValue = opts.storageOverride ?? null;
  } else {
    try {
      storageValue = window.localStorage.getItem(KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY");
    } catch {
      storageValue = null;
    }
  }

  if (storageValue !== null && isValidHexKey(storageValue)) {
    return true;
  }

  let envValue: string | undefined;
  if (opts && "envKey" in opts) {
    envValue = opts.envKey;
  } else {
    try {
      // import.meta.env is only available in Vite/browser context.
      // In Node (tests without injection) this may be undefined.
      const meta = (typeof import.meta !== "undefined" && import.meta.env)
        ? import.meta.env
        : undefined;
      const raw = meta?.["VITE_PRIVATE_KEY"];
      envValue = typeof raw === "string" && raw.length > 0 ? raw : undefined;
    } catch {
      envValue = undefined;
    }
  }

  return typeof envValue === "string" && isValidHexKey(envValue);
}
