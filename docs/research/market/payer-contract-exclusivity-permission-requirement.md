# Payer Contract Exclusivity — Does Cliqueue Require Explicit Payer Permission?

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Given payer contract exclusivity clauses binding providers to specific clearinghouses, does cliqueue's on-chain settlement layer require explicit payer permission (or contract amendment) before a hospital can add it alongside its existing clearinghouse?

### Finding 1: "Clearinghouse exclusivity" clauses are scoped to 837 EDI submission routing — not post-adjudication layers

- Documented payer exclusivity requirements (Anthem/Availity, UHC/OptumInsight) govern the **EDI transaction routing channel** — the path through which 837 claim submissions are sent and 835 remittance files are received. No publicly available payer provider contract or attorney analysis documents a restriction on a hospital using a supplemental, non-EDI post-adjudication settlement confirmation system.
  — Source: [Anthem EDI page](https://www.anthem.com/provider/individual-commercial/edi); [UHC EDI Clearinghouse Options](https://www.uhcprovider.com/en/resource-library/edi/edi-clearinghouse-opt.html)

- UnitedHealthcare explicitly states: "UnitedHealthcare interacts with many clearinghouses and doesn't endorse a specific one." UHC provides multiple accepted clearinghouses without mandating exclusivity — it offers Optum Intelligent EDI only as a fee-avoidance alternative, not as a contractual requirement.
  — Source: [UHC EDI Clearinghouse Options](https://www.uhcprovider.com/en/resource-library/edi/edi-clearinghouse-opt.html)

- Anthem's Availity requirement is the strongest documented payer exclusivity clause: "all new submitters to use the Availity EDI Gateway for Anthem EDI transactions." This governs EDI transaction routing (837/835 registration), not supplemental non-EDI settlement events anchored on a blockchain. Adding cliqueue does not submit a second 837 — it anchors a hash and a settlement proof after adjudication through a categorically different channel.
  — Source: [Anthem EDI page](https://www.anthem.com/provider/individual-commercial/edi); [Availity payer analysis](https://intuitionlabs.ai/articles/availity-platform-payers-analysis)

### Finding 2: CAA 2021 Gag Clause Prohibition creates a federal floor limiting payer exclusivity — DOL FAQ Part 69 (January 2025) is the operative authority

- The CAA-21 (Section 201) prohibits group health plans and insurers from entering agreements that restrict: (a) disclosure of provider-specific cost or quality information; (b) electronic access to **de-identified claims and encounter data** upon request; (c) sharing of that data with a **business associate** under HIPAA. Cliqueue acting as a hospital business associate for claims hashing is squarely within (b) and (c).
  — Source: [CMS: CAA-21](https://www.cms.gov/marketplace/about/oversight/other-insurance-protections/consolidated-appropriations-act-2021-caa); [DOL FAQ ACA Part 57](https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/resource-center/faqs/aca-part-57)

- DOL FAQ Part 69 (January 14, 2025) strengthened the prohibition: any agreement that allows a plan or carrier to share de-identified claims data with a business associate "only at the discretion of" a TPA, provider network, or service vendor contains an **impermissible gag clause**. Limitations on "scope, scale, or frequency" of electronic access to de-identified claims data are expressly prohibited.
  — Source: [WTW: DOL FAQ Part 69 guidance](https://www.wtwco.com/en-us/insights/2025/02/departments-issue-guidance-on-gag-clause-prohibition-and-no-surprises-act); [Varnum LLP: DOL guidance clarifies gag clause rules](https://www.varnumlaw.com/insights/new-dol-guidance-clarifies-gag-clause-prohibition-rules/)

- Downstream agreements are covered: the prohibition applies to agreements between a plan's TPA and third parties. A payer contract clause restricting a hospital's TPA from sharing de-identified claim data with cliqueue (even downstream) is prohibited under CAA-21.
  — Source: [GBS Benefits: CAA Transparency & Gag Clause Attestations](https://gbsbenefits.com/compliance/transparency-caa-2021-gag-clause-removal-attestations/); [Sequoia: Beyond Attestation 2025](https://www.sequoia.com/2025/12/beyond-attestation-what-employers-need-to-know-about-gag-clause-prohibition/)

- Annual attestation is mandatory through December 31, 2025. All major payers have attested to CAA-21 gag clause compliance. A payer raising a contractual objection to cliqueue's access to de-identified claims data as a BA risks a CAA-21 enforcement referral to DOL/HHS.
  — Source: [MedCost: CAA Gag Clause Attestation 2025](https://www.medcost.com/employers/resources/news/consolidated-appropriations-act-gag-clause-prohibition-compliance-1); [MyHaus: December 2025 GCPCA deadline](https://www.myhaus.com/blog/time-to-prepare-for-gag-clause-prohibition-compliance-attestation-gcpca-due-to-cms-by-december-31-2025)

### Finding 3: The AMA "36% contractual barrier" figure applies to 837 EDI clearinghouse switching — not supplemental settlement

- The AMA Change Healthcare survey (March–April 2024, ~1,400 respondents) documented that obstacles preventing practices from switching clearinghouses included "contractual obligations" among staffing and EHR incompatibility. This figure refers to barriers to **replacing the primary EDI clearinghouse** (i.e., routing the 837 submission through a different vendor) — not barriers to adding a supplemental post-adjudication settlement layer.
  — Source: [AMA Change Healthcare Survey](https://www.ama-assn.org/practice-management/sustainability/change-healthcare-cyberattack); [AMA Hard Lessons Learned](https://www.ama-assn.org/about/leadership/hard-lessons-learned-change-healthcare-breach)

- Cliqueue is not a clearinghouse substitute. It does not re-route 837 submissions or 835 remittance delivery. The contractual barrier is therefore narrower than the 36% figure implies for cliqueue's use case: the relevant question is whether the payer contract prohibits sharing claim-**derived** data (e.g., HMAC hashes) with any third party — a question that must be resolved via payer-specific contract review, not a population statistic.
  — **Weakly sourced**: the exact language of payer contracts is not publicly available; attorney review is required per deployment.

### Finding 4: BCBS $2.8B antitrust settlement trend actively constrains new payer-imposed data exclusivity clauses

- The Blue Cross Blue Shield $2.8B antitrust settlement (finalized 2024) required elimination of "all-or-nothing contracts, anti-steering and anti-tiering provisions, and price secrecy/gag clauses" in payer network agreements. This settlement trend actively constrains payers from adding new post-adjudication data exclusivity clauses — any such clause would face antitrust and CAA-21 scrutiny simultaneously.
  — Source: [ArentFox Schiff: Health Care Antitrust Roundup 2025](https://www.afslaw.com/perspectives/alerts/health-care-antitrust-roundup-key-cases-and-trends-providers)

- DOJ has filed a second 2026 antitrust case (March 2026) against health system contracting practices. The current regulatory environment is actively hostile to new exclusivity restrictions in healthcare data sharing.
  — Source: [Morgan Lewis: DOJ 2026 Antitrust Case](https://www.morganlewis.com/pubs/2026/03/doj-continues-scrutiny-of-health-system-contracting-in-second-2026-antitrust-case)

### Finding 5: No payer contract amendment is required for cliqueue — but a legal review step belongs in the onboarding checklist

- No regulatory authority (HIPAA, CAQH CORE, CMS) requires payer permission before a hospital adds a supplemental non-EDI settlement and audit system. No published payer policy (UHC, Anthem, Aetna, Cigna, Humana) restricts hospitals from using non-EDI settlement confirmation layers. The absence of such restrictions in publicly documented payer policies is consistent with the legal landscape (CAA-21, BCBS settlement, antitrust scrutiny).
  — **Weakly sourced**: public payer policy pages do not exhaustively cover supplemental settlement layers. Individual executed provider agreements may contain bespoke language.

- The appropriate onboarding step is a **targeted contract review**, not a payer permission request. Hospital counsel reviews the specific executed payer agreement for any clause that could be read to prohibit: (a) sharing de-identified claim data with a non-clearinghouse third party post-adjudication, or (b) using a supplemental electronic settlement confirmation system. If found, the CAA-21 defense memo (§ 201 prohibition, FAQ Part 69 authority) is the response — not a contract amendment request.

**Design implication:** Cliqueue does not require explicit payer permission before hospital deployment. The onboarding checklist should include a targeted payer contract review step (not a payer approval gate) scoped to: post-adjudication data sharing with non-clearinghouse BAs. The hospital BAA should include a one-paragraph CAA-21 defense exhibit that hospital counsel can invoke if a payer objects. Cliqueue should document itself as a business associate (not a clearinghouse) in all onboarding materials — this classification is the basis of the CAA-21 gag clause defense.

**Open questions generated:**
1. Has any hospital's payer contract been reviewed by counsel post-CAA-21 and found to contain a post-adjudication data sharing restriction that survives the gag clause prohibition — and is there a published legal opinion or CMS enforcement action documenting such a clause? — priority: medium
2. Should the hospital BAA include a specific "CAA-21 Gag Clause Defense Exhibit" that hospital counsel can use to respond to payer objections — citing DOL FAQ Part 69 (January 2025) as the operative authority? — priority: high
3. Given UHC's flexible clearinghouse policy and Anthem's Availity gateway as the two extremes, should cliqueue's onboarding documentation segment payer-specific risk (high-Availity-exposure hospitals vs. UHC hospitals) and recommend different contract review scopes accordingly? — priority: medium

---

**See also** — [[../topics/x12|X12 hub]]
