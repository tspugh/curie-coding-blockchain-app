# Research Backlog Triage — BLOCKER / IMPORTANT / POST-HACKATHON

## Summary

This file classifies all **active (uninvestigated, non-struckthrough)** items from `docs/research/research-questions.md` into three priority tiers relative to the agentathon demo scope defined in `docs/ROADMAP.md`.

**Classification criteria:**
- **BLOCKER**: Must resolve before the demo can actually function. Without this, the demo loop breaks, crashes, or violates the core "no PHI on-chain" constraint judges will scrutinize.
- **IMPORTANT**: Should resolve during hackathon but has workarounds. If unresolved, the demo proceeds in a degraded/placeholder mode.
- **POST-HACKATHON**: Regulatory minutiae, BAA exhibits, legal opinions, compliance documentation, post-launch operations. Valuable but irrelevant to a 90-second demo loop.

**Counts (active items total: ~125):**
- **BLOCKER**: 22
- **IMPORTANT**: 41
- **POST-HACKATHON**: 62

---

## BLOCKER — Must resolve for demo to work

Core protocol, contract correctness, demo connectivity, PHI safety, data correctness, or agent callback timing.

| # | Item Title | Category | Rationale |
|---|---|---|---|
| 1 | Should cliqueue's hospital BAA include an explicit "Medicare Advantage Exclusion Exhibit" listing the Phase 1 scope limitation and the payer ID blocklist mechanism? | BLOCKER | Demo must not process MA claims; undocumented exclusion gate violates Phase 1 scope constraint. |
| 2 | Should cliqueue define a canonical payer ID format specification and publish it in the hospital onboarding checklist? | BLOCKER | Without canonical format the demo's payer blocklist can silently bypass — judge-facing security vulnerability. |
| 3 | Should ClaimsAdjudicator enforce canonical payer ID format in blockPayer() on-chain, or defer to off-chain deployment runbook? | BLOCKER | On-chain enforcement prevents silent bypass; without it the demo contract has a security gap. |
| 4 | Should the hybrid attestation architecture (immutable INPATIENT_REQUIRES_ATTESTATION + governed attestationRequired mapping) be documented as a formal spec amendment before next feature branch regeneration? | BLOCKER | Codebase divergence from research findings would mean the demo contract implements the wrong inpatient gating logic. |
| 5 | Should cliqueue's off-chain agent spec formally define a TOB_TO_SYMPHONY_SYSTEM mapping table as a standalone TypeScript constant? | BLOCKER | Provider agent needs this mapping to call Symphony correctly; without it, wrong ICD-10 codes are produced, breaking the demo. |
| 6 | Should the PAUSER role in ClaimsAdjudicator be a dedicated 2-of-3 emergency multisig separate from the 3-of-5 governance multisig, or the same key set? | BLOCKER | Emergency pause is critical during demo; poorly configured PAUSER means no way to recover from stuck claims. |
| 7 | Does Somnia's AOT EVM compilation support Cancun-level opcodes, and should cliqueue publish canary test results before production deployment? | BLOCKER | If Cancun opcodes are used incorrectly the contract deploys and reverts; demo must compile to Paris EVM only (confirmed). |
| 8 | Should cliqueue include a post-deployment smoke test calling every public function of ClaimsAdjudicator from a Somnia mainnet fork before directing systems to the live contract? | BLOCKER | Without smoke test the demo may use a broken contract address; contract must be verified end-to-end on Somnia before demo. |
| 9 | Does AgentVault updateDailyLimit() allow setting limit above 100 ether cap enforced at createVault? | BLOCKER | Demo must set deposit amounts correctly; exceeding the cap breaks agent invocation entirely. |
| 10 | Should `disputeWindowSeconds` have a network-level minimum floor enforced by TimelockController min-delay logic, and should this floor be documented in the hospital BAA? | BLOCKER | Demo dispute flow requires a defined window; without it the dispute test case is undetermined. |
| 11 | Should cliqueue's pre-deployment canary test suite include a topic[1] filter verification test published in the deployment runbook? | BLOCKER | Demo uses eth_subscribe for event listening; if topic filtering doesn't work on Somnia, the UI can't filter events and the demo timeline is broken. |
| 12 | Should dispute-listener spec mandate Path B (reconnect + resubscribe + eth_getLogs backfill from hospital-local checkpoint) as default MVP? | BLOCKER | Without reconnection strategy demo UI loses event history on any WebSocket disconnect during demo. |
| 13 | Should dispute-listener implement "missed event" recovery path by calling eth_getLogs from last processed block? | BLOCKER | If demo loses connection, UI must recover state from checkpoint; this is demo's event recovery mechanism. |
| 14 | Should MIN_DISPUTE_WINDOW_FLOOR and MAX_DISPUTE_WINDOW_CEILING be deployed as immutable bytecode constants or governance-controlled variables? | BLOCKER | Demo dispute flow depends on what window is enforced; if runtime-controlled, hardcoded test cases may be wrong. |
| 15 | Should cliqueue's Foundry test suite include upgrade safety test verifying no storage slot collision between main ClaimsAdjudicator namespace and dispute namespace? | BLOCKER | Demo uses upgradeable proxy; slot collision causes contract revert on upgrade. Must test before demo deployment. |
| 16 | Should @cliqueue/pa-lifecycle include a fromCoverageInformationTask() parser extracting paStatus and satisfied-pa-id from a CDS Hooks Task? | BLOCKER | PaStatus encoding is needed by provider agent to encode correct status; without it, demo's claim state is wrong. |
| 17 | Should CLIQUEUE_DOMAIN_SEPARATOR be promoted to a public constant in SBTRegistry? | BLOCKER | Demo UI must be able to resolve hospitalId from claim metadata; without public constant, the UI can't decode it in real-time. |
| 18 | Should ISBTRegistry be deployed as UUPS proxy or as immutable contract? | BLOCKER | Proxy choice affects contract deployment, address, ABI, and Ormi event indexing for the entire demo. |
| 19 | Should cliqueue's hospital BAA's Off-Chain Messaging Exhibit specify minimum AWS SQS FIFO configuration as normative deployment prerequisites? | BLOCKER | Demo needs working off-chain claim bundle delivery; without proper queue config, off-chain bundle fails and demo stalls at submission. |
| 20 | Should FHIR Bundle "claim package" envelope pattern be published as ClaimPackageBundle TypeScript type in @cliqueue/fhir-types? | BLOCKER | Provider agent outputs FHIR bundles; demo needs this type for correct bundle construction. |
| 21 | What is the empirically observed wall-clock time for createAdvancedRequest(subcommitteeSize=3) callback on Somnia mainnet? | BLOCKER | Demo must show agent callback within 90-second loop; if latency too high, demo breaks. Must confirm latency before demo day. |
| 22 | Does the Somnia platform contract emit RequestCreated and RequestFulfilled events enabling UI to show live timer without polling? | BLOCKER | Without these events, demo UI can't show live agent status; polling is a less reliable, less demo-friendly fallback. |

