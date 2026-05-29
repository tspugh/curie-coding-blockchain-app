# Solidity compliance — tick 2 (UNIT-A0)

**Verdict:** PASS (zero findings)

**Reviewed diff:** contracts/contracts/CoverageNegotiation.sol, contracts/contracts/mocks/MockAgentPlatform.sol, contracts/test/CoverageNegotiation.test.ts

## Findings

None.

## Notes

Checked, in order:

- **Reentrancy.** All three agent-firing entry points (`requestAdjudication`,
  `submitEvidence`, `appeal`) are `external payable nonReentrant`. `_fireAgent`
  is internal — only reachable through those guarded entry points. The internal
  refund (`payable(payer).call`) is the LAST operation in `_fireAgent`; all
  negotiation effects (`rulingDeadline`, `state = UnderReview`, `totalFees`,
  `currentlyFiringReqId`) are committed before the external `platform.createRequest`.
  `handleResponse` is platform-gated (`msg.sender == address(platform)`) and
  performs no external calls (only event emits + storage writes), so the lack
  of `nonReentrant` on it is acceptable.

- **`currentlyFiringReqId` access control.** Declared `uint256 public` → the
  compiler emits only a view getter. The only writers are inside `_fireAgent`
  (internal), which is called exclusively from the three nonReentrant entry
  points. No external write path exists. Exposing it as a read in production
  is harmless — it is 0 outside of an active fire (transient by convention).

- **Storage layout.** Contract has no proxy / upgradeability machinery
  (no `Initializable`, no `__gap`, no UUPS/Transparent imports), and the deployed
  address `0x461aeC3384e45CAEC49a2FBf099416d7BED659b4` is a plain deployment.
  Inserting `currentlyFiringReqId` as a new slot is therefore not a layout-break
  concern — every deploy is a fresh deploy.

- **CEI in `_fireAgent`.** Order verified:
  1. `n.rulingDeadline = ...` (effect)
  2. `n.state = State.UnderReview` (effect)
  3. `currentlyFiringReqId = reqId` (effect — set AFTER state, as documented)
  4. `platform.createRequest{value: fee}(...)` (interaction)
  5. `currentlyFiringReqId = 0` (post-interaction effect; safe because
     nonReentrant blocks the only reentry path)
  6. `n.pendingRequestId = requestId` and `_requestToNegotiation[requestId] = reqId`
     (post-interaction effect; unavoidable — requestId is the return value of
     the external call, and nonReentrant guards reentry)
  7. `RulingRequested` event
  8. Optional refund (terminal external call; all effects committed)

  The "effect after interaction" pattern for `pendingRequestId` is the same
  pre-existing structure and is standard for callback-id mappings.

- **`submitEvidence` fee model.** Now `payable nonReentrant`, delegates to
  `_fireAgent(reqId, n, msg.sender)`. The `_fireAgent` body enforces
  `require(msg.value >= fee, "fee: underfunded")` and refunds
  `msg.value - fee` to the caller. Identical model to `requestAdjudication` and
  `appeal` — confirmed consistent.

- **Decision branching in `handleResponse`.** All four `Decision` values handled:
  - `NeedMoreEvidence` → state `EvidenceRequested`, emits `EvidenceRequested` only
    (correct — not a ruling, so no `Ruled` event; round already incremented at
    the firing entry point).
  - `PolicyInvalid` → state `PolicyInvalidated`, emits `PolicyFlagged`, `Ruled`,
    `PolicyInvalidated` (all three with non-zero `clauseRef`/`standardRef`/
    `rationaleHash` since those are decoded from the response).
  - `Approve` → state `Approved`, deterministic cap via `_benchmarkCap`, emits
    `Ruled` with non-zero `rationaleHash`/`clauseRef`/`receiptId`.
  - `Deny` → state `Denied`, emits `Ruled` with the decoded rationale fields.
  All four state transitions match the 11-state machine in the SPEC-0001 enum.

- **`Decision(decisionRaw)` cast.** Solidity 0.8.x reverts on out-of-range
  enum casts. A malformed `decisionRaw >= 4` therefore reverts the callback,
  which leaves the negotiation in `UnderReview` (since `_clearRequest` ran
  before decode and its effects are rolled back with the revert).
  `onRulingTimeout` can recover the request after `rulingDeadline`, so this
  is not a stuck-forever scenario. Trusted-platform assumption holds. Not a
  finding; noted for awareness.

- **Integer math.** `_benchmarkCap` uses `unchecked` with explicit overflow
  detection (divide-back) and saturates at `type(uint256).max`. The callback
  path can therefore never revert on extreme prices — saturation falls back to
  `requestedAmount` in the `min()`. Correct defensive design.

- **Event emissions.** Every state transition emits at least one event:
  `UnderReview` → `RulingRequested`; `Approved`/`Denied` → `Ruled`;
  `EvidenceRequested` → `EvidenceRequested`; `PolicyInvalidated` →
  `PolicyFlagged` + `Ruled` + `PolicyInvalidated`. The `PolicyInvalid` branch
  emits all three with the agent-supplied refs, not zeroes (confirmed against
  the decoded local variables).

- **Gas anti-patterns.** No unbounded loops. `currentlyFiringReqId` set-then-
  clear is two SSTOREs (~22,100 + ~2,900 with the storage-clear refund). For
  Solidity 0.8.24 the `transient` keyword is unavailable (added in 0.8.28), so
  regular storage is the idiomatic approach here. Acceptable.

- **OZ patterns.** `Ownable` (constructor `Ownable(msg.sender)` — OZ v5 form)
  and `ReentrancyGuard` (`nonReentrant` modifier) used idiomatically.

- **Test comment drift (informational, not a finding).** The test comment at
  `contracts/test/CoverageNegotiation.test.ts:683` reads "submitEvidence is
  non-payable (fee is paid at the next requestAdjudication, per spec)". After
  this tick, `submitEvidence` IS payable. The TEST still passes because the
  `evidence: wrong state` revert fires before any value handling, but the
  comment is now inaccurate. Worth correcting in a follow-up sweep — not a
  Solidity-safety issue, so not gating this tick.

- **MockAgentPlatform probe.** The new `IFiringProbe.currentlyFiringReqId()`
  view call cleanly replaces the assembly `calldataload(payload.offset)` hack
  — strictly safer (no payload-layout assumption). Both probe calls are
  `view`, so no state-change risk during the mid-`createRequest` window.
