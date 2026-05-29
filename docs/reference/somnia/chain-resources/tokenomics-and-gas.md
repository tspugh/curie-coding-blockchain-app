# Chain resource: Somnia tokenomics & gas

> **One line:** **SOMI** is Somnia's native gas/value token (a fixed-supply dPoS coin); it works like ETH, but
> Somnia has **re-priced the EVM gas schedule** — so an Ethereum gas estimate is not a Somnia gas estimate.
>
> Upstream: [tokenomics overview](https://docs.somnia.network/concepts/tokenomics/overview.md) ·
> [tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md) ·
> [staking & delegation](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md) ·
> [tokens governance](https://docs.somnia.network/concepts/tokenomics/tokens-governance.md) ·
> [SOMI coin](https://docs.somnia.network/developer/network-info/somi-coin.md) ·
> [gas differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md) ·
> [JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md).
> Fetched 2026-05-20; gas/SOMI pages re-verified live 2026-05-21 — every gas constant in the table below confirmed
> verbatim against the gas-differences page, the SOMI quote + denomination ladder against the SOMI coin page, the fixed
> 1B supply + dPoS + three token roles against the tokenomics overview, and the EIP-1559 transaction fields against the
> JSON-RPC API.
> **Update 2026-05-23 — opcode gas table re-verified + sharpened.** The
> [gas-differences page](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md)
> (the source of the opcode table below — last re-checked 2026-05-21, a day behind the 2026-05-22 cluster sweep, since
> that sweep re-fetched only the *separate* `tokenomics/gas-fees.md` SSTORE/pricing table) was re-fetched live under the
> sharpened soft-404 rule (real body, not just HTTP `200`). **Every opcode constant matches verbatim — un-drifted**
> (LOG, deployment `3125`/byte, `ecRecover` `150,000`, `KECCAK256`, `ADDMOD`/`MULMOD` `358`, `SELFBALANCE` `305`, storage
> read cached `100` / uncached `+1,000,000`, EIP-7702 `1,570,000`). Three precision details the prior name-only pass had
> dropped are now captured: the LOG formula's `+ memory_expansion_cost` term, the cached-read working set is the
> **128 million** most-recently-accessed slot keys, and EIP-7702 **refunds `400,000`** when no account creation is needed.
> **Update 2026-05-23 — the three remaining core tokenomics pages re-verified.** The
> [tokenomics overview](https://docs.somnia.network/concepts/tokenomics/overview.md),
> [SOMI coin](https://docs.somnia.network/developer/network-info/somi-coin.md), and
> [staking & delegation](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md) pages — the
> verbatim sources for the fixed 1B supply + dPoS + three token roles, the SOMI definition + denomination ladder, and the
> staking-reward funding line — were last re-checked **2026-05-21** and **never swept** on the 2026-05-22/23 passes (those
> re-fetched only the *separate* `tokenomics/gas-fees.md` SSTORE/pricing table and the `somnia-gas-differences` opcode
> page). Re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`): **all three render real
> content and every load-bearing quote matches upstream verbatim — un-drifted** (the `1,000,000,000`-token fixed supply;
> the gas/staking/delegation/governance role quotes; *"50% of all gas fees are distributed to validators as rewards"*; the
> `Somi`/`milliSomi`/`microSomi`/`nanoSomi`/`Wei` ladder + the `gWei`↔`nanoSomi` synonym). **One precision improvement**
> (the recent runs' paraphrase-to-verbatim discipline): the staking page's reward-source phrase, previously paraphrased
> here as `(and treasury)`, is now quoted verbatim below — *"They will be rewarded from gas fees and treasury-based
> incentives."*
> **Update 2026-05-21 — open question 2 resolved.** The dedicated
> [tokenomics gas-fees page](https://docs.somnia.network/concepts/tokenomics/gas-fees.md) and
> [staking & delegation page](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md) — **not
> consulted in the earlier passes**, which read only the overview + SOMI pages — document the monetary policy directly:
> **50% of fees are burnt** (SOMI is deflationary under load), the other 50% pays validators by stake, and staking
> rewards are funded **from fees, not new emission**. They also reveal the base fee is moved by **validator vote**
> (double/halve against a 95 ms execution target), not by the EIP-1559 demand formula (refines open question 1). The
> [native-agent gas-fees page](https://docs.somnia.network/agents/invoking-agents/gas-fees.md) was also re-fetched live
> 2026-05-21 to resolve open question 3 (per-adjudication cost = agent deposit + base gas) — figures unchanged.
>
> Map: [chain-resources](../README.md) · Glossary: [Gas](../GLOSSARY.md#g), [SOMI / STT](../GLOSSARY.md#s) ·
> Roadmap: [`../../../ROADMAP.md`](../../../ROADMAP.md)

## For the blockchain dev: SOMI is ETH-shaped, gas is not

If you've used Ethereum, the **token** model is familiar. SOMI "is the native coin of the Somnia Network… a currency
used to pay for transactions, similar to Ether (ETH)"
([SOMI coin](https://docs.somnia.network/developer/network-info/somi-coin.md)). It uses the same Wei base unit
(`1 SOMI = 1e18 Wei`) and an analogous denomination ladder:

| Denomination | Wei | Ethereum analogue |
|---|---|---|
| Somi (SOMI) | `1e18` | ether |
| milliSomi | `1e15` | finney |
| microSomi | `1e12` | szabo |
| nanoSomi | `1e9` | **gwei** |
| Wei | `1` | wei |

So you set `gasPrice`/`maxFeePerGas` in **nanoSomi** the way you'd reason in gwei
([SOMI coin](https://docs.somnia.network/developer/network-info/somi-coin.md)). On testnet the gas token is **STT**
instead (see the [network table](../README.md#the-chain-in-one-screen)).

The **transaction format is EIP-1559**, same as post-London Ethereum: the JSON-RPC API documents
`eth_maxPriorityFeePerGas` ("the current max priority fee per gas (tip) in wei"), `eth_feeHistory`, and a
`baseFeePerGas` field in the block schema, with type-`0x2` transactions carrying `maxFeePerGas` + `maxPriorityFeePerGas`
([JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md)). So send type-2 transactions and let your
client (viem/ethers) read the base fee — don't hard-code a flat `gasPrice`.

The **base-fee adjustment is *not* EIP-1559's demand formula**, though — that's the part to unlearn from Ethereum. The
base fee moves by **validator vote keyed to execution latency**: "If a block takes longer than 95ms to execute,
validators can vote to double the base fee. If execution is faster than 95ms, they can vote to halve it," and "Voting
cycles occur every second (10 blocks)" ([tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md)).
So congestion shows up as *slower execution*, not just a mempool backlog, and the fee can swing fast (×2 / ÷2 per
second). The **numeric base-fee floor in nanoSomi** is still not published — upstream gives only a fiat figure
(see open question 1) — so read it live rather than assuming an Ethereum default.

What is **not** familiar is the **gas schedule**. Somnia "drastically reduced the real-world performance cost of most
EVM operations" and, to keep the relative pricing honest, **adjusted gas costs upward for operations that haven't
gotten cheaper** — so a contract that's cheap on Ethereum can be relatively expensive here, and vice-versa
([gas differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md)).
The concrete divergences worth knowing before you estimate cost:

| Operation | Somnia gas | Ethereum gas | Note |
|---|---|---|---|
| **Logs / events** | `3200 + 5120 * topic_count + 160 * size + memory_expansion_cost` | (lower) | ≈ **8–13× higher** |
| **Contract deployment** | `3,125` / byte | `200` / byte | ≈ **15× higher** |
| **Precompiles** | 10×–250× higher | — | e.g. `ecRecover` `150,000` vs `3,000` |
| **`KECCAK256`** | `1250 + 300 * word_size` | `30 + 6 * word_size` | hashing is dearer |
| **`ADDMOD` / `MULMOD`** | `358` | `8` | — |
| **`SELFBALANCE`** | `305` | `5` | — |
| **Storage read (cached)** | `100` (base) | `100` | cached = in the **128M** most-recently-accessed slot keys |
| **Storage read (uncached)** | `+1,000,000` | (access-list based) | charged on actual latency, see IceDB |
| **EIP-7702 authorization** | `1,570,000` | `25,000` | per authorization; **`400,000` refunded** if no account creation |

(all figures: [gas differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md))

Storage pricing is the conceptually new part: instead of Ethereum's access-list model, Somnia "charges based on actual
latency" — "only the (rare) reads which actually take a long time have a high gas cost; reading from cached state is far
cheaper." Concretely, the cheap path is well-defined: a read pays only the `100`-gas static op fee **"if the storage slot
key is in the set of most recently accessed 128 million contract slot keys"**; otherwise it pays an extra `1,000,000` gas
([gas differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md),
re-verified 2026-05-23). That deterministic, load-based metering is a property of [IceDB](../GLOSSARY.md#i). **For V1
this is the dominant cost lever:** each audit anchor reads/writes claim state, so whether those slots stay inside the
128M-slot warm working set (cheap `100`) or fall out of it (`+1,000,000`, a **10,000×** swing) governs the per-claim gas
far more than any opcode in the table — a reason the negotiation loop should keep a claim's hot state compact and
recently-touched rather than sprawling across rarely-read slots.

A second storage lever — one with **no Ethereum analogue** — is that a write's gas depends on **how long you keep it**.
The gas-fees page prices a single 32-byte `SSTORE` by **retention duration** (re-fetched live 2026-05-22):

| Create `SSTORE` (32 bytes) | Gas |
|---|---|
| 1 hour | `20,000` |
| 1 day | `40,000` |
| 1 month | `60,000` |
| 1 year | `80,000` |
| Indefinite | `200,000` |

(verbatim: [tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md))

So a *permanent* slot costs **10×** a one-hour one, and `Indefinite` (`200,000` gas/slot) is the ceiling. This is a
real per-record knob — see [storage rent](../GLOSSARY.md#s) — and it bears directly on an audit anchor meant to outlive
the claim (below).

## For the AI engineer: the economic model behind the per-call cost

The supply side is simple and fixed. SOMI is a **delegated proof-of-stake (dPoS)** token with a "fixed supply of
1,000,000,000 tokens" ([tokenomics](https://docs.somnia.network/concepts/tokenomics/overview.md)). Three documented
roles for the token:

1. **Gas** — "gas fees will be paid in the SOMI token."
2. **Staking** — "to provide validator nodes… Tokens must be staked," and holders can **delegate** to Node Providers
   ("Tokens can be delegated to Node Providers to cover their staking costs").
3. **Governance** — "will eventually be used to inform how decisions regarding the Network… are made"
   ([tokenomics](https://docs.somnia.network/concepts/tokenomics/overview.md)). The dedicated
   [tokens governance](https://docs.somnia.network/concepts/tokenomics/tokens-governance.md) page (read 2026-05-22, real
   content) now fills the "how": "Proposals can be created by any token owner. They are then approved by a majority vote
   of other token holders," cast through a **token house** of SOMI holders (alongside a validator council, developer
   council, user assembly, and foundation board). Crucially, that authority is **phased in, not live in full** — the
   page names a **Bootstrap** phase (`0–6 months post-mainnet`, "Foundation board in control"), a **Transition** phase
   (`6–24 months`, "Beginning of proposal process. Ultimate control still with foundation"), and a **Mature** phase
   (`Year 2 onward`, "Control is delegated to relevant groups… Foundation does have capability for emergency overrides
   in extreme cases"). Upstream is explicit it is provisional: "The Somnia governance is still in it's early phases and
   will evolve as the project evolves."

(roles #1–#2: [tokenomics](https://docs.somnia.network/concepts/tokenomics/overview.md); role #3 detail:
[tokens governance](https://docs.somnia.network/concepts/tokenomics/tokens-governance.md))

The **monetary policy** is documented too (on a dedicated page our earlier passes missed): every fee is split **50/50 —
half burnt, half paid to validators by stake**, so the supply isn't merely fixed, it's **deflationary under load**.
Verbatim: "50% of all fees are burnt. This means the Somnia token is deflationary, as the network is used more, the
total supply will decrease," and "50% of all fees are distributed to all validators. This is distributed based on the
amount of tokens a validator has staked"
([tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md)). Staking yield is therefore funded
**from fees and treasury, not from new emission** — "50% of all gas fees are distributed to validators as rewards," and
validators "will be rewarded from gas fees and treasury-based incentives"
([staking & delegation](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md), re-verified
2026-05-23). For a
per-claim budget that means two things: there is **no inflation tax** silently diluting a SOMI reserve you hold for
settlement, and **half of every gas unit we spend is destroyed** rather than recirculated — a detail worth stating if
anyone asks where the demo's gas goes.

Why this matters if you think in LLM-call budgets, not gas: on Somnia the cost of an action is **estimable in advance**
because IceDB makes storage gas a function of measured load rather than worst-case
([gas differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md)).
That is what lets us put a defensible *per-claim* SOMI figure next to each step of the agent loop. The catch — and the
thing that bites AI workloads specifically — is that the operations our design leans on hardest (**emitting events** for
an audit trail, and **writing hashes** to storage) are exactly the ones Somnia re-priced **upward**. Verbose
event-logging is cheap intuition from Ethereum that doesn't transfer.

## How Curie V1 uses it

Our [demo loop](../../../ROADMAP.md) anchors a hash on Somnia, records negotiation state through a contract, and fires a
settlement event — PHI stays off-chain throughout. Tokenomics & gas is the **cost-model layer** under all of that:

- **Per-claim cost = mostly logs + storage.** The ROADMAP loop is event-heavy by design: each negotiation step ("who
  proposed what, who signed what, when, why") is an emitted event feeding the [audit timeline](indexing-subgraphs.md),
  and each anchor is a storage write. Both are **more expensive on Somnia than Ethereum** (logs ≈ 8–13×; uncached
  storage reads carry a `+1,000,000` gas tail). Budget the claim lifecycle against the **Somnia** schedule above, not an
  Ethereum gas calculator. And because an audit anchor is meant to **outlive the claim**, each 32-byte slot it persists
  is priced at the **`Indefinite` retention tier (`200,000` gas)** — the storage-rent table above is the right input for
  the anchor, not the 1-hour `20,000` floor.
- **Deployment is a one-off but ~15× pricier per byte.** `ClaimSettlement.sol` deploys at `3,125` gas/byte; keep the
  contract lean (the [smart-contract toolchain](smart-contract-dev.md) article covers the deploy path). On
  [Shannon testnet](../GLOSSARY.md#s) this is paid in faucet **STT**, so it costs nothing real for the demo.
- **No PHI changes hands on-chain, only value does.** The only thing SOMI/STT moves is the **settlement amount** and
  gas. Pricing that amount in fiat is the job of an [oracle](oracles-and-vrf.md) (SOMI↔USD); tokenomics just tells us
  the unit. The no-PHI-on-chain rule from the [ROADMAP](../../../ROADMAP.md) is unaffected — gas accounting touches
  hashes, state, and amounts, never clinical text.
- **Funding the agents is *out of* V1's fiat scope.** Where do the SOMI/STT an agent holds for gas + settlement come
  from? On [Shannon testnet](../GLOSSARY.md#s) the answer is the **faucet** (free STT — see the
  [network table](../README.md#the-chain-in-one-screen)), so no fiat step exists in the demo loop. Upstream's only
  documented **fiat on-ramp** is **Banxa** ("Seamlessly integrate crypto-fiat exchange, transfer, and compliance
  solutions…", [ecosystem: on-ramps](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/on-ramps.md));
  that page names no other provider, no default, and no Somnia-specific networks, addresses, fees, or limits. Upstream
  has since added a **second, dedicated** on-ramp surface — the developer-section
  [on-ramps overview](https://docs.somnia.network/developer/building-dapps/onramps.md) (names Banxa as "Somnia's trusted
  onramping service") and its
  [Banxa checkout walkthrough](https://docs.somnia.network/developer/building-dapps/onramps/buy-somi-using-banxa-checkout.md)
  (both fetched and confirmed real content 2026-05-22, not GitBook soft-404s). The walkthrough **sharpens** the
  conclusion rather than changing it: it is a **step-by-step end-user *browser* checkout** ("In the 'You Get' field,
  select SOMI as the token. Select the network as Somnia Network") that buys **mainnet SOMI** (not testnet STT), exposes
  **no headless/server-side API**, and still publishes no chain ID, amount, or fee. So a fiat on-ramp only matters on
  **mainnet**, when a *human* treasury tops up a wallet with real money — a step *outside* the V1 agent loop, where
  settlement value flows from the counterparty payer agent, not a card purchase. Recorded here so the research loop
  doesn't keep re-triaging it: **on-ramps are real but off-V1** — now corroborated by two upstream surfaces, both
  Banxa-only and both human-browser-driven.
- **Governance is off the V1 loop — but it sharpens the trust caveat.** Curie's agents never vote on SOMI proposals, so
  the [token house](../GLOSSARY.md#g)/council structure above is **out of the V1 path** (recorded so the loop stops
  re-triaging it). It does, though, refine *how trustworthy* the substrate is for an audit trail: the same honesty the
  [trust model](consensus-and-execution.md) shows ("sufficiently decentralised… not maximally") shows up here as a **phased**
  governance rollout — through the Transition phase (`6–24 months` post-mainnet) the **foundation board retains ultimate
  control** ([tokens governance](https://docs.somnia.network/concepts/tokenomics/tokens-governance.md)). For a protocol
  whose pitch is a *neutral* audit substrate, that is a fair caveat to state: the chain is progressively, not yet fully,
  decentralised. PHI is unaffected — governance touches fund allocation, never claim data.
- **The chain operator runs a named AML/compliance program — a due-diligence positive, off the V1 loop.** A healthcare
  claims-settlement protocol that moves real value lives in a heavily regulated space, so *the substrate's own*
  regulatory posture is a fair due-diligence question for a neutral-settlement pitch. Upstream answers it: the Somnia
  entities (**Somnia ServiceCo. Ltd., TokenCo. Ltd., NetworkCo. Ltd.**) maintain a **voluntary AML/CFT program** —
  risk-based customer due diligence, **KYC** including beneficial-ownership identification, **sanctions screening**,
  continuous transaction monitoring, enhanced scrutiny for high-risk jurisdictions and politically exposed persons, and
  five-year record retention; verbatim, *"We do not engage in business relationships or transactions with… individuals
  or entities on sanctions lists"*
  ([AML compliance](https://docs.somnia.network/concepts/miscellaneous/legal/aml-compliance.md)). Crucially the page
  imposes **no obligation on developers** building on Somnia — it is the Companies' own posture — so it adds **nothing**
  to the V1 testnet demo (synthetic claims, faucet [STT](../GLOSSARY.md#s), no real value or PHI). It matters only on
  **mainnet**, where a live claims protocol moving real SOMI would carry its *own* AML/KYC obligations independent of the
  chain's; recorded here as a substrate-viability positive, not a V1 task. PHI/financial boundary unchanged — this is
  about *who operates the chain*, not what we put on it.

For us, "use Somnia performance as a real ingredient" (the [ROADMAP](../../../ROADMAP.md) judging constraint) cuts both
ways: the chain is fast enough for a live multi-agent loop, but only if the contract is written knowing logs and storage
are the dominant cost.

## Open questions (for the research loop)

1. **Minimum gas price value.** *Partially resolved (2026-05-21):* Somnia exposes EIP-1559 transaction fields via the
   JSON-RPC API (`eth_maxPriorityFeePerGas`, `eth_feeHistory`, per-block `baseFeePerGas`, type-`0x2` transactions —
   [JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md)), **but the base-fee *adjustment* is a
   validator vote, not EIP-1559's formula**: validators "vote to double the base fee" when a block takes longer than
   95 ms to execute and to "halve it" when faster, in cycles "every second (10 blocks)"
   ([tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md)). *Deepened (2026-05-22):* a live
   re-fetch captured the page's **dynamic pricing table verbatim** — gas price *falls* as throughput rises (up to a 90%
   discount), so a basic `21k`-gas transaction costs between **`$0.00012` (at 0 TPS) and `$0.00001` (at 400 TPS)**:

   | TPS | Gas price ($) | Cost of a 21k-gas tx | Discount vs base |
   |---|---|---|---|
   | 0.0 | `$5.49E-09` | `$0.00012` | 0% |
   | 0.1 | `$4.39E-09` | `$0.00009` | 20% |
   | 1.0 | `$3.29E-09` | `$0.00007` | 40% |
   | 10.0 | `$2.20E-09` | `$0.00005` | 60% |
   | 100.0 | `$1.10E-09` | `$0.00002` | 80% |
   | 400.0 | `$5.49E-10` | `$0.00001` | 90% |

   (verbatim: [tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md); named parameters on the
   same page: *Price Adjustment Threshold* `95ms`, *Price Increase/Decrease* `2x` / `50%`, *Voting Cycle* `1 sec / 10
   blocks`, *Minimum Base Fee* `21k`.) ⚠️ The page is **internally inconsistent**: the table's base (0-TPS) gas price is
   `$5.49E-09` and is self-consistent with the discount column (`$5.49E-09 × 0.10 = $5.49E-10` at 90%), but the page's
   *prose* "Base Price" / "Minimum gas price" are quoted as **`$0.00000000616`** (`$6.16E-09`) / **`$0.000000000616`**
   (`$6.16E-10`) — ~12% higher, an unexplained upstream divergence, flagged for human review (do not average them).
   *Confirmed-real upstream, not a fetch artifact (2026-05-22):* a **second, independent** targeted re-fetch of the same
   page returned the prose figures **verbatim** — *"Base Price: $0.00000000616 per gas unit"* and *"Min gas price:
   $0.000000000616 per gas unit (at 400 TPS)"* — alongside the identical `$5.49E-09`-to-`$5.49E-10` table, so two fetches
   now corroborate that both figures are on the page as written (the ~12% gap is not a transcription error). The re-fetch
   also **sharpens** the divergence: the prose "Min gas price" is explicitly tagged **"(at 400 TPS)"**, the *same
   operating point* as the table's 90%-discount last row, so the two numbers (`$6.16E-10` prose vs `$5.49E-10` table)
   describe the **identical** point — they therefore **cannot** be reconciled as "static base price vs dynamic curve"; it
   is a genuine same-point contradiction. Until upstream fixes it, treat the **table** as the operative dynamic model (it
   is internally self-consistent across all six rows) and the prose Base/Min as a separate, possibly stale, rounded pair.
   **Either way every figure is fiat (USD); the numeric floor in nanoSomi is still NOT published** — re-confirmed unpublished 2026-05-22, so **the
   nanoSomi value remains flagged unsourced**; read it live from `eth_gasPrice` / `eth_feeHistory` against the target
   network rather than assuming an Ethereum default.
2. **Fee burning & inflation.** *Resolved (2026-05-21):* the gap was a **coverage** gap, not an upstream gap — the
   earlier passes read only the [tokenomics overview](https://docs.somnia.network/concepts/tokenomics/overview.md) and
   [SOMI coin](https://docs.somnia.network/developer/network-info/somi-coin.md) pages, but the dedicated
   [tokenomics gas-fees page](https://docs.somnia.network/concepts/tokenomics/gas-fees.md) documents the split directly:
   **"50% of all fees are burnt. This means the Somnia token is deflationary, as the network is used more, the total
   supply will decrease,"** and **"50% of all fees are distributed to all validators. This is distributed based on the
   amount of tokens a validator has staked."** The
   [staking & delegation page](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md) confirms
   staking rewards are paid **from fees and treasury, not from new emission** ("They will be rewarded from gas fees and
treasury-based incentives"; "50% of all gas fees are distributed to
   validators as rewards"). **Conclusion:** the **burn share is 50%**, SOMI is **net-deflationary under load**, and the
   1B supply is **not inflated** by staking yield — treat it as **fixed-to-shrinking** in the cost model. This
   *reverses* the earlier "do not assume Somnia burns a fee fraction" guidance: it does, 50%.
3. **Native-agent invocation cost.** *Resolved (2026-05-21):* a [native-agent](native-agents.md) adjudication has **two
   additive, non-overlapping cost layers** — do not conflate them:
   - **Agent budget** — a **deposit-and-rebate `msg.value`** paid in SOMI/STT, *not* metered by the EVM gas schedule
     above. It splits into an **operations reserve** (`minPerAgentDeposit × subcommitteeSize`, default `0.01` SOMI/agent)
     and an **agent reward pot** (`msg.value − reserve`); unspent funds are rebated. For one **LLM Inference** call at the
     default `subcommitteeSize = 3` this is ≈ **`0.24` SOMI** (`0.03` reserve + `0.21` reward); JSON API ≈ `0.12`, LLM
     Parse Website ≈ `0.33` ([gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md), re-verified live
     2026-05-21; full breakdown in [native-agents.md → *Paying for it*](native-agents.md)).
   - **Base EVM gas** — the two ordinary transactions that bracket the call (the contract call that *invokes* the agent
     and the consensus *callback* that finalises it) are each priced by the re-priced Somnia schedule in the table above
     (logs + storage dominant). The deposit funds off-chain runner work and committee rewards; the gas schedule funds
     on-chain execution — they sum, they don't overlap.

   So a per-adjudication budget ≈ **agent deposit (≈`0.24` SOMI for LLM Inference, less rebate) + base gas for the invoke
   + callback txns**. What remains **flagged unsourced** is the *numeric* base-gas cost of those two bracketing txns —
   upstream publishes neither a worked example nor the base-fee floor (see open question 1), so measure it live
   against the target network rather than assuming a figure.

## Source caveat

Token roles, the fixed supply, denominations, the 50% burn / 50% validator split, and every gas figure above are quoted
from the six cited upstream pages (the four originals fetched 2026-05-20 and re-verified verbatim 2026-05-21; the
[tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md) and
[staking & delegation](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md) pages added
2026-05-21). The three **core tokenomics** pages —
[tokenomics overview](https://docs.somnia.network/concepts/tokenomics/overview.md),
[SOMI coin](https://docs.somnia.network/developer/network-info/somi-coin.md), and
[staking & delegation](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md) — were
**re-fetched live 2026-05-23** under the sharpened soft-404 rule (the 2026-05-22/23 sweeps had touched only the *separate*
gas-fees and gas-differences pages): all three render real content and every load-bearing quote (the `1B` fixed supply,
the three token roles, the `gWei`↔`nanoSomi` ladder, *"50% of all gas fees are distributed to validators as rewards"*) is
**verbatim un-drifted**, and the staking page's reward-source phrase was tightened from the paraphrase `(and treasury)` to
upstream's verbatim *"They will be rewarded from gas fees and treasury-based incentives."* The [tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md) page was **re-fetched
live 2026-05-22** for the two newly-captured tables (the dynamic USD pricing curve in open question 1 and the
retention-priced `SSTORE` table above); both tables are reproduced cell-for-cell from that fetch, but — as everywhere in
this folder — the fetch runs through an AI summariser, so re-read the page for exact figures before wiring a cost model,
and note the page's own prose-vs-table base-price inconsistency flagged in open question 1 (**confirmed real upstream by
a second independent re-fetch 2026-05-22**, not a fetch artifact — the prose `$6.16E-10` and table `$5.49E-10` describe
the *same* "(at 400 TPS)" point yet disagree). Gas constants in particular
are the kind of number that changes between testnet and GA — re-read the upstream
[gas-differences page](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md)
before committing to a cost model, and treat anything marked **flagged unsourced** as a research gap, not a fact. That
page (the source of the opcode table) was **re-fetched live 2026-05-23** under the sharpened soft-404 rule — confirmed
real content, every opcode constant un-drifted, and three previously-dropped precision details captured (LOG's
`+ memory_expansion_cost` term, the `128M`-slot cached-read working set, the EIP-7702 `400,000`-gas refund). The
nanoSomi base-fee floor remains the residual research gap (every published fee figure is fiat USD).

The [ecosystem: on-ramps](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/on-ramps.md)
page (fetched and confirmed real content 2026-05-22 — a one-provider stub, not a GitBook soft-404) is cited only for the
**funding** bullet above; it is off the V1 path, so it gets a sentence here rather than its own sub-article. The
**dedicated developer on-ramps section** — [overview](https://docs.somnia.network/developer/building-dapps/onramps.md) +
[Banxa checkout walkthrough](https://docs.somnia.network/developer/building-dapps/onramps/buy-somi-using-banxa-checkout.md),
surfaced by a fresh `llms.txt` diff and triaged 2026-05-22 — is folded into the same bullet for the same reason: both are
Banxa-only, human-browser checkouts that deliver **mainnet SOMI** and expose no headless API, so they sharpen but do not
change the off-V1 verdict. Quotes above are verbatim; the pages publish no chain ID, amount, or fee.

The [tokens governance](https://docs.somnia.network/concepts/tokenomics/tokens-governance.md) page was read 2026-05-22
(confirmed real content — token-house/council structure, named phases, the "still in it's early phases" line; not a
GitBook soft-404) to resolve the role-#3 "(details pending upstream)" marker; governance itself is off the V1 agent
loop, cited only for the role definition and the phased-decentralisation trust caveat above. Its sibling
[allocation & unlocks](https://docs.somnia.network/concepts/tokenomics/allocation-and-unlocks.md) page was also fetched
the same run (real content — a six-way allocation table summing to the 1B supply, a 48-month unlock schedule, ~16% TGE
circulating, an `unlocks.somnia.network` tracker) but is **investor/market information, off the V1 cost model** — it
changes neither per-claim gas nor the fixed-supply assumption already stated above. Recorded here so the loop stops
re-triaging it: like on-ramps, **allocation & unlocks is real but off-V1**. With both, the two remaining uncited
tokenomics concept pages are now read and accounted for.

The legal cluster under `concepts/miscellaneous/legal/` was triaged 2026-05-22 via an `llms.txt` diff. Only
[AML compliance](https://docs.somnia.network/concepts/miscellaneous/legal/aml-compliance.md) carried a V1-adjacent fact
(the bullet above) — confirmed **real content** (a substantive AML/CFT policy naming the three Somnia entities and
Campbells Regulatory Services as compliance contact; not a GitBook soft-404). Its **structural detail is summarised from
an AI fetch**: the one sentence in quotation marks is verbatim, but re-read the page for the exact program
(jurisdictions, retention period, screening steps) before relying on specifics. Its sibling
[MiCAR whitepaper](https://docs.somnia.network/concepts/miscellaneous/legal/micar-whitepaper.md) is a **stub** — its body
is a single GitBook `{% file %}` embed (`/files/6HrVoYsMdbKXaMozTVOj`) with no rendered prose. Following that embed
2026-05-22 (the same method that confirmed the [L1 Audit Report](consensus-and-execution.md) embed unverifiable)
**confirms it 404s on the docs domain**: `https://docs.somnia.network/files/6HrVoYsMdbKXaMozTVOj` returns GitBook's
"Page Not Found" ("The URL `files/6HrVoYsMdbKXaMozTVOj` does not exist"), because the binary is served from a separate
GitBook CDN host the `.md` rendering does not expose. So the EU Markets-in-Crypto-Assets whitepaper content is *asserted
but unobtainable from `docs.somnia.network`* — flagged for human review if MiCAR posture ever becomes a due-diligence
requirement. As with the L1-audit flag, a `.md`-only capture pipeline **cannot** resolve `{% file %}` targets, so this
stays open as "ask Somnia directly," not "re-fetch." This was the one other open human-review flag of the `{% file %}`
shape; both are now confirmed unverifiable from the public docs.
Separately, the ecosystem [`som0`](https://docs.somnia.network/ecosystem/protocols/som0.md) /
[`som1`](https://docs.somnia.network/ecosystem/protocols/som1.md) protocol pages were triaged the same run: both real
content but **gaming/metaverse-scoped** (SOM0 = Object / Attestation / Marketplace protocols for "Virtual Societies,"
omni-chain; SOM1 = an Entity-Component-System framework for composable virtual worlds) — neither is a V1 settlement
primitive. Recorded here so the loop stops re-triaging them: like on-ramps and allocation, the **legal cluster and
SOM0/SOM1 are real but off-V1**.

Finally, the `/ecosystem/experiences/*` + `/ecosystem/content-creation` cluster — the last never-individually-read paths
in the live [`llms.txt`](https://docs.somnia.network/llms.txt) diff — was triaged 2026-05-23 under the read-don't-assume
discipline (the same discipline that turned the "redundant" oracle listing into a verified two-provider negative). The
representative page, [somnia-playground](https://docs.somnia.network/ecosystem/experiences/somnia-playground.md), was
**fetched directly** and confirmed **real content** (not a GitBook soft-404): it is the consumer end of the SOM0 family —
verbatim, *"The web-based Playground … allows Content Creators to quickly and easily spin up web-hosted Virtual Society
experiences in a 'sandbox' environment,"* validating ownership via the **Object Protocol** and commerce via the
**Marketplace Protocol**. It names **no smart contract, RPC endpoint, chain ID, SDK, agent, or transaction primitive** —
a verified off-V1 finding, the same Virtual Society family as SOM0/SOM1 above. Its two siblings — previously
**classified by family, not individually fetched** — were **fetched directly 2026-05-23** to close that honest scope
limit, and both confirmed **real content** (sharpened soft-404 rule) and **off-V1**:
[`metaverse-browser`](https://docs.somnia.network/ecosystem/experiences/metaverse-browser.md) is a gamified onboarding UX
layer (verbatim: *"Engaging with blockchain applications can be a complex task, particularly for users unfamiliar with
decentralised applications, web3 wallets…"* — an integrated web3 wallet + quest-based rewards system), and
[`content-creation`](https://docs.somnia.network/ecosystem/content-creation.md) is a creator-tooling list (3D/2D engines —
Unreal, Unity, PlayCanvas — plus object/avatar tools). **Two precision catches recorded:** (a) the canonical
content-creation slug is **`/ecosystem/content-creation.md`**, not the `…/ecosystem-showcase.md` a prior run had guessed
(citation corrected here); and (b) the content-creation page **does name "generative AI"** — *"Meshy.ai … Generative AI
tool means anyone can create object"* — the **one** `/ecosystem/*` AI mention found, but it is a **third-party 3D-content
tool in a creator toolchain, not Somnia positioning itself as an AI/agent L1**. Neither page names a smart contract, RPC
endpoint, chain ID, SDK, agent, or transaction primitive. With this, **every `/ecosystem/*` path the diff surfaces is now
individually read**, and — corroborating the [use-cases](https://docs.somnia.network/concepts/somnia-blockchain/use-cases.md)
negative — Somnia's experiences layer names gaming/metaverse/creator work, with its lone AI reference being a vendor
content tool, **never AI agents or healthcare as a platform position**.
