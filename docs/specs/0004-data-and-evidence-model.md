# SPEC-0004: Data + evidence model

Status: Draft · Owner: tspugh · Date: 2026-05-29 · Builds on: [SPEC-0001](0001-mvp0-coverage-negotiation.md), [SPEC-0002](0002-demo-experience-and-integration-seam.md) · Grounded in: [`docs/domain/coverage-exception-process.md`](../domain/coverage-exception-process.md), [A-0003](../amendments/0003-ai-mediated-drug-coverage-exception-arbitration.md)

> **Scope.** The **shared-facts model** for the protocol: what the parties hand each other
> (the de-identified note), what the arbiter rules against (public references + formulary),
> and how those move on-chain. Captures the design decisions made 2026-05-29. **No new
> protocol opcodes** beyond what A-0003 already commits to — this spec pins how the inputs to
> the existing flow are sourced, shaped, and frozen.

## 1. Summary & user story

> As a **viewer driving the demo end-to-end**, I want to load any of several **realistic
> synthetic patient notes** and watch the same arbiter rule on each — and as a **payer
> reviewer**, I want every ruling to be grounded in a **real, public Part D formulary** plus
> **frozen, cited public evidence** — so that "the AI mediator is fair and replayable" is
> demonstrable, not a claim.

## 2. Decisions

### 2.1 (2026-05-29) Demo data: synthetic, multiple, walking real named stages

- **R1 (MUST) Synthetic notes only.** Zero real PHI in the demo bundle, including in
  fixtures, snapshots, or test data. Synthetic = author-written + sanity-checked, not
  "scrubbed real notes." See `docs/domain/coverage-exception-process.md` on why
  de-identification ≠ regex.
- **R2 (MUST) Multiple note options.** The demo ships **≥ 3** distinct synthetic-note
  scenarios — minimum: an **approvable** path (clean medical-necessity case), a
  **policy-void / FDA-contradicting** path (the SPEC-0002 gotcha), and a **denied →
  appealed** path that walks through more than one of the named appeal stages.
- **R3 (MUST) Stage-walking demo control.** The Detail view offers a per-scenario **stage
  picker** that loads the negotiation at the start of any named stage (initial request →
  redetermination → IRE reconsideration → ALJ — Part D; or internal appeal → external review
  — commercial). The picker labels each stage with its real-world name and a one-line
  description (sourced from the domain doc).
- **R4 (SHOULD) Scenario authorability.** Notes + accompanying packet (cited public refs,
  formulary slice, requested-drug spec) live under `demo-data/scenarios/<slug>/` so adding a
  scenario is one folder, not a code change.

### 2.2 (2026-05-29) Formulary: real Part D, deterministic, single-source

- **R5 (MUST) Real Part D formulary data.** The demo's formulary is sourced from a real,
  published CMS Part D formulary file (drug list + tiers + PA/ST/QL flags), not
  hand-fabricated. The arbiter reads from this single source; same data, same result, every
  run.
- **R6 (MUST) Single-source-of-truth invariant.** Exactly one formulary file (or one
  endpoint) is consulted per ruling. The arbiter does not federate across multiple sources or
  fall back to others if the primary is silent on a drug. If a drug isn't in the source, the
  arbiter rules "not addressed by the source-of-truth formulary; defer to manual review" —
  it does *not* hunt for the drug elsewhere.
- **R7 (MUST) Deterministic read.** The formulary is **content-hashed at fetch time** and
  the hash is recorded with the ruling. A re-run against the same hash MUST produce the
  identical ruling, modulo the per-round LLM seed if applicable.
- **R8 (SHOULD) Versioning.** Pin the formulary to a specific monthly release; surface the
  release date in the UI so a viewer can see *which* Part D formulary they're being judged
  against.

### 2.3 (2026-05-29) Evidence: off-chain agent collection, on-chain single-ruling-per-round

- **R9 (MUST) Off-chain evidence collection.** Public-reference evidence (FDA label slice,
  clinical guideline excerpt, comparative-effectiveness cite, NADAC / Cost Plus price
  benchmarks) is gathered by the **parties' off-chain agents** before submission. The party
  is responsible for sourcing; the protocol is responsible for *judging* the resulting
  packet.
- **R10 (MUST) Frozen evidence packet per round.** Each round's submission carries a
  **packet** of cited public references as `{ url, contentHash, sliceJson }` tuples,
  committed on-chain by hash. The arbiter rules against the *frozen* packet — no on-chain
  fetch sub-calls, no "go look this up" mid-ruling. This is the cost-discipline guarantee:
  the per-round on-chain agent invocation is **bounded to one call**.
