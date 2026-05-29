# Security findings — tick 3 (UNIT-1)

**Verdict:** PASS (0 findings)

## Findings

None.

## Notes

Reviewed diff (12 modified files + new `src/protocol/{ladders.ts, ladders.test.ts}`):
adds `PayerLine` enum + `payerLine`/`appealRound` carrier fields across the
Solidity struct, TS types, both backends (`real.ts` tuple decode at indices
[21]/[22], `simulated.ts` shadow record), ABI strings, orchestrator path, web
Create form (hardcoded `PayerLine.PartD`), the localnode deploy script, and the
new pure-data `LADDERS` library + helper. UNIT-2 sequencing predicate (R14a)
is explicitly deferred; nothing in this diff enforces window/threshold on-chain.

Checks performed (all pass):

1. **Untrusted input on `PayerLine`.** Solidity 0.8.x ABI-decodes enum
   parameters with an in-range check — a raw calldata `payerLine >= 3` reverts
   the tx before `createContract`'s body runs. No off-chain path currently
   exposes user-controlled payer-line selection (`web/src/views/Create.tsx`
   hard-codes `PayerLine.PartD`; `PartyAgent.fileRequest` defaults to PartD
   when the field is omitted). When form-driven selection ships in a later
   unit, the on-chain decoder remains the backstop.

2. **TS boundary safety on the tuple decode.** `real.ts` line 577 casts
   `Number(raw[21]) as PayerLine`. The cast is a structural assertion, not a
   runtime guard — but the on-chain invariant (enum-checked on write)
   guarantees the value is always 0/1/2. Even with a hypothetical bad value,
   the consumer surface is safe: `LADDERS[line]` returns `undefined` for
   unknown keys, and `stageNameFor` already handles that path with a `"—"`
   fallback (`if (!ladder) return "—"`). No throw path exposed.

3. **No new external calls, no new storage outside the struct.** The two new
   fields (`payerLine`, `appealRound`) are added inside the existing
   `Negotiation` struct between `round` and `providerAccepted`. No new
   mappings, no new external calls in `createContract` or `appeal`,
   `_fireAgent` unchanged. Slot packing: `PayerLine` (1 byte) + `uint8
   appealRound` (1 byte) co-pack with the neighboring `providerAccepted` /
   `insurerAccepted` bools — no extra slot.

4. **`appealRound` semantics + monotonicity.** In `appeal()`:
   - Line 415: cap check (`n.round >= maxRounds`) — if hit, deadlocks +
     refunds + returns. `appealRound` is NOT bumped on the deadlock path
     (matches `round`'s own deadlock behavior — symmetric, no desync).
   - Line 429: `n.appealRound += 1` follows `n.round += 1` (line 428),
     after evidence/rationale writes, before event emit, before `_fireAgent`
     interaction. CEI-clean. Effects committed before the external call.
   - `submitEvidence` increments `round` only, NOT `appealRound` — correct
     per spec (more evidence in the same appeal round). No downstream
     consumer in the diff reads `appealRound` for any sequencing predicate
     (R14a is explicitly UNIT-2 scope and not present here).
   - Overflow: `uint8 appealRound` holds 0..255. `maxRounds = 3` caps total
     adjudication cycles, so `appealRound` is bounded well below 255. No
     overflow risk.

5. **No new payable surface.** `createContract` remains non-payable (no agent
   fire at creation). `appeal` remains `external payable nonReentrant`
   (unchanged modifiers). `submitEvidence` and `requestAdjudication`
   modifiers untouched. No new external entry points; UNIT-1 only modifies
   `createContract` (added trailing `PayerLine` arg) and `appeal` body
   (added `n.appealRound += 1`).

6. **`src/protocol/ladders.ts` purity.** Module-level `const LADDERS` (typed
   `readonly` literal) + one pure helper `stageNameFor`. No I/O, no
   `process`, no `eval`, no JSON.parse on untrusted input, no dynamic
   imports. `stageNameFor` is total: handles out-of-range round
   (`ladder[round] ?? "—"`) and unrecognised line (`if (!ladder) return
   "—"`). All citation URLs are static literals (cms.gov, ecfr.gov) — no
   template injection / SSRF surface. Side-effect-free.

7. **PHI invariant (SPEC-0004 R1).** Nothing in the diff logs, stores, or
   transmits PHI. The `LADDERS` constant carries only public-regulatory
   content: stage names ("Initial Determination", "Redetermination", "IRE
   Reconsideration", "ALJ / OMHA Hearing", "Medicare Appeals Council",
   "Internal Appeal", "External Review", "Plan Internal Appeal", "External
   Medical Review / State Fair Hearing"), short descriptions of those
   stages, public CFR / CMS citations with public URLs, integer
   `windowDays`, and integer `thresholdCents` (the PartD AIC of $200 =
   20,000 cents). No patient identifiers, diagnoses, drug names,
   prescription data, or anything tied to a real or synthetic individual.
   The on-chain additions (`payerLine`, `appealRound`) are opaque enum +
   counter values, not PHI carriers. Invariant intact.

Out-of-scope confirmations: no event-shape changes (`ContractCreated` not
amended to include `payerLine`, correctly — R13 says struct-stored, not
event-broadcast); no `ISomniaAgent.sol` changes; no mock changes; no agent
prompt changes; R14a sequencing predicate properly deferred to UNIT-2.
