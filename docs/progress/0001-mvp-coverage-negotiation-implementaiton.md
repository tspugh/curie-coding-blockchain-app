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

### Status vs SPEC-0001 pass/fail (§6)
- ✅ Contract compiles + passes Hardhat tests (T1–T6). ✅ Library one-interface/two-mode (R11). ✅ Web app: all required views/actions (R14/R15) + profile switch + wallet/mode display (R12/R13). ✅ no-PHI invariant enforced + asserted (R4). ✅ positions-before-dispute (R5) + dispute fires agent (R6) + settle-within-band (R8). ✅ E2E suite (T8/T9 + T1/T3/T5 at the UI boundary).
- ⛔ **Remaining, blocked on a funded wallet only:** deploy `CoverageNegotiation.sol` to Somnia testnet (chain 50312); the real-wallet half of T7 (R11) and one **real** native-agent ruling with a viewable receipt + per-request fee on execution (R9); T10 (`eth_getLogs` timeline reconstruction over real RPC). These are the "stop only when you can go no further without a real wallet" boundary.
