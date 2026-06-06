/**
 * App shell: header, global event log, view routing.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { type CoverageEvent, type Profile } from "@lib";
import {
  USERS_CHANGED_EVENT,
  client,
  setActiveClientProfile,
  syncProfilesFromUsers,
  walletSetupRequired,
} from "./client.js";
import { USERS_STORAGE_KEY, loadUsers } from "@lib";
import {
  DEMO_MODE_CHANGED_EVENT,
  DEMO_MODE_STORAGE_KEY,
  loadDemoMode,
} from "./demoMode.js";
import { KEY_STORAGE_PREFIX, hasUsableProviderKey, getDevPrefill } from "./walletKeys.js";

/** SPEC-0005 R13 — ids the demoMode toggle hides when OFF. */
const SEED_PROFILE_IDS: ReadonlySet<string> = new Set([
  "provider",
  "insurer",
  "observer",
]);
import { shortHex } from "./shared.js";
import { Overview } from "./views/Overview.js";
import { Create } from "./views/Create.js";
import { Detail } from "./views/Detail.js";
import { Network } from "./views/Network.js";
import { Settings } from "./views/Settings.js";
import { WalletBalance } from "./components/WalletBalance.js";
import { TxMonitor } from "./components/TxMonitor.js";
import { WalletOnboarding } from "./components/WalletOnboarding.js";

type View =
  | { kind: "overview" }
  | { kind: "create" }
  | { kind: "detail"; reqId: bigint }
  | { kind: "network" }
  | { kind: "settings" };

// ---------------------------------------------------------------------------
// SPEC-0008 — startup wallet gate constants (evaluated once at module load,
// before any React render).
// ---------------------------------------------------------------------------

/**
 * When true, the WalletOnboarding modal is forced even if env keys exist.
 * Set VITE_FORCE_WALLET_PROMPT=1 to test the onboarding flow against env keys.
 *
 * SECURITY (SPEC-0008 §6): we deliberately do NOT access
 * `import.meta.env.VITE_PRIVATE_KEY` or `import.meta.env.VITE_PRIVATE_KEY_INSURER`
 * at the module level in App.tsx — Vite statically inlines named
 * `import.meta.env.VITE_*` accesses into the bundle as string literals at
 * build time, which would bake testnet private keys into the shipped JS.
 * Instead, the pre-fill values for the force-prompt path are read lazily
 * inside the App component via `getDevPrefill` from `walletKeys.ts`, which
 * uses dynamic bracket access (`import.meta.env[name]`) and therefore does NOT
 * cause Vite to inline a specific key value. In the public deploy build,
 * `VITE_PRIVATE_KEY=""` so `getDevPrefill` returns `""` (R7 satisfied).
 * In a local dev build with a populated `.env`, the modal opens pre-filled.
 */
const forcePrompt = import.meta.env.VITE_FORCE_WALLET_PROMPT === "1";

