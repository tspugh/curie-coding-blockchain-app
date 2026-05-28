---
title: HIPAA / PHI Boundary — Topic Hub
type: topic-hub
status: navigation
---

# HIPAA / PHI Boundary

A navigation hub for the **subset of research files where HIPAA is the primary subject** — not every file that mentions HIPAA in passing.

> This file is **navigation, not content**. Every claim about HIPAA lives in the linked source file; please follow the link before citing.

See also: [[corti]] · [[sbt]] · [[prior-auth]] · [[settlement-stablecoin]] · [[README]] (topics index) · [[../../INDEX|docs index]]

---

## Why this hub is selective

HIPAA is the project's regulatory **substrate** — almost every research file mentions it in some way, because [[../../AGENTS|AGENTS.md]]'s hard rule is "PHI never goes on-chain." A hub that linked every passing mention would be useless.

Instead, this hub indexes only files that *primarily* answer one of HIPAA's four recurring sub-questions in this project:

| Sub-question                       | What's being decided                                                       |
|------------------------------------|-----------------------------------------------------------------------------|
| **On-chain / off-chain boundary**  | What's allowed in calldata, events, or contract storage given PHI risk.    |
| **BAA chain**                      | Who is a Business Associate, who needs a BAA with whom, sub-BAA flow-down. |
| **Re-identification risk**         | When low-volume / homogeneous on-chain data becomes effectively re-id-able. |
| **Minimum-necessary standard**     | How much detail an event/disclosure may carry under §164.502(b).            |

For files where HIPAA is just background, see [[corti]] (Role 3), [[sbt]] (Compliance), [[settlement-stablecoin]] (DASP), or [[prior-auth]] (Off-chain regulatory) — those hubs already cover them in their proper context.

---

## On-chain / off-chain boundary

The core constraint: what may cross the on-chain / off-chain line at all.

- [[../regulatory/hipaa-blockchain-hash-anchoring|HIPAA constraints on anchoring claim hashes on a public blockchain]] — the foundational analysis for what kinds of hash anchoring are HIPAA-defensible.
- [[../regulatory/hipaa-minimum-necessary-on-chain-events|HIPAA minimum-necessary standard — on-chain event visibility]] — the §164.502(b) constraint applied to event emission.
- [[../regulatory/blockedpayerids-on-chain-privacy-design|`blockedPayerIds` on-chain privacy design — hash vs raw EDI ID]] — concrete case study of the boundary for a single field.
- [[../somnia/sbt-hospitalid-npi-hash-hipaa-disclosure|SBT hospitalId / NPI hash — HIPAA disclosure]] — boundary case for an SBT field.
- [[../somnia/offchain-pubsub-phi-messaging-architecture|Off-chain pub-sub / PHI messaging architecture]] — the channel that carries PHI alongside on-chain events, *without* it crossing the boundary.
- [[../agreement-layer/edi-adapter-offchain-store-phi-reconstruction-risk|EDI adapter off-chain store — PHI reconstruction risk]] — even an off-chain store can re-create the boundary problem.

## BAA chain

Who counts as a Business Associate, and what happens to obligations as they flow down the chain of vendors.

- [[../regulatory/corti-symphony-baa-and-phi-data-flow|Corti Symphony BAA + PHI data flow]] — the authoritative PHI dataflow doc for Corti.
- [[../regulatory/corti-baa-procurement-timeline-sub-baa-chain|Corti BAA procurement timeline + sub-BAA chain]] — how long signing takes; sub-BAA flow-down.
- [[../regulatory/improbable-somnia-operator-baa-analysis|Improbable / Somnia operator BAA analysis]] — whether the *chain operator* is a Business Associate.
- [[../somnia/dispute-listener-middleware-deployment-baa-obligations|Dispute-listener middleware deployment + BAA obligations]] — BAA implications for off-chain middleware that handles dispute events.
- [[../somnia/dispute-window-floor-governance-baa|disputeWindowSeconds floor — timelock + BAA settlement finality]] — BAA-driven floor on the dispute window.
- [[../agreement-layer/hmacsalt-key-exchange-ba-relationship-analysis|hmacSalt key exchange + BA relationship]] — whether transmitting a key creates a BA relationship.
- [[../agreement-layer/enrichment-step-ba-status-feature-gate|Enrichment step BA status + hard feature gate]] — gating the EDI enrichment step on BA status.
- [[../regulatory/caa21-gag-clause-provider-vendor-data-sharing|CAA-21 gag clause — provider-to-vendor data sharing]] — adjacent statutory constraint on the same data flow.

## Re-identification risk

When on-chain data is technically "deidentified" but practically re-identifiable, especially at low volumes.

- [[../regulatory/re-identification-risk-low-volume-provider-batching|Re-identification risk — low-volume provider on-chain data + batching threshold]] — the foundational sizing analysis.
- [[../regulatory/batch-aggregation-homogeneous-provider-cv-l-diversity|Batch aggregation — homogeneous single-specialty provider diversity]] — when batching fails to add real diversity.
- [[../regulatory/minbatchthreshold-governance-network-vs-hospital|minBatchThreshold governance — network vs hospital level]] — who chooses the batching threshold.

## Minimum-necessary (event design)

How much can be in an event under §164.502(b)?

- [[../regulatory/hipaa-minimum-necessary-on-chain-events|HIPAA minimum-necessary on-chain events]] *(also under [On-chain boundary](#on-chain--off-chain-boundary))* — the rule.
- [[../somnia/staffing-floor-reached-event-design|`StaffingFloorReached` event — design, gas cost, HIPAA analysis]] — HIPAA review of a specific event.
- [[../regulatory/blockedpayerids-on-chain-privacy-design|`blockedPayerIds` on-chain privacy design]] *(also under [On-chain boundary](#on-chain--off-chain-boundary))* — minimum-necessary for a specific field.

## Operational / log

- [[../log|CliQueue Research Log]] — chronological HIPAA mentions; use as a timeline.
- [[../research-questions|Open Research Questions]] — open HIPAA-related questions still waiting on investigation.

---

## How to extend this hub

When you add a new research file that touches HIPAA:

1. **Ask: is HIPAA the primary subject of this file?** If HIPAA is just framing or background, *do not* add it here — the file is already linked from its functional hub (Corti, SBT, PA, settlement, etc.).
2. If HIPAA *is* the primary subject, place it under the matching sub-question (**On-chain boundary** / **BAA chain** / **Re-identification** / **Minimum-necessary**).
3. Add one line: `- [[relative-path|Title]] — what this file argues, in ≤ 12 words.`
4. Do **not** copy content into this hub.
