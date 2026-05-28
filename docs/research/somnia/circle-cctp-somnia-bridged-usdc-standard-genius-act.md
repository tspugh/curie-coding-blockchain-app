# Circle CCTP, Somnia USDC Path, and GENIUS Act Deadline

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Does Somnia/Improbable have an active dialogue with Circle for CCTP V2 integration or Bridged USDC Standard adoption — and should cliqueue initiate a protocol-level integration request to unblock enterprise procurement before the GENIUS Act effective date (Jan 2027)?

### Finding 1: Somnia is absent from all 25 CCTP V2 supported chains — no Somnia-Circle dialogue is publicly documented

- Circle CCTP V2 now supports 25 chains (as of May 2026): Ethereum, Arbitrum, Avalanche, Base, BNB Smart Chain, Codex, EDGE, HyperEVM, Injective, Ink, Linea, Monad, Morph, OP Mainnet, Pharos, Plume, Polygon PoS, Sei, Solana, Sonic, Starknet, Unichain, World Chain, and XDC. Somnia (chain ID 50312) is **not listed**.
  — Source: https://developers.circle.com/cctp/concepts/supported-chains-and-domains; https://www.circle.com/cross-chain-transfer-protocol

- No public announcement exists of any Somnia-Circle partnership, Circle CCTP dialogue, or native USDC deployment plan on Somnia. Somnia's official docs reference only Relay Bridge and Stargate Finance as USDC bridges.
  — Source: https://docs.somnia.network/get-started/bridging-info

- Somnia's USDC.e token (`0x28BEc7E30E6faee657a03e19Bf1128AaD7632A00`) is **Stargate-bridged USDC.e**, not Circle-issued native USDC. This is consistent with prior research (2026-05-15 [[usdc-cctp-somnia-native-vs-bridged]]).
  — Source: https://explorer.somnia.network/token/0x28BEc7E30E6faee657a03e19Bf1128AaD7632A00; https://dropstab.com/coins/stargate-bridged-usdc-somnia

### Finding 2: Somnia's explicit native stablecoin strategy is USDso (Frax frxUSD), not USDC — the ecosystem is oriented away from a Circle partnership

- Somnia formally partnered with **Frax Finance** (not Circle) in May 2026 to launch USDso as the native Somnia ecosystem stablecoin. USDso is based on Frax's frxUSD architecture, backed 1:1 by U.S. Treasury bond-equivalent reserves, with 90% of reserve yield flowing to DeFi protocols on Somnia.
  — Source: https://crypto.news/somnia-taps-frax-to-launch-usdso-stablecoin-for-high-frequency-defi/; https://www.bitget.com/news/detail/12560605398066

- Users mint USDso 1:1 using USDC as collateral — meaning USDC remains a *deposit* asset, not a *settlement* currency. This makes USDC.e (Stargate-bridged) the de-facto on-ramp rather than Circle-native USDC.
  — Source: https://cryptonews.net/news/defi/32811411/

- **Implication for cliqueue:** Somnia's ecosystem is not organically driving a Circle CCTP V2 integration request. Cliqueue initiating this integration request as a protocol-level ask is unlikely to find a Somnia counterpart sponsor in the near term. Cliqueue's settlement layer must plan for Stargate USDC.e as the MVP settlement token, with a migration path to Circle-native USDC as an independent effort.

### Finding 3: The Bridged USDC Standard is permissionlessly deployable — cliqueue or the Somnia Foundation can adopt it without Circle approval

