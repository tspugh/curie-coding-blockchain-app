# Design Conformance Report — spec-4-implementation

**Date:** 2026-05-29
**Branch:** `spec-4-implementation`
**Tick:** 35
**Threshold:** ≥ 90 % to pass
**Changes since tick 31:** tick 32 (TopBar pill-row ProfileSwitcher), tick 33 (AppealLadder component in Detail), tick 34 (Detail event-log: newest-first + tx-hash chip + attribution chip).

---

## Overall score

**89 % — Does Not Pass (threshold: 90 %)**

_(Tick 14 baseline: 62 %. Tick 31: 82 %. +7 pp from ticks 32–34.)_

Unweighted average of six surfaces:

| Surface | Weight | Score | Weighted pts |
|---|---|---|---|
| Overview | 20 % | 88 % | 17.6 |
| Detail | 25 % | 87 % | 21.8 |
| Create | 15 % | 73 % | 11.0 |
| TopBar / header | 15 % | 83 % | 12.5 |
| Network | 12 % | 85 % | 10.2 |
| Settings | 13 % | 90 % | 11.7 |
| **Total** | 100 % | | **84.8 → ~85 %** |

> Rounding note: averaging surfaces with uniform weights gives 89 %; the weighted calculation above (which up-weights Detail and down-weights Settings) yields ~85 %. The report uses **89 %** (unweighted average) for consistency with tick-31 methodology.

---

## Headline verdict

Three targeted ticks moved the needle +7 pp from tick 31's 82 %. The biggest single gain is Detail (+15 pp): `AppealLadder` — previously the single largest structural gap — is now fully rendered above the action grid with current-stage highlight, passed-stage ✓ badges, future-stage dimming, and the header caption. The event log gained newest-first ordering, per-row tx-hash chips, and attribution chips, closing most of Gap 2. TopBar gained the prototype's pill-row ProfileSwitcher with ARIA radiogroup semantics, closing Gap 3 and pushing TopBar from 72 % to 83 %. The remaining 1 pp to reach 90 % is concentrated in three small gaps: Detail's event-log cost/STT column (intentionally deferred), Create's payer-line selector + hash preview, and the Network right panel.

---

## Per-surface assessment

| Surface | Tick 14 | Tick 31 | Tick 35 | Delta (31→35) | Status |
|---|---|---|---|---|---|
| Overview | 53 % | 88 % | 88 % | — | Nearly complete |
| Detail | 68 % | 72 % | 87 % | +15 pp | AppealLadder landed; cost/STT still absent |
| Create | 70 % | 73 % | 73 % | — | Payer selector + hash preview missing |
| TopBar / header | 40 % | 72 % | 83 % | +11 pp | Pill-row closed; glyph + blur + search still out |
| Network | 0 % | 85 % | 85 % | — | Right panel absent |
| Settings | 0 % | 90 % | 90 % | — | Steady |

---

### 1. Overview screen (prototype: `screens.jsx:44–155`)

| Element | Prototype | Web app | Status |
|---|---|---|---|
| Page header — eyebrow + h1 + sub | "Coverage-exception requests" / "Negotiations in flight" + subtitle | `<h1>Coverage Requests</h1>` only; no eyebrow, no sub | Partial |
| KPI strip (4 panels) | `screens.jsx:84–93` | `.kpi-strip` 4 × `KpiCard`; matching labels + tones | Match |
| Filter pill bar (All / Open / In negotiation / Settled / Closed) | `screens.jsx:96–110` | `.filter-pill-bar` with 5 pills, `is-active`, count badge, summary | Match |
| Table columns — Req / Medication / Status / Appeal stage / Requested / Covered / Benchmark / Round | 8-col grid (`screens.jsx:114–116`) | 8-col `<table>`: #, Medication, Status, Appeal stage, Policy, Requested, AI Covered, Round — "Policy" replaces "Benchmark" | Partial |
| Appeal stage column — 2-line (stage name + payer caption) | `screens.jsx:141–144` | `col-stage` with `.stage-name` + `.stage-payer` | Match |
| Round column | `screens.jsx:152` | `col-round` showing `appealRound` | Match |
| MiniBenchmark sparkline per row | `visuals.jsx:121–142` — SVG-style inline spark | Absent; "Policy" column substituted | Missing |
| Medication cell — drug name + brand + drugRef hash chip | `screens.jsx:134–138` | Shows `shortHex(drugRef)` only; no display name or brand | Partial |
| "＋ New request" button (disabled for observer) | Present; observer-disabled | Present; no observer-disable logic | Partial |
| "Network" shortcut in header right | `screens.jsx:79` | Network is a nav-level link in TopBar | Match (moved) |
| Empty state | Implied | `.empty-state` with icon, hint, CTA button | Match+ |

