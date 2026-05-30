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

## 5. Out of scope (v0)

- Real KYC / wallet onboarding flows beyond a private-key paste.
- Notification / email / Slack integration on settlement.
- Multi-tenancy beyond one demo deployment.
- Production-grade policy authoring (versioning, audit trail, signatures).
- Anything the R1 integration test doesn't actually exercise.

## 6. Open questions

- **OQ1**: should the integration test run on every PR (gas cost) or only
  on nightly + release tags? v0 default: nightly + release.
- **OQ2**: localStorage user persistence is per-origin; do we need an
  export/import for sharing between dev/preview/production? Defer to
  v1.5 if pain.
- **OQ3**: how do the curated policies map to the existing R23
  policy-void path (amendment 0005)? Each policy declares which of its
  clauses are `voids=true`; the arbiter's R23 logic uses that flag.
- **OQ4 (HIGH)**: this spec is missing the spec-author-standard §5 Test
  cases and §6 Pass/fail criteria sections. R20-R23 increase the
  surface area enough that the gap is now load-bearing — without an
  explicit PASS gate, "every affordance has a Scenario" is unverifiable.
  Next spec-touching tick should restructure the spec to add both
  sections, indexed by R.
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
