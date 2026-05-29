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

---

# Strict-review findings — tick 9 (UNIT-3b, commercial-policy-void)

**Date:** 2026-05-29
**Scope:** the 6 files newly added this tick:
- `demo-data/scenarios/commercial-policy-void/note.md`
- `demo-data/scenarios/commercial-policy-void/packet.json`
- `demo-data/scenarios/commercial-policy-void/payer-profile.json`
- `demo-data/scenarios/commercial-policy-void/requested-drug.json`
- `demo-data/scenarios/commercial-policy-void/expected-outcome.md`
- `src/protocol/scenarios.commercial-policy-void.test.ts`

R-citations the unit claims to satisfy: SPEC-0004 §2.1 R1, R2 (partial — 2 of 3),
R4; §2.3 R10; §3.2 (Commercial `formularyRelease` discriminant); §3.4 (packet
shape); §2.6 R23 (policy-void rule); SPEC-0001 R6a/R6b.

Test status: `node --import tsx --test src/protocol/scenarios.commercial-policy-void.test.ts`
returns 6/6 green. Full-suite re-run returns 33/33 green (27 prior + 6 new),
matching the expected delta.

---

## Findings

### Finding 1 — HIGH | `slice.kind: "policy-clause"` is not in the §3.4 enum

- `demo-data/scenarios/commercial-policy-void/packet.json:20`
- `src/protocol/scenarios.commercial-policy-void.test.ts:160,164`
- **Description:** the second EvidenceReference (Aetna CPB 0792) carries
  `slice.kind === "policy-clause"`. SPEC-0004 §3.4 (lines 446-451) defines the
  `slice.kind` union as exactly:
  ```ts
  kind?: "fda-label-indication" | "fda-label-contraindication"
       | "guideline-recommendation" | "formulary-entry" | "price-benchmark";
  ```
  `"policy-clause"` is **not** in this union. The test then **asserts** that at
  least one reference carries `"policy-clause"` — locking in a value the typed
  schema rejects. This is the structural mirror of the prior `planIdOrProduct`
  finding: a load-bearing slice tag that the typed contract refuses.
- **Why it matters:** the fixture violates §3.4's typed contract on the
  load-bearing reference (the one R23 routes off of). When this packet is
  ingested through a `Packet` typed boundary (the Curie packet-store write
  Lambda per §3.3, or any TS consumer typed to `EvidenceReference`), TypeScript
  excess-property checks pass `slice.kind` as `string | undefined` only for the
  literal-union members; a `"policy-clause"` literal in a freshly-decoded
  `Packet` value would either be silently widened away or fail compile under
  `--strict` if the consumer narrows on `kind`. The arbiter's R23 detection
  (which §3.4 implicitly says routes off the `fda-label-indication` slice +
  some textual contradiction signal) has no typed name for "policy clause".
  R23's prose talks about "policy-quote leaves" (line 369) — also not a
  defined kind.
