# `blockedPayerIds` On-Chain Privacy Design — Hash vs Raw EDI ID

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should `blockedPayerIds` use `bytes32` hashes of payer EDI IDs or store raw EDI ID strings — and does storing raw payer IDs on a public chain create HIPAA or competitive-sensitivity concerns?

**Context:** `ClaimsAdjudicator` implements a Medicare Advantage exclusion gate via a `blockedPayerIds` mapping. Prior research established that MA risk-adjustment coding must be excluded from Phase 1 (active DOJ enforcement). This session investigates the on-chain representation of payer IDs in that mapping.

---

### Finding 1: Payer EDI IDs are NOT HIPAA PHI — no regulatory disclosure obligation from on-chain storage alone

- Under **45 CFR §160.103**, PHI requires three conjunctive elements: (1) health information relating to a health condition, care, or payment *for an individual*, (2) created/received by a covered entity or BA in a healthcare role, and (3) individually identifiable. A payer's CMS EDI ID (the 5-digit X12 837 Loop 2010BB NM109 identifier) identifies the **health plan as an organization**, not the patient.
  — [45 CFR §160.103](https://www.law.cornell.edu/cfr/text/45/160.103)
  — [45 CFR §164.514(b)](https://www.law.cornell.edu/cfr/text/45/164.514) (safe harbor identifier list — covers individual identifiers, not payer/plan identifiers)
  — Assessment: High confidence. Multiple primary sources confirmed.

- HHS/ASPE HIPAA EDI transaction standards treat payer identifiers as administrative transaction routing identifiers, not patient PHI. OCR guidance consistently frames PHI as information about an identifiable *individual* related to health status, care, or payment *for that individual*.
  — [HHS ASPE: Health Insurance Reform Standards for Electronic Transactions](https://aspe.hhs.gov/reports/health-insurance-reform-standards-electronic-transactions)
  — Assessment: High confidence.

- **Storing a payer EDI ID alone on-chain does not trigger HIPAA disclosure obligations.** HIPAA's disclosure rules apply to PHI. A `bytes32` mapping slot containing a hash of a CMS payer ID carries no health information about any identifiable individual and is categorically outside the PHI definition.
  — Assessment: High confidence.

- **Caveat:** If the `blockedPayerIds` mapping entry is combined with claim-specific data, dates, or subscriber information elsewhere in the same transaction, the *transaction as a whole* may involve PHI even if the payer ID alone is not. cliqueue's existing design (no PHI on-chain) already prevents this.
  — Assessment: High confidence.

---

### Finding 2: CMS MA payer IDs are substantially public — hashing provides competitive-sensitivity protection, not HIPAA protection

- CMS publicly publishes Medicare Advantage plan/contract identity and enrollment data in the **Medicare Advantage/Part D Contract and Enrollment Data** repository, including plan directories and benefits data.
  — [CMS MA/Part D Contract and Enrollment Data](https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-advantagepart-d-contract-and-enrollment-data)
  — Assessment: High confidence. Direct CMS source.

- The specific 5-digit X12 EDI payer IDs used in Loop 2010BB NM109 are **not always published in a direct CMS crosswalk file** — they are often trading-partner identifiers maintained by clearinghouses and payer companion guides. However, they are widely available through industry sources (CAQH EnrollHub, payer companion guides, clearinghouse directories) and are not treated as confidential by payers.
  — Assessment: Medium confidence (CMS crosswalk ambiguity; clearinghouse availability confirmed by industry practice).

- The **competitive-sensitivity risk is not about the payer ID itself** (which is public or derivable) but about the hospital's **exclusion policy**: which payers it has blocked reveals business intelligence — strained payer relationships, selective claim routing, or contractual disputes. This is the material sensitivity concern, not HIPAA.
  — Assessment: High confidence.

---

### Finding 3: `bytes32` hashed key is technically superior and privacy-conservative; domain separator recommended

- The canonical EVM pattern for a payer blocklist is `mapping(bytes32 => bool)` where the key is derived as:
  ```solidity
  bytes32 constant BLOCKLIST_DOMAIN = keccak256("ClaimsAdjudicator.blockedPayerIds.v1");
  function _payerKey(string memory payerId) internal pure returns (bytes32) {
      return keccak256(abi.encodePacked(BLOCKLIST_DOMAIN, payerId));
  }
  ```
  — [EVM SSTORE gas accounting: 22,100 gas for first write to empty slot regardless of key type](https://ethereum.org/developers/docs/evm/opcodes/)
  — Assessment: High confidence for gas cost; high confidence for domain-separator pattern (standard Solidity).

- Gas cost difference between `mapping(string => bool)` and `mapping(bytes32 => bool)` is dominated by the SSTORE write (~22,100 gas for first write) — the same regardless of key type. The `bytes32` approach avoids dynamic-string storage overhead and prevents canonicalization bugs (casing, whitespace). `bytes32` is strictly preferred.
  — Assessment: High confidence.

- The domain separator (`BLOCKLIST_DOMAIN`) prevents rainbow-table pre-computation of `keccak256(payerId)` for the known finite set of CMS payer IDs (the payer ID space is small and enumerable). Without a domain separator, a public set of CMS payer IDs could be pre-hashed and matched against on-chain keys in minutes.
  — Assessment: High confidence for the rainbow-table risk; high confidence for the domain separator mitigation.

---

### Finding 4: Emitting raw payer ID in `PayerBlocked` events defeats the mapping key hash — event design must emit only the commitment

- If `PayerBlocked(string payerId, bytes32 payerKey, address actor)` is emitted with the plaintext `payerId`, the hash is a lookup index (not a privacy barrier): any observer can read the event, recompute the hash, and link the payer to all future on-chain activity.
  — Assessment: High confidence. Standard cryptography principle; confirmed by Perplexity analysis with blockchain project precedents.

- The recommended event schema emits **only the commitment** (the `bytes32` hash under the domain separator) and a `reasonCode` (e.g., `uint8 reason` where `1 = MA_EXCLUSION`, `2 = CONTRACT_DISPUTE`, `3 = OTHER`). The human-readable payer ID remains in the hospital's off-chain credentialing/EDI system:
  ```solidity
  event PayerBlocked(bytes32 indexed payerCommitment, uint8 reasonCode, address indexed actor);
  event PayerUnblocked(bytes32 indexed payerCommitment, address indexed actor);
  ```
  — Assessment: High confidence for the design recommendation; consistent with healthcare blockchain privacy-preserving patterns (commitment + off-chain registry).

- Authorized auditors can verify the on-chain commitment against the off-chain payer ID registry. This is consistent with cliqueue's existing pattern of HMAC-hashed `claimId` values (no PHI on-chain, off-chain lookup for verification).
  — Assessment: High confidence.

---

### Finding 5: Access control — immediate BLOCKLIST_ADMIN add, TimelockController-governed remove

- The recommended two-tier access control pattern:
  - **`BLOCKLIST_ADMIN_ROLE`** (operationally held by 2-of-3 hospital admin multisig): can call `blockPayer(payerId)` immediately, without timelock. Justified by the urgency of blocking newly identified MA plans before they enter the claim stream.
  - **`TimelockController` (48-hour delay)**: governs `unblockPayer(payerId)`. Removal is the higher-risk operation — accidentally unblocking a legitimate MA plan restores DOJ-risk AI coding for that plan. The 48-hour delay is consistent with cliqueue's existing TimelockController governance pattern.
  — Assessment: High confidence for the asymmetric pattern; high confidence for the specific role assignments.

- CMS publishes new MA plan IDs each January (annual effective date) — the `BLOCKLIST_ADMIN` role enables the deployment runbook to add new CMS-published MA plan IDs at the annual update without waiting for a 48-hour governance delay.
  — [CMS MA/Part D Contract and Enrollment Data annual updates](https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-advantagepart-d-contract-and-enrollment-data)
  — Assessment: High confidence.

- Canonicalization is critical: the `_payerKey()` function must enforce a single canonical payer ID format (e.g., uppercase, trimmed, no leading zeros beyond standard format). Duplicate representations of the same payer (`"12345"` vs `"12345 "`) would produce different hashes and silently bypass the blocklist. The hospital's deployment runbook must specify the canonical format and validate it before calling `blockPayer()`.
  — Assessment: High confidence.

---

**Design implication:** `blockedPayerIds` must be `mapping(bytes32 => bool)` keyed by `keccak256(BLOCKLIST_DOMAIN || canonicalPayerId)`, where `BLOCKLIST_DOMAIN = keccak256("ClaimsAdjudicator.blockedPayerIds.v1")`. Raw payer EDI IDs must NOT be stored as mapping keys (dynamic string overhead, canonicalization risk) or emitted in events (defeats commitment privacy). `PayerBlocked` and `PayerUnblocked` events emit only the `bytes32 payerCommitment`, a `uint8 reasonCode`, and `address actor`. The HIPAA concern is minimal (payer IDs are not PHI), but competitive-sensitivity concern is real (exposure of hospital's payer exclusion policy). The domain separator mitigates rainbow-table lookup against the small payer ID space. Access control is asymmetric: immediate `BLOCKLIST_ADMIN_ROLE` for `blockPayer()`, `TimelockController`-gated for `unblockPayer()`.

**Open questions generated:**
1. Should the `reasonCode` enum values (`MA_EXCLUSION`, `CONTRACT_DISPUTE`, `OTHER`) be published in `ISBTRegistry`/`IClaimsAdjudicator` as a typed `enum BlockReason` — so auditors can decode reason codes without off-chain documentation? (Priority: medium)
2. Should the hospital BAA include a "Medicare Advantage Exclusion Exhibit" specifying the initial set of `blockedPayerIds` entries (by payer name, not by commitment hash) — giving hospital compliance teams a documented defense if an MA claim accidentally enters the system due to a missing blocklist entry? (Priority: high — already in research-questions.md as active)
3. Should the deployment runbook include an annual CMS MA plan update procedure: subscribe to CMS `MA/Part D Contract and Enrollment Data` release (each January), compute new commitment hashes using the canonical format, and call `blockPayer()` via `BLOCKLIST_ADMIN_ROLE` before the effective date? (Priority: high)

---

**See also** — [[../topics/hipaa|HIPAA hub]] · [[../topics/x12|X12 hub]]
