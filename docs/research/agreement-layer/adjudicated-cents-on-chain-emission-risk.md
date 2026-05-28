# adjudicatedCents On-Chain Emission Risk

## 2026-05-15 — Should `ClaimBatchSettled` emit `adjudicatedCents` (the settlement/payment amount) or suppress it — and is `adjudicatedCents` lower re-identification risk than `billedCents` because adversarial inference from the settled amount is harder?

### Finding 1: `adjudicatedCents` is materially lower re-identification risk than `billedCents` — but not risk-free

- `billedCents` (835 CLP03) is the provider's **chargemaster** amount — entirely provider-controlled, highly variable across hospitals, not publicly standardised by payer. It functions as a strong quasi-identifier because an adversary with knowledge of a hospital's chargemaster (increasingly public via Hospital Price Transparency rules, 45 CFR 180) can infer provider identity from a distinctive charge pattern. Suppressing `billedCents` from the on-chain event eliminates this quasi-identifier.
  — [CMS Hospital Price Transparency — 45 CFR 180](https://www.cms.gov/hospital-price-transparency)

- `adjudicatedCents` (835 CLP04) is the **payer's contractual payment** — the amount governed by the in-network negotiated rate applied to the claim. This value is *less* idiosyncratic than the chargemaster amount, but it is NOT unpredictable from external data. Since July 2022, the **Transparency in Coverage (TiC) Final Rule** (45 CFR 147.212) requires all group health plans to publicly publish machine-readable files of **in-network negotiated rates per provider NPI per procedure code**. As of March 2026, plans must comply with schema version 2.0. This means an adversary can download the payer's in-network rate file and look up the expected contract rate for (providerNPI, procedureCode) — making the per-claim `adjudicatedCents` partially predictable.
  — [CMS Transparency in Coverage Final Rule Fact Sheet (CMS-9915-F)](https://www.cms.gov/newsroom/fact-sheets/transparency-coverage-final-rule-fact-sheet-cms-9915-f); [eCFR 45 CFR 147.212](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-147/section-147.212); [CMS Proposed TiC Rule Updates Dec 2025](https://www.federalregister.gov/documents/2025/12/23/2025-23693/transparency-in-coverage)

- **Re-identification inference path for `adjudicatedCents`**: Given (providerHash, adjudicatedCents, batchSize) on-chain, an adversary holds: (1) TiC MRF giving expected per-claim rate for known (NPI, code) pairs; (2) NPPES NPI registry; (3) NPI-to-wallet mapping (CLIQUEUE_DOMAIN_SEPARATOR analysis from prior research). An adversary can narrow to the subset of providers whose TiC rate matches `adjudicatedCents / batchSize` within contract-rate variance. This is a weaker attack than using `billedCents` (less distinctive), but not zero risk for single-specialty or single-payer providers.
  — Prior research: [docs/research/somnia/sbt-hospitalid-npi-hash-hipaa-disclosure.md](../somnia/sbt-hospitalid-npi-hash-hipaa-disclosure.md); [TiC technical implementation guide — CMSgov/price-transparency-guide](https://github.com/CMSgov/price-transparency-guide)

### Finding 2: HIPAA does not list payment amounts among the 18 Safe Harbor identifiers — but Expert Determination still applies

- Payment amounts are **not** among HIPAA's 18 Safe Harbor identifiers (45 CFR 164.514(b)(2)). The 18 Safe Harbor identifiers focus on direct patient-identifying fields (name, address, SSN, DOB, account numbers, etc.) — not on financial transaction amounts as such. The Safe Harbor method does not require removing billing or payment amounts, which is why CMS freely publishes aggregate physician payment data in the Medicare Provider Utilization and Payment Data files.
  — [HHS HIPAA De-identification Guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html); [HHS 2012 De-identification Guidance PDF](https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/understanding/coveredentities/De-identification/hhs_deid_guidance.pdf)

- However, under the **Expert Determination method** (45 CFR 164.514(b)(1)), the expert must ensure the risk of identifying an *individual* is "very small." Payment amounts can function as quasi-identifiers in context. The HHS de-identification guidance (2012) explicitly notes that "rare diagnoses, procedures, or exact event timing" can be quasi-identifiers — the same logic extends to distinctive payment amounts for rare/specialty procedures. The operative question is whether `adjudicatedCents` in combination with (providerHash, batchSize, windowEnd) permits individual patient identification — which is a much higher bar than provider identification.
  — [HHS HIPAA De-identification Guidance § 3.3](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html)

- **Key distinction**: HIPAA's de-identification standard protects **patient** identity, not **provider** identity. Providers are not "individuals" under HIPAA (hospitals and physicians are covered entities or business associates, not protected subjects). An adversary using `adjudicatedCents` to identify a hospital (provider) is not a HIPAA re-identification problem — it is a competitive/commercial sensitivity concern. An adversary using `adjudicatedCents` to identify a specific patient's encounter is a HIPAA concern. For batched events (n≥11 claims per `ClaimBatchSettled` event), the per-claim amount is NOT individually disclosed — only an aggregate is visible — making patient-level re-identification much harder.
  — [45 CFR §164.514 via Cornell LII](https://www.law.cornell.edu/cfr/text/45/164.514)

### Finding 3: TiC MRF out-of-network cell-size threshold confirms n≥11 as the operative standard for payment amount disclosure

- The TiC Final Rule (45 CFR 147.212) requires payers to publish out-of-network **allowed amounts** per (provider, procedure) but mandates **suppression when fewer than 20 different claims** existed for that combination in the lookback period. Proposed rule updates (Dec 2025) would lower this to **11 different claims** — explicitly citing "standard small-cell suppression logic used in other CMS data contexts" as the rationale for the n≥11 threshold.
  — [CMS TiC Proposed Rule Updates (Dec 19 2025)](https://www.federalregister.gov/documents/2025/12/23/2025-23693/transparency-in-coverage); [CMS TiC Proposed Rule Fact Sheet (CMS-9882-P)](https://www.cms.gov/newsroom/fact-sheets/transparency-coverage-proposed-rule-cms-9882-p)

- This directly confirms that CMS's own standard for suppressing per-provider payment amount data is **n<11 claims** — the same threshold as cliqueue's `NETWORK_BATCH_FLOOR = 11`. The TiC suppression rule is a *payer-facing* compliance obligation, but it provides strong precedent that batching n≥11 claims before disclosing any aggregate amount is a defensible CMS-aligned standard for payment amount disclosure.
  — [eCFR 45 CFR 147.212(b)(3)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-147/section-147.212)

### Finding 4: `adjudicatedCents` emission is safe for the payer agent to trigger 835 adapter — but the amount itself is redundant on-chain

- The prior research finding (835-reconciliation-without-on-chain-billed-amount.md) established that the synthetic 835 adapter uses `adjudicatedCents` from on-chain contract state (not from the event) to populate CLP04 in the generated 835. Specifically, the adapter makes an RPC `call` to `ClaimsAdjudicator.getClaimAdjudicatedAmount(claimId)` for per-claim amounts, or reads the `ClaimSettled` event for individual claims.

- For a `ClaimBatchSettled` event, the payer agent trigger requires: (1) a settlement event referencing the provider and window, and (2) access to per-claim amounts for 835 generation. The per-claim amounts are already in contract storage (the `Claim` struct's `adjudicatedCents` field). The payer agent can call `ClaimsAdjudicator.getClaim(claimId)` directly — it does not need `totalAdjudicatedCents` in the batch event itself to reconstruct individual CLP04 values.

- **Implication**: Emitting `totalAdjudicatedCents` in `ClaimBatchSettled` is operationally redundant — the payer agent can retrieve per-claim amounts from contract storage via RPC. The event is a *trigger*, not a *data carrier*. Suppressing `totalAdjudicatedCents` from the event does not prevent 835 generation.
  — [X12 RFI #2604: Secondary payer 835 adjudication — allowed amount](https://x12.org/resources/requests-for-interpretation/rfi-2604-secondary-payer-835-adjudication-allowed-amount); prior research: [docs/research/agreement-layer/835-reconciliation-without-on-chain-billed-amount.md](835-reconciliation-without-on-chain-billed-amount.md)

### Finding 5: The re-identification risk from `adjudicatedCents` is primarily provider-level (not HIPAA patient-level) and is the same category as TiC MRF disclosure

- The adversarial model for `adjudicatedCents` on-chain is: adversary knows (providerHash, totalAdjudicatedCents, batchSize) and wants to infer which hospital this is. They compare `totalAdjudicatedCents / batchSize` to TiC MRF rates for (NPI, code) pairs. This is **provider-level inference**, not patient-level inference.

- HIPAA does not protect provider identity. Hospital and physician identities are public via NPPES. The competitive-sensitivity concern (payers not wanting contract rates exposed) is a **trade-secret / antitrust concern**, not a HIPAA concern. The Antitrust Division has not issued guidance specifically on on-chain contract rate disclosure, but the TiC rule's public MRF mandate largely resolves this: in-network negotiated rates are already publicly required to be disclosed.
  — [Federal Register TiC Final Rule Nov 2020](https://www.federalregister.gov/documents/2020/11/12/2020-24591/transparency-in-coverage)

- **For patient-level re-identification risk**: An adversary would need to link (providerHash, adjudicatedCents, timestamp) to a specific patient encounter. Batched events (n≥11) make per-patient inference mathematically impractical without additional quasi-identifiers. The SDC analysis from the prior iteration (l-diversity, t-closeness, dominance rule) applies to `adjudicatedCents` just as it does to `billedCents` — but with lower base distinguishability because contract rates are published and standardised.

### Finding 6: Recommended design — emit `adjudicatedCents` in batch event as an optional parameter with a homogeneous-provider suppression flag

- **Recommended `ClaimBatchSettled` event schema:**

```solidity
event ClaimBatchSettled(
    bytes32 indexed providerHash,
    uint32 batchSize,
    uint64 windowEnd,
    uint128 totalAdjudicatedCents,  // suppress for CV<10% providers; optional
    bool amountSuppressed           // true if CV<10% threshold applied
);
```

- When `batchThreshold[providerHash]` is configured for CV<10% (high-homogeneity providers, `minBatchThreshold ≥ 50`), set `amountSuppressed = true` and emit `totalAdjudicatedCents = 0`. This signals to the payer agent that it must retrieve per-claim amounts via RPC rather than from the event.

- When `batchThreshold[providerHash]` is configured for CV≥20% providers (standard, `minBatchThreshold = 11`), emitting `totalAdjudicatedCents` is safe — the amount is no more distinctive than what is already published in TiC MRFs.

- This design is more operationally convenient than full suppression (the payer agent can batch-reconcile from the event for standard providers) while applying the right protection for outlier homogeneous providers.

**Design implication:** `adjudicatedCents` carries lower re-identification risk than `billedCents` for two reasons: (1) contract rates are already publicly available via TiC MRFs at the (NPI, code) level, reducing the information gain from on-chain disclosure; (2) it is a patient-level quasi-identifier only in un-batched form — at n≥11 batch size it is consistent with CMS's own TiC out-of-network suppression standard. The operative risk is provider-level inference (not HIPAA-governed). Recommended: emit `totalAdjudicatedCents` in `ClaimBatchSettled` for CV≥20% providers (batch size ≥11) but add an `amountSuppressed` flag and zero the amount for CV<10% homogeneous providers. The `billedCents` suppression decision from prior iterations remains correct and unchanged.

**Open questions generated:**
1. Should the payer agent's RPC fallback for retrieving per-claim `adjudicatedCents` when `amountSuppressed = true` be a Somnia `eth_call` against `ClaimsAdjudicator.getClaim(claimId)` for each claim in the batch — and does issuing n≥50 RPC calls per batch event (for CV<10% providers) create a latency bottleneck for 835 generation at P95 claim volume? — added 2026-05-15, priority: medium
2. Does the TiC MRF's public disclosure of negotiated rates (by NPI + procedure code) create an antitrust concern for cliqueue if `totalAdjudicatedCents` on-chain enables real-time cross-payer rate comparison — and should the Settlement Token Policy document address this? — added 2026-05-15, priority: low
3. Should cliqueue's hospital onboarding CV-classification workflow also classify providers by their TiC MRF coverage (i.e., whether their in-network rates are already public for their specialty mix) — since providers with fully public TiC rates carry no additional re-identification risk from emitting `adjudicatedCents` on-chain? — added 2026-05-15, priority: medium

---

**See also** — [[../topics/x12|X12 hub]] · [[../topics/hipaa|HIPAA hub]]