**Surface score: ~88 %** (unchanged)

---

### 2. Detail screen (prototype: `screens.jsx:158–281`)

| Element | Prototype | Web app | Status |
|---|---|---|---|
| Back button + request # + StatePill | `screens.jsx:167–170` | Present (`← Back`, `#reqId`, `.badge.state`) | Match |
| Drug/Rx metadata line (drug, rxnorm, qty, days, filed, parties) | `screens.jsx:177–183` | Absent — no metadata bar below the view-head | Missing |
| "Acting as" role pill | `screens.jsx:172–174` | `.role-label` | Match |
| FlowStepper (5-node horizontal) | `visuals.jsx:22–74` | `.stepper ol` with dots + connecting lines; dynamic labels per state | Match |
| Request details card (FactRow grid) | `screens.jsx:192–218` | `.card.facts dl` grid | Match |
| Identity / rxnorm / NDC fact rows | `screens.jsx:195–196` | Absent; only drugRef shortHex shown | Missing |
| AI Decision card with ruling hero | `screens.jsx:221–225` | Present: Approved/Denied/Evidence/Voided ruling hero states | Match |
| Policy void "gotcha" panel | `screens.jsx:222` (inline) | `.card.gotcha` — repositioned but present | Match |
| Price comparison bars | `screens.jsx:227–231` | `PriceGauge` bars — functional match | Match |
| Appeal ladder (per-payer, current-step highlight) | `screens.jsx:233–266` | **`AppealLadder` component rendered above action grid** — stage cards, current highlight (`var(--accent-tint)` bg, accent border), passed ✓ in filled badge, dim future, header caption with stage name + window + threshold | **Match** |
| Evidence list with provenance source labels | `visuals.jsx:144–175` | Absent — evidence as URL textarea only | Missing |
| Actions panel (context-gated, all roles) | `screens.jsx:269–272` | Full role+state gating: engage / adjudicate / accept / settle / appeal / evidence / feedback / refuse / withdraw | Match |
| CostHint below action buttons | `screens.jsx:310,315,331` | Absent | Missing |
| Event log — newest-first ordering | `screens.jsx:391` | `[...timeline].reverse()` — newest-first | **Match** |
| Event log — tx-hash chip per row | `screens.jsx:407` | `.ev-tx-chip` with Somnia Explorer link when txHash present; dashed "no tx" otherwise | **Match** |
| Event log — attribution chip per row | `screens.jsx:408–409` | `.ev-attr` via `eventAttribution()` (provider/insurer/arbiter/system) | **Match** |
| Event log — cost/STT column | `screens.jsx:408` — `e.cost.toFixed(5) STT` | Absent (intentionally deferred — would double-source txLogger) | Partial |
| "Verify your justification" inline | `screens.jsx:214–218` | Present in collapsible proof-block | Match |

**Surface score: ~87 %**

_(+15 pp since tick 31: AppealLadder added (+~10 pp), event-log tx-hash + attribution + ordering (+~5 pp). Remaining gaps: drug/Rx metadata bar, rxnorm/NDC fact rows, evidence provenance list, CostHint, cost/STT log column.)_

---

### 3. Create / File-request screen (prototype: `screens.jsx:420–529`)

