# Coverage — spec-4-implementation branch

**Date:** 2026-05-29 · **Tick:** 8 (UNIT-3 partd-approvable fixtures + schema-validation test)
**Branch:** `spec-4-implementation`
**Last known test counts (tick 6, last code-landing tick):** hardhat 28/28 ✓ · vitest 21/21 ✓

---

## What landed this tick

Five static fixture files under `demo-data/scenarios/partd-approvable/` and one schema-
validation test (`src/protocol/scenarios.partd-approvable.test.ts`, 6 assertions).
**No library code, contract code, or web app code was modified.** Line/branch coverage
of `src/`, `contracts/`, and `web/src/` is therefore unchanged from tick 6.

---

## SPEC-0004 R-requirement coverage table

| Req   | Description (short)                                    | Prior (tick 7) | Tick 8       | Notes |
|-------|--------------------------------------------------------|----------------|--------------|-------|
| R1    | Synthetic notes only — no real PHI                     | no test        | **test exists** | `scenarios.partd-approvable.test.ts` checks >500 bytes, no SSN/DOB/DL patterns, presence of "synthetic"/"Patient A" marker |
| R2    | Three curated cases — one per payer line               | no test        | **partial — test exists** | partd-approvable case covered by this test; `commercial-policy-void/` and `medicaid-denied-then-appealed/` scenarios not yet created — test for those cases pending UNIT-3 completion |
| R4    | Per-case authoring contract (5 required files + schema) | no test       | **test exists** | All five files validated: existence, note size, payer-profile `payerLine`+`formularyRelease` discriminant, requested-drug 6-field schema, expected-outcome keyword check |
| R5    | Real per-line formulary data                           | no test        | no test      | Not testable via static fixtures alone; runtime arbiter concern |
| R6    | Single-source-of-truth invariant                       | no test        | no test      | Arbiter-side; out of scope for static fixtures |
| R7    | Deterministic read (content-hash at pin time)          | no test        | no test      | Arbiter-side |
| R8    | Per-line release pin in payer-profile.json             | no test        | **test exists** | `formularyRelease` object with all 5 PartD discriminant fields validated in `scenarios.partd-approvable.test.ts` |
| R9    | Off-chain evidence collection                          | no test        | no test      | Process requirement; not directly testable |
| R10   | Frozen evidence packet — ≥1 EvidenceReference with shape | no test      | **test exists** | `packet.json` validated for `references` array, `url`, and `contentHash` keccak256 format |
| R11   | Merkle leaf + root helpers (`merkleLeaf`, `merkleRoot`) | no test       | no test      | UNIT-9 pending; `src/protocol/packet.ts` not yet written |
| R13   | `PayerLine` enum + `LADDERS` constant                  | test exists    | test exists  | `ladders.test.ts` (14 assertions, landed tick 3) |
| R14a  | `appeal()` requires prior ruling = Deny                | test exists    | test exists  | Hardhat + vitest sim/real tests (ticks 4–6) |
| R15   | All documented stage names present in LADDERS          | test exists    | test exists  | `ladders.test.ts` pins all R15 names |
| R16   | `payerLine`/`appealRound` on `Negotiation` type        | test exists    | test exists  | Hardhat + TS compilation (tick 3) |
| R17   | `appealRound` increments on appeal                     | test exists    | test exists  | T6 + R9-deadlock-appeal assertions (tick 3) |

---

## SPEC-0001 / SPEC-0002 / SPEC-0003 baseline

These specs' coverage is unchanged from tick 6. Summary:

- **SPEC-0001 core flow** (R6a, R6b, R6c, R9 fee model, R11 party-auth, R12/R13): all tested;
  hardhat 28/28 as of tick 6.
- **SPEC-0002** (R1 timeline backfill, R2/R3/R5/R6 demo UX, R7 CDS-Hooks seam): partial —
  R1 historical backfill known broken (UNIT-8, queued); R2/R3/R5/R6/R7 implemented but no
  automated regression tests for UI paths.
- **SPEC-0003** (R13–R22 in-flight guards, ErrorCard, layout): not yet tested —
  UNIT-4 through UNIT-7 queued.

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

**PASS-for-this-tick.** This tick added only static fixtures and a schema-validation test
that reads them. No executable logic was introduced, so no new coverage gaps were opened.
Existing test suites (hardhat 28/28, vitest 21/21 as last measured at tick 6) are not
regressed. The 85% line/branch target cannot yet be evaluated without a coverage tool,
but that gap predates this tick and is tracked as a steady-state blocker.
