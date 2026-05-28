# Claim Struct Packing and Cold-SLOAD Dispute Architecture on Somnia

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — What is the optimal Claim struct packing layout for `ClaimsAdjudicator` on Somnia to minimize cold-SLOAD exposure, and how does Somnia's 1M-gas cold-SLOAD surcharge interact with a 48-hour dispute window?

---

### Finding 1: Somnia's 128M-slot LRU cache is global and cross-block — a slot is warm as long as it stays in the most-recently-accessed 128 million slot set

- Somnia's IceDB gas model charges SLOAD based on whether the `(contract, storageKey)` pair is in the **"most recently accessed 128 million contract slot keys"** — a global LRU cache shared across all contracts and all transactions, persistent across block boundaries.
  — [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)
  — Assessment: High confidence. Primary Somnia documentation.

- This is the critical difference from Ethereum's EIP-2929 model: on Ethereum, warm/cold is **per-transaction** (access list resets at the start of each transaction). On Somnia, warm status depends on whether the slot has been read or written recently **across the entire chain history**, subject to the 128M LRU eviction. A slot written in block N that has not been accessed since will remain warm until displaced by 128M newer accesses, then become permanently cold until next touch.
  — Analytical synthesis from Somnia IceDB documentation and EIP-2929 specification.
  — Assessment: High confidence.

- At 0.1s block time and current mainnet utilization (~6 TPS actual, well below theoretical maximum), the 128M slot budget is enormous relative to cliqueue's claim volume. A contract with 10,000 active claims at any given time occupies at most ~50,000 storage slots (5 fields per claim × 10,000 claims) — a tiny fraction of the 128M cache. **At current mainnet utilization, virtually all recently submitted claims will remain warm for many hours.**
  — Calculation based on Chainspect observed 6 TPS and Somnia block time data.
  — Assessment: Medium confidence. Assumes current low mainnet utilization. At full capacity (1M+ TPS with diverse contracts), the cache becomes competitive and high-volume claims may evict each other.

- **Critical risk: dispute resolution.** Somnia's 0.1s block time means 48 hours = 1,728,000 blocks. If a claim is submitted at block N and challenged at block N+1,728,000, the claim's storage slots will almost certainly have been displaced from the 128M LRU cache by other contract activity, making every state read for that claim a **cold SLOAD at 1,000,100 gas** (~$0.006 at current gas pricing of $0.00000000616/gas × 1,000,100).
  — Gas cost calculation: 1,000,000 additional gas × $0.00000000616/gas = ~$0.00616 per cold read, plus 100 base = ~$0.00616 total surcharge per slot.
  — Assessment: High confidence for formula; medium confidence for dollar cost (SOMI price volatile).

---

### Finding 2: A multi-slot Claim struct with interleaved hot and cold fields is the primary gas anti-pattern to avoid

- The EVM packs Solidity struct fields into 32-byte storage slots sequentially. Reading **any** field from a multi-value packed slot costs a full SLOAD of that slot — even if only one field is needed. Writing to a packed slot (when other fields are present) requires read-modify-write: one cold SLOAD + one cold SSTORE.
  — [Solidity Storage Layout Documentation](https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html)
  — Assessment: High confidence.

