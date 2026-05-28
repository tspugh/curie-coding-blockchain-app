---
title: Upgradeable Proxy + Timelock Governance — Topic Hub
type: topic-hub
status: navigation
---

# Upgradeable Proxy + Timelock Governance

A navigation hub for everything in `docs/research/` about **contract upgradeability** — proxy patterns (UUPS, TransparentUpgradeable), `TimelockController` choice, ProxyAdmin deployment, ERC-7201 storage layout, and the governance multisig that controls the upgrade key.

> This file is **navigation, not content**. Every claim about upgrades / timelocks lives in the linked source file; please follow the link before citing.

See also: [[settlement-stablecoin]] · [[sbt]] · [[dispute-window]] · [[hipaa]] · [[README]] (topics index) · [[../../INDEX|docs index]]

---

## Frame: three coupled decisions

Across the research, "should we be upgradeable?" is rarely the only question. The cluster collapses into three coupled decisions:

1. **Which proxy pattern** — UUPS vs TransparentUpgradeable (+ ProxyAdmin); storage layout via ERC-7201 vs hand-rolled slots.
2. **Which timelock** — `TimelockController` (OZ v5) vs Compound Timelock; minimum delay immutable vs mutable; multisig threshold (commonly 3-of-5).
3. **DASP / GENIUS Act exposure** — being upgradeable + having a control multisig is the single largest input to whether contracts qualify as a regulated DASP. Upgrade authority shape is therefore not just an engineering choice; it's a legal-perimeter choice.

Almost every file in this cluster is really asking one of those three.

---

## Proxy pattern

UUPS vs Transparent + ProxyAdmin, plus ERC-7201 storage layout.

- [[../agreement-layer/transparent-proxy-proxyadmin-timelock-deployment|TransparentUpgradeableProxy v5 + ProxyAdmin + TimelockController — deployment pattern]] — the canonical OZ v5 deployment shape.
- [[../agreement-layer/timelock-uups-proxy-upgrade-path|TimelockController vs Compound Timelock — UUPS proxy upgrade path]] — UUPS-specific upgrade path tradeoffs.
- [[../somnia/claims-dispute-registry-separate-vs-erc7201-internal|ClaimsDisputeRegistry — separate contract vs ERC-7201 internal storage + UUPS upgrade]] — ERC-7201 storage-layout decision in an upgradeable contract.
- [[../somnia/ormi-subgraph-abi-format-interface-vs-implementation|Ormi subgraph ABI format — interface vs implementation]] — indexing implications of upgradeability (interface vs concrete ABI).
- [[../somnia/ormi-subgraph-uups-upgrade-workflow|Ormi subgraph UUPS upgrade workflow]] — operational workflow for re-deploying the indexer alongside a UUPS upgrade.

## Timelock design

`TimelockController` configuration choices.

