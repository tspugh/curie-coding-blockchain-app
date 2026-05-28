# PayerClaimRefSet Event Design and 835 Adapter Caching Pattern

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-17 — YES: emit `PayerClaimRefSet` at adjudication; 835 adapter must cache CLP07 hash locally; cold-SLOAD avoided; LOG2 = 18,560 gas on Somnia

**Question investigated:** Should `ClaimsAdjudicator` emit a `PayerClaimRefSet(bytes32 indexed claimId, bytes32 payerClaimRef)` event at adjudication — so the off-chain 835 adapter can cache the CLP07 hash without reading contract state at settlement time, avoiding the 1M cold-SLOAD for the adapter's reconciliation path?

**Background:** Per prior research (payerclaimref-slot-initialization-strategy.md, 2026-05-17), `payerClaimRef` stores `HMAC-SHA256(CLP07)` and is written only at `adjudicateClaim()`. After adjudication, if the slot ages out of Somnia's 128M-slot LRU cache (possible for high-volume deployments), the 835 adapter reading it at settlement time pays a **1M gas cold existing-key SLOAD**. The question is whether an event at adjudication time eliminates that dependency.

---

### Finding 1: EVM event emission is the canonical DeFi pattern for deferred field updates

Production DeFi protocols (Uniswap v3, Aave v3, Compound, MakerDAO) emit dedicated events whenever operationally important state fields are set or updated — including deferred fields not known at record creation time. The established naming convention is `...Set(...)` for a field assigned once, or `...Updated(...)` if it may change. Off-chain indexers (The Graph, Ormi, custom ETL) treat event logs as the primary distribution layer; storage reads are a secondary mechanism for direct lookups only.

