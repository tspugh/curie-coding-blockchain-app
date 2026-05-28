# Batch Aggregation Insufficiency for Homogeneous Single-Specialty Providers

## 2026-05-15 — For a batched `ClaimBatchSettled` event emitting `totalBilledCents` for n≥11 claims, does the aggregate amount still constitute a re-identification risk if the provider treats only one DRG code group — and at what coefficient of variation in billing amounts does batch aggregation become insufficient as a mitigation?

### Finding 1: The homogeneity problem invalidates count-based thresholds when sensitive attribute values are near-uniform

- The **homogeneity attack** is the canonical failure mode of k-anonymity: even when an equivalence class contains k≥11 records, if all members share the same or near-identical sensitive attribute value, an adversary can perform attribute disclosure — inferring the sensitive value with high confidence without identity disclosure. The Machanavajjhala et al. l-diversity paper (ACM TKDD 2007) formalised this: *"if all tuples in a q-block have the same sensitive attribute value, knowing that the target is in the block is equivalent to knowing the target's sensitive value."*
  — [l-Diversity: Privacy Beyond k-Anonymity, ACM TKDD 2007](https://dl.acm.org/doi/10.1145/1217299.1217302)

- For a single-specialty orthopedic practice that exclusively performs total knee replacements (DRG 470), billing amounts are near-identical: CMS FY2025 MS-DRG 470 average Medicare payment is ~$18,400, with minimal variance across a homogeneous patient population. A `ClaimBatchSettled` event emitting `totalBilledCents` for n=11 such claims produces `totalBilledCents ≈ 11 × $18,400 = $202,400` — a near-deterministic value. An adversary holding payer 835 files for that specialty can determine with high confidence that this batch event corresponds to a specific provider's settlement cycle, even without directly linking a patient.
  — [CMS MS-DRG 470 FY2025 rates](https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/fy-2025-ipps-final-rule-home-page)

### Finding 2: SDC magnitude-data sensitivity rules (dominance rule, p%-rule) formalise the homogeneity risk for aggregate amounts

- Statistical Disclosure Control theory provides the established framework for aggregate-amount sensitivity beyond simple count thresholds. For **magnitude tables** (tables of summed values rather than frequencies), two sensitivity rules apply:
  - **(n,k) Dominance Rule**: a cell is sensitive if its top-n contributors account for more than k% of the cell total. For a homogeneous single-DRG provider, the top 1 contributor (the one billing pattern) contributes effectively 100% of the total — the cell is sensitive under any reasonable k (e.g., k=70%, n=1).
  - **p%-Rule**: a cell is sensitive if any contributor's value can be estimated to within p% by competitors. For a uniform-billing provider, any observer with market knowledge can estimate the per-claim amount within <5%, making every aggregate cell sensitive under standard federal agency thresholds (p=10 or p=20).
  — [UNECE SDC Safety Rules, 2005](https://unece.org/fileadmin/DAM/stats/documents/ece/ces/ge.46/2005/wp.30.e.pdf); [NCES Statistical Policy Working Paper 22](https://nces.ed.gov/FCSM/pdf/SPWP22_rev.pdf); [ABS Treating Aggregate Data](https://www.abs.gov.au/about/data-services/data-confidentiality-guide/treating-aggregate-data)

- The Torra & Navarro-Arribas 2023 peer-reviewed paper ("Attribute disclosure risk for k-anonymity: the case of numerical data," *International Journal of Information Security*, Springer) explicitly extends this to k-anonymised microdata: attribute disclosure occurs with numerical sensitive attributes even at k≥11 when the within-group variance is very low. The paper uses tabular SDC sensitivity rules (dominance and p%) to detect cases where k-anonymity fails to protect numerical attributes.
  — [Attribute disclosure risk for k-anonymity: numerical data, Springer IJIS 2023](https://link.springer.com/article/10.1007/s10207-023-00730-x); [preprint PDF](https://deic.uab.cat/~gnavarro/files/papers/2023--ijis.pdf)

### Finding 3: l-diversity and t-closeness — the established remedies — are inapplicable to on-chain batch events as currently designed

- **l-diversity** requires that each equivalence class contain at least l *distinct* sensitive attribute values (or meet an entropy condition). For `ClaimBatchSettled`, there is only one emitted aggregate value per provider per batch — it cannot by construction contain l-diverse internal values. A batch event is structurally a 1-record equivalence class.
  — [l-Diversity: Privacy Beyond k-Anonymity](https://www.cs.rochester.edu/u/muthuv/ldiversity-TKDD.pdf)

- **t-closeness** requires the within-group distribution of sensitive values to match the global distribution (measured via Earth Mover's Distance). A single aggregate value has no internal distribution to compare. Neither l-diversity nor t-closeness can be enforced on the emitted event level — they would need to operate on the *claim-level records held in contract storage* before the event is emitted.
  — [t-Closeness: Privacy Beyond k-Anonymity and l-Diversity, IEEE ICDE 2007](https://www.cs.purdue.edu/homes/ninghui/papers/t_closeness_icde07.pdf)

- **Implication**: cliqueue cannot rely solely on count-based batching (n≥11) for homogeneous single-specialty providers. Additional protections at the event-emission layer are required.

### Finding 4: No published coefficient of variation threshold exists in HIPAA or SDC literature; proxies are derivable

- No peer-reviewed SDC paper or HHS/CMS policy document publishes a CV-based threshold for aggregate amount disclosure risk. The SDC literature uses dominance and p%-rules rather than CV directly, because those rules directly encode the attacker model (adversary with partial market knowledge).

- However, a workable CV-based **proxy** can be derived from the dominance rule logic:
  - For a batch of n claims, if all amounts are nearly identical (CV → 0%), the total is `n × mean` and the per-claim amount is trivially reconstructed by an adversary who knows n.
  - The p%-rule becomes satisfied (cell is *not* sensitive) only when the variance is high enough that no individual contributor's exact value can be estimated within p%. For p=20%, this requires that the billing amount distribution have a standard deviation ≥ 20% of the mean — i.e., **CV ≥ 20%**.
  - For context: CMS's own Medicare inpatient payment data shows within-DRG CV of approximately 15–40% across a mixed inpatient population. Single-specialty providers billing a single DRG consistently have empirical CV of 2–8% (near-uniform). Multi-specialty or mixed-DRG providers typically have CV of 30–80%.
  — Derived from: [CMS Geographic Variation PUF Standardisation Methodology v.2](https://www.cms.gov/Research-Statistics-Data-and-Systems/Statistics-Trends-and-Reports/Medicare-Geographic-Variation/Downloads/Geo_Var_PUF_Technical_Supplement.pdf); [NCES SDC Working Paper 22](https://nces.ed.gov/FCSM/pdf/SPWP22_v.pdf); [UNECE SDC Safety Rules](https://unece.org/fileadmin/DAM/stats/documents/ece/ces/ge.46/2005/wp.30.e.pdf)
  — **Caveat**: the CV≥20% threshold is a reasoned proxy, not a cited standard. It would need to be validated by an independent expert determination under §164.514(b)(1) before use in a deployed cliqueue system.

### Finding 5: The ASPE HHS 2014 "mosaic effect" report identifies homogeneous open-data release as a primary disclosure pathway

- The HHS ASPE report "Minimizing Disclosure Risk in HHS Open Data Initiatives" (Mathematica Policy Research, 2014) identifies the **mosaic effect** — combining released data with external sources — as the primary risk pathway for aggregate HHS data releases. It specifically notes that homogeneous provider populations (e.g., specialty practices billing a narrow set of procedures) are high-risk contexts for aggregate magnitude data release because external payer data can serve as the mosaic partner.
  — [ASPE HHS Minimizing Disclosure Risk Final Report, 2014](https://aspe.hhs.gov/sites/default/files/private/pdf/77196/rpt_Disclosure.pdf)

- The recommended mitigation in that report is the same as CMS's PUF approach: suppress cells that meet dominance rule criteria, not just those below the frequency threshold. This validates the need for cliqueue to apply magnitude-based sensitivity rules, not just count-based thresholds.

### Finding 6: Practical CV-stratified batch threshold design for `ClaimsAdjudicator`

Based on the above, the following tiered design is defensible:

| Provider billing CV | Risk level | Recommended `minBatchThreshold` |
|---|---|---|
| CV < 10% (single-DRG homogeneous) | High — dominance rule triggered | ≥ 50 claims, or suppress `totalBilledCents`; emit only `batchSize` |
| CV 10–20% (near-homogeneous) | Medium — p%-rule sensitivity | ≥ 20 claims (aligns with k=20 "extremely high consequences" standard) |
| CV ≥ 20% (mixed/diverse billing) | Low — standard cell-size rule | ≥ 11 claims (CMS PUF n≥11 standard) |

The CV for a given `providerHash` cannot be computed on-chain from prior events (would require accessing historical billing distributions). This means CV-stratified thresholds must be configured at onboarding time (off-chain, as part of the hospital network provider configuration) and stored in contract state as a per-`providerHash` `batchThreshold` mapping.

Alternatively, `ClaimsAdjudicator` can suppress `totalBilledCents` entirely and emit only `(providerHash, batchSize, windowEnd)` — deferring amount disclosure to the off-chain 835 reconciliation path — which eliminates the dominance-rule risk regardless of CV.

**Design implication:** The n≥11 CMS cell-size threshold is *insufficient* for single-specialty providers with CV < 20% billing distributions. `ClaimsAdjudicator` should either (a) enforce a higher per-provider `minBatchThreshold` (50+ for homogeneous specialties) configured at onboarding, or (b) suppress `totalBilledCents` in the on-chain `ClaimBatchSettled` event and instead emit amounts only in the off-chain 835 adapter path where HIPAA BAA protections apply. Option (b) is the more conservative and implementation-simpler design: the on-chain event proves settlement occurred (batch size, provider, window) without disclosing the aggregate dollar fingerprint.

**Open questions generated:**
1. If `totalBilledCents` is suppressed from the `ClaimBatchSettled` on-chain event, can payer systems still reconcile on-chain settlement proofs with their 835 remittance files using only `(providerHash, batchSize, windowEnd)` — and does this break any CAQH CORE Phase IV RTA interoperability requirement? — priority: high
2. Should cliqueue publish a per-provider billing-CV classification methodology as part of the hospital onboarding checklist, so that the `minBatchThreshold` value is set by the hospital's own privacy officer before the first contract deployment — and what is the legal liability exposure if the hospital sets an incorrect (too-low) threshold? — priority: high
3. Is there a ZK proof pattern (e.g., ZK range proof) that could allow `ClaimsAdjudicator` to publish a provably correct `totalBilledCents` value while simultaneously proving CV≥20% without revealing the individual claim distribution — as an alternative to threshold suppression? — priority: medium (post-MVP)

---

**See also** — [[../topics/hipaa|HIPAA hub]]
