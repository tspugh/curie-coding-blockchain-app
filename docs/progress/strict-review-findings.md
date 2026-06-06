# Strict review findings — Amendment 0007 phase-tracker fields

**Unit:** Add Amendment 0007 phase-tracker fields (`agentPhase`, `pendingDecideFee`,
`pendingFeePayer`) to the off-chain `Negotiation` interface and both decoder paths so the
TypeScript layer is in full sync with the 38-field on-chain struct.

**Date:** 2026-06-04
**Branch:** `spec-6-implementation` vs `origin/main`.
**Reviewer stance:** TOTAL-STICKLER. Scope = the unit's slice of the `origin/main…HEAD`
diff, read against Amendment 0007, SPEC-0006, and the on-chain `struct Negotiation`.

**Result: ZERO findings. Gate PASS.**

## Files reviewed (unit scope)

- `src/types/coverage.types.ts` — `Negotiation` interface: `agentPhase: number`,
  `pendingDecideFee: bigint`, `pendingFeePayer: string` added.
- `src/contract/simulated.ts` — `SimNegotiation` fields, `createContract` init
  (`0 / 0n / ethers.ZeroAddress`), `snapshot()` propagation.
- `src/contract/real.ts` — `RawNegotiation` tuple `[35]/[36]/[37]`,
  `decodeNegotiationRaw` positional mapping.
- `src/contract/simulated.agentphase.test.ts` — new test file (6 tests).

## Verification performed

1. **Positional decode is exact.** Counted the on-chain `struct Negotiation`
   (`contracts/contracts/CoverageNegotiation.sol:122`) 0-indexed: positions 35/36/37 =
   `agentPhase` / `pendingDecideFee` / `pendingFeePayer`. The `getNegotiation` ABI return
   tuple (`src/contract/abi.ts:28`) lists the same 38 fields in the same order. The
   `RawNegotiation` type and `decodeNegotiationRaw` map raw[35]→agentPhase (uint8),
   raw[36]→pendingDecideFee (uint256), raw[37]→pendingFeePayer (address) — byte-for-byte
   aligned with chain + ABI. No off-by-one.

2. **Enum values match.** `enum AgentPhase { None, Scraping, Deciding }`
   (CoverageNegotiation.sol:109) ⇒ 0/1/2, matching the `agentPhase` doc comment in all
   three TS files and the test's `raw[35]=1 (Scraping)` sentinel.

3. **`number` typing for `agentPhase` is the unit's specified contract, not drift.** The
   unit explicitly specifies `agentPhase: number` (no render logic this tick). The
   codebase models other on-chain enums (`State`, `Decision`, `PayerLine`) as TS `enum`s,
   but introducing an `AgentPhase` TS enum is correctly deferred to the unit that adds
   render logic — typing as `number` with an inline 0/1/2 mapping comment is the minimal,
   correct slice. No premature abstraction; no spec drift.

4. **Init values correct + idiomatic.** `createContract` seeds `agentPhase: 0`,
   `pendingDecideFee: 0n`, `pendingFeePayer: ethers.ZeroAddress`. `ethers.ZeroAddress` is
   already the repo's convention for a zero address (used at simulated.ts:292), so no new
   constant and no inconsistency.

5. **`snapshot()` propagates all three** (simulated.ts:951-963); typecheck across the
   whole project is clean, proving every `Negotiation` consumer is in sync.

6. **Tests assert correctness, not mere presence.** Tests (a)/(b)/(c) pin exact default
   values (`0`/`0n`/`ZeroAddress`); test (d) is a runtime `in`-guard that catches a
   `snapshot()` silently dropping a field (additive to the compile-time interface guard,
   not redundant); test (e) guards the snapshot round-trip; **test (f) is the high-value
   one** — it builds a synthetic 38-tuple with non-zero sentinels at [35]/[36]/[37] and
   asserts the real `decodeNegotiationRaw` maps each position exactly. That is a genuine
   positional-correctness test of the highest-risk off-by-one surface, exceeding the
   unit's "does not throw" bar. No mocks where integration is required —
   `decodeNegotiationRaw` is the actual production decode path (`decodeNegotiation`
   delegates to it). No PHI; synthetic fixtures only.

7. **No dead code / unused export.** `decodeNegotiationRaw` is reachable in production via
   the private `decodeNegotiation` wrapper (real.ts:712) used on the read path (real.ts:432)
   AND by the test. The wrapper preserves the strict `RawNegotiation` tuple type at the
   production call site while exposing a loosely-typed (`readonly unknown[]`) seam for
   synthetic-array tests — a justified, documented (`@internal`) test seam, not indirection
   bloat.

8. **No lying/restating comments in the unit's added lines.** The new doc comments state
   provenance (Amendment 0007 / SPEC-0006 R14/R15) and the 0/1/2 mapping — information not
   otherwise visible from the `number` type. The 38-field count in the `RawNegotiation`
   header comment matches the actual tuple length.

## Tests run

- `node --import tsx --test src/contract/simulated.agentphase.test.ts` → 6/6 pass.
- `npm run typecheck` → clean (all `Negotiation` consumers compile).
- Sibling regression: `simulated.transitions.test.ts` + `simulated.coverage.test.ts` →
  46/46 pass.

## Scope note (not a finding against this unit)

The same `origin/main…HEAD` diff bundles separate A0008 (escrow) and SPEC-0006
(Ruled/RulingRationale, price-cap removal) changes. Those are out of this unit's scope and
were not gated here. One observation for the OWNING units: the pre-existing doc comments on
`coveredAmount` / `costPlusUnitPrice` / `nadacUnitPrice` in `coverage.types.ts` still
describe the removed "min(requested, cap)" / NADAC-floor price basis; SPEC-0006/A0007 set
`coveredAmount = requestedAmount` and zero those price fields. Those comments are context
lines (untouched by this diff) and belong to the SPEC-0006 price-cap-removal unit's review.
