# SBTRegistry `renounceAttestorRole` — Admin Co-Signature vs. Permissionless Floor-Guarded Self-Renounce

## 2026-05-16 — Should `renounceAttestorRole(bytes32 hospitalId)` require `HOSPITAL_ADMIN_ROLE` co-signature (preventing unilateral self-removal without admin approval) or remain permissionless (floor-guarded only) — and does admin co-signature create a liveness risk?

### Background

Prior research established that `SBTRegistry` must override raw `renounceRole` to revert and expose a typed `renounceAttestorRole(bytes32 hospitalId)` wrapper. The open question is the authorization policy on that wrapper: should it require the caller to also hold `HOSPITAL_ADMIN_ROLE` (two-party co-authorization) or be callable by any active attestor subject only to the `_attestorCount` floor check?

---

### Finding 1: No OZ canonical precedent for co-signature on non-admin role renunciation

OpenZeppelin's `AccessControl.renounceRole` is unconditionally permissionless for the role holder — the only constraint is `msg.sender == callerConfirmation` (self-revoke only). The sole OZ pattern that adds a delay/two-step requirement to renunciation is `AccessControlDefaultAdminRules.renounceRole`, which applies **only to the singleton DEFAULT_ADMIN_ROLE**. The two-step renounce in DefaultAdminRules exists because DEFAULT_ADMIN_ROLE is the single most-privileged role (losing it accidentally is catastrophic and irreversible). No OZ module adds admin co-signature for any other role. ([OZ AccessControl docs v5.x](https://docs.openzeppelin.com/contracts/5.x/access-control); [OZ AccessControlDefaultAdminRules.sol master](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/extensions/AccessControlDefaultAdminRules.sol))

The attestor role is the opposite of the admin role in terms of renunciation risk: a coder leaving the hospital **wants** to remove themselves. Blocking that is a failure mode, not a safety property.

---

### Finding 2: Admin co-signature on self-renounce creates a documented liveness risk

Trail of Bits' June 2025 article "Maturing Your Smart Contracts Beyond Private Key Risk" documents admin-key unavailability as a primary operational liveness risk pattern. When a co-signature threshold cannot be met (multisig quorum unreachable), any function gated behind that threshold becomes stuck. For `renounceAttestorRole`, the failure mode is:

1. A coder leaves the hospital (voluntarily or terminates).
2. Hospital calls `revokeAttestorRole` — correct path. But if the admin multisig has quorum issues (key rotation in progress, signers on vacation), `revokeAttestorRole` is also blocked.
3. With admin co-signature on self-renounce, the departing coder's own `renounceAttestorRole` call would also be blocked.
4. The stale attestor credential remains active — the **opposite** of the intended security property.

This is a **denial of renunciation** vector: the admin key holder (or their multisig) can block a departed coder from self-removing by being unresponsive. This is a trust inversion: requiring admin permission for a coder to *leave* a role is logically backwards.

