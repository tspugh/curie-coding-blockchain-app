# Strict review findings — SPEC-0007 clause-typed PolicyClause + Attestation + worked-example policies

**Unit:** Extend `PolicyClause` with SPEC-0007 clause-typing fields (`type` / `check`) and add
the `Attestation` interface; add the plaque-psoriasis (§3.6) and bupropion×ADHD (§3.7) example
policies to `POLICY_LIBRARY`; update `policies.test.ts` to pin the new structural requirements
(R1: every clause carries `type`; R2: public clauses carry `check.kind` + `check.sourceUrl`;
R5: `Attestation` shape; R10/R12: the two worked-example policies exist with correct clauses
and source-URL constants).

**Date:** 2026-06-07
**Branch:** `spec/0007-clause-impl` vs `origin/main` (slice of `origin/main…HEAD`).
**Reviewer stance:** TOTAL-STICKLER. Scope = the unit's slice of the diff, read against
SPEC-0007 (§2 R1/R2/R5/R10/R12, §3.1 types, §3.5–§3.7 worked examples) and the whole-codebase
context (single `src/data/policies.ts`, `src/index.ts` re-exports).

**Result: ONE finding (LOW). Gate FAIL.**

## Files reviewed (unit scope)

- `src/data/policies.ts` — new `ClauseType` / `PublicCheckKind` types; `PolicyClause.type`
  (required) + `PolicyClause.check?`; new `Attestation` interface; `OPENFDA_HUMIRA_URL` /
  `OPENFDA_WELLBUTRIN_URL` constants; `type`/`check` retrofitted onto the four pre-existing
  policies; two new policies (`commercial-pa-adalimumab-plaque-psoriasis` §3.6,
  `commercial-pa-bupropion-adhd` §3.7).
- `src/data/policies.test.ts` — 11 new tests (R1 ×2, R2 ×1, R5 ×2, R10 ×4, R12 ×2).
- `src/index.ts:124` — re-exports `PolicyClause` (consumer surface present).

## Verification performed (what holds)

1. **All 25 tests pass; `tsc --noEmit` exit 0.** Ran `node --import tsx --test
   src/data/policies.test.ts` (25/25) and `npx tsc -p tsconfig.json --noEmit` (clean).

2. **In-scope tests are correctness-pinning, not presence-only — mutation-verified.**
   - Rename `commercial-pa-adalimumab-plaque-psoriasis` → the R10 "policy exists" test fails
     (it pins the exact id via `POLICY_LIBRARY.some(p => p.id === …)` — the prior tick's F1
     "asserts `commercial.length >= 1`" weakness is fixed).
   - Repoint the ADHD indication `sourceUrl` to `OPENFDA_HUMIRA_URL` → R12 sourceUrl test
     fails (pins the exact `OPENFDA_WELLBUTRIN_URL` constant, per §3.7).
   - Flip PP-COM-02 `kind: "dosing"` → `"indication"` → R10 "≥2 public incl. one dosing"
     test fails (pins the §3.6 dosing clause, not mere public-clause count).
   - Set a clause `type` to a non-member string → the R1 type-set test fails.

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

### F1 (LOW · weak test / in-file comment over-claims) — the `check`-presence biconditional is only half-pinned; an attested clause may silently carry a `check`

`src/data/policies.ts:14` (file doc) and `:55-64` mirror SPEC-0007 §3.1 / R2 in stating the
clause invariant as a **biconditional**:

```
 *   - `check?` — present iff type === "public": { kind, param, sourceUrl }.
```

The test suite pins only the **forward** half (public ⟹ has `check`,
`src/data/policies.test.ts:210`). The **reverse** half (attested ⟹ no `check`) is undefended:
`check?` is declared optional on *every* `PolicyClause` regardless of `type`, so an attested
clause carrying a stray `check` object is structurally legal to both TypeScript and the tests.

Mutation-proven: adding
`check: { kind: "indication", param: "x", sourceUrl: "https://x.test" }` to the attested clause
`PP-COM-03` leaves **all 25 tests green and `tsc --noEmit` exit 0** — no test or type catches
the violation. The file's own "present **iff**" comment (and spec R2's "iff") therefore make a
stronger claim than the suite enforces; a future edit can break the invariant the comment
asserts without any signal.

Fix (pick one):
- Add a test asserting `c.check == null` for every `type === "attested"` clause (mirror of the
  existing R2 public-clause loop), closing the biconditional the comment already promises; **or**
- If only the forward direction is intended to be enforced, soften the doc comment at `:14`
  from "present iff type === public" to "present when type === public" so the comment no longer
  over-claims relative to the tests.

## Disposition

The data layer and the four in-scope, unit-named test groups (R1/R2/R5/R10/R12) are correct,
PHI-free, faithful to SPEC-0007 §3.1/§3.6/§3.7, and mutation-verified as correctness-pinning —
no correctness, drift, dead-code, DRY, or over-engineering finding there, and the prior tick's
F1 (loose R10 existence test) is resolved. The single remaining finding is a half-enforced
invariant: the in-file/spec "present **iff** type === public" biconditional is only pinned in
the public→check direction, and the attested→no-check direction is silently violable (proven).
Because the gate requires ZERO findings: **FAIL**. Resolving F1 (add the reverse-direction test,
or downgrade the comment's "iff" to "when") clears the gate.
