# SBTRegistry `grantRole`/`revokeRole` Override-to-Revert and UUPS Compatibility

## 2026-05-16 — Should `SBTRegistry` override the raw `grantRole(bytes32, address)` / `revokeRole(bytes32, address)` external functions to `revert` unconditionally — forcing all callers through typed `grantAttestorRole` / `revokeAttestorRole` wrappers — and does this create a UUPS upgrade compatibility issue if OZ governance tooling expects the raw `grantRole` interface?

### Background

Prior research established that `SBTRegistry` must expose typed wrappers (`grantAttestorRole(bytes32 hospitalId, address attestor)` / `revokeAttestorRole(bytes32 hospitalId, address attestor)`) where the `_attestorCount[hospitalId]` floor check and counter update live. The open question is whether the inherited `grantRole(bytes32, address)` external function — which bypasses the counter logic — must be disabled by overriding it to `revert`, and whether that override breaks UUPS upgrades or OZ governance tooling.

---

### Finding 1: Override-to-revert on `grantRole` is an established, OZ-sanctioned pattern

OpenZeppelin's own `AccessControlDefaultAdminRules` extension (introduced in OZ Contracts 4.x, current in 5.x) overrides `grantRole` and `revokeRole` to revert for the `DEFAULT_ADMIN_ROLE`:

```solidity
// AccessControlDefaultAdminRules.sol (OZ canonical)
function grantRole(bytes32 role, address account) public virtual override {
    if (role == DEFAULT_ADMIN_ROLE) {
        revert("can't directly grant default admin role");
    }
    super.grantRole(role, account);
}
```

