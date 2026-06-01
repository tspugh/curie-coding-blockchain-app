// ─── Curie main app ────────────────────────────────────────────────────
const { useState: useStateA, useEffect: useEffectA } = React;

function App() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  const [route, setRoute] = useStateA({ name: "overview", id: null });
  const profile = t.profile || "provider";

  function go(name, id = null) {
    setRoute({ name, id });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  useEffectA(() => {
    document.body.dataset.surface = t.surface || "lavender";
    document.body.dataset.accent = t.accent || "violet";
    document.body.dataset.type = t.type || "sans";
    document.body.dataset.density = t.density || "comfortable";
    document.body.dataset.animation = t.animation || "lively";
    document.body.dataset.profile = profile;
  }, [t.surface, t.accent, t.type, t.density, t.animation, profile]);

  return (
    <div className="app-root">
      <TopBar route={route} go={go} profile={profile} setProfile={v => setTweak("profile", v)}/>

      <main className="app-content">
        {route.name === "overview" && <OverviewScreen go={go} profile={profile}/>}
        {route.name === "detail"   && <RequestDetailScreen id={route.id} go={go} profile={profile}/>}
        {route.name === "file"     && <FileRequestScreen go={go} profile={profile}/>}
        {route.name === "network"  && <NetworkScreen animation={t.animation}/>}
        {route.name === "policy"   && <PolicyScreen id={route.id} go={go}/>}
        {route.name === "settings" && <SettingsScreen profile={profile} setProfile={v => setTweak("profile", v)}/>}
      </main>

      <FooterStrip/>
      <TxMonitor animation={t.animation}/>

      <TweaksPanel>
        <TweakSection label="Surface"/>
        <TweakRadio label="Lightness" value={t.surface} options={["white", "lavender"]} onChange={v => setTweak("surface", v)}/>
        <TweakColor label="Accent" value={accentSwatch(t.accent)}
          options={["#6d3fd6", "#4a4fd4", "#8f37c0"]}
          onChange={v => setTweak("accent", swatchAccent(v))}/>
        <TweakSection label="Typography"/>
        <TweakRadio label="Display type" value={t.type} options={["sans", "serif"]} onChange={v => setTweak("type", v)}/>
        <TweakRadio label="Density" value={t.density} options={["compact", "comfortable"]} onChange={v => setTweak("density", v)}/>
        <TweakRadio label="Animation" value={t.animation} options={["none", "subtle", "lively"]} onChange={v => setTweak("animation", v)}/>
        <TweakSection label="Demo role"/>
        <TweakRadio label="Acting as" value={profile} options={["provider", "insurer", "observer"]} onChange={v => setTweak("profile", v)}/>
      </TweaksPanel>
    </div>
  );
}

const ACCENTS = { "#6d3fd6": "violet", "#4a4fd4": "indigo", "#8f37c0": "plum" };
function accentSwatch(a) { return Object.keys(ACCENTS).find(k => ACCENTS[k] === a) || "#6d3fd6"; }
function swatchAccent(hex) { return ACCENTS[hex] || "violet"; }

/* ── TopBar ─────────────────────────────────────────────────────────── */
function TopBar({ route, go, profile, setProfile }) {
  const p = PROFILES[profile];
  const reqRoutes = ["overview", "detail", "file", "policy"];
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "color-mix(in srgb, var(--bg-0) 82%, transparent)", backdropFilter: "blur(14px) saturate(150%)", WebkitBackdropFilter: "blur(14px) saturate(150%)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 32px", height: 62, display: "flex", alignItems: "center", gap: 20 }}>
        <button onClick={() => go("overview")} style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}>
          <div className="logo-glyph"/>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", fontSize: 18, color: "var(--fg)", letterSpacing: "var(--display-tracking)" }}>Curie</span>
            <span className="caption" style={{ fontSize: 10.5, color: "var(--fg-mute)", fontWeight: 500 }}>coverage-exception arbiter</span>
          </div>
        </button>

        <nav style={{ display: "flex", gap: 4, marginLeft: 14 }}>
          <NavLink active={reqRoutes.includes(route.name)} onClick={() => go("overview")}>Requests</NavLink>
          <NavLink active={route.name === "network"} onClick={() => go("network")}>Network</NavLink>
          <NavLink active={route.name === "settings"} onClick={() => go("settings")}>Settings</NavLink>
        </nav>

        <div style={{ flex: 1 }}/>

        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg-mute)", fontSize: 12.5, padding: "6px 11px", border: "1px solid var(--line-strong)", borderRadius: 8, cursor: "pointer", background: "var(--bg-1)" }}>
          <span>Search</span><kbd>⌘K</kbd>
        </div>

        {/* wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 6px 12px", border: "1px solid var(--line-strong)", borderRadius: 999, background: "var(--bg-1)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.15 }}>
            <span className="mono tabular" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>{stt(p.balance)}</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--fg-mute)" }}>{p.address}</span>
          </div>
          <span className="pill no-dot" style={{ color: "var(--state-approved)", fontSize: 10.5, padding: "2px 8px" }}>sim</span>
        </div>

        {/* role switcher */}
        <ProfileSwitcher value={profile} onChange={setProfile}/>
      </div>
    </header>
  );
}

