# SPEC-0006 R14/R15/R17 — per-negotiation `agentEvidenceUrl` + `agentPromptHint` (full re-review)

**Date:** 2026-06-03
**Branch:** `spec-6-implementation` (working tree vs `origin/main`)
**Reviewer posture:** TOTAL-STICKLER. **Result: ZERO findings.**

**Scope:** the full working-tree `contracts/` diff vs `origin/main`, re-reviewed after
the per-negotiation evidence-URL / prompt-hint unit landed on top of the inferString
migration. This entry supersedes the per-category verdicts in the
`2026-06-03 @ a64f80d` section below and CLOSES its two residual notes (see
"Prior notes — now closed").

Diff under review (Solidity):

- `contracts/contracts/CoverageNegotiation.sol` —
  - `Negotiation` struct gains `uint256 lastRequestId`, `string agentEvidenceUrl`,
    `string agentPromptHint` (R14/R15);
  - the contract-level `string public agentEvidenceUrl` global and its
    `setAgentEvidenceUrl(string)` owner-setter are **removed**;
  - `createContract` signature gains two trailing `string calldata` params
    (`agentEvidenceUrl_`, `agentPromptHint_`) with non-empty `require` guards
    (`"evidence: url required"` / `"evidence: hint required"` — R17);
  - `_fireAgent` now reads `n.agentEvidenceUrl` / `n.agentPromptHint` and embeds
    them in the `inferString` prompt (the hardcoded "rheumatoid arthritis" global
    prompt is gone);
  - the dead `event PolicyFlagged` declaration is removed.
- `contracts/test/CoverageNegotiation.test.ts` — adds T9 (per-neg URL stored), T10
  (per-neg hint stored), T11a/T11b (empty-field reverts), plus `_fireAgent`-payload,
  types, simulated- and real-backend propagation assertions.

Also propagated (TS, outside `contracts/` but part of the unit): `src/contract/types.ts`
(`CreateContractParams` +2 required fields), `src/contract/simulated.ts` (store +
non-empty enforcement), `src/contract/real.ts` (ABI-encode the 2 trailing params + the
34-field `RawNegotiation` re-index), `src/contract/abi.ts` (`createContract` +
`getNegotiation` tuple).

## Validation (this pass)

- `npx hardhat compile` → "Compiled 8 Solidity files successfully" (solc 0.8.24,
  optimizer runs 200, viaIR). No warnings.
- `npx hardhat test` → **98 passing, 0 failing** — includes T9/T10/T11
  (and the T11c/T11d/T11e over-length + name-pattern edge cases), the
  `_fireAgent` per-neg payload tests, R24–R26, the R9 self-hosted-teardown negative
  assertions, and the `PolicyFlagged`-removed / `setAgentEvidenceUrl`-removed gates.
  Re-confirmed 2026-06-03: clean `npx hardhat compile` (no warnings), 98/98 green,
  `tsc -p tsconfig.json --noEmit` exit 0, `npm run test:lib` 209/209. Struct↔ABI
  tuple field order independently verified aligned 34/34 (positional decode safe).
- `npm run typecheck` → exit 0. `npm run test:lib` → **209 passing**.
- `npm run check-ruling-abi` → PASS (`inferString` selector `0xfe7ca098` asserted
  **inside** the `_fireAgent` body, not just a comment/interface).

## Per-category scrutiny — all PASS

- **Reentrancy.** Unchanged posture. Agent-firing entry points
  (`requestAdjudication`, `submitEvidence`, `appeal`) + `withdrawFunds` carry
  `nonReentrant`; `_fireAgent` keeps CEI (state → `UnderReview`, `totalFees`,
  `rulingDeadline` committed before `platform.createRequest`; refund last). The new
  `n.agentEvidenceUrl`/`n.agentPromptHint` storage reads in `_fireAgent` happen before
  the external call and introduce no new external interaction. A platform re-entering
  during `createRequest` still hits `require(reqId != 0)` because
  `_requestToNegotiation[requestId]` is written only after the call returns.
  `handleResponse` and `commitRationale` make no external calls.
- **Access control.** `createContract` keeps `msg.sender == providerAddr`. The removed
  `setAgentEvidenceUrl` owner-setter leaves no orphaned mutator; per-neg URL/hint are
  now set once, at creation, by the authenticated provider only. `commitRationale`
  is `onlyOwner`. All admin setters remain `onlyOwner`. No new ungated entry point.
- **Over/underflow beyond 0.8.x.** No new arithmetic on the live path beyond the
  string-length `require`s. `_truncateRationale`'s indexing is in-bounds (buffer sized
  `MAX_RATIONALE_BYTES + 3`; the copy loop only runs in the `b.length >
  MAX_RATIONALE_BYTES` branch). `abi.encodePacked(n.agentPromptHint, …, n.agentEvidenceUrl, …)`
  is a memory concat, not arithmetic. `abi.decode(result,(string))` reverts cleanly on
  malformed bytes (routes to the refund/timeout path).
- **Unbounded loops.** Only `_truncateRationale`, bounded by the constant
  `MAX_RATIONALE_BYTES = 4096`. The two new fields are strings concatenated once in
  `_fireAgent`, never iterated in a Solidity loop. No iteration over caller-controlled
  array lengths anywhere (the old dynamic `uint16[]/bytes32[]` decode is gone).
- **Missing event emits.** Every transition still emits; `createContract` emits
  `ContractCreated` (the two new strings are stored, not separately logged — consistent
  with the existing struct fields that are also unlogged and read back via
  `getNegotiation`). `commitRationale` emits `RulingRationale`. The removed
  `PolicyFlagged` was dead (no emit site); its removal announces nothing less.
