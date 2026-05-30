# Coverage — spec-4-implementation branch

---

## Tick 57 — full src/ coverage measurement

**Date:** 2026-05-30 · **Branch:** `spec-4-implementation`
**Tool:** `node --experimental-test-coverage` via `npx tsx --test "src/**/*.test.ts"`.
**Tests run:** 85/85 PASS.

### Raw tool output (coverage table)

```
# -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
# file                                              | line % | branch % | funcs % | uncovered lines
# -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
# src                                               |        |          |         |
#  contract                                         |        |          |         |
#   simulated.auth.test.ts                          | 100.00 |   100.00 |  100.00 |
#   simulated.ts                                    |  93.70 |    68.63 |   66.67 | 76 93-94 112 121-125 135-143 145 147-149 151 153-157 159-161 163-165 173-175 186 188-189 217-218 261 286-293
#  profiles                                         |        |          |         |
#   profiles.test.ts                                | 100.00 |    87.50 |  100.00 |
#   profiles.ts                                     |  84.92 |    75.00 |   66.67 | 9-27
#  protocol                                         |        |          |         |
#   ladders.test.ts                                 | 100.00 |   100.00 |  100.00 |
#   ladders.ts                                      | 100.00 |   100.00 |  100.00 |
#   packet.test.ts                                  | 100.00 |   100.00 |  100.00 |
#   packet.ts                                       | 100.00 |   100.00 |  100.00 |
#   revertReasonMap.test.ts                         | 100.00 |   100.00 |  100.00 |
#   revertReasonMap.ts                              | 100.00 |   100.00 |  100.00 |
#   scenarioFixtures.test-helpers.ts                | 100.00 |    87.50 |  100.00 |
#   scenarios.commercial-policy-void.test.ts        | 100.00 |    84.21 |  100.00 |
#   scenarios.medicaid-denied-then-appealed.test.ts | 100.00 |    84.21 |  100.00 |
#   scenarios.partd-approvable.test.ts              | 100.00 |   100.00 |  100.00 |
#   somniaInterfaceDrift.test.ts                    | 100.00 |   100.00 |  100.00 |
#  types                                            |        |          |         |
#   coverage.types.ts                               | 100.00 |   100.00 |  100.00 |
# -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
# all files                                         |  98.01 |    87.50 |   91.58 |
# -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
```

**Note on scope:** Node's `--experimental-test-coverage` only instruments files that
are transitively imported by the test suite. Modules with no test importing them do
not appear in the table — they carry an effective 0% coverage that the tool does not
surface. These are assessed manually in the per-module table below.

### Per-module coverage

| Module | Line % | Branch % | Function % | Status | Notes |
|---|---|---|---|---|---|
| src/protocol/ladders.ts | 100 | 100 | 100 | PASS | |
| src/protocol/packet.ts | 100 | 100 | 100 | PASS | Carried from tick 38; pinned formula tests |
| src/protocol/revertReasonMap.ts | 100 | 100 | 100 | PASS | 9 assertions |
| src/protocol/scenarioFixtures.test-helpers.ts | 100 | 87.5 | 100 | PASS | Test-helper; exercised via scenario test files |
| src/contract/simulated.ts | 93.70 | 68.63 | 66.67 | GAP | Branch % below 85% threshold; uncovered lines include several event-emission branches for less-common transitions (postFeedback, onRulingTimeout, settle, withdraw, refuse) |
| src/contract/real.ts | n/a | n/a | n/a | EXEMPT | Integration-tested against real chain; not unit-tested by design. Coverage not included in gap list per standing convention. |
| src/profiles/profiles.ts | 84.92 | 75.00 | 66.67 | GAP | Line % just below 85%; branch % below threshold. Uncovered lines 9–27 are import + interface declarations counted by node coverage as non-executed. Uncovered functions: `addProfile`, `getProfile` (no test exercises them). |
| src/content/content.ts | 0 | 0 | 0 | GAP | No test imports this module. `hashContent` and `ContentStore` class are completely untested. |
| src/integrations/cds-hooks/fixture.ts | 0 | 0 | 0 | GAP | No test imports this module. |
| src/integrations/cds-hooks/mapper.ts | 0 | 0 | 0 | GAP | No test imports this module. `mapOrderSign` pure function is fully testable without I/O. |
| src/config/networks.ts | 0 | 0 | 0 | GAP | No test imports this module. Mostly typed constants; low risk but contributes to gap count. |
| src/wallet/wallet.ts | 0 | 0 | 0 | GAP | No test imports this module. `SimulatedWallet` is exercised implicitly via `simulated.ts` tests but is not directly covered. |
| src/index.ts | 0 | 0 | 0 | GAP | Top-level re-export barrel; not imported by any test. Zero executable lines — pure re-exports. Low-value gap. |
| src/types/coverage.types.ts | 100 | 100 | 100 | PASS | Type-only + enum constants; imported by tested modules. |

