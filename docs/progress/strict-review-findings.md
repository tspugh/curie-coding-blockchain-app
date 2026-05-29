# Strict-review findings — tick 8 (UNIT-3, partd-approvable)

**Date:** 2026-05-29
**Scope:** the 6 files newly added this tick:
- `demo-data/scenarios/partd-approvable/note.md`
- `demo-data/scenarios/partd-approvable/packet.json`
- `demo-data/scenarios/partd-approvable/payer-profile.json`
- `demo-data/scenarios/partd-approvable/requested-drug.json`
- `demo-data/scenarios/partd-approvable/expected-outcome.md`
- `src/protocol/scenarios.partd-approvable.test.ts`

R-citations the unit claims to satisfy: SPEC-0004 §2.1 R1, R2 (partial — 1 of 3),
R4; §2.3 R10; §3.2 (PartD `formularyRelease` discriminant); §3.4 (packet shape).

---

## Second pass (2026-05-29, after first-pass fixes)

Test status: `node --import tsx --test src/protocol/scenarios.partd-approvable.test.ts`
passes 6/6.

### First-pass closure check

| # | Severity | Description (short) | Status |
|---|----------|---------------------|--------|
| 1 | MEDIUM | `_note` references non-existent `scripts/pin-formulary.ts` | **CLOSED** — `_note` field removed from `payer-profile.json`; file now contains exactly `{payerLine, planId, formularyRelease}` per §3.2. |
| 2 | MEDIUM | `_note` underscore-prefix-as-inline-doc antipattern | **CLOSED** — same edit as #1. `payer-profile.json` is now a clean §3.2 shape with no extraneous keys. |
| 3 | LOW | Test doesn't assert `submittedAt`/`submittedBy` from §3.4 | **CLOSED-WITH-CAVEAT** — both fields are now asserted (lines 142-153). See new finding NEW-1 below: the `submittedAt` assertion is broader than §3.4 specifies. |
| 4 | LOW | Defensive fallback for `references` field rename | **CLOSED** — fallback removed; test now reads `packet["references"]` directly (lines 127-128) and fails loudly on rename. |
| 5 | LOW | PHI-scan regex set narrower than R1 rationale | **CLOSED** — three regexes added at test lines 42-59 covering phone (`NNN-NNN-NNNN`, `NNN.NNN.NNNN`, `(NNN) NNN-NNNN`), email, and MRN with 7+ contiguous digits. The synthetic `MRN 000-PARTD-001` slips correctly (3 digits before the dash); the inline comment at lines 53-54 documents the deliberate slip. No false-positive on the synthetic NDC `00074-3799-02` (5-4-2 shape, doesn't match the 3-3-4 phone pattern) or on `2026-01-01` date (4-2-2 shape). |
| 6 | LOW | R2 partial-coverage bookkeeping | **DEFERRED (out of scope)** — flagged for `loop-state.md`, not a code-review concern. Acknowledged. |

### NEW findings introduced by the fix edits

#### NEW-1 LOW | `submittedAt` assertion is broader than §3.4 `Packet` type allows

- `src/protocol/scenarios.partd-approvable.test.ts:142-147`
- §3.4 line 456 defines `submittedAt: number;` — strictly a number, not a
  number-or-string union. The fixture (`packet.json:39`) uses `1748563200`
  (a number), which passes the test via the number branch.
- The current assertion accepts EITHER a positive finite number OR a non-empty
  string:
  ```ts
  assert.ok(
    (typeof submittedAt === "number" && Number.isFinite(submittedAt) && submittedAt > 0) ||
      (typeof submittedAt === "string" && submittedAt.length > 0),
    "packet.submittedAt must be a positive number (unix seconds) or non-empty string (ISO)",
  );
  ```
- Why it matters: this is a *contract* test pinning §3.4. A future fixture that
  lands with `"submittedAt": "2026-05-30T00:00:00Z"` (ISO string) would pass
  the test but fail the §3.4 typed schema — exactly the failure mode the
  first-pass Finding #3 was meant to prevent. The fix tightened the contract
  on `submittedBy` correctly but loosened it on `submittedAt`.
- Severity rationale: LOW because (a) the current fixture uses a number, so
  there's no actual mismatch today, and (b) any production code consuming the
  JSON via the §3.4 `Packet` type would reject a string at the type boundary
  anyway. But the test's job is to be the early-detection layer; accepting
  strings undermines that.
- Suggested fix: tighten to number-only:
  ```ts
  assert.ok(
    typeof submittedAt === "number" && Number.isFinite(submittedAt) && submittedAt > 0,
    "packet.submittedAt must be a positive number (unix seconds) per §3.4",
  );
  ```

### Regression checks (no findings)

- **Removal of `_note` from `payer-profile.json`:** no other code or test
  references that key. Grep across `src/` and `scripts/` confirms zero
  consumers. The two preexisting underscore-prefixed-key fixtures
  (`demo-data/formulary-part-d.json:_comment`,
  `demo-data/fda-indication-adalimumab.json:_curie_note`) are unrelated files
  and were not touched.
- **Removal of the defensive `references` fallback:** the fixture's
  `packet.json` uses the literal field name `references` (line 2). The test
  now reads `packet["references"]` directly. Passes. If §3.4 ever renames
  the field, the test fails loudly with "must have a top-level `references`
  array (SPEC-0004 §3.4)" — exactly the desired behavior.
- **New phone regex against the synthetic NDC `00074-3799-02`:** the regex
  requires `\d{3}[-.]\d{3}[-.\s]?\d{4}` (3-3-4 digit pattern). The NDC is
  5-4-2, doesn't match. No false-positive.
- **New phone regex against dates `2026-01-01`:** 4-2-2 digit pattern, doesn't
  match. No false-positive.
- **New email regex against `note.md`:** the note contains no `@` symbol. No
  false-positive.
- **New MRN regex against the synthetic `MRN 000-PARTD-001`:** the regex
  requires `MRN` followed by 7+ contiguous digits. The synthetic value has
  only 3 digits (`000`) before the `-PARTD` text breaks the digit run.
  Slips correctly. Test passes.
- **`submittedBy` regex `/^0x[0-9a-fA-F]{40}$/`:** the fixture's
  `0x0000000000000000000000000000000000000001` is 0x + 40 hex characters.
  Matches. Correct.

### Carried-over OK items (unchanged from first pass)

- `planId` vs `planIdOrProduct` divergence: test asserts `planId` per §3.2.
- `partd-approvable` scenario reasoning maps to Approve cleanly under R6/R22/R24.
- `submittedBy: 0x…0001` placeholder address acceptable for fixture.
- `contentHash = keccak256("0x")` correct as the empty-bytes well-known hash.
- Test comments are minimal and substantive (PayerLine enum guard, §3.2/R8
  divergence note); no decorative comments.
- Unused imports: none.
- `expected-outcome.md` math (`min(5200, 2100 × 2) = 4200`) matches R24.
- Test isolation: `node:test` + `node:assert/strict`, matches project convention.

---

## Second pass — OVERALL: FAIL (now CLOSED in third pass below)

All 6 first-pass findings addressed; one NEW LOW (NEW-1) introduced by the fix to
finding #3. See third-pass closure below.

---

## Third pass (2026-05-29, after NEW-1 fix)

NEW-1 closed inline: `src/protocol/scenarios.partd-approvable.test.ts:142-146`
now reads:

```ts
const submittedAt = packet["submittedAt"];
assert.ok(
  typeof submittedAt === "number" && Number.isFinite(submittedAt) && submittedAt > 0,
  `packet.submittedAt must be a positive number (unix seconds per §3.4); got ${typeof submittedAt}`,
);
```

This matches §3.4 line 456 exactly (`submittedAt: number;`). The string-branch is
gone — an ISO-string fixture would now fail loudly with the §3.4 citation in the
assertion message. Test re-run: `node --import tsx --test "src/**/*.test.ts"`
returns 27/27 green (UNIT-3 contributes 6, unchanged count).

No additional code edits beyond the NEW-1 fix; no other findings can be reasonably
introduced by tightening one type union to a single type, so the third pass is a
documentation-only confirmation.

### Third-pass OVERALL: PASS — 0 findings

All first-pass findings closed in code (#1, #2, #3, #4, #5) or deferred to loop
bookkeeping (#6 — R2 partial-coverage marker, handled in `loop-state.md`). NEW-1
closed in code. No new findings introduced by the third-pass fix.
