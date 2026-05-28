# payerClaimRef Slot Initialization Strategy

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-17 — payerClaimRef bytes32 slot: leave uninitialized (Approach B); write non-zero only at adjudication; Somnia charges 200K gas for first non-zero write to non-existent cold slot

**Question investigated:** How should the `payerClaimRef` bytes32 slot in the `Claim` struct be handled when the payer has not yet assigned CLP07 at Submitted state — should it be a placeholder bytes32(0) written in `submitClaim()`, or left as a never-written uninitialized slot written for the first time at `adjudicateClaim()`?

**Background:** `payerClaimRef` stores `HMAC-SHA256(payer's CLP07 claim control number)`. CLP07 is assigned by the payer during adjudication — it does not exist at submission time. The slot will be zero (never written) for the entire period between `Submitted` and `Adjudicated` state, which may span hours.

### Finding 1: EVM zero-value SSTORE semantics (Ethereum baseline)

Writing `bytes32(0)` to a never-written storage slot is semantically equivalent to writing to an already-zero slot — the EVM treats zero-valued storage as "absent" from the Merkle Patricia trie. EIP-2200 (net gas metering) and EIP-3529 define the refund model: writing zero to an already-zero slot is near-free (no meaningful state change), while writing non-zero to an uninitialized slot is the expensive "0 → nonzero" initialization case. Writing zero does not create a persistent "existing key" in the trie — it is treated as not writing anything meaningful.