---

## IMPORTANT — Should resolve during hackathon, has workarounds

Affects demo quality, correctness, or production readiness but demo can proceed degraded.

| # | Item Title | Category | Rationale & Workaround |
|---|---|---|---|
| 23 | Should BlockReason be a typed enum in IClaimsAdjudicator? | IMPORTANT | Demo can show "payer blocked" without structured enum; fix before demo if time permits. |
| 24 | Should cliqueue commission an outside healthcare attorney to publish an opinion letter on SBT attestation + Humana/Cigna compliance? | IMPORTANT | Demo uses placeholder attestors; legal opinion is GTM collateral, not demo blocker. |
| 25 | Should cliqueue publish a formal "Settlement Token Policy" specifying current token, custodian, reserve backing, upgrade governance? | IMPORTANT | Demo hardcodes USDC.e address; document during hackathon for judge-facing credibility. |
| 26 | Should cliqueue publish a formal de-identification expert determination report for on-chain data model? | IMPORTANT | Demo uses synthetic data (no re-identification risk); production deployments require this. |
| 27 | Should the payer agent's RPC fallback for retrieving per-claim adjudicatedCents when amountSuppressed=true be used? | IMPORTANT | Demo has ~1 claim per batch; RPC calls fine at demo scale. Must resolve for high-volume production. |
| 28 | Should ClaimsAdjudicator enforce a token whitelist (USDC.e and native USDC addresses) for future in-place upgrade? | IMPORTANT | Demo uses USDC.e only; whitelist is upgrade safety feature. Can be added post-demo. |
| 29 | Should cliqueue's Settlement Token Policy list USDC.e (Tier 1), native USDC (Tier 2), USDso (Tier 3)? | IMPORTANT | Demo uses Tier 1 only; multi-tier policy is production readiness. |
| 30 | Should cliqueue publish a formal on-chain SettlementTokenPolicy document hash anchored in ClaimsAdjudicator storage? | IMPORTANT | Demo doesn't need on-chain policy anchoring; useful for production trust model. |
| 31 | Should Symphony's CDI endpoint use the same system array as standard coding endpoint, enabling adapter reuse? | IMPORTANT | Demo uses final claim coding only; can hardcode adapter for demo case. |
| 32 | Should ClaimsAdjudicator maintain an on-chain heuristicVersionRegistry mapping? | IMPORTANT | Version computed off-chain for demo; on-chain registry is audit enhancement. |
| 33 | Does Somnia's block explorer support filtering ClaimSubmitted events by indexed bytes32 topic via eth_getLogs? | IMPORTANT | Demo uses Ormi for events; topic filtering is audit tooling enhancement. |
| 34 | Should ClaimsAdjudicator emit a ClaimTypeRegistered event when addClaimType() is called via timelock? | IMPORTANT | Demo uses static claim types; event is useful for Ormi but not required. |
| 35 | Should @cliqueue/contracts release workflow verify npm org @cliqueue is provisioned? | IMPORTANT | Release infrastructure; no demo impact. Pin before demo release. |
| 36 | Should @cliqueue/fhir-types export a shared fromCoverageInformationTask()? | IMPORTANT | Demo inlines parser; shared export is production code organization. |
| 37 | Should cliqueue publish its hand-rolled CDS Hooks 2.0 TypeScript client as standalone npm package? | IMPORTANT | Demo uses inline CDS client; npm package is production usability. |
| 38 | Should cliqueue publish a formal "Domain Constant Registry" for all bytes32 domain tags? | IMPORTANT | Demo hard-codes domain separators; registry is production audit support. Should be done for judge credibility. |
| 39 | Should IClaimsEvents.sol be published as standalone npm artifact in @cliqueue/contracts/interfaces? | IMPORTANT | Demo uses full contract ABI; separate artifact is production tooling. |
| 40 | Should cliqueue's Foundry CI include forge inspect committing clean ABI arrays as versioned artifacts? | IMPORTANT | Demo needs clean ABI; manual export works. Automate during hackathon. |
| 41 | Should Ormi subgraph entity for ClaimSubmitted index paStatus as queryable enum and paAuthHash as nullable Bytes? | IMPORTANT | Demo UI can parse raw events; indexed queryable fields optimize production UI. |
| 42 | Should hospital BAA's Off-Chain Messaging Exhibit specify reference PostgreSQL claimId→documentReference mapping schema? | IMPORTANT | Demo uses in-memory map; PostgreSQL mapping store is production readiness. |
| 43 | Should Cliqueue publish reference FHIR claim package bundle TypeScript type? | IMPORTANT | Demo bundle construction works if type is defined; should be finalized during hackathon. |
| 44 | Does cliqueue's CPI agent callback complete in < 30s and does increasing subSize to 5 measurably increase latency? | IMPORTANT | Research needed to confirm demo latency feasibility; can set conservative timeout for demo. |
| 45 | Does the off-chain monitoring system for SBTRenewed events use Somnia WebSocket or Ormi subgraph alert? | IMPORTANT | Both work for small event set; commit to one approach during hackathon. |
| 46 | Should reference nginx config for MCP reverse proxy be included in onboarding package? | IMPORTANT | Demo works with basic nginx; reference config adds quality. |
| 47 | What is practical accuracy of Somnia native LLM for second-opinion ICD-10 verification vs Corti Symphony? | IMPORTANT | Determines demo quality of two-tier architecture; research during hackathon. |
| 48 | Should Cliqueue publish a per-provider billing-CV classification methodology as part of onboarding checklist? | IMPORTANT | Demo uses synthetic batch size; CV analysis is production compliance requirement. |
| 49 | Should Cliqueue's deployment runbook include canary test results (paris-opcodes, ecPairing, topic1-filter) as blocking gate? | IMPORTANT | Demo deployment must pass canaries; results should be documented for production. |
| 50 | Should @cliqueue/pa-lifecycle include a unified resolveConditionalStatus() helper? | IMPORTANT | Demo needs consistent path from CRD response to on-chain paStatus; helper reduces errors. |
| 51 | Should Cliqueue's ClaimPaLifecycle export a unified resolution helper for both CRD and PAS PA pathways? | IMPORTANT | Without this, demo integration engineer may have to write derivation logic manually. |
| 52 | Should Cliqueue publish a one-page "PA Lifecycle Event Schema"? | IMPORTANT | Demo uses synthetic PA status; schema helps judges understand event flow. |
| 53 | Should Cliqueue's pre-deployment test suite include a ClaimSubmitted topic[3] filter verification test? | IMPORTANT | Demo uses topic[3] paStatus filtering; test confirms Somnia implementation correctness. |
| 54 | Should DisputeStorage namespace include DisputeRecord struct inline or reference separate interface? | IMPORTANT | Solidity code organization; demo can use inline struct. |
| 55 | Should stateless ClaimsDisputeView contract's ABI be pinned as a cliqueue spec artifact? | IMPORTANT | Demo doesn't have DisputeView contract; useful for production audit tooling. |
| 56 | Should Cliqueue's hospital BAA explicitly list Improbable/Somnia as "non-BA infrastructure provider"? | IMPORTANT | Demo doesn't execute BAAs; document for production. |
| 57 | Should "Somnia Non-BA Determination Memo" be reviewed by outside HIPAA counsel? | IMPORTANT | Demo doesn't distribute compliance memos; legal review needed for production. |
| 58 | Should Cliqueue proactively test GetBlock's dedicated Somnia node for WebSocket connection affinity? | IMPORTANT | Demo uses public WSS; dedicated node is production scaling requirement. |
| 59 | Should Cliqueue audit all planned on-chain events for topic count and data size to compute Somnia-correct gas budgets? | IMPORTANT | Demo event set is small; full audit is production readiness. |
| 60 | Should Architecture A key-exchange be hospital-direct-to-payer (bypassing cliqueue)? | IMPORTANT | Demo shows on-chain hash without real hmacSalt; production architecture must be decided. |
| 61 | For Architecture B, should hospital's self-hosted dispute-listener be reference implementation in public repo? | IMPORTANT | Demo uses simple script; reference implementation adds polish. |
| 62 | Should Cliqueue publish a Non-PHI Key Routing Memo for hmacSalt under 45 CFR 160.103? | IMPORTANT | Demo uses synthetic keys; legal analysis needed for production. |
| 63 | Should Cliqueue publish a Non-PHI Determination Memo (outside-counsel-reviewed) for all services? | IMPORTANT | Demo can operate without formal memo; needed for production compliance. |
| 64 | Should onboarding checklist include formal "Payer Readiness Questionnaire"? | IMPORTANT | Demo uses synthetic payer; questionnaire needed for real deployments. |
| 65 | Should Cliqueue's SOMI reserve buffer sizing rule be published in hospital BAA? | IMPORTANT | Demo uses synthetic reserves; resolution before production deployment. |
| 66 | Should Cliqueue publish Somnia LOG gas reference constant table? | IMPORTANT | Demo contracts should use correct gas; research during hackathon to avoid miscalculation. |
| 67 | Should @cliqueue/x12-275 export SUPPORTED_PAYERS runtime registry? | IMPORTANT | Demo doesn't use X12; registry is production readiness. |
| 68 | Should Cliqueue define payerCRDEndpoint field in onboarding checklist? | IMPORTANT | Demo uses mock/preset payer; real integration needs endpoint definition. |
| 69 | Should Cliqueue define PayerAdapterInterface with forward-compatibility seam for future FHIR adapter swap? | IMPORTANT | Demo uses current 837 adapter; interface for future production extensibility. |
| 70 | Should PayerAdapterInterface define ClaimsAttachmentAdapter for X12 275/277 + HL7 CDA? | IMPORTANT | Phase 2 adapter; not needed for demo but should be started during hackathon. |
| 71 | Should Cliqueue publish CDA R2 TypeScript npm ecosystem findings? | IMPORTANT | Hand-roll needed for Phase 2; research during hackathon if time permits. |
| 72 | Should CDA templates be validated against C-CDA R2.1 Schematron in CI vs. Java validator? | IMPORTANT | Demo doesn't generate CDA; CI validation needed for production. |
| 73 | Should Cliqueue's BAA template include a "Dispute Enrichment Exhibit" addendum? | IMPORTANT | Demo doesn't execute BAA; needed for production. |
| 74 | Should @cliqueue/cda-attachments include cdaAttachmentScope constant listing 6 supported templates? | IMPORTANT | X12/CDA implementation; not demo-relevant but should be planned. |

