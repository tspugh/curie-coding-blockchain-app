# Sample case — drug coverage-exception arbitration (SYNTHETIC)

> **This is a synthetic demonstration case. It contains NO real patient data
> (no PHI).** It is copy-pasteable into the web app's **File request** view to
> drive the MVP0 flow end-to-end. SPEC-0001 §4 deliverable; §7 puts PHI redaction
> and real-case generation out of scope — this single fixture stands in.

## Scenario

A **provider (clinician)** files a Part D coverage-exception request for a
biologic (**adalimumab**) that the plan places behind step-therapy / prior
authorization. The **insurer** engages by attaching its governing
exception-criteria policy. The contract fires a native Somnia **necessity
arbiter**, which weighs the provider's cited **public evidence** (the openFDA /
DailyMed label + the clinical justification) against the **insurer's attached
policy criteria** and rules `approve | deny | need_more_evidence` — citing the
specific policy clause. On `approve` the **covered amount is deterministic**:
`min(requestedAmount, benchmarkCap)` from the public price refs (NADAC / Mark
Cuban Cost Plus). The agent never chooses the amount.

## De-identified clinical justification (paste into "Justification note")

Only the **keccak256 hash** of this text is committed on-chain (R3/R4); the text
itself never leaves the browser's off-chain content store, and never enters the
agent payload.

```
46-year-old patient with moderate-to-severe chronic plaque psoriasis (BSA ~12%,
PASI 14). Documented inadequate response to an 8-week trial of methotrexate
(intolerance: transaminitis) and to topical high-potency corticosteroids.
No active infection; latent TB screen negative; hepatitis panel negative.
Prescriber requests coverage of adalimumab per step-therapy exception:
preferred conventional systemic therapy tried and failed. Filed as a Part D
formulary coverage exception with prior authorization.
```

## Request inputs (paste into the form)

| Field | Value | Notes |
|---|---|---|
| **Drug (RxNorm/NDC)** | `Adalimumab (RxNorm 1366724 / NDC 00074-3799-02)` | hashed to an opaque `drugRef` (bytes32) on-chain |
| **Public-evidence ref** | `https://api.fda.gov/drug/label.json?search=openfda.brand_name:HUMIRA` | openFDA label — indication: moderate-to-severe plaque psoriasis; hashed to an opaque ref |
| **Requested amount** | `5200` | the provider's billed amount |
| **Benchmark cap** | `4200` | NADAC / Cost Plus cap (see [`price-benchmarks.md`](./price-benchmarks.md)); set in the adjudication panel |

## Insurer policy (paste into the **Detail → Attach policy** textarea)

Use the **compliant** policy from [`formulary-part-d.json`](./formulary-part-d.json) /
[`formulary-part-d.html`](./formulary-part-d.html), or the
[`policy-noncompliant.md`](./policy-noncompliant.md) clause to demo the void
path. The Detail view ships both as one-click buttons.

## Expected paths

1. **File** the request as **Provider** with the justification + drug + evidence
   + requested amount above.
2. Switch profile to **Insurer**; in **Detail**, attach the **compliant** policy
   → state **Ready**.
3. **Request adjudication** (either party). Pick the simulated arbiter decision +
   benchmark cap:
   - **approve**, cap `4200` → **Approved**, `coveredAmount = min(5200, 4200) =
     4200` (deterministic min — R6a), with the cited clause shown.
   - **deny** → **Denied**, covered `0`.
   - **need_more_evidence** → **EvidenceRequested**; provider **submits evidence**
     → re-fires.
   - **policy_invalid** (or attach the non-compliant policy first) →
     **PolicyInvalidated** (terminal, R6b).
4. From **Approved/Denied**: both parties **accept** → **settle** (event marker,
   covered amount + 50/50 fee), OR **appeal** with new public evidence (re-fires,
   `round++`); at the round cap (default 3) without mutual accept →
   **Deadlocked**. OR the provider **refuses** the terms → **ProviderRefused**.

Amounts are unitless integers in v0 (a benchmark marker, not a token transfer —
R8). They are illustrative, not a real price for any product.
