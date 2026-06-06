# Strict gatekeeper review — SPEC-0008 WalletOnboarding (R1–R10)

**Date:** 2026-06-06 · **Branch:** `spec/0008-wallet-onboarding` vs `origin/main`
(working tree, includes uncommitted changes). **Reviewer stance:** TOTAL-STICKLER.
Scope = the unit's slice of the `origin/main…HEAD` diff plus the uncommitted working-tree
changes, read against SPEC-0008 R1–R10 and whole-codebase context.

**Result: FAIL.** Findings below (zero required).

Files reviewed: `web/src/components/WalletOnboarding.tsx`, `web/src/App.tsx`,
`web/src/walletKeys.ts`, `web/src/client.ts`, `web/src/styles.css`, `.env.example`,
`web/src/walletOnboarding.test.ts`, `web/src/walletOnboarding.dom.test.ts`,
`contracts/hardhat.config.ts`, `package.json`, and the `docs/progress/*` notes.

Prior-iteration note: the previous review's F3 (deriveAddress unused), F4 (phantom DOM
test file), and F7 (keyOverride env validation) are now **resolved** — the modal routes
through `deriveAddress`, the `.dom.test.ts` file exists, and `keyOverride` validates the
env branch with `isValidHexKey`. The findings below are what remains / regressed.

All 42 SPEC-0008 tests pass; `npm run typecheck` is clean. The findings are about what the
tests do **not** prove, and about R6 spec drift introduced while fixing the prior security
finding.

---

## F1 (BLOCKER) — R6 "pre-filled from env" is no longer wired into the app; the force-prompt modal renders empty

SPEC-0008 R6 (MUST) and T4: `VITE_FORCE_WALLET_PROMPT=1` must show the modal
**"pre-filled/validated from the env values"** so the operator can test the flow against
known-good keys.

The prior iteration read the env keys at module level in `App.tsx` and passed them as
`prefillProvider`/`prefillInsurer`. To satisfy the F8-1 bundle-security test, the current
working tree **deleted** that wiring (`git diff web/src/App.tsx`): `envProviderKey` /
`envInsurerKey` are gone, and `<WalletOnboarding onLoaded={handleWalletLoaded} />` is now
rendered with **no prefill props**. The component defaults `prefillProvider=""` /
`prefillInsurer=""`, so when `forcePrompt` is on the modal appears **empty**, not pre-filled.

R6 is therefore unimplemented in the shipped app. The `prefillProvider`/`prefillInsurer`
props still exist on the component and are exercised only by the DOM tests that pass them
directly — i.e. the tests prove the component *can* prefill, against a code path the app
never invokes (see F2). This is genuine spec drift: a MUST requirement was silently dropped
while fixing a different finding, with no spec amendment recording the R6↔§6 conflict.

