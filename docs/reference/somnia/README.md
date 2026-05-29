# Somnia Chain Resources — developer map

> **What this is.** A guided map of [docs.somnia.network](https://docs.somnia.network) written for two readers on this team:
> an **entry-level blockchain developer** (knows how to code, new to chains/EVM) and a **mid-level AI engineer**
> (knows LLMs and agents, new to on-chain primitives). Every Somnia resource below is paired with **how Curie Claims
> Protocol uses it in V1** so the platform docs and our [`docs/ROADMAP.md`](../../ROADMAP.md) stay woven together.
>
> **Scope note.** This folder captures the **Somnia L1 platform docs**. The **SDK** we build on
> (`somnia-agent-kit`) is captured separately in [`../somnia-agent-kit/`](../somnia-agent-kit/). When the two
> describe "an agent" they mean different things — see [`GLOSSARY.md`](GLOSSARY.md) → *Agent (two senses)*.
>
> Authoritative source is always upstream. Local notes are dated; figures are cited to a doc URL or flagged as unsourced.

## Start here

1. **New to blockchains?** Read [`GLOSSARY.md`](GLOSSARY.md) top-to-bottom once. It defines every term used below.
2. **New to Somnia specifically?** Skim *The chain in one screen* below, then read the two starred sub-articles.
3. **Designing a V1 feature?** Jump to the relevant row of the resource table and follow its sub-article link.

## The chain in one screen

Somnia is an **EVM-compatible Layer 1** — the same Solidity, the same wallet/RPC model, the same tooling (Foundry,
Hardhat, viem) you would use on Ethereum, but built for high throughput and sub-second interactivity. For us that means:
**we write ordinary Solidity and ordinary TypeScript; Somnia is what makes a multi-agent negotiation loop feel real-time.**

Connection details (verbatim from [network-info](https://docs.somnia.network/developer/network-info.md), fetched 2026-05-20, **full table re-verified live 2026-05-22 — every value below unchanged, including both Multicall3 addresses; the prior 2026-05-21 / 2026-05-22 spot-checks had re-touched only the chain IDs + RPC URLs, not Multicall3/explorers/faucets**):

| | Mainnet | Testnet (Shannon) |
|---|---|---|
| Chain ID | `5031` | `50312` |
| Native token | `SOMI` | `STT` (test token) |
| RPC (HTTP) | `https://api.infra.mainnet.somnia.network/` | `https://api.infra.testnet.somnia.network/` |
| RPC (WebSocket) | `wss://api.infra.mainnet.somnia.network/ws` | `wss://api.infra.testnet.somnia.network/ws` |
| Explorer | `https://explorer.somnia.network` | `https://shannon-explorer.somnia.network/` (alt: `https://somnia-testnet.socialscan.io/`) |
| Faucet | `https://stakely.io/faucet/somnia-somi` | Google Cloud / Stakely / Thirdweb / testnet.somnia.network |
| Multicall3 | `0x5e44F178E8cF9B2F5409B6f18ce936aB817C5a11` | `0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223` |
| CreateX (deterministic deploy) | `0xD13C575ED5378fd18B100Bd87D5765d9A747358B` | `0x535822d4b86b2372FBE4fd9d1468318F04A2A640` |
| EntryPoint v0.7 / Account factory | _blank upstream_ | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` / `0x4be0ddfebca9a5a4a617dee4dece99e7c862dceb` |

> ✅ **Chain ID resolved (2026-05-20; third corroboration 2026-05-22; citation corrected 2026-05-22).** Testnet (Shannon)
> is **`50312`**, mainnet is **`5031`** — corroborated by **three** independent upstream pages:
> [network-info](https://docs.somnia.network/developer/network-info.md), the `customChains` entry in the
> [Hardhat deploy guide](https://docs.somnia.network/developer/development-frameworks/deploy-with-hardhat.md)
> (`chainId: 50312`, `apiURL: shannon-explorer.somnia.network/api`), and (added
> 2026-05-22) the [agents quickstart](https://docs.somnia.network/agents/invoking-agents/quickstart.md) network table.
> (Earlier wording attributed the `customChains` corroboration to the *verify guide*; a live 2026-05-22 re-fetch confirms
> the [verify guide](https://docs.somnia.network/developer/development-frameworks/verifying-via-explorer.md) is now
> **mainnet-only** — `chainId 5031`, `w3us.site` — and carries no `50312`. The agents-quickstart corroboration is
> unaffected, so the resolution still rests on three pages.)
> The agent-kit notes' **`50311`** is a stale off-by-one — treat it as incorrect and fix any local config that still
> uses it; do not deploy against it. See [`GLOSSARY.md`](GLOSSARY.md) → *Chain ID* and *Shannon testnet*.
> Throughput/finality numbers are deliberately **not** restated here; see our sourced analysis in
> [`../../research/somnia/finality-tps-and-gas-model.md`](../../research/somnia/finality-tps-and-gas-model.md).

## Resource → V1 use map

Each row links a Somnia capability to where it lands in our [demo loop](../../ROADMAP.md). `★` = read first.

| Somnia resource | What it is (one line) | How Curie V1 uses it | Sub-article |
|---|---|---|---|
| **Native Agents** ★ | A contract can call an LLM / JSON-API agent and get a consensus-verified result on-chain | Candidate substrate for the payer/provider adjudication step — deterministic, auditable LLM calls | [`chain-resources/native-agents.md`](chain-resources/native-agents.md) |
| **Data Streams** | Schema-typed, verifiable structured data written **on-chain** without Solidity, with off-chain WebSocket reactivity | PHI-free audit-event fan-out + a verifiable negotiation record, keyed by publisher address | [`chain-resources/data-streams.md`](chain-resources/data-streams.md) |
| **Reactivity** | On-chain and off-chain event subscriptions (incl. cron) | Drives the agent state machine: provider → payer → settlement events wake the next agent | [`chain-resources/reactivity.md`](chain-resources/reactivity.md) |
| **Smart-contract dev** | Foundry / Hardhat / viem / Remix / Thirdweb toolchains | How we build, test, and deploy the negotiation + settlement contracts | [`chain-resources/smart-contract-dev.md`](chain-resources/smart-contract-dev.md) |
| **Indexing (subgraphs)** | Ormi / Protofire subgraphs + WebSocket event listening | Powers the UI audit timeline ("who proposed what, when, why") | [`chain-resources/indexing-subgraphs.md`](chain-resources/indexing-subgraphs.md) |
| **Oracles & VRF** | DIA / Protofire price feeds, verifiable randomness | SOMI↔USD pricing for settlement; VRF if we need impartial sampling | [`chain-resources/oracles-and-vrf.md`](chain-resources/oracles-and-vrf.md) |
| **Account Abstraction** | Gasless txns + smart wallets (Thirdweb/Privy, EntryPoint v0.7) | Lets agents transact without each holding pre-funded EOAs — smoother demo | [`chain-resources/account-abstraction.md`](chain-resources/account-abstraction.md) |
| **Consensus & execution** | MultiStream consensus, Accelerated Sequential Execution, IceDB | Background: *why* the chain is fast enough for live agent coordination | [`chain-resources/consensus-and-execution.md`](chain-resources/consensus-and-execution.md) |
| **Tokenomics & gas** | SOMI, staking, gas-fee model, gas-vs-Ethereum differences | Per-claim cost model for on-chain anchoring + (if used) native inference | [`chain-resources/tokenomics-and-gas.md`](chain-resources/tokenomics-and-gas.md) |

Sub-articles are added one per loop iteration; this table is the running index. See [`GLOSSARY.md`](GLOSSARY.md) for any term.

## Full upstream site map

Kept here so we can trace coverage. Section order mirrors [`llms.txt`](https://docs.somnia.network/llms.txt).

- **Get started:** [mainnet setup](https://docs.somnia.network/get-started/getting-started-for-mainnet.md) · [connect wallet](https://docs.somnia.network/get-started/connect-your-wallet-to-mainnet.md) · [bridging](https://docs.somnia.network/get-started/bridging-info.md)
- **Network info:** [network-info](https://docs.somnia.network/developer/network-info.md) · [overview](https://docs.somnia.network/developer/network-info/network-overview-mainnet-testnet.md) · [SOMI coin](https://docs.somnia.network/developer/network-info/somi-coin.md) · [JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md)
- **Reactivity:** [overview](https://docs.somnia.network/developer/reactivity.md) · [on-chain](https://docs.somnia.network/developer/reactivity/reactivity-onchain.md) · [off-chain](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md) · [tutorials](https://docs.somnia.network/developer/reactivity/tutorials.md) (incl. [cron via SDK](https://docs.somnia.network/developer/reactivity/tutorials/cron-subscriptions-via-sdk.md))
- **Data Streams:** [overview](https://docs.somnia.network/developer/data-streams.md) · [what is it](https://docs.somnia.network/developer/data-streams/what-is-somnia-data-streams.md) · [quickstart](https://docs.somnia.network/developer/data-streams/quickstart.md) · [concepts](https://docs.somnia.network/developer/data-streams/concepts.md) · [data vs. event streams](https://docs.somnia.network/developer/data-streams/concepts/somnia-data-vs-event-streams.md) · [extending & composing schemas](https://docs.somnia.network/developer/data-streams/concepts/extending-and-composing-data-schemas.md) · [provenance & verification](https://docs.somnia.network/developer/data-streams/concepts/data-provenance-and-verification-in-streams.md) · [SDK methods](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md) · [tutorials](https://docs.somnia.network/developer/data-streams/tutorials.md) (incl. [multiple publishers in a shared stream](https://docs.somnia.network/developer/data-streams/tutorials/working-with-multiple-publishers-in-a-shared-stream.md) & [the dApp publisher-proxy pattern](https://docs.somnia.network/developer/data-streams/tutorials/the-dapp-publisher-proxy-pattern.md))
- **Smart contracts & frameworks:** [smart contracts](https://docs.somnia.network/developer/smart-contracts.md) · [frameworks](https://docs.somnia.network/developer/development-frameworks.md) · [Foundry](https://docs.somnia.network/developer/development-frameworks/deploy-with-foundry.md) · [Hardhat](https://docs.somnia.network/developer/development-frameworks/deploy-with-hardhat.md) · [viem](https://docs.somnia.network/developer/development-frameworks/using-the-viem-library.md) · [Remix](https://docs.somnia.network/developer/development-frameworks/deploy-with-remixide.md) · [Thirdweb](https://docs.somnia.network/developer/development-frameworks/deploy-with-thirdweb.md) · [deploying-smart-contracts](https://docs.somnia.network/developer/development-frameworks/deploying-smart-contracts.md) (stub) · [verify](https://docs.somnia.network/developer/development-frameworks/verifying-via-explorer.md) · [debug playbook](https://docs.somnia.network/developer/development-frameworks/debug-playbook.md)
- **Building dApps:** [overview](https://docs.somnia.network/developer/building-dapps.md) · [tokens & NFTs](https://docs.somnia.network/developer/building-dapps/tokens-and-nfts.md) · [wallet/auth](https://docs.somnia.network/developer/building-dapps/wallet-integration-and-auth.md) · [account abstraction](https://docs.somnia.network/developer/building-dapps/account-abstraction.md) · [indexing & querying](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying.md) (incl. [Ormi](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph.md) & [Protofire](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/protofire-subgraph.md) subgraphs) · [oracles](https://docs.somnia.network/developer/building-dapps/oracles.md) · [examples](https://docs.somnia.network/developer/building-dapps/example-applications.md)
- **Security & deploy:** [security](https://docs.somnia.network/developer/security.md) · [audit checklist](https://docs.somnia.network/developer/security/audit-checklist.md) · [go-live checklist](https://docs.somnia.network/developer/deployment-and-production/go-live-checklist.md) · [gas vs Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md) · [ecosystem tools](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools.md)
- **Support & FAQs:** [general FAQs](https://docs.somnia.network/developer/deployment-and-production/support-and-community/general-faqs.md) · [developer FAQs](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md) (developer-facing performance summary: "1,000,000+ TPS", "Sub-second transaction finality", the four-innovations naming, and a labelled-but-qualitative "Block Time" field)
- **Concepts (litepaper):** [overview](https://docs.somnia.network/concepts/somnia-blockchain/overview.md) · [MultiStream consensus](https://docs.somnia.network/concepts/somnia-blockchain/multistream-consensus.md) · [Accelerated Sequential Execution](https://docs.somnia.network/concepts/somnia-blockchain/accelerated-sequential-execution.md) · [IceDB](https://docs.somnia.network/concepts/somnia-blockchain/somnias-icedb.md) · [Advanced Compression](https://docs.somnia.network/concepts/somnia-blockchain/advanced-compression-techniques.md) · [tokenomics](https://docs.somnia.network/concepts/tokenomics/overview.md) (incl. [gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md) — 50% burn / 50% validators — & [staking & delegation](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md) & [tokens governance](https://docs.somnia.network/concepts/tokenomics/tokens-governance.md) & [allocation & unlocks](https://docs.somnia.network/concepts/tokenomics/allocation-and-unlocks.md))
- **Agents:** [overview](https://docs.somnia.network/agents/readme.md) · [quickstart](https://docs.somnia.network/agents/invoking-agents/quickstart.md) · [from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity.md) · [receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md) · [custom consensus](https://docs.somnia.network/agents/invoking-agents/custom-consensus.md) · [gas fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md) · base agents: [JSON API](https://docs.somnia.network/agents/base-agents/json-api-request.md) · [LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference.md) · [LLM Parse Website](https://docs.somnia.network/agents/base-agents/llm-parse-website.md)

## Verification & provenance

Pages were fetched from `docs.somnia.network` on 2026-05-20 via the GitBook `.md` and [`llms.txt`](https://docs.somnia.network/llms.txt)
endpoints, then cross-checked against the upstream URL cited inline. **Upstream is authoritative when they diverge.**
Built incrementally by the `/loop` task on branch `docs/somnia-developer-glossary`.

<a id="verification-status"></a>**Verification status (as of 2026-05-23):**

- **Coverage complete.** All nine V1 resources in the table above have a sub-article; no `_planned_` rows remain.
- **Citations resolve.** Every cited `docs.somnia.network` `.md` URL has been re-fetched under the *sharpened
  soft-404 rule* (a real rendered body, not merely an HTTP `200` — GitBook serves soft-404s as `200`); none has
  404'd, moved, or drifted on its load-bearing facts. The newest re-checks are dated 2026-05-23.
- **Chain ID resolved.** Testnet (Shannon) is **`50312`**, mainnet is **`5031`** — corroborated by three upstream
  pages (network-info, the Hardhat deploy guide's `customChains`, the agents quickstart). The agent-kit notes'
  **`50311`** is a stale off-by-one; treat it as incorrect. See [`GLOSSARY.md`](GLOSSARY.md) → *Chain ID*.
- **Residual gaps are upstream's, not stale links.** Millisecond time-to-finality, sustained-vs-peak TPS, block
  time, and the nanoSomi base-gas floor are not published by Somnia; they stay *flagged unsourced* in the relevant
  sub-articles — research gaps, not citation rot.
- **Flagged for human review:** the *micar-whitepaper* `/files/…` PDF embed and the *miscellaneous/audits*
  L1-audit assertion (both off the V1 path).

The full dated re-verification trail (21+ passes, every entry preserved verbatim) lives in
[`chain-resources/verification-log.md`](chain-resources/verification-log.md). It was relocated there from this
README on 2026-05-23 so this map stays readable for its intended audience; nothing was deleted.