### Verdict

The modules tracked by the tool produce:

- **Aggregate (tool-measured files only):** 98.01% line / 87.50% branch / 91.58% function — above threshold.
- **Holistic (including untested modules):** multiple files at 0% pull the true weighted average below 85%.

Key gaps by severity:

1. **`src/contract/simulated.ts` branch 68.63%** — below the 85% branch threshold. The uncovered branches correspond to lesser-exercised transitions: `postFeedback`, `onRulingTimeout`, `settle`, `withdraw`, `refuse`, and several guard-failure paths in `requestAdjudication`/`appeal`.
2. **`src/profiles/profiles.ts` line 84.92% / branch 75%** — narrowly below threshold on both. `addProfile` and `getProfile` methods are untested.
3. **`src/content/content.ts` 0%** — `hashContent` is a one-liner wrapping `ethers.keccak256`; trivial to test.
4. **`src/integrations/cds-hooks/mapper.ts` 0%** — `mapOrderSign` is a pure function; high-value, easily testable.
5. **`src/integrations/cds-hooks/fixture.ts` 0%** — fixture builder; testable without I/O.
6. **`src/wallet/wallet.ts` 0%** — `SimulatedWallet` reachable without chain; `RealWallet` requires a provider.
7. **`src/config/networks.ts` 0%** / **`src/index.ts` 0%** — typed constants + re-export barrel; low executable complexity.

Weighted overall (all modules, including untested): estimated **~55% line / ~45% branch** once zero-coverage modules are counted proportionally by LOC.

Steady-state threshold: ≥ 85% line + branch across all `src/` modules.

**VERDICT: FAIL** — threshold not met holistically. The tool-measured subset passes (98% line / 87.5% branch), but `content.ts`, `cds-hooks/mapper.ts`, `cds-hooks/fixture.ts`, `wallet.ts`, `config/networks.ts` have no coverage at all, and `simulated.ts` branch coverage (68.63%) is below threshold even within the measured set.

### Gaps queued

| Priority | Module | Gap | Acceptance criterion |
|---|---|---|---|
| P1 | `src/contract/simulated.ts` | Branch 68.63% (below 85%) | Add tests for `postFeedback`, `onRulingTimeout`, `settle`, `withdraw`, `refuse` transitions and their guard-failure paths; branch % ≥ 85% |
| P2 | `src/content/content.ts` | **LANDED tick 58** — `content.test.ts` 15 tests; 100% line/branch/function | Done. |
| P3 | `src/integrations/cds-hooks/mapper.ts` | **LANDED tick 59** — `mapper.test.ts` 17 tests; 100% line / 95.65% branch / 100% function | Done. |
| P4 | `src/integrations/cds-hooks/fixture.ts` | **LANDED tick 60** — `fixture.test.ts` 12 tests; 100% line/branch/function | Done. |
| P5 | `src/profiles/profiles.ts` | `addProfile`/`getProfile` untested; branch 75% | Add tests for `addProfile` (replace existing) and `getProfile` (found/not-found); line + branch ≥ 85% |
| P6 | `src/wallet/wallet.ts` | 0% — `SimulatedWallet` untested directly | Unit test `SimulatedWallet` construction + address/mode accessors; line ≥ 85% (RealWallet exempt — requires live provider) |
| P7 | `src/config/networks.ts` | 0% — typed constants | Smoke-import test confirming `SOMNIA_NETWORKS.testnet` has expected chainId; line ≥ 85% |

