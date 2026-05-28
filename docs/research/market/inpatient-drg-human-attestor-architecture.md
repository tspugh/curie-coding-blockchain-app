# Inpatient DRG Human-Attestor Architecture — AI Coding Oversight Requirements

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should cliqueue include a "human-attestor" agent role (certified RHIA/CCS coder signing on-chain) alongside the AI coding agent for inpatient claim types, given AHIMA's framework requiring human DRG reconciliation?

### Finding 1: No federal regulation mandates universal human review of AI-coded inpatient claims — but payer contracts and OIG guidance create a de facto requirement

- As of May 2026, no U.S. federal regulation mandates universal human review of AI-autonomously coded inpatient claims. CMS's FY 2026 IPPS final rule (effective October 1, 2025) did not include new autonomous coding oversight requirements; an anticipated autonomous coding guidance notice in the proposed rule was not finalized with human-review mandates.
  — Source: https://www.kha-net.org/Communications/CurrentReportArticles/CMS-Releases-FY-2026-IPPS-Final-Rule_175664.aspx; https://codingnetwork.com/why-human-oversight-in-ai-medical-coding-remains-essential-in-2025/
  — Assessment: High confidence. Multiple sources confirm absence of a federal mandate as of this date.

- HHS OIG's November 2023 General Compliance Program Guidance warns: "automation without human supervision can spread errors faster than people can correct them." It explicitly assigns residual responsibility to the human signer of the claim regardless of whether an algorithm touched the chart. This guidance is not a mandate but creates audit exposure for fully unreviewed AI-coded inpatient claims.
  — Source: https://codingnetwork.com/why-human-oversight-in-ai-medical-coding-remains-essential-in-2025/
  — Assessment: High confidence. OIG guidance language is consistent across multiple industry summaries.

- Humana and Cigna (Medicare Advantage plans) have, as of Q2 2025, added contract language requiring providers to "attest that AI-generated codes have been validated by credentialed coders." These are payer-specific contractual obligations, not federal mandates, but they apply to the majority of MA plan encounters at participating hospitals.
  — Source: https://codingnetwork.com/why-human-oversight-in-ai-medical-coding-remains-essential-in-2025/; https://www.billingparadise.com/blog/medical-ai-coding-hybrid-model-q3-2025/
  — Assessment: Moderate confidence. Industry summaries reference this contract language but exact contractual text is not publicly available.

### Finding 2: AHIMA's framework for autonomous inpatient coding is an opinion piece, not binding policy — but the ethical coding standards place legal responsibility on the signing coder

- The Journal of AHIMA published "A Framework for Autonomous Coding in the Inpatient Setting" (August 2024) as an opinion piece with an explicit disclaimer: "The opinions here reflect the author and not AHIMA." This document does not constitute AHIMA's official position on human-review requirements for inpatient DRG coding.
  — Source: https://journal.ahima.org/page/a-framework-for-autonomous-coding-in-the-inpatient-setting
  — Assessment: High confidence. The disclaimer is explicit on the page.

- AHIMA's Standards of Ethical Coding require coding professionals to "assign and report only the codes and data that are clearly and consistently supported by health record documentation." These standards ethically bind the certified coder who signs the claim — not the AI system. When a coder attests an AI-generated code, they assume full ethical and legal responsibility for that code. This creates a structural requirement: if no human signs an inpatient claim, no one bears AHIMA-recognized professional ethical responsibility for the DRG assignment.
  — Source: https://medlearn.com/ahima-revises-standards-of-ethical-coding/; AHIMA Standards of Ethical Coding (2024 revision)
  — Assessment: High confidence. The ethical responsibility framework is consistent across AHIMA literature.

### Finding 3: Inpatient DRG autonomous coding autonomy rates are structurally lower than outpatient — the "holy grail" framing confirms inpatient is not yet a solved problem

- Fathom describes inpatient autonomous DRG coding as the "holy grail" of coding automation — still aspirational as of late 2025. Fathom's March 2026 deployment at "Your Health" achieved 95.5% automation rate across all service lines, but this includes outpatient-heavy specialties. No vendor has published a standalone inpatient DRG autonomous autonomy rate above 90%.
  — Source: https://www.fathomhealth.com/insights/the-holy-grail-of-coding-automation-and-why-inpatient-ai-is-around-the-corner-fathom-featured-in-hit-consultant; https://hitconsultant.net/2026/03/19/fathom-autonomous-medical-coding-your-health-35m-revenue-ai/
  — Assessment: High confidence. "Holy grail" language is Fathom's own framing in a public bylined piece.

