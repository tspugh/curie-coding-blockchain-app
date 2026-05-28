---
title: Settlement stablecoin & GENIUS Act perimeter — Topic Hub
type: topic-hub
status: navigation
---

# Settlement Stablecoin

A navigation hub for everything in `docs/research/` that touches **the stablecoin a Curie claim settles in** — and the GENIUS Act / DASP regulatory perimeter that constrains which stablecoin is even legal to use.

> This file is **navigation, not content**. Every claim about stablecoins / settlement lives in the linked source file; please follow the link before citing.

See also: [[corti]] · [[x12]] · [[sbt]] · [[prior-auth]] · [[README]] (topics index) · [[../../INDEX|docs index]]

---

## Frame: two coupled questions

Across the research, "what stablecoin do we settle in?" is rarely the only question — it's almost always paired with a regulatory one. The cluster splits into:

1. **Which token** — USDC (native CCTP vs bridged `USDC.e`), USDso, Frax, or SOMI as gas/utility-only.
2. **Governance of that token's address on-chain** — the timelock, multisig, and notice period for changing the settlement-token address are themselves a research subject.
3. **DASP / GENIUS Act qualification** — the regulatory perimeter that decides whether the `ClaimsAdjudicator` and proxy admins count as a Digital Asset Service Provider.

These three sit on top of the underlying settlement-amount question: how much, and from which vault, with what daily-limit cap.

---

## Token candidates

### USDC — native CCTP vs bridged

- [[../agreement-layer/usdc-cctp-somnia-native-vs-bridged|USDC on Somnia: native CCTP vs bridged USDC.e — settlement-token trust model]] — the core "which USDC?" decision.
- [[../somnia/circle-cctp-somnia-bridged-usdc-standard-genius-act|Circle CCTP, Somnia USDC path, and GENIUS Act deadline]] — Circle's CCTP timeline against the regulatory clock.
- [[../agreement-layer/usdc-vs-usdso-settlement-stablecoin|USDC vs USDso settlement stablecoin]] — the head-to-head comparison.

### Frax / other alternatives

- [[../agreement-layer/frax-ppsi-application-status-genius-act-timeline|Frax Finance PPSI application status + GENIUS Act compliance timeline]] — whether Frax achieves Permitted Payment Stablecoin Issuer status in time.

### SOMI — note: not a settlement token

SOMI is Somnia's native gas/utility token. It is **not** a candidate for settlement payments to providers — it appears in the cluster because gas economics and reserve holding are coupled to whichever stablecoin actually settles.

- [[../somnia/somi-inference-fee-governance-cliff-unlock-risk|SOMI inference fee governance + cliff unlock risk]] — governance of the SOMI-denominated inference fee that runs alongside settlement.
- [[../somnia/somi-price-circuit-breaker-oracle-architecture|SOMI price circuit breaker + oracle architecture]] — circuit-breaker design for the SOMI/USD oracle that settlement-adjacent components consume.
- [[../somnia/somi-reserve-holding-architecture-compliance|SOMI reserve holding architecture + compliance]] — holding SOMI on the operator side.
- [[../somnia/per-claim-gas-economics-llm-inference-cost|Per-claim gas economics vs LLM inference cost]] — sets the SOMI-denominated cost a settlement must clear.
- [[../somnia/finality-tps-and-gas-model|Somnia finality, TPS, and gas model]] — the substrate cost model.

## Governance of the settlement token address

How the on-chain settlement-token *address* is changed, frozen, or upgraded.

- [[../agreement-layer/stablecoin-address-governance-timelock|Stablecoin address governance — timelock, multisig, notice period]] — the core governance design.
- [[../agreement-layer/timelock-min-delay-immutable-vs-mutable|TimelockController minimum delay — immutable vs mutable]] — should the minimum delay itself be changeable?
- [[../agreement-layer/timelock-uups-proxy-upgrade-path|TimelockController vs Compound Timelock — UUPS upgrade path]] — choice of timelock implementation given UUPS upgradeability.
- [[../agreement-layer/transparent-proxy-proxyadmin-timelock-deployment|TransparentUpgradeableProxy v5 + ProxyAdmin + Timelock deployment]] — the proxy pattern around the timelock.

## Vault + daily-limit settlement mechanics

How the actual payout works, not just which token.

