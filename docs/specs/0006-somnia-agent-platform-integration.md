# SPEC-0006: On-chain Somnia agent integration + generalized cases + usability

**Status:** Approved · **Owner:** tspugh · **Date:** 2026-06-01 (merges SPEC-0005); R-OPEN-1–4 resolved 2026-06-03 (LLM Inference agentId + ABI pinned)

> Authored 2026-05-30 from on-chain probes + Somnia docs research; **revised
> 2026-06-01 to merge SPEC-0005 (usability + integration testing) and add four
> hard requirements surfaced in the dispute / bad-policy verification session
> (see [`docs/progress/2026-06-01-dispute-and-bad-policy-flows.md`](../progress/2026-06-01-dispute-and-bad-policy-flows.md)):
> (1) no off-chain AI and no stubs — banned across the board, (2) the arbiter
> must handle any drug × patient-note combination, with at least six worked
> examples, (3) every per-negotiation evidence URL must point to a live site
> (verified pre-submit and pre-fire), (4) the LLM's reasoning must be visible
> as part of the case. SPEC-0005 status flips Draft → Superseded by SPEC-0006
> on merge.

## 1. Summary & user story

Curie returns to the original architectural intent of calling Somnia's
on-chain AI Agent Platform for adjudication rulings, generalized to handle
arbitrary drug + patient-note combinations (not just the demo's Adalimumab
case), with the LLM's reasoning surfaced in the on-chain case record and with
the full UI / integration-test surface (formerly SPEC-0005) folded in so all
"is the product real?" requirements live in one place.

**Primary user story.** As a Somnia hackathon judge, I want Curie to
demonstrate *real* on-chain agent invocation via Somnia's distinctive AI
Agent Platform — not a self-hosted off-chain LLM dressed in chain plumbing —
on arbitrary drug-coverage cases I supply, with the LLM's reasoning visible
in the case record so I can audit *why* a ruling went the way it did.

**Secondary user story.** As a clinician (provider), I file a coverage
exception request for any FDA-labeled drug, the system fetches the relevant
public drug information, the on-chain Somnia agent rules, both parties
review the ruling and the AI's stated reasoning, and the contract settles —
all on testnet, with no off-chain shortcuts.

## 2. Requirements

### 2.0 Architectural ban — off-chain AI is prohibited for contract execution

- **R0 (MUST — architectural ban) No off-chain AI, no stubs.** Every value
  the smart contract acts on — every `Ruled` event, every settlement
  decision, every state transition driven by arbiter output — MUST
  originate from a call to Somnia's AI Agent Platform per R1-R5. Curie's
  contract MUST NOT accept ruling bytes produced by, derived from, or
  shaped by any off-chain orchestrator, Anthropic SDK call, self-hosted
  LLM, deterministic stub, or hand-hashed fixture. Equivalently: the
  chain of custody from `RulingRequested` to `handleResponse` MUST pass
  through `IAgentRequester.createRequest` and a Somnia validator
  subcommittee — no detour. Hybrid patterns where an off-chain process
  computes the result and then submits it to the contract via a trusted
  EOA are ALSO banned. (Off-chain Claude calls are permitted ONLY for
  dev/diagnostic scripts named `scripts/dev-*.ts` or `scripts/eval-*.ts`
  that have NO contract-execution path; see R10.)
- **R0a (MUST) Stubs banned in the contract-execution path.** Every
  function the contract or integration test reaches MUST produce its
  result from a live source (chain read, real RPC, real agent
  invocation). No `if (NODE_ENV === 'test') return …` shortcuts; no
  `if (!ANTHROPIC_API_KEY) return …` fallbacks; no precomputed-hash
  branches such as the `DEMO_BAD_POLICY_HASH` shim introduced in the
  2026-06-01 verification session — that shim MUST be deleted on this
  spec's merge.

### 2.1 Canonical platform integration

- **R1 (MUST) Canonical testnet platform address.** Use the canonical
  testnet SomniaAgents address
  `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` (chain 50312). Replace
  every reference to `0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A` in
  code, env vars, specs, amendments, operator notes. (Mainnet equivalent
  — not used in v0 — is `0x5E5205CF39E766118C01636bED000A54D93163E6` on
  chain 5031.)
- **R2 (MUST) `createRequest` call shape.** Calls to the platform MUST
  use the canonical `IAgentRequester.createRequest(uint256 agentId,
  address callbackAddress, bytes4 callbackSelector, bytes payload)
  payable returns (uint256 requestId)` exactly as defined in §3.2.
- **R3 (MUST) `handleResponse` callback shape.** Curie's contract MUST
  implement a callback with the exact 4-arg signature
  `handleResponse(uint256 requestId, Response[] memory responses,
  ResponseStatus status, Request memory details)` and pass the
  corresponding selector to `createRequest`. The legacy 1-arg shape
  `handleResponse(uint256 requestId)` MUST be removed.
- **R4 (MUST) Payload encoding.** Payloads MUST be encoded via
  `abi.encodeWithSelector(IAgent.method.selector, ...args)` where the
  agent's interface is taken from Somnia's published documentation for
  the chosen agent.
- **R5 (MUST) Deposit math.** Each call MUST send
  `msg.value = platform.getRequestDeposit() + (costPerAgent ×
  subcommitteeSize)`. The platform deposit reserve is read dynamically;
  the per-agent reward is hardcoded per agent.

### 2.2 Response decoding

- **R6 (MUST) Iterate responses + filter on Success.** The callback MUST
  iterate `responses[]` and decode only entries with
  `ResponseStatus.Success == 2`. Other statuses MUST NOT be consumed as
  authoritative.
- **R7 (MUST) `ResponseStatus` enum alignment.** Curie's contract MUST
  mirror the platform enum exactly: `None=0, Pending=1, Success=2,
  Failed=3, TimedOut=4` (see §3.4).
- **R8 (MUST) `Response` struct alignment.** Curie's contract MUST
  mirror the platform struct exactly — 6 fields: `address validator,
  bytes result, ResponseStatus status, uint256 receipt, uint256
  timestamp, uint256 executionCost` (see §3.4).

### 2.3 Self-host retirement + stub removal

- **R9 (MUST) Amendment 0006 + orchestrator + stub deleted.** The
  following MUST be removed from active code paths (preserved only in
  git history per "regenerate, don't migrate"):
  - `selfHosted` storage bool, `setPlatformSelfHosted(address)` setter,
    `_fireAgentSelfHosted` branch, `_selfHostedNonce` counter in
    `CoverageNegotiation.sol`.
  - `scripts/orchestrator-real.ts` (the off-chain orchestrator).
  - The `computeStubRuling`, `DEMO_BAD_POLICY_HASH` shim, and
    `ORCHESTRATOR_STUB_DECISION` env override added in the 2026-06-01
    session.
  - Any Anthropic-SDK call site that produces values the contract reads.
- **R10 (MUST) `ANTHROPIC_API_KEY` decoupled from contract execution.**
  The Anthropic SDK + API key MUST NOT be required by, or referenced
  from, any code that produces or shapes ruling bytes the contract acts
  on. Per R0, dev/diagnostic/evaluation use of the SDK is permitted
  ONLY in `scripts/dev-*.ts` / `scripts/eval-*.ts` files that have no
  edge into the contract path. CI MUST fail if any non-`dev-*` /
  non-`eval-*` script imports `@anthropic-ai/sdk`.

### 2.4 Agent choice + ABI pinning

- **R11 (MUST) Use a Somnia-documented base agent.** Curie MUST call one
  of Somnia's published base agents: **LLM Inference** (preferred —
  matches Curie's "given policy + evidence, decide" pattern), LLM Parse
  Website, or JSON API Request. Selection rationale + chosen `agentId`
  + chosen method + chosen ABI MUST be documented in §3.6 before R12
  can pass. **CHOSEN: LLM Inference, `agentId 12847293847561029384`,
  method `inferString(string,string,bool,string[])` (selector
  `0xfe7ca098`)** — resolved 2026-06-03 (R-OPEN-1/R-OPEN-2), documented
  in §3.6. The decision token is constrained via a non-empty
  `allowedValues` (`["approve","deny","needs_more_info","policy_invalid"]`).
- **R12 (MUST) Build-time ABI drift detector.** Extend
  `scripts/check-ruling-abi.ts` to pin the chosen agent's selector +
  param types verbatim. The script MUST fail the build if the on-chain
  ABI for the pinned agent diverges from the pinned shape, AND MUST
  fail if Curie's `_fireAgent` payload-encoding diverges from the
  pinned shape. Wired into `npm test`.
- **R13 (SHOULD) Clean revert on platform upgrade.** If the chosen
  agent's ABI changes mid-deploy (Somnia upgrades the registry),
  Curie's failure mode SHOULD be a clean revert with a recognizable
  message (e.g. `"platform: ABI drift"`), NOT silent fund loss.

### 2.5 Generalized per-negotiation cases

