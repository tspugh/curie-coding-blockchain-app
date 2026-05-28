---
title: Prior Authorization (PA) on-chain encoding — Topic Hub
type: topic-hub
status: navigation
---

# Prior Authorization (PA)

A navigation hub for everything in `docs/research/` that touches **prior authorization** — both the regulatory/operational concept and its on-chain encoding (`paStatus`, `paAuthHash`, `satisfiedPaId`, `paHash`, the `resolveConditional…` flow).

> This file is **navigation, not content**. Every claim about PA lives in the linked source file; please follow the link before citing.

See also: [[corti]] · [[x12]] · [[cda]] · [[sbt]] · [[settlement-stablecoin]] · [[README]] (topics index) · [[../../INDEX|docs index]]

---

## Frame: what "PA" means in this repo

In US payer-provider workflows, **prior authorization** is the payer's pre-approval that a service or procedure is covered before the provider performs (or submits) it. PA touches this project in two related ways:

1. **On-chain encoding** — once a claim is submitted, the on-chain claim struct needs a compact representation of the PA's *status* and, where required, a hash of the actual auth (`paAuthHash`). Several files debate exactly how those fields are encoded and which events emit them.
2. **Off-chain integration** — actually obtaining a PA today goes through X12 278 or FHIR `Coverage`/`PriorAuth` APIs (the CMS-0057-F track). The project's PA-on-chain representation has to round-trip with those off-chain systems without leaking PHI.

The on-chain side is dominated by **four field/event primitives**:

| Primitive          | What it is                                           |
|--------------------|------------------------------------------------------|
| `paStatus`         | Enum/encoded status of the PA: needed / pending / satisfied / not-applicable. |
| `paAuthHash`       | Hash of the actual authorization record off-chain.   |
| `satisfiedPaId`    | Identifier showing which PA the submitted claim satisfies. |
| `paHash` (domain-separated) | Domain-separated hash used in the PA verification path. |

---

## On-chain encoding — `paStatus`

- [[../somnia/pastatus-on-chain-encoding-claim-submitted-event|paStatus on-chain encoding + ClaimSubmitted event]] — the core encoding decision.
- [[../somnia/pa-status-encoder-typescript-module-npm-ecosystem|paStatus encoder TypeScript module + npm ecosystem]] — the off-chain encoder/decoder that mirrors the on-chain representation.
- [[../somnia/claim-submitted-event-combined-amendment-pastatus-paauthash|ClaimSubmitted event — combined amendment for paStatus + paAuthHash]] — combining both fields into one amendment to the existing event.

## On-chain encoding — `paAuthHash`

- [[../agreement-layer/rfi-denial-pathway-paauthash-on-chain-scope|RFI denial pathway: on-chain `paAuthHash` scope]] — limits on how much `paAuthHash` carries through the RFI denial loop.
- [[../somnia/claim-pa-status-resolved-paauthash-emission|ClaimPAStatusResolved — `paAuthHash` emission]] — emitting `paAuthHash` on resolution.
- [[../somnia/resolve-conditional-pa-auth-hash-parameter|`resolveConditional` `paAuthHash` parameter]] — the parameter shape for resolving a conditional PA.

## On-chain encoding — `satisfiedPaId` and `paHash`

- [[../somnia/satisfied-pa-id-on-chain-hash-claim-submitted|`satisfiedPaId` on-chain hash + ClaimSubmitted]] — linking the submitted claim to the PA it satisfies.
- [[../somnia/pa-hash-domain-separator-distinct-vs-shared|paHash domain separator — distinct vs shared]] — domain-separation design for the PA hash to prevent cross-context collisions.

## PA-related events

How resolution of PA state surfaces in events for off-chain consumers.

