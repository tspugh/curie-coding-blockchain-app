# Curie Claims Protocol — Product Requirements Document

| Field | Value |
|---|---|
| Version | 1.0 (initial PRD baseline; will be revised as decisions resolve) |
| Date | 2026-05-18 |
| Status | Active — supersedes the 2024–2025 coder-UI PRD archived to `docs/raw/archived/PRODUCT.md` |
| Authoritative pair | [[AGENTS]] wins on any tech-stack or architectural conflict; [[CLAUDE]] wins on working philosophy |
| Companions | [[VISION]] (north-star), [[ROADMAP]] (hackathon strategy), [[MARKET]] (history + competitive landscape, forthcoming), [[medical-blockchain]] (core platform-concept guide) |
| Source basis | `docs/research/**` — every quantitative or regulatory claim in this PRD has a research-file source linked inline |

> **Reading order for a new contributor or AI agent:** [[AGENTS]] → this PRD → [[ROADMAP]] → [[MARKET]] → the relevant subfolder under `docs/research/`.

---

## 1. Executive summary

**Curie Claims Protocol** is an agentic claims settlement protocol on Somnia where provider and payer agents negotiate medical claim adjudication, anchor audit commitments on-chain, and settle approved claims in a stablecoin — *reducing clearinghouse dependence, with a path to direct payer settlement*. The wedge segment is small specialty outpatient practices that today cannot afford or cannot access the clearinghouse-centric rail; behavioral health outpatient is the MVP-1 target specialty because its denial economics, parity-of-coverage disputes, and AI-coding under-service make Curie's value proposition viscerally strong there.

Curie operates in two modes: **provider-only** (coding QA, prior-auth checks, audit timeline, appeal packets — no payer participation required) and **bilateral protocol** (adjudication negotiation, settlement, 835 generation — payer must run the Curie payer agent). PHI never touches the chain. Clinical processing happens entirely inside the provider's own environment via a locally-deployed agent. The cliqueue-hosted MCP server receives only non-identifying coding ontology queries (e.g., "ICD-10 candidates for ADHD predominantly inattentive type"); patient-specific feature bundles are resolved locally and never leave the provider environment.

The protocol is open; the knowledge graph and curation tooling are proprietary. Repository structure reflects this: a public submodule (`curie-protocol`) carries the smart contracts, agent source, and demo UI; a private submodule (`knowledge-graph-curation`) carries the ICD-10 ingestion pipeline, embedding generation, and curated supplementary findings.

The single thing a contributor or judge should walk away believing after reading this document: **the demo is a real product, not a hack.**

---

## 2. Problem statement

### 2.1 The friction being addressed

Medical claims adjudication in the United States is a structural coordination failure between providers and payers, with three layers of friction that compound for small specialty practices:

- **Aggregate denial pressure**: $262B in claims were denied in 2024, of which ~84% were potentially avoidable; the initial denial rate reached 11.81%. Coding-attributable denials grew +126% year-over-year to ~$631 per denied claim. Source: [[coding-market-size-and-denial-losses]].
- **Clearinghouse concentration risk**: the Change Healthcare ransomware breach (February 2024) exposed ~192.7M records and — based on industry reporting — disrupted a large fraction of US medical claims for weeks. The market response was overwhelmingly to add a second clearinghouse (53%) rather than to seek decentralized alternatives (17% pursued direct-payer submission). Source: [[change-healthcare-clearinghouse-concentration-and-decentralization-appetite]]. **This is the segment Curie targets**: the larger underserved group below that 17% who *could not* afford direct submission and were forced to absorb whatever the clearinghouse offered. **Note:** the exact fraction of claims disrupted remains under active research; the figure should be calibrated once the source data is validated.
|- **Behavioral health denial disproportion**: behavioral health claims are denied at 2–3× the rate of medical/surgical claims (per MHPAEA portal data and research literature; this estimate needs segmentation by denial reason and practice size in Q6). Denial reasons skew toward "medical necessity" and "session limit exceeded" — parity-of-coverage disputes that fit an immutable evidence + automated appeals workflow precisely. **Note:** not every "medical necessity" denial is automatically a parity violation. Curie helps providers preserve evidence and build the right escalation path: ordinary denial appeal → suspected parity issue → documented NQTL parity challenge → regulator-ready complaint package. No incumbent AI coding vendor (Fathom, CodaMetrix, AKASA, Nym) leads with behavioral health as a core focus — this is a contested, underserved wedge; see [[MARKET]] for competitive landscape analysis.

For a small behavioral health practice (the MVP-1 target persona, §5.1), this compounds into:

- Outsourced coding cost they often cannot afford (~$4–10/claim per [[coding-market-size-and-denial-losses]]) — so the clinician or office manager does it themselves, on top of clinical work, with no specialized training.
- Per-denial rework cost of $25–181 plus ~30 extra days of AR aging, on a denial rate disproportionately driven by payer parity disputes rather than coding errors.
- No tamper-evident audit trail when a denial escalates to appeal — communications happen by phone, fax, and PDF.

### 2.2 What Curie addresses

Curie ships a **protocol-level shared state machine** for negotiation between a provider's agent and a payer's adjudication agent, with five tightly-coupled capabilities:

1. **On-chain commitment of claim hashes and lifecycle state** — `Submitted → EvidenceRequested → Adjudicated → Accepted | Disputed → Settled | Denied | Withdrawn | Replaced`. Attestation is modeled as an event/flag on the claim record (not a required middle state). State transitions are Somnia events; gas per happy-path claim is ~$0.0023 worst case. Source: [[conditional-fund-release-state-machine]], [[on-chain-claim-struct-835-interoperability]].
2. **Off-chain structured negotiation** — code proposals, evidence requests, counters, attestations — carried as chain-anchored events with HMAC-keyed hashes per [[hipaa-blockchain-hash-anchoring]].
3. **Settlement in stablecoin** — USDC.e on Somnia for MVP, released conditionally when state reaches `Settled` via a TimelockController-gated path. Source: [[transparent-proxy-proxyadmin-timelock-deployment]], [[timelock-min-delay-immutable-vs-mutable]].
4. **A tamper-evident audit timeline** — authorized parties can verify disclosed records against chain commitments without revealing underlying PHI.
5. **A coder-pluggable AI coding agent** — provider brings their own (Fathom, CodaMetrix, Nym, Symphony) or uses Curie's bundled coder, which queries the proprietary ICD-10 knowledge graph via the MCP server.

### 2.3 What Curie explicitly does NOT address

