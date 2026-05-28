# Somnia OpPC Challenge Window: BFT Finality vs. Application-Layer Dispute Window

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — What is the actual Somnia OpPC challenge window duration — is the 48-hour assumption validated, and does a longer window fundamentally change the dispute-tier mirror contract requirement?

---

### Finding 1: Somnia uses BFT consensus with sub-second finality — there is NO protocol-level challenge window

- Somnia uses **MultiStream consensus**, a modified PBFT-based proof-of-stake protocol. PBFT-class consensus is Byzantine fault tolerant and achieves **deterministic finality** once a block is finalized — there is no fraud-proof window or optimistic challenge period at the L1 protocol level. The consensus chain "finalizes blocks at sub-second latency" and "makes all transactions up to that head canonical and effectively irreversible under the protocol's security assumptions."
  — [Chainspect: Somnia block time 0.1s, TTF 0s](https://chainspect.app/chain/somnia); [Nodes.guru: Somnia consensus deep-dive](https://nodes.guru/blog/somnia-a-deep-dive-into-its-high-performance-blockchain-technology)
  — Assessment: High confidence. Multiple independent sources confirm BFT immediate finality.

- This is categorically different from optimistic rollups (Arbitrum, Optimism), which use fraud proofs and require a 7-day challenge window for state commitments. Somnia is an L1 PoS chain — it does not have an "OpPC challenge window" at the consensus layer. The term "OpPC" as used in prior cliqueue research refers to an **application-layer optimistic pattern** for dispute resolution within `ClaimsAdjudicator`, not a Somnia-native protocol parameter.
  — [Optimistic Rollup Challenge Period Explained](https://medium.com/@zeydrm/optimistic-rollup-challenge-period-explained-beginner-a54e857e137b) (for contrast); Somnia consensus documentation above.
  — Assessment: High confidence.

- **Implication:** The "48-hour OpPC challenge window" referenced in prior cliqueue research ([[claim-struct-packing-cold-sload-dispute-architecture]], [[../research-questions|research-questions]]) is an **unvalidated assumption entirely of cliqueue's own design** — it is the dispute window that `ClaimsAdjudicator` enforces at the application layer. Somnia imposes no minimum or maximum on this window. Cliqueue can set it to any value: 1 hour, 48 hours, or 7 days.
  — Assessment: High confidence.

---

### Finding 2: The `createAdvancedRequest` `timeout` parameter is for LLM Inference agent requests — it is NOT the same as the claims dispute window

- The Somnia docs show `createAdvancedRequest` accepts a `uint256 timeout` parameter measured in seconds (EVM convention: `block.timestamp` delta). The operator-configurable `defaultTimeout` is **15 minutes** (900 seconds). This timeout determines how long the platform contract waits for validator consensus on an LLM Inference call before firing a `ResponseStatus.TimedOut` callback.
  — [Somnia Docs: Invoking from Solidity — `createAdvancedRequest`](https://docs.somnia.network/agents/invoking-agents/from-solidity); [Somnia Docs: Gas Fees for Agents — defaultTimeout](https://docs.somnia.network/agents/invoking-agents/gas-fees.md) (as referenced in prior research)
  — Assessment: High confidence; prior research (2026-05-15, [[llm-inference-callback-latency-and-timeout]]) confirmed this.

- The `timeout` in `createAdvancedRequest` governs how long the system waits for the coding AI oracle to respond — it has **no bearing** on how long a payer has to challenge a settled claim. These are two entirely separate architectural concepts that prior research conflated.
  — Assessment: High confidence.

---

### Finding 3: The application-layer dispute window in `ClaimsAdjudicator` must be designed from scratch — no Somnia precedent exists

- No Somnia documentation, developer guide, smart contract template, or third-party hackathon project provides a reference implementation of an on-chain payer–provider dispute window for healthcare claims. Searches of Somnia's documentation, GitHub topics (`somnia`, `somnia-testnet`), the Somnia Agent Kit, and developer community write-ups yielded **no precedent dispute-window pattern on Somnia**.
  — [GitHub: Somnia topics](https://github.com/topics/somnia); [Somnia Agent Kit GitBook](https://somnia-agent-kit.gitbook.io/somnia-agent-kit); [Somnia Docs: Smart Contracts](https://docs.somnia.network/developer/smart-contracts)
  — Assessment: High confidence (negative finding; absence of evidence with broad search).

- The closest EVM precedent is Optimism's `FaultDisputeGame` contract (7-day window) and permissioned on-chain arbitration patterns from DeFi (e.g., Uniswap V4 fee disputes). Neither is directly applicable to payer-provider healthcare claim disputes.
  — [Optimism Fault Proofs Explainer](https://docs.optimism.io/op-stack/fault-proofs/explainer)
  — Assessment: High confidence for the analogy; medium confidence for direct applicability.

---

### Finding 4: Optimal dispute window for `ClaimsAdjudicator` — design constraints from first principles

Given that the dispute window is entirely cliqueue's design choice, the following constraints bound the decision:

- **Lower bound — operational:** Payer adjudication systems (UHC, Aetna, Cigna) typically require 24–72 business hours to process manual coding reviews. A dispute window shorter than 24 hours would expire before a payer's back-office system has time to flag a disagreement. Industry-standard timely-filing windows are 90–180 days; real-time adjudication targets <1 business day.
  — [HFMA: Real-time Adjudication Benchmarks](https://www.hfma.org/); prior research [[../agreement-layer/edi-837-835-flow-and-blockchain-adjudication|edi-837-835-flow-and-blockchain-adjudication]]
  — Assessment: Medium confidence (HFMA benchmark inference; no direct on-chain healthcare precedent).

- **Upper bound — Somnia cold-SLOAD risk:** As established in prior research ([[claim-struct-packing-cold-sload-dispute-architecture]]), at 0.1s block time a 48-hour window = 1,728,000 blocks. Even at current low mainnet utilization (~6 TPS), the 128M LRU cache will likely evict claim slots disputed 48+ hours after submission, making each dispute-resolution SLOAD a 1M-gas cold read. A 7-day window (6,048,000 blocks) makes cold reads near-certain.
  — Prior research; [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)
  — Assessment: High confidence for formula; medium confidence for dollar cost.

- **Practical recommendation:** A **48-hour (172,800 seconds) application-layer dispute window** is defensible as a design choice: it aligns with real-world payer review timelines, and the cold-SLOAD cost per disputed claim (~$0.025 at 4 cold slots × 1M gas) is negligible in absolute terms. The ERC-7201 `DisputeStorage` internal namespace (recommended in prior research) avoids the cross-contract CALL overhead but does not eliminate the cold-SLOAD penalty for the dispute record itself. A "claim ping" heartbeat (no-op warm read) for high-value disputed claims can mitigate this at minimal cost.
  — Synthesis from prior research and this investigation.
  — Assessment: Medium confidence (design synthesis; not validated against live payer systems).

- **Governance control required:** The dispute window should be stored as a governance-controlled `uint256 public disputeWindowSeconds` in `ClaimsAdjudicator` (behind `TimelockController`), not hardcoded. Payer contracts may require different windows, and early-stage calibration against real adjudication latency is essential.
  — [OpenZeppelin TimelockController](https://docs.openzeppelin.com/contracts/4.x/governance#timelock)
  — Assessment: High confidence.

---

### Finding 5: Cold-SLOAD exposure at dispute resolution scales with window length — hot-slot pattern reduces worst-case cost

- From prior research: a hot/cold struct split (Slot 0: status + timestamps, Slot 1+: claim hash + amounts) means dispute resolution reads **at most 3 cold slots** (claim hash, settlement amounts, attestor). At 1M gas each, worst-case cold read cost = ~3M gas per disputed claim = ~$0.018 at current gas pricing. This is low but non-trivial if hundreds of claims dispute simultaneously.
  — Prior research: [[claim-struct-packing-cold-sload-dispute-architecture]]
  — Assessment: High confidence for formula.

- The ERC-7201 `DisputeStorage` internal namespace (recommended in [[claims-dispute-registry-separate-vs-erc7201-internal]]) writes a compact `DisputeRecord` at dispute-initiation time (when the claim is warm), providing a warm-read path at resolution. This pattern **effectively transfers the cold-SLOAD risk from resolution time to initiation time**, where the claim record is most likely warm. This is the correct optimization.
  — Prior research: [[claims-dispute-registry-separate-vs-erc7201-internal]]
  — Assessment: High confidence.

---

**Design implication:** Somnia's BFT consensus imposes **no protocol-level challenge window**. The "48-hour OpPC window" referenced in prior cliqueue research is an application-layer parameter entirely within cliqueue's control. `ClaimsAdjudicator` should implement a governance-controlled `uint256 disputeWindowSeconds` (defaulting to 172,800 = 48 hours), matched to real payer review timelines and independent of Somnia's consensus parameters. The cold-SLOAD risk at dispute resolution is proportional to window length and is best mitigated by the ERC-7201 `DisputeStorage` pattern (writes a warm dispute record at initiation), not by shortening the window below operational requirements. The `createAdvancedRequest timeout` parameter (default 15 minutes) is a completely separate concept governing LLM Inference oracle latency, not the claims dispute period.

**Open questions generated:**
1. Should `disputeWindowSeconds` have a network-level minimum floor (e.g., 21,600 = 6 hours, enforced by `TimelockController` min-delay logic) to prevent governance from setting an operationally unworkable sub-hour window — and should this floor be documented in the hospital BAA as a settlement finality guarantee? — added 2026-05-16, priority: high
2. Should cliqueue define a "dispute trigger" event (`ClaimDisputed(bytes32 indexed claimId, address indexed disputant, uint256 disputeWindowEnd)`) that hospital and payer monitoring systems subscribe to via Ormi/Somnia WebSocket — enabling automated payer back-office systems to flag the claim for manual review within the dispute window without polling? — added 2026-05-16, priority: high
3. At what claim volume (claims per day) does the cold-SLOAD cost for simultaneous disputed claims (3M gas per claim × N disputed claims) approach Somnia's block gas limit — and should `ClaimsAdjudicator` enforce a max-disputes-per-block rate limit to prevent a coordinated mass-dispute attack from blocking legitimate settlements? — added 2026-05-16, priority: medium

---

**See also** — [[../topics/dispute-window|dispute-window hub]]
