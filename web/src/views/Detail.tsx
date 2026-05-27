/**
 * Detail / Maintain view (R15/R16 + SPEC-0002 R1/R3/R4/R5/R6): the full
 * lifecycle cockpit for one coverage-exception request — its LIVE animated
 * timeline (rebuilt from the global event log filtered to this reqId), a state
 * stepper that highlights and tweens to the current lifecycle state, the
 * arbiter's evolving ruling (decision + covered amount + cited clause +
 * rationale + round, updated per ruling/appeal), the FDA-label policy-void
 * "gotcha" panel, a per-ruling on-chain verify affordance, a requested-vs-NADAC-
 * vs-Cost-Plus-vs-covered price gauge, and every party action.
 *
 * Every action is gated by state + the active profile's role (provider vs.
 * insurer, matched by partyId to providerId/insurerId), so a button that would
 * revert on-chain is hidden. The Observer profile (party 99) is not a party, so
 * it sees everything but acts on nothing — plus an explicit non-party attempt
 * affordance that surfaces the gating rejection (R6/R11).
 *
 * The "simulated arbiter" controls (decision selector + Cost Plus / NADAC
 * per-unit price inputs, shown only in simulated mode) flip the module-level
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
  txUrl,
  SOMNIA_TESTNET,
  type CoverageEvent,
  type NegotiationView,
  type PolicyCommitment,
  type PriceBasis,
  type Profile,
} from "@lib";
import {
  client,
  getNextCostPlusUnitPrice,
  getNextDecision,
  getNextNadacUnitPrice,
  setNextCostPlusUnitPrice,
  setNextDecision,
  setNextNadacUnitPrice,
  CLAUSE_REF,
  STANDARD_REF,
} from "../client.js";
import { SAMPLE_CASE } from "../sampleCase.js";
import {
  FDA_DRUG_LABEL,
  FDA_INDICATION_TEXT,
  FDA_LABEL_URL,
} from "../fdaIndication.js";
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

/** The lifecycle steps shown in the animated stepper (R1). */
const STEPPER: readonly { readonly label: string; readonly states: readonly State[] }[] = [
  { label: "Open", states: [State.Open] },
  { label: "Ready", states: [State.Ready] },
  { label: "UnderReview", states: [State.UnderReview, State.EvidenceRequested] },
  { label: "Ruled", states: [State.Approved, State.Denied] },
  {
    label: "Terminal",
    states: [
      State.Settled,
      State.Deadlocked,
      State.PolicyInvalidated,
      State.ProviderRefused,
      State.Withdrawn,
    ],
  },
];