- **R14 (MUST) Per-negotiation evidence URL on-chain.** Replace the
  contract-level `agentEvidenceUrl` (currently
  `CoverageNegotiation.sol:186`) with a per-negotiation `string
  agentEvidenceUrl` stored in the `Negotiation` struct. `createContract`
  accepts it as a new parameter and MUST require `bytes(url).length > 0`
  and `bytes(url).length <= 512`. `_fireAgent` reads
  `n.agentEvidenceUrl`, not a global. The `setAgentEvidenceUrl(string)`
  owner-only setter is removed.
- **R15 (MUST) Per-negotiation prompt hint on-chain.** Add a
  per-negotiation `string agentPromptHint` to the `Negotiation` struct.
  `createContract` accepts it; MUST require length > 0 and ≤ 1024 chars;
  MUST NOT contain anything matching `[A-Z][a-z]+ [A-Z]`-bracketed
  patient names. (PHI-free assertion — patient identifiers MUST stay in
  the off-chain justification body.) `_fireAgent` injects this as the
  drug-specific question to the LLM agent. The current hardcoded
  "rheumatoid arthritis" prompt at `CoverageNegotiation.sol:819` is
  deleted.
- **R16 (MUST) Drug → evidence map in the web app.** A
  `web/src/drugEvidenceMap.ts` (new) holds a curated
  `{drugName → { evidenceUrl, promptHint }}` map covering at least the
  six examples in R18. `Create.tsx` looks up the entered drug name
  (case-insensitive, prefix-strip on RxNorm/NDC suffixes) at submit
  time and pre-fills the evidence-URL and prompt-hint fields. Manual
  override of both fields is allowed (textarea inputs); both inputs
  enforce non-empty before the form's `create-submit` is enabled.
- **R17 (MUST) Empty URL or hint blocks submission both client- and
  contract-side.** UI: the `create-submit` button is disabled until
  both fields are non-empty (form-validation). Contract: `createContract`
  reverts with `evidence: url required` / `evidence: hint required`
  when either is empty. Defense-in-depth — the contract gate is the
  ground truth.

### 2.6 Six worked example cases

- **R18 (MUST) Six worked examples in the curated map.** The
  `drugEvidenceMap.ts` (R16) covers at least these six drug × indication
  pairs at v0 ship. Each entry has a synthetic patient justification
  template in `web/src/sampleCases/` and a curated insurance policy in
  `src/data/policies.ts`. **All justification text is synthetic — no
  real PHI** (R1-equiv from SPEC-0001).

| # | Drug (RxNorm/brand) | Indication | Evidence URL family | Curated policy |
|---|---|---|---|---|
| 1 | Adalimumab (Humira) | Moderate-to-severe plaque psoriasis | FDA label / DailyMed | Part D Adalimumab Specialty Tier 5 |
| 2 | Semaglutide (Ozempic / Wegovy) | T2DM with established cardiovascular disease | FDA label / DailyMed | Commercial PA with cardio-risk step-therapy |
| 3 | Ustekinumab (Stelara) | Moderately-to-severely active Crohn's disease after anti-TNF failure | FDA label / DailyMed | Commercial PA with anti-TNF step-therapy |
| 4 | Lecanemab (Leqembi) | Early Alzheimer's disease (MCI/mild dementia, biomarker-confirmed) | FDA label / DailyMed | Medicare Part D with biomarker-confirmation requirement |
| 5 | Tirzepatide (Mounjaro / Zepbound) | T2DM with HbA1c ≥ 7.5% after metformin trial | Medicaid step-therapy fixture | Medicaid MCO with HbA1c gate |
| 6 | Dupilumab (Dupixent) | Severe eosinophilic asthma after high-dose ICS+LABA | FDA label / DailyMed | Commercial PA with eosinophil count gate |

  Each example MUST exercise a different combination of (payer line,
  expected ruling, appeal-ladder stage). The mapping table lives in
  the spec; concrete URLs + clause text lives in code so it's
  reviewable independently.
- **R19 (MUST) Per-example end-to-end test.** Every entry in R18 has a
  named Scenario in `web/tests/agent-browser/run.sh` that drives the
  full Filed → Settled (or Filed → Denied → appeal → Settled, where the
  example exercises the dispute path) flow on testnet and asserts the
  on-chain Ruled event carries a non-zero `coveredAmount` (Approve
  cases) or zero (Deny cases). A new entry in R18 ships in the same
  commit as its Scenario; an example without a Scenario fails strict-
  review.
- **R20 (MUST) Custom case acceptance.** Beyond the six curated
  examples, the UI MUST accept arbitrary drug names. Submission MUST
  succeed when the user supplies a non-empty evidence URL + prompt
  hint manually (R16's manual override). The contract MUST NOT
  whitelist drugs; the chain has no opinion about which drug is
  filed.

### 2.7 Evidence-URL liveness verification

- **R21 (MUST) Pre-submit URL existence check.** Before `create-submit`
  is enabled, the web app MUST `HEAD` (or `GET` with `Range: bytes=0-0`
  fallback) the evidence URL and require `200 OK` or `30x` (followed),
  with a maximum 10 s timeout. A non-2xx/3xx, a connection failure, or
  a timeout MUST block the submit and surface an inline error:
  `evidence URL unreachable (HTTP <code> or <error>) — fix the URL or
  pick a known drug from the list`. Cached results (per `evidenceUrl`)
  may be reused for 24 h. Sim mode bypasses the check.
- **R22 (MUST) Live agent assertion in integration tests.** Beyond R12
  (build-time ABI drift), the integration test MUST capture, for each
  real-mode arbiter call, the `RequestCreated` event from
  `0x037Bb9C…` (proving the platform was actually invoked) AND the
  matching `Ruled` event whose `requestId` matches. A real-mode run
  that produces a `Ruled` event WITHOUT a corresponding
  `RequestCreated` from the canonical platform fails the assertion
  loud — that's the regression-signal for any future stub leakage.
- **R23 (SHOULD) Periodic link-check.** A nightly CI job (or a manual
  check-in script) re-verifies every R18 evidence URL is still live.
  Stale URLs surface as a spec-issue rather than a runtime failure for
  the user.

### 2.8 AI reasoning visible in the case

> **Reasoning source (Amendment 0007).** The constrained `inferString` decision
> call (§3.6.1) returns only the decision token, but `chainOfThought = true`
> means the model's **actual reasoning is captured in the Somnia receipt**
> (`reasoning` step), retrievable by the decision `requestId` at
> `https://receipts.testnet.agents.somnia.host?requestId=<id>`. A keeper fetches
> it and calls `commitRationale(reqId, rationale, …)` (§3.6.3), which emits the
> **real reasoning text** in `RulingRationale` and stores its `keccak256` on
> chain. Somnia's receipt is canonical; the on-chain hash is tamper-evidence.
> The UI reads `RulingRationale` (or fetches the receipt directly). This is the
> model's real chain-of-thought — **not** a templated summary.

- **R24 (MUST) On-chain reasoning event.** The contract MUST emit a
  `RulingRationale` event carrying the agent's real reasoning (sourced
  from the LLM Inference receipt per §3.6.3, committed via
  `commitRationale`), capped:

  ```solidity
  event RulingRationale(
      uint256 indexed reqId,
      uint256 indexed requestId,
      uint8 indexed decision,
      string rationale,            // capped at 4096 chars; truncated with "…" sentinel
      string clauseReference,      // capped at 512 chars
      string standardReference     // capped at 512 chars
  );
  ```

  This is in addition to the existing `Ruled` event (whose
  `rationaleHash` / `clauseRef` / `standardRef` bytes32 fields stay,
  for chain-of-custody verification). `RulingRationale.rationale`
  carries the human-readable text the LLM returned; the bytes32 hash
  on `Ruled` is `keccak256(rationale)`. A consumer that wants
  cryptographic proof reads `Ruled`; a UI that wants to *show* the
  reasoning reads `RulingRationale`. PHI invariant (SPEC-0001 R3/R4)
  carries: the agent's rationale MUST NOT contain any PHI from the
  off-chain justification body; the system prompt enforces this and
  the contract truncates above 4096 chars defensively.
- **R25 (MUST) UI surfaces the rationale.** The Detail view (`web/src/views/Detail.tsx`)
  renders the latest `RulingRationale` for the current `reqId` in a
  named card (`data-testid="ruling-rationale"`) below the existing
  ruling-meta panel. The card shows: decision label, full rationale
  text, clause reference, standard reference, and a deep-link to the
  on-chain event (Somnia explorer). Appeals stack — each round's
  rationale is shown in chronological order, labeled "Round N".
- **R26 (MUST) Rationale length cap defensively enforced.** The
  contract MUST truncate `responseText` above 4096 chars with a `"…"`
  sentinel before storing/emitting, so a malicious or runaway validator
  output can't OOG the event-emit. The LLM Inference / LLM Parse
  Website system prompts MUST instruct the agent to cap rationale at
  3500 chars to leave headroom.

### 2.9 UI usability + layout invariants (merged from SPEC-0005 §3.2)

- **R27 (MUST) Top-bar density at 1280×800.** Brand, wallet chip
  (address + balance), and Role selector each occupy their own
  vertical column with ≥ 12px gutter; no text overlaps, truncates, or
  wraps; the wallet chip uses tabular-numeric STT formatting.
