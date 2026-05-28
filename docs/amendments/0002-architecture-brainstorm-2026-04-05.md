# A-0002: Original Architecture Brainstorm (Historical)

> **Status:** Superseded by the Somnia chain-native pivot on 2026-05-14.
> **Kept as:** historical record of the pre-pivot ground-up rewrite design
> (ICD-10-parser project, Rust + AWS direction).
> **Current direction:** see [`AGENTS.md`](../../AGENTS.md) and [`CLAUDE.md`](../../CLAUDE.md).
> Decisions captured below (Comprehend Medical, Bedrock, Glue, Lambda on SQS,
> SeaORM, etc.) reflect the abandoned stack.

---

# Architecture Brainstorming Session — 2026-04-05

**Participants:** Thomas Pugh, Claude  
**Context:** Revisiting the ICD-10 parser architecture after Stage 2 prototype completion. The prototype proved the evolving key-value store concept with TypeScript + ChromaDB. This session explores a ground-up rewrite with a production-oriented stack.

---

## 1. Analysis of Current State

### What Exists Today

The prototype is a TypeScript CLI that demonstrates multi-facet vector retrieval over 15 ICD-10 codes using ChromaDB and a Python embedding server (MiniLM-L6-v2 via ONNX). It supports loading code manifests, querying with reciprocal rank fusion (RRF), inspecting keys, and adding coder-contributed synonyms. No database, no API, no UI, no deployment target.

### What IMPLEMENTATION_STATUS.md Does Well
- Clear phase tracking with completion status
- Honest about limitations (15 codes only, no eval, no persistence)
- Good metrics table with current vs target values
- Realistic risk assessment

### What IMPLEMENTATION_STATUS.md Is Missing
- **No technology stack decision matrix** — lists what exists but doesn't capture *why* choices were made or what alternatives were considered
- **No cost model** — no estimates for LLM API calls, hosting, or storage
- **No deployment architecture** — everything is local/CLI with no path to a running demo
- **No database schema documentation** — Postgres is mentioned in the architecture doc but never specified
- **The roadmap is stale** — still TypeScript/ChromaDB-centric; doesn't reflect the stack shift discussed here

### PHASE_1_TASKS.md Assessment
The task breakdown is well-structured with clear acceptance criteria, but:
- Entirely TypeScript-centric (file paths, test runner, etc.)
- Assumes external LLM APIs (OpenAI/Anthropic/Mistral) without accounting for Bedrock or Ollama
- No database tasks at all — entity extraction goes straight to in-memory structures
- The 28-hour estimate is reasonable for TypeScript but would need revisiting for Rust
- No distinction between prototype and production concerns

---

## 2. Technology Stack Decisions

### Decision: Rust for Backend

**Rationale:** Reliability over iteration speed. Rust gives type-safe, zero-cost abstractions for the data pipeline (parsing 72K ICD-10 codes, database operations, embedding orchestration). The trade-off is a slower compile-debug cycle and steeper learning curve — Thomas is not yet familiar with Rust ORM patterns.

**The split:**
- Rust: API server, database layer, LLM client, embedding orchestration, queue workers
- TypeScript/React: Frontend UI only
- Communication: REST between API and UI

### Decision: Postgres as the Single Database

**Rationale:** One database for everything. Postgres with extensions replaces both ChromaDB (via pgvector) and any separate feedback store.

