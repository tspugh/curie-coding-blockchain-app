# Browser-verify

Last run: Extract-Create `runLivenessDebounce` unit — 2026-06-04 —
**sim-mode harness 109/109 PASS** across 23 scenarios. Unit tests 331/331 PASS.
F4' (strict-review gate FAIL) resolved: `runLivenessDebounce` extracted from
`Create.tsx`'s `useEffect` into `web/src/livenessDebounce.ts` (pure, injectable,
no React dependency); 9 new unit tests in `web/src/livenessDebounce.test.ts`
covering debounce firing, stale-response cancellation, and empty-URL short-circuit.
Gate turns from FAIL to PASS.

## Extract-Create `runLivenessDebounce` unit — 2026-06-04

Branch: `spec-6-implementation`

### Unit tests — 331/331 PASS

Run: `npm run test:lib`

```
# tests 331
# suites 0
# pass 331
# fail 0
# duration_ms 10098
```

New tests in `web/src/livenessDebounce.test.ts` (9 tests):
- debounce fires after PROBE_DEBOUNCE_MS: onResult NOT called before delay, IS called once after
- cleanup cancels in-flight probe — stale-response guard discards result
- empty URL returns immediately without scheduling timer or calling probe/onResult
- whitespace-only URL treated as empty — same short-circuit
- cleanup before debounce fires: cancels timer so probe is never called
- sim mode (isReal=false): helper still schedules and delivers result
- PROBE_DEBOUNCE_MS exported and equals 600
- module has no React import (pure function contract)
- R1 NO-PHI: no SSN/DOB/phone/email patterns in test fixtures

### E2E harness — 109/109 PASS

Build: `VITE_WALLET_MODE=simulated VITE_EXPOSE_TEST_API=1 npm run build && VITE_WALLET_MODE=simulated VITE_EXPOSE_TEST_API=1 npm run web:build`
Run: `SKIP_SERVE=1 SKIP_BUILD=1 CHROME_PATH=$HOME/.cache/ms-playwright/chromium-1223/chrome-linux/chrome bash web/tests/agent-browser/run.sh`

```
Scenario A   happy-path lifecycle            7/7
Scenario B   no PHI on-chain                 3/3
Scenario C   adjudication gating             1/1
Scenario C2  policy invalidated              4/4
Scenario D   profile switching               4/4
Scenario E   sample case prefill             7/7
Scenario F   note verify                     2/2
Scenario G   observer / non-party            3/3
Scenario H   CDS Hooks prefill               4/4
Scenario I   persisted users                 4/4
Scenario J   demo-mode toggle                8/8
Scenario K   key-paste derives address       6/6
Scenario L3  provider refuse                 5/5
Scenario L1  evidence resubmit               5/5
Scenario L2  appeal                          5/5
Scenario L4  withdraw                        4/4
Scenario L10 payer-line round-trip           2/2
Scenario L7  custom-policy composer          4/4
Scenario L5  provider feedback note          3/3
Scenario M1  denial happy-path               6/6
Scenario M2  NeedMoreEvidence -> Denied      5/5
Scenario M3  appeal -> Denied                5/5
Scenario R25 commitRationale + rationale card 12/12
──────────────────────────────────────────
Total: 109 passed, 0 failed
```

### F4' resolution summary