- **R28 (MUST) Insurer Detail single-column layout.** When the active
  profile is `insurer`, the Detail view renders the action panel +
  timeline in a single full-width column.
- **R29 (MUST) View switch returns to Overview.** Clicking any top-level
  nav item (Overview / Network / Settings) from anywhere in the app
  returns to that view's clean state — NOT a stale Detail page.
- **R30 (SHOULD) Screenshots per layout R.** Each tick that closes
  R27-R29 attaches a viewport screenshot to
  `docs/progress/browser-verify.md`.

### 2.10 Generalized N-user runtime registry (merged from SPEC-0005 §3.3)

- **R31 (MUST) Arbitrary N users.** Profile registry holds 0..N users
  `{id, label, address, role}`. The three seed profiles become seed
  data, not the entire set.
- **R32 (MUST) Runtime add/remove.** Settings → Users supports adding
  a new user (private-key paste OR derived seed in sim mode) and
  removing any non-active user. Persists to
  `localStorage["curie:users"]`.
- **R33 (MUST) Role assignment per user.** Roles are `provider |
  insurer | observer` (extensible). The Role pill row reflects the
  full registry, not a hardcoded list.
- **R34 (SHOULD) Demo-mode quick-switch.** A "demo" toggle in Settings
  shows the legacy three-profile shortcut for guided walkthroughs;
  defaults off in v1.

### 2.11 Customizable insurance policy (merged from SPEC-0005 §3.4)

- **R35 (MUST) Curated policy library.** At engage time, the insurer
  picks from the curated policies tied to R18's six examples (≥ 6
  curated policies) plus the demo's known-bad fixture. Each carries
  `{name, clauses: { id, text, voids?: boolean }[]}`.
- **R36 (MUST) Free-text policy override.** A "Custom policy" choice
  lets the insurer compose their own policy: name + 1..N clauses +
  optional `voids` flag per clause. Validates that name is non-empty
  and ≥ 1 clause is present.
- **R37 (SHOULD) Policy preview before submit.** The selected/composed
  policy renders as a read-only summary card before
  `engage-submit`, with a hash preview of what will be committed.

### 2.12 Error mapping + balance pre-flight (merged from SPEC-0005 §3.5)

- **R38 (MUST) Map "account does not exist" revert family.** When the
  active signer attempts a write tx from an address that has zero
  on-chain history on Somnia testnet, the RPC rejects with
  `{ "code": -32000, "data": "0x02", "message": "account does not
  exist" }`. `src/protocol/revertReasonMap.ts` MUST match this and the
  ethers v6 wrapping `"could not coalesce error"`. Friendly headline:
  **"Wallet has no funds on Somnia testnet"**; *What to do* points
  the user to the testnet faucet with the active address inlined; no
  Retry button.
- **R39 (MUST) Pre-flight balance check for both wallets.** Before any
  write tx, the web layer calls `provider.getBalance(signerAddress)`
  and short-circuits with the `balance-block` inline error when
  balance is below `agentFeeReserve + estimatedGas`. The check
  applies to **both** the provider and insurer signers (the previous
  helper only gated provider — see Issue D4 in the 2026-06-01 dispute
  flow report). Sim mode bypasses.

### 2.13 Per-affordance integration coverage (merged from SPEC-0005 §3.6)

- **R40 (MUST) Per-affordance integration scenario.** Every interactive
  UI affordance whose effect crosses a layer boundary — contract write,
  arbiter trigger, localStorage write, or route-resetting navigation —
  has at least one named Scenario in `web/tests/agent-browser/run.sh`
  that drives it through the live UI and asserts both the on-chain /
  storage effect and the UI's post-action state. Identification rule:
  every `<button>` / `<form onSubmit>` with a `data-testid` that maps
  to a state-mutating action. New affordances ship in the same commit
  as their Scenario.
- **R41 (MUST) Both arbiter outcomes covered.** Every flow that runs
  through an arbiter ruling has Scenarios covering both Approve
  (Settled + provider as recipient) and Deny (Denied + appeal-or-close
  branch). A flow with only one outcome fails the requirement.
- **R42 (MUST) Real on-chain arbiter call verified.** Any Scenario
  claiming integration coverage for an arbiter step MUST hit the live
  Somnia validator subcommittee per R22. Sim-mode short-circuits do
  NOT satisfy R42 (they remain valid for the R45 parallel smoke check
  only).
- **R43 (MUST) Pre-flight wallet sufficiency per scenario.** Before
  each integration Scenario fires its first write tx, the harness
  computes the upper-bound cost
  (`Σ(estimatedGas_i × maxFeePerGas) + (agentFeeReserve × arbiterCallCount)`)
  for **both** signers it will use, and asserts each balance ≥ that
  sum. On shortfall, fails loud with the exact message:
  `insufficient balance: needed X STT, have Y STT, short Z STT — fund <addr> at https://testnet.somnia.network/`.

### 2.14 Headline integration gate + sim parity (merged from SPEC-0005 §3.1)

- **R44 (MUST) Full-loop real-wallet integration test.** A single
  scripted end-to-end run on Somnia testnet covering `createContract`
  → `insurerEngage` → `requestAdjudication` → arbiter
  `handleResponse` → both parties `accept` → `settle`, driven via the
  live UI with agent-browser. PASS only when the on-chain `state ==
  Settled (6)` and the settlement event names the provider as
  recipient. MUST exercise at least 2 of R18's six examples per run
  (one Approve path, one Deny→appeal→Approve path).
- **R45 (MUST) Two funded wallets.** Provider + insurer each hold ≥
  0.5 STT before the test runs. Under-funding fails loud with the
  shortfall in the message (R43).
- **R46 (SHOULD) Per-step receipt capture.** The test records the tx
  hash for each on-chain step and writes them to
  `docs/progress/integration-test.md`.
- **R47 (MUST) Sim-mode parallel run.** The same flow runs in
  simulated mode against the same UI as a fast smoke check. Sim mode
  MUST NOT use any of the stubs banned by R0a; it operates against
  `src/contract/simulated.ts`'s in-memory state machine which has no
  AI component — sim mode's "ruling" is the user picking a Decision
  enum in the UI (an explicit demo-driver choice), not a stubbed
  policy decision.

### 2.15 (2026-06-01) Chain-side observability + runbook hygiene + flow-named coverage (merged from SPEC-0005 §3.7, agent-platform-neutral)

Distilled from the 2026-06-01 full-flow + dispute browser-verify runs
(see [`../progress/2026-06-01-full-flow-verification.md`](../progress/2026-06-01-full-flow-verification.md)
and [`../progress/2026-06-01-dispute-and-bad-policy-flows.md`](../progress/2026-06-01-dispute-and-bad-policy-flows.md))
and folded forward from the now-superseded SPEC-0005 §3.7. These items
are agent-platform-neutral — they apply equally under the
canonical-platform integration this spec targets and were observed
issues under the pre-pivot deploy. **All items below are additive to
§2.0–§2.14; none rewrite earlier requirements.**

- **R48 (MUST) Paged event-log scan against the Somnia testnet
  1000-block cap.** `RealBackend.getEvents` MUST query the chain via
  `provider.getLogs({ address, fromBlock, toBlock })` in chunks of at
  most `LOG_PAGE_SIZE = 1000` blocks and decode the contract's events
  from the resulting `LogDescription` set. A single naive
  `eth_getLogs({fromBlock:0, toBlock:latest})` MUST NOT be used —
  Somnia testnet's RPC reverts with `"block range exceeds 1000"` and
  downstream `events` arrays stay empty. The paged scan SHOULD parse
  the page payload against the interface (one call per page) rather
  than one call per event-name × pages.
- **R49 (MUST) Deployment-block plumbing for full-history scans.**
  `RealBackend` MUST accept `RealBackendOptions.deploymentBlock`; the
  web bundle MUST forward `import.meta.env.VITE_DEPLOYMENT_BLOCK` into
  that option. When `deploymentBlock` is unset, the default lookback
  MUST be `latest - 10_000` blocks. Operators MUST be able to set
  `VITE_DEPLOYMENT_BLOCK` in `.env` to recover full-lifetime history
  past the 10k-block default window, at the documented cost of
  additional paged RPC calls at startup.
- **R50 (MUST) TxMonitor hydration from the persistent JSONL sink.**
  The Vite dev-server middleware MUST expose a `GET /__log/tx`
  endpoint returning the persisted `.tmp/tx-log.jsonl` contents as a
  JSON array. The web client MUST call a `hydrateTxLogFromSink()`
  helper once on mount that fetches `GET /__log/tx` and replays each
  entry through `ingest()`. Without this hydration the session-only
  ingest stream silently resets header totals to zero on every page
  reload, even though the JSONL ledger accumulated correctly.
