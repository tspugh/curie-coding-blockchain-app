---
name: somnia-agent
description: >-
  Use this WHENEVER calling Somnia's AI Agent Platform from a contract or
  TypeScript — invoking a base agent (LLM Inference / LLM Parse Website /
  JSON API Request), encoding payload calldata for `createRequest`,
  implementing the `handleResponse` callback, decoding `Response[]` results,
  or computing the right `msg.value` deposit. Trigger on any mention of
  `IAgentRequester`, `createRequest`, `handleResponse`, `SomniaAgents`,
  `agentId`, `inferString` / `inferChat` / `inferToolsChat` / `inferNumber`,
  `ExtractANumber`, `fetchUint`, or selectors `0xfe7ca098` / `0xc6833c3d` /
  `0xbee8d139` / `0xd0683905` / `0x2623e955` / `0xc2dd1a7a` / `0x3bbc1302`.
  This skill carries the canonical contract addresses, the verified testnet
  and mainnet `agentId` values for all three Somnia base agents, the exact
  ABI signatures + selectors, the cost-per-agent, and the three pitfalls
  that look like "the platform doesn't work."
---

# Somnia AI Agent Platform — invocation reference

Authored 2026-05-30 from on-chain probes (`scripts/identify-inference-agent.ts`)
+ docs at https://docs.somnia.network/agents. Every numeric value below is
verified on chain (testnet chain 50312 and mainnet chain 5031) unless noted.

## 1. When this matters

You're here if you need to:

- Make a contract call to `SomniaAgents.createRequest(agentId, callback,
  selector, payload)` so Somnia validators run an LLM and return a result.
- Encode `payload` against a specific agent's registered ABI.
- Implement Curie's contract `handleResponse(...)` callback.
- Decode the `Response[]` array.
- Compute the right `msg.value` deposit.
- Diagnose why a previous platform call failed (see §8 Pitfalls).

If you only need the React/UI side, this skill is overkill — use
`somnia-agent-kit` v3 directly.

## 2. Network addresses (verified on chain)

| Network | Chain ID | SomniaAgents contract (the `IAgentRequester`) |
|---|---|---|
| **Testnet** | `50312` (`0xc488`) | **`0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`** |
| **Mainnet** | `5031` (`0x13a7`) | **`0x5E5205CF39E766118C01636bED000A54D93163E6`** |

RPC URLs:

- Testnet: `https://api.infra.testnet.somnia.network/`
- Mainnet: `https://api.infra.mainnet.somnia.network/`

**Do NOT use `0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A`** — that's a
different, unrelated contract that appears in stale `somnia-agent-kit`
documentation and was the source of weeks of failed integration. The
canonical SomniaAgents are above.

## 3. Base agents (the only agents Somnia publishes registered ABIs for)

All three base agents have **the same numeric `agentId` on testnet and
mainnet** (Somnia uses consistent agent IDs across networks).

### 3.1 LLM Inference — `12847293847561029384`

Best fit for any "give a model context + a prompt, get a structured
judgment back" use case (classification, scoring, free-form reasoning,
tool-use). This is the agent Curie uses for coverage-exception rulings.

**Per-agent reward** (observed on chain): `0.07 STT` typical;
`0.09 STT` upper bound seen on testnet. Default subcommittee size = 3,
so reward portion = `0.21–0.27 STT` per call (plus the platform reserve
from `getRequestDeposit()`).

**Methods** (verified by matching selectors against on-chain
`RequestCreated.payload[0..4]`):

| Selector | Canonical signature | Output |
|---|---|---|
| `0xfe7ca098` | `inferString(string,string,bool,string[])` | `string` |
| `0xc6833c3d` | `inferNumber(string,string,int256,int256,bool)` | `int256` |
| `0xbee8d139` | `inferChat(string[],string[],bool)` | `string` |
| `0xd0683905` | `inferToolsChat(string[],string[],string[],(string,string)[],uint256,bool)` | `(string,string,string[],string[],string[],bytes[])` |

#### inferString (most common — single-shot LLM call)

```solidity
interface ILLMInferenceAgent {
    function inferString(
        string calldata prompt,
        string calldata system,
        bool chainOfThought,
        string[] calldata allowedValues
    ) external returns (string memory response);
}
```

`allowedValues` empty → free-form response. Non-empty → the LLM's answer
is **constrained to one of those strings** (use for classification:
`["approve", "deny", "needs_more_info"]`).

