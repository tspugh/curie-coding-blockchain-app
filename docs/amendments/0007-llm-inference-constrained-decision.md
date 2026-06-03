# Amendment 0007 — Two-agent evidence-grounded ruling: Parse-Website scrape → LLM-Inference constrained decision, with receipt-sourced reasoning

**Status:** Proposed · **Owner:** tspugh · **Date:** 2026-06-03 ·
**Affects:** SPEC-0006 §2.4/§2.8/§3.6/§3.10, SPEC-0001 R6/R6a/R6b/R10, SPEC-0004.1 R1/R2/R4
**Supersedes:** the single `ExtractANumber` payload and the 10-tuple
`handleResponse` decode carried forward from Amendment 0006.

## Context

SPEC-0006 chose **LLM Inference** (`agentId 12847293847561029384`, R-OPEN-1/2
resolved 2026-06-03) for adjudication. Three facts from the live Somnia docs
(`https://docs.somnia.network/agents/base-agents/llm-inference` +
`.../invoking-agents/receipts`) shape the design:

1. **`inferString(prompt, system, chainOfThought, allowedValues)` returns one
   string.** A non-empty `allowedValues` constrains the output to exactly one of
   those tokens. It cannot also carry prices or free-text rationale.
2. **Plain LLM Inference does not browse.** To ground a ruling in an actual FDA
   label / Medicaid policy / clinical guideline page, the page must either be
   scraped by the **LLM Parse Website** agent (`12875401142070969085`) or fed in
   as pre-fetched context. Medicaid coverage in particular is **evidence-driven,
   not an ICD-10-code lookup** — the arbiter must reason over the policy text +
   the cited evidence, so the evidence must reach the model.