- **R51 (MUST) Live event-history hydration on reload.** After any
  R44 integration run reaches its terminal state on the live deployed
  contract, a page reload MUST hydrate (within one `getEvents` cycle):
  the Dashboard row count (terminal-state badge with correct count),
  the Detail Timeline event count (one row per emitted event), the
  Network tab explorer-link count (matching the Timeline count), and
  the Tx Monitor header (non-empty gas + value totals + tx count).
  Empty surfaces ("waiting for first confirmed tx", "no events yet")
  against a contract with a non-trivial event history MUST be treated
  as a regression — they indicate R48 (paged getLogs), R49
  (deploymentBlock plumbing), or R50 (JSONL-sink hydration) is
  broken. The integration harness MUST reload the page once after
  each flow's terminal-state landing and assert the four surfaces
  before passing the Scenario.
- **R52 (MUST) Vite dev-server hygiene runbook step.** The demo
  runbook MUST include an explicit pre-demo step: kill all stray
  Vite servers (`lsof -i :5173 -i :5174 …` then `kill -9 <pid>`, or
  equivalent) before starting `npm run web:dev`. A stale dev server
  from a sibling worktree on the default port serves an older
  `client.ts` bundle whose export set may omit `INSURER_ADDRESS`,
  `walletSetupRequired`, `syncProfilesFromUsers`,
  `setActiveClientProfile`, or `USERS_CHANGED_EVENT`; the
  `Create.tsx` form then pulls `INSURER_ADDRESS` as `undefined`,
  ethers serializes it to `address(0)`, and `createContract` reverts
  with `addr: zero` (or silently no-ops with no surfaced error). The
  runbook step MUST be performed before *every* demo run, not just
  the first.
- **R53 (MUST) `INSURER_ADDRESS` MUST never silently fall back to
  the provider address.** The web client (`web/src/client.ts`) MUST
  derive `INSURER_ADDRESS` from `VITE_PRIVATE_KEY_INSURER` and MUST
  surface a loud setup-required state (the existing
  `walletSetupRequired` export semantics) before allowing
  `Create.tsx` to submit a tx when `VITE_PRIVATE_KEY_INSURER` is
  unset. When the insurer key is missing, `createContract` MUST be
  blocked at the UI layer with a surfaced error pointing the
  operator to set the env var; the bundle MUST NOT serialize
  `address(0)` or fall back to the provider's address (which
  triggers a `create: self-contract` revert against the
  contract-side `providerAddr != insurerAddr` invariant). This is
  the UI-side enforcement of SPEC-0004 R32.
- **R54 (MUST) Funding-history + cost-matrix in the runbook.** The
  demo runbook MUST document:
  - The one-off provider → insurer top-up needed for engage +
    appeal cycles (the verified 2026-06-01 run used 0.5 STT, which
    is enough for ~3 demo runs under R44's deploy);
  - The per-actor per-tx cost matrix (createContract ~0.016 STT
    gas; requestAdjudication carries the platform deposit per R5;
    accept ~0.001 STT gas; settle ~0.001 STT gas; insurerEngage
    ~0.0025 STT gas; insurer accept ~0.0019 STT gas — values per
    the 2026-06-01 trace, refreshable per deploy);
  - The post-flow balance audit (provider, insurer, contract —
    verifying no escrow held under the settlement-by-event model).

  A reproducer command block MUST print both wallet balances before
  the demo starts so the operator can confirm the insurer top-up
  landed before clicking Engage.
- **R55 (MUST) Three named flow Scenarios.** R44's headline gate
  MUST be exercised through three named flow Scenarios in
  `web/tests/agent-browser/run.sh`, each driving the live UI
  end-to-end against the R0a-compliant deploy:
  1. **`flow-approve-settle`** — Provider files → Insurer engages
     with a compliant policy → Provider requests adjudication →
     platform agent rules Approve → both parties accept →
     Provider settles. **Terminal:** `Settled (state 6)`.
     **Receipt:** Settled event with recipient = `providerAddr`.
  2. **`flow-dispute-appeal-settle`** — Provider files → Insurer
     engages with a policy + evidence packet whose merits MUST
     drive the platform agent to rule `Deny` on round 0 →
     ruling = Deny (state → 5) → Insurer files appeal with
     additional evidence (round → 2, agent fee paid per R5) →
     **platform agent re-rules `Deny`** → Provider files second
     appeal with the strongest evidence in R18's per-example
     packet → **platform agent rules `Approve`**
     (state → 4, round = 3, appealRound = 2) → both parties
     accept → Provider settles.
     **Terminal:** `Settled (state 6)`. Each of the three
     rulings on this path MUST originate from the platform
     agent per R0/R0a — the dispute mechanism is exercised by
     designing the per-round evidence packet so a real LLM
     judgment shifts from Deny to Approve, NOT by an env knob
     that forces a decision.
  3. **`flow-bad-policy-policy-invalidated`** — Provider files →
     Insurer engages with a non-compliant policy whose clauses
     contradict the FDA-label indication (SPEC-0004 R23's
     policy-void rule) → Provider requests adjudication →
     **platform agent rules `PolicyInvalid`** with
     `clauseRef`, `standardRef`, `policyVoidedClauseIndices` —
     the `PolicyInvalid` decision is reached by the platform
     agent's prompt-level reasoning over the policy text +
     FDA-label slice, NOT by any client-side `policyHash`
     match or hardcoded fixture-recognition shortcut →
     `PolicyFlagged` + `Ruled` + `PolicyInvalidated` emitted in
     the same block → state → 8 (terminal). **Terminal:**
     `PolicyInvalidated (state 8)`. **Receipt:** zero
     state-mutation affordances offered after terminal landed;
     recovery is a brand-new request (SPEC-0003 R56 +
     SPEC-0004 R30).

  Regression on any one flow MUST fail strict-review. **For all
  three flows**: every `Ruled` event the test asserts on MUST
  carry a `RequestCreated` event from the canonical platform
  `0x037Bb9C…` matched by `requestId` (per R22) — flows that
  reach `Ruled` without that paired `RequestCreated` indicate
  stub leakage and MUST fail the Scenario. No
  `ORCHESTRATOR_STUB_DECISION` env knob, no
  `DEMO_BAD_POLICY_HASH` shortcut, no deterministic stub
  branch, and no hardcoded ruling table may participate in the
  Scenario's path to terminal state.

- **R56 (MUST) Network tab shows full chain history, not just
  current session.** The Network tab MUST hydrate from BOTH the
  chain-side paged-`getLogs` result (per R48/R49/R51) covering
  `[deploymentBlock, latest]` (or the default `latest - 10_000`
  lookback) AND the dev-server JSONL sink (per R50) for
  session-persistent `tx-confirmed` events not yet captured in the
  chain scan. Sources MUST be deduplicated by `txHash` (chain-scan
  wins on conflict). A page reload against a contract with a
  non-trivial on-chain history MUST render the full visible history
  in the Network tab — empty surfaces ("no transactions yet",
  "waiting for first confirmed tx") against a contract with prior
  events are a regression (same signal as R51's reload-hydration
  assertion). Mirrors SPEC-0003 §2.11 R58.
- **R57 (MUST) Network tab sorted by recency, descending.**
  Transactions in the Network tab MUST be rendered in **descending
  block-number order — most recent at the top**. Secondary sort
  key when two transactions share a block: transaction index
  within the block (highest index first). Ascending-block-order
  or session-arrival-order rendering fails this MUST. Mirrors
  SPEC-0003 §2.11 R59.
- **R58 (MUST) Dashboard/Overview lists negotiations by
  most-recent activity, descending.** The Overview rows (the
  "Coverage Requests" list on the front page) MUST be sorted by
  **the block number of each negotiation's most-recent event (any
  event whose `reqId` matches that row), descending**. Concretely:
  - A new event on an existing negotiation MUST move that row up
    to the position determined by the new event's block number.
  - A negotiation in a terminal state (`Settled`,
    `PolicyInvalidated`, `Refused`, `Withdrawn`) with no newer
    events MUST fall down the list as newer negotiations push past
    it; terminal state does NOT exclude the row from the sort.
  - Ties (same most-recent-event block) break by `reqId`
    descending.

  This ordering MUST apply on first paint after a reload (derived
  from the paged-`getLogs` scan) AND incrementally as new
  `tx-confirmed` events arrive during the session (a row whose
  negotiation gets a new event MUST reorder to its new position
  within one render cycle). Mirrors SPEC-0003 §2.11 R60.

## 3. Technical documentation

### 3.1 Canonical SomniaAgents contract addresses

| Network | Chain ID | SomniaAgents address |
|---|---|---|
| **Mainnet** | 5031 | `0x5E5205CF39E766118C01636bED000A54D93163E6` |
| **Testnet** | 50312 | **`0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`** |

