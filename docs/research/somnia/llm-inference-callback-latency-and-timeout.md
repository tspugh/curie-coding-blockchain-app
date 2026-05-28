# Somnia LLM Inference Callback Latency and Timeout Design

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-15 — Empirical end-to-end latency for Somnia `createAdvancedRequest` LLM Inference callback and safe timeout parameter design

### Finding 1: `timeout` parameter is in seconds — default is 900 (15 minutes)

- The `createAdvancedRequest` function accepts a `uint256 timeout` parameter. The Somnia gas-fees documentation states the `defaultTimeout` is **15 minutes** and is "Operator-configurable."
  — [Somnia Docs: Gas Fees for Agents](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)
- In EVM context, timeouts denominated in time (not blocks) are almost universally measured in seconds relative to `block.timestamp`. At 100 ms block time, Somnia has ~600 blocks per minute; a block-count-denominated timeout of 15 min would be 9,000 blocks — an atypical value. The seconds interpretation (900) is strongly indicated by the "15 minutes" natural-language description.
- **Unconfirmed**: the unit is inferred from convention and the natural-language description; Somnia's public documentation does not explicitly state "seconds" for the `timeout` parameter unit. Direct confirmation requires examining the platform contract ABI or querying the Somnia DevRel team (`developers@somnia.foundation`, Discord: `@emreyeth`).
  — [Somnia Docs: Invoking from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)

### Finding 2: No published SLA or empirical latency figure for LLM Inference callbacks

