# Chain resource: Account Abstraction (smart-account wallets)

> **One line:** let a **smart contract act as a user's account** (ERC-4337) — or let an existing EOA delegate to
> contract code (EIP-7702) — so transactions can be **gasless / sponsored**, batched, or authorised by **session keys**,
> instead of every actor needing a pre-funded keypair.
>
> Upstream: [account abstraction](https://docs.somnia.network/developer/building-dapps/account-abstraction.md) ·
> [gasless transactions with Thirdweb](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md) ·
> [smart-wallet app with Thirdweb](https://docs.somnia.network/developer/building-dapps/account-abstraction/smart-wallet-app-with-thirdweb.md) ·
> [wallet integration & auth](https://docs.somnia.network/developer/building-dapps/wallet-integration-and-auth.md) ·
> [ecosystem: wallet providers](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/wallet-providers.md) ·
> [ecosystem: account-abstraction](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/account-abstraction.md) (Pimlico) ·
> [network-info](https://docs.somnia.network/developer/network-info.md) (EntryPoint + factory addresses). Fetched 2026-05-20 / 2026-05-21; wallet-providers + AA-ecosystem (Pimlico) pages added 2026-05-22; AA landing + both Thirdweb tutorials re-verified 2026-05-22 (un-drifted; soft-404 slug boundary re-confirmed). **High-consequence cluster (network-info AA addresses, AA landing, gasless-with-Thirdweb tutorial) re-verified live 2026-05-23** — un-drifted; soft-404 slug boundary re-confirmed; the AA-flow quote promoted to upstream's full bullet (see source caveat).
>
> Map: [chain-resources](../README.md) · Glossary: [Account Abstraction](../GLOSSARY.md#a),
> [EntryPoint](../GLOSSARY.md#e), [EOA](../GLOSSARY.md#e) · Roadmap: [`../../../ROADMAP.md`](../../../ROADMAP.md)

## For the blockchain dev: what changes vs. a normal account

On a vanilla EVM chain there are two account types: an **EOA** (controlled by one private key, must hold native token to
pay gas) and a **contract account** (no key, can't initiate transactions). Account Abstraction (AA) collapses the
distinction: your "wallet" becomes a **smart contract** that defines its own rules for *who can authorise a transaction*
and *who pays for it*. Somnia implements this with **"ERC-4337-style flows"** — upstream's full capability bullet reads
*"Implement user operations via ERC-4337-style flows"*
([account abstraction](https://docs.somnia.network/developer/building-dapps/account-abstraction.md)).

In ERC-4337 you don't send a normal transaction; you send a **`UserOperation`** to a singleton **EntryPoint** contract,
which validates it against your smart account and executes it. On Somnia the relevant deployed pieces
(from [network-info](https://docs.somnia.network/developer/network-info.md), fetched 2026-05-20) are:

| Contract | Address | Network |
|---|---|---|
| EntryPoint **v0.7** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Testnet (Shannon) |
| Account factory | `0x4bE0ddfebcA9A5A4a617dee4DeCe99E7c862dceb` | Testnet (Shannon) |

> **Copy these in their exact casing.** Both addresses above are quoted in **EIP-55 checksummed** form — the mixed-case
> hex letters encode a checksum (derived from the keccak-256 hash of the lowercase address), so most tooling will reject
> a mistyped variant. An all-lowercase address is still valid but carries *no* checksum, so a transposed character
> passes silently. The factory address was re-verified against upstream
> [network-info](https://docs.somnia.network/developer/network-info.md) on 2026-05-21 and corrected to its checksummed form.

> ⚠️ **Testnet-only today.** The mainnet rows for EntryPoint and the factory are **blank** in upstream network-info —
> the AA contracts appear deployed on **Shannon testnet** but **not yet on mainnet (`5031`)**. **Re-verified against
> [network-info](https://docs.somnia.network/developer/network-info.md) on 2026-05-21:** the testnet EntryPoint
> (`0x0000000071727De22E5E9d8BAf0edAc6f37da032`) and factory (`0x4bE0ddfebcA9A5A4a617dee4DeCe99E7c862dceb`) are
> unchanged, and both mainnet cells are still blank. V1 is built and demoed on testnet, so this is fine for the
> hackathon, but it is **not** portable to mainnet without re-checking. Flagged for human review — see
> [`GLOSSARY.md`](../GLOSSARY.md#a) → *Account Abstraction*.

The EntryPoint address `0x0000000071727De22E5E9d8BAf0edAc6f37da032` is the **canonical ERC-4337 v0.7 EntryPoint** used
across EVM chains, so existing 4337 tooling (bundler clients, account SDKs) targets it unchanged once you point them at
Somnia's [RPC endpoints](../README.md#the-chain-in-one-screen).

### Two AA paths: ERC-4337 vs. EIP-7702

The AA landing page frames account abstraction as **ERC-4337 only**, but the chain supports a **second** AA paradigm.
Somnia's EVM gas schedule explicitly prices an **EIP-7702 authorization** at `1,570,000` gas (`400,000` refunded when no
account creation is needed) — see the repricing table in
[tokenomics-and-gas.md](tokenomics-and-gas.md) and its upstream source, the
[gas-differences page](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md)
(verified 2026-05-21). A chain that prices the 7702 authorization opcode **implements EIP-7702**, so both AA paths exist
here. The contrast matters for how we'd onboard agents:

| | **ERC-4337** | **EIP-7702 (set-code-for-EOAs)** |
|---|---|---|
| What it is | A separate **smart-account contract** + `UserOperation` routed through a [bundler](../GLOSSARY.md#b) to the [EntryPoint](../GLOSSARY.md#e) | A protocol-level tx type that lets an **existing [EOA](../GLOSSARY.md#e) delegate to contract code**, keeping its address |
| New contract per actor? | Yes — deploy/derive a smart account via the factory | No — the agent's funded EOA *becomes* smart for the authorization's lifetime |
| Needs a bundler? | Yes — but Thirdweb's is **managed** (`sponsorGas: true`, no endpoint to host); see below | No |
| Somnia status | EntryPoint v0.7 + factory **on testnet only** (table above) | Authorization **priced in the EVM**; no documented dev workflow or tooling |

For our multi-agent loop the appeal of EIP-7702 is concrete: each agent already runs as a funded EOA in
`somnia-agent-kit` ([`../../somnia-agent-kit/`](../../somnia-agent-kit/)), and 7702 would let that **same address** gain
batching/sponsorship **without deploying a per-agent 4337 account or finding a bundler** — sidestepping open questions 1
and 3 below. ⚠️ But this is **chain capability, not a paved path**: upstream documents no EIP-7702 tooling, SDK helper,
or example, so treat it as a researched option, not a V1 plan. The **PHI boundary is identical** either way — 7702
changes only how a transaction is authorised, never its payload.

### The Thirdweb paved path: `sponsorGas: true` (resolves the bundler/paymaster gap)

The AA *landing* page names Thirdweb as tooling but shows no code, which is why open questions 1 (paymaster) and 3
(bundler) were left flagged. A dedicated tutorial —
[gasless transactions with Thirdweb](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md)
(fetched 2026-05-21) — fills that gap and **largely answers both for the managed path**: you do **not** find or host a
bundler/paymaster endpoint at all. Thirdweb runs that infrastructure for you, and you opt in with a single config flag:

```typescript
import { SmartWalletOptions, inAppWallet } from 'thirdweb/wallets';
import { somniaTestnet } from 'thirdweb/chains';

// Thirdweb Account Factory on Somnia — see the cross-check note below
const FACTORY_ADDRESS = '0x4be0ddfebca9a5a4a617dee4dece99e7c862dceb';

// For a connected EOA (MetaMask, etc.): wrap it in a sponsored smart account
export const accountAbstraction: SmartWalletOptions = {
  chain: somniaTestnet,
  sponsorGas: true,            // ← enables gasless (paymaster-sponsored) transactions
};

// For email/social login: an in-app wallet backed by the same smart account + factory
export const wallets = [
  inAppWallet({
    smartAccount: { chain: somniaTestnet, sponsorGas: true, factoryAddress: FACTORY_ADDRESS },
  }),
];
```

So the answers, for the **Thirdweb-managed** path
([source](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md)):

- **Bundler (open question 3):** there is no endpoint to point a 4337 client at — Thirdweb's hosted bundler is implicit
  in the SDK, credentialed by a **Thirdweb client ID** (`NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, from the
  [Thirdweb dashboard](https://thirdweb.com/dashboard/settings)).
- **Paymaster (open question 1):** `sponsorGas: true` routes the `UserOperation` through Thirdweb's sponsorship — no
  paymaster address to deploy or discover for the demo. Sponsorship policy is configured in the dashboard, not on-chain.

> ✅ **Factory address cross-confirmed (2026-05-21).** The tutorial's `FACTORY_ADDRESS`,
> `0x4be0ddfebca9a5a4a617dee4dece99e7c862dceb`, is **the same address** (case-insensitively) as the "Account factory"
> row in [network-info](https://docs.somnia.network/developer/network-info.md) —
> `0x4bE0ddfebcA9A5A4a617dee4DeCe99E7c862dceb` (table above). So network-info's unlabelled factory **is the Thirdweb
> Account Factory**: two upstream pages agree on one deployed contract. (The tutorial quotes it all-lowercase, i.e.
> **not** [EIP-55](../GLOSSARY.md#e)-checksummed — use the checksummed network-info form in code.)

> ⚠️ **This is the React-SDK path, not our headless signer.** The tutorial is a Next.js / `thirdweb/react` app
> (`ConnectButton`, `TransactionButton`, `useActiveAccount`, `ThirdwebProvider`) where a *human* connects a wallet. Our
> provider/payer agents are **headless Node processes** holding a key in `somnia-agent-kit`, with no React lifecycle, so
> the open question that **remains** is whether the same `sponsorGas: true` smart account is reachable from Thirdweb's
> server-side SDK for an autonomous signer (open question 4 below — narrowed from "which provider?" to "does the managed
> sponsorship work without a browser wallet?"). The PHI boundary is unchanged: sponsorship touches only gas, never payload.

> ⚠️ **Truncated upstream slug — flagged.** The canonical URL is `…/gasless-transactions-with-thirdw.md` (truncated at
> "thirdw"); the intuitive `…-with-thirdweb.md` returns a GitBook soft-404 served with HTTP `200`. Cite the truncated
> slug; a status-code-only link check would not catch the difference. The
> [smart-wallet-app-with-thirdweb](https://docs.somnia.network/developer/building-dapps/account-abstraction/smart-wallet-app-with-thirdweb.md)
> companion tutorial resolves normally.
>
> ✅ **Companion tutorial read — confirms no headless path (2026-05-21).** The
> [smart-wallet-app-with-thirdweb](https://docs.somnia.network/developer/building-dapps/account-abstraction/smart-wallet-app-with-thirdweb.md)
> tutorial was fetched and is **also a pure browser/React flow** — `<ConnectButton>`, `useActiveAccount()`, and a
> `<ThirdwebProvider>` wrapper, with the token transfer issued by `sendTransaction({ ..., chain: somniaTestnet, client })`
> against the connected wallet. It mentions **no Thirdweb Engine, no server wallet, and no private-key/backend signer**,
> and (unlike the gasless tutorial, which imports `somniaTestnet` from `thirdweb/chains`) it imports `somniaTestnet`
> from `viem/chain`. So **both** of upstream's Thirdweb AA tutorials are browser-only — see open question 4. ⚠️ It is a
> **third occurrence** of the stale `dream-rpc.somnia.network` testnet RPC (`NEXT_PUBLIC_SOMNIA_RPC_URL`) already flagged
> elsewhere; use the canonical `api.infra.testnet` endpoint from [the chain in one screen](../README.md#the-chain-in-one-screen).

### The Pimlico path: an infrastructure-layer provider whose canonical flow is headless (narrows open question 4)

Every AA provider above is a **wallet-UI / embedded-wallet** layer — Thirdweb's `thirdweb/react`, Privy, Sequence — and
each documented flow is a *browser* one where a human connects a wallet. A fourth, **categorically different**, provider
is named on a separate ecosystem listing,
[ecosystem: account-abstraction](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/account-abstraction.md)
(fetched 2026-05-22, confirmed real content — not a GitBook soft-404): **Pimlico**, described verbatim as *"the world's
most advanced ERC-4337 account abstraction infrastructure platform."* Pimlico is not a wallet UI — it is the
**[bundler](../GLOSSARY.md#b) + [paymaster](../GLOSSARY.md#p) infrastructure** layer itself, the actual endpoints a 4337
client points at.

That distinction is what makes it the first upstream pointer toward a **headless** path. The Somnia page's only Resources
link is to Pimlico's own [*"Send your first gasless transaction"* tutorial](https://docs.pimlico.io/guides/tutorials/tutorial-1)
— and following that **official outbound link** (permitted because `docs.somnia.network` links to it directly), the
tutorial is a **headless Node / TypeScript** flow: it imports `permissionless.js` + `viem`, signs with a **local
`privateKeyToAccount(privateKey)`** from an env var (no browser wallet, no `ConnectButton`), and points a
`smartAccountClient` (a `toSafeSmartAccount`) at Pimlico's **bundler+paymaster RPC endpoint directly**
(`https://api.pimlico.io/v2/<chain>/rpc?apikey=…`). That is exactly the shape **open question 4** asked for — a sponsored
smart account driven by an autonomous, server-side signer rather than a human-connected wallet.

> ✅ **Somnia endpoint confirmed (2026-05-22) — open question 4 now closed for the documented-path test.** The prior
> caveat said a Pimlico **Somnia** bundler was "unconfirmed from these two pages and must be verified against Pimlico's
> own supported-chains list before relying on it." That check has now been done: Pimlico's
> [supported-chains list](https://docs.pimlico.io/guides/supported-chains) (off-domain, fetched twice and confirmed
> verbatim 2026-05-22) lists **both** Somnia networks — **"Somnia Mainnet"** (chain ID **`5031`**, endpoint slug
> **`somnia`**) and **"Somnia Testnet"** (chain ID **`50312`**, slug **`somnia-testnet`**) — each marked supported for
> **EntryPoint v0.6 and v0.7** (v0.8 ❌). So the bundler+paymaster RPC the headless tutorial points at exists for Somnia:
> the Shannon-testnet endpoint is **`https://api.pimlico.io/v2/somnia-testnet/rpc?apikey=…`** (equivalently `…/v2/50312/rpc`),
> mainnet **`…/v2/somnia/rpc`** (`…/v2/5031/rpc`). Two corroborations fall out: Pimlico's **`5031`/`50312`** independently
> agree with [network-info](https://docs.somnia.network/developer/network-info.md) (and re-refute the agent-kit's stale
> `50311`), and Pimlico's **v0.7** support matches the **EntryPoint v0.7** Somnia's network-info publishes. **Two honest
> caveats remain.** (a) This is sourced from `docs.pimlico.io`, **off the `docs.somnia.network` domain** — cite it as a
> page Somnia links out to (the ecosystem AA page → Pimlico's tutorial → Pimlico's own supported-chains list), not as a
> Somnia-published fact; the *Somnia* docs still show no Pimlico endpoint themselves. (b) "Supported chain + headless
> paradigm" is the *documented-path* test; an actual sponsored `UserOperation` over Somnia has **not** been run here, so
> latency, paymaster-policy setup, and any Somnia-specific quirk stay for the implementation branch, not this glossary
> loop. The PHI boundary is unchanged: a bundler/paymaster only ever relays gas + a `UserOperation` carrying
> hash/state/address/amount calldata, never payload.

## For the AI engineer: why this matters for agents

Your mental model of "an agent" is a process holding an API key. On-chain, the analogue is a process holding a
**private key (EOA)** that must be **pre-funded with native token** before it can do anything — every signer is a wallet
you have to top up and babysit. That is operational friction multiplied by however many agents you run.

AA removes the friction in three ways the docs call out
([account abstraction](https://docs.somnia.network/developer/building-dapps/account-abstraction.md)):

- **Gasless / sponsored transactions** — "Enable sponsored and gasless transactions." A paymaster (a sponsor contract)
  can pay gas on the agent's behalf, so an agent's smart account does not need its own native-token balance to act.
- **Session keys** — scoped, expiring keys "for improved user experience." Think of it as a **least-privilege API token**
  for on-chain actions: a session key can be limited to specific functions for a limited time, so an automated agent
  signs with a narrow, revocable credential instead of the account's root key.
- **Smart-account onboarding** — "Create and manage smart contract wallets" and "Simplify onboarding through smart
  wallets and relayers." Documented tooling: **Thirdweb** and **Privy**
  ([account abstraction](https://docs.somnia.network/developer/building-dapps/account-abstraction.md)); the broader
  [wallet-integration page](https://docs.somnia.network/developer/building-dapps/wallet-integration-and-auth.md)
  documents **Privy**, **RainbowKit**, and **ConnectKit** for the human-facing connect/auth flow.

> **Three upstream pages name providers, and they don't agree — read them as a union, not a canon.** A third roster, the
> [ecosystem: wallet-providers](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/wallet-providers.md)
> listing (fetched 2026-05-22, confirmed real content — not a GitBook soft-404), names **Privy**, **Sequence**, and
> **Thirdweb**. The only provider not already in this article is **[Sequence](https://sequence.build/)** — described
> verbatim as a "Smart contract wallet & account abstraction provider that enables gasless transactions and seamless user
> onboarding to dApps." That makes Sequence a **third documented AA provider** alongside the Thirdweb-paved path and
> Privy. Note what the page does *not* give: it links only Sequence's landing page (`sequence.build`) — **no Somnia-specific
> tutorial, no code, no addresses** — so within `docs.somnia.network` Sequence is a named option, not a worked path.
> Cross-page reconciliation: Privy is the **only** provider all three rosters list; Thirdweb appears in two (AA overview +
> this ecosystem page); Sequence is **unique to the ecosystem page**; RainbowKit/ConnectKit appear only on the
> wallet-integration page (and are connect-UI kits, not AA providers). ⚠️ The ecosystem page's Thirdweb entry carries a
> **broken documentation link** flagged at fetch time — use [`thirdweb.com/somnia`](https://thirdweb.com/somnia) and the
> two Somnia Thirdweb tutorials cited above instead.

## How Curie V1 could use it

Our [demo loop](../../../ROADMAP.md) runs a **provider agent** and a **payer agent** that each sign on-chain steps —
`ClaimSubmitted`, `CodeProposalAdded`, `ClaimCountered`, `ClaimAgreed`, `ClaimSettled`
([ROADMAP event model](../../../ROADMAP.md)). Both agents are off-chain processes in our SDK
([`../../somnia-agent-kit/`](../../somnia-agent-kit/)), so by default each is backed by an **EOA that must be funded with
STT before the demo**. AA targets exactly that pain:

- **No pre-funding choreography.** With sponsored transactions, the provider and payer agents transact through smart
  accounts whose gas is paid by a paymaster — so a judge clicking **"Run negotiation"** never sees a demo stall because
  an agent EOA ran out of STT. This directly serves the ROADMAP's **"90-second path from claim submission to
  settlement"** acceptance criterion ([ROADMAP Spec 005](../../../ROADMAP.md)).
- **Session-keyed agents.** A session key scoped to just the claim-lifecycle contract functions is a cleaner story for
  the **Architecture / Privacy view** ("these agents can *only* sign claim-state transitions") than handing each agent a
  full root key.
- **Smoother agent identity.** The ROADMAP's Week-2 **agent registry** (provider/payer addresses, role enum) maps
  naturally onto smart-account addresses created by the factory.

**PHI boundary is unchanged.** AA only changes *how a transaction is authorised and paid for* — it touches signing and
gas, never payload. The same rule holds: only hashes, state, agent addresses, timestamps, and settlement amounts go
on-chain; the clinical bundle stays off-chain ([ROADMAP on-chain/off-chain split](../../../ROADMAP.md)). A sponsored
transaction carrying a claim hash is exactly as PHI-safe as a self-paid one.

### Is AA worth it for V1, or P1/P2?

It is a **convenience layer, not a requirement** — the negotiation loop works with plain funded EOAs. Given the ROADMAP
puts the agent registry at **Week 2 / P1** and gasless UX in the "feel like a protocol" tier, AA is best treated as a
**polish item**: adopt it if pre-funding EOAs becomes a demo-reliability risk, otherwise defer. The testnet-only caveat
above reinforces keeping it optional.

## Open questions (for the research loop)

1. **Paymaster availability.** ✅ *Largely resolved for the managed path (2026-05-21).* The
   [gasless-with-Thirdweb tutorial](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md)
   shows `sponsorGas: true` routes through **Thirdweb's hosted paymaster** — no on-chain paymaster address to deploy or
   discover for the demo; sponsorship policy lives in the Thirdweb dashboard, credentialed by a client ID. (No
   *standalone/native* Somnia paymaster address is published; that remains absent from
   [network-info](https://docs.somnia.network/developer/network-info.md) and the
   [AA overview](https://docs.somnia.network/developer/building-dapps/account-abstraction.md) — only the managed Thirdweb
   route is documented.)
2. **Mainnet timeline.** When do EntryPoint v0.7 + factory land on mainnet (`5031`)? Blank in network-info today.
3. **[Bundler](../GLOSSARY.md#b).** ✅ *Resolved for the managed path (2026-05-21).* There is **no endpoint to point a
   4337 client at** — Thirdweb's bundler is implicit in the SDK and enabled by `sponsorGas: true`
   ([gasless tutorial](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md)).
   Somnia still publishes no *public, provider-neutral* bundler endpoint, so a non-Thirdweb 4337 client would need a
   self-hosted or Privy bundler.
4. **Headless server-side sponsorship.** ⚠️ *Confirmed gap — not answered upstream (2026-05-21).* "Thirdweb vs. Privy" is
   no longer the open part — the documented path is clearly **Thirdweb `sponsorGas`**. The remaining question is whether
   the same sponsored smart account can be driven from a **server-side SDK** by `somnia-agent-kit`'s autonomous, headless
   signer (no `ConnectButton`). Having now read **both** Thirdweb AA tutorials —
   [gasless](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md)
   and [smart-wallet-app](https://docs.somnia.network/developer/building-dapps/account-abstraction/smart-wallet-app-with-thirdweb.md) —
   the answer is that `docs.somnia.network` documents **no headless path at all**: both are browser/`thirdweb/react` flows
   where a *human* connects a wallet; neither mentions Thirdweb Engine, a server wallet, or a private-key backend signer.
   So this is a genuine **research gap, not an unread page** — resolving it means going outside the Somnia docs (e.g.
   Thirdweb's own server-wallet/Engine docs) and is escalated for the research loop, not this glossary loop.
   **A third candidate surfaced (2026-05-22):** the
   [ecosystem wallet-providers page](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/wallet-providers.md)
   names **[Sequence](https://sequence.build/)** as an AA provider supporting gasless transactions. Whether Sequence offers
   the server-side/relayer signer Thirdweb's documented path lacks is **exactly the kind of question this research gap
   covers** — but it cannot be answered from `docs.somnia.network`, which links only Sequence's landing page (no Somnia
   tutorial, code, or addresses). So Sequence widens the *set of providers to evaluate off-docs* (Thirdweb Engine vs.
   Privy vs. Sequence) without narrowing the gap from within the Somnia docs.
   **Narrowed (2026-05-22):** a *fourth*, **infrastructure-layer** provider — **Pimlico** — is named on the
   [ecosystem: account-abstraction](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/account-abstraction.md)
   page, and the [tutorial Somnia links to](https://docs.pimlico.io/guides/tutorials/tutorial-1) **is** a headless
   Node / `permissionless.js` / `viem` / `privateKeyToAccount` flow hitting bundler+paymaster RPC directly — the exact
   shape this question asked for (see the *Pimlico path* subsection above). This is the **first** upstream pointer to a
   headless flow, so the gap is no longer "no headless path is documented anywhere Somnia points to."
   **✅ Closed for the documented-path test (2026-05-22).** The one residual sub-task — "verify a Somnia Pimlico endpoint
   exists" — has now been checked against [Pimlico's supported-chains list](https://docs.pimlico.io/guides/supported-chains)
   (off-domain, fetched twice, verbatim): it lists **Somnia Mainnet** (`5031`, slug `somnia`) and **Somnia Testnet**
   (`50312`, slug `somnia-testnet`), both supporting **EntryPoint v0.6/v0.7**. So a headless `permissionless.js` agent can
   point a `smartAccountClient` at `https://api.pimlico.io/v2/somnia-testnet/rpc?apikey=…` today — the headless
   server-side sponsorship path is **documented and chain-deployed**, not just a paradigm. What remains is
   **implementation-branch**, not glossary-loop, work: run an actual sponsored `UserOperation` over Shannon, measure
   latency/policy setup, and benchmark Pimlico-sponsored-4337 against the simpler **EIP-7702 "same-EOA"** alternative
   (which needs no bundler at all). PHI boundary unchanged (bundler/paymaster relays gas + hash/state/address/amount
   calldata only).

## Source caveat

Contract addresses are quoted verbatim from an AI-summarised fetch of
[network-info](https://docs.somnia.network/developer/network-info.md) (2026-05-20); the feature list is from the
[account-abstraction overview](https://docs.somnia.network/developer/building-dapps/account-abstraction.md), which is a
landing page light on code; the human-facing connect-kit names are from
[wallet-integration & auth](https://docs.somnia.network/developer/building-dapps/wallet-integration-and-auth.md).
**All three cited pages were re-fetched and verified live on 2026-05-21** — the AA contract set is unchanged
(EntryPoint + factory addresses unchanged, chain IDs `5031`/`50312` unchanged, still no paymaster/bundler, mainnet AA
still blank); the AA overview still lists exactly the four capability bullets and **Thirdweb** + **Privy** as tooling;
and the wallet-integration page still names exactly **Privy**, **RainbowKit**, and **ConnectKit**.
**AA *integration* cluster re-verified 2026-05-22** (the stalest high-consequence surface left after the
2026-05-22 connection-table run re-verified the EntryPoint/factory addresses via network-info): the AA overview still
renders the *"ERC-4337-style flows"* and *"Account Abstraction bridges the gap between Web2 simplicity and Web3
ownership"* lines and still publishes **no** on-page address/chain-ID/RPC; the gasless tutorial (truncated slug, below)
still renders `FACTORY_ADDRESS 0x4be0ddfebca9a5a4a617dee4dece99e7c862dceb`, `sponsorGas: true` (×2), and the
`NEXT_PUBLIC_THIRDWEB_CLIENT_ID` prerequisite; the companion smart-wallet tutorial still imports `somniaTestnet` from
`viem/chain`, is still browser-only, and still prints the stale `dream-rpc` RPC. **The fragile soft-404 boundary still
holds:** the full `…-with-thirdweb.md` slug re-confirmed a GitBook *"does not exist"* body 2026-05-22, so the truncated
`…-with-thirdw.md` stays canonical. No figure or slug drifted. Before wiring AA into the demo, re-read the provider-specific subpages (Thirdweb / Privy) and re-confirm
the EntryPoint, factory, and any paymaster addresses against upstream — they are testnet values and may change pre-GA.
**AA cluster re-verified live 2026-05-23** — this article was the **last in the folder still entirely on a 2026-05-22
check** (every sibling article already carried a 2026-05-23 re-verification). The three highest-consequence pages were
re-fetched under the **sharpened soft-404 rule** (real body, not just HTTP `200`) and are **un-drifted**:
[network-info](https://docs.somnia.network/developer/network-info.md) still publishes the testnet EntryPoint v0.7
`0x0000000071727De22E5E9d8BAf0edAc6f37da032` + factory `0x4be0ddfebca9a5a4a617dee4dece99e7c862dceb` with **both mainnet
cells still blank** and chain IDs `5031`/`50312` unchanged (Multicall3 addresses also matched the connection table); the
[AA overview](https://docs.somnia.network/developer/building-dapps/account-abstraction.md) still renders the four
capability bullets and **Thirdweb + Privy** as tooling, with no on-page address/chain-ID/RPC; and the gasless tutorial
(truncated slug) still renders `FACTORY_ADDRESS 0x4be0ddfebca9a5a4a617dee4dece99e7c862dceb`, `sponsorGas: true`, the
`NEXT_PUBLIC_THIRDWEB_CLIENT_ID` prerequisite, and the `thirdweb/chains` import. The **soft-404 boundary held again**:
the full `…-with-thirdweb.md` slug returned GitBook's verbatim *"The URL … does not exist. This page may have been moved,
renamed, or deleted."* on 2026-05-23, so the truncated `…-with-thirdw.md` remains canonical and a status-code-only link
check stays unsafe here. **One paraphrase promoted to upstream verbatim** (the recent runs' paraphrase-to-verbatim
discipline): the body had quoted only the fragment *"ERC-4337-style flows"*, where upstream's full bullet reads
*"Implement user operations via ERC-4337-style flows"* — now folded into the *what changes vs. a normal account* section.
No figure, slug, or chain ID drifted; no new flag; PHI boundary unaffected (AA touches signing and gas, never payload).
The **EIP-7702** evidence is the authorization gas line on the
[gas-differences page](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum.md)
(verified 2026-05-21); the AA overview page documents no 7702 workflow, so chain support is sourced but a dev path is not.
The **gasless `sponsorGas` path** (factory address, client-ID prerequisite, no bundler/paymaster endpoint) is from the
[gasless-with-Thirdweb tutorial](https://docs.somnia.network/developer/building-dapps/account-abstraction/gasless-transactions-with-thirdw.md),
whose body was fetched 2026-05-21 and re-verified 2026-05-22 at the **truncated** canonical slug `…-with-thirdw.md`
(the `…-with-thirdweb.md` form soft-404s under HTTP `200` — re-confirmed 2026-05-22); the React-only-flow caveat is a
property of that tutorial, not a Somnia limitation. The
companion [smart-wallet-app-with-thirdweb](https://docs.somnia.network/developer/building-dapps/account-abstraction/smart-wallet-app-with-thirdweb.md)
tutorial was also fetched 2026-05-21 (re-verified 2026-05-22) and is likewise browser-only (no Engine/server-wallet/private-key path), which is
why open question 4 is recorded as a confirmed gap rather than an unread page; it repeats the stale
`dream-rpc.somnia.network` RPC, so prefer the canonical `api.infra.testnet` endpoint. The **three-provider roster**
(Privy / Sequence / Thirdweb) and the **Sequence** entry (description, `sequence.build` landing link, no Somnia-specific
code) are quoted from the
[ecosystem: wallet-providers](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/wallet-providers.md)
page, fetched and confirmed real content (not a GitBook soft-404) on 2026-05-22; that page's Thirdweb entry carries a
broken documentation link, flagged inline. The **Pimlico** entry (description verbatim, "infrastructure platform") is
from the separate
[ecosystem: account-abstraction](https://docs.somnia.network/developer/deployment-and-production/ecosystem/ecosystem-tools/account-abstraction.md)
page, fetched and confirmed real content on 2026-05-22; its only Resources link is to Pimlico's own
[tutorial](https://docs.pimlico.io/guides/tutorials/tutorial-1), which is **off-domain** (`docs.pimlico.io`) and was
fetched only because `docs.somnia.network` links to it directly — the headless `permissionless.js`/`viem`/`privateKeyToAccount`
flow and the `…/v2/sepolia/rpc` (Sepolia) endpoint are properties of that off-domain tutorial, not a Somnia-published
fact. The **Somnia-endpoint confirmation** that closed open question 4 is from Pimlico's
[supported-chains list](https://docs.pimlico.io/guides/supported-chains) — also **off-domain** (`docs.pimlico.io`),
followed for the same reason — fetched **twice** on 2026-05-22 with the Somnia rows quoted verbatim and identical across
both fetches: **Somnia Mainnet** (`5031`, slug `somnia`) and **Somnia Testnet** (`50312`, slug `somnia-testnet`), each
supporting EntryPoint v0.6/v0.7 (v0.8 not). Those chain IDs and the v0.7 EntryPoint independently agree with
[network-info](https://docs.somnia.network/developer/network-info.md); the constructed `…/v2/somnia-testnet/rpc`
endpoint follows Pimlico's documented `…/v2/{slug}/rpc` shape but has not been exercised against Somnia here. Upstream
(`docs.somnia.network`) is authoritative; the two `docs.pimlico.io` pages are cited only as the path Somnia points out to.