- R1 RCM's acquisition of Phare Health (2025) targets "automating inpatient coding and pre-bill CDI." R1 reports 97% accuracy for ED and physician office coding — but explicitly excludes inpatient from its stated accuracy benchmarks in press releases.
  — Source: https://www.r1rcm.com/news-and-press/r1-to-acquire-phare-health-a-leading-ai-platform-for-automating-inpatient-coding-and-pre-bill-clinical-documentation-improvement/
  — Assessment: High confidence. The omission of inpatient accuracy from the press release is meaningful.

- Nym Health's autonomous coding engine "evaluates each patient encounter comprehensively, adhering to APC/DRG coding guidelines" — but positions human coders as focusing on "the most complex cases," implying a hybrid model where some inpatient cases bypass human review and others do not. Nym does not claim zero human intervention for all inpatient DRG assignments.
  — Source: https://blog.nym.health/inpatient-vs.-outpatient-facility-coding
  — Assessment: Moderate confidence. Nym's marketing language is deliberately ambiguous.

### Finding 4: The on-chain human-attestor role is commercially differentiated and not made irrelevant by Fathom's inpatient DRG progress

- Fathom's forthcoming inpatient DRG capability (if launched in 2026) does not include an on-chain attestation layer. It replaces the coding workflow but delivers output through existing EDI/clearinghouse channels. Cliqueue's value proposition is orthogonal: not "better coding" but "tamper-resistant credentialed attestation of the coding decision anchored on a neutral settlement chain." Humana/Cigna's contractual requirement for credentialed coder attestation creates a market pull for exactly this pattern.
  — Source: https://www.billingparadise.com/blog/medical-ai-coding-hybrid-model-q3-2025/; https://fathomhealth.com/insights/the-holy-grail-of-coding-automation-and-why-inpatient-ai-is-around-the-corner-fathom-featured-in-hit-consultant
  — Assessment: Moderate confidence. This is an inference from the absence of on-chain attestation in vendor offerings.

- Prior research (docs/research/market/inpatient-coding-performance-and-market-consolidation.md) confirmed: "AHIMA requires human DRG reconciliation (no fully autonomous inpatient coding)." This finding remains consistent with the current search: no federal regulation mandates human review, but AHIMA's ethical standards structurally require a credentialed human to bear responsibility for any DRG code submitted under their attestation.

### Finding 5: Architecture implication — the human-attestor role is required for inpatient but can be lightweight (confidence-threshold-gated) rather than review-all

- All industry deployments use a confidence-threshold hybrid model: AI handles high-confidence encounters autonomously; low-confidence/complex cases are flagged for human coder review. This is the production model at Fathom, CodaMetrix, Nym, and R1. The human coder does not review every claim — they review flagged claims and attest the final code set.
  — Source: https://www.rapidclaims.ai/blogs/improving-drg-assignment-with-ai-the-future-of-inpatient-coding; https://www.billingparadise.com/blog/medical-ai-coding-hybrid-model-q3-2025/

- For cliqueue's on-chain design: the `HumanAttestor` role (SBT-gated RHIA/CCS credential, enforced in `ClaimsAdjudicator`) should be required for all inpatient DRG claims — but the attestor's workflow is: (a) AI coder (Corti Symphony) returns codes + confidence, (b) if confidence >= threshold, attestor signs the `claimId` commitment on-chain with a single transaction, (c) if confidence < threshold, attestor reviews full chart before signing. The on-chain signature is the compliance artifact that satisfies Humana/Cigna contract language and AHIMA ethical standards simultaneously.

**Design implication:** The human-attestor SBT architecture already in the research docs is the correct design for inpatient claims. It is NOT made irrelevant by Fathom's inpatient DRG progress — cliqueue's on-chain attestation satisfies payer contract requirements (Humana/Cigna credentialed coder attestation clauses) that Fathom's off-chain workflow does not. The attestor role should be mandatory for all inpatient DRG claims and optional (confidence-threshold-gated) for outpatient/ED claims. This creates a clear inpatient/outpatient split in `ClaimsAdjudicator` logic.

**Open questions generated:**
1. Should `ClaimsAdjudicator` enforce a `claimType` field (inpatient/outpatient) at submission time that gates the `requiresHumanAttestation` flag — so the contract enforces the regulatory distinction automatically and a hospital cannot submit an inpatient DRG claim without a valid SBT holder signing? — priority: high
2. Does the Corti Symphony MCP tool return a confidence score (0.0–1.0) per code alongside the code array — enabling the attestor's off-chain agent to programmatically decide whether the claim routes to human review before the on-chain commitment? — priority: high
3. Given Humana/Cigna's contractual requirement for credentialed coder attestation of AI-coded claims, should cliqueue market the SBTRegistry + on-chain attestation as a compliance artifact for payer contract purposes — and is there a case for publishing a one-page "Attestation Compliance Brief" for hospital revenue cycle directors? — priority: medium

---

**See also** — [[../topics/sbt|SBT hub]] · [[../topics/corti|Corti hub]]
