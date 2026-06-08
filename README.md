# Curie — a guide through the code

**Agent-mediated drug coverage arbitration on [Somnia](https://somnia.network).**

> New here? Read top-to-bottom — it's a ~5-minute tour of what Curie is, how to
> run it, how the demo flows, and where every piece lives in the code.

## 1. What Curie is

Curie resolves **drug coverage exceptions** between a **provider** and a **payer**
on Somnia. A provider files a request for a drug (cited public clinical evidence by
URL, plus a de-identified justification); an **autonomous LLM agent runs on-chain** —
it first *reads* the cited public evidence, then *rules* on medical necessity
(`approve` / `deny` / `needs_more_info` / `policy_invalid`); the ruling is an on-chain
state transition with a public rationale; and approved coverage **settles through
real escrow** on-chain. **No protected health information (PHI) ever touches the
chain** — clinical text, drug, justification, and policy enter only as `keccak256`
hashes, and the agent argues at the level of the drug, the formulary, and *public*
evidence, never a patient chart.

## 2. Quickstart

Requires Node ≥ 20. All commands run from the repo root.

```bash
npm install            # install deps
npm run build          # compile the TS library to dist/ (the web app imports it via the @lib alias)
```

**Run the web app in simulated mode (no wallet, no chain).** This is the default —
an in-memory mirror of the contract with a mocked agent ruling, so you can drive the
entire flow locally:

```bash
npm run web:dev        # Vite dev server (views: Overview / Create / Detail / Network / Settings)
```

**Run the web app against the live testnet contract (real mode).** Copy the example
env and set real-mode values, then build/serve. Note `VITE_*` vars are **inlined at
build time** by Vite, so set them before building:

```bash
cp .env.example .env
# in .env: VITE_WALLET_MODE=real, VITE_SOMNIA_NETWORK=testnet,
#          VITE_CONTRACT_ADDRESS=<deployed address>, and funded provider/insurer keys
npm run web:build      # static SPA -> web/dist/
npm run web:preview    # serve the built bundle on :4173
```

**Run the tests:**

```bash
npm test               # full suite: ABI shape gate + typecheck + lib tests + Hardhat contract tests
npm run test:lib       # just the TypeScript library/web unit tests (node --test over src + web/src)
npm --prefix contracts test   # just the Hardhat contract suite
```

(There is also a legacy chain smoke test: `npm run dev` runs `src/index.ts` against the
configured network.)

## 3. How the demo flows

Mirroring the app's own "How it works" strip:

> A provider files a drug-coverage request → an autonomous LLM agent reads the cited
> clinical evidence and rules on medical necessity → provider & payer accept or appeal
> → funds settle on-chain.

Concretely, the user journey is:

1. **Provider files** a coverage-exception request (`createContract`) — drug ref,
   requested amount, a de-identified justification hash, and a **public evidence URL**
   + prompt hint for the agent.
2. **Payer engages** (`insurerEngage`) — attaches its governing policy (hash on-chain)
   and **deposits escrow** covering the requested amount → `Ready`.
3. **Adjudication fires** (`requestAdjudication`) → `UnderReview`. The on-chain agent
   pipeline scrapes the cited evidence and rules.
4. **Ruling lands**: `Approved`, `Denied`, `EvidenceRequested` (retriable), or
   `PolicyInvalidated` (terminal).
5. **Accept or appeal**: either party `accept`s; or, from a `Denied` ruling, a party
   `appeal`s with **new public evidence** (re-fires the agent). Appeals are bounded to
   N rounds (`maxRounds`, default 3) → `Deadlocked`.
6. **Settle** (`settle`) once both parties accept: on `Approved`, `coveredAmount`
   transfers to the provider and the remainder refunds to the insurer; on `Denied`,
   the full escrow refunds to the insurer.

## 4. Architecture at a glance

The system of record is the **`CoverageNegotiation.sol`** contract. Its agent
adjudication is a **two-agent on-chain pipeline** (Amendment 0007): a *scrape* agent
reads the cited public evidence, then a *decide* agent rules on it.

```
 provider                          CoverageNegotiation.sol                    Somnia agents
 ────────                          ───────────────────────                    ─────────────
 createContract ───────────────▶  Open
 (payer) insurerEngage + escrow ▶  Ready
 requestAdjudication ───────────▶  UnderReview
                                   _fireScrape ─────────────────▶  LLM Parse Website
                                                                   (ExtractString)
                                                                   agentId 12875401142070969085
                                   _handleScrapeResponse ◀──────── (extracted evidence string)
                                   _fireDecide ─────────────────▶  LLM Inference
                                                                   (inferString)
                                                                   agentId 12847293847561029384
                                   _handleDecideResponse ◀──────── "approve|deny|
                                                                    needs_more_info|policy_invalid"
                                   Approved / Denied / EvidenceRequested / PolicyInvalidated
 accept ──▶ accept ──▶ settle ──▶  Settled  (escrow released: coveredAmount→provider, rest→insurer)
```

Key properties:

- **Two-agent pipeline.** `_fireScrape` calls the Somnia **LLM Parse Website** agent
  (`ExtractString`, selector `0xc2dd1a7a`) against the provider's evidence URL,
  extracting verbatim text; the callback then runs `_fireDecide`, which calls the
  Somnia **LLM Inference** agent (`inferString`, selector `0xfe7ca098`) and constrains
  the answer to four allowed decision tokens. The platform calls `handleResponse`
  back into the contract; `handleResponse` branches on the in-flight `AgentPhase`
  (`Scraping` vs `Deciding`).
- **Real escrow & settlement (Amendment 0008).** The insurer funds escrow at
  `insurerEngage` (`msg.value >= requestedAmount`); `settle` releases on `Approved`
  (covered → provider, remainder → insurer) or refunds in full on `Denied`. Every
  terminal non-settle outcome (Deadlocked, PolicyInvalidated, ProviderRefused,
  Withdrawn) refunds the full escrow to the insurer.
- **Simulated vs real backend, one interface.** `createCoverageClient` (in
  `src/contract/index.ts`) picks the backend from the wallet's mode:
  `SimulatedBackend` (`src/contract/simulated.ts`) is an in-memory state machine that
  mirrors the contract exactly with a mocked arbiter; `RealBackend`
  (`src/contract/real.ts`) is an ethers v6 binding to the deployed contract. Both
  implement the same `CoverageNegotiationClient`, so calling code never branches on
  mode.
- **PHI as hashes (hard invariant R4).** Only `keccak256` hashes, opaque `bytes32`
  refs, amounts, decision codes, state, ids, addresses, and timestamps live on-chain.
  The drug justification and policy body are stored as hashes (`justificationHash`,
  `policyHash`); clause/standard references hash to `bytes32`; a defense-in-depth guard
  rejects patient-name patterns in the agent prompt hint.

## 5. Code map

| Piece | Where it lives |
|---|---|
| On-chain pipeline & state machine | [`contracts/contracts/CoverageNegotiation.sol`](./contracts/contracts/CoverageNegotiation.sol) |
| Somnia agent interfaces | [`contracts/contracts/ISomniaAgent.sol`](./contracts/contracts/ISomniaAgent.sol) (`IAgentRequester` / `IAgentRequesterHandler`); `ILLMInferenceAgent` + `ILLMParseWebsiteAgent` declared at the top of `CoverageNegotiation.sol` |
| Library entry / bootstrap | [`src/index.ts`](./src/index.ts) — `createClient(config)` wires wallet + profiles + content store + negotiation client |
| Backends (simulated ↔ real) | [`src/contract/simulated.ts`](./src/contract/simulated.ts), [`src/contract/real.ts`](./src/contract/real.ts), selected by [`src/contract/index.ts`](./src/contract/index.ts) |
| Network config (source of truth) | [`src/config/networks.ts`](./src/config/networks.ts) — Somnia Testnet (Shannon) chainId `50312`, mainnet `5031` |
| Web UI (views) | [`web/src/views/`](./web/src/views/) — `Overview.tsx`, `Create.tsx`, `Detail.tsx`, `Network.tsx`, `Settings.tsx` |
| Deploy (web) | [`scripts/deploy-static.sh`](./scripts/deploy-static.sh) — builds the SPA, guards against leaked keys, syncs to S3 + invalidates CloudFront |
| Deploy (contract) | [`contracts/scripts/deploy.ts`](./contracts/scripts/deploy.ts) via `npm --prefix contracts run deploy:somnia` (chain `50312`) |
| Config | [`.env.example`](./.env.example) — note all `VITE_*` vars are inlined at build time |
| Specs & decisions | [`docs/specs/`](./docs/specs/) (build specs) and [`docs/amendments/`](./docs/amendments/) (ADR-style decision records) |

## 6. Spec-driven workflow

Curie is built **spec-first**: each unit of work starts as a numbered spec in
[`docs/specs/`](./docs/specs/) (`NNNN-kebab-title.md`) whose requirements, technical
notes, and pass/fail criteria are the source of truth — implementation is built to
satisfy them, with status tracked inline in [`docs/specs/README.md`](./docs/specs/README.md).
Mid-flight design pivots are captured as ADR-style **amendments** in
[`docs/amendments/`](./docs/amendments/) (e.g. A-0007 the two-agent scrape→decide
pipeline, A-0008 real escrow settlement, A-0011/A-0012 the evidence-extraction and
de-identified attestation refinements). Start with
[`docs/VISION.md`](./docs/VISION.md) for product framing.

## License

Proprietary. All rights reserved — see [LICENSE](./LICENSE). No copying,
distribution, or derivative works without written permission.