- [[../agreement-layer/timelock-min-delay-immutable-vs-mutable|TimelockController minimum delay — immutable vs mutable]] — should the minimum delay itself be changeable through governance?
- [[../agreement-layer/timelock-uups-proxy-upgrade-path|TimelockController vs Compound Timelock — UUPS upgrade path]] *(also under [Proxy pattern](#proxy-pattern))*
- [[../agreement-layer/stablecoin-address-governance-timelock|Stablecoin address governance — timelock + multisig + notice period]] — applying timelock to a high-stakes address parameter.
- [[../somnia/dispute-window-floor-governance-baa|disputeWindowSeconds floor — TimelockController pattern + hospital BAA settlement finality]] — using timelock to enforce a dispute-window floor.
- [[../market/claimtype-attestation-governance-immutable-vs-timelock|ClaimType → `requiresHumanAttestation` — immutable vs TimelockController governance]] — a domain parameter (which claim types need a human attestor) protected by timelock.

## Governance multisig

The signer threshold that *controls* the timelock — the actual upgrade authority.

- [[../regulatory/multisig-timelock-dasp-control-threshold|GENIUS Act DASP control threshold — 3-of-5 multisig + 48-hour timelock]] — concrete threshold proposal.
- [[../regulatory/uups-proxy-governance-multisig-dasp-operator-risk|GENIUS Act DASP operator risk — UUPS proxy upgrade authority + governance multisig]] — when does the multisig itself become a regulated operator?
- [[../regulatory/minbatchthreshold-governance-network-vs-hospital|minBatchThreshold governance — network level vs hospital level]] — who holds the governance authority for batching parameters.

## DASP / GENIUS Act interaction (legal perimeter)

The single biggest reason upgrade shape matters: it determines whether the contract operator qualifies as a Digital Asset Service Provider under the GENIUS Act.

- [[../regulatory/dlp-exclusion-upgradeable-proxy-dasp-analysis|GENIUS Act DLP exclusion — upgradeable proxy + DASP analysis]] — earning the Decentralized Ledger Protocol exclusion despite upgradeability.
- [[../regulatory/genius-act-dasp-smart-contract-scope|GENIUS Act DASP — `ClaimsAdjudicator` qualification]] — does the adjudicator qualify as a DASP?
- [[../somnia/isbregistry-typed-interface-design-dlp-exclusion|ISBTRegistry typed interface + DLP exclusion]] — same question for the SBT registry.
- [[../regulatory/treasury-section9-defi-dasp-scope-study-status|Treasury Section 9 DeFi DASP scope study]] — what's still unsettled in the perimeter.

## Application-parameter governance (timelock used on app params)

Files where the timelock is protecting a non-financial parameter (an enum, a threshold, a feature gate).

- [[../market/attestation-required-mapping-initialization-tob-taxonomy|`attestationRequired` mapping initialization + UB-04 TOB taxonomy]] — initializing a mapping behind a timelock.
- [[../market/claimtype-enum-on-chain-enforcement-inpatient-outpatient|ClaimType on-chain enforcement — inpatient vs outpatient]] — enum gating governed by timelock.
- [[../market/validclaimtype-modifier-digit9-governance-gap|`validClaimType` modifier digit-9 governance gap]] — a gap in the governed enum.
- [[../regulatory/blockedpayerids-on-chain-privacy-design|`blockedPayerIds` on-chain privacy design]] — incidental upgradeability mention for the blocklist parameter.
- [[../regulatory/medicare-advantage-ma-exclusion-gate-phase1-scope|Medicare Advantage exclusion gate — Phase 1 scope]] — segment exclusion gate likely behind timelock.

## SBT registry upgrade interactions

Where the SBT registry's upgradeability creates specific design questions.

- [[../somnia/sbtregistry-grantRole-revert-override-uups-compatibility|SBTRegistry `grantRole`/`revokeRole` override-to-revert + UUPS compatibility]] — making role grants inert at the standard interface while preserving UUPS upgradeability.
- [[../somnia/sbtregistry-attestor-count-mapping-vs-enumerable|SBTRegistry attestor-count — mapping vs Enumerable]] — storage shape across upgrades.
- [[../somnia/sbtregistry-attestor-count-key-type-bytes32-vs-address|SBTRegistry attestor-count key — bytes32 vs address]] — schema choice that is hard to change after deployment.
- [[../somnia/sbt-registry-scoping-hospital-vs-network|SBT registry scoping — hospital vs network]] — scoping decision constrained by future upgradeability.
- [[../somnia/sbt-credential-expiry-enforcement|SBT credential expiry enforcement]] — adjacent; expiry mechanic across upgrades.
- [[../somnia/min-attesters-staffing-redundancy|Minimum attestor staffing redundancy]] — the floor parameter is itself a governed value.

## Chain-substrate / hardfork-level

Background: what the proxy pattern is even deployable against on Somnia.

- [[../somnia/evm-hardfork-level-paris-and-canary-tests|Somnia EVM hardfork: Paris confirmed + canary contract tests]] — the EVM version the proxies must run on; informs OZ v5 compatibility.

## Conditional fund release

- [[../agreement-layer/conditional-fund-release-state-machine|Conditional fund release — smart-contract patterns for the 5-state machine]] — the upgradeable settlement state machine itself.

## Operational / log

- [[../log|CliQueue Research Log]] — chronological upgrade/timelock mentions; use as a timeline.
- [[../research-questions|Open Research Questions]] — open upgrade-related questions still waiting on investigation.

---

## How to extend this hub

When you add a new research file about contract upgrades, proxies, or timelocks:

1. Place it under the decision it primarily speaks to (**Proxy pattern** / **Timelock design** / **Governance multisig** / **DASP interaction** / **Application-parameter governance** / **SBT registry upgrade interactions**).
2. Add one line: `- [[relative-path|Title]] — what this file argues, in ≤ 12 words.`
3. Do **not** copy content into this hub.
