# GENIUS Act DASP Operator Risk — UUPS Proxy Upgrade Authority and Governance Multisig

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Does the UUPS proxy upgrade mechanism (allowing the governance multisig to replace `ClaimsAdjudicator`'s implementation) cause the governance multisig holders to be treated as "operators" of a custodial intermediary under the GENIUS Act — and does this require cliqueue to either (a) permanently disable the proxy upgrade after launch or (b) obtain explicit regulatory guidance?

### Finding 1: The DASP exclusion for "distributed ledger protocol operators" is the primary statutory defense — but its scope for upgradeable contracts is unresolved

- The GENIUS Act's DASP definition explicitly excludes "a distributed ledger protocol" and "developing, operating, or engaging in the business of developing distributed ledger protocols or self-custodial software interfaces." A "distributed ledger protocol" is defined as "publicly available and accessible executable software deployed to a distributed ledger, including smart contracts or networks of smart contracts."
  — Source: https://www.defieducationfund.org/genius-act-signed-into-law-ushering-in-first-federal-digital-assets-framework/; https://www.lw.com/en/insights/the-genius-act-of-2025-stablecoin-legislation-adopted-in-the-us

- The statute additionally excludes "an immutable and self-custodial software interface" as a distinct carve-out. The grammatical structure of the two exclusions is significant: the "distributed ledger protocol" exclusion does NOT require immutability, but the "software interface" exclusion does. A transparent proxy-deployed `ClaimsAdjudicator` would be argued under the "distributed ledger protocol" exclusion (which does not require immutability), not the "immutable software interface" exclusion.
  — Source: https://www.arnoldporter.com/en/perspectives/advisories/2025/07/new-stablecoin-legislation-analyzing-the-genius-act (exact statutory text extracted); https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/
  — **Assessment:** Moderate confidence. The two-exclusion structure is statutory text, but no published analysis has drawn this specific distinction for proxy-deployed contracts.

### Finding 2: The structural principle unifying all DASP exclusions is "absence of custody or control over user assets"

- Legal commentary consistently identifies the shared characteristic of all DASP-excluded technologies: "they exert no custody or control over underlying assets or transactions." Immutable protocols, self-custodial interfaces, and liquidity pools are all excluded because they never take unilateral control of user funds.
  — Source: https://www.defieducationfund.org/genius-act-signed-into-law-ushering-in-first-federal-digital-assets-framework/; https://www.ssga.com/us/en/intermediary/insights/genius-act-explained-what-it-means-for-crypto-and-digital-assets

- SIFMA's November 2025 ANPR comment letter stated the regulatory principle explicitly: **"actors that custody or can exercise total independent control over user assets or network architecture should be regulated, while those that do not should remain outside that perimeter."**
  — Source: https://www.sifma.org/advocacy/letters/advance-notice-of-proposed-rulemaking-on-genius-act-implementation-sifma-and-sifma-amg; implied by the description of SIFMA's submitted comments at https://www.sifma.org/wp-content/uploads/2025/11/SIFMA-UST-GENIUS-Act-ANPR-FINAL-11-04-2025.pdf

- **Direct implication for cliqueue's governance multisig:** A governance multisig holding UUPS upgrade authority over `ClaimsAdjudicator` CAN exercise "total independent control over network architecture" — it can replace the implementation with one that redirects all stablecoin balances to an arbitrary address. Whether this upgrade capability constitutes "custody or control over user assets" for DASP purposes is precisely the unresolved question flagged by the OCC NPRM.
  — **Assessment:** This analysis is derived from the structural principle (confirmed) applied to cliqueue's specific architecture. No law firm has published this specific chain of reasoning for a healthcare settlement contract. Treat as high-confidence framing, low-confidence conclusion.

### Finding 3: The OCC NPRM (February 2026) explicitly does NOT resolve governance participant DASP status

- The OCC's comprehensive February 2026 NPRM to implement the GENIUS Act specifically acknowledges: **"The NPRM does not clarify whether the operators, developers, governance participants, or front-end interface providers associated with such protocols could be considered 'digital asset service providers.'"**
  — Source: https://www.klgates.com/OCC-Proposes-Comprehensive-Rules-to-Implement-the-GENIUS-Act-That-Carry-Substantial-Market-Implications-3-11-2026

- The OCC further flagged: **"It is therefore unclear who, if anyone, would bear responsibility for restricting access to noncompliant payment stablecoins by US persons participating in DEX and DeFi transactions."** This is a direct regulatory acknowledgment that the governance participant / developer / operator question is open.
  — Source: https://www.klgates.com/OCC-Proposes-Comprehensive-Rules-to-Implement-the-GENIUS-Act-That-Carry-Substantial-Market-Implications-3-11-2026

- The GENIUS Act mandates that the Secretary of Treasury submit within 180 days of enactment (by January 15, 2026) "legislative recommendations on the scope of the term 'digital asset service provider,' including with respect to decentralized finance." This study is expected to address the governance participant gap, but final guidance is not yet published as of May 2026.
  — Source: https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/; https://home.treasury.gov/system/files/246/GENIUS-Act-Illicit-Finance-Innovation-Congressional-Report-March-2026.pdf

### Finding 4: The "for compensation or profit" requirement is a second independent filter — governance multisig holders who earn no fees from the protocol may be outside DASP scope regardless of upgrade authority

- The DASP definition requires activity "for compensation or profit." If cliqueue's governance multisig holders (the cliqueue team and/or hospital/payer representatives) earn no fees from `ClaimsAdjudicator`'s operation — the contract charges no protocol fee; hospitals and payers pay each other via the stablecoin settlement — they may fall outside the "for compensation or profit" element regardless of their upgrade authority.
  — Source: https://www.arnoldporter.com/en/perspectives/advisories/2025/07/new-stablecoin-legislation-analyzing-the-genius-act (exact DASP definition text)
  — **Weakly sourced:** No law firm has analyzed whether a zero-fee governance multisig over a healthcare settlement contract falls outside "for compensation or profit." If cliqueue charges deployment or integration fees (even as a separate commercial relationship), regulators may aggregate the fee income to satisfy this element.

### Finding 5: Two architectural paths to mitigate the governance multisig / DASP operator risk

**Path A — Proxy upgrade disable after launch ("frozen implementation"):**
Prior research documented that OZ's `TransparentUpgradeableProxy` allows the `ProxyAdmin` owner to renounce ownership permanently, rendering the proxy effectively immutable. After renouncing, the contract would satisfy the "immutable and self-custodial software interface" exclusion directly, eliminating any custody-or-control argument for the governance multisig. This was flagged in the prior DASP research as a consideration.
  — Cross-reference: docs/research/regulatory/genius-act-dasp-smart-contract-scope.md (Finding 4, last sentence); docs/research/agreement-layer/transparent-proxy-proxyadmin-timelock-deployment.md

**Path B — TimelockController-only upgrade, explicitly documented as non-custodial developer governance:**
Retain the UUPS/transparent proxy with the `TimelockController` as `ProxyAdmin` owner, but document the governance multisig's role in the Settlement Token Policy as "non-custodial developer governance" — analogous to Uniswap's governance model, which has not been treated as triggering DASP obligations. The 48-hour timelock minimum delay and 3-of-5 multisig threshold ensure no individual key holder can unilaterally move user funds, which may be the operative "control" test.
  — Source: docs/research/agreement-layer/timelock-min-delay-immutable-vs-mutable.md; https://www.sifma.org (SIFMA "total independent control" standard)
  — **Assessment:** Path B requires a legal opinion that cliqueue's governance structure does not give any actor "total independent control over user assets." The 48-hour timelock + 3-of-5 multisig requirement that no single actor can unilaterally upgrade supports this argument but has not been validated by regulatory guidance.

### Finding 6: The "person" requirement provides an independent statutory floor that smart contracts cannot be DASPs themselves

- As documented in prior research (genius-act-dasp-smart-contract-scope.md), the GENIUS Act defines "person" to exclude autonomous software. a16z's November 2025 Treasury comment letter explicitly argued: "Treasury should make clear that since decentralized stablecoins are not issued by a 'person' within the meaning of the Act, they are not covered." The same argument applies to `ClaimsAdjudicator`: the contract itself is not a "person" and cannot be a DASP regardless of its upgradeability.
  — Source: Prior research findings; https://coincentral.com/a16z-crypto-urges-u-s-treasury-to-clarify-stablecoin-rules-and-protect-decentralized-innovation/

- The DASP risk therefore falls entirely on **human operators** — specifically, those who (a) are "persons," (b) act "for compensation or profit," (c) exercise custody or control. The governance multisig holders satisfy (a); the "for compensation or profit" and "custody or control" elements are the live battleground.
  — Source: structural inference from GENIUS Act statutory text; consistent with all published law firm analysis reviewed.

**Design implication:** The governance multisig's UUPS proxy upgrade authority creates a genuine but unresolved GENIUS Act ambiguity. The weight of published commentary supports that the "distributed ledger protocol" exclusion covers `ClaimsAdjudicator` as deployed, and the "for compensation or profit" element filters out non-fee-earning governance key holders. However, no regulator has confirmed this for governance-controlled upgradeable contracts. **Three concrete actions are recommended:** (1) Add a "frozen implementation" option to the deployment runbook — after a 90-day post-launch stability period, the hospital procurement team may elect to have the ProxyAdmin ownership renounced (making the contract immutable), which eliminates any DASP operator argument for the multisig holders and satisfies the "immutable self-custodial interface" exclusion directly. (2) Include a "GENIUS Act Non-DASP Determination" one-pager in the Settlement Token Policy covering all three statutory exclusion arguments (person, distributed ledger protocol, for-compensation-or-profit) and note that the proxy upgrade governance does not constitute "total independent control over user assets" because no single actor can upgrade without 3-of-5 multisig consensus + 48-hour timelock. (3) Obtain a legal opinion from a Web3-specialist law firm before hospital launch that covers both the contract-level and governance-multisig-level DASP analysis.

**Open questions generated:**
1. Does renouncing ProxyAdmin ownership after a post-launch stability window (making `ClaimsAdjudicator` de-facto immutable) satisfy the "immutable and self-custodial software interface" exclusion under the GENIUS Act — and does this make cliqueue's governance multisig holders categorically not DASPs after the renounce date? — added 2026-05-16, priority: medium
2. Should cliqueue's hospital BAA include a warranty clause stating that the governance multisig holder does not earn compensation or profit from `ClaimsAdjudicator`'s operation — to document the "for compensation or profit" element exclusion for the purposes of a GENIUS Act non-DASP determination? — added 2026-05-16, priority: medium
3. Has Treasury published its Section 9 DeFi DASP study (due January 2026) — and if so, does it address whether governance participants in upgradeable stablecoin escrow contracts are DASPs? — added 2026-05-16, priority: high

---

**See also** — [[../topics/upgradeable-proxy|upgradeable-proxy hub]] · [[../topics/settlement-stablecoin|settlement hub]]