**Extensions needed:**
- **pgvector** — vector similarity search, replaces ChromaDB entirely
- **Apache AGE or pg_graphql** — *potentially* for graph queries over code hierarchies (still under discussion — ICD-10's hierarchy is a tree, and a recursive CTE on a `parent_code` column may be simpler than a full graph extension)
- **pg_trgm** — trigram-based fuzzy text search for code lookups (e.g., typo-tolerant search)

**Database layers identified (separate Postgres schemas, one instance):**

| Schema | Purpose | Access Pattern |
|--------|---------|----------------|
| `reference` | ICD-10, CPT, HCPCS codes + embeddings | Read-heavy, loaded from CMS annually |
| `clinical` | Patients, encounters, clinical notes | Write-heavy, HIPAA-relevant |
| `pipeline` | Extraction results, code selections, feedback, few-shot examples | ML/self-improvement layer |
| `app` | Users, roles, tasks, audit logs | Standard CRUD |

### Decision: AWS Comprehend Medical for Entity Extraction (Stage 1)

**Rationale:** AWS Comprehend Medical is a purpose-built clinical NLP service that extracts medical entities (diagnoses, medications, procedures, anatomy, test results) from clinical text out of the box. No prompt engineering required. It returns structured output with:
- Entity types (MEDICAL_CONDITION, MEDICATION, PROCEDURE, ANATOMY, TEST_TREATMENT_PROCEDURE)
- Traits (NEGATION, PAST_HISTORY, HYPOTHETICAL, LOW_CONFIDENCE)
- ICD-10-CM and RxNorm code linking (basic, not specificity-aware)
- Character offsets (evidence spans)
- Confidence scores

**Cost:** ~$0.01 per 100 characters (~$0.0001 per average sentence). Orders of magnitude cheaper than LLM-based extraction.

**Limitations:** Comprehend Medical's ICD-10 linking is basic — it maps entities to general code categories but doesn't handle the specificity that medical coders require (laterality, encounter type, 7th character extensions, sequencing rules). This is still Stage 3's job. Comprehend is a strong *first pass*, not a replacement for the full pipeline.

**Hybrid approach with Bedrock:** Comprehend Medical handles deterministic, structured extraction (Stage 1). Bedrock handles reasoning-heavy steps — code selection, disambiguation, clinical judgment (Stage 3). This gives the best of both: Comprehend is fast and cheap for what it's good at, Bedrock handles what requires actual reasoning.

### Decision: AWS Glue for ETL / Data Ingestion

**Rationale:** The CMS ICD-10 release comes as fixed-width text files and XML, containing 72K+ codes that need parsing, transformation, embedding generation, and loading into Postgres+pgvector. This is a textbook ETL pipeline, and Glue is serverless (pay per DPU-second, no infrastructure to manage).

**Glue's role in the system:**
- **Annual CMS code refresh:** Parse CMS release files → transform to normalized schema → generate embeddings via Bedrock Titan Embed → load into Postgres `reference` schema
- **Embedding regeneration:** When embedding models change or new facets are added, re-embed all 72K+ codes
- **Bulk feedback processing:** Periodically process accumulated coder feedback to update keys/embeddings
- **Data quality checks:** Validate code counts, detect missing mappings, flag anomalies

**Glue vs custom Lambda:** For one-time or annual loads, a Lambda script could work. But Glue provides job bookmarking (resume from failure), built-in Spark for parallel processing of 72K+ records, and a visual job editor. For a pipeline that will run periodically with evolving logic, Glue is more maintainable.

**Open question:** Glue jobs are typically written in Python or Scala (PySpark). This means the ETL layer would be Python, not Rust. This is acceptable — ETL is operationally separate from the application. But it's worth noting as a deviation from the "Rust everywhere" aspiration.

### Decision: AWS Bedrock for LLM Inference (Stage 3 + Embeddings)

**Rationale:** If deploying on AWS, Bedrock is the natural choice over self-hosting Ollama. Bedrock is serverless (pay per token), supports Claude, Llama, Mistral, Cohere behind a unified API, and requires no GPU instances.

**Bedrock's role narrows with Comprehend in the picture:** Bedrock is no longer responsible for entity extraction (Stage 1). Its primary jobs are:
- **Code selection (Stage 3):** Given extracted entities + retrieval candidates, select the most specific ICD-10 codes with reasoning
- **Embedding generation:** Titan Embed or Cohere Embed for vector generation (called by Glue during ETL, and by the application for query-time embedding)
- **Future:** Prompt evolution, self-consistency checks, verification (V2)

**Ollama remains useful for local development** (offline work, avoiding API costs during iteration). The abstraction layer should support both.

**Why Bedrock over SageMaker:** SageMaker is for hosting your own model weights (fine-tuned, custom). Since fine-tuning is deferred to V2 and the plan uses off-the-shelf models, Bedrock is simpler and cheaper. SageMaker becomes relevant if/when coder feedback generates enough labeled data to fine-tune.

**Embedding strategy:** Bedrock Titan Embed (or Cohere Embed on Bedrock) generates vectors. Postgres pgvector stores and searches them. This eliminates the Python embedding server entirely.

### Decision: Lambda for API and Workers

**Rationale:** Rust on Lambda is a first-class experience. AWS maintains the official `lambda_runtime` crate. Cold starts are ~10-30ms (vs ~500ms+ for Java). Pay-per-invocation eliminates idle EC2 costs.

**How it works:** The `lambda_http` crate converts API Gateway events into standard `http::Request`/`http::Response` types. Axum handlers work unchanged. The entrypoint checks for `AWS_LAMBDA_FUNCTION_NAME` env var and either starts a Lambda runtime or a local TCP server:

```rust
#[tokio::main]
async fn main() {
    let app = create_router();
    if std::env::var("AWS_LAMBDA_FUNCTION_NAME").is_ok() {
        lambda_http::run(app).await.unwrap();
    } else {
        let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
        axum::serve(listener, app).await.unwrap();
    }
}
```

**Build/deploy toolchain:** `cargo-lambda` handles cross-compilation to `aarch64-unknown-linux-musl` (ARM Lambda, cheapest tier), local testing, and deployment.

**Connection management caveat:** Lambda + RDS can exhaust connection limits under load. Solutions:
- For demo: set a low max_connections on SQLx pool (1-2)
- For production: RDS Proxy (~$15/mo) pools connections
- Aurora Serverless v2 handles this natively but starts at ~$45/mo (overkill for demo)

### Decision: Event-Driven Pipeline via SQS

**Architecture:**
```
User uploads note → API Lambda → writes to Postgres
                              → pushes message to SQS "extraction" queue
                                    ↓
                    Extraction Worker Lambda (triggered by SQS)
                              → calls Comprehend Medical for entity extraction
                              → writes entities to Postgres
                              → queries pgvector for retrieval candidates
                              → pushes to SQS "code-selection" queue
                                    ↓
                    Code Selection Worker Lambda (triggered by SQS)
                              → reads entities + candidates from Postgres
                              → calls Bedrock for code selection + reasoning
                              → writes results to Postgres
                              → (optionally) notifies frontend

CMS Annual Refresh (separate pipeline):
    CMS files (S3) → Glue ETL Job → parse + transform
                                   → Bedrock Titan Embed for vectors
                                   → load into Postgres reference schema
```

**SNS vs SQS:** SQS is for work queues (one message → one consumer). SNS is for fan-out (one message → many subscribers). The pipeline stages are sequential work, so SQS is primary. SNS can sit in front if we need to branch (e.g., "on new note, trigger extraction AND audit logging").

---

## 3. Cost Estimates

### Demo-Level Monthly Cost (Low Traffic)

| Resource | AWS Service | Estimated Cost |
|----------|-------------|---------------|
| API + Workers | Lambda + API Gateway | ~$0 (free tier: 1M req/mo) |
| Database | RDS `db.t4g.micro` (free tier eligible) | $0–$15 |
| Entity extraction | Comprehend Medical | ~$0.50–$2 (very cheap per-character pricing) |
| Code selection | Bedrock (Claude Haiku or Llama 3) | ~$2–$10 |
| Embeddings | Bedrock Titan Embed | ~$1–$3 |
| ETL | Glue (annual CMS refresh + periodic jobs) | ~$1–$5 (pay per DPU-second) |
| Queues | SQS | ~$0 (free tier: 1M requests) |
| Storage | S3 (CMS files, artifacts) | <$1 |
| **Total** | | **~$5–$35/mo** |

Pricing context: Comprehend Medical is ~$0.01/100 chars — a 500-word clinical note (~2500 chars) costs ~$0.0025. 500 extractions/month = ~$1.25. Bedrock Claude Haiku for code selection at 500 calls/month stays well under $5.

**No GPU instances needed** — Comprehend and Bedrock handle all inference compute.

---

## 4. Repository Structure

### Monorepo with Cargo Workspace (Not Git Submodules)

Git submodules add friction (version pinning, detached HEADs, forgetting to init). A Cargo workspace monorepo keeps everything in one `git clone` with shared compilation and lockfile.

```
icd-10-parser/
├── Cargo.toml              # Workspace root
├── crates/
│   ├── core/               # Shared domain types (library crate)
│   ├── db/                 # Models, migrations, queries (library crate)
│   ├── llm/                # Bedrock/Ollama abstraction (library crate)
│   ├── api/                # Axum HTTP server (binary crate)
│   └── workers/            # Lambda queue handlers (binary crate)
├── sql/                    # Raw migrations, procedures, seed data
├── infra/                  # Terraform or CDK for AWS resources
├── ui/                     # TypeScript/React (npm workspace)
└── docs/                   # PRD, TRD, architecture docs
```

### Library vs Application Code (The Rust Model)

In Rust, a **library crate** exposes types and functions (`lib.rs`) and a **binary crate** compiles to an executable (`main.rs`):

| Crate | Type | Responsibility | Depends On |
|-------|------|---------------|------------|
| `core` | Library | Shared domain types: `IcdCode`, `ClinicalEntity`, `ExtractionResult` | Nothing |
| `db` | Library | SeaORM models, migrations, query functions (`create_patient()`, `fetch_icd10_codes()`, `record_feedback()`) | `core` |
| `llm` | Library | Bedrock/Ollama client, Comprehend Medical client, `extract_entities()`, `select_codes()` | `core` |
| `api` | Binary | Axum HTTP server, routes, Lambda entrypoint | `core`, `db`, `llm` |
| `workers` | Binary | SQS consumer Lambdas for async pipeline stages | `core`, `db`, `llm` |

The libraries know nothing about HTTP or queues. The binaries wire the libraries together. A dev agent working on `api` can see the `db` crate's public functions to know what database operations are available without understanding the SQL underneath.

### ORM Choice: SeaORM (Recommended)

| ORM | Style | Pros | Cons |
|-----|-------|------|------|
| **SeaORM** | ActiveRecord-ish, async | Most ergonomic; auto-generates Rust models from existing DB schema; async-native (fits Lambda/Tokio) | Younger ecosystem |
| **Diesel** | Query builder, sync | Most mature; compile-time query checking | Sync-only (needs `spawn_blocking` in async context); steep learning curve |
| **SQLx** | Raw SQL, async | Compile-time checked SQL; zero abstraction cost; you see every query | You write all SQL by hand; no model generation |

**SeaORM fits the database-first workflow:** design the schema in Postgres → run `sea-orm-cli generate entity` → get Rust model files → write application code against them.

---

## 5. Proposed Build Sequence

### Phase 0: Planning & Documentation (Current)
1. Redesign PRD — scope the MVP (what's in, what's deferred)
2. Redesign TRD — new stack, deployment architecture, data flow diagrams
3. Database schema design — all four layers, with migrations and procedures

### Phase 1: Foundation
4. AWS resource provisioning — Terraform/CDK for RDS, Lambda, SQS, API Gateway, Bedrock access, Comprehend Medical, Glue
5. Rust workspace scaffolding — crate structure, CI, local dev setup (Ollama + local Postgres + Docker Compose)
6. DB crate — SeaORM models generated from schema, migrations, core query functions

### Phase 2: Pipeline
7. LLM crate — Comprehend Medical client (extraction), Bedrock client (code selection + embeddings), Ollama fallback
8. Workers crate — SQS-triggered Lambdas for extraction and selection pipeline
9. Glue ETL — CMS file parser, embedding generation via Bedrock, pgvector loading

### Phase 3: API & Integration
10. API crate — Axum endpoints for note submission, code review, feedback
11. End-to-end pipeline test — note in → entities extracted → codes suggested → stored in Postgres

### Phase 4: UI
12. React frontend — note upload, entity review, code accept/reject, feedback loop

### MVP Milestone
The MVP needs all core resources operational but can defer:
- Self-improvement loops (correction docs, prompt evolution)
- Specialty modules
- Fine-tuning
- MIMIC-IV evaluation
- Advanced analytics/dashboards

---

## 6. Open Threads Requiring Answers

### AWS Services
1. **Comprehend Medical output mapping:** Comprehend returns its own entity type taxonomy (MEDICAL_CONDITION, MEDICATION, etc.) and basic ICD-10 linking. How do we map its output to our internal `ClinicalEntity` types? Do we enrich Comprehend's output with a lightweight Bedrock call, or is Comprehend's structure sufficient for Stage 2 retrieval?

2. **Comprehend Medical vs Bedrock for extraction quality:** Comprehend is cheaper and faster, but it's a fixed model — you can't improve it with feedback. Bedrock-based extraction via prompted LLM can evolve (prompt engineering, few-shot examples from coder corrections). Should we start with Comprehend and add Bedrock-based extraction as a "second opinion" layer later? Or run both and compare?

3. **Glue job language:** Glue jobs are typically Python (PySpark). This means the ETL layer breaks the "Rust for all backend code" pattern. Is this acceptable given ETL is operationally separate? Or should we write a Rust-based CMS parser that runs as a Lambda instead, keeping the stack uniform?

4. **Glue scheduling:** How often do ETL jobs run? CMS releases are annual, but feedback-driven embedding updates could be more frequent. Do we need a Glue job for periodic feedback processing, or does that happen in the application layer?

### Architecture & Design
5. **Graph extension vs recursive CTE:** Is ICD-10's code hierarchy complex enough to justify Apache AGE / pg_graphql, or can a `parent_code` column with recursive CTEs handle the tree structure? Need to examine the actual ICD-10 hierarchy shape (chapters → blocks → categories → codes → extensions).

6. **pgvector search strategy:** The prototype uses RRF across 3 embedding facets in ChromaDB. How does this translate to pgvector? Separate vector columns per facet? Separate rows? A dedicated `embeddings` table with a `facet` enum column?

7. **Library boundary for DB operations:** Where exactly does "library" end and "application code" begin for database access? Should the `db` crate expose high-level domain operations (`get_codes_for_encounter()`) or low-level CRUD + let callers compose? This affects how reusable the crate is vs how much business logic leaks into it.

8. **Service bus design details:** How many SQS queues? One per pipeline stage? Dead letter queues for failed extractions? Retry policies? Should extraction and code selection be separate Lambdas or one Lambda with a stage parameter?

### Data & Domain
9. **CMS file format parsing:** The annual CMS ICD-10 release comes as fixed-width text files and XML. Which format do we parse? Who builds the parser — is this a one-time script or an ongoing migration tool?

10. **HIPAA implications:** If the `clinical` schema holds real patient data, the entire AWS deployment needs HIPAA BAA, encryption at rest, audit logging, VPC isolation. Does the MVP use synthetic data only, or do we need to plan for HIPAA from day one?

11. **Embedding model choice on Bedrock:** Titan Embed v2 vs Cohere Embed v3 — different dimensionalities, different costs. Need to test retrieval quality against the prototype's MiniLM-L6-v2 baseline.

### Infrastructure & DevOps
12. **Terraform vs CDK:** Terraform is language-agnostic and widely used. CDK lets you define infra in TypeScript (which is already in the repo for the UI). Preference?

13. **Local dev environment:** Docker Compose with Postgres + pgvector for local development? Or direct Postgres install? Ollama runs natively on macOS/Linux — does Thomas's ARM machine (Raspberry Pi?) have enough RAM for a 7B model?

14. **CI/CD pipeline:** GitHub Actions? What triggers deployments? Does Lambda deploy on every push to main, or manually?

### Cost & Scope
15. **MVP feature cut:** The PRD describes a full platform (OCR, task management, document upload, searchable code database). What's the absolute minimum demo? A single endpoint that takes clinical text and returns suggested ICD-10 codes with reasoning?

16. **RDS free tier timing:** AWS free tier for RDS is 12 months from account creation. Is Thomas's AWS account new enough to qualify?

17. **Multi-model strategy:** Should the MVP support swapping between Bedrock models (e.g., Haiku for cheap extraction, Sonnet for code selection), or start with one model for everything?

### Rust-Specific
18. **Thomas's Rust familiarity:** Needs a debrief on SeaORM patterns (entity definitions, relations, migrations, query building). Should we do a focused learning session before designing models?

19. **Compile-time guarantees vs velocity:** SeaORM + SQLx give compile-time SQL checking, but the feedback loop is slower than TypeScript. For the database design phase (which Thomas expects to span multiple sessions), should we prototype schemas in raw SQL first and generate Rust models after the schema stabilizes?

20. **Error handling patterns:** Rust's `Result<T, E>` is different from TypeScript's try/catch. The LLM crate will need to handle Bedrock timeouts, malformed responses, rate limits — what error strategy? `thiserror` for library errors, `anyhow` for application code?

---

*This document is a living checkpoint. Updated as the conversation continues.*

---

**See also** — historical context only. Post-pivot architecture lives in [[../ROADMAP|ROADMAP]] and is elaborated across the topic hubs: [[../research/topics/upgradeable-proxy|Upgradeable proxy + Timelock hub]], [[../research/topics/settlement-stablecoin|Settlement stablecoin hub]], [[../research/topics/dispute-window|dispute-window hub]], [[../research/topics/somnia-substrate|Somnia substrate hub]].
