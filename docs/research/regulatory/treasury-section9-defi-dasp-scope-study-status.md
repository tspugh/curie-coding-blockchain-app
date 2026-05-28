# Treasury Section 9 DeFi DASP Scope Study — Publication Status and Findings

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Has Treasury published its Section 9 DeFi DASP study, and does it address whether governance participants in upgradeable stablecoin escrow contracts are DASPs?

### Finding 1: The Section 9(e) study has been published — as the March 2026 illicit finance innovation report — but it does NOT resolve governance participant DASP status

- The GENIUS Act's Section 9(e) required the Secretary of Treasury to submit a report to Congress within 180 days of enactment (deadline: ~January 14, 2026) on innovative technologies to counter illicit finance involving digital assets. Treasury delivered this report in **March 2026** (approximately six weeks late) as: *"Report to Congress from the Secretary of the Treasury on Innovative Technologies to Counter Illicit Finance Involving Digital Assets."*
  — Source: https://home.treasury.gov/system/files/246/GENIUS-Act-Illicit-Finance-Innovation-Congressional-Report-March-2026.pdf; https://infobytes.orrick.com/2026-03-13/treasury-issues-genius-act-report-on-innovative-methods-to-combat-illicit-finance/

- The March 2026 report's DeFi findings are **limited to AML/CFT recommendations**, not DASP definitional scope. Treasury acknowledged: **"the current BSA/AML framework does not fully account for DeFi protocols with distributed or immutable governance"** and recommended that Congress pass **new legislation** to clarify which DeFi actors have BSA obligations. Treasury did NOT resolve the governance participant vs. smart contract operator distinction.
  — Source: https://www.consumerfinancialserviceslawmonitor.com/2026/03/treasury-outlines-innovation-roadmap-for-countering-illicit-finance-in-digital-assets/; https://perkinscoie.com/insights/article/treasury-releases-2026-report-technologies-countering-illicit-finance-involving

- Section 9 also mandates **separate legislative recommendations** on "the scope of the term 'digital asset service provider' including with respect to decentralized finance." The Chapman & Cutler GENIUS Act rulemaking tracker (updated May 2026) lists the Section 9(d) DeFi AML rulemaking as **"Pending"** with a deadline of July 18, 2028. No dedicated "DeFi DASP scope" legislative recommendation document distinct from the March 2026 report has been published as of May 16, 2026.
  — Source: https://www.chapman.com/publication-genius-act-rulemaking-tracker

### Finding 2: The OCC NPRM (February 2026) explicitly defers governance participant DASP status to future rulemaking

- The OCC's February 2026 NPRM implementing the GENIUS Act stated directly: **"The NPRM does not clarify whether the operators, developers, governance participants, or front-end interface providers associated with such protocols could be considered 'digital asset service providers.'"** This is the authoritative regulatory acknowledgment that the question is open.
  — Source: https://www.klgates.com/OCC-Proposes-Comprehensive-Rules-to-Implement-the-GENIUS-Act-That-Carry-Substantial-Market-Implications-3-11-2026

- The OCC added: **"It is therefore unclear who, if anyone, would bear responsibility for restricting access to noncompliant payment stablecoins by US persons participating in DEX and DeFi transactions."** DeFi governance participants — including multisig holders with upgrade authority over escrow contracts — remain in this unresolved category.
  — Source: https://www.klgates.com/OCC-Proposes-Comprehensive-Rules-to-Implement-the-GENIUS-Act-That-Carry-Substantial-Market-Implications-3-11-2026; https://www.dcbar.org/news-events/publications/washington-lawyer-articles/genius-act-a-regulatory-first-step,-not-the-final-

### Finding 3: The "for compensation or profit" and "person" requirements remain the primary available statutory arguments — but are also unresolved for B2B settlement contexts

- The DASP definition requires activity **"for compensation or profit."** No law firm or regulatory body has published analysis of whether a governance multisig over a B2B healthcare settlement contract (where no protocol fee is charged) satisfies this element. The control-based reading from SIFMA's November 2025 ANPR comment — that actors with "total independent control over user assets or network architecture" should be regulated — would catch upgrade authority regardless of whether a fee is charged.
  — Source: https://www.ssga.com/us/en/intermediary/insights/genius-act-explained-what-it-means-for-crypto-and-digital-assets; prior research in docs/research/regulatory/uups-proxy-governance-multisig-dasp-operator-risk.md (Finding 4)

