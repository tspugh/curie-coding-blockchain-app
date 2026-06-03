# Loop state

> Maintained by the spec-4 implementation loop. See
> [`docs/loop-prompts/spec-4-implementation-loop.md`](../loop-prompts/spec-4-implementation-loop.md)
> for the procedure that reads + writes this file.

---

## ⚠ SPEC-0006 PIVOT — read this first (tick 151, 2026-06-03, branch `spec-6-implementation`)

**Everything below this block describes the Amendment-0006 self-hosted
architecture, which SPEC-0006 §2.3 (R0/R9/R10) now BANS.** Do NOT plan any
unit that uses `scripts/orchestrator-real.ts`, the `selfHosted` contract path,
`ANTHROPIC_API_KEY`, the old contract `0x2c561f33…488ac93`, or any off-chain
LLM in the contract-execution path. Those are superseded targets.

**Current architecture (SPEC-0006, Approved 2026-06-03):** real adjudication
originates from a single on-chain call to the canonical Somnia AI Agent
Platform `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` via
`IAgentRequester.createRequest` + the 4-arg `handleResponse` callback. No
detour through any off-chain process.

**Resolved (SPEC-0006 R-OPEN-1–4, via `scripts/identify-inference-agent.ts`):**
- Chosen agent: **LLM Inference**, `agentId 12847293847561029384` (testnet+mainnet).
- Method: `inferString(string,string,bool,string[])`, selector `0xfe7ca098`,
  decision constrained via non-empty `allowedValues`.
- `getRequestDeposit()` = 0.03 STT (read dynamically; never hardcode).
- `inferString` returns a single `string` — `handleResponse` decodes one string.

**Provider wallet** `0x204031FA1ad46a2D453b7c54fC28Ff1787Bd9128` ≈ 3.7 STT;
insurer (deterministic) `0x3F236fcac19fB951d5714F9Bc7ad5aE6724EB317` ≈ 0.5 STT
— both funded, both real-mode-capable. No `ANTHROPIC_API_KEY` involved.

**Latest exploratory deploy** `0xaFf3fA6B80E8a8C479fe59F1ECDb4a6B6704635f`
(spec-4 source, `selfHosted=false`) proved the platform path works end-to-end
but still calls **8-param `ExtractANumber`** (wrong agent + stale ABI) → rulings
land in `EvidenceRequested`. The SPEC-0006 cascade replaces that.

**SPEC-0006 implementation cascade (the real top-of-queue):**
1. **`_fireAgent` → LLM Inference.** Replace the `ExtractANumber` payload with
   `inferString` (agentId `12847293847561029384`, selector `0xfe7ca098`,
   `allowedValues = ["approve","deny","needs_more_info","policy_invalid"]`).
   Pin agentId + cost constants. **This is the keystone — unblocks every
   downstream verification.** (SPEC-0006 R11/R12, SPEC-0004.1 R1.)
2. **`handleResponse` decodes a single string** ruling; parse decision token +
   rationale; emit `RulingRationale` (R24–R26).
3. **Self-host + stub surface removal** (R9): delete `selfHosted`,
   `setPlatformSelfHosted`, `_fireAgentSelfHosted`, `_selfHostedNonce`,
   `scripts/orchestrator-real.ts`, `@anthropic-ai/sdk` dep, the CI lint edge.
4. **Per-negotiation `agentEvidenceUrl` + `agentPromptHint`** on the struct
   (R14/R15); `createContract` gains them; drop the contract-level global.
5. **Drug→evidence map + 6 fixtures** (R16/R18); URL-liveness check (R21).
6. **Redeploy** + R44 headline gate against ≥2 of the 6 examples; R55 three
   named flow scenarios; R48–R51/R56–R58 history hydration.
7. **SPEC-0004.1 ledger absorption** (R1–R12 into owning durable specs); delete
   the fractional ledger when empty.

**SPEC-0006 R-OPEN-1–4 are CLOSED; SPEC-0005 is Superseded.** Plan from this
block, not the stale verdict table below (kept for audit trail only).

---

**Last updated:** 2026-06-03 (tick 151 — `feat(web)`: SPEC-0006 R16/R18/R20 drug-evidence map + Create.tsx auto-fill + form validation. `web/src/drugEvidenceMap.ts` ships all six R18 fixtures (Adalimumab, Semaglutide, Ustekinumab, Lecanemab, Tirzepatide, Dupilumab) with brand-alias resolution. `Create.tsx` wires `applyDrugLookup` to the drug-name field — auto-fills `agentEvidenceUrl` + `agentPromptHint` on match; manual override preserved; submit button disabled while either field is empty. Hardcoded MedlinePlus fallback and generic prompt hint replaced by state values. 234/234 tests pass. Tick counter advanced 150 → 151.)
**Current mode:** `impl` — steady state still gated on real-mode browser-verify against `0x2c561f33…488ac93` (wallet 5.50 STT < ~7.35 needed for full sweep; or `ANTHROPIC_API_KEY` for smaller Tick A smoke).
**Current tick:** 151
**Last focus:** SPEC-0006 R16/R18/R20 — drug-evidence map (`drugEvidenceMap.ts`) + Create.tsx auto-fill + form validation. All six R18 drug fixtures present; brand aliases resolve; submit gated on non-empty evidence URL and prompt hint.
**Last commit:** `399b99f` (tick 150 tighten AC4 + verify 97/97 E2E) → tick 151 commits drug-evidence map integration.

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
| Lib tests | ✓ **234/234** (tick 151: +25 drugEvidenceMap tests) |
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

**Top-of-queue going into tick 151:**
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
