# Coding-Error Share of Claim Denials and AI Vendor Denial-Rate Impact

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — What fraction of denied claims are coding-error-attributed, and do AI coding vendors measurably reduce denial rates?

### Denial reason breakdown: coding errors are ~20% of total denials but the fastest-growing category

- **~20% of all claim denials** stem specifically from coding errors across inpatient and outpatient settings (MDaudit 2024 Annual Benchmark Report, covering 650,000+ providers and $8B in audited claims).
  — [MDaudit 2024 Benchmark Report press release](https://www.mdaudit.com/resource/press-release/mdaudits-2024-benchmark-report-reveals-a-fivefold-increase-in-dollars-at-risk-from-payer-audits-while-coding-related-denials-surged-by-over-125/)
- Denial reason breakdown by category (2024 industry data): **eligibility/demographic errors ~42%** (MGMA); **front-end process errors ~32.5%** (SSI Group data); **medical necessity ~12–15%** (HFMA); **coding errors ~20%**; **duplicate claims ~3–5%** (CMS).
  — [MGMA Stat on claim denials](https://www.mgma.com/mgma-stat/strategic-improvements-in-your-rcm-to-reduce-your-practices-claim-denials); [HFMA: denials management](https://www.hfma.org/revenue-cycle/redesigning-denials-management-in-the-obbba-era/)
- Coding-related denials **surged 125%+ in 2024** (MDaudit), outpacing all other denial categories. Medical necessity-related denials also rose: +75% outpatient, +140% inpatient. External audit volume more than doubled YoY; total at-risk dollars jumped fivefold to $11.2M per MDaudit customer.
  — [Tennessee Daily / MDaudit](https://www.tennesseedaily.com/news/274761907/mdaudits-2024-benchmark-report-reveals-a-fivefold-increase-in-dollars-at-risk-from-payer-audits-while-coding-related-denials-surged-by-over-125/)
- **Coding errors account for 39% of problem areas** identified in hospital billing audits specifically (MDaudit hospital billing sub-sample); secondary diagnoses documented-but-not-billed account for another 37%.
  — [Healthcare Business Today: 2025 Report](https://www.healthcarebusinesstoday.com/benchmark-report-revenue-integrity/)

### Coding denial dollar exposure: the $631/claim figure is a coding-specific number

- The $262B in denied claims (2024) spans all denial reasons. The $631/claim coding-denial figure (126% YoY increase, previously documented) reflects the dollar-weighted average specifically for coding-related denials — not the full $262B pool. Applying the ~20% coding-error share to $262B implies a **~$52B coding-error-attributable denied pool** (rough estimate; no single authoritative source has published this exact figure). This estimate should be treated as approximate until a primary source confirms it.
  — [AAPC: Claims Denials Are on the Rise](https://www.aapc.com/blog/91574-claims-denials-are-on-the-rise/)

### AI vendor denial-rate impact: published quantitative evidence exists for CodaMetrix and Nym

- **CodaMetrix (OHSU case study, May 2025):** AI-autonomously coded radiology claims had a denial rate of **0.33% vs. 1.09% for manual coding** — a **70% lower denial rate**. MR imaging cases specifically: 0.48% (AI) vs. 1.38% (manual) — **65% lower**. Coder workload reduced 28%. CodaMetrix states this holds across their customer base as a **60% average reduction in coding-related denials** vs. manual.
  — [Healthcare IT News: Autonomous coding at OHSU, May 2025](https://www.healthcareitnews.com/news/autonomous-coding-ai-shows-impressive-results-ohsu); [CodaMetrix OHSU case study](https://www.codametrix.com/case-studies/ohsu-case-study); [CodaMetrix for health systems](https://www.codametrix.com/for-health-systems)
- **Nym Health:** A large (unnamed) health system achieved a **97% decrease in radiology professional-fee coding-related denial rate** post-deployment. Nym attributes this to consistent alignment with payer guidelines and elimination of human variability in modifier selection.
  — [Nym Health blog: Reducing Denials With Autonomous Coding](https://blog.nym.health/reducing-denials-with-autonomous-coding-medical-coding)
- **Fathom:** No specific denial-rate delta has been published. The publicly disclosed outcome is: improved coding accuracy from 96.3% to 98.3% (Your Health, Oct 2025); RAF scores +0.66 YoY (+48% in first month); $35M → $70M revenue improvement attributed to more complete HCC capture. Fathom positions its value as accuracy and automation rate, not directly as denial reduction.
  — [BusinessWire: Your Health deploys Fathom, March 2026](https://www.businesswire.com/news/home/20260319818217/en/Your-Health-Deploys-Fathom-Autonomous-Medical-Coding-to-Achieve-95.5-Automation-Rate-at-98.3-Accuracy-Rate-Across-All-Service-Lines)
- **Iodine Software (acquired by Waystar for $1.25B, July 2025):** Recovered >$2.1B in reimbursement for health systems in 2024; reduced review times 63%. Focus is on clinical documentation improvement (CDI) and concurrent denials management rather than autonomous coding per se — appeals workflow automation rather than upstream coding prevention.
  — [Waystar/Iodine acquisition announcement](https://www.prnewswire.com/news-releases/waystar-to-acquire-iodine-software-accelerating-the-ai-powered-transformation-of-healthcare-payments-302512405.html)

### Caveat: vendor-published figures are self-reported

- CodaMetrix's OHSU data is the most methodologically transparent (specific rates for specific procedure types, published in Healthcare IT News). Nym's "97% reduction" is a single unnamed health system case study. Fathom's RAF improvement is compelling but addresses revenue completeness, not denial prevention directly. Independent peer-reviewed studies on AI coding denial-rate impact are sparse as of May 2026.
  — [KLAS: Autonomous Coding 2025 (cited in earlier research)](https://klasresearch.com/report/autonomous-coding-2025-a-promising-start-for-an-early-market/3166)

**Design implication:** Coding errors (~20% of denials by count, but ~$52B of the $262B pool and the fastest-growing category at +125% YoY) are the addressable pool for cliqueue-coding-blockchain. CodaMetrix's OHSU data establishes the benchmark: 60–70% reduction in coding-related denial rates is achievable with AI coding. If cliqueue's on-chain attestation further reduces dispute latency and eliminates re-adjudication round-trips, the value proposition compounds: not just fewer denials but faster resolution of the denials that do occur. The $631/claim coding-denial cost (vs. $0.0025 on-chain per-claim settlement cost) is the sharpest ROI anchor for the protocol.

**Open questions generated:**
1. Is the ~$52B coding-error-attributable denied pool consistent with any primary source? (HFMA, AHA, or KFF analysis of denial-reason cost distribution would confirm or refute this estimate.)
2. CodaMetrix's 70% denial reduction at OHSU was radiology-specific — does that rate hold for inpatient/complex surgical coding where autonomy rates are lower and edge cases dominate?
3. Iodine Software's $1.25B acquisition by Waystar (July 2025) signals that revenue cycle incumbents are acquiring AI coding/CDI capabilities. Does this compress the market window for an independent protocol like cliqueue, or does it validate the demand and leave the settlement-layer gap open?

---

**See also** — [[../topics/corti|Corti hub]]
