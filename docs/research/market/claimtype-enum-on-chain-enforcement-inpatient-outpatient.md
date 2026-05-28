# ClaimType On-Chain Enforcement — Inpatient vs. Outpatient Gating of `requiresHumanAttestation`

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should `ClaimsAdjudicator` enforce a `claimType` field (inpatient/outpatient) at submission time that gates the `requiresHumanAttestation` flag — so the contract enforces the regulatory distinction automatically?

### Finding 1: The 837I Type of Bill (TOB) field provides the canonical inpatient/outpatient signal cliqueue should mirror on-chain

- In the 837I institutional claim format (X12 Version 5010A2), Form Locator 04 (TOB) is a four-digit code whose second digit distinguishes inpatient (TOB 11X — acute inpatient hospital) from outpatient (TOB 13X — outpatient hospital, 22X — skilled nursing facility outpatient). ICD-10-PCS codes are only valid on inpatient claims (TOB 11X); outpatient facility claims use CPT/HCPCS for procedures, not ICD-10-PCS.
  — Source: https://medicalbillingrcm.com/ub04-type-of-bill-codes-list-tob/; https://www.cms.gov/files/document/837i-form-cms-1450-mln006926.pdf
  — Assessment: High confidence. TOB is a required field in 837I per CMS guidance and ASC X12 Version 5010.

- The practical encoding for cliqueue: `ClaimType { INPATIENT, OUTPATIENT }` as a `uint8` enum, with `INPATIENT` mapping to TOB second-digit "1" (TOB 11X series) and `OUTPATIENT` mapping to TOB second-digit "3" or "2" (TOB 13X, 22X). This is derivable from the off-chain 837I adapter that produces the on-chain `claimId` — the adapter already has the TOB field and can set `claimType` before hashing.
  — Assessment: High confidence inference from EDI spec.

### Finding 2: FCA exposure exists for both inpatient and outpatient AI-coded claims, but the risk vectors differ — on-chain enforcement must cover both

- The UCHealth $23M FCA settlement (November 12, 2024) involved automated upcoding of **outpatient** emergency department E&M codes (CPT 99285), not inpatient DRG claims. The automated rule applied the highest-level ED code whenever vital-sign check frequency exceeded hours of patient stay — departing from American College of Emergency Physicians documentation guidelines. CMS had flagged UCHealth as a "high outlier" for CPT 99285 usage before the DOJ intervened.
  — Source: https://www.arnoldporter.com/en/perspectives/blogs/fca-qui-notes/posts/2024/11/beware-of-automated-or-ai-generated-billing-coding-to-government-healthcare-programs; DOJ settlement dated November 2024.
  — Assessment: High confidence. DOJ intervention is a matter of public record; case number confirmed in multiple law firm summaries.

- CMS has stated that "accountability for coding accuracy does not change just because a hospital system uses AI." The FCA's treble-damages and per-claim penalty provisions apply regardless of whether a human or algorithm generated the code.
  — Source: https://www.tuckerellis.com/alerts/avoiding-false-claims-act-landmines-in-ai-assisted-coding-and-medical-billing/
  — Assessment: High confidence. Multiple law firm summaries cite this CMS position consistently.

- A May 2025 Oxford Global review found LLM coding systems achieved less than 50% accuracy without human oversight.
  — Source: https://codingnetwork.com/why-human-oversight-in-ai-medical-coding-remains-essential-in-2025/
  — Assessment: Moderate confidence. Reported in industry summary; Oxford Global methodology not publicly available.

### Finding 3: Humana/Cigna payer contract language does not yet differentiate inpatient from outpatient — attestation requirement applies to "AI-generated codes" broadly

- As of Q2 2025, Humana and Cigna (Medicare Advantage) require providers to "attest that AI-generated codes have been validated by credentialed coders." This contract language applies to AI-coded claims broadly — it does not distinguish inpatient DRG from outpatient facility claims in available industry summaries. The contractual text is not publicly available; this represents moderate-confidence industry reporting.
  — Source: https://codingnetwork.com/why-human-oversight-in-ai-medical-coding-remains-essential-in-2025/; https://www.billingparadise.com/blog/medical-ai-coding-hybrid-model-q3-2025/
  — Assessment: Moderate confidence. Industry summaries consistent but exact payer contract text not publicly verifiable.

