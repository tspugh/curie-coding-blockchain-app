/**
 * App shell: persistent header (wallet + mode + profile switcher + active party
 * — R12), a global event log accumulated from the live subscription + backfilled
 * via getEvents (R16), and state-driven view switching between Overview / Create
 * / Detail (R15). No router lib. Wording follows the AI necessity-arbiter
 * coverage-exception model (SPEC-0001, revised 2026-05-27).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { STATE_NAMES, type CoverageEvent, type Profile } from "@lib";
import { client } from "./client.js";
import { shortHex } from "./shared.js";
import { Overview } from "./views/Overview.js";
import { Create } from "./views/Create.js";
import { Detail } from "./views/Detail.js";

/** Which top-level screen is showing. */
type View =
  | { kind: "overview" }
  | { kind: "create" }
  | { kind: "detail"; reqId: bigint };

export function App() {
  const [view, setView] = useState<View>({ kind: "overview" });
  // All events ever seen, in chronological order. Views derive per-reqId
  // timelines and a re-render trigger from this single accumulating log.
  const [events, setEvents] = useState<readonly CoverageEvent[]>([]);
  // The active profile is mirrored into React state so switching re-renders.
  const [activeProfileId, setActiveProfileId] = useState<string>(
    client.profiles.getActiveProfile().id,
  );

  // Seed the timeline from history (eth_getLogs — R16/T10), then keep it live via
  // subscription. Historical events are deduped by tx hash so a real-backend event
  // that appears in both the backfill and the live stream isn't double-counted;
  // simulated events (no tx hash) only ever arrive live, so they pass through.
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
    // Backfill the historical timeline (prepended, chronological).
    void client.negotiation.getEvents().then((history) => add(history, true));
    return unsubscribe;
  }, []);

  const profiles = client.profiles.listProfiles();
  const activeProfile = useMemo<Profile>(
    () => client.profiles.getActiveProfile(),
    // activeProfileId is the dependency that makes this recompute on switch.
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
        <div className="brand">Curie — AI coverage-exception arbiter (MVP0)</div>

        <nav className="nav">
          <button
            type="button"
            data-testid="nav-overview"
            className={view.kind === "overview" ? "active" : ""}
            onClick={goOverview}
          >
            Overview
          </button>
          <button
            type="button"
            data-testid="nav-create"
            className={view.kind === "create" ? "active" : ""}
            onClick={goCreate}
          >
            File request
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
            <span className="label">Profile</span>
            <select
              data-testid="profile-switcher"
              value={activeProfile.id}
              onChange={(e) => onSwitchProfile(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} (party {p.partyId.toString()})
                </option>
              ))}
            </select>
            <span className="active-party">
              active party {activeProfile.partyId.toString()}
            </span>
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

      <footer className="footer">
        States: {Object.values(STATE_NAMES).join(" · ")}
      </footer>
    </div>
  );
}
