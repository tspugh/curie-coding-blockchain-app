# Chain resource: Somnia native Agents

> **One line:** a Somnia smart contract can call out to an **LLM or API "agent"**, and Somnia's validators reach
> **consensus on the result** — so the answer is verifiable and usable on-chain.
>
> Upstream: [agents overview](https://docs.somnia.network/agents/readme.md) ·
> [LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference.md) ·
> [JSON API Request](https://docs.somnia.network/agents/base-agents/json-api-request.md) ·
> [LLM Parse Website](https://docs.somnia.network/agents/base-agents/llm-parse-website.md) ·
> [invoking from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity.md) ·
> [receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md) ·
> [custom consensus](https://docs.somnia.network/agents/invoking-agents/custom-consensus.md) ·
> [gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md). Fetched 2026-05-20.
> Re-verified live 2026-05-21: the **overview**, **LLM Inference**, **LLM Parse Website**, **JSON-API-Request**, and
> **gas-fees** pages — every quoted consensus/receipt phrase, function signature, and figure below is unchanged
> upstream; the two flagged gaps below remain genuinely absent from those pages.
> **Overview page re-verified live 2026-05-23** (sharpened soft-404 rule — real body, not just HTTP `200`; it was the
> one agents-section page still on the 2026-05-21 check, every other having been re-swept 2026-05-22). It renders real
> content and is **un-drifted**: the consensus quotes ("a decentralized subset of the Somnia network nodes", "only when
> a majority of nodes reach consensus on the result") and the invocation quote ("the interface and schema of each Agent
> closely follows the standard Solidity contract ABI") all match verbatim. **One precision improvement:** the AI-engineer
> section's receipt summary had carried a bolded *gloss* ("only the final result is consensus-bound") where the overview
> states a quotable sentence — promoted to upstream verbatim **"The final result is what validators reach consensus on"**
> + **"Receipt steps are subjective"**, which (unlike the gloss) attributes the consensus to **validators**.
> Deepened 2026-05-22 from the previously-cited-but-unread **receipts** and **from-Solidity** pages (fetched live): the
> dedicated [receipt section](#the-receipt-the-auditable-why--and-where-it-actually-lives) now sources the receipt
> structure, the consensus-binds-the-result-not-the-steps boundary, the off-chain/centralized receipt store, the
> canonical `Response` struct, and the platform-contract addresses directly, rather than only via the overview's
> one-line summary.
> Deepened again 2026-05-22 from the **[quickstart](https://docs.somnia.network/agents/invoking-agents/quickstart.md)**
> page — the last cited-but-unread agents page (fetched live, real content). It names the platform contract
> (`SomniaAgents`), **independently corroborates** both its addresses and the chain IDs `5031`/`50312`, and confirms
> there is **no non-Solidity invocation path** — the web app is a UI over the same contract.
> **Economics re-verified live 2026-05-22** under the sharpened soft-404 rule (real body, not just HTTP `200`): the
> highest-consequence cluster in this folder — the agent-invocation **deposit economics** that feed the per-claim cost
> model in [`tokenomics-and-gas.md`](tokenomics-and-gas.md) — was the staler of the re-checked clusters (last verified
> 2026-05-21, a day behind the oracle/consensus/reactivity re-checks). The [gas-fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)
> deposit table (`minPerAgentDeposit` `0.01`; per-agent `0.03`/`0.07`/`0.10`; worked `msg.value` `0.12`/`0.24`/`0.33` SOMI;
> `getRequestDeposit()`-floor time-out footgun; `defaultTimeout` 15 min; `perMember = median(executionCosts)`;
> `receive()`/`NativeTransferFailed`), the [LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference.md)
> four-method surface + `inferString` signature + `inferToolsChat` tuple, and the
> [custom-consensus](https://docs.somnia.network/agents/invoking-agents/custom-consensus.md) Majority/Threshold definitions +
> `ConsensusType` enum (`Majority`=0, `Threshold`=1) + "3 of 5" default + median/XOR aggregations all **match verbatim** —
> no figure has drifted. The two flagged gaps below (JSON-API caveats; expected inference latency) remain genuinely absent.
> **External-data base agents re-verified live 2026-05-22** under the sharpened soft-404 rule — these two pages
> ([JSON API Request](https://docs.somnia.network/agents/base-agents/json-api-request.md),
> [LLM Parse Website](https://docs.somnia.network/agents/base-agents/llm-parse-website.md)) were the staler sub-surface of
> this otherwise-fresh cluster (last checked 2026-05-21, a day behind the economics re-check). Both render real content
> and **match verbatim** — all six JSON `fetch*` signatures + the `42000.50`/`decimals=8`→`4200050000000` example, and the
> LLM-Parse `ExtractString`/`ExtractANumber` signatures + `resolveUrl`/`numPages`-cap/clamp-to-0/safe-integer behaviour.
> Two captures: (1) the JSON-API HTTP-method/auth/size/determinism caveat gap is **re-confirmed absent 2026-05-22** —
> still a genuine upstream gap, not ours; and (2) the LLM-Parse page carries a concrete **agent ID `12875401142070969085`**
> and the clarifying contrast *"Unlike the JSON API Request agent, this agent can handle HTML pages"* — both newly captured
> below (the article previously had no agent ID, the datum the quickstart explicitly lacks).
>
> Map: [chain-resources](../README.md) · Glossary: [Agent (two senses)](../GLOSSARY.md#a) · Roadmap: [`../../../ROADMAP.md`](../../../ROADMAP.md)

## For the AI engineer: what's actually new here

You already know how to call an LLM. The novel part is **trust**: normally an LLM call is a black box you have to
believe. Somnia native agents make the call **deterministic** (fixed seed + controlled temperature so identical input
→ identical output) and run it across "a decentralized subset of the Somnia network nodes"; the run is valid "only
when a majority of nodes reach consensus on the result"
([overview](https://docs.somnia.network/agents/readme.md)). That converts an LLM output into something a contract — and
an auditor — can rely on without trusting any single operator.

But forcing byte-identical determinism is not the only option, and for free-form inference it can be brittle. Somnia
also exposes a **Threshold** consensus mode that finalises on *N successful responses regardless of whether they agree*
and hands every response to your callback to aggregate — see [*When responses won't match*](#when-responses-wont-match-majority-vs-threshold-consensus)
below. Which mode you pick is the real determinism decision for an AI engineer here.

A run also produces a **receipt**: a "signed manifest of intermediate computation steps" (think CI build log).
Upstream draws the trust boundary in one line — **"The final result is what validators reach consensus on"**, while
**"Receipt steps are subjective"** and "may vary slightly between nodes"
([overview](https://docs.somnia.network/agents/readme.md)). So you get auditability of the *output*, not a guarantee
that two nodes thought identically along the way. (The dedicated [receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md)
page states the same boundary in its own words — see [the receipt section](#the-receipt-the-auditable-why--and-where-it-actually-lives) below.)

## For the blockchain dev: how a contract calls one

Agents are invoked over **HTTP POST with ABI-encoded inputs/outputs**, and "the interface and schema of each Agent
closely follows the standard Solidity contract ABI" — so you call them with familiar libraries (viem, ethers), no
special tooling ([overview](https://docs.somnia.network/agents/readme.md)). The single entry point is the platform
contract, named **`SomniaAgents`** in the
[quickstart](https://docs.somnia.network/agents/invoking-agents/quickstart.md), at testnet
`0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` (chain `50312`) / mainnet `0x5E5205CF39E766118C01636bED000A54D93163E6`
(chain `5031`) — addresses and chain IDs the quickstart corroborates against network-info and the from-Solidity page.
Crucially, the quickstart states **"All agent invocations go through the Solidity platform contract — including calls
made from the web app"** ([quickstart](https://docs.somnia.network/agents/invoking-agents/quickstart.md)): there is **no
non-Solidity invocation path** — the web app is a UI over this contract, so for V1 there is no shortcut around
calling it from our negotiation/settlement contract. Addresses may still move pre-GA.

### The LLM Inference agent surface

Four methods ([LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference.md)):

| Method | Purpose |
|---|---|
| `inferString` | Single-turn inference returning text |
| `inferNumber` | Inference extracting an integer, clamped to `[minValue, maxValue]` |
| `inferChat` | Multi-turn conversational inference with message history |
| `inferToolsChat` | Inference with tool use — **MCP servers and on-chain tools** |

Signature quoted upstream:

```solidity
function inferString(string prompt, string system, bool chainOfThought, string[] allowedValues)
    returns (string response)
```

`inferToolsChat` returns a tool-use protocol:

```solidity
returns (
    string finishReason,
    string response,
    string[] updatedRoles,
    string[] updatedMessages,
    string[] pendingToolCallIds,
    bytes[] pendingToolCalls
)
```

- `finishReason == "stop"` → `response` is the final answer.
- `finishReason == "tool_calls"` → `pendingToolCalls` holds ABI-encoded calldata (selector + args) the contract must
  execute, then resume the loop with results appended.

### The other two base agents: JSON API Request & LLM Parse Website

`LLM Inference` is one of **three** documented base agents; the deposit table below prices all three. The other two
fetch *external* data, which is what makes them interesting to us as auditable, on-chain evidence sources.

**JSON API Request** — "Fetches JSON data from any public API endpoint and extracts specific values using a selector
path… the fundamental building block for creating on-chain oracles"
([JSON API Request](https://docs.somnia.network/agents/base-agents/json-api-request.md)). Six typed fetchers, each
taking a URL and a dot-notation `selector` (e.g. `data.price`, `items[0].name`):

| Method | Returns |
|---|---|
| `fetchString(string url, string selector)` | `string` |
| `fetchBool(string url, string selector)` | `bool` |
| `fetchUint(string url, string selector, uint8 decimals)` | `uint256` |
| `fetchInt(string url, string selector, uint8 decimals)` | `int256` |
| `fetchStringArray(string url, string selector)` | `string[]` |
| `fetchUintArray(string url, string selector, uint8 decimals)` | `uint256[]` |

The `decimals` arg scales the value by `10^decimals` so a float can be carried as an integer — `42000.50` with
`decimals = 8` returns `4200050000000`
([JSON API Request](https://docs.somnia.network/agents/base-agents/json-api-request.md)). ⚠️ Upstream says "any public
API endpoint" but documents **no** HTTP-method, response-size, determinism, or auth/header caveats — **re-confirmed
absent against the live page 2026-05-22** (also 2026-05-21). Treat those as genuine gaps and verify empirically before
relying on non-`GET` calls, authenticated endpoints, or large payloads.

**LLM Parse Website** — "Search a domain (or directly scrape a URL) and extract structured data using AI" via "a real
web browser," aimed at "on-chain callers that need trustless, auditable web extraction"; upstream frames it against the
sibling agent — *"Unlike the JSON API Request agent, this agent can handle HTML pages"*
([LLM Parse Website](https://docs.somnia.network/agents/base-agents/llm-parse-website.md)). The page is also the one
base-agent doc carrying a concrete **agent ID** (`12875401142070969085`) alongside the platform addresses (testnet
`0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`, mainnet `0x5E5205CF39E766118C01636bED000A54D93163E6`) — the agent ID the
[quickstart](https://docs.somnia.network/agents/invoking-agents/quickstart.md) explicitly lacks (re-verified live
2026-05-22). Two extractors:

```solidity
function ExtractString(string key, string description, string[] options, string prompt,
                       string url, bool resolveUrl, uint8 numPages) returns (string)
function ExtractANumber(string key, string description, uint256 min, uint256 max, string prompt,
                        string url, bool resolveUrl, uint8 numPages) returns (uint256)
```

`resolveUrl = false` scrapes the URL directly and **caps `numPages` at 1**; `true` searches the domain. `ExtractANumber`
coerces the answer to an integer and **clamps negatives to 0**, with any `min`/`max` bounds required to sit inside the
JS safe-integer range. The model's reasoning, an answerability flag, and a confidence score are **omitted from the ABI
return but recorded in the receipt** (the signed manifest described above)
([LLM Parse Website](https://docs.somnia.network/agents/base-agents/llm-parse-website.md)).

### Paying for it

Invocation is **deposit-and-rebate**, not a fixed fee: you send **SOMI** (mainnet) / **STT** (testnet), it is split into
two virtual pots, and anything unspent is pushed back to you
([gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)). The required deposit is:

```
msg.value ≥ minPerAgentDeposit × subcommitteeSize  +  per_agent_price × subcommitteeSize
            └─────── operations reserve ───────┘     └──────── agent reward pot ────────┘
```

- **Operations reserve** — runner gas refunds, callback gas, finalisation overhead, and keeper reimbursement on timeout.
  `minPerAgentDeposit` defaults to **0.01 SOMI/STT** per agent (operator-configurable).
- **Agent reward pot** — `msg.value − reserve`, paid to the elected subcommittee. Each runner's self-reported
  `executionCost` is clamped to `perAgentBudget = (msg.value − reserve) / subcommitteeSize`. At consensus the contract
  pays `perMember = median(reported executionCosts)` to **every** member equally — deliberately, "to remove any
  incentive to rush a low-quality response" ([gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)).

Per-agent prices are fixed by type. With the default `subcommitteeSize = 3` the reserve is always `0.01 × 3 = 0.03`
SOMI, so the *only* thing that moves the total is the reward pot (`per-agent price × 3`):

| Base agent | Per-agent price | Reserve (3×) | Reward pot (3×) | Min `msg.value` (subSize 3) |
|---|---|---|---|---|
| JSON API Request | `0.03` SOMI | `0.03` | `0.09` | **`0.12` SOMI** |
| LLM Inference | `0.07` SOMI | `0.03` | `0.21` | **`0.24` SOMI** |
| LLM Parse Website | `0.10` SOMI | `0.03` | `0.30` | **`0.33` SOMI** |

(All figures verbatim from the [gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md) page's worked
`msg.value` examples, re-fetched live 2026-05-21.) These are *floors* — unspent budget is rebated, so over-depositing
is safe and under-depositing by even the reward component causes a time-out (see the footgun below).

> ⚠️ **Footgun for the blockchain dev.** `getRequestDeposit()` returns **only the operations-reserve floor** — pay
> exactly that and "your request will time out." Always add the agent-reward component on top
> ([gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)).

To receive the automatic rebate your caller contract must implement `receive() external payable {}`; if the push fails
the contract emits `NativeTransferFailed(recipient, amount)` and the funds stay in the `AgentRequester`. On **timeout**
no committee payment is made — the keeper is reimbursed from the reserve and the **entire reward pot plus unused reserve
is refunded** ([gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)).

### When responses won't match: Majority vs. Threshold consensus

By default a request finalises under **Majority** consensus, which "finalizes when a threshold of validators
return byte-identical results" — fine for math or an exact-value API call, where every honest validator should produce
the same bytes ([custom consensus](https://docs.somnia.network/agents/invoking-agents/custom-consensus.md)). For an LLM,
that only holds *because* inference is forced deterministic (fixed seed/temperature, above). When it can't be — or you
deliberately want independent observations — there is a second mode.

**Threshold** consensus "finalizes as soon as the threshold number of validators respond successfully — regardless of
whether their results agree," and the callback "receives all individual responses, enabling custom aggregation logic"
([custom consensus](https://docs.somnia.network/agents/invoking-agents/custom-consensus.md)). You select the mode and
tune the committee through `createAdvancedRequest`:

```solidity
platform.createAdvancedRequest{value: deposit}(
    uint256 agentId,
    address callbackAddress,
    bytes4  callbackSelector,
    bytes   payload,
    uint256 subcommitteeSize,
    uint256 threshold,
    ConsensusType consensusType,   // Majority (0) | Threshold (1)
    uint256 timeout
)
```

Sizing the deposit uses `getAdvancedRequestDeposit(uint256 subcommitteeSize)` (the advanced analogue of the
`getRequestDeposit()` floor flagged above — same footgun: it returns only the operations-reserve floor). The callback
receives a `Response[]` where each element carries `address validator`, `bytes result`, and a `ResponseStatus status`
you filter on (`Success`), plus receipt/timestamp/cost metadata. Upstream's worked aggregations are **median** over
independent price observations ("naturally filters outliers") and **XOR** of independent randomness ("secure as long as
at least one responding validator provides a truly random value")
([custom consensus](https://docs.somnia.network/agents/invoking-agents/custom-consensus.md)).

> ⚠️ **Sizing footgun.** Upstream recommends a threshold *below* the committee size — "3 of 5 is a good default — it
> tolerates up to 2 failures while still collecting enough data for aggregation" — and warns against `threshold ==
> subcommitteeSize`, where a single slow or failed validator blocks finalisation
> ([custom consensus](https://docs.somnia.network/agents/invoking-agents/custom-consensus.md)). The base
> [subcommittee](../GLOSSARY.md#s) defaults (`size 3`, `threshold 2`) already follow this rule.

### The receipt: the auditable "why" — and where it actually lives

The receipt is Curie's whole reason to care about native agents (an auditable adjudication trail), so the dedicated
[receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md) page is worth reading precisely. A receipt
is "a detailed log of each step the agent took during execution," whose purpose is to "provide transparency and
auditability for agent operations" ([receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md)). It is a
`steps` array plus a top-level `result`; each step carries a `name` and ISO-8601 `timestamp` plus type-specific fields,
with step types including `request_received`, `request_decoded`, `http_request`, `http_response`, `llm_request`,
`llm_response`, `reasoning`, `value_extracted`, `response_encoded`, and `error`
([receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md)).

The trust boundary is explicit and is the single most important fact here: **"The final output of the agent is what
validators reach consensus on"**, but **"The execution steps are subjective and may vary slightly between nodes"** —
"Receipts show what one node did to compute that result. Different nodes may have different receipts… but still agree on
the result" ([receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md)). So consensus binds the
*answer*, not the reasoning; the receipt is one node's narrative, not a multi-party-attested one.

This connects to the on-chain return shape. The [from-Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity.md)
flow finalises by calling your `handleResponse(uint256 requestId, Response[] responses, ResponseStatus status, Request details)`
callback (name flexible, types fixed), where each response is:

```solidity
enum ResponseStatus { None, Pending, Success, Failed, TimedOut }
struct Response {
    address validator;
    bytes   result;        // abi.decode(...) to your return type
    ResponseStatus status;
    uint256 receipt;       // ← a receipt reference, not the receipt body
    uint256 timestamp;
    uint256 executionCost;
}
```

So the **on-chain** record holds the consensus result plus a `uint256 receipt` *reference*; the detailed step log itself
is fetched **off-chain by `requestId`** — Web UI at `https://agents.somnia.network/receipts/<request-id>`, or
programmatically at `https://receipts.mainnet.agents.somnia.host` / `https://receipts.testnet.agents.somnia.host`
([receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md)). And upstream is candid that those stores
are **not yet trustless**: "Receipts are currently stored on centralized infrastructure. We plan to migrate to
decentralized storage in the future" ([receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md)).

The platform contract — named **`SomniaAgents`** — that exposes `createRequest` / `createAdvancedRequest` is deployed
at testnet `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` and mainnet `0x5E5205CF39E766118C01636bED000A54D93163E6`
([from-Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity.md),
[quickstart](https://docs.somnia.network/agents/invoking-agents/quickstart.md) — the two pages agree on both
addresses) — still subject to the pre-GA caveat below.

## How Curie V1 could use it

Our [demo loop](../../../ROADMAP.md) is a payer/provider negotiation over an ICD-10 claim, with PHI off-chain and only
hashes/state/settlement on-chain. Native agents are a candidate for the **adjudication and codes-support steps**:

- **Deterministic policy checks.** The payer agent's "approve / downcode / request-support" decision is exactly the
  kind of bounded judgement `inferNumber` (a coded decision) or `inferString` (with `allowedValues` constraining the
  verdict) is built for — and the **consensus + receipt** give us an auditable "why" for the timeline, on-chain.
  Constraining the verdict to a small enumerated set is also what keeps **Majority** consensus viable; if we ever let
  the adjudicator emit free text we would have to move to **Threshold** consensus and aggregate the responses in the
  callback (above), which is a heavier contract to write and review.
- **`inferToolsChat` + MCP.** Tool-using inference that can call MCP servers and on-chain tools lines up with our
  research-loop MCP tooling and could let an on-chain adjudicator pull cited evidence deterministically.
- **External evidence, fetched on-chain.** `JSON API Request` (the documented "building block for on-chain oracles")
  and `LLM Parse Website` ("trustless, auditable web extraction") could pull *public* adjudication inputs — a payer's
  published coverage-policy API or webpage — straight into a contract with a consensus receipt, instead of trusting an
  off-chain fetch. Both read **public** sources only, so no patient data is ever in scope. Cost-wise these are the
  cheaper end of the table above — `JSON API Request` is **`0.12` SOMI** and `LLM Parse Website` **`0.33` SOMI** per
  call at the default committee size — which is the figure that feeds the per-claim cost model in
  [`tokenomics-and-gas.md`](tokenomics-and-gas.md).
- **The audit "why" is off-chain and centralized today.** Curie's audit timeline wants the *reasoning*, not just the
  verdict — but per the receipt section above, only the consensus `result` and a `uint256 receipt` *reference* are
  on-chain; the step log lives on **centralized** infra (`receipts.{mainnet,testnet}.agents.somnia.host`), pending a
  promised migration to decentralized storage. So a V1 audit trail built on native agents inherits a centralization +
  availability dependency for the detailed "why," even though the verdict itself is trustless. Design the timeline to
  treat the on-chain result as the authoritative artifact and the fetched receipt as enriching-but-revocable detail.
- **PHI boundary still holds — and the receipt sharpens it.** Prompts/inputs must stay PHI-free (hashes, codes, policy
  text) — the same off-chain/on-chain split the [ROADMAP](../../../ROADMAP.md) mandates. Putting a clinical note into
  `inferString` would violate it. The receipt makes this stricter, not looser: its steps log `llm_request`,
  `reasoning`, and (for fetch agents) `body_preview`
  ([receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md)), so a PHI-bearing prompt would persist
  PHI into the **centralized receipt store** — a no-PHI-on-chain *and* no-PHI-in-receipt rule. See the open question below.

### The "native agents vs. somnia-agent-kit" decision

This repo's chosen SDK runs agents **off-chain** ([`../../somnia-agent-kit/`](../../somnia-agent-kit/)); native agents
run the inference **on-chain with consensus**. They are complementary, not competing — but V1 must pick where each
decision executes. Prior analysis exists at
[`../../../research/somnia/native-agents-vs-agent-kit.md`](../../../research/somnia/native-agents-vs-agent-kit.md) and
[`../../../research/somnia/llm-inference-callback-latency-and-timeout.md`](../../../research/somnia/llm-inference-callback-latency-and-timeout.md).

## Open questions (for the research loop)

1. **Latency/timeout** of an on-chain inference call — does it fit a live 90-second demo loop? The request **timeout**
   is now sourced: `defaultTimeout` is **15 minutes**, operator-configurable
   ([gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)). That is an upper bound on how long a
   request can hang, **not** the expected latency — typical end-to-end inference time is still **unsourced** (the
   gas-fees page, re-checked live 2026-05-21, names only `defaultTimeout` and no expected-latency figure) and is the
   real open question for a 90-second demo.
2. **Model choice & opacity** — which models back the inference agent, and how does determinism constrain them? The
   *consensus* half of this is now sourced: **Majority** consensus needs byte-identical (deterministic) outputs, while
   **Threshold** consensus tolerates divergence and aggregates in a callback
   ([custom consensus](https://docs.somnia.network/agents/invoking-agents/custom-consensus.md)). Still **unsourced**:
   *which* models back the agent, and whether a constrained `allowedValues`/`inferNumber` verdict is reliably
   byte-identical across nodes in practice — verify empirically before committing to Majority for adjudication.
3. **PHI-safe prompting** — can the adjudication be expressed purely over hashes/codes/policy text with no free-text PHI?

## Source caveat

Function signatures and economics above are quoted from AI-summarised fetches of the cited upstream pages (2026-05-20),
with the **receipts**, **from-Solidity**, and **quickstart** pages read live on 2026-05-22, and the **gas-fees**,
**LLM Inference**, **custom-consensus**, **JSON-API-Request**, and **LLM-Parse-Website** pages re-fetched live 2026-05-22
(sharpened soft-404 rule — all real content, every quoted deposit figure / method signature / consensus definition
unchanged). The **overview** page — the one agents-section page still on the 2026-05-21 check — was re-fetched live
**2026-05-23** under the same rule: real content, un-drifted; its consensus and invocation quotes match verbatim, and the
AI-engineer section's receipt gloss was promoted to the overview's verbatim "The final result is what validators reach
consensus on" / "Receipt steps are subjective." With this, **every cited agents-section page is re-verified on the
2026-05-22/23 passes.** Note the division of labour confirmed at that read: the **`quickstart`** page carries the network/address
table (the `SomniaAgents` contract, chain IDs `5031`/`50312`, RPC URLs) but **no ABI, agent IDs, or code**; the exact ABI
and return ordering live in the **`from-solidity`** and the three **base-agent** pages — and the **LLM-Parse-Website**
page is the one that pins a concrete **agent ID** (`12875401142070969085`). Before writing contract code, re-read those — upstream is
authoritative — and re-confirm the addresses, which may move pre-GA.
