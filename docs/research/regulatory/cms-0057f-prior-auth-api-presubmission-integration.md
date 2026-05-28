# CMS-0057-F Prior Authorization API: Pre-Submission Integration Opportunity

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-17 — Does CMS-0057-F Prior Authorization FHIR API create an actionable pre-submission prior-auth check integration for cliqueue's hospital agent — reducing claim denials before anchoring on-chain?

**Question investigated:** The CMS-0057-F Prior Authorization FHIR API (mandatory for impacted payers by January 1, 2027) exposes a machine-queryable payer endpoint for prior authorization requirements. Does this create a viable pre-submission workflow for cliqueue's hospital agent — querying payer PA requirements via FHIR before anchoring the claim hash on-chain — and what are the scope, technical mechanism, and denial-reduction implications?

---

### Finding 1: CMS-0057-F mandates a Prior Authorization API for MA, Medicaid, CHIP, and QHP payers — traditional Medicare FFS is explicitly excluded

- The rule's impacted payers are: Medicare Advantage (MA) organizations, state Medicaid and CHIP Fee-for-Service programs, Medicaid managed care plans, CHIP managed care entities, and Qualified Health Plan (QHP) issuers on the Federally Facilitated Exchanges. Traditional Medicare fee-for-service is **not included**.
  - Source: [CMS-0057-F fact sheet](https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f)
  - Assessment: High confidence — primary CMS source.

- By January 1, 2027, impacted payers must implement a Prior Authorization API that: (a) lists covered items and services requiring prior authorization, (b) identifies payer documentation requirements for those services, and (c) supports electronic prior authorization request and response. Faster turnaround requirements begin January 1, 2026.
  - Source: [CMS-0057-F fact sheet](https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f)
  - Assessment: High confidence.

- Since cliqueue Phase 1 already enforces a **MA exclusion gate** (blocked payer IDs for MA risk-adjustment claims under OIG enforcement risk), the January 2027 PA API applies primarily to **commercial MA products, Medicaid managed care, and QHP plans** — not the MA risk-adjustment subset already blocked. This creates an integration opportunity specifically for the MA commercial-product and Medicaid claim types that cliqueue does not block.
  - Assessment: Design inference — high confidence.

---

### Finding 2: The technical mechanism is CDS Hooks (Coverage Requirements Discovery), not a simple REST endpoint

