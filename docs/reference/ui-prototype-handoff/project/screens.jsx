// ─── Curie screens ─────────────────────────────────────────────────────
const { useState: useS, useEffect: useE, useMemo: useM } = React;

/* ── shared helpers ─────────────────────────────────────────────────── */
function PageHeader({ eyebrow, title, sub, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "34px 0 22px", marginBottom: 26, gap: 24, borderBottom: "1px solid var(--line)" }}>
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 12 }}>{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <div style={{ color: "var(--fg-soft)", fontSize: 14.5, maxWidth: 660, marginTop: 9, lineHeight: 1.55 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>{right}</div>
    </div>
  );
}

function FactRow({ label, value, last }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 16, padding: "9px 0", borderBottom: last ? "none" : "1px solid var(--line)", alignItems: "center" }}>
      <span className="caption" style={{ color: "var(--fg-mute)" }}>{label}</span>
      <span style={{ fontSize: 13.5, color: "var(--fg)" }}>{value}</span>
    </div>
  );
}

function SectionLabel({ children, style }) {
  return <div className="label-sm" style={{ marginBottom: 16, ...style }}>{children}</div>;
}

function CostHint({ escrow, label }) {
  const gas = GAS_TYPICAL;
  const total = (escrow || 0) + gas;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--fg-mute)", marginTop: 8 }}>
      <span style={{ color: "var(--accent-deep)" }}>≈ {total.toFixed(5)} STT</span>
      <span>·</span>
      {escrow ? <span>{escrow.toFixed(2)} agent escrow + {gas} gas</span> : <span>gas only</span>}
      {label && <><span>·</span><span>{label}</span></>}
    </div>
  );
}

