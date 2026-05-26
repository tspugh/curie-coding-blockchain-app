/**
 * Overview (R15): a live table of every contract (reqId 1..count()) with state,
 * the dispute flags, the price band, and the agreed amount. Re-fetches whenever
 * a new event arrives (passed down from the App's subscription — R16). Each row
 * opens the contract's Detail view.
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
        <h1>Contracts</h1>
        <button type="button" className="primary" onClick={onCreate}>
          Create new
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="empty">No contracts yet. Create one to get started.</p>
      ) : (
        <table className="contracts">
          <thead>
            <tr>
              <th>reqId</th>
              <th>drugRef</th>
              <th>state</th>
              <th>both positions?</th>
              <th>disputable?</th>
              <th>band [floor, ceil]</th>
              <th>agreed</th>
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
                <td>{v.bothPositionsSubmitted ? "yes" : "no"}</td>
                <td>{v.disputable ? "yes" : "no"}</td>
                <td>
                  [{fmtAmount(v.negotiation.priceFloor)},{" "}
                  {fmtAmount(v.negotiation.priceCeil)}]
                </td>
                <td>
                  {v.negotiation.agreedAmount > 0n
                    ? fmtAmount(v.negotiation.agreedAmount)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
