# Price benchmarks — the deterministic covered-amount cap (SYNTHETIC)

> **Synthetic, illustrative markers — not a real price for any product.** These
> are the **public price references** that back the deterministic covered amount
> (SPEC-0001 R6a/R10): `coveredAmount = min(requestedAmount, benchmarkCap)` on
> `approve`. The amount is computed by the contract from these inputs — the AI
> arbiter **never chooses it**.

## Public sources (R10)

| Source | What it provides | Value (unitless marker) |
|---|---|---|
| **NADAC** (National Average Drug Acquisition Cost) | Public CMS acquisition-cost benchmark per drug | `4200` |
| **Mark Cuban Cost Plus Drugs** | Public transparent cost-plus retail price | `4350` |

## Cap rule used in v0

`benchmarkCap = min(NADAC, CostPlus) = min(4200, 4350) = 4200`.

> SPEC-0001 §8 open question #1 flags the precedence rule (lower vs. NADAC-preferred)
> as undecided; v0 uses the **lower of the two** as a documented default.

## Worked example (the sample case)

- Requested amount: **5200** (provider's billed amount).
- Benchmark cap: **4200** (above).
- On `approve`: `coveredAmount = min(5200, 4200) = 4200` — visibly demonstrating
  `min()` in the UI (covered < requested).
- On `deny` / `policy_invalid`: `coveredAmount = 0`.

The web app's adjudication panel exposes the **benchmark cap** input (defaulting
to the requested amount when blank) so the demo can show both `covered ==
requested` and `covered < requested` outcomes.
