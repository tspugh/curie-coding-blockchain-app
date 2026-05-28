# Medicare Advantage Risk-Adjustment Exclusion — Phase 1 Scope Gate

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should cliqueue exclude Medicare Advantage risk-adjustment coding from Phase 1 scope with a hard `ClaimsAdjudicator` gate — given active DOJ/OIG enforcement targeting AI vendors that auto-code MA diagnoses — and what specific claim-type identifiers distinguish MA risk-adjustment encounters from fee-for-service claims in the 837 EDI transaction?

### Background

Prior research flagged Medicare Advantage (MA) risk-adjustment coding as the highest-enforcement-risk domain for AI coding tools, noting major FCA actions against Kaiser Permanente ($556M, Jan 2026), Independent Health/DxID LLC ($100M, 2024), Cigna ($172M, 2023), and DaVita ($270M, 2018). The open question is whether to build a hard gate in `ClaimsAdjudicator` blocking MA risk-adjustment claim submissions, and how to identify MA claims at submission time.

---

### Finding 1: OIG February 2026 MA ICPG explicitly names AI-generated diagnosis prompts as a potentially abusive practice

- The OIG Medicare Advantage Industry Segment-Specific Compliance Program Guidance (ICPG), issued February 2026, is the first MA-specific compliance guidance since 1999. It explicitly lists **"AI-generated prompts encouraging unsupported coding"** as an example of a potentially abusive risk adjustment practice.
  — Source: [OIG MA ICPG landing page](https://oig.hhs.gov/compliance/ma-icpg/); [Arnold & Porter: Key Risk Areas for Medicare Advantage](https://www.arnoldporter.com/en/perspectives/blogs/fca-qui-notes/posts/2026/03/key-risk-areas-for-medicare-advantage)

- The ICPG recommends that "automated tools supplement — rather than replace — individualized medical judgment" and that MA plans implement "rigorous data accuracy procedures, including algorithmic and artificial intelligence-driven analyses of provider-submitted data" to detect outliers. It further recommends that "automated tools and algorithms are subject to human clinical oversight and override capability."
  — Source: [Healthicity: Inside the New OIG Guidance for Medicare Advantage](https://www.healthicity.com/blog/inside-the-new-oig-guidance-for-medicare-advantage); [McGuireWoods: Long Anticipated MA Compliance Guidance](https://www.mcguirewoods.com/client-resources/alerts/2026/4/long-anticipated-medicare-advantage-compliance-guidance-heightens-investor-and-provider-scrutiny/)

- **The ICPG is sub-regulatory voluntary guidance**, not an enforceable rule. However, DOJ and OIG routinely use it as a benchmark for evaluating "effective compliance programs" under FCA scienter (United States ex rel. v. Abbott Labs, Eighth Circuit standard). An MA plan or vendor that violates ICPG principles and submits unsupported diagnoses faces FCA exposure regardless of the guidance's non-mandatory status.
  — Source: [Duane Morris: OIG Issues MA ICPG, Creating Implications for Downstream Entities](https://www.duanemorris.com/alerts/oig_issues_medicare_advantage_industry_segment_specific_compliance_program_guidance_0226.html)

---

### Finding 2: FDR obligations under the MA ICPG flow contractually through the MA plan — but vendor AI tool exposure is real via FCA and indemnification

- The ICPG defines FDRs (first-tier, downstream, and related entities) broadly as entities performing "delegated administrative or health-care services" for an MA organization. This definition is broad enough to encompass an AI coding software vendor if it performs delegated coding functions for an MA plan — but does not expressly name AI coding vendors by category.
  — Source: [OIG MA ICPG](https://oig.hhs.gov/compliance/ma-icpg/); [National Law Review: OIG's New MA Compliance Guidance](https://natlawreview.com/article/oigs-new-medicare-advantage-program-compliance-guidance-what-providers-need-know)

- Regulatory obligations under the ICPG formally attach to MAOs, not directly to vendors. However, Duane Morris notes that FDR exposure includes "contract termination, repayment exposure, indemnification claims, exclusion risk, False Claims Act scrutiny and whistleblower actions" — flowing through contractual arrangements with MA plans.
  — Source: [Duane Morris: OIG Issues MA ICPG](https://www.duanemorris.com/alerts/oig_issues_medicare_advantage_industry_segment_specific_compliance_program_guidance_0226.html)

- **No OIG enforcement action or advisory opinion has yet named an AI coding tool vendor as an FDR.** The closest named case is Independent Health / DxID LLC (2024, $100M), where DxID was a coding vendor that improperly added diagnoses from chart reviews without clinical support — a behavioral (human-driven) scheme, not an autonomous AI pipeline. The DOJ's current working group language covers "vendors" generically alongside plans.
  — Source: [Arnold & Porter: Key Risk Areas for Medicare Advantage](https://www.arnoldporter.com/en/perspectives/blogs/fca-qui-notes/posts/2026/03/key-risk-areas-for-medicare-advantage); [DOJ: West Coast Health Care Fraud Strike Force](https://www.beneschlaw.com/insight/doj-strikes-again-healthcare-fraud-enforcement-escalates-as-doj-deploys-west-coast-strike-force/)

- **If cliqueue does not process MA claims at all** (hard gate prevents MA claim submission), the FDR classification risk drops to near-zero because the trigger condition — "furnishing delegated administrative or health-care services for the MA organization" — is not met for MA-specific functions.
  — Source: [OIG MA ICPG FDR framework](https://oig.hhs.gov/compliance/ma-icpg/)

---

### Finding 3: Distinguishing MA risk-adjustment claims from FFS in 837 requires payer ID, not CLM05

- **CLM05 does not distinguish MA from FFS.** CLM05-1 is Place of Service; CLM05-3 is Claim Frequency Code (original, corrected, void) per NUBC — neither field identifies the payer program type.
  — Source: [ResDAC: Claim Frequency Code](https://resdac.org/cms-data/variables/claim-frequency-code-ffs); [CMS 837I Companion Guide](https://www.cms.gov/files/document/cms-837i-noe-companion-guide.pdf)

- **MA vs. FFS identification in 837 is via payer identifiers in Loop 2010BB**: `NM109` (Payer Identifier/EDI ID) identifies the specific payer; Medicare FFS MACs use CMS-assigned MAC IDs, while MA plans use MA organization-specific EDI IDs. CLM06 (Claim Filing Indicator Code) may carry "MA" or "HM" for MA plans in some companion guides, but this is payer-specific and not universal.
  — Source: [CMS 837I Companion Guide CLM05-3](https://www.cms.gov/regulations-and-guidance/guidance/transmittals/downloads/r871cp.pdf); [Perplexity synthesis of X12 837 standard EDI fields]

- **There is no single CMS-published machine-readable master list of MA plan payer IDs.** MA organization EDI IDs are managed through payer-specific companion guides and clearinghouse configuration tables. In practice, cliqueue would need to maintain a blocklist of MA payer EDI IDs sourced from CMS's plan directory (`cms.gov/medicare/health-drug-plans/medicareadvtgspecialneedsplans/snpdata`) and clearinghouse payer tables.
  — Source: [CMS RADV overview](https://www.cms.gov/medicare/payment/medicare-advantage-radv); [Perplexity synthesis, weakly sourced — no single machine-readable list confirmed]

- **CMS risk-adjustment encounter submissions** (RAPS/EDPS files) are distinct from standard 837 claim files and use CMS-defined layouts with MA contract numbers and HICN/MBI. A hospital submitting an 837 institutional claim to an MA plan is making a payment claim to that plan — the MA plan separately generates RAPS/EDPS files for CMS risk adjustment. cliqueue's gate is properly placed at the 837 submission layer, blocking MA plan payer IDs from the `ClaimsAdjudicator` pipeline.
  — Source: [CMS RADV program page](https://www.cms.gov/medicare/payment/medicare-advantage-radv)

---

### Finding 4: DOJ 2026 enforcement focus — MA risk adjustment and AI-driven billing tools named as top priorities

- DOJ's Health Care Fraud Unit and Civil Division 2026 enforcement priorities explicitly include: (1) MA risk-adjustment and diagnosis upcoding, (2) AI and algorithm-driven tools that influence coding/billing and may encourage unsupported diagnoses, (3) digital health and technology-driven billing models.
  — Source: [Goodwin Law: DOJ Announces Initiatives Supporting Anti-Fraud Mission, May 2026](https://www.goodwinlaw.com/en/insights/publications/2026/05/alerts-practices-hltc-doj-announces-initiatives-supporting-anti-fraud-mission); [Benesch: DOJ Strikes Again: Healthcare Fraud Enforcement Escalates](https://www.beneschlaw.com/insight/doj-strikes-again-healthcare-fraud-enforcement-escalates-as-doj-deploys-west-coast-strike-force/)

- The new **West Coast Health Care Fraud Strike Force** (launched Q1 2026) specifically targets digital health and technology-driven billing models including AI-assisted coding — the first regional strike force with an explicit AI/tech mandate.
  — Source: [Carlton Fields: DOJ Turns West in Expanding Health Care Fraud Enforcement](https://www.carltonfields.com/insights/publications/2026/doj-turns-west-in-expanding-health-care-fraud-enforcement)

- No DOJ press release as of May 2026 names a specific AI coding software vendor (as opposed to a plan or hospital) as an enforcement target for MA auto-coding. The risk is at the *theory of liability* level — established legal principles apply, but no "AI MA auto-coding vendor" test case has been publicly resolved.
  — Source: [ForvisMazars: OIG Work Plan Q1 2026](https://www.forvismazars.us/forsights/2026/05/oig-work-plan-updates-compliance-implications-q1-2026); [RISE National 2026: CMS/DOJ/OIG on Future of MA Enforcement](https://www.risehealth.org/insights-articles/live-at-rise-national-2026-cms-doj-and-oig-on-the-future-of-medicare-enforcement-and-use-of-ai-in-fraud-detection/)

---

### Finding 5: Recommended Phase 1 gate architecture — payer ID blocklist, not CLM05

- **Gate mechanism**: The `ClaimsAdjudicator` smart contract cannot read 837 EDI fields directly — the off-chain agent adapter must perform MA detection before submitting to the chain. The adapter should:
  1. Check Loop 2010BB `NM109` (payer EDI ID) against a maintained MA payer blocklist.
  2. Check CLM06 for "MA" or "HM" filing indicator codes as a secondary signal (payer-specific, not universal).
  3. If MA payer detected: reject at adapter layer with a `MAClaimExcludedFromPhase1` error code — do not submit to `ClaimsAdjudicator`.
  — Source: EDI 837 field analysis above; design inference.

- **On-chain enforcement option**: A `blockedPayerIds(bytes32 payerIdHash) → bool` mapping in `ClaimsAdjudicator`, governed by `TimelockController`, would create an immutable on-chain record that MA payer IDs are excluded — auditable by hospital compliance teams and OIG without relying on cliqueue's off-chain configuration. The adapter would pass a `payerIdHash` at submission time; the contract reverts if blocked.
  — **Design inference**: no primary source; pattern is analogous to ERC-20 blocklists (Tether, Circle USDC) which are established on-chain governance patterns.

- **Updating the blocklist**: CMS publishes the MA plan directory at `cms.gov`; cliqueue's deployment runbook should include an annual step (each April, when CMS publishes the following year's MA plan data) to update the payer ID blocklist via `TimelockController` governance proposal with a minimum 48-hour notice period.

---

**Design implication:** cliqueue should implement a two-layer MA exclusion gate: (1) off-chain adapter MA payer ID blocklist rejecting at adapter layer before any chain submission, and (2) optional on-chain `blockedPayerIds` mapping in `ClaimsAdjudicator` for audit transparency. This gate should be documented in the hospital BAA as a "Phase 1 Scope Limitation" — cliqueue does not process MA risk-adjustment claims — which eliminates FDR exposure under the OIG MA ICPG and removes the highest-enforcement-risk domain from Phase 1 entirely. The MA exclusion does not require a contract upgrade; it is a governance-controlled payer blocklist, not a claim-type flag, because MA vs. FFS is a payer identity question (Loop 2010BB NM109), not a claim structure question (CLM05).

**Open questions generated:**
1. Should the on-chain `blockedPayerIds` mapping use `bytes32` hashes of payer EDI IDs (preserving privacy of the specific MA plan) or store the raw EDI ID string — and does storing raw payer IDs on a public chain create any HIPAA or competitive-sensitivity concern?
2. Should cliqueue's hospital BAA include an explicit "Medicare Advantage Exclusion Exhibit" listing the Phase 1 scope limitation and the mechanism (payer ID blocklist) — giving hospital compliance teams a documented defense if an MA claim accidentally enters the system due to a missing entry in the blocklist?
3. As cliqueue scales to Phase 2, what human attestation architecture (analogous to the inpatient DRG SBT gate) would satisfy the OIG MA ICPG "human clinical oversight and override capability" requirement for MA risk-adjustment diagnoses — enabling a Phase 2 MA expansion without autonomous coding?

---

**See also** — [[../topics/settlement-stablecoin|settlement hub]] · [[../topics/sbt|SBT hub]]