export function Detail({ reqId, activeProfile, events, onBack }: DetailProps) {
  const [view, setView] = useState<NegotiationView | null>(null);
  const [policy, setPolicy] = useState<PolicyCommitment | null>(null);
  const [priceBasis, setPriceBasis] = useState<PriceBasis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Insurer engage form.
  const [policyText, setPolicyText] = useState("");
  // Adjudication controls (simulated arbiter).
  const [decision, setDecision] = useState<Decision>(getNextDecision());
  const [costPlusUnit, setCostPlusUnit] = useState(
    getNextCostPlusUnitPrice()?.toString() ?? "",
  );
  const [nadacUnit, setNadacUnit] = useState(
    getNextNadacUnitPrice()?.toString() ?? "",
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
  // R6: the non-party attempt affordance result (observer).
  const [nonpartyRejected, setNonpartyRejected] = useState<string | null>(null);

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
        // Price basis is meaningful only once the arbiter has priced (ruled);
        // before that the cap/NADAC totals are unknown, so we leave it null and
        // show the requested-only gauge (R5).
        const pb = v.ruled || v.terminal ? await client.negotiation.priceBasisOf(reqId) : null;
        if (!cancelled) {
          setView(v);
          setPolicy(p);
          setPriceBasis(pb);
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
  const canRefuse = isProvider && state !== State.Open && !view.terminal;
  const canWithdraw = isParty && !view.terminal;
  const canFeedback = !view.terminal && isParty;

  const lastRuled = [...timeline].reverse().find((e) => e.name === "Ruled");
  const policyFlagged = [...timeline]
    .reverse()
    .find((e) => e.name === "PolicyFlagged" || e.name === "PolicyInvalidated");
  const settled = [...timeline].reverse().find((e) => e.name === "Settled");
  const isVoided = state === State.PolicyInvalidated;

  // The current step index for the animated stepper (R1).
  const currentStep = STEPPER.findIndex((s) => s.states.includes(state));

  function applyArbiterConfig() {
    setNextDecision(decision);
    const cp = parseAmount(costPlusUnit);
    if (cp !== null) setNextCostPlusUnitPrice(cp);
    const nd = parseAmount(nadacUnit);
    if (nd !== null) setNextNadacUnitPrice(nd);
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
        <span className="role-label" data-testid="active-role">
          Acting as <strong>{activeProfile.label}</strong>
          {isProvider ? " (provider)" : isInsurer ? " (insurer)" : " (observer — read-only)"}
        </span>
      </div>

      {/* R1: animated state stepper — highlights + tweens to the current state. */}
      <ol className="stepper" data-testid="state-stepper">
        {STEPPER.map((step, i) => {
          const cls =
            i < currentStep ? "done" : i === currentStep ? "current" : "upcoming";
          return (
            <li key={step.label} className={`step ${cls}`}>
              <span className="dot" />
              <span className="step-label">
                {i === currentStep ? STATE_NAMES[state] : step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {error && <p className="error">{error}</p>}

      {/* R6: observer / non-party gating made visible. */}
      {!isParty && (
        <div className="card nonparty" data-testid="nonparty-panel">
          <h2>Observer (read-only)</h2>
          <p className="hint">
            Active profile (party {partyId.toString()}) is not a party to this
            request, so every mutating action is hidden. Reads stay public (R11).
            Switch to the provider or insurer to act.
          </p>
          <button
            type="button"
            data-testid="nonparty-attempt"
            onClick={() =>
              void (async () => {
                setNonpartyRejected(null);
                try {
                  // A gated method called with the observer's (unknown) partyId
                  // must be rejected — proving R11 neutrality / access control.
                  await client.negotiation.accept(reqId, partyId);
                  setNonpartyRejected(
                    "Unexpected: the action was NOT rejected (gating failed).",
                  );
                } catch (err) {
                  setNonpartyRejected(
                    err instanceof Error ? err.message : String(err),
                  );
                }
              })()
            }
          >
            Attempt an action as a non-party (expect rejection)
          </button>
          {nonpartyRejected && (
            <p className="error" data-testid="nonparty-rejected">
              Rejected: {nonpartyRejected}
            </p>
          )}
        </div>
      )}

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
            <dt>quantity</dt>
            <dd data-testid="fact-quantity">{n.quantity.toString()}</dd>
            <dt>daysSupply</dt>
            <dd data-testid="fact-days-supply">
              {n.daysSupply > 0n ? n.daysSupply.toString() : "—"}
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

        {/* R1: the evolving ruling panel — updates per round as rulings land. */}
        <div className="card ruling" data-testid="ruling-panel">
          <h2>Ruling (round {n.round.toString()})</h2>
          {lastRuled ? (
            <dl>
              <dt>decision</dt>
              <dd data-testid="ruling-decision">{DECISION_NAMES[lastRuled.decision]}</dd>
              <dt>covered amount</dt>
              <dd data-testid="ruling-covered">{fmtAmount(lastRuled.coveredAmount)}</dd>
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
            <p className="hint">No ruling yet — adjudicate to fire the arbiter.</p>
          )}

          {/* R4: per-ruling verify affordance (explorer link / event+hash). */}
          {(lastRuled || settled) && (
            <VerifyOnChain
              event={settled ?? lastRuled!}
            />
          )}
        </div>
      </div>

      {/* R5: price gauge — requested vs NADAC floor vs Cost Plus cap vs covered. */}
      <PriceGauge
        requested={n.requestedAmount}
        basis={priceBasis}
        covered={n.coveredAmount}
      />

      {/* R3: the FDA-label policy-void "gotcha" panel. */}
      {isVoided && policyFlagged && (
        <div className="card gotcha" data-testid="gotcha-panel">
          <h2>Policy voided — clause contradicts the FDA-approved indication (R6b)</h2>
          <p className="gotcha-explain">
            Voided because the relied-on clause contradicts the FDA-approved
            indication. The arbiter refused to apply it and routed the request to
            terminal <strong>PolicyInvalidated</strong> — a bad payer clause is
            thrown out, never silently applied.
          </p>
          <div className="gotcha-cols">
            <div className="gotcha-col">
              <h3>Offending insurer policy clause ({SAMPLE_CASE.nonCompliantClauseId})</h3>
              <p className="gotcha-clause" data-testid="gotcha-clause">
                {SAMPLE_CASE.nonCompliantPolicyText}
              </p>
            </div>
            <div className="gotcha-col">
              <h3>FDA-approved indication — {FDA_DRUG_LABEL}</h3>
              <p className="gotcha-fda" data-testid="gotcha-fda-citation">
                {FDA_INDICATION_TEXT}
              </p>
              <p className="hint">
                Source:{" "}
                <a href={FDA_LABEL_URL} target="_blank" rel="noreferrer">
                  openFDA HUMIRA label
                </a>{" "}
                (synthetic fixture)
              </p>
            </div>
          </div>
          <p className="hint gotcha-refs">
            On-chain clauseRef{" "}
            <code title={policyFlagged.clauseRef}>{shortHex(policyFlagged.clauseRef)}</code>
            {policyFlagged.clauseRef === CLAUSE_REF ? " (PD-ADA-09)" : ""} · standardRef{" "}
            <code title={policyFlagged.standardRef}>{shortHex(policyFlagged.standardRef)}</code>
            {policyFlagged.standardRef === STANDARD_REF ? " (FDA HUMIRA label)" : ""}
          </p>
        </div>
      )}

      <div className="detail-grid">
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
                  <div className="row">
                    <label>
                      Cost Plus unit price (cap = ×quantity — R6a)
                      <input
                        data-testid="costplus-unit-price"
                        type="text"
                        inputMode="numeric"
                        value={costPlusUnit}
                        onChange={(e) => setCostPlusUnit(e.target.value)}
                        placeholder={`${SAMPLE_CASE.costPlusUnitPrice} (blank = non-binding)`}
                      />
                    </label>
                    <label>
                      NADAC unit price (acquisition floor reference)
                      <input
                        data-testid="nadac-unit-price"
                        type="text"
                        inputMode="numeric"
                        value={nadacUnit}
                        onChange={(e) => setNadacUnit(e.target.value)}
                        placeholder={`${SAMPLE_CASE.nadacUnitPrice} (floor only)`}
                      />
                    </label>
                  </div>
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

          {!isParty && (
            <p className="hint">
              No actions available to an observer; see the read-only panel above.
            </p>
          )}
        </div>

        <div className="card timeline" data-testid="timeline-card">
          <h2>Timeline (live)</h2>
          <ol data-testid="timeline">
            {timeline.length === 0 ? (
              <li className="empty">No events yet.</li>
            ) : (
              timeline.map((e, i) => (
                <li key={`${e.name}-${i}`} className="ev-row">
                  <span className="ev-name">{e.name}</span>
                  <span className="ev-desc">{describeEvent(e)}</span>
                </li>
              ))
            )}
          </ol>
        </div>
      </div>
    </section>
  );
}

/**
 * R4 verify affordance for a ruling / settlement. In real mode (event carries a
 * txHash) it deep-links the Somnia explorer + shows the receipt id; in simulated
 * mode it shows the event name + the on-chain hash(es) with a clear note that no
 * live tx exists — making "it's actually on-chain" legible either way.
 */
function VerifyOnChain({ event }: { readonly event: CoverageEvent }) {
  const hashes: { readonly label: string; readonly value: string }[] = [];
  let receiptId: bigint | null = null;
  // Settled carries no hashes — its on-chain facts are the covered amount + fee.
  if (event.name === "Ruled") {
    hashes.push({ label: "rationaleHash", value: event.rationaleHash });
    hashes.push({ label: "clauseRef", value: event.clauseRef });
    receiptId = event.receiptId;
  }

  return (
    <div className="verify-onchain" data-testid="verify-onchain">
      {event.txHash ? (
        <>
          <a
            href={txUrl(SOMNIA_TESTNET, event.txHash)}
            target="_blank"
            rel="noreferrer"
            data-testid="verify-onchain-link"
          >
            View on Somnia explorer
          </a>
          {receiptId !== null && (
            <span className="hint"> · receipt {receiptId.toString()}</span>
          )}
        </>
      ) : (
        <div className="sim-verify">
          <span className="ev-name">{event.name}</span>
          {hashes.map((h) => (
            <span key={h.label} className="hint">
              {h.label}{" "}
              <code title={h.value}>{shortHex(h.value)}</code>
            </span>
          ))}
          {receiptId !== null && (
            <span className="hint">receipt {receiptId.toString()}</span>
          )}
          <span className="hint sim-note">
            (simulated — event + hash shown; no live tx)
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * R5 price gauge: a scaled horizontal-bar comparison of requested vs NADAC floor
 * vs Cost Plus cap vs covered. Before a ruling (no price basis) only the
 * requested amount is known, so we render just that bar with a "cap / NADAC
 * unknown until the arbiter prices" note. The covered marker sits at
 * min(requested, costPlusTotal) (R6a).
 */
function PriceGauge({
  requested,
  basis,
  covered,
}: {
  readonly requested: bigint;
  readonly basis: PriceBasis | null;
  readonly covered: bigint;
}) {
  const bars: { readonly label: string; readonly value: bigint; readonly cls: string }[] =
    basis
      ? [
          { label: "Requested", value: basis.requestedAmount, cls: "requested" },
          { label: "NADAC floor", value: basis.nadacFloorTotal, cls: "nadac" },
          { label: "Cost Plus cap", value: basis.costPlusTotal, cls: "costplus" },
          { label: "Covered", value: basis.coveredAmount, cls: "covered" },
        ]
      : [{ label: "Requested", value: requested, cls: "requested" }];

  const max = bars.reduce((m, b) => (b.value > m ? b.value : m), 1n);
  const pct = (v: bigint): number =>
    max > 0n ? Number((v * 1000n) / max) / 10 : 0;
  const coveredVal = basis ? basis.coveredAmount : covered;

  return (
    <div className="card price-gauge" data-testid="price-gauge">
      <h2>Price gauge — requested vs NADAC vs Cost Plus vs covered (R5/R6a)</h2>
      {bars.map((b) => (
        <div key={b.label} className="gauge-row">
          <span className="gauge-label">{b.label}</span>
          <span className="gauge-track">
            <span className={`gauge-bar ${b.cls}`} style={{ width: `${pct(b.value)}%` }} />
          </span>
          <span className="gauge-value">{b.value.toString()}</span>
        </div>
      ))}
      {basis ? (
        <p className="hint">
          Covered = min(requested {basis.requestedAmount.toString()}, Cost Plus cap{" "}
          {basis.costPlusTotal.toString()}) ={" "}
          <strong>{coveredVal.toString()}</strong> (deterministic — R6a). NADAC is the
          acquisition-cost floor reference only, never the cap.
        </p>
      ) : (
        <p className="hint">
          Cap / NADAC are unknown until the arbiter prices the request — adjudicate
          to populate the gauge.
        </p>
      )}
    </div>
  );
}
