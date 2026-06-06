# SPEC-0008: Off-chain party copilots, agent chat view & per-party auto-mode

Status: Draft · Owner: tspugh · Date: 2026-06-06 · Builds on: [SPEC-0001](0001-mvp0-coverage-negotiation.md), [SPEC-0003](0003-token-flow-visibility.md), [SPEC-0004](0004-data-and-evidence-model.md), [SPEC-0006](0006-somnia-agent-platform-integration.md) · Anticipates the v1 "autonomous policy-driven party agents" deferred in [SPEC-0001 §7](0001-mvp0-coverage-negotiation.md)

> **Scope.** Adds a second AI layer to Curie — **off-chain party copilots** that act *on behalf of* the provider and the insurer — and a **conversational "agent view"** that becomes the primary surface, with the existing high-detail views demoted to an on-demand technical drawer. Copilots **decide** what to file/attach/appeal, **pull** de-identified case + policy facts through a **tools layer**, **narrate** in plain English, and **act only by signing the same contract transactions a human would**. Per-party **auto-mode** lets a side (the insurer by default) run the loop autonomously. **This spec does not touch the on-chain arbiter** (SPEC-0006) — the judge stays on-chain; the copilots are advocates.

> **Numbering note.** SPEC-0007 is in progress on a separate branch; this spec takes the next free durable number (0008) and does not depend on 0007.

---

## 1. Summary & user story

Curie today surfaces protocol detail **directly** — the Overview table, the Detail timeline, the evidence packet, the state machine. This spec inverts that: an **agent** mediates. Each party gets a copilot (LangGraph, off-chain TypeScript) that reads de-identified case data and the on-chain state through a controlled **tools layer**, explains in plain language what happened and why a request was approved/denied, and takes party actions on the operator's behalf — either with a human in the loop, or autonomously in **auto-mode**. The operator lives in a **chat view** of event-blurbs across all their cases and pops open the **technical drawer** only when they want the raw detail — the same relationship Claude Code has between its chat and its diff view.

The copilot's plain-text reasoning is **off-chain reasoning, deliberately distinct from the arbiter's on-chain reasoning**: the on-chain arbiter (SPEC-0006) rules and records the verdict on-chain; the off-chain copilot interprets, advises, and acts.

> As a **provider operator**, I want a copilot that watches all my coverage cases, tells me in plain English why each was approved or denied, and — when I ask, or under rules I set — files, appeals, and settles for me, so that I work the portfolio by conversation instead of reading state machines.
>
> As an **insurer operator**, I want to turn on **auto-mode** so my copilot engages new filings with the matching policy from my library and accepts or appeals per my standing rules, so that a full back-and-forth resolves in seconds on Somnia without me clicking through every step.
>
> As a **provider operator filing a case**, I want to describe a patient in plain language — *"open a case for this drug for this de-identified patient and send it to this insurer"* — and have my copilot resolve the required public-evidence URL, fill in the rest, and **either ask me for the one thing it's missing or file and then watch the insurer for me**, so that filing is a conversation, not a form.
>
> As a **demo viewer / judge**, I want to watch two AI advocates and an on-chain AI judge resolve a coverage dispute end-to-end — every action a real signed transaction finalizing sub-second — so that Somnia's speed is legible *in an agent setting*, not just on a benchmark slide.

---

## 2. Requirements

### 2.1 Architecture & the advocate/judge boundary

- **R1 (MUST — two AI layers, separated).** The system MUST keep two distinct AI layers: (a) the **on-chain arbiter** (SPEC-0006 LLM Inference agent — *the judge*), unchanged by this spec; and (b) **off-chain party copilots** (*the advocates*), added by this spec. A copilot MUST NOT rule, score, or substitute for the arbiter.
- **R2 (MUST — copilots act only via signed transactions).** A copilot effects protocol state **only** by submitting signed transactions through the existing client surface (`PartyAgent` / `CoverageNegotiationClient`). It MUST NOT introduce any off-chain side-channel that carries protocol state (a packet, ruling, settlement, or state transition) — consistent with [AGENTS.md](../../AGENTS.md) "No REST / no bypass." The copilot service is **orchestration glue, never a system of record**.
- **R3 (MUST — arbiter firewall).** Copilot code MUST NOT call `handleResponse`, MUST NOT call the arbiter platform's `createRequest`/`createAdvancedRequest`, and MUST NOT produce, derive, or shape ruling bytes the contract acts on. This preserves [SPEC-0006 R0/R0a](0006-somnia-agent-platform-integration.md) (the ruling's chain-of-custody runs `RulingRequested → createRequest → validators → handleResponse`, no detour). A copilot *may* call `requestAdjudication` (a party action that *triggers* the arbiter) but never participates in the ruling itself.
- **R4 (MUST — principled SDK carve-out, not a loophole).** SPEC-0006 R10's CI guard (fail if a non-`dev-*`/`eval-*` script imports `@anthropic-ai/sdk`) MUST be extended so the **copilot path** (`src/copilot/**`) is an allowed LLM-SDK consumer **only** under a static check asserting that no `src/copilot/**` module references `handleResponse`, the arbiter `agentId`, the platform address, or `createRequest`/`createAdvancedRequest` selectors. The carve-out MUST fail closed: a copilot module touching any arbiter-path symbol fails CI.
- **R5 (MUST — per-party identity scoping).** Each copilot instance is bound to exactly one party identity (`provider` **or** `insurer`) and MAY only invoke write-tools authorized for that party (mirrors [SPEC-0001 R11](0001-mvp0-coverage-negotiation.md) on-chain auth: `insurerEngage` insurer-only, `refuse` provider-only, etc.). A provider copilot attempting an insurer-only action MUST be refused at the tools layer **before** any transaction is signed.

