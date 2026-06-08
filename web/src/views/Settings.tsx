/**
 * Settings view: active profile picker + wallet info panel.
 *
 * NO fake data. NO hardcoded addresses or balances. NO Agent registry panel
 * (no real on-chain AgentRegistry surface yet — omitted per spec tick 22).
 * NO non-functional buttons (Switch to real, Faucet, Copy address) — left for
 * UNIT-SettingsScreen-actions.
 *
 * Data sources (inline):
 *   - Profile list:     client.profiles.listProfiles()
 *   - Active profile:   activeProfileId prop (lifted state in App.tsx)
 *   - Wallet address:   client.wallet.address
 *   - Wallet mode:      client.wallet.mode
 *   - Balance:          <WalletBalance /> component (live hook, real mode only)
 *   - Agent fee:        VITE_AGENT_FEE_WEI env var (default 330000000000000000 wei)
 *   - Chain ID:         SOMNIA_TESTNET.chainId (50312)
 *   - RPC host:         extracted from SOMNIA_TESTNET.rpcUrl
 */
import { useEffect, useMemo, useState } from "react";
import { Wallet } from "ethers";
import {
  SOMNIA_TESTNET,
  addUser,
  isDemoRole,
  loadUsers,
  removeUser,
  saveUsers,
  mergeAllowlist,
  SourceTier,
  type ApprovedSource,
  type SourceMatch,
  type AllowlistOverride,
  type DemoRole,
  type DemoUser,
} from "@lib";
import {
  loadApprovedSourcesOverride,
  saveApprovedSourcesOverride,
  clearApprovedSourcesOverride,
} from "../approvedSourcesStore.js";
import { USERS_CHANGED_EVENT, client } from "../client.js";
import {
  DEMO_MODE_CHANGED_EVENT,
  DEMO_MODE_STORAGE_KEY,
  loadDemoMode,
  saveDemoMode,
} from "../demoMode.js";
import { formatStt, formatSttCompact } from "../format.js";
import { useWalletBalance } from "../hooks/useWalletBalance.js";
import { KEY_STORAGE_PREFIX, isValidHexKey } from "../walletKeys.js";

const AGENT_FEE_WEI = BigInt(
  import.meta.env.VITE_AGENT_FEE_WEI ?? "330000000000000000",
);

