# SPEC-0003: V1 — functional, chain-connected app (identity, party contracts, wallets, direct Somnia)

Status: Draft · Owner: tspugh · Date: 2026-05-27 · Builds on: [SPEC-0001](0001-mvp0-coverage-negotiation.md), [SPEC-0002](0002-demo-experience-and-integration-seam.md)

> **Scope & relation to prior specs.** SPEC-0001 defines the **protocol** (the
> `CoverageNegotiation` contract, necessity arbiter, deterministic cap,
> `PolicyInvalidated`, the single-shared-wallet identity model, and the
> simulated/real wallet abstraction). SPEC-0002 is the **demo/experience** layer
> (live timeline, FDA-label "gotcha", explorer verifiability, the **mocked**
> CDS-Hooks seam) — it adds *no* new on-chain behavior. **SPEC-0003 is the
> *functional + integration* layer of V1**: it makes the app genuinely multi-party
> and chain-connected. It adds (a) a **user/identity registry**, (b) **contracts
> between specific registered parties**, (c) **real wallet management** (connect /
> select / switch beyond SPEC-0001's single shared wallet), and (d) **direct,
> live, end-to-end Somnia wiring** (real native-agent execution + fee funding +
> event-driven status) as a first-class mode alongside SPEC-0001's simulated mode.
> SPEC-0003 **extends** SPEC-0001's contract surface (a registry contract + a
> party-selection front-door to `createContract`); it does not change the
> adjudication semantics. Every quantitative/technical claim is sourced inline;
> raw Context7 findings live in
> [`docs/research/somnia-v1-integration-findings.md`](../research/somnia-v1-integration-findings.md).

## 1. Summary & user story

V1 turns the MVP0 single-wallet demo into a **real, multi-party, chain-connected
application**: people and organizations **register** (profile ⇄ wallet address),
a provider **picks a specific registered insurer** (and vice versa) from that
registry to open a contract against, users **connect and switch real wallets**
(injected / cross-app, multiple accounts, read-only vs signing), and the whole
coverage-exception flow runs **directly against Somnia testnet** — real
`createRequest` native-agent execution, real fee funding, and **live
event-driven** status — not a simulated backend.

> As a **provider**, I want to register my practice, connect my wallet, find a
> specific insurer in the directory, and file a coverage-exception **to that
> insurer** — and watch the on-chain agent rule it live — so the negotiation is a
> real transaction between two identified parties, not a self-play demo.
>
> As an **insurer**, I want to register, be discoverable, and only engage
> contracts **addressed to me**, signing with the wallet I choose, so my
> participation and every ruling are attributable and auditable on-chain.

## 2. Requirements

> Numbering continues SPEC-0001's intent but is **local to SPEC-0003**. Each
> requirement notes how it layers on SPEC-0001/0002.

### (a) User / identity registry

- **R1 (MUST — registry of parties).** The app MUST let a person/organization
  **register a profile** (display name, role ∈ {provider, insurer}, optional
  metadata hash) **bound to a wallet address**, and MUST resolve **address ⇄
  profile** both ways for display and selection. **No PHI** in any registry field
  (names/roles/org identifiers only; SPEC-0001 R4 invariant holds).
- **R2 (MUST — on-chain registry is the system of record).** The
  address⇄profile⇄role mapping MUST be recorded **on-chain** in a dedicated
  registry contract (system of record per CLAUDE.md "chain-native first"); any
  off-chain directory is a cache/index of it, never authoritative. Registry
  reads MUST be public (consistent with SPEC-0001 R11 "reads stay public").
- **R3 (MUST — no Somnia-native name service assumed).** Because the queried
  Somnia docs expose **no ENS-style on-chain naming primitive** (only wallet auth,
  `somnia_getSessionAddress` session keys, and the agent `AgentRegistry`/`agentId`
  for *agents*) ([JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api);
  [research note §4](../research/somnia-v1-integration-findings.md)), the
  human-readable name layer MUST be **app-owned** (the registry contract), not a
  chain-provided directory. Human-readable names map to addresses via the registry.
- **R4 (SHOULD — role gating from the registry).** Contract actions SHOULD be
  validatable against a party's **registered role** (a provider-registered address
  cannot engage as an insurer), tightening SPEC-0001 R11's address-only gating.

