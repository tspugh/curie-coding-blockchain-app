# SPEC-0001: MVP0 — Coverage-exception negotiation loop

Status: Draft · Owner: tspugh · Date: 2026-05-26

## 1. Summary & user story

The minimum end-to-end product for Curie Negotiation Protocol: a basic website where a
user logs in as a profile, uploads a patient note, and creates an on-chain **contract**
(coverage negotiation) addressed to another party. **Both parties submit the price they
believe is appropriate** to initialize the contract; once both are in, either party can
**raise a dispute**, which **fires a native Somnia agent from the contract** to rule the
outcome against a **published Medicare Part D formulary**. Settlement in v0 is an
**event marker** only. The wallet layer works with both a **simulated wallet** (dev) and
a **real wallet** (MVP v0).

> As a **user (provider or payer)**, I want to upload a note, state the price I think is
> right, and—when we disagree—have an impartial on-chain agent rule it, so coverage is
> decided on neutral rails.
>
> As a **user**, I want one place to see my contracts, monitor status, open one, submit a
> dispute or feedback, and see the agent's final approval — with my wallet and profile shown.

## 2. Requirements

**Contract & chain**
- **R1 (MUST)** A single **Solidity** contract, built/deployed and **tested with Hardhat**, is the system of record and mediates the whole flow.
- **R2 (MUST)** A *contract* is created between an **initiator** and an **intended destination party**; both may attach note/evidence content.
- **R3 (MUST)** Note/evidence content is stored **off-chain**; only its `keccak256` hash (+ refs) is on-chain; both parties can verify their copy matches.
- **R4 (MUST — hard invariant)** **No PHI (or any content beyond hashes, refs, amounts, state) is ever on-chain.**
- **R5 (MUST)** **Both parties must submit their proposed pricing/position to initialize** the contract; it only becomes disputable once **both** have submitted.
- **R6 (MUST)** After both positions are in, a party can **raise a dispute**; **each dispute fires the native agent** (contract-native, §3). The agent rules `approve | deny | need_more_evidence`.
- **R7 (MUST)** Parties can post **feedback / conversation**; the contract tracks the **final agent approval status** and timeline.
- **R8 (MUST)** Settlement in v0 is an **event marker only** (no token transfer), recording the agreed amount within the benchmark band; single-wallet self-pay is a marker.
- **R9 (MUST — contract-native agent)** The contract fires a native Somnia agent request and the platform **calls back into the same contract** (`handleRuling`). The **per-request fee is charged when the agent executes** (validators paid on execution; refunded on timeout) — so a **funded wallet is required in real-wallet mode**. `Failed`/`TimedOut` (or a deadline keeper) routes to a retriable state.
- **R10 (MUST — agent type by source)** Pick the native agent by source type: an **HTML page → `LLM Parse Website`**; a **JSON/REST endpoint → `JSON API Request`**. The v0 public reference is a **published Medicare Part D formulary** (DailyMed/FDA labels are optional, not required for v0).

**Wallet & profiles**
- **R11 (MUST)** The wallet layer is **pluggable and works with both**: a **simulated/mock wallet** (dev loop, no funds, agent execution mocked) **and a real wallet** (MVP v0, real funds + real agent execution). The same code path runs in either mode.
- **R12 (MUST)** Users can **supply their own wallet** or use a **base-level** one. **Single wallet, multiple users**: app-level profiles share a wallet; **profile switching** sets the active identity; the UI always shows the **active wallet** + **logged-in profile**.
- **R13 (MUST)** Two users (distinct profiles, sharing the single wallet, or distinct wallets when supplied) can each interact with a contract; **self-contract / pay-yourself** is supported.

**Website**
- **R14 (MUST)** A basic web app lets a user submit a note, create a contract, submit a position, view/monitor their contracts, and open one to interact (dispute, feedback, settle).
- **R15 (MUST)** Three views (§3): a **Create view**, a **Maintain / contract-detail view**, and an **Overview** linking to Create or to a contract's detail (status in a table).
- **R16 (SHOULD)** Contracts/engagements are observable over JSON-RPC (events + live subscription) so status reflects on-chain truth.

