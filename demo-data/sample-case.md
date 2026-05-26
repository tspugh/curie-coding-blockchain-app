# Sample case — coverage-exception negotiation (SYNTHETIC)

> **This is a synthetic demonstration case. It contains NO real patient data
> (no PHI).** It is copy-pasteable into the web app's **Create** view to drive
> the MVP0 flow end-to-end. SPEC-0001 §4 deliverable; §7 puts PHI redaction and
> real-case generation out of scope — this single fixture stands in.

## Scenario

A prescriber requests coverage of a biologic (**adalimumab**) for a patient
whose plan places it behind a step-therapy / prior-authorization requirement.
The prescriber argues the documented criteria are met; the payer's initial
position is lower, anchored to the plan's preferred-agent pricing. They each
submit a position, then dispute — and a native Somnia agent rules the request
against the **published Part D formulary** coverage criteria
([`formulary-part-d.json`](./formulary-part-d.json) /
[`formulary-part-d.html`](./formulary-part-d.html)) and the neutral benchmark
price band.

## De-identified clinical note (paste into "Patient note")

Only the **keccak256 hash** of this text is committed on-chain (R3/R4); the text
itself never leaves the browser's off-chain content store.

```
46-year-old patient with moderate-to-severe chronic plaque psoriasis (BSA ~12%,
PASI 14). Documented inadequate response to an 8-week trial of methotrexate
(intolerance: transaminitis) and to topical high-potency corticosteroids.
No active infection; latent TB screen negative; hepatitis panel negative.
Prescriber requests coverage of adalimumab per step-therapy exception:
preferred conventional systemic therapy tried and failed. Requested as a
formulary coverage exception with prior authorization.
```

## Negotiation inputs (paste into the form)

| Field | Value | Notes |
|---|---|---|
| **Drug name** | `Adalimumab` | hashed to an opaque `drugRef` (bytes32) on-chain |
| **Price floor** | `2800` | benchmark band lower bound (see formulary fixture) |
| **Price ceiling** | `5200` | benchmark band upper bound |
| Provider position | `5000` | submitted by the **Provider** profile |
| Payer position | `3000` | submitted by the **Payer** profile |
| Settlement | `3600` | within `[2800, 5200]` — recorded as an event marker (R8) |

## Expected flow

1. **Create** the contract as **Provider** with the note + drug + band above.
2. Submit the Provider position (`5000`); switch profile to **Payer** and submit
   the Payer position (`3000`) → contract becomes **Ready**.
3. Raise a **dispute** → the contract fires the native agent (R6). Against these
   criteria the formulary supports the exception → verdict **approve** →
   **Approved**. (Try **deny** / **need_more_evidence** to walk the other paths:
   deny → **appeal**; need_more_evidence → **submit evidence**.)
4. **Settle** at `3600` (within band) → **Settled**.

Amounts are unitless integers in v0 (a benchmark-band marker, not a token
transfer — R8). They are illustrative, not a real price for any product.
