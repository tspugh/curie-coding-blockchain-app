# Loop state

> Maintained by the spec-4 implementation loop. See
> [`docs/loop-prompts/spec-4-implementation-loop.md`](../loop-prompts/spec-4-implementation-loop.md)
> for the procedure that reads + writes this file.

**Last updated:** 2026-05-30 (tick 124 — R26 repurposed check landed per the Tick D amendment. New `scripts/check-ruling-abi.ts` build-time check asserts the orchestrator's encoder type list matches the contract's `_fireAgentSelfHosted` → `handleResponse` decoder shape (static check) AND that round-trip encode → decode preserves every field across 5 sample rulings — one per Decision enum value plus a schema-ceiling sample at 10^30 wei / 64-element arrays / max receiptId. Cheap, chain-independent, doc-aligned. Refactor extracted the shared 10-tuple ABI module to `scripts/lib/ruling-abi.ts` so orchestrator + check share a single source of truth. Iter-1 strict-review PASS zero MEDIUM+; three LOWs (byte-count clarity, index-guard `!`, schema-ceiling sample) all applied; two NITs accepted.)
**Current mode:** `impl` — SPEC-0004 R25 Ticks A + B + D + R26-repurpose landed. Remaining: Tick C (bundle redeploy with selfHosted-capable contract + 10-arg Ruled ABI) — blocked on operator wallet STT funding for deploy gas. T2b-2/3/4 + R1 mid-flow still blocked on Tick C redeploy. Deployed contract `0x1dC5bA…3E1A` is the pre-Amendment-0006 build.
**Current tick:** 124
**Last focus:** R26 repurposed under Amendment 0006. New `scripts/check-ruling-abi.ts` + shared `scripts/lib/ruling-abi.ts`; orchestrator-real.ts refactored to import the shared module (removed local Decision/ZERO_HASH/Ruling/encodeRuling — behavior byte-identical). Two-tier check: (1) static — encoder `RULING_ABI_TYPES` deep-equals contract `CONTRACT_DECODER_TYPES` literal (copied from `CoverageNegotiation.sol:661`); (2) dynamic — 5 sample rulings round-trip encode → decode bit-for-bit. Negative-path sanity tested: swapping any two type-list elements correctly trips `tuple element N mismatch` with exit 1. Wired as `npm run check-ruling-abi`.
**Last commit:** `5a784b2` (tick 123 R25 Tick D spec updates) → tick 124 lands R26-repurpose.

**Tick 122 reviewer history:**
- Security-review iter-1 (Opus): **PASS** zero MEDIUM+. One in-scope LOW (enforce `WEI_CAP` via `.refine`, not `.describe()`) — applied before strict-review.
- Strict-review iter-1 (Opus): **FAIL**. MEDIUM-1 missing adaptive thinking. MEDIUM-2 `usage.input_tokens` unguarded null. LOW-1 weak `WEI_CAP` comment. LOW-2 `policyVoidedClauseIndices` rubric only in prose. All 4 fixed inline.
- Strict-review iter-2 (Opus): **PASS**. All 4 iter-1 findings CLOSED. Two cosmetic NITs (indentation, `daysSupply` could be number not bigint) — indentation fixed; bigint kept (`.toString()` in user message is correct).

**Tick 123 reviewer history:**
- Strict-review iter-1 (Opus, doc-only): **PASS** zero MEDIUM+. Three LOW/NIT findings: LOW-1 ("R26 moot" overstated) — applied (rephrased to "loses its original target; SHOULD be repurposed"). LOW-2 (R49 "always 0" leaves no room for future Anthropic billing telemetry) — accepted as-is (current code matches, future-proofing out of scope for v1). NIT-1 (em-dash punctuation in §2.7 amendment block) — left as-is (reads cleanly).
- All commit SHAs verified to exist (`d578716`, `95156a3`, `2b410ea`, `9db79d7`, `413962b`).
- R-number integrity: all R20-R23, R25-R27, R48-R49 retain original IDs and normative `MUST`/`SHOULD` text unchanged.
- §6 PASS/FAIL criteria untouched (SPEC-0004 still demands "R25 has landed green … real `ResponseStatus.Success` ruling against the live agent on testnet" — correctly remains gated on Tick C).

**Tick 124 reviewer history:**
- Strict-review iter-1 (Opus): **PASS** zero MEDIUM+. Five findings, all addressed: LOW-1 (magic byte-count math) — applied `(encoded.length - 2) / 2`; LOW-2 (`noUncheckedIndexedAccess` not enforced on scripts/, but indices accessed without guards) — applied `!` non-null assertions to match existing pattern at line 127; LOW-3 (round-trip coverage gap — missed schema-ceiling values) — applied, new 5th sample at 10^30 wei + 64-element arrays + max receiptId; NIT-1 (`CONTRACT_DECODER_TYPES` provenance via copy-comment is fragile) — accepted; NIT-2 (`readonly string[]` widens `as const`) — applied (dropped redundant `as const`).
- Negative-path sanity test performed: swapped `RULING_ABI_TYPES` elements 7 ↔ 9 in `lib/ruling-abi.ts`, ran `npm run check-ruling-abi`, got exit 1 with `tuple element 7 mismatch: encoder="bytes32[]", contract="uint16[]"`. Restored.
- Refactor verified byte-identical: encoder type list and field order unchanged from pre-tick-124 inline version.

**Ticks 115-120 summary** (the Amendment 0006 sprint):
- **Tick 115** (`3cfd52a` amendment 0006): authored
  `docs/amendments/0006-self-hosted-arbiter-agent.md`. Decision: option
  (c) self-deploy via off-chain orchestrator (per ticks-98/99 R25
  research). Ticks A-D plan: orchestrator script (A), contract change
  (B), redeploy (C), spec updates (D).
- **Tick 116** (`5ce5db3` amendment revision): contract inspection
  revealed _fireAgent calls `platform.createRequest` /
  `getRequestDeposit` — EOA-as-platform reverts. Revised Tick B to add
  a `selfHosted` flag + branch + synthetic-requestId path.
- **Tick 117** (`2b410ea` tick B part 1): additive `bool public
  selfHosted` storage + `setPlatformSelfHosted(address)` owner-only
  setter. `setPlatform` clears selfHosted for reversibility. 4 setter
  tests; 34/34 hardhat PASS (no behavior change).
- **Tick 118** (`9db79d7` tick B part 2): `_fireAgent` branch on
  `selfHosted` → `_fireAgentSelfHosted`. Skips platform.createRequest;
  generates synthetic requestId via keccak256(block.number, contract,
  reqId, ++nonce); transfers fee to orchestrator EOA. 5 new tests
  including handleResponse round-trip → Approved. 39/39 hardhat PASS.
  Iter-1 Opus solidity-compliance FAIL (MEDIUM storage slot inserted
  + LOW no round-trip test + NIT currentlyFiringReqId docstring) all
  fixed before commit.
- **Tick 119** (`413962b` iter-2 reviewer verdicts): both Opus iter-2
  reviewers PASS zero findings. All iter-1 findings CLOSED. R25 Tick B
  fully cleared.
- **Tick 120** (`d578716` tick A skeleton): `scripts/orchestrator-real.ts`
  (251 lines) — env loading, RPC connection, contract sanity checks
  (selfHosted == true && platform == orchestrator), RulingRequested
  event subscription, 10-tuple ruling encoding, handleResponse calls.
  STUB ruling logic (always Approve with deterministic costPlus/NADAC);
  LLM swap is the next sub-tick. Standalone tsc clean. Wired as
  `npm run orchestrator:real`.

**SPEC-0005 §3.6 sim-mode milestone holds:** R20 + R21 + R23 all done.
Browser-verify: 99/99 sim-mode PASS across 21 scenarios as of tick 113.

**Verdict table after tick 124:**

| Gate | Verdict |
|---|---|
| Lib tests (`npm run test:lib`) | ✓ **196/196** (re-verified tick 124) |
| Hardhat tests | ✓ **39/39** (re-verified tick 124; no contract change) |
| `npm run check-ruling-abi` (new) | ✓ **PASS** — static check + 5/5 round-trips |
| Browser-verify sim mode | ✓ 99/99 PASS (tick 113; not re-run — no UI change) |
| Browser-verify real mode | ✗ blocked by Tick C redeploy |
| Secret-scan | ✓ no findings across all ticks 83-124 |
| Solidity-compliance | ✓ iter-2 PASS (tick 119); N/A this tick (no contract change) |
| Security-review | ✓ iter-1 PASS (tick 122); N/A this tick (no risk-bearing changes) |
| Strict-review | ✓ **iter-1 PASS** tick 124 (zero MEDIUM+; 3 LOWs + 1 NIT applied) |
| TypeScript typecheck | ✓ project `npm run typecheck` + standalone strict `tsc` on all three script files clean |

**Remaining top-of-queue going into tick 125:**
1. **R25 Tick C — bundle redeploy.** Redeploy `CoverageNegotiation`
   with the 10-arg `Ruled` ABI (tick-49/50 debt) + Amendment 0006
   selfHosted mode. Update `.env`: `AGENT_PLATFORM_ADDRESS` = orchestrator
   EOA; `COVERAGE_CONTRACT_ADDRESS` = new addr; call
   `setPlatformSelfHosted` post-deploy. **Blocked on operator wallet
   STT funding for the deploy gas.** Once unblocked, this is a single
   focused tick: `npm --prefix contracts run deploy:somnia`, capture
   the new address, run `setPlatformSelfHosted` via the admin script,
   update `.env` + `.env.example` defaults, commit + push.
2. **Wire `check-ruling-abi` into the loop's CI / pre-commit gate.**
   Tick 124 created the check but did not gate the loop on it. Add it
   to `docs/loop-prompts/spec-4-implementation-loop.md` Phase 5 as a
   new gate before the secret-scan gate, since it's cheap and would
   have caught any orchestrator/contract ABI drift introduced by ticks
   118-122.
3. **Optional Tick A follow-up (post-Tick-C):** end-to-end smoke test
   of the LLM path against the redeployed contract — requires
   `ANTHROPIC_API_KEY` + funded orchestrator wallet. Currently exercised
   only via the deterministic stub fallback (which is the gate-passing
   default for CI).
4. **Old SPEC-0003 R49 deprecation pass.** Tick 123 added a self-hosted
   attribution note but kept the original validator-subcommittee R49
   normative text. If we abandon validator-subcommittee mode entirely
   (i.e. `selfHosted` becomes the only supported mode in production),
   R49 should be rewritten — not just annotated — to drop the
   `executionCost` dichotomy.

**Ticks 107-113 summary** (the R20-closeout + R21-completion sprint):
- **Tick 107** (`f1b5ab3` browser-verify): L5 verified live (3/3 PASS).
  Harness 83/83 across 18 scenarios.
- **Tick 108** (`3c08468` audit revision): L9-retry mis-classified as
  R20-exempt. `ErrorCard` is rendered at `Detail.tsx:391` WITHOUT
  `onRetry` — per its contract the retry button never renders. Closes
  R20 fully: 0 remaining real gaps.
- **Tick 109** (`5153347` M1): R21 first arbiter-twin — Scenario A's
  denial mirror (Deny → both accept → Settled). 6 new assertions.
  Discovered `settle()` accepts Denied as well as Approved per the
  contract require; coveredAmount=0 carries through to Settled.
- **Tick 110** (`1a4d78d` browser-verify): M1 verified live (6/6 PASS).
  Harness 89/89 across 19 scenarios.
- **Tick 111** (`5d9fdce` M2): R21 second arbiter-twin — L1's denial
  mirror (Evidence → Deny). 5 new assertions.
- **Tick 112** (`47bd982` M3): R21 third arbiter-twin — L2's denial
  mirror (Deny → appeal → Deny). 5 new assertions.
- **Tick 113** (`b1fb89d` browser-verify): M2 + M3 verified live
  (10/10 PASS). Harness 99/99 across 21 scenarios. R21
  feature-complete.

**SPEC-0005 §3.6 sim-mode milestone:** R20 + R21 + R23 all done.

| R20 affordance | Scenario | Status |
|---|---|---|
| evidence-submit | L1 | ✓ done |
| appeal-submit | L2 | ✓ done |
| refuse-submit | L3 | ✓ done |
| withdraw-submit | L4 | ✓ done |
| feedback-submit | L5 | ✓ done |
| custom-policy composer | L7 | ✓ done |
| create-payer-line | L10 | ✓ done |
| error-card-retry | — | exempt (onRetry not wired by Detail.tsx) |

| R21 twin pair | Status |
|---|---|
| A (Approve) ↔ M1 (Deny) → Settled | ✓ both live-verified |
| L1 (Evidence→Approve) ↔ M2 (Evidence→Deny) | ✓ both live-verified |
| L2 (Appeal→Approve) ↔ M3 (Appeal→Deny) | ✓ both live-verified |
| C2 (PolicyInvalid) | no twin needed — A covers compliant→Approve |

**Verdict table after tick 113:**

| Gate | Verdict |
|---|---|
| Lib tests (`npm run test:lib`) | ✓ 196/196 (last verified tick 83) |
| Hardhat tests (`cd contracts && npx hardhat test`) | ✓ 30/30 (last verified tick 83) |
| Browser-verify sim mode (the 21-scenario suite) | ✓ **99/99 PASS (tick 113)** |
| Browser-verify real mode | ✗ blocked by SPEC-0004 R25 |
| Secret-scan | ✓ no findings across all ticks 83-113 |
| Solidity-compliance | ✓ no `contracts/` diff in this run |
| Security-review | ✓ all diffs reviewed PASS (last Opus pass tick 85) |
| Strict-review | ✓ all diffs reviewed PASS or N/A |

**Remaining top-of-queue going into tick 115:**
1. **SPEC-0004 R25 option (c)** — self-deploy `CurieLLMAgent.sol`.
   Multi-tick effort (contract design + Hardhat deploy script + redeploy
   `CoverageNegotiation` with new selector + the tick-49/50 10-arg `Ruled`
   ABI). Per ticks 98/99 research, this is the only viable path; bundle
   with the existing redeploy debt.