## 3. Technical documentation

**On-chain/off-chain boundary.** Off-chain: submitted note/evidence content, the
published formulary reference, cited public evidence, conversation text, the sample
case. On-chain: content hashes, drug/destination refs, **party positions (amounts)**,
rulings + receipt refs, benchmark band, settlement marker, state, profile/agent IDs,
timestamps, events.

**PHI handling in v0.** Content is submitted via the UI and stored **off-chain**; only
its hash is committed on-chain (R3/R4). v0 does **not** redact (out of scope, §7) — it
runs on a copy-pasteable **sample case**, not real PHI. The agent operates on the
dispute + the published formulary, not raw content. Real PHI in production would require
redaction before any public-agent exposure (out of v0 scope).

**Contract — `CoverageNegotiation.sol` (Hardhat).**
- States: `Open`, `Ready`, `UnderReview`, `EvidenceRequested`, `Approved`, `Denied`, `Appealed`, `Settled`, `Withdrawn`.
- Functions: `createContract(initiatorId, destinationId, drugRef, noteHash, priceFloor, priceCeil, evidenceUri)` → `Open`; `attachContent(reqId, contentHash, uri)`; `submitPosition(reqId, proposedAmount, contentHash, uri)` (each party once; when **both** in → `Ready`); `submitDispute(reqId)` *(only in `Ready`)* → fires the native agent (emits `DisputeSubmitted` + `RulingRequested`) → `UnderReview`; `handleRuling(reqId, verdict, rationaleHash, receiptId)` *(platform callback only)*; `onRulingTimeout(reqId)` → `EvidenceRequested`; `postFeedback(reqId, msgHash, uri)`; `submitEvidence(reqId, evidenceUri)` (re-fires agent); `appeal(reqId, evidenceUri)` (re-fires agent); `settle(reqId)` (event marker, amount within band); `withdraw(reqId)`.
- Events: `ContractCreated`, `ContentCommitted`, `PositionSubmitted`, `ContractReady`, `DisputeSubmitted`, `RulingRequested`, `Ruled`, `RulingTimedOut`, `FeedbackPosted`, `EvidenceSubmitted`, `Appealed`, `Settled`, `Withdrawn`.
- Guards: strict per-state `require`s; **dispute only in `Ready`** (both positions submitted); `handleRuling` gated to the Somnia agent-platform address; settlement amount within `[priceFloor, priceCeil]`; `initiatorId == destinationId` permitted (self-contract). The contract funds each agent request at fire time (R9).
- Deployed to Somnia testnet (chain `50312`, RPC `https://api.infra.testnet.somnia.network/`; see [`../../src/config/networks.ts`](../../src/config/networks.ts)); identity via `somnia-agent-kit` `AgentRegistry`.

### State machine

| From | Trigger | To |
|---|---|---|
| — | `createContract` | `Open` |
| `Open` | `submitPosition` (each party; **both** required) | `Open` → (both in) `Ready` |
| `Ready` | `submitDispute` (fires native agent) | `UnderReview` |
| `UnderReview` | `handleRuling`: `approve` *(platform callback)* | `Approved` |
| `UnderReview` | `handleRuling`: `deny` | `Denied` |
| `UnderReview` | `handleRuling`: `need_more_evidence` | `EvidenceRequested` |
| `UnderReview` | `handleRuling`: `Failed`/`TimedOut`, or `onRulingTimeout` | `EvidenceRequested` (retriable) |
| `EvidenceRequested` | `submitEvidence` (re-fires agent) | `UnderReview` |
| `Denied` | `appeal` (re-fires agent) | `UnderReview` |
| `Approved` | `settle` (event marker, within band) | `Settled` |
| any pre-`Settled` | `withdraw` | `Withdrawn` |

