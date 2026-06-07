/**
 * SPEC-0008 R1–R9 — WalletOnboarding startup modal.
 *
 * Shown over a dimming backdrop when no usable provider key is loaded (or when
 * VITE_FORCE_WALLET_PROMPT=1 forces it for testing). Gates the whole app until
 * the user loads valid key(s) via the existing localStorage keyOverride path.
 *
 * Two key slots:
 *   - Provider key  (required) → written to curie:VITE_PRIVATE_KEY
 *   - Insurer key   (optional) → written to curie:VITE_PRIVATE_KEY_INSURER
 *     Empty insurer ⇒ do not write the insurer slot ⇒ client.ts falls back to
 *     the provider key (SPEC-0008 R4).
 *
 * PHI — no patient data. Keys are testnet signing keys only.
 */
import { useState, useCallback, ChangeEvent } from "react";
import { KEY_STORAGE_PREFIX, isValidHexKey, deriveAddress } from "../walletKeys.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps the shared `deriveAddress` from walletKeys.ts, returning null
 * on invalid input rather than throwing. This is the single derivation path
 * for the modal (SPEC-0008 §3 DRY — no direct ethers Wallet instantiation here).
 */
function safeDerive(key: string): string | null {
  if (!isValidHexKey(key)) return null;
  try {
    return deriveAddress(key);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WalletOnboardingProps {
  /**
   * Called after valid keys have been written to localStorage.
   * The parent (App.tsx) should reload the page or re-init clients.
   */
  readonly onLoaded: () => void;

  /**
   * Pre-fill values for the inputs — used when VITE_FORCE_WALLET_PROMPT=1
   * so the modal appears pre-filled from the env keys (SPEC-0008 R6).
   */
  readonly prefillProvider?: string;
  readonly prefillInsurer?: string;

  /**
   * SPEC-0008 R14 — designated BURNABLE demo keys (public, testnet-only). When a
   * provider demo key is provided, a "Load demo wallets" button appears that fills
   * the fields with these keys. Distinct from the user's own-key path; these are
   * intentionally public (anyone can use them). Omit (default) → no button.
   */
  readonly demoProvider?: string;
  readonly demoInsurer?: string;
}

// ---------------------------------------------------------------------------
// Per-field sub-component
// ---------------------------------------------------------------------------

interface KeyFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly required: boolean;
  readonly testId: string;
}

function KeyField({ label, value, onChange, required, testId }: KeyFieldProps) {
  const [show, setShow] = useState(false);
  const derived = value.length > 0 ? safeDerive(value) : null;
  const isInvalid = value.length > 0 && !isValidHexKey(value);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value.trim()),
    [onChange],
  );

  return (
    <div className="key-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
      <label htmlFor={testId} style={{ marginBottom: 4 }}>
        {label}
        {!required && (
          <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>
            (optional — defaults to provider)
          </span>
        )}
      </label>
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        <input
          id={testId}
          data-testid={testId}
          type={show ? "text" : "password"}
          placeholder="0x..."
          value={value}
          onChange={handleChange}
          autoComplete="off"
          spellCheck={false}
          style={{ flex: 1, fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          style={{ flexShrink: 0 }}
          aria-label={show ? "Hide key" : "Show key"}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {isInvalid && (
        <span className="key-error" data-testid={`${testId}-error`} role="alert">
          Invalid key — must be 0x-prefixed 32-byte hex (64 hex chars).
        </span>
      )}
      {derived && (
        <span
          data-testid={`${testId}-address`}
          style={{ fontSize: 11.5, color: "var(--ok)", marginTop: 4 }}
        >
          Address: <code style={{ fontSize: 11 }}>{derived}</code>
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function WalletOnboarding({
  onLoaded,
  prefillProvider = "",
  prefillInsurer = "",
  demoProvider = "",
  demoInsurer = "",
}: WalletOnboardingProps) {
  const [providerKey, setProviderKey] = useState(prefillProvider);
  const [insurerKey, setInsurerKey] = useState(prefillInsurer);
  const [error, setError] = useState<string | null>(null);

  // SPEC-0008 R14: show the demo-load affordance only when a demo provider key
  // is configured (public testnet-only burnable wallets).
  const hasDemo = safeDerive(demoProvider) !== null;

  // SPEC-0008 R3 (amended): validity == successful derivation (computeAddress),
  // not regex shape alone. A shape-valid but out-of-range key (e.g. 0x00…00)
  // passes isValidHexKey but throws in computeAddress — safeDerive catches that
  // and returns null, so canLoad stays false for such keys.
  const providerValid = safeDerive(providerKey) !== null;
  const insurerValid = insurerKey === "" || safeDerive(insurerKey) !== null;
  const canLoad = providerValid && insurerValid;

  const handleLoad = useCallback(() => {
    if (!canLoad) return;
    try {
      window.localStorage.setItem(
        KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY",
        providerKey,
      );
      if (insurerKey !== "") {
        window.localStorage.setItem(
          KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY_INSURER",
          insurerKey,
        );
      }
      onLoaded();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not write to localStorage.",
      );
    }
  }, [canLoad, providerKey, insurerKey, onLoaded]);

  return (
    <>
      {/* Backdrop — dims / blocks the rest of the app */}
      <div
        className="modal-backdrop"
        aria-hidden="true"
        data-testid="modal-backdrop"
      />

      {/* Modal card */}
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-onboarding-title"
        data-testid="wallet-onboarding-modal"
      >
        <h2 id="wallet-onboarding-title" style={{ marginTop: 0 }}>
          Load wallet keys
        </h2>
        <p style={{ color: "var(--text-2)", fontSize: 13.5, margin: "0 0 8px" }}>
          This build ships without signing keys. Paste your testnet private keys
          to enable on-chain signing. Keys are stored in{" "}
          <code>localStorage</code> only — never in the bundle.
        </p>

        <KeyField
          label="Provider key"
          value={providerKey}
          onChange={setProviderKey}
          required
          testId="provider-key-input"
        />

        <KeyField
          label="Insurer key"
          value={insurerKey}
          onChange={setInsurerKey}
          required={false}
          testId="insurer-key-input"
        />

        {error && (
          <p
            className="error"
            role="alert"
            data-testid="wallet-onboarding-error"
          >
            {error}
          </p>
        )}

        <div
          style={{
            marginTop: 8,
            display: "flex",
            justifyContent: hasDemo ? "space-between" : "flex-end",
            alignItems: "center",
            gap: 8,
          }}
        >
          {hasDemo && (
            <button
              type="button"
              onClick={() => {
                setProviderKey(demoProvider);
                setInsurerKey(demoInsurer);
                setError(null);
              }}
              data-testid="wallet-onboarding-demo"
              title="Fill the public testnet demo wallets (anyone can use them)"
            >
              Load demo wallets
            </button>
          )}
          <button
            type="button"
            className="primary"
            disabled={!canLoad}
            onClick={handleLoad}
            data-testid="wallet-onboarding-load"
          >
            Load wallets
          </button>
        </div>
        {hasDemo && (
          <p
            className="hint"
            data-testid="wallet-onboarding-demo-note"
            style={{ fontSize: 11.5, marginTop: 6 }}
          >
            "Load demo wallets" fills <strong>public, testnet-only</strong> keys anyone can
            use — for trying the demo, not for real funds.
          </p>
        )}
      </div>
    </>
  );
}
