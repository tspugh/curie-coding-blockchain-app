# SBTRegistry — Minimum Attestor Staffing Redundancy and On-Chain `minAttesters` Enforcement

## 2026-05-15 — What is the minimum number of active SBT holders per `hospitalId` cliqueue should require at onboarding, and should `ClaimsAdjudicator` enforce a `minAttesters` parameter on-chain?

### Operational risk: the single-coder failure mode

- Each unfilled coding role stalls hundreds of thousands of dollars in claims per month (codingbillingsolutions.com, 2026). A single-coder absence directly triggers DNFB (Discharged Not Final Billed) backlog, extended A/R days, and potential timely-filing failures against the 90-day CMS window. ([Solving the 2026 Medical Coding Staffing Crisis](https://codingbillingsolutions.com/blogs/solving-the-2026-medical-coding-staffing-crisis-how-outsourcing-keeps-revenue-flowing/))
- AAPC estimates a 12% nationwide shortage of certified medical coders in 2026; 31% of coding staff actively consider leaving. This is not a tail-risk scenario — planned absence, unplanned illness, and turnover all trigger it at normal operational frequency. ([31% of Coding Staff Consider Leaving](https://chirokhealth.com/blog/medical-coding-staffing-shortages-retention-strategies/))
- Small hospitals with a single in-house coder have no coverage during vacation or illness; outsourcing vendor partners explicitly market "team-based 100% coverage" as the solution. ([CodingNetwork — Vacation Coverage](https://codingnetwork.com/temporary-assistance/))
- The Joint Commission does not publish a minimum coder headcount per facility; its staffing standards address clinical roles and emergency operations, with HIM addressed tangentially through competency/documentation expectations for agency staff. No primary-source JCAHO floor on coder count exists.
- AHIMA's ICD-10 productivity benchmarks (2.02 inpatient cases/hour average; community hospitals ~2.75) allow back-calculation: a 200-bed community hospital generating ~60 inpatient discharges/day requires ~22 coder-hours/day, meaning a one-FTE minimum is insufficient for any realistic inpatient volume. ([AHIMA ICD-10 Coding Productivity Study](https://journal.ahima.org/Portals/0/archives/AHIMA%20files/ICD-10%20Coding%20Productivity%20Study%20Highlights%20Emerging%20Standards.pdf))

### The `minAttesters` design question

Two design options:

**Option A — On-chain hard floor in `ClaimsAdjudicator`**: A `mapping(bytes32 hospitalId => uint8 minAttesters)` (or a network-level constant `MIN_ATTESTERS_FLOOR = 2`) enforced in `submitClaim()`. If `SBTRegistry.activeAttestorCount(hospitalId) < minAttesters`, the transaction reverts.

**Option B — Off-chain policy enforced at onboarding**: The BAA and onboarding checklist require a minimum of N active SBT holders, but the contract does not check the live count at submission time.

### Smart-contract precedent for minimum-member enforcement

- Gnosis Safe (`OwnerManager.sol`) enforces `require(newThreshold <= ownerCount)` inside `removeOwner`, preventing the threshold from exceeding the live owner count. This is the canonical on-chain pattern for keeping a quorum achievable. ([removeOwner — Safe Docs](https://docs.safe.global/reference-smart-account/owners/removeOwner))
- OpenZeppelin `AccessControlEnumerable` exposes `getRoleMemberCount(role)` which can be called in an overridden `revokeRole()` to prevent the count falling below a minimum: `require(getRoleMemberCount(ATTESTOR_ROLE) > MIN_ATTESTERS, "would violate floor")`. ([OZ AccessControlEnumerable](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/extensions/AccessControlEnumerable.sol))
- The enforcement point matters: checking at `revokeRole` time prevents inadvertent under-staffing proactively; checking at `submitClaim` time detects it reactively but doesn't prevent the state.

### Recommended design: 2-of-N floor with on-chain enforcement at revoke

1. **Floor = 2 active SBT holders per `hospitalId`**. This is the minimum that eliminates the single-point-of-failure absent any regulatory mandate: one primary coder + one backup (relief/locum). Supported by AAPC/AHIMA staffing shortage data showing planned and unplanned absences are normal operational events, not tail risks.
2. **Enforce at `SBTRegistry.revokeRole()` time** (proactive, not reactive). Override `_revokeRole` to `require(activeAttestorCount(hospitalId) - 1 >= MIN_ATTESTERS_FLOOR)`. This mirrors the Safe pattern and prevents the hospital from inadvertently reducing below floor.
3. **`ClaimsAdjudicator.submitClaim()` does NOT separately re-check the count**. The live-count check at submission is a redundant hot-path read that adds gas (cold-SLOAD risk if attestor-count is stored in a separate mapping slot) without adding protection if revoke already enforces the floor. The SBT `expiry >= block.timestamp` check (already enforced) is the right submission-gate; the count floor belongs at the registry layer.
4. **`MIN_ATTESTERS_FLOOR = 2` as a network-level constant in `SBTRegistry`** (not per-hospital configurable). Per-hospital override would allow a hospital to set it to 1, defeating the protection. Making it a `TimelockController`-governed `uint8` is acceptable if a 48-hour delay applies, but making it a bytecode constant (`uint8 public constant MIN_ATTESTERS_FLOOR = 2`) is simpler, auditable by block explorer, and does not create a governance bootstrap paradox.
5. **Onboarding checklist must require 2 active SBT mints before any claim can be submitted** — a `minAttesters` pre-flight check in the deployment runbook, not only in contract logic.

### Locum tenens coders and cross-hospital SBTs

- CMS guidelines require NPI/UPIN documentation for each locum tenens service; AHIMA/AAPC do not publish additional credentialing requirements specific to relief coders beyond the standard active certification requirement.
- A locum tenens coder holding SBTs across multiple `hospitalId`s satisfies the 2-per-hospital floor for each hospital independently. The cross-hospital fraud-vector question (a single compromised key spanning many hospitals) is a separate concern handled by the multi-SBT maximum per address question (open in the backlog).

**Design implication:** `SBTRegistry` should override `_revokeRole` with a `require(activeAttestorCount(hospitalId) >= MIN_ATTESTERS_FLOOR + 1)` guard (i.e., the count after removal must remain ≥ 2), where `MIN_ATTESTERS_FLOOR = 2` is a bytecode constant. `ClaimsAdjudicator.submitClaim()` does not need a separate count check. The onboarding checklist requires 2 SBT mints per hospital before first claim submission.

**Open questions generated:**
1. Should `activeAttestorCount(hospitalId)` be maintained as an explicit `mapping(bytes32 => uint32) private _attestorCount` incremented/decremented in `grantRole`/`revokeRole` (O(1) gas), or derived on-demand via `getRoleMemberCount` on a per-hospital role (requires per-hospital role bytes32 derivation)? The former is cheaper at claim-submission audit time.
2. When a locum tenens coder is added to bring a hospital from 1 to 2 active SBTs (during a transition), should the `CredentialExpiryWarning` event be emitted immediately on SBT mint to alert the off-chain monitor that this hospital is at the minimum floor?
3. Should the network-level `MIN_ATTESTERS_FLOOR` be 2 (bare minimum) or 3 (allows one absence while remaining above 1), given the documented 12% annual coder shortage rate — and does raising it to 3 make cliqueue undeployable at small/critical-access hospitals?

---

**See also** — [[../topics/sbt|SBT hub]]
