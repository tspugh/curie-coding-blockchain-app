# SPEC-0008: Wallet onboarding modal (startup bring-your-own-key gate)

Status: Draft · Owner: Curie team · Date: 2026-06-06

## 1. Summary & user story

The publicly-hosted build ships **no signing key** (it must not — see SPEC re: static
deploy). So on a fresh visit there is no provider/insurer wallet, and the app can only
read. This spec adds a **startup modal** that, when no usable wallet is loaded, prompts
the user to load a **provider** and **insurer** wallet (paste key → real-time validation →
derived address), gates the app behind it, and stores the keys via the existing
localStorage mechanism (never in the bundle).

> As a user of the hosted app with no wallet configured, I want a startup modal to load
> provider + insurer wallets with live validation, so I can act on-chain — and as the
> operator, I want to *force* that modal even when env keys exist, so I can test it.

This extends the existing key-paste/derive (SPEC-0005 R11, `Settings.tsx`,
`walletKeys.ts`) into a **blocking startup gate** with dual wallets and a test hook.

## 2. Requirements

- **R1 (MUST) Startup gate.** On load, if **no usable provider key** is available (neither
  a localStorage `curie:VITE_PRIVATE_KEY` nor an env-provided key), show a **modal dialog**
  rendered above a **backdrop overlay that dims/greys the rest of the app** and blocks
  interaction until resolved.
- **R2 (MUST) Provider + insurer fields.** The modal collects a **provider** wallet and an
  **insurer** wallet. Each is a secret key input; the key is **masked** (password dots)
  with an optional show toggle. The **address is derived and displayed** from the key.
- **R3 (MUST) Real-time validation (reactive).** As the user types/pastes, validate the key
  is a proper secp256k1 key (`isValidHexKey`), derive + show its address live, and show a
  clear inline error on invalid input. The "Load wallets" action enables **only** when the
  provider key is valid (and the insurer key is valid or empty).
- **R4 (MUST) Insurer defaults to provider.** The insurer field may be left empty or
  explicitly set to "same as provider"; when empty, the insurer wallet **is** the provider
  wallet (mirrors `client.ts`: `insurer = VITE_PRIVATE_KEY_INSURER ?? VITE_PRIVATE_KEY`).
- **R5 (MUST) Env-provided wallets load + skip the modal.** When env keys
  (`VITE_PRIVATE_KEY` [+ `VITE_PRIVATE_KEY_INSURER`]) are present, they load normally and
  the modal does **not** appear (unless forced, R6).
- **R6 (MUST) Force-prompt env var for testing.** `VITE_FORCE_WALLET_PROMPT=1` forces the
  modal to appear **even when env keys exist**, **pre-filled/validated from the env values**,
  so the onboarding flow is testable against known-good keys. Default (unset) = off.
- **R7 (MUST) Persist via localStorage, never the bundle.** Loaded keys are written to
  `curie:VITE_PRIVATE_KEY` / `curie:VITE_PRIVATE_KEY_INSURER` (existing `keyOverride` path),
  so they persist across reloads and drive signing — with **no key in the deployed bundle**.
- **R8 (SHOULD) Active-wallet verification.** After load, verify each wallet is usable
  (valid signer; optionally surface its live balance) and reflect "active" state in the UI.
- **R9 (MUST) Reactive for both wallets.** Provider and insurer validation/derivation update
  independently and live; switching profiles after load uses the right signer.
- **R10 (MUST) Tests.** Cover: no-wallet → modal blocks; paste valid key → validates +
  derives address; invalid key → blocked + error; insurer-empty → defaults to provider;
  `VITE_FORCE_WALLET_PROMPT=1` → modal appears pre-filled from env and loading the env
  wallets works; env-present (unforced) → no modal.

## 3. Technical documentation

