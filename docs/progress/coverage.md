# Coverage — spec-4-implementation branch

**Date:** 2026-05-29 · **Tick:** 10 (UNIT-3c medicaid-denied-then-appealed fixtures + scenario test)
**Branch:** `spec-4-implementation`
**Last known test counts:** hardhat 28/28 ✓ · lib (node --test) 44/44 ✓

---

## What landed this tick

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
| R11   | Merkle leaf + root helpers (`merkleLeaf`, `merkleRoot`) | no test              | no test               | UNIT-9 pending; `src/protocol/packet.ts` not yet written |
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

**PASS-for-this-tick.** This tick added only static fixtures and a scenario-validation
test (lib suite now 44/44, +8 from tick 9's 36). No executable library, contract, or
web app logic was introduced, so no new coverage gaps were opened. **R2 is now fully
complete (3-of-3):** the Medicaid denied-then-appealed case brings all three required
payer-line curated scenarios into the repo. R4 gains the Medicaid `payerLine`
discriminant assertion; R6c gains scenario-level documentation of the round-0-Deny →
round-1-Approve arc (informational only). The 85% line/branch target cannot yet be
evaluated without a coverage tool; that gap predates this tick and is tracked as a
steady-state blocker.