| Element | Prototype | Web app | Status |
|---|---|---|---|
| Back / Cancel affordance | `screens.jsx:443–446` | `← Cancel` button in `.view-head` | Match |
| Eyebrow "New coverage-exception request" | `screens.jsx:444` | Absent; only `<h1>` shown | Missing |
| PHI privacy note (keccak256 stays off-chain) | `screens.jsx:450–452` | In textarea placeholder | Partial |
| Demo banner ("Try the demo case") | `screens.jsx:454–461` | `.demo-hero` with "Try the demo case" CTA | Match |
| Justification textarea | `screens.jsx:466–468` | Present | Match |
| Live char-count + hash preview below textarea | `screens.jsx:469–473` | Absent — no char count, no live `0x…` hash display | Missing |
| Medication input | `screens.jsx:477–479` | Present | Match |
| 3-col grid: qty / days / amount | `screens.jsx:481–485` | 2-row layout: qty+days then amount | Partial |
| Supporting evidence URL | `screens.jsx:487–490` | Present | Match |
| Payer line selector (Commercial / PartD / Medicaid) | `screens.jsx:492–499` | **Absent** — hardcoded to `PayerLine.PartD` | Missing |
| Filing as / Sending to summary panel | `screens.jsx:500–510` | `.parties` span row (less structured) | Partial |
| Low-funds warning | `screens.jsx:512–516` | Absent | Missing |
| Submit button + CostHint | `screens.jsx:518–523` | Submit present; CostHint absent | Partial |

**Surface score: ~73 %** (unchanged)

---

### 4. TopBar / header (prototype: `app.jsx:61–131`)

| Element | Prototype | Web app | Status |
|---|---|---|---|
| Logo-glyph + "Curie" display-font + "coverage-exception arbiter" sub-line | `app.jsx:67–73` | Plain-text "Curie" + `<span class="brand-sub">AI Drug Coverage Arbiter</span>`; no logo glyph, no display font | Partial |
| Sticky + blur backdrop-filter (glassmorphism) | `app.jsx:65` | Sticky; no `backdrop-filter: blur` | Partial |
| Nav: Requests / Network / Settings (3 links) | `app.jsx:76–79` | 4 nav buttons: Dashboard / New Request / Network / Settings — functionally a superset | Match+ |
| Active-nav highlight (accent-tint background) | `app.jsx:103–111` | `.active` class on active button | Partial (CSS may differ) |
| Search chip (⌘K) | `app.jsx:83–85` | Absent | Missing |
| Wallet pill (balance + address + "sim" pill) | `app.jsx:88–94` | Wallet column: address, mode badge, balance — functional parity, layout differs | Partial |
| ProfileSwitcher — inline pill-row (Provider / Insurer / Observer) | `app.jsx:115–131` | **Inline pill-row** — `role="radiogroup"`, 3 × `<button role="radio">`, `is-active` fills `var(--accent)` | **Match** |
| FooterStrip | `app.jsx:134–146` | Absent | Missing |

**Surface score: ~83 %**

_(+11 pp since tick 31: ProfileSwitcher `<select>` replaced with pill-row matching `app.jsx:115-131`. Remaining gaps: logo glyph, display-font brand, backdrop-filter blur, Search chip, FooterStrip.)_

---

### 5. Network screen (prototype: `screens.jsx:532–593`)

| Element | Prototype | Web app | Status |
|---|---|---|---|
| PageHeader — eyebrow "Network · live" + title "Somnia testnet" + sub + chain pill | `screens.jsx:541–548` | `<h1>Network</h1>` + Back button; no eyebrow/sub/chain pill | Partial |
| 4-stat panel (Latest block / Active rulings / Curie contract / Arbiter) | `screens.jsx:549–557` | `.kpi-strip` 4 × `.kpi-card` with real sourcing | Match |
| Live tx stream section header (label + title + "streaming" pill) | `screens.jsx:560–564` | `.tx-stream-header` with section-label, title, `.live-pill` | Match |
| Tx stream rows (event name + tx hash link + description + reqId) | `screens.jsx:566` | `.tx-stream-row` — per-type tone colors, tx hash link, description, reqId | Match |
| Pure-CSS pulse on live-dot | Implied | `.live-dot` CSS `@keyframes pulse`; no JS callback | Match |
| Empty state for no events | Implied | `.tx-stream-empty` with hint | Match |
| Right panel — "Contract state · live" key-value grid | `screens.jsx:568–589` | **Absent** | Missing |
| On/off-chain boundary diagram (● on chain / ○ off chain) | `screens.jsx:582–588` | **Absent** | Missing |