Source: [`https://docs.somnia.network/agents/invoking-agents/quickstart`](https://docs.somnia.network/agents/invoking-agents/quickstart).
The pre-spec `0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A` is NOT canonical and
MUST be removed.

### 3.2 `IAgentRequester` interface (canonical, verbatim)

```solidity
interface IAgentRequester {
    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);

    function createAdvancedRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload,
        uint256 subcommitteeSize,
        uint256 threshold,
        ConsensusType consensusType,
        uint256 timeout
    ) external payable returns (uint256 requestId);

    function getRequestDeposit() external view returns (uint256);
    function getAdvancedRequestDeposit(uint256 subcommitteeSize)
        external view returns (uint256);

    function getRequest(uint256 requestId) external view returns (Request memory);
    function hasRequest(uint256 requestId) external view returns (bool);

    event RequestCreated(
        uint256 indexed requestId,
        uint256 indexed agentId,
        uint256 perAgentBudget,
        bytes payload,
        address[] subcommittee
    );
    event RequestFinalized(uint256 indexed requestId, ResponseStatus status);
    event SubcommitteePaid(
        uint256 indexed requestId,
        uint256 totalPaid,
        uint256 perMember
    );
    event CommitteeDepositFailed(
        uint256 indexed requestId,
        uint256 attemptedAmount
    );
}
```

### 3.3 Requester-side callback (Curie's contract MUST implement this)

```solidity
function handleResponse(
    uint256 requestId,
    Response[] memory responses,
    ResponseStatus status,
    Request memory details
) external;
```

The `bytes4 callbackSelector` passed to `createRequest` MUST equal
`this.handleResponse.selector` for the exact 4-arg signature above.
The legacy 1-arg `handleResponse(uint256 requestId)` shape MUST be deleted.

### 3.4 `Response` struct + `ResponseStatus` enum

```solidity
struct Response {
    address validator;
    bytes result;
    ResponseStatus status;
    uint256 receipt;
    uint256 timestamp;
    uint256 executionCost;
}

enum ResponseStatus { None, Pending, Success, Failed, TimedOut }
```

### 3.5 `Request` struct + `ConsensusType` enum

```solidity
enum ConsensusType { Majority, Threshold }

struct Request {
    uint256 id;
    address requester;
    address callbackAddress;
    bytes4 callbackSelector;
    address[] subcommittee;
    Response[] responses;
    uint256 responseCount;
    uint256 failureCount;
    uint256 threshold;
    uint256 createdAt;
    uint256 deadline;
    ResponseStatus status;
    ConsensusType consensusType;
    uint256 remainingBudget;
    uint256 perAgentBudget;
}
```

### 3.6 Documented base agents — comparison + Curie fit

| Agent | Testnet `agentId` | Methods | Curie fit |
|---|---|---|---|
| **LLM Inference** | **`12847293847561029384`** (R-OPEN-1 resolved; same on mainnet) | `inferString` (`0xfe7ca098`), `inferNumber` (`0xc6833c3d`), `inferChat` (`0xbee8d139`), `inferToolsChat` (`0xd0683905`) | **Best fit + CHOSEN.** Open LLM completion: prompt + context → structured result. Maps directly to "given policy + evidence packet, decide approve/deny". Returns text rationale that powers R24's `RulingRationale` event. |
| LLM Parse Website | `12875401142070969085` | `ExtractANumber(string,string,uint256,uint256,string,string,bool,uint8,uint8)` (9 params, `0x2623e955`) + `ExtractString` (`0xc2dd1a7a`) | Workable fallback. Phrase as: "given this drug information page <evidenceUrl>, is the drug FDA-indicated for <indication>? Return 1=APPROVE / 0=DENY." Rationale text isn't first-class but the agent returns a structured numeric result; we'd surface a templated rationale instead. |
| JSON API Request | `13174292974160097713` (R-OPEN-2 resolved) | `fetchUint(string,string,uint8)` (`0x3bbc1302`), `fetchString(string,string)` (`0xe003c22e`) | Not a fit. |

**Preferred:** LLM Inference (rationale-first). **Fallback:** LLM Parse
Website with corrected 9-param signature.

### 3.6.1 Two-agent ruling flow + response contract (Amendment 0007)

Adjudication runs as **two sequential agent calls** coordinated by an
`agentPhase` field on the negotiation (`None → Scraping → Deciding → None`).
`requestAdjudication` is `payable` and funds **both** calls up front (scrape fee
+ decide fee); the decide fee is held by the contract and spent when phase 2
fires.

**Phase 1 — scrape (`agentPhase = Scraping`).** `requestAdjudication` fires
**LLM Parse Website** (`agentId 12875401142070969085`, `ExtractString` selector
`0xc2dd1a7a`) against the per-negotiation `agentEvidenceUrl` (R14), extracting
the coverage-relevant indication/policy text. State → `UnderReview`; the scrape
`requestId` is mapped with `phase = Scraping`.

**Phase 2 — decide (`agentPhase = Deciding`).** The scrape `handleResponse`
decodes the extracted evidence string, then fires **LLM Inference**
(`agentId 12847293847561029384`,
`inferString(string,string,bool,string[])` selector `0xfe7ca098`) with:

```
chainOfThought = true                  // enriches the receipt's `reasoning` step (R24)
allowedValues  = ["approve", "deny", "needs_more_info", "policy_invalid"]
prompt         = built from { scraped evidence, agentPromptHint, policy clauses }
system         = necessity-arbiter rubric (evidence-grounded; NOT an ICD-10 lookup)
```

A non-empty `allowedValues` constrains the subcommittee to **exactly one of the
four tokens** (verified against
`https://docs.somnia.network/agents/base-agents/llm-inference`).
`chainOfThought = true` does not change the on-chain `response` (still one
constrained token) — it enriches the **receipt** the UI later reads (R24).
**No PHI** in any string (SPEC-0001 R3/R4).

**Decision decode.** On the decision `Success` response, `handleResponse` decodes
a single string and maps it:

| Returned token | `Decision` | Terminal/route |
|---|---|---|
| `"approve"` | `Approve` | `Approved`, `coveredAmount = min(requested, benchmarkUnitPrice × quantity)` |
| `"deny"` | `Deny` | `Denied`, `coveredAmount = 0` |
| `"needs_more_info"` | `NeedMoreEvidence` | `EvidenceRequested` (retriable) |
| `"policy_invalid"` | `PolicyInvalid` | `PolicyInvalidated` (R6b, narrowed by Amendment 0005) |
| anything else / empty | — | `EvidenceRequested` (defensive — contract does not trust the platform blindly) |

```solidity
string memory tok = abi.decode(responses[0].result, (string));
Decision decision = _tokenToDecision(tok); // unknown → route to EvidenceRequested
```

Either phase returning a non-`Success` status (or `responses.length == 0`)
routes to `EvidenceRequested` and refunds any held decide-phase fee (R9: never
trap caller ETH).

**Why two calls (not the old single-agent 10-tuple):** Medicaid and similar
coverage is evidence-driven, not an ICD-10-code lookup — the model must reason
over the *actual* policy/evidence text, so LLM Parse Website scrapes it first and
LLM Inference decides over it. Neither agent returns prices or rationale in its
result string: the **price cap is a curated benchmark** (§3.6.2) and the **real
reasoning is read from the receipt** (§3.6.3).

### 3.6.3 Receipt-sourced reasoning + on-chain hash commit (Amendment 0007 — R24)

The LLM Inference receipt carries the model's actual chain-of-thought (the
`reasoning` step), retrievable by the decision `requestId` at
`https://receipts.testnet.agents.somnia.host?requestId=<id>`. After the decision
`handleResponse` finalizes the ruling on-chain, an off-chain **keeper** (or the
UI) fetches that receipt and calls:

```solidity
function commitRationale(
    uint256 reqId,
    string  calldata rationale,        // capped at 4096 chars (R26)
    string  calldata clauseReference,
    string  calldata standardReference
) external onlyKeeper;
```

It stores `rationaleHash = keccak256(rationale)` and emits `RulingRationale`.
**It MUST NOT mutate any ruling/escrow/state field** — the decision +
`coveredAmount` + state transition were finalized by the agent callback before
any keeper runs, so the keeper only transcribes already-produced reasoning
(SPEC-0006 **R0-compliant**: it neither computes nor shapes the ruling). Somnia's
receipt (keyed by `requestId`) is the **canonical** record; the on-chain hash is
tamper-evidence for the committed text.

### 3.6.2 Deterministic cap from a curated benchmark (Amendment 0007 — amends SPEC-0001 R6a)

The covered amount stays deterministic and **not AI-chosen**, but the benchmark
unit price is no longer an agent output. `createContract` accepts a
`uint256 benchmarkUnitPrice` (wei), sourced client-side from the curated
`web/src/drugEvidenceMap.ts` / `src/data` price table (same curated map as
R16/R18). Stored on the `Negotiation`. On `Approve`:

```
coveredAmount = benchmarkUnitPrice == 0
    ? requestedAmount                                   // custom drug, no curated price → uncapped
    : _min(requestedAmount, benchmarkUnitPrice * quantity);
```

The agent's former `costPlusUnitPrice` / `nadacUnitPrice` outputs are removed
from the ruling path. NADAC, if shown, is a curated floor reference, not an
agent output.

### 3.7 Per-negotiation evidence URL + prompt hint (R14/R15)

Updated `Negotiation` struct (new fields appended; storage-layout-safe):

```solidity
struct Negotiation {
    // …existing fields…
    bytes32 drugRef;            // opaque RxNorm/NDC hash (unchanged)
    // NEW:
    string  agentEvidenceUrl;   // R14 — public drug info page, required, ≤ 512 chars
    string  agentPromptHint;    // R15 — drug-specific question, required, ≤ 1024 chars
    // …existing fields continue…
}
```