The underlying issue is that SPEC-0008 is internally contradictory — R6 ("pre-fill from
env") cannot coexist with §6 ("no key value in the bundle") because Vite statically inlines
`import.meta.env.VITE_*`. That conflict must be resolved in the spec (amend R6, e.g. derive
prefill from the already-persisted localStorage key, or drop env-prefill and reframe R6),
and the implementation + tests aligned to whichever resolution is chosen. As shipped, the
spec says one thing and the code does another.

## F2 (BLOCKER) — DOM tests are render-only snapshots; the spec's core behaviours (paste/validate reactivity, Load → persist, insurer-skip-write) are never exercised

`web/src/walletOnboarding.dom.test.ts` renders the component with `react-dom/server`
`renderToString` and asserts substrings of the static HTML. There is **no** interaction
simulation anywhere — verified: zero `dispatchEvent` / `fireEvent` / `act(` / `.click()` /
`onChange` invocations in either test file. Consequences:

- **R3 reactivity ("as the user types/pastes, validate … derive … show error")** is not
  tested. The tests pass a `prefill` prop and inspect the *initial* render; the `onChange`
  handler (`handleChange`, which `.trim()`s and re-validates) and the live transition from
  invalid→valid are never run. Coverage confirms it: `WalletOnboarding.tsx` reports
  **funcs 57.14%** with uncovered lines `63-70` (`handleChange` / the `show` toggle) and
  `103`.
- **R7 persistence (`handleLoad` → `localStorage.setItem` → `onLoaded`)** — the central
  deliverable that makes the gate clear and signing work — is never invoked. `handleLoad`
  is among the uncovered functions. No test asserts `curie:VITE_PRIVATE_KEY` is written, nor
  that `onLoaded` fires.
- **R4 core mechanism** — the `if (insurerKey !== "") setItem(…_INSURER…)` branch that makes
  "empty insurer ⇒ don't write the insurer slot" true — is never executed. The tests that
  claim R4 (T3 / DOM-T3) assert either the pure helper's tautology or the presence of the
  "(optional)" label; neither runs the skip-write branch. The behaviour SPEC-0008 §3 names
  as the insurer-default mechanism is asserted nowhere.
- The `show`/`Hide` mask-toggle (R2) button click is never tested.

These are exactly the R10 scenarios ("paste valid key → validates + derives", "invalid key
→ blocked + error", "insurer-empty → defaults to provider") — they are simulated by passing
props, not by driving the component, so they assert *presence* (the rendered output for a
given prop) rather than *correctness* of the reactive/persist logic the requirements
describe. An integration-level test (jsdom render + real events, or the agent-browser
scenario named as a §4 deliverable) is required.

## F3 (HIGH) — `docs/progress/coverage.md` presents the modal as well-covered while its load/persist path is untested

`coverage.md` (refresh 23) reports `WalletOnboarding.tsx | 96.09%` line coverage and an
aggregate "97.64% PASS", labelling the unit "OVERALL PASS / DONE". The 96% line figure is an
artifact of `renderToString` walking the render path; the same row shows **funcs 57.14%**,
i.e. nearly half the component's functions (the `handleLoad` persist path, the toggle, the
change handler) are unexecuted. Leading the table with the favourable line % while the
function % exposes that the load/persist/reactive logic is untested is a misleading progress
claim — a reader concludes the modal flow is verified when only its static render is. Either
state the function-coverage caveat explicitly or add the behavioural tests (F2).

## F4 (HIGH) — The "agent-browser scenario for the modal flow" deliverable (§4) was not delivered

SPEC-0008 §4 lists, as a deliverable, an "agent-browser scenario for the modal flow". The
`web/tests/agent-browser/` tree contains no wallet-onboarding scenario (no reference to
`wallet-onboarding`, `modal-backdrop`, or `VITE_FORCE_WALLET_PROMPT`). The end-to-end flow
the spec calls for — load the page with no key, see the blocking modal, paste, derive, load,
land in the app — is verified by nothing. Combined with F2, there is **no** test that
drives the modal through a single real user action.

## F5 (MEDIUM) — Lying comments: App.tsx and .env.example claim env-prefill that the code does not do

After the F1 deletion, two comments now describe behaviour that no longer exists:

- `App.tsx` (the JSX comment above `<WalletOnboarding>`): "Pre-fill values come from
  localStorage (already populated by client.ts keyOverride)…". No prefill prop is passed at
  all — the modal receives nothing and defaults to `""`. The comment describes a wiring that
  was removed.
- `.env.example` `VITE_FORCE_WALLET_PROMPT` block: "the modal is pre-filled from the env keys
  so you can test the onboarding flow without clearing localStorage." The modal is **not**
  pre-filled (F1). This actively misleads the operator the env var exists to serve.

Comments must match the code: either restore a (security-safe) prefill and make them true, or
update both to state the modal opens empty under force-prompt.

## F6 (MEDIUM) — Dead `setNeedsWallet(false)` before `window.location.reload()`

`App.tsx` `handleWalletLoaded` still calls `setNeedsWallet(false)` then
`window.location.reload()`. A React state update queued before a synchronous full-page
reload never paints — navigation discards the pending render. The line is a no-op; the
comment ("Clear the gate state first so the component unmounts before reload") describes an
unmount that does not happen before navigation. This is the prior review's F6 carried
forward unfixed. Drop the line + comment, or drop the reload and re-derive state in place.

## F7 (MEDIUM) — `web/dist-nokey/` build artifact is untracked and NOT gitignored

A build output directory `web/dist-nokey/` (index.html + `assets/index-*.js`) sits in the
working tree, untracked, and `git check-ignore web/dist-nokey` returns nothing — so a
`git add -A` would commit it. Build artifacts must not be committed. (Confirmed the bundle
itself contains **no** baked private key — the only `0x…64` hex strings are ethers'
secp256k1 curve constants, and `VITE_PRIVATE_KEY` appears only as the localStorage-prefix
string literal, so §6 holds for the build — but the artifact still must not enter git.) Add
`dist-nokey/` to `.gitignore` or delete it.

## F8 (MEDIUM) — `contracts/hardhat.config.ts` mocha-timeout change is out of scope for a pure-web spec

The diff adds `mocha: { timeout: 120_000 }` to the contracts config. SPEC-0008 is a pure
web-UI change (no contract, no redeploy); a solidity-coverage timeout bump is unrelated to
R1–R10 and was smuggled onto this branch (the prior review's F9, still present). It belongs
on its own change so the wallet-onboarding diff stays scoped to its spec.

## F9 (LOW) — Weak / tautological / duplicate assertions inflate the test count

- `walletOnboarding.test.ts` T3 "deriveAddress is deterministic" asserts
  `deriveAddress(K) === deriveAddress(K)` — a tautology; the real R4 logic (insurer-empty ⇒
  skip the insurer slot) is the untested `handleLoad` branch (F2).
- `T4`/`T5` repeat the identical `hasUsableProviderKey({storageOverride:null,
  envKey:PROVIDER_KEY}) === true` assertion; `T2`/`T4` repeat the same `/^0x…{40}$/` address
  shape on the same key.
- Both files' "NO-PHI" tests scan four constant hex fixtures for SSN/email patterns — with
  fixed literals they can never fail and cover no requirement.
- DOM-T1's disabled check `html.includes('disabled=""') || html.includes("disabled")` is
  near-unfalsifiable: the `|| includes("disabled")` clause matches any occurrence of the
  substring anywhere in the markup (e.g. an aria attribute), so it does not actually prove
  the Load button is disabled.

These pad the "21 + 21 tests" headline cited in `coverage.md` without testing component
behaviour. Presence ≠ correctness.

## F10 (LOW) — R8 (active-wallet verification) and R9 (independent reactive insurer derivation) are unaddressed / untested

R8 (SHOULD) asks for post-load verification that each wallet is a usable signer (optionally
surfacing balance) and an "active" reflection in the UI; the modal does none of this — it
writes localStorage and reloads, with no signer/balance check. R9 (MUST) — independent live
derivation for both fields — is implemented (each `KeyField` derives independently) but, like
R3, is never exercised reactively (only via static prefill render). R8 being a SHOULD makes
its omission tolerable if the spec records the deferral; R9's reactive path needs the
event-driven test from F2.

---

## Required to reach ZERO findings

1. Resolve the R6↔§6 contradiction in the spec, then implement + wire whatever prefill source
   is chosen (or formally drop env-prefill); make App.tsx render the force-prompt modal in the
   specified state. (F1)
2. Add behavioural tests that drive the component through real events: invalid→valid typing
   (R3), Load → `localStorage.setItem` assertion + `onLoaded` fired (R7), insurer-empty ⇒
   insurer slot NOT written / insurer-set ⇒ written (R4), mask toggle (R2). jsdom + real
   events or the agent-browser scenario. (F2, F4)
3. Correct `coverage.md` to surface the 57% function coverage / untested load path. (F3)
4. Make App.tsx + `.env.example` comments match the actual (post-F1) behaviour. (F5)
5. Remove the dead `setNeedsWallet(false)` before reload (or remove the reload). (F6)
6. Gitignore or delete `web/dist-nokey/`. (F7)
7. Move the hardhat mocha-timeout change off this branch. (F8)
8. Replace tautological / duplicate / unfalsifiable assertions with R-intent coverage. (F9)
9. Record R8's deferral in the spec (or implement the signer/balance check) and cover R9's
   reactive path. (F10)
