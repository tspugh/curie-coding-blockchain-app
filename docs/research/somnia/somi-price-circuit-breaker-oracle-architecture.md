# SOMI Price Circuit Breaker and Oracle Architecture for Off-Chain Agent Cost Management

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should cliqueue's off-chain agent layer implement a `SOMI_PRICE_CIRCUIT_BREAKER` that automatically reduces subcommitteeSize from 5 to 3 when estimated per-claim cost exceeds a configurable ceiling — and is there an on-chain SOMI/USD price oracle on Somnia that the off-chain agent can query?

---

### Finding 1: No SOMI/USD on-chain price feed exists in the Protofire (Chainlink) or DIA oracle deployments on Somnia — only ETH/USD, BTC/USD, USDC/USD feeds are documented

- Somnia's documented oracle ecosystem includes two providers on mainnet: (a) **Protofire Chainlink Price Feeds** — covering ETH, BTC, USDC via the `AggregatorV3Interface` pattern. The official Somnia docs tutorial ("Build a Live Crypto Price dApp Using Protofire Oracle") demonstrates only ETH/USD, BTC/USD, and USDC/USD feeds. No SOMI/USD Protofire feed is documented.
  — [Protofire Price Feeds | Somnia Docs](https://docs.somnia.network/developer/building-dapps/oracles/protofire-price-feeds); [Build a Live Crypto Price dApp | Somnia Docs](https://docs.somnia.network/developer/partners/build-a-live-crypto-price-dapp-using-protofire-oracle)
  — Assessment: High confidence (absence of SOMI/USD from documented feeds). Medium confidence that no SOMI/USD Protofire feed will be added — SOMI is the native gas token and its on-chain price in USD would typically be inferred from DEX TWAP or external oracle, not a first-party Chainlink feed.

- (b) **DIA Oracles** on Somnia mainnet: `DIAOracleV2` contract at `0xbA0E0750A56e995506CA458b2BdD752754CF39C4` supports customizable price feeds including deviation-triggered and heartbeat-triggered updates. DIA's documentation lists a SOMI price adapter and notes that feeds can be configured "as frequently as seconds." However, no specific SOMI/USD feed contract address on Somnia mainnet is published in DIA's chain-specific Somnia guide as of May 2026.
  — [Somnia — DIA Oracles](https://www.diadata.org/docs/guides/chain-specific-guide/somnia); [Integrating DIA Oracles on Somnia | Somnia Docs](https://docs.somnia.network/developer/partners/integrating-dia-oracles-on-somnia)
  — Assessment: Medium confidence (DIA lists SOMI as a requestable feed; a deployed SOMI/USD contract may exist but no documented mainnet address is publicly confirmed).

- **API3 oracles** went live on Somnia mainnet September 10, 2025, featuring OEV (Oracle Extractable Value) recapture. API3 provides dAPI data feeds for any token pair on request. A SOMI/USD API3 dAPI is theoretically requestable but no documented SOMI/USD API3 feed address on Somnia mainnet is confirmed in available sources.
  — Assessment: Low confidence that a ready-to-use SOMI/USD API3 dAPI contract exists on Somnia mainnet without custom deployment.

---

### Finding 2: The practical SOMI/USD price source for the off-chain agent is the CoinGecko/CoinMarketCap REST API — on-chain oracle is unnecessary for circuit-breaker logic

- The off-chain cliqueue agent (TypeScript, `somnia-agent-kit`) runs outside the EVM. It does not need an on-chain oracle to read SOMI/USD price — it can query CoinGecko's free API (`/simple/price?ids=somnia&vs_currencies=usd`) or CoinMarketCap's API directly before constructing each batch transaction. This is architecturally simpler, lower-latency, and more cost-efficient than an on-chain oracle call for the circuit-breaker decision.
  — [CoinGecko API](https://www.coingecko.com/en/api); [Somnia on CoinGecko](https://www.coingecko.com/en/coins/somnia)
  — Assessment: High confidence (standard pattern for off-chain gas cost estimation against USD budgets in EVM agent systems).

- SOMI price at time of this research: $0.1678 USD (May 16, 2026), down from ATH of $1.84. The 12× ATL-ATH range (ATL $0.1482 / ATH $1.84) is the primary financial risk for hospital SOMI reserve sizing.
  — [CoinMarketCap: Somnia](https://coinmarketcap.com/currencies/somnia/)
  — Assessment: High confidence (live market data).

---

### Finding 3: The circuit-breaker logic is entirely off-chain — no Solidity changes required — and should use `getAdvancedRequestDeposit()` as the cost input, not a hardcoded SOMI amount

- Prior research confirmed that `getAdvancedRequestDeposit(subcommitteeSize)` is the correct on-chain helper to query before each `createAdvancedRequest()` call, returning the exact SOMI deposit required for a given subSize. The off-chain agent should:
  1. Query `getAdvancedRequestDeposit(5)` to get the current deposit for sub=5.
  2. Fetch SOMI/USD from CoinGecko (or cached value with a 5-minute TTL).
  3. Compute `estimatedCostUSD = depositSOMI * somiUsdPrice`.
  4. If `estimatedCostUSD > MAX_COST_PER_CLAIM_USD` (configurable, default `0.50`), fall back to sub=3 and recompute.
  5. If sub=3 cost also exceeds a hard ceiling (default `0.25`), log a warning and pause claim submission until price recovers.
  — Synthesis from prior per-claim gas economics research; [Invoking from Solidity | Agents | Somnia Docs](https://docs.somnia.network/agents/invoking-agents/from-solidity)
  — Assessment: High confidence as design synthesis; no primary source documents this exact pattern for Somnia.

- **The Somnia platform's 0.07 SOMI/agent LLM Inference price is a "current fixed rate"** — it is not governed on-chain by a public governance vote per available documentation. The rate can be updated by Somnia platform operators. No SLA or price-lock guarantee is published. Cliqueue cannot assume the 0.07 SOMI rate is immutable.
  — [Gas Fees | Somnia Docs](https://docs.somnia.network/concepts/tokenomics/gas-fees); [Gas Fees for Agents | Somnia Docs](https://docs.somnia.network/agents/invoking-agents/gas-fees)
  — Assessment: High confidence for "not governance-locked"; medium confidence for governance mechanism (no public Somnia platform governance docs found).

---

### Finding 4: SOMI tokenomics create a structural downward price pressure risk through 2029 — the circuit-breaker ceiling should be set conservatively above current ATL pricing

- SOMI's supply schedule: only ~24.3% of the 1 billion hard-cap supply is currently circulating (May 2026). Team (11%), investors (15.15%), and launch partners (15%) allocations vest with multi-year cliffs through 2029. Validator staking requires 5 million SOMI (~$840K at spot) per node, creating buy pressure from infrastructure participants but not sufficient to offset vesting unlock sell pressure.
  — [MEXC: Somnia Tokenomics](https://www.mexc.com/price/SOMI/tokenomics); [CryptoRank: Somnia ICO](https://cryptorank.io/ico/somnia)
  — Assessment: High confidence for supply distribution; medium confidence for price trajectory inference (no authoritative price model available).

- **Design implication for reserve sizing:** With ~75% of SOMI supply still locked and unlocking through 2029, SOMI spot price may remain at or below current levels (~$0.15–0.20) through the cliqueue MVP phase. The circuit-breaker ceiling of $0.50/claim (sub=5) provides 5× headroom above current sub=5 cost (~$0.092). Setting `MAX_COST_PER_CLAIM_USD = 0.50` means the circuit breaker only fires if SOMI price rises to ~$1.25 — which is within the ATH range but above current market. This is a reasonable default ceiling for the hospital's SOMI reserve policy document.
  — Assessment: Medium confidence (price projection based on tokenomics; no financial advice).

---

### Finding 5: No published industry precedent for a "native-token price circuit breaker" in healthcare blockchain agent systems — the pattern is borrowed from DeFi oracle manipulation protection

- Academic and industry literature on healthcare blockchain agent systems (MDPI 2021 token economy study, PMC mechanism design study, Frontiers in Blockchain) does not document native-token volatility circuit breakers for claim-processing cost management. The concept is novel in the healthcare context.
  — [PMC: Mechanism Design of Health Care Blockchain System Token Economy](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8477294/); [MDPI: Blockchain-Based Smart Contract System for Healthcare Management](https://www.mdpi.com/2079-9292/9/1/94)
  — Assessment: High confidence (negative finding; absence of documented precedent in multiple sources).

- In DeFi, automated circuit breakers implement pre-defined conditions (price deviation exceeding X%, liquidity dropping below Y%) that trigger a pause or limit functionality. The LULD (Limit Up-Limit Down) mechanism in US equity markets similarly halts trading when prices move outside a price band. Cliqueue's `SOMI_PRICE_CIRCUIT_BREAKER` is architecturally analogous: a pre-defined cost ceiling triggers a graceful subSize reduction rather than a hard halt.
  — [Cube Exchange: What is a Price Oracle](https://www.cube.exchange/what-is/price-oracle); Circuit breaker analogy from traditional markets.
  — Assessment: High confidence for architectural analogy; design is novel for healthcare claim-processing contexts.

---

**Design implication:** The `SOMI_PRICE_CIRCUIT_BREAKER` is a purely off-chain TypeScript pattern — no Solidity changes required in `ClaimsAdjudicator`. The off-chain agent should query `getAdvancedRequestDeposit(subSize)` on-chain + CoinGecko REST API off-chain to compute `estimatedCostUSD` per claim before each batch submission, then apply a two-tier ceiling: (1) if `estimatedCostUSD(sub=5) > $0.50`, reduce to sub=3; (2) if `estimatedCostUSD(sub=3) > $0.25`, pause and alert. No on-chain SOMI/USD oracle feed exists that is ready-to-use on Somnia mainnet (Protofire covers ETH/BTC/USDC; DIA and API3 may support a SOMI feed on request but no deployed mainnet address is confirmed). The off-chain REST API approach (CoinGecko with 5-minute TTL cache) is sufficient and preferred. SOMI tokenomics (75% supply still locked through 2029) create structural downward price pressure that makes the current $0.092/claim (sub=5) cost likely to remain stable or decrease through the MVP phase — but the 12× ATL-ATH historical range mandates the circuit breaker as a production safeguard.

**Open questions generated:**
1. Should the `SOMI_PRICE_CIRCUIT_BREAKER` ceiling values (`$0.50` for sub=5, `$0.25` for sub=3) be published as configurable constants in the hospital BAA Settlement Finality Exhibit — so hospital finance teams can set their own per-claim cost ceiling rather than accepting cliqueue's default — and does giving hospitals this control affect the BAA scope? — added 2026-05-16, priority: medium
2. Should the off-chain agent's SOMI price cache TTL (5 minutes suggested) be shortened to 1 minute during high-volatility periods (e.g., SOMI 24h move > 5%) — and is there a CoinGecko API webhook or push notification for price threshold crossings that would let the agent react to price spikes without polling? — added 2026-05-16, priority: low
3. Has the Somnia platform published a formal commitment to advance notice before changing the 0.07 SOMI/agent LLM Inference price — and should cliqueue's deployment documentation include a monitoring step (subscribe to Somnia governance announcements) to detect fee changes before they affect hospital SOMI reserve sizing? — added 2026-05-16, priority: high

---

**See also** — [[../topics/settlement-stablecoin|settlement hub]]
