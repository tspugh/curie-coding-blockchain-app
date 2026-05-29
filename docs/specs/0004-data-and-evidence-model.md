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
  Commercial }` on each contract instance and a per-round `appealRound: uint8`. The
  combination `(payerLine, appealRound)` is enough for the contract to look up
  ladder-specific rules (see R14) without baking any single jurisdiction's vocabulary into
  the schema.
- **R14 (MUST) Ladder-specific rules enforced on-chain.** The contract enforces the rules
  that *differ* between the Part D and commercial ladders, indexed by `(payerLine,
  appealRound)`:
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