/* ════════════════════════════ OVERVIEW ═══════════════════════════════ */
function OverviewScreen({ go, profile }) {
  const [filter, setFilter] = useS("all");
  const fmap = {
    all: () => true,
    open: r => ["Open"].includes(r.state),
    active: r => ["Ready", "UnderReview", "EvidenceRequested", "Approved"].includes(r.state),
    settled: r => r.state === "Settled",
    closed: r => ["Deadlocked", "Withdrawn", "PolicyInvalidated", "ProviderRefused", "Denied"].includes(r.state),
  };
  const filterLabels = { all: "All", open: "Open", active: "In negotiation", settled: "Settled", closed: "Closed" };
  const filtered = REQUESTS.filter(fmap[filter]);

  const counts = REQUESTS.reduce((a, r) => {
    a.total++;
    if (["UnderReview", "EvidenceRequested", "Ready", "Open", "Approved"].includes(r.state)) a.active++;
    if (r.state === "Settled") a.settled++;
    if (r.covered != null && r.decision === "approve") a.saved += (r.requested - r.covered);
    return a;
  }, { total: 0, active: 0, settled: 0, saved: 0 });

  const kpis = [
    { label: "Total requests", value: counts.total,  sub: "across all profiles" },
    { label: "In negotiation", value: counts.active,  sub: "before a terminal state", color: "var(--state-review)" },
    { label: "Settled",        value: counts.settled, sub: "both parties accepted",   color: "var(--state-approved)" },
    { label: "Capped vs ask",  value: money(counts.saved), sub: "requested − covered", color: "var(--accent)" },
  ];

  return (
    <div data-screen-label="01 Overview">
      <PageHeader
        eyebrow="Coverage-exception requests"
        title="Negotiations in flight"
        sub="Every position, ruling, and appeal is recorded on a ledger neither party controls. Clinical justifications stay off-chain — only a hash is committed."
        right={<>
          <button className="btn btn-ghost" onClick={() => go("network")}><span className="live-dot"/> Network</button>
          <button className="btn btn-primary" onClick={() => go("file")} disabled={profile === "observer"}>＋ New request</button>
        </>}
      />

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 26 }}>
        {kpis.map((k, i) => (
          <div key={i} className="panel" style={{ padding: "18px 20px" }}>
            <div className="caption" style={{ color: "var(--fg-mute)" }}>{k.label}</div>
            <div className="figure" style={{ fontSize: 32, marginTop: 9, color: k.color || "var(--fg)" }}>{k.value}</div>
            <div className="caption" style={{ fontSize: 11.5, marginTop: 6, color: "var(--fg-dim)" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        {Object.keys(fmap).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            fontSize: 12.5, fontWeight: 600, padding: "6px 13px", borderRadius: 999,
            border: `1px solid ${filter === f ? "transparent" : "var(--line-strong)"}`,
            color: filter === f ? "#fff" : "var(--fg-soft)",
            background: filter === f ? "var(--accent)" : "var(--bg-1)",
            boxShadow: "var(--shadow-sm)", transition: "all .14s ease",
          }}>
            {filterLabels[f]} <span style={{ opacity: 0.66, marginLeft: 3 }}>{REQUESTS.filter(fmap[f]).length}</span>
          </button>
        ))}
        <div style={{ flex: 1 }}/>
        <span className="caption" style={{ color: "var(--fg-mute)" }}>{filtered.length} of {REQUESTS.length}</span>
      </div>

      {/* table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "52px 1.7fr 1.25fr 1.15fr 0.95fr 0.95fr 1.1fr 56px", gap: 14, padding: "13px 18px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
          {["Req", "Medication", "Status", "Appeal stage", "Requested", "Covered", "Benchmark", "Round"].map((h, i) => (
            <span key={h} className="label-sm" style={{ marginBottom: 0, textAlign: i >= 7 ? "right" : "left" }}>{h}</span>
          ))}
        </div>
        <div className="row-list">
          {filtered.map(r => <RequestRow key={r.id} r={r} go={go}/>)}
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--fg-mute)" }}>No requests in this view.</div>}
        </div>
      </div>
    </div>
  );
}

function RequestRow({ r, go }) {
  const stage = stageOf(r.payerLine, r.appealRound);
  return (
    <div className="row" onClick={() => go("detail", r.id)} style={{ gridTemplateColumns: "52px 1.7fr 1.25fr 1.15fr 0.95fr 0.95fr 1.1fr 56px" }}>
      <span className="mono" style={{ color: "var(--fg-mute)", fontSize: 13 }}>#{r.id}</span>
      <span style={{ minWidth: 0 }}>
        <div style={{ color: "var(--fg)", fontWeight: 600, fontSize: 13.5 }}>{r.drug} <span style={{ color: "var(--fg-mute)", fontWeight: 400 }}>{r.brand}</span></div>
        <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
          <span className="hash" style={{ fontSize: 10.5, padding: "1px 6px" }}>{r.drugRef}</span>
          {!r.policy.attached && r.state === "Open" && <span className="caption" style={{ color: "var(--state-policy)", fontSize: 11 }}>no policy</span>}
        </div>
      </span>
      <span><StatePill state={r.state}/></span>
      <span style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "var(--fg-soft)" }}>{stage.name}</div>
        <div className="caption" style={{ fontSize: 10.5, color: "var(--fg-dim)" }}>{r.payerLine === "PartD" ? "Part D" : r.payerLine}</div>
      </span>
      <span className="mono tabular" style={{ color: "var(--fg)", fontSize: 13 }}>{money(r.requested)}</span>
      <span className="mono tabular" style={{ fontSize: 13, color: r.covered != null ? (r.decision === "approve" ? "var(--state-approved)" : (r.decision === "deny" ? "var(--state-denied)" : "var(--fg)")) : "var(--fg-dim)" }}>
        {r.covered != null ? money(r.covered) : "—"}
      </span>
      <span style={{ paddingRight: 8 }}>
        <MiniBenchmark requested={r.requested} costPlusCap={r.costPlusCap} nadacFloor={r.nadacFloor} covered={r.covered} decision={r.decision}/>
      </span>
      <span className="mono tabular" style={{ textAlign: "right", color: "var(--fg-mute)", fontSize: 13 }}>{r.round}/{r.maxRounds}</span>
    </div>
  );
}

/* ════════════════════════════ DETAIL ═════════════════════════════════ */
function RequestDetailScreen({ id, go, profile }) {
  const r = REQUESTS.find(x => x.id === id);
  if (!r) return <div style={{ padding: 60 }}>Request not found.</div>;
  const p = PROFILES[profile];
  const stage = stageOf(r.payerLine, r.appealRound);

  return (
    <div data-screen-label="02 Request detail" className="fade-up">
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "28px 0 18px", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("overview")}>← Back</button>
        <h2 style={{ margin: 0 }}>Request #{r.id}</h2>
        <StatePill state={r.state} size="lg"/>
        <div style={{ flex: 1 }}/>
        <span className="pill no-dot" style={{ color: "var(--fg-soft)", background: "var(--bg-2)", borderColor: "var(--line-strong)" }}>
          Acting as <strong style={{ marginLeft: 4, color: "var(--accent-deep)" }}>{p.label}</strong>{profile === "observer" ? " (read-only)" : ""}
        </span>
      </div>

      <div style={{ display: "flex", gap: 18, color: "var(--fg-mute)", fontSize: 13, marginBottom: 22, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "var(--fg)", fontWeight: 600, fontSize: 15 }}>{r.drug} <span style={{ color: "var(--fg-mute)", fontWeight: 400 }}>{r.brand}</span></span>
        <span>{r.rxnorm}</span><span>·</span>
        <span>{r.quantity} units · {r.daysSupply} days</span><span>·</span>
        <span>Filed {relTime((r.fileTs - Date.now()) / 60000)}</span><span>·</span>
        <span>{r.provider.label} → {r.insurer.label}</span>
      </div>

      {/* stepper */}
      <div className="panel" style={{ marginBottom: 18, padding: "22px 26px" }}>
        <FlowStepper state={r.state}/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* request details */}
        <div className="panel">
          <SectionLabel>Request details · on chain</SectionLabel>
          <FactRow label="Medication" value={<span style={{ fontWeight: 600 }}>{r.drug} <span style={{ color: "var(--fg-mute)", fontWeight: 400 }}>{r.brand}</span></span>}/>
          <FactRow label="Identity" value={<span className="mono" style={{ fontSize: 12 }}>{r.rxnorm} · {r.ndc}</span>}/>
          <FactRow label="drugRef" value={<span className="hash">{r.drugRef}</span>}/>
          <FactRow label="justification" value={<span className="hash">{r.justificationHash}</span>}/>
          <FactRow label="Quantity" value={<span className="mono">{r.quantity} units · {r.daysSupply} days</span>}/>
          <FactRow label="Requested" value={<span className="mono tabular">{money(r.requested)}</span>}/>
          <FactRow label="Covered" value={r.covered != null
            ? <span className="mono tabular" style={{ color: r.decision === "approve" ? "var(--state-approved)" : "var(--fg)", fontWeight: 600 }}>{money(r.covered)}</span>
            : <span className="mono" style={{ color: "var(--fg-dim)" }}>—</span>}/>
          <FactRow label="Provider" value={<><strong>{r.provider.label}</strong> <span className="hash" style={{ marginLeft: 6 }}>{r.provider.address}</span></>}/>
          <FactRow label="Insurer" value={r.policy.attached
            ? <><strong>{r.insurer.label}</strong> <span className="hash" style={{ marginLeft: 6 }}>{r.insurer.address}</span></>
            : <span style={{ color: "var(--fg-mute)" }}>pending engagement</span>}/>
          <FactRow label="Policy" last value={
            r.policy.attached
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ color: "var(--state-approved)" }}>● attached</span><span style={{ color: "var(--fg-soft)" }}>{r.policy.name}</span></span>
              : (profile === "insurer"
                  ? <button className="btn btn-soft btn-sm" onClick={() => go("policy", r.id)}>Attach policy →</button>
                  : <span style={{ color: "var(--state-policy)" }}>— not attached</span>)
          }/>
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 14 }}>
            <SectionLabel style={{ marginBottom: 9 }}>Verify your justification copy</SectionLabel>
            <textarea placeholder="Paste your off-chain justification to confirm its keccak256 matches the on-chain hash." rows={2}/>
            <button className="btn" style={{ width: "100%", marginTop: 10 }}>Verify hash</button>
          </div>
        </div>

        {/* AI decision */}
        <div className="panel" style={{ borderColor: r.state === "UnderReview" ? "color-mix(in srgb, var(--state-review) 32%, transparent)" : "var(--line)" }}>
          <SectionLabel>AI decision · necessity arbiter</SectionLabel>
          <AiDecision r={r}/>
        </div>

        {/* price comparison */}
        <div className="panel" style={{ gridColumn: "1 / -1" }}>
          <SectionLabel>Price comparison</SectionLabel>
          <PriceComparison requested={r.requested} costPlusCap={r.costPlusCap} nadacFloor={r.nadacFloor} covered={r.covered} decision={r.decision}/>
        </div>

        {/* appeal ladder */}
        <div className="panel" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <SectionLabel style={{ marginBottom: 0 }}>Appeal ladder · {r.payerLine === "PartD" ? "Medicare Part D" : r.payerLine}</SectionLabel>
            <span className="caption">
              currently at <strong style={{ color: "var(--accent-deep)" }}>{stage.name}</strong>
              {stage.window && <> · file within {stage.window}</>}
              {stage.threshold && <> · {stage.threshold}</>}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {LADDERS[r.payerLine].map((s, i) => {
              const isCur = i === r.appealRound;
              const passed = i < r.appealRound;
              return (
                <div key={i} style={{
                  flex: "1 1 0", minWidth: 130, padding: "11px 13px", borderRadius: 9,
                  border: `1px solid ${isCur ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--line)"}`,
                  background: isCur ? "var(--accent-tint)" : (passed ? "var(--bg-2)" : "var(--bg-1)"),
                  opacity: (!isCur && !passed && i > r.appealRound + 1) ? 0.6 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
                      background: passed ? "var(--accent)" : (isCur ? "#fff" : "var(--bg-inset)"),
                      border: `1.5px solid ${isCur || passed ? "var(--accent)" : "var(--line-strong)"}`,
                      color: passed ? "#fff" : (isCur ? "var(--accent-deep)" : "var(--fg-mute)") }}>{passed ? "✓" : i}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: isCur ? "var(--accent-deep)" : "var(--fg)" }}>{s.name}</span>
                  </div>
                  <div className="caption" style={{ fontSize: 11, color: "var(--fg-mute)" }}>{s.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* actions + event log */}
        <div className="panel">
          <SectionLabel>Actions</SectionLabel>
          <ActionPanel r={r} profile={profile} go={go}/>
        </div>

        <div className="panel">
          <SectionLabel>Timeline · this contract</SectionLabel>
          <EventLog events={r.events}/>
        </div>
      </div>
    </div>
  );
}

