# SBTRegistry `_attestorCount` Mapping Key: `bytes32 hospitalId` vs. `address hospitalAdmin`

## 2026-05-16 — Should the `_attestorCount` mapping key be `bytes32 hospitalId` (consistent with `CLIQUEUE_DOMAIN_SEPARATOR`) or `address hospitalAdmin` — and does mixing key types between `AccessControl` role hashes and the counter mapping create a key-derivation footgun?

### Background

The prior research iteration established that `SBTRegistry` should use base `AccessControl` (not `AccessControlEnumerable`) and maintain an explicit `mapping(bytes32 => uint32) private _attestorCount` incremented/decremented in `_grantRole`/`_revokeRole` overrides. The open question is what key type that mapping should use, and whether a key-type mismatch between the AccessControl role hash system and the counter mapping introduces a silent bug.

---

### How AccessControl role hashes work in a per-hospital scoping pattern

OpenZeppelin `AccessControl` stores roles in `mapping(bytes32 role => RoleData)`. For a network-scoped `SBTRegistry` that must track attestors per hospital, a per-hospital role is derived dynamically:

```solidity
bytes32 attestorRole = keccak256(abi.encode("ATTESTOR_ROLE", hospitalId));
```

This is the standard OZ pattern for scoped roles (confirmed in OZ docs and community usage: [OZ AccessControl](https://docs.openzeppelin.com/contracts/5.x/access-control), [OZ Forum: dynamic role creation](https://forum.openzeppelin.com/t/can-i-dynamic-create-role-with-openzeppelin-access-control/34427)). The `bytes32 role` that `grantRole(role, account)` accepts IS the combined scoped hash — not the raw `hospitalId`.

`_grantRole(bytes32 role, address account)` is the internal function that AccessControl calls. When overriding it to update `_attestorCount`, **the override receives the role hash (`keccak256(abi.encode("ATTESTOR_ROLE", hospitalId))`), not the raw `hospitalId`**. Since `keccak256` is a one-way function, `hospitalId` cannot be recovered from the role hash alone.

This means the `_attestorCount` mapping **cannot be keyed by a value derived from the role parameter alone** without storing a separate `(roleHash → hospitalId)` reverse mapping — which adds storage cost and complexity.

---

### The key-type footgun: what goes wrong with `address hospitalAdmin`

Keying `_attestorCount` by `address hospitalAdmin` (the account with `HOSPITAL_ADMIN_ROLE`) fails for two structural reasons:

1. **The `_grantRole` / `_revokeRole` override receives `(bytes32 role, address account)`** where `account` is the **attestor** being added, not the hospital admin. The hospital admin's address is in `msg.sender` at the `grantRole()` call site, but it is not available inside `_grantRole()` without re-engineering the call chain or using `_msgSender()` defensively — which is an anti-pattern inside `_grantRole`.

2. **Multiple admins per hospital**: A hospital may have multiple `HOSPITAL_ADMIN_ROLE` holders. Keying the counter by admin address creates N separate counter slots (one per admin address) rather than one counter slot per hospital. An admin calling `grantRole` on behalf of the hospital increments only their own counter slot, leaving the other slots stale. The floor check becomes unreliable.

**Verdict: `address hospitalAdmin` is architecturally wrong as the counter key.**

---

### Why `bytes32 hospitalId` is the correct key — and why the override must accept it explicitly

The correct pattern requires passing `hospitalId` explicitly alongside the role hash:

```solidity
// Public entry point — hospital admin calls this
function grantAttestorRole(bytes32 hospitalId, address attestor) external onlyRole(HOSPITAL_ADMIN_ROLE) {
    bytes32 role = keccak256(abi.encode("ATTESTOR_ROLE", hospitalId));
    _grantRole(role, attestor);
    _attestorCount[hospitalId]++;
}

function revokeAttestorRole(bytes32 hospitalId, address attestor) external onlyRole(HOSPITAL_ADMIN_ROLE) {
    require(_attestorCount[hospitalId] > MIN_ATTESTERS_FLOOR, "would breach floor");
    bytes32 role = keccak256(abi.encode("ATTESTOR_ROLE", hospitalId));
    _revokeRole(role, attestor);
    _attestorCount[hospitalId]--;
}
```

Here the counter update and floor enforcement happen at the **public function layer** (not inside the `_grantRole` override), where `hospitalId` is available as an explicit parameter. The `_grantRole` override itself stays clean.

Key properties of this design:
- `_attestorCount[hospitalId]` is keyed by the same `bytes32 hospitalId` used in `keccak256(abi.encode("ATTESTOR_ROLE", hospitalId))` — same domain identifier, consistent key namespace
- No key-type mismatch
- No reverse mapping required
- Floor enforcement happens before `_revokeRole` is called — the Gnosis Safe pattern ([Safe OwnerManager.sol removeOwner](https://docs.safe.global/reference-smart-account/owners/removeOwner))
- `grantRole(bytes32,address)` and `revokeRole(bytes32,address)` (the external OZ functions) are NOT used directly by hospital admins — they call the domain-specific `grantAttestorRole` / `revokeAttestorRole` wrappers instead

---

### `abi.encode` vs. `abi.encodePacked` for role hash derivation — confirmed collision risk

**`abi.encodePacked` must NOT be used** for the role hash derivation when combining two variable-length or same-type arguments. Nethermind's 2024 security analysis ([Understanding Hash Collisions: abi.encodePacked in Solidity](https://www.nethermind.io/blog/understanding-hash-collisions-abi-encodepacked-in-solidity)) and the Smart Contract Security Field Guide ([ABI Hash Collisions](https://scsfg.io/hackers/abi-hash-collisions/)) both confirm:

> `abi.encodePacked("a", "bc") == abi.encodePacked("ab", "c")`

If `keccak256(abi.encodePacked("ATTESTOR_ROLE", hospitalId))` were used, a malicious `hospitalId` value (bytes32, fixed-length) would not collide with a string prefix — but the pattern is still non-standard for multi-argument role derivation and has been flagged in 2024 audit findings as a latent risk ([Sherlock 2024-10-debita #906](https://github.com/sherlock-audit/2024-10-debita-judging/issues/906)).

**The safe and auditor-approved form is `keccak256(abi.encode("ATTESTOR_ROLE", hospitalId))`** — `abi.encode` pads each argument to 32 bytes, creating unambiguous boundaries. This is confirmed as the recommended form by Solidity docs ([ABI spec](https://docs.soliditylang.org/en/latest/abi-spec.html)) and OZ's own role-hash convention.

For the `hospitalId` derivation itself, the existing design uses:
```solidity
hospitalId = keccak256(abi.encodePacked(npi, CLIQUEUE_DOMAIN_SEPARATOR))
```
This is safe because `npi` (uint256, fixed-length) and `CLIQUEUE_DOMAIN_SEPARATOR` (bytes32, fixed-length) have unambiguous boundaries — `abi.encodePacked` is safe when all arguments are fixed-length types. ([SBT hospitalId NPI HIPAA analysis](docs/research/somnia/sbt-hospitalid-npi-hash-hipaa-disclosure.md))

---

### Gas implications of `bytes32` key on Somnia IceDB

- A `mapping(bytes32 => uint32)` slot is stored at `keccak256(abi.encode(hospitalId, mappingSlot))` — standard EVM mapping layout. On Somnia, this is a single slot read (cold or warm).
- Mapping lookup for a `bytes32` key is identical in EVM gas mechanics to a `uint256` key — the slot derivation is always one keccak256 operation at the compiler level (zero EVM gas; keccak256 of pointer is done off-chain by the compiler, not at runtime).
- No gas difference between `bytes32` key and `address` key for mapping SLOAD — both are value types padded to 32 bytes in the EVM.

---

### Summary: confirmed key-type recommendation

| Key type | Verdict | Reason |
|---|---|---|
| `bytes32 hospitalId` | **Correct** | Same identifier used in role derivation; available at the public function layer; no reverse mapping needed; consistent with `CLIQUEUE_DOMAIN_SEPARATOR` pattern |
| `address hospitalAdmin` | **Wrong** | Not available inside `_grantRole` override; breaks with multiple admins; conceptually wrong grouping unit |
| `bytes32 roleHash` | **Wrong** | Can't derive `hospitalId` from role hash (one-way); would need separate reverse mapping |

**Use `grantAttestorRole(bytes32 hospitalId, address attestor)` and `revokeAttestorRole(bytes32 hospitalId, address attestor)` as the domain-specific entry points** rather than exposing raw `grantRole`/`revokeRole`. Counter update and floor check live at this layer where `hospitalId` is known. `_grantRole`/`_revokeRole` overrides stay clean.

---

**Design implication:** The `_attestorCount` mapping key must be `bytes32 hospitalId` — the same identifier used in `keccak256(abi.encode("ATTESTOR_ROLE", hospitalId))`. The counter update and floor enforcement happen in typed public wrapper functions (`grantAttestorRole` / `revokeAttestorRole`) where `hospitalId` is an explicit parameter, not inside the `_grantRole` / `_revokeRole` overrides. Using `abi.encode` (not `abi.encodePacked`) for role hash derivation eliminates the collision footgun. No gas penalty for `bytes32` key vs. `address` key on Somnia IceDB. Raw `grantRole(bytes32,address)` must be overridden to revert (`revert("use grantAttestorRole")`) so hospital admins cannot bypass the counter logic by calling the OZ base function directly.

**Open questions generated:**
1. Should `SBTRegistry` override the raw `grantRole(bytes32, address)` / `revokeRole(bytes32, address)` external functions to `revert` unconditionally — forcing all callers through the typed `grantAttestorRole` / `revokeAttestorRole` wrappers — and does this create a UUPS upgrade compatibility issue if OZ governance tooling expects the raw `grantRole` interface?
2. Should `SBTRegistry` emit a dedicated `AttestorCountChanged(bytes32 indexed hospitalId, uint32 newCount, bool isGrant)` event at the public wrapper layer (not inside `_grantRole`) — so Ormi indexers receive both the count change and the `hospitalId` in a single authoritative event, without needing to reconstruct `hospitalId` from the role hash in `RoleGranted`?
3. At what credential-change frequency per hospital per month does the `_attestorCount[hospitalId]` slot reliably stay warm in Somnia's 128M LRU IceDB cache — and should the deployment runbook include a monthly "attestor ping" (a no-op read of `_attestorCount[hospitalId]`) to prevent cold-SLOAD at claim submission time?

---

**See also** — [[../topics/sbt|SBT hub]]
