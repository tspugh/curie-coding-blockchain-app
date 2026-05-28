## 2026-05-15 — What on-chain credential representation is appropriate for a HumanAttestor in inpatient claims?

**Question:** What on-chain credential representation is appropriate for a HumanAttestor in inpatient claims — a hash of (credentialNumber + attestorAddress + claimId), a delegated NFT, or a hospital-issued verifiable credential?

---

### Regulatory driver (confirmed)

- Humana, Cigna, and the majority of Medicare Advantage payer contracts now require **credentialed-coder attestation of all AI-generated inpatient claims** before submission as of Q2 2025 — this is contractual, not merely recommended. ([codingnetwork.com](https://codingnetwork.com/why-human-oversight-in-ai-medical-coding-remains-essential-in-2025/))
- The DOJ's $23M False Claims Act settlement (2025) established that providers retain FCA liability for AI-generated codes regardless of whether a human reviewed them — "human-in-the-loop must be more than a formality." ([omm.com](https://www.omm.com/insights/alerts-publications/false-claims-act-enforcement-risks-for-companies-using-ai/))
- CMS's February 2026 OIG Compliance Guidance explicitly identifies AI-coded MA claims without meaningful human review as a priority enforcement target. ([tuckerellis.com](https://www.tuckerellis.com/alerts/avoiding-false-claims-act-landmines-in-ai-assisted-coding-and-medical-billing/))
- CMS RADV audits require certified coders with proof of credentials; AI supports but all final determinations require human-certified coder sign-off. ([chartrequest.com](https://www.chartrequest.com/articles/radv-audits-2025))

---

### Option A — Simple HMAC/hash commitment: `keccak256(credentialNumber, attestorAddress, claimId)`

- **Mechanism:** Store a single `bytes32` in the Claim struct (or emit as an event topic). The hospital's off-chain system provides (credentialNumber, attestorAddress) to verify; the on-chain value proves attestation happened at claim time.
- **Gas cost:** ~2,000–5,000 gas (one SSTORE warm slot). At Somnia pricing (~$0.00055/M gas), this is negligible — under $0.000003 per attestation.
- **HIPAA status:** SAFE — credentialNumber is not PHI (it's a public professional license number published by AHIMA/AAPC). The `bytes32` cannot be reversed to PHI. No BAA concerns with the chain.
- **Revocation:** Cannot revoke a past claim attestation by design — attestation is evidence of what happened, not a live credential. Credential validity at time of attestation is what matters. Hospital must verify credential status off-chain before signing.
- **Weakness:** Does not allow third-party verification that the credentialNumber belongs to a real, active credential holder at attestation time — verification is delegated to the hospital's off-chain process. An auditor must contact AHIMA/AAPC or the hospital's records to verify.
- **Standard alignment:** Not aligned with any public standard; is a custom protocol.

---

### Option B — Soulbound Token (SBT) / Non-Transferable NFT (ERC-5484 or ERC-5192)

- **Mechanism:** The hospital (or a credential registry) mints a non-transferable ERC-5484/ERC-5192 token to the attestor's wallet at onboarding. The Claim struct stores the attestor's address; the SBT contract is queried to verify credential status.
- **Academic precedent:** PMC/Nature 2024 study ([PMC11624496](https://pmc.ncbi.nlm.nih.gov/articles/PMC11624496/)) implemented SBTs for healthcare authentication on a private Hyperledger Besu chain. Per-patient SBT minting cost ~$28.78 on Ethereum mainnet gas prices (deployment ~$98, per-patient enrollment ~$7.80, SBT mint ~$20.98). On Somnia at ~$0.00055/M gas these costs are ~200× cheaper: per-attestor SBT mint estimated **~$0.10–0.15 on Somnia** (based on ~200k–300k gas for ERC-721 mint).
- **ACM DLT 2024 case study** ([dl.acm.org/doi/10.1145/3674155](https://dl.acm.org/doi/10.1145/3674155)) confirmed SBT use in healthcare credentialing but is limited to vaccination certificates, not professional licenses.
- **EIP-5484 revocation:** Supports four burn-authorization modes (IssuerOnly, OwnerOnly, Both, Neither). Hospital can revoke if a coder's credential lapses or employment ends — revocation cost ~50k–100k gas on Ethereum; negligible on Somnia.
- **HIPAA status:** SAFE — the SBT encodes credential type (e.g., `CCS`, `RHIA`) and an expiry timestamp but NO PHI. Credential numbers are public. Attestor wallet address is pseudonymous but AHIMA/AAPC credential numbers are public records, so correlation does not constitute PHI disclosure.
- **W3C VC 2.0 alignment:** W3C Verifiable Credentials 2.0 became a W3C Recommendation on May 15, 2025 ([w3.org](https://www.w3.org/press-releases/2025/verifiable-credentials-2-0/)). SBTs are *not* W3C VCs but are complementary — the SBT serves as the on-chain presence indicator while a W3C VC (off-chain, signed by AHIMA or AAPC) provides the authoritative credential claim.
- **Weakness:** Requires one Somnia transaction per attestor onboarding (~$0.10–0.15). Creates per-hospital SBT registry maintenance burden. Does not integrate with AHIMA/AAPC's existing credential verification APIs (AHIMA: `my.ahima.org/credential-verification`; AAPC: `aapc.com/certification/credential-verification.aspx`).

---

### Option C — Ethereum Attestation Service (EAS) schema

- **Mechanism:** EAS runs two contracts — a `SchemaRegistry` and an `Attestation` contract. Hospital registers a schema (e.g., `(string credentialType, uint32 credentialExpiry, bytes32 credentialHashedNumber)`) once; then makes an attestation per coder per claim (or per coder onboarding). Revocable attestations supported natively.
- **EAS deployment:** EAS is deployed on Ethereum, Arbitrum, Optimism, Base, Polygon. **EAS is NOT currently deployed on Somnia mainnet** — no evidence of deployment found as of May 2026. Since Somnia is EVM-compatible, the EAS contracts could be deployed permissionlessly, but cliqueue would need to deploy and maintain them.
- **Gas cost:** EAS schema registration: one-time, ~50k–100k gas. Per-attestation: ~50k–80k gas (base 21k + calldata + state writes). At Somnia pricing, estimated **$0.00003–$0.00005 per attestation** — essentially free.
- **Offchain attestation option:** EAS supports fully off-chain attestations (zero gas) that are cryptographically signed and verifiable without touching the chain. This would be optimal for per-claim attestations where volume is high.
- **Revocation:** First-class feature — single `revoke()` call with attestation UID. Revocation is on-chain and auditable.
- **W3C VC alignment:** EAS attestations are structurally similar to W3C VCs (issuer, subject, data, signature) but use a different encoding. The EAS team has published interoperability work but no formal VC 2.0 binding exists.
- **Weakness:** Requires deploying EAS contracts on Somnia (no existing deployment). Adds a new protocol dependency. Per-claim on-chain attestations at volume (10k claims/day) = 10k attestation transactions/day — manageable at Somnia's 92+ TPS but adds chain load. Off-chain EAS attestations eliminate this but require off-chain verification infrastructure.

---

### Option D — Hospital-issued W3C Verifiable Credential (off-chain)

- **Mechanism:** Hospital issues a W3C VC 2.0 (JSON-LD + BBS+ or EdDSA signature) to the coder's DID at onboarding. When attesting a claim, coder signs a presentation containing the VC + claimId. The presentation hash is stored on-chain.
- **HIPAA status:** SAFE — VC contains credential number, expiry, credential type. No PHI. W3C DID + VC is explicitly designed for professional credentials.
- **Regulatory alignment:** W3C VC 2.0 is now a W3C Standard (May 2025) — strongest standards alignment of all options. HHS FAQ 569 ([hhs.gov](https://www.hhs.gov/hipaa/for-professionals/faq/569/how-may-hipaas-requirements-for-verification-of-identity-be-met-electronically/index.html)) confirms electronic identity verification methods are acceptable under HIPAA Privacy Rule.
- **On-chain footprint:** Only the `keccak256(VPHash)` is stored on-chain — minimal storage, same gas as Option A.
- **Revocation:** VC revocation uses W3C Bitstring Status List v1.0 (off-chain) — the status list URL is embedded in the VC; verifiers check it. No on-chain revocation transaction needed.
- **Weakness:** Requires each hospital to operate a DID infrastructure and VC issuance system. There is no shared AHIMA/AAPC DID registry as of May 2026 — AHIMA and AAPC both use centralized web-based credential verification, not DIDs. This adds integration complexity that would delay MVP significantly.

---

### Recommended architecture for cliqueue MVP

**Two-layer approach:**

1. **Attestor onboarding (per-hospital, per-coder):** Mint an ERC-5484/ERC-5192 SBT on Somnia at coder onboarding time. Schema: `{credentialType: bytes4, credentialExpiry: uint32, hashedCredentialNumber: bytes32}`. One-time cost per attestor (~$0.10–0.15 on Somnia). Hospital can revoke on coder departure. This provides on-chain, queryable, revocable credential presence.

2. **Per-claim attestation (high volume):** Store `keccak256(attestorAddress, claimId, block.number)` as a `bytes32 attestorSig` field in the Claim struct (Option A). This is gasless (warm SSTORE ~$0.000003). The SBT check is a `staticcall` to the SBT contract at claim submission time to verify the attestor holds a valid, non-expired, non-revoked SBT — adds ~5k–10k gas for the call.

3. **Defer W3C VC / EAS** to post-MVP when AHIMA/AAPC credential interoperability infrastructure matures.

**Total per-inpatient-claim HumanAttestor gas overhead (incremental):** ~10k–15k gas above baseline claim submission = ~$0.000006–0.000008 on Somnia. Negligible.

**Design implication:** Add a `ClaimType` enum (`{Outpatient, InpatientFacility, Professional}`) to the Claim struct; inpatient-facility claims require a non-zero `attestorSig` and a passing `SBTRegistry.isValid(attestorAddress)` check before transitioning from `Submitted` to `Adjudicated`. The SBTRegistry is a hospital-deployed ERC-5484 contract on Somnia.

**Open questions generated:**
1. Should the `SBTRegistry` be hospital-scoped (each hospital deploys its own ERC-5484 contract) or network-scoped (cliqueue deploys one registry, hospitals call `grantRole(attestor, hospitalId, credentialType)`)? The network-scoped design reduces deployment overhead but creates a shared registry cliqueue must maintain.
2. What is the cliqueue liability exposure if a hospital's SBT registry contains a stale entry (coder left, SBT not revoked) and a fraudulent attestation is anchored? Should an on-chain expiry check (`credentialExpiry < block.timestamp`) be enforced at claim submission rather than relying on revocation?
3. Does the AHIMA/AAPC credential verification API (AHIMA: REST; AAPC: web form) have a terms-of-service prohibition on automated verification calls that would block cliqueue from validating credential status before issuing an SBT?

---

**See also** — [[../topics/sbt|SBT hub]]
