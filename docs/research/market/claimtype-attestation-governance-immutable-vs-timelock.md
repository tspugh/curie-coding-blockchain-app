# ClaimType → requiresHumanAttestation: Immutable vs. TimelockController Governance

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should the `claimType → requiresHumanAttestation` mapping in `ClaimsAdjudicator` be hardcoded as `immutable` constants or stored as a governance-controlled `mapping(uint8 claimType => bool)` behind `TimelockController`?

### Finding 1: No CMS/HHS rulemaking mandates outpatient AI coding attestation as of May 2026 — but regulatory trajectory signals eventual expansion

- The CY 2026 OPPS Final Rule (CMS-1834-FC, published November 25, 2025 in the Federal Register) does not contain a specific mandate for human review of AI-autonomously coded outpatient claims. CMS received extensive comments on future payment methods for AI/SaaS coding tools but deferred rulemaking on AI coding oversight.
  — Source: https://www.cms.gov/newsroom/fact-sheets/calendar-year-2026-hospital-outpatient-prospective-payment-system-opps-ambulatory-surgical-center; https://www.federalregister.gov/documents/2025/11/25/2025-20907/medicare-program-hospital-outpatient-prospective-payment-and-ambulatory-surgical-center-payment
  — Assessment: High confidence. CMS fact sheet confirmed; Federal Register document ID confirmed.

- The FY 2027 IPPS Proposed Rule (CMS-1849-P, published April 2026) proposes "expanded oversight across hospital policies" including outpatient expansion via the CJR-X Model (mandatory nationwide episode-based payment for acute care hospitals under both IPPS and OPPS starting October 2027), but contains no specific AI coding attestation requirement.
  — Source: https://www.cms.gov/newsroom/fact-sheets/fy-2027-hospital-inpatient-prospective-payment-system-ipps-long-term-care-hospital-prospective; https://www.appliedpolicy.com/cms-proposes-2-4-ipps-update-for-fy-2027-with-targeted-payment-adjustments-dsh-reductions-and-expanded-oversight-across-hospital-policies/
  — Assessment: High confidence for the IPPS proposal existence; moderate confidence that AI coding attestation was not addressed (based on industry summaries, not full rule text).

- HHS OIG Work Plan includes audits of "Selected Inpatient and Outpatient Billing Requirements" (project SRS-A-25-012, announced June 2025, completed February 2026) but does not enumerate AI coding attestation as a specific audit trigger. OIG's broader position is that AI coding accountability applies equally to inpatient and outpatient claims, without specifying attestation mechanics.
  — Source: https://oig.hhs.gov/reports/work-plan/browse-work-plan-projects/srs-a-25-012/; https://www.tuckerellis.com/alerts/avoiding-false-claims-act-landmines-in-ai-assisted-coding-and-medical-billing/
  — Assessment: Moderate confidence. OIG work plan project summary is public; OIG AI coding position sourced from law firm summary.

- **Directional signal**: CMS is clearly on a trajectory toward expanding AI coding oversight to outpatient claims — the 2026 OPPS comment period generated extensive industry feedback, and the FY 2027 inpatient-only list phase-out (begun 2026, full phase-out by 2029) will push previously inpatient-only procedure codes into outpatient billing, expanding the scope of outpatient DRG-equivalent review. A governance-controlled mapping that can be flipped without a full contract upgrade is prudent.
  — Source: https://acdis.org/articles/news-cms-releases-2026-opps-final-rule-begins-inpatient-only-list-phase-out
  — Assessment: Moderate confidence inference; inpatient-only list phase-out is a confirmed CMS policy, the regulatory-trajectory inference is this analyst's.

### Finding 2: Established DeFi governance pattern — hardcode core invariants, govern secondary parameters

- OpenZeppelin's TimelockController documentation establishes that governance-controlled parameters must be proposed, queued, and executed with a mandatory time delay before taking effect. The TimelockController can own any Ownable contract; all `onlyOwner` operations require the timelock delay, giving token holders time to exit if a malicious proposal passes.
  — Source: https://docs.openzeppelin.com/contracts/5.x/governance; https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/TimelockController.sol
  — Assessment: High confidence. First-party OZ documentation.

