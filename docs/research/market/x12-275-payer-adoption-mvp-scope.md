# X12 275 Payer Adoption Rate and MVP Scope for ClaimsAttachmentAdapter

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-17 — What percentage of US claim volume is covered by payers currently accepting X12 275 electronically — and should cliqueue's MVP deployment guide restrict ClaimsAttachmentAdapter to payers with published companion guides?

**Question:** What share of US health insurance claim volume is covered by payers currently accepting X12 275 electronic claim attachments as of May 2026 — and should cliqueue's MVP deployment guide restrict the `ClaimsAttachmentAdapter` to payers with published companion guides, deferring custom companion guide support to Phase 2?

### Finding 1: CAQH 2024 Index — only 32% of claim attachment transactions are fully electronic

- The **2024 CAQH Index Report** found that claim attachment transactions were handled as follows: **32% electronically, 41% manually (paper/fax/mail), 27% via web portals (partially electronic)**. The 68% non-electronic share confirms that attachment automation is still the early-majority phase of the adoption curve nationally.
  - [CAQH 2024 Index Key Takeaways](https://www.caqh.org/hubfs/Index/2024%20Index%20Report/CAQH%202024%20Index%20Report%20Key%20Takeaways%20FINAL.pdf)
  - [CAQH CORE Accelerating Claims Processing Implementation Insights](https://www.caqh.org/hubfs/CORE/CORE%20Accelerating%20Claims%20Processing:%20Insights%20from%20Implementation.pdf)
  - Assessment: High confidence — two CAQH sources cite the 32% figure consistently.

- CMS-0053-F (finalized March 24, 2026, Federal Register 2026-05676) mandates X12 275/277 + HL7 CDA electronic attachments by **May 2028**, which will accelerate payer adoption over the next 24 months.
  - [Federal Register: CMS-0053-F](https://www.federalregister.gov/documents/2026/03/24/2026-05676/administrative-simplification-adoption-of-standards-for-health-care-claims-attachments-transactions)

### Finding 2: Confirmed payers with active X12 275 companion guides or clearinghouse support as of May 2026

| Payer | Status | Companion Guide / Evidence URL |
|---|---|---|
| **CMS / Medicare esMD** | Confirmed — public companion guide | [X12 275 Health Claim Services](https://www.cms.gov/files/document/x12-275-health-claim-services.pdf); [esMD companion guide](https://www.cms.gov/files/document/esmd-x12n-275-companion-guide.pdf) |
| **UnitedHealthcare (UHC)** | Confirmed — 006020X314 companion guide + 9-clearinghouse live network | [UHC 275 companion guide PDF](https://www.uhcprovider.com/content/dam/provider/docs/public/resources/edi/EDI-275-Companion-Guide-for-UHC-006020X314.pdf); [clearinghouse options page](https://www.uhcprovider.com/en/resource-library/news/2025/clearinghouse-option-edi-275-claim-attachment.html) |
| **Cigna** | Confirmed — 005010X210 companion guide (v5.2, Feb 2022) | [Cigna 275 companion guide PDF](https://www.cigna.com/static/www-cigna-com/docs/5010-275-X12-companion-guide.pdf) |
| **BCBS Kansas** | Confirmed — unsolicited X12 275 effective May 2025 | [BCBS Kansas announcement](https://www.bcbsks.com/latest-news/unsolicited-electronic-claim-attachment-functionality-x12-275) |
| **NGS Medicare** | Confirmed — 006020X314 companion guide, effective June 2025 | (Referenced in prior research: docs/research/agreement-layer/x12-277rfai-solicited-attachment-request-parser-spec.md) |
| **Highmark** | Confirmed — companion guide published; attachment scope TBD | [Highmark companion guide](https://edi.highmark.com/edi/pdfs/CompanionGuides/PA_Provider_Companion_Guide_5010_January_2026.pdf) |
| **Aetna** | Functionally active — 8 clearinghouses listed; no explicit X12 275 branding on page | [Aetna electronic transaction vendors](https://www.aetna.com/health-care-professionals/claims-payment-reimbursement/electronic-transaction-vendors.html) |
| **Elevance Health / Anthem** | Implementing — Elevance presenter at CAQH CORE X12 275 webinar June 2025; no public companion guide confirmed | [CAQH CORE X12 275 Part 2 Webinar](https://www.caqh.org/events/x12n275-claim-attachment-part-2) |

**Not confirmed with public companion guide or announcement as of May 2026:**
- **Humana** — no public X12 275 guide or EDI announcement found
- **Anthem** — implementing (per CAQH webinar appearance) but no public companion guide confirmed

### Finding 3: UHC's active clearinghouse network covers the broadest reach

UHC's X12 275 live network (launched, last updated May 20, 2025 with Change Healthcare added) supports **9 clearinghouses**: Availity, Change Healthcare, Claim.MD, Cortex EDI, Experian Health, Jopari, Quadax, SSI Group, Xifin. This covers both solicited and unsolicited submissions across all claim types. UHC processes approximately 14–18% of US commercial and MA claims by enrollment share, making this the single largest commercial payer milestone.
- [UHC clearinghouse options for EDI 275](https://www.uhcprovider.com/en/resource-library/news/2025/clearinghouse-option-edi-275-claim-attachment.html)

### Finding 4: Estimated claim volume coverage for confirmed X12 275 payers

Using enrollment/membership as a claims-volume proxy (no claims-count-by-payer public dataset exists):
- **CMS Medicare (fee-for-service)**: ~33M beneficiaries → ~35% of US claims by count (government bucket)
- **UHC**: largest commercial payer, ~15–18% commercial market share
- **BCBS plans collectively**: ~43% of US commercial market (AMA report); BCBS Kansas alone is a regional payer
- **Cigna**: top-5 nationally, ~7–9% commercial market share
- **Aetna**: top-3 nationally, ~12–14% commercial market share
- [AMA: Health insurance giants tighten grip on US markets](https://www.ama-assn.org/press-center/ama-press-releases/ama-report-health-insurance-giants-tighten-grip-us-markets)

**Conservative estimate**: Combining confirmed/active payers (CMS Medicare, UHC, Cigna, Aetna, Highmark, BCBS Kansas, NGS Medicare, Elevance/Anthem-implementing), the payers with companion guides or active 275 networks as of May 2026 **likely cover 55–70% of total US claim volume by count** — but only **32% of attachment transactions are currently being submitted electronically** regardless, meaning actual attachment EDI traffic penetration is the lower bound.

**Important caveat**: BCBS collectively is 43% of commercial market but individual BCBS plans (BCBS Kansas, Highmark, BCBS Michigan, etc.) each publish separate companion guides. No single aggregated "BCBS X12 275 companion guide" exists — each licensee is independently confirmed. The AMA's 43% figure applies to the full Blue system.

### Finding 5: Practical MVP deployment scope — companion-guide-restricted is correct

Given that:
1. Only 32% of attachment transactions are electronically submitted nationally (2024 CAQH Index)
2. Confirmed companion guides exist for: CMS Medicare, UHC, Cigna, BCBS Kansas, NGS Medicare, Highmark
3. Aetna and Elevance are functionally active but lack explicit public 275 branding

The MVP `ClaimsAttachmentAdapter` deployment should be restricted to payers with published companion guides. Attempting to build a "generic" 275 generator without a companion guide creates testing risk — payer-specific envelope variations (ISA13 format, loop sequencing, BDS segment attributes) are documented in companion guides and differ meaningfully between payers.

**Design implication:** `@cliqueue/x12-275` should include a `SUPPORTED_PAYERS` constant table listing companion-guide-confirmed payers and their companion guide version (005010X210 vs 006020X314), defaulting to 6020 for new implementations. Hospitals contracting with Humana-only should be flagged during onboarding as requiring "companion guide pending" status until Humana publishes formally.

**Open questions generated:**
1. Does Humana have an internal X12 275 implementation guide distributed only to trading partners (not published publicly) — and should cliqueue's payer onboarding checklist include a step for hospitals to request Humana's trading partner specification before deploying the attachment adapter?
2. Should `@cliqueue/x12-275` export a `SUPPORTED_PAYERS` runtime registry (mapping payer EDI ID to companion guide version + ISA qualifiers) — enabling the hospital agent to validate payer readiness before generating a 275 envelope?
3. Given that 68% of attachment transactions remain non-electronic as of the 2024 CAQH Index, should cliqueue's hospital onboarding pitch frame the `ClaimsAttachmentAdapter` as a "CMS-0053-F readiness accelerator" (delivering May 2028 compliance 24 months early) rather than a "currently adopted standard" — and does this framing affect hospital procurement timelines vs. revenue cycle directors' urgency?

---

**See also** — [[../topics/x12|X12 hub]] · [[../topics/cda|CDA hub]]
