# HIPAA Constraints on Anchoring Claim Hashes on a Public Blockchain

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — CMS / HIPAA constraints on anchoring a hash of a finalized ICD-10 claim on a public blockchain vs. a permissioned chain

### The core legal question

Does storing a cryptographic hash (e.g., SHA-256) of a document that contains PHI on a public blockchain (such as Somnia) itself constitute a HIPAA Privacy Rule violation?

### HHS guidance: hashes are not PHI if keyed correctly — with a critical caveat

- HHS's official de-identification guidance explicitly states: "The re-identification provision in 45 CFR §164.514(c) does not preclude the transformation of PHI into values derived by cryptographic hash functions using the **expert determination method**, provided the **keys associated with such functions are not disclosed**, including to the recipients of the de-identified information."
  — [HHS HIPAA De-Identification Guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html)

- The safe harbor method (§164.514(b)) requires removal of 18 specific identifiers. A SHA-256 hash of an 837 claim document would contain encoded patient name, DOB, SSN fragments, service dates, diagnosis codes, and provider NPI — most of the 18 identifiers are preserved in the pre-hash input. The hash itself does not contain these in readable form, but is derived from them.

- **The critical legal issue: re-identification risk.** NIST guidance (echoed by HHS) states a hash should not be derived from "other related information about the individual" if the means of re-identification could be discovered. For a claim hash, if an adversary has access to the original 837 document (e.g., via a clearinghouse breach), they can compute the hash and compare it to the public ledger, confirming which claims belong to which patient. This is a re-identification attack.
  — HHS de-identification guidance; [NIST guidance on de-identification](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html)

- **Practical conclusion:** an unkeyed SHA-256 hash of a full 837 claim on a public blockchain is **not safe** under either de-identification method. A **keyed HMAC** (HMAC-SHA256 with a secret key) of the claim, where the key is never disclosed, would satisfy the expert determination method — provided a qualified expert certifies re-identification risk is "very small." No HHS/OCR opinion or Safe Harbor pre-clearance process exists for blockchain-specific implementations; organizations rely on counsel + expert determination.

### Public blockchain vs. permissioned chain: practical difference

- Public blockchain (Somnia, Ethereum): all hashes and transaction data are visible to any internet participant permanently. Even if the hash is non-reversible without the key, the existence of a hash per claim, timestamps, and on-chain fund movements can leak **metadata** (e.g., "this payer paid this hospital $X for a claim on this date" is not PHI but is commercially sensitive).
  — [HIPAA Vault: Blockchain Integration 2025](https://www.hipaavault.com/resources/blockchain-integration-healthcare-records/)

- Permissioned blockchain (Hyperledger Fabric, private Besu): only consortium participants see transactions. This avoids the metadata leakage problem but sacrifices the censorship-resistance and auditability value proposition.
  — [Frontiers in Blockchain 2025: Health insurance blockchain review](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1699290/full)

- **HHS/OCR has not issued blockchain-specific guidance** distinguishing public vs. permissioned chains for PHI purposes. Academic consensus (Frontiers 2025) is that permissioned chains are "better suited for healthcare due to the sensitive nature of patient data" — but this reflects operational preference, not a regulatory mandate that public chains are non-compliant.
  — [Censinet: Emerging Blockchain Privacy Standards](https://censinet.com/perspectives/emerging-blockchain-privacy-standards-in-digital-health)

### What cliqueue can safely anchor on a public chain

The following are generally accepted as safe to publish on a public blockchain by practitioners (subject to expert determination sign-off):

1. **HMAC-SHA256 of the full 837 claim document**, with the HMAC key held by the hospital and payer only. The key must never appear on-chain. This is a de-identified representation.
2. **ICD-10 code sets only** (no patient identifiers): diagnosis codes like `Z87.891` are not PHI; they become PHI only when linked to an identified patient. On-chain, an unlinked code array is safe.
3. **Settlement amounts and timestamps**: dollar amounts paid per claim are not PHI (amounts without patient linkage). On-chain visibility of payment values is commercially sensitive but not a HIPAA violation.
4. **Claim state transitions** (Submitted/Adjudicated/Attested/Disputed/Settled): on-chain state changes with only the claim hash (not patient ID) are safe.
5. **TEE attestation report hashes**: the hash of a Phala TEE attestation report proves compliance without revealing PHI.

### What must stay off a public chain

- Raw 837 EDI content, FHIR bundles, or any document containing the 18 safe-harbor identifiers.
- Patient IDs, member IDs, or NPI-plus-date combinations (the NPI alone is public; combined with service date it may be linkable to a patient).
- Unkeyed hashes (plain SHA-256 of PHI-containing documents): linkable to source if an attacker has the source.

### No formal regulatory approval process for blockchain hash anchoring

- There is no CMS or HHS pre-approval or safe harbor specifically for "hash anchoring on a blockchain." Organizations use the expert determination method, get a qualified expert to attest re-identification probability is very small (<0.05 per NIST 800-188 draft), and document that assessment.
  — HHS guidance; [health.mil info paper on de-identification](https://www.health.mil/Reference-Center/Fact-Sheets/2014/10/01/Info-Paper-New-Guidance-on-De-Identification-Methods-under-the-HIPAA-Privacy-Rule)

**Design implication:** cliqueue-coding-blockchain should anchor **HMAC-SHA256 claim hashes** (not plain SHA-256) on Somnia mainnet, with HMAC keys held in the hospital's and payer's HSMs (never on-chain). ICD-10 code arrays and settlement amounts are safe to emit as on-chain events. The architectural PHI boundary is: clinical note → TEE enclave (Phala, HIPAA-compliant) → HMAC claim hash (anchored on Somnia) + ICD-10 codes + amount (emitted as on-chain event). This design avoids any PHI on-chain while satisfying the expert determination de-identification standard.

**Open questions generated:**
1. Does HIPAA's Minimum Necessary standard (§164.502(b)) constrain which parties can observe the on-chain HMAC hashes, payment amounts, and ICD-10 codes emitted as Somnia events — given that Somnia's public blockchain makes these visible to anyone?
2. Is there a practical HMAC key management scheme where both the hospital and payer can independently verify a claim hash without disclosing the HMAC key to on-chain observers or each other (e.g., using a shared HMAC key derived via ECDH)?
3. As Somnia is a new chain with no healthcare regulatory track record, which BAA (Business Associate Agreement) structure would a hospital's legal counsel require with the chain operator (Improbable) before anchoring any claim-derived hashes on mainnet?

---

**See also** — [[../topics/hipaa|HIPAA hub]]
