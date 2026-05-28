## 2026-05-17 — ClaimPaStatusResolved event design: LOG3 follow-up event is correct; conditional resolves via PAS $inquire (provider-polled, no payer push); idempotent state guard required; 23,680 gas on Somnia

**Question answered:** When `paStatus = 0x05 (conditional)` is anchored in `ClaimSubmitted` and the ordering provider later supplies sufficient clinical detail for the payer to make a final PA determination, should a new `ClaimPaStatusResolved(bytes32 indexed claimId, uint8 indexed resolvedStatus, uint256 resolvedAt)` event type capture that resolution on-chain — and what is the correct Solidity event design, idempotency guard, and gas cost?

---

### Findings

- **CRD STU2.1 does not define a follow-up "resolved conditional" callback.** The CRD IG's `conditional` code means the payer cannot determine PA requirement without more specific clinical detail (e.g., HCPCS modifier, site-of-service, quantity). CRD itself is the discovery layer only; it does not define a normative resubmit loop or asynchronous callback when the clinical detail is supplied. The intended downstream pathway is **DTR (Documentation Templates and Rules) then PAS (Prior Authorization Support)** for the formal PA submission and final adjudication. ([CRD STU2.1](https://build.fhir.org/ig/HL7/davinci-crd/); [PAS IG](https://build.fhir.org/ig/HL7/davinci-pas/))

- **PAS STU2 uses provider-initiated `Claim/$inquire` for status updates — no payer-pushed notification.** When a payer pends a PA request, the provider polls via `[base]/Claim/$inquire` (Bundle with PAS Claim Inquiry → 0..* response Bundles with ClaimResponse). PAS STU2 defines no normative FHIR Subscription or payer-initiated unsolicited push mechanism for adjudication-complete events. The final decision is carried in a **ClaimResponse**-based PAS response, not a Task resource. CMS-0057-F does not separately mandate `$inquire` implementation on a timeline distinct from the PA FHIR API deadline. ([PAS `$inquire` OperationDefinition](https://build.fhir.org/ig/HL7/davinci-pas/en/OperationDefinition-Claim-inquiry.html); [CMS 0057-F](https://www.cms.gov/priorities/key-initiatives/burden-reduction/interoperability/prior-authorization))

- **`ClaimPaStatusResolved` as a LOG3 follow-up event is the correct Solidity pattern.** There is no EIP-level standard for two-event lifecycle (LOG4 submission + LOG3 resolution), but OpenZeppelin's Governor.sol and TimelockController.sol use exactly this pattern: `ProposalCreated` (more indexed fields) → `ProposalExecuted` (fewer fields, just identifier + outcome). A resolution event referencing the same `claimId` with fewer topics is idiomatic. Recommended signature: `ClaimPaStatusResolved(bytes32 indexed claimId, uint8 indexed resolvedStatus, uint256 resolvedAt)`.

- **Somnia gas cost for `ClaimPaStatusResolved` is 23,680 gas (LOG3 + 32-byte data).** Using Somnia's formula (`3200 + 5120 × topic_count + 160 × data_bytes`): LOG3 (3 total topics: signature + 2 indexed) + 32 bytes non-indexed data (`resolvedAt` as `uint256`) = `3200 + 15360 + 5120 = 23,680 gas` (~$0.000146/emission at $0.00000000616/gas). This is lower than the `ClaimSubmitted` LOG4 cost (28,800 gas), appropriate for a follow-up event. ([Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum))

- **Idempotency guard is required: `require(claims[claimId].paStatus == CONDITIONAL)` before emitting.** Without a state guard, a hospital agent bug or network retry could emit multiple `ClaimPaStatusResolved` events for the same `claimId` with conflicting `resolvedStatus` values, creating an ambiguous on-chain record. The function must (a) check current `paStatus == 0x05`, (b) atomically update `paStatus` to `resolvedStatus` in contract storage, (c) emit the event. Subsequent calls for the same `claimId` will revert. This mirrors OZ Governor's `_state()` guard pattern before `ProposalExecuted`.

- **On-chain resolution event is evidentiary metadata, not a substitute for the FHIR PAS response.** From an OIG/CMS audit-trail perspective, the on-chain event provides tamper-evident timestamping and chain-of-custody corroboration, but the authoritative record remains the off-chain FHIR PAS ClaimResponse. The on-chain event's value is: (a) tamper-proof timestamp of when resolution was known to the hospital system, (b) independent corroboration that `conditional` did not linger (a potential false-claim risk signal), (c) filtering for auditors via `eth_getLogs(topics: [sig, claimId])`. No CMS, OIG, or AHIMA source mandates blockchain audit trails for PA decisions; the event is a cliqueue design choice, not a regulatory requirement.

- **No published healthcare blockchain protocol has defined this two-event PA lifecycle pattern.** cliqueue would be the first to publish a `conditional → resolved` on-chain PA lifecycle using a typed `uint8 paStatus` encoding derived from CRD ValueSet codes. The two-event design (LOG4 `ClaimSubmitted` + LOG3 `ClaimPaStatusResolved`) would be a novel protocol contribution.

- **`resolvedAt` should be `block.timestamp`, not a parameter.** Accepting `resolvedAt` as a caller parameter would allow a hospital agent to forge resolution timestamps. The function should use `block.timestamp` directly and emit it as non-indexed data. This is consistent with OZ TimelockController's `CallExecuted` event which records the execution timestamp from `block.timestamp`.

---

**Design implication:** Add `function resolveConditionalPaStatus(bytes32 claimId, uint8 resolvedStatus) external onlyRole(HOSPITAL_AGENT_ROLE)` to `ClaimsAdjudicator`, guarded by `require(claims[claimId].paStatus == 0x05, "Not conditional")` and `require(resolvedStatus == 0x03 || resolvedStatus == 0x01, "Invalid resolution")` (only `auth-needed` or `no-auth` are valid resolutions of `conditional`). Atomically update storage then emit `ClaimPaStatusResolved(claimId, resolvedStatus, block.timestamp)`. Gas: 23,680 event emission + SSTORE for paStatus update. This is a spec-level change requiring a formal amendment to `ClaimsAdjudicator` alongside the `ClaimSubmitted` paStatus/paAuthHash amendment.

**Open questions generated:**
1. Should `resolveConditionalPaStatus()` also accept a `bytes32 paAuthHash` parameter — enabling the case where `conditional` resolves to `satisfied` (payer grants PA after receiving more detail) rather than only `auth-needed` or `no-auth`?
2. Should cliqueue publish a `ClaimPaLifecycle` TypeScript utility module (alongside `PaStatusEncoder`) that encapsulates the `conditional → resolved` transition logic and validates that only legal resolution values are passed?
3. Should the hospital BAA include a "PA Conditional Resolution SLA" clause — requiring the hospital agent to call `resolveConditionalPaStatus()` within N business days of receiving the PAS `$inquire` final response, so `conditional` claims don't linger indefinitely in the on-chain audit trail?

---

**See also** — [[../topics/prior-auth|PA hub]]
