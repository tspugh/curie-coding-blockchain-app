# A-0001: Original Phase 1 Tasks (Historical)

> **Status:** Superseded by the Somnia chain-native pivot on 2026-05-14.
> **Kept as:** historical record of the pre-pivot Phase 1 task plan
> (ICD-10-parser project, Rust + AWS direction).
> **Current direction:** see [`AGENTS.md`](../../AGENTS.md) and [`CLAUDE.md`](../../CLAUDE.md).
> Do not treat the tasks below as active work items.

---

# Phase 1: Entity Extraction - Task Breakdown

**Phase Status:** 📋 Ready to Start  
**Duration:** 1 week  
**Start Date:** TBD  
**Owner:** TBD

---

## Subtasks (Ordered)

### Task 1.1: Design Entity Extraction Schema ⏳ TODO

**File(s):** `src/entity_extractor_schema.ts`

**Description:** Define the types and structure for clinical entity extraction. This is the "contract" between the LLM and the downstream code selector.

**Acceptance Criteria:**
- [ ] TypeScript types for all entity types (diagnosis, procedure, supply, comorbidity, temporal, severity, laterality, etc.)
- [ ] Each entity has: type, value, qualifiers[], evidence span (start/end indices), confidence score
- [ ] JSON schema document (for API validation later)
- [ ] Example entity objects for each type
- [ ] Extraction output format clearly defined
- [ ] Error cases documented (what if entity is ambiguous? missing context?)

**Dependencies:** None

**Estimated Time:** 4-6 hours

**Notes:**
- Reference: ICD-10 coding guidelines (Section I: "Selection of Principal Diagnosis")
- Clinical entities should map cleanly to ICD-10 codes (avoid overly granular types)
- Start with 8-10 entity types; can expand later
- Consider: how will Stage 3 (code selector) use these entities? They should be semantically rich enough to distinguish between codes.

---

### Task 1.2: Implement Entity Extractor (LLM-based) ⏳ TODO

**File(s):** `src/entity_extractor.ts`

**Description:** Implement the actual entity extraction using an external LLM (OpenAI/Anthropic/Mistral).

**Acceptance Criteria:**
- [ ] EntityExtractor class that wraps an LLM provider
- [ ] System prompt design (clear instructions, entity definitions, output format)
- [ ] Configurable LLM provider (abstraction layer: provider can be swapped)
- [ ] JSON parsing from LLM output (error recovery for malformed responses)
- [ ] Evidence span extraction (map mentioned entities back to character positions in original text)
- [ ] Confidence scoring (explicit or inferred from LLM output)
- [ ] Timeout handling (LLM responses can take a while)
- [ ] Token counting (for cost estimation)
- [ ] Logging/debugging output (for troubleshooting extraction failures)

**Dependencies:** Task 1.1

**Estimated Time:** 6-8 hours

**Notes:**
- Use system prompt pattern: task description → entity types → output format → examples
- Be explicit about output JSON structure; LLMs are better at structured tasks with clear schemas
- Consider: should extractors be cached? (if notes are identical, extraction will be identical)
- Error handling: what if LLM returns invalid JSON? Retry? Fall back to lenient parsing?
- Temperature: use low temperature (0.1-0.3) for deterministic extraction

**Sample System Prompt:**
```
You are a medical billing specialist. Extract clinical entities from doctor notes.

Entity types:
- diagnosis: a patient condition (e.g., "acute myocardial infarction")
- procedure: a medical procedure (e.g., "cardiac catheterization")
- supply: medical supplies used (e.g., "stent")
- comorbidity: other conditions affecting care (e.g., "diabetes")
- temporal: when something occurred (e.g., "acute", "chronic")
- laterality: which side (e.g., "left", "right", "bilateral")
- severity: how severe (e.g., "severe", "moderate", "mild")

For each entity, provide:
- type: one of the above
- value: the entity text
- qualifiers: list of modifying terms (optional)
- span: {"start": <char position>, "end": <char position>}
- confidence: 0.0-1.0

Output as JSON array. Example:
[
  {"type": "diagnosis", "value": "ST elevation MI", "qualifiers": ["anterior", "acute"], "span": {"start": 45, "end": 60}, "confidence": 0.95}
]
```

