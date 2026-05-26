# SPEC-0001: MVP0 — Coverage-exception negotiation loop

Status: Draft · Owner: tspugh · Date: 2026-05-26

## 1. Summary & user story

The minimum end-to-end product for Curie Negotiation Protocol: a basic website where a
user logs in as a profile, uploads a patient note, creates an on-chain **contract**
(coverage negotiation) addressed to another party, and the two sides argue it — with an
**on-chain agent dispute-resolution mechanism** producing the approval status — all
mediated by a single Solidity contract on Somnia. v0 is a **deterministic skeleton +
one real on-chain agent call**.

> As a **user (provider or payer)**, I want to upload a patient note and open a contract
> with another party, so that we can argue coverage on neutral rails and an impartial
> on-chain agent resolves disputes.
>
> As a **user**, I want one place to see the contracts I've created, monitor their
> status, open any one, submit a dispute or feedback, and see the agent's final approval
> — while seeing my wallet and who I'm logged in as.

## 2. Requirements

**Contract & chain**
- **R1 (MUST)** A single Solidity contract, built and deployed with **Hardhat** to Somnia testnet, is the system of record and mediates the entire flow (create, content commitment, dispute, agent ruling, status, settlement).
- **R2 (MUST)** A *contract* (negotiation instance) is created between an **initiator** and an **intended destination party** ("destination person"). Both sides may attach note/evidence content.
- **R3 (MUST)** Note/evidence content is stored **off-chain**; only its `keccak256` hash (+ refs) is committed on-chain. Both parties can verify their copy matches the on-chain hash.
- **R4 (MUST — hard invariant)** **No PHI (or any content beyond hashes, refs, amounts, state) is ever stored on-chain.**
- **R5 (MUST)** From a contract, a party can **submit a dispute**, which is **mediated through the chain** via the agent dispute-resolution mechanism; the agent produces a ruling/approval status.
- **R6 (MUST)** Parties can post **feedback / conversation** messages on a contract; the contract tracks the **final agent approval status** and the timeline.
- **R7 (MUST)** On approval, **settlement** occurs (escrow release / payment). With a single wallet, a user creates a contract **with themselves** and **pays themselves** (the single-wallet fallback).
- **R8 (MUST)** The agent dispute-resolution mechanism produces the ruling via **one real native Somnia agent call** (LLM Parse Website over a public formulary fixture), with a deterministic fallback so the loop never blocks.

**Website**
- **R9 (MUST)** A basic web app lets a user: submit a note, create a contract, view the contracts they've created, monitor status, and open a contract to interact with it.
- **R10 (MUST)** **Profile switching** — a user can switch to act as another user; the UI always shows the **active wallet** and **who you're logged in as**.
- **R11 (MUST)** **Two live users** (distinct profiles/wallets, when available) can create a contract together and each interact with it; otherwise the single-wallet self-contract (R7) exercises both sides.
- **R12 (MUST)** The app exposes three views (see §3): a **Create view**, a **Maintain / contract-detail view**, and an **Overview** that links to Create or to a particular contract's detail (status shown in a table).
- **R13 (SHOULD)** Contracts and their engagements are observable over JSON-RPC (events + live subscription) so the overview/status reflect on-chain truth.

## 3. Technical documentation

**On-chain/off-chain boundary.** Off-chain: submitted note/evidence content, the public
formulary fixture, cited public evidence (URLs), conversation/feedback text, the sample
case. On-chain: content hashes, drug/destination refs, rulings + receipt refs, price
band, escrow + settlement, state, profile/agent IDs, timestamps, events.

**PHI handling in v0 (important).** Content is submitted through the UI and stored
**off-chain**; only its hash is committed on-chain (R3/R4). v0 does **not** redact or
de-identify (out of scope, §7) — the demo uses a copy-pasteable **sample case**, not
real PHI. The agent dispute-resolution mechanism operates on the **dispute submission +
a public formulary fixture**, not raw content. A production deployment handling real PHI
would require redaction before any exposure to the public on-chain agent; that is out of
v0 scope and must not be assumed present.

