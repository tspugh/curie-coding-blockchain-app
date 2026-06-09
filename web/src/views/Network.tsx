/**
 * Network view: 4-stat panel showing live on-chain state + live tx-stream
 * section.
 *
 * NO fake events. NO setInterval generating events. NO Math.random.
 * All values are sourced from real on-chain data or real config (see inline
 * comments). Fake data from the prototype ("12,847,201", "agent-7B") is
 * deliberately omitted per the design-handoff spec.
 *
 * The tx-stream section renders the `events` prop (populated by
 * subscribeTxLog in App.tsx) newest-first, capped at 50 rows.
 * The only animation is a pure CSS @keyframes pulse on the live-dot — no JS
 * callback involved.
 */
import { useEffect, useMemo, useState } from "react";
import { type CoverageEvent, type NegotiationView, State, txUrl, SOMNIA_TESTNET } from "@lib";
import { client } from "../client.js";
import { describeEvent, eventTone, shortHex } from "../shared.js";

// ---------------------------------------------------------------------------
// Block-number polling helper — mirrors WalletBalance/useWalletBalance pattern.
// Polls every 10 s; returns null while loading or when no provider (simulated).
// ---------------------------------------------------------------------------

const BLOCK_POLL_MS = 10_000;

function getProvider(): { getBlockNumber(): Promise<number> } | null {
  const w = client.wallet as { provider?: { getBlockNumber(): Promise<number> } | null };
  return w.provider ?? null;
}

function useLatestBlock(): number | null {
  const [block, setBlock] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const provider = getProvider();
    if (!provider) return;

    const refresh = async (): Promise<void> => {
      try {
        const n = await provider.getBlockNumber();
        if (!cancelled) setBlock(n);
      } catch {
        // Non-fatal — keep last known value; do not surface console noise.
      }
    };

    void refresh();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, BLOCK_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return block;
}

// ---------------------------------------------------------------------------
// Contract-address resolution.
//
// In real mode the address comes from VITE_CONTRACT_ADDRESS (the same env var
// passed to RealBackend at construction). In simulated mode there is no
// deployed contract; we display "—" rather than a fake or hardcoded value.
// ---------------------------------------------------------------------------

function resolveContractAddress(): string {
  if (client.wallet.mode === "real") {
    const addr = import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined;
    if (addr && addr.length >= 10) return shortHex(addr);
  }
  return "—";
}

// ---------------------------------------------------------------------------
// Active-rulings count — rows in State.UnderReview.
// Fetched on every events change exactly as Overview.tsx does.
// ---------------------------------------------------------------------------

function useActiveRulings(events: readonly CoverageEvent[]): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const total = await client.negotiation.count();
      const rows: NegotiationView[] = [];
      for (let id = 1n; id <= total; id++) {
        rows.push(await client.negotiation.getNegotiationView(id));
      }
      if (!cancelled) {
        setCount(rows.filter((r) => r.state === State.UnderReview).length);
      }
    })();
    return () => { cancelled = true; };
  }, [events]);

  return count;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

interface NetworkProps {
  readonly events: readonly CoverageEvent[];
  readonly onBack: () => void;
}

export function Network({ events, onBack }: NetworkProps) {
  const latestBlock = useLatestBlock();
  const activeRulings = useActiveRulings(events);
  const contractAddr = resolveContractAddress();
  const hasProvider = getProvider() !== null;

  // Newest-first, bounded. Memoized so the spread+reverse+slice doesn't run
  // every render — only when `events` changes.
  const streamRows = useMemo(
    () => [...events].reverse().slice(0, 50),
    [events],
  );

  const stats = [
    {
      label: "Latest block",
      // Source: provider.getBlockNumber() polled every 10 s; null → "—" while loading.
      value: latestBlock !== null ? latestBlock.toLocaleString() : "—",
      sub: hasProvider ? "Somnia Shannon testnet" : "simulated mode — no chain",
      mono: false,
    },
    {
      label: "Active rulings",
      // Source: count of NegotiationView rows where state === State.UnderReview,
      // re-fetched on every CoverageEvent (same pattern as Overview KPI strip).
      value: activeRulings,
      sub: "agent currently adjudicating",
      mono: false,
    },
    {
      label: "Curie contract",
      // Source: import.meta.env.VITE_CONTRACT_ADDRESS (real mode) or "—" (simulated).
      // shortHex'd for compact display; never hardcoded.
      value: contractAddr,
      sub: "CoverageNegotiation v0",
      mono: true,
    },
  ] as const;

  return (
    <section className="view network-page">
      <div className="view-head">
        <h1>Network</h1>
        <button type="button" onClick={onBack}>
          ← Back
        </button>
      </div>

      <div className="kpi-strip">
        {stats.map((s) => (
          <div key={s.label} className="kpi-card">
            <div className="kpi-label">{s.label}</div>
            <div
              className="kpi-value"
              style={
                s.mono
                  ? { fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace", fontSize: 17, fontWeight: 500 }
                  : undefined
              }
            >
              {s.value}
            </div>
            <div className="kpi-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Live tx-stream section ── */}
      {/* Events flow exclusively from the `events` prop (subscribeTxLog in App.tsx).
          No setInterval, no Math.random, no fake event injection. */}
      <section className="tx-stream-panel">
        <div className="tx-stream-header">
          <div>
            <div className="section-label">Live tx stream</div>
            <div className="tx-stream-title">CoverageNegotiation events</div>
          </div>
          <span className="pill live-pill">
            <span className="live-dot" /> streaming
          </span>
        </div>

        {events.length === 0 ? (
          <div className="tx-stream-empty">
            <p>No on-chain events yet.</p>
            <p className="hint">
              Events will appear here as wallet transactions are confirmed.
            </p>
          </div>
        ) : (
          <div className="tx-stream-rows">
            {streamRows.map((e) => (
              <div
                key={`${e.txHash ?? "noTx"}-${e.name}-${e.reqId.toString()}`}
                className="tx-stream-row"
              >
                <span className={`tx-ev-name tone-${eventTone(e.name)}`}>{e.name}</span>
                <span className="tx-ev-tx">
                  {e.txHash ? (
                    <a href={txUrl(SOMNIA_TESTNET, e.txHash)} target="_blank" rel="noreferrer">
                      {shortHex(e.txHash)}
                    </a>
                  ) : (
                    <span className="dim">—</span>
                  )}
                </span>
                <span className="tx-ev-desc">{describeEvent(e)}</span>
                <span className="tx-ev-reqid">req #{e.reqId.toString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
