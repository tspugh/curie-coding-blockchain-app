import { useEffect, useMemo, useState } from "react";
import {
  State,
  Decision,
  ZERO_HASH,
  hashContent,
  verifyContent,
  txUrl,
  SOMNIA_TESTNET,
  LADDERS,
  PayerLine,
  stageNameFor,
  policiesForLine,
  type CoverageEvent,
  type CuratedPolicy,
  type NegotiationView,
  type PolicyCommitment,
  type PriceBasis,
  type Profile,
} from "@lib";
import {
  client,
  getNextDecision,
  setNextDecision,
  CLAUSE_REF,
  STANDARD_REF,
} from "../client.js";
import { SAMPLE_CASE } from "../sampleCase.js";
import { ErrorCard } from "../components/ErrorCard.js";
import {
  FDA_DRUG_LABEL,
  FDA_INDICATION_TEXT,
  FDA_LABEL_URL,
} from "../fdaIndication.js";
import { describeEvent, eventAttribution, eventTone, fmtAmount, shortHex } from "../shared.js";

interface DetailProps {
  readonly reqId: bigint;
  readonly activeProfile: Profile;
  readonly events: readonly CoverageEvent[];
  readonly onBack: () => void;
}

// ─── Human-friendly display labels ───────────────────────────────────────────

const FRIENDLY_STATE: Record<State, string> = {
  [State.Open]: "Filed — Awaiting Insurer",
  [State.Ready]: "Policy Attached — Ready for AI",
  [State.UnderReview]: "AI Reviewing…",
  [State.EvidenceRequested]: "More Information Needed",
  [State.Approved]: "Approved",
  [State.Denied]: "Denied",
  [State.Settled]: "Settled",
  [State.Deadlocked]: "Deadlocked",
  [State.PolicyInvalidated]: "Policy Voided by AI",
  [State.ProviderRefused]: "Provider Refused",
  [State.Withdrawn]: "Withdrawn",
};

const FRIENDLY_EVENT: Record<string, string> = {
  ContractCreated: "Request filed",
  ContentCommitted: "Justification recorded on-chain",
  PolicyAttached: "Insurance policy attached",
  AdjudicationRequested: "AI arbitration requested",
  Ruled: "AI decision issued",
  Accepted: "Party accepted the decision",
  Settled: "Request settled",
  Appealed: "Decision appealed",
  EvidenceSubmitted: "Additional evidence submitted",
  FeedbackPosted: "Note added",
  Withdrawn: "Request withdrawn",
  ProviderRefused: "Provider refused terms",
  PolicyFlagged: "Policy clause flagged by AI",
  PolicyInvalidated: "Policy voided by AI",
};

const STEPPER_STEPS: readonly {
  readonly label: string;
  readonly states: readonly State[];
}[] = [
  { label: "Filed", states: [State.Open] },
  { label: "Policy Attached", states: [State.Ready] },
  { label: "AI Reviewing", states: [State.UnderReview, State.EvidenceRequested] },
  { label: "Decision Made", states: [State.Approved, State.Denied] },
  {
    label: "Complete",
    states: [
      State.Settled,
      State.Deadlocked,
      State.PolicyInvalidated,
      State.ProviderRefused,
      State.Withdrawn,
    ],
  },
];

/**
 * Display name for a payer line — symbolic enum reads "PartD" but the prototype
 * surfaces "Medicare Part D" / "Commercial" / "Medicaid". Mirrors Overview.tsx's
 * payerLineDisplay (kept inline rather than shared to keep the diff tight; a
 * shared helper is a small future NIT closure).
 */
/**
 * SPEC-0005 R14: serialize a curated policy into the single-string body the
 * insurer commits off-chain. The on-chain payload is the keccak256 of THIS
 * string, so the format MUST be stable for clause-level replay; do not
 * reorder or relabel without bumping the policy id.
 */
function renderCuratedPolicyText(policy: CuratedPolicy): string {
  const head = `${policy.name}. ${policy.summary}`;
  const clauseLines = policy.clauses.map(
    (c) => `Clause ${c.id}${c.voids ? " (FLAGGED)" : ""}: ${c.text}`,
  );
  return [head, ...clauseLines].join(" ");
}

/**
 * SPEC-0005 R15: serialize a custom (insurer-composed) policy. Each non-empty
 * textarea line becomes one clause; clauses are numbered `CUSTOM-N` so the
 * format mirrors `renderCuratedPolicyText` and downstream consumers can rely
 * on the same shape. Empty name + empty clauses yield "" so the gating check
 * sees an empty body.
 */