- The Da Vinci CRD (Coverage Requirements Discovery) IG v2.1.0 defines how providers query payer PA requirements. The mechanism is **CDS Hooks** — when a provider orders a procedure in their EHR, the EHR fires a CDS Hook to the payer's CRD endpoint. The payer returns a card with: coverage status (`covered | not-covered | conditional`), PA status (`no-auth | auth-needed | satisfied | performpa | conditional`), and documentation requirements. **CORRECTION (2026-05-17):** The `coveragePaDetail` ValueSet in CRD STU2.1 defines five paStatus codes — the prior entry omitted `conditional` ("cannot determine PA requirement without more specific order detail"). See [ValueSet/coveragePaDetail](https://hl7.org/fhir/us/davinci-crd/STU2.1/ValueSet-coveragePaDetail.html) and [docs/research/regulatory/cds-hooks-typescript-client-crd-v2-1.md](cds-hooks-typescript-client-crd-v2-1.md).
  - Source: [Da Vinci CRD IG v2.1.0](https://hl7.org/fhir/us/davinci-crd/STU2.1/)
  - Source: [Firely CRD explainer](https://fire.ly/blog/prior-authorization-with-crd-explained/)
  - Assessment: High confidence — IG is primary source; explainer is secondary synthesis.

- CRD is **not a static machine-readable list**. It operates dynamically per-patient, per-service, per-payer — answering "does this specific service for this specific patient's plan require PA?" The payer's CRD endpoint receives patient coverage context (patient identity, procedure code, diagnosis codes, performer/location) and returns a patient-specific PA requirement determination.
  - Source: [ONC CRD test method](https://healthit.gov/test-method/provider-prior-authorization-api-coverage-requirements-discovery/)
  - Assessment: High confidence — ONC test method is a regulatory primary source.

- The CRD → DTR → PAS three-step workflow: CRD checks whether PA is required; DTR (Documentation Templates and Rules) populates documentation; PAS (Prior Authorization Support) submits and tracks the authorization. CRD can return a `satisfied-pa-id` (an X12 prior authorization number) that flows into the claim.
  - Source: [Itirra CMS-0057-F integration guide](https://itirra.com/blog/cms-0057-f-prior-authorization-rule-fhir-api-integration-strategy/)
  - Assessment: Medium confidence — secondary synthesis, consistent with IG structure.

- CRD uses **procedure codes and diagnosis codes** in the CDS Hook context (the provider sends the ordered service with CPT/HCPCS and ICD-10 diagnosis codes). This means cliqueue's hospital agent, having already coded ICD-10 codes via Corti Symphony, has the input needed to fire a CRD query before anchoring the claim hash on-chain.
  - Assessment: Design inference from CRD IG inputs — high confidence.

---

### Finding 3: The prior-auth denial problem is significant and coding-related mismatches amplify it

- 31% of physicians report prior authorization requests are often or always denied (2025 AMA survey). Denial rates for MA: 7.7% in 2024, up from 6.4% in 2023 (53 million determinations). Traditional Medicare CMS denied ~143,000 PA requests in 2024 (23% denial rate).
  - Source: [2025 AMA Prior Authorization Physician Survey](https://www.ama-assn.org/system/files/prior-authorization-survey.pdf)
  - Source: [KFF Medicare Advantage PA 2024](https://www.kff.org/medicare/medicare-advantage-insurers-made-nearly-53-million-prior-authorization-determinations-in-2024/)
  - Assessment: High confidence — AMA and KFF are primary research sources.

- A critical failure mode is **PA number + diagnosis code mismatch** at claim submission: if the ICD-10 codes on the 837 claim differ from those submitted in the PA request, the claim is denied (CO-15: missing/invalid authorization number; CO-4: code inconsistency). Payer authorization-to-claim matching logic has tightened in 2025 (UHC specifically noted).
  - Source: [Medical Billers and Coders denial patterns 2026](https://www.medicalbillersandcoders.com/blog/payer-specific-denial-patterns/)
  - Assessment: Medium confidence — trade press, no primary data on frequency.

- Among appealed PA denials, 81.7% were fully or partially overturned — indicating many initial denials are incorrectly made. This supports value in pre-submission PA checks.
  - Source: [AMA 2025 PA survey](https://www.ama-assn.org/system/files/prior-authorization-survey.pdf)
  - Assessment: High confidence.

---

### Finding 4: High-volume PA specialties most relevant to cliqueue's hospital agent workflow

- Highest PA burden by specialty: orthopedics (joint replacement, spine surgery, therapeutic injections), imaging/radiology (MRI, CT, PET — often the highest volume), interventional cardiology, and pain management. These are also among the highest-value facility claims (inpatient DRG for joint replacement, outpatient for imaging).
  - Source: [SVAST health PA specialties 2025](https://www.svasthealthtech.com/why-prior-authorization-is-slowing-down-these-medical-specialties-in-2025/)
  - Source: [DataMatrix Medical orthopedic PA](https://datamatrixmedical.com/do-you-need-prior-authorization-for-orthopedic-visits/)
  - Assessment: Medium confidence — trade press; consistent across multiple sources.

- UHC removed prior auth requirements for certain nuclear imaging, obstetrical ultrasound, and echocardiogram procedures effective January 1, 2026. This signals payer-level dynamic changes to PA requirement lists — reinforcing why a per-patient dynamic CRD query (not a static list) is the correct architecture.
  - Source: [UHC provider news 2025](https://www.uhcprovider.com/en/resource-library/news/2025/removal-prior-auth-radiology-cardiology.html)
  - Assessment: High confidence — primary source (UHC provider portal).

---

### Finding 5: Integration architecture and cliqueue-specific constraints

- For cliqueue's hospital agent, the CRD check should occur **after** Corti Symphony codes ICD-10 codes (so the agent has the diagnosis codes to pass to CRD) but **before** the claim hash is anchored on-chain (so a PA-required-but-not-obtained determination halts the on-chain commitment until PA is satisfied).
  - Assessment: Design inference — high confidence given the agent workflow.

- cliqueue does NOT need to implement CRD itself — the payer implements the CRD server; cliqueue's agent is the **CRD client**. The agent fires CDS Hooks to the payer's endpoint. This is an outbound HTTP call from the hospital agent, not an inbound API requirement for cliqueue.
  - Assessment: High confidence from CRD IG architecture.

- CRD endpoints will be available from MA, Medicaid, and QHP payers by January 2027. The implementation burden on cliqueue is building a CDS Hooks client library in TypeScript that fires `order-sign` hooks with patient/coverage/procedure context and parses the Coverage Information extension response.
  - Assessment: Design inference — high confidence.

- Traditional Medicare FFS PA is excluded from CMS-0057-F. For traditional Medicare claims, cliqueue's agent would need to use a different mechanism (X12 278 PA request or CMS-specific APIs if available) — or explicitly flag "PA check not available for this payer type" and defer to manual workflow.
  - Assessment: High confidence — primary CMS source confirmed exclusion.

---

**Design implication:** cliqueue's hospital agent should implement a CRD client as an optional pre-submission step: after Corti Symphony codes the claim (ICD-10 + CPT/HCPCS available), fire a CDS Hooks CRD query to the payer's CRD endpoint; if `auth-needed` is returned, pause the on-chain commitment and trigger a PAS submission workflow before anchoring. This would directly reduce CO-15 and coding-mismatch denials for MA, Medicaid, and QHP claims, creating a measurable denial-reduction ROI story. The January 2027 deadline means this feature is not available for MVP launch but becomes available for the first production hospital deployments targeting MA/Medicaid payers. Traditional Medicare FFS claims cannot use CRD and require manual PA workflows.

**Open questions generated:**
1. Should cliqueue's `ClaimSubmittedEvent` include a `paStatus` field (`bytes1`: `NO_AUTH = 0x00`, `AUTH_NEEDED = 0x01`, `SATISFIED = 0x02`, `NOT_CHECKED = 0xFF`) anchored on-chain alongside the claim hash — creating an immutable audit record of whether a PA check was performed before anchoring?
2. For the CRD client in cliqueue's TypeScript hospital agent, which CDS Hooks library should be used (`@cds-hooks/client` npm package or a hand-rolled implementation) — and does any existing TypeScript CDS Hooks client library support the `order-sign` hook with the Coverage Information extension required by CRD?
3. Should cliqueue define a `payerCRDEndpoint` field in the hospital onboarding checklist (payer-specific CRD URL, discoverable via the payer's FHIR capability statement) — so hospital integration engineers have a structured workflow for registering payer CRD endpoints before first claim submission, rather than relying on manual lookup?

---

**See also** — [[../topics/prior-auth|PA hub]] · [[../topics/x12|X12 hub]]
