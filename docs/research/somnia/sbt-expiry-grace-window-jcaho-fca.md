# SBT Credential Expiry Grace Window — JCAHO PSV Lapse vs. FCA Liability vs. On-Chain Exploit Risk

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-15 — If a hospital's JCAHO audit reveals PSV was not completed in a given month (e.g., staff shortage), should `ClaimsAdjudicator` allow a 72-hour grace window past SBT `expiry` to prevent catastrophic claim submission failure — and does a grace window open an exploitable window for stale-credential attestations?

**Context:** Prior research ([[sbt-credential-expiry-enforcement]]) established a 30-day SBT expiry cycle with `require(expiry >= block.timestamp)` at claim submission, and `renewExpiry()` forced after each monthly PSV pass. That finding left open: what happens operationally when a hospital's PSV process is delayed (staff shortage, vendor outage, holiday cycle) — and whether a grace window to mitigate this failure mode creates a security hole.

---

### Finding 1: JCAHO does not define a grace period for missed monthly PSV — remediation is organizational, not a regulatory time window

- The Joint Commission's 2025 monthly credential monitoring standard (effective January 2025) requires re-verification of key credentials for all privileged practitioners at least every 30 days, including licenses, DEA registrations, board certifications, and OIG LEIE/SAM exclusion status. The standard does not define a regulatory grace period for a missed monthly cycle.
  — [Ethico: JCAHO 2025 Monthly Credential Monitoring Requirements](https://ethico.com/regulatory-updates/jcaho-2025-monthly-credential-monitoring-requirements-complete-compliance-checklist/)

- When PSV is missed, the Joint Commission's remediation path is a corrective action plan, not an automatic time extension. Response timeframes are prescribed per finding type (e.g., exclusion match = immediate suspension), but no standard grants a 30–72 hour "PSV lapse grace window" for credentialing staff failure. The organization bears the liability.
  — [ProviderTrust: Joint Commission Compliance for Healthcare Licenses and Credentials](https://www.providertrust.com/blog/joint-commission-compliance-healthcare-licenses-credentials/)

- NCQA (the parallel accreditation body for managed care plans) tightened verification deadlines in 2025: verifications must be completed within 120 days (down from 180), and CVCO organizations within 90 days. No short-cycle grace period (hours or days) is defined — the timelines apply to the full credential cycle, not to monthly monitoring cycles.
  — [Human Medical Billing: Medical Credentialing in 2025 — New NCQA Rules](https://humanmedicalbilling.com/blog/medical-credentialing-in-2025-new-ncqa-rules-you-must-know/)

### Finding 2: AHIMA credentials carry an explicit lapse prohibition — coders may NOT use credentials during inactive or revoked status

- AHIMA's 2025 Recertification Guide establishes a strict status ladder: **Active → Inactive (180-day window) → Revoked**. AHIMA removed the "grace" status category as of 2021. During the inactive period (up to 180 days post-cycle-end), "the credential(s) may not be used." During revocation, "individuals may not use the applicable credential(s)."
  — [AHIMA: FAQS: Recertification](https://www.ahima.org/contact-us-faqs/faqs-recertification/); [AHIMA: Recertify](https://ahima.org/certification/Recertification)

- AAPC credentials (CPC, COC, etc.) lapse after 90 days of non-renewal. AAPC policy states that "without meeting your CEU quota, you won't be able to use your credentials." After 90 days without reinstatement, a formal reinstatement process (including fees and potential exam retake) is required.
  — [AAPC: How to Maintain Your Certification](https://www.aapc.com/certifications/maintain-your-certification); [AAPC: Certification Cancellation and Reinstatement Policy](https://www.aapc.com/about-us/certification-cancellation)

- **Critical implication for cliqueue:** If an AHIMA CCS coder's SBT expiry coincides with an AHIMA credential inactive period, the coder is already prohibited by AHIMA from performing attestations — a grace window in `ClaimsAdjudicator` would allow claim submission that is simultaneously in violation of AHIMA's own credential use prohibition. The on-chain grace window would undermine the very compliance signal the SBT is designed to represent.

### Finding 3: FCA liability for stale-credential attestations is organizational and real — DOJ FY2025 record $6.8B in recoveries

- DOJ FCA recoveries in FY2025 exceeded $6.8 billion, the highest annual total in the statute's history, with over $5.7 billion from healthcare matters. Billing federal programs for services performed by excluded providers or with false attestations triggers per-claim penalties of up to $100,000 plus treble damages.
  — [DOJ: False Claims Act Settlements FY2025](https://www.justice.gov/opa/media/1424126/dl); [White & Case: DOJ's Record-Breaking 2025 FCA Recoveries](https://www.whitecase.com/insight-alert/dojs-record-breaking-2025-false-claims-act-recoveries-and-key-healthcare-fraud)

- Payers (Humana, Cigna, UnitedHealth) updated Q2 2025 contracts to require human validation by credentialed coders for AI-generated codes. A May 2025 Oxford Global review found LLM coding systems achieved less than 50% accuracy without human oversight, reinforcing payer contract requirements for credentialed-coder attestation.
  — [Coding Network: Why Human Oversight in AI Medical Coding Remains Essential in 2025](https://codingnetwork.com/why-human-oversight-in-ai-medical-coding-remains-essential-in-2025/)

- A grace window in `ClaimsAdjudicator` that allows a known-expired SBT to attest inpatient claims creates an auditable paper trail (the Somnia event log is immutable) documenting that cliqueue permitted attestations from expired credentials. This is precisely the kind of "knowingly" element DOJ uses to escalate FCA cases from negligent to willful violations.

### Finding 4: The timestamp manipulation risk of a 72-hour grace window is LOW on Somnia BFT — but the credential-validity risk is HIGH

- Ethereum-style `block.timestamp` manipulation is bounded by the ±15-second miner tolerance (the "15-second rule"). On Somnia's BFT MultiStream consensus (deterministic finality per block, ~100ms block time), validator collusion to manipulate timestamps would require Byzantine majority — the same threshold that breaks BFT consensus entirely. The timestamp manipulation attack surface for a 72-hour grace window on Somnia is negligible.
  — [OWASP: Timestamp Dependence](https://owasp.org/www-project-smart-contract-top-10/2023/en/src/SC03-timestamp-dependence.html); [Somnia Docs: MultiStream Consensus](https://docs.somnia.network/somnia-blockchain/multistream-consensus); [Hacken: Somnia Mainnet Audits](https://hacken.io/case-studies/somnia-mainnet-audits/)

- However, the exploit surface for a grace window is **not** timestamp manipulation — it is **social engineering and operational abuse**. A hospital IT administrator or compromised `HOSPITAL_ADMIN` key could deliberately delay SBT renewal, knowing the grace window allows 72 more hours of claim submission with an expired credential. The attacker need not touch the timestamp: they simply withhold renewal while continuing to submit claims. This is a trust-model exploit, not a cryptographic one.

- ERC-7858 (Expirable NFTs and SBTs) defines TIME_BASED expiry using `block.timestamp` and explicitly flags that grace periods reduce the window-tightening benefit of expiry enforcement. The EIP recommends treating expired tokens as "unusable during validity checks."
  — [ERC-7858: Expirable NFTs and SBTs](https://eips.ethereum.org/EIPS/eip-7858)

### Finding 5: The correct mitigation is NOT a contract-level grace window — it is an off-chain PSV automation requirement in the hospital onboarding contract

- The operational failure mode (PSV not completed due to staff shortage) is a hospital process failure, not a blockchain protocol failure. The correct mitigation is:
  1. **Require automated PSV** as a condition of cliqueue onboarding — the hospital must use a continuous monitoring service (Verisys, Symplr, ProviderTrust, or equivalent) that performs monthly LEIE/AHIMA/AAPC checks without manual intervention. Staff shortages do not interrupt automated monitoring.
     — [ProviderTrust: Joint Commission Compliance](https://www.providertrust.com/blog/joint-commission-compliance-healthcare-licenses-credentials/)
  2. **Require a rolling 7-day renewal lead time** by setting `SBTRegistry.renewExpiry()` to refresh the expiry 7 days before the current expiry date (i.e., `newExpiry = oldExpiry + 30 days`, callable by `HOSPITAL_ADMIN` any time in the 7-day window before expiry). This creates a natural buffer without opening a post-expiry grace window.
  3. **`ClaimsAdjudicator` enforces hard expiry** — `require(expiry >= block.timestamp)` with no grace window. Expired SBT = claim submission reverted, immediately alerting the hospital's RCM team.
  4. **BAA clause** binding the hospital to automated PSV infrastructure as a condition of the agreement.

- This architecture transfers the operational risk to the hospital (where JCAHO places it) while keeping `ClaimsAdjudicator`'s trust model clean. A contract-level grace window would be visible to regulators and auditors as a designed mechanism to accept known-expired credentials — legally worse than an accidental lapse.

---

**Design implication:** `ClaimsAdjudicator` must NOT implement a grace window past SBT `expiry`. The hard `require(expiry >= block.timestamp)` check is correct. The operational PSV-delay risk is mitigated off-chain via (1) automated continuous monitoring as an onboarding requirement, (2) a 7-day renewal lead-time window in `SBTRegistry.renewExpiry()`, and (3) a BAA clause binding hospitals to automated PSV. A contract-level grace window creates an FCA audit trail risk (immutable Somnia event log documents cliqueue permitting expired-credential attestations), an AHIMA credential-use prohibition violation, and a social-engineering exploit surface — all without meaningful benefit, since the timestamp manipulation attack the grace window "prevents" is negligible on Somnia's BFT consensus.

**Open questions generated:**
1. Should cliqueue's hospital onboarding checklist include a specific list of approved continuous PSV monitoring vendors (Verisys, Symplr, ProviderTrust) — and should cliqueue negotiate a partnership/referral with one vendor to reduce the onboarding friction for hospitals that do not already have automated monitoring in place? — priority: medium
2. Should the `SBTRegistry` emit a `CredentialExpiryWarning(attestorAddress, hospitalId, expiry, warningThreshold)` event at `expiry - 7 days` to allow the hospital's off-chain monitoring system to trigger the `renewExpiry()` call proactively — and does emitting this event on a public chain create a HIPAA or PII concern for individual coders? — priority: medium
3. What is the minimum staffing redundancy (e.g., minimum 2 active SBT holders per `hospitalId`) cliqueue should require at onboarding to prevent a single-coder absence from triggering catastrophic claim submission failure — and should this minimum be enforced on-chain in `ClaimsAdjudicator` as a `minAttesters` parameter? — priority: high

---

**See also** — [[../topics/sbt|SBT hub]]
