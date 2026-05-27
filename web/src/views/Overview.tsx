/**
 * Overview (R15/R16): a live table of every coverage-exception request
 * (reqId 1..count()) with its state, whether the insurer has attached a policy,
 * the requested amount, the deterministic covered amount, and the adjudication
 * round. Re-fetches whenever a new event arrives (passed down from the App's
 * subscription — R16). Each row opens the request's Detail view.
 */
import { useEffect, useState } from "react";
import {
  STATE_NAMES,
  type CoverageEvent,
  type NegotiationView,
} from "@lib";
import { client } from "../client.js";
import { fmtAmount, shortHex } from "../shared.js";

interface OverviewProps {
  /** Global event log; a change here triggers a re-fetch (live status). */
  readonly events: readonly CoverageEvent[];
  readonly onOpen: (reqId: bigint) => void;
  readonly onCreate: () => void;
}

export function Overview({ events, onOpen, onCreate }: OverviewProps) {
  const [rows, setRows] = useState<readonly NegotiationView[]>([]);

  // Reload the whole table on mount and on every event. The simulated backend
  // is in-memory so this is cheap; it keeps the table in lockstep with truth.
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
    return () => {
      cancelled = true;
    };
  }, [events]);

  return (
    <section className="view overview">
      <div className="view-head">
        <h1>Coverage-exception requests</h1>
        <button type="button" className="primary" onClick={onCreate}>
          File request
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="empty">
          No requests yet. File one to start the arbitration flow.
        </p>
      ) : (
        <table className="contracts">
          <thead>
            <tr>
              <th>reqId</th>
              <th>drugRef</th>
              <th>state</th>
              <th>policy attached?</th>
              <th>requested</th>
              <th>covered</th>
              <th>round</th>
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
                <td>{v.reqId.toString()}</td>
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
                    {STATE_NAMES[v.state]}
                  </span>
                </td>
                <td>{v.policyAttached ? "yes" : "no"}</td>
                <td>{fmtAmount(v.negotiation.requestedAmount)}</td>
                <td>
                  {v.negotiation.coveredAmount > 0n
                    ? fmtAmount(v.negotiation.coveredAmount)
                    : "—"}
                </td>
                <td>{v.negotiation.round.toString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
