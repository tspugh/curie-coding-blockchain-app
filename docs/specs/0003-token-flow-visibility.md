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

### 2.10 (2026-05-30) Real-mode adjudication blocked by live agent ABI drift (Decision 10)

*(Merged from PR #14 — `spec-amendments-agent-selector` branch — 2026-05-30.
Originally numbered §2.9 / R42-R43 on that branch; renumbered to §2.10 /
R48-R49 here to avoid collision with the already-landed UNIT-7a wallet-config
decision above. Cross-spec ladder fix references that point at "R25" still
point at SPEC-0004 R25 — unchanged.)*

Token-flow visibility (Decision 1) is only meaningful if the agent fee escrow
we display actually pays for executed agent work. A stand-alone isolation test
on 2026-05-30 (evidence below) confirmed that **every real-mode
`requestAdjudication` against the deployed `CoverageNegotiation` on Somnia
testnet currently terminates with `ResponseStatus.Failed (3)`** — not because
the LLM disagreed, but because every validator in the subcommittee rejects our
calldata at viem ABI-decode *before any LLM or HTTP work begins*. Each
validator's `executionCost` is effectively zero; the entire 0.30 STT per-fire
"agent reward" portion ends up not paying for any LLM cycle.

The selector our contract sends is `0x4be9280f` — derived from
`ExtractANumber(string,string,uint256,uint256,string,string,bool,uint8)` per
`docs.somnia.network`. The live registered ABI for agent
`12875401142070969085` does not contain that selector. The deployed
`contracts/contracts/CoverageNegotiation.sol:759` calls
`IParseWebsiteAgent.ExtractANumber.selector` against this same agent id, so
this drift hits the production contract verbatim — not just the isolation
test that surfaced it.

**Why this matters for THIS spec:** if R4 attribution labels the escrow as
"Outbound to agent (fee escrow)" without surfacing that the fee paid for a
parse-time crash rather than an LLM ruling, the token-flow visibility is
*actively misleading*. A real-mode user would see "fee paid → Failed ruling"
and reasonably conclude the LLM ran and disagreed — when in fact no LLM ran
at all.

- **R48 (MUST — blocker) Real-mode adjudication MUST produce at least one
  `ResponseStatus.Success` ruling end-to-end against the live agent before
  Decision 1 (§2.1) can be marked Implemented.** Today every fire returns
  `Failed (3)` for the ABI-decode reason above; the cause is upstream of this
  spec but the token-flow demo cannot legitimately ship without resolution.
  Acceptable resolutions include: (a) regenerate `IParseWebsiteAgent` from
  the *live* registered ABI (see SPEC-0004 §2.7 R25), (b) switch the
  configured `AGENT_ID` to one whose registered ABI matches what the contract
  emits, or (c) deploy a new contract that targets a verified
  selector + agent pair.
