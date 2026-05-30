# SPEC-0005 — Usability criteria + integration testing (2026-05-30)

> **Status:** draft. Authored 2026-05-30 in response to a user direction
> shift: "the core priority now is integration test, not just unit tests".
> Subsequent ticks will land each R-numbered requirement individually with
> the loop's standard gates. Layout R-items are paired with screenshot
> evidence at the named viewport sizes.

## 1. Summary

SPEC-0001..0004 specified what to build; SPEC-0005 specifies what makes the
result **usable and demonstrably correct end-to-end**. Two intertwined goals:

1. **A real-wallet, real-chain, full-loop integration test** is the gate of
   record — beyond unit + harness + design-conformance, the loop must show
   one curated case running from field-the-request to settled, on Somnia
   testnet, with two distinct funded EOAs.
2. **The UI must hold its shape, layout, and navigation invariants** at the
   baseline viewport sizes a clinician/insurer would actually use.

## 2. User story

A clinician (provider) opens the app, files a coverage exception request,
hands off to an insurer who attaches a real policy of their own choosing
(not a binary "compliant / non-compliant" pill), the arbiter rules, both
parties accept, and the contract settles — all on testnet, with no
hand-driven workarounds and no UI artefacts that obscure the state.

## 3. Requirements

### 3.1 Integration test (the headline gate)

- **R1 (MUST) Full-loop real-wallet integration test.** A single scripted
  end-to-end run on Somnia testnet (chain 50312) covering:
  `createContract` → `insurerEngage` (from a second wallet) →
  `requestAdjudication` → arbiter ruling (`handleResponse`) → both parties
  `accept` → `settle`. Driven via the live UI with agent-browser. The test
  passes only when the on-chain `state` is `Settled` (=6) and the
  settlement event names the provider as recipient.
- **R2 (MUST) Two funded wallets.** Provider wallet (`0x2040…9128`) AND
  insurer wallet (`0x140e…8C62`) each hold ≥ 0.5 STT before the test runs.
  When either is underfunded the test SHOULD fail loud with the funding
  shortfall in the error message — never silently skip.
- **R3 (SHOULD) Per-step receipt capture.** The test records the tx hash
  for each on-chain step (create / engage / adjudicate / accept ×2 /
  settle) and writes them to `docs/progress/integration-test.md` so the
  run is auditable post-hoc.
- **R4 (SHOULD) Headless + headed parity.** The same script runs in CI
  (headless) and in dev (headed for debugging). agent-browser already
  supports both via `--executable-path`.
- **R5 (MUST, v0.5) Sim-mode parallel run.** The same flow ALSO runs in
  simulated mode against the same UI as a fast smoke check.

### 3.2 Layout invariants (verified by screenshot)

- **R6 (MUST) Top-bar density at 1280×800.** Brand, wallet chip (address +
  balance), and Role selector each occupy their own vertical column with
  ≥ 12px gutter; no text overlaps, truncates, or wraps; the wallet chip
  uses tabular-numeric STT formatting.
- **R7 (MUST) Insurer Detail single-column layout.** When the active
  profile is `insurer`, the Detail view renders the action panel +
  timeline in a single full-width column (not the provider's two-column
  grid that squishes the timeline to the right).
- **R8 (MUST) View switch returns to Overview.** Clicking any top-level
  nav item (Overview / Network / Settings) from anywhere in the app
  returns to that view's clean state — NOT a stale Detail page from a
  previous session. Detail is only reachable via "Open" on a request row.
- **R9 (SHOULD) Screenshots checked in per layout R.** Each tick that
  closes one of R6-R8 attaches a viewport screenshot to
  `docs/progress/browser-verify.md` under the R-number heading.

### 3.3 Generalized user model

- **R10 (MUST) Arbitrary N users.** The profile registry holds 0..N users,
  each `{id, label, address, role}`. The current three sample profiles
  become seed data — not the entire set.
- **R11 (MUST) Runtime add/remove.** Settings → Users supports adding a
  new user (address from a private key paste OR derived from a seed in
  simulated mode) and removing any non-active user. Persists to
  `localStorage` under `curie:users`.
- **R12 (MUST) Role assignment per user.** Roles are `provider` |
  `insurer` | `observer` (extensible). The Role pill row reflects the
  full registry, not a hardcoded list.
