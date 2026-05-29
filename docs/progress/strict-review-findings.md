# Strict-review findings — tick 2 (UNIT-A0), re-review #3

**Verdict:** PASS (0 findings; previous Finding 1 resolved)

The previous re-review's single remaining gap — a missing test for the new
`submitEvidence` round-cap deadlock path — is now closed. A new test
`R9 (deadlock submitEvidence)` at `contracts/test/CoverageNegotiation.test.ts:669-691`
exercises the cap path with assertions structurally equivalent to its sibling
`R9 (deadlock appeal)` (test.ts:645-667). The full hardhat suite reports
**15 passing / 0 failing**, including the new test. Nothing else in the uncommitted
diff warrants a stickler flag.

## Re-review of the prior finding

### Previous Finding 1 (HIGH) — RESOLVED

The new test (test.ts:669-691):

```ts
it("R9 (deadlock submitEvidence): submitEvidence at the round cap deadlocks and refunds the full msg.value (no agent fires)", async () => {
  const { platform, contract } = await deploy();
  const [provider, insurer] = await ethers.getSigners();
  const target = await contract.getAddress();
  await contract.setMaxRounds(1n); // first ruling already at the cap

  const { reqId, requestId } = await createEngageAdjudicate(contract, platform, provider, insurer);
  // NeedMoreEvidence ruling routes to EvidenceRequested with round == maxRounds.
  await platform.triggerRuling(target, requestId, ruling(Decision.NeedMoreEvidence, 0n));
  expect(await contract.stateOf(reqId)).to.equal(State.EvidenceRequested);
  expect(await contract.roundOf(reqId)).to.equal(1n); // round == maxRounds

  const value = ethers.parseEther("0.02");
  const balBefore = await ethers.provider.getBalance(provider.address);
  const tx = await contract.connect(provider).submitEvidence(reqId, EVIDENCE_URI_2, { value });
  const rc = await tx.wait();
  const gas = rc!.gasUsed * rc!.gasPrice;
  const balAfter = await ethers.provider.getBalance(provider.address);
  // Deadlocked: no fee charged, full value refunded → net cost is just gas.
  expect(balBefore - balAfter).to.equal(gas);
  expect(await contract.stateOf(reqId)).to.equal(State.Deadlocked);
  expect(await ethers.provider.getBalance(target)).to.equal(0n);
});
```