function NavLink({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", fontSize: 13.5, fontWeight: 600,
      color: active ? "var(--accent-deep)" : "var(--fg-soft)",
      background: active ? "var(--accent-tint)" : "transparent",
      border: "1px solid " + (active ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "transparent"),
      borderRadius: 8, cursor: "pointer", transition: "all .14s ease",
    }}>{children}</button>
  );
}

function ProfileSwitcher({ value, onChange }) {
  return (
    <div style={{ display: "inline-flex", padding: 3, background: "var(--bg-2)", border: "1px solid var(--line-strong)", borderRadius: 999, gap: 2 }}>
      {[["provider", "Provider"], ["insurer", "Insurer"], ["observer", "Observer"]].map(([v, lab]) => {
        const on = value === v;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            padding: "5px 12px", fontSize: 12.5, fontWeight: 600, borderRadius: 999, cursor: "pointer",
            color: on ? "#fff" : "var(--fg-soft)",
            background: on ? "var(--accent)" : "transparent",
            transition: "all .14s ease",
          }}>{lab}</button>
        );
      })}
    </div>
  );
}

/* ── Footer ─────────────────────────────────────────────────────────── */
function FooterStrip() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", maxWidth: 1320, margin: "48px auto 0", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--fg-mute)", fontSize: 12, padding: "22px 32px" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="live-dot"/> Curie · MVP0</span>
      <span style={{ display: "flex", gap: 16 }}>
        <span>Necessity arbiter · deterministic cap</span>
        <span style={{ color: "var(--fg-dim)" }}>·</span>
        <span>PHI never on chain</span>
      </span>
      <span className="mono">Somnia · chain 50312</span>
    </footer>
  );
}

/* ── Tx monitor dock (bottom-left, clean) ───────────────────────────── */
function TxMonitor({ animation }) {
  const [open, setOpen] = useStateA(false);
  const [last, setLast] = useStateA({ kind: "AdjudicationRequested", msg: "fired arbiter · 0.33 STT escrowed", reqId: 8 });

  useEffectA(() => {
    if (animation === "none") return;
    const id = setInterval(() => {
      const seeds = [
        { kind: "AdjudicationRequested", msg: "fired arbiter · 0.33 STT escrowed", reqId: 8 },
        { kind: "Ruled", msg: "approve · cites §4.2", reqId: 7 },
        { kind: "InsurerEngaged", msg: "policy attached", reqId: 9 },
        { kind: "Settled", msg: "fee split 50/50 · marker", reqId: 6 },
      ];
      setLast(seeds[Math.floor(Math.random() * seeds.length)]);
    }, animation === "lively" ? 3200 : 5200);
    return () => clearInterval(id);
  }, [animation]);

  const meta = EVENT_META[last.kind] || { label: last.kind, color: "var(--accent)" };

  return (
    <div style={{ position: "fixed", left: 16, bottom: 16, zIndex: 40, width: open ? 320 : "auto", background: "var(--bg-1)", border: "1px solid var(--line-strong)", borderRadius: 12, boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 13px", cursor: "pointer" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="live-dot"/>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>Tx monitor</span>
        </span>
        <span className="caption" style={{ fontSize: 11 }}>{open ? "—" : "+"}</span>
      </button>
      {open && (
        <div className="tx-row" style={{ padding: "0 13px 13px", borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: meta.color }}>{meta.label}</span>
            <span className="caption" style={{ fontSize: 11 }}>req #{last.reqId}</span>
            <span style={{ flex: 1 }}/>
            <span className="caption" style={{ fontSize: 10.5 }}>now</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-soft)", marginTop: 4, lineHeight: 1.45 }}>{last.msg}</div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
