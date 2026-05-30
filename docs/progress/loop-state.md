# Loop state

> Maintained by the spec-4 implementation loop. See
> [`docs/loop-prompts/spec-4-implementation-loop.md`](../loop-prompts/spec-4-implementation-loop.md)
> for the procedure that reads + writes this file.

**Last updated:** 2026-05-30 (tick 147 — in-spec Tick-C status refresh. Tick 146 fixed `docs/specs/README.md`; the strict-reviewer planning subagent for tick 147 found that the *normative* spec text in SPEC-0004 §2.7 (Amendment 0006 status block "Tick C — Open" + "blocked on operator wallet STT funding") + SPEC-0004 TASK-4 ("IN PROGRESS") + SPEC-0005 §3.6 R22 Amendment 0006 note ("Tick C bundle redeploy still required") + SPEC-0005 OQ5 (cited the decommissioned contract `0x1dC5bA…3E1A` and the old 0.35 STT/ruling validator fee model) were all still stale. Same class of drift as tick 146 but in the normative spec text rather than the index. Updated: Tick C → Done with deployed contract + tx hash + verify-deploy citation; added Tick D entry (SPEC updates, ticks 140/141/146/147 — this very edit); R25 status → complete; TASK-4 → DONE; R22 note → all Ticks A+B+C+D landed; OQ5 → correct contract addr + accurate self-hosted fee flow verified via grep of `_fireAgentSelfHosted`. Secret-scan flagged the public setPlatformSelfHosted tx hash `0xff7918df…` as a regex false-positive — confirmed via RPC `eth_getTransactionByHash` that it's a real public tx (from EOA, to new contract, block 396060125) AND it's already committed at `docs/amendments/0006-self-hosted-arbiter-agent.md:8`. No code change; doc hygiene. Wallet: 5.50 STT — no change.)
**Current mode:** `impl` — steady state still gated on real-mode browser-verify against `0x2c561f33…488ac93` (wallet 5.50 STT < ~7.35 needed for full sweep; or `ANTHROPIC_API_KEY` for smaller Tick A smoke).
**Current tick:** 147
**Last focus:** In-spec Tick-C status refresh. SPEC-0004 §2.7 Amendment 0006 status block + TASK-4 + SPEC-0005 §3.6 R22 note + OQ5 all carried stale "Tick C still required" or stale contract-address text. Updated to reflect deployed reality (Tick C done tick 139, verify-deploy 8/8 tick 142, A-0006 Adopted tick 140) and added a Tick D ("SPEC updates") entry consistent with the amendment's structure.
**Last commit:** `5d3310c` (tick 146 spec README refresh) → tick 147 lands the in-spec normative text refresh.

> **History rotation note (tick 145):** earlier reviewer-history blocks (ticks
> 122-128), tick-summary blocks (115-120, 107-113, 98-106, and the older 90-96
> sprint summary), and several stale verdict tables / queues have been moved to
> [`loop-state-archive.md`](loop-state-archive.md) to reduce per-tick context
> burn. Active state below; full historical record in the archive.

**Verdict table after tick 144:**

| Gate | Verdict |
|---|---|
| `npm test` (umbrella) | ✓ PASS — chain runs in ~19s end-to-end |
| `npm run check-ruling-abi` | ✓ static + 5/5 round-trips |
| TypeScript typecheck | ✓ project tsc clean |
| Lib tests | ✓ **209/209** (was 196 pre-tick-144 transition tests) |
| Hardhat tests | ✓ **61/61** (Amendment 0006 + R26 + admin-setter + state-guard) |
| Coverage (src/, measured subset) | ✓ 98.85% line / 92.25% branch — PASS |
| Coverage (src/contract/simulated.ts single file) | ⚠ 75.45% branch (was 68.63%; +6.82pp tick 144) — subset overall still PASS |
| Coverage (contracts/, CoverageNegotiation.sol) | ✓ 86.42% branch — PASS ≥85% gate |
| Coverage (all contracts, overall) | ✓ 86.59% branch — PASS |
| Coverage (mocks) | ✓ 100% on every metric |
| Design-conformance | ✓ ~92% overall — PASS ≥90% gate |
| Browser-verify sim mode | ✓ **99/99 PASS — re-verified tick 138 against HEAD `e28ec81`** |
| **Browser-verify real mode** | ⚠ **Tick C UNBLOCKED tick 139** — contract `0x2c561f33…488ac93`; full real-mode run still gated on wallet (5.50 STT < ~7.35 needed) + `ANTHROPIC_API_KEY` |
| R25 Tick C deploy | ✓ **DONE** tick 139 (`770766c`) |
| A-0006 Status flipped Proposed → Adopted | ✓ tick 140 (`4fcb32a`) |
| R49 rewritten for self-hosted | ✓ tick 141 (`98d9ceb`) |
| `npm run verify-deploy` (new tick 142) | ✓ 8/8 PASS against live `0x2c561f33…488ac93` |
| Loop-prompt deployed-contract addr | ✓ updated tick 143 (`ea2afb2`) |
| Secret-scan | ✓ no findings across all ticks 83-144 |
| Solidity-compliance / Security-review (last run) | ✓ tick 135 iter-1 PASS (RevertingReceiver mock) |
| Strict-review (last run) | ✓ tick 135 iter-1 PASS; many subsequent ticks N/A (doc-only or mechanical-test-additions) |

**Steady-state self-assessment after tick 144:** 7.5 of 8 criteria met. The
single outstanding criterion is **real-mode browser-verify against the new
contract**, blocked on either wallet refund (need ~8 STT total; current 5.50)
OR `ANTHROPIC_API_KEY` for a smaller-scope Tick A live smoke (current STT
sufficient for that).

**Top-of-queue going into tick 148:**
1. **Tick A live smoke test** — single requestAdjudication via orchestrator
   + Claude SDK on `0x2c561f33…`. Affordable (~0.5 STT). Requires
   `ANTHROPIC_API_KEY`.
2. **Re-run browser-verify real mode** — needs wallet refunded to ~8 STT,
   OR run a curated subset that fits the 5.50 STT budget.
3. **Cron restart** — canonical loop-prompt has many substantive updates
   (check-ruling-abi gate, npm test umbrella, deployed contract address,
   reviewer cadence) since cron `18c86caf` was created. Operational; needs
   user to restart the cron with the updated body.
4. **`simulated.ts` further branch coverage** — diminishing returns; gate
   is already passing for the src/ subset. Tick 144 closed 68.63% → 75.45%;
   further closes would need helper-function tests.
5. **State-machine branch coverage continuation in `CoverageNegotiation.sol`** —
   diminishing returns; gate is already passing.
6. **SPEC-0005 OQ4** still open — "this spec is missing the spec-author-standard
   §5 Test cases and §6 Pass/fail criteria sections" (HIGH). R20-R23 are now
   landed sim-mode, which makes the structural gap a worthwhile next polish if
   no external state changes. One-tick scope: add §5+§6 indexed by R-number.