- **R49 (MUST) R4 attribution under Amendment 0006 self-hosted mode.**
  *Rewritten 2026-05-30 (ticks 139-140) after Amendment 0006 shipped on
  Somnia testnet. The validator-subcommittee dichotomy in the original
  R49 (preserved below as Historical) no longer applies to the deployed
  contract `0x2c561f33…488ac93`, which has `selfHosted == true`.* In
  self-hosted mode the orchestrator pays the LLM provider off-chain and
  submits a single synthetic-`requestId` response via `handleResponse`;
  `executionCost` in that response is always 0 by construction. The UI
  R4 attribution MUST therefore distinguish the following three
  on-chain-observable outcomes, each from a different terminal state
  the contract can reach after `requestAdjudication`:

  | Observed state | UI copy | Treatment |
  |---|---|---|
  | `Ruled` event with `ResponseStatus.Success` + decoded ruling | "Ruling delivered (Approved / Denied / NeedMoreEvidence / PolicyInvalid)" | Display the decoded decision + per-unit prices; route per existing R4 |
  | `Ruled` event with `ResponseStatus.Failed` (or Failed-from-revert in callback) | "Orchestrator reported failure" | Show the fee status as "fee held by contract pending operator action" — under self-hosted the fee transfer happens INSIDE `_fireAgentSelfHosted` before handleResponse, so a Failed callback after a successful fire means the orchestrator returned a failure code, not a fee leak |
  | `rulingDeadline` elapsed with no callback fired | "Orchestrator silent — operator escalation required" | Show how long past the deadline; surface `onRulingTimeout()` as the recovery action; preserve the fee accounting (transferred to orchestrator EOA at fire time) |

  Implementations MAY surface "self-hosted mode" as a UI badge so users
  understand the attribution model differs from a validator-subcommittee
  consensus model. The chain-only payload alone cannot resolve finer
  fee-accounting questions (e.g., did the orchestrator actually pay
  Anthropic for an LLM call before returning Failed?) — that requires
  orchestrator-emitted off-chain telemetry, which is out of scope for v1.
  Reads exclusively from the existing callback payload + contract state;
  no new RPC or contract changes needed.

  *Historical (validator-subcommittee mode, superseded by Amendment 0006
  on 2026-05-30; the deployed `0x1dC5bA…3E1A` build used this model
  but is no longer the active address):* the original R49 required
  distinguishing "fee burned (no work executed)" from "fee paid (LLM ran
  but consensus failed)" by summing `executionCost` across the validator
  `Response[]` carried by the callback. Approximately-zero sum meant
  "fee burned (no agent work)"; sum ≈ `perAgentBudget × subcommitteeSize`
  meant "fee paid (LLM ran, consensus failed)". Same UI affordance + cost
  number, different copy. This text is preserved for historical context
  and for any future return to a validator-subcommittee path.

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
| validator error | `"ABI decode failed (selector=0x4be9280f): … not found on ABI. … viem@2.46.1"` |
| final status | `RequestFinalized(requestId=3183908, status=3 Failed)` |

**Cross-spec.** The root-cause fix lives in SPEC-0004 §2.7 R25 (the on-chain
agent-call edge); this spec covers the visibility consequences and the demo
gate. R48 (this spec) renumbered from PR #14's `R42` on merge; SPEC-0004's
R25/R26/R27 numbers are unchanged.

### 2.11 (2026-06-01) Tx-ledger durability, Detail auto-refresh, and action-coherence corrections (Decision 11)

Distilled from real-mode full-flow agent-browser verification on
2026-06-01 (see [`../progress/2026-06-01-full-flow-verification.md`](../progress/2026-06-01-full-flow-verification.md)
and [`../progress/2026-06-01-dispute-and-bad-policy-flows.md`](../progress/2026-06-01-dispute-and-bad-policy-flows.md)).
After driving the deployed `0x2c561f33…488ac93` contract through every
state (Filed → Settled, Dispute → Settled, Bad-policy → PolicyInvalidated),
a set of UI-side behaviours surfaced that are required for the system to
reach the spec-correct terminal states from a clean page-load. All items
below are **additive** to §2.1–§2.10; none rewrite earlier requirements.

#### Tx-ledger durability (extends §2.2 R8/R9)

The original §2.2 left the event-log fetch strategy and the in-UI tx
monitor's reload behaviour unspecified. Both gaps caused the
Detail-Timeline / Network-tab / Tx-Monitor surfaces to render empty after
a page reload despite a complete on-chain history existing (see full-flow
ISSUE 7).

- **R50 (MUST) Paged event-log scan against the Somnia testnet 1000-block
  cap.** `RealBackend.getEvents` MUST query the chain via
  `provider.getLogs({ address, fromBlock, toBlock })` in chunks of at most
  `LOG_PAGE_SIZE = 1000` blocks and decode the contract's events from the
  resulting `LogDescription` set. A single naive `eth_getLogs({fromBlock:0,
  toBlock:latest})` MUST NOT be used — Somnia testnet's RPC reverts with
  `"block range exceeds 1000"` and the App-level `events` array stays
  empty. The paged scan SHOULD perform one call per page parsed against
  the interface (not one-call-per-event-name × pages).
