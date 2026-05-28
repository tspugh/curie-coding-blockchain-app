# ISBTRegistry Typed Interface Design and GENIUS Act DLP Exclusion

## 2026-05-16 — Should the typed wrapper functions (grantAttestorRole, revokeAttestorRole, renounceAttestorRole) be published as a standalone ISBTRegistry typed interface — what should it declare, how does it compose with IERC5484 and IAccessControl, should AttestorCountChanged be an interface event, and does publishing a public interface contribute to the GENIUS Act DLP exclusion?

### Finding 1: IERC5484 declares one event, one enum, one view function — ISBTRegistry should extend it

The full `IERC5484` interface (ERC-165 ID: `0x0489b56f`) declares:

```solidity
enum BurnAuth { IssuerOnly, OwnerOnly, Both, Neither }

event Issued(
    address indexed from,
    address indexed to,
    uint256 indexed tokenId,
    BurnAuth burnAuth
);

function burnAuth(uint256 tokenId) external view returns (BurnAuth);
```

([EIP-5484 specification](https://eips.ethereum.org/EIPS/eip-5484))

`IERC5484` does **not** extend `IAccessControl` — they are orthogonal. `ISBTRegistry` should extend both:

```solidity
interface ISBTRegistry is IAccessControl, IERC5484 {
    // domain-specific additions
}
```

This is valid Solidity — interfaces can extend multiple interfaces using `is`. Functions inherited from `IAccessControl` (including `grantRole`, `revokeRole`, `renounceRole`) are part of `ISBTRegistry`'s ABI, but `SBTRegistry` overrides them to `revert` — which is an OZ-sanctioned behavioral override (confirmed in prior research). No `override` keyword is needed in the interface itself; interface functions are implicitly virtual.

---

### Finding 2: IGovernor precedent — all core lifecycle events belong in the interface

OpenZeppelin's `IGovernor` interface declares **all 6 core governance events** (`ProposalCreated`, `ProposalQueued`, `ProposalExecuted`, `ProposalCanceled`, `VoteCast`, `VoteCastWithParams`) at the interface level — not deferred to the concrete `Governor.sol`. ([OZ IGovernor.sol master](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/IGovernor.sol))

Similarly, `IAccessControl` declares all 3 role lifecycle events (`RoleAdminChanged`, `RoleGranted`, `RoleRevoked`) in the interface. ([OZ IAccessControl.sol master](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/IAccessControl.sol))

The OZ canonical pattern: **events that represent domain-significant state transitions belong in the interface**. Indexers, monitoring systems, and integration engineers should be able to subscribe to events using only the interface ABI — without the concrete contract.

**Conclusion: `AttestorCountChanged(bytes32 indexed hospitalId, uint32 newCount, bool isGrant)` must be declared in `ISBTRegistry`**, not only in the concrete `SBTRegistry` contract. Ormi subgraph subscriptions, hospital monitoring dashboards, and `ClaimsAdjudicator`'s floor-check audit trail all need this event and should bind to the interface ABI.

---

### Finding 3: getAttestorCount view function should be in ISBTRegistry — enables ClaimsAdjudicator decoupling

`ClaimsAdjudicator` must check `_attestorCount[hospitalId] >= MIN_ATTESTERS_FLOOR` at claim submission. If `ClaimsAdjudicator` imports `ISBTRegistry` and calls `getAttestorCount(bytes32 hospitalId)`, it can verify the floor without importing the concrete `SBTRegistry` implementation. This supports future `SBTRegistry` upgrades (new implementation behind UUPS proxy) without redeploying `ClaimsAdjudicator` — as long as the `ISBTRegistry` ABI is stable.

```solidity
interface ISBTRegistry is IAccessControl, IERC5484 {
    event AttestorCountChanged(
        bytes32 indexed hospitalId,
        uint32 newCount,
        bool isGrant
    );

    function grantAttestorRole(bytes32 hospitalId, address attestor) external;
    function revokeAttestorRole(bytes32 hospitalId, address attestor) external;
    function renounceAttestorRole(bytes32 hospitalId) external;
    function getAttestorCount(bytes32 hospitalId) external view returns (uint32);
    function getAttestorFloor() external view returns (uint32);
}
```

`ClaimsAdjudicator` stores `ISBTRegistry public sbtRegistry` (address set at initialisation), calls `sbtRegistry.getAttestorCount(hospitalId)`, and never imports `SBTRegistry` directly. This is the OZ Governor → IGovernor coupling pattern applied to the SBTRegistry layer.

---

### Finding 4: GENIUS Act DLP exclusion — publishing a verified ISBTRegistry contributes to "publicly available and accessible" requirement

GENIUS Act Section 2 defines "distributed ledger protocol" as: **"publicly available and accessible executable software deployed to a distributed ledger, including smart contracts or networks of smart contracts."** ([Federal Register FDIC NPRM April 2026](https://www.federalregister.gov/documents/2026/04/10/2026-06974/genius-act-requirements-and-standards-for-fdic-supervised-permitted-payment-stablecoin-issuers-and); [FDIC Federal Register notice](https://www.fdic.gov/board/federal-register-notice-genius-act-requirements-and-standards-fdic-supervised-permitted))

The DLP exclusion from the DASP definition covers entities "per se a distributed ledger protocol" and those "developing, operating or validating transactions on a distributed ledger." ([Gibson Dunn GENIUS Act analysis](https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/))

**No law firm has published an analysis specifically addressing whether publishing a Solidity interface or TypeScript ABI on GitHub satisfies "publicly available and accessible."** This is a gap in the published literature (weakly-sourced claim: the block explorer verification requirement is an inference, not a published opinion). The closest established practice is source code verification on the block explorer — Somnia's block explorer displaying the verified `SBTRegistry` and `ISBTRegistry` Solidity source files is the strongest available signal that the software is "publicly available and accessible executable software."

**Design implication for the DLP analysis:** Publishing `ISBTRegistry` as a verified Solidity interface on Somnia's block explorer, alongside `SBTRegistry`'s verified implementation, strengthens the "publicly available and accessible" characterization. cliqueue's existing prior research recommendation (outside counsel legal opinion letter on DLP exclusion) should specifically note that source code verification on Somnia's block explorer is the primary satisfying mechanism, and that `ISBTRegistry` publication is a supporting artifact — not the primary basis.

---

### Summary: recommended ISBTRegistry interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC5484} from "./IERC5484.sol";

/// @title ISBTRegistry — typed interface for cliqueue's SoulBound Token attestor registry
/// @notice Raw grantRole/revokeRole/renounceRole from IAccessControl are overridden to revert
///         in SBTRegistry. Use the typed wrappers below.
interface ISBTRegistry is IAccessControl, IERC5484 {
    /// @notice Emitted on every attestorCount change. hospitalId is indexed for Ormi filtering.
    event AttestorCountChanged(
        bytes32 indexed hospitalId,
        uint32 newCount,
        bool isGrant
    );

    function grantAttestorRole(bytes32 hospitalId, address attestor) external;
    function revokeAttestorRole(bytes32 hospitalId, address attestor) external;
    function renounceAttestorRole(bytes32 hospitalId) external;

    /// @notice O(1) attestor floor check. ClaimsAdjudicator calls this without importing SBTRegistry.
    function getAttestorCount(bytes32 hospitalId) external view returns (uint32);

    /// @notice Returns MIN_ATTESTERS_FLOOR (immutable). Allows ClaimsAdjudicator to read floor
    ///         from registry rather than hard-coding it.
    function getAttestorFloor() external view returns (uint32);
}
```

---

**Design implication:** `ISBTRegistry` must extend both `IAccessControl` and `IERC5484`, declare `AttestorCountChanged` as an interface-level event (following IGovernor precedent), and expose `getAttestorCount` + `getAttestorFloor` view functions. `ClaimsAdjudicator` imports `ISBTRegistry` only — not `SBTRegistry` — enabling future SBTRegistry UUPS upgrades without `ClaimsAdjudicator` redeployment. Publishing verified `ISBTRegistry` on Somnia's block explorer contributes to the GENIUS Act DLP "publicly available and accessible" characterization, though no law firm has published analysis of this specific artifact's contribution.

**Open questions generated:**
1. Should `renounceAttestorRole(bytes32 hospitalId)` require `HOSPITAL_ADMIN_ROLE` (preventing unilateral self-removal without admin co-signature) or remain permissionless (subject only to the floor check) — and does requiring admin co-signature create a liveness risk if the admin key is unavailable?
2. Should `getAttestorFloor()` return a network-wide `uint32` or a per-hospital `uint32` — and if floor is ever made per-hospital (for critical-access hospital carve-outs), does `ISBTRegistry` need a `getAttestorFloor(bytes32 hospitalId)` overload?
3. Should cliqueue's outside counsel DLP opinion letter specifically analyze the block explorer source code verification step as the primary "publicly available and accessible" satisfying mechanism — and commit to a statement that an unverified (private) implementation contract would break the DLP characterization?

---

**See also** — [[../topics/sbt|SBT hub]] · [[../topics/settlement-stablecoin|settlement hub]] · [[../topics/upgradeable-proxy|upgradeable-proxy hub]]
