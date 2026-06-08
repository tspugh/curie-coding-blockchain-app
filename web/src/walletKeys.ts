/**
 * Shared constants and helpers for the SPEC-0003 §2.9 R42 runtime-configurable
 * wallet keys. Consumers: `client.ts` (reads keys at module init) and
 * `views/Settings.tsx` (writes keys from the UI panel). Centralising here
 * prevents the storage-key prefix and the hex-validation regex from drifting
 * apart — both files must agree on shape exactly or saved keys vanish.
 *
 * SPEC-0008: also exports `hasUsableProviderKey` (startup gate),
 * `deriveAddress` (live address derivation for WalletOnboarding + Settings),
 * and `getDevPrefill` (env-key reader for the force-prompt modal pre-fill, R6).
 */
import { computeAddress, Wallet } from "ethers";

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

/**
 * Read a raw env-key value for use as a modal pre-fill (SPEC-0008 R6 amended).
 *
 * Returns the value of `import.meta.env[name]` if it is a non-empty valid hex
 * key, otherwise `""`. Used by App.tsx when `VITE_FORCE_WALLET_PROMPT=1` to
 * pre-fill the WalletOnboarding modal from env — the operator's local `.env`
 * holds the testnet key, so the modal opens already filled and the flow can be
 * exercised end-to-end without clearing localStorage.
 *
 * SECURITY (SPEC-0008 §6): dynamic bracket access (`import.meta.env[name]`)
 * causes Vite to inline the full `import.meta.env` object, not a specific
 * named variable — the same footprint as the pre-existing `keyOverride` in
 * `client.ts`. This is acceptable because:
 *   (a) the public deploy build sets `VITE_PRIVATE_KEY=""` (empty), so the
 *       inlined value is `""` — no real key appears in the shipped bundle;
 *   (b) `deploy-static.sh` aborts if a non-empty key value is found in dist/;
 *   (c) callers must pass name as a literal (not a dynamic string) so the call
 *       site is auditable.
 *
 * App.tsx deliberately does NOT access `import.meta.env.VITE_PRIVATE_KEY`
 * directly (that static access would trigger a separate named-property inline),
 * delegating here instead (F8-1 compliance).
 *
 * PHI note: this reads signing-key material only — no patient data.
 */
export function getDevPrefill(
  name: "VITE_PRIVATE_KEY" | "VITE_PRIVATE_KEY_INSURER",
  envOverride?: Record<string, unknown>,
): string {
  try {
    // `envOverride` lets unit tests exercise the env-read logic deterministically
    // (import.meta.env is a Vite build-time construct, not present under node:test).
    // App.tsx calls with no override → reads the real import.meta.env.
    const meta = envOverride
      ?? ((typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : undefined);
    const raw: unknown = meta?.[name];
    return typeof raw === "string" && isValidHexKey(raw) ? raw : "";
  } catch {
    return "";
  }
}

/**
 * SPEC-0008 R14 — designated BURNABLE demo keys for the public deploy.
 *
 * Read from a SEPARATE env channel (`VITE_DEMO_PROVIDER_KEY` /
 * `VITE_DEMO_INSURER_KEY`) than the user's own `VITE_PRIVATE_KEY` slot. These are
 * intentionally baked into the PUBLIC bundle so a "Load demo wallets" button can
 * pre-fill the onboarding modal — they are **public, testnet-only, disposable**
 * keys anyone can use, NOT a secret. The user's own-key path (R7) is unchanged:
 * `VITE_PRIVATE_KEY` is still stripped to "" in the public build.
 *
 * Returns `null` when no valid demo provider key is configured (the button hides),
 * so non-demo builds never show the affordance. Dynamic bracket access keeps Vite
 * from inlining a *named* `import.meta.env.VITE_DEMO_*` reference elsewhere (same
 * footprint rule as `getDevPrefill`).
 */
/**
 * Generate a fresh pair of EPHEMERAL, throwaway signing keys (provider +
 * insurer) via `ethers.Wallet.createRandom()`.
 *
 * Used by the onboarding modal in SIMULATED wallet mode so the "Load demo
 * wallets" button can never dead-end when no `VITE_DEMO_*` keys are configured
 * (e.g. a plain sim build). These keys hold no funds and back a chain-less
 * backend — they exist only to satisfy the startup gate so the user can proceed.
 *
 * PHI note: random key material only — no patient data.
 */
export function generateEphemeralKeys(): { provider: string; insurer: string } {
  return {
    provider: Wallet.createRandom().privateKey,
    insurer: Wallet.createRandom().privateKey,
  };
}

export function getDemoKeys(
  envOverride?: Record<string, unknown>,
): { provider: string; insurer: string } | null {
  try {
    const meta = envOverride
      ?? ((typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : undefined);
    const rawP: unknown = meta?.["VITE_DEMO_PROVIDER_KEY"];
    if (typeof rawP !== "string" || !isValidHexKey(rawP)) return null;
    const rawI: unknown = meta?.["VITE_DEMO_INSURER_KEY"];
    const insurer = typeof rawI === "string" && isValidHexKey(rawI) ? rawI : "";
    return { provider: rawP, insurer };
  } catch {
    return null;
  }
}