- **R51 (MUST) Deployment-block plumbing for full-history scans.**
  `RealBackend` MUST accept `RealBackendOptions.deploymentBlock`; the web
  bundle MUST forward `import.meta.env.VITE_DEPLOYMENT_BLOCK` into that
  option. When `deploymentBlock` is unset, the default lookback MUST be
  `latest - 10_000` blocks (~3.5h of testnet). Operators MUST be able to
  set `VITE_DEPLOYMENT_BLOCK` in `.env` to recover full-lifetime history
  past the 10k-block default window for a long demo run, at the documented
  cost of additional paged RPC calls at startup.
- **R52 (MUST) TxMonitor hydration from the persistent JSONL sink.** The
  Vite dev-server middleware (§2.2 R9) MUST expose a `GET /__log/tx`
  endpoint that returns the persisted `.tmp/tx-log.jsonl` contents as a
  JSON array. The web client MUST call a `hydrateTxLogFromSink()` helper
  once on mount (from the `TxMonitor` component's effect that wires the
  subscription) that fetches `GET /__log/tx` and replays each entry through
  `ingest()`. Without this hydration the session-only ingest stream
  silently resets header totals to zero on every page reload, even though
  the JSONL ledger accumulated correctly.

#### Detail-view auto-refresh + profile-switch preservation

- **R53 (MUST) Detail re-fetches `getNegotiationView` on every event whose
  `reqId` matches the active view.** The current `Detail.tsx` effect with
  `[reqId, events]` deps does not catch identity-mutated state when
  React's array dep check is fooled. Implementations MUST EITHER trigger a
  manual refetch on every new event whose `reqId === active`, OR add a
  short polling fallback while `state == UnderReview`. The
  `Ruled`-then-no-refresh failure mode where the Detail page keeps
  rendering "Request AI Decision →" after the orchestrator has delivered
  the ruling (workaround: click Back, re-open the row) MUST be eliminated
  — the next render after the matching event MUST reflect the new
  on-chain state. (Full-flow ISSUE 5 + dispute ISSUE D2.)
- **R54 (MUST) Profile-switch MUST preserve the current Detail view.**
  Clicking Provider / Insurer / Observer in the top-bar radio while on a
  Detail page MUST NOT drop the user back to Overview. The active
  `reqId` + `useView` state MUST be preserved across profile change so
  the user can flip sides without re-clicking the row. (Full-flow ISSUE
  6.) This is required because the Insurer-side engage / accept and the
  Provider-side accept / settle / appeal alternate within the same Detail
  view; making the user re-navigate after every flip breaks the demo
  cadence and exercises bugs that only surface when state is reset.

#### Action coherence corrections (extends §2.3 R13/R14)

