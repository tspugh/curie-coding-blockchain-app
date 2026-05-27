# SPEC-0001: MVP0 — AI-arbitrated drug coverage-exception

Status: Draft (revised twice) · Owner: tspugh · Date: 2026-05-27

> **Changelog — 2026-05-27.** Reconciled with amendment **A-0003**. The agent is a
> **necessity arbiter**, not a price-setter: it weighs the provider's cited **public**
> evidence against the **insurer's attached policy criteria** (free-text vs. free-text) and
> rules `approve | deny | need_more_evidence` — the irreplaceable, AI-worthy judgment. The
> **covered amount is deterministic** (`min(requested, public-benchmark cap)`), never
> AI-chosen. **Appeals submit more public evidence of necessity** (not price haggling). The
> **insurer attaches its governing policy** as a hashed contract input *before* adjudication;
> the agent must **cite the clause** it relies on, and if a relied-on clause **contradicts a
> public standard** (FDA-approved indication / guideline) the agent **voids the contract**
> (`PolicyInvalidated`) — incentivising compliant policy. A provider may **refuse the
> insurer's terms** (`ProviderRefused`). Supersedes both the original approve/deny model and
> the interim price-arbiter rewrite (see §9).

## 1. Summary & user story

A web app where a **provider (clinician)** files an on-chain **drug coverage-exception
request**: the drug (RxNorm/NDC), a **de-identified** clinical justification + **public
evidence URLs** (off-chain; only hashes/refs on-chain), and the **amount billed**, addressed
to a named **insurer**. The insurer **engages** by **attaching its governing policy
criteria** (public text; hash on-chain, body off-chain). The contract then fires a **native
Somnia agent** acting as an **arbiter**: it reads the provider's cited public evidence
against the insurer's policy criteria and rules **`approve | deny | need_more_evidence`**,
**citing the specific policy clause** in its rationale. If a clause it relies on
**contradicts a public standard** (e.g. the FDA-approved indication), it **voids the
contract** (`PolicyInvalidated`). On `approve`, the **covered amount is computed
deterministically** as `min(requested, public-benchmark cap)` (NADAC / Mark Cuban Cost Plus).
Either party may **accept** or **appeal with more public evidence**; appeals re-fire the
agent and are **bounded to N rounds** → `Deadlocked` if unresolved. Both accepting settles
(event marker, fee split 50/50). A provider may **refuse the insurer's terms**
(`ProviderRefused`). **No PHI on-chain or in the agent payload.**

> As a **provider**, I want to file a coverage-exception with my clinical justification and
> public evidence, and have an impartial agent rule it against the insurer's *stated* policy
> on neutral, auditable rails — and have a bad policy clause thrown out, not quietly applied.
>
> As an **insurer**, I want to attach my governing policy and have a transparent arbiter
> apply it to the provider's evidence, with every ruling and the clause it rested on recorded
> immutably.

## 2. Requirements

