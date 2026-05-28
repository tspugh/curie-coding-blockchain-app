# Dispute-Listener WebSocket Connection Affinity and Missed-Event Recovery

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should cliqueue's dispute-listener implement connection affinity (pinning to one WebSocket backend node) to avoid the documented eth_unsubscribe failure on Somnia load-balanced endpoints — and does this require a dedicated non-load-balanced WebSocket endpoint from a third-party RPC provider?

---

### Finding 1: Somnia's own JSON-RPC documentation explicitly warns that eth_subscribe subscriptions are connection-scoped and eth_unsubscribe fails across backends

- Somnia's JSON-RPC API reference contains an explicit warning (confirmed by direct page fetch 2026-05-16): "Subscriptions created with `eth_subscribe` are also connection-scoped. `eth_unsubscribe` returns `false` if the subscription id is unknown or belongs to a different connection." The same section warns that `eth_newFilter`, `eth_newBlockFilter`, and `eth_newPendingTransactionFilter` are similarly scoped, and that on load-balanced public RPC endpoints "subsequent requests may be routed to a different backend, causing `eth_getFilterChanges` to return empty results or `eth_uninstallFilter` to return `false`."
  - Source: https://docs.somnia.network/developer/json-rpc-api
  - Assessment: High confidence — primary source, official Somnia docs, direct page fetch confirmed.

- The workaround advised in Somnia's docs is: "For reliable filter-based polling, use a dedicated RPC endpoint or switch to `eth_subscribe` over WebSocket." This is internally contradictory for the WebSocket case — the advice to use `eth_subscribe` as a workaround applies to filter polling, but `eth_subscribe` itself is also connection-scoped. The implication is that a **persistent, non-load-balanced WebSocket connection** is the required mitigation for `eth_subscribe` users.
  - Source: https://docs.somnia.network/developer/json-rpc-api
  - Assessment: High confidence on the warning; medium confidence on the interpretation (the docs do not spell out explicitly that `eth_subscribe` itself requires a persistent single-backend connection).

---

### Finding 2: The failure mode is well-understood — subscription state lives on the backend node, not in the load balancer

- Standard EVM node behavior (confirmed across go-ethereum, Erigon, and general Ethereum JSON-RPC): WebSocket `eth_subscribe` creates a subscription in the memory of the specific backend process that accepted the connection. The subscription ID is a random 32-byte hex value meaningful only to that process. If the load balancer routes a subsequent WebSocket frame to a different backend process, that process has no knowledge of the subscription and returns `false` from `eth_unsubscribe`. Events will also stop arriving because the subscribing backend routes them to the original connection, which may no longer be active.
  - Source (Erigon known bug where eth_subscribe topic filtering delivered no events due to a different backend issue): https://github.com/erigontech/erigon/issues/4030
  - Source (ethers.js community discussion on WebSocket reconnect and resubscribe): https://github.com/ethers-io/ethers.js/issues/4587
  - Assessment: High confidence as general EVM behavior; specifically applies to Somnia given Somnia's own warning.

---

### Finding 3: GetBlock is the primary confirmed RPC provider with Somnia mainnet support, including dedicated (non-load-balanced) node infrastructure

- GetBlock added Somnia mainnet RPC/WebSocket support in 2026 (blog post confirmed). GetBlock's product includes both shared nodes (load-balanced, subject to the connection-affinity problem) and dedicated nodes (custom-configured, private infrastructure with no shared backend routing). Dedicated nodes on GetBlock are explicitly described as private infrastructure with no RPS limits.
  - Source: https://getblock.io/blog/getblock-adds-somnia-mainnet-rpc-api-support/
  - Source: https://getblock.io/nodes/somnia/
  - Source: https://getblock.io/dedicated-nodes/
  - Assessment: Medium confidence — GetBlock's dedicated node offering is confirmed, but an explicit statement that dedicated nodes provide sticky WebSocket sessions (connection-to-single-backend) was not found in the page content fetched. This is the expected behavior of a dedicated single-node deployment, but is not stated explicitly in the Somnia-specific docs.

- GetBlock dedicated nodes are enterprise-tier: pricing starts from $1,000/month (provider-wide, not Somnia-specific). This cost is a procurement consideration for MVP hospital deployments.
  - Source: https://getblock.io/dedicated-nodes/
  - Assessment: Medium confidence — pricing cited from provider overview page; Somnia-specific dedicated pricing may differ.

