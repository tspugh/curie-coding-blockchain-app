# GENIUS Act DLP Exclusion — Upgradeable Proxy Contract and Governance Multisig Analysis

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Does the GENIUS Act's "distributed ledger protocol" exclusion cover an upgradeable transparent proxy contract where the implementation can be replaced by a governance multisig — or does upgradeability break the "distributed ledger protocol" characterization?

### Finding 1: The "distributed ledger protocol" exclusion does NOT require immutability — that qualifier applies only to the separate "immutable and self-custodial software interface" exclusion

- The GENIUS Act's DASP definition (Section 3) lists five separate exclusions. The first, "a distributed ledger protocol," and the second, "developing, operating, or engaging in the business of developing distributed ledger protocols or self-custodial software interfaces," contain **no immutability requirement**. The third exclusion, "an immutable and self-custodial software interface," requires immutability by its express terms.
  — Source: https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/; https://www.arnoldporter.com/en/perspectives/advisories/2025/07/new-stablecoin-legislation-analyzing-the-genius-act
  — Assessment: High confidence. The two-exclusion structure is statutory text, consistent across all law firm summaries reviewed. The grammatical placement of "immutable" modifies only the "software interface" exclusion, not the "distributed ledger protocol" exclusion.

- "Distributed ledger protocol" is defined as "publicly available and accessible executable software deployed to a distributed ledger, including smart contracts or networks of smart contracts." The definition does not require the smart contract to be immutable — upgradeable proxy contracts are "executable software deployed to a distributed ledger" by any plain reading.
  — Source: https://www.defieducationfund.org/genius-act-signed-into-law-ushering-in-first-federal-digital-assets-framework/; https://www.lw.com/en/insights/the-genius-act-of-2025-stablecoin-legislation-adopted-in-the-us

### Finding 2: No law firm or regulatory body has published specific analysis of whether an upgradeable proxy contract qualifies as a "distributed ledger protocol" under the GENIUS Act

- A comprehensive search of published law firm analysis (Gibson Dunn, Latham & Watkins, Arnold & Porter, Cadwalader, Sullivan & Cromwell, K&L Gates, Paul Hastings, Sidley, DeFi Education Fund) found **zero published analysis** specifically addressing the proxy contract / DLP exclusion interaction. This is a genuine legal blind spot in published secondary literature as of May 2026.
  — Assessment: High confidence in the absence of published analysis; the gap is confirmable across multiple firm reviews.

- The DC Circuit and federal courts have not addressed whether "publicly available and accessible executable software deployed to a distributed ledger" encompasses upgradeable proxy contracts where the logic contract can be swapped by a governance actor.

### Finding 3: The OCC NPRM (February 2026) explicitly defers the governance participant / developer / upgrade authority DASP question to future rulemaking

- The OCC's February 2026 NPRM implementing the GENIUS Act states: **"The NPRM does not clarify whether the operators, developers, governance participants, or front-end interface providers associated with such protocols could be considered 'digital asset service providers.'"** The NPRM further acknowledges: **"It is therefore unclear who, if anyone, would bear responsibility for restricting access to noncompliant payment stablecoins by US persons participating in DEX and DeFi transactions."**
  — Source: https://www.klgates.com/OCC-Proposes-Comprehensive-Rules-to-Implement-the-GENIUS-Act-That-Carry-Substantial-Market-Implications-3-11-2026
  — Assessment: High confidence. This is a direct quote from the K&L Gates summary of the OCC NPRM text.

- The GENIUS Act Section 9 required Treasury to submit within 180 days of enactment (by approximately January 14, 2026) legislative recommendations on the scope of "digital asset service provider" with respect to DeFi. The March 2026 Treasury report addressed illicit finance but **did not resolve** the governance participant/developer upgrade authority question (confirmed by prior research at docs/research/regulatory/treasury-section9-defi-dasp-scope-study-status.md).

### Finding 4: The structural principle across all published legal commentary — "absence of custody or control" — supports the DLP exclusion applying to upgradeable protocols

- DeFi Education Fund's November 2025 Treasury comment letter argued: "The DASP definition is limited to centralized actors who custody and control user assets... The technologies explicitly excluded from the DASP definition share a common feature: they exert no custody or control over underlying assets or transactions."
  — Source: https://www.defieducationfund.org/wp-content/uploads/2025/11/GENIUS-Act-Implementation-Comments-11-04-25.pdf; https://www.defieducationfund.org/genius-act-signed-into-law-ushering-in-first-federal-digital-assets-framework/