- **Storage-layout breaks.** `CoverageNegotiation` is non-upgradeable and directly
  deployed (`deploy.ts` → `getContractFactory().deploy()`; no proxy / delegatecall /
  initializer / EIP-1967 wrapping). Inserting `lastRequestId` + two `string` fields
  mid-struct and removing the contract-level `agentEvidenceUrl` string slot is **not** a
  layout hazard: each deploy is fresh storage. The off-chain readers were updated in
  lockstep — `abi.ts` `getNegotiation` tuple order, `real.ts` `RawNegotiation` 34-field
  indices ([18] lastDecision, [19] lastRequestId, [20] hasRuling, [21] agentEvidenceUrl,
  [22] agentPromptHint, [23] round …), and `mapNegotiation` all match the Solidity
  field order exactly. Typecheck (0) + the T9-real/T10-real position tests confirm.
- **Gas anti-patterns.** No storage-read-in-loop. `MAX_RATIONALE_BYTES` is a `constant`.
  `_fireAgent` reads each new field from storage once into the payload. View functions
  returning the now-larger struct (two extra strings) are `external view`, never on a
  state-changing path.
- **OZ-pattern adherence.** Inheritance and `Ownable(msg.sender)` unchanged.
  `nonReentrant` placement unchanged. ETH transfers remain checked low-level `.call`.
  The new guards use the standard short namespaced `require` strings consistent with the
  surrounding `createContract` validations.

## Prior notes — now closed

- The `2026-06-03 @ a64f80d` section flagged the dead **`event PolicyFlagged`**
  declaration as a hygiene NIT. **CLOSED** — the declaration is removed from the
  contract (asserted by the `PolicyFlagged-removed` test).
- That section's OBSERVATION (three stale OLD-shape consumers: `src/contract/real.ts`
  event list/`Ruled` decoder, plus the two `.mjs` demo/local-node harnesses). **CLOSED
  for `real.ts`** — its `EVENT_NAMES` now lists `RulingRationale` (not `PolicyFlagged`)
  and the `Ruled` decoder reads the 4-arg shape (asserted by `stale-real-ts-*` tests).
  The two `.mjs` demo/integration harnesses are outside the `contracts/` gate and out
  of scope for this unit; they remain an operator follow-up, not a compliance finding.
- The `agentId` constructor anonymisation and the retained zero-valued
  `priceBasisOf`/`costPlusUnitPrice`/`nadacUnitPrice` API-compat surface are intentional
  and documented (see the notes in the section below) — non-findings.

**Conclusion: ZERO findings across all eight stickler dimensions for the full
`contracts/` diff, including the SPEC-0006 R14/R15/R17 per-negotiation unit.**

---

# SPEC-0006 (R9/R11/R12/R24–R26) — inferString migration + self-hosted teardown

**Date:** 2026-06-03
**Branch:** `spec-6-implementation` (working tree vs `origin/main`)
**Scope:** the full `contracts/` diff plus the in-`contracts/` scripts and the
cross-repo ABI/script cascade that the contract change forces:

- `contracts/contracts/CoverageNegotiation.sol` — `IParseWebsiteAgent.ExtractANumber`
  payload replaced with `ILLMInferenceAgent.inferString(string,string,bool,string[])`
  (R11); `handleResponse` rewritten to decode a single ABI `string` token and emit
  `RulingRationale` (R24–R26); entire self-hosted surface deleted (`selfHosted`,
  `setPlatformSelfHosted`, `_fireAgentSelfHosted`, `_selfHostedNonce`,
  `IParseWebsiteAgent`) (R9); `Ruled` event slimmed 10→4 args; new
  `commitRationale` + `_tokenToDecision` + `_truncateRationale` internals; two new
  `constant`s.
- `contracts/contracts/mocks/MockAgentPlatform.sol` — `triggerRuling` now takes a
  single `string calldata decisionToken`; old `Ruling` struct deleted.
- `contracts/contracts/mocks/RevertingReceiver.sol` — doc-only (orchestrator branch
  references removed).
- scripts: `scripts/orchestrator-real.ts` deleted; `@anthropic-ai/sdk` dependency
  removed (R9); `scripts/check-ruling-abi.ts` repinned to the `inferString` selector
  `0xfe7ca098` (R12); `scripts/lib/ruling-abi.ts`, `scripts/verify-deploy.ts`,
  `scripts/identify-inference-agent.ts`, `contracts/scripts/probe-agent-abi.ts`,
  `package.json` updated.

## Verdict (re-review @ a64f80d, 2026-06-03): PASS — Solidity source clean; in-`contracts/` + canonical-ABI cascade complete

Re-reviewed the full working-tree `contracts/` diff vs `origin/main` at HEAD
`a64f80d`. The **Solidity contract source is compliant** (zero in-source findings;
see the per-category checklist below). The two cascade findings from the prior
(FAIL) pass are now **CLOSED**:

- **FINDING 1 CLOSED** — `contracts/scripts/trigger-ruling.ts:37` now calls
  `(mock as any).triggerRuling(lastCallback, lastRequestId, "approve")` with the
  single token string; the old 7-field `ruling` object is gone. Matches the new
  `MockAgentPlatform.triggerRuling(address, uint256, string calldata)` signature.
- **FINDING 2 CLOSED** — `src/contract/abi.ts:44-45` now declares the 4-arg
  `Ruled(uint256 indexed reqId, uint256 indexed requestId, uint8 decision,
  uint256 coveredAmount)` and adds
  `RulingRationale(uint256 indexed reqId, uint256 indexed requestId,
  uint8 indexed decision, string rationale, string clauseReference,
  string standardReference)`. The dead `PolicyFlagged` declaration is removed.
  This is the canonical ABI the test-suite consumes.

Validation (this pass): clean `npx hardhat clean && compile` →
"Compiled 8 Solidity files successfully (evm target: paris)"; `npx hardhat test` →
**76 passing, 0 failing** (includes the SPEC-0006 R9/R11/R12/R24–R26 suites and the
negative-assertion tests that the self-hosted setter/flag/script are gone);
`tsx scripts/check-ruling-abi.ts` → PASS (computed
`inferString(string,string,bool,string[]) → 0xfe7ca098`); root `npm run typecheck`
→ exit 0 (no dangling import of the deleted `scripts/lib/ruling-abi.ts` or
`@anthropic-ai/sdk`).

### OBSERVATION (NOT a `contracts/`-diff finding) — stale OLD-shape consumers remain in untouched demo/integration scripts