/** "https://api.infra.testnet.somnia.network/" → "api.infra.testnet.somnia.network" */
function rpcHost(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

const CHAIN_ID = SOMNIA_TESTNET.chainId;
const RPC_DISPLAY = rpcHost(SOMNIA_TESTNET.rpcUrl);
const AGENT_FEE_STT = formatSttCompact(AGENT_FEE_WEI);

interface SettingsProps {
  readonly activeProfileId: string;
  readonly onProfileChange: (id: string) => void;
  readonly onBack: () => void;
}

export function Settings({
  activeProfileId,
  onProfileChange,
  onBack,
}: SettingsProps) {
  const profiles = client.profiles.listProfiles();
  const isReal = client.wallet.mode === "real";
  const { wei: balanceWei } = useWalletBalance();

  return (
    <section className="view settings">
      <div className="view-head">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        <h1>Settings &amp; wallet</h1>
      </div>

      {/* ── Active profile panel ── */}
      <div className="settings-panel">
        <div className="section-label">Active profile</div>
        <p className="hint">
          In production this is your assigned org role; the picker is a demo
          affordance.
        </p>
        <div className="profile-card-grid">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={activeProfileId === p.id}
              className={`profile-card${activeProfileId === p.id ? " is-active" : ""}`}
              onClick={() => onProfileChange(p.id)}
            >
              <div className="profile-card-head">
                <span className="profile-card-label">{p.label}</span>
                <span className="profile-card-party">
                  party {p.partyId.toString()}
                </span>
              </div>
              <div className="profile-card-sub">{p.description ?? p.id}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Users panel (SPEC-0005 R10/R11) ── */}
      <UsersPanel />

      {/* ── Demo-mode toggle (SPEC-0005 R13) ── */}
      <DemoModePanel />

      {/* ── Wallet panel ── */}
      <div className="settings-panel">
        <div className="section-label">Wallet</div>
        <dl className="fact-list">
          <div className="fact-row">
            <dt>Address</dt>
            <dd>
              <code data-testid="settings-wallet-address">
                {client.wallet.address}
              </code>
            </dd>
          </div>
          <div className="fact-row">
            <dt>Mode</dt>
            <dd>
              <span
                className={`pill no-dot ${isReal ? "tone-ok" : "tone-warn"}`}
                data-testid="settings-wallet-mode"
              >
                {isReal ? "real" : "simulated"}
              </span>
            </dd>
          </div>
          <div className="fact-row">
            <dt>Balance</dt>
            {/* Source: useWalletBalance hook. Null in simulated mode (no provider). */}
            <dd>
              {balanceWei !== null ? (
                <code>{formatStt(balanceWei)} STT</code>
              ) : (
                <span className="dim">—</span>
              )}
            </dd>
          </div>
          <div className="fact-row">
            <dt>Agent fee</dt>
            {/* Source: VITE_AGENT_FEE_WEI (build-time env var). */}
            <dd>
              <code>{AGENT_FEE_STT} STT per adjudication</code>
            </dd>
          </div>
          <div className="fact-row">
            <dt>Network</dt>
            {/* Source: SOMNIA_TESTNET.chainId from src/config/networks.ts. */}
            <dd>
              <code>Somnia testnet · chain {CHAIN_ID}</code>
            </dd>
          </div>
          <div className="fact-row">
            <dt>RPC</dt>
            {/* Source: host portion of SOMNIA_TESTNET.rpcUrl. */}
            <dd>
              <code>{RPC_DISPLAY}</code>
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Wallet keys (SPEC-0003 §2.9 R42 — runtime configurability) ── */}
      <WalletKeysPanel />

      {/* ── Approved evidence sources (SPEC-0010 R12) ── */}
      <ApprovedSourcesPanel />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Approved evidence sources panel — SPEC-0010 §3.6 / R12
// ---------------------------------------------------------------------------

const TIER_LABEL: Record<number, string> = {
  [SourceTier.FDA_LABEL]: "FDA label",
  [SourceTier.SYSTEMATIC_REVIEW]: "Systematic review",
  [SourceTier.GUIDELINE]: "Guideline",
  [SourceTier.PEER_REVIEWED]: "Peer-reviewed",
  [SourceTier.NARRATIVE]: "Narrative",
  [SourceTier.UNVETTED]: "Unvetted",
};

function formatMatch(m: SourceMatch): string {
  if (m.kind === "host") return `host: ${m.host}`;
  if (m.kind === "urlPrefix") return `url starts with: ${m.prefix}`;
  return `identifier: ${m.scheme.toUpperCase()}`;
}

function slugify(label: string): string {
  return (
    label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) ||
    `src-${label.length}`
  );
}