/* ── action panel — gated by role + state ───────────────────────────── */
function ActionPanel({ r, profile, go }) {
  const [note, setNote] = useS("");

  if (profile === "observer") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ padding: "14px 15px", background: "var(--bg-2)", borderRadius: 9, border: "1px solid var(--line)", fontSize: 13, color: "var(--fg-soft)", lineHeight: 1.5 }}>
          You are viewing as <strong style={{ color: "var(--fg)" }}>Observer</strong> — every action is disabled. Reads are public; switch to Provider or Insurer to act. A third, unrelated wallet would be rejected on chain.
        </div>
      </div>
    );
  }

  const ruled = ["Approved", "Denied"].includes(r.state);
  const terminal = ["Settled", "Deadlocked", "PolicyInvalidated", "ProviderRefused", "Withdrawn"].includes(r.state);
  const isProvider = profile === "provider";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* context line */}
      <div style={{ padding: "11px 13px", background: "var(--accent-tint)", borderRadius: 9, border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)", fontSize: 12.5, color: "var(--accent-deep)", lineHeight: 1.45 }}>
        → {contextNote(r, profile)}
      </div>

      {/* OPEN */}
      {r.state === "Open" && !isProvider && (
        <div><button className="btn btn-primary" style={{ width: "100%" }} onClick={() => go("policy", r.id)}>Attach policy →</button><CostHint label="engage"/></div>
      )}

      {/* READY — either party may fire adjudication */}
      {r.state === "Ready" && (
        <div><button className="btn btn-primary" style={{ width: "100%" }}>Request AI decision →</button><CostHint escrow={AGENT_FEE} label="fires arbiter"/></div>
      )}

      {/* EVIDENCE REQUESTED — provider submits more public evidence */}
      {r.state === "EvidenceRequested" && isProvider && (
        <>
          <div style={{ padding: 13, background: "var(--bg-2)", borderRadius: 9, border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Demo evidence available</div>
                <div className="caption" style={{ fontSize: 11.5, marginTop: 2 }}>Phase-3 RCT supporting necessity for this case</div>
              </div>
              <button className="btn btn-soft btn-sm">Load demo →</button>
            </div>
          </div>
          <textarea placeholder="Paste a public evidence reference (PubMed, FDA, clinical guideline)…" rows={2}/>
          <div><button className="btn btn-primary" style={{ width: "100%" }}>Submit evidence →</button><CostHint escrow={AGENT_FEE} label="re-fires arbiter"/></div>
        </>
      )}
      {r.state === "EvidenceRequested" && !isProvider && (
        <div style={{ padding: "12px 13px", background: "var(--bg-2)", borderRadius: 9, fontSize: 12.5, color: "var(--fg-soft)" }}>Waiting for the provider to submit more public evidence.</div>
      )}

      {/* RULED — accept / appeal */}
      {ruled && (
        <>
          <div><button className="btn btn-primary" style={{ width: "100%" }}>Accept ruling{r.decision === "approve" ? ` — ${money(r.covered)}` : ""}</button><CostHint label="both must accept to settle"/></div>
          <div><button className="btn" style={{ width: "100%" }}>Appeal · submit more evidence → {stageOf(r.payerLine, r.appealRound + 1)?.name || "next stage"}</button><CostHint escrow={AGENT_FEE}/></div>
        </>
      )}

      {/* note */}
      {!terminal && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 4 }}>
          <label>Note · kept off-chain</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note to the conversation…" rows={2}/>
          <button className="btn btn-ghost" style={{ width: "100%", marginTop: 9 }}>Post note</button>
        </div>
      )}

      {/* refuse / withdraw (provider, non-terminal) */}
      {isProvider && !terminal && (
        <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
          {["Ready", "UnderReview", "EvidenceRequested", "Approved", "Denied"].includes(r.state) &&
            <button className="btn btn-danger" style={{ flex: 1 }}>Refuse terms</button>}
          <button className="btn btn-danger" style={{ flex: 1 }}>Withdraw</button>
        </div>
      )}

      {terminal && (
        <div style={{ padding: "12px 13px", background: "var(--bg-2)", borderRadius: 9, fontSize: 12.5, color: "var(--fg-mute)", textAlign: "center" }}>
          This request reached a terminal state — no further actions.
        </div>
      )}
    </div>
  );
}

