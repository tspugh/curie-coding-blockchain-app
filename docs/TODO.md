# Curie Claims Protocol — TODO (Wanted List)

> **How to use:** Every item needs `[ ]` → `[x]` when done. Assignees are rough — if one person is carrying double, swap. Priority: P0 = must-have for a working demo, P1 = strong finalist polish, P2 = stretch.

---

## 🚨 BLOCKERS — Must exist before any code

> None of the real work can start until these are unblocked.

| # | Item | Assignee | Priority |
|---|------|----------|----------|
| 1 | ✅ `node_modules/` added to `.gitignore` — current `.gitignore` does not include it; `npm install` should be documented as first step | (B) agents/UI person | P0 |
| 2 | ✅ `.env.example` exists with `PRIVATE_KEY`, `SOMNIA_RPC_URL`, agent contract address placeholders — validated that `somnia-agent-kit` actually reads these | (shared) | P0 |
| 3 | `npm install` completes without errors — confirm all deps resolve and the kit version is stable for the hackathon timeline | (shared) | P0 |
| 4 | `npm run dev` runs `src/index.ts` without unhandled errors — currently it prints "Connected to Somnia testnet" but needs a valid `PRIVATE_KEY` | (shared) | P0 |
| 5 | Decide: Foundry or Hardhat for smart contracts? Agentathon docs mention both; Foundry is faster for dev/test loops. (A) owns this decision. | (A) blockchain person | P0 |
| 6 | If Foundry: `foundryup` + `forge init` in a `contracts/` subdir. If Hardhat: `npx hardhat init`. Repo structure decision blocks all contract work. | (A) blockchain person | P0 |
| 7 | Create `feat/hackathon` (or `main`) feature branch away from `feature/fix-python-agents` — current branch name is misleading for this project. | (shared) | P0 |
| 8 | Create `docs/specs/` directory — ROADMAP mandates spec-driven development | (shared) | P0 |
| 9 | Somnia testnet wallet funded — get test SOMI via Somnia faucet; deployer needs SOMI for contract txns | (A) blockchain person | P0 |

---

## 📋 REPOSITORY CHORES — Hygiene work

> Clean up before the judges browse the repo. No one trusts a repo that still has 200+ stale files from a different project.

| # | Item | Assignee | Priority |
|---|------|----------|----------|
| 10 | Add `LICENSE` (MIT recommended for hackathons) — currently missing | (shared) | P1 |
| 11 | Create `docs/archived/` and move `docs/raw/` into it — the 150+ historical ICD-10 docs are noise; a single archive folder > 200 scattered stale files | (B) agents/UI person | P1 |
| 12 | Update `README.md` — rename project from "cliqueue-coding-blockchain" to "Curie Claims Protocol", add hackathon framing, 90-second demo description, architecture overview, tech stack, quickstart, and "what's built vs roadmap" sections | (B) agents/UI person | P1 |
| 13 | Update `package.json` name/description to match Curie Claims Protocol branding | (B) agents/UI person | P1 |
| 14 | Add `@nomicfoundation/hardhat-toolbox` or Foundry tooling as devDependency (matching day 1 toolchain decision) | (A) blockchain person | P1 |
| 15 | Create `CONTRIBUTING.md` — minimal: repo conventions, spec-first workflow, branch naming | (shared) | P2 |
| 16 | Add `.vscode/` folder with recommended extensions (TypeScript, Solidity, GitLens) if using VS Code | (shared) | P2 |
| 17 | Ensure no secrets, no real patient data, no PHI anywhere in the repo — audit `.git` history for leaked keys | (shared) | P1 |
| 18 | Add `.github/ISSUE_TEMPLATE/` and `.github/PULL_REQUEST_TEMPLATE/` for hackathon repo hygiene | (B) agents/UI person | P2 |
| 19 | Add a `.prettierignore` or `.eslintrc` config to keep code consistent if formatting/linting is planned | (shared) | P2 |

---

## 🧱 FOUNDATION — Week 1 core work

> The skeleton of everything. End of Week 1 = one full claim flow works end-to-end, even if ugly.

### Specs (per ROADMAP)

