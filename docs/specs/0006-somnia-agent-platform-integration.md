# SPEC-0006: Somnia AI Agent Platform integration (self-hosted agent BANNED for contract execution)

**Status:** Draft · **Owner:** tspugh · **Date:** 2026-05-30

> Authored from on-chain probes + Somnia docs research conducted 2026-05-30
> in direct response to the hackathon mandate: Curie is a Somnia-native
> application and MUST demonstrate use of Somnia's distinctive AI Agent
> Platform. Adopts resolution path **(b)** from SPEC-0004 §2.7 R25 (find /
> use an agent in the registry whose registered ABI we match). Path (c)
> self-host — adopted in error in Amendment 0006 (2026-05-30) under
> faulty diagnosis of platform-call failures — is **prohibited for
> contract execution** as of this spec; see **R0**. Self-hosted Claude
> calls remain permissible for off-chain dev / diagnostic / evaluation
> scripts that do NOT feed any value the contract acts on. Amendment
> 0006 will be marked Rejected on this spec's merge.

## 1. Summary & user story

Curie returns to the original architectural intent of calling Somnia's
on-chain AI Agent platform for LLM rulings, rather than self-hosting the
LLM via an off-chain orchestrator. Research surfaced **three independent
root causes** of prior platform-call failures (see §3.7): wrong platform
contract address, wrong agent ABI signature, and arguably wrong agent
choice. This spec captures the corrected integration as numbered
requirements so a future agent can build to it directly.

**User story.** As a Somnia hackathon judge, I want Curie to demonstrate
*real* on-chain agent invocation via Somnia's distinctive AI Agent
Platform — not a self-hosted off-chain LLM dressed in chain plumbing — so
that the project credibly shows integration with the technology being
judged.

## 2. Requirements

### 2.0 Architectural prohibition

- **R0 (MUST — architectural ban) Self-hosting prohibited for contract
  execution.** Every value the smart contract acts on — every `Ruled`
  event, every settlement decision, every state transition driven by
  arbiter output — MUST originate from a call to Somnia's AI Agent
  Platform per R1-R5. Curie's contract MUST NOT accept ruling bytes
  produced by, derived from, or shaped by any off-chain orchestrator,
  Anthropic SDK call, or self-hosted LLM. Equivalently: the chain of
  custody from `RulingRequested` event to `handleResponse` callback MUST
  pass through `IAgentRequester.createRequest` and a Somnia validator
  subcommittee — no detour. Off-chain Claude calls remain permissible
  for dev / diagnostic / evaluation work that does NOT feed any value
  the contract acts on (e.g., local prompt-evaluation scripts, replay
  tooling), but no such pathway may exist that the contract reads.

### 2.1 Platform integration

- **R1 (MUST) Canonical testnet platform address.** Use the canonical
  testnet SomniaAgents address
  `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` (chain 50312). Replace
  every reference to `0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A` in code,
  env vars, specs, amendments, and operator notes. (Mainnet equivalent —
  not used in v0 — is `0x5E5205CF39E766118C01636bED000A54D93163E6` on
  chain 5031.)
- **R2 (MUST) `createRequest` call shape.** Calls to the platform MUST
  use the canonical `IAgentRequester.createRequest(uint256 agentId,
  address callbackAddress, bytes4 callbackSelector, bytes payload)
  payable returns (uint256 requestId)` exactly as defined in §3.2.
- **R3 (MUST) `handleResponse` callback shape.** Curie's contract MUST
  implement a callback with the exact 4-arg signature
  `handleResponse(uint256 requestId, Response[] memory responses,
  ResponseStatus status, Request memory details)` and pass the
  corresponding selector to `createRequest`. The legacy 1-arg shape
  `handleResponse(uint256 requestId)` MUST be removed.
- **R4 (MUST) Payload encoding.** Payloads MUST be encoded via
  `abi.encodeWithSelector(IAgent.method.selector, ...args)` where the
  agent's interface is taken from Somnia's published documentation for
  the chosen agent.
