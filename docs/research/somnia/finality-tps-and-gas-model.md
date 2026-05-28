# Somnia Finality, TPS, and Gas Model

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — Somnia's finality guarantees, TPS reality, gas model, and agent-invocation state machine

### Finality: sub-second in practice, not instantaneous in marketing

- Somnia uses **MultiStream Consensus** — a partially synchronous, proof-of-stake BFT protocol inspired by the 2024 "Autobahn BFT" whitepaper. Every validator publishes its own "data chain"; a consensus chain references the tips of all data chains per round. The result is deterministic transaction ordering (same inputs → same state on all nodes) with no rollback risk once a block is confirmed.
  — [Somnia docs: MultiStream Consensus overview](https://docs.somnia.network/concepts)
- Formal guarantee: **deterministic (instant) finality once a consensus block is committed**, because the BFT protocol guarantees no forks. Somnia's own docs state "0 seconds TTF" (time to finality), meaning once a transaction appears in a committed consensus block it is final — there is no probabilistic waiting period.
  — [Chainspect: Somnia TPS/Block Time/TTF](https://chainspect.app/chain/somnia)
- **Block time: 0.1 seconds** (100 ms target). This is the interval between consensus blocks; finality is tied to inclusion in a consensus block, so practical time-to-finality for a payment-release event is the block interval (~100 ms) plus transaction propagation latency.
  — [Chainspect: Somnia](https://chainspect.app/chain/somnia); [Somnia FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/general-faqs)
- The official FAQ states: "most transactions are confirmed in less than one second, making it ideal for real-time applications." This is a practical operational statement — the theoretical TTF is the 100 ms block interval; actual user-experienced latency is slightly higher.
  — [Somnia General FAQs](https://docs.somnia.network/developer/deployment-and-production/support-and-community/general-faqs)

### TPS: claimed 1M, devnet 134K peak, mainnet currently ~3–8 TPS average

- **Marketing claim: 1,050,000 TPS** — achieved in a controlled devnet benchmark (ERC-20 swaps across 100+ globally distributed nodes). Also: 50K Uniswap swaps/second on one pool; 300K NFT mints/second on one contract.
  — [Chainwire: Somnia Shannon Testnet launch](https://chainwire.org/2025/02/23/somnia-launches-shannon-testnet-following-1m-tps-devnet-benchmarks/)
- **Chainspect measured peak (100-block window): 134,642 TPS** — the highest independently observable peak on mainnet.
  — [Chainspect: Somnia](https://chainspect.app/chain/somnia)
- **Mainnet actual utilization (as of May 2026): ~3.52 TPS** (1-hour average per Chainspect). Messari Q4 2025 report shows ~8 million transactions per day average (≈ 92 TPS), down 70.5% QoQ from a Q3 peak driven by launch-day incentives.
  — [Chainspect: Somnia](https://chainspect.app/chain/somnia); [Messari: State of Somnia Q4 2025](https://messari.io/report/state-of-somnia-q4-2025)
- **Independent verification gap**: CoinDesk noted it could not independently verify some performance claims at mainnet launch (testnet explorer was offline). The 1M TPS figure is a Somnia-controlled benchmark; no third-party audit firm has published an independent throughput certification.
  — [CoinDesk: Somnia Mainnet Goes Live](https://www.coindesk.com/business/2025/09/02/somnia-mainnet-goes-live-along-with-native-somi-token-after-10b-testnet-transactions)
- Mainnet launched September 2, 2025 after a 6-month testnet with >10 billion transactions, 118M addresses, and 60 validators. As of May 2026, total transactions: >2.7 billion (including testnet).
  — [Improbable: Somnia mainnet launch](https://www.improbable.io/news/improbable-developed-somnia-launches-mainnet-after-record-breaking-testnet-performance)

### Gas model: dramatically different from Ethereum — critical for state-machine design

- **Base transaction cost**: 21,000 gas (same floor as Ethereum). On mainnet, fees are paid in SOMI; on testnet in STT.
  — [Somnia Gas Fees Docs](https://docs.somnia.network/concepts/tokenomics/gas-fees)
- **Base gas price at 400 TPS: $0.00000000616 per gas unit** → a 21,000-gas base transaction costs ~$0.00013 (sub-cent). At lower TPS the price is higher but still sub-cent.
  — [Somnia Gas Fees Docs](https://docs.somnia.network/concepts/tokenomics/gas-fees)
- **Volume discount**: tiered discounts up to 90% at 400+ TPS for any single application. Cliqueue-coding-blockchain would likely qualify if claim volume is high, but discount requires consistent sustained throughput over 1-hour windows.
  — [Somnia Gas Fees Docs](https://docs.somnia.network/concepts/tokenomics/gas-fees)
- **Storage costs are asymmetric (critical for claim state machine)**:
  - Cached state read (within last 128M recently-accessed slots): **100 gas** (cheap)
  - **Uncached SLOAD: +1,000,000 gas surcharge** — this is a major design constraint. A state transition that reads a cold claim record will cost ~$0.006 at current pricing, 10,000× the normal read cost.
  - New storage write (SSTORE for new slot, 32 bytes permanent): **200,000 gas**
  — [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)
- **Cryptographic precompiles are 50–250× more expensive than Ethereum** (ecRecover: 150K vs 3K gas; ecPairing: 250× cost). ZK proof verification via pairing precompiles is economically prohibitive in the current gas model.
  — [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)
- **LOG operations are ~13× more expensive** than Ethereum (LOG0: 8,320 vs 631 gas). Every on-chain state-change event emitted for the claims audit trail costs more than expected.
  — [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)

### On-chain agent invocation state machine (native Somnia Agents runtime)

- Somnia has a **native Agent invocation protocol** distinct from `somnia-agent-kit`. Smart contracts call `createRequest(agentId, callbackAddress, callbackSelector, payload)` — this is payable (must deposit SOMI/STT). An advanced variant allows configuring subcommittee size, consensus threshold (Majority or Threshold), and timeout.
  — [Somnia Docs: Invoking Agents from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)
- The on-chain agent invocation **state machine has 5 states**: Pending → Success | Failed | TimedOut (+ None for uninitialized). This maps directly onto the cliqueue claims state machine (submitted → adjudicated → attested → disputed → settled), though the mapping is not 1:1.
  — [Somnia Docs: Invoking Agents from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)
- The callback pattern `handleResponse(requestId, responses[], status, details)` delivers validator consensus results back to the calling contract. Contracts must verify `msg.sender == platformAddress` and track pending requests via mapping to prevent spoofed callbacks.
  — [Somnia Docs: Invoking Agents from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)
- **Per-agent execution cost example: ~0.03 ETH-equivalent** (documentation example). Actual varies by agent complexity. Deposit covers: (a) operations reserve for gas refunds to validators, (b) agent reward pot split equally among subcommittee validators, each paid the median reported execution cost.
  — [Somnia Docs: Invoking Agents from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)

### somnia-agent-kit production status

- The `somnia-agent-kit` npm package (by xuanbach0212) is **battle-tested on Somnia Testnet** but has no confirmed production mainnet deployments in publicly disclosed projects as of May 2026. The kit originated as a hackathon submission (DoraHacks) and is a community SDK.
  — [somnia-agent-kit GitBook](https://somnia-agent-kit.gitbook.io/somnia-agent-kit); [GitHub: xuanbach0212/somnia-agent-kit](https://github.com/xuanbach0212/somnia-agent-kit)
- Somnia itself has built a **separate first-party agent infrastructure** (native Agents runtime, Data Streams). Emerging ecosystem use cases: Prophecy Social (AI prediction market), autonomous DeFi agents, high-throughput gaming contracts. Insurance specifically flagged as a target use case for Prediction Conference 2026.
  — [PlayToEarn: Somnia repositioning as Agentic L1](https://playtoearn.com/news/somnia-network-completes-repositioning-as-agentic-l1-with-somnia-agents-live-and-ai-compute-running-onchain)

**Design implication:** The 100 ms block time and deterministic BFT finality confirm that Somnia's settlement layer is technically capable of sub-second payment release — adequate for the cliqueue claims state machine. However, the cold-SLOAD gas surcharge (1M gas for any uncached storage read) is a critical design constraint: the claims adjudication contract must ensure all in-flight claim state is cached (recently accessed) to avoid $0.006+ reads per state transition. The 50–250× precompile cost makes ZK proof verification economically impractical for attestation; multi-sig or threshold-signature attestation schemes are preferred. The native Somnia Agents 5-state machine (Pending/Success/Failed/TimedOut/None) can serve as a template for the cliqueue 5-state adjudication flow.

**Open questions generated:**
1. How does Somnia's cold-SLOAD 1M-gas surcharge interact with a claims state machine that may need to read old (cold) claim records for dispute resolution? Should disputes involve a separate hot-cache tier contract?
2. What is the economic model for the cliqueue agent-invocation deposit (coding agent reward per claim)? At $0.03/invocation example cost, what does the per-claim economics look like vs. the $4–10 outsourced coding benchmark?
3. Is there a Somnia-first-party agent framework that supersedes `somnia-agent-kit` for production use? The native Agents runtime (createRequest/handleResponse) appears more battle-tested — should cliqueue use it directly rather than the community kit?

---

**See also** — [[../topics/somnia-substrate|Somnia substrate hub]] · [[../topics/dispute-window|dispute-window hub]] · [[../topics/settlement-stablecoin|settlement hub]]