| # | Item | Assignee | Priority |
|---|------|----------|----------|
| 20 | `specs/001-claim-lifecycle.md` — state machine diagram (Draft → Submitted → PayerReview → Countered → EvidenceRequested → Agreed → Settled / Disputed / Withdrawn), allowed transitions, revert conditions, event schemas, acceptance tests | (shared) | P0 |
| 21 | `specs/002-claim-bundle.md` — JSON schema for off-chain claim bundle (patientRef, codes[], amount, evidenceRefs, bundleHash) | (B) agents/UI person | P0 |
| 22 | `specs/003-provider-agent.md` — inputs, outputs, acceptance criteria (always emits valid JSON, cites evidence spans, no invented codes, marks uncertain claims) | (B) agents/UI person | P0 |
| 23 | `specs/004-payer-agent.md` — inputs, outputs, acceptance criteria (applies policy fixtures, can request evidence, can counter, structured adjudication response) | (B) agents/UI person | P0 |
| 24 | `specs/005-demo-ui.md` — acceptance criteria (one-click run, visible event timeline, Somnia txn hashes, off-chain/on-chain privacy split, 90-second path) | (B) agents/UI person | P0 |
| 25 | `specs/006-privacy-security.md` — on-chain/off-chain boundary rules, data classes, what is intentionally excluded from chain | (shared) | P0 |

### Contract scaffold

| # | Item | Assignee | Priority |
|---|------|----------|----------|
| 26 | Scaffold `contracts/` directory with toolchain (Foundry/Hardhat) — directories for `src/`, `test/`, `script/`, `lib/` | (A) blockchain person | P0 |
| 27 | `contracts/src/ClaimSettlement.sol` — basic contract skeleton with enum `ClaimState` and struct `Claim` | (A) blockchain person | P0 |
| 28 | `contracts/src/AgentRegistry.sol` — register/unregister agents by role (Provider/Payer), basic address-to-role mapping | (A) blockchain person | P1 |
| 29 | Tests: `contracts/test/ClaimSettlement.t.sol` — test claim submission, state transition, reverting invalid transitions | (A) blockchain person | P0 |
| 30 | Mock Somnia RPC config for local testing (Foundry's anvil or Hardhat's local network) — so A can iterate without testnet round-trip | (A) blockchain person | P0 |

### Demo data

| # | Item | Assignee | Priority |
|---|------|----------|----------|
| 31 | Create `demo-data/synthetic-claims/` — at minimum 1 full synthetic claim (diabetes follow-up) with clinical note, codes, amount, evidence refs | (B) agents/UI person | P0 |
| 32 | Create `demo-data/payer-policies/` — policy fixtures for at least 1 payer (coverage rules, allowed codes, denial criteria) | (B) agents/UI person | P0 |
| 33 | Create 2 more synthetic claims by Week 2 for varied demo outcomes (downcode negotiation, evidence-requested) | (B) agents/UI person | P1 |

---

## 🤖 AGENTS — Provider + Payer agents

> The "agentic" part of Claims Protocol. Week 1: deterministic local orchestrator. Week 2: richer negotiation.

| # | Item | Assignee | Priority |
|---|------|----------|----------|
| 34 | Provider agent — `agents/provider/` module. Ingests synthetic note, proposes ICD-10 codes with confidence, supporting evidence spans, structured rationale, outputs valid claim bundle JSON | (B) agents/UI person | P0 |
| 35 | Payer agent — `agents/payer/` module. Reads claim bundle + payer policy fixture, decides approve / counter-code / request evidence, outputs adjudication response | (B) agents/UI person | P0 |
| 36 | Negotiation orchestrator — `agents/orchestrator.ts`. Runs the multi-agent loop: provider proposes → payer reviews → back-and-forth → final state. Can run locally for demo | (B) agents/UI person | P0 |
| 37 | Orchestrator connects to smart contract — submits claim hash on chain, records evidence requests/submissions, updates state via contract calls | (shared) | P0 |
| 38 | Deterministic fallback mode — if LLM API is slow/down, orchestrator falls back to pre-computed outputs from demo data so the demo never freezes | (B) agents/UI person | P0 |
| 39 | Agent reasoning output — both agents emit step-by-step reasoning cards (plain English, not JSON) for display in the UI companion panel | (B) agents/UI person | P1 |
| 40 | "Human review required" flag path — when agent confidence is low or dispute is high-risk, mark for human-review before finalizing | (B) agents/UI person | P1 |
| 41 | At least 3 demo scenario scripts (clean approval, downcode negotiation, evidence request resolved) in the orchestrator for the Week 2 demo | (B) agents/UI person | P1 |

---

## 🔗 CHAIN — Smart contracts & deployment

