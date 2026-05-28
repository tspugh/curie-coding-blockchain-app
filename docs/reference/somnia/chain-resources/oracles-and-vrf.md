# Chain resource: Oracles & VRF

> **One line:** an **oracle** brings off-chain facts (a price, a random number) on-chain in a way a contract can
> verify. Somnia documents **DIA** and **Protofire price feeds** (SOMI/USD, BTC, ETH, …) and **Protofire–Chainlink
> VRF** for tamper-proof randomness.
>
> Upstream: [oracles overview](https://docs.somnia.network/developer/building-dapps/oracles.md) ·
> [DIA price feeds](https://docs.somnia.network/developer/building-dapps/oracles/dia-price-feeds.md) ·
> [Protofire price feeds](https://docs.somnia.network/developer/building-dapps/oracles/protofire-price-feeds.md) ·
> [VRF](https://docs.somnia.network/developer/building-dapps/oracles/using-verifiable-randomness-vrf.md). Fetched
> 2026-05-20; the four oracle citations (overview, DIA, Protofire, VRF) plus the snapshot-bot's *Integrate Chainlink
> Oracles* tutorial have been re-verified live across 2026-05-21 / -22 / -23 under the sharpened soft-404 rule (a real
> rendered body, not merely HTTP `200`). All addresses, refresh params, keys, and method signatures match upstream
> verbatim. The settlement-pricing addresses are the highest-consequence facts in this folder — a wrong address is a
> wrong settlement rate — so the **full dated re-fetch trail is preserved verbatim in
> [`verification-log.md`](verification-log.md)** rather than narrated here. One load-bearing correction from those
> passes is folded into the body below: the Protofire per-pair OCR-aggregator + read-only-proxy split is
> **mainnet-only** (testnet lists a single address per pair).
>
> Map: [chain-resources](../README.md) · Glossary: [Oracle](../GLOSSARY.md#o), [VRF](../GLOSSARY.md#v) ·
> Roadmap: [`../../../ROADMAP.md`](../../../ROADMAP.md)

## For the AI engineer: what's actually new here

You think of "getting external data" as an API call — `fetch()` a price, get a random number from a library. On-chain,
neither is free or trustworthy by default: a contract is a deterministic sandbox with **no network access** and **no
real entropy** (block hashes are predictable and miner-influenceable). An *oracle* is the bridge, and the interesting
part is the **trust model**, which comes in two shapes:

- **Push (price feeds).** A trusted off-chain process writes the price into a contract's storage on a schedule; your
  contract just reads it. DIA "continuously fetch[es] and push[es] asset prices on-chain using an `oracleUpdater`,"
  refreshing on a **0.5% deviation threshold**, **every 120 seconds**, with a **24-hour heartbeat** forced update
  ([DIA](https://docs.somnia.network/developer/building-dapps/oracles/dia-price-feeds.md)). Reading is a cheap `view`
  call — synchronous, like reading a cached value.
- **Pull / request–response (VRF).** You *ask* for a value, an off-chain decentralized network computes it **with a
  cryptographic proof**, the proof is **verified on-chain**, and a **callback** delivers the result in a *later*
  transaction ([VRF](https://docs.somnia.network/developer/building-dapps/oracles/using-verifiable-randomness-vrf.md)).
  This is asynchronous — the mental model is "submit job, get webhook," and the webhook is a Solidity function the
  protocol calls back into. (That callback is an [event-driven wake](reactivity.md), conceptually.)

The reason VRF exists at all is the same reason [native-agent determinism](native-agents.md) matters: a single party
asserting "here is a random number / here is the price" is not verifiable. VRF attaches a proof anyone can check that
the number was generated correctly and **could not have been tampered with**, so a contract — and an auditor — can rely
on it without trusting the operator.

## For the blockchain dev: how a contract reads one

### Price feeds (push model)

Two documented providers, two slightly different interfaces. Both return a price you must scale by the feed's decimals.

> ✅ **Exactly two — verified, not assumed (2026-05-22).** Somnia's curated
> [ecosystem oracle listing](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/oracles.md)
> (real content, sharpened-audit-rule check — not a GitBook soft-404) names **only DIA and Protofire** — no third oracle
> provider. This is a *checked* negative: the sibling ecosystem listings for [wallet providers](account-abstraction.md)
> and [account abstraction](account-abstraction.md) each surfaced a new vendor (Sequence, Pimlico) when read, so the
> oracle roster being exactly two is a fact worth confirming for a settlement-pricing decision, not an assumption. The
> page also pins **why the two are interchangeable at the interface**: Protofire "deploys custom, compatible oracles
> using the same data providers and node operators, allowing protocols to connect to their network without modifying
> Smart Contracts," while DIA "provides real-time on-chain oracles and trusted price feeds… on Somnia" — i.e. Protofire
> is the Chainlink-`AggregatorV3Interface`-compatible redeployment (hence the familiar 5-tuple below), DIA the
> native-`DIAOracleV2` feed with a Chainlink-style adapter. For V1 the choice is therefore *interface preference*, not
> *data-source trust*: both ultimately ride the same upstream price data.

**Protofire** uses the familiar Chainlink `AggregatorV3Interface`
(`@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol`). `latestRoundData()` returns a 5-tuple and
prices are **typically 8 decimals** — e.g. ETH/USD at $1,940.82 reads as `194082000000`; always call `decimals()`
dynamically rather than hardcoding ([Protofire](https://docs.somnia.network/developer/building-dapps/oracles/protofire-price-feeds.md)):

```solidity
// AggregatorV3Interface — pull model: your contract calls the oracle.
function getLatestPrice() public view returns (int256) {
    (, int256 price, , , ) = priceFeed.latestRoundData();  // (roundId, price, startedAt, updatedAt, answeredInRound)
    return price;                                          // divide by 10**priceFeed.decimals()
}
```

Protofire documents **ETH/USD, BTC/USD, USDC/USD**. The address *topology differs by network* (re-verified 2026-05-22):
on **mainnet** each pair has a distinct *OCR aggregator* and a read-only *proxy* address — point your consumer at the
**proxy** (e.g. USDC/USD aggregator `0x4b74EcA574Ce996448b485100e4FFf84866911dF`, proxy
`0x843B6812E9Aa67b3773675d2836646BCbd216642`) so the aggregator can be upgraded without changing your integration; on
**testnet** upstream lists a **single address per pair** with no aggregator/proxy split
([Protofire](https://docs.somnia.network/developer/building-dapps/oracles/protofire-price-feeds.md)).

**DIA** offers three surfaces ([DIA](https://docs.somnia.network/developer/building-dapps/oracles/dia-price-feeds.md)):

| Surface | Method | Returns |
|---|---|---|
| `DIAOracleV2` | `getValue(string key)` | `(uint128 price, uint128 timestamp)` |
| Solidity library | `getPrice(...)` / `getPriceIfNotOlderThan(...)` | price, with an optional **max-staleness guard** |
| `AggregatorV3Interface` | `latestRoundData()` / `getRoundData()` via a per-asset **adapter contract** | Chainlink-style tuple |

The middle surface is worth knowing: `getPriceIfNotOlderThan(...)` **reverts if the feed is staler than a caller-set
bound**, which is the safe pattern if a price ever gates a value-bearing action rather than just a display (see open
question 3).

```solidity
interface IDIAOracleV2 {
    function getValue(string memory) external view returns (uint128, uint128);  // (price, timestamp)
}
```

DIA documents **USDT, USDC, BTC, ARB, SOL, WETH, and SOMI** on both mainnet and testnet — note **SOMI itself is a
supported key**, which is what we need for settlement pricing. Mainnet oracle: `0xbA0E0750A56e995506CA458b2BdD752754CF39C4`;
testnet oracle: `0x9206296Ea3aEE3E6bdC07F7AaeF14DfCf33d865D`. Exact per-asset adapter addresses and decimals live on the
upstream page — re-read it before wiring anything.

### VRF (request–response model)

Somnia documents **Protofire–Chainlink VRF** paid in **native STT/SOMI** via **Direct Funding** — "doesn't require a
subscription and is optimal for one-off requests," with excess `msg.value` auto-refunded
([VRF](https://docs.somnia.network/developer/building-dapps/oracles/using-verifiable-randomness-vrf.md)). Your consumer
inherits `VRFV2PlusWrapperConsumerBase` (and usually `ConfirmedOwner`).

```solidity
// 1. Request — returns immediately with a requestId; randomness arrives LATER.
(uint256 requestId, uint256 paid) = requestRandomnessPayInNative(
    callbackGasLimit,      // example uses 2_100_000
    requestConfirmations,  // example uses 3 blocks
    numWords,              // example uses 3
    args
);

// 2. Callback — the wrapper calls this in a later transaction once the proof is verified on-chain.
function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
    // randomWords are now trustworthy, verifiable random values
}
```

Helpers: `getRequestPrice()` (cost in native token via `calculateRequestPriceNative()`), `getRequestStatus()`
(pending/fulfilled), `getLatestRandomWord()`. The `VRFV2PlusWrapper`, `LINK Token`, and `LINK/NATIVE oracle` addresses
differ per network (mainnet vs Shannon testnet) and are listed verbatim upstream — do not copy them from memory.

### Persisting a reading: oracle → Data Streams (the snapshot-bot pattern)

A `view` read of a price feed is **ephemeral** — it answers "what is the price *now*" and leaves nothing behind. The
[*Integrate Chainlink Oracles* tutorial](https://docs.somnia.network/developer/data-streams/tutorials/integrate-chainlink-oracles.md)
documents the opposite: an off-chain **snapshot bot** that reads an oracle and *writes the reading into a*
[Data Stream](data-streams.md) as a verifiable, queryable historical record. The shape is
**oracle (read) → snapshot bot → `sdk.streams.set()` (write on Somnia)** — pull-based and manual (a bot loop), not
event-driven.

The tutorial's bot reads Chainlink's ETH/USD feed on **Sepolia** (`0x694AA1769357215DE4FAC081bf1f309aDC325306`,
`latestRoundData()` + `decimals()`, 8 decimals so divide by `10**8`) and publishes to **Somnia testnet** (`50312`) under
a schema of `uint64 timestamp, int256 price, uint80 roundId, string pair`
([tutorial](https://docs.somnia.network/developer/data-streams/tutorials/integrate-chainlink-oracles.md)). Two details
matter for an audit log:

- It uses Chainlink's own **`roundId` as part of the [Data ID](../GLOSSARY.md#d)** so re-running the bot **dedupes**
  rather than double-writing — upstream's own framing is to *"Create a unique Data ID (using the roundId to prevent
  duplicates)"*, constructed verbatim as `toHex(\`price-${PAIR_NAME}-${priceData.roundId}\`, { size: 32 })`. This is the
  upsert/append lever from the Data Streams article, applied to prices.
- The **[publisher](../GLOSSARY.md#p) address is the attestation**: "any dApp on Somnia can now read from and trust" a
  price *because* it can see which signer wrote it. Provenance is free and cryptographic, exactly as for any other
  Data Streams record.

```typescript
// snapshot bot: read the oracle, then write the reading on-chain as a verifiable record
const schemaId = sdk.streams.computeSchemaId(/* "uint64 timestamp, int256 price, uint80 roundId, string pair" */)
await sdk.streams.registerDataSchemas(/* … */)            // idempotent — safe to call each run
const encodedData: Hex = encoder.encodeData([
  { name: 'timestamp', value: priceData.timestamp.toString(), type: 'uint64' },
  { name: 'price',     value: priceData.price.toString(),     type: 'int256' },
  { name: 'roundId',   value: priceData.roundId.toString(),   type: 'uint80' },  // also the Data-ID dedup key
  { name: 'pair',      value: PAIR_NAME,                       type: 'string' },
])
// Data ID built from the roundId so a re-run upserts the same row rather than appending a duplicate:
const dataId: Hex = toHex(`price-${PAIR_NAME}-${priceData.roundId}`, { size: 32 })
await sdk.streams.set([{ id: dataId, schemaId, data: encodedData }])  // returns a tx hash — this is on-chain
// later, any reader: sdk.streams.getAllPublisherDataForSchema(schemaId, botAddress)
```

> ⚠️ **Cross-chain in the tutorial, same-chain for us.** The tutorial reads Chainlink on *Sepolia* and writes to
> *Somnia* — a cross-chain bridge-by-snapshot. Curie has no such gap: we'd read **DIA/Protofire on Somnia itself** (see
> above) and snapshot into a Somnia Data Stream, so the bot is a same-chain read→write, not a bridge.

## How Curie V1 uses it

Our [demo loop](../../../ROADMAP.md) settles an approved claim and reports a settlement amount. Two concrete uses, both
**PHI-free by construction** — an oracle moves *prices and entropy*, never clinical data:

- **SOMI↔USD settlement pricing (push, P1).** The roadmap's settlement step shows a `ClaimSettled(claimId, finalAmount)`
  event and a "settled amount" dashboard metric, with settlement simulated via a test token / mock stablecoin
  ([ROADMAP](../../../ROADMAP.md)). If we want that USD figure to be real rather than hardcoded, a **DIA `getValue("SOMI/USD")`**
  read (SOMI is a documented key) or a **Protofire `latestRoundData()`** read converts an on-chain SOMI amount to the
  USD number judges see. It's a single `view` call — no PHI, no async, negligible gas. **Stronger variant:** if the
  audit trail should record *what rate we settled at*, a snapshot bot can write that read into the negotiation
  [Data Stream](data-streams.md) (the pattern above), so the settlement price becomes a verifiable, publisher-attested
  record alongside the claim — still PHI-free (a price and a pair string, never clinical data).
- **Impartial agent sampling (VRF, P2/stretch).** The roadmap's stretch ideas include agent reputation and dispute
  resolution. If a future version needs to pick an *auditor agent* or randomly sample claims for review, doing it with
  `requestRandomnessPayInNative` gives a **provably unmanipulated** selection — defensible to a skeptical payer. The
  VRF callback is asynchronous, so it would be wired through the same [Reactivity](reactivity.md) wake pattern the agent
  state machine already uses, not awaited inline.

**PHI boundary holds trivially.** Oracle inputs and outputs are prices and random words — there is no path by which a
clinical note could enter a feed read or a VRF request. This keeps the [no-PHI-on-chain rule](../../../ROADMAP.md) intact
with no extra care needed, unlike [native agents](native-agents.md) where prompt contents must be policed.

## Open questions (for the research loop)

1. **Do we even need a live price feed for the demo?** Three options now, not two: a **hardcoded** SOMI/USD rate
   (cleanest/most reliable for a 90-second demo), a **live `view` read** (DIA/Protofire), or a **snapshotted** read
   persisted into the audit [Data Stream](data-streams.md) (the [oracle→Data Streams pattern](#persisting-a-reading-oracle--data-streams-the-snapshot-bot-pattern)).
   The third is the only one that leaves a *verifiable on-chain record of the settlement rate* — worth it only if the
   audit story needs the rate attested, not just displayed. Feed-vs-fixture-vs-snapshot is a demo-robustness call, not a
   correctness one.
2. **VRF latency — narrowed (2026-05-21).** The round-trip is three legs: a request-confirmation wait, an off-chain
   proof computation, and a callback transaction. The **two on-chain legs are each sub-second.** The VRF page defines
   `REQUEST_CONFIRMATIONS` as "how many blocks to wait before fulfillment (trade-off between speed and reorg safety)"
   with the example set to **3**
   ([VRF](https://docs.somnia.network/developer/building-dapps/oracles/using-verifiable-randomness-vrf.md)), and the
   general FAQ states Somnia has "sub-second finality, meaning most transactions are confirmed in less than one second"
   ([FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/general-faqs.md), resolved
   live 2026-05-21) — so the confirmation wait and the callback both clear in well under a second. What stays **flagged
   unsourced** is *only the off-chain leg*: how long the decentralized network takes to generate the proof between
   confirmation and callback. Upstream publishes no wall-clock for that step — and no concrete block-time to convert
   "3 blocks" into seconds. The *labelled* "Block Time" entry in the
   [developer FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md)
   reads only "Optimized for real-time applications" (verified live 2026-05-21) — i.e. even where upstream has a slot for
   the number it leaves it qualitative (see [consensus-and-execution](consensus-and-execution.md) open question 1, where
   this is now confirmed across both the architecture overview and the FAQ) — so if VRF ever enters the demo path we
   measure that leg empirically rather than quote a number.
3. **Feed freshness for settlement.** DIA's 120 s refresh / 0.5% deviation is fine for display; if settlement amounts
   ever became binding we'd read through DIA's `getPriceIfNotOlderThan(...)` (which reverts past a staleness bound)
   rather than checking `timestamp`/`updatedAt` by hand — but that is out of scope for V1's display-only use.

## Source caveat

Addresses, decimals, method signatures, and economics above are quoted from AI-summarised fetches of the cited upstream
pages (2026-05-20; the *Integrate Chainlink Oracles* tutorial added 2026-05-21; the
[ecosystem oracle listing](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/oracles.md)
read and woven 2026-05-22, confirming the provider roster is exactly DIA + Protofire). All of these pages have since
been re-verified live (2026-05-22 and 2026-05-23) under the sharpened soft-404 rule, with every address, param, key, and
signature matching verbatim; the dated trail lives in [`verification-log.md`](verification-log.md). **Contract addresses
and decimals are network-specific and change** — before writing any oracle or VRF code, re-read the upstream DIA,
Protofire, and VRF pages for the exact addresses, supported keys, and tuple ordering. Upstream is authoritative.