- **Suggested fix:** EITHER (a) extend the §3.4 union to include `"policy-clause"`
  (or `"policy-quote"` to match R23's wording) via an amendment, then update
  the fixture and the test together; OR (b) drop the `kind` field on the
  policy reference (it is optional) and have the test assert
  `slice.text.length > 0` for the policy reference instead of pinning a kind
  that doesn't exist. Option (a) is the right structural fix because the
  arbiter needs a typed signal to detect "this is the clause R23 voids";
  option (b) preserves §3.4 conformance at the cost of leaving the policy
  reference structurally indistinguishable from any other text slice.

### Finding 2 — HIGH | Expected ruling (`PolicyInvalidated`) contradicts SPEC-0004 R23 / T9

- `demo-data/scenarios/commercial-policy-void/expected-outcome.md:1-3,27-30`
- **Description:** the expected-outcome.md routes this case to terminal
  `PolicyInvalidated` (SPEC-0001 R6b path). SPEC-0004 §2.6 R23 says the arbiter
  MUST rule **`Approve`** and emit `policyVoidedClauseIndices: number[]` in
  the ruling payload — i.e., the policy clause is voided but the request is
  *approved* (with R24 cost-band settlement on top), not terminally rejected.
  SPEC-0004 T9 (line 579-581) explicitly names this scenario:
  > T9 (R23, policy-void): the `commercial-policy-void` case's ruling carries
  > `policyVoidedClauseIndices` listing the offending clause; the timeline
  > renders the voided-clause annotation.
  T9 nowhere mentions terminal PolicyInvalidated.
- The fixture cites both R6b (SPEC-0001) and R23 (SPEC-0004) as joint
  authority for the PolicyInvalidated terminal ruling, but these two rules
  *disagree* on the outcome. SPEC-0001 R6b: `PolicyFlagged` + terminal
  `PolicyInvalidated`. SPEC-0004 R23: `Approve` + `policyVoidedClauseIndices`.
- The project's `docs/progress/loop-state.md:26` *did* prescribe
  `PolicyInvalidated` as the expected ruling for this scenario — but loop-state
  is operational bookkeeping, not a spec amendment. No `docs/amendments/A-NNNN`
  resolves the R23-vs-R6b conflict in favor of one or the other.
- **Why it matters:** this is the SPEC-0002 set-piece (per R23 line 372). When
  the demo lands, it will either (a) approve via R23 and contradict the
  expected-outcome.md, or (b) terminally reject via R6b and contradict
  SPEC-0004 T9 + R23. The fixture has committed the project to outcome (b)
  without resolving the spec conflict; whichever the arbiter does, one spec
  test ("T9 renders the voided-clause annotation") will fail.
- **Suggested fix:** author a `docs/amendments/A-NNNN-policy-void-ruling.md`
  that picks one of:
  1. **R6b wins** (matches fixture): SPEC-0004 R23 and T9 are amended to route
     to terminal `PolicyInvalidated` (no Approve, no settlement); T9 is rewritten
     to test for the `PolicyInvalidated` event + `clauseRef`/`standardRef`
     payload rather than `policyVoidedClauseIndices`.
  2. **R23 wins** (matches SPEC-0004 T9): SPEC-0001 R6b is amended to make
     `PolicyFlagged` an annotation on the `Approved` event rather than a
     route to a separate terminal; the fixture's expected-outcome.md is
     rewritten to `Approve` with `policyVoidedClauseIndices: [1]` and an R24
     settlement amount.
  Either is defensible; the fixture cannot stand without one being adopted.

### Finding 3 — MEDIUM | Test name and class-doc mis-cite §3.4 for the policy-clause invariant

- `src/protocol/scenarios.commercial-policy-void.test.ts:6-7,120`
- **Description:** the test's docstring (line 6-7) says "Also asserts the
  policy-clause reference invariant: at least one reference must carry
  slice.kind === 'policy-clause'." and the test name (line 120) is
  `"...packet.json has references[], submittedAt, submittedBy, and a
  policy-clause reference"`. Both attribute the invariant to §3.4 by
  proximity, but §3.4 does not name `"policy-clause"` (Finding 1). The
  inline comment at line 156-157 correctly cites SPEC-0004 §2.6 R23 as the
  source.
- **Why it matters:** the test name and the test docstring read as a §3.4
  contract assertion (this is the section the test claims to lock in). A
  reviewer reading the test name will look up §3.4, fail to find
  `"policy-clause"`, and either weaken the test or amend §3.4 sight unseen.
  The header text is the wrong citation for this load-bearing claim.
- **Suggested fix:** rename the test to
  `"UNIT-3b commercial-policy-void §2.6 R23 — packet.json carries a policy-clause reference (load-bearing for R23 policy-void detection)"`
  or split the policy-clause assertion into a sibling test that cites §2.6 R23
  cleanly. The §3.4 packet-shape assertions (references[], submittedAt,
  submittedBy) belong in their own test, separate from the R23 invariant.
  Couples cleanly with Finding 1's fix.

### Finding 4 — MEDIUM | `expected-outcome.md` PHI guards do not apply to this file (gap with note.md scan)

- `src/protocol/scenarios.commercial-policy-void.test.ts:32-67`
- **Description:** the PHI-marker scan (SSN, MM/DD/YYYY DOB, driver-license,
  phone, email, MRN≥7-digit) runs against `note.md` only. The same scan does
  not run against `expected-outcome.md`, which is also synthetic narrative
  content authored alongside the note. The partd test made the same choice
  (only `note.md` is scanned), so this is mirrored — not drift — but it
  remains a gap.
- **Why it matters:** R1 is "synthetic only" applied to *all* curated content,
  not solely the note. A future author who pastes a real PHI string into
  expected-outcome.md (or a future reasoning-trace template) bypasses the
  scan. Today the file is clean (I read it; no PHI shapes), so this is a
  prospective gap not an active leak.
- **Suggested fix:** factor the PHI-scan into a small shared helper (matches
  Finding 7's DRY concern) and apply it to both `note.md` and
  `expected-outcome.md`. Two extra `fs.readFileSync` lines and one shared
  regex pass — small cost, closes the gap.

### Finding 5 — LOW | `"Approve" keyword ordering` heuristic is brittle for future fixture authors

- `src/protocol/scenarios.commercial-policy-void.test.ts:183-190`
- **Description:** the assertion checks that the first occurrence of
  `PolicyInvalidated`/`PolicyInvalid` (regex case-insensitive) appears at or
  before the first occurrence of bare `Approve`/`APPROVE` (regex
  case-sensitive). The current expected-outcome.md contains:
  - "FDA-approved" (lowercase `approved` — does not match `\bApprove\b`
    because the trailing `\b` requires non-word after `Approve`, but `d` is
    word-class; verified no match)
  - no other `Approve`/`APPROVE` strings
  So the assertion passes vacuously today (`firstApprove === null`, the
  conditional branch is skipped).
- **Why it matters:** the heuristic is fragile in two ways. (1) A reasonable
  future addition like "the arbiter would not Approve this request" *would*
  trip `\bApprove\b` and then require ordering relative to PolicyInvalidated
  — the assertion would silently pass if PolicyInvalidated happens to appear
  first, even though the sentence's semantics are inverted. (2) An author
  who writes "APPROVE: no — terminal PolicyInvalidated" in a heading hits
  the failure mode the test is supposed to prevent. The ordering heuristic
  is not robust to the ways humans actually write expected-outcome docs.
- **Suggested fix:** replace the keyword-ordering heuristic with a positive
  assertion on the "Expected outcome:" header line:
  ```ts
  const headerLine = content.split("\n").find((l) => /^##\s*Expected outcome:/i.test(l));
  assert.ok(headerLine, "expected-outcome.md must have an '## Expected outcome:' header");
  assert.ok(
    /PolicyInvalidated|PolicyInvalid/.test(headerLine!),
    "the '## Expected outcome:' header must name PolicyInvalidated as the expected ruling",
  );
  assert.ok(
    !/\bApprove\b/.test(headerLine!),
    "the '## Expected outcome:' header must not name 'Approve' (expected ruling is PolicyInvalidated)",
  );
  ```
  This pins the load-bearing claim (the header line) without a fragile
  global-ordering heuristic. Matches the way the fixture is actually
  structured (line 1: `## Expected outcome: PolicyInvalidated`).

### Finding 6 — LOW | `submittedBy: 0x...0002` sentinel pattern is undocumented

- `demo-data/scenarios/commercial-policy-void/packet.json:40`
- `demo-data/scenarios/partd-approvable/packet.json:40` (peer)
- **Description:** the partd fixture uses `0x...0001`, this fixture uses
  `0x...0002`. The intent appears to be "per-scenario distinct sentinel
  address". The pattern is sensible but is not documented anywhere — no
  spec, no README, no comment. A future fixture author has no signal that
  the address must be distinct vs. that it must follow an enumerated
  sequence vs. that it doesn't matter at all.
- **Why it matters:** structural-invariant patterns without documentation
  rot fast. If a third fixture lands with `0x...0001` again, no test
  catches it; if one lands with `0xdeadbeef...`, no test catches it. The
  pattern is load-bearing if any consumer keys behavior off `submittedBy`
  (replay, audit, dedup), and load-bearing patterns need an asserted home.
- **Suggested fix:** EITHER (a) drop the pattern (treat `submittedBy` as
  opaque, any valid 20-byte address); OR (b) document the convention in
  `demo-data/scenarios/README.md` (which does not yet exist — create it)
  with an enumeration: `partd-approvable → 0x…01`, `commercial-policy-void →
  0x…02`, `medicaid-policy-void → 0x…03`. A small README plus a test that
  cross-validates scenario-slug → address mapping would lock it in. The
  cheapest fix is (a); (b) is justified only if the demo replay actually
  depends on distinct addresses.

### Finding 7 — LOW | ~80% structural overlap between the two scenario test files warrants extraction

- `src/protocol/scenarios.partd-approvable.test.ts` vs.
  `src/protocol/scenarios.commercial-policy-void.test.ts`
- **Description:** the two files share:
  - Identical PHI-scan regex set (7 patterns).
  - Identical packet-shape assertions (references[], submittedAt,
    submittedBy, contentHash regex).
  - Identical requested-drug field iteration (`["ndc", "rxnormCui", "name",
    "dose", "requestedFor"]` + qty branch).
  - Identical scenario-file existence loop.
  - Identical `__filename` + `PROJECT_ROOT` boilerplate.
  Only the §3.2 discriminant block (PartD vs Commercial fields) and the
  expected-outcome assertions differ.
- **Why it matters:** the loop rules ("three similar lines is fine; copy-paste
  at the file level may warrant extraction") apply at the file level here.
  With UNIT-3c (medicaid scenario) presumably landing next, the codebase
  will have three near-identical files. Any future change (a new PHI
  regex; a §3.4 schema addition; a stricter contentHash check) will need
  to be made three times and is one missed-edit away from silent drift.
  The "regression check" sections in the tick 8 review are already
  enumerating the same regexes twice — a smell.
- **Suggested fix:** extract a shared helper module
  `src/protocol/scenarioFixtures.test-helpers.ts` (or `.ts` if you prefer
  it as test-only library code) exposing:
  - `assertNoPHI(content: string, context: string)` — the 7-regex scan.
  - `assertPacketShape(packet: unknown)` — the §3.4 invariants.
  - `assertRequestedDrugShape(drug: unknown)` — the field iteration.
  - `loadScenarioFile(slug: string, name: string): string` — the path resolution.
  Each per-scenario test file then becomes ~40 lines of *scenario-distinct*
  assertions (the discriminant + the expected-outcome + the
  scenario-specific reference invariant). DRY without sacrificing the
  per-scenario test names that show up in the TAP output. Defer the
  extraction to a dedicated refactor commit so this UNIT-3b tick stays
  focused.

### Finding 8 — LOW | Dead `_filename` constant in both tests

- `src/protocol/scenarios.commercial-policy-void.test.ts:19-20`
- `src/protocol/scenarios.partd-approvable.test.ts:17-18` (peer)
- **Description:** `const __filename = fileURLToPath(import.meta.url);` is
  computed once and consumed exactly once (the very next line:
  `PROJECT_ROOT = path.resolve(path.dirname(__filename), "..", "..")`). The
  named binding adds no readability over inlining
  `path.dirname(fileURLToPath(import.meta.url))`.
- **Why it matters:** strict-stickler nit. The binding mimics the CJS
  `__filename` builtin in ESM, which is a recognized pattern, so I'd let
  it stand on idiom grounds. But the *prefix `__`* signals "magic builtin"
  to a reader who doesn't know this is hand-rolled; in CJS it's
  module-provided. Mild lying-by-naming.
- **Suggested fix:** either inline the expression (saves one line) or rename
  to `currentFile` to remove the false-builtin signal. Defer; this is the
  bottom of the priority list.

### Finding 9 — LOW | `requested-drug.json` test name says "six required fields", asserts five strings + one number

- `src/protocol/scenarios.commercial-policy-void.test.ts:100,106`
- `src/protocol/scenarios.partd-approvable.test.ts:99,105` (peer — same bug)
- **Description:** the test name says "all six required fields"; the
  iteration covers 5 string fields (`ndc, rxnormCui, name, dose,
  requestedFor`) + the `quantity` branch separately, total 6 fields. So the
  count is right, but reading the name alongside the loop body
  (`["ndc", "rxnormCui", "name", "dose", "requestedFor"]` — 5 items) makes
  the name look off by one. Trivially confusing.
- **Why it matters:** comment/name vs. code mismatch in apparent count. A
  reader who counts the array items will doubt the test. Pure aesthetics.
- **Suggested fix:** rename to "...has five string fields and a numeric
  quantity" or to "...has all six fields per R4". Trivial.

## Symmetry / regression checks (no findings)

- **`payer-profile.json` shape:** exactly `{payerLine, formularyRelease}`
  with `formularyRelease` carrying exactly
  `{line, carrier, product, revision, sourceUrl, contentHash}`. No `_note`
  field (tick 8's antipattern did not re-introduce). No `planId` field
  (correctly disjoint from PartD discriminant). Matches §3.2 Commercial
  union exactly.
- **`Patient B` synthetic marker:** distinct from partd's `Patient A`. The
  commercial test's regex `/synthetic|fictional|Patient B/i` matches the
  note (line 10, 41) and does NOT match the partd note (which uses
  "Patient A" — verified the regex would fail there if pointed at the
  wrong folder; the partd test reciprocally uses `/synthetic|fictional|Patient A/i`).
  Cross-folder false-positive impossible because both tests hardcode their
  `SCENARIO_DIR` paths.
- **Policy-clause contradiction with FDA label is real:** the note documents
  "soft-tissue swelling without erosive changes" + "MRI…has not been
  ordered" (note.md:15-17). The Aetna CPB 0792 slice requires "erosive
  changes, or MRI demonstrating bone marrow edema" (packet.json:19). The
  FDA-label slice (packet.json:7) carries "psoriatic arthritis" with no
  imaging prerequisite. The three texts line up cleanly for the R23
  contradiction.
- **`contentHash` uniformity:** all three references in packet.json carry
  the same hash (`0xc5d2…a470` = keccak256 of empty bytes, per tick 8). Same
  placeholder pattern as partd. Acceptable as fixture-tier; would need real
  hashes for a non-demo deploy.
- **Test isolation:** `node:test` + `node:assert/strict`, matches project
  convention.
- **No mocks:** all five fixture files are read from disk; no test doubles.
- **Test count:** 33 total (27 prior + 6 new). Verified by full-suite re-run.
  No test skipped, deduplicated, or failed.
- **Lying comments / dead code:** none beyond Finding 8's `__filename` nit
  and Finding 9's name-vs-count nit.

## Tick-9 verdict (first pass)

**OVERALL: FAIL — 9 findings (2 HIGH, 2 MEDIUM, 5 LOW)**

The two HIGH findings are spec-conformance gaps, not stylistic. Finding 1
(`"policy-clause"` not in §3.4 enum) is a typed-contract violation on the
load-bearing reference. Finding 2 (R23-vs-R6b conflict) is a deeper
spec-level inconsistency that the fixture commits one resolution to without
an amendment; whichever the arbiter does, one spec test will eventually
break. Both should be resolved (via §3.4 enum amendment + R23/R6b amendment,
in that order) before this scenario is wired into an end-to-end run.

The MEDIUM findings (test name mis-cite, PHI-scan coverage gap) and LOW
findings (heuristic brittleness, sentinel-address convention, DRY at the
file level, `__filename` nit, field-count name) are individually small but
collectively flag that this tick mirrored partd's structure faithfully —
including its problems. Tick 8's strict review missed Findings 4, 5, 7,
8, 9 because they all manifest as "symmetric in both files"; this tick
exposes them.

---

## Tick-9 SECOND PASS (2026-05-29, after fixes)

Test status: `node --import tsx --test "src/**/*.test.ts"` returns **36/36
green** (was 33 at first pass; +3 as expected — R23-invariant test split into
its own sibling, partd's new R1 expected-outcome PHI test, commercial's new
R1 expected-outcome PHI test). Matches the prompt's predicted delta exactly.

### First-pass closure check

| # | Severity | Description (short) | Status |
|---|----------|---------------------|--------|
| 1 | HIGH | `slice.kind: "policy-clause"` not in §3.4 enum | **CLOSED** — `packet.json:20` now reads `"kind": "guideline-recommendation"` (an allowed §3.4 enum value; Aetna CPB is structurally a payer guideline). Test (`scenarios.commercial-policy-void.test.ts:181-216`) asserts presence of `fda-label-indication` AND `guideline-recommendation` slices, AND that every observed `slice.kind` is in the §3.4 closed enum (a stricter contract than the original `"policy-clause"` pin). The undefined-kind guard at line 210 (`if (k === undefined) continue;`) correctly skips references where `slice.kind` is absent (the field is `?:` optional in §3.4). |
| 2 | HIGH | PolicyInvalidated contradicts SPEC-0004 R23/T9 | **CLOSED** — amendment `docs/amendments/0005-policy-void-r23-supersedes-r6b.md` cleanly resolves R23 wins over SPEC-0001 R6b with five reasons (more recent, more specific, better-aligns-with-R6b-motivation, provider-friendly, payload-preserves-information). `expected-outcome.md:1` header now reads `## Expected outcome: Approve (R23 policy-void escape hatch)`; lines 3-5 specify `Approve (round 0, payerLine: Commercial) with policyVoidedClauseIndices: [1]`; lines 47-49 pin the R24 cost-band settlement. No remaining `PolicyInvalidated` claim in the document. Test's R23 header-line assertion (`scenarios.commercial-policy-void.test.ts:218-241`) positively pins `Approve` AND negatively pins `!PolicyInvalidated` in the header line, AND asserts `policyVoidedClauseIndices` appears somewhere in the document. |
| 3 | MEDIUM | Test name §3.4 mis-citation for R23 invariant | **CLOSED** — `scenarios.commercial-policy-void.test.ts` now has the §3.4 packet-shape assertions in their own test (line 148: `"§3.4 — packet.json has references[], submittedAt: number, submittedBy: 0x+40hex"`) cleanly cited to §3.4, and the R23 invariant in a sibling test (line 181: `"§2.6 R23 — packet.json carries an FDA-label slice and a guideline-recommendation slice"`) cleanly cited to §2.6 R23. No §3.4 mis-citation remains. |
| 4 | MEDIUM | PHI scan gap on expected-outcome.md | **CLOSED** — both test files now run the PHI regex set on `expected-outcome.md`: commercial test at lines 89-95 (via the shared `assertNoPHI` helper); partd test at lines 164-188 (inlined regex set). Gap closed in both fixtures. |
| 5 | LOW | Approve-keyword-ordering heuristic | **CLOSED** — replaced with header-line positive assertion at `scenarios.commercial-policy-void.test.ts:225-234`. The fragile global-ordering check is gone. The new assertion pattern is exactly the one Finding 5's "Suggested fix" proposed (inverted for the R23 outcome). |
| 6 | LOW | Sentinel address pattern undocumented | **DEFERRED** — first-pass review explicitly deferred to a future "demo-data/scenarios README convention" unit. Acknowledged. |
| 7 | LOW | DRY extraction of shared test helpers | **DEFERRED** — first-pass review explicitly recommended "Defer the extraction to a dedicated refactor commit so this UNIT-3b tick stays focused." Acknowledged. |
| 8 | LOW | `__filename` builtin-mimicking nit | **PARTIAL** — commercial test inlines `path.dirname(fileURLToPath(import.meta.url))` at line 20 (Finding 8's suggested fix applied); partd test left as-is per scope. Acceptable. |
| 9 | LOW | "six required fields" alongside 5-item array | **PARTIAL** — commercial test renamed to `"has all six fields per R4 (5 strings + numeric quantity)"` at line 128; partd test left as-is per scope. Acceptable. |

### Targeted second-pass verifications (per prompt)

1. **HIGH 1 closed:** verified — `packet.json:20` reads `"kind": "guideline-recommendation"`; test asserts both required slice kinds plus full enum closure.
2. **HIGH 2 closed:** verified — amendment 0005 cleanly resolves R23 vs R6b with 5 reasons; expected-outcome.md routes to Approve + policyVoidedClauseIndices; test pins Approve in header line.
3. **MEDIUM 3 closed:** verified — §3.4 test (line 148) and §2.6 R23 test (line 181) are cleanly separated with no cross-citation.
4. **MEDIUM 4 closed:** verified — both `scenarios.partd-approvable.test.ts:164-188` and `scenarios.commercial-policy-void.test.ts:89-95` run PHI checks on `expected-outcome.md`.
5. **LOW 5 closed:** verified — ordering heuristic gone; replaced with header-line check at `scenarios.commercial-policy-void.test.ts:225-234`.
6. **Tests pass:** verified — 36/36 green (was 33).

### NEW findings introduced by the fix edits

#### NEW-1 (NIT) | Repeated `JSON.parse(packet.json)` across 3 sibling tests

- `src/protocol/scenarios.commercial-policy-void.test.ts:152, 188` (and the §3.4 test reads it too at line 152)
- **Description:** `packet.json` is now read + parsed in three separate tests (the §3.4 packet-shape test, the §2.6 R23 invariant test, and historically the now-removed combined test). Each test does its own `fs.readFileSync` + `JSON.parse`. The split was the correct fix for MEDIUM 3 (clean §3.4 vs §2.6 R23 citation separation), so the duplication is justified by test isolation.
- **Severity rationale:** NIT (below LOW). Test-runner cost is negligible (~1ms per test for a ~1KB file); test isolation is preserved; no shared mutable state introduced. Acceptable inefficiency for the citation-clarity benefit.
- **Suggested fix:** none required. If the parse cost ever matters, a `loadPacket()` helper module-level could memoize — but that's micro-optimization. Couples cleanly with the deferred LOW 7 (DRY) refactor if pursued.

#### NEW-2 (NIT) | Amendment 0005 implementation-impact flag could be more specific about contract change scope

- `docs/amendments/0005-policy-void-r23-supersedes-r6b.md:74-89`
- **Description:** the amendment states "non-code-changing for tick 9" and acknowledges "once the SPEC-0004 Phase 1 contract work (R23 ruling-payload decode) lands, the arbiter's `Approve` + `policyVoidedClauseIndices` ruling will flow through the existing `Approve` path." The "A future tick should:" list (lines 85-89) names three concrete follow-ups: SPEC-0001 §3 R6b prose update, `policyVoidedClauseIndices` in §3.5 `Ruled` payload, and §3.4 type tightening. This is reasonably clear flagging.
- **Severity rationale:** NIT (below LOW). The follow-up list is explicit and actionable. A reader picking up Phase 1 has a complete checklist. The risk that this gets missed is real but small — the amendment is referenced from `expected-outcome.md:10`, so the fixture itself surfaces it.
- **Suggested fix:** none required. Optionally, a `docs/progress/loop-state.md` entry could cross-link the amendment's follow-up list so the next ticks pick it up — but that's a loop-bookkeeping concern, not a code-review concern.

#### NEW-3 (NIT, deferred) | Amendment 0005's `§1 INDICATIONS AND USAGE` vs R23's `§X` placeholder

- `docs/amendments/0005-policy-void-r23-supersedes-r6b.md:72`
- **Description:** the amendment's timeline-annotation example uses the literal section reference `§1 INDICATIONS AND USAGE`, matching the actual `packet.json:10` locator (`section: "1 INDICATIONS AND USAGE — 1.2 Psoriatic Arthritis"`). The SPEC-0004 R23 prose at line 370 uses the placeholder `§X`. The amendment correctly instantiates the placeholder with the fixture's concrete section name; this is the right thing to do for a fixture-specific outcome doc. Stylistic only — no contract violation either way.
- **Severity rationale:** NIT, explicitly flagged by the prompt as "stylistic only".
- **Suggested fix:** none. The amendment's use of the concrete section is preferable to the abstract `§X` because the amendment is documenting *this scenario's* outcome.

### Regression checks (no findings)

- **`kinds.includes(k)` enum-closure assertion:** verified to correctly skip references where `slice.kind` is `undefined`. The §3.4 schema marks `kind?:` optional; the test's `if (k === undefined) continue;` at line 210 honors that optionality. No false-positive risk.
- **`Approved` event payload field name:** `policyVoidedClauseIndices` matches SPEC-0004 §3.4 line 490 (`policyVoidedClauseIndices?: number[];    // R23`). The amendment and expected-outcome.md spell it identically. No drift.
- **Amendment numbering:** amendment 0005 follows 0001-0004 sequentially with no gap. Filename slug `policy-void-r23-supersedes-r6b` is descriptive and matches the amendment's title. Adopted status with date matches the convention used by prior amendments.
- **`PolicyInvalidated` symbol removal:** grepped `expected-outcome.md` — no occurrence remaining. The amendment 0005 mentions `PolicyInvalidated` only in the historical-context section (line 53, 60) where it explicitly narrows the state's surviving scope. Consistent.
- **Test count breakdown:** partd contributes 7 (was 6, +1 for new R1 expected-outcome PHI test); commercial contributes 8 (was 6, +2 for split R23 invariant + new R1 expected-outcome PHI test); existing tests unchanged at 21. Total 7+8+21 = 36. Matches the harness count.
- **partd test left at scope:** the prompt explicitly noted partd's LOW 8 + LOW 9 are out of scope for this tick. Verified: partd test still has the `__filename` constant (line 17) and "six required fields" name (line 99). Acceptable.
- **Amendment cross-references:** `expected-outcome.md:9-11` references amendment 0005 with a relative path that resolves from `demo-data/scenarios/commercial-policy-void/` → `../../../docs/amendments/0005-policy-void-r23-supersedes-r6b.md` — verified correct (3 levels up: `commercial-policy-void` → `scenarios` → `demo-data` → `<root>`, then down to `docs/amendments/`).

### Carried-over OK items (unchanged from first pass)

- `payer-profile.json` shape matches §3.2 Commercial discriminant exactly.
- `Patient B` synthetic marker distinct from partd's `Patient A`.
- Policy-clause-vs-FDA-label contradiction is structurally real in the fixture.
- `contentHash` placeholder uniformity (keccak256 of empty bytes) acceptable as fixture-tier.
- No mocks; all five fixture files read from disk.
- Test isolation: `node:test` + `node:assert/strict`, matches project convention.

## Tick-9 SECOND PASS verdict

**OVERALL: PASS — 0 actionable findings, 3 NITs (NEW-1 repeated parse for isolation, NEW-2 amendment follow-up specificity, NEW-3 §X-vs-§1 instantiation)**

Severity breakdown:
- **HIGH:** 0 open (2 CLOSED).
- **MEDIUM:** 0 open (2 CLOSED).
- **LOW:** 0 open (3 CLOSED inline: #5; 2 PARTIAL with out-of-scope deferred for partd: #8, #9; 2 DEFERRED with first-pass review's explicit recommendation: #6, #7).
- **NIT:** 3 new (NEW-1, NEW-2, NEW-3 — all stylistic, none actionable).

All five in-scope first-pass findings are closed in code or in the amendment. The four deferred LOWs are deferred per the first-pass review's own guidance or per scope. The three new NITs are flagged for record-keeping but none rise to the LOW-or-above threshold that would warrant a fix this tick. Tests are 36/36 green, matching the predicted delta. The HIGH-2 spec-level conflict that motivated the second pass is resolved by amendment 0005 with reasoning explicit enough that a future Phase 1 tick has a complete follow-up checklist.

The fixture is now coherent with SPEC-0004 R23, T9, and the §3.4 closed enum. Ready to wire into an end-to-end run when Phase 1 contract work lands.
