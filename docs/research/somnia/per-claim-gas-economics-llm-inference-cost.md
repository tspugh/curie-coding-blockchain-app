# Somnia Per-Claim Gas Economics: LLM Inference Cost vs. $4–10 Outsourced Coding Benchmark

## 2026-05-16 — What is the actual per-claim cost (USD) for a Somnia native `createAdvancedRequest(subcommitteeSize=5)` LLM Inference call, and does it validate cliqueue's core economic thesis?

**Sources:**
- Somnia Agents gas fees: https://docs.somnia.network/agents/invoking-agents/gas-fees
- Somnia Agents Solidity invocation: https://docs.somnia.network/agents/invoking-agents/from-solidity
- Somnia gas model: https://docs.somnia.network/concepts/tokenomics/gas-fees
- Somnia gas differences from Ethereum: https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum
- SOMI price (May 16 2026): CoinMarketCap ~$0.168; range ATL $0.1482 / ATH $1.84
- Corti Symphony cost: https://docs.somnia.network/agents/invoking-agents/gas-fees (Symphony cost from prior research: $0.012–0.025/claim)
- PMC study on generative AI costs in healthcare RCM: https://pmc.ncbi.nlm.nih.gov/articles/PMC12485018/

---

### Official Somnia Agent Pricing (as of May 2026)

Published fixed rates from `docs.somnia.network/agents/invoking-agents/gas-fees`:

| Agent Type         | Per-Agent Price | Description                                  |
|--------------------|-----------------|----------------------------------------------|
| JSON API Request   | 0.03 SOMI       | Single HTTP call, minimal compute            |
| LLM Inference      | 0.07 SOMI       | GPU-backed model, dominant cost is token throughput |
| LLM Parse Website  | 0.10 SOMI       | LLM inference + browser session + page render |

`minPerAgentDeposit` (operations reserve floor): **0.01 SOMI per agent slot**

### Deposit Formula

```
msg.value = (minPerAgentDeposit × subcommitteeSize) + (per_agent_price × subcommitteeSize)
```

For LLM Inference:

| subcommitteeSize | Operations Reserve | Agent Reward Pot      | Total msg.value |
|------------------|-------------------|-----------------------|-----------------|
| 3 (default)      | 0.03 SOMI         | 0.21 SOMI             | **0.24 SOMI**   |
| 5 (high-security)| 0.05 SOMI         | 0.35 SOMI             | **0.40 SOMI**   |

### USD Cost at Current SOMI Price ($0.168, May 16 2026)

| subcommitteeSize | SOMI deposit | USD cost (spot) | USD cost (ATH $1.84) | USD cost (ATL $0.1482) |
|------------------|--------------|-----------------|----------------------|------------------------|
| 3                | 0.24 SOMI    | $0.040          | $0.442               | $0.036                 |
| 5                | 0.40 SOMI    | $0.067          | $0.736               | $0.059                 |

### Full Per-Claim Pipeline Cost (Combined)

Including Corti Symphony off-chain coding (~$0.012–0.025/claim, token-based) and ClaimsAdjudicator EVM state machine gas (~$0.0023/claim worst case at 0 TPS):

| Component                  | Cost range / claim |
|----------------------------|--------------------|
| Corti Symphony (off-chain) | $0.012–$0.025      |
| Somnia native LLM sub=3    | $0.036–$0.040      |
| Somnia native LLM sub=5    | $0.059–$0.067      |
| ClaimsAdjudicator EVM gas  | $0.0002–$0.0023    |
| **Total (sub=3 at spot)**  | **$0.054–$0.068**  |
| **Total (sub=5 at spot)**  | **$0.082–$0.095**  |
| **Total (sub=5 at ATH)**   | **$0.762–$0.775**  |
| **Total (sub=5 at ATL)**   | **$0.071–$0.084**  |

### Comparison to $4–10 Outsourced Coding Benchmark

| Scenario                          | Combined cost | Savings vs. $4 floor | Savings vs. $10 ceiling |
|-----------------------------------|---------------|----------------------|-------------------------|
| sub=3, spot SOMI ($0.168)         | ~$0.066       | ~60×                 | ~152×                   |
| sub=5, spot SOMI ($0.168)         | ~$0.092       | ~43×                 | ~109×                   |
| sub=5, ATH SOMI ($1.84)           | ~$0.768       | ~5.2×                | ~13×                    |
| sub=5, ATL SOMI ($0.1482)         | ~$0.080       | ~50×                 | ~125×                   |

**Even at the SOMI all-time high, sub=5 is 5× cheaper than the $4/claim outsourced floor.**

### Key Caveats

- The 0.07 SOMI / 0.10 SOMI prices are the platform's published "current fixed rates" — they may be revised as validator costs stabilize. No SLA or formal price-lock guarantee is documented.
- `getAdvancedRequestDeposit(subcommitteeSize)` is the on-chain helper for querying the exact deposit; cliqueue's `ClaimsAdjudicator` should call this dynamically rather than hardcoding the SOMI amount.
- SOMI price volatility (12× range from ATL to ATH) is the dominant cost uncertainty. At ATH, the economics are still favorable but the per-claim cost rises to ~$0.77, which erodes the margin vs. human-in-the-loop coding for complex inpatient DRGs.
- The operations reserve (`minPerAgentDeposit × subSize`) is "operator-configurable" — the platform operator can adjust it. This is a non-SOMI risk: if the platform raises `minPerAgentDeposit`, total deposits increase.
- The PMC August 2025 study on generative AI in healthcare RCM found ICD classification costs of $103k–$4.2M/year at GPT-4.1 pricing for a large health system (~10,000 claims/month), implying ~$0.87–$35/claim — Somnia's architecture is 10–500× cheaper for the oracle validation layer.
- No published per-claim benchmarks exist for Somnia Agents in healthcare deployments specifically (weakly sourced extrapolation).

**Design implication:** The core economic thesis is strongly validated at current SOMI pricing. cliqueue's per-claim cost ceiling at sub=5 spot price ($0.092) is 43–109× below the outsourced benchmark and remains favorable even at SOMI ATH ($0.77, 5× below $4 floor). The primary financial risk is SOMI price volatility — cliqueue should implement a SOMI reserve buffer monitored against a configurable `maxCostPerClaimCents` guard in the off-chain agent layer, with automatic failover to sub=3 if the spot cost exceeds a threshold (e.g., 50¢/claim). Use `getAdvancedRequestDeposit()` dynamically; never hardcode SOMI deposit amounts.

**Open questions generated:**
1. Should cliqueue's off-chain agent layer implement a `SOMI_PRICE_CIRCUIT_BREAKER` that automatically reduces subcommitteeSize from 5 to 3 when the estimated per-claim cost exceeds a configurable ceiling (e.g., $0.50), rather than blocking claim submission entirely?
2. Is the Somnia platform's 0.07 SOMI/agent LLM Inference price fixed at the protocol level or can it be updated by Somnia governance — and should cliqueue's deployment docs disclose this pricing-change risk to hospital procurement teams alongside the SOMI reserve buffer requirement?
3. At a 10,000 claim/day volume, cliqueue's daily SOMI reserve requirement (sub=5) is 4,000 SOMI/day (~$672/day at spot) — should the hospital or cliqueue hold this reserve, and how does SOMI's ~12× ATL-ATH volatility range affect the reserve sizing rule?

---

**See also** — [[../topics/corti|Corti hub]] · [[../topics/settlement-stablecoin|settlement hub]] · [[../topics/somnia-substrate|Somnia substrate hub]]
