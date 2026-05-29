/**
 * SPEC-0003 §2.1 R3 + §2.2 R8 — Per-tx realized cost monitor.
 *
 * Floating, collapsible panel that subscribes to the `txLogger` store.
 * Shows cumulative gas burn + value sent for the session, plus the last
 * five confirmed txs (method, hash, gas cost, value, attribution chip).
 * Empty in simulated mode (no entries flow in). Cumulative numbers persist
 * to the dev-server JSONL across reloads — this view is just the live one.
 */
import { useEffect, useState } from "react";
import {
  getTxLogSnapshot,
  subscribeTxLog,
  type TxLogState,
} from "../txLogger.js";
import { shortHex } from "../shared.js";

const WEI_PER_STT = 10n ** 18n;

function formatStt(wei: bigint, dp = 6): string {
  const whole = wei / WEI_PER_STT;
  const frac = wei % WEI_PER_STT;
  const pad = 18 - dp;
  const fracStr = (frac / 10n ** BigInt(pad)).toString().padStart(dp, "0");
  return `${whole.toString()}.${fracStr}`;
}

/**
 * SPEC-0003 §2.1 R4. Map contract method → attribution label.
 * Methods carrying `value > 0` are the agent-fee escrow; the rest are
 * gas-only state transitions on the contract.
 */
function attribute(method: string, valueWei: bigint): string {
  if (valueWei > 0n) return "Outbound to agent (fee escrow)";
  return "Burned (gas)";
}

export function TxMonitor(): JSX.Element | null {
  const [snap, setSnap] = useState<TxLogState>(() => getTxLogSnapshot());
  const [open, setOpen] = useState(true);

  useEffect(() => subscribeTxLog(setSnap), []);

  if (snap.entries.length === 0) {
    // Nothing to show yet — keep the chip visible so the human knows the
    // monitor is active and waiting on the first confirmed tx.
    return (
      <aside className="tx-monitor empty" data-testid="tx-monitor">
        <header onClick={() => setOpen((o) => !o)}>
          <span>Tx monitor</span>
          <span className="muted">waiting for first confirmed tx</span>
        </header>
      </aside>
    );
  }

  return (
    <aside className={`tx-monitor ${open ? "open" : "closed"}`} data-testid="tx-monitor">
      <header onClick={() => setOpen((o) => !o)}>
        <span>Tx monitor</span>
        <span className="totals">
          <span data-testid="tx-monitor-total-gas">
            gas {formatStt(snap.totalGasCostWei)} STT
          </span>
          <span data-testid="tx-monitor-total-value">
            value {formatStt(snap.totalValueWei, 4)} STT
          </span>
          <span className="count" data-testid="tx-monitor-count">
            {snap.entries.length} tx
          </span>
        </span>
        {snap.droppedPosts > 0 && (
          <span className="dropped" title="Dev-server log POSTs that failed">
            {snap.droppedPosts} dropped
          </span>
        )}
      </header>
      {open && (
        <ol className="tx-list">
          {snap.entries.slice(0, 5).map((e) => {
            const gasCost = BigInt(e.gasUsed) * BigInt(e.gasPrice);
            const valueWei = BigInt(e.value);
            return (
              <li key={e.hash} data-testid={`tx-row-${e.hash}`}>
                <span className="method">{e.method}</span>
                <code className="hash">{shortHex(e.hash, 6, 4)}</code>
                <span className="cost">
                  gas {formatStt(gasCost)} STT
                  {valueWei > 0n && <> · value {formatStt(valueWei, 4)} STT</>}
                </span>
                <span className="attribution">{attribute(e.method, valueWei)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
