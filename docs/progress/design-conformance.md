# Design Conformance Report — spec-4-implementation

**Date:** 2026-05-29  
**Branch:** `spec-4-implementation`  
**Threshold:** ≥ 90 % to pass  
**This tick's changes (tick 14):** KPI strip added to `web/src/views/Overview.tsx` above the request table — 4 cards (Total, In negotiation, Settled, Capped vs ask) with real on-chain derived counts. CSS rules `.kpi-strip`, `.kpi-card`, `.kpi-label`, `.kpi-value`, `.kpi-value.tone-{review,approved,accent}`, `.kpi-sub` added to `web/src/styles.css`.

---

## Overall score

**62 % — Does Not Pass (threshold: 90 %)**

_(Previous tick: 57 %. +5 pp from KPI strip on Overview.)_

---

## Headline verdict

The web app faithfully implements the functional contract of the prototype across the three live screens (Overview, Detail, Create), and several new affordances in the web app (PriceGauge, gotcha panel, stepper, policy-choice cards, decision-option cards, demo-hero banner, on-chain verify block) are high-quality work that actually exceed the prototype in depth. The KPI strip — the most prominent missing element from Overview — is now present with matching label text and real data derivation. However, the prototype's visual language — lavender/accent-violet token system, sticky blurred TopBar, filter pill bar, per-row MiniBenchmark sparkline, full navigation set (Requests / Network / Settings), Footer strip, and the floating TweaksPanel — remains mostly absent. The two UIs share domain semantics but still diverge at the component-tree and information-architecture level for the structural gaps.

---

## Per-surface assessment

### 1. Overview screen (prototype: `screens.jsx` OverviewScreen, lines 44–155)

| Element | Prototype | Web app | Status |
|---|---|---|---|
| Page header (eyebrow + h1 + sub) | "Coverage-exception requests" / "Negotiations in flight" + subtitle | `<h1>Coverage Requests</h1>` only | Partial |
| KPI strip (4 panels: Total, In negotiation, Settled, Capped vs ask) | Present — 4-col grid (`screens.jsx:84-93`) | Present — `.kpi-strip` with 4 `KpiCard` components, real on-chain counts, toned values | Match |
| Filter bar (All / Open / In negotiation / Settled / Closed pill buttons) | Present (`screens.jsx:99-115`) | Absent | Missing |
| Request table | 8-col grid (Req, Medication, Status, Appeal stage, Requested, Covered, Benchmark, Round) | 6-col HTML table (no Appeal stage, no MiniBenchmark column) | Partial |
| MiniBenchmark sparkline per row | Present (`visuals.jsx:121-142`) | Absent | Missing |
| "＋ New request" button | Present, disabled for observer | Present (`+ New Request`) | Match |
| "Network" nav button in header right | Present | Absent | Missing |

**Surface score: ~53 %**

_(Previous tick: ~35 %. KPI strip was the single largest missing element; its addition — 4-panel structure, matching labels, real data — is a strong structural match to `screens.jsx:84-93`. Remaining Overview gaps: filter pills, two missing table columns, MiniBenchmark sparkline, header eyebrow/subtitle, Network nav link.)_

### 2. Detail screen (prototype: `screens.jsx` RequestDetailScreen, lines 158–281)

