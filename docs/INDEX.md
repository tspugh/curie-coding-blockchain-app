---
title: docs/ — Master Index
type: index
status: navigation
---

# `docs/` — Master Index

A navigable map of everything under `docs/`. **This file is navigation only.** Every claim about the system lives in the linked source file; please follow the link before citing.

If you're new here: start at the top of [Project framing](#project-framing), then jump to [Research → Topic hubs](#topic-hubs-cross-cutting-views) for cross-cutting reads.

For working-philosophy and layout conventions, see [`../CLAUDE.md`](../CLAUDE.md). For tech-stack and architectural constraints, see [`../AGENTS.md`](../AGENTS.md). When the two disagree, `AGENTS.md` wins.

> **Out of scope for this index:** anything under `docs/raw/archived/`, `docs/raw/todos/archived/`, or `linear-cards/` — those represent the pre-pivot project and are not navigated from here.

---

## Project framing

The current canonical project direction. Read these first.

- [[ROADMAP|ROADMAP — Curie Claims Protocol hackathon strategy]] — the active hackathon plan and judging narrative (rewritten 2026-05-15).
- [[PRODUCT|PRODUCT — Curie Claims Protocol PRD]] — superseded stub; pre-pivot historical PRD.
- [[VISION|VISION — CliQueue product vision]] — human-gated pre-pivot file; do not extend without explicit approval.
- [[PROTOTYPE_SPEC|PROTOTYPE_SPEC — CliQueue prototype spec]] — human-gated pre-pivot file; do not extend without explicit approval.
- [[planning-loop-prompt|planning-loop-prompt — superseded]] — breadcrumb stub.

## Amendments (governance log)

ADR-style records of project decisions. The lifecycle and format are described in the amendments README.

- [[amendments/README|amendments/README — lifecycle + format]]
- [[amendments/0001-original-phase-1-tasks|A-0001 Original Phase 1 Tasks (historical)]]
- [[amendments/0002-architecture-brainstorm-2026-04-05|A-0002 Original Architecture Brainstorm (historical)]]

## Domain reference

- [[domain/payer-architecture|Healthcare Payer Architecture — domain reference]] — US payer subsystem ownership reference (added 2026-05-15).

## Infrastructure

- [[infra/dev-instance|Shared AWS Dev Instance — `cliqueue-dev`]] — operating notes for the shared dev EC2 box.

## Loop prompts

Operating prompts for the project's iteration loops (cron-driven and interactive).

- [[loop-prompts/iteration-prompt|Iteration prompt — headless research + bonsai loop]] (active; added 2026-05-15)
- [[loop-prompts/bonsai-cleanup|Bonsai Cleanup loop prompt]] (active)
- [[loop-prompts/local-mvp|Local MVP loop — superseded]]
- [[loop-prompts/ui-qa|UI QA loop — superseded]]

## Prior analysis

Historical interview material; treat as background, not requirements.

- [[prior-analysis/medical-doctor-interview|Medical doctor interview]] — carries a 2026-05-14 context header.
- [[prior-analysis/behavioral-health-interview-script|Behavioral health discovery interview script]]

---

## Research

### Topic hubs (cross-cutting views)

Each hub maps every research file that touches a recurring theme. See [[research/topics/README|research/topics/README]] for the conventions used.

- [[research/topics/corti|Corti / Symphony hub]] — off-chain coder, MCP integration, HIPAA / BAA.
- [[research/topics/x12|X12 EDI transaction sets hub]] — 837 / 835 / 275 / 277, adapter boundary.
- [[research/topics/cda|HL7 CDA hub]] — clinical document architecture, validation, X12 275 pairing.
- [[research/topics/sbt|SBT / SBTRegistry hub]] — credential primitive: registry, scoping, lifecycle, staffing floor.
- [[research/topics/prior-auth|Prior auth (PA) hub]] — on-chain encoding: `paStatus`, `paAuthHash`, `satisfiedPaId`, `paHash`.
- [[research/topics/settlement-stablecoin|Settlement stablecoin hub]] — USDC/USDso/Frax/SOMI, governance, GENIUS Act / DASP.
- [[research/topics/hipaa|HIPAA / PHI boundary hub]] — *selective*: only files where HIPAA is primary subject. Sub-questions: boundary, BAA chain, re-id, minimum-necessary.
- [[research/topics/dispute-window|Dispute window hub]] — events, storage, listener, window governance, BFT-vs-app-layer finality.
- [[research/topics/upgradeable-proxy|Upgradeable proxy + Timelock hub]] — proxy pattern, timelock design, governance multisig, DASP interaction, SBT-registry-specific upgrade questions.
- [[research/topics/somnia-substrate|Somnia substrate hub]] — chain capabilities cliqueue depends on: finality/TPS/gas, EVM hardfork, precompiles, event subscription, ZK verification, agent runtime model.