function buildCustomPolicyText(name: string, clauses: string): string {
  const trimmedName = name.trim();
  const lines = clauses.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  if (trimmedName === "" && lines.length === 0) return "";
  const head = `${trimmedName || "Custom policy"}. Custom composition.`;
  const clauseLines = lines.map((text, i) => `Clause CUSTOM-${i + 1}: ${text}`);
  return [head, ...clauseLines].join(" ");
}

function payerLineDisplay(line: PayerLine): string {
  switch (line) {
    case PayerLine.PartD: return "Medicare Part D";
    case PayerLine.Commercial: return "Commercial";
    case PayerLine.Medicaid: return "Medicaid";
  }
}

/** Compact statutory-window display, e.g. "60 days". Null → empty string. */
function windowDaysDisplay(d: number | null): string {
  return d == null ? "" : `${d} day${d === 1 ? "" : "s"}`;
}

/** Compact threshold display in dollars, e.g. "$190 AIC". Null → empty. */
function thresholdDisplay(cents: number | null): string {
  if (cents == null) return "";
  const dollars = Math.round(cents / 100);
  return `$${dollars.toLocaleString()} AIC`;
}

interface AppealLadderProps {
  readonly payerLine: PayerLine;
  readonly appealRound: number;
}

/**
 * Appeal-ladder card (SPEC-0004 §2.4 R15/R17, prototype screens.jsx:233-266).
 * Renders LADDERS[payerLine] as a row of stage cards. The active card
 * (i === appealRound) is highlighted; previous (i < appealRound) show ✓;
 * future (i > appealRound + 1) dim. Header caption shows the current stage
 * name + window-days + threshold from the ladder row.
 */
