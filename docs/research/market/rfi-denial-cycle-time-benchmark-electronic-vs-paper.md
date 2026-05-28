## 2026-05-17 — RFI denial cycle time benchmark: paper/fax resolves in 60–120 days; no published universal electronic 275 turnaround; CMS-0053-F sets no mandatory response window

**Question answered:** Is there a published HFMA, Kodiak Solutions, or industry benchmark for electronic vs. paper/fax 275 attachment response turnaround time — and does the "90-day paper" figure in prior research have a primary source?

### Primary-source findings

- **The "60–120 days" RFI resolution window is sourced to Kodiak Solutions VP Matt Szaflarski on the FAH podcast (Federation of American Hospitals).** His exact quote: "89% of these requests for information denials end up getting resolved without any sort of net revenue leakage or final denials being posted to the account. But they're not resolved until 60, 90, 120 days later." He presents this from Kodiak's benchmarking database. ([FAH podcast: "The Delay and Deny Cycle: A Closer Look at Recent Trends"](https://www.fah.org/podcasts/the-delay-and-deny-cycle-a-closer-look-at-recent-trends/); [Matt Szaflarski, VP Revenue Cycle Intelligence, Kodiak Solutions](https://www.kodiaksolutions.io/company/our_leadership/matt_szaflarski))

- **The "90 days" figure in prior research (from Advantum Health citing Kodiak 2024 KPI Benchmark) is NOT a cycle-time-to-payment figure.** The Advantum Health article at `advantumhealth.com/how-advantum-health-combats-rising-request-for-information-claim-denials/` cites Kodiak denial-rate and cost figures only — it does not mention 90 days as an RFI resolution cycle time. The 90-day figure most plausibly represents an RFI response deadline (timely filing window) conflated with cycle time, not a measured average from denial to payment.

- **HFMA does not publish a universal day-count benchmark for RFI denial resolution.** HFMA's denial standardization guidance defines "time from initial denial to claim resolution" as a metric for internal trending, but sets no universal day-count threshold for RFI-specific denials. No RFI-specific subcategory benchmark exists in HFMA's standardized framework. ([HFMA denial metrics guidance](https://www.hfma.org/guidance/standardizing-denial-metrics-revenue-cycle-benchmarking-process-improvement/))

- **General claim denial resolution benchmark: 30 days (industry standard, unsourced).** MDClarity and trade press cite 30 days as the industry standard for resolving a denied claim, but this figure carries no authoritative citation — it is presented as industry consensus without attribution to HFMA, Kodiak, or another primary source. ([MDClarity](https://www.mdclarity.com/rcm-metrics/average-time-to-resolve-claim-denials))

- **No universal electronic 275 attachment turnaround time exists in CMS-0053-F.** The March 2026 final rule (Federal Register 2026-05676, compliance deadline May 26, 2028) adopts X12 277 and X12 275 standards but sets no mandatory payer response window — no "payer must process within X hours/days" requirement. Timing is governed by payer companion guides. ([CMS-0053-F fact sheet](https://www.cms.gov/files/document/nsg-attachments-final-rule-fact-sheet.pdf); [Federal Register 2026-05676](https://www.federalregister.gov/documents/2026/03/24/2026-05676/administrative-simplification-adoption-of-standards-for-health-care-claims-attachments-transactions))

- **Payer companion guides set electronic 275 matching windows of 5–7 calendar days after claim receipt.** UnitedHealthcare's 006020X314 companion guide requires 275 attachments within 5 calendar days of claim receipt; Anthem Blue Cross and VA Community Care set 7 calendar days. These are administrative matching windows, not adjudication timelines. ([UHC 275 Companion Guide](https://www.uhcprovider.com/content/dam/provider/docs/public/resources/edi/EDI-275-Companion-Guide-for-UHC-006020X314.pdf); [Anthem CA](https://www.anthembluecross.com/content/dam/digital/docs/anthembluecross/provider/commercial/general/EDI_CA_00025.pdf))

- **No vendor (Waystar, Change Healthcare/Optum, Experian Health) publishes a specific day-count showing X12 275 shortening RFI-to-payment time.** All major vendors describe electronic attachments as reducing manual follow-up and accelerating payer response qualitatively, but no universal "paper = X days / electronic = Y days" metric is published by any named vendor as of May 2026.

- **BCBS Kansas (May 2025) and NGS Medicare (June 2025)** announced X12 275 unsolicited attachment acceptance but published no processing-time metrics — only confirmation of format support. ([BCBS KS](https://www.bcbsks.com/latest-news/unsolicited-electronic-claim-attachment-functionality-x12-275))

- **CAQH Index 2023/2024** documents prior authorization transaction time savings (11 min electronic vs. 16 min portal; 14-min-per-auth industry savings opportunity) and a $12.3B–$18.3B industry savings opportunity from full electronic adoption, but publishes no "days-to-adjudication" figure for claims attachments. ([2023 CAQH Index](https://www.caqh.org/hubfs/43908627/drupal/2024-01/2023_CAQH_Index_Report.pdf); [2024 CAQH Index Key Takeaways](https://www.caqh.org/hubfs/Index/2024%20Index%20Report/CAQH%202024%20Index%20Report%20Key%20Takeaways%20FINAL.pdf))

### Corrected ROI framing

The prior research entry for 2026-05-17 (rfi-denial-pathway-paauthash-on-chain-scope.md) used "90-day paper/fax RFI cycle" without a primary-source citation. The corrected primary-sourced framing is:

- **Paper/fax RFI resolution baseline: 60–120 days** (Kodiak Solutions VP, FAH podcast; presented from Kodiak benchmarking database — strong industry source, not a peer-reviewed study)
- **Electronic 275 matching window: 5–7 calendar days** (UHC/Anthem/VA companion guides — this is the administrative matching window only, not full adjudication)
- **Full adjudication after electronic 275 attachment:** no published universal benchmark exists

The correct defensible ROI framing for cliqueue is therefore: **"X12 275 electronic attachment converts the 60–120 day paper/fax RFI resolution cycle to a 5–7 day payer matching window per published companion guides — with full adjudication timeline governed by payer contract terms."** The stronger claim ("24–72h electronic") is not supported by any published primary source and should be removed from cliqueue materials.

**Design implication:** cliqueue's ROI calculator must revise the RFI framing: use "60–120 day paper/fax baseline" (FAH/Kodiak source) and "5–7 day electronic matching window" (UHC/Anthem companion guides) — not "90-day paper → 24-72h electronic." No primary source supports the 24-72h electronic turnaround claim. The ROI story is still materially strong: 60–120 days → 5–7 days is a documented compression, attributable to adoption of CMS-0053-F electronic 275 workflow.

**Open questions generated:**
1. Does any payer companion guide (UHC, Aetna, Cigna, Humana) publish the adjudication-to-payment cycle time specifically for claims with electronic 275 attachments vs. paper/fax — enabling cliqueue to cite a full end-to-end comparison rather than the administrative matching window alone?
2. Should cliqueue's hospital ROI calculator present RFI denial value with a range ("60–120 days → 5–7 days matching window") rather than a point estimate — and should it include a confidence qualifier noting that adjudication timeline after matching is payer-contract-dependent?
3. Should the prior research file [[rfi-denial-pathway-paauthash-on-chain-scope]] be updated to correct the "90-day paper" baseline to "60–120 days (Kodiak/FAH)" and remove the unsourced "24-72h electronic" claim?

---

**See also** — [[../topics/x12|X12 hub]] · [[../topics/prior-auth|PA hub]]
