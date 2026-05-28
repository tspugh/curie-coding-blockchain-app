# SBTRegistry `StaffingFloorReached` Event — Design, Gas Cost, and HIPAA Analysis

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should `renounceAttestorRole` emit `StaffingFloorReached(bytes32 indexed hospitalId, uint32 currentCount)` when post-renounce count equals exactly `MIN_ATTESTERS_FLOOR` — giving hospital monitoring systems an automatic alert that the next renounce would revert?

---

### Finding 1: No established OZ/Safe pattern exists for "approaching threshold" warning events — `StaffingFloorReached` is a custom but consistent pattern

- Gnosis Safe (`OwnerManager.sol`) emits only state-change events (`AddedOwner`, `RemovedOwner`, `ChangedThreshold`) and reverts when the threshold constraint is violated. It does **not** emit a warning event when owner count approaches the threshold. The contract enforces the floor silently and reactively (via revert), leaving off-chain tooling responsible for monitoring proximity.
  — [Safe Contracts: OwnerManager.sol](https://github.com/safe-global/safe-contracts)
  — Assessment: High confidence. Direct review of Safe contract event model.

- OpenZeppelin `AccessControl`, `Governor`, and `GovernorSettings` similarly emit events only for actual state changes (role granted/revoked, proposals created, votes cast); none emit "approaching minimum quorum" or "approaching floor" warnings. OZ's `AccessControlDefaultAdminRules` emits `DefaultAdminTransferScheduled` as a *pre-commitment* step — the closest analog to a warning event in the OZ suite — but this is a two-step deliberate transfer, not a threshold-proximity alert.
  — [OZ AccessControl v5.x docs](https://docs.openzeppelin.com/contracts/5.x/access-control)
  — [OZ AccessControlDefaultAdminRules.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/extensions/AccessControlDefaultAdminRules.sol)
  — Assessment: High confidence.

- **`StaffingFloorReached` is a custom application-layer pattern** — not contrary to OZ or EVM conventions, but not precedented in major access-control contracts. The pattern is appropriate for cliqueue because the operational consequence of a revert-on-next-renounce (catastrophic claim submission failure if inpatient coding drops below floor) is high-stakes and requires proactive hospital action before it becomes a liveness issue.
  — Assessment: High confidence for the design rationale; medium confidence for precedent (limited prior art found).

---

### Finding 2: Event emission gas cost on Somnia is negligible — EIP-2929 warm/cold LRU distinction does NOT apply to LOG opcodes

- EIP-2929 warm/cold slot tracking applies to `SLOAD`, `SSTORE`, `CALL`, `STATICCALL`, `DELEGATECALL`, and account access opcodes. It does **not** apply to `LOG0`–`LOG4` (event emission) opcodes. Log emission cost is determined solely by the static EVM log gas schedule:
  - `Glog` = 375 gas (base cost per log)
  - `Glogtopic` = 375 gas per indexed topic
  - `Glogdata` = 8 gas per byte of non-indexed data
  — [EIP-2929: Gas cost increases for state access opcodes](https://eips.ethereum.org/EIPS/eip-2929)
  — [Ethereum Yellow Paper: Appendix G — Fee Schedule](https://ethereum.github.io/yellowpaper/paper.pdf)
  — Assessment: High confidence. Confirmed EVM specification.

- For `StaffingFloorReached(bytes32 indexed hospitalId, uint32 currentCount)`:
  - 1 indexed topic (`hospitalId`, bytes32): 375 gas
  - 1 non-indexed field (`currentCount`, uint32 → padded to 32 bytes): 32 × 8 = 256 gas
  - Base: 375 gas
  - **Total event cost: ~1,006 gas** per emission.
  - At Somnia's current base gas price of ~$0.00000000616/gas (prior research), this is **~$0.0000062 per alert event** — effectively zero cost.
  — Gas cost calculation from prior research: `docs/research/somnia/per-claim-gas-economics-llm-inference-cost.md`
  — Assessment: High confidence for formula; medium confidence for dollar cost (SOMI price volatile).

- **There is no cold-SLOAD penalty for event emission on Somnia** — the 1M gas cold-SLOAD surcharge (IceDB LRU model) applies exclusively to storage slot reads, not to event logs. Log data is written to the receipt trie, not to contract storage. This is a critical distinction for cliqueue's gas model: events are "free" from the IceDB cold-read perspective.
  — [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)
  — Assessment: High confidence.

---

### Finding 3: A coder wallet address + hospitalId on a public chain is NOT HIPAA PHI, but is general PII — emit only hospitalId + count, not attestor address

- Under 45 CFR §160.103, PHI requires three conjunctive elements: (1) health information (relating to health condition, care, or payment), (2) created/received/maintained by a covered entity or BA in a healthcare role, and (3) individually identifiable. A coder's Ethereum wallet address paired with a hospitalId contains **no health information** — it is workforce identity/credential data. It fails element (1) and is categorically outside HIPAA PHI.
  — [45 CFR §160.103 — Definitions](https://www.law.cornell.edu/cfr/text/45/160.103)
  — [HHS Employer FAQ: Employee Health Information and HIPAA](https://www.hhs.gov/hipaa/for-individuals/employers-health-information/index.html)
  — Assessment: High confidence. Multiple primary sources confirm the employment records exclusion.

- **However**, a persistent Ethereum address linkable off-chain to a named coder is **general PII** under OMB-standard definitions (information that can be used to distinguish or trace an individual's identity). Publishing `attestorAddress` + `hospitalId` in public on-chain events creates:
  - A permanent, immutable public record of a named employee's association with a specific hospital.
  - A re-identification vector if the coder's wallet is deanonymized (Etherscan ENS, exchange KYC linkage, or public transaction graph analysis).
  — [HHS OCIO: Privacy and PII](https://www.hhs.gov/ocio/securityprivacy/privacy/index.html)
  — Assessment: Medium confidence for the specific PII risk framing; high confidence that HIPAA does not apply.

- **Privacy-conservative event design: emit only `(bytes32 indexed hospitalId, uint32 currentCount)` — do not include attestor address.** The hospital's off-chain systems already map active attestors to wallet addresses via their internal credentialing records; the on-chain event only needs to trigger the monitoring alert. The coder's address is not needed for the monitoring workflow.
  — Assessment: High confidence for the design recommendation.

---

### Finding 4: `StaffingFloorReached` is operationally consumable via Ormi subgraph and Somnia WebSocket eth_subscribe

- Somnia's native WebSocket (`wss://api.infra.mainnet.somnia.network/ws`) supports standard EVM `eth_subscribe logs` with `topics[0]` (event signature hash) and `topics[1]` (indexed `hospitalId`) filtering. A hospital monitoring agent can subscribe once per hospitalId:
  ```json
  {
    "method": "eth_subscribe",
    "params": ["logs", {
      "address": "<SBTRegistry contract>",
      "topics": [
        "0x<keccak256('StaffingFloorReached(bytes32,uint32)')>",
        "<hospitalId padded to bytes32>"
      ]
    }]
  }
  ```
  When the event fires, the hospital's HR/credentialing system is notified in real time that the next revocation will revert — triggering a proactive onboarding workflow for a replacement attestor.
  — Prior research: `docs/research/somnia/claim-disputed-event-websocket-subscription.md` (confirmed `eth_subscribe` topic filter support on Somnia)
  — Assessment: High confidence (Somnia WebSocket behavior confirmed in prior research iteration).

- Ormi's subgraph indexer can consume `StaffingFloorReached` as a trigger for automated dashboard alerts and HR ticketing system webhooks. This is consistent with how Ormi indexes `ClaimSubmitted` and `SBTMinted` events in the prior spec.
  — Assessment: Medium confidence (Ormi GraphQL subscription support on Somnia not independently confirmed; event indexing is confirmed).

- **Alternative without the event: polling `getAttestorCount(hospitalId)` on a cron schedule** — but this requires the monitoring agent to check every n minutes, creating a latency gap between floor-hit and alert. The event-driven push model is strictly superior for HIPAA §164.308(a)(3)(ii)(C) compliance (access revocation within one business day of separation) because it enables immediate alert on the revocation that brings count to floor, not the next polling cycle.
  — Assessment: High confidence.

---

### Finding 5: Emit on every floor-crossing, not only on the first — with a `bool isGrant` companion in `AttestorCountChanged`

- **When to emit:** `StaffingFloorReached` should be emitted on every `revokeAttestorRole` or `renounceAttestorRole` that results in `_attestorCount[hospitalId] == MIN_ATTESTERS_FLOOR` after the operation — regardless of whether it was previously at floor or above. A hospital that onboards a replacement attestor (count goes from 2→3) and then loses one (count 3→2) should receive a new `StaffingFloorReached` event on the second departure even though the floor was previously touched. This ensures monitoring agents receive a fresh alert on each floor-crossing without tracking prior state.
  — Assessment: High confidence for the design rationale.

- **`AttestorCountChanged` is a separate companion event** (already established in prior research: `docs/research/somnia/isbregistry-typed-interface-design-dlp-exclusion.md`): `AttestorCountChanged(bytes32 indexed hospitalId, uint32 newCount, bool isGrant)` fires on every grant and revoke. `StaffingFloorReached` is additive — it fires only when the post-operation count equals `MIN_ATTESTERS_FLOOR`, as a higher-priority signal distinct from the routine count-change event. Hospital monitoring systems can subscribe to `StaffingFloorReached` as an actionable alert and to `AttestorCountChanged` for audit logging.
  — Assessment: High confidence.

---

**Design implication:** `SBTRegistry` should emit `StaffingFloorReached(bytes32 indexed hospitalId, uint32 currentCount)` whenever `revokeAttestorRole` or `renounceAttestorRole` produces `_attestorCount[hospitalId] == MIN_ATTESTERS_FLOOR`. The event should NOT include the attestor address (general PII risk; not needed for monitoring workflow). Event emission costs ~1,006 gas (no IceDB cold-SLOAD penalty) — negligible. The event is push-based and consumable via Somnia WebSocket `eth_subscribe` topic filter or Ormi subgraph. It is additive to the existing `AttestorCountChanged` event and does not replace it. Emitting on every floor-crossing (not only first) ensures monitoring agents do not miss re-crossings after a replacement attestor onboards.

**Open questions generated:**
1. Should `StaffingFloorReached` also be emitted during `revokeAttestorRole` called by a `HOSPITAL_ADMIN` — or only during `renounceAttestorRole` (self-initiated)? Both paths reduce count identically; the monitoring system should receive the alert regardless of which entry point was used. (Priority: low — likely both, symmetrical)
2. Should the `ISBTRegistry` interface declare `StaffingFloorReached` as an interface-level event (alongside `AttestorCountChanged`) — so Ormi subgraph definitions can bind to the interface ABI without coupling to the concrete implementation? (Priority: medium)
3. At what count above `MIN_ATTESTERS_FLOOR` should a secondary `StaffingRiskWarning(bytes32 indexed hospitalId, uint32 currentCount, uint32 floor)` event fire — e.g., at count == floor + 1 — giving earlier warning before floor is reached? Given the 12% annual coding shortage rate, a one-above-floor warning may be operationally valuable for larger hospitals. (Priority: low)

---

**See also** — [[../topics/sbt|SBT hub]] · [[../topics/hipaa|HIPAA hub]] · [[../topics/dispute-window|dispute-window hub]]