- [EIP-3529: Reduction in refunds](https://eips.ethereum.org/EIPS/eip-3529)
- [EIP-2200: Structured Definitions for Net Gas Metering](https://eips.ethereum.org/EIPS/eip-2200)

### Finding 2: EIP-2929 warm/cold tracking is per-transaction, not per-block

Writing to a slot in transaction A (block N) does NOT warm that slot for transaction B (block N+1). Warmth is transaction-scoped and resets at the start of every new transaction. Writing `bytes32(0)` in `submitClaim()` provides zero cross-block gas benefit for the subsequent `adjudicateClaim()` read or write. Any assumption that "initializing with zero at submission warms the slot for adjudication" is incorrect.

- [EIP-2929: Gas cost increases for state access opcodes](https://eips.ethereum.org/EIPS/eip-2929)

### Finding 3: Somnia IceDB makes a critical zero vs. non-zero SSTORE distinction

Somnia's IceDB (custom storage layer) has a different cost model from Ethereum's EIP-2929. The gas schedule for **SSTORE** on Somnia is:

| Slot state | Value written | Extra gas charge |
|---|---|---|
| Cached (in 128M LRU set) | any | 0 |
| Cold, **non-existent** key | **zero** | 0 (but requires 1M gas available) |
| Cold, **non-existent** key | **non-zero** | +200,000 gas |
| Cold, existing key | any | +1,000,000 gas |

The critical implication: **writing bytes32(0) to a cold non-existent slot costs nothing** (just requires the gas buffer). Writing non-zero to a cold non-existent slot costs 200,000 gas — a one-time initialization fee. Writing any value to a cold existing key (one that was previously written non-zero and is not in the 128M LRU) costs 1,000,000 gas.

- [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)

### Finding 4: The slot-existence question — does writing zero create an "existing key"?

In canonical EVM state trie semantics, writing zero to a previously non-zero slot **deletes** that slot from the trie (makes it non-existent again). A slot that has never been written is non-existent by definition. A slot that was written zero from the start (submitClaim writes bytes32(0)) should also be non-existent in the trie — the EVM does not persist zero as a meaningful stored leaf.

This means: if `submitClaim()` writes `bytes32(0)` to `payerClaimRef`, that slot remains a **non-existent key** in the storage trie. When `adjudicateClaim()` later writes the actual non-zero hash, it pays the **200,000 gas non-existent cold write** cost — the same as if the slot had never been touched. There is no gas penalty difference between Approach A (zero placeholder at submit) and Approach B (leave uninitialized) for the adjudication write itself.

However, Approach A incurs an additional spurious SSTORE at submission time. Even if that zero-write costs nothing on Somnia (non-existent slot write to zero = free), it still emits bytecode, uses gas buffer, and complicates the compiler output. There is no benefit.

- Canonical EVM storage trie: zero-valued slots are absent / non-existent
- [EVM notes on storage trie](https://www.netspi.com/blog/technical-blog/blockchain-pentesting/ethereum-virtual-machine-internals-part-2/)

### Finding 5: DeFi canonical pattern — leave deferred fields uninitialized

Uniswap v3 (`Position.Info` struct) and Aave v3 (`ReserveData` struct) both use the "leave at zero, write when known" pattern for fields that are not available at struct creation time. Neither protocol explicitly writes `bytes32(0)` as a placeholder — they rely on the EVM's default-zero storage semantics. The first meaningful write (when the data is known) is when the gas cost is paid.

- [Uniswap v3 core Position.sol](https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Position.sol)
- [Aave v3 core DataTypes.sol](https://github.com/aave/aave-v3-core/blob/master/contracts/protocol/libraries/types/DataTypes.sol)

### Design recommendation: Approach B — leave payerClaimRef uninitialized until adjudication

**Do NOT write bytes32(0) as a placeholder in `submitClaim()`.**

The correct Solidity design:
1. At `submitClaim()`: do not touch the `payerClaimRef` slot. It defaults to zero automatically. No SSTORE emitted.
2. At `adjudicateClaim()` (when the payer has assigned CLP07): write `HMAC-SHA256(CLP07)` to `payerClaimRef`. This is a cold non-existent slot write of a non-zero value → costs **200,000 gas** on Somnia.
3. In dispute resolution reading `payerClaimRef`: if the dispute occurs after adjudication and the slot is not in the 128M LRU cache, it costs **1,000,000 gas cold existing slot read**. This is unavoidable — the cold-SLOAD dispute cost applies to all aged slot reads regardless of initialization strategy.

**Gas summary for Approach B vs. Approach A:**

| Step | Approach A (zero placeholder) | Approach B (deferred write) |
|---|---|---|
| submitClaim() | zero SSTORE (free, non-existent→zero) | nothing |
| adjudicateClaim() | 200K gas (non-existent cold non-zero) | 200K gas (non-existent cold non-zero) |
| Dispute SLOAD (aged) | 1M gas cold existing read | 1M gas cold existing read |

**Approach A and B are gas-equivalent for the adjudication and dispute steps.** Approach A adds a free-but-spurious SSTORE at submission. Approach B is cleaner, matches DeFi convention, and avoids unnecessary bytecode.

**One guard required:** `ClaimsAdjudicator` must enforce a state check that `payerClaimRef` can only be written during the `Submitted → Adjudicated` transition. Reading `payerClaimRef` in the `Submitted` state should revert or return the sentinel zero value with documented behavior — the off-chain 835 adapter must handle `payerClaimRef == bytes32(0)` as "CLP07 not yet assigned."

**Design implication:** `payerClaimRef` uses Approach B — leave uninitialized, write HMAC of CLP07 only at `adjudicateClaim()`. The 835 adapter off-chain must handle `payerClaimRef == bytes32(0)` (submitted state) as "CLP07 pending." Dispute resolution for aged claims will always pay the 1M cold-SLOAD fee regardless of approach — the hot-tier dispute contract design (already in prior research) remains the correct mitigation for dispute gas cost.

**Open questions generated:**
1. Should `ClaimsAdjudicator` emit a `PayerClaimRefSet(bytes32 indexed claimId, bytes32 payerClaimRef)` event at adjudication — so the off-chain 835 adapter can cache the CLP07 hash without reading contract state at settlement time, avoiding the 1M cold-SLOAD for the adapter's reconciliation path?
2. Should the `Claim` struct's Slot 0 pack a `hasPayerRef` bool alongside `status` to allow O(1) determination of whether `payerClaimRef` has been set, without incurring a cold-SLOAD of Slot 6 just to check if it's zero?
3. At what Somnia LRU cache occupancy (number of active claims per hospital per day) does Slot 6 (`payerClaimRef`) reliably stay within the 128M-slot LRU between submission and adjudication — and does the typical hospital workflow (adjudication within hours of submission) keep it warm?

---

**See also** — [[../topics/x12|X12 hub]]