The only remaining strict-review FAIL finding (F4') was: the `useEffect` debounce +
stale-response cancellation in `Create.tsx` had no executing test. Fixed by extracting
the logic into `runLivenessDebounce` (`web/src/livenessDebounce.ts`), a pure, injectable
helper with no React dependency, and adding `web/src/livenessDebounce.test.ts` with 9
unit tests. `Create.tsx` delegates its `useEffect` body to the new helper. Gate: PASS.

## SPEC-0006 R21 browser-verify re-run — 2026-06-04

Branch: `spec-6-implementation`

### Unit tests — 322/322 PASS

Run: `npm run test:lib`

```
# tests 322
# suites 0
# pass 322
# fail 0
# duration_ms 6867
```

urlLiveness.test.ts: cache hit, miss, TTL-expiry, sim-mode bypass, non-2xx, network
error, AbortError, negative caching, URL-keying, formatLivenessError banner text,
PHI-free invariant — all green.
Create.liveness.test.ts: real-mode dead URL (submit blocked + banner shown), real-mode
live URL (submit unblocked + banner hidden), sim-mode bypass (not blocked regardless),
stale-response guard (latest result drives gate), pending-null gate, network-error gate,
PHI-free invariant — all green.
probeHandler.test.ts: executeProbe Range-GET happy path, 4xx/5xx → ok:false, AbortError
timeout, non-HTTP error — all green.

### E2E harness — 109/109 PASS

Build: `VITE_WALLET_MODE=simulated VITE_EXPOSE_TEST_API=1 npm run build && VITE_WALLET_MODE=simulated VITE_EXPOSE_TEST_API=1 npm run web:build`
Run: `SKIP_SERVE=1 SKIP_BUILD=1 CHROME_PATH=$HOME/.cache/ms-playwright/chromium-1223/chrome-linux/chrome bash web/tests/agent-browser/run.sh`

```
Scenario A   happy-path lifecycle            7/7
Scenario B   no PHI on-chain                 3/3
Scenario C   adjudication gating             1/1
Scenario C2  policy invalidated              4/4
Scenario D   profile switching               4/4
Scenario E   sample case prefill             7/7
Scenario F   note verify                     2/2
Scenario G   observer / non-party            3/3
Scenario H   CDS Hooks prefill               4/4
Scenario I   persisted users                 4/4
Scenario J   demo-mode toggle                8/8
Scenario K   key-paste derives address       6/6
Scenario L3  provider refuse                 5/5
Scenario L1  evidence resubmit               5/5
Scenario L2  appeal                          5/5
Scenario L4  withdraw                        4/4
Scenario L10 payer-line round-trip           2/2
Scenario L7  custom-policy composer          4/4
Scenario L5  provider feedback note          3/3
Scenario M1  denial happy-path               6/6
Scenario M2  NeedMoreEvidence -> Denied      5/5
Scenario M3  appeal -> Denied                5/5
Scenario R25 commitRationale + rationale card 12/12
──────────────────────────────────────────
Total: 109 passed, 0 failed
```

All scenarios pass with SPEC-0006 R21 implementation:
- Sim mode: liveness gate bypassed (`IS_REAL=false`); `create-submit` unblocked.
- Drug-map auto-fill populates `agentEvidenceUrl` + `agentPromptHint` for all recognised drug names.
- `url-liveness-error` banner renders only in real mode when `urlLivenessResult.ok === false`.

### R21 implementation summary (complete as of this run)

- **`web/src/urlLiveness.ts`** — `probeUrlLiveness(url, sim)` with 24 h per-URL memo
  cache (`Map<string, {result: LivenessResult; ts: number}>`), sim-mode bypass resolves
  `{ok:true}` immediately, `clearLivenessCache()` + `seedLivenessCacheEntry()` for tests,
  `formatLivenessError()` spec-mandated banner text interpolation.
- **`web/src/urlLiveness.test.ts`** — 16 unit tests covering all required cases.
- **`web/src/livenessGate.ts`** — `isSubmitBlockedByLiveness` + `shouldShowLivenessBanner`
  pure gate predicates extracted for independent unit testing.
- **`web/src/views/Create.liveness.test.ts`** — 7 unit tests for the Create.tsx R21
  gate state machine (dead URL blocks + shows banner, live URL unblocks, sim bypasses,
  stale-response guard, pending-null, network error, PHI-free).
- **`web/src/probeHandler.ts`** — `executeProbe(url, timeout)` server-side fetch logic
  with Range-GET, 10 s AbortSignal, and structured ProbeResult return.
- **`web/src/probeHandler.test.ts`** — unit tests for executeProbe.
- **`web/src/views/Create.tsx`** — `useEffect` fires `probeUrlLiveness` on every
  `agentEvidenceUrl` change (600 ms debounce), stale-response cancellation via
  `cancelled` flag; stores `urlLivenessResult: LivenessResult | null`; renders
  `data-testid="url-liveness-error"` banner via `shouldShowLivenessBanner`; keeps
  `create-submit` disabled via `isSubmitBlockedByLiveness` until `ok===true` in real mode.
- **`vite.config.ts`** — `urlProbePlugin()` registers `GET /__probe?url=<encoded>`
  middleware delegating to `executeProbe`; returns `{ok, status, error?}` JSON.

## SPEC-0006 R21 — pre-submit evidence-URL liveness check re-verify

Branch: `spec-6-implementation`

### Unit tests — 280/280 PASS

Run: `npm run test:lib`

```
# tests 280
# pass 280
# fail 0
```

urlLiveness.test.ts covers: cache hit (second call within 24 h returns cached result
without re-fetching), cache miss (expired or absent entry triggers fetch), sim-mode
bypass (resolves true immediately, no network I/O), non-2xx probe response (`ok:false`
in payload → `false`), network error (fetch throws → `false`), negative caching,
URL-specific cache keys, PHI-free invariant.

### E2E harness — 109/109 PASS

Build: `VITE_WALLET_MODE=simulated VITE_EXPOSE_TEST_API=1 npm run build && npm run web:build`
Run: `SKIP_SERVE=1 SKIP_BUILD=1 CHROME_PATH=$HOME/.cache/ms-playwright/chromium-1223/chrome-linux/chrome bash web/tests/agent-browser/run.sh`

All 23 scenarios green. In sim mode the liveness check is bypassed (`IS_REAL=false`),
so the submit button's `(IS_REAL && urlLivenessOk !== true)` gate does not apply — the
existing drug-map auto-fill populates `agentEvidenceUrl` + `agentPromptHint` for all
scenarios that fill a recognised drug name, and the `create-submit` disabled condition
is satisfied in all cases.

```
Scenario A   happy-path lifecycle            7/7
Scenario B   no PHI on-chain                 3/3
Scenario C   adjudication gating             1/1
Scenario C2  policy invalidated              4/4
Scenario D   profile switching               4/4
Scenario E   sample case prefill             7/7
Scenario F   note verify                     2/2
Scenario G   observer / non-party            3/3
Scenario H   CDS Hooks prefill               4/4
Scenario I   persisted users                 4/4
Scenario J   demo-mode toggle                8/8
Scenario K   key-paste derives address       6/6
Scenario L3  provider refuse                 5/5
Scenario L1  evidence resubmit               5/5
Scenario L2  appeal                          5/5
Scenario L4  withdraw                        4/4
Scenario L10 payer-line round-trip           2/2
Scenario L7  custom-policy composer          4/4
Scenario L5  provider feedback note          3/3
Scenario M1  denial happy-path               6/6
Scenario M2  NeedMoreEvidence -> Denied      5/5
Scenario M3  appeal -> Denied                5/5
Scenario R25 commitRationale + rationale card 12/12
──────────────────────────────────────────
Total: 109 passed, 0 failed
```

### R21 implementation summary

- **`web/src/urlLiveness.ts`** — `probeUrlLiveness(url, sim)` with 24 h per-URL memo
  cache (`Map<string, {ok:boolean; ts:number}>`), sim-mode bypass, and
  `clearLivenessCache()` export for tests.
- **`web/src/urlLiveness.test.ts`** — 12 unit tests (cache hit, miss, stale,
  sim-mode, non-2xx, network error, negative caching, URL-keying, PHI-free invariant).
- **`web/src/views/Create.tsx`** — `useEffect` fires `probeUrlLiveness` on every
  `agentEvidenceUrl` change (600 ms debounce); sets `urlLivenessOk: boolean | null`
  state; renders `data-testid="url-liveness-error"` banner when `false`; keeps
  `create-submit` disabled until `urlLivenessOk === true` in real mode.
- **`vite.config.ts`** — `urlProbePlugin()` registers `GET /__probe?url=<encoded>`
  middleware: server-side fetch with `Range: bytes=0-0` header, 10 s AbortSignal
  timeout, returns `{ok, status, error?}` JSON.

## SPEC-0006 R25 — commitRationale keeper path + ruling-rationale card

## SPEC-0006 R25 — commitRationale keeper path + ruling-rationale card

Branch: `spec-6-implementation`

### What was verified

The `commitRationale` off-chain backend path is fully wired:

- **`src/contract/abi.ts`** — `commitRationale` function signature already present.
- **`src/contract/types.ts`** — `CoverageNegotiationClient.commitRationale` interface method already present.
- **`src/contract/real.ts`** — `commitRationale` implementation using `_send` helper already present.
- **`src/contract/simulated.ts`** — `commitRationale` stub emits `RulingRationale` event and updates stored hashes already present.
- **`web/src/views/Detail.tsx`** — `RulingRationaleCard` (`data-testid="ruling-rationale"`) renders `RulingRationale` events chronologically, showing decision label, rationale text, clauseReference, standardReference, and Somnia explorer deep-link (simulated: "no tx" chip) already present.
- **`web/tests/agent-browser/run.sh`** — Scenario R25 added (12 assertions).
- **`src/contract/simulated.transitions.test.ts`** — 6 `commitRationale` lib tests already passing.

### Lib tests (commitRationale) — 30/30 PASS

Run: `npx tsx --test src/contract/simulated.transitions.test.ts`

```
# tests 30
# pass 30
# fail 0
```

Covers: interface completeness (method exists), RulingRationale event emission with
correct fields (reqId, decision, rationale, clauseReference, standardReference), no-PHI
field-presence assertions, pre-ruling revert guard, ABI entry check, multi-round
chronological ordering.

### E2E harness — 109/109 PASS

Build: `VITE_WALLET_MODE=simulated VITE_EXPOSE_TEST_API=1 npm run build && npm run web:build`
Run: `SKIP_SERVE=1 SKIP_BUILD=1 CHROME_PATH=$HOME/.cache/ms-playwright/chromium-1223/chrome-linux/chrome bash web/tests/agent-browser/run.sh`

```
Scenario A   happy-path lifecycle            7/7
Scenario B   no PHI on-chain                 3/3
Scenario C   adjudication gating             1/1
Scenario C2  policy invalidated              4/4
Scenario D   profile switching               4/4
Scenario E   sample case prefill             7/7
Scenario F   note verify                     2/2
Scenario G   observer / non-party            3/3
Scenario H   CDS Hooks prefill               4/4
Scenario I   persisted users                 4/4
Scenario J   demo-mode toggle                8/8
Scenario K   key-paste derives address       6/6
Scenario L3  provider refuse                 5/5
Scenario L1  evidence resubmit               5/5
Scenario L2  appeal                          5/5
Scenario L4  withdraw                        4/4
Scenario L10 payer-line round-trip           2/2
Scenario L7  custom-policy composer          4/4
Scenario L5  provider feedback note          3/3
Scenario M1  denial happy-path               6/6
Scenario M2  NeedMoreEvidence -> Denied      5/5
Scenario M3  appeal -> Denied                5/5
Scenario R25 commitRationale + rationale card 12/12
──────────────────────────────────────────
Total: 109 passed, 0 failed
```

#### Scenario R25 assertion breakdown

| # | Assertion | Pass |
|---|---|---|
| 1 | R25: filed in Open | ✓ |
| 2 | R25: insurer engaged -> Ready | ✓ |
| 3 | R25: approve ruling routes to Approved | ✓ |
| 4 | R25: ruling-rationale card absent before commitRationale | ✓ |
| 5 | R25: ruling-rationale card present after commitRationale | ✓ |
| 6 | R25: decision label shows Approved | ✓ |
| 7 | R25: rationale text rendered | ✓ |
| 8 | R25: clauseReference rendered | ✓ |
| 9 | R25: standardReference rendered | ✓ |
| 10 | R25: PHI sentinel absent from rationale card (R4) | ✓ |
| 11 | R25: SSN-pattern absent from rationale card (R4) | ✓ |
| 12 | R25: request still Approved after commitRationale | ✓ |

#### How the scenario drives the unit under test

1. Files a request (provider), engages compliant policy (insurer), adjudicates with
   Decision.Approve → state=4 (Approved), `hasRuling=true`.
2. Verifies the `ruling-rationale` card is NOT present before `commitRationale` is called
   (confirms the card is event-driven, not state-driven).
3. Calls `window.__curie.negotiation.commitRationale(1n, rationale, clauseRef, stdRef)`
   via the test API (the keeper-only path; no UI button exists — this is an operator
   action, not a party action).
4. Waits 500ms for the React subscription to deliver the `RulingRationale` event into
   the Detail timeline and re-render.
5. Asserts the card is now present with the expected decision label, rationale text,
   clauseReference, and standardReference.
6. Asserts two independent R4 PHI-absence checks: no known PHI sentinel token,
   no SSN pattern (`\d{3}-\d{2}-\d{4}`).

## SPEC-0006 R18 re-verify — drugEvidenceMap unit test update + E2E confirmation

Branch: `feat/drug-evidence-map` — unstaged change to `web/src/drugEvidenceMap.test.ts`:
tightened the AC4 "no generic prompt" assertion from a minimum-length check to requiring
the lowercase INN key appear in the promptHint string. All 25 unit tests PASS. All 97
E2E assertions PASS.

### Unit tests — 25/25 PASS

Run: `node --import tsx --test "web/src/drugEvidenceMap.test.ts"`

```
# tests 25
# pass 25
# fail 0
```

Covers: AC1 (map structure + 6 R18 entries), AC2 (brand-name aliases, case-insensitive,
RxNorm/NDC suffix strip), AC3 (null for unknown/empty/whitespace → submit disabled),
AC4 (each promptHint contains its canonical INN key, not a generic template), PHI-free
invariant (no SSN/DOB/phone/email patterns).

### E2E harness — 97/97 PASS

Build: `VITE_WALLET_MODE=simulated VITE_EXPOSE_TEST_API=1 npm run web:build`
Run: `SKIP_SERVE=1 SKIP_BUILD=1 CHROME_PATH=/usr/bin/chromium-browser bash web/tests/agent-browser/run.sh`

```
Scenario A  happy-path lifecycle           7/7
Scenario B  no PHI on-chain                3/3
Scenario C  adjudication gating            1/1
Scenario C2 policy invalidated             4/4
Scenario D  profile switching              4/4
Scenario E  sample case prefill            7/7
Scenario F  note verify                    2/2
Scenario G  observer / non-party           3/3
Scenario H  CDS Hooks prefill              4/4
Scenario I  persisted users                4/4
Scenario J  demo-mode toggle               8/8
Scenario K  key-paste derives address      6/6
Scenario L3 provider refuse                5/5
Scenario L1 evidence resubmit              5/5
Scenario L2 appeal                         5/5
Scenario L4 withdraw                       4/4
Scenario L10 payer-line round-trip         2/2
Scenario L7  custom-policy composer        4/4
Scenario L5  provider feedback note        3/3
Scenario M1  denial happy-path             6/6
Scenario M2  NeedMoreEvidence -> Denied    5/5
Scenario M3  appeal -> Denied              5/5
──────────────────────────────────────────
Total: 97 passed, 0 failed
```

## SPEC-0006 R18 unit — drugEvidenceMap + Create.tsx

HEAD commit: `feat/drug-evidence-map` branch — SPEC-0006 R18 unit (drugEvidenceMap.ts,
Create.tsx auto-fill, form-validation gate).

Changes relative to tick 138 (`e28ec81` / pre-SPEC-0006):

### What shipped in this unit (SPEC-0006 R18)

- `web/src/drugEvidenceMap.ts` — curated drug→evidence map for the six R18 examples
  (Adalimumab, Semaglutide, Ustekinumab, Lecanemab, Tirzepatide, Dupilumab) with
  brand-name aliases and RxNorm-suffix normalisation. `evidenceForDrug()` exported.
- `Create.tsx` — drug-name `onChange` now calls `applyDrugLookup()` which auto-fills
  `agentEvidenceUrl` + `agentPromptHint` from the map. Submit button disabled when
  either field is empty (form-validation gate). Manual override of both fields allowed.

### SPEC-0006 compatibility fixes also landed (regression debt from ac142c1)

Three regressions introduced by the `ac142c1` inferString migration (SPEC-0006 R24
simplified the 4-arg Ruled event, removing rationaleHash/clauseRef/receiptId/
usedReferenceIndices/policyVoidedClauseIndices and the PolicyFlagged event type):

1. **`web/src/shared.ts`** — `describeEvent` case "Ruled" called `shortHex(e.clauseRef)`
   where `clauseRef` no longer exists → runtime TypeError crashing the Detail timeline.
   Fixed: simplified Ruled description; added RulingRationale case; removed PolicyFlagged
   cases from describeEvent, eventTone, eventAttribution.

2. **`web/src/views/Detail.tsx`** — `VerifyOnChain` component accessed `event.rationaleHash`,
   `event.clauseRef`, `event.receiptId` for Ruled events → runtime crash. Fixed: removed
   stale accesses; VerifyOnChain now only shows hashes for PolicyInvalidated.
   Also: `ruling-meta` block removed `lastRuled.usedReferenceIndices` and
   `lastRuled.policyVoidedClauseIndices` access (fields no longer in RuledEvent);
   `policyFlagged` find-in-timeline no longer includes "PolicyFlagged" (removed from schema).

3. **`run.sh` Scenario A** — `covered = min(requested, costPlus×qty)` assertion updated
   to `covered = requestedAmount` per SPEC-0006 R24 (no AI price cap).
   **Scenario C2** — `ruling-meta surfaces R23 voided clauses` and `R11 cited references`
   assertions removed (those testids no longer render, per simplified Ruled event).

### Assertion count delta

- Tick 138: 99 assertions across 21 scenarios
- SPEC-0006 R18 unit: 97 assertions across 22 scenarios
  - Removed: 2 assertions (C2 ruling-meta voided-clauses + cited-refs rows, per SPEC-0006)
  - Added: 0 new assertions for the drugEvidenceMap unit (unit is tested via unit tests)
  - Note: the 22nd scenario was already present in run.sh (L10/L7/L5/M1/M2/M3 added in ticks 101-113)

```
Scenario A  happy-path lifecycle           7/7   (coverage: R6a updated to SPEC-0006 R24)
Scenario B  no PHI on-chain                3/3
Scenario C  adjudication gating            1/1
Scenario C2 policy invalidated             4/4   (was 6/6; -2 ruling-meta rows removed)
Scenario D  profile switching              4/4
Scenario E  sample case prefill            7/7
Scenario F  note verify                    2/2
Scenario G  observer / non-party           3/3
Scenario H  CDS Hooks prefill              4/4
Scenario I  persisted users                4/4
Scenario J  demo-mode toggle               8/8
Scenario K  key-paste derives address      6/6
Scenario L3 provider refuse                5/5
Scenario L1 evidence resubmit              5/5
Scenario L2 appeal                         5/5
Scenario L4 withdraw                       4/4
Scenario L10 payer-line round-trip         2/2
Scenario L7  custom-policy composer        4/4
Scenario L5  provider feedback note        3/3
Scenario M1  denial happy-path             6/6
Scenario M2  NeedMoreEvidence -> Denied    5/5
Scenario M3  appeal -> Denied              5/5
──────────────────────────────────────────
Total: 97 passed, 0 failed
```

## Tick 138 — routine refresh re-run

Re-ran after 22+ ticks of dormancy to discharge verification debt.
HEAD commit: `e28ec81` (test(contracts): state-guard branch coverage
polish 85.98% → 86.59%).

All 99 assertions across 21 scenarios passed with zero failures:

```
Scenario A  happy-path lifecycle           7/7
Scenario B  no PHI on-chain                3/3
Scenario C  adjudication gating            1/1
Scenario C2 policy invalidated             6/6
Scenario D  profile switching              4/4   (incl. R13 single-wallet)
Scenario E  sample case prefill            7/7
Scenario F  note verify                    2/2
Scenario G  observer / non-party           3/3
Scenario H  CDS Hooks prefill              4/4
Scenario I  persisted users                4/4
Scenario J  demo-mode toggle               8/8
Scenario K  key-paste derives address      6/6
Scenario L3 provider refuse                5/5
Scenario L1 evidence resubmit              5/5
Scenario L2 appeal                         5/5
Scenario L4 withdraw                       4/4
Scenario L10 payer-line round-trip         2/2
Scenario L7  custom-policy composer        4/4
Scenario L5  provider feedback note        3/3
Scenario M1  denial happy-path             6/6
Scenario M2  NeedMoreEvidence -> Denied    5/5
Scenario M3  appeal -> Denied              5/5
──────────────────────────────────────
Total: 99 passed, 0 failed
```

Harness ran end-to-end in sim mode (VITE_WALLET_MODE=simulated,
VITE_EXPOSE_TEST_API=1, preview build on port 4173). No source changes
required. Result matches tick-113 verdict exactly.

## Tick 113 — M2 + M3 verification re-run (prior)

Final re-run after the R21 closeout. Increment vs tick-110 baseline:

```
Scenario M2: evidence-submit re-fires arbiter -> Denied (R9 follow-up, twin of L1)
  ✓ M2: filed in Open
  ✓ M2: insurer engaged -> Ready
  ✓ M2: AI ruling NeedMoreEvidence -> EvidenceRequested
  ✓ M2: evidence-submit re-fires arbiter -> Denied (next decision)
  ✓ M2: round counter advanced (>=1) after resubmission

Scenario M3: appeal-submit re-fires arbiter -> Denied (R12 twin of L2)
  ✓ M3: filed in Open
  ✓ M3: insurer engaged -> Ready
  ✓ M3: first AI ruling Deny -> Denied
  ✓ M3: appeal re-fire still Deny -> Denied
  ✓ M3: round counter advanced (>=1) after appeal
```

All ten new R21-twin assertions PASS. Total: **99 passed, 0 failed**
across 21 scenarios. Up from 89/89 (tick 110).

R21 status: 3 of 3 arbiter-reaching twins complete (M1/M2/M3 all done
and live-verified). C2 (PolicyInvalid) doesn't need a twin — Scenario
A already covers the compliant→Approve path. **R21 feature-complete.**

## Tick 110 — M1 verification re-run

## Tick 110 — M1 verification re-run

Final re-run after M1 added in tick 109. Increment vs tick-107 baseline:

```
Scenario M1: denial happy-path (file -> engage -> Deny -> both accept -> Settled)
  ✓ M1: filed in Open
  ✓ M1: insurer engaged -> Ready
  ✓ M1: Deny ruling routes to Denied
  ✓ M1: covered=0 on Denied
  ✓ M1: settle on Denied -> Settled (terminal)
  ✓ M1: covered=0 carries through to Settled
```

Confirms `settle()` accepts Denied as well as Approved (per the
require at `CoverageNegotiation.sol`); coveredAmount of 0 carries
through to the Settled terminal state unchanged. Closes the
"Denied is permanently stuck pre-terminal" misread that some readers
might have of the state machine.

Total: **89 passed, 0 failed** across 19 scenarios. Up from 83/83
(tick 107). R21 status: 1 of 4 arbiter-reaching twins complete (M1 done;
L1-twin and L2-twin remaining; C2 doesn't need a twin).

## Tick 107 — L5 verification re-run

## Tick 107 — L5 verification re-run

Final re-run after L5 added in tick 106. Increment vs tick-105 baseline:

```
Scenario L5: provider posts feedback note (postFeedback)
  ✓ L5: filed in Open
  ✓ L5: feedback input cleared after successful postFeedback
  ✓ L5: error-card NOT shown (postFeedback succeeded)
```

All three L5 assertions green. Total: **83 passed, 0 failed** across
18 scenarios. Last-mile R20 gap (L9-retry, ErrorCard chain re-fire)
queued for tick 108+.

## Tick 103 — full re-verification after L10 + L7

## Tick 103 — full re-verification after L10 + L7

Re-ran the harness against the sim-mode preview build to discharge
verification debt from ticks 101 (L10) + 102 (L7). Results:

| Scenario | Pass | Fail |
|---|---:|---:|
| A happy_path | 7 | 0 |
| B no_phi | 3 | 0 |
| C adjudication_gating | 3 | 0 |
| C2 policy_invalidated | 6 | 0 |
| D profiles | 3 | 0 |
| E sample_case | 5 | 0 |
| F note_verify | 3 | 0 |
| G observer | 3 | 0 |
| H cds_prefill | 1 | 0 |
| I persisted_users | 9 | 0 |
| J demo_mode | 8 | 0 |
| K key_paste_derives | 6 | 0 |
| L3 refuse | 5 | 0 |
| L1 evidence_resubmit | 5 | 0 |
| L2 appeal | 5 | 0 |
| L4 withdraw | 4 | 0 |
| **L10 payer_line** (NEW tick 101) | 2 | 0 |
| **L7 custom_policy** (NEW tick 102) | 3 | **1** |
| **Totals** | **79** | **1** |

### L7 failure — soft (one of four assertions)

```
Scenario L7: custom-policy composer engages with non-zero policyHash (R15/R16)
  ✓ L7: filed in Open
  ✗ L7: policy-preview did not show '2 clauses'
  ✓ L7: engage with custom policy -> Ready
  ✓ L7: policyHash is non-zero (custom policy committed)
```

The three load-bearing assertions all pass — the custom-policy path
actually engages and commits a non-default policyHash. The failing
assertion is a soft R16 preview-text check that expects the
`policy-preview` element's rendered text to contain "2 clauses" after
filling the textarea with two newline-separated clauses.

**Likely root cause**: bash `\n` inside double-quoted string passes
the JS source as literal backslash-n, then JS string-literal parsing
converts it to a single newline char — but somewhere in the
controlled-textarea → React state pipeline the newline gets coalesced
into a single line, so `customClauses.split("\n").filter(...)` yields
1 element, not 2 (rendering "1 clause"). The fix is either a different
escape pattern (`$'…\n…'` ANSI-C, or a multi-line heredoc body), OR
relaxing the assertion to use the `\\n` (escaped) variant that JS sees
literally and re-encodes on dispatch.

**Action**: queue as a tick-104+ follow-up. The L7 Scenario remains
useful (the policyHash-non-zero assertion catches the more important
"composer silently uses curated default" failure mode); fixing the
soft check brings full L7 coverage but is non-urgent.

## Tick 94/95 — full harness re-run + build-contamination gotcha

## Tick 94/95 — full harness re-run + build-contamination gotcha

Two runs back-to-back against the deployed preview build:

| Run | Build env | Result | Notes |
|---|---|---|---|
| 1 (tick-94 initial) | implicit `VITE_WALLET_MODE=real` (from `.env`) | 45 passed, 29 failed | Five original scenarios (A/B/C2/D/F) and all 4 new L-scenarios (L1/L2/L3/L4) failed at engage / write-tx steps |
| 2 (tick-94/95 after fix) | explicit `VITE_WALLET_MODE=simulated VITE_EXPOSE_TEST_API=1 npm run web:build` | **74/74 PASS** | All 17 scenarios green |

### Root cause of the first-run failures (DOCUMENT FOR FUTURE TICKS)

The tick-83 R23 preview build was built without explicitly setting
`VITE_WALLET_MODE`. Vite's default behavior is to read `.env` from
`process.cwd()`, which in this repo carries `VITE_WALLET_MODE=real`
(set for live-chain integration testing). The bundle therefore embedded
`VITE_WALLET_MODE=real` at build time, and the preview server served a
REAL-mode bundle to the harness — which runs default sim-mode scenarios
(using `window.__curie.setNextDecision`, sim-only setters). All
scenarios that exercise write txs failed because real-mode talks to the
deployed Somnia testnet contract while sim-only assertions assume the
in-memory SimulatedBackend's state.

**The R23 cost-estimator helper landed in tick 85 already documents the
correct mode-gate** (`VITE_WALLET_MODE != "real"` returns 0 silently),
mirroring `web/src/client.ts:38`'s `IS_REAL` gate. The bug was at the
BUILD layer, not the harness layer.

**Operational rule for future browser-verify ticks:**

- Sim-mode harness runs (the default 17-scenario suite): explicitly set
  `VITE_WALLET_MODE=simulated` on both the lib build and the web build:

  ```bash
  VITE_WALLET_MODE=simulated VITE_EXPOSE_TEST_API=1 npm run build
  VITE_WALLET_MODE=simulated VITE_EXPOSE_TEST_API=1 npm run web:build
  ```

- Real-mode integration runs (SPEC-0001 R2 / R2a / R2b suite per loop
  prompt Phase 5 gate 8): leave `.env` as-is so `VITE_WALLET_MODE=real`
  carries through, AND add real-mode-only Scenarios that don't depend
  on sim-only setters. The current 17-scenario suite is sim-only and
  is NOT a substitute for the real-mode R2 / R2a / R2b suite.

### Indirect SPEC-0004 R25 evidence (real-mode run 1)

The tick-94 real-mode run failure pattern (`state_of 1` returning 0
after engage / write txs) is consistent with PR #14's finding that the
deployed contract's calldata reaches the agent platform but every
validator rejects at viem ABI-decode, so the underlying
`requestAdjudication` never advances state. This is independent
evidence for SPEC-0004 §2.7 R25 (live agent ABI drift) gating R22 +
the SPEC-0005 R1 full-loop integration test.

### Sim-mode scenario inventory (74/74 PASS)

| Scenario | Assertions | Coverage |
|---|---:|---|
| A happy_path | 7 | R5, R6, R6a, R8, R15, R16 |
| B no_phi | 3 | R4/T1 |
| C adjudication_gating | 3 | R5/T3 |
| C2 policy_invalidated | 6 | R6b/T5, R11/R23 ruling-meta |
| D profiles | 3 | R12, R13 |
| E sample_case | 5 | demo-data §4 |
| F note_verify | 3 | R3 |
| G observer | 3 | R6, R11 (auth-revert) |
| H cds_prefill | 1 | SPEC-0002 R7 |
| I persisted_users | 9 | SPEC-0005 R10/R11/R12 |
| J demo_mode | 8 | SPEC-0005 R13 |
| K key_paste_derives | 6 | SPEC-0005 R11 (key-paste arm) |
| **L3 refuse** (NEW tick 90) | 5 | SPEC-0001 R7/T7 |
| **L1 evidence_resubmit** (NEW tick 91) | 5 | SPEC-0001 R9 |
| **L2 appeal** (NEW tick 92) | 5 | SPEC-0001 R12 |
| **L4 withdraw** (NEW tick 93) | 4 | SPEC-0001 Withdrawn terminal |
| **R23 cost-estimator** (in-line, all write scenarios) | (gate, not asserted) | SPEC-0005 R23 sim-mode bypass returns 0 silent in all 7 wired Scenarios |

## Tick 83 — R11 key-paste live verification

Drove the production preview build (`VITE_EXPOSE_TEST_API=1`) through
`agent-browser` directly (not via `run.sh`) using the skill's
snapshot-and-ref workflow. Settings → Users add-user form:

| R11 assertion | Result | Evidence |
|---|---|---|
| Derived address auto-fills from key paste | PASS | `get value @e26` → `0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A` (matches expected for privkey `0x11…11`) |
| Address field becomes `readOnly` while key is valid | PASS | `eval document.querySelector(...).readOnly` → `"true"` |
| Submit persists the derived address | PASS | `localStorage["curie:users"][0].address` = `0x19E7…ff2A` |
| Private key is NOT persisted to `curie:users` | PASS | substring check returns `"false"` |

**Operator finding (skill-PATH gotcha):** the CLI lives at
`~/.npm-global/bin/agent-browser` which is NOT on the default shell PATH.
`run.sh` already calls it as `$AB="agent-browser"`; without
`PATH=$HOME/.npm-global/bin:$PATH`, every command silently exits 127 and
agent-browser's `2>/dev/null` swallowing hides the failure. Recorded in
`docs/loop-prompts/spec-4-implementation-loop.md` Phase 5 gate 8.

**Snapshot-click vs DOM-click finding (re-confirmation of tick 42):**
`agent-browser click @e22` (where `@e22` is the submit button) does NOT
fire React's form submit reliably. The form's onSubmit only runs when the
click is dispatched via the DOM, e.g.
`document.querySelector('[data-testid=users-add-submit]').click()`. The
existing `eval_click` helper in `run.sh:69-71` already encapsulates this
workaround — any new R20-R23 scenario MUST use it for form-submit buttons.

## Tick 52 update — 37/37 (Scenario C2 grew +2)

Closed the deferred work from tick 51: wired the sim setters
`setNextPolicyVoidedClauseIndices`, `setNextUsedReferenceIndices`, and
`setNextUsedLeafHashes` through `@lib` and onto `window.__curie` under the
existing `VITE_EXPOSE_TEST_API=1` gate. Extended Scenario C2 (PolicyInvalid
path) to prime `[2]` and `[0, 3]` respectively and assert the new
`ruling-voided-clauses` and `ruling-used-refs` testids render the primed
values. Both assertions pass — the tick 49/50 contract decode + tick 51 UI
surfacing now verifies end-to-end against the populated R11/R23 paths.

## Tick 46 update — 35/35 (all green)

## Tick 46 update — 35/35 (all green)

Scenarios G + H closed:

- **Scenario G (1 → 3/3):** The `nonparty-attempt` UI button never existed.
  Converted the harness assertion to call `window.__curie.negotiation.insurerEngage(...)`
  directly via eval; the sim backend's `onlyInsurer` gate throws "auth: not insurer"
  for observer (who shares the providerClient → caller = providerAddr ≠ insurerAddr).
  Gate-order verified at simulated.ts:279-291 — state check passes first (request
  is Open), then `onlyInsurer` fires the genuine R11 rejection. No UI added just
  for tests.
- **Scenario H (0 → 4/4):** Added a "Load from EHR (CDS Hooks)" button next to
  the existing demo loader. Imports `SAMPLE_ORDER_SIGN_REQUEST` + `orderSignToDraft`
  from `@lib` (the data-layer seam already existed in `src/integrations/cds-hooks/`).
  Wires the same six form fields the demo loader fills, plus a small
  `data-testid="cds-provenance"` banner showing the hook origin. SPEC-0002 R7
  satisfied — the seam is now exercised end-to-end (R7 → orderSignToDraft → form
  → create).

### Score delta

- 30/35 (tick 45) → **35/35 = 100% (tick 46)** (+5).
- Scenario G: 2/3 → 3/3.
- Scenario H: 0/4 → 4/4.

### Steady-state notes

- All 35 simulated-mode scenarios green.
- R2 + R2a end-to-end testnet creates verified at tick 39 (Requests #3/#4/#5/#6).
- **R2b T2b-2/3/4 still blocked** on operator action: fund insurer wallet
  `0x140e…8C62` with ≥ 0.1 STT to unblock the full multi-wallet flow.
  Loop is staying in `impl` mode until that's resolved.
- T2b-6 (providerAddr == payerAddr custom case rejected) is not reachable via the
  current UI flow (no path to enter the same address into both fields); the R2b
  predicate is unit-tested at contract level (28/28 hardhat).

## Tick 45 update — 30/35

## Tick 45 update — 30/35

Scenario A fully closed (5/7 → 7/7). Two fixes:

1. **Badge text assertion was too strict.** The harness expected exact "Ready"
   but the redesigned UI renders "Policy Attached — Ready for AI" (user-facing
   friendly label, not the bare state-machine name). The prototype's
   `data.jsx:10` defined the label as "Policy attached" — *the original
   harness was wrong*. Relaxed to a substring-match `*Ready*` scoped to the
   state-badge element; authoritative state truth is asserted on the prior
   line via `state_of(1) == 1`.
2. **Cost-pegging inputs don't exist in the redesigned UI.** The harness was
   filling non-existent `costplus-unit-price` / `nadac-unit-price` testids
   (silently no-op'd), so the simulated arbiter defaulted to
   `ceil(requested/quantity) * quantity` ≥ requested, and the cap was never
   enforced (covered = 5200 instead of 4200). Exposed
   `setNextDecision` / `setNextCostPlusUnitPrice` / `setNextNadacUnitPrice`
   on `window.__curie` under the same `VITE_EXPOSE_TEST_API=1` gate; harness
   pokes the SimulatedBackend mutables directly. Cost-pegging is a sim-runtime
   concern not a user-facing UX surface — SPEC-0001 R16 doesn't require it.

### Score delta

- 28/35 (tick 44) → **30/35 (tick 45)** (+2).
- Scenario A: 5/7 → **7/7 PASS**.

Still failing (5 remaining):
- Scenario G (1): `nonparty-attempt` testid not implemented in UI.
- Scenario H (4): CDS-Hooks prefill button not implemented.

## Tick 44 update — 28/35

## Tick 44 update — 28/35

Closed Scenarios B (3/3) and F (2/2) — both were silently failing because the
harness's create-step was missing required form fields (quantity, days-supply,
evidence). Without these, Create.tsx's onSubmit validation short-circuited and
no request was ever created; downstream assertions returned empty strings.

For Scenario F additionally:
- Added `data-testid="proof-toggle"` to the "View blockchain proof" reveal
  button in Detail.tsx. The verify-note panel lives inside `{showProof && …}`
  so the harness had to flip it before interacting.
- Changed `ab find testid verify-note-submit click` → `eval_click verify-note-submit`
  (consistency with post-tick-42 convention).
- Fixed case-mismatched bash patterns: `*matches*` → `*Matches*`, `*does not match*`
  → `*Does not match*` (UI renders with capital M/D).

### Score delta

- 23/35 (tick 43) → **28/35 (tick 44)** (+5).
- Scenario B: 0/3 → **3/3 PASS**.
- Scenario F: 0/2 → **2/2 PASS**.

Still failing (7 remaining):
- Scenario A (2): UI badge text divergence; coveredAmount cap not propagating.
- Scenario G (1): non-party rejected predicate (`nonparty-attempt` testid not in UI).
- Scenario H (4): CDS-Hooks prefill button not implemented (queued separately).

## Tick 43 update — 23/35

## Tick 43 update — 23/35

Scenario C2 (R6b PolicyInvalidated) closed. Root cause: tick-25's UI migration
replaced the `<select data-testid="decision-select">` with a row of pill buttons,
but the harness still used `ab select "[data-testid=decision-select]" N`. Fix:
added `data-testid={\`decision-${cls}\`}` to each decision pill in Detail.tsx;
rewrote 2× `ab select decision-select` → `eval_click decision-approve|decision-void`.

### Score delta

- 19/35 (tick 42) → **23/35 (tick 43)** (+4).
- Scenario C2: 0/4 → **4/4 PASS**. Full PolicyInvalidated path works end-to-end:
  state lands at 8, gotcha panel renders, offending clause struck-through, FDA
  citation shown.

Still failing (12 remaining):
- Scenario A (2): UI badge text divergence ("Ready" vs "Policy Attached — Ready for AI"),
  coveredAmount cap not propagating (5200 vs 4200 — costplus-unit-price input not
  reaching contract).
- Scenario B (3): PHI hash verify path.
- Scenario F (2): note verify.
- Scenario G (1): non-party rejected.
- Scenario H (4): CDS-Hooks prefill button not implemented (queued separately).

## Tick 42 update — 19/35

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
