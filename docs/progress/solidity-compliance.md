# Solidity compliance — tick 9

**Date:** 2026-05-29
**Scope:** no `contracts/` diff this tick — audit deferred to next contract-touching tick
**Verdict:** PASS (no contracts/ diff → no new findings)

## This tick's diff scope (UNIT-3b)

Verified via `git diff --name-only HEAD~1..HEAD -- contracts/` (empty result) and
`git diff --name-only HEAD~1..HEAD`:

- New this tick:
  - `demo-data/scenarios/commercial-policy-void/` (5 fixture files)
  - `src/protocol/scenarios.commercial-policy-void.test.ts`
- No changes to `contracts/contracts/CoverageNegotiation.sol`,
  `contracts/contracts/mocks/MockAgentPlatform.sol`, or
  `contracts/test/CoverageNegotiation.test.ts`.

Because no Solidity source or contract-level test was touched this tick, no new
audit pass is warranted. The next contract-touching tick should re-trigger a
full focused review.

## Carry-forward — prior open findings

From tick 4 (UNIT-2):

- **None.** Tick 4 closed with 0 findings (PASS). All seven focused checks
  (R14a appeal precondition, R2b createContract placement, PacketSubmitted CEI
  placement, no new externals/storage/modifiers, event-signature width
  `uint256 round` vs spec `uint8`, cross-callsite ripple in `_fireAgent`, test
  coverage delta) passed cleanly. The `uint256 indexed round` vs spec's
  `uint8 indexed round` width gap was explicitly noted as forward-compatible
  and accepted, not an open finding.

Tick 8 (UNIT-3a, partd-approvable fixtures + scenario test) also touched no
`contracts/` files and added no new findings.

No unresolved compliance items carry into tick 9.

## Tick 4 (UNIT-2) audit — preserved for reference

Reviewed the uncommitted diff against `contracts/contracts/CoverageNegotiation.sol`
and `contracts/test/CoverageNegotiation.test.ts`. All seven focused checks pass.

1. **R14a precondition tightening (appeal()).** The new
   `require(n.state == State.Denied, "appeal: prior ruling not Deny")` at line 436
   is the sole entry-state gate on `appeal()` — there are no alternate entry points.
   The `_onlyParty(n)` R11 auth check still runs on line 437 (after the state check,
   which is correct: state-validity should gate before party-validity to keep error
   ordering deterministic, and `_onlyParty` is read-only so reordering has no
   security effect). The cap-deadlock short-circuit
   (`if (n.round >= maxRounds)`) at line 445 still runs AFTER the state check, so
   you cannot deadlock from an `Approved` state — the R14a revert fires first. The
   existing cap-deadlock test (line 700) already uses a `Decision.Deny` ruling
   before exercising the cap, so it correctly survives R14a tightening.

2. **R2b placement (createContract).**
   `require(providerAddr != insurerAddr, "create: self-contract")` at line 323 sits
   AFTER the address/auth/qty checks and BEFORE `_nextId++` (line 325) and any
   struct field writes (lines 326–341). No state effects to roll back; CEI-clean.
   Order also ensures parameter-validation errors (`addr: zero`, `auth: not
   provider`, `qty: zero`) still surface ahead of the self-contract rejection,
   preserving error specificity.

3. **PacketSubmitted placement (_fireAgent).** Emitted at line 776, AFTER all state
   effects (`n.totalFees`, `n.rulingDeadline`, `n.state = UnderReview`) and BEFORE
   the external `platform.createRequest` call at line 785. CEI is preserved. At
   emit time, `n.round` correctly equals the round being requested: confirmed by
   reading all three call sites — `requestAdjudication` sets `n.round = 1` at
   line 378, `submitEvidence` bumps `n.round += 1` at line 412, `appeal` bumps
   `n.round += 1` at line 458, each immediately before calling `_fireAgent`. The
   inline comment at 770–775 documents this contract correctly.

4. **No new external calls / storage / modifiers.** Diff only adds: one event
   declaration, one `require`, one `emit`, comment/docstring revisions. No new
   storage slots, no new modifiers, no new external interactions. Verified against
   the full diff.

5. **Event signature width.** `uint256 indexed round` matches `n.round`'s declared
   type (line 134). SPEC-0004 §3.5 proposes `uint8 indexed round`; the contract's
   wider type is forward-compatible (no overflow, simpler ABI, no truncation at
   the emit site). Acceptable trade-off and explicitly called out in the change
   list.

6. **Cross-callsite ripple.** `_fireAgent` is invoked from exactly three sites
   (`requestAdjudication` line 380, `submitEvidence` line 414, `appeal` line 461).
   All three set `n.round` to the round being fired before the call — confirmed by
   direct read of each function body.

7. **Tests updated.** Three new test cases added: R2b self-contract revert
   (line 209), PacketSubmitted on all three fire paths with rounds 1/2/3
   (line 244), R14a appeal-from-Approved revert (line 491). Two existing tests
   updated: T9's single-shared-wallet scenario (line 626) flipped from
   end-to-end happy-path to a `create: self-contract` revert assertion; T10's
   `"appeal: not ruled"` expectation (line 758) updated to
   `"appeal: prior ruling not Deny"`. No stale references to the old error
   string remain in the test file.
