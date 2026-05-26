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

### Next iterations
- Web app (Overview / Create / Maintain views, profile switcher, wallet/identity/mode) consuming `createClient`. Then agent-browser coarse AAA tests. Parallelize via subagents.
- Blocked on real wallet: testnet deploy + a real native-agent ruling (R9).
