# Conditional Fund Release: Smart-Contract Patterns for the 5-State Adjudication Machine

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — Smart-contract patterns for conditional fund release encoding a 5-state adjudication machine on Somnia, with gas costs per state transition

### The target state machine

The cliqueue adjudication lifecycle maps to five states:

```
Submitted → Adjudicated → Attested → Disputed → Settled
```

(Plus implicit terminal states: Rejected, Paid.) This extends the Somnia native `ResponseStatus` enum (None/Pending/Success/Failed/TimedOut) which only covers the agent-invocation sub-machine; cliqueue needs a richer application-layer state machine on top.

### Canonical Solidity state machine pattern for multi-phase escrow

- The established EVM pattern uses a `uint8` enum (`ClaimStatus`) stored in a packed struct per claim, gated by `modifier atState(ClaimStatus s)`. Transitions are explicit functions that check current state and advance. Modifiers prevent skipped states. Re-entrancy guard (`nonReentrant`) wraps all fund-moving functions.
  — [fravoll/solidity-patterns: state_machine](https://fravoll.github.io/solidity-patterns/state_machine.html); [DEV Community: conditional payments escrow](https://dev.to/sauravkumar8178/day-24-of-30daysofsolidity-build-a-secure-conditional-payments-escrow-system-in-solidity-4hm7)

- Comparable insurance escrow implementations use: `AWAITING_PAYMENT → AWAITING_DELIVERY → COMPLETE → DISPUTED → REFUNDED/CANCELLED`. The pattern maps directly: replace AWAITING_DELIVERY with ADJUDICATED/ATTESTED and REFUNDED with DISPUTED/SETTLED.
  — [DEV Community: conditional payments escrow](https://dev.to/sauravkumar8178/day-24-of-30daysofsolidity-build-a-secure-conditional-payments-escrow-system-in-solidity-4hm7)

- The critical insight for gas: **status is a `uint8` packed into a single storage slot alongside other small claim fields** (timestamps as `uint40`, flags as `bool`). A tightly-packed `Claim` struct uses ≤3 storage slots vs. 5–7 if fields are declared individually. On Somnia, SSTORE of a new (non-zero) slot costs 200,000 gas; updating an existing slot (warm) costs 100 gas. Tight packing pays for itself on the very first state transition.
  — [fravoll/solidity-patterns: tight_variable_packing](https://fravoll.github.io/solidity-patterns/tight_variable_packing.html); [Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)

### Gas cost per state transition on Somnia (modeled)

All figures use Somnia's documented gas costs and assume `baseGasPrice = 5.49e-9 USD/gas` (0 TPS, worst case; at 400 TPS with 90% discount = `5.49e-10`).

| Transition | Key operations | Somnia gas (est.) | USD worst case | USD at 400 TPS |
|---|---|---|---|---|
| Submit claim (new slot) | SSTORE ×2 (new), LOG2 | ~421,440 | ~$0.0023 | ~$0.00023 |
| Mark Adjudicated (warm → update) | SSTORE ×1 warm, LOG1 | ~14,020 | ~$0.000077 | ~$0.0000077 |
| Mark Attested (warm → update) | SSTORE ×1 warm, LOG1 | ~14,020 | ~$0.000077 | ~$0.0000077 |
| Open Dispute (warm → update) | SSTORE ×1 warm + read, LOG2 | ~28,040 | ~$0.00015 | ~$0.000015 |
| Read cold claim for dispute | SLOAD cold (1M gas surcharge) | ~1,000,100 | ~$0.0055 | ~$0.00055 |
| Mark Settled + release funds | SSTORE ×1 warm, ETH transfer, LOG2 | ~50,000 | ~$0.00027 | ~$0.000027 |

Derivation:
- Warm SSTORE (existing slot, value changed): 100 gas (Somnia) — drastically cheaper than Ethereum's ~5,000
- New SSTORE (32 bytes, permanent): 200,000 gas (Somnia)
- LOG0: 8,320 gas; LOG2: ~18,560 gas (Somnia formula: `3200 + 5120×topics + 160×size`)
- Cold SLOAD (existing slot, not in 128M slot cache): 1,000,100 gas — **the dominant cost risk**

**Per-claim total (happy path, no cold reads):** ~460,000 gas ≈ **$0.0025 USD** at worst case, **$0.00025** at volume. Well within the $4–10 outsourced coding benchmark.

**Per-claim total (dispute path with cold SLOAD):** ~1,520,000 gas ≈ **$0.0083 USD** at worst case. Still sub-cent.

**The cold-SLOAD risk:** if a claim record has aged out of Somnia's 128M-slot hot cache (roughly >24h of claims volume at current throughput), any SLOAD for dispute resolution incurs 1,000,000 gas (~$0.0055 per cold read). The design response is a **"warm-tier" side contract** (see Design Implications).
  — [Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum); [Alchemy: Solidity gas optimization](https://alchemy.com/overviews/solidity-gas-optimization)

### AgentVault + AgentExecutor contract roles for cliqueue

From the `somnia-agent-kit` docs:

- **AgentVault** holds the operator's (hospital/insurer) deposited funds. It enforces: per-agent daily spending limits (0.01–100 ether range), caller authorization (only agent address or vault owner can withdraw), active/inactive toggle. This maps to the **pre-funded escrow layer** — payer and provider each pre-fund vaults before claims flow. The vault's `withdrawNative()` function would be triggered by the settlement contract upon final `Settled` state.
  — [somnia-agent-kit GitBook: AgentVault](https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/agent-vault.md)

- **AgentExecutor** executes tasks (`executeTask(agent, data, gasLimit)`) returning a `taskId` (bytes32). Its own state machine is: `Pending → Success | Failed | Reverted`. The executor emits `ExecutionQueued` and `ExecutionCompleted` events. The suggested 500,000-gas-limit, 0.001-ETH-fee example illustrates the magnitude but is not authoritative.
  — [somnia-agent-kit GitBook: AgentExecutor](https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/agent-executor.md)

- **Integration pattern for cliqueue:** the `ClaimsAdjudicator` contract (cliqueue-specific) calls `AgentExecutor.executeTask()` to dispatch the ICD-10 coding agent. The `handleResponse()` callback updates the `ClaimStatus` from `Submitted → Adjudicated`. A separate `AttestationGuard` checks TEE report hash before advancing to `Attested`. The `AgentVault.withdrawNative()` is the final settlement call.

- **AgentVault gap:** the vault currently has no built-in escrow logic — it is a fund-custody contract, not a conditional-release contract. Cliqueue needs to deploy a thin `ClaimsAdjudicator` wrapper that holds funds in escrow and calls vault withdrawal only when `ClaimStatus == Settled`. The vault's daily-limit guard would need to be calibrated to match daily claim volume; miscalibration causes fund release to fail mid-day.
  — [somnia-agent-kit GitBook: AgentVault](https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/agent-vault.md)

### Multi-sig healthcare claim benchmarks (Ethereum mainnet vs Somnia estimate)

From the arXiv multi-sig health insurance paper (2024):
- Ethereum mainnet: claim submission $20.60, multi-sig operation $6.47, deployment $80.22
- Optimism L2: submission $0.089, multi-sig $0.028
- Somnia estimate (modeled): submission ~$0.0023, state transition ~$0.00008 — **roughly 12× cheaper than Optimism, 250× cheaper than Ethereum mainnet for the happy path**

  — [arXiv:2407.17765: Multi-signature health insurance smart contracts](https://arxiv.org/html/2407.17765)

### Upgrade and bug risk: proxy pattern

- Smart contract bugs cannot be patched post-deployment without a proxy. The OpenZeppelin Transparent Proxy or UUPS pattern allows upgrading logic while preserving state and addresses. For a claims state machine, UUPS is preferred (lower gas, no proxy admin confusion). However, upgradeability introduces governance risk — who controls the upgrade key?
  — [OpenZeppelin docs](https://docs.openzeppelin.com/contracts); [ScienceSoft: Smart contracts in insurance](https://www.scnsoft.com/insurance/smart-contracts)

- **Healthcare-specific risk:** if a payer disputes a state transition rule (e.g., what constitutes valid attestation), and the contract is upgraded mid-dispute, the upgrade itself becomes a legal and compliance liability. Cliqueue should implement a **frozen-logic mode** for claims in `Disputed` state — no upgrades while any claim is pending dispute resolution.

### Optimistic challenge-window design (confirmed best fit for healthcare)

- The optimistic rollup analogy holds for cliqueue: post the coding result on-chain (gas-cheap), open a challenge window, release funds if unchallenged. Ethereum's Arbitrum/Optimism use 7-day windows; for healthcare the AAPC-documented 14-calendar-day documentation attachment window is a natural challenge window duration.
  — [ethereum.org: optimistic rollups](https://ethereum.org/developers/docs/scaling/optimistic-rollups/); prior research: oracle-attestation-schemes.md

- Key difference from rollups: cliqueue's challenge is not a fraud proof over an execution trace — it is a **clinical coding dispute**, where the challenger (payer) provides counter-evidence (alternative ICD-10 codes, medical necessity documentation). The on-chain contract only needs to record the dispute and route to arbitration; the clinical judgment is off-chain.

**Design implication:** The `ClaimsAdjudicator` contract should be a thin state-machine wrapper over `AgentVault` with five states encoded as a packed `uint8` in a struct alongside `claimHash` (bytes32), `submittedAt` (uint40), `settledAt` (uint40), and `payerSignature` (bytes). Warm-slot economics on Somnia make state transitions sub-cent at volume. The cold-SLOAD surcharge (1M gas) requires a **dispute-tier contract** that mirrors active disputed-claim states to a hot-slot mapping so dispute resolution does not trigger cold reads. The AgentVault daily-limit guard must be calibrated to exceed daily settlement volume. The happy-path gas per claim (~$0.0023 worst case, $0.00025 at 400 TPS) is economically viable vs. the $4–10 outsourced coding benchmark.

**Open questions generated:**
1. What is the exact daily-limit calibration strategy for the AgentVault when claim volume exceeds the 0.01–100 ether per-day range? At scale ($631/claim × 10,000 claims/day), the vault daily-limit ceiling becomes a bottleneck — is there a multi-vault fan-out pattern?
2. Should the `ClaimsAdjudicator` be UUPS-upgradeable, and if so, how does the frozen-logic mode interact with Somnia's `AgentExecutor` task queue if upgrades are blocked during an active dispute?
3. What is the optimal struct packing layout for a `Claim` record on Somnia to minimize cold-SLOAD exposure while keeping the dispute-tier mirror contract in sync with the primary contract's state?

---

**See also** — [[../topics/dispute-window|dispute-window hub]] · [[../topics/upgradeable-proxy|upgradeable-proxy hub]] · [[../topics/settlement-stablecoin|settlement hub]]
