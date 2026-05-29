/**
 * App shell: header, global event log, view routing.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { type CoverageEvent, type Profile } from "@lib";
import { client } from "./client.js";
import { shortHex } from "./shared.js";
import { Overview } from "./views/Overview.js";
import { Create } from "./views/Create.js";
import { Detail } from "./views/Detail.js";
import { WalletBalance } from "./components/WalletBalance.js";
import { TxMonitor } from "./components/TxMonitor.js";

type View =
  | { kind: "overview" }
  | { kind: "create" }
  | { kind: "detail"; reqId: bigint };

export function App() {
  const [view, setView] = useState<View>({ kind: "overview" });
  const [events, setEvents] = useState<readonly CoverageEvent[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>(
    client.profiles.getActiveProfile().id,
  );

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

  const profiles = client.profiles.listProfiles();
  const activeProfile = useMemo<Profile>(
    () => client.profiles.getActiveProfile(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProfileId],
  );

  const onSwitchProfile = useCallback((id: string) => {
    client.profiles.setActiveProfile(id);
    setActiveProfileId(id);
  }, []);

  const goOverview = useCallback(() => setView({ kind: "overview" }), []);
  const goCreate = useCallback(() => setView({ kind: "create" }), []);
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
        </nav>

        <div className="wallet">
          <span className="wallet-line">
            <span className="label">Wallet</span>
            <code data-testid="wallet-address" title={client.wallet.address}>
              {shortHex(client.wallet.address)}
            </code>
            <span className="badge mode" data-testid="wallet-mode">
              {client.wallet.mode}
            </span>
          </span>
          <span className="wallet-line">
            <WalletBalance />
          </span>
          <span className="wallet-line">
            <span className="label">Role</span>
            <select
              data-testid="profile-switcher"
              value={activeProfile.id}
              onChange={(e) => onSwitchProfile(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </span>
        </div>
      </header>

      <main className="main">
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
      </main>

      <TxMonitor />
    </div>
  );
}
