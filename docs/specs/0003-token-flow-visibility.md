# SPEC-0003: Token-flow visibility in the UI

Status: Draft · Owner: tspugh · Date: 2026-05-29 · Builds on: [SPEC-0001](0001-mvp0-coverage-negotiation.md), [SPEC-0002](0002-demo-experience-and-integration-seam.md)

> **Scope.** A living **design-decisions log** for the next phase of UI work, scoped to making
> the **token flow legible**: where STT is held, where it moves, and what each on-chain call
> costs. This spec grows decision-by-decision as the conversation progresses; the
> "Requirements" section is appended to (not rewritten) as decisions land. **No new
> protocol behavior** in v0 — UI/observability only.

## 1. Summary & user story

A real-mode user (provider, insurer, or operator) should be able to look at the app and
**immediately understand the money**: how much STT their signing wallet holds, what each
upcoming or completed contract call will cost (gas + value sent + agent-fee escrow), and
where each token amount flowed (in / out / locked). Today the same flows happen invisibly:
the user clicks "create" and a transaction goes out, but the cost and the resulting balance
delta are not surfaced in the UI — they have to open an explorer to reason about funds.

> As a **real-mode user driving a coverage-exception negotiation**, I want to see my **wallet
> balance** update live alongside the **per-call cost** of every contract interaction (and
> the **token flow** that resulted) — so I can tell at a glance where my STT is going, what
> the agent fee actually costs, and whether I have enough to complete the next step.

## 2. Requirements

### 2.1 (2026-05-29) Wallet balance + per-tx cost visibility (Decision 1)

- **R1 (MUST) Live wallet balance.** Surface the signer wallet's **native STT balance** in
  the app chrome, refreshed (a) on initial load, (b) after every tx the app sends, and
  (c) on a low-frequency interval poll (≤30s) while the user is on a page that can spend.
  Display the address (truncated) + balance in STT with at least 4 decimals.
- **R2 (MUST) Per-tx cost preview.** When the user is about to send a tx — initial
  `createContract`, evidence submission, accept, appeal, etc. — show the **expected total
  cost**: `value sent + (gasEstimate × gasPrice)`, broken into the two parts. For agent
  adjudication calls, value sent is the `VITE_AGENT_FEE_WEI` escrow; surface that explicitly
  with a label so it's not conflated with gas.
- **R3 (MUST) Per-tx cost realized.** After a tx confirms, replace the *preview* with the
  *realized* numbers from the receipt (`effectiveGasPrice × gasUsed` + any value transferred).
  Pin a one-line summary to the timeline (already R1 in SPEC-0002) so each round in the
  negotiation history carries its true cost.
- **R4 (MUST) Token-flow attribution.** Adjacent to the cost, name the **direction** —
  `Outbound to agent (fee escrow)`, `Outbound to contract (deposit)`, `Locked (escrowed)`,
  `Inbound (refund / settlement)`, `Burned (gas)` — so a viewer reads the page and understands
  *what happened to the money*, not just the dollar number.
- **R5 (SHOULD) Pre-flight insufficient-funds guard.** If `balance < value + gasEstimate × buffer`,
  disable the send button and show a banner with the shortfall and the funding wallet address
  (the dev wallet for this build). Don't pop a generic ethers error after the click.
- **R6 (SHOULD) Simulated-mode parity.** In simulated mode (no chain), show *modeled* numbers
  using fixed gas/fee constants so the demo flow shows the same UI affordances; tag them as
  "modeled" so a viewer doesn't mistake them for live.

> Future decisions append here as §2.N (2026-MM-DD) blocks. Don't rewrite earlier sections;
> the chronological order is the audit trail.

### 2.2 (2026-05-29) Persistent tx ledger — dev-server sink, never console (Decision 2)

- **R7 (MUST) No console-spam tx logging.** Tx events MUST NOT be logged via `console.*`
  in production code paths. Bad-practice noise; also unreadable when agent-browser drives
  the UI.
- **R8 (MUST) Per-tx event bus on the real backend.** `RealBackend` exposes a typed event
  bus (`EventTarget`) that dispatches `tx-confirmed` after each `tx.wait()`, carrying the
  *method name*, *tx hash*, *value (msg.value)*, *gasUsed*, *effectiveGasPrice*, and
  *block number*. Per-method semantics live above (R4 attribution).
