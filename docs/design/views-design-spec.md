# Curie — UI Design Spec (handoff to Claude Code Design)

**Purpose.** This document hands the visual/layout design of Curie's core views to **Claude Code
Design**. It specifies, per view, the **components**, their **states**, the **layout intent**, and
the **constraints** — so the designer can make each view *picture-perfect* without reverse-engineering
intent from code. It does **not** prescribe pixel values where the existing design system already
answers them; it *does* flag the concrete bugs to fix.

**App is a React + Vite SPA.** Views live in `web/src/views/` (`Overview`, `Create`, `Detail`,
`Network`, `Settings`); global chrome in `web/src/App.tsx`; styling in `web/src/styles.css`.
The product: a provider files a drug-coverage request → an autonomous on-chain LLM agent reads the
cited public clinical evidence and rules on medical necessity → provider & payer accept or appeal →
escrow settles on-chain. **No PHI on-chain** (drug + justification stored only as keccak hashes).

---

## 0. Current baseline — what's already been done (don't redo)

Recent passes already landed: drug **name** instead of hash; a dashboard **"How it works"** strip;
**STT** (not wei) amounts; **unified 2-column Detail** for insurer & provider; removed the vestigial
price gauge / "Capped vs ask" KPI / "AI Covered" column; stripped spec-jargon copy; **live
reactivity** (auto-update on ruling); de-emoji'd tofu glyphs; responsive header; onboarding that
doesn't dead-end. **Treat these as settled** — refine their craft, don't reverse them.

The **open** work is: (1) the **New Request page** layout bug, and (2) a holistic **picture-perfect**
pass across New Request / Provider Detail / Insurer Detail.

---

## 1. Design system (already in `:root` of styles.css — reuse, don't reinvent)

- **Surfaces:** `--bg #f0f2f7`, `--panel #fff`, `--panel-2 #f8f9fc`, `--panel-3 #eef0f5`.
- **Borders:** `--border #dde0ea`, `--border-lt #eaedf4`, `--border-dk #c8ccd8`. **Radius:** `--radius 10px`.
- **Text:** `--text #0f172a`, `--text-2 #334155`, `--muted #64748b`, `--muted-lt #94a3b8`.
- **Accent (brand blue):** `--accent #2563eb` / `--accent-dk` / `--accent-lt #eff6ff`.
- **Semantic:** ok/green `--ok #15803d`, danger/red `--danger #b91c1c`, warn/amber `--warn #b45309`,
  purple `--purple #6d28d9` — each with `-lt` (tint) + `-mid` variants.
- **Shadows:** `--shadow-xs/sm/md/lg`.
- **Feel:** clean, professional, light, fintech-grade. Generous whitespace, soft shadows, rounded
  cards. **No emoji** for load-bearing UI (use inline SVG). Monochrome dingbats (✓/✗) are fine.

---

## 2. Global components (shared chrome)

| Component | What it is | States / notes |
|---|---|---|
| **Header / brand** | "Curie · AI Drug Coverage Arbiter" lockup, left | Must reflow below ~1100px (no h-scroll). |
| **Nav** | Dashboard · New Request · Network · Settings | Active item highlighted; clear active state on Detail. |
| **Wallet/Balance/Role cluster** | address chip + mode badge (`simulated`/`real`) + balance + **role switcher** (Provider / Payer / Observer) | Role switch re-renders the active view from that party's POV. |
| **KpiCard** | label / big value / sub-caption, optional tone (review/approved/accent) | Used on Dashboard. |
| **State badge** | pill showing friendly status ("Ready for AI", "AI Reviewing…", "Approved", "Denied", "Settled", …) | Color-coded by state; this is the single source of "where are we". |
| **State stepper** | horizontal stepper: **Filed → Policy Attached → AI Reviewing → Decision Made → Complete** | The lifecycle narrative. Active node emphasized; past nodes ✓; future dim. **Keep — it's excellent.** |
| **Next-step banner** | one-line "what happens next / who acts now" with a left accent bar | Context-aware per state + per role. |
| **Blockchain-proof panel** | collapsible "View blockchain proof" → hashes + verify-on-chain link | Communicates auditability + PHI-as-hash. |
| **Timeline** | event-by-event feed of the negotiation | Newest-first; each event one line w/ attribution. |
| **TxMonitor** | floating real-chain tx tracker, bottom-right | **Render ONLY on Detail in `real` mode. Never on New Request / Overview / Network / Settings.** (See §3.) |

---

## 3. View: **New Request** (`Create.tsx`) — ⚠️ has the active bugs

**Intent:** a focused, **full-bleed** authoring page. Nothing competes for width, so it should **fill
the screen width** (within a sensible max for readability of the form column), not sit in a narrow
centered column with a big empty gutter.

**Bugs to fix (explicit):**
1. **Remove the TxMonitor from this page entirely.** It currently renders globally and leaves a
   "big fat gap" + doesn't stick to the bottom. Gate it to Detail-only (global change in `App.tsx`).
2. **Full-width page.** Remove the max-width/centering cap that constrains the create view; let the
   demo-case hero + form use the page width. Kill the margin-driven gap on the demo-case card.