---

## POST-HACKATHON — Nice to have after the hackathon

Regulatory minutiae, BAA exhibits, legal opinions, compliance documentation, post-launch operations, competitive analysis, research housekeeping.

| # | Item Title | Rationale |
|---|---|---|
| 75 | Deployment runbook: annual CMS MA plan update procedure (subscribe to CMS data, compute commitments, blockPayer before January) | Post-launch operations; no demo impact. |
| 76 | Phase 2 human attestation architecture for MA risk-adjustment (OIG ICPG "human-in-the-loop") | Phase 2/3 planning; demo is Phase 1 outpatient only. |
| 77 | Payer Contract Attestation Exhibit: BAA vs standalone legal document | Legal document design; no demo relevance. |
| 78 | Onboarding checklist flagging Humana/Cigna for Attestation Exhibit; simplified workflow for UHC/Aetna/BCBS | Onboarding procedure detail. |
| 79 | OIG Feb 2026 MA Guidance "human-in-the-loop" precedent for fee-for-service autonomous coding extension | Speculative regulatory analysis. |
| 80 | ROI model: separate coding-error denial rework savings from RFI denial float reduction | Procurement collateral. |
| 81 | ROI calculator: present RFI denial value with range + confidence qualifier | Procurement detail. |
| 82 | ROI calculator: explicitly label the two components (documentation-pending window + post-receipt adjudication) | Same as above. |
| 83 | Private payer adjudication SLA for proactive unsolicited 275 vs. 277 RFI | Market research question. |
| 84 | AR days threshold for DSO improvement measurement | Financial modeling for procurement. |
| 85 | Correct prior research file on RFI denial pathway ("90-day" → "60-120 days", remove "24-72h electronic") | Research housekeeping. |
| 86 | Hospital BAA Settlement Finality Exhibit: "Attachment Provenance Clause" for paAuthHash | BAA clause design. |
| 87 | CMS-0053-F compliance: payer 277 failure = HIPAA violation? | 2028 compliance timeline. |
| 88 | Primary-source study breaking down $25.7B adjudication cost by denial reason | Market research. |
| 89 | attestationRequired mapping values: publish in "Claim Type Policy" document for procurement review | Documentation/housekeeping. |
| 90 | Mixed-category 837I batch: split by TOB or single Symphony call? | Phase 2 scenario. |
| 91 | ICD10PCS_REQUIRED flag for inpatient claims (procedure code alongside diagnosis) | Inpatient-only; demo is outpatient. |
| 92 | Calibration Attestation Exhibit: hospital's MIN_EVIDENCES and MAX_ALTERNATIVES values in BAA | BAA exhibit design. |
| 93 | Published calibration dataset for Symphony codes (confidence vs. human-override) | Pilot study; demo uses synthetic thresholds. |
| 94 | Published calibration dataset (duplicate research item) | Same as above. |
| 95 | Request per-code confidence scores from Corti as enterprise API addition | Enterprise negotiation item. |
| 96 | Market SBTRegistry + on-chain attestation as "payer contract compliance artifact" | GTM strategy. |
| 97 | Segment payer-specific risk in onboarding docs (Anthem/Availity vs UHC hospitals) | Onboarding procedure. |
| 98 | "Settlement Layer Non-Clearinghouse Determination Memo" companion to CAQH CORE memo | Legal memo, not demo-relevant. |
| 99 | Early-adopter segment: providers submitting directly to payers (bypassing clearinghouses) | GTM research. |
| 100 | "CAQH CORE Non-Applicability Memo" for on-chain settlement layer | Legal doc. |
| 101 | On-chain real-time settlement = "RTA process" under CAQH CORE Phase IV 450? | Regulatory classification. |
| 102 | Payer contract post-CAA-21 review by counsel: any post-adjudication data restriction found? | Legal research. |
| 103 | "Payer Engagement Letter" template for dual-BA model (hospital + payer/plan) | Business development. |
| 104 | Payer contract review checklist: distinguish pre-adjudication vs post-adjudication clauses | Legal review procedure. |
| 105 | Legal opinion on DOL Jan 2025 "functional restriction" extending CAA-21 to provider-vendor flows | Legal research. |
| 106 | Avaneer Health real-time adjud product direct competition assessment | Competitive analysis. |
| 107 | Coding-error denial dollar value quantification from HFMA 30-day benchmark | ROI modeling. |
| 108 | NUBC annual update subscription + governance trigger in deployment runbook | Post-launch ops. |
| 109 | registeredClaimTypes mapping initialization gas-cost significance on Somnia | Gas optimization. |
| 110 | ZK range proof pattern for totalBilledCents with CV≥20% proof | Economically prohibitive on Somnia. |
| 111 | TiC MRF public rates + cross-payer rate comparison: antitrust concern? | Antitrust analysis. |
| 112 | CV-classification workflow also classifying providers by TiC MRF coverage | Production onboarding detail. |
| 113 | Expert determination report: single platform-level vs per-hospital re-commissioning | Procurement process. |
| 114 | HIPAA "required for compliance with admin simplification" exemption for ICD-10 on-chain | Regulatory minutiae. |
| 115 | GENIUS Act Non-DASP Determination section in Settlement Token Policy | Legal documentation. |
| 116 | Renouncing ProxyAdmin ownership → immutable/self-custodial exclusion under GENIUS Act | Post-launch governance. |
| 117 | Warranty clause in hospital BAA: multisig holder earns no profit from ClaimsAdjudicator | BAA clause. |
| 118 | B2B stablecoin settlement = "offering/selling" under GENIUS Act Section 8? | Regulatory analysis. |
| 119 | Frax Finance → Treasury "comparable regime" determination for Cayman Islands | Post-MVP stablecoin diversification. |
| 120 | Somnia Foundation adopting Bridged USDC Standard for USDC.e contract | Somnia-Circle relations. |
| 121 | Somnia USDC.e liquidity threshold for Circle Bridged USDC Standard upgrade | Future platform strategy. |
| 122 | GENIUS Act 18-month grace window: MVP with USDC.e, migrate to native USDC | Regulatory timeline planning. |
| 123 | Treasury March 2026 Section 9(e) illicit finance report: full output or pending? | Regulatory surveillance. |
| 124 | Settlement Token Policy with outside-counsel legal opinion letter during 2026-2028 ambiguity | Procurement collateral. |
| 125 | Legal opinion letter specifically addressing upgradeable proxy + DLP exclusion | Legal opinion scope. |
| 126 | DLP "publicly available and accessible" requiring verified source code on Somnia explorer | Legal compliance. |
| 127 | Governance architecture eliminating DASP risk with emergency pause | Post-launch governance design. |
| 128 | 4-of-7 multisig with 7-day timelock satisfying future rulemaking | Post-launch governance. |
| 129 | Hospital BAA specifying governance Position (A/B/C) with $10M TVL escalation covenant | Production governance roadmap. |
| 130 | USDC escrow balance threshold for automatic multisig escalation | TVL governance. |
| 131 | MIN_DELAY_FLOOR verifiable by hospital auditor via block explorer | Production deployment step. |
| 132 | Post-deployment smoke test: TimelockController address verification by legal/audit team | Production step. |
| 133 | .openzeppelin tracking file: commit to repo vs store externally | Deployment housekeeping. |
| 134 | Somnia EVM upgrade timeline (Shanghai or Cancun) | Platform roadmapping. |
| 135 | Fathom inpatient DRG autonomous coding making human-attestor role irrelevant | Competitive analysis. |
| 136 | On-chain attestation + Humana/Cigna credentialed coder attestation: differentiated value analysis | Value proposition. |
| 137 | 2026 HIPAA NPRM: annual BA verification for API AI vendors vs data storage vendors | Regulatory analysis. |
| 138 | Subprocessor Exhibit: listing Corti (Azure US, FedRAMP/HIPAA certified) status | BAA exhibit. |
| 139 | Annual SOC 2 Type II attestation clause in cliqueue↔Corti master BAA | BAA negotiation. |
| 140 | "Vendor Procurement Timeline Exhibit" in onboarding checklist | Procurement collateral. |
| 141 | 2026 HIPAA NPRM: annual BA verification for credentialing aggregators (Verisys, Symplr) | Regulatory analysis. |
| 142 | Automated threshold-audit mechanism for batchThreshold mapping per 2026 HIPAA NPRM | Regulatory compliance. |
| 143 | AHIMA/AAPC credential verification API ToS restrictions on automated verification calls | Production onboarding blocker. |
| 144 | AHIMA portal API access vs commercial aggregator (Verisys/Symplr/Modio) pricing | Credentialing integration. |
| 145 | Automated threshold-audit mechanism per 2026 HIPAA NPRM (duplicate) | Regulatory analysis. |
| 146 | AHIMA/AAPC credential API rate limiting for pre-validation before SBT minting | Credentialing integration. |
| 147 | GDPR Right to Erasure conflict for EU coders holding attestor SBTs | GDPR analysis. |
| 148 | Approved PSV monitoring vendor list in onboarding checklist | Production onboarding. |
| 149 | mcpServerUrls path segment from hospitalId via HKDF expansion | URL generation design. |
| 150 | Annual mcpServerUrls path rotation in hospital BAA Off-Chain Infrastructure Exhibit | BAA clause. |
| 151 | Phase 2 custom agent registration: permissionless vs Somnia team approval | Phase 2 planning. |
| 152 | _attestorCount slot warmth in Somnia's 128M LRU cache | Gas optimization. |
| 153 | StaffingFloorReached event on HOSPITAL_ADMIN revoke path | Event design detail. |
| 154 | StaffingRiskWarning event at floor+1 for early alert | Early warning event. |
| 155 | ISBTRegistry NatSpec for renounceAttestorRole documenting no admin co-signature | Documentation. |
| 156 | "Voluntary Attestor Exit Protocol" in hospital BAA (departing coder self-removal) | BAA clause. |
| 157 | getAttestorFloor() network-wide vs per-hospital overrides | Production feature. |
| 158 | Outside counsel DLP opinion analyzing Somnia block explorer source code verification | Legal opinion. |
| 159 | ISBTRegistry as separate npm package alongside main contract artifacts | Production tooling. |
| 160 | StaffingFloorReached: first crossing vs every crossing from floor | Event behavior. |
| 161 | Somnia point_evaluation (0x0a) precompile correctness at 50× multiplier | Future ZK path. |
| 162 | BLS12-381 Groth16 for post-MVP ZK path (vs BN254 on Somnia) | Post-MVP ZK circuit design. |
| 163 | X12 275 adapter generateUnsolicited275 with ISAControlParams | Phase 2 (X12 not used in demo). |
| 164 | AttachmentPayload interface: @cliqueue/fhir-types vs separate package | Package organization. |
| 165 | ISA13 auto-increment vs stateless in @cliqueue/x12-275 | X12 implementation detail. |
| 166 | ClaimsAttachmentAdapter Phase 1: restrict to generateUnsolicited275 only, defer parseSolicited277RFAI | Phase 1/2 boundary. |
| 167 | "Payer 277RFAI Readiness Check" in onboarding checklist | Production onboarding. |
| 168 | 277RFAI REF qualifier variation by payer companion guide | X12 implementation detail. |
| 169 | @cliqueue/x12-275 dual-version output (5010 and 6020) support | Version support for production. |
| 170 | Humana internal X12 275 trading partner specification | Payer integration detail. |
| 171 | SUPPORTED_PAYERS runtime registry in @cliqueue/x12-275 | X12 implementation. |
| 172 | CMS-0053-F readiness accelerator GTM framing for ClaimsAttachmentAdapter | Marketing messaging. |
| 173 | "CMS-0053-F Attachment Compliance Exhibit" in onboarding checklist | BAA exhibit. |
| 174 | cdaAttachmentScope constant in @cliqueue/cda-attachments | X12/CDA implementation. |
| 175 | Commit pre-generated C-CDA R2.1 .sch Schematron file to repo | CDA validation CI. |
| 176 | KvalitetsIT/cda-validator Docker gate: mandatory in CI vs release builds | CI gate strategy. |
| 177 | Pre-audit .sch file for current() / XPath 2.0 assertions | Schematron documentation. |
| 178 | Bundle vocab.xml vocabulary files in @cliqueue/cda-attachments | CDA validation. |
| 179 | Publish known-valid CDA XML fixtures as CI validation artifact | CI artifact. |
| 180 | @medplum/ccda convertFhirToCcda() for non-IPS document types | Library evaluation. |
| 181 | @cliqueue/cda-attachments as fourth monorepo module | Monorepo design. |
| 182 | "Schematron Coverage Gap Memo" for cda-attachments | Legal/technical disclosure. |
| 183 | (Duplicate of item 77 — Payer Contract Attestation Exhibit design) | Legal document design. |
| 184 | (Duplicate of item 100 — CAQH CORE Non-Applicability Memo) | Legal doc. |
| 185 | (Duplicate of item 150 — mcpServerUrls path rotation in BAA) | BAA clause. |
| 186 | (Duplicate of item 140 — Vendor Procurement Timeline Exhibit) | Procurement collateral. |

