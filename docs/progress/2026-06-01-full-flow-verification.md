# Full-flow verification via agent-browser — 2026-06-01

Goal: drive the deployed real-mode CoverageNegotiation contract through every
state from **Filed (Open) → Settled** using only the web app, logging every
issue encountered.

## Status — ✅ FULL FLOW LANDED ON-CHAIN + TX HISTORY SURFACES IN UI

**End state after this session:** a complete Filed → Settled lifecycle on
the live deployed contract is reproducible by clicking through the web app
alone, and on a page reload the Dashboard, Detail Timeline, Network view,
and Tx Monitor all surface the full event history.

Live testnet trace of negotiation **#1** on contract
`0x2c561f339a0A15cf0550cb9a0880Bb341488ac93` (Somnia Shannon, chainId 50312):

| Block | Event | Notes |
|---|---|---|
| 398007594 | `ContractCreated` + `ContentCommitted` (reqId=1) | provider `0x2040…9128`, insurer `0x140e…8C62`, requested $5200 |
| 398008227 | `InsurerEngaged` + `ContractReady` | Part D Adalimumab policy attached |
| 398008501 | `AdjudicationRequested` + `RulingRequested` | reqId=1, fee=0, requestId=2849174… |
| ~398008600 | `Ruled` | orchestrator → Decision=Approve, covered=$400 |
| 398008936 | `Accepted` (partyId=1, Provider) | |
| 398009156 | `Accepted` (partyId=2, Insurer) | |
| 398009281 | `Settled` (coveredAmount=400, feePerParty=0) | **terminal** |

Final balances: provider 4.933 STT, insurer 0.496 STT, contract 0 STT
(settlement is an event marker per the contract; no escrow held).

## What had to be in place for the system to work

### 1. Two distinct, funded wallets