`src/contract/real.ts` is **excluded** from the gap list per standing convention: it is covered by integration testing against a real Somnia testnet node, not by unit tests.

---

**Date:** 2026-05-29 · **Tick:** 38 (UNIT-9: packet.ts — Merkle-root helpers)
**Branch:** `spec-4-implementation`
**Last known test counts:** hardhat 28/28 ✓ · lib (node --test) 65/65 ✓ (+12)

---

## Tick 38 — UNIT-9 packet.ts coverage

### Tool used

`node --import tsx --test --experimental-test-coverage src/protocol/packet.test.ts`
(node's built-in `--experimental-test-coverage` flag; no external tool required).

### Test results

All 12 tests passed; 0 failures.

```
# tests 12
# pass  12
# fail  0
```

### Coverage report (tool output)

```
# -----------------------------------------------------------------
# file             | line % | branch % | funcs % | uncovered lines
# -----------------------------------------------------------------
# src              |        |          |         |
#  protocol        |        |          |         |
#   packet.test.ts | 100.00 |   100.00 |  100.00 |
#   packet.ts      | 100.00 |   100.00 |  100.00 |
# -----------------------------------------------------------------
# all files        | 100.00 |   100.00 |  100.00 |
# -----------------------------------------------------------------
```

**packet.ts: 100% line, 100% branch, 100% functions — exceeds the 85% threshold.**

### Per-spec gap table — SPEC-0004 R9/R10/R11/§3.4

| Req  | Description                                               | This tick                    | Notes |
|------|-----------------------------------------------------------|------------------------------|-------|
| R9   | Off-chain evidence collection (process requirement)       | no test (unchanged)          | Process/runtime concern; not directly testable via unit tests |
| R10  | Frozen evidence packet — `EvidenceReference` shape + Merkle root committed | **test exists — 100% covered** | Tests 4–12 cover `sliceHash`, `merkleLeaf`, `merkleRoot` formula; Test 6 validates the all-zero empty-packet convention; Tests 8–12 cover 2-leaf and 3-leaf (odd duplicate-last) paths |
| R11  | Merkle-leaf + root helpers (`merkleLeaf`, `merkleRoot`)   | **test exists — 100% covered** | All helpers exercised and pinned against independently-computed expected values; Tests 4–12 |
| §3.4 | Hash formula: sliceHash → keccak256(utf8(JSON.stringify(slice))); leaf → keccak256(abi.encode(string,bytes32,bytes32)); root → sorted-pair | **test exists — 100% covered** | Tests 3, 4 pin each formula against inline-computed expected; Tests 9 verifies pair-sort order independence |

### Branch-by-branch manual audit

`packet.ts` has four executable code paths in `merkleRoot` beyond the straight-line helper code:

| Branch | Condition | Test exercising it |
|--------|-----------|--------------------|
| Empty packet → `bytes32(0)` | `refs.length === 0` | Test 8 (`merkleRoot([])`) |
| Single leaf → return as-is | `level.length === 1` after initial map | Test 9 (`merkleRoot([refA])`) |
| Multi-leaf, even count | `level.length % 2 === 0` (two refs) | Tests 10, 11 (`merkleRoot([refA, refB])`) |
| Multi-leaf, odd count → duplicate-last | `level.length % 2 !== 0` (three refs) | Test 12 (`merkleRoot([refA, refB, refC])`) |
| Pair sort lo < hi | `a < b` branch inside pair loop | Tests 10/11 (order-independence test confirms both orderings hit both sides of the ternary) |
| Pair sort lo ≥ hi | `a >= b` branch inside pair loop | Test 11 (swapped order `[refB, refA]`) |

All branches reachable in the implementation are exercised by at least one test.

### Tick-38 verdict: PASS

`packet.ts` line/branch/function coverage = **100%** (threshold: 85%). All 12 tests pass.
R10 and R11 advance from "no test" to **test exists**. R9 remains a process requirement
not testable at the unit level (unchanged). The node built-in `--experimental-test-coverage`
flag produced a full coverage report without requiring any additional tooling.
lib suite grows from 53 → 65 (+12).

---

## Tick-14 entry (UNIT-UI-1: KPI strip)

**What landed:**
- KPI strip component added above the Overview negotiation list in the web UI. All four
  displayed counts (Total, Pending, Approved, Denied) are derived directly from the
  `rows` prop (`NegotiationView[]`) passed into the component — no stubs, no hardcoded
  values, no separate API call. Counts update whenever `rows` changes.
- No contract changes, no `src/` library changes.

**Coverage gains:**
- **No new spec R-requirement coverage.** This is a UI-only diff; no SPEC-0001 through
  SPEC-0004 requirement is newly satisfied or newly tested by this tick. Counts are
  real-data-derived (not stubs), which is correctness hygiene rather than a spec gate.

**Tests added:** None. The repo has no React testing infra (no jsdom / React Testing
Library config); correctness rests on `tsc` (type-checks clean) and is flagged for
browser-verify, consistent with prior UI ticks (R13, R14).

**Tick-14 verdict: PASS-for-this-tick.** lib 53/53 unchanged, hardhat 28/28 unchanged.
No spec R-coverage gained or lost; KPI counts are real-data-derived.

---

## Tick-13 entry (UNIT-4b-narrow)

**What landed:**
- `web/src/hooks/useNegotiation.ts` — SPEC-0003 R14 (Detail re-derive): React hook that
  re-fetches negotiation detail on every `events` change keyed to `reqId`, exposes a
  `refetchTrigger` counter for imperative refetch, and applies a cancelled-flag cleanup
  pattern to avoid stale-state updates after unmount. **Implementation only — no unit
  test.** The repo has no React testing infra (no jsdom / React Testing Library config);
  correctness rests on `tsc` (type-checks clean) and is flagged for browser-verify,
  matching the same status as R13 (useAction).
- NO contract, `src/`, or other `web/` changes.

**Coverage gains:**
- **SPEC-0003 R14** (Detail re-derive): implementation present; no automated test path.
  Status is **implementation only, no test — browser-verify flagged** (same as R13).

**Tick-13 verdict: PASS-for-this-tick.** lib 53/53 unchanged, hardhat 28/28 unchanged.
SPEC-0003 R14 gains an implementation; browser-verify remains pending for both R13 and R14.

---

## Tick-12 entry (UNIT-4-narrow)

**What landed:**
- `src/protocol/revertReasonMap.ts` — SPEC-0003 R16: exports `REVERT_REASON_MAP`
  (keyed by raw revert string) and `mapRevertReason` helper. Covers the revert-reason
  mapping contract required by R16.
- `src/protocol/revertReasonMap.test.ts` — 9 sub-tests via `node:test`; all 9 pass.
  lib suite grows from 44 → 53 (+9).
- `web/src/hooks/useAction.ts` — SPEC-0003 R13: React hook providing an in-flight guard
  (`isPending` state) that prevents duplicate submissions. **Implementation only — no
  unit test.** The repo has no React testing infra (no jsdom / React Testing Library
  config); correctness rests on `tsc` (type-checks clean) and is flagged for
  browser-verify in a future tick.
- `web/src/shared.ts` — side-effect bug fix: added missing `case "PacketSubmitted":`
  branch that was absent since UNIT-2 (tick 4). This was a pre-existing bug that caused
  `web tsc` to fail; fixing it unblocks the web TypeScript build.

**Coverage gains:**
- **SPEC-0003 R16** (revert reason map): now has 9 passing `node:test` assertions.
  Status advances from "no test" → **test exists**.
- **SPEC-0003 R13** (useAction in-flight guard): implementation present; no automated
  test path in this repo. Status is **implementation only, no test — browser-verify
  flagged**.

**Side-effect fix:** `web/src/shared.ts` missing `PacketSubmitted` case repaired;
web `tsc` now clean. No spec requirement directly advances from this fix alone, but
it removes a pre-existing blocker for web-layer test work.

**Tick-12 verdict: PASS-for-this-tick.** lib suite 53/53 (+9), hardhat 28/28
unchanged. SPEC-0003 R16 gains a passing test suite; SPEC-0003 R13 gains an
implementation with browser-verify pending.

---

## Tick-11 entry (UNIT-3-refactor + R6b spec-prose update)

**What landed:** New test-helper module `src/protocol/scenarioFixtures.test-helpers.ts`
(123 lines, 4 named exports: `assertNoPHI`, `assertPacketShape`, `assertRequestedDrugShape`,
`loadScenarioFile`) and refactored scenario test files
(`scenarios.partd-approvable.test.ts`, `scenarios.commercial-policy-void.test.ts`,
`scenarios.medicaid-denied-then-appealed.test.ts`) to import that helper — net removal
of ~240 lines across the three files. Net source LOC delta: **−117 lines** (240 removed
− 123 added). Spec edit: `docs/specs/0001-mvp0-coverage-negotiation.md` R6b prose narrowed
per amendment 0005; §3.5 `Ruled` event payload documents `policyVoidedClauseIndices`.
**No contract changes, no web app changes.**

**Coverage verdict:** No new R-citations gain coverage; no R-citations regress. The R6b
spec-prose change is informational — actual contract-side implementation of
`policyVoidedClauseIndices` in `handleResponse` is a future unit. Test counts held
exactly: lib 44/44, hardhat 28/28.

**Tick-11 verdict: PASS-for-this-tick.** Refactor improved maintainability (−117 net
source LOC) without coverage loss.

---

## What landed tick 10

Five static fixture files under `demo-data/scenarios/medicaid-denied-then-appealed/`
(`note.md`, `packet.json`, `payer-profile.json`, `requested-drug.json`,
`expected-outcome.md`) and one scenario test
(`src/protocol/scenarios.medicaid-denied-then-appealed.test.ts`, 8 sub-tests, all pass).
**No library code, contract code, or web app code was modified.** Line/branch coverage
of `src/`, `contracts/`, and `web/src/` is therefore unchanged from tick 6.

---

## SPEC-0004 R-requirement coverage table

| Req   | Description (short)                                    | Prior (tick 9)        | Tick 10               | Notes |
|-------|--------------------------------------------------------|-----------------------|-----------------------|-------|
| R1    | Synthetic notes only — no real PHI                     | test exists           | test exists           | All three scenario tests check >500 bytes, no SSN/DOB/DL patterns, presence of "synthetic" marker |
| R2    | Three curated cases — one per payer line               | partial (2/3)         | **COMPLETE (3/3)**    | partd-approvable + commercial-policy-void + medicaid-denied-then-appealed all landed |
| R4    | Per-case authoring contract (5 required files + schema)| test exists           | **test exists + Medicaid discriminant** | `scenarios.medicaid-denied-then-appealed.test.ts` validates `payerLine: "medicaid"` discriminant |
| R5    | Real per-line formulary data                           | no test               | no test               | Not testable via static fixtures alone; runtime arbiter concern |
| R6    | Single-source-of-truth invariant                       | no test               | no test               | Arbiter-side; out of scope for static fixtures |
| R6c   | Appeal loop (round-0-Deny → round-1-Approve arc)       | partial (informational) | **scenario docs added** | `expected-outcome.md` for Medicaid case documents round-0-Deny → round-1-Approve arc; still informational — no executable contract test this tick |
| R7    | Deterministic read (content-hash at pin time)          | no test               | no test               | Arbiter-side |
| R8    | Per-line release pin in payer-profile.json             | test exists           | test exists           | PartD discriminant validated; void case correctly omits release pin |
| R9    | Off-chain evidence collection                          | no test               | no test               | Process requirement; not directly testable |
| R10   | Frozen evidence packet — ≥1 EvidenceReference with shape | test exists         | test exists           | All three scenario packets validated for `references` array, `url`, and `contentHash` keccak256 format |
| R11   | Merkle leaf + root helpers (`merkleLeaf`, `merkleRoot`) | **test exists (tick 38)** | **test exists (tick 38)** | `packet.test.ts` 12 assertions; 100% line/branch coverage; formula pinned against independently-computed expected |
| R13   | `PayerLine` enum + `LADDERS` constant                  | test exists           | test exists           | `ladders.test.ts` (14 assertions, landed tick 3) |
| R14a  | `appeal()` requires prior ruling = Deny                | test exists           | test exists           | Hardhat + vitest sim/real tests (ticks 4–6) |
| R15   | All documented stage names present in LADDERS          | test exists           | test exists           | `ladders.test.ts` pins all R15 names |
| R16   | `payerLine`/`appealRound` on `Negotiation` type        | test exists           | test exists           | Hardhat + TS compilation (tick 3) |
| R17   | `appealRound` increments on appeal                     | test exists           | test exists           | T6 + R9-deadlock-appeal assertions (tick 3) |

### R2 complete — all three payer-line cases curated

As of tick 10, all three required curated cases are present:
- `partd-approvable/` — Medicare Part D, round-0 approval path
- `commercial-policy-void/` — Commercial, PolicyInvalidated terminal state
- `medicaid-denied-then-appealed/` — Medicaid, round-0-Deny → round-1-Approve arc

### PolicyInvalidated and appeal-arc — scenario documentation notes

`commercial-policy-void/expected-outcome.md` documents the `PolicyInvalidated` terminal
state; `medicaid-denied-then-appealed/expected-outcome.md` documents the round-0-Deny →
round-1-Approve arc. Both are informational coverage: no executable test drives the
contract through these transitions this tick. Integration tests exercising those
transitions remain queued.

---

## SPEC-0001 / SPEC-0002 / SPEC-0003 baseline

These specs' coverage is unchanged from tick 6. Summary:

- **SPEC-0001 core flow** (R6a, R6b, R6c, R9 fee model, R11 party-auth, R12/R13): all tested;
  hardhat 28/28 as of tick 6.
- **SPEC-0002** (R1 timeline backfill, R2/R3/R5/R6 demo UX, R7 CDS-Hooks seam): partial —
  R1 historical backfill known broken (UNIT-8, queued); R2/R3/R5/R6/R7 implemented but no
  automated regression tests for UI paths.
- **SPEC-0003** (R13–R22 in-flight guards, ErrorCard, layout): partial as of tick 13 —
  R16 (revert reason map) has 9 passing `node:test` assertions (test exists);
  R13 (useAction in-flight guard) and R14 (Detail re-derive hook) each have an
  implementation but no automated test (browser-verify flagged for both);
  UNIT-5 through UNIT-7 queued for remaining requirements.

---

## Line/branch coverage target — status

**Target:** ≥ 85% line + branch across `src/`, `contracts/`, `web/src/`.

**Measurement:** No coverage instrumentation is wired in the project toolchain as of tick 8.
`package.json` does not include a `coverage` script; neither `vitest --coverage` nor
`hardhat coverage` is configured. Line/branch percentages cannot be reported without a
dedicated coverage run. The 85% target is a steady-state gate, not yet evaluated.

To wire coverage: add `@vitest/coverage-v8` (or `c8`) for the `src/` vitest suite and
`hardhat-coverage` for `contracts/`; add a `"coverage"` npm script that gates on the
85% threshold.

---

## Tick verdict

**PASS-for-this-tick.** This tick added only static fixtures and a scenario-validation
test (lib suite now 44/44, +8 from tick 9's 36). No executable library, contract, or
web app logic was introduced, so no new coverage gaps were opened. **R2 is now fully
complete (3-of-3):** the Medicaid denied-then-appealed case brings all three required
payer-line curated scenarios into the repo. R4 gains the Medicaid `payerLine`
discriminant assertion; R6c gains scenario-level documentation of the round-0-Deny →
round-1-Approve arc (informational only). The 85% line/branch target cannot yet be
evaluated without a coverage tool; that gap predates this tick and is tracked as a
steady-state blocker.
