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
import { shortHex } from "./shared.js";
import { Overview } from "./views/Overview.js";
import { Create } from "./views/Create.js";
import { Detail } from "./views/Detail.js";
import { Network } from "./views/Network.js";
import { Settings } from "./views/Settings.js";
import { WalletBalance } from "./components/WalletBalance.js";
import { TxMonitor } from "./components/TxMonitor.js";

type View =
  | { kind: "overview" }
  | { kind: "create" }
  | { kind: "detail"; reqId: bigint }
  | { kind: "network" }
  | { kind: "settings" };

export function App() {
  const [view, setView] = useState<View>({ kind: "overview" });
  const [events, setEvents] = useState<readonly CoverageEvent[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>(
    client.profiles.getActiveProfile().id,
  );
  // SPEC-0005 R12: bumped on every userStore change so `client.profiles.
  // listProfiles()` is re-read and the pill row re-renders. Value is opaque;
  // only the identity-change is observed by React.
  const [profilesEpoch, setProfilesEpoch] = useState(0);

  useEffect(() => {
    const seen = new Set<string>();
    const keyOf = (e: CoverageEvent): string | null =>
      e.txHash ? `${e.txHash}:${e.name}:${e.reqId.toString()}` : null;
    const add = (incoming: readonly CoverageEvent[], front: boolean): void => {
      setEvents((prev) => {
        const fresh = incoming.filter((e) => {
          const k = keyOf(e);
          if (k === null) return true;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (fresh.length === 0) return prev;
        return front ? [...fresh, ...prev] : [...prev, ...fresh];
      });
    };
    const unsubscribe = client.negotiation.subscribe((e) => add([e], false));
    void client.negotiation.getEvents().then((history) => add(history, true));
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

  // `profilesEpoch` is intentionally referenced so React re-renders the pill
  // row after a sync mutates the registry in place.
  void profilesEpoch;
  const profiles = client.profiles.listProfiles();
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
    </div>
  );
}
