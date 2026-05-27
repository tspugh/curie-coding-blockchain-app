# Price benchmarks — the deterministic covered-amount cap (SYNTHETIC)

> **Synthetic, illustrative markers — not a real price for any product.** These
> are the **public price references** that back the deterministic covered amount
> (SPEC-0001 R6a/R10, cap resolved 2026-05-27): on `approve`,
> `coveredAmount = min(requestedAmount, costPlusUnitPrice × quantity)`. The
> amount is computed by the contract from these inputs — the AI arbiter **never
> chooses it**. `quantity` drives the cap; `daysSupply` is necessity context, not
> a price input.

## Public sources (R10)

| Source | What it provides | PER-UNIT value (unitless marker) |
|---|---|---|
| **Mark Cuban Cost Plus Drugs** | Public transparent cost-plus retail price | `2100` |
| **NADAC** (National Average Drug Acquisition Cost) | Public CMS acquisition-cost benchmark | `2000` |

## Cap rule used in v0 (resolved 2026-05-27)

`costPlusTotal = costPlusUnitPrice × quantity` is the **cap basis**; the covered
amount on `approve` is `min(requestedAmount, costPlusTotal)`. **NADAC is the
acquisition-cost floor reference only** — it is recorded for transparency
(`nadacFloorTotal = nadacUnitPrice × quantity`) and a `requested < NADAC` is
flagged suspicious, but it **never enters the cap math**.

## Worked example (the sample case)

- Requested amount: **5200** (provider's billed amount).
- Quantity: **2** dispensed units (the cap driver).
- Cost Plus unit price: **2100** → `costPlusTotal = 2100 × 2 = 4200` (the cap).
- NADAC unit price: **2000** → `nadacFloorTotal = 2000 × 2 = 4000` (floor reference).
- On `approve`: `coveredAmount = min(5200, 4200) = 4200` — visibly demonstrating
  `min()` in the UI (covered < requested), with the price gauge showing all four
  bars (requested / NADAC floor / Cost Plus cap / covered).
- On `deny` / `policy_invalid`: `coveredAmount = 0`.

The web app's adjudication panel exposes the **Cost Plus unit price** and
**NADAC unit price** inputs (defaulting to a non-binding cap when blank) so the
demo can show both `covered == requested` and `covered < requested` outcomes.
