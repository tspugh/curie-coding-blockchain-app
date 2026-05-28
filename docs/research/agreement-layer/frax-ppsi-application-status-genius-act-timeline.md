# Frax Finance PPSI Application Status and GENIUS Act Compliance Timeline

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Has Frax Finance submitted a formal PPSI license application under the GENIUS Act — and does this determine whether USDso qualifies as a compliant settlement token for cliqueue before the DASP prohibition takes effect July 2028?

### Finding 1: Frax Finance has NOT submitted a PPSI application — no formal licensing pathway is active

- As of May 2026, Frax Finance is not listed on the OCC's public digital asset licensing applications tracker, which lists 13 pending applicants including Payward, Agora, OpenReserve, Lorum, Bastion, EDX, Revolut, Zerohash, PAYO, Morgan Stanley Digital Trust, Laser Digital, Connectia, and World Liberty. Frax Finance is absent.
  — Source: https://www.occ.treas.gov/topics/charters-and-licensing/digital-assets-licensing-applications/index-digital-assets-licensing-applications.html

- PPSI license applications **cannot formally be submitted until implementing regulations are finalized**, which regulators are required to complete by July 18, 2026. Applications open after that date. The OCC's process — modeled on national bank chartering — requires a 30-day completeness review then a 120-day approval decision window, meaning earliest conditional approval is October–November 2026 at best.
  — Source: https://www.consumerfinancialserviceslawmonitor.com/2026/03/ncua-proposes-genius-act-licensing-framework-for-credit-union-stablecoin-issuers/; https://www.morganlewis.com/pubs/2026/04/genius-act-implementation-key-proposals-and-what-comes-next

- OCC precedent (Circle, Paxos, Ripple, BitGo) shows conditional approvals taking weeks to a few months from application submission under the pre-GENIUS national trust bank pathway. However, converting from conditional approval to operational status can take much longer — Anchorage Digital is the only entity to have done so.
  — Source: https://www.fintechweekly.com/news/occ-national-trust-bank-charter-crypto-fintech-2026

### Finding 2: Frax Finance is incorporated in the Cayman Islands — it cannot directly become a PPSI without a US entity or a foreign issuer determination

- The GENIUS Act requires a PPSI to be "a person that is formed in the United States." Frax Finance is headquartered in Grand Cayman, Cayman Islands and cannot directly obtain PPSI status without either (a) forming a US entity (subsidiary or restructuring) or (b) qualifying under the foreign issuer pathway.
  — Source: https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/

- The **foreign issuer pathway** requires Treasury to determine that the home jurisdiction has a "comparable" regulatory regime. Treasury must issue compatibility rules within one year of enactment and has a 210-day decision window for individual compatibility requests. The Cayman Islands does not yet have a published comparable-regime determination.
  — Source: https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/; https://www.morganlewis.com/pubs/2025/07/genius-act-passes-in-us-congress-a-breakdown-of-the-landmark-stablecoin-law

- Frax's public positioning frames frxUSD as "GENIUS Act-compliant" based on reserve structure (1:1 U.S. Treasury-equivalent reserves) and founder Sam Kazemian's involvement in drafting the Act — but this is reserve compliance, not issuer licensing compliance. No PPSI designation has been awarded to any issuer as of May 2026.
  — Source: https://www.edgen.tech/news/crypto/frax-finances-frxusd-gains-traction-as-genius-act-compliance-drives-stablecoin-innovation

### Finding 3: The GENIUS Act's prohibition structure — the DASP prohibition (July 2028) is cliqueue's actual blocking constraint, not the issuance prohibition (Jan 2027)

- **Issuance prohibition (effective ~November 2026, i.e., earlier of January 18, 2027 or 120 days after final rules):** Only prohibits *issuance* of payment stablecoins by non-PPSIs. This affects Frax (as issuer), not cliqueue (as a settlement protocol using the stablecoin).
  — Source: https://www.paulhastings.com/insights/crypto-policy-tracker/the-genius-act-a-comprehensive-guide-to-us-stablecoin-regulation

- **DASP prohibition (effective July 18, 2028):** Digital asset service providers (custodians, exchanges, DASPs) are prohibited from *offering or selling* non-PPSI payment stablecoins to US persons. The GENIUS Act defines "digital asset service provider" broadly — if cliqueue's `ClaimsAdjudicator` functions as a DASP (by facilitating custody or transfer of payment stablecoins), this prohibition applies directly.
  — Source: https://www.paulhastings.com/insights/crypto-policy-tracker/the-genius-act-a-comprehensive-guide-to-us-stablecoin-regulation; https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/

