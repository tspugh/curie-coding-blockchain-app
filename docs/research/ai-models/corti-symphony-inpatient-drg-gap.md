# Corti Symphony Inpatient / DRG Performance Gap and Human-Attestor Requirements

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — Does Corti Symphony's 65.2% F1 on full clinical notes hold for inpatient DRG-determination coding, or does the performance gap vs. commercial CAC require Symphony to be supplemented with a human-attestor agent role for inpatient claims?

### Finding 1: Symphony's inpatient (MDACE) F1 is 0.58 — 22% below its outpatient headline figure

- On the MDACE benchmark (302 inpatient charts from MIMIC-III), Symphony achieves **F1 = 0.58** for ICD-10-CM diagnosis codes and **F1 = 0.37** for ICD-10-PCS procedure codes. These are state-of-the-art scores, beating all prior published systems (MedDCR 0.51, PLM-ICD 0.48, GPT 0.30 on PCS).
  — [Corti: Symphony research page](https://www.corti.ai/stories/research-symphony-for-medical-coding); [Corti PR Newswire release](https://www.prnewswire.com/news-releases/corti-ships-symphony-for-medical-coding-with-more-than-25-accuracy-edge-over-openai-and-anthropic-302730387.html)
- The 65.2% F1 headline figure is ambulatory data (2.25M clinical notes from a large US provider); inpatient F1 is **10.6 percentage points lower** (0.58 vs 0.74 on ACI-Note outpatient benchmark), a 22% relative gap.
  — [Corti benchmarks page](https://www.corti.ai/benchmarks)
- The lower inpatient performance is structurally explained: inpatient records span multiple note types (H&P, discharge summary, operative report, progress notes) that must be concatenated for complete code capture, and codes are "frequently missing when individual note types are evaluated in isolation."
  — [Corti Symphony research page](https://www.corti.ai/stories/research-symphony-for-medical-coding)

### Finding 2: DRG determination is NOT a coding task — it is a separate deterministic grouper step that Symphony does not address

- MS-DRG assignment is not an ICD-10 code selection task. It is a CMS-defined **deterministic grouper algorithm** that accepts the finalized ICD-10-CM/PCS code set and outputs a single MS-DRG. The CMS MS-DRG Definitions Manual governs the grouper logic.
  — [CMS: MS-DRG Classifications and Software](https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/ms-drg-classifications-and-software)
- Neither Symphony nor any other AI medical coding vendor claims to replace the MS-DRG grouper. Symphony's `/tools/coding/` endpoint produces ICD-10-CM and ICD-10-PCS code arrays; the DRG is then derived by running those codes through the standard grouper.
  — Cross-referenced with [Corti developer guide](https://www.corti.ai/guides/a-developers-guide-to-integrating-medical-coding-capabilities)
- **Design implication for cliqueue**: The `ClaimsAdjudicator` contract does not need a "DRG field" from Symphony. It receives an ICD-10 code array hash. MS-DRG calculation (if needed for payment amount determination) is a deterministic off-chain computation that can be reproduced by any party with the code set.

### Finding 3: The "Code Like Humans" authors (Symphony's underlying framework) state no current system is ready to replace human coders

- The EMNLP 2025 paper "Code Like Humans" — the foundation of Symphony — explicitly states: **"none of the existing approaches are ready for real-world deployment as a replacement for human coders"** and recommends reconceptualizing the task as "assisting the human coders" through computer-aided workflows.
  — [Code Like Humans arxiv paper](https://arxiv.org/html/2509.05378v3)
- On the MDACE inpatient dataset with the full 70,000-label ICD-10 space, CLH-large achieves F1 micro = 0.32, F1 macro = 0.14. The constrained 1K-label evaluation (most common codes only) yields F1 micro = 0.43.
  — [Code Like Humans arxiv paper](https://arxiv.org/html/2509.05378v3)
- **Weakly sourced caveat**: These figures are from the pre-production academic version of the model; the commercially deployed Symphony may significantly outperform the published CLH-large due to proprietary training improvements not reflected in the paper.

### Finding 4: Humana and Cigna (Q2 2025) require credentialed-coder attestation for AI-coded claims — contractual, not federal

- As of Q2 2025, Humana and Cigna require providers to **attest that AI-generated codes have been validated by credentialed coders** in their provider contracts. This is a contractual payer requirement, not a federal CMS mandate.
  — [Coding Network: Why Human Oversight in AI Medical Coding Remains Essential in 2025](https://codingnetwork.com/why-human-oversight-in-ai-medical-coding-remains-essential-in-2025/)
- No U.S. federal regulation currently mandates universal human review of AI-coded claims as of May 2026, but the FY2026 IPPS final rule (effective Oct 2025) and CMS guidance signal increased scrutiny. State-level disclosure requirements are emerging (California AB 3030, Texas H 4635).
  — [CMS FY2026 IPPS Final Rule](https://www.cms.gov/newsroom/fact-sheets/fy-2026-hospital-inpatient-prospective-payment-system-ipps-and-long-term-care-hospital-prospective-0)
- A DOJ settlement for $23 million in 2025 involved an automated system that **up-coded emergency department visits** — an active enforcement signal that autonomous coding without human oversight creates material False Claims Act (FCA) exposure.
  — [Coding Network article](https://codingnetwork.com/why-human-oversight-in-ai-medical-coding-remains-essential-in-2025/)

### Finding 5: Commercial CAC vendors with 95%+ automation rates have not achieved this for inpatient DRG facility coding

- Fathom's publicized 95.5% automation / 98.3% accuracy (Your Health deployment, March 2026) covers **senior-focused primary and specialty care** settings — not inpatient hospital facility DRG coding. Fathom states it is developing autonomous inpatient DRG coding "in partnership with a consortium of large health systems and academic medical centers" — indicating this capability does not yet exist in production.
  — [HIT Consultant: Your Health Fathom deployment](https://hitconsultant.net/2026/03/19/fathom-autonomous-medical-coding-your-health-35m-revenue-ai/)
- CodaMetrix reports 98% average coding accuracy and 70% reduction in manual workload across 500+ hospitals, but does not publish disaggregated inpatient DRG automation rates separate from outpatient/ED.
  — [CodaMetrix website](https://www.codametrix.com/for-health-systems)
- The 41.8% of complex inpatient cases flagged for review (2025 AI DRG study, AUC 0.88) implies that a meaningful fraction of inpatient claims still require human attention even with advanced AI assistance.
  — [JMIR Human Factors Taiwan DRG study](https://humanfactors.jmir.org/2025/1/e59961/)

### Finding 6: AHIMA/AAPC hybrid model is the de facto industry standard; no professional body has certified fully autonomous inpatient coding

- AHIMA and AAPC jointly endorse a **hybrid model** for AI coding: AI handles high-confidence routine coding; credentialed coders (CCS for inpatient IPPS, CIC for outpatient facility) review complex or flagged cases.
  — [Coding Network: Why Human Oversight Remains Essential](https://codingnetwork.com/why-human-oversight-in-ai-medical-coding-remains-essential-in-2025/)
- The AHIMA Journal framework piece on autonomous inpatient coding is an **opinion piece, not official AHIMA policy**. No official AHIMA policy mandating human DRG reconciliation was found in this research pass. However, the general professional standard that inpatient IPPS claims require CCS-credentialed coder oversight is well-established in the industry.
  — [AHIMA Journal: A Framework for Autonomous Coding in the Inpatient Setting](https://journal.ahima.org/page/a-framework-for-autonomous-coding-in-the-inpatient-setting)

---

### Design Implications for cliqueue

**Immediate implication:** Symphony at F1=0.58 on inpatient data is insufficient as a standalone autonomous coder for hospital facility inpatient claims. The two-tier pipeline (Symphony as primary coder + Somnia native Agents for consensus validation) is validated for **outpatient and ED service lines** but requires a **human-attestor agent role** for inpatient DRG facility claims to satisfy Humana/Cigna contractual requirements and to manage FCA exposure.

**Architecture consequence:** cliqueue should implement a `ClaimType` flag on the on-chain struct (outpatient | inpatient-facility | inpatient-professional) that gates the coding agent workflow: outpatient/ED claims proceed to Somnia native consensus immediately; inpatient-facility claims require an additional `HumanAttestor.attest(claimId, attestorCredentialHash)` transaction before the claim can transition from `Coded` to `Adjudicated` state.

**DRG does not require a new field:** DRG is deterministic from the ICD-10 code array and is computable off-chain by both the hospital and payer systems. The on-chain `icd10CodeHash` is sufficient for settlement; no `drgCode` field is needed in the Claim struct.

**Design implication:** Add a `ClaimType` enum and gated `HumanAttestor` role to the `ClaimsAdjudicator` contract for inpatient-facility claims; outpatient/ED claims retain the fully autonomous two-tier pipeline. This keeps MVP scope tractable (start with outpatient) while preserving inpatient expansion via the attestor role.

**Open questions generated:**

1. What on-chain credential representation is appropriate for a `HumanAttestor` — an AHIMA CCS registry number (PII, cannot go on-chain), a hash of (credentialNumber + attestorAddress + claimId), or a delegated credential NFT issued per hospital's credentialing authority?
2. Does Fathom's forthcoming inpatient DRG autonomous coding capability (currently "in development") represent a competitive threat that makes cliqueue's inpatient attestor-role differentiation irrelevant, or does the on-chain settlement layer remain orthogonal to whichever AI coder is used?
3. Given that payer contracts (Humana, Cigna) already require credentialed-coder attestation for AI-coded claims, does anchoring that attestation on-chain (rather than in a paper/PDF workflow) represent sufficient value-add to justify the human-attestor agent role as a product feature?

---

**See also** — [[../topics/corti|Corti hub]] · [[../topics/sbt|SBT hub]]