- The key anti-pattern for `ClaimsAdjudicator`: packing a frequently-written field (`status: uint8`, `updatedAt: uint64`) into the same 32-byte slot as an infrequently-written field (`adjudicatedCents: uint128`, `claimHash: bytes32`). This forces a cold SLOAD of the "bulk data" slot every time a state transition updates only the `status` field. At 1M cold-SLOAD gas cost on Somnia, this adds ~$0.006 per status update — a ~100× cost increase vs. a warm update.
  — [Ditto: A Dive into Storage Packing](https://dittoeth.com/blog/packing); [Solidity Gas Optimizations pt.3 - Packing Structs](https://dev.to/javier123454321/solidity-gas-optimizations-pt-3-packing-structs-23f4)
  — Assessment: High confidence.

- Conversely, packing fields that are **always accessed together** into a single slot is an optimization: one SLOAD retrieves multiple fields, reducing total slot count and therefore total cold-SLOAD exposure.
  — [Tight Variable Packing | solidity-patterns](https://fravoll.github.io/solidity-patterns/tight_variable_packing.html)
  — Assessment: High confidence.

---

### Finding 3: Recommended two-tier Claim struct layout — "hot slot" + "cold slot(s)" — minimizing dispute-time cold-SLOAD exposure

The following layout splits a `Claim` struct into access-pattern-aligned slots:

**Slot 0 — "Hot" (updated on every state transition, must be warm for normal operations):**
```
uint8   status          (1 byte)   — claim state: Submitted/Adjudicated/Attested/Disputed/Settled
uint64  updatedAt       (8 bytes)  — block.timestamp of last state change
uint64  submittedAt     (8 bytes)  — submission timestamp (read on adjudication, dispute)
uint8   claimType       (1 byte)   — inpatient/outpatient TOB digit
uint8   heuristicTier   (1 byte)   — confidence routing tier at submission
                        (19 bytes total, fits in one 32-byte slot with 13 bytes spare)
```

**Slot 1 — "Submission cold" (written once at submission, read rarely — only at adjudication and dispute):**
```
bytes32 claimHash       (32 bytes) — keccak256(providerNPIHash || batchId || timestamp)
                        (one full slot)
```

**Slot 2 — "Settlement cold" (written once at settlement, read only for dispute and reconciliation):**
```
uint128 adjudicatedCents  (16 bytes) — settlement amount; emitted as event if CV≥20%, else stored only
uint128 billedCents       (16 bytes) — billed amount; suppressed from events per re-identification research
                        (32 bytes, one full slot)
```

**Slot 3 — "Attestor cold" (written once for inpatient claims, never updated):**
```
address attestorAddress   (20 bytes) — SBT holder who attested the inpatient claim
uint64  attestedAt        (8 bytes)  — attestation timestamp
                        (28 bytes, fits in one slot)
```

- Assessment: Medium confidence (design synthesis). The specific field assignments above are recommendations based on the access-pattern analysis; the exact byte layout requires confirmation by running `forge inspect ClaimsAdjudicator storage` after implementation.

---

### Finding 4: A dispute-tier mirror contract (shallow state copy) is the preferred architecture to avoid 1M-gas cold SLOADs during dispute resolution

- The core problem: dispute resolution must read full claim state (submittedAt, claimHash, adjudicatedCents, attestorAddress) from a claim that may have been cold for 48 hours. If all fields are in the primary `ClaimsAdjudicator` storage, each cold field read costs 1M additional gas. A 4-slot claim = up to 4M additional gas for a single dispute read, at ~$0.025 — still cheap in absolute terms at current gas pricing, but **4× the minimum gas requirement for the transaction**, which risks hitting the block gas limit if multiple disputes occur in the same block.
  — Gas calculation: 4 slots × 1M cold gas = 4M additional gas. At current base gas price, this is ~$0.025 per disputed claim.
  — Assessment: High confidence for formula; medium confidence for dollar cost.

- **Recommended pattern: dispute-tier mirror contract** — a separate `ClaimsDisputeRegistry` contract that stores a minimal dispute record written when a claim enters `Disputed` state. The primary contract writes the dispute record to the mirror at dispute-entry time (when the claim state is still likely warm from recent adjudication), enabling dispute resolution to read from the mirror (which will be hot at dispute-resolution time since it was just written).

  ```
  // Written to DisputeRegistry when dispute is initiated (claim still warm):
  struct DisputeRecord {
    bytes32 claimHash;          // Slot 0
    uint128 adjudicatedCents;   // Slot 1 top half
    uint64  disputedAt;         // Slot 1 bottom portion
    address disputant;          // Slot 1 remainder (20+8+4 = 32 bytes fits in one slot)
  }
  ```

  — [Somnia finality-tps-and-gas-model.md](docs/research/somnia/finality-tps-and-gas-model.md) — prior research flagged dispute cold-SLOAD as open question.
  — Assessment: Medium confidence (design synthesis; no external precedent found for this specific pattern in healthcare smart contracts).

- **Alternative: EIP-2930 access list** — callers can pre-declare storage slots they plan to read, pre-paying the cold cost as part of the transaction fee and treating them as warm. Somnia supports access lists (EVM-compatible). For dispute resolution transactions, a `type 1` access list transaction could pre-warm all relevant claim storage slots. However, access lists require the caller (hospital or payer agent) to know the exact storage slot positions in advance, which is fragile and may break on contract upgrades.
  — [EIP-2930 — Ethereum access list | RareSkills](https://rareskills.io/post/eip-2930-optional-access-list-ethereum)
  — Assessment: Medium confidence for access list viability; low confidence for practicality given UUPS upgrade pattern.

- **Simplest mitigation: hot-slot dispute flag.** If the dispute-tier mirror is too complex for MVP, a minimal mitigation is to pack a `disputeActive: bool` flag into Slot 0 alongside `status`. When dispute resolution reads Slot 0 (which is the "hot" slot always warmed by state transitions), it gets the dispute flag for free. Only if a dispute is active does it then read the cold slots — reducing average-case cold reads to zero (since most claims never enter dispute) while limiting worst-case to 3 cold SLOADs per disputed claim.
  — Analytical synthesis.
  — Assessment: High confidence as a minimal viable pattern.

---

### Finding 5: The OpPC challenge window duration is not publicly documented — 48-hour assumption should be validated

- No Somnia documentation, whitepaper, or developer resource explicitly specifies the Optimistic Proof of Computation (OpPC) challenge window duration in blocks or seconds. The "48-hour" figure referenced in prior research (`docs/research/research-questions.md`) is an assumption carried from general optimistic rollup precedents (Optimism's 7-day window, Arbitrum's 7-day window); Somnia's specific challenge window for its LLM inference verification protocol has not been independently confirmed.
  — Assessment: Uncertain. The 48-hour window is an unverified assumption. This should be confirmed via Somnia Discord, developer support, or published SDK documentation before designing the dispute-layer architecture around it.

- **Practical implication:** The cold-SLOAD risk during dispute is proportional to the challenge window. If the window is shorter (e.g., 1 hour = 36,000 blocks), the LRU cache risk is much lower — claims are more likely to remain warm. If longer (7 days), cold reads are near-certain for disputed claims. Design the struct layout conservatively for the 48-hour case (i.e., adopt the hot/cold split regardless), and confirm the actual window before finalizing the dispute-tier mirror decision.
  — Assessment: High confidence for the conservative recommendation.

---

**Design implication:** `ClaimsAdjudicator`'s `Claim` struct should be split across access-pattern-aligned storage slots: a single hot slot (status + timestamps + claimType, updated on every transition) and 2–3 cold slots (claimHash, settlement amounts, attestor). This minimizes SLOAD scope for the common path (state transitions) and limits cold-read penalty to the rare dispute path. A dispute-tier mirror contract (`ClaimsDisputeRegistry`) should copy minimal claim data into fresh (warm) storage at dispute-initiation time, avoiding cold reads during resolution. The hot/cold split is critical regardless of whether the mirror is implemented — it reduces normal-path gas consumption and caps dispute-path cold reads to at most 3 slots.

**Open questions generated:**
1. What is the actual Somnia OpPC challenge window duration (in blocks or seconds) — is the 48-hour assumption validated anywhere in Somnia's documentation or governance proposals? (Priority: high)
2. Should `ClaimsDisputeRegistry` be a separate deployed contract or an internal storage region within `ClaimsAdjudicator` (using ERC-7201 namespaced slot separation) — and does the UUPS upgrade path affect the choice? (Priority: high)
3. At what total claim volume (number of distinct active claim slots) does the 128M LRU cache become competitive enough that cliqueue's slots are at risk of eviction within a normal 48-hour dispute window — and should cliqueue implement a "claim ping" heartbeat (zero-cost read that refreshes warm status) for high-value disputed claims? (Priority: medium)

---

**See also** — [[../topics/dispute-window|dispute-window hub]] · [[../topics/sbt|SBT hub]]
