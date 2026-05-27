# SPEC-0001 Implementation Progress

Companion log for implementing
[`../specs/0001-mvp0-coverage-negotiation.md`](../specs/0001-mvp0-coverage-negotiation.md)
on branch `spec1-implementation-v1`. Append successes and failures as work proceeds.

## Build order

1. **Contract + Hardhat tests** (`contracts/`) — the foundation; the UI/tests depend on its ABI. ← in progress
2. **Wallet abstraction** (`src/wallet/`) — simulated ↔ real signer.
3. **Off-chain content store + types** (`src/`).
4. **Web app** — Overview / Create / Maintain views, profile switcher, wallet/identity/mode.
5. **agent-browser tests** — coarse-grained AAA over website functionality.
6. **Deploy script + README wiring**; real-wallet path (blocked until a funded wallet exists).

Conventions: commit + push after each major feature (no noisy micro-commits); check Somnia
behavior via Context7 (`/websites/somnia_network`); keep all doc writing inside this repo.

---

## Log

### 2026-05-26 — Iteration 1: kickoff + contract

- **Started** the 15-minute implementation loop (cron `363acc12`).
- **Decision:** build `CoverageNegotiation.sol` + Hardhat tests first; abstract the Somnia
  agent platform behind an `IAgentPlatform` interface so the dispute→ruling flow is
  unit-testable with a `MockAgentPlatform` (the real native-agent call needs testnet + a
  funded wallet, which we don't have yet).
- **Decision:** parallelize via subagents in later iterations (UI components, agent-browser
  tests); iteration 1 keeps the contract + tests as one coherent unit for correctness.
- **DONE — contract + Hardhat tests (focus #1).**
  - `contracts/CoverageNegotiation.sol` implements the full SPEC-0001 §3 state machine (Open→Ready→UnderReview→{Approved|Denied|EvidenceRequested}→Appealed→Settled/Withdrawn), positions-then-ready gating (R5), dispute-fires-native-agent (R6/R9), event-only settlement bounded by the band (R8), self-contract (R13), and the no-PHI invariant (only hashes/refs/amounts/state — R3/R4).
  - `contracts/ISomniaAgent.sol` mirrors the real Somnia agent ABI (`IAgentRequester`/`IAgentRequesterHandler`, `Response`/`Request`/`ResponseStatus`), confirmed against Context7.
  - **Design note:** SPEC §3 names the callback `handleRuling`, but the live platform calls the fixed `handleResponse(requestId, responses, status, details)`. We implement the **real** signature (so it works against testnet), decode the `approve|deny|need_more_evidence` verdict + receipt from `responses[0]`, and surface them via the `Ruled` event — preserving the spec's intent. The selector passed to `createRequest` is `handleResponse.selector`.
  - `MockAgentPlatform.sol` drives the dispute→ruling flow locally (records `createRequest`, triggers success/failure callbacks).
  - **Tests: 6 passing** (T1–T6), coarse-grained AAA, covering create/store-only-hashes, positions→Ready + dispute-before-Ready revert, dispute fires agent, verdict routing + failure/timeout→retriable + evidence/appeal re-fire, settle-in-band + out-of-band revert, guard reverts + non-platform-caller rejection + withdraw.
  - **Fix this iteration:** `MockAgentPlatform.sol` had been placed under `test/mocks/` (outside Hardhat's `contracts/` sources dir) so its artifact wasn't generated → moved to `contracts/contracts/mocks/` and fixed its import. Compile + all tests now green.
  - **Blocked on real wallet:** deploying to Somnia testnet and exercising a *real* native-agent ruling (R9 fee-on-execution) needs a funded key — deferred per loop instructions.

- **DONE — TypeScript library layer (focus toward #2).** Framework-agnostic `src/` the UI consumes, built by a developer subagent against the finalized contract ABI:
  - `src/types/coverage.types.ts` (State enum mirror, Negotiation/Position, Verdict union, event/view types).
  - `src/wallet/` — `Wallet` interface + `SimulatedWallet` (no funds) and `RealWallet` (ethers signer); `createWallet` factory selects mode from `SOMNIA_WALLET_MODE` (default simulated).
  - `src/profiles/` — single wallet, multiple profiles, switching, self-contract (R12/R13).
  - `src/content/` — off-chain content store + keccak256 hashing + both-party verification (PHI stays off-chain — R3/R4).
  - `src/contract/` — one `CoverageNegotiationClient` interface with two backends: `SimulatedBackend` (in-memory state machine mirroring the contract exactly + mocked agent ruling, so the whole app runs with no chain/wallet) and `RealBackend` (ethers v6 vs the deployed contract + event subscription). `createClient(config)` wires it all by mode.
  - Added `ethers ^6.16.0`; **`npm run typecheck` passes clean** (strict/NodeNext). Same code path runs in both modes (R11) — this is what lets us go end-to-end without a funded wallet.
  - Note: `src/index.ts` smoke-test replaced by the library public API; `src/somnia/kit.ts` left intact but unused.

- **DONE — web app (focus #2).** A **Vite + React + TypeScript** SPA under `web/`, built by a subagent and reviewed/verified here, consuming the library's `createClient` in **simulated mode** (no chain/funds):
  - **Three views (R15):** `Overview` (live table of all contracts, state badges, band, links), `Create` (note → off-chain `ContentStore.put` → commit ONLY the keccak256 hash as `noteHash`; drug name hashed to an opaque `bytes32` drugRef; band + parties), `Detail/Maintain` (timeline rebuilt from the live event log, facts, both positions, agreed amount, agent verdict/receipt).
  - **Action gating mirrors the contract lifecycle** (R14): submitPosition (Open, own side, unsubmitted), dispute (Ready only), submitEvidence (EvidenceRequested), appeal (Denied), settle (Approved, validated within band client-side too), withdraw (any pre-terminal), feedback (any active state). Buttons that would revert are hidden/disabled.
  - **Header (R12/R13):** truncated wallet address + **wallet-mode** badge + **profile switcher** (provider↔payer over the one shared simulated wallet); active party id shown. Switching identities lets the single wallet act as both parties; self-contract supported.
  - **Live status (R16):** one app-level `subscribe` accumulates every `CoverageEvent`; views derive per-`reqId` timelines and re-render on each event.
  - **R4 boundary made visible in the UI:** note/feedback/evidence text never leave the browser — only their hashes cross into contract calls; the Create view displays the committed note hash with an explicit "stays off-chain" note.
  - **Simulated-agent verdict control:** the mocked agent reads a module-level `nextVerdict` via a `verdict` function (keeps the shared `CoverageNegotiationClient` interface intact); a `verdict-select` (simulated-mode only) sets it before a dispute, so `approve|deny|need_more_evidence` rulings can all be demonstrated. `autoResolveMs: 1200` makes the `UnderReview → Ruled` transition visible.
  - **Testability:** stable `data-testid` hooks on every interactive element (nav, profile-switcher, wallet-address/mode, create-*, position-*, dispute-submit, verdict-select, feedback-*, settle-*, contract-row[data-reqid], state-badge, timeline, committed-hash); `window.__curie` exposed (simulated only) for agent-browser.
  - **Wiring:** root `vite.config.ts` (`root: 'web'`, `@lib` alias → built `dist/index.js`, `define: { 'process.env': '{}' }`); own `web/tsconfig.json`. Added react/react-dom + vite devtooling; scripts `web:dev` / `web:build` / `web:preview`. The lib consumes `dist/`, so **`npm run build` must run before the web app** (documented).
  - **Verified:** `npm run build` (lib tsc) ✓, `cd web && npx tsc --noEmit` ✓, `npm run web:build` ✓ (one >500kB chunk = bundled ethers; acceptable for v0), `web:preview` serves over HTTP ✓.

- **DONE — agent-browser E2E tests (focus #3).** `web/tests/agent-browser/run.sh` + README, wired as `npm run test:e2e`. Drives the **real** UI in a real browser via [agent-browser](https://github.com/vercel-labs/agent-browser) and asserts on both the rendered DOM and the authoritative on-chain mirror (`window.__curie`). **4 coarse AAA scenarios, 16 assertions, all green:**
  - **A — happy path (R14/R15/R5/R6/R8/R16, T8/T5):** create (note→hash only) → provider position → switch profile → payer position → `Ready` (UI badge tracks on-chain) → select verdict → dispute fires agent → auto-resolve → `Approved` → settle 3000 within band → `Settled`.
  - **B — no PHI on-chain (R3/R4 hard invariant, T1):** committed `noteHash` verifies against the off-chain note; a unique sentinel in the note is absent from the serialized on-chain record **and** from the DOM.
  - **C — dispute gating (R5/T3):** `submitDispute` before `Ready` reverts.
  - **D — profiles/wallet (R12/R13/T9):** profile switch changes active party id (2↔1); one shared wallet address across switches; simulated mode shown.
  - The runner self-serves (builds lib+web, `web:preview`, waits, tears down via trap) or tests an already-served `URL` (`SKIP_SERVE=1`); exits non-zero on failure (CI-ready).
  - **Environment notes (captured for reproduction):** agent-browser installed to a user npm prefix (`/usr` is read-only here); Linux **ARM64** has no Chrome-for-Testing build, so Chromium comes from `npx playwright install chromium` and is passed via `CHROME_PATH`; `--no-sandbox` is added automatically for the container.

- **DONE — demo fixtures + sample case (§4 deliverable / §6 PASS criterion).** Under `demo-data/`:
  - `sample-case.md` — a **synthetic** (no-PHI) coverage-exception case: a de-identified adalimumab/psoriasis note, drug, benchmark band `[2800, 5200]`, and the positions/settlement that walk every path. Copy-pasteable into Create.
  - `formulary-part-d.json` (JSON/REST source → `JSON API Request`) and `formulary-part-d.html` (HTML source → `LLM Parse Website`) — the published-Part-D-formulary-shaped public reference the native agent rules against (R10), each carrying coverage criteria, the benchmark band, and the `approve|deny|need_more_evidence` ruling guidance. `README.md` explains how each maps to an agent source type.
  - **Wired into the UI:** a **Load sample case** button (`data-testid="load-sample"`) in Create prefills note/drug/band from `web/src/sampleCase.ts` (mirrors the markdown). **E2E Scenario E** (now **22 assertions, all green**) loads the sample case and asserts the band reaches the on-chain record — so the fixture demonstrably drives the flow.

- **DONE — contract security pass + Somnia re-verify + deploy/README wiring (toward "secure and complete / fully leverages Somnia").**
  - **Somnia interface re-verified** against the official docs (`agents/invoking-agents/from-solidity`; Context7 MCP wasn't connected this session, so the live docs were the source): `createRequest(uint256,address,bytes4,bytes) payable returns(uint256)`, the `handleResponse(uint256,Response[],ResponseStatus,Request)` callback ("name is free, param types must match" — our `handleResponse.selector` is valid), `getRequestDeposit()`, the `ResponseStatus` enum (None=0…TimedOut=4), and the `Response`/`Request` structs all match `ISomniaAgent.sol` **field-for-field**. No drift.
  - **Hardening to `CoverageNegotiation.sol`:** (1) `ReentrancyGuard` + `nonReentrant` on the agent-firing entry points (`submitDispute`/`submitEvidence`/`appeal`) and `withdrawFunds`; `_fireAgent` reordered to **checks-effects-interactions** (state → `UnderReview` *before* the external `createRequest`). (2) `withdraw` now `_clearRequest`s any in-flight request so a late platform callback can't mutate a withdrawn negotiation and stale request ids can't collide. (3) owner `withdrawFunds(to, amount)` (+ `FundsWithdrawn`) reclaims the agent-fee float / timeout refunds (the contract holds no user deposits — settlement is an event marker). (4) NatSpec documents the deliberate **v0 trust model**: identities are app-level `uint256` party ids, not `msg.sender` (single-shared-wallet R12/R13 means caller-binding can't distinguish parties; KYC is §7-out-of-scope); the one strictly-gated call is the platform callback.
  - **New test T7** (now **7 passing**): proves CEI (the mock reads `stateOf` mid-`createRequest` and sees `UnderReview`), withdraw-clears-request (a late ruling reverts `callback: unknown request`, no mutation), and `withdrawFunds` owner-gating + balance bound. Existing T1–T6 unchanged & green.
  - **Deploy + real-wallet wiring:** `.env.example` now documents `SOMNIA_WALLET_MODE`, `COVERAGE_CONTRACT_ADDRESS` (where the deployed address goes — read by `RealBackend`), and the deploy-time `AGENT_PLATFORM_ADDRESS`/`AGENT_ID`/`AGENT_REWARD`. README rewritten to cover the contract, the simulated↔real modes, the deploy commands (`npm --prefix contracts run compile|test|deploy:somnia`), the web app + `test:e2e`, an accurate layout, and a placeholder for the deployed testnet address (pending a funded wallet).

- **DONE — real-backend integration on a local node (T7/R11/R16, the "both modes" PASS criterion minus testnet).** `scripts/real-backend-localnode.{mjs,sh}`, wired as `npm run test:real-local`. Starts a throwaway `hardhat node`, deploys `MockAgentPlatform` + `CoverageNegotiation` to it, and drives the library's **real** code path (`RealBackend` — ethers vs the *deployed* contract + live event subscription) end-to-end. **10 checks, all green:**
  - full lifecycle through `RealBackend`: createContract→Open, positions→Ready (R5), submitDispute fires the agent→UnderReview (R6/R9, contract funded via `agentFeeValue`), platform callback (`mock.triggerRuling`)→Approved, settle-in-band→Settled with the agreed amount recorded.
  - R4 spot-check: the on-chain record carries the note **hash**, not content.
  - R16: the live `subscribe()` delivered the full timeline (ContractCreated…Ruled…Settled) and the `Ruled` event carried `verdict="approve"` + receipt `123`.
  - **R11/T7 headline:** simulated and real backends produce the **identical** state sequence `Open → Open → Ready → UnderReview → Approved → Settled` — proving one code path across modes.
  - This closes everything in T7 except a *genuine* Somnia native-agent execution, which is the only remaining wallet-blocked item (the mock platform stands in for the callback locally).

- **DONE — `eth_getLogs` timeline reconstruction (the second half of T10/R16).** Added `getEvents(filter?)` to the `CoverageNegotiationClient` interface and both backends:
  - **RealBackend:** reconstructs history via `contract.queryFilter` (`eth_getLogs`) over every event, narrowable by the indexed `reqId` topic, returned in chronological order (sorted by block then log index) with block/tx metadata. Refactored the per-event decoders into one shared `buildEvent` used by **both** `getEvents` and the live `subscribe` (and fixed the subscribe payload handling to read `ContractEventPayload.log`).
  - **SimulatedBackend:** records an in-memory event log on every `emit`; `getEvents` returns it (optionally filtered by `reqId`) — the simulated equivalent of `eth_getLogs`.
  - **Web app:** the App now **backfills the timeline from `getEvents` on mount** (prepended, chronological) and keeps it live via `subscribe`, deduping real-backend events by tx hash so the backfill/live boundary isn't double-counted. So a real-mode page load shows pre-existing contracts' full history, not just events seen since mount.
  - **Validation (local-node integration test, now 14 checks):** a **fresh** `RealBackend` with no live subscription reconstructs the exact timeline `[ContractCreated, PositionSubmitted×2, ContractReady, DisputeSubmitted, RulingRequested, Ruled, Settled]` purely from logs — chronological, with block metadata, and the reconstructed `Ruled` carries verdict + receipt (core T10 proof). The simulated `getEvents` returns the same recorded timeline. Library typecheck clean; web typecheck/build clean; agent-browser suite still 22/22.

- **DONE — both-party note-verification on the website (R3 / §4 deliverable).** The Detail view now has a "Verify your note copy" affordance: a party pastes their off-chain note and the UI confirms (locally, via `verifyContent`) that it hashes to the on-chain `noteHash` — the note never leaves the browser. agent-browser **Scenario F** (suite now **24 assertions**) asserts a matching copy verifies and a tampered copy is rejected. This closes the last website-side deliverable; the library already provided the mechanism.

- **DONE — off-chain party actors + orchestrator (§4 deliverable: `src/agents/*`, `src/orchestrator.ts`).** The last unbuilt §4 files. These are the **party** actors (provider/payer), distinct from the contract-native AI ruling:
  - `src/agents/party-agent.ts` — a `PartyAgent` bound to one identity: `openContract` (note → off-chain hash), `proposePosition`, `dispute`, `appeal`, `submitEvidence`, `settle`, `postFeedback` (all text hashed off-chain — R4). `provider-agent.ts` / `payer-agent.ts` bind it to the provider/payer profiles.
  - `src/orchestrator.ts` — `runNegotiation(negotiation, provider, payer, script)` drives the whole loop (open → both positions → dispute → await ruling → settle on approve), subscribing for a transcript. Same script runs in either wallet mode (R11); it just waits for the contract to leave `UnderReview`.
  - Exported from the public API; **`npm run demo:orchestrator`** (`scripts/orchestrator-demo.mjs`, wallet-free, simulated) validates **7 checks**: approve→Settled with full timeline, provider/payer are distinct parties (R13), deny→Denied (no settle), need_more_evidence→EvidenceRequested, and a payer-initiated dispute→Settled. Library build/typecheck clean.

### Status vs SPEC-0001 pass/fail (§6) — ORIGINAL price-band model (superseded 2026-05-27)
- ✅ Contract compiles + passes Hardhat tests (T1–T6). ✅ Library one-interface/two-mode (R11). ✅ Web app: all required views/actions (R14/R15) + profile switch + wallet/mode display (R12/R13). ✅ no-PHI invariant enforced + asserted (R4). ✅ positions-before-dispute (R5) + dispute fires agent (R6) + settle-within-band (R8). ✅ E2E suite (T8/T9 + T1/T3/T5 at the UI boundary).
- ⛔ **Remaining, blocked on a funded wallet only:** deploy `CoverageNegotiation.sol` to Somnia testnet (chain 50312); the real-wallet half of T7 (R11) and one **real** native-agent ruling with a viewable receipt + per-request fee on execution (R9); T10 (`eth_getLogs` timeline reconstruction over real RPC). These are the "stop only when you can go no further without a real wallet" boundary.

---

### 2026-05-27 — Iteration 2: REGENERATE to the AI necessity-arbiter spec (A-0003)

SPEC-0001 was revised twice and now describes an **AI necessity-arbiter** (not a price-setter).
Per the repo "regenerate, don't migrate" rule, the contract, the `src/` library, and (next) the
web UI are being rebuilt to the new model — the old approve/deny **price band** and the interim
**price-arbiter** model are removed wholesale.

**What the new model is (vs. what was removed):**
- *Removed:* price band `[floor, ceil]`, two-party `submitPosition` → `Ready`, `submitDispute`,
  `agreedAmount` chosen at settlement within the band, `initiator`/`destination` neutrality, the
  `Verdict` string vocabulary, no-address-gating trust model.
- *Added:* insurer **attaches a policy** (`insurerEngage`, hash on-chain) **before** adjudication
  (R5); the agent rules **necessity** `approve|deny|need_more_evidence` **citing a clause**, or
  **voids** the contract when a relied-on clause contradicts a public standard →
  `PolicyInvalidated` + `PolicyFlagged` (R6b); covered amount is **deterministic**
  `min(requested, benchmarkCap)` computed by the CONTRACT, never AI-chosen (R6a); appeals submit
  **new public evidence** and are **bounded to N rounds** → `Deadlocked` (R6c); per-party
  `accept` flags then `settle` (event marker + 50/50 fee split, R8); `ProviderRefused` terminal
  (R7); **wallet-address gating** on every party action — third wallet reverts, `insurerEngage`
  insurer-only, `submitEvidence`/`refuse` provider-only, reads public (R11).

**DONE — contract + Hardhat tests + library (focus #1 + #2 backend), regenerated.**
- `contracts/CoverageNegotiation.sol` rewritten: 11-state machine (`Open · Ready · UnderReview ·
  EvidenceRequested · Approved · Denied · Settled · Deadlocked · PolicyInvalidated ·
  ProviderRefused · Withdrawn`), `Decision` enum (`Approve|Deny|NeedMoreEvidence|PolicyInvalid`),
  `createContract`(provider-only)/`insurerEngage`(insurer-only, R5)/`requestAdjudication`(payable,
  Ready-only)/`handleResponse`(platform-only; decodes `(decision, benchmarkCap, rationaleHash,
  clauseRef, standardRef, receiptId)` and computes `coveredAmount = min(requested, cap)` —
  R6a)/`submitEvidence`(provider, round++)/`appeal`(party, new evidence required, round-bounded →
  `Deadlocked`)/`accept`+`settle`(both-accept → marker + 50/50 fee)/`refuse`(provider →
  `ProviderRefused`)/`withdraw`/`onRulingTimeout`/`postFeedback`. Views: `getNegotiation`,
  `stateOf`, `coveredAmountOf`, `roundOf`, `policyOf`, `count`, `maxRounds`. CEI + `nonReentrant`
  on agent-firing entry points retained. **Somnia interface re-verified** against the live docs
  (`agents/invoking-agents/from-solidity`) — `createRequest`/`getRequestDeposit`/`handleResponse`
  signatures + `Response`/`Request`/`ResponseStatus` unchanged; we keep `handleResponse.selector`.
  (Context7 MCP was not connected this session; used the official docs as the source.)
- `MockAgentPlatform.sol` `triggerRuling` now encodes the arbiter tuple `(uint8 decision,
  benchmarkCap, rationaleHash, clauseRef, standardRef, receiptId)`.
- **Hardhat tests: 10 passing**, coarse AAA, T1–T10 + a security block — incl. T4 deterministic
  `min(requested, cap)` both directions, T5 `policy_invalid` → `PolicyInvalidated`, T6 bounded
  appeals → `Deadlocked` + empty-evidence appeal reverts, T7 `ProviderRefused`, T8 settle + 50/50
  marker, **T9 third-wallet-reverts on every party action + reads-open + single-wallet via
  `partyId`** (R11/R12/R13), T10 guards + non-platform `handleResponse` revert.
- `src/` library regenerated: `coverage.types.ts` (new `State`/`Decision` enums, `Negotiation`
  struct mirror, new event union), `contract/abi.ts`, `contract/types.ts` (new
  `CoverageNegotiationClient`), `contract/simulated.ts` (in-memory mirror + **mocked arbiter**
  configurable by `decision`/`benchmarkCap`/refs; deterministic `min`), `contract/real.ts` (ethers
  v6, 25-field tuple decode, new events, payable adjudication), `agents/*` (PartyAgent: file /
  engage / adjudicate / submitEvidence / appeal / accept / settle / refuse; provider + **insurer**
  factories), `orchestrator.ts` (file→engage→adjudicate→accept→settle, scripted deny / NME /
  policy_invalid / appeal→deadlock), `profiles.ts` (provider + insurer defaults). All free text
  (justification, policy body, evidence, appeal reason, feedback) is hashed into the off-chain
  `ContentStore` — only hashes/refs cross into contract calls (R3/R4).
- **Verified green:** `npm --prefix contracts run test` (10/10), `npm run build` + `npm run
  typecheck` clean, `node scripts/orchestrator-demo.mjs` (12 checks: approve→Settled, deny→Denied,
  NME→EvidenceRequested→submitEvidence→approve→Settled, policy_invalid→PolicyInvalidated,
  appeal→Deadlocked), and `scripts/real-backend-localnode.sh` (16 checks: RealBackend
  Open→Ready→UnderReview→Approved→Settled on a local node, deterministic covered amount, live
  subscription + `getEvents` reconstruction, simulated/real state-sequence parity).
**DONE — web UI + demo fixtures regenerated (focus #2 frontend + §4 fixtures).**
- `web/src/` rewritten to the necessity-arbiter flow: **Create** (provider files: justification →
  off-chain hash, drug → opaque RxNorm/NDC ref, public-evidence ref, **requested amount**),
  **Detail** (insurer **attach-policy + engage**; **request adjudication** with a simulated-mode
  decision selector + **benchmark-cap** input demonstrating deterministic `min(requested, cap)`;
  a **Ruling** panel showing decision + covered amount + **cited clause** + rationale + round +
  the **PolicyFlagged** standard on a void; **accept / appeal-with-new-evidence / submit-evidence
  / refuse / settle / withdraw / feedback**, each gated by state + the active profile's role;
  R3 justification-copy verification), **Overview** (reqId / drugRef / state / policy-attached /
  requested / covered / round). Header keeps wallet + mode + provider↔insurer profile switcher;
  timeline backfills via `getEvents` then stays live via `subscribe` (R16). Free text never
  leaves the browser — only hashes/refs cross (R4).
- All three terminal demo paths are reachable from the UI: **PolicyInvalidated** (engage the
  NON-compliant policy fixture + pick `policy_invalid`), **Deadlocked** (appeal past the round
  cap), **ProviderRefused** (provider "Refuse terms" from `Ready` onward).
- `demo-data/` regenerated: `sample-case.md` (drug RxNorm/NDC + justification + openFDA evidence
  + requested amount + benchmark cap), compliant Part D policy as `formulary-part-d.{json,html}`
  (R10 source types), NEW `policy-noncompliant.md` (clause that contradicts the openFDA label →
  drives `PolicyInvalidated`, R6b), NEW `price-benchmarks.md` (NADAC + Mark Cuban Cost Plus cap
  inputs backing the deterministic `min`, R10), README updated.
- **Verified green:** `npm run build` (lib), `cd web && npx tsc --noEmit`, `npm run web:build`.
  The agent-browser e2e (`test:e2e`) testids/flow were updated best-effort but NOT executed
  (needs a browser runtime; deferred).

### Status vs SPEC-0001 pass/fail (§6) — necessity-arbiter model (current)
- ✅ Contract compiles + passes Hardhat tests (T1–T10 + security). ✅ Insurer must attach policy
  before adjudication (R5); agent rules necessity with a cited clause (R6); covered amount is
  deterministic `min(requested, cap)` (R6a); a non-compliant clause **voids** the contract (R6b);
  the appeal loop terminates `Settled`/`Deadlocked` (R6c); provider **refusal** is a distinct
  terminal (R7); settle is an event marker + 50/50 fee split (R8). ✅ Party actions gated to the
  two addresses, third wallet rejected, reads open (R11); single-wallet via `partyId` (R12/R13).
  ✅ Library one-interface/two-mode (R14). ✅ Web app: file / engage / adjudicate / ruling +
  rationale + clause / accept / appeal / refuse / settle / overview / profile switch / wallet+mode
  (R15/R16). ✅ De-identified `sample-case.md` + Part D / openFDA / NADAC + Cost Plus /
  non-compliant-policy fixtures drive the flow.
- ⛔ **Remaining, blocked on a funded wallet only:** deploy `CoverageNegotiation.sol` to Somnia
  testnet (chain 50312); a **real** native-agent ruling with a viewable receipt + per-request fee
  on execution (R9); the real-RPC half of `eth_getLogs` reconstruction (T10) and the agent-browser
  e2e run. These are the "stop only when you can go no further without a real wallet" boundary.

---

### 2026-05-27 — Iteration 3: deterministic Cost Plus cap + quantity/daysSupply (SPEC-0001 update) + CDS-Hooks seam (SPEC-0002 R7)

Pulled new spec changes: SPEC-0001 R2/R6a/R10 now fix the cap as **Cost Plus per-unit × `quantity`**
(NADAC is a floor reference, never the cap; never AI-chosen), requests carry **`quantity`** (cap
driver) + optional **`daysSupply`** (necessity context, NOT price). Also new **SPEC-0002** (demo
experience) and an S3+CloudFront static-deploy script (R18) — deploy is handled outside this box,
so **no AWS/deploy commands were run here**.

**DONE — SPEC-0001 cap change across contract + library + tests.**
- `CoverageNegotiation.sol`: `createContract` gained `quantity` (require `> 0`) + `daysSupply`;
  `Negotiation` struct gained `quantity`, `daysSupply`, `costPlusUnitPrice`, `nadacUnitPrice`;
  `ContractCreated` carries quantity+daysSupply; the agent tuple is now `(decision,
  costPlusUnitPrice, nadacUnitPrice, rationaleHash, clauseRef, standardRef, receiptId)` and the
  CONTRACT computes `benchmarkCap = costPlusUnitPrice × quantity`, `coveredAmount = min(requested,
  cap)` (R6a — deterministic, never AI-chosen); NADAC stored as floor reference; new view
  `priceBasisOf` (requested/quantity/costPlusTotal/nadacFloorTotal/covered) for the demo gauge.
  `MockAgentPlatform.triggerRuling` now takes a `Ruling` calldata struct (kept the build off the
  stack-too-deep limit without `viaIR` — production bytecode unchanged).
- Library: `coverage.types.ts`/`abi.ts`/`contract/types.ts` (new `PriceBasis`), `simulated.ts`
  (mocked arbiter now `costPlusUnitPrice`/`nadacUnitPrice`; deterministic `min`), `real.ts`
  (29-field tuple decode + `priceBasisOf`), `party-agent.ts` (`fileRequest` quantity/daysSupply),
  `orchestrator.ts` + the two demo scripts.
- **Hardhat tests: 11 passing** — added the deterministic-cap block (cap binds both directions,
  quantity drives the cap, `priceBasisOf`, `qty: zero` revert, **daysSupply is price-neutral**),
  T1–T10 + security intact.
- **Verified green:** `npm run build` + `typecheck`, `npm --prefix contracts run test` (11/11),
  `node scripts/orchestrator-demo.mjs` (18 checks incl. cap-binding + daysSupply-invariance),
  `bash scripts/real-backend-localnode.sh` (18 checks incl. real/sim `priceBasisOf` parity).

**DONE — SPEC-0002 R7 CDS-Hooks integration seam (library side).** New `src/integrations/cds-hooks/`:
typed **CDS Hooks 2.0** interfaces (`CdsHooksRequest<TContext,TPrefetch>`, `OrderSignContext` with a
minimal FHIR R4 `MedicationRequest` bundle, `Card`, `SystemAction`, `CdsHooksResponse`), a synthetic
`SAMPLE_ORDER_SIGN_REQUEST` fixture (+ `demo-data/cds-hooks-order-sign.json`), and a pure
`orderSignToDraft` mapper → `CoverageRequestDraft` (drug/quantity/daysSupply/diagnosis/justification —
no PHI propagated). New `demo-data/fda-indication-adalimumab.json` (openFDA-label-shaped) states the
FDA-approved psoriasis indication that the non-compliant policy clause PD-ADA-09 contradicts — the
data behind the SPEC-0002 R3 "gotcha". Exported via `src/index.ts`. No real CDS-Hooks server (v0 mock
seam only). **Next:** the SPEC-0002 web experience (live timeline, FDA-gotcha viz, price gauge, role
gating, CDS prefill) consuming this seam.

---

### 2026-05-27 — Iteration 4: SPEC-0002 demo experience (live view, FDA gotcha, gauge, roles, CDS prefill) + SPEC-0001 quantity/daysSupply in the UI

Implemented the **SPEC-0002** experience layer on the existing Vite+React SPA (no new
on-chain behavior) and folded the SPEC-0001 quantity/daysSupply Create inputs in.

**DONE — web `web/src/`:**
- **Create (SPEC-0001):** added **quantity** (required, >0) + **daysSupply** (optional) inputs,
  passed to `createContract`; sample-case prefill includes them.
- **R7 CDS-Hooks prefill:** a **"Prefill from EHR order-sign"** button runs
  `orderSignToDraft(SAMPLE_ORDER_SIGN_REQUEST)` and fills drug/quantity/daysSupply/justification,
  with a "via mocked CDS Hooks 2.0" provenance note — the embedded-EHR entry point.
- **R1 live evolving view:** an animated **state stepper** (current lifecycle state highlighted,
  CSS tween/pulse), timeline entries fade/slide in, and a ruling panel whose **covered amount +
  rationale + cited clause + round** update as rulings/appeals land.
- **R3 FDA-label "gotcha":** on `PolicyInvalidated`, a panel renders the offending insurer clause
  **struck-through** (PD-ADA-09, from `policy-noncompliant.md`) beside the **FDA-approved
  indication** (from `fda-indication-adalimumab.json`) with a plain-language "voided because…"
  explanation and the on-chain `clauseRef`/`standardRef`.
- **R4 verifiability:** per-ruling verify affordance — Somnia **explorer deep link**
  (`txUrl(SOMNIA_TESTNET, txHash)`) in real mode; **event + on-chain hash** shown in simulated
  mode.
- **R5 price gauge:** horizontal bars for **requested vs NADAC floor vs Cost Plus cap vs covered**
  from `priceBasisOf`, with the deterministic `covered = min(requested, costPlus×qty)` spelled out;
  Cost Plus / NADAC per-unit-price inputs replace the old single benchmark-cap input.
- **R6 role + wallet-gating demo:** an **Observer** profile (party 99) — views everything, all
  mutating actions hidden; an explicit **"attempt as a non-party"** affordance calls a gated method
  and surfaces the rejection, making R11 neutrality visible.
- `client.ts` fixed to the new simulated-arbiter options (`costPlusUnitPrice`/`nadacUnitPrice`,
  replacing the removed `benchmarkCap`); `sampleCase.ts`/`fdaIndication.ts` wired; CSS for the
  stepper, gauge, gotcha, verify, and non-party panels.
- `demo-data/sample-case.md` + `price-benchmarks.md` updated to the per-unit Cost Plus cap / NADAC
  floor model (synthetic, app-repo-authored — no cross-repo boundary crossed).
- **Verified green:** `npm run build` (lib), `cd web && npx tsc --noEmit`, `npm run web:build`;
  no PEM keys / secrets in the built bundle. agent-browser e2e testids/scenarios updated
  best-effort (NOT run — no browser runtime).

### Status vs SPEC-0001 + SPEC-0002 pass/fail
- ✅ SPEC-0001 fully implemented incl. the resolved deterministic **Cost Plus × quantity** cap,
  quantity (cap driver) + daysSupply (price-neutral), `priceBasisOf`; 11/11 Hardhat tests.
- ✅ SPEC-0002 T1–T5 buildable/demoable in simulated mode: live evolving timeline (T1/R1,R2), the
  FDA-label gotcha voids + explains (T2/R3), verify affordance present (T3/R4), observer can't act +
  non-party rejection shown (T4/R6), the mocked `order-sign` prefills Create and the typed CDS Hooks
  2.0 interfaces compile (T5/R7). Price gauge (R5) done.
- ⛔ **Remaining, blocked on a funded wallet / out-of-box deploy only:** the live HTTPS deploy
  (R18 — `scripts/deploy-static.sh`, run outside this box), the real Somnia testnet deploy + a real
  native-agent ruling with receipt + fee (SPEC-0001 R9), real-mode explorer links exercised against
  a real tx, and the agent-browser e2e run (needs a browser runtime).
