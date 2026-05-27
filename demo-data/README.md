# demo-data — synthetic fixtures (SPEC-0001 §4)

Copy-pasteable, **synthetic** fixtures that drive the MVP0 AI necessity-arbiter
flow. **None contain PHI** (§7 puts PHI redaction and real-case generation out of
scope; these stand in). All prices are illustrative public-benchmark markers, not
real prices.

| File | What it is | Used by |
|---|---|---|
| [`sample-case.md`](./sample-case.md) | A synthetic coverage-exception case: de-identified justification + drug (RxNorm/NDC) + public-evidence URL + requested amount + benchmark cap, with the expected paths. | Humans (copy/paste into **File request**) and the web app's **Load sample case** button. |
| [`formulary-part-d.json`](./formulary-part-d.json) | The insurer's published **Part D exception-criteria policy** (compliant) + benchmark cap, as JSON, with named clause refs. | The **`JSON API Request`** agent path (R10) — a REST/JSON source. The insurer **attaches** this (hash on-chain, body here) before adjudication (R5). |
| [`formulary-part-d.html`](./formulary-part-d.html) | The same compliant policy as a published web page. | The **`LLM Parse Website`** agent path (R10) — an HTML source. |
| [`policy-noncompliant.md`](./policy-noncompliant.md) | A policy clause (PD-ADA-09) that **contradicts the FDA-approved label indication**. | Drives **`PolicyInvalidated`** (R6b) — the void path. Loaded via the Detail view's "Load NON-compliant policy" button. |
| [`price-benchmarks.md`](./price-benchmarks.md) | The **NADAC + Mark Cuban Cost Plus** price refs that back the deterministic `min(requested, cap)`. | The covered-amount cap input (R6a/R10). |

## On-chain / off-chain boundary

The justification note, the cited public evidence, and the insurer's policy body
all stay **off-chain** (or at their public URLs). Only **hashes + opaque refs**
cross to the chain (R3/R4): `justificationHash`, `drugRef`, `evidenceUri`,
`policyHash`, `policyUri`, plus amounts, the ruling decision + cited `clauseRef` +
`rationaleHash`, round, accept flags, covered amount + fee split, and state. **No
PHI and no raw content ever go on-chain or into the agent payload.**

## How the agent uses these (R5/R6/R6a/R6b/R10)

In **simulated** mode the ruling is mocked — the Detail view's **decision
selector** chooses `approve | deny | need_more_evidence | policy_invalid` and the
**benchmark-cap** input sets the deterministic `min()` cap — so no fixture is
fetched. In **real-wallet** mode the contract fires the native Somnia agent over
the public references, selected by source type (R10):

- **HTML** source → `LLM Parse Website` with
  `ExtractString(options=["approve","deny","need_more_evidence"])`.
- **JSON / REST** source → `JSON API Request`.

The agent **weighs the provider's cited public evidence against the insurer's
attached policy** and cites the `clauseRef` it relies on (R6). On `approve` the
**contract** computes `coveredAmount = min(requestedAmount, benchmarkCap)` from
[`price-benchmarks.md`](./price-benchmarks.md) (R6a) — the agent never sets the
amount. If a relied-on clause contradicts the cited public standard (the openFDA
label), the agent flags it and the contract voids the request — driven by
[`policy-noncompliant.md`](./policy-noncompliant.md) (R6b).
