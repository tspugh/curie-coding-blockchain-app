# Security findings — tick 4 (UNIT-2)

**Verdict:** PASS (0 findings)

## Findings

None.

## Notes

Reviewed the uncommitted UNIT-2 diff against
`contracts/contracts/CoverageNegotiation.sol`,
`contracts/test/CoverageNegotiation.test.ts`, `src/contract/simulated.ts`, and
`src/contract/simulated.auth.test.ts`. All six focused security checks pass.

1. **R14a tightening — no DoS surface.** `appeal()` now requires
   `n.state == State.Denied` (line 436). The only writer of `State.Denied` is
   `handleResponse` (line 655), and that function is gated by
   `require(msg.sender == address(platform), "callback: not platform")` at
   line 571. No party-controlled path can flip the state to Denied or away
   from Denied to grief an appellant — the predicate is set exclusively by
   the trusted Somnia agent platform via its consensus-encoded ruling. There
   is no alternate entry point: `_get(reqId)` is a read-only fetch and
   `_onlyParty(n)` runs after the state check, so the state gate is the sole
   entry-state predicate on `appeal()`. The cap-deadlock short-circuit
   (`n.round >= maxRounds`, line 445) still runs AFTER the state check, so an
   Approved state cannot be deadlocked via `appeal()` — the R14a revert fires
   first. No new revert paths consume caller ETH: the revert is a
   pre-state-effects `require`, so `msg.value` rolls back with the tx. The
   T10 wrong-state test was updated to expect the new error string.

2. **R2b rejection — no DoS or bypass surface.**
   `require(providerAddr != insurerAddr, "create: self-contract")` at line 323
   sits after parameter validation (`addr: zero`, `auth: not provider`,
   `qty: zero`) and BEFORE `_nextId++` (line 325) and any struct writes — no
   state effects to roll back, CEI-clean. A frontrunner submitting
   `createContract(provider, provider)` would revert their own tx without
   affecting any other party's create flow (each call atomically creates a
   fresh `reqId`). The check is an address-equality predicate, not a
   shared-key predicate; a party controlling two distinct wallets can still
   create a contract between them, but R2b is explicitly scoped to address
   equality (a coverage-policy-design choice, not a key-control one) and that
   limitation is acknowledged in the spec. The T9 multi-tenant test that
   exercised the now-removed single-shared-wallet path was updated to assert
   the revert instead.

3. **PacketSubmitted event — no PHI leakage.** The new event signature
   (lines 199-204) carries `uint256 indexed reqId`, `uint256 indexed round`,
   `bytes32 packetRoot`, `bytes32 packetUrl`. At emit time both `packetRoot`
   and `packetUrl` are set to `n.evidenceUri` (line 776), which is a
   `bytes32` opaque ref (line 107). The contract's PHI invariant (line 52:
   "Only keccak256 hashes, opaque refs (bytes32), amounts, and settlement"
   on-chain) is preserved — `evidenceUri` is already emitted in
   `ContentCommitted`, `EvidenceSubmitted`, and `Appealed` events, so this
   adds no new disclosure surface. SPEC-0004 R3/R4 invariant intact.

4. **Event ordering / CEI.** `PacketSubmitted` is emitted at line 776, AFTER
   all state effects (`n.totalFees`, `n.rulingDeadline`, `n.state =
   UnderReview` at lines 764-768) and BEFORE the external
   `platform.createRequest` call at line 785. If `platform.createRequest`
   reverts, the entire tx reverts including the event — observers cannot see
   a PacketSubmitted that does not correspond to a successful fire. The
   `nonReentrant` guard on all three callers (`requestAdjudication`,
   `submitEvidence`, `appeal`) blocks a reentrant double-emit during the
   external call. CEI preserved.

5. **`n.round` correctness at emit.** Each of the three `_fireAgent` call
   sites sets `n.round` to the round being requested BEFORE invoking
   `_fireAgent`: `requestAdjudication` sets `n.round = 1` at line 378 and
   fires at line 380; `submitEvidence` does `n.round += 1` at line 412 and
   fires at line 414; `appeal` does `n.round += 1` at line 458 and fires at
   line 461. The new test (line 244) asserts emit with `round` 1/2/3 across
   the three paths — confirms the invariant under exercise.

6. **simulated.ts parity — error strings match exactly.** The simulated
   backend mirrors both R14a and R2b. Grep for the new error strings
   confirms exact match between Solidity and TS: `"create: self-contract"`
   (Sol line 323 ↔ sim line 217 ↔ sim test line 137) and
   `"appeal: prior ruling not Deny"` (Sol line 436 ↔ sim line 322).
   `simulated.ts` lowercases both addresses before comparison
   (`.toLowerCase()` on each side at line 216), which correctly handles
   checksummed-vs-unchecksummed address inputs at the TS boundary while
   preserving the Solidity contract's bytewise-equality semantics (Solidity
   `address` equality is canonical-form-agnostic). The T10 wrong-state
   expectation in the contract test (line 758) was updated to the new error
   string; no stale `"appeal: not ruled"` references remain in either test
   file (the simulated.auth.test.ts removed the single-shared-wallet
   happy-path entirely and replaced it with a revert assertion).

Out-of-scope confirmations: no new external calls beyond the existing
`platform.createRequest` (PacketSubmitted is event-only); no new storage
slots; no new modifiers; no new external entry points; no ABI changes
(PacketSubmitted is additive — does not alter existing event signatures).
The diff is minimally invasive, exactly UNIT-2 scope.