- **R11 (MUST) Source attribution in the ruling.** Every ruling cites which packet entries
  it relied on by index + content-hash, so a third party can replay the ruling against the
  same packet and verify it.
- **R12 (SHOULD) Provenance clarity in the UI.** Each cited reference renders with its
  source (`FDA label`, `Part D formulary 2026-MM`, `NICE guideline`, `NADAC YYYY-MM-DD`)
  next to the snippet — not a bare hash. This is the "be clearer about where evidence is
  coming from" thread you flagged.

### 2.4 (2026-05-29) Appeal-stage labels: hybrid — ladder named on-chain, stage named in UI

- **R13 (MUST) Ladder named on-chain.** The contract carries a `payerLine: enum { PartD,
  Commercial, Medicaid }` on each contract instance and a per-round `appealRound: uint8`.
  The combination `(payerLine, appealRound)` is enough for the contract to look up
  ladder-specific rules (see R14) without baking any single jurisdiction's vocabulary into
  the schema. **Medicaid v0 = MCO (managed-care) model only**; fee-for-service Medicaid
  is deferred to v0.1 — see §2.5 and [domain Finding 5 follow-up](../domain/coverage-exception-process.md).
- **R14 (MUST) Ladder-specific rules enforced on-chain.** The contract enforces the rules
  that *differ* between the Part D, commercial, and Medicaid (MCO) ladders, indexed by
  `(payerLine, appealRound)`:
  - **Filing windows.** Each `(payerLine, appealRound)` carries a max time-from-prior-
    ruling before the appeal lapses (e.g., Part D `(PartD, 2)` IRE-reconsideration round =
    60 days from the redetermination ruling; commercial `(Commercial, 2)` external review =
    payer-line-specific window). Submissions past the window revert.
  - **Threshold gates.** Some rounds require an amount-in-controversy threshold
    (Part D `(PartD, 3)` ALJ ≈ $200 in 2026). Submissions under the threshold revert.
  - **Sequencing.** No skipping levels — the contract refuses
    `requestAdjudication(round=N)` unless `round=N-1` was actually ruled (denied) first.
  - **Terminal rounds.** Each ladder has a maximum round; past that, only `Settled` /
    `Deadlocked` are reachable. Part D goes through Council + federal court (treated as
    terminal off-chain — the contract stops at ALJ for v0); commercial maxes out at
    external review.
- **R15 (MUST) Stage names rendered in the UI per payer profile.** The UI looks up the
  stage name from `(payerLine, appealRound)` via a static table mirroring
  [Finding 4 / 5](../domain/coverage-exception-process.md):
  - `(PartD, 1)` → "Redetermination"
  - `(PartD, 2)` → "IRE Reconsideration"
  - `(PartD, 3)` → "ALJ / OMHA Hearing"
  - `(PartD, 4)` → "Medicare Appeals Council" *(out of scope for v0 — see R14 terminal)*
  - `(Commercial, 1)` → "Internal Appeal"
  - `(Commercial, 2)` → "External Review"
  - `(Medicaid, 1)` → "Plan Internal Appeal"
  - `(Medicaid, 2)` → "External Medical Review / State Fair Hearing" *(v0 collapses
    the two into a single round; see §2.5)*
- **R16 (SHOULD) Static ladder table in the library.** The `(payerLine, appealRound) →
  { name, description, window, threshold }` table ships as a typed constant in the library
  so the UI and any off-chain tools render the same labels the contract enforces against.
- **Rationale.** The contract knows enough to enforce the *ladder's* rules (filing windows,
  sequencing, thresholds) without leaking one ladder's vocabulary into a schema the other
  ladder doesn't use. The UI keeps domain-fluent stage names visible to viewers and payer-
  side operators. New payer lines (Medicaid, military, etc.) extend the `payerLine` enum +
  the static table without re-architecting the state machine.
- **Implementation reference.** Concrete window / threshold values per `(payerLine,
  appealRound)`, predicate sketches, and the ladder-table SoT proposal live in
  [`../technical-design/appeal-ladder-enforcement.md`](../technical-design/appeal-ladder-enforcement.md).

### 2.5b (2026-05-29) UI considerations (cross-link)