- No other confirmed providers with Somnia mainnet WebSocket support were identified in this research iteration. Chainstack, Validation Cloud, dRPC, and Ankr were searched but no Somnia-specific pages were found.
  - Assessment: Weak — absence of evidence is not evidence of absence; these providers may have added Somnia support post-search.

---

### Finding 4: ethers.js v6 WebSocketProvider does NOT automatically resubscribe after reconnection — manual reconnect + resubscribe logic is required

- ethers.js issue #4587 confirms that automatic reconnect/resubscribe was "planned" as of 2023–2024, implying it was not yet implemented reliably. Community guidance for 2025–2026 production use still relies on manual `close`/`error` event handlers that tear down the provider and recreate it.
  - Source: https://github.com/ethers-io/ethers.js/issues/4587
  - Source: https://github.com/ethers-io/ethers.js/issues/1053
  - Assessment: Medium confidence — GitHub issues are not official release notes; the current v6 release state may have improved. Treat as "do not rely on auto-resubscribe" until confirmed by testing.

---

### Finding 5: The industry-standard missed-event recovery pattern is checkpoint + eth_getLogs backfill on reconnect

- Production blockchain event listeners implement a "live stream + historical backfill" pattern:
  1. Checkpoint the last fully processed block number (and log index) in a durable store (hospital-local database or Ormi subgraph entity).
  2. On WebSocket reconnect: fetch logs from `lastSeenBlock + 1` to current head via `eth_getLogs`.
  3. Deduplicate by `(blockNumber, transactionHash, logIndex)` to avoid double-processing.
  4. Resume live `eth_subscribe` from current head onward.
  - Source: https://docs.chainstack.com/docs/ethereum-redundant-event-llstener-ethers-web3js
  - Source: https://www.quicknode.com/guides/ethereum-development/transactions/how-to-stream-pending-transactions-with-ethersjs
  - Assessment: High confidence — this pattern is consistent across multiple provider guides and is the de facto standard.

- For cliqueue's dispute-listener, the checkpoint should be stored in the hospital-local PostgreSQL store (same store as the `claimId → CLM01` EDI mapping). This ensures the checkpoint survives middleware restarts without requiring a Somnia subgraph query on boot.
  - Assessment: Design inference — high confidence as a practical recommendation.

---

**Design implication:** The dispute-listener MUST implement connection affinity via one of two paths: (A) a GetBlock dedicated node (or equivalent single-backend non-load-balanced endpoint) as the WebSocket target, avoiding the Somnia-documented `eth_unsubscribe` failure mode entirely; or (B) an application-level reconnect + resubscribe + `eth_getLogs` backfill pattern that makes the failure mode survivable without data loss. Path B is recommended for MVP because it works with Somnia's free public WSS endpoint (`wss://dream-rpc.somnia.network/ws`) and does not require a $1,000/month dedicated provider commitment. Path A is recommended for production deployments at hospital scale ($10M+ TVL) where the operational risk of missed dispute events is contractually significant. Both paths should be documented in the dispute-listener spec. ethers.js v6 `WebSocketProvider` must NOT be relied upon for auto-resubscribe; the dispute-listener must implement its own reconnect loop.

**Open questions generated:**
1. Should cliqueue's dispute-listener spec mandate Path B (reconnect + resubscribe + `eth_getLogs` backfill) as the default MVP implementation — with the checkpoint stored in the hospital-local PostgreSQL store — and explicitly document that Somnia's public WSS endpoint is acceptable for MVP but a dedicated provider endpoint is recommended for $10M+ TVL production deployments?
2. At what claim dispute volume (disputes per day) does the `eth_getLogs` backfill on reconnect (fetching all `ClaimDisputed` events from `lastSeenBlock` to `head`) become a latency bottleneck — and should the backfill query be bounded to a configurable maximum block range (e.g., 24 hours × ~400 blocks/minute = ~576,000 blocks) with an alert if the gap exceeds that bound?
3. Should cliqueue proactively test GetBlock's dedicated Somnia node to empirically confirm that WebSocket subscriptions are pinned to a single backend process (not load-balanced across GetBlock's internal cluster) — and publish this test result alongside the topic[1] filter canary test in the deployment runbook?

---

**See also** — [[../topics/dispute-window|dispute-window hub]]
