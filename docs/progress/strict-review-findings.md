# Strict-review findings — tick 3 (UNIT-1)

**Verdict:** PASS (5 findings resolved inline; 2 informational deferred to follow-up)

UNIT-1 lands the spec-shaped `LADDERS` table, the `PayerLine` enum, the
`appealRound` field, and mechanical plumbing across the TS surface and the
Solidity struct. The ladder data itself reconciles cleanly against SPEC-0004
§2.4 R15, §2.5 R17/R19, and `docs/technical-design/appeal-ladder-enforcement.md`.

The initial review flagged 5 findings (2 MEDIUM, 3 LOW). All 5 were addressed
inline before commit. The 2 informational items are deferred and tracked below.

## Resolved findings

### Finding 1 (MEDIUM) — stale ROUND SEMANTICS comment now actively misleads — RESOLVED

`contracts/contracts/CoverageNegotiation.sol:118-124` was authored when `round`
was the only counter. UNIT-1 added a second counter `appealRound` that DOES
count appeals — the old comment said "never as 'number of appeals so far'"
which was false post-UNIT-1.

**Fix:** Replaced the comment block with a two-paragraph treatment that names
BOTH counters, explains the semantic distinction (`round` = total agent fires,
bumps on submitEvidence too; `appealRound` = ladder position, bumps in
`appeal()` only), and explicitly notes the deadlock-cap short-circuit path
where `appealRound` stays put.

### Finding 2 (MEDIUM) — appeal() deadlock invariant: appealRound MUST NOT bump — untested — RESOLVED

The `appealRound` increment in `appeal()` is correctly placed after the cap
check, so a deadlock at the cap leaves `appealRound` unchanged. But this
invariant had no test.

**Fix:** Added an assertion at the end of `R9 (deadlock appeal)` (test.ts:670+):
`expect(n.appealRound).to.equal(0)` after the deadlock-cap path runs. Confirms
the bump is skipped on the short-circuit. Also added a positive assertion to
T6 that `appealRound` advances `0 → 1` on a successful appeal.

### Finding 3 (LOW) — ladders.test.ts spot-checks only 3 of 8 R15 stage names — RESOLVED

The original 9 assertions covered counts + one name per ladder + a few
window/threshold values, but a rename of e.g. `Redetermination` would have
slipped through.

**Fix:** Added a single `LADDERS pins every spec R15 stage name verbatim` test
that asserts all 11 stage names across the three ladders. Also added a
`LADDERS pins windowDays + thresholdCents per tech-design` test that pins all
window/threshold values, and a `Every LADDERS entry has non-empty description +
citation` test that proves R21 schema completeness.

### Finding 4 (LOW) — stageNameFor invalid-PayerLine and negative-round untested — RESOLVED

`stageNameFor` falls back to `"—"` for unknown lookups, but only the
out-of-range-round case (`stageNameFor(PartD, 99)`) was tested.

**Fix:** Added two tests: `stageNameFor with negative round falls back to '—'`
and `stageNameFor with invalid PayerLine falls back to '—'` (the latter casts
`99 as PayerLine` to exercise the unknown-line branch).

### Finding 5 (LOW) — FileRequestInput.payerLine optional-with-default vs CreateContractParams.payerLine required — RESOLVED

`src/agents/party-agent.ts:54` had `readonly payerLine?: PayerLine;` with a
silent `?? PayerLine.PartD` default in `fileRequest`. `CreateContractParams`
made it required. Inconsistent surface, silent-PartD regression risk.

**Fix:** Made `FileRequestInput.payerLine` required (dropped the `?`).
Removed the `?? PayerLine.PartD` default. Cascaded the requirement through
`NegotiationScript` in `src/orchestrator.ts` (also required, no default), and
through `scripts/orchestrator-demo.mjs`'s `baseScript` (set to `0 /* PartD */`
explicitly).

## Informational (deferred to follow-up units)

### Info A — ContractCreated event omits payerLine for indexer filtering

Off-chain indexers / payer-side dashboards that filter "all my requests by
payerLine" can't do so from event log alone — they must fetch the full
Negotiation. SPEC-0004 R13 names the field but doesn't require it in events.
Not a UNIT-1 finding. Track as a possible UNIT-2 expansion (when the
`PacketSubmitted` event lands per SPEC-0004 §3.5, payerLine could ride along).

### Info B — (PartD, 4) Medicare Appeals Council in LADDERS but tech-design table omits it

SPEC-0004 R15 lists `(PartD, 4)` "Medicare Appeals Council" explicitly with the
note "out of scope for v0 — see R14 terminal". Tech-design table truncates at
round 3 (the v0 terminal). The new `LADDERS` includes round 4 so the UI can
show the label if/when V1.5+ adds it. Both interpretations are valid; keeping
round 4 in `LADDERS` is the more conservative choice (data model can carry
what the v0 enforcement chooses not to use).

## Checked (categories walked)

- Over-engineering / abstraction bloat
- Weak tests (now strengthened in `ladders.test.ts` + T6 + R9 deadlock)
- Missing edge cases (now covered for stageNameFor + appealRound deadlock invariant)
- Dead code / unused exports
- Lying or noise comments (ROUND SEMANTICS block rewritten)
- Spec drift (full reconciliation against SPEC-0004 §2.4/§2.5 + tech-design)
- DRY (prototype data.jsx vs protocol/ladders.ts duplication acceptable for v0)
- Backwards-compat hacks (FileRequestInput optional default removed)
- Cross-callsite consistency (web/Create.tsx, scripts/real-backend-localnode.mjs,
  scripts/orchestrator-demo.mjs, src/orchestrator.ts all updated)

## Notes

- Final test counts after all finding fixes: `npx hardhat test` 15/15 passing
  (T6 + R9-deadlock-appeal carry new appealRound assertions; total test count
  unchanged because assertions added to existing tests); `node --import tsx
  --test "src/**/*.test.ts"` 19/19 passing (5 auth + 14 ladders).
- All resolutions verified by running tests + tsc after each edit.
- No `--no-verify`, no `--force-push`, no new npm deps.