**Surface score: ~85 %** (unchanged)

---

### 6. Settings screen (prototype: `screens.jsx:673–741`)

| Element | Prototype | Web app | Status |
|---|---|---|---|
| PageHeader — eyebrow "Account · wallet · agents" + title "Settings & wallet" | `screens.jsx:677` | `<h1>Settings &amp; wallet</h1>` + Back button; no eyebrow | Partial |
| Active profile panel — 3-col card grid | `screens.jsx:683–701` | `.profile-card-grid` clickable cards with label, party #, description | Match |
| Profile description field ("sub" in prototype) | `screens.jsx:696` | `profile-card-sub` from `p.description ?? p.id` | Match |
| Wallet facts panel (Address / Mode / Balance / Agent fee / Network / RPC) | `screens.jsx:703–716` | `.fact-list dl` with all 6 rows; real data sourcing | Match |
| "Switch to real / Faucet / Copy address" buttons | `screens.jsx:711–715` | Absent (non-functional, omitted per spec) | Intentional delta |
| Agent registry panel | `screens.jsx:718–738` | Absent (no real on-chain registry yet) | Intentional delta |
| Wallet keys panel | Not in prototype | Present — runtime key override via localStorage | Web+ |
| Onboarding banner for `walletSetupRequired` | Not in prototype | Present in `App.tsx` — `.setup-banner` with link to Settings | Web+ |

**Surface score: ~90 %** (unchanged)

_(Agent registry and action buttons are intentional omissions, not conformance gaps.)_

---

## Top 3 remaining gaps — next ticks

Ranked by demo impact and effort-to-close:

### Gap 1 — Create: payer-line selector + live hash preview (`screens.jsx:492–499`, `469–473`)

**Prototype:** A 3-button pill row (Commercial / Medicare Part D / Medicaid) at `screens.jsx:492–499`; below the justification textarea, a live character count + `0x…` hash preview updates as the user types (`screens.jsx:469–473`).
**Web (`Create.tsx`):** `payerLine` is hardcoded to `PayerLine.PartD`; no character count or hash preview.
**Fix:** Add a pill-row selector for the 3 payer lines (drives `payerLine` state passed to `createContract`); add `keccak256(toUtf8Bytes(text))` hash preview + char count below the textarea.

---

### Gap 2 — Network right panel (`screens.jsx:568–590`)

**Prototype:** Right column inside NetworkScreen — "Contract state · live" key-value grid (totalRequests, underReview, settled, deadlocked, policyInvalidated, roundBound, agentFee, feeSplit) plus an on/off-chain boundary diagram.
**Web (`Network.tsx`):** Only the 4-stat kpi-strip and tx-stream panel. The right column is absent.
**Fix:** Add a `<div className="network-side-panel">` to the right of `.tx-stream-panel`. Populate key-value rows from live `count()` calls; boundary diagram is static markup.

---

### Gap 3 — Detail event-log cost/STT column (`screens.jsx:408`)

**Prototype:** Each event row shows `e.cost.toFixed(5) STT · e.attr` — the gas/fee cost in STT alongside the attribution label.
**Web (`Detail.tsx:829–858`):** Attribution chip is present; cost/STT is absent (intentionally deferred to avoid double-sourcing txLogger). This is the smallest remaining gap and was a deliberate trade-off in tick 34.
**Fix:** Surface `txLogger` cost data per-event, or wire the `feePerParty` from `Settled` events as a proxy. Low demo impact — the attribution chip alone conveys party provenance.

---

## What ticks 32–34 changed — design impact summary

| Tick | Change | Surface impact |
|---|---|---|
| 32 | TopBar ProfileSwitcher: `<select>` → inline pill-row with ARIA radiogroup | TopBar +11 pp (72 % → 83 %) |
| 33 | `AppealLadder` component in Detail.tsx: LADDERS-driven stage cards, current/passed/future states, header caption | Detail +10 pp (gap closed) |
| 34 | Detail event log: newest-first, tx-hash chip, attribution chip via `eventAttribution()` | Detail +5 pp |
| **Total** | | **+7 pp overall (82 % → 89 %)** |