export function App() {
  // SPEC-0008 R1/R5/R6 — gate: show the onboarding modal when no usable
  // provider key is loaded, or when forcePrompt forces it for testing.
  const [needsWallet] = useState<boolean>(
    () => !hasUsableProviderKey(),
  );

  const showModal = needsWallet || forcePrompt;

  // SPEC-0008 R6 (amended) — pre-fill the modal from env when forcePrompt=true,
  // or from localStorage when the user has previously loaded keys.
  //
  // When forcePrompt=true: getDevPrefill reads VITE_PRIVATE_KEY[_INSURER] from
  // import.meta.env via walletKeys.ts (dynamic bracket access — not a direct
  // import.meta.env.VITE_PRIVATE_KEY reference in App.tsx, which would trigger
  // a named-property inline by Vite and violate §6). In the public deploy build,
  // VITE_PRIVATE_KEY="" so getDevPrefill returns "", giving an empty modal.
  // In a local dev build with a populated .env, the modal opens pre-filled.
  //
  // When forcePrompt=false: read from localStorage (keys already loaded by the
  // user in a prior session, or set via Settings).
  const envKeyForPrefill_VITE_PRIVATE_KEY = getDevPrefill("VITE_PRIVATE_KEY");
  const envKeyForPrefill_VITE_PRIVATE_KEY_INSURER = getDevPrefill("VITE_PRIVATE_KEY_INSURER");
  const prefillProvider = forcePrompt
    ? envKeyForPrefill_VITE_PRIVATE_KEY
    : (() => {
        try { return window.localStorage.getItem(KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY") ?? ""; }
        catch { return ""; }
      })();
  const prefillInsurer = forcePrompt
    ? envKeyForPrefill_VITE_PRIVATE_KEY_INSURER
    : (() => {
        try { return window.localStorage.getItem(KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY_INSURER") ?? ""; }
        catch { return ""; }
      })();

  const handleWalletLoaded = useCallback(() => {
    // Keys have been written to localStorage; reload the page so client.ts
    // re-reads keyOverride() with the new values and signs for real.
    window.location.reload();
  }, []);

  const [view, setView] = useState<View>({ kind: "overview" });
  const [events, setEvents] = useState<readonly CoverageEvent[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>(
    client.profiles.getActiveProfile().id,
  );
  // SPEC-0005 R12: bumped on every userStore change so `client.profiles.
  // listProfiles()` is re-read and the pill row re-renders. Value is opaque;
  // only the identity-change is observed by React.
  const [profilesEpoch, setProfilesEpoch] = useState(0);
  // SPEC-0005 R13: gates whether the legacy three-profile seeds appear in
  // the top-bar pill row. Defaults ON in v0; OFF in v1 per spec.
  const [demoMode, setDemoMode] = useState<boolean>(() => loadDemoMode());

  useEffect(() => {
    const seen = new Set<string>();
    const keyOf = (e: CoverageEvent): string | null =>
      e.txHash ? `${e.txHash}:${e.name}:${e.reqId.toString()}` : null;
    const add = (incoming: readonly CoverageEvent[]): void => {
      setEvents((prev) => {
        const fresh = incoming.filter((e) => {
          const k = keyOf(e);
          if (k === null) return true;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (fresh.length === 0) return prev;
        // Keep the merged log chronological by block. getEvents now streams
        // batches NEWEST-first (so recent activity paints first), and live
        // subscribe events arrive out of band — a stable sort by blockNumber
        // restores chronological order so Detail's `lastRuled`/`settled`
        // (which take the newest entry via reverse()) stay correct. Simulated
        // events carry no blockNumber → all compare equal → insertion order
        // preserved (the stable in-memory log order).
        const merged = [...prev, ...fresh];
        merged.sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0));
        return merged;
      });
    };
    const unsubscribe = client.negotiation.subscribe((e) => add([e]));
    // Progressive hydration: each newest-first page-batch paints as it lands,
    // so the most recent events show within ~1s instead of after the full
    // ~25s historical sweep over ~900 getLogs pages.
    void client.negotiation.getEvents({}, (batch) => add(batch));
    return unsubscribe;
  }, []);

  // SPEC-0005 R12 — listen for userStore changes (same-tab CustomEvent fired
  // by Settings, and the browser's native cross-tab `storage` event), reload
  // the persisted users, and reconcile the registry. When sync removes the
  // currently-active profile we fall back to "provider" and update React
  // state to match.
  useEffect(() => {
    function reconcile() {
      const outcome = syncProfilesFromUsers(loadUsers());
      if (outcome.activeWasRemoved) {
        setActiveProfileId("provider");
      }
      if (outcome.added.length || outcome.removed.length) {
        setProfilesEpoch((n) => n + 1);
      }
    }
    function onStorage(e: StorageEvent) {
      if (e.key === USERS_STORAGE_KEY || e.key === null) reconcile();
    }
    window.addEventListener(USERS_CHANGED_EVENT, reconcile);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(USERS_CHANGED_EVENT, reconcile);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // SPEC-0005 R13 — listen for demo-mode flips (same-tab CustomEvent + the
  // browser's native cross-tab `storage` event) and re-read state.
  useEffect(() => {
    function reread() {
      setDemoMode(loadDemoMode());
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

  // `profilesEpoch` is intentionally referenced so React re-renders the pill
  // row after a sync mutates the registry in place.
  void profilesEpoch;
  // SPEC-0005 R13: when demoMode is OFF, hide the legacy seeds from the
  // pill row. The registry still holds them (Settings cards remain the
  // full escape-hatch for switching) — they just don't appear up top.
  const profiles = useMemo<readonly Profile[]>(
    () => {
      const all = client.profiles.listProfiles();
      return demoMode ? all : all.filter((p) => !SEED_PROFILE_IDS.has(p.id));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demoMode, profilesEpoch],
  );
  const activeProfile = useMemo<Profile>(
    () => client.profiles.getActiveProfile(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProfileId, profilesEpoch],
  );

  const onSwitchProfile = useCallback((id: string) => {
    // Two-wallet model (UNIT-7a): flip the signing key to match the role
    // BEFORE the registry update, so any tx fired from this render cycle
    // uses the right signer.
    setActiveClientProfile(id);
    client.profiles.setActiveProfile(id);
    setActiveProfileId(id);
    // SPEC-0005 R8: switching role returns to Overview. The Detail view's
    // gating + content depend on which party you are; landing on Overview
    // forces a fresh re-pick rather than implicitly carrying a stale Detail
    // page across an identity change.
    setView({ kind: "overview" });
  }, []);

  const goOverview = useCallback(() => setView({ kind: "overview" }), []);
  const goCreate = useCallback(() => setView({ kind: "create" }), []);
  const goNetwork = useCallback(() => setView({ kind: "network" }), []);
  const goSettings = useCallback(() => setView({ kind: "settings" }), []);
  const goDetail = useCallback(
    (reqId: bigint) => setView({ kind: "detail", reqId }),
    [],
  );

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          Curie
          <span className="brand-sub">AI Drug Coverage Arbiter</span>
        </div>

        <nav className="nav">
          <button
            type="button"
            data-testid="nav-overview"
            className={view.kind === "overview" ? "active" : ""}
            onClick={goOverview}
          >
            Dashboard
          </button>
          <button
            type="button"
            data-testid="nav-create"
            className={view.kind === "create" ? "active" : ""}
            onClick={goCreate}
          >
            New Request
          </button>
          <button
            type="button"
            data-testid="nav-network"
            className={view.kind === "network" ? "active" : ""}
            onClick={goNetwork}
          >
            Network
          </button>
          <button
            type="button"
            data-testid="nav-settings"
            className={view.kind === "settings" ? "active" : ""}
            onClick={goSettings}
          >
            Settings
          </button>
        </nav>

        <div className="wallet">
          <span className="wallet-line">
            <span className="label">Wallet</span>
            <span className="wallet-line-content">
              <code data-testid="wallet-address" title={client.wallet.address}>
                {shortHex(client.wallet.address)}
              </code>
              <span className="badge mode" data-testid="wallet-mode">
                {client.wallet.mode}
              </span>
            </span>
          </span>
          <span className="wallet-line">
            <WalletBalance />
          </span>
          <span className="wallet-line">
            <span className="label">Role</span>
            <span className="wallet-line-content">
              <div
                className="profile-switcher"
                data-testid="profile-switcher"
                role="radiogroup"
                aria-label="Active profile"
              >
                {profiles.map((p) => {
                  const on = activeProfile.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={`profile-pill${on ? " is-active" : ""}`}
                      data-testid={`profile-pill-${p.id}`}
                      onClick={() => onSwitchProfile(p.id)}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </span>
          </span>
        </div>
      </header>

      <main className="main">
        {walletSetupRequired && (
          <div className="setup-banner" role="alert">
            <strong>Wallet configuration required.</strong>{" "}
            Real mode is selected but no private key was found in <code>.env</code> or{" "}
            <code>localStorage</code>. The app is running in <em>simulated</em> mode —
            on-chain writes will not work until you paste a key.{" "}
            <button
              type="button"
              className="link-button"
              onClick={goSettings}
            >
              Open Settings → Wallet keys
            </button>
          </div>
        )}
        {view.kind === "overview" && (
          <Overview events={events} onOpen={goDetail} onCreate={goCreate} />
        )}
        {view.kind === "create" && (
          <Create
            activeProfile={activeProfile}
            onCreated={goDetail}
            onCancel={goOverview}
          />
        )}
        {view.kind === "detail" && (
          <Detail
            reqId={view.reqId}
            activeProfile={activeProfile}
            events={events}
            onBack={goOverview}
          />
        )}
        {view.kind === "network" && (
          <Network events={events} onBack={goOverview} />
        )}
        {view.kind === "settings" && (
          <Settings
            activeProfileId={activeProfileId}
            onProfileChange={onSwitchProfile}
            onBack={goOverview}
          />
        )}
      </main>

      <TxMonitor />

      {/* SPEC-0008 R1/R6 (amended) — startup wallet gate: blocking modal + backdrop.
          forcePrompt (VITE_FORCE_WALLET_PROMPT=1) shows the modal even when env
          keys are present; prefillProvider/prefillInsurer come from env (via
          getDevPrefill in walletKeys.ts) when forcePrompt=true, or from
          localStorage when forcePrompt=false (user has already loaded keys). */}
      {showModal && (
        <WalletOnboarding
          onLoaded={handleWalletLoaded}
          prefillProvider={prefillProvider}
          prefillInsurer={prefillInsurer}
        />
      )}
    </div>
  );
}
