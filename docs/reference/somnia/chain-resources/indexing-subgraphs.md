# Chain resource: Somnia indexing & subgraphs

> **One line:** events your contract emits are cheap to write but awkward to *query* — Somnia gives you three read-paths
> over them: a **hosted subgraph** (The-Graph-style tooling → a GraphQL endpoint) for historical/aggregate queries,
> **raw `eth_subscribe`/`eth_getLogs`** over WebSocket for live, ephemeral listening, and the **Blockscout explorer
> REST API** for ordered history with zero infrastructure of your own.
>
> Upstream: [data indexing & querying](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying.md) ·
> [Ormi subgraph](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph.md) ·
> [Protofire subgraph](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/protofire-subgraph.md) ·
> [listening to events (WebSocket)](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/listening-to-blockchain-events-websocket.md) ·
> [subgraph UIs — Next.js fetch](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-nextjs-fetch.md) ·
> [subgraph UIs — Apollo Client](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-apollo-client.md) ·
> [Ormi Data APIs](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/using-data-apis-ormi.md) ·
> [ecosystem: subgraphs](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/subgraphs.md) ·
> [explorer API, health & monitoring](https://docs.somnia.network/developer/deployment-and-production/explorer-api-health-and-monitoring.md) ·
> [ecosystem: explorers](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/explorers.md) ·
> [JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md). Fetched 2026-05-20; explorer-API page added 2026-05-22; ecosystem explorers page added 2026-05-22; deploy + WebSocket-listener cluster re-verified live 2026-05-22; ecosystem-tools/subgraphs listing re-verified live 2026-05-23 (exactly two providers, deploy URLs un-drifted); query-layer + Blockscout-REST cluster (the audit-UI read path) re-verified live 2026-05-23 — un-drifted; two paraphrases tightened to upstream verbatim.
>
> Map: [chain-resources](../README.md) · Glossary: [Subgraph](../GLOSSARY.md#s) · [Blockscout](../GLOSSARY.md#b) · Roadmap: [`../../../ROADMAP.md`](../../../ROADMAP.md)

## For the blockchain dev: events are write-cheap, query-hard

You already know a contract emits [events/logs](../GLOSSARY.md#e) (`ClaimSubmitted`, `ClaimCountered`, …) and that
logs are far cheaper than storage. The problem is reading them back: a log is keyed by block and topic, so "show every
counter-offer this payer made, newest first" is not a query the chain answers — you would scan blocks yourself. Somnia
gives you two ways out, and the right choice depends on whether you need **history** or **liveness**.

### Path 1 — hosted subgraph (history + GraphQL)

A [subgraph](../GLOSSARY.md#s) is an indexed, queryable view of your events exposed over **GraphQL**. Somnia documents
**exactly two** providers ([ecosystem: subgraphs](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/subgraphs.md) —
re-fetched live 2026-05-23, real content, both create-subgraphs URLs un-drifted; no third provider):

| Provider | Create-subgraphs URL | Site |
|---|---|---|
| **Ormi** | `https://subgraph.somnia.network/` | `https://ormilabs.com/` |
| **Protofire** | `http://somnia.chain.love/` | `http://protofire.io/` |

Ormi uses the **standard The Graph CLI**, so the workflow is the ordinary subgraph one — no Somnia-specific tooling
([Ormi guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph.md)):

```bash
npm install -g @graphprotocol/graph-cli
graph init --contract-name MyToken --from-contract 0xYourTokenAddress --network somnia-testnet mytoken
graph codegen && graph build
graph deploy mytoken \
  --node https://api.subgraph.somnia.network/deploy \
  --ipfs https://api.subgraph.somnia.network/ipfs \
  --deploy-key yourORMIPrivateKey
```

`graph init` scaffolds three files you then edit ([Ormi guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph.md)):
`subgraph.yaml` ("defines the data sources and events to index"), `schema.graphql` (the "structure of your data"), and
`src/<name>.ts` (the "TypeScript logic to handle events"). A schema entity looks like ordinary GraphQL with
`@entity`-annotated types:

```graphql
type Transfer @entity(immutable: true) {
  id: Bytes!
  from: Bytes!
  to: Bytes!
  value: BigInt!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}
```

On deploy, "Ormi will return a GraphQL endpoint where you can begin querying your subgraph"
([Ormi guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph.md)). That
endpoint is what a UI hits for ordered, filtered, paginated history.

The second provider, **Protofire**, runs the *same* `@graphprotocol/graph-cli` and the *same* `schema.graphql` /
`graph init` / `graph codegen && graph build` flow — the divergence is the **auth and deploy target**, plus a
**UI-first onboarding step** ([Protofire guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/protofire-subgraph.md)):

1. Create an account and initialise the subgraph in the hosted UI at `http://somnia.chain.love/` ("click create and
   enter the required details"), which is also where you obtain the access token.
2. Configure `networks.json` (RPC endpoint + start block) alongside `schema.graphql`.
3. Deploy to Protofire's proxy node rather than Ormi's:

```bash
graph deploy --node https://proxy.somnia.chain.love/graph/somnia-testnet \
  --version-label 0.0.1 somnia-testnet/test-mytoken \
  --access-token=your_token_from_somnia_chain_love
```

Queries land in Protofire's hosted graph explorer (e.g. `https://somnia.chain.love/graph/17`). Two caveats for us:
the guide documents **only `somnia-testnet`** — no mainnet network is named — and its `networks.json` example still
uses the legacy RPC `https://dream-rpc.somnia.network`; treat the canonical testnet RPC in
[network-info](https://docs.somnia.network/developer/network-info.md) (`https://api.infra.testnet.somnia.network/`,
recorded in the [README connection table](../README.md)) as authoritative if the two disagree
([Protofire guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/protofire-subgraph.md)).

So the two providers differ in **operations, not query surface**: Ormi authenticates with a `--deploy-key` and returns
a GraphQL endpoint directly; Protofire gates on UI account creation → an `--access-token`, deploys through
`proxy.somnia.chain.love`, and is testnet-only today. Both leave you querying GraphQL.

#### Path 1, continued — querying the subgraph from the audit UI

Path 1 ends at "the provider returns a GraphQL endpoint" — but the audit timeline still has to *read* it. Upstream
documents two client patterns, and the choice is the familiar one: a raw `fetch` or a GraphQL client library. Both hit
the same `proxy.somnia.chain.love` query host Protofire deploys to above — e.g.
`https://proxy.somnia.chain.love/subgraphs/name/somnia-testnet/<name>`.

**`fetch` through a server-side proxy.** The simplest path POSTs a `{ query }` body to the subgraph URL — but a browser
can't call the hosted endpoint directly (CORS), and you don't want the subgraph client-ID sitting in client JS. So the
guide routes the query through a **Next.js server-side API route** (`app/api/proxy/route.ts`, a `POST` handler) that
forwards to `NEXT_PUBLIC_SUBGRAPH_URL` with a `Client-ID` header
([building subgraph UIs — Next.js fetch](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-nextjs-fetch.md)).
The example query is `transfers(first: 10, orderBy: blockTimestamp, orderDirection: desc)` — the latest 10 transfers,
newest first, exactly the audit-timeline shape — and
links each row to `https://shannon-explorer.somnia.network/tx/{transactionHash}`. Updates are a **single `fetch` on
mount** (`useEffect` + `useState`); this example has no live refresh. Env vars `NEXT_PUBLIC_SUBGRAPH_URL` /
`NEXT_PUBLIC_SUBGRAPH_CLIENT_ID`; packages `thirdweb`, `react-query`, `graphql`.

**Apollo Client (with polling).** The second pattern wires `@apollo/client` (`ApolloClient` + `InMemoryCache`) straight
at the subgraph `uri`, defines the query with `gql`, and runs it with `useQuery`
([building subgraph UIs — Apollo Client](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-apollo-client.md)).
The decision-relevant detail for us: live refresh is `useQuery(GET_RECENT_FLIPS, { variables: { first: 10 },
pollInterval: 5000 })`, and upstream states the mechanism in its own words — *"The `pollInterval` automatically
re-executes the query every 5 seconds."* That is **[polling](../GLOSSARY.md#p), not a GraphQL subscription** — the **fourth**
independent confirmation in this folder that the live read-path on Somnia is polling, not a push subscription (the
[Data Streams](data-streams.md) article found the same in three separate worked examples) — so the "subscribe for the
new event, then re-query" model in *For the AI engineer* below is, in every documented UI, "**poll** the subgraph every
few seconds," with the WebSocket listener (Path 2) the only true push surface. Node.js 20+; packages `@apollo/client`,
`graphql`.

So the subgraph query layer mirrors the deploy layer — same GraphQL surface, two ergonomics. `fetch`-through-a-proxy
keeps the dependency surface minimal and gives you **one place (the API route) to enforce the PHI/scope boundary** on
what leaves the server; Apollo buys you caching and `pollInterval` for free. Either way the query projection (`first`,
`orderBy: blockTimestamp`, `orderDirection: desc`) is the audit timeline's "newest counter-offer first" ordering done
server-side, not by hand-scanning logs.

### Path 2 — direct WebSocket log subscription (live + ephemeral)

For "tell me the instant this contract emits this event," subscribe over the WebSocket [RPC](../GLOSSARY.md#r) instead.
The [JSON-RPC page](https://docs.somnia.network/developer/json-rpc-api.md) documents `eth_subscribe` over the WS
endpoint (`wss://api.infra.testnet.somnia.network/ws`, mainnet `…mainnet…`) with these subscription types:
`newHeads`, `logs`, plus Somnia-specific `somnia_finishedTransactions`, `somnia_finishedBlocks`, and `somnia_watch`.
Two constraints to design around:

- `eth_subscribe` over HTTP returns `"events_not_supported"` — subscriptions are **WebSocket-only**.
- `newPendingTransactions` is **not** supported.

The upstream walkthrough uses **ethers.js v6**
([listening guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/listening-to-blockchain-events-websocket.md)):

```js
import { ethers } from "ethers";
const provider = new ethers.WebSocketProvider("wss://api.infra.testnet.somnia.network/ws");
await provider._waitUntilReady();

const filter = { address: contractAddress, topics: [ethers.id("ClaimCountered(bytes32,bytes32,uint256)")] };
provider.on(filter, async (log) => { /* react */ });
```

Three operational details the guide calls out: a **keepalive** (`provider.getBlockNumber()` on a 30 s
`setInterval`) so the socket doesn't time out; a **backfill** on startup
(`contract.queryFilter('EventName', currentBlock - 100, currentBlock)`) to catch events you missed while disconnected;
and a **reconnect loop** (retry up to 5×, 5 s backoff). For one-shot historical pulls there is also `eth_getLogs`, but
note the **block range must not exceed 1000 blocks** per call — a limit that applies equally to `eth_newFilter` and
`eth_getFilterLogs` ([JSON-RPC](https://docs.somnia.network/developer/json-rpc-api.md)). Subscribing over HTTP fails
with `{"error":{"code":-1,"message":"events_not_supported"}}` rather than silently degrading, so the WS-only
constraint surfaces loudly in development ([JSON-RPC](https://docs.somnia.network/developer/json-rpc-api.md)).

### Path 3 — Blockscout explorer REST API (history, zero deployment)

There is a third read-path the two above miss, and for a short demo it may be the cheapest of all. Somnia's explorers run
**[Blockscout](../GLOSSARY.md#b)**, which exposes a **REST API** at `/api` on both networks — testnet
`https://shannon-explorer.somnia.network/api`, mainnet `https://explorer.somnia.network/api`
([explorer API, health & monitoring](https://docs.somnia.network/developer/deployment-and-production/explorer-api-health-and-monitoring.md)).
Blockscout offers four query interfaces over the same index — "REST API," "RPC API," "ETH RPC API," and "GraphQL" — so
you get ordered, paginated history **without deploying a subgraph or running an indexer of your own**.

The endpoints that matter for an audit timeline (all `GET`, from the
[monitoring guide](https://docs.somnia.network/developer/deployment-and-production/explorer-api-health-and-monitoring.md)):

| Endpoint | Returns |
|---|---|
| `GET /v2/addresses/{address}/transactions` | every transaction for an address, paginated |
| `GET /v2/transactions/{txHash}` | a single transaction's data |
| `GET /v2/blocks/{blockNumber}` | a block's data |

`/v2/addresses/{address}/transactions` is the direct hit: point it at an **agent's address** and you get that agent's
full, ordered, paginated transaction history — the "who proposed what, when" timeline keyed by agent address, with no
subgraph to deploy and no schema to maintain. The trade-off against Path 1 is **query expressiveness**: Blockscout
returns transactions and decoded logs, not the arbitrary GraphQL projections (`claim.counterOffers(orderBy: …)`) a
custom subgraph schema gives you. The same upstream page documents the **client-side** monitoring shape it expects
around these calls — "enterprise-grade logging" with Winston (structured JSON, file rotation at 5 MB / 5 files retained,
separate request and error logs) and "automatic request/response logging" via Axios interceptors
([monitoring guide](https://docs.somnia.network/developer/deployment-and-production/explorer-api-health-and-monitoring.md)).
That is application-side instrumentation, not an explorer SLA: the page documents **no** uptime guarantee, rate limit, or
indexing-latency figure (flagged unsourced — the same gap as open question 2 below).

There is also a **second, independently-operated explorer** to fall back to. Upstream's
[ecosystem: explorers](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/explorers.md)
listing names **two** explorer services for Somnia: Blockscout (the `shannon-explorer` / `explorer.somnia.network`
endpoints above) and **Exploreme**, operated by Stakeme (testnet `https://testnet.somnia.exploreme.pro/`, mainnet
`https://somnia.exploreme.pro/`). For Curie this is a **liveness fallback**, not a second read-path: if Blockscout's
hosted UI is down mid-demo, a human can still read our verified `ClaimSettlement.sol` and its transactions on Exploreme.
But the **documented programmatic read-path stays Blockscout's** — the ecosystem page gives Exploreme only its URLs, no
`/api` surface, so the `GET /v2/...` audit-timeline endpoints in the table above are sourced for Blockscout alone; do not
assume Exploreme exposes the same REST shape without verifying it
([ecosystem: explorers](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/explorers.md)).

> **Indexing vs. Reactivity — don't conflate them.** This article's Path 2 (`eth_subscribe` / ethers
> `WebSocketProvider`) overlaps with Somnia [Reactivity](reactivity.md)'s *off-chain* mode, which rides the same
> `eth_subscribe` transport via the `somnia_watch` parameter but wraps it in the `@somnia-chain/reactivity` SDK
> (`sdk.watch()`). Reactivity is the **state-machine wake mechanism**; indexing is about **reading history for display**.
> See [`GLOSSARY.md` → `somnia_watch`](../GLOSSARY.md#s).

## For the AI engineer: this is your read model

If you build agents, think of indexing as the **read side of CQRS**: the contract is the write-authoritative log, and the
subgraph is a denormalised, queryable projection of it. You do not put query logic in the agent; you let the subgraph
materialise it and ask GraphQL. Two ideas worth internalising:

- **A subgraph is a typed, queryable memory of what happened on-chain — without trusting a backend.** Anyone can run
  the same subgraph against the same contract and get the same answer, because the source of truth is the verified
  on-chain event stream, not a private database. For an auditable claims protocol that property *is* the product.
- **Liveness and history are different subsystems.** The live WebSocket listener drives "something just happened, update
  the screen"; the subgraph answers "what is the full ordered story of this claim." A robust UI uses both: subscribe for
  the new event, then re-query the subgraph for the authoritative ordered view.

## How Curie V1 uses it

Indexing powers the **UI audit timeline** — the "who proposed what, who signed what, when, and why" view that is the
literal payoff of the [demo loop](../../../ROADMAP.md) ([ROADMAP](../../../ROADMAP.md) → demo loop step 8; Spec 005
"visible event timeline"). Both read-paths map to ROADMAP work already on the board:

- **Subgraph → the audit timeline.** ROADMAP's "Add event indexing helpers" and the Spec 005 audit timeline want ordered,
  queryable history of `ClaimSubmitted` / `ClaimCountered` / `ClaimAgreed` / `ClaimSettled`. A subgraph over
  `ClaimSettlement.sol`'s events is the clean way to feed that view instead of hand-scanning logs
  ([ROADMAP](../../../ROADMAP.md) → "Add event indexing helpers", Spec 005).
- **WebSocket listener → "Somnia speed" live demo.** ROADMAP's polish week wants an "event listener that updates UI
  live" and to "show Somnia speed: multiple claims negotiated/anchored quickly" — that is Path 2, the ethers
  `WebSocketProvider` filter ([ROADMAP](../../../ROADMAP.md) → polish week). Sub-second event delivery is what makes the
  negotiation feel real-time on screen.
- **Blockscout REST → the zero-infra fallback timeline.** If the subgraph week slips, a single
  `GET /v2/addresses/{agentAddress}/transactions` per agent yields the same ordered "who proposed what, when" history
  with **no deploy step and no indexer to operate** — only Blockscout's hosted API and an HTTP client. It is the
  lowest-friction way to ship the audit timeline for a short demo, at the cost of the richer GraphQL projections a
  custom subgraph would give a production UI ([monitoring guide](https://docs.somnia.network/developer/deployment-and-production/explorer-api-health-and-monitoring.md)).

**PHI boundary.** Indexed data *is* on-chain event data, so it inherits the hard rule: only hashes, ICD-10 commitments,
agreement states, settlement amounts, and agent addresses are ever emitted — never the clinical note. A subgraph cannot
expose PHI because PHI was never in a log to begin with. Anywhere the timeline shows "why," that "why" is a hash or a
policy reference, per the [ROADMAP](../../../ROADMAP.md) on-chain/off-chain split.

## Open questions (for the research loop)

1. **Ormi vs. Protofire for the demo.** The two now have a documented *operational* difference (see Path 1: Ormi uses a
   `--deploy-key` and is network-agnostic in the guide; Protofire requires UI account creation → `--access-token`,
   deploys via `proxy.somnia.chain.love`, and documents **only** `somnia-testnet`). What is still **unsourced** is the
   decision-relevant data: free-tier limits and indexing latency — upstream states neither, so this stays a measurement
   gap. For a testnet demo the testnet-only constraint is moot; Ormi's single-key deploy is the lower-friction default.
2. **Subgraph indexing lag vs. live listener.** How far behind head does the hosted subgraph run? If it lags, the live
   WebSocket path must visibly fill the gap during the demo. Upstream does not state an indexing-latency figure — flagged
   unsourced.
3. **Do we even need a subgraph for V1?** For a single short-lived demo claim there are now **two** documented ways to
   defer subgraph deployment: a `queryFilter` backfill plus a live subscription (Paths 2), or — newer and lower-friction
   — the Blockscout REST `GET /v2/addresses/{address}/transactions` (Path 3), which needs no deploy and no indexer at all.
   The subgraph earns its keep only once the UI needs richer GraphQL projections than per-address transaction lists.
   Decide before committing Person B's UI week. (A fourth no-deploy read API exists — Ormi's REST **Data API**,
   `https://api.subgraph.somnia.network/public_api/data_api/somnia/v1/address/{address}/balance/erc20`, `Authorization:
   Bearer` ([Ormi Data APIs](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/using-data-apis-ormi.md)) —
   but the *only* documented endpoint is **ERC-20 balances**, not transaction/event history, so it does **not** serve the
   audit timeline; recorded for completeness, not adopted.)

## Source caveat

Commands, file names, the GraphQL schema snippet, provider URLs, subscription type names, and the 1000-block
`eth_getLogs` limit above are quoted from the cited upstream pages.
> **Re-verified live 2026-05-21.** All five `eth_subscribe` subscription types (`newHeads`, `logs`,
> `somnia_finishedTransactions`, `somnia_finishedBlocks`, `somnia_watch`), the `newPendingTransactions`-unsupported
> note, the `events_not_supported` HTTP error, the WebSocket-only constraint, and the 1000-block range limit still
> match [JSON-RPC](https://docs.somnia.network/developer/json-rpc-api.md) verbatim. The previously-flagged Ormi deploy
> `--node`/`--ipfs` URLs and the `graph init --network somnia-testnet` command are **confirmed correct** against the
> [Ormi guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph.md). One
> correction applied: Protofire's create-subgraphs URL is `http://somnia.chain.love/` (was wrongly recorded as `https://`).
> The Protofire deploy command, `proxy.somnia.chain.love` node, `https://somnia.chain.love/graph/17` explorer,
> access-token auth, and testnet-only scope (added 2026-05-21) are quoted from the
> [Protofire guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/protofire-subgraph.md);
> that page's `networks.json` still cites the legacy `dream-rpc.somnia.network` RPC — defer to network-info.
>
> **Re-verified live 2026-05-22 (deploy + listener cluster).** This article's high-consequence facts — the exact
> commands and code the `implementer` branch will type — were last re-checked **2026-05-21**, a day behind the
> oracle / native-agent / gas / consensus / core-deploy / Data-Streams clusters the recent runs re-verified on
> 2026-05-22, making this the stalest such cluster in the folder. All three core pages were re-fetched live under the
> sharpened soft-404 rule (real body, not just HTTP `200`) and **match verbatim — un-drifted:** the
> [Ormi guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph.md) (the
> `graph deploy mytoken --node …/deploy --ipfs …/ipfs --deploy-key` command, `graph init --network somnia-testnet`,
> the three scaffolded files, the `Transfer @entity(immutable: true)` schema, and the "Ormi will return a GraphQL
> endpoint" line), the
> [Protofire guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/protofire-subgraph.md)
> (the `graph deploy --node https://proxy.somnia.chain.love/graph/somnia-testnet --version-label 0.0.1 … --access-token`
> command, the `somnia.chain.love/graph/17` explorer, the testnet-only scope, and the still-stale
> `dream-rpc.somnia.network` `networks.json` RPC — defer to network-info), and the
> [WebSocket listening guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/listening-to-blockchain-events-websocket.md)
> (the ethers-v6 `WebSocketProvider("wss://api.infra.testnet.somnia.network/ws")` + `_waitUntilReady()`, the 30 s
> `getBlockNumber` keepalive, the `currentBlock - 100` `queryFilter` backfill, and the 5-retry / 5 s-backoff reconnect
> loop). ⚠️ **One scheme nuance held, not flipped:** the re-fetch reported the Protofire create-subgraphs landing as
> `https://somnia.chain.love/`, but `WebFetch` upgrades HTTP→HTTPS and renders bodies through a summarizing model, so an
> `http`-vs-`https` scheme observed *through* it is unreliable evidence. The deliberately-corrected `http://` value from
> the 2026-05-21 pass therefore stands (the body URL above was reconciled to match the table); the landing-page scheme is
> **not reliably verifiable through our tooling** and is low-consequence (a browser redirects either way). The deploy and
> query *hosts* — `api.subgraph.somnia.network`, `proxy.somnia.chain.love` — are unaffected.
>
> **Path 3 (Blockscout REST) added 2026-05-22.** The explorer `/api` base URLs, the four Blockscout query interfaces
> ("REST API," "RPC API," "ETH RPC API," "GraphQL"), the three `GET /v2/...` endpoint paths, and the Winston/Axios
> client-side logging shape are quoted from the
> [explorer API, health & monitoring](https://docs.somnia.network/developer/deployment-and-production/explorer-api-health-and-monitoring.md)
> page (fetched and confirmed real content — not a GitBook soft-404 — 2026-05-22). That page publishes **no** explorer
> uptime, rate-limit, or indexing-latency figure, so those stay flagged unsourced (open question 2).
>
> **Second explorer (Exploreme) added 2026-05-22.** The two explorer names (Blockscout, Exploreme/Stakeme) and the four
> explorer URLs are quoted from the
> [ecosystem: explorers](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/explorers.md)
> listing (fetched and confirmed real content — not a GitBook soft-404 — 2026-05-22). That page describes Exploreme with
> the **same boilerplate** as Blockscout and gives **no `/api` endpoints** for it, so Exploreme is recorded only as a
> human-readable UI fallback — its programmatic REST surface is **unverified** and must not be assumed equal to
> Blockscout's. The `exploreme.pro` URLs are off-domain and were not load-tested.
>
> **Subgraph query layer (Path 1, continued) added 2026-05-22.** The `proxy.somnia.chain.love/subgraphs/name/…` query
> host, the `fetch`-via-`app/api/proxy/route.ts` proxy + `Client-ID` header + `NEXT_PUBLIC_SUBGRAPH_URL`/`…_CLIENT_ID`
> env vars (`thirdweb`/`react-query`/`graphql`), and the Apollo `ApolloClient`+`InMemoryCache`/`gql`/`useQuery` shape with
> `pollInterval: 5000` are quoted from the two *building subgraph UIs* guides
> ([Next.js fetch](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-nextjs-fetch.md),
> [Apollo Client](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-apollo-client.md)) —
> both fetched and confirmed real content (not GitBook soft-404s) 2026-05-22. The key V1-relevant fact: **live refresh in
> both documented UI patterns is polling, not a GraphQL subscription** (`pollInterval: 5000`; the fetch example refreshes
> only on mount) — the fourth such confirmation in this folder. The Ormi REST **Data API** base/endpoint and `Bearer`
> auth (open question 3) are quoted from [Ormi Data APIs](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/using-data-apis-ormi.md)
> (real content, 2026-05-22); its only documented endpoint is ERC-20 balances, and it publishes **no** rate-limit or
> latency figure. None of these three pages names a chain ID; none uses the stale `dream-rpc` RPC.
>
> **`ecosystem-tools/subgraphs` listing re-verified 2026-05-23.** The two-provider table (Ormi create-subgraphs
> `https://subgraph.somnia.network/`, site `https://ormilabs.com/`; Protofire create-subgraphs `http://somnia.chain.love/`,
> site `http://protofire.io/`) is sourced from the
> [ecosystem: subgraphs](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/subgraphs.md)
> listing. Unlike its sibling `ecosystem-tools/*` listings (`rpc`, `oracles`, `wallet-providers`, `account-abstraction`,
> `explorers`, `safes`, `sdks`, `apis`, `on-ramps` — all explicitly re-verified across 2026-05-22), this listing — the
> *source* for the high-consequence create-subgraphs deploy URLs — had never been logged as re-verified. Re-fetched live
> 2026-05-23 under the sharpened soft-404 rule (real body, not just HTTP `200`): it renders **real content**, names
> **exactly Ormi + Protofire** (a **verified negative** — no third provider, unlike the sibling listings that surfaced
> Sequence/Pimlico), and both create-subgraphs URLs **match this table verbatim — un-drifted**. With this, every
> `ecosystem-tools/*` listing the folder cites has been explicitly re-verified. The provider site URLs (`ormilabs.com`,
> `protofire.io`) are off-domain and were not load-tested.
>
> **Query-layer + Blockscout-REST cluster re-verified live 2026-05-23.** The deploy + WebSocket-listener cluster was
> re-verified 2026-05-22 and the `ecosystem-tools/subgraphs` listing 2026-05-23, but the four pages added 2026-05-22 —
> the **audit-UI read path**, the literal payoff of the demo loop — carried only an "added" stamp and had **never been
> re-fetched to confirm they hadn't drifted**, making them the stalest high-consequence surface in the folder. All four
> were re-fetched live under the sharpened soft-404 rule (real body, not just HTTP `200`) and **render real content;
> every load-bearing fact matches upstream verbatim — un-drifted:** the
> [Apollo guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-apollo-client.md)
> (`pollInterval: 5000`, `ApolloClient`+`InMemoryCache`+`gql`+`useQuery`, Node 20+, `@apollo/client`+`graphql`); the
> [Next.js-fetch guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-nextjs-fetch.md)
> (the `app/api/proxy/route.ts` `POST` handler, the `Client-ID` header, the `NEXT_PUBLIC_SUBGRAPH_URL`/`…_CLIENT_ID` env
> vars, the `useEffect`-on-mount-only refresh, `thirdweb`/`react-query`/`graphql`); the
> [explorer API page](https://docs.somnia.network/developer/deployment-and-production/explorer-api-health-and-monitoring.md)
> (both `/api` base URLs, the four query interfaces, all three `GET /v2/...` paths, the Winston `maxsize: 5242880`/5-files
> rotation — still **no** uptime/rate-limit/indexing-latency figure, open question 2's gap re-confirmed); and the
> [Ormi Data API page](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/using-data-apis-ormi.md)
> (the `…/public_api/data_api/somnia/v1/address/{walletAddress}/balance/erc20` endpoint, `Authorization: Bearer`,
> ERC-20-balances-only — the open-question-3 negative re-confirmed). **Two paraphrases passing as verbatim were tightened**
> (the recent runs' paraphrase-to-verbatim discipline — same class as the 32-SOMI / events-quote / compilation-quote /
> provenance / Data-ID / fork-command / reward-source / receipt-gloss / `msg.sender` tightenings): (1) the Apollo polling
> mechanism, previously an authorial gloss *"Apollo re-runs the query every 5 s,"* was promoted to the upstream verbatim
> *"The `pollInterval` automatically re-executes the query every 5 seconds,"* and the inline `useQuery` call corrected to
> the full upstream form (`variables: { first: 10 }, pollInterval: 5000`) — load-bearing because this is the folder's
> **fourth** "polling, not a subscription" confirmation; (2) the Next.js example query, previously dressed as a quote
> *"the latest 10 transfers ordered by `blockTimestamp`,"* was grounded in the actual upstream GraphQL projection
> `transfers(first: 10, orderBy: blockTimestamp, orderDirection: desc)`. The [`GLOSSARY.md`](../GLOSSARY.md) *Polling*
> entry needed no change (its `pollInterval: 5000` code citation is verbatim-confirmed; its definition is authorial, not a
> false quote; concept-keyed convention held). No new glossary term; no new flags; none of the four pages names a chain ID
> or uses the stale `dream-rpc` RPC; PHI boundary unaffected (the read path surfaces only hash/state/address/amount
> calldata + decoded logs). With this, **every citation cluster in this article — deploy, WebSocket listener, query layer,
> Blockscout REST, and the ecosystem listing — is re-verified on 2026-05-22 or 2026-05-23.**
Upstream is authoritative; re-confirm before deploying.