3. **Receipts carry the real reasoning.** Every agent call produces a receipt
   with a `reasoning` step (the model's chain-of-thought) plus
   `http_request`/`http_response`/`value_extracted` steps, retrievable by
   `requestId` at `https://receipts.testnet.agents.somnia.host?requestId=<id>`.
   So the *actual* model reasoning is recoverable off-chain without a second
   inference call and without on-chain parsing.

## Decision

**Adjudication runs as two sequential agent calls — scrape, then decide —
coordinated by a phase field on the negotiation.**

### 1. Phase 1: LLM Parse Website scrapes the evidence (`agentPhase = Scraping`)

`requestAdjudication` fires **LLM Parse Website** (`12875401142070969085`,
`ExtractString` selector `0xc2dd1a7a`) against the per-negotiation
`agentEvidenceUrl` (SPEC-0006 R14), extracting the indication / coverage-relevant
text. `requestAdjudication` is `payable` and collects the agent fee for **both**
calls up front (scrape fee + decide fee); the decide fee is held by the contract
and spent when phase 2 fires. State → `UnderReview`. The scrape `requestId` is
mapped to the negotiation with `phase = Scraping`.

### 2. Phase 2: LLM Inference decides (`agentPhase = Deciding`)

The scrape `handleResponse` decodes the extracted evidence string, then fires
**LLM Inference** (`12847293847561029384`,
`inferString(string,string,bool,string[])` selector `0xfe7ca098`) with:

```
chainOfThought = true                  // reasoning captured in the receipt
allowedValues  = ["approve","deny","needs_more_info","policy_invalid"]
prompt         = built from { scraped evidence, agentPromptHint, policy clauses }
system         = necessity-arbiter rubric (evidence-grounded; NOT ICD-10 lookup)
```

`chainOfThought = true` does not change the on-chain `response` (still one
constrained token) — it enriches the **receipt's** `reasoning` step. The decision
`requestId` is mapped with `phase = Deciding`.

### 3. Decision decode + state transition

The decision `handleResponse` decodes the single string token and maps it:

| Token | `Decision` | Route |
|---|---|---|
| `"approve"` | `Approve` | `Approved`, `coveredAmount = min(requested, benchmarkUnitPrice × quantity)` |
| `"deny"` | `Deny` | `Denied`, `coveredAmount = 0` |
| `"needs_more_info"` | `NeedMoreEvidence` | `EvidenceRequested` (retriable) |
| `"policy_invalid"` | `PolicyInvalid` | `PolicyInvalidated` (R6b, narrowed by A-0005) |
| unknown / empty | — | `EvidenceRequested` (defensive) |

Either phase's `Failed`/`TimedOut`/empty status routes to `EvidenceRequested` and
refunds any held decide-phase fee (R9: never trap caller ETH).

### 4. Deterministic cap from a curated benchmark (amends SPEC-0001 R6a)

The covered amount stays deterministic and **not AI-chosen**. The benchmark unit
price is **curated, not agent-supplied**: `createContract` accepts a
`uint256 benchmarkUnitPrice` (wei) sourced client-side from the curated
`web/src/drugEvidenceMap.ts` / `src/data` price table (R16/R18). On `Approve`,
`coveredAmount = benchmarkUnitPrice == 0 ? requestedAmount : min(requestedAmount, benchmarkUnitPrice × quantity)`.
The agent's former `costPlusUnitPrice`/`nadacUnitPrice` outputs are removed.

### 5. Real reasoning via receipts + on-chain hash commit

The actual model reasoning lives in the LLM Inference receipt. After the decision
`handleResponse` finalizes the ruling on-chain, an off-chain **keeper** (or the
UI) fetches the receipt by the decision `requestId`, then calls:

```solidity
function commitRationale(
    uint256 reqId,
    string  calldata rationale,        // capped at 4096 chars (R26)
    string  calldata clauseReference,
    string  calldata standardReference
) external onlyKeeper;
```

`commitRationale` stores `rationaleHash = keccak256(rationale)` and emits
`RulingRationale(reqId, decisionRequestId, decision, rationale, clauseReference, standardReference)`.
**It MUST NOT mutate any ruling, escrow, or state-machine field** — the decision,
`coveredAmount`, and state transition were finalized by the agent's callback
*before* any keeper runs. This is what keeps it SPEC-0006 R0-compliant: the
keeper transcribes already-produced reasoning; it does not compute or shape the
ruling. **Somnia's receipt (keyed by `requestId`) is the canonical record;** the
on-chain hash is tamper-evidence for the committed text. `commitRationale` is
keeper/owner-gated; a UI that wants ground truth fetches the receipt directly.

## Consequences

- **Two `createRequest` calls + two callbacks per adjudication round.**
  `handleResponse` becomes a phase dispatcher keyed by a per-request phase map.
  Bounded to exactly two phases; each has a clean `EvidenceRequested` failure
  route.
- **Evidence-grounded, Medicaid-capable.** The decision reasons over scraped
  policy/evidence text, not an ICD-10 code — the requirement the user flagged for
  Medicaid. The scrape receipt (`http_request`/`http_response`) proves what was
  read.
- **`requestAdjudication` fee doubles** (scrape + decide); it collects both up
  front and refunds overpayment.
- **`Ruled` ABI loses the agent price fields**; `coveredAmount` + curated
  benchmark stay. `scripts/check-ruling-abi.ts` (R12) re-pins to BOTH agent
  selectors (`0xc2dd1a7a` scrape, `0xfe7ca098` decide) + the single-string
  decision decode.
- **Real reasoning, not templated** — supersedes the earlier templated-rationale
  proposal entirely.
- **One new off-chain actor (keeper) for `commitRationale`** — narrow,
  ruling-independent, R0-compliant. Receipts remain canonical if the keeper is
  absent.

## Rollback

If the two-call flow proves too complex for the demo timeline, fall back to a
single LLM Inference call with the evidence **pre-fetched off-chain** and passed
in the prompt (the considered V0-simplest option), keeping the decision
mechanism + receipts unchanged.
