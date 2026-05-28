## 2026-05-14 — Claim replacement/resubmission (CLM05-3 frequency code 7) on-chain struct design

**Question investigated:** When a claim is denied and resubmitted using X12 837 CLM05-3 frequency code 7 (replacement of prior claim), how should the on-chain struct handle the replacement — new claimId with parent pointer, or in-place status update that breaks immutability? What are the EDI, HIPAA, and EVM gas implications?

---

### EDI standard: how replacement works off-chain

- Frequency code 7 ("Replacement of prior claim") requires the provider to resubmit the **entire claim** (all service lines, not just corrected lines) with the payer's Internal Control Number (ICN/DCN) from the original 835 remittance in Loop 2300 REF02 with qualifier F8. Code 8 is a void/cancellation (removes the original entirely); code 7 is a corrective replacement.
  - Sources: [X12 RFI #2173](https://x12.org/resources/requests-for-interpretation/rfi-2173-loop-2300-ref01f8-control); [cms1500claimbilling.com Resubmission Code 7](https://cms1500claimbilling.com/cms-box-22-re-submission-claims-on-cms-1500-and-ub-04/); [BCBS IL frequency codes](https://www.bcbsil.com/docs/provider/il/claims/submission/claim-frequency-codes-prof.pdf)

- The original payer claim control number (CLP01 on the 835) is the reconciliation key: it is what the provider places in the replacement 837 REF02=F8 field, and what the payer uses to locate and supersede the original adjudicated claim in its system.
  - Source: [IBM APAR PH19685](https://www.ibm.com/support/pages/apar/PH19685); [MN Health e-health best practices](https://www.health.state.mn.us/facilities/ehealth/auc/bestpractices/docs/bpclaimsc7.pdf)

- Medicare allows replacement within 12 months of the service date; most commercial payers allow 90–180 days from original submission or denial. Missing this window results in timely-filing denial on the replacement claim.
  - Source: [cms1500claimbilling.com 2025 guide](https://cms1500claimbilling.com/cms-box-22-re-submission-claims-on-cms-1500-and-ub-04/)

- A replacement without a proper frequency code 7 and original ICN is auto-denied as a duplicate (CARC CO-18). The original claim control number is the **sole link** between the replacement 837 and the previously adjudicated claim — there is no separate "version tree" in X12; the relationship is a flat one-hop parent pointer: `replacementClaimId → originalPayerICN`.
  - Source: [CO-18 duplicate denial](https://www.panahealthcaresolutions.com/blogs/denial-code-co-18-duplicate-claims-and-how-to-avoid-them/)

- FHIR R4 `Claim` resource models this via `Claim.related` (BackboneElement, 0..*): `Claim.related.claim` is a Reference(Claim) for the prior claim, and `Claim.related.relationship` is a CodeableConcept (e.g., "prior" or "associated"). There is no native `frequencyCode` field in FHIR R4 Claim; it would be extension-encoded.
  - Source: [HL7 FHIR R4 Claim](https://www.hl7.org/fhir/R4/claim.html)

---

### On-chain design: new claimId vs. in-place update

#### Option A — In-place status update (breaks immutability)
Updating the existing Claim struct slot (e.g., setting `icd10CodeHash` to a new value on a denied claim) costs ~5,000 gas per non-zero→non-zero SSTORE on Somnia (warm slot). However:

- **Breaks audit immutability**: once the struct is updated, the original coded values are unrecoverable from chain state. A dishonest party could dispute what was originally submitted.
- **Regulatory exposure**: HIPAA requires an audit trail of all claim modifications. An in-place overwrite destroys that trail.
- **Incompatible with the existing 5-state machine**: the `ClaimsAdjudicator` design (from prior research) uses events as the primary audit log, but on-chain state is needed for dispute resolution. Overwriting state removes the dispute baseline.
- **Verdict: rejected for cliqueue.**

#### Option B — New claimId with parent pointer (append-only, recommended)
A replacement claim gets a new `claimId = HMAC-SHA256(CLM01 || frequencyCode || submissionTimestamp)`. The struct gains one new `bytes32 parentClaimId` slot (zero for originals, set to the original claimId for replacements).

Gas cost analysis on Somnia:
- Creating a new Claim struct (7 slots + parentClaimId = 8 slots of `bytes32`/`uint`): 8 × 22,100 gas (zero→non-zero) = ~176,800 gas ≈ ~$0.0010 at Somnia's $631 × 0.0055/1M gas rate (from prior gas model research). Negligible per-claim cost.
- The original claim's struct gains a `replacedByClaimId` field (also `bytes32`, set on replacement → 5,000 gas warm-write if in same tx, 22,100 if cold-SSTORE): this costs at most ~$0.00012. The state machine transitions original claim to a `Superseded` state (new 6th state).
- Net cost of a replacement cycle (new struct + supersede original): ~200,000 gas ≈ $0.0011. Well within the $4–10 outsourced-coding cost benchmark.

Source for gas figures: [RareSkills Solidity gas optimization](https://rareskills.io/post/gas-optimization); prior research in `docs/research/somnia/finality-tps-and-gas-model.md` and `docs/research/agreement-layer/conditional-fund-release-state-machine.md`.

#### The `parentClaimId` / `replacedByClaimId` dual-pointer design
The minimal on-chain pattern:

```
struct Claim {
  bytes32 claimId;          // HMAC(CLM01 || frequencyCode || ts)
  bytes32 parentClaimId;    // zero for originals; original claimId for freq=7 replacements
  bytes32 replacedByClaimId; // zero until superseded; set when a freq=7 arrives
  bytes32 icd10CodeHash;
  bytes32 providerHash;
  bytes32 payerHash;
  uint96  billedCents;
  uint96  adjudicatedCents;
  bytes32 payerClaimRef;    // CLP07 / payer ICN once adjudicated
  uint8   state;            // 0=Submitted 1=Pending 2=Adjudicated 3=Settled 4=Disputed 5=Superseded
}
```

This adds 2 `bytes32` slots (64 bytes) to the prior 7-slot struct. Packing `state` (uint8) with adjacent smaller fields keeps total struct at 9 storage slots.

- The `Superseded` state (5) is a terminal state: no further transitions possible. The payer-side adapter queries `replacedByClaimId` to follow the replacement chain.
- A `ClaimReplaced(bytes32 originalClaimId, bytes32 replacementClaimId, bytes32 payerRef)` event provides the audit trail without requiring on-chain storage reads.
- For void (frequency code 8), the original transitions to a `Voided` state (new 7th state if needed, or reuse Superseded with a void-flag bit).

---

### Duplicate detection and collision risk

The new claimId is `HMAC-SHA256(CLM01 || frequencyCode || ts)`. Since `frequencyCode` is different (7 vs. 1), the replacement claimId is cryptographically distinct from the original even if CLM01 is identical. The on-chain `mapping(bytes32 => Claim)` will not collide. The off-chain EDI adapter must populate `parentClaimId` by looking up the original claimId using the payer ICN from the 835 (stored in the `(claimId → CLM01)` off-chain key-value map).

---

### Academic / literature precedent

- A 2025 Frontiers in Blockchain review (blockchain healthcare claims tokenization) notes that "all the steps done — claim created, amendment, approval — will be recorded for eternity as an immutable audit trail," implying append-only event chains are the dominant design in literature. No reviewed paper uses in-place struct mutation for amendments.
  - Source: [Frontiers in Blockchain 2026 tokenization review](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2026.1768301/full)

- No DeFi insurance protocol (Nexus Mutual, Etherisc, InsurAce) has published a claim-replacement/resubmission mechanism analogous to EDI frequency codes — they use parametric triggers with no concept of "corrected claim." The EDI replacement workflow is a cliqueue-specific design problem with no prior art in the on-chain insurance space.

---

**Design implication:** The on-chain Claim struct must be extended with `parentClaimId` (bytes32) and `replacedByClaimId` (bytes32), and the state machine must add a `Superseded` terminal state (and optionally `Voided`). The state machine grows from 5 to 6–7 states. The `claimId` derivation formula must include `frequencyCode` to prevent hash collisions between originals and replacements. The off-chain EDI adapter must resolve the payer ICN (from the original 835) to the on-chain original claimId before constructing the replacement transaction.

**Open questions generated:**
1. Should the `Superseded` and `Voided` terminal states be collapsed into one (`Cancelled` with a sub-reason byte), or kept separate to allow distinct downstream payer-system reconciliation?
2. How many hops deep can the replacement chain realistically grow (original → replacement → re-replacement), and does cliqueue need a maximum chain depth enforced on-chain (e.g., max 3 replacements) to prevent unbounded linked-list traversal in dispute resolution?
3. Does the off-chain EDI adapter's responsibility to resolve `payerICN → original claimId` introduce a single point of failure in the replacement workflow — and should this mapping be cached on-chain in a separate lightweight lookup contract to survive adapter outages?

---

**See also** — [[../topics/x12|X12 hub]] · [[../topics/dispute-window|dispute-window hub]]