- The "for compensation or profit" threshold provides meaningful protection **only if** cliqueue charges no deployment, integration, or licensing fees to hospitals or payers AND the governance multisig holders receive no equity upside or token allocation tied to protocol usage. If any fee or economic benefit flows to multisig holders through a related commercial relationship, regulators may aggregate that benefit to satisfy the "compensation or profit" element.
  — Source: structural analysis from DASP text at https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/; https://www.paulhastings.com/insights/crypto-policy-tracker/the-genius-act-a-comprehensive-guide-to-us-stablecoin-regulation
  — **Assessment:** Weakly sourced — no published analysis addresses this specific aggregation scenario.

### Finding 4: March 2026 Treasury report recommends new legislation for DeFi — resolution unlikely before 2028

- Treasury's March 2026 report included the following legislative recommendations for DeFi:
  1. Congress should enact legislation creating **new categories of digital asset-specific financial institutions** within the BSA.
  2. Congress should clarify **which DeFi actors should be subject to BSA/AML obligations** and the scope of those obligations.
  3. A new **"sixth special measure"** to the USA PATRIOT Act is proposed to address digital asset mixing and anonymization services used by DeFi protocols.
  — Source: https://www.ainvest.com/news/treasury-submits-genius-act-crypto-report-congress-2603/; https://perkinscoie.com/insights/article/treasury-releases-2026-report-technologies-countering-illicit-finance-involving

- No legislative action on these recommendations had been taken as of May 2026. The Section 9(d) rulemaking to implement DeFi AML obligations has a statutory deadline of **July 18, 2028**. This means definitive DeFi DASP scope guidance is approximately 2 years away, and cliqueue's MVP deployment window (2026–2027) will occur entirely within this regulatory ambiguity period.
  — Source: https://www.chapman.com/publication-genius-act-rulemaking-tracker

### Finding 5: The structural DASP exclusion principle — "absence of custody or control" — is the best available design target in absence of regulatory clarity

- All legal commentary converges on the shared principle behind the DASP statutory exclusions: **"they exert no custody or control over underlying assets or transactions."** Immutable contracts, self-custodial interfaces, and liquidity pools are excluded because they cannot unilaterally redirect user funds.
  — Source: https://www.defieducationfund.org/genius-act-signed-into-law-ushering-in-first-federal-digital-assets-framework/

- The **DeFi Education Fund's November 2025 Treasury comment** explicitly argued that the DASP definition "is limited to centralized actors who custody and control user assets" and that "decentralized distributed ledger protocols and self-custodial software interfaces" are "safeguarded from regulations designed for centralized financial intermediaries." For cliqueue, the practical implication is: the closer `ClaimsAdjudicator` operates to the distributed-ledger-protocol-with-no-central-control end of the spectrum, the stronger the statutory exclusion argument.
  — Source: https://www.defieducationfund.org/genius-act-signed-into-law-ushering-in-first-federal-digital-assets-framework/

**Design implication:** The Treasury Section 9 DeFi DASP scope study has not resolved governance participant status — it deferred to future legislation due no earlier than 2028. Cliqueue must design for regulatory ambiguity: the strongest available architecture renounces ProxyAdmin ownership after a post-launch stability window (making `ClaimsAdjudicator` immutable and satisfying the "immutable and self-custodial software interface" exclusion directly), while the Settlement Token Policy document should include a "Non-DASP Determination" memo citing (a) the "person" requirement excluding the contract itself, (b) the distributed ledger protocol exclusion, (c) the "for compensation or profit" element if no protocol fee is charged, and (d) the absence of unilateral custody or control by any individual actor. The memo should note that definitive regulatory guidance is not expected until 2028 and that the architecture is designed to satisfy the exclusion under all likely interpretations.

**Open questions generated:**
1. Does Treasury's March 2026 report constitute the full Section 9 legislative recommendations output, or is a separate DeFi DASP scope document still outstanding (distinct from the AML innovation report)?
2. At what upgrade-authority threshold does the "total independent control over network architecture" test (SIFMA standard) flip — does a 3-of-5 multisig with a 48-hour timelock fall below that threshold, or does any upgrade authority regardless of process satisfy it?
3. Should cliqueue's Settlement Token Policy document carry a legal opinion letter from outside counsel (rather than an internal non-DASP determination) to satisfy hospital and payer procurement teams during the 2026–2028 regulatory ambiguity window?

---

**See also** — [[../topics/settlement-stablecoin|settlement hub]]