| Out of scope | Why |
|---|---|
| Replacing the EDI 837/835 *standard* | EDI is the only HHS-recognized electronic claim format under HIPAA Administrative Simplification. Curie ships an EDI 837/835 adapter library so PM systems that emit 837 can ingest into Curie, and payers that consume 835 can be served — but Curie does not operate hosted EDI routing. Source: [[fhir-payer-api-readiness-edi-replacement-timeline]]. |
| Replacing or operating a clearinghouse | Curie is a *protocol*, not a hosted intermediary. Cliqueue never operates EDI translation as a service. In bilateral mode, Curie reduces clearinghouse dependence by enabling direct provider-payer settlement; in provider-only mode, the existing clearinghouse rail is untouched. Source: [[caqh-core-scope-and-payer-exclusivity-onboarding]]. |
| FHIR Claim/ClaimResponse submission API | Curie does not assume production FHIR claim submission availability at any major US payer. EDI 837 is durable through ≥2027–2028. The one FHIR surface Curie integrates with is the **CRD Coverage Requirements Discovery** API (CDS Hooks) — Curie will integrate with Da Vinci CRD/PAS-aligned prior authorization workflows where payer APIs support them under CMS-0057-F. |
| Outcompeting Fathom / CodaMetrix / Nym on coding accuracy | AI coding vendors report 90–98% accuracy figures in radiology and ED benchmarks; these vary significantly by specialty, claim complexity, and evaluation methodology. The exact breakdown per specialty and vendor remains under-researched for behavioral health. Curie *consumes* their output via the coder-pluggable interface, or ships its own coder backed by the proprietary knowledge graph for specialties they don't serve well — like behavioral health. |
| Putting PHI on-chain or in any cliqueue-hosted service | Hard rule. HMAC-keyed hashes, lifecycle state, agent addresses, and settlement amounts only. The Curie Agent runs in the provider's environment; the MCP server receives only non-identifying coding ontology queries; patient-specific bundles are resolved locally. Source: [[hipaa-blockchain-hash-anchoring]]. |
| Medicare Advantage risk-adjustment auto-coding | Active DOJ enforcement against AI vendors. Phase 1 hard-blocks via `blockedPayerIds`. Source: [[medicare-advantage-ma-exclusion-gate-phase1-scope]]. |
| Real-time autonomous inpatient DRG coding | AHIMA + payer contracts (Humana, Cigna) require credentialed-coder human attestation. Phase 1 is outpatient-only; inpatient flows are gated by ERC-5484 SBT-bound human attestor sign-off. Source: [[inpatient-drg-human-attestor-architecture]], [[ahima-aapc-ai-coding-certification-oversight-requirements]]. |

---

## 3. History of the problem (brief)

A deeper treatment with citations lives in [[MARKET]] (forthcoming). The condensed timeline:

| Year | Event |
|---|---|
| 1996 | HIPAA enacted; Administrative Simplification mandates standardized electronic claims (X12 837/835 family). |
| 2003 | Final HIPAA EDI Rule (45 CFR 162) makes X12 837/835 the only HHS-recognized electronic claim formats. Clearinghouses consolidate as the de facto rail. |
| 2008 | Mental Health Parity and Addiction Equity Act (MHPAEA) passed — establishes parity requirement; enforcement weak through 2024. |
| 2014 | CAQH CORE Phase III EFT/ERA operating rules become mandatory under PPACA § 1104; permits direct-payer connections alongside clearinghouses. |
| 2020–2023 | AI medical coding hits commercial viability: Fathom, CodaMetrix, AKASA, Nym Health reach >90% radiology/ED autonomy. Behavioral health remains underserved. |
| 2024-02 | Change Healthcare ransomware breach (BlackCat/ALPHV). ~192.7M records exposed; industry reporting indicates a large fraction (~50%) of US claims disrupted for weeks. |
| 2024 | CMS-0057-F finalized; five mandatory FHIR APIs (Patient Access, Provider Access, Provider Directory, Payer-to-Payer, Prior Authorization) for MA/Medicaid/CHIP/QHP, effective January 1, 2027. **Does not include claim submission.** |
| 2024 | MHPAEA final rule strengthens parity enforcement; behavioral health denial scrutiny escalates. |
| 2025-Q2 | Humana / Cigna update commercial contracts requiring credentialed-coder attestation for AI-coded claims. |
| 2025-07 | GENIUS Act signed; defines Permitted Payment Stablecoin Issuer (PPSI). DASP prohibition effective July 18, 2028. |
| 2026-02 | OIG releases MA Industry Compliance Program Guidance demanding "more than formality" human review of AI-coded MA diagnoses. |
| 2026-04 | Somnia Network launches first-party native Agents framework (chain ID 5031 mainnet); rebrands as "Agentic L1." Source: [[native-agents-vs-agent-kit]]. |
| 2026-05 | Curie Claims Protocol direction adopted; this PRD. |

---

## 4. Stakeholders

| Stakeholder | What they own | What they care about |
|---|---|---|
| Small behavioral health practice owner (primary MVP-1 target) | Whole-practice operations: clinical care + billing + compliance | Survive on cash flow; reduce parity-denial frequency; get hours back from billing work |
| Provider's office manager / part-time biller | Day-to-day claim submission and denial follow-up | Less manual posting; fewer phone calls to payers; appeal evidence that doesn't get lost |
| Provider's hosting / IT (often a single contractor) | The Curie Agent's local deployment | Simple installation; minimal ongoing operational burden; clear update path |
| Behavioral health credentialed coder (where one exists) | Outsourced coding contract or in-house coding | Credential SBT lifecycle; clean audit of every claim they signed |
| Payer adjudication operations (behavioral health carve-out: Optum, Carelon, Magellan, regional MCOs) | Claim review, parity compliance, appeal queue | On-chain settlement events that flow into existing 835 generators; automated dispute notification |
| Payer compliance (parity / MHPAEA) | Parity attestations to DOL / state insurance commissioners | Audit trail demonstrating non-discriminatory adjudication |
| Hospital privacy officer / HIPAA compliance (Phase 2 FQHC + safety-net pilots) | BAA portfolio, breach risk, Security Rule controls | PHI never leaves provider environment; cliqueue is not in BA chain |
| CMS / OCR / OIG / DOJ | Interoperability rulemaking, HIPAA enforcement, FCA enforcement | No PHI-on-chain incidents; human-in-the-loop where required; MA exclusion enforced |
| AHIMA / AAPC | Coder credentialing | Credential verification API access; coder labor protected from full auto-replacement |
| Somnia Foundation / Improbable | Chain operation, native Agents | Healthcare adoption metric; GENIUS Act DLP exclusion; Bridged USDC Standard adoption |
| Circle / Frax / Stargate | Stablecoin issuance | Native vs bridged USDC on Somnia; PPSI track |
| Patients (indirect) | Their PHI | Typically do not see Curie in current product design; any patient-facing implications (payment, appeals, privacy notices) require separate analysis. |

---

## 5. Personas

### 5.1 Mia — Owner, small private behavioral health / ADHD outpatient practice (PRIMARY MVP-1 PERSONA)

> *Persona name placeholder; can be replaced with the actual interview contact's name or a different fictionalization at the founder's discretion.*