Required-assertion table (previous review's bar):

| Required check | Status | Evidence |
|---|---|---|
| Full refund (not just `> 0`) | PASS | `expect(balBefore - balAfter).to.equal(gas)` — exact equality on line 688. A fee charge would inflate the delta to `gas + FEE`. |
| State == `Deadlocked` post-call | PASS | line 689 |
| Contract balance == 0 (no trapped ETH) | PASS | line 690 |
| No agent fire | PASS (implicitly) | The two assertions above jointly prove no fire happened: a fire would consume the `FEE` from `msg.value` (so the balance delta would be `gas + FEE`, not just `gas`), AND the contract would retain at least the fee in flight (so `getBalance(target)` would be `>= FEE`). The existing R9 (deadlock appeal) test (test.ts:664-666) uses the same implicit pair and was previously accepted. Parity preserved. |

Setup pre-conditions also asserted (round == 1 == maxRounds, state ==
EvidenceRequested before the cap-path call) — these prove the test is actually
hitting the cap path it claims to hit, not an unrelated revert. The test reads
cleanly when diffed side-by-side with R9 (deadlock appeal): identical signer
choice (`provider` instead of `insurer` because submitEvidence is provider-only),
identical balance/gas pattern, identical setMaxRounds(1n) seed, identical 0.02
ETH overpayment. **PASS.**

## Re-scan of the uncommitted diff for new stickler flags

`git diff --stat` covers 4 files:
- `contracts/contracts/CoverageNegotiation.sol` (109 lines)
- `contracts/contracts/mocks/MockAgentPlatform.sol` (20 lines)
- `contracts/test/CoverageNegotiation.test.ts` (27 lines)
- `src/contract/real.ts` (6 lines)

### Test file (27-line delta) — the only change in this tick

Two changes:

1. **New R9 (deadlock submitEvidence) test (lines 669-691).** Reviewed above. PASS.
2. **T10 submitEvidence revert check tightened (lines 707-710).** The previous
   form `submitEvidence(reqId, EVIDENCE_URI, { value: FEE })` is replaced with
   `submitEvidence(reqId, EVIDENCE_URI)` (no value), and a new comment explains
   why: "submitEvidence reverts on the state guard before the fee check — no
   value needed here." This is a strengthening, not a regression: dropping the
   value proves the state guard at sol:349 fires *before* the payable surface
   ever evaluates `msg.value`, which is what the comment claims. The comment
   does not lie. PASS.

### Source / mock / wrapper deltas — unchanged from previous re-review

The sol, mock, and `real.ts` deltas in this diff are exactly the deltas the
previous re-review cleared (cap block on submitEvidence, transparency slot,
mock probe refactor, real.ts fee on submitEvidence). Re-scanning for anything
the previous review missed:

1. **Dead code:** none introduced. `currentlyFiringReqId` is used by the mock
   probe (MockAgentPlatform.sol:74-75) AND is a load-bearing public read for
   off-chain probes — not dead.
2. **Comments that lie:** none. The natspec on `submitEvidence` (sol:347-353)
   accurately describes the new payable + cap-deadlock behavior. The CEI note
   on `currentlyFiringReqId` (sol:153-159, sol:728-732) is accurate: the slot is
   set AFTER `n.state = State.UnderReview`, so the state-effect ordering is
   preserved. The inline comment in the new cap block (sol:357-360) correctly
   names the R9 invariant and the `nonReentrant` guarantee.
3. **Spec drift:** R6c's round cap now applies uniformly to both agent-firing
   entry points after `Ready` (appeal + submitEvidence). The submitEvidence
   semantics change (was: "return to Ready, fee on next adjudication"; now:
   "fire agent directly, fee here") is correctly reflected in the new natspec
   AND in the real.ts wrapper (which now passes `agentFeeValue`). No drift.
4. **DRY threshold:** the cap-block duplication is now exactly 2x (appeal +
   submitEvidence). The previous review's rule of thumb was "accept 2x; extract
   on 3x". No third call site has appeared, so the inline form stays. PASS.
5. **Weak assertions in the new test:** the bal-delta == gas check is exact
   (`.to.equal(gas)`, not `.to.be.gt(0)` or `.to.be.closeTo(...)`), and a fire
   would have changed the delta by exactly `FEE` — so the assertion is
   load-bearing for "no fire". The contract-balance == 0 check is also exact.
   Could be marginally strengthened by adding
   `expect(await platform.createRequestCalls()).to.equal(<callsBefore>)`,
   but (a) the sibling R9 (deadlock appeal) test doesn't bother, and (b) the
   balance pair already proves no fire happened. Holding parity with the
   sibling is the right call for v0; not a finding.
6. **Backwards-compat hacks:** none. The interface rename
   `IStateProbe` → `IFiringProbe` is a clean rename inside the mock; not
   ABI-exported.
7. **Storage layout:** `currentlyFiringReqId` was appended after the natspec
   block at sol:160 (not inserted into the existing layout), and the prior
   storage slots are unchanged. No upgrade footgun (the contract isn't
   upgradeable anyway, but the discipline is correct).
8. **Test isolation:** the new test calls `deploy()` for its own fixture, so it
   doesn't share state with any other test. No order-dependence introduced.

## Summary

| Category | Status |
|---|---|
| Previous Finding 1 (cap-path test missing) | RESOLVED |
| Test correctness (full refund, state, balance) | PASS |
| Test parity with sibling R9 (deadlock appeal) | PASS |
| Suite green | PASS (15/15) |
| Dead code | none |
| Comments accurate | yes |
| Spec drift | none |
| DRY at 2x | acceptable |
| Weak assertions | none material |

This tick lands clean.
