---
title: Corti (Symphony) — Topic Hub
type: topic-hub
status: navigation
---

# Corti (Symphony)

A navigation hub for everything in `docs/research/` that touches **Corti** — specifically Corti's *Symphony* model, which appears throughout the research as the candidate off-chain medical-coding inference engine paired with the on-chain Curie / cliqueue protocol.

> This file is **navigation, not content**. Every claim about Corti lives in the linked source file; please follow the link before citing.

See also: [[x12]] · [[cda]] · [[README]] (topics index) · [[../../INDEX|docs index]]

---

## What Corti is, in this project's mental model

Across the research files, Corti Symphony appears in three distinct roles:

1. **Off-chain medical coder** — the AI system that emits ICD-10 / CPT proposals which are then hashed and anchored on Somnia.
2. **An MCP-callable service** — invoked from agent runtimes via Model Context Protocol; not a chain-resident actor.
3. **A HIPAA business associate** — the procurement timeline, sub-BAA chain, and PHI data flow are themselves a research subject because Corti sees PHI.

Each linked file below answers a specific question about one of those three roles. Use the section headings to find the role you're investigating.

---

## Role 1 — Corti as the off-chain coder

What can Symphony actually do, and where does it stop?

- [[../ai-models/corti-symphony-confidence-score-and-routing|Symphony confidence score and human-review routing]] — how the model's confidence number feeds the routing decision between auto-submit and human attestor.
- [[../ai-models/corti-symphony-inpatient-drg-gap|Symphony inpatient / DRG performance gap]] — why inpatient / DRG cases require a human attestor and Symphony alone does not clear that bar.
- [[../ai-models/corti-symphony-tob-claim-type-adapter|Symphony TOB / claim-type adapter]] — selecting Symphony's "system array" by UB-04 type-of-bill so the right downstream pipeline runs.
- [[../ai-models/coding-confidence-heuristic-spec|CodingConfidenceHeuristic spec]] — the cliqueue-side routing component that consumes Symphony confidence; not Corti-specific but Corti-anchored.
- [[../ai-models/llm-icd10-accuracy-and-somnia-model-availability|LLM ICD-10 accuracy + Somnia model availability]] — Corti as the reference accuracy bar; how on-chain `inferToolsChat` models compare.

## Role 2 — Corti as an MCP-integrated service

How does on-chain code invoke Corti, and what does the network path look like?

- [[../ai-models/corti-symphony-mcp-integration|Symphony MCP integration as off-chain coder]] — high-level integration shape (MCP server, tool surface, authentication).
- [[../somnia/infer-tools-chat-mcp-endpoint-network-requirements|inferToolsChat mcpServerUrls network requirements]] — public vs. private endpoint requirements when Somnia's on-chain `inferToolsChat` is the *caller* of an MCP server like Corti.
- [[../somnia/mcp-reverse-proxy-auth-without-url-key|MCP reverse-proxy auth without URL-embedded key]] — how to authenticate inbound requests to a Corti-fronting MCP proxy without leaking secrets in URLs.
- [[../somnia/phase2-custom-agents-and-llm-model-opacity|Somnia Phase 2 custom agents + LLM opacity]] — implications when the chain calls an opaque model; Corti is one such opaque model.
- [[../somnia/llm-inference-callback-latency-and-timeout|LLM inference callback latency and timeout]] — bounds on how long an on-chain caller can wait for an off-chain coder like Corti to return.
- [[../somnia/per-claim-gas-economics-llm-inference-cost|Per-claim gas economics vs. LLM inference cost]] — the cost frame in which a Corti call must fit per claim.

## Role 3 — Corti as a HIPAA business associate

Corti sees PHI; the chain must not. What does that imply for procurement, contracts, and PHI flow?

- [[../regulatory/corti-symphony-baa-and-phi-data-flow|Corti Symphony BAA + PHI data flow]] — the authoritative PHI dataflow doc for Corti integration; pair this with `medical-blockchain.md` (the core platform-concept guide).
- [[../regulatory/corti-baa-procurement-timeline-sub-baa-chain|Corti BAA procurement timeline + sub-BAA chain]] — how long signing a BAA actually takes and where the sub-BAA chain (e.g. Corti → its cloud provider) creates obligations.
- [[../regulatory/improbable-somnia-operator-baa-analysis|Improbable / Somnia operator BAA analysis]] — whether the *chain* operator needs a BAA; relevant because Corti's PHI must not reach the chain side.
- [[../somnia/offchain-pubsub-phi-messaging-architecture|Off-chain pub-sub / PHI messaging architecture]] — the messaging substrate that carries PHI between Corti and other off-chain components without crossing on-chain.
- [[../somnia/sbt-hospitalid-npi-hash-hipaa-disclosure|SBT hospitalId / NPI hash + HIPAA disclosure]] — adjacent; whether the hospital identifier itself in an SBT credential is a HIPAA disclosure issue when Corti-produced claims reference it.
- [[../somnia/tee-attestation-on-chain-verification|TEE attestation on-chain verification]] — alternative path if Corti's output were ever computed inside a TEE for on-chain trust; currently exploratory.

## Cross-cutting

- [[../market/inpatient-drg-human-attestor-architecture|Inpatient DRG human-attestor architecture]] — market view of the same gap Symphony has on inpatient.
- [[../market/claimtype-enum-on-chain-enforcement-inpatient-outpatient|ClaimType on-chain enforcement: inpatient vs outpatient]] — the on-chain gate that depends on the Role-1 routing decision.
- [[../market/coding-error-denial-share-and-ai-impact|Coding-error share of claim denials + AI vendor impact]] — establishes the addressable wedge for an AI coder like Corti to attack.
- [[../agreement-layer/usdc-vs-usdso-settlement-stablecoin|USDC vs USDso settlement stablecoin]] — incidental Corti reference (settlement of Corti-coded claims).
- [[../regulatory/cms-0057f-prior-auth-api-presubmission-integration|CMS-0057-F prior auth API]] — adjacent regulatory pressure on the pre-submission path Corti participates in.

## Operational / log references

- [[../log|CliQueue Research Log]] — chronological Corti mentions are scattered here; use as a timeline, not a primary source.
- [[../research-questions|Open Research Questions]] — open Corti-related questions still waiting on investigation.

---

## How to extend this hub

When you add a new research file that touches Corti:

1. Decide which of the three roles it primarily speaks to (Role 1 / 2 / 3) — if it's truly cross-cutting, put it under **Cross-cutting**.
2. Add one line: `- [[relative-path|Title]] — what this file argues, in ≤ 12 words.`
3. Do **not** copy content into this hub. Fidelity stays in the source.
