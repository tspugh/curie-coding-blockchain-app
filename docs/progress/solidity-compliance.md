# Solidity compliance — `contracts/` gate (TOTAL-STICKLER)

**Date:** 2026-06-03
**Branch:** `spec-6-implementation` (working tree) vs `origin/main`
**Base commit:** `d5000a1` (`spec-6-implementation` HEAD at review time)
**Reviewer posture:** TOTAL-STICKLER. **Result: ZERO findings on the `contracts/` gate.**
**Headline unit under review:** Amendment 0008 / SPEC-0001 R8 — **real escrow
settlement** (payable `insurerEngage`, `escrowAmount` on the struct, value-bearing
`settle` + every terminal-non-settle release, CEI + `nonReentrant` on every
value-moving path, `withdrawFunds` ring-fenced from escrow).

## Gate scope

The full `contracts/` diff vs `origin/main`. Source-of-record (`node_modules`,
`artifacts`, `cache`, `typechain-types` excluded):

| File | Kind | Change |
| --- | --- | --- |
| `contracts/contracts/CoverageNegotiation.sol` | **production** | A0007 two-agent pipeline + **A0008 escrow settlement** |
| `contracts/contracts/mocks/MockAgentPlatform.sol` | test double | `triggerRuling` now encodes a single `string` decision token (SPEC-0006 R24–R26) |
| `contracts/contracts/mocks/RevertingReceiver.sol` | test double | doc-only trim of a stale comment |
| `contracts/test/CoverageNegotiation.test.ts` | tests | +A0007-S* and +A0008-S1a..S4c / A0008-SIM suites |
| `contracts/scripts/probe-agent-abi.ts` | dev script | string-token ABI alignment |
| `contracts/scripts/setup-selfhosted-2026-05-30.ts` | dev script | removed (self-hosted path banned) |
| `contracts/scripts/trigger-ruling.ts` | dev script | string-token ABI alignment |

The only **production** Solidity file is `CoverageNegotiation.sol`. The mocks and
scripts are test/dev tooling and carry no on-chain value; they are reviewed for
correctness against the production interface but are not in the runtime security
surface.

## Validation (re-verified 2026-06-03)

- **Compile (forced):** `rm -rf cache artifacts/build-info && npx hardhat compile`
  → `Compiled 8 Solidity files successfully (evm target: paris)`. **No warnings, no
  errors.** solc `0.8.24`, optimizer `runs: 200`, `viaIR: true`.
- **Contract tests:** `npx hardhat test` → **166 passing, 0 failing.** Includes the
  full A0008 escrow suite (S1a engage-payable, S1b underfund-revert, S1c
  overpay-refund, S1d escrowAmount stored, S2a settle-approve transfers
  coveredAmount→provider + refund→insurer + balance==0, S2b partial-coverage split,
  S2c settle-deny full-refund→insurer + balance==0, S3a Deadlocked, S3b
  ProviderRefused, S3c PolicyInvalidated, S3d Withdrawn — each full-escrow refund +
  balance==0, S4a withdrawFunds-cannot-drain-escrow, S4b balance==0 after every
  settled path, S4c balance==0 after every terminal-non-settle path), plus the
  transfer-failure branch suite (settle/refuse/withdraw/deadlock/policy_invalid
  reverting-recipient paths).
- **Off-chain mirror:** `npm run typecheck` clean; `npm run test:lib` →
  `src/contract/simulated.transitions.test.ts` A0008-SIM-BEH suite **24/24 passing**
  (underfund-throw, exact-deposit escrowAmount, settle-approve/deny zeroing,
  refuse/withdraw/Deadlocked/PolicyInvalidated zeroing, Settled `refundedToInsurer`
  field). The simulated backend + `src/contract/{abi,real,types}.ts` mirror the
  payable `insurerEngage(…, depositAmount?)` signature and the `escrowAmount` struct
  field; the `getNegotiation` ABI tuple carries `escrowAmount` at field 13.