**Contract & chain**
- **R1 (MUST)** A single **Solidity** contract, built/deployed and **tested with Hardhat**, is the system of record and mediates the whole flow.
- **R2 (MUST)** A request is created by a **provider (initiator)** against a named **insurer (destination)**: drug ref (**RxNorm/NDC**), **quantity** (dispensed units, NDC-pinned — drives the cap), optional **`daysSupply`** (clinical-utilization context for necessity reasoning, NOT a price input), de-identified **justification hash**, **public-evidence URI refs**, and the **requested (billed) amount**.
- **R3 (MUST)** Note/evidence content is stored **off-chain** (or at its public URL); only `keccak256` hashes + opaque refs are on-chain; both parties can verify their copy matches.
- **R4 (MUST — hard invariant)** **No PHI / no content beyond hashes, refs, amounts, state is ever on-chain — nor in the agent payload.** v0 uses a **de-identified synthetic** case; the agent receives only a de-identified extract + public URLs (§3 "PHI handling").
- **R5 (MUST — insurer attaches policy)** The **insurer engages** a filed request by **attaching its governing policy criteria** as a **hashed, public** contract input (hash on-chain, body off-chain/at a public URL) **before** adjudication. Adjudication cannot run until a policy is attached.
- **R6 (MUST — necessity arbiter)** Adjudication fires the **native agent**, which **weighs the provider's cited public evidence against the insurer's attached policy criteria** and rules **`approve | deny | need_more_evidence`**, recording a **rationale hash** + the **specific policy clause ref** relied on + receipt. (This text-vs-text judgment is the irreplaceable, AI-worthy step — A-0003.)
- **R6a (MUST — deterministic amount)** The covered amount is **not AI-chosen**: on `approve` it is `coveredAmount = min(requestedAmount, benchmarkCap)` where **`benchmarkCap` = the Mark Cuban Cost Plus per-unit retail price × `quantity`** (R2) — the fair, transparent v0 benchmark (resolved 2026-05-27). `daysSupply` does NOT enter the price; it feeds necessity reasoning (e.g. early-refill / excessive-supply flags). **NADAC** is recorded alongside as the acquisition-cost **floor reference** (a `requested < NADAC` is flagged as suspicious). On `deny` the amount is `0`. (A NADAC+dispensing-fee "payer-reimbursement mode" is a v1 alternative — §7.)
- **R6b (MUST — policy compliance / void)** If a policy clause the agent **relies on contradicts a cited public standard** (FDA-approved indication / guideline), the agent emits **`PolicyFlagged(clauseRef, standardRef)`** and routes the contract to terminal **`PolicyInvalidated`** — the whole request is **voided** (incentivising compliant policy). No silent override.
- **R6c (MUST — necessity appeals, bounded)** From a ruling, **either party may `accept` or `appeal`**. An **appeal submits new public evidence of necessity** (`{evidenceUri, reasonHash}`) — never price haggling — and **re-fires the agent**, `round++`. Bounded to **N rounds** (config; default 3). **Both accepting** the current ruling makes it settleable; **N rounds without mutual acceptance → terminal `Deadlocked`**.
- **R7 (MUST — provider refusal)** After the insurer has attached terms, the **provider may `refuse`** → terminal **`ProviderRefused`** (an attributable rejection of the insurer's stated terms, distinct from neutral `Withdrawn` and from `Deadlocked`), recording an optional reason hash.
- **R8 (MUST — settlement marker)** Settlement in v0 is an **event marker only** (no token transfer): records the **agreed covered amount** and the **per-party fee split** (50/50) deducted from it. Self-claim is a marker.
- **R9 (MUST — contract-native agent + fees)** The contract fires the native agent via `createRequest`; the platform **calls back** into the same contract. The **per-request fee is charged on execution** (refunded on timeout) — **funded wallet required in real mode**; fees are **split 50/50** and reconciled against the covered amount at settlement (marker in v0; real transfer v1). `Failed`/`TimedOut` (or a keeper) routes to a retriable state.
- **R10 (MUST — public sources)** Drug identity via **RxNorm/NDC**; necessity evidence via **openFDA / DailyMed labels + clinical guidelines** (and the public standard for R6b); price cap via **Mark Cuban Cost Plus** (primary, fair retail) with **NADAC** as the acquisition-cost floor reference; coverage rubric is the **insurer's attached policy** (with a **published Medicare Part D** exception-criteria fixture for v0). Agent selects by source type: HTML → `LLM Parse Website`; JSON/REST → `JSON API Request`.

**Identity & authorization**
- **R11 (MUST — wallet auth)** Each request registers a **provider address** and an **insurer address**. Every party action is gated `msg.sender ∈ {providerAddr, insurerAddr}` (with `insurerEngage` insurer-only, `refuse` provider-only). A **third, unrelated wallet reverts**; reads stay **public**.
- **R12 (MUST — single shared wallet still works)** Under single-wallet the two addresses are **equal**; parties are then distinguished by the app-level `partyId` argument (trusted — caller's own wallet). The UI shows active **wallet + profile + mode**; profile switching sets identity. A **distinct third test wallet** asserts exclusivity (R11).
- **R13 (MUST)** Two profiles (shared or distinct wallets) can each interact; **self-claim** supported.

**Wallet & web**
- **R14 (MUST)** Pluggable wallet: **simulated** (dev/CI, no funds, agent+fee mocked) **and real** (testnet, real funds + real native-agent execution), same code path.
- **R15 (MUST)** Web app: provider files a request; insurer attaches policy + engages; both watch rulings + the cited clause + the evolving covered amount; accept/appeal; settle.
- **R16 (MUST)** Three views — **Overview** (claims table + live status), **Create** (file a request), **Maintain/detail** (timeline, current ruling + rationale + cited clause, covered amount, accept/appeal/refuse/settle, gated by state + active profile).
- **R17 (SHOULD)** Observable over JSON-RPC (events + live subscription).
- **R18 (MUST — deployment)** The web app is **deployed as a public HTTPS static site** (the SPA is fully client-side; simulated mode needs no backend). v0 target: **AWS S3 (private bucket) + CloudFront (HTTPS) + ACM** (custom domain optional; the default CloudFront cert suffices otherwise), driven by a **repeatable deploy script**. **No PHI and no secrets ship in the static bundle** (synthetic fixtures only; any real-mode key is supplied at runtime, never built in).

## 3. Technical documentation

**Actors.** **Provider** (prescriber / dispensing pharmacy, *initiator* — files the
coverage-exception and seeks reimbursement, acting **on the patient's behalf**) ↔
**Insurer / plan** (*destination* — attaches the governing policy, pays) ↔ **AI arbiter**
(the native Somnia agent — rules necessity and applies the deterministic cap). The
**patient is the beneficiary, NOT a v0 transacting party** — there is no patient wallet;
the provider represents the patient. Patient-as-a-party (visibility/approval, cost-sharing
flows) is v1 (§7).

**On-chain / off-chain boundary.** *Off-chain / at public URLs:* the de-identified
justification, cited public evidence, the insurer's policy body, the agent's rationale,
appeal docs, conversation text (only hashes/refs on-chain). *On-chain:* content/policy
hashes + URL refs, drug ref (RxNorm/NDC), requested amount, the **ruling** (`approve|deny|
need_more_evidence`) + rationale hash + **cited clause ref** + receipt, policy-flag refs,
per-party accept flags, round count, covered amount + fee split (at settle), state, ids,
party addresses, timestamps, events.

**PHI handling in v0 (architecture B + its limitation).** The native Somnia agent's payload
and result are validator-processed and surfaced on-chain — **publicly visible**. v0 therefore
sends the agent only a **de-identified, structured extract** (drug RxNorm/NDC, requested
amount, public-evidence URLs, the public policy URL — *no* free-text identifiers, *no* raw
ICD-10) and runs on a **synthetic** case, never real PHI. **Stated limitation (call out in the
deck):** true privacy is unachievable while reasoning runs on a public agent — real-PHI
de-identification and **private/tiered on-chain reasoning are v1**, and a concrete **ask of
the Somnia platform**.

**Contract — `CoverageNegotiation.sol` (Hardhat).**
- **States:** `Open`, `Ready`, `UnderReview`, `EvidenceRequested`, `Approved`, `Denied`, `Settled`, `Deadlocked`, `PolicyInvalidated`, `ProviderRefused`, `Withdrawn`.
- **Functions:**
  - `createContract(providerId, insurerId, providerAddr, insurerAddr, drugRef, requestedAmount, justificationHash, evidenceUri)` *(provider)* → `Open`.
  - `insurerEngage(reqId, policyHash, policyUri)` *(insurer only)* → `Ready`.
  - `requestAdjudication(reqId)` *(payable; from `Ready`)* → fires the agent (`AdjudicationRequested` + `RulingRequested`) → `UnderReview`.
  - `handleResponse(requestId, responses, status, details)` *(platform only)* — decodes `(decision, coveredAmount, rationaleHash, clauseRef, standardRef, receiptId)` → `Approved` / `Denied` / `EvidenceRequested` / `PolicyInvalidated`.
  - `submitEvidence(reqId, evidenceUri)` *(provider; from `EvidenceRequested`)* → re-fires → `UnderReview`, `round++`.
  - `appeal(reqId, partyId, evidenceUri, reasonHash)` *(from `Approved`/`Denied`; `round < N`)* → re-fires → `UnderReview`, `round++`; at `round == N` without mutual accept → `Deadlocked`.
  - `accept(reqId, partyId)` *(from `Approved`/`Denied`)* — sets accept flag; **both** → settleable.
  - `settle(reqId)` *(both accepted)* — records covered amount + 50/50 fee split → `Settled`.
  - `refuse(reqId)` *(provider only; from `Ready` onward, pre-terminal)* → `ProviderRefused`.
  - `withdraw(reqId)` *(either party; any pre-terminal)* → `Withdrawn`.
  - `onRulingTimeout(reqId)` *(keeper; `UnderReview` past deadline)* → `EvidenceRequested`.
  - `postFeedback(reqId, msgHash, uri)` — any active state; no state change.
  - Views: `getNegotiation`, `stateOf`, `coveredAmountOf`, `roundOf`, `policyOf`, `count`.
- **Events:** `ContractCreated`, `ContentCommitted`, `InsurerEngaged`, `ContractReady`, `AdjudicationRequested`, `RulingRequested`, `Ruled(reqId, requestId, decision, coveredAmount, rationaleHash, clauseRef, receiptId)`, `PolicyFlagged(reqId, clauseRef, standardRef)`, `PolicyInvalidated(reqId, clauseRef, standardRef)`, `EvidenceRequested`, `EvidenceSubmitted`, `Appealed(reqId, partyId, evidenceUri, round)`, `Accepted(reqId, partyId)`, `Settled(reqId, coveredAmount, feePerParty)`, `Deadlocked(reqId, rounds)`, `ProviderRefused(reqId, reasonHash)`, `Withdrawn`, `RulingTimedOut`, `FundsWithdrawn`.
- **Guards:** per-state `require`s; **adjudication only from `Ready`** (policy attached); party actions gated to `{providerAddr, insurerAddr}` (R11), `insurerEngage` insurer-only, `refuse` provider-only; `handleResponse` platform-only; appeals bounded to N (R6c); settle only after both accept; deterministic amount within `[0, benchmarkCap]`; CEI + `nonReentrant` on agent-firing entry points.
- Deployed to Somnia testnet (chain `50312`, RPC `https://api.infra.testnet.somnia.network/`); identity via `somnia-agent-kit` `AgentRegistry`.

### State machine

| From | Trigger | To |
|---|---|---|
| — | `createContract` (provider) | `Open` |
| `Open` | `insurerEngage` (insurer attaches policy) | `Ready` |
| `Ready` | `requestAdjudication` (fires agent) | `UnderReview` |
| `UnderReview` | `handleResponse`: `approve` (amount = `min(requested, cap)`) | `Approved` |
| `UnderReview` | `handleResponse`: `deny` | `Denied` |
| `UnderReview` | `handleResponse`: `need_more_evidence` | `EvidenceRequested` |
| `UnderReview` | `handleResponse`: relied-on clause non-compliant | `PolicyInvalidated` (terminal) |
| `UnderReview` | `Failed`/`TimedOut`, or `onRulingTimeout` | `EvidenceRequested` (retriable) |
| `EvidenceRequested` | `submitEvidence` (provider; re-fires) | `UnderReview` (`round++`) |
| `Approved`/`Denied` | `appeal` (new public evidence; `round < N`) | `UnderReview` (`round++`) |
| `Approved`/`Denied` | `appeal` at `round == N` without mutual accept | `Deadlocked` (terminal) |
| `Approved`/`Denied` | both parties `accept` then `settle` | `Settled` (terminal) |
| `Ready`..ruling | `refuse` (provider) | `ProviderRefused` (terminal) |
| any pre-terminal | `withdraw` (either party) | `Withdrawn` (terminal) |

`postFeedback` may be called in any active state without changing state. The agent fires on
`requestAdjudication` and again on every `appeal`/`submitEvidence`; the per-request fee is
charged on each execution (R9) and split 50/50 at settlement (R8).

**Agent arbitration mechanism (contract-native).** On `requestAdjudication` the contract
fires a native Somnia agent (`createRequest`), selecting by source type (R10). The payload
carries only the **de-identified extract + the insurer policy URL + the provider's public
evidence URLs + the requested amount** (never raw content, R4). The agent **reads the policy
criteria vs. the cited evidence**, returns `approve|deny|need_more_evidence` + rationale +
**clause ref** (+ price cap inputs), or flags a non-compliant clause; the platform calls
`handleResponse` back into the same contract. The covered amount on `approve` is computed by
the contract as `min(requested, benchmarkCap)` (R6a).

**Wallet abstraction (simulated ↔ real).** One signer interface, two impls (mock vs. real
testnet signer); app + contract-interaction code identical across modes.

**Web app — views.** *Overview*: claims + live status. *Create*: provider files (drug, de-id
justification → hash, evidence URLs, requested amount). *Maintain/detail*: timeline; current
ruling + **rationale + cited clause**; covered amount; round counter; accept/appeal/refuse/
settle gated by state + active profile; shows wallet + profile + mode. Insurer's detail view
exposes **attach-policy / engage**.

## 4. Deliverables

- `contracts/CoverageNegotiation.sol` (Hardhat) + tests + `deploy.ts` + `hardhat.config.ts` (50312).
- `src/wallet/` — pluggable signer (simulated + real) (R14).
- `src/agents/{provider-agent,payer-agent}.ts`, `src/orchestrator.ts`, `src/types/coverage.types.ts`, `src/index.ts` — submit txs, watch events; arbitration is contract-native.
- **Web app**: Overview / Create / Maintain; profile switcher + wallet/identity/mode; timeline, ruling + rationale + cited clause, covered amount, accept/appeal/refuse/settle; insurer engage/attach-policy.
- Off-chain content store + hash commitment + both-party verification.
- **Sample case** `demo-data/sample-case.md` (de-identified) + **fixtures**: a published **Part D exception-criteria** policy, **openFDA/DailyMed** label snippet, **NADAC + Cost Plus** price refs, and a **non-compliant policy** fixture (to demo `PolicyInvalidated`).
- Deployed testnet address in `.env.example` / README.
- **Deploy script** (`scripts/deploy-static.sh`) that builds the web app and publishes it to the HTTPS static host (R18); a recorded **live demo URL**. The flashy demo experience + integration seam are specified separately in **SPEC-0002**.

## 5. Test cases

- **T1 (R3,R4):** content/policy off-chain; `keccak256` == on-chain hash; no PHI/raw-ICD-10 on-chain or in the agent payload.
- **T2 (R2):** provider `createContract` emits `ContractCreated` w/ both addresses; self-claim accepted.
- **T3 (R5):** `requestAdjudication` reverts before `insurerEngage`; after engage → `Ready`; `InsurerEngaged` emitted.
- **T4 (R6,R6a,R9):** from `Ready`, adjudication fires the agent → `UnderReview`; `handleResponse` `approve` → `Approved` with `coveredAmount == min(requested, cap)` + rationale + clause ref; `deny` → `Denied` (amount 0); `need_more_evidence` → `EvidenceRequested`; `Failed`/`TimedOut` → `EvidenceRequested`.
- **T5 (R6b):** a relied-on clause contradicting the public standard fixture → `PolicyFlagged` + terminal `PolicyInvalidated`.
- **T6 (R6c):** `appeal` (with evidence) re-fires + `round++`; both `accept` → settleable; **N appeals w/o mutual accept → `Deadlocked`**; price-only/free-prose appeal rejected.
- **T7 (R7):** provider `refuse` from `Ready`/ruling → `ProviderRefused`; not callable by insurer.
- **T8 (R8):** after both accept, `settle` emits `Settled(coveredAmount, feePerParty)` w/ 50/50 split (marker).
- **T9 (R11,R12,R13):** registered addrs may act; **third wallet reverts** on every party action; reads open; single-wallet distinguishes by `partyId`; self-claim works; `insurerEngage` insurer-only, `refuse` provider-only.
- **T10 (guards):** invalid transitions revert; `handleResponse` reverts for non-platform caller.
- **T11 (R14):** full loop in **simulated** and **real** modes, same code path.
- **T12 (R15,R16,R17):** Overview live status; Create files; detail drives engage/adjudicate/accept/appeal/refuse/settle and shows evolving ruling + clause; timeline reconstructs from `eth_getLogs` + live subscription.

## 6. Pass / fail criteria

**PASS — all must hold:**
- [ ] Contract compiles, passes Hardhat tests, deploys to Somnia testnet (50312).
- [ ] T1–T10 pass in the suite; T11–T12 end-to-end.
- [ ] Insurer must attach policy before adjudication (R5); agent rules necessity with a **cited clause** (R6); covered amount is **deterministic** `min(requested, cap)` (R6a); a **non-compliant clause voids** the contract (R6b); appeal loop **terminates** (`Settled`/`Deadlocked`) (R6c); provider **refusal** records a distinct terminal (R7).
- [ ] Party actions gated to the two addresses; third wallet rejected; reads open (R11).
- [ ] Runs in **both** wallet modes; real mode produces a **real** native-agent ruling + receipt, fee on execution (R9).
- [ ] Website: file, engage/attach-policy, overview, ruling + rationale + clause, accept/appeal/refuse, settle (marker + fee split), profile switch, wallet/mode shown.
- [ ] De-identified `sample-case.md` + Part D / openFDA / NADAC / Cost Plus / non-compliant-policy fixtures drive the flow.

**FAIL — any triggers rejection:**
- Any PHI/raw-ICD-10/content (beyond hashes/refs/amounts/state) on-chain or in an agent payload.
- Adjudication runs without an attached policy; the covered amount is AI-chosen rather than `min(requested, cap)`; the appeal loop has no bounded termination.
- A non-compliant relied-on clause does **not** void the contract; or the agent silently overrides it.
- A non-party wallet mutates a claim, or reads are restricted; `handleResponse` accepts a non-platform caller; an invalid transition doesn't revert.
- The code works in only one wallet mode.

## 7. Out of scope (v0)

- **Real-PHI de-identification / redaction** — v0 is synthetic; production de-id is **v1**.
- **Private / tiered on-chain agent reasoning** — not possible on the public native agent today; a **future Somnia ask** (§8).
- **Autonomous policy-driven party agents** — each party loads a *policy* and auto-accepts/appeals as claims change — **MVP v1**.
- **Real token settlement / escrow transfer** — v0 settlement + fee split is an event marker; real transfer is v1.
- **Cost-sharing / copay / tiering, and patient-as-a-party** — v0's covered amount is the *full* reimbursement decided provider↔insurer on the patient's behalf; patient copay, plan cost-sharing %, tier logic, and the patient as an on-chain participant are **MVP v1**.
- **NADAC+dispensing-fee "payer-reimbursement mode"** — v0 caps at Cost Plus (neutral/fair); an insurer-realistic NADAC-based reimbursement basis is a **v1** configurable alternative.
- **Insurer non-engagement handling** beyond a basic keeper timeout (see §8); **app-level PHI gating of public feedback**; identity/KYC; agent accuracy eval; multi-tenant; subgraph; ZK; mobile UI.

## 8. Open questions

1. **RESOLVED (2026-05-27): Benchmark cap = Mark Cuban Cost Plus per-unit price × `quantity`** (neutral/fair); NADAC is the floor reference; NADAC+dispensing-fee is a v1 payer-mode. The request carries **`quantity`** (cap driver) + optional **`daysSupply`** (necessity context) — R2. — priority: resolved
2. **De-identified extract schema** — exact safe fields, and the re-identification guarantee for the combination. — priority: high
3. **Insurer non-engagement** — if the insurer never attaches a policy, does a keeper expire `Open` → `Withdrawn` after a deadline? — priority: medium
4. **N (round cap)** value and whether `Deadlocked` allows an off-chain human-escalation hook. — priority: medium
5. **Real-mode fee funding** — who funds the per-request fee at fire time (contract float vs. caller) before the 50/50 reconciliation. — priority: medium
6. **Public standard for R6b** — which source(s) are authoritative for "non-compliant" (openFDA/DailyMed label indications; specific guideline bodies)? — priority: medium
7. Ruling timeout window given Somnia callback latency. — priority: low

## 9. Superseded models (for reference)

- **Original (pre-2026-05-27):** agent returned `approve|deny|need_more_evidence` with a creation-time price **band**; either party could dispute/withdraw with **no address gating**; insurer-neutral initiation.
- **Interim price-arbiter rewrite (2026-05-27, superseded same day):** agent **chose** a covered amount; appeals were price-direction (`too_high|too_low`); states collapsed to `Priced`. Rejected per A-0003 (price-arbitration is a deterministic lookup, not AI-worthy) in favour of the necessity-arbiter model above.

The implementation on `spec1-implementation-v1` built to the original model and will be
regenerated to this spec.