- **R55 (MUST) Appeal affordance MUST be gated on `state === Denied`, not
  on `ruled`.** When the AI rules `Approve`, the UI MUST NOT render an
  enabled Appeal affordance. The contract reverts with
  `"appeal: prior ruling not Deny"`
  ([`CoverageNegotiation.sol:483`](../../contracts/contracts/CoverageNegotiation.sol#L483))
  in that case, but the current `appeal-submit` handler swallows the
  gas-estimation revert and leaves the textarea populated with no
  surfaced error. Implementations MUST EITHER hide the affordance
  entirely when `view.state !== State.Denied`, OR render a disabled
  affordance with an inline notice
  *"Appeals are only available when the AI has denied the request."*
  Either way the user MUST be prevented from firing a tx that will revert
  silently. (Dispute ISSUE D1.)
- **R56 (MUST) Terminal-state explicit CTA.** When the active negotiation's
  `view.terminal === true`, the Detail page MUST render a single
  context-tailored CTA that deep-links to `Create.tsx`. Specifically:
  - `PolicyInvalidated` → CTA copy "Policy must be revised off-chain — File
    a corrected request →" (no in-UI engage-with-new-policy affordance —
    the contract design forbids re-engagement at the same `reqId`; recovery
    is a brand-new request).
  - Other terminal states (`Settled`, `Refused`, `Withdrawn`) → a generic
    "File a new request →" CTA.
  The CTA MUST occupy the same Detail action-panel slot the (now-hidden)
  state-mutation affordances would have occupied, so the user is not left
  with a blank action panel. (Dispute ISSUE D3.)
- **R57 (MUST) Per-party affordance set on `Approved` and `Denied`.** On
  `Approved` state both Provider and Insurer MUST see Accept (per their
  respective party id); both MAY see Appeal (subject to R55's
  state-gate — moot on Approved). On `Denied` state both Provider and
  Insurer MUST see Appeal (with the agentFeeValue cost surfaced — see
  SPEC-0004 R29). Only Provider sees `Refuse Terms`. Both parties see
  `Withdraw` while non-terminal. The exact affordance set the live build
  must produce on Approved is the testid set
  `{accept-submit, appeal-evidence, appeal-submit, feedback-text,
  withdraw-submit}` for Insurer and that same set plus
  `{refuse-submit}` for Provider. (Dispute flow A verification.)

#### Cross-spec dependencies (additive)

- The tx-ledger MUSTs (R50–R52) depend on `vite.config.ts` middleware
  + `web/src/txLogger.ts`'s `hydrateTxLogFromSink()` helper +
  `RealBackendOptions.deploymentBlock` plumbing in `src/contract/real.ts`
  + `web/src/client.ts` forwarding `VITE_DEPLOYMENT_BLOCK`. All landed in
  the design-handoff branch on 2026-06-01 (see ISSUE 7 closure).
- R53 (Detail auto-refresh) MUST also satisfy the dispute-flow path where
  the orchestrator delivers a `Ruled` event with a re-rule outcome (Deny
  → Deny on second appeal, then Deny → Approve on third). Each re-rule
  arrives as a fresh `Ruled` event for the same `reqId` and round; the
  Detail panel MUST re-derive against the latest ruling, not against any
  earlier one.
- R55–R56 reuse the §2.4 R21 ErrorCard surface for the disabled-affordance
  notice and the terminal-state CTA copy.

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
  - `createContract` → `Burned (gas)` only. Verified non-payable in
    `contracts/contracts/CoverageNegotiation.sol:354` (signature is
    `external returns (uint256 reqId)` — no `payable`, no `msg.value`). The
    only value-bearing call in the negotiation flow is `requestAdjudication`
    (see Q1 closure in §8).
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

- **Q1 — RESOLVED tick 149.** Does `createContract` require a deposit today,
  or is the only value-bearing call `requestAdjudication`?
  **Answer: only `requestAdjudication` is value-bearing.** `createContract` at
  `contracts/contracts/CoverageNegotiation.sol:354` is declared
  `external returns (uint256 reqId)` — non-payable, no `msg.value` reference,
  no deposit. `requestAdjudication` at line 420 is `external payable
  nonReentrant` (carries the agent-fee escrow). R4 attribution
  has been tightened to drop the `(if it requires a deposit)` conditional —
  `createContract` maps to `Burned (gas)` only.
- **Q2.** Do we want a **funding-flow shortcut** in the UI ("send X STT from `0xdD4a…6CEA`
  to `0x2040…9128`") for the dev experience, or is that out-of-scope tooling?
- **Q3 — RESOLVED tick 149 (was: blocking R42, now R48 after merge renumber).**
  Which resolution path do we take for the agent-ABI drift documented in §2.9?
  **Answer: path (c) self-deploy adopted** via
  [Amendment 0006](../amendments/0006-self-hosted-arbiter-agent.md) (Adopted
  2026-05-30). All Ticks A+B+C+D landed; contract redeployed at
  `0x2c561f339a0A15cf0550cb9a0880Bb341488ac93` with `selfHosted == true` and
  `platform == orchestrator EOA`; `npm run verify-deploy` 8/8 PASS (tick 142).
  R42 was renumbered to R48 on PR #14 merge (per the §2.10 merge note);
  R48 is unblocked from the deploy side. Live R48 verification still requires
  real-mode browser-verify (externally gated on wallet refund and/or
  `ANTHROPIC_API_KEY`).