`chainOfThought` true → the LLM reasons before answering. Higher cost +
latency; ignore for cheap deterministic calls.

#### inferNumber (constrained integer)

```solidity
function inferNumber(
    string calldata prompt,
    string calldata system,
    int256 minValue,
    int256 maxValue,
    bool chainOfThought
) external returns (int256 response);
```

LLM's answer is clamped into `[minValue, maxValue]`. Useful for "score
0..100" or "decision enum 0..3" patterns where you'd rather get back a
plain int than a string.

#### inferChat (multi-turn)

```solidity
function inferChat(
    string[] calldata roles,
    string[] calldata messages,
    bool chainOfThought
) external returns (string memory response);
```

`roles[i]` ∈ `{"system", "user", "assistant", "tool"}`. The model responds
as the next `"assistant"` turn.

#### inferToolsChat (tool use — most powerful, most complex)

```solidity
struct OnchainTool {
    string signature;    // e.g. "swap(address token, uint256 amount)"
    string description;  // free-form for the model
}

function inferToolsChat(
    string[] calldata roles,
    string[] calldata messages,
    string[] calldata mcpServerUrls,    // MCP tools auto-executed by agent
    OnchainTool[] calldata onchainTools, // on-chain tools yielded back
    uint256 maxIterations,
    bool chainOfThought
) external returns (
    string memory finishReason,    // "stop" | "tool_calls" | "max_iterations"
    string memory response,
    string[] memory updatedRoles,
    string[] memory updatedMessages,
    string[] memory pendingToolCallIds,
    bytes[] memory pendingToolCalls  // calldata for on-chain tools
);
```

Three finish reasons:

- `"stop"` — model finished; `response` has the answer.
- `"tool_calls"` — model wants to call on-chain tools; YOUR contract
  executes `pendingToolCalls[i]` then resumes with updated conversation.
- `"max_iterations"` — round-trip limit hit; consider raising
  `maxIterations` (cost scales).

### 3.2 LLM Parse Website — `12875401142070969085`

Fetches a URL, then asks an LLM to extract a value from the page content.
**Awkward fit for general reasoning** — use only when you literally need
to scrape a website. For "give context + decide" use LLM Inference.

**Per-agent reward**: `0.1000 STT` (some calls observed at `0.1233 STT` —
likely caller-chosen overpay).

| Selector | Canonical signature | Output |
|---|---|---|
| `0x2623e955` | `ExtractANumber(string,string,uint256,uint256,string,string,bool,uint8,uint8)` | `uint256` |
| `0xc2dd1a7a` | `ExtractString(string,string,string[],string,string,bool,uint8,uint8)` | `string` |

**Note the 9 params** for `ExtractANumber`. Older `somnia-agent-kit`
documentation showed an 8-param shape (selector `0x4be9280f`); that is
**not** the registered ABI. Sending the 8-param selector → validators
reject with `ABI decode failed`. The 9th param is `uint8 confidenceThreshold`.

`ExtractANumber` params (in order):
`key, description, min, max, prompt, url, resolveUrl, numPages, confidenceThreshold`.

### 3.3 JSON API Request — `13174292974160097713`

Fetches a JSON URL and extracts a field. Lowest-cost agent (HTTP + JSON
parsing only, no LLM). **Not useful for judgment** — use for data oracles.

**Per-agent reward**: `0.0300 STT`. Highest-volume agent on testnet
(thousands of calls/day).

| Selector | Canonical signature | Output |
|---|---|---|
| `0x3bbc1302` | `fetchUint(string,string,uint8)` | `uint256` |
| `0xe003c22e` | `fetchString(string,string)` | `string` |

`fetchUint(url, jsonSelector, decimals)` — fetches the URL, parses JSON,
extracts the field at `jsonSelector` (dotted path: e.g. `"bitcoin.usd"`),
multiplies by `10**decimals`, returns as `uint256`.

## 4. The `IAgentRequester` interface (canonical, verbatim from docs)

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

    function getRequest(uint256 requestId)
        external view returns (Request memory);
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

## 5. The `handleResponse` callback your contract MUST implement

```solidity
function handleResponse(
    uint256 requestId,
    Response[] memory responses,
    ResponseStatus status,
    Request memory details
) external;
```

