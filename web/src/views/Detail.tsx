/**
 * Detail / Maintain view (R15/R16): the full lifecycle cockpit for one
 * coverage-exception request — its timeline (rebuilt from the global event log
 * filtered to this reqId — R16), current state, on-chain facts, the insurer's
 * attached policy, the arbiter's ruling (decision + covered amount + cited
 * clause + rationale + round), accept flags, and every party action.
 *
 * Every action is gated by state + the active profile's role (provider vs.
 * insurer, matched by partyId to providerId/insurerId), so a button that would
 * revert on-chain is hidden. The "simulated arbiter" controls (decision selector
 * + benchmark-cap input, shown only in simulated mode) flip the module-level
 * mocked-arbiter config just before adjudication — demonstrating the contract-
 * native ruling callback (R6/R6a/R6b), the deterministic min() (R6a), the
 * policy-void path (R6b), bounded appeals → Deadlocked (R6c) and refusal (R7).
 */
import { useEffect, useMemo, useState } from "react";
import {
  STATE_NAMES,
  State,
  Decision,
  DECISION_NAMES,
  ZERO_HASH,
  hashContent,
  verifyContent,
  type CoverageEvent,
  type NegotiationView,
  type PolicyCommitment,
  type Profile,
} from "@lib";
import {
  client,
  getNextBenchmarkCap,
  getNextDecision,
  setNextBenchmarkCap,
  setNextDecision,
} from "../client.js";
import { SAMPLE_CASE } from "../sampleCase.js";
import { describeEvent, fmtAmount, parseAmount, shortHex } from "../shared.js";

interface DetailProps {
  readonly reqId: bigint;
  readonly activeProfile: Profile;
  readonly events: readonly CoverageEvent[];
  readonly onBack: () => void;
}

const DECISION_OPTIONS: readonly Decision[] = [
  Decision.Approve,
  Decision.Deny,
  Decision.NeedMoreEvidence,
  Decision.PolicyInvalid,
];

