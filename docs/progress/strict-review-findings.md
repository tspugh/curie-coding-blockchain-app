# Strict review findings — SPEC-0007 clause-typed PolicyClause + Attestation + worked-example policies

**Unit:** Extend `PolicyClause` with SPEC-0007 clause-typing fields (`type` / `check`) and add
the `Attestation` interface; add the plaque-psoriasis (§3.6) and bupropion×ADHD (§3.7) example
policies to `POLICY_LIBRARY`; update `policies.test.ts` to pin the new structural requirements
(R1: every clause carries `type`; R2: public clauses carry `check.kind` + `check.sourceUrl`;
R5: `Attestation` shape; R10/R12: the two worked-example policies exist with correct clauses
and source-URL constants).

**Date:** 2026-06-07 (FAIL tick) / 2026-06-07 (PASS re-run at HEAD 66b8273)
**Branch:** `spec/0007-clause-impl` vs `origin/main` (slice of `origin/main…HEAD`).
**Reviewer stance:** TOTAL-STICKLER. Scope = the unit's slice of the diff, read against
SPEC-0007 (§2 R1/R2/R5/R10/R12, §3.1 types, §3.5–§3.7 worked examples) and the whole-codebase
context (single `src/data/policies.ts`, `src/index.ts` re-exports).

**Result: ZERO findings. Gate PASS.** (HEAD 66b8273 — F1 resolved by adding the reverse-biconditional test.)

## Files reviewed (unit scope)

- `src/data/policies.ts` — new `ClauseType` / `PublicCheckKind` types; `PolicyClause.type`
  (required) + `PolicyClause.check?`; new `Attestation` interface; `OPENFDA_HUMIRA_URL` /
  `OPENFDA_WELLBUTRIN_URL` constants; `type`/`check` retrofitted onto the four pre-existing
  policies; two new policies (`commercial-pa-adalimumab-plaque-psoriasis` §3.6,
  `commercial-pa-bupropion-adhd` §3.7).
- `src/data/policies.test.ts` — 12 new tests (R1 ×2, R2 ×2 [forward + reverse], R5 ×2,
  R10 ×4, R12 ×2); 26 total pass.
- `src/index.ts:124` — re-exports `PolicyClause` (consumer surface present).

## Verification performed (what holds)

1. **All 26 tests pass; `tsc --noEmit` exit 0.** Ran `node --import tsx --test
   src/data/policies.test.ts` (26/26) and `npx tsc -p tsconfig.json --noEmit` (clean) at
   HEAD 66b8273.

2. **In-scope tests are correctness-pinning, not presence-only — mutation-verified.**
   - Rename `commercial-pa-adalimumab-plaque-psoriasis` → the R10 "policy exists" test fails
     (it pins the exact id via `POLICY_LIBRARY.some(p => p.id === …)` — the prior tick's F1
     "asserts `commercial.length >= 1`" weakness is fixed).
   - Repoint the ADHD indication `sourceUrl` to `OPENFDA_HUMIRA_URL` → R12 sourceUrl test
     fails (pins the exact `OPENFDA_WELLBUTRIN_URL` constant, per §3.7).
   - Flip PP-COM-02 `kind: "dosing"` → `"indication"` → R10 "≥2 public incl. one dosing"
     test fails (pins the §3.6 dosing clause, not mere public-clause count).
   - Set a clause `type` to a non-member string → the R1 type-set test fails.
   - **F1 mutation (reverse-biconditional):** adding
     `check: { kind: "indication", param: "x", sourceUrl: "https://x.test" }` to the attested
     clause `PP-COM-03` now causes the R2 reverse-direction test
     (`"SPEC-0007 R2: no attested clause carries a check object (iff invariant)"`,
     `policies.test.ts:239`) to FAIL — confirming the invariant is fully closed.