- **R9 (MUST) Persistent JSONL ledger via the dev server.** A Vite dev-server middleware
  exposes `POST /__log/tx` that appends a single JSON record to `.tmp/tx-log.jsonl` per
  call. The client subscribes to the `tx-confirmed` bus and POSTs each event. The
  *single source of truth* for a dev-session's spend is this file — not the UI's
  in-memory state, which resets on reload.
- **R10 (MUST) `.tmp/` is gitignored.** The ledger never enters version control. Wipe
  with `rm -rf .tmp` to reset spend tracking.
- **R11 (SHOULD) Best-effort POST.** A failed POST MUST NOT block the UI or the chain
  flow — fire-and-forget with a brief retry, drop on permanent failure (logged once to
  the dev server, not to the browser console).
- **R12 (SHOULD) Agent-browser inspectable.** The ledger format is line-delimited JSON so
  `tail -f .tmp/tx-log.jsonl | jq` works from a side terminal, and an agent-browser test
  can shell out to assert on its contents between scenarios.

### 2.3 (2026-05-29) Action coherence with on-chain state (Decision 3)

UI polish discovered while real-mode driving request #4: an `insurerEngage` succeeded
on-chain (state `Open → Ready`, `policyHash` and `policyUri` both populated) but the UI
left the engage button enabled and gave no semantic confirmation of *what* had just
been attached, so the user re-clicked → contract reverted `engage: not Open`. Failure
was on the UI side; the chain did the right thing both times. The requirements below
pin the polish that has to land before agent-browser drives real-mode scenarios
spending non-trivial STT.

- **R13 (MUST) Action panel re-derives from current on-chain state.** After every
  `tx-confirmed` event whose receipt touches `reqId`, re-fetch the negotiation and
  re-render the action panel from the new state — **not** from component-level "I
  clicked X already" booleans. The set of available actions is a pure function of the
  on-chain `state`; stale optimistic state must be reconciled within one frame of the
  receipt.
- **R14 (MUST) In-flight guard on every tx-firing button.** Every button that calls a
  write method carries a `pending` flag. While unresolved: button is disabled, label
  reads "Pending…" (or method-specific equivalent like "Attaching policy…"), and the
  `tx-confirmed` listener for this `reqId` is the only thing that clears the flag.
  No timer-based clears, no hidden re-arming.
- **R15 (MUST) Create-form anti-double-submit + content dedupe.** Submit disabled on
  first click until receipt or error. Additionally, the client maintains an in-memory
  set of `(providerId, drugRef, justificationHash)` triples submitted in the last 60s
  with no confirmed receipt; a re-submit with the same triple is silently coalesced
  to the in-flight request, not re-fired. This MUST NOT block legitimately re-trying
  after an explicit error (the set is cleared on error).
- **R16 (MUST) Estimate-before-send with revert-reason surfacing.** Each action calls
  `contract.method.estimateGas(args)` before dispatching. If estimateGas reverts, the
  UI surfaces the contract's revert reason inline as plain English
  (e.g., `"This request is already past the engage step — refresh to see current
  state."` rather than the raw `engage: not Open` and an ethers stack). The mapping
  table from `Error(string)` → user-facing copy lives in the library so the UI and any
  off-chain tooling render the same message.
- **R17 (SHOULD) Optimistic state hints with `(unconfirmed)` flag.** After the user
  submits a write, the UI may render the projected next state immediately with a
  visible `(unconfirmed)` chip; once the receipt lands, the chip clears and the panel
  re-derives per R13. If estimateGas already reverted (R16), no optimistic hint is
  rendered.
- **R18 (MUST) Post-action semantic confirmation.** After a state transition lands,
  the UI MUST render the *meaning* of what just happened — not only the new state
  badge. Concretely, for each transition:
  - `createContract` → render request id, drug, requested amount, provider profile
    label; link to the new request's Detail.
  - `insurerEngage` → render the human-readable policy name (from the policy card
    label the user picked, or `"policy <shortHex>"` if none), insurer profile label,
    timestamp, and a `View policy` affordance that resolves the off-chain content.
  - `requestAdjudication` → render fee paid (in STT), the agent id called, and an
    "awaiting ruling" countdown.
  - `submitEvidence`, `appeal`, `accept`, `settle`, `refuse`, `withdraw` → render the
    actor (profile label), the artefact (if any), and the resulting state.
  - The post-action card lives at the top of the Detail view's action area for at
    least the next render cycle, so a user looking at the screen after clicking is
    not left guessing whether anything happened.
