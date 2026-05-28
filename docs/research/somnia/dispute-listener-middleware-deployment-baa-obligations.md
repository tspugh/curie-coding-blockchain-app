# Dispute-Listener Middleware Deployment Model and BAA Obligations

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should cliqueue's dispute-listener middleware be a standalone TypeScript service deployed by cliqueue, or a hospital-deployed integration module — and does the choice affect BAA obligations (if cliqueue runs it, cliqueue is a BA processing PHI-adjacent claim references)?

---

### Finding 1: HIPAA BA status turns on PHI access, not deployment location — the cliqueue dispute-listener accesses no PHI

- The HIPAA business associate definition (45 CFR 160.103) requires that the entity create, receive, maintain, or transmit PHI **on behalf of** a covered entity. The U.S. OCR's explicit guidance in FAQ 256 states: "The mere selling or providing of software to a covered entity does not give rise to a business associate relationship if the vendor does not have access to the protected health information of the covered entity."
  — [HHS OCR FAQ 256: Is a software vendor a business associate of a covered entity?](https://www.hhs.gov/hipaa/for-professionals/faq/256/is-software-vendor-business-associate/index.html)
  — Assessment: High confidence (official HHS OCR guidance, primary source).

- The cliqueue dispute-listener subscribes to `ClaimDisputed` events from `ClaimsAdjudicator` on Somnia. The only data it processes are: (a) `bytes32 claimId` — an HMAC hash, not PHI; (b) `address disputant` — a wallet address, not PHI; (c) `uint256 disputeWindowEnd` — a timestamp. None of these fields qualify as individually identifiable health information under 45 CFR 160.103. The off-chain `(claimId → CLM01)` EDI mapping that could link a claimId to a patient lives in the hospital-local PostgreSQL store — it is not accessed by the cliqueue dispute-listener in either deployment model.
  — [HIPAA Privacy Rule definition of PHI: 45 CFR 160.103](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-160/subpart-A/section-160.103)
  — Assessment: High confidence for the on-chain data classification; medium confidence for "no PHI access" in the cliqueue-operated model — contingent on the listener not being connected to the EDI mapping store.

- **Conclusion on BA status:** If the cliqueue dispute-listener operates against only Somnia event data (claimId hash + wallet address + timestamp) and does not connect to the hospital's off-chain EDI mapping store or EHR, it does not create, receive, maintain, or transmit PHI. Cliqueue is not a business associate in this configuration regardless of whether the service is cliqueue-hosted or hospital-self-hosted.
  — Assessment: High confidence as legal principle; note this is not a legal opinion — hospital counsel must confirm.

---

### Finding 2: The conduit exception is irrelevant — the dispute-listener does not transmit PHI at all

- The HIPAA conduit exception (for ISPs and postal carriers) is a narrow carve-out for entities that transmit PHI with only transient access. It does not apply here because the dispute-listener does not handle PHI in any form — it handles cryptographic commitments. There is no need to rely on the conduit exception.
  — [Holland & Hart: HIPAA, Business Associates, and the Conduit Exception](https://hhhealthlawblog.com/hipaa-business-associates-and-the-conduit-exception/)
  — [HIPAA Journal: HIPAA Conduit Exception Rule](https://www.hipaajournal.com/hipaa-conduit-exception-rule/)
  — Assessment: High confidence (clarifying a potential misdirection in prior analysis).

---

### Finding 3: If the dispute-listener is connected to the hospital's EDI mapping store, BA status immediately attaches

- HHS FAQ 256 creates a two-sided rule: a software vendor that "hosts the software containing patient information on its own server or accesses patient information when troubleshooting the software function" **is** a business associate. The critical variable for cliqueue is whether the dispute-listener queries the hospital-local `(claimId → CLM01)` PostgreSQL store to look up the payer claim reference before firing the payer notification.
  — [HHS OCR FAQ 256](https://www.hhs.gov/hipaa/for-professionals/faq/256/is-software-vendor-business-associate/index.html)
  — Assessment: High confidence.

- **Design fork:** Two viable architectures exist:
  - **Architecture A (cliqueue-operated, no PHI):** The dispute-listener fires a notification to a payer webhook containing only `{ claimId: bytes32, disputeWindowEnd: uint256, contractAddress }`. The payer's own system performs the `(claimId → CLM01)` lookup. Cliqueue does not access the EDI mapping store. BA status: not triggered.
  - **Architecture B (hospital-deployed, with EDI mapping access):** The dispute-listener is deployed inside the hospital's network as a self-hosted module. It accesses the hospital-local EDI mapping store, performs the lookup, and fires an enriched payer notification containing `{ CLM01, disputeWindowEnd }`. BA status for cliqueue: not triggered (cliqueue never runs this). Hospital-managed sub-contractor BAA may be required if a third-party vendor operates the hospital's instance.
  — Assessment: High confidence as design principle; medium confidence on BA status edge cases.

---

### Finding 4: The Mirth Connect deployment model is the closest industry precedent — vendor-hosted triggers BAA, self-hosted does not (if no remote access)

- NextGen Healthcare's Mirth Connect integration engine is the industry's dominant healthcare middleware precedent. When hospital-self-hosted with no remote vendor access, NextGen does not require a BAA covering PHI (the hospital is itself the covered entity operating the tool). When cloud-hosted by NextGen (Mirth Cloud Connect), a full BAA is required.
  — [Mirth Connect 2026 Guide](https://mirth.support/mirth-connect-guide)
  — [NextGen Mirth Cloud Connect](https://www.nextgen.com/solutions/interoperability/mirth-cloud-connect)
  — Assessment: High confidence as analogous deployment model (PHI-bearing middleware; the principle applies a fortiori to cliqueue's non-PHI middleware).

- This precedent suggests: **Architecture A (cliqueue-operated)** is the lower-friction path for hospital procurement because it does not require a hospital IT deployment. However, it requires the payer to own the EDI mapping lookup — increasing payer integration complexity. **Architecture B (hospital-deployed)** mirrors the Mirth Connect self-hosted model, is familiar to hospital IT, but increases hospital onboarding complexity (requires hospital IT to deploy and maintain the listener module).

---

### Finding 5: 2025–2026 HIPAA Security Rule NPRM raises the stakes for BA identification accuracy

- The proposed 2026 HIPAA Security Rule updates impose new annual BA verification requirements on covered entities: covered entities must verify BA compliance within 24 hours of a security incident activation. This means hospitals will face increased scrutiny on whether all vendors in their data chain have correctly assessed their BA status.
  — [RubinBrown: HIPAA Security Rule Changes 2025–2026](https://www.rubinbrown.com/insights-events/insight-articles/hipaa-security-rule-changes-2025-2026-hipaa-updates/)
  — Assessment: Medium confidence (NPRM not yet finalized; content from trade press summary).

- For cliqueue, this means hospital procurement teams will apply a conservative presumption of BA status to any vendor-operated service touching claim data — even hashed data. Proactive documentation (written "non-PHI determination memo" from outside counsel) is more valuable than an internal self-assessment.
  — Assessment: High confidence as risk management inference.

---

**Design implication:** The dispute-listener's HIPAA BA status hinges entirely on whether it accesses the hospital's off-chain EDI mapping store. Architecture A (cliqueue-operated, fires claimId hash only to payer webhook, no EDI mapping access) avoids BA status for cliqueue but requires payer-side EDI lookup capability. Architecture B (hospital self-hosted, enriches with CLM01 before payer notification) avoids BA status for cliqueue entirely while enabling richer payer notifications, at the cost of hospital IT deployment burden. The recommended path for MVP is Architecture A (cliqueue-operated, no PHI access), with Architecture B offered as a self-hosted option for hospital-IT-mature deployments. Both architectures require a one-paragraph "Non-PHI Determination" section in cliqueue's onboarding documentation asserting that the dispute-listener does not access, create, receive, maintain, or transmit PHI, citing HHS OCR FAQ 256, for hospital procurement review.

**Open questions generated:**
1. Should cliqueue publish a formal "Non-PHI Determination Memo" (outside-counsel-reviewed) covering the dispute-listener and all other cliqueue-operated services — so hospital privacy officers have documented legal support rather than relying on cliqueue's self-assessment, especially given the 2026 HIPAA Security Rule BA verification tightening?
2. For Architecture A, does requiring the payer to perform its own `(claimId → payer claim reference)` lookup create a payer integration barrier that makes Architecture B necessary for the first production hospital deployment — and should cliqueue's onboarding checklist include a payer readiness questionnaire before selecting the architecture?
3. If cliqueue later adds an enrichment step (looking up the hospital's EDI mapping to include `CLM01` in the payer webhook payload), does that single addition transform cliqueue from not-a-BA to a BA requiring a full executed BAA before the enrichment feature is enabled — and should this be documented as a hard feature gate in the product spec?

---

**See also** — [[../topics/dispute-window|dispute-window hub]] · [[../topics/hipaa|HIPAA hub]]