`postFeedback` may be called in any active state without changing state. **The agent
fires on each dispute** (`submitDispute`, and again on `submitEvidence`/`appeal`), and
the per-request fee is charged on each execution (R9).

**Agent dispute-resolution mechanism (contract-native).** The contract executes the
native dispute handling — no off-chain mediator service. On `submitDispute` it fires a
native Somnia agent request via `createRequest`, **selecting the agent by source type**
(R10): the published **Medicare Part D formulary** as an **HTML page → `LLM Parse
Website`** (`ExtractString` `options=["approve","deny","need_more_evidence"]`), or a
**JSON/REST formulary/benchmark endpoint → `JSON API Request`**. It moves to
`UnderReview`; the platform runs the agent and **calls `handleRuling` back into the same
contract** with the verdict + receipt, routing to `Approved`/`Denied`/`EvidenceRequested`.
The per-request fee is paid **when the agent executes** (refunded on timeout). Request,
callback, and timeout are sub-processes (states) of the one contract.

**Wallet abstraction (simulated ↔ real).** A pluggable signer/provider layer exposes one
interface with two implementations: a **simulated wallet** (mock signer; no funds; agent
execution + fee mocked; for the dev loop and CI) and a **real wallet** (private key /
supplied key; real funds; real agent execution + fee on testnet, MVP v0). The app and
contract-interaction code are identical across modes; only the signer differs. Profiles
are app-level identities; in single-wallet mode they share the active wallet (self/two-
party via profile switching), and a user may supply their own wallet.

**Web app — views & sessions.**
- **Overview** — table of the active profile's contracts with live status (from on-chain state/events), linking to Create and to each contract's detail.
- **Create** — submit a note (off-chain; hash committed), choose the destination party, set the benchmark band, create the contract; then **submit your position** (proposed amount).
- **Maintain / contract-detail** — shows the timeline + final agent approval status; lets a party submit a position (if pending), raise a dispute (→ contract-native agent), post feedback, submit evidence/appeal, and settle (marker). Shows active wallet + logged-in profile + wallet mode (simulated/real).

```
Create view ──tx──▶ CoverageNegotiation.sol  (both submitPosition → Ready)
                          │  submitDispute → createRequest (fires native agent;
                          │                 Parse Website for HTML / JSON API for JSON)
                          ▼
                     Somnia platform runs the agent over the published Part D formulary
                          │  handleRuling (verdict + receipt) — callback into the SAME contract
                          ▼
                     CoverageNegotiation.sol → Approved / Denied / EvidenceRequested
                                               (Failed/TimedOut → retriable)

Overview / Maintain detail  ◀── JSON-RPC (eth_getLogs · eth_subscribe · somnia_watch)
```

**Monitoring (contract browser).** `eth_call` (state), `eth_getLogs` (history, ≤1000
blocks), `eth_subscribe` → `logs`/`newHeads` + Somnia `somnia_finishedTransactions`/`somnia_watch`,
`eth_getTransactionReceipt`, `eth_sendRawTransaction` / Somnia `realtime_sendRawTransaction`.

## 4. Deliverables

- `contracts/CoverageNegotiation.sol` (Hardhat) + `contracts/test/CoverageNegotiation.test.ts` + `contracts/scripts/deploy.ts` + `hardhat.config.ts` (chain 50312).
- `src/wallet/` — pluggable signer with **simulated** and **real** implementations (R11).
- `src/agents/{provider-agent,payer-agent}.ts`, `src/orchestrator.ts`, `src/types/coverage.types.ts`, `src/index.ts` (submit txs, watch events; AI ruling is **contract-native**).
- **Web app**: Overview / Create / Maintain views; profile switcher + wallet/identity + wallet-mode display; timeline, approval status, agent receipt from events.
- Off-chain content store (in-app) + hash commitment + both-party note-verification.
- **Sample case** `demo-data/sample-case.md` (copy/paste into Create). **Published Medicare Part D formulary** fixture (HTML or JSON) + benchmark price-band fixtures.
- Deployed testnet address recorded in `.env.example` / README.

