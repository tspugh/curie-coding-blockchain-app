# Non-compliant insurer policy — drives `PolicyInvalidated` (SYNTHETIC)

> **Synthetic, no PHI.** This fixture is the insurer policy variant whose
> relied-on clause **contradicts a public standard**, so the necessity arbiter
> must **flag it and void the contract** (SPEC-0001 R6b → `PolicyFlagged` +
> terminal `PolicyInvalidated`). It exists to demonstrate the compliance gate:
> a bad policy clause is thrown out, never silently applied.

## The contradicting clause

```
Part D exception-criteria policy — Adalimumab (Specialty Tier 5).

Clause PD-ADA-09 (NON-COMPLIANT): Adalimumab is NOT covered for plaque psoriasis
under any circumstances, and step-therapy exceptions do not apply to this
indication.
```

## Why it is non-compliant (the public standard it violates)

- **Public standard cited:** the **openFDA / DailyMed HUMIRA (adalimumab) label**,
  which lists **moderate-to-severe chronic plaque psoriasis** as an
  **FDA-approved indication**
  (`https://api.fda.gov/drug/label.json?search=openfda.brand_name:HUMIRA`).
- **The contradiction:** clause **PD-ADA-09** categorically denies coverage for an
  indication the FDA-approved label expressly covers, and removes any exception
  path. A blanket exclusion of an on-label indication contradicts the public
  standard.
- **Required arbiter behaviour (R6b):** when the agent would have to **rely on**
  PD-ADA-09 to rule, it instead emits `PolicyFlagged(clauseRef = PD-ADA-09,
  standardRef = openFDA-label-indication)` and routes the request to terminal
  **`PolicyInvalidated`** — the whole request is voided. No covered amount is set.

## How to drive it from the UI

1. File the [sample case](./sample-case.md) as **Provider**.
2. As **Insurer**, in **Detail → Attach policy**, click **"Load NON-compliant
   policy"** (loads this clause) and engage → **Ready**.
3. **Request adjudication** with decision **`policy_invalid`** (the simulated
   arbiter), → `PolicyFlagged` + `PolicyInvalidated` (terminal). The ruling panel
   shows the flagged clause + the cited public standard.

In real-wallet mode the native agent reaches the same outcome by comparing the
attached policy against the openFDA label and refusing to apply the contradicting
clause.