> *Candidate hubs not yet written:* events & subscription mechanics (partly indexed by [[research/topics/dispute-window]] + [[research/topics/prior-auth]] + [[research/topics/somnia-substrate]]), off-chain trust models (partly indexed by [[research/topics/somnia-substrate]]), Change Healthcare narrative. See [[research/topics/README|topics/README]] for the working list.

### Meta-research

- [[research/log|CliQueue Research Log]] — chronological log of every research iteration.
- [[research/research-questions|Open Research Questions]] — active backlog driving the [`research`](../.claude/skills/research/SKILL.md) skill.
- [[research/medical-coding-domain|Medical Coding Domain Background]] — seeded background; treat as historical reference per [`AGENTS.md`](../AGENTS.md).
- [[research/knowledge-graph-versioning|Knowledge Graph Versioning — Research Notes]] — seeded from `icd-10-parser`; historical.

### Research — Agreement Layer

Settlement, contracts, EDI adapters, on-chain claim struct, proxy/timelock deployment.

- [[research/agreement-layer/835-reconciliation-without-on-chain-billed-amount|835 reconciliation w/ suppressed on-chain billed amount]] *(see [[research/topics/x12|X12 hub]])*
- [[research/agreement-layer/adjudicated-cents-on-chain-emission-risk|adjudicatedCents on-chain emission risk]] *(see [[research/topics/x12|X12 hub]])*
- [[research/agreement-layer/agentvault-daily-limit-and-stablecoin-settlement|AgentVault daily-limit + stablecoin settlement]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/agreement-layer/architecture-a-payer-integration-barrier-claimid-lookup|Architecture A: payer integration barrier (claimId lookup)]] *(see [[research/topics/x12|X12 hub]])*
- [[research/agreement-layer/cda-schematron-vsac-ci-validation|CDA Schematron + VSAC + CI validation]] *(see [[research/topics/cda|CDA hub]])*
- [[research/agreement-layer/cda-vs-x12-275-package-boundary|CDA vs X12 275 package boundary]] *(see [[research/topics/cda|CDA hub]] · [[research/topics/x12|X12 hub]])*
- [[research/agreement-layer/claim-replacement-resubmission-onchain|Claim replacement / resubmission on-chain]] *(see [[research/topics/x12|X12 hub]] · [[research/topics/dispute-window|dispute hub]])*
- [[research/agreement-layer/conditional-fund-release-state-machine|Conditional fund release — 5-state machine]] *(see [[research/topics/dispute-window|dispute hub]])*
- [[research/agreement-layer/edi-837-835-flow-and-blockchain-adjudication|EDI 837/835 flow + decentralized adjudication precedents]] *(see [[research/topics/x12|X12 hub]])*
- [[research/agreement-layer/edi-adapter-offchain-store-phi-reconstruction-risk|EDI adapter off-chain store — PHI reconstruction risk]] *(see [[research/topics/x12|X12 hub]] · [[research/topics/hipaa|HIPAA hub]])*
- [[research/agreement-layer/edi-adapter-payericn-mapping-resilience|EDI adapter payerICN → claimId mapping resilience]] *(see [[research/topics/x12|X12 hub]])*
- [[research/agreement-layer/enrichment-step-ba-status-feature-gate|Enrichment step BA status + hard feature gate]] *(see [[research/topics/x12|X12 hub]] · [[research/topics/hipaa|HIPAA hub]])*
- [[research/agreement-layer/fhir-payer-api-readiness-edi-replacement-timeline|FHIR payer API readiness + EDI 837 replacement timeline]] *(see [[research/topics/x12|X12 hub]] · [[research/topics/cda|CDA hub]])*
- [[research/agreement-layer/frax-ppsi-application-status-genius-act-timeline|Frax PPSI application status + GENIUS Act timeline]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/agreement-layer/hl7-cda-r2-typescript-npm-ecosystem-x12-275|HL7 CDA R2 TypeScript/npm ecosystem + X12 275]] *(see [[research/topics/cda|CDA hub]] · [[research/topics/x12|X12 hub]])*
- [[research/agreement-layer/hmacsalt-key-exchange-ba-relationship-analysis|hmacSalt key exchange + BA relationship]] *(see [[research/topics/x12|X12 hub]] · [[research/topics/hipaa|HIPAA hub]])*
- [[research/agreement-layer/on-chain-claim-struct-835-interoperability|On-chain claim struct + 835 interoperability]] *(see [[research/topics/x12|X12 hub]])*
- [[research/agreement-layer/oracle-attestation-schemes|Oracle attestation schemes for off-chain coder output]]
- [[research/agreement-layer/payerclaimrefset-event-835-adapter-caching|PayerClaimRefSet event + 835 adapter caching]] *(see [[research/topics/x12|X12 hub]])*
- [[research/agreement-layer/payerclaimref-slot-initialization-strategy|payerClaimRef slot initialization strategy]] *(see [[research/topics/x12|X12 hub]])*
- [[research/agreement-layer/rfi-denial-pathway-paauthash-on-chain-scope|RFI denial pathway: on-chain `paAuthHash` scope]] *(see [[research/topics/x12|X12 hub]] · [[research/topics/prior-auth|PA hub]])*
- [[research/agreement-layer/stablecoin-address-governance-timelock|Stablecoin address governance — timelock + multisig]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/agreement-layer/timelock-min-delay-immutable-vs-mutable|TimelockController min delay: immutable vs mutable]] *(see [[research/topics/upgradeable-proxy|upgradeable-proxy hub]] · [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/agreement-layer/timelock-uups-proxy-upgrade-path|TimelockController vs Compound Timelock — UUPS upgrade path]] *(see [[research/topics/upgradeable-proxy|upgradeable-proxy hub]])*
- [[research/agreement-layer/transparent-proxy-proxyadmin-timelock-deployment|TransparentUpgradeableProxy v5 + ProxyAdmin + Timelock deployment]] *(see [[research/topics/upgradeable-proxy|upgradeable-proxy hub]])*
- [[research/agreement-layer/usdc-cctp-somnia-native-vs-bridged|USDC on Somnia: native CCTP vs bridged USDC.e]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/agreement-layer/usdc-vs-usdso-settlement-stablecoin|USDC vs USDso settlement stablecoin]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/agreement-layer/x12-275-typescript-npm-ecosystem-bds-envelope|X12 275 TypeScript/npm ecosystem + BDS envelope]] *(see [[research/topics/x12|X12 hub]] · [[research/topics/cda|CDA hub]])*
- [[research/agreement-layer/x12-277rfai-solicited-attachment-request-parser-spec|X12 277RFAI solicited attachment request parser spec]] *(see [[research/topics/x12|X12 hub]])*

