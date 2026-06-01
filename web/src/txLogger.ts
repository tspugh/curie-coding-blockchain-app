/**
 * SPEC-0003 §2.2 — Tx ledger sink.
 *
 * Bridges the `RealBackend.txEvents` `tx-confirmed` stream to:
 *   1. The dev-server JSONL sink (`POST /__log/tx`) — single source of truth.
 *   2. An in-memory React-subscribable store the UI's TxMonitor reads.
 *
 * Both are fire-and-forget so a failing POST never blocks a chain flow.
 * Per R7, nothing here writes to `console` on the happy path; permanent
 * POST failures bump a small dev-only counter exposed via the store so the
 * UI can surface "n logs dropped" if it ever happens.
 */
import { RealBackend, type TxConfirmedDetail } from "@lib";

export interface TxLogState {
  readonly entries: readonly TxConfirmedDetail[];
  readonly totalGasCostWei: bigint;
  readonly totalValueWei: bigint;
  readonly droppedPosts: number;
}

type Listener = (state: TxLogState) => void;

const LOG_ENDPOINT = "/__log/tx";

let state: TxLogState = {
  entries: [],
  totalGasCostWei: 0n,
  totalValueWei: 0n,
  droppedPosts: 0,
};
const listeners = new Set<Listener>();

function setState(next: TxLogState): void {
  state = next;
  for (const l of listeners) l(state);
}

function ingest(detail: TxConfirmedDetail): void {
  const gasCost = BigInt(detail.gasUsed) * BigInt(detail.gasPrice);
  setState({
    entries: [detail, ...state.entries].slice(0, 50),
    totalGasCostWei: state.totalGasCostWei + gasCost,
    totalValueWei: state.totalValueWei + BigInt(detail.value),
    droppedPosts: state.droppedPosts,
  });
}

async function postOnce(detail: TxConfirmedDetail): Promise<boolean> {
  try {
    const res = await fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // BigInt fields on `detail` are already strings, so JSON.stringify is safe.
      body: JSON.stringify(detail),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function dispatchToSink(detail: TxConfirmedDetail): Promise<void> {
  // One quick retry; if both fail, count it and move on. Per R11, never
  // block the UI or the chain flow on the sink.
  if (await postOnce(detail)) return;
  if (await postOnce(detail)) return;
  setState({ ...state, droppedPosts: state.droppedPosts + 1 });
}

/**
 * Subscribe a `RealBackend` so each confirmed tx flows to the UI store and
 * the dev-server JSONL sink. Idempotent — calling twice on the same backend
 * attaches one listener (we mark it via a WeakSet).
 */
const wired = new WeakSet<RealBackend>();
export function wireTxLogger(backend: unknown): void {
  if (!(backend instanceof RealBackend)) return;
  if (wired.has(backend)) return;
  wired.add(backend);
  backend.txEvents.addEventListener("tx-confirmed", (e) => {
    const detail = (e as CustomEvent<TxConfirmedDetail>).detail;
    if (!detail) return;
    ingest(detail);
    void dispatchToSink(detail);
  });
}

/** React-friendly subscription: returns the current snapshot, fires `cb` on change. */
export function subscribeTxLog(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getTxLogSnapshot(): TxLogState {
  return state;
}

/**
 * Hydrate the in-memory store from the dev-server JSONL sink so the
 * TxMonitor shows the full session-to-date right after a page reload.
 * Idempotent: only runs the first time, and skips if the store already
 * has entries (live ingests during the same session win). No-op outside
 * the dev server (the GET endpoint only exists there).
 */
let hydrated = false;
export async function hydrateTxLogFromSink(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  if (state.entries.length > 0) return;
  try {
    const res = await fetch("/__log/tx");
    if (!res.ok) return;
    const entries = (await res.json()) as TxConfirmedDetail[];
    for (const e of entries) ingest(e);
  } catch {
    // Sink unavailable (production preview, network error) — keep going.
  }
}