| Element | Prototype | Web app | Status |
|---|---|---|---|
| Back button + request # + StatePill | Present | Present (`← Back`, `#reqId`, state badge) | Match |
| "Acting as" role pill | Present | Present (`.role-label`) | Match |
| Drug/Rx metadata line | Present (drug, rxnorm, quantity, daysSupply, filed, parties) | Partial — drug ref shown as `shortHex(drugRef)` only, no rxnorm/brand | Partial |
| FlowStepper (5-node, horizontal) | Present in prototype via `FlowStepper` — `visuals.jsx:22-74` | Present as `.stepper` `<ol>` with dots and connecting lines | Match |
| Request details card (on-chain facts grid) | Present (`FactRow` grid) | Present (`.facts dl` grid) | Match |
| AI decision card with ruling hero | Present (`AiDecision` with rationale, clause, receipt, evidence list) | Present (ruling-hero, approved/denied/evidence/voided states) | Match |
| Policy-void "gotcha" panel | Present in AI decision card | Present as separate `.card.gotcha` | Match (repositioned) |
| PriceComparison (horizontal bar chart) | Present — 3-4 rows, deterministic formula note | Present — `PriceGauge` bars + hint text | Match |
| Appeal ladder (per-payer, multi-step) | Present (LADDERS mapping, current-step highlight) | Absent — no appeal-ladder UI at all | Missing |
| ActionPanel (context-gated, all roles) | Present (Observe / Open / Ready / EvidenceRequested / Ruled branches) | Present (canEngage / canAdjudicate / canAccept / canSettle / canAppeal / canSubmitEvidence / canFeedback / canRefuse / canWithdraw) | Match |
| Evidence list with provenance labels | Present (`EvidenceList`) | Absent — evidence only as URL textarea | Missing |
| Event log (timeline with tx hash, cost, attribution) | Present (`EventLog` — dot/line timeline, cost per event) | Present (`.timeline ol` with dot, event name, description) | Match |
| "Verify your justification copy" block | Present (inline in Request details card) | Present (in collapsible proof-block) | Match |
| Policy attach (inline or via PolicyScreen) | PolicyScreen is a separate screen | Inline in Detail's Actions card (policy-cards grid) | Design delta (web is simpler, still functional) |

**Surface score: ~68 %**

### 3. Create / File-request screen (prototype: `screens.jsx` FileRequestScreen, lines 420–529)

| Element | Prototype | Web app | Status |
|---|---|---|---|
| "New coverage-exception request" eyebrow + back/cancel | Present | Present (`← Cancel` button, `<h1>Request Drug Coverage</h1>`) | Match |
| PHI privacy note | "The clinical justification stays private — only its keccak256 hash is committed on chain." | Present in placeholder text | Match |
| Demo banner with "Load demo case" | Present (accent-tint panel, "Try the demo case") | Present (`.demo-hero` banner, "Try the demo case") | Match |
| Justification textarea + live hash preview | Present — character count + live `0x…` hash display | Textarea present; no live hash preview | Partial |
| Medication input | Present | Present | Match |
| Quantity / Days supply / Amount (3-col grid) | Present | Present (2-row layout: qty+days then amount) | Match |
| Supporting evidence URL | Present | Present | Match |
| Payer line select (Commercial / PartD / Medicaid) | Present | Absent — payer line hardcoded to `PayerLine.PartD` | Missing |
| "Filing as / Sending to" summary | Present | Present (`.parties`) | Match |
| Low-funds warning | Present | Absent (no balance check in form) | Missing |
| Submit + CostHint | Present | Present (Submit button; no cost hint) | Partial |

**Note:** `Create.tsx` was edited this tick only for the R2b self-contract guard (`insurerAddr != providerAddr`). The missing Payer line selector and low-funds warning are pre-existing gaps, not regressions from this tick.

**Surface score: ~70 %**

### 4. TopBar / wallet chip (prototype: `app.jsx` TopBar, lines 61–131)

| Element | Prototype | Web app | Status |
|---|---|---|---|
| Curie logo-glyph + "coverage-exception arbiter" sub-line | Present | Absent — brand is plain text "Curie AI Drug Coverage Arbiter" | Partial |
| Sticky + blur backdrop-filter | Present | Sticky present; no blur/glassmorphism | Partial |
| Nav: Requests / Network / Settings | Present (3 links) | Dashboard / New Request only (2 items; Network, Settings absent) | Missing |
| Search chip ⌘K | Present | Absent | Missing |
| Wallet chip (balance + short address + sim badge) | Present (pill with STT balance + address + "sim" pill) | Present (`.wallet` column: address `<code>`, mode badge, balance via `WalletBalance`) | Match (layout differs: column vs pill, functional parity) |
| ProfileSwitcher (Provider / Insurer / Observer pill row) | Present (inline pill-row in TopBar) | Present (`<select>` in wallet column) | Partial (functional parity, visual regression) |

