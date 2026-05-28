---
title: SBT / SBTRegistry — Topic Hub
type: topic-hub
status: navigation
---

# SBT — Soulbound Token Credential Primitive

A navigation hub for everything in `docs/research/` that touches **SBTs** and the `SBTRegistry` contract — this project's on-chain credential primitive for hospital coders and human attestors.

> This file is **navigation, not content**. Every claim about SBTs lives in the linked source file; please follow the link before citing.

See also: [[corti]] · [[x12]] · [[cda]] · [[prior-auth]] · [[settlement-stablecoin]] · [[README]] (topics index) · [[../../INDEX|docs index]]

---

## Frame: SBT here is a credential, not an asset

Across this repo, "SBT" never refers to a transferable asset and never to a DeFi position. It always refers to a **non-transferable on-chain credential** representing:

- a **certified human medical coder** (AHIMA/AAPC) whose role is to attest claim correctness; or
- a **hospital identity** scoped to a hospitalId / NPI; or
- a **human attestor** required for high-risk claim types (inpatient / DRG).

The `SBTRegistry` contract is the registry that tracks these credentials. Most research files are asking design questions about that contract: who scopes the credential, who counts as a registered attestor, what happens when one expires or renounces.

Bring the *credential* mental model, not the asset mental model.

---

## Registry data design

How the registry's storage is laid out and why.

- [[../somnia/sbtregistry-attestor-count-mapping-vs-enumerable|SBTRegistry attestor count — explicit mapping vs `AccessControlEnumerable`]] — choosing between a hand-rolled count and `getRoleMemberCount`.
- [[../somnia/sbtregistry-attestor-count-key-type-bytes32-vs-address|SBTRegistry `_attestorCount` mapping key — `bytes32 hospitalId` vs `address hospitalAdmin`]] — what to key the count by.
- [[../somnia/iclaimsadjudicator-event-registry-interface-design|IClaimsAdjudicator interface-level event registry design]] — the interface boundary the SBT registry sits behind.
- [[../somnia/isbregistry-typed-interface-design-dlp-exclusion|ISBTRegistry typed interface design + GENIUS Act DLP exclusion]] — typed interface and the DLP regulatory carve-out it earns.
- [[../somnia/ormi-subgraph-abi-format-interface-vs-implementation|Ormi subgraph ABI format — interface vs implementation]] — adjacent; how indexers see the registry.

## Scoping — what an SBT represents

- [[../somnia/sbt-registry-scoping-hospital-vs-network|SBT registry scoping — hospital vs network]] — does an SBT bind to a single hospital or to the network?
- [[../somnia/sbt-hospitalid-npi-hash-hipaa-disclosure|SBT hospitalId / NPI hash + HIPAA disclosure]] — whether the hospitalId/NPI representation in an SBT leaks PHI.
- [[../somnia/human-attestor-credential-representation|Human attestor credential representation]] — what an attestor's credential actually contains on-chain.

## Lifecycle — issuing, expiring, renouncing

- [[../somnia/sbt-credential-expiry-enforcement|SBT credential expiry — on-chain enforcement vs revocation-only]] — block at the contract vs only at off-chain consumers.
- [[../somnia/sbt-expiry-grace-window-jcaho-fca|SBT expiry grace window — JCAHO PSV lapse vs FCA liability vs on-chain exploit risk]] — sizing the grace window against legal-and-credentialing realities.
- [[../somnia/renounce-attestor-role-admin-cosignature-vs-permissionless|`renounceAttestorRole` — admin co-signature vs permissionless floor-guarded self-renounce]] — what the off-ramp looks like.
- [[../somnia/sbtregistry-grantRole-revert-override-uups-compatibility|SBTRegistry `grantRole`/`revokeRole` override-to-revert + UUPS compatibility]] — making role grants inert at the standard interface; UUPS-upgrade implications.

## Staffing floor — minimum attestor counts

Several files cluster around the question "how many attestors does a hospital need on-chain to be valid?"

- [[../somnia/min-attesters-staffing-redundancy|Minimum attestor staffing redundancy + on-chain `minAttesters` enforcement]] — the floor and how it's enforced.
- [[../somnia/staffing-floor-reached-event-design|`StaffingFloorReached` event design, gas cost, HIPAA analysis]] — the event signalling the floor is met.
- [[../somnia/sbtregistry-attestor-count-mapping-vs-enumerable|SBTRegistry attestor count storage]] *(also under [Registry data design](#registry-data-design))*

## SBT inside the claim flow

Where an SBT actually shows up at adjudication / settlement time.

- [[../somnia/satisfied-pa-id-on-chain-hash-claim-submitted|`satisfiedPaId` on-chain hash + ClaimSubmitted]] — the claim event whose validity depends on an attestor SBT being in place.
- [[../somnia/claim-struct-packing-cold-sload-dispute-architecture|Claim struct packing + cold-SLOAD dispute architecture]] — gas accounting for the SBT lookups during dispute.
- [[../somnia/pa-hash-domain-separator-distinct-vs-shared|paHash domain separator — distinct vs shared]] — adjacent; domain-separator design for the PA hash that the SBT vouches for.
- [[../agreement-layer/adjudicated-cents-on-chain-emission-risk|adjudicatedCents on-chain emission risk]] — incidental SBT mention in the context of what the adjudicator emits.
- [[../agreement-layer/payerclaimrefset-event-835-adapter-caching|PayerClaimRefSet event + 835 adapter caching]] — incidental.

## Compliance & regulatory framing

How SBTs interact with the regulatory perimeter (HIPAA, certification, DASP exclusion).

- [[../regulatory/ahima-aapc-ai-coding-certification-oversight-requirements|AHIMA/AAPC certification rules + AI-only coding constraints]] — the certification regime that gives the SBT its meaning.
- [[../regulatory/blockedpayerids-on-chain-privacy-design|`blockedPayerIds` on-chain privacy design — hash vs raw EDI ID]] — analogous privacy decision for a different on-chain identifier; useful precedent.
- [[../regulatory/medicare-advantage-ma-exclusion-gate-phase1-scope|Medicare Advantage exclusion gate — Phase 1 scope]] — segment carve-out interacts with which SBTs are required.

## Market / use case

Why a payer or hospital should care that a credential is on-chain.

- [[../market/payer-contract-attestation-exhibit-on-chain-sbt|Payer contract attestation exhibit — does on-chain SBT attestation satisfy Humana/Cigna requirements?]] — the wedge question for the SBT primitive's market value.
- [[../market/claimtype-enum-on-chain-enforcement-inpatient-outpatient|ClaimType on-chain enforcement — inpatient vs outpatient gating of `requiresHumanAttestation`]] — when an SBT is *required* on-chain.
- [[../market/inpatient-drg-human-attestor-architecture|Inpatient DRG human-attestor architecture]] — primary use case for human-attestor SBTs.
- [[../market/cliqueue-monorepo-package-architecture|@cliqueue/* monorepo package architecture]] — where the SBT-touching packages live in the monorepo.

## Operational / log

- [[../log|CliQueue Research Log]] — chronological SBT mentions; use as a timeline.
- [[../research-questions|Open Research Questions]] — open SBT-related questions still waiting on investigation.

---

## How to extend this hub

When you add a new research file that touches SBTs:

1. Place it under the lifecycle phase it asks about (**Registry data design** / **Scoping** / **Lifecycle** / **Staffing floor** / **SBT inside the claim flow**), or under **Compliance** or **Market** if it's framing-level.
2. Add one line: `- [[relative-path|Title]] — what this file argues, in ≤ 12 words.`
3. Do **not** copy content into this hub.
