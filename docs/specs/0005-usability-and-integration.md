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

## 4. Deliverables

1. `docs/specs/0005-usability-and-integration.md` — this file.
2. `docs/specs/README.md` — add an entry for SPEC-0005 (status: draft).
3. `scripts/integration-test.ts` (new) — drives the R1 flow via
   agent-browser; reads addresses + RPC from `.env`; writes per-step
   receipts.
4. UI changes per R6-R8, R10-R16. Each landed under a UNIT-NNN under the
   spec-4 loop with its strict-review gate.
5. `docs/progress/browser-verify.md` gains a SPEC-0005 section indexed by R.

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
