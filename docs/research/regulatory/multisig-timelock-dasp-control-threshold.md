# GENIUS Act DASP Control Threshold — 3-of-5 Multisig + 48-Hour Timelock Analysis

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — At what upgrade-authority threshold does the "total independent control over network architecture" test cause a governance multisig to become a DASP — does a 3-of-5 multisig with a 48-hour timelock fall below that threshold, or does any upgrade authority regardless of process constitute "total control"?

### Finding 1: The GENIUS Act's DASP definition requires a "person" — autonomous smart contracts cannot be DASPs regardless of upgrade path

- The GENIUS Act defines "person" to mean "an individual, partnership, company, corporation, association, trust, estate, cooperative organization, or other business entity, incorporated or unincorporated." Autonomous software (e.g., `ClaimsAdjudicator`) is not enumerated. The contract itself is categorically not a DASP.
  — Source: https://www.congress.gov/bill/119th-congress/senate-bill/1582/text; https://www.arnoldporter.com/en/perspectives/advisories/2025/07/new-stablecoin-legislation-analyzing-the-genius-act

- The "distributed ledger protocol" exclusion in the DASP definition covers "publicly available and accessible executable software deployed to a distributed ledger, including smart contracts or networks of smart contracts." Crucially, this exclusion does NOT require immutability — it applies to upgradeable proxy-deployed contracts as well as immutable ones. A separate exclusion ("immutable and self-custodial software interface") does require immutability but is an independent, more specific carve-out.
  — Source: https://www.lw.com/en/insights/the-genius-act-of-2025-stablecoin-legislation-adopted-in-the-us; https://www.arnoldporter.com/en/perspectives/advisories/2025/07/new-stablecoin-legislation-analyzing-the-genius-act
  — Assessment: Moderate confidence. The two-exclusion structure (upgradeable DLP vs. immutable software interface) is statutory text, but no published regulatory guidance has addressed this distinction directly for proxy-deployed settlement contracts.

### Finding 2: The FinCEN 2019 "total independent control" standard — the closest authoritative precedent — is NOT met by a minority multisig key holder

- FinCEN's May 2019 guidance (FIN-2019-G001) established the controlling precedent for "total independent control" in the digital asset context. It set a four-factor test: (a) who owns the value; (b) where the value is stored; (c) whether the owner interacts directly with the payment system; and (d) **whether the person acting as intermediary has total independent control over the value.**
  — Source: https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf; https://www.sidley.com/en/insights/newsupdates/2019/05/fincen-updates-guidance-regarding-convertible-virtual-currencies

- FinCEN explicitly held that **"the person participating in the transaction to provide additional validation at the request of the owner does not have total independent control over the value."** When a multi-signature wallet provider limits its role to providing one key of a required set, it is NOT a money transmitter because it cannot complete transactions unilaterally.
  — Source: https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf; https://kelman.law/navigating-fincens-latest-guidance/

- Applied to cliqueue's 3-of-5 multisig + 48-hour timelock governance architecture: **no individual governance key holder has "total independent control"** over `ClaimsAdjudicator`. A 3-of-5 threshold means any single key holder controls only 20% of the required consensus and cannot unilaterally initiate, schedule, or execute an upgrade. The 48-hour timelock adds a temporal constraint that further prevents unilateral action even by a colluding minority.
  — Source: structural inference from FinCEN 2019 four-factor test applied to 3-of-5 multisig governance.
  — Assessment: High-confidence framing; FinCEN's holding is directly on point for individual key holders. Whether the same analysis applies to the entire multisig acting collectively is less clear.

### Finding 3: SIFMA's proposed "effective or ongoing ability to alter, upgrade, or profit" standard is a lobbying recommendation, not binding regulation — and has NOT been adopted in any NPRM

- SIFMA's November 4, 2025 ANPR comment letter recommended Treasury define control to include a protocol's governance structure being "such that its developers, operators, or validators are able to 'control' the operation of a protocol," which it defined as "having effective or ongoing ability to alter, upgrade, or profit from the operation."
  — Source: https://www.sifma.org/wp-content/uploads/2025/11/SIFMA-UST-GENIUS-Act-ANPR-FINAL-11-04-2025.pdf

- This "effective or ongoing ability to alter or upgrade" language was a SIFMA recommendation submitted for Treasury consideration. Neither the OCC NPRM (February 2026), the FinCEN PPSI AML/CFT NPRM (April 2026), nor the FDIC NPRM (April 2026) has adopted SIFMA's proposed formulation. The OCC NPRM explicitly deferred the governance participant / developer / upgrade-authority question to future rulemaking, stating: **"The NPRM does not clarify whether the operators, developers, governance participants, or front-end interface providers associated with such protocols could be considered 'digital asset service providers.'"**
  — Source: https://www.klgates.com/OCC-Proposes-Comprehensive-Rules-to-Implement-the-GENIUS-Act-That-Carry-Substantial-Market-Implications-3-11-2026; https://www.sifma.org/wp-content/uploads/2025/11/SIFMA-UST-GENIUS-Act-ANPR-FINAL-11-04-2025.pdf

- **Practical implication:** The SIFMA standard (the most expansive proposed interpretation) would categorize any governance participant with upgrade authority as a potential DASP — but this standard has not been adopted. The current binding authority (FinCEN 2019) requires "total independent control," which a non-majority multisig key holder cannot exercise.

### Finding 4: The structural principle unifying all DASP exclusions is "absence of custody or control" — not absence of upgrade authority