## What changed for A0008 (escrow settlement)

- **`Negotiation.escrowAmount` (uint256)** appended in struct order at field 13
  (between `coveredAmount` and `costPlusUnitPrice`). Holds the ETH locked at
  `insurerEngage`; zeroed on every release/refund.
- **`_totalEscrowHeld` (private uint256)** at storage slot 8 — running sum of all
  live escrow. `withdrawFunds` is bounded to `address(this).balance -
  _totalEscrowHeld`, so the owner can never drain live escrow.
- **`insurerEngage` is `payable`** (`nonReentrant`): requires
  `msg.value >= requestedAmount` (`"escrow: underfunded"`), sets
  `escrowAmount = requestedAmount`, credits `_totalEscrowHeld`, and refunds any
  surplus to the insurer — all effects committed before the refund call (CEI).
- **`settle` moves value** (`nonReentrant`): Approved path transfers `coveredAmount`
  → provider and refunds `escrowAmount - coveredAmount` → insurer; Denied path
  refunds the full escrow → insurer. State → `Settled`, `escrowAmount = 0`,
  `_totalEscrowHeld` decremented BEFORE any `.call{value}`.
- **Every terminal-non-settle path refunds the full escrow → insurer**, CEI +
  `nonReentrant`: `refuse` → `ProviderRefused`; `withdraw` → `Withdrawn`; the
  round-cap short-circuit in `appeal` and `submitEvidence` → `Deadlocked`; the
  `policy_invalid` branch in `handleResponse` → `PolicyInvalidated`.
- **Push shape (v0):** `payable(addr).call{value: x}("")` with the boolean return
  checked (`require(ok, …)`). Pull-over-push is the noted preferred end-state; the
  security gate accepted push for v0 because every push is CEI-ordered behind
  `nonReentrant` and the recipient set is the two named party wallets (not arbitrary
  attacker contracts in the value-routing position).

## Gate-by-gate findings

### 1. Reentrancy — PASS

Every value-moving entry point carries `nonReentrant` AND follows
checks-effects-interactions (state + `escrowAmount = 0` + `_totalEscrowHeld`
decrement committed before any `.call{value}`):

| Function | `nonReentrant` | CEI before `.call{value}` |
| --- | --- | --- |
| `insurerEngage` (refund surplus) | yes | `escrowAmount`, `state=Ready`, `_totalEscrowHeld+=` set first |
| `requestAdjudication`/`submitEvidence`/`appeal` (via `_fireScrape`, fee refund) | yes | `state=UnderReview` + bookkeeping set first |
| `submitEvidence`/`appeal` round-cap (Deadlocked) | yes | `state=Deadlocked`, `escrowAmount=0`, `_totalEscrowHeld-=` set first |
| `settle` (provider transfer + insurer refund) | yes | `state=Settled`, `escrowAmount=0`, `_totalEscrowHeld-=` set first |
| `refuse` (escrow refund) | yes | `state=ProviderRefused`, `escrowAmount=0`, `_totalEscrowHeld-=` set first |
| `withdraw` (escrow refund) | yes | `state=Withdrawn`, `escrowAmount=0`, `_totalEscrowHeld-=` set first |
| `withdrawFunds` (owner) | yes | event after a single checked call; no further state mutated |
| `onRulingTimeout` (parked-fee refund) | keeper-callable | `pendingDecideFee=0`, `pendingFeePayer=0`, `state=EvidenceRequested` set first |

**`handleResponse` (and its `policy_invalid` escrow refund) is intentionally NOT
`nonReentrant`** — this is correct, not a finding:

- It is access-gated to `msg.sender == address(platform)` (the trusted Somnia
  platform), so the caller is not an attacker-controlled contract.
