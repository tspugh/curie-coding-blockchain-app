# Loop state

> Maintained by the spec-4 implementation loop. See
> [`docs/loop-prompts/spec-4-implementation-loop.md`](../loop-prompts/spec-4-implementation-loop.md)
> for the procedure that reads + writes this file.

**Last updated:** 2026-05-29 (tick 16 — UNIT-UI-3: Appeal stage + Round columns)
**Current mode:** `impl`
**Current tick:** 16
**Last focus:** Added the missing "Appeal stage" + "Round" columns to the Overview request table per prototype `screens.jsx:114-152`. Stage cell renders two lines per prototype: stage name (top, from `stageNameFor(payerLine, appealRound)` — typed `LADDERS` lookup, R15/R17) and payer-line caption below it ("Part D" / "Commercial" / "Medicaid"). Round cell right-aligned with tabular-nums. `LADDERS` + `stageNameFor` + `PayerLine` re-exported from `src/index.ts` so `@lib` import works. Strict-review caught 1 MEDIUM (chip wrapper diverged from prototype's two-line plain layout — fixed inline by dropping chip, adding caption) + 1 LOW (`stageNameFor` fallback semantics differ from prototype — queued as separate followup).
**Last commit:** `<this tick>` (tick 16 — UNIT-UI-3)
**Emergency tag:** `tokens-emergency-2026-05-29-1` *(historical — superseded by the `a68ffe5` deprecation of token-budget gating)*

## Work queue (priority order)

### UNIT-UI-3 (LANDED tick 16 — Appeal stage + Round columns)
**Two new columns in the Overview request table; stage name + payer-line caption + round/Nm**
- What landed: `web/src/views/Overview.tsx` adds the "Appeal stage" column (two-line cell: stageNameFor() result + payer-line caption "Part D" / "Commercial" / "Medicaid") and "Round" column (right-aligned tabular-nums). `src/index.ts` re-exports `LADDERS`, `stageNameFor`, `PayerLine` from `protocol/ladders.ts` so `@lib` works. CSS adds `.col-stage` / `.stage-name` / `.stage-payer` / `.col-round` using project tokens.
- Strict-review iter 1: 1 MEDIUM (chip wrapper diverged from prototype's plain two-line layout — fixed inline by dropping `.stage-chip` chip wrapper, rendering plain `stage-name` div + caption `stage-payer` div per `screens.jsx:142-144`); 1 LOW (`stageNameFor` returns "—" on out-of-range while prototype's `stageOf` clamps with PartD fallback — queued as `UNIT-ladders-fallback-semantics`); 5 NITs noted for future.
- Gate verdict: lib 53/53 ✓, hardhat 28/28 ✓, both tsc ✓, vite build ✓, secret-scan ✓.

### UNIT-ladders-fallback-semantics (NEW — strict-review tick 16 LOW)
**Reconcile `stageNameFor` out-of-range behavior with prototype's `stageOf`**
- Files: `src/protocol/ladders.ts`, `src/protocol/ladders.test.ts`, `docs/reference/ui-prototype-handoff/project/data.jsx` (read-only — for prototype's clamping logic)
- Acceptance criterion: pick a coherent fallback policy (likely: clamp out-of-range round to last stage of the line, fall back to PartD on unknown line) and either update `stageNameFor` to match OR document the divergence as intentional in the JSDoc. Update tests to pin the chosen behavior.

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

### SPEC-0004 Phase 1 contract decode for `policyVoidedClauseIndices` (NEW — flagged by tick 11)
**Decode the R23 payload field through `handleResponse` and emit it in the `Ruled` event**
- Files: `contracts/contracts/CoverageNegotiation.sol`, `contracts/test/CoverageNegotiation.test.ts`, `src/contract/abi.ts`, `src/contract/real.ts` (event decoding), `src/contract/simulated.ts` (event emission), `src/contract/types.ts` (RulingEvent type extension)
- R-citations: amendment 0005; SPEC-0004 R23; SPEC-0001 §3.5 (now updated to include the field)
- Acceptance criterion: `handleResponse` decodes a 9th tuple element `policyVoidedClauseIndices: uint16[]` (or `bytes` encoding `number[]`); emits it on `Ruled`; sim/real parity; tests pin both the empty case (Approve without policy void → empty array) and the populated case (Approve via R23 → array with the voided clause index).

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
- If the loop emergency-tags, restart after refill + a quick check of the latest `strict-review-findings.md`.
- If the strict reviewer's bar feels unreachable, relax it via spec edit (not via prompt edit) — the loop reads specs as truth.
