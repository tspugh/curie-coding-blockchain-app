# 835 Remittance Reconciliation with Suppressed On-Chain Billed Amount

## 2026-05-15 — If `totalBilledCents` is suppressed from the `ClaimBatchSettled` on-chain event, can payer systems still reconcile on-chain settlement proofs with their 835 remittance files using only `(providerHash, batchSize, windowEnd)` — and does this break CAQH CORE Phase IV RTA interoperability?

### Finding 1: CLP03 (Total Charge / Billed Amount) is Required (usage "R") in X12 835 — but comes from the off-chain adapter, not the on-chain event

- The X12 005010X221A1 (HIPAA 835 Health Care Claim Payment/Advice) implementation guide assigns CLP03 a usage status of **"R" (Required)**. CLP03 must contain the total submitted charge from the original 837 CLM02 element. The balancing equation `CLP03 = CLP04 (payment) + CLP05 (patient responsibility) + sum(CAS adjustments)` is foundational to all payer accounts-receivable auto-posting systems.
  — [X12 RFI #2601: Claim line balancing — charged, allowed amount, and PR45](https://x12.org/resources/requests-for-interpretation/rfi-2601-claim-line-balancing-relationship-charged-allowed); [Accountable HQ — HIPAA 835 File Format Example](https://www.accountablehq.com/post/hipaa-835-file-format-example-sample-era-x12-835-with-segments-and-loops-explained)

- Critically, the **off-chain EDI adapter** already holds CLP03 independently of the on-chain event. The adapter's `claimId → CLM01` mapping (established in prior research) stores the full billed amount from the original 837 submission. Suppressing `totalBilledCents` from the `ClaimBatchSettled` Somnia event does not remove this data from the adapter's database — it removes it only from the public chain.
  — Prior research: [docs/research/agreement-layer/on-chain-claim-struct-835-interoperability.md](on-chain-claim-struct-835-interoperability.md); [docs/research/agreement-layer/edi-adapter-payericn-mapping-resilience.md](edi-adapter-payericn-mapping-resilience.md)

### Finding 2: CLP01 (Patient Control Number = CLM01) is the primary reconciliation key — not the on-chain billed amount

- **CLP01 (Claim Submitter's Identifier / Patient Control Number)** is the primary matching key for payer AR auto-posting. Practice management systems match CLP01 from the 835 against the internal claim record to apply the payment. The subscriber ID (NM1*IL) and payer claim control number (CLP07) serve as confirmation identifiers.
  — [Accountable HQ — Unlocking the Mysteries of HIPAA 835](https://www.accountablehq.com/post/unlocking-the-mysteries-of-hipaa-835-file-a-comprehensive-guide); [EDIFILECONVERTER — How to Read an EDI 835](https://www.edifileconverter.com/articles/how-to-read-edi-835)

- **TRN02 (Reassociation Trace Number)** links the ERA to the EFT bank deposit. For EFT payments, TRN02 must be the EFT reference number. The prior research finding that the Somnia transaction hash can serve as TRN02 in the synthetic 835 adapter remains valid — this is an on-chain artefact that does not require `totalBilledCents` to be present in the on-chain event.
  — [X12 RFI #2661: TRN02 Receiver Clarification (835)](https://x12.org/resources/requests-for-interpretation/rfi-2661-trn02-receiver-clarification-835); [X12 RFI #1847: TRN02 Segment in 835](https://x12.org/resources/requests-for-interpretation/rfi-1847-trn02-segment-835)

### Finding 3: CAQH CORE Phase IV RTA explicitly allows payment to be processed after adjudication — 835 is not required in the same session

- **CAQH CORE Phase IV RTA operating rules explicitly state:** "An RTA process may include only the adjudication of a claim in Real Time with the actual claim payment processed at a later date." The 835 is delivered on its normal batch or near-real-time schedule, not necessarily in the same session as the 837 submission or the adjudication event.
  — [Phase IV CAQH CORE 450 Health Care Claim (837) Infrastructure Rule v4.0.0](https://www.caqh.org/sites/default/files/core/phase-iv/450_837-infrastructure-rule.pdf); [CAQH CORE Operating Rules](https://www.caqh.org/core/operating-rules)

- The **277 claim acknowledgment** (not the 835) is the real-time response in an RTA workflow. The 277 is explicitly not a substitute for the 835 and cannot be used for payment posting. The 835 remains the authoritative payment/remittance document regardless of RTA timing.
  — [Anthem BlueCross 276/277 Companion Document](https://www.anthembluecross.com/content/dam/digital/docs/anthembluecross/provider/commercial/general/EDI_CA_00020.pdf)

### Finding 4: CAQH CORE Phase IV RTA interoperability operates at the EDI layer — not at the on-chain event layer

- CAQH CORE Phase IV operating rules govern the **EDI transaction exchange layer** (837 submission, 835 return, EFT reassociation via CCD+/835 Reassociation Rule). They do not govern on-chain events, blockchain state, or the internal data model of settlement systems that feed the 835 generation process.
  — [CAQH CORE Payment and Remittance Operating Rules](https://www.caqh.org/core/caqh-core-payment-and-remittance-operating-rules); [CAQH CORE CCD+/835 Reassociation Rule vPR.1.0](https://www.caqh.org/sites/default/files/core/Payment-Remittance-Reassociation-CCD-835-Rule.pdf)

- The **ACA Section 1104 mandate** (requiring HIPAA-covered entities to comply with Payment & Remittance Operating Rules) applies to the 835 transaction itself. It does not impose requirements on the on-chain event schema used by a settlement layer that feeds a synthetic 835 adapter.
  — [CAQH CORE Operating Rules — ACA mandate](https://www.caqh.org/core/operating-rules); [HealthIT ISP — CAQH CORE EFT/ERA](https://www.healthit.gov/isp/caqh-core-operating-rules-electronic-funds-transfer-eft-electronic-remittance-advice-era)

### Finding 5: The synthetic 835 adapter architecture isolates the on-chain and EDI layers — suppression is architecturally safe

- The off-chain synthetic 835 adapter pattern (established in prior research) generates a HIPAA-conformant 835 from the adapter's own claim database triggered by the `ClaimBatchSettled` (or `ClaimSettled`) Somnia event. The adapter uses:
  - **CLP01** ← original CLM01 from the 837 (adapter database)
  - **CLP03** ← original CLM02 (billed amount) from the 837 (adapter database)
  - **CLP04** ← `adjudicatedCents` from contract state (on-chain, via event or RPC call)
  - **TRN02** ← Somnia transaction hash of the `ClaimBatchSettled` event
  - **BPR02** ← total payment amount (sum of `adjudicatedCents` for the batch, from contract state)

- With this architecture, `totalBilledCents` in the `ClaimBatchSettled` event is redundant for 835 generation. The adapter already has individual-claim `billedCents` in its database. The on-chain event need only provide the settlement trigger and proof of settlement — not the billing amounts.

- **Suppressing `totalBilledCents` from the on-chain event does not break 835 generation, CAQH CORE compliance, or payer AR reconciliation** — provided the adapter maintains its own secure off-chain claim-level billed-amount database (which is required for HIPAA PHI handling anyway, since the full 837 data is PHI-adjacent and cannot go on-chain).

### Finding 6: Residual risk — adapter database as the single source of billed amounts

- If the adapter database is corrupted or unavailable, `billedCents` cannot be reconstructed from the on-chain event (since it was suppressed). This increases adapter database availability requirements.
  - Mitigation: The Ormi subgraph retains all event data but cannot reconstruct billed amounts not emitted. The adapter must maintain a durable, backed-up off-chain database. Fallback: the original 837 file stored in the provider's EHR system is always the authoritative source for CLM02 — a rare but recoverable situation.
  - Per prior research, adapter outage is already a recoverable SPOF via Ormi event replay for the `claimId → ICN` mapping; the same recovery pattern applies here.
  — [docs/research/agreement-layer/edi-adapter-payericn-mapping-resilience.md](edi-adapter-payericn-mapping-resilience.md)

**Design implication:** Suppressing `totalBilledCents` from the `ClaimBatchSettled` on-chain event is architecturally safe and does NOT break CAQH CORE Phase IV RTA interoperability. CAQH CORE governs the EDI transaction layer (835 format, CCD+ reassociation, EFT timing); it does not govern on-chain event schemas. The synthetic 835 adapter generates a fully conformant 835 using CLP03 from its own off-chain database, not from the on-chain event. `adjudicatedCents` (CLP04 equivalent) can be emitted on-chain without disclosure risk since it is the settled payment amount, not the billed amount; but for homogeneous single-specialty providers, even `adjudicatedCents` may require batching per the CV-threshold analysis (previous iteration). Option (b) from the prior iteration — suppress `totalBilledCents`, emit only `(providerHash, batchSize, windowEnd)` — is validated as CAQH CORE-compatible.

**Open questions generated:**
1. Should cliqueue publish a per-provider billing-CV classification methodology as part of the hospital onboarding checklist, so that `minBatchThreshold` is set by the hospital's privacy officer before first contract deployment — and what is the liability exposure if the hospital sets an incorrect (too-low) threshold? — priority: high (already active)
2. Should `minBatchThreshold` configuration be set at the network level (cliqueue governance) or at the hospital level (`HOSPITAL_ADMIN` role), and does allowing hospital-level override create a compliance gap where a hospital reduces its own threshold to 1 (defeating de-identification protection)? — priority: high (already active)
3. Should the `ClaimBatchSettled` event emit `adjudicatedCents` (the payment amount) or suppress it too — and if suppressed, how does the payer agent trigger the 835 adapter without the on-chain settlement amount? Is emitting `adjudicatedCents` lower-risk than `billedCents` because it is the settled (not submitted) amount, and adversarial inference from it is harder? — priority: high, new

---

**See also** — [[../topics/x12|X12 hub]]