- [[../somnia/claim-pa-status-resolved-event-design|ClaimPAStatusResolved event design]] — the event itself.
- [[../somnia/claim-pa-status-resolved-paauthash-emission|ClaimPAStatusResolved — `paAuthHash` emission]] *(also under [paAuthHash](#on-chain-encoding--paauthhash))*
- [[../somnia/claim-submitted-event-combined-amendment-pastatus-paauthash|ClaimSubmitted event — combined paStatus + paAuthHash amendment]] *(also under [paStatus](#on-chain-encoding--pastatus))*
- [[../somnia/iclaimsadjudicator-event-registry-interface-design|IClaimsAdjudicator interface-level event registry]] — the typed event-registry boundary the PA events sit behind.
- [[../somnia/claim-disputed-event-websocket-subscription|ClaimDisputed event + WebSocket subscription]] — incidental; dispute path adjacent to PA resolution.

## Off-chain regulatory & integration track

The CMS-0057-F track is the most important external accelerant: by 2027, payers must expose FHIR-based PA APIs. That displaces parts of the legacy 278 surface and changes what the on-chain layer needs to mirror.

- [[../regulatory/cms-0057f-prior-auth-api-presubmission-integration|CMS-0057-F prior auth API — pre-submission integration]] — the regulatory replacement track.
- [[../regulatory/cds-hooks-typescript-client-crd-v2-1|CDS Hooks TypeScript client (CRD v2.1)]] — the Coverage Requirements Discovery client that supports pre-submission PA.
- [[../regulatory/improbable-somnia-operator-baa-analysis|Improbable / Somnia operator BAA analysis]] — relevant because PA traffic carries PHI; chain operator BAA scope matters.

## X12 surface

The X12 surface for PA is mostly 277RFAI (status-of-information) and 837 (claim) carrying PA references. The 275 attachment can carry PA documentation.

- [[../agreement-layer/edi-837-835-flow-and-blockchain-adjudication|EDI 837/835 flow + decentralized adjudication precedents]] — the loop PA references are carried through.
- [[../agreement-layer/on-chain-claim-struct-835-interoperability|On-chain claim struct + 835 interoperability]] — round-trip of PA references through the 835.
- [[../agreement-layer/fhir-payer-api-readiness-edi-replacement-timeline|FHIR payer API readiness + EDI 837 replacement timeline]] — paces the X12-to-FHIR PA replacement.
- [[../agreement-layer/hl7-cda-r2-typescript-npm-ecosystem-x12-275|HL7 CDA R2 TypeScript/npm ecosystem + X12 275]] — adjacent; CDA can carry PA-related documentation.

## Market signal

- [[../market/rfi-denial-cycle-time-benchmark-electronic-vs-paper|RFI denial cycle time benchmark — electronic vs paper]] — sizing the wedge for PA-automation specifically.
- [[../market/inpatient-coding-performance-and-market-consolidation|Inpatient coding AI performance + RCM consolidation]] — incidental PA mention.
- [[../market/coding-market-size-and-denial-losses|ICD-10 coding market size + denial losses]] — incidental.
- [[../market/payer-contract-data-sharing-restrictions|Payer contract data sharing restrictions]] — incidental; affects what PA data can move post-adjudication.

## Messaging & PHI substrate

- [[../somnia/offchain-pubsub-phi-messaging-architecture|Off-chain pub-sub / PHI messaging architecture]] — the PHI-bearing channel that carries the actual PA payload off-chain while the chain only sees the hash.

## Operational / log

- [[../log|CliQueue Research Log]] — chronological PA mentions; use as a timeline.
- [[../research-questions|Open Research Questions]] — open PA-related questions still waiting on investigation.

---

## How to extend this hub

When you add a new research file that touches PA:

1. Place it under the primitive it primarily speaks to (**paStatus** / **paAuthHash** / **satisfiedPaId & paHash** / **PA-related events**), or under **Off-chain regulatory** / **X12 surface** / **Market** / **Messaging** if it's framing-level.
2. Add one line: `- [[relative-path|Title]] — what this file argues, in ≤ 12 words.`
3. Do **not** copy content into this hub.