function contextNote(r, profile) {
  const isP = profile === "provider";
  switch (r.state) {
    case "Open": return isP ? "Filed — waiting for the insurer to attach a policy." : "Attach your governing policy to make this request adjudicable.";
    case "Ready": return "Policy attached. Request an AI decision to start arbitration.";
    case "UnderReview": return "The arbiter is ruling this round. The decision will land here.";
    case "EvidenceRequested": return isP ? "The AI needs more public evidence. Submit a reference to continue." : "Waiting for the provider to submit more public evidence.";
    case "Approved": return "Ruled approve. Both parties must accept to settle, or appeal with new evidence.";
    case "Denied": return "Ruled deny ($0). Appeal with new public evidence, or accept.";
    default: return STATES[r.state]?.desc || "";
  }
}

/* ── event log with cost + attribution ──────────────────────────────── */
function EventLog({ events }) {
  if (!events || events.length === 0) return <div className="caption">No events yet.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {events.slice().reverse().map((e, i) => {
        const meta = EVENT_META[e.kind] || { label: e.kind, color: "var(--accent)" };
        const isLast = i === events.length - 1;
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 12, paddingBottom: isLast ? 0 : 14 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color, marginTop: 4, flexShrink: 0, boxShadow: "0 0 0 3px color-mix(in srgb, " + (meta.color.startsWith("var") ? "var(--accent)" : meta.color) + " 14%, transparent)" }}/>
              {!isLast && <span style={{ width: 2, flex: 1, background: "var(--line)", marginTop: 4 }}/>}
            </div>
            <div style={{ minWidth: 0, paddingBottom: 2 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                <span className="caption" style={{ fontSize: 11, color: "var(--fg-dim)", flexShrink: 0 }}>{relTime(e.ts)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--fg-soft)", marginTop: 2, lineHeight: 1.45 }}>{e.note}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span className="hash" style={{ fontSize: 10.5, padding: "1px 6px" }}>{e.tx}</span>
                {e.cost != null && <span className="caption" style={{ fontSize: 11, color: e.value ? "var(--accent-deep)" : "var(--fg-mute)" }}>{e.cost.toFixed(5)} STT · {e.attr}</span>}
                {e.cost == null && <span className="caption" style={{ fontSize: 11, color: "var(--fg-mute)" }}>{e.attr}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════ FILE REQUEST ═══════════════════════════ */
function FileRequestScreen({ go, profile }) {
  const [just, setJust] = useS("");
  const [drug, setDrug] = useS("");
  const [qty, setQty] = useS("");
  const [days, setDays] = useS("");
  const [amount, setAmount] = useS("");
  const [url, setUrl] = useS("");
  const [payer, setPayer] = useS("Commercial");
  const balance = PROFILES[profile]?.balance ?? 0;
  const reserve = AGENT_FEE + GAS_TYPICAL * 2;
  const lowFunds = balance < reserve;

  const loadDemo = () => {
    setJust("46-year-old patient with moderate-to-severe chronic plaque psoriasis (BSA ~12%, PASI 14). Documented inadequate response to an 8-week trial of methotrexate (intolerance: transaminitis) and to high-potency topical corticosteroids. No active infection; latent TB screen negative; hepatitis panel negative. Requesting adalimumab as a step-therapy exception.");
    setDrug("Adalimumab (RxNorm 1366724 / NDC 00074-3799-02)");
    setQty("2"); setDays("28"); setAmount("5200");
    setUrl("https://api.fda.gov/drug/label.json?search=openfda.brand_name:HUMIRA");
    setPayer("Commercial");
  };

  return (
    <div data-screen-label="03 File request" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "28px 0 18px" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("overview")}>← Back</button>
        <div className="eyebrow">New coverage-exception request</div>
        <div style={{ flex: 1 }}/>
        <button className="btn btn-ghost btn-sm" onClick={() => go("overview")}>Cancel</button>
      </div>

      <h1 style={{ marginBottom: 10 }}>Request drug coverage</h1>
      <div style={{ color: "var(--fg-soft)", fontSize: 14.5, marginBottom: 24, lineHeight: 1.55 }}>
        The clinical justification stays private — only its <span className="mono" style={{ fontSize: 13 }}>keccak256</span> hash is committed on chain. The arbiter never sees raw PHI.
      </div>

      {/* demo banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "16px 18px", background: "var(--accent-tint)", border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)", borderRadius: 10, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-deep)" }}>Try the demo case</div>
          <div className="caption" style={{ marginTop: 2 }}>Pre-filled with a realistic Humira (adalimumab) psoriasis scenario</div>
        </div>
        <button className="btn btn-primary" onClick={loadDemo}>Load demo case →</button>
      </div>

      <div className="panel" style={{ padding: 26 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label>Why is this medication needed? <span style={{ color: "var(--fg-mute)", fontWeight: 400 }}>· stays off-chain</span></label>
            <textarea value={just} onChange={e => setJust(e.target.value)} placeholder="Describe the clinical justification — only a secure hash is recorded on chain." rows={5}/>
            {just && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span className="caption">{just.length} chars · stays in your wallet / agent</span>
                <span className="hash" style={{ fontSize: 11 }}>hash 0x{Math.abs(hashStr(just)).toString(16).padStart(4, "0").slice(0, 4)}…{Math.abs(hashStr(just + "x")).toString(16).padStart(4, "0").slice(-4)}</span>
              </div>
            )}
          </div>

          <div>
            <label>Medication · RxNorm / NDC</label>
            <input value={drug} onChange={e => setDrug(e.target.value)} placeholder="e.g. Adalimumab (RxNorm 1366724)"/>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div><label>Quantity (units)</label><input value={qty} onChange={e => setQty(e.target.value)} placeholder="2" type="number"/></div>
            <div><label>Days supply</label><input value={days} onChange={e => setDays(e.target.value)} placeholder="28" type="number"/></div>
            <div><label>Requested ($)</label><input value={amount} onChange={e => setAmount(e.target.value)} placeholder="5200" type="number"/></div>
          </div>

          <div>
            <label>Supporting evidence <span style={{ color: "var(--fg-mute)", fontWeight: 400 }}>· openFDA / DailyMed / guideline URL · optional</span></label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.fda.gov/drug/label.json?search=…"/>
          </div>

          <div>
            <label>Payer line <span style={{ color: "var(--fg-mute)", fontWeight: 400 }}>· sets the appeal ladder</span></label>
            <select value={payer} onChange={e => setPayer(e.target.value)}>
              <option value="Commercial">Commercial — Internal Appeal → External Review</option>
              <option value="PartD">Medicare Part D — Redetermination → IRE → ALJ</option>
              <option value="Medicaid">Medicaid (MCO) — Plan Appeal → External / Fair Hearing</option>
            </select>
          </div>

          <div style={{ padding: 15, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 9, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="caption">Filing as</span>
              <span><strong>{PROFILES.provider.label}</strong> · {PROFILES.provider.org} <span className="hash" style={{ marginLeft: 4 }}>{PROFILES.provider.address}</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="caption">Sending to</span>
              <span><strong>{PROFILES.insurer.label}</strong> · {PROFILES.insurer.org}</span>
            </div>
          </div>

          {lowFunds && (
            <div style={{ padding: "12px 14px", background: "color-mix(in srgb, var(--state-denied) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--state-denied) 30%, transparent)", borderRadius: 9, fontSize: 12.5, color: "var(--state-denied)" }}>
              Wallet holds {stt(balance)} — you'll need ≈ {reserve.toFixed(4)} STT to file and fire the AI decision. Top up before submitting.
            </div>
          )}

          <button className="btn btn-primary" style={{ width: "100%", padding: "13px 16px", fontSize: 14 }} onClick={() => go("overview")} disabled={profile === "observer" || lowFunds}>
            Submit request · sign tx
          </button>
          <div style={{ textAlign: "center" }}>
            <CostHint label="createContract · simulated mode" />
            <span className="caption" style={{ display: "block", marginTop: 2, color: "var(--fg-dim)" }}>Wallet balance {stt(balance)} · no funds spent in simulated mode</span>
          </div>
        </div>
      </div>
    </div>
  );
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i); return h; }

/* ════════════════════════════ NETWORK ════════════════════════════════ */
function NetworkScreen({ animation }) {
  const stats = [
    { label: "Latest block", value: "12,847,201", sub: "+1 every ~0.4s" },
    { label: "Active rulings", value: "3", sub: "validators in agreement" },
    { label: "Curie contract", value: "0x7c1f…aa02", sub: "CoverageNegotiation v0", mono: true },
    { label: "Arbiter agent", value: "agent-7B", sub: "validator-run · deterministic" },
  ];
  return (
    <div data-screen-label="04 Network">
      <PageHeader
        eyebrow="Network · live"
        title="Somnia testnet"
        sub="Real-time view of Curie contract activity. Every event is independently verifiable on the public ledger."
        right={<span className="pill no-dot" style={{ color: "var(--state-approved)" }}><span className="live-dot" style={{ marginRight: 2 }}/> chain 50312 · 240ms</span>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 26 }}>
        {stats.map((k, i) => (
          <div key={i} className="panel" style={{ padding: "18px 20px" }}>
            <div className="caption" style={{ color: "var(--fg-mute)" }}>{k.label}</div>
            <div style={{ fontFamily: k.mono ? "var(--font-mono)" : "var(--font-display)", fontWeight: k.mono ? 500 : "var(--display-weight)", fontSize: k.mono ? 17 : 27, marginTop: 9, color: "var(--fg)" }}>{k.value}</div>
            <div className="caption" style={{ fontSize: 11.5, marginTop: 6, color: "var(--fg-dim)" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><SectionLabel style={{ marginBottom: 4 }}>Live tx stream</SectionLabel><div style={{ fontSize: 15, fontWeight: 600 }}>CoverageNegotiation events</div></div>
            <span className="pill no-dot" style={{ color: "var(--state-approved)" }}><span className="live-dot" style={{ marginRight: 2 }}/> streaming</span>
          </div>
          <TxStream animation={animation}/>
        </div>

        <div className="panel">
          <SectionLabel>Contract state · live</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              { l: "totalRequests", v: "9" }, { l: "underReview", v: "1" }, { l: "settled", v: "1" },
              { l: "deadlocked", v: "1" }, { l: "policyInvalidated", v: "1" }, { l: "roundBound", v: "3" },
              { l: "agentFee", v: "0.33 STT" }, { l: "feeSplit", v: "50 / 50" },
            ].map((row, i, arr) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                <span className="caption mono" style={{ color: "var(--fg-mute)" }}>{row.l}</span>
                <span className="mono" style={{ fontSize: 13 }}>{row.v}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 16 }}>
            <SectionLabel style={{ marginBottom: 9 }}>On-chain / off-chain boundary</SectionLabel>
            <div style={{ fontSize: 12.5, color: "var(--fg-soft)", lineHeight: 1.7 }}>
              <span style={{ color: "var(--state-approved)", fontWeight: 600 }}>● on chain</span> &nbsp; state, amounts, hashes, ruling + cited clause, receipts, events<br/>
              <span style={{ color: "var(--state-denied)", fontWeight: 600 }}>○ off chain</span> &nbsp; clinical notes, evidence docs, policy body, reasoning trace
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════ POLICY ATTACH ══════════════════════════ */
function PolicyScreen({ id, go }) {
  const r = REQUESTS.find(x => x.id === id) || REQUESTS[0];
  const [selected, setSelected] = useS(0);
  const policies = [
    { id: "MHP-SPC-2026-014", name: "Specialty Biologics 2026", scope: "Biologics & biosimilars", clause: "§4.2 — biologic after inadequate DMARD response", fit: 0.94, compliant: true },
    { id: "MHP-GEN-2026-002", name: "Generic Outpatient Base 2026", scope: "Tier-1 generics", clause: "§1.1 — Tier-1 generic, no exception required", fit: 0.38, compliant: true },
    { id: "MHP-NEU-2026-031", name: "Neurology Exclusions 2026 (demo)", scope: "Excludes experimental therapies", clause: "§6.9 — excludes anti-amyloid Alzheimer's therapies", fit: 0.61, compliant: false },
  ];
  const sel = policies[selected];

  return (
    <div data-screen-label="05 Policy attachment" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "28px 0 18px" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => go("detail", id)}>← Back</button>
        <div className="eyebrow">Insurer · attach governing policy</div>
      </div>

      <h1 style={{ marginBottom: 10 }}>Attach policy to request #{r.id}</h1>
      <div style={{ color: "var(--fg-soft)", fontSize: 14.5, marginBottom: 22, maxWidth: 660, lineHeight: 1.55 }}>
        The policy is the rubric the arbiter rules against. Only its <span className="mono" style={{ fontSize: 13 }}>id + hash</span> goes on chain; the body stays off-chain at a public URL. If a clause the agent relies on contradicts a public standard, the contract is voided.
      </div>

      <div className="panel panel-flat" style={{ padding: 18, marginBottom: 20, background: "var(--bg-2)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          <div><div className="caption">Medication</div><div style={{ fontSize: 15, marginTop: 4, fontWeight: 600 }}>{r.drug}</div></div>
          <div><div className="caption">Requested</div><div className="mono tabular" style={{ fontSize: 15, marginTop: 4 }}>{money(r.requested)}</div></div>
          <div><div className="caption">Cost Plus cap</div><div className="mono tabular" style={{ fontSize: 15, marginTop: 4, color: "var(--accent-deep)" }}>{money(r.costPlusCap)}</div></div>
          <div><div className="caption">Provider</div><div style={{ fontSize: 13.5, marginTop: 4 }}>{r.provider.label}</div></div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {policies.map((pp, i) => {
          const isSel = selected === i;
          return (
            <div key={pp.id} className="panel" onClick={() => setSelected(i)} style={{
              cursor: "pointer", padding: 18,
              borderColor: isSel ? "color-mix(in srgb, var(--accent) 45%, transparent)" : "var(--line)",
              background: isSel ? "var(--accent-tint)" : "var(--bg-1)",
              boxShadow: isSel ? "var(--shadow-md)" : "var(--shadow-sm)",
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "22px 1.9fr 1fr 80px", gap: 18, alignItems: "center" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${isSel ? "var(--accent)" : "var(--line-strong)"}`, background: isSel ? "var(--accent)" : "transparent", boxShadow: isSel ? "inset 0 0 0 3px #fff" : "none" }}/>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>{pp.name}</span>
                    {!pp.compliant && <span className="pill no-dot" style={{ color: "var(--state-policy)", fontSize: 10.5, padding: "1px 8px" }}>non-compliant</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--fg-soft)", marginTop: 4 }}>{pp.clause}</div>
                  <span className="hash" style={{ marginTop: 6, fontSize: 10.5, padding: "1px 6px" }}>{pp.id}</span>
                </div>
                <div><div className="caption">Scope</div><div style={{ fontSize: 12, color: "var(--fg-soft)", marginTop: 3 }}>{pp.scope}</div></div>
                <div style={{ textAlign: "right" }}>
                  <div className="caption">Fit</div>
                  <div className="figure" style={{ fontSize: 22, marginTop: 2, color: pp.fit > 0.8 ? "var(--state-approved)" : (pp.fit > 0.5 ? "var(--state-review)" : "var(--state-denied)") }}>{Math.round(pp.fit * 100)}%</div>
                </div>
              </div>
              {isSel && !pp.compliant && (
                <div style={{ marginTop: 14, padding: "10px 12px", background: "color-mix(in srgb, var(--state-policy) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--state-policy) 30%, transparent)", borderRadius: 8, fontSize: 12, color: "var(--state-policy)", lineHeight: 1.5 }}>
                  ⚠ This clause excludes a therapy the FDA has approved. Attaching it will let the arbiter flag the contradiction and <strong>void the contract</strong> (PolicyInvalidated) — the demonstrated "gotcha."
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
        <button className="btn btn-ghost" onClick={() => go("detail", id)}>Cancel</button>
        <button className="btn btn-primary" onClick={() => go("detail", id)}>
          Attach {sel.id} · sign tx
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════ SETTINGS ═══════════════════════════════ */
function SettingsScreen({ profile, setProfile }) {
  return (
    <div data-screen-label="06 Settings" style={{ maxWidth: 800, margin: "0 auto" }}>
      <PageHeader eyebrow="Account · wallet · agents" title="Settings & wallet"/>

      <div className="panel" style={{ marginBottom: 18 }}>
        <SectionLabel>Active profile</SectionLabel>
        <div className="caption" style={{ marginTop: -8, marginBottom: 14, color: "var(--fg-mute)" }}>In production this is your assigned org role; the picker is a demo affordance.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {Object.entries(PROFILES).map(([key, p]) => {
            const seld = profile === key;
            return (
              <div key={key} onClick={() => setProfile(key)} style={{
                cursor: "pointer", borderRadius: 10, padding: 16,
                border: `1px solid ${seld ? "color-mix(in srgb, var(--accent) 45%, transparent)" : "var(--line-strong)"}`,
                background: seld ? "var(--accent-tint)" : "var(--bg-1)",
                boxShadow: seld ? "var(--shadow-md)" : "var(--shadow-sm)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: seld ? "var(--accent-deep)" : "var(--fg)" }}>{p.label}</span>
                  <span className="caption" style={{ fontSize: 11 }}>party {p.party}</span>
                </div>
                <div className="caption" style={{ fontSize: 11.5, marginTop: 5, lineHeight: 1.45 }}>{p.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <SectionLabel>Wallet</SectionLabel>
        <FactRow label="Address" value={<span className="hash">{PROFILES[profile].address}</span>}/>
        <FactRow label="Mode" value={<span className="pill no-dot" style={{ color: "var(--state-approved)" }}>simulated</span>}/>
        <FactRow label="Balance" value={<span className="mono tabular">{stt(PROFILES[profile].balance)}</span>}/>
        <FactRow label="Agent fee" value={<span className="mono">{AGENT_FEE.toFixed(2)} STT per adjudication</span>}/>
        <FactRow label="Network" value={<span className="mono">Somnia testnet · chain 50312</span>}/>
        <FactRow label="RPC" last value={<span className="hash">api.infra.testnet.somnia.network</span>}/>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn btn-sm">Switch to real</button>
          <button className="btn btn-sm">Faucet</button>
          <button className="btn btn-sm">Copy address</button>
        </div>
      </div>

      <div className="panel">
        <SectionLabel>Agent registry</SectionLabel>
        <div style={{ color: "var(--fg-soft)", fontSize: 13, marginBottom: 14, lineHeight: 1.55 }}>
          Parties register with Somnia's <span className="mono" style={{ fontSize: 12 }}>AgentRegistry</span>. Requests reference party IDs, not raw addresses.
        </div>
        <div className="row-list">
          {[
            { id: 1, role: "provider", label: "St. Mary's Health", addr: "0x5c2f…965D" },
            { id: 2, role: "insurer", label: "Meridian Health Plan", addr: "0x8c1f…7e2A" },
            { id: 99, role: "observer", label: "Auditor (read-only)", addr: "0x3aD1…0b4C" },
            { id: 7, role: "arbiter", label: "agent-7B · necessity arbiter", addr: "0xC9f3…8347" },
          ].map(a => (
            <div key={a.id} className="row" style={{ gridTemplateColumns: "52px 1fr 120px 90px", padding: "11px 0", cursor: "default" }}>
              <span className="mono" style={{ color: "var(--fg-mute)", fontSize: 13 }}>#{a.id}</span>
              <span><div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.label}</div><div className="caption" style={{ fontSize: 11, marginTop: 1 }}>{a.role}</div></span>
              <span className="hash" style={{ fontSize: 11 }}>{a.addr}</span>
              <span style={{ color: "var(--state-approved)", fontSize: 12.5, fontWeight: 600 }}>● active</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  OverviewScreen, RequestDetailScreen, FileRequestScreen, NetworkScreen, PolicyScreen, SettingsScreen,
});
