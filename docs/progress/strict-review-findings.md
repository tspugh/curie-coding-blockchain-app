## Amendment 0007 — phase-tracker fields (`agentPhase`/`pendingDecideFee`/`pendingFeePayer`) off-chain sync (TOTAL-STICKLER, gate FAIL)

**Date:** 2026-06-04 (re-review of the fixed unit)
**Branch:** `spec-6-implementation` vs `origin/main`. Unit commits `48f68a9` (fields) +
`9b3095a` (test-seam + direct positional test).
**Reviewer:** Claude Opus 4.8 (strict-review gate, TOTAL-STICKLER) — independent
re-derivation from source over the current diff (`.` vs `origin/main`), scoped to the unit
that adds the three Amendment-0007 phase-tracker fields to the off-chain `Negotiation`
interface and both decoder paths.

**Unit under review:**
- `src/types/coverage.types.ts` — `Negotiation` gains `agentPhase: number`,
  `pendingDecideFee: bigint`, `pendingFeePayer: string` (lines 157-162).
- `src/contract/simulated.ts` — `SimNegotiation` gains the three fields (177-179);
  initialised to `0 / 0n / ethers.ZeroAddress` in `createContract` (354-356); propagated in
  `snapshot()` (956-958).
- `src/contract/real.ts` — `decodeNegotiationRaw` maps `raw[35]/[36]/[37]` (159-161); the
  `RawNegotiation` tuple documents the 38 positions (75-114); `decodeNegotiation` delegates
  to the exported `decodeNegotiationRaw` test-seam (712-713).
- `src/contract/simulated.agentphase.test.ts` — 6 tests.

**What is correct (verified, not taken on faith):**
- **Struct / abi / decode index alignment is exact.** `CoverageNegotiation.sol`
  `struct Negotiation` (122-177) is 38 fields ending `... bool exists; AgentPhase agentPhase;
  uint256 pendingDecideFee; address pendingFeePayer;`. Declaration-order enumeration gives
  (0-based) `exists=34`, `agentPhase=35`, `pendingDecideFee=36`, `pendingFeePayer=37`. The
  `abi.ts` `getNegotiation` tuple (line 28) ends in the same three fields in the same order;
  `real.ts` `RawNegotiation` (75-114) and `decodeNegotiationRaw` (159-161) map exactly those
  positions. `enum AgentPhase { None, Scraping, Deciding }` (CoverageNegotiation.sol:109) ⇒
  `0/1/2`, matching every comment.
- **Type coercion is right.** `agentPhase: Number(raw[35])` coerces the ethers uint8/bigint
  enum to `number`; `pendingDecideFee` typed `bigint`; `pendingFeePayer` typed `string`
  (address) — consistent with the interface and the simulated init values.
- **`snapshot()` and `createContract` are complete.** Both list all 38 fields; the three new
  ones are present and not silently dropped. `tsc --noEmit` is clean (exit 0) — type
  completeness implies no other `Negotiation`/`SimNegotiation` literal in the tree omits them.
- **Test (f) is genuine, not presence-theatre.** `simulated.agentphase.test.ts:195-252`
  builds a synthetic 38-element tuple, sets the off-by-one-sensitive positions to non-default
  sentinels (`raw[35]=1`, `raw[36]=42n`, `raw[37]=INSURER`), calls the production
  `decodeNegotiationRaw`, and asserts each decodes to the right field. This is the
  highest-risk surface of a positional decode and it is correctly pinned. Test (f) also reads
  `n.agentPhase/pendingDecideFee/pendingFeePayer` *directly* (no cast), so the `Negotiation`
  interface declaration is type-pinned by the suite: drop a field and (f) fails to compile.
- **Gate evidence (re-run):** `node --import tsx --test src/contract/simulated.agentphase.test.ts`
  → 6/6 PASS; `node --import tsx --test "src/**/*.test.ts"` → 248/248 PASS; `npm run typecheck`
  → clean.

**Prior findings from the `48f68a9` review — both RESOLVED (re-verified):**
- **F-A0007-1 (weak/lying test (f))** — RESOLVED by `9b3095a`. The old test (f) never called
  the real decoder and only re-asserted simulated snapshot defaults; the current test (f)
  (195-252) constructs the synthetic raw tuple and calls `decodeNegotiationRaw` with non-zero
  sentinels, exactly as the fix demanded. The real-path positional decode is now tested.