- **Background**: Licensed clinical psychologist or psychiatric NP, ~8 years in practice, runs a 1–3 provider practice serving ADHD evaluation, medication management, and ongoing therapy. ICD-10 claim mix is heavily F-codes (F90.x ADHD, F32.x depression, F41.x anxiety, F84.x autism spectrum, plus Z-codes for screening). Mix of in-network and cash-pay; in-network is roughly half her revenue and most of her billing pain.
- **Current stack**: TherapyNotes or SimplePractice as the PM/EHR; either submits 837s through their integrated clearinghouse or pays a part-time biller (~$200–500/month or 5–8% of collections) to handle submission, denials, and posting.
- **Goals**: Stay in network without going under; reduce time spent on billing from ~10 hours/week to <2; appeal parity denials more effectively; eventually drop the per-biller cost entirely.
- **Frustrations**: Optum (or Carelon, or Magellan) denying claims for "lack of medical necessity" on routine medication management; "session limit exceeded" denials that violate MHPAEA parity but require expensive appeals to overturn; 30–60 day AR aging on disputed claims; no shared audit trail when she appeals.
- **What success looks like in Year 1 with Curie**: Coding-attributable denials drop ≥25% on her behavioral health claim mix; parity-violation denials get auto-appealed with a chain-anchored evidence packet; weekly billing time drops by half; she keeps the part-time biller for now but uses the saved hours for clinical care or growth.
- **What she will reject**: anything that asks her to learn cryptocurrency, hold tokens, or operate infrastructure she doesn't already understand. Anything that creates a HIPAA or PHI risk her malpractice insurer won't underwrite.
- **Mode fit**: In provider-only mode, Curie delivers immediate value (coding QA, audit timeline, appeal packets) without requiring her payer's permission. She graduates to bilateral protocol mode only after her payer also adopts the Curie payer agent — at which point she gains automated settlement and 835 generation.

### 5.2 Henry — Adjudication operations manager at a behavioral health specialty payer (Optum Behavioral / Carelon / Magellan, or a regional MCO with BH carve-out)

- **Background**: 15 years in behavioral health claims adjudication; reports to VP Operations. Owns the adjudication SLA and the appeals queue.
- **Goals**: Process clean claims on time; reduce reopened appeals that escalate to state insurance commissioners or DOL parity complaints.
- **Frustrations**: Provider parity disputes that show up by paper appeal weeks after adjudication; no machine-readable signal that a provider is contesting a denial; rising MHPAEA enforcement risk under the 2024 final rule.
- **Success metric**: Subscribe to `ClaimDisputed` events on a per-payer WebSocket filter; automated case creation in the adjudication system; settle-or-uphold within the dispute window with documented parity analysis.
- **What he will reject**: any system that requires his back-office to operate a Somnia node, hold stablecoin, or learn Solidity. The Curie payer-agent must be turnkey — install, configure, integrate with the existing 835 generator.

### 5.3 Priya — Credentialed coder (CCS or CPC-A behavioral health specialist), part-time contractor to small BH practices

- **Background**: AHIMA-credentialed, services ~10 small BH practices part-time. Codes a few hundred claims per week across her clients.
- **Goals**: Sign only what she has reviewed; never have a stale credential generate a fraudulent attestation in her name; build a reputation for clean audit trails.
- **Frustrations**: Tools that auto-sign on her behalf; AI vendors that bury her in a coder-validation loop without giving her actual override authority; opaque attestation logs.
- **Success metric**: Her SBT expiry forces a monthly Primary Source Verification (PSV) pass; she can `renounceAttestorRole` permissionlessly when she steps off a client account; the 7-day pre-expiry warning event triggers her renewal workflow without manual tracking. Source: [[sbt-credential-expiry-enforcement]], [[human-attestor-credential-representation]].

### 5.4 Marcus — Hospital privacy officer (Phase 2 FQHC + safety-net pilots: Eskenazi, Riley, similar)

- **Background**: JD + CHPC. Owns the BAA register, the HIPAA risk assessment, and the OCR audit prep at a safety-net or large institutional pilot.
- **Goals**: Zero PHI breach incidents; defensible architecture diagram for any new on-chain data flow; cliqueue out of the BA chain.
- **Frustrations**: Vendor proposals that hand-wave "we don't store PHI" without an architecture diagram showing where PHI actually goes.
- **Success metric**: Architecture documentation showing the Curie Agent runs in the provider's environment; outside-counsel Non-PHI Determination Memo covering the MCP server scope; cliqueue's hosted services receive only concept queries, never PHI.

### 5.5 Sarah — Hackathon judge (MVP-0 only)

- **Background**: Mix of healthcare, blockchain, and infrastructure experience. Sees ~30 hackathon projects in a day.
- **Success metric (60-second skim of the demo)**: PHI-off-chain split visible on screen; Somnia transaction links; clean negotiation timeline between provider agent and payer agent; F-code behavioral health example grounds the demo in a real underserved segment.
- **What she will reject**: PHI-on-chain mistakes, REST APIs masquerading as agents, blockchain used as a database, or a pitch that's mostly slogans.

---

## 6. Technologies

The authoritative tech-stack source is [[AGENTS]]. This section maps each technology to its role and to the research files motivating the choice.

> **⚠️ Volatile facts warning**: The Somnia network specs, token addresses, and vendor uptime figures below are current as of PRD publication but are subject to change. See [[AGENTS]] for the live tech-stack source of truth and Appendix A (§13) for a quarantined reference of chain-specific factoids that may become stale.

### 6.1 Blockchain layer

| Tech | Role | Research source |
|---|---|---|
| **Somnia mainnet** (chain ID 5031) | Settlement, audit anchor, agent consensus | BFT finality, sub-second blocks, high throughput — see Appendix A (§13) for current measured specs |
| **Somnia native Agents** (launched April 2026) | LLM Inference consensus oracle for ICD-10 commitment validation | [[native-agents-vs-agent-kit]] — first-party; see Appendix A (§13) for current API and pricing |
| **Paris-level EVM** (`evmVersion: "paris"`) | Bytecode-safety floor | [[evm-hardfork-level-paris-and-canary-tests]] — TLOAD/TSTORE/MCOPY/PUSH0 forbidden until canary passes |
| **OpenZeppelin v5** contracts | Access control, proxy, timelock | Paris-compatible; matches Somnia EVM level |
| **Transparent proxy + `TimelockController`** | Upgradeability + governance latency | [[transparent-proxy-proxyadmin-timelock-deployment]] |
| **`immutable MIN_DELAY_FLOOR = 48h`** | Rug-pull protection | [[timelock-min-delay-immutable-vs-mutable]] |
| **ERC-5484 SBT** | Credentialed coder attestation for inpatient (Phase 2) and gating for high-confidence outpatient | [[human-attestor-credential-representation]], [[sbt-credential-expiry-enforcement]] |
| **ERC-7201 namespaced storage** | Storage-collision safety on upgrades | Under research |