- All published law firm analysis (DeFi Education Fund, Gibson Dunn, a16z, SIFMA) converges on the same principle: DASP exclusions apply to actors that "exert no custody or control over underlying assets or transactions." Immutable protocols, self-custodial interfaces, and liquidity pools are excluded because they cannot unilaterally redirect user funds.
  — Source: https://www.defieducationfund.org/genius-act-signed-into-law-ushering-in-first-federal-digital-assets-framework/; https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/; https://www.ssga.com/us/en/intermediary/insights/genius-act-explained-what-it-means-for-crypto-and-digital-assets

- The DeFi Education Fund's November 2025 Treasury comment letter argued that the DASP definition "is limited to centralized actors who custody and control user assets" and that "decentralized distributed ledger protocols and self-custodial software interfaces" are safeguarded by design.
  — Source: https://www.defieducationfund.org/wp-content/uploads/2025/11/GENIUS-Act-Implementation-Comments-11-04-25.pdf

- A 3-of-5 multisig + 48-hour timelock governance structure does NOT give any individual actor unilateral custody or control. The 48-hour notice period also allows hospital and payer stakeholders to monitor and react to pending governance actions (via `CallScheduled` event alerts) before any upgrade is executed. This aligns with the Uniswap governance model, which has not been treated as triggering DASP obligations.

### Finding 5: The "for compensation or profit" element is an independent second filter — and the SIFMA control test also requires this element

- The GENIUS Act DASP definition requires activity "for compensation or profit." Both the control analysis and the upgrade-authority analysis are subordinate to this element. If cliqueue's governance multisig holders receive no fees, token allocation, or equity upside tied to `ClaimsAdjudicator`'s operation, the "for compensation or profit" element may fail independently — removing multisig holders from DASP scope regardless of upgrade authority.
  — Source: https://www.arnoldporter.com/en/perspectives/advisories/2025/07/new-stablecoin-legislation-analyzing-the-genius-act; https://www.paulhastings.com/insights/crypto-policy-tracker/the-genius-act-a-comprehensive-guide-to-us-stablecoin-regulation
  — Assessment: Weakly sourced for the specific aggregation question (whether a related commercial relationship can satisfy "for compensation or profit"). No law firm has published analysis of this aggregation scenario for a healthcare B2B settlement context.

### Finding 6: Three concrete architecture positions on the DASP control threshold — risk-ranked

**Position A (Current) — 3-of-5 multisig + 48-hour timelock, proxy upgrade retained:**
- Risk level: **Low-to-moderate under current binding FinCEN standard; moderate under SIFMA's proposed (but not adopted) standard.**
- FinCEN 2019 analysis: no individual holder has "total independent control." Collectivist reading (the multisig acting as a unit) is unresolved.
- Strongest arguments: "person" exclusion (contract itself), "distributed ledger protocol" exclusion, no individual holder meeting "total independent control" test, "for compensation or profit" element.
- Requires: formal legal opinion documenting the non-DASP analysis before hospital launch.

**Position B — Timelock delay extension to 7 days + 4-of-7 multisig after $10M TVL threshold:**
- Risk level: **Lower under any control test.** A 4-of-7 multisig requires 57% consensus; a 7-day delay is a recognized Tier-1 governance safety standard (Compound v3, MakerDAO post-2022).
- Supports the argument that no actor individually or collectively can exercise "effective or ongoing ability to alter" the contract without creating a publicly-visible, time-delayed window for any hospital or payer stakeholder to exit.
- Tradeoff: adds key management complexity before first hospital deployment.

**Position C (Strongest DASP exclusion) — Renounce ProxyAdmin after 90-day stability window:**
- Risk level: **Negligible.** Satisfies the "immutable and self-custodial software interface" exclusion directly. No governance participant can upgrade the contract after renounce date — eliminating any DASP argument for multisig holders regardless of the future regulatory definition.
- Tradeoff: eliminates ability to patch bugs or governance issues post-renounce. Recommended only after formal audit and extended testnet period.
- Source: docs/research/regulatory/uups-proxy-governance-multisig-dasp-operator-risk.md (Path A, Finding 5).

**Design implication:** A 3-of-5 multisig + 48-hour timelock is defensible under current binding FinCEN "total independent control" analysis but vulnerable to the SIFMA standard if it is adopted in future rulemaking. The most durable design for the regulatory ambiguity window (2026–2028) is to: (1) launch with Position A + formal legal opinion; (2) escalate to Position B after first hospital goes live; and (3) offer Position C (ProxyAdmin renounce) as an elective "compliance upgrade" for hospital procurement teams that require the "immutable self-custodial software interface" exclusion explicitly. The cliqueue Settlement Token Policy's "GENIUS Act Non-DASP Determination" section should document all three positions and state which the current deployment occupies.

**Open questions generated:**
1. Does the GENIUS Act's "distributed ledger protocol" exclusion cover an upgradeable transparent proxy contract where the implementation can be replaced by a governance multisig, or does upgradeability break the "distributed ledger protocol" characterization — and has any law firm published analysis of this specific proxy-upgrade + DLP-exclusion interaction?
2. Would a 4-of-7 multisig with a 7-day timelock clearly satisfy a future rulemaking that adopts the SIFMA "effective or ongoing ability to alter or upgrade" standard — or does any collective upgrade authority above 0-of-N fall within "effective" control regardless of threshold?
3. Should cliqueue's hospital BAA specify which Position (A, B, or C) the current deployment occupies, with a covenant to escalate to Position B upon achieving $10M TVL — giving hospital legal teams a documented upgrade path for the 2026–2028 regulatory ambiguity window?

---

**See also** — [[../topics/upgradeable-proxy|upgradeable-proxy hub]] · [[../topics/settlement-stablecoin|settlement hub]]