- **F-A0007-2 ("37 fields" lying header)** — RESOLVED. `real.ts:71` now reads "38 fields";
  the tuple has entries `[0]`–`[37]` = 38, consistent with the struct and the abi.

**Verdict: FAIL — 1 finding.** The implementation and the real-decoder test are correct; the
remaining defect is in the simulated/default-value tests, whose comments now lie about how the
assertions are wired.

### F-A0007-3 (LYING-COMMENT + WEAK-TEST, must-fix) — tests (a)/(b)/(c) carry stale TDD "WILL FAIL until … added to the interface" comments paired with `as unknown as {…}` casts that sever exactly that linkage

`src/contract/simulated.agentphase.test.ts`. The header (line 9, "These tests MUST FAIL
until: 1. `Negotiation` interface gains … 2. `SimNegotiation` gains …") and three inline
comments — line 68 ("This assertion WILL FAIL until **agentPhase is added to the Negotiation
interface** and SimNegotiation is initialised with `agentPhase: 0`"), line 89 (same for
`pendingDecideFee`), line 110 (same for `pendingFeePayer`) — are red-phase TDD prose that is
now **false**: the fields are on the interface, `SimNegotiation` is initialised, and all
three assertions PASS. The comments describe a failure condition that no longer obtains.

Worse, the assertions they annotate read the value through `(n as unknown as { agentPhase:
number }).agentPhase` (lines 71, 92, 113). `as unknown as {…}` **discards** the `Negotiation`
type, so the very linkage the comment claims drives the failure ("WILL FAIL until added to
the interface") is severed: if `agentPhase` were removed from `Negotiation`, these three
assertions would still compile and (because `snapshot()` still emits the runtime key) still
pass. The comment asserts an interface-coupling the cast deliberately breaks — a comment that
lies about the code beneath it, on a unit whose entire charter is interface↔struct sync.

The casts are also unnecessary: the fields are on `Negotiation` (proven by test (f)'s
cast-free `n.agentPhase` access compiling under a clean `tsc --noEmit`), so plain
`n.agentPhase` / `n.pendingDecideFee` / `n.pendingFeePayer` typechecks. Using the cast instead
makes (a)/(b)/(c)/(d)/(e) **weaker** than (f): they no longer fail to compile if a field is
dropped from the interface, defeating the structural guard the unit is supposed to provide.

Fix: drop the `as unknown as {…}` casts in (a)/(b)/(c)/(d)/(e) and read the fields directly
(restoring the compile-time interface guard), and delete the stale "WILL FAIL until … added
to the interface" / "MUST FAIL until" red-phase comments (the tests are green and merged; the
preamble no longer describes the code). With direct access the three default-value assertions
keep their runtime value and regain the type-level pin that test (f) already demonstrates is
available.

---

## SPEC-0006 R21 — `runLivenessDebounce` extraction clears F4' (TOTAL-STICKLER, gate PASS)

**Date:** 2026-06-04
**Branch:** `feat/livenessDebounce-extraction` vs `origin/main`.
**Reviewer:** Claude Opus 4.8 (strict-review gate, TOTAL-STICKLER) — independent
re-derivation from source over the *current* diff (`.` vs `origin/main`), focused on the
unit that clears the sole remaining strict-review FAIL finding **F4'**.

**Unit under review:** extraction of `Create.tsx`'s `useEffect` debounce + stale-response
guard into a pure, injectable helper, plus its unit tests and the `Create.tsx` rewire:

- **new** `web/src/livenessDebounce.ts` — `runLivenessDebounce(url, isReal, onResult, options?)`:
  a `setTimeout` + boolean-`cancelled`-flag helper. No React import (verified). Its only
  effect is calling the injected `onResult` once the injected `probe` resolves, gated by the
  `cancelled` flag set in the returned cleanup. Empty/whitespace `url` short-circuits to a
  no-op cleanup (no timer, no probe, no `onResult`). Defaults to `probeUrlLiveness` +
  `PROBE_DEBOUNCE_MS = 600`.
- **new** `web/src/livenessDebounce.test.ts` — 9 behavioral tests (see below).
- **edit** `web/src/views/Create.tsx:74-84` — the `useEffect` now delegates to
  `runLivenessDebounce(agentEvidenceUrl, IS_REAL, setUrlLivenessResult)`; the inline
  `setTimeout`/`cancelled`/`timerId` block, the local `PROBE_DEBOUNCE_MS`, the direct
  `probeUrlLiveness` import, and the unused `useRef` import are gone (`grep` confirms none
  of these tokens remain in `Create.tsx`).

**Verdict: PASS — zero findings.**

### F4' — RESOLVED (the mandated extraction-and-test is exactly what landed)

F4' asked for the debounce + stale-response cancellation to be factored into a pure,
injectable helper and unit-tested, rather than left as the one untested limb behind a
hand-rewritten replica. That is precisely what `runLivenessDebounce` + its test deliver.
The three F4'-named behaviors each have a *real, executing* test that asserts correctness,
not presence:

- **Debounce fires** (`livenessDebounce.test.ts:74-97`) — asserts `onResult` is NOT called
  before `PROBE_DEBOUNCE_MS` elapses and IS called exactly once after, with the correct
  result payload. Pins the timing contract, not just "a call happened".
- **Stale-response cancellation** (`:103-136`) — uses a *hanging* probe: fires the debounce
  so the probe is genuinely in-flight, calls `cleanup()`, *then* resolves the probe, and
  asserts the result is discarded. This reaches the real `if (!cancelled)` branch
  (`livenessDebounce.ts:79`) — the exact branch F4' said had zero coverage. Not a
  same-URL replica trick; a true latest-wins cancellation.
- **Empty-URL short-circuit** (`:142-175`) — asserts an empty `url` schedules no timer,
  calls neither `probe` nor `onResult` even after `PROBE_DEBOUNCE_MS + 100` ms.

Plus four reinforcing tests (whitespace-only treated as empty; early `cleanup()` cancels
the timer so `probe` is never called; sim mode passes `sim=true` to the probe; the
`PROBE_DEBOUNCE_MS === 600` pin) and two invariants (the module has no `from "react"`
import; a NO-PHI fixture regression). The probe is *injected*, not mocked-where-integration-
is-required: the helper is genuinely pure (timer + flag), so injection is the correct seam,
and the production default remains the real `probeUrlLiveness`.

### Anti-pattern sweep — nothing to flag

- **Over-engineering / dead params.** The `isReal` arg is not dead: it is wired to the
  probe's real `sim` argument (`probe(trimmed, !isReal)`, `:78`), keeping the helper
  faithful to the `probeUrlLiveness(url, sim)` contract; hard-coding `sim=false` would be a
  worse, less-honest seam. `Create.tsx`'s separate sim-mode early-return is documented in
  the helper's own contract (`:13-15, 44-49`) as caller-enforced — comment matches code.
- **Dead exports.** `ProbeFunction` / `LivenessDebounceOptions` are exported to type the
  injection seam (the `options.probe` param and options bag) — the entire point of the
  testable helper; both are referenced inside the module. Not dead.
- **Weak tests.** None — every assertion checks a behavior/value, not mere presence; the
  stale-guard test exercises the previously-uncovered cancellation branch.
- **Lying / restating comments.** Comments are accurate (verified line-by-line). The
  `Create.tsx` useEffect comment correctly says the debounce/guard is delegated to the
  helper; the helper's docstring correctly scopes what it does and does NOT enforce.
- **DRY / copy-paste.** Clean separation: timer+guard here, gate decision in
  `livenessGate.ts`, probe + cache in `urlLiveness.ts`, server fetch in `probeHandler.ts`.
  No duplication; no premature abstraction.
- **Spec drift.** `PROBE_DEBOUNCE_MS = 600` is consistent across helper, test pin, and the
  `Create.tsx` "Fires 600 ms" comment. R21's UI-gate intent is preserved.

### Gate evidence (re-run this pass)

- `node --import tsx --test web/src/livenessDebounce.test.ts` → **9/9 PASS**.
- `node --import tsx --test "web/src/**/*.test.ts"` → **89/89 PASS** (no regression).
- `npx tsc -p tsconfig.json --noEmit` → clean (exit 0).
- `grep` confirms `Create.tsx` retains no `useRef`, no local `PROBE_DEBOUNCE_MS`, no direct
  `probeUrlLiveness`/`setTimeout`/`cancelled`/`timerId`; the F1/F2/F3 leftovers
  (`runLivenessEffect`, `mock.timers`, `seedLivenessCacheEntry`) are absent repo-wide.

**Strict gate for SPEC-0006 R21: FAIL → PASS.** All of F1, F2, F3, F4, F4' are resolved.

---

## SPEC-0006 R21 — pre-submit evidence-URL liveness check (`urlLiveness.ts` + `probeHandler.ts` + `livenessGate.ts` + `__probe` proxy + `Create.tsx`) (TOTAL-STICKLER, gate FAIL)

**Date:** 2026-06-04
**Branch:** `spec-6-implementation` vs `origin/main`.
**Unit under review:** SPEC-0006 R21 — `probeUrlLiveness(url, sim)` helper
(`web/src/urlLiveness.ts`), the server-side `executeProbe` fetch logic
(`web/src/probeHandler.ts`), the `GET /__probe` Vite dev-server middleware
(`vite.config.ts` `urlProbePlugin`), the pure submit-gate / banner-visibility logic
(`web/src/livenessGate.ts`), and the debounced `useEffect` + `urlLivenessResult` state +
`url-liveness-error` banner + submit-gate in `web/src/views/Create.tsx`. Unit tests:
`web/src/urlLiveness.test.ts`, `web/src/probeHandler.test.ts`,
`web/src/livenessGate.test.ts`, `web/src/views/Create.liveness.test.ts`.
**Files reviewed (full):** all of the above plus
`docs/specs/0006-somnia-agent-platform-integration.md` (R21 L223-230, §3.9 L872-900,
T19-T21 L1101-1106, checklist L1177) and the `tsconfig.json` compiler flags.
**Gate evidence:** `npx tsc --noEmit` PASS; `node --import tsx --test
web/src/urlLiveness.test.ts web/src/probeHandler.test.ts web/src/livenessGate.test.ts
web/src/views/Create.liveness.test.ts` → **55/55 PASS**.

**Verdict: FAIL — 4 findings (1 lying comment, 1 dead test scaffold, 1 unused import,
1 test-only production back-door export) + 1 R-intent coverage gap. 1 note (HEAD-drop,
conforms to R21 — not a finding).**

### Prior iteration's findings — all RESOLVED (re-verified against current code)

- Prior **F1** (comment claiming a non-existent client-side AbortController): the false
  clause is **gone**. `Create.tsx:73-78` now states only "The 600 ms debounce cancels the
  timer; stale in-flight responses are discarded via the `cancelled` flag." `grep -n
  "Abort\|signal" web/src/urlLiveness.ts` → no match. **Resolved.**
- Prior **F2** (banner-interpolation tests asserting on a locally rebuilt copy of the
  string): a real exported `formatLivenessError` now lives in `urlLiveness.ts:73-80` and
  is the single source of the banner text; `Create.tsx:417` renders
  `formatLivenessError(urlLivenessResult!)`; the tests
  (`urlLiveness.test.ts:381-428`) call the **production** function directly, so they fail
  if it is deleted or the spec string drifts. **Resolved.**
- Prior **F3** (dead inline `as { ok:false; … }` cast in the banner): the banner is now a
  bare `formatLivenessError(...)` call; inside the helper the `error`/`status` reads
  happen after the `if (result.ok) return ""` narrowing (`urlLiveness.ts:74-79`), with no
  cast. **Resolved.**
- Prior **F4** (gate behavior had no executing test): the gate decision was extracted into
  pure `isSubmitBlockedByLiveness` / `shouldShowLivenessBanner` (`livenessGate.ts`) and is
  now exercised by `livenessGate.test.ts` (real assertions over every isReal × result
  combination). The *decision* logic is covered. The residual gap (the `useEffect`
  orchestration itself) is reduced to F4' below.

### F1 (HIGH — comment that lies about the code) — header claims `mock.timers` / a "simulated clock" the file never uses

`Create.liveness.test.ts:11-13` states the file "uses Node's built-in **`mock.timers`** to
advance a **simulated clock**, invokes the same `probeUrlLiveness` …". It does neither.
`mock` is imported (`L31: import { test, mock } from "node:test";`) but never referenced
again — `grep -n "mock\." web/src/views/Create.liveness.test.ts` → no match — and there is
no `mock.timers.enable`/`tick` anywhere. Every test instead schedules a **real**
`setTimeout(…, 600)` (e.g. L126, L187, L210) and awaits it, so each test genuinely sleeps
~600 ms of wall-clock time. A reader is told the debounce is being advanced on a fake clock
(fast, deterministic) when it is actually a real timer. Fix: delete the false
`mock.timers`/"simulated clock" clause from the header (and the unused `mock` import), or
actually use `mock.timers` and drop the real sleeps.

### F2 (HIGH — dead test scaffold with a comment that lies about being executed) — `runLivenessEffect` is defined, documented as "run under fake timers", and never called

`Create.liveness.test.ts:70-108` defines a 39-line `async function runLivenessEffect(url,
isReal, probeFetch)` introduced by the comment (L53-68) "a direct, line-by-line
replication of the useEffect logic in Create.tsx so that **we can run it under fake timers
and assert its outcomes** without a React renderer." It is never called by any test
(`grep -n "runLivenessEffect" …` → only the definition). So: (a) it is pure dead code —
it pins nothing and runs nothing; (b) its comment claims it is run under fake timers when
nothing runs it at all; (c) it itself contains a no-op `void timerId; // referenced to
satisfy exactOptionalPropertyTypes` (L99) — `timerId` is the live `setTimeout` handle, not
optional, so the `void` is meaningless cargo-culting. The only reason it survives the build
is that `tsconfig.json` does not set `noUnusedLocals`. Fix: delete `runLivenessEffect`
entirely (the tests below it already cover dead-URL / live-URL / sim / null / network-error
by calling `probeUrlLiveness` + the gate functions directly).

### F3 (LOW — unused import) — `mock` imported, never used

`Create.liveness.test.ts:31` imports `mock` from `node:test`; it is never used (see F1).
Survives only because `noUnusedLocals` is off. Fix: drop `mock` from the import.

### F4 (MEDIUM — test-only back-door widening the production module's public API) — `seedLivenessCacheEntry` is exported from production code for tests only

`urlLiveness.ts:50-56` exports `seedLivenessCacheEntry(url, result, ts)` whose own
docstring says "test back-door … NOT intended for production use; tests only." Its sole
consumer is `urlLiveness.test.ts:128`. A production module should not ship a public mutator
that lets any importer inject arbitrary cache entries (including a forged `ok:true` for a
dead URL) — that is exactly the gate R21 exists to enforce, now bypassable from app code.
The TTL-expiry path it exists to test can be covered without a back-door: inject a clock
(`probeUrlLiveness(url, sim, now = Date.now())`) or seed via a first real probe + a
fake-timer advance. `clearLivenessCache` (L39-41) is a milder case of the same pattern
(test-only, but harmless/idempotent) — acceptable, but note it is also production surface
that exists only for tests. Fix: remove `seedLivenessCacheEntry` from the production export
surface and test TTL expiry via an injected clock.

### F4' (MEDIUM — R-intent coverage gap; the unit's literal test ask is met) — the `useEffect` debounce + stale-response cancellation has no executing test

R21's MUST is a UI gate. The *decision* functions (`livenessGate.ts`) and the *probe*
(`urlLiveness.ts` / `probeHandler.ts`) now each have real behavioral tests. What still has
**zero executing coverage** is the `Create.tsx` `useEffect` orchestration itself
(`Create.tsx:79-110`): the 600 ms debounce, the reset-to-`null`-on-change, and the
`cancelled`-flag stale-response guard. `Create.liveness.test.ts`'s "stale-response" test
(L277-322) explicitly does **not** exercise cancellation — its own comment concedes "We
simulate by running URL-B's probe directly (as if URL-A was cancelled)", i.e. it never
fires two overlapping probes and never reaches the `cancelled` branch. There is no jsdom /
@testing-library in the repo (`grep jsdom|@testing-library package.json` → none), so a
DOM render isn't currently possible; the correct fix mirrors the `livenessGate` extraction:
factor the debounce+stale-guard into a pure, injectable helper (URL in, latest-wins result
out) and unit-test *that*, rather than leaving the orchestration as the one untested limb
behind a hand-rewritten replica. (The unit's *literal* test instruction — cache hit, cache
miss → fetch, sim bypass, non-2xx → ok:false, network error → ok:false — is fully satisfied
in `urlLiveness.test.ts`; this finding is about R-intent, not the literal ask.)

### N1 (NOTE — not a finding) — deliberate HEAD-drop conforms to R21

The unit-task wording and §3.9's sketch describe HEAD-first with a `GET Range: bytes=0-0`
fallback; `executeProbe` (`probeHandler.ts:40-64`) issues a single Range-GET and omits HEAD
entirely. **Not flagged:** R21's normative text (`…0006….md:224-225`) permits "`HEAD` (or
`GET` with `Range: bytes=0-0` fallback)" — the implementation takes the authorized "or"
branch. Server-side there is no CORS (the sole motivation for HEAD-first), the deviation is
documented in `vite.config.ts:118-124` and `probeHandler.ts:8-16`, and Range-GET is
universally supported. The SSRF surface of the proxy (caller-controlled server-side fetch)
is already adjudicated as "documented, not a finding" for this dev-only unit in
`docs/progress/security-findings.md` and is not re-raised here.