2. **SPEC-0004 R26** — CI ABI drift check. Depends on R25 self-deploy.
3. **SPEC-0003 R49** — has spec inconsistency (claims "reads exclusively
   from callback payload" but `handleResponse(reqId)` only carries reqId).
   Needs spec clarification before implementation.
4. **SPEC-0005 R22** — real on-chain arbiter verification. Blocked on R25.

The sim-mode browser-verify suite is at terminal coverage for SPEC-0005
§3.6 R20+R21+R23. Further progress requires either R25 unblocking real
mode, or moving to creativity mode for unspecced features.

**Ticks 98-106 summary** (the R25-research + L-queue-closeout sprint):
- **Tick 98** (`9d04a35` docs/research R25): authored
  `docs/research/agent-abi-drift-2026-05-30.md`. Key finding: somnia-agent-kit
  AgentRegistry struct holds `string ipfsMetadata` + `string[] capabilities`
  but NOT a Solidity ABI directly, so PR #14 option (a) splits into (a1)
  reverse-engineer (heavy) and (a2) fetch IPFS metadata (light probe — try first).
- **Tick 99** (`9a1711e` research probe): wrote
  `contracts/scripts/probe-agent-abi.ts` + 2 diag scripts; ran against live
  Somnia testnet. **Option (a2) closed: infeasible.** The address PR #14 cited
  is an EIP-1967 proxy (impl at `0xC0D5…d764`, 5939 bytes), and the
  somnia-agent-kit ABI shape doesn't match the live impl — base agents like
  `12875401142070969085` are likely platform-built-in, not user-registered.
  Recommendation strengthened to option (c) self-deploy.
- **Tick 100** (`2d5a89b` audit revision): R20 affordance audit revised
  12 → 4 real gaps. Mis-classified 4 testids as exempt (verify-onchain is a
  display div, load-demo-evidence pure-React, error-card-dismiss pure-React,
  users-remove already covered). Closed 4 (L1/L2/L3/L4). Remaining real gaps:
  L5 (feedback), L7 (custom-policy), L9-retry (ErrorCard retry), L10 (payer-line).
- **Tick 101** (`1aa5915` L10): payer-line round-trip Scenario. Verifies
  `getNegotiation(reqId).payerLine == 1` after a non-default Commercial pick.
- **Tick 102** (`a053bad` L7): custom-policy composer Scenario. R15/R16 —
  composer engages with non-zero policyHash.
- **Ticks 103/104/105** (`4af38ec`, `d29ed21`): full harness re-runs.
  Tick 103 found 79/80 (L7 had a soft preview-text assertion fail). Tick 104
  diagnosed two intertwined causes via live agent-browser debug:
  1. `ab get text` returns only ONE descendant text node, not the subtree.
     Use `eval document.querySelector(...).textContent` for multi-descendant
     elements.
  2. The original multi-line `\n` clauses body had fiddly transit through
     bash/base64/JS/React. Use single-clause input for the composer test.
  Tick 105 landed the fix; harness now **80/80 PASS**.
- **Tick 106** (`004d17f` L5): feedback-submit Scenario. Discovered the
  tick-100 audit was wrong — postFeedback REQUIRES `!_terminal`, so the
  Scenario fires from Open (not post-Settled as the audit suggested).
  Asserts the input clears post-success (proves the await didn't revert).

**Verdict table after tick 106:**

| Gate | Verdict |
|---|---|
| Lib tests (`npm run test:lib`) | ✓ 196/196 (last verified tick 83) |
| Hardhat tests (`cd contracts && npx hardhat test`) | ✓ 30/30 (last verified tick 83) |
| Browser-verify sim mode (the 17-scenario suite) | ✓ **80/80 PASS (tick 105)**; L5 (tick 106) un-verified live yet — re-run queued for tick 107 (in flight as harness ID blv4s7z6p) |
| Browser-verify real mode | ✗ blocked by SPEC-0004 R25 (live agent ABI drift) |
| Secret-scan | ✓ no findings across all ticks 83-106 |
| Solidity-compliance | ✓ no `contracts/` diff in this run |
| Security-review | ✓ all diffs reviewed PASS (last Opus pass tick 85; subsequent test-script-only commits skipped per Phase-8 "N/A") |
| Strict-review | ✓ all diffs reviewed PASS or N/A |
| Coverage / Design-conformance | not re-measured this run |

**SPEC-0005 R20 status:** L1/L2/L3/L4/L5/L7/L10 done (7 of 7 closed gaps after audit revision); only L9-retry remains (ErrorCard retry chain re-fire — needs a deterministic failure to induce).

**Top-of-queue going into tick 108:**
1. **SPEC-0005 L9-retry** — last R20 gap. Induce a known revert (e.g. accept from non-party); assert ErrorCard renders + retry click re-fires.
2. **SPEC-0004 R25 option (c)** — self-deploy `CurieLLMAgent.sol`. Multi-tick effort. Per tick-98/99 research, this is the only viable path; bundles with the tick-49+50 redeploy debt.
3. **SPEC-0004 R26** — CI ABI drift check. Depends on R25 self-deploy landing.
4. **SPEC-0003 R49** — has spec inconsistency (claims "reads exclusively from callback payload" but `handleResponse(reqId)` only carries reqId). Needs spec clarification before implementation.

**Ticks 90-96 summary** (the multi-tick L-queue + verification sprint):
- **Tick 90** (`6e11b88` feat(test) L3): `refuse-submit` Scenario — provider refuses Ready-state contract → ProviderRefused (state=9, terminal). 5 assertions including UI badge text + button-hidden-post-terminal. R7/T7.
- **Tick 91** (`07fa2ba` feat(test) L1): `evidence-submit` re-fires arbiter — create → engage → sim NeedMoreEvidence → submit evidence → sim Approve → state=4. 5 assertions including round counter advance. R9.
- **Tick 92** (`18f5d81` feat(test) L2): `appeal-submit` re-fires from Denied — create → engage → sim Deny (state=5) → appeal → sim Approve → state=4. 5 assertions. R12 / appeal-ladder.
- **Tick 93** (`6d3dc23` feat(test) L4): `withdraw-submit` — single-button path to Withdrawn (state=10, terminal). 4 assertions. No engage step required (contract guard is just `_onlyParty + !_terminal`).
- **Ticks 94/95** (`7a9018f` chore browser-verify): Full harness run executed twice. **First run** (build inherited `.env`'s `VITE_WALLET_MODE=real`): 45/74 pass, 29 fail — every write-tx Scenario broke because sim-only setters can't drive real-chain state. **Second run** (explicit `VITE_WALLET_MODE=simulated`): **74/74 PASS** — all 4 new L-scenarios green end-to-end. Indirect SPEC-0004 R25 confirmation: the real-mode failure pattern matches PR #14's isolation-test finding (agent receives calldata but viem ABI-decode rejects every validator response → state never advances).
- **Tick 96** (`0eb0c1e` fix(test) harness): `start_server` now explicitly pins `VITE_WALLET_MODE=simulated` (with `HARNESS_WALLET_MODE` env opt-out for a future real-mode-only suite). Bakes the tick-94 gotcha fix into the harness itself so a fresh shell can't trip on it again.

**Verdict table after tick 96:**

| Gate | Verdict |
|---|---|
| Lib tests (`npm run test:lib`) | ✓ 196/196 (last verified tick 83) |
| Hardhat tests (`cd contracts && npx hardhat test`) | ✓ 30/30 (last verified tick 83) |
| Browser-verify sim mode (74-assert suite) | ✓ 74/74 PASS (tick 95) |
| Browser-verify real mode | ✗ blocked by SPEC-0004 R25 (live agent ABI drift) |
| Secret-scan | ✓ no findings across all ticks 83-96 |
| Solidity-compliance | ✓ no contracts/ diff in this run |
| Security-review | ✓ all diffs reviewed PASS (L-scenarios used Opus reviewers in ticks 85/86; subsequent test-script-only commits skipped per Phase-8 "N/A" branch) |
| Strict-review | ✓ all diffs reviewed PASS or N/A |
| Coverage | not re-measured this run — last value ≥85% per tick-46 era |
| Design-conformance | not re-measured — last value ≥90% per tick-46 era |

**SPEC progress as of tick 97:**
- **SPEC-0001 (MVP0):** R7/T7 + R9 + R12 now have agent-browser coverage (L3/L1/L2). Withdrawn terminal covered (L4).
- **SPEC-0002 (demo + integration seam):** R7 CDS-Hooks covered (Scenario H).
- **SPEC-0003 (token-flow visibility):** mostly UI surface; R48/R49 added by PR #14 merge (R49 — fee-burned vs fee-paid attribution — still TODO).
- **SPEC-0004 (data + evidence):** done except §2.7 R25/R26/R27 from PR #14. R27 README disclaimer landed (tick 87). R25/R26 BLOCKERS.
- **SPEC-0005 (usability + integration):** R6/R7/R8/R10/R11/R12/R13/R14/R15/R16/R17/R19/R23 done. R20 affordance audit landed (tick 89, `docs/progress/affordance-coverage.md`). R23 cost-estimator wired into all 7 write-tx Scenarios (ticks 85/88). L1/L2/L3/L4 done; L5/L6/L7/L8/L9/L10 remaining. R21 + R22 still pending (R22 blocked on R25).
**Emergency tag:** `tokens-emergency-2026-05-29-1` *(historical — superseded by the `a68ffe5` deprecation of token-budget gating)*

## New findings the next planner MUST act on

**Two operational findings landed in tick 83 — encoded in `docs/loop-prompts/spec-4-implementation-loop.md` + `docs/progress/browser-verify.md`; any browser-verify subagent MUST honor:**

1. The `agent-browser` CLI lives at `~/.npm-global/bin/agent-browser` and is NOT on the default PATH. Without `PATH="$HOME/.npm-global/bin:$PATH"`, every command silently exits 127 and agent-browser's `2>/dev/null` swallows the failure — assertions all return empty strings and falsely "pass" any `assert_eq ""=""`. Without this, the entire browser-verify gate is a no-op.
2. `agent-browser click @ref` (the snapshot-ref click) does NOT reliably trigger React form submit. The form's `onSubmit` only runs when the click is dispatched via the DOM, e.g. `document.querySelector('[data-testid=X]').click()`. The existing `eval_click` helper in `run.sh:69-71` already encapsulates this — any new R20-R23 scenario MUST use it for form-submit buttons.

## Work queue (priority order)

### SPEC-0004 R25 (NEW top-priority blocker — merged from PR #14 in tick 85)
**Resolve live agent ABI drift so real-mode adjudication actually invokes the LLM**
- Files (depending on resolution path): `contracts/contracts/ISomniaAgent.sol` (regen `IParseWebsiteAgent`), `contracts/contracts/CoverageNegotiation.sol:759` (selector update if signature changes), `.env` + deployment constants (if `AGENT_ID` changes), `contracts/scripts/deploy.ts` (redeploy).
- R-citations: SPEC-0004 §2.7 R25 (root-cause fix), SPEC-0003 §2.10 R48 (visibility blocker), SPEC-0003 §2.10 R49 (R4 attribution copy).
- Diagnosis (from PR #14 isolation test 2026-05-30): contract emits selector `0x4be9280f` from canonical `ExtractANumber(string,string,uint256,uint256,string,string,bool,uint8)`, but agent `12875401142070969085`'s LIVE registered ABI doesn't contain it. Every validator returns `Failed (3)` at viem ABI-decode BEFORE any LLM cycle runs. Authoritative live ABI source: `AgentRegistry @ 0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A` (Somnia agent explorer).
- Acceptance criterion: at least one real-mode `requestAdjudication` against the redeployed contract returns `ResponseStatus.Success` with a non-empty `result`; SPEC-0003 §2.10 R48 verifiable; SPEC-0005 R22 unblocked.
- First sub-unit suggestion: research-only tick to query the AgentRegistry for the registered ABI of agent `12875401142070969085` and write `docs/research/agent-abi-drift-2026-05-30.md` documenting the registered signature(s) + selectors. THEN pick a resolution path (regenerate vs switch vs self-deploy) as the next implementation tick.

### SPEC-0004 R26 (NEW — merged from PR #14; queue after R25)
**Build-time / CI agent-ABI drift check**
- Files: `contracts/scripts/check-agent-abi.ts` (new) OR extend hypothetical `scripts/check-somnia-interface.ts` (referenced by SPEC-0001 R19 but not yet implemented).
- R-citations: SPEC-0004 §2.7 R26; extends SPEC-0001 R19 (Solidity-mirror posture for the platform interface) to also cover the agent interface.
- Acceptance criterion: a script fetches the registered ABI for the configured `AGENT_ID` from `AgentRegistry @ 0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A`, recomputes the selector for the function the contract calls, and exits non-zero on mismatch — wireable into CI / a `predeploy` hook.
- Open question for next planner: AgentRegistry's exact method name + return shape for "give me the ABI of agent N" isn't in this repo. Need to query it via context7-mcp (Somnia docs) or read the registry's verified bytecode on the Shannon Explorer (`0x08D1…Cd02A`) first.

### SPEC-0004 R27 (NEW — merged from PR #14; responsible-claim gate)
**Demo / video / deck labelling**
- Files: README.md, docs/demo/ artefacts.
- R-citation: SPEC-0004 §2.7 R27.
- Acceptance criterion: until R25 is green, every demo / recorded artefact carries the label `(simulated — real-mode currently blocked by SPEC-0004 §2.7 R25)`. Audit existing demo artefacts; add the disclaimer where missing.

### SPEC-0003 R49 (NEW — merged from PR #14; companion to R48)
**R4 attribution distinguishes "fee burned (no work executed)" from "fee paid (LLM ran, consensus failed)"**
- Files: `web/src/views/Detail.tsx` (or wherever the R4 attribution row renders), the helpers it imports.
- R-citation: SPEC-0003 §2.10 R49 (renumbered from PR #14's `R43`).
- Acceptance criterion: when `ResponseStatus.Failed` lands, sum `executionCost` across the validator `Response[]`; if ~0 render "fee burned (no agent work)"; if ~ `perAgentBudget × subcommitteeSize` render "fee paid (LLM ran, consensus failed)". Same UI affordance + cost number, different copy/treatment. Reads exclusively from the existing callback payload — no new RPC or contract changes.

### SPEC-0005 R23 cost-estimator (LANDED tick 85 — pre-flight wallet sufficiency)
**`assert_wallet_sufficient` helper + Scenario A pre-flight wired as the R23 proof-of-concept**
- What landed: `web/tests/agent-browser/cost-estimator.sh` (sourceable helper, ~140 lines after security hardening), `web/tests/agent-browser/cost-estimator.test.sh` (9 tests, all PASS), Scenario A in `run.sh` now calls `assert_wallet_sufficient "Scenario A" 6 1 || exit 2` at function entry.
- Test: 9 tests covering sim-mode bypass, sufficient balance, short balance + exact spec message format, zero-arbiter math, zero-writes math, STT formatting precision, invalid-address rejection (L2 hardening), negative writes rejection (H1/M1 hardening), shell-injection-shaped writes rejection.
- Gate verdict: Opus security-review iter-1 returned HIGH H1 + MEDIUM M1 + LOW L1 + L2. **All four fixed inline**, iter-2 returned PASS zero findings. Opus strict-review returned PASS zero findings with 5 NITs documented. Lib tests + hardhat tests not re-run (no JS / Solidity diff in this commit).
- Open follow-up: wire `assert_wallet_sufficient` into Scenarios B/C/D/etc. as R23 broader rollout. Cheap mechanical follow-up — could be one tick covering all curated cases + the R2a custom-case path.

### SPEC-0005 R11 key-paste arm (LANDED tick 83 — addr derives from pasted privkey)
**Settings → Users add-user form now derives the on-chain address from a pasted private key via `ethers.Wallet`**
- What landed: `web/src/views/Settings.tsx` UsersPanel — optional `users-add-key` input + `useMemo`-derived `derivedAddress`; address input goes `readOnly` while key is valid; submit prefers derived over manual; key cleared on success and NEVER persisted to `curie:users`. Reuses existing `isValidHexKey` regex helper from `walletKeys.ts` so the validation gate is shared with the provider/insurer key panel.
- Test: `web/tests/agent-browser/run.sh` Scenario K — 5 assertions against the well-known `0x11…11` vector → expected address `0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A` (EIP-55-checked).
- Live verification: drove the production preview build via the `agent-browser` skill (not via run.sh) — all 4 R11 assertions PASS on the running UI. See `docs/progress/browser-verify.md` tick-83 section.
- Gate verdict: lib 196/196 ✓, hardhat 30/30 ✓, lint ✓, tsc ✓, secret-scan ✓ (the `0x11…11` hit is a public test vector inside a test scenario), Opus strict-review **PASS zero findings**, Opus security-review **PASS zero findings**.
- Open: the R11 "OR derived from a seed in simulated mode" arm is still open; T75c per-user signer plumbing (i.e. actually using the per-user address to sign chain writes) remains queued.

### SPEC-0005 R20 — per-affordance integration scenario (NEW — tick 83 spec; top of queue)
**Every state-mutating UI affordance has at least one named Scenario in `web/tests/agent-browser/run.sh` that drives it through the live UI**
- Files: `web/tests/agent-browser/run.sh` (new scenarios), plus any UI bits without a `data-testid` that need one to be reachable.
- R-citation: SPEC-0005 §3.6 R20.
- Acceptance criterion: every `<button>` / `<form onSubmit>` whose effect crosses a layer boundary (contract write OR localStorage write OR route-resetting nav) has a Scenario by name in `run.sh`. Pure-navigation buttons are exempt. An affordance without a Scenario fails strict-review.
- Concrete first sub-unit: enumerate the affordances in `web/src/views/{Overview,Create,Detail,Settings,Network}.tsx`, cross-check against scenarios A–K already in `run.sh`, list the gap. Land that audit as `docs/progress/affordance-coverage.md` before queuing per-affordance Scenario implementation.

### SPEC-0005 R21 — approval AND denial paths covered (NEW — tick 83 spec; queue after R20)
**Every arbiter-reaching flow has Scenarios for both ruling outcomes**
- Files: `web/tests/agent-browser/run.sh`.
- R-citation: SPEC-0005 §3.6 R21.
- Acceptance criterion: R1, R2a, and each curated case in R2 have Scenarios for both Approve and Deny outcomes. Approve asserts `State.Settled` + settlement recipient = `providerAddr`; Deny asserts `State.Denied` + the appeal-or-close branch per `appeal-ladder-enforcement.md`. Missing path → failing-stub, not silent skip.

### SPEC-0005 R22 — real on-chain arbiter call verified (NEW — tick 83 spec; queue after R21)
**Real-mode arbiter Scenarios assert `Ruled` event + non-zero block hash + agent tx `status=1`**
- Files: `web/tests/agent-browser/run.sh` per-Scenario assertions.
- R-citation: SPEC-0005 §3.6 R22.
- Acceptance criterion: scenarios claiming integration coverage for an arbiter step distinguish sim vs real mode in the assertion message AND poll for the `Ruled` event with the test-run's `reqId`. Sim short-circuits do not satisfy R22.

### SPEC-0005 R23 — pre-flight wallet sufficiency (NEW — tick 83 spec; cheap atomic first cut)
**Per-Scenario cost estimate gate fails loud with funding instructions on shortfall**
- Files: `web/tests/agent-browser/cost-estimator.sh` (new helper), `web/tests/agent-browser/run.sh` (call helper at top of each write-tx Scenario).
- R-citation: SPEC-0005 §3.6 R23.
- Acceptance criterion: every Scenario that fires write txs invokes the helper first; helper computes `Σ(estimatedGas_i × maxFeePerGas) + agentFeeReserve × arbiterCallCount` and fails the Scenario loud if the active wallet's balance is below that sum, with the exact message `insufficient balance: needed X STT, have Y STT, short Z STT — fund <addr> at https://testnet.somnia.network/`. Sim mode bypasses.
- Suggested first PR: just the helper script + a single Scenario (Scenario A's happy-path) wired through it as the proof-of-concept.

### Tick 83 skill-install + spec-edit bundle (LANDED tick 83 — meta)
**`agent-browser` skill installed; loop prompt updated; SPEC-0005 R20-R23 authored**
- What landed: `.claude/skills/agent-browser/SKILL.md` (the official discovery stub from `vercel-labs/agent-browser`, plus the `agent-browser skills get core` pointer); `.gitignore` got `!.claude/skills/` (+ matching negations for `agents/` and `hooks/`) so future skills commit cleanly; `docs/loop-prompts/spec-4-implementation-loop.md` now requires the skill in Phase 5 gate 8 + notes the PATH gotcha + the DOM-click workaround; `docs/specs/0005-usability-and-integration.md` gained section 3.6 with R20-R23 + OQ4 (spec-author §5/§6 sections missing) + OQ5 (per-PR STT cost of real-chain sweep).
- No code/contract diff. No strict-review needed (docs + tooling only).

### BROWSER-VERIFY-39 (LANDED tick 39 — first live end-to-end run)
**First agent-browser run against the deployed Somnia testnet contract**
- What landed: `docs/progress/browser-verify.md` documenting the live state. R2 partd-approvable / commercial-policy-void / medicaid-denied-then-appealed and R2a custom-case all PASS as real on-chain creates. T2b-1 + T2b-5 PASS.
- Real blockers surfaced (queued below as top-priority units):
  1. **OPS-fund-insurer-wallet** — unfunded `0x140e…8C62` blocks T2b-2/3/4.
  2. **UNIT-fix-e2e-harness-api-shape** — `run.sh` expects `window.__curie.{negotiation,content,wallet,profiles}` but `client.ts` only exposes `{provider, insurer}` and ONLY under `import.meta.env.DEV`; harness drops to 9/35 because of this mismatch.
  3. **UNIT-fix-react-submit-click-workaround** — agent-browser `find testid X click` doesn't trigger React's form onSubmit; harness silently fails the Create step. Workaround in scenarios: focus + Enter.
  4. **UNIT-cds-prefill-or-deprecate-scenario-H** — `data-testid=cds-prefill` not present; Scenario H expectations vs reality must be reconciled.
- Verdict: tick 39 is **verify-only**. Browser-verify gate is now partially green (R2/R2a end-to-end on testnet); next ticks should close the new queue items above before another browser-verify run.

### UNIT-OPS-fund-insurer-wallet (NEW — tick 39 finding, operator action)
**Fund `0x140e…8C62` with ≥ 0.1 STT to unblock T2b-2/3/4**
- Files: none (operator-only)
- R-citations: SPEC-0001 R2b (multi-wallet), tick 39 browser-verify
- Acceptance criterion: balance of `0x140e…8C62` ≥ 0.1 STT confirmed via `https://shannon-explorer.somnia.network/address/0x140e8C62…`. Operator note added to loop-state.md `Operator notes` section.

### UNIT-fix-e2e-harness-api-shape (LANDED tick 40 — e2e harness API shape)
**`window.__curie.{negotiation,content,wallet,profiles}` re-exported via active-client Proxy getters; preview builds opt in via `VITE_EXPOSE_TEST_API=1`**
- What landed: `web/src/client.ts` — gate extended to `DEV || VITE_EXPOSE_TEST_API==="1"`; added 4 top-level getters delegating to the existing `client` Proxy so the harness's `window.__curie.negotiation.stateOf(...)` works AND tracks the active profile. `web/src/App.tsx` — added `data-testid="profile-pill-{id}"` per pill so the harness can `click` each pill individually. `web/tests/agent-browser/run.sh` — set `VITE_EXPOSE_TEST_API=1` on the build; rewrote 6× `ab select profile-switcher PROFILE` → `ab find testid profile-pill-PROFILE click` to match the pill UI.
- Gate verdict: hardhat 28/28 ✓, lib 84/84 ✓, tsc ✓ (root + web), secret-scan ✓, Opus strict-review PASS zero findings. Browser-verify: **12/35 pass** (was 9/35). Scenario D 4/4 PASS, Scenario G 2/3 PASS. Remaining 23 failures downstream of React-onSubmit click-bug.

### UNIT-fix-react-submit-click-workaround (RESOLVED tick 41 — was a misdiagnosis)
**The tick-39 "agent-browser click doesn't fire React onSubmit" finding was wrong.**
- Reality: click DOES fire onSubmit; onSubmit validated; onSubmit called createContract; contract reverted with `"create: self-contract"` because in simulated mode insurerClient === providerClient (tick-25 MEDIUM 1 closure: same instance for state sharing) so INSURER_ADDRESS === providerClient.wallet.address.
- Fix landed tick 41 in `web/src/client.ts`: when `!IS_REAL`, `INSURER_ADDRESS` is a fixed synthetic distinct address `0x…c0c0c0` (sim backend doesn't auth msg.sender).

### UNIT-engage-flow-silent-fail (LANDED tick 42 — engage flow now reaches Ready/Approved/Settled)
**Two coordinated fixes; harness 13/35 → 19/35**
- Root cause 1: agent-browser's standard `find testid X click` does not reliably fire React's synthetic onClick for nested-content buttons (verified empirically on policy-card with `<span>`/`<strong>`/`<p>` children). Fix: `eval_click` helper in run.sh uses `document.querySelector(sel).click()` via eval which always bubbles. Rewrote 19 action-submit invocations.
- Root cause 2: simulated backend's `caller` defaulted to `wallet.address` (provider's address) via `src/contract/index.ts:50`; `setActiveClientProfile` only flipped the active-client pointer, never the sim caller. So insurer-profile actions saw `caller === providerAddr`, `is(insurerAddr)` returned false, threw `auth: not insurer`. Fix: `setActiveClientProfile` calls `client.negotiation.setCaller(addr)` in `!IS_REAL` mode.
- Gate verdict: lib 84/84 ✓, hardhat 28/28 ✓, root + web tsc ✓, secret-scan ✓, Opus strict-review PASS zero findings (8 scrutiny points all closed with evidence).

### UNIT-cds-prefill-or-deprecate-scenario-H (NEW — tick 39 finding)
**Reconcile Scenario H expectations (`data-testid=cds-prefill`) vs current UI (button not implemented)**
- Files: `web/tests/agent-browser/run.sh` (Scenario H), OR `web/src/views/Create.tsx` (add the button if it's spec'd)
- R-citations: SPEC-0002 R7 (CDS-Hooks seam) — check if R7 requires the prefill button or just the seam
- Acceptance criterion: either (a) the button is added with the same testid and the prefill fires real fields onto Create, OR (b) Scenario H is removed from `run.sh` with a comment citing that R7 only requires the CDS-Hooks seam at the data layer, not a Create-form button.

### UNIT-9 (LANDED tick 38 — packet.ts + Merkle helpers)
**`src/protocol/packet.ts` — SPEC-0004 §2.3 R9/R10/R11 + §3.4 evidence-packet types + Merkle-root helpers**
- What landed: `src/protocol/packet.ts` (137 lines after fixes) — `EvidenceReference`, `Packet`, `SliceKind`, `EvidenceSlice` types per §3.4; `sliceHash`, `merkleLeaf`, `merkleRoot` helpers. Merkle tree: sorted pairs (matches OZ `MerkleProof.verify`) + duplicate-last on odd levels (Bitcoin convention, NOT OZ `StandardMerkleTree` — JSDoc honest about this; revisit when on-chain `PacketSubmitted` consumer lands). Empty packet → `bytes32(0)`. `packet.test.ts` (325 lines) — 21 packet tests: formula determinism + reproducibility, 5 frozen literal-pinned hex anchors (sliceHash, merkleLeaf, merkleRoot 2-leaf + 4-leaf + empty-text), edge cases (empty text, `kind: undefined`, nested locator), 4-leaf cross-pair-order test (asserts LACK of global order-independence), JSON key-insertion-order regression.
- Strict-review iter 1: 2 MEDIUM (M1 lying "OZ convention" JSDoc, M2 tests self-pinning) + 4 LOW (L1 design-choice unannounced, L2 missing edge cases, L3 Test-9 oversold, L4 no key-order regression) + 2 NITs. **All closed inline iter 2** — N1 (centralize `as` casts) skipped as NIT/convention debate; N2 folded into M1 rewrite. Iter-2 strict-review PASS with zero findings.
- Gate verdict: lib tests 84/84 ✓ (+9 from 75), hardhat 28/28 ✓, root tsc ✓, web tsc ✓, secret-scan ✓, coverage 100% line/branch/function on packet.ts (well above 85% threshold), Opus security-review PASS (0 findings), Opus strict-review iter-2 PASS (0 findings). Solidity-compliance + design-conformance + browser-verify NOT RUN (no contracts diff, no UI diff, no UI/contract surface change yet — packet.ts is pure-TS library awaiting downstream consumer).

### UNIT-UI-3 (LANDED tick 16 — Appeal stage + Round columns)
**Two new columns in the Overview request table; stage name + payer-line caption + round/Nm**
- What landed: `web/src/views/Overview.tsx` adds the "Appeal stage" column (two-line cell: stageNameFor() result + payer-line caption "Part D" / "Commercial" / "Medicaid") and "Round" column (right-aligned tabular-nums). `src/index.ts` re-exports `LADDERS`, `stageNameFor`, `PayerLine` from `protocol/ladders.ts` so `@lib` works. CSS adds `.col-stage` / `.stage-name` / `.stage-payer` / `.col-round` using project tokens.
- Strict-review iter 1: 1 MEDIUM (chip wrapper diverged from prototype's plain two-line layout — fixed inline by dropping `.stage-chip` chip wrapper, rendering plain `stage-name` div + caption `stage-payer` div per `screens.jsx:142-144`); 1 LOW (`stageNameFor` returns "—" on out-of-range while prototype's `stageOf` clamps with PartD fallback — queued as `UNIT-ladders-fallback-semantics`); 5 NITs noted for future.
- Gate verdict: lib 53/53 ✓, hardhat 28/28 ✓, both tsc ✓, vite build ✓, secret-scan ✓.

### UNIT-ladders-fallback-semantics (LANDED — verified tick 47; already-implemented)
**Tick-16 LOW already closed by previous work; tick 47 verifies + bookkeeps**
- Divergence-as-intentional documented in ladders.ts lines 162-184 (the prototype clamps + falls back to PartD; production fails loud with `"—"` sentinel to surface contract-vs-render drift).
- ladders.test.ts lines 42-56 pin all four cases: in-range valid, out-of-range round, negative round, invalid PayerLine.
- The "either/or" acceptance criterion is satisfied with the "document the divergence" branch.

### UNIT-UI-2 (LANDED tick 15 — Overview filter pill bar)
**5-pill filter bar between KPI strip and table; verbatim prototype labels + partition predicates**
- What landed: `web/src/views/Overview.tsx` adds a `FilterKey` union, `ACTIVE_STATES` + `CLOSED_STATES` allowlist sets mirroring `screens.jsx:47-53`, `filters` predicate map, `filteredRows` useMemo, and a `.filter-pill-bar` row rendering one pill per key (each shows its count). KPI strip stays pinned to `rows` (full population); pills + table use `filteredRows`. Denied lands in Closed (not In negotiation), matching the prototype's narrative grouping.
- Strict-review iter 1: 1 MEDIUM (broad `r.terminal` for Closed double-counted Settled, contradicting the prototype's hand-listed `fmap`) + 1 LOW (lying comment "matching prototype exactly" was false). Both closed inline by switching to explicit state-set partitioning + truthful comment.
- Gate verdict: lib 53/53 ✓, hardhat 28/28 ✓, both tsc ✓, vite build ✓, secret-scan ✓, design-conformance bump expected (filter bar resolves one of the 3 top-priority gaps from tick 14).

### UNIT-7a-two-wallet-demo (NEW — from user bug report "auth: not insurer")
**Two-wallet support so the insurer profile can sign engage()**
- Files: `.env.example` (document `VITE_PRIVATE_KEY_INSURER`), `web/src/client.ts` (load both keys, pick signer per active profile), `web/src/views/Create.tsx` (derive insurerAddr from the insurer wallet, not synthetic constant), `web/src/hooks/useWalletBalance.ts` (poll both balances or just the active one)
- Context: UNIT-2 (tick 4) added R2b `createContract` reject when `providerAddr == insurerAddr`. To get past it, Create.tsx started using a synthetic `SYNTHETIC_INSURER_ADDR` while the user's only wallet stayed as providerAddr. When the user switches to insurer profile in the UI and tries to `engage()`, the contract correctly reverts `"auth: not insurer"` because `msg.sender == providerAddr ≠ insurerAddr`. The "profile switch" worked pre-UNIT-2 (single wallet) but is now broken for chain writes.
- Acceptance criterion: with `VITE_PRIVATE_KEY` (provider) AND `VITE_PRIVATE_KEY_INSURER` (insurer) both set in `.env`, switching profile in the UI switches the signing key transparently. Create.tsx no longer uses a synthetic insurer address; insurerAddr is the second wallet's actual address. R2b is satisfied (two distinct addresses). Both profiles can engage/accept/refuse as appropriate.
- Operator prerequisite: a second testnet wallet funded with ≥5 STT (refill at https://testnet.somnia.network/).

### UNIT-UI-1 (LANDED tick 14 — Overview KPI strip; user-driven UI refocus)
**4-card KPI strip above Overview list — verbatim prototype labels + real-data counts**
- What landed: `web/src/views/Overview.tsx` gains a 4-card grid above the request list with verbatim prototype labels ("Total requests" / "In negotiation" / "Settled" / "Capped vs ask") and subs. Real counts via reducer over `rows: NegotiationView[]`: total = rows.length; active = !r.terminal; settled = r.state === State.Settled; saved = sum of (requested - covered) for r.negotiation.{hasRuling, lastDecision === Approve, coveredAmount > 0n}. CSS additions: .kpi-strip / .kpi-card / .kpi-label / .kpi-value / .kpi-value.tone-{review,approved,accent} / .kpi-sub. Tone tokens use existing project palette (var(--warn|ok|accent)).
- Gate verdict: lib 53/53 ✓, hardhat 28/28 ✓, root tsc ✓, web tsc ✓, vite build ✓, secret-scan ✓, Opus solidity-compliance PASS, Opus security-review PASS, Opus design-conformance **62% (was 57%) — +5pp**, Opus strict-review PASS (1 LOW closed inline: raw hex → project tokens).

### UNIT-NetworkScreen (NEW — from violet bug report tick 14; high-visual-impact)
**Port NetworkScreen WITHOUT the fake event ticker — REAL events only**
- Files: `web/src/views/Network.tsx` (new), `web/src/App.tsx` (add `network` route), `web/src/styles.css`
- Context: violet reported the prototype's TxStream loops forever generating fake events via `makeRandomEvent()` (visuals.jsx:271 setInterval with Math.random). The PRODUCTION port must NOT carry the fake generator. Real implementation sources from `subscribeTxLog` (txLogger) for this wallet's events; shows empty state when no events. This is also where SPEC-0004 §3.3 "live tx stream" wires in if/when chain-wide event filter is added.
- Acceptance criterion: Network screen rendered at /network with the 4-stat panel (latest block from real chain, active rulings count from on-chain query, contract address, agent identifier) + a live tx stream filtered to the connected wallet's confirmed txs from subscribeTxLog. NO setInterval generating events. Empty state when subscribeTxLog has no events.

### UNIT-UI-2 (NEW — design-conformance tick 14 follow-up; small visible win)
**Overview filter pill bar — per `screens.jsx:99-115`**
- Files: `web/src/views/Overview.tsx`, `web/src/styles.css`
- Acceptance criterion: 5 pills (All / Open / In negotiation / Settled / Closed) above the request table, each showing its count. Active pill highlighted with `var(--accent)` background. Clicking a pill filters the rows. State stored in `useState<FilterKey>`; no URL routing.

### UNIT-4b-narrow (LANDED tick 13 — useNegotiation hook)
**`web/src/hooks/useNegotiation.ts` — Detail re-derive (SPEC-0003 §2.3 R13)**
- What landed: typed hook `useNegotiation(reqId, events): UseNegotiationResult`. useEffect re-runs on [reqId, events, refetchTrigger]; `cancelled` flag prevents stale writes; `prevReqIdRef` clears state on reqId-change. `refetch()` increments counter for imperative re-fetch.
- Gate verdict: lib 53/53 ✓, hardhat 28/28 ✓, both tsc ✓, Opus solidity/security PASS, Opus strict-review PASS (1 MEDIUM closed inline: R14 → R13 citation; 4 NITs deferred).
- Wire-up into Detail.tsx deferred — was originally tick 14 plan; tick 14 redirected to UNIT-UI-1 per user signal.

### UNIT-4-narrow (LANDED tick 12 — first web/ tick)
**`src/protocol/revertReasonMap.ts` + `web/src/hooks/useAction.ts` + shared.ts piggyback**
- What landed: revertReasonMap (R16) maps 27 contract revert strings (all enumerated via grep, no inventions) to `{headline, details}`. `useAction` (R13) wraps any async write fn with useRef-based in-flight guard (no React-state batching race, no timer clears, hard-reject on concurrent run). 9 node:test assertions for revertReasonMap. shared.ts `describeEvent` got the missing `case "PacketSubmitted":` arm — pre-existing UNIT-2/tick-4 bug; this fix unblocked web tsc.
- Gate verdict: lib 53/53 ✓ (+9), hardhat 28/28 ✓, root tsc ✓, web tsc ✓ (after building dist/), secret-scan ✓, Opus solidity-compliance PASS (no contracts diff), Opus security-review PASS (5 concerns clean; verified useRef synchronous check-and-set has no async window), Opus strict-review PASS (0 actionable findings, 4 NITs; NIT 2 closed inline by reordering extractRevertReason probe). Coverage gate PASS-for-this-tick. Design-conformance gate not re-run.
- Deferred to next tick(s): the third UNIT-4 piece `useNegotiation(reqId)` (re-derive hook), Detail.tsx wire-up of `useAction` + `revertReasonMap`, and the deferred LOW NIT 3 (test 3 reference-equality tightening).

### UNIT-3-refactor + R6b prose-update (LANDED tick 11 — paired bookkeeping)
**Helper extraction + amendment 0005 application**
- What landed: `src/protocol/scenarioFixtures.test-helpers.ts` (123 lines, 4 named exports). Three scenario test files refactored to import from helper: net -81/-81/-79 lines = -241 lines, +123 helper = -118 LOC net delta. SPEC-0001 R6b prose rewritten to apply amendment 0005 (PolicyFlagged is annotation event on Approve, not terminal route; `policyVoidedClauseIndices` added to §3.5 Ruled event payload; PolicyInvalidated state narrowed to meta-policy-failure scope).
- Gate verdict: lib tests 44/44 ✓ (unchanged count + unchanged TAP names — refactor was assertion-preserving), hardhat 28/28 ✓, tsc ✓, secret-scan ✓, Opus solidity-compliance PASS (no contracts diff), Opus security-review PASS (path-traversal academic at test-only callsites with hardcoded slugs), Opus strict-review PASS (0 actionable findings; 2 NITs flagged for future hardening: slug allowlist on loadScenarioFile, parenthetical cross-ref on §3.5 signature).
- Closes: strict-review tick 9 NIT 2 + tick 10 NIT 2 (DRY: 3× `assertNoPHI` copy → 1 helper).
- Future implementation gap flagged: the spec NOW says the Ruled event carries `policyVoidedClauseIndices`, but the contract's `handleResponse` doesn't yet decode it. This is the SPEC-0004 Phase 1 contract work — queued, NOT this tick.

### UNIT-3c (LANDED tick 10 — third curated scenario; R2 complete)
**`demo-data/scenarios/medicaid-denied-then-appealed/` + mirror schema test**
- What landed: 5 R4 fixture files for the Medicaid round-0-Deny → round-1-Approve arc (California Centene Medi-Cal MCO / dulaglutide for T2DM / round-0 packet omits the required SGLT2-i trial evidence → Deny / round-1 appeal adds empagliflozin intolerance → Approve). `src/protocol/scenarios.medicaid-denied-then-appealed.test.ts` with 8 sub-tests (R4 file presence, R1 PHI on note.md AND expected-outcome.md, §3.2 Medicaid discriminant with state/mco/revision, §3.4 packet shape + closed-enum invariant, sentinel `0x...0003` exact-equality, R6c+R14a header-line check pinning Deny-before-Approve ordering). Closes tick-9 follow-ups: (a) sentinel address `0x...0003` exact-asserted (LOW 6 partial closure for this scenario), (b) all-narrative PHI scan (MEDIUM 4 symmetry), (c) "all six fields per R4" rename (LOW 9 for this file).
- R2 progress: **3 of 3 curated cases complete.** R2 is now done.
- Gate verdict: hardhat 28/28 ✓ (no contracts diff), lib tests 44/44 ✓ (+8), tsc ✓ (after a 2-line type-narrowing fix on the references[0] cast), secret-scan ✓, Opus solidity-compliance PASS (no contracts diff), Opus security-review PASS (5 concerns clean), Opus strict-review PASS (1 LOW closed inline with R14a-cited ordering assertion; 2 NITs flagged for queued refactor units). Coverage gate PASS-for-this-tick. Design-conformance gate unchanged at 57% — pre-existing UI gap.

### UNIT-3b (LANDED tick 9 — second curated scenario + spec amendment 0005)
**`demo-data/scenarios/commercial-policy-void/` + mirror schema test + amendment**
- What landed: 5 R4 fixture files (Aetna Open Access Elect Choice POS / etanercept (Enbrel) / psoriatic arthritis / Aetna CPB 0792 imaging-prerequisite clause contradicts FDA label → R23 escape hatch); `src/protocol/scenarios.commercial-policy-void.test.ts` with 8 sub-tests (R4 file presence, R1 PHI guards on note.md AND expected-outcome.md, §3.2 Commercial discriminant, §3.4 packet shape, §2.6 R23 dual-slice invariant + closed-enum check, R23 Approve header line). Amendment `docs/amendments/0005-policy-void-r23-supersedes-r6b.md` resolves SPEC-0004 R23 supersedes SPEC-0001 R6b for the on-label-policy-void case: ruling becomes Approve + `policyVoidedClauseIndices`, NOT terminal PolicyInvalidated. Also added PHI scan on `expected-outcome.md` to the partd test (symmetric closure of MEDIUM finding 4).
- R2 progress: **2 of 3 curated cases landed** (`partd-approvable` + `commercial-policy-void`). UNIT-3c (medicaid-denied-then-appealed) is the remaining R2 work.
- Gate verdict: hardhat 28/28 ✓ (no contracts diff), lib tests 36/36 ✓ (+3 net: split R23 test + 2 new expected-outcome PHI tests), tsc ✓, secret-scan ✓ (well-known placeholder hash + `0x…0002` sentinel only), Opus solidity-compliance PASS (no contracts diff), Opus security-review PASS (5 concerns clean), Opus strict-review SECOND-PASS **PASS** (first pass: 9 findings — 2 HIGH closed via the amendment + slice.kind change, 2 MEDIUM closed via test name/scope rework, 1 LOW closed via header-line assertion, 4 LOWs deferred to dedicated future units). Coverage gate PASS-for-this-tick. Design-conformance gate 57% — pre-existing UI gap, unchanged.

### SPEC-0004 Phase 1 contract decode for `policyVoidedClauseIndices` (LANDED tick 49)
**`Ruled` event extended to 8 args with trailing `uint16[] policyVoidedClauseIndices` (R23 / amendment 0005)**
- What landed: CoverageNegotiation.sol decode tuple 7→8; emit-only (no struct field); all three Ruled callsites updated. MockAgentPlatform mirrors. 5 existing test `.withArgs` got `[]` appended; new R23 test pins `[2n]` end-to-end. Sim/real parity (real.ts `a[7] ?? []` fallback; simulated.ts setter mirrors web client setters). viaIR enabled for stack-too-deep.
- Gate verdict: hardhat 29/29 (+1), lib 84/84, harness 35/35 (no regressions), tsc clean, secret-scan ✓, Opus solidity-compliance PASS 0 (8 hard-scrutiny points + 2 advisory deployment items flagged for operator), Opus strict-review iter-2 PASS 0 findings (4 iter-1 items all CLOSED).
- Operator coordination: contract redeploy required (see Operator notes) — deployed `0x1dC5bA67...3E1A` has the old 7-arg `Ruled` ABI.

### UNIT-3-refactor (LANDED tick 11) — see above
**Extract shared scenario-test helpers — DRY at the file level**
- Files: `src/protocol/scenarioFixtures.test-helpers.ts` (new); refactor `src/protocol/scenarios.{partd-approvable,commercial-policy-void,medicaid-denied-then-appealed}.test.ts`
- R-citations: none (refactor)
- Acceptance criterion: the three scenario test files share a single helper module exposing `assertNoPHI`, `assertPacketShape`, `assertRequestedDrugShape`, `loadScenarioFile`. Each per-scenario file becomes ~40 lines of scenario-distinct assertions. Test names still appear per-scenario in TAP output. All 36+ tests still pass. Do this AFTER UNIT-3c so the third scenario's exact shape is in scope when extracting the helper.

### SPEC-0001 R6b prose-update (NEW — strict-review tick 9 follow-up)
**Apply amendment 0005 to SPEC-0001 R6b text + add `policyVoidedClauseIndices` to §3.5 event payload**
- Files: `docs/specs/0001-mvp0-coverage-negotiation.md`
- R-citations: amendment `0005-policy-void-r23-supersedes-r6b.md`
- Acceptance criterion: SPEC-0001 R6b's prose is rewritten to make `PolicyFlagged` an annotation on the Approved ruling for the on-label-policy-void case (not a route to terminal PolicyInvalidated). The §3.5 `Ruled` event payload gains `policyVoidedClauseIndices?: number[]`. The PolicyInvalidated terminal state is retained but its scope is narrowed per amendment 0005.

### UNIT-3a (LANDED tick 8 — first curated scenario)
**`demo-data/scenarios/partd-approvable/` + schema-validation test**
- What landed: 5 R4 fixture files (`note.md`, `packet.json`, `payer-profile.json`, `requested-drug.json`, `expected-outcome.md`) authoring a synthetic 70-year-old Part D RA patient with MTX failure (hepatotoxicity), leflunomide failure (peripheral neuropathy), and sulfa-allergy contraindication to sulfasalazine — step-therapy exception satisfied; Adalimumab 40mg/0.8mL Tier 5 Specialty on SilverScript S5810-001 formulary; mapping to Approve. New test `src/protocol/scenarios.partd-approvable.test.ts` (node:test + node:assert, 6 sub-tests / 7 assertions) pinning: R4 file presence, R1 PHI guards (SSN/DOB/DL + new: phone/email/MRN≥7-digit), R4 payer-profile shape (§3.2 PartD discriminant: `planId` not R8's `planIdOrProduct` shorthand — note the §3.2 vs R8 spec drift documented inline), R4 requested-drug 6 fields, R10 + §3.4 Packet shape (`references`, `submittedAt` number, `submittedBy` 20-byte hex), R4 expected-outcome mentions Approve.
- R2 partial-coverage marker: **1 of 3 curated cases landed**. R2 is NOT yet complete. UNIT-3b (commercial-policy-void) and UNIT-3c (medicaid-denied-then-appealed) are the remaining scenarios.
- Gate verdict: hardhat 28/28 ✓ (unchanged — no contracts diff), lib tests 27/27 ✓ (+6), tsc ✓, secret-scan ✓ (only the well-known empty-bytes keccak placeholder + a synthetic `0x…0001` address), Opus solidity-compliance PASS (no contracts diff), Opus security-review PASS (R1 PHI guards in note.md confirmed, no real-shape identifiers), Opus strict-review PASS after 2 iterations (8 total findings landed across iterations 1+2, all 8 closed inline: 2 MEDIUMs `_note` antipattern in payer-profile.json removed; 4 LOWs in test tightening — `submittedAt`/`submittedBy` assertions added, defensive `references` fallback removed (fail-loud), PHI regex set extended with phone/email/MRN, R2-partial documented here; NEW-1 LOW from iter 2 — `submittedAt` union → number-only — closed in iter 3). Coverage gate PASS-for-this-tick (no executable code added; coverage tooling not yet wired). Design-conformance gate 57% — pre-existing UI gap, no regression from this fixture-only tick. Browser-verify DEFERRED — this tick adds no executable UI or contract code to drive against the chain; gate will re-arm when UNIT-4+ web hooks land.

### UNIT-3b (NEW — queued after UNIT-3a)
**`demo-data/scenarios/commercial-policy-void/` + mirror schema-validation test**
- Files: `demo-data/scenarios/commercial-policy-void/{note.md, packet.json, payer-profile.json, requested-drug.json, expected-outcome.md}` + `src/protocol/scenarios.commercial-policy-void.test.ts`
- R-citations: SPEC-0004 §2.1 R1, R2, R4; §3.2 Commercial discriminant (`{ line: "Commercial"; carrier; product; revision; sourceUrl; contentHash }`)
- Acceptance criterion: scenario folder has all 5 R4 files; `payer-profile.json` has `payerLine: "Commercial"` and a Commercial-shaped `formularyRelease` (NOT planId — use carrier/product/revision); `expected-outcome.md` documents the expected ruling as **PolicyInvalidated** (the "policy void" path — the cited policy clause contradicts the claim-form path, exposing a parse-vs-policy mismatch); test mirrors the partd-approvable test structure.

### UNIT-3c (NEW — queued after UNIT-3b)
**`demo-data/scenarios/medicaid-denied-then-appealed/` + mirror schema-validation test**
- Files: `demo-data/scenarios/medicaid-denied-then-appealed/{note.md, packet.json, payer-profile.json, requested-drug.json, expected-outcome.md}` + `src/protocol/scenarios.medicaid-denied-then-appealed.test.ts`
- R-citations: SPEC-0004 §2.1 R1, R2, R4; §3.2 Medicaid discriminant (`{ line: "Medicaid"; state; mco; revision; sourceUrl; contentHash }`); §2.4 R14a (appeal sequencing — Denial at round 0 → Approve at round 1 simulates the deny-then-appeal arc)
- Acceptance criterion: scenario folder has all 5 R4 files; `payer-profile.json` has `payerLine: "Medicaid"` and a Medicaid-shaped `formularyRelease` (state/mco/revision); `expected-outcome.md` documents the round-0 Deny and the round-1 Approve-after-appeal narrative; test mirrors the partd-approvable test structure.

### SPEC-0004 R8 ↔ §3.2 inconsistency (NEW — deferred from tick 8 strict-review)
**Spec-cleanup unit: R8 line 153 says `planIdOrProduct` shorthand; §3.2 line 407 uses the discriminated union with `planId` (PartD) / `carrier+product` (Commercial) / `state+mco` (Medicaid)**
- Files: `docs/specs/0004-data-and-evidence-model.md`
- R-citations: SPEC-0004 §2.2 R8; §3.2
- Acceptance criterion: R8's prose-shorthand list of `formularyRelease` fields is rewritten to either (a) reference §3.2 explicitly ("see §3.2 for the per-line discriminated shape") or (b) match §3.2's per-line field set exactly. The internal inconsistency between the two sections is removed; test `scenarios.partd-approvable.test.ts` line 73 inline comment about the divergence can then be deleted.

### UNIT-2-followup-B (LANDED tick 6 — createContract guard ordering pinned)
**R2b zero-address ordering test — prevents silent revert-string drift**
- What landed: new test in `contracts/test/CoverageNegotiation.test.ts` after the existing R2b test, asserting all 4 sub-cases: `provider==0 → "addr: zero"`, `insurer==0 → "addr: zero"`, `provider==insurer==0 → "addr: zero"` (NOT "create: self-contract"), `provider==insurer!=0 → "create: self-contract"`. Mirror added in `src/contract/simulated.auth.test.ts` confirming sim/real parity. If a future refactor swaps the require lines in `createContract`, the (zero, zero) case would silently flip strings and the test fails immediately.
- Gate verdict: hardhat 28/28 ✓ (+1), vitest 21/21 ✓ (+1), tsc ✓, secret-scan ✓. Opus gates skipped per very-lean-tick procedure (test-only diff; trivial ordering invariant).

### UNIT-2-followup-A (LANDED tick 5 — appeal-state edge coverage)
**Parameterized "appeal from any non-Denied state reverts" test**
- What landed: new `describe("UNIT-2-followup-A: appeal reverts from every non-Denied state")` in `contracts/test/CoverageNegotiation.test.ts` with 9 sub-tests covering Ready, UnderReview, EvidenceRequested, Approved, Settled, Deadlocked, PolicyInvalidated, ProviderRefused, Withdrawn. Each drives a fresh deploy to the target state and asserts `appeal()` reverts with exactly `"appeal: prior ruling not Deny"`. Mirror test added to `src/contract/simulated.auth.test.ts` for sim/real parity. Confirmed every state hits the same revert string — the contract's `appeal()` places the state guard FIRST (before auth + cap), so terminal states don't expose different revert paths.
- Gate verdict: hardhat 27/27 ✓ (+9 new), vitest 20/20 ✓ (+1 new), tsc ✓, secret-scan ✓. Opus gates SKIPPED per lean-tick procedure (token budget in 60–75% band): the change is test-only, no contract code modified, and the strict-review of tick 4 explicitly prescribed this exact fix.

### UNIT-2 (LANDED tick 4 — SPEC-0004 Phase 1 contracts)
**R14a sequencing predicate + R2b self-contract rejection + PacketSubmitted event**
- What landed: `appeal()` precondition tightened from `state == Approved||Denied` to `state == Denied` only (R14a; only a Deny justifies advancing the ladder). `createContract` rejects `providerAddr == insurerAddr` with "create: self-contract" (R2b; supersedes SPEC-0001 R12/R13). `PacketSubmitted(reqId, round, packetRoot, packetUrl)` event emitted inside `_fireAgent` BEFORE `platform.createRequest` (covers requestAdjudication + submitEvidence + appeal, all three fire paths). Contract @dev block rewritten to drop the now-false R12 single-shared-wallet claim. Sim/real parity: PacketSubmittedEvent added to TS event union; simulated.ts emits it before RulingRequested; real.ts subscribes + decodes the ethers log. Cross-callsite ripple: `createInsurerAgent` gained optional `addressOverride`; `scripts/orchestrator-demo.mjs` uses a distinct synthetic insurer address; `scripts/real-backend-localnode.mjs` uses Hardhat account #1 for insurer; `web/src/views/Create.tsx` uses `SYNTHETIC_INSURER_ADDR` constant pending UNIT-7's real counterparty input.
- Gate verdict: hardhat 18/18 ✓ (15 + 3 new: R2b self-contract, R14a Approve→appeal, PacketSubmitted emission on all three fire paths), vitest 19/19 ✓, tsc ✓, secret-scan ✓, Opus solidity-compliance PASS, Opus security-review PASS, Opus strict-review PASS (after addressing 3 CRITICAL findings + 1 MEDIUM deferral inline — see strict-review-findings.md).
- Deferred follow-up units (queued below): UNIT-2-followup-A (parameterized appeal-from-any-non-Denied-state edge tests), UNIT-2-followup-B (R2b zero-address-ordering test).

### UNIT-2-followup-A (NEW — deferred from tick 4 strict-review)
**Parameterized "appeal from any non-Denied state reverts" test**
- Files: `contracts/test/CoverageNegotiation.test.ts`
- R-citations: SPEC-0004 §2.4 R14a; SPEC-0001 §3 state machine completeness
- Acceptance criterion: a parameterized test loops over `[Open, Ready, UnderReview, EvidenceRequested, Approved, Settled, Deadlocked, PolicyInvalidated, ProviderRefused, Withdrawn]` and asserts each reverts `"appeal: prior ruling not Deny"`. Use the existing state-driving helpers; small (~60 lines). Mirror in `src/contract/simulated.auth.test.ts` for sim parity.

### UNIT-2-followup-B (NEW — deferred from tick 4 strict-review)
**R2b createContract guard ordering test**
- Files: `contracts/test/CoverageNegotiation.test.ts`, `src/contract/simulated.auth.test.ts`
- R-citations: SPEC-0004 §2.1 R2b AC-6
- Acceptance criterion: test pins that `provider==0 → "addr: zero"`; `insurer==0 → "addr: zero"`; `provider==insurer==0 → "addr: zero"` (NOT "create: self-contract"); `provider==insurer!=0 → "create: self-contract"`. Prevents silent revert-string drift if a future refactor swaps the require lines.

### UNIT-1 (LANDED tick 3 — SPEC-0004 Phase 2)
**`LADDERS` typed constant + `PayerLine` enum + `payerLine`/`appealRound` on `Negotiation`**
- What landed: `src/protocol/ladders.ts` (PayerLine enum + LADDERS constant: PartD×5, Commercial×3, Medicaid×3; stageNameFor helper). `Negotiation` interface + Solidity struct gain `payerLine` + `appealRound`. `createContract` gets a required trailing `payerLine` param; `appeal()` increments `appealRound` after the cap check (deadlock path leaves it unchanged). Mechanical plumbing through ABI, real.ts (RawNegotiation +2 slots), simulated.ts, party-agent (FileRequestInput.payerLine required, no silent default), orchestrator NegotiationScript, web Create.tsx (defaults to PartD pending UNIT-7 picker), scripts/orchestrator-demo.mjs, scripts/real-backend-localnode.mjs. Tests: hardhat all `createContract` callsites get trailing `0 /* PartD */`, T6 + R9-deadlock-appeal got new appealRound assertions, R9-deadlock-submitEvidence already covered. `src/protocol/ladders.test.ts` adds 14 vitest assertions (counts, every R15 name pinned, all window/threshold values pinned, stageNameFor edge cases for invalid PayerLine + negative round, citation completeness).
- Gate verdict: hardhat 15/15 ✓, vitest 19/19 ✓, tsc ✓, secret-scan ✓, Opus solidity-compliance PASS, Opus security-review PASS, Opus strict-review PASS (after addressing 5 findings inline: ROUND SEMANTICS comment rewrite, appealRound deadlock invariant test, all-R15-names test, stageNameFor edge tests, FileRequestInput.payerLine required).
- Informational deferred: ContractCreated event lacks payerLine for indexer filtering (track for UNIT-2/PacketSubmitted); (PartD, 4) Medicare Appeals Council kept in LADDERS even though v0 terminal is round 3 (data model carries what enforcement may not use).

### UNIT-A0 (LANDED tick 2 — baseline gate now green)
**Fixed the 12 baseline Hardhat test failures + restored spec-aligned semantics**
- What landed: (1) `currentlyFiringReqId` storage hook on `CoverageNegotiation` + mock rewrite using it. (2) `submitEvidence` made `payable nonReentrant`, fires the agent directly (spec R6c), with `maxRounds` cap mirroring `appeal`. (3) `handleResponse` decodes the full arbiter tuple (decision, costPlusUnitPrice, nadacUnitPrice, rationaleHash, clauseRef, standardRef, receiptId) + branches PolicyInvalid → `PolicyInvalidated` + applies R6a deterministic cap on Approve. (4) `src/contract/real.ts` `submitEvidence` wrapper now forwards `agentFeeValue`. (5) Test T10 stale `{ value: FEE }` removed; new test `R9 (deadlock submitEvidence)` added.
- Gate verdict: hardhat 15/15 ✓, vitest 5/5 ✓, tsc ✓, secret-scan ✓, Opus solidity-compliance PASS, Opus security-review PASS, Opus strict-review PASS (after 2 review iterations addressing 4 findings).
- R-citations satisfied: SPEC-0001 R6a, R6b, R6c, R9 (fee model), R11 (party auth).

### UNIT-1 (SELECTED for tick 3 — was tick 1's target; UNIT-A0 unblocks it)
**SPEC-0004 Phase 2: `LADDERS` typed constant + `payerLine`/`appealRound` on `Negotiation` type**
- Files: `src/protocol/ladders.ts` (new), `src/contract/types.ts` (extend `Negotiation`), `src/types/coverage.types.ts` (mirror `PayerLine` enum), `contracts/contracts/CoverageNegotiation.sol` (add `PayerLine` enum + struct fields)
- R-citations: SPEC-0004 §2.4 R13, R15, R16; §2.5 R17
- Acceptance criterion: `src/protocol/ladders.ts` exports a typed `LADDERS: Record<PayerLine, LadderRow[]>` constant with all three payer lines (PartD 5 entries, Commercial 3, Medicaid 3) including `name`, `description`, `citation`, `window`, `threshold` per `LadderRow`; `Negotiation` interface gains `payerLine: PayerLine` and `appealRound: number` fields; the Solidity `Negotiation` struct mirrors those two fields; existing Hardhat tests still compile and pass.
- Tick 1 note: implementation was developed end-to-end (mechanical typing pass; all touched files identified; PartD/Commercial/Medicaid LADDERS table populated). All source changes were reverted because UNIT-A0 must land first or the tests gate cannot be evaluated. Re-implementation next tick from clean baseline is mechanical.

### UNIT-2
**SPEC-0004 Phase 1 (contracts): `PayerLine` enum + R14a sequencing predicate + `PacketSubmitted` event + multi-wallet R2b `createContract` self-contract rejection**
- Files: `contracts/contracts/CoverageNegotiation.sol`, `contracts/test/CoverageNegotiation.test.ts`
- R-citations: SPEC-0004 §2.4 R13, R14a; §2.3 §3.5 (`PacketSubmitted`); §2.1 R2b (AC-6 self-contract rejection)
- Acceptance criterion: contract compiles; new test asserts `requestAdjudication(round=1)` reverts if round 0 was not `Deny`; `PacketSubmitted` event is emitted on `requestAdjudication`; `createContract` reverts when `providerAddr == payerAddr`; all existing tests pass.

### UNIT-3
**SPEC-0004 Phase 3: three curated scenario folders under `demo-data/scenarios/`**
- Files: `demo-data/scenarios/partd-approvable/`, `demo-data/scenarios/commercial-policy-void/`, `demo-data/scenarios/medicaid-denied-then-appealed/` — each with R4 file set: `note.md`, `packet.json`, `payer-profile.json`, `requested-drug.json`, `expected-outcome.md`
- R-citations: SPEC-0004 §2.1 R1, R2, R4
- Acceptance criterion: all three scenario folders exist with all five required files; `note.md` contains a plausible synthetic clinical note (not blank, no PII markers); `payer-profile.json` has the correct `payerLine` for each case; `expected-outcome.md` documents the expected arbiter ruling.

### UNIT-4
**SPEC-0003 Phase A: `useAction()` in-flight guard + `useNegotiation(reqId)` re-derive hook + `revertReasonMap.ts`**
- Files: `web/src/hooks/useNegotiation.ts` (new), `web/src/hooks/useAction.ts` (new), `web/src/lib/revertReasonMap.ts` (new), `web/src/views/Detail.tsx` (wire up)
- R-citations: SPEC-0003 §2.3 R13, R14, R16
- Acceptance criterion: `useAction()` wraps any async write fn, sets `pending=true` on call and clears on resolution/error; the Detail action panel re-fetches on every `tx-confirmed` event keyed to `reqId`; `revertReasonMap` maps at least the five contract error strings (`engage: not Open`, `adjudicate: not Ready`, `fee: underfunded`, `auth: not a party`, `appeal: needs evidence`) to plain-English user copy; no timer-based state clears.

### UNIT-5
**SPEC-0003 Phase A: `<ErrorCard>` component + R18 semantic post-action confirmation card**
- Files: `web/src/components/ErrorCard.tsx` (new), `web/src/components/ActionConfirmation.tsx` (new), `web/src/views/Detail.tsx` (wire up), `web/src/views/Create.tsx` (wire up)
- R-citations: SPEC-0003 §2.4 R21; §2.3 R18
- Acceptance criterion: `<ErrorCard>` renders (a) one-line plain-English headline via `revertReasonMap`, (b) collapsible "Technical details" block, (c) dismiss/retry affordance — and does not push surrounding layout off the page; `<ActionConfirmation>` renders after state transitions with the semantic meaning (method-specific content per R18 spec text); both pass a `@1280x800` visual check with no overflow.

### UNIT-6
**SPEC-0003 Phase B: layout + overflow CSS pass at 1280×800 and 1920×1080**
- Files: `web/src/styles.css`, `web/src/views/Detail.tsx`, `web/src/views/Create.tsx`, `web/src/views/Overview.tsx`
- R-citations: SPEC-0003 §2.4 R20, R22
- Acceptance criterion: at 1280×800 and 1920×1080 — no unintended horizontal scroll; long hashes truncated with `text-overflow: ellipsis` or `word-break: break-all` inside fixed containers; multi-paragraph justification textarea scrolls internally; action panel buttons do not overflow their card; tested states: empty Overview, Overview ≥3 rows, Create empty, Create filled, Detail at states Open/Ready/UnderReview/Approved/Denied/Settled.

### UNIT-7
**SPEC-0003 Phase D: Create-form submit gating by wallet balance (R30/R31)**
- Files: `web/src/views/Create.tsx`, `web/src/hooks/useWalletBalance.ts` (extend or use existing)
- R-citations: SPEC-0003 §2.6 R30, R31, R32
- Acceptance criterion: with a wallet balance of 0 STT, the Create form's Submit button is disabled and an inline message shows the shortfall (`"Requested amount exceeds your wallet balance (0 STT). Lower the amount or top up the wallet."`); the check is the sum of `requestedAmount + estimatedGasFor(createContract) + VITE_AGENT_FEE_WEI`; updating the `requestedAmount` field live updates the block without a page reload.

### UNIT-8
**SPEC-0002 cleanup: timeline backfill for historical events (R1 gap) + `explorerLinks.ts`**
- Files: `web/src/views/Detail.tsx` (fix historical-event hydration), `web/src/lib/explorerLinks.ts` (new)
- R-citations: SPEC-0002 R1, R4; SPEC-0003 §2.7 R35 (explorer link reuse)
- Acceptance criterion: opening Detail for a pre-existing `reqId` (one created before the current page session) immediately shows its historical events in the timeline without requiring a new on-chain tx; `explorerLinks.ts` exports `txUrl(hash)` and `receiptUrl(receiptId)` returning valid Somnia testnet explorer URLs.

### UNIT-9
**SPEC-0004 Phase 5 (TS): `src/protocol/packet.ts` — `EvidenceReference`, `Packet` type, Merkle-leaf hasher**
- Files: `src/protocol/packet.ts` (new), `src/protocol/packet.test.ts` (new)
- R-citations: SPEC-0004 §2.3 R9, R10, R11; §3.4 schema
- Acceptance criterion: `packet.ts` exports `EvidenceReference` and `Packet` TypeScript types matching the §3.4 schema exactly; exports `merkleLeaf(ref: EvidenceReference): Hex` and `merkleRoot(refs: EvidenceReference[]): Hex` helpers; Vitest unit tests pass with at least: empty packet root is deterministic; single-entry root equals the one leaf hash; a two-entry root differs from either leaf; round-trip `JSON.stringify(slice)` in the leaf hash matches the spec formula.

### UNIT-10
**Design conformance: wire `payerLine`/`appealRound` → appeal-ladder UI chip in Detail (SPEC-0004 Phase 6 read-path)**
- Files: `web/src/views/Detail.tsx`, `web/src/views/Overview.tsx`
- R-citations: SPEC-0004 §2.4 R15, R21; prototype `screens.jsx` `AppealLadder` / `RequestRow` "Appeal stage" column
- Acceptance criterion: the Detail view shows an "Appeal ladder" section that reads `(payerLine, appealRound)` from `Negotiation` and renders the stage name from the `LADDERS` constant (UNIT-1); the Overview table "Appeal stage" column shows the stage name (not just the round number); both render `"—"` / `"Initial Determination"` for `appealRound=0`; the prototype's `LADDERS[payerLine][i].name` strings match exactly.

## Steady-state criteria — current verdict (tick 46)

- [x] 100% R-numbered requirements (specs 0001–0004) have ≥ 1 passing test (per tick-46 strict-review point 7)
- [x] Tests: 100% pass — 84/84 lib + 28/28 hardhat + **35/35 web E2E**
- [~] Coverage ≥ 85% line + branch — packet.ts 100% (tick 38); full-tree measurement pending
- [x] Solidity-compliance: NO findings (last green tick 38; no contracts diff since)
- [x] Security-review: NO findings (tick 46)
- [x] Strict-review: NO findings (tick 46)
- [~] Browser-verify: R2 + R2a + T2b-1 + T2b-5 green (testnet); T2b-2/3/4 blocked on operator action (fund insurer wallet); T2b-6 not reachable through current UI but contract-tested
- [x] Design-conformance: ≥ 90% (92% last measurement; no UI structural change since)

**Not yet steady-state**: T2b-2/3/4 are operator-blocked. Loop staying in `impl` mode.

## Recent findings (rolling — newest first, last 20)

- **2026-05-29 (tick 50 — SPEC-0004 R11 `usedReferenceIndices` + `usedLeafHashes` decode landed):** Mirror of tick 49 with two new fields. The `Ruled` event grew 8 → 10 args; `handleResponse` abi.decode tuple grew 8 → 10; MockAgentPlatform.Ruling struct + abi.encode were mirrored. viaIR (enabled tick 49) handled the bigger decode without further stack pressure. 5 existing test `.withArgs(...)` chains got two empty arrays appended; new `describe("R11: usedReferenceIndices + usedLeafHashes propagation")` test pins the populated case (`[0n]` + `["0x"+"11".repeat(32)]`) end-to-end. Sim/real parity preserved (`?? []` fallbacks in real.ts; default-empty in sim emit sites). Strict-review iter-1 caught the same flavor of issues tick 49 had: 1 MEDIUM (operator-note in loop-state.md still said "extended from 7 to 8" — needed 7→8→10 + name the 8th/9th/10th tuple positions) + 1 LOW (the two new sim setters lacked the explicit forward-staging label that tick-49's R23 setter carries) + 1 advisory (viaIR comment in hardhat.config.ts still narrated only the 8-element shape). All three closed inline iter-2 → PASS zero findings. Solidity-compliance PASS zero in-source (8 hard-scrutiny points; reentrancy/access/uint16/bytes32/loops/storage/CEI/OZ all unchanged; viaIR re-confirmed). 2 operator items re-asserted: deploy the **10-arg** source (not the intermediate 8-arg shape from tick 49) and ensure the live Somnia agent encodes all three new tuple elements. 30/30 hardhat, 84/84 lib, 35/35 harness still green.
- **2026-05-29 (tick 49 — SPEC-0004 R23 `policyVoidedClauseIndices` decode landed):** First substantive SPEC-0004 contract change since the amendment-0005 prose update. Extended the `Ruled` event from 7 → 8 args by appending `uint16[] policyVoidedClauseIndices`, with full decode through `handleResponse` and sim/real parity. Hit one real production-concern compile bug: stack-too-deep on the 8-element abi.decode tuple, fixed with the standard remedy `viaIR: true` (Yul IR codegen). The new R23 test exercises mock encode → contract decode → `Ruled` emit end-to-end with `[2n]` as the populated array. Strict-review iter-1 flagged 1 MEDIUM (deployed contract at `0x1dC5bA67…3E1A` carries the OLD 7-arg ABI — `real.ts` decoding will desync) + 1 LOW (JSDoc on the new sim setter falsely claimed a "backend `setNext…` pattern" that doesn't exist) + 2 advisory items (viaIR rationale, unused-setter doc). Iter-2 PASS after rewriting the JSDoc to point truthfully at the web-layer setters, adding a 6-line inline comment on viaIR in hardhat.config.ts, and a new Operator-notes entry coordinating the redeploy. Solidity-compliance PASS zero in-source findings — 8 hard-scrutiny points all closed (reentrancy/access/uint16/loops/storage/CEI/OZ-patterns/viaIR-trade-off) + 2 advisory items for the operator (redeploy + Somnia agent payload encoding). 29/29 hardhat, 84/84 lib, 35/35 harness still green. Pre-existing UI/sim consumers all forward-compatible thanks to the `?? []` fallback.
- **2026-05-29 (tick 47 — production-build gate verified empirically + bookkeeping):** Followed up on tick-45's strict-review claim that Vite would tree-shake the `window.__curie` block in unflagged production builds. Built without `VITE_EXPOSE_TEST_API=1` and confirmed by both DOM probe (`typeof window.__curie === "undefined"`) and source-grep on the minified bundle (`setNextCostPlusUnitPrice` not present in `web/dist/assets/index-*.js`) that the gate works as designed. UI continues to render correctly without the test surface. Also bookkept UNIT-ladders-fallback-semantics — verified the tick-16 LOW finding had already been closed inline: the JSDoc at ladders.ts:162-184 explicitly documents the intentional divergence from the prototype's clamp+fallback (production prefers fail-loud with `"—"`), and ladders.test.ts:42-56 pins all four edge cases. No code change this tick.
- **2026-05-29 (tick 46 — Scenarios G + H closed; 🎉 35/35 = 100% simulated harness):** Major milestone — every E2E scenario in the simulated harness now passes. Scenario G's `nonparty-attempt` UI button never existed; rewrote the harness assertion to call `insurerEngage` directly via eval and confirm the R11 reject. Scenario H needed a real UI feature: the CDS-Hooks seam at the data layer was already implemented in `src/integrations/cds-hooks/` (mapper, fixture, types, index) but nothing wired it into the Create form. Added a "Load from EHR (CDS Hooks)" button that calls `orderSignToDraft(SAMPLE_ORDER_SIGN_REQUEST)`, fills the six form fields, and shows a `cds-provenance` banner — SPEC-0002 R7 now exercised end-to-end. Net: +27 lines in Create.tsx, +6 in run.sh. Strict-review PASS 0 (7 scrutiny points; one CSS-class polish gap noted as inline-closed LOW). Security-review PASS 0 (no PHI in fixture; mapper is defensive; banner is React-text-escaped). Harness progression total: 9→12→13→19→23→28→30→**35** across 8 ticks. T2b-2/3/4 remain blocked on operator wallet funding; steady-state not declared yet.
- **2026-05-29 (tick 45 — Scenario A closed; 30/35 = 86%):** Two bugs found in Scenario A and both confirmed to be in the *harness*, not the SUT. (1) The badge assertion expected exact "Ready" but the UI renders "Policy Attached — Ready for AI" — and the *prototype* `data.jsx:10` rendered "Policy attached" — so the original harness was wrong for both old and new UIs; relaxed to substring `*Ready*` scoped to the state-badge element while keeping the authoritative `state_of(1) == 1` check on the prior line. (2) The cost-pegging inputs (`costplus-unit-price`, `nadac-unit-price`) don't exist in the redesigned UI — they were always sim-runtime concerns, not user-facing per SPEC-0001 R16/R6a. Exposed `setNext{Decision,CostPlusUnitPrice,NadacUnitPrice}` on `window.__curie` under the same `VITE_EXPOSE_TEST_API=1` gate; harness pokes the mutables directly. Strict-review PASS 0 (8 scrutiny points; verified Vite tree-shakes the entire `__curie` block when the flag is unset). Harness 28/35 → **30/35 = 86%**. Remaining 5 are pure feature gaps (G's `nonparty-attempt`, H's CDS prefill button).
- **2026-05-29 (tick 44 — Scenarios B + F closed; 28/35 = 80%):** Two scenarios had been failing silently for a different reason than the structural bugs I'd been hunting: the harness's create-step in B and F was just **missing required form fields** (quantity, days-supply, evidence). Without them, Create.tsx's validation short-circuits with setError and the request is never created — downstream assertions return empty strings. Added the missing fills (mirroring Scenario A's complete fill set). Scenario F additionally needed (a) `data-testid="proof-toggle"` on the "View blockchain proof" button (the verify-note panel lives inside `{showProof && ...}`); (b) `eval_click verify-note-submit` for consistency; (c) bash-case capitalization fix (UI renders "✓ Matches the committed hash" / "✗ Does not match" — harness was matching `*matches*` lowercase). Harness 23/35 → **28/35 = 80%**. Strict-review PASS 0 findings (8 scrutiny points; the capitalization fix justified by UI being source-of-truth). Remaining 7 failures: A (UI badge text, coveredAmount cap), G (`nonparty-attempt` testid missing), H (CDS prefill not implemented).
- **2026-05-29 (tick 43 — Scenario C2 R6b PolicyInvalidated closed):** Same testid-migration pattern as tick 25's pill-button conversion: when the UI shifted the `<select data-testid="decision-select">` to a row of pill buttons, harness's `ab select` call broke silently. Fix: 1-line addition of `data-testid={\`decision-${cls}\`}` in Detail.tsx (`approve|deny|evidence|void`); 2 run.sh callsites rewritten to `eval_click decision-approve|decision-void`. Harness 19/35 → **23/35**. C2's full PolicyInvalidated path now works end-to-end: state lands at 8, gotcha panel renders with struck-through clause + FDA citation. Strict-review PASS 0 findings (7 scrutiny points all closed; cls→testid mapping verified collision-free). Remaining 12 harness failures across A (2), B (3), F (2), G (1), H (4) — each a smaller individual bug; H is feature-gap (CDS-Hooks prefill button).
- **2026-05-29 (tick 42 — UNIT-engage-flow-silent-fail closed):** Two coordinated bugs surfaced and fixed. (1) agent-browser's `find testid X click` doesn't fire React's synthetic onClick reliably for nested-content buttons (policy-card with `<span>`/`<strong>`/`<p>` children) — `document.querySelector(sel).click()` via eval always bubbles. Added `eval_click` helper to run.sh; rewrote 19 action-submit invocations. (2) Simulated backend's R11 `caller` field defaulted to provider's `wallet.address` via `src/contract/index.ts:50` but `setActiveClientProfile` only flipped the active-client pointer — never the sim caller. Result: every insurer-profile action threw `auth: not insurer`. Fix: `setActiveClientProfile` calls `client.negotiation.setCaller(addr)` in sim mode. Harness 13/35 → **19/35** (Scenario A now 5/7, Scenario E 7/7). Strict-review PASS zero findings (8 scrutiny points all closed). Remaining 16 failures are different bugs: UI badge text divergence (Scenario A), R6b PolicyInvalidated path (Scenario C2), CDS-Hooks prefill not implemented (Scenario H, separate queued unit), Scenario F note-verify path, Scenario G non-party rejected predicate.
- **2026-05-29 (tick 41 — UNIT-fix-r2b-simulated-self-contract):** Tick-39's "agent-browser click doesn't fire React onSubmit" finding was a **misdiagnosis** — empirical trace this tick showed the click DOES fire, the React validation DOES run, the submission DOES reach `createContract`, and the contract reverts cleanly with `"create: self-contract"`. Root cause: in simulated mode `insurerClient === providerClient` (tick-25 MEDIUM 1 made them share an instance so profile-flip survives), which collapses `INSURER_ADDRESS` onto the provider's wallet address, which trips SPEC-0004 R2b. Fix: `web/src/client.ts` `INSURER_ADDRESS` becomes a fixed synthetic distinct address `0x…c0c0c0` in simulated mode; real mode unchanged. Net: 1-line change in client.ts. Harness 12/35 → **13/35** — Scenario A's create now succeeds. Next blocker found while tracing: clicking `engage-load-compliant` doesn't make `engage-submit` button render, so Scenario A stalls at Open state. Queued as `UNIT-engage-flow-silent-fail`. Strict-review skipped this tick (one-line trivially-correct fix; full audit deferred to bundle with engage-flow follow-up).
- **2026-05-29 (tick 40 — UNIT-fix-e2e-harness-api-shape):** Closed the biggest tick-39 finding: harness was failing 26/35 because `window.__curie` shape was wrong. The fix was a 3-file change: (1) client.ts adds 4 active-client-tracking getters + a `VITE_EXPOSE_TEST_API=1` opt-in flag so preview builds (which the harness actually drives) can expose the test API while normal production builds stay clean; (2) App.tsx adds per-pill `data-testid="profile-pill-{id}"` because tick-25's `<select>` → pill migration broke the harness's `ab select`; (3) run.sh sets the flag at build time + rewrites 6× profile-switcher calls to click the per-pill testids. Score 9/35 → **12/35** (Scenario D fully green; Scenario G partial; observer + insurer profile switching now both fire). Strict-review PASS zero findings. Remaining 23 failures are all `requestId=1` reads returning empty because Scenario A's `ab find testid create-submit click` doesn't trigger React's `onSubmit` — the click-bug is tracked as a separate queued unit and is the obvious next target.
- **2026-05-29 (tick 39 — first live end-to-end browser-verify on Somnia testnet):** The user explicitly requested `agent-browser` verification this run. The harness wasn't on PATH; installed via `npm i -g agent-browser` (`0.27.0`) and `npx playwright install chromium`. Drove the live web app at `http://localhost:4173/` against the deployed contract `0x1dC5bA6771A7f4426ABE5BB808a7d51BdEA33E1A`. **Four real on-chain contracts created** (Requests #3/#4/#5/#6 — all three R2 curated cases + R2a custom-case) — confirms payer-line routing + appeal-ladder display + autofill+edit are working end-to-end. **Three real, actionable findings surfaced** that the prior fully-offline test runs couldn't have caught: (1) insurer wallet `0x140e…8C62` is **unfunded** (0 STT), blocking T2b-2/3/4 — operator action queued; (2) the `run.sh` E2E harness uses a `window.__curie.{negotiation,content,wallet,profiles}` API shape that **was never implemented** — client.ts exposes `{provider, insurer}` under `import.meta.env.DEV` only — causing 26/35 scenarios to fail silently on empty-string state reads; (3) agent-browser's `click` doesn't reliably fire React's `onSubmit` — the run.sh Create step silently fails — workaround: focus+Enter. Scenario H expects a `cds-prefill` testid the UI doesn't have. Net: no code change this tick (verify-only), but four new top-priority queue items landed in loop-state.md to be picked up by next ticks. Browser-verify gate now partially green for the first time (R2 + R2a end-to-end on testnet).
- **2026-05-29 (tick 38 — UNIT-9 packet.ts; first SPEC-0004 §2.3 evidence-model work):** First tick to ship the SPEC-0004 evidence-packet primitives — `EvidenceReference`, `Packet`, `sliceHash`, `merkleLeaf`, `merkleRoot`. Strict-review iter-1 was a useful gauntlet: M1 caught a JSDoc lie (impl says "OpenZeppelin MerkleProof convention" for duplicate-last, but OZ's `StandardMerkleTree` does NOT duplicate — that's the Bitcoin convention; the sorted-pair half IS OZ-compatible for `MerkleProof.verify`); M2 caught test self-pinning (test helpers reused the same ethers primitives in the same order as the impl, so an impl+helper drift-together bug would have passed). Both fixed inline: JSDoc honestly attributes each design choice; 5 frozen literal-pin hex anchors added so a future drift-together is caught by the literal staying the same. Iter-2 strict-review PASS with zero findings. The Merkle convention choice (duplicate-last vs promote) is now documented as a load-bearing decision that a future on-chain verifier MUST match; tracked forward for SPEC-0004 Phase 5. Net: 2 new files, 84 lib tests (+9), 100% line/branch/function coverage on packet.ts. Browser-verify + design-conformance + solidity-compliance NOT RUN (no UI/contract surface change this tick). **Pre-tick hygiene commit `b514cca`** landed SPEC-0001 R19 (Somnia agent-interface mirror posture) + matching `ISomniaAgent.sol` header + vite dev-host allow for cloudflare-tunnel — three coherent loose-end items that had been left uncommitted.
- **2026-05-29 (tick 12 — UNIT-4-narrow; first substantive web/ work):** First tick to touch React-land. The dev subagent's `revertReasonMap.ts` discovered 27 unique contract revert strings — far more than the 5 the loop-state acceptance criterion listed — and mapped them all. Useful side-effect: tsc surfaced a UNIT-2-era bug in `web/src/shared.ts` (missing `PacketSubmitted` switch case from when the event was added in tick 4); fix bundled in this commit, defensible because it gated the web tsc gate. Strict-review PASS first-pass with 4 NITs; NIT 2 (extractRevertReason probe order bypasses `.shortMessage`) was closed inline because it had a real R16-coverage impact. Repo has no React testing infra (no vitest, no RTL); `useAction` correctness rests on tsc + a future browser-verify. Two follow-up targets: (a) test 3 reference-equality tightening (deferred NIT 3); (b) UNIT-4b (useNegotiation + Detail.tsx wire-up) for tick 13.
- **2026-05-29 (tick 11 — UNIT-3-refactor + R6b prose-update; longest gate run yet clean):** Paired bookkeeping tick — DRY extraction of scenario-test helpers + amendment 0005 application to SPEC-0001 R6b. The dev subagent delivered a 123-line helper with 4 named exports; the three scenario test files each shed ~80 lines and now import from the helper. Strict-review PASS first pass — 0 actionable findings (rare; the refactor preserved all 44 test names, all scenario-distinct assertions, all PHI regex bytes). Security flagged a path-traversal academic concern on `loadScenarioFile(slug, filename)` — both gates agree it's not actionable because every call site uses a hardcoded slug constant; recorded as advisory hardening. The R6b prose now correctly says PolicyFlagged is an annotation event alongside Approve (per amendment 0005), and §3.5 Ruled event payload gained `policyVoidedClauseIndices`. Net diff: 1 new TS module + 3 test refactors + 1 spec edit. Net LOC: -117. **First explicit "future contract-implementation gap" surfaced**: queued as `SPEC-0004 Phase 1 contract decode for policyVoidedClauseIndices` since the contract's handleResponse decode hasn't caught up to the spec yet.
- **2026-05-29 (tick 10 — UNIT-3c landed; R2 curated-cases requirement COMPLETE):** Third (and final) curated scenario landed cleanly. The Centene Medi-Cal / dulaglutide round-0-Deny-then-round-1-Approve arc is structurally coherent — the round-0 packet genuinely misses the SGLT2-i evidence the PA criteria require, and the round-1 narrative cleanly fills the gap. Strict-review surfaced 1 LOW (header-line check didn't enforce Deny-before-Approve ordering — a prospective gap because today's fixture is correct) which was closed inline with a 3-line `search()` index comparison citing R14a. Two NITs (3x `assertNoPHI` copy and asymmetric sentinel-address convention) flagged to the queued UNIT-3-refactor unit. Net diff: 5 medicaid fixture files + 1 new test file. **R2 (curated cases, 3 of 3) is now complete.** Next priorities are SPEC-0001 R6b prose-update (amendment 0005 application), UNIT-3-refactor (DRY helpers), then UNIT-4 onward (SPEC-0003 web work).
- **2026-05-29 (tick 9 — UNIT-3b landed; first real spec amendment authored by the loop):** Second curated scenario (commercial-policy-void: Aetna / etanercept / Aetna CPB 0792 imaging-prereq vs FDA label) landed cleanly, BUT the first-pass strict-review surfaced two HIGH spec-conformance gaps that turned out to be real: (1) `slice.kind: "policy-clause"` is not in §3.4's closed enum (fixed by changing to `"guideline-recommendation"` — the Aetna CPB is structurally a payer guideline document); (2) the fixture's expected ruling `PolicyInvalidated` contradicted SPEC-0004 R23 which mandates `Approve + policyVoidedClauseIndices` for the commercial-policy-void case. The loop authored its first amendment (`docs/amendments/0005-policy-void-r23-supersedes-r6b.md`) resolving R23 supersedes SPEC-0001 R6b for the on-label-policy-void case, with five reasons (recency, specificity, motivation-alignment, provider-friendliness, payload-preservation). Two follow-up units queued: (a) SPEC-0001 R6b prose-update to apply amendment 0005, (b) test-helper DRY extraction across all three scenario tests. Net diff: 5 commercial fixture files + 1 amendment + 1 test (rewrite) + 1 partd-test PHI scan extension. R2 now **2 of 3** complete.
- **2026-05-29 (tick 8 — UNIT-3a landed, normal full-breadth tick):** First curated scenario (partd-approvable) authored as 5 R4 fixture files + a 7-assertion node:test schema-validation file. The dev+TDD subagents agreed on the §3.4 `references` packet shape; the TDD subagent's initial assertion against `planIdOrProduct` (R8 line 153 prose-shorthand) was corrected to `planId` per §3.2's discriminated TS union (the canonical type definition), with the spec-internal divergence documented inline in the test and queued as a spec-cleanup follow-up unit. Initial strict-review surfaced 6 findings (2 MEDIUM `_note` antipattern, 4 LOW test-tightening); all 6 fixed inline plus 1 NEW LOW (`submittedAt` union widened too far) introduced and closed in iteration 3. Net diff: 5 fixtures + 1 test file. Coverage gate PASS-for-this-tick (no executable code change); design-conformance unchanged at 57% (pre-existing UI gap, not blocked by this fixture tick); browser-verify DEFERRED until UI consumes the new scenarios directory in a later UI tick. R2 marked as **partial (1 of 3 cases)** in the queue — NOT done.
- **2026-05-29 (tick 7 — emergency tag, loop session paused):** No new code landed this tick. Token budget assessed at ~80% (75–90% band per procedure). The next queued unit UNIT-3 (three curated scenario folders × five synthetic clinical files each = 15 files of medically-coherent demo content) cannot be completed cleanly without a dev subagent, and the procedure forbids dispatching subagents in this band. Per the loop's "don't grind near the cap" principle, this is the right stopping point. **Six commits landed across ticks 1–6**, all gates green at last commit (hardhat 28/28, vitest 21/21, tsc clean, secret-scan clean, Opus solidity-compliance + security + strict-review all PASS on the most recent strict-review iterations). Operator handoff: restart in a fresh session to land UNIT-3+ (web hooks, UI conformance, curated scenarios, browser-verify). The `tokens-emergency-2026-05-29-1` tag marks this stopping point; `git diff start..HEAD` shows the loop's full delivery.
- **2026-05-29 (tick 6 — UNIT-2-followup-B landed, very-lean tick):** Closed the zero-address ordering gap from tick 4's strict-review LOW finding. Both UNIT-2 follow-ups now landed; SPEC-0004 Phase 1 contract work fully tested. Token budget after tick 6 estimated ~80% — clearly in the 75–90% band per procedure. Next tick must stop dispatching subagents, do small inline work only, and prepare for emergency tag if a non-trivial unit is next. UI units (UNIT-4+) will require a fresh session — they're too large to safely fit in remaining budget.
- **2026-05-29 (tick 5 — UNIT-2-followup-A landed, lean tick):** Closed the appeal-state edge-coverage gap from tick 4's strict-review. Confirmed by exhaustive testing: the contract's `appeal()` state guard is ordered BEFORE auth + cap checks, so all 9 non-Denied states produce the identical `"appeal: prior ruling not Deny"` revert — no terminal-state guard ordering surprises. Lean tick: skipped Opus gates since change was test-only and the prescribed fix was already vetted. Sim/real parity maintained. Token budget after tick 5 estimated ~75% — next tick should be very lean (skip all subagents per procedure; commit whatever's coherent; prepare for emergency-tag if needed).
- **2026-05-29 (tick 4 — UNIT-2 landed):** SPEC-0004 Phase 1 contracts landed. Initial strict-review caught 6 findings; 3 CRITICAL (lying R12 comment in contract header, runtime regressions in 3 consumers from the new R2b predicate, sim/real PacketSubmitted parity break) were release-blockers that I addressed inline. Net: contract change + 3 callsite updates + new TS event type + sim emission + real ABI mapping. Token budget after tick 4 estimated 70% — next tick is in the 60–75% band, so should skip non-essential subagents. Findings 4–6 deferred as UNIT-2-followup-A/B units in the queue (parameterized edge tests + zero-address ordering test).
- **2026-05-29 (tick 3 — UNIT-1 landed):** SPEC-0004 §2.4 R13/R15/R16 typing layer is now in place. Initial strict-review flagged 5 findings (2 MEDIUM: stale ROUND SEMANTICS comment, untested appealRound deadlock invariant; 3 LOW: ladders.test.ts spot-coverage, stageNameFor edge cases, FileRequestInput optional-with-PartD-default vs CreateContractParams required). All 5 addressed inline. Final vitest count grew from 5 → 19 (added 14 ladders assertions). Hardhat 15/15 unchanged (assertions added to existing T6 + R9-deadlock-appeal tests). Total tick cost included 3 Opus gate reviews (solidity/security/strict-1); strict-review-2 skipped to preserve token budget — findings instead resolved by direct edit + test reruns. Token budget after tick 3 estimated ~55–60% — tick 4 will be lean per the procedure (skip non-essential subagents if needed).
- **2026-05-29 (tick 2 — UNIT-A0 landed):** Baseline gate is now green (15/15 hardhat, 5/5 vitest). UNIT-A0 turned out to be more than a mock-probe fix — discovered three additional spec-drift points in `CoverageNegotiation.sol` (submitEvidence not payable + not firing agent; handleResponse decoding only a single uint; PolicyInvalid not routed). Dev subagent fixed all four in one coherent commit, validated by 3 Opus reviewers (solidity-compliance, security, strict). Strict-review iterated twice — first surfaced 3 findings (real.ts missing fee forwarding, stale test comment, missing round-cap on submitEvidence), all fixed inline; second surfaced 1 finding (missing test for the new cap path), fixed inline with `R9 (deadlock submitEvidence)` test mirroring `R9 (deadlock appeal)`. Net diff: contracts/* + 1 real.ts wrapper line + 2 test diffs. No `--no-verify`, no `--force-push`. Pushed.
- **2026-05-29 (tick 1 — BASELINE-BROKEN PIVOT):** `cd contracts && npx hardhat test` reports **2 passing / 12 failing** on the unmodified `e78b51f` baseline (verified by running tests with and without UNIT-1 source — same 12 failures both ways). Root cause: `MockAgentPlatform.sol` line 71–73 — the assembly probe `calldataload(payload.offset)` was written assuming `_fireAgent` passes `(reqId, ...)` as the payload, but production `_fireAgent` now passes `abi.encodeWithSelector(IParseWebsiteAgent.ExtractANumber.selector, ...)` whose first word is an ABI offset. The probe calls `stateOf(32)` → `'unknown contract'` revert → cascades through 10 tests. Two additional tests (T10 guards, one CEI test) fail for related-but-not-identical reasons. The loop's "100% tests pass" gate cannot be satisfied while this baseline is broken, so UNIT-1 (typing-only) was demoted and UNIT-A0 (fix baseline) inserted as new top priority. UNIT-1 source changes were reverted clean — only the loop-state.md update lands this tick. This is exactly the kind of finding the loop should surface: a gate-blocking bug that pre-existed the loop's first commit.
- **2026-05-29 (tick 1 bootstrap — planning):** Gap analysis complete. The contract (`CoverageNegotiation.sol`) and TS types (`src/contract/types.ts`) have no `payerLine`/`appealRound` fields — the entire SPEC-0004 §2.4 ladder model is absent from the chain layer. `src/protocol/` does not exist — no `ladders.ts`, `packet.ts`, `formulary.ts`. `demo-data/scenarios/` does not exist — zero curated cases. SPEC-0003 Phase A/B work (R13–R22: in-flight guards, re-derive from on-chain state, `ErrorCard`, `revertReasonMap`, layout fixes) is entirely absent. The prototype's appeal-ladder section in Overview + Detail (stage name column, payer-line chip, `LADDERS` table) is not wired in the React app. SPEC-0002 R1 timeline backfill is broken (Detail shows "No events yet" for pre-existing requests). SPEC-0003 §2.1 R1/R3/R4/R7–R10 are implemented (`useWalletBalance`, `TxMonitor`, `txLogger`, JSONL sink). SPEC-0001 core flow (contract, sim/real backends, events, 11-state machine, agent fee model) is implemented and tested. SPEC-0002 R2/R3/R5/R6 are implemented (profile picker, gotcha path, price gauge). CDS-Hooks seam (SPEC-0002 R7) is implemented in `src/integrations/cds-hooks/`.

## Tags so far

- `start` — loop-setup commit. `git diff start..HEAD` = everything the loop has done.

## Open creativity-mode PRs

*(empty until steady state reached)*

## Operator notes

- Wallet refill at https://testnet.somnia.network/ when balance < 5 STT.
- **OPEN (tick 39): Fund the insurer wallet `0x140e…8C62` with ≥ 0.1 STT to unblock T2b-2/3/4.** The `VITE_PRIVATE_KEY_INSURER` key is set in `.env` but the wallet has 0 STT and every insurer tx is dropped at gas estimation. Check at https://shannon-explorer.somnia.network/address/0x140e8C62...
- **OPEN (ticks 49 + 50): Redeploy the contract.** Tick 49 extended `CoverageNegotiation`'s `Ruled` event from 7 args to 8 (added `uint16[] policyVoidedClauseIndices` per SPEC-0004 R23 / amendment 0005). **Tick 50 extended it further from 8 to 10** (added `uint16[] usedReferenceIndices` and `bytes32[] usedLeafHashes` per SPEC-0004 §3.5 R11). The currently-deployed contract at `0x1dC5bA6771A7f4426ABE5BB808a7d51BdEA33E1A` (tick 37) still carries the 7-arg ABI, so `real.ts` event decoding will NOT match its event topic hash. Required to unblock real-mode browser-verify of R11 + R23 paths: (a) redeploy with `viaIR: true` enabled (see `contracts/hardhat.config.ts`); (b) update `VITE_CONTRACT_ADDRESS` + `COVERAGE_CONTRACT_ADDRESS` in `.env`; (c) ensure the live Somnia agent's payload builder encodes the **8th, 9th, AND 10th** tuple elements (`uint16[] policyVoidedClauseIndices, uint16[] usedReferenceIndices, bytes32[] usedLeafHashes`) or every ruling will revert in `handleResponse` (clean revert, no fund loss, but no observable ruling). **Do not deploy the intermediate 8-arg shape from tick 49 — it would be wrong on arrival.** Tracked also in `docs/progress/solidity-compliance.md` ticks 49+50 OPEN items.
- If the loop emergency-tags, restart after refill + a quick check of the latest `strict-review-findings.md`.
- If the strict reviewer's bar feels unreachable, relax it via spec edit (not via prompt edit) — the loop reads specs as truth.

## Ticks 77-79 strict-review iteration 2

- **Scope:** re-verify the iter-1 LOW finding — stranded duplicate `Last commit:` line at `docs/progress/loop-state.md:12` left over from a tick-50 commit when the tick-77 refresh didn't strip it.
- **Verification (lines 7-13 of `docs/progress/loop-state.md`):**
  - Line 7: `**Last updated:** 2026-05-30 (tick 77 — refresh after 16-tick drift)` — header preamble intact.
  - Line 8: `**Current mode:**` — intact.
  - Line 9: `**Current tick:** 77` — intact.
  - Line 10: `**Last focus:**` paragraph — intact.
  - Line 11: `**Last commit:** \`fdb77b5\` (tick 79 — Scenario I: persisted DemoUser harness coverage)` — **canonical, points at `fdb77b5` (tick 79)** as expected. ✓
  - Line 12: `**Emergency tag:** \`tokens-emergency-2026-05-29-1\` *(historical — superseded by the \`a68ffe5\` deprecation of token-budget gating)*` — **no longer the stale tick-50 duplicate**; it is now the Emergency tag line. ✓
  - Line 13: blank separator before `## Work queue`. ✓
- **Drift sweep:** ripgrep for `Last commit:` returns only the canonical line at 11 — no other stranded `Last commit:` occurrences anywhere else in the file. No new drift introduced.
- **Iter-1 finding status:** LOW closed.

**Verdict: PASS (zero findings)**
