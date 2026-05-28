# ClaimsDisputeRegistry: Separate Contract vs. ERC-7201 Internal Storage — UUPS Upgrade Interaction

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should `ClaimsDisputeRegistry` be a separate deployed contract or an internal ERC-7201 namespaced storage region within `ClaimsAdjudicator` — and does the UUPS upgrade path affect the choice?

---

### Finding 1: A separate `ClaimsDisputeRegistry` contract incurs a mandatory cross-contract call overhead on every dispute initiation and resolution

- Every external call from `ClaimsAdjudicator` to a separately deployed `ClaimsDisputeRegistry` incurs the EVM `CALL` opcode base cost. Post-Berlin (EIP-2929), calling a contract address that is not yet in the transaction's `accessed_addresses` set costs **2,600 gas** for the cold account access; subsequent calls to the same address within the same transaction cost **100 gas** (warm). In addition, each SLOAD of a storage slot in the registry contract that has not been accessed within the current transaction costs **2,100 gas** (cold SLOAD on Ethereum) or, on Somnia, **1,000,100 gas** if the slot has been displaced from the 128M LRU cache.
  — [EIP-2929: Gas cost increases for state access opcodes](https://eips.ethereum.org/EIPS/eip-2929)
  — [EIP-2930: Optional access list](https://rareskills.io/post/eip-2930-optional-access-list-ethereum)
  — Assessment: High confidence. This is EVM specification behavior.

- **The critical Somnia-specific penalty:** On Somnia, the SLOAD cold-vs-warm distinction is cross-block (IceDB LRU cache, 128M slot global budget). A separately deployed `ClaimsDisputeRegistry` whose dispute record slots were written at dispute initiation (block N) and are then read at dispute resolution (block N+X, potentially hours to days later) may have had those slots evicted from the LRU cache. This means: **separate contract = two cold SLOAD penalties** — one for the registry contract's account access (cold CALL) and one for each displaced storage slot within the registry. Combined worst case at dispute resolution: 2,600 (cold account) + 2 × 1,000,100 (cold SLOADs in registry) ≈ 2,002,800 gas per disputed claim resolved, vs. ~200,200 gas if registry slots happen to remain warm.
  — [EIP-2929](https://eips.ethereum.org/EIPS/eip-2929); Somnia IceDB gas model (cross-block LRU)
  — [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)
  — Assessment: High confidence for formula. Medium confidence for real-world dollar cost (SOMI price volatile).

- **Counterpoint:** Within a single dispute resolution transaction, once the registry contract's address is in `accessed_addresses` and its storage slots have been loaded once (warming them), subsequent operations in the same transaction incur only warm costs (100 gas per SLOAD). This means the cold penalty applies once per transaction, not per operation — still a meaningful penalty for the Somnia context given the 1M surcharge.
  — [Understanding gas costs after Berlin — HackMD](https://hackmd.io/@fvictorio/gas-costs-after-berlin)
  — Assessment: High confidence.

---

### Finding 2: ERC-7201 namespaced internal storage eliminates all cross-contract call overhead and is the UUPS-safe pattern for modular state isolation

- ERC-7201 defines a collision-resistant storage root formula: `erc7201(id) = keccak256(keccak256(id) - 1) & ~0xff`. A struct placed at this root is guaranteed disjoint from all standard Solidity sequential storage slots (root = 0) and from all other ERC-7201 namespaces. This enables `ClaimsAdjudicator` to contain both its main claims storage and a `DisputeStorage` namespace, with zero risk of slot collision during UUPS upgrades.
  — [ERC-7201: Namespaced Storage Layout](https://eips.ethereum.org/EIPS/eip-7201)
  — [ERC-7201 Storage Namespaces Explained | RareSkills](https://rareskills.io/post/erc-7201)
  — Assessment: High confidence. ERC-7201 is a finalized EIP; OpenZeppelin v5 uses it across all upgradeable contracts.

- OpenZeppelin adopted ERC-7201 universally in Contracts v5.0 precisely because sequential storage slots (used in v4) are incompatible with UUPS upgrades: adding a new variable to the middle of an inheritance chain shifts all downstream slots, corrupting existing state. The namespaced approach — placing each logical module's state in a keccak256-derived root far from slot 0 — makes adding new variables within a namespace safe (fields are packed sequentially from the root) and makes adding new namespaces safe (roots are disjoint by construction).
  — [Introducing OpenZeppelin Contracts 5.0](https://blog.openzeppelin.com/introducing-openzeppelin-contracts-5.0)
  — [Writing Upgradeable Contracts | OpenZeppelin Docs](https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable)
  — Assessment: High confidence.

- **Critical UUPS interaction — v4→v5 incompatibility:** The OZ GitHub issue tracker (Issue #6362) documents an unrecoverable deadlock when upgrading a UUPS proxy whose implementation was compiled with OZ v4 (sequential storage) to a v5 implementation (ERC-7201 namespaced storage). The deadlock: OZ v4's `Initializable._initialized` flag occupies slot 0 with value `0x01`; OZ v5 maps the first string in the ERC-7201 namespace to slot 0's encoding, which Solidity interprets as a `length = 0` "long string" marker — an invariant violation causing `Panic(0x22)`. **Implication for cliqueue:** If the initial deployment of `ClaimsAdjudicator` uses OZ v5 (ERC-7201 from the start), this deadlock is not a risk — it only occurs when migrating *from* sequential to namespaced storage. Starting with ERC-7201 from day one is the recommended path.
  — [OZ Issue #6362](https://github.com/openzeppelin/openzeppelin-contracts/issues/6362)
  — [Why Upgrading OZ Smart Contracts from v4 to v5 is Unsafe](https://medium.com/51nodes/why-upgrading-openzeppelin-smart-contracts-from-version-4-to-version-5-is-unsafe-e08be30efd8a)
  — Assessment: High confidence for the risk description; high confidence for the mitigation (deploy with OZ v5 ERC-7201 from genesis).

- **Gas advantage of internal ERC-7201 dispute storage:** An internal `DisputeStorage` struct at an ERC-7201 root is still storage in `ClaimsAdjudicator`'s proxy contract. Reading dispute slots requires only SLOAD (no CALL overhead). At dispute initiation (claim still likely warm from adjudication), the dispute record is written as a SSTORE into a fresh ERC-7201 slot — a new slot, so it starts warm immediately after writing. At dispute resolution (potentially 48 hours later on Somnia), the dispute record slot may have been evicted from the 128M LRU cache, incurring the 1M cold-SLOAD penalty exactly as a separate contract would. **The key difference: no cross-contract CALL overhead, and no cold account access cost (2,600 gas).** The dispute record is in the same proxy contract's storage — always "in" the proxy's account context.
  — Analytical synthesis from EIP-2929 and ERC-7201 documentation.
  — Assessment: High confidence.

---

### Finding 3: Separate contract offers one genuine advantage — independent upgradeability of dispute logic

- A separately deployed `ClaimsDisputeRegistry` can be upgraded independently of `ClaimsAdjudicator`. If dispute logic changes (new dispute states, new arbitration flow), only the registry is upgraded; the main adjudicator is untouched. This reduces upgrade scope and therefore upgrade risk.
  — [Upgrading Smart Contracts | OpenZeppelin Docs](https://docs.openzeppelin.com/learn/upgrading-smart-contracts)
  — Assessment: High confidence for the architectural claim; the practical value depends on how frequently dispute logic changes vs. main adjudication logic.

- **However:** Independent upgrade creates a storage migration problem. If the registry is upgraded to a new implementation with a different `DisputeRecord` struct layout, existing dispute records written by the old implementation may be misread by the new implementation — a classic storage layout collision bug. Solving this requires the registry to also use ERC-7201 namespaced storage internally, and to maintain backwards-compatible struct extension rules. This negates much of the simplicity benefit of the separate-contract approach.
  — [ERC-7201 Namespaced Storage in Smart Contracts | BailSec](https://bailsec.io/tpost/i80826iun1-erc-7201-namespaced-storage-in-smart-con)
  — Assessment: Medium confidence (analytical synthesis; no direct precedent found for this specific combined pattern in healthcare blockchain contexts).

- A separate contract also requires `ClaimsAdjudicator` to hold the registry's address in its storage (one extra SLOAD per dispute call) and requires governance to update that address if the registry is replaced — adding a governance surface that does not exist with the internal namespace approach.
  — Analytical synthesis.
  — Assessment: High confidence.

---

### Finding 4: The UUPS upgrade path strongly favors internal ERC-7201 storage — separate contract introduces orphaned-state risk on adjudicator upgrades

- If `ClaimsAdjudicator` is upgraded via UUPS (implementation swap), and `ClaimsDisputeRegistry` is a separate deployed contract, the upgrade must preserve the registered registry address in `ClaimsAdjudicator`'s storage. If the UUPS upgrade accidentally zeroes or changes storage slots (a common bug when adding fields without ERC-7201), the registry address is lost and dispute resolution is permanently broken for existing claims. This is the "orphaned registry" failure mode.
  — [UUPS: Universal Upgradeable Proxy Standard | RareSkills](https://rareskills.io/post/uups-proxy)
  — [UUPS vs Transparent vs Beacon: Proxy Security Guide 2026 | Zealynx Security](https://www.zealynx.io/blogs/upgrade-patterns-security)
  — Assessment: High confidence for the risk; the ERC-7201 mitigation (namespacing the registry address itself) is the standard defense.

- **ERC-7201 internal namespacing eliminates this risk entirely:** because the dispute storage namespace root is computed deterministically from the namespace ID string, the address of dispute records is a pure function of the contract's keccak256 namespace string — it cannot be accidentally overwritten by sequential storage from a new implementation contract field. The UUPS upgrade validator (`hardhat-upgrades` / `foundry-upgrades`) can verify namespace-safe storage layouts automatically.
  — [Smart Contract Foundry Upgrades with the OZ Plugin | RareSkills](https://rareskills.io/post/openzeppelin-foundry-upgrades)
  — Assessment: High confidence.

---

### Finding 5: Recommended architecture — internal ERC-7201 `DisputeStorage` namespace within `ClaimsAdjudicator`, with optional separate read-only view contract for indexers

- **Primary recommendation:** Implement `ClaimsDisputeRegistry` as an ERC-7201 namespaced storage region *within* `ClaimsAdjudicator`, not as a separately deployed contract. Use OZ v5 pattern:

  ```solidity
  // @custom:storage-location erc7201:cliqueue.dispute
  struct DisputeStorage {
    mapping(bytes32 claimId => DisputeRecord) records;
  }

  bytes32 private constant DISPUTE_STORAGE_LOCATION =
    keccak256(abi.encode(uint256(keccak256("cliqueue.dispute")) - 1)) & ~bytes32(uint256(0xff));

  function _disputeStorage() internal pure returns (DisputeStorage storage $) {
    assembly { $.slot := DISPUTE_STORAGE_LOCATION }
  }
  ```

  This gives: (a) zero cross-contract CALL overhead on dispute initiation and resolution; (b) full UUPS upgrade safety with no orphaned-state risk; (c) clean namespace isolation auditable by `hardhat-upgrades` storage layout validation; (d) same cold-SLOAD exposure as the separate-contract approach on Somnia (dispute records may be evicted from the 128M LRU cache regardless of whether they are in the main contract or a registry), so no gas regression vs. separate contract on the cold-read dimension.
  — [ERC-7201: Namespaced Storage Layout](https://eips.ethereum.org/EIPS/eip-7201)
  — Assessment: High confidence as design synthesis.

- **Optional indexer-facing view contract:** A thin, non-upgradeable `ClaimsDisputeView` contract can read dispute state from `ClaimsAdjudicator` via view calls (STATICCALL + SLOAD). This gives Ormi's indexer and hospital audit tooling a stable, versioned ABI for reading dispute state without coupling to `ClaimsAdjudicator`'s internal layout. The view contract itself holds no state — it is stateless and can be redeployed if the dispute storage layout changes in an upgrade. This pattern (upgradeable state + separate stateless view) is used in Uniswap V4's singleton architecture to separate hot trading paths from peripheral read/query concerns.
  — [Uniswap V4 Launches with Custom Hooks and 30% Gas Savings | Blocklr](https://blocklr.com/news/uniswap-v4-launches-custom-hooks-gas-savings-2026/)
  — Assessment: Medium confidence (Uniswap precedent is analogous; direct healthcare blockchain precedent not found).

---

**Design implication:** `ClaimsDisputeRegistry` should be implemented as an ERC-7201 internal namespace within `ClaimsAdjudicator` rather than as a separate deployed contract. This eliminates cross-contract CALL overhead on Somnia's cold-SLOAD-sensitive gas model, avoids the orphaned-state failure mode on UUPS upgrades, and enables the OZ v5 Foundry upgrade validator to enforce storage layout safety automatically. An optional stateless `ClaimsDisputeView` contract can provide a stable indexer-facing ABI without holding state. The cold-SLOAD risk at dispute resolution time (Somnia 128M LRU eviction) applies equally to both architectures, so the internal namespace is dominant on all non-cold-read dimensions.

**Open questions generated:**
1. Should the `DisputeStorage` namespace include the `DisputeRecord` struct inline, or reference a separate `IDisputeRecord` interface — so hospital audit tooling can verify the dispute record schema independently of the `ClaimsAdjudicator` ABI? (Priority: medium)
2. Should the stateless `ClaimsDisputeView` contract's ABI be pinned as a cliqueue spec artifact (versioned alongside the settlement contract spec), so hospital integration engineers can build indexing tools without coupling to `ClaimsAdjudicator`'s full ABI? (Priority: medium)
3. Should cliqueue's Foundry test suite include an upgrade safety test that verifies no storage slot collision between the main `ClaimsAdjudicator` namespace and the `cliqueue.dispute` namespace — using `forge inspect` output to confirm disjoint slot ranges? (Priority: high)

---

**See also** — [[../topics/dispute-window|dispute-window hub]] · [[../topics/upgradeable-proxy|upgradeable-proxy hub]]
