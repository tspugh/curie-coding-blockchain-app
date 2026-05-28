# Knowledge Graph Versioning — Research Notes

**Status:** V2 design — does not block MVP prototype
**Last updated:** 2026-04-10
**Related Linear issue:** ICD-10

---

## What This Is

The knowledge graph is the primary IP of CliQueue: a key-value store where many embedding
keys point to fixed ICD-10 code values. Keys grow over time through coder feedback. This
document captures design thinking on how that growth should be governed — specifically,
how accepted codings become new embedding keys and how bad keys can be removed.

---

## What the MVP Already Provides (Foundation)

The MVP schema already lays the groundwork for versioning, even though the MVP doesn't
act on feedback to generate new embeddings.

**`reference.code_embeddings` (current schema):**
```sql
id          UUID PRIMARY KEY
code        TEXT REFERENCES reference.icd_codes(code)
facet       TEXT  -- 'description' | 'synonym' | 'hierarchy' | 'correction' (V2)
key_text    TEXT  -- the phrase that gets embedded
embedding   vector(1024)
source      TEXT  -- 'cms' | 'generated' | 'coder_feedback' (V2)
cms_version TEXT
```

The `source` column already distinguishes CMS-seeded keys from future coder-feedback keys.
The MVP will only ever have `source = 'cms'` or `source = 'generated'` rows. V2 adds
`source = 'coder_feedback'` rows generated from accepted code suggestions.

**`pipeline.code_suggestions` (current schema):**
```
status TEXT  -- 'pending' | 'accepted' | 'rejected'
confidence FLOAT
reasoning TEXT
evidence_spans JSONB
```

Every accepted suggestion is already a training signal. The clinical entity text that
triggered retrieval (stored in `pipeline.entities.query_text`) + the accepted code is
exactly the key-value pair that should become a new embedding.

---

## The V2 Promotion Pipeline

### Conceptual flow

```
pipeline.code_suggestions (status = 'accepted')
        + pipeline.entities (query_text that triggered the suggestion)
        ↓
[promotion Lambda: triggered nightly or on threshold]
        ↓
Bedrock Titan Embed v2 (embed query_text)
        ↓
INSERT INTO reference.code_embeddings (
    facet = 'correction',
    source = 'coder_feedback',
    key_text = query_text,
    embedding = <vector>,
    status = 'candidate'   ← NEW column needed
)
```

### Schema additions for V2

Add to `reference.code_embeddings`:

```sql
status TEXT NOT NULL DEFAULT 'stable'
    -- 'stable'    = actively used in retrieval (all CMS rows start here)
    -- 'candidate' = new coder-feedback key awaiting promotion threshold
    -- 'retired'   = soft-deleted; excluded from retrieval
    CHECK (status IN ('stable', 'candidate', 'retired')),

approval_count INTEGER NOT NULL DEFAULT 0,
    -- incremented when multiple coders independently approve the same key→code pair
    -- promotion to 'stable' happens when approval_count >= PROMOTION_THRESHOLD (TBD)

promoted_from_suggestion_id UUID REFERENCES pipeline.code_suggestions(id),
    -- FK to the accepted suggestion that created this key; enables rollback
    -- NULL for CMS-seeded keys

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
retired_at TIMESTAMPTZ   -- set when status → 'retired'
```

The vector similarity query also needs to filter: `WHERE status IN ('stable', 'candidate')`
(or `WHERE status = 'stable'` for conservative production mode) — decide at query time.

---

## Open Design Questions

### 1. Promotion threshold

What `approval_count` triggers candidate → stable promotion?

- **Too low (1):** One wrong approval by one coder poisons the graph.
- **Too high (10):** Slow learning; rare but correct codings never get promoted.
- **Recommendation:** Start with 3 independent approvals from different coders (different
  `app.users.id`). This is a config constant, not hardcoded — tune it after observing
  correction quality in production.

### 2. Shared vs per-customer graph

