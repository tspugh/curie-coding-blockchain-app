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
