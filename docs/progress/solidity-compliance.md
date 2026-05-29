# Solidity compliance — tick 3 (UNIT-1)

**Verdict:** PASS (0 findings)

## Findings

None.

## Notes

UNIT-1 = SPEC-0004 §2.4 Phase 2 Solidity surface only (R13 + payerLine/appealRound carriers). R14a sequencing predicate is explicitly out of scope (UNIT-2).

Checks performed (all pass):

1. **Enum placement + values.** `PayerLine { PartD, Commercial, Medicaid }` declared inside the contract, immediately above `enum State` under the "State machine" block comment with a docstring tying it to SPEC-0004 R13/R14b. Implicit values 0/1/2 match `LADDERS` indexing in the spec and the test annotations (`0 /* payerLine: PartD */`).

2. **Struct field placement.** New fields land at `Negotiation` lines 126-127, immediately after `round` (line 125) and BEFORE `providerAccepted`/`insurerAccepted`. Comment block above `round` (lines 118-124, ROUND SEMANTICS) is preserved unbroken. Storage layout: this is a NEW deploy (no proxy, no migration of existing chain state), so the +2 slot shift on all subsequent fields (`providerAccepted` onward) is benign. `PayerLine` (1 byte) + `uint8 appealRound` (1 byte) co-pack into a single slot with the neighboring `providerAccepted`/`insurerAccepted` bools — no extra slot cost in v0.

3. **`appealRound` increment in `appeal()`** (line 429). Placement verified:
   - Line 415: cap check `if (n.round >= maxRounds)` — if cap hit, deadlocks + refunds + returns. `appealRound` is NOT bumped on the deadlock path. Correct.
   - Lines 426-427: evidence + rationale writes.
   - Line 428: `n.round += 1`.
   - Line 429: `n.appealRound += 1`.
   - Line 430: `Appealed` event.
   - Line 431: `_fireAgent` (interaction).
   Sequence is: cap-check -> effects (including appealRound) -> event -> interaction. CEI-safe; the `appealRound` bump is committed before the external call as required.
   Overflow: `uint8` holds 0..255. Cap is `maxRounds = 3` (line 155); appealRound therefore bounded well below 255. No overflow risk.

4. **`createContract` signature change.** New trailing param `PayerLine payerLine` at line 294. Struct init at lines 312-313 sets `n.payerLine = payerLine; n.appealRound = 0;` — both fields written. Exhaustive search of `_negotiations[reqId]` confirms only one storage-init site (line 301 in `createContract`); the other two `_negotiations[reqId]` reads (line 546 in `handleResponse`, line 792 in `_get`) operate on already-initialized records, no shadow inits. `appealRound = 0` is redundant with Solidity zero-init but is good explicit-intent hygiene.

5. **Modifiers intact.** `createContract` remains `external returns (uint256 reqId)` — no payable/nonReentrant change needed (no agent fire, unchanged from baseline). `appeal` remains `external payable nonReentrant` (line 404) — modifiers untouched. No new external entry points added; UNIT-1 only modifies the two existing signatures/bodies.

6. **Event emissions.** `ContractCreated` (lines 182-192) NOT modified — `payerLine` is not added to the event signature. SPEC-0004 R13 specifies that `payerLine` is "carried on each contract instance" (i.e. struct storage), not in the creation event. The value is readable via `getNegotiation` (line 636). Omitting it from the event is correct, not gold-plating it in.

7. **Tests updated.** All 5 `createContract` call sites in `CoverageNegotiation.test.ts` (lines 92, 134, 165, 511, 581 in the new file) pass the trailing `0 /* payerLine: PartD */` arg. Grep confirms 5 callsites x 5 annotations — exact match, no orphaned calls. The `createAs` helper (line 92) routes all per-test creations through the new shape. No drift.

No additional Solidity surface changed (ISomniaAgent.sol, Mock files untouched). The diff is minimally invasive — exactly UNIT-1 scope, nothing more. No sequencing predicate, no event-shape changes, no view-fn additions — all correctly deferred to UNIT-2 / later units.