This pattern is confirmed in OZ documentation as acceptable: "You can change AccessControl so that `revokeRole` can no longer be called using overrides, where any calls to it will immediately revert." ([OpenZeppelin Extending Contracts docs](https://docs.openzeppelin.com/contracts/5.x/extending-contracts); [AccessControl.sol master](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/AccessControl.sol))

`SBTRegistry` should apply the same pattern unconditionally to all attestor roles:

```solidity
function grantRole(bytes32 /*role*/, address /*account*/)
    public
    virtual
    override
{
    revert("SBTRegistry: use grantAttestorRole");
}

function revokeRole(bytes32 /*role*/, address /*account*/)
    public
    virtual
    override
{
    revert("SBTRegistry: use revokeAttestorRole");
}
```

---

### Finding 2: UUPS upgrade path is completely unaffected

The UUPS upgrade mechanism lives in `_authorizeUpgrade(address newImplementation)`, not in `grantRole`. The `upgradeToAndCall(address newImpl, bytes calldata data)` function on the proxy calls `_authorizeUpgrade` on the implementation — it does NOT call `grantRole`. Overriding `grantRole` to `revert` has zero effect on the UUPS upgrade path. ([UUPSUpgradeable.sol master](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/utils/UUPSUpgradeable.sol); [RareSkills UUPS explainer](https://rareskills.io/post/uups-proxy))

The `_authorizeUpgrade` function is overridden in `SBTRegistry` with `onlyRole(DEFAULT_ADMIN_ROLE)` — which remains fully functional through `_grantRole` and the constructor/initializer, where `grantRole` is not invoked.

---

### Finding 3: `IAccessControl` ERC-165 compatibility — the "interface surprise" risk

`SBTRegistry` inherits from `AccessControl`, which reports `supportsInterface(type(IAccessControl).interfaceId) == true`. The `IAccessControl` interface declares `grantRole(bytes32, address) external`. If `SBTRegistry` reverts on `grantRole`, it technically breaks the `IAccessControl` behavioral contract while still returning `true` for `supportsInterface`.

This creates an "ABI surprise": off-chain tooling that calls `grantRole` via the `IAccessControl` selector will get a runtime revert rather than a deployment-time type error. This is intentional — it is the same trade-off OZ accepts in `AccessControlDefaultAdminRules`. The contract is still compliant with `IAccessControl` at the type/selector level; the revert is a domain-specific policy guard.

**Mitigation**: Use a descriptive revert string (`"SBTRegistry: use grantAttestorRole"`) and document in NatSpec `@notice` that raw `grantRole` is disabled. ([OZ AccessControlDefaultAdminRules.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/extensions/AccessControlDefaultAdminRules.sol))

---

### Finding 4: Gnosis Safe and TimelockController can call typed wrappers natively

- **Gnosis Safe Transaction Builder** supports encoding any function call from a custom ABI, including non-standard typed functions like `grantAttestorRole(bytes32, address)`. Hospital admin multisigs can submit encoded `grantAttestorRole` calls via Safe UI without any modification. ([Safe Transaction Builder](https://github.com/gnosis/safe-react-apps/issues/214))
- **OpenZeppelin Defender** also supports encoding arbitrary function calls on any contract. ([OZ Defender guide](https://docs.openzeppelin.com/defender/guide/timelock-roles))
- **TimelockController** schedules arbitrary calldata: `timelock.schedule(target, 0, abi.encodeCall(SBTRegistry.grantAttestorRole, (hospitalId, attestor)), ...)`. The timelock does not need `grantRole` specifically — it encodes whatever calldata is passed. ([OZ Timelock Roles guide](https://docs.openzeppelin.com/defender/guide/timelock-roles))
- **Tally** (governor + timelock UI) encodes proposal actions as arbitrary calldata. It does not require `grantRole` specifically — it uses the target contract's ABI. Typed wrapper functions are supported. ([OZ Governance guide](https://docs.openzeppelin.com/contracts/4.x/governance))

**Conclusion: no governance tooling requires raw `grantRole` to be callable. All mainstream tools (Safe, Tally, Defender, ethers.js) support typed custom ABIs.**

---

### Finding 5: UUPS initializer and DEFAULT_ADMIN_ROLE setup — not affected

The UUPS `initialize()` function must set up `DEFAULT_ADMIN_ROLE` for the governance multisig. This is done via `_grantRole(DEFAULT_ADMIN_ROLE, multisig)` — the *internal* `_grantRole` function, which bypasses the public `grantRole` override. The override-to-revert only applies to the external `grantRole` function. Internal `_grantRole` remains unconstrained and is used legitimately in the initializer. ([AccessControl.sol v5.0.0](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/access/AccessControl.sol))

---

### Finding 6: `renounceRole` also needs consideration

`AccessControl` exposes a third mutating function: `renounceRole(bytes32 role, address callerConfirmation)`. This allows a role holder to voluntarily renounce their own role. For `SBTRegistry`, allowing attestors to self-renounce could bypass the `_attestorCount` floor check. `renounceRole` should also be overridden to `revert` and replaced with a typed `renounceAttestorRole(bytes32 hospitalId)` that enforces the floor before delegating to `_revokeRole`. ([AccessControl.sol renounceRole](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/AccessControl.sol))

---

### Summary: recommended override pattern

```solidity
// Disable all raw OZ role mutation entry points
function grantRole(bytes32, address) public virtual override {
    revert("SBTRegistry: use grantAttestorRole");
}

function revokeRole(bytes32, address) public virtual override {
    revert("SBTRegistry: use revokeAttestorRole");
}

function renounceRole(bytes32, address) public virtual override {
    revert("SBTRegistry: use renounceAttestorRole");
}

// Typed entry points that maintain counter integrity
function grantAttestorRole(bytes32 hospitalId, address attestor)
    external
    onlyRole(HOSPITAL_ADMIN_ROLE)
{
    bytes32 role = keccak256(abi.encode("ATTESTOR_ROLE", hospitalId));
    _grantRole(role, attestor);          // internal, bypasses override
    _attestorCount[hospitalId]++;
}

function revokeAttestorRole(bytes32 hospitalId, address attestor)
    external
    onlyRole(HOSPITAL_ADMIN_ROLE)
{
    require(_attestorCount[hospitalId] > MIN_ATTESTERS_FLOOR, "floor breach");
    bytes32 role = keccak256(abi.encode("ATTESTOR_ROLE", hospitalId));
    _revokeRole(role, attestor);
    _attestorCount[hospitalId]--;
}

function renounceAttestorRole(bytes32 hospitalId)
    external
{
    require(_attestorCount[hospitalId] > MIN_ATTESTERS_FLOOR, "floor breach");
    bytes32 role = keccak256(abi.encode("ATTESTOR_ROLE", hospitalId));
    _revokeRole(role, msg.sender);
    _attestorCount[hospitalId]--;
}
```

UUPS compatibility is fully preserved — `_authorizeUpgrade` and `_grantRole` (internal) are unaffected by the public overrides. This pattern is the structural equivalent of `AccessControlDefaultAdminRules` applied at the attestor-role layer.

---

**Design implication:** `SBTRegistry` must override `grantRole`, `revokeRole`, and `renounceRole` (all three public OZ AccessControl mutation entry points) to `revert` with a descriptive error string, forcing all callers through typed domain-specific wrappers. This does not break UUPS upgrades, Gnosis Safe, Tally, TimelockController, or Defender — all of which support arbitrary calldata encoding against a provided ABI. The UUPS `initialize()` and `_authorizeUpgrade` functions use the internal `_grantRole` path and are unaffected. The `renounceRole` vector is the most commonly overlooked — it must also be disabled to prevent an attestor from self-removing below the floor.

**Open questions generated:**
1. Should `SBTRegistry` emit a dedicated `AttestorCountChanged(bytes32 indexed hospitalId, uint32 newCount, bool isGrant)` event at the public wrapper layer (not inside `_grantRole`) — so Ormi indexers receive both the count change and the `hospitalId` in a single authoritative event, without needing to reconstruct `hospitalId` from the `RoleGranted` event's role hash?
2. Should the `renounceAttestorRole` wrapper require the caller to also hold `HOSPITAL_ADMIN_ROLE` (preventing unilateral self-removal without admin approval) — or should self-renounce remain permissionless (as in OZ base AccessControl) subject only to the floor check?
3. Should the typed wrapper functions (`grantAttestorRole`, `revokeAttestorRole`, `renounceAttestorRole`) be published as a standalone `ISBTRegistry` interface in the cliqueue spec — so hospital integration engineers, Gnosis Safe Transaction Builder users, and Tally proposal authors all have a canonical ABI to import without coupling to the full contract?

---

**See also** — [[../topics/sbt|SBT hub]] · [[../topics/upgradeable-proxy|upgradeable-proxy hub]]