The functional/data decisions in §2.1–§2.4 imply UI surfaces that are owned by
[SPEC-0003](0003-token-flow-visibility.md):

- **Scenario picker** (R2/R3): UI affordance owned by SPEC-0003 polish work.
- **Stage picker walking real named stages** (R3): renders from the static
  `(payerLine, appealRound) → stage name` table in R15; SPEC-0003 owns the chrome.
- **Formulary version chip** (R8): renders the pinned Part D release date so a
  viewer sees *which* formulary they're being judged against; SPEC-0003 §2.1 R4
  (attribution) is the right slot.
- **Provenance chip in timeline** (R12): each cited reference rendered with its
  source label, not a bare hash. Owned by SPEC-0003 §2.7 R33 (agent-receipt
  explorer).
- **AI reasoning explorer**: the *data* shape (rationale, used-reference indices,
  receipt id) is owned here in R11; the *UI surface* that displays it is
  [SPEC-0003 §2.7 R33–R36](0003-token-flow-visibility.md#27-2026-05-29-ai-reasoning--agent-receipt-visibility-decision-7).
- **Submit-amount gating by wallet balance**: orthogonal to the data model, owned
  by [SPEC-0003 §2.6](0003-token-flow-visibility.md#26-2026-05-29-submit-amount-gating-by-wallet-balance-decision-6).

### 2.5 (2026-05-29) Medicaid MCO ladder (Decision 5)

Medicaid is added as a third `payerLine` per the §2.4 hybrid model. The Medicaid
landscape has two distinct delivery models with materially different appeal
mechanics — v0 covers only the managed-care variant because that's where ≈75% of
Medicaid enrollees are today (per [domain Finding 5 follow-up](../domain/coverage-exception-process.md)).

- **R17 (MUST) Medicaid v0 = MCO (Managed Care) ladder.** The contract treats
  `payerLine: Medicaid` as the managed-care variant governed by 42 CFR §438.402.
  Concretely, the two-round MCO appeal flow:
  - **`(Medicaid, 0)`** — initial coverage determination by the MCO.
  - **`(Medicaid, 1)`** — *Plan Internal Appeal*. MUST file within 60 days of the
    initial adverse determination. Plan has 30 days to decide (72 hours expedited).
  - **`(Medicaid, 2)`** — *External Medical Review / State Fair Hearing* (v0 collapses
    these two parallel external paths into a single contract round; the UI labels it
    "External Medical Review / State Fair Hearing" per R15). MUST file within 120 days
    of the plan's internal-appeal decision.
- **R18 (SHOULD) Fee-for-service Medicaid is a v0.1 follow-up.** Direct-state-billed
  Medicaid follows a different ladder (state grievance → State Fair Hearing → judicial
  review) governed by 42 CFR §431.220+. Adding it would require either (a) a
  `lineSubtype: { MCO | FFS }` axis on the contract or (b) a separate `PayerLine`
  enum value. Decision deferred — captured here so v0.1 work knows the structural cost.
- **R19 (MUST) No amount-in-controversy threshold on Medicaid rounds.** Unlike Part D
  ALJ ($200), Medicaid MCO appeals are right-of-access regardless of dollar amount.
  The threshold column in the ladder table is null for all `(Medicaid, *)` entries.
- **R20 (MUST) State-specific window overrides are out of scope for v0.** The 60-day
  internal-appeal and 120-day external windows in R17 are the **federal floor**; some
  states adopt longer windows. v0 enforces only the federal floor. State-specific
  overrides are a follow-up alongside R18 — both can ride a single Solidity table
  extension when added.

## 3. Technical documentation

- **Note storage:** under `demo-data/scenarios/<slug>/note.md` (synthetic, plain text). The
  note hash is committed at request creation; the hash + the byte-identical note are what
  both parties verify.
- **Formulary:** under `demo-data/formulary/<part-d-release>/formulary.json`, derived from
  the CMS published file. The repo carries a **build-time fetch script** that pulls the
  current month's file (no runtime network calls — the file is checked in, hash-stable).
- **Evidence packet schema:**
  ```ts
  type Packet = {
    references: Array<{ url: string; contentHash: `0x${string}`; slice: unknown }>;
    submittedAt: number;
    submittedBy: Address;
  };
  ```
  The packet is hashed (Merkle root of `(url, contentHash)` tuples) and the root is the only
  on-chain field; the body lives off-chain alongside the note.
- **Arbiter call:** `requestAdjudication(requestId, roundIndex, packetMerkleRoot)` triggers
  exactly one off-chain agent invocation per round, fed the packet body + note + formulary
  slice. The returned ruling carries the indices of the references it relied on.
- **Stage labels (pending §2.4):** if generic, `appealRound: uint8`; if named, a Solidity
  enum mirroring the domain doc's Finding 4 ladder for Part D and a separate enum for
  commercial.

## 4. Deliverables

- `demo-data/scenarios/{approvable,policy-void,denied-then-appealed}/` with `note.md`,
  `packet.json`, and `payer-profile.json` each.
- `demo-data/formulary/<release>/formulary.json` + the build-time fetch script.
- UI: scenario picker + stage picker on the Detail view, with stage-name labels per profile.
- Library: `Packet` type + Merkle-root helper + per-round packet verifier (mirrors the
  arbiter side, so the UI can re-verify any committed packet).
- Provenance chip in the timeline (R12).

## 5. Test cases

- **T1 (R1, R2):** the demo bundle contains exactly the synthetic notes; no fixture matches a
  hand-rolled PHI signature pattern (basic scanner in CI).
- **T2 (R3):** the stage picker, fed each Part D scenario, loads each named stage and renders
  the correct label (Redetermination / IRE Reconsideration / ALJ / Medicare Appeals Council).
- **T3 (R5–R7):** two runs against the same formulary hash + same note + same packet yield
  identical rulings (modulo any LLM seed control we add).
- **T4 (R10):** a packet whose references mid-ruling 404 still yields the same ruling, because
  the arbiter only reads the frozen body — no live fetch.
- **T5 (R11):** the ruling-payload carries `usedReferenceIndices` matching what's cited in
  the rationale.
- **T6 (R12):** every cited reference in the UI shows its source label, not just a hash.

## 6. Pass / fail criteria

**PASS:** all three scenarios run end-to-end; the stage picker walks the named appeal ladder;
two runs against the same inputs are bit-identical (modulo seed); the evidence panel shows
provenance; no fixture has a hand-PHI signature. **FAIL:** the demo only has one note; the
arbiter consults more than one formulary; the on-chain ruling fans out to multiple agent
calls in a round; rulings differ across runs with the same inputs.

## 7. Out of scope

- Real CDS-Hooks / EHR-side note ingestion (SPEC-0002 R7 / future).
- Cross-payer formulary federation (deliberately not done; R6).
- Live (runtime) formulary scraping / network fetches.
- Multi-tenant / per-org overrides of the source-of-truth formulary.

## 8. Open questions / tracked tasks

- **Q2 (§2.4) — Appeal-stage labels.** **RESOLVED 2026-05-29:** hybrid — `(payerLine,
  appealRound)` on-chain (so the contract can enforce ladder-specific filing windows,
  thresholds, and sequencing), stage names rendered in the UI via a static table. See
  §2.4 R13–R16.
- **TASK-1 — Real de-identified note corpus.** Track sourcing a real de-id'd clinical-note
  corpus (e.g., MIMIC-III/IV note subsets, n2c2 challenges, or a licensed payer-side corpus)
  for post-demo real-world testing. Don't block the demo on it; we want a path beyond
  synthetic notes once the protocol is exercising the loop end-to-end. **OPEN.**
- **Q3 follow-up — Which Part D release?** Pin a specific monthly release (e.g., the latest
  stable CMS posting) so the demo cites a specific dataset; revisit before the hackathon
  cutoff if newer.

## Implementation plan (auxiliary)

> Non-normative. Sequences the data + evidence + ladder work into landable PRs.
> SPEC-0004 is **highest priority** of the in-flight specs (functional). Implementation
> reference for the ladder enforcement lives in
> [`../technical-design/appeal-ladder-enforcement.md`](../technical-design/appeal-ladder-enforcement.md).

### Phase 1 — Contract changes (§2.4 R13–R16 + §2.5 R17–R20)

Highest-risk phase — Solidity edits + tests must land cleanly before any UI
can read the new shape. Bundle into a single contracts PR so the storage
layout change is reviewed as a whole.

- `contracts/contracts/CoverageNegotiation.sol`:
  - Add `PayerLine` enum `{ PartD, Commercial, Medicaid }`.
  - Add `payerLine` + `appealRound` to the `Negotiation` struct (storage slot
    change — ensure existing test fixtures regenerate).
  - Add `LADDER_WINDOW[payerLine][appealRound]` + `LADDER_THRESHOLD[…]`
    constants per `appeal-ladder-enforcement.md`.
  - Predicates: `_withinFilingWindow`, sequencing checks, threshold checks,
    `maxRound[payerLine]` terminal.
  - Backwards-compat: `createContract` defaults `payerLine = PartD` when
    callers don't supply it, so existing test fixtures continue to compile.
- `contracts/test/CoverageNegotiation.test.ts`:
  - Three new scenarios: Part D ladder (ALJ threshold + 60-day window),
    commercial ladder (180-day internal-appeal window), Medicaid MCO ladder
    (60-day internal + 120-day external, no threshold).
  - Negative cases: above-threshold ALJ, below-threshold ALJ, expired
    filing window, ladder-skip attempt.
- `contracts/scripts/deploy.ts` + `deploy-mock.ts` — no changes; ladder is
  pure storage.

### Phase 2 — Library + TS LADDERS constant (§2.4 R15–R16)

The off-chain mirror of the ladder table. Same JSON SoT as the Solidity
constants (build-time codegen or hand-mirror + CI consistency check — see
§3 of the technical-design doc).

- `src/protocol/ladders.ts` (new) — the typed `LADDERS` constant per the
  technical-design doc.
- `src/contract/real.ts`, `src/contract/simulated.ts` — read `payerLine` +
  `appealRound` from the contract's `getNegotiation`; expose via the
  `Negotiation` type.
- `src/contract/types.ts` — add `payerLine: PayerLine`, `appealRound: number`
  fields.

### Phase 3 — Synthetic scenarios + scenarios directory (§2.1 R1–R4)

- `demo-data/scenarios/` (new directory):
  - `approvable/` — note.md + packet.json + payer-profile.json
  - `policy-void/` — uses the existing FDA-contradicting clause
  - `denied-then-appealed/` — walks through `(PartD, 1)` Redetermination at
    minimum
- Loader: `src/demo/scenarios.ts` — `listScenarios()`, `loadScenario(slug)`.
- UI hook into Create's "Load Demo Case" button (SPEC-0003 owns the chrome).

### Phase 4 — Real Part D formulary fetch + pin (§2.2 R5–R8)

- `scripts/fetch-formulary.ts` (new) — pulls a specific CMS Part D release
  to `demo-data/formulary/<release>/formulary.json`. Run at build time; the
  output is checked in.
- Hash-pinning: `demo-data/formulary/<release>/.hash` carries the content
  hash for R7's "two runs against same hash yield identical ruling" guarantee.
- `src/protocol/formulary.ts` (new) — loader + typed accessor.

### Phase 5 — Evidence packet + Merkle helper (§2.3 R9–R12)

- `src/protocol/packet.ts` (new) — `Packet` type, Merkle-root helper,
  per-round packet verifier.
- `RealBackend.requestAdjudication` extended to accept the packet body +
  derive the Merkle root; off-chain serialisation alongside the note.
- Agent callback shape extension: `usedReferenceIndices: number[]` +
  `rationaleHash: bytes32`. Coordinate with the Somnia agent platform
  configuration.

### Phase 6 — Plumb ladder through the UI (read-only)

Just the surface needed for SPEC-0003 §2.7 to render stage names. No
new requirements here — it's the read path for §2.4 R15.

- `web/src/views/Detail.tsx` — pass `(payerLine, appealRound)` from
  `Negotiation` to the action panel's stage label via `LADDERS`.

### Test approach

- `contracts/test/*` — Hardhat tests for every ladder × every round; positive
  and negative cases per phase 1.
- `src/protocol/*.test.ts` — Vitest unit tests for the TS mirror (parity with
  Solidity constants checked via a generated comparison).
- One full e2e per ladder in `web/tests/agent-browser/` — exercise the loop
  end-to-end against synthetic notes.

### PR strategy

Sequential PRs, gated on Phase 1 landing:
1. Contracts PR (Phase 1) — review carefully; storage-layout change.
2. Library PR (Phase 2) — adds LADDERS + Negotiation type fields.
3. Scenarios + formulary PR (Phases 3 + 4 bundled — both are data).
4. Packet PR (Phase 5).
5. UI read-path PR (Phase 6) — small.

### Cross-spec dependencies

- SPEC-0003 §2.7 (AI reasoning panel) depends on Phase 5's agent callback
  shape extension.
- SPEC-0003 §2.5 (wallet/onboarding) is independent — can land in parallel
  with any phase.
