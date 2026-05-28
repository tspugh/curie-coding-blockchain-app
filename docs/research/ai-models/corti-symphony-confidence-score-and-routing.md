# Corti Symphony Confidence Score and Human-Review Routing Architecture

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Does Corti Symphony return a per-code confidence score enabling programmatic routing to human attestor review?

### Finding 1: Corti Symphony does NOT return a per-code numeric confidence score — confirmed from primary API documentation

- The Corti Symphony `/tools/coding/` endpoint response schema contains exactly five fields per code object: `system`, `code`, `display`, `evidences` (array of text spans with `contextIndex`, `text`, `start`, `end`), and `alternatives` (other codes considered but ranked lower). There is **no `confidence`, `probability`, `score`, or equivalent numeric field** in the code object.
  — [Corti API Docs: Code Prediction introduction](https://corti.mintlify.app/coding/introduction); [Corti developer guide](https://www.corti.ai/guides/a-developers-guide-to-integrating-medical-coding-capabilities)
- The API documentation explicitly confirms: "The response relies on the two-list distinction (`codes` vs. `candidates`) to signal the model's confidence level, rather than including explicit numerical scores within each code object."
  — [Corti API Docs: Code Prediction introduction](https://corti.mintlify.app/coding/introduction)
- The `codes` vs. `candidates` binary is the only confidence signal Symphony exposes publicly. `codes` = codes the model is confident should be billed given clinical context and coding guidelines; `candidates` = clinically present conditions that guidelines say should not be billed (e.g., signs/symptoms integral to a definitive diagnosis). This is an editorial distinction, not a numeric probability.
  — [Corti developer guide](https://www.corti.ai/guides/a-developers-guide-to-integrating-medical-coding-capabilities)

### Finding 2: Structural confidence proxies exist within Symphony's response — usable but not equivalent to a calibrated confidence score

- The `evidences` array provides indirect confidence proxies: (a) number of distinct evidence spans per code (more spans = more documentation support), (b) `alternatives` array length (a long alternatives list signals the model was uncertain among similar codes), and (c) absence of alternatives (single-candidate selection signals high certainty). None of these are calibrated probability estimates.
  — [Corti developer guide](https://www.corti.ai/guides/a-developers-guide-to-integrating-medical-coding-capabilities); [Corti: introducing Symphony](https://www.corti.ai/stories/introducing-symphony-for-medical-coding)
- The written justification returned alongside each code (per the developer guide: "a written justification for why the code was included or excluded") includes textual certainty markers (e.g., "confirmed," "suspected," "ruled out") that could be parsed by the off-chain routing agent using NLP — but this is unstructured text, not a machine-readable field.
  — **WEAKLY SOURCED** — inferred from developer guide description; no API schema documentation for the justification text field format.

### Finding 3: Industry analogues (AKASA) demonstrate confidence-score-based routing as standard practice — but treat it as a product-layer feature, not a raw API field

- AKASA's Coding Optimizer product surfaces "AI confidence level" per suggestion in its dashboard, allows prioritization by confidence, and routes low-confidence cases to human-in-the-loop reviewers. Every AI suggestion is accompanied by "a confidence level that indicates the algorithm's confidence in that answer."
  — [AKASA Coding Optimizer](https://akasa.com/solutions/coding-optimizer/); [AKASA: How machine learning is expanding automation](https://akasa.com/blog/how-machine-learning-and-human-in-the-loop-approaches-are-expanding-automation-capabilities-a-techcrunch-talk/)
- AKASA does **not** expose these confidence scores via a public API documented externally. The confidence signal is surfaced in the SaaS product UI, not as a raw float in an API response. No public threshold value is documented.
  — **WEAKLY SOURCED** — absence of public API docs confirmed by site inspection; AKASA is API-partnered, not API-first.
- AWS Comprehend Medical's InferICD10CM API (a general-purpose NLP tool, not a coding-specialist system) returns a `Score: Float` field (0.0–1.0) per detected ICD-10-CM concept, demonstrating that numeric confidence is technically feasible in the coding API domain.
  — [AWS Comprehend Medical: InferICD10CM API reference](https://docs.aws.amazon.com/comprehend-medical/latest/api/API_InferICD10CM.html); [AWS CLI: infer-icd10-cm](https://docs.aws.amazon.com/cli/latest/reference/comprehendmedical/infer-icd10-cm.html)
- No other major specialist coding AI vendor (Fathom, CodaMetrix, Nym Health, Iodine Software) publicly documents per-code confidence scores in their API response schemas. Confidence is treated as an internal model property that drives routing decisions within vendor-operated platforms, not a field exposed to integration partners.
  — **WEAKLY SOURCED** — absence of public API documentation confirmed by inspection of public-facing developer resources.

### Finding 4: Clinical AI coding literature treats confidence thresholds as configurable system-level parameters, not per-code fields

- Systematic review of AI ICD-10 coding (PMC12373374, 2026) does not discuss per-code confidence fields in deployed systems, focusing instead on F1 accuracy and explainability frameworks. The implication: confidence scoring is not yet standardized as an interoperability concern.
  — [PMC: Systematic Review of AI ICD coding](https://pmc.ncbi.nlm.nih.gov/articles/PMC12373374/)
- Practitioner guidance (BillingParadise, 2025) and AWS implementation guidance recommend "adjusting confidence cutoffs, specificity prompts, and routing logic based on early findings" — treating threshold calibration as a deployment-time activity, not a static vendor-specified value.
  — [BillingParadise: AI + Human Hybrid Medical Coding 2026](https://www.billingparadise.com/blog/medical-ai-coding-hybrid-model-q3-2025/)

### Summary: Design implications for cliqueue routing architecture

| Signal available from Symphony | Machine-readable? | Calibrated probability? | Recommended use |
|---|---|---|---|
| `codes` vs. `candidates` binary | Yes | No | Gate: `candidates` → always human review |
| `evidences` count per code | Yes (integer) | No | Proxy: evidences < N → flag for review |
| `alternatives` array length | Yes (integer) | No | Proxy: alternatives ≥ M → flag for review |
| Written justification text | No (unstructured) | No | Human readable only |
| No `confidence` float field | N/A | N/A | Not available |

**Design implication:** cliqueue's off-chain routing agent cannot rely on a numeric confidence score from Symphony — that field does not exist. The routing decision must use (a) the `codes`/`candidates` split as the primary gate, (b) structural proxies (`evidences` count, `alternatives` length) as secondary signals, and (c) the mandatory `claimType == inpatient` rule (from prior research) as the hardcoded override for inpatient DRG claims. A configurable threshold approach requires cliqueue to define and calibrate its own scoring heuristic combining these structural signals — this is non-trivial and should be an explicit feature of the off-chain agent specification rather than an assumed API capability. The contract field `requiresHumanAttestation` remains binary (bool), with off-chain routing logic determining when to set it to `true`.

**Open questions generated:**
1. Should cliqueue define a formal `CodingConfidenceHeuristic` specification — a weighted scoring function over `evidences.length`, `alternatives.length`, and `inCandidatesArray` — and publish it as a testable TypeScript module in the off-chain agent spec, so hospital deployments can calibrate thresholds against their own code mix?
2. Is there a published calibration dataset (labeled confidence vs. human-override frequency) for Symphony codes that would let cliqueue validate whether `evidences < 2` or `alternatives >= 3` actually correlates with human coder disagreement rates?
3. Should cliqueue request per-code confidence scores from Corti as a feature request or enterprise API addition — and is this a negotiating point in the enterprise BAA/contract process?

---

**See also** — [[../topics/corti|Corti hub]]
