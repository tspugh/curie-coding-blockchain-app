# CliQueue — Prototype Specification

**Version:** 0.1 (research/planning phase)
**Status:** Living document — updated as research resolves open questions
**Purpose:** Single source of truth for what the prototype must do, what it doesn't need
to do, and what criteria determine whether it's ready to demo.

Every research loop iteration should ask: *"Does this decision move something in this
spec from blocked to unblocked, or from undefined to defined?"* If not, reconsider
the priority.

---

## Linear Card Standards

### Card Types

| Label | Meaning |
|-------|---------|
| `Development` | Concrete implementation work — code, migrations, CDK stacks, tests. Not research. |
| `Agent Ready` | The card has enough detail that an AI agent can implement it without any additional context. Applied on top of `Development`. |
| `research` | Still in the exploration phase — not ready to implement. No `Agent Ready` label. |

A card graduates from `research` → `Development` → `Development + Agent Ready` as detail
is added through research loop iterations.

### Agent Ready Criteria

A `Development` card earns the `Agent Ready` label when it specifies **all four** of the
following. Cards that skip any of these must stay at `Development` only until filled in.

**1. Packages / libraries**
List every external dependency the implementation will use, with versions where known.
```
// Example (TypeScript):
"pg": "^8.11",
"@aws-sdk/client-bedrock-runtime": "^3.0"
```

**2. Files to create or modify**
Exact paths, with a one-line description of what changes in each.
```
src/reference/icd_codes.ts  — new file; IcdCode type + query functions
src/reference/index.ts      — export icd_codes module
sql/migrations/001_reference_schema.sql — new migration; reference.icd_codes table
```

**3. Reasoning**
Why this implementation approach was chosen over alternatives. Link to the decision doc
that backs the choice (e.g., `docs/technical-design/db-library.md`). This lets an agent
understand *why* it is doing what it is doing, not just *what* to do.

**4. Acceptance Criteria**
Concrete, testable checklist. Must include:
- [ ] Functional requirement 1
- [ ] Functional requirement 2
- [ ] All public types and functions have doc comments
- [ ] Tests pass
- [ ] No linter warnings

### Quality Bar

Agent Ready cards must be **at least as detailed as ICD-5** (the monorepo scaffold card,
which was successfully implemented by Codex). Aim for more detail, not less — the agent
has no context outside the card and the referenced docs.

An agent picking up a card should never need to ask: *"What library do I use?"*,
*"Which file does this go in?"*, or *"Why are we doing it this way?"*

---

## What the Prototype Must Demonstrate

The prototype has one job: convince a medical coding professional (or a hospital
administrator evaluating tools) that AI-assisted coding with human review is faster and
more trustworthy than manual coding alone.

**The core demo flow:**

