# Change Healthcare Breach — Clearinghouse Concentration Risk and Provider Appetite for Decentralized Alternatives

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-15 — The Change Healthcare breach exposed systemic clearinghouse concentration risk — is there a documented provider appetite for decentralized alternatives, or is the standard response simply adding a second clearinghouse backup (Waystar/Availity redundancy)?

**Context:** Change Healthcare processes approximately 40–50% of all US healthcare claims (billing-routing, eligibility, remittance) — making it the dominant EDI clearinghouse. The February 2024 ALPHV/BlackCat ransomware attack took it offline for weeks, directly disrupting revenue for an estimated 94% of US hospitals. The question for cliqueue is whether this event created real provider demand for decentralized alternatives, or whether the market response is simply multi-clearinghouse redundancy (a second contract with Waystar/Availity).

---

### Finding 1: Clearinghouse concentration is severe — Change Healthcare processed ≥40% of all US claims and 44% of all funds

- The Office of Financial Research (OFR) Brief 24-05 (November 2024) identified Change Healthcare as the largest medical claims clearinghouse in the US, processing over 50% of health insurance claims and approximately 44% of all funds processed through the US healthcare system.
  — [OFR Brief: The Cyberattack on Change Healthcare](https://www.financialresearch.gov/briefs/2024/11/13/the-cyberattack-on-change-healthcare/)

- The 192.7 million individuals notified as affected (as of July 2025) represents nearly two-thirds of the US population — establishing this as the largest healthcare cybersecurity breach in history.
  — [HHS OCR / Change Healthcare Data Breach, HIPAA Guide](https://www.hipaaguide.net/change-healthcare-data-breach/)

- The AHA documented that 94% of hospitals experienced financial impacts; 74% had direct patient care impact. Change Healthcare handled 15 billion claims per year.
  — [AHA Survey March 2024](https://www.aha.org/system/files/media/file/2024/03/Resources-for-Providers-in-Response-to-the-Change-Healthcare-Cyberattack.pdf)

### Finding 2: Provider response was overwhelmingly clearinghouse redundancy, NOT decentralization

- HFMA's March 2024 survey of health system finance executives showed: **53%** of organizations where Change Healthcare was the primary clearinghouse planned to shift to partnering with **multiple clearinghouses**; only **17%** would pursue direct payer submission (the most decentralized available option); only **7%** would strengthen contract language.
  — [HFMA Cyberattack Survey March 2024](https://www.hfma.org/technology/cybersecurity/cyberattack-on-change-healthcare-brings-turmoil-to-healthcare-operations-nationwide/)

- A separate HFMA Business Continuity Workgroup survey found **65%** of members would consider moving to multiple clearinghouses; **50%** of former Change Healthcare customers considered resuming uploads to the platform (indicating "second clearinghouse" not "replace clearinghouse").
  — [HFMA Cyberattack Survey March 2024](https://www.hfma.org/technology/cybersecurity/cyberattack-on-change-healthcare-brings-turmoil-to-healthcare-operations-nationwide/)

- The AMA's April 2024 survey reported: 54% of practices that could not switch cited staffing time and EHR incompatibility as barriers; 25% said switching was too expensive ($10,000 setup cost for one respondent); 36% cited payer system incompatibility or contract exclusivity clauses. This documents structural lock-in against even clearinghouse-to-clearinghouse switching.
  — [AMA Change Healthcare Survey Results, April 2024](https://www.ama-assn.org/practice-management/sustainability/change-healthcare-cyberattack)

- Availity's emergency "Lifeline" program processed over **186 million claims** as an alternative during the outage — demonstrating that clearinghouse-to-clearinghouse substitution, not decentralization, was the realized market response.
  — [IntuitionLabs: Availity Alternatives for Healthcare Clearinghouses](https://intuitionlabs.ai/articles/availity-clearinghouse-alternatives)

### Finding 3: No documented provider appetite for blockchain or decentralized claim-adjudication alternatives

- No major provider group, hospital system, AHA/AMA policy statement, CMS action, or HFMA recommendation in 2024–2026 cites blockchain, decentralized ledgers, or protocol-level decentralization as a desired response to the Change Healthcare breach. All published remediation frameworks focus on: (a) clearinghouse diversification, (b) direct-to-payer connections, (c) paper claim fallback, and (d) enhanced cybersecurity requirements.
  — [AMA Hard Lessons Learned](https://www.ama-assn.org/about/leadership/hard-lessons-learned-change-healthcare-breach); [OFR Brief 24-05](https://www.financialresearch.gov/briefs/2024/11/13/the-cyberattack-on-change-healthcare/)

- The Frontiers in Blockchain 2026 review of blockchain-enabled health insurance claims tokenization confirms "most studies concentrate on conceptual frameworks or prototype-level systems" with "no widespread adoption of production-ready blockchain systems" as of 2026.
  — [Frontiers in Blockchain, 2026: Blockchain-enabled tokenization for health insurance claims](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2026.1768301/full)

- A penligent.ai post-mortem on the breach mentions Avaneer Health (the blockchain consortium backed by Aetna/Anthem/Cleveland Clinic) as a *possible* directional alternative — but Avaneer dissolved in 2023 before the breach, before it could serve as a validated alternative. No successor consortium launched.
  — [Change Healthcare Cyberattack: What Happened](https://www.penligent.ai/hackinglabs/change-healthcare-cyberattack-what-happened-what-it-means-and-where-we-go-from-here/)

### Finding 4: Congressional and regulatory response focuses on cybersecurity, not structural decentralization

- The Healthcare Cybersecurity and Resiliency Act of 2025 (H.R. 3841, S. 1851 — 119th Congress), introduced by Senators Cassidy, Warner, Cornyn, and Hassan, directly cites the Change Healthcare breach as the impetus. It mandates: enhanced HIPAA cyber rules, breach notification data requirements, HHS sector risk management designation, and cybersecurity grants. **It does not mandate clearinghouse diversification, decentralization, or redundancy requirements.**
  — [Healthcare Cybersecurity Act of 2025 — Senate Text](https://www.congress.gov/bill/119th-congress/senate-bill/1851/text/is); [CyberScoop coverage](https://cyberscoop.com/senate-passes-health-care-cyber-reforms-cassidy/)

- CMS's operational response was to: (1) direct Medicare Administrative Contractors to expedite clearinghouse-switching, (2) accept paper claims as fallback, and (3) accelerate advance payments. No structural remedy for concentration was proposed.
  — [CMS Statement on Continued Action, March 2024](https://www.cms.gov/newsroom/press-releases/cms-statement-continued-action-respond-cyberattack-change-healthcare)

- The OFR brief identified the concentration as systemic financial risk but proposed no structural remedies — it framed the incident as a cybersecurity governance lesson, not a market-structure intervention.
  — [OFR Brief 24-05](https://www.financialresearch.gov/briefs/2024/11/13/the-cyberattack-on-change-healthcare/)

### Finding 5: The TriZetto/Waystar breach in 2025–2026 reinforced that the two-clearinghouse backup strategy has its own concentration problem

- A second major clearinghouse breach (TriZetto, a Waystar product) occurred in 2025–2026, demonstrating that simply adding Waystar as a backup to Change Healthcare creates a secondary concentration risk — the two largest clearinghouses in the US are now both breach-veterans.
  — [Qualigenix: Top 10 Medical Billing Clearinghouses 2026](https://qualigenix.com/top-10-clearinghouses-in-medical-billing-2026/); [claimmaxrcm.com: Top 10 Clearinghouses 2026](https://claimmaxrcm.com/top-10-clearinghouses-in-medical-billing-2026-pricing-pros-costs-compared/)

- Industry discourse shifted post-TriZetto to explicitly recommending **three-vendor diversification** and Experian ClaimSource (smaller, independently operated) as a dedicated backup — but still within the clearinghouse paradigm.
  — [IntuitionLabs Availity Alternatives](https://intuitionlabs.ai/articles/availity-clearinghouse-alternatives)

- No provider group, health system, or trade publication in the post-TriZetto analysis cited blockchain or decentralized protocol as a response.

### Finding 6: Structural lock-in factors that constrain provider switching (and equally constrain decentralized adoption)

- EHR and practice management system integration constraints: 32% of AMA survey respondents could not switch clearinghouses because their EHR did not support the alternative vendor.
  — [AMA Change Healthcare Survey Results](https://www.ama-assn.org/practice-management/sustainability/change-healthcare-cyberattack)

- Contract exclusivity: 36% cited payer-imposed contract exclusivity or incompatibility as a barrier. Some payer contracts mandate use of specific clearinghouses.
- Setup cost: reported at ~$10,000 per new clearinghouse onboarding for small practices — a significant barrier to adoption of any alternative, centralized or decentralized.
- The CAQH 2025 Index documents a 17% increase in administrative cost avoidance through electronic transactions, but no structural reform of clearinghouse concentration was reported.
  — [CAQH 2025 Index, Washington Today/National Today](https://nationaltoday.com/us/dc/washington/news/2026/02/24/2025-caqh-index-shows-u-s-healthcare-avoided-258-billion-and-accelerated-automation-interoperability-and-ai-adoption/)

---

**Design implication:** Provider appetite for decentralized clearinghouse alternatives is **not documented** in primary sources — the dominant market response is clearinghouse-to-clearinghouse redundancy (multi-vendor EDI contracts). Cliqueue's market narrative must NOT rely on providers actively seeking to replace clearinghouses with blockchain alternatives. The correct framing is that cliqueue sits **alongside** (not replacing) EDI clearinghouses: it adds an immutable settlement and audit layer after the 835 remittance, handles agentic negotiation, and anchors audit commitments on Somnia — while the EDI/clearinghouse layer (Waystar/Availity/etc.) continues to handle the 837/835 transport rail as before. The Change Healthcare breach validates the **audit-trail and decentralized settlement** value proposition (no single point of failure for settlement finality) but does not validate a "replace the clearinghouse" pitch.

**Open questions generated:**
1. Given that payer contract exclusivity clauses bind providers to specific clearinghouses (36% of AMA respondents), does cliqueue's on-chain settlement layer require explicit payer permission (or a contract amendment) before a hospital can add it alongside its existing clearinghouse arrangement — and should the hospital onboarding checklist include a legal review step? — priority: high
2. Does the CAQH CORE operating-rules framework create an affirmative obligation to route all claim status and remittance through certified clearinghouses — or is an on-chain settlement layer that supplements (not replaces) the EDI rail categorically outside CORE's scope? — priority: medium
3. With TriZetto/Waystar also breached in 2025–2026, is there a viable market entry strategy where cliqueue targets the ~14% of providers willing to submit claims directly to payers (bypassing clearinghouses entirely) as the early-adopter segment? — priority: medium

---

**See also** — [[../topics/x12|X12 hub]]
