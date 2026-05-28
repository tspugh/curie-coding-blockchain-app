# GENIUS Act DASP Definition — Does `ClaimsAdjudicator` Qualify as a Digital Asset Service Provider?

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Does the GENIUS Act's definition of "digital asset service provider" encompass a smart contract like `ClaimsAdjudicator` that holds escrow stablecoin balances — or does it only apply to human-operated custodial intermediaries?

### Finding 1: The DASP definition requires a "person" — smart contracts are not enumerated persons under the GENIUS Act

- The GENIUS Act defines "digital asset service provider" as **"a person that, for compensation or profit, engages in the business in the United States (including on behalf of customers or users in the United States) of: (i) exchanging digital assets for monetary value; (ii) exchanging digital assets for other digital assets; (iii) transferring digital assets to a third party; (iv) acting as a digital asset custodian; or (v) participating in financial services relating to digital asset issuance."**
  — Source: https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/; https://www.paulhastings.com/insights/crypto-policy-tracker/the-genius-act-a-comprehensive-guide-to-us-stablecoin-regulation

- The statute defines "person" as **"an individual, partnership, company, corporation, association, trust, estate, cooperative organization, or other business entity, incorporated or unincorporated."** This enumeration does not include software, algorithms, or autonomous smart contracts as independent persons.
  — Source: https://www.lw.com/en/insights/the-genius-act-of-2025-stablecoin-legislation-adopted-in-the-us

- a16z crypto's November 2025 Treasury comment letter argued explicitly: **"Treasury should make clear that since decentralized stablecoins are not issued by a 'person' within the meaning of the Act, they are not covered by the prohibition in Section 3(a)."** It cited Ethereum-backed LUSD (issued through autonomous smart contracts without a central entity in control) as the canonical example of a non-person issuer.
  — Source: https://www.theblock.co/post/378498/a16z-decentralized-stablecoins-genius-act; https://coincentral.com/a16z-crypto-urges-u-s-treasury-to-clarify-stablecoin-rules-and-protect-decentralized-innovation/

### Finding 2: The DASP definition explicitly excludes "a distributed ledger protocol" — which the statute defines to include smart contracts

- The GENIUS Act's DASP definition contains **explicit statutory exclusions**. A DASP does NOT include:
  - "a distributed ledger protocol"
  - "developing, operating, or engaging in the business of developing distributed ledger protocols or self-custodial software interfaces"
  - "an immutable and self-custodial software interface"
  - "developing, operating, or engaging in the business of validating transactions or operating a distributed ledger"
  - "participating in a liquidity pool or other similar mechanism for the provisioning of liquidity for peer-to-peer transactions"
  — Source: https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/; https://www.defieducationfund.org/genius-act-signed-into-law-ushering-in-first-federal-digital-assets-framework/

- A **"distributed ledger protocol"** is defined in the statute as **"publicly available and accessible executable software deployed to a distributed ledger, including smart contracts or networks of smart contracts."** A verified-source open-source `ClaimsAdjudicator` deployed on Somnia mainnet would meet this definition literally.
  — Source: https://www.lw.com/en/insights/the-genius-act-of-2025-stablecoin-legislation-adopted-in-the-us; https://www.ssga.com/us/en/intermediary/insights/genius-act-explained-what-it-means-for-crypto-and-digital-assets

- The DeFi Education Fund (November 2025 comment letter) stated: **"The definition notably omits decentralized distributed ledger protocols and self-custodial software interfaces, safeguarding DeFi from regulations designed for centralized financial intermediaries."**
  — Source: https://www.defieducationfund.org/genius-act-signed-into-law-ushering-in-first-federal-digital-assets-framework/

### Finding 3: The "for compensation or profit" requirement further excludes autonomous escrow contracts

- The DASP definition requires activity "for compensation or profit." A smart contract that holds stablecoin in escrow and releases it upon condition satisfaction does not itself receive compensation or operate for profit. This is an independent statutory filter that likely excludes `ClaimsAdjudicator` from DASP status regardless of the "person" and "distributed ledger protocol" exclusions.
  — Source: https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/ (DASP definition enumeration); inference from statutory structure.
  — **Weakly sourced**: no law firm has specifically analyzed the "for compensation or profit" requirement as applied to autonomous escrow contracts. This interpretation is logical but has not been confirmed by regulatory guidance.

### Finding 4: The DASP exclusions share a common structural feature — absence of custody or control over user assets

- Legal analysis identifies the structural principle unifying all DASP exclusions: **"The technologies explicitly excluded from the DASP definition, such as 'a distributed ledger protocol' and 'an immutable and self-custodial software interface,' share a common feature: they exert no custody or control over underlying assets or transactions."**
  — Source: https://www.defieducationfund.org/genius-act-signed-into-law-ushering-in-first-federal-digital-assets-framework/; https://www.ssga.com/us/en/intermediary/insights/genius-act-explained-what-it-means-for-crypto-and-digital-assets