- [[../agreement-layer/agentvault-daily-limit-and-stablecoin-settlement|AgentVault daily-limit calibration + stablecoin settlement rails]] — calibrating per-agent daily limits to expected claim volume.
- [[../agreement-layer/oracle-attestation-schemes|Oracle attestation schemes for off-chain coding agent output]] — adjacent; the attestation that gates a payout.
- [[../agreement-layer/edi-adapter-payericn-mapping-resilience|EDI adapter payerICN → claimId mapping resilience]] — incidental; durability of the join key settlement reconciliation depends on.
- [[../market/attestation-required-mapping-initialization-tob-taxonomy|`attestationRequired` mapping initialization + UB-04 TOB taxonomy]] — incidental; ties claim-type taxonomy to attestation requirements that gate settlement.

## DASP / GENIUS Act regulatory perimeter

The GENIUS Act introduces a Digital Asset Service Provider (DASP) regime; the project's on-chain contracts must clarify which actors fall inside vs outside that perimeter, because operating as an unregistered DASP is a hard stop.

- [[../regulatory/genius-act-dasp-smart-contract-scope|GENIUS Act DASP definition — does `ClaimsAdjudicator` qualify?]] — the core qualification question.
- [[../regulatory/dlp-exclusion-upgradeable-proxy-dasp-analysis|GENIUS Act DLP exclusion — upgradeable proxy + governance multisig]] — earning a Decentralized Ledger Protocol exclusion via proxy/governance shape.
- [[../regulatory/uups-proxy-governance-multisig-dasp-operator-risk|GENIUS Act DASP operator risk — UUPS proxy upgrade authority + multisig]] — who counts as an "operator" under DASP given the proxy.
- [[../regulatory/multisig-timelock-dasp-control-threshold|GENIUS Act DASP control threshold — 3-of-5 multisig + 48-hour timelock]] — concrete threshold proposal.
- [[../regulatory/treasury-section9-defi-dasp-scope-study-status|Treasury Section 9 DeFi DASP scope study — publication status]] — what we still don't know about the perimeter.
- [[../regulatory/minbatchthreshold-governance-network-vs-hospital|minBatchThreshold governance — network vs hospital level]] — relevant to which body holds DASP-triggering control.
- [[../regulatory/medicare-advantage-ma-exclusion-gate-phase1-scope|Medicare Advantage exclusion gate — Phase 1 scope]] — payer-segment carve-out interacts with the regulatory perimeter.
- [[../somnia/isbregistry-typed-interface-design-dlp-exclusion|ISBTRegistry typed interface + DLP exclusion]] — earning DLP exclusion for the SBT registry specifically.

## Dispute & settlement-finality interactions

When settlement-finality crosses the dispute window, the stablecoin can be locked or clawed back depending on design.

- [[../somnia/claims-dispute-registry-separate-vs-erc7201-internal|ClaimsDisputeRegistry — separate contract vs ERC-7201 internal storage]] — where the dispute state lives.
- [[../somnia/claim-struct-packing-cold-sload-dispute-architecture|Claim struct packing + cold-SLOAD dispute architecture]] — cost of fetching state during dispute.
- [[../somnia/heuristic-version-on-chain-anchoring|Heuristic version on-chain anchoring — OIG audit trail]] — incidental; anchored audit data that informs settlement disputes.
- [[../somnia/tee-attestation-on-chain-verification|TEE attestation on-chain verification — Phala + Somnia]] — alternative trust model for settlement-affecting attestations.
- [[../somnia/native-agents-vs-agent-kit|Somnia native agents vs somnia-agent-kit]] — incidental; agent runtime choice affects who signs settlement transactions.
- [[../somnia/staffing-floor-reached-event-design|StaffingFloorReached event design]] — incidental; settlement gating depends on staffing floor being met.

## Operational / log

- [[../log|CliQueue Research Log]] — chronological settlement / stablecoin mentions; use as a timeline.
- [[../research-questions|Open Research Questions]] — open settlement-related questions still waiting on investigation.

---

## How to extend this hub

When you add a new research file that touches settlement or stablecoins:

1. Place it under the question it primarily answers (**Token candidates** / **Governance** / **Vault + daily limit** / **DASP perimeter** / **Dispute interactions**).
2. Add one line: `- [[relative-path|Title]] — what this file argues, in ≤ 12 words.`
3. Do **not** copy content into this hub.