- It asserts `n.state == State.UnderReview` on entry. The `policy_invalid` branch
  sets `state = PolicyInvalidated` and `escrowAmount = 0` and decrements
  `_totalEscrowHeld` BEFORE the `.call{value}`; a reentrant re-entry into
  `handleResponse` fails the `UnderReview` guard, and any reentrant party function
  sees escrow already zeroed. CEI + the trusted-caller gate fully close the window.
- A same-tx `nonReentrant` lock cannot be added to `handleResponse` anyway without
  risking a lock collision with the `_fireScrape`/`_fireDecide` it chains into on the
  success path; the design correctly leans on CEI + the platform gate instead.

### 2. Missing access control — PASS

- Admin setters (`setPlatform`, `setAgentId`, `setAgentReward`, `setRulingTimeout`,
  `setMaxRounds`, `withdrawFunds`, `commitRationale`) are `onlyOwner`.
- `insurerEngage` is insurer-only (`require(msg.sender == n.insurerAddr)`);
  `submitEvidence`/`refuse` are provider-only; `createContract` must come from the
  declared provider; `requestAdjudication`/`appeal`/`accept`/`settle`/`withdraw`/
  `postFeedback` are party-gated via `_onlyParty`.
- `handleResponse` is platform-gated (`require(msg.sender == address(platform))`).
- **Value routing is deterministic and recipient-fixed:** escrow always returns to
  `n.insurerAddr`; covered amount always goes to `n.providerAddr`; surplus/fee
  refunds go to `msg.sender`/`payer` recorded at fire time. No caller can redirect a
  payout — there is no recipient parameter on any value-moving path.

### 3. Over/underflow beyond 0.8.x checks — PASS

- All escrow arithmetic is checked (0.8.x default): `msg.value - escrow` is guarded
  by the preceding `require(msg.value >= n.requestedAmount)`; `escrow - covered` in
  `settle` cannot underflow because `coveredAmount == requestedAmount == escrowAmount`
  on the real approve path (so `remainder >= 0`), and the only sub-escrow
  `coveredAmount` arises from a deliberately planted storage value in test S2b, which
  still satisfies `covered <= escrow`.
- `_totalEscrowHeld -= escrow` cannot underflow: escrow is credited exactly once at
  `insurerEngage` and debited exactly once on the single terminal/settle transition
  for that negotiation; the per-negotiation `escrowAmount` is the debit amount, so
  the global sum can never go below the value it contributed.
- The one `unchecked` block (`_benchmarkCap`) is overflow-SAFE by construction: it
  divides the product back and saturates at `type(uint256).max` instead of wrapping.
  In string-token mode both unit prices are 0, so it returns 0.

### 4. Unbounded loops — PASS

- No loop over the negotiations mapping or any caller-controlled-length array on a
  value path. `_containsNamePattern` and `_truncateRationale` iterate over
  caller-supplied strings bounded by the 1024-byte hint cap and the
  `MAX_RATIONALE_BYTES = 4096` cap respectively, and run only on non-value paths
  (`createContract`, `commitRationale`).
- The appeal/round machinery is bounded by `maxRounds` (`require(maxRounds_ >= 1)`),
  so the NeedMoreEvidence ↔ submitEvidence and Denied → appeal cycles terminate in
  `Deadlocked` rather than looping.

### 5. Missing event emits — PASS

Every state transition and every value movement emits: `InsurerEngaged` +
`ContractReady` (engage), `Settled` (settle), `ProviderRefused`, `Withdrawn`,
`Deadlocked`, `PolicyInvalidated`, `Ruled`, `FundsWithdrawn`. The escrow refunds ride
on the existing terminal-transition events (the refund is the economic consequence of
that documented transition), which is the intended event surface — no silent
value-moving path exists.

### 6. Storage-layout breaks — PASS (fresh deploy, append-only)

- `escrowAmount` is appended at struct field 13; `_totalEscrowHeld` occupies slot 8,
  shifting the `_negotiations`/`_requestToNegotiation` mappings to slots 9/10. This
  is a **layout change**, but the contract is **deployed fresh** (not upgraded — no
  proxy), so there is no live storage to corrupt. The storage-layout slot-walk test
  in `test/CoverageNegotiation.test.ts` was updated in lockstep to the new slot map
  and passes. OZ 5.x `ReentrancyGuard` uses transient storage and consumes no slot.