### 6.2 Agent + intelligence layer

| Tech | Role | Research source |
|---|---|---|
| **TypeScript** | All application code | [[AGENTS]] — language constraint |
| **Curie Agent** (cliqueue-published TypeScript package or container) | Runs in provider's environment; processes PHI locally; never sends notes off-environment | This PRD §7.2 |
| **Somnia native Agents** (via `createAdvancedRequest` or equivalent) | Consensus oracle for code-commitment validation | Subcommittee size 3 or 5; LLM Inference 0.07 SOMI/agent |
| **MCP server** (cliqueue-hosted, public-with-authn) | ICD-10 knowledge-graph lookup; receives only concept queries | This PRD §7.2, §7.4 |
| **Coder-pluggable interface** | Provider brings their own AI coder (Fathom, CodaMetrix, Nym, Symphony) or uses Curie's bundled coder | Public spec; first-class architectural commitment |
| **PHI de-identification library** (Microsoft Presidio, AWS Comprehend Medical, or equivalent) | Reference implementation for the rare cases features need transformation | External; not built by cliqueue |
| **CRD CDS Hooks client** (e.g., `@cds-hooks/client`) | Pre-submission prior-auth check against payer FHIR APIs where supported (Da Vinci CRD/PAS-aligned; CMS-0057-F PA API mandate applies to covered payers by Jan 2027, but integration is best-effort where payer APIs exist) | [[cms-0057f-prior-auth-api-presubmission-integration]] |
| **ethers v6 WebSocketProvider** | Event subscription with manual reconnect loop | Does NOT auto-resubscribe; reconnect+backfill mandatory |
| **Event queue** (Kafka, NATS, or Redis Streams — provider's choice) | Trigger delivery to the local Curie Agent; integration with provider's PM/EHR system | Architecture pattern, §7.3 |

### 6.3 Knowledge graph layer

| Tech                                                                                     | Role                                                                                                          | Research source                                               |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Postgres + pgvector** (hosted on Neon, Supabase, Railway, or Fly.io — choice deferred) | ICD-10-CM (73,924 codes) + ICD-10-PCS (78,887 codes) catalog with embeddings                                  | Hosting options compared in this PRD §7.4                     |
| **Graph extension** (Apache AGE or `pg_graph`)                                           | Hierarchical relationships (parent-child, Excludes1/2, Code-first, Use-additional)                            | Architecture decision pending                                 |
| **Embedding model** (modern 1536-dim or similar)                                         | One vector per code for semantic similarity                                                                   | Vendor TBD; ~470MB total vector data                          |
| **Curated supplementary findings layer**                                                 | cliqueue-curated metadata enriching the public ICD-10 catalog                                                 | **IP-protected**; the proprietary value-add                   |
| **MVP-0 scope**                                                                          | F-chapter (mental, behavioral, neurodevelopmental disorders, ~700 codes) + common Z-codes + comorbidity links | Behavioral health wedge scope; full ICD-10 ingested over time |
| **Versioning**                                                                           | Annual ICD-10 update cycle (October 1 effective date)                                                         | [[knowledge-graph-versioning]]                                |

### 6.4 Settlement layer

| Tech | Role | Research source |
|---|---|---|
| **USDC.e on Somnia** (Stargate-bridged; current address in Appendix A §13) | MVP-0/1 settlement token | The only defensible choice for MVP given USDso lacks PPSI status |
| **Stablecoin address governance** | 48h immutable timelock floor + 3-of-5 multisig | [[timelock-min-delay-immutable-vs-mutable]] |
| **EIP-4337 session keys / paymasters** (post-MVP-0) | Low-friction payer onboarding — *open research:* email-link wallets raise security/compliance concerns for payer institutions; enterprise key management (e.g., HSM-backed multisig, cloud KMS) is the more likely path for payer onboarding. Somnia 4337 support TBD. |

### 6.5 Integration adapters (public submodule)

| Tech | Role | Research source |
|---|---|---|
| **EDI 837/835 adapter library** | Provider PM systems emitting 837 → Curie `ClaimBundle`; payer 835 generators served from Curie events | [[on-chain-claim-struct-835-interoperability]] |
| **CRD CDS Hooks integration** | Pre-submission prior-auth check (Da Vinci CRD/PAS-aligned, where payer APIs support them under CMS-0057-F) | [[cms-0057f-prior-auth-api-presubmission-integration]] |
| **Ormi subgraph** | Indexed read path for batch queries | Uptime and latency specs in Appendix A (§13) |

---

## 7. Architecture

### 7.1 Repository structure

The IP strategy is **public protocol, private intelligence**. The repo layout reflects it:

```
cliqueue-coding-blockchain/                  [PRIVATE — this repo]
├── docs/                                    Specs, research, this PRD
├── CLAUDE.md, AGENTS.md                     Working philosophy + tech-stack constraints
│
├── submodule: knowledge-graph-curation/     [PRIVATE submodule]
│   ├── ICD-10 ingestion pipeline (referenced from founder's existing repo)
│   ├── Embedding generation
│   ├── Hierarchy + relationship graph builder
│   ├── Curated supplementary findings (IP-protected)
│   └── Internal MCP / REST tooling for curation workflow
│
└── submodule: curie-protocol/               [PUBLIC submodule]
    ├── contracts/                           Solidity (ClaimsAdjudicator, SBTRegistry, etc.)
    ├── agents/                              Provider agent, payer agent (TypeScript)
    ├── mcp-client/                          MCP client library (how to call the MCP server)
    ├── edi-adapter/                         EDI 837/835 translation library
    ├── demo-ui/                             Next.js demo console
    └── examples/                            Behavioral health example flows
```

Plus a **hosted MCP server** that:
- Is publicly *reachable* with API-key / session-token gated access
- Is sourced from a private codebase (not in either submodule)
- Owns the proprietary knowledge graph access path
- Receives only concept queries — never clinical notes, never PHI

The principle: **the protocol is open; the intelligence is closed.** Judges respect this framing if stated explicitly.

### 7.2 PHI flow

This is the load-bearing compliance architecture. **PHI never leaves the provider's environment. Patient-specific feature bundles are resolved locally; the MCP server receives only non-identifying coding ontology queries.**

```
┌────────────────────────────────────────────────────────────────────┐
│ Provider's environment (their server / VPC / on-prem)              │
│                                                                    │
│  ┌──────────────┐    ┌───────────────────────────────────────┐    │
│  │  EHR / PM    │    │  Curie Agent (TypeScript)             │    │
│  │  (Tebra /    │───▶│  - Event subscriber (Kafka/NATS)      │    │
│  │  TherapyNotes│    │  - Local clinical-note processing     │    │
│  │  /  Valant)  │    │    (PHI never leaves this box)        │    │
│  └──────────────┘    │  - Local feature/concept extraction   │    │
│                      │  - Query MCP for code candidates      │    │
│                      │  - Local code-selection decision      │    │
│                      │  - HMAC bundling with provider-held key   │    │
│                      │  - Signed tx to Somnia                │    │
│                      └────────────┬──────────────────────────┘    │
│                                   │                                │
│                                   │ Non-identifying coding       │
│                                   │ ontology queries ONLY         │
│                                   │ (no clinical notes, no        │
│                                   │  patient-specific features)   │
│                                   ▼                                │
└───────────────────────────────────┼────────────────────────────────┘
                                    │
        ┌───────────────────────────┴────────────────────────────┐
        │                                                         │
        ▼                                                         ▼
┌────────────────────────┐                       ┌────────────────────────┐
│ Cliqueue-hosted MCP    │                       │ Somnia mainnet         │
│ - Authn-gated          │                       │ - ClaimsAdjudicator    │
│ - Receives only        │                       │ - SBTRegistry          │
│   non-identifying      │                       │ - Native Agents        │
│   coding ontology      │                       │ - Receives: HMAC hashes│
│   queries              │                       │   code commitments,    │
│ - Returns ranked       │                       │   settlement amounts   │
│   ICD-10 candidates    │                       │ - NEVER receives PHI   │
│ - Backed by Knowledge  │                       └────────────────────────┘
│   Graph (Neon/Postgres)│
│ - NEVER receives PHI   │
└────────────────────────┘
```

Key invariants:

- **The MCP server is designed to receive only non-identifying coding ontology queries**. The request schema accepts structured queries for code candidates (e.g., "ICD-10 candidates for ADHD predominantly inattentive type") and rejects free-text clinical notes by validation. Patient-specific concept bundles (e.g., "adult patient, ADHD predominantly inattentive, comorbid generalized anxiety") are resolved locally inside the Curie Agent and never transmitted to cliqueue-hosted infrastructure.
- **The Curie Agent runs entirely in the provider's environment**. Cliqueue distributes it (as a container or package) but does not operate it. This keeps cliqueue out of the HIPAA Business Associate chain at the agent layer.
- **Somnia receives only HMAC-keyed hashes**. Plain SHA-256 of EDI content is unsafe (re-identification risk); HMAC-SHA256 with a provider-held key satisfies §164.514 Expert Determination — per [[hipaa-blockchain-hash-anchoring]].
- **De-identification libraries** (Presidio, AWS Comprehend Medical, NIH tools) are referenced for any edge case where features might need transformation — but the architecture is designed so PHI doesn't leave the environment in the first place, making de-identification a backup rather than a primary control.

### 7.3 Agent flow

The protocol is event-driven end-to-end. Cliqueue's design ships a reference Kafka/NATS topic schema; providers and payers can use any compatible event bus.

```
1.  Provider's EHR emits "claim ready" event → provider-local topic
2.  Curie Agent (provider) subscribes → receives trigger
3.  Curie Agent processes clinical note locally → extracts concepts
4.  Curie Agent → MCP server: concept query → receives ranked code candidates
5.  Curie Agent → local AI coder (Fathom / Symphony / bundled) → final code selection
6.  Curie Agent → HMAC bundles claim → signed tx to Somnia
        → emits ClaimSubmitted event on-chain
7.  Curie Agent (payer side) subscribes to ClaimSubmitted via WebSocket
        → receives trigger for their internal adjudication workflow
8.  Payer agent processes via their policy engine
        → signed tx to Somnia: ClaimAdjudicated / EvidenceRequested / ClaimDisputed
9.  Negotiation loop continues until ClaimAgreed
10. Settlement: USDC.e transfer triggered by ClaimSettled state transition
        → 835 adapter (payer-local) generates a synthetic 835 for AR posting
```

Eight-state machine with attestation as event/flag: `Submitted → EvidenceRequested → Adjudicated → Accepted | Disputed → Settled | Denied | Withdrawn | Replaced`. Attestation is modeled as a parallel event/flag on the claim record rather than a required lifecycle state. Source: [[conditional-fund-release-state-machine]], [[on-chain-claim-struct-835-interoperability]].

### 7.4 Knowledge graph curation pipeline

The private submodule owns the curation workflow:

1. **Ingestion**: pull the latest CMS-published ICD-10-CM and ICD-10-PCS catalogs (October 1 annual effective date) from the CMS GitHub or NCHS canonical source.
2. **Hierarchy extraction**: parse parent-child relationships, Excludes1/Excludes2 cross-references, "Code first" / "Use additional code" annotations.
3. **Embedding generation**: produce one vector per code using a modern embedding model.
4. **Graph build**: load into Postgres (Neon Launch tier or equivalent) with pgvector + a graph extension (Apache AGE or `pg_graph`) — edges represent hierarchy and cross-references.
5. **Curated findings layer**: cliqueue-curated supplementary metadata — example notes, common documentation patterns, behavioral-health-specific coding tips, MHPAEA-parity-relevant flags. **This is the IP.**
6. **Versioning**: every annual ICD-10 update produces a new graph version. Provider-side agents pin to a specific graph version; cliqueue maintains backward compatibility for at least one prior version. Source: [[knowledge-graph-versioning]].
7. **MVP-0 scope**: F-chapter + common Z-codes + comorbidity links (~1,500 codes total). Full ICD-10 ingested over MVP-1 / MVP-2.

The MCP server is the only consumer of the knowledge graph at query time. Agents do not touch the graph directly.

---

## 8. System requirements

### 8.1 Functional

| ID | Requirement | MVP-0 | MVP-1 | MVP-2 |
|---|---|---|---|---|
| F1 | `ClaimsAdjudicator` deployed on Somnia with 8-state machine (attestation as event/flag) | ✅ | ✅ | ✅ |
| F2 | Provider agent emits `ClaimSubmitted` with HMAC-keyed `claimId` | ✅ | ✅ | ✅ |
| F3 | Payer agent reads events, responds with adjudication | ✅ | ✅ | ✅ |
| F4 | Demo UI showing live event timeline + privacy split | ✅ | ✅ | ✅ |
| F5 | MCP server backed by F-chapter knowledge graph (MVP-0 scope) | ✅ | ✅ | ✅ |
| F6 | Coder-pluggable interface (spec + reference implementation) | ✅ | ✅ | ✅ |
| F7 | Stub-token settlement on Somnia (mock ERC-20) | ✅ | — | — |
| F8 | Behavioral health example flows (3 demo cases: clean approval, parity-denial appeal, evidence-request resolution) | ✅ | ✅ | ✅ |
| F9 | Curie Agent distributed as container/package (provider runs locally) | — | ✅ | ✅ |
| F10 | USDC.e settlement with timelock-gated stablecoin address | — | ✅ | ✅ |
| F11 | EDI 837 ingest + 835 generation (adapter library) | — | ✅ | ✅ |
| F12 | CRD CDS Hooks pre-submission PA check | — | ✅ | ✅ |
| F13 | `ClaimBatchSettled` with `NETWORK_BATCH_FLOOR = 11` (re-identification mitigation) | — | ✅ | ✅ |
| F14 | Claim replacement chain (`parentClaimId` / `replacedByClaimId`) | — | ✅ | ✅ |
| F15 | `SBTRegistry` for credentialed coder attestation (inpatient + high-confidence outpatient) | — | ✅ | ✅ |
| F16 | Full ICD-10-CM + ICD-10-PCS catalog ingested | — | ✅ | ✅ |
| F17 | EIP-4337 session-key payer onboarding | — | — | ✅ |
| F18 | SOMI price circuit breaker (off-chain agent) | — | — | ✅ |
| F19 | Dual-BA (cliqueue ↔ payer) integration path | — | — | ✅ |
| F20 | FQHC / safety-net pilot (Eskenazi, Riley exploratory) | — | — | ✅ |

### 8.2 Non-functional

| ID | Requirement | Target |
|---|---|---|
| N1 | PHI on-chain | Zero. Hard rule. |
| N2 | PHI in cliqueue-hosted infrastructure | Zero. The MCP server is designed to receive only non-identifying coding ontology queries; patient-specific bundles never leave the provider environment. |
| N3 | Per-claim cost ceiling | ≤ $0.50 (sub=5 LLM Inference); circuit-break to sub=3 above ceiling. Source: [[somi-price-circuit-breaker-oracle-architecture]] |
| N4 | Per-claim baseline cost | $0.054–$0.095 at spot SOMI. Source: [[per-claim-gas-economics-llm-inference-cost]] |
| N5 | Demo-mode end-to-end latency | ≤ 90 s — coder runs off-chain pre-submission; on-chain agent call is async non-blocking attestation. Source: [[llm-inference-callback-latency-and-timeout]] |
| N6 | Production outpatient settlement latency | p50 ≤ 5 min, p95 ≤ 30 min |
| N7 | Re-identification risk threshold | Batch settlements only when `n ≥ 11` (CMS Physician PUF standard). Source: [[adjudicated-cents-on-chain-emission-risk]] |
| N8 | Stablecoin governance latency | ≥ 48 hours immutable floor |
| N9 | Pre-deployment canary tests | Paris-level opcodes, topic[1] filter, `ecPairing` 0x08. Source: [[evm-hardfork-level-paris-and-canary-tests]] |
| N10 | MCP server uptime (MVP-1) | 99.5% (single region acceptable for pilot) |

### 8.3 Compliance

| ID | Requirement | Source |
|---|---|---|
| C1 | HIPAA Privacy Rule §164.514 expert determination report covering on-chain data model | Required for MVP-1 pilot |
| C2 | HIPAA Safe Harbor / §164.514(b)(2) — referenced but not the primary control (PHI doesn't leave the provider environment) | This PRD §7.2 |
| C3 | MHPAEA 2024 final rule — parity disputes are a featured Curie use case, not a compliance burden | Behavioral health wedge framing |
| C4 | Phase 1 Medicare Advantage risk-adjustment exclusion via `blockedPayerIds` | [[medicare-advantage-ma-exclusion-gate-phase1-scope]] |
| C5 | GENIUS Act non-DASP determination — working position pending outside-counsel memo | [[genius-act-dasp-smart-contract-scope]] |
| C6 | The Joint Commission monthly PSV for credentialed coders (Phase 2 inpatient flows) | [[sbt-credential-expiry-enforcement]] |
| C7 | OIG MA ICPG "more than formality" human review | [[inpatient-drg-human-attestor-architecture]] |
| C8 | Non-PHI Determination Memo for the MCP server (outside-counsel-reviewed) | This PRD §7.2 |
| C9 | SOC 2 Type II audit | Year 2 enterprise-readiness investment; not blocking MVP-0/1 |

---

## 9. Considerations

### 9.1 Regulatory ambiguity (live)

- **GENIUS Act DASP scope**: smart contracts are almost certainly excluded via the "person" requirement + DLP exclusion + "for compensation or profit" filter. **Working position, pending outside-counsel memo.** Governance multisig holders sit in residual ambiguity until the Treasury Section 9 DeFi study clarifies. MVP-1 deploys at Position A (3-of-5 multisig + 48h timelock); MVP-2 escalates to Position B (4-of-7 + 7-day delay) at $10M TVL; Position C (ProxyAdmin renounce) sits in the playbook as a backstop. Source: [[genius-act-dasp-smart-contract-scope]].
- **OIG MA ICPG human-in-the-loop standard** may extend to fee-for-service in a future GCPG update. Architecture flexibility: the `attestationRequired` mapping is governance-controlled, so outpatient claims can be flipped to attestation-required without a contract upgrade. Source: [[claimtype-attestation-governance-immutable-vs-timelock]].
- **MHPAEA enforcement under the 2024 final rule**: Curie's appeals-timeline value proposition becomes stronger as enforcement tightens. Open research question on the enforcement trajectory.

### 9.2 Bootstrap strategy — two product modes

The two-sided network problem (providers need payers; payers need providers) is **the** make-or-break design question. Avaneer Health (Aetna + Anthem + Cleveland Clinic permissioned blockchain consortium) dissolved in 2023 after failing to bootstrap simultaneous adoption. Source: [[edi-837-835-flow-and-blockchain-adjudication]].

Curie addresses this by defining two explicit product modes:

- **Provider-only mode** (no payer required): coding QA, pre-submission CRD prior-auth checks, tamper-evident audit timeline, and automated appeal packet generation. Provides immediate value to a practice even when no payer runs the Curie payer agent.
- **Bilateral protocol mode** (payer required): full adjudication negotiation, settlement in stablecoin, and 835 generation. Both sides must participate.

Curie's bootstrap strategy uses the provider-only mode as an entry wedge, then converts practices to bilateral as payers onboard:

- **MVP-0 (hackathon)**: Strategy 4 — Curie operates both provider and payer agents against synthetic behavioral health claim data. Judges see the full protocol working end-to-end.
- **MVP-1**: Strategy 1 + Strategy 3 hybrid:
  - **Strategy 1** — pursue a real small behavioral health specialty payer pilot (Beacon/Carelon, Magellan, or a regional Medicaid MCO with BH carve-out) alongside the provider pilot. EIP-4337 session keys remove the "you need SOMI to participate" barrier.
  - **Strategy 3** — payer-agnostic auxiliary services that work without payer adoption: pre-submission CRD prior-auth check, on-chain attestation of coder sign-off, immutable parity-dispute timeline. Provides Curie value even when only the provider is on the network.
- **MVP-2 onward**: continue Strategy 1 + 3 hybrid; expand to FQHC + safety-net pilots (Eskenazi, Riley).
- **Permanently rejected**: Strategy 2 (wrap the existing clearinghouse). Curie is a protocol, not a hosted intermediary, and does not operate EDI routing.

### 9.3 Architectural risks

- **Cold-SLOAD surcharge** (1M gas) on Somnia for slots that have aged out of the 128M LRU cache. Mitigation: Claim records carry only 7 slots; dispute resolution uses explicit dispute storage architecture (separate-contract vs ERC-7201 namespaced — open research). Source: [[claim-struct-packing-cold-sload-dispute-architecture]].
- **`somnia-agent-kit` is testnet-only / community-built.** Production code uses native `createAdvancedRequest` directly. The kit is acceptable only as a convenience wrapper for MVP-0 if it accelerates the demo. Source: [[native-agents-vs-agent-kit]].
- **WebSocket connection affinity**: Somnia's load-balanced WSS does not preserve `eth_subscribe` state across backends. The Curie Agent's reconnect loop must use `eth_getLogs` backfill from a local block checkpoint.
- **15-minute default LLM Inference timeout** incompatible with the 90-second demo. MVP-0 pre-runs the coding agent off-chain; on-chain consensus is async non-blocking attestation. Source: [[llm-inference-callback-latency-and-timeout]].

### 9.4 IP strategy

- **Public protocol** (smart contracts, agent source, MCP client, EDI adapter, demo UI) — open for hackathon judging, partner integration, and ecosystem trust.
- **Private knowledge graph + curation pipeline** — the competitive moat. ICD-10 ingestion, embeddings, hierarchy graph, and the curated supplementary findings layer.
- **Private MCP server implementation** — sourced from a separate codebase; deployed publicly with authn/authz at the edge.
- **The Curie Agent** is published as an installable artifact (container or package) but is open source so providers can audit what runs in their environment. The intelligence inside the agent that *isn't* algorithmic — the curated retrieval the MCP returns — remains private behind the MCP boundary.

### 9.5 Operational dependencies

- **Knowledge graph hosting**: Neon, Supabase, Railway, or Fly.io. Decision deferred; Neon's serverless auto-pause is the strongest fit for hackathon-stage usage at near-zero cost.
- **MCP server hosting**: Fly.io, Railway, or AWS Fargate. Cost estimate $0–50/month through MVP-1.
- **SOMI reserve**: provider-held; cliqueue publishes a Reserve Exhibit. Source: [[somi-reserve-holding-architecture-compliance]], [[somi-price-circuit-breaker-oracle-architecture]].
- **Somnia Foundation engagement** for Bridged USDC Standard adoption. Not blocking MVP-0/1 but should be initiated in parallel.
- **Provider-held HMAC key** is a single point of compromise. HSM-grade storage required; recovery procedure is an open research question.
- **Behavioral health payer pilot**: Beacon Health Options (now Carelon), Magellan Health, Optum Behavioral, or a regional Medicaid MCO with a BH carve-out. Outreach to be initiated post-MVP-0.

### 9.6 Settlement failure and reversals

> **Open design area.** The following risks are identified but not yet fully specified in the protocol. Each is flagged as a pre-MVP-1 design requirement.

| Risk | Description | Mitigation path |
|---|---|---|
| **Failed settlement** | USDC.e transfer reverts (insufficient balance, allowance revoked, token paused) | `ClaimSettled` state should not be emitted until on-chain transfer confirms. Pre-confirmation `ClaimSettlementPending` intermediate state under consideration. |
| **Recoupment / clawback** | Payer discovers a paid claim was coded incorrectly or was a duplicate after settlement | On-chain dispute window after settlement; timelock-gated recoupment via `recoupClaim(claimId, reason)` with provider notification. Governance-controlled recoupment deadline. |
| **Refunds / overpayment recovery** | Provider owes payer (e.g., duplicate payment, member retro-disenrollment) | `RefundRequested` event; provider agent signs a refund transaction on-chain; funds flow back via the same USDC.e path. |
| **Reversals** | Adjudication decision reversed on appeal after settlement | `ClaimReopened` state transition that invalidates the prior settlement and restarts the negotiation loop. |
| **Escheatment** | Unclaimed settled funds (e.g., provider no longer operates) | Jurisdiction-dependent; state unclaimed-property laws may apply. Off-chain reconciliation required; on-chain idle-fund sweep with 12+ month governance delay. |
| **Sanctions screening** | OFAC / sanctions list match on settlement address | Pre-settlement address screening should be integrated into the payer agent workflow; on-chain OFAC blocklist (governance-updatable). |
| **Treasury management** | Curie needs working capital for settlement dispute resolution or bridging | SOP for stablecoin treasury operations, custody, and audit trail to be developed pre-MVP-1. |

These risks are not blocking MVP-0 (synthetic settlement with mock ERC-20). MVP-1 must address failed settlement, recoupment, and refunds before real USDC.e flows.

---

## 10. Success criteria

### 10.1 MVP-0 — Somnia Agentathon hackathon demo (4-week sprint)

**Core (must-ship):**
- One `ClaimsAdjudicator` contract deployed on Somnia with the 8-state machine.
- One synthetic behavioral health claim bundle (F-code subset) flowing through the full cycle.
- Mocked payer adjudication policy (simple rule-based agent, no real payer integration needed).
- MCP server live and serving non-identifying code-candidate queries against a tiny F-chapter subset (~50-100 codes).
- PHI-off-chain split visibly demonstrated in the UI.
- Explorer links for every on-chain transaction.
- 90-second live demo: three behavioral health claim cases (clean approval, parity-denial appeal, evidence-resolved settlement).
- Public submodule repo: README, architecture diagram, demo video, `.env.example`, contract addresses, tests pass, no secrets, no real PHI.
- Submission to Somnia Agentathon.

**Stretch (if time permits, explicitly labeled in demo):**
- Curie Agent packaged as container/package (F9).
- Full 8-state machine with EvidenceRequested and Replaced states exercised.
- More than one synthetic claim bundle shown.
- Coder-pluggable interface reference implementation connected.
- EDI 837/835 adapter library stubs.
- CRD CDS Hooks pre-submission check stubbed.

### 10.2 MVP-1 — First behavioral health pilot (timeline flexible)

- One signed pilot behavioral health practice using Curie for live in-network claim submission.
- One signed pilot small behavioral health payer (Carelon / Magellan / regional Medicaid MCO) operating the Curie payer agent.
- Curie Agent shipped as a container/package; provider runs it in their environment.
- USDC.e settlement live with TimelockController-gated address.
- EDI 837/835 adapter library functional for the pilot's PM system and payer.
- CRD CDS Hooks pre-submission PA check live for MA-commercial / Medicaid managed care payers.
- Outside-counsel GENIUS Act Non-DASP determination memo and Non-PHI Determination Memo in the pilot's procurement file.
- ≥25% reduction in parity-denial frequency for the pilot practice (rolling 90-day window).
- Full ICD-10-CM + ICD-10-PCS knowledge graph ingested (not just F-chapter).

### 10.3 MVP-2 — Multi-pilot, enterprise-credible (timeline flexible)

- Three live behavioral health practices, ideally across at least two states.
- One behavioral health payer + one regional Medicaid MCO live.
- EIP-4337 session-key payer onboarding shipped — new payers can join via email-link wallet in <30 minutes.
- Dual-BA structure (cliqueue ↔ at least one payer).
- Position B governance (4-of-7 + 7-day delay) deployed at $10M TVL.
- Annual CMS MA plan update procedure executed at least once.
- Exploratory conversations with Eskenazi Health and Riley Hospital re: Phase 3 safety-net / academic-medical-center pilots.

---

## 11. Open questions

These are the live items in [[research-questions]] most likely to affect PRD revisions:

| Q | Item | Status |
|---|---|---|
| Q1 | Dispute architecture: separate `ClaimsDisputeRegistry` contract vs. ERC-7201 namespaced internal | Pre-MVP-0 blocker — needs final synthesis |
| Q2 | `ecPairing` (0x08) canary on Somnia mainnet | MVP-2 ZK roadmap blocker |
| Q3 | Somnia Foundation adoption of Circle Bridged USDC Standard | Long external dependency; start engagement now |
| Q4 | Avaneer Health post-mortem | Pre-MVP-1 bootstrap-strategy informant |
| Q5 | Segment-specific TAM for behavioral health outpatient | Investor / strategy artifact |
| Q6 | Behavioral health denial economics (parity dispute share, appeal success rate, coding-addressable vs. authorization/eligibility/medical-necessity breakdown) | **Pre-MVP-1 blocker** — validates wedge sharpness; must segment aggregate denial numbers from coding-attributable denials, authorization denials, eligibility denials, documentation denials, and medical-necessity denials to determine how much of a small BH practice's burden is actually coding-addressable |
| Q7 | MHPAEA 2024 enforcement trajectory | Affects timeline of regulatory tailwind |
| Q8 | EIP-4337 session-key feasibility on Somnia | MVP-2 onboarding blocker |
| Q9 | Knowledge graph database cost at production scale | Hosting decision input |
| Q10 | MCP-server-out-of-BA-chain compliance posture | Non-PHI Determination Memo input |
| Q11 | HIPAA + SOC 2 compliance roadmap | Enterprise-readiness sequencing |
| Q12 | REST-vs-MCP architectural amendment (if customer-facing REST is wanted) | Spec-amendment candidate |
| Q13 | Behavioral health practice interview findings | See [[behavioral-health-interview-script]] |

---

## 12. Decision log

| Date | Decision | Source |
|---|---|---|
| 2026-05-15 | Project name = Curie Claims Protocol (cliqueue is the legal/product entity; Curie is the protocol — but the canonical name in docs is Curie). | [[ROADMAP]] |
| 2026-05-15 | Hackathon-shaped MVP-0; pilot-deployable scope deferred to MVP-1. | This PRD §10.1 |
| 2026-05-15 | USDC.e as MVP settlement token; USDso rejected for MVP. | Research consensus |
| 2026-05-16 | Phase 1 hard-blocks Medicare Advantage risk-adjustment claims. | [[medicare-advantage-ma-exclusion-gate-phase1-scope]] |
| 2026-05-16 | Hybrid attestation: `immutable INPATIENT_REQUIRES_ATTESTATION = true` + governed `mapping(uint8 => bool) attestationRequired`. | [[claimtype-attestation-governance-immutable-vs-timelock]] |
| 2026-05-17 | Behavioral health outpatient is the MVP-1 wedge specialty. | Conversation 2026-05-18 |
| 2026-05-17 | Coding agent is coder-pluggable; provider can bring their own (Fathom/CodaMetrix/Nym/Symphony). | Conversation 2026-05-18 |
| 2026-05-17 | MCP as primary external interface; REST acceptable for agent tooling and knowledge-base access, NOT for chain interactions. | Conversation 2026-05-18 |
| 2026-05-17 | Submodule architecture: this repo private; `knowledge-graph-curation` private submodule; `curie-protocol` public submodule; MCP server hosted with authn/authz. | Conversation 2026-05-18 |
| 2026-05-17 | PHI flow: Curie Agent runs in provider environment; MCP server receives only concept queries; PHI never leaves provider environment. | Conversation 2026-05-18 |
| 2026-05-17 | Bootstrap: Strategy 4 (MVP-0) + Strategy 1+3 hybrid (MVP-1+); Strategy 2 (clearinghouse wrap) permanently rejected. | Conversation 2026-05-18 |
| 2026-05-18 | This PRD replaces the 2024 capstone PRD at `docs/PRODUCT.md`. | This PRD §0 |
| 2026-05-19 | PRD revised per Thomas's feedback: PHI language tightened, two product modes defined, state machine reworked, legal certainty qualified, MVP-0 scoped ruthlessly, volatile chain facts quarantined to Appendix A. | This revision |

---

**See also** — this PRD is a superseded stub per [[../CLAUDE|CLAUDE.md]]; the active product framing lives in [[ROADMAP|ROADMAP]], and the supporting topic hubs are indexed at [[research/topics/README|topic-hub index]].

---

## 13. Appendix A: Volatile chain and vendor facts (quarantined)

> These facts are accurate as of PRD publication (2026-05-19) but may become stale. They are quarantined here rather than embedded in the main sections, which reference this appendix by `§13`. For the authoritative tech-stack source, see [[AGENTS]].

| Fact | Current value | Source / caveat |
|---|---|---|
| Somnia mainnet chain ID | 5031 | Somnia docs; stable identifier, unlikely to change |
| Somnia block time | ~100ms | Per Somnia RPC measurements; verify with current chain stats |
| Somnia sustained TPS | ~92 | Measured; may vary with network load |
| Somnia peak TPS | ~134K | Benchmark claim from Somnia Foundation; verify current published numbers |
| Somnia native Agents launch | April 2026 | Historical event; Stargate-bridged |
| Somnia native Agents pricing | 0.07 SOMI/agent per LLM Inference call | Current rate; subject to SOMI price fluctuations |
| USDC.e on Somnia address | `0x28BEc7E30E6faee657a03e19Bf1128AaD7632A00` | Stargate-bridged; verify on Somnia block explorer |
| Ormi subgraph uptime | 99.99% (measured) | Uptime as of publication; verify current status |
| Ormi subgraph latency | ~120ms lag | Measured; verify with Ormi dashboard |
| F-chapter code count | ~700 codes (ICD-10-CM F00–F99) | CMS catalog; stable across ICD-10 annual updates |
| Knowledge graph vector size | ~470MB for full ICD-10-CM (73,924 codes) | Estimated; depends on embedding dimension (currently 1536-dim target) |
| Knowledge graph hosting | Neon (serverless Postgres) choice deferred; serverless auto-pause preferred | Decision pending; see §7.4 |
| EIP-4337 on Somnia | Support TBD | Open research question as of publication |