export function Detail({ reqId, activeProfile, events, onBack }: DetailProps) {
  const [view, setView] = useState<NegotiationView | null>(null);
  const [policy, setPolicy] = useState<PolicyCommitment | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Insurer engage form.
  const [policyText, setPolicyText] = useState("");
  // Adjudication controls (simulated arbiter).
  const [decision, setDecision] = useState<Decision>(getNextDecision());
  const [benchmarkCap, setBenchmarkCap] = useState(
    getNextBenchmarkCap()?.toString() ?? "",
  );
  // Appeal / evidence / refuse / feedback.
  const [appealEvidence, setAppealEvidence] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [refuseReason, setRefuseReason] = useState("");
  const [feedback, setFeedback] = useState("");
  // R3: verify an off-chain justification copy against the on-chain hash.
  const [verifyText, setVerifyText] = useState("");
  const [verifyResult, setVerifyResult] = useState<"match" | "mismatch" | null>(
    null,
  );

  const timeline = useMemo(
    () => events.filter((e) => e.reqId === reqId),
    [events, reqId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await client.negotiation.getNegotiationView(reqId);
        const p = await client.negotiation.policyOf(reqId);
        if (!cancelled) {
          setView(v);
          setPolicy(p);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
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
  const isProvider = partyId === n.providerId;
  const isInsurer = partyId === n.insurerId;
  const isParty = isProvider || isInsurer;

  // Action gating mirrors the contract's lifecycle so nothing reverts.
  const canEngage = state === State.Open && isInsurer;
  const canAdjudicate = view.adjudicable && isParty; // state === Ready
  const ruled = view.ruled; // Approved | Denied
  const canAccept = ruled && isParty;
  const canAppeal = ruled && isParty;
  const canSubmitEvidence = state === State.EvidenceRequested && isProvider;
  const canSettle = ruled && view.bothAccepted && isParty;
  // refuse: provider only, Ready onward, pre-terminal (mirrors _refusable).
  const canRefuse =
    isProvider && state !== State.Open && !view.terminal;
  const canWithdraw = isParty && !view.terminal;
  const canFeedback = !view.terminal && isParty;

  const lastRuled = [...timeline].reverse().find((e) => e.name === "Ruled");
  const policyFlagged = [...timeline]
    .reverse()
    .find((e) => e.name === "PolicyFlagged" || e.name === "PolicyInvalidated");

  function applyArbiterConfig() {
    setNextDecision(decision);
    const cap = parseAmount(benchmarkCap);
    if (cap !== null) setNextBenchmarkCap(cap);
  }

  return (
    <section className="view detail">
      <div className="view-head">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        <h1>Request #{reqId.toString()}</h1>
        <span className={`badge state s-${state}`} data-testid="state-badge">
          {STATE_NAMES[state]}
        </span>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="detail-grid">
        <div className="card facts">
          <h2>On-chain facts</h2>
          <dl>
            <dt>drugRef</dt>
            <dd>
              <code title={n.drugRef}>{shortHex(n.drugRef)}</code>
            </dd>
            <dt>justificationHash</dt>
            <dd>
              <code title={n.justificationHash}>{shortHex(n.justificationHash)}</code>
            </dd>
            <dt>requested</dt>
            <dd>{fmtAmount(n.requestedAmount)}</dd>
            <dt>covered</dt>
            <dd data-testid="covered-amount">
              {n.coveredAmount > 0n ? fmtAmount(n.coveredAmount) : "—"}
            </dd>
            <dt>round</dt>
            <dd data-testid="round-counter">{n.round.toString()}</dd>
            <dt>provider</dt>
            <dd>
              party {n.providerId.toString()} · <code title={n.providerAddr}>{shortHex(n.providerAddr)}</code>
              {n.providerAccepted ? " · accepted ✓" : ""}
            </dd>
            <dt>insurer</dt>
            <dd>
              party {n.insurerId.toString()} · <code title={n.insurerAddr}>{shortHex(n.insurerAddr)}</code>
              {n.insurerAccepted ? " · accepted ✓" : ""}
            </dd>
            <dt>policy</dt>
            <dd>
              {policy && policy.policyHash !== ZERO_HASH ? (
                <code title={policy.policyHash}>{shortHex(policy.policyHash)}</code>
              ) : (
                "— not attached"
              )}
            </dd>
          </dl>

          {!isParty && (
            <p className="hint">
              Active profile (party {partyId.toString()}) is not a party to this
              request. Switch profiles to act as the provider or insurer.
            </p>
          )}

          <div className="verify">
            <label>
              Verify your justification copy (R3)
              <textarea
                data-testid="verify-note-input"
                rows={2}
                value={verifyText}
                onChange={(e) => {
                  setVerifyText(e.target.value);
                  setVerifyResult(null);
                }}
                placeholder="Paste your off-chain justification to confirm it matches the on-chain hash."
              />
            </label>
            <button
              type="button"
              data-testid="verify-note-submit"
              onClick={() =>
                setVerifyResult(
                  verifyContent(verifyText, n.justificationHash) ? "match" : "mismatch",
                )
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
                  ? "✓ matches the committed justification hash"
                  : "✗ does not match"}
              </span>
            )}
          </div>
        </div>

        <div className="card ruling">
          <h2>Ruling</h2>
          {lastRuled ? (
            <dl>
              <dt>decision</dt>
              <dd data-testid="ruling-decision">{DECISION_NAMES[lastRuled.decision]}</dd>
              <dt>covered amount</dt>
              <dd>{fmtAmount(lastRuled.coveredAmount)}</dd>
              <dt>cited clause</dt>
              <dd>
                <code data-testid="cited-clause" title={lastRuled.clauseRef}>
                  {shortHex(lastRuled.clauseRef)}
                </code>
              </dd>
              <dt>rationale</dt>
              <dd>
                <code title={n.rationaleHash}>{shortHex(n.rationaleHash)}</code>
              </dd>
              <dt>round</dt>
              <dd>{n.round.toString()}</dd>
            </dl>
          ) : (
            <p className="hint">No ruling yet.</p>
          )}
          {policyFlagged && (
            <p className="error">
              Policy flagged: clause{" "}
              <code title={policyFlagged.clauseRef}>{shortHex(policyFlagged.clauseRef)}</code>{" "}
              contradicts public standard{" "}
              <code title={policyFlagged.standardRef}>{shortHex(policyFlagged.standardRef)}</code>{" "}
              — contract voided (R6b).
            </p>
          )}
        </div>

        <div className="card actions">
          <h2>Actions</h2>

          {canEngage && (
            <div className="action">
              <label>
                Insurer policy criteria (kept off-chain → hash)
                <textarea
                  data-testid="engage-policy-text"
                  rows={4}
                  value={policyText}
                  onChange={(e) => setPolicyText(e.target.value)}
                  placeholder="Paste the governing Part D exception-criteria policy text."
                />
              </label>
              <div className="btn-row">
                <button
                  type="button"
                  data-testid="engage-load-compliant"
                  onClick={() => setPolicyText(SAMPLE_CASE.policyText)}
                >
                  Load compliant policy
                </button>
                <button
                  type="button"
                  data-testid="engage-noncompliant-toggle"
                  onClick={() => setPolicyText(SAMPLE_CASE.nonCompliantPolicyText)}
                >
                  Load NON-compliant policy (demo PolicyInvalidated)
                </button>
              </div>
              <button
                type="button"
                className="primary"
                data-testid="engage-submit"
                onClick={() => {
                  if (policyText.trim() === "") {
                    setError("Policy text is required to engage.");
                    return;
                  }
                  // R4: only the hash + a public ref cross the boundary.
                  const stored = client.content.put(policyText);
                  void run(() =>
                    client.negotiation.insurerEngage(
                      reqId,
                      stored.hash,
                      hashContent(SAMPLE_CASE.policyRef),
                    ),
                  );
                }}
              >
                Attach policy & engage
              </button>
            </div>
          )}

          {canAdjudicate && (
            <div className="action">
              {client.wallet.mode === "simulated" && (
                <>
                  <label>
                    Simulated arbiter decision
                    <select
                      data-testid="decision-select"
                      value={decision}
                      onChange={(e) => setDecision(Number(e.target.value) as Decision)}
                    >
                      {DECISION_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {DECISION_NAMES[d]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Public benchmark cap (R6a — covered = min(requested, cap))
                    <input
                      data-testid="benchmark-cap"
                      type="text"
                      inputMode="numeric"
                      value={benchmarkCap}
                      onChange={(e) => setBenchmarkCap(e.target.value)}
                      placeholder={`${SAMPLE_CASE.benchmarkCap} (blank = requested)`}
                    />
                  </label>
                </>
              )}
              <button
                type="button"
                className="primary"
                data-testid="adjudicate-submit"
                onClick={() => {
                  applyArbiterConfig();
                  void run(() => client.negotiation.requestAdjudication(reqId));
                }}
              >
                Request adjudication
              </button>
            </div>
          )}

          {canAccept && (
            <div className="action">
              <button
                type="button"
                className="primary"
                data-testid="accept-submit"
                onClick={() =>
                  void run(() => client.negotiation.accept(reqId, partyId))
                }
              >
                Accept ruling (as {isProvider ? "provider" : "insurer"})
              </button>
            </div>
          )}

          {canSettle && (
            <div className="action">
              <button
                type="button"
                className="primary"
                data-testid="settle-submit"
                onClick={() => void run(() => client.negotiation.settle(reqId))}
              >
                Settle (covered {fmtAmount(n.coveredAmount)}, 50/50 fee)
              </button>
            </div>
          )}

          {canAppeal && (
            <div className="action">
              <label>
                Appeal with NEW public evidence of necessity (R6c)
                <textarea
                  data-testid="appeal-evidence"
                  rows={2}
                  value={appealEvidence}
                  onChange={(e) => setAppealEvidence(e.target.value)}
                  placeholder="New openFDA/DailyMed/guideline evidence URL — not price haggling."
                />
              </label>
              <button
                type="button"
                data-testid="appeal-submit"
                onClick={() => {
                  if (appealEvidence.trim() === "") {
                    setError("Appeal requires new public evidence.");
                    return;
                  }
                  void run(() =>
                    client.negotiation.appeal(
                      reqId,
                      partyId,
                      hashContent(appealEvidence),
                      hashContent(`reason:${appealEvidence}`),
                    ),
                  );
                  setAppealEvidence("");
                }}
              >
                Appeal
              </button>
            </div>
          )}

          {canSubmitEvidence && (
            <div className="action">
              <label>
                Submit more public evidence (R6c)
                <textarea
                  data-testid="evidence-text"
                  rows={2}
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  placeholder="Public-evidence URL the arbiter asked for."
                />
              </label>
              <button
                type="button"
                data-testid="evidence-submit"
                onClick={() => {
                  if (evidenceText.trim() === "") {
                    setError("Evidence reference is required.");
                    return;
                  }
                  void run(() =>
                    client.negotiation.submitEvidence(reqId, hashContent(evidenceText)),
                  );
                  setEvidenceText("");
                }}
              >
                Submit evidence
              </button>
            </div>
          )}

          {canRefuse && (
            <div className="action">
              <label>
                Refuse the insurer's terms (provider only — R7)
                <input
                  data-testid="refuse-reason"
                  type="text"
                  value={refuseReason}
                  onChange={(e) => setRefuseReason(e.target.value)}
                  placeholder="Optional reason (kept off-chain)"
                />
              </label>
              <button
                type="button"
                className="danger"
                data-testid="refuse-submit"
                onClick={() =>
                  void run(() =>
                    client.negotiation.refuse(
                      reqId,
                      refuseReason.trim() === "" ? ZERO_HASH : hashContent(refuseReason),
                    ),
                  )
                }
              >
                Refuse terms
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
                data-testid="withdraw-submit"
                onClick={() => void run(() => client.negotiation.withdraw(reqId))}
              >
                Withdraw
              </button>
            </div>
          )}

          {view.terminal && (
            <p className="hint">
              Request is in a terminal state ({STATE_NAMES[state]}); no further
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