1. Upload a clinical document (a doctor's note in PDF or plain text)
2. The system processes it and returns suggested ICD-10 codes with:
   - Each suggested code clearly displayed
   - The specific phrase or section of the note that triggered the suggestion (highlighted)
   - A plain-English explanation of why this code fits
   - The official code definition
3. A coder reviews the suggestions:
   - Accepts ones that look correct
   - Rejects ones that are wrong, with a reason
   - Searches for and adds missing codes via a built-in lookup
4. The coder submits the final code set
5. The system records the corrections so future suggestions improve

**If someone watches this demo and says "this would save my coders real time" — the
prototype has succeeded.**

---

## What the Prototype Does NOT Need

These are explicitly out of scope. Do not design for them now.

| Feature | Why Deferred |
|---------|-------------|
| CPT and HCPCS codes | ICD-10 alone is sufficient to demonstrate the value prop |
| Multi-tenant / multi-org | Single org, single user role for demo |
| HIPAA BAA and real patient data | Use synthetic notes only; flag before any real data |
| EHR integration (Epic, Cerner) | Manual upload is fine for demo |
| Billing system integration (837P/I) | Code output is a display, not a file submission |
| Fine-tuning or model training | Feedback is recorded but not used to retrain for demo |
| Specialty modules (cardiology, etc.) | Generalist pipeline only |
| Advanced analytics dashboard | Not needed to show core value |
| Production SLAs, uptime guarantees | Demo reliability only |
| Self-improvement loop | Feedback recorded; correction ingestion is V2 |

---

## Minimum Technical Components

Each component must be built before the prototype can demo. Status is updated as
decisions are made and implementation begins.

### Infrastructure

| Component | Status | Decision Doc | Notes |
|-----------|--------|-------------|-------|
| IaC tooling | ✅ Decided | `technical-design/iac-tooling.md` | AWS CDK TypeScript |
| CI/CD pipeline | ✅ Decided | `technical-design/ci-cd-pipeline.md` | GitHub Actions; SQLX_OFFLINE; ARM64 Lambda build; manual CDK deploy |
| AWS account + CDK bootstrap | ⬜ Not started | `technical-design/deployment-runbook.md` | Steps 1–5 of runbook; requires Thomas's AWS account |
| RDS Postgres + pgvector | ✅ Decided | `technical-design/rds-connection-pooling.md` | db.t3.micro; public subnet for demo; sslmode=require; specced in ICD-24 |
| RDS connection pooling | ✅ Decided | `technical-design/rds-connection-pooling.md` | max_connections(2) per Lambda; no RDS Proxy for demo; init in main() |
| SQS queues (extraction + selection) | ✅ Decided | `technical-design/sqs-queue-design.md` | 2 Standard queues + DLQs; CDK; specced in ICD-24 |
| Lambda execution roles (IAM) | ✅ Decided | — | Comprehend + Bedrock + SQS + S3 policies; specced in ICD-24 |
| Bedrock model access | ✅ Decided | `technical-design/embedding-model.md` | Enable Titan Embed v2 + Claude Haiku in Bedrock console; IAM in ICD-24 |
| Comprehend Medical access | ✅ Decided | `technical-design/comprehend-entity-mapping.md` | IAM policy in ICD-24; no console opt-in needed |
| S3 bucket (document uploads) | ✅ Decided | `technical-design/cms-etl-pipeline.md` | EtlStack bucket for CMS XML + JSONL; specced in ICD-24 |
| CDK infrastructure stacks | ✅ Decided | `technical-design/iac-tooling.md` | 4 stacks (Database, Pipeline, Api, Etl); Lambda Function URL; specced in ICD-24 |

### Data Layer

| Component | Status | Decision Doc | Notes |
|-----------|--------|-------------|-------|
| DB library (ORM/query) | ✅ Decided | `technical-design/db-library.md` | SQLx 0.8 |
| Vector store strategy | ✅ Decided | `technical-design/vector-store.md` | pgvector, one row per key |
| `reference` schema (ICD-10 codes) | ✅ Decided | `technical-design/db-schema-design.md` | Specced in vector-store.md; migration order 001 |
| ICD-10 hierarchy traversal | ✅ Decided | `technical-design/icd10-hierarchy.md` | parent_code FK + recursive CTE; no graph extension; billable flag |
| `reference.code_embeddings` table | ✅ Decided | `technical-design/embedding-model.md` | `vector(1024)`, Titan Embed v2 |
| `clinical` schema (notes, encounters) | ✅ Decided | `technical-design/db-schema-design.md` | encounters table; char_count computed; migration 003 |
| `pipeline` schema (results, feedback) | ✅ Decided | `technical-design/db-schema-design.md` | entities, code_suggestions, manual_codes, submissions; migration 004 |
| `app` schema (users, tasks) | ✅ Decided | `technical-design/db-schema-design.md` | users + tasks; task_status enum; migration 002 |
| Local dev environment | ✅ Decided | `technical-design/local-dev-environment.md` | docker-compose.yml + .env.example + sql/ scaffold committed |
| SQLx migrations | ✅ Decided | `technical-design/db-schema-design.md` | ICD-12–16 cover all 4 schema migrations |
| CMS ICD-10 ETL (Lambda pipeline) | ✅ Decided | `technical-design/cms-etl-pipeline.md` | XML parser + concurrent Titan Embed; ICD-13 + ICD-25 |
| Reference data seeded (72K codes) | ✅ Decided | `technical-design/cms-etl-pipeline.md` | ICD-13 (cms-parser) + ICD-25 (embed-runner); ~100 min one-shot run |
| Demo clinical notes | ✅ Decided | `technical-design/demo-data-strategy.md` | 5 synthetic notes in docs/demo/clinical-notes/; no MIMIC-IV |

### AI Pipeline

| Component | Status | Decision Doc | Notes |
|-----------|--------|-------------|-------|
| Embedding model choice | ✅ Decided | `technical-design/embedding-model.md` | Titan Embed v2, 1024-dim |
| Entity extraction (Comprehend Medical) | ✅ Decided | `technical-design/comprehend-entity-mapping.md` | Stage 1; specced in ICD-22 |
| Comprehend → internal type mapping | ✅ Decided | `technical-design/comprehend-entity-mapping.md` | EntityKind enum; attribute enrichment; negation filter |
| Vector retrieval (pgvector + RRF) | ✅ Decided | `technical-design/vector-store.md` | Stage 2; RRF k=60; specced in ICD-23 |
| Code selection (Bedrock) | ✅ Decided | `technical-design/mvp-api-design.md` | Stage 3; Claude Haiku; prompt with sequencing rules; specced in ICD-23 |
| Reasoning generation | ✅ Decided | `technical-design/mvp-api-design.md` | Part of Stage 3 Haiku output; one sentence per suggestion |
| Evidence span extraction | ✅ Decided | `technical-design/mvp-api-design.md` | Haiku outputs {start,end,text} spans; stored as JSONB |

### Application

| Component | Status | Decision Doc | Notes |
|-----------|--------|-------------|-------|
| API (Axum + Lambda) | ✅ Decided | `technical-design/mvp-api-design.md` | 7 endpoints; Haiku for Stage 3 |
| Document upload endpoint | ✅ Decided | `technical-design/mvp-api-design.md` | POST /tasks; text/plain body |
| Task queue / processing status | ✅ Decided | `technical-design/mvp-api-design.md` | GET /tasks + GET /tasks/:id; client polls 3s |
| Code review endpoint | ✅ Decided | `technical-design/mvp-api-design.md` | GET /tasks/:id/review; full payload |
| Accept/reject feedback endpoint | ✅ Decided | `technical-design/mvp-api-design.md` | POST /suggestions/:id/review; no modify |

### Frontend

| Component | Status | Decision Doc | Notes |
|-----------|--------|-------------|-------|
| Upload + task list page | ✅ Decided | `technical-design/mvp-api-design.md` | Combined page; 3s polling; status badges |
| Code review page | ✅ Decided | `technical-design/mvp-api-design.md` | 60/40 split: doc viewer + suggestion cards |
| Evidence highlighting | ✅ Decided | `technical-design/mvp-api-design.md` | Char offset spans → colored DOM highlights |
| Accept/reject/submit flow | ✅ Decided | `technical-design/mvp-api-design.md` | Accept or reject; no in-place modify |
| Built-in code lookup panel | ✅ Decided | `technical-design/mvp-api-design.md` | ILIKE search; Add button → manual_codes |

---

## Open Decisions That Block the Prototype

These must be resolved before the corresponding components can be built. Each is a
research agenda item in `docs/planning-loop-prompt.md`.

| Decision | Blocks | Research Agenda Item |
|---------|--------|---------------------|
| ~~Embedding model (dim, provider)~~ | ~~`code_embeddings` schema, ETL, all retrieval~~ | ✅ Decided — `technical-design/embedding-model.md` |
| ~~SQS queue design~~ | ~~Workers, pipeline flow~~ | ✅ Decided — `technical-design/sqs-queue-design.md` |
| ~~CMS ICD-10 file format~~ | ~~Glue ETL job~~ | ✅ Decided — `technical-design/cms-etl-pipeline.md` |
| ~~HIPAA scope~~ | ~~Entire AWS deployment design~~ | ✅ Decided — `technical-design/hipaa-scope.md` |
| ~~Comprehend → ClinicalEntity mapping~~ | ~~Extraction worker~~ | ✅ Decided — `technical-design/comprehend-entity-mapping.md` |
| ~~DB schema design (all 4 schemas)~~ | ~~Every module~~ | ✅ Decided — `technical-design/db-schema-design.md` |
| ~~MVP feature cut~~ | ~~Frontend scope~~ | ✅ Decided — `technical-design/mvp-api-design.md` |

---

## Prototype "Ready to Demo" Checklist

The prototype is demo-ready when all of these are true:

- [ ] Upload a plain-text clinical note via the UI
- [ ] Note is processed end-to-end in under 60 seconds
- [ ] At least 3 ICD-10 code suggestions returned with reasoning
- [ ] Each suggestion linked to a highlighted span in the original document text
- [ ] Coder can accept, reject, or modify suggestions via the UI
- [ ] Coder can search for additional codes using built-in lookup
- [ ] Final code set can be "submitted" (recorded in DB, shown as complete)
- [ ] Feedback (accept/reject) is persisted to the database
- [ ] The demo uses synthetic clinical notes only (no real patient data)
- [ ] The system handles a second note without manual restart

---

## Reference Documents

| Document | Purpose |
|---------|---------|
| `docs/VISION.md` | Founder statement: problem, goal, differentiation |
| `docs/PRODUCT.md` | Detailed product requirements and user stories |
| `docs/research/medical-coding-domain.md` | Domain background: how coding works |
| `docs/architecture-brainstorm-2026-04-05.md` | Architecture decisions and 20 open questions |
| `docs/technical-design/iac-tooling.md` | IaC decision: CDK TypeScript |
| `docs/technical-design/db-library.md` | DB library decision: SQLx |
| `docs/technical-design/vector-store.md` | Vector store decision: pgvector, one row per key |
| `docs/research/log.md` | Running research audit trail |
| `docs/planning-loop-prompt.md` | Research loop instructions and agenda |

---

## Prototype Success Criteria

Beyond the checklist above, the prototype succeeds if:

1. **A working medical coder can use it without training.** The interface and suggestions
   should be self-explanatory to someone familiar with ICD-10 coding.

2. **The primary diagnosis code is correct ≥70% of the time** on the 5 synthetic demo
   notes in `docs/demo/clinical-notes/` (each has ground-truth codes annotated).
   "Correct" means the code in Haiku's `is_primary=true` suggestion matches the ground-
   truth rank-1 code, or is clinically equivalent (same category, valid specificity).
   This is the single most important accuracy signal for a demo: if the *first* code is
   wrong, the tool looks unreliable regardless of secondary codes.

   Note: MIMIC-IV (the standard academic ICD-10 benchmark) is inpatient discharge
   summaries and uses principal-diagnosis rules — the wrong coding framework for
   outpatient CliQueue. Our 5 annotated demo notes are the correct evaluation set.
   See `docs/research/log.md` — 2026-04-10 MIMIC-IV entry.

3. **The evidence highlighting is accurate.** If a code suggestion links to a phrase in
   the note, that phrase must actually be the clinical reason for the code.

4. **The feedback loop closes.** A correction made in session (rejecting a wrong code,
   adding a correct one) must be persisted — even if it doesn't improve the next
   inference yet.

5. **Cost of one demo session is under $2.** Actual measured cost: ~$0.33 per 500-word
   note (Comprehend Medical dominates at $0.30/note; Haiku adds ~$0.003; embeddings are
   negligible). A 5-note full-demo session costs ~$1.65. The original "$1" estimate was
   optimistic — Comprehend Medical charges $0.01 per 100 characters, not per API call.
   See `docs/research/log.md` — 2026-04-10 cost analysis entry.
   **To minimize demo cost:** use `CLIQUEUE_LOCAL_MODE=true` for pipeline notes and only run
   real AWS processing on 1-2 showpiece notes (~$0.66 for two notes).