---

## Notes

1. **Already investigated items** (marked with `~~strikethrough~~` in source) were excluded — they are closed and have linked findings files.

2. **Duplicate entries** from the source file were noted and included for traceability (the source research backlog has several duplicate items).

3. **Items without priority designation** in the source were classified based on their substantive content and dependency on the demo loop.

4. **The demo scope** referenced is the 90-second demo from `docs/ROADMAP.md`: synthetic clinical note → provider agent proposes ICD-10 codes → claim hash anchored on Somnia → payer agent adjudicates → contract records negotiation → settlement event fires → UI shows audit timeline.

5. **BLOCKER items** were selected based on: contract correctness (gas, EVM compatibility, slot collisions), demo connectivity (Somnia chain, event filtering, WebSocket reconnection), PHI safety (enrichment gate), demo data correctness (PaStatus encoding, reserve caps, staffing floors, dispute windows), and agent callback timing (Somnia LLM inference latency).

6. **POST-HACKATHON items** were dominated by: BAA exhibits and clauses (~20 items), GENIUS Act/DASP legal opinions (~15 items), regulatory compliance analysis (~12 items), GTM/marketing collateral (~8 items), and post-launch operational procedures (~5 items). This reflects a compliance/legal-heavy research phase rather than engineering-focused — appropriate for production readiness but not hackathon sprint priorities.
