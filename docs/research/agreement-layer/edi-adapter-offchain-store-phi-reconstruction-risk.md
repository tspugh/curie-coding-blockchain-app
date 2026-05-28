# Off-Chain Key-Value Store for EDI Adapter Mapping — PHI Reconstruction Risk and Disaster Recovery

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — What is the optimal off-chain key-value store for the `(claimId → CLM01)` EDI adapter mapping — hospital-local encrypted DB, a FHIR server, or TEE-backed service — and how does it survive provider system failure without enabling PHI reconstruction from on-chain data?

### Context

Cliqueue anchors a `bytes32 claimId` (a salted keccak256 hash of the hospital's internal claim reference) on Somnia when submitting a claim for adjudication. The EDI adapter must maintain a private off-chain mapping from `claimId → CLM01` (the X12 837 claim identifier, e.g., `CLM01 = "HOS-2024-88321"`) so that 835 remittance ERA files can be reconciled against on-chain settlement events. Without this mapping, the hospital cannot match Somnia payment events to its accounts-receivable system. The question is: where should this mapping live, and can it become a PHI reconstruction vector?

---

### Finding 1: The `claimId → CLM01` mapping itself is NOT PHI — but combined with on-chain data it creates a quasi-identifier risk

- The CLM01 is a hospital-assigned internal claim reference number, not a patient identifier. HIPAA Safe Harbor de-identification (45 CFR §164.514(b)(2)) removes 18 enumerated identifiers; "account numbers" and "medical record numbers" are listed identifiers, but a payer-facing claim number (CLM01) that does not contain patient name, DOB, SSN, or diagnosis codes is not inherently PHI.
  — [HIPAA Safe Harbor De-identification: 45 CFR §164.514(b)](https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html)
  — Assessment: High confidence. However, CLM01 is often a traceable internal reference that, combined with EDI 837 context (NM1 loops for patient name, DTP loops for service date), could enable re-identification if the off-chain store is compromised. The mapping alone is low-risk; the mapping plus the full 837 is re-identification risk.

- On-chain, cliqueue emits: `bytes32 claimId`, `bytes32 providerHash`, `uint256 settledAmount` (in cents, per prior research on adjudicated-cents-on-chain-emission-risk), and `bytes32 cptCodeSetHash`. None of these are directly PHI. But if an adversary obtains the off-chain `claimId → CLM01` mapping AND cross-references the full 837 EDI from the hospital's clearinghouse system, they can reconstruct the patient-claim linkage. The off-chain mapping is therefore a **weak PHI proxy** that must be treated with HIPAA-grade controls even though the mapping file alone is borderline.
  — Assessment: Medium confidence on HIPAA classification; high confidence on re-identification risk model.

---

### Finding 2: Hospital-local encrypted database is the lowest-risk, lowest-complexity option for MVP

- The `claimId → CLM01` mapping is a simple key-value pair. At 10,000 claims/day, the annual mapping volume is ~3.65 million entries. At ~128 bytes per entry (`bytes32 claimId` + 64-char CLM01 string + 8-byte timestamp), the annual storage is ~468 MB — trivially small for any database. A hospital-local encrypted relational database (PostgreSQL with pgcrypto AES-256 column encryption, or SQLite + SQLCipher for small deployments) hosted on hospital infrastructure satisfies HIPAA Technical Safeguards (45 CFR §164.312) without creating a new BAA obligation for cliqueue if cliqueue never accesses the database.
  — [HIPAA Technical Safeguards: 45 CFR §164.312](https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html); [pgcrypto PostgreSQL docs](https://www.postgresql.org/docs/current/pgcrypto.html)
  — Assessment: High confidence for feasibility; this is the standard pattern in healthcare middleware.

- **Disaster recovery for hospital-local:** Azure API for FHIR (as a proxy for enterprise healthcare database SLAs) achieves RPO=15 minutes, RTO=60 minutes with automatic 7-day backup. A hospital-local PostgreSQL deployment can match this with WAL streaming to a secondary replica (standard hospital IT practice). The mapping database does not require special DR provisions — it is a lightweight secondary index, not the system of record. If lost, it can be reconstructed from the hospital's internal claim-management system (the original CLM01 source) and Somnia event logs (`ClaimSubmitted(bytes32 claimId, uint256 timestamp)`), provided the hospital maintained its pre-hashing pre-image log.
  — [Azure FHIR Disaster Recovery](https://learn.microsoft.com/en-us/azure/healthcare-apis/azure-api-for-fhir/disaster-recovery)
  — Assessment: High confidence for reconstruction feasibility.

- **Critical design requirement:** The hospital MUST log the pre-hashing pre-image — specifically, the `(CLM01, hospitalSalt, keccak256(CLM01 ++ hospitalSalt) = claimId)` triple — at claim submission time. If the hospital loses its `hospitalSalt`, the `claimId` values on Somnia are permanently orphaned and cannot be matched to any CLM01 without the salt. The salt must be backed up separately from the mapping database and protected with HSM-grade key management (e.g., Azure Key Vault, AWS KMS, or hospital-local HSM).
  — Assessment: High confidence as architectural design requirement.

---

### Finding 3: A FHIR server is over-engineered for this use case but provides additional compliance value

- A FHIR R4 `Claim` resource includes `Claim.identifier` (which can store CLM01) and `Claim.supportingInfo` (which can store a reference to the on-chain `claimId` as an extension). Using a FHIR server as the off-chain adapter store gives the hospital a HIPAA-compliant, audit-logged, interoperable store that integrates with Epic/Cerner via existing FHIR APIs. Azure FHIR Service (managed PaaS) and open-source HAPI FHIR are both viable options.
  — [HL7 FHIR Claim Resource R4](https://www.hl7.org/fhir/R4/claim.html); [Azure Health Data Services FHIR Service](https://learn.microsoft.com/en-us/azure/healthcare-apis/fhir/overview)
  — Assessment: High confidence for feasibility; however, FHIR server adds operational complexity (OAuth 2.0 / SMART on FHIR, resource versioning, etc.) that is disproportionate to the simple key-value mapping requirement.

- The FHIR server approach becomes valuable if cliqueue's adapter layer also needs to store supporting evidence (clinical notes hash, coding rationale document hash) alongside the CLM01 mapping — i.e., if the FHIR server serves double duty as both the mapping store and the evidence vault. In that case, the FHIR `Claim` resource with `DocumentReference` attachments is a natural fit.
  — Assessment: Medium confidence (design extrapolation; no primary source documents this exact dual-use pattern for blockchain-adjacent claim systems).

- **FHIR server disaster recovery:** Azure FHIR Service provides RPO=15 min, RTO=60 min with geo-replication. HAPI FHIR on self-hosted PostgreSQL requires the same WAL streaming setup as the simpler hospital-local approach. FHIR server is NOT a better DR option than a simpler database — it is architecturally equivalent for this use case.

---

### Finding 4: TEE-backed key-value service (Phala/dstack) is the highest-security but highest-complexity option — only justified if cliqueue hosts the adapter

- A TEE-backed mapping service (e.g., Phala Network's dstack, Intel SGX enclave, or AWS Nitro Enclaves) provides cryptographic proof that the mapping lookup is executed in a trusted environment where the operator cannot observe individual `claimId → CLM01` pairs. This is relevant if **cliqueue operates the EDI adapter service on behalf of multiple hospitals** — in that case, cliqueue becomes a HIPAA Business Associate and must ensure it cannot accidentally leak one hospital's mapping to another hospital's query.
  — [Phala Network dstack documentation](https://docs.phala.network/dstack); [AWS Nitro Enclaves](https://aws.amazon.com/ec2/nitro/nitro-enclaves/)
  — Assessment: High confidence for use-case applicability; medium confidence that Phala dstack is production-ready for this specific pattern (no published healthcare deployment precedents found).

- The TEE approach is **unnecessary if the mapping database is hospital-local** (hospital-operated, hospital-controlled) — TEE isolation is only needed when a multi-tenant service operator (cliqueue) must be prevented from accessing individual hospital data. For an MVP where each hospital hosts its own adapter, TEE adds cost and complexity without proportionate benefit.
  — Assessment: High confidence as design decision framework.

- **Phala/dstack maturity caution:** Prior research (docs/research/somnia/tee-attestation-on-chain-verification.md) found that Phala's dstack is available but requires careful multi-chain governance configuration. No production healthcare deployments using Phala dstack as a HIPAA-grade key-value store are documented as of May 2026.
  — Assessment: High confidence for "not production-validated in healthcare."

---

### Finding 5: The PHI reconstruction threat model requires the salt to be the secret, not the mapping

- The dominant security threat to the off-chain mapping store is not that the `claimId → CLM01` table itself reveals PHI — it is that a compromised hospital IT system might expose the `hospitalSalt`, enabling an attacker to generate `claimId` values for known CLM01s and link them to on-chain settlement events (and infer treatment patterns by provider hash + settled amount + timing). This is a pseudonymity-breaking attack, not a direct PHI disclosure.
  — [Re-identification Risk in Blockchain Healthcare: Literature Review, PMC (2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12534302/)
  — Assessment: High confidence for threat model; medium confidence for specific attack vector probability.

- The architectural mitigation is **HSM-backed key management for the hospital salt**, separate from the mapping database. The mapping database (encrypted with a database-layer key derived from the salt) is low-value without the salt. HIPAA requires encryption of PHI at rest (AES-128 minimum, per NIST SP 800-111); the mapping table should be encrypted even though it is arguably not PHI, as a defense-in-depth measure.
  — [NIST SP 800-111: Guide to Storage Encryption Technologies](https://csrc.nist.gov/publications/detail/sp/800-111/final); [HIPAA Security Rule 164.312(a)(2)(iv)](https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html)
  — Assessment: High confidence.

- **Published pattern confirmation:** The hOCBS framework (Information Processing and Management, 2021 — the dominant academic reference for on-chain/off-chain healthcare data design) explicitly uses "salted hashing before submission" to prevent linkage attacks: "identifiers recorded on the public ledger are pseudonymized using salted hashing before submission, ensuring that they cannot be used to reconstruct or infer sensitive patient information stored in Private Data Collections." The cliqueue adapter's `keccak256(CLM01 ++ hospitalSalt)` pattern is architecturally aligned with this validated approach.
  — [hOCBS Framework (2021)](https://www.researchgate.net/publication/349027284_hOCBS_A_privacy-preserving_blockchain_framework_for_healthcare_data_leveraging_an_on-chain_and_off-chain_system_design)
  — Assessment: High confidence.

---

### Finding 6: Recommended architecture — three-tier approach for different deployment contexts

| Deployment | Off-Chain Store | Key Management | DR Approach |
|---|---|---|---|
| MVP (hospital self-hosted) | Hospital-local PostgreSQL + pgcrypto AES-256 | Hospital HSM or Azure Key Vault | WAL streaming to replica; reconstruct from claim-mgmt system + hospitalSalt backup |
| Growth (cliqueue-hosted SaaS) | TEE-backed multi-tenant key-value (Phala dstack or AWS Nitro) | TEE-sealed key, no cliqueue operator access | TEE-replicated state; cliqueue signs BAA as BA for mapping data |
| FHIR-integrated (Epic/Cerner-first) | Hospital FHIR server (HAPI or Azure FHIR Service) | SMART on FHIR OAuth; Azure Key Vault | Azure FHIR geo-replication (RPO 15 min, RTO 60 min) |

No existing production healthcare blockchain deployment has documented the exact `claimId → CLM01` mapping pattern. The closest published precedent is the hOCBS framework (academic) and FHIRChain (prototype). Cliqueue's implementation will be novel.

---

**Design implication:** For MVP, the `(claimId → CLM01)` EDI adapter mapping should be a hospital-local PostgreSQL table encrypted with pgcrypto (AES-256), with the `hospitalSalt` backed up in a separate HSM-grade key vault. The mapping store is **not the primary security boundary** — the `hospitalSalt` is. Cliqueue's hospital onboarding documentation must require hospitals to configure HSM-backed salt storage before going live. The FHIR server option is over-engineered for MVP but becomes attractive when cliqueue needs to integrate with Epic/Cerner workflows. The TEE option is required only if cliqueue operates a multi-tenant adapter service (SaaS model) — in that configuration, cliqueue becomes a BA and the TEE prevents operator-level PHI exposure across hospital tenants. PHI reconstruction from on-chain data alone is not feasible given salted hashing — the attack surface is the hospitalSalt, not the on-chain `claimId` values.

**Open questions generated:**
1. Should cliqueue's hospital BAA explicitly list the `hospitalSalt` as a "Key Security Parameter" requiring HSM-grade storage — and should cliqueue's onboarding checklist include a salt backup verification step before activating the live Somnia integration? — added 2026-05-16, priority: high
2. If a hospital loses its `hospitalSalt` through a IT failure (not a breach), can Somnia event logs (`ClaimSubmitted` events with `claimId` and `timestamp`) be used to reconstruct partial mappings by correlating timestamps with hospital billing system records — and should cliqueue spec a "salt recovery" workflow that allows partial mapping reconstruction without PHI exposure? — added 2026-05-16, priority: medium
3. Should cliqueue publish a reference implementation of the hospital-local PostgreSQL mapping store (schema, pgcrypto setup, WAL replication config) as part of the open-source adapter toolkit — so hospital IT teams do not have to design the encrypted store from scratch — and would this lower the barrier to adoption at small/critical-access hospitals? — added 2026-05-16, priority: medium

---

**See also** — [[../topics/x12|X12 hub]] · [[../topics/hipaa|HIPAA hub]]