### (b) Contracts between particular registered users

- **R5 (MUST — pick a specific counterparty).** When filing, a provider MUST be
  able to **select a specific registered insurer** from the registry (and the
  insurer side MUST see only contracts **addressed to its registered address**).
  This feeds directly into SPEC-0001 `createContract(providerId, insurerId,
  providerAddr, insurerAddr, …)` — SPEC-0003 supplies the *party-selection
  front-door*; SPEC-0001's signature and guards are unchanged.
- **R6 (MUST — addressed engagement).** `insurerEngage` (SPEC-0001) MUST remain
  callable only by the **named insurer address**; SPEC-0003 adds that the named
  insurer MUST be a **registered** address (R2) so engagement is between two
  known, discoverable parties.
- **R7 (SHOULD — consent / invitation).** The app SHOULD support an explicit
  **invitation/consent** step: the selected insurer is notified of an addressed
  contract (via the event stream / their inbox view) and may engage or decline;
  declining maps to SPEC-0001's existing terminal handling (no new on-chain state
  — a non-engaging insurer is handled by the keeper/withdraw path, SPEC-0001 §8 OQ3).
- **R8 (MUST — directory-driven UX).** Overview/Create (SPEC-0001 R16) MUST show
  counterparties by **profile name** resolved from the registry, not raw hex
  addresses, while still exposing the address for verification.

### (c) Clear wallet management