Outside this diff and outside `contracts/`, three pre-existing TypeScript/Node files
were **not** updated and still target the OLD 10-tuple `Ruled` / `PolicyFlagged`
surface. They are recorded here for the operator (not counted against the Solidity
gate — none is in the `contracts/` diff, and none is the canonical `abi.ts`):

- `src/contract/real.ts:409,562-568` — its event-name list still includes
  `"PolicyFlagged"` and its `Ruled` decoder reads args `a[4]`–`a[9]`
  (`rationaleHash, clauseRef, receiptId, policyVoidedClauseIndices,
  usedReferenceIndices, usedLeafHashes`) that no longer exist on the 4-arg event.
- `scripts/orchestrator-demo.mjs` (`npm run demo:orchestrator`) and
  `scripts/real-backend-localnode.mjs` (`npm run test:real-local`, which imports
  `src/contract/real.ts`) — both still build the old `{ costPlusUnitPrice,
  nadacUnitPrice, receiptId, … }` ruling struct passed to `triggerRuling`, which
  would fail to ABI-encode against the new single-`string` signature.

These are integration/demo harnesses, not the deployed contract or its canonical
ABI; they do not affect the on-chain compliance verdict. They DO mean the
single-string cascade is not yet coherent end-to-end across the whole repo — flagged
in this review's structured output under the unit gate, and worth a follow-up so a
live `demo:orchestrator` / `test:real-local` run doesn't throw at the `triggerRuling`
call site.

## Contract-source scrutiny — per category (all PASS)

**Reentrancy.** `handleResponse` makes no external calls; it decodes in memory,
writes state, and emits logs. It stays gated to `msg.sender == address(platform)`
and `n.state == State.UnderReview`, with `_clearRequest(n)` run before the decode —
identical posture to the prior audited ticks. The three agent-firing entry points
(`requestAdjudication`, `submitEvidence`, `appeal`) and `withdrawFunds` retain
`nonReentrant`; `_fireAgent`'s single external call (`platform.createRequest`) is
preceded by all effects (`totalFees`, `rulingDeadline`, `state = UnderReview`,
`PacketSubmitted`) and the overpayment refund is the last action under the caller's
guard. `commitRationale` makes no external call. CEI intact everywhere.

**Access control.** `commitRationale` is `onlyOwner` (keeper role = owner in v0).
`handleResponse` retains the platform-only gate. Deleted setter
`setPlatformSelfHosted` is gone (and a negative-assertion test confirms it). All
admin setters remain `onlyOwner`. The constructor now hard-writes
`agentId = LLM_INFERENCE_AGENT_ID` and ignores `agentId_` — intentional and
documented; `setAgentId` (onlyOwner) can still override for tests. No new
unauthenticated entry point.

**Over/underflow beyond 0.8.x.** No new arithmetic introduced on the live path.
`_truncateRationale` indexes `b[i]` only for `i < MAX_RATIONALE_BYTES` after checking
`b.length > MAX_RATIONALE_BYTES`, so every index is in-bounds; the `result` buffer is
sized `MAX_RATIONALE_BYTES + 3` and the three trailing writes land exactly in range.
`abi.decode(..., (string))` reverts cleanly on malformed bytes (routes to the
platform refund path, no state corruption). `_benchmarkCap` keeps its
overflow-saturating guard (now always returns 0 in string-token mode). No `unchecked`
on any user-influenced counter.

**Unbounded loops.** The only loop is in `_truncateRationale`, bounded by the
`MAX_RATIONALE_BYTES = 4096` constant — not user-length-driven. The R26 test commits a
>4096-char rationale and asserts completion without OOG. No unbounded iteration over
negotiations, arrays, or mappings anywhere in the diff.

**Missing event emits.** Every terminal/transition branch emits: `Approve` →
`Ruled` + `RulingRationale`; `Deny` → `Ruled` + `RulingRationale`; `PolicyInvalid`
→ `Ruled` + `PolicyInvalidated` + `RulingRationale`; `NeedMoreEvidence` →
`EvidenceRequested` (correctly no `Ruled`); non-success/empty → `RulingTimedOut` +
`EvidenceRequested`. `commitRationale` emits `RulingRationale`. NIT (not a finding):
`event PolicyFlagged` is now declared but no longer emitted anywhere — dead event
declaration left after the R6b path was simplified; harmless, but worth deleting for
hygiene.

**Storage-layout break.** Removing `selfHosted` (it was packed into slot 0 alongside
the 20-byte `platform` address) shifts no other slot. Removing `_selfHostedNonce`
(the last-appended slot, with nothing below it) shifts no other slot. The two added
`constant`s consume no storage. The surviving named slots keep their indices
(`platform`/0, `agentId`/1, `agentReward`/2, `rulingTimeout`/3, `maxRounds`/4,
`agentEvidenceUrl`/5, `currentlyFiringReqId`/6, `_nextId`/7, `_negotiations`/8,
`_requestToNegotiation`/9). The contract is not proxied / not upgradeable
(no proxy, initializer, or delegatecall machinery in `contracts/contracts/`), and the
deploy path is a fresh `getContractFactory().deploy(...)`, so layout shift is moot in
practice as well.

**Gas anti-patterns.** No storage-read-in-loop, no repeated external calls, no
redundant SLOADs introduced. `_tokenToDecision` recomputes four `keccak256` of small
string literals per call — constant-bounded and only on the platform callback path;
acceptable. The constructor self-assignment `agentId_ = agentId_;` to silence the
unused-param warning is a stylistic NIT (an anonymous param would be cleaner) but
compiles clean and has no runtime cost. `_truncateRationale` byte-copy is the
expected cost for the bounded truncation.

**OZ-pattern adherence.** Inheritance unchanged (`Ownable, ReentrancyGuard,
IAgentRequesterHandler`); `Ownable(msg.sender)` constructor arg intact;
`nonReentrant` placement unchanged; no OZ pattern bypassed or weakened.

## Validation run

- `npx hardhat clean && npx hardhat compile` → "Compiled 8 Solidity files
  successfully (evm target: paris)".
