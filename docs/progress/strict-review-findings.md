# Strict gatekeeper review — SPEC-0008 WalletOnboarding (R1–R10)

**Date:** 2026-06-06 · **Branch:** `spec/0008-wallet-onboarding` vs `origin/main`
(working tree). **Reviewer stance:** TOTAL-STICKLER.
Scope = the unit's slice of `origin/main…HEAD` plus uncommitted working-tree changes,
read against SPEC-0008 R1–R10 and whole-codebase context.

**Result: FAIL.** Findings below (zero required).

Files reviewed: `web/src/components/WalletOnboarding.tsx`, `web/src/App.tsx`,
`web/src/walletKeys.ts`, `web/src/client.ts`, `web/src/styles.css`, `.env.example`,
`.gitignore`, `web/src/walletOnboarding.test.ts`, `web/src/walletOnboarding.dom.test.ts`,
`web/src/urlLiveness.test.ts`, `web/src/livenessDebounce.test.ts`,
`web/tests/agent-browser/run.sh`, `docs/specs/README.md`, `package.json`,
and the `docs/progress/*` notes.

**Verified state:** all 50 SPEC-0008 unit+DOM tests pass; `npm run typecheck` clean;
`vite build` succeeds with no key baked into the default bundle. Several findings from the
prior review iteration are now **resolved** and are NOT re-raised: the dead
`setNeedsWallet(false)` before reload is gone (`needsWallet` is now a read-only `useState`
value); `web/dist-nokey/` is gitignored and absent; the `contracts/hardhat.config.ts`
mocha-timeout change is no longer on the branch; the DOM tests now drive real events
(`act()` + `.click()` + `input` dispatch, ~31 interaction primitives) so `handleLoad`,
the insurer-skip-write branch, and reactive validation ARE now exercised; an agent-browser
modal scenario exists. The findings below are what remains live in the current tree.

---

## F1 (BLOCKER) — R6 "pre-filled from env" is not implemented; the force-prompt modal opens EMPTY in the canonical scenario

SPEC-0008 R6 (MUST) and T4: `VITE_FORCE_WALLET_PROMPT=1` must show the modal
**"pre-filled/validated from the env values"** so the operator can test the flow against
the known-good `.env` keys.

`App.tsx` sources the prefill from **localStorage**, not env:

```
const prefillProvider = (() => {
  try { return window.localStorage.getItem(KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY") ?? ""; }
  catch { return ""; }
})();
```

justified by the comment "When forcePrompt=true the user may already have env keys which
`keyOverride()` has written to localStorage on module init." **That is false.**
`keyOverride()` in `client.ts` only `getItem`s — it never `setItem`s. Grep confirms the
only writers of `curie:VITE_PRIVATE_KEY` to localStorage are `WalletOnboarding.handleLoad`
(on a user Load) and `Settings.tsx` (on a user save). Nothing copies env→localStorage at
startup.

So in the exact scenario R6/T4 names — operator has `VITE_PRIVATE_KEY` in `.env`,
fresh browser (empty localStorage), `VITE_FORCE_WALLET_PROMPT=1` — `prefillProvider`
reads `null` → `""` and the modal opens **empty**, not pre-filled. R6 is unsatisfied as
shipped. (The prefill props "work" only when a key is *already* in localStorage, i.e. a
user has already onboarded once — which is not the env-key test path R6 exists to serve.)

The root cause is a genuine R6↔§6 spec contradiction (Vite statically inlines
`import.meta.env.VITE_*`, so reading the env key into a prefill prop would bake the key into
the bundle = §6 hard-FAIL). The implementation resolved the conflict by *silently dropping*
R6's behaviour while keeping the comment + the appearance of wiring, instead of amending the
spec or implementing a security-safe env→prefill bridge (e.g. a non-`VITE_`-prefixed
build-time `define`). A MUST requirement is unmet with no spec amendment recording the
trade-off.

## F2 (HIGH) — No test exercises the real R6 force-prompt path; T4's "tests" assert tautologies and a source-string

Because of F1, R6 is the requirement most needing an end-to-end test, and it has none:

- `walletOnboarding.test.ts` T4 (R6) only asserts `hasUsableProviderKey({envKey:K})===true`
  and `isValidHexKey(K)===true` — facts about helpers, not about the modal pre-filling.
- `walletOnboarding.dom.test.ts` DOM-T4 has two parts: a **source-string** assertion that
  `App.tsx` contains `prefillProvider={...}` (matches the localStorage-reading expression —
  it cannot distinguish a correct env source from the broken localStorage one), and a render
  test that feeds `prefillProvider: PROVIDER_KEY` **directly as a prop**, bypassing App.tsx's
  prefill computation entirely. Neither drives `forcePrompt + env-present + empty-localStorage`.
- `web/tests/agent-browser/run.sh` ships four wallet scenarios — no_modal (R5),
  modal_blocks (R1), validation (R3), load (R7) — and **none** sets
  `VITE_FORCE_WALLET_PROMPT=1`. The §4 deliverable "agent-browser scenario for the modal
  flow" exists for the other requirements but the force-prompt/pre-fill flow (the one whose
  app wiring is broken, F1) is verified by nothing.

