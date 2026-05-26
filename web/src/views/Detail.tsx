/**
 * Detail / Maintain view (R14/R15): the full lifecycle of one contract — its
 * timeline (rebuilt from the global event log filtered to this reqId — R16),
 * current state, band, both parties' positions, agreed amount, and the agent's
 * final verdict. Action buttons are gated by the view flags + state + the
 * active profile, so a button that would revert on-chain is hidden/disabled.
 *
 * The "simulated agent verdict" selector (shown only in simulated mode) flips
 * the module-level verdict the mocked agent reads, just before a dispute is
 * raised — demonstrating the contract-native ruling callback (R6).
 */
import { useEffect, useMemo, useState } from "react";
import {
  STATE_NAMES,
  State,
  ZERO_HASH,
  hashContent,
  verifyContent,
  type CoverageEvent,
  type NegotiationView,
  type Profile,
  type Verdict,
} from "@lib";
import { client, getNextVerdict, setNextVerdict } from "../client.js";
import { describeEvent, fmtAmount, parseAmount, shortHex } from "../shared.js";

interface DetailProps {
  readonly reqId: bigint;
  readonly activeProfile: Profile;
  readonly events: readonly CoverageEvent[];
  readonly onBack: () => void;
}

export function Detail({ reqId, activeProfile, events, onBack }: DetailProps) {
  const [view, setView] = useState<NegotiationView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [positionAmount, setPositionAmount] = useState("");
  const [feedback, setFeedback] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [verdict, setVerdict] = useState<Verdict>(getNextVerdict());
  // R3: a party pastes their off-chain note copy to confirm it hashes to the
  // on-chain commitment — verification happens locally; the note never leaves.
  const [verifyText, setVerifyText] = useState("");
  const [verifyResult, setVerifyResult] = useState<"match" | "mismatch" | null>(null);

  // Re-fetch the view whenever an event lands (the App's subscription drives
  // this). Filter to this contract's events for the timeline below.
  const timeline = useMemo(
    () => events.filter((e) => e.reqId === reqId),
    [events, reqId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await client.negotiation.getNegotiationView(reqId);
        if (!cancelled) setView(v);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reqId, events]);

  // Wrap a contract write: surface errors, let the subscription do the refresh.
  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!view) {
    return (
      <section className="view detail">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        {error ? <p className="error">{error}</p> : <p>Loading…</p>}
      </section>
    );
  }

  const { negotiation: n, state } = view;
  const partyId = activeProfile.partyId;
  // Which side is the active profile? Determines which position they own.
  const isInitiator = partyId === n.initiatorId;
  const isDestination = partyId === n.destinationId;
  const myPosition = isInitiator
    ? n.initiatorPosition
    : isDestination
      ? n.destinationPosition
      : null;

  // Action gating mirrors the contract's lifecycle so nothing reverts.
  const canSubmitPosition =
    state === State.Open && myPosition !== null && !myPosition.submitted;
  const canDispute = view.disputable; // state === Ready
  const canFeedback = !view.terminal; // off-chain conversation in active states
  const canSubmitEvidence = state === State.EvidenceRequested;
  const canAppeal = state === State.Denied;
  const canSettle = state === State.Approved;
  const canWithdraw = !view.terminal;

  // The latest Ruled event carries the agent's final verdict / receipt.
  const lastRuled = [...timeline].reverse().find((e) => e.name === "Ruled");

  return (
    <section className="view detail">
      <div className="view-head">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        <h1>Contract #{reqId.toString()}</h1>
        <span
          className={`badge state s-${state}`}
          data-testid="state-badge"
        >
          {STATE_NAMES[state]}
        </span>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="detail-grid">
        <div className="card facts">
          <h2>Facts</h2>
          <dl>
            <dt>drugRef</dt>
            <dd>
              <code title={n.drugRef}>{shortHex(n.drugRef)}</code>
            </dd>
            <dt>noteHash</dt>
            <dd>
              <code title={n.noteHash}>{shortHex(n.noteHash)}</code>
            </dd>
            <dt>band</dt>
            <dd>
              [{fmtAmount(n.priceFloor)}, {fmtAmount(n.priceCeil)}]
            </dd>
            <dt>initiator</dt>
            <dd>
              party {n.initiatorId.toString()} —{" "}
              {n.initiatorPosition.submitted
                ? `proposed ${fmtAmount(n.initiatorPosition.proposedAmount)}`
                : "no position"}
            </dd>
            <dt>destination</dt>
            <dd>
              party {n.destinationId.toString()} —{" "}
              {n.destinationPosition.submitted
                ? `proposed ${fmtAmount(n.destinationPosition.proposedAmount)}`
                : "no position"}
            </dd>
            <dt>agreed</dt>
            <dd>{n.agreedAmount > 0n ? fmtAmount(n.agreedAmount) : "—"}</dd>
            <dt>agent verdict</dt>
            <dd>
              {lastRuled
                ? `"${lastRuled.verdict}" (receipt ${lastRuled.receiptId})`
                : "—"}
            </dd>
          </dl>
          {!isInitiator && !isDestination && (
            <p className="hint">
              Active profile (party {partyId.toString()}) is not a party to this
              contract. Switch profiles to act as the initiator or destination.
            </p>
          )}

          <div className="verify">
            <label>
              Verify your note copy (R3)
              <textarea
                data-testid="verify-note-input"
                rows={2}
                value={verifyText}
                onChange={(e) => {
                  setVerifyText(e.target.value);
                  setVerifyResult(null);
                }}
                placeholder="Paste your off-chain note to confirm it matches the on-chain hash."
              />
            </label>
            <button
              type="button"
              data-testid="verify-note-submit"
              onClick={() =>
                setVerifyResult(verifyContent(verifyText, n.noteHash) ? "match" : "mismatch")
              }
            >
              Verify
            </button>
            {verifyResult && (
              <span
                data-testid="verify-note-result"
                className={verifyResult === "match" ? "ok" : "bad"}
              >
                {verifyResult === "match"
                  ? "✓ matches the committed note hash"
                  : "✗ does not match"}
              </span>
            )}
          </div>
        </div>

        <div className="card actions">
          <h2>Actions</h2>

          {canSubmitPosition && (
            <div className="action">
              <label>
                Your proposed amount
                <input
                  data-testid="position-amount"
                  type="text"
                  inputMode="numeric"
                  value={positionAmount}
                  onChange={(e) => setPositionAmount(e.target.value)}
                  placeholder="2500"
                />
              </label>
              <button
                type="button"
                className="primary"
                data-testid="position-submit"
                onClick={() => {
                  const amount = parseAmount(positionAmount);
                  if (amount === null) {
                    setError("Position amount must be a non-negative integer.");
                    return;
                  }
                  void run(() =>
                    client.negotiation.submitPosition({
                      reqId,
                      partyId,
                      proposedAmount: amount,
                      contentHash: ZERO_HASH,
                      uri: ZERO_HASH,
                    }),
                  );
                }}
              >
                Submit position
              </button>
            </div>
          )}

          {canDispute && (
            <div className="action">
              {client.wallet.mode === "simulated" && (
                <label>
                  Simulated agent verdict
                  <select
                    data-testid="verdict-select"
                    value={verdict}
                    onChange={(e) => {
                      const v = e.target.value as Verdict;
                      setVerdict(v);
                      setNextVerdict(v);
                    }}
                  >
                    <option value="approve">approve</option>
                    <option value="deny">deny</option>
                    <option value="need_more_evidence">
                      need_more_evidence
                    </option>
                  </select>
                </label>
              )}
              <button
                type="button"
                className="primary"
                data-testid="dispute-submit"
                onClick={() => {
                  // Ensure the agent reads the currently selected verdict.
                  setNextVerdict(verdict);
                  void run(() =>
                    client.negotiation.submitDispute(reqId, partyId),
                  );
                }}
              >
                Raise dispute
              </button>
            </div>
          )}

          {canSubmitEvidence && (
            <div className="action">
              <button
                type="button"
                onClick={() =>
                  void run(() =>
                    // Opaque evidence ref; a real deployment would point at an
                    // off-chain document. Re-fires the agent.
                    client.negotiation.submitEvidence(
                      reqId,
                      hashContent(`evidence:${reqId}:${Date.now()}`),
                    ),
                  )
                }
              >
                Submit evidence
              </button>
            </div>
          )}

          {canAppeal && (
            <div className="action">
              <button
                type="button"
                onClick={() =>
                  void run(() =>
                    client.negotiation.appeal(
                      reqId,
                      hashContent(`appeal:${reqId}:${Date.now()}`),
                    ),
                  )
                }
              >
                Appeal denial
              </button>
            </div>
          )}

          {canSettle && (
            <div className="action">
              <label>
                Settle amount (within band)
                <input
                  data-testid="settle-amount"
                  type="text"
                  inputMode="numeric"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder={`${n.priceFloor}–${n.priceCeil}`}
                />
              </label>
              <button
                type="button"
                className="primary"
                data-testid="settle-submit"
                onClick={() => {
                  const amount = parseAmount(settleAmount);
                  if (amount === null) {
                    setError("Settle amount must be a non-negative integer.");
                    return;
                  }
                  if (amount < n.priceFloor || amount > n.priceCeil) {
                    setError(
                      `Settle amount must be within [${n.priceFloor}, ${n.priceCeil}].`,
                    );
                    return;
                  }
                  void run(() => client.negotiation.settle(reqId, amount));
                }}
              >
                Settle
              </button>
            </div>
          )}

          {canFeedback && (
            <div className="action">
              <label>
                Feedback (kept off-chain)
                <input
                  data-testid="feedback-text"
                  type="text"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Add a note to the conversation"
                />
              </label>
              <button
                type="button"
                data-testid="feedback-submit"
                onClick={() => {
                  if (feedback.trim() === "") {
                    setError("Feedback text is required.");
                    return;
                  }
                  // R7/R4: only the hash crosses the boundary; text stays local.
                  void run(async () => {
                    await client.negotiation.postFeedback(
                      reqId,
                      hashContent(feedback),
                      ZERO_HASH,
                    );
                    setFeedback("");
                  });
                }}
              >
                Post feedback
              </button>
            </div>
          )}

          {canWithdraw && (
            <div className="action">
              <button
                type="button"
                className="danger"
                onClick={() => void run(() => client.negotiation.withdraw(reqId))}
              >
                Withdraw
              </button>
            </div>
          )}

          {view.terminal && (
            <p className="hint">
              Contract is in a terminal state ({STATE_NAMES[state]}); no further
              actions.
            </p>
          )}
        </div>
      </div>

      <div className="card timeline">
        <h2>Timeline</h2>
        <ol data-testid="timeline">
          {timeline.length === 0 ? (
            <li className="empty">No events yet.</li>
          ) : (
            timeline.map((e, i) => (
              <li key={`${e.name}-${i}`}>
                <span className="ev-name">{e.name}</span>
                <span className="ev-desc">{describeEvent(e)}</span>
              </li>
            ))
          )}
        </ol>
      </div>
    </section>
  );
}
