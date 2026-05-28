# Payer Contract Attestation Exhibit — Does On-Chain SBT Attestation Satisfy Humana/Cigna Credentialed Coder Requirement?

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should cliqueue's hospital BAA include a "Payer Contract Attestation Exhibit" documenting that the SBT on-chain attestation satisfies Humana/Cigna's credentialed coder review contractual requirement — and has any healthcare attorney published analysis of whether on-chain attestation satisfies payer contract language requiring "validated by credentialed coders"?

### Background

Prior research established that Humana and Cigna have contractual (not regulatory) credentialed coder attestation requirements for AI-coded claims, and that cliqueue's on-chain SBT attestation is a technically stronger proof than PDF workflow attestation. The open question is whether a Payer Contract Attestation Exhibit should be added to the hospital BAA, and whether any healthcare attorney has analyzed whether on-chain cryptographic attestation satisfies typical payer contract language.

---

### Finding 1: Humana and Cigna credentialed coder attestation requirements are contractual, not regulatory — and their exact contract language is not publicly available

- Both Humana and Cigna require providers to attest that AI-generated codes have been validated by credentialed coders before a claim can drop. These are contractual obligations embedded in provider agreements, not CMS or HHS regulations. A breach triggers contract remedies (recoupment, contract termination) not automatic FCA liability.
  — Source: [CodingNetwork: Human Oversight in AI Medical Coding 2025](https://codingnetwork.com/why-human-oversight-in-ai-medical-coding-remains-essential-in-2025/); [2026 Guide to AI in Medical Coding](https://helpsquad.com/blog/the-2026-guide-to-ai-in-medical-coding/)

- **The exact contractual language is not publicly available.** Humana's 2025 Provider Manual (available at assets.humana.com) and Cigna's provider contract are not indexed in a form that reveals the specific clause text for AI-coding attestation requirements. What is documented in industry literature is the functional requirement ("validated by credentialed coders") not the clause's exact definition of "attestation," "validated," or "credentialed."
  — Source: [Humana 2025 Provider Manual](https://assets.humana.com/is/content/humana/FINAL589003ALL1024_2025_ProviderManualNonDelegatedpdf); [CodingNetwork AI Compliance 2025](https://codingnetwork.com/ai-medical-coding-is-fast-until-compliance-slows-you-down/)

- **No healthcare attorney has published a legal opinion analyzing whether on-chain cryptographic attestation satisfies payer contract language.** The body of healthcare attorney AI coding analysis (Tucker Ellis LLP, ArentFox Schiff, Foley & Lardner, O'Melveny) focuses on FCA liability from AI upcoding, not on whether blockchain attestation satisfies payer-contract validation clauses.
  — Source: [Tucker Ellis: Avoiding FCA Landmines](https://www.tuckerellis.com/alerts/avoiding-false-claims-act-landmines-in-ai-assisted-coding-and-medical-billing/); [ArentFox Schiff: FCA Enforcement 2026](https://www.afslaw.com/perspectives/alerts/false-claims-act-enforcement-2026-focus-dei-ai-fraud); [Foley & Lardner: FCA 2026](https://www.foley.com/insights/publications/2026/03/false-claims-act-enforcement-in-2026-2/)

---

### Finding 2: On-chain SBT attestation is legally stronger than PDF workflow attestation under E-SIGN Act / UETA

- Under the Electronic Signatures in Global and National Commerce Act (E-SIGN, 15 U.S.C. § 7001) and the Uniform Electronic Transactions Act (UETA), electronic records and signatures have the same legal effect as handwritten signatures if the parties have consented to electronic transactions and the record can be retained and accurately reproduced.
  — Source: [HIPAA Journal: E-Signatures in Healthcare 2026](https://www.hipaajournal.com/can-e-signatures-be-used-under-hipaa-rules-2345/); [Buchanan Ingersoll: Electronic Records and HIPAA](https://www.bipc.com/electronic-records-and-signatures-in-healthcare-and-the-interplay-of-e-sign,-hipaa-and-ueta)

- Multiple states (Arizona, Nevada, Tennessee) have amended their UETA implementations to expressly recognize blockchain-based signatures and smart contract terms as compliant electronic records under UETA. The E-SIGN Act's federal floor applies nationally.
  — Source: [University of Cincinnati: E-SIGN Act and Smart Contracts 2025](https://ucipclj.org/2025/04/16/the-e-sign-act-in-the-age-of-smart-contracts-and-ai-challenges-and-opportunities/)

- An on-chain SBT attestation provides four properties that a PDF workflow attestation cannot: (1) tamper-evident immutability (the attestation hash cannot be retroactively altered); (2) credentialed-attestor proof (the attestor's SBT holds the hospital-verified credential binding their address to a CCS/RHIA credential number); (3) timestamped with blockchain finality (BFT-final on Somnia at 100ms); (4) independently verifiable by any party with a Somnia RPC endpoint, including the payer, without cliqueue intermediation.
  — Source: [Chainlink: Compliance Attestation On-Chain](https://chain.link/article/compliance-attestation); [ScoreDetect: Blockchain E-Signatures Regulatory Standards](https://www.scoredetect.com/blog/posts/how-blockchain-meets-regulatory-standards-for-esignatures)

- The strongest legal risk for on-chain attestation satisfying payer contract clauses is **contract interpretation ambiguity**: if the payer contract specifies that "validation" requires a specific workflow (e.g., attesting in the hospital's EHR audit log, or signing a specific paper form), then a blockchain attestation that does not match that workflow may not satisfy the clause even if it is legally equivalent as an electronic signature. This is a contract-language-specific risk, not a blockchain-specific legal barrier.
  — **Weakly sourced**: no attorney opinion directly on this point. Risk assessment is inference from general contract-interpretation principles.

---

### Finding 3: CMS Medicare signature requirements establish "authenticated by" as an acceptable electronic attestation — this standard is a useful analogy for payer contract compliance

- CMS Medicare signature policy (MLN905364) explicitly accepts electronic attestation including "Electronically signed by," "Authenticated by," "Approved by," "Completed by," "Finalized by," or "Validated by" — followed by the practitioner's name, credentials, and date signed.
  — Source: [CMS: Complying with Medicare Signature Requirements (MLN905364)](https://www.cms.gov/files/document/mln905364-complying-medicare-signature-requirements.pdf)

- The CMS standard does not require a specific technology (EHR, paper, blockchain) — it requires attribution, credentialing, and timing. An on-chain SBT attestation satisfies all three elements: the attestor's wallet address is mapped to their CCS/RHIA credential number in the SBTRegistry (attribution + credentialing), and the block timestamp provides timing. This analogy supports the argument that on-chain attestation is a legally sufficient form of "validated by credentialed coders."
  — Source: [CMS Humana Signature Requirements](https://assets.humana.com/is/content/humana/ProviderSignatureRequirementspdf); [CMS MLN905364](https://www.cms.gov/files/document/mln905364-complying-medicare-signature-requirements.pdf)

- **However**: payer contracts for commercial (non-Medicare) claims are not bound by CMS signature standards. The Medicare analogy is persuasive, not controlling. Hospital counsel must evaluate whether each payer's contract language is satisfied by the electronic attestation form.

---

### Finding 4: No existing published template for a "Payer Contract Attestation Exhibit" in a hospital-vendor BAA for AI coding with blockchain attestation

- Reviewed BAA structure literature (OpenAI Healthcare Addendum, scribing.io BAA requirements for AI medical scribes, Censinet AI vendor compliance checklist) — none includes a payer-contract-facing attestation exhibit. This is a novel document type for the AI coding + blockchain context.
  — Source: [OpenAI Healthcare Addendum](https://cdn.openai.com/osa/healthcare-addendum.pdf); [Scribing.io: BAA Requirements for AI Medical Scribes](https://www.scribing.io/blog/baa-requirements-ai-medical-scribes); [Censinet: AI Vendor Compliance Checklist](https://censinet.com/perspectives/ai-vendor-compliance-checklist-healthcare)

- ArentFox Schiff's analysis of AI service agreements in healthcare (2025) identifies "indemnification clauses" as the primary emerging issue — not blockchain attestation satisfying payer contracts. The cliqueue use case is ahead of published attorney guidance.
  — Source: [ArentFox Schiff: AI Service Agreements in Health Care](https://www.afslaw.com/perspectives/health-care-counsel-blog/ai-service-agreements-health-care-indemnification-clauses)

---

### Finding 5: The "Payer Contract Attestation Exhibit" is a viable and necessary product document — recommended structure

- Given that (a) Humana/Cigna contractual language is not public, (b) no attorney has published analysis of blockchain attestation satisfying those clauses, and (c) the Medicare analogy is persuasive but not controlling, the most prudent approach is:
  1. **Hospital-specific payer contract review** — the onboarding checklist must include a step where hospital counsel reviews their specific executed Humana/Cigna agreement for the exact attestation-of-AI-coding clause.
  2. **Payer Contract Attestation Exhibit in the hospital BAA** — a one-to-two-page exhibit in the hospital-cliqueue BAA that:
     - Identifies the payer contracts under which the hospital is obligated (Humana contract dated X, Cigna contract dated Y).
     - States that the hospital has reviewed those contracts and represents that its credentialed attestors using the SBTRegistry satisfy the "validated by credentialed coders" requirement.
     - Documents the credential-to-SBT mapping (coder name, credential type, credential number, expiry, attestor address in SBTRegistry).
     - States that the hospital (not cliqueue) is responsible for ensuring payer contract compliance, and that cliqueue provides the on-chain attestation infrastructure but does not provide legal advice.
  3. **External counsel legal opinion letter** (outside cliqueue) — for Humana/Cigna-contracted hospitals, cliqueue should recommend (not require) that hospital counsel obtain a brief legal opinion from a healthcare attorney confirming that the on-chain SBT attestation satisfies the payer's specific contract language. This is the same risk-management approach taken by hospitals deploying any new technology in a payer-contract-sensitive area.
  — Source: ArentFox Schiff AI Service Agreements analysis (above); general contract-law inference.

---

**Design implication:** The Payer Contract Attestation Exhibit should be a standard addendum in the hospital-cliqueue BAA, structured to shift the payer-contract compliance representation onto hospital counsel (not cliqueue), while documenting the on-chain credential mapping that enables the representation. cliqueue should market the SBTRegistry as a "payer contract compliance artifact" — the on-chain attestation provides stronger evidentiary properties than a PDF workflow — but should not make legal representations about its sufficiency. The exhibit is a hospital-representation document, not a cliqueue warranty. No healthcare attorney has published analysis of this specific question as of May 2026; cliqueue should proactively engage outside healthcare counsel to commission the first published opinion, which would become a go-to-market differentiator.

**Open questions generated:**
1. Should cliqueue commission an outside healthcare attorney to publish an opinion letter (not internal memo) specifically analyzing whether an on-chain SBT attestation with a registered CCS/RHIA credential number satisfies typical Humana and Cigna payer contract language requiring "validated by credentialed coders" — and would publishing this opinion strengthen the go-to-market story for revenue cycle directors?
2. Should the Payer Contract Attestation Exhibit be a one-page exhibit in the hospital BAA, or a standalone legal document separate from the BAA (given that it addresses payer-contract compliance, not HIPAA BA obligations) — and does separating it from the BAA reduce cliqueue's exposure if the exhibit's representations later prove insufficient for a specific payer contract?
3. Should cliqueue's onboarding checklist include a step explicitly flagging Humana and Cigna as payers requiring the Attestation Exhibit — with a separate simplified workflow for hospitals that contract only with UHC, Aetna, or BCBS (where no published credentialed coder attestation contractual requirement exists as of May 2026)?

---

**See also** — [[../topics/sbt|SBT hub]]