([Trail of Bits: Maturing Smart Contracts Beyond Private Key Risk, June 2025](https://blog.trailofbits.com/2025/06/25/maturing-your-smart-contracts-beyond-private-key-risk/); [OWASP Smart Contract Top 10 2026](https://scs.owasp.org/sctop10/))

---

### Finding 3: HIPAA §164.308 requires *prompt* access revocation — admin co-signature delay is a compliance risk

HIPAA Security Rule 45 CFR §164.308(a)(3)(ii)(C) requires covered entities to implement termination procedures for revoking workforce member access. ProviderTrust and HIPAA compliance guidance (2025–2026) state:

- Voluntary departures: access revoked at end of last working day.
- Involuntary terminations: access revoked immediately at time of notice.

If `renounceAttestorRole` requires admin co-signature, and the admin multisig requires 3-of-5 quorum with potential multi-hour or multi-day lag, cliqueue's on-chain revocation path for involuntary terminations cannot guarantee the "immediately" standard. The permissionless self-renounce path is the **faster** revocation path — the departing attestor can self-remove in a single transaction. Admin-initiated `revokeAttestorRole` remains the primary path for involuntary terminations, but permissionless self-renounce provides a secondary fallback that keeps cliqueue's credential lifecycle compliant with HIPAA separation timing.

([HIPAA Security Rule 45 CFR §164.308](https://www.law.cornell.edu/cfr/text/45/164.308); [ProviderTrust JCAHO compliance guide](https://www.providertrust.com/blog/joint-commission-compliance-healthcare-licenses-credentials/))

---

### Finding 4: The floor check alone is a sufficient defense against the one real attack vector

The only dangerous outcome of permissionless self-renounce is dropping the attestor count below `MIN_ATTESTERS_FLOOR`. The guard `require(_attestorCount[hospitalId] > MIN_ATTESTERS_FLOOR, "floor breach")` prevents this unconditionally. If the count is at floor, the call reverts regardless of who is calling. This is identical to the Gnosis Safe "requires N signers" model: you cannot reduce the count below the configured minimum.

The co-signature requirement is therefore **redundant** as a floor protection mechanism and **harmful** as a liveness property: it adds admin dependency without adding any protection the floor check does not already provide.

---

### Finding 5: Admin co-signature would complicate the `ISBTRegistry` interface spec and downstream tooling

`ISBTRegistry` declares `renounceAttestorRole(bytes32 hospitalId) external` — a single-party call. Adding admin co-signature would require either:
- A two-step pattern (attestor proposes, admin countersigns) — requiring two new interface functions and a pending-renounce mapping.
- A delegated call model (attestor signs off-chain, admin submits on-chain) — complex and inconsistent with OZ patterns.

Neither pattern is warranted given the floor check already handles the one real security concern. The `ISBTRegistry` interface should remain minimal. ([OZ IGovernor.sol precedent for minimal interfaces](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/IGovernor.sol))

---

### Finding 6: Voluntary departure is the minority case; admin `revokeAttestorRole` is the primary revocation path

In practice, hospital HIM departments initiate role removal on departure, not the departing coder. The `revokeAttestorRole(bytes32 hospitalId, address attestor)` path (admin-initiated) is the primary operational flow. `renounceAttestorRole` is a fallback for:

- Attestors who detect their own credential is compromised and want to self-revoke before the admin can act.
- Edge cases where the admin multisig is unavailable and a coder needs to self-remove urgently.

Both of these scenarios benefit from permissionless self-renounce. Blocking the compromise-recovery path with admin co-signature is a security regression.

---

### Summary: recommended design

```solidity
/// @notice Permissionless self-renounce. Floor check prevents breach.
/// @dev msg.sender must be an active attestor for hospitalId.
///      If attestorCount == MIN_ATTESTERS_FLOOR, reverts — use revokeAttestorRole first.
function renounceAttestorRole(bytes32 hospitalId)
    external
{
    bytes32 role = keccak256(abi.encode("ATTESTOR_ROLE", hospitalId));
    require(hasRole(role, msg.sender), "SBTRegistry: caller is not attestor for hospital");
    require(_attestorCount[hospitalId] > MIN_ATTESTERS_FLOOR, "SBTRegistry: would breach floor");
    _revokeRole(role, msg.sender);
    _attestorCount[hospitalId]--;
    emit AttestorCountChanged(hospitalId, _attestorCount[hospitalId], false);
}
```

**No admin co-signature. No two-step delay. Floor check only.**

The `hasRole` check prevents non-attestors from calling. The floor check prevents breaching the minimum. The event emission feeds Ormi indexers. This is the minimal, correct design.

---

**Design implication:** `renounceAttestorRole` must remain permissionless (no `HOSPITAL_ADMIN_ROLE` requirement) with floor-guard only. Admin co-signature would create a trust-inversion liveness risk, complicate the `ISBTRegistry` interface, and potentially violate HIPAA §164.308(a)(3)(ii)(C)'s prompt-termination requirement for involuntary separations. The `_attestorCount[hospitalId] > MIN_ATTESTERS_FLOOR` floor guard is the sole and sufficient protection against the one real attack vector (driving count below minimum).

**Open questions generated:**
1. Should `renounceAttestorRole` emit `StaffingFloorReached(bytes32 hospitalId, uint32 currentCount)` when the post-renounce count equals exactly `MIN_ATTESTERS_FLOOR` — so hospital monitoring systems get an automatic alert that the next renounce would revert?
2. Should the `ISBTRegistry` NatSpec for `renounceAttestorRole` explicitly document that no admin co-signature is required — so hospital security officers do not misread the ABI and assume admin approval is enforced?
3. Should cliqueue's hospital BAA include a "Voluntary Attestor Exit Protocol" section specifying that departing coders must either self-renounce via `renounceAttestorRole` or that hospital admin must execute `revokeAttestorRole` within one business day of separation — creating a contractual obligation that mirrors the HIPAA §164.308 termination procedure requirement?

---

**See also** — [[../topics/sbt|SBT hub]]