- This "custody or control" principle does not turn on mutability. A governance multisig holding UUPS proxy upgrade authority can POTENTIALLY exercise "total independent control over network architecture" (SIFMA's proposed standard) — but this standard has not been adopted in any NPRM. The binding FinCEN 2019 standard ("total independent control over the VALUE") is about custody of funds, not architectural control.
  — Source: https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf

### Finding 5: The "developing, operating, or engaging in the business of developing distributed ledger protocols" exclusion creates an independent pathway for cliqueue's governance multisig holders

- Even if a future regulator interpreted `ClaimsAdjudicator` itself as not qualifying as a "distributed ledger protocol" (due to upgradeability), the second exclusion — "developing, operating, or engaging in the business of developing distributed ledger protocols" — covers the *persons* who develop and operate it. Cliqueue's governance multisig holders are developers/operators of a distributed ledger protocol. This exclusion has no immutability requirement and does not appear to require that the protocol they operate be immutable.
  — Source: Statutory text consistent across: https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/; https://www.arnoldporter.com/en/perspectives/advisories/2025/07/new-stablecoin-legislation-analyzing-the-genius-act
  — Assessment: Moderate confidence. This reading is structurally sound from the statutory text, but no law firm has specifically applied this pathway to governance multisig holders of an upgradeable settlement contract.

### Finding 6: Three-tier risk architecture for cliqueue based on this analysis

**Tier 1 (Weakest but currently operative):** Deploy with upgradeable UUPS proxy. Argue: (a) `ClaimsAdjudicator` is a "distributed ledger protocol" under the plain definition (publicly available, accessible, deployed to a DL, smart contract); (b) immutability is not required for the DLP exclusion; (c) governance multisig holders are "developing/operating a distributed ledger protocol" independently of the DLP characterization. Risk: a future rulemaking may adopt the SIFMA "effective or ongoing ability to alter" standard, which would directly target this architecture.

**Tier 2 (Stronger posture):** Migrate to Position B (4-of-7 multisig + 7-day timelock). This further reduces any "effective control" argument and aligns with recognized Tier-1 DeFi governance norms (Compound v3, MakerDAO). The DLP argument remains intact; the "total independent control" argument becomes clearly defeated at the individual and near-majority level.

**Tier 3 (Strongest):** Renounce ProxyAdmin ownership after audit + stability window. ClaimsAdjudicator becomes de-facto immutable. This satisfies BOTH the DLP exclusion (still publicly available, deployed smart contract) AND the "immutable and self-custodial software interface" exclusion (now immutable, no admin controls). All governance multisig holders are clearly not DASPs after this point.

**Design implication:** The statutory text creates a defensible but unvalidated path: upgradeable proxy contracts qualify as "distributed ledger protocols" under the plain definition (no immutability required), and governance multisig holders qualify under the "developing/operating" exclusion. No law firm has published analysis refuting this reading; no regulator has addressed it. The recommended path is: launch under Tier 1 with a formal legal opinion letter documenting the DLP exclusion argument specifically for an upgradeable proxy-deployed settlement contract; publish the formal non-DASP determination in the Settlement Token Policy; plan for Tier 3 (ProxyAdmin renounce) as a documented upgrade path in the hospital BAA.

**Open questions generated:**
1. Should cliqueue's outside legal opinion letter specifically address the upgradeable proxy + DLP exclusion interaction — arguing that "publicly available and accessible executable software deployed to a distributed ledger" encompasses proxy-pattern contracts where the proxy address is immutable even if the implementation can be swapped?
2. Does the "publicly available and accessible" requirement in the DLP definition require that cliqueue's `ClaimsAdjudicator` source code (including the implementation contract) be publicly verified on Somnia's block explorer — and would a private (unverified) implementation contract break the DLP exclusion?
3. Is there a governance architecture (e.g., time-lock-only, no multisig) that eliminates the "governance participant" DASP risk while preserving emergency pause functionality — or does any upgrade authority necessarily implicate a "person" who could be classified as a DASP?

---

**See also** — [[../topics/settlement-stablecoin|settlement hub]] · [[../topics/upgradeable-proxy|upgradeable-proxy hub]]
