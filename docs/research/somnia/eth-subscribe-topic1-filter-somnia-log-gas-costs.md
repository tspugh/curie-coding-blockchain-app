# Somnia eth_subscribe Topic[1] Filtering and LOG Opcode Gas Costs

## 2026-05-16 — eth_subscribe topic[1] filter support on Somnia: documented but not empirically confirmed; LOG gas cost is 18× Ethereum baseline (not ~$0.0000062 as previously stated)

**Question answered:** Does Somnia's AOT-compiled EVM correctly implement `eth_subscribe("logs")` topic[1] filtering for indexed parameters in practice — has any developer published a confirmed test result — and should cliqueue's pre-deployment canary suite include a topic[1] filter verification test?

### Findings

- **Somnia's JSON-RPC API documents `eth_subscribe("logs")` topic filtering with standard Ethereum semantics**: The official Somnia JSON-RPC reference states `topics: array or null — "Same topic-position semantics as eth_getLogs / eth_newFilter"`. The `eth_getLogs` section specifies: "each position may be a single hash, an OR-list of hashes, or null as a wildcard." This is textually consistent with standard go-ethereum topic filter behavior. A wscat example is provided using the testnet endpoint `wss://api.infra.testnet.somnia.network/ws` with `{"method":"eth_subscribe","params":["logs",{"address":"0x...","topics":[null,"0x..."]}]}`, demonstrating topic[1] filtering in the documented API.
  - Source: https://docs.somnia.network/developer/json-rpc-api