---

### Task 1.3: Create Test Fixtures ⏳ TODO

**File(s):** `data/test_notes/sample_clinical_notes.json`

**Description:** Create realistic clinical note examples with expected entity extractions (ground truth).

**Acceptance Criteria:**
- [ ] 5-10 clinical notes covering different specialties (cardiology, endocrine, respiratory)
- [ ] Each note includes variety: multiple conditions, procedures, qualifiers
- [ ] Ground truth entities annotated for each note
- [ ] Span positions verified (manually check that spans point to correct text)
- [ ] Expected difficulty level documented (easy, medium, hard)
- [ ] Edge cases included (ambiguous language, implicit context, etc.)
- [ ] JSON format matches extraction output schema

**Dependencies:** Task 1.1

**Estimated Time:** 4-6 hours

**Notes:**
- Find de-identified clinical notes online (medical NLP datasets often have examples)
- Or synthesize notes from medical literature (ensure they're realistic)
- Manually annotate ground truth; this becomes your test oracle
- Document difficult cases and why they're hard (useful for error analysis)

**Example structure:**
```json
{
  "id": "note_001",
  "specialty": "cardiology",
  "difficulty": "medium",
  "text": "72 year old male presents with acute chest pain radiating to left arm...",
  "groundTruth": [
    {"type": "diagnosis", "value": "acute myocardial infarction", ...},
    ...
  ],
  "notes": "This case is tricky because the note mentions both chest pain and dyspnea; the primary is chest pain."
}
```

---

### Task 1.4: Add Monitoring/Debugging Tool ⏳ TODO

**File(s):** `src/entity_monitor.ts` (or extend CLI)

**Description:** Create a tool to inspect and debug entity extraction output.

**Acceptance Criteria:**
- [ ] CLI command: `npm run cli -- extract-entities <notes.txt> [--verbose]`
- [ ] Prints extracted entities with confidence scores
- [ ] Highlights evidence spans in original text (with context)
- [ ] Flags low-confidence extractions (< 0.6)
- [ ] Shows extraction latency and token usage
- [ ] Compares against ground truth (if available)
- [ ] Outputs detailed error report for debugging

**Dependencies:** Tasks 1.2, 1.3

**Estimated Time:** 3-4 hours

**Notes:**
- Use colors/formatting for readability
- Example output:
  ```
  Extracting entities from notes.txt...
  
  Found 8 entities:
  1. [0.95] diagnosis: "acute MI" @ chars 45-54
     Context: "...presents with acute MI and elevated troponin..."
  
  2. [0.72] severity: "elevated" @ chars 70-77 ⚠️ (low confidence)
  
  Ground truth (if available): 8 entities, 7 matched (87.5% recall)
  Latency: 1.2s | Tokens: 285
  ```

---

### Task 1.5: Unit Tests ⏳ TODO

**File(s):** `tests/entity_extractor.test.ts`

**Description:** Write comprehensive unit tests for entity extraction.

**Acceptance Criteria:**
- [ ] Test correct entity type identification (diagnosis vs procedure vs supply)
- [ ] Test evidence span correctness (spans point to exact text in notes)
- [ ] Test qualifier extraction (modifying terms are captured)
- [ ] Test confidence scoring (reasonable values)
- [ ] Test malformed LLM output handling (invalid JSON, missing fields)
- [ ] Test empty/no-entities case
- [ ] Test timeout/error handling (LLM unavailable)
- [ ] Test caching (if implemented)
- [ ] At least 80% code coverage for EntityExtractor class

**Dependencies:** Tasks 1.2, 1.3

**Estimated Time:** 4-6 hours

**Notes:**
- Use sample clinical notes from Task 1.3 as test fixtures
- Mock LLM responses for deterministic testing (use tsx --test or similar)
- Test both happy path and error cases
- Consider: should extraction be deterministic (same input → same output)?

---

### Task 1.6: Documentation ⏳ TODO

**File(s):** `src/entity_extractor.ts` (JSDoc) + `docs/ENTITY_EXTRACTION.md`

**Description:** Document the entity extraction design, prompt engineering choices, and usage.

**Acceptance Criteria:**
- [ ] JSDoc comments on EntityExtractor class and key methods
- [ ] Prompt design document: why these entity types? Why this structure?
- [ ] Usage examples in CLI help text
- [ ] Troubleshooting guide (common extraction errors and fixes)
- [ ] Performance notes (typical latency, token costs)
- [ ] Future improvements documented (e.g., finetuning on medical data)

**Dependencies:** All other Task 1.x tasks

**Estimated Time:** 2-3 hours

**Notes:**
- Assume readers understand ICD-10 but may not understand LLM prompting
- Include examples: good extractions vs bad extractions
- Document trade-offs: accuracy vs latency vs cost

---

## Summary Table

| Task | File(s) | Est. Time | Blocker | Status |
|------|---------|-----------|---------|--------|
| 1.1 | src/entity_extractor_schema.ts | 5h | None | ⏳ TODO |
| 1.2 | src/entity_extractor.ts | 7h | 1.1 | ⏳ TODO |
| 1.3 | data/test_notes/... | 5h | 1.1 | ⏳ TODO |
| 1.4 | src/entity_monitor.ts | 3.5h | 1.2, 1.3 | ⏳ TODO |
| 1.5 | tests/entity_extractor.test.ts | 5h | 1.2, 1.3 | ⏳ TODO |
| 1.6 | docs/ENTITY_EXTRACTION.md | 2.5h | All | ⏳ TODO |
| **Total** | | **28 hours** | | |

**Estimated Week:** 1 week (4 days full-time, assuming 7-8 hours/day)

---

## Definition of Done (Phase 1)

- [ ] All 6 subtasks completed
- [ ] Tests passing (95%+ coverage)
- [ ] CLI `extract-entities` command works on sample notes
- [ ] Documentation complete and reviewed
- [ ] Ground truth entity extraction accuracy ≥ 85% on test set
- [ ] Code committed to git with meaningful commit messages
- [ ] Ready to pass to Phase 2 (Code Selector depends on entity extraction output)

---

## Assumptions & Dependencies

**External Dependencies:**
- LLM API access (OpenAI, Anthropic, or Mistral)
- API keys configured in environment

**Internal Dependencies:**
- Phase 0 complete (Stage 2 retrieval working)
- TypeScript project structure set up
- npm/tsx working

**Data Dependencies:**
- Sample clinical notes (real or synthesized)
- Ground truth entity annotations (manual)

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Entity extraction accuracy | ≥85% | Unknown |
| Span correctness | ≥90% | Unknown |
| False positive rate | <5% | Unknown |
| Latency per note | <2s | Unknown |
| Token efficiency | <300 tokens/note | Unknown |

---

## Notes for Implementation

1. **Prompt Engineering:** This is the critical piece. Spend time iterating on the system prompt with examples. Small wording changes can significantly impact extraction quality.

2. **Evidence Spans:** Make sure span extraction is bulletproof. Off-by-one errors or misaligned spans will cause downstream problems in Stage 3 (code selector won't know which text justified a code).

3. **Confidence Scoring:** Consider how Stage 3 will use confidence scores. Low-confidence extractions might warrant skipping them (don't force a code if we're unsure about the entity).

4. **Caching:** If the same clinical note is processed twice, reuse the extraction. This saves API costs and time.

5. **Error Recovery:** What happens if the LLM returns malformed JSON? Implement graceful fallback (lenient parsing, or re-prompt with constraints).

6. **Testing:** Use real clinical language, not synthetic/overly simple examples. Clinical language is ambiguous and context-dependent.

---

**See also** — historical context only. The post-pivot version of this scope lives across the topic hubs: [[../research/topics/corti|Corti hub]] (coding agent), [[../research/topics/prior-auth|PA hub]] (lifecycle), [[../research/topics/sbt|SBT hub]] (credentialed coder identity), [[../research/topics/dispute-window|dispute-window hub]] (claim-lifecycle states), [[../research/topics/x12|X12 hub]] (837/835 round-trip).

