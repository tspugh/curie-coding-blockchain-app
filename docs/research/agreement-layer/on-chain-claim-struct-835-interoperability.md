# On-Chain Claim Struct and 835 Remittance Interoperability

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — Minimum on-chain claim structure for 835 remittance interoperability during phased EDI adoption

### The reconciliation problem

Payers' accounting systems require X12 835 ERA (Electronic Remittance Advice) for every paid claim. During phased adoption where payers still operate on EDI rails, cliqueue's on-chain settlement must produce enough anchored identifiers to (a) uniquely identify the claim on-chain, and (b) enable an off-chain adapter to reconstruct a valid 835 for the payer's AR system. This defines the minimum on-chain claim struct.

### 835/837 reconciliation field mapping (EDI standard)

The primary reconciliation key between an 837 claim submission and its 835 remittance is:

- **CLM01 (837) = CLP01 (835)** — Provider-assigned patient control number. This is the provider's own claim ID, echoed verbatim by the payer in the remittance CLP segment. It is the single most important field for automated payment posting.
  — [EDI File Converter: How to read EDI 835](https://www.edifileconverter.com/articles/how-to-read-edi-835); [Accountable HQ: 835 file format](https://www.accountablehq.com/post/hipaa-835-file-format-example-sample-era-x12-835-with-segments-and-loops-explained)

- **CLP07 (835)** — Payer claim control number: the payer's own internal tracking ID, assigned during adjudication. This is the payer-side mirror of CLM01.
  — [Accountable HQ: HIPAA 835](https://www.accountablehq.com/post/hipaa-835-file-format-example-sample-era-x12-835-with-segments-and-loops-explained)

- **TRN02 (835)** — Payment trace number (EFT reference / check number). Connects the remittance to the actual bank deposit. Required for bank reconciliation; absent in full blockchain-native settlement.
  — [X12 RFI 2661: TRN02 receiver clarification](https://x12.org/resources/requests-for-interpretation/rfi-2661-trn02-receiver-clarification-835)

- **CLP03/CLP04/CLP05 (835)** — Billed amount, paid amount, patient responsibility. The accounting identity: `CLP03 = CLP04 + CLP05 + sum(CAS adjustments)`.
  — [Accountable HQ: HIPAA 835](https://www.accountablehq.com/post/hipaa-835-file-format-example-sample-era-x12-835-with-segments-and-loops-explained)

- **NM109 (837 loop 2010AA)** — Billing provider NPI. The non-PHI identifier for the hospital or practice that submitted the claim. Mandatory; not a covered identifier under HIPAA (NPIs are public).
  — [Stedi: EDI 837P documentation](https://www.stedi.com/edi/hipaa/transaction-set/837-Q1)

### Minimum on-chain Claim struct (design proposal)

Derived from the 835/837 minimum reconciliation set. All PHI fields replaced with HMAC-SHA256 hashes (per the HIPAA de-identification finding in `regulatory/hipaa-blockchain-hash-anchoring.md`). Amounts stored as cents to avoid floating-point issues.

```
struct Claim {
    // Slot 0 — packed: status (1B) + submittedAt (5B) + settledAt (5B) + flags (1B) = 12B
    uint8   status;          // ClaimStatus enum: 0=Submitted 1=Adjudicated 2=Attested 3=Disputed 4=Settled
    uint40  submittedAt;     // block.timestamp at Submitted state
    uint40  settledAt;       // block.timestamp at Settled state; 0 if not yet settled
    uint8   claimTypeCode;   // 1=professional 2=institutional 3=dental (mirrors CLM05-1)
    // 12 bytes used; 20 bytes remaining in slot 0 — reserve for future fields

    // Slot 1 — claimId: HMAC-SHA256(CLM01 | providerNPI | dateOfService)
    bytes32 claimId;         // Primary reconciliation key; maps to CLM01/CLP01

    // Slot 2 — icd10CodeHash: HMAC-SHA256(sorted ICD-10 code array)
    bytes32 icd10CodeHash;   // Coding agent output commitment; verified by attestation

    // Slot 3 — providerHash: HMAC-SHA256(NPI | TIN)
    bytes32 providerHash;    // Billing provider identity; not raw NPI (belt-and-suspenders)

    // Slot 4 — payerHash: HMAC-SHA256(payer ID | payer NPI)
    bytes32 payerHash;       // Payer identity; enables dispute routing

    // Slot 5 — packed: billedCents (8B) + adjudicatedCents (8B) = 16B, 16B remaining
    uint64  billedCents;     // CLM total charge (CLP03 equivalent)
    uint64  adjudicatedCents; // Payer-approved amount (CLP04 equivalent)

    // Slot 6 — payerClaimRef: HMAC-SHA256(payer's CLP07 value)
    bytes32 payerClaimRef;   // Payer claim control number commitment (set at Adjudicated state)
}
```

**Storage layout:** 7 slots (7 × 32 bytes = 224 bytes) per claim on Somnia. At 200,000 gas per new slot and current worst-case pricing (~$5.49e-9/gas), initial write cost per new claim ≈ 7 × 200,000 × $5.49e-9 = **~$0.0077** worst case, **~$0.00077** at 400 TPS with 90% discount. Subsequent warm-slot state transitions remain sub-$0.001.
— [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)

### Why `claimId` is HMAC rather than raw CLM01

CLM01 values are typically short numeric strings (e.g., `"2023-ABC-001"`). A raw CLM01 on a public chain allows trivial enumeration of all provider claims by pattern-matching. HMAC-SHA256 with an HSM-held key (per the HIPAA finding in `regulatory/hipaa-blockchain-hash-anchoring.md`) makes reversal computationally infeasible while preserving the 1:1 mapping needed for reconciliation.
— [CMS: HIPAA 835](https://www.cms.gov/medicare/coding-billing/electronic-billing/health-care-payment-remittance-advice)

### Off-chain EDI adapter architecture for phased adoption

During the transition period where payers still require X12 835:

1. **Hospital side**: on claim creation, the hospital's EDI adapter stores `(claimId → CLM01, billedCents, dateOfService, NPI)` in a private off-chain mapping (local database, not public).
2. **On settlement**: when the Somnia `ClaimsAdjudicator` contract emits a `ClaimSettled(claimId, adjudicatedCents, settledAt)` event, the adapter:
   a. Looks up the local CLM01 for the claimId.
   b. Constructs a synthetic 835 ERA with CLP01=CLM01, CLP04=adjudicatedCents, TRN02=settlementTxHash (Somnia tx hash serves as trace number).
   c. Transmits the synthetic 835 to the clearinghouse or posts it directly to the payer's EDI mailbox.
3. **Payer side**: for payers that cannot yet accept Somnia event confirmations natively, the payer's adapter similarly constructs their internal 835 from on-chain event data.

This adapter pattern is analogous to existing FHIR-to-EDI translation layers used by clearinghouses today (e.g., Stedi, Edifecs, Rhapsody).
— [2026 Healthcare Clearinghouse Buyer's Guide](https://sdata.us/2026/02/19/2026-healthcare-clearinghouse-buyers-guide-for-payers-and-providers/); [CAQH CORE Phase IV 837 Infrastructure Rule](https://www.caqh.org/sites/default/files/core/phase-iv/450_837-infrastructure-rule.pdf)

### FHIR ClaimResponse fields that map to on-chain struct

The FHIR R4 ClaimResponse mandatory fields (`status`, `type`, `use`, `patient`, `created`, `provider`, `insurer`) provide a parallel mapping layer for systems using FHIR Financial APIs (Da Vinci PDex, CMS-0057 prior-auth mandate). The `identifier` element (0..*) can carry the on-chain `claimId` as a system-defined identifier, enabling dual-rail reconciliation: EDI for legacy payers, FHIR for CMS-mandated workflows.
— [FHIR R4 ClaimResponse](https://www.hl7.org/fhir/R4/claimresponse.html); [FHIR Claim resource](https://www.hl7.org/fhir/R4/claim.html)

### CAQH CORE Real-Time Adjudication (RTA) compatibility

CAQH CORE Phase IV defines Real-Time Adjudication as: claim submission → acknowledgment → adjudication decision delivered in real time, with actual payment potentially deferred. Somnia's 100 ms finality and the `ClaimsAdjudicator` 5-state machine are fully compatible with this model: the `Adjudicated` state (returned by coding agent callback) maps to CAQH's RTA "decision delivered" event; the `Settled` state with fund release maps to the deferred payment step. No changes to the Somnia contract design are required for CAQH CORE Phase IV compliance during phased adoption.
— [CAQH CORE Phase IV 837 Infrastructure Rule](https://www.caqh.org/sites/default/files/core/phase-iv/450_837-infrastructure-rule.pdf); [CAQH CORE Priority Topics](https://www.caqh.org/core/priority-topics)

**Design implication:** The minimum on-chain `Claim` struct needs 7 storage slots (7 × 32 bytes) with the following non-negotiable fields for 835 interoperability: `claimId` (HMAC of CLM01), `billedCents`, `adjudicatedCents`, `payerClaimRef` (HMAC of CLP07), and `status`. An off-chain EDI adapter uses the `ClaimSettled` event plus a local CLM01 lookup to synthesize a valid X12 835 or FHIR ClaimResponse for payers still on legacy rails. The Somnia settlement tx hash serves as a globally unique TRN02 trace number equivalent. This design requires no PHI on-chain and is CAQH CORE Phase IV RTA-compatible.

**Open questions generated:**
1. What is the optimal off-chain key-value store for the `(claimId → CLM01)` adapter mapping — a hospital-local encrypted DB, a FHIR server, or a TEE-backed service — and how does it survive provider system failure without enabling PHI reconstruction from on-chain data?
2. How should the `payerClaimRef` (CLP07 hash) be set when the payer has not yet assigned a control number at Submitted state — should it be a placeholder that is updated in the Adjudicated transition, and does updating a bytes32 slot incur a warm-SSTORE cost or a new-slot cost?
3. When a claim is denied (CLP02 = 4 in 835) and resubmitted (CLM05-3 frequency code 7 = replacement), how should the on-chain struct handle the replacement claim — new claimId with a parent pointer, or an in-place status update that breaks immutability?

---

**See also** — [[../topics/x12|X12 hub]]