- The DeFi security community has converged on a **hybrid architecture**: core invariants that would constitute protocol betrayal if flipped are hardcoded `immutable` or `constant`; secondary parameters that require operational flexibility are stored in governance-controlled state. Trail of Bits' June 2025 post "Maturing your smart contracts beyond private key risk" identifies Level 4 (Uniswap, Liquity) as fully immutable, Level 3 as immutable core + governed parameters, with Level 3 being the pragmatic target for healthcare settlement protocols that must respond to regulatory changes.
  — Source: https://blog.trailofbits.com/2025/06/25/maturing-your-smart-contracts-beyond-private-key-risk/
  — Assessment: High confidence. Directly from Trail of Bits' canonical governance maturity blog post.

- In Compound's governance attack (July 2024 Proposal 289), 499,000 COMP tokens were transferred to an unmonitored multisig by a slim majority (682,000 for vs. 633,000 against). The lesson cited by DeFi security researchers: parameters that represent "constitutional" protocol rules (collateral ratios, penalty floors) should not be governable by simple majority — either they are hardcoded or require supermajority + timelock.
  — Source: https://research.despread.io/compound-finance-governance-attack/; https://medium.com/@6ixty80/compounds-24m-dao-heist-how-governance-theater-enabled-the-golden-boys-to-exploit-defi-s-f860de7d796b
  — Assessment: High confidence. Multiple independent post-mortems confirm the event and the lesson.

- Aave V3 governance architecture separates core protocol parameters (immutable at deployment) from risk parameters (governed via DAO with timelocks of 24–72 hours). The Aave Governance v3 documentation explicitly scopes the "Core Network" for high-trust operations and uses "secondary" councils for routine parameter updates.
  — Source: https://github.com/aave-dao/aave-governance-v3/blob/main/docs/overview.md; https://aave.com/docs/developers/governance
  — Assessment: High confidence. First-party Aave documentation.

### Finding 3: Gas cost — immutable is ~700x cheaper per read than cold SLOAD on the claim hot path

- Under EIP-2929 (Berlin hardfork), an SLOAD on a cold storage slot costs 2,100 gas; a warm SLOAD costs 100 gas. Immutable variables are embedded as `PUSH32` instructions in bytecode, costing approximately 3 gas per read.
  — Source: https://eips.ethereum.org/EIPS/eip-2929; https://hackmd.io/@fvictorio/gas-costs-after-berlin; https://rareskills.io/post/gas-optimization
  — Assessment: High confidence. EIP-2929 spec is authoritative; RareSkills gas optimization guide corroborates the 3 vs. 2100 comparison.

- For `ClaimsAdjudicator`, the `requiresHumanAttestation` check occurs on every `submitClaim()` call. At 10,000 claims/day, the difference between a cold SLOAD (2,100 gas) and an immutable read (3 gas) is 2,097 gas per call. On Somnia with its 1M-gas cold-SLOAD surcharge on infrequently accessed slots, this becomes material: if the `mapping(uint8 => bool)` slot is not accessed in the prior transaction (e.g., a new claim type added via governance that is rarely used), the first read per block incurs 1M gas, not 2,100.
  — Source: Somnia cold-SLOAD surcharge documented in docs/research/somnia/evm-hardfork-level-paris-and-canary-tests.md (prior research)
  — Assessment: High confidence on gas math; Somnia-specific 1M cold-SLOAD surcharge is from prior research, not re-verified here.

- **Practical implication**: The `INPATIENT → requiresHumanAttestation = true` path is invoked on every inpatient claim. Given Somnia's cold-SLOAD economics, reading from a storage mapping once per block (2,100 gas) vs. warm (100 gas after first access in same block) vs. immutable (3 gas always) is significant. For inpatient, where the answer is constitutionally `true`, an `immutable bool INPATIENT_REQUIRES_ATTESTATION = true` eliminates the storage read entirely.

### Finding 4: Governance attack risk — a compromised multisig could flip `INPATIENT → false`, enabling FCA violations at scale

