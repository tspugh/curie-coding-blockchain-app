# CAA-21 Gag Clause Prohibition — Provider-to-Vendor Data Sharing Scope

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Does the Consolidated Appropriations Act 2021 (CAA-21) Section 201 gag clause prohibition make it illegal for payers to restrict hospitals from sharing post-adjudication claims data with their own third-party vendors (like cliqueue as a hospital BA) — or does the prohibition only cover restrictions on the plan/issuer's own data access and BA-sharing?

### Background

Prior research flagged that payer provider contracts may contain post-adjudication data sharing restriction clauses, and that the CAA-21 gag clause prohibition was a potential hospital onboarding defense. The open question is whether this defense is available when cliqueue is a hospital BA (not a plan BA) — and whether the onboarding checklist can include a one-paragraph CAA-21 gag clause defense memo for hospitals with restrictive payer contracts.

---

### Finding 1: CAA-21 Section 201 is textually a plan/issuer obligation — it does not expressly create provider rights to use vendors

- The gag clause prohibition (42 U.S.C. § 300gg-119; ERISA 29 U.S.C. § 1185m; IRC § 9824) is structured as a duty on **"a group health plan or health insurance issuer"** — not on providers. The operative prohibition bars plans/issuers from entering agreements that restrict the **plan/issuer** from: (1) providing provider-specific cost/quality information to plan sponsors, members, or referring providers; (2) electronically accessing de-identified claims and encounter data on a per-claim basis; or (3) sharing that data with a **HIPAA business associate of the plan**.
  — Source: [CMS GCPCA page](https://www.cms.gov/marketplace/about/oversight/other-insurance-protections/gag-clause-prohibition-compliance-attestation); [Tri-agency FAQ: DOL/CMS/Treasury](https://www.dol.gov/sites/dolgov/files/EBSA/about-ebsa/our-activities/resource-center/faqs/gag-clause-prohibition-compliance-attestation.pdf)

- The statute **does not** expressly give hospitals (providers) a statutory right to share adjudicated claims data with their own technology vendors, nor does it bar payers from restricting **provider-to-provider's-vendor** data flows as such. The third statutory category ("sharing with a business associate") refers specifically to the **plan's** business associate, not the hospital's.
  — Source: [Manatt: The Gag Clause Prohibition Compliance Deadline Is Approaching](https://www.manatt.com/insights/newsletters/health-highlights/the-gag-clause-prohibition-compliance-deadline-is); [Winston & Strawn: CAA Benefits Alert](https://www.winston.com/en/blogs-and-podcasts/benefits-blast/caa-benefits-alert-2021-appropriations-bill-adds-new-restrictions-on-gag-clauses-for-health-plans)

---

### Finding 2: DOL January 2025 guidance extends the prohibition to provider contracts that functionally block plan/issuer access — but still focuses on plan-facing flows

- A January 2025 DOL guidance clarification (summarized by Varnum Law) states that "owners of provider networks cannot use discretionary language or self-serving contractual provisions (e.g., only allowing de-identified claims data to be shared at 'its discretion')… which have the practical effect of preventing disclosure of critical claims data… to a plan sponsor or a plan's business associates."
  — Source: [Varnum Law: New DOL Guidance Clarifies Gag Clause Prohibition Rules](https://www.varnumlaw.com/insights/new-dol-guidance-clarifies-gag-clause-prohibition-rules/)

- This functional-effect standard covers provider network contracts as well as plan-level contracts, but only to the extent they impede **plan/plan-sponsor/plan-BA** data access. A payer-provider clause restricting what the **hospital** can do with its own copy of adjudicated data for its own vendor purposes is **not covered** by this DOL guidance unless it also functionally prevents the plan from fulfilling its Section 201 access obligations.
  — Source: [Varnum Law: New DOL Guidance Clarifies Gag Clause Prohibition Rules](https://www.varnumlaw.com/insights/new-dol-guidance-clarifies-gag-clause-prohibition-rules/)

- **No HHS/DOL/CMS FAQ or guidance as of May 2026 directly addresses provider-to-vendor data flows** divorced from plan-facing transparency obligations. All primary agency materials treat Section 201 as plan/issuer-centric.
  — Source: [DOL EBSA FAQ Gag Clause](https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/resource-center/faqs/aca-part-57); [CMS GCPCA page](https://www.cms.gov/marketplace/about/oversight/other-insurance-protections/gag-clause-prohibition-compliance-attestation)

---

### Finding 3: HIPAA does not make payer-provider data sharing restrictions unenforceable

- HIPAA is permissive rather than prescriptive with respect to data sharing — it permits certain disclosures (including hospital → its BA) but does not create an affirmative right that overrides private contract terms. A covered entity may agree by contract to share data less broadly than HIPAA permits. De-identified data (cliqueue's on-chain model) is not regulated as PHI under HIPAA at all, removing HIPAA as a direct defense against payer contract restrictions on de-identified post-adjudication data flows.
  — Source: [45 CFR § 164.514](https://www.law.cornell.edu/cfr/text/45/164.514); HHS OCR de-identification guidance

- No HHS/OCR enforcement action or published guidance states that a payer-provider contract clause restricting a hospital from sharing de-identified claims data with its own BA is unenforceable under HIPAA. The HIPAA argument is not available as a standalone defense.
  — Source: Perplexity synthesis; no primary HHS source identified.

---

### Finding 4: The strongest cliqueue defense path — position as the plan's BA, not only the hospital's BA

- Where cliqueue is contracted **directly with the plan/issuer as a BA** (as well as or instead of the hospital), any provider-contract clause that prevents the plan from sharing required de-identified claims/encounter/financial data with cliqueue would be a **prohibited gag clause** under Section 201(3). The plan would be required to treat the clause as void or amend its provider agreement to maintain its annual GCPCA attestation compliance.
  — Source: [Manatt analysis](https://www.manatt.com/insights/newsletters/health-highlights/the-gag-clause-prohibition-compliance-deadline-is); [PBGH Gag Clause Toolkit](https://www.pbgh.org/wp-content/uploads/2023/11/Toolkit_Resources-for-CAA-Data-Access-and-Gag-Clause-Attestation_11.1.2023_Final.pdf)

- PBGH's employer toolkit recommends contract language explicitly deeming gag-clause-conflicting provisions "invalid and unenforceable" and citing Section 201's per-claim financial data access mandate. Plans/issuers cannot truthfully submit the annual GCPCA attestation (due December 31 each year, first submitted December 31, 2023) if they maintain provider contracts with prohibited gag clauses.
  — Source: [PBGH Gag Clause Toolkit (PDF)](https://www.pbgh.org/wp-content/uploads/2023/11/Toolkit_Resources-for-CAA-Data-Access-and-Gag-Clause-Attestation_11.1.2023_Final.pdf); [Winston & Strawn: CAA Benefits Alert](https://www.winston.com/en/blogs-and-podcasts/benefits-blast/caa-benefits-alert-2021-appropriations-bill-adds-new-restrictions-on-gag-clauses-for-health-plans)

---

### Finding 5: No court ruling or published attorney analysis addresses this specific scenario

- The closest published PBGH litigation notes involve TPAs refusing to give employer plans their claims data (plan sponsor vs. TPA). No reported court case or published healthcare attorney analysis addresses whether a payer can restrict a hospital's use of a third-party technology vendor for post-adjudication claims processing, under either CAA-21 or HIPAA.
  — Source: [PBGH Toolkit (PDF)](https://www.pbgh.org/wp-content/uploads/2023/11/Toolkit_Resources-for-CAA-Data-Access-and-Gag-Clause-Attestation_11.1.2023_Final.pdf); no primary court filing identified.

- No public enforcement action by HHS, DOL, or OPM as of May 2026 specifically addresses Section 201 violations in the context of payer restrictions on provider-vendor claims data flows.
  — Source: [CMS GCPCA page](https://www.cms.gov/marketplace/about/oversight/other-insurance-protections/gag-clause-prohibition-compliance-attestation)

---

### Finding 6: Practical risk assessment for cliqueue hospital onboarding

- If cliqueue is engaged as **hospital BA only**: A payer-provider clause restricting the hospital from sharing adjudicated claims data with cliqueue is **NOT clearly barred** by CAA-21. The onboarding checklist cannot represent CAA-21 as a definitive legal defense for hospital-BA deployments. The hospital must obtain outside counsel review of its specific payer contracts before proceeding.

- If cliqueue is also engaged as a **plan/payer BA** (i.e., cliqueue has a direct BAA with the payer for plan-facing analytics): A provider contract clause that interferes with the plan's Section 201 data access obligations is squarely prohibited. This dual-BA model is the strongest regulatory position.

- The "functional restriction" standard from the January 2025 DOL guidance provides a secondary argument: if a payer-provider clause "has the practical effect" of preventing the plan from accessing or sharing per-claim de-identified claims data, it is prohibited even if not facially about the hospital's vendor relationships. This is an argument from statutory purpose, not clear text — outside counsel must assess applicability to the specific clause language.
  — Source: [Varnum Law: New DOL Guidance](https://www.varnumlaw.com/insights/new-dol-guidance-clarifies-gag-clause-prohibition-rules/)

---

**Design implication:** cliqueue's hospital onboarding checklist should NOT include a confident CAA-21 gag clause defense memo for hospital-BA deployments — the statutory protection runs to the plan/issuer, not the hospital. Instead, the checklist should: (1) include a payer contract review checklist item requiring hospital outside counsel to review all payer network agreements for post-adjudication data sharing restrictions before executing cliqueue's BAA; (2) recommend that cliqueue also contract directly with the payer/plan as a plan BA where the payer is willing, converting any restrictive provider-contract clause into a prohibited gag clause; (3) where the hospital's counsel identifies a restrictive clause, recommend asserting the DOL January 2025 "functional restriction" standard in contract amendment negotiations rather than treating CAA-21 as a self-executing invalidation rule. Avaneer Health's precedent (payer-backed consortium blockchain operating alongside EDI rails) suggests payer openness to supplemental settlement layers — the negotiation path, not CAA-21 litigation, is the realistic onboarding unblocking mechanism.

**Open questions generated:**
1. Should cliqueue develop a standard "Payer Engagement Letter" template offering payers a direct BAA for plan-side analytics — converting cliqueue's role from hospital-BA to dual-BA — and would this dual-BA structure be sufficient for the plan's GCPCA attestation compliance to shield the hospital from restrictive provider-contract clause risk?
2. Should the hospital onboarding payer contract review checklist distinguish "pre-adjudication routing clauses" (836/837 submission exclusivity, clearly outside CAA-21's scope for hospital→cliqueue flows) from "post-adjudication data sharing clauses" (more likely to trigger CAA-21 functional restriction analysis) — reducing the legal review scope for the majority of hospital payer contracts?
3. Has any major health system's counsel published a legal opinion or blog post analyzing whether the DOL January 2025 "functional restriction" guidance extends CAA-21's protection to provider-vendor data flows — and is this a ripe area for cliqueue to commission a targeted outside-counsel opinion letter as a go-to-market collateral document?

---

**See also** — [[../topics/hipaa|HIPAA hub]] · [[../topics/x12|X12 hub]]