function ApprovedSourcesPanel() {
  const [override, setOverride] = useState<AllowlistOverride | null>(() =>
    loadApprovedSourcesOverride(),
  );
  const sources = useMemo(() => mergeAllowlist(override), [override]);

  // add-source form
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<SourceMatch["kind"]>("host");
  const [value, setValue] = useState("");
  const [scheme, setScheme] = useState<"pmid" | "doi">("pmid");
  const [tier, setTier] = useState<SourceTier>(SourceTier.GUIDELINE);
  const [error, setError] = useState<string | null>(null);

  function commit(next: AllowlistOverride) {
    setOverride(next);
    saveApprovedSourcesOverride(next);
  }

  function toggle(s: ApprovedSource) {
    if (s.builtin) {
      const disabled = new Set(override?.disabled ?? []);
      if (s.enabled) disabled.add(s.id);
      else disabled.delete(s.id);
      commit({ ...override, disabled: [...disabled] });
    } else {
      const custom = (override?.custom ?? []).map((c) =>
        c.id === s.id ? { ...c, enabled: !c.enabled } : c,
      );
      commit({ ...override, custom });
    }
  }

  function removeCustom(id: string) {
    commit({ ...override, custom: (override?.custom ?? []).filter((c) => c.id !== id) });
  }

  function reset() {
    clearApprovedSourcesOverride();
    setOverride(null);
  }

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lbl = label.trim();
    if (!lbl) return setError("Label is required.");
    let match: SourceMatch;
    if (kind === "host") {
      const host = value.trim().toLowerCase();
      if (!/^[a-z0-9.-]+$/.test(host) || host.includes("/"))
        return setError("Host must be a bare hostname (e.g. api.example.org) — no scheme or path.");
      match = { kind: "host", host };
    } else if (kind === "urlPrefix") {
      const prefix = value.trim();
      if (!prefix.startsWith("https://"))
        return setError("URL prefix must start with https://");
      match = { kind: "urlPrefix", prefix };
    } else {
      match = { kind: "identifier", scheme };
    }
    const id = slugify(lbl);
    if (sources.some((s) => s.id === id))
      return setError("A source with this label/id already exists.");
    const entry: ApprovedSource = { id, label: lbl, match, tier, builtin: false, enabled: true };
    commit({ ...override, custom: [...(override?.custom ?? []), entry] });
    setLabel("");
    setValue("");
  }

  return (
    <div className="settings-panel" data-testid="approved-sources-panel">
      <div className="section-label">Approved evidence sources</div>
      <p className="hint" data-testid="approved-sources-trust">
        The adjudication agent accepts evidence only from sources on this allowlist
        (SPEC-0010). <strong>Demo note:</strong> this list is a local operator convenience —
        in production, allowlist membership is payer/governance-controlled and a claim
        submitter cannot self-approve their own source.
      </p>
      <ul className="users-list" data-testid="approved-sources-list">
        {sources.map((s) => (
          <li key={s.id} className="users-row" data-testid={`approved-source-row-${s.id}`}>
            <div className="users-row-meta">
              <strong>{s.label}</strong>
              {s.builtin && <span className="badge mode">built-in</span>}
              <span className="badge mode">{TIER_LABEL[s.tier]}</span>
              <code>{formatMatch(s.match)}</code>
            </div>
            <div className="users-row-meta">
              <button
                type="button"
                role="switch"
                aria-checked={s.enabled}
                data-testid={`approved-source-toggle-${s.id}`}
                data-state={s.enabled ? "on" : "off"}
                onClick={() => toggle(s)}
              >
                {s.enabled ? "Enabled" : "Disabled"}
              </button>
              {!s.builtin && (
                <button
                  type="button"
                  data-testid={`approved-source-remove-${s.id}`}
                  onClick={() => removeCustom(s.id)}
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <form className="users-add" onSubmit={onAdd} data-testid="approved-source-add">
        <label>
          Label
          <input
            type="text"
            data-testid="approved-source-add-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Payer compendium mirror"
          />
        </label>
        <label>
          Match by
          <select
            data-testid="approved-source-add-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as SourceMatch["kind"])}
          >
            <option value="host">host</option>
            <option value="urlPrefix">url prefix</option>
            <option value="identifier">identifier</option>
          </select>
        </label>
        {kind === "identifier" ? (
          <label>
            Scheme
            <select
              data-testid="approved-source-add-scheme"
              value={scheme}
              onChange={(e) => setScheme(e.target.value as "pmid" | "doi")}
            >
              <option value="pmid">PMID</option>
              <option value="doi">DOI</option>
            </select>
          </label>
        ) : (
          <label>
            {kind === "host" ? "Hostname" : "URL prefix (https://…)"}
            <input
              type="text"
              data-testid="approved-source-add-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={kind === "host" ? "api.example.org" : "https://example.org/path/"}
            />
          </label>
        )}
        <label>
          Tier
          <select
            data-testid="approved-source-add-tier"
            value={tier}
            onChange={(e) => setTier(Number(e.target.value) as SourceTier)}
          >
            <option value={SourceTier.FDA_LABEL}>FDA label</option>
            <option value={SourceTier.SYSTEMATIC_REVIEW}>Systematic review</option>
            <option value={SourceTier.GUIDELINE}>Guideline</option>
            <option value={SourceTier.PEER_REVIEWED}>Peer-reviewed</option>
            <option value={SourceTier.NARRATIVE}>Narrative</option>
          </select>
        </label>
        {error && <p className="error" data-testid="approved-source-add-error">{error}</p>}
        <button type="submit" className="primary" data-testid="approved-source-add-submit">
          Add source
        </button>
      </form>

      <div className="key-actions">
        <button type="button" data-testid="approved-source-reset" onClick={reset}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wallet-keys panel — paste / clear / generate keys at runtime
// ---------------------------------------------------------------------------

type KeySlot = "VITE_PRIVATE_KEY" | "VITE_PRIVATE_KEY_INSURER";

function readStoredKey(slot: KeySlot): string {
  try {
    return window.localStorage.getItem(KEY_STORAGE_PREFIX + slot) ?? "";
  } catch {
    return "";
  }
}

/**
 * Persist (or clear) a key in localStorage. Throws on failure so the caller
 * can surface "couldn't save" instead of silently dropping the user's edit
 * (tick-25 LOW 3 closure). Failure modes: Safari private mode (QuotaExceeded),
 * disabled site data, browser extensions intercepting Storage.
 */
function writeStoredKey(slot: KeySlot, value: string): void {
  if (value) {
    window.localStorage.setItem(KEY_STORAGE_PREFIX + slot, value);
  } else {
    window.localStorage.removeItem(KEY_STORAGE_PREFIX + slot);
  }
}

/** Generate a random 32-byte private key via the platform CSPRNG. */
function generateHexKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

function WalletKeysPanel() {
  const [providerKey, setProviderKey] = useState(() => readStoredKey("VITE_PRIVATE_KEY"));
  const [insurerKey, setInsurerKey] = useState(() => readStoredKey("VITE_PRIVATE_KEY_INSURER"));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const providerValid = providerKey === "" || isValidHexKey(providerKey);
  const insurerValid = insurerKey === "" || isValidHexKey(insurerKey);

  const handleSave = () => {
    try {
      writeStoredKey("VITE_PRIVATE_KEY", providerKey);
      writeStoredKey("VITE_PRIVATE_KEY_INSURER", insurerKey);
      setSavedAt(Date.now());
      setSaveError(null);
    } catch (err) {
      // tick-25 LOW 3 closure: surface the failure instead of swallowing it.
      setSaveError(err instanceof Error ? err.message : String(err));
      setSavedAt(null);
    }
  };

  const handleClearAll = () => {
    try {
      writeStoredKey("VITE_PRIVATE_KEY", "");
      writeStoredKey("VITE_PRIVATE_KEY_INSURER", "");
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      return;
    }
    setProviderKey("");
    setInsurerKey("");
    setSavedAt(Date.now());
  };

  return (
    <div className="settings-panel">
      <div className="section-label">Wallet keys</div>
      <p className="hint">
        Override the env-baked keys at runtime. Testnet-only — never paste a key
        controlling real funds. Keys are stored in this browser's
        <code>localStorage</code>; clearing site data wipes them. <strong>Reload after saving
        for changes to take effect.</strong>
      </p>

      <div className="key-row">
        <label htmlFor="provider-key">Provider private key</label>
        <input
          id="provider-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="0x… (leave empty to use VITE_PRIVATE_KEY from .env)"
          value={providerKey}
          onChange={(e) => {
            setProviderKey(e.target.value.trim());
            setSavedAt(null);
          }}
          aria-invalid={!providerValid}
        />
        <button
          type="button"
          className="key-generate"
          onClick={() => {
            setProviderKey(generateHexKey());
            setSavedAt(null);
          }}
          title="Generate a fresh random key (you'll need to fund the address)"
        >
          Generate
        </button>
        {!providerValid && (
          <span className="key-error">Must be 0x + 64 hex chars</span>
        )}
      </div>

      <div className="key-row">
        <label htmlFor="insurer-key">Insurer private key</label>
        <input
          id="insurer-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="0x… (leave empty to fall back to provider key)"
          value={insurerKey}
          onChange={(e) => {
            setInsurerKey(e.target.value.trim());
            setSavedAt(null);
          }}
          aria-invalid={!insurerValid}
        />
        <button
          type="button"
          className="key-generate"
          onClick={() => {
            setInsurerKey(generateHexKey());
            setSavedAt(null);
          }}
          title="Generate a fresh random key (you'll need to fund the address)"
        >
          Generate
        </button>
        {!insurerValid && (
          <span className="key-error">Must be 0x + 64 hex chars</span>
        )}
      </div>

      <div className="key-actions">
        <button
          type="button"
          className="primary"
          onClick={handleSave}
          disabled={!providerValid || !insurerValid}
        >
          Save
        </button>
        <button type="button" onClick={handleClearAll}>
          Clear all
        </button>
        {saveError !== null && (
          <span className="key-error" role="alert">
            Could not save: {saveError}
          </span>
        )}
        {savedAt !== null && (
          <span className="hint">
            Saved. Reload to apply.{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                // tick-25 LOW 2 closure: confirm before discarding any
                // in-flight form state elsewhere in the app.
                if (window.confirm(
                  "Reload the page now? Any unsaved form input in other views will be lost.",
                )) {
                  window.location.reload();
                }
              }}
            >
              Reload now
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * SPEC-0005 R10/R11 — Users panel.
 *
 * Lists the runtime user registry (loaded from `curie:users` via userStore)
 * with per-user role + address chips and a Remove button. A small form below
 * lets the operator add a new user with label + role + address; persisting
 * to localStorage is automatic on each change. The list is purely
 * presentational here — wiring through to ProfileRegistry / signers at boot
 * is T75b (separate tick) so the foundation can land cleanly first.
 */
function UsersPanel() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newRole, setNewRole] = useState<DemoRole>("provider");
  const [newAddress, setNewAddress] = useState("");
  // SPEC-0005 R11: optional private-key paste. Never persisted — only used
  // at form submit to derive the address via ethers. Cleared on success
  // alongside the other fields.
  const [newKey, setNewKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Derive the address from `newKey` when valid; falls back to the manual
  // address field otherwise. `useMemo` keeps the (potentially throwing)
  // ethers.Wallet construction off the render path when the key is
  // incomplete or malformed.
  const derivedAddress = useMemo<string | null>(() => {
    const trimmed = newKey.trim();
    if (!isValidHexKey(trimmed)) return null;
    try {
      return new Wallet(trimmed).address;
    } catch {
      return null;
    }
  }, [newKey]);

  // Load on mount; the storage layer degrades to [] in non-browser envs.
  useEffect(() => {
    setUsers(loadUsers());
  }, []);

  function persist(next: DemoUser[]) {
    setUsers(next);
    saveUsers(next);
    // SPEC-0005 R12: signal App.tsx so the top-bar pill row reactively
    // re-syncs the ProfileRegistry against the new userStore list. The detail
    // payload is the freshly-saved list; App reloads from the storage layer
    // rather than trusting the event payload, so cross-tab signals (real
    // `storage` events fired by a sibling tab) flow through the same code
    // path uniformly.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(USERS_CHANGED_EVENT));
    }
  }

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const label = newLabel.trim();
    // SPEC-0005 R11: when a private key is pasted AND valid, the derived
    // address wins over whatever's in the manual field. The key itself is
    // discarded after derivation; per-user signer persistence is T75c.
    const rawKey = newKey.trim();
    if (rawKey.length > 0 && !isValidHexKey(rawKey))
      return setError("Private key must be 0x + 64 hex.");
    const address = derivedAddress ?? newAddress.trim();
    if (!label) return setError("Label is required.");
    if (!/^0x[0-9a-fA-F]{40}$/.test(address))
      return setError("Address must be 0x + 40 hex (or paste a private key).");
    if (!isDemoRole(newRole)) return setError("Role is invalid.");
    const id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `user-${Date.now()}`;
    persist(addUser(users, { id, label, role: newRole, address }));
    setNewLabel("");
    setNewAddress("");
    setNewKey("");
    setNewRole("provider");
  }

  function onRemove(id: string) {
    persist(removeUser(users, id));
  }

  return (
    <div className="settings-panel" data-testid="users-panel">
      <div className="section-label">Users</div>
      <p className="hint">
        Add as many users as you like; they are saved in <code>curie:users</code>{" "}
        in your browser. The built-in roles (provider / insurer / observer) stay
        available in the picker above; users you add here appear as additional
        profile pills in the top bar immediately — no page reload required. You can
        paste a 0x-prefixed 64-character private key and the address is derived
        automatically; the key itself is <strong>never</strong> saved — only the
        resulting address is stored.
      </p>
      <ul className="users-list" data-testid="users-list">
        {users.length === 0 && (
          <li className="users-empty">No saved users yet — add one below.</li>
        )}
        {users.map((u) => (
          <li key={u.id} className="users-row" data-testid={`users-row-${u.id}`}>
            <div className="users-row-meta">
              <strong>{u.label}</strong>
              <span className="badge mode">{u.role}</span>
              <code title={u.address}>{u.address.slice(0, 10)}…{u.address.slice(-4)}</code>
            </div>
            <button
              type="button"
              data-testid={`users-remove-${u.id}`}
              onClick={() => onRemove(u.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form className="users-add" onSubmit={onAdd} data-testid="users-add-form">
        <label>
          Label
          <input
            type="text"
            data-testid="users-add-label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Bob Insurer"
          />
        </label>
        <label>
          Role
          <select
            data-testid="users-add-role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as DemoRole)}
          >
            <option value="provider">provider</option>
            <option value="insurer">insurer</option>
            <option value="observer">observer</option>
          </select>
        </label>
        <label>
          Private key <span className="hint-inline">(optional — derives address)</span>
          <input
            type="text"
            data-testid="users-add-key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="0x… (64 hex) — not stored"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Address
          <input
            type="text"
            data-testid="users-add-address"
            value={derivedAddress ?? newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="0x… (40 hex)"
            readOnly={derivedAddress !== null}
            aria-readonly={derivedAddress !== null}
            title={
              derivedAddress !== null
                ? "Derived from the pasted private key — clear the key field to edit manually."
                : undefined
            }
          />
        </label>
        {error && <p className="error" data-testid="users-add-error">{error}</p>}
        <button type="submit" className="primary" data-testid="users-add-submit">
          Add user
        </button>
      </form>
    </div>
  );
}

/**
 * SPEC-0005 R13 — Demo-mode quick-switch.
 *
 * When ON, the top-bar pill row includes the legacy provider/insurer/
 * observer seeds. When OFF, only operator-added userStore entries appear.
 * Default ON in v0; the spec calls for OFF in v1 so the toggle is the
 * forward-compatible escape hatch.
 *
 * Reads + writes go through {@link loadDemoMode} / {@link saveDemoMode};
 * the save path fires `DEMO_MODE_CHANGED_EVENT` for same-tab listeners.
 * Cross-tab parity comes from the browser's native `storage` event, which
 * App.tsx also listens for.
 */
function DemoModePanel() {
  const [on, setOn] = useState<boolean>(true);
  useEffect(() => {
    setOn(loadDemoMode());
    function reread() {
      setOn(loadDemoMode());
    }
    function onStorage(e: StorageEvent) {
      if (e.key === DEMO_MODE_STORAGE_KEY || e.key === null) reread();
    }
    window.addEventListener(DEMO_MODE_CHANGED_EVENT, reread);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DEMO_MODE_CHANGED_EVENT, reread);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    saveDemoMode(next);
  }

  return (
    <div className="settings-panel" data-testid="demo-mode-panel">
      <div className="section-label">Demo mode</div>
      <p className="hint">
        When ON, the three built-in roles (Provider / Insurer / Observer) appear
        as top-bar pills for guided walkthroughs. When OFF, only the users you add
        above remain in the pill row.
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        data-testid="demo-mode-toggle"
        data-state={on ? "on" : "off"}
        className={`primary${on ? "" : " is-off"}`}
        onClick={toggle}
      >
        Demo mode: {on ? "ON" : "OFF"}
      </button>
    </div>
  );
}
