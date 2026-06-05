# Amendment 0010 — Wire the appeal-ladder rung into the decide prompt

**Status:** Accepted (2026-06-05)
**Affects:** SPEC-0004 R13/R15 (payer-line ladder), SPEC-0006 §3.6.1 (decide
prompt), Amendment 0007 (`_fireDecide`)

## Context

The negotiation carries `(payerLine, appealRound)` — the position in the
regulatory appeal ladder (SPEC-0004 R13). It is set at `createContract`,
incremented in `appeal()`, displayed by the UI's `AppealLadder` card, and used to
filter policies at engage. But it appears **nowhere** in `_fireScrape` or
`_fireDecide`: every rung re-runs the identical decision, and the arbiter has no
signal whether it is at the initial determination or a third-level appeal. The
ladder was inert — real infrastructure with no effect on the ruling.

## Decision

`_fireDecide` splices a bounded **ladder-context clause** into the inference
prompt, derived from `(n.payerLine, n.appealRound)`:

```
 Appeal context: <payerLine> review ladder, stage <appealRound>
 (stage 0 = initial determination); apply progressively stricter
 medical-necessity scrutiny at higher stages.
```

- `<payerLine>` ∈ {`PartD`, `Commercial`, `Medicaid`} via an inline enum→string
  map (3 cases).
- `<appealRound>` rendered with OpenZeppelin `Strings.toString` (already a
  dependency via `ReentrancyGuard`/`Ownable`).
- Built by an internal `pure` helper `_ladderContext(PayerLine, uint8)`.

The clause is appended to the existing `agentPromptHint + evidence` prompt; the
system prompt, `allowedValues`, and `chainOfThought` flag are unchanged.

## Consequences

- **The ladder rung now affects the ruling.** The arbiter knows its stage, so a
  later appeal can legitimately reach a different decision than the initial
  determination — the ladder is functional, not cosmetic.
- **No new storage; bounded prompt growth.** The clause is a short constant plus
  a one-byte number; the decide prompt stays well within `inferString` limits
  (the six curated prompts were already verified ≤1024 bytes with headroom).
- **No-PHI invariant untouched.** The clause is composed only of enum labels and
  an integer — no free text, no patient data.

## Test impact

Hardhat: assert the decide payload (or a decode of it) contains the payer-line
label and the stage number; a unit per `PayerLine`. The decision outcome itself
remains agent-driven (off-chain), so tests pin the *prompt wiring*, not a
specific verdict.
