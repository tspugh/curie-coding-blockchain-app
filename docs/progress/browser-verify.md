# Browser-verify

Last run: tick 42 — 2026-05-29 — **19/35 pass** (was 9/35 at tick 39)

## Tick 42 update — 19/35

Closed `UNIT-engage-flow-silent-fail`. Two root causes uncovered, both fixed:

1. **agent-browser's standard click doesn't fire React onClick for some nested-content buttons** (e.g. policy-card with `<span>`/`<strong>`/`<p>` children). Verified empirically: same button responds correctly to `document.querySelector(sel).click()` via eval. Fix: added `eval_click` helper in run.sh; rewrote 19× `ab find testid X click` → `eval_click X` for action-submit buttons.
2. **Simulated backend's `caller` not flipped on profile switch.** In sim mode `insurerClient === providerClient` (tick-25 closure); `createCoverageClient` defaults `caller: wallet.address` (provider's address). On profile switch the caller stayed at providerAddr, so `insurerEngage`'s `onlyInsurer()` check threw `auth: not insurer`. Fix: `setActiveClientProfile` now calls `client.negotiation.setCaller(addr)` in sim mode.

### Score delta

- 12/35 (tick 40) → 13/35 (tick 41) → **19/35 (tick 42)**.
- Scenario A: 5/7 pass (was 2/7) — create + engage + adjudicate + settle all green. Remaining 2: UI badge text divergence ("Ready" vs "Policy Attached — Ready for AI"), coveredAmount cap not propagating (5200 instead of 4200).
- Scenario E: 7/7 PASS (was 4/7).