- `npx hardhat test` → **76 passing, 0 failing** (includes the SPEC-0006
  R11/R12/R24–R26/R9 suites: inferString selector + agentId, single-string decode for
  all four tokens, garbage-token fallback, commitRationale truncation, and the
  negative assertions that the self-hosted setter/flag/`ruling-abi.ts` are gone).
- `tsx scripts/check-ruling-abi.ts` → PASS (computed selector
  `inferString(string,string,bool,string[]) → 0xfe7ca098`; source + self-check
  literals present). Selector independently recomputed:
  `keccak256("inferString(string,string,bool,string[])")[0:4] = 0xfe7ca098` ✓.
- root `npm run typecheck` → exit 0.

The contract diff is Solidity-clean and the in-`contracts/` + canonical-ABI cascade
is complete (prior FINDING 1 / FINDING 2 both CLOSED). The only residue is the
OBSERVATION above: three untouched demo/integration scripts outside `contracts/`
still target the old `Ruled`/`PolicyFlagged` shape.

---

## Tick 119 (iter-2 re-review) — R25 Tick B fixes

**Date:** 2026-05-30
**Scope:** Verify the iter-1 (tick 118) findings are CLOSED on commit `9db79d7`.

**Verdict:** PASS (zero findings — all prior findings CLOSED)

### MEDIUM status: CLOSED

`_selfHostedNonce` is now declared at line 217 of `CoverageNegotiation.sol`, AFTER
`_requestToNegotiation` (line 208), at the END of the storage block. `_nextId` (203),
`_negotiations` (205), and `_requestToNegotiation` (208) all retain their pre-Tick-B
slot indices — appending the new slot does not shift any existing slot. Storage-layout
compat for upgrade-in-place is preserved. The docstring at lines 210-216 explicitly
documents the placement rationale.

### LOW status: CLOSED

`orchestrator handleResponse round-trip: Approve ruling drives state → Approved`
(test file lines 1186-1253) does exactly what the iter-1 LOW asked for: fires the
self-hosted path, captures the synthetic `pendingRequestId`, the orchestrator EOA
ABI-encodes the full 10-tuple ruling (`Decision.Approve, costPlus, NADAC, hashes,
receipt, empty arrays`), wraps it in the Response struct + an empty Request, calls
`handleResponse(requestId, [response], Success, request)`, asserts the `Ruled` event
fires AND `stateOf(reqId) == State.Approved`. Round-trip is end-to-end.

### NIT status: CLOSED

Docstring at `CoverageNegotiation.sol:189-200` carries the Amendment 0006 exception
block at lines 195-199: `"NOT set in the self-hosted path (`_fireAgentSelfHosted`)
because there's no external `platform.createRequest` call for an observer to
interleave with. Self-hosted observers should read the `RulingRequested` event
instead..."`. Clear, explicit, points readers at the observable.

### New findings: none

Additional stickler checks all pass:
- **CEI in `_fireAgentSelfHosted`** (lines 883-925): all state writes
  (`n.totalFees` 891, `n.rulingDeadline` 896, `n.state` 897, `_selfHostedNonce` 904,
  `n.pendingRequestId` 908, `_requestToNegotiation[requestId]` 909) commit before
  EITHER external `.call{value}` (lines 918, 922). Events at 911-912 fire before
  the calls, matching the platform-path ordering.
- **Reentrancy**: `requestAdjudication` (420), `submitEvidence` (437), `appeal` (481)
  — all three `_fireAgent` callers carry `nonReentrant`. Refund + orchestrator-fee
  transfers in the self-hosted path are guarded.
- **Nonce-then-keccak ordering**: line 904 `_selfHostedNonce += 1;` strictly precedes
  the keccak at 905-907 — same-block fires get distinct nonces, distinct requestIds.
- **`_fireAgent` branch** (lines 804-807): `if (selfHosted) { _fireAgentSelfHosted(...);
  return; }` — clean early-return, no fallthrough into platform-path code.
- **Test coverage**: all 5 new tests present and meaningful (selfHosted fire,
  uniqueness, underfunded revert, overpayment refund, handleResponse round-trip).
  Commit body reports 39/39 hardhat passing.

---

# Solidity compliance — tick 118

**Date:** 2026-05-30
**Scope:** Amendment 0006 Tick B (part 2) — `_fireAgent` self-hosted branch on
`CoverageNegotiation.sol` + 4 new `_fireAgentSelfHosted` tests in
`contracts/test/CoverageNegotiation.test.ts`. Diff also includes tick-117's
committed `selfHosted` storage + `setPlatformSelfHosted` setter.

## Tick 118 — R25 Tick B (self-hosted _fireAgent branch)

**Verdict:** FAIL (3 findings: 1 MEDIUM, 1 LOW, 1 NIT)

### MEDIUM

- **Storage layout: `currentlyFiringReqId` and `_selfHostedNonce` were INSERTED,
  not appended.** The pre-change layout order was
  `platform, agentId, agentReward, rulingTimeout, maxRounds, agentEvidenceUrl,
  _nextId, _negotiations, _requestToNegotiation`. Post-change:
  `platform+selfHosted (packed), agentId, agentReward, rulingTimeout, maxRounds,
  agentEvidenceUrl, currentlyFiringReqId (NEW, slot 6), _nextId (SHIFTED to 7),
  _selfHostedNonce (NEW, slot 8), _negotiations (SHIFTED to 9),
  _requestToNegotiation (SHIFTED to 10)`. `_nextId`, `_negotiations`, and
  `_requestToNegotiation` all move slots. The reviewer brief stated "New slots
  appended, not inserted" — that is incorrect for this diff. For a fresh deploy
  (the demo path) this is harmless. For any upgrade-in-place / proxy scenario it
  would corrupt the request-id counter and the negotiation mapping root. Confirm
  the deployment posture explicitly rules out an existing-state upgrade, or move
  `currentlyFiringReqId` + `_selfHostedNonce` to the end of the storage block
  (after `_requestToNegotiation`). File:
  `contracts/contracts/CoverageNegotiation.sol:189-209`.

  (The `bool selfHosted` packing into the `platform` slot IS safe — `IAgentRequester`
  is an address = 20 bytes, leaves 12 bytes spare, bool occupies 1. No upgrade
  impact on slot 0.)

