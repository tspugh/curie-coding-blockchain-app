# AgentVault Daily-Limit Calibration and Stablecoin Settlement Rails

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — AgentVault daily-limit calibration at scale, and the stablecoin settlement rail for actual claim fund release

### The question

The backlog framed this as: "At scale ($631/claim × 10,000 claims/day), is a multi-vault fan-out pattern needed?" That framing conflated two distinct financial flows. The investigation resolves the conflation and determines the correct architecture for each.

---

### Finding 1: AgentVault manages agent invocation deposits — not claim settlement amounts

The AgentVault contract (`createVault(address agent, uint256 dailyLimit)`) enforces a hard-coded limit of **0.01–100 ether (SOMI) per day**. This applies to agent runtime deposits — the SOMI sent with each `createRequest`/`createAdvancedRequest` call to pay validator runners.

- LLM Inference agent invocation cost (subcommittee=3): **0.24 SOMI ≈ $0.042/claim** at $0.176 SOMI.
- LLM Inference agent invocation cost (subcommittee=5): **0.40 SOMI ≈ $0.070/claim**.
- At 10,000 claims/day, the daily agent invocation budget is **2,400–4,000 SOMI ≈ $422–$704/day**.
- 100 ether (100 SOMI) daily limit = ~$17.60/day — this is orders of magnitude below the $422–$704/day needed at 10,000 claims/day.

**The AgentVault 100 SOMI daily limit is a hard architectural blocker at scale for agent invocation deposits.** It is not a claim settlement limit — but it still requires multi-vault fan-out for the agent invocation layer.
— [somnia-agent-kit GitBook: AgentVault](https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/agent-vault); [Local reference: docs/reference/somnia-agent-kit/agent-vault.md]

---

### Finding 2: Claim settlement amounts ($631/claim) belong on a separate stablecoin escrow layer

The $631/claim average denied-claim adjudicated value (and the full billedCents / adjudicatedCents amounts in the Claim struct) are **never** routed through AgentVault. The ClaimsAdjudicator contract holds claim settlement escrow independently. Two viable stablecoin rails exist on Somnia mainnet as of May 2026:

