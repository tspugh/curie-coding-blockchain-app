# Somnia V1 integration findings (Context7)

> Raw findings gathered for **SPEC-0003** via the Context7 MCP against the library
> `/websites/somnia_network` on 2026-05-27. These are research notes (options +
> citations), not hard API reference — promoted facts land in SPEC-0003 §3 and in
> `docs/documentation/` when copied verbatim. Confirm field names against the live
> docs before relying on them.

## 1. JSON-RPC API & network config

- **Testnet:** Chain ID **50312**, RPC **`https://dream-rpc.somnia.network`**, currency **STT**.
  WebSocket for subscriptions. ([Developer FAQs → Environment Setup](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs);
  [Build your first schema → chain config](https://docs.somnia.network/developer/data-streams/tutorials/build-your-first-schema))
  - **Discrepancy to resolve:** SPEC-0001 §3 records the testnet RPC as
    `https://api.infra.testnet.somnia.network/`. Current docs give
    `https://dream-rpc.somnia.network`. Treat the docs value as canonical until verified;
    flag in SPEC-0003 §8.
- **Mainnet (reference only):** Chain ID **5031**, RPC `https://api.infra.mainnet.somnia.network`,
  WS `wss://api.infra.mainnet.somnia.network/ws`, currency **SOMI**.
  ([Developer FAQs](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs);
  [Filtered subscriptions tutorial](https://docs.somnia.network/developer/reactivity/tutorials/off-chain-reactivity-filtered-subscriptions-tutorial))
- **Reads:** standard `eth_call`; **event history:** `eth_getLogs` (filter `fromBlock`/`toBlock`/`address`/`topics`).
  ([JSON-RPC API → eth_getLogs](https://docs.somnia.network/developer/json-rpc-api))
- **Live subscriptions:** `eth_subscribe` — **WebSocket only** (over HTTP it errors).
  Supported topics: `newHeads`, `logs`, plus Somnia extensions `somnia_finishedTransactions`,
  `somnia_finishedBlocks`, `somnia_watch`. Somnia does **not** support `newPendingTransactions`.
  ([JSON-RPC API → eth_subscribe](https://docs.somnia.network/developer/json-rpc-api))
- **`somnia_watch`:** a Somnia subscription that combines a log filter with per-event
  `eth_calls` (simulated view calls), e.g. watch `Transfer` + re-read `balanceOf` for each
  recipient. ([Reactivity (off-chain)](https://docs.somnia.network/developer/reactivity/reactivity-offchain))
- **Sending txs:** `eth_sendRawTransaction` supports Legacy (0x0), Access-list (0x1),
  Dynamic-fee (0x2), and Set-code (0x4, EOA delegation via `authorizationList`); Blob (0x3)
  not supported. **`realtime_sendRawTransaction`** is a Somnia extension that submits and
  **waits for the receipt**. ([JSON-RPC API → Transaction Types / Somnia vs Ethereum](https://docs.somnia.network/developer/json-rpc-api))
- **Hex encoding** follows Ethereum conventions (`0x`-prefixed). ([JSON-RPC API → Notes](https://docs.somnia.network/developer/json-rpc-api))

## 2. Native agent request/callback model (the "somnia-agent-kit" on-chain surface)

- The on-chain platform contract implements **`IAgentRequester`**; the requesting contract
  implements **`IAgentRequesterHandler`** (`handleResponse(requestId, responses, status, details)`).
  ([Invoking agents → from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity))
- **createRequest** (payable, sends budget upfront):
  `createRequest(agentId, callbackAddress, callbackSelector, payload) returns (requestId)`.
  Advanced variant adds `subcommitteeSize, threshold, consensusType, timeout`.
- **Deposit helpers:** `getRequestDeposit()` (floor for the default subcommittee) and
  `getAdvancedRequestDeposit(subcommitteeSize)`. ([from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity))
- **Fee/funding pattern (gas-fees page):** a floor-only deposit satisfies the contract but
  runners skip the request if `perAgentBudget < scheduledExecutionCost`. Correct funding is
  `deposit = getRequestDeposit() + perAgentReward * subcommitteeSize` (default subcommittee = 3).
  Per-agent prices are listed in a table, e.g. **JSON API fetch ≈ 0.03 ether**, **LLM Inference ≈ 0.07 ether**
  (per-agent; STT on testnet). ([Invoking agents → Gas Fees](https://docs.somnia.network/agents/invoking-agents/gas-fees))
- **ResponseStatus:** `None(0) | Pending(1) | Success(2) | Failed(3) | TimedOut(4)`. The
  `Response` struct carries `validator, result(bytes), status, receipt(uint256), timestamp, executionCost`.
- **Events on the platform contract:** `RequestCreated(requestId, agentId, perAgentBudget, payload, subcommittee)`,
  `RequestFinalized(requestId, status)`, `SubcommitteePaid`, `CommitteeDepositFailed`.
- **Runners** call `submitResponse(requestId, result, receipt, success, executionCost)` off the
  hot path; `executionCost` is capped by `perAgentBudget`; gas refunded from the operations reserve.
  ([Gas Fees](https://docs.somnia.network/agents/invoking-agents/gas-fees))
- **Results vs receipts:** *results* reach validator **consensus**; *receipts* are per-node
  subjective logs, retrievable off-chain by `requestId` (testnet/mainnet receipt endpoints; the
  on-chain `Response.receipt` is a `uint256` pointer). ([Receipts](https://docs.somnia.network/agents/invoking-agents/receipts);
  see also `docs/documentation/agents-receipts.md`)
- **Base agent types** referenced: **JSON API Request**, **LLM Inference**, **LLM Parse Website**
  (structured-output schema). `agentId` is obtained from the agents web app and pinned as a contract
  constant. ([base-agents/llm-parse-website](https://docs.somnia.network/agents/base-agents/llm-parse-website);
  PriceOracle example, [from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity))

## 3. Off-chain SDK / event subscription (TypeScript)

- **`@somnia-chain/reactivity`** — `new SDK({ public: createPublicClient({ chain, transport: webSocket() }) })`
  then `sdk.watch({ eventContractSources, topicOverrides, ethCalls, context, onlyPushChanges, onData, onError })`,
  returning a subscription with `unsubscribe()`. WebSocket transport required for subscriptions.
  ([Reactivity off-chain](https://docs.somnia.network/developer/reactivity/reactivity-offchain);
  [Filtered subscriptions tutorial](https://docs.somnia.network/developer/reactivity/tutorials/off-chain-reactivity-filtered-subscriptions-tutorial))
- **`@somnia-chain/streams`** — `new SDK({ public, wallet })`; `sdk.streams.subscribe({ ethCalls, onData })`
  decodes logs + simulated view results via viem `decodeEventLog` / `decodeFunctionResult`. **Use WS for
  subscriptions, HTTP for tx execution.** ([Data Streams ∩ Reactivity](https://docs.somnia.network/developer/data-streams/concepts/intersection-with-somnia-reactivity))
- Both use **viem** clients (`createPublicClient`/`createWalletClient`, `defineChain`).
  (No package literally named `somnia-agent-kit` surfaced in the docs index queried; the agent
  surface is the on-chain `IAgentRequester`/`IAgentRequesterHandler` + the off-chain reactivity/streams
  SDKs. SPEC-0001 refers to the abstraction as "somnia-agent-kit"; treat that as the project's name
  for this combined surface and verify the exact npm package before pinning — see SPEC-0003 §8.)

## 4. Wallet integration & identity primitives

- **MetaMask (injected):** `window.ethereum.request({ method: "eth_requestAccounts" })` then a viem
  `createWalletClient({ chain, transport: custom(window.ethereum) })`; read accounts via
  `getAddresses()`. ([Authenticating with MetaMask](https://docs.somnia.network/developer/building-dapps/wallet-integration-and-auth/authenticating-with-metamask))
- **Privy / cross-app accounts:** `useCrossAppAccounts().sendTransaction(txn, { address })` with
  `chainId: 50312`. ([Authenticating with Privy](https://docs.somnia.network/developer/building-dapps/wallet-integration-and-auth/authenticating-with-privy))
- **Session keys:** `somnia_getSessionAddress(seed)` derives a session-key address from a 32-byte
  seed — a Somnia-native primitive for delegated/session signing. ([JSON-RPC API](https://docs.somnia.network/developer/json-rpc-api))
- **No ENS-style on-chain name service** surfaced in the queried docs. **Implication for the user
  registry (SPEC-0003 (a)):** there is no Somnia-native human-readable name primitive to lean on;
  the registry must be an **app-owned on-chain registry contract** (address ⇄ profile/role) and/or an
  **off-chain directory**, not a chain-provided naming service. Session keys + Privy/MetaMask cover
  signing identity; profile/role/discovery is the app's responsibility.