`createContract` signature gains two trailing string params; the
existing `_send` / orchestrator paths are unaffected. `_fireAgent`
reads `n.agentEvidenceUrl` and embeds `n.agentPromptHint` into the
LLM Inference prompt template (or the Parse Website prompt as a
fallback).

### 3.8 Drug → evidence map (R16)

Web-side, in `web/src/drugEvidenceMap.ts`:

```ts
export interface EvidenceEntry {
  readonly drugName: string;        // canonical name, no NDC/RxNorm suffix
  readonly evidenceUrl: string;     // FDA label / DailyMed / MedlinePlus
  readonly promptHint: string;      // drug-specific question for the LLM
  readonly defaultIndication: string;
}

export const DRUG_EVIDENCE_MAP: Readonly<Record<string, EvidenceEntry>> = { … };

export function evidenceForDrug(input: string): EvidenceEntry | null { … }
```

Lookup normalizes by stripping RxNorm `(RxNorm 1366724 / NDC 00074-…)`
trailers and case-folding. The six R18 entries seed the map; users
adding their own drug fall back to the manual-override path.

### 3.9 URL liveness check (R21)

In `web/src/views/Create.tsx`, on `evidenceUrl` blur or on
`create-submit` click:

```ts
async function checkUrlLiveness(url: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const cached = liveness.get(url);
  if (cached && Date.now() - cached.ts < 24 * 3600 * 1000) return cached.result;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    const result = res.ok ? { ok: true as const } : { ok: false as const, reason: `HTTP ${res.status}` };
    liveness.set(url, { ts: Date.now(), result });
    return result;
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
```

CORS caveat: some FDA / DailyMed pages reject `HEAD` cross-origin. Fall
back to `GET` with `Range: bytes=0-0` and on persistent CORS failure,
proxy through a Vite dev-server endpoint (`GET /__probe?url=…`) that
performs the HEAD server-side. The proxy MUST NOT cache or log the URL
beyond the liveness state — it's a CORS workaround, not an analytics
hook.

### 3.10 On-chain rationale event (R24)

Added to `CoverageNegotiation.sol` `events` block:

```solidity
event RulingRationale(
    uint256 indexed reqId,
    uint256 indexed requestId,
    uint8   indexed decision,
    string  rationale,
    string  clauseReference,
    string  standardReference
);
```

Emitted from `handleResponse` after a `Success` response is decoded
and before `_rule(…)` is invoked, conditional on the response carrying
a non-empty `rationale`. The contract truncates per R26 before
emitting.

Storage cost: events don't write to storage; the 4096-char cap times
roughly 1 emit per ruling × ~3-4 rulings per case caps per-case
event-data at ~16 KB. Negligible at Somnia gas rates.

### 3.11 Six-example fixtures (R18) — concrete shape

The full `DRUG_EVIDENCE_MAP` lives in `web/src/drugEvidenceMap.ts`;
each entry pairs with:

- A sample patient note in `web/src/sampleCases/<drug-slug>.ts`
  (synthetic — no PHI).
- A curated policy in `src/data/policies.ts` (extends the existing
  `POLICY_LIBRARY`).
- A named Scenario in `web/tests/agent-browser/run.sh`
  (`scenario_<drug-slug>_approve`, `scenario_<drug-slug>_deny_appeal`).

The spec lists the six in R18's table; implementation owns the
concrete strings and URLs.

### 3.12 Deposit / fee math (canonical)

```text
totalDeposit = platform.getRequestDeposit() + (costPerAgent × subcommitteeSize)
```

| Agent | `costPerAgent` (ether) | Default `subSize` | Reward portion |
|---|---|---|---|
| LLM Parse Website | `0.10 ether` | 3 | `0.30 STT` |
| JSON API Request | `0.03 ether` | 3 | `0.09 STT` |
| **LLM Inference** | `0.10 ether` (safe upper bound; `0.07–0.09` observed on chain) | 3 | `0.21–0.30 STT` |

`platform.getRequestDeposit()` is read at request time; do NOT
hardcode.

### 3.13 Why prior platform-call attempts failed (root-cause)

Three independent bugs combined into one "platform doesn't work"
signal, which led to the (now superseded) Amendment 0006 self-host
pivot:

1. **Wrong platform address** — calldata sent to `0x08D1Fc…`, not
   canonical `0x037Bb9C…`.
2. **Wrong selector / param count** — `ExtractANumber` 8-param vs
   canonical 9-param signature.
3. **Wrong agent type** — LLM Parse Website (URL extraction) used
   where LLM Inference (open judgment) is the right shape.

## 4. Deliverables

1. **This spec** (`docs/specs/0006-somnia-agent-platform-integration.md`).
2. **`docs/specs/0005-usability-and-integration.md`** — flipped to
   `Status: Superseded by SPEC-0006`; body retained for archaeology.
3. **`docs/specs/README.md`** — SPEC-0005 marked superseded, SPEC-0006
   refreshed to "draft (merged 0005)".
4. **`docs/amendments/0007-pivot-to-somnia-agent-platform.md`** (new) —
   ADR-style amendment superseding A-0006.
5. **`contracts/interfaces/IAgentRequester.sol`** (new) — §3.2 verbatim.
6. **`contracts/contracts/CoverageNegotiation.sol`** edits:
   - Replace `_fireAgent` with the canonical `createRequest` call.
   - Rewrite `handleResponse` to the 4-arg shape (§3.3).
   - Mirror `Response` struct + `ResponseStatus` enum (§3.4).
   - Remove `selfHosted`, `setPlatformSelfHosted`,
     `_fireAgentSelfHosted`, `_selfHostedNonce`.
   - Add per-neg `agentEvidenceUrl` + `agentPromptHint` to the
     `Negotiation` struct + `createContract` signature (§3.7).
   - Remove contract-level `agentEvidenceUrl` + `setAgentEvidenceUrl`.
   - Hardcode pinned `agentId` + `costPerAgent` for the chosen agent.
   - Emit `RulingRationale` (§3.10) from `handleResponse`.
   - Add `"platform: ABI drift"` revert (R13).
   - Add `evidence: url required` and `evidence: hint required`
     reverts in `createContract` (R17).
   - Add 4096-char rationale truncation (R26).
7. **`scripts/orchestrator-real.ts` deleted.** Anthropic SDK removed
   from `package.json` if no other consumer remains.
8. **`scripts/check-ruling-abi.ts`** extended per R12.
9. **`web/src/drugEvidenceMap.ts`** (new) — the curated map (R16) with
   the six R18 entries.
10. **`web/src/sampleCases/<drug-slug>.ts`** (six new files) — synthetic
    patient notes per example.
11. **`src/data/policies.ts`** edits — curated policies for each of the
    six examples (R35).
12. **`web/src/views/Create.tsx`** edits — auto-fill via the map,
    manual override fields, URL-liveness check (R21).
13. **`web/src/views/Detail.tsx`** edits — render `RulingRationale`
    card (R25); appeal-affordance gated on `state === Denied` (carry-
    over from D1 in dispute report).
14. **`vite.config.ts`** — `GET /__probe` proxy endpoint for the URL-
    liveness CORS fallback (§3.9).
15. **`src/protocol/revertReasonMap.ts`** — `evidence: url required`,
    `evidence: hint required`, `platform: ABI drift`, plus the
    pre-existing "account does not exist" family (R38).
16. **`web/src/components/WalletBalance.tsx`** + helpers — pre-flight
    balance check covers both signers (R39).
17. **`web/tests/agent-browser/run.sh`** — six `scenario_<drug-slug>_*`
    Scenarios (R19) + per-affordance coverage (R40); `cost-estimator.sh`
    helper covers both wallets (R43).
18. **`.env.example`** updates:
    - DROP `ANTHROPIC_API_KEY` (R10).
    - DROP `AGENT_PLATFORM_ADDRESS` (was orchestrator EOA).
    - ADD `SOMNIA_AGENTS_ADDRESS=0x037Bb9C…`.
    - Refresh `VITE_CONTRACT_ADDRESS` after redeploy.
19. **Contract redeploy** (Tick C-equivalent) with the canonical
    platform address + chosen agent constants baked in.
20. **Dependent spec cascade:**
    - SPEC-0003 §2.10 R49 — restore validator-subcommittee attribution
      (Historical block from tick 141).
    - SPEC-0004 §2.7 R25/R26/R27 — replace Amendment 0006 block with
      Amendment 0007; re-target R27 to the new deploy's `Settled`.
    - SPEC-0004 §3.5 R23 — bad-policy detection moves from the
      now-deleted stub shim into the LLM Inference system prompt + the
      curated `voids:true` clause flag.
    - SPEC-0005 — marked Superseded (this spec).

## 5. Test cases

Each entry states the scenario to cover — what must be verified — not
the test implementation. Synthetic data only. Test IDs trace to R-ids.

### 5.1 Canonical integration (R0–R10)

