// ─── Curie visuals — calm, light-mode presentation components ──────────
const { useState, useEffect, useRef } = React;

/* ── State pill ─────────────────────────────────────────────────────── */
function StatePill({ state, size }) {
  const meta = STATES[state] || { color: "var(--fg-mute)", label: state };
  return (
    <span className="pill" style={{ color: meta.color, fontSize: size === "lg" ? 13 : 12, padding: size === "lg" ? "5px 13px 5px 11px" : undefined }}>
      {meta.label}
    </span>
  );
}

/* ── Decision badge ─────────────────────────────────────────────────── */
function DecisionBadge({ decision }) {
  const meta = DECISIONS[decision];
  if (!meta) return null;
  return <span className="pill no-dot" style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>;
}

/* ── Flow stepper — the 5 milestones a request walks ────────────────── */
function FlowStepper({ state }) {
  const meta = STATES[state] || { step: 0, color: "var(--accent)" };
  const reached = meta.step;
  const terminalBad = ["Denied", "Deadlocked", "PolicyInvalidated", "ProviderRefused", "Withdrawn"].includes(state);

  // dynamic labels for the last two nodes
  const labels = [...FLOW_STEPS];
  if (state === "Approved") labels[3] = "Approved";
  if (state === "Denied") labels[3] = "Denied";
  if (state === "PolicyInvalidated") labels[3] = "Policy voided";
  if (state === "Settled") { labels[3] = "Decision"; labels[4] = "Settled"; }
  if (state === "Deadlocked") labels[4] = "Deadlocked";
  if (state === "ProviderRefused") labels[4] = "Refused";
  if (state === "Withdrawn") labels[4] = "Withdrawn";

  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {labels.map((lab, i) => {
        const done = i < reached;
        const current = i === reached;
        const isBadNode = current && terminalBad;
        const dotColor = isBadNode ? meta.color : (done || current ? "var(--accent)" : "var(--bg-2)");
        const ringColor = isBadNode ? meta.color : "var(--accent)";
        return (
          <React.Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, flex: "0 0 auto", width: 96, textAlign: "center" }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: done ? "var(--accent)" : (current ? "#fff" : "var(--bg-2)"),
                border: `2px solid ${done || current ? ringColor : "var(--line-strong)"}`,
                color: done ? "#fff" : ringColor,
                fontSize: 12, fontWeight: 700,
                boxShadow: current && state === "UnderReview" ? "0 0 0 5px color-mix(in srgb, var(--accent) 14%, transparent)" : "none",
              }}>
                {done ? "✓" : (isBadNode ? "!" : i + 1)}
              </div>
              <span style={{
                fontSize: 11.5, lineHeight: 1.25,
                fontWeight: current ? 600 : 500,
                color: current ? (isBadNode ? meta.color : "var(--fg)") : (done ? "var(--fg-soft)" : "var(--fg-dim)"),
              }}>{lab}</span>
            </div>
            {i < labels.length - 1 && (
              <div style={{ flex: 1, height: 2, marginTop: 11, borderRadius: 2, minWidth: 18,
                background: i < reached ? "var(--accent)" : "var(--line-strong)" }}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Price comparison — deterministic cap, calm horizontal bars ─────── */
function PriceComparison({ requested, costPlusCap, nadacFloor, covered, decision }) {
  const max = Math.max(requested, costPlusCap, nadacFloor, covered || 0) * 1.02;
  const ruled = decision && decision !== "need_more_evidence";
  const approved = decision === "approve";

  const rows = [
    { key: "req",   label: "Requested",      sub: "billed by provider",        value: requested,   color: "var(--fg)",          track: "var(--bg-inset)" },
    { key: "cap",   label: "Cost Plus cap",  sub: "binding benchmark",          value: costPlusCap, color: "var(--accent)",      track: "var(--accent-tint)", mark: true },
    { key: "floor", label: "NADAC floor",    sub: "acquisition-cost reference", value: nadacFloor,  color: "var(--fg-mute)",     track: "var(--bg-inset)" },
  ];
  if (ruled) rows.push({ key: "cov", label: "Covered", sub: approved ? "min(requested, cap)" : "ruled $0", value: covered || 0, color: approved ? "var(--state-approved)" : "var(--state-denied)", track: approved ? "color-mix(in srgb, var(--state-approved) 12%, transparent)" : "var(--bg-inset)", strong: true });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rows.map(r => (
        <div key={r.key} style={{ display: "grid", gridTemplateColumns: "150px 1fr 96px", gap: 14, alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: r.strong ? 700 : 600, color: r.strong ? r.color : "var(--fg)", display: "flex", alignItems: "center", gap: 7 }}>
              {r.label}
              {r.mark && <span className="caption" style={{ fontSize: 10, color: "var(--accent-deep)", background: "var(--accent-tint)", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>cap</span>}
            </div>
            <div className="caption" style={{ fontSize: 11.5, marginTop: 1 }}>{r.sub}</div>
          </div>
          <div style={{ height: 14, borderRadius: 7, background: r.track, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, width: `${Math.max(2, (r.value / max) * 100)}%`,
              background: r.color, borderRadius: 7, opacity: r.strong ? 1 : 0.82, transition: "width .5s ease" }}/>
          </div>
          <div className="tabular mono" style={{ fontSize: 14, fontWeight: r.strong ? 700 : 500, textAlign: "right", color: r.strong ? r.color : "var(--fg)" }}>
            {money(r.value)}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4, padding: "10px 12px", background: "var(--bg-2)", borderRadius: 8, border: "1px solid var(--line)" }}>
        <span style={{ color: "var(--accent)", fontSize: 13, lineHeight: 1.4 }}>ƒ</span>
        <span style={{ fontSize: 12.5, color: "var(--fg-soft)", lineHeight: 1.5 }}>
          Covered is <strong style={{ color: "var(--fg)" }}>deterministic</strong>, never AI-chosen:&nbsp;
          <span className="mono" style={{ fontSize: 12 }}>min(requested, Cost&nbsp;Plus&nbsp;cap)</span>. NADAC is the acquisition-cost floor — a request below it is flagged.
        </span>
      </div>
    </div>
  );
}

/* ── Mini benchmark sparkline (overview row) ────────────────────────── */
function MiniBenchmark({ requested, costPlusCap, nadacFloor, covered, decision }) {
  const max = Math.max(requested, costPlusCap, nadacFloor, covered || 0);
  const pct = v => `${Math.min(100, (v / max) * 100)}%`;
  const approved = decision === "approve";
  return (
    <span style={{ position: "relative", display: "block", height: 20 }}>
      <span style={{ position: "absolute", left: 0, right: 0, top: 9, height: 2, background: "var(--line-strong)", borderRadius: 2 }}/>
      {/* cap band start→cap */}
      <span style={{ position: "absolute", left: pct(nadacFloor), width: `calc(${pct(costPlusCap)} - ${pct(nadacFloor)})`, top: 8, height: 4, background: "var(--accent-soft)", borderRadius: 2 }}/>
      {/* nadac floor tick */}
      <span title="NADAC floor" style={{ position: "absolute", left: pct(nadacFloor), top: 6, width: 2, height: 8, background: "var(--fg-dim)", transform: "translateX(-50%)" }}/>
      {/* cost plus cap tick */}
      <span title="Cost Plus cap" style={{ position: "absolute", left: pct(costPlusCap), top: 5, width: 2, height: 10, background: "var(--accent)", transform: "translateX(-50%)" }}/>
      {/* requested marker */}
      <span title="Requested" style={{ position: "absolute", left: pct(requested), top: 6, width: 2, height: 8, background: "var(--fg)", transform: "translateX(-50%)" }}/>
      {/* covered dot */}
      {covered != null && (
        <span title="Covered" style={{ position: "absolute", left: pct(covered || 0.5), top: 5, width: 9, height: 9, borderRadius: "50%", background: approved ? "var(--state-approved)" : "var(--state-denied)", border: "2px solid var(--bg-1)", transform: "translateX(-50%)" }}/>
      )}
    </span>
  );
}

/* ── Evidence reference list (with provenance source labels) ────────── */
function EvidenceList({ items, highlight }) {
  if (!items || items.length === 0) return <div className="caption">No public references in the packet.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map(e => {
        const hot = highlight && highlight.includes(e.idx);
        return (
          <div key={e.idx} style={{
            border: `1px solid ${hot ? "color-mix(in srgb, var(--accent) 38%, transparent)" : "var(--line)"}`,
            background: hot ? "var(--accent-tint)" : "var(--bg-2)",
            borderRadius: 9, padding: "11px 13px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-deep)", background: "#fff", border: "1px solid var(--line-strong)", borderRadius: 5, padding: "1px 7px" }}>{e.source}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>{e.label}</span>
              {hot && <span className="caption" style={{ color: "var(--accent-deep)", fontSize: 11 }}>cited by ruling</span>}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-soft)", lineHeight: 1.5 }}>{e.slice}</div>
            <div style={{ marginTop: 7, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-mute)" }}>{e.url}</span>
              <span className="hash" style={{ fontSize: 10.5, padding: "1px 6px" }}>{e.hash}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── AI Decision panel — reasoning, cited clause, receipt ───────────── */
function AiDecision({ r }) {
  const reviewing = r.state === "UnderReview";

  if (reviewing) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span className="live-dot" style={{ background: "var(--state-review)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--state-review) 18%, transparent)" }}/>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>Arbiter agent-7B is ruling — round {r.round}</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--fg-soft)", lineHeight: 1.55, margin: "0 0 16px" }}>
          The frozen evidence packet, the de-identified note hash, and the attached policy are with the validator-run agent.
          Exactly one ruling per round — the agent cannot fetch new sources mid-ruling.
        </p>
        <div className="label-sm" style={{ marginBottom: 10 }}>What the agent is seeing · {r.evidence.length} references</div>
        <EvidenceList items={r.evidence}/>
      </div>
    );
  }

  if (!r.decision) {
    return <div style={{ fontSize: 14, color: "var(--fg-mute)" }}>No ruling yet — attach a policy and request AI arbitration to begin.</div>;
  }

  const meta = DECISIONS[r.decision];
  const approved = r.decision === "approve";
  const isVoid = r.decision === "policy_invalid";

  return (
    <div>
      {/* decision header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <DecisionBadge decision={r.decision}/>
        {approved && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="figure" style={{ fontSize: 34, color: "var(--state-approved)" }}>{money(r.covered)}</span>
            <span className="caption">covered</span>
          </div>
        )}
        {r.decision === "deny" && <span className="figure" style={{ fontSize: 30, color: "var(--state-denied)" }}>$0</span>}
      </div>

      {/* policy-void gotcha */}
      {isVoid && r.fdaStandard && (
        <div style={{ border: "1px solid color-mix(in srgb, var(--state-policy) 32%, transparent)", background: "color-mix(in srgb, var(--state-policy) 7%, transparent)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div className="label-sm" style={{ color: "var(--state-policy)", marginBottom: 9 }}>Why it was voided</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div>
              <span className="caption" style={{ display: "block", marginBottom: 3 }}>Relied-on policy clause {r.citedClause}</span>
              <span className="struck" style={{ fontSize: 13.5 }}>{r.policy.clause}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: "var(--state-policy)", fontWeight: 700, lineHeight: 1.4 }}>↳</span>
              <div>
                <span className="caption" style={{ display: "block", marginBottom: 3, color: "var(--state-approved)" }}>contradicts · {r.fdaStandard.label}</span>
                <span style={{ fontSize: 13.5, color: "var(--fg)" }}>{r.fdaStandard.quote}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* plain-language rationale */}
      <p style={{ fontSize: 13.5, color: "var(--fg)", lineHeight: 1.6, margin: "0 0 14px" }}>{r.rationale}</p>

      {/* cited clause */}
      {r.policy?.clause && !isVoid && (
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "11px 13px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 9, marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-deep)", background: "#fff", border: "1px solid var(--line-strong)", borderRadius: 5, padding: "1px 7px", whiteSpace: "nowrap" }}>Cites {r.citedClause}</span>
          <span style={{ fontSize: 12.5, color: "var(--fg-soft)", lineHeight: 1.5 }}>{r.policy.clause}</span>
        </div>
      )}

      {/* cited references */}
      {r.citedRefs && r.citedRefs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="label-sm" style={{ marginBottom: 10 }}>Cited references</div>
          <EvidenceList items={r.evidence.filter(e => r.citedRefs.includes(e.idx))} highlight={r.citedRefs}/>
        </div>
      )}

      {/* receipt */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 13, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="caption">receipt</span>
          <span className="hash">{r.receiptId}</span>
          <span className="caption">reasoning</span>
          <span className="hash">{r.reasoningHash}</span>
        </div>
        <button className="btn btn-soft btn-sm">View on explorer ↗</button>
      </div>
    </div>
  );
}

/* ── Live tx stream (network monitor) ───────────────────────────────── */
function TxStream({ animation = "subtle" }) {
  const [events, setEvents] = useState(() => TX_EVENTS_SEED.map((e, i) => ({ ...e, key: i, tx: fakeTx() })));

  useEffect(() => {
    if (animation === "none") return;
    const id = setInterval(() => {
      setEvents(prev => [{ ...makeRandomEvent(), key: Date.now(), tx: fakeTx() }, ...prev].slice(0, 16));
    }, animation === "lively" ? 2000 : 3600);
    return () => clearInterval(id);
  }, [animation]);

  return (
    <div className="row-list" style={{ fontSize: 12.5 }}>
      {events.map(e => {
        const meta = EVENT_META[e.kind] || { label: e.kind, color: "var(--accent)" };
        return (
          <div key={e.key} className="tx-row" style={{ display: "grid", gridTemplateColumns: "150px 130px 1fr 64px 56px", gap: 14, padding: "11px 18px", alignItems: "center" }}>
            <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
            <span className="hash" style={{ padding: "2px 7px" }}>{e.tx}</span>
            <span style={{ color: "var(--fg-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.msg}</span>
            <span className="caption" style={{ color: "var(--fg-mute)" }}>req #{e.reqId}</span>
            <span className="caption" style={{ color: "var(--fg-mute)", textAlign: "right" }}>{e.t === -1 ? "now" : relTime(e.t)}</span>
          </div>
        );
      })}
    </div>
  );
}

function fakeTx() {
  const hex = "0123456789abcdef";
  let a = "", b = "";
  for (let i = 0; i < 4; i++) a += hex[Math.floor(Math.random() * 16)];
  for (let i = 0; i < 4; i++) b += hex[Math.floor(Math.random() * 16)];
  return `0x${a}…${b}`;
}
function makeRandomEvent() {
  const kinds = ["Filed", "InsurerEngaged", "AdjudicationRequested", "Ruled", "EvidenceRequested", "Accepted", "Settled"];
  const k = kinds[Math.floor(Math.random() * kinds.length)];
  const reqId = [8, 7, 6, 5, 9][Math.floor(Math.random() * 5)];
  const msgs = {
    Filed: "provider 1 → insurer 2",
    InsurerEngaged: "policy attached",
    AdjudicationRequested: "fired arbiter · 0.33 STT escrowed",
    Ruled: `approve · cites §${Math.floor(Math.random()*6)+1}.${Math.floor(Math.random()*9)+1}`,
    EvidenceRequested: "arbiter requested a public reference",
    Accepted: "party accepted the ruling",
    Settled: "fee split 50/50 · marker",
  };
  return { kind: k, reqId, msg: msgs[k], t: -1 };
}

Object.assign(window, {
  StatePill, DecisionBadge, FlowStepper, PriceComparison, MiniBenchmark, EvidenceList, AiDecision, TxStream,
});