### LOW

- **Test coverage gap: no handleResponse round-trip through the self-hosted
  path.** The 4 added tests prove `_fireAgentSelfHosted` reaches UnderReview,
  generates unique requestIds, reverts on underfunding, and refunds overpayment.
  None of them invoke `handleResponse` from the orchestrator EOA against the
  synthetic requestId, so the end-to-end loop (self-hosted fire → orchestrator
  ruling → state transition to Approved/Denied/etc.) is unproven. The
  `_requestToNegotiation[requestId] = reqId` mapping write is the load-bearing
  step that must round-trip — currently asserted only as "non-zero", not as
  "delivers a ruling when keyed back". Add at least one test where the
  orchestrator signer calls `handleResponse(requestId, responses)` with an
  Approve/Deny tuple and asserts the final state. File:
  `contracts/test/CoverageNegotiation.test.ts:1086-1188` (the new self-hosted
  describe block).

### NIT

- **`currentlyFiringReqId` is not set/cleared on the self-hosted path** while the
  platform path sets it before and clears it after `platform.createRequest`
  (`CoverageNegotiation.sol:202-209` in `_fireAgent`). Self-hosted skips this
  entirely. The accessor doc string ("Zero outside an active fire") still holds
  trivially (it's always zero in self-hosted mode), but anything off-chain that
  uses this as a probe (per the existing comment: "off-chain probe / future
  indexer") will see no signal during a self-hosted fire. Either mirror the
  set/clear inside `_fireAgentSelfHosted` for behavioral parity, or update the
  accessor doc string to call out the self-hosted exception.

### Passed checks

- CEI ordering in `_fireAgentSelfHosted`: all state writes (`n.totalFees`,
  `n.rulingDeadline`, `n.state`, `_selfHostedNonce`, `n.pendingRequestId`,
  `_requestToNegotiation[requestId]`) complete before the two external
  `.call{value}` interactions (CoverageNegotiation.sol:879-916). Clean.
- Reentrancy: all callers (`requestAdjudication`, `submitEvidence`, `appeal`)
  carry `nonReentrant`; `_fireAgentSelfHosted` is `internal` and unreachable
  bypassing the guard.
- Access control: `setPlatformSelfHosted` is `onlyOwner` (covered by test at
  test:1063-1069 via `OwnableUnauthorizedAccount`). `_fireAgentSelfHosted` is
  `internal`.
- Synthetic requestId uniqueness: `_selfHostedNonce += 1` runs BEFORE the
  keccak (line 896 then 897-899); `uint256` nonce can't realistically wrap;
  `address(this)` prevents cross-contract collision; same-block uniqueness
  verified by test (test:1106-1126).
- Fee semantics: `fee = agentReward`, underfunded reverts, 0 allowed,
  overpayment refunds, success of orchestrator transfer bubbled via
  `require(feeOk, ...)`.
- Event consistency: `PacketSubmitted` + `RulingRequested` emitted with the
  same arg shapes and ordering as the platform path; downstream
  `handleResponse` and `_requestToNegotiation` are shape-compatible.
- OpenZeppelin pattern compliance: inheritance unchanged
  (`Ownable, ReentrancyGuard, IAgentRequesterHandler`); no storage collision
  introduced against base classes.
- `selfHosted` storage packs into the same slot as `platform` (slot 0) — no
  new slot for the bool, consistent with the inline doc.

---

# Solidity compliance — tick 14

**Date:** 2026-05-29
**Scope:** no `contracts/` diff this tick — audit deferred to next contract-touching tick
**Verdict:** PASS (no contracts/ diff → no new findings)

## This tick's diff scope

Verified via `git diff --name-only HEAD~1..HEAD -- contracts/` (empty result). This
tick edits web-only files:

- `web/src/views/Overview.tsx`
- `web/src/styles.css`

No changes to `contracts/contracts/CoverageNegotiation.sol`,
`contracts/contracts/mocks/MockAgentPlatform.sol`, or
`contracts/test/CoverageNegotiation.test.ts`.

Because no Solidity source or contract-level test was touched this tick, no new
audit pass is warranted. The next contract-touching tick should re-trigger a
full focused review.

## Tick 13 — preserved for reference

Tick 13 also had no `contracts/` diff (working-tree change was 1 new TS file,
`web/src/hooks/useNegotiation.ts`). PASS — no new findings.

## Tick 12 — preserved for reference

Tick 12 diff scope (committed 180573f, UNIT-4-narrow):

- 3 new TS files: `src/protocol/revertReasonMap.ts`,
  `src/protocol/revertReasonMap.test.ts`, `web/src/hooks/useAction.ts`
- 1 edit: `web/src/shared.ts` (added missing `PacketSubmitted` case)

No `contracts/` changes — PASS.

## Carry-forward — prior open findings

From tick 4 (UNIT-2):

- **None.** Tick 4 closed with 0 findings (PASS). All seven focused checks
  (R14a appeal precondition, R2b createContract placement, PacketSubmitted CEI
  placement, no new externals/storage/modifiers, event-signature width
  `uint256 round` vs spec `uint8`, cross-callsite ripple in `_fireAgent`, test
  coverage delta) passed cleanly. The `uint256 indexed round` vs spec's
  `uint8 indexed round` width gap was explicitly noted as forward-compatible
  and accepted, not an open finding.

Ticks 8 (UNIT-3a), 9 (UNIT-3b), 10 (UNIT-3c), 11, 12, 13, and 14 (this tick)
also touched no `contracts/` files and added no new findings.

No unresolved compliance items carry into tick 14. One spec-side carry-forward
flag (R6b `policyVoidedClauseIndices`) remains noted for the next
contract-touching tick — see tick 11 entry in git history for full context:
the R6b prose update in `docs/specs/0001-mvp0-coverage-negotiation.md` mentions
a future `policyVoidedClauseIndices` field on the `Ruled` event. This is a
spec change, not yet a contract change — the on-chain `Ruled` event signature
in `CoverageNegotiation.sol` is unchanged. When implemented, the
event-signature audit checks (ABI width, indexed-vs-non-indexed positioning,
gas cost of additional dynamic-array parameter, and event-emission CEI
placement) will need to run fresh against the new field.

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

## Tick 49 solidity-compliance

**Date:** 2026-05-29
**Scope:** SPEC-0004 R23 — propagate `policyVoidedClauseIndices: uint16[]` from
the arbiter response through `handleResponse` decode and onto the `Ruled` event
as the 8th element. Closes the carry-forward flag noted in tick 14.
**Files reviewed (working-tree diff vs `1862b9c`):**

- `contracts/contracts/CoverageNegotiation.sol` (Ruled event +1 arg; abi.decode 7→8; three emit Ruled callsites updated; ~8 lines)
- `contracts/contracts/mocks/MockAgentPlatform.sol` (Ruling struct +1 field; abi.encode 7→8; ~3 lines)
- `contracts/hardhat.config.ts` (`viaIR: true` added)

### Hard-scrutiny checklist

1. **Reentrancy on the new emit/decode (CLOSED).** No new external calls, no new
   `.call`/`.transfer`/`.send`, no new ETH movement. `abi.decode` is a pure
   memory operation (no callbacks); `emit Ruled` is a log write (no callbacks).
   The pre-existing `handleResponse` guard (`require(msg.sender ==
   address(platform))` at line 575) is unchanged. `handleResponse` is NOT
   `nonReentrant`-modified (it is gated by the platform-only check), so the
   reentrancy posture is identical to pre-change: only the trusted platform
   address can re-enter, and it would be re-entering its own callback into a
   state already cleared via `_clearRequest` + state transition. The new emit
   sits AFTER state writes on the PolicyInvalid / Approve / Deny branches —
   CEI preserved. **No new reentrancy surface.**

2. **Access control (CLOSED).** No new entry points. The platform-only gate
   `require(msg.sender == address(platform), "callback: not platform")` at
   line 575 remains the sole authorisation check on `handleResponse`. No
   changes to `Ownable` admin setters, no new `external`/`public` functions.
   `MockAgentPlatform.triggerRuling` is dev-only and unchanged in posture.

3. **Integer overflow on `uint16[]` (CLOSED).** Solidity 0.8.24 with default
   checked arithmetic. `abi.decode((uint16[]))` deserialises each 32-byte word
   into a `uint16` and **reverts on overflow** if any encoded element exceeds
   `2**16 - 1 = 65535` — this is documented Solidity behaviour for fixed-width
   integer decoding (no silent truncation). A malicious arbiter passing a
   `uint256` value > 65535 in the array slot will cause `handleResponse` to
   revert cleanly at the decode step, which routes through the platform's
   transaction failure rather than corrupting state. Acceptable.

4. **Unbounded loops / gas-bomb (CLOSED).** Grepped both touched files for
   loops over `policyVoidedClauseIndices` — zero. The variable is decoded into
   memory once and then passed by reference into `emit Ruled` on each of the
   three terminal branches. No `for`/`while`. The only gas cost is the event
   log size (8 bytes per element, plus the dynamic-array header), which is
   bounded by the encoded payload size that the platform itself caps. No
   storage write of the array (the `Negotiation` struct does NOT carry the
   field — see point 7). **No loop-based gas-bomb risk.**

5. **Event emit at all three callsites (CLOSED).** Verified by line-by-line
   grep of `emit Ruled` in `CoverageNegotiation.sol`:
   - Line 643: PolicyInvalid branch — passes `policyVoidedClauseIndices`
   - Line 657: Approve branch — passes `policyVoidedClauseIndices`
   - Line 662: Deny branch — passes `policyVoidedClauseIndices`
   The fourth potential callsite (NeedMoreEvidence at line 620) intentionally
   returns BEFORE any `emit Ruled` — that branch routes to
   `EvidenceRequested` instead of ruling, so omitting the emit is correct.
   No callsite was missed.

6. **Storage-layout invariant (CLOSED).** The `Negotiation` struct
   (lines 100–148) is BYTE-FOR-BYTE unchanged. `policyVoidedClauseIndices` is
   a callback-local memory variable; it never reaches storage. The new field
   on `MockAgentPlatform.Ruling` (line 89) is a calldata struct on a dev-only
   contract and has no production storage implication. No existing slot
   re-ordered, no new slot added. Storage layout is safe for in-place upgrade
   if proxied (this contract isn't proxied today, but the property holds).

7. **viaIR trade-off (CLOSED with operator-noted caveat).** `viaIR: true` was
   enabled in `contracts/hardhat.config.ts` to resolve a stack-too-deep error
   the 8-element decode would otherwise trigger (the local-variable stack now
   exceeds the 16-slot EVM stack window inside `handleResponse`). Trade
   analysis:
   - **Bytecode change:** Yes — viaIR routes through Yul and produces
     different bytecode for the same source. This means the on-chain hash of
     the deployed bytecode will not match a non-viaIR rebuild of the same
     source. **Operator implication:** any re-deploy MUST also use
     `viaIR: true`; verifying the contract on Blockscout requires the same
     compiler settings in the verification payload (matches existing
     `optimizer.enabled: true, runs: 200`).
   - **Production safety:** viaIR is the recommended path for any contract
     hitting stack-too-deep; the IR pipeline is stable in solc 0.8.24 and has
     been the default for libraries like OpenZeppelin's larger contracts since
     0.8.18. No known correctness regressions at 0.8.24.
   - **Gas:** viaIR with optimiser typically produces equal-or-slightly-cheaper
     runtime bytecode. No regression expected.
   - **Verdict:** acceptable trade. The alternative (factoring `handleResponse`
     into a smaller helper to free stack slots) would have worked but adds
     surface area; enabling viaIR is the smaller, well-understood change.

8. **OZ-pattern adherence (CLOSED).** `Ownable` admin posture and
   `ReentrancyGuard` modifier usage are untouched. The `nonReentrant` modifier
   on the agent-firing entry points (`requestAdjudication`, `submitEvidence`,
   `appeal`, `withdrawFunds`) and the CEI ordering in `_fireAgent` are all
   unchanged. No OZ pattern was bypassed or weakened.

### OPEN — deployment-coordination items (NOT in-contract findings)

These are NOT solidity findings — the contract source itself is compliant —
but they affect the live deployment and warrant operator action before this
tick goes to testnet.

- **OPEN (medium, OPERATOR):** The currently-deployed contract at
  `0x1dC5bA6771A7f4426ABE5BB808a7d51BdEA33E1A` (Somnia testnet, recorded in
  `docs/progress/browser-verify.md:206` and `docs/loop-prompts/spec-4-implementation-loop.md:178`)
  carries the OLD 7-element `Ruled` event ABI. The new on-chain `Ruled`
  signature is 8 args. **Until the contract is re-deployed**, off-chain
  consumers subscribing to the new ABI will see no events fire on testnet,
  and consumers using the old ABI will continue to receive 7-element decodes
  even after redeploy if they cache the old ABI. Required coordination:
  (a) re-deploy `CoverageNegotiation` with the tick-49 source +
  `viaIR: true`; (b) update `COVERAGE_CONTRACT_ADDRESS` /
  `VITE_CONTRACT_ADDRESS` env vars; (c) ensure `web/src/contract/abi.ts` ships
  the 8-arg `Ruled` ABI (in scope of this tick's web diff, not contracts).
  Re-running `browser-verify` against the new address is the gate.

- **OPEN (medium, OPERATOR):** The in-contract decode now expects 8 elements;
  the live Somnia agent platform must encode the 8th (`uint16[]
  policyVoidedClauseIndices`) in `responses[0].result` or `handleResponse`
  will revert at `abi.decode`. The mock has been updated, but the real
  Somnia-side agent template (off-chain LLM payload generator) needs the
  matching encode update before any live testnet ruling will land. If the
  Somnia agent returns the legacy 7-tuple, every ruling will revert into the
  retriable timeout path (the revert won't cause platform-side fund loss
  because the platform refunds on handler revert, but no ruling will be
  observable). **Coordination:** confirm the off-chain agent payload builder
  has been bumped to encode the 8-tuple in lockstep with the contract
  redeploy. This is a deployment-sequence concern, not a source defect.

### Verdict: PASS (zero in-source findings)

All eight scrutiny points close cleanly in the source: no reentrancy regression,
no new access-control surface, decode reverts cleanly on `uint16` overflow,
no loops introduced, all three terminal `emit Ruled` callsites updated,
`Negotiation` storage layout unchanged, `viaIR` trade justified, OZ patterns
intact. The two OPEN items are deployment-coordination flags for the operator
(re-deploy address + Somnia agent encode parity) — neither indicates a defect
in the tick-49 Solidity source.

---

## Tick 50 solidity-compliance

**Scope:** SPEC-0004 §3.5 R11 ruling-citation replay anchors. `Ruled` event
extended from 8 → 10 args by appending `uint16[] usedReferenceIndices` and
`bytes32[] usedLeafHashes`. `abi.decode` tuple in `handleResponse` grew 8 → 10.
All three terminal emit callsites updated. `MockAgentPlatform.Ruling` struct +
`abi.encode` mirrors the additions. Test helper `ruling()` extended with two
new defaulted params; 5 existing `.withArgs` got `[], []` appended; new R11
test pins `usedReferenceIndices=[0] + usedLeafHashes=[0x11…]` end-to-end.
viaIR remains on from tick 49. Emit-only change — no Negotiation struct field,
no new state, no new entry points.

### Diff scope (verified from `git diff 9873887`)

- `CoverageNegotiation.sol`: event sig (+2 lines), decode comment (+1 line),
  3 new local memory vars in the destructure, abi.decode type tuple +2 type
  entries, 3 emit-callsite updates (Approve / Deny / PolicyInvalid). No
  function body re-ordered, no new function added, no modifier touched.
- `MockAgentPlatform.sol`: Ruling struct +2 fields, abi.encode +2 args. Dev/
  test scaffold; not deployed to production.
- `CoverageNegotiation.test.ts`: helper signature +2 params (defaulted to `[]`,
  preserving call-site backward compatibility), 5 `.withArgs` updates, 1 new
  R11 test.

### Hard-scrutiny points

1. **Reentrancy (CLOSED).** Zero new external calls. The diff is a strict
   superset of the previous decode-and-emit shape: two more memory variables
   destructured, two more type tokens in the abi.decode tuple, two more
   argument slots in three `emit Ruled` callsites. `emit` is a log opcode
   (`LOG0..LOG4`), not a call. No `.call`, `.transfer`, `.send`, no new
   interface invocation. CEI ordering inside `handleResponse` is preserved:
   state transitions (`n.state = State.{Approved,Denied,PolicyInvalidated}`
   and `n.coveredAmount = …`) all complete **before** the trailing `emit Ruled`
   on every branch. The PolicyInvalid branch still does `emit PolicyFlagged`
   → state write → `emit Ruled` → `emit PolicyInvalidated` → `return`, with
   the storage writes between the two policy-flag/invalidated event pair, so
   no observer can see a half-committed state. No CEI regression.

2. **Access control (CLOSED).** `handleResponse`'s platform gate (line 577,
   `require(msg.sender == address(platform), "callback: not platform");`) is
   byte-for-byte unchanged. The `require(n.state == State.UnderReview, …)`
   round-state gate (line 583) is unchanged. No new public/external function
   was added. No modifier was widened. The `Ownable` admin posture and the
   `nonReentrant` modifiers on the four party entry points
   (`requestAdjudication`, `submitEvidence`, `appeal`, `withdrawFunds`) are
   untouched. Zero new entry surface.

3. **Integer over/underflow (CLOSED).** Two new dynamic arrays:
   `uint16[] usedReferenceIndices` and `bytes32[] usedLeafHashes`. `uint16`
   carries the same overflow posture as the tick-49 `policyVoidedClauseIndices`
   — `abi.decode` reverts cleanly if any element exceeds 65535 (solc 0.8.24
   enforces this at decode time, no manual check needed). `bytes32` has no
   numeric over/underflow surface (fixed-width opaque value). Array length is
   bounded by the EVM calldata size limit and by gas (the platform-side
   payload is fee-gated by the platform contract). No new arithmetic was
   introduced — the new arrays are pass-through values from decode to log.

4. **Unbounded loops (CLOSED).** No `for` / `while` was added. The new arrays
   are never iterated in-contract; they are decoded, held in memory, and
   passed verbatim to the log opcode. Indexing happens only off-chain
   (consumers reading the event topic stream). The decode itself is a single
   `abi.decode` call which is O(payload-size) — same complexity class as
   tick 49 — not a Solidity loop. Zero new loop surface.

5. **Missing event emits (CLOSED).** The diff verifies all THREE terminal
   `emit Ruled` callsites carry the 10-arg shape:
   - PolicyInvalid branch — line 649 — `…policyVoidedClauseIndices, usedReferenceIndices, usedLeafHashes);`
   - Approve branch — line 663 — `…policyVoidedClauseIndices, usedReferenceIndices, usedLeafHashes);`
   - Deny branch — line 668 — `…policyVoidedClauseIndices, usedReferenceIndices, usedLeafHashes);`

   The `NeedMoreEvidence` branch (line 626–630) emits `EvidenceRequested`
   instead of `Ruled` — correctly omitted, same posture as tick 49.
   No callsite was missed.

6. **Storage-layout invariant (CLOSED).** The `Negotiation` struct
   (lines 100–148) is BYTE-FOR-BYTE unchanged across tick 50 — verified by
   the diff containing no edits in that range. The two new arrays
   (`usedReferenceIndices`, `usedLeafHashes`) are callback-local `memory`
   variables; they never reach storage. The new fields on
   `MockAgentPlatform.Ruling` are calldata struct fields on a dev-only
   contract with no production storage implication. No existing slot
   re-ordered, no new slot added. Storage layout safe.

7. **Gas / stack pressure (CLOSED with operator-noted caveat).** The decode
   now has 10 local memory variables (was 8 at tick 49). `viaIR: true`
   remains on from tick 49's `contracts/hardhat.config.ts`, which routes the
   compile through Yul IR codegen and handles arbitrary stack depths in
   `handleResponse`. Verified by clean rebuild: `rm -rf artifacts cache &&
   npx hardhat compile` succeeds (`Compiled 7 Solidity files successfully`)
   with no stack-too-deep warning. Test suite: `npx hardhat test` → **30
   passing** (29 prior + the new R11 test), including the existing 8-arg R23
   test that was preserved as-is via the helper's `[], []` defaults. Gas:
   two extra LOGn-data words per ruling emit (the two array lengths +
   contents); no storage-write growth. Marginal cost; acceptable.

8. **OZ-pattern adherence (CLOSED).** `Ownable` admin posture and
   `ReentrancyGuard` modifier usage are untouched. The `nonReentrant` modifier
   on the agent-firing entry points and CEI ordering in `_fireAgent` are all
   unchanged. No OZ pattern bypassed or weakened.

### OPEN — deployment-coordination items (NOT in-contract findings)

These are NOT solidity findings — the source itself is compliant — but they
extend the tick-49 OPEN items because the redeploy now needs to land the
**10-arg** ABI, not the 8-arg one.

- **OPEN (medium, OPERATOR) — supersedes tick-49 OPEN-1.** The currently-
  deployed contract at `0x1dC5bA6771A7f4426ABE5BB808a7d51BdEA33E1A` (Somnia
  testnet, tick 37) still carries the original 7-arg `Ruled` ABI. Tick 49
  bumped the source to 8 args; tick 50 has now bumped it to 10 args. The
  redeploy that was already required after tick 49 MUST now ship the
  tick-50 source (10-arg `Ruled`), not the tick-49 source (8-arg `Ruled`).
  Required coordination: (a) re-deploy `CoverageNegotiation` with the
  **tick-50 source** + `viaIR: true`; (b) update `COVERAGE_CONTRACT_ADDRESS` /
  `VITE_CONTRACT_ADDRESS` env vars; (c) ensure `web/src/contract/abi.ts`
  ships the 10-arg `Ruled` ABI (web-layer concern, not contracts). The
  `loop-state.md` operator-notes entry currently dated "tick 49" needs an
  addendum or restatement covering the tick-50 extension so the operator
  doesn't redeploy the intermediate 8-arg shape by mistake.

- **OPEN (medium, OPERATOR) — supersedes tick-49 OPEN-2.** The in-contract
  decode now expects 10 elements; the live Somnia agent platform must encode
  the 9th (`uint16[] usedReferenceIndices`) and 10th (`bytes32[]
  usedLeafHashes`) in `responses[0].result` or `handleResponse` will revert
  at `abi.decode`. The mock has been updated, but the real Somnia-side agent
  template needs the matching 10-tuple encode in lockstep with the contract
  redeploy. If the off-chain agent returns the 8-tuple (tick 49 shape) or
  the 7-tuple (legacy shape), every ruling will revert into the retriable
  timeout path (clean revert, no fund loss, no observable ruling).
  Coordination: confirm the off-chain agent payload builder is bumped to the
  10-tuple BEFORE the contract redeploy goes live, or roll both in the same
  release.

### Verdict: PASS (zero in-source findings)

All eight scrutiny points close cleanly in the source: no reentrancy
regression, no new access-control surface, decode reverts cleanly on
`uint16` overflow (carried over from tick 49), no loops introduced, all
three terminal `emit Ruled` callsites updated to 10-arg shape, `Negotiation`
storage layout unchanged, viaIR (already on) absorbs the 10-element decode
with no stack-too-deep, OZ patterns intact. Clean rebuild + 30/30 hardhat
tests green confirm. The two OPEN items are tick-49 OPEN flags re-asserted
at the tick-50 ABI shape — they describe a deployment-coordination concern
the operator already owns, not a defect in the tick-50 source.
