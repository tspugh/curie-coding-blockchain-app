## API and backend

**The contract between the Curie backend and everything that talks to it.**

> The UI is a readable surface over what the backend does.
> If a behaviour isn't here, the UI cannot honestly show it.

This spec defines the wire-level and runtime-level contract for the v0 reference implementation: the chain interface, the off-chain coordination protocols, the long-running agent runtime, and the data models the UI binds to. It is downstream of [`docs/spec/curie.md`](curie.md) (protocol intent) and a peer of [`docs/spec/demo-ui.md`](demo-ui.md) (the surface).

This is a **product API spec**, not a Solidity reference. Concrete contract ABIs, event topics, gas envelopes, IPFS pinning policy, and key-derivation parameters are deferred to the implementation branch and tracked as amendments when they have to graduate back into the spec.

---

### TL;DR

- **Hospital-mediated participation.** Marketplace participants on chain are *organisations*: hospitals (bound to a CMS Certification Number) and staffing orgs (which wrap individual locums). Specialists are not direct chain participants in v0; their hospital signs on their behalf, and their credentials are attested on chain so any participant can verify.
- **The chain holds events; the conversations stay off-chain.** Cases, bids, claims, declines, escrow, completion, consent, rule-version, and intervention-override are chain events. Reasoning, A2A clarifications, and clinical content are encrypted off-chain with hashes anchored on chain.
- **Encrypted pub-sub for notifications.** Event headers are public on chain; payloads are encrypted off-chain; per-event symmetric keys are wrapped per authorised subscriber. A separate notification relay tier fans the headers out to push / SMS / pager without seeing payload content.
- **Long-running agents with local memory.** Each chain-participating org runs at least one agent daemon. The daemon is event-driven (chain events, user prompts, integration hooks). Working memory is local to the daemon and never on chain.
- **Standing rules are static + plain-text + guardrails.** Static fields are deterministic floors. Plain-text rules are encoded by the agent. A moderation layer rejects discriminatory, EMTALA-violating, or anti-ethics rules. Every rule edit is a chain-anchored version event.

---

## Identity model

Curie binds three classes of identity. Their relationship is the spine of the protocol.

### Org identities (chain participants)

The marketplace participants. Each holds an EVM keypair, signs all on-chain actions, and is bound to a primary-source-verified facility identifier.

