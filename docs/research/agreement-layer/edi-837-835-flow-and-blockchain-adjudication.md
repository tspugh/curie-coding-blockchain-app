# EDI 837/835 Flow and Decentralized Claim Adjudication Precedents

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — EDI 837/835 end-to-end flow, friction points, and blockchain adjudication precedents

### EDI 837/835: the current settlement rails

- The **EDI 837** (HIPAA X12 5010) is the claim submission standard. Three variants: 837P (professional), 837I (institutional), 837D (dental). Key fields: submitter/receiver IDs, billing-provider NPI, ICD-10 diagnosis codes (HI segment), CPT/HCPCS procedure codes (SV1/SV2), service dates (DTP), subscriber info (SBR), charge totals (CLM). Claims transmit via clearinghouse or direct payer connection over SFTP or AS2.
  — [1EDIsource: EDI 837 overview](https://www.1edisource.com/resources/edi-transactions-sets/edi-837/); [MediBill RCM: ANSI X12 837 explained](https://www.medibillrcm.com/blog/ansi-x12-837-edi-file-format-healthcare-claims/)

- The acknowledgment chain before adjudication: **TA1** (envelope-level), **997/999** (functional — confirms syntactic validity), **277CA** (claim-level accept/reject). A syntactically valid but content-failing claim still gets a 277CA rejection; the provider must correct and resubmit within the timely-filing window.
  — [Accountable HQ: EDI files in healthcare](https://www.accountablehq.com/post/edi-files-in-healthcare-what-they-are-common-transactions-837-835-270-271-and-how-they-work)

- The **EDI 835** (Electronic Remittance Advice) closes the loop. It carries Claim Adjustment Reason Codes (CARCs) explaining payment reduction or denial, and Remittance Advice Remark Codes (RARCs) giving line-level context. The TRN trace number links the 835 to the EFT/ACH deposit. A single 837 may generate multiple 835 responses (split payments, partial adjudication); one 835 may cover multiple 837 claims.
  — [1EDIsource: EDI 835](https://www.1edisource.com/resources/edi-transactions-sets/edi-835/); [EDI Academy: 835 remittance](https://ediacademy.com/blog/understanding-835-remittance-advice/)

- Typical payment timeline: organizations on EDI 837 see payment in **~20 days** vs. weeks on paper; CAQH 2024 Index confirms "days" for clean electronic claims. Medicare timely-filing window is **365 days** from date of service; most commercial payers require filing within **90–180 days**; documentation attachments (supporting records) must arrive within **14 calendar days** of the electronic submission or the claim is denied.
  — [CAQH 2024 Index Report](https://www.caqh.org/hubfs/Index/2024%20Index%20Report/CAQH_IndexReport_2024_FINAL.pdf); [HealthQuestBilling: EDI 837 835](https://www.healthquestbilling.com/edi-837-835-improve-claim-payments/)

- The **276/277 claim-status pair** provides real-time tracking after submission; the **270/271 eligibility pair** validates coverage before submission and reduces front-end denials.
  — [Invene: 9 Healthcare EDI transactions](https://www.invene.com/blog/demystifying-healthcare-edi-the-9-critical-transactions-explained)

### Friction points in the current EDI flow (what an agreement layer replaces)

- **835/837 reconciliation mismatch**: a 835 ERA often does not match the original 837 one-for-one; multiple 835s per claim and aggregate 835s covering multiple claims create manual posting burden. Auto-posting fails when CARC/RARC codes are payer-specific and not standardized consistently.
  — [Streamline Health: 835 and 837 role](https://streamlinehealth.mdaudit.com/healthcare-claims-835-837/); [Prolisphere: 835 vs 837](https://www.prolisphere.com/835-vs-837-edi-files-healthcare/)

- **Adjustment code inconsistency**: CARCs and RARCs are standardized by X12 but applied inconsistently across payers. Providers must maintain payer-specific interpretation tables. This is a primary driver of manual rework.
  — [Cleo: EDI 835](https://www.cleo.com/edi-transactions/edi-835)

- **No immutable claim state**: the current EDI flow is a series of asynchronous message exchanges with no shared ledger. Either party can dispute what was transmitted; audit trails live in proprietary clearinghouse logs, not in a neutral store.

- **Prior-auth gap**: as of 2024, only ~35% of prior-authorization requests are fully electronic via X12 278; the rest are phone/fax. CMS-0057 mandates FHIR-based prior-auth APIs by January 2027, but the transition is incomplete.
  — [CAQH CORE Priority Topics](https://www.caqh.org/core/priority-topics); [Silna Health: prior authorization 2025](https://www.silnahealth.com/resources/everything-you-need-to-know-about-prior-authorization-in-2025/)

### Decentralized on-chain adjudication: what has been attempted

- **Hyperledger Fabric** is the most commonly deployed platform in academic and proof-of-concept healthcare blockchain work. Its permissioned model (role-based channel access) is preferred by insurers for HIPAA/GDPR alignment. No production deployment of Hyperledger Fabric for end-to-end claim adjudication and payment has been publicly confirmed as of early 2026.
  — [Frontiers in Blockchain 2025: Health insurance applications review](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1699290/full)

- **Aetna/IBM** and **Avaneer Health** (consortium: Aetna, Anthem, Cleveland Clinic) built permissioned-blockchain networks for claims transparency and administrative efficiency. Avaneer dissolved in 2023 after failing to achieve sufficient adoption — a critical precedent showing that even well-funded consortia cannot compel payer-provider network effects in a fragmented market.
  — [Frontiers in Blockchain 2025](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1699290/full)

- **Solve.Care** and **MediBloc** operate patient-data-ownership layers with wallet-based record sharing; neither implements end-to-end claim adjudication and fund release. Solve.Care focuses on care coordination and benefit management; MediBloc on EHR access control. Neither has publicly disclosed production claim-settlement volumes.
  — [Frontiers in Blockchain 2025](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1699290/full)

- **The Block-HI framework** (consortium blockchain for fraud detection): identifies duplicate cross-payer claims on-chain — the most concrete on-chain adjudication primitive documented in peer-reviewed literature. Still proof-of-concept; not deployed at a named insurer.
  — [Frontiers in Blockchain 2025](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1699290/full)

- **Tokenized claim settlement** (2026 Frontiers survey): smart contracts sequence five on-chain adjudication steps — (1) policy verification, (2) medical coherence check (diagnosis-procedure alignment), (3) duplicate detection via token uniqueness, (4) ML-linked fraud pattern matching, (5) conditional payment release. On-chain data: token metadata, hashes, state transitions, timestamps. Off-chain (IPFS or encrypted cloud): medical records, imaging, discharge summaries. This architecture is the closest documented precedent to cliqueue-coding-blockchain's target design.
  — [Frontiers in Blockchain 2026: Tokenization trends](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2026.1768301/full)

- **A public-NHI prototype** (Taiwan context) demonstrated >2,000 TPS at <1 s average latency under simulated peak load with a hybrid on-chain/IPFS architecture. This is a meaningful performance benchmark for comparison to Somnia's throughput claims.
  — [Frontiers in Blockchain 2025: NHI privacy](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1474434/full)

### Smart-contract failure modes from the literature

- **Oracle dependency**: any claim that involves off-chain facts (coding outcome, clinical review decision) requires a trusted oracle. Oracle compromise or delay is the primary attack surface for conditional payment release.
- **Immutability vs. correction**: once a smart contract is deployed, bugs cannot be patched; funds locked in a flawed escrow may be irrecoverable. Upgradeable proxy patterns (e.g., OpenZeppelin Transparent Proxy) mitigate but add governance complexity.
- **Private key management**: hospital and insurer agent wallets are high-value targets; key loss equals fund loss with no recourse.
- **Regulatory immutability conflict**: GDPR "right to be forgotten" and HIPAA amendment rights conflict with blockchain's append-only model; hash-based off-chain storage with on-chain pointers is the accepted mitigation but requires careful key management so the off-chain record can be de-linked.
  — [Frontiers in Blockchain 2026 tokenization survey](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2026.1768301/full); [ScienceSoft: Smart contracts in insurance](https://www.scnsoft.com/insurance/smart-contracts)

### FHIR Financial and the emerging non-EDI rails

- The **Da Vinci Project** (HL7) is building FHIR-based payer data exchange (PDex) and prior-auth APIs. CMS-0057 mandates FHIR prior-auth by 2027; claim-level FHIR is an active workstream but not yet mandated.
  — [Da Vinci PDex IG](https://build.fhir.org/ig/HL7/davinci-epdx/); [CAQH CORE 2025 operating rules](https://www.caqh.org/core/operating-rules)

- The **global healthcare EDI market** is $4.72 billion in 2025, growing to $7.72 billion by 2030 (~10.3% CAGR). EDI rails are not going away; any blockchain adjudication layer must coexist with or wrap existing EDI flows for the foreseeable future.
  — [MarketsandMarkets via IntuitionLabs](https://intuitionlabs.ai/articles/x12-edi-transactions-guide)

**Design implication:** The on-chain agreement layer in cliqueue-coding-blockchain should model the 837 claim submission as a hashed, signed event on Somnia (not raw EDI fields), the payer adjudication decision as an on-chain attestation, and the 835 remittance as an on-chain payment event — replacing the asynchronous, mutable EDI message exchange with an immutable state machine. The five-step tokenized adjudication sequence from the 2026 Frontiers survey maps directly onto smart-contract states. The Avaneer failure confirms that adoption requires network-effect bootstrapping; cliqueue should target a single payer-provider bilateral pilot before any consortium design. Oracle design for the ICD-10 coding outcome (the coding agent's output) is the critical trust boundary.

**Open questions generated:**
1. What specific Somnia smart-contract architecture (AgentExecutor / AgentVault patterns from somnia-agent-kit) best encodes the five adjudication states: submitted → adjudicated → attested → disputed → settled? What gas costs emerge per state transition at Somnia's TPS?
2. For the oracle that bridges the off-chain coding agent output to the on-chain adjudication event, what attestation scheme (multi-sig, ZK proof of correct coding, threshold signature) provides sufficient trust without requiring PHI on-chain?
3. How should the on-chain 837-equivalent event be structured to interoperate with existing EDI clearinghouses during a phased adoption period where payers still require X12 835 remittance for their accounting systems?

---

**See also** — [[../topics/x12|X12 hub]]
