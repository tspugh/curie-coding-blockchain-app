# IClaimsAdjudicator Interface-Level Event Registry Design

## 2026-05-17 — Should `IClaimsAdjudicator` declare all primary events as a single interface-level event registry, or split across focused sub-interfaces aggregated by the primary interface?

**Question investigated:** Should `IClaimsAdjudicator` declare all primary events (`ClaimSubmitted`, `ClaimAdjudicated`, `PayerClaimRefSet`, `ClaimPaStatusResolved`, `StaffingFloorReached`, `AttestorCountChanged`) as a single interface-level event registry — so Ormi subgraph schema generation couples to the interface ABI rather than the implementation?

### Finding 1: DeFi canonical pattern is a dedicated events sub-interface, not a flat omnibus registry

Uniswap v3 does NOT declare events directly in `IUniswapV3Pool`. Instead, it publishes a **dedicated `IUniswapV3PoolEvents.sol`** interface containing all 9 pool events (Initialize, Mint, Burn, Swap, Flash, Collect, IncreaseObservationCardinalityNext, SetFeeProtocol, CollectProtocol) with no functions. `IUniswapV3Pool` aggregates six sub-interfaces — `IUniswapV3PoolImmutables`, `IUniswapV3PoolState`, `IUniswapV3PoolDerivedState`, `IUniswapV3PoolActions`, `IUniswapV3PoolOwnerActions`, and `IUniswapV3PoolEvents` — via Solidity interface inheritance. ([IUniswapV3Pool.sol](https://github.com/Uniswap/v3-core/blob/main/contracts/interfaces/IUniswapV3Pool.sol); [IUniswapV3PoolEvents.sol](https://github.com/Uniswap/v3-core/blob/main/contracts/interfaces/pool/IUniswapV3PoolEvents.sol))

Aave v3 uses the alternative "flat" pattern: `IPool` declares events directly alongside all function signatures in a single interface file. ([IPool.sol](https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPool.sol))

OpenZeppelin `IERC20` declares `Transfer` and `Approval` events directly in the interface. ([IERC20.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol))
`IGovernor` declares all 6 core governance events directly in the interface. ([IGovernor.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/IGovernor.sol))

**Conclusion:** both patterns (dedicated sub-interface, and flat monolithic interface) are established. The Uniswap v3 sub-interface pattern is preferred when events come from logically distinct concerns (pool events vs. owner actions vs. state views). cliqueue's events cross two contracts — `ClaimsAdjudicator` (claim lifecycle) and `SBTRegistry` (attestor management) — making the Uniswap sub-interface pattern the correct model.

### Finding 2: Subgraph ABI binding requires events to be present in the ABI artifact used by the manifest

The Graph subgraph `subgraph.yaml` references an explicit **ABI file** under `abis:`. When `graph codegen` and `graph build` run, they generate type-safe AssemblyScript handlers from that ABI. **Events must appear in the ABI artifact referenced by the manifest** to be indexable — if an event is emitted by the implementation but absent from the ABI file supplied in `subgraph.yaml`, The Graph cannot generate handlers for it and it is not indexable from that data source. ([The Graph subgraph manifest docs](https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/); [The Graph creating subgraphs](https://thegraph.com/docs/en/subgraphs/developing/creating/))

Practical implication: the ABI artifact supplied to Ormi's subgraph manifest should be the **compiled ABI of `IClaimsAdjudicator`** (the interface), not the full implementation artifact — provided the interface declares all events the subgraph needs to index. If `StaffingFloorReached` and `AttestorCountChanged` are events from `SBTRegistry` (not `ClaimsAdjudicator`), they require a **separate Ormi data source** bound to `SBTRegistry`'s ABI, not inclusion in `IClaimsAdjudicator`.

### Finding 3: Events declared in a Solidity interface have zero additional gas cost vs. implementation-only declarations

Event declaration is compile-time-only: the EVM emits logs (LOG0–LOG4) at runtime only when `emit EventName(...)` is executed. Declaring an event in an interface vs. in the concrete contract has no runtime gas implication. Gas is charged per log emission, not per declaration. ([Alchemy Solidity events overview](https://www.alchemy.com/docs/solidity-events); [Solidity docs](https://docs.soliditylang.org/en/latest/contracts.html))

### Finding 4: Events do not affect ERC-165 `interfaceId` computation — safe to declare freely in interfaces

ERC-165 `interfaceId` is computed as the XOR of all function selectors (4-byte keccak256 prefixes of `functionName(paramTypes)` signatures). Events have no selector representation in ERC-165 and are not included in `interfaceId` computation. Freely declaring events in `IClaimsAdjudicator` does not alter the contract's ERC-165 ID or break any ERC-165-dependent tooling. ([Solidity docs](https://docs.soliditylang.org/en/latest/contracts.html); ERC-165 specification)

### Finding 5: The correct cliqueue architecture is split sub-interfaces aggregated by the primary interface

Given that `ClaimSubmitted`, `ClaimAdjudicated`, `PayerClaimRefSet`, and `ClaimPaStatusResolved` are emitted by `ClaimsAdjudicator`, while `StaffingFloorReached` and `AttestorCountChanged` are emitted by `SBTRegistry`, a flat omnibus `IClaimsAdjudicator` event registry mixing both contracts' events would be architecturally incorrect and misleading to Ormi/subgraph developers.

**Recommended architecture (Uniswap v3 pattern):**

```
interfaces/
  IClaimsEvents.sol         ← all ClaimsAdjudicator events only
  ISBTRegistryEvents.sol    ← all SBTRegistry events only (or inline in ISBTRegistry)
  IClaimsAdjudicator.sol    ← is IClaimsEvents + function signatures
  ISBTRegistry.sol          ← is ISBTRegistryEvents + IAccessControl + IERC5484 + typed wrappers
```

`IClaimsEvents` declares:
- `event ClaimSubmitted(bytes32 indexed claimId, bytes32 indexed claimHash, uint8 indexed paStatus, bytes32 paAuthHash)`
- `event ClaimAdjudicated(bytes32 indexed claimId, ...)`
- `event PayerClaimRefSet(bytes32 indexed claimId, bytes32 payerClaimRef)`
- `event ClaimPaStatusResolved(bytes32 indexed claimId, uint8 indexed resolvedStatus, bytes32 paAuthHash)`

`ISBTRegistry` (from prior research, already established) declares:
- `event AttestorCountChanged(bytes32 indexed hospitalId, uint32 newCount, bool isGrant)`
- `event StaffingFloorReached(bytes32 indexed hospitalId, uint32 currentCount)` (if not already in ISBTRegistry)

Ormi subgraph uses **two separate data sources**: one bound to `IClaimsAdjudicator` ABI (for claim lifecycle events), one bound to `ISBTRegistry` ABI (for attestor management events). This matches The Graph's standard multi-contract subgraph manifest pattern.

EigenCloud event design best practices confirm the domain-oriented approach: "Design events around entities/domains rather than a single catch-all list." ([EigenCloud Solidity event design](https://blog.eigencloud.xyz/principles-and-best-practices-to-design-solidity-events-in-ethereum-and-evm/))

### Design implication

`IClaimsAdjudicator` should NOT be a flat omnibus event registry including `SBTRegistry` events. Follow the Uniswap v3 pattern: introduce `IClaimsEvents.sol` declaring only `ClaimsAdjudicator`-emitted events, and have `IClaimsAdjudicator` aggregate it via `is IClaimsEvents`. `StaffingFloorReached` and `AttestorCountChanged` remain in `ISBTRegistry` (confirmed by prior research). Ormi subgraph uses two data sources — no cross-contract event mixing in a single ABI. The compiled ABI of `IClaimsAdjudicator` (not the implementation) is the canonical artifact supplied to the Ormi manifest for claim lifecycle event indexing.

### Open questions generated

1. Should `IClaimsEvents.sol` be published as a standalone npm artifact in `@cliqueue/contracts/interfaces` alongside the full `IClaimsAdjudicator` ABI — so Ormi subgraph developers can import only the events interface without pulling the full contract ABI, and does this create a separate versioning concern?
2. Should the Ormi subgraph manifest specify the `IClaimsAdjudicator` **interface** ABI (minimal, event-focused) or the **implementation** ABI (full, including storage layout artifacts from Foundry) — and does the implementation ABI contain any artifacts that break `graph codegen` type generation?
3. Should `IClaimsEvents` and `ISBTRegistryEvents` be aggregated into a single `ICliqueueEvents.sol` top-level interface used only for documentation/tooling purposes (not imported by contracts) — so hospital integration engineers have a single-file reference for all on-chain events without creating a misleading cross-contract inheritance chain?

---

**See also** — [[../topics/sbt|SBT hub]] · [[../topics/dispute-window|dispute-window hub]] · [[../topics/prior-auth|PA hub]]
