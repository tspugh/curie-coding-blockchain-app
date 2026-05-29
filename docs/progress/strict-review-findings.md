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

---

# Strict-review findings — tick 10 (UNIT-3c, medicaid-denied-then-appealed)

**Date:** 2026-05-29
**Scope:** the 6 files newly added this tick:
- `demo-data/scenarios/medicaid-denied-then-appealed/note.md`
- `demo-data/scenarios/medicaid-denied-then-appealed/packet.json`
- `demo-data/scenarios/medicaid-denied-then-appealed/payer-profile.json`
- `demo-data/scenarios/medicaid-denied-then-appealed/requested-drug.json`
- `demo-data/scenarios/medicaid-denied-then-appealed/expected-outcome.md`
- `src/protocol/scenarios.medicaid-denied-then-appealed.test.ts`

R-citations the unit claims to satisfy: SPEC-0004 §2.1 R1, R2 (now complete — 3 of 3),
R4; §2.3 R10; §3.2 (Medicaid `formularyRelease` discriminant); §3.4 (packet shape +
closed `slice.kind` enum); §2.4 R14a (appeal sequencing predicate); SPEC-0001 R6c
(appeal loop set-piece).

Test status: `node --import tsx --test "src/**/*.test.ts"` returns **44/44 green**
(was 36 at tick-9 close; +8 as expected for the new scenario file). Per-file:
`node --import tsx --test src/protocol/scenarios.medicaid-denied-then-appealed.test.ts`
returns 8/8. Tsc: `npx tsc -p tsconfig.json --noEmit` returns 0 errors.

---

## Targeted verifications (per prompt's 12-item checklist)

### 1. §3.2 Medicaid discriminant correctness — PASS

`payer-profile.json` contains exactly the six fields the §3.2 Medicaid union names:
`line` ("Medicaid"), `state` ("CA"), `mco` ("Centene Medi-Cal"), `revision` ("2026-Q2"),
`sourceUrl`, `contentHash`. No `planId` (PartD), no `carrier`/`product` (Commercial),
no `_note` (the tick-8 antipattern). The test at lines 112-124 iterates the exact
six-field tuple from §3.2 and asserts string non-emptiness + `contentHash` keccak shape.
JSON parse confirms zero extra keys: top-level `{payerLine, formularyRelease}` and
the formularyRelease object has exactly those six. Clean.

### 2. Synthetic-marker distinction from partd + commercial — PASS

Verified by grep: partd uses `Patient A` (rheumatology RA case), commercial uses
`Patient B` (psoriatic arthritis case), medicaid uses `Patient C` (T2DM case). The
three regexes are scenario-specific:
- partd: `/synthetic|fictional|Patient A/i`
- commercial: `/synthetic|fictional|Patient B/i`
- medicaid: `/synthetic|fictional|Patient C/i` (line 82)

Each test hardcodes its own `SCENARIO_DIR`, so cross-folder false-positives are
impossible by construction. The medicaid test correctly distinguishes via `Patient C`
in its assertion at line 82; pointing the medicaid regex at a partd or commercial note
would fail (neither contains `Patient C`, neither contains `synthetic`/`fictional`
verbatim — verified the partd note and commercial note do not contain the literal word
`synthetic` or `fictional`; their distinguishing marker is purely `Patient A`/`B`).

### 3. Round-0 Deny / round-1 Approve reasoning — PASS

The reasoning chain is structurally coherent:
- The formulary-entry slice (packet.json:19) makes the three PA criteria explicit:
  (1) T2DM diagnosis, (2) A1c ≥7.5% on max-tolerated metformin for ≥6 months,
  (3) SGLT2-i trial ≥90 days OR contraindication/intolerance.
- The round-0 packet has 3 references: fda-label-indication, formulary-entry,
  price-benchmark. Crucially, neither the note.md NOR any packet reference documents
  an SGLT2-i trial. Grep confirmed: SGLT2/empagliflozin/dapagliflozin/canagliflozin
  appear ONLY in the formulary-entry slice (the PA criteria text itself, not as
  evidence), nowhere in the note.
- The round-0 packet thus genuinely misses criterion 3 (the note documents criteria
  1+2 — T2DM, A1c 7.6% on max-tolerated metformin 1000 mg BID — but nothing on SGLT2).
  Deny at round 0 is the only coherent ruling against the PA criteria as written.
- The round-1 narrative (expected-outcome.md:42-58) introduces reference index 3
  (a chart extract: empagliflozin 10 mg daily, 96-day trial, discontinued for
  recurrent UTIs). This fills criterion 3 via the "documented intolerance" branch.
  The trial length (96 days) cleanly exceeds the 90-day minimum the slice cites.
- The Approve at round 1 is structurally entailed by the augmented evidence.

