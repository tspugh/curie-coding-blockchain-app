## 2026-05-17 — PA_HASH_DOMAIN_SEPARATOR: must be distinct from CLIQUEUE_DOMAIN_SEPARATOR; keccak256("cliqueue.v1.paAuthHash") is the correct pattern; published constant enables independent payer verification

**Question:** Should `PA_HASH_DOMAIN_SEPARATOR` (used to compute `keccak256(abi.encodePacked(PA_HASH_DOMAIN_SEPARATOR, satisfiedPaId))` before anchoring `paAuthHash` as `bytes32` in `ClaimSubmitted`) be a distinct constant from `CLIQUEUE_DOMAIN_SEPARATOR` (currently `keccak256("cliqueue.v1.hospitalId")` used for hospital NPI hashing in `SBTRegistry`) — and what is the correct Solidity pattern for one-way commitment hash domain tags?

---

### Cryptographic pattern for one-way commitment hashes in Solidity

- **For one-way commitment hashes (not EIP-712 signed messages), the correct pattern is `bytes32 constant TAG = keccak256("Protocol.purpose.v1")`** — a human-readable string hashed to bytes32, used as a prefix tag in `keccak256(abi.encodePacked(TAG, input))`. This is distinct from the EIP-712 `DOMAIN_SEPARATOR` (which includes `chainId`, `verifyingContract`, `name`, and `version`) — that pattern is for signed messages with replay protection, not simple commitment hashes. ([EIP-712](https://eips.ethereum.org/EIPS/eip-712); [OpenZeppelin EIP712.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/EIP712.sol))
- **Each distinct semantic purpose must have its own domain tag string.** EIP-712 explicitly states: "The domain separator also allows for multiple distinct signature use-cases on the same struct instance." The same principle applies to commitment hashes: if a `bytes32` commitment is derived from a `hospitalId` context and another from a `paAuthNumber` context, they must use distinct domain strings. Reusing the same tag across both would allow a (contrived) cross-context confusion where a valid `paAuthHash` commitment is mistakenly interpreted as a valid `hospitalId` commitment by off-chain auditors or tooling. ([EIP-712 §2.1](https://eips.ethereum.org/EIPS/eip-712))
- **Security classification: strongly recommended best practice, not a known exploit category.** No published security audit has reported a vulnerability exclusively from reusing a domain tag across two distinct non-overlapping hash contexts in the same contract. However, every published auditor guide (OZ, Cyfrin, RareSkills) treats cross-context domain separation as a required design property — the absence of a documented exploit does not make reuse safe; it means the risk is latent. ([OZ community contracts utilities](https://docs.openzeppelin.com/community-contracts/utilities); [Cyfrin EIP-712 guide](https://www.cyfrin.io/blog/understanding-ethereum-signature-standards-eip-191-eip-712))

---

### Application to cliqueue's two domain constants

- **Existing constant:** `CLIQUEUE_DOMAIN_SEPARATOR = keccak256("cliqueue.v1.hospitalId")` — used in `SBTRegistry` as: `hospitalId = keccak256(abi.encodePacked(npi, CLIQUEUE_DOMAIN_SEPARATOR))`. Scoped to NPI-to-hospitalId derivation. ([Prior research: docs/research/somnia/sbt-hospitalid-npi-hash-hipaa-disclosure.md](sbt-hospitalid-npi-hash-hipaa-disclosure.md))
- **New constant required:** `PA_HASH_DOMAIN_SEPARATOR = keccak256("cliqueue.v1.paAuthHash")` — used in the off-chain hospital agent as: `paAuthHash = keccak256(abi.encodePacked(PA_HASH_DOMAIN_SEPARATOR, satisfiedPaId))`. Scoped to PA authorization number commitment derivation.
- **Why they must be distinct strings:** If the same string `"cliqueue.v1.hospitalId"` were used for both, then any future analysis of on-chain `bytes32` values could not determine from the domain tag alone which context produced a given commitment. Distinct strings make each commitment self-describing to any party who knows the published constants. This is the primary operational benefit: payer-side independent verification requires knowing the correct domain string to recompute the hash — using the wrong separator yields a different bytes32 and fails verification.
- **Naming convention:** The pattern `"cliqueue.v1.<purpose>"` is already established. The new constant follows it: `"cliqueue.v1.paAuthHash"`. A version suffix (`v1`) allows future separator rotation without breaking existing commitments.

---

### Publication and verification requirements

- **Both constants must be published as cliqueue-wide public documentation**, not just as internal Solidity constants. The payer needs `PA_HASH_DOMAIN_SEPARATOR` to independently verify `paAuthHash` in `ClaimSubmitted` by recomputing `keccak256(abi.encodePacked(PA_HASH_DOMAIN_SEPARATOR, their278ArchiveEntry))` and comparing to the on-chain bytes32. If the constant is unpublished, independent payer verification is impossible — defeating the stated purpose of on-chain PA linkage.
- **The hospital onboarding checklist must list both constants** with their preimage strings and hex values, so integration engineers can hardcode them in the TypeScript `PaStatusEncoder` module without reverse-engineering contract bytecode.
- **Not a secret:** Unlike `hmacSalt` (which protects PHI-adjacent CLM01 hashes), `PA_HASH_DOMAIN_SEPARATOR` is a public domain tag that enables *verification* — it does not need to be kept confidential. The raw `satisfiedPaId` is never on-chain; only the commitment hash is. A public separator still does not reveal the raw PA number, because the PA number space is effectively private (payer-specific, not enumerable like NPI).
- **Distinct from `CLIQUEUE_DOMAIN_SEPARATOR` in contract storage:** If `ClaimsAdjudicator` or a future verifier contract stores either constant, they should be named and documented separately in NatSpec so block explorer auditors can distinguish them by name.

---

### Solidity specification

```solidity
/// @dev Domain tag for hospitalId derivation: keccak256(abi.encodePacked(npi, CLIQUEUE_DOMAIN_SEPARATOR))
bytes32 internal constant CLIQUEUE_DOMAIN_SEPARATOR = keccak256("cliqueue.v1.hospitalId");

/// @dev Domain tag for PA authorization number commitment: keccak256(abi.encodePacked(PA_HASH_DOMAIN_SEPARATOR, satisfiedPaId))
/// Published in the hospital onboarding checklist to enable independent payer verification.
bytes32 public constant PA_HASH_DOMAIN_SEPARATOR = keccak256("cliqueue.v1.paAuthHash");
```

Note: `PA_HASH_DOMAIN_SEPARATOR` is `public` (payer-verifiable); `CLIQUEUE_DOMAIN_SEPARATOR` can remain `internal` (NPI is already public but the constant needn't be externally callable for NPI verification — it can be published in docs instead).

---

### TypeScript derivation (PaStatusEncoder module)

```typescript
import { keccak256, encodePacked } from 'viem';

export const PA_HASH_DOMAIN_SEPARATOR =
  keccak256(encodePacked(['string'], ['cliqueue.v1.paAuthHash']));

export function derivePaAuthHash(satisfiedPaId: string): `0x${string}` {
  return keccak256(encodePacked(['bytes32', 'string'], [PA_HASH_DOMAIN_SEPARATOR, satisfiedPaId]));
}

export const ZERO_PA_AUTH_HASH = '0x' + '00'.repeat(32) as `0x${string}`;
```

**Design implication:** `PA_HASH_DOMAIN_SEPARATOR` must be a distinct constant (`keccak256("cliqueue.v1.paAuthHash")`) from `CLIQUEUE_DOMAIN_SEPARATOR` (`keccak256("cliqueue.v1.hospitalId")`). Both must be published in the hospital onboarding checklist. `PA_HASH_DOMAIN_SEPARATOR` should be a `public constant` in `ClaimsAdjudicator` (or `PaStatusEncoder` TypeScript module) to enable independent payer verification of `paAuthHash` commitments without cliqueue's involvement. The `PaStatusEncoder` module should export both `PA_HASH_DOMAIN_SEPARATOR` and `derivePaAuthHash()` alongside the `PaStatus` enum.

**Open questions generated:**
1. Should `CLIQUEUE_DOMAIN_SEPARATOR` also be promoted to `public` in `SBTRegistry` — so hospital compliance teams can independently verify `hospitalId` derivation from NPI without cliqueue's cooperation, using the block explorer and published constant?
2. Should cliqueue publish a formal "Domain Constant Registry" document (one page) listing all `bytes32` domain tags used across `ClaimsAdjudicator`, `SBTRegistry`, and `PaStatusEncoder` — with their preimage strings, hex values, and intended usage — as a spec artifact versioned alongside the contract ABI?
3. Should the `PaStatusEncoder` TypeScript module be published as part of the `@cliqueue/contracts` npm package alongside `ISBTRegistry` — so payer integration engineers can import it directly for verification tooling without implementing the keccak256 derivation themselves?

---

**See also** — [[../topics/prior-auth|PA hub]]
