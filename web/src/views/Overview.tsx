/**
 * Overview: live table of every coverage request with its current status.
 * Re-fetches on every event (R16). Each row opens the request detail view.
 */
import { useEffect, useState } from "react";
import { type CoverageEvent, type NegotiationView, State } from "@lib";
import { client } from "../client.js";
import { fmtAmount, shortHex } from "../shared.js";

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const count = await client.negotiation.count();
      const views: NegotiationView[] = [];
      for (let id = 1n; id <= count; id++) {
        views.push(await client.negotiation.getNegotiationView(id));
      }
      if (!cancelled) setRows(views);
    })();
    return () => { cancelled = true; };
  }, [events]);

  return (
    <section className="view overview">
      <div className="view-head">
        <h1>Coverage Requests</h1>
        <button type="button" className="primary" onClick={onCreate}>
          + New Request
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <p className="empty-icon">📋</p>
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
              <th>Policy</th>
              <th>Requested</th>
              <th>AI Covered</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr
                key={v.reqId.toString()}
                data-testid="contract-row"
                data-reqid={v.reqId.toString()}
                className="row-link"
                onClick={() => onOpen(v.reqId)}
              >
                <td>#{v.reqId.toString()}</td>
                <td>
                  <code title={v.negotiation.drugRef}>
                    {shortHex(v.negotiation.drugRef)}
                  </code>
                </td>
                <td>
                  <span
                    className={`badge state s-${v.state}`}
                    data-testid="state-badge"
                  >
                    {FRIENDLY_STATE[v.state]}
                  </span>
                </td>
                <td>{v.policyAttached ? "✓ Attached" : "—"}</td>
                <td>{fmtAmount(v.negotiation.requestedAmount)}</td>
                <td>
                  {v.negotiation.coveredAmount > 0n ? (
                    <strong>{fmtAmount(v.negotiation.coveredAmount)}</strong>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
