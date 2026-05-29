# Loop state

> Maintained by the spec-4 implementation loop. See
> [`docs/loop-prompts/spec-4-implementation-loop.md`](../loop-prompts/spec-4-implementation-loop.md)
> for the procedure that reads + writes this file.

**Last updated:** 2026-05-29 (tick 1 — bootstrap + baseline-broken pivot)
**Current mode:** `impl`
**Current tick:** 1
**Last focus:** Bootstrap planning queue + surface UNIT-A0 (baseline test failures are blocking the gate)
**Last commit:** *(set after tick 1 work commits)*

## Work queue (priority order)

### UNIT-A0 (SELECTED for tick 2 — blocker; tick 1 surfaced this as the gate)
**Fix the 12 baseline Hardhat test failures so the loop's "100% tests pass" gate can ever be satisfied**
- Files: `contracts/contracts/mocks/MockAgentPlatform.sol` (rewrite `observedStateDuringCreate` probe), possibly `contracts/contracts/CoverageNegotiation.sol` (expose a `currentlyFiringReqId()` view to support a correct probe), affected tests if assertion semantics need to adapt.
- Root cause (confirmed in tick 1): `MockAgentPlatform.createRequest` uses `assembly { reqIdFromPayload := calldataload(payload.offset) }` assuming `payload`'s first word is `reqId`. The production payload is `abi.encodeWithSelector(IParseWebsiteAgent.ExtractANumber.selector, ...)` whose first word is an ABI offset (32), not `reqId`. The probe therefore calls `stateOf(32)` which reverts with `'unknown contract'`, cascading 10+ test failures (the ones traversing `_fireAgent`) plus 2 unrelated revert-message changes (`'evidence: wrong state'` no longer matches).
- R-citations: SPEC-0001 R6/R9/R16 (test fidelity); SPEC-0001 §3.5 CEI (the probe asserts state==UnderReview AT TIME of platform.createRequest — the security invariant).
- Acceptance criterion: `cd contracts && npx hardhat test` reports `14 passing / 0 failing` on the unmodified `e78b51f` test set; the CEI assertion (`observedStateDuringCreate == 2`) still proves state==UnderReview at platform-callback time (the security invariant cannot be silently dropped); no test is silenced or weakened.

### UNIT-1 (re-queued — was tick 1's target; blocked by UNIT-A0)
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
