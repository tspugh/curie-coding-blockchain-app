# Loop state

> Maintained by the spec-4 implementation loop. See
> [`docs/loop-prompts/spec-4-implementation-loop.md`](../loop-prompts/spec-4-implementation-loop.md)
> for the procedure that reads + writes this file.

**Last updated:** 2026-05-30 (tick 149 — SPEC-0003 §8 Q1 + Q3 closures + line-605 propagation. Tick 148 closed SPEC-0005 OQ4; tick 149 swept SPEC-0003 §8 for closable items. Two open Qs were code-verifiable answerable without external action: Q1 ("does createContract require a deposit?") — confirmed via grep that `createContract` at `CoverageNegotiation.sol:354` is `external returns (uint256 reqId)` with no payable + no msg.value; only `requestAdjudication` at line 420 is payable. Q3 (originally "blocking R42") — A-0006 path (c) self-deploy adopted (tick 140); R42 was renumbered to R48 per the §2.10 merge note; R48 unblocked from deploy side as of tick 139. Both marked RESOLVED with evidence; Q1's answer also tightened the R4 attribution conditional at line 605 ("`createContract` (if it requires a deposit) → ...") to its concrete form ("`createContract` → `Burned (gas)` only"). Q2 (UX funding-flow shortcut) intentionally left open — genuine user-preference question. SPEC-0004 §8 was already 3-of-4 RESOLVED (Q2/Q3/Q4) + TASK-4 DONE; remaining TASK-1/TASK-2/TASK-3 are separate workstreams (research corpus / case-research / arbiter-prompt-design) not closable from current code state. SPEC-0005 §8 OQ5 was updated in tick 147 with the self-hosted fee model; remains a decision-pending OQ. Secret-scan clean. No code touched. Wallet: 5.50 STT — no change.)
**Current mode:** `impl` — steady state still gated on real-mode browser-verify against `0x2c561f33…488ac93` (wallet 5.50 STT < ~7.35 needed for full sweep; or `ANTHROPIC_API_KEY` for smaller Tick A smoke).
**Current tick:** 149
**Last focus:** SPEC-0003 §8 Q1 + Q3 closures. Q1 (createContract deposit?) → RESOLVED via contract grep — non-payable, only requestAdjudication is value-bearing. Q3 (ABI-drift resolution path?) → RESOLVED — path (c) self-deploy adopted via A-0006; R42 renumbered to R48; R48 unblocked from deploy side. Line 605 R4 attribution conditional tightened to follow from Q1's answer.
**Last commit:** `7d8f131` (tick 148 SPEC-0005 §5+§6) → tick 149 lands SPEC-0003 Q1/Q3 closures.

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

**Top-of-queue going into tick 150:**
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
6. **OQ-sweep continuation** — SPEC-0003 Q2 (UX funding-flow shortcut) is a
   user-pref decision, not closable autonomously. SPEC-0004 TASK-1/2/3 remain
   open as separate workstreams. SPEC-0005 OQ5 (real-chain cost decision) was
   updated tick 147 but the gating-cadence decision (per-PR vs nightly) is a
   user call. The closable-without-external-action queue is now empty.
