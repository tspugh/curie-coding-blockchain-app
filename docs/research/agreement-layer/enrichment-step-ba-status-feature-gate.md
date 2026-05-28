# Enrichment Step BA Status and Hard Feature Gate

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — If cliqueue adds an enrichment step to the dispute-listener (looking up the hospital's EDI mapping to include CLM01 in the payer webhook payload), does that single addition transform cliqueue from not-a-BA to a BA requiring a full executed BAA — and should this be documented as a hard feature gate in the product spec?

### Context

Prior research (docs/research/somnia/dispute-listener-middleware-deployment-baa-obligations.md) established that the dispute-listener in Architecture A (cliqueue-operated, fires only `{ claimId: bytes32, disputeWindowEnd, contractAddress }` to the payer webhook) does NOT create BA status for cliqueue, because it processes only cryptographic hashes and wallet addresses — not PHI. The open question is whether adding an enrichment step — querying the hospital's off-chain `(claimId → CLM01)` PostgreSQL store to look up the claim reference and include it in the payer notification — would constitute PHI access and trigger BA status.

---

### Finding 1: CLM01 (patient control number) is an enumerated HIPAA identifier — accessing the mapping store is accessing PHI

- The HIPAA Safe Harbor de-identification standard (45 CFR §164.514(b)(2)) enumerates "account numbers" as one of the 18 identifiers that must be removed to de-identify PHI. "Account numbers" under this standard include hospital-assigned patient account numbers, billing account numbers, and hospital-assigned claim reference numbers (CLM01 / patient control number). The CLM01 field in the X12 837 EDI transaction is formally defined as "Patient Control Number" and contains the provider's patient account number.
  — [HIPAA Safe Harbor De-identification Standard: 45 CFR §164.514(b)(2)](https://www.law.cornell.edu/cfr/text/45/164.514)
  — [HHS OCR De-identification Guidance (2012)](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html)
  — [18 HIPAA Identifiers: Compliancy Group](https://compliancy-group.com/18-hipaa-identifiers-for-phi/)
  — Assessment: High confidence. "Account numbers" is unambiguously listed; CLM01 as a patient account number falls within this category. The mapping store entry `(claimId → CLM01)` contains one enumerated HIPAA identifier (CLM01) combined with a claimId that links to health care service data on-chain. The combination is PHI.

- Important nuance: the `claimId → CLM01` mapping alone, without the associated individual's name, date of birth, or other identifiers, is borderline. However, in the context of the hospital's billing system, CLM01 is routinely linked (in the same database row or adjacent records) to patient name, date of service, and diagnosis codes. The off-chain PostgreSQL store — even if it contains only the two-column `(claimId, CLM01)` table — is embedded in a hospital IT environment where re-linking to the full patient record is trivial. OCR's de-identification guidance requires that the covered entity have "no actual knowledge" that the residual information could be used to identify an individual; no hospital can credibly make that claim for its own internal claim reference numbers.
  — [HHS OCR FAQ 256](https://www.hhs.gov/hipaa/for-professionals/faq/256/is-software-vendor-business-associate/index.html): "A software company that hosts the software containing patient information on its own server or accesses patient information when troubleshooting the software function is a business associate of a covered entity."
  — Assessment: High confidence for BA status trigger; medium confidence on the precise PHI classification of a standalone `claimId → CLM01` two-column table without other identifiers (this is a fact-specific determination hospital counsel must confirm).

---

### Finding 2: A single enrichment query to the hospital's mapping store triggers BA status immediately under HHS OCR FAQ 256

- The controlling HHS OCR authority (FAQ 256) applies a two-sided rule: (a) a software vendor that merely sells software and does not access patient information is NOT a BA; (b) a software vendor that "accesses patient information when troubleshooting the software function" or "hosts the software containing patient information" IS a BA. The enrichment query is a programmatic "access" to patient information in the hospital's data system, performed "on behalf of" the covered entity (the hospital) to facilitate a function (payer dispute notification) that is part of the covered entity's payment operations.
  — [HHS OCR FAQ 256](https://www.hhs.gov/hipaa/for-professionals/faq/256/is-software-vendor-business-associate/index.html)
  — Assessment: High confidence as legal principle; not a substitute for legal opinion.

- "On behalf of" in the BA definition (45 CFR 160.103) covers any function or activity regulated by HIPAA, including "claims processing or administration" and "payment." A dispute notification that references a specific CLM01 to facilitate the payer's internal claims reconciliation is a payment-adjacent function — it falls squarely within the BA-triggering function categories.
  — [45 CFR 160.103 Business Associate definition](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-160/subpart-A/section-160.103)
  — [Accountable HQ: Business Associate Definition Guide](https://www.accountablehq.com/post/business-associate-definition-hipaa-what-it-means-and-who-qualifies)
  — Assessment: High confidence.

- **Conclusion on BA status trigger:** Yes — adding a single enrichment query to the hospital's off-chain mapping store (to retrieve CLM01 and include it in the payer webhook payload) transforms cliqueue from not-a-BA to a BA. The trigger is the moment cliqueue's service touches the hospital's PHI-containing data system, regardless of whether the individual query returns a value that itself looks like PHI in isolation.

---

### Finding 3: A BAA must be executed BEFORE the enrichment feature is enabled for any hospital — this is a regulatory requirement, not a best practice

- HIPAA requires a covered entity to enter into a Business Associate Agreement BEFORE disclosing PHI to a business associate. The HIPAA Privacy Rule (45 CFR §164.504(e)) states that a covered entity may not disclose PHI to a business associate unless a satisfactory assurance in the form of a written BAA is in place. Violating this sequence (enabling access before the BAA is signed) is a direct HIPAA violation by the covered entity (the hospital), and cliqueue's product cannot facilitate a hospital HIPAA violation by design.
  — [45 CFR §164.504(e)](https://www.law.cornell.edu/cfr/text/45/164.504)
  — [HIPAA Journal BAA Guide 2026](https://www.hipaajournal.com/hipaa-business-associate-agreement/)
  — [Medcurity BAA Requirements Guide](https://medcurity.com/hipaa-business-associate-agreement-requirements/)
  — Assessment: High confidence. "Both parties must sign the BAA before any PHI is shared" is consistent across all primary and secondary sources reviewed.

- Industry practice for SaaS vendors confirms: a BAA must be in place "before handling live PHI" and features that access PHI should not reach customers without the agreement as a prerequisite.
  — [Accountable HQ: HIPAA Compliance for SaaS Companies](https://www.accountablehq.com/post/hipaa-compliance-for-saas-companies-requirements-baa-and-step-by-step-checklist)
  — Assessment: High confidence as industry consensus.

---

### Finding 4: The enrichment feature also creates a BAA scope-change obligation for hospitals that have already deployed cliqueue under a non-BA configuration

- For hospitals that deployed cliqueue's dispute-listener under Architecture A (no PHI access, no BAA required), enabling the enrichment feature retroactively creates a BA relationship. The hospital must execute a new BAA with cliqueue before enabling the enrichment. HIPAA guidance consistently requires BAA updates "whenever the scope of services changes" — specifically when a vendor "implements a new product feature or service enhancement that affects PHI access."
  — [Medcurity BAA Requirements Guide](https://medcurity.com/hipaa-business-associate-agreement-requirements/)
  — [HIPAA Journal BAA Guide](https://www.hipaajournal.com/hipaa-business-associate-agreement/)
  — Assessment: High confidence.

- Under the proposed 2026 HIPAA Security Rule NPRM (not yet finalized as of May 2026, target publication May 2026), hospitals would additionally be required to obtain annual written verification that BAs have deployed required technical safeguards. If the enrichment feature makes cliqueue a BA for any hospital, that hospital must incorporate cliqueue into its annual BA verification process under the proposed rule.
  — [RubinBrown: HIPAA Security Rule Changes 2025–2026](https://www.rubinbrown.com/insights-events/insight-articles/hipaa-security-rule-changes-2025-2026-hipaa-updates/)
  — [HHS HIPAA Security Rule NPRM Fact Sheet](https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html)
  — Assessment: Medium confidence (NPRM not finalized; content from trade press and OCR fact sheet).

---

### Finding 5: The enrichment feature is architecturally distinct from Architecture B and creates different risk profiles

- Architecture B (hospital-self-hosted listener) accesses the hospital's EDI mapping store INSIDE the hospital's own network, operated by the hospital itself. In that configuration, the hospital is its own covered entity operating its own systems — no BA relationship with cliqueue is created because cliqueue does not run the code or access the data. The enrichment code runs on the hospital's infrastructure; cliqueue merely provides the open-source module.
  — [Mirth Connect precedent: hospital-self-hosted with no remote vendor access does not require BAA (NextGen)](https://mirth.support/mirth-connect-guide)
  — Assessment: High confidence as analogous pattern.

- Architecture A with enrichment (cliqueue-operated, queries hospital mapping store remotely) is a fundamentally different architecture from Architecture B. The BA risk is entirely attributable to cliqueue operating the enrichment function on behalf of the hospital — not to the enrichment function itself. This distinction must be made explicit in the product spec to prevent Architecture A and Architecture B from being conflated in procurement conversations.

---

### Finding 6: Practical industry precedent — EHR AI feature additions as the closest analogy

- A directly analogous scenario is documented in industry guidance: "The EHR vendor adds an AI-based clinical-summary feature; the pre-feature BAA didn't anticipate this kind of PHI use — BAA must be updated before implementation." This confirms that adding a single PHI-touching feature to a previously non-PHI product path requires BAA amendment BEFORE the feature is shipped to customers.
  — [Medcurity BAA Guide: scope change examples](https://medcurity.com/hipaa-business-associate-agreement-requirements/)
  — Assessment: High confidence as industry practice consensus.

---

**Design implication:** The enrichment step (Architecture A + CLM01 lookup) MUST be treated as a hard product-spec feature gate with three required preconditions before any hospital can enable it: (1) a fully executed BAA between the hospital and cliqueue naming cliqueue as a BA for the dispute enrichment function; (2) an explicit `enrichmentEnabled: true` per-hospital configuration flag in cliqueue's deployment config (not default-on); and (3) a hospital privacy officer sign-off documented in the onboarding checklist. This must be documented as a hard gate in the product spec, not a configuration note — a hospital that enables enrichment without an executed BAA is in direct HIPAA violation, and cliqueue's architecture must not make that state accidentally reachable. Architecture B (hospital self-hosted listener with local EDI access) is architecturally distinct and does NOT create BA obligations for cliqueue regardless of whether it performs CLM01 enrichment.

**Open questions generated:**
1. Should the enrichment gate (`enrichmentEnabled` flag + BAA prerequisite) be enforced not just in deployment documentation but also in the cliqueue dispute-listener codebase itself — with a startup assertion that checks for a signed BAA on-file (e.g., a BAA acknowledgment hash stored in a hospital-local config file) before the enrichment code path is activated? — added 2026-05-16, priority: high
2. Should cliqueue's BAA template include a specific "Dispute Enrichment Exhibit" addendum (separate from the main BAA) so that hospitals deploying Architecture A without enrichment can execute a minimal BAA scope, and only upgrade to the full enrichment scope when procurement permits — reducing time-to-first-deployment for hospitals with complex legal review processes? — added 2026-05-16, priority: high
3. Does the enrichment feature also create a BA subcontractor chain if the hospital's self-hosted Architecture B deployment is operated by a third-party IT managed services vendor (not the hospital directly) — and must that MSP execute a BAA with cliqueue before the Architecture B module is deployed on MSP-managed infrastructure? — added 2026-05-16, priority: medium

---

**See also** — [[../topics/x12|X12 hub]] · [[../topics/hipaa|HIPAA hub]]
