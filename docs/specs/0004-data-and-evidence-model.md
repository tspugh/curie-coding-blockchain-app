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

### 2.1 (2026-05-29) Demo data: cases (not trajectories), one per payer line

Scenarios in v0 are **cases**, not pre-baked trajectories: each case bundles inputs
(note, drug, payer profile, evidence packet) and the arbiter actually rules. Outcomes
are *expected* (documented in `expected-outcome.md` for regression-detection) but not
hard-coded — a curated case that flips under an arbiter-model swap is a signal, not a
bug to hide.

- **R1 (MUST) Synthetic notes only.** Zero real PHI in the demo bundle, including in
  fixtures, snapshots, or test data. Synthetic = author-written + sanity-checked, not
  "scrubbed real notes." See `docs/domain/coverage-exception-process.md` on why
  de-identification ≠ regex.
- **R2 (MUST) Three curated cases — one per payer line.** The demo ships exactly three
  curated cases, each on a different `payerLine`, each illustrating a different shape of
  the protocol:
  - **`partd-approvable/`** — Part D, clean on-label medical-necessity case the arbiter
    is expected to approve. Demonstrates the happy path against a real CMS Part D
    formulary slice.
  - **`commercial-policy-void/`** — Commercial, off-label-policy gotcha: the payer's
    policy denies an FDA-on-label use on "experimental/investigational" grounds. Arbiter
    is expected to approve and mark the policy clause void (the SPEC-0002 set-piece;
    surfaces §2.6 R23).
  - **`medicaid-denied-then-appealed/`** — Medicaid MCO, denied-then-appealed: initial
    PA-criteria denial at `(Medicaid, 0)`, walks through `(Medicaid, 1)` Plan Internal
    Appeal with new evidence, expected to flip on appeal.
- **R2a (MUST) Custom-case path.** The Detail view exposes a **custom case** affordance
  alongside the curated three: a judge can (i) **autofill** the form from any curated
  case and edit free-form fields (note text, requested drug, payer profile, evidence
  packet entries) before creating the contract, or (ii) **author from scratch**.
  Custom cases produce **real on-chain contracts** with real arbiter rulings — they are
  not stubs. The judge-experimentation story rides on this requirement.
- **R2b (MUST) Configurable provider/payer wallets, per-instance.** Each contract
  instance — curated or custom — carries explicit `providerAddr` and `payerAddr`
  parameters specified at creation, so two judges (or one judge with two browser
  tabs / two wallets) can interact through the same contract: provider files;
  payer accepts/denies; on approve, escrow settles to provider.
  - **Wallet provisioning is out of scope here** — judges use **their own wallet**
    (any EOA via WalletConnect / MetaMask / embedded-wallet per SPEC-0005). This
    spec specifies the *data binding* between addresses and contract roles; the
    wallet UX is owned by the wallet/session work — formerly SPEC-0005, now
    folded into [SPEC-0003 §2.5](0003-token-flow-visibility.md) per the
    2026-05-29 in-flight consolidation.
  - **v0 demo provisioning model** (delegated to SPEC-0005 §2.5 to write up
    formally): shared dev wallet remains the default for single-judge demos
    (no setup); a chrome-level **"spin up second wallet"** affordance creates an
    ephemeral session-scoped EOA (privkey in `sessionStorage`, faucet-funded from
    a small Curie-run drip) for multi-wallet experimentation; crypto-native
    judges can BYOW via WalletConnect / MetaMask. Two browser sessions sharing
    the same dev key do NOT count as multi-wallet (AC-1 enforces this).
  - **Address inputs at create.** The Create form accepts `providerAddr` and
    `payerAddr` as either (a) "use my connected wallet" for one side, (b) a raw
    `0x…` paste for the counterparty, or (c) a QR-code / link-share affordance
    (the creator sends the contract URL to the counterparty; the counterparty
    opens it with their own wallet connected).
  - **Counterparty visibility.** A wallet connected as `payerAddr` of an existing
    contract MUST be able to see that contract on landing (via the same event
    subscription / RPC reads the provider uses).
  - **Per-role authorization invariant.** Calls that mutate state (submit evidence,
    accept, request adjudication, settle) MUST revert if `msg.sender` is neither
    `providerAddr` nor `payerAddr` per their per-method scope. (This is SPEC-0001
    R11 territory; restated here as an acceptance criterion because the multi-
    wallet flow is the test surface.)
  - **Settlement target.** On `Approve`, escrow MUST transfer to `providerAddr`,
    not the contract creator (these can be the same address — but the spec is
    about the data binding, not the identity assumption).
  - **Acceptance criteria for v0:**
    - AC-1: Two distinct EOAs (any source — own wallets, embedded-wallet stand-ins,
      or two browser sessions with different keys) can each connect to the demo and
      see the active-wallet chip reflect their own address + balance.
    - AC-2: Wallet `A` can create a contract specifying `payerAddr = address(B)`
      (raw paste or share-link). Wallet `B`, on connecting, sees that contract in
      its list view.
    - AC-3: Wallet `B`'s `accept` call succeeds (`msg.sender == payerAddr`).
      Wallet `A` attempting the same `accept` call reverts with a clear error.
    - AC-4: On `Approve`, the recorded settlement transfer's recipient equals
      `providerAddr` (wallet `A`), regardless of who triggered settlement.
    - AC-5: Switching wallets (disconnect / reconnect with a different key)
      updates the active-wallet chip and the visible-contracts list within one
      poll window.