3. **Spec-faithful data, PHI-free.** §3.6 policy = 2 public (indication+dosing) + 2 attested
   (step-therapy + TB), source `OPENFDA_HUMIRA_URL` — matches §3.6. §3.7 policy = indication
   (deny-on-FDA), dosing, 1 attested, source `OPENFDA_WELLBUTRIN_URL` — matches §3.7. No
   patient identifiers; the R5 evidenceUrl test uses a synthetic `.test` URL; the existing
   NO-PHI regex tests still pass over the enlarged library.

4. **No dead code / no premature abstraction.** `PolicyClause` is re-exported and already
   consumed; `ClauseType`/`PublicCheckKind`/`Attestation` are SPEC-0007 §3.1 + §4 deliverables
   for the not-yet-built A0011/A0012 contract+decide consumers (in-scope scaffolding the spec
   mandates, not bloat). `OPENFDA_HUMIRA_URL` is DRY'd across 4 clauses; the single-use ENBREL
   / TRULICITY URLs are correctly left inline (no premature constant). The `as ClauseType` /
   `as PublicCheckKind` casts are load-bearing (string-literal widening under untyped
   `Object.freeze`), consistent with the pre-existing `voids: true` style.

5. **Comment correction, not a lie.** The test-file header path was corrected from
   `web/src/data/policies.ts` to `src/data/policies.ts`; there is exactly one `policies.ts`
   (no duplicate to DRY).

## Findings

**(None at HEAD 66b8273. See below for the resolved F1 record.)**

### F1 (LOW · RESOLVED at HEAD 66b8273) — the `check`-presence biconditional was only half-pinned; an attested clause could silently carry a `check`

**Status: RESOLVED** — commit 66b8273 (`test(spec-0007): F1 — pin the reverse half of the
check-presence iff invariant`) added the missing reverse-direction assertion to
`src/data/policies.test.ts`.

**Original finding:** `src/data/policies.ts:14` (file doc) and `:55-64` mirror SPEC-0007 §3.1 / R2
in stating the clause invariant as a **biconditional**:

```
 *   - `check?` — present iff type === "public": { kind, param, sourceUrl }.
```

The test suite pinned only the **forward** half (public ⟹ has `check`,
`src/data/policies.test.ts:210`). The **reverse** half (attested ⟹ no `check`) was undefended:
`check?` is declared optional on *every* `PolicyClause` regardless of `type`, so an attested
clause carrying a stray `check` object was structurally legal to both TypeScript and the tests.

**Fix applied:** Added the following test at `src/data/policies.test.ts:239` (HEAD 66b8273):

```ts
// SPEC-0007 R2 (reverse half) — the `check` presence is a BICONDITIONAL: a
// `check` object appears *iff* the clause is public. Pin the reverse direction
// (attested clause => NO check) so the "present iff type === public" invariant in
// policies.ts:14 is fully defended (forward half above; F1 strict-review fix).
test("SPEC-0007 R2: no attested clause carries a check object (iff invariant)", () => {
  for (const p of POLICY_LIBRARY) {
    for (const c of p.clauses) {
      if (c.type !== "attested") continue;
      assert.ok(
        c.check == null,
        `${p.id}/${c.id}: attested clause must NOT carry a check object`,
      );
    }
  }
});
```

**Mutation proof:** Adding `check: { kind: "indication", param: "x", sourceUrl: "https://x.test" }`
to attested clause `PP-COM-03` now causes test 18 to FAIL with:
`PP-COM-03: attested clause must NOT carry a check object` — the reverse-biconditional invariant
is closed.

## Disposition

PASS. The data layer and all in-scope test groups (R1/R2 forward+reverse, R5, R10, R12) are
correct, PHI-free, faithful to SPEC-0007 §3.1/§3.6/§3.7, and mutation-verified as
correctness-pinning. The previously open F1 (attested→no-check direction undefended) is
resolved at HEAD 66b8273 by the reverse-direction assertion. Zero findings remain. **Gate: PASS.**
