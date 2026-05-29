# Security findings — tick 2 (UNIT-A0)

**Verdict:** PASS (zero findings)

## Findings

None.

## Notes

### Scope reviewed

UNIT-A0 uncommitted diff:

- `contracts/contracts/CoverageNegotiation.sol` — adds public storage slot
  `currentlyFiringReqId` (set in `_fireAgent` before the external platform call,
  cleared after); makes `submitEvidence` `payable nonReentrant` and routes it
  through `_fireAgent`; restores the full arbiter-tuple decode in
  `handleResponse` with explicit branches for `NeedMoreEvidence`,
  `PolicyInvalid`, `Approve`, and `Deny`.
- `contracts/contracts/mocks/MockAgentPlatform.sol` — replaces stale assembly
  payload probe with `IFiringProbe(callbackAddress).currentlyFiringReqId()`.
- `contracts/test/CoverageNegotiation.test.ts` — removes one stale
  `{ value: FEE }` from a non-payable revert assertion (`submitEvidence` is
  payable now, but that line asserts a wrong-state revert before the funding
  check — keeping the value would muddy the assertion; the comment is correct).

### What I checked

1. **Reentrancy on the new payable `submitEvidence`.** Guarded by
   `nonReentrant`. The two external calls in `_fireAgent`
   (`platform.createRequest{value: fee}` and `payer.call{value: refund}`)
   both occur AFTER state effects are committed (`n.state = State.UnderReview`,
   `n.rulingDeadline`, `n.totalFees += fee`, `n.round += 1` in the caller).
   CEI preserved.

2. **Refund target is not attacker-chosen.** `_fireAgent` is internal; it
   receives `payer` from the entry-point `msg.sender` (lines 344, 361, 402),
   never from calldata. A provider/insurer can only refund themselves.

3. **`handleResponse` platform gate intact.** `require(msg.sender ==
   address(platform), "callback: not platform")` at line 512 is unchanged.
   `_requestToNegotiation` lookup additionally requires the requestId to be
   registered (set AFTER `platform.createRequest` returns), so a malicious
   platform re-entering during `createRequest` cannot reach a registered reqId
   to mutate.

4. **Decoded arbiter tuple safety.** `Decision(decisionRaw)` casts a `uint8`
   to an enum with 4 values. Solidity 0.8+ reverts on out-of-range cast,
   which would revert `handleResponse` without state corruption. The
   negotiation then stays in `UnderReview` until `onRulingTimeout` routes it
   to the retriable `EvidenceRequested` state — liveness preserved. Same
   property if the bytes fail `abi.decode`. Trust model: the platform is
   admin-set, so this is defense-in-depth against a misbehaving validator
   set, not against an attacker.

5. **Cross-function reentrancy from the platform mid-`createRequest`.** The
   non-`nonReentrant` state-mutating functions (`accept`, `settle`, `refuse`,
   `withdraw`, `insurerEngage`, `onRulingTimeout`, `postFeedback`) all gate
   on `_onlyParty` / role / state / timestamp checks the platform cannot
   satisfy. `handleResponse` is gated to the platform but the
   `_requestToNegotiation` mapping is not yet populated mid-`createRequest`,
   so a reentered callback fails with `callback: unknown request`.

6. **State-machine integrity & round semantics.** `submitEvidence` now
   requires `n.state == State.EvidenceRequested`, increments `n.round`, and
   fires the agent (R6c). `_fireAgent` sets `n.state = State.UnderReview`
   before the external call. The `round` counter is incremented on every
   fire, so the appeal cap (`round >= maxRounds` in `appeal`) remains
   enforceable: any cycles spent in `submitEvidence` consume the same round
   budget. There is no `round >= maxRounds` check in `submitEvidence`
   itself — this is intentional and not a security issue:
   - `submitEvidence` is provider-only (auth gate intact at line 355).
   - Each call costs the provider the per-request fee (paid from
     `msg.value`, forwarded to the platform).
   - It can only fire while the agent returns `NeedMoreEvidence` (or while
     the response times out into `EvidenceRequested`); a single `Approve`
     or `Deny` exits the loop and from there `appeal` is round-capped.
   - The insurer is not trapped: `withdraw` is available from any
     pre-terminal state (line 453), including `EvidenceRequested` /
     `UnderReview`.
   No funds-loss or authorization-bypass vector. Worth surfacing to the
   spec author for explicit decision, but **not a security finding**.

7. **Fee-model integrity.** `submitEvidence` is now `payable`. `_fireAgent`
   computes `fee = platform.getRequestDeposit() + agentReward`, requires
   `msg.value >= fee`, forwards exactly `fee`, refunds the remainder.
   Underpayment reverts before any state change; overpayment is returned to
   the caller via a single `call` after `nonReentrant` effects are
   committed. No caller ETH is silently trapped.

8. **New public storage slot `currentlyFiringReqId`.** Writable only inside
   the internal `_fireAgent`; read via the auto-generated getter. The reqId
   is already public (events, mappings, count). If `platform.createRequest`
   reverts, the entry-point reverts and the slot rolls back to 0 alongside
   all other effects. No information leak, no griefing surface.

9. **Front-running.** `submitEvidence`, `requestAdjudication`, and `appeal`
   are all auth-gated to the specific party (provider or
   provider/insurer). A third party cannot pre-empt them.

10. **No new `delegatecall` / dynamic-selector `call`.** The diff does not
    introduce any low-level call with attacker-controlled selector or
    target.

### Informational observations (not findings)

- The `// Note` test comment ("non-payable") is technically inaccurate after
  this change — `submitEvidence` is now `payable`. The assertion itself is
  still correct (the revert is "evidence: wrong state", which fires before
  the funding check). Cosmetic; no security impact.
- `totalFees` accumulated on requests that terminate in `Deadlocked` /
  `PolicyInvalidated` / `Withdrawn` / `ProviderRefused` is never
  redistributed; the ETH stays in the contract for owner `withdrawFunds`.
  Pre-existing, out of scope for UNIT-A0.