- The **Bridged USDC Standard** (Circle's open-source ERC-20 contract: https://github.com/circlefin/stablecoin-evm/blob/master/doc/bridged_USDC_standard.md) is permissionlessly deployable. Any L1/L2 team can adopt it via Circle's Discord or GitHub with no formal Circle approval required.
  — Source: https://www.circle.com/bridged-usdc

- The standard grants Circle the **option (not obligation)** to upgrade the bridged contract to native USDC once supply, holder count, and app integration milestones are reached. The upgrade sequence is: (1) third-party deploys Bridged USDC Standard contract, (2) liquidity grows, (3) Circle and the chain team jointly elect to transfer ownership to Circle for native upgrade.
  — Source: https://www.circle.com/blog/bridged-usdc-standard

- Implementation path: reach Circle via Discord (developer community), follow the GitHub implementation guide, and deploy the standard contract. This does not require a formal business development engagement with Circle. Linea is the canonical precedent for a bridged-to-native upgrade.
  — Source: https://www.circle.com/bridged-usdc; https://www.circle.com/blog/now-live-native-usdc-and-cctp-v2-on-world-chain

### Finding 4: Frax frxUSD (and USDso by extension) is positioned as GENIUS Act-compliant — but PPSI designation is not yet awarded and rules are still in NPRM phase

- Frax Finance founder Sam Kazemian participated in drafting the GENIUS Act. Frax issued frxUSD in February 2025 specifically designed for GENIUS Act compliance, with reserves in dollar-denominated MMF tokens and U.S. bond fund tokens.
  — Source: https://www.edgen.tech/news/crypto/frax-finances-frxusd-gains-traction-as-genius-act-compliance-drives-stablecoin-innovation

- PPSI designation under the GENIUS Act is **not yet awarded to any issuer** as of May 2026. The OCC, FDIC, and Treasury are still in NPRM (Notice of Proposed Rulemaking) phase. Final rules have not been issued; PPSI licensing is not yet operational.
  — Source: https://www.morganlewis.com/pubs/2026/04/genius-act-implementation-key-proposals-and-what-comes-next; https://www.sullcrom.com/insights/memo/2026/March/OCC-Proposes-Regulations-Implement-GENIUS-Act

- GENIUS Act effective date: **January 18, 2027** (or 120 days after final rules, whichever is earlier). After that date, only PPSIs may issue payment stablecoins in the U.S. Digital asset service providers (DASPs) may not *offer* non-PPSI stablecoins after **July 18, 2028**.
  — Source: https://www.gtlaw.com/en/insights/2025/7/genius-act-enacted-establishing-a-regulatory-framework-for-payment-stablecoins-issued-or-sold-in-the-united-states; https://www.stblaw.com/about-us/publications/view/2025/07/22/genius-act-establishes-regulatory-framework-for-stablecoins

### Finding 5: CCTP V2 is broadly expanding — Somnia-scale EVM chains (Monad, Codex, Pharos) are already listed, suggesting Somnia is a future candidate but not prioritized

- CCTP V2 added Monad, Codex, Pharos, Morph, Plume, and XDC in its 2026 expansion round — demonstrating that high-throughput EVM-compatible chains without major TVL are now eligible.
  — Source: https://developers.circle.com/cctp/concepts/supported-chains-and-domains

- Circle's 2026 product vision states: "our priority is to make [CCTP] an even more systemic interoperability layer for USDC so that businesses and users have access to USDC liquidity that moves safely and predictably across blockchains where it's needed." Circle does not publish chain-selection criteria publicly.
  — Source: https://www.circle.com/blog/building-the-internet-financial-system-circles-product-vision-for-2026

- **Actionable implication:** A cliqueue protocol-level CCTP V2 request to Circle is feasible but requires a Somnia Foundation co-sponsor (since Circle adds chains via relationships with chain teams, not individual dApp teams). The Bridged USDC Standard path is the correct first step and the prerequisite to a CCTP upgrade.

**Design implication:** Cliqueue cannot rely on a Somnia-Circle CCTP V2 integration materializing before the GENIUS Act January 2027 deadline. The actionable path is: (1) MVP launches with Stargate USDC.e and discloses bridged status in the Settlement Token Policy; (2) cliqueue advocates with the Somnia Foundation to adopt the Bridged USDC Standard (permissionless, no Circle approval needed) as an ecosystem upgrade; (3) if Frax frxUSD receives PPSI designation before Jan 2027, USDso becomes a compliant alternative to USDC.e for enterprise procurement; (4) the `ClaimsAdjudicator` token whitelist (USDC.e + native USDC addresses) already supports in-place migration. The GENIUS Act DASP prohibition (July 2028) creates the hard backstop — cliqueue must have a PPSI-compliant settlement token before that date.

**Open questions generated:**
1. Has Frax Finance submitted a formal PPSI license application to the OCC or FDIC under the GENIUS Act framework — and if so, what is the expected approval timeline relative to the January 2027 effective date? — priority: high
2. Would the Somnia Foundation be willing to adopt the Bridged USDC Standard for the existing USDC.e contract, or would it require deploying a new contract and migrating liquidity — and does this migration path require a Somnia governance vote? — priority: medium
3. At what Somnia USDC.e on-chain liquidity threshold ($M) would Circle be likely to exercise its Bridged USDC Standard upgrade option, based on precedents from Linea and World Chain? — priority: medium

---

**See also** — [[../topics/settlement-stablecoin|settlement hub]]