- **R5 (MUST) Deposit math.** Each call MUST send
  `msg.value = platform.getRequestDeposit() + (costPerAgent ×
  subcommitteeSize)`. The platform deposit reserve is read dynamically;
  the per-agent reward is hardcoded per agent.

### 2.2 Response decoding

- **R6 (MUST) Iterate responses + filter on Success.** The callback MUST
  iterate `responses[]` and decode only entries with
  `ResponseStatus.Success == 2`. Other statuses MUST NOT be consumed as
  authoritative.
- **R7 (MUST) `ResponseStatus` enum alignment.** Curie's contract MUST
  mirror the platform enum exactly: `None=0, Pending=1, Success=2,
  Failed=3, TimedOut=4` (see §3.4).
- **R8 (MUST) `Response` struct alignment.** Curie's contract MUST mirror
  the platform struct exactly — 6 fields: `address validator, bytes
  result, ResponseStatus status, uint256 receipt, uint256 timestamp,
  uint256 executionCost` (see §3.4).

### 2.3 Self-host retirement

- **R9 (MUST) Amendment 0006 superseded.** The `selfHosted` storage bool,
  `setPlatformSelfHosted(address)` setter, `_fireAgentSelfHosted`
  branch, `_selfHostedNonce` counter, and the `scripts/orchestrator-real.ts`
  off-chain orchestrator MUST be removed from the active code path.
  Preserved in git history per the "regenerate, don't migrate" rule
  (CLAUDE.md). Amendment 0006 status flips Adopted → Superseded.
- **R10 (MUST) `ANTHROPIC_API_KEY` dependency removed from
  contract-execution path.** The Anthropic SDK + API key MUST NOT be
  required by, or referenced from, any code that produces or shapes
  ruling bytes the contract acts on. Per R0, dev / diagnostic /
  evaluation use of the Anthropic SDK is permitted; such use MUST live
  outside the integration-test gate and MUST NOT be the only thing that
  produced any `Ruled` event used in test or production.

### 2.4 Agent choice + ABI pinning

- **R11 (MUST) Use a Somnia-documented base agent.** Curie MUST call one
  of Somnia's published base agents: **LLM Inference** (preferred —
  matches Curie's "given policy + evidence, decide" pattern), LLM Parse
  Website, or JSON API Request. Selection rationale + chosen
  `agentId` + chosen method + chosen ABI MUST be documented in §3.6
  before R12 can pass. (Per R-OPEN-1, the LLM Inference testnet agent ID
  is not in published docs and MUST be resolved before R11 closes.)
- **R12 (MUST) Build-time ABI drift detector.** Extend
  `scripts/check-ruling-abi.ts` to pin the chosen agent's selector +
  param types verbatim. The script MUST fail the build if the on-chain
  ABI for the pinned agent diverges from the pinned shape, AND MUST fail
  if Curie's `_fireAgent` payload-encoding diverges from the pinned
  shape. Wired into `npm test`.
- **R13 (SHOULD) Clean revert on platform upgrade.** If the chosen
  agent's ABI changes mid-deploy (Somnia upgrades the registry), Curie's
  failure mode SHOULD be a clean revert with a recognizable message
  (e.g. `"platform: ABI drift"`), NOT a silent fund loss.

### 2.5 Migration guardrails

- **R14 (MUST) Sim mode unchanged.** The simulated-backend code path
  (`src/contract/simulated.ts`) MUST remain green throughout the
  migration. The on-chain pivot does not touch the offline E2E
  contract; sim browser-verify (99/99) MUST stay PASS.
- **R15 (MUST) Redeploy + record.** Curie's contract MUST be redeployed
  (Tick C-equivalent for this spec) with the canonical platform address
  baked in and the chosen `agentId` + `costPerAgent` constants set.
  The new contract address MUST be recorded in `.env`
  (`VITE_CONTRACT_ADDRESS`, `COVERAGE_CONTRACT_ADDRESS`) and in
  `docs/loop-prompts/spec-4-implementation-loop.md`.
