# Loop state

> Maintained by the spec-4 implementation loop. See
> [`docs/loop-prompts/spec-4-implementation-loop.md`](../loop-prompts/spec-4-implementation-loop.md)
> for the procedure that reads + writes this file.

**Last updated:** 2026-05-29 (tick 7 — emergency-tag; loop session paused at clean stopping point)
**Current mode:** `creativity` *(per emergency-tag procedure — operator should restart with a fresh session)*
**Current tick:** 7 *(emergency tag; no new code landed this tick)*
**Last focus:** Emergency-tag stop — UNIT-3 (curated scenarios × 5 files × 3) requires a dev subagent which is disallowed in the 75–90% token band per procedure
**Last commit:** `1d0fcea` (tick 6 — UNIT-2-followup-B)
**Emergency tag:** `tokens-emergency-2026-05-29-1`

## Work queue (priority order)

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
- If the loop emergency-tags, restart after refill + a quick check of the latest `strict-review-findings.md`.
- If the strict reviewer's bar feels unreachable, relax it via spec edit (not via prompt edit) — the loop reads specs as truth.