- **Component:** `web/src/components/WalletOnboarding.tsx` — a modal (card) + backdrop
  overlay (`.modal-backdrop` / `.modal-card`, new in `styles.css`). Rendered by `App.tsx`
  when the gate condition holds.
- **Gate condition:** `needsWallet = !hasUsableProviderKey() || forcePrompt`, where
  `hasUsableProviderKey` checks localStorage then env (reuses `keyOverride`); `forcePrompt =
  import.meta.env.VITE_FORCE_WALLET_PROMPT === "1"`.
- **Validation/derivation:** reuse `isValidHexKey` (`walletKeys.ts`) + `new ethers.Wallet(key).address`
  for the live derived address (mirrors `Settings.tsx`).
- **Persist + apply:** write `KEY_STORAGE_PREFIX + "VITE_PRIVATE_KEY"` (and `…_INSURER` when
  given); then re-init/refresh the clients so signing uses the new keys without a manual
  reload (the Settings flow already round-trips this — factor the shared bits into
  `walletKeys.ts` so the modal and Settings don't diverge).
- **Insurer default:** empty insurer ⇒ do not write the insurer slot ⇒ `client.ts` already
  falls back to the provider key.
- **Env var:** `VITE_FORCE_WALLET_PROMPT` (Vite-exposed); documented in `.env.example`.
- **No new deps**; ethers already present.

## 4. Deliverables

- `WalletOnboarding.tsx` modal component + `.modal-backdrop`/`.modal-card` styles.
- Gate wiring in `App.tsx`; shared load/validate/derive helpers in `walletKeys.ts`.
- `VITE_FORCE_WALLET_PROMPT` env var + `.env.example` entry.
- Tests (unit for the gate/validation helpers; agent-browser scenario for the modal flow).

## 5. Test cases

- **T1 (R1)** Fresh load, no env key, empty localStorage → modal + backdrop block the app.
- **T2 (R3)** Paste a valid key → derived address shown; "Load" enables. Paste garbage →
  error; "Load" disabled.
- **T3 (R4)** Provider valid, insurer empty → load succeeds; active insurer signer == provider.
- **T4 (R6)** `VITE_FORCE_WALLET_PROMPT=1` with env keys present → modal appears pre-filled
  from env; loading proceeds against the env wallets.
- **T5 (R5)** Env keys present, force off → no modal; app is interactive immediately.
- **T6 (R7)** After load + reload, wallets persist (localStorage) and the bundle contains no key.

## 6. Pass / fail criteria

**PASS — all must hold:**
- [ ] No usable provider key (and not forced-off) ⇒ a blocking modal over a dimming backdrop (R1).
- [ ] Provider + insurer key inputs are masked; address derives live; validation is reactive (R2/R3/R9).
- [ ] Empty insurer ⇒ defaults to provider (R4).
- [ ] Env keys present ⇒ no modal unless `VITE_FORCE_WALLET_PROMPT=1`, which forces it pre-filled (R5/R6).
- [ ] Keys persist via localStorage; deployed bundle contains no key value (R7).
- [ ] Tests T1–T6 pass.

**FAIL — any triggers rejection:**
- A private-key **value** is baked into the built bundle.
- The modal can be dismissed/bypassed with no usable wallet when not forced-off.
- Invalid key loads (no validation) or the derived address is wrong.

## 7. Out of scope

- **Injected-wallet (MetaMask/WalletConnect) signing** — this spec is paste-a-testnet-key
  bring-your-own; a true injected provider is a later spec.
- Funding/faucet flows; multi-account management beyond provider + insurer.
- Encrypting the localStorage key (it's a testnet key; documented as such).

## 8. Open questions

- **OQ1 (LOW)** Should the modal offer a "read-only / skip" choice (browse without a wallet)
  vs. hard-block? Default here is hard-block when not forced-off; a "continue read-only"
  button is a possible softening.
- **OQ2 (LOW)** Surface live balances in the modal (R8) on load, or defer to the header
  wallet chip that already polls balance?