- **R19 (SHOULD) Semantic TxMonitor entries.** Each row in the TxMonitor (and each
  JSONL ledger line) MAY carry a `summary: string` derived from the method + decoded
  args (e.g. `"insurerEngage: attached 'Standard Coverage Policy' to request #4"`),
  in addition to the method name. The summary is the human-readable handle a viewer
  reads first; the hash and gas are the audit trail.

### 2.4 (2026-05-29) Layout, error states, and cross-mode parity (Decision 4)

Further polish discovered while real-mode driving: simulated-mode actions (e.g. accept,
reject) can be clicked indefinitely — the in-flight / re-derive rules from §2.3 only
fire when there's a real-chain receipt. Long demo content (the multi-paragraph
justification, the FDA fixture text) pushes UI components past their containers — text
goes out of bounds, action panels squish. Error UI today is a raw revert string dropped
inline; it inherits no layout discipline and pushes other elements off the page.

- **R20 (MUST) No overflow, clipping, or horizontal scroll at standard desktop
  viewports.** All views render cleanly at **1280×800** and **1920×1080** with no
  unintended horizontal scroll, no text clipped by containers, no buttons pushed past
  their parents' rounded corners. Long content (multi-paragraph justifications, the
  FDA-indication evidence text, long hashes) wraps, truncates with a "show more"
  affordance, or scrolls within a fixed-height region — never breaks the surrounding
  layout. Specific tested states: empty Overview, Overview with ≥3 rows, Create form
  empty, Create form filled with the Load-Demo content, Detail at each of the 11 enum
  states (R5 of SPEC-0001), Detail with a pending tx, Detail with an error.
