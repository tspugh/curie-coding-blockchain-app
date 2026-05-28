# minBatchThreshold Governance: Network Level vs Hospital Level

## 2026-05-15 — Should `minBatchThreshold` be set at the network level (cliqueue governance) or at the hospital level (`HOSPITAL_ADMIN` role), and does allowing hospital-level override create a compliance gap where a hospital reduces its own threshold to 1?

### Finding 1: HIPAA §164.514(b)(1) places expert determination obligation on the covered entity — not the platform vendor

- Under §164.514(b)(1), the expert determination obligation attaches to the **covered entity** (the hospital). The CE must document the methods and results of the expert's analysis and retain that documentation. A platform vendor (cliqueue, acting as a business associate) cannot satisfy this obligation on the CE's behalf — the CE must commission or adopt the determination as its own compliance artifact. ([HHS HIPAA De-identification Guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html); [45 CFR §164.514 via Cornell LII](https://www.law.cornell.edu/cfr/text/45/164.514))

- This means **the hospital's privacy officer is the correct authority to set `minBatchThreshold`** for that hospital's deployment — not cliqueue's network governance. Network-level enforcement of a single threshold would either (a) over-restrict high-volume hospitals that could safely use a lower threshold, or (b) under-protect low-volume hospitals that require a higher threshold than the network floor. CE-specific configuration is structurally required by the regulatory framework.

### Finding 2: HIPAA delegation of compliance obligations creates contractual — not regulatory — liability for the BA

- HIPAA BAA law establishes that when a covered entity delegates a compliance responsibility to a business associate, the delegation becomes a **contractual requirement**, creating contractual liability for the BA rather than direct regulatory liability. Regulatory enforcement liability remains with the CE. If a hospital sets `minBatchThreshold = 1` and a breach occurs, the OCR enforcement action targets the hospital; cliqueue's exposure is through the BAA's indemnification clause, not direct OCR penalties. ([HHS Business Associates guidance](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html); [HHS §164.504(e) BAA requirements](https://www.bricker.com/insights/resources/key/HIPAA-Privacy-Regulations-Uses-and-Disclosures-Organizational-Requirements-Business-Associate-Contracts-164-504-e))

- However, if a covered entity **fails to conduct due diligence** before entering a BAA (e.g., deploying cliqueue without commissioning their own expert determination or properly configuring `minBatchThreshold`), OCR can hold the CE liable for resulting breaches even where the CE delegated the configuration to a BA. This creates a strong incentive for cliqueue to require proof of expert determination as part of hospital onboarding — not to protect cliqueue from OCR, but to protect the hospital from its own misconfiguration.

### Finding 3: A platform-level expert determination can serve as the basis for hospital configurations, but with a mandatory floor

- Privacy Analytics (IQVIA), Integral, and similar HIPAA Expert Determination service providers offer platform-level or "De-identification-as-a-Service" expert determination reports that a covered entity can adopt. A single cliqueue network-level expert determination report can validly cover multiple hospital deployments *if* it explicitly characterizes the full range of deployment contexts (including the lowest-volume deployers) and documents the minimum batch size required to bring each risk scenario within "very small" risk. ([Privacy Analytics HIPAA Expert Determination Service](https://privacy-analytics.com/services/privacy-as-a-service/hipaa-expert-determination-and-de-identification-as-a-service); [HHS De-identification Guidance PDF](https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/coveredentities/De-identification/hhs_deid_guidance.pdf))

- For this to work, the cliqueue network-level expert determination must define a **mandatory minimum `minBatchThreshold` floor** (e.g., `minBatchThreshold_floor ≥ 11` for CV≥20% providers; `minBatchThreshold_floor ≥ 50` for CV<10% providers). Any hospital setting its threshold below this floor falls outside the determination's scope and bears its own regulatory exposure.

- The practical procurement implication: cliqueue can present hospitals with the network-level expert determination report and a standard BAA clause stating that the hospital must either (a) use the platform-recommended threshold for their provider class, or (b) commission their own supplementary expert determination.

### Finding 4: OpenZeppelin TimelockController pattern — an immutable floor with mutable ceiling — is the correct smart contract design

- OpenZeppelin `TimelockController` has a known vulnerability where proposers can reduce `minDelay` to 0, rendering the timelock useless. This led to a documented proposal for an **immutable minimum delay baseline set at construction** ([OZ GitHub Issue #2642](https://github.com/OpenZeppelin/openzeppelin-contracts/issues/2642)). A related exploit allowed the executor role to reset delay to 0 and escalate privileges immediately ([OZ Security Advisory GHSA-fg47-3c2x-m2wr](https://github.com/OpenZeppelin/openzeppelin-contracts/security/advisories/GHSA-fg47-3c2x-m2wr)).

- The analogous design for `ClaimsAdjudicator` is to store `minBatchThreshold` as a **hospital-configurable parameter with an immutable network floor enforced in contract code**:
  - `uint32 public constant NETWORK_BATCH_FLOOR = 11;` — immutable, hard-coded at deployment, not upgradeable.
  - `mapping(bytes32 providerHash => uint32 threshold) public batchThreshold` — settable by `HOSPITAL_ADMIN` role, but with `require(threshold >= NETWORK_BATCH_FLOOR)` enforced at setter time.
  - This gives hospitals the ability to increase their threshold (more conservative) but prevents any `HOSPITAL_ADMIN` key (compromised or misconfigured) from reducing the threshold below the network floor.

- This pattern mirrors the AccessControl `onlyGovernance` modifier pattern in OpenZeppelin Governor, where governance-controlled parameters can only be modified through a proposal, but a constructor-set floor cannot be lowered without a contract upgrade (which itself goes through a timelocked governance process). ([OpenZeppelin Governance](https://docs.openzeppelin.com/contracts/4.x/governance); [Access Control](https://docs.openzeppelin.com/contracts/5.x/access-control))

### Finding 5: The compliance gap from hospital-level override is real but manageable through contractual and technical controls

- If `HOSPITAL_ADMIN` role can set `batchThreshold[providerHash] = 1`, a compromised or misconfigured admin key defeats de-identification for that provider. This is a real compliance gap — but the regulatory liability lands on the hospital (CE), not cliqueue (BA). The contractual mechanism to address this is:
  1. **Technical floor**: immutable `NETWORK_BATCH_FLOOR` in contract code (cannot be reduced by anyone, including cliqueue governance).
  2. **BAA clause**: contractual requirement that the hospital will not set any threshold below its own expert determination's minimum without re-commissioning the determination.
  3. **Onboarding checklist**: cliqueue hospital onboarding requires a signed privacy officer attestation confirming that configured thresholds are consistent with the hospital's expert determination scope.

- The 2026 HIPAA Security Rule NPRM (January 2025) would add annual BA verification requirements — if finalized, this would require cliqueue to annually verify that hospital threshold configurations remain within the scope of the expert determination. ([2025 HIPAA Security Rule NPRM via Censinet](https://censinet.com/perspectives/2025-hipaa-updates-cloud-compliance-changes))

### Finding 6: CV-stratified threshold levels must be set at onboarding by the hospital privacy officer — not computed on-chain

- As established in the prior iteration's research ([batch-aggregation-homogeneous-provider-cv-l-diversity.md](batch-aggregation-homogeneous-provider-cv-l-diversity.md)), the billing CV for a given provider cannot be computed on-chain. This means the hospital's privacy officer (or cliqueue's onboarding team, under BAA) must classify each provider's billing CV at onboarding time and configure the appropriate threshold:
  - CV < 10%: set `batchThreshold ≥ 50` or suppress `totalBilledCents`.
  - CV 10–20%: set `batchThreshold ≥ 20`.
  - CV ≥ 20%: set `batchThreshold ≥ 11` (network floor).

- The onboarding checklist should require the hospital to provide historical billing CV data for each `providerHash` at registration. Cliqueue's onboarding agent (or the hospital's privacy officer) sets the threshold before the first contract interaction.

**Design implication:** `ClaimsAdjudicator` should implement a two-tier threshold architecture: an immutable `NETWORK_BATCH_FLOOR = 11` enforced in contract code (cannot be reduced by any key or governance action short of a contract upgrade), and a per-provider `batchThreshold` mapping settable by `HOSPITAL_ADMIN` with `require(threshold >= NETWORK_BATCH_FLOOR)`. The hospital onboarding checklist must include a privacy officer attestation on CV classification and threshold selection. The cliqueue BAA must include a clause binding the hospital to maintain thresholds consistent with its expert determination scope, with annual re-verification under the proposed 2026 HIPAA Security Rule.

**Open questions generated:**
1. Should the `TimelockController` minimum delay in `ClaimsAdjudicator` be stored as a mutable parameter (updatable only through the timelock itself) or hard-coded as an immutable constant to prevent a governance decision from shortening the notice period below the enterprise-safe 48-hour floor? (Same pattern as `NETWORK_BATCH_FLOOR` — these two decisions should be aligned.) — priority: high
2. Does the proposed 2026 HIPAA Security Rule NPRM's annual BA verification requirement, if finalized, require cliqueue to implement an automated threshold-audit mechanism that checks each hospital's `batchThreshold` mapping against its onboarding attestation on a regular schedule — and if so, should this be a Somnia event log check or an off-chain monitoring service? — priority: medium
3. Should the `NETWORK_BATCH_FLOOR` constant be embedded in contract bytecode (truly immutable) or stored as a governance-controlled `uint32` behind the `TimelockController` with a minimum value validation — and does making it governable create the same bootstrap paradox as the stablecoin governance timelock? — priority: medium

---

**See also** — [[../topics/hipaa|HIPAA hub]] · [[../topics/upgradeable-proxy|upgradeable-proxy hub]]