> The "blockchain" part. Must be real Somnia transactions for the demo.

| # | Item | Assignee | Priority |
|---|------|----------|----------|
| 42 | `ClaimSettlement.sol` — full contract: all state transitions (Draft → Submitted → PayerReview → Countered → EvidenceRequested → Agreed → Settled / Disputed / Withdrawn) | (A) blockchain person | P0 |
| 43 | All required events emitted: `ClaimSubmitted`, `CodeProposalAdded`, `EvidenceRequested`, `EvidenceSubmitted`, `ClaimCountered`, `ClaimAgreed`, `ClaimSettled`, `ClaimDisputed` | (A) blockchain person | P0 |
| 44 | Agent registration flow in `AgentRegistry.sol` — provider/payer agent addresses, role enum, credential hash placeholder | (A) blockchain person | P1 |
| 45 | Test suite covers ALL state transitions + invalid transitions revert — acceptance tests from spec 001 must pass | (A) blockchain person | P0 |
| 46 | Deploy `ClaimSettlement.sol` (and `AgentRegistry.sol`) to Somnia testnet | (A) blockchain person | P0 |
| 47 | Contract deployment script — `scripts/deploy.ts` (or `deploy.s.sol`) that is reproducible and documented | (A) blockchain person | P0 |
| 48 | Deployed addresses added to `.env.example` and README so anyone can connect to the live demo contracts | (A) blockchain person | P0 |
| 49 | On-chain privacy: verify NO PHI in any calldata, event data, or contract storage — only hashes, state, agent addresses, timestamps, amounts | (A) blockchain person (with B's review) | P0 |
| 50 | Settlement simulation — mock stablecoin transfer or simulated settlement event (not real payment rails for hackathon) | (A) blockchain person | P1 |
| 51 | Explorer links — Somnia block explorer URLs for deployed contracts and demo transactions | (A) blockchain person | P1 |
| 52 | Event listener (subscription) that watches contract events and feeds them to the UI in real-time | (shared) | P1 |

---

## 🖥️ UI — Judge-facing interface

> The visual proof. Judges see this for 90 seconds. It needs to look intentional, not a terminal dump.

| # | Item | Assignee | Priority |
|---|------|----------|----------|
| 53 | Scaffold Next.js app — `apps/web/` or `apps/ui/` directory. One-page demo app. Install dependencies (Tailwind, viem/ethers, somnia-agent-kit bindings) | (B) agents/UI person | P0 |
| 54 | Dashboard page — total claims, avg negotiation time, settled amount, denial avoided metric, Somnia txn links | (B) agents/UI person | P0 |
| 55 | Claim detail page — synthetic patient summary, proposed codes, payer response, negotiation transcript, audit timeline, on-chain events | (B) agents/UI person | P0 |
| 56 | Agent reasoning cards — provider and payer agent reasoning displayed in companion-style panels (plain English, not JSON) | (B) agents/UI person | P0 |
| 57 | "Run negotiation" button — single click from dashboard triggers the orchestrator flow, shows progress step-by-step | (B) agents/UI person | P0 |
| 58 | Somnia transaction links — every chain event links to the Somnia block explorer with the correct txn hash | (A) blockchain person (with B's review) | P0 |
| 59 | Privacy architecture panel — "Off-chain: clinical bundle" vs "On-chain: hash, state, signatures, settlement" — critical for healthcare judges | (B) agents/UI person | P1 |
| 60 | Claim timeline view — animated or sequential display of negotiation events with timestamps and chain-state glyphs (◌ ◐ ●) | (B) agents/UI person | P1 |
| 61 | Architecture diagram image — 4-box visual (clinical input → agents → Somnia contract → audit UI), included in dashboard and README | (B) agents/UI person | P1 |
| 62 | Demo scenario selector — dropdown to choose demo scenario (clean approval / downcode / evidence request) for the 3-claim Week 2 demo | (B) agents/UI person | P1 |
| 63 | "Reset demo" button — clears state and allows replaying scenarios without restarting the app | (B) agents/UI person | P2 |

---

## 📦 DEVOPS — CI/CD and hardening

> Don't over-engineer. A GitHub Actions workflow that runs tests + lint on PR is enough.

| # | Item | Assignee | Priority |
|---|------|----------|----------|
| 64 | Basic GitHub Actions workflow — on PR: `npm run typecheck`, `npm run build`, contract tests (Foundry/Hardhat) pass | (shared) | P1 |
| 65 | TypeScript linting config — ESLint + simple config so new code isn't checked in with obvious errors | (shared) | P1 |
| 66 | Error boundaries in UI — if orchestrator or contract call fails, show graceful error message, don't crash the page | (B) agents/UI person | P1 |
| 67 | Cache demo outputs — pre-compute orchestrator results during dev so the UI can show instant results without waiting for LLM calls | (B) agents/UI person | P1 |
| 68 | Seed script — CLI command that pre-seeds the demo data into the app state (claim scenarios, contract addresses) | (B) agents/UI person | P1 |
| 69 | Contract test coverage target — at least 80% coverage on `ClaimSettlement.sol` critical paths | (A) blockchain person | P1 |
| 70 | `.env.example` includes all required environment variables with comments — PRIVATE_KEY, SOMNIA_RPC_URL, contract addresses | (A) blockchain person (with B's review) | P0 |
| 71 | `.gitignore` comprehensive — add `node_modules/`, `.env`, `.env.*.local`, `dist/`, `*.tsbuildinfo`, OS files, IDE configs | (shared) | P1 |

---

## 📝 SUBMISSION — Hackathon deliverables

> The last week is for packaging. Do not leave this until the final night.

| # | Item | Assignee | Priority |
|---|------|----------|----------|
| 72 | README.md polish (see ROADMAP: What it is, Why agents, Why blockchain, Why Somnia, Demo, Architecture, Privacy model, Smart contracts, Agent specs, Run locally, Deploy contracts, Roadmap) | (B) agents/UI person | P0 |
| 73 | Demo video (2-3 minutes) — recording of the 90-second demo loop with narration; backup for live demo. Must include all 3 scenarios | (B) agents/UI person | P0 |
| 74 | Screenshots — capture the UI in all states (dashboard, claim detail, agent cards, timeline, privacy panel) for README and pitch | (B) agents/UI person | P0 |
| 75 | Submission form copy — write the hackathon submission text: project name, description (2 sentences), problem statement, solution, tech stack, demo link | (shared) | P0 |
| 76 | Architecture diagram (final version) — polished SVG or PNG with Curie branding, four-box layout: input → agents → Somnia → audit UI | (B) agents/UI person | P1 |
| 77 | Pitch deck (5-8 slides) or pitch script — problem, insight, why blockchain/Somnia, why now, what we built, safety, roadmap | (shared) | P1 |
| 78 | Deploy to public URL — Vercel/Netlify/GitHub Pages so judges can access live demo without cloning | (B) agents/UI person | P0 |
| 79 | Final repo hardening pass — no secrets, no stale files from old project, LICENSE present, README accurate, one-command setup (`npm install && npm run dev`) | (shared) | P0 |
| 80 | Test everything cold — have a fresh team member (or yourself, blinded) follow the README from zero and see if the demo works in one session | (shared) | P1 |

---

## 📌 Priority Summary by Week

| Week | Focus | Key items |
|------|-------|-----------|
| **Days 1-3** | Spec + skeleton | 20–25 (specs), 26–30 (contract scaffold), 31–32 (demo data), 1–9 (blockers) |
| **Week 1** | End-to-end flow | 34–38 (agents + orchestrator), 42–46 (full contract + deploy), 53–57 (UI skeleton), 39–41 (reasoning output) |
| **Week 2** | Feel like a protocol | 48–52 (explorer links, event listener, settlement), 39–41 (agent reasoning polish), 60–63 (UI polish), 33 (more demo scenarios) |
| **Week 3** | Presentation | 53–63 (UI polish), 51 (explorer links), 66–69 (DEVOPS hardening), 64–65 (CI/CD) |
| **Week 4** | Submission | 72–80 (ALL submission items) |

---

## ⚠️ Critical Path

The demo **cannot work** without these items connecting:

```
[1–9] Blockers
  ↓
[26–30] Contract scaffold
[31–32] Demo data
[34–37] Agents + orchestrator
  ↓
[42] Full ClaimSettlement contract
[47] Contract deployment to Somnia testnet
[38] Orchestrator → contract wiring
[53–57] UI connecting to deployed contracts + agent output
  ↓
[48] Deployed addresses in env config
[72] README explaining the flow
[73] Demo video backup
[78] Live deployment
```

If any link in that chain breaks, the demo fails.

---

*Created: 2026-05-19. Last updated: 2026-05-19.*
