# SPEC-0002: MVP0 demo experience — live negotiation, policy-void "gotcha", integration seam

Status: Draft · Owner: tspugh · Date: 2026-05-27 · Builds on: [SPEC-0001](0001-mvp0-coverage-negotiation.md)

> **Scope.** SPEC-0001 defines the *protocol* (contract, necessity arbiter, deterministic
> cap, `PolicyInvalidated`, etc.). **SPEC-0002 is the *experience* layer**: it makes the
> demo a living, interactive negotiation a viewer can drive, lands the standout
> **FDA-label policy-void "gotcha"** moment, proves the chain is real, and adds a **mocked
> CDS-Hooks entry point** so the future EHR integration is a slot-in, not a rebuild. It adds
> **no new on-chain behavior** beyond SPEC-0001; it's UI + fixtures + a thin mock seam.

## 1. Summary & user story

A viewer (judge / prospective buyer) opens the app and **drives a coverage-exception end to
end as a living negotiation** — submitting positions, evidence, and appeals and watching the
**covered amount and the agent's rationale evolve round by round**, with state transitions
animating. The set-piece is the **"gotcha"**: load an insurer policy whose clause contradicts
the drug's **FDA-approved indication**; the agent **flags the clause and voids the contract**
(`PolicyInvalidated`), and the UI shows the offending clause **struck through beside the FDA
citation**. Every ruling is **verifiable** (links to the Somnia explorer / shows the event +
hash). A **mocked EHR `order-sign`** entry demonstrates the embedded-in-workflow future.

> As a **viewer**, I want to *play* the negotiation and watch an impartial agent's number and
> reasoning change as the parties argue — and see it **throw out a non-compliant payer policy**
> on the spot — so the protocol feels real, fair, and alive, not like a form submission.

## 2. Requirements

- **R1 (MUST) Live evolving negotiation view.** The detail view renders the negotiation as a
  **timeline that updates live** (from the SPEC-0001 event stream): each round shows the
  agent's **current covered amount + rationale + cited clause**, and **state transitions
  animate** (`Open → Ready → UnderReview → Priced/Approved/Denied → … → Settled/Deadlocked/
  PolicyInvalidated`). Runs in **simulated mode** (no funds) so anyone can drive it.
- **R2 (MUST) Interactive drive.** The viewer can act as **provider or insurer** (profile
  switch), submit positions/evidence/appeals, accept, and see each ruling land live — the
  full SPEC-0001 loop, click-driven.
- **R3 (MUST) The FDA-label "gotcha".** A one-click **"load non-compliant policy"** path
  attaches an insurer policy whose clause contradicts the drug's FDA-approved indication; the
  agent emits `PolicyFlagged` and routes to terminal `PolicyInvalidated` (SPEC-0001 R6b). The
  UI **highlights the offending clause** (struck-through) **beside the cited FDA standard**,
  with a plain-language "voided because…" explanation. Fixtures: `demo-data/policy-noncompliant.md`
  (exists) + an FDA-label/indication fixture.
- **R4 (MUST) Verifiability.** Each on-chain ruling/receipt is **inspectable**: in real mode a
  **deep link to the Somnia explorer** (tx + receipt); in simulated mode the event + content
  hash are shown with a "verify" affordance. Makes "it's actually on-chain" legible.
- **R5 (SHOULD) Price gauge.** Visualize **requested vs NADAC vs Cost Plus vs covered** so the
  deterministic cap (SPEC-0001 R6a) is obvious at a glance.
- **R6 (SHOULD) Wallet-gating demo.** Switch **provider / insurer / observer**; the observer
  can **view** everything but every action is disabled, and a **third-wallet attempt is shown
  rejected** (SPEC-0001 R11) — neutrality + access control made visible.
- **R7 (MUST) CDS-Hooks integration SEAM (mocked).** A **mocked inbound EHR `order-sign`**
  payload opens the Create flow **prefilled** (drug/quantity/diagnosis context → SPEC-0001
  `createContract` inputs), demonstrating the embedded entry point. Ship **typed interfaces**
  (`CdsHooksRequest<TContext,TPrefetch>`, `Card`, `SystemAction`) matching the CDS Hooks 2.0
  wire shape so the **real adapter (v1)** drops in without reshaping. **No real CDS Hooks
  server in v0** — a local fixture + the typed seam only.

## 3. Technical documentation

Built on the existing **Vite + React SPA** (SPEC-0001 R15/R16); no new contract surface. The
live timeline consumes the existing event subscription; animation is presentation-only. The
gotcha path uses `demo-data/policy-noncompliant.md` + an FDA-indication fixture and the
existing `PolicyInvalidated` flow. Explorer links use the Somnia explorer base URL + tx hash /
receipt id from the `Ruled`/`Settled` events. The **CDS-Hooks mock** is a JSON fixture shaped
like the CRD `order-sign` context (`userId`, `patientId`, `draftOrders` with the drug +
quantity + diagnosis) plus a tiny mapper to `createContract` inputs; the typed interfaces mirror
the CDS Hooks 2.0 protocol (a future off-chain adapter — not chain code — will speak the real
protocol; see SPEC-0001 §3 "off-chain glue" and the CMS-0057-F research). **No PHI / no
secrets** in the bundle: synthetic fixtures only; any real-mode key is supplied by the user at
runtime, never built in.

## 4. Deliverables

- Enhanced **Detail** view: live animated timeline, current amount/rationale/clause, accept/
  appeal/evidence controls, the gotcha clause-vs-FDA highlight.
- The **"load non-compliant policy"** demo control + FDA-indication fixture.
- **Explorer deep-links** (real) / hash-verify affordance (simulated).
- **Price gauge** (R5) + **role/wallet-gating switcher** (R6).
- **CDS-Hooks mock**: `order-sign` fixture + typed interfaces + mapper into Create.