**Surface score: ~40 %**

### 5. Tweaks panel (prototype: `tweaks-panel.jsx`)

Not applicable to the web app — this is a prototyping tool for the design sandbox, not a production feature. No gap to report.

### 6. Missing prototype screens entirely

| Prototype screen | Web app equivalent |
|---|---|
| NetworkScreen (`screens.jsx:533-593`) — live tx stream, contract state, on/off-chain boundary diagram | Absent |
| PolicyScreen (`screens.jsx:596-671`) — insurer policy attachment with fit-score cards | Merged into Detail ActionPanel (simpler) |
| SettingsScreen (`screens.jsx:674-741`) — profile cards, wallet facts, agent registry | Absent |

**Absence weight: significant** — Network and Settings are nav-level gaps visible to any user.

---

## Top 3 priority gaps — next ticks

Ranked by demo impact (highest first):

### Gap 1 — Overview filter pill bar (`screens.jsx:99-115`)
**Prototype:** Horizontal row of 5 pill buttons (All / Open / In negotiation / Settled / Closed) above the table, with an active-highlight state.  
**Web:** No filter bar at all. All rows always shown.  
**Fix:** Add a `filterState` useState in `Overview.tsx`; render a row of `<button>` pills that set it; filter `rows` before mapping to `<tr>`. CSS needs a `.filter-bar` + `.pill` + `.pill.active` rule set.

### Gap 2 — Overview table missing `Appeal stage` and `Round` columns (`screens.jsx:114-116`)
**Prototype:** Table header row has 8 columns; `Appeal stage` and `Round` are visible per-row alongside Medication, Status, Requested, Covered, Benchmark.  
**Web:** `Overview.tsx` table has 6 columns (`#`, Medication, Status, Policy, Requested, AI Covered). No appeal-stage or round column.  
**Fix:** Surface `appealRound` and `payerLine` from `NegotiationView` (or add them if not yet present) and add the two columns to the `<thead>` and each `<tr>` in `Overview.tsx`. A simple text value (`Round {n}`) satisfies conformance; a full sparkline (MiniBenchmark) can follow.

### Gap 3 — Navigation incomplete: Network + Settings screens absent
**Prototype:** `app.jsx:76-79` — 3 nav links (Requests, Network, Settings). `screens.jsx:533-740` fully defines both screens.  
**Web:** `App.tsx` routes only overview / create / detail; nav bar shows Dashboard / New Request.  
**Fix:** Add `| { kind: "network" } | { kind: "settings" }` to the `View` union in `App.tsx`; add nav links in `TopBar`; implement minimal `NetworkScreen` (live tx stream placeholder, contract address facts) and `SettingsScreen` (role/profile cards, wallet facts) in `web/src/views/`.

---

## Unchanged surfaces this tick

- **Detail** (~68 %): appeal ladder absent, evidence list absent — unchanged.
- **Create** (~70 %): payer line selector absent, live hash preview absent — unchanged.
- **TopBar / wallet chip** (~40 %): Network + Settings nav links absent, blur backdrop absent — unchanged.
- **NetworkScreen**: entirely absent — unchanged.
- **SettingsScreen**: entirely absent — unchanged.

---

## What this tick changed — design impact

Added `.kpi-strip` / `KpiCard` to `web/src/views/Overview.tsx` and corresponding CSS rules to `web/src/styles.css`. The 4-panel KPI strip now structurally matches `screens.jsx:84-93` — correct label text ("Total requests", "In negotiation", "Settled", "Capped vs ask"), real on-chain data derivation, and tone-colored values. This resolves Gap 1 from the prior tick's top-5 list and raises Overview from ~35 % to ~53 %, and overall from 57 % to 62 %.