**The selector passed to `createRequest` MUST be the selector of THIS
exact 4-arg signature** (`this.handleResponse.selector` in Solidity).
Validators dispatch the callback as `callbackAddress.call(abi.encodeWithSelector(callbackSelector, requestId, responses, status, details))` —
if your callback signature doesn't match, the call reverts and your
contract never sees the result.

### Response struct + ResponseStatus enum

```solidity
struct Response {
    address validator;       // who submitted this response
    bytes result;            // ABI-encoded per agent's output type
    ResponseStatus status;
    uint256 receipt;
    uint256 timestamp;
    uint256 executionCost;
}

enum ResponseStatus {
    None,       // 0
    Pending,    // 1
    Success,    // 2
    Failed,     // 3
    TimedOut    // 4
}
```

### Request struct (the callback `details` parameter)

```solidity
enum ConsensusType { Majority, Threshold }

struct Request {
    uint256 id;
    address requester;
    address callbackAddress;
    bytes4 callbackSelector;
    address[] subcommittee;       // elected validators for this request
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

### Iterating responses (canonical pattern)

```solidity
function handleResponse(
    uint256 requestId,
    Response[] memory responses,
    ResponseStatus status,
    Request memory /* details */
) external {
    require(msg.sender == address(SOMNIA_AGENTS), "auth");
    require(status == ResponseStatus.Success, "request not successful");

    // Find the first response that succeeded.
    for (uint256 i = 0; i < responses.length; i++) {
        if (responses[i].status == ResponseStatus.Success) {
            // Decode per the agent's output type:
            string memory text = abi.decode(responses[i].result, (string));
            // ... use the response ...
            return;
        }
    }
    revert("no successful response");
}
```

## 6. Calldata encoding pattern

Always encode payload via `abi.encodeWithSelector` against an interface
that declares the chosen agent's method signature. Example for
LLM Inference's `inferString`:

```solidity
import { IAgentRequester } from "./interfaces/IAgentRequester.sol";

uint256 constant LLM_INFERENCE_AGENT_ID = 12847293847561029384;
uint256 constant LLM_INFERENCE_COST_PER_AGENT = 0.10 ether; // safe upper bound
uint256 constant SUBCOMMITTEE_SIZE = 3;

interface ILLMInferenceAgent {
    function inferString(
        string calldata prompt,
        string calldata system,
        bool chainOfThought,
        string[] calldata allowedValues
    ) external returns (string memory);
}

function askAgent(string memory prompt, string memory system) external returns (uint256 requestId) {
    string[] memory empty = new string[](0);
    bytes memory payload = abi.encodeWithSelector(
        ILLMInferenceAgent.inferString.selector,
        prompt,
        system,
        false,         // chainOfThought
        empty          // allowedValues — empty = free-form
    );

    uint256 reserve = IAgentRequester(SOMNIA_AGENTS).getRequestDeposit();
    uint256 reward = LLM_INFERENCE_COST_PER_AGENT * SUBCOMMITTEE_SIZE;
    uint256 deposit = reserve + reward;

    requestId = IAgentRequester(SOMNIA_AGENTS).createRequest{value: deposit}(
        LLM_INFERENCE_AGENT_ID,
        address(this),
        this.handleResponse.selector,
        payload
    );
}
```

### TypeScript equivalent (off-chain payload construction, e.g. for tests)

```typescript
import { ethers } from "ethers";

const SOMNIA_AGENTS = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776"; // testnet
const LLM_INFERENCE_AGENT_ID = 12847293847561029384n;

const llmAbi = [{
  type: "function",
  name: "inferString",
  inputs: [
    { name: "prompt",          type: "string"   },
    { name: "system",          type: "string"   },
    { name: "chainOfThought",  type: "bool"     },
    { name: "allowedValues",   type: "string[]" },
  ],
  outputs: [{ name: "response", type: "string" }],
}] as const;

const iface = new ethers.Interface(llmAbi);
const payload = iface.encodeFunctionData("inferString", [
  "What model are you?",
  "You are a helpful AI assistant.",
  false,
  [],          // unconstrained free-form output
]);