3. **Correct overall page width / rhythm** — "picture perfect": consistent gutters, aligned cards.

**Components (top → bottom):**
- **View head:** title "Request Drug Coverage" + a "Cancel" affordance.
- **Demo-case hero** (`.demo-hero`): "Try a demo case" — a **dropdown** (Adalimumab (Humira) — plaque
  psoriasis · Bupropion (Wellbutrin) — ADHD) + **"Load demo →"** + **"Load from EHR (CDS Hooks) →"**.
  This is the judge's fast path — make it prominent. Full-width.
- **Form** (`.form`):
  - *Why is this medication needed?* (textarea) — caption **"· stays off-chain"** + the privacy line
    ("only a secure hash is recorded on the blockchain") + a live **hash preview** chip. (Privacy story — keep.)
  - *Medication Name* (text).
  - *Evidence URL* — caption "auto-filled from the drug map; override allowed"; inline liveness check.
  - *Amount Requested (STT)*, *Quantity*, *Days Supply*, *Payer line* (Part D / Commercial / Medicaid).
  - **Submit Request →** (disabled until required fields valid; balance-aware in real mode).
- **States:** empty / demo-prefilled / EHR-prefilled / custom-typed / validation-error / submitting.

---

## 4. View: **Provider Detail** (`Detail.tsx`, role = Provider)

**Layout:** 2-column. **Left = the record; Right = actions.** Header shows the request # + **state badge**
+ "Acting as **Provider**" chip. The **state stepper** spans full width under the header.

**Left column — "Request Details":**
- **Medication** (drug NAME, e.g. "Adalimumab (Humira)"; full hash on hover) · Quantity · Days Supply
  · **Amount** (STT) · **AI Decision** (Not yet decided / "AI reviewing…" / Approved · X STT covered /
  Denied) · **Healthcare Provider** (actual provider address + accepted ✓) · **Insurance Company**
  (address + Accepted ✓ / Pending) · **Policy** (Attached ✓ / Not yet attached).
- **"View blockchain proof"** disclosure → hashes + verify-on-chain.

**Right column — "Actions" (provider-eligible, state-gated):**
- **Next-step banner** at top (what the provider should do now).
- **Request AI Decision** (when Ready) · **Submit more evidence** (when EvidenceRequested) ·
  **Accept** (when ruled) · **Appeal** with a stronger source (when Denied) · **Withdraw** ·
  **Add a note (kept off-chain)**.
- **Timeline** below or in left column.

**States:** Open(awaiting insurer) · Ready · UnderReview("AI reviewing…") · EvidenceRequested ·
Approved · Denied · Settled · terminal (Deadlocked/Refused/Voided/Withdrawn). The right panel's
available actions change per state; show *why* an action is unavailable rather than a dead button.

---

## 5. View: **Insurer / Payer Detail** (`Detail.tsx`, role = Insurer)

**Same 2-column shell as Provider** (this unification is intentional — do not diverge the structure).
Differences are **only** in the right-hand action panel + a couple of insurer-authoring components:
- **Attach policy / Engage** — a **policy composer**: pick an example policy or compose custom clauses;
  the chosen policy populates the clause text. Escrow warning (insurer escrows the requested STT).
- **Attestations** — de-identified provider-attestation toggles for patient-specific clauses (when present).
- **Refuse** (provider terms) · **Accept** (when ruled).
- Left column identical to Provider's record (so both parties see the same truth); the "Acting as
  **Payer**" chip + insurer-specific next-step banner ("Attach your policy", etc.).

**Goal:** a judge switching Provider↔Payer should see the **same page** with a **different action set** —
reinforcing "two-sided protocol," not two different apps.

---

## 6. Secondary views (lower priority — keep consistent, light touch)

- **Dashboard** (`Overview`): "How it works" strip + KPI row (Total / In negotiation / Approved /
  Settled) + filter pills + requests table (#, Medication-name, Status, Appeal stage, Policy,
  Requested, Round) + empty state (SVG icon). Already polished — refine spacing only.
- **Network**: live on-chain event stream + contract/block cards. In sim, hide the empty
  block/timestamp columns rather than showing em-dashes.
- **Settings**: Active profile · Users · Demo mode · Wallet · Wallet keys (· Approved evidence sources,
  once SPEC-0010 lands). Plain-English copy only.

---

## 7. Responsive & data constraints

- **Breakpoints:** header reflows < ~1100px; Detail 2-column may stack < ~900px; New Request stays
  comfortable full-width down to tablet.
- **Units:** all claim amounts in **STT**; fees in STT. Never show raw wei.
- **Identity:** show drug **names** + short addresses; full hash/address on hover (`title`).
- **No PHI** ever surfaced beyond what's local to the acting party; justification is off-chain.
- **No emoji** for load-bearing UI; **no internal jargon** (SPEC-/amendment/R-numbers) in copy.

---

## 8. Priority for this pass
1. **New Request**: TxMonitor gone, full-width, gap killed, width correct (§3).
2. **Provider & Insurer Detail**: picture-perfect rhythm, consistent 2-col, action panels clean (§4–5).
3. Dashboard/Network/Settings: spacing/consistency only.
