# Loop state

> Maintained by the spec-4 implementation loop. See
> [`docs/loop-prompts/spec-4-implementation-loop.md`](../loop-prompts/spec-4-implementation-loop.md)
> for the procedure that reads + writes this file.

**Last updated:** 2026-05-29 (loop setup; pre-tick 0)
**Current mode:** `impl`
**Current tick:** 0
**Last focus:** (none — fresh start)
**Last commit:** *(set after the `start` tag commit)*

## Work queue (priority order)

*(empty — first tick's planning subagent populates this from the four specs + design SoT)*

## Steady-state criteria — current verdict

- [ ] 100% R-numbered requirements (specs 0001–0004) have ≥ 1 passing test
- [ ] Tests: 100% pass (`npx hardhat test`, `pnpm test`, web E2E)
- [ ] Coverage ≥ 85% line + branch across `src/`, `contracts/`, `web/src/`
- [ ] Solidity-compliance: NO findings (Opus stickler)
- [ ] Security-review: NO findings (Opus stickler)
- [ ] Strict-review: NO findings (Opus gatekeeper)
- [ ] Browser-verify: all R2 (3 curated cases) + R2a (custom) + R2b T2b-1..6 (multi-wallet) green
- [ ] Design-conformance: ≥ 90% vs `docs/reference/ui-prototype-handoff/project/`

## Recent findings (rolling — newest first, last 20)

*(empty — first tick has no history)*

## Tags so far

- `start` — loop-setup commit. `git diff start..HEAD` = everything the loop has done.

## Open creativity-mode PRs

*(empty until steady state reached)*

## Operator notes

- Wallet refill at https://testnet.somnia.network/ when balance < 5 STT.
- If the loop emergency-tags, restart after refill + a quick check of the latest `strict-review-findings.md`.
- If the strict reviewer's bar feels unreachable, relax it via spec edit (not via prompt edit) — the loop reads specs as truth.
