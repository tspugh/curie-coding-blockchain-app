---
title: HL7 CDA (Clinical Document Architecture) — Topic Hub
type: topic-hub
status: navigation
---

# HL7 CDA — Clinical Document Architecture

A navigation hub for everything in `docs/research/` that touches **CDA R2** — the HL7 v3 clinical-document standard that rides inside an X12 275 attachment, carrying the clinical narrative payload that supports a claim.

> This file is **navigation, not content**. Every claim about CDA lives in the linked source file; please follow the link before citing.

See also: [[x12]] · [[corti]] · [[README]] (topics index) · [[../../INDEX|docs index]]

---

## Why CDA matters here

CDA is the *payload format* for the X12 275 attachment. When a payer asks via a 277RFAI for documentary support of a claim, the provider answers with a 275 whose body is a CDA document. The on-chain claim never holds the CDA — only a hash anchor — but the off-chain CDA toolchain (parsers, validators, schematron checks) is in the project's critical path.

The research touches three CDA concerns:

1. **Validation** — schematron, VSAC value sets, CI pipelines.
2. **Package boundary** — where CDA stops and the X12 275 wrapper begins.
3. **TypeScript ecosystem** — what exists in npm to actually parse / build CDA R2.

---

## Validation

- [[../agreement-layer/cda-schematron-vsac-ci-validation|CDA Schematron validator + VSAC dependency + CI validation design]] — schematron-based validation, VSAC value-set dependency, what CI must enforce.

## Package boundary (CDA ↔ X12 275)

- [[../agreement-layer/cda-vs-x12-275-package-boundary|CDA vs X12 275 package boundary]] — where the CDA payload sits inside the 275 envelope and how the package boundary affects code organisation.

## TypeScript / npm ecosystem

- [[../agreement-layer/hl7-cda-r2-typescript-npm-ecosystem-x12-275|HL7 CDA R2 TypeScript/npm ecosystem + X12 275]] — what TS libraries exist for CDA R2, paired with the 275 picture.
- [[../agreement-layer/x12-275-typescript-npm-ecosystem-bds-envelope|X12 275 TypeScript/Node.js ecosystem + BDS envelope]] — the X12-side counterpart; together these two files cover the build-vs-buy question.

## Replacement track (FHIR)

CDA is part of the older HL7 v3 family; FHIR is the modern replacement. These two files frame CDA's shelf life:

- [[../agreement-layer/fhir-payer-api-readiness-edi-replacement-timeline|FHIR payer API readiness + EDI 837 replacement timeline]] — how fast FHIR-based payer APIs displace the 837/275/CDA stack.
- [[../regulatory/cms-0057f-prior-auth-api-presubmission-integration|CMS-0057-F prior auth API pre-submission integration]] — the regulatory accelerant pulling payers toward FHIR.

## Adjacent (CDA mentioned in passing)

- [[../market/cliqueue-monorepo-package-architecture|@cliqueue/* monorepo package architecture]] — where CDA-related TS packages live in the monorepo.
- [[../market/coding-market-size-and-denial-losses|Coding market size + denial losses]] — incidental CDA mention.
- [[../market/x12-275-payer-adoption-mvp-scope|X12 275 payer adoption + MVP scope]] — adoption of the envelope CDA rides in.
- [[../somnia/offchain-pubsub-phi-messaging-architecture|Off-chain pub-sub / PHI messaging architecture]] — incidental; the substrate that ferries the CDA payload between systems.
- [[../log|CliQueue Research Log]] — chronological CDA mentions; use as a timeline.
- [[../research-questions|Open Research Questions]] — open CDA-related questions still waiting on investigation.

---

## How to extend this hub

When you add a new research file that touches CDA:

1. Place it under **Validation**, **Package boundary**, **TypeScript ecosystem**, or **Replacement track**. Only use **Adjacent** for tangential references.
2. Add one line: `- [[relative-path|Title]] — what this file argues, in ≤ 12 words.`
3. Do **not** copy content into this hub.
