/**
 * Overview: live table of every coverage request with its current status.
 * Re-fetches on every event (R16). Each row opens the request detail view.
 */
import { useEffect, useMemo, useState } from "react";
import { type CoverageEvent, type NegotiationView, Decision, PayerLine, State, stageNameFor } from "@lib";
import { client } from "../client.js";
import { fmtAmount, shortHex } from "../shared.js";
import { drugNameForRef } from "../drugNames.js";

// ---------------------------------------------------------------------------
// KPI card — local component, not exported (UNIT-UI-1)
// ---------------------------------------------------------------------------

type KpiTone = "review" | "approved" | "accent" | undefined;

interface KpiCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly sub: string;
  readonly tone?: KpiTone;
}

function KpiCard({ label, value, sub, tone }: KpiCardProps) {
  const valueClass = tone ? `kpi-value tone-${tone}` : "kpi-value";
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={valueClass}>{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter pill bar — UNIT-UI-2
// ---------------------------------------------------------------------------

type FilterKey = "all" | "open" | "active" | "settled" | "closed";

// Predicates are hand-listed per state, mirroring the prototype's `fmap`
// (`docs/reference/ui-prototype-handoff/project/screens.jsx:47-53`). Every
// row falls in exactly one of {Open, In negotiation, Settled, Closed}, so
// the pill counts sum to rows.length — no double-counting. Denied lands in
// Closed (not In negotiation) to match the prototype's narrative grouping,
// even though Denied is non-terminal in `coverage.types.ts`.
const ACTIVE_STATES = new Set<State>([
  State.Ready,
  State.UnderReview,
  State.EvidenceRequested,
  State.Approved,
]);
const CLOSED_STATES = new Set<State>([
  State.Denied,
  State.Deadlocked,
  State.Withdrawn,
  State.PolicyInvalidated,
  State.ProviderRefused,
]);

const filters: Record<FilterKey, (r: NegotiationView) => boolean> = {
  all:     () => true,
  open:    r => r.state === State.Open,
  active:  r => ACTIVE_STATES.has(r.state),
  settled: r => r.state === State.Settled,
  closed:  r => CLOSED_STATES.has(r.state),
};

// Display name for a payer line — the typed enum's symbolic name reads "PartD"
// but the prototype renders it with a space ("Part D"); the other two are
// already display-ready.
function payerLineDisplay(line: PayerLine): string {
  switch (line) {
    case PayerLine.PartD: return "Part D";
    case PayerLine.Commercial: return "Commercial";
    case PayerLine.Medicaid: return "Medicaid";
  }
}

const filterLabels: Record<FilterKey, string> = {
  all:     "All",
  open:    "Open",
  active:  "In negotiation",
  settled: "Settled",
  closed:  "Closed",
};

interface OverviewProps {
  readonly events: readonly CoverageEvent[];
  readonly onOpen: (reqId: bigint) => void;
  readonly onCreate: () => void;
}

const FRIENDLY_STATE: Record<State, string> = {
  [State.Open]: "Awaiting Insurer",
  [State.Ready]: "Ready for AI",
  [State.UnderReview]: "AI Reviewing…",
  [State.EvidenceRequested]: "More Info Needed",
  [State.Approved]: "Approved",
  [State.Denied]: "Denied",
  [State.Settled]: "Settled",
  [State.Deadlocked]: "Deadlocked",
  [State.PolicyInvalidated]: "Policy Voided",
  [State.ProviderRefused]: "Refused",
  [State.Withdrawn]: "Withdrawn",
};

export function Overview({ events, onOpen, onCreate }: OverviewProps) {
  const [rows, setRows] = useState<readonly NegotiationView[]>([]);
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const filteredRows = useMemo(() => rows.filter(filters[filterKey]), [rows, filterKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const count = await client.negotiation.count();
      // Newest-first: render the most recently created negotiation at the TOP
      // of the table (reqId is monotonic, so descending reqId == most-recent
      // first). Build the id list high→low, then fetch views in bounded-parallel
      // batches instead of one-await-per-id. Each getNegotiationView is its own
      // RPC round-trip (~300ms on Somnia), so a sequential loop cost count×RTT;
      // batching collapses that to ceil(count / VIEW_CONCURRENCY) round-trips
      // and fills the table top-down as each batch lands (progressive paint).
      const ids: bigint[] = [];
      for (let id = count; id >= 1n; id--) ids.push(id);
      const VIEW_CONCURRENCY = 12;
      const acc: NegotiationView[] = [];
      for (let i = 0; i < ids.length; i += VIEW_CONCURRENCY) {
        const views = await Promise.all(
          ids.slice(i, i + VIEW_CONCURRENCY).map((id) =>
            client.negotiation.getNegotiationView(id),
          ),
        );
        if (cancelled) return;
        acc.push(...views);
        setRows([...acc]);
      }
    })();
    return () => { cancelled = true; };
  }, [events]);

  // ---------------------------------------------------------------------------
  // KPI derivation — real data only, no mocks (UNIT-UI-1)
  // r.terminal          → NegotiationView.terminal (boolean)
  // r.state             → NegotiationView.state (State enum)
  // r.negotiation.*     → nested Negotiation record
  // ---------------------------------------------------------------------------
  const counts = rows.reduce(
    (a, r) => {
      a.total++;
      if (!r.terminal) a.active++;
      if (r.state === State.Settled) a.settled++;
      if (r.negotiation.hasRuling && r.negotiation.lastDecision === Decision.Approve) {
        a.approved++;
      }
      return a;
    },
    { total: 0, active: 0, settled: 0, approved: 0 },
  );

  return (
    <section className="view overview">
      <div className="view-head">
        <h1>Coverage Requests</h1>
        <button type="button" className="primary" onClick={onCreate}>
          + New Request
        </button>
      </div>

      {/* How-it-works strip: keep the payer↔provider↔LLM story visible even with data on screen */}
      <p className="how-it-works">
        <strong>How it works:</strong> a provider files a drug-coverage request → an
        autonomous LLM agent reads the cited clinical evidence and rules on medical
        necessity → provider &amp; payer accept or appeal → funds settle on-chain.
      </p>

      {/* KPI strip — UNIT-UI-1 */}
      <div className="kpi-strip">
        <KpiCard label="Total requests" value={counts.total} sub="across all profiles" />
        <KpiCard label="In negotiation" value={counts.active} sub="before a terminal state" tone="review" />
        <KpiCard label="Approved" value={counts.approved} sub="AI approved coverage" tone="accent" />
        <KpiCard label="Settled" value={counts.settled} sub="both parties accepted" tone="approved" />
      </div>

      {/* Filter pill bar — UNIT-UI-2 */}
      <div className="filter-pill-bar">
        {(Object.keys(filters) as FilterKey[]).map((k) => {
          const count = rows.filter(filters[k]).length;
          return (
            <button
              key={k}
              type="button"
              className={`filter-pill${filterKey === k ? " is-active" : ""}`}
              onClick={() => setFilterKey(k)}
            >
              {filterLabels[k]} <span className="filter-pill-count">{count}</span>
            </button>
          );
        })}
        <div className="filter-pill-spacer" />
        <span className="filter-pill-summary">{filteredRows.length} of {rows.length}</span>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <p className="empty-icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="4" width="14" height="17" rx="2" />
              <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
              <path d="M9 10h6M9 14h6M9 18h3" />
            </svg>
          </p>
          <p>No requests yet.</p>
          <p className="hint">Click <strong>+ New Request</strong> to file a drug coverage request and watch the AI arbitrate it in real time.</p>
          <button type="button" className="primary" onClick={onCreate}>
            Get Started →
          </button>
        </div>
      ) : (
        <table className="contracts">
          <thead>
            <tr>
              <th>#</th>
              <th>Medication</th>
              <th>Status</th>
              <th>Appeal stage</th>
              <th>Policy</th>
              <th>Requested</th>
              <th className="col-round">Round</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((v) => (
              <tr
                key={v.reqId.toString()}
                data-testid="contract-row"
                data-reqid={v.reqId.toString()}
                className="row-link"
                onClick={() => onOpen(v.reqId)}
              >
                <td>#{v.reqId.toString()}</td>
                <td title={v.negotiation.drugRef}>
                  {drugNameForRef(v.negotiation.drugRef) ?? (
                    <code>{shortHex(v.negotiation.drugRef)}</code>
                  )}
                </td>
                <td>
                  <span
                    className={`badge state s-${v.state}`}
                    data-testid="state-badge"
                  >
                    {FRIENDLY_STATE[v.state]}
                  </span>
                </td>
                <td className="col-stage">
                  <div className="stage-name">
                    {stageNameFor(v.negotiation.payerLine, v.negotiation.appealRound)}
                  </div>
                  <div className="stage-payer">
                    {payerLineDisplay(v.negotiation.payerLine)}
                  </div>
                </td>
                <td>{v.policyAttached ? "✓ Attached" : "—"}</td>
                <td>{fmtAmount(v.negotiation.requestedAmount)}</td>
                <td className="col-round">{v.negotiation.appealRound}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