| Model | Pros | Cons |
|-------|------|------|
| Shared graph | Network effect; corrections benefit all customers | One customer's dialect / jargon pollutes others |
| Per-customer | Isolated; no cross-contamination | No network effect; infra cost per customer |
| Shared with per-customer overrides | Best of both | More complex query (union two embedding namespaces) |

**Recommendation:** Shared graph for V1.5 (first 2–3 customers). Add per-customer
override namespace (a `customer_id` column on `code_embeddings`, NULL = shared) when the
first customer complains that a shared correction broke their workflow.

### 3. Conflict resolution

Two customers approve contradictory mappings: Customer A confirms "widow maker" → I21.01;
Customer B confirms "widow maker" → I21.09.

Options:
- Last-write wins (bad — non-deterministic)
- Vote with approval_count (good — majority rules, threshold prevents easy pollution)
- Manual review queue for conflicts (good for high-stakes codes)

**Recommendation:** Approval_count voting for V2. Add a conflict detection job that flags
any key_text with >1 distinct code reaching the promotion threshold — put those in a
manual review queue.

### 4. Annual CMS refresh + retired codes

Every October 1, CMS retires some codes and adds new ones. Coder-feedback embeddings for
retired codes become stale.

**Recommendation:** After each annual CMS refresh run, join `code_embeddings` against
`reference.icd_codes.billable` and the current `cms_version`. Any `coder_feedback` key
pointing to a retired code: set `status = 'retired'`, log it. Flag for a human review
queue (maybe the mapping still makes sense after code remapping).

### 5. Rollback

If a promoted key starts degrading suggestion quality (detectable via accept rate dropping
on suggestions that used that key during retrieval), retirement must be possible.

**Recommendation:** Never hard-delete `code_embeddings` rows. Set `status = 'retired'`
with `retired_at = NOW()`. The `promoted_from_suggestion_id` FK provides full provenance.
A rollback is just `UPDATE reference.code_embeddings SET status = 'retired' WHERE id = $1`.

---

## What V2 Needs to Build

| Component | Notes |
|-----------|-------|
| Schema migration: add `status`, `approval_count`, `promoted_from_suggestion_id`, `created_at`, `retired_at` to `reference.code_embeddings` | Additive migration; no data loss |
| Promotion Lambda (nightly batch) | Join accepted suggestions + entities; embed query_text; insert candidate rows; promote when threshold met |
| Retrieval query update | Filter by `status IN ('stable', 'candidate')` or `status = 'stable'` |
| Conflict detection job | Flag key_text with >1 distinct promoted code |
| Annual refresh retirement script | Retire keys pointing to now-retired CMS codes |
| Knowledge graph admin UI | View candidate/stable/retired keys; manually promote/retire; review conflicts |

None of these block the MVP. The MVP records accept/reject decisions in
`pipeline.code_suggestions.status`. V2 consumes that data.

---

## Why Not Build This for MVP

The MVP has no real production traffic, no real coder corrections, and no quality bar
to maintain. Building versioning infrastructure before there is data to govern is premature.
The MVP proves the value prop (coders trust AI suggestions with reasoning); versioning
proves the flywheel (suggestions improve as coders use it). Those are sequential milestones,
not parallel ones.

---

## References

- `docs/technical-design/db-schema-design.md` — full current schema; `reference.code_embeddings`
- `docs/technical-design/vector-store.md` — retrieval strategy (RRF, facet search)
- `docs/technical-design/cms-etl-pipeline.md` — how CMS keys are initially seeded
- `docs/COMPETITIVE.md` — competitive moats section; feedback loop as a moat
- Linear ICD-10 — this issue

---

**See also** — historical V2 design note seeded from the `icd-10-parser` predecessor project. The current AI-coding architecture lives in [[topics/corti|Corti hub]] (Symphony as off-chain coder) and the credentialed-coder oversight model in [[topics/sbt|SBT hub]].
