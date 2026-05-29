# Somnia & on-chain-AI glossary

Terms you will hit reading [docs.somnia.network](https://docs.somnia.network) and this repo. Written for an
**entry-level blockchain developer** and a **mid-level AI engineer** — each entry says what it is, and where useful,
*why it matters for Curie V1*. Sourced terms cite a doc URL; uncited entries are general-EVM background knowledge.

Back to the [chain-resources map](README.md) · project [ROADMAP](../../ROADMAP.md).

---

## A

**Account Abstraction (AA).** Letting a *smart contract* act as a user account instead of a plain keypair, so you can
sponsor gas (**gasless transactions**), batch calls, or set custom auth rules via **session keys**; Somnia describes it
as "ERC-4337-style flows" with documented tooling **Thirdweb** and **Privy**
([account abstraction](https://docs.somnia.network/developer/building-dapps/account-abstraction.md), re-verified live
2026-05-23 — the capability bullet "Implement user operations via ERC-4337-style flows" and the Thirdweb+Privy naming
both un-drifted). On **testnet
(Shannon)** Somnia lists the ERC-4337 `EntryPoint v0.7` at `0x0000000071727De22E5E9d8BAf0edAc6f37da032` and an account
**factory** at `0x4bE0ddfebcA9A5A4a617dee4DeCe99E7c862dceb` (EIP-55 checksummed casing, per upstream)
([network-info](https://docs.somnia.network/developer/network-info.md)). ⚠️ The mainnet (`5031`) EntryPoint/factory
rows are **blank** upstream as of 2026-05-20 — AA appears testnet-only; no paymaster address is published. *V1:* lets
our agents transact without each pre-funding an EOA — gas can be sponsored, smoothing the demo (a P1/polish item, not
required for the loop). See [`chain-resources/account-abstraction.md`](chain-resources/account-abstraction.md).

**Agent (two senses — do not conflate).**
- *somnia-agent-kit agent* — an **off-chain** TypeScript process (our SDK) that holds a key and sends signed
  transactions to the kit's contracts (`AgentRegistry`, `AgentManager`, `AgentVault`, `AgentExecutor`). See
  [`../somnia-agent-kit/`](../somnia-agent-kit/). **This is what "agent" means in our codebase.**
- *Somnia native Agent* — a **protocol-level** "decentralized sandboxed compute container" that a smart contract
  invokes to run an LLM or API call, with validators reaching consensus on the result
  ([agents overview](https://docs.somnia.network/agents/readme.md)). See [`chain-resources/native-agents.md`](chain-resources/native-agents.md).

**ABI (Application Binary Interface).** The typed schema describing a contract's functions and events — how callers
encode arguments and decode results. Somnia's native agents deliberately mirror the Solidity ABI so you call them with
ordinary viem/ethers ([agents overview](https://docs.somnia.network/agents/readme.md)).

**`AggregatorV3Interface` / `latestRoundData`.** The de-facto Chainlink standard interface for reading a price feed,
which both Somnia oracle providers expose. `latestRoundData()` returns a 5-tuple
`(uint80 roundId, int256 price, uint startedAt, uint timeStamp, uint80 answeredInRound)`; the raw `price` must be scaled
by the feed's `decimals()` (Protofire feeds are **typically 8 decimals**)
([Protofire](https://docs.somnia.network/developer/building-dapps/oracles/protofire-price-feeds.md)). DIA also exposes a
simpler `DIAOracleV2.getValue(string key) → (uint128 price, uint128 timestamp)`
([DIA](https://docs.somnia.network/developer/building-dapps/oracles/dia-price-feeds.md)). *V1:* how a settlement
contract would read SOMI↔USD. See [`chain-resources/oracles-and-vrf.md`](chain-resources/oracles-and-vrf.md).

**Accelerated Sequential Execution (ASE).** Somnia's bet on **one extremely fast CPU core** rather than parallel
multi-core execution, on the argument that "parallel execution breaks down exactly when you need it" (load spikes
correlate transactions onto the same state). Speed comes from an "EVM compiler, which translates EVM bytecode to x86"
(only "on contracts that are called frequently, falling back to standard interpreted EVM on the rest"), which "can
execute ERC-20 transfers in hundreds of nanoseconds"
([concept](https://docs.somnia.network/concepts/somnia-blockchain/accelerated-sequential-execution.md), re-verified
live 2026-05-23 — the "parallel execution breaks down exactly when you need it" / "EVM compiler, which translates EVM
bytecode to x86" / "on contracts that are called frequently, falling back to standard interpreted EVM on the rest" /
"can execute ERC-20 transfers in hundreds of nanoseconds" quotes all un-drifted). Note: the
global transaction *ordering* it executes comes from [MultiStream Consensus](#m), not from ASE — the upstream ASE page
does not itself describe ordering. *Why care:* it's part of why the chain keeps up with a rapid agent-to-agent loop.
See [`chain-resources/consensus-and-execution.md`](chain-resources/consensus-and-execution.md).

**Advanced compression.** The fourth of Somnia's core innovations: the data-chain architecture "is designed to enable
streaming compression in order to maximise data throughput," and Somnia "combines this with **BLS signature
aggregation** in order to achieve extremely high compression ratios, allowing for massive transaction data throughput"
([overview](https://docs.somnia.network/concepts/somnia-blockchain/overview.md), re-verified live 2026-05-23 — both
sentences un-drifted verbatim, incl. the British *"maximise"*). *Streaming compression* shrinks
transaction payloads across the continuous byte stream (not per-block) — it works because "the sender and receiver both
share an identical history of the data," which is exactly what MultiStream's per-validator data chains provide, so they
"unlock[] the ability for streaming compression"
([advanced compression](https://docs.somnia.network/concepts/somnia-blockchain/advanced-compression-techniques.md),
re-verified live 2026-05-23 — *"the sender and receiver both share an identical history of the data"*, *"unlocks the
ability for streaming compression"* (verbatim "unlocks"; the entry's bracket-edited "unlock[]" matches the plural
subject), *"effectively achieving a constant size for any number of transaction signatures"*, and the *"encoded in 3.3
bits"* / *"48x compression ratio"* address example all un-drifted verbatim);
*BLS aggregation* collapses many transaction signatures into one, "effectively achieving a constant size for any number
of transaction signatures" (same page), so signature bytes stop dominating. The point is to put the throughput ceiling
back on compute rather than bandwidth. ⚠️ No *blanket* compression ratio is published — "extremely high" is the only
global wording. The dedicated page does give one **illustrative** address-encoding example (a contract called by 10% of
transactions → "encoded in 3.3 bits… a 48x compression ratio"); cite it only as that, never as the chain's overall
ratio. *Why care:* together with [MultiStream Consensus](#m), [ASE](#a), and [IceDB](#i) it's why the
chain is fast enough to put on-chain writes *inside* a live agent loop. See
[`chain-resources/consensus-and-execution.md`](chain-resources/consensus-and-execution.md).

**Anvil.** [Foundry](#f)'s local EVM node, used for in-process tests (`forge test`) and for [forking](#f) a live network
onto your machine (`anvil --fork-url <RPC> --port 8546`)
([local-testing guide](https://docs.somnia.network/developer/development-frameworks/local-testing-and-forking.md)).
*For the AI engineer:* the contract-side analogue of spinning up a throwaway local server to run integration tests
against. *V1:* one option for running `ClaimSettlement.sol` tests before deploy. See
[`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

## B

**Blockscout.** The open-source block-explorer software Somnia's explorers run on (*not* Etherscan). It matters for
contract **verification**: `forge verify-contract` needs `--verifier blockscout --verifier-url <…>` rather than an
Etherscan API key, and the Hardhat config points its `etherscan.customChains` `apiURL` at the Blockscout `/api`
endpoint ([verify](https://docs.somnia.network/developer/development-frameworks/verifying-via-explorer.md)). It is also a
**read-path for the audit timeline**: the same `/api` base exposes a Blockscout **REST API** (testnet
`https://shannon-explorer.somnia.network/api`, mainnet `https://explorer.somnia.network/api`) whose
`GET /v2/addresses/{address}/transactions` returns an address's full paginated transaction history with no subgraph to
deploy ([explorer API, health & monitoring](https://docs.somnia.network/developer/deployment-and-production/explorer-api-health-and-monitoring.md),
re-verified live 2026-05-23 — *"Somnia Network uses Blockscout as its blockchain explorer infrastructure"*, the testnet/
mainnet `/api` base table, the `/v2/addresses/{address}/transactions` call, and the four interfaces it names — **REST API**,
**RPC API**, **ETH RPC API**, **GraphQL** — all un-drifted verbatim).
*V1:* verified contracts let judges read our actual settlement logic on the explorer, and the REST API is the
zero-infrastructure fallback for the per-agent audit timeline. Note Blockscout is **one of three** explorers upstream
lists: the [ecosystem: explorers](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/explorers.md)
page also names **Exploreme** (operated by Stakeme; `somnia.exploreme.pro`), and the canonical
[network-info](https://docs.somnia.network/developer/network-info.md) page *itself* lists **SocialScan**
(`https://somnia-testnet.socialscan.io/`, re-verified 2026-05-22) as a testnet alternative — both are human-readable UI
fallbacks with no documented `/api` surface, so the REST read-path above is Blockscout's alone. See
[`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md) and
[`chain-resources/indexing-subgraphs.md`](chain-resources/indexing-subgraphs.md) → Path 3.

**Bundler.** In ERC-4337 [account abstraction](#a), the off-chain service that collects [UserOperations](#u) from a
mempool, packs them into one ordinary transaction, and submits it to the [EntryPoint](#e) — it is the actor that
actually pays L1 gas at broadcast and is reimbursed by the smart account or a [paymaster](#p). *For an AI engineer:*
think of it as the relay/queue that turns an agent's signed *intent* into an on-chain transaction, so the agent itself
never has to broadcast or hold gas. Somnia publishes no *provider-neutral* public bundler endpoint, **but the managed
path is documented**: the
[gasless-with-Thirdweb tutorial](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md)
(2026-05-21) shows Thirdweb's bundler is **implicit in the SDK** — there is no endpoint to point a 4337 client at; you
enable it with `sponsorGas: true` and a Thirdweb client ID. A non-Thirdweb client would still need a self-hosted or
Privy bundler — **or Pimlico**, the *infrastructure-layer* provider named on the
[ecosystem: account-abstraction](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/account-abstraction.md)
page (2026-05-22): unlike the wallet-UI providers, Pimlico exposes the bundler+paymaster **RPC endpoint directly**
(`api.pimlico.io/v2/<chain>/rpc`), the form a headless `permissionless.js` signer points at. A *Somnia* endpoint is now
**confirmed** (2026-05-22) from Pimlico's [supported-chains list](https://docs.pimlico.io/guides/supported-chains):
Somnia Testnet (`50312`, slug `somnia-testnet`) and Mainnet (`5031`, slug `somnia`), both EntryPoint v0.6/v0.7 (v0.8
**unsupported** on both) — so the Shannon endpoint is `api.pimlico.io/v2/somnia-testnet/rpc`. See
[`chain-resources/account-abstraction.md`](chain-resources/account-abstraction.md) → open questions 3 & 4.
_(All three sources re-fetched and re-verified live 2026-05-23 — the gasless-Thirdweb tutorial's `sponsorGas: true` +
implicit-bundler framing, the ecosystem-AA page's Pimlico "infrastructure platform" naming, and the Pimlico
supported-chains rows (`50312`/`somnia-testnet`, `5031`/`somnia`, v0.6/v0.7 ✓ / v0.8 ✗) all un-drifted verbatim.)_

## C

**Chain ID.** The integer identifying a network so signed transactions can't be replayed across chains. Somnia
**mainnet = `5031`**, **testnet (Shannon) = `50312`** ([network-info](https://docs.somnia.network/developer/network-info.md)).
✅ *Resolved 2026-05-20; citation corrected 2026-05-22:* `50312` is corroborated by a second upstream page — the
`customChains` entry in the [Hardhat deploy guide](https://docs.somnia.network/developer/development-frameworks/deploy-with-hardhat.md)
(`network: "somnia", chainId: 50312, apiURL: "https://shannon-explorer.somnia.network/api"`, re-fetched live 2026-05-22).
The [verify guide](https://docs.somnia.network/developer/development-frameworks/verifying-via-explorer.md) is **mainnet-only**
(`chainId 5031`, `w3us.site`) and does **not** carry `50312` — earlier notes mis-attributed this corroboration to it. The
agent-kit notes' `50311` is a stale off-by-one; treat it as incorrect, not as a value to reconcile against.

**Checks-Effects-Interactions (CEI).** The standard Solidity ordering that prevents reentrancy: validate inputs
(*checks*), update your own state (*effects*), *then* make external calls (*interactions*) — so a malicious callee can't
re-enter before your state is settled. Somnia's [audit checklist](https://docs.somnia.network/developer/security/audit-checklist.md)
requires it for "all functions that send Ether or tokens to external addresses" (re-verified live 2026-05-23 — upstream
verbatim: *"All functions that send Ether or tokens to external addresses must follow the Checks-Effects-Interactions
pattern."*). *V1:* applies to any
`ClaimSettlement.sol` function that releases settlement funds. Standard EVM practice, not Somnia-specific. See
[`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

**Consensus.** The rule by which independent nodes agree on one canonical result. For native agents specifically,
"execution is considered valid only when a majority of nodes reach consensus on the result"
([agents overview](https://docs.somnia.network/agents/readme.md)). This is what makes an on-chain LLM output trustworthy.
Native agents expose **two `ConsensusType` modes**, selected via `createAdvancedRequest`: **Majority (0)** — the default —
"finalizes when a threshold of validators return byte-identical results" (right for deterministic ops); and
**Threshold (1)**, which "finalizes as soon as the threshold number of validators respond successfully — regardless of
whether their results agree," passing every response to the callback to aggregate (e.g. median, XOR) — right for price
feeds, randomness, and non-deterministic LLM inference
([custom consensus](https://docs.somnia.network/agents/invoking-agents/custom-consensus.md), re-verified live 2026-05-23 —
the `ConsensusType { Majority, Threshold }` enum (`0`/`1`), both definitions, the "3 of 5" default, and the median/XOR
aggregation examples all un-drifted). *V1:* a verdict
constrained to `allowedValues`/`inferNumber` keeps Majority viable; free-text adjudication would force the heavier
Threshold-plus-aggregation path. See [`chain-resources/native-agents.md`](chain-resources/native-agents.md).

**Cron subscription.** A Reactivity feature to schedule recurring on-chain actions via the SDK — chain-native
timers, no off-chain scheduler needed. The `@somnia-chain/reactivity` helpers `scheduleSubscriptionAtBlock`
(`BlockTick`, every block or once at a block) and `scheduleSubscriptionAtTimestamp` (`Schedule`, "once when block time
first reaches" a millisecond timestamp, ≥12 s ahead) drive a Solidity `onEvent(address,bytes32[],bytes)` handler
([tutorial](https://docs.somnia.network/developer/reactivity/tutorials/cron-subscriptions-via-sdk.md)). See
[`chain-resources/reactivity.md`](chain-resources/reactivity.md).

**Cuthbert.** Somnia's **second, deliberately unoptimised** execution-and-database implementation — *"a separate
implementation of Somnia's execution and database, using third party libraries wherever possible"* — run in parallel
with the production implementation as a correctness check. Validators "run every transaction through both Somnia and
Cuthbert, and they will **stop voting or executing if they ever detect a divergence between the two**," so an execution
bug would have to exist in *both* independent codebases to escape detection; upstream notes "Cuthbert will eventually be
phased out of Somnia as the system becomes more mature"
([security](https://docs.somnia.network/concepts/somnia-blockchain/security.md), re-verified live 2026-05-23 — the
definition, divergence, and phase-out quotes all un-drifted verbatim; the prior entry's `"run all transactions
through both…"` was a paraphrase passing as verbatim — corrected to upstream's `"run every transaction through both
Somnia and Cuthbert"` and the dropped `"they will"` restored). For the AI engineer: a "double-entry"
safety net at the execution layer — distinct from [Consensus](#c) (which agrees on *ordering/results* across validators),
Cuthbert guards against a *single implementation* computing the wrong result in the first place. *V1:* part of why an
anchored settlement/adjudication state is hard to silently corrupt — the trust half of Curie's neutral-substrate wedge.
See [`chain-resources/consensus-and-execution.md`](chain-resources/consensus-and-execution.md).

## D

**Data ID.** In [Data Streams](#d), the third addressing key that identifies an individual record *within* a
`(schemaId, publisher)` namespace — the third `bytes32` in the on-chain `dsstore` mapping. It is "a unique key
representing that entry" that "uniquely identifies a specific record (or row)," is "created by hashing a string,
typically by combining context and timestamp," and acts as a primary key: "If you write another record with the same
Data ID, it updates the existing entry rather than duplicating it"
([understanding schemas, IDs & publisher](https://docs.somnia.network/developer/data-streams/concepts/understanding-schemas-schema-ids-data-ids-and-publisher.md),
re-verified live 2026-05-23 — the "unique key representing that entry" / "uniquely identifies a specific record (or
row)" / "hashing a string, typically by combining context and timestamp" / same-Data-ID "updates the existing entry
rather than duplicating it" quotes all un-drifted).
*V1:* the developer-chosen lever between an **append-only** audit log (a fresh Data ID per negotiation step, so history
can't be overwritten) and an **upsert** "latest claim state" record (one reused Data ID). Hash Data-ID inputs from
claim/step metadata, never clinical content. See [`chain-resources/data-streams.md`](chain-resources/data-streams.md).

**Data Streams.** Somnia's schema-typed structured-data layer that lets you "emit EVM event logs and write data to the
Somnia chain without Solidity" ([what is it](https://docs.somnia.network/developer/data-streams/what-is-somnia-data-streams.md),
re-verified live 2026-05-23 — a faithful elision of the upstream "Somnia Data streams enable developers to build
applications that both emit EVM event logs and write data to the Somnia chain without Solidity"; un-drifted).
A **publisher** writes records against a registered **schema** (identified by a **Schema ID**); a **subscriber** reads
all records for a `(schemaId, publisher)` pair; each record carries a deterministic ID and the publisher's address, so
provenance is verifiable. ⚠️ Despite "stream," persisted data goes **on-chain** — the data flow routes writes to
"Somnia Streams L1 (on-chain data)" and `set()` returns a transaction hash — *not* an off-chain bus; only the
**reactivity** (WebSocket event delivery) is off-chain. Detailed in
[`chain-resources/data-streams.md`](chain-resources/data-streams.md). *V1:* a PHI-free audit-event fan-out and a
verifiable negotiation record — and, being on-chain, subject to the full no-PHI-on-chain rule.

**Deposit-and-rebate (agent fee model).** How you pay to invoke a [native Agent](#a): instead of a fixed fee you send a
deposit (`msg.value`) that the contract splits into an **operations reserve** (`minPerAgentDeposit × subcommitteeSize`,
default `0.01` SOMI/STT per agent — gas refunds, callback gas, keeper reimbursement) and an **agent reward pot**
(the remainder, paid to the elected [subcommittee](#s)); anything unspent is pushed back to the requester
([gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md), re-verified live 2026-05-23 — `0.01` floor,
`0.03`/`0.07`/`0.10` per-agent prices, the worked `0.12`/`0.24`/`0.33` totals, and the `receive()`/`NativeTransferFailed`
rebate path all un-drifted). ⚠️ `getRequestDeposit()` returns **only**
the operations-reserve floor — pay exactly that and the request times out; you must add the reward component on top. To
receive the rebate the caller must implement `receive() external payable {}`. *V1:* the per-call cost basis if we route
adjudication through native inference (`0.07` SOMI/agent × subcommittee). See
[`chain-resources/native-agents.md`](chain-resources/native-agents.md).

**Determinism (in LLM inference).** Forcing a model to produce identical output for identical input. Somnia's LLM
Inference agent relies on this: "Because the models run deterministically across all validating nodes, consensus can be
achieved on the output, making AI results trustworthy for on-chain use"
([LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference.md), re-verified live 2026-05-23 — quote
un-drifted verbatim). ⚠️ **Precision (2026-05-23):** the page documents only *that* the models "run deterministically" —
it does **not** state the **fixing-seed-and-temperature** mechanism an earlier draft of this entry asserted as fact;
that is general-ML background, not an upstream-published detail, and is labelled as such here rather than implied. *This
is the crux for AI engineers:* on-chain inference is only verifiable because it is made deterministic.

**Deterministic deployment (CREATE2 / CreateX).** A way to deploy a contract to an address you can compute *before*
deploying it — the address is a hash of the deployer, a chosen salt, and the contract bytecode (via the EVM `CREATE2`
opcode), rather than the deployer's nonce. **CreateX** is a standard public factory contract that wraps `CREATE2`/`CREATE3`
for this; Somnia lists it at mainnet `0xD13C575ED5378fd18B100Bd87D5765d9A747358B` and testnet
`0x535822d4b86b2372FBE4fd9d1468318F04A2A640`
([network-info](https://docs.somnia.network/developer/network-info.md), re-verified live 2026-05-23 — both CreateX
addresses, mainnet `0xD13C575ED5378fd18B100Bd87D5765d9A747358B` and testnet
`0x535822d4b86b2372FBE4fd9d1468318F04A2A640`, un-drifted verbatim; the page renders real content, not a GitBook
soft-404). The factory address itself is Somnia-sourced; the `CREATE2` mechanism is general-EVM background. *V1:* lets a payer agent know the
`ClaimSettlement.sol` address **before** it is deployed, so the negotiating agents can agree on the settlement contract
without a prior on-chain round-trip. See [`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

**dPoS (delegated proof of stake).** Somnia's consensus token model: SOMI is "a delegated proof of stake token (dPoS)"
with a "fixed supply of 1,000,000,000 tokens." Validators must **stake** SOMI to run nodes, and holders can **delegate**
to Node Providers "to cover their staking costs"
([tokenomics](https://docs.somnia.network/concepts/tokenomics/overview.md)). The 1B supply is documented as **fixed**,
and the dedicated [gas-fees page](https://docs.somnia.network/concepts/tokenomics/gas-fees.md) makes it **deflationary
under load**: "50% of all fees are burnt… the total supply will decrease," the other 50% pays validators by stake, and
staking rewards come **from fees, not new emission**
([staking & delegation](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md)). ✅ *Resolved
2026-05-21 — this corrects an earlier note that called the burn undocumented.* ✅ *Re-verified live 2026-05-23 against the
[tokenomics overview](https://docs.somnia.network/concepts/tokenomics/overview.md): "SOMI is a delegated proof of stake
token (dPoS)", "fixed supply of 1,000,000,000 tokens", and "Tokens can be delegated to Node Providers to cover their
staking costs" are all un-drifted verbatim. The burn quotes cite the separate gas-fees page (re-verified 2026-05-22),
not re-fetched this run; "from fees, not new emission" is the no-inflation conclusion — accurate even though the funding
source is fees **and treasury** (see the [Staking / delegation](#s) entry).* See
[`chain-resources/tokenomics-and-gas.md`](chain-resources/tokenomics-and-gas.md) → open question 2.

## E

**EIP-7702 (set-code-for-EOAs).** A protocol-level account-abstraction primitive (introduced in Ethereum's Pectra
upgrade) that lets an existing **[EOA](#e) temporarily delegate to smart-contract code** — keeping its address and key
but gaining smart-account behaviour (batching, sponsored gas) for the lifetime of an authorization. It is the
*alternative* to [ERC-4337](#a): no separate smart-account contract or [bundler](#b) is required. Somnia's EVM **prices
the EIP-7702 authorization** (`1,570,000` gas, `400,000` refunded if no account creation), which is upstream evidence the
chain supports it ([gas differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md),
verified 2026-05-21, re-verified live 2026-05-23 — upstream reads verbatim *"1,570,000 gas per authorisation in a Set
Code transaction. 400,000 gas is refunded if account creation isn't required."*, un-drifted). ⚠️ The
[account-abstraction page](https://docs.somnia.network/developer/building-dapps/account-abstraction.md)
documents only ERC-4337 flows — no EIP-7702 workflow or tooling — so chain support is sourced but a recommended dev path
is not. See [`chain-resources/account-abstraction.md`](chain-resources/account-abstraction.md) → *Two AA paths*.

**EOA (Externally Owned Account).** A normal account controlled by a private key (vs. a contract account). Each
off-chain agent process is, by default, backed by an EOA — which is why Account Abstraction is attractive for us.

**EntryPoint.** The singleton ERC-4337 contract that processes "user operations" for account abstraction (see *AA*).
Somnia's testnet `EntryPoint v0.7` is published at `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
([network-info](https://docs.somnia.network/developer/network-info.md)); Pimlico's
[supported-chains list](https://docs.pimlico.io/guides/supported-chains) marks **v0.6 and v0.7 supported, v0.8
unsupported** on both Somnia networks (re-verified live 2026-05-23).

**EVM (Ethereum Virtual Machine).** The bytecode runtime that executes smart contracts. Somnia is **EVM-compatible**,
so Solidity, existing audited libraries, and tools (Foundry/Hardhat/viem) work unchanged
([smart contracts](https://docs.somnia.network/developer/smart-contracts.md)).

**Event / log.** A cheap, indexed record a contract emits during a transaction. Off-chain code subscribes to events
to react to state changes — the backbone of our agent state machine and the UI audit timeline.

**`eth_getLogs` / `eth_subscribe`.** The two JSON-RPC ways to read events. `eth_getLogs` is a one-shot historical
query — on Somnia the **block range must not exceed 1000 blocks** per call. `eth_subscribe` is a live push and is
**WebSocket-only** (over HTTP it returns `"events_not_supported"`); supported types are `newHeads`, `logs`,
`somnia_finishedTransactions`, `somnia_finishedBlocks`, and `somnia_watch` — but **not** `newPendingTransactions`
([JSON-RPC](https://docs.somnia.network/developer/json-rpc-api.md)). *V1:* the live UI event listener uses `logs`
subscriptions; `eth_getLogs` does startup backfill. See [`chain-resources/indexing-subgraphs.md`](chain-resources/indexing-subgraphs.md).

**Event stream (vs data stream).** In Data Streams, an **event stream** emits a notification that triggers WebSocket
listeners "for off-chain reactivity" *without persisting new data* (`emitEvents`), whereas a **data stream** persists a
structured record on-chain (`set`); `setAndEmitEvents` does both atomically. Upstream notes that, "Serving different
purposes, data and event streams can be used independently or together"
([SDK methods](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md),
[concepts](https://docs.somnia.network/developer/data-streams/concepts.md); re-verified live 2026-05-23 — the
"for off-chain reactivity" + "without persisting new data" fragments are verbatim from the SDK methods guide, and the
"data and event streams can be used independently or together" sentence is verbatim from the concepts page. The prior
"can operate independently or in tandem" was a paraphrase passing as verbatim and was corrected to upstream's wording,
matching [`chain-resources/data-streams.md`](chain-resources/data-streams.md)). *V1:* event streams drive the live UI
timeline; data streams hold the verifiable negotiation record.

## F

**Faucet.** A service that dispenses free **testnet** tokens (STT) so you can deploy and test without real funds
([network-info](https://docs.somnia.network/developer/network-info.md)).

**Filtered subscription.** An off-chain [Reactivity](#r) `sdk.watch()` call narrowed to specific contract(s)
(`eventContractSources`) and event signature(s) (`topicOverrides`), optionally pairing each match with a read-only
simulation (`ethCalls`) whose calldata is fed a matched log topic via the **one-based** `context` selector
(`context: 'topic3'` injects `topics[2]`), so the event and a derived read arrive in one push. *For the AI engineer:*
think of it as subscribing to one topic on a bus with a server-side enrichment step attached — no second round-trip.
*For the blockchain dev:* the topic is built from the signature with Viem's `toEventSelector(...)`, not a raw hash; set
`onlyPushChanges: true` to suppress pushes when the simulated result is unchanged. Indexed args used as filter keys live
in the event topics, so they must be PHI-free
([filtered-subscriptions tutorial](https://docs.somnia.network/developer/reactivity/tutorials/off-chain-reactivity-filtered-subscriptions-tutorial.md),
re-verified live 2026-05-23 — `eventContractSources`→`address`, `topicOverrides`→`topics`, the one-based selector
(*"The off-chain Reactivity context selector is one-based, so `topic3` appends `topics[2]` to the call data"*),
`toEventSelector('Transfer(address,address,uint256)')`, `onlyPushChanges`, and the `sdk.watch({...})` invocation all
un-drifted verbatim).
*V1:* how the payer agent's process wakes on only the proposals for one claim. See
[`chain-resources/reactivity.md`](chain-resources/reactivity.md).

**Finality.** The point at which a transaction is irreversible. The developer
[FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md) states
"Sub-second transaction finality" and "1,000,000+ transactions per second" (on-docs, re-verified live 2026-05-23 — the
FAQ renders real content under the sharpened soft-404 rule and all three quoted phrases are un-drifted verbatim), but no
`docs.somnia.network` page publishes a numeric time-to-finality or **block time** — the FAQ's "Block Time" field reads
only "Optimized for real-time applications" (re-confirmed live 2026-05-23: no millisecond TTF or numeric block-time
figure appears anywhere on the FAQ). For the finer-grained numbers we avoid restating them here; see sourced
analysis in [`../../research/somnia/finality-tps-and-gas-model.md`](../../research/somnia/finality-tps-and-gas-model.md)
and [`chain-resources/consensus-and-execution.md`](chain-resources/consensus-and-execution.md) open question 1.

**Foundry.** A Rust-based Solidity toolchain (`forge` to build/test, `forge create` to deploy, `forge verify-contract`
to verify). Somnia documents it as a first-class deploy path; the "hello world" is `forge init` → `forge build` →
`forge create --rpc-url <…> --private-key <…> src/C.sol:C`
([Foundry](https://docs.somnia.network/developer/development-frameworks/deploy-with-foundry.md), re-verified live
2026-05-23 — the `init`/`build`/`create` sequence is verbatim, e.g. `forge create --rpc-url
https://dream-rpc.somnia.network --private-key PRIVATE_KEY src/BallotVoting.sol:BallotVoting`). ⚠️ **Citation scope
corrected 2026-05-23:** this deploy page documents **only** `init`/`build`/`create` — `forge verify-contract` is **not
on it**; verification is documented on the separate verify guide (see the [Blockscout](#b) entry's `forge
verify-contract --verifier blockscout` flags), so the parenthetical's "verify" leg is general Foundry knowledge, not a
claim of this page. The page's RPC is the **stale `dream-rpc.somnia.network`** string flagged folder-wide — use the
canonical `api.infra.testnet` endpoint. *V1:* one candidate
harness for `ClaimSettlement.sol` and its tests. See [`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

**Forking (local fork).** Copying a live network's state at a chosen block onto a local node ([Anvil](#a) via
`--fork-url`, or `npx hardhat node --fork`), so your contract can interact with *already-deployed* contracts "using
real-world data, but without any of the risk or cost"
([local-testing guide](https://docs.somnia.network/developer/development-frameworks/local-testing-and-forking.md)).
*For the AI engineer:* like running tests against a snapshot of production rather than a stub. Pin the fork block
(`FORK_BLOCK_*`) for reproducible CI; cheatcodes `hardhat_impersonateAccount`, `evm_snapshot`/`evm_revert`, and
`evm_setNextBlockTimestamp` manipulate the forked state. A fork copies **on-chain state only** (hashes, addresses,
balances, code) — so it carries no PHI, because none is on-chain. *V1:* lets `ClaimSettlement.sol` tests hit the real
[DIA](#o) price feed and impersonate agent addresses without funding EOAs. See
[`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

## G

**Gas.** The unit metering computation/storage; you pay `gas × gas price` in the native token (price set in
**nanoSomi**, the [SOMI](#s) analogue of gwei). Transactions are **EIP-1559-shaped**: the JSON-RPC API exposes
`eth_maxPriorityFeePerGas`, `eth_feeHistory`, and a per-block `baseFeePerGas`, with type-`0x2` transactions
([JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md)) — so read the base fee live rather than
hard-coding a flat `gasPrice`. ⚠️ But the base fee is **not** moved by EIP-1559's demand formula: validators "vote to
double the base fee" when a block takes >95 ms to execute and "halve it" when faster, "every second (10 blocks)," and
**50% of every fee is burnt** ([tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md)). ⚠️ Somnia **re-priced the EVM schedule** — it "adjusted gas costs
upward for operations that haven't [gotten cheaper]," so an Ethereum estimate is *not* a Somnia estimate. The
divergences that hit us hardest: **logs ≈ 8–13× higher** (`3200 + 5120 * topic_count + 160 * size`), **deployment
`3,125` gas/byte vs Ethereum's `200`**, and uncached storage reads carrying a `+1,000,000` gas tail (a read stays at the
`100` base only if its slot is in **"the set of most recently accessed 128 million contract slot keys"** — a property of
[IceDB](#i))
([gas differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md), re-verified 2026-05-23).
*V1:* drives our per-claim cost model for anchoring hashes and emitting audit events (and, if used, native inference) —
budget against the Somnia schedule, not Ethereum. Detailed in [`chain-resources/tokenomics-and-gas.md`](chain-resources/tokenomics-and-gas.md).

**Governance (SOMI).** The third documented role of the [SOMI](#s) token: holders steer network decisions by vote.
"Proposals can be created by any token owner. They are then approved by a majority vote of other token holders," cast
through a **token house** of holders (alongside a validator council, developer council, user assembly, and foundation
board) ([tokens governance](https://docs.somnia.network/concepts/tokenomics/tokens-governance.md); re-verified live
2026-05-23 — the proposal-creation/approval quote and the "still in it's early phases" quote (the `it's` grammar quirk
preserved) are both **un-drifted verbatim**). ⚠️ It is **phased in, not live in full**: upstream names three phases —
**Bootstrap** (`0–6 months post-mainnet`, "Foundation board in control"), **Transition** (`6–24 months`, "Introduction of
all governance groups. Beginning of proposal process"), and **Mature** (`Year 2 onward`, "Control is delegated to relevant
groups for different decision making") — so the foundation board holds control until full delegation arrives only in the
Mature phase (an authorial reading of the per-phase labels, *not* a verbatim single-phase quote; upstream's "Foundation
board in control" wording is the **Bootstrap** row, while the Transition row reads "Beginning of proposal process"). *V1:*
off the agent loop (Curie never votes), but it sharpens the trust caveat — the substrate is *progressively*, not yet
fully, decentralised (the same honesty as [Cuthbert](#c) / the
[trust model](chain-resources/consensus-and-execution.md)). Detailed in
[`chain-resources/tokenomics-and-gas.md`](chain-resources/tokenomics-and-gas.md).

**GraphQL.** The query language a [subgraph](#s) exposes — you ask for exactly the fields you want, ordered/filtered/
paginated, instead of scanning raw logs. Deploying an Ormi subgraph "will return a GraphQL endpoint where you can begin
querying" ([Ormi guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph.md)).
A UI reads that endpoint two documented ways — a raw `fetch` of a `{ query }` body through a server-side proxy route, or
`@apollo/client` (`ApolloClient`/`gql`/`useQuery`) — both at the `proxy.somnia.chain.love/subgraphs/name/…` host
([subgraph UIs — Next.js fetch](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-nextjs-fetch.md),
[Apollo Client](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-apollo-client.md);
all three source pages re-verified live 2026-05-23 — the Ormi "will return a GraphQL endpoint where you can begin
querying" quote, the Apollo `ApolloClient`/`gql`/`useQuery` imports + `proxy.somnia.chain.love/subgraphs/name/…` host, and
the Next.js `fetch` of a `{ query }` body through the `app/api/proxy/route.ts` `Client-ID` proxy all un-drifted verbatim).
*V1:* the UI audit timeline queries it for the ordered claim history — by [polling](#p), not subscription.

## H

**Hardhat.** A TypeScript-based Ethereum dev environment. Somnia's guide scaffolds a "TypeScript Project (with Viem),"
pins Solidity `0.8.28`, deploys via **Hardhat Ignition** (`npx hardhat ignition deploy ./ignition/modules/deploy.ts
--network somnia`), and verifies with the **Hardhat Verify plugin** (`npx hardhat verify --network somnia
DEPLOYED_CONTRACT_ADDRESS …`) against the Blockscout explorer
([Hardhat](https://docs.somnia.network/developer/development-frameworks/deploy-with-hardhat.md), re-verified live
2026-05-23). ⚠️ **Fine-wording corrected 2026-05-23:** the config's literal import is
`import "@nomicfoundation/hardhat-toolbox";` (the toolbox **bundles** Hardhat Verify); the prior wording named the
standalone `@nomicfoundation/hardhat-verify` package, which the page does **not** import — upstream calls it only "the
Hardhat Verify plugin." The page's `customChains` entry (`chainId: 50312`,
`apiURL: https://shannon-explorer.somnia.network/api`) is a [Chain ID](#c) corroborator; its body RPC is the **stale
`dream-rpc.somnia.network`** string. *V1:* the
Hardhat-with-viem scaffold matches this repo's TypeScript-only rule. See
[`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

## I

**IceDB.** Somnia's custom storage engine, "built from the ground up to have fully deterministic performance" — every
operation emits a performance report of exactly how many cold cache lines and disk pages it touched, so gas can be
charged on "the actual load they put on the system" rather than worst-case; averages **15-100 ns** per read/write with
native LSM-tree snapshotting ([concept](https://docs.somnia.network/concepts/somnia-blockchain/somnias-icedb.md),
re-verified live 2026-05-23 — *"built from the ground up to have fully deterministic performance"*, the per-op
*"performance report"*, *"charge the user based on the actual load they put on the system"*, and *"average read/writes
of IceDB to be between 15-100 nanoseconds"* all un-drifted verbatim; "LSM-tree" is the standard expansion of upstream's
*"log structured merge tree"* and the snapshots are the Merkle-tree-free *"first class state snapshots"* form — both
authorial glosses, not quotes).
Background, not something we call directly — but its deterministic gas is what makes a per-claim cost model estimable.
See [`chain-resources/consensus-and-execution.md`](chain-resources/consensus-and-execution.md).

**Injected provider (MetaMask).** A browser wallet (MetaMask) that "injects" an Ethereum provider into the page so a
dApp — or an in-browser IDE like [Remix](#r) — can request signatures and broadcasts through it. In Remix's deploy panel
it is the **"Injected Provider - MetaMask"** Environment option; the deploy transaction is whatever network MetaMask is
currently pointed at, and **the human must click "approve" in the wallet popup**
([Remix guide](https://docs.somnia.network/developer/development-frameworks/deploy-with-remixide.md)). *V1 relevance:*
the manual-approval step is precisely why this path doesn't fit Curie's **headless** agents — they sign from a key in
`.env`, with no browser to pop. See [`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md) and
[account abstraction](chain-resources/account-abstraction.md) (open question 4).

**`inferString` / `inferNumber` / `inferChat` / `inferToolsChat`.** The four entry points of the native LLM Inference
agent — single-turn text, bounded integer, multi-turn chat, and tool-using chat (incl. MCP servers + on-chain tools)
respectively ([LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference.md), re-verified live
2026-05-23 — upstream's definitions un-drifted: `inferString` "Simple single-turn inference," `inferNumber`
"extracts an integer from the model's response, clamped to a specified range," `inferChat` "Multi-turn conversational
inference with full message history," and `inferToolsChat` calls "tools provided by MCP servers… and on-chain tools").
Detailed in [`chain-resources/native-agents.md`](chain-resources/native-agents.md).

## J

**JSON API Request (base agent).** One of Somnia's three native [base agents](#a) — "fetches JSON data from any public
API endpoint and extracts specific values using a selector path… the fundamental building block for creating on-chain
oracles." Six typed fetchers (`fetchString`, `fetchBool`, `fetchUint`, `fetchInt`, `fetchStringArray`,
`fetchUintArray`) take a URL and a dot-notation `selector` (e.g. `data.price`); the integer variants scale by a
`decimals` arg (`10^decimals`) ([JSON API Request](https://docs.somnia.network/agents/base-agents/json-api-request.md),
re-verified live 2026-05-23 — both quoted sentences ("Fetches JSON data from any public API endpoint and extracts
specific values using a selector path"; "the fundamental building block for creating on-chain oracles"), all six fetcher
names, the `data.price` selector example, and the "value is multiplied by 10^decimals" scaling all un-drifted).
Priced at **`0.03` SOMI/agent** ([gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)). *V1:*
could pull a payer's **public** coverage-policy API on-chain with a consensus receipt — public data only, so PHI-safe.
See [`chain-resources/native-agents.md`](chain-resources/native-agents.md).

## K

**Key rotation.** Replacing a signing or API key on a schedule (or after suspected exposure) so that a leaked key has a
bounded useful life. Somnia's [node/infra security](https://docs.somnia.network/developer/security/node-infra-security.md)
page recommends a **regular rotation schedule** and its example rotates every **90 days**. Standard operational security,
not Somnia-specific. *V1:* the provider/payer agents' signing keys live in `.env` / a [secrets manager](#s) and are
rotated on a schedule — part of the `security-auditor`'s signing-key-hygiene gate. See
[`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

## L

**Layer 1 (L1).** A standalone base blockchain that settles its own transactions (vs. a Layer 2 that batches onto an
L1) — the standard classification for a chain like Somnia, which runs its own consensus, execution, and storage. ⚠️
*Mis-citation corrected 2026-05-23:* the prior entry attributed "Somnia is an L1" to the
[overview](https://docs.somnia.network/concepts/somnia-blockchain/overview.md) page, but two independent live re-fetches
confirm that page **never uses** the literal phrase "Layer 1" or "L1" — it frames Somnia only as *"the Somnia
blockchain"* set against *"other EVM chains."* The [get-started-for-mainnet](https://docs.somnia.network/get-started/getting-started-for-mainnet.md)
page (re-fetched the same run) likewise carries no "L1" label. So "Layer 1" is the standard term for Somnia's
standalone-EVM-base-chain architecture (an authorial classification, true by the definition above), **not** an
upstream-published label on the cited page; the README's *"EVM-compatible Layer 1"* framing is this folder's own wording.
See [`chain-resources/consensus-and-execution.md`](chain-resources/consensus-and-execution.md).

**LLM Parse Website (base agent).** The third native [base agent](#a) — "search a domain (or directly scrape a URL) and
extract structured data using AI" via "a real web browser," for "on-chain callers that need trustless, auditable web
extraction." Two extractors, `ExtractString(...) → string` and `ExtractANumber(...) → uint256`; with `resolveUrl =
false` it scrapes the URL directly and caps `numPages` at 1, and `ExtractANumber` clamps negatives to 0. The model's
reasoning, an answerability flag, and a confidence score are kept out of the ABI return but recorded in the
[receipt](#r) ([LLM Parse Website](https://docs.somnia.network/agents/base-agents/llm-parse-website.md), re-verified
live 2026-05-23 — "search a domain (or directly scrape a URL) and extract structured data using AI," "a real web
browser," "on-chain callers that need trustless, auditable web extraction," the `ExtractString`→`string` /
`ExtractANumber`→`uint256` outputs, the "negative values are clamped to 0" note, and "These fields are not returned in
the ABI output, but they are included in the receipt for auditability" all un-drifted; the entry's "`resolveUrl =
false`… scrapes the URL directly" faithfully renders upstream's "Search domain vs. scrape direct URLs" toggle, whose
"off" side is where upstream says "if resolveUrl is off, value is capped at 1" for `numPages`). Priced at
**`0.10` SOMI/agent** — the most expensive base agent
([gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)). *V1:* could extract structured fields
from a payer's **public** policy webpage as adjudication evidence. See
[`chain-resources/native-agents.md`](chain-resources/native-agents.md).

## M

**MultiStream Consensus.** Somnia's consensus design (inspired by the 2024 "Autobahn: Seamless high speed BFT"
whitepaper) that "completely decouples the production and distribution of new data … with the consensus algorithm":
each validator appends to its own unvalidated **data chain**, while a separate **consensus chain** (a "modified PBFT
consensus algorithm") tracks the tip of every data chain and "provides full security against validators forking their
own data chain." A "deterministic pseudorandom ordering of these data chains then provides a single globally ordered
stream of bytes to be executed" — this is the source of global transaction ordering on Somnia
([concept](https://docs.somnia.network/concepts/somnia-blockchain/multistream-consensus.md), re-verified live
2026-05-23 — the "completely decouples the production and distribution of new data … with the consensus algorithm" /
"provides full security against validators forking their own data chain" / "deterministic pseudorandom ordering …
single globally ordered stream of bytes to be executed" quotes all un-drifted). ⚠️ **Mis-attribution corrected:** the
prior opening quote "decouples data production from the consensus process" is the **overview** page's
four-innovations-table wording, *not* this dedicated page's — corrected here to this page's verbatim, matching the
attribution already used in [`chain-resources/consensus-and-execution.md`](chain-resources/consensus-and-execution.md).
See [`chain-resources/consensus-and-execution.md`](chain-resources/consensus-and-execution.md).

**Multicall3.** A standard helper contract that batches many read calls into one RPC round-trip. Deployed on Somnia at
mainnet `0x5e44F178E8cF9B2F5409B6f18ce936aB817C5a11` and testnet (Shannon) `0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223`
([network-info](https://docs.somnia.network/developer/network-info.md), both addresses re-verified live verbatim
2026-05-23 — mainnet `0x5e44F178E8cF9B2F5409B6f18ce936aB817C5a11` and testnet (Shannon)
`0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223` un-drifted; same canonical page, which still corroborates testnet chain ID
`50312` and the `api.infra.testnet.somnia.network` RPC).

**Multisig (Safe).** A wallet that requires *m-of-n* signatures to act, instead of a single key — the standard way to
hold privileged contract roles. Somnia's [go-live checklist](https://docs.somnia.network/developer/deployment-and-production/go-live-checklist.md)
says to "use multisig wallets (Safe) for critical roles (owner, pauser, upgrader)" and to leave no test keys in
allowlists. Standard EVM practice. *V1:* gates any admin role on `ClaimSettlement.sol` for the demo and beyond. See
[`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

## O

**Ormi.** One of two [subgraph](#s) providers Somnia documents (the other is Protofire). "The only unified Web3 data
layer to supercharge live, historical, and AI-powered blockchain data applications"; subgraphs are created at
`https://subgraph.somnia.network/` using the standard The Graph CLI
([ecosystem: subgraphs](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/subgraphs.md),
re-verified live 2026-05-23 — the "only unified Web3 data layer…" tagline, the `subgraph.somnia.network` URL, and the
**Ormi + Protofire** two-provider roster all un-drifted verbatim).
*V1:* candidate for indexing `ClaimSettlement.sol` events into the audit timeline.

**Oracle.** A contract that brings off-chain data on-chain in a verifiable way. Two trust models: **push** — a trusted
updater writes values into storage on a schedule and you read them with a cheap `view` call (DIA "continuously
fetch[es] and push[es] asset prices… using an `oracleUpdater`," on a 0.5% deviation / 120 s / 24 h-heartbeat cadence);
and **pull / request–response** — you request a value and a callback delivers it in a later transaction (VRF). Somnia
documents **DIA** and **Protofire price feeds** (SOMI, BTC, **WETH**, USDC, USDT, ARB, SOL — all USD-denominated; note the
ETH feed is the wrapped `WETH` token, not bare `ETH`)
([oracles](https://docs.somnia.network/developer/building-dapps/oracles.md),
[DIA](https://docs.somnia.network/developer/building-dapps/oracles/dia-price-feeds.md)) — and its curated
[ecosystem listing](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/oracles.md)
names **exactly those two** (both source pages re-fetched and re-verified live 2026-05-23 — the ecosystem listing still
names **exactly DIA + Protofire**, and the DIA page's *"continuously fetch and push asset prices on-chain"* `oracleUpdater`
line plus the **0.5 % deviation / 120 s / 24 h-heartbeat** cadence are un-drifted verbatim, the substrate values that feed
V1 settlement pricing; the live DIA roster also corrects the bare "ETH" gloss above to wrapped **WETH**), Protofire being the Chainlink-`AggregatorV3Interface`-compatible
redeployment over the same data sources; the native **JSON API Request** agent is itself a programmable oracle. *V1:* SOMI↔USD pricing for settlement amounts. Detailed in
[`chain-resources/oracles-and-vrf.md`](chain-resources/oracles-and-vrf.md).

**Oracle snapshotting (snapshot bot).** Turning an [oracle](#o) read — which is *ephemeral*, a `view` of the price
*now* — into a **persisted, verifiable record** by having an off-chain bot read the feed and write the reading into a
[Data Stream](#d). Somnia's [*Integrate Chainlink Oracles* tutorial](https://docs.somnia.network/developer/data-streams/tutorials/integrate-chainlink-oracles.md)
documents the pattern: read Chainlink's `latestRoundData()`, then `sdk.streams.set()` a `{timestamp, price, roundId, pair}`
record, using the oracle's own `roundId` as part of the [Data ID](#d) to **dedupe** re-runs. The bot's
[publisher](#p) address *is* the attestation — readers trust the price because they can see who wrote it. Pull-based and
manual (a bot loop), not [event-driven](#r). *V1:* the way to make the SOMI/USD **settlement rate itself auditable** —
a publisher-attested price record beside the claim, still PHI-free. See
[`chain-resources/oracles-and-vrf.md`](chain-resources/oracles-and-vrf.md).

## P

**Paymaster.** In ERC-4337 [account abstraction](#a), a sponsor contract that pays a transaction's gas on the user's
behalf — the mechanism behind "gasless transactions"
([account abstraction](https://docs.somnia.network/developer/building-dapps/account-abstraction.md), re-verified live
2026-05-23 — the bullet "Enable sponsored and gasless transactions" un-drifted; the Thirdweb-tutorial and Pimlico
halves below cite *other* pages, re-verified at the article level but not re-fetched this run). No *standalone*
Somnia paymaster address is published, but the managed path is documented: the
[gasless-with-Thirdweb tutorial](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md)
(2026-05-21) sponsors gas via `sponsorGas: true` through **Thirdweb's hosted paymaster**, configured in the Thirdweb
dashboard rather than as an on-chain address you deploy. The
[ecosystem: account-abstraction](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/account-abstraction.md)
page (2026-05-22) also names **Pimlico** as an ERC-4337 "infrastructure platform" — a provider-neutral paymaster reached
via a direct RPC endpoint, the path a headless server-side signer would use. Pimlico's
[supported-chains list](https://docs.pimlico.io/guides/supported-chains) **confirms** a Somnia endpoint (2026-05-22):
Somnia Testnet `50312` / Mainnet `5031`, EntryPoint v0.6/v0.7 (v0.8 **unsupported**) — closing the headless-path
question for the documented-path test. _(Thirdweb-tutorial + Pimlico halves re-fetched and re-verified live 2026-05-23:
`sponsorGas: true` and the Pimlico "infrastructure platform" naming un-drifted verbatim.)_ See
[`chain-resources/account-abstraction.md`](chain-resources/account-abstraction.md).

**Payable function / native value transfer (`payable`, `msg.value`, `receive()`).** *For the blockchain dev:* the EVM's
built-in machinery for moving the **native coin** — a function marked `payable` can receive coin (its amount readable as
`msg.value`), a `receive() external payable` function accepts a bare transfer with no calldata, and `.transfer()` sends
coin out. *For the AI engineer:* this is "send money with the transaction" rather than a token-contract method call — no
ERC-20 ABI involved. On Somnia the native coin is **SOMI** (mainnet) / **STT** (testnet), which "is the native coin of
the Somnia Network, similar to ETH on Ethereum," so **"No ERC20 functions are needed"**
([using native SOMI/STT](https://docs.somnia.network/developer/building-dapps/tokens-and-nfts/using-native-somi-stt.md),
re-verified live 2026-05-23 — *"SOMI is the native coin of the Somnia Network, similar to ETH on Ethereum"* and
*"No ERC20 functions are needed"* both un-drifted verbatim; the page still renders `msg.value`, `receive() external
payable`, and `payable(owner).transfer(address(this).balance)` in its examples). *V1:* the mechanism by which a payer
agent's settlement deposit reaches `ClaimSettlement.sol` and is
released to the provider — but the **release** path wraps these primitives in the *[pull-payment](#p)* +
*[reentrancy guard](#r)* pattern, **not** the intro page's naive `.transfer()` push (that page carries no security
commentary). See [`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md) → *Moving native value*.

**Polling (vs. subscription).** Re-running a read on a fixed interval to detect change, as opposed to a *subscription*
that pushes the change to you. The distinction matters on Somnia because **every documented UI read-path is polling**:
the Apollo subgraph guide refreshes with `useQuery(…, { pollInterval: 5000 })`, the `fetch` subgraph guide refreshes
only on mount, and all three [Data Streams](#d) worked UIs re-`fetch` "every few seconds"
([subgraph UIs — Apollo Client](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-apollo-client.md);
re-verified live 2026-05-23 — upstream renders `pollInterval: 5000, // Refresh every 5 seconds`, and the
[Next.js fetch guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-nextjs-fetch.md)
confirms the no-poll path: it fetches in a `useEffect()` with an **empty dependency array**, i.e. on mount only).
The **only** documented true push surface is the WebSocket log listener (`eth_subscribe` / ethers `WebSocketProvider`),
which is [Reactivity](#r)'s off-chain mode and indexing [Path 2](chain-resources/indexing-subgraphs.md). *V1:* the audit
timeline polls the subgraph for the authoritative ordered view; the WebSocket listener supplies the live "something just
happened" nudge. See [`chain-resources/indexing-subgraphs.md`](chain-resources/indexing-subgraphs.md).

**Publisher (Data Streams).** The "signer that writes data" under a schema — "EOA or Smart Contract that writes data
under a schema" ([what is it](https://docs.somnia.network/developer/data-streams/what-is-somnia-data-streams.md),
re-verified live 2026-05-23 — the page's "Definition of Terms" table reads "The signer that writes data. EOA or Smart
Contract that writes data under a schema."; both quoted fragments un-drifted). Every
record is bound to the publisher's address, which is the source of free, verifiable provenance: writes land in a
`msg.sender`-keyed storage slot (`mapping(bytes32 => mapping(address => mapping(bytes32 => bytes)))`), so it is
"**impossible** for `0xPublisher_A` … [to] write data into the slot for `0xPublisher_B`. They cannot fake their
`msg.sender`"
([provenance & verification](https://docs.somnia.network/developer/data-streams/concepts/data-provenance-and-verification-in-streams.md);
the "impossible … cannot fake their `msg.sender`" quote was re-verified live 2026-05-23 in the concept-cluster pass — so
both source pages behind this entry now carry a 2026-05-23 re-verification date).
*V1:* the provider and payer agent addresses become the publishers of the negotiation record, so "who said what" is
cryptographic — see *[Shared stream (multi-publisher)](#s)* in section S, and the opposite-direction
*[Publisher-proxy pattern](#p)* below.

**Publisher-proxy pattern (Data Streams).** A scaling pattern where one DApp contract publishes **on behalf of** many
authors into a single publisher slot, so a reader does one query instead of one-per-author (reading per-publisher "is
not scalable, fast, or efficient" at large fan-out — the upstream example needs "10,000 separate read calls"). The
catch: "To the Streams contract, the **only publisher** is your DApp Contract's address" — and "Since the `msg.sender`
to the Streams contract will always be our *proxy contract*, we lose the built-in provenance. We must re-create it by
adding the original [author's] address to the schema itself"
([proxy pattern](https://docs.somnia.network/developer/data-streams/tutorials/the-dapp-publisher-proxy-pattern.md),
re-verified live 2026-05-23 — the "not scalable, fast, or efficient" + "10,000 separate read calls" + "only publisher …
your DApp Contract's address" quotes all un-drifted, and the `msg.sender`-causal clause, previously bridged by an
authorial "so you," promoted to upstream verbatim so the entry quotes the cause, not a re-derivation). I.e.
author identity demotes from an unspoofable `msg.sender` key to an ordinary, proxy-set data field — trading the
cryptographic guarantee of *[Publisher](#p)* for a trusted intermediary. *V1:* the design fork between agents
self-signing their writes vs. a Curie service contract publishing for them (the latter pairs with gasless
[account abstraction](#a)) — see [`chain-resources/data-streams.md`](chain-resources/data-streams.md) open question #4.

**Pull payment (pull-over-push).** The pattern where a contract records *what it owes* and the recipient later
**withdraws** it, instead of the contract **pushing** funds out with an external call inside its own logic. Somnia's
[security 101](https://docs.somnia.network/developer/security/smart-contract-security-101.md) page frames it as "users
withdraw instead of push" (re-verified live 2026-05-23 — upstream verbatim *"Pull Payment: Users withdraw instead of
push"*) — it shrinks the reentrancy surface (the external call moves out of the state-changing path)
and stops one reverting recipient from blocking everyone else. Standard EVM practice, not Somnia-specific. *V1:* the
settlement contract credits the owed agent, who withdraws — so [`ClaimSettlement.sol`](../../ROADMAP.md) never makes a
re-enterable push during the negotiation lifecycle. See
[`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md) and [reentrancy guard](#r).

## R

**Reactivity.** Somnia's "respond to on-chain events without polling" system, in two modes
([overview](https://docs.somnia.network/developer/reactivity.md)): **on-chain** — a contract reacts in the same block,
with the subscription "stored… in chain state" and paid for in SOMI (a funded owner, ≥32 SOMI); and **off-chain** — a
WebSocket subscription served by the node API that "does not cost SOMI" and "disappears when the client disconnects"
([on-chain](https://docs.somnia.network/developer/reactivity/reactivity-onchain.md),
[off-chain](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md)). Includes filtered subscriptions
and [cron](#c). Detailed in [`chain-resources/reactivity.md`](chain-resources/reactivity.md). *V1:* the wake mechanism
for sequential agent steps — off-chain by default (UI + agent backend), on-chain/cron only for autonomous timeouts.
(All three source pages re-verified live 2026-05-23 — the quotes hold, with two faithful elisions noted: upstream's
overview reads "respond to on-chain events **without running a polling loop**" and the off-chain page reads "disappears
when the client disconnects **or unsubscribes**"; the on-chain page now also sharpens that the `32 SOMI` "is **not** an
escrow and **not** consumed. It sits in the owner's regular balance," gas being charged per handler invocation.)

**Reactive transaction (synthetic transaction).** The transaction the chain itself inserts to run an on-chain
[Reactivity](#r) handler. When a committed log matches an active subscription, "validators include a **synthetic
transaction** that calls the handler"; that handler "runs in a separate **reactive transaction** after the triggering
transaction has executed"
([on-chain tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md)).
So the reaction is *not* atomic with the trigger — it is a guaranteed follow-up tx, paid for by the subscription owner.
The litepaper reconciles this with latency: the synthetic tx is nonetheless **"included in the same block"** as the
trigger and is **"Fully MEV-resistant due to deterministic inclusion of event handlers"**
([litepaper: on-chain reactivity](https://docs.somnia.network/concepts/somnia-blockchain/on-chain-reactivity.md)) — so
"not atomic" is about *ordering* (a distinct tx, running after) while "same block" is about *latency* (no next-block
wait), and the deterministic insertion means the reaction cannot be front-run or reordered. This is why a handler that
emits an event matching its own filter creates a feedback loop. (All four quotes above re-verified live 2026-05-23:
"validators include a synthetic transaction that calls the handler," "runs in a separate reactive transaction after the
triggering transaction has executed," "Reaction included in the same block," and "Fully MEV-resistant due to
deterministic inclusion of event handlers" all un-drifted; the tutorial also confirms "The owner pays for every handler
invocation.") ⚠️ **Drift flagged for human review (2026-05-23):** the availability caveat this entry previously carried —
*"Somnia Reactivity is currently only available on TESTNET,"* recorded from a live 2026-05-22 fetch of the litepaper
[on-chain reactivity](https://docs.somnia.network/concepts/somnia-blockchain/on-chain-reactivity.md) page — is **no
longer present** on that page (re-fetched twice 2026-05-23) and does not appear on the reactivity
[overview](https://docs.somnia.network/developer/reactivity.md),
[on-chain reference](https://docs.somnia.network/developer/reactivity/reactivity-onchain.md), or
[on-chain tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md)
either. Upstream stopped publishing the testnet-only restriction; this is **not** positive confirmation that on-chain
reactivity is now live on mainnet — only that the restriction is no longer documented, so the *mainnet* dependence
question stays open for human verification before any mainnet on-chain-reactivity/cron path is relied on. **Stability
re-check (2026-05-23, independent fetch):** an additional separate-session fetch of the same page confirms the
testnet-only sentence is still absent while the *"included in the same block"* and *"Fully MEV-resistant…"* quotes still
render verbatim — so the removal is a genuine upstream edit holding across fetches, not a one-time soft-404; conclusion
unchanged. Detailed in [`chain-resources/reactivity.md`](chain-resources/reactivity.md).

**`realtime_sendRawTransaction`.** A Somnia-specific JSON-RPC method (one of several `somnia_`/`realtime_`-prefixed
extensions beyond the standard `eth_*` set) that submits a signed transaction and **waits for the receipt before
returning**, collapsing the usual `eth_sendRawTransaction` → poll-`eth_getTransactionReceipt` loop into one round-trip
([JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md); method name verbatim, behaviour summarised).
Sibling extensions on the same page include `somnia_reactivityGetSubscriptions` (RPC reads of on-chain
[Reactivity](#r) subscriptions) and `somnia_getSessionAddress` / `somnia_sendSessionTransaction` (session-key ops, the
RPC layer beneath [account abstraction](#a)). ⚠️ The page also notes `eth_subscribe` does **not** support
`newPendingTransactions` and **EIP-4844 blob** (type `0x3`) transactions are unsupported. *V1:* a latency lever for the
sequential agent loop — submit a negotiation/settlement tx and get the receipt in one call so the next agent turn can
begin without a poll interval; whether to adopt it (vs. portable `eth_*` tooling) is an open question, since it ties
submission code to Somnia. Detailed in [`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

**Receipt (agent).** A "detailed log of each step the agent took during execution" for a native-agent run — like a CI
build log — produced "to provide transparency and auditability"
([receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md)). It is a `steps` array (step types include
`llm_request`, `llm_response`, `reasoning`, `http_request`, `value_extracted`, …) plus a final `result`. The trust
boundary: **only the final result is consensus-bound** — "the execution steps are subjective and may vary slightly
between nodes," so "different nodes may have different receipts… but still agree on the result"
([receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md)). On-chain, a `Response` carries only a
`uint256 receipt` *reference*; the body is fetched off-chain by `requestId` from
`receipts.{mainnet,testnet}.agents.somnia.host`, which upstream notes is **"currently stored on centralized
infrastructure"** pending a planned migration to decentralized storage
([receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md)). *V1:* the audit "why" Curie wants is this
off-chain, centralized artifact — and because its steps log prompts/reasoning, it carries the same no-PHI rule as the
chain. Detailed in [`chain-resources/native-agents.md`](chain-resources/native-agents.md).

**Reentrancy guard.** A mutex that blocks a function from being re-entered before it finishes: a `_status` flag flipped
`_NOT_ENTERED → _ENTERED` on entry and back on exit, so a malicious external callee can't loop back in mid-execution.
Somnia's [security 101](https://docs.somnia.network/developer/security/smart-contract-security-101.md) page recommends
OpenZeppelin's "battle-tested" `ReentrancyGuard` over a hand-rolled one, alongside (not instead of) the
[Checks-Effects-Interactions](#c) ordering and the [pull-payment model](#p) (re-verified live 2026-05-23 — upstream
verbatim *"OpenZeppelin ReentrancyGuard: Battle-tested implementation"*, framed as *"Double protection: both CEI and
guard prevent recursive drains"*). Standard EVM defence, not Somnia-specific.
*V1:* guards the `ClaimSettlement.sol` fund-release path. See
[`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

**Remix IDE.** A browser-based Solidity IDE: compile and deploy a contract from a web page, signing through an
[injected MetaMask provider](#i). Somnia documents it as one deploy path
([deploy-with-remixide](https://docs.somnia.network/developer/development-frameworks/deploy-with-remixide.md)); the
[security 101](https://docs.somnia.network/developer/security/smart-contract-security-101.md) page also recommends it
(or a local fork) as the *safe* place to practise exploits — "NOT … with real funds on mainnet." *V1:* a human-only,
manual-approval path — useful for one-off experiments, **not** the unattended Foundry/Hardhat CI deploy our headless
agents use. See [`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

**Responsible disclosure.** The convention for reporting a security flaw you find in *someone else's* system: tell the
maintainer **privately** through a named channel and give them time to fix it, rather than publishing the exploit. It is
the fourth of Somnia's four security layers (the other three harden your own code and keys). Somnia's
[responsible-disclosure policy](https://docs.somnia.network/developer/security/responsible-disclosure-policy.md) names the
channels (`developers@somnia.network`, a Discord "Bug Reports" ticket, listed Telegram contacts), a *"reply within 24
hours"* acknowledgement target, and a safe-harbour line — good-faith researchers *"will not face any penalties and will
be publicly recognized"* — but **no live bounty yet**. Its rules: never exploit on Mainnet, never disrupt RPC endpoints,
never phish, and *"always test exploits or stress scenarios on Shannon Testnet."* *V1:* the testnet-only rule mirrors our
[fork-first](#f) discipline, and the policy is the template for Curie's own disclosure posture — a bug report must carry
synthetic IDs and hashes, never a real medical note (the [no-PHI](#k) rule reaches into bug reports too). See
[`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

**RPC (Remote Procedure Call) endpoint.** The HTTP/WebSocket URL your client talks to in order to read state or
broadcast transactions. Somnia's canonical, chain-operated endpoints are in the
[network table](README.md#the-chain-in-one-screen). Upstream also lists **third-party RPC providers** — Ankr, Public
Node, Stakely, and Validation Cloud (the last advertising a "scale tier that never imposes rate limits")
([ecosystem: RPC](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/rpc.md));
no provider is named the default. *AI engineer's framing:* the RPC endpoint is the one shared resource every agent
process and the live UI listener contend for, so it is the first thing to hit a rate limit under burst load — swapping
to a provider with a higher quota is a one-line `--rpc-url` / transport change.
See [`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

## S

**Slither (and Mythril / Solhint).** The static-analysis tools Somnia's
[audit checklist](https://docs.somnia.network/developer/security/audit-checklist.md) makes **mandatory** before
deployment: **Slither** (vulnerability + optimisation detection), **Mythril** (symbolic execution), **Solhint** (style /
best-practice linting). Upstream rule: **High/Critical findings block deployment**; Medium/Low must be documented or
justified (re-verified live 2026-05-23 — upstream: a High/Critical finding *"must be fixed immediately. The deployment
process cannot proceed until these are resolved and the tools run clean"*; a Medium/Low must be either *"Fixed"* or
*"Justified"* with a documented entry in a dedicated *"Audit Waivers"* log; the per-tool glosses above are accurate
paraphrases of upstream's *"Detects various security vulnerabilities … and code optimization issues"* / *"symbolic
execution"* / *"code style and security best practices"* descriptions). Standard EVM tooling, run off-chain in CI. *V1:* the citable rubric for this repo's `security-auditor` gate.
See [`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

**Session key.** A scoped, expiring signing key an [account-abstraction](#a) smart wallet authorises for limited
actions — a least-privilege, revocable credential rather than the account's root key; Somnia lists session keys as an
AA feature, to "enable **gasless transactions** and **session keys** for better UX"
([account abstraction](https://docs.somnia.network/developer/building-dapps/account-abstraction.md), re-verified live
2026-05-23 — ⚠️ quote corrected: this entry previously read "for improved user experience", which is **not** upstream's
wording; two live fetches confirm the page says "for better UX" — same paraphrase-passing-as-verbatim class as the
32-SOMI / events-quote tightenings). *V1:* an agent
could sign only claim-lifecycle contract calls with a narrow session key. See
[`chain-resources/account-abstraction.md`](chain-resources/account-abstraction.md).

**Secrets manager.** A dedicated service that stores and serves sensitive values (private keys, API keys) at runtime
instead of keeping them in a file on disk — so a leaked repo or host snapshot doesn't leak the secret. Somnia's
[node/infra security](https://docs.somnia.network/developer/security/node-infra-security.md) page names **AWS Secrets
Manager** as a production example, the step beyond an `.env` file (which suits development). Generic infrastructure, not
Somnia-specific. *V1:* the production-grade home for the agents' signing keys once they leave a developer's `.env`;
pairs with [key rotation](#k) under the `security-auditor` gate. See
[`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md).

**Schema / Schema ID.** In Data Streams, the typed shape of published data and its identifier. The Schema ID is
**content-addressed**: "derived from your schema using a hashing algorithm," so "if you change even one character in the
schema definition, the Schema ID will change," and it can be computed before any write with
`sdk.streams.computeSchemaId()`
([understanding schemas, IDs & publisher](https://docs.somnia.network/developer/data-streams/concepts/understanding-schemas-schema-ids-data-ids-and-publisher.md),
re-verified live 2026-05-23 — the "derived from your schema using a hashing algorithm" + "change even one character in
the schema definition, the Schema ID will change" quotes and the `computeSchemaId` name all un-drifted).
With a [publisher](#p) address and a [Data ID](#d), it forms the three-part key that addresses any stored record. To
evolve a shape without changing an existing ID, see **Schema extension** below. *V1:* the canonical Curie negotiation
schema's ID is fixed by its exact string; versioning is handled by extension, not migration — see
[`chain-resources/data-streams.md`](chain-resources/data-streams.md).

**Schema extension / parent schema.** The Data Streams mechanism for evolving a schema without breaking the
content-addressed [Schema ID](#s) of records already written: a schema **extends** a parent by naming a **parent schema
ID** (compute it with `computeSchemaId()`, pass it as the optional `parentSchemaId` on `registerDataSchemas()`; omit or
pass the zero value for a root schema). On read, the SDK resolves the chain recursively — "fetch … recursively fetch
parent schema until the end of the chain is reached," joins them comma-separated, then decodes — so a child *appends*
fields to its parent and **multiple versions coexist** under their own immutable IDs. "For maximum composability, all
schemas should be public" ([extending & composing schemas](https://docs.somnia.network/developer/data-streams/concepts/extending-and-composing-data-schemas.md),
re-verified live 2026-05-23 — the "recursively fetch parent schema until the end of the chain is reached" and "For
maximum composability, all schemas should be public" quotes plus the `parentSchemaId` / `registerDataSchemas()` /
`computeSchemaId` names all un-drifted; **"multiple versions coexist" remains an authorial gloss** — upstream
demonstrates a child schema that "append[s] an additional field" to a re-used parent, but does not state coexistence in
those words). *V1:* lets a v2 Curie negotiation schema add fields while v1 audit records stay decodable forever —
versioning becomes extension, not migration. See [`chain-resources/data-streams.md`](chain-resources/data-streams.md).

**`SchemaEncoder`.** The Data Streams helper class that converts between a [schema](#s)'s typed fields and the raw bytes
stored on-chain — it runs **both directions**: `new SchemaEncoder(schemaString)` then `.encodeData([{name, value, type}, …])`
produces the payload you `set()`, and `.decodeData(rawBytes)` turns a stored row back into typed values
([build your first schema](https://docs.somnia.network/developer/data-streams/tutorials/build-your-first-schema.md),
re-verified live 2026-05-23 — the `new SchemaEncoder(…)` → `.encodeData([{name, value, type}, …])` → `.decodeData(…)`
round-trip is un-drifted against upstream's concrete `new SchemaEncoder(chatSchema)` / `encoder.encodeData([…])` /
`encoder.decodeData(encodedData)`; the entry shows the API shape generically — `schemaString` / `rawBytes` are
placeholders, not verbatim upstream identifiers).
*For an AI engineer:* it is the (de)serialiser for the typed log — encode to write, decode to read. Note it is a
distinct class from the `sdk.streams.deserialiseRawData` helper. *V1:* `decodeData` is how a reader recovers typed
ICD-10/CPT code identifiers, claim state, hashes, and amounts from the audit timeline — a local, off-chain transform
(PHI rule unchanged). See [`chain-resources/data-streams.md`](chain-resources/data-streams.md).

**Subscriber (Data Streams).** A "reader that fetches all records for a `(schemaId, publisher)` pair"
([what is it](https://docs.somnia.network/developer/data-streams/what-is-somnia-data-streams.md), re-verified live
2026-05-23 — the "reader that fetches all records for a (schemaId, publisher) pair" quote un-drifted). Reads are scoped to
*which schema* and *which publisher* — so consuming the negotiation record means subscribing to each agent's writes.
The real-time variant is the SDK `subscribe` method (WebSocket). *V1:* the UI subscribes to negotiation events to build
the live audit timeline.

**Shared stream (multi-publisher).** A single Data Streams schema written by several publishers at once — the
architecture "decouples data schemas from publishers," letting "multiple different accounts (or devices) … publish data
using the **same schema**"
([multiple publishers](https://docs.somnia.network/developer/data-streams/tutorials/working-with-multiple-publishers-in-a-shared-stream.md),
re-verified live 2026-05-23 — the "decouples data schemas from publishers" + "multiple different accounts (or devices) …
publish data using the **same schema**" quotes and the `getAllPublisherDataForSchema` per-publisher read all un-drifted;
the page's stale `dream-rpc` RPC + chain ID `50312` are already logged at the article level).
Each record stays bound to its own [publisher](#p); a reader reconstructs the combined feed by calling
`getAllPublisherDataForSchema` once per publisher. *V1:* provider and payer share one negotiation schema, and the audit
timeline is the union of their two attributed publisher reads. See
[`chain-resources/data-streams.md`](chain-resources/data-streams.md).

**Shannon testnet.** The name of Somnia's public test network (chain ID `50312`, token `STT`). Where V1 is built and
demoed before any mainnet move.

**SOMI / STT.** The native gas/value token — **SOMI** on mainnet, **STT** (test token) on Shannon testnet
([SOMI coin](https://docs.somnia.network/developer/network-info/somi-coin.md)). Native-agent invocation is paid in these
([agents overview](https://docs.somnia.network/agents/readme.md)). Smallest unit is **Wei** (`1 SOMI = 1e18 Wei`); the
gwei-equivalent denomination is **nanoSomi** (`1e9 Wei`), which is how you express a gas price
([SOMI coin](https://docs.somnia.network/developer/network-info/somi-coin.md)). ✅ *Re-verified live 2026-05-23: the
SOMI-coin page renders the full denomination table — `Somi`=`1e18`, `milliSomi`=`1e15`, `microSomi`=`1e12`,
`nanoSomi`=`1e9`, `Wei`=`1` — with `gWei` listed as nanoSomi's Ethereum synonym, and "SOMI is the native coin of the
Somnia Network", all un-drifted verbatim. Honest scope note: this page documents **only SOMI** and names **no STT** — the
testnet-token (STT) facet is sourced from the [network-info](https://docs.somnia.network/developer/network-info.md)
connection table, not this page.*

**`sponsorGas`.** A boolean flag in Thirdweb's `SmartWalletOptions` / `inAppWallet({ smartAccount })` config that, when
`true`, makes a [smart account](#a)'s transactions **gasless** — the gas is paid by Thirdweb's hosted
[paymaster](#p)/[bundler](#b) rather than the account, credentialed by a Thirdweb client ID
([gasless-with-Thirdweb tutorial](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md),
2026-05-21). *For an AI engineer:* it is the one-line switch that turns "every agent must hold STT" into "agent
transactions are sponsored" — but it is documented only for the browser/`thirdweb/react` flow, so reaching it from a
headless [EOA](#e) signer is still open. _(Re-verified live 2026-05-23: the tutorial renders `sponsorGas: true` in both
the `accountAbstraction: SmartWalletOptions` and `inAppWallet({ smartAccount })` configs, with `FACTORY_ADDRESS`
`0x4be0…dceb` and the `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` prerequisite — all un-drifted; the canonical slug is still the
truncated `…-with-thirdw.md`.)_ See [`chain-resources/account-abstraction.md`](chain-resources/account-abstraction.md).

**Staking / delegation.** Under Somnia's [dPoS](#d) model, running a validator node requires SOMI to be **staked**;
holders who don't run a node can **delegate** their SOMI to Node Providers "to cover their staking costs"
([tokenomics](https://docs.somnia.network/concepts/tokenomics/overview.md)). Rewards are funded **from fees and treasury,
not new emission** — "They will be rewarded from gas fees and treasury-based incentives" and "50% of all gas fees are
distributed to validators as rewards," split by stake, with delegated stakers earning `epoch rewards × delegation rate ×
staking ratio` (upstream `epoch rewards * delegation rate * staking ratio`); delegation comes in a **validator-specific
pool** (28-day lock, 50% emergency-unstake penalty) or a **general pool** ("no locking period," spread across validators)
([staking & delegation](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md)). Not something
V1 touches directly — we are a dApp on the chain, not a validator — but it's why SOMI has value beyond gas, and why our
gas spend is half-burnt rather than recirculated. ✅ *Re-verified live 2026-05-23: the [tokenomics overview](https://docs.somnia.network/concepts/tokenomics/overview.md)'s "to cover their staking costs" and the [staking & delegation](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md) page's "50% of all gas fees are distributed to validators as rewards", `epoch rewards * delegation rate * staking ratio`, the 28-day lock, the 50% emergency-unstake penalty, and "no locking period" are all un-drifted verbatim. One precision fix: the funding-source gloss "from fees, not new emission" dropped upstream's verbatim "They will be rewarded from gas fees **and treasury-based incentives**" — folded in, matching the 2026-05-23 [`tokenomics-and-gas.md`](chain-resources/tokenomics-and-gas.md) article pass. The "to treasury" detail formerly appended to the emergency-unstake penalty is not surfaced verbatim on this fetch, so it was dropped to a bare "50% emergency-unstake penalty" rather than asserted.* See
[`chain-resources/tokenomics-and-gas.md`](chain-resources/tokenomics-and-gas.md).

**Storage rent (time-based storage pricing).** Somnia prices a storage write by **how long the data is retained**, not
just once at write time. The gas-fees page lists a single 32-byte `SSTORE` at `20,000` gas for 1 hour, `40,000` for 1
day, `60,000` for 1 month, `80,000` for 1 year, and `200,000` for `Indefinite`
([tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md), re-fetched 2026-05-22, re-verified
live 2026-05-23 — all five `SSTORE` tiers un-drifted verbatim). Upstream frames the same curve as "Tiered Pricing: Costs
scale with duration (e.g., 90% discount for 1-hour storage, no discount for indefinite storage)." *For the
blockchain dev:* there is no Ethereum equivalent — Ethereum charges a flat one-time `SSTORE`. *For the AI engineer:*
it's a per-record retention knob — ephemeral scratch state is cheap (the upstream `90%` 1-hour discount), permanence the
`200,000`-gas `Indefinite` ceiling (`10×` the 1-hour floor). *V1:* an audit
anchor meant to outlive the claim is budgeted at the `Indefinite` (`200,000` gas) tier per slot; load-based read pricing
is the related but distinct [IceDB](#i) property. See
[`chain-resources/tokenomics-and-gas.md`](chain-resources/tokenomics-and-gas.md).

**`SomniaEventHandler` / `_onEvent`.** The base contract a handler inherits for **on-chain reactivity**, overriding the
protected hook `_onEvent(address emitter, bytes32[] eventTopics, bytes data)`; subscriptions are created via
`SomniaExtensions.subscribe(...)` over the precompile at `0x0100`, and the owner pays gas for every firing
([on-chain](https://docs.somnia.network/developer/reactivity/reactivity-onchain.md)). Detailed in
[`chain-resources/reactivity.md`](chain-resources/reactivity.md).

**`somnia_watch` / `@somnia-chain/reactivity`.** Off-chain reactivity rides the standard JSON-RPC `eth_subscribe`
method with the `somnia_watch` parameter; the TypeScript package `@somnia-chain/reactivity` "wraps the WebSocket
protocol with Viem" and exposes `sdk.watch()` with `eventContractSources` / `topicOverrides` / `ethCalls` and
`onData` / `onError` callbacks ([off-chain](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md)).
*V1:* the dashboard's live audit-timeline listener.

**Subcommittee.** The set of Somnia nodes (runners) elected to execute one [native Agent](#a) request and reach
[consensus](#c) on its result. Size is set by `defaultSubcommitteeSize` (default **3**, override up to **10** via
`createAdvancedRequest`); a request finalises once `defaultThreshold` (default **2**) members agree, and the request
expires after `defaultTimeout` (default **15 minutes**) — all operator-configurable. Every member is paid the same
`median(executionCost)`, regardless of speed, "to remove any incentive to rush a low-quality response"
([gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md), re-verified live 2026-05-23 — the default
`3`/threshold `2`/`15`-minute-timeout config and `perMember = median(executionCosts)` rule all un-drifted). *V1:* the
15-minute timeout bounds (but
does not predict) how an on-chain adjudication call would fit the demo loop. See
[`chain-resources/native-agents.md`](chain-resources/native-agents.md).

**Subgraph.** An indexed, queryable ([GraphQL](#g)) view of on-chain data, built with The-Graph-style tooling. Somnia
lists **[Ormi](#o)** and **Protofire** subgraphs; Ormi uses the standard `@graphprotocol/graph-cli`, deploying via
`graph deploy … --node https://api.subgraph.somnia.network/deploy`
([Ormi guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph.md),
re-verified live 2026-05-23 — the `@graphprotocol/graph-cli` package name and the
`graph deploy mytoken --node https://api.subgraph.somnia.network/deploy --ipfs https://api.subgraph.somnia.network/ipfs`
command both un-drifted verbatim). *V1:*
feeds the UI audit timeline efficiently instead of scanning raw logs. Detailed in
[`chain-resources/indexing-subgraphs.md`](chain-resources/indexing-subgraphs.md).

## T

**`inferToolsChat` tool call.** When the LLM wants to use a tool it returns `finishReason == "tool_calls"` plus
ABI-encoded calldata the contract must execute and feed back; `finishReason == "stop"` means the `response` is final
([LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference.md), re-verified live 2026-05-23 — upstream
un-drifted: on `tool_calls` each "`pendingToolCalls[i]` is calldata (4-byte function selector + ABI-encoded arguments)"
and on `stop` the "`response` contains the final text").

## U

**UserOperation.** The ERC-4337 "pseudo-transaction" object an [account-abstraction](#a) smart wallet submits to the
[EntryPoint](#e) instead of a normal signed transaction; the EntryPoint validates it against the smart account and
executes it, enabling sponsored gas, batching, and [session-key](#s) auth. Somnia documents implementing user
operations via "ERC-4337-style flows"
([account abstraction](https://docs.somnia.network/developer/building-dapps/account-abstraction.md), re-verified live
2026-05-23 — the full capability bullet is "Implement user operations via ERC-4337-style flows"; un-drifted).

## V

**viem.** A TypeScript Ethereum library Somnia documents first-class support for
([viem](https://docs.somnia.network/developer/development-frameworks/using-the-viem-library.md)). Our SDK
(`somnia-agent-kit`) wraps lower-level calls, but viem is the escape hatch.

**VRF (Verifiable Random Function).** On-chain randomness you can prove wasn't manipulated. Somnia documents
**Protofire–Chainlink VRF** paid in native **STT/SOMI**: a consumer inherits `VRFV2PlusWrapperConsumerBase`, calls
`requestRandomnessPayInNative(callbackGasLimit, requestConfirmations, numWords, args)`, and receives the result later
in the `fulfillRandomWords(uint256 requestId, uint256[] randomWords)` callback once the proof is verified on-chain. The
**Direct Funding** method "doesn't require a subscription and is optimal for one-off requests" (excess `msg.value`
refunded) ([VRF](https://docs.somnia.network/developer/building-dapps/oracles/using-verifiable-randomness-vrf.md)).
*V1:* only if we need impartial sampling (e.g., selecting an auditor agent) — and, being a callback, wired through
[Reactivity](#r) rather than awaited inline. Detailed in [`chain-resources/oracles-and-vrf.md`](chain-resources/oracles-and-vrf.md).

## W

**Wildcard subscription.** The opposite of a [Filtered subscription](#f): an off-chain [Reactivity](#r) subscription
that **omits both `eventContractSources` and `topicOverrides`**, so "the node pushes every new log it sees on the
WebSocket connection" — the *absence* of a filter is what makes it a wildcard (there is no explicit match-all flag), and
on-chain reactivity forbids it outright. *For the AI engineer:* it's subscribing to the firehose instead of one topic;
you then sort events client-side. *For the blockchain dev:* the tutorial creates it with `sdk.subscribe({...})` (the
filtered tutorial uses `sdk.watch({...})`; the authoritative
[off-chain reference](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md) documents **only**
`watch`, so **prefer `watch()` in code** and treat `subscribe` as undocumented tutorial drift — resolved 2026-05-21;
both source pages re-verified live 2026-05-23 — the wildcard tutorial's `sdk.subscribe`, *"the node pushes every new
log it sees on the WebSocket connection"*, `new SDK({ public: publicClient })`, the `event.topics[0]`→`decodeEventLog`
guard, and the *"useful for quick testing and exploratory scripts. Production applications should usually add filters"*
line all un-drifted, and the off-chain reference still documents **only** `watch`)
over a WebSocket
`publicClient` wrapped as `new SDK({ public: publicClient })`, and because the stream is unfiltered, decoding moves into
the client: guard on `event.topics[0]` against a known signature hash before `decodeEventLog`. Documented as "useful for
quick testing and exploratory scripts. Production applications should usually add filters"
([wildcard tutorial](https://docs.somnia.network/developer/reactivity/tutorials/wildcard-off-chain-reactivity-tutorial.md)).
*V1:* an anti-pattern in production (an agent must never receive every log on chain — wasted bandwidth and a PHI/scope
hazard), but a useful dev tool for discovering which events a freshly deployed contract emits before writing the precise
filter. See [`chain-resources/reactivity.md`](chain-resources/reactivity.md).