- The UCHealth $23M FCA settlement (November 2024) was for automated upcoding of outpatient ED E&M codes. An analogous attack on `ClaimsAdjudicator` via governance: a compromised or captured governance multisig could pass a TimelockController proposal setting `mapping[INPATIENT] = false`, effectively disabling attestation requirements for all inpatient DRG claims submitted thereafter. This would be a catastrophic, hard-to-detect FCA exposure for every hospital using the protocol.
  — Source: https://www.arnoldporter.com/en/perspectives/blogs/fca-qui-notes/posts/2024/11/beware-of-automated-or-ai-generated-billing-coding-to-government-healthcare-programs
  — Assessment: Moderate-high confidence inference from FCA precedent. Actual on-chain attack scenario is this analyst's.

- DeFi post-mortems consistently show that governance attacks exploit "constitutional" parameters that were made governable for convenience. Trail of Bits' 2024 report notes only 18% of audited protocols with upgradeability have "robust access controls" for their core invariants.
  — Source: https://blog.trailofbits.com/2025/06/25/maturing-your-smart-contracts-beyond-private-key-risk/
  — Assessment: High confidence for the 18% statistic; moderate confidence on direct applicability to healthcare protocol design.

### Finding 5: Recommended architecture — hybrid: hardcode inpatient invariant, govern outpatient and future claim types

Based on the above findings, the recommended architecture for `ClaimsAdjudicator` is:

1. **Hardcode `INPATIENT → requiresHumanAttestation = true` as an `immutable bool`** (or a `constant`) embedded in bytecode. This value cannot be changed without a full contract implementation upgrade (UUPS), which itself requires the `TimelockController` — making it effectively a "supermajority + delay" constraint. This mirrors the Trail of Bits Level 3 pattern: core invariants are hardcoded, secondary parameters are governed.

2. **Store `OUTPATIENT → requiresHumanAttestation` as a `mapping(uint8 claimType => bool)` behind `TimelockController`**, defaulting to `false`. This allows a future CMS regulation requiring outpatient attestation to be enabled via a governance proposal without a UUPS upgrade.

3. **Reserve `claimType` values 2–255 for future claim categories** (home health, hospice, swing bed, skilled nursing outpatient) with their `requiresHumanAttestation` defaults also stored in the governance mapping — initialized to `false` at deployment, governable thereafter.

4. **Do not make `INPATIENT_REQUIRES_ATTESTATION` governable at all** — not even behind a supermajority timelock. The FCA risk of a flipped inpatient flag is too severe; any legitimate regulatory change requiring `false` for inpatient would be so extreme as to warrant a new contract deployment (spec change), not a governance parameter update.

**Design implication:** `ClaimsAdjudicator` should split the attestation mapping into two tiers: `immutable bool INPATIENT_REQUIRES_ATTESTATION = true` (bytecode-embedded, ungovernable) and `mapping(uint8 claimType => bool) public attestationRequired` (TimelockController-governed, initialized with `OUTPATIENT → false`, `HOME_HEALTH → false`, etc.). The gas hot path for inpatient claims reads 3-gas immutable; the governance mapping is only read for outpatient and novel claim types where regulatory evolution is expected.

**Open questions generated:**
1. Should the `attestationRequired` governance mapping be initialized at deployment with all known TOB second-digit categories — or lazily default to `false` for any unmapped `claimType` value, relying on a `ClaimTypeAdded` event to signal new entries?
2. Does Somnia's 1M-gas cold-SLOAD surcharge apply to a `mapping(uint8 => bool)` slot that was last written in a prior block but not yet read in the current block — and would batching multiple outpatient claim submissions in a single transaction warm the mapping slot after the first read?
3. Should the hybrid attestation architecture (immutable inpatient + governed outpatient mapping) be documented as a formal amendment to the `ClaimsAdjudicator` spec before the next feature branch regeneration?

---

**See also** — [[../topics/upgradeable-proxy|upgradeable-proxy hub]] · [[../topics/sbt|SBT hub]]
