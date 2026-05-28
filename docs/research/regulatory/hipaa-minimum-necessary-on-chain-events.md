# HIPAA Minimum Necessary Standard — On-Chain Event Visibility

Research findings for cliqueue-coding-blockchain. Investigates whether §164.502(b) Minimum Necessary constrains who can observe on-chain HMAC hashes, ICD-10 code arrays, and payment amounts emitted as Somnia public events.

---

## 2026-05-15 — Does HIPAA's Minimum Necessary standard (§164.502(b)) constrain who can observe on-chain HMAC hashes, ICD-10 codes, and payment amounts emitted as Somnia public events?

### The core legal question

Somnia is a public blockchain: any internet participant can observe every emitted event — including `ClaimSettled(claimId, icd10CodeHash, billedCents, adjudicatedCents, payerHash, providerHash)` — without authentication. Does HIPAA §164.502(b) require cliqueue to restrict visibility of these fields to only the parties who need them for payment processing?

### Threshold finding: Minimum Necessary applies only to PHI

- 45 CFR §164.502(b) states that the Minimum Necessary standard applies to **uses and disclosures of protected health information**. The regulation explicitly scopes it to PHI.
  — [45 CFR §164.502, Cornell LII](https://www.law.cornell.edu/cfr/text/45/164.502)

- 45 CFR §164.502(d)(2) clarifies: health information that meets the de-identification standard under §164.514(a)-(b) is **"not individually identifiable health information,"** and the Privacy Rule's requirements (including Minimum Necessary) do **not apply** to it.
  — [45 CFR §164.514, Cornell LII](https://www.law.cornell.edu/cfr/text/45/164.514)

- Confirmed by practitioner sources: "Fully de-identified data falls outside HIPAA; it requires no DUA and is not subject to HIPAA's accounting of disclosures or minimum necessary rules."
  — [AccountableHQ, 45 CFR 164.514 Explained](https://www.accountablehq.com/post/45-cfr-164-514-explained-hipaa-s-rules-on-de-identification-re-identification-and-limited-data-sets)

**Conclusion:** If the on-chain data does not constitute PHI, the Minimum Necessary standard is inapplicable. The question reduces to: are cliqueue's on-chain event fields PHI?

### Are cliqueue's on-chain event fields PHI?

Applying the statutory definition of PHI — "individually identifiable health information" (health information that identifies or could identify an individual):

| On-chain Field | PHI Status | Rationale |
|---|---|---|
| `claimId` = HMAC-SHA256(CLM01, secret key) | **Not PHI** | Keyed hash; non-reversible without secret key held in hospital/payer HSM; satisfies expert determination method (§164.514(b)(1)) per prior research |
| `icd10CodeHash` = keccak256(code array) | **Not PHI** | Hash of code array without patient linkage; codes alone are not individually identifiable (see below) |
| ICD-10 code array (raw, if emitted) | **Not PHI when unlinked** | Diagnosis codes are not PHI in isolation; PHI requires combination with a patient identifier. "A broken leg is not PHI. Mr. Jones has a broken leg is PHI." — [HIPAA Journal, What is Considered PHI](https://www.hipaajournal.com/considered-phi-hipaa/) |
| `billedCents`, `adjudicatedCents` | **Not PHI when unlinked** | Payment amounts without patient linkage are financial data, not individually identifiable health information. ICD-10 diagnosis codes are not among the 18 Safe Harbor identifiers; nor are payment amounts. — [45 CFR §164.514(b)(2)(i) via Cornell LII](https://www.law.cornell.edu/cfr/text/45/164.514) |
| `payerHash`, `providerHash` | **Not PHI** | Hashes of organizational identifiers (payer/provider NPIs are public record); do not identify patients |
| Raw 837 EDI, patient name, member ID | **PHI — must never go on-chain** | Contains 18 safe-harbor identifiers; per prior research (hipaa-blockchain-hash-anchoring.md) |

### The BAA impossibility problem supersedes Minimum Necessary

Even if fields were PHI, the primary structural HIPAA constraint for public blockchains is not Minimum Necessary — it is the **BAA impossibility**:

- A covered entity that discloses PHI to a third party that performs functions on its behalf must have a Business Associate Agreement (BAA) with that party (§164.308(b)(1)).
- Public blockchain validators (Somnia's decentralized validator set) are anonymous, permissionless, and cannot execute a BAA. They are not business associates in any HIPAA sense.
- Therefore: **any data that qualifies as PHI on a public blockchain is a structural HIPAA violation**, independent of whether Minimum Necessary applies.
  — [HIPAA Journal: Blockchain Medical Records](https://www.hipaajournal.com/blockchain-medical-records/); [HIPAA University: Blockchain in Healthcare 2026](https://hipaauniversity.com/blog/blockchain-in-healthcare/)

This confirms the design constraint: the PHI/non-PHI boundary must be enforced before any data reaches the chain. Minimum Necessary is not the operative standard for on-chain data — PHI exclusion is.

### Residual risk: statistical re-identification via event correlation

- Although individual on-chain fields are not PHI, the **combination** of `(providerHash, billedCents, adjudicatedCents, timestamp)` emitted together in a `ClaimSettled` event may enable statistical inference at low-volume providers. For example: a rural hospital that treats one patient per week for a specific rare condition could have its events correlated to identify the patient's diagnosis by a sophisticated adversary with access to hospital scheduling data.
- HHS de-identification guidance (§164.514(b)(1) Expert Determination method) requires showing "the probability that the information could be used to identify an individual is very small." For rare-disease / low-volume scenarios, this analysis needs expert review.
  — [HHS De-Identification Guidance (403 as of May 2026 — see prior research hipaa-blockchain-hash-anchoring.md for extracted text)](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html)
- **Mitigation:** aggregate low-volume claims (where billedCents may be uniquely identifying) into batched settlement events with Merkle proofs, rather than emitting per-claim amounts. High-volume providers are safe to emit per-claim.

### Minimum Necessary exemptions relevant to payment operations

For completeness: §164.502(b)(2) lists six exemptions from Minimum Necessary. The "required for compliance with applicable requirements of this subchapter" exemption covers HIPAA administrative simplification (EDI 837/835 transactions), but this exemption applies to the structured format of those transactions — not to on-chain blockchain disclosures, which are not a HIPAA-mandated transaction format. Payment operations are **not** exempt from Minimum Necessary in general; however, since cliqueue's on-chain payment data is de-identified, the exemption analysis is moot.
  — [AccountableHQ, 45 CFR 164.502 Explained](https://www.accountablehq.com/post/45-cfr-164-502-explained-hipaa-s-general-rules-for-uses-and-disclosures-of-phi)

### HHS OCR has issued no blockchain-specific Minimum Necessary guidance

- No HHS OCR opinion letter, guidance document, or enforcement action as of May 2026 specifically addresses whether HIPAA Minimum Necessary constrains public blockchain event visibility.
- The field operates on application of existing de-identification and BAA standards to blockchain contexts. No safe harbor or pre-clearance process exists.
  — Confirmed by search of HHS.gov and absence of OCR blockchain guidance in academic literature through May 2026.

### Design implications for cliqueue

**Design implication:** The HIPAA Minimum Necessary standard does **not** constrain who observes cliqueue's on-chain events, because cliqueue's on-chain data (HMAC claim IDs, code hashes, unlinked amounts, org hashes) is de-identified and therefore not PHI under §164.514. The operative constraint is PHI exclusion at the chain boundary (enforced by the TEE/off-chain architecture already specified). However, a low-volume provider statistical re-identification risk requires per-deployment expert determination review; add a batched-settlement mode for providers processing fewer than ~50 claims/week as a mitigation.

**Open questions generated:**
1. What is the minimum claim volume threshold at which a provider's per-claim `(billedCents, adjudicatedCents, timestamp)` tuple on a public chain becomes statistically re-identifiable — and should cliqueue implement automatic batching below a configurable `minBatchThreshold` setting in `ClaimsAdjudicator`?
2. Should cliqueue publish a formal de-identification expert determination report (§164.514(b)(1)) for its on-chain data model — and can a single network-level expert determination cover all hospital deployments, or must each hospital obtain its own?
3. Is the "required for compliance with HIPAA administrative simplification" exemption from Minimum Necessary broad enough to cover cliqueue's use of ICD-10 codes in on-chain transactions, given that cliqueue's chain interactions are not themselves HIPAA-mandated EDI transactions?

---

**See also** — [[../topics/hipaa|HIPAA hub]]
