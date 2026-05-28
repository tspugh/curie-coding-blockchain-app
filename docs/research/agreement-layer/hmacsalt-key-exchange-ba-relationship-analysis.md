# hmacSalt Key-Exchange: Does Transmitting the Verification Key Create a BA Relationship Between cliqueue and the Payer?

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Does transmitting the hmacSalt key from cliqueue to the payer (to enable payer CLM01 verification under Architecture A) create a new HIPAA Business Associate relationship between cliqueue and the payer?

---

### Finding 1: The hmacSalt is definitively not PHI — transmitting it alone does not trigger BA status under the PHI-transmission prong

- Under 45 CFR 160.103, a Business Associate is any entity that "creates, receives, maintains, or transmits PHI" on behalf of a covered entity. PHI is individually identifiable health information — information that relates to a person's health condition, provision of care, or payment for care and identifies (or could reasonably identify) the individual. The hmacSalt is a random cryptographic value with no health information content. It cannot identify any individual. It does not relate to any health condition, care episode, or payment. Transmitting the hmacSalt alone does not satisfy the PHI-transmission prong of the BA definition.
  — [45 CFR 160.103 definition of PHI](https://www.govinfo.gov/content/pkg/CFR-2013-title45-vol1/pdf/CFR-2013-title45-vol1-sec160-103.pdf)
  — [HHS FAQ 256: Software vendor without PHI access is not a BA](https://www.hhs.gov/hipaa/for-professionals/faq/256/is-software-vendor-business-associate/index.html)
  — Assessment: High confidence (standard HIPAA analysis; no authority holds that a key with no health content is PHI).

- The HIPAA de-identification guidance (HHS, November 2012) acknowledges that "transformation of PHI into values derived by cryptographic hash functions" is acceptable provided "the keys associated with such functions are not disclosed, including to the recipients of the de-identified information." This restriction applies specifically to the scenario where the key is passed to a recipient of de-identified data (who otherwise could not re-identify). In Architecture A, the payer already holds full PHI (CLM01 and the entire adjudicated claim). The payer is not a recipient of de-identified data — it is a covered entity performing re-verification of its own claim record.
  — [HHS De-Identification Guidance (2012)](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html)
  — Assessment: High confidence for the factual distinction; medium confidence on OCR's application of §164.514(c) to the covered-entity-to-covered-entity salt exchange (no direct OCR opinion on this specific fact pattern).

---

### Finding 2: §164.514(c) prohibits the hospital from disclosing the re-identification mechanism — but the payer is not a de-identification recipient

- 45 CFR §164.514(c) permits covered entities to assign re-identification codes to de-identified data provided: (1) the code is not derived from the individual's information and cannot be reversed to identify the individual; and (2) the covered entity does not disclose the mechanism for re-identification. The regulation's non-disclosure obligation falls on the **covered entity** (hospital) that holds the re-identification mechanism — not on an intermediary that routes the key.
  — [45 CFR §164.514(c) via Cornell LII](https://www.law.cornell.edu/cfr/text/45/164.514)
  — Assessment: High confidence for regulatory text; medium confidence on whether the payer is a "recipient" of de-identified data for §164.514(c) purposes.

- **Critical architecture distinction:** §164.514(c) targets the scenario where a covered entity shares de-identified data with a third party and must not provide that third party the re-identification key. Under Architecture A, the payer is not receiving de-identified data from the hospital — the payer independently generated and holds the CLM01 and adjudicated claim record. The hmacSalt enables the payer to verify that the on-chain hash `claimId = HMAC(CLM01 || providerAddress || hmacSalt)` corresponds to a claim it already adjudicated. This is closer to an inter-covered-entity authentication protocol than a de-identification key disclosure. Whether §164.514(c) applies to this fact pattern has not been directly ruled on by OCR.
  — [45 CFR §164.514(c)](https://www.law.cornell.edu/cfr/text/45/164.514); [HHS de-identification FAQ](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html)
  — Assessment: Medium confidence (sound legal reasoning; no OCR enforcement action or direct guidance on this specific covered-entity-to-covered-entity key-exchange pattern).

---

### Finding 3: HHS FAQ 253 — providers and payers are covered entities acting on their own behalf; cliqueue routing between them is not a BA-triggering activity

- HHS FAQ 253 establishes that a provider and payer are not business associates of each other when each is acting on its own behalf in the normal claims relationship. "A provider that submits a claim to a health plan and a health plan that assesses and pays the claim are each acting on its own behalf as a covered entity, and not as the 'business associate' of the other."
  — [HHS FAQ 253](https://www.hhs.gov/hipaa/for-professionals/faq/253/is-health-care-provider-considered-to-be-a-business-associate/index.html)
  — Assessment: High confidence (direct HHS authority).

- Applied to Architecture A: the hospital (covered entity) and payer (covered entity) are each acting on their own behalf when the hospital provides the hmacSalt and the payer uses it to verify an on-chain settlement reference. cliqueue's role — routing the hmacSalt between two covered entities in the context of their existing claims relationship — does not make cliqueue a BA of the payer. cliqueue is performing a technical integration function between two parties who already have a HIPAA-permitted direct relationship.
  — Assessment: Medium confidence (reasonable analogy from FAQ 253; direct OCR guidance on key-routing intermediary not available).

---

### Finding 4: The conduit exception is narrow — if cliqueue stores the hmacSalt, BA status attaches

- HHS cloud computing guidance (FAQ 2076) establishes that a CSP storing encrypted ePHI is a BA even without the decryption key, because the storage constitutes "maintaining" PHI. By contrast, a pure conduit (ISP transmitting encrypted data in transit without persistent storage) is not a BA.
  — [HHS FAQ 2076](https://www.hhs.gov/hipaa/for-professionals/faq/2076/if-a-csp-stores-only-encrypted-ephi-and-does-not-have-a-decryption-key-is-it-a-hipaa-business-associate/index.html)
  — Assessment: High confidence.

- The hmacSalt is not PHI (Finding 1), so FAQ 2076's analysis does not apply directly. However, a conservative hospital privacy officer may argue that persistent storage of the hmacSalt (which, combined with data the payer already holds, enables claim verification) is analogous to maintaining a re-identification key — creating at minimum a compliance risk that demands a BAA with cliqueue as a precaution. This conservative posture is reinforced by the 2026 HIPAA Security Rule NPRM's tightening of BA verification requirements.
  — [HIPAA Security Rule NPRM (Jan 2025)](https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information)
  — Assessment: High confidence for the conservative-posture risk; medium confidence that OCR would actually find a violation absent a more explicit PHI connection.

---

### Finding 5: The "on behalf of" prong — cliqueue transmits the hmacSalt for the hospital's benefit, which may satisfy the BA-triggering function test

- BA status requires not just PHI contact but that the function be performed "on behalf of" a covered entity. If cliqueue's Architecture A key-distribution service is contracted by the hospital to transmit the hmacSalt to the payer as part of the settlement integration service, the "on behalf of" prong is satisfied. This makes cliqueue's conduit-only defense weaker: cliqueue is not a passive carrier (like an ISP) but an active service provider performing a function the hospital cannot perform itself without cliqueue.
  — [HIPAA Omnibus Rule preamble, 78 Fed. Reg. 5566 (Jan. 25, 2013)](https://www.federalregister.gov/documents/2013/01/25/2013-01580/modifications-to-the-hipaa-privacy-security-enforcement-and-breach-notification-rules-under-the)
  — Assessment: Medium confidence (standard "on behalf of" analysis; the hmacSalt-not-PHI counterargument still holds regardless of the "on behalf of" prong — if the object of the function is not PHI, BA status cannot attach on the PHI-transmission basis alone).

---

**Design implication:** cliqueue's transmission of the hmacSalt to the payer under Architecture A does not create a BA relationship with the payer under a strict reading of 45 CFR 160.103, because the hmacSalt is not PHI. However: (1) §164.514(c) places the re-identification mechanism non-disclosure obligation on the hospital — the hospital's counsel must confirm that sharing the salt with the payer (a covered entity in a pre-existing claims relationship) is permissible before cliqueue routes it; (2) a conservative hospital privacy officer will require a BAA with cliqueue as a precaution given the 2026 HIPAA Security Rule BA verification tightening; (3) if cliqueue persistently stores the hmacSalt (rather than routing-only), the conservative BA risk increases materially. The recommended architecture for Architecture A is: **hospital stores the hmacSalt; cliqueue never stores it; the hospital delivers the salt directly to the payer via a BAA-governed channel that does not route through cliqueue**. This eliminates cliqueue's BA-risk exposure for the salt entirely. If cliqueue must route the salt, it should do so via a pass-through-only channel with zero persistent storage and document this in a "Non-PHI Key Routing Memo."

**Open questions generated:**
1. Should the Architecture A key-exchange be hospital-direct-to-payer (hospital delivers hmacSalt to payer via its own BAA-governed channel, bypassing cliqueue entirely) — eliminating cliqueue's salt-routing risk and simplifying the HIPAA analysis to a pure covered-entity-to-covered-entity exchange?
2. Should cliqueue publish a "Non-PHI Key Routing Memo" (outside-counsel-reviewed) that analyzes the hmacSalt under 45 CFR 160.103 and §164.514(c) — so hospital privacy officers have documented external legal support rather than relying on cliqueue's self-assessment?
3. If the hospital's payer contract requires all claim-related data exchange to flow through an approved clearinghouse, does routing the hmacSalt directly from hospital to payer (bypassing cliqueue) still satisfy that contractual requirement — or does the salt exchange require separate documentation as a non-clearinghouse supplemental integration?

---

**See also** — [[../topics/x12|X12 hub]] · [[../topics/hipaa|HIPAA hub]]