**Contract — `CoverageNegotiation.sol` (Hardhat).**
- States: `Requested`, `UnderReview`, `EvidenceRequested`, `Approved`, `Denied`, `Appealed`, `Settled`, `Withdrawn`.
- Functions: `createContract(initiatorId, destinationId, drugRef, noteHash, requestedAmount, priceFloor, priceCeil, evidenceUri)`; `attachContent(reqId, contentHash, uri)` (either party); `submitDispute(reqId)` → fires the agent → `UnderReview`; `handleRuling(reqId, verdict, rationaleHash, receiptId)` *(platform-only)* → `Approved`/`Denied`/`EvidenceRequested`; `postFeedback(reqId, msgHash, uri)`; `submitEvidence(reqId, evidenceUri)`; `appeal(reqId, evidenceUri)`; `settle(reqId)`; `withdraw(reqId)`.
- Events: `ContractCreated`, `ContentCommitted`, `DisputeSubmitted`, `Ruled`, `FeedbackPosted`, `EvidenceSubmitted`, `Appealed`, `Settled`, `Withdrawn`.
- Guards: strict per-state `require`s; `handleRuling` gated to the platform address; settlement amount within `[priceFloor, priceCeil]`; `initiatorId == destinationId` is permitted (self-contract).
- Deployed to Somnia testnet (chain `50312`, RPC `https://api.infra.testnet.somnia.network/`; see [`../../src/config/networks.ts`](../../src/config/networks.ts)) via Hardhat; identity via `somnia-agent-kit` `AgentRegistry`.

**Agent dispute-resolution mechanism.** On `submitDispute`, the contract (or an
off-chain orchestrator relaying for it) invokes the Somnia LLM Parse Website base agent
with the public formulary fixture URL + dispute context + `ExtractString`
`options=["approve","deny","need_more_evidence"]`; the platform calls `handleRuling`
with the verdict + `receiptId` (public receipt). Deterministic fallback mirrors the
verdict shape (R8).

**Web app — views & sessions.**
- **Overview view** — a table of the contracts the active profile has created, each row showing status (from on-chain state/events, R13) and linking to its detail; a link/button to the **Create view**.
- **Create view** — submit a note (content stored off-chain, hash committed), choose the **destination party**, set the price band, and create the contract.
- **Maintain / contract-detail view** — opened by clicking a contract: shows the timeline and **final agent approval status**, lets a party **submit a dispute** (→ on-chain agent mediation), **post feedback** on the conversation, submit evidence/appeal, and settle. Always shows the **active wallet** and **logged-in profile**.
- **Profiles & wallets** — profiles are app-level identities mapped to wallet keys. With multiple keys, two live users transact (R11); with a single wallet (v0 default), the user self-deals via a self-contract (R7). A profile switcher sets the active identity.

```
Overview (table) ──▶ Create view ──tx──▶ CoverageNegotiation.sol ──submitDispute──▶ LLM Parse Website
       │  click a contract                    ▲   └── handleRuling (verdict+receipt) ──┘  (public formulary)
       ▼                                       │
Maintain / detail view  ◀── JSON-RPC (eth_getLogs / eth_subscribe / somnia_watch) ──┘
  (dispute · feedback · approval status · wallet + logged-in profile · settle)
```

**Monitoring (contract browser).** `eth_call` (state), `eth_getLogs` (history, ≤1000-block
ranges), `eth_subscribe` → `logs`/`newHeads` + Somnia `somnia_finishedTransactions`/`somnia_watch`
(live), `eth_getTransactionReceipt` (outcomes), `eth_sendRawTransaction` / Somnia
`realtime_sendRawTransaction` (submit).

## 4. Deliverables

- `contracts/CoverageNegotiation.sol` (Hardhat) + `contracts/test/CoverageNegotiation.test.ts` + `contracts/scripts/deploy.ts` + `hardhat.config.ts` (chain 50312).
- `src/agents/{provider-agent,payer-agent,mediator}.ts`, `src/orchestrator.ts`, `src/types/coverage.types.ts`, `src/index.ts`.
- **Web app** with the **Overview**, **Create**, and **Maintain/contract-detail** views; a **profile switcher** + wallet/identity display; renders timeline, agent approval status, and the mediator receipt from on-chain events.
- Off-chain content store (simple, in-app) + hash commitment + a both-party note-verification check.
- **Sample case** in a markdown file (`demo-data/sample-case.md`) — easy to copy/paste into the Create view. (No synthetic-data generator — see §7.)
- Public **formulary fixture** + **price-band** fixtures.
- Deployed testnet address recorded in `.env.example` / README.

