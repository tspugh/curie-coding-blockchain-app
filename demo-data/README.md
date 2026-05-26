# demo-data — synthetic fixtures (SPEC-0001 §4)

Copy-pasteable, **synthetic** fixtures that drive the MVP0 flow. **None contain
PHI** (§7 puts PHI redaction and real-case generation out of scope; these stand
in). All prices are illustrative benchmark markers, not real prices.

| File | What it is | Used by |
|---|---|---|
| [`sample-case.md`](./sample-case.md) | A synthetic coverage-exception case: de-identified note + drug + price band + the positions/settlement that walk the flow. | Humans (copy/paste into **Create**) and the web app's **Load sample case** button. |
| [`formulary-part-d.json`](./formulary-part-d.json) | Published-Part-D-formulary-shaped coverage criteria + benchmark band, as JSON. | The **`JSON API Request`** agent path (R10) — a REST/JSON source. |
| [`formulary-part-d.html`](./formulary-part-d.html) | The same coverage criteria as a published-formulary web page. | The **`LLM Parse Website`** agent path (R10) — an HTML source. |

## How the agent uses these (R6/R10)

In **simulated** mode the ruling is mocked (the UI's verdict selector chooses
`approve | deny | need_more_evidence`), so no fixture is fetched. In
**real-wallet** mode the contract fires the native Somnia agent over the public
reference, selected by source type (R10):

- HTML source → `LLM Parse Website` with
  `ExtractString(options=["approve","deny","need_more_evidence"])`.
- JSON/REST source → `JSON API Request`.

The agent operates on the **dispute + the published formulary** — never on the
note text (only its hash is on-chain). The `benchmarkBand` here is the
`[priceFloor, priceCeil]` the contract enforces at settlement (R8).
