# Chain resource: Somnia Reactivity

> **One line:** a way to **respond to on-chain events without polling** — either by having a contract react
> *on-chain* in the same block, or by pushing events to an off-chain service over WebSocket. It is how one step of
> a process wakes the next.
>
> Upstream: [overview](https://docs.somnia.network/developer/reactivity.md) ·
> [on-chain](https://docs.somnia.network/developer/reactivity/reactivity-onchain.md) ·
> [off-chain](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md) ·
> [cron via SDK](https://docs.somnia.network/developer/reactivity/tutorials/cron-subscriptions-via-sdk.md) ·
> [filtered subscriptions tutorial](https://docs.somnia.network/developer/reactivity/tutorials/off-chain-reactivity-filtered-subscriptions-tutorial.md) ·
> [on-chain Solidity tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md) ·
> [wildcard tutorial](https://docs.somnia.network/developer/reactivity/tutorials/wildcard-off-chain-reactivity-tutorial.md) ·
> [JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md) (subscription transport + `eth_getLogs` limits) ·
> [litepaper: on-chain reactivity](https://docs.somnia.network/concepts/somnia-blockchain/on-chain-reactivity.md) (protocol-level same-block / MEV-resistance framing).
> Fetched 2026-05-20; the four reactivity pages re-verified live 2026-05-21 (signatures, the `0x0100` precompile, and
> the 32-SOMI / 200M-gas constraints unchanged; one paraphrased filter quote corrected to upstream wording — see the
> on-chain table). JSON-RPC API page fetched live 2026-05-21 for the reconnect/backfill mechanics; the filtered-
> subscriptions tutorial fetched live 2026-05-21 for the concrete `watch()` filter + simulation pattern below.
> **On-chain cluster re-verified live 2026-05-23** under the sharpened soft-404 rule (real body, not just HTTP `200`):
> the [overview](https://docs.somnia.network/developer/reactivity.md), the
> [on-chain reference](https://docs.somnia.network/developer/reactivity/reactivity-onchain.md), and the
> [on-chain Solidity tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md)
> — last re-checked 2026-05-21, a day behind the off-chain reference's 2026-05-22 re-fetch — all render real content and
> **match verbatim, un-drifted** (precompile `0x0100` + its three methods, 32 SOMI not-escrowed/not-consumed, the
> `200,000,000`-gas `max_reactivity_handler_gas_limit` cap, the wildcard prohibition + auto-removal formula, and the
> tutorial's `--value 33ether` / `gasLimit 2_000_000` / `priorityFeePerGas 1` / `maxFeePerGas 0` / four-slot
> `eventTopics`). One precision fix: the 32-SOMI table quote was tightened to upstream's exact wording (see the
> on-chain table). Neither core page names a chain ID or RPC URL.
> **Off-chain tutorial cluster re-verified live 2026-05-23** (the worked `watch()`/cron code an implementer types — last
> re-checked 2026-05-21, the stalest high-consequence surface left after the on-chain cluster moved to 2026-05-23): the
> [filtered-subscriptions](https://docs.somnia.network/developer/reactivity/tutorials/off-chain-reactivity-filtered-subscriptions-tutorial.md),
> [wildcard](https://docs.somnia.network/developer/reactivity/tutorials/wildcard-off-chain-reactivity-tutorial.md), and
> [cron-via-SDK](https://docs.somnia.network/developer/reactivity/tutorials/cron-subscriptions-via-sdk.md) tutorials all
> render real content and **match verbatim, un-drifted** (the five `watch()`→RPC field mappings, the
> `toEventSelector`/`toFunctionSelector`/`decodeEventLog`/`decodeFunctionResult` Viem helpers, `sdk.subscribe` in the
> wildcard tutorial, and the cron `scheduleSubscriptionAtBlock`/`scheduleSubscriptionAtTimestamp` + `BlockTick`/`Schedule`
> + 32-SOMI + 12-second-lead-time facts). Two precision fixes: the `context` one-based note and the wildcard
> subscription-lifecycle line — both paraphrases passing as verbatim — were tightened to upstream's exact wording (see
> the off-chain sections + source caveat). None of the three tutorials names a chain ID or RPC URL.
>
> Map: [chain-resources](../README.md) · Glossary: [Reactivity](../GLOSSARY.md#r), [Cron subscription](../GLOSSARY.md#c) ·
> Roadmap: [`../../../ROADMAP.md`](../../../ROADMAP.md)

## For the AI engineer: what's actually new here

In an off-chain agent system you wire steps together with a queue, a webhook, or a polling loop: agent A finishes,
*something* notices, agent B wakes. Reactivity is that "something", but built into the chain. There are **two
complementary modes** ([overview](https://docs.somnia.network/developer/reactivity.md)):

- **On-chain reactivity** "stores persistent event subscriptions in chain state and then executes contract handlers
  when matching events are committed." The reaction is *part of chain execution* — guaranteed and publicly visible,
  paid for in SOMI. No off-chain process has to be running for it to fire.
- **Off-chain reactivity** "is a WebSocket feature served by the node API. A client subscribes once, receives pushed
  events, and can ask the node to run read-only simulations for each event so that derived state arrives in the same
  message — minimising latency."

The mental model: on-chain reactivity is a **chain-native trigger** (like a database trigger that itself writes to the
database); off-chain reactivity is a **subscription** (like listening to a Kafka topic), except it can also hand you
the *computed* result of a read in the same push, so your client doesn't make a second round-trip. The docs split the
use cases cleanly: on-chain "suits scenarios where reactions must be part of chain execution," while off-chain "works
best for client-side operations (UI updates, indexing, bot monitoring)" that don't need on-chain integration or SOMI
([overview](https://docs.somnia.network/developer/reactivity.md)).

## For the blockchain dev: how it works

### On-chain reactivity — a contract reacts to a contract

"On-chain reactivity lets a smart contract instantly react to events in the same block, without anyone sending an
event handling transaction" ([on-chain](https://docs.somnia.network/developer/reactivity/reactivity-onchain.md)). The
handler contract inherits from `SomniaEventHandler` and overrides a protected hook:

```solidity
function _onEvent(
    address emitter,
    bytes32[] calldata eventTopics,
    bytes calldata data
) internal override { }
```

To activate, the contract calls `SomniaExtensions.subscribe(address(this), filter, options)`, which returns a
subscription ID; the **caller becomes the owner and pays gas for all handler invocations**. Subscriptions are created
through a precompile at `0x0100` exposing `subscribe(...)`, `unsubscribe(uint256)`, and `getSubscriptionInfo(uint256)`
([on-chain](https://docs.somnia.network/developer/reactivity/reactivity-onchain.md)).

Constraints worth knowing before you design around it ([on-chain](https://docs.somnia.network/developer/reactivity/reactivity-onchain.md)):

| Constraint | Value |
|---|---|
| Owner minimum balance at creation | **32 SOMI** — "The 32 SOMI is not an escrow and not consumed. It sits in the owner's regular balance" (re-verified verbatim 2026-05-23) |
| `gasLimit` | non-zero, capped at **200,000,000** gas (the `max_reactivity_handler_gas_limit`) |
| Wildcard filters | not allowed — "At least one filter is required — wildcard subscriptions that match every log on the chain are not allowed" |
| Auto-removal | dropped when the owner balance is "less than `(execution price per gas + priorityFeePerGas) * gasLimit`" at fire time |

So an on-chain reaction is *not free standing magic*: a funded owner is footing the gas for every fire, and a starved
owner silently loses the subscription. Note the 32 SOMI is a **liquidity gate, not a deposit** — it is not escrowed, so
it doesn't tie up capital per subscription, but the owner must keep enough on hand to cover each `gasLimit` or the
subscription is silently removed.

#### The concrete on-chain pattern — a handler contract reacting to ERC-20 `Transfer`

The abstract `_onEvent` hook and `subscribe(...)` call above are made concrete in the
[on-chain Solidity tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md),
which builds a `TransferCounter` that increments on every ERC-20 `Transfer` from a watched token. The handler inherits
`SomniaEventHandler` and decodes the log by hand — indexed args come from `eventTopics`, the non-indexed value from
`data` ([tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md)):

```solidity
contract TransferCounter is SomniaEventHandler {
    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        address from = address(uint160(uint256(eventTopics[1])));
        address to   = address(uint160(uint256(eventTopics[2])));
        uint256 value = abi.decode(data, (uint256));
        // ... increment counter ...
    }
}
```

The subscription is created with two structs. The `SubscriptionFilter`'s `eventTopics` is a **four-slot array** —
slot 0 is the event-signature hash, slots 1–3 are the indexed-argument positions, and `bytes32(0)` in a slot means
"match any value here." `TRANSFER_TOPIC` is `keccak256("Transfer(address,address,uint256)")`; `emitter` pins the
watched contract and `origin` is left `address(0)`
([tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md)):

```solidity
SomniaExtensions.SubscriptionFilter memory filter =
    SomniaExtensions.SubscriptionFilter({
        eventTopics: [TRANSFER_TOPIC, bytes32(0), bytes32(0), bytes32(0)],
        origin: address(0),
        emitter: token_
    });

SomniaExtensions.SubscriptionOptions memory options =
    SomniaExtensions.SubscriptionOptions({
        priorityFeePerGas: 1,
        maxFeePerGas: 0,
        gasLimit: gasLimit          // tutorial uses 2_000_000
    });

subscriptionId = SomniaExtensions.subscribe(address(this), filter, options);
```

Three things in the worked example matter for our design:

- **It is deployed pre-funded.** The tutorial deploys the handler with `--value 33ether` — "32 for subscription + 1 for
  gas" — and the constructor creates the subscription, so the contract itself is the funded owner.
- **The reaction is a follow-up transaction, not an inline one.** "After the transfer lands, the chain checks the log
  against active subscriptions. If it matches, validators include a **synthetic transaction** that calls the handler",
  and "the handler runs in a separate **reactive transaction** after the triggering transaction has executed"
  ([tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md)). So
  the guarantee is *eventual within the block flow*, not atomic with the trigger — see
  [`GLOSSARY.md` → Reactive transaction](../GLOSSARY.md#r).
- **Cancel is explicit, and self-triggering is a footgun.** Unsubscribe is `SomniaExtensions.unsubscribe(subscriptionId)`
  (the tutorial wraps it in an `onlyOwner stop()` that then zeroes `subscriptionId`), and the docs warn to "avoid
  feedback loops where the handler emits an event that also matches its own subscription"
  ([tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md)) — a
  real hazard if a Curie settlement handler emitted a `Settled` event that some other subscription, or its own, watched.

#### The protocol-level picture (litepaper) — *why* it's same-block and MEV-resistant

The developer pages above describe the *mechanism* (a `SomniaEventHandler`, a precompile subscription, a follow-up
synthetic transaction). The litepaper's
[on-chain reactivity](https://docs.somnia.network/concepts/somnia-blockchain/on-chain-reactivity.md) concept page adds
the *protocol-level guarantees* underneath it — and reconciles a point that looks contradictory across the two layers.

The developer tutorial frames the reaction as a **separate** "reactive transaction… after the triggering transaction has
executed" (above), while the litepaper states the **"Reaction included in the same block."**
([on-chain reactivity](https://docs.somnia.network/concepts/somnia-blockchain/on-chain-reactivity.md)). These are
compatible, not contradictory: the reaction is a *distinct* synthetic transaction (so it is **not atomic** with the
trigger — see [Reactive transaction](../GLOSSARY.md#r)), yet it is **deterministically included in the same block** as
the trigger. So "not atomic" governs *ordering* (the reaction runs after, in its own tx); "same block" governs *latency*
(no next-block wait). For a sequential agent state machine that distinction is exactly the one that matters: a Curie
negotiation step's on-chain reaction lands in the same block, but a handler still cannot read the trigger's effects as if
they were inline.

The genuinely new protocol claim is the determinism guarantee. The litepaper contrasts three ways to react to an event
([on-chain reactivity](https://docs.somnia.network/concepts/somnia-blockchain/on-chain-reactivity.md)):

| Model | Reaction timing | Trust |
|---|---|---|
| Traditional RPC / polling | "Next block" | "Developer infra" (you run and maintain it) |
| Indexer / Web3 hooks | "Next block" | "Centralized service" (a third party) |
| **Somnia on-chain reactivity** | **"Same block"** | **"Fully decentralized"** |

— and asserts the chain-native path is **"Fully MEV-resistant due to deterministic inclusion of event handlers"**
([on-chain reactivity](https://docs.somnia.network/concepts/somnia-blockchain/on-chain-reactivity.md)). That MEV-resistance
is a property the developer pages never claim: because the validator set inserts the handler's synthetic transaction
deterministically rather than leaving it to a mempool race, a reaction cannot be front-run, reordered, or censored by a
block builder for advantage. For a payer↔provider negotiation, that means a settlement or counter-offer reaction is not
auctionable — no MEV searcher can wedge a transaction between the trigger and its handler.

> ⚠️ **Availability caveat — drift flagged for human review (2026-05-23).** As of a live 2026-05-22 fetch the litepaper
> [on-chain reactivity](https://docs.somnia.network/concepts/somnia-blockchain/on-chain-reactivity.md) page stated
> **"Somnia Reactivity is currently only available on TESTNET."** On re-fetch 2026-05-23 (the page fetched twice) that
> sentence is **no longer present** — and it does not appear on the reactivity
> [overview](https://docs.somnia.network/developer/reactivity.md),
> [on-chain reference](https://docs.somnia.network/developer/reactivity/reactivity-onchain.md), or
> [on-chain tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md)
> either. Upstream has stopped publishing the testnet-only restriction; this is **not** positive confirmation that
> on-chain reactivity is now live on mainnet — only that the restriction is no longer documented. For V1 nothing changes:
> the [demo loop](../../../ROADMAP.md) runs on Shannon testnet (chain ID `50312`), and the off-chain WebSocket mode (the
> V1 default below) never carried this caveat. But any *mainnet* path that depends on on-chain reactivity or cron remains
> **unconfirmed** — verify on-chain reactivity is actually live on mainnet (not merely undocumented as testnet-only)
> before relying on it. Flagged for human review at mainnet planning.
>
> **Stability re-check (2026-05-23, independent fetch):** the same litepaper page was re-fetched once more in a separate
> session and the testnet-only sentence is **still absent**, while the page's two load-bearing quotes — *"Reaction
> included in the same block"* and *"Fully MEV-resistant due to deterministic inclusion of event handlers"* — both still
> render **verbatim** on a real (non-404) body. So the caveat's disappearance is holding across independent fetches, not
> a one-time GitBook soft-404 or partial render; the removal is a genuine upstream edit. The conclusion is unchanged —
> still *not* positive mainnet confirmation — but the observation is now corroborated rather than single-fetch.

### Off-chain reactivity — your service reacts to a contract

This is a **WebSocket subscription served by the node API**: "A client subscribes to matching logs and receives pushed
events as they land in blocks" ([off-chain](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md)).
Under the hood it uses the standard JSON-RPC `eth_subscribe` method with the parameter `somnia_watch`; the node returns
a subscription ID and pushes `eth_subscription` notifications, with optional simulation results in the same payload.
`eth_unsubscribe` (or closing the socket) ends it.

For TypeScript the official package is **`@somnia-chain/reactivity`**, which "wraps the WebSocket protocol with Viem and
manages subscription/unsubscription, so you don't have to drive `eth_subscribe` directly"
([off-chain](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md)). The primary method is
`sdk.watch()`, taking `eventContractSources`, `topicOverrides`, `ethCalls`, and `onData` / `onError` callbacks.
Filtering is by **address** and **topic** (single hash, OR-array, or null=any), plus **simulation calls** that run
read-only operations on each match.

Two properties matter for design: the subscription is "not stored on chain, does not cost SOMI, and disappears when the
client disconnects or unsubscribes," and it **only delivers events from the subscription point forward, not historical
data** ([off-chain](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md)). For history you need
indexing/subgraphs (see [indexing-subgraphs.md](indexing-subgraphs.md)) or a direct RPC backfill (next paragraph).

The transport details that make those properties enforceable live in the [JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md):
`eth_subscribe` requires "a WebSocket connection" — over plain HTTP it returns `"events_not_supported"` — and the
filters it creates are "scoped to the connection that created them." So a dropped socket doesn't just pause delivery; it
**destroys the subscription**, which is why reconnect needs an explicit backfill (below). Somnia's supported subscription
types are `newHeads`, `logs`, `somnia_finishedTransactions`, `somnia_finishedBlocks`, and `somnia_watch`
([JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md)); the `@somnia-chain/reactivity` `sdk.watch()`
above rides the `somnia_watch` variant. See [`GLOSSARY.md` → eth_getLogs / eth_subscribe](../GLOSSARY.md#e).

#### The concrete `watch()` pattern — filtering to one event, with a simulation

The abstract `address` + `topic` filtering above is made concrete in the
[filtered-subscriptions tutorial](https://docs.somnia.network/developer/reactivity/tutorials/off-chain-reactivity-filtered-subscriptions-tutorial.md),
which subscribes to ERC-20 `Transfer` logs *and* asks the node to run `balanceOf(recipient)` for each match — so the
event **and** the recipient's post-transfer balance arrive in one push. The `sdk.watch()` parameters map one-to-one onto
the underlying RPC fields ([tutorial](https://docs.somnia.network/developer/reactivity/tutorials/off-chain-reactivity-filtered-subscriptions-tutorial.md)):

| `watch()` parameter | RPC field | Role |
|---|---|---|
| `eventContractSources` | `address` | which contract(s) to watch |
| `topicOverrides` | `topics` | which event signature(s) — the filter |
| `ethCalls` | `eth_calls` | read-only simulation(s) to run per match |
| `context` | `context` | inject a matched log topic into the simulation calldata |
| `onlyPushChanges` | `push_changes_only` | suppress pushes when the simulated result is unchanged |

The filter is built from the **event signature**, not a raw hash: Viem's `toEventSelector('Transfer(address,address,uint256)')`
produces the topic for `topicOverrides`, and `toFunctionSelector()` produces the `balanceOf` selector for the `ethCall`.
The simulation's argument is wired from the event with `context`: upstream states *"The off-chain Reactivity context
selector is one-based, so `topic3` appends `topics[2]` to the call data"* — so `context: 'topic3'` injects `topics[2]`
(the recipient) into the `balanceOf` calldata. Inbound, `onData` decodes with `decodeEventLog()` /
`decodeFunctionResult()`; `subscription.unsubscribe()` ends it
([tutorial](https://docs.somnia.network/developer/reactivity/tutorials/off-chain-reactivity-filtered-subscriptions-tutorial.md)):

```typescript
const subscription = await sdk.watch({
  eventContractSources: [tokenAddress],
  topicOverrides: [toEventSelector('Transfer(address,address,uint256)')],
  ethCalls: [{ to: tokenAddress, data: toFunctionSelector('balanceOf(address)') }],
  context: 'topic3',          // one-based: topic3 -> topics[2] (the recipient)
  onlyPushChanges: false,
  onData: (data) => { /* decodeEventLog / decodeFunctionResult */ },
  onError: (error) => { /* handle */ },
});
```

For us this is the off-chain wake mechanism made precise: a `watch()` filtered to a single negotiation event signature
(`topicOverrides`) **and** a single claim contract (`eventContractSources`) is how the payer agent's process reacts to
*only* the proposals it cares about, and the per-match simulation can return the **current claim status** in the same
push — replacing a follow-up `eth_call`. ⚠️ Note the sharper PHI boundary this draws: `context` injects an **indexed
event topic** into a call, so the indexed args used as filter keys (the claim ID, agent address) must stay PHI-free —
never index a patient identifier. See [`GLOSSARY.md` → Filtered subscription](../GLOSSARY.md#f).

#### The wildcard pattern — and why it's a dev tool, not a V1 mechanism

The filtered `watch()` above narrows to one contract and one signature. The opposite extreme is a **wildcard
subscription**, documented in the
[wildcard tutorial](https://docs.somnia.network/developer/reactivity/tutorials/wildcard-off-chain-reactivity-tutorial.md),
which "omits both address and topic filters, so the node pushes every new log it sees on the WebSocket connection." Two
things stand out for our design. First, the call shape: you simply leave `eventContractSources` and `topicOverrides`
off the subscription object, so **the absence of a filter is what makes it a wildcard** — there is no explicit "match
all" flag (and recall on-chain reactivity *forbids* wildcards entirely; this is an off-chain-only capability). Second,
the tutorial creates the subscription with **`sdk.subscribe({...})`**, not the `sdk.watch({...})` used by the filtered
tutorial above — a method-name divergence between two upstream tutorials on the same SDK. **Resolved 2026-05-21
toward `watch`:** the authoritative
[off-chain reactivity reference](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md) page documents
**only** `sdk.watch()` as the off-chain *SDK* subscription method (re-fetched live **2026-05-22** with a literal-text
check — the bare token `subscribe` appears on the page only as the JSON-RPC transport `eth_subscribe`/`eth_unsubscribe`
that `sdk.watch()` wraps, never as an `sdk.subscribe()` SDK method), and the filtered tutorial agrees. `sdk.subscribe()` appears **only** in the wildcard tutorial. Both forms share the identical
shape and the same `new SDK({ public: ... })` construction, so they are almost certainly the same call under two names —
but since upstream does not document `subscribe` or state the two are aliases, **write `watch()` in V1 code** (the
reference-page name) and treat `subscribe` as undocumented tutorial drift until upstream says otherwise (still flagged in
the source caveat below). The publicClient is built over a **WebSocket** transport
and the SDK wraps it as `new SDK({ public: publicClient })`
([wildcard tutorial](https://docs.somnia.network/developer/reactivity/tutorials/wildcard-off-chain-reactivity-tutorial.md)):

```typescript
const subscription = await sdk.subscribe({
  ethCalls: [],
  onData: (data) => {
    const event = data.result;
    if (event.topics[0] !== transferTopic) {   // manual topic guard, since the stream is unfiltered
      return;
    }
    const decoded = decodeEventLog({ abi: erc20Abi, topics: event.topics, data: event.data });
    // ... use decoded.args ...
  },
  onError: (error) => { /* handle */ },
});
// ...
await subscription.unsubscribe();
```

Because the stream is unfiltered, **decoding moves into the client**: you don't know the emitting contract or event
ahead of time, so the tutorial guards on `event.topics[0] !== transferTopic` (the signature hash from
`toEventSelector`) before calling `decodeEventLog` with a known ABI — otherwise an unrelated log would mis-decode. This
is the same filtering work, just done *after* the push instead of at the node. The tutorial is explicit about when that
trade-off is acceptable: wildcard subscriptions "are useful for quick testing and exploratory scripts. Production
applications should usually add filters"
([wildcard tutorial](https://docs.somnia.network/developer/reactivity/tutorials/wildcard-off-chain-reactivity-tutorial.md)).
Like all off-chain reactivity, the tutorial restates the lifecycle verbatim — off-chain subscriptions *"live only for
the WebSocket connection that created them, are not stored on-chain, do not require a wallet client or gas."*

For Curie V1 the wildcard is an **anti-pattern in production but a useful development tool**. We never want an agent
process receiving *every* log on the chain — that is wasted bandwidth, client-side decode cost, and (sharper) a PHI/scope
hazard: a wildcard listener sees logs from contracts that are none of its business, so filtering must happen at
**subscribe** time, exactly as the [filtered pattern](#the-concrete-watch-pattern--filtering-to-one-event-with-a-simulation)
does. Where it earns its place is *before* the contracts are finalised: during development a wildcard `subscribe`
against a freshly deployed `ClaimNegotiation` contract is the fastest way to discover **which events it actually emits
and in what topic layout**, so we can then write the precise `topicOverrides` filter the agents will use in the demo.
See [`GLOSSARY.md` → Wildcard subscription](../GLOSSARY.md#w).

### Cron — scheduled on-chain callbacks

The same `@somnia-chain/reactivity` SDK lets an **EOA or backend own and pay for a scheduled on-chain callback** while a
Solidity handler receives the reactive transaction
([cron](https://docs.somnia.network/developer/reactivity/tutorials/cron-subscriptions-via-sdk.md)):

| Helper | System event | Fires |
|---|---|---|
| `scheduleSubscriptionAtBlock` | `BlockTick(uint64)` | "Every block if blockNumber is omitted, or once at the specified block" |
| `scheduleSubscriptionAtTimestamp` | `Schedule(uint256)` | "Once, when block time first reaches the requested millisecond timestamp" |

The handler contract must implement `onEvent(address,bytes32[],bytes)`, and the owning EOA needs "at least 32 SOMI."
Timing is validated: "The SDK returns an Error when `timestampMs < Date.now() + 12_000`, so schedule at least 12 seconds
ahead" — and it returns the error rather than throwing, so check `instanceof Error`. Cancel with
`sdk.cancelSoliditySubscription(subscriptionId)`
([cron](https://docs.somnia.network/developer/reactivity/tutorials/cron-subscriptions-via-sdk.md)).

## How Curie V1 could use it

Our [demo loop](../../../ROADMAP.md) is a sequential negotiation: a provider agent proposes ICD-10 code support, a payer
agent approves / downcodes / requests evidence, and on agreement a settlement is anchored — each step waking the next.
Reactivity is the **wake mechanism** for that state machine, and the two modes split cleanly along our existing
on-chain/off-chain boundary:

- **Off-chain reactivity drives the live UI timeline.** A `@somnia-chain/reactivity` `sdk.watch()` subscription on the
  negotiation events (`CodeProposalAdded`, `EvidenceRequested`, `ClaimCountered`, `ClaimAgreed`) pushes each event to
  the dashboard over WebSocket the instant it lands — no polling, no SOMI cost, and the simulation hook can even return
  derived state (e.g. current claim status) in the same message. This is the natural consumer of the
  [Data Streams](data-streams.md) event-stream fan-out.
- **Off-chain reactivity can also wake the next agent.** Because our agents are
  [off-chain `somnia-agent-kit` processes](../../somnia-agent-kit/), a backend `watch()` listener is the simplest way to
  have the payer agent's process react to a provider agent's on-chain proposal — the queue-replacement role above.
- **On-chain reactivity / cron is the fallback for autonomous progress.** If a step must advance even when no agent
  process is running — e.g. a settlement window expiring, or a timed escalation — `scheduleSubscriptionAtTimestamp`
  gives us a chain-native timer with no off-chain scheduler. Cost: a funded owner EOA (≥32 SOMI) paying handler gas.
- **PHI boundary — what reactivity actually carries.** Reactivity matches and forwards **event topics and log data**, so
  the same rule as all on-chain mechanisms applies: the events it triggers on must contain **only** hashes, code
  identifiers, claim state, agent addresses, timestamps, and amounts — **never** clinical notes or patient identifiers
  (the ROADMAP's [do-not-store list](../../../ROADMAP.md)). On-chain subscription *filters* also live in chain state, so
  even a filter must be PHI-free. Off-chain reactivity adds no new storage (it "does not cost SOMI" and isn't persisted),
  but it can only forward what was already emitted on-chain — so the boundary is enforced at emission, upstream of here.

### The "on-chain vs off-chain reactivity" decision for V1

For a 90-second hackathon demo, **off-chain reactivity is almost certainly the V1 default**: zero SOMI, lowest latency,
trivial to wire to both the UI and the agent backend. On-chain reactivity (and cron) earns its 32-SOMI-and-gas cost only
where a reaction *must* happen without a live process — autonomous timeouts and settlement deadlines. Which lifecycle
transitions, if any, need that guarantee is a spec decision — flagged for the research loop, not settled here.

## Open questions (for the research loop)

1. ~~**WebSocket reliability for the demo.**~~ *Resolved 2026-05-21:* off-chain subscriptions "disappear when the client
   disconnects" and replay no history, and the [JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md)
   confirms the filter is "scoped to the connection that created them" — so the reconnect + backfill story is concrete:
   on reconnect, **(a)** re-open the WebSocket and re-`sdk.watch()` from the current head, then **(b)** replay the gap
   with `eth_getLogs` over the missed block range. The only constraint is that `eth_getLogs`' "block range must not
   exceed 1000 blocks" per call ([JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md)), so a long
   outage must page the backfill in ≤1000-block windows. Track the last-seen block number client-side as the resume
   cursor. A [subgraph](indexing-subgraphs.md) is the heavier alternative if backfill windows routinely exceed what
   paged `eth_getLogs` can serve in time. See [`GLOSSARY.md` → eth_getLogs / eth_subscribe](../GLOSSARY.md#e).
2. **Is any on-chain reaction actually required for V1?** Or can every transition be driven off-chain, deferring the
   32-SOMI on-chain-subscription cost entirely?
3. **Cron timer granularity.** `scheduleSubscriptionAtTimestamp` enforces ≥12 s lead time and fires "once when block
   time first reaches" the target — fine for settlement windows, but does sub-second agent pacing need block-tick
   scheduling instead? Unmeasured against our [gas/finality model](../../../research/somnia/finality-tps-and-gas-model.md).

## Source caveat

Interface names, method signatures, the precompile address `0x0100`, and the 32-SOMI / 200M-gas constraints above are
quoted from AI-summarised fetches of the cited upstream pages (2026-05-20), with the on-chain reference + tutorial
**re-verified live 2026-05-23** (real body, not just HTTP `200`): the precompile address + its three methods, the 32-SOMI
not-escrowed/not-consumed rule, the `200,000,000`-gas `max_reactivity_handler_gas_limit` cap, the wildcard prohibition,
and the auto-removal formula all match verbatim — un-drifted. The `@somnia-chain/reactivity` API and the
on-chain precompile ABI may change pre-GA — re-read the upstream
[on-chain](https://docs.somnia.network/developer/reactivity/reactivity-onchain.md) and
[off-chain](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md) pages for exact signatures before
writing code. The subscription-transport facts (WebSocket-only `eth_subscribe`, connection-scoped filters, the
1000-block `eth_getLogs` cap, and the supported subscription types) are quoted from a live 2026-05-21 fetch of the
[JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md) page. The `watch()` ↔ RPC field mapping, the
`toEventSelector` / `toFunctionSelector` / `decodeEventLog` / `decodeFunctionResult` Viem helpers, the one-based
`context: 'topic3'` topic-injection rule, and `onlyPushChanges` are quoted from a live 2026-05-21 fetch of the
[filtered-subscriptions tutorial](https://docs.somnia.network/developer/reactivity/tutorials/off-chain-reactivity-filtered-subscriptions-tutorial.md),
**re-verified live 2026-05-23** (sharpened soft-404 rule, real body): the five `watch()`→RPC field mappings, the four
Viem helpers, and `subscription.unsubscribe()` all match verbatim — un-drifted. One precision fix: the one-based
`context` note had asserted "one-based" as an authorial gloss with only the fragment *"appends `topics[2]`"* quoted;
upstream states the whole rule itself — *"The off-chain Reactivity context selector is one-based, so `topic3` appends
`topics[2]` to the call data"* — so the quote was extended to the full upstream sentence (gloss → word-for-word source).
The `TransferCounter` worked example — `SomniaEventHandler._onEvent`, the four-slot `eventTopics` filter with
`bytes32(0)` wildcards, the `SubscriptionFilter` / `SubscriptionOptions` structs, `SomniaExtensions.subscribe` /
`unsubscribe`, the `--value 33ether` pre-funding, and the "synthetic transaction" / "reactive transaction" execution
model — is quoted from a live 2026-05-21 fetch of the
[on-chain Solidity tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md),
**re-verified live 2026-05-23** (`--value 33ether`, `gasLimit 2_000_000`, `priorityFeePerGas 1`, `maxFeePerGas 0`, the
four-slot `eventTopics`, and the synthetic/reactive-transaction framing all match verbatim — un-drifted).
The protocol-level framing — "Reaction included in the same block," "Fully MEV-resistant due to deterministic inclusion
of event handlers," and the three-model (RPC / indexer-hooks / Somnia) timing-and-trust contrast — is quoted from the
litepaper [on-chain reactivity](https://docs.somnia.network/concepts/somnia-blockchain/on-chain-reactivity.md) concept
page, **re-verified live 2026-05-23** (both same-block and MEV-resistance quotes un-drifted). ⚠️ **One drift this run:**
the same page's "Somnia Reactivity is currently only available on TESTNET" sentence — quoted from a live 2026-05-22 fetch
— is **no longer present** on the page (re-fetched twice 2026-05-23), so it has been moved from a current quote to the
availability-caveat box above and flagged for human review; see that box for the full reconciliation. The litepaper
page is a high-level vision document and does **not** specify *how* validators detect or schedule handlers, so the
mechanism above stays sourced to the developer pages.
The wildcard pattern — the filter-less `sdk.subscribe({...})` call, the client-side `event.topics[0]` guard before
`decodeEventLog`, `new SDK({ public: publicClient })` over a WebSocket transport, `subscription.unsubscribe()`, and the
"useful for quick testing… production applications should usually add filters" guidance — is quoted from a live
2026-05-21 fetch of the
[wildcard tutorial](https://docs.somnia.network/developer/reactivity/tutorials/wildcard-off-chain-reactivity-tutorial.md),
**re-verified live 2026-05-23** (sharpened soft-404 rule, real body): `sdk.subscribe({...})`, the `event.topics[0]`
guard before `decodeEventLog`, the "quick testing… add filters" guidance, and `new SDK({ public: publicClient })` all
match verbatim — un-drifted. One precision fix: the subscription-lifecycle line had passed bracket-edited paraphrase
(*"live[s] only…"*, *"does … not require…"*) off as three separate quotes; restored to upstream's exact contiguous
wording — *"live only for the WebSocket connection that created them, are not stored on-chain, do not require a wallet
client or gas."*
**Method-name divergence — partially resolved 2026-05-21.** The wildcard tutorial creates its subscription with
`sdk.subscribe(...)` while the filtered tutorial uses `sdk.watch(...)`. The authoritative
[off-chain reactivity reference](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md) page (re-fetched
live 2026-05-21, **re-verified 2026-05-22 by a literal-text check**) documents **only** `sdk.watch()` as the SDK method:
the page's *only* occurrences of the token `subscribe` are the JSON-RPC transport `eth_subscribe`/`eth_unsubscribe` —
i.e. `sdk.watch()`'s underlying RPC, exactly as the off-chain section above quotes ("so you don't have to drive
`eth_subscribe` directly") — **not** an `sdk.subscribe()` SDK method. The [reactivity
overview](https://docs.somnia.network/developer/reactivity.md) names neither. The two calls share an identical object
shape and the same `new SDK({ public: ... })` construction, so they are very likely one method under two names — but
because no upstream page documents `subscribe` or states an alias relationship, we cannot *confirm* they are
interchangeable. **Decision for V1: use `watch()`** (the reference-documented name). ⚠️ Residual flag for human review:
if a future SDK version renames or splits these, re-check the published `@somnia-chain/reactivity` API. Upstream is
authoritative.
