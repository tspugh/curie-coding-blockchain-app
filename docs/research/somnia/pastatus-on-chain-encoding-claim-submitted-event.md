## 2026-05-17 — paStatus on-chain encoding in ClaimSubmitted: uint8 indexed is correct; conditional maps to distinct byte 0x05; gas delta is +5120 on Somnia regardless of indexed vs non-indexed

**Question answered:** Should cliqueue's `ClaimSubmitted` event include a `paStatus` field (`bytes1`) encoding all 5 CRD paStatus values plus NOT_CHECKED — and does including `conditional` as a distinct byte (rather than collapsing it into `auth-needed`) help auditors distinguish "PA determination deferred pending more detail" from "PA required and not obtained"?

---

### Findings

- **All 5 CRD coveragePaDetail codes confirmed** from the primary source (CRD STU2.1 ValueSet, verified via HL7 spec): `no-auth`, `auth-needed`, `satisfied`, `performpa`, `conditional`. All sourced from CodeSystem `http://hl7.org/fhir/us/davinci-crd/CodeSystem/temp`. ([CRD STU2.1 ValueSet-coveragePaDetail](https://hl7.org/fhir/us/davinci-crd/STU2.1/ValueSet-coveragePaDetail.html); [build.fhir.org live version](https://build.fhir.org/ig/HL7/davinci-crd/ValueSet-coveragePaDetail.html))

- **`conditional` is semantically distinct from `auth-needed` and must not be collapsed.** `auth-needed` = PA is definitively required; the payer has made a determination. `conditional` = payer cannot determine PA requirement without more information (e.g., more specific HCPCS modifier, site-of-service, quantity threshold). The IG's language: "a decision on whether there in fact are additional information requirements cannot be made without more information (more detailed code, service rendering information, etc.)." ([CRD build.fhir.org](https://build.fhir.org/ig/HL7/davinci-crd/ValueSet-coveragePaDetail.html)) Collapsing `conditional` into `auth-needed` in the on-chain event would misrepresent the clinical/payer determination — an auditor could not distinguish a confirmed PA-required claim from one where the payer deferred the determination.

- **`conditional` does NOT automatically trigger PAS.** The CRD IG frames `conditional` as a pre-determination / information-gathering path. The client should pause the workflow and request more specific clinical or service detail from the ordering provider; only after resolution is it determined whether a PA is actually required (then routed to PAS) or not. This means cliqueue's on-chain `paStatus = 0x05` should trigger a human-review queue, not an automatic PAS submission. ([Firley CRD blog post](https://fire.ly/blog/prior-authorization-with-crd-explained/))

- **Recommended byte encoding** (6 values, fits in `uint8`):

  | Code | Byte | Meaning | cliqueue workflow |
  |---|---|---|---|
  | `NOT_CHECKED` | `0x00` | No CRD query was made (trad. Medicare FFS, or pre-Jan 2027) | Continue |
  | `no-auth` | `0x01` | No PA required | Continue |
  | `satisfied` | `0x02` | PA already approved; `satisfied-pa-id` anchored off-chain | Continue, carry PA ref |
  | `auth-needed` | `0x03` | PA definitively required, not obtained | Pause, trigger PAS |
  | `performpa` | `0x04` | PA required, must be initiated by performing provider | Route to performing provider PA workflow |
  | `conditional` | `0x05` | Payer cannot determine without more detail | Pause, human review queue |

- **`uint8` is preferred over `bytes1` for the event field.** Both ABI-encode to 32 bytes in log data and both cost the same as a topic. `uint8` is idiomatic for enums in Solidity and more readable in block explorers and ABI decoders; `bytes1` conveys byte-semantics, not ordinal-semantics.

- **`paStatus` should be indexed** to enable `eth_getLogs` filtering by status. Auditors and analytics pipelines can query "all `ClaimSubmitted` events where `paStatus = 0x03` (auth-needed)" without scanning all events. Gas delta of indexing vs non-indexing is **identical on Somnia** due to the AOT LOG formula: `3200 + 5120×topic_count + 160×data_size_bytes`. Adding a non-indexed `uint8` to a baseline LOG3 (32 bytes data) costs `+160×32 = +5120 gas` (data grows from 32→64 bytes, same topic count). Adding it as an indexed topic (LOG4, 32 bytes data) also costs `+5120 gas` (`+1 topic × 5120 = +5120`). Net delta between the two approaches: **0 gas**. Therefore index it for the query benefit at no cost penalty. ([Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum))

- **Gas impact on ClaimSubmitted event.** The existing `ClaimSubmitted` event design (LOG3 baseline per prior research) will become LOG4 with `paStatus` indexed. LOG4 on Somnia = `3200 + 5120×4 + 160×32 = 28,800 gas`. At `$0.00000000616/gas`, cost per emission = `~$0.000177`. Still operationally negligible. The prior `ClaimSubmitted` LOG3 estimate was 23,680 gas; adding indexed `paStatus` (LOG4) adds 5,120 gas.

- **No prior art exists for FHIR-derived enum on-chain encoding** in published healthcare blockchain protocols. The closest pattern is compact enum/status fields in governance and escrow contracts (e.g., ERC-20 `Transfer`, ERC-721 lifecycle). cliqueue would be the first to publish a `paStatus` encoding mapping CRD codes to on-chain bytes in a claims settlement context — a potential ecosystem contribution.

- **On-chain byte encoding does not replace off-chain FHIR object.** The on-chain `paStatus` byte is an audit commitment, not a substitute for preserving the full CRD response (including `satisfied-pa-id`, `coverage-assertion-id`, CDS Hook response timestamp) in the hospital's off-chain encrypted store. The on-chain byte enables regulators and auditors to verify PA check was performed without exposing the clinical detail.

---

**Design implication:** Add `uint8 indexed paStatus` to `ClaimSubmitted` event in `ClaimsAdjudicator`, using the 6-value encoding above. The event signature changes from LOG3 to LOG4 (+5,120 gas on Somnia, negligible cost). The off-chain hospital agent must map CRD response codes to the `uint8` before calling `submitClaim()`. `conditional` (0x05) routes to a human-review queue, not PAS. `NOT_CHECKED` (0x00) is the default for traditional Medicare FFS and pre-Jan 2027 deployments. This decision requires a spec amendment to `ClaimsAdjudicator` before the next feature branch regeneration.

**Open questions generated:**
1. Should cliqueue also anchor the `satisfied-pa-id` (the X12 PA authorization number returned by the payer when `paStatus = satisfied`) as a `bytes32` hash in `ClaimSubmitted`, providing an immutable on-chain link between the PA approval and the claim without exposing the raw PA number?
2. Should the `paStatus` encoding table be published as a TypeScript `enum PaStatus` constant in the off-chain agent spec — so hospital integration engineers have a typed, versioned mapping between CRD codes and on-chain bytes?
3. When `paStatus = conditional` (0x05) is anchored on-chain, should a subsequent `ClaimStatusUpdated` event (new event type) be defined to record when the conditional determination resolves to `auth-needed` or `no-auth` — creating a full on-chain audit trail of the PA determination lifecycle?

---

**See also** — [[../topics/prior-auth|PA hub]]