function AppealLadder({ payerLine, appealRound }: AppealLadderProps) {
  const stages = LADDERS[payerLine];
  const currentStage = stages[appealRound];
  const currentName = stageNameFor(payerLine, appealRound);

  return (
    <section className="appeal-ladder card">
      <header className="appeal-ladder-head">
        <div className="section-label">Appeal ladder · {payerLineDisplay(payerLine)}</div>
        <div className="appeal-ladder-meta">
          currently at <strong>{currentName}</strong>
          {currentStage?.windowDays != null && (
            <> · file within {windowDaysDisplay(currentStage.windowDays)}</>
          )}
          {currentStage?.thresholdCents != null && (
            <> · {thresholdDisplay(currentStage.thresholdCents)}</>
          )}
        </div>
      </header>
      <div className="appeal-ladder-grid">
        {stages.map((s, i) => {
          const isCurrent = i === appealRound;
          const isPassed = i < appealRound;
          const isDistantFuture = !isCurrent && !isPassed && i > appealRound + 1;
          const cls =
            "appeal-stage" +
            (isCurrent ? " is-current" : "") +
            (isPassed ? " is-passed" : "") +
            (isDistantFuture ? " is-dim" : "");
          return (
            <div key={i} className={cls}>
              <div className="appeal-stage-head">
                <span className="appeal-stage-badge">
                  {isPassed ? "✓" : i}
                </span>
                <span className="appeal-stage-name">{s.name}</span>
              </div>
              <div className="appeal-stage-desc">{s.description}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getNextStep(
  state: State,
  isProvider: boolean,
  isInsurer: boolean,
): string | null {
  if (state === State.Open && isInsurer)
    return "Choose an insurance policy to attach, then click Engage.";
  if (state === State.Open && isProvider)
    return "Waiting for the insurance company to attach their policy.";
  if (state === State.Ready && isProvider)
    return "Policy attached. Request an AI decision to start arbitration.";
  if (state === State.Ready && isInsurer)
    return "Waiting for the healthcare provider to request an AI decision.";
  if (state === State.UnderReview)
    return "The AI is reviewing this request. The decision will appear here shortly.";
  if (state === State.EvidenceRequested && isProvider)
    return "The AI needs more information. Submit additional evidence to continue.";
  if (state === State.Approved || state === State.Denied)
    return "The AI has made a decision. Both parties must accept to proceed to settlement.";
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Detail({ reqId, activeProfile, events, onBack }: DetailProps) {
  const [view, setView] = useState<NegotiationView | null>(null);
  const [policy, setPolicy] = useState<PolicyCommitment | null>(null);
  const [priceBasis, setPriceBasis] = useState<PriceBasis | null>(null);
  // Error state is `unknown` so the raw caught value (Error object, string, etc.)
  // can flow into ErrorCard, which runs its own R16 revert-reason mapping via
  // extractRevertReason (which requires an object — string messages would lose the
  // mapping). Validation errors below pass plain strings (already user-facing).
  const [error, setError] = useState<unknown>(null);
  // Bumped after every `run()` action to force an immediate view re-fetch
  // (see run()), so status transitions like submitEvidence → UnderReview show
  // without waiting on the event subscription.
  const [refreshTick, setRefreshTick] = useState(0);

  const [policyText, setPolicyText] = useState("");
  // SPEC-0005 R14: the policy choice is the curated policy's id, or the
  // sentinel "custom" when the insurer is composing their own (R15), or
  // null when nothing's selected yet.
  //
  // Followup NIT (tracked, not blocking): the "custom" sentinel shares its
  // string namespace with curated policy ids. A curated policy named
  // literally "custom" would collide. The library currently uses
  // hyphenated slugs (partd-formulary-adalimumab, …) so the collision is
  // implausible; the cleaner shape is a tagged union
  // `{kind: "curated"; id: string} | {kind: "custom"} | null` — defer
  // until a second sentinel is needed.
  const [policyChoice, setPolicyChoice] = useState<string | null>(null);
  // SPEC-0005 R15: custom-policy composer state. `customName` is the policy
  // title; `customClauses` is a newline-separated list — each non-empty line
  // becomes a single clause in the rendered text body.
  const [customName, setCustomName] = useState("");
  const [customClauses, setCustomClauses] = useState("");
  const [decision, setDecision] = useState<Decision>(getNextDecision());
  const [appealEvidence, setAppealEvidence] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [verifyText, setVerifyText] = useState("");
  const [verifyResult, setVerifyResult] = useState<"match" | "mismatch" | null>(null);
  const [showProof, setShowProof] = useState(false);

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
        const pb =
          v.ruled || v.terminal
            ? await client.negotiation.priceBasisOf(reqId)
            : null;
        if (!cancelled) {
          setView(v);
          setPolicy(p);
          setPriceBasis(pb);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      }
    })();
    return () => { cancelled = true; };
  }, [reqId, events, refreshTick]);

  // Forward the raw error to ErrorCard, which runs the SPEC-0003 R16
  // revert-reason mapping itself. (Pre-formatting the message here would
  // double-render the headline + collapse "what to do" into the headline.)
  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    } finally {
      // Force an immediate view re-fetch after every action. submitEvidence /
      // appeal re-fire the agent in the same tx, so by the time the tx resolves
      // the on-chain state is already UnderReview — refreshing here flips the
      // status tag to "AI reviewing…" right away instead of waiting on the
      // subscribe event round-trip (which can lag seconds on Somnia).
      setRefreshTick((t) => t + 1);
    }
  }

  if (!view) {
    return (
      <section className="view detail">
        <button type="button" onClick={onBack}>← Back</button>
        {/* Loading-state error sits in a single-line shell with no surrounding
            content; the polished ErrorCard format adds visual weight that
            distracts from the back-affordance. Keep the simple `<p>` for now
            and migrate when the loading state grows real layout. */}
        {error
          ? <p className="error">{error instanceof Error ? error.message : String(error)}</p>
          : <p className="hint">Loading…</p>}
      </section>
    );
  }

  const { negotiation: n, state } = view;
  const partyId = activeProfile.partyId;
  const isProvider = partyId === n.providerId;
  const isInsurer = partyId === n.insurerId;
  const isParty = isProvider || isInsurer;

  const canEngage = state === State.Open && isInsurer;
  const canAdjudicate = view.adjudicable && isParty;
  const ruled = view.ruled;
  const canAccept = ruled && isParty;
  const canAppeal = ruled && isParty;
  const canSubmitEvidence = state === State.EvidenceRequested && isProvider;
  const canSettle = ruled && view.bothAccepted && isParty;
  const canRefuse = isProvider && state !== State.Open && !view.terminal;
  const canWithdraw = isParty && !view.terminal;
  const canFeedback = !view.terminal && isParty;

  const lastRuled = [...timeline].reverse().find((e) => e.name === "Ruled");
  // SPEC-0006: "PolicyFlagged" removed; only "PolicyInvalidated" remains.
  const policyFlagged = [...timeline]
    .reverse()
    .find((e) => e.name === "PolicyInvalidated");
  const settled = [...timeline].reverse().find((e) => e.name === "Settled");
  const isVoided = state === State.PolicyInvalidated;

  const currentStep = STEPPER_STEPS.findIndex((s) => s.states.includes(state));
  const nextStep = getNextStep(state, isProvider, isInsurer);

  const DECISION_OPTIONS: readonly {
    d: Decision; label: string; hint: string; cls: string;
  }[] = [
    { d: Decision.Approve, label: "Approve", hint: "AI approves coverage at calculated amount", cls: "approve" },
    { d: Decision.Deny, label: "Deny", hint: "AI denies the coverage request", cls: "deny" },
    { d: Decision.NeedMoreEvidence, label: "Request Evidence", hint: "AI asks for more clinical data", cls: "evidence" },
    { d: Decision.PolicyInvalid, label: "Void Policy", hint: "AI detects a bad clause in the policy", cls: "void" },
  ];

  return (
    <section className="view detail">
      <div className="view-head">
        <button type="button" onClick={onBack}>← Back</button>
        <h1>Request #{reqId.toString()}</h1>
        <span className={`badge state s-${state}`} data-testid="state-badge">
          {FRIENDLY_STATE[state]}
        </span>
        <span className="role-label" data-testid="active-role">
          Acting as <strong>{activeProfile.label}</strong>
          {!isParty && " (read-only)"}
        </span>
      </div>

      <ol className="stepper" data-testid="state-stepper">
        {STEPPER_STEPS.map((step, i) => {
          const cls =
            i < currentStep ? "done" : i === currentStep ? "current" : "upcoming";
          return (
            <li key={step.label} className={`step ${cls}`}>
              <span className="dot" />
              <span className="step-label">
                {i === currentStep ? FRIENDLY_STATE[state] : step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {error !== null && error !== undefined && (
        <ErrorCard error={error} onDismiss={() => setError(null)} />
      )}

      <div className={`detail-grid${isInsurer ? " is-insurer" : ""}`}>
        {/* Request details */}
        <div className="card facts">
          <h2>Request Details</h2>
          <dl>
            <dt>Medication</dt>
            <dd><code title={n.drugRef}>{shortHex(n.drugRef)}</code></dd>
            <dt>Quantity</dt>
            <dd data-testid="fact-quantity">{n.quantity.toString()} units</dd>
            {n.daysSupply > 0n && (
              <>
                <dt>Days Supply</dt>
                <dd data-testid="fact-days-supply">{n.daysSupply.toString()} days</dd>
              </>
            )}
            <dt>Amount Requested</dt>
            <dd>{fmtAmount(n.requestedAmount)}</dd>
            <dt>Amount Covered</dt>
            <dd data-testid="covered-amount">
              {n.coveredAmount > 0n
                ? <strong className="ok-text">{fmtAmount(n.coveredAmount)}</strong>
                : "—"}
            </dd>
            <dt>AI Decision</dt>
            <dd data-testid="ruling-panel">
              {/* UnderReview takes priority over any prior ruling: after a
                  re-fire (submitEvidence / appeal) the negotiation is being
                  re-adjudicated, so the tag must read "AI reviewing…" live
                  rather than show the stale previous verdict. Order:
                  reviewing → settled verdict → awaiting-evidence → undecided. */}
              {state === State.UnderReview ? (
                <span className="muted">🤖 AI reviewing…</span>
              ) : lastRuled ? (
                <span className={lastRuled.decision === Decision.Approve ? "ok-text" : lastRuled.decision === Decision.Deny ? "bad" : ""}>
                  {decisionLabel(lastRuled.decision)}
                  {lastRuled.decision === Decision.Approve && <> · {fmtAmount(lastRuled.coveredAmount)} covered</>}
                </span>
              ) : state === State.EvidenceRequested ? (
                <span className="muted">⏳ Awaiting more evidence</span>
              ) : (
                "Not yet decided"
              )}
            </dd>
            <dt>Healthcare Provider</dt>
            <dd>
              {activeProfile.label}
              {n.providerAccepted && <span className="ok-text"> · accepted ✓</span>}
            </dd>
            <dt>Insurance Company</dt>
            <dd>
              {n.insurerAccepted
                ? <span className="ok-text">Accepted ✓</span>
                : "Pending"}
            </dd>
            <dt>Policy</dt>
            <dd>
              {policy && policy.policyHash !== ZERO_HASH
                ? <span className="ok-text">Attached ✓</span>
                : "Not yet attached"}
            </dd>
          </dl>

          <button
            type="button"
            className="proof-toggle"
            data-testid="proof-toggle"
            onClick={() => setShowProof((v) => !v)}
          >
            {showProof ? "▲ Hide" : "▼ View"} blockchain proof
          </button>
          {showProof && (
            <div className="proof-block">
              <dl>
                <dt>Justification hash</dt>
                <dd><code title={n.justificationHash}>{shortHex(n.justificationHash)}</code></dd>
                {policy && policy.policyHash !== ZERO_HASH && (
                  <>
                    <dt>Policy hash</dt>
                    <dd><code title={policy.policyHash}>{shortHex(policy.policyHash)}</code></dd>
                  </>
                )}
                <dt>Round</dt>
                <dd data-testid="round-counter">{n.round.toString()}</dd>
              </dl>
              <div className="verify">
                <label>
                  Verify justification (R3)
                  <textarea
                    data-testid="verify-note-input"
                    rows={2}
                    value={verifyText}
                    onChange={(e) => { setVerifyText(e.target.value); setVerifyResult(null); }}
                    placeholder="Paste the original justification text to confirm it matches the on-chain hash."
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
                      ? "✓ Matches the committed hash"
                      : "✗ Does not match"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card actions">
          {nextStep && isParty && (
            <div className="next-step" data-testid="next-step-banner">
              <span className="next-step-icon">→</span>
              {nextStep}
            </div>
          )}

          <h2>Actions</h2>

          {canEngage && (
            <div className="action">
              <p className="action-label">Choose a policy to attach:</p>
              <div className="policy-cards">
                {policiesForLine(n.payerLine).map((policy) => {
                  // SPEC-0005 R14: render one card per curated policy that
                  // targets this negotiation's payer line. Preserve the legacy
                  // testids on the corresponding canonical entries (the
                  // canonical compliant Part D formulary keeps the
                  // `engage-load-compliant` testid; the demo non-compliant
                  // policy keeps `engage-noncompliant-toggle`) so the existing
                  // harness keeps working unchanged.
                  const isBad = policy.clauses.some((c) => c.voids);
                  const legacyTestid =
                    policy.id === "partd-formulary-adalimumab"
                      ? "engage-load-compliant"
                      : policy.id === "demo-bad-adalimumab-noncompliant"
                        ? "engage-noncompliant-toggle"
                        : `engage-policy-${policy.id}`;
                  const selected = policyChoice === policy.id;
                  return (
                    <button
                      key={policy.id}
                      type="button"
                      data-testid={legacyTestid}
                      className={`policy-card ${isBad ? "noncompliant" : "compliant"}${selected ? " selected" : ""}`}
                      onClick={() => {
                        // Compose a single text body from the policy's
                        // name + clauses for the off-chain commit; the
                        // arbiter reads structured slices via R10 packets.
                        const body = renderCuratedPolicyText(policy);
                        setPolicyText(body);
                        setPolicyChoice(policy.id);
                        if (isBad) {
                          // Pre-steer the simulated AI: bad policy → AI
                          // asks for more evidence (R23 surfaces the
                          // voided-clause indices on Ruled).
                          setDecision(Decision.NeedMoreEvidence);
                          setNextDecision(Decision.NeedMoreEvidence);
                        }
                      }}
                    >
                      <span className="policy-card-icon">{isBad ? "⚠" : "✓"}</span>
                      <strong>{policy.name}</strong>
                      <p>{policy.summary}</p>
                    </button>
                  );
                })}
                {/* SPEC-0005 R15: free-text custom policy — the insurer can
                    compose their own policy at engage time. */}
                <button
                  type="button"
                  data-testid="engage-policy-custom"
                  className={`policy-card${policyChoice === "custom" ? " selected" : ""}`}
                  onClick={() => {
                    setPolicyChoice("custom");
                    // Compose the on-chain text from the current composer
                    // state (could be empty until the user types).
                    setPolicyText(buildCustomPolicyText(customName, customClauses));
                  }}
                >
                  <span className="policy-card-icon">✎</span>
                  <strong>Custom policy</strong>
                  <p>Compose your own policy: name + 1..N clauses, hashed and committed off-chain.</p>
                </button>
              </div>
              {/* SPEC-0005 R15: composer is visible when "custom" is selected;
                  edits stay in sync with policyText (and therefore the R16
                  hash preview below). */}
              {policyChoice === "custom" && (
                <div className="custom-policy-composer" data-testid="custom-policy-composer">
                  <label>
                    Policy name
                    <input
                      type="text"
                      data-testid="custom-policy-name"
                      value={customName}
                      onChange={(e) => {
                        const next = e.target.value;
                        setCustomName(next);
                        setPolicyText(buildCustomPolicyText(next, customClauses));
                      }}
                      placeholder="e.g. Plan-Z PA criteria for Drug X"
                    />
                  </label>
                  <label>
                    Clauses (one per line)
                    <textarea
                      data-testid="custom-policy-clauses"
                      rows={5}
                      value={customClauses}
                      onChange={(e) => {
                        const next = e.target.value;
                        setCustomClauses(next);
                        setPolicyText(buildCustomPolicyText(customName, next));
                      }}
                      placeholder={"Clause 1 body…\nClause 2 body…"}
                    />
                  </label>
                </div>
              )}
              {/* SPEC-0005 R16: read-only preview of the selected policy
                  before submit. Mirrors Create.tsx's .hash-preview pattern
                  so the insurer sees exactly what will be committed
                  on-chain (the keccak256 of the rendered text body). Works
                  for both curated AND custom selections. */}
              {policyChoice && (() => {
                let displayName: string;
                let displaySummary: string;
                let clauseCount: number;
                if (policyChoice === "custom") {
                  const lines = customClauses.split("\n").filter((l) => l.trim().length > 0);
                  displayName = customName.trim() || "Custom policy (unnamed)";
                  displaySummary = lines.length === 0
                    ? "No clauses yet — add at least one line below to enable Engage."
                    : `Custom composition with ${lines.length} clause${lines.length === 1 ? "" : "s"}.`;
                  clauseCount = lines.length;
                } else {
                  const chosen = policiesForLine(n.payerLine).find(
                    (p) => p.id === policyChoice,
                  );
                  if (!chosen) return null;
                  displayName = chosen.name;
                  displaySummary = chosen.summary;
                  clauseCount = chosen.clauses.length;
                }
                const previewHash = hashContent(policyText);
                return (
                  <div className="policy-preview" data-testid="policy-preview">
                    <div className="policy-preview-head">
                      <strong>{displayName}</strong>
                      <span className="policy-preview-clauses">
                        {clauseCount} clause{clauseCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="policy-preview-summary">{displaySummary}</p>
                    <div className="hash-preview">
                      <span className="hash-preview-chars">
                        {policyText.length} chars · stays in your wallet / agent
                      </span>
                      <code className="hash-preview-hash" title={previewHash}>
                        hash {shortHex(previewHash)}
                      </code>
                    </div>
                  </div>
                );
              })()}
              {policyChoice && (
                <button
                  type="button"
                  className="primary"
                  data-testid="engage-submit"
                  onClick={() => {
                    if (!policyText.trim()) { setError("Select a policy first."); return; }
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
                  Attach Policy &amp; Engage →
                </button>
              )}
              <textarea
                data-testid="engage-policy-text"
                style={{ display: "none" }}
                readOnly
                value={policyText}
              />
            </div>
          )}

          {canAdjudicate && (
            <div className="action">
              {client.wallet.mode === "simulated" && (
                <>
                  <p className="action-label">Choose simulated AI outcome:</p>
                  <div className="decision-options">
                    {DECISION_OPTIONS.map(({ d, label, hint, cls }) => (
                      <button
                        key={d}
                        type="button"
                        data-testid={`decision-${cls}`}
                        className={`decision-option ${cls}${decision === d ? " selected" : ""}`}
                        onClick={() => setDecision(d)}
                      >
                        <strong>{label}</strong>
                        <span>{hint}</span>
                      </button>
                    ))}
                  </div>
                  <p className="hint sim-note">
                    In production, the AI makes this determination automatically on-chain.
                  </p>
                </>
              )}
              <button
                type="button"
                className="primary"
                data-testid="adjudicate-submit"
                onClick={() => {
                  setNextDecision(decision);
                  void run(() => client.negotiation.requestAdjudication(reqId));
                }}
              >
                Request AI Decision →
              </button>
            </div>
          )}

          {canAccept && (
            <div className="action">
              <button
                type="button"
                className="primary"
                data-testid="accept-submit"
                onClick={() => void run(() => client.negotiation.accept(reqId, partyId))}
              >
                Accept Decision (as {isProvider ? "Provider" : "Insurer"})
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
                Finalize Settlement — {fmtAmount(n.coveredAmount)} covered
              </button>
            </div>
          )}

          {canAppeal && (
            <div className="action">
              <label>
                Appeal with new clinical evidence
                <textarea
                  data-testid="appeal-evidence"
                  rows={2}
                  value={appealEvidence}
                  onChange={(e) => setAppealEvidence(e.target.value)}
                  placeholder="Paste a public evidence URL (FDA, DailyMed, clinical guidelines…)"
                />
              </label>
              <button
                type="button"
                data-testid="appeal-submit"
                onClick={() => {
                  if (!appealEvidence.trim()) { setError("New evidence URL is required to appeal."); return; }
                  // A0009: pass the raw public URL — the contract re-scrapes it.
                  // The reason ref stays a hash (free text, may be PHI-adjacent).
                  void run(() =>
                    client.negotiation.appeal(
                      reqId, partyId,
                      appealEvidence.trim(),
                      hashContent(`reason:${appealEvidence}`),
                    ),
                  );
                  setAppealEvidence("");
                }}
              >
                Submit Appeal
              </button>
            </div>
          )}

          {canSubmitEvidence && (
            <div className="action">
              <div className="demo-hero" style={{ marginBottom: "0.75rem" }}>
                <div className="demo-hero-text">
                  <strong>Use the demo evidence</strong>
                  <span>
                    Phase 3 RCT proving Humira is FDA-indicated for this patient's condition
                  </span>
                </div>
                <button
                  type="button"
                  className="primary"
                  data-testid="load-demo-evidence"
                  onClick={() => setEvidenceText(SAMPLE_CASE.additionalEvidenceRef)}
                >
                  Load Demo Evidence →
                </button>
              </div>
              <label>
                Submit additional evidence
                <textarea
                  data-testid="evidence-text"
                  rows={3}
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  placeholder="Paste a public evidence URL or reference (PubMed, FDA, clinical guideline…)"
                />
              </label>
              <button
                type="button"
                className="primary"
                data-testid="evidence-submit"
                onClick={() => {
                  if (!evidenceText.trim()) { setError("A public evidence URL is required."); return; }
                  // A0009: pass the raw public URL — the contract re-scrapes it
                  // (replacing the original evidence source for the next ruling).
                  void run(() =>
                    client.negotiation.submitEvidence(reqId, evidenceText.trim()),
                  );
                  setEvidenceText("");
                }}
              >
                Submit Evidence →
              </button>
            </div>
          )}

          {canFeedback && (
            <div className="action">
              <label>
                Add a note (kept off-chain)
                <input
                  data-testid="feedback-text"
                  type="text"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Add a note to the conversation…"
                />
              </label>
              <button
                type="button"
                data-testid="feedback-submit"
                onClick={() => {
                  if (!feedback.trim()) { setError("Note text is required."); return; }
                  void run(async () => {
                    await client.negotiation.postFeedback(reqId, hashContent(feedback), ZERO_HASH);
                    setFeedback("");
                  });
                }}
              >
                Post Note
              </button>
            </div>
          )}

          {canRefuse && (
            <div className="action">
              <button
                type="button"
                className="danger"
                data-testid="refuse-submit"
                onClick={() => void run(() => client.negotiation.refuse(reqId, ZERO_HASH))}
              >
                Refuse Terms
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
                Withdraw Request
              </button>
            </div>
          )}

          {view.terminal && (
            <p className="hint">This request has reached a final state ({FRIENDLY_STATE[state]}).</p>
          )}
          {!isParty && (
            <p className="hint">
              You are viewing as <strong>{activeProfile.label}</strong> — switch to
              Provider or Insurer to take actions.
            </p>
          )}
        </div>
      </div>


      <PriceGauge requested={n.requestedAmount} basis={priceBasis} covered={n.coveredAmount} />

      {/* Policy voided explanation */}
      {isVoided && policyFlagged && (
        <div className="card gotcha" data-testid="gotcha-panel">
          <h2>⚠ Policy Voided — AI Detected a Non-Compliant Clause</h2>
          <p className="gotcha-explain">
            The insurance policy contained a clause that directly contradicts the
            FDA-approved indication for this medication. The AI refused to apply it
            and invalidated the policy — protecting the patient from unlawful coverage
            denials.
          </p>
          <div className="gotcha-cols">
            <div className="gotcha-col">
              <h3>Offending Policy Clause</h3>
              <p className="gotcha-clause" data-testid="gotcha-clause">
                {SAMPLE_CASE.nonCompliantPolicyText}
              </p>
            </div>
            <div className="gotcha-col">
              <h3>FDA-Approved Indication — {FDA_DRUG_LABEL}</h3>
              <p className="gotcha-fda" data-testid="gotcha-fda-citation">
                {FDA_INDICATION_TEXT}
              </p>
              <p className="hint">
                Source:{" "}
                <a href={FDA_LABEL_URL} target="_blank" rel="noreferrer">
                  openFDA HUMIRA label
                </a>{" "}
                (demo fixture)
              </p>
            </div>
          </div>
          <p className="hint gotcha-refs">
            On-chain evidence:{" "}
            <code title={policyFlagged.clauseRef}>{shortHex(policyFlagged.clauseRef)}</code>
            {policyFlagged.clauseRef === CLAUSE_REF ? " (clause PD-ADA-09)" : ""}
            {" · "}
            <code title={policyFlagged.standardRef}>{shortHex(policyFlagged.standardRef)}</code>
            {policyFlagged.standardRef === STANDARD_REF ? " (FDA HUMIRA indication)" : ""}
          </p>
        </div>
      )}

      <AppealLadder
        payerLine={n.payerLine}
        appealRound={n.appealRound}
      />

      <div className="card timeline" data-testid="timeline-card">
        <h2>Timeline (live)</h2>
        <ol data-testid="timeline">
          {timeline.length === 0 ? (
            <li className="empty">No events yet.</li>
          ) : (
            // Newest-first per prototype EventLog (screens.jsx:391).
            [...timeline].reverse().map((e, i) => (
              <li
                key={`${e.txHash ?? "noTx"}-${e.name}-${i}`}
                className={`ev-row tone-${eventTone(e.name)}`}
              >
                <div className="ev-row-head">
                  <span className="ev-name">
                    {FRIENDLY_EVENT[e.name] ?? e.name}
                  </span>
                </div>
                <div className="ev-desc">{describeEvent(e)}</div>
                <div className="ev-row-foot">
                  {e.txHash ? (
                    <a
                      className="ev-tx-chip"
                      href={txUrl(SOMNIA_TESTNET, e.txHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortHex(e.txHash)}
                    </a>
                  ) : (
                    <span className="ev-tx-chip is-empty">no tx</span>
                  )}
                  <span className="ev-attr">{eventAttribution(e)}</span>
                </div>
              </li>
            ))
          )}
        </ol>
      </div>
    </section>
  );
}

/** Human-readable label for a {@link Decision} value (used in the rationale card). */
function decisionLabel(d: Decision): string {
  switch (d) {
    case Decision.Approve: return "Approved";
    case Decision.Deny: return "Denied";
    case Decision.NeedMoreEvidence: return "More Evidence Needed";
    case Decision.PolicyInvalid: return "Policy Voided";
    default: return "Unknown";
  }
}

function VerifyOnChain({ event }: { readonly event: CoverageEvent }) {
  const hashes: { readonly label: string; readonly value: string }[] = [];
  // SPEC-0006 R24: Ruled event no longer carries rationaleHash / clauseRef /
  // receiptId — those are now in RulingRationale (separate event). Only show
  // hashes for events that still carry them.
  if (event.name === "PolicyInvalidated") {
    hashes.push({ label: "clause", value: event.clauseRef });
    hashes.push({ label: "standard", value: event.standardRef });
  }
  return (
    <div className="verify-onchain" data-testid="verify-onchain">
      {event.txHash ? (
        <>
          <a href={txUrl(SOMNIA_TESTNET, event.txHash)} target="_blank" rel="noreferrer" data-testid="verify-onchain-link">
            View on Somnia Explorer ↗
          </a>
        </>
      ) : (
        <div className="sim-verify">
          {hashes.map((h) => (
            <span key={h.label} className="hint">
              {h.label}: <code title={h.value}>{shortHex(h.value)}</code>
            </span>
          ))}
          <span className="hint sim-note">(simulated — no live transaction)</span>
        </div>
      )}
    </div>
  );
}

function PriceGauge({
  requested, basis, covered,
}: {
  readonly requested: bigint;
  readonly basis: PriceBasis | null;
  readonly covered: bigint;
}) {
  const bars: { readonly label: string; readonly value: bigint; readonly cls: string }[] =
    basis
      ? [
          { label: "Requested", value: basis.requestedAmount, cls: "requested" },
          { label: "NADAC Floor", value: basis.nadacFloorTotal, cls: "nadac" },
          { label: "Cost Plus Cap", value: basis.costPlusTotal, cls: "costplus" },
          { label: "AI Covered", value: basis.coveredAmount, cls: "covered" },
        ]
      : [{ label: "Requested", value: requested, cls: "requested" }];

  const max = bars.reduce((m, b) => (b.value > m ? b.value : m), 1n);
  const pct = (v: bigint): number => (max > 0n ? Number((v * 1000n) / max) / 10 : 0);
  const coveredVal = basis ? basis.coveredAmount : covered;

  return (
    <div className="card price-gauge" data-testid="price-gauge">
      <h2>Price Comparison</h2>
      {bars.map((b) => (
        <div key={b.label} className="gauge-row">
          <span className="gauge-label">{b.label}</span>
          <span className="gauge-track">
            <span className={`gauge-bar ${b.cls}`} style={{ width: `${pct(b.value)}%` }} />
          </span>
          <span className="gauge-value">{fmtAmount(b.value)}</span>
        </div>
      ))}
      {basis ? (
        <p className="hint">
          AI covered = min(requested, Cost Plus cap) = <strong>{fmtAmount(coveredVal)}</strong>.
          NADAC is the acquisition-cost reference floor.
        </p>
      ) : (
        <p className="hint">
          Cost Plus cap and NADAC floor will appear after the AI issues its decision.
        </p>
      )}
    </div>
  );
}
