# Amendment 0008 — Real escrow settlement: contract holds payer funds and releases the covered amount

**Status:** Proposed · **Owner:** tspugh · **Date:** 2026-06-03 ·
**Affects:** SPEC-0001 R5/R8/R9, SPEC-0003 (token-flow visibility), SPEC-0006 §2.x
**Relationship:** independent of Amendment 0007 (ruling architecture); both land
in the same `spec-6-implementation` redeploy.

## Context

SPEC-0001 R8 defined settlement as an **event marker only** ("no token transfer
… real transfer v1"). The product direction is now that the contract must
**actually hold the payer's funds in escrow and release the covered amount** to
the provider on settlement — real value transfer, with small STT amounts on
testnet. This pulls the documented "v1 real transfer" into the V0 scope.

The covered amount is already variable and deterministic
(`min(requested, benchmarkUnitPrice × quantity)` per Amendment 0007); escrow
makes the *release* of that amount a real transfer rather than a logged marker.

## Decision

**The insurer funds escrow at engage; the contract releases the covered amount to
the provider at settlement and refunds the remainder; any terminal-non-settle
outcome refunds the full escrow to the insurer.**

### 1. Deposit at engage

`insurerEngage` becomes `payable`. The insurer MUST deposit at least the
negotiation's `requestedAmount`:

```solidity
function insurerEngage(uint256 reqId, bytes32 policyHash, bytes32 policyUri)
    external payable
{
    // … existing engage checks …
    require(msg.value >= n.requestedAmount, "escrow: underfunded");
    n.escrowAmount = msg.value;          // the held payer funds
    // refund any overpayment above requestedAmount to the insurer (CEI + nonReentrant)
}
```

`escrowAmount` is tracked separately from the **agent-fee float** (which the
caller funds at `requestAdjudication` per SPEC-0001 R9). The two value flows
never commingle: agent fees pay the Somnia platform; escrow pays the provider.

### 2. Release at settle

`settle` (reachable from `Approved`/`Denied` with both parties accepted) performs
the real transfer:

- **Approved:** transfer `coveredAmount` → provider; refund
  `escrowAmount − coveredAmount` → insurer.
- **Denied:** `coveredAmount == 0` → refund the full `escrowAmount` → insurer.

State → `Settled`; `Settled(reqId, coveredAmount, refundedToInsurer)` emitted.

### 3. Refund on every terminal-non-settle outcome

`Deadlocked`, `ProviderRefused`, `PolicyInvalidated`, and `Withdrawn` each refund
the full `escrowAmount` → insurer as part of the terminal transition. No escrow
is ever stranded in the contract.

### 4. Safety (real funds — first-class concern)

- **CEI + `nonReentrant`** on every path that moves value: set the terminal state
  and zero `escrowAmount` *before* the external transfer.
- **Pull-over-push for refunds/releases** is preferred: record
  `owed[address] += amount` and expose `withdraw()` so a reverting recipient
  cannot brick settlement. (Push with checked `call` + `nonReentrant` is the
  fallback if the demo needs single-tx settlement; the security-auditor gate
  decides.)
- `withdrawFunds` (owner) continues to drain **only** the deliberate agent-fee
  float, never escrow — escrow is owed to the parties, not the owner.

### 5. Adjustability

The released amount is the **variable `coveredAmount`** — adjustable per case via
the ruling (`approve`/`deny`) and the curated benchmark cap. A manual
post-ruling override of the release amount is **out of scope** for V0 (the
covered amount is determined by the ruling + cap); if needed later it is a
separate owner/governance affordance, not a settlement-path change.

## Consequences

- **`insurerEngage` signature gains `payable` + an escrow deposit**; the web
  app's engage flow must surface the deposit amount and a balance pre-flight
  (SPEC-0003 R39 already gates both signers).
- **`settle` and every terminal transition move real STT** — redeploy required;
  security review mandatory before any funded run.
- **SPEC-0003 token-flow visibility** now shows real escrow held / released /
  refunded, not just gas + agent fees. The price gauge gains a real "released"
  number.
- **Testnet amounts stay small** (sub-STT covered amounts) to conserve the dev
  wallet; the mechanism is amount-agnostic.
- **SPEC-0001 R8 wording** changes from "event marker only" to "real escrow
  release"; the 50/50 agent-fee split marker is retained as separate accounting.

## Rollback

The event-marker settlement (current R8) remains the fallback: if escrow safety
review is not clearable in the demo timeline, ship marker-only settlement and
gate escrow behind a `escrowEnabled` flag defaulting off.
