# SPEC-0005: Wallet connection & session model

Status: Stub — fill in before any production-onboarding work · Owner: tspugh · Date: 2026-05-29

> **Scope.** How a real user lands on the app and starts driving a coverage exception
> in **production** (i.e. not the current ephemeral dev wallet stuffed in `.env`).
> Covers the **landing page split** (demo vs production), the **production wallet
> model** (embedded vs browser-extension), **session auth** (SIWE / SSO), and how
> **profiles** relate to wallets and to organisations. Does **not** cover the
> contract-side address verification — that's pinned by SPEC-0001 R11.

## 1. Summary & user story

Today the app boots into the demo flow with a hard-coded `VITE_PRIVATE_KEY` and a
profile picker that lets anyone role-play Provider, Insurer, or Observer. That's fine
for a demo. It's a non-starter for a live deployment:

- A real provider PA-team member doesn't have MetaMask. Asking them to install one to
  file a coverage exception is hostile to the audience.
- The role isn't picked by the user — it's *provisioned by their organisation* (a
  Provider org's user is *only* a Provider on this app).
- A single wallet shared across roles defeats the on-chain auth model (SPEC-0001 R11).

This spec pins how production onboarding works without losing the demo path.

> As an **operations user from a provider or payer organisation**, I want to sign into
> the app with my **work account** (Google / corporate SSO), see only the role my org
> assigned me, and never touch a private key — while still getting an addressable
> on-chain identity. As a **viewer of the demo**, I want a clearly separate
> **"Try the demo"** entry that doesn't require auth and won't quietly sign anything
> meaningful from my real wallet.

## 2. Decisions (to be filled in)

### 2.1 Landing-page split — demo vs production

- (TBD) Single landing page with two CTAs: **"Sign in with my org"** (production) and
  **"Try the demo"** (current ephemeral flow). Visually distinct so a user can't sleep-
  walk from one into the other. The demo path explicitly labels every screen as
  *Demo — synthetic data only* per SPEC-0004 §2.1.

### 2.2 Production wallet model — embedded, not browser-extension

- (TBD) Default to an **embedded wallet** provided by a custody-managed service
  (candidates: Privy, Web3Auth, Magic). Key custody is split between the user's auth
  provider (SSO) and the embedded-wallet service so neither party alone can sign.
- (TBD — alternative path) **Allow** MetaMask / WalletConnect for crypto-native users
  who already have one and want to bring it. This is a *"bring your own wallet"*
  option, not the default.

### 2.3 Session auth — SIWE on top of SSO

- (TBD) **Sign-In With Ethereum** (EIP-4361) layered over the embedded-wallet sign-in.
  After SSO → embedded-wallet creation, the wallet signs a SIWE challenge to prove
  ownership of the address; the dApp gets a session token. Aligns with SPEC-0001 R11
  on-chain `msg.sender` checks without requiring a tx for every navigation.

### 2.4 Profiles vs wallets vs organisations

- (TBD) Profile in production is **"role within an organisation"** — provisioned by
  the org admin during onboarding, not picked by the user. A Provider org's user
  cannot flip to Insurer or Observer in the chrome dropdown; the dropdown is removed
  in production builds (or restricted to the user's actually-assigned profiles, e.g.
  someone in both a payer and a provider org).
- (TBD) Wallet = one per user-org pair. If a user belongs to two orgs, they get two
  addresses; switching org switches wallet, and the SIWE session re-issues.
- (TBD) Organisation registration / KYB (Know-Your-Business) is out of scope here —
  treated as a configuration step performed by Curie ops before an org's users can
  sign in. Captured as a known dependency, not specced.

### 2.5 Demo-path posture (carry-over from today)

- (TBD) Demo continues to use a **shared ephemeral dev wallet** + a profile picker.
  Calls out: "this wallet is shared by everyone using the demo right now" so the
  semantics aren't confusing. Profile picker stays. No SIWE; no SSO.

## 3. Open questions

- **Q1.** Which embedded-wallet provider? Privy is the closest match to the audience
  (SSO-first, white-labellable, EVM-native); Web3Auth has stronger key-sharding
  guarantees; Magic is the lowest-friction onboarding but most opinionated. Pick
  before any production work begins.
- **Q2.** SSO providers for v0 production: Google + Microsoft 365 covers ≈90% of
  provider PA and payer UM operations; corporate SAML adds long-tail coverage at
  significant integration cost.
- **Q3.** How does the contract verify org membership? Today SPEC-0001 R11 checks
  `msg.sender == providerAddr | insurerAddr`. If the wallet is per-(user, org), the
  contract has no direct view of org. Two options: (a) anchor org → address in a
  small on-chain registry; (b) keep org assignment off-chain and trust SIWE / org
  admin provisioning. (a) is auditable, (b) is cheaper.
- **Q4.** Demo wallet hardening. The dev wallet's PK in `.env` is OK for our box but
  unsafe for any public demo deploy. Even the demo path needs a refresh model
  (one-shot session wallet, faucet-funded, expired on idle) before we put a public
  URL behind the demo CTA.
- **Q5.** Does the demo path also need its own **landing-page-level safety rail**
  warning that real wallets won't be touched? (Mitigates the "I clicked Try Demo and
  it tried to talk to my MetaMask" surprise.)

## 4. Out of scope

- Patient-side wallets / portals. The patient is `Patient Status` per VISION.md — a
  read-only status view, not a signer.
- KYB / org onboarding mechanics (a Curie-ops process, not a product feature here).
- Treasury / multisig for the contract's escrow address (separate concern).
- Mobile / native wallets — desktop browser only for v0 production.
- Smart-account / ERC-4337 mechanics. Embedded wallets via Privy/Web3Auth may use
  smart accounts internally; we don't pin that here.

## 5. Pass / fail criteria (placeholder)

To be defined when the decisions in §2 land. Minimum expected acceptance: a real user
arriving at the landing page can pick demo or sign-in, can complete sign-in without
installing a browser extension, ends up with an addressable on-chain identity that
SPEC-0001 R11 checks accept, and never sees a private key in any UI.

## 6. Notes

- Prioritised below [SPEC-0004 (data + evidence model)](0004-data-and-evidence-model.md)
  per the 2026-05-29 conversation — SPEC-0004 is functional, SPEC-0005 is functional
  foundation, SPEC-0003 is presentational polish. SPEC-0005 and SPEC-0004 may ship
  together if convenient.
