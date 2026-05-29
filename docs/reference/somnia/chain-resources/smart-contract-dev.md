# Chain resource: Somnia smart-contract dev toolchain

> **One line:** Somnia is **EVM-compatible**, so you build, test, deploy, and verify contracts with the *exact same*
> Solidity, Foundry, Hardhat, and viem you would use on Ethereum — only the RPC URL, chain ID, and verifier endpoint change.
>
> Upstream: [smart contracts](https://docs.somnia.network/developer/smart-contracts.md) ·
> [frameworks](https://docs.somnia.network/developer/development-frameworks.md) ·
> [Foundry](https://docs.somnia.network/developer/development-frameworks/deploy-with-foundry.md) ·
> [Hardhat](https://docs.somnia.network/developer/development-frameworks/deploy-with-hardhat.md) ·
> [viem](https://docs.somnia.network/developer/development-frameworks/using-the-viem-library.md) ·
> [Remix](https://docs.somnia.network/developer/development-frameworks/deploy-with-remixide.md) ·
> [Thirdweb](https://docs.somnia.network/developer/development-frameworks/deploy-with-thirdweb.md) ·
> [verify](https://docs.somnia.network/developer/development-frameworks/verifying-via-explorer.md) ·
> [debug playbook](https://docs.somnia.network/developer/development-frameworks/debug-playbook.md) ·
> [local testing & forking](https://docs.somnia.network/developer/development-frameworks/local-testing-and-forking.md) ·
> [JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md) (Somnia-specific RPC methods) ·
> [using native SOMI/STT](https://docs.somnia.network/developer/building-dapps/tokens-and-nfts/using-native-somi-stt.md) (native value-transfer primitives) ·
> [network overview (mainnet vs testnet)](https://docs.somnia.network/developer/network-info/network-overview-mainnet-testnet.md) (the testnet-first workflow). Fetched 2026-05-20 (forking page 2026-05-21; JSON-RPC methods + native-coin page 2026-05-22; network-overview page 2026-05-22).
> **Core deploy pages re-verified live 2026-05-22** (first re-check since the 2026-05-20 capture, sharpened soft-404 rule):
> [Foundry](https://docs.somnia.network/developer/development-frameworks/deploy-with-foundry.md),
> [Hardhat](https://docs.somnia.network/developer/development-frameworks/deploy-with-hardhat.md), and
> [viem](https://docs.somnia.network/developer/development-frameworks/using-the-viem-library.md) commands/config match
> verbatim (Solidity `0.8.28`, `forge create`, `hardhat ignition deploy`, `somniaTestnet` import); the
> [verify guide](https://docs.somnia.network/developer/development-frameworks/verifying-via-explorer.md) is confirmed
> **mainnet-only** (`5031`, `w3us.site`), so the testnet `chainId 50312` `customChains` corroboration belongs to the
> **Hardhat deploy guide** (`apiURL: shannon-explorer.somnia.network/api`), not the verify guide — a stale citation in the
> [README](../README.md) and [glossary](../GLOSSARY.md#c) was corrected this run.
>
> **On-chain security cluster re-verified live 2026-05-23** (first re-check since the 2026-05-21 capture — the 2026-05-22
> core-deploy sweep had skipped these as "adjacent", leaving them the stalest high-consequence surface; sharpened soft-404
> rule, real body confirmed): the [audit checklist](https://docs.somnia.network/developer/security/audit-checklist.md),
> [security overview](https://docs.somnia.network/developer/security.md) (its **four** layers), and
> [security 101](https://docs.somnia.network/developer/security/smart-contract-security-101.md) all render real content and
> **match verbatim — un-drifted** (CEI reentrancy item, `onlyOwner`/`onlyRole` access modifiers, Solidity `>= 0.8.0`
> overflow, unbounded-loop DoS, Phase 1/Phase 2 split, Slither/Mythril/Solhint with High/Critical blocking; the three
> vulnerability classes, the `require(_status == _NOT_ENTERED …)` guard, pull-payment "users withdraw instead of push",
> `Owner > Admin > Writer`, OpenZeppelin `ReentrancyGuard`/`AccessControl`/`Ownable`, the SWC/Consensys links, and the
> "local/Remix only, NOT … real funds on mainnet" rail). **One precision fix:** the audit-checklist events item, quoted
> here as `"all critical state changes must emit an appropriate Event"`, was tightened to upstream's exact wording
> `"All critical state changes and value transfers must emit an appropriate Event"` — the dropped **"and value transfers"**
> is V1-relevant (the settlement send is a value transfer). No new flags; the pages name no chain ID or RPC URL.
>
> **Local-testing & forking guide re-verified live 2026-05-23** (first re-check since the 2026-05-21 capture — the
> 2026-05-22 core-deploy sweep had treated it as "adjacent", leaving it the stalest high-consequence surface and the
> direct `tdd-test-writer` → `implementer` substrate; sharpened soft-404 rule, real body confirmed): the seven Hardhat
> cheatcodes (`hardhat_impersonateAccount`, `hardhat_setBalance`, `evm_setNextBlockTimestamp`, `evm_mine`,
> `evm_snapshot`, `evm_revert`, `hardhat_reset`), chain ID `31337`, the `http://127.0.0.1:8545` localhost URL, and the
> *"such as a DEX, oracle, or NFT marketplace … using real-world data, but without any of the risk or cost"* purpose
> quote all **match verbatim — un-drifted**. **One precision fix** (the recent runs' paraphrase-to-verbatim discipline):
> the fork commands had been simplified to `anvil --fork-url $SOMNIA_RPC_TESTNET --port 8546` /
> `npx hardhat node --fork $SOMNIA_RPC_TESTNET`, silently dropping upstream's
> `${FORK_BLOCK_TESTNET:+--fork-block-number $FORK_BLOCK_TESTNET}` parameter-expansion — which is the literal mechanism
> that wires the article's separately-described `.env` `FORK_BLOCK_*` var + "pin the block for reproducible CI forks"
> recommendation into the command. Restored to upstream verbatim and the prose tightened to connect the two. The `.env`
> still prints the stale `dream-rpc.somnia.network` testnet RPC (precedence rule unchanged — fork against the
> network-info endpoint); chain IDs agree with the canonical table. No new flags; no chain-ID conflict.
>
> **Debug-playbook + go-live-checklist re-verified live 2026-05-23** (the last two pages cited here still on the
> 2026-05-20 capture — the 2026-05-22 core-deploy and 2026-05-23 security/forking sweeps had skipped both, leaving them the
> stalest high-consequence surface in this article; sharpened soft-404 rule, real body confirmed). The
> [debug playbook](https://docs.somnia.network/developer/development-frameworks/debug-playbook.md) is **un-drifted**: the
> failure-mode→fix table (`execution reverted`, `out of gas`, `nonce too low`, `replacement underpriced`, static-call
> violation — plus an `invalid opcode` row the article omits as redundant), `forge test -vvvv` / `npx hardhat test --trace`,
> the `npx hardhat node --fork https://api.infra.mainnet.somnia.network` fork command, the "Somnia gas costs can differ from
> Ethereum due to consensus differences" note, and the custom-error `iface.parseError()` decoding step all match verbatim.
> **One precision fix on the [go-live checklist](https://docs.somnia.network/developer/deployment-and-production/go-live-checklist.md)**
> (the recent runs' paraphrase-to-verbatim discipline — same class as the 32-SOMI / events-quote / compilation-quote /
> provenance / Data-ID / fork-command / reward-source tightenings): its two closing best-practice lines were rendered here
> inside quote marks as `"test thoroughly on Shannon Testnet before mainnet launch"` and `"complete security audits prior to
> deployment"`, but upstream actually reads **"Always test on Shannon Testnet before mainnet deployment"** and **"Run audit
> checklist (see Smart Contract Security 101)"** — the first a reworded near-quote, the second a genuine misquote (upstream
> never says "complete security audits prior to deployment"). Restored verbatim; the corrected audit-checklist line is
> V1-relevant because it points back to the same
> [security-101](https://docs.somnia.network/developer/security/smart-contract-security-101.md) pull-payment +
> reentrancy-guard patterns this article already applies. The rest of the go-live page is un-drifted (`.env`-not-committed
> secrets, explorer address cross-check, [multisig](../GLOSSARY.md#m)-gated owner/pauser/upgrader roles, the
> `pause()`/feature-flag/upgrade-proxy/role-revocation rollback plan). No new glossary term; no new flags; neither page
> names a chain ID, and the debug-playbook's `api.infra.mainnet` fork URL is already canonical (no stale `dream-rpc`
> sighting in our quoted command — though upstream's *anvil* example still prints `dream-rpc`, the thirteenth sighting).
>
> Map: [chain-resources](../README.md) · Glossary: [Foundry / Hardhat](../GLOSSARY.md#f) · Roadmap: [`../../../ROADMAP.md`](../../../ROADMAP.md)

## For the blockchain dev: there is almost nothing new to learn

This is the resource with the *smallest* learning curve, and that is the point. Somnia is an **EVM-compatible Layer 1**,
so your existing mental model transfers wholesale: write Solidity, compile to EVM bytecode, deploy via an RPC endpoint,
verify against a block explorer. The only Somnia-specific facts you need are three values — **RPC URL**, **chain ID**,
and **verifier URL** — plus a test-token faucet.

### Foundry (forge)

The upstream [Foundry guide](https://docs.somnia.network/developer/development-frameworks/deploy-with-foundry.md) is the
canonical "hello world": `forge init`, `forge build`, then deploy with `forge create`:

```bash
forge create --rpc-url <SOMNIA_RPC_URL> --private-key $PRIVATE_KEY src/MyContract.sol:MyContract
```

Prerequisites are a wallet with **STT** test tokens for gas and an exported private key
([Foundry guide](https://docs.somnia.network/developer/development-frameworks/deploy-with-foundry.md)). For mainnet the
same flow applies with **SOMI** instead of STT.

### Hardhat (with viem + Ignition)

The [Hardhat guide](https://docs.somnia.network/developer/development-frameworks/deploy-with-hardhat.md) scaffolds a
TypeScript-with-viem project (matching this repo's stack), pins Solidity **`0.8.28`**, and adds a network entry:

```ts
networks: {
  somnia: {
    url: "<SOMNIA_RPC_URL>",
    accounts: ["YOUR_PRIVATE_KEY"],
  },
}
```

Deployment uses Hardhat **Ignition**, the declarative deploy-module system:

```bash
npx hardhat ignition deploy ./ignition/modules/deploy.ts --network somnia
```

### viem (the TypeScript escape hatch)

viem ships a pre-configured chain object, so you don't hand-roll the chain ID or RPC
([viem guide](https://docs.somnia.network/developer/development-frameworks/using-the-viem-library.md)):

```ts
import { somniaTestnet } from "viem/chains"
import { createPublicClient, createWalletClient, http } from "viem"

const publicClient = createPublicClient({ chain: somniaTestnet, transport: http() })  // reads
const walletClient = createWalletClient({ account, chain: somniaTestnet, transport: http() }) // writes (cost gas)
```

`publicClient.readContract(...)` for views; `walletClient.writeContract(...)` followed by
`publicClient.waitForTransactionReceipt({ hash })` for state changes
([viem guide](https://docs.somnia.network/developer/development-frameworks/using-the-viem-library.md)). See
[`GLOSSARY.md` → viem](../GLOSSARY.md#v).

> ⚠️ **`http()` with no URL inherits the bundled default RPC.** The upstream example (re-verified live 2026-05-22) calls
> `transport: http()` with **no explicit endpoint**, so the transport silently uses whatever RPC the bundled
> `somniaTestnet` chain object ships with — and the same guide prints the **stale `dream-rpc.somnia.network`** testnet
> URL elsewhere. For V1, pass the canonical endpoint explicitly — `http("https://api.infra.testnet.somnia.network/")` —
> rather than trusting the default. Same precedence rule as the [RPC-endpoint section below](#which-rpc-endpoint-to-point-at--public-defaults-vs-third-party-providers).

### Which RPC endpoint to point at — public defaults vs. third-party providers

The **RPC URL** is one of the three Somnia-specific values above, and there is more than one choice. The
[README connection table](../README.md) records the **canonical Somnia-operated endpoints**
(`https://api.infra.testnet.somnia.network/`, mainnet `…mainnet…`) — those are the defaults for development and the
demo. But upstream also lists **third-party RPC providers**
([ecosystem: RPC](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/rpc.md)),
which matter the moment a single endpoint becomes a shared bottleneck:

| Provider | Endpoint | Note (verbatim where quoted) |
|---|---|---|
| **Ankr** | `https://www.ankr.com/rpc/somnia/` | — |
| **Public Node** | `https://somnia.publicnode.com/` | "fast, free, and privacy-first" |
| **Stakely** | `https://somnia-json-rpc.stakely.io/` | — |
| **Validation Cloud** | `https://www.validationcloud.io/somnia` | Somnia Testnet **and** Mainnet; "50 million compute units available for use without a credit card", with a "scale tier that never imposes rate limits" |

Upstream names no default or recommended provider and publishes no rate-limit numbers for Ankr or Stakely
([ecosystem: RPC](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/rpc.md)) —
swapping providers is a one-line change (the `--rpc-url` flag, the Hardhat `networks.somnia.url`, or the viem
`http("<url>")` transport), so this is a deploy-time, not architecture-time, decision. See [`GLOSSARY.md` → RPC](../GLOSSARY.md#r).

### Somnia-specific JSON-RPC methods — submit-and-wait, session keys, reactivity reads

Whatever endpoint you point at speaks the standard Ethereum JSON-RPC, so for most work the toolchain above never makes
you think about the wire protocol. But the [JSON-RPC API reference](https://docs.somnia.network/developer/json-rpc-api.md)
documents a handful of **`somnia_`/`realtime_`-prefixed extension methods** beyond the standard `eth_*` set, and one of
them changes how an *agent* should submit a transaction. (Method names below are verbatim; one-line behaviours are
summarised from a live 2026-05-22 fetch of that page — see the source caveat.)

| Method | What it does (summarised) | Why it matters for V1 |
|---|---|---|
| **`realtime_sendRawTransaction`** | submits a signed transaction and **waits for the receipt** before returning, instead of returning a hash you then poll for | The single most relevant one — see below |
| **`somnia_reactivityGetSubscriptions` / `somnia_reactivityGetSubscriptionInfo`** | read the active on-chain Reactivity Protocol subscriptions / one subscription's detail over RPC | The RPC-level read under the precompile `0x0100`'s `getSubscriptionInfo` the [reactivity article](reactivity.md) describes — lets a script *inspect* which on-chain subscriptions a deployed handler owns without a contract call |
| **`somnia_getSessionAddress` / `somnia_sendSessionTransaction`** | session-key operations at the RPC layer | The RPC primitive beneath the session-key/[account-abstraction](account-abstraction.md) flows — relevant only if V1 adopts session keys for agent signing (a P1 polish item, not the loop) |
| **`somnia_getStatistics`** | returns chain statistics over a block range | A direct read for the demo's "show Somnia speed" claims — but [the FAQ/litepaper figures](consensus-and-execution.md) are the cited throughput source, so treat this as live telemetry, not a headline number |

**`realtime_sendRawTransaction` is a latency lever for a sequential agent loop.** Curie's negotiation is a *chain* of
turns — a provider proposal must be confirmed on-chain before the payer agent should react to it (see the
[reactivity wake mechanism](reactivity.md)). The standard pattern is `eth_sendRawTransaction` → get a hash →
poll `eth_getTransactionReceipt` until it lands; the Somnia method collapses that submit-then-poll into **one
round-trip that returns once the receipt exists**, removing the poll loop between each agent turn. That pairs naturally
with the chain's [same-block reactivity](reactivity.md) story: the next turn can begin as soon as the call returns,
not a polling interval later. Whether V1 actually uses it is an open question (below) — the standard `eth_*` path works
on any EVM tooling, while this method ties our submission code to Somnia — but it is the documented option for shaving
inter-turn latency in the live demo.

Two **compatibility caveats** from the same page are worth recording so nobody designs around a method that isn't there:
`eth_subscribe` **does not support `newPendingTransactions`** (you can subscribe to `newHeads`, `logs`, and the
`somnia_*` log/transaction variants the [reactivity article](reactivity.md) lists, but not the pending-tx mempool feed),
and **EIP-4844 blob transactions (type `0x3`) are not supported** — neither affects V1 (we neither watch the mempool nor
post blobs), but both are silent failure modes if assumed. The reference also re-states the chain IDs in hex —
**`0x13a7` (`5031`, mainnet)** and **`0xc488` (`50312`, Shannon testnet)** — a *fourth* upstream corroboration of the
values in the [README connection table](../README.md), after network-info, the Hardhat `customChains` entry, and the
agents quickstart. See [`GLOSSARY.md` → realtime_sendRawTransaction](../GLOSSARY.md#r).

### GUI / managed deploy paths (Remix, Thirdweb) — and why V1 doesn't use them

Upstream documents two **point-and-click** deploy paths alongside the scriptable ones above. Both are real, both work,
and **both are the wrong tool for an autonomous-agent demo** — worth a sentence on why.

- **[Remix IDE](../GLOSSARY.md#r)** ([deploy-with-remixide](https://docs.somnia.network/developer/development-frameworks/deploy-with-remixide.md)):
  paste the contract into the browser Remix IDE, compile, then under *Deploy & run transactions* set the Environment to
  **"Injected Provider - MetaMask"** and click deploy — the last step is **"Approve the contract deployment when prompted
  in MetaMask."** Prerequisites are MetaMask with the Somnia network added and STT (testnet) / SOMI (mainnet) from the
  faucet. The page's example pins Solidity **`^0.8.22`** (note: *older* than the `0.8.28` the Hardhat/Foundry guides use)
  and lists no chain ID or RPC URL of its own — you inherit whatever the [injected provider](../GLOSSARY.md#i) is
  pointed at ([Remix guide](https://docs.somnia.network/developer/development-frameworks/deploy-with-remixide.md)).
- **Thirdweb CLI** ([deploy-with-thirdweb](https://docs.somnia.network/developer/development-frameworks/deploy-with-thirdweb.md)):
  `npx thirdweb deploy -k your_secret_key` compiles locally, then opens a **browser dashboard** where you pick the
  network, fill constructor args, and **approve the deploy transaction in MetaMask**. Solidity **`^0.8.28`**; the worked
  example deploys to **Devnet**. The page documents **no Thirdweb Engine / server-side / headless deploy path** — only
  the CLI-plus-browser flow ([Thirdweb guide](https://docs.somnia.network/developer/development-frameworks/deploy-with-thirdweb.md)).

> ⚠️ **Both terminate in a manual MetaMask click — so neither is V1's path.** Curie's provider/payer agents are
> **headless Node processes** holding a key in [`somnia-agent-kit`](../../somnia-agent-kit/); there is no browser and no
> human to approve a transaction. Deploy stays on **Foundry/Hardhat**, which take the key from `.env` and run
> unattended in CI (see the [`tdd-test-writer` → `implementer`](../../../../AGENTS.md) loop). The two GUI paths are
> demo/onboarding conveniences for a *human* deploying once, not a substrate for autonomous signing. This is the same
> headless-vs-browser gap the [account-abstraction article](account-abstraction.md) records as **open question 4**
> ("can a managed Thirdweb account be driven from a server-side signer?") — neither GUI deploy page closes it. Match the
> compiler version, too: a Remix-deployed `^0.8.22` artifact won't verify against a `0.8.28` build.

> ⚠️ **Site-map vs. resolving-page flags (2026-05-21).** Two Thirdweb-slug traps caught while fetching these pages:
> (a) the dev-frameworks landing [deploying-smart-contracts](https://docs.somnia.network/developer/development-frameworks/deploying-smart-contracts.md)
> renders as a **content-less stub/landing page** — no deploy options enumerated; the substance lives in the per-tool
> pages above. (b) [`llms.txt`](https://docs.somnia.network/llms.txt) lists the gasless tutorial at the *full* slug
> `…/account-abstraction/gasless-transactions-with-thirdweb.md`, **but that URL renders GitBook's "Page Not Found"
> body** — the resolving content is at the *truncated* `…/gasless-transactions-with-thirdw.md` (already cited by the
> [account-abstraction article](account-abstraction.md)). **Takeaway for the citation audit: presence in `llms.txt` is
> not proof a page resolves, and HTTP `200` is not either** (GitBook serves soft-404s as `200`) — confirm a real body.

### Verifying on the explorer

Somnia's explorer is **[Blockscout](../GLOSSARY.md#b)-based, not Etherscan**, which changes the verifier flags
([verify guide](https://docs.somnia.network/developer/development-frameworks/verifying-via-explorer.md)):

```bash
forge verify-contract <ADDRESS> src/MyContract.sol:MyContract \
  --verifier blockscout --verifier-url <BLOCKSCOUT_API_URL>
```

For Hardhat, the [guide](https://docs.somnia.network/developer/development-frameworks/deploy-with-hardhat.md) configures
the `etherscan` block with `apiKey: { somnia: "empty" }` and a `customChains` entry whose `chainId` is **`50312`**
(testnet) and whose `apiURL` is **`https://shannon-explorer.somnia.network/api`**
([Hardhat guide](https://docs.somnia.network/developer/development-frameworks/deploy-with-hardhat.md)). The standalone
[verify guide](https://docs.somnia.network/developer/development-frameworks/verifying-via-explorer.md), by contrast,
documents the **mainnet** Blockscout endpoint `https://mainnet.somnia.w3us.site/api` at `chainId: 5031` — the two pages
target different networks rather than conflicting. Verification needs the **exact** compiler version, EVM
version, optimizer runs, and constructor args to match the deployment; upstream recommends **Standard JSON Input** for
production contracts ([verify guide](https://docs.somnia.network/developer/development-frameworks/verifying-via-explorer.md)).

> ✅ **Chain-ID resolved (2026-05-20).** That Hardhat `customChains` entry uses `chainId: 50312`, matching
> [network-info](https://docs.somnia.network/developer/network-info.md). Two upstream pages now agree on `50312`, so the
> agent-kit's lone `50311` stands resolved as a stale off-by-one — treat it as incorrect, not as an open question. See
> [`README.md`](../README.md) and [`GLOSSARY.md` → Chain ID](../GLOSSARY.md#c).
>
> ✅ **RPC-URL drift resolved (2026-05-20).** Both pages were re-fetched on this date to settle the conflict. The
> [Foundry tutorial](https://docs.somnia.network/developer/development-frameworks/deploy-with-foundry.md) still prints
> `https://dream-rpc.somnia.network` in its `forge create` command and a faucet at `https://devnet.somnia.network/`,
> whereas the authoritative [network-info](https://docs.somnia.network/developer/network-info.md) table publishes the
> testnet RPC as `https://api.infra.testnet.somnia.network/` and **does not mention `dream-rpc` or `devnet` anywhere** —
> its faucet list is `testnet.somnia.network`, Google Cloud, Stakely, and Thirdweb. Upstream has not reconciled the two:
> the framework tutorials simply lag the network table. **Precedence rule for us: the network-info table is canonical;
> deploy against `https://api.infra.testnet.somnia.network/` and treat the tutorial `dream-rpc`/`devnet` strings as
> stale illustrative values.** (The debug playbook's fork example, `https://api.infra.mainnet.somnia.network`, already
> follows the canonical scheme.) See [`README.md` → the chain in one screen](../README.md#the-chain-in-one-screen),
> whose table already uses the canonical endpoints.

### Debugging

The [debug playbook](https://docs.somnia.network/developer/development-frameworks/debug-playbook.md) maps the usual EVM
failures (`execution reverted`, `out of gas`, `nonce too low`, `replacement underpriced`, static-call violations) to
fixes, and recommends `forge test -vvvv` / `npx hardhat test --trace` for call traces, plus local forking
(`npx hardhat node --fork https://api.infra.mainnet.somnia.network`). Two Somnia-specific notes: **gas costs differ from
Ethereum** (estimate per-function rather than assuming Ethereum costs — see
[`GLOSSARY.md` → Gas](../GLOSSARY.md#g)), and **custom-error decoding is not automatic** in Hardhat (parse via
`iface.parseError()`) ([debug playbook](https://docs.somnia.network/developer/development-frameworks/debug-playbook.md)).

### Local testing & forking (the TDD substrate)

Before anything reaches Shannon testnet, it runs on your machine. The
[local-testing-and-forking guide](https://docs.somnia.network/developer/development-frameworks/local-testing-and-forking.md)
documents two layers, both standard EVM tooling:

- **In-process tests against an ephemeral node** — `npx hardhat test` (Hardhat's built-in network, chain ID `31337`), or
  a persistent node via `npx hardhat node` with `npx hardhat test --network localhost` (`http://127.0.0.1:8545`,
  chain ID `31337`). Foundry's equivalent is `forge test` against [Anvil](../GLOSSARY.md#a).
- **Forking** — copy the live chain's state at a chosen block onto a local node, so your contract can interact with
  *already-deployed* contracts (the guide names "a DEX, oracle, or NFT marketplace") "using real-world data, but without
  any of the risk or cost"
  ([local-testing guide](https://docs.somnia.network/developer/development-frameworks/local-testing-and-forking.md)).

```bash
# Fork Shannon testnet with Anvil (Foundry). The trailing
# ${FORK_BLOCK_TESTNET:+…} expands to --fork-block-number only when the var is set,
# otherwise the fork follows the chain head — this is how block-pinning is wired.
anvil --fork-url $SOMNIA_RPC_TESTNET ${FORK_BLOCK_TESTNET:+--fork-block-number $FORK_BLOCK_TESTNET} --port 8546

# Fork with a Hardhat node instead
npx hardhat node --fork $SOMNIA_RPC_TESTNET ${FORK_BLOCK_TESTNET:+--fork-block-number $FORK_BLOCK_TESTNET}
```

(Swap `_TESTNET` → `_MAINNET` in both vars for the mainnet-fork variants the guide also prints.) The guide's `.env`
example pins both endpoints and (optionally) a block number for reproducible forks —
`SOMNIA_RPC_MAINNET=https://api.infra.mainnet.somnia.network/`, `SOMNIA_RPC_TESTNET=…`, and an (empty by default)
`FORK_BLOCK_MAINNET=` / `FORK_BLOCK_TESTNET=` per network — and recommends pinning the block number so CI forks are
deterministic. The command above is what *consumes* that variable: set `FORK_BLOCK_TESTNET` in `.env` and the
`${…:+…}` expansion injects `--fork-block-number`; leave it blank and the fork tracks head
([local-testing guide](https://docs.somnia.network/developer/development-frameworks/local-testing-and-forking.md)). It
also lists the Hardhat state-manipulation cheatcodes you'll lean on: `hardhat_impersonateAccount` (act as any address
without its key), `evm_snapshot`/`evm_revert` (roll state back between cases), `evm_setNextBlockTimestamp` + `evm_mine`
(time-travel), `hardhat_setBalance`, and `hardhat_reset` (re-fork)
([local-testing guide](https://docs.somnia.network/developer/development-frameworks/local-testing-and-forking.md)).

> ⚠️ **Same testnet-RPC drift, same precedence rule.** That `.env` example sets `SOMNIA_RPC_TESTNET=https://dream-rpc.somnia.network/`
> — the *stale* testnet URL also printed by the Foundry tutorial, **not** the canonical
> [network-info](https://docs.somnia.network/developer/network-info.md) endpoint
> `https://api.infra.testnet.somnia.network/`. Fork against the network-info endpoint; treat `dream-rpc` as illustrative
> (see the RPC-URL note above). Chain IDs here **agree** with the canonical table — testnet `50312`, mainnet `5031` — so
> no conflict there.

**The progression the fork sits inside.** Forking and in-process tests are the *local* rung; upstream's
[network overview](https://docs.somnia.network/developer/network-info/network-overview-mainnet-testnet.md) names the
rungs above it and makes the order a rule: **"Treat Testnet as your safe playground and Mainnet as your production stage.
Every project should pass through Testnet before moving to Mainnet,"** with a best-practice list that leads **"Start on
Testnet: Validate contracts and flows on Shannon before mainnet"** and then **"Audit before launch: Ensure contracts are
reviewed and secure"**
([network overview](https://docs.somnia.network/developer/network-info/network-overview-mainnet-testnet.md)). That is the
same local-fork → Shannon → mainnet discipline ROADMAP already bakes into "test on testnet first"
([ROADMAP](../../../ROADMAP.md) → Week 1), and the page's framing of mainnet — "all transactions on this chain are
**final and irreversible**" — is exactly why an *audit-anchoring* protocol must rehearse the whole loop on Shannon (chain
ID `50312`, funded from the **STT faucet** the Foundry section assumes) before it ever writes a settlement hash it cannot
retract. ⚠️ The page is **purely qualitative**: it carries **no** block time, finality-in-milliseconds, TPS, or gas
figure, so it does *not* feed the residual finality/throughput research gaps — for those see
[consensus & execution](consensus-and-execution.md). Reading it confirms a useful negative: despite sitting in the
*Network info* section beside the chain-ID table, it is a workflow guide, not a spec sheet.

### Securing & shipping: the audit + go-live checklists

Build/deploy/verify is only the first half. Upstream documents the *secure-then-ship* half as two checklists, and
because Somnia is EVM-compatible, **both are standard Ethereum security practice** — nothing chain-specific to relearn.

The [audit checklist](https://docs.somnia.network/developer/security/audit-checklist.md) has two phases. **Phase 1 is a
manual pre-deployment pass**: reentrancy ("all functions that send Ether or tokens to external addresses must follow the
[Checks-Effects-Interactions](../GLOSSARY.md#c) pattern"), access control (critical state-changing functions guarded by
modifiers like `onlyOwner`), integer overflow (safe by default on Solidity ≥ 0.8.0 — and the repo pins `0.8.28`),
DoS-by-unbounded-loop ("operations must not iterate over unbounded arrays"), validated external calls, and minimal
visibility (`private`/`internal` for internal-only state). It also requires that **"All critical state changes and value
transfers must emit an appropriate `Event`"** — note the **"and value transfers"**: `ClaimSettlement.sol`'s settlement
send *is* a value transfer, so upstream explicitly mandates emitting the very audit event our timeline already depends on.
**Phase 2 is mandatory automated static analysis**:
[Slither](../GLOSSARY.md#s), Mythril (symbolic execution), and Solhint, where **High/Critical findings block deployment**
and Medium/Low must be documented or justified
([audit checklist](https://docs.somnia.network/developer/security/audit-checklist.md)). The broader
[security overview](https://docs.somnia.network/developer/security.md) frames four layers —
[smart-contract security 101](https://docs.somnia.network/developer/security/smart-contract-security-101.md),
this audit checklist, [node/infra security](https://docs.somnia.network/developer/security/node-infra-security.md), and a
[responsible-disclosure policy](https://docs.somnia.network/developer/security/responsible-disclosure-policy.md). **All
four are now covered here** — security-101 patterns and node/infra security below, and responsible disclosure last.

Beneath the checklist sits the **patterns layer** — the
[smart-contract security 101](https://docs.somnia.network/developer/security/smart-contract-security-101.md) page, the
*how-to* for the properties the audit checklist later verifies. It is standard EVM security distilled to three
vulnerability classes and their canonical mitigations. **Reentrancy** (a contract "calls an external contract before
updating its internal state") → [Checks-Effects-Interactions](../GLOSSARY.md#c) plus a
[reentrancy guard](../GLOSSARY.md#r) (`require(_status == _NOT_ENTERED); _status = _ENTERED; …`) and a
**[pull-payment model](../GLOSSARY.md#p)** ("users withdraw instead of push"), so a fund-releasing function never makes
an external call it can be re-entered through. **Access-control gaps** (unauthorised callers reaching privileged
functions, "leading to complete contract compromise") → a role hierarchy (`Owner > Admin > Writer`), an immutable owner,
and OpenZeppelin's `Ownable` / `AccessControl`. **Integer overflow/underflow** → automatic on Solidity ≥ 0.8 (the repo
pins `0.8.28`), with `SafeMath` only for older compilers. The page recommends OpenZeppelin's "battle-tested"
`ReentrancyGuard` / `AccessControl` / `Ownable` over hand-rolled equivalents, names the same static-analysis tools the
checklist mandates plus MythX, Securify and Manticore, and points outward to the [SWC Registry](https://swcregistry.io/)
and [Consensys smart-contract best practices](https://consensys.github.io/smart-contract-best-practices/)
([security 101](https://docs.somnia.network/developer/security/smart-contract-security-101.md)). Its one
Somnia-specific note is a safety rail for *learning*: deploy deliberately-vulnerable example contracts "only in
local/Remix test environments" and **"NOT … with real funds on mainnet"** — i.e. practise exploits on a
[fork](../GLOSSARY.md#f) or Shannon testnet, never on a funded contract.

### Moving native value — the settlement-transfer primitive

The security-101 pull-payment guidance above is a rule *about* a primitive the rest of the toolchain never spells out:
how a contract actually **receives and sends the native coin**. Upstream's
[using native SOMI/STT](https://docs.somnia.network/developer/building-dapps/tokens-and-nfts/using-native-somi-stt.md)
guide is the one page that does. The headline: **SOMI is ETH-shaped at the contract level too** — "SOMI is the native
coin of the Somnia Network, similar to ETH on Ethereum," so you move it with the EVM's built-in `payable` machinery and
**"No ERC20 functions are needed"**
([using native SOMI/STT](https://docs.somnia.network/developer/building-dapps/tokens-and-nfts/using-native-somi-stt.md)).
On Shannon testnet the same code moves **STT** instead — only the token name changes.

The three primitives upstream documents, verbatim:

- **Receive into a function** via a `payable` function reading `msg.value`:
  ```solidity
  function payToAccess() external payable {
    require(msg.value == 0.01 ether, "Must send exactly 0.01 SOMI");
  }
  ```
  (`ether` is the literal-unit keyword — it still means `1e18` Wei; on Somnia that is one **SOMI**, per the
  [denomination ladder](tokenomics-and-gas.md).)
- **Receive a bare transfer** (no calldata) via the `receive()` function:
  ```solidity
  receive() external payable { emit Tipped(msg.sender, msg.value); }
  ```
- **Send out** with `.transfer()`:
  ```solidity
  payable(owner).transfer(address(this).balance);
  ```

⚠️ **Read this against the pull-payment rule above, not in isolation.** The upstream guide presents `.transfer()` as a
**direct push** with **no security commentary** — no reentrancy, no pull-over-push discussion (it is an intro page, not a
hardening guide). Security-101 is explicit that a fund-releasing function must instead follow
[Checks-Effects-Interactions](../GLOSSARY.md#c) + a [reentrancy guard](../GLOSSARY.md#r) + a
[pull-payment model](../GLOSSARY.md#p). So the V1 takeaway is a composition: use these primitives for the *mechanism*
(`payable` to receive the settlement deposit, native send to release it), but wrap the **release** in the pull-payment
pattern the section above mandates — never the naive push the intro page shows. The page names no chain ID, no RPC URL,
and no gas figure (the cost of these ops is the [tokenomics & gas](tokenomics-and-gas.md) schedule's job).

#### The DAO example — the upstream contract nearest to `ClaimSettlement`, anti-patterns and all

Upstream's [DAO smart-contract tutorial](https://docs.somnia.network/developer/building-dapps/example-applications/dao-smart-contract.md)
is the worked example **structurally closest to Curie's settlement contract**: a `deposit() external payable` that gates
participation (`require(msg.value == 0.001 ether, "Must deposit STT")` → `votingPower[msg.sender]`), a
`createProposal(string calldata description)` gated on `votingPower > 0`, a time-boxed `vote(uint256 proposalId, bool
support)` (`votingDuration = 10 minutes`, `deadline: block.timestamp + votingDuration`), and an `executeProposal` that
releases funds **only after** the deadline passes and yes-votes win. The shape maps almost 1:1 onto V1: deposit ≈ the
payer's escrow, `votingPower`-gating ≈ agent-identity gating, the deadline ≈ a negotiation-round timeout, and
`executeProposal`'s approve-then-release ≈ `ClaimSettlement.sol`'s fund release. It is the closest thing the docs ship to
our flow, so it is worth reading — **as a counter-example**.

Its release path, verbatim:

```solidity
function executeProposal(uint256 proposalId) external {
    Proposal storage proposal = proposals[proposalId];
    require(block.timestamp >= proposal.deadline, "Voting still active");
    require(!proposal.executed, "Proposal already executed");
    require(proposal.yesVotes > proposal.noVotes, "Proposal did not pass");
    proposal.executed = true;                              // effect before interaction (CEI ordering)
    payable(proposal.proposer).transfer(0.001 ether);      // ⚠️ push payment, no reentrancy guard
}
```

This is the [pull-payment rule above](#securing--shipping-the-audit--go-live-checklists) violated in a worked example.
The `proposal.executed = true` *before* the transfer is correct Checks-Effects-Interactions ordering and stops the same
proposal being executed twice — but it is **not** a [reentrancy guard](../GLOSSARY.md#r): the contract leans on
`.transfer()`'s 2300-gas stipend as implicit protection, a fragile assumption since gas repricing (EIP-1884) can break
exactly that stipend. Security-101 is explicit that a fund-releasing function wants an *explicit* guard plus
[pull-over-push](../GLOSSARY.md#p) — neither of which this example has (it also declares `modifier onlyOwner` and then
**never uses it**, an access-control smell an auditor should never let into a fund-holding contract). So the V1 takeaway
is the same composition the section above states: borrow the DAO example's *control flow* (gated deposit, time-boxed
approval, approve-then-release), but **not** its release line — `ClaimSettlement.sol` releases via pull-payment behind a
reentrancy guard, never `payable(x).transfer(...)`. A second reuse caveat: the proposal's `string description` field is a
free-text [PHI](../GLOSSARY.md#p) hazard in the same way the [on-chain-chat app's `content` field](data-streams.md) is —
Curie's on-chain proposal record must be structured code/state/hash/amount, never a free-text string. ⚠️ The tutorial's
`.env` is an **eighth** sighting of the stale `dream-rpc.somnia.network` testnet RPC (precedence rule unchanged: the
canonical endpoint is `api.infra.testnet`); it names no chain ID, and its three companion `dao-ui-tutorial-p{1,2,3}` pages
are a browser/React frontend — off the headless V1 agent loop, so they are recorded here as triaged-out, not woven.

### Node/infra security: protecting the process that signs (the off-chain layer)

The audit checklist and security-101 govern *the contract*. Their off-chain twin — the **third** of upstream's four
security layers — is the [node/infra security](https://docs.somnia.network/developer/security/node-infra-security.md)
page, subtitled *"Secure RPC Key Management and Environment Configuration for Somnia Developers."* This is the layer
that matters most to Curie, because our provider/payer agents are **headless Node processes that hold signing keys** —
there is no MetaMask and no human to protect the key, so the process's own hygiene *is* the security boundary.

The guidance is standard Node.js secret-handling, distilled to four areas
([node/infra security](https://docs.somnia.network/developer/security/node-infra-security.md)):

- **Environment variables, never hardcoding.** Keep RPC URLs and private keys in `.env`; *"the .env file should be added
  to your .gitignore file"*; commit a safe `.env.example` template instead; and split config across
  `.env.development` / `.env.test` / `.env.staging` / `.env.production`, with production secrets never committed. The
  page's `.gitignore` lists `.env`, `.env.local`, `.env.*.local`, `node_modules/`, `dist/`. For production it points at a
  **[secrets manager](../GLOSSARY.md#s)** (it names AWS Secrets Manager) rather than a file on disk.
- **RPC keys.** *"Private RPCs are premium services and perform significantly better than the public RPC"*; apply **IP
  allowlisting** through the provider dashboard where supported. (This is the operational reason behind the third-party
  provider table above.)
- **Private keys.** Generate with cryptographically secure randomness (`Wallet.createRandom()` from ethers.js); never
  share; use a **[multisig](../GLOSSARY.md#m) or role-based access** for teams and **hardware wallets for high-value
  operations**; and set a **[key-rotation](../GLOSSARY.md#k) schedule** (the page's example rotates every **90 days**).
- **Error handling & logging.** *"Ensure that sensitive information like private keys and API secrets are never exposed
  in logs"* — log method names and error codes, **redact** the values; wrap RPC calls in retry-with-exponential-backoff
  (`maxRetries = 3`, delay `2^attempt × 1000` ms) and pad gas estimates with a **20% buffer** (`gasEstimate * 120n / 100n`).

The page closes with a 10-item **Security Checklist** (keys in env vars; private RPC endpoints; IP whitelisting; key
rotation; hardware wallets for high-value ops; proper error handling + logging; never commit secrets; role-based access
for teams; monitor/audit key usage; test env-var loading), all standard Node.js practice, all run off-chain.

> ⚠️ **A *third* form of the testnet RPC URL.** This page's `.env` example uses Ankr's
> `https://rpc.ankr.com/somnia_testnet/your-private-key` (with the key in the path) — neither the canonical
> `api.infra.testnet.somnia.network/` from [network-info](https://docs.somnia.network/developer/network-info.md) nor the
> `https://www.ankr.com/rpc/somnia/` form the [ecosystem: RPC](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/rpc.md)
> page lists. It is *not* the stale `dream-rpc` string flagged elsewhere — it is a per-developer Ankr URL — but it is a
> reminder that the RPC endpoint is config, kept in `.env`; the precedence rule stands (use the network-info table's
> canonical endpoint for the demo unless a quota forces a provider swap). No chain IDs appear on this page.

### Responsible disclosure: the fourth security layer (what to do when you *find* a bug)

The first three layers harden *your* code and *your* keys. The fourth governs the opposite case — when you find a flaw in
**Somnia itself** (a precompile, the [native-agent](native-agents.md) consensus path, a system contract, the
[bridge](https://docs.somnia.network/get-started/bridging-info.md)). The
[responsible-disclosure policy](https://docs.somnia.network/developer/security/responsible-disclosure-policy.md) is the
protocol's own report-handling contract, and it is short and concrete:

- **Report privately, through a named channel.** Email **`developers@somnia.network`**, a Discord support ticket under
  *"Bug Reports,"* or the listed Telegram contacts — and *"always disclose vulnerabilities privately and responsibly"*
  (no public issue, no tweet-first) ([responsible-disclosure policy](https://docs.somnia.network/developer/security/responsible-disclosure-policy.md)).
- **Response target.** DevRel *"aims to reply within 24 hours"* — an acknowledgement SLA, not a fix SLA
  ([responsible-disclosure policy](https://docs.somnia.network/developer/security/responsible-disclosure-policy.md)).
- **Safe harbour.** *"Researchers acting in good faith will not face any penalties and will be publicly recognized"* in
  the Somnia docs and Discord. ⚠️ A **formal bounty system is not yet live** — *"future bounty and recognition programs
  will expand as Somnia Mainnet evolves"* — so do not expect a monetary reward today
  ([responsible-disclosure policy](https://docs.somnia.network/developer/security/responsible-disclosure-policy.md)).
- **Rules of engagement (all three are prohibitions).** Do **not** exploit vulnerabilities on **Mainnet**; do **not**
  disrupt network services or RPC endpoints; do **not** engage in social engineering or phishing. The positive form is a
  rule we already live by: *"always test exploits or stress scenarios on Shannon Testnet, not on Mainnet"*
  ([responsible-disclosure policy](https://docs.somnia.network/developer/security/responsible-disclosure-policy.md)).

> **Why this matters to V1.** Two ways. First, the **testnet-only testing rule is the same discipline** the
> [security-101 page](https://docs.somnia.network/developer/security/smart-contract-security-101.md) states for our own
> contracts ("local/Remix… NOT… with real funds on mainnet") and that our [fork-first](../GLOSSARY.md#f) workflow already
> enforces — so if a Curie agent's negotiation traffic ever surfaces a Somnia-side bug, the place to reproduce it is
> Shannon testnet, never a funded mainnet contract. Second, it gives Curie a **template for its own disclosure posture**:
> a protocol that settles claims needs a private report channel and a safe-harbour line of its own, and upstream's policy
> is the shape to copy (named contact, acknowledgement target, "report privately first"). For the hackathon V1 the
> obligation is light — there are no real funds and no mainnet deploy — but the **direction of disclosure** (private, to a
> contact, reproduced on testnet) is the part that carries over. **No PHI in a report, either:** a vulnerability write-up
> describing a Curie contract must use synthetic claim IDs and hashes, never a real medical note — the
> [no-PHI-in-logs](../GLOSSARY.md#k) rule extends to bug reports.

The [go-live checklist](https://docs.somnia.network/developer/deployment-and-production/go-live-checklist.md) covers
production cut-over: keep RPC URLs / private keys / API keys in `.env` (never committed), verify core system-contract
addresses against the explorer, gate privileged roles (owner, pauser, upgrader) behind a **[multisig](../GLOSSARY.md#m)
(Safe)** with no test keys left in allowlists, and keep a rollback plan — a `pause()` on critical contracts, feature
flags, verified previous implementations for upgradeable contracts, and rapid role-revocation. Its closing
best-practices are the ones we already live by — verbatim, **"Always test on Shannon Testnet before mainnet deployment"**
and **"Run audit checklist (see Smart Contract Security 101)"** — the latter pointing straight back to the same
[security-101](https://docs.somnia.network/developer/security/smart-contract-security-101.md) pull-payment + reentrancy-guard
patterns this article already folds into `ClaimSettlement.sol`'s fund-release path
([go-live checklist](https://docs.somnia.network/developer/deployment-and-production/go-live-checklist.md)).

## For the AI engineer: what a "deploy pipeline" buys you

If you live in LLMs and agents, the contract toolchain is the part that turns a *spec* into an *address other code can
call*. Three ideas worth internalising:

- **Compile → deploy → verify is the on-chain analogue of build → ship → publish-the-source.** Verification uploads your
  Solidity source so the explorer can prove the deployed bytecode matches it — the equivalent of a reproducible build.
  For Curie that is what lets a judge (or auditor) read the *actual* settlement logic, not trust our word.
- **A contract address is a stable, typed API.** Once deployed, the [ABI](../GLOSSARY.md#a) is the only interface the
  agents need; our off-chain [`somnia-agent-kit`](../../somnia-agent-kit/) processes call it with viem exactly as shown
  above. The toolchain is "infra," not runtime — it never sits in the live agent loop.
- **Determinism lives in tests, not the model.** Foundry/Hardhat tests pin contract behaviour so the on-chain half of
  the demo is reproducible even when the LLM half varies. This is the `tdd-test-writer` → `implementer` flow in
  [`AGENTS.md`](../../../../AGENTS.md).

## How Curie V1 uses it

This is the workbench for **Person A's** entire surface in [`docs/ROADMAP.md`](../../../ROADMAP.md): the
`ClaimSettlement.sol` lifecycle contract, its [events](../../../ROADMAP.md) (`ClaimSubmitted`, `ClaimCountered`,
`ClaimAgreed`, `ClaimSettled`, …), the agent-identity registry, and the settlement simulation. Concretely:

- **Week 1 ("Protocol skeleton")** is almost entirely this toolchain: write the contract, add Foundry/Hardhat tests,
  deploy to **Shannon testnet**, emit rich events ([ROADMAP](../../../ROADMAP.md) → Week 1). The dual Foundry/Hardhat
  support means Person A can pick either; the Hardhat-with-viem scaffold lines up with the repo's TypeScript-only rule.
- **Explorer verification is a judging asset, not a nicety.** ROADMAP's "public repo readiness" and "View on Somnia
  explorer links" both depend on verified contracts so observers can read the settlement logic
  ([ROADMAP](../../../ROADMAP.md) → Spec 006 / Week 3).
- **The acceptance test "raw medical note is never present in calldata"** ([ROADMAP](../../../ROADMAP.md) → Spec 001) is
  written and enforced *with this toolchain* — a Foundry/Hardhat assertion over the transaction calldata, run on a
  local node (`npx hardhat test` / `forge test`), so the no-PHI-on-chain rule is checked here, in tests, before anything
  is deployed.
- **Forking is the deterministic substrate for the `tdd-test-writer` → `implementer` loop.** A pinned-block
  [fork](../GLOSSARY.md#f) of Shannon testnet lets `ClaimSettlement.sol` tests call the *real* deployed
  [DIA price feed](oracles-and-vrf.md) for SOMI↔USD settlement instead of a hand-rolled mock, while `evm_snapshot`/
  `evm_revert` reset state between negotiation-state-machine cases and `evm_setNextBlockTimestamp` exercises any
  claim-expiry transitions — and `hardhat_impersonateAccount` lets a test act as the payer/provider agent addresses
  without funding EOAs (the off-chain analogue of [account abstraction](account-abstraction.md)). Pinning `FORK_BLOCK_*`
  keeps CI runs reproducible ([local-testing guide](https://docs.somnia.network/developer/development-frameworks/local-testing-and-forking.md)).
- **The audit checklist is the rubric for our `security-auditor` subagent.** This repo already runs a
  [`security-auditor`](../../../../AGENTS.md) gate (no-PHI-on-chain, signing-key hygiene); Somnia's
  [audit checklist](https://docs.somnia.network/developer/security/audit-checklist.md) gives it a concrete,
  citable contract-level rubric — reentrancy, access control, unbounded loops, plus the mandatory Slither/Mythril/Solhint
  pass whose High/Critical findings block deployment. The checklist's "emit an Event on every critical state change"
  requirement is the same property our audit timeline depends on.
- **The settlement transfer uses the native-coin primitives, wrapped in pull-payment.** `ClaimSettlement.sol` receives a
  payer-agent deposit through a `payable` function (`msg.value`) and releases it to the provider agent — the
  [native SOMI/STT](https://docs.somnia.network/developer/building-dapps/tokens-and-nfts/using-native-somi-stt.md)
  primitives, since the settlement token is the native coin and **"No ERC20 functions are needed."** But the *release*
  side does **not** use the intro page's naive `payable(payee).transfer(...)` push; it follows the
  [pull-payment model](../GLOSSARY.md#p) + [reentrancy guard](../GLOSSARY.md#r) from the security-101 layer above (the
  owed agent withdraws). On [Shannon testnet](../GLOSSARY.md#s) the same code moves faucet **STT**, so the demo settles
  real value with no real money at stake. Per-transfer cost is the [tokenomics & gas](tokenomics-and-gas.md) schedule's
  concern; the no-PHI rule is unaffected — `msg.value` is an amount, never clinical text.
- **V1 directly inherits two security-101 patterns.** `ClaimSettlement.sol` moves (simulated) settlement funds, so the
  **[pull-payment model](../GLOSSARY.md#p) + a [reentrancy guard](../GLOSSARY.md#r) on the release path** are the
  concrete shape of the [CEI](../GLOSSARY.md#c) requirement we already cite — the agent who is owed funds withdraws,
  rather than settlement pushing an external call it could be re-entered through. And the **agent-identity registry** is
  precisely an access-control surface: payer / provider / owner are an OpenZeppelin `AccessControl` role hierarchy, not
  bespoke `require(msg.sender == …)` checks, which keeps the "only the assigned agent may counter or agree" rule both
  auditable and event-logged for the timeline ([security 101](https://docs.somnia.network/developer/security/smart-contract-security-101.md)).
- **Node/infra security is the `security-auditor`'s "signing-key hygiene" gate.** Curie's agents are headless Node
  processes holding signing keys, so the [node/infra security](https://docs.somnia.network/developer/security/node-infra-security.md)
  layer — keys in `.env` (never committed) or a [secrets manager](../GLOSSARY.md#s), a [key-rotation](../GLOSSARY.md#k)
  schedule, hardware wallets / [multisig](../GLOSSARY.md#m) for high-value keys, and **log redaction** — is the citable
  rubric for the `security-auditor` gate already named in [`AGENTS.md`](../../../../AGENTS.md). **Curie sharpens one rule:**
  upstream's *"sensitive information like private keys and API secrets [must] never [be] exposed in logs"* extends, for
  us, to **PHI** — the off-chain agent reads the medical note, so its logs must redact patient data exactly as strictly
  as a private key. The no-PHI-**on-chain** rule has an off-chain twin — **no-PHI-in-logs** — and upstream's redaction
  discipline is its concrete home ([node/infra security](https://docs.somnia.network/developer/security/node-infra-security.md)).
- **One RPC endpoint is a shared bottleneck in the multi-claim demo.** ROADMAP's Week 3 polish wants to "show Somnia
  speed: multiple claims negotiated/anchored quickly" with "an event listener that updates UI live"
  ([ROADMAP](../../../ROADMAP.md) → Week 3). That load profile — several headless agent processes writing plus a live
  WebSocket listener reading, all against the *same* endpoint — is exactly when a public RPC's rate limit can throttle
  the burst the demo is trying to show off. The default is the canonical `api.infra.testnet` endpoint; the documented
  fallback is a third-party provider, and Validation Cloud's "scale tier that never imposes rate limits" is the one
  upstream explicitly markets as unthrottled
  ([ecosystem: RPC](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/rpc.md)).
  Because the swap is a one-line `--rpc-url` / transport change, this stays a fallback we reach for only if a dry-run
  trips throttling — not a Week 1 decision.
- **Go-live before the demo, not after.** `ClaimSettlement.sol` moves (simulated) settlement funds, so the
  [go-live checklist](https://docs.somnia.network/developer/deployment-and-production/go-live-checklist.md) items —
  a `pause()` escape hatch, multisig-gated admin roles, no test keys in allowlists, secrets kept out of git — apply even
  to a Shannon-testnet demo. They reinforce ROADMAP's "test on testnet first" and "verified contracts" readiness bars
  ([ROADMAP](../../../ROADMAP.md) → Week 1 / Spec 006).

**PHI boundary.** The toolchain only ever touches contract source, ABIs, addresses, and test fixtures — never patient
data. Synthetic demo IDs and hashes are the *only* claim-related values that reach calldata, per the
[ROADMAP](../../../ROADMAP.md) on-chain/off-chain split. **A fork copies on-chain state only** — hashes, addresses,
balances, contract code — so forking inherits the same guarantee: there is no PHI on-chain to copy in the first place.
The same boundary makes the **third-party RPC** choice above PHI-safe: a provider relaying our transactions sees only
the calldata that exists, which is hash/address/amount-only — using Ankr or Validation Cloud instead of the canonical
endpoint exposes no patient data, because none was ever in the request to relay.

## Open questions (for the research loop)

1. ~~**Which RPC URL do we actually deploy against?**~~ *Resolved 2026-05-20:* deploy against the network-info
   endpoint `https://api.infra.testnet.somnia.network/`; the tutorials' `dream-rpc`/`devnet` strings are stale (see the
   resolved note above). *(The `50311` vs `50312` chain-ID question is likewise resolved — testnet is `50312`,
   confirmed by two upstream pages; see the chain-ID note above.)*
2. **Foundry or Hardhat as the canonical contract harness?** Both are first-class upstream; the repo should pick one for
   `contracts/` to keep CI simple. (Hardhat-with-viem matches the TypeScript stack; Foundry tests run faster.)
4. **Do the agents submit via `realtime_sendRawTransaction` or the standard `eth_sendRawTransaction` + poll?** The
   Somnia-specific submit-and-wait method removes the inter-turn poll loop (above), but ties our submission code to
   Somnia rather than portable EVM tooling. Worth measuring the actual latency saving against
   [our gas/finality model](../../../research/somnia/finality-tps-and-gas-model.md) before adopting it — a lever for the
   live multi-claim demo, not a Week 1 decision.
3. ~~**Testnet vs mainnet verifier URL.**~~ *Resolved 2026-05-21:* the testnet verifier endpoint is
   `https://shannon-explorer.somnia.network/api` at `chainId 50312`, confirmed by the Hardhat guide's `customChains`
   entry (re-fetched live); the verify guide's `…w3us.site` endpoint at `chainId 5031` is the **mainnet** one. Our demo
   deploys to Shannon testnet, so use the `shannon-explorer` API. See the verification section above.

## Source caveat

Commands, config snippets, the Solidity version (`0.8.28`), and the verifier mechanics above are quoted from
AI-summarised fetches of the cited upstream pages. **Re-verified live 2026-05-21:** the Foundry guide still prints
`dream-rpc.somnia.network` (RPC) and `devnet.somnia.network/` (faucet) — neither appears in
[network-info](https://docs.somnia.network/developer/network-info.md), so prefer the network table for live values; the
Hardhat guide still pins `0.8.28`, uses Ignition, `apiKey: "empty"`, and `chainId 50312` with the testnet
`shannon-explorer.somnia.network/api` verifier; the verify guide remains Blockscout-based with the mainnet
`w3us.site` endpoint and recommends Standard JSON Input. The **local-testing & forking** content (commands, the `.env`
example, the `evm_*`/`hardhat_*` cheatcodes, chain IDs `31337`/`50312`/`5031`) was fetched live **2026-05-21** from the
[local-testing-and-forking guide](https://docs.somnia.network/developer/development-frameworks/local-testing-and-forking.md);
note its `.env` repeats the stale `dream-rpc.somnia.network` testnet RPC — prefer the network-info endpoint.
**Re-verified live 2026-05-23** (first re-check since the 2026-05-21 capture; sharpened soft-404 rule, real body
confirmed): the seven cheatcodes, chain ID `31337`, `http://127.0.0.1:8545`, and the purpose quote all **match verbatim
— un-drifted**; the fork commands were corrected from a simplified paraphrase to upstream's exact
`${FORK_BLOCK_TESTNET:+--fork-block-number $FORK_BLOCK_TESTNET}` block-pin form (see header note). One attribution
clarified: the guide's worked fork commands are **Anvil** + **`hardhat node`** — it carries **no `forge test` command**,
so the article's "Foundry's equivalent is `forge test`" is general Foundry guidance, not a quote from this page. The
**audit + go-live** content was fetched live on
**2026-05-21** from the [audit checklist](https://docs.somnia.network/developer/security/audit-checklist.md),
[security overview](https://docs.somnia.network/developer/security.md), and
[go-live checklist](https://docs.somnia.network/developer/deployment-and-production/go-live-checklist.md); quoted phrases
are verbatim, the checklist *items* are summarised. The **security-101 patterns** content (the three vulnerability
classes, the CEI / reentrancy-guard / pull-payment / role-hierarchy mitigations, the OpenZeppelin and tool
recommendations, the SWC/Consensys links, and the "local/Remix only, NOT real funds on mainnet" rail) was fetched live
**2026-05-21** from the
[smart-contract security 101](https://docs.somnia.network/developer/security/smart-contract-security-101.md) page;
the `swcregistry.io` and `consensys.github.io` links are upstream's own external references, not Somnia pages.
**Re-verified live 2026-05-23** (first re-check since the 2026-05-21 capture; sharpened soft-404 rule, real body
confirmed): the audit checklist, security overview, and security-101 all render real content and **match verbatim —
un-drifted** across every load-bearing fact above, **except** the audit-checklist events item — quoted here until this
run as `"all critical state changes must emit an appropriate Event"`, it actually reads
`"All critical state changes and value transfers must emit an appropriate Event"` upstream; the dropped **"and value
transfers"** (a paraphrase passing as verbatim) was restored, and is V1-relevant since `ClaimSettlement.sol`'s settlement
send is a value transfer. (One summarised-fetch nuance *not* asserted, since a summarising fetch cannot reliably support
a negative: security-101's returned tool list was Slither + MythX + Securify + Manticore — possibly without the
checklist's Mythril/Solhint — so the prose "names the same static-analysis tools the checklist mandates" may slightly
overstate the overlap; re-read the page directly before relying on its exact tool roster.)
The **node/infra security** content (the `.env` / `.gitignore` conventions and split env files, the AWS Secrets Manager
and Winston references, `Wallet.createRandom()` key generation, the 90-day rotation example, the `maxRetries = 3` /
`2^attempt × 1000` ms backoff and 20% gas buffer, the IP-allowlisting note, the 10-item Security Checklist, and the
"private keys … never exposed in logs" quote) was fetched live **2026-05-22** from the
[node/infra security](https://docs.somnia.network/developer/security/node-infra-security.md) page (real content, not a
GitBook soft-404); the page's `.env` example uses Ankr's `rpc.ankr.com/somnia_testnet/<key>` endpoint (a third RPC form,
flagged above) and publishes no chain IDs. The PHI-in-logs extension is Curie's own application of the page's redaction
rule, not an upstream claim.
The **responsible-disclosure** content (the `developers@somnia.network` email / Discord "Bug Reports" / Telegram report
channels, the *"reply within 24 hours"* acknowledgement target, the *"not face any penalties and will be publicly
recognized"* safe-harbour line, the *"formal bounty system is not yet live"* note, and the three prohibitions plus the
*"test … on Shannon Testnet, not on Mainnet"* rule) was fetched live **2026-05-22** from the
[responsible-disclosure policy](https://docs.somnia.network/developer/security/responsible-disclosure-policy.md) page
(real content, not a GitBook soft-404 — it names Somnia Network, Shannon Testnet, the Somnia bridge contract, and
`developers@somnia.network`); quoted phrases are verbatim. The "no PHI in a bug report" point is Curie's own extension of
its no-PHI rule, not an upstream claim. With this, **all four** of upstream's security layers are woven into this article.
The **testnet-first workflow** content (the "Treat Testnet as your safe playground… Every project should pass through
Testnet before moving to Mainnet," "Start on Testnet," and "Audit before launch" quotes, plus the "final and
irreversible" mainnet framing and the STT-faucet note) was fetched live **2026-05-22** from the
[network overview (mainnet vs testnet)](https://docs.somnia.network/developer/network-info/network-overview-mainnet-testnet.md)
page (real content, not a GitBook soft-404); quoted phrases are verbatim. **The page is purely qualitative** — it
publishes no block time, finality-in-ms, TPS, or gas figure and no chain ID or RPC URL — so it neither feeds the residual
finality/throughput research gaps nor conflicts with the network-info table; recorded so future loops do not re-triage it
as a candidate source for those numbers.
The **GUI deploy-path** content (Remix's "Injected Provider - MetaMask" + manual approval, Solidity `^0.8.22`; the
Thirdweb `npx thirdweb deploy -k …` CLI-plus-browser flow, Solidity `^0.8.28`, Devnet) was fetched live **2026-05-21**
from the [Remix](https://docs.somnia.network/developer/development-frameworks/deploy-with-remixide.md) and
[Thirdweb](https://docs.somnia.network/developer/development-frameworks/deploy-with-thirdweb.md) guides; the
[deploying-smart-contracts](https://docs.somnia.network/developer/development-frameworks/deploying-smart-contracts.md)
landing page rendered as a content-less stub, and the full-slug `…/gasless-transactions-with-thirdweb.md` returned
GitBook's "Page Not Found" body (the truncated `…-with-thirdw.md` is canonical) — both flagged above.
The [developer how-to-guides index](https://docs.somnia.network/developer/how-to-guides.md) was fetched live
**2026-05-22** (real content — an index/landing page, not a GitBook soft-404) and **triaged out, not woven**: it is a
curated DevRel hub linking only pages already covered in this folder (Foundry/Hardhat/Remix deploy, viem, native
SOMI/STT, the DAO example, oracles, subgraphs, Thirdweb/Privy wallets), introducing **no new V1 primitive** — recorded
here so the loop stops re-triaging it (the on-ramps/mission/conclusion precedent). It contributes two citable facts: (1)
**independent corroboration of the canonical truncated slug** — upstream's own how-to index links
`account-abstraction/gasless-transactions-with-thirdw.md` (the truncated `…-with-thirdw.md`), not the full
`…-with-thirdweb.md` that soft-404s, strengthening the slug flag above from "the full slug 404s" to "and the curated
index uses the truncated one." (2) **A contact-email discrepancy — now reconciled to `.network` (2026-05-22).** The
how-to index gives DevRel contact `developers@somnia.foundation` (with Discord `#dev-chat` / `@emreyeth`), whereas the
[responsible-disclosure policy](https://docs.somnia.network/developer/security/responsible-disclosure-policy.md) above
gives `developers@somnia.network` — a `.foundation` vs `.network` split. A tiebreaker fetch resolved it: the
[developer FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs.md)
(same support-and-community section) gives **`developers@somnia.network`** *"Include your project description and GitHub
profile"* — and, decisively, pairs it with the **exact same** `#dev-chat` Discord / `@emreyeth` Telegram block the
how-to index pairs with `.foundation`. So the canonical contact block uses `.network`; `.foundation` is corroborated
**2-to-1** (responsible-disclosure + developer-FAQ vs. the how-to index alone) and is best read as the outlier/typo on
the index page. (The sibling [general FAQ](https://docs.somnia.network/developer/deployment-and-production/support-and-community/general-faqs.md)
publishes **no** email — Discord/GitHub only — so it neither adds nor subtracts.) **V1 takeaway:** Curie's
disclosure-posture template uses `developers@somnia.network`; still confirm the live address with Somnia before relying
on it for a real report, and do not assume the two aliases route to the same inbox. No chain ID, RPC URL, or gas
figure on the page; no new glossary term (a vendor/DevRel index, not a V1 concept).
The **third-party RPC providers** content (Ankr, Public Node, Stakely, Validation Cloud, their endpoint URLs, the
"fast, free, and privacy-first" / "50 million compute units … without a credit card" / "scale tier that never imposes
rate limits" quotes, and the absence of any named default or per-provider rate-limit figure for Ankr/Stakely) was
fetched live **2026-05-22** from the
[ecosystem: RPC](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/rpc.md)
page (real content, not a soft-404). Provider endpoint URLs are off-domain and were **not** independently load-tested.
The **Somnia-specific JSON-RPC methods** content (`realtime_sendRawTransaction`, `somnia_reactivityGetSubscriptions` /
`somnia_reactivityGetSubscriptionInfo`, `somnia_getSessionAddress` / `somnia_sendSessionTransaction`,
`somnia_getStatistics`; the `eth_subscribe` no-`newPendingTransactions` and EIP-4844-type-`0x3`-unsupported caveats; and
the hex chain IDs `0x13a7` / `0xc488`) was fetched live **2026-05-22** from the
[JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api.md) page (real content, not a GitBook soft-404 — it
carries the full `eth_*`/`somnia_*` method tables and the endpoint/chain-ID table). **Method names are verbatim; the
one-line behaviours are summarised** from that fetch, not quoted — re-read the page for exact request/response shapes
before wiring `realtime_sendRawTransaction` into agent submission code. The "latency lever for a sequential agent loop"
framing is Curie's own application, not an upstream claim.
The **native value-transfer primitives** content (the `payToAccess` `payable`/`msg.value` example, the
`receive() external payable` pattern, the `payable(owner).transfer(address(this).balance)` send, the "similar to ETH on
Ethereum" and "No ERC20 functions are needed" quotes) was fetched live **2026-05-22** from the
[using native SOMI/STT](https://docs.somnia.network/developer/building-dapps/tokens-and-nfts/using-native-somi-stt.md)
page (real content, not a GitBook soft-404 — it carries the worked `payToAccess`/tip-jar Solidity); the page names no
chain ID, no RPC URL, and no gas figure. **The page presents `.transfer()` as a direct push with no security commentary**
— the pull-payment / reentrancy-guard composition for the *release* path is Curie's own application of the security-101
layer above, **not** an instruction from this intro page; do not read it as endorsing a naive push for a fund-release
function. Re-read the upstream framework and security guides for exact, current
addresses and flags before deploying; upstream is authoritative, and where its own pages diverge the network-info
table wins.
