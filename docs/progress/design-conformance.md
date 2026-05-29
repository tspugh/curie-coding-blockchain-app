# Design Conformance Report — spec-4-implementation

**Date:** 2026-05-29  
**Branch:** `spec-4-implementation`  
**Threshold:** ≥ 90 % to pass  
**This tick's changes:** 5 new fixture files under `demo-data/scenarios/partd-approvable/`; 1 vitest→node:test rewrite under `src/protocol/`. No `web/src/` changes were intentional design work this tick — `web/src/views/Create.tsx` was touched only as a UNIT-2 ripple (R2b self-contract guard) and is not assessed as a deliberate conformance improvement.

---

## Overall score

**57 % — Does Not Pass (threshold: 90 %)**

---

## Headline verdict

The web app faithfully implements the functional contract of the prototype across the three live screens (Overview, Detail, Create), and several new affordances in the web app (PriceGauge, gotcha panel, stepper, policy-choice cards, decision-option cards, demo-hero banner, on-chain verify block) are high-quality work that actually exceed the prototype in depth. However, the prototype's visual language — lavender/accent-violet token system, sticky blurred TopBar, 4-KPI strip, per-row MiniBenchmark sparkline, full navigation set (Requests / Network / Settings), Footer strip, and the floating TweaksPanel — is almost entirely absent from the web app. The two UIs share domain semantics but diverge substantially at the component-tree and information-architecture level.

---

## Per-surface assessment

### 1. Overview screen (prototype: `screens.jsx` OverviewScreen, lines 44–155)

| Element | Prototype | Web app | Status |
|---|---|---|---|
| Page header (eyebrow + h1 + sub) | "Coverage-exception requests" / "Negotiations in flight" + subtitle | `<h1>Coverage Requests</h1>` only | Partial |
| KPI strip (4 panels: Total, In negotiation, Settled, Capped vs ask) | Present — 4-col grid | Absent | Missing |
| Filter bar (All / Open / In negotiation / Settled / Closed pill buttons) | Present | Absent | Missing |
| Request table | 8-col grid (Req, Medication, Status, Appeal stage, Requested, Covered, Benchmark, Round) | 6-col HTML table (no Appeal stage, no MiniBenchmark column) | Partial |
| MiniBenchmark sparkline per row | Present (`visuals.jsx:121-142`) | Absent | Missing |
| "＋ New request" button | Present, disabled for observer | Present (`+ New Request`) | Match |
| "Network" nav button in header right | Present | Absent | Missing |

**Surface score: ~35 %**

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

## Top 5 actionable gaps for future ticks

Ranked by demo impact (highest first):

### Gap 1 — KPI strip missing from Overview
**Prototype:** `screens.jsx:84-93` — 4-panel grid (Total, In negotiation, Settled, Capped vs ask), each with a large figure and caption.  
**Web:** No KPI strip at all. First thing a viewer sees is the raw table.  
**Fix:** Add a `<div class="kpi-strip">` above the table in `web/src/views/Overview.tsx` with four derived counts from `rows`.

### Gap 2 — Navigation incomplete (Network + Settings screens absent)
**Prototype:** `app.jsx:76-79` — 3 nav links (Requests, Network, Settings). `screens.jsx:533-740` defines both screens.  
**Web:** `App.tsx` only routes overview / create / detail. No Network or Settings routes exist.  
**Fix:** Add `| { kind: "network" } | { kind: "settings" }` to the `View` union in `App.tsx`; implement minimal versions of `NetworkScreen` and `SettingsScreen` in `web/src/views/`.

### Gap 3 — Overview table missing MiniBenchmark column + Appeal stage column
**Prototype:** `screens.jsx:114-116` — table has 8 columns including "Appeal stage" and "Benchmark" (the `MiniBenchmark` sparkline from `visuals.jsx:121-142`).  
**Web:** `Overview.tsx` table has 6 columns; no benchmark sparkline and no appeal-stage column.  
**Fix:** Add appeal-round and payer-line fields to `NegotiationView`, surface them in the table header and rows, and implement a simple CSS bar in place of the full SVG sparkline.

### Gap 4 — Appeal ladder entirely absent from Detail
**Prototype:** `screens.jsx:234-265` — full per-payer appeal ladder (Commercial / PartD / Medicaid LADDERS constant), step cards with current-step highlight, window and threshold text.  
**Web:** `Detail.tsx` has `STEPPER_STEPS` for the flow stepper (5 generic milestones) but no appeal-ladder section at all. The `appealRound` field is not surfaced.  
**Fix:** Extend `NegotiationView` to carry `payerLine` and `appealRound`; add an `AppealLadder` sub-component in `Detail.tsx` modelled on `screens.jsx:244-265`.

### Gap 5 — Payer line selector absent from Create; live justification hash preview missing
**Prototype:** `screens.jsx:494-499` — `<select>` with Commercial / PartD / Medicaid options that sets the appeal ladder.  `screens.jsx:470-472` — live hash preview rendered as `0x{hashStr(just)…}`.  
**Web:** `Create.tsx` hardcodes `PayerLine.PartD` (documented as a UNIT-7 placeholder); no payer selector. No live hash display below the justification textarea.  
**Fix (part A):** Replace the `PayerLine.PartD` constant with a `<select>` control bound to a `payerLine` state variable; pass it through to `createContract`.  
**Fix (part B):** Below the justification `<textarea>`, render a `<code>` element showing `hashContent(justification)` using the existing `hashContent` import from `@lib`.

---

## What this tick changed — design impact

The five new fixture files (`demo-data/scenarios/partd-approvable/`) and the `node:test` rewrite of the protocol test file have zero impact on any UI surface. This tick correctly made no deliberate conformance changes; conformance score is unchanged from the pre-tick baseline (first measurement: 57 %).