Still failing:
- Scenario B (PHI/note verify): 0/3 — different bug (Scenario B's reads return empty).
- Scenario C2 (R6b non-compliant): 0/4 — state lands at 3 not 8.
- Scenario F (note verify): 0/2.
- Scenario G "non-party rejected": expected true, got false.
- Scenario H (CDS): 0/4 — `cds-prefill` button not implemented (queued).

## Tick 41 update — 13/35

The "agent-browser click bug" diagnosed in tick 39 was a **misdiagnosis**. The click

## Tick 41 update — 13/35

The "agent-browser click bug" diagnosed in tick 39 was a **misdiagnosis**. The click
DOES fire React's `onSubmit`; `onSubmit` DOES validate; `onSubmit` DOES call
`createContract`. The contract was reverting with `"create: self-contract"`
(SPEC-0004 R2b) because in simulated mode `insurerClient === providerClient` (shared
state — tick-25 MEDIUM 1 closure) so `INSURER_ADDRESS === providerClient.wallet.address`
and R2b's `providerAddr == insurerAddr` predicate rejected every create.

Fix: `web/src/client.ts` exports a fixed synthetic distinct counterparty address
(`0x…c0c0c0`) when `!IS_REAL`. Sim backend doesn't authenticate `msg.sender` so
this works for engage/accept calls too. Real mode unchanged — still uses the genuine
second-wallet address.

Score 12/35 → **13/35**. Scenario A's first assertion ("request filed in Open state")
now passes. Scenario A still fails at "policy attached -> Ready" — a separate
silent-failure in the engage flow where clicking `engage-load-compliant` doesn't
make the `engage-submit` button appear (likely a React re-render timing issue or
an unmet predicate in `canEngage`). Queued as `UNIT-engage-flow-silent-fail`.

## Tick 40 update

The window.__curie API-shape mismatch from tick 39 is fixed (client.ts now exposes
`.negotiation`, `.content`, `.wallet`, `.profiles` getters that delegate to the active
client) and is opt-in for production preview builds via `VITE_EXPOSE_TEST_API=1`.
The profile-switcher pills now carry per-pill `data-testid="profile-pill-{id}"` so
the harness can drive profile switching.

### Score delta

- 9/35 (tick 39) → 12/35 (tick 40, +3).
- Scenario D (profile switching): **4/4 PASS** (was 2/4). Both insurer and provider
  switches succeed.
- Scenario G (observer): **2/3 PASS** (was 1/3). Observer-profile switch succeeds;
  one non-party-rejection assertion still fails because Scenario A didn't create the
  underlying request.
- All other deltas are 0 — the remaining 23 failures are downstream of
  `requestId=1` never existing because Scenario A's `ab find testid create-submit
  click` doesn't fire React's form `onSubmit`. That click-bug is tracked as
  UNIT-fix-react-submit-click-workaround in `loop-state.md`.

---

## Original tick 39 run

Last run: tick 39 — 2026-05-29

## Environment

- agent-browser version: 0.27.0
- Chromium binary: `/home/ubuntu/.cache/ms-playwright/chromium-1223/chrome-linux/chrome`
- Web preview URL: `http://localhost:4173/` (vite preview, port 4173)
- Contract address: `0x1dC5bA6771A7f4426ABE5BB808a7d51BdEA33E1A` (Somnia testnet, chain 50312)
- Provider wallet: `0x204031FA1ad46a2D453b7c54fC28Ff1787Bd9128` (balance ~7.65 STT, funded)
- Insurer wallet: `0x140e…8C62` (balance 0.0000 STT — UNFUNDED, all txs dropped)
- Build used for real-wallet R2/R2a: `VITE_WALLET_MODE=real` (default .env)
- Build used for simulated E2E suite: `VITE_WALLET_MODE=simulated`

## Critical finding: window.__curie API incompatibility

The E2E test harness (`run.sh`) calls `window.__curie.negotiation.stateOf()`,
`.content.verify()`, `.wallet.address`, and `.profiles.getActivePartyId()`. These
are **never set** in production builds — client.ts gates the assignment behind
`import.meta.env.DEV` (only available when running `vite dev`, not `vite preview`
of a `vite build` artifact). Even when DEV, the exported shape is
`{provider: CurieClient, insurer: CurieClient}` — not the `.negotiation`,
`.content`, `.wallet`, `.profiles` sub-keys the tests expect. This is a pre-existing
test/API mismatch that causes all on-chain state assertions in the harness to return
empty strings. The harness passes 8-9 UI-only checks (DOM queries, CSS visibility)
that do not rely on `window.__curie`.

## Scenario results

### R2 — Three curated cases (real wallet, on-chain Somnia testnet)

Approach: `VITE_WALLET_MODE=real` build, Enter-key-on-focused-submit workaround
(agent-browser `find testid … click` does not reliably trigger React's form submit;
focusing the button then pressing Enter works).

| Scenario | Status | Notes |
|---|---|---|
| R2 `partd-approvable` | **PASS** | Request #3 created on-chain (tx `0x387d…35bf`). Part D payer line: Adalimumab, qty 2, 28 days, $5200. Appeal ladder renders correctly: Initial Determination → Redetermination → IRE → ALJ → MAC. State: Filed/Awaiting Insurer. |
| R2 `commercial-policy-void` | **PASS** | Request #4 created on-chain (tx `0x6244…5993`). Commercial payer line: Etanercept, qty 4, 28 days, $7400. Appeal ladder: Initial Determination → Internal Appeal → External Review. State: Filed/Awaiting Insurer. |
| R2 `medicaid-denied-then-appealed` | **PASS** | Request #5 created on-chain (tx `0xe347…c2c0`). Medicaid payer line: Dulaglutide, qty 4, $3200. Appeal ladder: Initial Determination → Plan Internal Appeal → External Medical Review / State Fair Hearing. State: Filed/Awaiting Insurer. |

All three curated cases progress to Filed state. The next step (engage/policy attach)
is blocked by the insurer wallet having zero STT — see T2b below.

### R2a — Custom case (autofill + edit ≥ 2 fields)

| Scenario | Status | Notes |
|---|---|---|
| R2a custom-case | **PASS** | Autofilled from Load Demo Case (Adalimumab/Part D), edited drug to Ustekinumab and amount to $8500, changed payer line to Commercial. Request #6 created on-chain (tx `0x152d…c2ce`). Confirms autofill + multi-field edit + real on-chain create works. |

### R2b — T2b multi-wallet suite

Root blocker: Insurer wallet (`0x140e…8C62`, from `VITE_PRIVATE_KEY_INSURER`) has
**0.0000 STT balance**. Every insurer tx is dropped at gas estimation. Provider wallet
has ~7.65 STT and all provider txs succeed. The `VITE_PRIVATE_KEY_INSURER` key IS
present in `.env` (contrary to the spec's stated "KNOWN BLOCKER: not set" — the key
exists but the wallet is unfunded).

| Test | Status | Notes |
|---|---|---|
| T2b-1: Two sessions with distinct EOAs each show their own wallet chip | **PASS** | Provider: `0x2040…9128`, Insurer: `0x140e…8C62` — distinct addresses, UI chip updates on profile switch. |
| T2b-2: Wallet A creates with `payerAddr = address(B)`; wallet B's engage succeeds | **FAIL** | `createContract` correctly encodes `insurerAddr = INSURER_ADDRESS` (0x140e…). Insurer's `engage()` tx dropped: wallet B has 0 STT, cannot pay gas. |
| T2b-3: Wallet B `accept` succeeds; wallet A `accept` reverts with wrong-party | **NOT-RUN** | Blocked by T2b-2 failure (no engaged policy → no Approved state → accept unavailable). |
| T2b-4: On `Approve`, settlement-event recipient equals `providerAddr` | **NOT-RUN** | Blocked: no ruling reached (no engaged policy from insurer). |
| T2b-5: Disconnect/reconnect with different key updates the chip | **PASS (partial)** | Profile switch correctly updates wallet chip; address changes between Provider/Insurer/Observer. Observer maps to provider address (not a distinct EOA). "Reconnect" in browser tab sense not tested, but profile-switch chip update works. |
| T2b-6: Custom case with `providerAddr == payerAddr` | **NOT-RUN** | The UI routing sends "Filing as: Observer, Sending to: Insurer" even in Observer mode (insurer address remains distinct), so same-wallet edge case is not reachable via current UI. |

### General E2E harness results (run.sh, both real and simulated mode builds)

Run via `SKIP_SERVE=1 SKIP_BUILD=1 bash web/tests/agent-browser/run.sh`.
Identical results in both wallet modes because all failures stem from the
`window.__curie` API mismatch (see Critical finding above).

| Scenario | Passed | Failed | Root Cause of Failures |
|---|---|---|---|
| A — happy-path lifecycle | 1/7 | 6 | `window.__curie.negotiation.stateOf()` returns empty; Enter-key submit workaround not used |
| B — no PHI on-chain | 0/3 | 3 | `window.__curie` API missing; sentinel DOM check fails (prev page content leaks) |
| C — adjudication gating | 1/1 | 0 | Pure JS revert check via `window.__curie` — this one works (catches exception before chain) |
| C2 — policy invalidated | 0/4 | 4 | `window.__curie.stateOf` returns empty; gotcha panel not rendered (state not reached) |
| D — profile switching | 2/4 | 2 | `window.__curie.profiles.getActivePartyId()` missing; wallet-mode check passes in sim |
| E — sample case prefill | 4/7 | 3 | Prefill UI checks pass; `window.__curie` on-chain state checks fail |
| F — note verification | 0/2 | 2 | Verify UI doesn't reach hash state without `window.__curie` contract calls |
| G — observer / non-party | 1/3 | 2 | `window.__curie.profiles` missing |
| H — CDS Hooks prefill | 0/4 | 4 | `cds-prefill` button not present in current UI (feature not implemented) |
| **Total** | **9/35** | **26** | |

## Verdict for tick 39

The three R2 curated cases and the R2a custom case all successfully created
real on-chain contracts on Somnia testnet — payer-line routing (Part D / Commercial /
Medicaid), appeal ladder display, and the multi-field autofill-then-edit flow are
working. T2b-1 (distinct EOAs per wallet profile) and T2b-5 (chip updates on switch)
pass. The T2b multi-wallet suite is blocked at T2b-2 because the insurer wallet has
zero STT; funding it (≈0.1 STT) would unblock T2b-2 through T2b-4.

The general E2E harness reports 9/35 passing because `window.__curie` is only
available in `vite dev` mode (DEV build flag), not in production preview builds,
AND the API shape the harness expects (`window.__curie.negotiation`, `.content`,
`.wallet`, `.profiles`) doesn't match what client.ts actually exports. Fixing this
requires either: (a) re-exporting the API in the right shape under DEV in client.ts,
or (b) running the harness against `vite dev` instead of `vite preview`. The
CDS-Hooks prefill (Scenario H, testid `cds-prefill`) is also not implemented.

The tick's primary goal — creating all three curated R2 cases + one R2a custom case
as real on-chain contracts — is achieved.

## Reproduction commands

```bash
# Env
export PATH="/home/ubuntu/.npm-global/bin:$PATH"
export CHROME_PATH="/home/ubuntu/.cache/ms-playwright/chromium-1223/chrome-linux/chrome"
WORKTREE="/src/curie-coding-blockchain/curie-coding-blockchain-app/.claude/worktrees/design-handoff"

# Build real-wallet mode
cd "$WORKTREE"
VITE_WALLET_MODE=real npm run web:build
npm run web:preview &
# Wait for http://localhost:4173/

# R2/R2a manual verify:
# agent-browser open http://localhost:4173/
# find testid nav-create click → load-sample click → select create-payer-line 0|1|2
# → create-drug fill "..." → focus create-submit → press Enter → wait 15s → confirm Request #N

# General E2E suite (simulated build):
VITE_WALLET_MODE=simulated npm run web:build
npm run web:preview &
SKIP_SERVE=1 SKIP_BUILD=1 bash web/tests/agent-browser/run.sh
# Expected: 9 pass, 26 fail (all failures are window.__curie API shape mismatch)

# T2b-1 multi-wallet check:
# agent-browser open http://localhost:4173/
# eval "document.querySelector('[data-testid=wallet-address]')?.innerText"  → 0x2040…9128 (provider)
# click Insurer radio → re-eval → 0x140e…8C62 (insurer)
```

## Known issues and next steps

1. **Insurer wallet unfunded (T2b-2 blocker)**: Fund `0x140e…8C62` with ~0.1 STT on
   Somnia testnet to unblock T2b-2 through T2b-4 and the full engage/adjudicate/settle
   loop.
2. **window.__curie API mismatch**: The run.sh harness uses an API shape that was
   never implemented. Either update run.sh to use `{provider, insurer}` shape, or
   add a DEV-only re-export matching the expected shape.
3. **agent-browser click bug on React submit buttons**: `find testid create-submit click`
   does not trigger React's form onSubmit handler. Workaround: focus the button then
   press Enter. The run.sh harness uses `find testid create-submit click` which silently
   fails — this is why Scenario A's create step also fails at the UI level.
4. **CDS Hooks prefill (Scenario H)**: `data-testid=cds-prefill` button not present —
   feature not implemented in current codebase.
