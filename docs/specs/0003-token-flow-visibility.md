# SPEC-0003: Token-flow visibility in the UI

Status: Draft · Owner: tspugh · Date: 2026-05-29 · Builds on: [SPEC-0001](0001-mvp0-coverage-negotiation.md), [SPEC-0002](0002-demo-experience-and-integration-seam.md)

> **Scope.** A living **design-decisions log** for the next phase of UI work, scoped to making
> the **token flow legible**: where STT is held, where it moves, and what each on-chain call
> costs. This spec grows decision-by-decision as the conversation progresses; the
> "Requirements" section is appended to (not rewritten) as decisions land. **No new
> protocol behavior** in v0 — UI/observability only.

## 1. Summary & user story

A real-mode user (provider, insurer, or operator) should be able to look at the app and
**immediately understand the money**: how much STT their signing wallet holds, what each
upcoming or completed contract call will cost (gas + value sent + agent-fee escrow), and
where each token amount flowed (in / out / locked). Today the same flows happen invisibly:
the user clicks "create" and a transaction goes out, but the cost and the resulting balance
delta are not surfaced in the UI — they have to open an explorer to reason about funds.

> As a **real-mode user driving a coverage-exception negotiation**, I want to see my **wallet
> balance** update live alongside the **per-call cost** of every contract interaction (and
> the **token flow** that resulted) — so I can tell at a glance where my STT is going, what
> the agent fee actually costs, and whether I have enough to complete the next step.

## 2. Requirements

### 2.1 (2026-05-29) Wallet balance + per-tx cost visibility (Decision 1)

- **R1 (MUST) Live wallet balance.** Surface the signer wallet's **native STT balance** in
  the app chrome, refreshed (a) on initial load, (b) after every tx the app sends, and
  (c) on a low-frequency interval poll (≤30s) while the user is on a page that can spend.
  Display the address (truncated) + balance in STT with at least 4 decimals.
- **R2 (MUST) Per-tx cost preview.** When the user is about to send a tx — initial
  `createContract`, evidence submission, accept, appeal, etc. — show the **expected total
  cost**: `value sent + (gasEstimate × gasPrice)`, broken into the two parts. For agent
  adjudication calls, value sent is the `VITE_AGENT_FEE_WEI` escrow; surface that explicitly
  with a label so it's not conflated with gas.
- **R3 (MUST) Per-tx cost realized.** After a tx confirms, replace the *preview* with the
  *realized* numbers from the receipt (`effectiveGasPrice × gasUsed` + any value transferred).
  Pin a one-line summary to the timeline (already R1 in SPEC-0002) so each round in the
  negotiation history carries its true cost.
- **R4 (MUST) Token-flow attribution.** Adjacent to the cost, name the **direction** —
  `Outbound to agent (fee escrow)`, `Outbound to contract (deposit)`, `Locked (escrowed)`,
  `Inbound (refund / settlement)`, `Burned (gas)` — so a viewer reads the page and understands
  *what happened to the money*, not just the dollar number.
- **R5 (SHOULD) Pre-flight insufficient-funds guard.** If `balance < value + gasEstimate × buffer`,
  disable the send button and show a banner with the shortfall and the funding wallet address
  (the dev wallet for this build). Don't pop a generic ethers error after the click.
- **R6 (SHOULD) Simulated-mode parity.** In simulated mode (no chain), show *modeled* numbers
  using fixed gas/fee constants so the demo flow shows the same UI affordances; tag them as
  "modeled" so a viewer doesn't mistake them for live.

> Future decisions append here as §2.N (2026-MM-DD) blocks. Don't rewrite earlier sections;
> the chronological order is the audit trail.

## 3. Technical documentation

- **Balance source:** `wallet.provider.getBalance(wallet.address)`. The web client already
  builds a `RealWallet` (`web/src/client.ts` → `src/contract/real.ts`); a thin
  `useWalletBalance(refreshKey)` React hook can call it. Bump `refreshKey` after every tx
  the client sends so the post-tx refresh is a single source of truth.
- **Cost preview:** for each method on `CoverageNegotiation`, use
  `contract.method.estimateGas(args)` + `provider.getFeeData()` to compute
  `gasEstimate × maxFeePerGas` (or `gasPrice` on legacy networks). For value-bearing calls
  (`requestAdjudication`), `value` is the agent-fee constant already in env
  (`VITE_AGENT_FEE_WEI`); render it separately so the user sees fee-vs-gas.
- **Cost realized:** from the `TransactionReceipt`: `effectiveGasPrice × gasUsed`. The receipt
  also carries logs, which we already consume for the timeline — extend the timeline row to
  carry a `cost` field.
- **Attribution rules:** keyed by contract method →
  - `requestAdjudication` → `Outbound to agent (fee escrow)` + value, plus `Burned (gas)`.
  - `createContract` (if it requires a deposit) → `Outbound to contract (deposit)` or
    `Locked (escrowed)` depending on contract semantics; otherwise `Burned (gas)` only.
  - Accept/appeal/evidence (no value) → `Burned (gas)` only.
  - `Settled` / refunds → `Inbound (refund / settlement)` on the receiving wallet.
- **Polling:** use a single shared interval (≤30s) gated on document visibility so background
  tabs don't burn RPC quota. Skip polling when in simulated mode.
- **No new env or contract changes.** Reads the existing `VITE_AGENT_FEE_WEI`, RPC, and
  contract address. Spec is observability over the existing protocol.

## 4. Deliverables (Decision 1)

- `useWalletBalance` hook + a header chip rendering `0x2040…9128 · 0.0123 STT`.
- A reusable `TxCostPreview` component (used by Create, evidence-submission, accept, appeal).
- Extension of the SPEC-0002 timeline rows with a `cost` cell + attribution label.
- An insufficient-funds banner on Create / send affordances.
- Simulated-mode parity with `(modeled)` tags.

## 5. Test cases (Decision 1)

- **T1 (R1):** with a freshly-funded dev wallet, the header chip reflects the on-chain
  balance within one poll window; after a send, the new balance appears before the next user
  click.
- **T2 (R2):** clicking "create" without sending shows a preview that decomposes into
  `value sent` + `gas` and matches what the wallet actually pays on send (within slippage).
- **T3 (R3):** the timeline row for each round carries the realized
  `effectiveGasPrice × gasUsed` and the value transferred, sourced from the receipt.
- **T4 (R4):** for `requestAdjudication`, the attribution reads "Outbound to agent (fee
  escrow)" + the gas burn — not a single opaque number.
- **T5 (R5):** with a 0-balance wallet, the Create send button is disabled and the banner
  names the shortfall.

## 6. Pass / fail criteria (Decision 1)

**PASS:** real-mode session shows balance + per-tx cost + attribution; the timeline carries
realized costs; the insufficient-funds path is blocked before signing. **FAIL:** any tx is
sent without the user being able to see its expected and realized cost from the UI alone.

## 7. Out of scope

- USD pricing of STT.
- Historical balance charting / portfolio view.
- Wallet management (rotation, multi-account) — single signer per build, as today.
- ERC-20 / non-native token flows — STT only in v0.

## 8. Open questions

- **Q1.** Does `createContract` require a deposit today, or is the only value-bearing call
  `requestAdjudication`? Confirm against the merged `CoverageNegotiation.sol` so R4
  attribution names the right "Outbound to contract" cases (or removes that label).
- **Q2.** Do we want a **funding-flow shortcut** in the UI ("send X STT from `0xdD4a…6CEA`
  to `0x2040…9128`") for the dev experience, or is that out-of-scope tooling?