### 2.2 Tools layer (the control & privacy boundary)

- **R6 (MUST — explicit read-tools).** The copilot reads the world only through named **read-tools**, each wrapping an existing capability:
  - `chain.getNegotiation(reqId)` / `chain.stateOf` / `chain.policyOf` / `chain.coveredAmountOf` (via `CoverageNegotiationClient` view calls),
  - `chain.events(filter)` / `chain.subscribe()` (historical + live, via the existing paged `getLogs` + `contract.on` path — [SPEC-0006 R48/R49](0006-somnia-agent-platform-integration.md)),
  - `cases.list()` / `cases.get(caseId)` — the de-identified patient-case mock DB (§2.6),
  - `policies.forLine(payerLine)` / `policies.get(policyId)` — the insurer policy library (§2.6),
  - `content.get(hash)` — de-identified justification/evidence/policy bodies from `ContentStore`,
  - `evidence.resolve(drug, indication)` — resolves the required public **evidence URL + prompt hint** for a drug/indication (§2.9; reuses `web/src/drugEvidenceMap.ts`).
- **R7 (MUST — explicit write-tools = party actions).** The copilot changes the world only through named **write-tools**, each a thin wrapper over a `PartyAgent` method and nothing else: `fileRequest`, `engage` (attach policy), `requestAdjudication`, `submitEvidence`, `appeal`, `accept`, `settle`, `refuse`, `postFeedback`, `withdraw`. No write-tool may exist for any operation outside this set.
- **R8 (MUST — tools layer is the PHI boundary).** Any write-tool argument or arbiter-bound value derived from case content MUST be reduced to a `keccak256` hash, an opaque ref, a public URL, or an amount **at the tools layer** (via `ContentStore`) before it crosses on-chain or into the arbiter payload. Free-text or de-identified clinical detail MUST NOT appear in a transaction or in an arbiter prompt. (Hard invariant — [SPEC-0001 R4](0001-mvp0-coverage-negotiation.md), [AGENTS.md Privacy](../../AGENTS.md).)
- **R9 (MUST — every tool call is observable).** Every read-tool and write-tool invocation emits a `tool:` narration event (§2.5) carrying the tool name, a short human-readable summary, and (for writes) the resulting tx hash + chain-state glyph. Raw tool I/O is available in the technical drawer but never in the default chat stream.
- **R10 (MUST — tools are typed and enumerable).** The tool set is a typed registry; adding a tool is a code change, and the registry is the single source the copilot's available actions are derived from (no ad-hoc capability reaches the model).
- **R11 (SHOULD — read-only by default).** A copilot MAY be configured read-only (Q&A + narration, no write-tools bound) for an `observer` profile or a "watch only" mode.

### 2.3 Copilot runtime (LangGraph, off-chain TS service)