## 5. Test cases

- **T1 (R3,R4):** content off-chain; `keccak256(content)` == on-chain hash; no PHI/content beyond hashes/refs on-chain or in the agent payload.
- **T2 (R1,R2):** `createContract` uses the Hardhat contract; emits `ContractCreated`; self-contract accepted.
- **T3 (R5):** `submitPosition` from one party leaves state `Open`; from both → `Ready` (emits `ContractReady`); `submitDispute` reverts before `Ready`.
- **T4 (R6,R9):** in `Ready`, `submitDispute` fires the native agent → `UnderReview`; `handleRuling` records a real verdict + `receiptId` and routes; `Failed`/`TimedOut`/`onRulingTimeout` → `EvidenceRequested`; `submitEvidence`/`appeal` re-fire the agent.
- **T5 (R8):** on `approve`, `settle` emits `Settled` with an amount within `[priceFloor, priceCeil]` (event marker, no transfer); out-of-band reverts.
- **T6 (guards):** invalid transitions revert; `handleRuling` reverts for a non-platform caller.
- **T7 (R11):** the full loop runs in **simulated-wallet** mode (no funds, mocked agent) **and** in **real-wallet** mode (real testnet agent execution) with the same code path.
- **T8 (R14,R15):** Overview lists contracts with live status + links; Create opens a contract and captures a position; the detail view drives dispute/feedback/settle.
- **T9 (R12,R13):** profile switching changes active identity + shown wallet/mode; two profiles (or a self-contract) each interact with the same contract.
- **T10 (R16):** a client reconstructs the timeline from `eth_getLogs` and gets live updates via subscription.

## 6. Pass / fail criteria

**PASS — all must hold:**
- [ ] `CoverageNegotiation.sol` compiles, **passes its Hardhat tests**, and deploys to Somnia testnet (chain 50312).
- [ ] T1–T6 pass in the contract/test suite; T7–T10 pass end-to-end.
- [ ] Both parties must submit positions before a dispute is possible (R5); each dispute fires the agent (R6).
- [ ] The loop runs in **both** simulated-wallet and real-wallet modes; in real-wallet mode at least one **real** native-agent ruling is produced with a viewable receipt and the per-request fee is charged on execution.
- [ ] Website supports: submit note, create contract, submit position, overview with live status, open a contract, dispute (mediated on-chain), feedback, final approval status, profile switch, and shows active wallet + profile + mode.
- [ ] A copy-pasteable `demo-data/sample-case.md` and a published Part D formulary fixture exist and drive the flow.

**FAIL — any triggers rejection:**
- Any PHI/content (beyond hashes/refs/amounts/state) appears on-chain or in an agent payload.
- A dispute can be raised before both positions are submitted, or a dispute isn't mediated through the contract-native agent.
- An invalid transition doesn't revert, or `handleRuling` accepts a non-platform caller.
- Settlement records an amount outside `[priceFloor, priceCeil]`.
- The code only works in one wallet mode (must support both simulated and real).

## 7. Out of scope

- **Identity verification to join** — no KYC / identity proofing.
- **PHI redaction / de-identification** — content taken as submitted; sample case, not real PHI.
- **Synthetic / fake test-case generation** — one copy-pasteable `sample-case.md` instead.
- **Testing or evaluation of the agent** — no accuracy benchmarks / eval harness.
- **Real token settlement** — v0 settlement is an event marker only.
- Also deferred: DailyMed/FDA-label integration (optional, not v0); real formulary/payer integrations; full named appeal ladder; live benchmark price fetch; multi-tenant; subgraph; ZK; mobile UI.

## 8. Open questions

1. Benchmark band source for v0 — fixture values vs. a JSON benchmark endpoint (NADAC/Cost Plus) queried via `JSON API Request`? — priority: medium
2. Ruling timeout window — what deadline before `onRulingTimeout` fires, given Somnia callback latency? — priority: medium
