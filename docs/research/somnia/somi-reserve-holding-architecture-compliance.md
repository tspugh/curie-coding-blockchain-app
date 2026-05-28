# SOMI Reserve Holding Architecture and Compliance

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should the hospital or cliqueue hold the SOMI reserve for LLM Inference deposits, and does the holding structure create a securities or money-transmission compliance issue?

**Background:** At 10,000 claims/day with `subcommitteeSize=5`, cliqueue's `ClaimsAdjudicator` must deposit 0.40 SOMI per claim = 4,000 SOMI/day (~$672/day at spot SOMI $0.168). The holding entity for this reserve (hospital vs. cliqueue) determines the regulatory classification. Three prior findings established: (a) 0.07 SOMI/agent LLM Inference is the current platform rate; (b) a SOMI price circuit-breaker should govern sub=5→3 failover; (c) SOMI tokenomics have 78% locked supply through 2029.

### Finding 1: SOMI is a digital commodity — holding it does not create securities exposure

- The SEC-CFTC Joint Interpretive Release (March 17, 2026) introduced a five-category digital asset taxonomy. Native blockchain gas tokens — assets "required to execute any transaction or smart contract on the network" — are classified as **digital commodities**, not securities. The guidance explicitly states these tokens derive value from "programmatic operation of a functional crypto system," not from the essential managerial efforts of others.
  — [WilmerHale: SEC's New Framework for Crypto Assets Under Howey (March 2026)](https://www.wilmerhale.com/en/insights/client-alerts/20260324-the-secs-new-framework-for-crypto-assets-under-howey); [Katten: SEC and CFTC Provide Crypto Clarity (March 2026)](https://katten.com/the-sec-and-cftc-provide-crypto-clarity-most-crypto-assets-are-not-securities)

- SOMI is Somnia's native gas token: all transactions, smart contract calls, and LLM Inference requests are paid in SOMI. Under the March 2026 taxonomy, SOMI is structurally identical to ETH or SOL — a digital commodity used to pay validators who process transactions. Holding SOMI to pay operational gas fees does not constitute holding a security, regardless of whether the holder is a hospital, healthcare enterprise, or protocol operator.
  — [Somnia Docs: Gas Fees](https://docs.somnia.network/concepts/tokenomics/gas-fees); [CoinMarketCap: What Is Somnia (SOMI)](https://coinmarketcap.com/cmc-ai/somnia/what-is/)
  — Assessment: High confidence. The March 2026 SEC-CFTC framework is the most current authoritative guidance and explicitly covers native blockchain gas tokens.

### Finding 2: FinCEN 2019 "own account" exemption applies — the hospital holding SOMI for its own operations is a "user," not an MSB

- FinCEN's May 2019 CVC guidance (FIN-2019-G001) establishes a three-tier classification: **user** (holds/spends CVC for own account), **exchanger** (trades CVC for others), **administrator** (issues/redeems CVC). Only exchangers and administrators are money transmitters subject to MSB registration.
  — [FinCEN FIN-2019-G001](https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf); [FinCEN.gov: Application of Regulations to CVC Business Models](https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models)

- A hospital holding a SOMI reserve on its own balance sheet and spending it to invoke LLM Inference agents for its own claims processing is a **user** under FIN-2019-G001. It is not transmitting SOMI to third parties, not accepting SOMI on behalf of others, and not acting as an administrator. No MSB registration is required. The same applies to cliqueue if cliqueue holds SOMI exclusively to fund its own protocol operations and refunds are not passed through to third-party hospitals.
  — [FinCEN MSB Guidance — Hodder Law analysis](https://hodder.law/fincen-crypto-guidance/); [O'Melveny: FinCEN Speaks Crypto](https://www.omm.com/insights/alerts-publications/fincen-speaks-crypto-extensive-new-guidance-for-icos-digital-wallets-dapps-trading-platforms-decentralized-exchanges-and-others-in-the-blockchain-and-crypto-space/)
  — Assessment: High confidence for the hospital self-holding structure. **Risk flag**: If cliqueue holds a pooled SOMI reserve funded by multiple hospitals and allocates/refunds per-hospital, this shifts toward the "exchanger" category and likely triggers MSB status. The pool structure must be avoided.

### Finding 3: The protocol escrow model means SOMI is held by cliqueue only transiently — not custodied long-term

- The Somnia `AgentRequester` contract holds the SOMI deposit in escrow within its own `remainingBudget` field for the duration of the LLM Inference request (seconds to minutes). The calling contract (`ClaimsAdjudicator`) sends SOMI to the platform contract at invocation time and receives the unused operations reserve rebate automatically on finalisation.
  — [Somnia Docs: Gas Fees for Agents](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)

- This means `ClaimsAdjudicator` itself holds zero SOMI between claim invocations. SOMI enters the contract only as `msg.value` at call time and leaves immediately to the platform escrow. The hospital wallet (EOA or multisig) holds the reserve balance between invocations. cliqueue's contract code does not custody SOMI — this eliminates any argument that `ClaimsAdjudicator` is a digital asset custodian.
  — Assessment: High confidence from documented Somnia deposit architecture.

### Finding 4: Recommended holding architecture — hospital holds SOMI on its own balance sheet (Architecture H)

Three viable structures, ranked by compliance risk:

| Architecture | Who holds SOMI | Compliance risk | Recommended |
|---|---|---|---|
| **H — Hospital-held** | Hospital treasury wallet/multisig | Lowest — hospital is a "user" under FIN-2019-G001, not an MSB | Yes — recommended for MVP |
| **C — cliqueue-pooled** | cliqueue holds pooled reserve, allocates per-hospital | MSB risk if cliqueue is deemed to be transmitting SOMI on behalf of hospital customers | Avoid — requires FinCEN MSB analysis |
| **JIT — just-in-time** | No reserve; hospital buys SOMI at submission time via DEX | SOMI price exposure concentrated at claim submission time; DEX liquidity risk at scale | Viable fallback for low-volume deployments |

**Architecture H is the recommended MVP path**: the hospital's treasury team acquires and holds SOMI via a regulated exchange or OTC desk. The hospital's CFO signs a "Digital Asset Treasury Policy" covering SOMI as an operational commodity. cliqueue's onboarding checklist includes a SOMI reserve onboarding step with a recommended reserve buffer calculation.

### Finding 5: SOMI vesting creates structural downward price pressure through September 2029 — reserve buffer rule must account for this

- Somnia TGE occurred September 2, 2025. At TGE, only 16.02% of total 1B SOMI supply was circulating. Team tokens (11%) and investor tokens (15.5%) both have 12-month cliffs, meaning major unlock waves begin in **September 2026** — 4 months from now.
  — [GlobeNewswire: Somnia Mainnet and SOMI Launch (Sep 2025)](https://www.globenewswire.com/news-release/2025/09/02/3143031/0/en/Somnia-Launches-Mainnet-and-SOMI-Token-to-Power-Real-World-Applications-Following-10-Billion-Testnet-Transactions.html); [Messari: SOMI TGE Report](https://messari.io/report/understanding-somnia-token-generation-event)

- The approaching September 2026 cliff unlock introduces material sell pressure risk for SOMI price. Price prediction sources estimate SOMI trading $0.26–$0.37 in 2026, but the cliff unlock of team + investor tokens (~26% of total supply entering vesting) is a downward pressure event. A hospital holding SOMI at current spot ($0.168) faces potential mark-to-market losses if the cliff unlock suppresses SOMI price below ATL ($0.1482).
  — [CoinMarketCap SOMI Price Prediction 2026](https://coinmarketcap.com/cmc-ai/somnia/price-prediction/); [Stealthex SOMI Price Prediction](https://stealthex.io/blog/somnia-price-prediction-is-somi-coin-a-good-investment/)
  — Assessment: Medium confidence (price predictions are speculative; cliff unlock impact is structural but magnitude uncertain).

- **Conservative reserve sizing rule**: Hold a 30-day SOMI buffer calculated at **2× the 6-month average SOMI price** (not spot), reviewed monthly. At current spot ($0.168), 30-day buffer for 10,000 claims/day = 4,000 SOMI/day × 30 days = 120,000 SOMI × 2 price multiplier = 240,000 SOMI (~$40,320 at spot, ~$441,600 at ATH). Hospitals with <1,000 claims/day may use a 90-day buffer at spot × 1.5 given the smaller absolute position.

### Finding 6: IRS tax treatment of hospital SOMI holdings — property, not currency; gains are taxable

- The IRS treats virtual currency as property for federal tax purposes (Notice 2014-21). A hospital holding SOMI and spending it for gas fees triggers a taxable disposal event each time SOMI is spent (gain/loss = fair market value at disposal minus basis). For a nonprofit hospital (501(c)(3)), this is not income tax but affects unrelated business income (UBTI) analysis if SOMI positions generate gains.
  — [IRS: FAQ on Virtual Currency Transactions](https://www.irs.gov/individuals/international-taxpayers/frequently-asked-questions-on-virtual-currency-transactions)
  — Assessment: High confidence on the property classification. **Practical implication**: the hospital's accounting team must track SOMI cost basis per lot (FIFO or specific ID) for each claim submission spend. This is a non-trivial operational burden at high claim volume. cliqueue's hospital onboarding checklist must include a note recommending the hospital engage its tax counsel before SOMI reserve onboarding.

**Design implication:** The hospital holds SOMI on its own balance sheet (Architecture H) — this is a "user" under FinCEN 2019, a digital commodity holder under the March 2026 SEC-CFTC taxonomy, and a property holder for IRS purposes. cliqueue must not hold pooled SOMI on behalf of multiple hospital customers (MSB risk). The `ClaimsAdjudicator` deployment runbook must include a SOMI reserve onboarding checklist covering: (a) exchange/OTC acquisition, (b) hospital wallet/multisig setup, (c) 30-day reserve buffer calculation at 2× 6-month average SOMI price, (d) hospital tax counsel engagement for cost basis tracking, and (e) a monthly reserve review triggered by the SOMI price circuit breaker. The approaching September 2026 cliff unlock must be documented in the hospital onboarding package as a near-term SOMI price risk factor.

**Open questions generated:**
1. Should the SOMI reserve sizing rule (30-day buffer at 2× 6-month average price) be published in the hospital BAA as a "SOMI Reserve Exhibit" — binding the hospital to maintaining a minimum buffer before any claim submission — and what is cliqueue's liability if the hospital's reserve is depleted mid-batch causing stuck claims?
2. Does the approaching September 2026 SOMI cliff unlock (team + investor tokens, ~26% of supply) justify delaying MVP hospital onboarding until Q4 2026 when the post-unlock price floor is established — or should cliqueue recommend hospitals acquire SOMI post-cliff rather than pre-cliff to avoid holding a depreciating position?
3. Is there a SOMI staking option (Everstake reports 21% APR) that allows the hospital to earn yield on its reserve buffer while maintaining sufficient liquid SOMI for daily claim throughput — and does staking SOMI change the IRS tax treatment from "property held for operational use" to "investment generating income"?

---

**See also** — [[../topics/settlement-stablecoin|settlement hub]]