- **Hospital identity.** Bound to a CMS Certification Number (CCN). The binding is itself an on-chain attestation issued by a CMS-watching oracle (see [Attestations](#attestations)).
- **Staffing org identity.** Bound to an NPI (Type 2 / organisational NPI). Wraps independent specialists who are not employed by a participating hospital.
- **Self-org identity.** A degenerate staffing org with one specialist member. Lets a true independent locum participate without a third-party staffing contract; protocol-equivalent to a regular staffing org.

Org identities do all chain writes: they post cases, submit bids, claim, decline, escrow, mint consent tokens (in v0 as patient proxy), publish rule-version events, and submit intervention overrides.

### Specialist identities (attested, not chain-participating in v0)

Each credentialed clinician has a deterministic identity derived from their NPI. **Specialists do not sign chain transactions in v0.** What lives on chain about them is a bundle of attestations bound to their NPI, refreshed continuously from primary sources:

- `identity` attestation: NPI ↔ public key. Written by a CMS oracle watching NPPES.
- `license` attestation: state license status (active, suspended, revoked) and expiry. Written by a state-board oracle (FSMB-aggregated where possible).
- `capability` attestation: ABMS / AOA board certification, plus hospital privileges where applicable. Written by ABMS / AOA / hospital oracles.

Hospital agents read these attestations when bidding ("the specialist we propose for this case has current ABMS general surgery and current privileges at our facility") and the chain rejects bids that reference stale or revoked attestations.

A specialist's *consent* to be represented by a specific hospital agent is itself an attestation: `representation` attestation, signed by the specialist's keypair (held off-chain in v0; in a UX wrapper that doesn't require the specialist to manage gas), bound to the hospital identity that may bid on their behalf. Removing representation is a single on-chain revocation.

In v1 specialists may opt to participate directly on chain. The v0 model is forward-compatible: the same NPI-bound identity exists; the specialist just gains the ability to sign their own bids when they do.

### Patient identities

In v0, **patients are not chain participants.** The hospital agent acts as their proxy under a documented patient-proxy framework:

- The hospital holds a `patient-proxy` attestation issued by the patient (paper consent at registration; equivalent to existing HIPAA acknowledgement workflows). The attestation is a hash-anchored event on chain; the actual signed paper or e-sign artefact stays in the hospital's records.
- Consent tokens for individual consults are minted by the hospital's agent under the proxy authority, with default scopes from the patient's standing intake form.
- The patient's *view* exists (the patient binding in the UI) but it reads from the hospital's data; it does not write.

In v1, patient self-sovereignty introduces a patient agent that can sign its own consent tokens. The protocol distinguishes proxy-issued tokens from self-issued tokens; both validate, but post-v0 a hospital agent can no longer mint a token a patient has self-issued differently. Hosting options for v1 (Curie consumer app, MyChart partnership, payer app) are product decisions, not protocol decisions.

---

## Attestations

The verification spine. Every primary-source authority Curie trusts (NPPES, FSMB, ABMS, AOA, hospital privileging) becomes an on-chain *attestation oracle* that signs `(subject, claim, expiry, source)` tuples.

### Attestation envelope

```
attestation {
  subject:     bytes32   (e.g., NPI as hash, or facility CCN as hash)
  claim_type:  enum      (identity | license | capability | privilege | representation | patient-proxy | payer)
  claim_data:  bytes     (claim-type-specific; e.g., license state code + status flags)
  issued_at:   uint64    (unix seconds)
  expires_at:  uint64    (unix seconds; 0 means non-expiring; v0 enforces a freshness max)
  source:      bytes32   (oracle identity; e.g., the CMS oracle's chain identity hash)
  source_sig:  bytes     (oracle's signature over the prior fields)
}
```

### Lifecycle

- **Issue.** An oracle observes a primary source (NPPES dump, FSMB API, ABMS feed) and writes an attestation. Issuance is an on-chain event (`AttestationIssued`).
- **Refresh.** Same subject and claim_type; new envelope with updated `claim_data` and `expires_at`. Supersedes prior. Emitted as `AttestationRefreshed`. The prior attestation is marked `⊘` superseded.
- **Revoke.** A primary source revoking a status (license suspension, privilege loss) is reflected by the oracle writing a revocation event (`AttestationRevoked`). The chain considers any reference to a revoked attestation invalid as of the revocation block.
- **Freshness windows.** v0 enforces a default freshness window per claim type (e.g., license: 30 days, capability: 30 days, identity: 90 days). Bids that reference attestations older than the freshness window are rejected at the protocol level.

### Reading

Anyone can read any attestation. They are public; they bind public identifiers (NPI, CCN) to public keys. Attestations carry no PHI.

---

## Chain events

The on-chain protocol surface. Each event is a transaction signed by the issuing org identity. Off-chain content referenced by an event lives in encrypted off-chain storage and is referenced by content-addressed hash plus a pointer (IPFS CID, hospital-internal URI, etc.).

### Case lifecycle

| Event | Issuer | Payload (on chain) | Off-chain reference |
|---|---|---|---|
| `CasePosted` | requesting hospital | case ID, ICD-10, acuity tier, region (coarse), time window, opening bounty, payload hash | encrypted clinical summary at IPFS CID |
| `CaseAmended` | requesting hospital | case ID, amended fields, new payload hash | new encrypted summary |
| `CaseExpired` | requesting hospital or protocol | case ID, reason | — |
| `CaseCancelled` | requesting hospital | case ID, reason | — |

### Bid / claim / decline

| Event | Issuer | Payload (on chain) | Notes |
|---|---|---|---|
| `BidSubmitted` | bidding hospital | case ID, bid amount, proposed-specialist NPI hash, attestation refs (license, capability, privilege, representation), bid expiry | proposed-specialist resolved off-chain via the routing panel; the chain validates attestation freshness and representation |
| `BidWithdrawn` | bidding hospital | case ID, bid ID | superseded glyph on the original |
| `Claim` | requesting hospital | case ID, winning bid ID, escrow tx ref | atomic: also moves the bounty into escrow |
| `Decline` | bidding hospital | case ID, reason code | |
| `RoutingDecision` | bidding hospital | case ID, internal-routing-result hash | optional event recording the internal routing decision (which staff specialist was assigned), with PHI-safe digest only |

### Consent

| Event | Issuer | Payload (on chain) | Off-chain reference |
|---|---|---|---|
| `ConsentTokenIssued` | hospital (v0 proxy) or patient (v1) | case ID, scope hash, expiry, scope-class flags | full scope description encrypted off-chain |
| `ConsentTokenRevoked` | same | case ID, token ID, reason | superseded glyph |
| `DisclosureGranted` | issuer of the consent token | case ID, recipient identity, data-class enum, expiry | per-class release event; readable by the recipient |
| `DisclosureRevoked` | same | case ID, recipient identity, data-class enum | |

### Standing rules

| Event | Issuer | Payload (on chain) | Off-chain reference |
|---|---|---|---|
| `RuleVersion` | org | rule-set ID, version number, rule-content hash, predecessor version, signer (org or sub-identity such as a hospital-bound specialist key), guardrail-result enum | full rule contents (static + plain-text) encrypted off-chain |
| `RuleRejected` | guardrail oracle | rule-set ID, attempted version hash, rejection-category enum, rejection-reason hash | full reason encrypted off-chain; visible to the issuer |

### Intervention overrides

| Event | Issuer | Payload (on chain) | Notes |
|---|---|---|---|
| `OverrideIssued` | role authority who is overriding | event ID being overridden, new event ID, justification hash | original gets `⊘` glyph; new is the live state. |

### Escrow and settlement

| Event | Issuer | Payload (on chain) | Notes |
|---|---|---|---|
| `EscrowFunded` | requesting hospital | case ID, amount, payer attestation ref | atomic with `Claim` |
| `CompletionAttested` | receiving hospital | case ID, completion-evidence hash | unlocks settlement |
| `SettlementExecuted` | escrow contract | case ID, recipient, amount | terminal |
| `DisputeRaised` | any party | case ID, dispute-reason hash | freezes settlement pending resolution |

### Patient handoff (v0 proxy → v1 self-sovereign)

| Event | Issuer | Payload (on chain) | Notes |
|---|---|---|---|
| `PatientProxyEstablished` | hospital | patient subject hash, proxy-attestation ref | reflects the registration consent |
| `PatientProxyTransferred` | hospital | patient subject hash, new proxy holder (e.g., patient's own key) | terminates v0 proxy in favour of self-sovereign |

---

## Off-chain protocols

### Encrypted A2A

Free-form agent-to-agent conversation (clarifications, draft bids, consult coordination) is **end-to-end encrypted between the participating org identities and anchored on chain**.

- Channel: a libp2p-style direct channel between two org identities, keyed by a session key derived from their static keypairs (X25519 ECDH; details deferred).
- Anchoring: each message's content hash is appended to a per-conversation Merkle log. The log root is committed on chain on a tunable cadence (per message in v0; batched by relay in v1).
- Audit: a regulator with a warrant subpoenas one of the parties for the transcript. The chain log proves the transcript hasn't been redacted.

This is the same on-chain/off-chain split as PHI: chain holds *the events the conversation produced* (bids, claims, decisions) and *anchors* of the conversation; the conversation itself stays private.

### Encrypted pub-sub

Event payloads that are not themselves PHI but reveal sensitive metadata (case content, specialist routing, transport details) use **encrypted pub-sub** rather than plain-text on-chain payloads.

- For each event with a sensitive payload, the issuer encrypts the payload with a per-event symmetric key.
- The event's on-chain header carries: `(event_id, event_type, timestamp, payload_pointer, key_set_hash)`.
- The per-event key is wrapped (via X25519 + AEAD) with each authorised subscriber's public key. The wrapped key set is published to off-chain storage, addressed by `key_set_hash`.
- Subscribers (consoles, integration endpoints, notification relays) watch chain events, fetch wrapped key sets, decrypt the keys they're entitled to, and decrypt payloads they can.

This is the privacy property: the chain is public, but only the right subscribers decrypt the content. It's also the *neutral coordination layer* property: anyone can run a relay; no single party owns the notification network.

### Notification relay

A separate tier of long-running services that listen on chain and fan out to push, SMS, pager, and v1 webhook integrations.

- **Input.** Chain events; relay-specific subscription rules supplied by recipient consoles (per-role, per-priority, quiet hours, fallback chains).
- **Behaviour.** Relays see only event headers and recipient routing rules. Relays do **not** see encrypted payloads; the recipient's device decrypts on receipt.
- **Latency goal.** End-to-end under 2 seconds from chain finalisation to push delivery.
- **Channels.** Push (FCM / APNs), SMS (per-region SMS provider), pager (TAP / SNPP gateway), webhook (v1).
- **Federation.** Multiple independent relays may serve the same recipient; the recipient device deduplicates. No single relay is in the trusted path for content; they are in the trusted path for *availability* only.

The relay protocol itself is specified in [Notification surface](demo-ui.md#notification-surface) at the UI level; the wire format and key-wrap envelope are deferred to implementation.

---

## Agent runtime

Each org identity runs at least one **long-running agent daemon**. The daemon is the same process whether it's a hospital agent (handling outbound + inbound + internal routing) or a staffing-org agent (representing locums).

### Inputs

The daemon is event-driven, with multiple input sources merged into one ordered stream:

- **Chain events** — relevant `Case*`, `Bid*`, `Claim`, `Decline`, `Consent*`, `Disclosure*`, `RuleVersion`, `Override*`, `Escrow*`, `Completion*`, `Attestation*` events. Filtered by the org's identity, by attestation subscriptions, and by case-level subscription scopes.
- **User prompts** — from the agent companion (`user:` messages). Free-text or structured.
- **Operator interventions** — explicit override actions (accept-this, decline-this, re-route).
- **Integration callbacks (v1)** — from EMR, calendar, paging gateway, transfer-centre.
- **Internal timers** — bounty-escalation watchdogs, attestation-freshness checks, time-window expiries.

The daemon implements producer-consumer semantics: many producers (the inputs above) feed an ordered work queue; one or more consumers (the agent's own reasoning loops) drain it. Per-case state machines keep parallel cases independent.

### Outputs

- **Chain transactions** — bids, claims, declines, consent, rule-version, override.
- **Off-chain protocol messages** — encrypted A2A, encrypted pub-sub publishes.
- **Companion stream messages** — `agent`, `chain`, `tool` typed messages back to consoles authorised to observe this agent.
- **Notification relay triggers** — published as encrypted pub-sub; relays handle delivery.
- **Memory writes** — to local memory store.

### Working memory

Memory is local to the daemon process. Storage location depends on whose agent it is:

- **Hospital agents.** Memory in hospital-controlled infrastructure (the same boundary as their EMR). Encrypted at rest. Access logged.
- **Staffing-org agents.** Memory in staffing-org-controlled infrastructure.
- **Specialist preference state.** Held by the specialist's hospital agent in v0 (specialists don't run their own daemon). Edits flow through the specialist's console session.
- **Patient agent (v1).** Local to the patient's host (Curie consumer app, payer's app, MyChart). Encrypted at rest, keyed to the patient.

Memory contents and the agent's reasoning are **not** on chain. Only:

- The version events for things that have versions (rule-version is the canonical example).
- Anchoring hashes for things that need audit (A2A transcripts, conversation logs the operator wants regulator-traceable).

A regulator can prove *which rule version was active at moment T* by reading on-chain rule-version events. They cannot read the agent's reasoning without a subpoena to the agent's host.

### Decision authority

Default v0: the agent **surfaces, the operator approves**. Auto-claim is opt-in and narrow. Configurable per org and per role:

- **Hospital agent (inbound).** May auto-decline cases that fail static rule floors. Must surface anything not auto-declined to the operator before bidding. May auto-bid only with an explicit per-rule auto-bid flag set on the inbound matching rule (off by default in v0).
- **Hospital agent (outbound).** May escalate bounty within the operator-set ceiling. May expand search radius within the operator-set ceiling. Must surface bounty-ceiling or radius-ceiling extensions.
- **Staffing-org agent.** Same as hospital agent for the specialists it represents.

Every auto-decision is logged as a `tool` and `chain` companion event so the operator sees what happened without having to ask.

### Bidirectional companion

The companion is an interactive surface, not just a log:

- The user may prompt the agent at any time. Prompts become events.
- The user may issue an override at any time. Overrides become `OverrideIssued` chain events.
- The user may pause the agent's auto-actions for a window ("hold all auto-decisions for 10 minutes; everything to me first").
- The user may instruct the agent to monitor a specific case more aggressively ("ping me on pager when this gets a bid").

Prompts that materially change the agent's behaviour going forward are encoded as new rule versions (visible in the rules editor's version history) so they remain auditable. Ephemeral prompts ("for the next 30 minutes") expire to a base rule version.

---

## Standing rules data model

Rules are the agent's instructions for representing an org or a specialist. **Static and plain-text rules are merged into a single rule set** with two component layers; the static layer is inviolable.

### Static layer

A structured object with fields enumerated below. Fields not relevant to a given role are omitted.

```
static_rules {
  identity_ref:        bytes32        // org or specialist subject this rule set is for
  specialty_codes:     enum[]         // ABMS / AOA codes the agent may bid for
  service_radius_mi:   uint
  hours:               schedule       // weekly availability, on-call windows
  bounty_floor_cents:  uint
  capacity_cap:        uint           // max active assignments at a time
  auto_decline_flags:  flag[]         // OR running over by N min, < N min before start, etc.
  auto_accept_flags:   flag[]         // off by default in v0
  jurisdiction_codes:  enum[]         // license states this rule set is valid in
  freshness_max:       uint           // attestation freshness override (capped by protocol max)
}
```

### Plain-text layer

A bounded list of plain-text preferences. Each is encoded by the agent into a structured representation alongside the original text.

```
plaintext_rule {
  text:           string             // the user's original text
  encoded:        json               // the agent's encoded representation
  encoding_model: string             // identifier of the model+version that did the encoding
  expires_at:     uint64             // optional; 0 means until manually changed
  guardrail:      enum               // accepted | rejected | needs-clarification
  guardrail_reason_hash: bytes32     // if rejected or needs-clarification
}
```

### Guardrails

A separate moderation layer evaluates every plain-text rule edit before save. Categories that block a save:

- **Hateful or discriminatory content.**
- **EMTALA-violating rules.** *"Decline anyone uninsured", "decline anyone on Medicaid", "decline based on race / ethnicity / national origin / religion."*
- **Anti-medical-ethics rules.** *"Auto-accept patients only from <category>."*
- **Ambiguous rules.** Pushed back to the user with a clarifying question.

The moderation layer is itself an attestation-issuing service; in v0 it runs alongside the agent runtime and signs each evaluation. In v1 it may be operated by an independent third party so blocked rules cannot be silently kept.

### Versioning

Every rule edit produces a new version. Version metadata is anchored on chain via `RuleVersion`:

```
RuleVersion {
  rule_set_id:      bytes32
  version:          uint
  predecessor:      uint                   // 0 for the first version
  content_hash:     bytes32                // hash over the full rule content
  signer:           address                // org identity (or sub-identity) signing this edit
  guardrail_result: enum                   // accepted | rejected
  emitted_at:       uint64
}
```

The full rule content stays off-chain (encrypted, addressed by `content_hash`). A regulator investigating an EMTALA event reads which rule version was active at the moment of the event from the on-chain history and verifies the off-chain content's hash.

---

## Storage

### What lives on chain

- Org identities and their key history.
- Attestations (issued, refreshed, revoked).
- Case events (`CasePosted` through `Settlement*`).
- Consent and disclosure events.
- Rule version events.
- Intervention override events.
- Encrypted-pub-sub event headers and key-set hashes.
- Conversation log roots (Merkle).

### What lives off chain (encrypted)

- Full clinical summaries (referenced by hash from `CasePosted`).
- Full rule contents (referenced by hash from `RuleVersion`).
- Full A2A conversation transcripts (referenced by Merkle log roots).
- Per-event symmetric keys, wrapped per subscriber (referenced by `key_set_hash`).
- Working memory of every agent.
- Patient identity, name, full demographics, vitals streams, imaging.

### Storage backends

- **IPFS** (default) for non-PHI public-coordination payloads (rule contents, conversation logs).
- **Hospital-controlled storage** for PHI-grade payloads (clinical summaries, vitals, imaging). Curie does not run a centralised PHI store; PHI stays inside hospital boundaries and travels via per-recipient encryption.
- **Patient-controlled storage** in v1 for patient-managed payloads.

### Key management

- Each org identity holds a long-lived signing key (EVM keypair) and a long-lived encryption key (X25519). Key rotations are themselves on-chain events; old keys remain valid for verifying past signatures.
- Per-event symmetric keys are ephemeral; each is wrapped with the X25519 keys of subscribers entitled to read.
- Specialist sub-identities (used to sign rule edits made by a specialist within their hospital's umbrella) are derived from the hospital's keyring and tracked in an on-chain sub-identity registry.

---

## Authentication and authorisation

### Authentication

- **Console users** authenticate to the backend by demonstrating control of an org identity (or sub-identity). v0 uses standard EVM wallet-based session auth (sign-in-with-Ethereum or equivalent). The org identity binds the session to a CCN or NPI.
- **Service-to-service** (notification relays, oracles, integrations) authenticate by signed request envelopes against their published org or oracle identity.

### Authorisation

Every chain action is authorised by the signing identity. Off-chain actions are authorised by:

- **Role attestation** for console users — the org identity authorises specific human users to act in specific roles (operator, specialist, audit). Role attestations are themselves on-chain so a regulator can verify who had which role at a given time.
- **Disclosure scope** for content access — a console attempting to decrypt a payload must hold the key wrap addressed to its org identity, which is only published if the issuing consent token granted it.
- **Subscription scope** for event visibility — an integration endpoint subscribed to a hospital's events sees only events the hospital's subscription rules permit.

### What the backend must never do

- **Mint chain transactions on behalf of an identity it doesn't have authority for.** Even with operational control of an identity's keys (e.g., an org running its own daemon), the daemon must respect the per-action authority bounds in the static rules and decision-authority section above.
- **Decrypt PHI it isn't permissioned to decrypt.** Even in admin or debug paths.
- **Cache PHI in observability or logging surfaces.** Logs must redact known PHI classes; metrics must be aggregate-only.
- **Cross-link patients across hospitals.** A hospital's view of a patient stays within that hospital. Cross-hospital patient identity is a v1 concern requiring a separate framework (cf. payer-issued patient identity attestations).

---

## v1 integration hooks

v0 ships the destination web app with a handful of integration *stubs* — webhook receipts that record an integration would have fired, without actually firing. v1 fills these in. The hooks are listed here so the v0 backend speaks the right shape to the right surfaces.

| Hook | When fired | v1 target |
|---|---|---|
| `case.transport.dispatch` | claim finalised + transport-ready confirmed | EMS dispatch / CAD integration |
| `case.emr.handoff` | claim finalised | receiving hospital's EMR (HL7 / FHIR) |
| `case.paging` | inbound routing decision finalised | paging gateway (TAP / SNPP) |
| `payer.eligibility.check` | bid evaluation | payer eligibility API |
| `or.scheduling.hold` | claim finalised, OR-requiring case | OR scheduling system |
| `attestation.refresh.request` | freshness-window warning | the originating oracle (CMS / ABMS / FSMB / hospital) |

Each hook in v0 is a webhook receipt to a configurable URL with a JSON envelope; the receipt is signed by the firing org identity. Idempotent. Replayable for debugging.

---

## Hard rules

- **No PHI on chain. Ever.** Every decision in this spec is downstream of this.
- **Hospital-mediated routing in v0.** Specialists are not direct chain participants.
- **No silent guardrail bypass.** A blocked rule is a recorded event.
- **Memory is local.** Working memory and rule contents stay off-chain; only versions and hashes are anchored.
- **Attestations gate bids.** A bid that references a stale or revoked attestation is rejected at the protocol level — the chain enforces this, not the UI.
- **Don't invent technical claims.** Performance numbers in this spec must trace to Somnia's published characteristics or be stated as goals (with the word "goal").

---

## Non-goals

- **A new identity framework.** Curie binds to NPI / CCN / ABMS / state-board / hospital-privileging — the existing US healthcare verification spine. Proof-of-personhood, decentralised-identity protocols, and similar are out of scope.
- **A new chain.** Curie deploys on Somnia. Chain-level features (consensus, finality, fees) are Somnia's, not Curie's.
- **A new wallet.** v0 uses standard EVM wallets for org identities.
- **A clinical decision-support backend.** The agent's reasoning is about availability and consent, not medical correctness.
- **A patient consumer app backend (v0).** Patient self-sovereignty is v1.
- **A general integration platform.** Integration hooks in v0 are stubs; the v1 integrations are themselves separate product/spec work.

---

## Open questions

- **Solidity event topics and ABIs.** Concrete contract interfaces are deferred to the implementation branch.
- **Gas envelope.** Event sizes, batching cadence for Merkle log roots, and per-message economics under Somnia's fee model are not yet sized. Track as an amendment when the implementation branch surfaces real numbers.
- **Oracle independence.** v0 may run all attestation oracles internally for the demo. v1 needs at least the moderation oracle to be operationally independent so it can't be silently colluded with.
- **A2A latency.** End-to-end latency goals for chain-anchored A2A messages under load are not yet set.
- **Multi-tenant agent runtime.** Whether v0 runs each org's agent in its own process (simple, isolated) or multi-tenant (efficient, harder to reason about) is a deployment question, not a protocol question, but it affects the operational picture in the demo.
- **Locum-as-self-org UX.** Whether a true independent locum onboards as a self-org or via a v1 patient-style consumer app affects the v0 onboarding flow.
- **Patient-proxy framework precision.** v0's patient-proxy attestation needs a concrete legal mapping to the existing HIPAA acknowledgement workflow at registration. Worth running by a healthcare-compliance reviewer before pilot.
- **API surface for the destination web app.** This spec defines the protocol-and-runtime contract; the HTTP/gRPC API the console actually calls is one layer up and is implementation-branch work.
