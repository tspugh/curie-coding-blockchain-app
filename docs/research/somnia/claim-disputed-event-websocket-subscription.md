# ClaimDisputed Event Design and Somnia WebSocket Subscription Architecture

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should cliqueue define a `ClaimDisputed(bytes32 indexed claimId, address indexed disputant, uint256 disputeWindowEnd)` event that hospital and payer monitoring systems subscribe to via Ormi/Somnia WebSocket — and is there a published Ormi WebSocket / `eth_subscribe` API that supports indexed event filtering for this use case?

---

### Finding 1: Somnia's native WebSocket fully supports `eth_subscribe` logs with indexed topic filtering

- Somnia exposes a standard Ethereum-compatible WebSocket endpoint at `wss://api.infra.mainnet.somnia.network/ws` (also aliased as `wss://dream-rpc.somnia.network/ws`). The node supports the standard `eth_subscribe` JSON-RPC method with the `"logs"` subscription type, which accepts a filter object containing `address` (contract address) and `topics` (up to 4 positions, each a bytes32 topic or `null` wildcard).
  — [Listening to Blockchain Events (WebSocket) | Somnia Docs](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/listening-to-blockchain-events-websocket)
  — Assessment: High confidence (Somnia's official docs show an ethers.js `provider.on(filter, callback)` pattern with `topics: [ethers.id("EventName(...)")]`).

- Because `claimId` and `disputant` would be declared `indexed` in the Solidity event, standard EVM topic encoding places `topic[0]` = `keccak256("ClaimDisputed(bytes32,address,uint256)")`, `topic[1]` = `bytes32 claimId`, `topic[2]` = `address disputant` (zero-padded to 32 bytes). A payer agent can subscribe to disputes for a specific claim using `topics: [selector, claimId]` or for all disputes filed by a specific disputant using `topics: [selector, null, disputantAddress]`.
  — EVM log encoding standard (EIP-55, Ethereum Yellow Paper §H); Chainstack eth_subscribe docs: https://docs.chainstack.com/reference/ethereum-native-subscribe-logs
  — Assessment: High confidence (standard EVM behavior applies to any EVM-compatible chain including Somnia).

- The ethers.js subscription pattern from Somnia docs:
  ```javascript
  const filter = {
    address: CLAIMS_ADJUDICATOR_ADDRESS,
    topics: [
      ethers.id("ClaimDisputed(bytes32,address,uint256)"),
      claimId,          // topic[1]: bytes32 — specific claim
      null              // topic[2]: wildcard — any disputant
    ]
  };
  provider.on(filter, (log) => { /* handle dispute */ });
  ```
  — [Listening to Blockchain Events (WebSocket) | Somnia Docs](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/listening-to-blockchain-events-websocket)
  — Assessment: High confidence for pattern; medium confidence that Somnia's node implementation correctly handles multi-topic null-wildcard filtering (no explicit confirmation in docs; this is standard EVM behavior and should be verified with a canary test).

---

### Finding 2: Somnia Data Streams SDK provides a higher-level subscription with enrichment — `topicOverrides` supports up to 4 bytes32 topics

- The Somnia Data Streams SDK (`@somnia/data-streams` or equivalent) provides a `subscribe()` method that accepts a `topicOverrides` parameter: "Up to 4 bytes32 event topics can be supplied. By not defining, this is the equivalent of a wildcard subscription." This is a Somnia-proprietary layer on top of raw `eth_subscribe` that additionally supports `ethCalls` enrichment (executing on-chain reads atomically with the event notification).
  — [SDK Methods Guide | Somnia Docs](https://docs.somnia.network/somnia-data-streams/getting-started/sdk-methods-guide)
  — Assessment: High confidence for feature existence; medium confidence for production readiness/stability.

- Example from the SDK docs (TypeScript):
  ```typescript
  import { toEventSelector } from "viem"

  const disputedSelector = toEventSelector({
    name: 'ClaimDisputed',
    type: 'event',
    inputs: [
      { type: 'bytes32', indexed: true, name: 'claimId' },
      { type: 'address', indexed: true, name: 'disputant' },
      { type: 'uint256', indexed: false, name: 'disputeWindowEnd' }
    ]
  })

  await sdk.streams.subscribe({
    topicOverrides: [disputedSelector],   // topic[0] only — all disputes on the contract
    ethCalls: [{
      to: CLAIMS_ADJUDICATOR_ADDRESS,
      data: encodeFunctionData({
        abi: claimsAdjudicatorAbi,
        functionName: 'getClaimStatus',
        args: [/* decoded claimId from log */]
      })
    }],
    onData: (data) => { /* notify payer back-office */ }
  })
  ```
  — Assessment: Medium confidence (pattern adapted from ERC20 Transfer example in docs; `topicOverrides` array with a single entry matches all events of that type).

- **Key limitation of Data Streams SDK vs. raw `eth_subscribe`:** The Data Streams SDK `topicOverrides` appears to support only topic[0] (event type selector) as a filter, not topic[1..3] (indexed parameter values). Filtering by specific `claimId` or `disputantAddress` requires post-delivery filtering in the `onData` callback rather than server-side topic filtering. This is a meaningful distinction: at high dispute volume, the payer agent receives all `ClaimDisputed` events and must filter client-side.
  — Assessment: Medium confidence (inferred from SDK docs structure; no explicit confirmation that topic[1..3] are supported in `topicOverrides`; raw `eth_subscribe` is the confirmed path for per-claim filtering).

---

### Finding 3: Ormi subgraph provides GraphQL query access but GraphQL subscription support for Somnia is unconfirmed

- Ormi provides "100% spec-compliant" The Graph-compatible subgraph hosting on Somnia, with sub-30ms query response times and 4,000+ requests/second throughput. The Graph Node protocol supports GraphQL subscriptions (real-time push of new entity changes) as part of the spec, but Ormi's hosted Somnia documentation does not explicitly confirm whether GraphQL subscriptions are enabled or what the WebSocket subscription endpoint is.
  — [Ormi Subgraph | Somnia Docs](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph); [Deploy a Subgraph on Somnia using Ormi | Somnia Docs](https://docs.somnia.network/developer/partners/deploy-a-subgraph-on-somnia-using-ormi); Ormi blog: https://blog.ormilabs.com/how-to-deploy-a-no-code-subgraph-in-3-minutes-real-time-blockchain-indexing-with-ormi/
  — Assessment: Medium confidence for query capability; low confidence for subscription capability (unconfirmed, requires direct Ormi contact or testing).

- **Ormi's value for cliqueue is primarily off-the-peg GraphQL query access** to indexed `ClaimDisputed` entities (e.g., "fetch all disputes filed in the last 24 hours for providerHash X"). This is complementary to, not a replacement for, the real-time WebSocket subscription path for event-driven payer back-office notification.
  — Assessment: High confidence for this design distinction.

---

### Finding 4: Payer EHR/RCM systems do not natively support blockchain WebSocket subscriptions — a middleware adapter layer is required

- No major EHR/RCM system (Epic, Oracle Health/Cerner, Waystar, Veradigm) publishes documentation for native blockchain event subscription. Epic's Open@Epic API platform (Feb 2026) expanded prior authorization FHIR R4 APIs but does not include blockchain event integration. Payer RCM back-office systems (Waystar, Availity, TriZetto) process EDI 835 remittance files in batch cycles; none publish real-time blockchain event webhook patterns.
  — [Open@Epic Highlights: Expanded Data Connections | Epic](https://www.epic.com/epic/post/openepic-highlights-expanded-data-connections-for-developers-and-patients/)
  — Assessment: High confidence (negative finding; absence of any published blockchain integration path in major EHR/RCM vendor documentation).

- The required integration pattern is a **cliqueue dispute-listener middleware service** that:
  1. Maintains a persistent Somnia WebSocket connection subscribing to `ClaimDisputed` events from `ClaimsAdjudicator`.
  2. Decodes the event log, looks up the internal payer claim reference via the off-chain `(claimId → CLM01)` EDI adapter mapping.
  3. Fires a webhook, message-queue event (e.g., SQS, RabbitMQ), or HL7 v2 ADT message to the payer's back-office system.
  4. Logs the dispute notification with the `disputeWindowEnd` timestamp for SLA tracking.
  — Assessment: High confidence as architectural inference; no primary source documents this specific pattern.

- The Springer Nature 2025 study on interoperable blockchain networks for healthcare EHRs describes "smart middleware that autonomously monitors blockchain events and processes encrypted data for real-time cross-chain consistency" as the standard integration pattern between public blockchain and EHR systems.
  — [Springer: Interoperable blockchain network for healthcare data using Fabric, Ethereum and IPFS (2025)](https://link.springer.com/article/10.1007/s44163-025-00564-7)
  — Assessment: Medium confidence (architectural parallel; not specific to payer-provider claim disputes).

---

### Finding 5: The `ClaimDisputed` event design should index `claimId` AND `disputant` — `disputeWindowEnd` should be non-indexed

- Standard EVM indexing rules: up to 3 non-`topic[0]` indexed parameters per event. `bytes32 claimId` (indexed) enables per-claim filtering; `address disputant` (indexed) enables per-payer filtering. `uint256 disputeWindowEnd` is non-indexed (emitted in event data, not topic) — it is too large to be useful as a filter key and payer systems consume it as data, not as a filter criterion.
  — EVM Solidity event encoding (EIP-838); [Chainstack: Ethereum logs and filters](https://docs.chainstack.com/docs/ethereum-logs-tutorial-series-logs-and-filters)
  — Assessment: High confidence (standard EVM engineering).

- A companion event `DisputeResolved(bytes32 indexed claimId, bool upheld, uint256 resolvedAt)` would close the loop for payer systems — enabling subscribe-once/unsubscribe-on-resolution monitoring without polling contract state.
  — Assessment: High confidence as design inference.

- **WebSocket connection management:** Somnia docs note that WebSocket connections can time out and periodic keepalive messages are required. The cliqueue dispute-listener middleware must implement reconnect-with-backoff logic and a "missed event" recovery path (re-fetching `ClaimDisputed` events from the last processed block via `eth_getLogs` on reconnection).
  — [Listening to Blockchain Events (WebSocket) | Somnia Docs](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/listening-to-blockchain-events-websocket)
  — Assessment: High confidence.

---

**Design implication:** `ClaimsAdjudicator` should emit `ClaimDisputed(bytes32 indexed claimId, address indexed disputant, uint256 disputeWindowEnd)` and `DisputeResolved(bytes32 indexed claimId, bool upheld, uint256 resolvedAt)`. Payer systems cannot natively subscribe to blockchain events — cliqueue must provide a dispute-listener middleware service (TypeScript, viem WebSocket transport) that subscribes to `ClaimDisputed` events via Somnia's native `eth_subscribe` WebSocket (`wss://api.infra.mainnet.somnia.network/ws`), decodes them, and fires payer-specific notifications (webhook or message queue). The Somnia Data Streams SDK is a viable alternative for event subscription but likely requires client-side filtering for per-claim targeting. Ormi subgraph provides complementary batch-query access to indexed dispute history but GraphQL subscription support is unconfirmed. The dispute-listener middleware is a required deliverable alongside `ClaimsAdjudicator` — it cannot be deferred to hospital integration teams.

**Open questions generated:**
1. Should the cliqueue dispute-listener middleware be a standalone TypeScript service deployed by cliqueue, or a hospital-deployed integration module — and does the choice affect BAA obligations (if cliqueue runs it, cliqueue is a BA processing PHI-adjacent claim references)? — added 2026-05-16, priority: high
2. Does Somnia's Data Streams SDK `topicOverrides` support topic[1] filtering (indexed `bytes32 claimId`) for server-side per-claim filtering, or is client-side filtering in `onData` the only option — and should cliqueue's dispute-listener use raw `eth_subscribe` (confirmed per-claim topic filtering) over the Data Streams SDK for this use case? — added 2026-05-16, priority: high
3. Should the dispute-listener middleware implement a "missed event" recovery path by calling `eth_getLogs` from the last processed block on WebSocket reconnection — and should the last-processed block number be checkpointed in a hospital-local database or in an Ormi subgraph entity to survive middleware restarts? — added 2026-05-16, priority: medium

---

**See also** — [[../topics/dispute-window|dispute-window hub]]