- **R3 (SHOULD) Per-case stage picker — documented stages, always shown.** Each
  curated case displays the **full documented arc** of its ladder traversal as a
  per-case picker, using `expected-outcome.md` for the documented stages. Stage
  entries render with state badges:
  - **`reached`** — the case has actually been driven to this stage on-chain;
    clicking scrolls the timeline to the historical entry.
  - **`current`** — the contract is at this stage now; highlighted.
  - **`upcoming`** — documented future stage; clicking opens the R21 explainer
    tooltip (so a judge can preview what IRE Reconsideration *will look like*
    without driving the case there).
  - **`skipped`** — a documented stage the case *won't* visit because an earlier
    stage produced a terminal ruling (e.g., `partd-approvable` approves at round 0,
    so rounds 1 - 3 render with a skipped icon and a one-line "not reached:
    approved at round 0" hint).
  No fabricated-prior-rounds path: clicking `upcoming` shows the explainer but
  does NOT mutate chain state. To actually walk a stage, the case has to be
  driven there.
- **R4 (MUST) Per-case authoring contract.** Each case under
  `demo-data/scenarios/<slug>/` ships exactly these files:
  - `note.md` — synthetic clinical note (plain text, ~200-400 words).
  - `packet.json` — the initial evidence packet body (schema per §2.3).
  - `payer-profile.json` — `{ payerLine, planId | carrier+product, formularyRelease,
    state? }` per §2.2.
  - `requested-drug.json` — `{ ndc, rxnormCui, name, dose, quantity, requestedFor }`.
  - `expected-outcome.md` — narrative of the expected ruling + cited reasoning, used
    by CI to flag arbiter-drift on model swaps.
  Adding a scenario is one folder, not a code change.

### 2.2 (2026-05-29) Formulary: real, per-payer-line source, deterministic

Each payer line has a different *kind* of authoritative source. The protocol's invariant
is "exactly one source consulted per ruling" — but that source varies in shape across
lines, and v0 takes that variance as an arbiter-side parsing job rather than forcing
upstream normalization.

- **R5 (MUST) Real per-line formulary data.** Each case binds to a real, publicly-
  published formulary source for its payer line:
  - **Part D** — a specific CMS-published `(contract, PBP)` formulary file (drug list +
    tiers + PA / ST / QL flags), e.g., `S5810-001` for an Aetna SilverScript plan.
  - **Commercial** — a specific carrier + product + revision (e.g., Aetna Open Access
    Elect Choice POS, 2026-04 revision), sourced from the carrier's published drug list.
    Format is typically PDF.
  - **Medicaid MCO** — a specific `(state, MCO, revision)` (e.g., Centene Medi-Cal in
    California, 2026-Q2). Format varies; typically PDF + a separate PA-criteria document.
- **R6 (MUST) Single-source-of-truth invariant.** Exactly one formulary source is
  consulted per ruling, named in `payer-profile.json`. The arbiter does not federate
  across multiple sources or fall back to others if the primary is silent on a drug. If
  the requested drug isn't in the source, the arbiter rules "not addressed by the
  source-of-truth formulary; defer to manual review" — it does *not* hunt elsewhere.
- **R7 (MUST) Deterministic read.** The formulary source is **content-hashed at pin
  time** and the hash is recorded with the ruling. Re-running against the same hash MUST
  produce the identical ruling, modulo the per-round LLM seed.
- **R8 (MUST) Per-line release pin.** Each case's `payer-profile.json` carries
  `formularyRelease: { line, planIdOrProduct, releaseDate, sourceUrl, contentHash }`
  so a viewer sees the exact dataset they're being judged against — and so a third
  party can re-fetch and verify. Surfaced in the UI alongside the active stage chip.
- **R8a (MUST) Variable-shape, arbiter-side reading.** The arbiter consumes each
  formulary source in its native shape (CMS JSON, carrier PDF, MCO PA criteria
  document) via Somnia's `LLM Parse Website` / `JSON API` primitive *at submission
  time*, extracting the entries it needs into the packet slice. v0 does **not**
  pre-normalize formularies into a uniform JSON; the per-line shape diversity is
  itself a demo affordance (see §2.3 B-2-hybrid parse placement). An optional
  arbiter helper API (`extractFormularyEntry(drug, sourceUrl) → slice`) MAY be
  exposed if it simplifies the submission-agent path; out-of-scope for v0 if not
  needed.

### 2.3 (2026-05-29) Evidence: structured slices, Merkle-committed, off-chain packet store

- **R9 (MUST) Off-chain evidence collection.** Public-reference evidence (FDA label slice,
  clinical guideline excerpt, comparative-effectiveness cite, NADAC / Cost Plus price
  benchmarks) is gathered by the **parties' off-chain agents** before submission. The party
  is responsible for sourcing; the protocol is responsible for *judging* the resulting
  packet.
- **R10 (MUST) Frozen evidence packet per round, structured slices.** Each round's
  submission carries a **packet** of cited public references. Each reference is
  `{ url, contentHash, slice }`, where `slice` is a structured wrapper:
  ```ts
  type EvidenceReference = {
    url: string;                  // public source URL
    contentHash: `0x${string}`;   // keccak256 of the source's bytes at fetch time
    slice: {
      text: string;                              // the excerpt the arbiter reads
      kind?: "fda-label-indication" | "fda-label-contraindication"
           | "guideline-recommendation" | "formulary-entry"
           | "price-benchmark";
      locator?: { section?: string; page?: number; cssPath?: string };
    };
  };
  ```
  The packet body is committed on-chain via the **Merkle root over its leaves**, where
  each leaf is `keccak(abi.encode(url, contentHash, keccak(JSON.stringify(slice))))` —
  i.e., the slice IS committed (closes the "party invents slice text that doesn't
  appear in the source" gap). The arbiter rules against the frozen packet as the
  default; the bounded per-round invocation is **one agent call**, with one explicit
  optional exception under R10b.
- **R10a (MUST) Off-chain packet store, content-addressed.** Packet bodies live in the
  **Curie packet store** — an S3 bucket fronted by CloudFront for reads and a single
  write-Lambda behind API Gateway for writes. The bucket is keyed by Merkle root:
  ```
  GET https://store.curie-claims.example.com/packets/<merkleRoot>.json   # public
  POST https://api.curie-claims.example.com/packets                       # body → root
  ```
  The write-Lambda recomputes the Merkle root from the body and rejects mismatched
  submissions. Curated demo packets are uploaded via a `scripts/deploy-fixtures.sh`
  step; custom-case packets POST through the Lambda at submission time. Same code
  path consumes both downstream. No versioning, no soft-delete, no auth on reads —
  content-addressing IS the database.
- **R10b (SHOULD) B-2-hybrid parse-time placement.** Parties pre-extract evidence
  slices at submission time using Somnia's `LLM Parse Website` / `JSON API` primitive
  (the "show off the LLM parsing PDFs/JSON" affordance lives at submission, where it
  doesn't stress R10's bounded per-round call). The arbiter at ruling time MAY
  optionally invoke `verifySliceAgainstSource(referenceIndex)` **at most once per
  ruling**, only for a contested-claim slice flagged in the ruling rationale (e.g.,
  the FDA-label gotcha). The verification call result is appended to the ruling
  payload as `verification: { referenceIndex, verdict, fetchedAt }` so it is visible
  in the timeline and recoverable in replay. v0's bounded-call guarantee thus reads:
  "one agent call per round in the common case; at most two in the explicit
  verification case."
- **R11 (MUST) Source attribution in the ruling.** Every ruling cites which packet
  entries it relied on by `(referenceIndex, leafHash)`, so a third party can replay
  the ruling against the same Merkle root and verify it. The ruling payload carries
  `usedReferenceIndices: number[]` and `usedLeafHashes: bytes32[]`.
- **R12 (SHOULD) Provenance clarity in the UI.** Each cited reference renders with its
  `slice.kind` label (`FDA label — indication`, `Formulary entry`, `NADAC price`, etc.)
  next to the snippet — not a bare hash. The reference's `url` is offered as a
  click-through that opens in a new tab.

### 2.4 (2026-05-29) Appeal-stage labels: hybrid — ladder named on-chain, stage named in UI

- **R13 (MUST) Ladder named on-chain.** The contract carries a `payerLine: enum { PartD,
  Commercial, Medicaid }` on each contract instance and a per-round `appealRound: uint8`.
  The combination `(payerLine, appealRound)` is enough for the contract to look up
  ladder-specific rules (see R14) without baking any single jurisdiction's vocabulary into
  the schema. **Medicaid v0 = MCO (managed-care) model only**; fee-for-service Medicaid
  is deferred to v0.1 — see §2.5 and [domain Finding 5 follow-up](../domain/coverage-exception-process.md).
- **R14a (MUST, v0) Sequencing enforced on-chain.** No skipping levels — the contract
  refuses `requestAdjudication(round=N)` unless `round=N-1` was actually ruled, and
  ruled `Deny`. This is the only ladder-enforcement predicate v0 ships on-chain.
- **R14b (DEFERRED to V1.5) Filing windows, AIC thresholds, terminal-round caps.**
  The remaining ladder-enforcement predicates are **documented but not enforced** in v0:
  - **Filing windows.** Each `(payerLine, appealRound)` carries a max time-from-prior-
    ruling before the appeal lapses (Part D `(PartD, 1/2/3)` = 60 days each;
    commercial `(Commercial, 1)` = 180 days, `(Commercial, 2)` = 4 months; Medicaid
    `(Medicaid, 1)` = 60 days, `(Medicaid, 2)` = 120 days). v0 records `decidedAt`
    timestamps but does **not** revert past-window submissions.
  - **Threshold gates.** Part D `(PartD, 3)` ALJ ≈ $200 in 2026. v0 does **not**
    enforce; submissions under the threshold are accepted.
  - **Terminal-round caps.** Each ladder has a documented maximum round (PartD = 3,
    Commercial = 2, Medicaid = 2); v0 does **not** revert beyond-max submissions.
  Rationale: enforcement is invisible during a 5-minute demo (a revert because a
  submission landed 61 days late doesn't show on screen), and the values are subject
  to per-state overrides + annual CMS updates we are not sourcing for v0. Full
  enforcement design lives in
  [`../technical-design/appeal-ladder-enforcement.md`](../technical-design/appeal-ladder-enforcement.md);
  implementation is V1.5+ work.
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
  { name, description, citation, window, threshold }` table ships as a typed constant
  in the library so the UI, off-chain tools, and tests render the same labels the
  contract enforces against. The `description` and `citation` columns are added in
  service of R21 (in-UI context). The `window` and `threshold` columns are
  documented-only for v0 (R14b deferred).
- **R21 (SHOULD) In-UI ladder context.** Stage names are presented with regulatory
  context so a viewer understands what they're seeing without leaving the page:
  - **Stage-picker entries** carry a **1-sentence description + a cited link**
    (opens in a new tab) — light depth, fits a dropdown.
  - **Active-stage chip tooltip** carries a **2-4 sentence description + the same
    cited link** — medium depth, fits a hover-popover where a judge actually pauses
    to read.
  - The text and citations live in the same `LADDERS` library constant (R16's
    extended schema), so contract / library / UI / tests stay in lockstep.
- **Rationale.** The contract knows enough to enforce the *ladder's* sequencing
  without leaking one ladder's vocabulary into a schema the other ladder doesn't use.
  The UI keeps domain-fluent stage names visible to viewers and payer-side
  operators. New payer lines (Medicaid, military, etc.) extend the `payerLine` enum
  + the static table without re-architecting the state machine.
- **Implementation reference.** Concrete window / threshold values per `(payerLine,
  appealRound)`, predicate sketches, and the ladder-table SoT proposal live in
  [`../technical-design/appeal-ladder-enforcement.md`](../technical-design/appeal-ladder-enforcement.md)
  — marked V1.5+ for the deferred enforcement bits.

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
  - **`(Medicaid, 1)`** — *Plan Internal Appeal*. Federal floor: file within 60 days
    of the initial adverse determination. Plan has 30 days to decide (72 hours
    expedited). *Window numbers documented only; enforcement deferred per R14b.*
  - **`(Medicaid, 2)`** — *External Medical Review / State Fair Hearing* (v0 collapses
    these two parallel external paths into a single contract round; the UI labels it
    "External Medical Review / State Fair Hearing" per R15). Federal floor: file within
    120 days of the plan's internal-appeal decision. *Window numbers documented only;
    enforcement deferred per R14b.*
- **R18 (SHOULD) Fee-for-service Medicaid is a v0.1 follow-up.** Direct-state-billed
  Medicaid follows a different ladder (state grievance → State Fair Hearing → judicial
  review) governed by 42 CFR §431.220+. Adding it would require either (a) a
  `lineSubtype: { MCO | FFS }` axis on the contract or (b) a separate `PayerLine`
  enum value. Decision deferred — captured here so v0.1 work knows the structural cost.
- **R19 (MUST) No amount-in-controversy threshold on Medicaid rounds.** Unlike Part D
  ALJ ($200), Medicaid MCO appeals are right-of-access regardless of dollar amount.
  The threshold column in the ladder table is null for all `(Medicaid, *)` entries.
  *(Moot for v0 since R14b defers all threshold enforcement — kept here as durable
  ladder semantics for V1.5.)*
- **R20 (MUST) State-specific window overrides are out of scope for v0.** The 60-day
  internal-appeal and 120-day external windows in R17 are the **federal floor**; some
  states adopt longer windows. v0 does not enforce any windows (R14b). State-specific
  overrides remain off-scope through V1.5 alongside R18 — both can ride a single
  Solidity table extension when added.

### 2.6 (2026-05-29) Arbiter policy defaults (Decision 6)

The arbiter is **semi-neutral**: it rules on the parties' submitted packets, but it
applies a small set of **protocol-level invariants** that hold regardless of payer
line or per-instance policy. These are floors, not biases — they constrain which
rulings are reachable, not which side wins on the contested merits.

- **R22 (MUST) FDA-contraindication hard floor.** The arbiter MUST NOT issue an
  `Approve` ruling for a use the FDA label explicitly contraindicates (e.g.,
  warning-box contraindications, `"contraindicated in patients with X"` clauses).
  Enforced as a final-ruling check in the contract:
  ```solidity
  require(!(ruling.outcome == Outcome.Approve
            && packet.citesContraindication(ruling.usedReferenceIndices)),
          "FDA-contraindicated use cannot be approved");
  ```
  The packet's `slice.kind == "fda-label-contraindication"` is the typed signal the
  helper consults. Hard NO; not rebuttable; protocol invariant.
- **R23 (MUST) On-label policy-void rule.** If the policy clause cited in a denial
  is contradicted by an FDA-label slice the arbiter accepts (e.g., the policy
  labels a use "experimental/investigational" for an indication the FDA label
  includes), the arbiter MUST rule `Approve` and emit a `policyVoidedClauseIndices:
  number[]` field in the ruling payload identifying which policy-quote leaves are
  invalidated. The voided clause is rendered in the timeline as
  `policy clause N — VOIDED by FDA label §X` (R12 provenance). This is the
  SPEC-0002 set-piece and the `commercial-policy-void` curated case's outcome.
- **R24 (MUST) Hybrid cost-band rule (at settlement).** When the arbiter rules
  `Approve` with a payable amount, the settlement amount MUST fall within the
  public-benchmark band drawn from NADAC and Cost Plus (and GoodRx as a tertiary
  cross-check). If the requested amount falls outside the band without
  justification cited in the packet, the arbiter settles at the band, not at the
  requested amount. The band sources and dates are recorded in the ruling.
  Constrains *settlement*, not *approval*.
- **D2 (off-label evidence threshold) — prompt-level only.** Off-label uses
  require explicit clinical-evidence support and medical-necessity rationale.
  This is *judgment*, not a protocol invariant — it lives in the arbiter prompt
  and is documented in
  [`../technical-design/`](../technical-design/) (arbiter prompt design). Not a
  contract-level revert.
- **D5 (same-class alternative consideration) — deferred to V1.5.** The arbiter
  MAY suggest a covered same-class alternative when the requested drug fails on
  D2 or R24. v0 does not implement this; it's a V1.5 polish item.

### 2.7 (2026-05-30) Agent-edge ABI drift — real-mode arbiter call blocked (Decision 7)

The entire evidence-packet → arbiter → ruling pipeline this spec defines (§2.3
evidence packets, §2.6 arbiter policy defaults) depends on the contract's
`createRequest` payload reaching the live Somnia LLM Parse Website agent
(`agentId = 12875401142070969085`) with a recognised selector. **As of
2026-05-30 that call does not reach the LLM at all:** every validator in the
subcommittee rejects the calldata at viem ABI-decode and returns the same
error before any HTTP fetch or LLM inference runs. The platform finalises the
request as `ResponseStatus.Failed (3)`, our `handleResponse` is invoked with
an empty success-path, and the contract routes to `EvidenceRequested` — but
the arbiter was never actually consulted.

The selector our contract sends is `0x4be9280f`, derived from
`ExtractANumber(string,string,uint256,uint256,string,string,bool,uint8)` per
`docs.somnia.network/agents/base-agents/llm-parse-website`. The agent's
*registered* ABI on chain does not contain that selector. This is **ABI
drift between the published docs and the live registered agent**, not a bug
in this repo's interface mirror.

Why this belongs in SPEC-0004 specifically: §2.3 (evidence packets) and §2.6
(arbiter policy defaults) define how the arbiter consumes inputs and produces
rulings. None of that is testable end-to-end while the on-chain
`createRequest` payload is unparseable to the agent runtime. This is *the*
data-flow edge for this spec.

- **R25 (MUST — blocker) The on-chain agent invocation MUST encode calldata
  using a selector and ABI that match the LIVE registered ABI for the
  configured agent id — NOT the docs-example ABI on
  `docs.somnia.network`.** Authoritative source for the registered ABI is
  `AgentRegistry @ 0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A` (surfaced via
  the Somnia agent explorer; queryable on-chain). Acceptable resolutions:
  1. Regenerate `IParseWebsiteAgent` inside
     `contracts/contracts/ISomniaAgent.sol` from the live registry response,
     update `CoverageNegotiation.sol:759` to call the regenerated selector,
     redeploy.
  2. Switch `AGENT_ID` (in `.env` + deployment constants) to a different
     registered agent whose ABI matches the existing `ExtractANumber`
     signature this repo already uses, and verify selector match before
     re-firing.
  3. Roll our own agent under a controlled id whose ABI we own.
- **R26 (MUST) Agent-ABI drift check at build time.** Extend SPEC-0001 R19's
  Solidity-mirror posture from covering only the *platform* interface
  (`IAgentRequester` / `IAgentRequesterHandler`) to also cover the *agent*
  interface our contract emits selectors for. Concretely:
  - `scripts/check-somnia-interface.ts` (R19's drift check) MUST be extended,
    OR a new `scripts/check-agent-abi.ts` added, that fetches the registered
    ABI for the configured `AGENT_ID`, recomputes the selector for the
    function our contract calls, and **fails the build / CI on mismatch**.
  - On each commit that bumps `AGENT_ID` or the agent-interface mirror, the
    commit body MUST cite the upstream registry response (or an equivalent
    snapshot) — same posture R19 requires for the platform mirror.
- **R27 (MUST) Until R25 lands green, no demo or recorded artifact MAY claim
  end-to-end real-mode arbitration.** Simulated mode demos are fine and must
  be labelled `(simulated — real-mode currently blocked by SPEC-0004 §2.7
  R25)`. This is the responsible-claim gate, mirrored by SPEC-0003 §2.10 R48
  on the visibility side (renumbered from PR #14's `§2.9 R42` on merge to
  avoid collision with the already-landed UNIT-7a wallet-config decision).

**Evidence (Somnia testnet, captured 2026-05-30):**

| Item | Value |
|---|---|
| isolation contract | `0x063c9E322971E162D943fd36Ca59299ffB889b21` |
| fire tx | `0x34b2b8eeb443a3638cc8c460066fc17d0bcb5fea668bd60bf7e181e1fdbd7813` |
| validator-1 response tx | `0xc45e34b5cce8fb5d2fe02fd332c16b491386e12a3f7db1569102e2d94ae2c24e` |
| validator-2 response tx | `0x63e85dedb6ffea96e0edbeecb03826b571bde5d57ba5af70905a3794df2cdfc9` |
| validator-3 response tx | `0x13161d853098c8beeb22e819f485a7c6ef19a54944f2e54418e1404a0ea07912` |
| agent id | `12875401142070969085` (LLM Parse Website) |
| selector sent | `0x4be9280f` (`ExtractANumber(string,string,uint256,uint256,string,string,bool,uint8)`) |
| validator error (verbatim) | `"ABI decode failed (selector=0x4be9280f): … not found on ABI. Make sure you are using the correct ABI and that the function exists on it. … viem@2.46.1"` |
| platform finalisation | `RequestFinalized(requestId=3183908, status=3 Failed)` |
| production contract impact | `contracts/contracts/CoverageNegotiation.sol:759` calls the same selector against the same agent id |

**Cross-spec.** SPEC-0003 §2.10 (R48, R49) covers the *visibility* side
(distinguishing fee-burned-no-work from fee-paid-LLM-ran). R25 here is the
*root-cause fix*; once R25 lands, R48 can be verified, R49 becomes a polish
hardening. Renumbered from PR #14's `R42/R43` on merge.

## 3. Technical documentation

### 3.1 Scenario storage

Each curated case lives under `demo-data/scenarios/<slug>/` (R4 file set). The note
hash is committed at request creation; the hash + the byte-identical note are what
both parties verify.

### 3.2 Formulary references (per payer line)

Each case's `payer-profile.json` names its formulary source — there's no in-repo
`formulary/<release>/formulary.json` file because v0 reads formularies in their native
shape (CMS JSON, carrier PDF, MCO PA document) via the arbiter's `LLM Parse Website` /
`JSON API` primitive at submission time (R8a). What's checked in is just the *pointer*:

```ts
type FormularyRelease =
  | { line: "PartD"; planId: string;       releaseDate: string; sourceUrl: string; contentHash: `0x${string}`; }
  | { line: "Commercial"; carrier: string; product: string; revision: string; sourceUrl: string; contentHash: `0x${string}`; }
  | { line: "Medicaid"; state: string;     mco: string; revision: string; sourceUrl: string; contentHash: `0x${string}`; };
```

The `contentHash` is the hash of the upstream document at pin time (R7).

### 3.3 Evidence packet store

Packet bodies live in the **Curie packet store** (R10a) — S3 + CloudFront for reads,
a single write-Lambda behind API Gateway for writes:

```
Bucket: curie-packets-v0
Layout:
  packets/<merkleRoot>.json     # evidence packet bodies (one per (request, round))
  scenarios/<slug>/note.md      # curated synthetic notes (read-only)
  scenarios/<slug>/packet.json  # curated initial packet fixtures (read-only)

Read:   GET  https://store.curie-claims.example.com/<key>     (public, CloudFront)
Write:  POST https://api.curie-claims.example.com/packets     (Lambda + API Gateway)
          body: { references, submittedAt, submittedBy }
          server: recomputes Merkle root from body, rejects if mismatch, writes
                  packets/<root>.json (idempotent on root collision with same body),
                  returns { packetRoot, url }
          reject: malformed JSON, oversized (>256 KB), root-collision-with-different-body
```

Demo fixtures are uploaded once by a deploy step (`scripts/deploy-fixtures.sh`).
Custom-case packets POST through the Lambda at runtime. The off-chain agent reads
bodies from the public CloudFront URL keyed by the on-chain packet root. No
versioning, no soft-delete, no read-auth — content-addressing is the database.

### 3.4 Evidence packet schema

```ts
type EvidenceReference = {
  url: string;                  // public source URL
  contentHash: `0x${string}`;   // keccak256 of the source bytes at fetch time
  slice: {
    text: string;
    kind?: "fda-label-indication" | "fda-label-contraindication"
         | "guideline-recommendation" | "formulary-entry" | "price-benchmark";
    locator?: { section?: string; page?: number; cssPath?: string };
  };
};

type Packet = {
  references: EvidenceReference[];
  submittedAt: number;
  submittedBy: `0x${string}`;
};

// Per-leaf hash: keccak(abi.encode(url, contentHash, keccak(JSON.stringify(slice))))
// Packet Merkle root: Merkle root over all leaves.
```

### 3.5 Arbiter call shape

```solidity
event PacketSubmitted(
    uint256 indexed requestId,
    uint8   indexed round,
    bytes32 packetRoot,
    string  packetUrl  // hint to fetch the body from the Curie packet store
);

function requestAdjudication(
    uint256 requestId,
    uint8 round,
    bytes32 packetRoot,
    string calldata packetUrl
) external payable;
```

The on-chain agent invocation is bounded to **one call per round** in the common case,
**at most two** under R10b's verification exception. The returned ruling carries:

```ts
type Ruling = {
  outcome: "Approve" | "Deny" | "EvidenceRequested";
  usedReferenceIndices: number[];          // R11
  usedLeafHashes: `0x${string}`[];         // R11
  policyVoidedClauseIndices?: number[];    // R23
  verification?: {                          // R10b — present iff verify-slice was invoked
    referenceIndex: number;
    verdict: "matches-source" | "diverges-from-source";
    fetchedAt: number;
  };
  settlementAmount?: bigint;                // R24 — present iff Approve
  rationaleHash: `0x${string}`;             // SPEC-0003 §2.7 hook
};
```

### 3.6 LADDERS library constant (R16 + R21)

```ts
type LadderRow = {
  name: string;            // R15
  description: string;     // R21 medium-depth (also light-extracted for picker)
  citation: { label: string; url: string };  // R21 link
  window?: number;         // documented-only in v0 (R14b deferred)
  threshold?: bigint;      // documented-only in v0 (R14b deferred)
};
export const LADDERS: Record<PayerLine, LadderRow[]> = { /* PartD, Commercial, Medicaid */ };
```

Same JSON source-of-truth feeds both the Solidity sequencing checks (R14a, names only)
and the TS UI.

## 4. Deliverables

- `demo-data/scenarios/{partd-approvable,commercial-policy-void,medicaid-denied-then-appealed}/`
  each with the R4 file set (`note.md`, `packet.json`, `payer-profile.json`,
  `requested-drug.json`, `expected-outcome.md`).
- **Curie packet store** infrastructure: S3 bucket + CloudFront read distribution +
  write-Lambda + API Gateway. IaC committed alongside `scripts/deploy-static.sh`.
- `scripts/deploy-fixtures.sh` — one-time uploader for curated `scenarios/<slug>/*`
  fixtures to the bucket.
- UI: scenario picker + per-case stage picker (B-1: documented stages with
  `reached`/`current`/`upcoming`/`skipped` badges) + **custom-case** affordance
  (R2a) + counterparty-address input + share-link affordance (R2b) on the Detail
  view, with stage-name labels + R21 tooltips/picker descriptions per profile.
- Library: `Packet` type + Merkle-root helper + per-round packet verifier (mirrors the
  arbiter side, so the UI can re-verify any committed packet); `LADDERS` typed constant
  extended with `description` + `citation` columns (R16/R21).
- Contract: `PayerLine` enum `{ PartD, Commercial, Medicaid }`; R14a sequencing
  predicate; `PacketSubmitted` event; R22/R23 final-ruling checks.
- Provenance rendering in the timeline (R12 — `slice.kind` label + click-through URL).

## 5. Test cases

- **T1 (R1, R2):** the demo bundle contains exactly the three curated scenarios; no
  fixture matches a hand-rolled PHI signature pattern (basic scanner in CI).
- **T2 (R2, R3):** each curated case loads end-to-end, walks its visited stages with
  the correct labels (`(PartD, 0)`, `(Commercial, 0)`, `(Medicaid, 0/1/2)`); the
  per-case picker renders `reached` / `current` / `upcoming` / `skipped` badges
  consistent with the contract's actual state.
- **T2a (R2a):** the custom-case path autofills from any curated case, accepts
  free-form edits, and produces a real on-chain contract.
- **T2b (R2b — multi-wallet AC suite):**
  - T2b-1 (AC-1): two browser sessions with distinct EOAs each show their own
    address + balance in the active-wallet chip.
  - T2b-2 (AC-2): wallet A creates contract with `payerAddr = address(B)`; wallet
    B sees the contract in its landing list within one polling interval.
  - T2b-3 (AC-3): wallet B's `accept` succeeds; wallet A's `accept` reverts with
    "not authorized for role: payer" or equivalent typed error.
  - T2b-4 (AC-4): on `Approve`, settlement-event recipient equals `providerAddr`;
    if `providerAddr ≠ creator`, the creator receives nothing.
  - T2b-5 (AC-5): disconnect-and-reconnect with a different key updates the chip
    and the visible-contracts list within one poll window (no manual refresh).
  - T2b-6 (cross-test): a custom case with `providerAddr == payerAddr` (same
    wallet on both sides) is rejected at create with a typed error (the demo
    explicitly does not support single-party self-contracting).
- **T3 (R5–R8):** two runs against the same `formularyRelease.contentHash` + same
  note + same packet root yield identical rulings (modulo LLM seed).
- **T4 (R10, R10a):** a packet whose source `url`s mid-ruling 404 still yields the
  same ruling, because the arbiter reads the Curie packet store's frozen body — no
  live source fetch (except the explicit R10b verification path).
- **T4a (R10b):** when the arbiter invokes `verifySliceAgainstSource`, the ruling
  payload carries `verification: { referenceIndex, verdict, fetchedAt }`; the
  verification call count is exactly 1 (never 2+).
- **T5 (R11):** the ruling payload carries `usedReferenceIndices` + `usedLeafHashes`
  matching the cited Merkle leaves.
- **T6 (R12):** every cited reference in the UI shows its `slice.kind` label and the
  source URL as a click-through, not just a hash.
- **T7 (R21):** stage-picker entries render a 1-sentence description + cited link;
  active-stage chip tooltip renders a 2-4 sentence description + the same link;
  both source the same `LADDERS` row.
- **T8 (R22, FDA-contraindication floor):** an attempted `Approve` ruling whose
  packet cites an `fda-label-contraindication` slice reverts at the contract; no
  state change.
- **T9 (R23, policy-void):** the `commercial-policy-void` case's ruling carries
  `policyVoidedClauseIndices` listing the offending clause; the timeline renders the
  voided-clause annotation.
- **T10 (R24, cost-band):** an `Approve` ruling with `settlementAmount` outside the
  benchmark band without packet-cited justification settles at the band; the
  ruling's recorded `settlementAmount` matches the band, not the request.

## 6. Pass / fail criteria

**PASS:** all three scenarios run end-to-end; the stage picker walks the named appeal ladder;
two runs against the same inputs are bit-identical (modulo seed); the evidence panel shows
provenance; no fixture has a hand-PHI signature; **§2.7 R25 has landed green (live-agent
selector match verified by `scripts/check-agent-abi.ts`) AND at least one curated case has
produced a real `ResponseStatus.Success` ruling against the live agent on testnet.**
**FAIL:** the demo only has one note; the arbiter consults more than one formulary; the
on-chain ruling fans out to multiple agent calls in a round; rulings differ across runs with
the same inputs; **the live-agent selector check is missing or failing (§2.7 R26).**

## 7. Out of scope

- Real CDS-Hooks / EHR-side note ingestion (SPEC-0002 R7 / future).
- Cross-payer formulary federation (deliberately not done; R6).
- Live (runtime) formulary scraping / network fetches *except* the explicit R10b
  verification path (one optional call per ruling, only for contested slices).
- Multi-tenant / per-org overrides of the source-of-truth formulary.
- Filing-window math, AIC-threshold reverts, terminal-round caps (R14b — V1.5+).
- State-specific ladder overrides (R20 — V3+).
- Fee-for-service Medicaid (R18 — v0.1).
- Packet store versioning, soft-delete, write rate-limiting, generic application-data
  API. The packet store is content-addressed and write-once for v0; broader
  data-layer concerns are deferred.

## 8. Open questions / tracked tasks

- **Q2 (§2.4) — Appeal-stage labels.** **RESOLVED 2026-05-29:** hybrid — `(payerLine,
  appealRound)` on-chain (with v0 sequencing only, R14a), stage names + R21 context
  rendered in the UI via the `LADDERS` table. See §2.4 R13/R15/R16/R21.
- **Q3 — Per-line formulary release pin.** **RESOLVED 2026-05-29:** each case carries
  its own `formularyRelease` in `payer-profile.json` (R8). Specific PBP / carrier-product
  / state-MCO selections per case are deferred to the research output (TASK-2).
- **Q4 — Curie packet store host.** **RESOLVED 2026-05-29:** S3 + CloudFront + Lambda
  per §3.3. DNS choice (curie-claims.example.com vs. existing CloudFront distribution)
  is an infra concern, not a spec concern.
- **TASK-1 — Real de-identified note corpus.** Track sourcing a real de-id'd
  clinical-note corpus (MIMIC-III/IV, n2c2, or a licensed payer-side corpus) for
  post-demo real-world testing. Don't block the demo on it. **OPEN.**
- **TASK-2 — Case-research outputs.** Three research prompts saved at
  [`../research/spec-0004-research-prompts.md`](../research/spec-0004-research-prompts.md)
  — concrete case candidates (drugs, indications, formulary entries, notes), NDC →
  alternatives APIs (RxNav / OpenFDA / DailyMed selection), and authoritative
  formulary sources per payer line. Hand to an agent; the outputs land as the
  concrete inputs to the three curated `demo-data/scenarios/<slug>/` folders.
  **OPEN.**
- **TASK-3 — Arbiter prompt design (D2 + R10b).** The arbiter prompt encoding the
  off-label evidence threshold (D2) and gating the R10b verification call lives in
  the technical-design folder. **OPEN.**
- **TASK-4 (§2.7) — Resolve live-agent ABI drift (R25).** Query
  `AgentRegistry @ 0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A` for the registered
  ABI of agent `12875401142070969085`; pick a resolution path (regenerate
  `IParseWebsiteAgent`, switch `AGENT_ID`, or self-deploy an agent); land R26's
  build-time drift check. Blocks SPEC-0003 §2.10 R48 and the SPEC-0004 PASS
  criterion above. **OPEN.** *(Renumbered from PR #14's `TASK-3` on merge to
  avoid collision with the arbiter-prompt-design TASK-3 above.)*

## Implementation plan (auxiliary)

> Non-normative. Sequences the data + evidence + ladder work into landable PRs.
> SPEC-0004 is **highest priority** of the in-flight specs (functional). Implementation
> reference for the ladder enforcement lives in
> [`../technical-design/appeal-ladder-enforcement.md`](../technical-design/appeal-ladder-enforcement.md).

### Phase 1 — Contract changes (§2.4 R13 + R14a only + §2.5 R17 labels + §2.6 R22/R23/R24)

Highest-risk phase — Solidity edits + tests must land cleanly before any UI
can read the new shape. Bundle into a single contracts PR so the storage
layout change is reviewed as a whole. Per the v0 trim in R14b, this phase
ships ONLY R14a (sequencing) — filing-window math, thresholds, and
terminal-round caps are deferred to V1.5.

- `contracts/contracts/CoverageNegotiation.sol`:
  - Add `PayerLine` enum `{ PartD, Commercial, Medicaid }`.
  - Add `payerLine` + `appealRound` to the `Negotiation` struct (storage slot
    change — ensure existing test fixtures regenerate).
  - **R14a sequencing predicate only:** `require(rounds[N-1].decision ==
    Decision.Deny, "prior round not denied")` for any `requestAdjudication(round=N>0)`.
  - **R22 FDA-contraindication final-ruling check:** revert `Approve` rulings
    that cite an `fda-label-contraindication` slice.
  - **R23 policy-void payload field:** accept `policyVoidedClauseIndices` in
    the ruling payload from the agent callback.
  - **R24 cost-band check at settlement:** clamp `settlementAmount` to the
    benchmark band when the packet doesn't carry a cited justification.
  - **Multi-wallet (R2b) plumbing:** `createContract` accepts explicit
    `providerAddr` + `payerAddr`; reject self-contract (`providerAddr ==
    payerAddr`).
  - **PacketSubmitted event** per §3.5.
  - **DEFERRED to V1.5:** `LADDER_WINDOW`, `LADDER_THRESHOLD`, `MAX_ROUND` —
    documented in `appeal-ladder-enforcement.md` but not implemented in v0.
- `contracts/test/CoverageNegotiation.test.ts`:
  - Per-line sequencing test (round N requires round N-1 ruled Deny).
  - R22 negative case: arbiter ruling Approve with contraindication slice reverts.
  - R23 positive case: arbiter ruling Approve with `policyVoidedClauseIndices`
    records them in the ruling.
  - R24 positive case: out-of-band settlement amount clamps to band.
  - R2b T2b suite per §5: AC-1 through AC-5.
- `contracts/scripts/deploy.ts` + `deploy-mock.ts` — no changes beyond the
  PacketSubmitted event ABI consumers.

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

- `demo-data/scenarios/` (new directory) — three slugs per R2:
  - `partd-approvable/`
  - `commercial-policy-void/` — uses the FDA-contradicting clause (the gotcha)
  - `medicaid-denied-then-appealed/` — walks `(Medicaid, 0)` → `(Medicaid, 1)`
- Each folder ships the R4 file set: `note.md`, `packet.json`,
  `payer-profile.json`, `requested-drug.json`, `expected-outcome.md`.
- Content sourced from TASK-2 research output ([Prompt 1](../research/spec-0004-research-prompts.md#prompt-1--three-concrete-case-candidates)).
- Loader: `src/demo/scenarios.ts` — `listScenarios()`, `loadScenario(slug)`.
- UI hook into Create's "Load Demo Case" button + R2a custom-case path (SPEC-0003
  owns the chrome).

### Phase 4 — Per-line formulary release pins (§2.2 R5–R8 + R8a)

- **No checked-in formulary file.** v0 reads formularies in their native shape
  via Somnia's `LLM Parse Website` / `JSON API` at submission time (R8a). The
  repo only ships *pointers* in `payer-profile.json`.
- `src/protocol/formulary.ts` (new) — `FormularyRelease` discriminated-union
  type per §3.2 + a helper that hashes the upstream document at pin time.
- `scripts/pin-formulary.ts` (new) — for each curated scenario's
  `payer-profile.json`, fetches the upstream source, computes `contentHash`,
  writes the result back into the profile. Run when curating a case or
  re-pinning to a newer release.
- Per-line source selections come from TASK-2 ([Prompt 3](../research/spec-0004-research-prompts.md#prompt-3--authoritative-formulary--policy-sources-per-payer-line)).

### Phase 5 — Evidence packet + Merkle helper + Curie packet store (§2.3 R9–R12 + R10a + R10b)

- `src/protocol/packet.ts` (new) — `EvidenceReference` + `Packet` type per
  §3.4, Merkle-leaf hasher `keccak(abi.encode(url, contentHash,
  keccak(JSON.stringify(slice))))`, per-round packet verifier.
- **Curie packet store** infra (R10a):
  - S3 bucket `curie-packets-v0` + CloudFront distribution for public reads.
  - Write Lambda + API Gateway route `POST /packets` per §3.3.
  - `scripts/deploy-fixtures.sh` — uploads `scenarios/<slug>/*` to the bucket.
  - IaC committed alongside `scripts/deploy-static.sh`.
- `RealBackend.requestAdjudication` extended to (1) compute the Merkle root,
  (2) POST the body to the packet store, (3) emit `PacketSubmitted(requestId,
  round, packetRoot, packetUrl)` per §3.5.
- Agent callback shape extension per §3.5 `Ruling` type:
  `usedReferenceIndices`, `usedLeafHashes`, optional
  `policyVoidedClauseIndices`, optional `verification` (R10b),
  optional `settlementAmount` (R24), `rationaleHash`. Coordinate with the
  Somnia agent platform configuration.

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
