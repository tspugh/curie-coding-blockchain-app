# SBT Credential Expiry — On-Chain Enforcement vs. Revocation-Only

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-15 — Stale SBT liability and whether on-chain `credentialExpiry < block.timestamp` must be enforced at claim submission

**Question:** What is the liability exposure if a hospital's SBTRegistry contains a stale entry (coder left, SBT not revoked) and a fraudulent attestation is anchored — should an on-chain `credentialExpiry < block.timestamp` check be enforced at claim submission rather than relying solely on revocation?

### Finding 1: FCA liability for stale-credential attestations is real and hospital-borne

- Submitting Medicare/Medicaid claims attested by a provider or coder with lapsed credentials "can be considered fraudulent, even if the lapse was unintentional." FCA penalties reach three times the program's loss plus ~$13,400–$27,000 per claim (2026 adjusted range). Repeated violations risk exclusion from Medicare/Medicaid.
  — [G2Z Law: Managing Billing Mistakes Due to Lapsed Credentials](https://www.g2zlaw.com/publications/billing-mistakes-self-disclosure)
- The hospital (as the billing entity) bears primary FCA liability, not the individual coder. The DOJ's FY 2025 record $6.8B in FCA settlements ($5.7B from healthcare) confirms aggressive enforcement posture.
  — [Medical Economics: False Claims Act recoveries hit a record $6.8 billion in 2025](https://www.medicaleconomics.com/view/false-claims-act-recoveries-hit-a-record-6-8-billion-in-2025)
- No published FCA settlement was found specifically tied to stale-credential coding attestation (as distinct from unlicensed clinical services). However, the legal analysis consistently places non-credentialed billing in the same FCA risk category as upcoding. The absence of a case citation is not exculpatory — lapsed-credential scenarios are structurally identical to uncredentialed-provider billing.

### Finding 2: JCAHO 2025 mandates monthly credential re-verification — not just onboarding-time check

- Effective 2025, The Joint Commission requires hospitals to monitor all credentialed personnel **monthly** — covering license status, OIG exclusion list, SAM.gov screening, and board certification status. This replaces the prior "initial hire + every 2–3 years" standard.
  — [Ethico: Primary Source Verification — Why Automated PSV Is No Longer Optional in 2025](https://www.ethico.com/insights/primary-source-verification-in-healthcare-credentialing-why-automated-psv-is-no-longer-optional-in-2025)
- Monthly verification means that relying solely on on-chain revocation by the hospital admin (a reactive control) is insufficient against the regulatory standard. A compliant hospital must proactively check credential status every ≤30 days.
- **Design implication:** If hospitals are required to verify monthly, cliqueue can treat the SBT as a 30-day renewable proof: the `credentialExpiry` stored on-chain should default to `block.timestamp + 30 days` at mint/renewal, with the hospital ADMIN role responsible for calling `renewExpiry(tokenId)` after each monthly PSV pass. This converts a passive revocation model into an active renewal model.

### Finding 3: AHIMA credential cycle is 2 years; there is a 12-month lapse window before permanent revocation

- AHIMA CCS/RHIA credentials renew on a 2-year cycle (10 CEUs + 2 mandatory self-reviews for CCS). Failure to complete puts the coder in "Inactive" status (6 months), then "Temporarily Revoked" (6 months), then "Permanently Revoked."
  — [AHIMA: Recertification](https://www.ahima.org/certification-careers/recertify/)
- During "Inactive" status the coder "may not use" the credential, but their name may still appear in AHIMA's publicly-accessible credential list with a lapsed status indicator. The 12-month grace window creates a stale-entry risk window that is **longer than the JCAHO 30-day monitoring cycle** — meaning a hospital that neglects monthly monitoring could have a lapsed-credential SBT active for up to 12 months.
- No AHIMA public API for programmatic credential status lookup was confirmed in available documentation. AHIMA's credential verification portal (my.ahima.org/credential-verification) appears to be a manual lookup tool, not an API endpoint. Automated PSV would require third-party credentialing verification services (e.g., Symplr, Modio, Verisys) that aggregate AHIMA data.
  — [AHIMA Credential Verification Portal](https://my.ahima.org/credential-verification)

### Finding 4: ERC-5727 defines a standard `IERC5727Expirable` extension; ERC-5484 does not natively include expiry

- The core **ERC-5484** standard (Consensual Soulbound Tokens) does not define expiry semantics. It defines burn authorization (`BurnAuth`) and non-transferability only.
  — [EIP-5484](https://eips.ethereum.org/EIPS/eip-5484)
- **ERC-5727** (Semi-Fungible Soulbound Token) includes an optional `IERC5727Expirable` extension with a `setExpiryDate(uint256 tokenId, uint256 date, bool isRenewable)` function and an `expiryDate(uint256 tokenId)` view. The `date` parameter is a Unix timestamp (uint256), directly comparable to `block.timestamp` at claim submission.
  — [EIP-5727](https://eips.ethereum.org/EIPS/eip-5727)
- cliqueue's `SBTRegistry` can extend ERC-5484 with a custom `expiry` field (uint64 is sufficient for Unix timestamps through year 584 billion) added to the token struct, without adopting full ERC-5727 complexity. This is the minimal-extension path: store `expiry` at mint time, expose `isExpired(tokenId) returns (bool)` as a view, and enforce `require(!SBTRegistry.isExpired(attestorSBT), "SBT expired")` in `ClaimsAdjudicator._validateAttestor()`.

### Finding 5: On-chain `block.timestamp` expiry check gas cost is negligible

- An on-chain expiry check (one SLOAD for the `expiry` field + comparison to `block.timestamp`) costs approximately **2,100–5,000 gas** on a warm slot or **21,000 gas** on a cold SLOAD (Somnia cold-SLOAD surcharge: ~1M gas per the prior research, but only applicable for the *first* access in a transaction where the slot has not been accessed).
  — [docs/research/somnia/finality-tps-and-gas-model.md](finality-tps-and-gas-model.md) (prior research)
- At Somnia's ~$0.000055/gas equivalent (from prior research), a warm expiry check adds ~$0.00011–$0.00028 per claim. Even at cold-SLOAD rates (~$0.055), it remains far below the $4–10 per-claim outsourced coding benchmark.
- To keep the expiry slot warm: if `attestorSBT` is already read for the `hospitalId` check (which the `ClaimsAdjudicator` must do per prior research), the `expiry` field can be packed in the same storage slot as `hospitalId` + `credentialType` using a tight struct, eliminating the cold-SLOAD overhead.

### Finding 6: Recommended on-chain struct and enforcement pattern

The `SBTRegistry` token struct should be:

```solidity
struct AttestorToken {
    bytes32 hospitalId;      // 32 bytes — slot 0
    uint64  expiry;          // 8 bytes  — slot 1 (packed)
    uint8   credentialType;  // 1 byte   — slot 1 (packed)
    bool    revoked;         // 1 byte   — slot 1 (packed)
    // 22 bytes remaining in slot 1 — available for future fields
}
```

Enforcement at claim submission in `ClaimsAdjudicator`:

```solidity
function _validateAttestor(address attestor, bytes32 hospitalId) internal view {
    uint256 tokenId = SBTRegistry.attestorToken(attestor, hospitalId);
    AttestorToken memory t = SBTRegistry.tokenData(tokenId);
    require(!t.revoked, "SBT revoked");
    require(t.expiry >= block.timestamp, "SBT expired");
    require(t.hospitalId == hospitalId, "hospitalId mismatch");
}
```

The `expiry` field is set at mint to `block.timestamp + 30 days` (for monthly-PSV-aligned renewal) and updated by `HOSPITAL_ADMIN` role via `renewExpiry(tokenId, newExpiry)` after each PSV pass.

**Design implication:** On-chain `credentialExpiry < block.timestamp` enforcement at claim submission is required, not optional. Revocation-only design creates a 30-day–12-month liability window (gap between JCAHO monthly monitoring mandate and AHIMA's 12-month lapse window). A 30-day expiry cycle forces hospitals to run their JCAHO-required monthly PSV and then renew the SBT, making compliance enforcement self-reinforcing. The `expiry` field should be packed with `hospitalId` and `revoked` in the same struct to avoid cold-SLOAD costs. Gas overhead is ~$0.00011–0.00028/claim under normal conditions.

**Open questions generated:**
1. Does AHIMA's credential verification portal (my.ahima.org/credential-verification) support automated/API access, or does programmatic PSV require a commercial third-party aggregator (Verisys, Symplr, Modio) — and if so, what are their pricing and BAA terms for integration with cliqueue's hospital onboarding flow? — priority: medium
2. Should the `renewExpiry(tokenId, newExpiry)` function enforce a maximum `newExpiry` ceiling (e.g., `block.timestamp + 31 days`) to prevent a compromised `HOSPITAL_ADMIN` key from minting a de-facto permanent credential by setting `expiry = type(uint64).max`? — priority: high
3. Does the proposed 2026 HIPAA Security Rule NPRM's annual business associate verification requirement apply to credentialing aggregator services (Verisys, Symplr) that query AHIMA/AAPC on cliqueue's behalf — and would that require a BA chain: hospital → cliqueue → aggregator → AHIMA? — priority: medium

---

## 2026-05-15 — Should `renewExpiry()` enforce a maximum `newExpiry` ceiling to prevent compromised-admin permanent credential minting?

**Question:** Should the `renewExpiry(tokenId, newExpiry)` function in the SBTRegistry enforce a maximum `newExpiry` ceiling (e.g., `block.timestamp + 31 days`) to prevent a compromised `HOSPITAL_ADMIN` key from minting a de-facto permanent credential by setting `expiry = type(uint64).max`?

### Finding 1: Unlimited admin minting via parameter manipulation is a documented smart contract attack class

- Private key compromise accounts for **43.8% of crypto hacks in 2024** by value, making it the single largest attack vector. Trail of Bits (2025) explicitly identifies "unlimited admin minting" as a priority threat class where administrator privileges are left uncapped.
  — [Trail of Bits: Maturing your smart contracts beyond private key risk (June 2025)](https://blog.trailofbits.com/2025/06/25/maturing-your-smart-contracts-beyond-private-key-risk/); [Gate.com: Biggest smart contract vulnerabilities 2024](https://web3.gate.com/crypto-wiki/article/what-are-the-biggest-smart-contract-vulnerabilities-and-cryptocurrency-exchange-hacking-risks-in-2024-20260123)
- Setting `expiry = type(uint64).max` (Unix timestamp ~584 billion = year ~585 billion) via a compromised `HOSPITAL_ADMIN` key would produce a credential that never expires on any practical timescale, silently defeating the monthly-PSV enforcement cycle with no visible anomaly until an audit.
- OWASP Smart Contract Top 10 2025 lists "Improper Access Control" (SC01) as the top smart contract vulnerability category; unconstrained parameter ranges within privileged functions are a canonical example.
  — [OWASP SC01:2025 - Improper Access Control](https://owasp.org/www-project-smart-contract-top-10/2025/en/src/SC01-access-control.html)

### Finding 2: JCAHO 2025 now mandates 30-day credential monitoring — a ceiling of `block.timestamp + 31 days` is regulation-aligned, not arbitrary

- Effective July 1, 2025, The Joint Commission requires monthly monitoring of every credentialed provider's license status, OIG exclusion, SAM.gov screening, and board certification. As of January 2026, automated traceable re-verification is explicitly required.
  — [Ethico: JCAHO 2025 Monthly Credential Monitoring Requirements](https://ethico.com/regulatory-updates/jcaho-2025-monthly-credential-monitoring-requirements-complete-compliance-checklist/); [Newswire: Hospitals Face Credentialing Technology Overhaul 2026](https://www.newswire.com/news/hospitals-face-credentialing-technology-overhaul-as-2026-compliance-22568675)
- A ceiling of `MAX_EXPIRY_WINDOW = 31 days` is therefore **not an arbitrary security cap** — it is the on-chain expression of a legally mandated re-verification interval. Any `newExpiry` beyond `block.timestamp + 31 days` would encode a credential that cannot have been freshly PSV-verified within the JCAHO cycle.
- Black Book Research (June 2025) reports that most hospital credentialing systems are non-compliant with the 2026 automated auditing mandate, indicating the ceiling would drive real adoption behavior rather than being an academic constraint.
  — [PharmiWeb.com: Hospitals Face Credentialing Technology Overhaul 2026](https://www.pharmiweb.com/press-release/2025-06-05/hospitals-face-credentialing-technology-overhaul-as-2026-compliance-deadlines-near-black-book-resea)

### Finding 3: ERC-5727 `setExpiration` specifies validation that `expiration` is not in the past, but defines no maximum future ceiling — the ceiling is a cliqueue design decision

- The `IERC5727Expirable` interface requires: "MUST revert if the `tokenId` does not exist; MUST revert if the `expiration` date is in the past." No upper bound is specified by the ERC standard; implementors are free to add one.
  — [EIP-5727: Semi-Fungible Soulbound Token](https://eips.ethereum.org/EIPS/eip-5727)
- OpenZeppelin's `ERC20Capped` pattern (which enforces a hard supply ceiling at mint time via `require(totalSupply() + amount <= cap, "cap exceeded")`) is the canonical Solidity pattern for enforcing parameter ceilings on privileged functions. The same pattern applies to `renewExpiry`.
  — [OpenZeppelin ERC20Capped.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/extensions/ERC20Capped.sol)
- The ceiling should be implemented as an **immutable constant** in the SBTRegistry contract bytecode — not a mutable governance parameter — so that it cannot itself be elevated by a compromised key. Contrast with `NETWORK_BATCH_FLOOR` (which was recommended as governance-controlled): the `MAX_EXPIRY_WINDOW` has no legitimate use case for being lengthened beyond 31 days given the JCAHO mandate.

### Finding 4: The ceiling should be paired with on-chain event monitoring to detect ceiling-adjacent renewals

- Setting `newExpiry = block.timestamp + 30 days + 23 hours` would pass the ceiling check while still extending the credential to the maximum possible term — an indicator of abuse if issued at a time that does not align with a documented PSV cycle. An on-chain `SBTRenewed(tokenId, attestor, hospitalId, newExpiry)` event (emitted by `renewExpiry`) allows off-chain monitoring to flag renewals where `newExpiry >= block.timestamp + 28 days` without a corresponding off-chain PSV log entry.
- Trail of Bits recommends that "protocol-critical admin functions emit an event every time they are called, with the full set of parameters," enabling anomaly detection even in the absence of multisig enforcement.
  — [Trail of Bits: Maturing smart contracts beyond private key risk (June 2025)](https://blog.trailofbits.com/2025/06/25/maturing-your-smart-contracts-beyond-private-key-risk/)

### Finding 5: Defense-in-depth — the ceiling alone is insufficient; multisig and time delays strengthen the protection

- Multisig on `HOSPITAL_ADMIN` (recommended 2-of-3 at minimum per prior research) means a compromised single key cannot call `renewExpiry` unilaterally. The ceiling adds a second layer: even a successfully compromised multisig quorum cannot grant an indefinite credential.
- A `TimelockController` delay on `renewExpiry` is **not appropriate** for this function — credential renewals are time-sensitive (a PSV pass happens today; the coder needs to attest tomorrow). The ceiling constraint is the correct defense here, not a timelock.
- The recommended pattern: `HOSPITAL_ADMIN` calls `renewExpiry` after each monthly PSV pass, the contract enforces `require(newExpiry <= block.timestamp + MAX_EXPIRY_WINDOW, "ceiling exceeded")`, and the `SBTRenewed` event is emitted for off-chain monitoring. The 3-of-5 multisig on the network-level `REGISTRY_ADMIN` role (from prior SBT research) governs changes to the SBTRegistry itself, but cannot bypass the ceiling constant.

### Recommended implementation

```solidity
uint64 public constant MAX_EXPIRY_WINDOW = 31 days; // immutable, JCAHO-aligned

function renewExpiry(uint256 tokenId, uint64 newExpiry)
    external
    onlyRole(HOSPITAL_ADMIN)
{
    AttestorToken storage t = _tokens[tokenId];
    require(!t.revoked, "SBT revoked");
    require(newExpiry > block.timestamp, "expiry must be future");
    require(
        newExpiry <= block.timestamp + MAX_EXPIRY_WINDOW,
        "expiry exceeds ceiling"
    );
    t.expiry = newExpiry;
    emit SBTRenewed(tokenId, ownerOf(tokenId), t.hospitalId, newExpiry);
}
```

Gas cost of the ceiling check: one `ADD` + one `GT` comparison — negligible (~3 gas). The `SBTRenewed` event adds ~375–500 gas (3 indexed topics + data). Total overhead per renewal: ~$0.000022 at current Somnia gas pricing.

---

**Design implication:** `renewExpiry()` must enforce `newExpiry <= block.timestamp + 31 days` as an immutable constant in contract bytecode. This is not an arbitrary security cap — it directly encodes the JCAHO-mandated 30-day PSV cycle. A compromised `HOSPITAL_ADMIN` key can at most extend a credential 31 days into the future (not indefinitely), bounding the blast radius of a key compromise to one monthly window. The ceiling should be paired with a `SBTRenewed` event and off-chain monitoring for renewals that approach the maximum window without a corresponding PSV log entry.

**Open questions generated:**
1. Should the `ClaimsAdjudicator` enforce a maximum concurrent active-SBT count per attestor address (e.g., max 3 active `hospitalId` SBTs per wallet) to prevent a single compromised attestor key from becoming a cross-hospital fraud vector at scale — and what is the gas cost of maintaining a per-attestor active-count mapping? — priority: medium
2. Should the off-chain monitoring system for `SBTRenewed` events be implemented as a Somnia event subscription (WebSocket `eth_subscribe`) or as an Ormi subgraph alert — and does either approach satisfy the "automated traceable audit" requirement in the January 2026 Joint Commission credentialing standard? — priority: medium
3. If a hospital's JCAHO audit reveals that PSV was not completed in a given month (e.g., staff shortage), should the SBT remain expired (blocking all inpatient attestations from that hospital) or should the `ClaimsAdjudicator` allow a 72-hour grace window past `expiry` to prevent catastrophic claim submission failure? — priority: high

---

**See also** — [[../topics/sbt|SBT hub]]
