# Payer Contract Data Sharing Restrictions — Post-Adjudication and Non-EDI Rails

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Do major payer provider contracts (Anthem, UHC, Aetna, Cigna, Humana) contain explicit "exclusive clearinghouse data sharing" clauses covering post-adjudication settlement data, or are such clauses limited to 837 claim submission routing?

### Finding 1: No public primary-source evidence of post-adjudication data exclusivity clauses

- Major payer provider contracts (Anthem, UHC, Aetna, Cigna, Humana) are not publicly available for direct review. No healthcare attorney has published analysis specifically distinguishing "837 submission routing exclusivity" from "post-adjudication settlement data exclusivity" in payer provider agreements as of May 2026. The published analysis that exists focuses on gag clause compliance (cost/quality information), not on auxiliary settlement rail restrictions.
  — **Weakly sourced**: absence of published analysis does not confirm absence of such clauses. Hospital counsel must review the actual executed agreement for each payer.
  — Source: [ArentFox Schiff: Health Care Antitrust Roundup 2025](https://www.afslaw.com/perspectives/alerts/health-care-antitrust-roundup-key-cases-and-trends-providers)

- Anthem's documented exclusivity requirement specifies: "all new submitters to use the Availity EDI Gateway for Anthem EDI transactions." The scope of this requirement, as documented publicly, is **EDI transaction routing** — it does not reference supplemental settlement layers, hash anchoring, or payment confirmation systems operating outside the EDI channel.
  — Source: [Anthem EDI page](https://www.anthem.com/provider/individual-commercial/edi); [Availity payer analysis](https://intuitionlabs.ai/articles/availity-platform-payers-analysis)

### Finding 2: The CAA 2021 Gag Clause Prohibition creates a FEDERAL FLOOR restricting payers from restricting provider data sharing

- The Consolidated Appropriations Act of 2021 (CAA-21) prohibits group health plans and insurers from entering agreements that would restrict:
  1. Disclosure of provider-specific cost or quality information to plan sponsors or participants.
  2. Electronic access to **de-identified claims and encounter information** for each participant.
  3. Sharing that information with a **business associate**.
  — Source: [BASUSA: CAA Gag Clause Prohibition](https://www.basusa.com/blog/understanding-the-consolidated-appropriations-act-gag-clause-prohibition-what-plan-sponsors-must-do); [CMS: CAA-21](https://www.cms.gov/marketplace/about/oversight/other-insurance-protections/consolidated-appropriations-act-2021-caa)

- This is legally significant for cliqueue: a payer provider contract that purported to prevent a hospital from sharing **de-identified claims data** with a settlement layer vendor (cliqueue as a business associate) may itself be **unenforceable** under CAA-21. The prohibition covers downstream agreements — including agreements between a clearinghouse/TPA and its subcontractors.
  — Source: [GBS Benefits: CAA Transparency & Gag Clause Attestations](https://gbsbenefits.com/compliance/transparency-caa-2021-gag-clause-removal-attestations/)

- CMS enforces annual attestation compliance (deadline December 31 annually). As of 2025, all major payers have attested. Any payer contract clause restricting cliqueue's access to de-identified claims data as a business associate may be reported to DOL/HHS as a prohibited gag clause.
  — Source: [MedCost: CAA Gag Clause Attestation 2025](https://www.medcost.com/employers/resources/news/consolidated-appropriations-act-gag-clause-prohibition-compliance-1)

### Finding 3: Payer exclusivity likely limited to 837 EDI submission routing channel, not post-adjudication auxiliary systems

- The documented payer exclusivity clauses (Anthem/Availity, UHC/OptumInsight) specifically govern **EDI transaction routing** — the channel through which the 837 claim is submitted and the 835 remittance is received. No public source documents a payer prohibition on a hospital using an additional, non-EDI settlement confirmation layer after adjudication.
  — Source: [Anthem EDI page](https://www.anthem.com/provider/individual-commercial/edi)

- The BCBS $2.8B antitrust settlement (finalized 2024) required providers to cease "all-or-nothing contracts, anti-steering and anti-tiering provisions, and price secrecy/gag clauses." This settlement trend actively constrains further payer-imposed data restrictions, reducing the risk that new post-adjudication data exclusivity clauses will be enforceable.
  — Source: [ArentFox Schiff: Health Care Antitrust Roundup 2025](https://www.afslaw.com/perspectives/alerts/health-care-antitrust-roundup-key-cases-and-trends-providers)

### Finding 4: Avaneer Health — the only operational blockchain healthcare settlement network — uses permissioned (not public-chain) architecture and focuses on eligibility/prior-auth, not settlement

- Avaneer Health (backed by Aetna, Anthem, Cleveland Clinic, Sentara, HCSC — $50M seed, 2022) launched a decentralized, private peer-to-peer network in March 2023. Its real-time adjudication (RTA) feature routes "clean" claims directly to payer adjudication endpoints.
  — Source: [Healthcare IT News: Avaneer $50M](https://www.healthcareitnews.com/news/blockchain-built-avaneer-health-network-gets-50m-boost-aetna-cleveland-clinic-others); [Avaneer Health Launch](https://avaneerhealth.com/press/avaneer-health-launches-its-decentralized-network-and-platform-to-transform-healthcare-administration/)

- Avaneer is **permissioned/consortium** (not public chain). It uses HL7 FHIR for data exchange and focuses on eligibility, prior auth, and coverage verification — not immutable on-chain settlement audit trails. As of May 2024, its live product is "Coverage Direct" (eligibility verification), not claims settlement.
  — Source: [Avaneer Coverage Direct launch, May 2024](https://www.prnewswire.com/news-releases/avaneer-health-announces-the-launch-of-its-coverage-direct-coverage-direct-solution-302152146.html)

- **Key differentiation for cliqueue**: Avaneer is a private permissioned network controlled by incumbent payers. It does not provide an immutable public audit trail, ICD-10 agent-negotiated coding, or neutral on-chain settlement. Cliqueue's on-chain settlement on a public high-performance chain (Somnia) occupies a distinct position: neutral, tamper-resistant, not controlled by any single payer or clearinghouse.
  — **Weakly sourced**: no public post-2024 Avaneer operational outcome data available.

### Finding 5: Clean claim payment timeline — 30–50 days gross AR; denied claims add ≥30 days per rework cycle

- HFMA MAP Keys benchmark: gross days in A/R ≤50 days for hospitals; high-performing at 30–40 days. Clean claim rate benchmark: 95–98%.
  — Source: [HFMA: 7 KPIs](https://www.hfma.org/revenue-cycle/kpis/7-kpis-providers-should-be-tracking/); [Revco Solutions: KPI Glossary](https://revcosolutions.com/revenue-cycle-kpi-glossary-definitions-formulas-and-benchmarks/)

- Each denial/correction cycle adds a minimum of 30 extra days to reimbursement timelines (investigation + correction + resubmission). A single denied claim that requires one appeal cycle therefore has an expected payment time of 60–80 days from date of service.
  — Source: [CombineHealth: Improving AR Days](https://www.combinehealth.ai/blog/accounts-receivable-days-in-medical-billing)

- Commercial payer timely filing windows: Aetna 120 days, Cigna/UHC 90–180 days, Humana 90 days. The 90-day window interacts with denial cycles: a claim denied at day 45 and resubmitted at day 60 has only 30–60 days remaining in the filing window, depending on payer.
  — Source: [Medstates: Medicare Timely Filing](https://www.medstates.com/medicare-timely-filing-limit-2025/); [Medheave: Timely Filing](https://medheave.com/timely-filing-limit-for-claims-in-medical-billing/)

### Finding 6: CAQH CORE Phase III explicitly permits direct (non-clearinghouse) delivery for 835 remittance — neither HIPAA nor CORE mandates clearinghouse routing for ERA

- CAQH CORE Phase III EFT & ERA operating rules (mandatory since January 1, 2014) establish that 835 ERA files travel from payer to provider through one of two paths: clearinghouse or direct connection. Both are explicitly permissible. No CORE rule mandates clearinghouse involvement for remittance delivery.
  — Source: [CAQH CORE Phase III EFT & ERA Operating Rules](https://www.caqh.org/sites/default/files/core/phase-iii/EFTERA_CompleteRuleSet_0.pdf); [LegalClarity: ERA overview](https://legalclarity.org/electronic-remittance-advice-era-hipaa-835-standard-and-setup/)

- UHC explicitly advertises: "You can receive your 835 files through your clearinghouse, direct connection or by downloading them through Optum Pay." This is not clearinghouse-exclusive — UHC publishes a "clearinghouse options" page listing multiple accepted clearinghouses (not exclusively Optum).
  — Source: [UHC EDI 835 page](https://www.uhcprovider.com/en/resource-library/edi/edi-835.html); [UHC EDI Clearinghouse Options](https://www.uhcprovider.com/en/resource-library/edi/edi-clearinghouse-opt.html)

- Anthem's Availity exclusivity (all EDI transactions must route through Availity Gateway) applies to **inbound claim submission** (837) and the ERA **registration** step — but providers may receive their 835 ERA through their own clearinghouse or vendor by completing ERA enrollment. Availity serves as the gateway hub, not an exclusive final delivery endpoint.
  — Source: [Anthem EDI page — ERA enrollment](https://www.anthem.com/provider/individual-commercial/edi)

- **Critical regulatory distinction**: the HIPAA-mandated EFT standard (CCD+ ACH) is for the **payment transfer** itself. The 835 ERA is the **remittance data** accompanying the payment. Neither the payment rail (ACH) nor the remittance data channel (CORE) is restricted to clearinghouse routing. A cliqueue on-chain settlement event is a separate, supplemental audit record — it is categorically not an EDI 835 transaction and therefore not subject to CORE routing rules at all.
  — Source: [CMS: EFT & ERA operating rules](https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/Operating-Rules/OperatingRulesEFTandRemittanceAdvice)

**Design implication:** CAA-21's gag clause prohibition creates a federal floor that makes broad payer data exclusivity restrictions on cliqueue (as a de-identified claims BA) legally tenuous. The onboarding legal review should invoke CAA-21 as a defense when hospital counsel identifies a payer contract clause that could be read to restrict the hospital from sharing de-identified claim data with cliqueue. Cliqueue's hospital onboarding checklist should include: (a) payer contract review scoped to post-adjudication data sharing with non-clearinghouse third parties; (b) a one-paragraph CAA-21 defense memo that any hospital counsel can use if a payer raises a contractual objection. Avaneer Health confirms there is institutional appetite for blockchain-adjacent healthcare administration from major payers — but cliqueue's public-chain, neutral-audit-trail positioning is genuinely differentiated from the permissioned incumbent model.

**Open questions generated:**
1. Has any hospital's payer contract been reviewed by counsel post-CAA-21 and found to contain a post-adjudication data sharing restriction that survives the gag clause prohibition — and is there a published legal opinion or CMS enforcement action documenting such a clause? — priority: medium
2. Does Avaneer Health's real-time adjudication product compete directly with cliqueue's on-chain settlement layer, or do they address different workflow steps — and should cliqueue proactively monitor Avaneer's product roadmap for convergence? — priority: medium
3. Given the HFMA benchmark of 30-extra-days per denial rework cycle, is there a quantified dollar value (as % of total denied AR) associated specifically with the coding-error sub-category of denials — and does this inform cliqueue's ROI model beyond the $262B total denied pool figure? — priority: medium

---

**See also** — [[../topics/x12|X12 hub]] · [[../topics/prior-auth|PA hub]]