- **Practical implication:** If Frax Finance does not obtain PPSI status (or qualify under the foreign issuer exception) before July 18, 2028, using USDso/frxUSD as a settlement token would be prohibited for cliqueue as a DASP in the US market. The July 2028 deadline is the hard backstop — 26 months from now.
  — Source: https://www.winston.com/en/blogs-and-podcasts/non-fungible-insights-blockchain-decrypted/real-genius-landmark-us-federal-payment-stablecoin-legislation

### Finding 4: Frax's "GENIUS Act compliance" is aspirational reserve design, not regulatory certification — PPSI is not yet operational anywhere

- No issuer — including Circle, USDC, Tether, or Frax — has been granted PPSI status as of May 2026 because the licensing framework is not yet operational (regulations still in NPRM phase). Any vendor claiming "GENIUS Act certified" before final rules and PPSI licensing opens (post-July 18, 2026) is describing reserve design, not regulatory status.
  — Source: https://www.morganlewis.com/pubs/2026/04/genius-act-implementation-key-proposals-and-what-comes-next

- Circle received OCC conditional approval for a **national trust bank charter** (not PPSI) in early 2026 — this is the pre-GENIUS pathway that major issuers are pursuing to be positioned for PPSI conversion once final rules issue.
  — Source: https://www.circle.com/pressroom/circle-receives-conditional-approval-from-occ-for-national-trust-charter; https://www.fintechweekly.com/news/occ-national-trust-bank-charter-crypto-fintech-2026

- Frax Finance has not pursued this national trust bank pathway. Its $50M ATW Partners investment (January 2026, custodied by BitGo) positions frxUSD as an institutional instrument, but custodianship at BitGo does not confer PPSI status on Frax.
  — Source: https://aijourn.com/atw-partners-agrees-to-invest-50-million-in-fraxs-frxusd-stablecoin-custodied-by-bitgo/

### Finding 5: The regulatory regime distinction — USDC vs. USDso/frxUSD for enterprise procurement teams

- For hospital and payer procurement teams reviewing cliqueue's Settlement Token Policy, the distinction is: (1) Circle has OCC conditional approval for a national trust bank charter — it is on a documented, verifiable PPSI track; (2) Frax Finance has no pending US regulatory filing and is incorporated offshore.
  — Source: https://occ.gov/news-issuances/news-releases/2025/nr-occ-2025-125.html

- GENIUS Act's three-year DASP grace period (through July 2028) means USDso/frxUSD can be used in cliqueue's MVP without legal exposure in the near term. However, hospital procurement teams may apply a subjective "PPSI track" standard earlier than July 2028 — specifically, enterprise health system legal teams doing due diligence will likely require documented issuer regulatory status as part of BAA/contract review, which Frax cannot currently provide.
  — Source: Expert inference based on https://www.paulhastings.com/insights/crypto-policy-tracker/the-genius-act-a-comprehensive-guide-to-us-stablecoin-regulation

**Design implication:** USDso/frxUSD is legally usable for cliqueue MVP through at least July 2028 (DASP prohibition date), but Frax Finance's lack of any US licensing pathway (no OCC charter application, offshore incorporation, no PPSI filing possible until July 2026) means it cannot be positioned as the GENIUS Act-compliant settlement token for hospital enterprise procurement. Cliqueue's Settlement Token Policy must disclose that the MVP settlement token (USDC.e / Stargate-bridged or USDso) is not currently PPSI-certified, and the upgrade path to a PPSI-compliant token (Circle native USDC after Bridged USDC Standard adoption) remains cliqueue's primary settlement token migration priority. USDso should be listed as a secondary/future option, contingent on Frax Finance obtaining US regulatory status — which requires either a US entity formation or a Cayman Islands comparable-regime Treasury determination, neither of which is in process.

**Open questions generated:**
1. Does the GENIUS Act's definition of "digital asset service provider" encompass a smart contract like `ClaimsAdjudicator` that holds escrow stablecoin balances — or does it only apply to human-operated custodial intermediaries? If the former, cliqueue must have a PPSI-compliant token by July 18, 2028; if the latter, the hospital and payer signatories to the contract bear the DASP obligation. — priority: high
2. Should cliqueue's Settlement Token Policy document explicitly list USDC.e (not PPSI-certified, Stargate-bridged) and native USDC (Circle, on PPSI track via OCC charter) as Tier 1 and Tier 2 tokens respectively, with USDso listed as Tier 3 (contingent on Frax PPSI status) — so hospital procurement teams have a structured compliance path regardless of when Frax achieves regulatory status? — priority: high
3. Is there a viable path for Frax Finance to obtain Treasury's "comparable regime" determination for the Cayman Islands regulatory framework — and has any other Cayman-incorporated stablecoin issuer obtained such a determination under any pre-GENIUS framework? — priority: medium

---

**See also** — [[../topics/settlement-stablecoin|settlement hub]]
