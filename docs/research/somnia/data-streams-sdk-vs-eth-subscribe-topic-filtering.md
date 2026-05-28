# Somnia Data Streams SDK vs. eth_subscribe — Topic Filtering Architecture

## 2026-05-16 — Does Somnia Data Streams SDK support server-side topic[1] filtering for indexed bytes32 claimId, or must cliqueue's dispute-listener use raw eth_subscribe?

- The Somnia Data Streams SDK `topicOverrides` parameter accepts up to 4 `bytes32` topic values (topic[0]–topic[3]). Omitting a position is treated as a wildcard subscription. The parameter is documented as supporting all four topic positions, but all official examples show only topic[0] (the event signature selector) being populated — no example filters on an indexed parameter at topic[1] or higher.
  - Source: https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md

- The Data Streams SDK `context` parameter (values: `topic0`, `topic1`, `topic2`, `topic3`, `topic4`, `data`, `address`) is for **data extraction/enrichment** — specifying which fields from the matched event to pass downstream into `ethCalls` or `onData`. It does not add a filter constraint; it only selects fields to surface in the callback.
  - Source: https://docs.somnia.network/somnia-data-streams/getting-started/sdk-methods-guide (search result excerpt, April 2026)

- Somnia's JSON-RPC API reference explicitly documents `eth_subscribe("logs", filterParams)` with a `topics` filter array that follows the same position-semantics as `eth_getLogs`: each position may be a single hash, an OR-list of hashes, or `null` as a wildcard. This means `topics: [ClaimDisputedSig, claimIdHash]` is a valid server-side filter that returns only `ClaimDisputed` events for a specific `claimId`.
  - Source: https://docs.somnia.network/developer/json-rpc-api.md (fetched directly — "same topic-position semantics as eth_getLogs... each position may be a single hash, an OR-list of hashes, or null as a wildcard")

- Standard `eth_subscribe("logs")` topic[1] filtering is the de-facto EVM standard, implemented consistently in go-ethereum, Nethermind, Erigon, and Besu — and mirrored by all major RPC providers (Infura, QuickNode, Chainstack, dRPC). However, there is no finalized EIP (EIP-234 is eth_getProof; EIP-758 is a draft subscription proposal not yet ratified) that normatively mandates this behavior — it is de-facto standard, not EIP-enforced.
  - Source: https://docs.metamask.io/services/reference/ethereum/json-rpc-methods/subscription-methods/eth_subscribe/
  - Source: https://docs.chainstack.com/reference/ethereum-subscribelogs
  - Source: https://www.quicknode.com/docs/ethereum/eth_subscribe

- A known Erigon bug (issue #4030) demonstrated that `eth_subscribe` with topic filters returned no events at all on one client version — this was a blocking issue for Chainlink. Somnia uses its own high-throughput AOT-compiled EVM, not a standard client fork, so empirical testing of topic[1] filtering before production deployment is warranted.
  - Source: https://github.com/erigontech/erigon/issues/4030

- The Data Streams SDK is architecturally designed for composable streaming pipelines with on-chain data enrichment (contract state reads via `ethCalls`, reactive triggers). It is not the right tool for targeted per-claim event subscription in a healthcare dispute-listener where only events matching a specific `claimId` are relevant. Its overhead (schema registration, enrichment pipeline) is unnecessary for cliqueue's dispute-listener use case.

- Ethers.js `provider.on(filter, callback)` over Somnia's WebSocket RPC endpoint is the correct implementation path. The filter object takes `{ address: adjudicatorAddress, topics: [ClaimDisputedSig, claimIdHash] }` — with `claimIdHash` being the ABI-encoded (zero-padded) `bytes32` value of the claimId. Ethers.js handles the encoding and internally calls `eth_subscribe("logs", ...)`.

**Design implication:** The dispute-listener should use raw `eth_subscribe` (via ethers.js `provider.on`) with a `topics: [eventSig, claimIdHash]` filter rather than the Somnia Data Streams SDK — this gives confirmed server-side per-claimId filtering with standard EVM semantics, reduces library footprint, and avoids the SDK's enrichment-pipeline overhead. A canary test emitting a known `ClaimDisputed` event and verifying topic[1] filter delivery should be in the pre-deployment runbook.

**Open questions generated:**
1. Does Somnia's AOT-compiled EVM correctly implement `eth_subscribe("logs")` topic[1] filtering in practice — has any developer published a confirmed test result on Somnia mainnet (chain ID 5031) showing a `topics: [sig, indexedValue]` subscription receiving only matching logs?
2. Should the dispute-listener implement a "missed event" recovery path by calling `eth_getLogs` from the last processed block on WebSocket reconnection — and should the last-processed block be checkpointed in a hospital-local DB or an Ormi subgraph entity?
3. Should cliqueue's pre-deployment canary test suite include a topic[1] filter verification test (deploy a minimal event-emitting contract, subscribe with `topics: [sig, specificValue]`, emit two events with different indexed values, verify only one is received) before directing hospital systems to the live `ClaimsAdjudicator` address?

---

**See also** — [[../topics/somnia-substrate|Somnia substrate hub]] · [[../topics/dispute-window|dispute-window hub]]