- The off-chain `getNegotiation` ABI tuple and `src/contract/real.ts` decoder were
  updated to carry `escrowAmount` at field 13, keeping the off-chain mirror in sync.

### 7. Gas anti-patterns — PASS

- Each value-moving function caches the struct fields it needs (`escrow`,
  `insurerAddr`, `providerAddr`, `covered`) into locals before the external call,
  avoiding repeated SLOADs across the interaction.
- Refunds are guarded by `if (x > 0)` so a zero-value transfer never burns gas on an
  empty `.call`.
- `_clearRequest` deletes the stale `_requestToNegotiation` entry (gas refund) and is
  invoked on every terminal/settle transition.

### 8. OZ-pattern non-adherence — PASS

- `Ownable(msg.sender)` constructor form (OZ 5.x). `ReentrancyGuard` from
  `@openzeppelin/contracts/utils/ReentrancyGuard.sol`, applied as `nonReentrant` on
  every value-moving external function.
- Checked low-level `.call{value}` with `require(ok, …)` is the OZ-recommended ETH
  transfer shape (over `transfer`/`send`), correctly used everywhere.
- The trusted-callback-relies-on-CEI pattern for `handleResponse` matches OZ guidance
  for privileged-caller callbacks.

## Escrow lifecycle completeness (no trapped/leaked ETH)

Escrow is locked exactly once (Open → Ready via `insurerEngage`) and is held only in
states reachable from `Ready`: `Ready`, `UnderReview`, `EvidenceRequested`,
`Approved`, `Denied`. **Every one of those states has at least one release path:**

- `Ready` / `UnderReview` / `EvidenceRequested` / `Approved` / `Denied` →
  `withdraw` (either party, any pre-terminal) refunds escrow → insurer.
- `Ready` onward → `refuse` (provider) refunds escrow → insurer.
- `Approved` / `Denied` (both accepted) → `settle` releases per the ruling.
- `Denied` at round cap → `appeal`/`submitEvidence` → `Deadlocked` refunds escrow.
- `UnderReview` (policy_invalid ruling) → `PolicyInvalidated` refunds escrow.
- A stuck `UnderReview` is rescued by `onRulingTimeout` → `EvidenceRequested`
  (escrow preserved and still tracked), from which `withdraw` releases it.

No reachable escrow-holding state lacks a release path, so escrow can never be
permanently trapped. The `balance == 0` assertions in A0008-S2a/S2c/S3a–S3d/S4b/S4c
prove the contract holds zero ETH after every settled and terminal path.

## Note (off-chain, out of contracts/ gate scope)

`src/contract/abi.ts` declares the off-chain `settle` ethers fragment as `payable`,
while the on-chain `settle` is non-payable. This is a harmless cosmetic discrepancy:
`RealBackend.settle` always sends value `0n`, and a value-bearing call to the
non-payable on-chain `settle` would revert at the EVM. It does not affect the
`contracts/` security gate (the on-chain surface is correct). Flagged for tidiness
only — not a finding.

## Conclusion

The `contracts/` gate is **CLEAN — ZERO findings.** The A0008 escrow settlement
implements payable engage with underfund-revert + overpay-refund, value-bearing
`settle` (approve: coveredAmount→provider + remainder→insurer; deny: full
refund→insurer), and full-escrow refunds on every terminal-non-settle outcome, with
checks-effects-interactions and `nonReentrant` on every value-moving path,
`withdrawFunds` ring-fenced from live escrow, and append-only storage on a fresh
deploy. Compile is warning-free; all 166 hardhat contract tests pass, and the 24
off-chain A0008-SIM-BEH escrow-mirror tests (`npm run test:lib`) pass.