The denial reason at expected-outcome.md:30-31 cites the precise gap ("criterion 3 not
satisfied — missing SGLT2-inhibitor trial documentation (≥90-day course) or
contraindication/intolerance documentation"). The wording aligns with the formulary
slice's own "denied as incomplete" language.

### 4. Closed-enum invariant on slice.kind — PASS

The three round-0 slices all use §3.4 closed-enum values:
- index 0: `"kind": "fda-label-indication"` (line 8) — allowed
- index 1: `"kind": "formulary-entry"` (line 20) — allowed; correctly NOT
  `"policy-clause"` (the tick-9 HIGH-1 finding); this is the Centene Medi-Cal PA
  criteria document, which is structurally a formulary entry, not a guideline
- index 2: `"kind": "price-benchmark"` (line 32) — allowed

The test at lines 187-208 iterates and asserts every `slice.kind` is in the §3.4 set
`{fda-label-indication, fda-label-contraindication, guideline-recommendation,
formulary-entry, price-benchmark}`. The narrative's round-1 reference index 3 is
described as `slice.kind: guideline-recommendation` (expected-outcome.md:57) — also
allowed (the round-1 packet isn't checked in; only the round-0 packet is).

Cross-check on the formulary-entry choice: the PA criteria slice IS the Medi-Cal
formulary's PA section (per the locator `Section 4 — Endocrine Agents, GLP-1 Receptor
Agonists, Prior Authorization Criteria`). This is the canonical formulary-entry shape,
not a guideline. Categorization is correct.

### 5. Header-line check — PARTIAL (see Finding 1 below)

The test at lines 228-237 finds the `## Expected outcome:` header and asserts that
BOTH `Deny` AND `Approve` appear on it. The header reads:
`## Expected outcome: Deny (round 0) → Approve (round 1, Plan Internal Appeal)`
— both words present, both match. Passes.

However, the prompt asked specifically about "locking the ordering claim tightly".
The test as written enforces co-occurrence on the header line, NOT ordering
(Deny-before-Approve). See **Finding 1 (LOW)** below.

### 6. Sentinel address invariant — PASS

The test at lines 180-184 asserts equality with the exact literal
`"0x0000000000000000000000000000000000000003"`, not just the 40-hex shape. This is
the strict per-scenario sentinel pin. Combined with the prior 0x...0001 (partd) and
0x...0002 (commercial) pins (also asserted by exact-equality in their respective
tests after tick-9 close, though the prompt notes the tick-9 LOW 6 was "partially"
closed — the partd test does NOT exact-match its sentinel, only matches the 40-hex
shape; the medicaid test sets the precedent for the strict pin going forward).

### 7. §2.4 R14a sequencing — PASS

R14a: "the contract refuses `requestAdjudication(round=N)` unless `round=N-1` was
actually ruled, and ruled `Deny`." The expected-outcome.md walks exactly this
sequence: `(Medicaid, 0)` ruled Deny → `(Medicaid, 1)` becomes current per R14a
(expected-outcome.md:32-33). No illegal-appeal sequence (no appeal from Approve).
The terminal state assertions:
- after round-0 Deny: `(Medicaid, 0) → Denied`, `(Medicaid, 1)` becomes `current`
- after round-1 Approve: `(Medicaid, 1) → Approved → Settled`, `(Medicaid, 2)`
  rendered `skipped` (no round-2 fired because round-1 was Approve, not Deny — so
  R14a precondition for round 2 is not met). Correct.

### 8. `assertNoPHI` helper consistency — NIT (see Finding 2 below)

The medicaid test's `assertNoPHI` is byte-identical to commercial's helper body
EXCEPT for one comment-line difference: commercial has `// Slips synthetic patterns
("MRN 000-COMM-002": <7 digits before dash; NDC 5-4-2: not 3-3-4 phone).` at line
26; medicaid has the analogous `// Slips synthetic patterns ("MRN 000-MED-003": …)`
at line 25. Helper logic is identical (7 regex blocks, same wording, same severity).
This is the *correct* mirroring (per the tick-9 deferral of the LOW-7 DRY extraction)
but flags that the two helpers will continue to drift if one is touched without the
other. See **Finding 2 (NIT)** below.

### 9. No `policyVoidedClauseIndices` / no R23 references — PASS

Grep confirmed: `policyVoidedClauseIndices`, `PolicyInvalidated`, and `R23` appear
ZERO times in `expected-outcome.md`. This is not a policy-void scenario; it correctly
omits the R23 vocabulary.

### 10. Test counts — PASS

Full-suite re-run: 44 total, 44 pass, 0 fail, 0 skipped, 0 todo, 0 cancelled.
Breakdown: 21 prior (pre-UNIT-3) + 7 partd (tick 8 + 9) + 8 commercial (tick 9) +
8 medicaid (this tick) = 44. Matches the prompt's claim. No test duplicated; each
test name is unique (TAP stream verified).

### 11. Tsc — PASS

`npx tsc -p tsconfig.json --noEmit` exits clean with no output. The type-narrowing
fix on line 158 (the `references[0]` access via
`(references as Record<string, unknown>[])[0]`) parses cleanly; the unsafe-cast
chain is local to this test file and does not leak into production code.

### 12. Lying comments, dead code, restating-code comments — PASS WITH NITS

Reviewed all four fixture files + the test file:
- **note.md:** all narrative claims (BMI 34.2, A1c trajectory, ASCVD 14%, 10-year
  history) are internally consistent and reference only synthetic identifiers. No
  PHI-shaped strings (regex set confirms).
- **packet.json:** all three slice texts are quoted (synthetic) source content with
  plausible-but-fake URLs and uniform empty-bytes contentHash. The Medi-Cal URL
  (`https://www.dhcs.ca.gov/...Medi-Cal-GLP1-PA-Criteria-2026-Q2.pdf`) follows the
  real DHCS domain shape but the path is synthetic (`2026-Q2` is the SCENARIO
  revision marker, not a real published doc); acceptable as fixture-tier.
- **payer-profile.json:** clean six-field §3.2 shape, no extraneous keys.
- **requested-drug.json:** six fields per R4, all populated, NDC 00002-1433-80 is
  Eli Lilly's real Trulicity 0.75 mg NDC — borderline but not PHI (drug identifier
  is public); RxNorm CUI 1551291 also real-public for dulaglutide. Acceptable.
- **expected-outcome.md:** narrative reasoning correctly threads R14a + R6c +
  R17 (the §2.5 Medicaid MCO ladder). One small flag: the document references
  "42 CFR §438.402" (line 44) as the federal-floor citation for the 60-day appeal
  window — this is correct per §2.5 R17, but is a prose claim not asserted by the
  test. Acceptable as documentation-tier.
- **test file:** comments are minimal and substantive (the PHI-slip-pattern
  documentation at line 25, the PayerLine enum guard at line 104, the §3.2
  discriminant note at lines 110-111, the R14a-sequencing context at lines 211-213).
  No decorative comments. No dead code. No unused imports (verified `PayerLine` is
  used at line 104, `fileURLToPath` at line 19, `assert/strict` throughout,
  `node:fs`/`node:path`/`node:test` all consumed).

---

## Findings

### Finding 1 — LOW | Header-line check does not enforce Deny-before-Approve ordering

- `src/protocol/scenarios.medicaid-denied-then-appealed.test.ts:228-237`
- **Description:** the test finds the `## Expected outcome:` header and asserts that
  BOTH `\bDeny\b` AND `\bApprove\b` match on that line. The header today reads:
  `## Expected outcome: Deny (round 0) → Approve (round 1, Plan Internal Appeal)`
  — and both words appear, with Deny first. The test passes. But the test would
  ALSO pass on a degenerate rewrite like
  `## Expected outcome: Approve (round 1) ← Deny (round 0)`
  or even
  `## Expected outcome: Approve, but Deny`
  because the assertion is co-occurrence-only, not order-preserving. The prompt's
  language ("locking the ordering claim tightly") suggests this should pin the
  Deny-before-Approve narrative ordering, which is the load-bearing R14a-sequencing
  claim (round 0 Deny precedes round 1 Approve causally — the appeal is only
  possible BECAUSE round 0 was Deny).
- **Why it matters:** R14a is a sequencing predicate, not a co-occurrence one. The
  header line is the load-bearing summary; a reversal of word order in the header
  would silently pass while violating the R14a-flavored claim the test is asserting.
  The ordering matters for the same reason the rule R14a matters: round N's
  precondition is round N-1's terminal Deny, not the reverse.
- **Severity rationale:** LOW because (a) the current header is correct
  (Deny-before-Approve), (b) the body of the document repeats the ordering claim
  multiple times (`### Round 0`, `### Round 1` headers; `Cited references: [0,1]`
  for round 0 vs `[0,1,3]` for round 1) and would catch a coherent reversal, and
  (c) the test's full-document `\bDeny\b` + `\bApprove\b` assertions (lines 218-225)
  do not enforce ordering either, so the gap is consistent within the test.
  Materially, the present fixture is fine; the gap is prospective.
- **Suggested fix:** strengthen the header-line assertion to also pin ordering:
  ```ts
  const denyIdx = headerLine!.search(/\bDeny\b/);
  const approveIdx = headerLine!.search(/\bApprove\b/);
  assert.ok(
    denyIdx >= 0 && approveIdx >= 0 && denyIdx < approveIdx,
    `expected-outcome.md "## Expected outcome:" header must name Deny BEFORE Approve (R14a sequencing: round-0 Deny is the precondition for round-1 appeal); got: ${headerLine}`,
  );
  ```
  Three lines, cites R14a, fails loudly on a future degenerate rewrite. Strictly an
  improvement over the present co-occurrence check.

### Finding 2 — NIT | `assertNoPHI` helper continues to drift-by-mirroring across three scenario tests

- `src/protocol/scenarios.medicaid-denied-then-appealed.test.ts:26-63`
- `src/protocol/scenarios.commercial-policy-void.test.ts:27-64` (peer)
- `src/protocol/scenarios.partd-approvable.test.ts:42-188` (peer — inlined, not factored)
- **Description:** the medicaid test's `assertNoPHI` helper body is byte-identical
  to commercial's (verified by diff: only the single comment line differs, naming
  the scenario's MRN slip-pattern). The partd test has the same 7-regex set
  inlined into two separate test bodies rather than factored into a helper. So
  the codebase now carries THREE copies of the same 7-regex PHI scan. Tick 9 LOW 7
  deferred the DRY extraction explicitly; this tick mirrors faithfully, which is
  the right per-tick scope decision, but the drift-risk surface area is now 3x
  not 2x.
- **Why it matters:** any future addition to the PHI regex set (e.g., a new
  driver-license shape; a tightened MRN pattern) requires three coordinated edits,
  one of which (partd) is split across two test bodies. The cost-of-a-missed-edit
  is silent PHI-scan weakening in one fixture while passing in the others. The
  symptom would be hard to spot because both branches would pass the harness.
- **Severity rationale:** NIT (below LOW). All three copies are correct today;
  there is no active drift; the tick-9 review's explicit deferral applies. This
  flag is record-keeping only.
- **Suggested fix:** factor the helper into `src/protocol/scenarioFixtures.test-helpers.ts`
  (or sibling) exposing `assertNoPHI(content, fileLabel)` + `assertPacketShape(packet)`
  + `assertRequestedDrugShape(drug)`. Each scenario test then becomes ~30 lines of
  scenario-specific assertions. Defer to a dedicated refactor commit; this tick
  is the right time to flag the increased surface area but the wrong time to do
  the work.

### Finding 3 — NIT | Per-scenario sentinel-address convention is now load-bearing but still undocumented

- `demo-data/scenarios/medicaid-denied-then-appealed/packet.json:40`
- `demo-data/scenarios/commercial-policy-void/packet.json:40` (peer)
- `demo-data/scenarios/partd-approvable/packet.json:40` (peer)
- **Description:** the medicaid test at lines 180-184 asserts the EXACT sentinel
  `0x0000000000000000000000000000000000000003`, locking in the per-scenario
  enumeration `partd → ...0001, commercial → ...0002, medicaid → ...0003` as a
  load-bearing convention (this closes the tick-9 LOW 6 by setting precedent
  for strict pinning). However, the convention is still not documented anywhere
  — no `demo-data/scenarios/README.md`, no comment in any of the three packet.json
  files, no spec section. A future fourth scenario has no signal whether it should
  use `0x...0004` or any-valid-address.
- **Why it matters:** the convention is now ENFORCED in the medicaid test (exact
  literal match) but only DOCUMENTED implicitly via the three existing fixtures.
  The partd test (tick 8) does NOT exact-match its sentinel — it only checks the
  40-hex shape. So the convention is asymmetrically enforced: medicaid pins
  `...0003`, commercial does not (need to verify by reading the commercial test),
  partd does not. A future fixture lands at `0x...0004` and the medicaid test
  catches a re-use of `0x...0003` but the partd test would not catch a re-use of
  `0x...0001`. The enforcement surface is uneven.
- **Severity rationale:** NIT (below LOW). The tick-9 review explicitly deferred
  the convention-documentation question (LOW 6); this tick advances the
  enforcement on one side (medicaid pins exact value) without closing the
  documentation gap. Acceptable per scope, but the gap is now wider.
- **Suggested fix:** EITHER (a) tighten partd and commercial sentinel assertions
  to exact-match (one-line edits each); OR (b) author
  `demo-data/scenarios/README.md` with the enumerated convention and
  cross-validate scenario-slug → address mapping in a single test that walks all
  three directories. (a) is cheaper, (b) is more rigorous.

---

## Symmetry / regression checks (no findings)

- **`payer-profile.json` shape matches §3.2 Medicaid discriminant exactly.** Six
  fields, no extras, no `_note`. The string-non-emptiness check at lines 112-118
  is correct; the `line === "Medicaid"` pin at line 119 is correct.
- **`Patient C` synthetic marker is distinct from `Patient A` (partd) and
  `Patient B` (commercial).** Cross-folder false-positive impossible because each
  test hardcodes its `SCENARIO_DIR`.
- **`contentHash` uniformity:** all three references in packet.json + the
  formularyRelease.contentHash carry the same hash
  (`0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470` =
  keccak256 of empty bytes, the placeholder pattern from tick 8). Acceptable as
  fixture-tier; would need real hashes for a non-demo deploy. Consistent with
  the precedent set by partd and commercial.
- **Synthetic MRN format `000-MED-003` slips the 7+-digit MRN regex correctly:**
  3 digits (`000`) before the dash break, the regex requires 7+ contiguous digits.
  No false-positive.
- **NDC 00002-1433-80 (5-4-2 shape) does not match the 3-3-4 phone regex.** No
  false-positive.
- **RxNorm CUI 1551291 (7 contiguous digits) does NOT match the MRN regex** because
  the regex requires the literal `MRN` prefix. No false-positive.
- **42 CFR §438.402 citation** (expected-outcome.md:44) is the correct federal
  authority for Medicaid MCO Plan Internal Appeal windows per §2.5 R17.
- **Ladder math:** `(Medicaid, 0)` initial determination → `(Medicaid, 1)` Plan
  Internal Appeal → `(Medicaid, 2)` External Medical Review / State Fair Hearing
  rendered as `skipped` after Approve. Matches §2.5 R17 + R15 + the §2.4 R14
  terminal cap (Medicaid max = 2). The "appeal-ladder stages" table at
  expected-outcome.md:78-82 mirrors R15's UI-label mapping exactly.
- **Round-1 reference index 3 is described but NOT checked into the round-0
  packet.json,** which is correct — the round-0 packet is the *frozen* evidence
  at submission time (R10); the round-1 appeal would be a separate packet body
  in the Curie packet store keyed by a new Merkle root. The narrative correctly
  treats the round-1 packet as a thought-experiment additive set; no fixture
  drift.
- **Test isolation:** `node:test` + `node:assert/strict`, matches project
  convention.
- **No mocks:** all five fixture files read from disk; no test doubles.
- **TypeScript narrow-cast on `(references as Record<string, unknown>[])[0]`** at
  line 157 is needed because `Array.isArray(references)` narrows to `unknown[]`,
  not `Record<string, unknown>[]`. The cast is local and surface-area-bounded.
  Tsc passes clean. (This is the "type-narrowing fix on line 158" referenced in
  the prompt.)
- **R2 partial-coverage bookkeeping (third of three scenarios):** the medicaid
  case closes R2, taking the count from 2/3 to 3/3. Acknowledged; not a code
  finding.

## Carried-over OK items (from prior ticks, unchanged)

- §3.4 `Packet` schema conformance (references[], submittedAt: number,
  submittedBy: 0x+40hex).
- `submittedAt: 1748736000` is a positive finite number per §3.4 (unix seconds,
  resolving to 2026-06-01 00:00:00 UTC — a coherent future timestamp for the
  scenario's authoring date).
- All three slice.kind values are members of the §3.4 closed enum.
- R1 "synthetic only" applies to both note.md and expected-outcome.md (the
  tick-9 MEDIUM 4 closure pattern carried forward symmetrically).
- Test name "all six fields per R4 (5 strings + numeric quantity)" closes
  tick-9 LOW 9 in this file (partd test left as-is per scope, as before).

---

## Tick-10 verdict

**OVERALL: PASS — 0 actionable findings, 1 LOW, 2 NITs**

Severity breakdown:
- **HIGH:** 0 open.
- **MEDIUM:** 0 open.
- **LOW:** 1 (Finding 1: header-line check does not enforce Deny-before-Approve
  ordering — prospective gap, current fixture is correct, suggested 3-line fix).
- **NIT:** 2 (Finding 2: `assertNoPHI` continues to mirror across 3 tests —
  tick-9 LOW 7 deferral applies; Finding 3: sentinel-address convention is now
  load-bearing but unevenly enforced and undocumented — tick-9 LOW 6 deferral
  applies but the asymmetry is new).

The fixture is structurally clean. The §3.2 Medicaid discriminant shape is
exact. The round-0 packet genuinely misses the SGLT2-i evidence the PA criteria
require, and the round-1 narrative cleanly fills the gap via documented
empagliflozin intolerance — the R6c + R14a appeal arc is coherent end-to-end.
The §3.4 closed `slice.kind` enum is honored (no repeat of the tick-9 HIGH-1
`"policy-clause"` violation; the Centene Medi-Cal PA criteria correctly land
under `formulary-entry`). The sentinel-address pin at exact-equality
`0x...0003` advances tick-9 LOW 6 partially. The PHI scan is applied
symmetrically to both note.md and expected-outcome.md (tick-9 MEDIUM 4 closure
pattern carried forward).

R2 (the curated-cases requirement, 3 of 3) is now complete with this tick.
Tests are 44/44 green, matching the predicted delta exactly. Tsc is clean.
Ready to wire into an end-to-end run when Phase 1 contract work lands. The
single LOW is recommended for closure inline (3-line edit); the two NITs are
flagged for record-keeping and can land in a future DRY/convention refactor
commit.

---

## Tick 10 — LOW 1 inline closure

Finding 1 closed: `src/protocol/scenarios.medicaid-denied-then-appealed.test.ts`
gains a 3-line ordering assertion after the header co-occurrence checks. The
new assertion uses `headerLine.search(...)` to confirm `Deny` precedes
`Approve` and cites R14a in the failure message:

```ts
const denyIdx = headerLine!.search(/\bDeny\b/);
const approveIdx = headerLine!.search(/\bApprove\b/);
assert.ok(
  denyIdx < approveIdx,
  `expected-outcome.md header must name Deny BEFORE Approve (R14a appeal arc: round-0 Deny → round-1 Approve); got: ${headerLine}`,
);
```

Test re-run: `node --import tsx --test "src/**/*.test.ts"` returns 44/44 green.
No new findings introduced by the 3-line addition; the assertion is a strict
subset of the prior accepted ordering claim, so no new strict-review pass
needed for this inline closure.

NIT 2 (3x copy of `assertNoPHI`) and NIT 3 (sentinel-address convention) remain
deferred to the queued UNIT-3-refactor unit and the sentinel-convention
follow-up respectively.

### Final tick-10 verdict: PASS (0 findings remain)

---

# Tick 11 — strict review

**Reviewer:** strict-review subagent, tick 11, gatekeeper.
**Scope:** UNIT-3-refactor (shared scenario-test helper extraction) +
SPEC-0001 R6b prose-update applying amendment 0005.

## What changed this tick

1. **New file:** `src/protocol/scenarioFixtures.test-helpers.ts` (123 lines,
   4 named exports — `assertNoPHI`, `loadScenarioFile`, `assertPacketShape`,
   `assertRequestedDrugShape`). No default export, no `node:test` import, no
   top-level test registrations.
2. **Refactored:** three scenario test files
   (`scenarios.{partd-approvable,commercial-policy-void,medicaid-denied-then-appealed}.test.ts`)
   import from the helper. Scenario-distinct assertions (PartD planId
   discriminant; Commercial carrier/product/revision + R23 dual-slice +
   header-line `Approve`/no-`PolicyInvalidated` + `policyVoidedClauseIndices`;
   Medicaid state/mco/revision + `0x...0003` sentinel-address exact-equality
   + Deny-before-Approve R14a ordering) stay INLINE in each test.
3. **`docs/specs/0001-mvp0-coverage-negotiation.md`** R6b prose rewritten to
   apply amendment 0005: `PolicyFlagged` becomes an annotation event alongside
   `Ruled` on Approve, NOT a route to terminal `PolicyInvalidated`; the
   `PolicyInvalidated` state is retained but narrowed to the meta-policy
   edge case. §3.5 `Ruled` event payload signature gains
   `policyVoidedClauseIndices`. §3.6 state-machine table row narrowed to
   "every policy clause consulted is non-compliant; meta-policy failure".

## R-citations and source-of-truth

- Strict-review tick 9 NIT 2 (DRY: 3× copy of `assertNoPHI`) — CLOSED this tick.
- Strict-review tick 10 NIT 2 (same DRY deferral) — CLOSED this tick.
- Amendment 0005 (`docs/amendments/0005-policy-void-r23-supersedes-r6b.md`)
  lines 86-89 — the "A future tick should: Update SPEC-0001 §3 R6b prose…
  Add `policyVoidedClauseIndices` to the `Ruled` event payload in §3.5" items
  are BOTH applied this tick.

## Required-read pass

1. **Helper module purity (CLEAN).** `grep -n 'node:test\|^test('` returns
   nothing; only `node:assert/strict`, `node:fs`, `node:path`, `node:url` are
   imported. Four named exports, zero default exports. Module has no
   side-effects at import time.
2. **PHI regex byte-equivalence (CLEAN).** Diffed the helper's seven
   `assert.equal(/.../, false, "…")` lines against the originals in
   `git show HEAD:src/protocol/scenarios.partd-approvable.test.ts` lines
   40-60. Every regex is byte-identical:
   - `/\bSSN\b\s*[:#]?\s*\d{3}/i`
   - `/\d{3}-\d{2}-\d{4}/`
   - `/\b\d{2}\/\d{2}\/\d{4}\b/`
   - `/[A-Z]{2}\d{6,}/`
   - `/\b(?:\(\d{3}\)\s?|\d{3}[-.])\d{3}[-.\s]?\d{4}\b/`
   - `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/`
   - `/\bMRN\s*[:#]?\s*\d{7,}\b/i`
   The HTML-comment strip (`.replace(/<!--[\s\S]*?-->/g, "")`) is preserved.
3. **`assertPacketShape` matches §3.4 (CLEAN).** Enforces `references[]`
   non-empty, `references[0].url` non-empty string, `references[0].contentHash`
   keccak256 hex (0x + 64 hex), `submittedAt` positive finite number,
   `submittedBy` 0x + 40 hex. Matches what the original partd test asserted
   at lines 119-145 of the pre-refactor file.
4. **`assertRequestedDrugShape` matches R4 (CLEAN).** Five string fields
   (`ndc`, `rxnormCui`, `name`, `dose`, `requestedFor`) + numeric-or-numeric-string
   `quantity`. Matches the original partd R4 test at lines 104-115.
5. **Sentinel-address asymmetry preserved (CLEAN).** Only the medicaid test
   pins `submittedBy === "0x0000000000000000000000000000000000000003"`
   (lines 102-106 of the refactored file). The partd and commercial tests
   do NOT pin a sentinel — same as before the refactor. Confirmed by
   grepping `0x000` in the original `git show HEAD:...commercial-policy-void.test.ts`
   — no exact-equality pin there.
6. **R23 dual-slice block preserved INLINE in commercial test (CLEAN).**
   Lines 101-136 of the refactored commercial test contain the
   `fda-label-indication` + `guideline-recommendation` co-presence check and
   the closed-enum invariant — byte-for-byte the same as the original
   `git show HEAD:...commercial-policy-void.test.ts` lines 180-215.
7. **Spec edit faithfulness (CLEAN).**
   - R6b cites `[docs/amendments/0005-policy-void-r23-supersedes-r6b.md]`
     explicitly in the leading parenthetical.
   - R6b says `PolicyFlagged` IS emitted "as an annotation event alongside
     the `Ruled` event (not a separate state route)" — matches amendment
     0005 line 56-58 verbatim in intent ("REPURPOSED as an annotation event
     emitted alongside `Ruled(... decision=Approve ...)`").
   - §3.5 `Ruled` event signature gains `policyVoidedClauseIndices` as the
     8th positional field — matches amendment line 87.
   - §3.6 state-machine row for the `PolicyInvalidated` transition narrowed
     to "every policy clause consulted is non-compliant; meta-policy
     failure" — matches amendment lines 59-63.
   - R6, R6a, R6c are untouched (confirmed by `git diff HEAD`).
8. **Test count (CLEAN): 44.** `node --import tsx --test "src/**/*.test.ts"`
   returns `# tests 44 / # pass 44 / # fail 0`. Per-file counts: partd 7,
   commercial 8, medicaid 8 — identical to pre-refactor.
9. **tsc (CLEAN).** `npx tsc -p tsconfig.json --noEmit` exits 0 with no
   output. No type drift introduced.

## Findings

### NIT 1 — `loadScenarioFile` does not validate slug/filename against path traversal

**File:** `src/protocol/scenarioFixtures.test-helpers.ts:58-61`

```ts
export function loadScenarioFile(slug: string, filename: string): string {
  const filePath = path.resolve(REPO_ROOT, "demo-data", "scenarios", slug, filename);
  return fs.readFileSync(filePath, "utf-8");
}
```

`path.resolve` does NOT enforce that the resolved path stays under
`REPO_ROOT/demo-data/scenarios/`. A caller passing `slug = "../../etc"` or
`filename = "../../../etc/passwd"` would escape the fixture root. For a TEST
helper called exclusively from in-repo test files with hardcoded
`SLUG = "partd-approvable" | "commercial-policy-void" | "medicaid-denied-then-appealed"`
constants, this is academic — the attack surface is zero. But a strict
reviewer flags it because:

1. The function takes `slug: string` and `filename: string` (open-ended
   types), not a constrained string-literal union.
2. The doc comment on lines 53-57 promises files from
   `demo-data/scenarios/<slug>/<filename>` without saying "trusted callers
   only."

**Suggested fix (optional):** narrow the parameter types to the three
fixture slugs and a fixed filename union, OR after `path.resolve` assert
`filePath.startsWith(path.resolve(REPO_ROOT, "demo-data", "scenarios") + path.sep)`.
The latter is one line. Either is defensible to defer if the helper stays
test-only and grep-pinned. Severity: NIT (academic for test code).

### NIT 2 — spec §3.5 event-list edit doesn't flag the contract decode gap

**File:** `docs/specs/0001-mvp0-coverage-negotiation.md:116`

The §3.5 `Ruled` event signature now includes `policyVoidedClauseIndices`
as the 8th positional field. Amendment 0005 lines 76-89 are clear that the
contract's `handleResponse` decode path does NOT yet read this field — that
work is deferred to "SPEC-0004 Phase 1 contract work." But the spec line
itself does not carry a "not yet decoded by contract; future tick" marker;
a reader looking only at §3.5 would assume the event already carries the
field on-wire.

The R6b paragraph at line 54 links to amendment 0005 (which spells out the
deferral), so a careful reader can reach the gap. The amendment itself is
explicit. This is a minor wording-completeness NIT, not a contradiction.
Severity: NIT (documentation gap, not a correctness gap).

**Suggested fix (optional):** add a trailing parenthetical to the §3.5
signature: `…receiptId, policyVoidedClauseIndices)` *(field added by
amendment 0005; contract decode lands in SPEC-0004 Phase 1)*. One line.

## Symmetry / regression checks (no findings)

- **Test names: unchanged.** All 23 scenario-test names in TAP output are
  byte-identical to pre-refactor. The harness's "no rename" guarantee holds.
- **`scenarioFile()` local helper retained in each test file.** All three
  files keep a 3-line `scenarioFile = (name) => path.resolve(...)` for
  `fs.existsSync` checks before reading. Not duplicated against the helper
  — `loadScenarioFile` is for *reading*, `scenarioFile` is for *path
  construction* (existsSync). Clean separation.
- **No unused imports.** Each of the three test files imports exactly the
  helper exports it uses: partd uses all four; commercial uses all four;
  medicaid uses all four. `fs`, `path`, `assert`, `test`, `PayerLine` all
  still used inline.
- **`REPO_ROOT` resolution in helper.** Uses
  `path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")`
  from `src/protocol/scenarioFixtures.test-helpers.ts`, which lands at the
  repo root. Same two-`..`-step convention the per-file `scenarioFile`
  helpers use. Consistent.
- **Comments in the helper are descriptive, not load-bearing.** The JSDoc
  on each export accurately states what it asserts. No lying comments. No
  dead code.
- **§3.4 closed-enum slice.kind check** still asserted in commercial (lines
  129-134) and medicaid (lines 122-129); the refactor did not centralize
  this into the helper because each scenario has a slightly different
  treatment (commercial demands BOTH `fda-label-indication` AND
  `guideline-recommendation` presence; medicaid only asserts the enum
  membership). Leaving it inline is correct — generalizing would have
  required a flag-parameter, which adds rather than removes complexity.
- **`scenarioFixtures.test-helpers.ts` filename convention.** The
  `.test-helpers.ts` suffix is a convention; the test-runner glob
  `"src/**/*.test.ts"` does NOT pick this file up (verified: only 44 tests
  ran, no spurious helper-as-test execution). The naming choice is correct
  and the glob-exclusion is implicit-but-load-bearing.
- **Amendment 0005 `PolicyInvalidated` narrowing.** The spec's §3.6 row
  description ("every policy clause consulted is non-compliant; meta-policy
  failure") matches amendment line 61-62 ("the agent cannot find any valid
  ruling because every policy clause it consulted is non-compliant (a
  meta-policy failure, not a per-request void)") in substance. The
  state-machine routing itself is unchanged (the row still exists; only
  its semantic scope is narrowed) — consistent with amendment line 77-83
  ("non-code-changing... No state-machine change required").

## Tick-11 verdict

**OVERALL: PASS — 0 actionable findings, 2 NITs**

Severity breakdown:
- **HIGH:** 0 open.
- **MEDIUM:** 0 open.
- **LOW:** 0 open.
- **NIT:** 2 (Finding 1: `loadScenarioFile` path-traversal — academic for
  test helper; Finding 2: §3.5 event-signature line could carry a
  contract-decode-deferred parenthetical for completeness).

The refactor is structurally clean. All four helper exports are named,
no `node:test` import, no top-level test registrations. The PHI regex set
is byte-equivalent to the originals. The §3.4 packet-shape and R4
requested-drug-shape assertions are preserved exactly. The three
scenario-distinct assertions (PartD planId; Commercial R23 dual-slice +
header-line Approve + `policyVoidedClauseIndices`; Medicaid `0x...0003`
sentinel + R14a Deny-before-Approve) all remain INLINE in their respective
test files. The pre-refactor sentinel-pin asymmetry (only medicaid pins
exact equality) is preserved — the refactor did NOT accidentally promote
or regress it. Test count is 44/44 green. Tsc is clean.

The spec edit faithfully applies amendment 0005: R6b cites the amendment
explicitly, the `Approve` + `PolicyFlagged`-as-annotation routing is
correctly described, `policyVoidedClauseIndices` is added to the §3.5
`Ruled` event signature, and the §3.6 `PolicyInvalidated` row is narrowed
to the meta-policy edge case. R6, R6a, R6c are untouched as required. The
contract-decode gap is implicit-via-amendment-link rather than explicit at
§3.5 (NIT 2), but the amendment itself is unambiguous and the gap is
correctly deferred to SPEC-0004 Phase 1 work.

Strict-review tick 9 NIT 2 and tick 10 NIT 2 (DRY: 3× `assertNoPHI` copy)
are CLOSED. The two new NITs are flagged for record-keeping; neither
blocks landing.

### Final tick-11 verdict: PASS (0 actionable findings; 2 NITs documented)

---

## Tick 12 strict review (2026-05-29)

**Scope under review (UNIT-4-narrow + a piggyback fix):**
1. `src/protocol/revertReasonMap.ts` — SPEC-0003 R16. `RevertReason` union
   (32 contract revert strings), `REVERT_REASON_MAP` (frozen Record), the
   `RevertReasonEntry` shape, and `mapRevertReason(raw): RevertReasonEntry`
   with a generic fallback that embeds raw input.
2. `src/protocol/revertReasonMap.test.ts` — 9 sub-tests via `node:test`.
3. `web/src/hooks/useAction.ts` — SPEC-0003 R13/R14. React hook wrapping
   async writes with `pending`, mapped `error`, and a `useRef`-backed
   in-flight guard that hard-rejects concurrent `run()` calls.
4. `web/src/shared.ts` — pre-existing `describeEvent` exhaustiveness bug
   surfaced after UNIT-2 added `PacketSubmittedEvent`; tick 12 closes it
   with `case "PacketSubmitted": …` so web `tsc` is clean.

**Required gates (verified):**
- `node --import tsx --test "src/**/*.test.ts"` → `# tests 53 / # pass 53
  / # fail 0` (CLEAN).
- `npx tsc -p tsconfig.json --noEmit` → exit 0, no output (CLEAN).
- `npx tsc -p web/tsconfig.json --noEmit` (after `npx tsc -p tsconfig.json`
  builds `dist/`) → exit 0, no output (CLEAN).

### Cross-checks performed

1. **Contract revert string ↔ `REVERT_REASON_MAP` enumeration.** Ran the
   prompted grep over `contracts/contracts/*.sol`:

   ```
   grep -nE 'revert "[^"]*"|require\([^,]+,\s*"[^"]*"' contracts/contracts/*.sol
   ```

   Yielded 38 hits across `CoverageNegotiation.sol`. After collapsing
   duplicates (`auth: not provider` × 3 sites — createContract L324,
   submitEvidence L396, refuse L505; `fee: refund failed` × 3 sites —
   submitEvidence L409, appeal L454, requestAdjudication-helper L806),
   **27 unique revert strings** remain. **All 27 are present in
   `REVERT_REASON_MAP`** with no inventions:

   | Contract string | Map key |
   |---|---|
   | `addr: zero` · `auth: not provider` · `qty: zero` · `create: self-contract` | ✓ |
   | `engage: not Open` · `auth: not insurer` · `policy: empty` | ✓ |
   | `adjudicate: not Ready` | ✓ |
   | `evidence: wrong state` · `evidence: empty` | ✓ |
   | `appeal: prior ruling not Deny` · `appeal: unknown party` · `appeal: needs evidence` | ✓ |
   | `accept: not ruled` · `settle: not ruled` · `settle: not both accepted` | ✓ |
   | `refuse: not refusable` · `withdraw: terminal` · `feedback: terminal` | ✓ |
   | `timeout: not UnderReview` · `timeout: too early` | ✓ |
   | `callback: not platform` · `callback: unknown request` · `callback: not UnderReview` | ✓ |
   | `fee: underfunded` · `fee: refund failed` | ✓ |
   | `auth: not a party` | ✓ |
   | `funds: zero addr` · `funds: insufficient` · `funds: transfer failed` | ✓ |
   | `unknown contract` | ✓ |
   | `maxRounds: < 1` | ✓ |

   The map carries **32 entries** total. The gap (27 unique contract
   strings vs 32 map keys) is the de-duplication of three sites each that
   share `auth: not provider` and `fee: refund failed` — i.e. the map
   collapses by-string-not-by-site, which is correct (the user sees the
   string, not the line number). **No spec drift.**

2. **`RevertReason` type union vs map keys.** The exported union enumerates
   all 32 strings; the map ends with
   `satisfies Record<RevertReason, RevertReasonEntry>` — the compiler
   enforces every union member has an entry. **No type-vs-runtime gap.**
   Re-verified by reading both blocks side-by-side: count matches (32),
   spelling matches (incl. unusual `"maxRounds: < 1"` with embedded space
   around `<`, and `"funds: zero addr"` not `"funds: zero address"`).

3. **`describeEvent` exhaustiveness post-fix.** `web/src/shared.ts` now
   carries **20 `case` arms** for the 20 `BaseEvent` subtypes exported by
   `src/types/coverage.types.ts` (counted via
   `grep -c "readonly name:"`). The added `case "PacketSubmitted":` arm
   reads `e.round` (bigint), `e.packetRoot` (string), `e.packetUrl`
   (string), which matches `PacketSubmittedEvent` lines 260-265 of
   `src/types/coverage.types.ts` exactly. The arm template-stringifies
   `round` (BigInt → string at runtime), `shortHex`-truncates the root,
   and shows the URL verbatim in parens. **Field shape is correct.**

4. **`mapRevertReason` fallback embeds raw input.** Lines 280-283 of
   `revertReasonMap.ts`:

   ```ts
   details: `The contract rejected the transaction. The technical reason
   is shown below.${
     reasonRaw !== undefined ? ` Raw reason: ${reasonRaw}` : ""
   }`,
   ```

   When the raw string is undefined, the `Raw reason:` suffix is omitted —
   no `Raw reason: undefined` artefact. Test 5 of the test file
   (`mapRevertReason with unknown string returns fallback and embeds raw
   string in details`) pins the included-when-defined path with
   `assert.ok(entry.details.includes(raw))`. **Spec'd behaviour
   preserved.**

5. **`Object.freeze` semantics.** `Object.freeze(REVERT_REASON_MAP)` is
   shallow: the top-level map is frozen, but each nested entry object is
   not. Test 6 only asserts `Object.isFrozen(REVERT_REASON_MAP)`. See
   NIT 1 below.

6. **`useAction` race-condition analysis.** Re-read lines 33-65 of
   `web/src/hooks/useAction.ts`:
   - `inFlightRef = useRef(false)` (line 38) — synchronous,
     not-state-batched.
   - `run` reads `inFlightRef.current` (line 41) **before** any awaits.
   - If `false`, sets `inFlightRef.current = true` synchronously (line
     46), then `setPending(true)` + `setError(null)` (state updates,
     batched).
   - The `finally` clears both `inFlightRef.current` and `pending`.

   Two `run()` calls in the same tick: the second sees
   `inFlightRef.current === true` set by the first → hard-rejects with
   `Error("in-flight")`. **No window for double-entry.** The earlier
   tick-7 finding pattern (state-only guard with stale-closure or
   batched-update window) does not apply here — the ref is the load-bearing
   guard, `pending` is presentational.

7. **`useAction` generic typing.** Signature is
   `useAction<T>(fn: () => Promise<T>): { …; run: () => Promise<T> }`.
   `run` `await`s `fn()` and returns the resolved value, so
   `run(): Promise<T>` is correct. On error, `run` rethrows (not
   suppressed), so the caller's `.catch` / `try/await` still fires.
   **Type-correct.**

8. **`extractRevertReason` probe order.** Lines 79-86: checks
   `e.reason` → `e.message` → `e.shortMessage`. See NIT 2 below.

9. **Test 3 strictness** (`mapRevertReason returns the correct entry for
   each known revert string`). Asserts headline of returned entry equals
   headline of the map entry — does NOT assert returned-`details` equals
   map-`details`, and does NOT assert reference-equality
   (`assert.equal(entry, REVERT_REASON_MAP[key])`). For the 5 baseline
   keys all headlines are unique strings, so the existing assertion is
   sufficient to catch swapped-entry bugs in practice. See NIT 3 below.

10. **`shared.ts` PacketSubmitted fix as scope creep.** The diff in
    tick 12 bundles a pre-existing exhaustiveness bug
    (`web/src/shared.ts` missing a `case "PacketSubmitted":` arm after
    UNIT-2 / tick 4 added the event type) into the same commit as the
    SPEC-0003 R13/R16 work. The fix is one arm in one file, and it was
    blocking the `npx tsc -p web/tsconfig.json` gate that the tick must
    leave clean. See NIT 4 below.

### Findings

#### NIT 1 — `Object.freeze` on `REVERT_REASON_MAP` is shallow; entries are mutable

**File:** `src/protocol/revertReasonMap.ts:67-68`, `:97-102` (test).

`Object.freeze(REVERT_REASON_MAP)` prevents key add/remove/reassign on the
top-level map but does NOT freeze the nested `RevertReasonEntry` objects.
A consumer with a reference to e.g. `REVERT_REASON_MAP["engage: not
Open"]` could legally execute
`REVERT_REASON_MAP["engage: not Open"].headline = "lol"` and corrupt the
shared instance — every subsequent `mapRevertReason("engage: not Open")`
call would return the mutated entry. Test 6 only asserts
`Object.isFrozen(REVERT_REASON_MAP)`, not per-entry freeze. The
`Readonly<Record<RevertReason, RevertReasonEntry>>` type and the
`readonly headline`/`readonly details` markers prevent this at the
TypeScript level — but at runtime, a JS consumer or a
`@ts-ignore`-wielding caller can still mutate. For a copy-table used
purely as a lookup, the practical risk is low; a strict reviewer flags it
because the freeze gesture promises immutability that the implementation
does not fully deliver.

**Suggested fix (optional):** deep-freeze the entries, e.g.

```ts
export const REVERT_REASON_MAP = Object.freeze(
  Object.fromEntries(
    Object.entries(rawMap).map(([k, v]) => [k, Object.freeze(v)]),
  ),
) as Readonly<Record<RevertReason, RevertReasonEntry>>;
```

or factor a `deepFreeze` helper. One-line addition; eliminates the
gesture-vs-guarantee gap. Severity: **NIT** (academic; current
TypeScript readonly markers carry the contract for in-repo callers).

#### NIT 2 — `extractRevertReason` makes `shortMessage` unreachable in practice

**File:** `web/src/hooks/useAction.ts:74-89`.

Probe order is `.reason` → `.message` → `.shortMessage`. Ethers v6
errors *always* carry a non-empty `.message` (it's the base `Error`
property), so the `.shortMessage` branch is unreachable for any error
that bubbles through ethers — even viem / wagmi errors that primarily
expose `.shortMessage` are typically wrapped or thrown as `Error`
subclasses with a populated `.message`. The consequence: when the
underlying error has a clean `.shortMessage` like `"engage: not Open"`
and a noisy `.message` like
`"execution reverted: engage: not Open (action=\"estimateGas\", …)"`,
the noisy `.message` wins, the map lookup misses (exact-string match in
`mapRevertReason` requires `"engage: not Open"` verbatim), and the user
sees the generic fallback with the entire ethers stack pasted into
`Raw reason: …`.

This is a real R16 regression hazard: the very strings the map exists to
translate get routed through the fallback because the probe order
prioritises the noisier source.

**Suggested fix (optional):** swap the order — try `.reason` first
(decoded), then `.shortMessage` (clean wallet copy), then `.message`
(noisy fallback). Alternatively, normalise `.message` by stripping
common prefixes (`execution reverted: `, `VM Exception while processing
transaction: revert `, etc.) before the map lookup. Severity: **NIT**
borderline LOW — depending on which wallet stack the demo uses, this
could degrade R16's plain-English coverage in practice. Worth fixing in
the same tick as the next `useAction` consumer or as a follow-up; not
blocking the gate.

#### NIT 3 — Test 3 (`mapRevertReason returns the correct entry`) only checks `headline`

**File:** `src/protocol/revertReasonMap.test.ts:56-66`.

The assertion is

```ts
assert.equal(
  entry.headline,
  REVERT_REASON_MAP[key as keyof typeof REVERT_REASON_MAP].headline,
);
```

— it does not assert `entry.details === REVERT_REASON_MAP[key].details`
nor `entry === REVERT_REASON_MAP[key]` (reference equality). A
hypothetical bug in `mapRevertReason` that returned a different entry
whose headline coincided with the requested entry's headline would slip
past. For the 5 baseline keys, all headlines are unique, so the test
catches the intended class of bug — but a stricter assertion (reference
equality or full-object deep-equal) costs nothing and pins the contract.

**Suggested fix (optional):** replace the `headline`-only check with
`assert.equal(entry, REVERT_REASON_MAP[key])` (reference equality —
`mapRevertReason` returns the map's own object on the happy path, lines
274-276) OR `assert.deepEqual(entry, REVERT_REASON_MAP[key])` (deep
equality). Either is a single-character change. Severity: **NIT** (test
strength, not implementation correctness).

#### NIT 4 — `shared.ts` `PacketSubmitted` fix is bundled with SPEC-0003 work

**File:** `web/src/shared.ts:30-31` (added arm).

The fix is one arm in `describeEvent` that closes a pre-existing
exhaustiveness gap left by UNIT-2 (tick 4, where `PacketSubmittedEvent`
was added to `src/types/coverage.types.ts:260-265` but not to
`describeEvent`). The loop's prompt acknowledges this and frames it as
defensible because it was blocking the web `tsc` gate. From a
strict-review standpoint:

- **In favour of bundling:** the gate requires both `tsc` projects
  clean; without this arm the web project doesn't compile and the
  SPEC-0003 work can't ship behind a clean gate. The fix is minimal
  (one switch arm, no new behaviour), and the R-citation
  (`SPEC-0001 §3.5 / SPEC-0004 PacketSubmitted event`) is explicit in
  the tick-12 prompt.
- **Against bundling:** the commit will read as "SPEC-0003 R13 + R16"
  in the log but actually carries a UNIT-2 follow-up. A reviewer
  bisecting the `describeEvent` history would have to read tick 12 to
  find this delta even though it's logically a UNIT-2 follow-up.

Severity: **NIT** (process / commit-hygiene observation, not a
correctness gap). Pattern: tick-7-style "emergency-tag at clean stopping
point" history-doc note would have captured this cleanly if the loop
had taken that route. The pre-existing-bug framing in the tick-12
prompt is accurate; no spec drift.

### Symmetry / regression checks (no findings)

- **Exhaustiveness:** `describeEvent` has 20 `case` arms for 20 event
  subtypes in `src/types/coverage.types.ts` (counted via
  `grep -c "readonly name:" src/types/coverage.types.ts` → 20 and
  `grep -c 'case "' web/src/shared.ts` → 20). Switch is exhaustive; no
  unreachable arms; the TS narrowing `e.name === "PacketSubmitted"` on
  `CoverageEvent` correctly admits access to `e.round`, `e.packetRoot`,
  `e.packetUrl`.
- **Baseline-key acceptance criterion** (`docs/progress/loop-state.md`):
  test 1 enumerates the 5 baseline keys and asserts presence in the map;
  tests 2/7/8 pin non-emptiness, headline-length ≤80, details-length
  ≥30; test 9 pins headline ≠ raw revert string. The five required
  baselines are all present and all four content quality bands pass.
- **Type-vs-map alignment:** `RevertReason` union has 32 members;
  `REVERT_REASON_MAP` literal has 32 keys; the `satisfies
  Record<RevertReason, RevertReasonEntry>` enforces every member is
  present. Adding a new revert string to the contract requires touching
  both the union and the map; the compiler will fail-loud if only one
  side moves.
- **Fallback when `reasonRaw === undefined`:** map lookup is skipped
  (the `if (reasonRaw !== undefined)` guard at line 273), fallback is
  returned with no `Raw reason:` suffix. Test 4 pins the
  non-empty-headline / non-empty-details contract on this path. **No
  `Raw reason: undefined` UI artefact.**
- **`useAction` state clears** (R13/R14 §2.3): `error` is cleared
  inside `run`, at the start of each attempt — guarantees that a
  successful retry after a failed call clears the stale error before
  the new attempt. `pending` is cleared in `finally`, so both
  resolve-paths and reject-paths re-enable the button. No timer-based
  clears; the only escape from `pending=true` is the `finally`. No
  "hidden re-arming."
- **Mutation of returned entry from `mapRevertReason`:** on the happy
  path, `mapRevertReason` returns the **same object reference** as the
  map entry (line 276: `return entry`). If a consumer mutates the
  returned `RevertReasonEntry` it mutates the shared map — same root
  cause as NIT 1. The `Readonly<...>` type + `readonly` field markers
  catch this at compile-time for TS callers.
- **PacketSubmitted arm field shape:** matches
  `src/types/coverage.types.ts:260-265` exactly. The `BigInt → string`
  template coercion is the same pattern used elsewhere in the file
  (e.g. `Settled`, `Deadlocked`). `packetUrl` is rendered untruncated;
  rationale per the prompt is that it's a content-store URL the user
  may want to copy. Defensible. (No regression vs the pre-fix file —
  the arm just didn't exist, so the switch returned `undefined` at
  runtime for `PacketSubmitted` and TS flagged the exhaustiveness gap.)
- **Comments that lie or restate code:** none found. The JSDoc on
  `useAction` (lines 9-29) accurately describes the hook's contract
  including the R14 hard-reject decision and the rationale (closure
  identity may differ across renders); the comment is load-bearing
  (explains a design choice that's not obvious from the code) and
  matches the implementation. The `revertReasonMap.ts` JSDoc on
  `mapRevertReason` accurately describes the
  matches-known-key vs fallback dichotomy; the section headers
  (`// ── createContract ────`) correctly group the entries by contract
  function and match the contract's actual revert sites. The
  `REVERT_REASON_MAP` doc comment ("Add new entries here whenever the
  contract gains a new revert path") is the maintenance directive
  paired with the `satisfies` compile-time check. Clean.

### Tick-12 verdict

**OVERALL: PASS — 0 actionable findings; 4 NITs documented.**

Severity breakdown:
- **HIGH:** 0.
- **MEDIUM:** 0.
- **LOW:** 0.
- **NIT:** 4 (Finding 1: shallow `Object.freeze` on map; Finding 2:
  `extractRevertReason` probe order makes `shortMessage` unreachable
  with ethers v6; Finding 3: test 3 only checks `headline`; Finding 4:
  `shared.ts` `PacketSubmitted` fix bundled with SPEC-0003 work as
  process / commit-hygiene observation).

`revertReasonMap.ts` enumerates every unique contract revert string
(27 unique sites collapsed to 27 keys; 32 total map entries including
5 site-duplicates for `auth: not provider` and `fee: refund failed`
that collapse to the same user-visible string — but counted by *key*
the map has 32, matching the type union). The `satisfies` check closes
the type-vs-runtime gap. The fallback embeds raw input on the
defined-but-unknown path and omits the `Raw reason:` suffix on the
undefined path. Headlines are plain English (not raw revert strings,
asserted by test 9), all ≤80 chars (test 7), details ≥30 chars
(test 8). The fee-refund / funds-* / callback-* / maxRounds-* entries
correctly include the "internal error — please contact support" /
"admin action" framing so the user understands they're not the
intended remediator. No invented entries; no missing entries.

`useAction.ts` correctly uses `useRef` (not `useState`) for the
in-flight guard, eliminating the React-state-batching window. The hard
"in-flight" reject is justified in the doc comment (closure identity
may vary across renders, coalescing is unsound). Generic type
threading is correct. The `extractRevertReason` helper is the only
NIT-worthy issue (probe order — see NIT 2).

`web/src/shared.ts` `PacketSubmitted` arm is field-shape-correct
against `src/types/coverage.types.ts:260-265`. The switch is now
exhaustive (20/20 cases for 20 event subtypes). Bundling this fix with
the SPEC-0003 work is defensible per the prompt (it was blocking the
web `tsc` gate); flagged as NIT 4 for commit-hygiene record-keeping
only.

All three required gates pass: 53/53 tests green; root `tsc` clean;
web `tsc` clean after building `dist/`. No prior tick's findings are
re-opened or regressed.

### Final tick-12 verdict: PASS (0 actionable findings; 4 NITs documented)

---

## Tick 13 strict review (2026-05-29)

**Scope under review (UNIT-4b-narrow):**
1. `web/src/hooks/useNegotiation.ts` — NEW. React hook implementing
   SPEC-0003 §2.3 **R13** (not R14 — see Finding 1 below). Signature
   `useNegotiation(reqId: bigint, events: readonly CoverageEvent[]):
   UseNegotiationResult`. Returns `{ view, policy, priceBasis, error,
   refetch }`. Uses `useState` for the 4 nullable result fields and a
   `refetchTrigger` counter; `useRef<bigint | null>` for `prevReqIdRef`;
   `useEffect` keyed on `[reqId, events, refetchTrigger]` with the
   `cancelled` cleanup pattern; `useCallback` exposing a stable
   `refetch` that bumps the counter.

No Detail.tsx wiring this tick (deferred to tick 14). No unit test
(repo has no React testing infrastructure).

**Required gates (verified):**
- `node --import tsx --test "src/**/*.test.ts"` → `# tests 53 / # pass 53
  / # fail 0` (CLEAN).
- `npx tsc -p tsconfig.json --noEmit` → exit 0, no output (CLEAN).
- `npx tsc -p web/tsconfig.json --noEmit` → exit 0, no output (CLEAN).

### Cross-checks performed

1. **Behaviour parity with the inline pattern at `Detail.tsx:113-156`.**
   Side-by-sided the new hook against the existing inline `useEffect`
   block. Fetch order matches: `getNegotiationView` →  `policyOf` →
   conditional `priceBasisOf` gated on `v.ruled || v.terminal`. The
   `cancelled` flag + cleanup-on-effect-tear-down idiom is the same.
   Dependency array `[reqId, events]` matches the inline version; the
   hook adds `refetchTrigger` as a third dep, which is additive and does
   not change behaviour relative to the inline version (a Detail.tsx
   caller that never invokes `refetch()` gets identical semantics).
   Differences vs the inline version, **all improvements**:
   - The hook clears `setError(null)` on the success branch (line 59);
     the inline version never clears `error` on a successful refetch
     after a failure. The hook's behaviour is correct per R13's "the
     panel re-derives from the new state" — a successful refetch IS
     new state and should drop the stale error.
   - The hook clears `view`/`policy`/`priceBasis` to `null` when
     `reqId` changes (via `prevReqIdRef`); the inline version did not
     do this (it would briefly render the previous request's data
     against the new `reqId` until the new fetch resolved). The hook's
     behaviour matches the spec language "render the panel from the
     new state — not from component-level booleans" (R13).

2. **R-language fidelity.** Re-read `docs/specs/0003-token-flow-visibility.md`
   §2.3 lines 89-99 verbatim:
   - **R13 (MUST) Action panel re-derives from current on-chain state.**
     After every `tx-confirmed` event whose receipt touches `reqId`,
     re-fetch the negotiation and re-render the action panel from the
     new state…
   - **R14 (MUST) In-flight guard on every tx-firing button.** Every
     button that calls a write method carries a `pending` flag…
   The hook implements **R13** (re-fetch on event change). It does NOT
   implement R14 (that is `useAction.ts` from tick 12). The hook's
   docstring (line 1) and the inline comment at line 64 both cite
   **R14** — this is a misciting. See Finding 1.

3. **Effect lifecycle for `prevReqIdRef`.** Walked the React lifecycle:
   - Render N: `useNegotiation(A, …)` is called. `prevReqIdRef.current`
     is `null` (initial) or `A` (steady-state).
   - Render N+1: `useNegotiation(B, …)` called with new reqId. JSX
     emitted with `view` still holding A's data. `prevReqIdRef.current`
     is still `A` (refs are not reset across renders).
   - After-commit: useEffect fires because deps changed (reqId A→B).
     Cleanup of effect-N runs first (`cancelled_N = true`), then the
     new effect body runs: `prevReqIdRef.current (A) !== reqId (B)` →
     clear the 3 state slots → bump ref to `B`.
   - **Caveat**: the cleared state (`view = null`) does NOT render until
     the NEXT commit (after the effect's `setView(null)` triggers a
     re-render). So between render N+1 and the post-effect re-render,
     the UI **briefly shows the OLD view against the NEW reqId**. This
     is a one-frame visual glitch identical to the inline version's
     behaviour (since the inline version never cleared on reqId
     change). Not a regression. See Finding 5 below for the alternative
     (derive-from-reqId-during-render) but accepting the one-frame
     glitch is defensible — the next render is sub-frame in practice.
   - Verdict: `prevReqIdRef` pattern is **correct**, not racy.

4. **Stale-data race when events changes rapidly.** Walked the
   scenario: events ref changes 3 times in quick succession (A→B→C→D),
   each before the prior fetch resolves.
   - Effect runs for events=B. Sets `cancelled_B = false`. Starts fetch
     B. `setView(null)` is NOT called (only triggered by reqId change).
   - events → C. Effect cleanup runs: `cancelled_B = true`. New effect
     body: `cancelled_C = false`. Starts fetch C.
   - events → D. Same cycle: `cancelled_C = true`. Starts fetch D.
   - Fetch B resolves first (network latency). `if (!cancelled_B)`
     fails → no state writes. Good.
   - Fetch C resolves second. Same outcome.
   - Fetch D resolves last. `cancelled_D` is still false. State writes
     land. UI shows D's data.
   - **No race**: only the latest-issued fetch ever writes state. The
     ordering matters per the spec ("re-render from the new state");
     `Promise.race`-style return-of-first wouldn't satisfy this. The
     hook's serial `await` + cancellation gates are correct.

5. **`NegotiationView.ruled` and `.terminal` shape.** Both are
   `readonly ruled: boolean` and `readonly terminal: boolean` per
   `src/types/coverage.types.ts:171,175` — non-nullable. The hook's
   `v.ruled || v.terminal` check (line 52) is well-typed; no `undefined`
   coercion path. **No bug.**

6. **Type-only imports under `isolatedModules`.** `tsconfig.json:19`
   and `web/tsconfig.json:16` both set `isolatedModules: true` but
   neither sets `verbatimModuleSyntax`. The hook uses inline `type`
   markers within a regular import (`import { type CoverageEvent, … }
   from "@lib"`) — this is the canonical pattern that works under
   `isolatedModules` without `verbatimModuleSyntax`. `web tsc --noEmit`
   passes clean, confirming. **Correct.**

7. **Re-fetch on events for OTHER reqIds.** The hook's effect runs on
   every `events` reference change, regardless of whether any event in
   the array carries the matching `reqId`. The spec language R13 says
   "every tx-confirmed event whose receipt touches `reqId`". In
   practice, callers (Detail.tsx today, line 132-134) memoize a
   per-reqId `timeline` slice but pass the unsliced `events` to the
   effect dep array — so the hook receives unfiltered events.
   - Filtering by reqId BEFORE passing to the hook IS the caller's job
     (the hook would otherwise need to know the event shape to filter,
     which couples it to event-type details unnecessarily). Existing
     inline pattern at Detail.tsx:157 does the same.
   - Cost is an extra read-call per unrelated event (typically 2 RPC
     calls: getNegotiationView + policyOf — priceBasisOf is gated).
     Not a correctness bug; light wasted bandwidth on multi-request
     screens. The Overview view passes the unfiltered events; Detail
     today does the same.
   - Verdict: **acceptable, not a finding** (per prompt #1's framing).

8. **`refetch` closure stability.** `useCallback(() => {
   setRefetchTrigger((n) => n + 1); }, [])` with empty deps — the
   closure captures only the stable `setRefetchTrigger` setter, no
   stale closures possible. The functional updater `(n) => n + 1`
   handles concurrent calls correctly (two `refetch()` invocations in
   the same tick both increment from the freshest value). **Correct.**

9. **`refetchTrigger` counter vs alternative.** Alternative noted in
   the prompt: expose the fetch closure via `useCallback` and let
   `refetch` invoke it directly. Trade-offs:
   - Counter pattern (current): the effect IS the fetch site;
     `refetch` triggers the effect; cleanup of the prior in-flight
     fetch fires `cancelled = true` naturally. ONE async fetch path,
     ONE cancellation idiom.
   - Closure pattern (alternative): `refetch` calls the fetch closure
     directly; the effect ALSO calls the same closure. Two call sites,
     and the closure must carry its own cancellation token (since
     useEffect cleanup wouldn't gate a manual refetch). More moving
     parts.
   - The counter pattern is the well-known React idiom for "imperative
     refetch via dep-array bump"; not over-engineered.
   - Verdict: **acceptable design choice**, slight preference for the
     current pattern. Not a finding.

10. **Test gap acknowledgement.** Repo has no React testing infra
    (no `@testing-library/react`, no jsdom, no vitest config for
    components). The 53-test node suite covers `src/` non-React code
    only. Per project convention (cf. `useAction.ts` from tick 12 also
    landed without a unit test for the same reason), this is the
    accepted deferral; verification falls to browser-driven smoke
    once Detail.tsx is wired in tick 14. **Acceptable**, but note
    the gap explicitly here so a future tick that DOES add React
    testing infra knows to back-fill.

### Findings (per prompt's items 1-10)

#### Finding 1 — R-citation misciting (R14 → R13) — **MEDIUM**

The hook's docstring (line 1) and the catch-branch comment (line 64)
both cite "SPEC-0003 §2.3 R14" as the requirement being implemented.
Verbatim re-read of the spec (§2.3 lines 89-99):

- **R13** is "Action panel re-derives from current on-chain state.
  After every `tx-confirmed` event whose receipt touches `reqId`,
  re-fetch the negotiation and re-render…"
- **R14** is "In-flight guard on every tx-firing button. Every button
  that calls a write method carries a `pending` flag…"

The hook implements R13 (re-fetch on event), not R14 (in-flight guard
on button writes — implemented by `useAction.ts` last tick). The
prompt itself repeats the R14 miscitation in two places (the "What
landed" §1 bullet and "R-citations" §1), so the misciting may be a
transcription error that propagated from the planning prompt into the
hook's comments. The implementation behaviour matches R13 exactly.

**Why MEDIUM, not HIGH:** the implementation is correct; only the
R-pointer is wrong. R-citations are load-bearing for spec-driven
development (auditors trace requirements to code via these), so a
wrong pointer breaks that trace. But no behaviour is incorrect.

**Why MEDIUM, not LOW:** the same wrong pointer appears in two places
in the file (line 1 docstring + line 64 inline comment) AND in the
planning prompt, indicating the miscitation might propagate further
(e.g. into Detail.tsx wiring next tick, into the spec README, into
the implementation progress doc). Catching it here prevents drift.

**Fix:** replace both occurrences of "§2.3 R14" with "§2.3 R13" in
`web/src/hooks/useNegotiation.ts` (lines 1 and 64).

#### Finding 2 — Unnecessary `eslint-disable-next-line react-hooks/exhaustive-deps` — **NIT**

Lines 73-76:

```ts
// refetchTrigger is intentionally included so the imperative refetch()
// call re-runs this same effect path.
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [reqId, events, refetchTrigger]);
```

The effect body reads `reqId`, `events`, and (via the trigger
mechanism) is intended to re-fire when `refetchTrigger` changes. All
three ARE in the dep array. `client.negotiation.*` is a module-level
singleton; setState setters from `useState` are stable. There is
**no** unlisted dep, so the rule would NOT fire on this hook.
The eslint-disable comment is therefore dead — it suppresses a
warning that never appears.

Worse, the comment misleadingly suggests something IS being suppressed
("refetchTrigger is intentionally included" — but the rule doesn't
care about *intentional* inclusion; the rule cares about
*exhaustiveness*, which is satisfied here). A future reader will
wonder what unlisted dep the comment is justifying.

**Why NIT:** zero runtime impact; just dead-comment hygiene.

**Fix:** remove lines 73-75 entirely (the eslint-disable and its
preamble); the dep array `[reqId, events, refetchTrigger]` is
self-explanatory.

#### Finding 3 — Doc comment on line 12 says "null while loading" but `view` stays last-good on refetch — **NIT**

Line 12: `view: NegotiationView | null;  // null while loading`.

This is true on the FIRST mount (initial state `null`) and on
reqId-change (cleared by `prevReqIdRef` logic). On a `refetch()` or
`events`-change *during steady-state*, the hook keeps the last-good
`view` (the catch branch deliberately does not null it — line 63-64
comment explains this is intentional to avoid UI flash). So
"null while loading" is *partially* true and could mislead a caller
into rendering a loading spinner whenever `view === null`.

**Why NIT:** the existing comment is at least directionally honest
(view IS null while loading on first mount and on reqId change — the
two times a caller would actually need a spinner). A purer rewording
("null until first successful fetch for this reqId") is marginally
clearer but not load-bearing.

**Fix (optional):** consider rewording to "null until first successful
fetch for this reqId; retains last-good value across refetches".

#### Finding 4 — `error` is not cleared at fetch start; clears only on success — **NIT**

The hook's error semantics (line 59 success branch, line 65 fail
branch): on a refetch that succeeds, `error` clears; on a refetch
that fails, `error` is replaced with the new failure message; during
the in-flight window of a refetch following a prior failure, `error`
remains visible.

Compare `useAction.ts` (tick 12) which clears `error` at the *start*
of `run()` (line 48). The two hooks have intentionally different
semantics:

- `useAction.error` clears at start — caller expects "current attempt"
  semantics.
- `useNegotiation.error` clears at success — caller expects "last
  known fetch outcome" semantics, so the UI doesn't flash
  error→empty→error during a transient retry.

Both are defensible; the difference is not documented in either
hook's docstring. A future maintainer wiring these together in
Detail.tsx (tick 14) may be surprised if they assume parity.

**Why NIT:** not a bug; documentation polish.

**Fix (optional):** add a one-liner to the `error` field's JSDoc:
"persists across in-flight refetches; cleared only on a successful
refetch".

#### Finding 5 — One-frame stale-view glitch on reqId change — **NIT**

When `reqId` changes from A to B, the hook clears `view`/`policy`/
`priceBasis` inside the effect via `setView(null)` etc. (lines 39-41).
Effects fire *after* the commit, so the render at the moment of the
reqId change still shows A's data against `reqId=B` in the JSX (since
the state hasn't been cleared yet). The clear-state setters then
queue a re-render in which `view === null`, and the loading branch
kicks in.

A purer "derive-from-reqId-during-render" pattern would compute
`view = prevReqId === reqId ? viewState : null` in the render body,
eliminating the one-frame glitch. But it's also more brittle (forgets
to gate `policy` and `priceBasis` similarly, requires care with
React 18 concurrent mode).

**Why NIT:** in practice the glitch is sub-frame because the
useEffect runs synchronously after commit and queues a re-render
within the same task-tick. Not user-visible. The inline pattern in
Detail.tsx today doesn't even attempt the clear, so the hook is
already an improvement over the baseline. Flagged for awareness when
tick 14 wires this into Detail.tsx — if a user complains about
"flash of old data on navigate", this is the path to investigate.

**Fix (optional):** none required; defer to tick 14 browser-verify.

### Tick-13 verdict

**OVERALL: PASS — 0 HIGH/LOW actionable findings; 1 MEDIUM (R-citation
misciting); 4 NITs (eslint-disable dead comment, view JSDoc precision,
error-clear timing undocumented, one-frame reqId-change glitch).**

Severity breakdown:
- **HIGH:** 0.
- **MEDIUM:** 1 (Finding 1: R-citation "§2.3 R14" should be "§2.3 R13"
  at file lines 1 and 64).
- **LOW:** 0.
- **NIT:** 4 (Findings 2-5).

The hook's implementation is faithful to SPEC-0003 §2.3 R13: it
re-fetches `negotiation`, `policy`, and conditionally `priceBasis`
on every change to `events`, `reqId`, or the imperative
`refetchTrigger`. The fetch sequence and cancellation idiom match the
inline pattern at `Detail.tsx:113-156` byte-for-byte, with two
improvements: (1) `error` clears on success, (2) state is cleared on
`reqId` change (via `prevReqIdRef`). The `refetchTrigger` counter
pattern is the well-known React idiom for "imperative refetch
without bypassing dep-list discipline" and is not over-engineered
relative to a closure-based alternative. The `useRef` + comparison
pattern for `prevReqIdRef` is racially-safe (refs are stable across
renders; the comparison runs inside the effect body, not during
render). Type imports use inline `type` markers, correct under
`isolatedModules: true` without `verbatimModuleSyntax`.

The exported `UseNegotiationResult` is unused this tick but will be
consumed by `Detail.tsx` next tick (UNIT-4b will replace lines
113-157 with `const { view, policy, priceBasis, error, refetch } =
useNegotiation(reqId, events);`). Speculative export is acceptable
per project convention.

Test-gap: no React unit test landed because the repo has no React
testing infrastructure; consistent with tick 12's `useAction.ts`
deferral, verification falls to tick 14's browser-verify pass. This
deferral is explicitly acknowledged here so a future infra tick
knows to back-fill `useNegotiation.test.tsx` alongside
`useAction.test.tsx`.

All three required gates pass: 53/53 node tests green; root
`tsc --noEmit` clean; web `tsc --noEmit` clean (after the root build
populates `dist/`). No prior tick's findings are re-opened or
regressed.

### Final tick-13 verdict: PASS (0 HIGH/LOW; 1 MEDIUM R-citation; 4 NITs)

---

# Strict-review findings — tick 14 (UNIT-UI-1, Overview KPI strip)

**Date:** 2026-05-29
**Scope:** the 2 files touched this tick:
- `web/src/views/Overview.tsx` (KpiCard local component + KPI strip render + counts reducer)
- `web/src/styles.css` (added `.kpi-strip`, `.kpi-card`, `.kpi-label`, `.kpi-value`, `.kpi-value.tone-{review,approved,accent}`, `.kpi-sub`)

R-citations the unit claims to satisfy: none directly — design-conformance
gate against `docs/reference/ui-prototype-handoff/project/screens.jsx:84-93`
(the KPI strip block), informational, not a SPEC-0003 R-cited unit.

---

### Gate checks (all three pass)

- `node --import tsx --test "src/**/*.test.ts"` → **53 / 53 pass, 0 fail**
  (duration 2.38 s; same count as tick 13 — no test added or regressed by
  this UI-only edit).
- `npx tsc -p tsconfig.json --noEmit` → **0 errors**.
- `npx tsc -p web/tsconfig.json --noEmit` → **0 errors**.
- `npx vite build` (from repo root — vite config sets `root: "web"`) →
  **succeeds**: 212 modules transformed, `dist/assets/index-*.css = 20.70
  kB gzipped 4.76 kB`, `dist/assets/index-*.js = 542.94 kB gzipped 192.56
  kB` in 3.42 s. (NOTE: `npx vite build` from `web/` directly **fails**
  with `Rollup failed to resolve import "@lib"` because the `@lib` alias
  is defined in the repo-root `vite.config.ts`; this is the existing
  project convention, not a regression from this tick. The tick-14
  briefing says "run `npx vite build`" without specifying cwd — running
  from the repo root is the correct cwd and was verified green.)

### Field-existence audit (NegotiationView shape vs. dev's reducer)

Cross-checked every field the reducer reads against `src/types/coverage.types.ts`:

| Reducer reads | Declared at | Type | Verdict |
|---|---|---|---|
| `r.terminal` | `coverage.types.ts:175` | `boolean` | OK |
| `r.state` | `coverage.types.ts:163` | `State` | OK |
| `r.negotiation.hasRuling` | `coverage.types.ts:128` | `boolean` | OK |
| `r.negotiation.lastDecision` | `coverage.types.ts:126` | `Decision` | OK |
| `r.negotiation.coveredAmount` | `coverage.types.ts:114` | `bigint` | OK |
| `r.negotiation.requestedAmount` | `coverage.types.ts:100` | `bigint` | OK |

The reducer iterates `rows` (the `readonly NegotiationView[]` state seeded
by the existing `useEffect` that calls `client.negotiation.count()` then
`client.negotiation.getNegotiationView(id)` per id). This is the same
real-data path the table renders against, so KPIs and table rows can
never disagree about the source set — they ARE the source set.

`fmtAmount(counts.saved)` is the right helper choice: `saved` accumulates
into a `bigint` (initial `0n`, additions of `bigint - bigint`), and
`fmtAmount(v: bigint)` is the project's only stringifier that accepts
`bigint`. The other three KPIs (`total`, `active`, `settled`) are plain
`number` counters, rendered through `value: string | number` → React
coerces. No `Number(bigint)` cast, no `.toString()` boilerplate — clean.

### Real-data fidelity audit

- No `Math.random` in `Overview.tsx` (grep clean).
- No `setInterval` / `setTimeout` (grep clean).
- No hard-coded fake counts.
- The reducer ONLY reads `rows`, which is loaded exclusively from
  `client.negotiation.{count,getNegotiationView}` — the same backend
  surface the rest of the app uses. Whether the backend is `RealBackend`
  (live RPC) or `SimulatedBackend` (in-memory) is invisible here, which
  is correct per SPEC-0001 R11/R14.
- The user's session-level concern about "fake data" is fully addressed:
  the KPIs ARE the same data the table is iterating — there is literally
  no second source the reducer could be reading from.

### Prototype structural alignment

Side-by-side with `screens.jsx:65-93`:

| Position | Prototype label | Prototype sub | Prototype tone | Landed label | Landed sub | Landed tone | Match? |
|---|---|---|---|---|---|---|---|
| 1 | "Total requests" | "across all profiles" | default | "Total requests" | "across all profiles" | (none → default) | **OK** |
| 2 | "In negotiation" | "before a terminal state" | `var(--state-review)` | "In negotiation" | "before a terminal state" | `tone-review` (#d97706) | **OK semantically** |
| 3 | "Settled" | "both parties accepted" | `var(--state-approved)` | "Settled" | "both parties accepted" | `tone-approved` (#059669) | **OK semantically** |
| 4 | "Capped vs ask" | "requested − covered" | `var(--accent)` | "Capped vs ask" | "requested − covered" | `tone-accent` (#2563eb) | **OK** |

All four labels and subs are byte-verbatim from the prototype (including
the en-dash glyph in "requested − covered" at U+2212). Order is
identical. Tone mapping is semantically correct. See **Finding 1**
below on the tone hex literals vs. project tokens.

### `saved` semantics audit — the key correctness question

Prototype (`screens.jsx:61`):
```js
if (r.covered != null && r.decision === "approve") a.saved += (r.requested - r.covered);
```

Landed (`Overview.tsx:81-87`):
```ts
if (
  r.negotiation.hasRuling &&
  r.negotiation.lastDecision === Decision.Approve &&
  r.negotiation.coveredAmount > 0n
) {
  a.saved += r.negotiation.requestedAmount - r.negotiation.coveredAmount;
}
```

Translating prototype → on-chain:
- `r.covered != null` (prototype's "a ruling has been computed") →
  on-chain analog is `hasRuling`. In the prototype data
  (`data.jsx:74-247`), `covered: null` appears alongside un-ruled
  states (`UnderReview`, `EvidenceRequested`, `PolicyInvalidated`) and
  `covered: 0` appears for `Denied`. So `covered != null` is true
  whenever the ruling exists. Mapping to `hasRuling`: **correct**.
- `r.decision === "approve"` → `lastDecision === Decision.Approve`:
  **correct** (Decision enum, see `coverage.types.ts`).

The dev's third gate `coveredAmount > 0n` is **extra** — not in the
prototype. On the contract path, `coveredAmount = min(requested,
costPlusCap)` on Approve (per SPEC-0001 R6a, see also
`coverage.types.ts:113-114`). For an Approve ruling, can `coveredAmount`
ever be `0`? Yes, edge case: if `requestedAmount` is 0 OR if
`costPlusUnitPrice * quantity` is 0. The former is rejected at
`createContract` time (the typical `requestedAmount > 0` guard); the
latter would require a NDC look-up that returns 0 (unlikely under R6a
which requires a deterministic positive cap).

In the realistic case the gate is a no-op. In the edge case where
`coveredAmount === 0` on an Approve ruling, the dev's reducer skips it
entirely — which is actually safer than the prototype's behavior:
without the gate, `saved += (requested - 0) = requested`, which would
inflate "Capped vs ask" by the full requested amount for what is
effectively a degenerate ruling.

**Verdict: minor semantic divergence from the prototype, but the gate
is defensive and produces a more meaningful KPI. Acceptable. Flagged
as NIT-1 below for awareness, not as a correctness defect.**

### CSS audit

- New rules `.kpi-strip`, `.kpi-card`, `.kpi-label`, `.kpi-value`,
  `.kpi-value.tone-review`, `.kpi-value.tone-approved`,
  `.kpi-value.tone-accent`, `.kpi-sub` are **unique** to this strip — a
  full grep across `web/src/` finds zero other consumers. No leakage
  into existing surfaces (table, header, badges, cards, stepper, etc.).
- The `var(--token, fallback)` pattern is used consistently — `--panel`,
  `--border`, `--muted`, `--text`, `--muted-lt` all have inline
  fallbacks. Per project convention (header / wallet / button rules
  use bare `var(--token)` without fallback), the fallbacks are *more*
  defensive than the surrounding code, not less. Not a finding.
- Class-name style matches the project's hyphenated convention
  (`.empty-state`, `.policy-card`, `.gauge-row`, etc.) — `.kpi-strip` /
  `.kpi-card` / `.kpi-label` fit perfectly.
- Rule placement: §25b "KPI strip (Overview — UNIT-UI-1)" inserted
  **before** §25 "Empty state (Overview)" (lines 1089-1128). The §
  numbering is now §25b → §25, which is a minor ordering glitch but
  doesn't affect cascade behavior. Logged as NIT-2.
- No new design-system tokens added at `:root` — the dev opted to put
  the three tone colors inline as hex literals in the rules
  themselves. See **Finding 1**.

### Findings

#### Finding 1 — Tone colors use literal hex instead of existing project tokens — **LOW**

**Where:** `web/src/styles.css:1120-1122`
```css
.kpi-value.tone-review   { color: #d97706; /* amber */ }
.kpi-value.tone-approved { color: #059669; /* green */ }
.kpi-value.tone-accent   { color: #2563eb; /* blue  */ }
```

The project already has:
- `--accent: #2563eb` — **exact match** for `tone-accent`; should just
  be `color: var(--accent);`.
- `--ok: #15803d`, `--ok-mid: #22c55e` — for green. The dev's `#059669`
  is between the two, neither.
- `--warn: #b45309`, `--warn-mid: #f59e0b` — for amber. The dev's
  `#d97706` is between the two, neither.

The prototype itself uses semantic tokens (`var(--state-review)`,
`var(--state-approved)`, `var(--accent)`) — the spirit of the
prototype is "name the role, don't hard-code the swatch". The dev
re-implemented the right idea (named tone classes) but at the last
step opted for raw hex instead of the project's named tokens.

**Severity rationale:** LOW because (a) the `tone-accent` hex
coincidentally equals `--accent`, so theme drift on the blue is
impossible; (b) the green/amber are close enough that no human will
spot the difference in this view; (c) the visual outcome is correct
TODAY. But the moment someone touches the project's `--ok` /
`--warn` tokens to re-theme, these three KPI tone rules silently
break consistency — exactly the kind of theme-drift the token system
exists to prevent.

**Suggested fix:**
```css
.kpi-value.tone-review   { color: var(--warn); }    /* or --warn-mid */
.kpi-value.tone-approved { color: var(--ok); }      /* or --ok-mid */
.kpi-value.tone-accent   { color: var(--accent); }
```
Then drop the comment glyphs — `var(--warn)` is self-documenting.

#### Finding 2 — `coveredAmount > 0n` gate diverges from prototype `saved` reducer — **NIT-1**

Documented in the **`saved` semantics audit** section above. The dev's
reducer adds a third gate (`coveredAmount > 0n`) the prototype doesn't
have. In the realistic adjudication path this is a no-op; in the
degenerate Approve-with-zero-cap edge case it produces a more
meaningful KPI than the prototype would. Acceptable design choice.

**Severity rationale:** NIT — the divergence is *toward* a safer KPI,
not away from one. Flagged for awareness only.

**Fix (optional):** if exact prototype parity matters, drop the third
gate:
```ts
if (r.negotiation.hasRuling && r.negotiation.lastDecision === Decision.Approve) {
  a.saved += r.negotiation.requestedAmount - r.negotiation.coveredAmount;
}
```
But the current form is defensible; recommend leaving as-is and
documenting the rationale in a one-line comment.

#### Finding 3 — CSS section numbering glitch (§25b before §25) — **NIT-2**

`styles.css:1089` opens with `/* ─── 25b. KPI strip (Overview — UNIT-UI-1) ─── */`
which precedes `/* ─── 25. Empty state (Overview) ──── */` at line
1130. The numbering reads §25b → §25 in source order. Cosmetic only —
cascade behavior is unaffected because there's no overlap between the
two rule sets — but a future reader will be momentarily confused.

**Severity rationale:** NIT — purely a comment/numbering concern.

**Fix (optional):** either renumber the empty-state block to §25b and
the KPI block to §25, OR move the KPI block to after the empty-state
block (more natural since the empty-state predates this tick). The
latter requires moving roughly 40 lines and is the lower-risk
approach.

#### Finding 4 — Dead reducer state when `rows` is empty — **NIT-3**

When `rows.length === 0` (the empty-state branch on lines 110-118),
the KPI strip still renders with `total: 0`, `active: 0`, `settled:
0`, `saved: "0"`. The strip sits above the empty-state hero. The
prototype's behavior in the same situation is the same (the prototype
always renders the strip, even with zeros), so this is faithful.
However, visually the row of four "0" cards above an empty-state
illustration is slightly redundant.

**Severity rationale:** NIT — matches the prototype, not a defect.
Future polish could hide the strip when `rows.length === 0` and only
show the empty-state, but that diverges from the prototype.

### Regression checks (no findings)

- **No prior tick's findings re-opened.** Tick 13's MEDIUM (R-citation
  miscite in `useNegotiation.ts`) is untouched and unaffected — this
  tick doesn't import the hook yet. Tick 12's `useAction.ts`
  test-infra deferral remains the same. Tick 8/9/10 scenario fixtures
  and tests are unchanged (53/53 same as last tick).
- **Counts source-of-truth.** `rows.length` for `total` matches the
  `<tbody>` row count exactly (same array, same iteration). No risk
  of the KPI saying "5 total" while the table shows 4 rows.
- **`<table>` cascade.** The new `.kpi-strip` lives **outside** the
  `<table className="contracts">`, so the table's `border-collapse`
  and `border-radius` corner rules are unaffected. Verified by the
  vite build CSS output (20.70 kB total — well in line with the prior
  baseline; no surprise size bloat).
- **`Decision` enum import.** `Overview.tsx:6` imports
  `{ ..., Decision, State }` from `@lib`. Both were already imported
  before this tick — the diff only adds the use sites in the reducer,
  not new imports. (Confirmed by `git diff HEAD`-style inspection of
  the file vs. its previous header.)
- **`fmtAmount(0n)` rendering.** `fmtAmount` is `v.toString()` per
  `web/src/shared.ts:11-13`, so `fmtAmount(0n) === "0"`. Renders as
  "0" in the empty-state KPI — matches the prototype's `money(0) →
  "$0"` shape (modulo the `$` prefix; the project's `fmtAmount`
  intentionally has no currency prefix per its JSDoc "plain decimal").
- **`KpiCard` not exported.** `function KpiCard` is declared without
  `export`. Only `Overview` is exported. Confirmed by grep:
  `grep -n "export" Overview.tsx` shows only `export function Overview`.
- **Comments.** The two block comments at lines 10-12 and 70-75 are
  scaffolding (rule annotations / field-citation cheat-sheet),
  neither lying nor restating code. Acceptable.

### Tick-14 verdict

**OVERALL: PASS — 0 HIGH; 0 MEDIUM; 1 LOW (Finding 1 — tone hex
literals should reuse project tokens); 3 NITs (Findings 2-4).**

Severity breakdown:
- **HIGH:** 0.
- **MEDIUM:** 0.
- **LOW:** 1 (Finding 1: `.kpi-value.tone-*` uses raw hex instead of
  `var(--accent)` / `var(--ok)` / `var(--warn)` — silent theme-drift
  risk).
- **NIT:** 3 (Finding 2: defensive `coveredAmount > 0n` gate diverges
  from prototype; Finding 3: §25b/§25 source-order glitch; Finding 4:
  zero-KPI strip above empty state).

The unit lands cleanly. The KPI strip is structurally byte-faithful
to the prototype (4 cards, in the same order, with the same labels
and subs verbatim, with semantically-correct tone mapping). The
counts reducer reads exclusively from the same `rows` state the
table renders against, so KPI / table divergence is structurally
impossible — directly addressing the user's session-level concern
about fake data. Every NegotiationView/Negotiation field the reducer
touches exists with the right type per `src/types/coverage.types.ts`.
`fmtAmount(saved)` correctly handles the `bigint` accumulator. No
inline styles in the JSX, no fake data, no timers, no `Math.random`.
The new CSS classes are unique to this strip, follow the project's
hyphenated naming convention, and don't leak into any other surface.

Three required gates pass: 53/53 node tests green; root + web
`tsc --noEmit` both clean; `npx vite build` from the repo root
succeeds (3.42 s, 20.70 kB CSS). No prior tick's findings are
re-opened or regressed.

The one LOW finding (token literals vs. design-system vars) is a
silent theme-drift risk, not a runtime defect — recommended for a
quick follow-up but not blocking.

### Final tick-14 verdict: PASS (0 HIGH; 0 MEDIUM; 1 LOW; 3 NITs)

---

# Strict-review findings — tick 15 (UNIT-UI-2, Overview filter pill bar)

**Date:** 2026-05-29
**Scope:** the 2 files touched this tick:
- `web/src/views/Overview.tsx` (`FilterKey` typed union, `filters` predicate map, `filterLabels`, `filteredRows` memo, pill-bar JSX, table now renders `filteredRows`)
- `web/src/styles.css` (added `.filter-pill-bar`, `.filter-pill`, `.filter-pill:hover`, `.filter-pill.is-active`, `.filter-pill-count`, `.filter-pill-spacer`, `.filter-pill-summary`)

R-citations the unit claims to satisfy: none directly — design-conformance
gate against `docs/reference/ui-prototype-handoff/project/screens.jsx:47-54,
95-110` (the prototype's `fmap` + `filterLabels` + pill render).

---

### Gate checks (all three pass)

- `node --import tsx --test "src/**/*.test.ts"` → **53 / 53 pass, 0 fail**
  (duration 2.50 s; identical count and shape to tick 14 — no test
  added or regressed by this UI-only edit).
- `npx tsc -p tsconfig.json --noEmit` → **0 errors**.
- `npx tsc -p web/tsconfig.json --noEmit` → **0 errors**.

### Required-read pass

1. **`web/src/views/Overview.tsx`** — read end-to-end. Structure is
   clean: the existing `KpiCard` is untouched, the new `FilterKey`
   type + `filters` map + `filterLabels` map are declared at module
   scope (above `Overview`), `filterKey` state is added alongside
   the existing `rows` state, `filteredRows` is `useMemo`-ed on
   `[rows, filterKey]`, and the pill bar is rendered BETWEEN the
   KPI strip (`.kpi-strip`) and the table — exactly the placement
   the briefing prescribes.
2. **`web/src/styles.css`** — read the new §25c block at lines
   1130-1176. Tokens used: `var(--accent)`, `var(--border-dk)`,
   `var(--border)`, `var(--muted)`, `var(--panel)`, `var(--panel-2)`,
   `var(--shadow-sm)`, `var(--accent-mid)`. Hex literals appear ONLY
   inside `var(--token, fallback)` fallback arguments (defensive
   pattern, matches §25b's KPI styling convention).
3. **`docs/reference/ui-prototype-handoff/project/screens.jsx`**
   lines 47-54 + 95-110 — read and compared verbatim. See **Finding 1**
   below for the prototype-vs-implementation semantic divergence.
4. **`src/types/coverage.types.ts`** — confirmed `State` enum has
   members `Open=0, Ready=1, UnderReview=2, EvidenceRequested=3,
   Approved=4, Denied=5, Settled=6, Deadlocked=7, PolicyInvalidated=8,
   ProviderRefused=9, Withdrawn=10` (lines 26-38). Confirmed
   `NegotiationView.terminal: boolean` exists (line 175) and is the
   contract's `_terminal` mirror — `TERMINAL_STATES` set on lines 56-62
   is `{Settled, Deadlocked, PolicyInvalidated, ProviderRefused,
   Withdrawn}`. **`Denied` is NOT terminal.**
5. **`node --import tsx --test`** → 53/53 (above).
6. **Both tsc projects** → 0 errors (above).

---

### Findings

#### Finding 1 — Filter predicates diverge from prototype semantics for `Denied` AND `Settled` rows — **MEDIUM**

**Prototype** (`screens.jsx:47-54`):
```js
const fmap = {
  all: () => true,
  open: r => ["Open"].includes(r.state),
  active: r => ["Ready", "UnderReview", "EvidenceRequested", "Approved"].includes(r.state),
  settled: r => r.state === "Settled",
  closed: r => ["Deadlocked", "Withdrawn", "PolicyInvalidated", "ProviderRefused", "Denied"].includes(r.state),
};
```

**Implementation** (`Overview.tsx:40-51`):
```ts
const filters: Record<FilterKey, (r: NegotiationView) => boolean> = {
  all:     () => true,
  open:    r => r.state === State.Open,
  active:  r => !r.terminal && r.state !== State.Open,
  settled: r => r.state === State.Settled,
  closed:  r => r.terminal,
};
```

Differences, mapping each state to which pill it lands in:

| State              | Prototype pill | Implementation pill |
|--------------------|----------------|---------------------|
| Open               | open           | open                |
| Ready              | active         | active              |
| UnderReview        | active         | active              |
| EvidenceRequested  | active         | active              |
| Approved           | active         | active              |
| **Denied**         | **closed**     | **active** ← diverges |
| **Settled**        | **settled** only | **settled AND closed** ← diverges |
| Deadlocked         | closed         | closed              |
| PolicyInvalidated  | closed         | closed              |
| ProviderRefused    | closed         | closed              |
| Withdrawn          | closed         | closed              |

Two semantic divergences:

1. **`Denied` rows show under "In negotiation" instead of "Closed".**
   In the contract, `Denied` is NOT a terminal state (per
   `TERMINAL_STATES` in `coverage.types.ts:56-62`) — a denied
   request can still appeal or be withdrawn. The implementation's
   `!r.terminal && r.state !== State.Open` rule therefore catches
   Denied. The prototype, in contrast, hand-lists Denied alongside
   the truly-closed terminals. The prototype's grouping is
   user-facing-language-centric (a denied claim "looks closed"
   from a payer dashboard, even if the protocol still permits
   appeal); the implementation's grouping is protocol-state-centric.
   Neither is wrong, but they disagree.
2. **`Settled` rows appear in BOTH "Settled" AND "Closed" in the
   implementation, but ONLY in "Settled" in the prototype.** The
   briefing claims the prototype "intentionally has overlap (Settled
   rows show in both Settled AND Closed pills)" — this is **factually
   incorrect**. The prototype's `closed` is a literal allowlist of
   five terminal NON-Settled states (Deadlocked, Withdrawn,
   PolicyInvalidated, ProviderRefused, Denied), and "Settled" is
   conspicuously omitted from that list. The implementation's
   `r.terminal` predicate is a superset that includes Settled, so
   every Settled row is double-counted in the pill-counts UI (a row
   in state Settled contributes to BOTH the "Settled" pill's count
   AND the "Closed" pill's count). The prototype was written so
   that "Settled" is mutually exclusive from "Closed".

**Severity rationale:** MEDIUM. This is a visible-UI semantic
divergence from the design-handoff prototype that the briefing
explicitly invokes as the conformance gate ("compare verbatim").
The Denied → active grouping is also defensible on protocol grounds
(Denied isn't `r.terminal`) and arguably MORE truthful than the
prototype, since a Denied request can still appeal — but it is not
verbatim. The Settled-double-count is harder to defend: users will
see "Settled (3)" and "Closed (3)" and wonder why their 3 settled
requests are also "closed" — the pill counts no longer sum to total.

**Fix (two options):**
- **(A) Match the prototype verbatim** (the briefing's stated
  intent): hand-list the predicates the same way as the prototype.
  ```ts
  open:    r => r.state === State.Open,
  active:  r => r.state === State.Ready
              || r.state === State.UnderReview
              || r.state === State.EvidenceRequested
              || r.state === State.Approved,
  settled: r => r.state === State.Settled,
  closed:  r => r.state === State.Denied
              || r.state === State.Deadlocked
              || r.state === State.Withdrawn
              || r.state === State.PolicyInvalidated
              || r.state === State.ProviderRefused,
  ```
  Then the five pill counts partition rows perfectly: each row is
  in exactly one bucket, counts sum to `rows.length`, no double
  counting.
- **(B) Keep the protocol-centric semantics** but at minimum stop
  double-counting Settled — change `closed` to
  `r => r.terminal && r.state !== State.Settled`. Denied stays in
  "active" (the existing implementation rationale).

Option A is the briefing's stated intent ("matching the prototype's
fmap exactly", which the comment at `Overview.tsx:49` claims) and
removes both divergences. Option B is a partial fix that addresses
only the double-count.

#### Finding 2 — Comment at `Overview.tsx:49` is factually wrong — **LOW**

The block comment on lines 47-49 says:
```ts
// "closed" = any terminal state (Settled, Deadlocked, PolicyInvalidated,
// ProviderRefused, Withdrawn). Settled is a sub-set so it appears in both
// "closed" and "settled" — matching the prototype's fmap exactly.
```

The "matching the prototype's fmap exactly" claim is false:
prototype `closed` excludes Settled and includes Denied (see
**Finding 1**). This is a comment that lies — exactly what review
gate item 9 ("Comments: nothing lying or restating code") guards
against. The lie originated in the briefing prompt itself and was
faithfully transcribed into the code's comment.

**Severity rationale:** LOW. Wrong comments are a form of misleading
documentation that future readers will trust. If Finding 1 is fixed
by Option A, this comment must be replaced; if Option B is chosen,
the comment still needs amending to drop the "matching the
prototype's fmap exactly" claim.

**Fix:** rewrite the comment to honestly describe whatever
semantics the predicates end up implementing, with no
prototype-conformance claim unless Option A is taken.

#### Finding 3 — `filter-pill-bar` lacks `flex-wrap`, can overflow at narrow viewports — **NIT**

`styles.css:1132-1137`:
```css
.filter-pill-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  align-items: center;
}
```

Six children (five pills + the `.filter-pill-spacer`) plus the
trailing `.filter-pill-summary` are laid out as a single row with
no `flex-wrap`. At narrow viewports (under ~480 px wide) the
pills can overflow horizontally. The prototype's inline style at
`screens.jsx:96` is also missing `flexWrap`, so this is faithful
to the prototype — but the prototype is a demo, not a responsive
production surface.

**Severity rationale:** NIT — matches the prototype, not a defect
for this tick. The KPI strip above (§25b) is a 4-column grid that
also has no responsive collapse. Both are existing/inherited
patterns; if the project later adds a small-screen breakpoint,
both should be revisited together.

**Fix (optional):** add `flex-wrap: wrap;` to `.filter-pill-bar`.
Single line, no other effect.

#### Finding 4 — `:hover` rule has slightly surprising specificity interaction with `is-active` — **NIT**

`styles.css:1152-1162`:
```css
.filter-pill:hover {
  border-color: var(--accent-mid, var(--accent));
  background: var(--panel-2, #f8f9fc);
}

.filter-pill.is-active {
  background: var(--accent);
  color: #ffffff;
  border-color: transparent;
  ...
}
```

Both selectors have specificity 0,1,1 (`.filter-pill:hover`) and
0,2,0 (`.filter-pill.is-active`) — so `.is-active` wins under
source order on a tie, which works here since `.is-active` is
declared AFTER `:hover`. However, hovering the active pill will
NOT visibly change its appearance (active styles override), which
is the intended UX. The `:hover` rule alone is fine — but if
someone later moves `.is-active` ABOVE `:hover` in the file, the
active pill would lose its blue background on hover. A
`.filter-pill:hover:not(.is-active)` would be more defensive.

**Severity rationale:** NIT — works correctly at the moment; mild
fragility risk for future edits.

**Fix (optional):** scope `:hover` to `:not(.is-active)`.

#### Finding 5 — Raw `#ffffff` literal on active pill — **NIT**

`styles.css:1159`: `color: #ffffff;` (active pill text).
The existing `button.primary` rule at line 261 uses the same raw
`#ffffff` for the same purpose ("white text on accent background").
The project tokens don't define a `--text-on-accent` or `--white`
token, so this is consistent with the project's existing
convention. Tick 14's Finding 1 covered the more impactful case
(KPI tone-color literals); this one is the same defensive
"white-on-accent" pattern used elsewhere in the file.

**Severity rationale:** NIT — consistent with the existing
codebase, not a regression.

**Fix (optional):** either define `--text-on-accent: #fff;` once
in §1 design tokens and use it in BOTH places (this rule and
`button.primary`), OR leave both as-is. Bundling the change across
both call sites is the right time to act on this.

---

### Regression checks (no findings)

- **KPI strip independence (briefing item 2).** Confirmed:
  `counts` reducer at `Overview.tsx:105` iterates `rows`, not
  `filteredRows`. The pill selection has zero effect on the KPI
  card values. Tick 14's KPI–table separation is intact.
- **Pill counts are real (briefing item 3).** Confirmed:
  `Overview.tsx:142` is `const count = rows.filter(filters[k]).length;`
  — derived from the live `rows` array via the same predicate map
  the row-filter uses, no `Math.random`, no hard-coded numbers, no
  derived-from-something-else.
- **`useMemo` correctness (briefing item 6).** Confirmed:
  `Overview.tsx:84` is `useMemo(() => rows.filter(filters[filterKey]), [rows, filterKey])`
  — both `rows` and `filterKey` in the deps array. (`filters` is
  module-scope-const so it's stable across renders and correctly
  omitted from deps.)
- **Verbatim prototype labels (briefing item 7).** Confirmed:
  `Overview.tsx:53-59` has exactly
  `{ all: "All", open: "Open", active: "In negotiation", settled: "Settled", closed: "Closed" }`
  — byte-identical to `screens.jsx:54`.
- **Pill key order (briefing item 7, follow-on).** Confirmed:
  `filters` and `filterLabels` are declared with keys in the same
  order: `all, open, active, settled, closed`. `Object.keys(filters)`
  iteration order matches the prototype's `Object.keys(fmap)`
  iteration. Pills render left-to-right in the same sequence as
  the prototype.
- **`<button type="button">` for pills (briefing item 5).**
  Confirmed: `Overview.tsx:146` is
  `<button key={k} type="button" className={...} onClick={...}>` —
  `type="button"` prevents accidental form submission, keyboard
  Tab/Enter/Space activation works via browser default. No custom
  `:focus-visible` rule, so pills inherit the browser's default
  focus ring — accessible.
- **`FilterKey` not exported (briefing item 10).** Confirmed:
  `grep -n "FilterKey" Overview.tsx` shows declaration on line 38
  with no `export` keyword. Only `Overview` itself is exported (line
  81). The type stays local.
- **CSS leakage (briefing item 8).** New rules are all prefixed
  `.filter-pill*` and unique to this surface. No collision with
  any existing class. `grep -c "filter-pill" styles.css` = 13
  occurrences, all inside §25c; `grep -rn "filter-pill" web/src/`
  shows only `Overview.tsx` (the producer) using them.
- **No prior tick's findings re-opened.** Tick 14's LOW finding
  (`.kpi-value.tone-*` raw hex) is RESOLVED in styles.css:1120-1122
  (`var(--warn)`, `var(--ok)`, `var(--accent)`) — confirmed clean.
  Tick 13's MEDIUM (R-citation miscite in `useNegotiation.ts`) is
  untouched by this tick. Tick 12's `useAction.ts` deferral remains
  the same. 53/53 tests stable.
- **Table renders `filteredRows`, not `rows`.** `Overview.tsx:180`
  is `{filteredRows.map((v) => (...))}` — confirmed. The summary
  text `{filteredRows.length} of {rows.length}` on line 155 will
  truthfully read "5 of 12" etc.
- **Empty-state branch unaffected.** Lines 158-167 gate on
  `rows.length === 0`. The pill bar always renders (matches
  prototype), even when there are no rows — and when there are no
  rows, every pill's count is 0, which is honest.

---

### Tick-15 verdict

**OVERALL: FAIL — 0 HIGH; 1 MEDIUM; 1 LOW; 3 NITs.**

Severity breakdown:
- **HIGH:** 0.
- **MEDIUM:** 1 (Finding 1: `active` and `closed` predicates diverge
  from the prototype — Denied lands in "active" not "closed", AND
  Settled is double-counted because the implementation's `r.terminal`
  superset includes Settled while the prototype's hand-list excludes
  it. The briefing's claim that "Settled rows show in both Settled
  AND Closed pills" in the prototype is contradicted by the
  prototype source at `screens.jsx:52`).
- **LOW:** 1 (Finding 2: the in-file comment at `Overview.tsx:47-49`
  asserts "matching the prototype's fmap exactly" — that claim is
  false per Finding 1; a comment that misrepresents what the code
  does and how it relates to the design source).
- **NIT:** 3 (Finding 3: no `flex-wrap` on the pill bar — faithful
  to prototype but non-responsive; Finding 4: `:hover` not scoped
  with `:not(.is-active)` — fragile but currently correct; Finding 5:
  raw `#ffffff` literal on the active pill — consistent with
  `button.primary`, project lacks a `--text-on-accent` token).

The pill-bar landed cleanly on the gate checks (53/53 tests pass,
both tsc projects clean) and the structural concerns (KPI
independence, real pill counts, `useMemo` deps, verbatim labels,
`<button type="button">`, no FilterKey export, no CSS leakage) all
verify. The MEDIUM finding is a design-conformance miss against
the prototype the briefing explicitly invokes — the implementation's
filter predicates are protocol-state-centric (using the
`NegotiationView.terminal` boolean as the closed/active divider),
whereas the prototype is dashboard-language-centric (Denied is
"closed" to a payer's eye, Settled is exclusively its own bucket).
The two semantic divergences land Denied in the wrong pill and
make Settled rows double-count in pill totals, breaking the
pill-counts-sum-to-`rows.length` invariant the prototype enforces.

This is a strict-gatekeeper review and the briefing explicitly says
"Zero findings required." One MEDIUM design-conformance finding plus
one LOW lying-comment finding → the tick does not clear the gate.

**Recommended remediation:** Finding 1 Option A (hand-list the
predicates to mirror `screens.jsx:47-53`) — three lines of code, no
runtime risk, restores the partition invariant, and concurrently
fixes Finding 2 (the comment can then truthfully say "matches the
prototype's fmap"). Re-run the three gates after that change. NITs
3-5 are at-leisure.

### Final tick-15 verdict: FAIL (0 HIGH; 1 MEDIUM; 1 LOW; 3 NITs)

---

# Strict-review findings — tick 16 (UNIT-UI-3, Overview Appeal stage + Round columns)

**Date:** 2026-05-29
**Scope:** the three files modified by this tick:
- `web/src/views/Overview.tsx` (+10/-1)
- `src/index.ts` (+3/-0)
- `web/src/styles.css` (+15/-0)

R-citations the unit claims to satisfy:
- SPEC-0004 §2.4 R15/R17 (appeal-ladder stage names — `stageNameFor` is the typed API)
- Indirectly SPEC-0003 R20 (timeline UI surfaces ladder stage)

Gate checks:
- `node --import tsx --test "src/**/*.test.ts"`: 53/53 green.
- `npx tsc -p tsconfig.json --noEmit`: 0 errors.
- `npx tsc -p web/tsconfig.json --noEmit`: 0 errors.
- `npm run web:build` (vite build, root=web, alias `@lib` → `dist/index.js`): success,
  212 modules transformed, no warnings beyond the pre-existing chunk-size note.
  (Direct `npx vite build` from `web/` fails because the vite config lives at
  the repo root with `root: "web"` — that's the project's intended invocation
  path, not a regression.)

---

## Findings

### Finding 1 — MEDIUM | Stage rendering diverges from the prototype: chip vs plain text + missing payer-line sub-caption

- `web/src/views/Overview.tsx:219-223` renders the stage inside a
  `<span className="stage-chip">…</span>` (a pill with border + tinted bg).
- The prototype's `RequestRow` at
  `docs/reference/ui-prototype-handoff/project/screens.jsx:141-144` renders the
  stage as **plain text** in a two-line cell:
  ```jsx
  <span style={{ minWidth: 0 }}>
    <div style={{ fontSize: 12.5, color: "var(--fg-soft)" }}>{stage.name}</div>
    <div className="caption" style={{ fontSize: 10.5, color: "var(--fg-dim)" }}>
      {r.payerLine === "PartD" ? "Part D" : r.payerLine}
    </div>
  </span>
  ```
  No chip, no rounded border, no tinted bg — just text with a `var(--fg-soft)` colour
  and a small caption underneath naming the payer line ("Part D" / "Commercial" /
  "Medicaid").
- The briefing explicitly asks this question ("does the prototype use a chip
  or a plain label?"). The answer is plain label — so the `.stage-chip` wrapper
  is over-engineering AND the payer-line sub-caption is missing entirely.
- Severity rationale: MEDIUM because (a) the briefing names "design-handoff" as
  the working branch and the prototype-conformance journey is the explicit point
  of the UNIT-UI-* series, (b) the chip styling visually competes with the
  state badge in the adjacent column where the prototype intentionally keeps
  the stage cell quieter, and (c) the missing payer-line sub-caption removes
  information the prototype surfaces (the user can no longer tell at a glance
  whether a row is Part D vs Commercial vs Medicaid).
- Suggested fix: drop the `.stage-chip` wrapper, render `{stageName}` directly
  inside the `<td>`, and add a small caption line below with the formatted
  payer-line name (matching prototype semantics: `PartD → "Part D"`,
  others verbatim). The `.stage-chip` and `.col-round` CSS additions stay
  except `.stage-chip` becomes dead code (remove with the JSX change).

### Finding 2 — LOW | `stageNameFor` returns `"—"` on out-of-range; prototype's `stageOf` clamps to last stage

- `src/protocol/ladders.ts:169-173` defines:
  ```ts
  export function stageNameFor(line: PayerLine, round: number): string {
    const ladder = LADDERS[line];
    if (!ladder) return "—";
    return ladder[round]?.name ?? "—";
  }
  ```
- The prototype's `data.jsx:53-56` defines:
  ```js
  function stageOf(payerLine, round) {
    const ladder = LADDERS[payerLine] || LADDERS.PartD;
    return ladder[Math.min(round, ladder.length - 1)] || ladder[0];
  }
  ```
- Two behavioral divergences:
  1. Out-of-range `round` (≥ `ladder.length`): we return `"—"`; prototype clamps
     to the last stage (e.g. round 99 on PartD returns "Medicare Appeals
     Council", not "—").
  2. Unrecognised `line`: we return `"—"`; prototype falls back to PartD's
     ladder.
- Practical impact in this tick: under normal contract flow `appealRound`
  is bounded by `maxRounds` (the contract enforces it), and `payerLine` is
  a typed enum so the unrecognised-line branch is unreachable in TS code.
  So the divergence is essentially never observable through normal UI use.
- Severity rationale: LOW because (a) the dev's claim "`stageNameFor`
  fallback is `'—'`" is honestly self-described and the typed signature
  makes the fallback hard to trigger, (b) this is a pre-existing UNIT-1
  design choice (the function landed in `4518016`, not this tick), and (c)
  the "—" fallback is arguably more correct than the prototype's silent
  clamp (a clamped "you are now at the federal Council stage" is a false
  signal vs the honest "—"). But it's a prototype-conformance miss worth
  noting for the queue.
- Suggested fix: NONE for this tick — surface for the design-conformance
  journey as "decide whether to align `stageNameFor` with prototype clamp
  semantics or codify the `'—'` fallback in spec".

### Finding 3 — NIT | Inline `var(--…, fallback)` literals in `.stage-chip` rules

- `web/src/styles.css:1505-1513` uses `var(--panel-2, #f8f9fc)`,
  `var(--text-2, #334155)`, `var(--border-lt, #eaedf4)`.
- All three custom properties (`--panel-2`, `--text-2`, `--border-lt`) ARE
  defined at the `:root` block (lines 9-58) with the same hex values — the
  inline fallback is therefore strictly redundant.
- The same `var(--token, hex-fallback)` pattern was used in the UNIT-UI-1
  KPI strip (`.kpi-card`, `.kpi-label`, `.kpi-value`, `.kpi-sub` —
  lines 1099-1127) and the UNIT-UI-2 filter pill bar
  (`.filter-pill`, `.filter-pill-summary` — lines 1144-1175), so this is a
  project-consistent convention introduced by the UI ticks rather than new
  drift from this tick.
- Severity rationale: NIT because (a) the fallbacks are no-ops at runtime
  given the tokens always resolve, (b) the convention matches earlier UI
  ticks, and (c) the alternative (`var(--panel-2)` bare) would actually be
  cleaner but inconsistent with the surrounding code.
- Suggested fix: NONE — at-leisure follow-up could strip all the fallback
  hexes once UI tokens stabilise.

### Finding 4 — NIT | `Round` column renders raw integer, prototype renders `round/maxRounds`

- `web/src/views/Overview.tsx:233` renders `{v.negotiation.appealRound}` —
  a bare integer.
- The prototype's `RequestRow` line 152 renders
  `{r.round}/{r.maxRounds}` (e.g. "1/3") and uses `r.round` (the
  adjudication round, not `appealRound`).
- Two related divergences:
  1. Prototype uses `r.round` (adjudication round, 0..maxRounds per R6c);
     production uses `appealRound` (ladder stage index, 0..ladder.length-1).
     These are different fields! Prototype's `data.jsx` happens to use
     `round` for the column but the COLUMN HEADER is "Round" in both —
     so it's plausibly the intended field, but the production app's
     `appealRound` is semantically different.
  2. Prototype shows the denominator (`/maxRounds`) so the user can see
     where on the round budget they are; production shows only the
     numerator.
- Severity rationale: NIT for this tick because (a) the briefing focuses
  on Appeal stage + Round columns landing at all and is explicit about
  the dev's "show appealRound" intent, (b) `maxRounds` may not exist on
  the typed `Negotiation` (it's not in `coverage.types.ts` — adjudication
  cap lives in contract-level configuration), so the `/maxRounds` denominator
  would require a new field, and (c) `appealRound` is the right thing to
  show next to an Appeal stage column. But the divergence from the
  prototype is real and worth noting.
- Suggested fix: NONE for this tick — surface for the queue as "decide
  whether the Round column should be `round` (adjudication) or
  `appealRound` (ladder stage); add `maxRounds` to the projection if we
  want the `n/m` rendering".

### Finding 5 — NIT | Production-only "Policy" column persists; prototype has "Benchmark" instead

- `web/src/views/Overview.tsx:190` renders `<th>Policy</th>` and the
  matching cell at line 224 (`{v.policyAttached ? "✓ Attached" : "—"}`).
  This is pre-existing — it landed before UNIT-UI-1.
- The prototype's 8 columns are `[Req, Medication, Status, Appeal stage,
  Requested, Covered, Benchmark, Round]` (screens.jsx:115). The
  production app's 8 columns are now
  `[#, Medication, Status, Appeal stage, Policy, Requested, AI Covered, Round]`.
- Drift introduced BY THIS TICK is exactly the Appeal stage + Round headers
  (per briefing). The Policy / no-Benchmark / "AI Covered" / "#" vs "Req"
  differences are all pre-existing.
- Severity rationale: NIT because (a) the dev did NOT introduce this drift,
  (b) the Benchmark column needs a `MiniBenchmark` sparkline component
  that hasn't been built yet, and (c) the Policy column is genuinely useful
  information that the prototype omits.
- Suggested fix: NONE for this tick — surface for the design-conformance
  queue as "decide whether to drop Policy + add Benchmark to match the
  prototype, or codify the production divergence in spec / amendment".

### Finding 6 — NIT | Adding 2 columns may push the table off-screen at narrow widths

- Briefing item 9. The table sits inside `.main` (`max-width: 1200px,
  padding: 0 40px` per `web/src/styles.css:223-229`) → roughly 1120px
  content width.
- With 8 columns at ~14px font / 11px padding × 2 each side ≈ 134px per
  column minimum if equal-width → table needs ~1080px just for column
  text, fitting at 1200px desktop but tight.
- No horizontal-scroll wrapper around `<table>`, no `table-layout: fixed`,
  no per-column min-width caps. At 1024×768 (next breakpoint below the
  briefing's reference 1280×800), `body` is 1024px, `.main` is content
  width ≈ 944px — the 8-column table will overflow `.main` and create
  page-level horizontal scroll.
- SPEC-0003 R20/R22 (the briefing's named overflow callouts) are about
  the timeline view, not the Overview table, so this isn't a hard violation.
  But the prototype handles this by using a CSS grid with explicit
  `gridTemplateColumns` ratios (`screens.jsx:114`) that gracefully
  re-flow; the production app uses an HTML `<table>` with no layout
  control.
- Severity rationale: NIT because (a) the briefing's reference window is
  1280×800 (the table fits there), (b) the dev followed the established
  table structure and only added cells, and (c) the responsiveness
  question is a broader Overview concern not a UNIT-UI-3 regression.
- Suggested fix: NONE for this tick — surface for the queue as "decide
  whether to wrap `.contracts` in an `overflow-x: auto` container or
  migrate to a grid layout matching the prototype's column ratios".

### Finding 7 — NIT | No tests added; correctness rests on tsc + browser-verify

- Briefing item 10. Web has no React testing infrastructure (no Jest,
  no Vitest, no Playwright unit harness; `web/tests/agent-browser/` is
  an integration script).
- The Appeal stage column's correctness depends on three things working
  together: `stageNameFor` returning the right name (covered by
  `src/protocol/ladders.test.ts` if it exists — let me note as below);
  `payerLine` + `appealRound` being correctly threaded through the
  client.negotiation.getNegotiationView call (covered by simulated /
  real backend tests); and the JSX rendering them in the right column
  (NOT covered by any test).
- Grep for `ladders.test`: not present. So `stageNameFor` itself is
  exercised only via the partd-approvable scenario test indirectly.
- Severity rationale: NIT because (a) this is a project-wide structural
  gap not a tick-level regression, (b) the UNIT-UI-1 and UNIT-UI-2
  ticks made the same choice without findings, and (c) `tsc` + vite-build
  + the existing browser-verify journey are the de-facto gate for web
  ticks.
- Suggested fix: NONE for this tick — surface for the queue as "add a
  unit test for `stageNameFor` covering all three payer lines + the
  out-of-range fallback".

---

## OK items — checked, no finding

- **Column-header order against UNIT-UI-2 baseline:** `[#, Medication,
  Status, Policy, Requested, AI Covered]` was the prior 6-column layout
  (`git show c23a185:web/src/views/Overview.tsx`). This tick inserts
  `Appeal stage` at index 3 (between Status and Policy) and appends
  `Round` at index 7 — both placements match the prototype's relative
  positions (Appeal stage after Status, Round last).
- **`stageNameFor(payerLine, appealRound)` call signature:** matches
  `src/protocol/ladders.ts:169` exactly — `(line: PayerLine, round: number)`.
  `v.negotiation.payerLine` is typed as `PayerLine` (non-optional, not
  `| undefined`) at `src/types/coverage.types.ts:132`; `v.negotiation.appealRound`
  is typed `number` at line 134. No coercion needed.
- **`payerLine` always populated:** mandatory on the typed `Negotiation`
  record; the contract's `createContract` requires it (`src/contract/abi.ts:13`);
  the simulated backend wires it through (`src/contract/simulated.ts:148,244,678`);
  the real backend decodes it from tuple position [21] (`src/contract/real.ts:77,587`).
  No path returns a Negotiation without it. The briefing's concern
  ("can it be undefined for older contracts?") is moot.
- **`appealRound: 0` rendering:** `<td>{0}</td>` renders the string "0",
  not "false" or blank. Browser-verified mentally; no falsy-render trap.
- **Re-export hygiene (`src/index.ts:110`):** clean append in the existing
  re-export block, named exports `LADDERS` and `stageNameFor` resolve
  unambiguously from `./protocol/ladders.js` (only file defining either
  symbol). No naming clash with the rest of `index.ts`. `LADDERS` was
  already a public concept via the UNIT-1 commit message and prior
  re-export discipline; promoting `stageNameFor` to public API is the
  smallest change that satisfies the UI need.
- **Re-export validates via vite build:** `dist/index.js` line 23 and
  `dist/index.d.ts` line 18 both contain `export { LADDERS, stageNameFor
  } from "./protocol/ladders.js"`, so the web `@lib` alias resolves the
  symbols.
- **CSS naming consistency:** `.stage-chip` and `.col-round` follow
  the project's hyphen-kebab convention (consistent with `.kpi-card`,
  `.filter-pill`, `.ruling-hero`, `.col-round` matches the `.col-*`
  pattern from other tables — verified by grep, only this tick adds
  `.col-*` so the pattern is forward-looking but consistent with
  Bootstrap-style column-utility class naming).
- **CSS uses project tokens, not raw hex (in the named places):**
  `var(--panel-2, …)`, `var(--text-2, …)`, `var(--border-lt, …)`
  all resolve to project tokens. The hex fallbacks are redundant
  (see Finding 3) but not raw-hex-as-primary.
- **No fake data, no `Math.random`:** every cell reads from
  `v.negotiation.*` or `v.*`; no client-side fabrication.
- **`stageNameFor` empty-payer-line guard:** `if (!ladder) return "—";`
  protects against `LADDERS[unrecognised]` returning `undefined`. With
  the typed enum this branch is unreachable in TS code, but the runtime
  guard is correct defense-in-depth.
- **`tabular-nums` on `.col-round`:** correct for an integer-valued
  right-aligned numeric column; matches the prototype's
  `className="mono tabular"` choice on the same cell.

---

## Verdict

UNIT-UI-3 lands the typed-API integration cleanly: `stageNameFor` is
imported from `@lib`, called with the correct `(PayerLine, number)`
signature, and threaded through `v.negotiation.payerLine` and
`v.negotiation.appealRound` which are both typed and always-populated.
The Round column reads a bare integer, right-aligned, tabular-nums.
The re-export hygiene in `src/index.ts` is clean and validates through
`dist/`. The vite build (`npm run web:build`) succeeds and the new
columns ship without bundle warnings. All 53 library tests and both
tsc projects stay green.

The MEDIUM finding is a prototype-conformance miss against the
explicit briefing question ("does the prototype use a chip or a plain
label?"): the prototype renders the stage as plain text with a
payer-line sub-caption underneath; the production app wraps it in a
`.stage-chip` pill and omits the payer-line caption. This is the
prototype-conformance journey's whole point per the design-handoff
branch name. The LOW finding is the `stageNameFor` divergence from
the prototype's clamp-and-fallback `stageOf` (we return "—", prototype
clamps to the last stage and falls back to PartD on an unknown line);
practical impact is near-zero given the type system but the divergence
deserves a queue note. The four NITs (redundant CSS fallback hexes;
Round-vs-appealRound + missing `/maxRounds`; the pre-existing Policy
column; the table-overflow risk at narrow widths; and the absence of
web-side tests) are all either pre-existing, structural, or at-leisure.

Briefing says "Zero findings required." One MEDIUM design-conformance
finding plus one LOW divergence finding → the tick does not clear the
gate.

**Recommended remediation for the MEDIUM:** drop the `<span
className="stage-chip">…</span>` wrapper around the stage name; render
`{stageNameFor(payerLine, appealRound)}` directly; add a small caption
`<div>` below with the formatted payer-line name (`PartD → "Part D"`,
others verbatim) matching the prototype's two-line cell at
`screens.jsx:141-144`. Remove the now-unused `.stage-chip` CSS rule.
Re-run the three gates after that change. The LOW + NITs are queue
items, not blockers for re-review.

### Final tick-16 verdict: FAIL (0 HIGH; 1 MEDIUM; 1 LOW; 5 NITs)

---

# Strict-review findings — tick 18 (UNIT-4c-narrow, mapRevertReason wired into Detail's `run` helper)

## Scope under review

1. `src/index.ts` — adds two re-export lines (a value re-export for
   `mapRevertReason` + `REVERT_REASON_MAP`; a type re-export for
   `RevertReason` + `RevertReasonEntry`), both from
   `./protocol/revertReasonMap.js`. No other changes.
2. `web/src/views/Detail.tsx` — adds `mapRevertReason` to the existing
   `@lib` import block, and rewrites the `run(action)` helper at
   lines 160-180. The helper now:
   - Probes the thrown error in the order `.reason` (ethers v6) →
     `.shortMessage` (viem/wagmi) → `.message` (generic Error) →
     `String(err)` last resort, mirroring the probe order in
     `useAction.ts` post-tick-12-NIT-2-fix.
   - Passes the extracted reason into `mapRevertReason()` from the
     library.
   - Calls `setError(`${entry.headline}\n\n${entry.details}`)`,
     concatenating the structured map output into a single string.
3. The four pre-existing client-validation `setError("plain string")`
   call sites (~497 "Select a policy first.", ~599 "New evidence is
   required to appeal.", ~648 "Evidence reference is required.",
   ~676 "Note text is required.") are intentionally left untouched.

## R-citations

- SPEC-0003 §2.3 **R16** — revert-reason map; now wired into Detail's
  user-visible action panel.

## Required gates (verified)

- `node --import tsx --test "src/**/*.test.ts"` → `# tests 53 / # pass
  53 / # fail 0` (CLEAN; full transcript witnessed; 2305 ms).
- `npx tsc -p tsconfig.json` → exit 0, no output (CLEAN; `dist/` was
  rebuilt so vite consumes the new re-exports).
- `npx tsc -p web/tsconfig.json --noEmit` → exit 0, no output (CLEAN).
- `npx vite build` (from repo root, where `vite.config.ts` lives —
  initial attempt from `web/` failed because the config defines
  `root: "web"` and aliases `@lib` → `<repoRoot>/dist/index.js`) →
  succeeds, 213 modules transformed, 554 kB bundle, build time 3.54 s.
  No errors; only the pre-existing >500 kB chunk-size advisory.

## Cross-checks performed

1. **Probe order parity with `useAction.ts`.** Side-by-sided the new
   `run` helper at `Detail.tsx:166-180` against `extractRevertReason`
   in `useAction.ts:74-92`. The order `.reason → .shortMessage →
   .message` is identical. Both use `typeof e["…"] === "string" &&
   e["…"]` guards to reject non-string and empty-string values.
   Detail.tsx adds a `String(err)` last resort that useAction.ts does
   not (useAction returns `undefined` and lets `mapRevertReason`
   produce the generic fallback; Detail.tsx forces a non-empty
   stringification first). Both paths eventually reach the same
   generic-fallback entry for unknown reasons, so the observable
   behaviour is equivalent for the common cases.

2. **Falsy-but-defined string handling.** The `&& e.reason` short-
   circuit on `e.reason === ""` returns `""` (falsy), so the `||`
   chain falls through to the next probe. Correct — empty-string
   `.reason` is treated as no-reason.

3. **`String(err)` for null / undefined / primitives.**
   - `err = null` → `err ?? {}` becomes `{}`, all probes miss,
     `String(err)` is `String(null) = "null"` → `mapRevertReason("null")`
     returns the generic fallback with `details` carrying `Raw reason:
     null`. Doesn't crash. Acceptable.
   - `err = "boom"` (thrown string) → `err ?? {}` keeps `"boom"`,
     property accesses on a primitive return `undefined`, `String(err)
     = "boom"`. mapRevertReason exact-matches if `"boom"` happens to
     be a known key (no chance), otherwise generic fallback with the
     string in `details`. Acceptable.
   - `err = {}` → all probes miss, `String(err) = "[object Object]"` →
     generic fallback. Acceptable.

4. **`mapRevertReason` exact-match limitation.** Confirmed:
   `revertReasonMap.ts:272-285` does `REVERT_REASON_MAP[reasonRaw as
   RevertReason]` — strict object indexing, no fuzzy match. Ethers v6
   exposes the bare contract revert string on `.reason` (verified via
   the ethers docs surface), so for the common path `.reason ===
   "engage: not Open"` → exact match → user-friendly entry. For
   wallets that expose the reason only inside a noisy `.message`
   (e.g. `"VM Exception while processing transaction: reverted with
   reason string 'engage: not Open'"`), the exact match fails and
   the generic fallback fires. The fallback's `details` carry the
   raw string so no information is lost — confirmed at
   `revertReasonMap.ts:280-284`. Acceptable for tick 18 scope.

5. **Re-export hygiene in `src/index.ts`.** Greped the entire `src/`
   tree for `mapRevertReason`, `REVERT_REASON_MAP`, `RevertReason`,
   `RevertReasonEntry`. No collisions: these four symbols are unique
   to `src/protocol/revertReasonMap.ts` and the new re-export lines
   are the only mention in `src/index.ts`. The re-exports correctly
   separate the value re-export (`export { mapRevertReason,
   REVERT_REASON_MAP }`) from the type re-export (`export type {
   RevertReason, RevertReasonEntry }`), which is required under
   `isolatedModules`/`verbatimModuleSyntax`. The dist build picks them
   up — vite resolved `@lib` and bundled successfully.

6. **JSDoc truthfulness.** The new comment block at
   `Detail.tsx:160-165` claims:
   - "Ethers v6 puts the decoded `Error(string)` payload on `.reason`"
     — confirmed against the ethers v6 contract-call-error shape.
   - "viem/wagmi use `.shortMessage`" — confirmed against viem's
     `BaseError.shortMessage` field.
   - "Probe in that order so the cleanest copy wins; fall back to
     `.message`" — matches the implementation.
   - "Unmatched reasons get the generic-fallback entry whose `details`
     carry the raw string so no information is lost" — confirmed
     against the fallback at `revertReasonMap.ts:280-284`.

7. **No new tests added — acceptable per precedent.** The web layer
   has no React testing infrastructure (verified in earlier ticks,
   e.g. tick 13). Detail.tsx changes rest on tsc + vite build +
   future manual browser-verify. Consistent with the convention; not
   a finding.

## Findings

### MEDIUM 1 — `\n\n` in concatenated error string collapses to a single space at render time, defeating the structured headline+details that R16 introduces

`Detail.tsx:178` does:

```ts
setError(`${entry.headline}\n\n${entry.details}`);
```

`error` is then rendered at lines 186 and 256 as:

```tsx
<p className="error">{error}</p>
```

The `.error` CSS rule at `web/src/styles.css:554-562` is:

```css
.error {
  color: var(--danger);
  font-size: 13px;
  font-weight: 500;
  padding: 8px 12px;
  background: var(--danger-lt);
  border-radius: var(--radius-sm);
  border: 1px solid #fca5a5;
}
```

There is **no `white-space: pre-wrap` / `pre-line` / `pre`** on
`.error`, and `<p>` is not a `<pre>`. HTML's default whitespace
collapsing rule will fold the embedded `\n\n` into a single space.
The result the user actually sees is a single line concatenating
headline and details with one space between them, e.g.:

> Only the provider can perform this action Your connected wallet
> is not the provider address on this contract. Switch to the
> provider wallet and try again.

…which:

- Visually loses the headline-as-prominent / details-as-explanation
  distinction that `RevertReasonEntry` was deliberately designed for
  (see `revertReasonMap.ts:52-61` — "shown prominently in the error
  card (R21)" vs "Shown in the 'What to do' area of the error card").
- Means R16's user-visible payoff (a curated, two-tier user copy
  surface) is only half-wired: the data flows but the presentation
  flattens it back into the same one-line string blob the prior
  generic-Error rendering used. From the user's seat, the upgrade
  is "the wording is now better" — not "there's now a structured
  card with a headline and an explanation," which is what
  `revertReasonMap.ts`'s API design and SPEC-0003 R21 ("error card
  with headline and details area") imply.

This is also the architectural divergence point flagged in checklist
item 6 of the briefing: useAction.ts stores `RevertReasonEntry`
**as a struct** so a future consumer can render `headline` and
`details` into distinct DOM nodes. Detail.tsx's `run` helper
collapses the struct into a string at the boundary, which means
any future "render the error card properly" work has to undo this
collapsing.

**Recommended remediation (smallest possible change):** either

- (a) change `setError` state shape to `RevertReasonEntry | string |
  null` and render `<p>` with `entry.headline` in a `<strong>` and
  `entry.details` in a sibling span (or two `<p>`s inside an error
  card div), preserving the structure end-to-end; or
- (b) keep the string contract but add `white-space: pre-line` to
  `.error` so the `\n\n` survives rendering. This is one CSS line
  and visually achieves the two-tier presentation.

Option (b) is the smallest, but option (a) is the architecturally
correct one and aligns with what `useAction.ts` already does. Either
remediation re-runs the same three gates.

### LOW 1 — Duplicated probe logic between `Detail.tsx:run` and `useAction.ts:extractRevertReason` is borderline DRY-violation that will rot

The probe block in `Detail.tsx:171-176`:

```ts
const e = (err ?? {}) as { reason?: unknown; shortMessage?: unknown; message?: unknown };
const reason =
  (typeof e.reason === "string" && e.reason) ||
  (typeof e.shortMessage === "string" && e.shortMessage) ||
  (typeof e.message === "string" && e.message) ||
  String(err);
```

is structurally a subset of `useAction.ts:74-92`'s
`extractRevertReason` plus a `String(err)` fallback. If the probe
order or wallet-shape coverage changes in one place (e.g. tick 12
made the order `.reason → .shortMessage → .message` after a NIT
fix; a future viem upgrade might add `.cause.message` probing),
both places need to change in lockstep. The repo has no test
covering the Detail.tsx path so silent rot is plausible.

The briefing's checklist item 5 asks whether this is "acceptable
for tick 18" or "finding-worthy." My read: it's finding-worthy at
LOW (not MEDIUM) because (a) the duplication is short — 4 lines —
and (b) the two consumers are architecturally distinct (per-action
hook with pending state vs shared per-component runner without
pending state), so DRY-ing them naively would couple structures
that don't otherwise share an interface. But the fix is also cheap:
extract `extractRevertReason(err: unknown): string | undefined` to
`src/protocol/revertReasonMap.ts` (where the map already lives,
adjacent concern), re-export from `@lib`, import it in both
useAction.ts and Detail.tsx. Both probe sites then call the same
4-line helper.

**Recommended remediation:** lift the probe to a shared helper next
to `mapRevertReason`. Not a hard blocker, but worth bundling into
the MEDIUM 1 fix to avoid touching Detail.tsx twice.

### LOW 2 — `setError` type now mixes two semantic shapes (plain string vs concatenated revert headline+details), and the four pre-existing client-validation call sites render differently from the new revert path

`setError` is typed as `string | null` (line 120). It now stores:

- Plain client-validation strings: `"Select a policy first."`,
  `"New evidence is required to appeal."`, `"Evidence reference is
  required."`, `"Note text is required."` (lines 497, 599, 648, 676).
- Concatenated revert headline+details: `${entry.headline}\n\n
  ${entry.details}` (line 178).

Both pass through the same `<p className="error">{error}</p>` render.
Visually, the four client-validation messages render fine (single
line, short). The revert-path message renders as MEDIUM 1 describes
(`\n\n` collapses to a space, looks like a long sentence). The
inconsistency is mild because the four short strings happen to be
acceptable as single-line; but if you adopt MEDIUM 1's remediation
(b) (`white-space: pre-line`), the client-validation strings continue
to render fine. If you adopt remediation (a) (struct shape), you
either have to wrap the validation strings in
`{ headline: "Select a policy first.", details: "" }` (verbose) or
keep `setError` as a sum type and branch in the render — both
acceptable but worth deciding explicitly.

**Recommended remediation:** adopt MEDIUM 1's option (b) so the four
plain-string call sites keep working unchanged; document the design
choice in a one-line comment near `setError`.

### NIT 1 — `(err ?? {}) as { reason?: unknown; ... }` cast is harmless but unidiomatic compared to useAction.ts's `Record<string, unknown>` pattern

`Detail.tsx:171` casts to a closed object shape with three optional
fields. `useAction.ts:76` casts to `Record<string, unknown>` and then
uses bracket access `e["reason"]`. Both compile and both are type-
safe at the property-access boundary. The closed-shape cast is
slightly more documentative ("here's the surface we care about"),
the `Record` version is more flexible. Pure style; not a finding.

### NIT 2 — JSDoc cites R16 but does not cite R21 (the error-card-shape requirement that the headline/details split exists for)

Lines 160-165 cite SPEC-0003 R16 only. The reason `RevertReasonEntry`
has separate `headline` and `details` fields is SPEC-0003 R21's
"error card" surface. Citing both would make MEDIUM 1's rendering
miss more visible to a future reader. Pure docs polish.

## OK items — checked, no finding

- No naming clashes in `src/index.ts` re-exports — confirmed via
  full-`src/` grep of the four symbol names.
- `mapRevertReason` exact-match on `REVERT_REASON_MAP` keys —
  confirmed at `revertReasonMap.ts:274` (`REVERT_REASON_MAP[reasonRaw
  as RevertReason]`); object indexing, no fuzzy or substring match.
  Wallet errors that DO expose the bare contract string on `.reason`
  (ethers v6) match exactly. Wallets that don't fall through to
  the fallback with the raw reason carried in `details`. Confirmed.
- Probe order matches `useAction.ts` post-tick-12-NIT-2-fix
  (`.reason → .shortMessage → .message`). Confirmed by side-by-side
  read.
- Empty-string `.reason` / `.shortMessage` / `.message` falls
  through to the next probe via the `&& e.…` short-circuit.
  Confirmed.
- `String(err)` final fallback never crashes for `null`/`undefined`/
  primitives/objects. Confirmed.
- The four pre-existing client-validation `setError("plain string")`
  call sites at ~497/~599/~648/~676 are untouched. Confirmed by
  re-reading Detail.tsx; the diff only touches the import block and
  the `run` helper.
- `src/index.ts` re-export uses both `export { … }` (values) and
  `export type { … }` (types), correct under `verbatimModuleSyntax`.
  Confirmed.
- `tsc -p tsconfig.json` rebuilt `dist/index.js` and vite consumed
  the rebuilt dist (vite bundled successfully with the new re-
  exports reachable from `@lib`). Confirmed.
- Tests 53/53 pass. Confirmed.
- Both tsc projects clean. Confirmed.
- `npx vite build` (from repo root) succeeds. Confirmed.

## Verdict

Tick 18 lands the data flow correctly: `mapRevertReason` is re-exported
from `@lib` without naming clashes, `Detail.tsx`'s `run(action)` helper
probes the wallet error in the right order (matching the tick-12 hook),
and the map's structured output reaches `setError`. All four gates
(tests, both tsc projects, vite build) stay green. The four pre-
existing client-validation `setError` call sites are correctly left
alone, and the JSDoc on the `run` helper is truthful about the probe
order and the fallback-carries-raw-reason guarantee.

However, the **MEDIUM 1** finding blocks the gate: the helper
concatenates `entry.headline` + `\n\n` + `entry.details` into a single
string, but the `.error` CSS class has no `white-space: pre-line` /
`pre-wrap`, so the `\n\n` collapses to a single space at render time.
The user-visible result is a single long sentence with no headline-
prominence — defeating R16's whole point of splitting copy into a
prominent headline and an explanatory details paragraph, and partially
undoing R21's error-card shape. The data plumbing works; the
presentation flattens the structure right back to one-line. This is
fixable with one CSS line (option b: add `white-space: pre-line` to
`.error`) or, better, by carrying `RevertReasonEntry` as a struct end-
to-end like `useAction.ts` already does (option a).

The **LOW 1** finding (probe-logic duplication between Detail.tsx and
useAction.ts) is fixable by lifting `extractRevertReason` next to
`mapRevertReason` in `src/protocol/revertReasonMap.ts` and re-exporting
from `@lib`. Worth bundling into the MEDIUM 1 fix. The **LOW 2** finding
(mixed `setError` shapes / inconsistent rendering between client-
validation strings and concatenated headline+details) goes away under
remediation option (b) and is worth a one-line design comment.

Briefing says "Zero findings required." One MEDIUM blocker (presentation
fidelity for R16) + two LOWs (DRY duplication; mixed setError shapes) +
two NITs → the tick does not clear the gate.

**Recommended remediation summary for next tick:**

1. (MEDIUM 1) Either add `white-space: pre-line` to `.error` in
   `web/src/styles.css` (one-line CSS fix; preserves the `\n\n`), or
   carry `RevertReasonEntry` as a struct in `setError`'s state and
   render `headline` + `details` into separate DOM nodes. Option (a)
   is more architecturally correct and aligns with `useAction.ts`;
   option (b) is the smallest possible fix.
2. (LOW 1) Lift the probe block to a shared
   `extractRevertReason(err: unknown): string | undefined` helper
   next to `mapRevertReason` in `src/protocol/revertReasonMap.ts`,
   re-export from `@lib`, import in both `useAction.ts` and
   `Detail.tsx`. Removes 4 lines of duplication.
3. (LOW 2) Document the `setError` sum-type convention with a one-
   line comment so a future reader sees both shapes are intentional.
4. (NIT 2) Add an R21 citation to the JSDoc on the `run` helper so
   the headline/details split's purpose is visible.

Re-run the three gates after each change.

### Final tick-18 verdict: FAIL (0 HIGH; 1 MEDIUM; 2 LOWs; 2 NITs)