- [Uniswap v3 core events](https://github.com/Uniswap/v3-core)
- [Aave v3 core events](https://github.com/aave/aave-v3-core)
- [ConsenSys guide to Ethereum events and logs](https://consensys.io/blog/guide-to-events-and-logs-in-ethereum-smart-contracts)
- [RareSkills: Solidity Events](https://rareskills.io/post/ethereum-events)

### Finding 2: Somnia LOG2 gas cost is 18,560 gas for `PayerClaimRefSet`

The event `PayerClaimRefSet(bytes32 indexed claimId, bytes32 payerClaimRef)` is a LOG2 with:
- Topic 0: event signature hash (always present for non-anonymous events)
- Topic 1: indexed `claimId` (bytes32)
- Non-indexed data: `payerClaimRef` (32 bytes)

**Somnia LOG formula:** `3200 + 5120 × topic_count + 160 × size + memory_expansion`

For LOG2 with 32 bytes data:
```
3200 + (5120 × 2) + (160 × 32) = 3200 + 10240 + 5120 = 18,560 gas
```

Ethereum baseline for comparison: `375 + (375 × 2) + (8 × 32) = 1,381 gas`

Somnia logs cost ~13× more than Ethereum due to IceDB historical storage requirements. At the current per-claim economics ($0.03/claim LLM inference dominates), 18,560 gas adds approximately $0.0000019 per claim at Somnia gas prices — negligible.

- [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)

### Finding 3: CLP07 is the payer's internal claim control number (ICN), assigned at adjudication

CLP07 in the X12 835 EDI standard is the payer's internal claim control number — assigned by the payer during claim receipt and adjudication. It is the payer-side identifier returned in the remittance, not a provider-assigned value. CMS companion guides explicitly describe CLP07 as the ICN; payer companion guides (SummaCare, Fallon) treat it as mandatory in their 835 implementations.

CLP07 is standards-defined as part of the 835 CLP segment, but its universal presence across all payer implementations is not guaranteed — some payers may use alternate fields. The 835 adapter must treat it as the primary reconciliation key but maintain fallback using CLP01 (patient control number) and TRN02 (trace number) per X12 RFI 2370 guidance.

- [X12 RFI-2370: PLB/CLP usage with CLP01 and CLP07](https://x12.org/resources/requests-for-interpretation/rfi-2370-plb0302-usage-clp01-and-clp07)
- [CMS 835 companion guide — CLP07 as ICN](https://www.ctdssmap.com/CTPortal/portals/0/StaticContent/Publications/835_HC_Claim_Pmt-Advice_CG_V3.0.pdf)
- [SummaCare 835 companion guide](https://www.summacare.com/-/media/project/summacare/website/document-library/edi-and-hipaa/hipaa-summacare-835-companion-guide-5010.pdf)

### Finding 4: Caching CLP07 locally in the 835 adapter is the universal industry practice

The standard 835 adapter pattern across healthcare EDI platforms, clearinghouses, and revenue cycle management systems is:

1. **On 835 receipt:** parse CLP07 from the remittance; persist `(submittedClaimId → payerICN)` in the adapter's local store immediately.
2. **Bidirectional index:** store both `claimId → payerICN` and `payerICN → claimId` for void/replacement/appeal lookups.
3. **Never depend on runtime re-fetch:** payer portals and APIs are slow or unavailable; the 835 file is the authoritative remittance record.

**Well-known failure mode if ICN is not cached:** "reconciliation-liveness failure" — the adapter must query a slow or unavailable payer system at settlement time, causing delayed payment posting, unmatched ERA queues, and in a blockchain context, blocked on-chain settlement events. This is the primary operational risk that makes local caching mandatory in production.

No published standard (CAQH CORE, Da Vinci CDex, HL7 FHIR R4 financial module) defines a canonical `submittedClaimId → payerICN` persistence schema — it is implementation-defined but universally practiced.

- [X12 RFI-2370](https://x12.org/resources/requests-for-interpretation/rfi-2370-plb0302-usage-clp01-and-clp07)

### Finding 5: The `PayerClaimRefSet` event enables event-driven caching, eliminating cold-SLOAD dependency

When `ClaimsAdjudicator` emits `PayerClaimRefSet(bytes32 indexed claimId, bytes32 payerClaimRef)` at adjudication, the 835 adapter can:

1. Subscribe to `PayerClaimRefSet` events via Somnia WebSocket `eth_subscribe("logs", {topics: [SIG, claimId]})`.
2. Cache `claimId → payerClaimRef` in the hospital-local adapter database on event receipt.
3. At settlement/835-matching time: look up `payerClaimRef` from the local cache rather than calling `ClaimsAdjudicator.getClaim(claimId)`.

This eliminates the cold-SLOAD path entirely for the reconciliation hot path. The 835 adapter then only falls back to an `eth_call` if the cache is cold (e.g., first startup, cache miss after restart), and can populate the cache from `eth_getLogs` backfill using `fromBlock: deploymentBlock`.

The `claimId` topic being indexed (Topic 1) enables server-side per-claim filtering on Somnia — confirmed by prior research (eth-subscribe-topic1-filter-somnia-log-gas-costs.md, 2026-05-16).

### Design recommendation: YES — emit `PayerClaimRefSet` at adjudication

**Solidity event signature:**
```solidity
event PayerClaimRefSet(bytes32 indexed claimId, bytes32 payerClaimRef);
```

**Emission point:** inside `adjudicateClaim()` immediately after writing `claim.payerClaimRef`.

**Gas cost:** 18,560 gas (LOG2, Somnia formula) — negligible relative to the 200K gas SSTORE for the slot write itself.

**835 adapter behavior:**
- Subscribe to `PayerClaimRefSet` on startup; cache `claimId → payerClaimRef` in local PostgreSQL.
- At settlement: `SELECT payerClaimRef FROM cache WHERE claimId = $1` — O(1) local lookup.
- On cache miss: call `getClaim(claimId)` via `eth_call` and warm the cache entry.
- On reconnect/restart: backfill from `eth_getLogs(PayerClaimRefSet, fromBlock=lastCheckpoint)`.

**ISBTRegistry interface:** `PayerClaimRefSet` should be declared in `IClaimsAdjudicator` so Ormi subgraph definitions bind to the interface ABI, not the implementation.

**Design implication:** `ClaimsAdjudicator` must emit `PayerClaimRefSet(bytes32 indexed claimId, bytes32 payerClaimRef)` at adjudication. The 835 adapter maintains a local `claimId → payerClaimRef` cache populated by this event, eliminating the 1M cold-SLOAD from the reconciliation hot path. The cache backfill pattern (eth_getLogs from checkpoint) is identical to the dispute-listener reconnect pattern already specified.

**Open questions generated:**
1. Should `PayerClaimRefSet` also carry `bytes32 indexed payerClaimRef` as the second indexed topic (making it LOG3 at 23,680 gas) — enabling payer systems to subscribe to their own ICN-space events and detect duplicate-payment risk without a provider-side lookup?
2. Should the `IClaimsAdjudicator` interface declare `PayerClaimRefSet` alongside `ClaimSubmitted` and `ClaimAdjudicated` — binding Ormi subgraph definitions to the interface rather than the implementation contract?
3. Should the hospital BAA's "835 Adapter Reference Implementation" exhibit include the `PayerClaimRefSet` cache schema (table: `claimId TEXT PRIMARY KEY, payerClaimRef BYTEA, cachedAt TIMESTAMPTZ`) as a normative artifact — so hospital IT vendors know the expected local store structure?

---

**See also** — [[../topics/x12|X12 hub]] · [[../topics/sbt|SBT hub]]