- **T1 (R0, R0a, R9, R10) — Stubs and orchestrator absent.** `git grep`
  from repo root for `selfHosted | setPlatformSelfHosted |
  _fireAgentSelfHosted | _selfHostedNonce | orchestrator-real.ts |
  DEMO_BAD_POLICY_HASH | ORCHESTRATOR_STUB_DECISION | computeStubRuling`
  returns ZERO matches outside `docs/progress/loop-state-archive.md`
  and `docs/research/`. No active script imports `@anthropic-ai/sdk`
  unless its filename matches `scripts/dev-*.ts` or `scripts/eval-*.ts`.
- **T2 (R1) — Canonical address.** `git grep "0x08D1Fc"` returns ZERO
  active matches; `git grep "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776"`
  appears in `.env`, `contracts/`, `src/`, and the new
  `IAgentRequester.sol` interface.
- **T3 (R2, R3, R8) — Call shapes.** `createRequest` invocation in
  `CoverageNegotiation.sol` matches §3.2 verbatim. `handleResponse`
  signature is exactly 4-arg `(uint256, Response[], ResponseStatus,
  Request)`.
- **T4 (R6, R7) — Response filtering.** Local hardhat mock delivers a
  synthetic `Response[]` with mixed statuses; only `Success=2`
  entries are decoded.
- **T5 (R5) — Deposit math dynamic.** `getRequestDeposit()` is read at
  request time; no hardcoded `0.35 STT` constant remains in the
  contract-execution path.

### 5.2 Agent pinning + drift (R11–R13)

- **T6 (R12) — ABI drift detector PASS.** `npm run check-ruling-abi`
  exits 0 against the chosen agent's current ABI.
- **T7 (R12) — ABI drift detector FAIL.** A test that intentionally
  corrupts the pinned selector asserts the script exits non-zero.
- **T8 (R13) — Platform-upgrade clean revert.** Local hardhat mock
  returns a corrupted result shape; `handleResponse` reverts with
  `"platform: ABI drift"`.

### 5.3 Generalized per-negotiation cases (R14–R17, R20)

- **T9 (R14) — Per-neg URL stored on-chain.** A `createContract` call
  with `agentEvidenceUrl =
  "https://www.fda.gov/media/119435/download"` produces a stored
  `n.agentEvidenceUrl` equal to that string (read back via the
  getter).
- **T10 (R15) — Per-neg prompt hint stored on-chain.** Same test for
  `agentPromptHint`.
- **T11 (R17) — Contract guards empty URL/hint.** `createContract`
  with empty `agentEvidenceUrl` reverts `"evidence: url required"`.
  Same for `agentPromptHint`.
- **T12 (R20) — Custom drug accepted.** Submit with a drug name not in
  `DRUG_EVIDENCE_MAP`; the UI gates submit on manually-entered URL +
  hint; submission succeeds; chain accepts without whitelist.

### 5.4 Six worked examples (R18, R19)

- **T13–T18 (R18, R19) — Per-example Filed→terminal.** One named
  Scenario per drug in R18's table: drives the case through the full
  flow on testnet (or sim, per R47) and asserts the on-chain `Ruled`
  event carries a `coveredAmount` consistent with the example's
  expected outcome. At least 3 of the 6 exercise the dispute-appeal
  path (Deny → Appeal → re-rule → Approve → Settle).

### 5.5 Evidence-URL liveness (R21–R23)

- **T19 (R21) — Live URL passes.** Submitting with a known-200 URL
  succeeds; `create-submit` is enabled within 10 s of URL entry.
- **T20 (R21) — Dead URL blocks submit.** Submitting with a URL that
  returns 404 surfaces the inline error and blocks `create-submit`.
- **T21 (R21) — Timeout blocks submit.** A URL that hangs > 10 s
  surfaces a timeout error.
- **T22 (R22) — Live agent invocation asserted.** Real-mode arbiter
  Scenarios assert both a `RequestCreated` event on `0x037Bb9C…` AND
  the matching `Ruled` event from Curie's contract.
- **T23 (R23) — Nightly link-check.** A CI / cron job re-validates
  every R18 evidence URL; a 4xx/5xx flags the spec-issue tracker
  rather than crashing the user-facing flow.

### 5.6 AI reasoning visibility (R24–R26)

- **T24 (R24) — `RulingRationale` emitted.** A real-mode flow that
  ends in a successful agent response produces both a `Ruled` event
  AND a `RulingRationale` event with matching `requestId` and a
  non-empty `rationale` string.
- **T25 (R25) — UI surfaces the rationale.** After T24, the Detail
  view renders the rationale card (`data-testid="ruling-rationale"`)
  with the full text, clause ref, and standard ref. Appeals stack and
  prior rounds' rationales remain visible labeled "Round N".
- **T26 (R26) — Rationale truncation.** A mock response with a
  4500-char rationale is truncated to 4096 chars with `"…"` sentinel;
  the contract does NOT OOG and the event emits successfully.

### 5.7 UI usability + layout (R27–R30) — carries from SPEC-0005

- **T27–T30** — Same shape as SPEC-0005's T6–T9 (top-bar density,
  insurer single-column, view-switch, screenshots).

### 5.8 N-user registry + custom policy (R31–R37) — carries from SPEC-0005

- **T31–T37** — Same shape as SPEC-0005's T10–T16 (add/remove users,
  pill row, demo toggle, curated library, custom policy, preview).

### 5.9 Error mapping + balance pre-flight (R38, R39)

- **T38 (R38) — "Account does not exist" mapped.** Unfunded-address
  write produces ErrorCard with "Wallet has no funds on Somnia
  testnet" + faucet URL + inlined address + no Retry button.
- **T39 (R39) — Both-wallet pre-flight.** With provider funded and
  insurer at 0 STT, the engage button on the insurer side is
  blocked with the shortfall message; symmetric test for provider
  at 0 STT.

### 5.10 Per-affordance integration coverage (R40–R43) — carries from SPEC-0005

- **T40–T43** — Same shape as SPEC-0005's T19–T22 (per-affordance
  scenarios, both-outcome coverage, real-mode arbiter, cost
  estimator).

### 5.11 Headline gate (R44–R47) — carries from SPEC-0005

- **T44–T47** — T44 covers two R18 examples per run (one Approve, one
  Deny→appeal→Approve); T47 sim-mode parity. Both real- and sim-
  paths reach `Settled` with the provider as recipient.

## 6. Pass / fail criteria

### PASS — all must hold

- [ ] **R0, R0a, R9, R10:** No stubs, no orchestrator, no Anthropic-SDK
  edge into contract execution (T1).
- [ ] **R1:** Canonical address everywhere (T2).
- [ ] **R2, R3, R4, R5, R6, R7, R8:** Call shapes and response decoding
  match §3.2-§3.5 verbatim (T3, T4, T5).
- [ ] **R11, R12, R13:** Chosen agent's ID + ABI pinned; drift detector
  PASS+FAIL both verified; clean revert on upgrade (T6, T7, T8).
- [ ] **R14, R15, R17:** Per-neg URL + hint on-chain; contract guards
  empty values (T9, T10, T11).
- [ ] **R16, R20:** Drug → evidence map in place; manual override path
  works for custom drugs (T12).
- [ ] **R18, R19:** Six examples covered with named Scenarios; at
  least 3 exercise the appeal-dispute path (T13–T18).
- [ ] **R21:** URL liveness check enforces 200/30x within 10 s for
  every submit (T19, T20, T21).
- [ ] **R22:** Real-mode Scenarios assert `RequestCreated` from
  `0x037Bb9C…` alongside the matching `Ruled` event (T22).
- [ ] **R23:** Nightly link-check job runs and reports stale URLs
  (T23).
- [ ] **R24, R25, R26:** `RulingRationale` event emitted, surfaced in
  UI, truncated above 4096 chars (T24, T25, T26).
- [ ] **R27–R30:** Layout invariants verified by screenshot
  (T27-T30).
- [ ] **R31–R34:** N-user registry works; pill row reflects registry;
  demo toggle persists (T31-T34).
- [ ] **R35–R37:** ≥ 6 curated policies plus custom-policy path;
  preview before submit (T35-T37).
- [ ] **R38, R39:** Revert family mapped; pre-flight check covers
  both signers (T38, T39).
- [ ] **R40–R43:** Per-affordance Scenarios; both-outcome coverage;
  real-mode arbiter assertions; cost estimator for both wallets
  (T40-T43).
- [ ] **R44–R47:** Headline gate green with two R18 examples per run;
  both wallets funded; receipts captured; sim parity (T44-T47).
- [ ] **R48:** `RealBackend.getEvents` queries logs in `LOG_PAGE_SIZE
  = 1000` paged chunks; a single `eth_getLogs({fromBlock:0,
  toBlock:latest})` never appears in the codepath.
- [ ] **R49:** `VITE_DEPLOYMENT_BLOCK` plumbing forwards through
  `RealBackendOptions.deploymentBlock`; default lookback is
  `latest - 10_000` blocks when unset.
- [ ] **R50:** Vite dev-server exposes `GET /__log/tx`; web client
  invokes `hydrateTxLogFromSink()` on mount; TxMonitor totals
  hydrate cross-reload.