## 5. Test cases

- **T1 (R1,R2):** agent-browser e2e drives the loop; the timeline updates per round and shows the evolving amount/rationale.
- **T2 (R3):** the non-compliant-policy path reaches `PolicyInvalidated` and the UI renders the flagged clause beside the FDA citation.
- **T3 (R4):** ruling/receipt verify affordance resolves (explorer link present in real mode; event+hash shown in simulated).
- **T4 (R6):** observer profile can view but not act; a third wallet's action is shown rejected.
- **T5 (R7):** the mocked `order-sign` fixture opens Create prefilled; the typed interfaces compile against the CDS Hooks 2.0 shape.

## 6. Pass / fail criteria

**PASS:** T1–T3 pass end-to-end (T4–T5 if R6/R7 built); the live timeline + the FDA-label
gotcha are demonstrable in simulated mode with no funds; no PHI/secrets in the built bundle.
**FAIL:** the demo is a static form with no live evolution; the gotcha doesn't visibly void +
explain; any secret/PHI ships in the static bundle.

## 7. Out of scope (→ v1)

- **Real CDS-Hooks / CMS-0057-F integration** (live CRD/DTR/PAS, a real `@curie/cds-hooks-client`) — v0 is the mock seam only.
- **Broader "flashiness"** — richer animation/theming/branding, motion design, multi-language, guided tours.
- Real-wallet production explorer UX, analytics, multi-tenant theming.

## 8. Open questions

1. Somnia explorer URL format for a tx/receipt deep link (confirm via Context7 / docs). — priority: medium
2. FDA-indication fixture source (openFDA label JSON snippet vs. a hand-authored indication line). — priority: medium
3. How much animation is "flashy enough" without becoming a maintenance/perf cost in v0. — priority: low

## Implementation plan (auxiliary)

> Non-normative. Added 2026-05-29 retrospectively — captures what was built vs.
> what's still owed against R1–R7 so future polish work knows the current state.
> Update as items land.

### Built (status: done — on main, verified via 2026-05-29 baseline screenshots)

- **R1 (live evolving negotiation view)** — `web/src/views/Detail.tsx` renders the
  timeline + per-round amount/rationale; subscribes to `client.negotiation.subscribe`.
  Visible at all four Detail screenshots in
  [`docs/progress/2026-05-29-baseline/`](../progress/2026-05-29-baseline/).
- **R2 (interactive drive)** — Provider/Insurer/Observer profile picker in the
  chrome (`web/src/App.tsx`); each profile's action affordance renders in
  `Detail.tsx`. Caveat: SPEC-0003 §2.3 R13 polish + §2.5 R27 production lockdown
  still owed.
- **R3 (FDA-label gotcha)** — "Non-Compliant Policy (Demo)" path in the engage
  flow uses `demo-data/policy-noncompliant.md` + the FDA fixture; triggers
  `PolicyInvalidated`.
- **R5 (price gauge)** — visible in baseline screenshot #4 / #5 as the
  requested-vs-covered bar.
- **R6 (wallet-gating demo)** — Observer profile registered (party 99);
  SPEC-0001 R11 contract gating enforces. UI side could surface "third wallet
  rejected" more clearly — falls under SPEC-0003 §2.3 R18 polish.

### Known gaps against R1–R7

- **R1 — live timeline doesn't backfill historical events.** Baseline issue
  #13 in the fresh-screenshots inventory: Detail of a request that pre-dates
  the current page session shows "No events yet." Either subscribe-from-block-0
  on Detail mount or call `getEvents(reqId)` before live subscription kicks in.
  Owns this fix: **SPEC-0002 cleanup PR** (small, self-contained).
- **R4 (verifiability) — explorer deep-links not yet wired.** Pending an
  answer to §8 Q1 (Somnia explorer URL format). Once known, build the link
  builder per SPEC-0003 §2.7's `web/src/lib/explorerLinks.ts` so both the
  SPEC-0002 timeline and SPEC-0003 §2.7 R33 reasoning explorer share one
  source.
- **R7 (CDS-Hooks mock + typed seam) — fixture + types not present.** Discrete
  chunk; can land independently of any other in-flight work.

### Plan for remaining gaps

Sequenced as small follow-up PRs against `main` (SPEC-0002 is **done** in the
index; these are owed-against-spec items, not new scope):

1. **SPEC-0002 cleanup PR — timeline backfill (R1).** `Detail.tsx`'s `useEffect`
   already references `client.negotiation.getEvents()`; verify it's actually
   firing and filtering by `reqId`. The baseline shows it isn't populating
   for historical requests — root cause TBD (subscription racing the historical
   fetch, or `getEvents` not being reqId-filtered). Smallest of the three.
2. **Shared `explorerLinks.ts` PR.** Builds the URL builder once both
   SPEC-0002 R4 and SPEC-0003 §2.7 R33 need it; lands behind the answer to
   §8 Q1.
3. **SPEC-0002 R7 PR — CDS-Hooks fixture + types.** Self-contained; no chain
   changes. Lands the typed interfaces + the mock JSON for the entry-point
   demo.

### Test approach

- Agent-browser regression test for R1: open Detail for a pre-existing
  `reqId`; assert the timeline shows the historical events (Filed, Engaged,
  …) without requiring a new on-chain tx during the test session.
- The CDS-Hooks types compile against the published CDS Hooks 2.0 wire
  shape — `tsc` type-check is the test.
- R4 explorer-link test: a click on a `Ruled` row in the timeline navigates
  to the expected Somnia explorer URL.
