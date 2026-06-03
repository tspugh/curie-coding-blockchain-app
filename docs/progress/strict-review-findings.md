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
