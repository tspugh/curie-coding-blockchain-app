# Chain resource: Somnia consensus & execution

> **One line:** the four architectural choices — **MultiStream Consensus**, **Accelerated Sequential Execution**,
> **IceDB**, and **advanced compression** — that make Somnia fast enough for a live, many-step agent loop to feel
> real-time instead of like a sequence of slow on-chain confirmations.
>
> Upstream: [architecture overview](https://docs.somnia.network/concepts/somnia-blockchain/overview.md) ·
> [MultiStream Consensus](https://docs.somnia.network/concepts/somnia-blockchain/multistream-consensus.md) ·
> [Accelerated Sequential Execution](https://docs.somnia.network/concepts/somnia-blockchain/accelerated-sequential-execution.md) ·
> [IceDB](https://docs.somnia.network/concepts/somnia-blockchain/somnias-icedb.md) ·
> [Advanced Compression](https://docs.somnia.network/concepts/somnia-blockchain/advanced-compression-techniques.md) ·
> [developer FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md)
> (developer-facing performance summary; fetched 2026-05-21, re-verified live 2026-05-22 and again 2026-05-23 — un-drifted, see source caveat). Litepaper pages fetched 2026-05-20;
> all four pages' quotes re-verified live 2026-05-21 (three quotes corrected to match upstream wording — see source caveat).
> Dedicated *Advanced Compression* litepaper page fetched & verified live 2026-05-22 (see source caveat).
> Litepaper [problem](https://docs.somnia.network/concepts/litepaper/problem.md) page fetched & verified live 2026-05-22 (see source caveat).
> Litepaper [introduction](https://docs.somnia.network/concepts/introduction.md) page fetched & verified live 2026-05-22 (see source caveat).
> Core [MultiStream Consensus](https://docs.somnia.network/concepts/somnia-blockchain/multistream-consensus.md) +
> [Accelerated Sequential Execution](https://docs.somnia.network/concepts/somnia-blockchain/accelerated-sequential-execution.md)
> litepaper pages re-verified live 2026-05-23 — both render real content (sharpened soft-404 rule) and every quote is
> un-drifted; one paraphrased compilation-strategy quote tightened to upstream wording (see source caveat).
> Parent [architecture overview](https://docs.somnia.network/concepts/somnia-blockchain/overview.md) page — the source of
> the four-innovations table below, and the **last** core consensus surface still on the 2026-05-21 check — re-verified
> live 2026-05-23: renders real content (sharpened soft-404 rule) and all four table quotes are un-drifted (see source caveat).
>
> Map: [chain-resources](../README.md) · Glossary: [MultiStream Consensus](../GLOSSARY.md#m) ·
> [Accelerated Sequential Execution](../GLOSSARY.md#a) · [IceDB](../GLOSSARY.md#i) ·
> [Advanced compression](../GLOSSARY.md#a) · Roadmap: [`../../../ROADMAP.md`](../../../ROADMAP.md)

This is a **background** article. Unlike Data Streams or Reactivity, you never call these primitives directly — they
are *why* the chain behaves the way it does. Read it once so you can answer a judge's "why Somnia and not Ethereum?"
with something concrete, then move on.

## For the blockchain dev: four ideas, one goal

Somnia is an EVM-compatible L1, so your Solidity and tooling are unchanged (see
[`smart-contract-dev.md`](smart-contract-dev.md)). What's different is *underneath* the EVM. Upstream lists **four core
innovations** ([overview](https://docs.somnia.network/concepts/somnia-blockchain/overview.md)):

| Innovation | What it changes | The claim (quoted upstream) |
|---|---|---|
| **MultiStream Consensus** | How blocks are produced & ordered | "decouples data production from the consensus process, significantly enhancing overall efficiency" |
| **Compiled bytecode** (Accelerated Sequential Execution) | How transactions run | execution "close to hand-written C++ contracts… millions of transactions per second on a single core" |
| **IceDB** | How state is stored & gas is metered | "average read/write operations 15-100 nanoseconds with built in snapshotting" |
| **Advanced compression** | How transaction data is shipped between validators | streaming compression + BLS aggregation for "extremely high compression ratios" |

> ✅ **Corroborated by the developer FAQ (fetched 2026-05-21; re-verified live 2026-05-22 and 2026-05-23 — un-drifted).** The litepaper overview isn't the only upstream
> page that frames the architecture this way — the developer-facing
> [FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md) states
> Somnia "achieves 1M+ TPS through four key innovations" and names them identically: *Accelerated Sequential Execution,
> IceDB, MultiStream Consensus, Advanced Compression*. The same FAQ publishes the headline performance line verbatim —
> "TPS Capacity: 1,000,000+ transactions per second" and "Finality Time: Sub-second transaction finality" — and
> reaffirms full EVM compatibility ("All Solidity features work identically," same "gas mechanics and opcodes,"
> "Compatible with OpenZeppelin libraries"). **Note the one thing it still does *not* quantify:** its "Block Time" entry
> reads only "Optimized for real-time applications" — a labelled field with no number. Even where upstream has a slot for
> a block-time figure, it deliberately leaves it qualitative; see open question 1 and
> [`oracles-and-vrf.md`](oracles-and-vrf.md) open question 2.

> ✅ **Corroborated again by the litepaper introduction (fetched & verified live 2026-05-22).** The
> [introduction](https://docs.somnia.network/concepts/introduction.md) page is a **second** on-docs location (after the
> developer FAQ) for the headline figures — Somnia is "capable of processing over 1,000,000 transactions per second (TPS)
> with sub-second finality" — and names the same four innovations (*Accelerated Sequential Execution, IceDB, MultiStream
> consensus, Advanced compression techniques*). It adds something the FAQ and the overview do not: a **realised
> benchmark, on-docs rather than external** — Somnia "achieved 1.05m TPS (ERC-20 swaps)" "running over 100 nodes
> distributed globally," alongside "50k uniswaps per second (across one pool)" and "300k NFT mints per seconds (one NFT
> contract)." The **"100 nodes"** is the same scale as the
> [security](https://docs.somnia.network/concepts/somnia-blockchain/security.md) page's "100 globally distributed
> validator nodes" launch set (see [*The trust model*](#the-trust-model--why-an-audit-anchor-is-safe-here-not-just-fast))
> — so the headline TPS was measured on a validator set the size of the one Curie would anchor against, not an outsized
> lab cluster. This **reclassifies** the realised peak benchmark from *external* to *on-docs* in open question 1 below.
> Two provenance facts also recorded: Somnia "is supported by Improbable and MSquared," and "The Somnia token SOMI is
> issued by the Somnia Token Co Ltd"; the page is "accurate to the best of Somnia Foundation's knowledge as of August 22,
> 2025." It again names **no AI or agents** — its use cases are "games, social applications, metaverses" (a fourth
> corroboration of that negative finding, after [use-cases](https://docs.somnia.network/concepts/somnia-blockchain/use-cases.md),
> the [problem](https://docs.somnia.network/concepts/litepaper/problem.md) page, and the
> [somnia-mission](https://docs.somnia.network/concepts/litepaper/somnia-mission.md) page triaged the same run).

### Why these four — the problem statement

Read the four innovations as *answers*, and the litepaper
[problem](https://docs.somnia.network/concepts/litepaper/problem.md) page (fetched & verified live 2026-05-22) is the
*question*. Upstream's framing: "Today, there are limits to what you can build on-chain. Many factors constrain this,
from the cost of running applications to the fundamental performance limitations of existing blockchains" — the goal
being that "enabling these systems to be built on-chain will allow the free movement of businesses and users between
online platforms, creating what we call a **true virtual society**." (The page's headline use cases are gaming,
metaverse, and social — it names no AI or agents, the same *negative* finding recorded for the
[use-cases](https://docs.somnia.network/concepts/somnia-blockchain/use-cases.md) page below.)

What makes this page useful here is that it names **three** specific bottlenecks, and they map almost 1:1 onto the four
innovations above — so the feature list stops looking arbitrary:

| Upstream bottleneck (quoted [problem](https://docs.somnia.network/concepts/litepaper/problem.md)) | The innovation that answers it |
|---|---|
| **Execution speed** — "the rate at which smart contract code can be executed, and block creation can occur" | Accelerated Sequential Execution (compiled bytecode) |
| **Storage** — "retrieval of storing historical data of a chain… we still need improvements in reading and writing data to blockchains" | IceDB (deterministic read/write) |
| **Bandwidth** — "the amount of bandwidth needed to send data between nodes on the network when running at high transaction levels" | MultiStream data chains + advanced compression |

The page motivates the bandwidth point with a comparison of existing chains' realised throughput (it measures EVM
chains in **DEX-swaps-per-second**, where leading EVM chains sit far below the headline TPS, against non-EVM chains'
higher claimed TPS); the exact comparison table is on the upstream page and is not restated here to avoid transcribing
figures from a summarised fetch. The takeaway that *does* transfer: Somnia's pitch is that real-time on-chain apps were
blocked on these three axes at once, which is why it ships four coupled changes rather than tuning one.

For Curie this is the *"why not just use Ethereum?"* answer in one sentence: a multi-step agent negotiation that anchors
each turn on-chain stresses exactly **execution latency** (each step waits on a confirmation) and **storage cost** (many
small writes) — the first two bottlenecks above — so the chain whose explicit design goal is removing them is the one
where the [demo loop](../../../ROADMAP.md) can run in-loop rather than as an afterthought.

### MultiStream Consensus — separate "writing data" from "agreeing on order"

On most chains a single proposer builds each block, and that block both *carries the data* and *is the unit of
consensus*. Somnia (inspired by the 2024 Autobahn whitepaper) splits those two jobs
([MultiStream](https://docs.somnia.network/concepts/somnia-blockchain/multistream-consensus.md)):

- **Each validator runs its own "data chain"** and is the only one who appends to it. Upstream is blunt that these are
  *unvalidated* on their own: "Only the owning validator ever adds blocks to their data chain, and there are no safety
  mechanisms in place to avoid them forking their data chain or proposing invalid blocks."
- **A separate consensus chain** (modified PBFT) tracks the **tip of every data chain** and "provides full security
  against validators forking their own data chain."
- Ordering is then derived: "A deterministic pseudorandom ordering of these data chains then provides a single globally
  ordered stream of bytes to be executed."

The payoff is bandwidth: because data production isn't bottlenecked on consensus, the network can "reach almost a
gigabit per second of published transaction data" ([MultiStream](https://docs.somnia.network/concepts/somnia-blockchain/multistream-consensus.md)).

### Accelerated Sequential Execution — make one core extremely fast

A counter-intuitive choice: instead of executing transactions in parallel across cores, Somnia bets on **one very fast
sequential core**. The upstream rationale is that "parallel execution breaks down exactly when you need it" — during
load spikes transactions become correlated and all touch the same state (it cites the Otherside Otherdeed mint, where "the
vast majority of all transactions in each block were all modifying the same state")
([ASE](https://docs.somnia.network/concepts/somnia-blockchain/accelerated-sequential-execution.md)).

The speed comes from **compilation, not interpretation**: Somnia "includes its own EVM compiler, which translates EVM
bytecode to x86," an approach that "approaches near-native speed" and "can execute ERC-20 transfers in hundreds of
nanoseconds, achieving millions of TPS on a single core." Compilation isn't free, so you "would only do this on contracts
that are called frequently, falling back to standard interpreted EVM on the rest." It also lets the CPU's own
out-of-order execution kick in — upstream shows an ERC-20 swap running at **250ns vs. 500ns** when independent memory
ops run simultaneously ([ASE](https://docs.somnia.network/concepts/somnia-blockchain/accelerated-sequential-execution.md)).

> ✅ **Resolved 2026-05-21 (ordering attribution).** The upstream ASE page does **not** describe how transactions are
> ordered — it only describes how they *execute*. Global ordering comes from MultiStream's "deterministic pseudorandom
> ordering… single globally ordered stream of bytes to be executed," not from ASE. The
> [`GLOSSARY.md`](../GLOSSARY.md#a) *Accelerated Sequential Execution* entry now states this explicitly ("the global
> transaction *ordering* it executes comes from MultiStream Consensus, not from ASE"), and the
> [MultiStream Consensus](../GLOSSARY.md#m) entry is marked as the source of ordering. No open action remains.

### IceDB — deterministic storage so gas can be honest

Standard embedded DBs (LevelDB/RocksDB) optimise for write throughput and scatter reads across RAM and disk, so the
same `SLOAD` can be far slower depending on where the data sits. That forces a bad gas choice: charging worst-case gas
"drastically limits the speed of your blockchain," while charging average-case gas "allows an attacker to critically
slow down your chain"
([IceDB](https://docs.somnia.network/concepts/somnia-blockchain/somnias-icedb.md)).

IceDB is "built from the ground up to have fully deterministic performance." Every operation emits a **performance
report** counting exactly how many cold cache lines and disk pages were touched, so the chain can "charge the user based
on the actual load they put on the system" — averaging **15-100 ns** per read/write, with native snapshotting from the
underlying LSM tree's immutable structure (no expensive Merkle recompute)
([IceDB](https://docs.somnia.network/concepts/somnia-blockchain/somnias-icedb.md)).

### Advanced compression — push past the bandwidth ceiling

The fourth innovation is the one that turns MultiStream's "almost a gigabit per second" of raw data into still-higher
*effective* throughput. The overview frames it in one sentence — "The Somnia data chain architecture is designed to
enable streaming compression in order to maximise data throughput. Somnia combines this with BLS signature aggregation
in order to achieve extremely high compression ratios, allowing for massive transaction data throughput"
([overview](https://docs.somnia.network/concepts/somnia-blockchain/overview.md)) — but the dedicated litepaper page
([advanced compression techniques](https://docs.somnia.network/concepts/somnia-blockchain/advanced-compression-techniques.md))
explains *why* the data-chain design is what makes it work, and that linkage matters for understanding the architecture
as a whole.

Two distinct moves:

- **Streaming compression** shrinks the transaction *payloads* validators ship to one another. The reason it beats
  ordinary per-block compression is the **shared-history assumption**: streaming compression "is able to assume that the
  sender and receiver both share an identical history of the data that was compressed and decompressed," so "it achieves
  much better compression ratios than block compression. The downside, though, is that the sender and receiver must
  share an identical stream of data" (same page). That downside is exactly what MultiStream's design satisfies for free:
  "Each validator is responsible for publishing their own stream of data to their own blockchain. These are the data
  chains… The fact that data chains use the same process for publishing this stream unlocks the ability for streaming
  compression" (same page). In other words, the append-only data chains from
  [*MultiStream Consensus*](#multistream-consensus--separate-writing-data-from-agreeing-on-order) above are the *precondition*
  for streaming compression, not an unrelated optimisation — the two innovations are coupled.
- **BLS signature aggregation** collapses the *signatures* — instead of one signature per transaction crossing the
  network, "BLS signatures can aggregate any number of BLS signatures into a single signature, effectively achieving a
  **constant size for any number of transaction signatures**" (same page). It is framed as "an optional mechanism to
  submit batches of transactions, where the cost to verify the signatures… is similar to the cost of verifying just one
  transaction." On a high-TPS chain the signatures are a meaningful fraction of the bytes, so collapsing them to constant
  size is a real saving, not a rounding error.

Together these let Somnia claim "theoretical performance above other [purported] limits due to bandwidth" — i.e. the
bottleneck stops being how many *bytes* you can move and goes back to compute
([overview](https://docs.somnia.network/concepts/somnia-blockchain/overview.md)). See
[`GLOSSARY.md`](../GLOSSARY.md#a) → *Advanced compression*.

> **⚠️ On the "compression ratio" figure — read precisely.** An earlier draft of this article said *no* numeric ratio is
> published. That is true of a *blanket, end-to-end* chain compression ratio — the overview's "extremely high" is the
> only global wording, and it stays qualitative. But the dedicated page **does** publish one **worked illustrative
> example** for a *single component* (compressing a frequently-called contract address): "if a particular contract was
> being called by 10% of transactions, its address can be encoded in **3.3 bits**. That is a **48x compression ratio**"
> ([advanced compression](https://docs.somnia.network/concepts/somnia-blockchain/advanced-compression-techniques.md)).
> This is an entropy-coding consequence of a power-law call distribution (a 20-byte/160-bit address that recurs in 10% of
> transactions carries ~3.3 bits of information), **not** a measured ratio for whole transactions or the chain overall.
> Cite it only as what it is: an illustrative address-encoding example. Do **not** restate "48x" as Somnia's compression
> ratio. The same page sizes the target throughput it is designed to clear — "a standard ERC-20 transfer is about 200
> bytes… 1 million ERC-20 swaps per second. That's 190 MBytes/s or 1.5 GBits/s" — consistent with MultiStream's
> "almost a gigabit per second," with per-peer upload load shared across `N` validators (same page).

### The trust model — why an audit anchor is safe here, not just fast

The four innovations above answer *"why fast enough?"* For Curie there is a second, arguably more central question:
*why is an on-chain audit verdict **trustworthy** enough that an adversarial payer and provider will both rely on it?*
Upstream answers that on a dedicated [security](https://docs.somnia.network/concepts/somnia-blockchain/security.md)
litepaper page (fetched & verified live 2026-05-22):

- **A deliberately bounded decentralisation.** Somnia "philosophically believes in having **sufficiently decentralised
  services, not maximally decentralised**," trading some censorship-resistance for performance. The network "will launch
  with **100 globally distributed validator nodes**," growing as it matures, on hardware "between a Solana and Aptos
  node" ([security](https://docs.somnia.network/concepts/somnia-blockchain/security.md)). This is the honest framing to
  give a counterparty: the audit substrate is a 100-validator PoS L1, not Ethereum-scale decentralisation.
- **Proof-of-Stake with slashing.** It is a proof-of-stake network where "**Node providers are subject to slashing if
  they act maliciously against the network**" (same page) — validators are economically bonded against misbehaviour,
  with the parameters deferred to the [tokenomics docs](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md)
  (see [`tokenomics-and-gas.md`](tokenomics-and-gas.md)).
- **Cuthbert — a second implementation that catches execution bugs.** This is the page's strongest fact for an audit
  use case. Somnia runs a **separate, unoptimised execution-and-database implementation called Cuthbert** (built on
  third-party libraries); validators run **every transaction through both** Somnia and Cuthbert and "will **stop voting
  or executing if they ever detect a divergence between the two**" (same page). The effect: a bug would have to exist in
  *both* independent codebases to escape detection. Cuthbert is phased out as the chain matures.
- **Third-party audits — asserted, but not verifiable from the docs.** A separate
  [audits](https://docs.somnia.network/concepts/miscellaneous/audits.md) page lists a "Smart Contract Report" and an
  "L1 Audit Report," which would be the external-review leg of the trust story. **But neither is readable from
  `docs.somnia.network`:** both are GitBook `{% file %}` embeds whose `/files/<id>` paths
  (`/files/J9ysRVCk8BfJ8CvBlUbb`, `/files/bGC0VGg2sX0h8XwPNJm9`) **return a 404 on the docs domain** (re-checked live
  2026-05-22) — the binaries live on a separate GitBook CDN host the `.md` rendering does not expose, and the page names
  **no audit firm, date, or scope**. So for a counterparty pitch, state the protocol-level guarantees above as the
  sourced trust story and treat "the L1 is independently audited" as **claimed by Somnia but unconfirmed from the public
  docs** — a fair item to ask Somnia to substantiate before relying on it, not a fact to assert. See *Source caveat*.

How this sits next to the consensus section above: MultiStream's consensus chain already "provides full security against
validators forking their own data chain" — that is the *ordering*-integrity guarantee. The security page adds the
*execution*-integrity (Cuthbert) and *economic* (PoS slashing) guarantees on top. Together they are why a settlement
state, once anchored, is hard to forge or silently corrupt. See [`GLOSSARY.md`](../GLOSSARY.md#c) → *Cuthbert*.

## For the AI engineer: why this matters for an agent loop

Think of the chain as the **shared message bus and ledger** between your provider and payer agents. Two properties of
that bus matter to you, and both come straight from the architecture above:

1. **Latency per step is low and *predictable*.** Your loop is sequential — provider proposes, payer responds, contract
   records, settlement fires — so each step waits on the previous one's confirmation. IceDB's deterministic performance
   and compiled execution mean a state-writing call resolves in a tight, knowable time rather than spiking under load.
   This is the difference between a demo that feels live and one that stalls on a confirmation spinner.
2. **Gas is metered on *actual* work, not worst case** ([IceDB](https://docs.somnia.network/concepts/somnia-blockchain/somnias-icedb.md)).
   For a cost model over many small anchoring writes (one per negotiation turn), that makes per-claim cost estimable —
   see [`tokenomics & gas`](tokenomics-and-gas.md) and the [gas glossary entry](../GLOSSARY.md#g).

The mental model shift from a normal LLM backend: here the "database write" between agent turns is a **consensus-ordered
on-chain event**, not a row in Postgres. MultiStream is what keeps that write cheap enough in latency to put *in the
loop* rather than as an afterthought.

## How Curie V1 uses it

V1 doesn't *call* consensus or IceDB — it **depends on them being fast** so the
[demo loop](../../../ROADMAP.md) (steps 1–7: provider ingests note → anchors hash → payer approves/downcodes/requests
support → provider cites evidence → contract records state → settlement fires) reads as real-time agent coordination.

- **It satisfies a judging requirement directly.** The Agentathon brief (quoted in the [ROADMAP](../../../ROADMAP.md))
  says strong projects "use Somnia performance as a real ingredient rather than just a deployment target," in a
  "90-second demo loop." This article is the sourced answer to *which* performance properties we lean on: low,
  predictable per-step latency (MultiStream + ASE + IceDB) is what lets a multi-turn negotiation fit inside 90 seconds
  on-chain.
- **It bounds the cost model.** IceDB's deterministic gas is the reason a per-claim anchoring budget is even estimable.
- **It underwrites the audit-trail trust story.** Curie's wedge is a *neutral, tamper-evident* substrate between
  adversarial payer and provider agents — so *why the chain is trustworthy* matters as much as why it's fast. The
  [security](https://docs.somnia.network/concepts/somnia-blockchain/security.md) page is the sourced answer: a
  100-validator PoS chain with **slashing** for malicious validators and the **Cuthbert** dual-implementation
  divergence-halt, which means a single execution bug cannot silently produce a wrong settlement/adjudication state. The
  honest disclosure to a counterparty is also sourced: this is *sufficiently* (not *maximally*) decentralised — a
  100-validator network, not Ethereum-scale.
- **PHI boundary unaffected.** Nothing here changes the rule: only hashes, state, agent addresses, and settlement
  amounts go on-chain — fast storage doesn't make it safe to store more. The negotiation's clinical content stays
  off-chain regardless of how quick IceDB is.

## Open questions (for the research loop)

1. ~~**Concrete finality/latency numbers.**~~ ✅ *Resolved 2026-05-21.* This article still restates *no* TPS or finality
   figures by design; the sourced analysis lives in
   [`../../research/somnia/finality-tps-and-gas-model.md`](../../research/somnia/finality-tps-and-gas-model.md), which now
   carries a dated re-verification note. Two findings: **(a)** the docs
   [architecture overview page](https://docs.somnia.network/concepts/somnia-blockchain/overview.md) publishes **no**
   concrete block-time / TTF / TPS number — only the qualitative "millions of transactions per second on a single core."
   **Refined 2026-05-21:** the **developer FAQ** *is* an on-docs `docs.somnia.network` page (not external like Chainspect /
   Messari), and it publishes the headline figures verbatim — "1,000,000+ transactions per second" and "Sub-second
   transaction finality" — so those two headline claims are upstream-sourced after all. **Refined again 2026-05-22:** the
   litepaper [introduction](https://docs.somnia.network/concepts/introduction.md) page publishes a **realised peak
   benchmark on-docs** — "1.05m TPS (ERC-20 swaps)" "running over 100 nodes distributed globally," plus "50k uniswaps per
   second (across one pool)" and "300k NFT mints per seconds (one NFT contract)" — so the *peak* benchmark detail is
   on-docs after all, no longer external-only. What remains **external** (Chainspect / Messari) is the still-finer detail
   the introduction does **not** give: a numeric time-to-finality in milliseconds and a *sustained* (not peak) TPS figure,
   which no `docs.somnia.network` page quantifies. And the FAQ's own "Block Time: Optimized for
   real-time applications" line confirms **no upstream page publishes a block-time number at all** — the definitive
   answer to that recurring gap (also flagged in [`oracles-and-vrf.md`](oracles-and-vrf.md) open question 2);
   **(b)** the research file's **on-docs gas figures** (warm SLOAD `100` gas, cold SLOAD `+1,000,000`,
   SSTORE charged `200,000`, `LOG0` `8,320` vs Ethereum `631`, `ecRecover` 50×, `ecPairing` 250×) were re-checked live
   against the [gas-differences page](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md)
   and still match verbatim.
2. ~~**Deterministic-ordering attribution.**~~ ✅ Resolved 2026-05-21 — the glossary now attributes global ordering to
   [MultiStream Consensus](../GLOSSARY.md#m), not ASE (see resolved note above).
3. **Single-core ceiling under our load.** Our loop is low-volume (a few writes per claim), so ASE's single-core design
   is comfortably sufficient — but worth confirming if we ever batch many claims concurrently in a demo.

## Source caveat

Architecture claims and figures above are quoted from the cited upstream litepaper pages (fetched 2026-05-20; every
quote re-verified against the live pages 2026-05-21), plus the developer-facing
[FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md) (a
`docs.somnia.network` page, fetched 2026-05-21, re-verified live 2026-05-22 and again 2026-05-23) for the headline TPS/finality figures and the
four-innovations naming. The re-verification corrected three quotes that did not match
upstream wording: the parallelism quote is "parallel execution breaks down exactly when you need it" (not "fails
precisely when needed most"); the compiler quote is "includes its own EVM compiler, which translates EVM bytecode to
x86" / "approaches near-native speed" (the prior "directly to x86 native code for frequently-called contracts" was a
paraphrase); and the IceDB gas dilemma is now quoted verbatim ("drastically limits the speed of your blockchain" /
"allows an attacker to critically slow down your chain"). An unsourced "~1000×" `SLOAD` figure was also removed. These
are *concept* docs, not an API surface — they describe internals that may be simplified or change. Treat upstream as
authoritative, and never derive a contract design from a performance claim here without re-checking the live page.

> **Deepened 2026-05-22 (Advanced Compression).** The fourth innovation previously drew **only** on the parent
> [overview](https://docs.somnia.network/concepts/somnia-blockchain/overview.md) one-sentence summary, while the other
> three each had their dedicated litepaper page woven in — a citation-parity gap. The dedicated
> [advanced compression techniques](https://docs.somnia.network/concepts/somnia-blockchain/advanced-compression-techniques.md)
> page was fetched, confirmed to have real content (not a GitBook soft-404), and woven into the *Advanced compression*
> section. Facts captured verbatim: the **shared-history** reason streaming compression beats block compression ("sender
> and receiver both share an identical history… much better compression ratios than block compression"; downside: "must
> share an identical stream of data") and the explicit linkage that MultiStream's per-validator **data chains** are what
> "unlocks the ability for streaming compression" — so innovations #1 and #4 are *coupled*, not independent; BLS
> aggregation reaching "a constant size for any number of transaction signatures"; and the throughput target ("~200 bytes"
> per ERC-20 transfer → "1 million ERC-20 swaps per second… 190 MBytes/s or 1.5 GBits/s"). **One correction to a prior
> claim:** the article (and glossary) said *no* numeric compression ratio is published — true for a blanket end-to-end
> ratio, but the dedicated page **does** publish a worked **illustrative** example for one component (a contract called by
> 10% of transactions → address encoded in 3.3 bits = a "48x compression ratio"). It is reframed precisely as an
> address-encoding entropy example, **not** a global ratio; "48x" must not be restated as Somnia's compression ratio.
> No new glossary term; the *Advanced compression* glossary entry was updated to match. PHI boundary unaffected — this is
> a background article. No new flags.

> **Deepened 2026-05-22 (security / trust model).** This article previously covered only the four **performance**
> innovations and had no **trust/security** layer — a gap, since its V1 purpose is establishing why the chain is
> *trustworthy enough to anchor an audit trail*, not merely fast. The previously-uncited
> [security](https://docs.somnia.network/concepts/somnia-blockchain/security.md) litepaper page was fetched, confirmed to
> have real content (sharpened-audit-rule check — not a GitBook soft-404; it carries the validator count, the Cuthbert
> description, and the slashing sentence), and woven in as a new *The trust model* section plus a V1 bullet. Facts
> captured verbatim: the "**sufficiently decentralised services, not maximally decentralised**" philosophy, "**100
> globally distributed validator nodes**" at launch on hardware "between a Solana and Aptos node," PoS where "**Node
> providers are subject to slashing if they act maliciously against the network**," and the **Cuthbert** dual-implementation
> divergence-halt ("stop voting or executing if they ever detect a divergence between the two"). One new glossary term:
> *Cuthbert*. ⚠️ Two adjacent pages triaged the same run and **not** woven: the litepaper
> [use-cases](https://docs.somnia.network/concepts/somnia-blockchain/use-cases.md) page is real content but names only
> **Gaming / SocialFi / Metaverse / DeFi / Real-Time Applications** — it does **not** name AI, agents, or healthcare
> (a recordable *negative* finding: Somnia does not officially position itself as an agentic/AI L1, though it allows
> "places we have not imagined"); and [miscellaneous/audits](https://docs.somnia.network/concepts/miscellaneous/audits.md)
> is a **stub** — it references a "Smart Contract Report" and an "L1 Audit Report" but names **no audit firm, date, or
> resolvable report URL** (internal GitBook file IDs only), so the existence of third-party L1 audits is *asserted but
> unverifiable from the docs* — flagged for human review. PHI boundary unaffected; the page names no chain ID, no RPC URL.
>
> **Flag advanced 2026-05-22 (audit reports — confirmed unverifiable, with evidence).** Followed the two `{% file %}`
> embeds to resolve the human-review flag above. The embeds carry GitBook file IDs `J9ysRVCk8BfJ8CvBlUbb` (Smart Contract
> Report) and `bGC0VGg2sX0h8XwPNJm9` (L1 Audit Report); fetching the L1 report at
> `https://docs.somnia.network/files/bGC0VGg2sX0h8XwPNJm9` **returns GitBook's 404 page** (re-checked live 2026-05-22).
> The assets are served from a separate GitBook CDN host that the `.md` rendering does not expose, so from
> `docs.somnia.network` alone the firm, date, scope, and findings are all **unobtainable**. This upgrades the flag from
> "internal file IDs only" to *confirmed: the report embeds 404 on the docs domain; the existence of a third-party L1
> audit is claimed by Somnia but not independently verifiable from the public docs* — woven into *The trust model* body
> above as a fourth bullet. A `.md`-only capture pipeline structurally cannot resolve `{% file %}` targets, so this
> cannot be closed further from upstream; ask Somnia directly if the audit firm/report becomes a due-diligence
> requirement. No new glossary term; no chain-ID conflict; PHI boundary unaffected.

> **Deepened 2026-05-22 (problem statement).** The article led with the four-innovations table (the *solutions*) and the
> trust model, but had **no statement of the problem those innovations answer** — so the feature list read as
> unmotivated. The previously-uncited litepaper [problem](https://docs.somnia.network/concepts/litepaper/problem.md) page
> was fetched, confirmed real content (sharpened-audit-rule check — it carries the three named bottlenecks, the "true
> virtual society" line, and a chain-throughput comparison table, not a GitBook soft-404), and woven in as a new *Why
> these four — the problem statement* subsection between the table and the per-innovation deep dives. Facts captured
> verbatim: the "limits to what you can build on-chain… fundamental performance limitations of existing blockchains"
> framing, the "true virtual society" goal, and the **three named bottlenecks** — **Execution speed** ("the rate at
> which smart contract code can be executed, and block creation can occur"), **Storage** ("we still need improvements in
> reading and writing data to blockchains"), **Bandwidth** ("the amount of bandwidth needed to send data between nodes…
> when running at high transaction levels") — which map almost 1:1 onto ASE / IceDB / MultiStream-plus-compression,
> turning the existing solution list into a closed argument. Tied to V1: this is the sourced *"why not just Ethereum?"*
> answer (an agent loop anchoring each turn stresses execution latency + storage cost, the first two bottlenecks). **No
> figures transcribed:** the page's per-chain DEX-swaps-per-second / TPS comparison table is left on the upstream page
> rather than restated, since exact figures came via a summarised fetch — the structural taxonomy, not the decimals, is
> what the article needs. ⚠️ Recorded **negative** finding (corroborating the use-cases page): the problem page's
> headline use cases are **gaming / metaverse / social** — it names **no AI or agents**. No new glossary term (the
> bottleneck names are descriptive, not vendor/concept terms the glossary keys on). PHI boundary unaffected — background
> article. No new flags; the page names no chain ID and no RPC URL.

> **Deepened 2026-05-22 (litepaper introduction — realised benchmark reclassified to on-docs).** The previously-uncited
> litepaper [introduction](https://docs.somnia.network/concepts/introduction.md) page was fetched, confirmed real content
> (sharpened-audit-rule check — it carries the headline figures, the four-innovations naming, a realised benchmark, and a
> dated provenance line, not a GitBook soft-404), re-fetched a second time for **verbatim** figures, and woven into the
> dev-section corroboration callout. **The substantive find is a reclassification, not new prose:** the article's open
> question 1 said the *finer-grained* benchmark detail was **external-only** (Chainspect / Messari); the introduction page
> publishes a **realised peak benchmark on-docs** — "achieved 1.05m TPS (ERC-20 swaps)" "running over 100 nodes
> distributed globally," "50k uniswaps per second (across one pool)," "300k NFT mints per seconds (one NFT contract)" — so
> the *peak* benchmark is now upstream-sourced; only a millisecond TTF and a *sustained* (vs peak) TPS remain external.
> Cross-page coherence captured: the benchmark's **"100 nodes"** equals the [security](https://docs.somnia.network/concepts/somnia-blockchain/security.md)
> page's "100 globally distributed validator nodes" launch set. Two provenance facts recorded (Somnia "is supported by
> Improbable and MSquared"; "The Somnia token SOMI is issued by the Somnia Token Co Ltd"; dated "as of August 22, 2025").
> ⚠️ **Two adjacent litepaper framing pages triaged the same run and *not* woven** (recorded so the loop stops
> re-triaging them, mirroring the on-ramps precedent): [somnia-mission](https://docs.somnia.network/concepts/litepaper/somnia-mission.md)
> ("enable mass consumer real-time applications… at web2 scale with web3 properties," five objectives, five principles —
> **no** chain ID, RPC, throughput figure, AI, or agents) and [conclusion](https://docs.somnia.network/concepts/conclusion.md)
> (a "world computer" vision page — "Ethereum started this movement and has provided the backbone for finance"; **no**
> concrete technical fact, AI, or agents). Both are pure vision/philosophy with **no V1-relevant new primitive**, so
> spending a sub-article on either is not warranted — but each is a **third and fourth** corroboration of the recurring
> negative finding: **no `docs.somnia.network` litepaper framing page positions Somnia as an AI/agent L1.** No new
> glossary term (the benchmark is a fact, not a concept term). PHI boundary unaffected — background article. No new flags;
> the introduction names no chain ID and no RPC URL.

> **Re-verified 2026-05-23 (MultiStream Consensus + Accelerated Sequential Execution — the two stalest core pages).** Every
> other surface of this article had been swept in the 2026-05-22 cluster passes (IceDB, Advanced Compression, security/
> Cuthbert, problem, introduction), but the two **dedicated** litepaper pages for the consensus and execution innovations
> — [MultiStream Consensus](https://docs.somnia.network/concepts/somnia-blockchain/multistream-consensus.md) and
> [Accelerated Sequential Execution](https://docs.somnia.network/concepts/somnia-blockchain/accelerated-sequential-execution.md)
> — were last re-checked **2026-05-21**, the stalest high-consequence surface left in the folder. Both were re-fetched
> live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real content**. **Every quote
> matches upstream verbatim — un-drifted:** MultiStream's data-chain-forking sentence ("Only the owning validator ever adds
> blocks to their data chain, and there are no safety mechanisms in place to avoid them forking their data chain or
> proposing invalid blocks"), the "provides full security against validators forking their own data chain" fragment, the
> "almost a gigabit per second of published transaction data" figure, and the Autobahn-2024-whitepaper attribution; and
> ASE's "parallel execution breaks down exactly when you need it," the Otherside Otherdeed-mint quote, the EVM-compiler/x86
> + "near-native speed" pair, the "ERC-20 transfers in hundreds of nanoseconds, achieving millions of TPS on a single core"
> benchmark, and the 250ns-vs-500ns out-of-order example. **One precision fix:** the compilation-strategy quote was
> integrated as `so you "only do this on contracts that are called frequently…"`, where the article's lead-in "you"
> silently absorbed upstream's **"would"** — upstream reads *"you would only do this on contracts that are called
> frequently, falling back to standard interpreted EVM on the rest."* The opening quote mark was moved to restore "would"
> (`so you "would only do this on contracts…"`), the same boundary-faithfulness class as the prior runs' 32-SOMI and
> events-quote tightenings — not V1-load-bearing, but a quote inside quote marks should be exactly verbatim. No new
> glossary term; no new flags; neither page names a chain ID or RPC URL; PHI boundary unaffected (background article).
> With this, **all four core-innovation litepaper pages plus the problem/introduction/security framing pages are
> re-verified on the 2026-05-22/23 passes.**

> **Re-verified 2026-05-23 (architecture overview — the last core consensus surface still on a 2026-05-21 check).** The
> 2026-05-22/23 sweeps re-verified the four *dedicated* innovation pages (MultiStream, ASE, IceDB, Advanced Compression)
> plus the problem/introduction/security framing pages, but the **parent** [architecture overview](https://docs.somnia.network/concepts/somnia-blockchain/overview.md)
> page — listed first in the upstream-sources header and the source of the **four-innovations table** at the top of this
> article — slipped through every sweep, because each sweep targeted a *sibling* page rather than the overview itself. An
> audit of this article's re-verification record (the recent runs' *"added/quoted on X" ≠ "re-verified live on Y"*
> discipline) surfaced it as the **last** core consensus surface still on the 2026-05-21 capture. It was re-fetched live
> under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **renders real content; all four table
> quotes match upstream verbatim — un-drifted:** MultiStream *"This structure decouples data production from the consensus
> process, significantly enhancing overall efficiency,"* ASE *"Somnia achieves execution speeds close to hand-written C++
> contracts, facilitating the execution of millions of transactions per second on a single core,"* IceDB's *"15-100
> nanoseconds with built in snapshotting,"* and Advanced Compression's *"extremely high compression ratios."* The table's
> ASE entry uses a faithful ellipsis elision (drops only upstream's connective *"facilitating the execution of"*; the
> quoted fragments are word-for-word), so **no quote needed tightening** — a clean re-verification, like the recent Data
> Streams worked-example case-study pass. No new glossary term; no new flags; the page names no chain ID or RPC URL; PHI
> boundary unaffected (background article). With this, **every page cited by this article — the four dedicated innovation
> pages, the parent overview, and the problem/introduction/security/developer-FAQ framing pages — is re-verified on the
> 2026-05-22/23 passes** (the developer FAQ on 2026-05-22 per the [README](../README.md) provenance log; the header's
> 2026-05-21 FAQ stamp predates that and is the one date-label still to be reconciled, a labelling lag, not a stale
> citation — *done the next run, see below*). The residual research gaps (millisecond TTF, sustained TPS, block time, the
> nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.

> **Reconciled & re-verified 2026-05-23 (developer-FAQ date-label — the article's last labelling lag).** The lag flagged
> just above — the header and the dev-section corroboration callout both stamped the
> [developer FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md)
> *2026-05-21*, though it was actually re-verified live 2026-05-22 (per the [README](../README.md) provenance log) — was
> discharged this run. Rather than copy the 2026-05-22 date from the log, the FAQ was **re-fetched live** under the
> **sharpened soft-404 rule** (real body, not just HTTP `200`), which both closes the lag *and* advances the verification
> to today: it **renders real content and every quoted value is un-drifted** — *"TPS Capacity: 1,000,000+ transactions
> per second,"* *"Finality Time: Sub-second transaction finality,"* the four innovations named identically
> (*Accelerated Sequential Execution, IceDB, MultiStream Consensus, Advanced Compression*), the *"15-100 nanosecond
> read/write"* IceDB figure, and the three EVM-compatibility lines (*"All Solidity features work identically,"* *"Same gas
> mechanics and opcodes,"* *"Compatible with OpenZeppelin libraries"*). Two standing facts re-confirmed: the **"Block
> Time: Optimized for real-time applications"** entry still carries **no number** (re-confirming the block-time research
> gap — see open question 1), and the page links out only to `chainlist.org`, **no** benchmark source (Chainspect /
> Messari), so there is no permitted off-domain path to a finality-in-ms figure from here. The header, the dev-section
> callout, and the source-caveat FAQ stamp were all updated to *"fetched 2026-05-21, re-verified live 2026-05-22 and
> 2026-05-23."* Also re-confirmed: the FAQ's developer contact is `developers@somnia.network`, consistent with the
> `.network`-vs-`.foundation` reconciliation recorded in [`smart-contract-dev.md`](smart-contract-dev.md). With this, the
> consensus article's last labelling lag is closed — every cited page now carries a 2026-05-22 or 2026-05-23
> re-verification date in both the header and the caveat. No new glossary term; no new flags; the page names no chain ID
> or RPC URL; PHI boundary unaffected (background article).
