## 2026-05-15 — Should hospitalId in SBT metadata be a keccak256(NPI) hash, and does NPI-to-attestor-address correlation on Somnia constitute a HIPAA disclosure?

**Question:** Should the `hospitalId` embedded in the SBT token metadata be a `bytes32` hash of the hospital's NPI (National Provider Identifier) — enabling third-party verification without a separate on-chain NPI registry — and does NPI-to-attestor-address correlation on a public chain constitute a HIPAA disclosure under the proposed 2026 Security Rule?

---

### NPI classification and public status

- **NPI is not PHI by itself.** Under 45 CFR 160.103, PHI must "relate to" a past, present, or future health condition, health care provision, or payment for care *of an individual patient*. An NPI identifies a healthcare provider or organization, not the patient — it falls outside the HIPAA Privacy Rule's definition of individually identifiable health information. [CMS NPI overview: https://www.cms.gov/priorities/key-initiatives/burden-reduction/administrative-simplification/unique-identifiers/npis; Accountable HQ analysis: https://www.accountablehq.com/post/hipaa-npi-compliance-enumeration-proper-use-and-privacy-safeguards]

- **NPI is a public-record identifier.** The NPPES NPI Registry is a free CMS-operated public database queryable by anyone. Basic NPI data (provider name, taxonomy, address) is disseminated under the Freedom of Information Act. There is no regulatory restriction on publishing a Type 2 (organization / hospital) NPI in a public context. [NPPES NPI Registry: https://npiregistry.cms.hhs.gov/; CMS NPI standard: https://www.cms.gov/regulations-and-guidance/administrative-simplification/nationalprovidentstand]

- **Type 1 individual NPIs carry mild additional exposure.** Type 1 NPIs identify individual practitioners (physicians, PTs, solo practitioners) and are similarly public, but publishing them on a permanent public ledger ties an individual's professional identity to a persistent blockchain wallet address. This does not meet the HIPAA PHI definition — it is a professional identifier, not patient data — but creates a PII linkage that regulators could scrutinize under the HIPAA Security Rule's minimum necessary principle. [HIPAA Times NPI role: https://hipaatimes.com/the-role-of-the-national-provider-identifier-npi-in-health-communications; HIPAA Journal PHI definition: https://www.hipaajournal.com/what-is-considered-protected-health-information-under-hipaa/]

---

### HIPAA safe harbor and the catch-all identifier clause

- **NPI is not one of the 18 listed safe-harbor identifiers.** 45 CFR 164.514(b)(2)(i) lists 18 explicit identifiers to remove for de-identification — NPI does not appear by name. However, item 18 is a catch-all: "any other unique identifying number, characteristic, or code." A hospital NPI meets this catch-all definition if it appears *in the same record set* as PHI; in that context the whole record (including the NPI) must be protected. [eCFR 45 CFR 164.514: https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-E/section-164.514; LII annotation: https://www.law.cornell.edu/cfr/text/45/164.514]

- **On Somnia, NPI never appears in a PHI record set — the distinction is structural.** In cliqueue's design, the on-chain `SBTRegistry` stores only: `(attestorAddress, hospitalId, credentialType, expiry)`. No patient data, claim details, or health information is co-located with the NPI-derived `hospitalId`. The PHI-containing record set lives in the off-chain EDI adapter and the Corti Symphony pipeline, never touching the chain. Therefore the catch-all clause (item 18) does not apply to the on-chain SBT token metadata. [cliqueue design: docs/research/somnia/sbt-registry-scoping-hospital-vs-network.md; HIPAA PHI definition: https://www.hipaajournal.com/considered-phi-hipaa/]

---

### Correlation risk: NPI hash → wallet address linkage on a public chain

- **keccak256(NPI) is a deterministic mapping, not a privacy shield.** There are ~1.6 million active NPI numbers in the NPPES database (finite, enumerable set). An adversary can compute keccak256 over all 1.6M NPIs in seconds and compare to any on-chain `hospitalId` value, reconstructing the NPI trivially. A plain keccak256(NPI) provides *zero* effective anonymization against a computationally trivial preimage attack. [NPPES NPI Registry: https://npiregistry.cms.hhs.gov/ — NPI count inferred from CMS published data]

- **For Type 2 (hospital / organization) NPIs: correlation is low-risk.** Linking a hospital's NPI to its Somnia contract/wallet address reveals: (a) which hospital is using cliqueue, and (b) the hospital's transaction volume. Neither is PHI. The hospital's NPI is already public. The wallet address of the hospital's cliqueue deployment reveals nothing about individual patients. Reputational risk (competitive intelligence about cliqueue adoption) may concern hospital procurement teams, but this is a business concern, not a HIPAA one.

- **For Type 1 (individual practitioner) NPIs embedded in attestor SBTs: correlation is higher risk.** Linking an individual coder's NPI to their Somnia wallet address creates a permanent public record tying a real human professional to a pseudonymous blockchain identity. This is not PHI but is PII — and on a public immutable ledger, this linkage cannot be deleted. Under the 2026 HIPAA Security Rule NPRM, there is no explicit regulation requiring this to be protected, but individual coders may object to having their professional identity permanently tied to a blockchain wallet, creating a consent and employment-law consideration. [2026 HIPAA Security Rule NPRM: https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html; Barracuda PII vs PHI: https://blog.barracuda.com/2023/05/12/pii-phi-npi-pci-data-compliance]

---

### Recommended on-chain hospitalId representation

- **For hospital (Type 2 / organization) SBTs:** Use `keccak256(abi.encodePacked(npi, CLIQUEUE_DOMAIN_SEPARATOR))` where `CLIQUEUE_DOMAIN_SEPARATOR` is a well-known constant (e.g., `keccak256("cliqueue.v1.hospitalId")`). The domain separator is not a secret — it does not prevent a determined NPI enumeration attack — but it does prevent naive collision with other on-chain uses of the same NPI hash, and clearly signals intent (this is a domain-specific identifier, not a raw NPI hash). The hospital's NPI remains recoverable by any party who knows the domain separator and has NPPES access. This is acceptable given NPI is public. [EVM encoding convention: Solidity ABI encoding docs, training data]

- **For individual attestor (Type 1) SBTs: do NOT embed the individual coder's NPI in on-chain token metadata.** The individual's credential is verified off-chain (via AHIMA/AAPC or a credentialing aggregator) before the hospital admin calls `grantRole()`. The SBT metadata should contain only `(hospitalId, credentialType, expiry)` — no personal NPI. This limits the on-chain record to: "this wallet address holds a valid coding credential of type X at hospital Y, expiring at timestamp Z." The coder's actual NPI lives only in the hospital's off-chain credentialing system. [AHIMA credential verification: my.ahima.org/credential-verification — **URL inferred, not confirmed as functional**; AAPC: aapc.com/certification/credential-verification.aspx — **URL inferred**]

- **Hospital-level NPI hash in SBT: two-byte salt improves marginally.** If the team wants to reduce (but not eliminate) NPI enumeration feasibility, append a 2-byte hospital-chosen salt: `keccak256(abi.encodePacked(npi, hospitalSalt, CLIQUEUE_DOMAIN_SEPARATOR))`. The salt must be stored off-chain (hospital onboarding record). This raises the enumeration cost from ~$0 to ~$65,536 × NPI enumeration, which is still trivially cheap but raises the bar slightly. Salt disclosure in a breach reconstructs the NPI — it is not a strong defense. For MVP, the domain-separator-only pattern is sufficient given that the NPI is already public.

---

### 2026 HIPAA Security Rule NPRM implications

- **The 2026 HIPAA Security Rule NPRM does not regulate provider identifiers on public blockchains.** Its scope is the security of ePHI held by covered entities and BAs. The on-chain SBT token metadata (hospitalId + credentialType + expiry + attestorAddress) is not ePHI: it contains no patient health information. The proposed rule's annual BA verification and encryption requirements do not apply to the Somnia chain itself. [HHS HIPAA Security Rule NPRM factsheet: https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html; 2026 HIPAA changes overview: https://www.hipaajournal.com/new-hipaa-regulations/]

- **Minimum necessary principle (§164.502(b)) applies to the off-chain credentialing workflow, not on-chain metadata.** When cliqueue's onboarding flow queries AHIMA/AAPC to verify a coder's credential before issuing an SBT, that query involves PHI-adjacent data (the coder's name + credential number + employment relationship). The hospital's off-chain system must apply minimum necessary constraints to that verification request. The resulting on-chain SBT contains none of that raw data. [45 CFR 164.502(b): https://legalclarity.org/45-cfr-164-502-hipaa-general-rules-for-uses-and-disclosures/]

---

**Design implication:** Use `keccak256(abi.encodePacked(npi, CLIQUEUE_DOMAIN_SEPARATOR))` as the on-chain `hospitalId` bytes32 for hospital (Type 2 NPI) SBTs — the NPI is already public, the domain separator prevents cross-protocol collisions, and the derivation is fully auditable. Never embed individual coder (Type 1) NPIs in on-chain SBT metadata; store only `(hospitalId, credentialType, expiry)` per SBT token. The NPI-to-wallet-address correlation does not constitute a HIPAA disclosure for organization NPIs; for individual coders the concern is PII linkage (non-HIPAA but worth communicating to hospital HR/legal at onboarding).

**Open questions generated:**
- If the CLIQUEUE_DOMAIN_SEPARATOR pattern for hospitalId is adopted, should the derivation and separator value be published in cliqueue's on-chain contract metadata (via EIP-1967 storage slot or NatSpec annotation) to facilitate third-party audits without requiring cliqueue's cooperation?
- Should the `SBTRegistry` expose a `view function hospitalIdFromNPI(uint256 npi) returns (bytes32)` to allow on-chain lookup by any party with NPPES access, or should this remain an off-chain operation only (to preserve the option of adding a real salt later)?
- Does the permanent immutability of Somnia on-chain data (no deletion possible) create a GDPR Right to Erasure conflict for EU-national individual coders who may hold attestor SBTs? If so, does the burn mechanism under ERC-5484 `BurnAuth.IssuerOnly` satisfy erasure requirements?

---

**See also** — [[../topics/sbt|SBT hub]] · [[../topics/hipaa|HIPAA hub]]