- [ ] **R51:** Page reload after each R55 flow hydrates Dashboard
  row, Detail Timeline, Network tab, and Tx Monitor surfaces
  against a non-trivial event history.
- [ ] **R52:** Demo runbook documents the pre-demo dev-server kill
  step (no stale Vite servers on default ports).
- [ ] **R53:** With `VITE_PRIVATE_KEY_INSURER` unset, Create form is
  blocked with a surfaced setup-required error; no silent
  fallback to provider address; no `addr: zero` revert from the
  contract.
- [ ] **R54:** Demo runbook documents the provider → insurer top-up
  size, the per-actor cost matrix, the post-flow balance audit,
  and a reproducer that prints both balances pre-demo.
- [ ] **R55:** Three named flow Scenarios (`flow-approve-settle`,
  `flow-dispute-appeal-settle`,
  `flow-bad-policy-policy-invalidated`) each drive end-to-end on
  testnet and reach their documented terminal state with the
  exact emitted-event pattern. The bad-policy flow's
  `PolicyInvalid` ruling originates from the platform agent per
  R0/R0a — no stub.
- [ ] **R56:** Network tab hydrates from BOTH paged-`getLogs` and
  the dev-server JSONL sink, deduped by `txHash`. A reload against
  a contract with prior events renders the full visible history,
  not session-only data.
- [ ] **R57:** Network tab transactions sort by descending block
  number (secondary: descending tx index within block). Most
  recent at the top.
- [ ] **R58:** Overview rows sort by descending most-recent-event
  block number; ties break by descending `reqId`; new events
  reorder rows within one render cycle without reload.

### FAIL — any triggers rejection

- **R0 / R0a violation:** Any code path produces a value the contract
  reads or acts on (a ruling, settlement amount, decision enum) that
  was generated by, derived from, or shaped by an off-chain Claude
  call, orchestrator script, deterministic stub, hardcoded-hash
  shortcut, or self-hosted LLM rather than a Somnia validator
  subcommittee. Hybrid "off-chain compute → trusted EOA submits"
  patterns count as violations.
- Any commit retains `0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A`
  outside archive paths.
- `handleResponse` retains the old 1-arg shape anywhere.
- `selfHosted` / `setPlatformSelfHosted` / `_fireAgentSelfHosted` /
  `_selfHostedNonce` / `orchestrator-real.ts` / `DEMO_BAD_POLICY_HASH`
  / `ORCHESTRATOR_STUB_DECISION` / `computeStubRuling` remain
  referenced in active source.
- An active (non-`dev-*` / non-`eval-*`) script imports
  `@anthropic-ai/sdk`.
- ABI drift detector silently passes when on-chain ABI doesn't
  match the pinned shape.
- A `createContract` call with empty `agentEvidenceUrl` or
  `agentPromptHint` succeeds.
- The UI's `create-submit` is enabled with an unreachable evidence
  URL (R21 violation).
- A real-mode integration Scenario claims success without an
  accompanying `RequestCreated` event from `0x037Bb9C…`.
- `RulingRationale` is not emitted for a successful agent response,
  OR the UI does not render it.
- The pre-flight balance check ignores the insurer wallet (the
  exact bug Issue D4 in the 2026-06-01 report flagged).
- Any of R18's six examples lacks a Scenario, or fewer than 3
  examples exercise the appeal-dispute path.
- A layout screenshot is absent for any tick that closes R27, R28,
  or R29.
- A new state-mutating affordance ships without a corresponding
  Scenario (R40 violation).
- The headline integration test reports green when on-chain state
  ≠ 6 or settlement recipient ≠ providerAddr.

## 7. Out of scope

- **Mainnet deployment.** Testnet only for v0; mainnet is a follow-on
  spec once testnet is proven and a mainnet wallet is funded.
- **Custom agents.** Curie does NOT register its own Somnia agent in
  v0; uses base agents only.
- **`createAdvancedRequest`.** Subcommittee-size / threshold /
  consensus-type customization is documented but not used in v0.
- **Sim-mode removal.** Sim mode stays as the offline E2E path (R47).
- **More than six worked examples.** The map is extensible; v0 ships
  six. Adding entry #7+ in a later spec is fine.
- **Validator-side concerns.** Model choice, prompt templating, and
  output validation inside the Somnia validator subcommittee are
  Somnia's responsibility.
- **Agent-output-quality criteria.** This spec covers correct
  integration (calldata → response shape → emitted rationale); it
  doesn't require any specific judgment quality. Prompt-design spec
  follows.
- **Real-time policy revision in PolicyInvalidated state.** Issue D3
  from the 2026-06-01 report flagged the absence of a "file new
  request with corrected policy" CTA. That UX is a follow-on; this
  spec just ensures the terminal state is reached correctly.

## 8. Open questions

- **R-OPEN-1 — RESOLVED (2026-06-03).** The numeric on-chain `agentId`
  for **LLM Inference** is **`12847293847561029384`** on BOTH Somnia
  testnet (chain 50312) and mainnet (chain 5031 — Somnia uses consistent
  agent IDs across networks). Resolved via path (a): `scripts/identify-inference-agent.ts`
  scanned `RequestCreated` logs on `0x037Bb9C…` and matched the
  `inferString` selector `0xfe7ca098` (48 calls), `inferChat`
  `0xbee8d139`, and `inferNumber` `0xc6833c3d` against that agentId.
  Recorded in the `somnia-agent` skill §3.1. **R11 unblocked.**
- **R-OPEN-2 — RESOLVED (2026-06-03).** LLM Inference's registered ABI
  on `0x037Bb9C…`: `inferString(string,string,bool,string[])`
  (selector `0xfe7ca098`), `inferNumber(string,string,int256,int256,bool)`
  (`0xc6833c3d`), `inferChat(string[],string[],bool)` (`0xbee8d139`),
  `inferToolsChat(...)` (`0xd0683905`). Curie uses `inferString` with a
  non-empty `allowedValues` to constrain the decision. Selectors verified
  on-chain by the discovery script; pinned in `somnia-agent` §3.1.
  **R12 can now pin a real selector.**
- **R-OPEN-3 — RESOLVED (2026-06-03).** `platform.getRequestDeposit()`
  on canonical testnet `0x037Bb9C…` reads **`0.03 STT`**
  (`0x6a94d74f430000` wei) as of the 2026-06-02 redeploy session. The
  spec still mandates a dynamic read at request time (R5) — this value is
  informational and MUST NOT be hardcoded.
- **R-OPEN-4 — RESOLVED (2026-06-03).** `inferString` returns a **single
  `string`** (`abi.decode(responses[i].result, (string))`); `inferChat`
  likewise returns one `string`; `inferNumber` returns one `int256`.
  There is no tuple. `handleResponse` decodes `responses[0].result` as a
  single string and parses Curie's structured ruling out of that text
  (decision token via the constrained `allowedValues`, plus a rationale
  body for the `RulingRationale` event). Source: `somnia-agent` skill
  §3.1 method table.
- **R-OPEN-5 (MED — affects R21):** Will the FDA / DailyMed pages
  consistently allow `HEAD` requests cross-origin from a browser?
  If not (typical), R21 falls back to the Vite `__probe` proxy in
  dev and to a serverless function in any future deployed build.
- **R-OPEN-6 (LOW):** Should the `RulingRationale` event also be
  emitted in sim mode? Recommendation: yes — sim's "ruling" is a
  user-picked Decision enum, but the UI affordance for surfacing
  rationale is the same; sim emits a templated rationale.
- **R-OPEN-7 — RESOLVED:** Anthropic SDK retention. **Decision:
  retain ONLY in `scripts/dev-*.ts` / `scripts/eval-*.ts` files;
  remove from any code reachable from the contract or
  integration-test path; CI lints the import edge.**
- **R-OPEN-8 — RESOLVED (2026-06-03, Amendment 0007):** The LLM's
  *actual* reasoning is sourced from the **Somnia receipt** (`reasoning`
  step, `chainOfThought = true`), retrieved by `requestId` and committed
  on-chain via `commitRationale` (§3.6.3) — no second inference call and
  no templated summary. Canonical record = Somnia receipt; on-chain hash
  = tamper-evidence.
- **R-OPEN-9 (opened by Amendment 0008 — escrow safety):** Final
  pull-vs-push decision for escrow release/refund in `settle` and the
  terminal-non-settle transitions. Pull (per-address `owed` +
  `withdraw()`) is preferred for reentrancy safety; push (`call` +
  `nonReentrant`) is the single-tx-settlement fallback. The
  security-auditor gate decides before any funded run.

---

**Provenance.** Original research (2026-05-30) by direct
`eth_getCode` probes against Somnia testnet (chain 50312 verified via
`eth_chainId == 0xc488`) and WebFetch crawls of
`https://docs.somnia.network/agents/{quickstart,from-solidity,base-agents/{llm-inference,llm-parse-website},receipts}`.
2026-06-01 revision merges SPEC-0005 and adds R0a / R14–R26 in
response to the user direction captured in the dispute / bad-policy
verification session.