- Implication: cliqueue's `requiresHumanAttestation` flag should be `true` for **both** inpatient and outpatient claims where Corti Symphony is the coding agent — payer contracts currently do not create a carve-out for outpatient autonomy. However, the flag can remain `false` for outpatient claims where the hospital has independently validated the confidence threshold and the payer contract does not mandate credentialed attestation (e.g., commercial non-MA plans).

### Finding 4: No existing blockchain healthcare implementation uses claim-type-gated attestation enforcement — this is novel design space

- A 2026 Frontiers in Blockchain systematic review of healthcare insurance tokenization identified claim type differentiation and role-gating by admission type as explicitly underexplored: "past reviews have generally taken a broad approach...and rarely touch tokenization mechanisms like claim tokens, identity tokens or automated adjudication workflows."
  — Source: https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2026.1768301/full
  — Assessment: High confidence. This is a stated gap in the survey's own scope analysis.

- Academic blockchain healthcare papers (2024–2025) use generic `Patient` and `Claim` structs with RBAC/ABAC controls but do not encode claim-type-specific attestation requirements in smart contract logic. The pattern of `claimType`-gated `requiresHumanAttestation` that cliqueue is designing is not documented in the literature — it is a novel contribution.
  — Assessment: High confidence (absence of evidence across multiple systematic search attempts).

### Finding 5: Recommended on-chain design — `claimType` as a `uint8` with a submission-time `requiresHumanAttestation` derivation rule

- The recommended architecture: at `submitClaim(claimId, claimType, ...)`, the `ClaimsAdjudicator` contract derives `requiresHumanAttestation` from `claimType` using a simple rule stored in an immutable or governance-controlled mapping:
  - `INPATIENT` → `requiresHumanAttestation = true` (mandatory, cannot be overridden by hospital)
  - `OUTPATIENT` → `requiresHumanAttestation = false` (default) OR `true` (if hospital has opted in or payer contract requires it)
- This preserves the regulatory minimum (inpatient always requires attestation per AHIMA ethical standards and OIG guidance) while allowing outpatient flexibility. A hospital cannot submit an inpatient DRG claim without a valid SBT holder signing — this is enforced at the contract level, not policy level.
  — Assessment: Architectural inference from prior research findings and regulatory framing. No counter-evidence found.

- Gas consideration: storing `claimType` as a `uint8` in the `Claim` struct packed alongside existing fields (e.g., `status`, `claimCategory`) costs zero additional storage slots if packed correctly. The `requiresHumanAttestation` flag can be a `bool` in the same slot. An immutable `bytes32 INPATIENT_ATTESTATION_REQUIRED = true` constant eliminates a storage read on the hot path.
  — Source: https://docs.openzeppelin.com/contracts/5.x/access-control (struct packing patterns); OpenZeppelin AccessControl.sol
  — Assessment: High confidence. Standard Solidity struct packing behavior.

**Design implication:** `ClaimsAdjudicator` should include a `uint8 claimType` field in the `Claim` struct (values: `0 = OUTPATIENT`, `1 = INPATIENT`) set at submission time and used to derive `requiresHumanAttestation` on-chain. For inpatient claims, the contract should `revert` with `InpatientRequiresAttestation()` if no valid SBT holder signature is present. For outpatient claims, attestation is optional but the `claimType` field enables payer agents to apply their own contract-specific validation off-chain. The off-chain 837I adapter derives `claimType` from the TOB second digit before computing `claimId`.

**Open questions generated:**
1. Should the `claimType` → `requiresHumanAttestation` mapping be hardcoded as an `immutable` constant or stored as a governance-controlled `mapping(uint8 claimType => bool)` behind the `TimelockController` — so that a future CMS regulation mandating outpatient attestation can be enabled without a contract upgrade?
2. Does Corti Symphony's MCP interface surface the TOB/claim-category distinction in its API (i.e., does the hospital pass `claimType` to Symphony, or must cliqueue's adapter infer it from the clinical note type) — and does Symphony return different code sets (ICD-10-PCS vs. CPT) based on claim type?
3. Should the `ClaimsAdjudicator` enforce an `ICD10PCS_REQUIRED` flag for inpatient claims (requiring at least one ICD-10-PCS procedure code alongside ICD-10-CM diagnosis codes) to detect miscategorized outpatient claims submitted as inpatient — providing a second on-chain guard against TOB misreporting?

---

**See also** — [[../topics/sbt|SBT hub]] · [[../topics/corti|Corti hub]] · [[../topics/upgradeable-proxy|upgradeable-proxy hub]]