- **R21 (MUST) Polished, contained error UI.** Every error MUST render as a structured
  card with: (a) one-line plain-English headline (R16's revert-reason mapping); (b)
  optional collapsible "Technical details" block hiding the raw `Error(...)`; (c) a
  "What to do" hint; (d) an explicit dismiss / retry affordance. The card occupies its
  own slot in the Detail / Create layout and MUST NOT push other elements off the
  page or cause the surrounding panel to reflow disruptively. No raw ethers stack
  traces in production-mode renders; the dev console may still carry the full error
  per R7 (no console writes on the happy path, but R7 doesn't prohibit dev-only error
  visibility behind a debug toggle).
- **R22 (MUST) Simulated-mode parity on idempotency + in-flight guards.** R13, R14,
  R15 apply identically in simulated mode. Concretely: clicking accept / reject / any
  state-transitioning button in simulated mode disables it for the duration of the
  call (the simulated backend's promise resolves on `autoResolveMs`), and the action
  panel re-derives from the new simulated state on resolution. A duplicate click MUST
  NOT produce a duplicate state transition or duplicate timeline entry. The lack of a
  real on-chain receipt does not exempt simulated mode from idempotency — the same
  visual + behavioural guarantees apply.
- **R23 (SHOULD) Screenshot-based visual regression check in pass/fail.** Pass
  criteria include a screenshot review at **1280×800** and **1920×1080** covering the
  state matrix in R20. Reviewer (human or agent-browser-driven) checks: no element
  clipped or overflowing its container; no horizontal scroll; the action affordance
  matches the on-chain state (R13); semantic confirmation card present after the most
  recent successful action (R18); error card (when applicable) contained per R21.
  Failures get a labelled screenshot in the PR description. **Baseline before
  polish:** [`../progress/2026-05-29-baseline/`](../progress/2026-05-29-baseline/)
  + the inventory in its README.

### 2.5 (2026-05-29) Wallet connection & onboarding (Decision 5 — folded from SPEC-0005)

Production posture decision. SPEC-0005 was started as a separate doc; per the
2026-05-29 conversation, folded into SPEC-0003 because every decision here lands at
the UI surface (landing page, header chrome, profile picker) and SPEC-0003 is the
design-decisions log for that surface. **Privy is not a v0 dependency.**

- **R24 (MUST) Landing page split.** First visit lands on a page with two clearly
  distinct CTAs: **"Sign in to my organisation"** (production path) and **"Try the
  demo"** (current ephemeral flow). Visual treatment makes accidental cross-over
  unlikely. The demo path labels every screen as *Demo — synthetic data only* per
  SPEC-0004 §2.1.
- **R25 (MUST) Native wallet is the primary production path; embedded wallet is
  opt-in.** Production v0 connects via **MetaMask / WalletConnect** as the default,
  signing a SIWE challenge (EIP-4361) for session. An **embedded-wallet path** via
  Privy (or equivalent) is **opt-in** — for users who don't have a wallet — but is
  **not required** for v0 production: anyone who has MetaMask should be able to use
  the app without ever seeing the embedded-wallet onboarding. This trades a higher
  bar for crypto-native users (none — they already have MetaMask) against a higher
  bar for non-crypto users (they need to install MetaMask first time, OR opt in to
  embedded onboarding when we add it).
- **R26 (SHOULD) Privy is the embedded provider when we add it.** Free tier (1k MAU
  is enough for closed-beta-scale evaluation); SSO-first; white-labellable; EVM-
  native. Not committed for v0; captured here so when the embedded path is added we
  don't re-litigate.
- **R27 (MUST) Profile = role within an organisation in production.** The
  Provider / Insurer / Observer dropdown is a **demo affordance only**. In production,
  the chrome shows the user's *assigned role* for the org they're signed into; the
  picker is hidden (or restricted to actually-assigned roles for users in multiple
  orgs). This is the workflow-team framing from
  [VISION.md](../VISION.md) — a real provider PA-team operator is *only* a Provider.
- **R28 (SHOULD) Wallet is one-per-(user, org).** A user belonging to two orgs gets
  two addresses; switching org switches wallet and re-issues SIWE. Mechanics for
  org-membership lookup (on-chain registry vs off-chain SIWE-only) deferred to a
  contract-side spec.
- **R29 (SHOULD) Demo wallet hardening before any public demo URL.** The dev wallet
  PK in `.env` is OK for this EC2 box. A public demo deploy needs a per-session
  ephemeral wallet, faucet-funded and idle-expired. Not blocking v0 work; captured so
  the "ship the demo to the public" task knows the dependency.
- **Out of scope** for SPEC-0003: patient-side wallets (read-only status only),
  KYB / org provisioning (Curie-ops process), treasury / multisig for escrow,
  mobile / native wallets, ERC-4337 mechanics.

### 2.6 (2026-05-29) Submit-amount gating by wallet balance (Decision 6)

- **R30 (MUST) Create-form submit blocked when `requestedAmount > balance`.** The
  Create form's `requestedAmount` field is validated against the active wallet's
  current STT balance from the SPEC-0003 §2.1 R1 hook. Above-balance values:
  - Disable the Submit button.
  - Render an inline error per SPEC-0003 §2.4 R21: *"Requested amount exceeds your
    wallet balance (X STT). Lower the amount or top up the wallet."*
  - Surface the current balance + the shortfall.
- **R31 (MUST) Tx-cost preview folded into the same check.** The total the user
  must hold is `requestedAmount + estimatedGasFor(createContract) + agentFeeReserve`
  (the latter for the next-step `requestAdjudication` so the user can finish the
  loop). The block is on the sum, not just on `requestedAmount` alone.
- **R32 (SHOULD) Live-update the block.** The block tightens or relaxes as the
  balance changes (e.g., the user funds the wallet mid-form) without requiring a
  re-render — drives off the same `useWalletBalance` hook from §2.1.

### 2.7 (2026-05-29) AI reasoning + agent-receipt visibility (Decision 7)

The current Detail view exposes the *result* of an AI ruling — the new covered
amount, the decision badge — but not the *reasoning*. Once the on-chain agent issues
its callback (the agent-receipt that satisfies SPEC-0001 R6 / SPEC-0004 §2.3 R11),
the UI should let a viewer **explore the agent's reasoning** — cited references,
decision text, on-chain receipt — not just see the new state badge.

- **R33 (MUST) Agent-receipt explorer on Detail.** When state is `UnderReview` or
  the request has been ruled at least once, the Detail view exposes an "AI Reasoning"
  panel (or affordance) that, per round, surfaces:
  - The on-chain **receipt id** (from the `Ruled` event) + a Somnia-explorer link.
  - The agent's **decision** (Approve / Deny / NeedMoreEvidence / PolicyInvalid) +
    the covered amount on approve.
  - The cited **reference indices** the ruling relied on (per SPEC-0004 §2.3 R11) —
    each rendered with its source label (FDA, Part D formulary 2026-MM, NICE, NADAC).
  - The agent's **rationale string** (decoded from the callback's `rationaleHash` +
    the off-chain rationale body).
- **R34 (MUST) During `UnderReview`, expose what was asked.** Between
  `requestAdjudication` and `Ruled`, the panel shows: the **packet Merkle root**
  (SPEC-0004 §2.3 R10) and the list of references *submitted to* the agent. This
  is the "what is the agent seeing right now" view that closes the audit loop
  before the ruling lands.
- **R35 (SHOULD) Reasoning chip in the timeline.** Each `Ruled` row in the live
  timeline (SPEC-0002 R1) carries a chip linking to the per-round reasoning view
  per R33, so the user can audit any prior round at a glance.
- **R36 (SHOULD) Plain-language summary of the reasoning.** Above the technical
  rationale + cited-references list, a one-sentence summary: *"Approved at $5,200
  because the FDA label cites moderate-to-severe plaque psoriasis as an indication;
  the payer's clause does not override."* The technical artefacts are below.
- **Data dependencies.** R33–R36 depend on the agent callback carrying the
  `usedReferenceIndices` + `rationaleHash` from SPEC-0004 §2.3 R11; the off-chain
  rationale body lives wherever the off-chain agent stores it (content-addressed,
  same as the note + packet). Track this dependency on SPEC-0004's deliverable.

### 2.8 (2026-05-29) Adjudication-loop detection + escalation surface (Decision 8)

Bug surfaced by Violet's session log (2026-05-29). The arbiter responded
`EvidenceRequested` after the first ruling; the user submitted more evidence;
the next ruling **timed out** (`RulingTimedOut`); the contract auto-routed back
to `EvidenceRequested`. Repeated for a second cycle → same outcome. User had no
out except `Refuse Terms` or `Withdraw Request`. Today the UI offers
**no signal** that the loop is happening, no aggregate view of how many rounds
have elapsed, no explanation of *why* the arbiter keeps asking, and nothing to
stop the user from burning another 0.33 STT silently.

Two distinct failure modes feel the same to the user, and the UI should handle
both:

- **(a)** Arbiter responds, but the response is `NeedMoreEvidence` round after
  round. The agent is producing decisions; they're just not terminal.
- **(b)** Arbiter doesn't respond before the contract's timeout fires;
  `onRulingTimeout` routes the request back to `EvidenceRequested` without an
  agent rationale.

Requirements:

- **R37 (MUST) Loop detection.** The client tracks per-`reqId` consecutive
  `(Ready → UnderReview → {NeedMoreEvidence | Timeout} → EvidenceRequested)`
  cycles. After **N=2** consecutive non-terminal cycles, the request enters a
  `stuck` UI flag (in addition to its on-chain state). N lives in client config
  (R39).
- **R38 (MUST) Surface the stuck state with explanation.** When `stuck`, the
  Detail view replaces the bare "submit more evidence" affordance with a
  *Looks stuck* card that shows:
  - Number of completed non-terminal cycles + their decision types (per-cycle
    `NeedMoreEvidence` vs `Timeout`).
  - The arbiter's stated reason for each `NeedMoreEvidence` (linked to the
    §2.7 R33 reasoning explorer for the corresponding round).
  - The on-chain receipt id + Somnia-explorer link for each round (per §2.7
    R33's per-round receipt).
  - Escalation options as explicit buttons: **Try once more** (a deliberate
    re-fire that costs STT, requires a confirmation), **Refuse terms** (the
    Provider's terminal exit), **Withdraw** (the Provider's pre-ruling pull),
    **Deadlock** (if the contract permits — see SPEC-0004 §2.4 R14 terminal).
- **R39 (SHOULD) Configurable threshold.** `N` is a client config value
  (default 2). Deployments running real-money arbitration may want stricter
  thresholds; demo deployments may want more headroom for instructional
  iteration. Documented next to the wallet/RPC config block.
- **R40 (MUST) Auto-pause `requestAdjudication` while stuck.** When `stuck`,
  the "Request AI Decision" button is disabled by default. Re-enabling
  requires the user to expand the *Looks stuck* card and explicitly choose
  *Try once more* with a confirmation that names the STT cost
  (`0.33 STT to fire again — last 2 attempts didn't reach a terminal ruling.
  Continue?`). This prevents the silent-burn failure mode that Violet hit.
- **R41 (SHOULD) Distinguish failure mode in the surface.** The *Looks stuck*
  card labels each round's failure as either `NeedMoreEvidence (agent ruled)`
  or `Timeout (agent did not respond)` — they suggest different remediations
  (the former: rework the evidence packet; the latter: check the agent's
  health or wait for it to come back).

**Cross-spec.** R37–R41 are UI-side detection + surface; the underlying
contract behaviour (auto-routing timeouts to `EvidenceRequested`) is in
SPEC-0001 R9 / R12 territory. Reconsidering whether the contract should
auto-loop forever, or cap at a hard terminal `Deadlocked` after N timeouts, is
a SPEC-0001 amendment-level question — captured here as a follow-up.

### 2.9 (2026-05-29) Runtime wallet configurability (Decision 9 — UNIT-7a)

Pragmatic decision to unblock the two-wallet demo (SPEC-0004 R2b requires
`providerAddr != insurerAddr`, so the existing single-`.env`-key model can't
sign as both roles). Until the production wallet-connect path lands (R25,
R26), the dev loop needs a way to set the second key without rebuilding the
bundle — pasted from the Settings screen, stored in `localStorage`, picked up
on the next page load.

- **R42 (MUST) UI-configurable private keys for provider + insurer.** The
  Settings screen MUST expose a "Wallet keys" panel with two
  `<input type="password">` fields — one for the provider key, one for the
  insurer key — plus *Save*, *Clear all*, and per-row *Generate* affordances.
  Values are validated as `/^0x[0-9a-fA-F]{64}$/` before being accepted.
  Empty fields fall back to the corresponding `VITE_PRIVATE_KEY*` env value.
  The UI displays a one-line warning: **testnet-only — never paste a key
  controlling real funds.**
- **R43 (MUST) `localStorage` override beats `.env`.** At client-construction
  time, the web bundle reads each private key via a helper that probes
  `localStorage["curie:VITE_PRIVATE_KEY*"]` first and falls back to the
  build-time env. Only `0x`-prefixed 64-hex values are accepted from
  storage; anything else is ignored and the env fallback wins. Keys are
  never logged, never echoed to the DOM, and never sent over the network.
- **R44 (MUST) Reload-to-apply.** Changes saved via the UI take effect on
  the next page load. The UI prompts the user to reload, and offers a
  "Reload now" button. (Hot-swap-without-reload is out of scope; see §7.)
- **R45 (MUST) `setActiveClientProfile(id)` flips the signer on profile
  switch.** The web client exposes two concrete clients (`providerClient`,
  `insurerClient`) plus a Proxy-backed `client` export that dispatches every
  property access to whichever concrete client a module-level pointer names.
  App.tsx's profile-switch handler MUST call `setActiveClientProfile(id)`
  BEFORE the React state update so any tx fired from the same render cycle
  is signed by the correct wallet.
- **R46 (SHOULD) Insurer address surfaced as a stable export.** The web
  client exposes `INSURER_ADDRESS` derived from the insurer wallet. Create.tsx
  uses this to populate `insurerAddr` on `createContract` so the resulting
  on-chain Negotiation has a real two-party shape (`providerAddr` = active
  wallet; `insurerAddr` = the second wallet's actual address). The synthetic
  `0x...0002` placeholder used pre-UNIT-7a is removed.
- **R47 (SHOULD) Acceptance test on Settings.** A browser-verify path drives:
  paste a known 0x+64-hex string into "Insurer private key", click Save, click
  Reload, switch profile to Insurer, observe the wallet chip flipping to the
  new address (no longer matching the provider address), and observe that the
  Network "active rulings" + wallet balance recompute against the new signer.

**Security posture (informational, not a requirement):** `localStorage` is
per-origin, plaintext, and survives until the user clears site data. This is
acceptable for a testnet-keys-only dev affordance and is consistent with the
"never paste a real-funds key" disclaimer. Production v0 keeps R25/R26's
MetaMask + SIWE as the primary path; R42–R47 is the *demo-loop* convenience,
not the production wallet model.

## Implementation plan (auxiliary)

> Non-normative. Phases the polish work into landable PRs against the spec
> above. Update as implementation lands.

### Already done

- **§2.1 R1 (balance chip)** — `web/src/hooks/useWalletBalance.ts` +
  `web/src/components/WalletBalance.tsx`, mounted in `App.tsx` header. Live
  refresh on tx-confirmed + 30s visibility-gated poll.
- **§2.1 R3 (per-tx realized cost)** + **§2.1 R4 (attribution)** — minimum
  viable in `web/src/components/TxMonitor.tsx`; attribution rule pinned to
  "Outbound to agent (fee escrow)" when `value > 0` else "Burned (gas)".
- **§2.1 R7 (no console-spam logging)** — no `console.*` writes on the happy
  path anywhere in the tx-event flow.
- **§2.2 R8–R10 (event bus + dev sink + gitignore)** — `RealBackend.txEvents`
  dispatches `tx-confirmed` after every `_send()` write; `web/src/txLogger.ts`
  subscribes + POSTs; `vite.config.ts` middleware writes JSONL to
  `.tmp/tx-log.jsonl`; `.tmp/` gitignored.

### Phase A — Action coherence + estimateGas pre-flight (§2.3 R13–R19)

Smallest visible polish. Lands before any layout work because the same
re-render-from-state machinery underpins the layout fixes in Phase B.

- `web/src/views/Detail.tsx` — subscribe action panel to a `useNegotiation(reqId)`
  hook that re-fetches on every `tx-confirmed` (R13).
- Every action button gains a `pending` state from `useAction()` wrapper (R14).
- `web/src/lib/revertReasonMap.ts` (new) — `Error(string)` → user-facing copy
  (R16). Exported from the lib so off-chain tools render the same.
- `web/src/views/Create.tsx` — in-flight set keyed on
  `(providerId, drugRef, justificationHash)` (R15).
- Semantic confirmation card component used by both Detail + Create (R18).
- TxMonitor + JSONL entries gain `summary` field (R19).

### Phase B — Layout, error UI, simulated parity, screenshot review (§2.4 R20–R23)

- CSS pass for the 10 baseline issues. Header column compaction is the most
  impactful single fix; form column width / textarea growth are next.
- `<ErrorCard>` component used by Create + Detail (R21).
- Mirror Phase A's `useAction()` wrapper in `SimulatedBackend` (R22).
- Re-capture screenshots into `docs/progress/2026-MM-DD-post-spec0003/` for the
  after-set (R23).

### Phase C — Wallet & onboarding (§2.5 R24–R29)

Independent of A/B; could ship in parallel.

- New `Landing` view (CTAs: *Sign in to my organisation* / *Try the demo*).
- `web/src/lib/auth/siwe.ts` — SIWE challenge + verify against a connected
  wallet via WalletConnect / MetaMask (R25). No Privy code yet.
- Profile picker becomes role-restricted in production builds (R27).
- Production builds set `IS_DEMO=false` and read the wallet from the connected
  signer; demo builds keep the current `VITE_PRIVATE_KEY` path.

### Phase D — Submit-amount gating (§2.6 R30–R32)

Smallest of the lot — depends on Phase A's pending pattern.

- `web/src/views/Create.tsx` — inline validation using `useWalletBalance` +
  `contract.createContract.estimateGas` for the gas portion. Block + render
  per-R30 error.

### Phase E — AI reasoning panel + receipts (§2.7 R33–R36)

Depends on SPEC-0004's evidence-packet schema + agent callback shape
(`usedReferenceIndices`, `rationaleHash`). Build the panel against a fixture
first, wire to real once SPEC-0004 lands.

- New `web/src/views/AiReasoning.tsx` (inline, not a separate route).
- `web/src/lib/explorerLinks.ts` — Somnia explorer URL builder.
- Reasoning chip on each `Ruled` timeline row (R35).

### Phase F — Loop detection + escalation surface (§2.8 R37–R41)

- `web/src/hooks/useNegotiationLoopStatus.ts` — derives `stuck` state from the
  negotiation's event history.
- `LooksStuckCard` component used by Detail when `stuck`.
- Config block in the demo header documents the threshold N (R39).
- Confirmation modal for the *Try once more* path (R40).

### Test approach

- Vitest unit tests for the pure derivations (`useNegotiationLoopStatus`,
  `revertReasonMap`, the dedupe set for R15) live alongside the modules.
- Agent-browser smoke tests for each phase land in `web/tests/agent-browser/`
  exactly like the existing `run.sh` pattern. Phase A and Phase B get
  screenshot-diff steps per R23.

### PR strategy

One PR per phase. Phase order: A → B → D in sequence (each lands a UI
contract subsequent phases rely on); C and E in parallel; F last, after the
loop-detection signal is well-understood.

## 3. Technical documentation

- **Balance source:** `wallet.provider.getBalance(wallet.address)`. The web client already
  builds a `RealWallet` (`web/src/client.ts` → `src/contract/real.ts`); a thin
  `useWalletBalance(refreshKey)` React hook can call it. Bump `refreshKey` after every tx
  the client sends so the post-tx refresh is a single source of truth.
- **Cost preview:** for each method on `CoverageNegotiation`, use
  `contract.method.estimateGas(args)` + `provider.getFeeData()` to compute
  `gasEstimate × maxFeePerGas` (or `gasPrice` on legacy networks). For value-bearing calls
  (`requestAdjudication`), `value` is the agent-fee constant already in env
  (`VITE_AGENT_FEE_WEI`); render it separately so the user sees fee-vs-gas.
- **Cost realized:** from the `TransactionReceipt`: `effectiveGasPrice × gasUsed`. The receipt
  also carries logs, which we already consume for the timeline — extend the timeline row to
  carry a `cost` field.
- **Attribution rules:** keyed by contract method →
  - `requestAdjudication` → `Outbound to agent (fee escrow)` + value, plus `Burned (gas)`.
  - `createContract` (if it requires a deposit) → `Outbound to contract (deposit)` or
    `Locked (escrowed)` depending on contract semantics; otherwise `Burned (gas)` only.
  - Accept/appeal/evidence (no value) → `Burned (gas)` only.
  - `Settled` / refunds → `Inbound (refund / settlement)` on the receiving wallet.
- **Polling:** use a single shared interval (≤30s) gated on document visibility so background
  tabs don't burn RPC quota. Skip polling when in simulated mode.
- **No new env or contract changes.** Reads the existing `VITE_AGENT_FEE_WEI`, RPC, and
  contract address. Spec is observability over the existing protocol.

## 4. Deliverables (Decision 1)

- `useWalletBalance` hook + a header chip rendering `0x2040…9128 · 0.0123 STT`.
- A reusable `TxCostPreview` component (used by Create, evidence-submission, accept, appeal).
- Extension of the SPEC-0002 timeline rows with a `cost` cell + attribution label.
- An insufficient-funds banner on Create / send affordances.
- Simulated-mode parity with `(modeled)` tags.

## 5. Test cases (Decision 1)

- **T1 (R1):** with a freshly-funded dev wallet, the header chip reflects the on-chain
  balance within one poll window; after a send, the new balance appears before the next user
  click.
- **T2 (R2):** clicking "create" without sending shows a preview that decomposes into
  `value sent` + `gas` and matches what the wallet actually pays on send (within slippage).
- **T3 (R3):** the timeline row for each round carries the realized
  `effectiveGasPrice × gasUsed` and the value transferred, sourced from the receipt.
- **T4 (R4):** for `requestAdjudication`, the attribution reads "Outbound to agent (fee
  escrow)" + the gas burn — not a single opaque number.
- **T5 (R5):** with a 0-balance wallet, the Create send button is disabled and the banner
  names the shortfall.

## 6. Pass / fail criteria (Decision 1)

**PASS:** real-mode session shows balance + per-tx cost + attribution; the timeline carries
realized costs; the insufficient-funds path is blocked before signing. **FAIL:** any tx is
sent without the user being able to see its expected and realized cost from the UI alone.

## 7. Out of scope

- USD pricing of STT.
- Historical balance charting / portfolio view.
- ERC-20 / non-native token flows — STT only in v0.
- **Hot-swapping wallet keys without a page reload (§2.9 R44).** The web
  client's signer is bound at module-init. Rebuilding it in place would
  require either reactive contract bindings (large refactor) or unsound
  state surgery (risk of partial writes being signed by the previous key
  mid-flight). The reload contract is acceptable because the UI nudges the
  user and the operation is rare (per-session, not per-action).
- **Per-action signer selection** beyond the existing two-profile
  (provider, insurer) model — e.g. an "arbiter" or "auditor" client.
  Adding a third signer is a configuration extension; the proxy + factory
  already support it but no v0 view consumes it.
- Multi-account *rotation* (provider key A → provider key B mid-session)
  beyond the Settings paste-and-reload affordance. Production v0 keeps
  R25's MetaMask + SIWE as the rotation path; R42–R47 is the demo-loop
  convenience.

## 8. Open questions

- **Q1.** Does `createContract` require a deposit today, or is the only value-bearing call
  `requestAdjudication`? Confirm against the merged `CoverageNegotiation.sol` so R4
  attribution names the right "Outbound to contract" cases (or removes that label).
- **Q2.** Do we want a **funding-flow shortcut** in the UI ("send X STT from `0xdD4a…6CEA`
  to `0x2040…9128`") for the dev experience, or is that out-of-scope tooling?