- **No empirically confirmed developer test result of topic[1] filtering on Somnia mainnet (chain ID 50312) was found**: Multiple GitHub repositories, community blogs, and forum searches produced no developer-published end-to-end test confirming that a `topics: [sig, indexedValue]` subscription on Somnia mainnet delivers only matching logs. The Erigon bug (issue #4030) demonstrated that `eth_subscribe` topic filters returned no events on one client version, causing a Chainlink outage. Somnia uses its own AOT-compiled EVM, not a standard client fork, so empirical risk is non-zero. No Somnia-specific client changelog or test report addressing this was found.
  - Source (Erigon bug reference, prior research): https://github.com/erigontech/erigon/issues/4030
  - Source (Somnia JSON-RPC): https://docs.somnia.network/developer/json-rpc-api

- **Somnia's on-chain reactivity `SubscriptionFilter.eventTopics` uses `bytes32(0)` as wildcard, non-zero as exact-match**: The `SomniaExtensions.SubscriptionFilter` struct has `eventTopics: bytes32[4]`. The ERC tutorial sets `eventTopics[0] = TRANSFER_TOPIC` and `eventTopics[1] = bytes32(0)` (wildcard) for all-sender matching. This confirms that non-zero values at `eventTopics[n]` act as exact-match filters in the on-chain reactivity system. The JSON-RPC `eth_subscribe` uses the same semantic: omit or null = wildcard, non-null hash = exact match at that position. This is consistent but does not prove the JSON-RPC path is correctly implemented.
  - Source: https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial

- **CRITICAL: Somnia LOG opcode gas costs are ~13–18× higher than Ethereum — prior research entry for `StaffingFloorReached` contains an incorrect gas estimate**: The confirmed Somnia LOG formula is `3200 + 5120 * topic_count + 160 * size` vs. Ethereum's `375 + 375 * topic_count + 8 * size`. A LOG2 (2 indexed topics + 32 bytes data) costs **18,560 gas** on Somnia vs. 1,381 gas on Ethereum. The prior research log entry (2026-05-16, [[staffing-floor-reached-event-design]]) states "~1,006 gas (375 base + 375 topic + 256 data)" — this is the Ethereum LOG1 figure and is **wrong for Somnia**. `StaffingFloorReached(bytes32 indexed hospitalId, uint32 currentCount)` emits 2 indexed topics (event sig + hospitalId) and 4 bytes of data. Correct Somnia cost: `3200 + 5120×2 + 160×4 = 13,760 gas` (not ~1,006 gas). At the documented base price of **$0.00000000616 per gas unit**, this is approximately **$0.0000847 per emission** — still negligible in dollar terms but 13.7× higher than the prior estimate.
  - Source: https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum
  - Source: https://docs.somnia.network/concepts/tokenomics/gas-fees (base price $0.00000000616/gas)

- **LOG opcode gas cost table for Somnia (32 bytes data) for reference**:
  | LOG opcode | Topics | Somnia gas | Ethereum gas | Ratio |
  |---|---|---|---|---|
  | LOG0 | 0 | 8,320 | 631 | 13.2× |
  | LOG1 | 1 | 13,440 | 1,006 | 13.4× |
  | LOG2 | 2 | 18,560 | 1,381 | 13.4× |
  | LOG3 | 3 | 23,680 | 1,756 | 13.5× |
  | LOG4 | 4 | 28,800 | 2,131 | 13.5× |
  - Source: https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum

- **Dollar costs remain operationally negligible but are not zero**: `StaffingFloorReached` (LOG2): ~$0.0000847. `ClaimSubmitted` if it uses LOG3 (3 indexed topics): `3200 + 5120×3 + 160×32 = 3200 + 15360 + 5120 = 23,680 gas ≈ $0.000146`. At 10,000 claims/day, event emission for `ClaimSubmitted` (LOG3) would cost ~$1.46/day in pure event gas — negligible. This remains true at 10× scale ($14.60/day). Event emission gas is not a cost driver, but prior research entries citing Ethereum gas costs for Somnia events must be treated as underestimates.
  - Source: https://docs.somnia.network/concepts/tokenomics/gas-fees

- **Somnia's `eth_subscribe` does NOT support `newPendingTransactions`**: The documentation notes this is not supported and replaced with proprietary `somnia_finishedTransactions`, `somnia_finishedBlocks`, and `somnia_watch`. This is relevant only to mempool monitoring, not to event subscriptions for `ClaimsAdjudicator`. The `logs` subscription type is fully supported.
  - Source: https://docs.somnia.network/developer/json-rpc-api

- **Somnia's WebSocket endpoint is load-balanced — `eth_unsubscribe` may fail if routed to a different backend**: The documentation explicitly warns that subscriptions are connection-scoped and `eth_unsubscribe` may fail on load-balanced endpoints. This is a statefulness issue for the dispute-listener: long-lived WebSocket connections must be maintained to the same backend node. The dispute-listener should implement connection-scoped state (subscription ID per connection) and not assume `eth_unsubscribe` will work cross-connection.
  - Source: https://docs.somnia.network/developer/json-rpc-api

**Design implication:** The dispute-listener using `eth_subscribe("logs")` with `topics: [ClaimDisputedSig, claimIdHash]` is documented as supported on Somnia but has not been empirically confirmed by any developer test on mainnet (chain ID 50312). The pre-deployment canary suite MUST include a topic[1] filter verification test before directing hospital systems to live `ClaimsAdjudicator`. Additionally, all prior Somnia gas estimates in research docs that cite Ethereum baseline figures (~375 base + 375/topic) are underestimates by ~13×; correct Somnia LOG gas costs should be used in any future event emission analysis ($0.00000000616/gas × Somnia formula).

**Open questions generated:**
1. Has any developer published a confirmed empirical test result of `eth_subscribe("logs")` with `topics: [sig, indexedValue]` filtering delivering only matching events on Somnia mainnet (chain ID 50312) — and if not, should cliqueue's pre-deployment canary contract test be the first such published confirmation?
2. Does the prior [[staffing-floor-reached-event-design]] finding need a published correction noting the Ethereum-vs-Somnia gas discrepancy — and should a global errata note be added to the research log warning that all event gas estimates before this entry used Ethereum pricing?
3. Given Somnia's 13× higher LOG gas costs vs. Ethereum, should cliqueue audit all planned on-chain events (`ClaimSubmitted`, `ClaimAdjudicated`, `ClaimBatchSettled`, `AttestorCountChanged`, `StaffingFloorReached`) for topic count and data size to compute accurate Somnia emission budgets — and should the per-claim gas economics estimate in [[per-claim-gas-economics-llm-inference-cost]] be revised to include event emission costs?

---

**See also** — [[../topics/somnia-substrate|Somnia substrate hub]] · [[../topics/dispute-window|dispute-window hub]]