**USDso (Frax Finance, announced May 2026):**
- Issued by Frax Finance on Somnia mainnet using the frxUSD reserve-backed architecture.
- Backed by tokenized U.S. Treasuries; mintable 1:1 by depositing USDC on Somnia.
- Positioned for "high-frequency trading, DeFi, and on-chain protocol scenarios."
- Over-collateralized (~102% as of launch); 90% of reserve yield returned to Somnia DeFi protocols.
- **No healthcare-specific compliance documentation or enterprise custody arrangement published.**
- No contract addresses published as of May 2026 (announcement phase, not yet mainnet-deployed).
— [crypto.news: Somnia taps Frax to launch USDso](https://crypto.news/somnia-taps-frax-to-launch-usdso-stablecoin-for-high-frequency-defi/)

**USDC (bridged via Somnia bridge):**
- Somnia supports ERC20 tokens including USDC via standard bridge infrastructure (Thirdweb bridge confirmed operational).
- USDC is issued by Circle under a regulated, audited framework with existing enterprise adoption.
- No Somnia-native USDC deployment is formally documented, but EVM compatibility makes bridged USDC deployable.
- USDC-denominated settlement is preferred for hospital and payer accounting integration (USD-pegged, familiar, Circle BAA-compatible for healthcare contexts).
— [thirdweb: Somnia chain info](https://thirdweb.com/somnia); [Circle: USDC](https://www.circle.com/usdc)

**Circle AI escrow precedent (2025):**
- Circle deployed an experimental AI-powered escrow agent combining OpenAI models + USDC smart contracts for automated agreement verification and payment settlement.
- This precedent directly validates the cliqueue architecture: AI agent codes the claim → smart contract verifies attestation → stablecoin escrow releases payment.
— [ZenML LLMOps: Circle AI-Powered Escrow Agent](https://www.zenml.io/llmops-database/ai-powered-escrow-agent-for-programmable-money-settlement)

---

### Finding 3: Multi-vault fan-out IS required — but only for the agent invocation deposit layer

Since the AgentVault hard cap (100 SOMI/day ≈ $17.60/day) is below the 10,000-claim/day agent invocation budget ($422–$704/day), a **multi-vault fan-out** is necessary for the agent layer. The canonical EVM pattern:

- **VaultFactory contract** deploys N AgentVault instances via CREATE2, each assigned to a sub-set of claim IDs (e.g., hash mod N).
- Each vault is funded independently; the ClaimsAdjudicator routes each `createAdvancedRequest` call to the vault whose capacity covers the invocation deposit.
- **Break-even fan-out at 10,000 claims/day**: `ceil(4,000 SOMI ÷ 100 SOMI) = 40 vaults`. Each vault costs ~1 deployment transaction (~200,000 gas × $5.49e-9 = ~$0.0011); 40 vaults ≈ $0.044 deployment cost. Negligible.
- The `updateDailyLimit(agent, newLimit)` function is callable by the contract owner only — fan-out via additional vault instances is simpler than protocol-level limit lifting.
— [Local reference: docs/reference/somnia-agent-kit/agent-vault.md]; [Factories pattern: medium.com/@andrey_obruchkov](https://medium.com/@andrey_obruchkov/factories-how-smart-contracts-deploy-other-contracts-6e2ddd2fc06d)

**Critical note on somnia-agent-kit status**: The AgentVault contract (address `0x7cEe3142A9c6d15529C322035041af697B2B5129`) is testnet-only. The fan-out pattern must be implemented against mainnet-deployed equivalents or a cliqueue-owned redeployment. Prior research confirmed the kit is community-built with no confirmed mainnet deployments. The 0.01–100 SOMI limit may be configurable via `updateDailyLimit` post-deployment; the hard cap of 100 SOMI appears to be enforced in the `createVault` function but may be adjustable post-creation via the owner-only `updateDailyLimit` call (documentation is ambiguous on whether `updateDailyLimit` can exceed the 100 ether construction cap).
— [Prior research: docs/research/somnia/native-agents-vs-agent-kit.md]

---

### Finding 4: Two-tier financial architecture required

The full financial architecture for cliqueue separates into two independent layers:

**Layer 1 — Agent Invocation Deposit Layer (SOMI-denominated, high-frequency):**
- Purpose: pay Somnia validator runners for `LLM Inference` consensus calls.
- Amount: 0.24–0.40 SOMI per claim.
- Daily volume at scale: 2,400–4,000 SOMI.
- Architecture: N-vault fan-out (N ≈ 40 at 10,000 claims/day). VaultFactory pattern.
- Token: SOMI (native gas token).
- Constraint: 100 SOMI/day per vault hard cap.

**Layer 2 — Claim Settlement Escrow Layer (stablecoin-denominated, lower-frequency, higher-value):**
- Purpose: conditional release of actual claim payment from payer to provider.
- Amount: adjudicatedCents (USDC or USDso) per claim; average $631 for denied-then-resolved, lower for clean claims.
- Daily volume at scale: potentially $6.31M/day (10,000 claims × $631 average).
- Architecture: single `ClaimsAdjudicator` escrow contract (no vault limit applies). Payer pre-funds contract; release triggered by `Settled` state transition.
- Token: USDC (preferred, enterprise-grade compliance) or USDso (Somnia-native, higher liquidity within ecosystem, compliance posture unclear).
- Constraint: none from AgentVault. Escrow limited only by payer pre-funding amount.

---

### Finding 5: SOMI volatility risk on the agent invocation layer

Agent invocation costs are SOMI-denominated. SOMI has traded between $0.148 (ATL) and $1.84 (ATH) — a 12× range. At ATH, 10,000 claims/day costs $7,360/day in validator fees. At ATL, $592/day. This volatility introduces operational risk for the agent invocation budget but does not affect claim settlement amounts (which are stablecoin-denominated on Layer 2).

**Mitigation**: cliqueue should hold a SOMI reserve buffer (e.g., 30-day operational reserve) and implement a SOMI price oracle check before accepting new claims if the SOMI price moves such that per-claim invocation cost exceeds a configured threshold (e.g., $1.00/claim = 25% of the $4 outsourced coding minimum).
— [CoinMarketCap: Somnia SOMI price](https://coinmarketcap.com/currencies/somnia/)

---

**Design implication:** The question "is a multi-vault fan-out needed?" was underspecified. The answer is: **yes for the agent invocation deposit layer** (40-vault fan-out at 10,000 claims/day) and **no for the claim settlement escrow** (a single ClaimsAdjudicator contract without vault limits handles this). The claim settlement layer should use **USDC** (enterprise-grade, Circle-regulated, BAA-compatible) rather than USDso (unproven compliance posture, no mainnet deployment confirmed as of May 2026). The fan-out is trivial to implement via VaultFactory and represents negligible deployment cost (~$0.044 for 40 vaults). SOMI price volatility on the agent layer requires a configurable per-claim cost ceiling and a SOMI reserve buffer.

**Open questions generated:**
1. Does the AgentVault `updateDailyLimit()` function allow setting the limit above the 100 ether cap enforced at `createVault`, or is 100 SOMI an immutable hard cap? If immutable, the fan-out pattern is mandatory; if overridable by the owner post-deployment, a single vault per operator is viable at scale.
2. Is USDso (Frax on Somnia) suitable as a claim settlement stablecoin for US hospital-payer payments, or does the lack of a published HIPAA/enterprise compliance framework make USDC the only defensible choice for MVP?
3. What is the minimum SOMI reserve buffer (in days of operation at P95 claim volume and ATH SOMI price) that cliqueue should maintain, and should the reserve be held on-chain in the vault or in a hospital-operated off-chain treasury with a top-up oracle trigger?

---

**See also** — [[../topics/settlement-stablecoin|settlement hub]]