- **R13 (SHOULD) Demo-mode quick-switch.** A "demo" toggle in Settings
  shows the legacy three-profile shortcut for guided walkthroughs;
  defaults off in v1.

### 3.4 Customizable insurance policy

- **R14 (MUST) Curated policy library.** At engage time, the insurer
  picks from ≥ 4 curated policies: Part D formulary, Commercial PA-required,
  Medicaid step-therapy, plus the demo's known-bad policy. Each carries
  `{name, clauses: { id, text, voids?: boolean }[]}`.
- **R15 (MUST) Free-text override.** A "Custom policy" choice lets the
  insurer compose their own policy at engage time: name + 1..N clauses +
  optional `voids` marker per clause. Validates that name is non-empty
  and ≥ 1 clause is present.
- **R16 (SHOULD) Policy preview before submit.** The selected/composed
  policy renders as a read-only summary card before the user clicks
  `engage-submit`, with a hash preview of what will be committed
  (mirroring the Create form's hash-preview pattern).

### 3.5 Known errors + operator blockers (production-mode)

Captured 2026-05-30 from a user-reported insurer-view failure with the
raw payload below. These are the exact symptoms when R2 isn't met and
they MUST be handled gracefully in the UI before R1 can be claimed.

- **R17 (MUST) Map the "account does not exist" revert family.** When the
  active signer attempts a write transaction from an address that has
  zero on-chain history on Somnia testnet (never received funds), the RPC
  rejects with `{ "code": -32000, "data": "0x02", "message": "account does
  not exist" }`. ethers v6 wraps this as
  `could not coalesce error (... UNKNOWN_ERROR ...)`. The current
  `ErrorCard` renders the raw technical text as the headline. Required:
  `src/protocol/revertReasonMap.ts` gains a match for the
  `"account does not exist"` substring AND for the wrapping `"could not
  coalesce error"` text; the friendly headline is **"Wallet has no funds
  on Somnia testnet"** and the *What to do* hint points the user to the
  testnet faucet (`https://testnet.somnia.network/`) with the active
  address inlined. The ErrorCard should NOT show a Retry button for this
  family — retrying without funding will produce the same error.
- **R18 (KNOWN BLOCKER) Insurer wallet `0x140e…8C62` is unfunded.** Until
  it receives ≥ 0.1 STT it has zero on-chain history and every insurer
  write tx (engage, requestAdjudication, accept, settle) reverts with
  R17's error. R1 (the full-loop integration test) cannot run; T2b-2/3/4
  in the existing harness stay blocked. Tracked also in
  `docs/progress/loop-state.md` Operator notes. Resolution is operator-only.
- **R19 (SHOULD) Pre-flight balance check at write-tx fire.** The web layer
  should call `provider.getBalance(signerAddress)` before every write
  transaction and short-circuit with a friendly inline error (the
  `balance-block` testid from R31, recycled) when balance is below
  `agentFeeReserve + estimatedGas` so the user never reaches the raw RPC
  error. Sim mode bypasses (no provider).

**Raw payload (user-reported 2026-05-30):**

```
could not coalesce error (error={
  "code": -32000,
  "data": "0x02",
  "message": "account does not exist"
}, payload={
  "id": 12,
  "jsonrpc": "2.0",
  "method": "eth_sendRawTransaction",
  "params": [
    "0x02f8cf82c488… (raw tx to contract 0x1dc5ba…3E1A, selector 0x3c7aed52)"
  ]
}, code=UNKNOWN_ERROR, version=6.16.0)
```

Selector `0x3c7aed52` corresponds to `insurerEngage(uint256 reqId,
bytes32 policyHash, bytes32 policyUri)` — confirming the failing call is
the insurer's engage from the insurer view.

### 3.6 Per-affordance integration coverage (cross-spec)

This section applies to every UI affordance landed under SPECs 0001-0005.
It generalizes R1 from a single full-loop scenario into per-affordance
coverage so no button silently regresses.

- **R20 (MUST) Per-affordance integration scenario.** Every interactive
  UI affordance whose effect crosses a layer boundary — contract write,
  arbiter trigger, localStorage write, or route-resetting navigation —
  has at least one named Scenario in
  `web/tests/agent-browser/run.sh` that drives it through the live UI
  and asserts both the on-chain/storage effect and the UI's post-action
  state. Identification rule: every `<button>` / `<form onSubmit>` with
  a `data-testid` that maps to a state-mutating action. Pure-navigation
  links (route change with no state mutation) are exempt. New
  affordances ship in the same commit as their Scenario; an affordance
  without a Scenario fails strict-review.
- **R21 (MUST) Both arbiter outcomes covered.** Every flow that runs
  through an arbiter ruling — R1, the custom-case path (R2a), and each
  curated case (R2) — has Scenarios covering **both** the approval path
  (asserts `State.Settled` and settlement recipient = `providerAddr`)
  and the denial path (asserts `State.Denied` and the appeal-or-close
  branch behaves per `appeal-ladder-enforcement.md`). A flow that tests
  only one outcome fails the requirement; mark the missing path with a
  failing-test stub rather than skipping silently.
- **R22 (MUST) Real on-chain arbiter call verified.** Any Scenario
  claiming integration coverage for an arbiter step (R20 or R21) MUST
  hit the live agent on Somnia testnet — the assertion is that a
  `Ruled` event appears for the test-run's `reqId` with a non-zero
  block hash AND the agent's tx `status === 1`. Sim-mode short-circuits
  do NOT satisfy R22 (they remain valid for R5's parallel smoke check
  only). Scenarios MUST distinguish their mode in the assertion message
  so a regression that silently drops to sim is caught.

  *Amendment 0006 (2026-05-30, Adopted): under self-hosted mode the
  "live agent" is the orchestrator at `scripts/orchestrator-real.ts`
  calling `claude-opus-4-7` and submitting via `handleResponse` from the
  configured platform EOA — see SPEC-0004 §2.7 Amendment 0006 status
  block. The R22 assertion shape (`Ruled` event + non-zero block hash +
  `status === 1`) is unchanged; only the agent identity changes. All
  Ticks A+B+C+D landed (contract deployed at
  `0x2c561f339a0A15cf0550cb9a0880Bb341488ac93` with `selfHosted == true`,
  `platform == 0x204031FA1ad46a2D453b7c54fC28Ff1787Bd9128`;
  `npm run verify-deploy` 8/8 PASS tick 142); live R22 exercise still
  requires (a) operator wallet refunded to ~8 STT for the full 22-Scenario
  sweep, or (b) `ANTHROPIC_API_KEY` set for the smaller Tick A live
  smoke (~0.5 STT, affordable at current balance).*
- **R23 (MUST) Pre-flight wallet sufficiency per scenario.** Before
  each integration Scenario fires its first write tx, the harness
  computes the upper-bound cost of the Scenario as
  `Σ(estimatedGas_i × maxFeePerGas) + agentFeeReserve × arbiterCallCount`
  and asserts the active wallet's balance ≥ that sum. On shortfall the
  Scenario fails loud with the message
  `insufficient balance: needed X STT, have Y STT, short Z STT — fund <addr> at https://testnet.somnia.network/`
  rather than running and reverting opaquely mid-flow. The estimator
  helper lives in `web/tests/agent-browser/cost-estimator.sh` (new) and
  is reused across Scenarios.

## 4. Deliverables

1. `docs/specs/0005-usability-and-integration.md` — this file.
2. `docs/specs/README.md` — add an entry for SPEC-0005 (status: draft).
3. `scripts/integration-test.ts` (new) — drives the R1 flow via
   agent-browser; reads addresses + RPC from `.env`; writes per-step
   receipts.
4. UI changes per R6-R8, R10-R16. Each landed under a UNIT-NNN under the
   spec-4 loop with its strict-review gate.
5. `docs/progress/browser-verify.md` gains a SPEC-0005 section indexed by R.
6. R17 — extend `src/protocol/revertReasonMap.ts` with `"account does not
   exist"` + `"could not coalesce error"` entries; surface the testnet
   faucet URL in the *What to do* hint. R19 — pre-flight balance check
   wired into every write-tx fire.
7. R20-R23 — per-affordance Scenarios in `web/tests/agent-browser/run.sh`
   (one per state-mutating affordance); approval AND denial Scenarios per
   arbiter-reaching flow; `Ruled` event + block-hash assertions for every
   real-mode arbiter Scenario; `web/tests/agent-browser/cost-estimator.sh`
   helper for pre-flight wallet sufficiency, called at the top of each
   Scenario that fires write txs.

## 5. Test cases

Each entry states the scenario to cover — what must be verified — not the test
implementation. Reference requirement IDs explicitly. Synthetic data only (R1).

### 5.1 Integration test (R1–R5)

- **T1 (R1) Full-loop real-wallet run.** A single agent-browser session on Somnia
  testnet (chain 50312) drives the complete six-step sequence —
  `createContract` → `insurerEngage` → `requestAdjudication` →
  arbiter `handleResponse` → both parties `accept` → `settle` — against the live
  contract using the provider wallet (`0x2040…9128`) and insurer wallet
  (`0x140e…8C62`). Assert: on-chain `state == 6` (Settled) and the Settled event
  names `0x2040…9128` as recipient.
- **T2 (R2) Underfunded wallet fail-loud.** With either wallet balance set to < 0.5 STT
  (simulated via a mocked balance check), the test asserts a failure message
  containing the shortfall amount and the unfunded address — no silent skip.
- **T3 (R3) Receipt capture.** After the T1 run, `docs/progress/integration-test.md`
  contains a tx hash for each of the six on-chain steps (create, engage, adjudicate,
  accept×2, settle).
- **T4 (R4) Headless / headed parity.** The T1 script exits 0 (all assertions pass)
  in both `--headless` CI mode and `--headed` dev mode. No assertion is
  skipped based on mode.
- **T5 (R5) Sim-mode smoke.** The same six-step flow succeeds against the simulated
  backend (no real chain, no wallets required). Assert the UI reaches a terminal
  Settled state.

### 5.2 Layout invariants (R6–R9)

- **T6 (R6) Top-bar density at 1280×800.** A screenshot at 1280×800 shows brand,
  wallet chip, and Role selector in distinct non-overlapping columns with no text
  truncation, no wrapping, and ≥ 12px gutter. STT balance uses tabular-numeric
  formatting.
- **T7 (R7) Insurer Detail single-column layout.** With `role = insurer` and any
  request open in Detail, a screenshot shows a single full-width column — not the
  two-column provider grid.
- **T8 (R8) View switch returns to Overview.** From a Detail page, clicking Overview
  in the top nav renders the Overview list, not the previous Detail. Repeat for
  Network and Settings. No stale Detail state is visible.
- **T9 (R9) Screenshots attached per layout R.** Each tick closing R6, R7, or R8
  produces a named screenshot under `docs/progress/browser-verify.md` for that
  R-number.

### 5.3 Generalized user model (R10–R13)

- **T10 (R10) Arbitrary N users.** Add four synthetic users (each `{id, label, address,
  role}`) to the registry; assert all four appear in the Role pill row. The three seed
  profiles remain present as ordinary entries.
- **T11 (R11) Add and remove users.** Via Settings → Users: (a) add a new user with a
  synthetic 0x address — assert it persists to `localStorage["curie:users"]` and
  survives a page reload; (b) remove a non-active user — assert it is absent from
  `localStorage` and from the pill row after reload.
- **T12 (R12) Role pill row reflects registry.** When the registry contains five users,
  five pills appear in the pill row. Adding or removing a user updates the count with
  no reload.
- **T13 (R13) Demo-mode quick-switch.** With the demo toggle OFF (default), the legacy
  three-profile shortcut is hidden. Turning it ON reveals the shortcut. Toggle state
  persists across reloads.

### 5.4 Customizable insurance policy (R14–R16)

- **T14 (R14) Curated policy library.** At engage time, the insurer sees ≥ 4 curated
  policies (Part D formulary, Commercial PA-required, Medicaid step-therapy,
  demo known-bad). Selecting each renders its name and clause list. All policy
  names and clause text are synthetic.
- **T15 (R15) Free-text policy override.** The insurer selects "Custom policy", enters
  a non-empty name and ≥ 1 clause, and submits. Assert: the engage tx carries a
  `policyHash` derived from the composed policy. Assert: submitting with an empty name
  or zero clauses is blocked with an inline validation message.
- **T16 (R16) Policy preview before submit.** After selecting or composing a policy,
  a read-only summary card and hash preview appear before `engage-submit` is enabled.
  The preview matches what is submitted (hash verified post-tx).

### 5.5 Known errors + operator blockers (R17–R19)

- **T17 (R17) "Account does not exist" mapped.** Triggering a write tx from an
  unfunded address produces an ErrorCard whose headline is exactly **"Wallet has no
  funds on Somnia testnet"** and whose *What to do* hint contains
  `https://testnet.somnia.network/` with the active address inlined. No Retry button
  is rendered. Covers both the raw `"account does not exist"` substring and the
  `"could not coalesce error"` ethers v6 wrapping.
- **T18 (R19) Pre-flight balance check.** With `balance < agentFeeReserve +
  estimatedGas`, the write-tx button is blocked before firing. The inline error names
  the shortfall. In simulated mode the check is bypassed and the action proceeds.

### 5.6 Per-affordance integration coverage (R20–R23)

- **T19 (R20) Every state-mutating affordance has a named Scenario.** A CI lint step
  (or reviewer check) asserts: for every `data-testid` that maps to a state-mutating
  action (contract write, arbiter trigger, localStorage write, or route-resetting nav),
  a corresponding named Scenario exists in `web/tests/agent-browser/run.sh`.
  Pure-navigation links are exempt.
- **T20 (R21) Both arbiter outcomes covered.** Each arbiter-reaching flow has exactly
  two Scenarios: one that ends with `State.Settled` (recipient = `providerAddr`) and
  one that ends with `State.Denied` (appeal-or-close branch behaves per
  `appeal-ladder-enforcement.md`). A flow with only one outcome fails; the missing
  outcome has a clearly marked failing stub.
- **T21 (R22) Real on-chain arbiter call verified.** In any Scenario claiming real-mode
  integration coverage for an arbiter step: the assertion confirms a `Ruled` event for
  the test run's `reqId`, a non-zero block hash, and agent tx `status === 1`. The
  assertion message includes the mode string so a silent drop to sim is caught.
  Sim-mode runs (R5) do not satisfy this case.
- **T22 (R23) Pre-flight wallet sufficiency per scenario.** Before each write-tx
  Scenario, the cost estimator (`web/tests/agent-browser/cost-estimator.sh`) computes
  the upper-bound cost and asserts `balance ≥ cost`. A shortfall causes the Scenario
  to fail with the exact message:
  `insufficient balance: needed X STT, have Y STT, short Z STT — fund <addr> at https://testnet.somnia.network/`.

## 6. Pass / fail criteria

### PASS — all must hold

- [ ] **R1:** At least one T1 run completes with on-chain `state == 6` (Settled) and
  the settlement event recipient equals `0x2040…9128` (providerAddr).
- [ ] **R2:** When either wallet is underfunded, the harness fails with a message that
  names the shortfall and the unfunded address — no silent skip (T2).
- [ ] **R3:** `docs/progress/integration-test.md` contains all six per-step tx hashes
  after a T1 run (T3).
- [ ] **R4:** T1 script exits 0 in both headless and headed modes (T4).
- [ ] **R5:** Sim-mode smoke (T5) reaches Settled state with no wallet required.
- [ ] **R6:** At 1280×800, top-bar brand + wallet chip + Role selector are
  non-overlapping, non-truncating, and ≥ 12px apart (T6).
- [ ] **R7:** Insurer Detail renders single-column (T7).
- [ ] **R8:** Nav switches from Detail to Overview (and any other top-level view)
  without retaining stale Detail state (T8).
- [ ] **R9:** Screenshots for each closed layout R are attached under
  `docs/progress/browser-verify.md` (T9).
- [ ] **R10:** Profile registry supports arbitrary N users; all appear in the pill
  row (T10).
- [ ] **R11:** Add/remove in Settings persists to `localStorage["curie:users"]` and
  survives reload (T11).
- [ ] **R12:** Pill row count reflects registry size live, no reload needed (T12).
- [ ] **R13:** Demo toggle defaults OFF; turning it ON reveals shortcut; persists
  across reload (T13).
- [ ] **R14:** ≥ 4 curated policies appear at engage time (T14).
- [ ] **R15:** Custom policy validates (non-empty name + ≥ 1 clause) before allowing
  submit; invalid inputs are blocked with an inline message (T15).
- [ ] **R16:** Policy preview card and hash appear before `engage-submit` (T16).
- [ ] **R17:** Unfunded-address write produces ErrorCard with headline **"Wallet has
  no funds on Somnia testnet"**, faucet URL, inlined address, and no Retry button
  (T17).
- [ ] **R19:** Pre-flight balance check blocks the write-tx button with a shortfall
  message in real mode; bypassed in sim mode (T18).
- [ ] **R20:** Every state-mutating affordance (by `data-testid`) has a named Scenario
  in `run.sh`; a new affordance without a Scenario fails strict-review (T19).
- [ ] **R21:** Every arbiter-reaching flow has both an approval Scenario (Settled +
  correct recipient) and a denial Scenario (Denied + appeal-ladder behavior) (T20).
- [ ] **R22:** Every real-mode arbiter Scenario asserts a `Ruled` event, non-zero
  block hash, and `status === 1`; the assertion message names the mode (T21).
- [ ] **R23:** `cost-estimator.sh` runs before each write-tx Scenario; a shortfall
  fails loud with the exact prescribed message (T22).

### FAIL — any triggers rejection

- Any fixture, note, snapshot, or test-data file contains real PHI (violates R1).
- A Scenario that claims real-mode integration coverage for an arbiter step silently
  falls through to sim mode without an assertion failure (violates R22).
- A new state-mutating affordance ships without a corresponding named Scenario in
  `run.sh` (violates R20).
- The T1 run is claimed as green when `on-chain state ≠ 6` or the settlement
  recipient does not equal `providerAddr` (violates R1).
- An underfunded-wallet scenario silently skips instead of failing loud with the
  shortfall message (violates R2, R23).
- The ErrorCard for an `"account does not exist"` revert shows a Retry button or does
  not surface the faucet URL (violates R17).
- Custom-policy submission is accepted with an empty name or zero clauses without
  an inline validation error (violates R15).
- A layout screenshot is absent for any tick that closes R6, R7, or R8 (violates R9).

## 7. Out of scope (v0)

- Real KYC / wallet onboarding flows beyond a private-key paste.
- Notification / email / Slack integration on settlement.
- Multi-tenancy beyond one demo deployment.
- Production-grade policy authoring (versioning, audit trail, signatures).
- Anything the R1 integration test doesn't actually exercise.

## 8. Open questions

- **OQ1**: should the integration test run on every PR (gas cost) or only
  on nightly + release tags? v0 default: nightly + release.
- **OQ2**: localStorage user persistence is per-origin; do we need an
  export/import for sharing between dev/preview/production? Defer to
  v1.5 if pain.
- **OQ3**: how do the curated policies map to the existing R23
  policy-void path (amendment 0005)? Each policy declares which of its
  clauses are `voids=true`; the arbiter's R23 logic uses that flag.
- **OQ4 (HIGH) — CLOSED tick 148:** §5 Test cases and §6 Pass/fail
  criteria have been added (see above). §5 indexes T1–T22 against R1–R23;
  §6 provides explicit PASS checkbox list (one per R or group of R's, each
  traced to a requirement) and a FAIL disqualifier list. The "every
  affordance has a Scenario" verifiability gap is now covered by T19/R20
  and the R20 FAIL condition.
- **OQ5 (MED)**: R22 requires real-chain arbiter calls. Under Amendment 0006
  (Adopted 2026-05-30), the live contract is
  `0x2c561f339a0A15cf0550cb9a0880Bb341488ac93` in self-hosted mode. The
  on-chain `agentReward` is still 0.35 STT per ruling; the contract forwards
  it to the configured `platform` address, which under self-hosted mode is the
  orchestrator EOA (`0x204031FA1ad46a2D453b7c54fC28Ff1787Bd9128` —
  see `_fireAgentSelfHosted` at `contracts/contracts/CoverageNegotiation.sol`).
  In the v0 dev setup where one EOA plays both provider and orchestrator (the
  current `web/tests/agent-browser/run.sh` configuration), the agentReward is
  paid out by the provider role and received by the orchestrator role on the
  same wallet — so the net on-chain wallet impact per ruling is gas only. Each
  ruling also carries an off-chain `claude-opus-4-7` call billed by Anthropic
  to the orchestrator operator (out-of-chain cost; not visible to wallet
  balance). A full R20+R21 sweep (~10 Scenarios × 2 outcomes × 1 arbiter call
  per outcome with appeal paths possibly adding more) is therefore dominated
  by Anthropic API spend rather than chain fees, when run with the same-EOA
  dev configuration. A production-style setup with distinct provider/insurer
  EOAs would shift 0.35 STT per ruling from each provider to the orchestrator
  per call. Decide before R20 lands whether to gate the real-chain sweep to
  nightly only (per OQ1) or accept the per-PR cost.