## 5. Test cases

- **T1 (R3,R4):** content stored off-chain; `keccak256(content)` equals the on-chain hash; no PHI/content (beyond hashes/refs) appears on-chain or in the agent payload.
- **T2 (R1,R2):** `createContract` deploys/uses the Hardhat contract; emits `ContractCreated` + `ContentCommitted`; self-contract (`initiator == destination`) is accepted.
- **T3 (R5,R8):** `submitDispute` → `UnderReview`; a **real** agent call returns a verdict and `handleRuling` records it with a `receiptId`; with the agent stubbed, the deterministic fallback still completes.
- **T4 (R6):** `postFeedback` is recorded; `need_more_evidence` → evidence → re-rule; `deny` → appeal → re-rule; the contract exposes the final approval status.
- **T5 (R7):** on `approve`, `settle` succeeds within the band and (single-wallet) pays the initiator's own wallet; reverts for an out-of-band amount.
- **T6 (guards):** invalid transitions revert; `handleRuling` reverts for a non-platform caller.
- **T7 (R9,R12):** Overview lists the active profile's contracts with live status and links to Create and to a contract's detail; Create opens a contract end-to-end; the detail view drives dispute/feedback/settle.
- **T8 (R10,R11):** profile switching changes the active identity and displayed wallet; two profiles (or a self-contract) can each interact with the same contract.
- **T9 (R13):** a client reconstructs the timeline from `eth_getLogs` and receives live updates via subscription.

## 6. Pass / fail criteria

**PASS — all must hold:**
- [ ] `CoverageNegotiation.sol` compiles and deploys to Somnia testnet (chain 50312) via Hardhat.
- [ ] T1–T6 pass in the contract/test suite; T7–T9 pass end-to-end via the web app.
- [ ] The website supports: submit note, create contract, overview table with live status, open a contract, submit a dispute mediated on-chain, post feedback, see final agent approval status, switch profiles, and shows the active wallet + logged-in profile.
- [ ] A two-user contract (or single-wallet self-contract, paying yourself) runs end-to-end.
- [ ] At least one **real** native-agent ruling is produced on testnet with a viewable receipt.
- [ ] A copy-pasteable `demo-data/sample-case.md` exists and drives the Create view.

**FAIL — any triggers rejection:**
- Any PHI/content (beyond hashes/refs/amounts/state) appears on-chain or in an agent payload.
- A dispute is not actually mediated through the chain/agent (no real agent-call path exists).
- An invalid state transition does not revert, or `handleRuling` accepts a non-platform caller.
- Escrow settles outside `[priceFloor, priceCeil]`.
- Profiles cannot be switched, or the overview doesn't reflect on-chain status.

## 7. Out of scope

- **Identity verification to join** — no KYC / identity proofing; any profile can participate.
- **PHI redaction / de-identification** — content is taken as submitted (off-chain); v0 uses a sample case, not real PHI.
- **Synthetic / fake test-case generation** — provide one copy-pasteable `sample-case.md` instead; no generator.
- **Testing or evaluation of the agent** — no agent accuracy benchmarks or eval harness.
- Also deferred: real formulary/payer integrations; full named appeal ladder; live benchmark price fetch; mock-stablecoin beyond self-pay; multi-tenant; subgraph indexing; ZK proofs; mobile UI.

## 8. Open questions

1. Does `submitDispute` fire the agent **directly from the contract**, or via an **off-chain orchestrator** that submits the agent request and relays `handleRuling`? — priority: high
2. Formulary fixture source — a published Medicare Part D formulary vs. a synthetic published-formulary fixture? — priority: high
3. Settlement asset for self-pay — native STT transfer vs. event-only marker in v0? — priority: medium
4. Profile/wallet model — multiple local keys in `.env` for true two-user, or a single wallet with app-level profiles + self-contract only? — priority: medium