The contract enforces `providerAddr != insurerAddr` (SPEC-0004 R2b,
[`CoverageNegotiation.sol:370`](../../contracts/contracts/CoverageNegotiation.sol#L370)).
The web app derives provider from `VITE_PRIVATE_KEY` and insurer from
`VITE_PRIVATE_KEY_INSURER`; if the latter is unset, `INSURER_ADDRESS`
silently degrades and `createContract` reverts with `create: self-contract`.

Cost per actor for one end-to-end run:

| Actor | Tx | Cost on this run |
|---|---|---|
| Provider | createContract | ~0.016 STT gas |
| Provider | requestAdjudication | 0.35 STT agent-fee + ~0.025 STT gas |
| Provider | accept | ~0.001 STT gas |
| Provider | settle | ~0.001 STT gas |
| Insurer | insurerEngage | ~0.0025 STT gas |
| Insurer | accept | ~0.0019 STT gas |
| **Orchestrator** | handleResponse | gas borne by the orchestrator wallet (== provider in self-hosted mode) |

**This session funded the insurer from the provider** (0.5 STT, tx
`0xd2cfedc0fd0bac07b99097d8fc998b7987a7898e11773eeb730949cd84ce65a7`,
block 398003165). Document this in the demo runbook so anyone reproducing
the demo knows to top up the insurer before clicking Engage.

### 2. Vite dev server running off the up-to-date `.env`

`vite.config.ts` sets `envDir: repoRoot`, so the dev server must be
started from a worktree that sees the populated `.env` — and **must
not collide with a stale dev server on port 5173 from a sibling
worktree**. The first agent-browser session this run hit a sibling
worktree's dev server, which was serving an older `client.ts` bundle
where `INSURER_ADDRESS` was undefined; the bundle silently fell back to
the provider's address and produced a self-contract create. (We never
saw the revert because the older bundle exposed `__curie` without
the `insurerClient` export, masking the diagnosis.) See **ISSUE 2** below.

### 3. Orchestrator script (`scripts/orchestrator-real.ts`) running

Amendment 0006 self-hosted mode requires this script subscribed to
`RulingRequested` and authorized to call `handleResponse` from the
platform wallet (`platform == orchestrator EOA` per `verify-deploy`).
Without it, the negotiation is stuck in `UnderReview` after
`requestAdjudication`. Start with:

```bash
npx tsx scripts/orchestrator-real.ts
# subscribes to RulingRequested; serves forever.
```

If `ANTHROPIC_API_KEY` is unset, the orchestrator falls back to a
**deterministic stub** ruling rather than a real LLM call (this session
ran without the key — see ISSUE 4).

### 4. Deployed contract in self-hosted mode

`npm run verify-deploy` must pass 8/8. The current deploy
(`0x2c561f339a0A15cf0550cb9a0880Bb341488ac93`) is correctly configured:

- `selfHosted == true`
- `platform == orchestrator EOA (0x2040…9128)`
- `agentId == 12875401142070969085`, `agentReward == 0`
- `rulingTimeout == 3600s`, `maxRounds == 3`
- `owner == orchestrator EOA`

## Issues encountered

### ISSUE 1 — Pre-existing seed negotiations on a sibling-worktree contract were unreachable

The first agent-browser session opened against `localhost:5173`, which
was being served by a Vite dev server from a different worktree and
talking to a different (older) deployment. That deployment's seeded
negotiations #1-#5 carried `providerAddr == insurerAddr ==
0x69b5C79E…0F77`, a stale single-wallet test seed (and a SPEC-0004 R2b
violation that today's `createContract` would reject). The "Submit
Evidence" attempt the user originally reported reverted with
**`auth: not provider`** because `msg.sender (0x2040…9128) ≠
n.providerAddr (0x69b5…0F77)`.

**Resolution:** abandoned the stale port-5173 session entirely; the
correct contract `0x2c561f…ac93` had **zero** negotiations on it, so
the run started clean.

### ISSUE 2 — Stale `client.ts` bundle masked the insurer-wallet load failure

On the port-5173 session, `await import("/src/client.ts")` returned a
9-export module that omitted `INSURER_ADDRESS`, `walletSetupRequired`,
`syncProfilesFromUsers`, `setActiveClientProfile`, and
`USERS_CHANGED_EVENT`. The `Create.tsx` form pulled `INSURER_ADDRESS`
as `undefined`, ethers serialized it to `address(0)`, and the
`createContract` call reverted with `addr: zero` — but the UI did
nothing to surface the revert (the submit silently no-op'd).

The same bundle had a slimmer `window.__curie` shape (no `.provider` /
`.insurer` subclients), which is the second tell that the bundle
predated [client.ts:437-438](../../web/src/client.ts#L437-L438).

**Resolution:** restarted on `localhost:5174` from this worktree; the
fresh bundle exports `INSURER_ADDRESS=0x140e…8C62` and the create
succeeds. No code change needed in this worktree, but **add a runbook
note**: kill all stray Vite servers (`lsof -i :5173 -i :5174 …`)
before starting `npm run web:dev` for a demo.

### ISSUE 3 — Insurer wallet was empty; demo would have failed at engage()

`VITE_PRIVATE_KEY_INSURER`'s address held 0.0 STT at session start.
The `insurerEngage` tx would have reverted on insufficient gas. The
balance-block hint in `Create.tsx` only watches the *provider* wallet
against `AGENT_FEE_RESERVE_WEI`; there is **no UI affordance that warns
when the insurer wallet is too short to engage**.

**Resolution this session:** out-of-band provider→insurer transfer of
0.5 STT. **Suggested code change (post-demo):** extend the SPEC-0005
R23 pre-flight check (`web/tests/agent-browser/cost-estimator.sh` +
its in-UI counterpart in `web/src/components/WalletBalance.tsx`) to
also gate the insurer-side flow.

### ISSUE 4 — `ANTHROPIC_API_KEY` not set; orchestrator used the deterministic stub

The orchestrator delivered the ruling within ~1.5s of
`requestAdjudication`, but per its own log
(`[reqId=1] ANTHROPIC_API_KEY not set — using deterministic stub
ruling`) the decision came from the in-script stub, not a real LLM.
SPEC-0004 R27 (responsible-claim gate) is currently in force until at
least one real-LLM `Settled` event is produced.

**Suggested action for the demo:** export `ANTHROPIC_API_KEY` before
starting the orchestrator, repeat the flow once, and lift R27.

### ISSUE 5 — Detail.tsx view doesn't auto-refresh on the orchestrator's `Ruled` event

After `requestAdjudication`, the Detail page kept showing "Request AI
Decision →" until the user manually returned to the Dashboard and
re-opened the negotiation. The Detail effect (`[reqId, events]`)
should refresh once a new event lands, but the event subscription
appears not to surface `Ruled` synchronously enough for the local
view-state to recompute `canAdjudicate`.

**Workaround used this session:** click "← Back" then re-click the
row; the second `getNegotiationView` call returned state=Approved and
the Accept button rendered.

**Suggested code change:** in `web/src/views/Detail.tsx` near
[`Detail.tsx:276-296`](../../web/src/views/Detail.tsx#L276-L296),
either trigger a manual refresh on any event whose `reqId` matches,
or add a short polling fallback while `state == UnderReview`.

### ISSUE 6 — Profile switch via the top-bar radio drops the user back to the Dashboard

While on Detail view, clicking the Provider/Insurer/Observer radio
returns to the Overview ("Coverage Requests"), forcing the user to
re-open the row. This is an annoying break in the demo cadence (the
user has to re-click the row twice — once after the policy attach and
once after each profile flip). Not a blocker, but worth a `useView`
preservation across profile change.

### ISSUE 7 — Tx history empty on the Detail Timeline, Network tab, and Tx Monitor (FIXED in this session)

After completing the full flow on negotiation #1, the Detail Timeline,
Network tab, and Tx Monitor all rendered empty. The diagnostic was
`getEvents()` calling `eth_getLogs` with `fromBlock: 0` against the
Somnia testnet RPC, which caps each request at 1000 blocks. The call
reverted with **`block range exceeds 1000`** and the App-level
`events` array stayed empty, so nothing downstream had data to render.

A secondary problem masked this: the `TxMonitor` is session-only —
it ingests `tx-confirmed` events from the live `RealBackend.txEvents`
stream but does not read back the dev-server JSONL sink
(`.tmp/tx-log.jsonl`) on mount, so a page reload always reset the
totals to zero even though the JSONL accumulated correctly.

**Fix (landed in this branch):**

1. [`src/contract/real.ts`](../../src/contract/real.ts) — added
   `RealBackendOptions.deploymentBlock` (web reads it from
   `VITE_DEPLOYMENT_BLOCK`); rewrote `getEvents` to query
   `provider.getLogs({ address, fromBlock, toBlock })` in
   `LOG_PAGE_SIZE = 1000` chunks and decode the contract's events from
   the resulting `LogDescription` set. One paged scan per page-load
   instead of one-call-per-event-name × pages. Default lookback when
   no deploy block is set: `latest - 10_000` blocks (~3.5h of testnet).
2. [`web/src/client.ts`](../../web/src/client.ts) — pass
   `deploymentBlock` from `import.meta.env.VITE_DEPLOYMENT_BLOCK`.
3. [`vite.config.ts`](../../vite.config.ts) — `GET /__log/tx` returns
   the persisted JSONL as a JSON array so the in-UI TxMonitor can
   hydrate cross-reload.
4. [`web/src/txLogger.ts`](../../web/src/txLogger.ts) — added
   `hydrateTxLogFromSink()` that fetches `GET /__log/tx` once on mount
   and replays the entries through `ingest()`.
5. [`web/src/components/TxMonitor.tsx`](../../web/src/components/TxMonitor.tsx) —
   call `hydrateTxLogFromSink()` from the effect that wires the
   subscription.

**Verified post-fix on this session's reload:**

| Surface | State |
|---|---|
| Dashboard row count | `Settled 1` (was 0) |
| Detail Timeline | 11 events listed (was empty) |
| Network tab | 11 explorer links (was empty) |
| Tx Monitor header | `gas 0.028261 STT · value 0.3500 STT · 6 tx` (was "waiting for first confirmed tx") |
| `getEvents` latency | ~1.5s for the 10k-block default lookback |

**Demo-readiness note:** for a long demo run that exceeds the 10k-block
lookback window, set `VITE_DEPLOYMENT_BLOCK=396059798` in `.env` (the
approximate deploy block for the current contract) so the dashboard
shows the full lifetime history. Cost: ~2000 paged RPC calls at
startup (~30-60s) — fine for an "operator console" workflow, slow for
a kiosk reload.

## Pre-conditions checklist (demo-ready)

| Piece | State at start | Action taken | State at end |
|---|---|---|---|
| Two funded wallets (provider + insurer ≠ provider) | provider 5.49 STT, insurer 0 STT | Funded insurer with 0.5 STT (tx `0xd2cfedc0…`) | provider 4.93 STT, insurer 0.496 STT |
| `.env` correctly populated, no stale Vite servers | `.env` good; stale 5173 server on a sibling worktree | Started a fresh `npm run web:dev` here; bound to 5174 | Clean |
| `orchestrator-real.ts` running | not running | `npx tsx scripts/orchestrator-real.ts` in background | Subscribed; 1 ruling delivered |
| `ANTHROPIC_API_KEY` exported | not set | (not addressed this session) | Stub still in use |
| `verify-deploy` 8/8 PASS | PASS | n/a | PASS |
| `npm run build` (lib for `@lib` alias) | rebuilt at start | n/a | OK |

## Reproducer (next demo run)

```bash
# 1. Sanity-check deploy + balances
npm run verify-deploy
node -e "const{ethers}=require('ethers');const p=new ethers.JsonRpcProvider('https://api.infra.testnet.somnia.network/');(async()=>{for(const a of ['0x204031FA1ad46a2D453b7c54fC28Ff1787Bd9128','0x140e424CDc1CacD4C08CEc1FDb7bf1993b888C62']){console.log(a, ethers.formatEther(await p.getBalance(a)),'STT')}})()"

# 2. If insurer is short, top up from provider (one-off 0.5 STT is plenty for 3 demo runs)
#    (use scripts/_tmp_fund_insurer.mjs pattern in this doc).

# 3. Start dev server + orchestrator (different terminals)
npm run build && npm run web:dev          # serves http://localhost:5173 (or next free port)
ANTHROPIC_API_KEY=sk-ant-… npx tsx scripts/orchestrator-real.ts

# 4. Open the printed URL, click "+ New Request" → "Load Demo Case →" → "Submit Request →"
# 5. Switch top-bar radio to "Insurer", re-open the row, pick "✓ Part D formulary — Adalimumab",
#    click "Attach Policy & Engage →".
# 6. Switch to "Provider", re-open the row, click "Request AI Decision →".
#    Wait 1-2s; the orchestrator log prints "ruling delivered" and the row flips to "Approved".
# 7. Click "← Back", re-open the row, click "Accept Decision (as Provider)".
# 8. Switch to "Insurer", re-open the row, click "Accept Decision (as Insurer)".
# 9. Switch to "Provider", re-open the row, click "Finalize Settlement — $400 covered".
#    Row flips to "Settled", terminal.
```

## Spec deltas to land alongside the demo

These came out of the run; they're notes, not blockers for the demo:

- **SPEC-0005 R23** (pre-flight wallet sufficiency): expand to gate the
  insurer-side too. Today's helper only checks the provider against
  `AGENT_FEE_RESERVE_WEI`; the insurer's engage tx silently fails if the
  insurer wallet is short. See ISSUE 3.
- **SPEC-0003 §2.10 R49** is still degraded under self-hosted mode
  (`selfHosted == true`, the validator-`executionCost` dichotomy
  collapses to a 3-state). After ISSUE 4 is closed (real LLM ruling) the
  R27 gate should be lifted and SPEC-0006 (canonical SomniaAgents
  platform) can be re-planned without the self-hosted detour.
- **SPEC-0004 R27** (responsible-claim gate) — see ISSUE 4: lift after
  one real-LLM Settled event is produced.
- **Detail.tsx auto-refresh on Ruled** — minor UX bug, see ISSUE 5.
- **Profile-switch should preserve current detail view** — see ISSUE 6.
- **SPEC-0003 §2.2 R8/R9** (Tx ledger): codify the `deploymentBlock` /
  `VITE_DEPLOYMENT_BLOCK` plumbing and the `GET /__log/tx` hydration
  contract as part of the spec — they were unspecified, which is why
  ISSUE 7 lay dormant. The fixes themselves are minimal and land in
  this branch; the spec should follow.

## Code changes made in this session

- [`src/contract/real.ts`](../../src/contract/real.ts) —
  `RealBackendOptions.deploymentBlock`, `LOG_PAGE_SIZE`, paged
  `getEvents` that scans `provider.getLogs({address, fromBlock,
  toBlock})` in 1000-block chunks against the contract address (one
  call per page, parsed against the interface) instead of one call per
  event-name per page.
- [`web/src/client.ts`](../../web/src/client.ts) — forwards
  `VITE_DEPLOYMENT_BLOCK` into `RealBackend`.
- [`vite.config.ts`](../../vite.config.ts) — `GET /__log/tx` reads
  back the persisted JSONL so the in-UI TxMonitor can hydrate.
- [`web/src/txLogger.ts`](../../web/src/txLogger.ts) — new
  `hydrateTxLogFromSink()` replays persisted entries through `ingest()`.
- [`web/src/components/TxMonitor.tsx`](../../web/src/components/TxMonitor.tsx) —
  invokes `hydrateTxLogFromSink()` on mount.

Tests: `npm run test:lib` 209/209 pass post-change.
