# `attestationRequired` Mapping Initialization — UB-04 TOB Taxonomy and Somnia Gas Analysis

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should `attestationRequired` governance mapping be initialized at deployment with all known UB-04 TOB second-digit categories, or lazily default to `false` for unmapped values?

### Finding 1: The UB-04 TOB second-digit taxonomy has 8 active facility type values — 6 are relevant to AI-coded 837I institutional claims

- The UB-04 Type of Bill (TOB) second digit specifies the **facility type**. There are codes 1–9; code 5 (Religious Nonmedical Extended Care) was **discontinued effective 10/1/05** and should be excluded from cliqueue's `claimType` enum.
  — [Noridian Medicare: Bill Types](https://med.noridianmedicare.com/web/jea/topics/claim-submission/bill-types); [Find-A-Code: Type of Bill Table](https://www.findacode.com/articles/type-of-bill-table-34325.html)
  — Assessment: High confidence. Noridian is an official CMS Medicare Administrative Contractor.

- Active second-digit values relevant to AI-coded 837I institutional claims submitted to `ClaimsAdjudicator`:

  | Second Digit | Facility Type | Relevance to cliqueue |
  |---|---|---|
  | 1 | Hospital (inpatient and outpatient) | **Primary** — acute inpatient (11X) and outpatient hospital (13X) |
  | 2 | Skilled Nursing Facility (SNF) | **Primary** — SNF Part A inpatient (21X) and SNF outpatient (22X) |
  | 3 | Home Health Agency | **Medium** — HHA PPS (32X, 33X); AI coding applicable |
  | 4 | Religious Nonmedical Hospital | **Niche** — small volume; same attestation rules as digit 1 |
  | 5 | Religious Nonmedical Extended Care | **DEAD — discontinued 10/1/05** |
  | 6 | Intermediate Care Facility (ICF) | **Edge** — ICF/IID (64X, 65X); limited AI coding deployment |
  | 7 | Clinic or Hospital ESRD Facility | **Medium** — outpatient dialysis (72X); AI coding applicable |
  | 8 | Special Facility (CAH, ASC, Hospice) | **Primary** — includes hospice (81X, 82X), CAH (85X), ASC (83X) |
  | 9 | Reserved for National Assignment | **Future** — currently unused; no 837I claims today |

  — [Noridian Medicare: Bill Types](https://med.noridianmedicare.com/web/jea/topics/claim-submission/bill-types); [Medical Billing RCM: TOB Codes 2026](https://medicalbillingrcm.com/ub04-type-of-bill-codes-list-tob/)
  — Assessment: High confidence for taxonomy; moderate confidence for "relevance to AI coding" assessment (this analyst's inference from cliqueue use-case scope).

- For an MVP `claimType` `uint8` enum with 8 values (0=OUTPATIENT_HOSPITAL, 1=INPATIENT_HOSPITAL, 2=SNF_INPATIENT, 3=SNF_OUTPATIENT, 4=HOME_HEALTH, 5=HOSPICE, 6=CAH, 7=CLINIC_ESRD), all enum values fit in 3 bits — no packing issues. Code digit 4 (Religious Nonmedical) can map to the same attestation rule as code digit 1 (Hospital). Code digit 5 should never be assigned a `claimType` value; rejecting it at submission time is a defensive measure.
  — Analytical synthesis from NUBC/TOB taxonomy above.
  — Assessment: High confidence.

### Finding 2: Somnia cold SLOAD does NOT charge the 1M-gas surcharge for uninitialized (never-written) storage slots — only for stale-written slots not in the hot cache

- **Critical finding for the initialization decision**: Somnia's IceDB documentation explicitly states: "If the key does not exist, the access requires at least 1,000,000 gas remaining, **but that gas is not charged**, so there is no extra cost."
  — [Somnia Docs: Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)
  — Assessment: High confidence. Primary source from Somnia documentation.

- The 1M-gas cold-SLOAD surcharge applies to slots that **were written in a prior block** but are **not in the 128M-slot hot cache**. A mapping slot that was **never written at all** is not charged — the EVM returns zero without touching the SSD.
  — [Somnia IceDB Docs](https://docs.somnia.network/concepts/somnia-blockchain/somnias-icedb)
  — Assessment: High confidence. This is a key architectural distinction.

- **Implication**: The argument "initialize eagerly to avoid cold-SLOAD surcharge on first read" is **invalid for Somnia**. An uninitialized `mapping(uint8 => bool)` slot accessed for the first time returns zero without paying 1M gas. The surcharge only applies after a slot has been written (at deployment initialization) and then read in a later block from cold cache. Paradoxically, **eager initialization creates the cold-SLOAD penalty for deployed slots that are rarely used** (e.g., digit 4 Religious Nonmedical Hospital), whereas lazy uninitialized slots are free to read.
  — Analytical inference from Somnia gas documentation.
  — Assessment: High confidence.

### Finding 3: The EIP-2929 cold SLOAD applies equally to zero and non-zero initialized slots — but Somnia's 1M surcharge only applies to non-zero (written) slots

- Under standard EVM/EIP-2929 semantics (and on Somnia for standard cold access), an SLOAD on any storage slot first accessed in a transaction costs 2,100 gas (cold), regardless of its value. This applies equally to uninitialized (zero-value, never-written) and initialized slots.
  — [EIP-2929: Gas cost increases for state access opcodes](https://eips.ethereum.org/EIPS/eip-2929); [HackMD: Gas costs after Berlin](https://hackmd.io/@fvictorio/gas-costs-after-berlin)
  — Assessment: High confidence. EIP-2929 spec is authoritative.

- Somnia adds its own surcharge **on top of** the standard cold access model, but only for slots that exist in storage (were written). For slots that don't exist, neither the 2,100-gas cold read nor the 1M-gas surcharge is charged — the zero default is returned at negligible cost.
  — Assessment: High confidence based on Somnia documentation finding above.

### Finding 4: The IPO list phase-out (2026–2029) shifts procedures to existing TOB 13X codes — no new claim types required

- The CY 2026 OPPS Final Rule begins phasing out the Inpatient-Only (IPO) list: 285 musculoskeletal procedures removed January 1, 2026, with full phase-out by January 1, 2029. Removed procedures receive new **status indicator assignments** — they are billed on existing outpatient TOB 13X codes, not new TOB categories.
  — [ACDIS: CMS 2026 OPPS IPO Phase-Out](https://acdis.org/articles/news-cms-releases-2026-opps-final-rule-begins-inpatient-only-list-phase-out); [Human Medical Billing: IPO List Ends](https://humanmedicalbilling.com/blog/medicare-inpatient-only-list-ends-2026-cms-rule-and-impact/)
  — Assessment: High confidence that no new TOB codes are introduced; moderate confidence on "always TOB 13X" (full rule text not reviewed).

- **Implication for cliqueue**: The IPO phase-out does NOT require new `claimType` enum values. Previously-inpatient procedures now billed as outpatient will use the existing `OUTPATIENT_HOSPITAL` claim type (TOB 13X). The `attestationRequired` mapping does not need new entries for IPO-removed procedures.
  — Assessment: High confidence.

### Finding 5: Uninitialized mapping default-`false` is a documented smart contract security risk for access control — eager initialization is the security-correct pattern

- In Solidity, `mapping(uint8 => bool)` defaults uninitialized keys to `false`. For an **access control / attestation requirement** mapping, `false` means "no attestation required." A novel TOB code (e.g., a future CMS-assigned code under digit 9 "Reserved for National Assignment") submitted to `ClaimsAdjudicator` before the governance team adds it would silently bypass attestation requirements.
  — [RareSkills: Smart Contract Security](https://rareskills.io/post/smart-contract-security); [Solidity Security Considerations](https://docs.soliditylang.org/en/latest/security-considerations.html)
  — Assessment: High confidence for the general pattern; analytical inference for the cliqueue-specific attack scenario.

- The Parity wallet uninitialized-initWallet exploit (2017) and the OWASP Smart Contract Top 10 (2025 update) both identify uninitialized access-control state as a critical attack vector: "Uninitialized ERC1967 proxies became an automated attack campaign in 2025." For `ClaimsAdjudicator`, an uninitialized `claimType` slot means a hospital could deploy against a future or reserved code and avoid attestation requirements entirely.
  — [OWASP Smart Contract Top 10](https://www.zealynx.io/glossary/owasp-smart-contract-top-10); [RareSkills: Smart Contract Security](https://rareskills.io/post/smart-contract-security)
  — Assessment: High confidence for general risk; moderate confidence for direct applicability to cliqueue's specific pattern.

- **Defense**: The contract should revert on any `claimType` value not in the known initialized set, rather than defaulting to permissive (`false`). This transforms the uninitialized-slot risk from a silent bypass to an explicit revert — forcing governance to explicitly add new claim types before they can be used.
  — Analytical inference from security findings above.
  — Assessment: High confidence.

### Finding 6: Recommended architecture — explicit initialization at deployment with an explicit `unknownClaimTypeRevert` guard

Based on the above findings, the recommended architecture is:

1. **Initialize all known active TOB second-digit categories at deployment** using the constructor/initializer: `attestationRequired[OUTPATIENT_HOSPITAL] = false`, `attestationRequired[SNF_INPATIENT] = false`, `attestationRequired[SNF_OUTPATIENT] = false`, etc. This explicitly records the governance team's intent for each claim type, is verifiable on-chain at deployment, and eliminates the silent-bypass risk.

2. **Revert on unknown `claimType`**: Add a `validClaimType` modifier that reverts if `claimType >= CLAIM_TYPE_COUNT` (where `CLAIM_TYPE_COUNT` is an immutable set at deployment). This prevents silent false-default reads for future/reserved claim types before governance explicitly adds them.

3. **Accept the Somnia gas trade-off**: Eagerly initializing creates warm storage slots that incur the 1M-gas cold-SLOAD surcharge on first access per block for rarely-used claim types (e.g., Religious Nonmedical Hospital). This is a deliberate security-for-gas trade-off: the cold-SLOAD cost (~$0.005 per cold read at current SOMI pricing) is acceptable compared to the FCA liability of silent attestation bypass.

4. **Use a `ClaimTypeAdded` event** when governance adds new claim types via `TimelockController`, creating an on-chain audit log of when new claim type support was activated.

**Design implication:** `ClaimsAdjudicator` should explicitly initialize all 7–8 active TOB second-digit `claimType` values at deployment (defaulting all to `false` except where future governance mandates `true`), and should revert on any unregistered `claimType` value to prevent silent attestation bypass via uninitialized mapping slots. The Somnia cold-SLOAD surcharge does NOT apply to uninitialized slots (only to stale-written ones), but eager initialization is still correct for security reasons.

**Open questions generated:**
1. Should the `validClaimType` modifier check `claimType < CLAIM_TYPE_COUNT` (an immutable uint8) or maintain a separate `mapping(uint8 => bool) registeredClaimTypes` — and does the second approach have the same silent-bypass risk as the `attestationRequired` mapping itself?
2. When CMS assigns new TOB second-digit codes under the current "digit 9 reserved" placeholder, does cliqueue's `TimelockController` governance path (minimum 48-hour delay) create a gap window where the new claim type cannot be submitted until governance activates it — and should the deployment runbook pre-register digit 9 as a `ClaimTypeAdded` placeholder with `attestationRequired = true` (conservative safe default)?
3. Should the `attestationRequired` mapping initialization values (all `false` at deployment except where governance mandates) be published in a cliqueue "Claim Type Policy" document that hospital procurement teams can review alongside the Settlement Token Policy?

---

**See also** — [[../topics/x12|X12 hub]] · [[../topics/upgradeable-proxy|upgradeable-proxy hub]] · [[../topics/sbt|SBT hub]]
