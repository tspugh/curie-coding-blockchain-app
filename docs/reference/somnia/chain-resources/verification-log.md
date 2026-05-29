# Somnia reference — verification log (audit trail)

> **What this is.** The dated re-verification trail for this folder, relocated here from `README.md` on
> 2026-05-23 so the [developer map](../README.md) can serve its stated audience (an entry-level blockchain dev
> and a mid-level AI engineer) without scrolling past ~2,300 lines of audit notes. **No entry was deleted** — the
> full history below is preserved verbatim. Newest-relevant entries are toward the bottom; each is dated and cites
> the `docs.somnia.network` page it re-fetched.
>
> **How to read it.** Each `> ✅` block records a live re-fetch of one or more cited pages under the *sharpened
> soft-404 rule* (a real rendered body, not merely an HTTP `200`, since GitBook serves soft-404s as `200`) and
> states whether the load-bearing facts drifted. `> ⚠️` blocks flag known upstream quirks (e.g. the stale
> `dream-rpc.somnia.network` testnet RPC that still appears in some tutorials; chain ID `50312` agrees with
> network-info wherever it co-occurs). For the current rolled-up status, see *Verification status* in the
> [README](../README.md#verification-status).
>
> **PHI boundary (unchanged throughout).** Nothing in our V1 use of these primitives puts PHI on-chain — only
> hashes, state, agent addresses, and settlement amounts. Each entry that touches a data flow reaffirms this.

---

## Provenance

Pages fetched from `docs.somnia.network` on 2026-05-20 via the GitBook `.md` and `llms.txt` endpoints, summarised
by an AI fetch, then cross-checked against the upstream URL cited inline. Treat upstream as authoritative when they
diverge. Built incrementally by the `/loop` task on branch `docs/somnia-developer-glossary`.

> ✅ **Citation-resolution audit (2026-05-21).** Every distinct `docs.somnia.network` `.md` URL cited across this
> folder (63 unique links at audit time) was re-fetched and **all returned HTTP `200`** — no citation has 404'd,
> moved, or been renamed since the 2026-05-20 capture. The live [`llms.txt`](https://docs.somnia.network/llms.txt)
> site map corroborates: none of our cited pages dropped out of upstream's index. Coverage of the
> nine V1 resources is complete; remaining gaps are **facts upstream does not publish** (end-to-end inference
> latency, the nanoSomi base-gas floor, indexing-latency figures), already marked *flagged unsourced* in their
> sub-articles — research gaps, not stale links.
>
> ✅ **Citation re-verification (2026-05-22).** The cited set has nearly doubled since the 2026-05-21 audit — from
> 63 unique `.md` URLs to **118** — as the deepening passes above wove in new pages. Two checks this run: (1) a fresh
> [`llms.txt`](https://docs.somnia.network/llms.txt) diff against all 118 cited URLs leaves **only off-V1 surfaces
> uncited** (the legal sub-pages *airdrop-policy*/*governance*/*legal-disclaimer*, the DEX / NFT / DAO-UI-`p{1,2,3}` /
> on-ramp tutorials, the browser wallet-auth kits *connectkit*/*metamask*/*rainbowkit*, *ecosystem-tools/oracles* —
> redundant with DIA+Protofire — and index/landing pages), confirming the new-information frontier is exhausted of V1
> primitives and that future runs should prefer re-verification or the residual research gaps over re-reading listing
> pages. (2) A **7-link representative spot-check** under the *sharpened audit rule* (HTTP `200` ≠ resolves; GitBook
> serves soft-404s as `200`, so a real body must be confirmed) re-fetched the chain-ID anchor
> ([network-info](https://docs.somnia.network/developer/network-info.md) — `5031`/`50312` + `api.infra.*` RPCs intact),
> the platform addresses ([from-Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity.md) — testnet
> `0x037Bb9…6776` / mainnet `0x5E5205…163E6` intact), and the four most-recently-woven pages
> ([using-native-somi-stt](https://docs.somnia.network/developer/building-dapps/tokens-and-nfts/using-native-somi-stt.md)
> — *"No ERC20 functions are needed"* intact;
> [dao-smart-contract](https://docs.somnia.network/developer/building-dapps/example-applications/dao-smart-contract.md)
> — `votingDuration = 10 minutes` + `transfer(0.001 ether)` intact;
> [aml-compliance](https://docs.somnia.network/concepts/miscellaneous/legal/aml-compliance.md) — sanctions-list sentence
> intact) — **all rendered real content with every quoted value matching the folder verbatim.** Most important, the
> **fragile soft-404 boundary still holds exactly as flagged:** the truncated
> [`…-with-thirdw.md`](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md)
> slug serves real content (FACTORY_ADDRESS `0x4be0…dceb` intact), while the intuitive full `…-with-thirdweb.md` slug
> **still returns GitBook's "Page Not Found"** — so the truncated slug remains canonical and a status-code-only link
> check remains unsafe here. No citation has rotted; the residual *flagged unsourced* facts (block time, nanoSomi
> base-gas floor, sustained-vs-peak TPS, millisecond TTF) and the *flagged-for-human-review* stubs (the
> *micar-whitepaper* `/files/…` embed, the *miscellaneous/audits* L1-audit assertion) are unchanged — upstream gaps,
> not stale links.
>
> ⚠️ **Site-map grew (2026-05-21).** The same audit recorded `llms.txt` at 155 doc paths; on re-fetch later the same
> day it lists **232**, with the Data Streams section notably expanded (new *data-vs-event-streams*,
> *intersection-with-somnia-reactivity*, *publisher-proxy-pattern*, and per-feature schema/tutorial pages). This is
> upstream growth, not link rot — our nine cited pages still resolve.
>
> ✅ **Developer FAQ woven in (2026-05-21).** The previously-uncited
> [developer FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md)
> was fetched, verified live, and woven into [`chain-resources/consensus-and-execution.md`](consensus-and-execution.md).
> It **reclassifies** the "1M+ TPS / sub-second finality" headline figures from *external* (Chainspect/Messari) to
> *on-docs* sourced, names the same **four innovations** as the litepaper overview, and — via its labelled-but-empty
> "Block Time: Optimized for real-time applications" field — confirms that **no `docs.somnia.network` page publishes a
> block-time number**, the definitive answer to the block-time gap recurring in the consensus and oracles/VRF articles.
>
> Four of the new Data Streams pages are now woven
> into [`chain-resources/data-streams.md`](data-streams.md) — *data-vs-event-streams*,
> *publisher-proxy-pattern*, *intersection-with-somnia-reactivity* (the streams SDK's own
> `subscribe`↔`setAndEmitEvents` loop vs. `@somnia-chain/reactivity`'s `watch()`),
> *understanding-schemas-schema-ids-data-ids-and-publisher* (which names the **Data ID** — the `dsstore` mapping's
> third key — and the append-vs-upsert lever it controls), and (added 2026-05-21)
> *extending-and-composing-data-schemas* (schema versioning by **parent schema ID** — resolving the versioning half of
> the article's open question #3), and (added 2026-05-21) *read-stream-data-from-a-ui-next.js-example* — which fills the
> article's read-path gap: reads are **HTTP RPC** via `new SDK(publicClient)` (the push/pull split is also a transport
> split), the Next.js pattern keeps the SDK in a **server-side API route**, and live refresh is manual polling, not a
> subscription.
>
> ✅ **Filtered-subscriptions tutorial woven in (2026-05-21).** The previously-uncited
> [off-chain filtered-subscriptions tutorial](https://docs.somnia.network/developer/reactivity/tutorials/off-chain-reactivity-filtered-subscriptions-tutorial.md)
> was fetched, verified live, and woven into [`chain-resources/reactivity.md`](reactivity.md). It makes
> the abstract `sdk.watch()` filter concrete: a `watch()` parameter→RPC-field table, the Viem
> `toEventSelector`/`toFunctionSelector` topic/selector builders, the **one-based** `context: 'topic3'` rule that
> injects a matched log topic (`topics[2]`) into a per-event simulation `ethCall`, and the `onlyPushChanges` flag — the
> mechanism by which a V1 agent process wakes on *only* one claim's events and gets derived claim status in the same
> push. New glossary term: *Filtered subscription*. ⚠️ Sharper PHI boundary noted inline: indexed event topics used as
> filter keys must stay hash/address/amount-only. The remaining Reactivity tutorial (wildcard off-chain) is a
> candidate deepening flagged for future loop iterations.
>
> ✅ **On-chain Solidity tutorial woven in (2026-05-21).** The
> [on-chain Solidity reactivity tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md)
> was fetched, verified live, and woven into [`chain-resources/reactivity.md`](reactivity.md) — the
> on-chain mode previously had only the abstract `_onEvent` hook with no worked example. It adds the `TransferCounter`
> pattern: a `SomniaEventHandler` decoding indexed args from `eventTopics` by hand, the **four-slot `eventTopics` filter**
> (slot 0 = signature hash, slots 1–3 = indexed positions, `bytes32(0)` = wildcard), the `SubscriptionFilter` /
> `SubscriptionOptions` structs, deployment pre-funded with `--value 33ether` ("32 for subscription + 1 for gas"), and
> `SomniaExtensions.unsubscribe`. Key fact captured: the handler runs as a **separate "synthetic transaction" /
> "reactive transaction" *after*** the trigger — the reaction is a guaranteed follow-up tx, **not** atomic with the
> trigger — plus the docs' feedback-loop warning. New glossary term: *Reactive transaction (synthetic transaction)*.
>
> ✅ **Chainlink-oracles tutorial woven in (2026-05-21).** The
> [*Integrate Chainlink Oracles* tutorial](https://docs.somnia.network/developer/data-streams/tutorials/integrate-chainlink-oracles.md)
> was fetched and woven into [`chain-resources/oracles-and-vrf.md`](oracles-and-vrf.md) — not Data Streams,
> since its V1 value is making the **settlement rate auditable**. It documents the **oracle→Data Streams snapshot-bot
> pattern** (read `latestRoundData()`, `sdk.streams.set()` a `{timestamp, price, roundId, pair}` record, dedupe on
> Chainlink's `roundId`), which turns an ephemeral price `view` into a publisher-attested historical record and adds a
> *third* option to that article's open question #1 (hardcode vs. live read vs. snapshot). New glossary term: *Oracle
> snapshotting*. ⚠️ The tutorial reads Chainlink on **Sepolia** and writes to **Somnia** — a cross-chain bridge-by-snapshot;
> Curie's same-chain DIA/Protofire→Somnia variant is noted inline. The remaining per-feature tutorial pages
> (the F1 / on-chain-chat / realtime-game case studies) are candidate deepenings flagged for future loop iterations.
>
> ✅ **Wildcard-subscription tutorial woven in (2026-05-21).** The fourth and last Reactivity tutorial — the
> [wildcard subscription tutorial](https://docs.somnia.network/developer/reactivity/tutorials/wildcard-off-chain-reactivity-tutorial.md)
> — was fetched, verified live, and woven into [`chain-resources/reactivity.md`](reactivity.md). It
> documents the **filter-less** off-chain subscription (omit `eventContractSources` *and* `topicOverrides` → the node
> pushes every log), the consequent **client-side decode** (guard on `event.topics[0]` against a known signature hash
> before `decodeEventLog`), and upstream's own framing that it is for "quick testing and exploratory scripts. Production
> applications should usually add filters." Captured as a V1 **anti-pattern in production** (an agent must never receive
> every log — bandwidth + PHI/scope hazard) but a useful dev tool for discovering a fresh contract's event layout. New
> glossary term: *Wildcard subscription*. With this, **all four Reactivity
> tutorials** (on-chain Solidity, cron, filtered, wildcard) are now woven in.
>
> ✅ **`subscribe` vs `watch` divergence resolved (2026-05-21).** The flagged method-name conflict — the wildcard
> tutorial's `sdk.subscribe(...)` vs the filtered tutorial's `sdk.watch(...)` — was resolved against the authoritative
> [off-chain reactivity reference](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md), re-fetched
> live: it documents **only** `sdk.watch()` and never mentions `subscribe`; the
> [reactivity overview](https://docs.somnia.network/developer/reactivity.md) names neither. Both calls share an identical
> object shape and `new SDK({ public: ... })` construction, so they are very likely one method under two names — but
> since upstream documents only `watch`, **V1 code uses `watch()`** and treats `subscribe` as undocumented tutorial
> drift. Residual flag downgraded to "re-check if a future SDK release renames these." Woven into
> [`chain-resources/reactivity.md`](reactivity.md) (wildcard section + source caveat).
>
> ✅ **Local-testing & forking guide woven in (2026-05-21).** The previously-uncited
> [local-testing-and-forking guide](https://docs.somnia.network/developer/development-frameworks/local-testing-and-forking.md)
> was fetched, verified live, and woven into [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md)
> as a new *Local testing & forking (the TDD substrate)* section — the article had only a one-line forking mention in its
> debug section. Facts captured: the in-process vs persistent-node split (`npx hardhat test` / `npx hardhat node` /
> `forge test` on chain ID `31337`), the [Anvil](../GLOSSARY.md#a)/Hardhat fork commands, the `.env` shape with a pinned
> `FORK_BLOCK_*` for reproducible CI, and the state-manipulation cheatcodes (`hardhat_impersonateAccount`,
> `evm_snapshot`/`evm_revert`, `evm_setNextBlockTimestamp`). Tied directly to V1: forking is the deterministic substrate
> for the `tdd-test-writer` → `implementer` loop and the "raw medical note never in calldata" acceptance test, and lets
> `ClaimSettlement.sol` tests hit the real DIA feed + impersonate agent addresses without funding EOAs. Two new glossary
> terms: *Anvil*, *Forking (local fork)*. ⚠️ The guide's `.env` repeats the **same stale `dream-rpc.somnia.network`
> testnet RPC** already flagged in the article — precedence rule reaffirmed (fork against the canonical
> `api.infra.testnet` endpoint); chain IDs `50312`/`5031` agree with network-info, no conflict. The remaining uncited
> dev-frameworks pages (Remix, Thirdweb, `deploying-smart-contracts`) are candidate deepenings flagged for future loop
> iterations.
>
> ✅ **Smart-contract security-101 woven in (2026-05-21).** The previously-uncited
> [smart-contract security 101](https://docs.somnia.network/developer/security/smart-contract-security-101.md) page was
> fetched, verified live, and woven into [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md)
> as the **patterns layer beneath the audit checklist** — the article cited the checklist (the rubric) and go-live
> checklist (the cut-over runbook) but not the *how-to* the rubric verifies. Facts captured: the three vulnerability
> classes (reentrancy, access-control gaps, integer overflow/underflow) and their canonical mitigations
> ([CEI](../GLOSSARY.md#c) + a reentrancy-guard mutex + a pull-payment model; `Owner > Admin > Writer` role hierarchy +
> immutable owner; Solidity ≥ 0.8 auto-checks, `SafeMath` only for older compilers), OpenZeppelin's "battle-tested"
> `ReentrancyGuard`/`AccessControl`/`Ownable`, the extra static-analysis tools (MythX, Securify, Manticore), and the
> external [SWC Registry](https://swcregistry.io/) / [Consensys best-practices](https://consensys.github.io/smart-contract-best-practices/)
> references. Tied to V1: `ClaimSettlement.sol`'s fund-release path inherits **pull-payment + a reentrancy guard** as the
> concrete shape of the CEI requirement, and the **agent-identity registry is an `AccessControl` role surface**, not
> bespoke `msg.sender` checks. Two new glossary terms: *Reentrancy guard*, *Pull payment (pull-over-push)*. The page's
> lone Somnia-specific note — deploy deliberately-vulnerable contracts "only in local/Remix… NOT… with real funds on
> mainnet" — reinforces the no-PHI-on-chain / fork-first discipline. No new flags; the `swcregistry.io` and
> `consensys.github.io` links are upstream's own external references, not `docs.somnia.network` pages.
>
> ✅ **Gasless-with-Thirdweb tutorial woven in (2026-05-21).** The previously-uncited
> [gasless-transactions-with-Thirdweb tutorial](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md)
> was fetched (raw body) and woven into [`chain-resources/account-abstraction.md`](account-abstraction.md),
> **resolving open questions 1 (paymaster) and 3 (bundler) for the managed path**: `sponsorGas: true` routes through
> **Thirdweb's hosted bundler+paymaster** — there is no endpoint to host or discover, only a Thirdweb **client ID**.
> Strongest new fact: the tutorial's `FACTORY_ADDRESS` (`0x4be0…dceb`) is the **same address** as network-info's
> unlabelled "Account factory" — so that factory **is the Thirdweb Account Factory** (two upstream pages agree on one
> contract). Open question 4 is narrowed from "Thirdweb vs Privy" to "can `sponsorGas` be driven from a **headless**
> server-side signer?" — the tutorial is a browser/`thirdweb/react` flow, while our agents are Node processes. New
> glossary term: *`sponsorGas`*; the *Bundler* and *Paymaster* entries were updated from "Somnia documents none" to the
> managed-path nuance. ⚠️ **Two flags for human review:** (a) the canonical upstream slug is **truncated** to
> `…-with-thirdw.md` — the intuitive `…-with-thirdweb.md` is a GitBook **soft-404 served with HTTP `200`**, so a
> status-code-only link check is unsafe here; (b) the companion
> [smart-wallet-app tutorial](https://docs.somnia.network/developer/building-dapps/account-abstraction/smart-wallet-app-with-thirdweb.md)
> repeats the **stale `dream-rpc.somnia.network`** testnet RPC already flagged elsewhere — use the canonical
> `api.infra.testnet` endpoint.
>
> ✅ **Companion smart-wallet tutorial read — headless-AA gap confirmed (2026-05-21).** The previously-cited-but-unread
> [smart-wallet-app-with-thirdweb](https://docs.somnia.network/developer/building-dapps/account-abstraction/smart-wallet-app-with-thirdweb.md)
> tutorial was fetched, verified live, and woven into [`chain-resources/account-abstraction.md`](account-abstraction.md).
> It is **also a pure browser/`thirdweb/react` flow** (`ConnectButton` / `useActiveAccount` / `ThirdwebProvider`) with
> **no Thirdweb Engine, server wallet, or private-key backend signer** — so, having now read **both** Thirdweb AA
> tutorials, `docs.somnia.network` documents **no headless server-side sponsorship path**. This **reclassifies open
> question 4** from "unread companion page" to a **confirmed research gap** (resolving it means going outside the Somnia
> docs, e.g. Thirdweb Engine), and records a **third** sighting of the stale `dream-rpc.somnia.network` testnet RPC. One
> SDK-import divergence noted: this tutorial imports `somniaTestnet` from `viem/chain`, the gasless one from `thirdweb/chains`.
>
> ✅ **GUI deploy paths (Remix + Thirdweb) woven in (2026-05-21).** The two previously-uncited browser deploy guides —
> [deploy-with-remixide](https://docs.somnia.network/developer/development-frameworks/deploy-with-remixide.md) and
> [deploy-with-thirdweb](https://docs.somnia.network/developer/development-frameworks/deploy-with-thirdweb.md) — were
> fetched, verified live, and woven into [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md)
> as a new *GUI / managed deploy paths — and why V1 doesn't use them* section. **Key V1 finding:** both terminate in a
> **manual MetaMask approval** (Remix's "Injected Provider - MetaMask"; Thirdweb's `npx thirdweb deploy -k …`
> CLI-then-browser flow), so **neither suits Curie's headless Node agents** — deploy stays on scriptable Foundry/Hardhat
> (key from `.env`, unattended in CI). This is the same headless-vs-browser gap as account-abstraction **open question
> 4**, and the Thirdweb deploy page documents **no Engine/server-side path**, so it does not close it. Version trap
> captured: Remix's example pins Solidity **`^0.8.22`** vs the `0.8.28` everywhere else — a mismatch that breaks
> verification. Two new glossary terms: *Injected provider (MetaMask)*, *Remix IDE*. ⚠️ **Two citation-audit flags:**
> (a) the dev-frameworks landing
> [deploying-smart-contracts](https://docs.somnia.network/developer/development-frameworks/deploying-smart-contracts.md)
> is a **content-less stub**; (b) [`llms.txt`](https://docs.somnia.network/llms.txt) **lists** the gasless tutorial at
> the full slug `…/gasless-transactions-with-thirdweb.md`, yet that URL **renders GitBook's "Page Not Found" body** —
> the truncated `…-with-thirdw.md` is canonical. **Sharpened audit rule: neither `llms.txt` presence nor HTTP `200`
> proves a page resolves — confirm a real body** (GitBook serves soft-404s as `200`). This corroborates the prior
> gasless-tutorial flag (a) with direct evidence.
>
> ✅ **Third-party RPC providers woven in (2026-05-22).** The previously-uncited
> [ecosystem: RPC](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/rpc.md) page
> was fetched, confirmed to have **real content** (applying the sharpened audit rule above — not a GitBook soft-404),
> and woven into [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md) as a new *Which RPC
> endpoint to point at* section plus a V1 bullet. Facts captured: four third-party providers (Ankr, Public Node, Stakely,
> Validation Cloud) with their endpoint URLs, the verbatim quotes ("fast, free, and privacy-first"; "50 million compute
> units … without a credit card"; "scale tier that never imposes rate limits"), and that upstream names **no default
> provider** and publishes **no rate-limit figure** for Ankr/Stakely. Tied to V1: the single canonical `api.infra.*`
> endpoint is a shared bottleneck for several headless agents + the live UI listener during ROADMAP Week 3's "multiple
> claims negotiated/anchored quickly" demo, so Validation Cloud's unthrottled tier is the documented fallback — a
> one-line `--rpc-url` swap, not an architecture decision. The *RPC* glossary entry was enriched accordingly. PHI
> boundary reaffirmed inline: a relaying RPC provider only ever sees hash/address/amount calldata, so using a third party
> exposes no patient data. No new flags; provider endpoints are off-domain and were not load-tested.
>
> ✅ **Realtime-game case study woven in (2026-05-22).** The previously-uncited
> [build-a-realtime-on-chain-game](https://docs.somnia.network/developer/data-streams/tutorials/build-a-realtime-on-chain-game.md)
> "Tap-to-Play" tutorial — a README-flagged deepening candidate — was fetched, confirmed to have **real content** (not a
> GitBook soft-404), and woven into [`chain-resources/data-streams.md`](data-streams.md) as a new
> *A worked end-to-end example* subsection. It does two things: (1) a **second, independent** worked example confirming
> the article's read-path trio — writes via `sdk.streams.set()`, reads via a **server-side**
> `getAllPublisherDataForSchema()` in a Next.js API route, browser `fetch`ing "every few seconds" (**polling, not
> `subscribe`**; this tutorial uses neither `subscribe` nor `setAndEmitEvents`); and (2) it **sharpens open question #1**
> (write rate): upstream exposes **no batching API**, so high volume = **N independent `set()` transactions**, each with a
> collision-free `keccak256` Data ID (append-only lever, shown working), rate-limited by a deliberate client-side
> **"1-second cooldown ... to avoid flooding transactions."** Open question #1 is sharpened, not closed — upstream still
> publishes no per-record gas/throughput number. No new glossary term. ⚠️ **Fourth sighting** of the stale
> `dream-rpc.somnia.network` testnet RPC (the tutorial's `.env.local`) — precedence rule reaffirmed (use canonical
> `api.infra.testnet`). Remaining Data Streams deepening candidates: the F1 and on-chain-chat case studies and the two
> intro tutorials (*hello-world-app*, *build-your-first-schema*).
>
> ✅ **On-chain chat case study woven in (2026-05-22).** The previously-uncited
> [build-a-minimal-on-chain-chat-app](https://docs.somnia.network/developer/data-streams/tutorials/build-a-minimal-on-chain-chat-app.md)
> tutorial — the upstream example **structurally nearest to Curie's negotiation** (a two-party on-chain message
> exchange) — was fetched, confirmed to have **real content** (not a GitBook soft-404), and woven into
> [`chain-resources/data-streams.md`](data-streams.md) as a new *The closest analogue to Curie*
> subsection. Three findings: (1) it ships the **publisher-proxy pattern by default** — one **server wallet** signs every
> message, so author identity is the schema's `sender` *field*, not the unspoofable `msg.sender` — making **open question
> #4** (direct-publish vs proxy) a confirmed real fork: the *natural* build forfeits free provenance, direct-publish is
> the deliberate non-default for Curie. (2) Its free-text `content` string field is the **PHI hazard in purest form** —
> the schema natural for a chat app is the wrong schema for a PHI-bound negotiation; Curie replaces `content` with
> structured code/state/hash/amount fields, schema review the gate. (3) A **third** independent confirmation of the
> pull-path trio: despite prose claiming it emits events, the code uses **only `set()`** and the UI "updates with simple
> polling … does not rely on WebSocket" (`getAllPublisherDataForSchema` on `refreshMs = 5000`). Schema captured verbatim
> (`uint64 timestamp, bytes32 roomId, string content, string senderName, address sender`); a `bytes32 roomId` field
> models a per-claim thread (filtered **client-side after read**). No new glossary term. ⚠️ **Fifth sighting** of the
> stale `dream-rpc.somnia.network` testnet RPC; chain ID `50312` agrees with network-info. Remaining Data Streams
> deepening candidates: the F1 case study and the two intro tutorials (*hello-world-app*, *build-your-first-schema*).
>
> ✅ **Advanced Compression litepaper page woven in (2026-05-22).** The fourth core innovation was previously sourced
> **only** from the parent [overview](https://docs.somnia.network/concepts/somnia-blockchain/overview.md) one-sentence
> summary, while MultiStream / ASE / IceDB each had their dedicated litepaper page — a citation-parity gap. The dedicated
> [advanced-compression-techniques](https://docs.somnia.network/concepts/somnia-blockchain/advanced-compression-techniques.md)
> page (uncited anywhere in this folder until now) was fetched, confirmed to have **real content** (sharpened-audit-rule
> check — not a GitBook soft-404), and woven into [`chain-resources/consensus-and-execution.md`](consensus-and-execution.md).
> Key facts captured: the **shared-history** reason streaming compression beats block compression, and the explicit
> linkage that MultiStream's per-validator **data chains** are what "unlocks the ability for streaming compression" — so
> innovations #1 and #4 are **coupled**, not independent; BLS aggregation reaching "a constant size for any number of
> transaction signatures"; and the throughput target (~200 bytes/ERC-20 transfer → "1 million ERC-20 swaps per second…
> 190 MBytes/s or 1.5 GBits/s"). ⚠️ **One prior claim corrected:** the article and glossary said *no* numeric
> compression ratio is published — true of a **blanket** end-to-end ratio, but the dedicated page **does** publish a
> worked **illustrative** example for one component (a contract called by 10% of transactions → address "encoded in 3.3
> bits… a 48x compression ratio"). Reframed precisely as an entropy-coding address-encoding example, **not** the chain's
> overall ratio; "48x" must never be restated as Somnia's compression ratio. The *Advanced compression* glossary entry
> was updated to match. No new glossary term; no new flags.
>
> ✅ **Both Data Streams intro tutorials woven in (2026-05-22).** The previously-uncited
> [build-your-first-schema](https://docs.somnia.network/developer/data-streams/tutorials/build-your-first-schema.md) and
> [hello-world-app](https://docs.somnia.network/developer/data-streams/tutorials/hello-world-app.md) tutorials were
> fetched, confirmed to have **real content** (sharpened-audit-rule check — not GitBook soft-404s), and woven into
> [`chain-resources/data-streams.md`](data-streams.md) as a new *Starting from zero* subsection. They
> fill the step every prior worked example skipped: the **idempotent schema-registration ritual** (`computeSchemaId` →
> `isSchemaRegistered` pre-check → `registerDataSchemas`; hello-world reaches the same idempotency via an
> `ignoreAlreadyRegistered` boolean) and — the genuinely new surface — the **`SchemaEncoder` encode↔decode round-trip**:
> the same object that `encodeData`s a write `decodeData`s a raw read row back into typed values. This closes a real V1
> gap (every prior example showed `set` + read but never *decode*) — `decodeData` is the read-path mechanism for
> recovering typed ICD-10/CPT code/state/hash/amount fields from the audit timeline, a local off-chain transform with the
> PHI rule unchanged. New glossary term: *SchemaEncoder*. Two name-drift notes recorded (tutorial
> `isSchemaRegistered`/`SchemaEncoder.decodeData` vs the SDK guide's canonical
> `sdk.streams.isDataSchemaRegistered`/`deserialiseRawData`). ⚠️ **Sixth** sighting of the stale
> `dream-rpc.somnia.network` testnet RPC (both tutorials; chain ID `50312` agrees with network-info). ✅ **F1 candidate
> slug corrected:** the long-listed "F1 case study" 404s at the intuitive `build-a-realtime-f1-leaderboard` slug — its
> real path per [`llms.txt`](https://docs.somnia.network/llms.txt) is
> [`streams-case-study-formula-1`](https://docs.somnia.network/developer/data-streams/tutorials/streams-case-study-formula-1.md)
> ("Streaming data from OpenF1 on-chain"), now the **sole** remaining Data Streams deepening candidate and possibly the
> first upstream example to use `subscribe` over polling.
>
> ✅ **F1 case study woven in — `subscribe`-recipe hypothesis refuted (2026-05-22).** The
> [F1 case study](https://docs.somnia.network/developer/data-streams/tutorials/streams-case-study-formula-1.md) — the last
> README-flagged Data Streams deepening candidate — was fetched live (twice), confirmed to have **real content**, and woven
> into [`chain-resources/data-streams.md`](data-streams.md). The prior note's guess that it might be the
> first worked example to use `subscribe` over polling is **wrong**: despite its "building reactive applications" billing,
> the page contains **no read, no `subscribe`/`watch`, no `setAndEmitEvents`, and no OpenF1 poller** — it registers two
> schemas, encodes, `set()`s, and stops. The confirmed conclusion: **no worked upstream tutorial demonstrates
> `sdk.streams.subscribe`** — the push surface is documented only in the SDK methods guide + intersection-with-Reactivity
> concept page, and every worked example renders via server-side read + client poll. The study's positive contribution is
> a **second, independent worked example of schema extension** (`driver` extends `coordinates` via `computeSchemaId(parent)`
> → `parentSchemaId`), so Data Streams open question #3's "versioning mechanism resolved" now rests on two sources. No new
> glossary term. ⚠️ **Seventh** sighting of the stale `dream-rpc.somnia.network` testnet RPC (chain ID `50312` agrees with
> network-info). With this, **every README-flagged Data Streams deepening candidate is woven in** — the article is
> citation-complete against the live `llms.txt` Data Streams section.
>
> ✅ **Blockscout REST API woven in as indexing Path 3 (2026-05-22).** With all nine sub-articles complete, a live
> `llms.txt` re-fetch (203 doc paths) surfaced the previously-uncited
> [explorer API, health & monitoring](https://docs.somnia.network/developer/deployment-and-production/explorer-api-health-and-monitoring.md)
> page — confirmed **real content** (sharpened-audit-rule check, not a GitBook soft-404) — and it was woven into
> [`chain-resources/indexing-subgraphs.md`](indexing-subgraphs.md) as a **third read-path** alongside the
> hosted subgraph and the WebSocket listener. Key facts captured: Somnia's explorers run **Blockscout**, exposing a REST
> API at `/api` on both networks (testnet `shannon-explorer.somnia.network`, mainnet `explorer.somnia.network`) with four
> query interfaces ("REST API," "RPC API," "ETH RPC API," "GraphQL"), and the audit-relevant `GET /v2/...` endpoints —
> notably `GET /v2/addresses/{address}/transactions`, which yields an **agent address's full paginated history with no
> subgraph deployment**. This sharpens the article's open question 3 (defer-the-subgraph): there are now **two** documented
> zero-deploy paths to ship the audit timeline. The *Blockscout* glossary entry was enriched from verification-only to
> also a read-path. PHI boundary reaffirmed inline (the explorer only ever surfaces hash/address/amount calldata + decoded
> logs). ⚠️ The page publishes **no** explorer uptime, rate-limit, or indexing-latency figure — those stay flagged
> unsourced (same gap as indexing open question 2). The remaining uncited `ecosystem-tools/*` listing pages
> (`oracles`, `subgraphs`, `wallet-providers`, `safes`, `apis`, …) and `security/node-infra-security` are candidate
> deepenings flagged for future loop iterations.
>
> ✅ **Ecosystem wallet-providers page woven in — Sequence surfaced as a third AA provider (2026-05-22).** The
> previously-uncited
> [ecosystem: wallet-providers](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/wallet-providers.md)
> listing was fetched, confirmed **real content** (sharpened-audit-rule check — not a GitBook soft-404), and woven into
> [`chain-resources/account-abstraction.md`](account-abstraction.md). It names a **third** wallet/AA
> provider roster — **Privy, Sequence, Thirdweb** — and the genuinely new datum is **[Sequence](https://sequence.build/)**
> ("Smart contract wallet & account abstraction provider that enables gasless transactions… "), cited nowhere in this
> folder until now. Captured as a **cross-page reconciliation**: three upstream pages now name providers and they disagree
> — Privy is the only provider on all three; Thirdweb on two (AA overview + ecosystem); Sequence **unique to the ecosystem
> page**; RainbowKit/ConnectKit (connect-UI kits, not AA) only on wallet-integration. Sequence **widens open question 4's
> off-docs research set** (Thirdweb Engine vs. Privy vs. Sequence for a headless server-side signer) **without narrowing
> the gap from within the Somnia docs** — the page links only Sequence's landing page (no Somnia tutorial, code, or
> addresses). No new glossary term (the glossary is concept-keyed, not vendor-keyed). ⚠️ **One flag:** the ecosystem
> page's **Thirdweb documentation link is broken** (flagged at fetch); use `thirdweb.com/somnia` and the two Somnia
> Thirdweb tutorials already cited instead. Remaining `ecosystem-tools/*` deepening candidates: `oracles` (redundant —
> DIA + Protofire already deeply covered), `safes` (Palmera DAO, a multi-Safe treasury aggregator — thin, no
> addresses/networks), `explorers`, `sdks`, `apis`, `on-ramps`, plus `security/node-infra-security`.
>
> ✅ **Node/infra security woven in — the third of the four security layers, and the no-PHI-in-logs twin (2026-05-22).**
> The previously-uncited [node/infra security](https://docs.somnia.network/developer/security/node-infra-security.md)
> page was fetched, confirmed **real content** (sharpened-audit-rule check — not a GitBook soft-404; it references
> Somnia developers, STT, and an Ankr Somnia endpoint), and woven into
> [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md) as the *off-chain* security layer
> beside the contract-level audit checklist + security-101. The article already named upstream's **four** security
> layers but covered only the two on-chain ones plus go-live; node/infra was the missing third (the fourth is
> responsible disclosure). Facts captured: the `.env` / `.gitignore` / split-env-files convention, **AWS Secrets
> Manager** for production secrets, `Wallet.createRandom()` key generation, a **90-day key-rotation** example, IP
> allowlisting, hardware-wallet/multisig for high-value keys, the retry-with-backoff (`maxRetries = 3`, `2^attempt ×
> 1000` ms) + **20% gas buffer**, and the 10-item Security Checklist — all standard Node.js practice run off-chain. Tied
> to V1: this **is** the `security-auditor`'s "signing-key hygiene" rubric for our headless key-holding agents. **Curie
> sharpens one rule into a genuinely new claim:** upstream's *"private keys … never exposed in logs"* extends, for us, to
> **PHI** — the off-chain agent reads the medical note, so the no-PHI-**on-chain** rule has a twin, **no-PHI-in-logs**,
> and upstream's redaction discipline is its concrete home. Two new glossary terms: *Key rotation* (new **K** section),
> *Secrets manager*. ⚠️ The page's `.env` uses a **third form** of the testnet RPC URL — Ankr's
> `rpc.ankr.com/somnia_testnet/<key>` — distinct from both the canonical `api.infra.testnet` and the ecosystem page's
> `www.ankr.com/rpc/somnia`; not the stale `dream-rpc` string, but the precedence rule (network-info is canonical)
> stands. No chain IDs on this page. With this, **three of upstream's four security layers** are now woven in; the
> remaining `ecosystem-tools/*` listing pages (`safes`, `explorers`, `sdks`, `apis`, `on-ramps`) and the
> responsible-disclosure policy are candidate deepenings flagged for future loop iterations.
>
> ✅ **Responsible-disclosure policy woven in — the fourth and last security layer (2026-05-22).** The previously-uncited
> [responsible-disclosure policy](https://docs.somnia.network/developer/security/responsible-disclosure-policy.md) was
> fetched, confirmed **real content** (sharpened-audit-rule check — it names Somnia Network, Shannon Testnet, the Somnia
> bridge contract, and `developers@somnia.network`, not a GitBook soft-404), and woven into
> [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md) as a new *Responsible disclosure*
> section. This **completes upstream's four security layers** in the article — which previously said only "the first
> three are covered here." Facts captured: the report channels (email `developers@somnia.network`, a Discord "Bug
> Reports" ticket, Telegram contacts), the *"reply within 24 hours"* acknowledgement target, the safe-harbour line
> (*"will not face any penalties and will be publicly recognized"*), the explicit note that a **formal bounty system is
> not yet live**, and the three prohibitions (no Mainnet exploitation, no RPC-endpoint disruption, no social
> engineering) plus the *"test … on Shannon Testnet, not on Mainnet"* rule. Tied to V1 two ways: the testnet-only rule
> **mirrors** Curie's fork-first / security-101 discipline, and the policy is a **template** for Curie's own disclosure
> posture (named private channel, acknowledgement target, report-privately-first). New glossary term: *Responsible
> disclosure*. Curie's own extension recorded inline: **no PHI in a bug report** — a write-up must use synthetic claim
> IDs and hashes, extending the no-PHI-in-logs twin. No new flags; the page publishes no chain IDs and no RPC URL.
> Remaining candidate deepenings: the `ecosystem-tools/*` listing pages (`safes`, `explorers`, `sdks`, `apis`,
> `on-ramps`).
>
> ✅ **Second explorer (Exploreme) surfaced from ecosystem listing (2026-05-22).** Three thin `ecosystem-tools/*` listing
> pages were triaged this run — [`sdks`](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/sdks.md)
> (names only **Sequence + Thirdweb**, both already woven in — and notably does **not** list `somnia-agent-kit`, an
> empirical corroboration of the source-of-truth directive to treat the agent-kit gitbook as non-authoritative unless the
> official docs link to it; they don't here), [`apis`](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/apis.md)
> (only **Ormi**, already covered), and [`safes`](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/safes.md)
> (**Palmera DAO** multi-Safe treasury — no networks/addresses, and multi-Safe aggregation isn't a V1 shape). The one
> page with a **previously-uncited, V1-relevant datum** was
> [`explorers`](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/explorers.md):
> it names a **second, independently-operated** Somnia explorer — **Exploreme**, by Stakeme (testnet
> `testnet.somnia.exploreme.pro`, mainnet `somnia.exploreme.pro`) — beyond the Blockscout `shannon-explorer` /
> `explorer.somnia.network` endpoints. Woven into [`chain-resources/indexing-subgraphs.md`](indexing-subgraphs.md)
> (Path 3) as a **liveness fallback for the audit timeline**, mirroring the RPC-fallback reasoning in
> [`smart-contract-dev.md`](smart-contract-dev.md): if Blockscout's UI is down mid-demo, a human can
> still read our verified `ClaimSettlement.sol` on Exploreme. ⚠️ **Precision flag held:** the ecosystem page gives
> Exploreme the **same boilerplate description** as Blockscout but **no `/api` surface**, so the documented programmatic
> `GET /v2/...` REST read-path stays **Blockscout's alone** — Exploreme's REST shape is unverified and must not be
> assumed equal. The *Blockscout* glossary entry was enriched to note the two-explorer split. No new glossary term (the
> glossary is concept-keyed, not vendor-keyed). Remaining candidate deepenings: the thinner `ecosystem-tools/*` listings
> (`safes`, `apis`, `sdks`, `on-ramps`).
>
> ✅ **On-ramps triaged — recorded as off-V1, not woven as a sub-article (2026-05-22).** The previously-uncited
> [ecosystem: on-ramps](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/on-ramps.md)
> page was fetched and confirmed **real content** (sharpened-audit-rule check — not a GitBook soft-404), but it is a
> **one-provider stub**: it names only **Banxa** (a fiat↔crypto on-ramp), with **no default provider** and **no
> Somnia-specific networks, addresses, fees, or limits**. Rather than spend a sub-article on it, the finding was woven as
> a single **funding** bullet + source-caveat note in
> [`chain-resources/tokenomics-and-gas.md`](tokenomics-and-gas.md), tied to V1 by its *negative* relevance:
> V1 funds testnet agents from the **STT faucet**, and the settlement SOMI an agent pays flows from the **counterparty
> payer agent**, not a card purchase — a fiat on-ramp only matters on **mainnet** when a human treasury tops up a wallet,
> a step **outside** the V1 agent loop. Recorded explicitly so the research loop stops re-triaging it. With this, the
> ecosystem-tools `on-ramps` listing is closed; the remaining thin listings (`safes` — Palmera multi-Safe treasury;
> `apis` — Ormi, already covered; `sdks` — Sequence + Thirdweb, already covered) introduce **no new V1 primitive**, so the
> `ecosystem-tools/*` branch is effectively exhausted of V1-relevant surfaces — future iterations should prefer
> citation re-verification or deepening the consensus/oracles block-time + nanoSomi-floor research gaps over re-reading
> listing pages. No new glossary term; no new flags (Banxa is off-domain and was not exercised).
>
> ✅ **Subgraph *query* layer woven in — the live read-path is polling, not subscription (2026-05-22).** A live
> [`llms.txt`](https://docs.somnia.network/llms.txt) re-fetch (168 doc paths this run) surfaced three previously-uncited,
> V1-relevant `data-indexing-and-querying/*` pages — [building-subgraph-uis-nextjs-fetch](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-nextjs-fetch.md),
> [building-subgraph-uis-apollo-client](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-apollo-client.md),
> and [using-data-apis-ormi](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/using-data-apis-ormi.md) —
> all confirmed **real content** (sharpened-audit-rule check, not GitBook soft-404s) and woven into
> [`chain-resources/indexing-subgraphs.md`](indexing-subgraphs.md) as a new *Path 1, continued — querying
> the subgraph from the audit UI* subsection. This fills the article's standing gap: it documented *producing* the index
> and three read-paths but stopped at "the provider returns a GraphQL endpoint," never showing how the audit UI *reads*
> it — even while its own *For the AI engineer* section promised a "re-query the subgraph" step. **Strongest new fact:**
> live refresh in **both** documented UI patterns is **polling, not a GraphQL subscription** (Apollo's
> `useQuery(…, { pollInterval: 5000 })`; the `fetch` example refreshes only on mount) — the **fourth** independent
> confirmation in this folder (after three Data Streams worked examples) that Somnia's only true push surface is the
> WebSocket listener. Also captured: the `proxy.somnia.chain.love/subgraphs/name/…` query host (same host Protofire
> deploys to), the **server-side `app/api/proxy/route.ts` + `Client-ID` proxy** (CORS bypass *and* the one place to
> enforce the PHI/scope boundary on what leaves the server), and a **fourth no-deploy read API** — Ormi's REST Data API
> (`…/public_api/data_api/somnia/v1/address/{address}/balance/erc20`, `Bearer` auth) — recorded against open question 3
> but **not adopted**, since its only documented endpoint is ERC-20 balances, not the transaction/event history an audit
> timeline needs. New concept-keyed glossary term: *Polling (vs. subscription)*; the *GraphQL* entry was enriched with the
> two consumption patterns. No new flags — none of the three pages names a chain ID or uses the stale `dream-rpc` RPC.
>
> ✅ **AA-ecosystem page woven in — Pimlico narrows the headless-signer gap (2026-05-22).** The previously-uncited
> [ecosystem: account-abstraction](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/account-abstraction.md)
> page (not in any prior `ecosystem-tools/*` triage list) was fetched, confirmed **real content** (sharpened-audit-rule
> check — not a GitBook soft-404), and woven into [`chain-resources/account-abstraction.md`](account-abstraction.md)
> as a new *The Pimlico path* subsection. It names a **fourth** AA provider — **Pimlico** ("the world's most advanced
> ERC-4337 account abstraction infrastructure platform") — and crucially the **first infrastructure-layer** one (a
> bundler+paymaster RPC), categorically distinct from the wallet-UI providers (Thirdweb-react / Privy / Sequence) whose
> every documented flow is a browser one. The page's sole Resources link is to Pimlico's own
> [*Send your first gasless transaction*](https://docs.pimlico.io/guides/tutorials/tutorial-1) tutorial; following that
> **official outbound link** (permitted by the source-of-truth directive), it is a **headless Node / `permissionless.js`
> / `viem` / `privateKeyToAccount`** flow hitting bundler+paymaster RPC directly — the exact shape
> [`account-abstraction.md`](account-abstraction.md)'s **open question 4** (headless server-side signer)
> was missing. This **narrows** OQ4 from "no headless path documented anywhere Somnia points to" to "Somnia points at
> Pimlico; confirm a Somnia endpoint." The *Bundler* and *Paymaster* glossary entries were enriched (concept-keyed
> convention — no vendor term added). ⚠️ **Two caveats held:** (a) the linked tutorial's example endpoint is **Sepolia**
> (`…/v2/sepolia/rpc`), so a Pimlico **Somnia** bundler endpoint is **unconfirmed** from these two pages — OQ4 narrowed,
> not closed; (b) the tutorial is **off-domain** (`docs.pimlico.io`), cited only because the official docs link to it.
> PHI boundary reaffirmed inline (a bundler/paymaster relays only gas + hash/address/amount calldata, never payload).
>
> ✅ **Native-Agents receipts + from-Solidity deepened — the audit "why" is centralized off-chain (2026-05-22).** With
> all nine sub-articles complete, the **starred** [`chain-resources/native-agents.md`](native-agents.md)
> was deepened from its two previously-**cited-but-unread** upstream pages,
> [receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md) and
> [from-Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity.md) (both fetched live, real content).
> Until now the **receipt** — the audit artifact that is Curie's entire reason to consider native agents — was sourced
> only from the *overview*'s one-line "signed manifest" summary. The dedicated pages add a new *The receipt: the
> auditable "why"* section with the receipt's `steps`/`result` structure (step types `llm_request`, `reasoning`,
> `value_extracted`, …), the canonical `Response` struct (`{address validator; bytes result; ResponseStatus status;
> uint256 receipt; uint256 timestamp; uint256 executionCost}`) and `handleResponse` callback, and the platform-contract
> addresses (testnet `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`, mainnet `0x5E5205CF39E766118C01636bED000A54D93163E6`).
> **Strongest new fact (a V1 architecture caveat):** consensus binds only the *final result*; the step-by-step receipt is
> *"subjective and may vary slightly between nodes,"* and is **"currently stored on centralized infrastructure"** (fetched
> off-chain by `requestId` from `receipts.{mainnet,testnet}.agents.somnia.host`), with only a `uint256 receipt`
> *reference* on-chain. So an audit timeline built on native agents gets a **trustless verdict but a centralized,
> revocable "why"** — recorded as a V1 design bullet. ⚠️ **PHI rule sharpened:** receipt steps log `llm_request` /
> `reasoning` / `body_preview`, so a PHI-bearing prompt would persist PHI into that centralized store — a no-PHI-**on-chain**
> *and* no-PHI-**in-receipt** rule. The *Receipt (agent)* glossary entry was rewritten from the overview one-liner to the
> dedicated-page sourcing. No new flags; `quickstart` remains the one cited-but-unread agents page (addresses may move pre-GA).
>
> ✅ **Quickstart read — last cited-but-unread agents page closed; chain IDs corroborated a third time (2026-05-22).** The
> [agents quickstart](https://docs.somnia.network/agents/invoking-agents/quickstart.md) — flagged in the prior run as the
> one cited-but-unread agents page — was fetched live, confirmed **real content** (sharpened-audit-rule check — not a
> GitBook soft-404; it carries a real network/address table and a faucet link), and woven into
> [`chain-resources/native-agents.md`](native-agents.md). Three findings: (1) it **names the platform
> contract `SomniaAgents`** — a datum the article previously lacked (it had the bare addresses only); (2) it
> **independently corroborates** both platform addresses (agreeing with from-Solidity) **and** the chain IDs
> `5031`/`50312` and `api.infra.*` RPC URLs (agreeing with network-info) — so the chain-ID resolution above now rests on
> **three** upstream pages, and the agent-kit's `50311` is outvoted 3-to-0; (3) its strongest line — **"All agent
> invocations go through the Solidity platform contract — including calls made from the web app"** — confirms there is
> **no non-Solidity invocation path**, so for V1 there is no shortcut around calling `SomniaAgents` from our own
> negotiation/settlement contract (the web app is merely a UI over it). It also **corrected a misdirecting source
> caveat**: the article told readers to "re-read quickstart for exact ABI," but the quickstart carries the
> network/address table and **no ABI, agent IDs, or code** — the ABI lives in the from-Solidity and three base-agent
> pages, and the caveat now says so. No new glossary term (the contract name is vendor-keyed; the glossary is
> concept-keyed). No new flags. With this, **every cited agents-section page has now been read**, and the starred
> native-agents article is citation-complete against the live agents section of [`llms.txt`](https://docs.somnia.network/llms.txt).
>
> ✅ **Litepaper on-chain-reactivity page woven in — the same-block / MEV-resistance protocol layer (2026-05-22).** With
> all developer-section pages exhausted, a live [`llms.txt`](https://docs.somnia.network/llms.txt) re-fetch (100 doc
> paths) surfaced the previously-uncited litepaper concept page
> [on-chain reactivity](https://docs.somnia.network/concepts/somnia-blockchain/on-chain-reactivity.md) — confirmed **real
> content** (sharpened-audit-rule check; a vision/comparison page, not a GitBook soft-404) — and it was woven into
> [`chain-resources/reactivity.md`](reactivity.md) as a new *protocol-level picture* subsection beneath the
> developer how-to pages. **It resolves an apparent contradiction across the two doc layers:** the developer tutorial
> calls the reaction a "separate **reactive transaction** after the triggering transaction," while the litepaper says the
> **"Reaction included in the same block."** These reconcile — the reaction is a *distinct* synthetic tx (not atomic;
> runs after) that is nonetheless *deterministically included in the same block* (no next-block latency). The genuinely
> new protocol claim is **"Fully MEV-resistant due to deterministic inclusion of event handlers"** (the developer pages
> never claim this) — so a Curie negotiation/settlement reaction cannot be front-run or reordered by a block builder —
> plus the litepaper's three-model timing-and-trust contrast (RPC/polling "Next block / Developer infra"; indexer-hooks
> "Next block / Centralized service"; Somnia "Same block / Fully decentralized"). The *Reactive transaction* glossary
> entry was enriched with the ordering-vs-latency reconciliation. ⚠️ **One flag for human review:** the page states
> **"Somnia Reactivity is currently only available on TESTNET"** — not a V1 blocker (the demo runs on Shannon testnet,
> chain ID `50312`), but any *mainnet* dependence on on-chain reactivity/cron is unconfirmed until upstream marks it
> live; the off-chain WebSocket mode (the V1 default) carries no such caveat. The page is a high-level vision document and
> does **not** specify *how* validators detect/schedule handlers, so the mechanism stays sourced to the developer pages.
> No new glossary term. No new chain-ID conflict (the page names none).
>
> ✅ **Chain security/trust model woven in — the trust half of the substrate thesis (2026-05-22).** A live
> [`llms.txt`](https://docs.somnia.network/llms.txt) re-survey (this run: 100+ doc paths) found the previously-uncited
> litepaper [security](https://docs.somnia.network/concepts/somnia-blockchain/security.md) page — confirmed **real
> content** (sharpened-audit-rule check — it carries the validator count, Cuthbert description, and slashing sentence,
> not a GitBook soft-404) — and it was woven into
> [`chain-resources/consensus-and-execution.md`](consensus-and-execution.md) as a new *The trust model*
> section + a V1 bullet. That article previously covered only the four **performance** innovations and had **no
> trust/security layer**, despite its V1 purpose being *why the chain is trustworthy enough to anchor an audit trail*.
> Facts captured verbatim: "**sufficiently decentralised services, not maximally decentralised**," "**100 globally
> distributed validator nodes**" at launch (hardware "between a Solana and Aptos node"), PoS where "**Node providers are
> subject to slashing if they act maliciously against the network**," and — the strongest fact for an audit use case —
> **Cuthbert**, the second unoptimised implementation run in parallel so validators "**stop voting or executing if they
> ever detect a divergence**" (an execution bug must exist in *both* codebases to escape). One new glossary term:
> *Cuthbert*. ⚠️ **Two adjacent pages triaged the same run, recorded so future loops don't re-triage:** the litepaper
> [use-cases](https://docs.somnia.network/concepts/somnia-blockchain/use-cases.md) page is real content but names only
> **Gaming / SocialFi / Metaverse / DeFi / Real-Time Applications** — it does **not** name AI, agents, or healthcare
> (a *negative* finding: Somnia does not officially position itself as an agentic/AI L1); and
> [miscellaneous/audits](https://docs.somnia.network/concepts/miscellaneous/audits.md) is a **stub** referencing a "Smart
> Contract Report" + "L1 Audit Report" with **no firm, date, or resolvable URL** (internal file IDs only) — so the
> existence of third-party L1 audits is **asserted but unverifiable from the docs**, flagged for human review. PHI
> boundary unaffected; the security page names no chain ID and no RPC URL.
>
> ✅ **Token-governance page woven in — role-#3 "(details pending upstream)" marker resolved (2026-05-22).** The
> previously-uncited litepaper [tokens governance](https://docs.somnia.network/concepts/tokenomics/tokens-governance.md)
> page was fetched, confirmed **real content** (sharpened-audit-rule check — token-house/council structure, named
> phases, and the "still in it's early phases" line; not a GitBook soft-404), and woven into
> [`chain-resources/tokenomics-and-gas.md`](tokenomics-and-gas.md). It closes the article's standing
> **coverage** gap (not an upstream gap): the SOMI **Governance** token role — the one the earlier passes left at
> "(details pending upstream)" — now carries the *how*: "Proposals can be created by any token owner. They are then
> approved by a majority vote of other token holders," cast through a **token house** of holders (plus a validator
> council, developer council, user assembly, foundation board). **Strongest V1-relevant fact:** governance is **phased,
> not live in full** — through the **Transition** phase (`6–24 months` post-mainnet) the **foundation board keeps
> ultimate control**, full delegation only in the **Mature** phase (`Year 2 onward`). Governance is **off the V1 agent
> loop** (Curie never votes), but it **sharpens the trust caveat** the [security/Cuthbert](consensus-and-execution.md)
> page makes: the audit substrate is *progressively*, not yet fully, decentralised — a fair thing to state for a
> "neutral substrate" pitch. One new concept-keyed glossary term: *Governance (SOMI)*. ⚠️ The sibling
> [allocation & unlocks](https://docs.somnia.network/concepts/tokenomics/allocation-and-unlocks.md) page was triaged the
> same run (real content — six-way allocation table summing to the 1B supply, 48-month unlock schedule, ~16% TGE
> circulating, an `unlocks.somnia.network` tracker) but is **investor/market info, off the V1 cost model** — recorded in
> that article's source caveat as off-V1 (like on-ramps) so the loop stops re-triaging it. With both, the **two
> remaining uncited tokenomics concept pages are now read and accounted for**. No new flags (neither page names a chain
> ID or uses the stale `dream-rpc` RPC).
>
> ✅ **Litepaper problem page woven in — the "why not Ethereum?" problem statement (2026-05-22).** The previously-uncited
> litepaper [problem](https://docs.somnia.network/concepts/litepaper/problem.md) page was fetched, confirmed **real
> content** (sharpened-audit-rule check — three named bottlenecks, the "true virtual society" line, and a chain-throughput
> comparison table; not a GitBook soft-404), and woven into
> [`chain-resources/consensus-and-execution.md`](consensus-and-execution.md) as a new *Why these four —
> the problem statement* subsection between the four-innovations table and the per-innovation deep dives. That article
> held the **solutions** (four innovations) and the **trust model** but had **no problem statement**, so the feature list
> read as unmotivated. The page names **three** bottlenecks — **Execution speed** ("the rate at which smart contract code
> can be executed, and block creation can occur"), **Storage** ("we still need improvements in reading and writing data to
> blockchains"), **Bandwidth** ("the amount of bandwidth needed to send data between nodes… when running at high
> transaction levels") — which map almost 1:1 onto ASE / IceDB / MultiStream-plus-compression, turning the solution list
> into a closed argument and giving the article its sourced *"why Somnia, not Ethereum?"* answer (an agent loop anchoring
> each turn stresses execution latency + storage cost, the first two bottlenecks). **No figures transcribed:** the page's
> per-chain DEX-swaps-per-second / TPS comparison is left on the upstream page rather than restated, since exact decimals
> came via a summarised fetch — the structural taxonomy is what the article needs, not the numbers. ⚠️ Recorded
> **negative** finding corroborating the use-cases page: the problem page's headline use cases are **gaming / metaverse /
> social** — it names **no AI or agents**. No new glossary term; no new flags (the page names no chain ID and no RPC URL).
> Remaining uncited litepaper framing pages — [somnia-mission](https://docs.somnia.network/concepts/litepaper/somnia-mission.md)
> (mission/principles; "mass consumer real-time applications… at web2 scale with web3 properties"; also names no AI/agents),
> [introduction](https://docs.somnia.network/concepts/introduction.md), and [conclusion](https://docs.somnia.network/concepts/conclusion.md) —
> are vision pages with low V1 specificity, candidate deepenings flagged for future loop iterations.
>
> ✅ **Litepaper introduction woven in — realised benchmark reclassified external→on-docs; mission + conclusion triaged out (2026-05-22).**
> All three remaining uncited litepaper framing pages were triaged this run. Only the
> [introduction](https://docs.somnia.network/concepts/introduction.md) carried a V1-relevant new fact, so it alone was
> woven (into [`chain-resources/consensus-and-execution.md`](consensus-and-execution.md), the home of the
> performance + trust material). It was fetched, confirmed real content, then **re-fetched for verbatim figures**. The
> substantive find is a **reclassification**: that article's open question 1 held that the *finer-grained* benchmark
> detail was **external-only** (Chainspect / Messari), but the introduction publishes a **realised peak benchmark
> on-docs** — "achieved 1.05m TPS (ERC-20 swaps)" "running over 100 nodes distributed globally," "50k uniswaps per second
> (across one pool)," "300k NFT mints per seconds (one NFT contract)" — so the *peak* benchmark is now upstream-sourced;
> only a millisecond TTF and a *sustained* (vs peak) TPS remain external. Cross-page coherence captured: the benchmark's
> **"100 nodes"** equals the [security](https://docs.somnia.network/concepts/somnia-blockchain/security.md) page's "100
> globally distributed validator nodes" launch set. It is also a **second** on-docs location (after the developer FAQ)
> for the "1,000,000+ TPS / sub-second finality" headline. The other two pages —
> [somnia-mission](https://docs.somnia.network/concepts/litepaper/somnia-mission.md) and
> [conclusion](https://docs.somnia.network/concepts/conclusion.md) — are **pure vision/philosophy with no concrete
> technical fact**, so they were **triaged out, not woven** (recorded in the article's source caveat, mirroring the
> on-ramps precedent, so the loop stops re-triaging them). All three again name **no AI or agents** — a third/fourth/fifth
> corroboration of the standing negative finding that no `docs.somnia.network` litepaper framing page positions Somnia as
> an AI/agent L1. No new glossary term (the benchmark is a fact, not a concept). No new flags; none of the three names a
> chain ID or uses the stale `dream-rpc` RPC. With this, **every uncited litepaper framing page is now read and accounted
> for** — future iterations should prefer citation re-verification or deepening the residual research gaps (millisecond
> TTF, sustained TPS, block time, the nanoSomi base-gas floor) over re-reading vision pages.
>
> ✅ **Somnia-specific JSON-RPC methods woven in — `realtime_sendRawTransaction` as an agent-loop latency lever (2026-05-22).**
> The [JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md) page was already cited for *subscription
> transport* (WebSocket-only `eth_subscribe`, the 1000-block `eth_getLogs` cap) in
> [`chain-resources/reactivity.md`](reactivity.md) and [`indexing-subgraphs.md`](indexing-subgraphs.md),
> but its **Somnia-specific RPC *methods*** were captured nowhere. A live re-fetch (real content — full `eth_*`/`somnia_*`
> method + endpoint tables, not a GitBook soft-404) surfaced them, and they were woven into
> [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md) as a new *Somnia-specific JSON-RPC
> methods* section (the toolchain article being the home of "the RPC the toolchain talks"; it did **not** previously cite
> the page). **Strongest new, V1-relevant fact:** **`realtime_sendRawTransaction`** submits a tx and **waits for the
> receipt in one round-trip**, collapsing the `eth_sendRawTransaction` → poll-`eth_getTransactionReceipt` loop — a real
> latency lever for the *sequential* negotiation loop (each turn waits for the prior tx to confirm), pairing with the
> chain's [same-block reactivity](reactivity.md) story. Recorded as a new **open question 4** (adopt it
> vs. portable `eth_*` tooling — it ties submission code to Somnia). Sibling methods captured + cross-linked to the
> articles that own them: `somnia_reactivityGetSubscriptions` (RPC reads of on-chain reactivity subs →
> [reactivity](reactivity.md)), `somnia_getSessionAddress`/`somnia_sendSessionTransaction` (session keys →
> [account-abstraction](account-abstraction.md)), `somnia_getStatistics` (live telemetry, not a headline
> number). Two compatibility caveats recorded: `eth_subscribe` does **not** support `newPendingTransactions`, and
> **EIP-4844 blob** (type `0x3`) txns are unsupported (neither affects V1). The page also re-states the chain IDs in hex —
> **`0x13a7` (`5031`) / `0xc488` (`50312`)** — a **fourth** upstream corroboration after network-info, the Hardhat
> `customChains` entry, and the agents quickstart. New glossary term: *`realtime_sendRawTransaction`*. ⚠️ Method names are
> verbatim but one-line behaviours are **summarised** from the AI fetch — flagged inline + in the source caveat: re-read
> the page for exact request/response shapes before wiring submit-and-wait into agent code. No new chain-ID conflict.
>
> ✅ **Native value-transfer primitives woven in — the settlement-transfer mechanism, finally sourced (2026-05-22).** A
> live [`llms.txt`](https://docs.somnia.network/llms.txt) diff against this folder's citations surfaced three
> genuinely-uncited pages (`using-native-somi-stt`, `somnia-mainnet-releases`, `create-erc20-tokens`); the
> V1-strongest, [using native SOMI/STT](https://docs.somnia.network/developer/building-dapps/tokens-and-nfts/using-native-somi-stt.md),
> was fetched, confirmed **real content** (sharpened-audit-rule check — it carries the worked `payToAccess`/tip-jar
> Solidity, not a GitBook soft-404), and woven into [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md)
> as a new *Moving native value — the settlement-transfer primitive* section. This closes a standing gap: every article
> *asserted* "only value moves on-chain" (settlement amount + gas) but **none sourced *how* native value moves in a
> contract**. Facts captured verbatim: SOMI "is the native coin of the Somnia Network, similar to ETH on Ethereum,"
> **"No ERC20 functions are needed,"** and the three primitives — a `payable` function reading `msg.value`
> (`payToAccess`), a `receive() external payable`, and `payable(owner).transfer(address(this).balance)`. **Strongest V1
> framing (a reconciliation, not a transcription):** the intro page presents `.transfer()` as a **direct push with no
> security commentary**, while the security-101 layer two paragraphs up mandates [pull-payment](../GLOSSARY.md#p) +
> [reentrancy guard](../GLOSSARY.md#r) for a fund-release path — so `ClaimSettlement.sol` *receives* the payer deposit with
> these primitives but *releases* via pull-payment, **never** the naive push. New concept-keyed glossary term: *Payable
> function / native value transfer*. ⚠️ Recorded so the loop stops re-triaging: the two sibling uncited pages are
> off-V1 — `create-erc20-tokens` (V1 settles in the **native** coin, not an ERC-20) and `somnia-mainnet-releases` (a
> release-log/changelog, not a primitive). The page names no chain ID, no RPC URL, and no gas figure — no new flags.
>
> ✅ **DAO example woven in as the settlement-contract counter-example; Privy auth read (2026-05-22).** A fresh
> [`llms.txt`](https://docs.somnia.network/llms.txt) diff against this folder's 112 cited URLs surfaced two genuinely
> uncited, V1-adjacent pages. (1) The [DAO smart-contract tutorial](https://docs.somnia.network/developer/building-dapps/example-applications/dao-smart-contract.md)
> — confirmed **real content** (sharpened-audit-rule check; full Solidity ^0.8.28, not a GitBook soft-404) — is the
> upstream worked example **structurally nearest to `ClaimSettlement.sol`**: `deposit() payable` → `votingPower`-gated
> `createProposal(string)` → time-boxed `vote()` (`votingDuration = 10 minutes`) → `executeProposal()` releasing funds
> after the deadline if yes-votes win. Woven into [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md)
> as a new subsection under *Moving native value*, **as a counter-example**: its release line
> `payable(proposal.proposer).transfer(0.001 ether)` is the [pull-payment](../GLOSSARY.md#p) rule violated in working code —
> `proposal.executed = true` before the call is correct CEI ordering (blocks *re-execution*) but is **not** a
> [reentrancy guard](../GLOSSARY.md#r); the contract leans on `.transfer()`'s 2300-gas stipend, fragile since EIP-1884. It
> also declares `modifier onlyOwner` and **never uses it**. V1 takeaway recorded: borrow the *control flow* (gated
> deposit, time-boxed approval, approve-then-release), never the release line — `ClaimSettlement` releases via
> pull-payment behind a reentrancy guard. ⚠️ Its free-text `string description` proposal field is the same **PHI hazard**
> as the on-chain-chat `content` field — Curie's on-chain proposal record must be structured code/state/hash/amount.
> **Eighth** sighting of the stale `dream-rpc.somnia.network` testnet RPC; the three companion `dao-ui-tutorial-p{1,2,3}`
> pages are browser/React UI (off the headless V1 loop) — triaged out, not woven. (2) The
> [authenticating-with-Privy](https://docs.somnia.network/developer/building-dapps/wallet-integration-and-auth/authenticating-with-privy.md)
> page — the last unread page for a provider this folder repeatedly names — was fetched and confirmed **browser/React-only**
> (`PrivyProvider`, `usePrivy`, `useCrossAppAccounts().sendTransaction`); **no** server-side/headless signer, no
> paymaster/bundler. This **corroborates** account-abstraction **open question 4**: Privy is now the *second* confirmed
> wallet provider (after Thirdweb's two tutorials) whose every documented Somnia flow is a browser one — the headless
> server-side signing path remains documented only via the off-domain Pimlico link. Chain ID `50312` agrees with
> network-info. No new glossary term (both are worked examples / vendor flows, not new concepts). With this, the
> `llms.txt` diff leaves only off-V1 surfaces uncited (NFT/DEX/on-ramp/wallet-login tutorials, listing & index pages).
>
> ✅ **Legal cluster + SOM0/SOM1 triaged — AML/compliance posture woven as a substrate-viability positive (2026-05-22).**
> A fresh [`llms.txt`](https://docs.somnia.network/llms.txt) diff against this folder's 114 cited URLs left only off-V1
> surfaces uncited, plus one genuinely-new cluster never touched: `concepts/miscellaneous/legal/`. Four candidates were
> triaged. Only [AML compliance](https://docs.somnia.network/concepts/miscellaneous/legal/aml-compliance.md) carried a
> V1-adjacent fact and was woven into [`chain-resources/tokenomics-and-gas.md`](tokenomics-and-gas.md)
> (the home of "off-V1 but substrate-viability" material, beside on-ramps/governance/allocation): confirmed **real
> content** (a substantive AML/CFT policy naming the three Somnia entities — ServiceCo/TokenCo/NetworkCo — and Campbells
> Regulatory Services; not a GitBook soft-404). **Key framing:** a healthcare claims-settlement protocol moving real
> value is heavily regulated, so the *chain operator's own* AML/CFT/KYC/sanctions-screening posture is a fair
> due-diligence question for a "neutral settlement substrate" pitch — and upstream answers it with a named voluntary
> program (verbatim: *"We do not engage in business relationships or transactions with… individuals or entities on
> sanctions lists"*). Crucially it imposes **no developer obligation** and adds **nothing** to the V1 testnet demo
> (synthetic claims, faucet STT, no real value/PHI); it matters only on **mainnet**, where a live protocol carries its
> *own* AML/KYC obligations regardless. The other three were recorded as off-V1 so the loop stops re-triaging them:
> [MiCAR whitepaper](https://docs.somnia.network/concepts/miscellaneous/legal/micar-whitepaper.md) is a **stub** (a
> `/files/…` embed link, no rendered body — MiCA content asserted but unreadable, flagged for human review), and the
> ecosystem [`som0`](https://docs.somnia.network/ecosystem/protocols/som0.md) /
> [`som1`](https://docs.somnia.network/ecosystem/protocols/som1.md) protocol pages are real content but
> **gaming/metaverse-scoped** (SOM0 = Object/Attestation/Marketplace protocols for "Virtual Societies"; SOM1 = an
> Entity-Component-System framework for composable virtual worlds) — no V1 settlement primitive. **No new glossary term**
> (chain-operator posture / gaming protocols, not V1 concepts; consistent with the on-ramps/allocation precedent). ⚠️
> The AML page's structural detail is **summarised from an AI fetch** — only the quoted sentence is verbatim; re-read for
> the exact program before relying on specifics. The page names no chain ID and no RPC URL. With this, the `llms.txt`
> diff's only remaining uncited surfaces are off-V1 (NFT/DEX/wallet-login/on-ramp tutorials, legal sub-pages, and
> listing/index pages).
>
> ✅ **Ecosystem oracle listing read — "redundant" assumption upgraded to a verified two-provider roster (2026-05-22).**
> A fresh full [`llms.txt`](https://docs.somnia.network/llms.txt) diff this run (**180 doc paths**) against this folder's
> **118** cited URLs left **no genuinely new V1-relevant page** — every uncited path is off-V1 (NFT/DEX/wallet-login/
> on-ramp/legal/metaverse tutorials), a known duplicate route (the litepaper now also serves under top-level
> `/litepaper/*` and `/somnia-litepaper/*` alongside the cited `/concepts/litepaper/*` — content already covered), a
> landing/index page, or the known `…-with-thirdweb.md` soft-404 (the truncated `…-with-thirdw.md` stays canonical). The
> one item worth acting on was an **untested assumption**: the
> [ecosystem oracle listing](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/oracles.md)
> had been triaged as "redundant with DIA+Protofire" in prior runs but **never actually read** — unsafe, since the
> sibling [`wallet-providers`](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/wallet-providers.md)
> and [`account-abstraction`](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/account-abstraction.md)
> ecosystem listings each surfaced a **new** vendor (Sequence, Pimlico) when read. Fetched, confirmed **real content**
> (sharpened-audit-rule check — not a GitBook soft-404), and woven into
> [`chain-resources/oracles-and-vrf.md`](oracles-and-vrf.md). The finding is a **verified negative**:
> the page names **exactly DIA + Protofire**, no third oracle provider — a stronger statement for a settlement-pricing
> decision than an unread "probably redundant." Its one positive datum is a verbatim line explaining *why the two are
> interface-interchangeable*: Protofire "deploys custom, compatible oracles using the same data providers and node
> operators, allowing protocols to connect to their network without modifying Smart Contracts" — i.e. Protofire is the
> Chainlink-`AggregatorV3Interface`-compatible redeployment over the same upstream data DIA uses, so for V1 the DIA-vs-
> Protofire choice is *interface preference, not data-source trust*. The *Oracle* glossary entry was enriched to match.
> No new glossary term (the glossary is concept-keyed, not vendor-keyed); the page names no chain ID and no RPC URL — no
> new flags. With this, the `ecosystem-tools/oracles` listing is **read and closed**; the full 180-path diff confirms the
> **V1-relevant frontier is exhausted** — future runs should prefer citation re-verification or the residual research
> gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) over re-reading listing pages.
>
> ✅ **Gas-fees page re-fetched — fiat cost curve + retention-priced storage captured; nanoSomi floor re-confirmed unpublished (2026-05-22).**
> Attacking the standing **nanoSomi base-gas-floor** research gap (the most V1-relevant residual, since it feeds the
> per-claim cost model), the [tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md) page was
> re-fetched live (real content — full pricing/storage tables, not a GitBook soft-404) and
> [`chain-resources/tokenomics-and-gas.md`](tokenomics-and-gas.md) deepened. **Headline (a verified
> negative):** the nanoSomi numeric floor is **still not published** — every fee figure on the page is **fiat (USD)** —
> so that flag holds, now re-confirmed 2026-05-22. But two tables the article lacked were captured verbatim: (1) the
> **dynamic USD pricing curve** (gas price falls with throughput up to a 90% discount; a `21k`-gas tx costs `$0.00012`
> at 0 TPS → `$0.00001` at 400 TPS), replacing the prior vague "on the order of `$10⁻⁹`–`$10⁻¹⁰`" with the sourced
> figures + named parameters (Price Adjustment Threshold `95ms`, Increase/Decrease `2x`/`50%`, Voting Cycle `1 sec / 10
> blocks`); and (2) — the genuinely new fact — a **retention-priced `SSTORE` table** with **no Ethereum analogue**: a
> 32-byte write is `20,000` gas for 1 hour rising to `200,000` for `Indefinite`, so a permanent audit anchor is budgeted
> at the `Indefinite` (`200,000` gas/slot) ceiling, `10×` the 1-hour floor. New concept-keyed glossary term: *Storage
> rent (time-based storage pricing)*. ⚠️ **One flag for human review:** the page is **internally inconsistent** — its
> table base gas price (`$5.49E-09`, self-consistent with the discount column) disagrees with its prose "Base Price"
> `$0.00000000616` (`$6.16E-09`) by ~12%; recorded in open question 1, not averaged. Both tables came via the AI fetch
> (cells reproduced verbatim within quotes) — re-read for exactness before wiring a cost model. PHI/gas boundary
> unchanged: storage pricing meters hashes/state/amounts, never clinical text.
>
> ✅ **Network-overview page read — testnet-first workflow sourced; confirmed negative for the finality/block-time gaps (2026-05-22).**
> The [network overview (mainnet vs testnet)](https://docs.somnia.network/developer/network-info/network-overview-mainnet-testnet.md)
> page had been **listed in this README's site map since the 2026-05-20 capture but never read** — and it sits in the
> *Network info* section right beside the chain-ID table, making it a natural-looking candidate for the standing
> finality/block-time/TPS research gaps. It was fetched live, confirmed **real content** (sharpened-audit-rule check —
> not a GitBook soft-404), and woven into [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md)
> at the end of the *Local testing & forking* section as **the progression the fork sits inside**. **Verified negative
> (the main result):** the page is **purely qualitative** — it publishes **no** block time, finality-in-ms, TPS, or gas
> figure (and no chain ID or RPC URL), so it does **not** close any residual research gap; recorded explicitly so future
> loops stop re-triaging it as a numbers source. Its **positive** contribution is a verbatim upstream source for the
> local-fork → Shannon → mainnet discipline the article + ROADMAP already assert as Curie's own practice: *"Every project
> should pass through Testnet before moving to Mainnet," "Start on Testnet,"* and *"Audit before launch"* — plus the
> *"all transactions on this chain are final and irreversible"* mainnet framing, the qualitative finality statement that
> motivates rehearsing an *audit-anchoring* loop on Shannon (`50312`) before writing a settlement hash that cannot be
> retracted. No new glossary term (workflow guidance, not a new concept); no new flags (no chain-ID conflict, no stale
> `dream-rpc` RPC). With this, the *Network info* section's two developer pages (network-info, network-overview) are
> both read and accounted for.
>
> ✅ **Gas-fees base-price inconsistency confirmed real upstream by a second fetch — not a transcription artifact (2026-05-22).**
> With the V1 frontier exhausted, this run reconciled the standing **flagged discrepancy** in
> [`chain-resources/tokenomics-and-gas.md`](tokenomics-and-gas.md) open question 1 (prose base price
> `$0.00000000616`/`$6.16E-09` vs the dynamic table's `$5.49E-09`). The flag itself noted both figures came via an
> AI-summarised fetch, leaving open whether the ~12% gap was an *upstream* inconsistency or *our own* mis-transcription —
> the same caution the soft-404 audit rule applies to links, applied here to numbers. A **second, independent** targeted
> re-fetch of [tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md) returned the prose
> figures **verbatim** (*"Base Price: $0.00000000616 per gas unit"*, *"Min gas price: $0.000000000616 per gas unit (at
> 400 TPS)"*) beside the identical `$5.49E-09`→`$5.49E-10` six-row table, so two fetches now corroborate that **both
> numbers are on the page as written** — it is a **real upstream inconsistency**, not a fetch artifact. The re-fetch also
> **sharpened** it: the prose "Min gas price" is explicitly tagged **"(at 400 TPS)"** — the *same* operating point as the
> table's 90%-discount last row — so `$6.16E-10` (prose) and `$5.49E-10` (table) describe the **identical** point and
> **cannot** be explained away as "static base vs dynamic curve"; it is a genuine same-point contradiction. Resolution
> recorded in open question 1 + the source caveat: treat the **table** as the operative dynamic model (internally
> self-consistent across all six rows), the prose pair as a separate possibly-stale rounding, and **do not average**.
> The nanoSomi base-gas floor remains the residual research gap (every figure is fiat USD; re-confirmed unpublished). No
> new glossary term; no new chain-ID conflict; no stale `dream-rpc` RPC on the page.
>
> ✅ **Account-abstraction open question 4 closed — a Pimlico *Somnia* bundler endpoint confirmed (2026-05-22).** With the
> `docs.somnia.network` V1 frontier exhausted, this run closed the most *actionable* standing open question instead of
> re-reading listing pages. [`chain-resources/account-abstraction.md`](account-abstraction.md) open
> question 4 (headless server-side sponsorship) had been narrowed to one residual sub-task — *"verify a Somnia Pimlico
> endpoint exists"* — because the only headless flow Somnia points at (the off-domain
> [Pimlico tutorial](https://docs.pimlico.io/guides/tutorials/tutorial-1) the ecosystem AA page links) used a **Sepolia**
> endpoint. Following that same permitted off-domain path one hop further to Pimlico's
> [supported-chains list](https://docs.pimlico.io/guides/supported-chains) (fetched **twice**, Somnia rows quoted
> verbatim and identical both times) **confirms** Pimlico runs a Somnia bundler+paymaster: **Somnia Testnet** (`50312`,
> slug `somnia-testnet`) and **Somnia Mainnet** (`5031`, slug `somnia`), each EntryPoint **v0.6/v0.7** (v0.8 ❌) — so a
> headless `permissionless.js`/`viem`/`privateKeyToAccount` agent can point a `smartAccountClient` at
> `https://api.pimlico.io/v2/somnia-testnet/rpc?apikey=…` today. Two cross-source corroborations fall out: Pimlico's
> **`5031`/`50312`** independently agree with [network-info](https://docs.somnia.network/developer/network-info.md)
> (re-refuting the agent-kit's stale `50311`), and Pimlico's **v0.7** matches the EntryPoint v0.7 Somnia's network-info
> publishes. Updated the *Pimlico path* subsection caveat, open question 4, and the source caveat in that article, plus
> the **Bundler** and **Paymaster** glossary entries (flipped from "Somnia endpoint unconfirmed" to confirmed). ⚠️ **Two
> honest limits held:** (a) both Pimlico pages are **off-domain** (`docs.pimlico.io`), cited only because the Somnia
> ecosystem page links out to Pimlico — *not* a `docs.somnia.network`-published fact; the Somnia docs themselves still
> show no Pimlico endpoint; (b) this closes the **documented-path** test only — no sponsored `UserOperation` was actually
> run over Somnia, so latency/policy setup and an EIP-7702 "same-EOA" benchmark stay for the implementation branch. No
> new glossary term (Pimlico is vendor-keyed; the glossary is concept-keyed). PHI boundary unchanged (a bundler/paymaster
> relays gas + hash/state/address/amount calldata, never payload). The residual research gaps (millisecond TTF, sustained
> TPS, block time, nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **`subscribe`-vs-`watch` note sharpened — an internal inconsistency in our own article fixed (2026-05-22).** With the
> V1 frontier exhausted, this run re-verified three load-bearing citations under the sharpened soft-404 rule (body, not
> status code): the [developer FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md)
> (real content; "1,000,000+ TPS", "Sub-second transaction finality", and "IceDB … 15-100 nanosecond read/write" intact;
> **"Block Time: Optimized for real-time applications"** still carries **no number** — block-time gap re-confirmed an
> upstream gap; the page links to **no** benchmark source — chainlist.org, a faucet, a Notion verify guide — so there is
> no permitted off-domain path to a finality-in-ms number from here), the
> [IceDB litepaper page](https://docs.somnia.network/concepts/somnia-blockchain/somnias-icedb.md) (real content; "15-100
> nanoseconds", "fully deterministic performance", the per-op "performance report", and snapshot-without-Merkle-tree
> quotes all intact, matching [`consensus-and-execution.md`](consensus-and-execution.md)), and the
> [off-chain reactivity reference](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md). The reactivity
> re-fetch surfaced and **corrected a precision error in our own doc**: two notes in
> [`chain-resources/reactivity.md`](reactivity.md) said the reference page "never mentions `subscribe`",
> yet the same article elsewhere *quotes* that page using `eth_subscribe` ("so you don't have to drive `eth_subscribe`
> directly") — an internal contradiction. A literal-text re-fetch (run twice) confirms the precise truth: the page
> documents **only** `sdk.watch()` as the **SDK** method, and the token `subscribe` appears on it **solely** as the
> JSON-RPC transport `eth_subscribe`/`eth_unsubscribe` that `sdk.watch()` wraps — **never** as an `sdk.subscribe()` SDK
> method. Both notes were tightened to that wording, removing the contradiction; the V1 decision (write `watch()`, treat
> the wildcard tutorial's `sdk.subscribe` as undocumented drift) is unchanged. No new glossary term; no new flags; no
> chain-ID conflict. The residual research gaps (millisecond TTF, sustained TPS, block time, nanoSomi base-gas floor)
> remain upstream gaps, not stale links.
>
> ✅ **Developer how-to-guides index triaged — canonical truncated slug corroborated; a contact-email discrepancy flagged (2026-05-22).**
> A fresh [`llms.txt`](https://docs.somnia.network/llms.txt) diff this run (**180 doc paths**) against this folder's
> citations surfaced one previously-uncited *developer-section* page, [developer how-to-guides](https://docs.somnia.network/developer/how-to-guides.md)
> (every other 0-reference path was off-V1 — NFT/DEX tutorials, the ecosystem-showcase listing). It was fetched, confirmed
> **real content** (sharpened-audit-rule check — an index/landing page, not a GitBook soft-404), and **triaged out, not
> woven**: it is a curated DevRel hub linking only pages already covered here, introducing **no new V1 primitive** —
> recorded so the loop stops re-triaging it (the on-ramps/mission/conclusion precedent). It contributes two citable facts,
> both recorded in the source caveat of [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md):
> (1) **independent corroboration of the canonical truncated slug** — upstream's *own* how-to index links
> `gasless-transactions-with-thirdw.md` (truncated), not the full `…-with-thirdweb.md` that soft-404s, strengthening the
> long-standing slug flag from "the full slug 404s" to "and the curated index uses the truncated one"; and (2) ⚠️ **a
> contact-email discrepancy flagged for human review** — the how-to index gives DevRel contact
> `developers@somnia.foundation` (Discord `#dev-chat` / `@emreyeth`), whereas the
> [responsible-disclosure policy](https://docs.somnia.network/developer/security/responsible-disclosure-policy.md) gives
> `developers@somnia.network` — a `.foundation` vs `.network` split across two upstream pages, material because the
> disclosure section is woven in as Curie's own disclosure-posture template. *(Reconciled the next run — see below.)*
> No new glossary term (a vendor/DevRel index, not a V1 concept); the page names no chain ID, RPC URL, or gas figure.
> With this, the 180-path diff's only remaining uncited surfaces are off-V1 (NFT/DEX/wallet-login tutorials, the
> ecosystem-showcase listing, legal/index pages).
>
> ✅ **Contact-email discrepancy reconciled to `.network` (2026-05-22).** The prior run's `.foundation` vs `.network`
> flag (the how-to index gives `developers@somnia.foundation`; the
> [responsible-disclosure policy](https://docs.somnia.network/developer/security/responsible-disclosure-policy.md) gives
> `developers@somnia.network`) was resolved this run with a tiebreaker fetch, **without adding a sub-article**. The
> [developer FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md)
> (already cited in this folder; same support-and-community section as the how-to index) gives
> **`developers@somnia.network`** and — decisively — pairs it with the **exact same `#dev-chat` Discord / `@emreyeth`
> Telegram** contact block the how-to index pairs with `.foundation`. So the canonical DevRel contact block uses
> `.network`; `.foundation` is corroborated **2-to-1** (responsible-disclosure + developer-FAQ vs. the how-to index
> alone) and reads as an index-page typo, not a separately-routed alias. The sibling
> [general FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/general-faqs.md)
> was also fetched and publishes **no** email (Discord/GitHub only) — neutral. Resolution recorded in the source caveat
> of [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md): Curie's disclosure template uses
> `developers@somnia.network`, still to be confirmed with Somnia before a real report. No new citation domain (both FAQ
> pages are `docs.somnia.network`), no new glossary term, no chain-ID conflict, and no stale `dream-rpc` RPC. The
> residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged —
> upstream gaps, not stale links.
>
> ✅ **Oracle/VRF settlement-pricing cluster re-verified — a stale "both networks" generalization corrected (2026-05-22).**
> A fresh [`llms.txt`](https://docs.somnia.network/llms.txt) diff this run (**159 doc paths**) against this folder's
> citations again left **only off-V1 surfaces uncited** (NFT/DEX/ERC721/IPFS-metadata tutorials, the wallet-login kits
> *metamask*/*connectkit*/*rainbowkit*, the Banxa on-ramp sub-page, legal sub-pages, the litepaper's duplicate
> `/litepaper/*`+`/somnia-litepaper/*` routes, and listing/index pages) — and confirmed the WebSocket-listener page
> ([listening-to-blockchain-events-websocket](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/listening-to-blockchain-events-websocket.md))
> is already read and woven (its ethers.js-v6 code is quoted in [`indexing-subgraphs.md`](indexing-subgraphs.md)),
> so the V1-relevant frontier stays exhausted. With no new page to weave, this run re-verified the
> **highest-consequence citations in the folder** — the settlement-pricing addresses, where a wrong address means a wrong
> settlement rate — which had last been checked 2026-05-21, a day older than the consensus/reactivity/gas cluster the
> recent runs re-verified. All three dedicated [DIA](https://docs.somnia.network/developer/building-dapps/oracles/dia-price-feeds.md),
> [Protofire](https://docs.somnia.network/developer/building-dapps/oracles/protofire-price-feeds.md), and
> [VRF](https://docs.somnia.network/developer/building-dapps/oracles/using-verifiable-randomness-vrf.md) pages were
> re-fetched live under the sharpened soft-404 rule (real body, not just HTTP `200`) and **match verbatim** — both DIA
> oracle addresses, the 0.5%/120s/24h refresh params, the seven keys, the VRF Direct-Funding constants
> (`2_100_000`/`3`/`3`), and the Protofire 5-tuple + 8-decimals + ETH/BTC/USDC-USD pairs. **One precision catch:** the
> [`oracles-and-vrf.md`](oracles-and-vrf.md) prose had generalized the per-pair OCR-aggregator + read-only-proxy
> address split to "**both networks**," but the live Protofire page shows it is **mainnet-only** (testnet lists a single
> address per pair, no aggregator/proxy split) — corrected in the body, header re-verification line, and source caveat,
> with the worked USDC/USD aggregator/proxy addresses now quoted. No new glossary term; no new flags; no chain-ID
> conflict. The residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are
> unchanged — upstream gaps, not stale links.
>
> ✅ **Native-agents *economics* cluster re-verified — the per-claim cost-model inputs confirmed un-drifted (2026-05-22).**
> With the V1-relevant frontier exhausted (a fresh `llms.txt` re-fetch reports **229 doc paths**; the only new-vs-cited
> deltas are off-V1 NFT/DEX/wallet-login/legal tutorials and listing/index pages, and all 9 **agents-section** pages are
> already woven into [`chain-resources/native-agents.md`](native-agents.md)), this run re-verified the
> **highest-consequence, stalest** citation cluster in the folder. The starred native-agents article's **deposit
> economics** — the figures that feed the per-claim cost model in [`chain-resources/tokenomics-and-gas.md`](tokenomics-and-gas.md),
> where a wrong number means a wrong demo budget — had last been re-checked **2026-05-21**, a day behind the
> oracle/consensus/reactivity/gas-fees-tokenomics clusters the recent runs re-verified on 2026-05-22. Three pages were
> re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **match verbatim**:
> [gas-fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md) (`minPerAgentDeposit` `0.01`; per-agent
> `0.03`/`0.07`/`0.10`; worked `msg.value` `0.12`/`0.24`/`0.33` SOMI; the `getRequestDeposit()`-floor time-out footgun;
> `defaultTimeout` 15 min; `perMember = median(executionCosts)`; `receive()`/`NativeTransferFailed`),
> [LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference.md) (the four-method surface, the
> `inferString` signature, the `inferToolsChat` tuple + `stop`/`tool_calls` semantics), and
> [custom-consensus](https://docs.somnia.network/agents/invoking-agents/custom-consensus.md) (Majority/Threshold
> definitions, `ConsensusType` enum `Majority`=0/`Threshold`=1, the "3 of 5" default, the median/XOR aggregations). No
> figure has drifted; the article's header re-verification block and source caveat now carry the 2026-05-22 economics
> re-check date. No new glossary term; no new flags; no chain-ID conflict (the chain IDs `5031`/`50312` on the quickstart
> remain a third corroboration of network-info). The two standing native-agents gaps (JSON-API HTTP-method/auth/size
> caveats; expected end-to-end inference latency for a 90-second demo) and the folder's residual research gaps
> (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Core deploy-toolchain cluster re-verified — first re-check since the 2026-05-20 capture; a stale chain-ID citation corrected (2026-05-22).**
> With the V1-relevant frontier exhausted (a fresh [`llms.txt`](https://docs.somnia.network/llms.txt) diff this run —
> **178 doc paths** — surfaced no genuinely new V1 page; every uncited path is off-V1 NFT/DEX/wallet-login/legal/listing
> material), this run re-verified the **stalest high-consequence cluster left untouched by the recent re-verification
> passes**: the **core deploy toolchain** in [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md)
> — the exact commands and config the `implementer` branch will type, captured 2026-05-20 and **never re-fetched since**
> (every later deepening touched *adjacent* pages: forking, security-101, RPC providers, JSON-RPC methods, native value).
> Four pages were re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`). **Three match
> verbatim:** [Foundry](https://docs.somnia.network/developer/development-frameworks/deploy-with-foundry.md) (`forge init`
> → `forge build` → `forge create --rpc-url … --private-key …`; `pragma solidity ^0.8.28`; STT-faucet + private-key
> prerequisites), [Hardhat](https://docs.somnia.network/developer/development-frameworks/deploy-with-hardhat.md)
> (TypeScript-with-viem scaffold; Solidity `0.8.28`; the `networks.somnia` block; `npx hardhat ignition deploy … --network
> somnia`), and [viem](https://docs.somnia.network/developer/development-frameworks/using-the-viem-library.md)
> (`import { somniaTestnet } from "viem/chains"`; `createPublicClient`/`createWalletClient` with `transport: http()`;
> `readContract`/`writeContract`/`waitForTransactionReceipt`) — un-drifted, no figure or command moved. **One real drift
> found and corrected:** the [verify guide](https://docs.somnia.network/developer/development-frameworks/verifying-via-explorer.md)
> is now **mainnet-only** (`chainId 5031`, verifier `https://mainnet.somnia.w3us.site/api/`, `forge verify-contract …
> --verifier blockscout`), carrying **no `50312`** — yet this README's and the *Chain ID* glossary entry's
> chain-ID-resolution notes attributed the second `50312` corroboration to *that* page. A targeted live re-fetch confirms
> the testnet `customChains` entry (`network: "somnia", chainId: 50312, apiURL: "https://shannon-explorer.somnia.network/api",
> apiKey: "empty"`) actually lives in the **Hardhat deploy guide**; the citation in both files was re-pointed there. The
> chain-ID **resolution is unaffected** — `50312` still rests on three pages (network-info, the Hardhat guide, the agents
> quickstart) plus the JSON-RPC hex `0xc488`; only the wording was wrong, not the value. The article body
> ([`smart-contract-dev.md`](smart-contract-dev.md) verification section + open question 3) already drew
> the Hardhat-vs-verify-guide / testnet-vs-mainnet split correctly, so it needed no change. ⚠️ Recorded: all three core
> deploy pages (Foundry, Hardhat, viem) still print the **stale `dream-rpc.somnia.network` testnet RPC** in their examples
> — the **ninth–eleventh** sightings; precedence rule reaffirmed (the canonical `api.infra.testnet` endpoint in the
> connection table wins). Note the viem example relies on `transport: http()` with **no explicit URL**, so V1 viem code
> silently inherits whatever RPC the bundled `somniaTestnet` chain object defaults to — pass the canonical endpoint
> explicitly rather than trusting the default. No new glossary term; the residual research gaps (millisecond TTF, sustained
> TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Data Streams SDK cluster re-verified — full signatures captured, two new V1 facts (2026-05-22).** With the V1
> frontier exhausted and the recent runs having re-verified the oracle, native-agent-economics, gas/tokenomics,
> consensus/IceDB, reactivity, and core-deploy clusters on 2026-05-22, the **stalest high-consequence cluster left** was
> the `sdk.streams.*` surface in [`chain-resources/data-streams.md`](data-streams.md) — the methods the
> `implementer` branch will type, last re-checked **2026-05-21**. Both core pages were re-fetched live under the
> **sharpened soft-404 rule**: the [SDK methods guide](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md)
> ("Data Streams in Somnia represent structured, verifiable data channels.") and the
> [quickstart](https://docs.somnia.network/developer/data-streams/quickstart.md) both render real content. **Every**
> method name in the surface table, the `@somnia-chain/streams` package, the `set(d: DataStream[]): Promise<Hex | null>`
> signature, and the quickstart's `SchemaEncoder → computeSchemaId → encodeData → set → getByKey` flow **match verbatim —
> un-drifted.** The re-fetch captured the **full type signatures** the prior name-only pass had not, yielding two
> genuinely-new, V1-relevant facts now woven into the article: (1) the read methods share a **union return type**
> `Promise<Hex[] | SchemaDecodedItem[][] | null>` — a read can return raw bytes **or** already-decoded items, so the
> decode step is not always separate (sharpening the read-path/`decodeData` story); and (2) the canonical
> `registerDataSchemas` second param is **`ignoreRegisteredSchemas`**, of which the hello-world tutorial's
> `ignoreAlreadyRegistered` is shorthand — recorded as a **third** name-drift note. Also captured:
> `getAllPublisherDataForSchema` takes a `SchemaReference` (not the bare `SchemaID` the point/range reads take). No new
> glossary term; no new flags; neither core page names a chain ID or uses the stale `dream-rpc` RPC. The residual research
> gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale
> links.
>
> ✅ **Indexing deploy + WebSocket-listener cluster re-verified — last high-consequence cluster still on a 2026-05-21 check (2026-05-22).**
> With the V1 frontier exhausted and the recent runs having re-verified the oracle, native-agent-economics,
> gas/tokenomics, consensus/IceDB, reactivity, core-deploy, and Data-Streams clusters on 2026-05-22, the **stalest
> high-consequence cluster left** was the subgraph-deploy + WebSocket-listener surface in
> [`chain-resources/indexing-subgraphs.md`](indexing-subgraphs.md) — the exact `graph deploy` commands
> and ethers-v6 listener code the `implementer` branch will type, last re-checked **2026-05-21**. All three core pages
> were re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **match verbatim —
> un-drifted:** the [Ormi guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph.md)
> (`graph deploy mytoken --node …/deploy --ipfs …/ipfs --deploy-key`; `graph init --network somnia-testnet`; the three
> scaffolded files; the `Transfer @entity(immutable: true)` schema; the "Ormi will return a GraphQL endpoint" line), the
> [Protofire guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/protofire-subgraph.md)
> (the `--node https://proxy.somnia.chain.love/graph/somnia-testnet … --access-token` deploy command; the
> `somnia.chain.love/graph/17` explorer; testnet-only scope; the still-stale `dream-rpc.somnia.network` `networks.json`
> RPC — defer to network-info), and the
> [WebSocket listening guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/listening-to-blockchain-events-websocket.md)
> (ethers-v6 `WebSocketProvider("wss://api.infra.testnet.somnia.network/ws")` + `_waitUntilReady()`; the 30 s
> `getBlockNumber` keepalive; the `currentBlock - 100` `queryFilter` backfill; the 5-retry / 5 s-backoff reconnect loop).
> ⚠️ **One scheme nuance recorded, not flipped:** the re-fetch reported the Protofire create-subgraphs landing as
> `https://somnia.chain.love/`, but `WebFetch` upgrades HTTP→HTTPS and renders through a summarizing model, so a scheme
> observed *through* it is unreliable evidence; the deliberately-corrected `http://` value from the 2026-05-21 pass
> stands, and our own article's table↔body internal inconsistency (table `http://` vs body `https://`) was reconciled to
> `http://`. The landing-page scheme is low-consequence (browsers redirect either way) and not reliably verifiable
> through our tooling; the deploy/query *hosts* (`api.subgraph.somnia.network`, `proxy.somnia.chain.love`) are
> unaffected. No new glossary term; no new flags; no chain-ID conflict. With this, **every high-consequence citation
> cluster in the folder has now been re-verified on 2026-05-22.** The residual research gaps (millisecond TTF, sustained
> TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **L1-audit human-review flag advanced — report embeds confirmed unverifiable from the docs (2026-05-22).** With the
> V1 frontier exhausted and every high-consequence cluster freshly re-verified, this run resolved a standing
> *flagged-for-human-review* item rather than re-running a cluster. A fresh [`llms.txt`](https://docs.somnia.network/llms.txt)
> diff again left **only off-V1 surfaces uncited** (NFT/DEX/metaverse tutorials, MetaMask-housekeeping get-started pages,
> the litepaper's duplicate `/litepaper/*`+`/somnia-litepaper/*` routes, listing/index pages) — frontier confirmed
> exhausted. The advanced flag is the [miscellaneous/audits](https://docs.somnia.network/concepts/miscellaneous/audits.md)
> page's assertion of a "Smart Contract Report" + "L1 Audit Report," previously recorded as *asserted but unverifiable
> (internal file IDs only)* in [`chain-resources/consensus-and-execution.md`](consensus-and-execution.md).
> The two `{% file %}` embeds were followed to their GitBook file IDs (`J9ysRVCk8BfJ8CvBlUbb`,
> `bGC0VGg2sX0h8XwPNJm9`); fetching the L1 report at `https://docs.somnia.network/files/bGC0VGg2sX0h8XwPNJm9`
> **returns GitBook's 404 page** (live 2026-05-22) — the binaries are served from a separate GitBook CDN host the `.md`
> rendering does not expose, so the firm, date, scope, and findings are **unobtainable from `docs.somnia.network`**. The
> finding was woven into that article two ways: a **fourth bullet** in *The trust model* body (so the "why trustworthy
> enough to anchor an audit trail" story states the external-audit signal honestly — claimed by Somnia, not independently
> verifiable from the public docs) and an **upgraded flag** in its source caveat (from "internal file IDs only" to
> "confirmed: report embeds 404 on the docs domain"). Structural note for future loops: a `.md`-only capture pipeline
> **cannot** resolve `{% file %}` targets, so this flag cannot be closed further from upstream — it stays open as
> "ask Somnia directly," not "re-fetch." No new glossary term; no chain-ID conflict; PHI boundary unaffected (the page
> names no chain ID and no RPC URL). The sibling *MiCAR whitepaper* stub is the same `{% file %}`-embed shape and remains
> the one other open human-review flag of this kind. The residual research gaps (millisecond TTF, sustained TPS, block
> time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **MiCAR-whitepaper human-review flag advanced — the last `{% file %}`-embed flag confirmed unverifiable from the docs (2026-05-22).**
> Following directly from the prior run's L1-audit finding, which flagged the *MiCAR whitepaper* stub as "the one other
> open human-review flag of this kind," this run resolved it by the **same method** rather than weaving a new page. The
> [MiCAR whitepaper](https://docs.somnia.network/concepts/miscellaneous/legal/micar-whitepaper.md) page (cited in
> [`chain-resources/tokenomics-and-gas.md`](tokenomics-and-gas.md)'s legal cluster) was re-fetched: it
> has **no rendered prose**, only a single GitBook `{% file %}` embed — exact src **`/files/6HrVoYsMdbKXaMozTVOj`**.
> Following that embed (live 2026-05-22) **returns GitBook's "Page Not Found"** (*"The URL `files/6HrVoYsMdbKXaMozTVOj`
> does not exist"*) on the docs domain — the binary is served from a separate GitBook CDN host the `.md` rendering does
> not expose, **identical** to the L1 Audit Report embed. So the EU Markets-in-Crypto-Assets whitepaper content is
> **asserted but unobtainable from `docs.somnia.network`**. The flag in
> [`tokenomics-and-gas.md`](tokenomics-and-gas.md) was upgraded from "asserted but not readable" to
> "confirmed: embed 404s on the docs domain," cross-linked to the parallel L1-audit flag, and recorded with the same
> structural note: a `.md`-only capture pipeline **cannot** resolve `{% file %}` targets, so this stays open as "ask
> Somnia directly," not "re-fetch." With this, **both** open human-review flags of the `{% file %}`-embed shape (L1-audit
> report, MiCAR whitepaper) are now confirmed unverifiable from the public docs — neither can be closed further from
> upstream. No new glossary term; no chain-ID conflict; PHI boundary unaffected (the page names no chain ID and no RPC
> URL). The residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are
> unchanged — upstream gaps, not stale links.
>
> ✅ **Connection table fully re-verified — Multicall3 confirmed un-drifted; two new canonical facts captured (2026-05-22).**
> With every sub-article cluster re-verified earlier on 2026-05-22, the **stalest high-consequence surface left** was this
> README's own *chain in one screen* connection table — the single most-referenced fact block in the folder, last
> **fully** re-verified 2026-05-21 (the later 2026-05-22 spot-checks re-touched only the chain IDs + RPC URLs, never the
> **Multicall3 addresses, explorers, or faucets** — a wrong Multicall3 address silently breaks every batched read). A
> live re-fetch of [network-info](https://docs.somnia.network/developer/network-info.md) under the sharpened soft-404
> rule (real body) **matches the table verbatim** — both Multicall3 addresses (mainnet `0x5e44F178…`, testnet
> `0x841b8199…`), chain IDs, native tokens, RPC HTTP/WS, explorers, faucets, and the EntryPoint v0.7 / factory all
> un-drifted. The canonical page surfaced **two facts the folder captured nowhere**, now woven into the table + glossary:
> (1) a **second testnet explorer** — **SocialScan** (`https://somnia-testnet.socialscan.io/`), listed on network-info
> *itself* (more authoritative than the ecosystem listing where *Exploreme* appears) — added as the testnet explorer
> *alt* and noted in the *Blockscout* glossary entry as the **third** Somnia explorer (UI fallback only; no documented
> `/api`, so the REST audit read-path stays Blockscout's alone); and (2) the **CreateX deterministic-deployment factory**
> (mainnet `0xD13C575ED5378fd18B100Bd87D5765d9A747358B`, testnet `0x535822d4b86b2372FBE4fd9d1468318F04A2A640`) — a new
> table row + a new concept-keyed glossary term *Deterministic deployment (CREATE2 / CreateX)*, tied to V1 by letting a
> payer agent compute the `ClaimSettlement` address **before** deploy so addresses are agreed without a prior on-chain
> round-trip. Also fixed a small completeness gap: the *Multicall3* glossary entry listed only the **mainnet** address —
> the testnet address was added, both stamped re-verified 2026-05-22. The EntryPoint v0.7 + factory addresses (already in
> the AA article and glossary) were promoted into the table for a single canonical address reference. PHI boundary
> unaffected (every address relays only hash/state/address/amount calldata). No new flags; the residual research gaps
> (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Fresh `llms.txt` diff — a new dedicated developer on-ramps section surfaced and triaged off-V1 (2026-05-22).** With
> every high-consequence cluster already re-verified earlier on 2026-05-22, this run did a fresh
> [`llms.txt`](https://docs.somnia.network/llms.txt) diff (**105 distinct paths**; 96 developer + 9 agents) against this
> folder's citations to catch *upstream change* rather than re-run a verified cluster. Every previously-uncited path is a
> known off-V1 surface (NFT/DEX tutorials, the wallet-login kits, dao-ui browser pages, ecosystem-showcase/index pages)
> **except one genuinely-new cluster** the "frontier exhausted" claim had not accounted for: a **dedicated developer
> on-ramps section** — [building-dapps/onramps](https://docs.somnia.network/developer/building-dapps/onramps.md) and its
> [Banxa checkout walkthrough](https://docs.somnia.network/developer/building-dapps/onramps/buy-somi-using-banxa-checkout.md) —
> **distinct** from the `ecosystem-tools/on-ramps.md` listing the folder triaged in a prior run. Both pages were fetched,
> confirmed **real content** (sharpened soft-404 rule — real body, not just HTTP `200`), and **triaged into the existing
> on-ramps bullet** of [`chain-resources/tokenomics-and-gas.md`](tokenomics-and-gas.md) rather than given
> a sub-article — they carry **no new V1 primitive**. The finding **sharpens** (does not change) the standing on-ramps
> verdict: the walkthrough is a **step-by-step end-user *browser* checkout** ("select SOMI as the token. Select the
> network as Somnia Network") that buys **mainnet SOMI** (not testnet STT), exposes **no headless/server-side API**, and
> publishes no chain ID, amount, or fee — so a fiat on-ramp is firmly a **mainnet, human-treasury** step *outside* the V1
> agent loop (testnet funds from the faucet; settlement SOMI flows from the counterparty payer agent, never a card
> purchase). The off-V1 conclusion is now corroborated by **two** upstream surfaces, both Banxa-only and human-driven —
> recorded so the loop stops re-triaging it. No new glossary term (vendor/funding-mechanic, not a V1 concept; consistent
> with the on-ramps/allocation precedent). No new flags; neither page names a chain ID or uses the stale `dream-rpc` RPC.
> The residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged —
> upstream gaps, not stale links.
>
> ✅ **External-data base-agent pages re-verified — the stalest sub-surface of the starred article refreshed; an agent ID captured (2026-05-22).**
> With every high-consequence *cluster* re-verified earlier on 2026-05-22 and the V1 frontier exhausted, this run
> refreshed the **stalest sub-surface within** the starred [`chain-resources/native-agents.md`](native-agents.md):
> its two **external-data base-agent** pages — [JSON API Request](https://docs.somnia.network/agents/base-agents/json-api-request.md)
> and [LLM Parse Website](https://docs.somnia.network/agents/base-agents/llm-parse-website.md) — were last verified
> **2026-05-21**, a day behind the deposit-economics cluster (gas-fees / LLM-Inference / custom-consensus, re-checked
> 2026-05-22). Both were re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and
> **match verbatim**: all six JSON `fetch*` signatures + the `42000.50`/`decimals=8`→`4200050000000` scaling example, and
> the LLM-Parse `ExtractString`/`ExtractANumber` signatures + the `resolveUrl`/`numPages`-cap-at-1/clamp-negatives-to-0/
> JS-safe-integer behaviour + the receipt-only `reasoning`/`answerable`/`confidence_score` fields — no signature or
> example has drifted. **Two findings woven in:** (1) a **verified negative** — the JSON-API page **still documents no
> HTTP-method, auth/header, response-size, or determinism caveat**, so that standing gap is *re-confirmed absent
> 2026-05-22* (upstream's gap, not ours; resolve empirically on the implementation branch, not by more doc-reading); and
> (2) the LLM-Parse page carries a concrete **agent ID `12875401142070969085`** beside the platform addresses (testnet
> `0x037Bb9…6776`, mainnet `0x5E5205…163E6`) — the agent-ID datum the [quickstart](https://docs.somnia.network/agents/invoking-agents/quickstart.md)
> explicitly lacks and the article had not captured — plus upstream's clarifying contrast *"Unlike the JSON API Request
> agent, this agent can handle HTML pages."* Updated the article header re-verification block, the JSON-API caveat date,
> the LLM-Parse section, and the source caveat (base-agent pages added to the 2026-05-22 re-fetch list). No new glossary
> term (an agent ID is an instance value, not a concept — concept-keyed convention held); no new flags; neither page names
> a chain ID or RPC URL. With this, **every cited agents-section page is now re-verified on 2026-05-22.** The residual
> research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps,
> not stale links.
>
> ✅ **Account-Abstraction integration cluster re-verified — the last high-consequence surface still on a 2026-05-21 check (2026-05-22).**
> A fresh [`llms.txt`](https://docs.somnia.network/llms.txt) diff this run (**~150 doc paths**) against this folder's
> citations again left **only off-V1 surfaces uncited** (NFT/DEX/IPFS/wallet-login tutorials, metaverse experiences,
> get-started MetaMask-housekeeping pages, the litepaper's duplicate `/litepaper/*`+`/somnia-litepaper/*` routes, and
> listing/index pages) — V1 frontier confirmed exhausted. With every *citation cluster* re-verified earlier on
> 2026-05-22 **except the AA tutorial pages** (the connection-table run re-checked the EntryPoint/factory addresses via
> network-info, but the AA *integration code* an implementer types — `sponsorGas`, `FACTORY_ADDRESS`, the fragile
> soft-404 slug — was last verified **2026-05-21**), this run re-fetched that cluster under the **sharpened soft-404 rule**
> (real body, not just HTTP `200`). All three **match verbatim — un-drifted:** the
> [AA landing](https://docs.somnia.network/developer/building-dapps/account-abstraction.md) still renders the
> *"ERC-4337-style flows"* + *"bridges the gap between Web2 simplicity and Web3 ownership"* lines and still publishes **no**
> on-page address/chain-ID/RPC; the
> [gasless-with-Thirdweb tutorial](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md)
> (truncated canonical slug) still renders `FACTORY_ADDRESS 0x4be0ddfebca9a5a4a617dee4dece99e7c862dceb` (matching
> network-info's "Account factory" — the two-pages-agree-on-one-contract finding holds), `sponsorGas: true` (×2), and the
> `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` prerequisite; the companion
> [smart-wallet tutorial](https://docs.somnia.network/developer/building-dapps/account-abstraction/smart-wallet-app-with-thirdweb.md)
> still imports `somniaTestnet` from `viem/chain`, is still browser-only (no Engine/server-wallet/private-key path —
> corroborating account-abstraction open question 4), and still prints the stale `dream-rpc.somnia.network` RPC. **The
> fragile soft-404 boundary still holds:** the intuitive full `…-with-thirdweb.md` slug re-confirmed a GitBook
> *"does not exist"* body 2026-05-22, so the truncated `…-with-thirdw.md` stays canonical and a status-code-only link
> check remains unsafe here. Updated the article header re-verification line and the two tutorial stamps in its source
> caveat (2026-05-21 → also 2026-05-22). No new glossary term; no new flags; no chain-ID conflict; PHI boundary
> unaffected (a paymaster/factory relays only gas + hash/state/address/amount calldata, never payload). With this,
> **every high-consequence citation cluster in the folder is now re-verified on 2026-05-22.** The residual research gaps
> (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Last un-re-verified `ecosystem-tools/*` listing closed — the subgraph-deploy URL source confirmed un-drifted (2026-05-23).**
> A fresh [`llms.txt`](https://docs.somnia.network/llms.txt) diff this run (**179 doc paths**) against this folder's
> citations again left **only off-V1 surfaces uncited** (NFT/DEX/IPFS/wallet-login tutorials, dao-ui browser pages,
> metaverse experiences, get-started MetaMask-housekeeping pages, the litepaper's duplicate `/litepaper/*`+`/somnia-litepaper/*`
> routes, and listing/index pages) — V1 frontier confirmed exhausted on the new day. The one gap worth acting on was a
> **coverage hole in the re-verification record, not a content gap:** the
> [ecosystem: subgraphs](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/subgraphs.md)
> listing is the cited **source** for the high-consequence create-subgraphs deploy URLs in
> [`chain-resources/indexing-subgraphs.md`](indexing-subgraphs.md) (Ormi `subgraph.somnia.network`,
> Protofire `somnia.chain.love`) — yet, unlike **every** sibling `ecosystem-tools/*` listing (`rpc`, `oracles`,
> `wallet-providers`, `account-abstraction`, `explorers`, `safes`, `sdks`, `apis`, `on-ramps`, all explicitly
> re-verified across 2026-05-22), it had **never been logged as re-verified**. Re-fetched live 2026-05-23 under the
> **sharpened soft-404 rule** (real body, not just HTTP `200`): it renders **real content**, names **exactly Ormi +
> Protofire** (a **verified negative** — no third provider, contrasting the sibling listings that surfaced Sequence and
> Pimlico when read), and **both create-subgraphs URLs match the article's table verbatim — un-drifted**. Recorded in the
> article's header re-verification line, the Path-1 provider-table inline note, and a new source-caveat paragraph. **With
> this, every `ecosystem-tools/*` listing the folder cites has now been explicitly re-verified.** No new glossary term
> (the glossary is concept-keyed, not vendor-keyed); the page names no chain ID and no RPC URL — no new flags. The
> residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged —
> upstream gaps, not stale links.
>
> ✅ **Opcode gas table re-verified + sharpened — the last high-consequence surface still on a 2026-05-21 check (2026-05-23).**
> A fresh [`llms.txt`](https://docs.somnia.network/llms.txt) diff this run (105 distinct paths) against this folder's
> citations again left **only off-V1 surfaces uncited** (NFT/DEX/IPFS/wallet-login tutorials, dao-ui browser pages,
> metaverse experiences, get-started MetaMask-housekeeping pages incl. the new *removing-the-somnia-devnet-network* /
> *update-the-block-explorer-in-metamask* entries, the litepaper's duplicate `/litepaper/*`+`/somnia-litepaper/*` routes,
> and listing/index pages) — V1 frontier re-confirmed exhausted on the new day. The gap worth acting on was a **coverage
> hole in the re-verification record:** the [gas-differences page](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md)
> — the cited source of the entire **opcode gas table** in [`chain-resources/tokenomics-and-gas.md`](tokenomics-and-gas.md)
> (deployment `3125`/byte, the LOG/event formula, `ecRecover` `150,000`, `KECCAK256`, storage read cached `100` /
> uncached `+1,000,000`, EIP-7702 `1,570,000`) — was last re-checked **2026-05-21**, a day behind the 2026-05-22 cluster
> sweep, because that sweep re-fetched only the **separate** `concepts/tokenomics/gas-fees.md` SSTORE/pricing table, not
> this opcode page. This opcode table is the most concrete per-claim cost-model input in the folder (event-log gas governs
> every audit anchor; deployment gas the one-time `ClaimSettlement` deploy; EIP-7702 the AA path), so a wrong number means
> a wrong demo budget. Re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`): **every
> opcode constant matches verbatim — un-drifted.** The full-signature re-fetch captured **three precision details the
> prior name-only pass had dropped**, now woven into the table + storage prose: (1) the LOG formula carries a
> `+ memory_expansion_cost` term (it is not the flat formula the table showed); (2) the cheap cached-read path is
> concretely *"the set of most recently accessed **128 million** contract slot keys"* — the lever that decides whether
> each audit-anchor state access pays `100` gas or the `+1,000,000` uncached penalty (a **10,000×** swing), recorded as
> V1's **dominant** cost lever (keep a claim's hot state compact + recently-touched); and (3) EIP-7702 **refunds
> `400,000`** when no account creation is required. No new glossary term (precision details on already-defined concepts —
> *Storage rent*, *Gas* — not a new concept; concept-keyed convention held); no new flags. With this, **every
> high-consequence citation cluster in the folder is now re-verified on 2026-05-22 or 2026-05-23.** The residual research
> gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale
> links.
>
> ✅ **Last never-read `/ecosystem/experiences/*` cluster triaged — `somnia-playground` read directly, confirmed off-V1 (2026-05-23).**
> A fresh [`llms.txt`](https://docs.somnia.network/llms.txt) diff this run (**185 distinct paths**) against this folder's
> citations again left **only off-V1 surfaces uncited** — but flagged one cluster the "frontier exhausted" claim had been
> *assuming* off-V1 without ever reading: the `/ecosystem/experiences/*` + `/ecosystem/content-creation` family. Because
> the read-don't-assume discipline has repeatedly paid off (the "redundant" oracle listing became a verified two-provider
> negative; sibling listings surfaced Sequence and Pimlico when actually read), the representative page
> [somnia-playground](https://docs.somnia.network/ecosystem/experiences/somnia-playground.md) was **fetched directly**
> (sharpened soft-404 rule — confirmed real content). It is the consumer end of the **SOM0 family**: verbatim, *"The
> web-based Playground … allows Content Creators to quickly and easily spin up web-hosted Virtual Society experiences in a
> 'sandbox' environment,"* validating ownership via the **Object Protocol** and commerce via the **Marketplace
> Protocol** — naming **no smart contract, RPC, chain ID, SDK, agent, or transaction primitive**. A **verified off-V1
> finding**, same Virtual Society scope as the already-triaged [`som0`/`som1`](https://docs.somnia.network/ecosystem/protocols/som0.md)
> pages, and a fresh corroboration of the standing negative that Somnia's experiences layer names gaming/metaverse/creator
> work, **never AI, agents, or healthcare**. Woven as a closing triage paragraph in
> [`chain-resources/tokenomics-and-gas.md`](tokenomics-and-gas.md) (the home of off-V1 / substrate-viability
> records, beside on-ramps/allocation/legal/SOM0-1) so the loop stops re-triaging it. ⚠️ **Honest scope limit:** the two
> siblings (`metaverse-browser`, the `content-creation` surface) were **classified by family, not individually fetched** —
> recorded so a future run wanting certainty knows they are still technically unread. No new glossary term (gaming/creator
> tooling, not a V1 concept); no new flags; the page names no chain ID and no RPC URL. The residual research gaps
> (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Last two never-read `/ecosystem/experiences/*` siblings fetched directly — honest scope limit closed; a guessed slug corrected (2026-05-23).**
> The prior run triaged the `/ecosystem/experiences/*` + `/ecosystem/content-creation` cluster but, by its own recorded
> **honest scope limit**, fetched only the representative [somnia-playground](https://docs.somnia.network/ecosystem/experiences/somnia-playground.md)
> page and **classified the two siblings by family, not individually** — flagging them "still technically unread." Because
> the read-don't-assume discipline has repeatedly paid off in this folder (the "redundant" oracle listing became a verified
> two-provider negative; sibling ecosystem listings surfaced Sequence and Pimlico when actually read), this run **fetched
> both siblings directly** to close that limit, rather than re-run a verified cluster. A live
> [`llms.txt`](https://docs.somnia.network/llms.txt) check first confirmed the exact `/ecosystem/*` slugs (`protocols`,
> `experiences` + `metaverse-browser`/`somnia-playground`, `content-creation`). Both pages were fetched under the
> **sharpened soft-404 rule** (real body, not just HTTP `200`) and confirmed **real content + off-V1**, woven into the
> closing triage paragraph of [`chain-resources/tokenomics-and-gas.md`](tokenomics-and-gas.md):
> [metaverse-browser](https://docs.somnia.network/ecosystem/experiences/metaverse-browser.md) is a **gamified onboarding UX
> layer** (integrated web3 wallet + quest-based rewards; verbatim opener *"Engaging with blockchain applications can be a
> complex task, particularly for users unfamiliar with decentralised applications, web3 wallets…"*), and
> [content-creation](https://docs.somnia.network/ecosystem/content-creation.md) is a **creator-tooling list** (engines —
> Unreal/Unity/PlayCanvas — plus object/avatar tools). **Neither names a smart contract, RPC endpoint, chain ID, SDK,
> agent, or transaction primitive.** ⚠️ **Two precision catches recorded:** (a) the canonical content-creation slug is
> **`/ecosystem/content-creation.md`**, **not** the `…/deployment-and-production/ecosystem/ecosystem-showcase.md` the prior
> run had **guessed** in the article link — a wrong citation, now corrected in the body; and (b) the content-creation page
> **does name "generative AI"** (*"Meshy.ai … Generative AI tool means anyone can create object"*) — the **one** AI mention
> across the whole `/ecosystem/*` family, but it is a **third-party 3D-content vendor tool in a creator toolchain, not
> Somnia positioning itself as an AI/agent L1**. The standing negative therefore **holds but is now stated precisely**
> (the experiences layer's lone AI reference is a vendor content tool, never AI agents/healthcare as a *platform position*),
> rather than as the flat "never AI" the prior phrasing implied. With this, **every `/ecosystem/*` path the diff surfaces
> is now individually read** — the family-classification hedge is fully discharged. No new glossary term (gaming/creator
> tooling, not a V1 concept); no chain-ID conflict; PHI boundary unaffected (neither page names an on-chain primitive). The
> residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream
> gaps, not stale links.
>
> ✅ **On-chain Reactivity cluster re-verified — the last high-consequence surface still on a 2026-05-21 check (2026-05-23).**
> With the V1 frontier exhausted and every other high-consequence cluster re-verified on 2026-05-22/23, the **stalest
> high-consequence surface left** was the **on-chain** half of [`chain-resources/reactivity.md`](reactivity.md):
> the [overview](https://docs.somnia.network/developer/reactivity.md), the
> [on-chain reference](https://docs.somnia.network/developer/reactivity/reactivity-onchain.md), and the
> [on-chain Solidity tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md)
> — the exact precompile constants and Solidity an `implementer` types — were last re-checked **2026-05-21**, a day behind
> the *off-chain* reference's 2026-05-22 re-fetch (the subscribe-vs-watch run touched only off-chain). A wrong constant
> here means a **failed on-chain subscription** (under-funded owner, over-cap `gasLimit`), so it earns a priority re-check.
> All three were re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **match
> verbatim — un-drifted:** precompile `0x0100` + `subscribe`/`unsubscribe`/`getSubscriptionInfo`, the **32 SOMI**
> not-escrowed/not-consumed owner minimum, the **`200,000,000`-gas** `max_reactivity_handler_gas_limit` cap, the
> *"At least one filter is required — wildcard subscriptions … are not allowed"* prohibition, the auto-removal formula
> `(execution price per gas + priorityFeePerGas) * gasLimit`, the `SomniaEventHandler._onEvent` hook, and the tutorial's
> `--value 33ether` / `gasLimit 2_000_000` / `priorityFeePerGas 1` / `maxFeePerGas 0` / four-slot `eventTopics` /
> synthetic-reactive-transaction framing. **One precision fix:** the on-chain table presented the 32-SOMI note **inside
> quote marks** as *"not consumed or escrowed; it sits in the owner's regular balance"* — a reordered, sentence-merged
> paraphrase passing as verbatim; tightened to upstream's exact wording *"The 32 SOMI is not an escrow and not consumed.
> It sits in the owner's regular balance."* Recorded in the article's header re-verification block, the on-chain table,
> and the source caveat. The overview confirms it names **no** SDK method (consistent with the standing subscribe-vs-watch
> resolution) and neither core page names a chain ID or RPC URL. No new glossary term; no new flags; no chain-ID conflict.
> With this, **all four reactivity pages are re-verified on the latest passes** (off-chain 2026-05-22; overview + on-chain +
> on-chain tutorial 2026-05-23). The residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi
> base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **On-chain security cluster re-verified — the last high-consequence surface still on a 2026-05-21 check; a paraphrased events quote tightened (2026-05-23).**
> With the V1 frontier exhausted and every other high-consequence cluster re-verified on 2026-05-22/23, the **stalest
> high-consequence surface left** was the **on-chain security cluster** in
> [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md): the
> [audit checklist](https://docs.somnia.network/developer/security/audit-checklist.md) (the `security-auditor`'s
> contract-level rubric), the [security overview](https://docs.somnia.network/developer/security.md) (its four layers), and
> the [security-101 patterns](https://docs.somnia.network/developer/security/smart-contract-security-101.md) page (the
> pull-payment + reentrancy-guard patterns `ClaimSettlement.sol`'s fund-release path inherits) — last fetched **2026-05-21**
> and **never swept on 2026-05-22/23**, because the 2026-05-22 core-deploy run re-checked only Foundry/Hardhat/viem/verify
> and explicitly treated these as "adjacent." A wrong security pattern here means the most consequential V1 contract ships
> on a wrong rubric, so the cluster earned a priority re-check. All three were re-fetched live under the **sharpened
> soft-404 rule** (real body, not just HTTP `200`) and **match verbatim — un-drifted:** the CEI reentrancy item
> ("All functions that send Ether or tokens to external addresses must follow the Checks-Effects-Interactions pattern"),
> the `onlyOwner`/`onlyRole` access modifiers, Solidity `>= 0.8.0` overflow, the unbounded-loop DoS item, the Phase 1
> (manual) / Phase 2 (mandatory static analysis) split, Slither/Mythril/Solhint with **High/Critical blocking deployment**;
> the **four** security layers; and security-101's three vulnerability classes, the `require(_status == _NOT_ENTERED …)`
> guard, pull-payment **"users withdraw instead of push"**, `Owner > Admin > Writer`, OpenZeppelin
> `ReentrancyGuard`/`AccessControl`/`Ownable`, the SWC/Consensys outbound links, and the "local/Remix only, NOT … real
> funds on mainnet" rail. **One precision fix:** the audit-checklist **events** item was quoted in the article (inside
> quote marks) as `"all critical state changes must emit an appropriate Event"`, but upstream actually reads
> **"All critical state changes _and value transfers_ must emit an appropriate Event"** — a paraphrase passing as verbatim,
> the same class of catch as the prior run's 32-SOMI tightening. Restored exactly; the dropped **"and value transfers"** is
> V1-relevant — `ClaimSettlement.sol`'s settlement send *is* a value transfer, so upstream explicitly mandates the audit
> event our timeline depends on. ⚠️ **One summarised-fetch nuance flagged, not asserted** (a summarising fetch cannot
> reliably support a *negative*): security-101's returned tool list was Slither + MythX + Securify + Manticore — possibly
> *without* the checklist's Mythril/Solhint — so the article's "names the same static-analysis tools the checklist mandates"
> may slightly overstate the overlap; recorded in the source caveat as "re-read the page directly before relying on its
> exact tool roster," not corrected blind. No new glossary term (precision on already-defined concepts — *CEI*,
> *Reentrancy guard*, *Pull payment* — not a new concept); no new flags; the pages name no chain ID or RPC URL; PHI
> boundary unaffected. With this, the on-chain security cluster joins every other high-consequence cluster as re-verified
> on 2026-05-22/23. The residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor)
> are unchanged — upstream gaps, not stale links.
>
> ✅ **Consensus & execution core pages re-verified — MultiStream + ASE, the last litepaper surface still on a 2026-05-21 check; a paraphrased compilation quote tightened (2026-05-23).**
> With every other high-consequence cluster re-verified across 2026-05-22/23, the **stalest high-consequence surface
> left** was the two **dedicated** litepaper pages behind [`chain-resources/consensus-and-execution.md`](consensus-and-execution.md):
> [MultiStream Consensus](https://docs.somnia.network/concepts/somnia-blockchain/multistream-consensus.md) and
> [Accelerated Sequential Execution](https://docs.somnia.network/concepts/somnia-blockchain/accelerated-sequential-execution.md).
> The 2026-05-22 cluster sweep had re-fetched that article's IceDB, Advanced-Compression, security/Cuthbert, problem, and
> introduction pages, but **not** the two core consensus/execution pages — last re-checked **2026-05-21**. They carry the
> article's load-bearing *"why Somnia, not Ethereum?"* performance claims, so they earned a priority re-check. Both were
> re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real content**;
> **every quote matches upstream verbatim — un-drifted:** MultiStream's data-chain-forking sentence, the "full security
> against validators forking their own data chain" fragment, the "almost a gigabit per second of published transaction
> data" figure, and the Autobahn-2024-whitepaper attribution; and ASE's "parallel execution breaks down exactly when you
> need it," the Otherside Otherdeed-mint quote, the EVM-compiler/x86 + "near-native speed" pair, the "ERC-20 transfers in
> hundreds of nanoseconds, achieving millions of TPS on a single core" benchmark, and the 250ns-vs-500ns out-of-order
> example. **One precision fix** (same boundary-faithfulness class as the prior runs' 32-SOMI and events-quote
> tightenings): the compilation-strategy quote was integrated as `so you "only do this on contracts…"`, where the article's
> own lead-in "you" silently absorbed upstream's **"would"** — upstream reads *"you would only do this on contracts that
> are called frequently…"*; the opening quote mark was moved to restore "would." Not V1-load-bearing, but a quote inside
> quote marks should be exactly verbatim. Recorded in the article header re-verification block + a new source-caveat
> paragraph. No new glossary term; no new flags; neither page names a chain ID or RPC URL; PHI boundary unaffected
> (background article). With this, **all four core-innovation litepaper pages plus the problem/introduction/security
> framing pages are re-verified on the 2026-05-22/23 passes**, and every high-consequence citation cluster in the folder
> now carries a 2026-05-22 or 2026-05-23 re-verification date. The residual research gaps (millisecond TTF, sustained TPS,
> block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Data Streams *concept* cluster re-verified — the audit-trail thesis quotes confirmed verbatim; a paraphrase promoted to upstream verbatim (2026-05-23).**
> The recent passes re-verified every *high-consequence* cluster, but [`chain-resources/data-streams.md`](data-streams.md)
> carries **two** kinds of citation: the **SDK** cluster (the code an implementer types — re-verified 2026-05-22) and the
> **concept** pages (the verbatim quotes grounding the *argument* — last checked 2026-05-21). The latter, never swept on
> the 2026-05-22/23 passes, was the stalest surface left, and it is the conceptual backbone of Curie's "PHI-free
> verifiable audit trail" thesis. The two highest-consequence concept pages —
> [provenance & verification](https://docs.somnia.network/developer/data-streams/concepts/data-provenance-and-verification-in-streams.md)
> and [data vs. event streams](https://docs.somnia.network/developer/data-streams/concepts/somnia-data-vs-event-streams.md)
> — were re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real content;
> every quote matches upstream verbatim — un-drifted:** the three-key `dsstore` mapping, the *"stores the data at the
> `msg.sender`'s address"* line, the *"impossible … cannot fake their `msg.sender`"* non-forgery guarantee, the
> *"an attacker cannot write data as if it came from a trusted oracle"* line, the auditor *"don't need to perform complex
> 'verification' steps"* upshot, and the data-stream/event-stream definitions + the *"without knowing Solidity and without
> deploying any smart contracts"* framing. **One precision improvement** (the recent runs' paraphrase-to-verbatim
> discipline — same class as the 32-SOMI / events-quote / compilation-quote tightenings): the provenance page **ends** that
> auditor passage with its own crisp sentence *"Verification is implicit in the read operation."* — the exact verbatim form
> of what the article had expressed as an authorial gloss; the quote was extended to fold it in, raising the article's most
> load-bearing citation from gloss to word-for-word source. Two honest notes recorded inline: (a) the data-stream
> definition continues past the article's truncation (*"…how to parse the data using a public or private `data schema`"*) —
> the quoted words are verbatim, the truncation does not alter meaning; (b) the *"Serving different purposes…"* line is
> sourced to the **concepts** page, not the data-vs-event page, so it was not re-checked this run (a candidate for a future
> pass alongside the `understanding-schemas` / `extending-schemas` / `intersection-with-Reactivity` concept pages, all
> still on a 2026-05-21 check). No new glossary term; no new flags; neither concept page names a chain ID or RPC URL; PHI
> boundary unaffected (a Data Streams write is on-chain state, subject to the full no-PHI-on-chain rule). The residual
> research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps,
> not stale links.
>
> ✅ **Data Streams concept cluster finished — the four pages the prior run deferred re-verified; three paraphrases promoted to upstream verbatim (2026-05-23).**
> The prior run re-verified the *provenance* + *data-vs-event* concept pages but **explicitly flagged** the remaining four —
> [understanding-schemas](https://docs.somnia.network/developer/data-streams/concepts/understanding-schemas-schema-ids-data-ids-and-publisher.md),
> [extending-schemas](https://docs.somnia.network/developer/data-streams/concepts/extending-and-composing-data-schemas.md),
> [intersection-with-Reactivity](https://docs.somnia.network/developer/data-streams/concepts/intersection-with-somnia-reactivity.md),
> and the [concepts](https://docs.somnia.network/developer/data-streams/concepts.md) page (incl. the deferred *"Serving
> different purposes…"* line) — as "all still on a 2026-05-21 check." This run closed exactly that gap: all four were
> re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`), **all render real content, and
> every load-bearing quote matches upstream verbatim — un-drifted** (the schema-ID "change even one character" brittleness,
> `sdk.streams.computeSchemaId()`, "isolated namespace", "three identifiers always work together"; the optional-`parentSchemaId`
> registration + "recursively fetch parent schema until the end of the chain is reached" + "for maximum composability, all
> schemas should be public"; the intersection page's "without having the need to poll the chain" + "observer pattern …
> push rather than pull" and the `setAndEmitEvents`/`subscribe` pair; and the concepts page's *"Serving different purposes,
> data and event streams can be used independently or together"* — now confirmed verbatim, closing the deferred note). **Three
> paraphrases passing as verbatim were tightened** (the recent runs' paraphrase-to-verbatim discipline — same class as the
> 32-SOMI / events-quote / compilation-quote / provenance tightenings), in both
> [`chain-resources/data-streams.md`](data-streams.md) and the *Data ID* / re-use entries of
> [`GLOSSARY.md`](../GLOSSARY.md): (1) the Data ID *"uniquely identifies individual records within a schema"* → upstream's *"a
> unique key representing that entry"* that *"uniquely identifies a specific record (or row)"*; (2) *"reusing the same Data
> ID updates existing entries rather than creating duplicates"* → upstream's *"If you write another record with the same
> Data ID, it updates the existing entry rather than duplicating it"*; (3) the re-use line dropped upstream's leading
> **"The best"** (*"The best blockchain primitives are composable…"*). ⚠️ **One honest note, not corrected:** the extension
> page's *versioning* "coexist" claim is the article's authorial gloss (not in quote marks) — upstream demonstrates a
> `version` parent over `person` iterations but does not state coexistence in those words, so it stands as interpretation,
> not a quote. With this, **all six Data Streams concept pages are re-verified on 2026-05-23.** No new glossary term; no new
> flags; none of the four pages names a chain ID or RPC URL; PHI boundary unaffected. The residual research gaps
> (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Off-chain Reactivity tutorials re-verified — the worked `watch()`/cron code un-drifted; two paraphrases promoted to upstream verbatim (2026-05-23).**
> With every other high-consequence cluster re-verified across 2026-05-22/23, the **stalest high-consequence surface left**
> was the **off-chain** half of [`chain-resources/reactivity.md`](reactivity.md): the
> [filtered-subscriptions](https://docs.somnia.network/developer/reactivity/tutorials/off-chain-reactivity-filtered-subscriptions-tutorial.md),
> [wildcard](https://docs.somnia.network/developer/reactivity/tutorials/wildcard-off-chain-reactivity-tutorial.md), and
> [cron-via-SDK](https://docs.somnia.network/developer/reactivity/tutorials/cron-subscriptions-via-sdk.md) tutorials —
> the exact `watch()` filter code + cron scheduling an `implementer` types — last re-checked **2026-05-21**, a day behind
> the on-chain cluster's 2026-05-23 re-fetch (the on-chain run touched only on-chain). A wrong field mapping or cron
> constant here means a **silently mis-filtered subscription** or a **rejected schedule**, so the cluster earned a
> priority re-check. All three were re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`)
> and **match verbatim — un-drifted:** the five `watch()`→RPC field mappings (`eventContractSources`→`address`,
> `topicOverrides`→`topics`, `ethCalls`→`eth_calls`, `context`→`context`, `onlyPushChanges`→`push_changes_only`), the
> `toEventSelector('Transfer(address,address,uint256)')`/`toFunctionSelector('balanceOf(address)')`/`decodeEventLog`/
> `decodeFunctionResult` Viem helpers and `subscription.unsubscribe()`; the wildcard tutorial's `sdk.subscribe({...})`,
> the `event.topics[0] !== transferTopic` guard, and `new SDK({ public: publicClient })`; and the cron
> `scheduleSubscriptionAtBlock`→`BlockTick(uint64)` / `scheduleSubscriptionAtTimestamp`→`Schedule(uint256)` pair,
> `onEvent(address,bytes32[],bytes)`, the "at least 32 SOMI" owner minimum, the `timestampMs < Date.now() + 12_000`
> 12-second-lead rule (returns an `Error`, does not throw), and `sdk.cancelSoliditySubscription(subscriptionId)`. **Two
> precision fixes** (the recent runs' paraphrase-to-verbatim discipline — same class as the 32-SOMI / events-quote /
> compilation-quote / provenance / Data-ID tightenings), both in [`chain-resources/reactivity.md`](reactivity.md):
> (1) the `context` one-based note had asserted "one-based" as an **authorial gloss** with only the fragment *"appends
> `topics[2]`"* in quote marks — upstream states the whole rule itself (*"The off-chain Reactivity context selector is
> one-based, so `topic3` appends `topics[2]` to the call data"*), so the quote was extended to the full upstream sentence;
> (2) the wildcard subscription-lifecycle line had passed **bracket-edited paraphrase** (*"live[s] only…"*, *"does … not
> require…"*) off as three separate quotes — restored to upstream's exact contiguous wording *"live only for the WebSocket
> connection that created them, are not stored on-chain, do not require a wallet client or gas."* The
> [`GLOSSARY.md`](../GLOSSARY.md) *Filtered subscription* entry states "one-based" as a definition (not a quote), accurate
> against the now-confirmed wording — left unchanged. No new glossary term; no new flags; none of the three tutorials
> names a chain ID or RPC URL; PHI boundary unaffected. With this, **all four reactivity pages and all three off-chain
> tutorials are re-verified on the latest passes.** The residual research gaps (millisecond TTF, sustained TPS, block
> time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Local-testing & forking guide re-verified — the TDD substrate, the last high-consequence surface still on a 2026-05-21 check; simplified fork commands restored to upstream verbatim (2026-05-23).**
> A fresh [`llms.txt`](https://docs.somnia.network/llms.txt) diff this run (**112 distinct paths** — 103 developer + 9
> agents) against this folder's citations left **only off-V1 surfaces uncited** (NFT/DEX/IPFS/wallet-login tutorials,
> dao-ui browser pages, ecosystem-showcase/index pages) — V1 frontier re-confirmed exhausted. The **stalest
> high-consequence surface left** was the [local-testing-and-forking guide](https://docs.somnia.network/developer/development-frameworks/local-testing-and-forking.md)
> behind [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md)'s *Local testing & forking*
> section — the **direct `tdd-test-writer` → `implementer` substrate** (the exact cheatcodes, fork commands, and `.env`
> an implementer types) — captured 2026-05-21 and **never swept on the 2026-05-22/23 passes**, because the 2026-05-22
> core-deploy run re-checked only Foundry/Hardhat/viem/verify and explicitly treated forking as "adjacent." A wrong
> cheatcode name or fork command means a **failed test setup**, so it earned the priority re-check. Re-fetched live under
> the **sharpened soft-404 rule** (real body, not just HTTP `200`): the seven Hardhat cheatcodes
> (`hardhat_impersonateAccount`, `hardhat_setBalance`, `evm_setNextBlockTimestamp`, `evm_mine`, `evm_snapshot`,
> `evm_revert`, `hardhat_reset`), chain ID `31337`, the `http://127.0.0.1:8545` localhost URL, and the *"such as a DEX,
> oracle, or NFT marketplace … using real-world data, but without any of the risk or cost"* purpose quote all **match
> verbatim — un-drifted**. **One precision fix** (the recent runs' paraphrase-to-verbatim discipline — same class as the
> 32-SOMI / events-quote / compilation-quote / provenance / Data-ID tightenings): the article's fork code block had been
> simplified to `anvil --fork-url $SOMNIA_RPC_TESTNET --port 8546` / `npx hardhat node --fork $SOMNIA_RPC_TESTNET`,
> silently dropping upstream's `${FORK_BLOCK_TESTNET:+--fork-block-number $FORK_BLOCK_TESTNET}` parameter-expansion —
> which is the **literal mechanism** wiring the article's separately-described `.env` `FORK_BLOCK_*` var + "pin the block
> for reproducible CI forks" recommendation into the command. Restored to upstream verbatim and the prose tightened to
> connect the two. One attribution clarified in the source caveat: the guide's worked fork commands are **Anvil** +
> **`hardhat node`** — it carries **no `forge test` command**, so the article's "Foundry's equivalent is `forge test`" is
> general Foundry guidance, not a quote from this page. ⚠️ The `.env` still prints the stale `dream-rpc.somnia.network`
> testnet RPC (the **twelfth** sighting; precedence rule unchanged — fork against the canonical `api.infra.testnet`
> endpoint); chain IDs `31337`/`50312`/`5031` agree with the canonical table — no conflict. No new glossary term
> (precision on an already-defined concept — *Forking*, *Anvil* — not a new concept; concept-keyed convention held); no
> new flags. With this, **every high-consequence citation cluster in the folder now carries a 2026-05-22 or 2026-05-23
> re-verification date.** The residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas
> floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Core tokenomics pages re-verified — the last cluster still on a 2026-05-21 check; a paraphrased reward-source phrase promoted to upstream verbatim (2026-05-23).**
> With the local-testing/forking guide re-verified above, the **last high-consequence surface still on a 2026-05-21
> check** was the three **core tokenomics** pages behind [`chain-resources/tokenomics-and-gas.md`](tokenomics-and-gas.md):
> the [tokenomics overview](https://docs.somnia.network/concepts/tokenomics/overview.md),
> [SOMI coin](https://docs.somnia.network/developer/network-info/somi-coin.md), and
> [staking & delegation](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md) pages — the
> verbatim sources for the fixed-supply / token-role / denomination-ladder / reward-funding claims an implementer reasons
> a cost model from. The 2026-05-22/23 sweeps had re-fetched only the *separate* `tokenomics/gas-fees.md` (SSTORE/pricing
> table, 2026-05-22) and `somnia-gas-differences` (opcode table, 2026-05-23) pages and explicitly left these three on the
> 2026-05-21 capture. All three were re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP
> `200`) and **render real content; every load-bearing quote matches upstream verbatim — un-drifted:** the
> `1,000,000,000`-token fixed supply + dPoS classification, the four token-role quotes (gas / staking / delegation /
> governance), the `Somi`/`milliSomi`/`microSomi`/`nanoSomi`/`Wei` ladder with the `gWei`↔`nanoSomi` synonym (the basis
> for setting `gasPrice`/`maxFeePerGas` in nanoSomi the way one reasons in gwei), and *"50% of all gas fees are
> distributed to validators as rewards."* **One precision improvement** (the recent runs' paraphrase-to-verbatim
> discipline — same class as the 32-SOMI / events-quote / compilation-quote / provenance / Data-ID / fork-command
> tightenings): the article rendered the staking-reward funding source as the parenthetical paraphrase **`(and
> treasury)`** in two places, but upstream states it as a quotable sentence — *"They will be rewarded from gas fees and
> treasury-based incentives."* Folded in verbatim in both the *AI engineer* section and open question 2, and recorded in
> the article header re-verification block + source caveat. The fixed-supply / 50%-burn / no-inflation conclusions in the
> cost model are unaffected — only the quote was sharpened. ⚠️ **One honest scope note:** the SOMI-coin page documents the
> `gWei`↔`nanoSomi` equivalence as a *table synonym* but carries **no prose sentence** stating "set gas price in nanoSomi"
> — so the article's how-to sentence is a (sound) authorial inference from the table, not a quote; it remains framed as
> guidance, not in quote marks. No new glossary term (precision on already-defined concepts — *Gas*, *SOMI / STT*, *Storage
> rent* — concept-keyed convention held); no new flags; none of the three pages names a chain ID or RPC URL; PHI boundary
> unaffected (tokenomics meters hashes/state/amounts, never clinical text). With this, **every high-consequence citation
> cluster in the folder is re-verified on 2026-05-22 or 2026-05-23.** The residual research gaps (millisecond TTF,
> sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Debug-playbook + go-live-checklist re-verified — the last two pages still on the 2026-05-20 capture; a misquoted audit best-practice line corrected (2026-05-23).**
> A fresh [`llms.txt`](https://docs.somnia.network/llms.txt) diff this run against this folder's citations again left
> **only off-V1 surfaces uncited** (NFT/DEX/IPFS/wallet-login tutorials, dao-ui browser pages, MetaMask-housekeeping
> get-started pages incl. the new *removing-the-somnia-devnet-network* / *update-the-block-explorer-in-metamask* entries,
> the litepaper's duplicate `/litepaper/*`+`/somnia-litepaper/*` routes, listing/index pages) — V1 frontier re-confirmed
> exhausted. Although the prior run declared "every high-consequence cluster re-verified," an audit of the
> **re-verification record itself** found two pages cited in
> [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md) that **no** 2026-05-22/23 sweep had
> ever logged: the [debug playbook](https://docs.somnia.network/developer/development-frameworks/debug-playbook.md) (the
> implementer's EVM error→fix runbook) and the [go-live checklist](https://docs.somnia.network/developer/deployment-and-production/go-live-checklist.md)
> (the production cut-over runbook) — both captured **2026-05-20** and skipped by the core-deploy (Foundry/Hardhat/viem/
> verify), security (audit-checklist/security-101), and forking sweeps as "adjacent." They were re-fetched live under the
> **sharpened soft-404 rule** (real body, not just HTTP `200`). The **debug playbook is un-drifted** — the failure-mode
> table (`execution reverted`/`out of gas`/`nonce too low`/`replacement underpriced`/static-call), `forge test -vvvv` /
> `npx hardhat test --trace`, the `npx hardhat node --fork https://api.infra.mainnet.somnia.network` fork command, the
> gas-differs-from-Ethereum note, and the `iface.parseError()` custom-error decode all match verbatim. **One precision fix
> on the go-live page** (the recent runs' paraphrase-to-verbatim discipline — same class as the 32-SOMI / events-quote /
> compilation-quote / provenance / Data-ID / fork-command / reward-source tightenings): its two closing best-practice lines
> were quoted in the article as `"test thoroughly on Shannon Testnet before mainnet launch"` and `"complete security audits
> prior to deployment"`, but upstream reads **"Always test on Shannon Testnet before mainnet deployment"** and **"Run audit
> checklist (see Smart Contract Security 101)"** — the first a reworded near-quote, the **second a genuine misquote**
> (upstream never uses the phrase "complete security audits prior to deployment"). Restored verbatim; the corrected line is
> V1-relevant because the go-live checklist's own audit step **points back to** the
> [security-101](https://docs.somnia.network/developer/security/smart-contract-security-101.md) pull-payment +
> reentrancy-guard patterns the article already folds into `ClaimSettlement.sol` — a real cross-link the gloss had hidden.
> The rest of the go-live page is un-drifted (`.env`-not-committed secrets, explorer address cross-check, multisig-gated
> owner/pauser/upgrader roles, the `pause()`/feature-flag/upgrade-proxy/role-revocation rollback plan). No new glossary
> term; no new flags; neither page names a chain ID (the debug-playbook's *anvil* example still prints the stale
> `dream-rpc.somnia.network` RPC — the **thirteenth** sighting; our quoted fork command already uses canonical
> `api.infra.mainnet`). The residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas
> floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Native-agents overview page re-verified — the last agents-section page still on a 2026-05-21 check; a receipt gloss promoted to overview verbatim (2026-05-23).**
> With every other high-consequence cluster re-verified across 2026-05-22/23, the **stalest high-consequence surface left**
> was the [agents overview](https://docs.somnia.network/agents/readme.md) page behind the starred
> [`chain-resources/native-agents.md`](native-agents.md) — the candidate adjudication substrate. Its
> sibling agents pages had all been re-swept on 2026-05-22 (economics: gas-fees/LLM-Inference/custom-consensus; base
> agents: JSON-API/LLM-Parse; plus receipts/from-Solidity deepened and quickstart read), but the **overview** — the page
> grounding the article's core *consensus-on-result* + *signed-receipt* thesis — was still on the 2026-05-21 capture. A
> wrong consensus or receipt claim here mis-frames the whole "auditable adjudication" pitch, so it earned the priority
> re-check. Re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`): it renders **real
> content** and is **un-drifted** — the consensus quotes (*"a decentralized subset of the Somnia network nodes"*, *"only
> when a majority of nodes reach consensus on the result"*), the receipt definition (*"signed manifest of intermediate
> computation steps"*), and the invocation quote (*"the interface and schema of each Agent closely follows the standard
> Solidity contract ABI"*) all **match verbatim**. **One precision improvement** (the recent runs' paraphrase-to-verbatim
> discipline — same class as the 32-SOMI / events-quote / compilation-quote / provenance / Data-ID / fork-command /
> reward-source tightenings): the AI-engineer section's receipt summary had carried a **bolded gloss** *"only the final
> result is consensus-bound"* where the overview states a quotable sentence — promoted to the upstream verbatim **"The
> final result is what validators reach consensus on"** + **"Receipt steps are subjective."** The verbatim form is a real
> sharpening, not cosmetic: it attributes the consensus to **validators** (the gloss's "consensus-bound" was agentless),
> and a cross-link was added noting the dedicated [receipts](https://docs.somnia.network/agents/invoking-agents/receipts.md)
> page states the **same** boundary in its **own** words (*"The final output of the agent is what validators reach
> consensus on"* / *"The execution steps are subjective"*) — so the AI-engineer section now quotes the page it cites (the
> overview) and the receipt section quotes the page it cites (receipts), neither blending the two. PHI boundary
> unaffected (the no-PHI-on-chain + no-PHI-in-receipt rule is unchanged). **With this, every cited agents-section page is
> re-verified on the 2026-05-22/23 passes.** No new glossary term (precision on the already-defined *Receipt (agent)* /
> *Agent (two senses)* concepts — concept-keyed convention held); no new flags; the page names no chain ID or RPC URL. The
> residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged —
> upstream gaps, not stale links.
>
> ✅ **Data Streams *tutorial* cluster re-verified — the open-question-#4 quotes confirmed verbatim; the `msg.sender` causal clause promoted to upstream verbatim (2026-05-23).**
> [`chain-resources/data-streams.md`](data-streams.md) carries three citation tiers: the **SDK** cluster
> (re-verified 2026-05-22), the **concept** pages (all six re-verified 2026-05-23), and the **tutorials**. After the first
> two sweeps the **stalest high-consequence surface left** was the two tutorials carrying the verbatim quotes behind
> **open question #4** — the direct-publish-vs-proxy V1 architecture fork that decides whether agent identity is
> unspoofable: the [multiple-publishers](https://docs.somnia.network/developer/data-streams/tutorials/working-with-multiple-publishers-in-a-shared-stream.md)
> and [dApp publisher-proxy pattern](https://docs.somnia.network/developer/data-streams/tutorials/the-dapp-publisher-proxy-pattern.md)
> pages, added 2026-05-21 and never swept on the 2026-05-22/23 passes. Both were re-fetched live under the **sharpened
> soft-404 rule** (real body, not just HTTP `200`) and **render real content; every quote matches upstream verbatim —
> un-drifted:** the multi-publisher *"decouples data schemas from publishers"* / *"…publish data using the **same
> schema**"* / `publisher` *"To know where the data came from"* / per-publisher `getAllPublisherDataForSchema` read / *"a
> list of publishers we were interested in"*, and the proxy page's *"is not scalable, fast, or efficient"* / *"**10,000
> separate read calls**"* / *"To the Streams contract, the **only publisher** is your DApp Contract's address"* / *"we lose
> the built-in provenance. We must re-create it by adding the original player's address to the schema itself"*. **One
> precision improvement** (the recent runs' paraphrase-to-verbatim discipline — same class as the 32-SOMI / events-quote /
> compilation-quote / provenance / Data-ID / fork-command / reward-source / receipt-gloss tightenings): the proxy page
> states the *causal mechanism* — *"Since the `msg.sender` to the Streams contract will always be our *proxy contract*, …"*
> — **inside** the provenance-loss sentence, but the article had quoted only the consequence and **re-derived the
> `msg.sender` cause in its own words**. The quote in *The proxy trade-off* was extended to fold in that verbatim clause,
> so the proxy section now ties to the *Provenance* section's `msg.sender`-keyed-storage argument with upstream's own
> words rather than an authorial bridge — load-bearing because open question #4 turns entirely on whether `msg.sender` is
> the agent or the proxy. ⚠️ The multi-publisher tutorial prints the stale `dream-rpc.somnia.network` testnet RPC + chain
> ID `50312` (the **fourteenth** `dream-rpc` sighting; `50312` agrees with network-info — precedence rule unchanged); the
> proxy page prints no RPC or chain ID. PHI boundary unaffected (a proxy-filled `sender` field is still on-chain state).
> No new glossary term; no new flags. With this, **the multi-publisher + proxy tutorials join the SDK + concept clusters
> as re-verified on the latest passes**, and every high-consequence Data Streams surface now carries a 2026-05-22 or
> 2026-05-23 re-verification date. The residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi
> base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Indexing query-layer + Blockscout-REST cluster re-verified — the audit-UI read path, never re-fetched since it was woven; two paraphrases promoted to upstream verbatim (2026-05-23).**
> An audit of [`chain-resources/indexing-subgraphs.md`](indexing-subgraphs.md)'s **re-verification
> record** (not its content) found the stalest high-consequence surface left in the folder: the article's deploy +
> WebSocket-listener cluster was re-verified 2026-05-22 and the `ecosystem-tools/subgraphs` listing 2026-05-23, but the
> **four pages added 2026-05-22 — the audit-UI read path, the literal payoff of the [demo loop](../../../ROADMAP.md)** —
> carried only an "added" stamp and had **never been re-fetched to confirm they hadn't drifted**. (A page can be cited and
> woven yet never drift-checked; "added on X" ≠ "re-verified live on Y.") All four were re-fetched live under the
> **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real content; every load-bearing fact matches
> upstream verbatim — un-drifted:** the
> [Apollo guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-apollo-client.md)
> (`pollInterval: 5000`, `ApolloClient`+`InMemoryCache`+`gql`+`useQuery`, Node 20+), the
> [Next.js-fetch guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-nextjs-fetch.md)
> (the `app/api/proxy/route.ts` `POST` proxy, `Client-ID` header, `NEXT_PUBLIC_SUBGRAPH_URL`/`…_CLIENT_ID`,
> `useEffect`-on-mount-only refresh), the
> [explorer API page](https://docs.somnia.network/developer/deployment-and-production/explorer-api-health-and-monitoring.md)
> (both `/api` base URLs, the four query interfaces, all three `GET /v2/...` paths, the Winston `5242880`/5-files rotation —
> **still no** uptime/rate-limit/indexing-latency figure, re-confirming open question 2's gap), and the
> [Ormi Data API page](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/using-data-apis-ormi.md)
> (`…/v1/address/{walletAddress}/balance/erc20`, `Authorization: Bearer`, **ERC-20-balances-only** — re-confirming the
> open-question-3 negative). **Two paraphrases passing as verbatim were tightened** (the recent runs' paraphrase-to-verbatim
> discipline — same class as the 32-SOMI / events-quote / compilation-quote / provenance / Data-ID / fork-command /
> reward-source / receipt-gloss / `msg.sender` tightenings): (1) the Apollo polling mechanism, an authorial gloss *"Apollo
> re-runs the query every 5 s,"* was promoted to the upstream verbatim *"The `pollInterval` automatically re-executes the
> query every 5 seconds"* (and the inline `useQuery` corrected to the full upstream `variables: { first: 10 },
> pollInterval: 5000`) — load-bearing because it is the folder's **fourth** "polling, not a subscription" confirmation;
> (2) the Next.js example query, dressed as a quote *"the latest 10 transfers ordered by `blockTimestamp`,"* was grounded
> in the actual upstream GraphQL `transfers(first: 10, orderBy: blockTimestamp, orderDirection: desc)`. The
> [`GLOSSARY.md`](../GLOSSARY.md) *Polling* entry needed no change (its `pollInterval: 5000` code citation is verbatim-confirmed;
> its definition is authorial, not a false quote). No new glossary term; no new flags; none of the four pages names a chain
> ID or uses the stale `dream-rpc` RPC; PHI boundary unaffected (the read path surfaces only hash/state/address/amount
> calldata + decoded logs). With this, **every citation cluster in the indexing article — deploy, WebSocket listener, query
> layer, Blockscout REST, and the ecosystem listing — is re-verified on 2026-05-22 or 2026-05-23.** The residual research
> gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Data Streams worked-example case studies re-verified — the last un-swept Data Streams tier; the F1 "no `subscribe`" refutation re-confirmed (2026-05-23).**
> Following the same *"added on X" ≠ "re-verified live on Y"* audit that drove the prior indexing-query-layer run, an audit
> of [`chain-resources/data-streams.md`](data-streams.md)'s **re-verification record** found the stalest
> high-consequence surface left in the folder: the article's three **worked-example case studies** —
> [tap-game](https://docs.somnia.network/developer/data-streams/tutorials/build-a-realtime-on-chain-game.md),
> [on-chain-chat](https://docs.somnia.network/developer/data-streams/tutorials/build-a-minimal-on-chain-chat-app.md), and
> [F1](https://docs.somnia.network/developer/data-streams/tutorials/streams-case-study-formula-1.md) — were **added
> 2026-05-22 and never re-fetched since** (the SDK cluster was re-verified 2026-05-22, the six concept pages and the
> multi-publisher/proxy tutorials 2026-05-23, but this fourth tier carried only an "added" stamp). They hold load-bearing
> claims: the open-question-#1 write-rate pattern (no batching API → N independent `set()` txns, source-side rate-limit),
> the open-question-#4 publisher-proxy-by-default + the `content`-field PHI hazard, and the central **negative** that *no
> worked upstream tutorial demonstrates `sdk.streams.subscribe`* — and a negative is exactly the claim an upstream edit
> could silently invalidate. All three were re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP
> `200`) and **render real content; every load-bearing fact matches upstream verbatim — un-drifted:** the tap-game's
> "written directly to the blockchain" / server-side `getAllPublisherDataForSchema` + "every few seconds" poll / no-`subscribe`
> path; the chat-app's `"uint64 timestamp, bytes32 roomId, string content, string senderName, address sender"` schema, the
> proxy-signed `sender` field, the "publishes … while simultaneously emitting … captured in real time by subscribers" prose
> vs. the actual "updates with simple polling and does not rely on WebSocket" `refreshMs = 5000` re-read, and the
> `zeroBytes32` import; and the **F1 refutation re-confirmed** ("none present" — no read, `subscribe`, `watch`,
> `setAndEmitEvents`, `emitEvents`, or OpenF1 poller; the coordinates/driver schemas + `parentSchemaId` extension intact).
> **One detail folded in** (the full-fetch discipline of the SDK-cluster pass, not a correction): the tap-game's rate-limit
> is held in a named **`cooldownMs`** constant and its Data ID is the full `keccak256(toHex(\`${address}-${Number(now)}\`))`
> — both previously elided as `(...)`; `cooldownMs` now mirrors the chat-app's already-captured read-side `refreshMs = 5000`.
> No quote was tightened — the article's ellipsis quotes were already faithful elisions, not paraphrases passing as verbatim
> — so this is a clean re-verification. ⚠️ All three still print the stale `dream-rpc.somnia.network` testnet RPC (chain ID
> `50312` where present, agreeing with network-info) — sightings already recorded inline; precedence rule unchanged. No new
> glossary term; no new flags; PHI boundary unaffected. With this, **all four Data Streams citation tiers — SDK, concept,
> multi-publisher/proxy tutorials, and worked-example case studies — are re-verified on the 2026-05-22/23 passes**, and the
> Data Streams article is fully drift-checked. The residual research gaps (millisecond TTF, sustained TPS, block time, the
> nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Litepaper architecture-overview page re-verified — the last core consensus surface still on a 2026-05-21 check; the four-innovations table confirmed un-drifted (2026-05-23).**
> An audit of [`chain-resources/consensus-and-execution.md`](consensus-and-execution.md)'s
> **re-verification record** (the recent runs' *"added/quoted on X" ≠ "re-verified live on Y"* discipline) found the stalest
> high-consequence surface left in the folder: the **parent** [architecture overview](https://docs.somnia.network/concepts/somnia-blockchain/overview.md)
> litepaper page — listed first in that article's upstream-sources header and the **source of its four-innovations table**
> — had slipped through every 2026-05-22/23 sweep, because each sweep targeted a *sibling* page (the four dedicated
> innovation pages, problem, introduction, security, developer FAQ) rather than the overview itself. It was last on the
> **2026-05-21** capture. (A page can anchor an article's central table yet never be drift-checked; the recent indexing-
> query-layer and Data-Streams case-study runs found the same "added ≠ re-verified" gap.) Re-fetched live under the
> **sharpened soft-404 rule** (real body, not just HTTP `200`): it **renders real content** (all four innovation sections
> populated, not a GitBook soft-404), and **all four table quotes match upstream verbatim — un-drifted:** MultiStream *"This
> structure decouples data production from the consensus process, significantly enhancing overall efficiency,"* ASE *"Somnia
> achieves execution speeds close to hand-written C++ contracts, facilitating the execution of millions of transactions per
> second on a single core,"* IceDB's *"15-100 nanoseconds with built in snapshotting,"* and Advanced Compression's
> *"extremely high compression ratios."* The table's ASE entry is a **faithful ellipsis elision** (drops only upstream's
> connective *"facilitating the execution of"*; quoted fragments word-for-word), so **no quote needed tightening** — a clean
> re-verification, like the recent worked-example case-study pass. Recorded in the article's header re-verification block +
> a new source-caveat paragraph. **With this, every page cited by the consensus article is re-verified on the 2026-05-22/23
> passes** (the developer FAQ on 2026-05-22; the article header's stale 2026-05-21 FAQ date-label is a labelling lag, not a
> stale citation — noted inline for a future reconciliation, *done the next run — see below*). No new glossary term; no new
> flags; the page names no chain ID or RPC URL; PHI boundary unaffected (background article). The residual research gaps
> (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Consensus article's developer-FAQ date-label reconciled — and the FAQ re-verified live, advancing it to 2026-05-23.**
> A fresh [`llms.txt`](https://docs.somnia.network/llms.txt) diff this run (**169 distinct paths**) against this folder's
> citations again left **only off-V1 surfaces uncited** (NFT/DEX/IPFS/wallet-login tutorials, dao-ui browser pages,
> MetaMask-housekeeping get-started pages, the litepaper's duplicate `/litepaper/*`+`/somnia-litepaper/*` routes, and
> listing/index pages) — V1 frontier re-confirmed exhausted, and every high-consequence citation cluster is already
> re-verified on 2026-05-22/23. The one item explicitly left open by the prior (architecture-overview) run was a **labelling
> lag**: [`chain-resources/consensus-and-execution.md`](consensus-and-execution.md) stamped its
> [developer FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md)
> citation **2026-05-21** in three places (header, dev-section corroboration callout, source caveat), even though the FAQ
> was actually re-verified live **2026-05-22** during the subscribe-vs-watch run — *"added/quoted on X" ≠ "re-verified on
> Y,"* in its inverse form (the page **was** re-checked; the label wasn't updated to say so). Rather than copy the
> 2026-05-22 date from this log, the FAQ was **re-fetched live** under the **sharpened soft-404 rule** (real body, not just
> HTTP `200`), which both discharges the lag and advances the stamp to today: it **renders real content and every quoted
> value is un-drifted** — "1,000,000+ transactions per second," "Sub-second transaction finality," the four innovations
> named identically, the "15-100 nanosecond" IceDB figure, and the three EVM-compat lines. Two standing facts re-confirmed:
> the **"Block Time: Optimized for real-time applications"** entry still carries **no number** (block-time research gap
> re-confirmed upstream's, not ours), and the page links out only to `chainlist.org` — **no** benchmark source — so no
> permitted off-domain path to a finality-in-ms figure from here. All three FAQ stamps in that article were updated to
> "fetched 2026-05-21, re-verified live 2026-05-22 and 2026-05-23," the prior run's inline flag was flipped to past-tense,
> and a reconciliation paragraph added to the article's source caveat. The FAQ contact `developers@somnia.network` was also
> re-confirmed, consistent with the `.network`-vs-`.foundation` reconciliation in
> [`chain-resources/smart-contract-dev.md`](smart-contract-dev.md). With this, **the consensus article's
> last labelling lag is closed** — every page it cites now carries a 2026-05-22/23 re-verification date in both header and
> caveat. No new glossary term; no new flags; no chain-ID conflict; PHI boundary unaffected. The residual research gaps
> (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Chainlink-oracles snapshot tutorial re-verified — the last oracles-article surface still on a 2026-05-21 check; the elided Data ID construction promoted to upstream verbatim (2026-05-23).**
> An audit of [`chain-resources/oracles-and-vrf.md`](oracles-and-vrf.md)'s **re-verification record**
> (the recent runs' *"added/quoted on X" ≠ "re-verified live on Y"* discipline) found the stalest high-consequence
> surface left in that article: its three dedicated DIA/Protofire/VRF pages and the ecosystem oracle listing were
> re-verified 2026-05-22, but the [*Integrate Chainlink Oracles* tutorial](https://docs.somnia.network/developer/data-streams/tutorials/integrate-chainlink-oracles.md)
> behind the **oracle→Data Streams snapshot-bot pattern** — load-bearing for that article's open question #1 (the
> snapshot option that makes a settlement rate verifiably attested, the only one leaving an on-chain record) — was added
> from a 2026-05-21 fetch and **never re-fetched since**. Re-fetched live under the **sharpened soft-404 rule** (real
> body, not just HTTP `200`): it renders **real content** and is **un-drifted** — the Sepolia ETH/USD feed
> `0x694AA1769357215DE4FAC081bf1f309aDC325306`, the `latestRoundData()`/`decimals()` (8-decimal) reads, the
> `uint64 timestamp, int256 price, uint80 roundId, string pair` schema, the provenance line *"Any dApp on Somnia can now
> read from and trust"*, chain ID `50312`, and the four `sdk.streams.*` write methods (`computeSchemaId`/`registerDataSchemas`/
> `encodeData`/`set`) all **match verbatim**. **One precision improvement** (the recent runs' paraphrase-to-verbatim
> discipline — same class as the 32-SOMI / events-quote / Data-ID / `msg.sender` tightenings): the article had elided the
> Data ID's construction (`dataId` was used in `set()` but never defined) and paraphrased its purpose; the re-fetch
> captured upstream's verbatim *"Create a unique Data ID (using the roundId to prevent duplicates)"* and the literal
> `toHex(\`price-${PAIR_NAME}-${priceData.roundId}\`, { size: 32 })` — now folded into the snapshot-bot bullet + code
> block, so the article's dedup claim quotes upstream rather than re-deriving it. ⚠️ The tutorial's `.env` prints the
> stale `dream-rpc.somnia.network` testnet RPC (the **fifteenth** sighting; `50312` agrees with network-info — precedence
> rule unchanged, use canonical `api.infra.testnet`); recorded in the article header + source caveat, the first time this
> tutorial's `dream-rpc` was logged. The cross-chain caveat (the tutorial reads Chainlink on Sepolia, writes to Somnia;
> Curie's variant is same-chain DIA/Protofire→Somnia) is unchanged. No new glossary term; no new flags; PHI boundary
> unaffected (an oracle snapshot moves a price + pair string, never clinical data). With this, **every citation in the
> oracles-and-vrf article carries a 2026-05-22 or 2026-05-23 re-verification date.** The residual research gaps
> (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Account-Abstraction cluster re-verified — the last article still entirely on a 2026-05-22 check; an AA-flow fragment promoted to upstream verbatim (2026-05-23).**
> A folder-wide audit of re-verification dates found [`chain-resources/account-abstraction.md`](account-abstraction.md)
> was the **only article with no 2026-05-23 re-verification** — every sibling had been swept, but the AA integration
> cluster (AA landing + both Thirdweb tutorials + wallet-providers + Pimlico) sat a day stale on its 2026-05-22 check.
> Its three **highest-consequence** pages — where a wrong factory address means a wrong smart account — were re-fetched
> live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **match verbatim**:
> [network-info](https://docs.somnia.network/developer/network-info.md) (testnet EntryPoint v0.7
> `0x0000000071727De22E5E9d8BAf0edAc6f37da032` + factory `0x4be0ddfebca9a5a4a617dee4dece99e7c862dceb`, **both mainnet
> cells still blank**, chain IDs `5031`/`50312`, both Multicall3 addresses matching the connection table), the
> [AA overview](https://docs.somnia.network/developer/building-dapps/account-abstraction.md) (four capability bullets +
> Thirdweb/Privy, no on-page address/chain-ID/RPC), and the gasless-with-Thirdweb tutorial at the **truncated** slug
> (`FACTORY_ADDRESS 0x4be0…dceb`, `sponsorGas: true`, `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, `thirdweb/chains` import). **One
> paraphrase promoted to upstream verbatim:** the article had quoted only the fragment *"ERC-4337-style flows"*, where
> upstream's full bullet is *"Implement user operations via ERC-4337-style flows"* — now folded into the body + source
> caveat. ⚠️ The **soft-404 boundary held again**: the full `…-with-thirdweb.md` slug returned GitBook's verbatim *"The URL
> … does not exist…"* body on 2026-05-23, so the truncated `…-with-thirdw.md` stays canonical and a status-code-only link
> check remains unsafe here. With this, **every chain-resources article now carries a 2026-05-23 re-verification date.**
> No new glossary term; no new flags; no chain-ID conflict; PHI boundary unaffected (AA touches signing + gas, never
> payload). The residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are
> unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY native-agent-economics + consensus cluster re-verified — the first dedicated glossary drift-check; a 2026-05-20-capture labelling lag closed (2026-05-23).**
> With every **chain-resources article** now carrying a 2026-05-23 re-verification date, the **stalest high-consequence
> surface left in the folder** was [`GLOSSARY.md`](../GLOSSARY.md) itself — the explicit entry point the README tells a new
> dev to "read top-to-bottom once," yet **never the subject of its own re-verification sweep**. Several of its
> highest-consequence entries — the per-claim **cost-model + adjudication inputs** — still sat on the **original
> 2026-05-20 capture** with **no date-stamp at all**, even though the native-agents *article* economics cluster (the same
> source pages) was re-verified 2026-05-22: a labelling lag of exactly the class the consensus-FAQ-date run fixed
> (*"re-verified at the article ≠ stamped in the glossary"*). Following the folder's discipline (**re-fetch live + confirm
> the specific quoted value, never bulk-copy a date**), the two source pages behind three glossary entries were re-fetched
> live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real content; every quoted
> value is un-drifted verbatim:** [agents gas-fees](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)
> (`minPerAgentDeposit` `0.01`; per-agent `0.03`/`0.07`/`0.10`; worked `msg.value` `0.12`/`0.24`/`0.33` SOMI; the
> `getRequestDeposit()`-floor→time-out footgun; `defaultTimeout` 15 min, subcommittee `3`/threshold `2`; the
> `receive() external payable` / `NativeTransferFailed` rebate path; `perMember = median(executionCosts)`) and
> [custom-consensus](https://docs.somnia.network/agents/invoking-agents/custom-consensus.md) (`ConsensusType { Majority,
> Threshold }` enum `0`/`1`, both definitions, the "3 of 5" default, the median/XOR aggregation examples). The three
> entries fully grounded in those two pages — **Deposit-and-rebate (agent fee model)**, **Subcommittee**, and
> **Consensus** — each received an inline `re-verified live 2026-05-23` stamp naming the confirmed values, advancing them
> from the un-dated 2026-05-20 capture. ⚠️ **Honest scope note:** only the entries sourced to the two pages re-fetched this
> run were stamped; the sibling agent entries' *method-signature* halves (`inferString` family, JSON-API's six fetchers,
> LLM-Parse's extractors) cite the LLM-Inference / JSON-API / LLM-Parse pages, which were re-verified at the **article**
> level 2026-05-22 but **not** re-fetched this run — left unstamped rather than stamped on the strength of a sibling page,
> a candidate for the next glossary pass alongside the still-2026-05-20/21-dated Data Streams + reactivity glossary
> entries. No new glossary term (precision/stamps on already-defined concepts — concept-keyed convention held); no new
> flags; no chain-ID conflict; PHI boundary unaffected (agent economics meters deposits/gas, never payload). The residual
> research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps,
> not stale links.
>
> ✅ **GLOSSARY Data Streams addressing pair re-verified — the second glossary drift-check, taking the next cluster the
> first pass flagged (2026-05-23).** The prior run named "the still-2026-05-20/21-dated Data Streams + reactivity glossary
> entries" as the next glossary pass; this run takes the tightest single-source slice of it. The **Data ID** and
> **Schema / Schema ID** entries are the two glossary terms grounded entirely in **one** page —
> [understanding schemas, schema IDs, data IDs & publisher](https://docs.somnia.network/developer/data-streams/concepts/understanding-schemas-schema-ids-data-ids-and-publisher.md)
> — and both still sat on the un-dated 2026-05-20 capture (the `data-streams.md` *article* was swept repeatedly, but the
> glossary entries never were — the same labelling lag the first pass closed for the agent-economics cluster). The page was
> re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`; first heading *"Understanding
> Schemas, Schema IDs, Data IDs, and Publisher"*) and **renders real content; every quoted value is un-drifted verbatim:**
> the Schema ID's *"derived from your schema using a hashing algorithm"* + *"change even one character in the schema
> definition, the Schema ID will change"* and the `computeSchemaId` name; the Data ID's *"unique key representing that
> entry"* / *"uniquely identifies a specific record (or row)"* / *"created by hashing a string, typically by combining
> context and timestamp"* / same-Data-ID *"updates the existing entry rather than duplicating it"*. Both entries received
> an inline `re-verified live 2026-05-23` stamp naming the confirmed quotes, advancing them off the 2026-05-20 capture.
> This matters for V1 because the content-addressed Schema ID is the load-bearing claim under our *"versioning = schema
> extension, not migration"* design, and the same-Data-ID upsert rule is the documented append-vs-overwrite lever for the
> audit log — both now sourced-and-stamped, not assumed. ⚠️ **Honest scope note:** only the two entries fully sourced to
> this page were stamped; the remaining Data Streams glossary entries (Publisher, Subscriber, Shared stream,
> Publisher-proxy, Schema extension, SchemaEncoder, Event-vs-data-stream) cite *other* Data Streams pages not re-fetched
> this run — left unstamped rather than dated on the strength of a sibling page, the natural next glossary cluster
> alongside the still-undated reactivity entries. No new glossary term (precision/stamps on already-defined concepts); no
> new flags; no chain-ID conflict; PHI boundary unaffected (Data IDs are hashed from claim/step metadata, never clinical
> content — the entry's own caveat held).
>
> ✅ **GLOSSARY `what-is-data-streams` slice re-verified — the third glossary drift-check; Publisher fully stamped via a second source already on 2026-05-23 (2026-05-23).**
> The prior run named "the remaining Data Streams glossary entries (Publisher, Subscriber, Shared stream, Publisher-proxy,
> Schema extension, SchemaEncoder, Event-vs-data-stream)" as the next glossary cluster; this run takes the tightest
> single-source slice of it. **Publisher**, **Subscriber**, and the main **Data Streams** entry in
> [`GLOSSARY.md`](../GLOSSARY.md) carry their *definitional* quotes from **one** page —
> [what is Somnia Data Streams](https://docs.somnia.network/developer/data-streams/what-is-somnia-data-streams.md) — which
> still sat on the un-dated 2026-05-20 capture (the `data-streams.md` *article* was swept repeatedly, but these glossary
> entries never were — the same labelling lag the first two glossary passes closed). The page was re-fetched live under
> the **sharpened soft-404 rule** (real body, not just HTTP `200`; it renders a full "Definition of Terms" table, not a
> GitBook soft-404) and **every quoted value is un-drifted verbatim:** the headline *"Somnia Data streams enable developers
> to build applications that both emit EVM event logs and write data to the Somnia chain without Solidity"* (the glossary's
> *"emit EVM event logs and write data to the Somnia chain without Solidity"* is a faithful elision), the Publisher
> *"The signer that writes data. EOA or Smart Contract that writes data under a schema."*, and the Subscriber *"reader that
> fetches all records for a (schemaId, publisher) pair."* All three entries received an inline `re-verified live 2026-05-23`
> stamp naming the confirmed quotes, advancing them off the 2026-05-20 capture. **Publisher is now fully stamped, not
> partially:** its *second* source — the [provenance & verification](https://docs.somnia.network/developer/data-streams/concepts/data-provenance-and-verification-in-streams.md)
> page's *"impossible … cannot fake their `msg.sender`"* non-forgery quote — was already re-verified live 2026-05-23 in the
> concept-cluster pass, so re-fetching `what-is` this run closes the only remaining un-stamped half, and a note to that
> effect was added to the entry. **One corroboration recorded, not re-stamped:** the page's "Definition of Terms" table is
> a **second** upstream source for the already-stamped *Data ID* (*"developer-chosen 32-byte key per record"*), *Schema /
> Schema ID* (`schemaId` *"computed from the schema string"*), and *Encoder* (*"converts typed values ⇄ bytes according to
> the schema"*) entries — those keep their 2026-05-23 stamp from the `understanding-schemas` page and were not re-dated on
> the strength of this corroboration. ⚠️ **Honest scope note:** only the three entries fully sourced to this page (plus
> Publisher's now-complete second half) were stamped; the remaining Data Streams glossary entries (Shared stream,
> Publisher-proxy, Schema extension, SchemaEncoder, Event-vs-data-stream) cite *other* Data Streams pages not re-fetched
> this run — left unstamped rather than dated on a sibling page, the natural next glossary cluster alongside the still-
> 2026-05-20/21-dated reactivity entries. No new glossary term (precision/stamps on already-defined concepts —
> concept-keyed convention held); no new flags; no chain-ID conflict; PHI boundary unaffected (a Data Streams write is
> on-chain state, subject to the full no-PHI-on-chain rule). The residual research gaps (millisecond TTF, sustained TPS,
> block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY shared-stream ↔ publisher-proxy pair re-verified — the fourth glossary drift-check; an authorial bridge promoted to upstream verbatim (2026-05-23).**
> The prior run named "the remaining Data Streams glossary entries (Shared stream, Publisher-proxy, Schema extension,
> SchemaEncoder, Event-vs-data-stream)" as the next glossary cluster; this run takes its tightest, most coherent slice —
> the **Shared stream (multi-publisher)** and **Publisher-proxy pattern** entries in [`GLOSSARY.md`](../GLOSSARY.md), the two
> opposite-direction halves of the same fan-out architecture (each grounded in **exactly one** tutorial page, and already
> cross-linked to each other from the *Publisher* entry). Both tutorial pages were re-verified at the *article* level
> 2026-05-23 (the Data-Streams tutorial-cluster pass), but the glossary entries still sat on the un-dated **2026-05-20**
> capture — the same labelling lag the first three glossary passes closed. Following the folder's discipline (**re-fetch
> live + confirm the specific quoted value, never bulk-copy a date**), both source pages were re-fetched live under the
> **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real content; every glossary-quoted value is
> un-drifted verbatim:** the [multiple-publishers](https://docs.somnia.network/developer/data-streams/tutorials/working-with-multiple-publishers-in-a-shared-stream.md)
> tutorial's *"decouples data schemas from publishers"* / *"multiple different accounts (or devices) … publish data using
> the **same schema**"* + the `getAllPublisherDataForSchema` per-publisher read, and the
> [proxy-pattern](https://docs.somnia.network/developer/data-streams/tutorials/the-dapp-publisher-proxy-pattern.md)
> tutorial's *"not scalable, fast, or efficient"* / *"10,000 separate read calls"* / *"To the Streams contract, the **only
> publisher** is your DApp Contract's address."* Both entries received an inline `re-verified live 2026-05-23` stamp naming
> the confirmed quotes, advancing them off the 2026-05-20 capture. **One precision improvement** (the recent runs'
> paraphrase-to-verbatim discipline — same class as the 32-SOMI / events-quote / Data-ID / `msg.sender` tightenings, and
> mirroring exactly what the 2026-05-23 tutorial-cluster pass did to the *article's* "proxy trade-off" section): the
> Publisher-proxy entry had bridged the *"only publisher"* and *"lose the built-in provenance"* quotes with an authorial
> **"so you"**, where upstream states the **causal mechanism itself** — *"Since the `msg.sender` to the Streams contract
> will always be our *proxy contract*, we lose the built-in provenance. We must re-create it by adding the original
> [player's] address to the schema itself"* (re-confirmed live this run). The quote was extended to fold in that verbatim
> clause (with the existing honest `[author's]` bracket-generalization of upstream's game-tutorial "player's" preserved),
> so the entry now quotes the `msg.sender` cause rather than re-deriving it in its own words — load-bearing because the
> direct-publish-vs-proxy V1 fork (open question #4) turns entirely on whether `msg.sender` is the agent or the proxy.
> ⚠️ **Honest scope note:** only the two entries fully sourced to the two pages re-fetched this run were stamped; the
> remaining Data Streams glossary entries (**Schema extension**, **SchemaEncoder**, **Event-vs-data-stream**) cite *other*
> Data Streams pages not re-fetched this run — left unstamped rather than dated on the strength of a sibling page, the
> natural next glossary slice alongside the still-2026-05-20/21-dated reactivity entries. The multi-publisher tutorial's
> stale `dream-rpc` RPC + chain ID `50312` are already logged at the article level (the fourteenth `dream-rpc` sighting);
> the proxy page prints no RPC or chain ID. No new glossary term (precision/stamps on already-defined concepts —
> concept-keyed convention held); no new flags; no chain-ID conflict; PHI boundary unaffected (a proxy-filled `sender`
> field is still on-chain state, subject to the full no-PHI-on-chain rule). The residual research gaps (millisecond TTF,
> sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY Data Streams cluster finished — the sixth glossary drift-check; a misquote passing as verbatim corrected (2026-05-23).**
> The intervening **fifth** glossary drift-check (commit `5b7c5f9`, not previously logged here) re-verified the
> **Reactivity** + **Reactive-transaction** pair against five upstream pages and caught one genuine drift — the litepaper
> [on-chain-reactivity](https://docs.somnia.network/concepts/somnia-blockchain/on-chain-reactivity.md) page **no longer
> carries** the *"Somnia Reactivity is currently only available on TESTNET"* sentence it published as of the 2026-05-22
> capture (reconciled in [`GLOSSARY.md`](../GLOSSARY.md) + [`chain-resources/reactivity.md`](reactivity.md)
> as "restriction no longer documented," **not** positive mainnet confirmation; **flagged for human review** before any
> mainnet on-chain-reactivity dependence). This **sixth** pass takes the cluster the fourth pass named as the next slice
> — the three remaining un-stamped Data Streams glossary entries, still on the un-dated **2026-05-20** capture even though
> their source pages were re-verified at the *article* level on 2026-05-22/23: **Event stream (vs data stream)**,
> **Schema extension / parent schema**, and **`SchemaEncoder`**. Following the folder's discipline (**re-fetch live +
> confirm the specific quoted value, never bulk-copy a date**), all four source pages were re-fetched live under the
> **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real content; the load-bearing quotes are
> un-drifted verbatim:** the [SDK methods guide](https://docs.somnia.network/developer/data-streams/sdk-methods-guide.md)
> (*"for off-chain reactivity"*, `emitEvents` *"without persisting new data"*, the `set`/`emitEvents`/`setAndEmitEvents`
> "atomic" triple), the [extending & composing schemas](https://docs.somnia.network/developer/data-streams/concepts/extending-and-composing-data-schemas.md)
> page (*"recursively fetch parent schema until the end of the chain is reached"*, *"For maximum composability, all
> schemas should be public"*, `parentSchemaId`/`registerDataSchemas`/`computeSchemaId`), and
> [build your first schema](https://docs.somnia.network/developer/data-streams/tutorials/build-your-first-schema.md) (the
> `new SchemaEncoder(chatSchema)` → `encoder.encodeData([…])` → `encoder.decodeData(encodedData)` round-trip). All three
> entries received an inline `re-verified live 2026-05-23` stamp. **One precision fix** (the recent runs'
> paraphrase-to-verbatim discipline — same class as the 32-SOMI / events-quote / Data-ID / `msg.sender` tightenings): the
> **Event stream** entry quoted, inside quote marks attributed to *both* the SDK-methods and concepts pages, the phrase
> *"can operate independently or in tandem"* — but **neither page says that** (SDK methods: *"use them together for
> comprehensive applications"*; the [concepts](https://docs.somnia.network/developer/data-streams/concepts.md) page:
> *"Serving different purposes, data and event streams can be used independently or together"*). It was corrected to the
> concepts page's verbatim wording, **matching what the 2026-05-23 concept-cluster pass had already done to the
> [`data-streams.md`](data-streams.md) article** — a glossary-vs-article quote lag, now closed. Two honest
> notes recorded inline, not corrected: the Schema-extension entry's **"multiple versions coexist"** is an authorial gloss
> (upstream demonstrates a child appending a field to a re-used parent but does not state coexistence in those words), and
> the `SchemaEncoder` entry shows the API shape **generically** (`schemaString`/`rawBytes` are placeholders, not verbatim
> upstream identifiers). With this, **all Data Streams glossary entries are re-verified on 2026-05-23**; the natural next
> glossary slice is the still-2026-05-20/21-dated entries outside the Reactivity + Data Streams clusters (e.g. consensus,
> tokenomics, account-abstraction terms). No new glossary term (precision/stamps on already-defined concepts —
> concept-keyed convention held); no new flags; no chain-ID conflict; PHI boundary unaffected (Data Streams writes are
> on-chain state, subject to the full no-PHI-on-chain rule). The residual research gaps (millisecond TTF, sustained TPS,
> block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY consensus-execution core pair re-verified — the seventh glossary drift-check; a mis-attributed MultiStream quote corrected (2026-05-23).**
> The prior (sixth) pass named "the still-2026-05-20/21-dated entries outside the Reactivity + Data Streams clusters
> (e.g. consensus, tokenomics, account-abstraction terms)" as the next glossary slice; this run takes its tightest,
> most coherent slice — the two **core execution-layer innovation** entries in [`GLOSSARY.md`](../GLOSSARY.md),
> **MultiStream Consensus** and **Accelerated Sequential Execution (ASE)**, each grounded in **exactly one** dedicated
> litepaper page and both still on the un-dated **2026-05-20** capture even though their source pages were re-verified at
> the *article* level on 2026-05-23 (the consensus core-pages pass) — the same labelling lag the first six glossary
> passes closed. Following the folder's discipline (**re-fetch live + confirm the specific quoted value, never bulk-copy
> a date**), both pages were re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`;
> first headings *"MultiStream Consensus"* / *"Accelerated Sequential Execution"*) and **render real content; the
> load-bearing quotes are un-drifted verbatim:** [ASE](https://docs.somnia.network/concepts/somnia-blockchain/accelerated-sequential-execution.md)
> (*"parallel execution breaks down exactly when you need it"*, *"EVM compiler, which translates EVM bytecode to x86"*,
> *"only do this on contracts that are called frequently, falling back to standard interpreted EVM on the rest"*, *"can
> execute ERC-20 transfers in hundreds of nanoseconds"*) and [MultiStream](https://docs.somnia.network/concepts/somnia-blockchain/multistream-consensus.md)
> (*"provides full security against validators forking their own data chain"*, *"deterministic pseudorandom ordering of
> these data chains then provides a single globally ordered stream of bytes to be executed"*, the modified-PBFT +
> Autobahn-2024-whitepaper attributions). Both entries received an inline `re-verified live 2026-05-23` stamp.
> **One mis-attribution corrected** (the recent runs' paraphrase/quote-fidelity discipline — same class as the 32-SOMI /
> events-quote / compilation-quote / provenance / Data-ID / `msg.sender` tightenings): the MultiStream entry opened with
> *"decouples data production from the consensus process"* inside quote marks, attributed to the **dedicated**
> multistream-consensus page — but a live re-fetch shows that exact wording is the **overview** page's
> four-innovations-table phrasing; the dedicated page actually reads *"completely decouples the production and
> distribution of new data … with the consensus algorithm."* The opening quote was corrected to the dedicated page's
> verbatim, aligning the glossary with the attribution [`chain-resources/consensus-and-execution.md`](consensus-and-execution.md)
> already uses (it correctly sources the "decouples data production from the consensus process" table phrase to the
> overview page). ⚠️ **Honest scope note:** only the two entries fully sourced to the two pages re-fetched this run were
> stamped; the sibling consensus/execution entries (**IceDB**, **Advanced compression**, **Cuthbert**, **Layer 1**) and
> the tokenomics + account-abstraction clusters cite *other* pages not re-fetched this run — left unstamped rather than
> dated on the strength of a sibling page, the natural next glossary slices. No new glossary term (precision/stamps on
> already-defined concepts — concept-keyed convention held); no new flags; neither page names a chain ID or RPC URL; PHI
> boundary unaffected (background consensus/execution articles, no data flow). The residual research gaps (millisecond
> TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY four-innovations cluster finished — the eighth glossary drift-check; the other two core innovations stamped, a clean re-verification (2026-05-23).**
> The seventh pass re-verified the two **execution-layer** innovation entries (MultiStream + ASE) and named "the sibling
> consensus/execution entries (**IceDB**, **Advanced compression**, **Cuthbert**, **Layer 1**) … the natural next glossary
> slices." This **eighth** pass takes the tightest, most coherent slice of it — the other **two of Somnia's four core
> innovations**, **IceDB** and **Advanced compression** in [`GLOSSARY.md`](../GLOSSARY.md), completing the four-innovations
> glossary cluster. Both still sat on the un-dated **2026-05-20** capture even though their dedicated litepaper pages were
> re-verified at the *article* level (IceDB 2026-05-22; Advanced-compression woven 2026-05-22) — the same labelling lag
> the first seven glossary passes closed. Following the folder's discipline (**re-fetch live + confirm the specific quoted
> value, never bulk-copy a date**), all three source pages were re-fetched live under the **sharpened soft-404 rule**
> (real body, not just HTTP `200`) and **render real content; every glossary-quoted value is un-drifted verbatim:** the
> [IceDB page](https://docs.somnia.network/concepts/somnia-blockchain/somnias-icedb.md) (*"built from the ground up to
> have fully deterministic performance"*, the per-op *"performance report"*, *"charge the user based on the actual load
> they put on the system"*, *"average read/writes of IceDB to be between 15-100 nanoseconds"*); the
> [advanced-compression page](https://docs.somnia.network/concepts/somnia-blockchain/advanced-compression-techniques.md)
> (*"the sender and receiver both share an identical history of the data"*, *"unlocks the ability for streaming
> compression"*, *"effectively achieving a constant size for any number of transaction signatures"*, and the *"encoded in
> 3.3 bits"* / *"48x compression ratio"* address example); and the
> [overview page](https://docs.somnia.network/concepts/somnia-blockchain/overview.md), re-fetched to close the Advanced-
> compression entry's two *overview*-sourced sentences rather than leave it half-stamped (*"is designed to enable streaming
> compression in order to maximise data throughput"* + *"combines this with BLS signature aggregation in order to achieve
> extremely high compression ratios…"* — both verbatim, incl. the British *"maximise"*). Both entries received inline
> `re-verified live 2026-05-23` stamps naming the confirmed quotes. **A clean re-verification — no paraphrase-passing-as-
> verbatim to correct** (unlike the seventh pass's MultiStream mis-attribution), mirroring the worked-example case-study
> and architecture-overview passes. Two honest glosses were *explicitly labelled as glosses, not quotes* in the IceDB
> stamp: "LSM-tree" is the standard expansion of upstream's *"log structured merge tree"*, and the entry's "native …
> snapshotting" is upstream's Merkle-tree-free *"first class state snapshots"* form; the Advanced-compression entry's
> bracket-edited *"unlock[]"* was confirmed against verbatim *"unlocks"* (a marked plural-subject edit, honest). The
> `⚠️ no blanket compression ratio` caveat was re-confirmed: the dedicated page publishes only the illustrative 48x
> *address-encoding* example, and "extremely high" is the **overview's** wording — both un-drifted. ⚠️ **Honest scope
> note:** only IceDB + Advanced compression were re-fetched/stamped this run; the sibling consensus/execution entries
> (**Cuthbert** → [security](https://docs.somnia.network/concepts/somnia-blockchain/security.md); **Layer 1** → overview)
> and the tokenomics + account-abstraction glossary clusters cite pages not re-fetched this run — left unstamped rather
> than dated on the strength of a sibling page, the natural next glossary slices. No new glossary term (precision/stamps
> on already-defined concepts — concept-keyed convention held); no new flags; none of the three pages names a chain ID or
> RPC URL; PHI boundary unaffected (background consensus/execution articles, no data flow). The residual research gaps
> (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY native base-agents cluster re-verified — the ninth glossary drift-check; a seed/temperature gloss demoted from quote-class to background (2026-05-23).**
> The eighth pass finished the four-innovations glossary cluster and named "the tokenomics + account-abstraction glossary
> clusters" among the next slices, but the tightest still-untouched coherent slice was the **native base-agents** cluster:
> five [`GLOSSARY.md`](../GLOSSARY.md) entries grounded in **exactly three** upstream pages, all still on the un-dated
> **2026-05-20** capture — **Determinism**, **`inferString`/`inferNumber`/`inferChat`/`inferToolsChat`**, the
> **`inferToolsChat` tool call** entry, **JSON API Request**, and **LLM Parse Website**. Following the folder's discipline
> (**re-fetch live + confirm the specific quoted value, never bulk-copy a date**), all three pages were re-fetched live
> under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real content; every glossary-quoted
> value is un-drifted verbatim:** [LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference.md) (the
> four `infer*` definitions; `finishReason` `stop` → "`response` contains the final text"; `tool_calls` →
> "`pendingToolCalls[i]` is calldata (4-byte function selector + ABI-encoded arguments)"),
> [JSON API Request](https://docs.somnia.network/agents/base-agents/json-api-request.md) ("Fetches JSON data from any
> public API endpoint and extracts specific values using a selector path"; "the fundamental building block for creating
> on-chain oracles"; all six fetcher names; the `data.price` selector; "value is multiplied by 10^decimals"), and
> [LLM Parse Website](https://docs.somnia.network/agents/base-agents/llm-parse-website.md) ("search a domain (or directly
> scrape a URL) and extract structured data using AI"; "a real web browser"; "on-chain callers that need trustless,
> auditable web extraction"; `ExtractString`→`string` / `ExtractANumber`→`uint256`; "negative values are clamped to 0";
> "These fields are not returned in the ABI output, but they are included in the receipt for auditability"). All five
> entries received an inline `re-verified live 2026-05-23` stamp. **One substantive correction** (the recent runs'
> quote-fidelity discipline — same class as the seventh pass's MultiStream mis-attribution, but here a *mechanism* claim
> rather than a misquote): the **Determinism** entry asserted, in its own prose, that determinism is achieved "by fixing
> the random seed and temperature" — but the LLM Inference page documents only *that* the models "run deterministically
> across all validating nodes," **never** the seed/temperature mechanism. The entry was rewritten to quote upstream's
> verbatim determinism→consensus sentence and to **explicitly label** the seed/temperature mechanism as general-ML
> background, not an upstream-published detail (it was never quote-marked, but it read as sourced fact beside a doc
> citation). Two faithful-rendering notes recorded inline, not corrected: the JSON-API quote folds upstream's two
> sentences with a `…` elision (dropping "This agent is"), and the LLM-Parse entry's "`resolveUrl = false`… scrapes the
> URL directly" renders upstream's "Search domain vs. scrape direct URLs" toggle (whose off side is "if resolveUrl is
> off, value is capped at 1"). ⚠️ **Honest scope note:** only these five base-agents entries were re-fetched/stamped; the
> sibling agents-economics entries (**Consensus**, **Subcommittee**, **Deposit-and-rebate**) were already stamped
> 2026-05-23 in earlier passes, and the **tokenomics** (dPoS, Staking, Storage rent, Governance, SOMI/STT) and
> **account-abstraction** (Account Abstraction, Bundler, Paymaster, Session key, `sponsorGas`, EIP-7702) clusters cite
> pages not re-fetched this run — left unstamped rather than dated on a sibling page, the natural next glossary slices. No
> new glossary term (precision/stamps on already-defined concepts — concept-keyed convention held); no new flags; none of
> the three pages names a chain ID or RPC URL; PHI boundary reaffirmed (a public-API/website fetch and an LLM verdict must
> stay PHI-free — public data only, the no-PHI rule reaching into prompts and [receipts](../GLOSSARY.md#r)). The residual
> research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps,
> not stale links.
>
> ✅ **GLOSSARY core token-model trio re-verified — the tenth glossary drift-check; a fees-vs-treasury gloss promoted to upstream verbatim (2026-05-23).**
> The ninth pass named "the **tokenomics** (dPoS, Staking, Storage rent, Governance, SOMI/STT) and **account-abstraction**
> glossary clusters" as the next slices; this run takes the tightest, most coherent slice of the tokenomics cluster — the
> three **core token-model** entries in [`GLOSSARY.md`](../GLOSSARY.md), **dPoS (delegated proof of stake)**, **Staking /
> delegation**, and **SOMI / STT**, grounded between **exactly three** upstream pages. Their source pages were re-verified
> at the *article* level on 2026-05-23 (the "Core tokenomics pages re-verified" run), but the glossary entries still sat on
> the un-dated **2026-05-20** capture — the same labelling lag the first nine glossary passes closed. Following the folder's
> discipline (**re-fetch live + confirm the specific quoted value, never bulk-copy a date**), all three pages were
> re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real content; every
> glossary-quoted value is un-drifted verbatim:** the [tokenomics overview](https://docs.somnia.network/concepts/tokenomics/overview.md)
> ("SOMI is a delegated proof of stake token (dPoS)", "fixed supply of 1,000,000,000 tokens", "Tokens can be delegated to
> Node Providers to cover their staking costs"); the [staking & delegation](https://docs.somnia.network/concepts/tokenomics/token-staking-and-delegation.md)
> page ("50% of all gas fees are distributed to validators as rewards", `epoch rewards * delegation rate * staking ratio`,
> the 28-day lock, the 50% emergency-unstake penalty, "no locking period"); and the
> [SOMI coin](https://docs.somnia.network/developer/network-info/somi-coin.md) page (the full `Somi`=`1e18` →
> `milliSomi`/`microSomi`/`nanoSomi`=`1e9` → `Wei`=`1` denomination ladder with `gWei` as nanoSomi's synonym, and "SOMI is
> the native coin of the Somnia Network"). All three entries received an inline `re-verified live 2026-05-23` stamp naming
> the confirmed quotes. **One precision improvement** (the recent runs' paraphrase-to-verbatim discipline — same class as
> the 32-SOMI / events-quote / Data-ID / `msg.sender` / reward-source tightenings, and mirroring exactly what the
> 2026-05-23 tokenomics-article pass did to [`tokenomics-and-gas.md`](tokenomics-and-gas.md)): the **Staking
> / delegation** entry's funding-source gloss "from fees, not new emission" had dropped upstream's verbatim "They will be
> rewarded from gas fees **and treasury-based incentives**" — folded in, closing a glossary-vs-article quote lag. **Two
> honest scope notes recorded inline, not asserted:** (a) the "to treasury" detail formerly appended to the 50%
> emergency-unstake penalty was **not** surfaced verbatim on this fetch, so it was demoted to a bare "50% emergency-unstake
> penalty" rather than left as an unconfirmed claim; and (b) the SOMI-coin page documents **only SOMI** and names **no STT**
> — so the entry's STT (testnet-token) facet is sourced from the [network-info](https://docs.somnia.network/developer/network-info.md)
> connection table, not the SOMI-coin page (noted in the entry). ⚠️ **Honest scope note:** only these three entries were
> re-fetched/stamped; the remaining tokenomics glossary entries (**Gas** → the separate gas-differences + JSON-RPC pages,
> re-verified 2026-05-23; **Storage rent** → gas-fees page, re-fetched 2026-05-22; **Governance** → tokens-governance page)
> and the **account-abstraction** cluster (Account Abstraction, Bundler, Paymaster, Session key, `sponsorGas`, EIP-7702)
> cite pages not re-fetched this run — left unstamped rather than dated on the strength of a sibling page, the natural next
> glossary slices. The dPoS entry's burn quotes ("50% of all fees are burnt…") cite the separate gas-fees page
> (re-verified 2026-05-22), not re-fetched this run — noted in the entry. No new glossary term (precision/stamps on
> already-defined concepts — concept-keyed convention held); no new flags; none of the three pages names a chain ID or RPC
> URL; PHI boundary unaffected (tokenomics meters deposits/gas/stake, never clinical text). The residual research gaps
> (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY account-abstraction overview slice re-verified — the eleventh glossary drift-check; a session-key misquote passing as verbatim corrected (2026-05-23).**
> The tenth pass named "the **account-abstraction** cluster (Account Abstraction, Bundler, Paymaster, Session key,
> `sponsorGas`, EIP-7702)" as a next slice; this run takes its tightest, most coherent sub-slice — the four
> [`GLOSSARY.md`](../GLOSSARY.md) entries whose **definitional Somnia quote** is grounded in **one** page, the
> [AA overview](https://docs.somnia.network/developer/building-dapps/account-abstraction.md): **Account Abstraction**,
> **Paymaster**, **Session key**, and **UserOperation**. All four still sat on the un-dated **2026-05-20** capture even
> though the AA *article* cluster was re-verified 2026-05-23 — the same labelling lag the first ten glossary passes
> closed. Following the folder's discipline (**re-fetch live + confirm the specific quoted value, never bulk-copy a
> date**), the page was re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`; a real AA
> page, not a GitBook soft-404) and **three of the four quotes are un-drifted verbatim:** the capability bullet
> *"Implement user operations via ERC-4337-style flows"* (grounding both the *Account Abstraction* and *UserOperation*
> entries' `"ERC-4337-style flows"` fragment), the bullet *"Enable sponsored and gasless transactions"* (the *Paymaster*
> entry's `"gasless transactions"`), and the **Thirdweb + Privy** tooling naming. **One genuine misquote corrected** (the
> recent runs' paraphrase-to-verbatim discipline — same class as the 32-SOMI / events-quote / compilation-quote /
> provenance / Data-ID / `msg.sender` / reward-source tightenings): the **Session key** entry quoted session keys as an AA
> feature *"for improved user experience"* **inside quote marks**, but **two** independent live fetches confirm that
> literal string is **absent** — upstream's wording is *"for better UX"*, in the sentence *"…using modern tooling like
> **Thirdweb** and **Privy**, and learn how to enable **gasless transactions** and **session keys** for better UX."* (A
> WebFetch summarizer is far likelier to *expand* "UX"→"user experience" than the reverse, so the original phrasing read
> as a summarizer artifact mistaken for a quote; the second transcription-focused fetch confirmed the literal characters
> before the correction, exactly as the soft-404 rule demands for fine wording.) The entry was corrected to the verbatim
> *"for better UX"* and the misquote recorded inline. Each of the four entries received an inline `re-verified live
> 2026-05-23` stamp naming its confirmed quote. Notably, this one upstream sentence corroborates **four** entries at once
> — the tooling names, the gasless quote, and session keys — making it the tightest possible coherent slice. ⚠️ **Honest
> scope note:** only the AA-overview-sourced halves were re-fetched/stamped; the *Paymaster* entry's Thirdweb-tutorial +
> Pimlico halves, and the sibling **Bundler**, **`sponsorGas`**, **EIP-7702**, and **EntryPoint** entries, cite *other*
> pages (the gasless-Thirdweb tutorial, the ecosystem-AA + Pimlico pages, the gas-differences page) — re-verified at the
> article level on 2026-05-22/23 but **not** re-fetched this run — left unstamped rather than dated on the strength of a
> sibling page, the natural next glossary slice. No new glossary term (precision/stamps + one correction on already-defined
> concepts — concept-keyed convention held); no new flags; the page names **no** chain ID, contract address, or RPC URL
> (the AA addresses live in the network-info-sourced half of the *Account Abstraction* entry, untouched this run); PHI
> boundary unaffected (AA touches signing + gas, never payload). The residual research gaps (millisecond TTF, sustained
> TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY account-abstraction integration cluster re-verified — the twelfth glossary drift-check; v0.8-unsupported precision folded in, a clean re-verification (2026-05-23).**
> The eleventh pass re-verified the four **AA-overview-sourced** glossary entries and named "the *Paymaster* entry's
> Thirdweb-tutorial + Pimlico halves, and the sibling **Bundler**, **`sponsorGas`**, **EIP-7702**, and **EntryPoint**
> entries [which] cite *other* pages (the gasless-Thirdweb tutorial, the ecosystem-AA + Pimlico pages, the gas-differences
> page) … the natural next glossary slice." This **twelfth** pass closes exactly that slice — the *integration*-sourced AA
> glossary entries, which still carried **2026-05-21/22** dates (the AA *article* integration cluster was re-verified
> 2026-05-23, but these glossary entries were not — the same labelling lag the first eleven glossary passes closed).
> Following the folder's discipline (**re-fetch live + confirm the specific quoted value, never bulk-copy a date**), all
> four source pages were re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and
> **render real content; every glossary-quoted value is un-drifted verbatim:** the
> [gasless-with-Thirdweb tutorial](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md)
> at its **truncated canonical slug** (heading *"Gasless Transactions with Thirdweb"*; `sponsorGas: true` in **both** the
> `accountAbstraction: SmartWalletOptions` and `inAppWallet({ smartAccount })` configs; `FACTORY_ADDRESS`
> `0x4be0ddfebca9a5a4a617dee4dece99e7c862dceb`; the `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` prerequisite; **no** bundler/paymaster
> endpoint URL — confirming the "bundler implicit in the SDK" framing), the
> [ecosystem: account-abstraction](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/account-abstraction.md)
> page (Pimlico *"the world's most advanced ERC-4337 account abstraction infrastructure platform"*; outbound to the
> Pimlico tutorial), Pimlico's [supported-chains list](https://docs.pimlico.io/guides/supported-chains) (Somnia Mainnet
> `5031`/`somnia`, Testnet `50312`/`somnia-testnet`), and the
> [gas-differences page](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md)
> (EIP-7702 *"1,570,000 gas per authorisation in a Set Code transaction. 400,000 gas is refunded if account creation isn't
> required."*). The **Bundler**, **Paymaster** (Thirdweb + Pimlico halves), **`sponsorGas`**, **EIP-7702**, and
> **EntryPoint** entries each received an inline `re-verified live 2026-05-23` stamp naming the confirmed values.
> **One precision folded in** (a sharpening, not a correction — like the eighth/architecture-overview clean passes, there
> was no paraphrase-passing-as-verbatim to fix): the Pimlico page marks **EntryPoint v0.8 *unsupported*** on both Somnia
> networks, which the Bundler/Paymaster entries said "v0.6/v0.7" without capturing — added as "(v0.8 unsupported)" so an
> implementer reaching for the newest EntryPoint sees the documented ceiling. The terse **EntryPoint** entry (a one-line
> cross-ref until now) was also enriched with the testnet `v0.7` address from network-info plus the Pimlico v0.6/v0.7-yes /
> v0.8-no support matrix — promoting it from a bare pointer to a stamped, sourced entry. ⚠️ **Honest scope note:** the
> two Pimlico pages remain **off-domain** (`docs.pimlico.io`), cited only because the Somnia ecosystem-AA page links out to
> Pimlico — the `docs.somnia.network` pages themselves still publish no Pimlico endpoint; and the truncated
> `…-with-thirdw.md` Thirdweb slug stays canonical (the intuitive full `…-with-thirdweb.md` is still a GitBook soft-404). No
> new glossary term (precision/stamps on already-defined concepts — concept-keyed convention held); no new flags; PHI
> boundary unaffected (AA touches signing + gas, never payload). With this, **every account-abstraction glossary entry is
> re-verified on 2026-05-23**; the natural next glossary slices are the remaining tokenomics entries (**Gas**, **Storage
> rent**, **Governance**) and the consensus siblings (**Cuthbert**, **Layer 1**), still on earlier dates. The residual
> research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps,
> not stale links.
>
> ✅ **GLOSSARY indexing / subgraph read-path cluster re-verified — the thirteenth glossary drift-check; a clean re-verification (2026-05-23).**
> Of the slices the twelfth pass flagged, **Gas** already carried a 2026-05-23 stamp, so this pass instead took the
> **indexing / subgraph read-path cluster** — the five entries behind the audit-timeline read path (**GraphQL**,
> **Polling (vs. subscription)**, **Ormi**, **Subgraph**, and the read-path half of **Blockscout**), a *fully* un-swept,
> tightly-coupled cluster still dated **2026-05-21/22**. Following the folder's discipline (**re-fetch live + confirm the
> specific quoted value, never bulk-copy a date**), all five upstream source pages were re-fetched live under the
> **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real content; every glossary-quoted value is
> un-drifted verbatim:** the
> [Ormi subgraph guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph.md)
> (*"Once deployed, Ormi will return a GraphQL endpoint where you can begin querying your subgraph."*; `@graphprotocol/graph-cli`;
> `graph deploy mytoken --node https://api.subgraph.somnia.network/deploy --ipfs https://api.subgraph.somnia.network/ipfs`),
> the [ecosystem: subgraphs](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/subgraphs.md)
> page (the *"only unified Web3 data layer…"* tagline, the `subgraph.somnia.network` URL, the **Ormi + Protofire** roster),
> the [Apollo Client subgraph-UI guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-apollo-client.md)
> (`pollInterval: 5000, // Refresh every 5 seconds`; the `ApolloClient`/`gql`/`useQuery` imports; the
> `proxy.somnia.chain.love/subgraphs/name/somnia-testnet/SomFlip` host), the
> [Next.js fetch guide](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/building-subgraph-uis-nextjs-fetch.md)
> (the `{ query }` body, the `app/api/proxy/route.ts` `Client-ID` proxy, and — confirming the *no-poll* path — a
> `useEffect()` with an **empty dependency array**, i.e. mount-only), and the
> [explorer API, health & monitoring](https://docs.somnia.network/developer/deployment-and-production/explorer-api-health-and-monitoring.md)
> page (*"Somnia Network uses Blockscout as its blockchain explorer infrastructure"*; the testnet/mainnet `/api` base
> table; `GET /v2/addresses/{address}/transactions`; the four interfaces **REST API / RPC API / ETH RPC API / GraphQL**).
> The **GraphQL**, **Polling**, **Ormi**, **Subgraph**, and **Blockscout** (read-path half) entries each received an
> inline `re-verified live 2026-05-23` stamp naming the confirmed values; the Blockscout entry's *verification* half (the
> `forge verify-contract --verifier blockscout` flags) and the network-info-sourced Exploreme/SocialScan endpoints were
> **not** re-fetched this run and keep their existing dates. **Clean re-verification — no paraphrase-passing-as-verbatim
> to correct** (like the eighth/twelfth passes); the one enrichment folded in was the four-interfaces naming on the
> Blockscout entry. **The thirteenth glossary drift-check reaffirms the no-PHI boundary:** every read-path here surfaces
> only hash/address/amount calldata + decoded logs — the audit UI reads provenance, never payload. No new glossary term
> (concept-keyed convention held); no new flags; no chain-ID conflict; no stale `dream-rpc` RPC on any of the five pages.
> The natural next glossary slices remain the consensus siblings (**Cuthbert**, **Layer 1**) and the smart-contract-dev
> security/toolchain entries (**CEI**, **Pull payment**, **Reentrancy guard**, **Slither**, **Foundry**, **Hardhat**),
> still on earlier dates. The residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas
> floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY consensus-siblings pair re-verified — the fourteenth glossary drift-check; a Cuthbert misquote tightened and a Layer-1 mis-citation corrected (2026-05-23).**
> The thirteenth pass named "the consensus siblings (**Cuthbert**, **Layer 1**)" as the next glossary slice; this run
> takes exactly that pair — the last two consensus/execution [`GLOSSARY.md`](../GLOSSARY.md) entries still on the un-dated
> **2026-05-20** capture (the four-innovations cluster was finished on the eighth pass; these two siblings cite the
> *security* and *overview* litepaper pages, re-verified at the *article* level on 2026-05-22/23 but never stamped in the
> glossary — the same labelling lag the first thirteen glossary passes closed). Following the folder's discipline
> (**re-fetch live + confirm the specific quoted value, never bulk-copy a date**), both source pages were re-fetched live
> under the **sharpened soft-404 rule** (real body, not just HTTP `200`) — the
> [security page](https://docs.somnia.network/concepts/somnia-blockchain/security.md) renders the Cuthbert/validator/slashing
> content and the [overview page](https://docs.somnia.network/concepts/somnia-blockchain/overview.md) renders the four
> innovation sections; neither is a GitBook soft-404. **Two findings, one per entry:** (1) **Cuthbert** — a *paraphrase
> passing as verbatim* (the recent runs' fidelity discipline — same class as the 32-SOMI / events-quote /
> compilation-quote / MultiStream-mis-attribution tightenings): the entry quoted `"run all transactions through both…"`,
> but a live re-fetch shows upstream reads *"Somnia validators automatically run **every transaction** through both
> **Somnia and Cuthbert**, and **they will** stop voting or executing if they ever detect a divergence between the two."* —
> so the entry both misquoted "every transaction"→"all transactions" (and dropped the named pair "Somnia and Cuthbert")
> and silently dropped "they will." Corrected to upstream verbatim, plus the definition (*"a separate implementation of
> Somnia's execution and database, using third party libraries wherever possible"*) and phase-out (*"Cuthbert will
> eventually be phased out of Somnia as the system becomes more mature"*) folded in as confirmed quotes; entry stamped
> `re-verified live 2026-05-23`. (2) **Layer 1** — a genuine **mis-citation**, not a misquote: the entry asserted "Somnia
> is an L1" attributed to the *overview* page, but **two independent live fetches confirm the overview page never uses the
> literal phrase "Layer 1" or "L1"** — it frames Somnia only as *"the Somnia blockchain"* against *"other EVM chains."* A
> tiebreaker fetch of [get-started-for-mainnet](https://docs.somnia.network/get-started/getting-started-for-mainnet.md)
> likewise carries **no** "L1" label (it is onboarding steps, no architecture classification). The entry was corrected to
> present "Layer 1" as the **standard classification** for Somnia's standalone-EVM-base-chain architecture (an authorial
> term, true by the entry's own definition) rather than an upstream-published label on the cited page, with the README's
> *"EVM-compatible Layer 1"* framing flagged as this folder's own wording — directly applying the no-invented-claims rule
> at the citation level (the *claim* is true; the *citation* was the bug). ⚠️ **Honest scope note:** the negative is scoped
> to the two pages re-fetched — "the overview page does not use 'L1'," **not** a blanket "no `docs.somnia.network` page
> ever does"; if a future run finds a page that literally calls Somnia a Layer 1, re-point the citation there. With this,
> **every consensus/execution glossary entry is re-verified on 2026-05-23**; the next glossary slice is the
> smart-contract-dev security/toolchain entries (**CEI**, **Pull payment**, **Reentrancy guard**, **Slither**, **Foundry**,
> **Hardhat**), still on earlier dates. No new glossary term (precision/stamps + two corrections on already-defined
> concepts — concept-keyed convention held); no new flags; neither page names a chain ID or RPC URL; PHI boundary
> unaffected (background consensus/execution + classification entries, no data flow). The residual research gaps
> (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY smart-contract-dev security/toolchain cluster re-verified — the fifteenth glossary drift-check; a Foundry mis-citation and a Hardhat fine-wording imprecision corrected (2026-05-23).**
> The fourteenth pass named "the smart-contract-dev security/toolchain entries (**CEI**, **Pull payment**, **Reentrancy
> guard**, **Slither**, **Foundry**, **Hardhat**)" as the next slice; this run takes exactly those six [`GLOSSARY.md`](../GLOSSARY.md)
> entries, grounded between **four** upstream pages, all still on earlier (2026-05-20/21) dates. Following the folder's
> discipline (**re-fetch live + confirm the specific quoted value, never bulk-copy a date**), all four pages were
> re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **all render real content.**
> **Four clean re-verifications, every quote un-drifted verbatim:** the
> [audit checklist](https://docs.somnia.network/developer/security/audit-checklist.md) (CEI — *"All functions that send
> Ether or tokens to external addresses must follow the Checks-Effects-Interactions pattern."*; Slither/Mythril/Solhint
> mandatory, High/Critical *"cannot proceed until these are resolved and the tools run clean,"* Medium/Low *"Fixed"* or
> *"Justified"* in an *"Audit Waivers"* log) and the
> [security 101](https://docs.somnia.network/developer/security/smart-contract-security-101.md) page (Pull payment —
> *"Pull Payment: Users withdraw instead of push"*; Reentrancy guard — *"OpenZeppelin ReentrancyGuard: Battle-tested
> implementation"* with *"Double protection: both CEI and guard prevent recursive drains"*). Each of those four entries
> received an inline `re-verified live 2026-05-23` stamp naming its confirmed quote. **Two genuine corrections** (not
> misquotes of fine wording but **citation bugs** — the same class as the fourteenth pass's Layer-1 mis-citation, where
> the *claim* is true but the *citation* was wrong): (1) **Foundry** — the entry's parenthetical attributed `forge
> verify-contract` "to verify" to the [Foundry deploy page](https://docs.somnia.network/developer/development-frameworks/deploy-with-foundry.md),
> but a live fetch confirms that page documents **only** `forge init`/`forge build`/`forge create` (verbatim `forge create
> --rpc-url https://dream-rpc.somnia.network --private-key PRIVATE_KEY src/BallotVoting.sol:BallotVoting`) — `forge
> verify-contract` is **absent**; verification lives on the separate verify guide (the *Blockscout* entry's `--verifier
> blockscout` flags), so the "verify" leg was reframed as general Foundry knowledge, not a claim of this page. (2)
> **Hardhat** — the entry said it "verifies with the `@nomicfoundation/hardhat-verify` plugin," but a **second,
> transcription-focused live fetch** (the folder's fine-wording discipline) confirms the config's literal import is
> `import "@nomicfoundation/hardhat-toolbox";` — the toolbox **bundles** Hardhat Verify, and upstream's prose names only
> "the Hardhat Verify plugin"; the standalone `@nomicfoundation/hardhat-verify` package is **not** imported on the page.
> Corrected to upstream's wording plus the literal verify command (`npx hardhat verify --network somnia
> DEPLOYED_CONTRACT_ADDRESS …`) and the Ignition deploy path (`./ignition/modules/deploy.ts`). The Hardhat page's
> `customChains` `chainId: 50312` / `apiURL: shannon-explorer.somnia.network/api` is un-drifted (a standing chain-ID
> corroborator). ⚠️ The stale `dream-rpc.somnia.network` testnet RPC is **re-confirmed** on both deploy pages — already
> flagged folder-wide (the Foundry page's `forge create` `dream-rpc` was recorded in
> [`smart-contract-dev.md`](smart-contract-dev.md), and this is not a *new* sighting — the per-doc
> sighting counters already diverge, so no fresh number is asserted); precedence rule reaffirmed (use the canonical
> `api.infra.testnet` endpoint); both noted inline. No new glossary term
> (precision/stamps + two citation corrections on already-defined concepts — concept-keyed convention held); no new
> flags; the audit-checklist and security-101 pages name no chain ID or RPC URL; PHI boundary unaffected (security
> patterns + build tooling, no data flow). With this, **every smart-contract-dev security/toolchain glossary entry is
> re-verified on 2026-05-23**; the natural next glossary slices are the remaining tokenomics entries (**Storage rent**,
> **Governance**) and the data-streams cluster (**Data ID**, **Schema ID**, **SchemaEncoder**, **Publisher proxy**),
> still on earlier dates. The residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas
> floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY remaining-tokenomics pair re-verified — the sixteenth glossary drift-check; a Governance phase-control gloss made honest and a Storage-rent gloss promoted to upstream verbatim (2026-05-23).**
> The fifteenth pass named "the remaining tokenomics entries (**Storage rent**, **Governance**)" as a next slice; this run
> takes exactly that pair — the last two tokenomics [`GLOSSARY.md`](../GLOSSARY.md) entries still on pre-2026-05-23 dates
> (**Governance** carried **no** date stamp at all — the original un-dated 2026-05-20 capture; **Storage rent** was marked
> "re-fetched 2026-05-22" but never glossary-stamped 2026-05-23, even though the tokenomics *article* was swept that day —
> the same labelling lag the first fifteen glossary passes closed). Following the folder's discipline (**re-fetch live +
> confirm the specific quoted value, never bulk-copy a date**), both source pages were re-fetched live under the
> **sharpened soft-404 rule** (real body, not just HTTP `200`) and **render real content; every glossary-quoted value is
> un-drifted verbatim:** the [tokens governance](https://docs.somnia.network/concepts/tokenomics/tokens-governance.md) page
> (*"Proposals can be created by any token owner. They are then approved by a majority vote of other token holders."*; *"still
> in it's early phases"* with the `it's` quirk; the five governance bodies; the three phases — **Bootstrap** `0–6 months
> post-mainnet` / **Transition** `6–24 months` / **Mature** `Year 2 onward`) and the
> [tokenomics gas-fees](https://docs.somnia.network/concepts/tokenomics/gas-fees.md) page (all five `SSTORE` retention
> tiers `20,000`/`40,000`/`60,000`/`80,000`/`200,000` for 1 hour/1 day/1 month/1 year/`Indefinite`). Both entries received
> an inline `re-verified live 2026-05-23` stamp naming the confirmed values. **Two precision improvements** (the recent
> runs' fidelity discipline — same class as the 32-SOMI / events-quote / Layer-1-mis-citation / reward-source tightenings):
> (1) **Governance** — the entry said the *foundation board keeps ultimate control* "through the **Transition** phase," but
> a live re-fetch shows upstream attaches *"Foundation board in control"* to the **Bootstrap** row (`0–6 months`); the
> *Transition* row (`6–24 months`) actually reads *"Introduction of all governance groups. Beginning of proposal process,"*
> with control only delegated in **Mature**. The board-control-until-Mature reading is sound but is an **authorial synthesis
> of the per-phase labels, not a single-phase quote** — so all three phase labels were folded in verbatim and the synthesis
> framed honestly (the *claim* is true; the phase it was pinned to was wrong — same shape as the fourteenth pass's Layer-1
> mis-citation). (2) **Storage rent** — the *"permanence is the `10×` ceiling"* authorial gloss has an upstream verbatim
> form, *"Tiered Pricing: Costs scale with duration (e.g., 90% discount for 1-hour storage, no discount for indefinite
> storage),"* now folded in (kept distinct from the *separate* throughput-driven 90% gas-price discount captured earlier —
> two different "90%"s; this one is the 1-hour-vs-`Indefinite` storage tier, `20,000` being 10% of `200,000`). With this,
> **every tokenomics glossary entry is re-verified on 2026-05-23** (dPoS/Staking/SOMI on the tenth pass; Gas/Storage rent;
> Governance now). The natural next glossary slice is the data-streams cluster (**Data ID**, **Schema ID**, **SchemaEncoder**,
> **Publisher proxy**) the fifteenth pass flagged as "still on earlier dates" — worth a date-label audit, since the second/
> fourth/sixth passes appear to have already stamped them 2026-05-23 (a possible labelling lag in the *flag*, not the
> entries). No new glossary term (precision/stamps + one honest reframing on already-defined concepts — concept-keyed
> convention held); no new flags; the governance page names no chain ID or RPC URL, the gas-fees page none either; PHI
> boundary unaffected (governance is off the agent loop, storage pricing meters hashes/state/amounts, never clinical text).
> The residual research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged —
> upstream gaps, not stale links.
>
> ✅ **GLOSSARY network-info address pair re-verified — the seventeenth glossary drift-check; the data-streams "next slice" confirmed a labelling-lag false alarm, and the genuinely stalest in-scope pair (CreateX, Multicall3) carried forward to 2026-05-23 (2026-05-23).**
> The sixteenth pass flagged the data-streams cluster (**Data ID**, **Schema ID**, **SchemaEncoder**, **Publisher
> proxy**) as a next slice "worth a date-label audit." This run did that audit first: **all four are already stamped
> `re-verified live 2026-05-23`** (Data ID line 197, Schema ID line 795, SchemaEncoder line 820, Publisher-proxy line
> 633) — confirming the prior pass's own suspicion that the *flag* lagged, not the entries. No edit needed there. A
> folder-wide staleness sweep then found the genuinely stalest **in-scope** (`docs.somnia.network`-cited) glossary pair:
> **Deterministic deployment (CreateX/CREATE2)** and **Multicall3**, both quoting verbatim contract addresses from the
> *same* canonical [network-info](https://docs.somnia.network/developer/network-info.md) page and both last stamped
> **2026-05-22**, never carried to 2026-05-23 — the same labelling lag the first sixteen glossary passes closed. Following
> the folder's discipline (**re-fetch live + confirm the specific quoted value, never bulk-copy a date**), the network-info
> page was re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **renders real
> content. Clean re-verification — all four addresses un-drifted verbatim:** CreateX mainnet
> `0xD13C575ED5378fd18B100Bd87D5765d9A747358B` / testnet `0x535822d4b86b2372FBE4fd9d1468318F04A2A640`; Multicall3 mainnet
> `0x5e44F178E8cF9B2F5409B6f18ce936aB817C5a11` / testnet (Shannon) `0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223`. The same
> page re-corroborates testnet **chain ID `50312`** (mainnet `5031`) and the canonical **`api.infra.testnet.somnia.network`**
> RPC — both standing corroborators for the `50311`-vs-`50312` reconciliation and the precedence-over-`dream-rpc` rule;
> the EntryPoint v0.7 (`0x0000000071727De22E5E9d8BAf0edAc6f37da032`) and factory (`0x4bE0ddfebcA9A5A4a617dee4DeCe99E7c862dceb`)
> testnet-only listings are likewise un-drifted. Both entries stamped `re-verified live 2026-05-23` with their confirmed
> addresses inline. No new glossary term (stamps + address re-confirmation on already-defined concepts — concept-keyed
> convention held); no new flags; PHI boundary unaffected (deterministic-address and batched-read tooling meters no data
> flow — CreateX lets agents agree on `ClaimSettlement.sol`'s address pre-deploy, Multicall3 batches read calls). The
> natural next glossary slice is the remaining **account-abstraction** entries still on 2026-05-21/22 dates (the
> Thirdweb/Pimlico bundler+paymaster cluster, lines 107/119/123/575/578/580) — though several of those cite *external*
> docs (Pimlico's supported-chains list), not `docs.somnia.network`, so they fall outside the core source-of-truth
> directive and warrant a lighter touch. The residual research gaps (millisecond TTF, sustained TPS, block time, the
> nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY Finality entry re-verified — the eighteenth glossary drift-check; the account-abstraction "next slice" confirmed another labelling-lag false alarm, and the genuinely stalest *primary* stamp in the glossary (Finality, on 2026-05-21) carried forward to 2026-05-23 (2026-05-23).**
> The seventeenth pass flagged the account-abstraction cluster (**Bundler**, **Paymaster**) as a next slice "still on
> 2026-05-21/22 dates." This run audited that first: both entries **already carry `re-verified live 2026-05-23` stamps**
> (Bundler line 129's *"All three sources re-fetched and re-verified live 2026-05-23"*; Paymaster lines 575 + 587's
> *"re-verified live 2026-05-23"* / *"re-fetched and re-verified live 2026-05-23"*) — the cited line numbers
> (107/119/123/575/578/580) point at **source-capture** dates embedded in prose (*"the tutorial (2026-05-21) shows…"*,
> *"the ecosystem page (2026-05-22) names…"*), **not** verification stamps. Same labelling-lag false alarm the seventeenth
> pass found for data-streams — no edit needed there, and a reminder that several AA halves cite *external* docs
> (Pimlico's supported-chains list) outside the core source-of-truth directive anyway. A folder-wide staleness sweep of
> **primary** stamps then found the genuinely stalest in-scope entry: **Finality**, whose head quote was stamped
> *"verified live 2026-05-21"* — the oldest primary stamp in the file, and the home of the very quotes that feed the
> standing research gaps (TTF / TPS / block time). Following the folder's discipline (**re-fetch live + confirm the
> specific quoted value, never bulk-copy a date**), the developer
> [FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md) was
> re-fetched live under the **sharpened soft-404 rule** (real Q&A body, not just HTTP `200`) and **renders real content.
> Clean re-verification — all three quoted phrases un-drifted verbatim:** *"Sub-second transaction finality"*,
> *"1,000,000+ transactions per second"*, and the "Block Time" field reading only *"Optimized for real-time
> applications."* The re-fetch **also re-confirms the standing research gap**: no millisecond time-to-finality and no
> numeric block-time figure appears anywhere on the FAQ — so the entry's deferral to the sourced
> [`../../research/somnia/finality-tps-and-gas-model.md`](../../../research/somnia/finality-tps-and-gas-model.md) analysis
> stands. The entry was stamped `re-verified live 2026-05-23` with the confirmed values and an explicit "no numeric
> TTF/block-time" note inline. No new glossary term (a stamp + value re-confirmation on an already-defined concept —
> concept-keyed convention held); no new flags; the FAQ names no chain ID or RPC URL beyond the standing corroborators;
> PHI boundary unaffected (finality/throughput are substrate-performance facts, no data flow). The natural next glossary
> slice is a primary-stamp sweep of the remaining **reactivity** entries (the off-chain filtered-subscriptions cluster
> near lines 320–328) for any still on pre-2026-05-23 primary stamps. The residual research gaps (millisecond TTF,
> sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY Payable-function entry re-verified — the nineteenth glossary drift-check; the genuinely stalest *primary* stamp in the file (Payable / native value transfer, on 2026-05-22) carried forward to 2026-05-23 (2026-05-23).**
> The eighteenth pass suggested a primary-stamp sweep of the **reactivity** off-chain cluster as a next slice; a
> folder-wide staleness sweep this run found those reactivity entries already carry `re-verified live 2026-05-23` stamps,
> and the genuinely stalest **primary, not-yet-re-verified** entry was instead **Payable function / native value transfer
> (`payable`, `msg.value`, `receive()`)**, stamped only **2026-05-22** with no 2026-05-23 carry — the oldest clean primary
> stamp left after Finality. The near-neighbour that also showed 2026-05-21 (`sponsorGas`, the AA flag, line 873) already
> carries an inline *"Re-verified live 2026-05-23"* parenthetical — its bare date is a **source-capture** date in prose,
> not a verification stamp (the eighteenth pass's distinction held). Following the folder's discipline (**re-fetch live +
> confirm the specific quoted value, never bulk-copy a date**), the
> [using-native-SOMI/STT](https://docs.somnia.network/developer/building-dapps/tokens-and-nfts/using-native-somi-stt.md)
> page was re-fetched live under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and **renders real
> content. Clean re-verification — every quoted value un-drifted verbatim:** *"SOMI is the native coin of the Somnia
> Network, similar to ETH on Ethereum"* and *"No ERC20 functions are needed"*, with the page still rendering `msg.value`,
> `receive() external payable`, and `payable(owner).transfer(address(this).balance)` in its examples. The entry was stamped
> `re-verified live 2026-05-23` with the confirmed quotes inline. No new glossary term (a stamp + value re-confirmation on
> an already-defined concept — concept-keyed convention held); no new flags; the page names no chain ID or RPC URL; PHI
> boundary unaffected (the V1 note already records that Curie's settlement *release* path wraps these native-value
> primitives in the pull-payment + reentrancy-guard pattern, never the intro page's naive `.transfer()` push — and native
> value carries only settlement amounts, never clinical text). The natural next glossary slice is a primary-stamp sweep of
> the remaining **oracle** entries (the DIA/Protofire feed cluster near lines 540–560, Protofire still showing a *"verified
> 2026-05-22"* mention) for any still on pre-2026-05-23 primary stamps. The residual research gaps (millisecond TTF,
> sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **GLOSSARY Oracle entry re-verified — the twentieth glossary drift-check; the cluster's last pre-2026-05-23 primary stamp (the DIA/Protofire ecosystem listing, "verified 2026-05-22") carried forward, and a genuine ETH→WETH precision drift corrected (2026-05-23).**
> The nineteenth pass named the **oracle** cluster (DIA/Protofire near [`GLOSSARY.md`](../GLOSSARY.md) lines 540–560) as the
> next slice, with **Protofire still showing a "verified 2026-05-22" mention**. A staleness sweep of that cluster confirms
> it: **Ormi** (line 547) and **Oracle snapshotting** already carry 2026-05-23 stamps, but the **Oracle** entry's two-provider
> ecosystem-listing assertion was the last in-scope primary stamp still on **2026-05-22** — and it also anchors the **DIA
> push-cadence quotes** (`0.5 %` deviation / `120 s` / `24 h` heartbeat) that feed V1's SOMI↔USD settlement pricing.
> Following the folder's discipline (**re-fetch live + confirm the specific quoted value, never bulk-copy a date**), both
> source pages were re-fetched live under the **sharpened soft-404 rule** (real rendered body, not just HTTP `200`) and
> **render real content. Clean re-verification:** the
> [ecosystem oracles listing](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/oracles.md)
> still names **exactly DIA + Protofire** (no third provider), and the
> [DIA price-feeds](https://docs.somnia.network/developer/building-dapps/oracles/dia-price-feeds.md) page renders the
> *"continuously fetch and push asset prices on-chain"* `oracleUpdater` description with the **0.5 % / 120 s / 24 h**
> cadence **un-drifted verbatim**. **One genuine precision drift corrected** (the recent runs' fidelity discipline — same
> class as the Layer-1 / WETH-ticker / phase-label tightenings): the entry's illustrative feed list read *"BTC, ETH,
> USDC"*, but the live DIA roster lists the **wrapped `WETH`** token, not bare `ETH` (full roster: USDT/USDC/BTC/ARB/SOL/
> WETH/SOMI, all USD-denominated) — a correctness fact on an EVM chain, since `WETH` is a distinct ERC-20, not the native
> coin. The list was corrected to upstream and the stamp refreshed to `re-verified live 2026-05-23` with the confirmed
> cadence inline. No new glossary term (a stamp + value re-confirmation + one ticker correction on an already-defined
> concept — concept-keyed convention held); no new flags; both oracle pages name no chain ID or RPC URL; PHI boundary
> unaffected (a SOMI/USD price feed meters settlement amounts, never clinical text — and the V1 note's *oracle-snapshotting*
> path persists the price as a publisher-attested, PHI-free record). With this, **every oracle glossary entry is
> re-verified on 2026-05-23**. The natural next glossary slice is a primary-stamp sweep of the remaining **indexing /
> subgraph** entries (the Ormi/Protofire query-path cluster) for any still on pre-2026-05-23 primary stamps. The residual
> research gaps (millisecond TTF, sustained TPS, block time, the nanoSomi base-gas floor) are unchanged — upstream gaps,
> not stale links.
>
> ✅ **GLOSSARY off-chain Reactivity tutorial pair re-verified — the twenty-first glossary drift-check; the *Wildcard subscription* (newest stamp `2026-05-21`) and *Filtered subscription* (no recent primary stamp) entries advanced to a clean live 2026-05-23 re-verification (2026-05-23).**
> A staleness sweep after the twentieth (oracle) pass found the V1-central **off-chain [Reactivity](reactivity.md)
> tutorial cluster** carrying the oldest primary stamps left in [`GLOSSARY.md`](../GLOSSARY.md): **Wildcard subscription**'s
> newest stamp was `2026-05-21` and **Filtered subscription** carried no recent re-verification date at all. This matters
> because off-chain Reactivity is what *wakes the payer agent on only the proposals for one claim* — the demo loop's state
> machine. Both source pages were re-fetched live under the **sharpened soft-404 rule** (real rendered body, not just HTTP
> `200`) and **render real content. Clean re-verification, no drift:** the
> [wildcard tutorial](https://docs.somnia.network/developer/reactivity/tutorials/wildcard-off-chain-reactivity-tutorial.md)
> still uses `sdk.subscribe({...})` and renders *"the node pushes every new log it sees on the WebSocket connection"*,
> `new SDK({ public: publicClient })`, the `event.topics[0]`→`decodeEventLog` decode guard, and *"useful for quick testing
> and exploratory scripts. Production applications should usually add filters"* **un-drifted verbatim**; the
> [filtered-subscriptions tutorial](https://docs.somnia.network/developer/reactivity/tutorials/off-chain-reactivity-filtered-subscriptions-tutorial.md)
> still maps `eventContractSources`→`address` / `topicOverrides`→`topics`, confirms the **one-based** selector (*"The
> off-chain Reactivity context selector is one-based, so `topic3` appends `topics[2]` to the call data"*), and renders
> `toEventSelector('Transfer(address,address,uint256)')`, `onlyPushChanges`, and `sdk.watch({...})` un-drifted. Most
> important, the **`subscribe`-vs-`watch` split still holds**: the authoritative
> [off-chain reference](https://docs.somnia.network/developer/reactivity/reactivity-offchain.md) documents **only** `watch`,
> so the entries' standing guidance — *prefer `watch()` in code, treat `subscribe` as undocumented tutorial drift* — remains
> correct (re-confirmed live, not carried forward). No new glossary term (two stamp + value re-confirmations on
> already-defined concepts — concept-keyed convention held); no new flags; neither tutorial names a chain ID or RPC URL; PHI
> boundary unaffected (a wildcard firehose remains a flagged anti-pattern for agents — *"an agent must never receive every
> log on chain — wasted bandwidth and a PHI/scope hazard"* — and filtered topics must stay PHI-free). The natural next
> glossary slice is a primary-stamp sweep of the remaining **indexing / subgraph** entries (the Ormi/Protofire query-path
> cluster) for any still on pre-2026-05-23 primary stamps. The residual research gaps (millisecond TTF, sustained TPS, block
> time, the nanoSomi base-gas floor) are unchanged — upstream gaps, not stale links.
>
> ✅ **Settlement-critical DIA address re-confirmed on a fresh day (2026-05-24).** Deliberately scoped to the single
> highest-consequence fact in this folder — *a wrong address is a wrong settlement rate* — rather than another full
> sweep. Live re-fetch of the [DIA price-feeds page](https://docs.somnia.network/developer/building-dapps/oracles/dia-price-feeds.md)
> under the sharpened soft-404 rule renders real content and is **un-drifted verbatim**: mainnet oracle
> `0xbA0E0750A56e995506CA458b2BdD752754CF39C4`, testnet oracle `0x9206296Ea3aEE3E6bdC07F7AaeF14DfCf33d865D`, the
> seven supported keys (USDT/USDC/BTC/ARB/SOL/WETH/**SOMI**), and the 0.5 % / 120 s / 24 h cadence all match
> [`oracles-and-vrf.md`](oracles-and-vrf.md) exactly. No new term, no new flag; the page names no chain ID or RPC URL;
> PHI boundary intact (a SOMI/USD feed meters settlement amounts, never clinical text).
> **Maintainer note:** coverage is complete, the chain-ID discrepancy is resolved, and the load-bearing settlement
> address now holds across four consecutive days — this loop has reached diminishing returns. Further rote
> re-verification adds little; consider pausing the cron and reopening only on a real upstream change.