- **R9 (MUST — connect a real wallet).** The app MUST let a user **connect an
  injected wallet** (`window.ethereum` → `eth_requestAccounts`, viem
  `createWalletClient({ chain, transport: custom(window.ethereum) })`)
  ([MetaMask auth](https://docs.somnia.network/developer/building-dapps/wallet-integration-and-auth/authenticating-with-metamask)),
  superseding SPEC-0001's single hard-wired shared wallet for real mode.
- **R10 (MUST — multiple accounts + active-signer switching).** The app MUST
  surface **multiple available accounts** and let the user **switch the active
  signer**; the active signer determines `msg.sender` for every write and is shown
  in the UI alongside profile + mode (extends SPEC-0001 R12's "shows active
  wallet + profile + mode"). Switching accounts MUST re-resolve the active profile
  via the registry (R2).
- **R11 (MUST — read-only vs signing).** The app MUST support a **read-only**
  (observer) state where the chain is fully **readable** (public reads, SPEC-0001
  R11; SPEC-0002 R6 observer) with **no connected signer**, and all write actions
  are disabled until a signer connects. This is the production form of SPEC-0002's
  observer role.
- **R12 (SHOULD — cross-app / WalletConnect-style connect).** The app SHOULD
  support a cross-app account connector (e.g. Privy `useCrossAppAccounts`,
  `sendTransaction(txn, { address })` with `chainId: 50312`)
  ([Privy auth](https://docs.somnia.network/developer/building-dapps/wallet-integration-and-auth/authenticating-with-privy))
  as an alternative to injected, behind the same signer interface.
- **R13 (MUST — one signer interface, three sources).** Injected, cross-app, and
  the SPEC-0001 **simulated** signer MUST sit behind **one signer interface**
  (SPEC-0001 R14's "one signer interface, two impls" generalized to N sources),
  so contract-interaction code is identical regardless of wallet source.
- **R14 (MUST — wrong network handling).** The app MUST detect chain mismatch and
  prompt/switch to **Somnia testnet (chain 50312)**
  ([Developer FAQs](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs))
  before allowing a write.

### (d) Direct Somnia API connection (real mode end-to-end)

- **R15 (MUST — direct RPC, real mode).** In real mode the app MUST talk
  **directly to Somnia** — no simulated backend in the write/read path: writes via
  signed `eth_sendRawTransaction` (Legacy/Access-list/Dynamic-fee/Set-code supported;
  Blob unsupported) ([JSON-RPC API → Transaction Types](https://docs.somnia.network/developer/json-rpc-api));
  reads via `eth_call`; history via `eth_getLogs`
  ([JSON-RPC API → eth_getLogs](https://docs.somnia.network/developer/json-rpc-api)).
  Testnet config: chain **50312**, RPC **`https://dream-rpc.somnia.network`**
  ([Developer FAQs](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs);
  [chain config](https://docs.somnia.network/developer/data-streams/tutorials/build-your-first-schema)).
- **R16 (MUST — live event-driven status).** Status MUST update from **live
  subscriptions over WebSocket** (`eth_subscribe`; supported topics `newHeads`,
  `logs`, and Somnia's `somnia_finishedTransactions` / `somnia_watch` —
  `eth_subscribe` errors over HTTP and `newPendingTransactions` is unsupported)
  ([JSON-RPC API → eth_subscribe / Somnia vs Ethereum](https://docs.somnia.network/developer/json-rpc-api)),
  using a viem WebSocket public client (e.g. `@somnia-chain/reactivity`
  `sdk.watch(...)`)
  ([Reactivity off-chain](https://docs.somnia.network/developer/reactivity/reactivity-offchain)).
  This realizes SPEC-0001 R17 and powers SPEC-0002's live timeline against the
  real chain.
- **R17 (MUST — real native-agent execution).** `requestAdjudication` MUST fire
  the **real native Somnia agent** via the platform `IAgentRequester.createRequest`
  and receive the ruling via the contract's `handleResponse`
  (`IAgentRequesterHandler`) — the SPEC-0001 R9 path, now actually executed on
  testnet. The agent `agentId` (JSON API / LLM Inference / LLM Parse Website per
  source type, SPEC-0001 R10) MUST be pinned from the agents web app
  ([from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity);
  [base-agents](https://docs.somnia.network/agents/base-agents/llm-parse-website)).
- **R18 (MUST — correct fee funding).** Adjudication MUST fund the request as
  `deposit = getRequestDeposit() + perAgentReward * subcommitteeSize` (default
  subcommittee **3**), not the floor alone (floor-only is accepted by the contract
  but **runners skip** when `perAgentBudget < scheduledExecutionCost`)
  ([Gas Fees](https://docs.somnia.network/agents/invoking-agents/gas-fees)).
  Per-agent reward MUST be taken from the published table (e.g. JSON API ≈
  **0.03 ether**, LLM Inference ≈ **0.07 ether**, per-agent, STT on testnet)
  ([Gas Fees](https://docs.somnia.network/agents/invoking-agents/gas-fees)).
  The connected signer (R9–R13) MUST hold enough **STT** to cover the deposit; the
  app MUST surface the required amount and the wallet balance before firing.
- **R19 (MUST — terminal/timeout handling from real responses).** The app MUST
  handle the real `ResponseStatus` set `None|Pending|Success|Failed|TimedOut`
  ([from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)):
  `Failed`/`TimedOut` route to SPEC-0001's retriable `EvidenceRequested`/keeper
  path (R9), and the off-chain **receipt** (`Response.receipt` pointer →
  receipts service by `requestId`) is surfaced for the SPEC-0002 verifiability
  affordance ([Receipts](https://docs.somnia.network/agents/invoking-agents/receipts);
  `docs/documentation/agents-receipts.md`).
- **R20 (SHOULD — parity).** The same UI and contract-interaction code MUST run in
  **simulated** and **real** modes (SPEC-0001 R14); only the signer source and the
  agent execution differ. Real mode is selectable at runtime; **no secrets/keys in
  the static bundle** (SPEC-0001 R18 / SPEC-0002) — the signer is supplied at
  runtime by the connected wallet.

## 3. Technical documentation

### How SPEC-0003 layers on SPEC-0001 / SPEC-0002

- **Contract surface added:** one new **`PartyRegistry`** contract; the existing
  `CoverageNegotiation` (SPEC-0001) is **unchanged** except an optional guard that
  consults the registry for role checks (R4/R6). No change to adjudication, the
  deterministic cap, `PolicyInvalidated`, or the state machine.
- **UI added:** a **Register** view + a **Directory/counterparty-picker** in Create
  + a **Wallet connector** (connect / accounts / switch / read-only) layered on
  SPEC-0001's Overview/Create/Maintain and SPEC-0002's live timeline/gotcha.
- **Mode:** SPEC-0003 makes **real mode** the integration target; SPEC-0002's demo
  continues to run in simulated mode for funds-free judging.

### `PartyRegistry` contract (new; Hardhat, Somnia testnet 50312)

- **Purpose:** authoritative address⇄profile⇄role directory (R2). No PHI (R1).
- **State:** `mapping(address => Party)` where
  `Party { string displayName; Role role; bytes32 metadataHash; bool active; }`,
  `Role { None, Provider, Insurer }`; plus an enumerable index for listing.
- **Functions (sketch):**
  - `register(string displayName, Role role, bytes32 metadataHash)` — `msg.sender`
    self-registers; re-register updates own record.
  - `setActive(bool)` — soft-enable/disable own listing.
  - Views: `partyOf(address) → Party`, `isRole(address, Role) → bool`,
    `list(offset, limit) → address[]` (directory paging), `count()`.
- **Events:** `PartyRegistered(addr, role, displayName)`, `PartyUpdated(addr)`,
  `PartyDeactivated(addr)`.
- **Guards:** self-only writes (`msg.sender` is the subject); public reads (R2).
- `CoverageNegotiation` integration: `createContract`/`insurerEngage` MAY call
  `registry.isRole(addr, …)` to enforce R4/R6 (the registry address is set at
  deploy). Naming resolution for the UI is `registry.partyOf(addr).displayName`.

### Identity options & tradeoffs (decision context for §8)

| Option | What it is | Pros | Cons |
|---|---|---|---|
| **On-chain `PartyRegistry`** (chosen, R2) | App-owned mapping contract | Chain-native system of record; public, auditable; role gating; no external dep | We maintain it; a gas cost to register |
| Off-chain directory only | DB/JSON of addresses→names | Cheap, flexible | Not authoritative; trust/centralization; violates "chain-native first" |
| ENS-style name service | A Somnia-native naming primitive | Human-readable, portable | **Not found** in queried Somnia docs ([research §4](../research/somnia-v1-integration-findings.md)); can't assume it |
| Session keys (`somnia_getSessionAddress`) | Derived session-key addresses for delegated signing ([JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api)) | Native; good for UX (fewer prompts) | Signing/UX primitive, **not** a profile/role directory — complementary, not a substitute |
| Agent `AgentRegistry`/`agentId` | Registry of *agents* (the arbiter) | Native to the agent platform | Identifies **agents**, not human parties — orthogonal |

> Decision (this spec): **on-chain `PartyRegistry`** as system of record, with an
> optional off-chain cache for fast directory search; session keys are a candidate
> signing-UX enhancement (deferred); no dependency on a name service that doesn't exist.

### Wallet abstraction (generalized signer interface)

One `Signer` interface; sources: **injected** (MetaMask, `window.ethereum` +
viem `custom(...)` transport)
([MetaMask auth](https://docs.somnia.network/developer/building-dapps/wallet-integration-and-auth/authenticating-with-metamask)),
**cross-app** (Privy `useCrossAppAccounts.sendTransaction(txn, { address })`,
`chainId: 50312`)
([Privy auth](https://docs.somnia.network/developer/building-dapps/wallet-integration-and-auth/authenticating-with-privy)),
and **simulated** (SPEC-0001). The connector tracks: connected status,
account list, active account, network, and read-only flag. A **read-only**
public client (HTTP `eth_call` / `eth_getLogs`) always exists; a **wallet client**
exists only when a signer is connected (R11). Network guard enforces 50312 (R14).

### Direct Somnia wiring (real mode)

- **Clients:** read-only **HTTP public client** (`eth_call`, `eth_getLogs`); **WS
  public client** for `eth_subscribe`/`somnia_watch` live status (subscriptions are
  **WS-only**) ([JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api)).
  Docs recommend HTTP for tx execution, WS for subscriptions
  ([Data Streams ∩ Reactivity](https://docs.somnia.network/developer/data-streams/concepts/intersection-with-somnia-reactivity)).
- **Write path:** signer signs → `eth_sendRawTransaction` (or Somnia's
  `realtime_sendRawTransaction` which waits for the receipt)
  ([JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api)).
- **Agent path:** `CoverageNegotiation.requestAdjudication` →
  `IAgentRequester.createRequest{value: deposit}(agentId, address(this),
  this.handleResponse.selector, payload)`; platform → `handleResponse(...)`; ruling
  decoded; `RequestFinalized`/`Ruled` events drive the live timeline
  ([from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)).
- **Fee funding:** `deposit = getRequestDeposit() + perAgentReward * 3` (R18)
  ([Gas Fees](https://docs.somnia.network/agents/invoking-agents/gas-fees)).
- **Network params (testnet):** chain **50312**, RPC `https://dream-rpc.somnia.network`,
  currency **STT**, WS for subscriptions
  ([Developer FAQs](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs)).
  *(SPEC-0001 §3 records a different testnet RPC host — see §8 OQ1.)*

## 4. Deliverables

- `contracts/PartyRegistry.sol` (Hardhat) + tests + deploy script (50312); optional
  `CoverageNegotiation` guard hook consulting the registry (R4/R6).
- `src/registry/` — typed registry client (read/write, address⇄profile resolution,
  directory listing/cache).
- `src/wallet/` (extends SPEC-0001) — generalized `Signer` interface with **injected**,
  **cross-app**, and **simulated** sources; account list + active-signer switching;
  read-only public client; network guard (50312).
- `src/somnia/` — direct RPC wiring: HTTP public client (`eth_call`/`eth_getLogs`),
  WS subscription client (`eth_subscribe`/`somnia_watch`), tx submission, agent
  fee-funding helper (`getRequestDeposit() + reward*subcommittee`), receipt fetch.
- **Web app additions:** **Register** view; **Directory/counterparty-picker** in
  Create; **Wallet connector** UI (connect / accounts / switch / read-only / network);
  counterparties shown by profile name (R8); live status from WS subscriptions.
- Fixtures/config: pinned `agentId`(s) per source type; `.env.example` with testnet
  RPC + WS + deployed registry/negotiation addresses (no secrets baked in).
- Research note: [`docs/research/somnia-v1-integration-findings.md`](../research/somnia-v1-integration-findings.md) (raw Context7 findings).

## 5. Test cases

- **T1 (R1,R2,R3):** `register` records profile+role on-chain; `partyOf`/`isRole`
  resolve both ways; reads are public; **no PHI** in any registry field; the app
  uses the registry (not a fabricated name service) for resolution.
- **T2 (R4,R6):** an address registered as `Provider` cannot `insurerEngage`; the
  named insurer must be registered; role guard reverts otherwise.
- **T3 (R5,R8):** Create lists registered insurers by name; selecting one populates
  `createContract(..., insurerAddr, …)`; the insurer sees only contracts addressed
  to its address; raw address still inspectable.
- **T4 (R7):** an addressed-but-unengaged contract appears in the insurer's inbox;
  decline/timeout follows SPEC-0001's terminal/keeper path (no new on-chain state).
- **T5 (R9,R10,R11,R13,R14):** connect injected wallet; multiple accounts listed;
  switching the active signer changes `msg.sender` and re-resolves the profile;
  read-only state reads fully but disables writes; wrong-network is detected and
  prompts a switch to 50312.
- **T6 (R12):** cross-app connector signs a tx with `chainId: 50312` behind the same
  `Signer` interface.
- **T7 (R15,R16):** real mode reads via `eth_call`/`eth_getLogs` and updates status
  from a **WS** `eth_subscribe`/`somnia_watch` stream; an `eth_subscribe` attempt
  over HTTP is handled as unsupported.
- **T8 (R17,R18):** `requestAdjudication` on testnet funds
  `getRequestDeposit() + reward*3`, fires `createRequest`, and a real ruling returns
  via `handleResponse`; a **floor-only** deposit is shown to risk being skipped by
  runners; insufficient STT is blocked pre-fire with the required amount surfaced.
- **T9 (R19):** `Failed`/`TimedOut` responses route to the retriable path; the
  off-chain receipt resolves by `requestId` for the verifiability affordance.
- **T10 (R20):** the same UI + contract-interaction code path runs in simulated and
  real modes; no secrets/keys in the built bundle.

## 6. Pass / fail criteria

**PASS — all must hold:**
- [ ] `PartyRegistry` compiles, tests pass, deploys to Somnia testnet (50312); it is
      the **on-chain system of record** for address⇄profile⇄role with public reads (R1–R3).
- [ ] T1–T4: registration, role gating, name-resolved directory, addressed
      engagement, and the consent/inbox path all work; no PHI in the registry.
- [ ] T5–T6: a user can **connect a real wallet**, see/switch multiple accounts, use a
      **read-only** mode, and is forced onto chain 50312 before writing — all behind
      one `Signer` interface (injected + cross-app + simulated).
- [ ] T7–T9: **real mode** runs end-to-end directly against Somnia — reads via
      `eth_call`/`eth_getLogs`, **live WS** status, a **real native-agent ruling** via
      `createRequest`→`handleResponse`, funded `getRequestDeposit() + reward*subcommittee`,
      with receipts retrievable and `Failed`/`TimedOut` handled.
- [ ] T10: simulated and real modes share one code path; no secrets/PHI in the bundle.
- [ ] SPEC-0001 adjudication semantics and SPEC-0002 demo behavior are unchanged.

**FAIL — any triggers rejection:**
- Any PHI in the registry, or on-chain/in an agent payload (SPEC-0001 R4 invariant).
- The registry is off-chain-only / not authoritative, or a non-existent name service
  is assumed as a dependency.
- A provider can engage as an insurer, or a contract can target an unregistered/wrong
  address without reverting.
- Real mode routes reads/writes through a simulated backend; status is poll-only with
  no live subscription; or `eth_subscribe` is attempted over HTTP as the live path.
- Adjudication funds **floor only** (runners skip), or fires with insufficient STT
  without surfacing the required amount.
- A signer source bypasses the common `Signer` interface; or a secret/key ships in the
  static bundle.

## 7. Out of scope

- **Changing SPEC-0001 adjudication** (necessity arbiter, deterministic cap,
  `PolicyInvalidated`, state machine) — SPEC-0003 only adds registry + party-selection
  + wallet/real-mode wiring.
- **Real token settlement / escrow transfer** — still a marker (SPEC-0001 §7); R18
  funds the *agent fee*, not claim settlement.
- **Real CDS-Hooks / CMS-0057-F integration** — remains SPEC-0002's mock seam.
- **KYC / verified-identity attestation** beyond self-registration; reputation; org
  hierarchies/sub-accounts; multi-tenant theming.
- **Session-key delegated signing UX** (`somnia_getSessionAddress`) — candidate
  enhancement, deferred (§8 OQ4).
- **Real-PHI de-identification / private on-chain reasoning** — SPEC-0001 §7 (a Somnia
  platform ask), unchanged.
- **Mainnet (5031 / SOMI)** — testnet only for V1.

## 8. Open questions

1. **Testnet RPC host discrepancy** — current Somnia docs give
   `https://dream-rpc.somnia.network` ([Developer FAQs](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs)),
   but SPEC-0001 §3 records `https://api.infra.testnet.somnia.network/`. Confirm the
   canonical testnet RPC (and the WS endpoint) before pinning config. — priority: high
2. **Exact agent npm/SDK surface** — SPEC-0001 names "somnia-agent-kit"; the queried
   docs expose the on-chain `IAgentRequester`/`IAgentRequesterHandler` plus off-chain
   `@somnia-chain/reactivity` / `@somnia-chain/streams` (viem-based) but no package
   literally named `somnia-agent-kit`. Confirm the real package(s)/version to depend on.
   — priority: high
3. **`agentId` + per-agent reward values** — pin the live `agentId`(s) for JSON API /
   LLM Inference / LLM Parse Website and confirm current per-agent prices (table values
   ~0.03 / ~0.07 ether are examples) and the **subcommittee size** to budget for. — priority: high
4. **Session keys for UX** — adopt `somnia_getSessionAddress` to reduce signing prompts
   during a multi-step negotiation, or keep per-action signing? — priority: medium
5. **Registry role model** — single role per address, or can one address hold both
   provider+insurer roles? Effect on R4/R6 guards. — priority: medium
6. **Consent step (R7) shape** — pure off-chain inbox/notification vs. an explicit
   on-chain `invite/accept` (would touch SPEC-0001's surface — avoid if possible). — priority: medium
7. **Cross-app connector dependency** — is Privy an acceptable V1 dependency, or
   prefer a WalletConnect v2 connector for the cross-app path (R12)? — priority: medium
8. **Fee payer in real mode** — does the firing party fund the agent deposit from their
   connected wallet, or does the contract hold a float? (ties to SPEC-0001 §8 OQ5). — priority: medium
