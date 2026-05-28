# EDI Adapter: payerICN → claimId Mapping — Resilience and Architecture

Research findings for cliqueue-coding-blockchain.

---

## 2026-05-14 — Does the off-chain EDI adapter's responsibility to resolve `payerICN → original claimId` introduce a single point of failure in the replacement workflow, and should this mapping be cached in a separate lightweight on-chain lookup contract?

**Question:** When a denied claim is resubmitted (CLM05-3 frequency code 7), the replacement 837 must reference the payer's Internal Control Number (ICN/CLP07) from the original 835 remittance. The off-chain EDI adapter must translate this ICN into the on-chain `claimId` (the HMAC-SHA256 hash used as the struct key) to construct the replacement transaction. If the adapter's database is unavailable or its `(ICN → claimId)` mapping is lost, replacement claims cannot be submitted on-chain. This question investigates whether that constitutes an unacceptable single point of failure and what mitigations exist.

---

### Finding 1: The ICN is the sole payer-side link — there is no recovery path if it is lost

- The payer ICN (CLP07 in the 835 ERA, REF*F8 in the replacement 837) is the **only** identifier linking a replacement claim to its original in the X12 ecosystem. There is no secondary identifier; the relationship is a flat one-hop parent pointer.
  — [CMS ICN format documentation](https://www.cgsmedicare.com/pdf/edi/835_compguide.pdf); [emrpms.blogspot.com: Payer Claim Number / ICN](https://emrpms.blogspot.com/2020/06/payer-claim-number-aka-internal-control.html)
- "Most payers will not accept resubmissions that do not reference the original Payer Claim Number." A replacement without a valid ICN auto-denies as CO-18 (duplicate), with no exception path.
  — [emrpms.blogspot.com: Payer Claim Number / ICN](https://emrpms.blogspot.com/2020/06/payer-claim-number-aka-internal-control.html); [medstates.com: Medicare ICN Number 2026](https://www.medstates.com/medicare-icn-number/)
- The ICN is assigned by the payer during claim intake and only becomes available to the provider when the 835 ERA is returned. If the 835 is lost or the provider's PMS does not capture it, there is no clearinghouse recovery path documented in any public source reviewed. The provider must call the payer's provider services line to recover the ICN — a manual, high-latency process.
  — [medstates.com: Medicare ICN Number 2026](https://www.medstates.com/medicare-icn-number/); [emrpms.blogspot.com](https://emrpms.blogspot.com/2020/06/payer-claim-number-aka-internal-control.html)

### Finding 2: The Change Healthcare breach proved clearinghouse-level adapter failure is a realistic scenario, not a theoretical one

- The February 2024 Change Healthcare ransomware attack halted the ICN-bearing 835 ERA delivery for an estimated 94% of US hospital systems for weeks. Providers were unable to post remittances, identify denial ICNs, or submit replacement claims through normal EDI channels.
  — [Nixon Peabody Healthcare Alert 2025](https://www.nixonpeabody.com/insights/alerts/2025/11/12/change-healthcare-cybersecurity-breach-impact-on-healthcare-providers); [U.S. News explainer 2024](https://www.usnews.com/news/health-news/articles/2024-03-04/explainer-what-to-know-about-the-change-healthcare-cyberattack)
- The outage cost some providers over $100 million/day. The post-incident industry response was to add a **second clearinghouse backup** (Waystar/Availity redundancy), not to introduce decentralized alternatives.
  — [Nixon Peabody Healthcare Alert 2025](https://www.nixonpeabody.com/insights/alerts/2025/11/12/change-healthcare-cybersecurity-breach-impact-on-healthcare-providers)
- This establishes that the cliqueue off-chain EDI adapter is subject to the same failure class as clearinghouses — a partial outage of the adapter's database makes replacement claims impossible to route on-chain, not merely delayed.

### Finding 3: On-chain event logs on Somnia can serve as a self-healing recovery source for the ICN → claimId mapping

- Solidity event logs are **immutable, queryable** records stored permanently in the blockchain transaction log. They are significantly cheaper than SSTORE and are the canonical pattern for "data needed off-chain but not by smart contracts."
  — [RareSkills: Ethereum Events](https://rareskills.io/post/ethereum-events); [Chainlink: Events and Logging in Solidity](https://blog.chain.link/events-and-logging-in-solidity/)
- The existing `ClaimSettled(bytes32 claimId, bytes32 payerClaimRef, ...)` event (from prior struct design) already emits `payerClaimRef` (the on-chain `bytes32` encoding of CLP07). A `ClaimReplaced(bytes32 original, bytes32 replacement, bytes32 payerRef)` event similarly persists the ICN→claimId relationship.
- **A crashed EDI adapter can reconstruct its `(ICN → claimId)` mapping by replaying `ClaimReplaced` and `ClaimAdjudicated` events from the Somnia chain state** — no separate backup needed. The on-chain event log is the authoritative recovery source. This is only viable because Somnia events are permanently archived and queryable.

### Finding 4: Ormi subgraphs on Somnia provide a production-grade indexed query layer for the event log recovery path

- Ormi is the **official Somnia-endorsed event indexing partner**. It provides GraphQL subgraph hosting (The Graph-compatible) for Somnia, with confirmed **mainnet support** (not testnet-only as of 2026).
  — [Somnia Docs: Ormi Subgraph](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/ormi-subgraph); [Ormi Blog: Somnia 1M TPS case study](https://blog.ormilabs.com/breaking-the-sound-barrier-of-blockchain-how-ormi-enabled-somnias-one-million-tps/)
- Ormi achieves indexing lag of **14 blocks (~120 ms) behind chain tip** on Somnia's high-throughput network. Ormi publishes **99.99% uptime** across 70+ blockchains, representing $50B+ TVL and $100B+ annual volume.
  — [Ormi Blog: best blockchain indexers 2026](https://blog.ormilabs.com/best-blockchain-indexers-in-2025-real-time-web3-data-and-subgraph-platforms-compared/)
- **However**: Ormi is a **centralized hosted service** (not a permissionless protocol). It introduces a second off-chain dependency alongside the EDI adapter. If both the EDI adapter database *and* Ormi are unavailable simultaneously, the recovery path is direct Somnia RPC event log replay — slower but always available from any Somnia full node.

### Finding 5: A lightweight on-chain `(payerICNHash → claimId)` registry is architecturally viable but has trade-offs

- The CSIRO blockchain contract registry pattern provides a documented EVM pattern for on-chain `(key → address)` mappings used for contract discovery. The same pattern applies to `(payerICNHash → claimId)` mappings — a `mapping(bytes32 => bytes32)` on Somnia costs ~2,100 gas per SLOAD cold read and ~22,100 gas per SSTORE write.
  — [CSIRO: Contract Registry Pattern](https://research.csiro.au/blockchainpatterns/general-patterns/contract-structural-patterns/contract-registry/)
- **Benefit**: A separate on-chain lookup contract (`ICNRegistry`) would make the replacement workflow self-contained — any party (adapter, indexer, backup system) can construct the replacement transaction by querying the chain alone.
- **Trade-offs**:
  1. The `payerICNHash` (HMAC-SHA256 of the raw ICN string with a server-held key) must be written to the registry when the 835 ERA is processed. This adds one additional SSTORE per adjudicated claim (~$0.00012 at current SOMI pricing) — negligible.
  2. The ICN hash is only available *after* the 835 ERA is received from the payer (days to weeks after claim submission). The registry write happens at `Adjudicated` state transition, not at `Submitted`. This means the registry is *empty* for claims in flight — it only helps for replacement of already-adjudicated claims, which is the correct use case.
  3. The registry contract must use the same HMAC key as the EDI adapter to generate `payerICNHash`. If the key is rotated, old registry entries become unresolvable (key rotation policy needed).
  4. The raw ICN value must never appear on-chain (it correlates with PHI-bearing 835 records). The HMAC-hashed form satisfies this constraint by the same reasoning applied to the `claimId` derivation.

### Finding 6: FHIR R4 Claim.related does not solve the cross-system identifier mapping problem

- FHIR R4 `Claim.related` provides a `claim` Reference and `reference` Identifier for linking to prior claims, but does not standardize a cross-system identifier format. The HL7 specification explicitly notes that identifier governance between parties is required.
  — [HL7 FHIR R4 Claim](https://www.hl7.org/fhir/R4/claim.html); [FHIR R4 Claim related value set](http://hl7.org/fhir/R4/valueset-related-claim-relationship.html)
- For cliqueue, the on-chain `claimId` (a `bytes32` HMAC) is the system-of-record identifier. FHIR resources are an optional off-chain representation layer; they cannot serve as the primary key for on-chain lookup.

---

### Recommended Architecture for cliqueue EDI Adapter Mapping Resilience

**Primary: Event-log reconstruction (no additional on-chain cost)**
- The EDI adapter populates its `(ICN → claimId)` database from Somnia `ClaimAdjudicated` and `ClaimReplaced` events.
- On adapter restart or database loss, the adapter replays events via Ormi GraphQL or direct Somnia RPC (`eth_getLogs`) to rebuild the mapping from chain state.
- **Zero additional gas cost per claim.** Relies on Ormi (99.99% uptime, 120ms lag) or direct RPC as fallback.

**Secondary: On-chain `ICNRegistry` contract (optional hardening for MVP+)**
- Deploy a `mapping(bytes32 payerICNHash => bytes32 claimId)` contract on Somnia.
- The EDI adapter writes to this registry at `Adjudicated` state transition, alongside the `payerClaimRef` field update.
- Gas cost: ~22,100 gas per adjudicated claim for the SSTORE (~$0.00012). Negligible.
- Enables any party with adapter access to construct replacement transactions without the ICN database — fully on-chain verifiable.
- **Key management requirement**: the HMAC key for `payerICNHash` generation must be stored in the Phala TEE (same key management infrastructure as the coding agent), not in the adapter's application database.

**Not recommended: Raw ICN stored on-chain or in IPFS**
- Raw ICN strings correlate with PHI-bearing 835 files. Storing raw ICN on-chain or in a public IPFS node violates the HIPAA Minimum Necessary standard and the project's PHI-never-on-chain constraint.

---

**Design implication:** The EDI adapter's `(payerICN → claimId)` mapping is a recoverable single point of failure — not a true single point of failure — because the on-chain event log (`ClaimAdjudicated` with `payerClaimRef`) provides a reconstruction source. The practical mitigation is: (1) always write `payerClaimRef` to the Claim struct at `Adjudicated` transition (already in the design), (2) emit `ClaimAdjudicated(bytes32 claimId, bytes32 payerICNHash)` as a queryable event, and (3) build the Ormi subgraph to index the `(payerICNHash → claimId)` mapping. An optional `ICNRegistry` contract adds on-chain redundancy at ~$0.00012/claim additional cost for post-MVP resilience.

**Open questions generated:**
1. Should `payerICNHash` (HMAC-SHA256 of the raw ICN) be stored as an indexed event topic or as contract state in an `ICNRegistry` mapping — and does the Ormi subgraph's 120ms lag introduce any race condition where a replacement 837 could arrive before the indexer catches up with the `ClaimAdjudicated` event?
2. What key rotation policy is required for the HMAC key used to generate both `claimId` and `payerICNHash`? If the key is rotated, does the system need a `(oldKey, newKey, rotation_timestamp)` migration record on-chain to maintain backward lookups?
3. Does Ormi's centralized hosting model require a separate BAA with Ormi Labs before cliqueue indexes HMAC-hashed claim data (even though the raw values are not PHI)?

---

**See also** — [[../topics/x12|X12 hub]] · [[../topics/hipaa|HIPAA hub]]