- Somnia's official documentation provides **no SLA, no expected callback time, and no benchmarks** for how long LLM Inference agent callbacks take on mainnet. Searches of community posts, hackathon write-ups (Reactivity Hackathon Apr 2026, 146 projects, 350 developers), and third-party infrastructure providers (GetBlock) yielded no empirical timing data.
  — [Somnia Reactivity Hackathon Blog](https://blog.somnia.network/p/somnia-reactivity-hackathon-shows); [GetBlock: Somnia Mainnet RPC](https://getblock.io/blog/getblock-adds-somnia-mainnet-rpc-api-support/)
- The architecture requires multi-validator consensus: elected validator nodes independently execute the same LLM call and submit results; the platform calls the contract callback only once `threshold` nodes agree. For `subcommitteeSize=5, threshold=3`, all 5 validators must attempt and 3 must agree before the callback fires. Latency is therefore bounded by the **slowest of the threshold validators**, not the fastest.
  — [Somnia Docs: Agents README](https://docs.somnia.network/agents/readme.md)
- General LLM inference benchmarks (non-Somnia) in 2026: time-to-first-token ranges from ~600 ms (Claude Haiku 4.5) to >4 seconds (GPT-4.1 Mini) for cloud-hosted models. Full response generation for a structured JSON ICD-10 coding output (~300 tokens) adds 2–10 seconds at typical throughput rates (30–150 tok/sec). For 5 validators each independently running inference, total wall-clock time to reach 3-of-5 consensus is likely **15–60 seconds** under favorable conditions, potentially longer under validator load.
  — [Kunal Ganglani: LLM API Latency Benchmarks 2026](https://www.kunalganglani.com/blog/llm-api-latency-benchmarks-2026)

### Finding 3: On timeout — `ResponseStatus.TimedOut` callback fires; funds are refunded

- When a request's deadline expires without consensus, **anyone can call `upkeepRequests()`** on the platform contract. This triggers:
  1. Keeper reimbursement from the operations reserve.
  2. No committee payment (no consensus was reached, so no agents are rewarded).
  3. Refund of the agent reward pot and unused operations reserve to the requester.
  — [Somnia Docs: Gas Fees for Agents](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)
- The `handleResponse` callback is invoked with `ResponseStatus.TimedOut` (enum value 4). The documentation advises: "maybe retry." This means claims do NOT get permanently stuck — the contract callback fires with a timed-out status and the claim state machine must handle this gracefully.
  — [Somnia Docs: Invoking from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)

### Finding 4: The 15-minute default timeout is incompatible with a 90-second demo

- The ROADMAP's 90-second demo loop requires: claim submission → hash anchor → payer agent review → evidence request → evidence response → agreement → settlement event. If the `createAdvancedRequest` LLM Inference callback takes the default 15-minute window, the demo loop cannot complete.
- The resolution requires **decoupling the LLM Inference oracle call from the critical demo path**. Two patterns address this:
  1. **Pre-computation pattern**: Run the Corti Symphony coding call off-chain before the demo, cache the result, and submit the `claimHash` to chain without waiting for a Somnia LLM Inference oracle. Use the native agent call as an asynchronous attestation that arrives after the demo completes, not as a blocking step.
  2. **Short timeout + retry pattern**: Set `timeout=60` (60 seconds) for demo mode; if the LLM callback fires within 60 seconds, show the attestation in the UI; if it times out, display a "pending attestation" state and retry. The claim lifecycle state machine must support an `AttestationPending` sub-state that does not block settlement.
  — [ROADMAP.md: 90-second demo script](../../ROADMAP.md)

### Finding 5: Safe timeout defaults for production vs. demo

| Mode | Recommended `timeout` | Rationale |
|---|---|---|
| Demo mode | 60 seconds | Forces visible callback or clear timeout within the demo window; retry UI handles timeout gracefully |
| Production (outpatient) | 300 seconds (5 min) | Covers expected LLM consensus time with buffer; well below 15-min default |
| Production (inpatient, human-attestor) | 900 seconds (15 min) | Full default; human attestor adds latency beyond LLM callback |
| Dispute resolution | 1800 seconds (30 min) | Extended window for complex re-adjudication |

- These values are **design recommendations**, not empirically validated against Somnia mainnet performance. They should be validated by running a test `createAdvancedRequest(subcommitteeSize=5)` call on Somnia mainnet and measuring callback wall-clock time before finalizing the claim lifecycle contract.

### Finding 6: Contract design implications for timeout handling

- The `ClaimSettlement.sol` state machine must include a `handleResponse` implementation that distinguishes `ResponseStatus.TimedOut` from `ResponseStatus.Failed` and `ResponseStatus.Success`:
  - `Success` → advance claim to `Adjudicated` state
  - `TimedOut` → transition to `AttestationPending` or `Disputed` (depending on retry policy)
  - `Failed` → transition to `Disputed` with a `failureReason` hash
- The `timeout` value should be stored in a `uint256 public agentTimeout` contract variable (not hardcoded) so it can be updated via a governance transaction when empirical latency data becomes available.
- The `upkeepRequests()` caller incentive (keeper reimbursement from operations reserve) means someone external may trigger the timeout callback before the claim owner does. The `handleResponse` function must be `access-controlled` so only the platform contract can call it (`require(msg.sender == SOMNIA_PLATFORM, "unauthorized")`).

**Design implication:** The Somnia LLM Inference callback has a configurable timeout defaulting to 15 minutes with no published empirical latency floor. For the 90-second demo, the Corti Symphony coding step must be pre-computed off-chain and the native agent call must be a non-blocking async attestation, not a demo-path blocker. The `ClaimSettlement.sol` state machine requires explicit `TimedOut` handling and a configurable `agentTimeout` variable.

**Open questions generated:**
1. What is the empirically observed wall-clock time for a `createAdvancedRequest(subcommitteeSize=3, threshold=2)` LLM Inference callback on Somnia mainnet — can a test call confirm whether it completes in <30 seconds, and if so, does increasing subcommitteeSize to 5 measurably increase latency? — priority: high
2. Does the Somnia platform contract emit a `RequestCreated` event at submission and a `RequestFulfilled` event at callback, enabling the UI to show a live timer from submission to attestation without polling? — priority: medium
3. If `upkeepRequests()` is called by an external keeper before the demo's claim owner triggers the retry, does the `TimedOut` callback fire to the contract immediately, or is there a keeper-delay window? — priority: low

---

**See also** — [[../topics/corti|Corti hub]] · [[../topics/somnia-substrate|Somnia substrate hub]]
