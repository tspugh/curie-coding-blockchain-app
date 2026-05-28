# USDC vs USDso: Settlement Stablecoin for US Hospital-Payer Payments on Somnia

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-15 — Is USDso (Frax on Somnia) suitable as a claim settlement stablecoin for US hospital-payer payments, or does the lack of a published HIPAA/enterprise compliance framework make USDC the only defensible choice for MVP?

### Summary verdict

**USDC is the only defensible choice for MVP.** USDso is mainnet-deployed (contract address confirmed: `0x00000022dA000002656c64D9eA6011ea952D008A`) and technically viable, but lacks the regulatory compliance posture, enterprise custody documentation, and industry precedent required for hospital-payer settlement under the 2026 US stablecoin regulatory regime. USDC (`0x28bec7e30e6faee657a03e19bf1128aad7632a00` on Somnia mainnet — listed as "Native" in Somnia's official docs) meets every enterprise and regulatory bar. A post-MVP migration path to USDso is feasible once Frax Finance publishes PPSI certification status and enterprise compliance documentation.

---

### Finding 1: Both USDC and USDso are now live on Somnia mainnet

Somnia's official smart contracts page lists three stablecoins on mainnet:

| Token | Contract Address | Status |
|-------|-----------------|--------|
| USDC | `0x28bec7e30e6faee657a03e19bf1128aad7632a00` | Native |
| USDT | `0x67B302E35Aef5EEE8c32D934F5856869EF428330` | Native |
| USDso | `0x00000022dA000002656c64D9eA6011ea952D008A` | Native |

The Somnia explorer confirms USDC.e (bridged USDC) at a separate address, suggesting the "Native" USDC is either Circle's directly-minted token or the canonical bridged-then-upgraded version. Orbiter Finance and the official Relay/Stargate bridges support USDC transfer to Somnia. Prior research noted USDC was only bridged; this finding upgrades that assessment — Somnia docs now classify it as native.
— [Somnia Docs: Smart Contracts](https://docs.somnia.network/developer/smart-contracts); [Somnia Explorer: USDC.e](https://explorer.somnia.network/token/0x28BEc7E30E6faee657a03e19Bf1128AaD7632A00)

---

### Finding 2: USDso is Frax frxUSD architecture — reserve-backed, but not yet GENIUS Act certified

USDso was announced on May 5, 2026, and is issued by Frax Finance using the **frxUSD** reserve-backed architecture:

- Collateral: U.S. Treasury bonds, BlackRock BUIDL, Superstate USTB, and money-market instruments. Collateralization ratio reported at ~102.38%.
- Mintable 1:1 against USDC deposited on Somnia.
- Revenue model: 90% of reserve yield returned to Somnia DeFi protocols (gauges/incentives); 10% to an insurance fund.
- Target use case: "high-frequency trading, DeFi, and on-chain protocol scenarios."

**Critically:** Frax Finance's frxUSD is **positioning** for GENIUS Act compliance (announced February 2025) and has applied for Permitted Payment Stablecoin Issuer (PPSI) status. However, GENIUS Act final rules do not take effect until the earlier of January 18, 2027, or 120 days after final regulations are issued. As of May 2026, Frax Finance's formal PPSI certification is still pending. No enterprise compliance documentation (BAA, SOC 2, AML/sanctions program filing) for USDso has been published.
— [crypto.news: Somnia taps Frax for USDso](https://crypto.news/somnia-taps-frax-to-launch-usdso-stablecoin-for-high-frequency-defi/); [edgen.tech: frxUSD and GENIUS Act](https://www.edgen.tech/news/crypto/frax-finances-frxusd-gains-traction-as-genius-act-compliance-drives-stablecoin-innovation); [GENIUS Act text: Congress.gov](https://www.congress.gov/bill/119th-congress/senate-bill/1582/text)

---

### Finding 3: USDC has the enterprise compliance posture hospital-payer settlement requires

Circle's USDC is the most widely adopted regulated stablecoin for B2B enterprise settlement in 2026:

- **GENIUS Act alignment**: Circle explicitly positions USDC as GENIUS Act-ready. Circle has applied for PPSI status; USDC is backed 100% by cash and short-dated U.S. Treasuries, attested monthly by a Big Four accounting firm (41 consecutive reports). BNY Mellon is primary custodian; BlackRock manages reserves.
- **Regulatory clarity for enterprises**: The GENIUS Act (enacted July 18, 2025) mandated that PPSIs maintain AML/CFT programs and sanctions compliance under the Bank Secrecy Act, exactly the controls hospital finance teams and payer compliance departments require from settlement counterparties.
- **Precedent in insurance sector**: In March 2026, Aon completed the first known stablecoin insurance premium payment among major global brokers, using USDC (on Ethereum) and PayPal USD (on Solana) for Coinbase and Paxos. This is the closest existing industry analog to hospital-payer stablecoin settlement.
- **No healthcare-specific HIPAA requirements on the stablecoin itself**: Payment amounts and claim references (HMAC-hashed, not raw PHI) on-chain are not PHI. USDC settlement does not require a BAA with Circle — the stablecoin contract itself does not process or store PHI. HIPAA compliance requirements apply to the off-chain data handling (Corti Symphony, EDI adapter), not the payment token.
— [Circle: GENIUS Act](https://www.circle.com/genius-act); [AlphaPoint: USDC Enterprise Guide 2026](https://alphapoint.com/blog/usdc-stablecoin-payments-the-enterprise-guide-to-faster-compliant-settlement-in-2026/); [CoinDesk: Aon stablecoin payment](https://www.coindesk.com/business/2026/03/09/global-insurance-broker-aon-tests-stablecoin-payments-with-coinbase-paxos)

---

### Finding 4: USDC bridging to Somnia — native vs. bridged status

Somnia's official docs list USDC (`0x28bec7e30e6faee657a03e19bf1128aad7632a00`) as "Native." However, Circle's CCTP V2 (Cross-Chain Transfer Protocol, live on 13+ chains as of April 2026) does not explicitly list Somnia among its supported networks. Somnia's bridging page documents two official bridge partners (Relay and Stargate Finance), both of which support USDC transfers. An Orbiter Finance integration was also confirmed by Somnia's official Twitter.

**Important distinction**: Relay/Stargate USDC on Somnia is likely USDC.e (wrapped/bridged IOU) rather than CCTP-minted native USDC. Circle's CCTP burns on source chain and mints fresh USDC on destination — Relay/Stargate hold liquidity pools. For enterprise settlement, the distinction matters:
- **CCTP native USDC**: Canonical Circle-minted token, fungible with mainnet USDC, preferred by regulated counterparties.
- **Bridged USDC.e (Relay/Stargate)**: Third-party bridge custodian, technically an IOU — may not be accepted as "USDC" by hospital treasury or payer compliance departments without disclosure.

**Design implication**: Until Circle formally adds Somnia to its CCTP V2 network list, cliqueue should either (a) use bridged USDC.e with explicit disclosure, or (b) route settlement through an Ethereum-native USDC contract using Somnia's LayerZero OFT bridge (SOMI is OFT-enabled on Ethereum/Base/BNB). A CCTP-native USDC integration on Somnia is the highest-trust path and should be sought before mainnet launch.
— [Somnia Docs: Bridging](https://docs.somnia.network/get-started/bridging-info); [Circle CCTP](https://www.circle.com/cross-chain-transfer-protocol); [Eco: CCTP V2 guide 2026](https://eco.com/support/en/articles/14998923-cctp-cross-chain-usdc-complete-guide-2026); [Somnia Twitter: Orbiter](https://x.com/Somnia_Network/status/1999501011665179013)

---

### Finding 5: USDso is not suitable for hospital-payer settlement in MVP — but viable post-MVP

USDso fails the MVP enterprise bar on four specific grounds:

1. **No PPSI certification**: Frax Finance's GENIUS Act PPSI status is pending as of May 2026. Hospitals and payers will not accept a non-certified stablecoin for payment settlement under their treasury policy or legal review.
2. **No enterprise compliance documentation**: No BAA-equivalent, no AML/sanctions program filing, no SOC 2 report, no independent reserve attestation for USDso specifically (as distinct from frxUSD on other networks).
3. **Liquidity depth unknown**: USDso launched May 5, 2026. No DefiLlama TVL data, no DEX trading volume data, and no on/off-ramp to fiat published. Settlement liquidity at $631/claim × 10,000 claims/day ($6.31M/day) requires deep, stable liquidity pools that a 10-day-old stablecoin cannot guarantee.
4. **DeFi-oriented design**: The 90% yield redistribution to DeFi protocols and 10% insurance fund structure is appropriate for DeFi; it introduces novel counterparty risk (the insurance fund backstop is new and untested) not acceptable for healthcare settlement.

**Post-MVP path**: Once Frax Finance achieves PPSI certification (expected before January 2027 GENIUS Act compliance deadline), publishes enterprise documentation, and USDso accumulates 6+ months of on-chain liquidity data, cliqueue can revisit USDso as a Somnia-native alternative that avoids bridging trust assumptions. The 1:1 USDC↔USDso mint mechanism means the migration path is technically trivial — the `ClaimsAdjudicator` escrow contract needs only a token address parameter.
— [bvnk.com: Global stablecoin regulations 2026](https://bvnk.com/blog/global-stablecoin-regulations-2026); [Sidley Austin: GENIUS Act](https://www.sidley.com/en/insights/newsupdates/2025/07/the-genius-act-a-framework-for-us-stablecoin-regimes)

---

**Design implication:** Use USDC (bridged via Relay/Stargate to Somnia mainnet) as the settlement stablecoin for MVP. Store the stablecoin contract address as a configurable parameter in `ClaimsAdjudicator` (not hardcoded) so the contract can switch to native USDC (if Circle adds CCTP on Somnia) or USDso (post-PPSI certification) without a redeployment. Explicitly document in the on-chain contract NatSpec that bridged USDC.e is the initial settlement token and that the address may be updated via a governance action. Add a `stablecoinAddress` field to the cliqueue spec and ROADMAP.

**Open questions generated:**
1. Has Circle formally applied to add Somnia to its CCTP V2 network, and what is the expected timeline for native (not bridged) USDC on Somnia mainnet? Is there a public list of chains in CCTP V2 pipeline?
2. What governance mechanism should control the `stablecoinAddress` parameter in `ClaimsAdjudicator` — a multisig (3-of-5 hospital admin keys), a timelock, or an on-chain DAO vote — and what minimum notice period (in blocks) is required before a token address change to prevent rug-pull risk?
3. Should cliqueue publish a formal "Settlement Token Policy" document that hospital and payer legal teams can review — specifying current token, custodian, reserve backing, and upgrade governance — to satisfy enterprise procurement review?

---

**See also** — [[../topics/settlement-stablecoin|settlement hub]]