// payload is now a 0x-prefixed bytes string starting with 0xfe7ca098
console.log(payload.slice(0, 10)); // → "0xfe7ca098"
```

## 7. Cost / deposit math

```
totalDeposit = platform.getRequestDeposit() + (costPerAgent × subcommitteeSize)
```

- `getRequestDeposit()` = `minPerAgentDeposit × subSize` — the platform's
  base reserve. **Read it at call time; do NOT hardcode.** It can change
  between platform upgrades.
- `costPerAgent` is per-agent reward. Hardcode per agent:

| Agent | `costPerAgent` (typical) | Reward portion (×3 subcommittee) |
|---|---|---|
| LLM Inference | `0.07–0.09 ether` (safe: `0.10 ether`) | `0.21–0.30 STT` |
| LLM Parse Website | `0.10 ether` | `0.30 STT` |
| JSON API Request | `0.03 ether` | `0.09 STT` |

Per-call total is typically in the `0.30–0.50 STT` range for LLM agents
including reserve. Overpaying is harmless; underpaying causes the
`createRequest` tx to revert. Validators receive the reward upon
submitting a `Success` response; budget for failed/timeout responses is
refunded to the requester via `SubcommitteePaid` accounting.

## 8. Pitfalls (the 3 bugs we hit that all looked like "platform doesn't work")

1. **Wrong platform address.** `somnia-agent-kit` v3 documentation
   references `0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A` as
   "AgentRegistry." That contract exists on Somnia testnet (130 bytes)
   but is **not the canonical SomniaAgents** and your calls go nowhere
   useful. Use `0x037Bb9C…` (testnet) / `0x5E5205CF…` (mainnet) — verify
   by cross-referencing https://docs.somnia.network/agents/invoking-agents/quickstart.

2. **Wrong ABI for the agent.** Method names in docs can be at one
   parameter shape, but on-chain registrations may differ. Concrete
   example: `ExtractANumber` (LLM Parse Website) is documented in old
   sources as 8 params (`...,bool,uint8`); the actual registered ABI on
   the canonical platform is **9 params** (`...,bool,uint8,uint8`,
   adding `confidenceThreshold`). Sending the wrong selector →
   `ABI decode failed (selector=0x...): … not found on ABI`. **Always
   verify selector against on-chain activity** using
   `scripts/identify-inference-agent.ts` (which cross-references
   `keccak256(canonicalSignature)[0..4]` against `RequestCreated.payload[0..4]`
   from the canonical SomniaAgents).

3. **Wrong agent for the use case.** For "give context + prompt, get
   judgment" workflows, you want **LLM Inference**, not LLM Parse Website
   (which is for scraping URLs) or JSON API (which is for fetching JSON
   fields). Picking the wrong agent type forces brittle prompt-shaping
   that may never produce useful output.

If you're staring at "createRequest reverts" or "no response ever comes
back," check these three in order.

## 9. Discovery — `scripts/identify-inference-agent.ts`

Lives at `scripts/identify-inference-agent.ts` in this repo. Run it any
time you suspect Somnia has registered new agents or changed an ABI:

```bash
# Testnet (default)
tsx scripts/identify-inference-agent.ts --range 50000

# Mainnet
tsx scripts/identify-inference-agent.ts --network mainnet --range 20000
```

What it does:

1. Computes canonical selectors for every known method from this skill.
2. Scans recent `RequestCreated` events on the canonical SomniaAgents.
3. Groups events by `agentId`, lists the selectors actually used + the
   `perAgentBudget` observed.
4. Cross-references known selectors against the on-chain selectors;
   labels each agentId as LLM Inference / LLM Parse Website / JSON API
   / unknown.
5. Surfaces any unknown selectors so you can add them to this skill.

This is how we identified that `agentId: 12847293847561029384` is LLM
Inference on both networks.

## 10. Reference URLs

- Quickstart (canonical addresses):
  https://docs.somnia.network/agents/invoking-agents/quickstart
- Invoking from Solidity (interface + structs):
  https://docs.somnia.network/agents/invoking-agents/from-solidity
- LLM Inference docs:
  https://docs.somnia.network/agents/base-agents/llm-inference
- LLM Parse Website docs:
  https://docs.somnia.network/agents/base-agents/llm-parse-website
- JSON API Request docs:
  https://docs.somnia.network/agents/base-agents/json-api-request
- Receipts (execution-step logs, not response struct):
  https://docs.somnia.network/agents/invoking-agents/receipts
- Mainnet/testnet explorer:
  https://explorer.somnia.network/
- Curie's relevant spec: `docs/specs/0006-somnia-agent-platform-integration.md`
- Curie's discovery script: `scripts/identify-inference-agent.ts`
