## 2026-05-17 — satisfied-pa-id on-chain anchoring in ClaimSubmitted: bytes32 non-indexed data field is correct; off-chain keccak256(abi.encodePacked(satisfied-pa-id)) with salt; LOG4 gas unchanged; REF*G1 is the EDI carrier (not K3)

**Question answered:** Should cliqueue anchor the `satisfied-pa-id` (X12 PA authorization number returned by payer CRD when `paStatus = satisfied`) as a `bytes32` hash in `ClaimSubmitted` — creating an on-chain link between PA approval and the claim without exposing the raw number — and should it be a second indexed topic or non-indexed data?

---

### Findings

- **`satisfied-pa-id` is a FHIR `valueString` up to 30 alphanumeric characters.** The Da Vinci CRD STU2.1 extension defines `satisfied-pa-id` as a `string` (not `Identifier`), with no explicit character-set or format constraint. Its example value is `"Q8U119"`. The underlying X12 PA authorization number (DE 128 in the 278 response REF*BB segment) is defined as AN 1/30 — alphanumeric, max 30 characters. ([CRD STU2.1 StructureDefinition-ext-coverage-information](https://hl7.org/fhir/us/davinci-crd/STU2.1/StructureDefinition-ext-coverage-information.html); [ASC X12 005010X217 278 companion guide structure](https://www.cms.gov/files/document/esmd-x12n-278-companion-guide.pdf))

- **`satisfied-pa-id` is conditional on `paStatus = satisfied`.** CRD IG constraint `crd-ci-q5` states: "satisfied-pa-id must exist if and only if pa-needed is set to 'satisfied'." For all other `paStatus` values the field is absent; for `paStatus = 0x02 (satisfied)` it is required. ([CRD STU2.1 StructureDefinition-ext-coverage-information](https://hl7.org/fhir/us/davinci-crd/STU2.1/StructureDefinition-ext-coverage-information.html))

- **The `satisfied-pa-id` must also flow into the 837 claim as REF*G1 (Prior Authorization Number).** The standard X12 location for a prior authorization number in both 837I and 837P is `REF` with qualifier `G1` in Loop 2300. This is confirmed by multiple payer companion guides (CGS Medicare 837I, Optum 837I, Molina 837P, Hennepin Health 837P). The `K3` (Free-Form Message Text) segment is NOT the correct carrier — K3 requires formal ASC X12 approval per X12 RFI #2206 and is not a general-purpose identifier field. cliqueue's EDI adapter must map the CRD `satisfied-pa-id` string to `REF*G1` in the outbound 837 transaction. ([X12 RFI #2206 K3 usage restriction](https://x12.org/resources/requests-for-interpretation/rfi-2206-clarify-tooth-info-837p-k3); [CGS Medicare 837I companion guide](https://www.cgsmedicare.com/pdf/edi/837I_compguide.pdf); [Molina 837P companion guide](https://www.molinahealthcare.com/providers/common/duals/ediera/PDF/edi_comm_837p.pdf))

- **A 5th indexed topic is impossible in standard Solidity.** EVM LOG instructions support up to 4 topics for a non-anonymous event: topic[0] = event signature hash, topic[1–3] = up to 3 user-indexed parameters. cliqueue's `ClaimSubmitted` after adding `uint8 indexed paStatus` will be LOG4 (4 topics: signature + claimId + providerHash + paStatus), consuming all available topic slots. The `satisfied-pa-id` hash cannot be a 5th indexed topic. ([Perplexity synthesis on EVM LOG limits, May 2026])

- **The `paAuthHash` must be non-indexed data; gas delta is +5120 on Somnia regardless.** Under Somnia's LOG formula (`3200 + 5120 × topic_count + 160 × data_bytes`): adding a non-indexed `bytes32` field to LOG4 increases data by 32 bytes → `+160 × 32 = +5,120 gas`. This is identical to the cost of adding one more indexed topic (which is impossible). The updated LOG4 event with `paAuthHash` in data = `3200 + 5120×4 + 160×64 = 33,920 gas` vs `28,800 gas` without it (+5,120 delta). At `$0.00000000616/gas` this is `~$0.000209/emission` — negligible. ([Somnia Gas Differences formula](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum); [Perplexity Somnia gas synthesis, May 2026])

- **Hash off-chain, submit `bytes32` — do not hash on-chain.** The `satisfied-pa-id` string (max 30 chars) is known at hospital agent submission time. Best practice is to compute `keccak256(abi.encodePacked(SALT, satisfiedPaId))` in the off-chain TypeScript agent and pass the resulting `bytes32` to `submitClaim()`. The `SALT` should be the `hmacSalt` (hospital-specific secret, already in the off-chain architecture per hmacsalt-key-exchange research) or a dedicated `PA_HASH_DOMAIN_SEPARATOR`. Hashing on-chain adds unnecessary gas (dynamic-length string ABI-encoding) and does not add trust — the contract cannot verify the plaintext without exposing it. ([Perplexity Solidity hashing best practices, May 2026])

- **`paAuthHash` should be `bytes32(0)` when `paStatus ≠ 0x02 (satisfied)`.** The event field is always emitted for ABI simplicity; the contract should enforce `require(paStatus == 0x02 || paAuthHash == bytes32(0), "paAuthHash must be zero unless satisfied")` to prevent spurious non-zero hashes on non-satisfied claims — a confusing audit artifact.

- **No prior published protocol anchors PA authorization numbers as on-chain hashes.** The closest patterns are content-addressed document hashes in OpenTimestamps and IPFS CID anchoring in healthcare provenance systems. cliqueue's `paAuthHash` in `ClaimSubmitted` would be the first published pattern for anchoring a payer-issued PA authorization reference on a public chain in a claims settlement context.

- **Payer-side verification path.** A payer auditor with access to the X12 278 response can independently verify a `paAuthHash` by recomputing `keccak256(abi.encodePacked(SALT, paNumber))` using the hospital-supplied salt and the authorization number from their 278 archive — without cliqueue's involvement. This makes the on-chain hash a self-contained audit artifact.

---

**Design implication:** Add `bytes32 paAuthHash` as a non-indexed data field to `ClaimSubmitted` in `ClaimsAdjudicator`. Off-chain hospital agent computes `keccak256(abi.encodePacked(PA_HASH_DOMAIN_SEPARATOR, satisfiedPaId))` before calling `submitClaim()`. Contract enforces `paAuthHash == bytes32(0)` for all `paStatus` values except `0x02 (satisfied)`. EDI adapter maps `satisfied-pa-id` to `REF*G1` in the outbound 837 (not K3). Gas cost increases from `28,800` to `33,920` on Somnia (+5,120 gas, ~$0.000032/claim). This is a spec-level change requiring a formal amendment alongside the `paStatus` amendment before the next feature branch regeneration.

**Open questions generated:**
1. Should `PA_HASH_DOMAIN_SEPARATOR` be a published constant in the hospital onboarding checklist (enabling independent payer verification of `paAuthHash` without cliqueue's cooperation) — and should it be the same as or distinct from the existing `CLIQUEUE_DOMAIN_SEPARATOR` used for hospitalId hashing in SBTRegistry?
2. Should `paStatus` encoding and `paAuthHash` derivation be published together as a TypeScript `PaStatusEncoder` module (alongside `PaStatus` enum and `CodingConfidenceHeuristic`) — so all PA-related on-chain encoding is versioned and testable as a single spec artifact?
3. Should the `ClaimSubmitted` event spec be formally amended now to include both `uint8 indexed paStatus` and `bytes32 paAuthHash` in a single amendment — rather than two sequential spec changes — since both fields are derived from the same CRD `coverage-information` response object?

---

**See also** — [[../topics/prior-auth|PA hub]] · [[../topics/sbt|SBT hub]]
