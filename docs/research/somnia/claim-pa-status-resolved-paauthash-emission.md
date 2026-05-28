## 2026-05-17 — ClaimPaStatusResolved paAuthHash emission: Compound Timelock pattern confirms repeat-context; +5,120 gas; conditional-zero NatSpec guard required

**Question answered:** Should `ClaimPaStatusResolved` emit `paAuthHash` as a non-indexed `bytes32` data field when `resolvedStatus = 0x02 (satisfied)` — adding 32 bytes and 5,120 gas — so the authorization number commitment is auditable in the resolution event itself rather than requiring auditors to correlate across `ClaimSubmitted`?

**Key findings:**

- **The Compound Timelock canonical pattern confirms: resolution events SHOULD repeat creation-event context.** In `Timelock.sol`, both `QueueTransaction` and `ExecuteTransaction` carry identical field sets `(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint eta)` — the same payload is repeated in both the creation and resolution events, even though the `txHash` already links them. This is the most widely cited smart contract governance pattern for audit-trail completeness. ([Compound Timelock.sol](https://github.com/compound-finance/compound-protocol/blob/master/contracts/Timelock.sol))

- **OZ Governor uses the OPPOSITE pattern for lifecycle events.** `ProposalCreated` carries the full payload (9 fields); `ProposalQueued(uint256 proposalId, uint256 etaSeconds)` and `ProposalExecuted(uint256 proposalId)` carry only the ID and a minimal status field. Off-chain consumers reconstruct context by joining on `proposalId`. OZ Governor is explicitly noted as maintaining "compatibility with GovernorBravo events" — so this is a legacy-compatibility choice, not a best-practice endorsement of minimal events. ([OZ IGovernor.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/IGovernor.sol))

- **For regulated audit trails (healthcare/compliance), event self-containment is the recommended pattern.** When PHI is not on-chain and the field is a hash, adding redundant context to the resolution event improves: (1) auditor replay without multi-event join, (2) indexer robustness (Ormi subgraph for `ClaimPaStatusResolved` can surface the paAuthHash without fetching `ClaimSubmitted`), (3) incident-response speed.

- **Gas delta: +5,120 gas on Somnia.** LOG3 with 32-byte data (resolvedAt only): `3200 + 5120×3 + 160×32 = 23,680 gas`. LOG3 with 64-byte data (resolvedAt + paAuthHash): `3200 + 5120×3 + 160×64 = 28,800 gas`. Delta is exactly +5,120 gas (~$0.0000315/emission at current Somnia pricing). Negligible. ([Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum))

- **Correct Solidity signature:** `event ClaimPaStatusResolved(bytes32 indexed claimId, uint8 indexed resolvedStatus, uint256 resolvedAt, bytes32 paAuthHash)` — paAuthHash as 4th non-indexed data field. Combined data size = 64 bytes (resolvedAt + paAuthHash). This is LOG3 (3 indexed topics: event sig, claimId, resolvedStatus) with 64 bytes non-indexed data.

- **Security: conditional-zero field requires explicit NatSpec guard.** `bytes32(0)` is a valid sentinel but must not be interpreted as a valid commitment. If `resolvedStatus != 0x02`, the contract MUST enforce `paAuthHash == bytes32(0)` via `require`. The NatSpec must document: *"paAuthHash is only meaningful when resolvedStatus == 0x02 (Satisfied). For all other resolvedStatus values it MUST be bytes32(0) and MUST NOT be interpreted as a commitment hash."* This guard prevents off-chain parsers from treating the zero value as a valid resolution commitment on non-satisfied paths.

- **Solidity `require` guard pattern:** `require(resolvedStatus == 0x02 ? paAuthHash != bytes32(0) : paAuthHash == bytes32(0), "paAuthHash: invalid for status")` — mirrors the identical guard already established for `paAuthHash` in `resolveConditionalPaStatus()` from the prior research entry.

- **No EVM/ABI standard mandates or prohibits repetition.** Neither the Ethereum ABI specification nor any EIP governs whether resolution events must repeat creation-event data. This is a protocol design choice; the Compound Timelock pattern is the dominant precedent for compliance-oriented governance events. ([Solidity ABI spec](https://docs.soliditylang.org/en/latest/abi-spec.html))

**Design implication:** Amend `ClaimPaStatusResolved` to `event ClaimPaStatusResolved(bytes32 indexed claimId, uint8 indexed resolvedStatus, uint256 resolvedAt, bytes32 paAuthHash)`. Enforce `paAuthHash != bytes32(0) iff resolvedStatus == 0x02` in `resolveConditionalPaStatus()`. Gas rises from 23,680 to 28,800 (LOG3 + 64-byte data) — negligible. Ormi subgraph for this event can surface the full PA resolution context (status + auth hash) without cross-event join against `ClaimSubmitted`.

**Open questions generated:**
1. Should `ClaimPaLifecycle` TypeScript module export a unified `resolveConditionalStatus(claimId, resolvedStatus, authorizationNumber?)` helper that validates the paAuthHash conditional requirement and wraps both `resolveConditionalPaStatus()` paths (CRD `satisfied-pa-id` and PAS `extension:authorizationNumber`)?
2. Should the Ormi subgraph entity for `ClaimPaStatusResolved` index `paAuthHash` as a queryable field — enabling payer agents to find all `satisfied` PA resolutions by auth hash without scanning all resolution events?
3. Should cliqueue publish a one-page "PA Lifecycle Event Schema" (listing `ClaimSubmitted`, `ClaimPaStatusResolved`, and their field semantics) in the hospital onboarding checklist so payer integration engineers have a documented event correlation guide?

---

**See also** — [[../topics/prior-auth|PA hub]]