This is "assert presence, not correctness": the tests prove the *component can* render a
prefill given a prop, against a prop value the app never actually computes correctly.

## F3 (MEDIUM) — Lying comments: App.tsx and .env.example claim env-prefill the code does not do

Both still mis-describe behaviour:

- `App.tsx` (above the prefill IIFEs): "the user may already have env keys which
  `keyOverride()` has written to localStorage on module init." `keyOverride()` performs no
  write — see F1. The comment asserts a mechanism that does not exist and is the reason the
  prefill source is wrong.
- `.env.example` (`VITE_FORCE_WALLET_PROMPT` block): "the modal is pre-filled from the env
  keys so you can test the onboarding flow without clearing localStorage." Per F1 the modal
  is **not** pre-filled from env in the documented scenario — this actively misleads the
  operator the variable exists to serve.

The existing F5/comment-integrity test (`walletOnboarding.dom.test.ts`) is too weak to catch
this: it only checks that the substring `"Pre-fill"` co-occurs with a `prefillProvider=`
prop — it does not verify the prefill *source* is the env value the comment promises.

## F4 (LOW) — R3/R2 gap: a shape-valid but out-of-range secp256k1 key enables Load yet shows no address (and bricks the app on reload)

`isValidHexKey` validates only the regex shape (`/^0x[0-9a-fA-F]{64}$/`). R3 requires
validating "the key is a **proper secp256k1 key**." A key of `0x00…00` or `0x` + the curve
order `n` passes `HEX_KEY_RE` but is **not** on the curve — verified: `ethers.computeAddress`
throws `Expected valid bigint: 0 < bigint < curve.n` for both.

In the modal this produces a contradictory state and an unguarded failure:
- `canLoad = providerValid && insurerValid` is driven purely by `isValidHexKey`, so the
  **Load button is enabled** for an out-of-range key.
- `safeDerive` catches the throw and returns `null`, so **no derived address is shown** —
  the UI simultaneously shows "no address" and an enabled Load, contradicting R3's coupling
  ("derive + show its address live … 'Load' enables only when the provider key is valid").
- On Load, the bad key is written to localStorage; after `window.location.reload()`,
  `client.ts` `keyOverride()` (which also only checks `isValidHexKey`) accepts it and hands
  it to `makeClient` → in real mode `createClient` constructs an ethers signer from an
  invalid key and throws at module init — bricking the app the gate exists to prevent.

Gate `canLoad` (and `keyOverride`) on successful derivation, not just shape. No test feeds
an out-of-range valid-shape key; add one.

## F5 (LOW) — Out-of-scope additions ride this branch: SPEC-0006 liveness tests + their e2e wiring

`web/src/urlLiveness.test.ts` (+108 lines) and `web/src/livenessDebounce.test.ts` (+67
lines) are net additions in this diff but test **SPEC-0006 R21** sources
(`urlLiveness.ts` / `livenessDebounce.ts`), unrelated to SPEC-0008 R1–R10. They (and the
`coverage.md` "refresh 24" entry crediting them) are scope creep on a wallet-onboarding
branch; they belong on their own change so the SPEC-0008 diff stays scoped to its spec and
the review surface is the unit's slice only. (They pass and are not defective — the finding
is scope, not correctness.)

## F6 (LOW) — `coverage.md` declares SPEC-0008 "complete / fully implemented" while R6 is broken

`docs/progress/coverage.md` headlines "SPEC-0008 R1–R10 … (complete)" and "SPEC-0008 fully
implemented." With R6's app-level force-prompt-from-env path non-functional (F1) and
untested end-to-end (F2), "fully implemented / complete" is an overclaim — a reader
concludes the whole spec is verified when its one genuinely-broken requirement is the one
the coverage numbers don't reach (the 100%-funcs figure comes from DOM tests that feed the
prefill prop directly, never the broken App.tsx computation). State the R6 caveat or fix
F1 before claiming completeness.

---

## Required to reach ZERO findings

1. Resolve R6↔§6 in the spec, then implement a security-safe env→prefill source (e.g. a
   non-`VITE_` build-time `define`, or formally re-scope R6) so the force-prompt modal
   actually opens pre-filled from env in the documented scenario. (F1)
2. Add a test that drives the real path — App.tsx under `VITE_FORCE_WALLET_PROMPT=1` with an
   env key and empty localStorage → modal pre-filled — at the DOM and/or agent-browser
   level. (F2)
3. Fix the App.tsx and `.env.example` comments to match actual behaviour (and strengthen the
   comment-integrity test to check the prefill *source*, not just prop presence). (F3)
4. Gate `canLoad` (and `keyOverride`) on successful derivation, not shape alone; add an
   out-of-range-key test. (F4)
5. Move the SPEC-0006 liveness test additions (and their coverage-doc credit) off this
   branch. (F5)
6. Drop the "complete / fully implemented" claim in `coverage.md` until R6 is fixed. (F6)