### Research — AI Models

Off-chain coding models, confidence heuristics, MCP integration shape.

- [[research/ai-models/coding-confidence-heuristic-spec|CodingConfidenceHeuristic spec — routing architecture]] *(see [[research/topics/corti|Corti hub]])*
- [[research/ai-models/corti-symphony-confidence-score-and-routing|Corti Symphony confidence score + routing]] *(see [[research/topics/corti|Corti hub]])*
- [[research/ai-models/corti-symphony-inpatient-drg-gap|Corti Symphony inpatient / DRG gap]] *(see [[research/topics/corti|Corti hub]])*
- [[research/ai-models/corti-symphony-mcp-integration|Corti Symphony MCP integration]] *(see [[research/topics/corti|Corti hub]])*
- [[research/ai-models/corti-symphony-tob-claim-type-adapter|Corti Symphony TOB / claim-type adapter]] *(see [[research/topics/corti|Corti hub]])*
- [[research/ai-models/llm-icd10-accuracy-and-somnia-model-availability|LLM ICD-10 accuracy + Somnia model availability]] *(see [[research/topics/corti|Corti hub]])*

### Research — Market

Market sizing, payer contract constraints, monorepo architecture, claim-type taxonomy.

- [[research/market/attestation-required-mapping-initialization-tob-taxonomy|`attestationRequired` mapping init + UB-04 TOB taxonomy]]
- [[research/market/caqh-core-scope-and-payer-exclusivity-onboarding|CAQH CORE scope + payer exclusivity onboarding]] *(see [[research/topics/x12|X12 hub]])*
- [[research/market/change-healthcare-clearinghouse-concentration-and-decentralization-appetite|Change Healthcare clearinghouse concentration + decentralization appetite]] *(see [[research/topics/x12|X12 hub]])*
- [[research/market/claimtype-attestation-governance-immutable-vs-timelock|ClaimType attestation governance — immutable vs timelock]]
- [[research/market/claimtype-enum-on-chain-enforcement-inpatient-outpatient|ClaimType on-chain enforcement — inpatient vs outpatient]] *(see [[research/topics/sbt|SBT hub]] · [[research/topics/corti|Corti hub]])*
- [[research/market/cliqueue-monorepo-package-architecture|@cliqueue/* monorepo package architecture]] *(see [[research/topics/cda|CDA hub]] · [[research/topics/sbt|SBT hub]])*
- [[research/market/coding-error-denial-share-and-ai-impact|Coding-error denial share + AI vendor impact]] *(see [[research/topics/corti|Corti hub]])*
- [[research/market/coding-market-size-and-denial-losses|ICD-10 coding market size + denial losses]]
- [[research/market/electronic-275-adjudication-to-payment-cycle-time|Electronic 275: adjudication-to-payment cycle time]] *(see [[research/topics/x12|X12 hub]])*
- [[research/market/inpatient-coding-performance-and-market-consolidation|Inpatient coding AI performance + RCM consolidation]] *(see [[research/topics/x12|X12 hub]])*
- [[research/market/inpatient-drg-human-attestor-architecture|Inpatient DRG human-attestor architecture]] *(see [[research/topics/sbt|SBT hub]] · [[research/topics/corti|Corti hub]])*
- [[research/market/payer-contract-attestation-exhibit-on-chain-sbt|Payer contract attestation exhibit — on-chain SBT]] *(see [[research/topics/sbt|SBT hub]])*
- [[research/market/payer-contract-data-sharing-restrictions|Payer contract data sharing restrictions]] *(see [[research/topics/x12|X12 hub]] · [[research/topics/prior-auth|PA hub]])*
- [[research/market/payer-contract-exclusivity-permission-requirement|Payer contract exclusivity / permission requirement]] *(see [[research/topics/x12|X12 hub]])*
- [[research/market/rfi-denial-cycle-time-benchmark-electronic-vs-paper|RFI denial cycle time benchmark — electronic vs paper]] *(see [[research/topics/x12|X12 hub]] · [[research/topics/prior-auth|PA hub]])*
- [[research/market/validclaimtype-modifier-digit9-governance-gap|`validClaimType` modifier digit-9 governance gap]]
- [[research/market/x12-275-payer-adoption-mvp-scope|X12 275 payer adoption + MVP scope]] *(see [[research/topics/x12|X12 hub]] · [[research/topics/cda|CDA hub]])*

### Research — Regulatory

HIPAA, BAAs, GENIUS Act, DASP, certification, gag-clause, MA exclusion.

- [[research/regulatory/ahima-aapc-ai-coding-certification-oversight-requirements|AHIMA/AAPC AI coding certification oversight]] *(see [[research/topics/sbt|SBT hub]])*
- [[research/regulatory/batch-aggregation-homogeneous-provider-cv-l-diversity|Batch aggregation — homogeneous provider diversity]] *(see [[research/topics/hipaa|HIPAA hub]])*
- [[research/regulatory/blockedpayerids-on-chain-privacy-design|`blockedPayerIds` on-chain privacy design]] *(see [[research/topics/hipaa|HIPAA hub]] · [[research/topics/x12|X12 hub]])*
- [[research/regulatory/caa21-gag-clause-provider-vendor-data-sharing|CAA-21 gag clause — provider-vendor data sharing]] *(see [[research/topics/hipaa|HIPAA hub]] · [[research/topics/x12|X12 hub]])*
- [[research/regulatory/cds-hooks-typescript-client-crd-v2-1|CDS Hooks TypeScript client (CRD v2.1)]] *(see [[research/topics/prior-auth|PA hub]])*
- [[research/regulatory/cms-0057f-prior-auth-api-presubmission-integration|CMS-0057-F prior auth API — pre-submission integration]] *(see [[research/topics/prior-auth|PA hub]] · [[research/topics/x12|X12 hub]])*
- [[research/regulatory/corti-baa-procurement-timeline-sub-baa-chain|Corti BAA procurement timeline + sub-BAA chain]] *(see [[research/topics/corti|Corti hub]] · [[research/topics/hipaa|HIPAA hub]])*
- [[research/regulatory/corti-symphony-baa-and-phi-data-flow|Corti Symphony BAA + PHI data flow]] *(see [[research/topics/corti|Corti hub]] · [[research/topics/hipaa|HIPAA hub]])*
- [[research/regulatory/dlp-exclusion-upgradeable-proxy-dasp-analysis|GENIUS Act DLP exclusion — upgradeable proxy + DASP]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/regulatory/genius-act-dasp-smart-contract-scope|GENIUS Act DASP — `ClaimsAdjudicator` qualification]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/regulatory/hipaa-blockchain-hash-anchoring|HIPAA constraints on on-chain claim-hash anchoring]] *(see [[research/topics/hipaa|HIPAA hub]])*
- [[research/regulatory/hipaa-minimum-necessary-on-chain-events|HIPAA minimum-necessary on-chain events]] *(see [[research/topics/hipaa|HIPAA hub]])*
- [[research/regulatory/improbable-somnia-operator-baa-analysis|Improbable / Somnia operator BAA analysis]] *(see [[research/topics/corti|Corti hub]] · [[research/topics/hipaa|HIPAA hub]])*
- [[research/regulatory/medicare-advantage-ma-exclusion-gate-phase1-scope|Medicare Advantage exclusion gate — Phase 1]]
- [[research/regulatory/minbatchthreshold-governance-network-vs-hospital|minBatchThreshold governance — network vs hospital]] *(see [[research/topics/hipaa|HIPAA hub]])*
- [[research/regulatory/multisig-timelock-dasp-control-threshold|GENIUS Act DASP control threshold — 3-of-5 multisig + 48h timelock]] *(see [[research/topics/upgradeable-proxy|upgradeable-proxy hub]] · [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/regulatory/re-identification-risk-low-volume-provider-batching|Re-identification risk — low-volume provider batching]] *(see [[research/topics/hipaa|HIPAA hub]])*
- [[research/regulatory/treasury-section9-defi-dasp-scope-study-status|Treasury Section 9 DeFi DASP scope study]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/regulatory/uups-proxy-governance-multisig-dasp-operator-risk|GENIUS Act DASP operator risk — UUPS proxy + multisig]] *(see [[research/topics/upgradeable-proxy|upgradeable-proxy hub]] · [[research/topics/settlement-stablecoin|settlement hub]])*

### Research — Somnia

Chain-specific design: events, SBT registry, prior auth, gas economics, dispute, TEE, zkVerify.

- [[research/somnia/circle-cctp-somnia-bridged-usdc-standard-genius-act|Circle CCTP + Somnia USDC + GENIUS Act deadline]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/somnia/claim-disputed-event-websocket-subscription|ClaimDisputed event + WebSocket subscription]] *(see [[research/topics/dispute-window|dispute hub]])*
- [[research/somnia/claim-pa-status-resolved-event-design|ClaimPAStatusResolved event design]] *(see [[research/topics/prior-auth|PA hub]])*
- [[research/somnia/claim-pa-status-resolved-paauthash-emission|ClaimPAStatusResolved — paAuthHash emission]] *(see [[research/topics/prior-auth|PA hub]])*
- [[research/somnia/claims-dispute-registry-separate-vs-erc7201-internal|ClaimsDisputeRegistry — separate vs ERC-7201 internal storage]] *(see [[research/topics/dispute-window|dispute hub]] · [[research/topics/upgradeable-proxy|upgradeable-proxy hub]])*
- [[research/somnia/claim-struct-packing-cold-sload-dispute-architecture|Claim struct packing + cold-SLOAD dispute architecture]] *(see [[research/topics/dispute-window|dispute hub]] · [[research/topics/sbt|SBT hub]])*
- [[research/somnia/claim-submitted-event-combined-amendment-pastatus-paauthash|ClaimSubmitted event — combined paStatus + paAuthHash]] *(see [[research/topics/prior-auth|PA hub]])*
- [[research/somnia/data-streams-sdk-vs-eth-subscribe-topic-filtering|Data Streams SDK vs eth_subscribe — topic filtering]] *(see [[research/topics/dispute-window|dispute hub]])*
- [[research/somnia/dispute-listener-middleware-deployment-baa-obligations|Dispute-listener middleware deployment + BAA obligations]] *(see [[research/topics/dispute-window|dispute hub]] · [[research/topics/hipaa|HIPAA hub]])*
- [[research/somnia/dispute-listener-websocket-connection-affinity|Dispute-listener WebSocket connection affinity]] *(see [[research/topics/dispute-window|dispute hub]])*
- [[research/somnia/dispute-window-floor-governance-baa|disputeWindowSeconds floor — timelock + BAA]] *(see [[research/topics/dispute-window|dispute hub]] · [[research/topics/hipaa|HIPAA hub]])*
- [[research/somnia/ecpairing-precompile-canary-and-bls12-alternative|ecPairing precompile canary + BLS12-381 alternative]]
- [[research/somnia/eth-subscribe-topic1-filter-somnia-log-gas-costs|eth_subscribe topic[1] filtering + LOG opcode gas costs]] *(see [[research/topics/dispute-window|dispute hub]])*
- [[research/somnia/evm-hardfork-level-paris-and-canary-tests|Somnia EVM hardfork: Paris + canary tests]] *(see [[research/topics/upgradeable-proxy|upgradeable-proxy hub]])*
- [[research/somnia/finality-tps-and-gas-model|Somnia finality, TPS, and gas model]] *(see [[research/topics/dispute-window|dispute hub]] · [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/somnia/heuristic-version-on-chain-anchoring|Heuristic version on-chain anchoring — OIG audit trail]] *(see [[research/topics/dispute-window|dispute hub]])*
- [[research/somnia/human-attestor-credential-representation|Human-attestor credential representation]] *(see [[research/topics/sbt|SBT hub]])*
- [[research/somnia/iclaimsadjudicator-event-registry-interface-design|IClaimsAdjudicator interface-level event registry]] *(see [[research/topics/sbt|SBT hub]] · [[research/topics/dispute-window|dispute hub]] · [[research/topics/prior-auth|PA hub]])*
- [[research/somnia/infer-tools-chat-mcp-endpoint-network-requirements|inferToolsChat mcpServerUrls network requirements]] *(see [[research/topics/corti|Corti hub]])*
- [[research/somnia/isbregistry-typed-interface-design-dlp-exclusion|ISBTRegistry typed interface design + DLP exclusion]] *(see [[research/topics/sbt|SBT hub]] · [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/somnia/llm-inference-callback-latency-and-timeout|LLM inference callback latency + timeout]] *(see [[research/topics/corti|Corti hub]])*
- [[research/somnia/mcp-reverse-proxy-auth-without-url-key|MCP reverse-proxy auth without URL-embedded key]] *(see [[research/topics/corti|Corti hub]])*
- [[research/somnia/min-attesters-staffing-redundancy|Minimum attestor staffing redundancy]] *(see [[research/topics/sbt|SBT hub]])*
- [[research/somnia/native-agents-vs-agent-kit|Somnia native agents vs somnia-agent-kit]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/somnia/offchain-pubsub-phi-messaging-architecture|Off-chain pub-sub / PHI messaging architecture]] *(see [[research/topics/hipaa|HIPAA hub]] · [[research/topics/corti|Corti hub]] · [[research/topics/prior-auth|PA hub]])*
- [[research/somnia/oppc-challenge-window-bft-finality-architecture|OpPC challenge window — BFT finality vs app-layer dispute]] *(see [[research/topics/dispute-window|dispute hub]])*
- [[research/somnia/ormi-subgraph-abi-format-interface-vs-implementation|Ormi subgraph ABI format — interface vs implementation]] *(see [[research/topics/sbt|SBT hub]] · [[research/topics/upgradeable-proxy|upgradeable-proxy hub]])*
- [[research/somnia/ormi-subgraph-uups-upgrade-workflow|Ormi subgraph UUPS upgrade workflow]] *(see [[research/topics/upgradeable-proxy|upgradeable-proxy hub]])*
- [[research/somnia/pa-hash-domain-separator-distinct-vs-shared|paHash domain separator — distinct vs shared]] *(see [[research/topics/prior-auth|PA hub]])*
- [[research/somnia/pa-status-encoder-typescript-module-npm-ecosystem|paStatus encoder TypeScript module + npm ecosystem]] *(see [[research/topics/prior-auth|PA hub]])*
- [[research/somnia/pastatus-on-chain-encoding-claim-submitted-event|paStatus on-chain encoding + ClaimSubmitted event]] *(see [[research/topics/prior-auth|PA hub]])*
- [[research/somnia/per-claim-gas-economics-llm-inference-cost|Per-claim gas economics vs LLM inference cost]] *(see [[research/topics/corti|Corti hub]] · [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/somnia/phase2-custom-agents-and-llm-model-opacity|Phase 2 custom agents + LLM model opacity]] *(see [[research/topics/corti|Corti hub]])*
- [[research/somnia/renounce-attestor-role-admin-cosignature-vs-permissionless|renounceAttestorRole — admin cosignature vs permissionless]] *(see [[research/topics/sbt|SBT hub]])*
- [[research/somnia/resolve-conditional-pa-auth-hash-parameter|resolveConditional paAuthHash parameter]] *(see [[research/topics/prior-auth|PA hub]])*
- [[research/somnia/satisfied-pa-id-on-chain-hash-claim-submitted|satisfiedPaId on-chain hash + ClaimSubmitted]] *(see [[research/topics/prior-auth|PA hub]] · [[research/topics/sbt|SBT hub]])*
- [[research/somnia/sbt-credential-expiry-enforcement|SBT credential expiry enforcement]] *(see [[research/topics/sbt|SBT hub]])*
- [[research/somnia/sbt-expiry-grace-window-jcaho-fca|SBT expiry grace window — JCAHO PSV vs FCA]] *(see [[research/topics/sbt|SBT hub]])*
- [[research/somnia/sbt-hospitalid-npi-hash-hipaa-disclosure|SBT hospitalId / NPI hash — HIPAA disclosure]] *(see [[research/topics/sbt|SBT hub]])*
- [[research/somnia/sbtregistry-attestor-count-key-type-bytes32-vs-address|SBTRegistry attestor-count key — bytes32 vs address]] *(see [[research/topics/sbt|SBT hub]])*
- [[research/somnia/sbtregistry-attestor-count-mapping-vs-enumerable|SBTRegistry attestor-count — mapping vs Enumerable]] *(see [[research/topics/sbt|SBT hub]])*
- [[research/somnia/sbtregistry-grantRole-revert-override-uups-compatibility|SBTRegistry grantRole/revokeRole revert override + UUPS]] *(see [[research/topics/sbt|SBT hub]] · [[research/topics/upgradeable-proxy|upgradeable-proxy hub]])*
- [[research/somnia/sbt-registry-scoping-hospital-vs-network|SBT registry scoping — hospital vs network]] *(see [[research/topics/sbt|SBT hub]])*
- [[research/somnia/somi-inference-fee-governance-cliff-unlock-risk|SOMI inference fee governance — cliff unlock risk]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/somnia/somi-price-circuit-breaker-oracle-architecture|SOMI price circuit breaker + oracle architecture]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/somnia/somi-reserve-holding-architecture-compliance|SOMI reserve holding architecture + compliance]] *(see [[research/topics/settlement-stablecoin|settlement hub]])*
- [[research/somnia/staffing-floor-reached-event-design|StaffingFloorReached event design]] *(see [[research/topics/sbt|SBT hub]] · [[research/topics/hipaa|HIPAA hub]] · [[research/topics/dispute-window|dispute hub]])*
- [[research/somnia/tee-attestation-on-chain-verification|TEE attestation on-chain verification — Phala + Somnia]] *(see [[research/topics/corti|Corti hub]] · [[research/topics/settlement-stablecoin|settlement hub]] · [[research/topics/dispute-window|dispute hub]])*
- [[research/somnia/zkverify-somnia-chain-support-and-alternatives|zkVerify — Somnia support + alternatives]]

---

## Reference material (external, read-only mirrors)

These are AI-summarised captures of upstream documentation, copied on 2026-05-14. They are not authored by this project — they are the platform-concept guides for the SDK and the reference Curie spec.

### Curie reference (upstream spec snapshot)

- [[reference/curie/README|README]] — what this folder is.
- [[reference/curie/PROVENANCE|PROVENANCE]] — copy date + source.
- [[reference/curie/context/medical-blockchain|context/medical-blockchain]] — **CORE platform-concept guide** (per [`AGENTS.md`](../AGENTS.md)); read first when researching.
- [[reference/curie/context/somnia-agentathon|context/somnia-agentathon]] — Somnia Agentathon framing.
- [[reference/curie/context/agentathon-demo|context/agentathon-demo]] — Agentathon demo notes.
- [[reference/curie/spec/curie|spec/curie]] — upstream Curie spec.
- [[reference/curie/spec/api|spec/api]] — upstream API spec.
- [[reference/curie/spec/demo-ui|spec/demo-ui]] — upstream demo UI spec.
- [[reference/curie/amendments/README|amendments/README]] — upstream amendment lifecycle reference.

### Somnia Agent Kit reference (SDK)

- [[reference/somnia-agent-kit/README|README]] — what this folder is.
- [[reference/somnia-agent-kit/PROVENANCE|PROVENANCE]] — copy date + source.
- [[reference/somnia-agent-kit/contracts-overview|Smart Contracts Overview]] — the four-contract map.
- [[reference/somnia-agent-kit/agent-registry|AgentRegistry technical reference]]
- [[reference/somnia-agent-kit/agent-manager|AgentManager technical reference]]
- [[reference/somnia-agent-kit/agent-executor|AgentExecutor technical reference]]
- [[reference/somnia-agent-kit/agent-vault|AgentVault technical reference]]
- [[reference/somnia-agent-kit/sdk-usage|SDK usage]]

## Demo material

- [[demo/clinical-notes/README|Demo clinical notes — superseded]]

---

## Conventions

- Files are linked with **wiki syntax** (`[[slug|optional display name]]`). The `slug` is the filename without `.md` (Obsidian-style). Plain-markdown viewers render the literal text; that's fine — the file is still navigable from the relative path.
- Each link line follows: `- [[slug|Title]] — ≤ 12-word gloss of what the file argues.`
- **Topic hubs** (under `research/topics/`) give a *new* axis — group by question, not by folder. The folder tree is already the default index.
- **Out of scope:** anything under `docs/raw/archived/`, `docs/raw/todos/archived/`, or `linear-cards/`. Per [`CLAUDE.md`](../CLAUDE.md), those represent the pre-pivot project and are intentionally not navigated from here.

## How to extend this index

When you add a new file under `docs/`:

1. Find the matching section above (Project framing / Amendments / Domain / Infra / Loop prompts / Prior analysis / Research subfolder / Reference).
2. Add one link line: `- [[relative-slug|Title]] — ≤ 12-word gloss.`
3. If the file touches an existing **topic hub** ([[research/topics/corti]], [[research/topics/x12]], [[research/topics/cda]]), also add it to that hub.
4. If the file represents a new recurring theme, consider promoting it: add a hub under `research/topics/` and reference it from the [Topic hubs](#topic-hubs-cross-cutting-views) section.
