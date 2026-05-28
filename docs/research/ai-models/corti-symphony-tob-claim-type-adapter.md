# Corti Symphony TOB/Claim-Type Adapter — System Array Selection and MCP Interface

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Does Corti Symphony's MCP interface surface the claim category/TOB distinction — does the hospital pass `claimType` to Symphony, or must cliqueue's adapter infer it from the clinical note type — and does Symphony return ICD-10-PCS codes for inpatient vs. CPT codes for outpatient based on claim type?

### Finding 1: Symphony does NOT accept a TOB or claim_type field — the caller specifies code systems explicitly via a `system` array

- The Corti Symphony coding endpoint (`POST /v2/tools/coding/`) accepts a `system` array whose values select which code systems to return. Confirmed system values are: `"icd10cm-inpatient"` (inpatient diagnoses), `"icd10cm-outpatient"` (outpatient diagnoses), `"icd10pcs"` (inpatient procedure codes), and `"cpt"` (outpatient procedure codes). A single request can include up to four systems simultaneously.
  — [Corti CDI documentation](https://corti.mintlify.app/coding/cdi); [Corti developer guide](https://www.corti.ai/guides/a-developers-guide-to-integrating-medical-coding-capabilities)
  — Assessment: High confidence. System parameter values confirmed from Corti's own CDI documentation with explicit examples.

- There is no `type_of_bill`, `tob`, `claim_type`, `care_setting`, or equivalent field in the Symphony request body. The caller controls the inpatient/outpatient distinction entirely by choosing which `system` values appear in the request array. Symphony does not infer care setting from the clinical note text.
  — [Corti developer guide](https://www.corti.ai/guides/a-developers-guide-to-integrating-medical-coding-capabilities)
  — Assessment: High confidence. Absence of TOB field confirmed across multiple documentation sources and CDI workflow guides.

- The request body structure is: `{ "system": ["icd10cm-inpatient", "icd10pcs"], "context": [{ "type": "text", "text": "<clinical note>" }] }`. For outpatient, the caller substitutes `["icd10cm-outpatient", "cpt"]`.
  — [Corti CDI documentation](https://corti.mintlify.app/coding/cdi)
  — Assessment: High confidence from CDI documentation.

### Finding 2: Cliqueue's 837I adapter is the authoritative layer that maps TOB → Symphony `system` array — this is a required adapter responsibility

- In the 837I institutional claim format (X12 v5010A2), the Type of Bill (TOB) second digit distinguishes inpatient (TOB 11X, second digit "1") from outpatient (TOB 13X, 22X, second digit "3" or "2"). The adapter that produces the on-chain `claimId` already processes the 837I and has the TOB field. It must use TOB to populate the Symphony `system` array before forwarding the clinical note.
  — Cross-reference: [docs/research/agreement-layer/edi-837-835-flow-and-blockchain-adjudication.md](../agreement-layer/edi-837-835-flow-and-blockchain-adjudication.md); [docs/research/market/claimtype-enum-on-chain-enforcement-inpatient-outpatient.md](../market/claimtype-enum-on-chain-enforcement-inpatient-outpatient.md)
  — Assessment: High confidence — EDI TOB field positions are well-documented CMS requirements.

- The recommended mapping: TOB second digit "1" (inpatient) → `system: ["icd10cm-inpatient", "icd10pcs"]`; TOB second digit "3" or "2" (outpatient/SNF outpatient) → `system: ["icd10cm-outpatient", "cpt"]`. The adapter sets `claimType = INPATIENT` or `OUTPATIENT` in the on-chain submission based on the same TOB second digit — making the on-chain `claimType` and the Symphony `system` array derivations consistent from a single authoritative source.
  — Assessment: High confidence architectural inference from confirmed EDI spec and Symphony API behavior.

- **Implication for the adapter spec**: The 837I adapter is responsible for two parallel derivations from the same TOB field: (a) the Symphony `system` array (off-chain, controls which code systems Symphony returns) and (b) the `claimType` uint8 (on-chain, controls `requiresHumanAttestation` enforcement at `ClaimsAdjudicator`). These must be kept in sync — a misconfigured adapter that passes `system: ["icd10cm-outpatient", "cpt"]` but submits `claimType = INPATIENT` on-chain would request wrong code types from Symphony for an inpatient claim, creating a regulatory compliance gap.

### Finding 3: Symphony returns ICD-10-PCS for inpatient procedure codes and CPT for outpatient — these are distinct non-overlapping code systems, not a configurable output format

- ICD-10-PCS codes are valid exclusively for inpatient facility claims (UB-04/837I TOB 11X series); CPT/HCPCS codes are used for outpatient facility and professional claims. Symphony enforces this distinction by requiring separate `system` values (`"icd10pcs"` vs. `"cpt"`) rather than returning both in a unified code namespace.
  — [CMS: ICD-10 overview](https://www.cms.gov/medicare/coding-billing/icd-10-codes); [Corti developer guide](https://www.corti.ai/guides/a-developers-guide-to-integrating-medical-coding-capabilities)
  — Assessment: High confidence. This distinction is established CMS billing policy, confirmed in Symphony's code system support documentation.

- Including `"icd10pcs"` in the system array for an outpatient claim (or `"cpt"` for an inpatient claim) would produce incorrect or empty code sets. The adapter must never mix these pairs.
  — Assessment: High confidence inference from Symphony's documentation and CMS coding policy.

### Finding 4: Symphony's MCP interface for multi-agent systems passes the `system` array as part of the tool call — cliqueue's orchestrator agent must construct this array before dispatching to Symphony

- Symphony supports both direct REST API calls and MCP tool calls via Corti's Agents Library (launched February 2026 with "full A2A and MCP standard compatibility"). When invoked as an MCP tool from cliqueue's off-chain orchestrator agent, the `system` array parameter is passed as a tool input argument — not auto-negotiated between the MCP server and client.
  — [Corti: Introducing Symphony for Medical Coding](https://www.corti.ai/stories/introducing-symphony-for-medical-coding); [SiliconANGLE: Corti Agentic Framework](https://siliconangle.com/2026/02/03/corti-launches-multi-agent-ai-framework-healthcare/)
  — Assessment: High confidence. MCP tool calls pass parameters as structured inputs; the `system` array is a required input parameter per the documented request schema.

- The orchestrator agent in cliqueue's off-chain pipeline must: (1) extract TOB from the incoming 837I, (2) derive `system` array, (3) invoke Symphony MCP tool call with the clinical note + system array, (4) receive the code array + evidences, (5) compute `icd10CodeHash`, and (6) submit on-chain with the matching `claimType`. Steps (2) and (6) must derive from the same TOB value.
  — Assessment: Architectural inference from confirmed API behavior and prior research.

### Finding 5: No TOB-to-system mapping has been published by Corti — cliqueue must define and document this mapping as part of its adapter specification

- Corti's public documentation addresses the `system` parameter values but does not publish a mapping table from TOB codes (or equivalent billing fields) to `system` values. This is not a Corti responsibility — it falls to the integration layer (cliqueue's adapter) to implement and test this mapping.
  — [Corti developer guide](https://www.corti.ai/guides/a-developers-guide-to-integrating-medical-coding-capabilities); [Corti CDI documentation](https://corti.mintlify.app/coding/cdi)
  — Assessment: High confidence absence finding. The mapping is an integration responsibility, not a Symphony API feature.

- A TOB second-digit mapping is well-defined and stable (CMS last updated UB-04 TOB guidance in 2022; no changes since). The mapping has two clean cases for acute inpatient hospital (TOB 11X) and outpatient hospital (TOB 13X, 14X), with additional TOB categories (skilled nursing outpatient, home health, etc.) requiring their own classification.
  — [CMS: UB-04 Form Locator guidance](https://www.cms.gov/files/document/837i-form-cms-1450-mln006926.pdf)
  — Assessment: High confidence.

**Design implication:** cliqueue's 837I adapter specification must include an explicit `TOB_TO_SYMPHONY_SYSTEM` mapping table (published in the off-chain agent spec) that derives the Symphony `system` array and the on-chain `claimType` from the same TOB second-digit value. This mapping must be tested as a unit-testable TypeScript function (e.g., `mapTobToSystemArray(tob: string): SymphonySystem[]`) before any hospital integration. The on-chain `claimType` and the Symphony `system` array selection must always be derived from the same TOB value to prevent regulatory mismatches. If the adapter encounters an unsupported TOB category (e.g., home health, hospice), it should throw a `TOBNotSupportedError` and halt submission rather than defaulting to outpatient — preventing silent miscategorization.

**Open questions generated:**
1. Should cliqueue's off-chain agent spec formally define a `TOB_TO_SYMPHONY_SYSTEM` mapping table as a standalone TypeScript constant and publish it in the adapter spec — so hospital integration engineers can verify and extend it for non-standard TOB categories (home health, hospice, swing bed) without touching the contract layer?
2. Does Symphony's CDI endpoint (Clinical Documentation Integrity) use the same `system` array parameter as the standard coding endpoint, enabling cliqueue to use the same adapter function for both pre-encounter CDI queries and final claim coding?
3. If a hospital submits a mixed-category 837I batch (both inpatient and outpatient claims in one file), should cliqueue's adapter split the batch by TOB category and make separate Symphony calls per claim, or can Symphony process a multi-system request with `system: ["icd10cm-inpatient", "icd10pcs", "icd10cm-outpatient", "cpt"]` for all claims simultaneously — and does the response correctly label each code by its source system?

---

**See also** — [[../topics/corti|Corti hub]] · [[../topics/x12|X12 hub]]