- **R12 (MUST — LangGraph state graph).** Each copilot is a LangGraph (`@langchain/langgraph`, TypeScript) graph with the cycle: **perceive** (a chain event or operator prompt) → **retrieve** (read-tools) → **decide** (Claude) → **act** (a write-tool) **or ask** (human-in-the-loop interrupt) → **narrate**. State persists per party across the long-running session.
- **R13 (MUST — off-chain service host).** Copilots run in an **off-chain Node/TS service** (not in the SPA bundle). Party signing keys live in the **service environment** (`PRIVATE_KEY` / `PRIVATE_KEY_INSURER`), never in the static web bundle ([SPEC-0001 R18](0001-mvp0-coverage-negotiation.md) — no secrets shipped). The service reuses the existing `RealWallet` / `CoverageNegotiationClient` so simulated and real modes share one code path ([SPEC-0001 R14](0001-mvp0-coverage-negotiation.md)).
- **R14 (MUST — model is Claude).** The decide step uses Claude via LangGraph's Anthropic binding. The system prompt MUST instruct the copilot that it is an **advocate for one party**, MUST forbid emitting PHI, and MUST forbid claiming to be the arbiter.
- **R15 (MUST — human-in-the-loop in manual mode).** In manual mode, the graph MUST `interrupt` before any consequential write-tool (`fileRequest`, `engage`, `requestAdjudication`, `submitEvidence`, `appeal`, `accept`, `settle`, `refuse`, `withdraw`) and surface the proposed action + rationale to the operator for approve/edit/reject. `postFeedback` (no state change) MAY skip the interrupt.
- **R16 (MUST — operator Q&A).** The operator can ask the copilot free-text questions about the portfolio ("why was case 42 denied?", "which pending case is most likely to be approved?"). The copilot answers from read-tools + chain state, surfacing **summaries**, not raw packets. Answers cite the underlying event/receipt so the operator can open the drawer to verify.
- **R17 (MUST — narration stream to the SPA).** The service exposes a **read-only narration stream** the SPA consumes (the four-type event log — §2.5). This stream carries narration + tool metadata + tx-hash pointers **only** — never protocol state (which the SPA reads from chain) and never PHI. *This is a deliberate non-chain interface, proposed here per [AGENTS.md](../../AGENTS.md) ("propose any non-chain interface before building"): it is justified because narration is off-chain reasoning by nature and cannot live on-chain.* v0 delivery follows the existing dev-server-sink precedent ([SPEC-0006 R50](0006-somnia-agent-platform-integration.md) `/__log/tx`): a JSONL sink exposed via a dev-server endpoint (SSE or poll). (Transport choice is OQ-1.)
- **R18 (MUST — graceful degradation).** If the copilot service is down or the LLM call fails, the SPA MUST remain fully functional in **manual, copilot-free** mode (today's behavior). The copilot is additive; its absence never blocks a human operator.

### 2.4 Per-party auto-mode & standing rules

- **R19 (MUST — per-party auto toggle).** Auto-mode is a per-party toggle (provider auto on/off, insurer auto on/off, independently). The demo default is **insurer-auto on, provider manual**. Both-auto (agent-vs-agent) is supported.
- **R20 (MUST — standing rules drive auto decisions).** Each party has **standing rules**: (a) **structured floors** (form-based, machine-evaluated, inviolable) and (b) **plain-text preferences** (chat-to-copilot, encoded by the copilot with the structured floors as hard limits). Example insurer rule: *"auto-engage with the matching curated policy; auto-accept if covered ≥ 90% of requested; otherwise auto-appeal once with the strongest available evidence, then surface to me."*
- **R21 (MUST — guardrails on rule edits).** A moderation pass MUST evaluate every rule edit and reject rules that would violate protocol invariants or ethics floors (e.g., a rule that would submit PHI, a rule that instructs the copilot to fake or pre-empt the arbiter). Rejections surface a visible reason. (Design language from the sibling product's standing-rules guardrails; reference only.)
- **R22 (MUST — auto-mode respects all on-chain bounds).** Auto-mode MUST respect the contract's existing limits: the **N-round appeal cap** ([SPEC-0001 R6c](0001-mvp0-coverage-negotiation.md) → `Deadlocked`), the **state-machine guards**, and the **wallet balance pre-flight** for both signers ([SPEC-0006 R39](0006-somnia-agent-platform-integration.md)) before any payable action. An auto-copilot that would exceed the round cap stops and narrates instead of forcing a transaction.
- **R23 (MUST — kill-switch).** A visible **"stop auto"** control halts a party's auto-mode immediately; in-flight transactions already broadcast are not recalled, but no new write-tool fires after stop. Stopping is itself a narrated event.
- **R24 (MUST — auto-mode never bypasses the firewall).** Auto-mode obeys R3: it may `requestAdjudication`/`appeal` (triggering the arbiter) but never supplies the ruling. The ruling always comes from the on-chain arbiter.
- **R25 (SHOULD — bounded autonomy budget).** An auto session SHOULD carry a configurable per-case budget (max rounds, max STT spend) beyond the on-chain cap, so a runaway loop self-limits and narrates that it paused for operator input.

### 2.5 Agent chat view (the conversational surface)

- **R26 (MUST — new primary view).** Add an **Agent view** as a new top-level `View` in `web/src/App.tsx` (the existing discriminated-union router). It MAY be set as the landing view; Overview/Create/Detail/Network/Settings remain reachable.
- **R27 (MUST — portfolio-level stream across cases).** The Agent view shows one **chronological stream of event-blurbs across all of the active party's cases** (the "several cases → one agent view" inversion), not a single-case timeline. Cases are grouped/labeled client-side by `reqId` (and, where useful, by `(provider, insurer, payerLine)` — a derived grouping; the on-chain channel model in [`amendments/0006-relationship-channels-vs-per-case-negotiations.md`](../amendments/0006-relationship-channels-vs-per-case-negotiations.md) is **not** required by this spec).
- **R28 (MUST — four message types).** The stream renders exactly four message types: `agent` (plain-English reasoning), `chain` (a transaction, with chain-state glyph + abbreviated tx hash + explorer link), `tool` (an off-chain tool call), `user` (an operator prompt/intervention). Adding a fifth is a spec change.
- **R29 (MUST — chain-state glyphs + finality stamps).** Every `chain` blurb leads with a chain-state glyph (`◌` pending → `◐` mined → `●` final → `↩` reverted → `⊘` superseded) that transitions in place, and a `T+<elapsed>` stamp showing observed time-to-finality. Glyph is the signal; color is a hint.
- **R30 (MUST — technical drawer, on demand).** Each blurb has a "show technical" affordance that opens a **drawer** to that exact event's high-detail view, reusing the existing `Detail.tsx` / `Network.tsx` surfaces (the on-chain receipt, state transition, ruling verdict, evidence refs, tx monitor). The drawer is the Claude-Code-diff analogue: chat-primary, detail-on-demand. (Drawer vs. full toggle is OQ-2.)
- **R31 (MUST — plain-text rejection explanations).** When the arbiter denies or requests more evidence, the copilot MUST emit an `agent` blurb that explains the outcome in plain language and proposes a next action — this off-chain explanation is distinct from, and links to, the on-chain verdict (the `Ruled` event / SPEC-0006 §2.9 "AI Decision" panel).
- **R32 (MUST — input box for prompts & interventions).** A persistent input field accepts operator prompts (Q&A, R16) and interventions ("appeal that", "don't auto-accept under $4,000", "stop auto on this case"). Each becomes a `user` event the copilot acts on.
- **R33 (MUST — auto controls in-view).** The Agent view exposes the per-party auto toggle (R19), the standing-rules editor (R20), and the kill-switch (R23).
- **R34 (SHOULD — no PHI in the chat).** The chat stream renders summaries and refs; it MUST NOT render raw de-identified clinical bodies inline (those live behind the drawer/content fetch). Demo data is obviously synthetic.

### 2.6 Mock DB (policies + de-identified patient cases)

- **R35 (MUST — reuse existing fixtures as the mock DB).** The mock DB is the **existing in-repo synthetic fixtures**, exposed through read-tools (R6): insurer **policies** = `src/data/policies.ts` (`POLICY_LIBRARY`, `policiesForLine`, `getCuratedPolicy`); provider **patient cases** = `web/src/sampleCases/` + `demo-data/scenarios/<slug>/`. No new database service is required for v0.
- **R36 (MUST — synthetic & de-identified only).** Every case record exposed to a copilot MUST be synthetic and de-identified, and MUST pass the existing PHI loud-signature scanner ([SPEC-0004 R34](0004-data-and-evidence-model.md)). The copilot may *see* de-identified detail off-chain; R8 forbids it from emitting that detail on-chain or to the arbiter.
- **R37 (SHOULD — pluggable store interface).** The mock-DB read-tools sit behind a small typed interface (`CaseStore`, `PolicyStore`) so a real backing store (e.g. Supabase) could replace the fixtures later without changing copilot code. Backing the store with a real DB is **out of scope** for v0.

### 2.7 Somnia-speed surfacing

- **R38 (MUST — finality header).** The Agent view header MUST show the live Somnia block height and a rolling **observed** finality measurement (a live measurement of this session's transactions, not a hard-coded claim). Performance copy MUST cite Somnia's published figures; no invented TPS/finality numbers ([AGENTS.md "Sourced claims only"](../../AGENTS.md)).
- **R39 (MUST — speed visible in the loop).** With insurer-auto on, a full **file → engage → adjudicate → rule → (appeal → re-rule)\* → settle** sequence MUST render as real transactions finalizing live, each blurb carrying its `T+` stamp and glyph transition, so the "agent-speed" story is observable end-to-end in one screen.
- **R40 (SHOULD — ledger ticker).** A persistent bottom ticker MAY render one line per chain event (`T+<elapsed> <glyph> <summary> <hash>`) across all cases, as the shared "single source of truth" proof during a demo.

### 2.8 Privacy & compliance (hard)

- **R41 (MUST — no PHI on-chain or through the arbiter).** Restates the project invariant for this feature: nothing a copilot emits to a transaction or an arbiter payload may be PHI or de-identified clinical free-text — only hashes, refs, public URLs, amounts, state. Enforced at the tools layer (R8).
- **R42 (MUST — keys never in the bundle).** Party signing keys live only in the off-chain service environment (R13); the static web bundle ships no keys and no LLM API key.
- **R43 (MUST — auditable copilot actions).** Every copilot write-tool action is a normal on-chain transaction with the party's signature, so the on-chain trail already records *what* was done; the off-chain narration records *why*. The two are linked by tx hash in the chat (R28).
- **R44 (MUST — AGENTS.md alignment noted).** The spec MUST note that the live codebase uses **ethers v6 + custom `getLogs`/`contract.on`** rather than the viem/`@somnia-chain/reactivity` stack [AGENTS.md](../../AGENTS.md) prescribes; copilot tools MUST build on the existing `CoverageNegotiationClient`/`PartyAgent` abstractions (staying above that drift), and the discrepancy is flagged for a future reconciliation (not resolved here).

### 2.9 Provider intake, evidence resolution & completeness-gated filing

- **R45 (MUST — natural-language intake).** The provider copilot MUST accept a free-text request from the clinician (*"open a case for `<drug>` for this de-identified patient and send it to `<insurer>`"*) plus de-identified case facts, and extract the structured inputs `fileRequest`/`createContract` needs: drug (name → RxNorm/NDC), indication, de-identified justification (→ `ContentStore` hash, R8), requested amount, quantity, optional days supply, payer line, and insurer address. In manual mode the extracted fields are surfaced for confirmation before filing (R15).
- **R46 (MUST — evidence-URL + prompt-hint resolution tool).** Because a per-negotiation **evidence URL + prompt hint are mandatory contract inputs** ([SPEC-0006 R14/R16/R17](0006-somnia-agent-platform-integration.md)), the provider copilot MUST resolve them through the `evidence.resolve` tool (R6): first the curated `web/src/drugEvidenceMap.ts` (`evidenceForDrug`), then a search/derivation fallback for off-map drugs. The resolved URL MUST pass the liveness check ([SPEC-0006 R21](0006-somnia-agent-platform-integration.md)) before use; an unresolved or dead URL counts as "missing information" for R47.
- **R47 (MUST — completeness gate, exactly two outcomes).** Before filing, the copilot MUST validate that every required input (R45) is present **and** the evidence URL is resolved + live (R46), then take exactly one path:
  1. **Request more information** — if anything required is missing or unresolved, the copilot does **NOT** file; it asks the clinician a specific, minimal question for the missing item(s) and waits.
  2. **File & confirm** — if complete, the copilot files (`fileRequest`; gated on operator approval in manual mode per R15), confirms to the clinician with the `reqId` + tx hash, and begins auto-watch (R48).
  Filing MUST be gated on completeness — the copilot MUST NOT submit a request it knows is missing a required input. (Contract-side gates remain ground truth — SPEC-0006 R17.)
- **R48 (MUST — auto-watch after filing).** After a successful file, the provider copilot MUST subscribe to events for that `reqId` and narrate each subsequent update (insurer engaged, under review, ruled approve/deny/needs-more, accepted, settled, deadlocked) in plain English — **explicitly stating whether the request was accepted** and what (if anything) the clinician should do next — without the clinician having to poll.
- **R49 (MUST — insurer auto policy-match).** On receiving a new filing in auto-mode, the insurer copilot MUST select the policy appropriate to the case's **drug + payer line** from its policy library (`policiesForLine` / `getCuratedPolicy`, §2.6) and auto-engage (attach it). If no matching policy exists, the copilot MUST surface to the insurer operator (request a policy choice) rather than attach an inappropriate policy. This is the auto-engage step of §3.6 made explicit.

---

## 3. Technical documentation

### 3.1 On-chain / off-chain boundary

| Concern | On-chain (public, consensus-verified) | Off-chain (private, per-party) |
|---|---|---|
| Ruling / verdict | **Arbiter** (SPEC-0006 LLM Inference agent); `Ruled` / verdict events | — |
| Party actions | Signed txs: `createContract`, `insurerEngage`, `requestAdjudication`, `submitEvidence`, `appeal`, `accept`, `settle`, `refuse`, `withdraw` | **Copilot decides** which action to take, then signs it |
| Reasoning | Constrained decision token (+ optional receipt-sourced rationale, SPEC-0006 §2.8) | **Copilot narration** (`agent:` blurbs) — plain-English advocacy/explanation |
| Case content | Hashes / refs / amounts only | De-identified synthetic bodies (`ContentStore`, mock DB) |
| Narration stream | — | Read-only SSE/poll from the copilot service (narration + tx-pointers, never protocol state) |

**Boundary rule:** the copilot is allowed to *see* more off-chain than ever touches the chain; the tools layer (R8) is the membrane.

### 3.2 Two AI layers

```
            THE JUDGE  (on-chain, SPEC-0006)            THE ADVOCATES (off-chain, this spec)
            ───────────────────────────────            ────────────────────────────────────
            Somnia LLM Inference agent                  Provider copilot   Insurer copilot
            rules approve/deny/needs_more/                 │                   │
            policy_invalid; verdict on-chain               │ perceive ◀── chain events / prompts
                     ▲                                     │ retrieve ──▶ read-tools (chain, cases, policies, content)
                     │ requestAdjudication (party action)  │ decide   ──▶ Claude (advocate prompt)
                     │                                      │ act      ──▶ write-tools = PartyAgent signed txs
                     └──────────────────────────────────── │ narrate  ──▶ agent/tool/chain/user stream ──▶ SPA
                       (copilots TRIGGER the judge,         │
                        never SUPPLY the ruling — R3)       └── auto-mode: run the loop under standing rules
```

### 3.3 New off-chain module: `src/copilot/`

```
src/copilot/
├── graph.ts            # LangGraph state graph (perceive→retrieve→decide→act/ask→narrate)
├── runtime.ts          # per-party Copilot instance; binds identity, wallet, tools, mode
├── tools/
│   ├── registry.ts     # typed tool registry (R10); the only capability surface the model sees
│   ├── read.ts         # chain views/events, cases.*, policies.*, content.get (R6)
│   └── write.ts        # thin wrappers over PartyAgent methods (R7); enforces R5 scoping + R8 hashing
├── standing-rules.ts   # structured floors + plain-text encoding + guardrails (R20/R21)
├── narration.ts        # four-type event emitter → JSONL sink (R9/R17/R28)
├── auto.ts             # auto-mode loop: bounds, balance pre-flight, kill-switch, budget (R22/R23/R25)
├── firewall.test.ts    # asserts no arbiter-path symbol reachable from src/copilot/** (R3/R4)
└── server.ts           # service entrypoint; exposes the narration stream endpoint (R17)
```

Reuses, unchanged: `src/agents/party-agent.ts`, `src/contract/*`, `src/content/content.ts`, `src/data/policies.ts`, `src/types/coverage.types.ts`, `src/profiles/*`, `src/wallet/wallet.ts`.

### 3.4 Tool registry (shape sketch)

```ts
type ReadTool =
  | { name: "chain.getNegotiation"; run: (reqId: bigint) => Promise<NegotiationView> }
  | { name: "chain.events";         run: (f: EventFilter) => Promise<CoverageEvent[]> }
  | { name: "cases.list";           run: () => Promise<CaseSummary[]> }           // de-identified
  | { name: "cases.get";            run: (id: string) => Promise<CaseRecord> }    // de-identified
  | { name: "policies.forLine";     run: (line: PayerLine) => Promise<CuratedPolicy[]> }
  | { name: "content.get";          run: (hash: `0x${string}`) => Promise<string> };

type WriteTool =                    // each wraps exactly one PartyAgent method; R5 + R8 enforced inside
  | { name: "engage";  party: "insurer"; run: (reqId, policyId) => Promise<TxResult> }
  | { name: "appeal";  party: "provider" | "insurer"; run: (reqId, caseEvidenceId) => Promise<TxResult> }
  | /* fileRequest, requestAdjudication, submitEvidence, accept, settle, refuse, postFeedback, withdraw */;
```

`write.ts` for `engage`/`appeal`/etc. resolves any case body to a `ContentStore` hash **before** calling the `PartyAgent` method, so no free-text reaches the tx (R8).

### 3.5 Narration event (shape sketch)

```ts
type NarrationEvent = {
  ts: number;                                   // unix ms
  party: "provider" | "insurer";
  reqId?: bigint;                               // which case (omitted for portfolio-level)
  kind: "agent" | "chain" | "tool" | "user";   // R28 — exactly four
  text: string;                                 // plain English; NO PHI (R34/R41)
  tx?: { hash: `0x${string}`; glyph: "◌"|"◐"|"●"|"↩"|"⊘"; finalityMs?: number };  // chain
  tool?: { name: string };                      // tool
};
```

Delivered to the SPA over the narration stream (R17); the SPA already gets `chain` truth independently from on-chain events and reconciles by tx hash (R43).

### 3.6 Auto-mode loop (insurer default)

```
on ContractCreated(reqId) where insurer == me and autoMode(insurer):
  policy = policies.forLine(n.payerLine) → pick matching (standing rules)         [read]
  balancePreflight(insurerSigner, engageFee + appealReserve)                       [R22]
  engage(reqId, policy.id)                                                         [write → tx]
  requestAdjudication(reqId)                                                       [write → tx, triggers arbiter]
on Ruled(reqId, decision, coveredAmount):
  explain(decision) → agent blurb                                                  [narrate]
  if decision == Approve and coveredAmount ≥ rule.minCoverPct * requested: accept  [write → tx]
  elif rounds < cap and rule.appealOnce and have stronger evidence: appeal(...)     [write → tx]
  else: stop + surface to operator                                                 [R22/R23]
```

Provider side is symmetric when provider-auto is on; otherwise the human drives via the chat input (R32) with manual HITL interrupts (R15).

### 3.7 Web changes

- `web/src/App.tsx` — add `{ kind: "agent" }` to the `View` union; nav entry; optional default-landing.
- `web/src/views/Agent.tsx` (new) — portfolio stream + input box + auto controls (R26–R33).
- `web/src/components/AgentCompanion.tsx` (new) — the four-type message renderer + glyphs (R28/R29); precedent: `TxMonitor.tsx`.
- `web/src/components/TechnicalDrawer.tsx` (new) — wraps existing `Detail`/`Network` for the on-demand drawer (R30).
- `web/src/components/StandingRulesEditor.tsx` (new) — form + chat rule editing (R20/R21).
- `web/src/hooks/useNarration.ts` (new) — subscribes to the narration stream (R17), reconciles `chain` blurbs against on-chain events by tx hash.

### 3.8 Dependencies

- `@langchain/langgraph`, `@langchain/anthropic`, `@langchain/core` (TypeScript) — new, copilot path only.
- No change to the contract, the arbiter, or the deployed address.

### 3.9 Worked flow: NL intake → insurer auto-engage → narrated outcome

The central scenario, end to end. Outcome 1 (ask for missing info) and Outcome 2 (file + watch) are the two branches the clinician can see.

```
Provider operator (chat): "Open a case: Adalimumab for this de-identified patient
                           (plaque psoriasis), $5,200, qty 2, Part D, insurer = Aetna. Send it."
Provider copilot:
  user   ▶ "Open a case: Adalimumab…"                                              [R32/R45]
  tool   ▶ evidence.resolve("Adalimumab","plaque psoriasis")
            → { evidenceUrl: <DailyMed/FDA label>, promptHint }  (curated map)     [R46]
  tool   ▶ url-liveness(evidenceUrl) → 200 OK                                       [R46 / SPEC-0006 R21]
  agent  ▶ extracted: drug, justification(→hash), amount, qty, payerLine, insurer  [R45/R8]
  ── completeness gate ──                                                          [R47]
     • missing/unresolved → agent: "I need <X> before I can file." (STOP)  ......... Outcome 1
     • complete → (manual: interrupt for approval, R15) → write: fileRequest  ...... Outcome 2
  chain  ▶ ◌→◐→● ContractCreated(reqId)   T+0.4s                                    [R28/R29]
  agent  ▶ "Filed case #reqId to Aetna. I'll watch for their response."            [R48]

Insurer copilot (auto-mode on):
  perceive ◀ ContractCreated(reqId) where insurer == me                            [R19]
  tool   ▶ policies.forLine(PartD) → pick Adalimumab specialty-tier policy         [R49]
  write  ▶ engage(reqId, policyId)        → chain ●                                [R7]
  write  ▶ requestAdjudication(reqId)     → chain ●  (TRIGGERS on-chain arbiter)   [R3/R24]

On-chain arbiter (SPEC-0006):  rules → Ruled(reqId, decision, coveredAmount)       [the judge]

Both copilots:
  agent  ▶ explain the ruling in plain English; state whether it was accepted      [R31/R48]
  (standing rules / operator) → accept | appeal | settle   (bounded by R22)        [R20/R22]
```

If the provider copilot can't resolve a live evidence URL (or any required field is missing), it stops at the gate and asks — it never files an incomplete request (R47).

---

## 4. Deliverables

- `src/copilot/` — LangGraph runtime, tool registry (read + write), standing-rules engine, narration emitter, auto-mode loop, service entrypoint (§3.3).
- `src/copilot/firewall.test.ts` + the extended SPEC-0006 R10 CI check (R3/R4).
- `CaseStore` / `PolicyStore` read-tool interfaces over existing fixtures (R35/R37).
- Evidence-resolution tool (`evidence.resolve`) over `web/src/drugEvidenceMap.ts` + a search fallback, with the SPEC-0006 R21 liveness check wired in (R46); NL-intake extraction + the completeness gate (R45/R47).
- `web/src/views/Agent.tsx` + `AgentCompanion`, `TechnicalDrawer`, `StandingRulesEditor` components + `useNarration` hook (§3.7).
- Narration-stream endpoint (dev-server sink/SSE per R17) (OQ-1).
- Per-party auto toggle, kill-switch, and standing-rules UI (R19/R23/R33).
- A demo runbook section: start the copilot service, set keys server-side, run the insurer-auto loop.
- Fixtures: at least one provider patient-case set + matching insurer policy wired so insurer-auto resolves a full loop (reusing R18's six examples / `demo-data/scenarios/`).
- `docs/specs/README.md` entry for SPEC-0008.

---

## 5. Test cases

- **T1 (R3,R4):** static/firewall test — no `src/copilot/**` module references `handleResponse`, arbiter `agentId`, platform address, or `createRequest`; CI fails if it does.
- **T2 (R8,R41):** a write-tool given case free-text emits a transaction whose calldata contains only the `keccak256` hash/ref/amount — never the free-text; an arbiter trigger carries no PHI. Loud-signature scan ([SPEC-0004 R34](0004-data-and-evidence-model.md)) passes on everything the copilot emits.
- **T3 (R5):** a provider copilot invoking `engage` (insurer-only) is refused at the tools layer with no tx signed; an insurer copilot invoking `refuse` (provider-only) likewise.
- **T4 (R15):** in manual mode the graph interrupts before `appeal`/`accept`/`settle`/etc.; operator approve → tx fires; reject → no tx; `postFeedback` does not interrupt.
- **T5 (R16):** "why was case N denied?" returns a plain-English answer sourced from the `Ruled` event + read-tools, with a drawer link; no raw packet dumped.
- **T6 (R19,R39):** insurer-auto on → on a new filing the copilot engages with the matching policy, requests adjudication, and on `Approve ≥ threshold` accepts and settles — a full loop of real txs, narrated.
- **T7 (R22):** auto-mode honors the N-round cap (stops/narrates at the cap instead of forcing a tx) and the both-signer balance pre-flight (blocks a payable action on shortfall with the SPEC-0006 R43-style message).
- **T8 (R23):** "stop auto" halts new write-tools immediately; the stop is narrated; in-flight broadcast txs are not double-issued.
- **T9 (R21):** a standing rule that would emit PHI, or instruct the copilot to supply a ruling, is rejected with a visible reason.
- **T10 (R28,R29,R30):** the stream renders only the four message types; `chain` blurbs show glyph transitions `◌→◐→●` and `T+` stamps; "show technical" opens the drawer to the correct event.
- **T11 (R18):** with the copilot service stopped, the SPA still files/engages/adjudicates/settles in manual mode (today's path) — copilot absence never blocks.
- **T12 (R13,R14, parity):** the same copilot loop runs in simulated and real modes via one code path; keys are read from the service env, never the bundle.
- **T13 (both-auto, R24):** with both parties auto, a dispute (`Deny → appeal → Approve`) resolves with every ruling originating from the on-chain arbiter (a `Ruled` paired to a platform `RequestCreated` per [SPEC-0006 R22](0006-somnia-agent-platform-integration.md)) — no copilot-supplied ruling.
- **T14 (R46):** `evidence.resolve` returns a live URL + prompt hint for a curated drug; for an off-map drug it uses the fallback, and an unresolved/dead URL is flagged missing — a dead URL never reaches `fileRequest`.
- **T15 (R45,R47):** completeness gate — a request missing the amount (or with an unresolved evidence URL) makes the copilot ask the clinician and **not** file (Outcome 1); a complete request files and confirms with the `reqId` (Outcome 2).
- **T16 (R48):** after filing, the provider copilot narrates the insurer engage + arbiter ruling + acceptance without operator polling, stating plainly whether it was accepted.
- **T17 (R49):** insurer auto-mode attaches the policy matching the case's drug + payer line; with no matching policy it surfaces to the operator instead of attaching a wrong one.

---

## 6. Pass / fail criteria

**PASS — all must hold:**
- [ ] Two AI layers exist and are separated; copilots never rule (R1) and act only via signed txs (R2).
- [ ] Firewall holds: T1 green; the SPEC-0006 R10 carve-out is scoped and fails closed (R3/R4).
- [ ] PHI never leaves the tools layer: T2 green; loud-signature scan clean on all copilot-emitted values (R8/R41).
- [ ] Per-party scoping enforced before signing (R5/T3).
- [ ] Manual mode interrupts before consequential actions; operator approve/reject works (R15/T4).
- [ ] Operator Q&A answers from read-tools with drawer links, no packet dump (R16/T5).
- [ ] Insurer-auto resolves a full file→…→settle loop of real txs, narrated, finalizing live (R19/R39/T6).
- [ ] Provider copilot does NL intake, resolves a live evidence URL + prompt hint, and either asks for the missing piece (Outcome 1) or files + auto-watches (Outcome 2) — filing gated on completeness (R45–R48/T14–T16).
- [ ] Insurer auto-mode attaches the policy matching the drug + payer line, or surfaces on no match (R49/T17).
- [ ] Auto-mode respects the N-round cap, balance pre-flight, and kill-switch (R22/R23/T7/T8).
- [ ] Rule guardrails reject PHI-emitting / arbiter-faking rules (R21/T9).
- [ ] Agent view renders exactly four message types with glyphs + finality stamps + working technical drawer (R28–R30/T10).
- [ ] SPA fully functional with the copilot service down (R18/T11).
- [ ] One code path across simulated + real; keys server-side only (R13/T12).
- [ ] Mock DB = existing synthetic fixtures, de-identified, behind read-tools (R35/R36).

**FAIL — any triggers rejection:**
- A copilot calls `handleResponse`, supplies/derives ruling bytes, or otherwise participates in the arbiter ruling (R3) — including under auto-mode (R24).
- Any PHI or de-identified clinical free-text appears in a transaction, an arbiter payload, the chat stream, or the static bundle (R8/R34/R41/R42).
- The copilot reaches a capability not in the typed tool registry, or acts outside its party scope (R5/R10).
- A copilot files a request missing a required input — e.g. no resolved/live evidence URL — instead of asking the clinician (R46/R47); or the insurer copilot auto-attaches a non-matching policy instead of surfacing on no match (R49).
- Auto-mode exceeds the on-chain round cap, skips the balance pre-flight, or ignores the kill-switch (R22/R23).
- A signing key or LLM API key ships in the web bundle (R42).
- The copilot service being down blocks the manual flow (R18).
- A fifth chat message type is added without a spec change (R28).

---

## 7. Out of scope (v0 of this feature)

- **On-chain relationship channels** (the two-tier `Channel`/`Case` model in [`amendments/0006-relationship-channels-vs-per-case-negotiations.md`](../amendments/0006-relationship-channels-vs-per-case-negotiations.md)) — the agent view groups cases client-side; the contract change is a separate spec.
- **A real backing database** (Supabase/Postgres) for the mock DB — v0 uses in-repo synthetic fixtures behind a pluggable interface (R37).
- **Changing the arbiter** — SPEC-0006 owns the on-chain judge; this spec does not modify it.
- **Production de-identification / real PHI** — synthetic only (project-wide invariant).
- **Multi-tenant copilot hosting, auth/KYC, copilot accuracy evaluation, mobile layout** — later.
- **Migrating the codebase from ethers→viem/reactivity** per AGENTS.md — flagged (R44), not done here.
- **Copilots negotiating price** — the covered amount stays deterministic ([SPEC-0001 R6a](0001-mvp0-coverage-negotiation.md)); copilots advocate on necessity/evidence, not price.

## 8. Open questions

1. **OQ-1 (narration transport) — priority: high.** Dev-server JSONL sink + SSE (matches SPEC-0006 R50 precedent, simplest for the static-SPA demo) vs. a small standalone SSE/WebSocket service vs. poll. The static-deploy story (no dev server in prod) needs a host for the endpoint — decide for v0 demo vs. production.
2. **OQ-2 (drawer vs. toggle) — priority: medium.** Side-drawer that overlays the chat (Claude-Code-diff style) vs. a full agent/technical view toggle vs. both. Affects layout but not data.
3. **OQ-3 (default landing) — priority: low.** Should the Agent view replace Overview as the default landing, or sit beside it?
4. **OQ-4 (rule guardrail engine) — priority: medium.** Is the guardrail a deterministic rule-linter, a second LLM pass, or both? Where does it run (service-side, before any rule is persisted)?
5. **OQ-5 (both-auto pacing) — priority: medium.** In agent-vs-agent mode, do copilots act on event triggers only, or on a tick/turn cadence to keep the demo legible? Any artificial delay to make finality visible, or rely on real latency?
6. **OQ-6 (memory) — priority: low.** Per-party copilot working memory across sessions — in-service only (ephemeral) for v0, or persisted? Memory never goes on-chain regardless.