- **R16 (SHOULD) Per-agent decision documentation.** For each base agent
  considered (LLM Inference, LLM Parse Website, JSON API Request),
  document the prompt Curie would build + decoded result shape Curie
  would consume, so the chosen agent's defensibility is auditable.

## 3. Technical documentation

### 3.1 Canonical SomniaAgents contract addresses

| Network | Chain ID | SomniaAgents address |
|---|---|---|
| **Mainnet** | 5031 | `0x5E5205CF39E766118C01636bED000A54D93163E6` |
| **Testnet** | 50312 | **`0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`** |

The testnet address is verified deployed (130 bytes, EIP-1967 proxy) on
chain `0xc488` (50312) via `eth_getCode` on 2026-05-30. The address that
prior specs/amendments/code used —
`0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A` — is also deployed on testnet
(130 bytes) but is NOT the canonical SomniaAgents per Somnia's published
docs. Its provenance is unknown (likely an obsolete/wrong-network address
in `somnia-agent-kit` v3.0.11 documentation that we copied without
verification).

Source of canonical addresses:
[`https://docs.somnia.network/agents/invoking-agents/quickstart`](https://docs.somnia.network/agents/invoking-agents/quickstart).

### 3.2 `IAgentRequester` interface (canonical, verbatim)

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

    function getRequest(uint256 requestId) external view returns (Request memory);
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

### 3.3 Requester-side callback (Curie's contract MUST implement this)

```solidity
function handleResponse(
    uint256 requestId,
    Response[] memory responses,
    ResponseStatus status,
    Request memory details
) external;
```

The `bytes4 callbackSelector` passed to `createRequest` MUST equal
`this.handleResponse.selector` for the exact 4-arg signature above.
The legacy `handleResponse(uint256 requestId)` shape used in
`CoverageNegotiation.sol` (pre-spec) is INCOMPATIBLE and MUST be
deleted.

### 3.4 `Response` struct + `ResponseStatus` enum

```solidity
struct Response {
    address validator;
    bytes result;
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

### 3.5 `Request` struct + `ConsensusType` enum

```solidity
enum ConsensusType { Majority, Threshold }

struct Request {
    uint256 id;
    address requester;
    address callbackAddress;
    bytes4 callbackSelector;
    address[] subcommittee;
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

### 3.6 Documented base agents — comparison + Curie fit

| Agent | Testnet `agentId` | Methods | Curie fit |
|---|---|---|---|
| **LLM Inference** | **Not published** (resolve via R-OPEN-1) | `inferString`, `inferNumber`, `inferChat`, `inferToolsChat` | **Best fit.** Open LLM completion accepts prompt + context, returns a structured result. Maps directly to Curie's "given policy + evidence packet, decide approve/deny" pattern. |
| LLM Parse Website | `12875401142070969085` | `ExtractANumber(string,string,uint256,uint256,string,string,bool,uint8,uint8)` **(9 params)** + `ExtractString` variant | Awkward fit (extracts data from a URL). Possible workaround: phrase the prompt as "extract a coverage-decision number from this synthetic policy URL," but the agent fundamentally fetches+parses websites, not adjudicates. |
| JSON API Request | Not published (R-OPEN-2) | `fetchUint(string url, string selector, uint8 decimals)`, plus `fetchString` variant | Not useful (data-fetching, not judgment). |

**Preferred:** LLM Inference. **Fallback if R-OPEN-1 cannot be resolved
in time:** LLM Parse Website with corrected 9-param signature, framing
prompt as URL-extraction.

### 3.7 Why prior platform-call attempts failed (root-cause analysis)

Three independent bugs combined into one "platform doesn't work" signal,
which led to the (now superseded) Amendment 0006 self-host pivot:

1. **Wrong platform address.** Calldata was sent to
   `0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A` (some deployed contract —
   origin unknown, possibly an older AgentRegistry or unrelated proxy),
   NOT the canonical SomniaAgents `0x037Bb9C…`. Even if the agent ID and
   selector were correct, the wrong address would never deliver them to
   real Somnia validators.
2. **Wrong selector / param count.** Selector `0x4be9280f` for
   `ExtractANumber(string,string,uint256,uint256,string,string,bool,uint8)`
   is the **8-param** variant. The Somnia-published signature is **9
   params** (adds `uint8 confidenceThreshold`). Even at the right
   address, validators' ABI-decode would reject our calldata.
3. **Wrong agent type for the use case.** LLM Parse Website extracts a
   value from a URL; Curie wants open LLM judgment on a policy + evidence
   packet. Even with #1 and #2 fixed, this agent is a forced fit. LLM
   Inference is the right shape.

Amendment 0006 (self-host) was adopted because cause #2 looked
intractable without registry ABI introspection. With cause #1 identified
(simply wrong address) and #3 fixable by switching agents, self-host can
retire.

### 3.8 Deposit / fee math (canonical)

```text
totalDeposit = platform.getRequestDeposit() + (costPerAgent × subcommitteeSize)
             = (minPerAgentDeposit × subSize)  +  (costPerAgent × subSize)
```

Per-agent costs (from Somnia docs):

| Agent | `costPerAgent` (ether/wei) | Default `subSize` | Reward portion |
|---|---|---|---|
| LLM Parse Website | `0.10 ether` | 3 | `0.30 STT` |
| JSON API Request | `0.03 ether` | 3 | `0.09 STT` |
| LLM Inference | **TBD** (R-OPEN-3) | 3 | TBD |

The `platform.getRequestDeposit()` portion MUST be read at request time
via the canonical view function — do NOT hardcode.

### 3.9 Curie's prior hardcoded `agentReward = 0.35 STT`

The pre-spec hardcoded fee was 0.35 STT. Under the canonical math this
was approximately correct for LLM Parse Website (`0.30 STT reward + ~0.05
deposit buffer`) but happened to be routed to the wrong contract, so it
was paying that contract for nothing actionable. After this spec, the
fee is computed dynamically per call.

## 4. Deliverables

1. **`docs/specs/0006-somnia-agent-platform-integration.md`** — this spec.
2. **`docs/amendments/0007-pivot-to-somnia-agent-platform.md`** (new) —
   ADR-style amendment that supersedes A-0006. Single source of truth
   for the architectural decision; this spec is the build target.
3. **`contracts/interfaces/IAgentRequester.sol`** (new) — canonical
   interface from §3.2, copied verbatim, used by Curie's contract.
4. **`contracts/contracts/CoverageNegotiation.sol`** edits:
   - Replace `_fireAgent` to call `IAgentRequester(platform).createRequest{value:totalDeposit}(agentId, address(this), this.handleResponse.selector, payload)`.
   - Rewrite `handleResponse` to the 4-arg shape (§3.3).
   - Mirror `Response` struct + `ResponseStatus` enum (§3.4).
   - Remove `selfHosted`, `setPlatformSelfHosted`, `_fireAgentSelfHosted`,
     `_selfHostedNonce`. (Per R9.)
   - Hardcode pinned `agentId` + `costPerAgent` constants for the chosen agent.
   - Add `"platform: ABI drift"` revert in `handleResponse` if decode
     fails (R13).
5. **`scripts/orchestrator-real.ts`** — deleted. Anthropic SDK removed
   from `package.json` if no other consumer remains.
6. **`scripts/check-ruling-abi.ts`** — extended per R12: pins the chosen
   agent's selector + param types; fails if the on-chain ABI changes OR
   if Curie's encoder diverges.
7. **`.env.example`** updates:
   - DROP `ANTHROPIC_API_KEY`.
   - DROP `AGENT_PLATFORM_ADDRESS` (was orchestrator EOA under self-host).
   - ADD `SOMNIA_AGENTS_ADDRESS=0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`.
   - Refresh `VITE_CONTRACT_ADDRESS` + `COVERAGE_CONTRACT_ADDRESS` after
     redeploy.
8. **Contract redeploy** (Tick C-equivalent) to Somnia testnet with the
   canonical platform address + chosen agent constants baked in. Record
   new address + tx hash in operator notes.
9. **Dependent spec updates** (downstream cascade, executed only after
   this spec is approved):
   - SPEC-0003 §2.10 R49 — restore the validator-subcommittee
     attribution model (its prose is preserved in the §2.10 Historical
     block from tick 141; reactivate that text and retire the
     self-hosted attribution text).
   - SPEC-0004 §2.7 R25/R26/R27 — replace the Amendment 0006 Status
     block with an Amendment 0007 Status block; R27 (responsible-claim
     gate) re-targets the real-mode `Settled` event from the new
     deploy.
   - SPEC-0005 §3.6 R22 — drop `ANTHROPIC_API_KEY` from the blocker
     list; new blocker is "real-mode call against `0x037Bb9C…` with the
     pinned `agentId` produces a `Ruled` event."
   - SPEC-0005 §8 OQ5 — replace the Amendment 0006 self-hosted fee-flow
     text with the canonical Somnia subcommittee fee math from §3.8.
10. **`docs/specs/README.md`** — add SPEC-0006 entry; refresh
    statuses on SPEC-0003/0004/0005 once their dependent updates land.
11. **`docs/progress/loop-state.md`** — full reset of the verdict table
    after the contract redeploy + tests land.

## 5. Test cases

- **T1 (R1, R2, R4, R5) — Real-chain `createRequest` sanity.** Hardhat
  test or live integration test: Curie's contract calls
  `IAgentRequester(0x037Bb9C…).createRequest(pinnedAgentId, address(this),
  this.handleResponse.selector, abi.encodeWithSelector(...))` with
  `msg.value = getRequestDeposit() + costPerAgent×3`. Assert: real
  `requestId` returned, real `RequestCreated` event emitted on testnet.
- **T2 (R3, R6, R7, R8) — Callback decoding.** Local hardhat mock of the
  Somnia platform: deliver a synthetic `Response[]` with one
  `ResponseStatus.Success` entry containing the chosen agent's expected
  output bytes. Assert: Curie's contract decodes correctly, builds the
  10-tuple ruling, emits `Ruled`.
- **T3 (R12) — Build-time ABI drift detector.** `scripts/check-ruling-abi.ts`
  fails the build when the pinned selector/params don't match the
  on-chain agent ABI. Tested by intentionally corrupting the pinned
  value in a unit test and asserting the script exits non-zero.
- **T4 (R9) — Self-host surface removed.** `git grep` from repo root
  returns ZERO matches for `selfHosted`, `setPlatformSelfHosted`,
  `_fireAgentSelfHosted`, `_selfHostedNonce`, `orchestrator-real.ts` in
  non-archive paths. (`docs/progress/loop-state-archive.md` and
  `docs/research/` are exempt.)
- **T5 (R15) — Live deploy verified.** Extension of
  `scripts/verify-deploy.ts` for the new contract address: 8 read-only
  checks PASS (bytecode > 0; `platform == 0x037Bb9C…`; pinned `agentId`
  matches; pinned `costPerAgent` matches; owner, agentReward,
  rulingTimeout, maxRounds sane).
- **T6 (R14) — Sim mode unchanged.** `npm run test:lib` returns 209/209
  PASS (or whatever the current count is after this spec's lib changes).
  `bash web/tests/agent-browser/run.sh` sim mode returns 99/99 PASS.
- **T7 (R11) — Real-mode integration test.** Full browser-verify of R22
  on the new deploy: provider creates request → contract calls
  `createRequest` → Somnia validators run chosen agent → `handleResponse`
  fires → contract emits `Ruled` → both parties accept → `Settled` event
  with provider as recipient. Logged in
  `docs/progress/browser-verify.md`.
- **T8 (R13) — Platform-upgrade revert.** Local hardhat test: mock the
  platform to return a response with a corrupted result shape; assert
  `handleResponse` reverts with `"platform: ABI drift"` (or chosen
  message) rather than decoding garbage.

## 6. Pass / fail criteria

### PASS — all must hold

- [ ] **R1**: Every `0x08D1Fc…` reference in active code/docs replaced
  with `0x037Bb9C…` (T4-style grep verifies).
- [ ] **R2**: `createRequest` call shape in `CoverageNegotiation.sol`
  matches §3.2 verbatim (T1).
- [ ] **R3, R8**: `handleResponse` callback signature is exactly 4-arg
  `(uint256, Response[], ResponseStatus, Request)`; legacy 1-arg shape
  deleted (T2).
- [ ] **R6, R7**: Response decoding iterates and filters on `Success=2`
  per §3.4 (T2).
- [ ] **R5**: Deposit math uses `getRequestDeposit()` dynamically + per-
  agent reward; no hardcoded `agentReward = 0.35 STT` (T1).
- [ ] **R9**: Self-host surface (boolean, setter, branch, nonce,
  orchestrator script) deleted from active code path (T4).
- [ ] **R10**: `ANTHROPIC_API_KEY` removed from `.env.example` and
  package.json's required scripts; integration path doesn't reference it.
- [ ] **R11**: Chosen agent's ID + signature pinned in §3.6 and used by
  the contract (T1).
- [ ] **R12**: Build-time ABI drift detector PASS in CI; intentional
  drift triggers FAIL (T3).
- [ ] **R14**: Sim mode tests + browser-verify still green (T6).
- [ ] **R15**: New contract deployed + `verify-deploy` 8/8 PASS (T5).
- [ ] **R13**: Platform-upgrade simulation triggers clean revert (T8).
- [ ] **R-OPEN-1, R-OPEN-2, R-OPEN-3, R-OPEN-4** resolved with concrete
  values (or documented fallback to alternative agent).

### FAIL — any triggers rejection

- **R0 violation:** Any code path produces a value that the contract
  reads or acts on (a ruling, a settlement amount, a decision enum) and
  that value was generated by, derived from, or shaped by an off-chain
  Claude/Anthropic call, an orchestrator script, or any self-hosted LLM
  rather than a Somnia validator subcommittee per the canonical
  `IAgentRequester` flow. This includes "hybrid" patterns where Claude
  is consulted off-chain and the result is *then* submitted to the
  contract by an EOA the contract trusts.
- Any commit retains `0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A`
  outside `docs/progress/loop-state-archive.md` or `docs/research/`.
- `handleResponse` retains the old 1-arg `(uint256 requestId)` shape
  anywhere.
- `selfHosted` boolean, `setPlatformSelfHosted` setter, or
  `_fireAgentSelfHosted` function remain referenced in active source
  (`contracts/`, `src/`, `scripts/`, `web/` outside archive).
- Build-time ABI drift detector silently passes when on-chain ABI does
  not match the pinned shape (false negative).
- New contract deployed but `verify-deploy` < 8/8 PASS.
- Contract under-deposits (RPC revert on `createRequest`) OR
  over-deposits (no revert but wastes funds).
- An integration test claims a `Settled` event came from a real Somnia
  validator subcommittee when it actually came from a mock or stub
  (violates the "no mocking" hard invariant).

## 7. Out of scope

- **Mainnet deployment.** Testnet only for v0; mainnet is a follow-on
  spec once the testnet integration is proven and a mainnet wallet is
  funded.
- **Custom agents.** Curie does NOT register its own Somnia agent in
  v0; uses base agents only.
- **`createAdvancedRequest`.** Subcommittee-size / threshold /
  consensus-type customization is documented but not used in v0.
  Defaults apply.
- **Sim-mode removal.** Sim mode stays as the fast offline E2E path
  (R14).
- **Validator-side concerns.** This spec is the requester side. What
  validators do with the LLM call (model choice, prompt-template, output
  validation) is Somnia's responsibility.
- **Agent-output-quality criteria.** This spec is about correct
  integration (calldata → response shape); it does NOT require any
  specific judgment quality from the LLM. That belongs in a follow-on
  spec on arbiter prompt design (per SPEC-0004 TASK-3).

## 8. Open questions

- **R-OPEN-1 (HIGH — blocks R11):** What is the numeric on-chain
  `agentId` for **LLM Inference** on Somnia testnet (chain 50312)? The
  agent is described in Somnia docs but no testnet ID is published.
  Resolution paths in priority order: (a) parse `RequestCreated` event
  logs from the canonical SomniaAgents `0x037Bb9C…` for distinct
  `(agentId, payload-method)` pairs and cross-reference against docs;
  (b) call any registry view function exposing the agent catalog
  (currently unknown); (c) ask Somnia devrel via Discord `#dev-chat` or
  `developers@somnia.foundation`.
- **R-OPEN-2 (HIGH — blocks R12):** For the chosen agent (LLM Inference
  preferred), what is the exact registered ABI selector + param types
  on `0x037Bb9C…`? The docs publish method signatures but not the
  4-byte selectors. Signature drift between the doc page and on-chain
  registration is exactly what bit us before. Resolution: same as
  R-OPEN-1.
- **R-OPEN-3 (MED — affects R5 hardcoding):** What is the current value
  of `platform.getRequestDeposit()` on the canonical testnet
  `0x037Bb9C…`? Resolution: read-only RPC call before redeploy; spec
  prefers dynamic read at request time so this is informational.
- **R-OPEN-4 (MED — affects T2 / T7 precision):** For LLM Inference's
  `inferString` / `inferChat` methods, what is the decoded response
  shape? Single string? Tuple `(string text, uint256 score)`? Per the
  docs page we have, the method signatures imply `inferString` returns
  a single string and `inferChat` returns a chat message structure, but
  the on-chain ABI must be verified before T2 is precise.
- **R-OPEN-5 (LOW):** Should Curie keep a sim-mode "instant ruling"
  backend in parallel after this pivot? Recommendation: yes (R14).
- **R-OPEN-6 — RESOLVED:** Anthropic SDK retention. **Decision: keep it
  in `package.json` as an optional dev/diagnostic dependency, scoped to
  non-contract-execution use only per R0/R10.** Any concrete
  dev/diagnostic script that uses it must be `scripts/dev-*.ts` or
  `scripts/eval-*.ts` (named-prefix convention) and MUST NOT be wired
  into any test, build, or deploy step that the contract or integration
  gate observes.

---

**Provenance.** Research was conducted 2026-05-30 by direct
`eth_getCode` probes against Somnia testnet (chain 50312 confirmed via
`eth_chainId == 0xc488`) and WebFetch crawls of
`https://agents.somnia.network`,
`https://docs.somnia.network/agents`,
`https://docs.somnia.network/agents/invoking-agents/quickstart`,
`https://docs.somnia.network/agents/invoking-agents/from-solidity`,
`https://docs.somnia.network/agents/base-agents/llm-inference`,
`https://docs.somnia.network/agents/base-agents/llm-parse-website`,
`https://docs.somnia.network/agents/invoking-agents/receipts`. All
interface/struct/enum definitions in §3.2-§3.5 are reproduced
verbatim from the
[`invoking-agents/from-solidity`](https://docs.somnia.network/agents/invoking-agents/from-solidity)
documentation page.
