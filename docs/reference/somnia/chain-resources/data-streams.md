# Chain resource: Somnia Data Streams

> **One line:** a way to **write structured, schema-typed data straight to Somnia — without writing a Solidity
> contract** — and to subscribe to it in real time. Every record carries a deterministic ID and the publisher's
> address, so anyone can verify *what* was published and *by whom*.
>
> Upstream: [overview](https://docs.somnia.network/developer/data-streams.md) ·
> [what is it](https://docs.somnia.network/developer/data-streams/what-is-somnia-data-streams.md) ·
> [concepts](https://docs.somnia.network/developer/data-streams/concepts.md) ·
> [quickstart](https://docs.somnia.network/developer/data-streams/quickstart.md) ·
> [SDK methods](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md) ·
> [provenance & verification](https://docs.somnia.network/developer/data-streams/concepts/data-provenance-and-verification-in-streams.md) ·
> [multiple publishers in a shared stream](https://docs.somnia.network/developer/data-streams/tutorials/working-with-multiple-publishers-in-a-shared-stream.md) ·
> [data vs. event streams](https://docs.somnia.network/developer/data-streams/concepts/somnia-data-vs-event-streams.md) ·
> [the dApp publisher-proxy pattern](https://docs.somnia.network/developer/data-streams/tutorials/the-dapp-publisher-proxy-pattern.md) ·
> [intersection with Reactivity](https://docs.somnia.network/developer/data-streams/concepts/intersection-with-somnia-reactivity.md) ·
> [understanding schemas, IDs & publisher](https://docs.somnia.network/developer/data-streams/concepts/understanding-schemas-schema-ids-data-ids-and-publisher.md) ·
> [extending & composing schemas](https://docs.somnia.network/developer/data-streams/concepts/extending-and-composing-data-schemas.md) ·
> [read stream data from a UI (Next.js)](https://docs.somnia.network/developer/data-streams/tutorials/read-stream-data-from-a-ui-next.js-example.md) ·
> [build your first schema](https://docs.somnia.network/developer/data-streams/tutorials/build-your-first-schema.md) ·
> [hello-world app](https://docs.somnia.network/developer/data-streams/tutorials/hello-world-app.md).
> Fetched 2026-05-20; provenance & multi-publisher pages added 2026-05-21; data-vs-event & proxy-pattern pages added 2026-05-21;
> intersection-with-Reactivity page added 2026-05-21; schemas/Data-ID page added 2026-05-21; schema-extension page added 2026-05-21;
> Next.js read-path tutorial added 2026-05-21; realtime-game case study added 2026-05-22;
> [on-chain chat app](https://docs.somnia.network/developer/data-streams/tutorials/build-a-minimal-on-chain-chat-app.md) added 2026-05-22;
> two intro tutorials (first-schema, hello-world) added 2026-05-22;
> [F1 case study](https://docs.somnia.network/developer/data-streams/tutorials/streams-case-study-formula-1.md) added 2026-05-22.
> SDK cluster re-verified live 2026-05-22; all six concept pages re-verified live 2026-05-23;
> multi-publisher + publisher-proxy tutorials re-verified live 2026-05-23 (un-drifted; one paraphrase promoted to verbatim — see source caveat);
> the three worked-example case studies (tap-game, on-chain-chat, F1) re-verified live 2026-05-23 (un-drifted; the F1 "no `subscribe`" refutation re-confirmed; the tap-game cooldown lever named — see source caveat).
>
> Map: [chain-resources](../README.md) · Glossary: [Data Streams](../GLOSSARY.md#d), [Schema / Schema ID](../GLOSSARY.md#s) ·
> Roadmap: [`../../../ROADMAP.md`](../../../ROADMAP.md)

> ⚠️ **Read this first — it changes our PHI model.** Despite the word "stream," Data Streams data is written
> **on-chain**: the data-flow diagram routes writes to "Somnia Streams L1 (on-chain data)", and `set()` returns a
> transaction hash (`Promise<Hex | null>`) — i.e. each write is a committed chain transaction, durable chain state,
> not a push onto an ephemeral message bus
> ([what is it](https://docs.somnia.network/developer/data-streams/what-is-somnia-data-streams.md),
> [SDK methods](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md)). What is off-chain is the
> **reactivity**: subscribers receive events over WebSocket. So for Curie, **anything published to a Data Stream is
> subject to the full no-PHI-on-chain rule**, exactly like contract storage.
>
> *(Citation note, re-verified 2026-05-21: an earlier draft quoted "stored permanently" from the upstream page; that
> exact phrase is not present there, so the on-chain claim is now grounded in the verbatim "Somnia Streams L1
> (on-chain data)" label plus the `set()` transaction-hash return type instead.)*

## For the AI engineer: what's actually new here

Think of Data Streams as a **typed, append-only, publicly-verifiable log** that lives on the chain instead of in
Kafka or a database — with one twist you don't get off-chain: **provenance is cryptographic and free**. The docs frame
the standard as "Deterministic IDs (schemaId, dataId) and provenance (publisher address)," which yields
"interoperable, verifiable, composable data with minimal app code"
([what is it](https://docs.somnia.network/developer/data-streams/what-is-somnia-data-streams.md)).

Why this matters for an agent system: when a provider agent and a payer agent exchange messages, you normally have to
*build* the trust layer — signatures, an audit DB, a way to prove message A came before message B and was authored by
the agent that claims it. Data Streams gives you that substrate for free. Each record is bound to its **publisher
address** (the signer) and ordered on-chain, so the "who said what, when" audit timeline our
[ROADMAP](../../../ROADMAP.md) demands is a property of the storage layer, not something you reconstruct after the fact.

There are **two kinds of stream**, and they compose:

- **Data streams** persist structured records on-chain (`set`).
- **Event streams** emit notifications that "trigger WebSocket listeners for off-chain reactivity" *without persisting
  new data* (`emitEvents`) — and you can do both atomically (`setAndEmitEvents`)
  ([SDK methods](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md)). Upstream notes that,
  "Serving different purposes, data and event streams can be used independently or together," and that they integrate
  with [Reactivity](../README.md) ([concepts](https://docs.somnia.network/developer/data-streams/concepts.md)).

The dedicated comparison page sharpens the mechanical difference: a **data stream** is "Raw bytes calldata written to
chain with contextual information on how to parse," whereas an **event stream** is "EVM logs emitted by the Somnia
Streams protocol" — and both, notably, "can be done without knowing Solidity and without deploying any smart contracts"
([data vs. event streams](https://docs.somnia.network/developer/data-streams/concepts/somnia-data-vs-event-streams.md)).
For us: the **verifiable record** we want auditable forever is a *data* stream (calldata persisted as chain state);
the **live UI fan-out** is an *event* stream (logs, consumed off-chain over WebSocket).

## For the blockchain dev: how it works

The selling point is **no Solidity**. Data Streams lets you "emit EVM event logs and write data to the Somnia chain
without Solidity" — it is "a structured data layer for EVM chains"
([what is it](https://docs.somnia.network/developer/data-streams/what-is-somnia-data-streams.md)). The docs position it
between two bad options: "Custom contract storage is powerful but heavyweight" (you maintain "the whole schema logic,
CRUD, indexing patterns, and migrations"), while off-chain databases are "flexible but brittle; either centralized or
require extra machinery" (same source).

The model has four nouns ([what is it](https://docs.somnia.network/developer/data-streams/what-is-somnia-data-streams.md)):

| Term | Definition (quoted upstream) |
|---|---|
| **Schema** | "a canonical string describing fields in order" |
| **Schema ID** | "computed from the schema string. Treat it like a contract address for data shape" |
| **Publisher** | "signer that writes data. EOA or Smart Contract that writes data under a schema" |
| **Subscriber** | "reader that fetches all records for a `(schemaId, publisher)` pair" |

Because the **exact schema string determines the schemaId (a hash)**, the same shape always resolves to the same ID —
that is what makes streams from different apps composable and verifiable. Schemas are meant to be reused: "The best
blockchain primitives are composable and schemas are no exception. Promoting re-use is a priority"
([concepts](https://docs.somnia.network/developer/data-streams/concepts.md)).

### The third key: Data IDs and update semantics

The four-noun table omits a fourth identifier that turns out to matter for us. A piece of data is addressed by **three**
things working together, not two: the **Schema ID**, the **publisher address**, and a **Data ID** — "a unique key
representing that entry" that "uniquely identifies a specific record (or row)." A Data ID is "created by hashing a
string, typically by combining context and timestamp," and it behaves as a primary key — crucially, "If you write
another record with the same Data ID, it updates the existing entry rather than duplicating it"
([understanding schemas, IDs & publisher](https://docs.somnia.network/developer/data-streams/concepts/understanding-schemas-schema-ids-data-ids-and-publisher.md)).
The Schema ID itself is content-addressed and brittle by design: "If you change even one character in the schema
definition, the Schema ID will change," and it can be computed before any write with `sdk.streams.computeSchemaId()`
(same page). Each publisher gets "an isolated namespace for all schema-based data it writes," so the three identifiers
"always work together" to make data "verifiable, queryable, and uniquely name-spaced across the blockchain" (same page).

This is exactly the `dsstore` mapping quoted under *Provenance* below —
`mapping(bytes32 => mapping(address => mapping(bytes32 => bytes)))` — read aloud at last: the first `bytes32` is the
**Schema ID**, the `address` is the **publisher**, and the third `bytes32` is the **Data ID**. The Provenance section
explains the first two keys; the Data ID is the third, and it is the one the developer chooses per write.

**Why this is a V1 lever, not trivia.** The Data ID decides whether a record is *append-only* or *overwritten in place*:

- A **negotiation audit timeline** wants append-only — each step (`CodeProposalAdded`, `ClaimCountered`, …) gets a
  **fresh** Data ID (e.g. a hash of step-context + timestamp), so no later write can silently overwrite an earlier one.
  That is the tamper-evident history our [ROADMAP](../../../ROADMAP.md) audit trail depends on.
- A **single mutable "current claim state"** record would instead **reuse one** Data ID, letting each update replace the
  prior value — convenient for "latest status" reads, but it discards history.

So our schema design has a deliberate choice baked into the Data ID: append-only for the audit log, upsert for any
"latest-state" projection. (The PHI rule is unchanged either way — the string we hash into a Data ID, like every other
field, must carry no patient identifiers; hash inputs derived from PHI can themselves leak, so derive Data IDs from
claim/step metadata, not clinical content.)

### Versioning without breaking IDs: schema extension & composition

The "change one character → new Schema ID" brittleness above raises an obvious question: how do you *evolve* a schema
without orphaning every record written under the old one? Upstream's answer is **schema inheritance** — a schema may
**extend** a parent by naming a **parent schema ID** at registration time. You compute the parent's ID with
`computeSchemaId()` and pass it as an optional `parentSchemaId` alongside the new schema string to
`registerDataSchemas()`; schemas that extend nothing simply omit it (or pass the zero value)
([extending & composing schemas](https://docs.somnia.network/developer/data-streams/concepts/extending-and-composing-data-schemas.md)).

The composition is **recursive and transparent on read**: the SDK "fetch[es] schema and recursively fetch[es] parent
schema until the end of the chain is reached," joins all the schemas in the chain together (comma-separated), then
decodes the raw on-chain bytes against that combined definition before returning the fully-decoded record (same page).
A child schema therefore *appends* fields to its parent's. Upstream demonstrates **versioning** by making a `version`
schema the parent of multiple `person` iterations, so several schema versions **coexist** rather than one replacing the
next. The one composability constraint: "for maximum composability, all schemas should be public" (same page).

**For the AI engineer:** this is the on-chain analogue of a backward-compatible schema registry (think Avro/Protobuf
subjects with a compatibility mode) — except the "subject" is content-addressed and the parent link is itself a hash, so
the lineage is verifiable, not a registry's mutable bookkeeping.

**Why this matters for V1.** Each Schema ID is immutable, so a v1 negotiation record stays decodable forever even after
we ship a v2 shape; v2 extends v1 by parent ID, adds its new fields, and old and new records resolve side-by-side under
their own IDs. That is what makes "version the canonical Curie negotiation schema without breaking existing audit
records" a *solved* problem rather than a migration. (PHI rule unchanged: extending a schema only ever adds fields that
must still carry no patient identifiers.)

### The SDK surface

Package: **`@somnia-chain/streams`** ([quickstart](https://docs.somnia.network/developer/data-streams/quickstart.md)).
The quickstart flow is *define schema → compute ID → encode → publish → read*:

```ts
const schemaEncoder = new SchemaEncoder(schemaString);
const schemaId = await sdk.streams.computeSchemaId(gpsSchema);
const encoded   = schemaEncoder.encodeData([/* typed values */]);
await sdk.streams.set([{ /* schemaId + encoded payload */ }]);
const rows = await sdk.streams.getByKey(schemaId, walletAddress, dataKey);
```

Method groups ([SDK methods](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md)):

| Group | Methods (verbatim) | Use |
|---|---|---|
| **Write** | `set`, `emitEvents`, `setAndEmitEvents` | Persist records, fire events, or both atomically |
| **Manage** | `registerDataSchemas`, `registerEventSchemas`, `manageEventEmittersForRegisteredStreamsEvent` | Register data/event shapes; grant/revoke who may emit an event |
| **Read** | `getByKey`, `getAtIndex`, `getBetweenRange`, `getAllPublisherDataForSchema`, `getLastPublishedDataForSchema`, `totalPublisherDataForSchema` | Point, range, and bulk reads scoped to `(schemaId, publisher)` |
| **Subscribe** | `subscribe` | WebSocket subscription for "real-time dashboards, chat updates, live feeds, or notifications" |
| **Helpers** | `computeSchemaId`, `isDataSchemaRegistered`, `getSchemaFromSchemaId`, `deserialiseRawData` | Compute IDs, check registration, decode raw bytes |

Note `set(d: DataStream[]): Promise<Hex | null>` returns a transaction hash — confirming writes are on-chain
transactions, not off-chain pushes ([SDK methods](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md)).
The **read** methods, by contrast, share a **union** return type — `Promise<Hex[] | SchemaDecodedItem[][] | null>` — so a
read can hand back **either** raw bytes **or** already-decoded typed items (same page, signatures re-verified live
2026-05-22). That sharpens the *Reading it back* / decode story below: `deserialiseRawData` /
[`SchemaEncoder.decodeData`](#starting-from-zero-registering-a-schema-and-the-encodedecode-round-trip) is the path for
the **raw-bytes** branch; when the SDK already returns `SchemaDecodedItem[][]` the decode is folded into the read. Two
signature precisions worth carrying into V1 code: `getAllPublisherDataForSchema(schemaReference, publisher)` takes a
`SchemaReference` (not the bare `SchemaID` the point/range reads take), and `totalPublisherDataForSchema` returns a
`bigint` count.

### Starting from zero: registering a schema and the encode↔decode round-trip

Every worked example above shows the *write-then-read* loop, but none shows the step an implementer hits first: turning a
schema string into a registered, encodable shape — and, on the way back, turning a stored row into typed values. The two
intro tutorials pin this down. The *first-schema* tutorial walks the registration ritual in order:
`computeSchemaId(schema)` → **`isSchemaRegistered(id)`** (a pre-check so re-running is a no-op) → `registerDataSchemas({ schemaName, schema })`
([build your first schema](https://docs.somnia.network/developer/data-streams/tutorials/build-your-first-schema.md)).
The *hello-world* tutorial reaches the same idempotency a second way — `registerDataSchemas([...], ignoreAlreadyRegistered)`
takes an explicit boolean rather than a separate check
([hello-world app](https://docs.somnia.network/developer/data-streams/tutorials/hello-world-app.md)). (Name-drift note:
the **canonical** signature in the [SDK methods guide](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md)
is `registerDataSchemas(registrations, ignoreRegisteredSchemas?)` — the guide's param is `ignoreRegisteredSchemas`, the
tutorial's `ignoreAlreadyRegistered` is shorthand for the same boolean; re-verified live 2026-05-22.) Either way the
lesson is the same: **registration is idempotent by design**, which matters because our agents and CI re-run the same
deploy/test path repeatedly.

The genuinely new surface is the **`SchemaEncoder`** — and that it runs *both directions*. The same object that encodes
typed values for a write decodes raw bytes back into typed values on a read:

```ts
const encoder = new SchemaEncoder("uint64 timestamp, bytes32 roomId, string content, string senderName, address sender");
const encoded = encoder.encodeData([/* {name, value, type} per field */]);  // → bytes, the payload you set()
const decoded = encoder.decodeData(encoded);                                  // ← bytes back to typed fields
```

(both directions: [build your first schema](https://docs.somnia.network/developer/data-streams/tutorials/build-your-first-schema.md)).
This closes a real gap: the [*Reading it back*](#reading-it-back-the-uis-pull-path-nextjs) reads return rows whose
payload is raw bytes, and `SchemaEncoder.decodeData` against the record's schema is **the** way to recover the original
typed fields. For V1 that means reading the negotiation audit timeline back into typed ICD-10/CPT *code* identifiers,
claim state, hashes, and amounts is a local decode against the canonical schema — no extra chain call. (PHI rule
unchanged: the decode happens off-chain in the reader, and the typed values it recovers are still code/state/hash/amount,
never clinical text.)

⚠️ **Two name-drift notes** (tutorial vs. the [SDK methods guide](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md), which is authoritative for the `sdk.streams.*` surface): the
tutorials' `isSchemaRegistered` is shorthand for the guide's canonical `sdk.streams.isDataSchemaRegistered`; and
`SchemaEncoder.decodeData` is a method of the **encoder class** (a local, no-chain transform, the exact inverse of
`encodeData`) — distinct from the `sdk.streams.deserialiseRawData` helper in the [SDK surface](#the-sdk-surface) table.
Both intro tutorials also use the **stale `dream-rpc.somnia.network`** testnet RPC (chain ID `50312`, agreeing with
network-info) — same precedence rule as elsewhere: use the canonical `api.infra.testnet` endpoint.

### Closing the loop: `subscribe` ↔ `setAndEmitEvents` (the Reactivity intersection)

The `Subscribe` and `Write` groups above are two halves of one loop, and the **same `@somnia-chain/streams` SDK** drives
both — you do **not** need a second package to react to a stream. Upstream's dedicated *intersection with Reactivity*
page shows the round trip: one client calls `sdk.streams.setAndEmitEvents(...)` to write data and fire events, and
another holds an `sdk.streams.subscribe(...)` subscription whose `onData` callback runs the instant a matching event
lands. The framing is explicitly push-based: "Writing data and emitting events will trigger a call back to subscribers
that care about a specified event emitted from the Somnia Data Streams protocol (**or any contract for that matter**)
without having the need to poll the chain," and "It follows the observer pattern meaning **push rather than pull which
is always a more efficient paradigm**"
([intersection with Reactivity](https://docs.somnia.network/developer/data-streams/concepts/intersection-with-somnia-reactivity.md)).

This clears up a real "which subscribe do I use?" ambiguity for our audit fan-out. There are **two** push surfaces in the
Somnia stack and they are not the same call:

| | `sdk.streams.subscribe()` | `sdk.watch()` |
|---|---|---|
| Package | `@somnia-chain/streams` (same SDK that writes) | `@somnia-chain/reactivity` |
| Pairs natively with | `setAndEmitEvents` / `emitEvents` (one SDK, publish + react) | any contract's logs via the `somnia_watch` JSON-RPC subscription |
| Best when | you already publish via Data Streams and want the matching listener | you must react to arbitrary on-chain events, Data Streams or not |

Both are off-chain WebSocket pushes (no SOMI, gone on disconnect — see [Reactivity](reactivity.md) for the transport
and reconnect/backfill mechanics that apply identically here). The takeaway: if Curie's audit events are *emitted as
event streams*, the lowest-friction consumer is the streams SDK's own `subscribe`, not a separate `@somnia-chain/reactivity`
listener — one SDK closes the publish→react loop.

### Reading it back: the UI's pull path (Next.js)

`subscribe` tells you *when* a record changed; it does not hand you the authoritative record. For that you **read**, and
reads are the other half of the loop the audit timeline needs. The dedicated Next.js read tutorial pins down three facts
the *SDK surface* table above leaves implicit
([read stream data from a UI](https://docs.somnia.network/developer/data-streams/tutorials/read-stream-data-from-a-ui-next.js-example.md)):

- **Reads are HTTP RPC, not WebSocket.** The read SDK is constructed from a viem **public client** —
  `const sdk = new SDK(publicClient)` where `publicClient = createPublicClient({ chain: somniaTestnet, transport: http() })`
  — so every `getByKey` / `getAllPublisherDataForSchema` / `getLastPublishedDataForSchema` call is a synchronous JSON-RPC
  query, the same transport class as a normal contract `view` read. Upstream frames it exactly that way: it is "the
  Streams version of `readContract()`; it lets you pull structured data (not just variables) directly from the
  blockchain" (same page). So the push/pull split is also a **transport** split: `subscribe` = WebSocket push,
  reads = HTTP pull.
- **The SDK stays server-side.** The tutorial's pattern puts the streams SDK in a Next.js **API route**
  (`app/api/latest/route.ts`) that runs on the server and returns JSON; the browser component (`"use client"`,
  `StreamViewer.tsx`) just `fetch("/api/latest")`s that endpoint and renders the result (same page). The SDK and the RPC
  endpoint never ship to the client.
- **Live "last updated" is manual polling, not a stream.** This tutorial documents **no** `useEffect` subscription —
  refreshes are button-triggered or interval-driven re-fetches of the API route (same page). The push surface for "react
  the instant data lands" is `subscribe` from *Closing the loop* above, not the read path.

Read scope is always a `(schemaId, publisher)` pair, with the [Data ID](#the-third-key-data-ids-and-update-semantics)
as the optional point-lookup key — exactly the keys the *SDK surface* read group lists.

### A worked end-to-end example: the tap-game case study

The read-path facts above are not one tutorial's quirk — a second, independent upstream example builds the **whole**
publish→read loop the same way. The *realtime on-chain game* tutorial builds a "Tap-to-Play" game where each player tap
is "written directly to the blockchain" via `sdk.streams.set([{ id, schemaId, data }])`, and a leaderboard reads every
tap back and ranks players
([realtime on-chain game](https://docs.somnia.network/developer/data-streams/tutorials/build-a-realtime-on-chain-game.md)).
Its data flow is, verbatim, Curie's planned shape: `set()` → on-chain storage → a **server-side**
`getAllPublisherDataForSchema()` in a Next.js API route → the browser `fetch`es that JSON "every few seconds." So a
*second* tutorial confirms the [pull-path](#reading-it-back-the-uis-pull-path-nextjs) trio — reads are server-side,
client refresh is **polling, not a subscription** (this game uses neither `subscribe` nor `setAndEmitEvents` — pure
poll), and the publisher is whoever signed the write (here a MetaMask account; for us, an agent address).

The reason it earns a place here is **open question #1** — write rate. Upstream publishes no throughput number, but this
tutorial documents the *pattern* it expects you to use under load: there is **no batching API**; each record is its own
on-chain transaction, given a collision-free Data ID with `keccak256(toHex(\`${address}-${Number(now)}\`))` (the
**append-only** lever from [*Data IDs and update semantics*](#the-third-key-data-ids-and-update-semantics), shown
working — the full Data-ID expression captured on the 2026-05-23 re-fetch), and high frequency is
managed by a deliberate client-side **"1-second cooldown ... to avoid flooding transactions"** held in a named
`cooldownMs` constant (the write-rate lever, mirroring the chat-app's read-side `refreshMs = 5000`). That is the closest
upstream gets to "how do you stream fast": serialize one tx per record and rate-limit at the source. For V1 it means the
negotiation-volume estimate in open question #1 should be modelled as **N independent `set()` transactions**, not one
batched write — sharpening, not closing, that gap. (PHI rule unchanged: the tap example hashes only a tap; a Curie Data
ID must likewise hash only non-clinical context + timestamp, never note text.) ⚠️ This tutorial is a **fourth** sighting
of the stale `dream-rpc.somnia.network` testnet RPC in its `.env.local` — same precedence rule as elsewhere: use the
canonical `api.infra.testnet` endpoint from [network-info](https://docs.somnia.network/developer/network-info.md).

### The closest analogue to Curie: the on-chain chat app

Of all the upstream tutorials, the *minimal on-chain chat app* is the one whose shape is nearest to Curie's: it is a
**two-party message exchange persisted on-chain**, which is exactly what a provider↔payer negotiation is. Reading it
against our design is therefore less "another example" and more "the reference implementation of the thing we are
building" — and it sharpens two of our open questions in opposite directions.

Its chat-message schema is, verbatim,
`"uint64 timestamp, bytes32 roomId, string content, string senderName, address sender"`, messages are written with the
now-familiar `sdk.streams.set([{ id: dataId, schemaId, data }])`, the per-message Data ID is
`toHex(\`${room}-${now}\`, { size: 32 })`, and a conversation/thread is modelled by the **`roomId` field** — room names
hashed to `bytes32` and filtered **client-side after the read** (`if (want && rid.toLowerCase() !== want) continue`), not
by a server-side query
([on-chain chat app](https://docs.somnia.network/developer/data-streams/tutorials/build-a-minimal-on-chain-chat-app.md)).
That `roomId`→thread mapping is the clean model for a **per-claim negotiation thread**: one `claimId`-derived `roomId`,
every provider/payer message a record under it, the timeline reassembled by reading that room.

But two of its choices are precisely where Curie must **diverge**, and both map onto open questions already on file:

- **It is the publisher-proxy pattern in the flesh — open question #4 made concrete.** Every message is signed by a
  single **server wallet** (`{ name: 'sender', value: getWalletClient().account.address, type: 'address' }`), so the
  author's identity is carried as the schema's `sender` **field**, not the unspoofable `msg.sender` storage key. This is
  exactly the provenance demotion described in [*The proxy trade-off*](#the-proxy-trade-off-publish-on-behalf-of-destroys-the-free-provenance):
  one publisher, author re-encoded as a field the signer can set to anything. So the most natural way to *build* a chat
  app is the one that **forfeits free provenance** — confirming open question #4 is a real fork, not a corner case. If
  Curie wants "this agent proposed code X" to be cryptographically unforgeable, provider and payer must each sign their
  own writes (the [shared-publisher pattern](#one-stream-two-agents-the-shared-publisher-pattern)), and we must **not**
  trust a `sender` field.
- **Its `content` string field is the PHI hazard in its purest form.** A chat app's entire purpose is a free-text
  `content` field — and that is the one field shape Curie can never adopt, because free text is where clinical rationale,
  note excerpts, or patient identifiers leak. The lesson is sharp: the schema that is *natural* for a chat app is the
  *wrong* schema for a PHI-bound negotiation. Our negotiation schema must replace `content` with structured,
  enumerable fields (ICD-10/CPT *code* identifiers, claim state, hashes, amounts) — never a free string. Schema review
  is the gate (see the V1 PHI bullet below).

On the read path it is a **third** independent confirmation of the [pull-path trio](#reading-it-back-the-uis-pull-path-nextjs):
despite prose claiming `sendMessage` "publishes … while simultaneously emitting an event … captured in real time by
subscribers," the actual code uses **only `set()`** (no `setAndEmitEvents`, no event stream) and the UI "updates with
simple polling and does not rely on WebSocket" — a `getAllPublisherDataForSchema` re-read on a `refreshMs = 5000`
interval (same source). So `subscribe`/`watch` remain *optional* push optimizations; every worked upstream example ships
the render path as server-side read + client poll. ⚠️ This tutorial is a **fifth** sighting of the stale
`dream-rpc.somnia.network` testnet RPC (its `.env` `RPC_URL` and chain `rpcUrls`) — same precedence rule: use the
canonical `api.infra.testnet` endpoint; its chain ID `50312` agrees with [network-info](https://docs.somnia.network/developer/network-info.md).
One new import detail worth noting: it imports `zeroBytes32` from `@somnia-chain/streams` — the zero sentinel that pairs
with the optional `parentSchemaId` in [schema extension](#versioning-without-breaking-ids-schema-extension-and-composition)
(a schema that extends nothing passes the zero value).

### The last worked example — and the `subscribe` recipe that isn't there

The *Streams Case Study: Formula 1* tutorial ("Streaming data from OpenF1 on-chain") is listed under
[`llms.txt`](https://docs.somnia.network/llms.txt) as "…and building reactive applications," which made it the prime
suspect for the **first worked example to actually use `subscribe`** (every other tutorial reads via polling). Fetched
live and confirmed to have real content, it **refutes that hypothesis**: the page contains **no read, no `subscribe`, no
`watch`, no `setAndEmitEvents`/`emitEvents`, and no OpenF1 poller** — the code registers two schemas, encodes, calls
`sdk.streams.set(...)`, and ends
([F1 case study](https://docs.somnia.network/developer/data-streams/tutorials/streams-case-study-formula-1.md)). It is a
**pure write/schema-design** walkthrough despite its "reactive" billing.

That negative result is the useful one for V1: **no worked upstream tutorial demonstrates `sdk.streams.subscribe`.** The
push surface is documented only abstractly — in the [SDK methods guide](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md)
(the *Subscribe* group) and the *intersection with Reactivity* concept page (see
[*Closing the loop*](#closing-the-loop-subscribe--setandemitevents-the-reactivity-intersection)) — never as runnable
tutorial code. So when we build the audit-fan-out `subscribe` listener, there is **no copy-paste recipe to lift**; it
must be assembled from the SDK guide's method signature plus the concept page's `setAndEmitEvents`→`subscribe` shape, and
validated against a [local fork](smart-contract-dev.md#local-testing--forking-the-tdd-substrate). Every worked example
ships its render path as **server-side read + client poll** (see the
[tap-game](#a-worked-end-to-end-example-the-tap-game-case-study) and
[chat-app](#the-closest-analogue-to-curie-the-on-chain-chat-app) confirmations) — so polling, not `subscribe`, is the
de-facto upstream default, and `subscribe` is a documented push *optimization* with no first-party worked precedent.

What the F1 study *does* add is a **second, independent worked example of [schema extension](#versioning-without-breaking-ids-schema-extension-and-composition)**
— the only prior source for which was the concept page's abstract `version`/`person` illustration. Here a `driver` schema
(`uint32 number, string name, string abbreviation, string teamName, string teamColor`) **extends** a coordinates schema
(`int256 x, int256 y, int256 z`): the parent ID is computed with `const coordinatesSchemaId = await sdk.streams.computeSchemaId(coordinatesSchema)`
and passed as the optional `parentSchemaId` —
`registerDataSchemas([{ schemaName: "driver", schema: driverSchema, parentSchemaId: coordinatesSchemaId }])` — with the
combined `extendedSchema` driving `new SchemaEncoder(extendedSchema).encodeData([...])` for the write (same source). This
is a concrete, runnable instance of the inheritance mechanism behind open question #3's "versioning resolved" finding, so
that resolution now rests on **two** upstream sources, not one. ⚠️ A **seventh** sighting of the stale
`dream-rpc.somnia.network` testnet RPC (chain ID `50312`, agreeing with
[network-info](https://docs.somnia.network/developer/network-info.md)) — same precedence rule: use the canonical
`api.infra.testnet` endpoint. With this, **all** README-flagged Data Streams deepening candidates are woven in.

### Provenance: why the audit trail can't be forged

The "free verifiable provenance" claim above is not marketing — it is a property of *where the bytes are stored*. The
provenance page describes the on-chain storage as a nested mapping keyed first by schema, then by **publisher address**:
`mapping(bytes32 => mapping(address => mapping(bytes32 => bytes))) public dsstore`, and "the contract then stores the
data *at the `msg.sender`'s address* within the schema's mapping"
([provenance & verification](https://docs.somnia.network/developer/data-streams/concepts/data-provenance-and-verification-in-streams.md)).
Because the publisher address is the `msg.sender` of the write transaction, it cannot be spoofed: upstream states it
"is **impossible** for `0xPublisher_A` to send a transaction that writes data into the slot for `0xPublisher_B`. They
cannot fake their `msg.sender`," so "an attacker **cannot** write data as if it came from a trusted oracle" (same page).
The upshot for an auditor: "Because the `publisher` address is a fundamental key in the storage mapping, you don't need
to perform complex 'verification' steps. Verification is implicit in the read operation" — i.e. attribution is the
storage layout, not a signature you re-check.

### One stream, two agents: the shared-publisher pattern

A negotiation has **two** authors, so the natural question is whether provider and payer share one record or keep two.
Upstream answers this directly: the architecture "decouples data schemas from publishers," letting "multiple different
accounts (or devices) … publish data using the **same schema**"
([multiple publishers](https://docs.somnia.network/developer/data-streams/tutorials/working-with-multiple-publishers-in-a-shared-stream.md)).
Each record still stays bound to its own publisher address (the decoded row carries a `publisher` field "to know where
the data came from"), and a reader assembles the combined timeline by **fetching each publisher in turn** —
"we fetched the data for each publisher separately using the `getAllPublisherDataForSchema` method" over a maintained
"list of publishers we were interested in" (same page). So provider and payer publish to one Curie negotiation schema;
the audit timeline is the union of their two publisher reads, each cryptographically attributed.

### The proxy trade-off: publish-on-behalf-of *destroys* the free provenance

The shared-publisher pattern above assumes each agent **signs its own** write, so `msg.sender` *is* the agent. The
moment you interpose a contract that publishes on others' behalf, that guarantee is gone. Upstream's
**dApp publisher-proxy pattern** exists for a scaling reason — reading one publisher at a time "is not scalable, fast,
or efficient" once you have many authors (the worked example needs "**10,000 separate read calls**
(`getAllPublisherDataForSchema`)"); a proxy contract that publishes everyone's records into **one** publisher slot
collapses that to a single read
([proxy pattern](https://docs.somnia.network/developer/data-streams/tutorials/the-dapp-publisher-proxy-pattern.md)).

But the cost is exactly the property we leaned on in *Provenance* above. When the proxy writes, "To the Streams
contract, the **only publisher** is your DApp Contract's address" — and upstream draws the loss from that in its own
words: "Since the `msg.sender` to the Streams contract will always be our *proxy contract*, **we lose the built-in
provenance. We must re-create it by adding the original player's address to the schema itself**" (same page). In other
words the author's identity demotes from that unspoofable storage key (`msg.sender`) to an **ordinary data field the
proxy fills in** — which the proxy can set to anything. You trade a cryptographic guarantee for a trusted intermediary.

**For Curie this is a real fork, not a footnote.** If provider and payer agents each sign their own negotiation writes
(two publishers, one schema), non-forgery is free and an auditor needs no extra trust. If instead a single Curie service
contract publishes on both agents' behalf — tempting for batching, or to pair with gasless
[account abstraction](account-abstraction.md) so agents don't each hold a funded EOA — then "this agent proposed code
X" becomes a *claim by the proxy*, only as trustworthy as the proxy's own signing discipline. The non-forgery wording in
*Provenance* holds **only on the direct-publish path**. (Either way the PHI rule is unchanged: the schema fields a proxy
fills in are still on-chain and still must carry no PHI.)

## How Curie V1 could use it

Our [demo loop](../../../ROADMAP.md) needs a tamper-evident **audit timeline** — "who proposed what, who signed what,
when, and why" — plus a fan-out so the UI updates live as the provider and payer agents negotiate. Data Streams maps
onto the parts of that loop that are *already meant to be on-chain commitments*:

- **Audit-event fan-out (event streams).** The lifecycle events the ROADMAP lists — `CodeProposalAdded`,
  `EvidenceRequested`, `ClaimCountered`, `ClaimAgreed` — can be emitted as **event streams** so the UI's
  `subscribe` listener updates the timeline over WebSocket in real time, instead of polling logs. Because we publish
  via Data Streams, the lowest-friction consumer is the **streams SDK's own** `sdk.streams.subscribe` — the same
  `@somnia-chain/streams` package closes the `setAndEmitEvents`→`subscribe` loop, no separate listener required (see
  *Closing the loop* above). This is the Data Streams face of [Reactivity](reactivity.md) (the wake mechanism for the
  next agent step); reach for `@somnia-chain/reactivity`'s `sdk.watch()` only when reacting to non-stream contract logs.
- **Verifiable negotiation record (data streams).** Each negotiation step persisted under a registered schema is
  automatically bound to its **publisher address** (the provider or payer agent), giving us the signed "who said what"
  trail for free — no separate audit DB. Provider and payer write to **one shared schema** as two publishers; because
  attribution is the `msg.sender`-keyed storage slot, neither agent can forge a record as the other (see *Provenance*
  and *the shared-publisher pattern* above), and the UI rebuilds the combined timeline via
  `getAllPublisherDataForSchema` per agent. That rebuild is the **pull path** (*Reading it back* above): the dashboard's
  read calls live in a server-side route, the `subscribe` push only signals *when* to re-read — so the demo UI is
  `subscribe`-to-wake + HTTP-read-to-render, never the SDK in the browser.
- **PHI boundary — unchanged and fully in force.** Because Data Streams writes are **on-chain and permanent**, the same
  rule as contract storage applies: publish **only** hashes, ICD-10/CPT *code* identifiers, claim state, agent
  addresses, timestamps, settlement amounts, and signatures — **never** the clinical note, raw rationale, patient
  identifiers, or raw payer policy text (the ROADMAP's [do-not-store list](../../../ROADMAP.md)). The convenience of
  "no Solidity, just publish a record" makes it *easier* to leak PHI by accident — schema review is a hard gate.

### The "Data Streams vs. contract storage" decision for V1

The ROADMAP's `ClaimSettlement.sol` already defines explicit Solidity events. V1 has a choice: emit those from the
contract directly, or model the negotiation record as Data Streams and keep the contract minimal. Data Streams removes
"CRUD, indexing patterns, and migrations" work, but a bespoke contract gives tighter control over revert conditions and
state-machine invariants. This is a spec decision, not settled here — flagged for the research loop.

## Open questions (for the research loop)

1. **Cost & latency of `set`.** Each write is an on-chain transaction paid in SOMI/STT. Per-record gas for the
   negotiation volume in a 90-second demo is **not** specified upstream — flagged unsourced; needs measurement against
   our [gas model](../../../research/somnia/finality-tps-and-gas-model.md). ⚠️ *Pattern (not number) resolved
   2026-05-22:* the [tap-game case study](#a-worked-end-to-end-example-the-tap-game-case-study) shows upstream exposes
   **no batching API** — high write volume is **N independent `set()` transactions** plus a client-side cooldown, so the
   demo cost must be modelled per-transaction, not as one batched write.
2. **Data Streams vs. native contract events.** Does using Data Streams instead of `ClaimSettlement.sol` events
   simplify the build, or fragment the audit trail across two on-chain mechanisms?
3. **Schema governance.** ✅ *Versioning mechanism resolved* (see *Versioning without breaking IDs* above): schemas
   evolve by **extension** — a v2 schema names v1 as its `parentSchemaId`, adds fields, and both versions coexist under
   their own immutable IDs, so existing records stay decodable. What remains open is **ownership/process**, not
   mechanism: who holds the canonical Curie claim/negotiation schema strings, who may register a new version, and
   whether all our schemas are made public (required "for maximum composability" upstream).
4. **Direct-publish vs. proxy.** Do provider and payer agents each sign their own Data Streams writes (free, unspoofable
   provenance, but each needs a funded/AA-sponsored signer) — or does one Curie service contract publish on their behalf
   (one read, batchable, pairs with [account abstraction](account-abstraction.md), but provenance becomes a *claim by
   the proxy* re-encoded as a schema field)? This is the security/UX trade-off in *The proxy trade-off* above and must
   be settled before the audit-trail guarantee can be stated as a fact. ⚠️ *Made concrete 2026-05-22:* the
   [on-chain chat app](#the-closest-analogue-to-curie-the-on-chain-chat-app) — the upstream tutorial nearest to our
   negotiation shape — ships the **proxy path by default** (one server wallet signs every message; `sender` is a schema
   field), so the *natural* build forfeits free provenance. The direct-publish path is the deliberate, non-default
   choice for Curie.

## Source caveat

Method names, signatures, and the data/event-stream distinction above are quoted from AI-summarised fetches of the
cited upstream pages (2026-05-20). The `@somnia-chain/streams` API may change pre-GA — re-read the upstream
[quickstart](https://docs.somnia.network/developer/data-streams/quickstart.md) and
[SDK methods guide](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md) for exact signatures and
return types before writing code. Upstream is authoritative.

> **Re-verified 2026-05-21.** All 18 SDK method names and the `set(): Promise<Hex | null>` signature still match
> upstream verbatim; the four-noun definitions, the "without Solidity" framing, the heavyweight/brittle contrast, and
> the "composable… promoting re-use" line all resolve. Two quotes that did **not** match live upstream were corrected:
> the fabricated "stored permanently" (replaced with the verifiable "Somnia Streams L1 (on-chain data)" + tx-hash
> evidence) and a misquoted data-vs-event-stream line (now quoted as upstream's "Serving different purposes…").
>
> **Re-verified 2026-05-22 — full signatures, not just names.** This was the **stalest high-consequence cluster** in the
> folder: the `sdk.streams.*` surface the implementer will type, last re-checked 2026-05-21 while every other article got
> a 2026-05-22 re-check. Both core pages were re-fetched live under the **sharpened soft-404 rule** (real body, not just
> HTTP `200`): the [SDK methods guide](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md) renders
> real content ("Data Streams in Somnia represent structured, verifiable data channels.") and the
> [quickstart](https://docs.somnia.network/developer/data-streams/quickstart.md) does too ("All data broadcast with the
> Somnia Data Stream SDK write mechanism must be linked to a schema ID…"). **Every** method name in the surface table,
> the `@somnia-chain/streams` package, the `set(d: DataStream[]): Promise<Hex | null>` signature, and the quickstart's
> `SchemaEncoder → computeSchemaId → encodeData → set → getByKey` flow **match verbatim — un-drifted.** The re-fetch also
> captured the **full type signatures** the prior name-only check had not, yielding two genuinely-new, V1-relevant facts
> now woven into [*The SDK surface*](#the-sdk-surface): (1) the read methods share a **union return type**
> `Promise<Hex[] | SchemaDecodedItem[][] | null>` — a read may return raw bytes **or** already-decoded items, so decode
> is not always a separate step; and (2) the canonical `registerDataSchemas` second param is **`ignoreRegisteredSchemas`**
> (the hello-world tutorial's `ignoreAlreadyRegistered` is shorthand — a **third** name-drift note added). No new glossary
> term; no new flags; the quickstart names no chain ID and no RPC URL (no stale `dream-rpc` on either core page).
>
> **Concept cluster re-verified 2026-05-23 — un-drifted; one paraphrase promoted to upstream verbatim.** The 2026-05-22
> sweep above re-checked the *SDK* cluster (the code an implementer types) but **not** the Data Streams **concept** pages
> — the verbatim quotes grounding the article's *argument*, last checked 2026-05-21. The two highest-consequence concept
> pages were re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real
> content; every quote matches upstream verbatim — un-drifted.** The
> [provenance & verification](https://docs.somnia.network/developer/data-streams/concepts/data-provenance-and-verification-in-streams.md)
> page — the load-bearing source for Curie's "the audit trail can't be forged" thesis — confirmed all five quotes: the
> three-key `dsstore` mapping declaration, the "stores the data *at the `msg.sender`'s address*" line, the *"impossible …
> They cannot fake their `msg.sender`"* non-forgery guarantee, the *"an attacker **cannot** write data as if it came from
> a trusted oracle"* line, and the "you don't need to perform complex 'verification' steps" auditor upshot. The
> [data vs. event streams](https://docs.somnia.network/developer/data-streams/concepts/somnia-data-vs-event-streams.md)
> page confirmed its data-stream ("Raw bytes calldata written to chain…") / event-stream ("EVM logs emitted by the Somnia
> Streams protocol") definitions and the "without knowing Solidity and without deploying any smart contracts" framing.
> **One precision improvement** (the recent runs' paraphrase-to-verbatim discipline): the provenance page **ends** that
> auditor passage with its own crisp sentence *"Verification is implicit in the read operation."* — the exact verbatim
> form of what the article expressed as an authorial gloss ("attribution is the storage layout, not a signature you
> re-check"). The quote was extended to fold in that verbatim sentence, raising the most load-bearing citation in the
> article from gloss to word-for-word source. Two honest notes recorded: (a) the data-stream definition continues past
> the article's truncation — upstream's full sentence is *"…how to parse the data using a public or private `data
> schema`"* — the quoted words are verbatim, the truncation does not alter meaning; (b) the *"Serving different
> purposes…"* line is sourced to the **concepts** page, not the data-vs-event page (the latter does not carry it), so it
> was not re-checked this run. Neither concept page names a chain ID or RPC URL; no new glossary term; no new flags.
>
> **Concept cluster re-verified 2026-05-23 (second pass) — the four remaining concept pages; three paraphrases promoted to upstream verbatim.**
> The first 2026-05-23 pass (above) re-checked the *provenance* + *data-vs-event* concept pages but explicitly deferred the
> other four concept pages — [understanding schemas, IDs & publisher](https://docs.somnia.network/developer/data-streams/concepts/understanding-schemas-schema-ids-data-ids-and-publisher.md),
> [extending & composing schemas](https://docs.somnia.network/developer/data-streams/concepts/extending-and-composing-data-schemas.md),
> [intersection with Reactivity](https://docs.somnia.network/developer/data-streams/concepts/intersection-with-somnia-reactivity.md),
> and the [concepts](https://docs.somnia.network/developer/data-streams/concepts.md) page (incl. the deferred *"Serving
> different purposes…"* line) — all last checked **2026-05-21**. This run re-fetched all four live under the **sharpened
> soft-404 rule** (real body, not just HTTP `200`); **all render real content and every load-bearing quote matches
> upstream verbatim — un-drifted:** the schema-ID brittleness ("If you change even one character … the Schema ID will
> change"), `sdk.streams.computeSchemaId()`, the "isolated namespace" + "three identifiers always work together" /
> "verifiable, queryable, and uniquely name-spaced" lines; the extension page's optional-`parentSchemaId` registration, the
> "recursively fetch parent schema until the end of the chain is reached" + "for maximum composability, all schemas should
> be public" lines; the intersection page's "without having the need to poll the chain" + "observer pattern … push rather
> than pull" lines and the `setAndEmitEvents`/`subscribe` pair; and the concepts page's *"Serving different purposes, data
> and event streams can be used independently or together"* (now confirmed verbatim, closing the prior pass's deferred
> note). **Three paraphrases passing as verbatim were tightened** (the recent runs' paraphrase-to-verbatim discipline —
> same class as the 32-SOMI / events-quote / compilation-quote / provenance tightenings): (1) the Data ID was quoted as
> *"uniquely identifies individual records within a schema"* but upstream reads *"a unique key representing that entry"*
> that *"uniquely identifies a specific record (or row)"*; (2) the update-semantics quote *"reusing the same Data ID
> updates existing entries rather than creating duplicates"* but upstream reads *"If you write another record with the same
> Data ID, it updates the existing entry rather than duplicating it"*; (3) the concepts-page re-use line dropped upstream's
> leading **"The best"** (*"The best blockchain primitives are composable…"*). All three were corrected in the article body
> **and** in the *Data ID* / re-use glossary references. ⚠️ **One honest note recorded, not corrected:** the extension
> page's *versioning* claim — that several schema versions **coexist** — is the article's authorial gloss (not inside quote
> marks); upstream demonstrates a `version` parent over `person` iterations but does not state coexistence in those words,
> so the gloss stands as interpretation, not a quote. Neither page names a chain ID or RPC URL; no new glossary term; no
> new flags. With this, **all six Data Streams concept pages are re-verified on 2026-05-23.**
>
> **Tutorial cluster re-verified 2026-05-23 — multi-publisher + publisher-proxy; one paraphrase promoted to upstream verbatim.**
> With the SDK cluster re-verified 2026-05-22 and all six concept pages 2026-05-23, the **stalest high-consequence Data
> Streams surface left** was the two **tutorials** carrying the verbatim quotes behind open question #4 (the direct-publish
> vs. proxy V1 architecture fork) — the [multiple-publishers](https://docs.somnia.network/developer/data-streams/tutorials/working-with-multiple-publishers-in-a-shared-stream.md)
> and [dApp publisher-proxy pattern](https://docs.somnia.network/developer/data-streams/tutorials/the-dapp-publisher-proxy-pattern.md)
> pages, added 2026-05-21 and **never swept** on the 2026-05-22/23 passes (those touched only the SDK + concept clusters).
> A wrong quote here mis-frames the fork that decides whether agent identity is unspoofable, so the cluster earned a
> priority re-check. Both were re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and
> **render real content; every quote matches upstream verbatim — un-drifted:** the multi-publisher page's *"decouples
> data schemas from publishers"*, *"multiple different accounts (or devices) … publish data using the **same schema**"*,
> the `publisher` field *"To know where the data came from"*, *"We fetched the data for each publisher separately using the
> `getAllPublisherDataForSchema` method"*, and *"a list of publishers we were interested in"*; and the proxy page's *"is
> not scalable, fast, or efficient"*, *"**10,000 separate read calls** (`getAllPublisherDataForSchema`)"*, *"To the Streams
> contract, the **only publisher** is your DApp Contract's address"*, and *"we lose the built-in provenance. We must
> re-create it by adding the original player's address to the schema itself"*. **One precision improvement** (the recent
> runs' paraphrase-to-verbatim discipline — same class as the 32-SOMI / events-quote / compilation-quote / provenance /
> Data-ID tightenings): the proxy page states the *causal mechanism* — *"Since the `msg.sender` to the Streams contract
> will always be our *proxy contract*, …"* — **inside** the same sentence as the provenance-loss consequence, but the
> article had quoted only the consequence and **re-derived the `msg.sender` cause in its own words** ("an unspoofable
> storage key (`msg.sender`)"). The quote in [*The proxy trade-off*](#the-proxy-trade-off-publish-on-behalf-of-destroys-the-free-provenance)
> was extended to fold in that verbatim causal clause, so the section now ties to the *Provenance* section's
> `msg.sender`-keyed-storage argument with upstream's own words rather than an authorial bridge — load-bearing because open
> question #4 turns entirely on whether `msg.sender` is the agent or the proxy. ⚠️ The multi-publisher tutorial prints the
> stale `dream-rpc.somnia.network` testnet RPC + chain ID `50312` (the **fourteenth** `dream-rpc` sighting; `50312` agrees
> with network-info — precedence rule unchanged, fork/deploy against the canonical `api.infra.testnet` endpoint); the proxy
> page prints no RPC or chain ID (it names `somniaTestnet` and an example Streams contract address only). PHI boundary
> unaffected — a proxy-filled `sender` field is still on-chain state subject to the full no-PHI-on-chain rule. No new
> glossary term; no new flags. With this, the multi-publisher + proxy tutorials join the SDK + concept clusters as
> re-verified on the latest passes.
>
> **Worked-example case studies re-verified 2026-05-23 — the last un-swept Data Streams tier; the F1 "no `subscribe`" refutation re-confirmed.**
> The SDK cluster (2026-05-22), the six concept pages (2026-05-23), and the multi-publisher + proxy tutorials (2026-05-23)
> were all re-verified, but the article's **fourth** citation tier — the three **worked-example case studies** behind
> [*A worked end-to-end example*](#a-worked-end-to-end-example-the-tap-game-case-study),
> [*The closest analogue to Curie*](#the-closest-analogue-to-curie-the-on-chain-chat-app), and
> [*The last worked example*](#the-last-worked-example--and-the-subscribe-recipe-that-isnt-there) — was **added 2026-05-22
> and never re-fetched since**. As the prior indexing-cluster run put it, *"added on X" ≠ "re-verified live on Y"*: a quote
> can be woven into prose and still silently drift. These three carry load-bearing claims — the open-question-#1 write-rate
> pattern (tap-game), the open-question-#4 publisher-proxy-by-default + the `content`-field PHI hazard (chat-app), and the
> central **negative** that *no worked upstream tutorial demonstrates `sdk.streams.subscribe`* (F1) — and a negative is
> exactly the claim an upstream edit could silently invalidate, so the tier earned the priority re-check. All three were
> re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real content; every
> load-bearing fact matches upstream verbatim — un-drifted:** the [tap-game](https://docs.somnia.network/developer/data-streams/tutorials/build-a-realtime-on-chain-game.md)
> ("every player's tap is **written directly to the blockchain**", `sdk.streams.set([{ id, schemaId, data }])`, the
> server-side `getAllPublisherDataForSchema` API route + browser fetch "**every few seconds**", and the no-`subscribe`/
> no-`setAndEmitEvents` pure-poll path); the [chat-app](https://docs.somnia.network/developer/data-streams/tutorials/build-a-minimal-on-chain-chat-app.md)
> (the `"uint64 timestamp, bytes32 roomId, string content, string senderName, address sender"` schema, the
> `{ name: 'sender', value: getWalletClient().account.address, type: 'address' }` proxy-signed field, the *"publishes …
> while simultaneously emitting an event … captured in real time by subscribers"* prose vs. the actual code's *"updates
> with simple polling and does not rely on WebSocket"* `refreshMs = 5000` re-read, the `if (want && rid.toLowerCase() !==
> want) continue` client-side `roomId` filter, and the `zeroBytes32` import); and the
> [F1 case study](https://docs.somnia.network/developer/data-streams/tutorials/streams-case-study-formula-1.md) (title
> *"Streams Case Study: Formula 1"*; **re-confirmed to contain no read, `subscribe`, `watch`, `setAndEmitEvents`,
> `emitEvents`, or OpenF1 poller** — the refutation holds; the `int256 x, int256 y, int256 z` coordinates schema, the
> `uint32 number, string name, string abbreviation, string teamName, string teamColor` driver schema, the
> `computeSchemaId(coordinatesSchema)` → `parentSchemaId` extension, and `new SchemaEncoder(extendedSchema).encodeData([...])`).
> **One detail folded in** (the recent runs' full-fetch discipline — same as the SDK cluster's signature capture): the
> tap-game's rate-limit is held in a named **`cooldownMs`** constant and its Data ID is the full
> `keccak256(toHex(\`${address}-${Number(now)}\`))` — both previously elided as `(...)`; the `cooldownMs` write-rate lever
> now mirrors the chat-app's already-captured read-side `refreshMs = 5000`. No quote was *corrected* — the article's
> ellipsis quotes were already faithful elisions, not paraphrases passing as verbatim — so this is a clean re-verification,
> not a tightening. ⚠️ All three case studies still print the stale `dream-rpc.somnia.network` testnet RPC (chain ID
> `50312` where present, agreeing with network-info) — the **fourth/fifth/seventh** sightings already recorded inline;
> precedence rule unchanged (use the canonical `api.infra.testnet` endpoint). PHI boundary unaffected. No new glossary
> term; no new flags. With this, **all four Data Streams citation tiers — SDK, concept, multi-publisher/proxy tutorials,
> and worked-example case studies — are re-verified on the 2026-05-22/23 passes**, and the article is fully drift-checked.
>
> **Deepened 2026-05-21.** Added two upstream sources — the *provenance & verification* concept page (the
> `msg.sender`-keyed `dsstore` mapping and the "impossible … to fake their `msg.sender`" non-forgery guarantee) and the
> *multiple-publishers-in-a-shared-stream* tutorial (provider + payer as two publishers on one schema, read back per
> publisher via `getAllPublisherDataForSchema`). This grounds the previously-asserted "verifiable provenance for free"
> claim in the actual storage mechanism and answers how a two-author negotiation record is shared.
>
> **Deepened again 2026-05-21.** Two further upstream pages — newly present in the live
> [`llms.txt`](https://docs.somnia.network/llms.txt) site map (now 232 doc paths, up from the 155 recorded in the
> README's 2026-05-21 audit) — were woven in: the *data-vs-event-streams* concept page ("calldata written to chain" vs
> "EVM logs emitted") and the *dApp publisher-proxy pattern* tutorial. The proxy page is the consequential one: it shows
> that publishing on others' behalf collapses the publisher to the proxy's address and *forfeits* the `msg.sender`
> non-forgery guarantee, demoting author identity to a re-encoded schema field. The article's *Provenance* claims now
> explicitly hold only on the direct-publish path, and open question #4 records the resulting V1 design fork.
>
> **Deepened a third time 2026-05-21.** Wove in the newly-present *intersection with Somnia Reactivity* concept page.
> Key facts captured: the `@somnia-chain/streams` SDK exposes its **own** `subscribe` that pairs with
> `setAndEmitEvents` (one SDK closes the publish→react loop — no separate `@somnia-chain/reactivity` dependency), and
> upstream frames it verbatim as the observer pattern, "push rather than pull." Added a two-column table disambiguating
> `sdk.streams.subscribe()` from `sdk.watch()` and pointed the V1 audit-fan-out bullet at the streams SDK's subscribe.
>
> **Deepened a fourth time 2026-05-21.** Wove in the *understanding schemas, schema IDs, data IDs & publisher* concept
> page to name the **third addressing key** the article had quoted but never explained: the `dsstore` mapping's third
> `bytes32` is the **Data ID**. Facts captured verbatim: Schema IDs are content-addressed ("change even one character …
> the Schema ID will change", computable via `computeSchemaId()`); a Data ID is "created by hashing a string, typically
> by combining context and timestamp" and "reusing the same Data ID updates existing entries rather than creating
> duplicates"; each publisher holds "an isolated namespace." The new *Data IDs and update semantics* subsection turns
> this into a V1 lever — append-only (fresh Data ID per step) for the tamper-evident audit log vs. upsert (reused Data
> ID) for a "latest claim state" projection — with the PHI caveat that Data-ID hash inputs must not derive from clinical
> content. Added a **Data ID** glossary entry.
>
> **Deepened a fifth time 2026-05-21.** Wove in the *extending and composing data schemas* concept page to resolve the
> versioning half of open question #3. Facts captured verbatim: a schema extends a parent by naming a **parent schema
> ID** (`computeSchemaId()` + an optional `parentSchemaId` on `registerDataSchemas()`); the SDK resolves the chain
> recursively ("fetch … recursively fetch parent schema until the end of the chain is reached", joined comma-separated,
> then decoded); versioning is demonstrated by a `version` parent over multiple `person` iterations that **coexist**;
> and "for maximum composability, all schemas should be public." The new *Versioning without breaking IDs* subsection
> turns this into the V1 answer for evolving the canonical negotiation schema without orphaning prior audit records;
> open question #3 is narrowed from mechanism to ownership/process; the **Schema / Schema ID** glossary entry now points
> at the extension mechanism.
>
> **Deepened a sixth time 2026-05-21.** Wove in the *read stream data from a UI (Next.js example)* tutorial — a
> README-flagged deepening candidate — to fill the article's read-path gap (it had covered write + `subscribe` push but
> not how the UI reads records back). Facts captured verbatim: the read SDK is `new SDK(publicClient)` over a viem
> `createPublicClient({ transport: http() })` (so **reads are HTTP RPC, the push/pull split is also a transport split**),
> reads are "the Streams version of `readContract()`", the Next.js pattern keeps the SDK in a **server-side API route**
> (`app/api/latest/route.ts`) with the `"use client"` component fetching that endpoint, and live refresh is **manual
> polling** (no `useEffect` subscription documented). New *Reading it back* subsection; the V1 *verifiable negotiation
> record* bullet now states the demo UI is `subscribe`-to-wake + HTTP-read-to-render, SDK never in the browser. No new
> glossary term (the read methods were already in the *SDK surface* table). Remaining Data Streams deepening candidates:
> the *Integrate Chainlink Oracles* tutorial and the F1 / on-chain-chat / realtime-game case studies.
>
> **Deepened a seventh time 2026-05-22.** Wove in the *build a realtime on-chain game* case study (the "Tap-to-Play"
> tutorial) — a README-flagged deepening candidate, fetched live and confirmed to have real content. It does **two**
> things for V1. (1) It is a *second, independent* worked example confirming the *Reading it back* pull-path trio:
> writes via `sdk.streams.set([{ id, schemaId, data }])`, reads via a **server-side** `getAllPublisherDataForSchema()`
> in a Next.js API route, and a browser that `fetch`es that JSON "every few seconds" — **polling, not `subscribe`** (this
> tutorial uses neither `subscribe` nor `setAndEmitEvents`). (2) It is the closest upstream gets to **open question #1**
> (write rate): there is **no batching API**, each record is its own transaction with a collision-free `keccak256(...)`
> Data ID (the append-only lever, shown working), and high frequency is handled by a deliberate client-side
> **"1-second cooldown ... to avoid flooding transactions."** Open question #1 is *sharpened* (model as N independent
> `set()` txns, not one batched write) — not closed; upstream still publishes no per-record gas/throughput number. New
> *A worked end-to-end example* subsection. No new glossary term. ⚠️ A **fourth** sighting of the stale
> `dream-rpc.somnia.network` testnet RPC (in the tutorial's `.env.local`) — precedence rule reaffirmed inline (use the
> canonical `api.infra.testnet` endpoint). Remaining Data Streams deepening candidates: the F1 and on-chain-chat case
> studies and the two intro tutorials (*hello-world-app*, *build-your-first-schema*).
>
> **Deepened an eighth time 2026-05-22.** Wove in the *build a minimal on-chain chat app* tutorial — the upstream
> example **structurally nearest to Curie's negotiation** (a two-party on-chain message exchange), fetched live and
> confirmed to have real content. New *The closest analogue to Curie* subsection. Three high-value findings: (1) it is
> the **publisher-proxy pattern in the flesh** — a single **server wallet** signs every message, so author identity is
> the schema's `sender` *field* (`{ name: 'sender', value: getWalletClient().account.address, type: 'address' }`), not
> the unspoofable `msg.sender` — making **open question #4** a confirmed real fork (the *natural* build forfeits free
> provenance; direct-publish is the deliberate non-default for Curie). (2) Its free-text `content` string field is the
> **PHI hazard in purest form** — the schema natural for a chat app is the wrong schema for a PHI-bound negotiation;
> Curie must replace `content` with structured code/state/hash/amount fields. (3) A **third** independent confirmation
> of the pull-path trio: despite prose claiming it emits events, the code uses **only `set()`** and the UI "updates with
> simple polling … does not rely on WebSocket" (`getAllPublisherDataForSchema` on `refreshMs = 5000`). Schema verbatim:
> `"uint64 timestamp, bytes32 roomId, string content, string senderName, address sender"`; Data ID
> `toHex(\`${room}-${now}\`, { size: 32 })`; thread = a `bytes32 roomId` field filtered **client-side after read**.
> Captured `zeroBytes32` (the no-parent sentinel pairing with `parentSchemaId`). No new glossary term. ⚠️ **Fifth**
> sighting of the stale `dream-rpc.somnia.network` testnet RPC (its `.env` `RPC_URL`); chain ID `50312` agrees with
> network-info. Remaining Data Streams deepening candidates: the F1 case study and the two intro tutorials
> (*hello-world-app*, *build-your-first-schema*).
>
> **Deepened a ninth time 2026-05-22.** Wove in **both** intro tutorials — *build your first schema* and *hello-world
> app* — fetched live and confirmed to have real content. New *Starting from zero* subsection capturing the step prior
> worked examples skipped: the schema-registration ritual (`computeSchemaId` → `isSchemaRegistered` pre-check →
> `registerDataSchemas`, with hello-world's `ignoreAlreadyRegistered` boolean as the second idempotency path) and — the
> genuinely new surface — the **`SchemaEncoder` encode↔decode round-trip**: the same object that `encodeData`s a write
> `decodeData`s a raw read row back into typed values. This closes a real gap (every prior example showed `set` + read
> but never how to decode a row), and is the V1 read-path mechanism for recovering typed code/state/hash/amount fields
> from the audit timeline — a local off-chain transform, PHI rule unchanged. Two name-drift notes recorded: the
> tutorials' `isSchemaRegistered`/`SchemaEncoder.decodeData` vs the SDK guide's canonical
> `sdk.streams.isDataSchemaRegistered`/`deserialiseRawData` (guide authoritative for the `sdk.streams.*` surface;
> `SchemaEncoder` is a separate encoder class). New glossary term: *SchemaEncoder*. ⚠️ **Sixth** sighting of the stale
> `dream-rpc.somnia.network` testnet RPC (both tutorials' chain config; chain ID `50312` agrees with network-info).
> ✅ **F1 candidate slug corrected:** the long-listed "F1 case study" is **not** at the intuitive
> `build-a-realtime-f1-leaderboard` (that 404s) — its real slug per [`llms.txt`](https://docs.somnia.network/llms.txt) is
> [`streams-case-study-formula-1`](https://docs.somnia.network/developer/data-streams/tutorials/streams-case-study-formula-1.md)
> ("Streaming data from OpenF1 on-chain and building reactive applications"). It remains the sole Data Streams deepening
> candidate — and, given its OpenF1/reactive framing, possibly the first worked example to actually use `subscribe`
> rather than polling.
>
> **Deepened a tenth time 2026-05-22.** Wove in the *Streams Case Study: Formula 1* tutorial — the **last** README-flagged
> Data Streams deepening candidate — fetched live (twice) and confirmed to have real content. New *The last worked example
> — and the `subscribe` recipe that isn't there* subsection. The headline result **refutes** the prior note's hypothesis:
> despite its "building reactive applications" billing, the page has **no read, no `subscribe`/`watch`, no
> `setAndEmitEvents`, and no OpenF1 poller** — it registers two schemas, encodes, `set()`s, and ends. So **no worked
> upstream tutorial demonstrates `sdk.streams.subscribe`**; the push surface lives only in the SDK methods guide and the
> intersection-with-Reactivity concept page, and every worked example renders via server-side read + client poll. Captured
> as a V1 fact: there is no copy-paste `subscribe` recipe to lift — the listener must be assembled from the guide +
> concept page and validated on a local fork. The study's *positive* contribution is a **second, independent worked
> example of schema extension** (`driver` extends `coordinates` via `computeSchemaId(parent)` →
> `parentSchemaId`), so open question #3's "versioning mechanism resolved" finding now rests on two upstream sources, not
> one. No new glossary term. ⚠️ **Seventh** sighting of the stale `dream-rpc.somnia.network` testnet RPC (chain ID `50312`
> agrees with network-info). **All README-flagged Data Streams deepening candidates are now woven in.**