- **Critical implication for cliqueue:** If `ClaimsAdjudicator` is designed as a truly non-upgradeable, operator-independent escrow contract (no admin key capable of unilaterally moving user funds, role-gated only by hospital and payer counterparties), it more closely resembles a "distributed ledger protocol" / immutable self-custodial interface than a custodial intermediary. The UUPS proxy + timelock governance structure already in cliqueue's design creates a potential wrinkle: if the governance multisig can upgrade the contract unilaterally, regulators may treat the governance multisig as the "operator" and attribute DASP status to the human operators (the cliqueue team or hospitals) rather than the contract itself.

### Finding 5: The OCC NPRM (February 2026) explicitly acknowledges the regulatory gap and does NOT resolve it

- The OCC's February 2026 NPRM to implement the GENIUS Act **does not clarify whether smart contracts or DeFi protocols satisfy the DASP definition**. K&L Gates noted: **"The NPRM does not clarify whether the operators, developers, governance participants, or front-end interface providers associated with such protocols could be considered 'digital asset service providers.'"**
  — Source: https://www.klgates.com/OCC-Proposes-Comprehensive-Rules-to-Implement-the-GENIUS-Act-That-Carry-Substantial-Market-Implications-3-11-2026

- The OCC NPRM explicitly flags: **"It is therefore unclear who, if anyone, would bear responsibility for restricting access to noncompliant payment stablecoins by US persons participating in DEX and DeFi transactions."**
  — Source: https://www.klgates.com/OCC-Proposes-Comprehensive-Rules-to-Implement-the-GENIUS-Act-That-Carry-Substantial-Market-Implications-3-11-2026

- The Act mandates further study: **"The Secretary must include in reporting 'legislative recommendations on the scope of the term "digital asset service provider," including with respect to decentralized finance.'"** This signals Congress's intent to revisit the question and confirms that the current text does not definitively resolve autonomous-contract status.
  — Source: https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/

### Finding 6: If `ClaimsAdjudicator` is NOT a DASP, the DASP obligation falls on the hospital and payer operators

- If the smart contract itself is excluded from the DASP definition (as the "distributed ledger protocol" exclusion and the "person" requirement both support), the relevant DASP analysis shifts to the human-operated entities that **offer or sell** the stablecoin through the contract. The hospital (submitting claims and triggering stablecoin deposits) and the payer (releasing settlement) would be the candidate DASPs.
  — Source: https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/ (DASP prohibition scope analysis)
  — **Weakly sourced**: no published analysis applies this specific attribution theory to healthcare settlement smart contracts. Hospital and payer counsel must assess whether their use of `ClaimsAdjudicator` constitutes "transferring digital assets to a third party" or "acting as a digital asset custodian" for GENIUS Act purposes.

- However, the DASP prohibition specifically restricts offering or selling **payment stablecoins** to US persons. Hospitals and payers using USDC.e to settle internally contracted obligations (not selling stablecoins to the public) are likely not "offering or selling" stablecoins in the regulatory sense.
  — Source: https://www.paulhastings.com/insights/crypto-policy-tracker/the-genius-act-a-comprehensive-guide-to-us-stablecoin-regulation (DASP prohibition scope); inference from statutory structure.
  — **Weakly sourced**: no healthcare-specific GENIUS Act analysis has been published applying the "offer or sell" concept to B2B settlement contracts.

**Design implication:** The weight of statutory text and industry commentary strongly supports that `ClaimsAdjudicator` — as a deployed smart contract (a "distributed ledger protocol" under the Act's definition), not operated by a "person for compensation or profit" — is categorically excluded from the GENIUS Act's DASP definition. This means the July 2028 DASP prohibition does not fall on the contract itself. However, the OCC NPRM leaves this unresolved, and the regulators mandated a follow-on study of DeFi scope. **Cliqueue should obtain a healthcare-informed GENIUS Act legal opinion before hospital launch** that documents: (a) the "distributed ledger protocol" exclusion argument; (b) the "person" requirement exclusion; (c) why hospitals and payers using the contract are not "offering or selling" stablecoins. The UUPS proxy + governance timelock adds a custody-control argument for regulator scrutiny — consider whether a frozen-implementation mode (proxy upgrade permanently disabled post-launch) strengthens the "immutable and self-custodial" exclusion argument.

**Open questions generated:**
1. Does the UUPS proxy upgrade mechanism (which allows the governance multisig to replace `ClaimsAdjudicator`'s implementation) cause the governance multisig holders to be treated as "operators" of a custodial intermediary under the GENIUS Act, rather than as developers of an immutable protocol — and does this require cliqueue to either (a) permanently disable the proxy upgrade after launch or (b) obtain explicit regulatory guidance? — priority: high
2. Should cliqueue's Settlement Token Policy document include a one-paragraph "GENIUS Act Non-DASP Determination" section citing the distributed ledger protocol exclusion and the "person" requirement, so hospital and payer procurement teams have documented legal support for their determination that using `ClaimsAdjudicator` does not make them DASPs? — priority: high
3. Do hospitals and payers using `ClaimsAdjudicator` to settle internally contracted obligations qualify as "offering or selling" stablecoins to US persons under GENIUS Act Section 8, or does the B2B settlement context remove them from the DASP prohibition's scope — and has any law firm published analysis of this specific B2B settlement attribution question? — priority: medium

---

**See also** — [[../topics/settlement-stablecoin|settlement hub]]
