## Demo UI

**The interface that carries Curie's protocol story to a non-technical, time-pressured audience.**

> The judges already know what a blockchain is. They don't know what an *agent-mediated EMTALA workflow* looks like.
> The UI's job is to make that legible in 90 seconds.

This spec defines the user interface for the live demo and for the reference implementation that follows. It is downstream of [`docs/spec/curie.md`](curie.md) and bound to the backend contract in [`docs/spec/api.md`](api.md). It does not introduce protocol behaviour, only the surface through which protocol behaviour is observed and acted on.

---

### TL;DR

- **One console pattern, role bindings as toggles.** Every actor — hospital operator, specialist, patient/family, regulator/audit — sees the same console with role-specific data and disclosure rules. Bindings are switchable in-app for users authorised to wear more than one hat.
- **The agent companion is bidirectional.** Reasoning, tool calls, and chain transactions stream in; user prompts and interventions stream out. The companion is the *primary interaction surface* with the agent, not a passive observer pane.
- **Hospital-mediated routing is the default.** Hospital operators run the marketplace participation on both sides — outbound (we can't treat this) and inbound (we can; here's who we'll route to). Individual specialists in v0 express preferences, accept/decline assignments, and don't bid directly on chain. Locums are wrapped as one-person staffing orgs to fit the same shape.
- **Chain state is visible on every item** through a small fixed symbol palette. Pending, mined, finalised, reverted, superseded — five glyphs, learned once, used everywhere.
- **PHI never crosses an institutional surface that hasn't released it.** Per-role disclosure is computed from the patient agent's consent scopes (or, in v0, from the hospital agent acting as patient proxy); the UI renders only what is explicitly released.
- **The demo stage is several console instances side by side**, on one screen, sharing a single ledger ticker — not bespoke panels.

The product is a **destination web app first**, integrations second-order. The UI is the readable surface over what the backend does. The backend is the priority and is specced in [`api.md`](api.md).

---

## The CurieConsole pattern

The unifying frame. Every role binding is this pattern with different data and different disclosure rules.

### Layout

```
┌── Curie Console ─────────────────────────────────────────────────────────────┐
│ <role badge>   <identity>   ⛓ block 12,345,678   final ~0.4s   <wall clock> │
├──────────────────┬─────────────────────────────────┬─────────────────────────┤
│  Inbox           │  Detail                         │  Agent companion        │
│  (left rail)     │  (centre stage)                 │  (right rail · 2-way)   │
│                  │                                 │                         │
│  ◌ Case 0xab…    │  ─ Case header ─                │  agent: NPI verified    │
│  ◐ Case 0xcd…    │  ICD-10 K35.32                  │  chain: tx 0x… ◐        │
│  ● Case 0xef…    │  acuity 2 · 60min               │  agent: rule match      │
│  ⊘ Case 0x12…    │                                 │  agent: surfacing for   │
│                  │  ─ Map embed ─                  │         your call       │
│  [filters]       │  ─ Disclosure panel ─           │  user: accept this,     │
│  [+ post case]   │  ─ Action bar ─                 │        I'm free now     │
│                  │                                 │  chain: claim 0x… ●     │
│                  │                                 │                         │
│                  │                                 │  ─────                  │
│                  │                                 │  [type to your agent…]  │
└──────────────────┴─────────────────────────────────┴─────────────────────────┘
```

### Sections

- **Header.** Role badge (colour-coded per role), identity (the actor's onchain identity, abbreviated), the current Somnia block height, and the rolling finality measurement. Wall-clock time on the right — referenced repeatedly during the demo. A role-toggle dropdown for users authorised to switch (e.g., a hospital operator who is also a credentialed specialist).
- **Inbox (left rail).** A list of items relevant to this role, prefixed with chain-state glyphs. Includes filters and the role's primary creation affordance (*+ post case* for hospital operators, *+ propose rule* for specialists, *+ approve* for patient/family).
- **Detail (centre).** The currently selected item, expanded into stacked sub-panels: case header, map embed, disclosure panel, action bar. Sub-panels not relevant to a role are omitted.
- **Agent companion (right rail).** A bidirectional, scrolling stream of agent activity *and* user input. Four message types: `agent` (reasoning), `chain` (a transaction), `tool` (an off-chain action), `user` (a prompt or intervention from the operator). See [Agent companion](#agent-companion).

### Multi-case dispatcher

The hospital operator binding adds a **sibling layout** that swaps the single-case detail for a priority-queue dispatcher view. The inbox and companion stay; the centre becomes a queue of active cases:

```
┌── Centre · Multi-case dispatcher ────────────────────────────────────────────┐
│ Sort: [priority ▾]   Filter: [active ▾]   Outbound · Inbound · All           │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ● P1  Case 0xab…  K35.32  60min  bidder · 1   transport · pending        │ │
│ │ ◐ P2  Case 0xcd…  I63.9   90min  bidder · 0   ⚠ no bids @ T+3min         │ │
│ │ ◌ P2  Case 0xef…  S72.0   240min bidder · 3   awaiting our routing       │ │
│ │ ● P3  Case 0x12…  R10.4   480min closed · transferred                    │ │
│ │ …                                                                        │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ [glanceable map · active transports]                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

A case row clicks through to its single-case detail. The dispatcher view is the answer to "five active cases at once" — a triage surface, not a card-shuffling board (the chain shuffles state, not the user). Default sort is by priority and time-window urgency; the agent companion narrates rule-relevant changes across all rows.

### Approachability

The visual register is closer to a modern consumer app than a hospital EMR — generous whitespace, soft neutral palette, restrained typography, no chrome that signals "compliance product". Hospital adoption rides on operators and clinicians liking the surface; both have very low tolerance for software that feels punitive.

### Why a single pattern across roles

A spectator watching the demo sees the requesting hospital's screen, the receiving hospital's screen, and the patient screen at the same time. If each were its own design, the spectator's first thirty seconds are spent learning three layouts. Sharing the frame collapses that to learning one frame and three role tints. It also constrains us as builders: features that don't fit the frame are usually features we shouldn't ship.

---

## Role bindings

Each binding is a parameterisation of the CurieConsole pattern: same frame, different data, different disclosure, different action set.

### Hospital operator

The primary role. The transfer-centre coordinator, charge nurse, or EMTALA-compliance officer at a participating hospital. **One operator, one console, both sides of the marketplace** — outbound (their hospital posted a case) and inbound (another hospital posted a case their hospital can take).

The operator is the human authorised to act for the hospital's onchain identity. The hospital's agent does the routine work; the operator approves the consequential moves and intervenes in the rest.

#### Inbox

Two streams in one inbox, distinguished by glyph and label:

- **Outbound** — cases this hospital has posted (we can't treat these). States: searching for bidders, claimed, in transport, closed.
- **Inbound** — cases this hospital is being asked to take (we have the capability, the agent is evaluating). States: agent reviewing, awaiting operator routing, claimed by us, declined by us, claimed elsewhere.

Sub-tabs: *Active*, *Awaiting transport*, *Closed (last 24h)*. Search and filter by ICD-10, acuity tier, date range, requesting hospital, assigned specialist.

#### Detail (single case)

- **Case header.** ICD-10, acuity tier, posted-at, time window remaining, current bounty (or, on inbound, the bounty being offered), on-chain hash. Outbound vs. inbound is visually obvious.
- **Bid table (outbound only).** One row per hospital that has reviewed the case: hospital identity, in-network status (computed against the patient's payer), distance, claim state. Each row prefixed with a chain-state glyph.
- **Routing panel (inbound only).** Once the agent recommends a bid, this panel surfaces the candidate specialists from the hospital's own staff. Each row: specialist identity, current availability (from the calendar integration, when present), preference match score, conflict flags. The operator picks one or asks the agent to consult the specialist directly.
- **Map embed.** This hospital as the centre node; counterparty hospitals as nodes around it; transport route appears once a claim is finalised. See [Map embed](#map-embed).
- **Action bar.** Outbound: *Escalate bounty*, *Expand radius*, *Cancel case*, *Confirm transport ready*. Inbound: *Bid (with proposed specialist)*, *Decline (with reason)*, *Hold for operator review*. Each action is a transaction; each shows its chain-state glyph as it propagates.

#### Detail (multi-case dispatcher)

Toggle from the same role binding. See [Multi-case dispatcher](#multi-case-dispatcher) above.

#### Agent companion

The hospital agent narrates outbound and inbound work in one stream:

- *Outbound:* drafting the structured request from the operator's free text, hashing the encrypted summary, posting on chain, watching for bids, computing in-network status against the patient's payer, suggesting bounty escalations.
- *Inbound:* checking the case against the hospital's specialty roster, scanning for which staff specialists are on-rotation and have matching preferences, conflict-checking the calendar, drafting a bid, surfacing for operator approval.

The companion accepts user prompts and interventions: *"Don't surface me anything past midnight unless P1," "send this to Dr. Smith specifically," "we're at capacity, decline everything inbound for the next 30 minutes."* Each user message becomes an event the agent acts on and (where consequential) chain-anchors.

#### Disclosure (what this role can see)

- Full detail on cases this hospital authored or is being asked to bid on.
- Bidder identity and aggregate trust signals on outbound; their own staff specialists' identities, preferences, and rotations on inbound.
- The operator's view is the broadest day-to-day view in v0 — they see clinical detail (so they can route correctly), patient identity once the patient agent (or, in v0, their own hospital-as-patient-proxy) releases it, and the hospital's own attestation chain.

### Specialist

A credentialed clinician at a participating hospital — or an independent locum wrapped as a one-person staffing org. **In v0, specialists are not direct chain participants.** Their hospital agent bids on their behalf; their consent and accept/decline of internal assignments stays off-chain.

What the specialist binding *is*: a preference-expression surface, a notification target, and an assignment accept/decline workflow. The specialist console exists to give the clinician control over how their hospital's agent represents them, and to surface assignments routed to them by their hospital operator.

#### Inbox

- **Assignments** — cases routed to this specialist by their hospital operator (or auto-routed by the hospital agent within the bounds of the specialist's preferences). States: surfaced for review, accepted, declined, claimed by hospital, completed.
- **Auto-handled** — assignments the hospital agent dispatched on the specialist's behalf without surfacing (within the specialist's pre-authorised auto-accept rules). The auditable record of the agent's authority over this specialist's work.

#### Detail

- **Case header.** Same fields as the hospital binding's outbound view, but framed from the assigned-specialist's perspective. Distance, expected response window, predicted travel/transport mode.
- **Why-routed-to-me explainer.** A short block: which preference matched, which conflicts were checked, which colleagues were considered. This is the bit judges read on screen.
- **Map embed.** The receiving hospital and the requesting hospital, with the route between them.
- **Action bar.** *Accept*, *Decline (with reason)*, *Hand to a colleague*, *Defer to operator*. Single tap each. Accept is visually weighted as the primary affordance.

#### Standing-rules editor

The specialist's surface for telling their hospital agent how to represent them. See [Standing-rules editor](#standing-rules-editor) for the full component — accessible from the binding's settings drawer.

#### Agent companion

The specialist's view of the agent's reasoning *about cases relevant to them*. The companion is bidirectional: the specialist can prompt their agent at any time (*"I'm post-call, only urgent peds for the next 12h"*), and those prompts become rule-version events.

- The specialist sees their own hospital agent's reasoning, scoped to their assignments and pending considerations.
- The specialist does **not** see other specialists' assignments at their hospital by default (peer privacy), only their own queue and the hospital operator's high-level routing decisions where they were a candidate.

#### Disclosure

- Full clinical detail relevant to evaluating an assigned case (whatever the patient agent has released for emergency surgical / specialty consult).
- The specialist sees their own preferences, their own credential bundle, their own rule-version history. They do not see other specialists' preferences or rules.
- Patient identity is released to the specialist only at assignment acceptance, and only at the granularity the disclosure model permits.

### Patient / family

The consent and billing view. **In v0, the hospital fills in for the patient agent** — the hospital's agent holds the patient's consent token, the patient sees a read-mostly view of what was consented on their behalf and what was paid. Patient self-sovereignty (the patient's own agent acting in parallel with the hospital's) is v1, with MyChart-style and payer-app integrations as plausible hosts.

This binding exists in v0 to make the consent surface visible and to seed the v1 self-sovereign path. It is also the binding most often viewed in retrospect (after care) rather than live (during care) — important for the storyboard.

#### Inbox

- Consult requests touching this patient, in any state. The patient (or co-signing family member) sees what was asked, by whom, with what scope, with what cost. Items prefix-glyphed by chain state: *requested* (◌), *consent issued* (◐), *care delivered* (●), *paid and closed* (●●).

#### Detail

- **What was asked.** Plain-language summary: type of consult, requesting hospital, time window, expected cost band, in-network status.
- **Consent scope panel.** The patient's standing scopes (where set) plus the per-case scope used, with explicit deltas highlighted. In v0 most scopes default to the hospital's safe-emergency profile.
- **Family co-sign.** Where applicable, which co-signers approved and which were pending.
- **Map embed (optional, consent-gated).** Disabled by default; surfaces only with explicit location-sharing consent.
- **Action bar.** v0: mostly read-only with a *Request scope change* affordance that pages the hospital operator. v1: *Approve*, *Approve with limits*, *Decline*, *Defer to family*.

#### Agent companion

In v0 the patient binding shows the *hospital agent's* reasoning *about the patient's consent path* — which bidder is in-network, what cost band, which scope was used. In v1 it switches to the patient's own agent's reasoning. The companion is bidirectional in both versions; in v0 the user-side prompts are limited to scope-change requests.

#### Disclosure

- The patient sees everything relevant to a decision in retrospect: the proposed scope, the cost band, the network status, the timing. Clinical detail is summarised, not raw.
- The patient sees who asked: the requesting hospital identity, the candidate specialists' identities and aggregate trust signals, but not other patients' cases or other specialists' rules.

### Regulator / audit

Read-only. No action bar, no companion — just the trail.

#### Inbox

- A timeline of every event matching the regulator's authorised query window. Filterable by hospital, specialist NPI, case ID, date range, EMTALA-relevant flags (e.g. *declined-and-not-rerouted-within-X-minutes*, *bounty escalated past published cap*, *standing-rule edited within N hours of a relevant case*).
- Each event prefix-glyphed; each links to its on-chain transaction.

#### Detail

- **Event detail.** Who acted, what they did, when, against what case. All identities resolved (regulator authority can de-anonymise within the bounds of their warrant or audit authorisation).
- **Map embed.** Where the case originated, who was offered it, who claimed it, where the patient ended up.
- **Disclosure panel.** Shows what the regulator's authority allows them to see for this case.

#### Disclosure

- Identity-level access to actions on the chain (offers, bids, claims, declines, escrow movements, rule-version events, intervention overrides).
- **No PHI.** The regulator sees pointers and hashes, not encrypted summaries. Off-chain content requires a separate legal process.
- A regulator who lacks authority for a given query simply doesn't see those rows; the UI does not redact, it filters.

### Hospital-internal audit (sibling of regulator binding)

A hospital's own compliance officer needs the regulator binding's surface but scoped to their own hospital's actions. This is the same pattern with a different identity-bound query scope; not a new role binding, just a parameterisation of the regulator binding.

---

## Cross-cutting components

These are the shared elements composed into every binding. Specifying them once keeps the role bindings consistent.

### Chain-state symbols

A small fixed palette. Five glyphs, learned once, used on every item across every binding.

| Glyph | Name | Meaning |
|---|---|---|
| `◌` | Proposed | Submitted to the mempool, not yet in a block. |
| `◐` | Mined | Included in a block, not yet final. |
| `●` | Finalised | Final per Somnia's published sub-second finality. |
| `↩` | Reverted | Transaction failed or was reorged out. |
| `⊘` | Superseded | Logically replaced by a later transaction (e.g. an intervention override, an amended consent scope, a re-bid after a decline). |

Rules:

- The glyph appears as the leading character of every chain-anchored item (inbox row, agent companion `chain` message, ledger ticker line, action-bar transition).
- Transitions animate in place — `◌` → `◐` → `●` — so the eye learns the progression.
- `↩` and `⊘` are red-tinted; the others are neutral. Colour is a hint, not the signal — the glyph is the signal.

### Agent companion

A vertical pane on the right of every console. **Bidirectional:** streams agent activity *into* the user, and accepts user prompts and interventions *back* to the agent.

Four message types:

| Type | Prefix | Direction | Content | Example |
|---|---|---|---|---|
| `agent` | `agent:` | agent → user | A reasoning step, in plain English. | `agent: NPI verified, license active in IN, ABMS general surgery current.` |
| `chain` | `chain:` | agent → user | A transaction the agent submitted. Includes the chain-state glyph and the abbreviated tx hash. | `chain: ◐ tx 0x4f… case 0xab… bid submitted` |
| `tool` | `tool:` | agent → user | An off-chain action the agent performed. | `tool: queried NPPES · 1 result · 240ms` |
| `user` | `user:` | user → agent | A prompt or intervention from the operator. | `user: accept this, I have time now` |

Design rules:

- Plain English, not JSON. JSON belongs in a developer console; this is a stakeholder surface.
- Reasoning steps are short — one or two lines. The companion is read by glance, not by paragraph.
- Every `chain` message links to the block explorer. Every `tool` message links to a debug pane that shows the raw call (developer affordance, hidden by default).
- The companion never auto-scrolls past unread items; it pauses at the user's last-read position and shows a "new activity" affordance.
- A persistent **input field at the bottom** of the companion accepts free-text prompts. The agent treats each prompt as an event in its long-running session — see [`api.md`](api.md) for the runtime semantics.

The companion is the *primary interaction surface with the agent*, not an observer pane. The case-detail action bar handles consequential one-tap moves (accept, decline, escalate); the companion handles everything else, including all standing-rule changes that originate as conversation.

### Standing-rules editor

The surface for telling your agent how to represent you. Two modes, one source of truth.

#### Static rules (forms-based)

Deterministic floors expressed as structured fields. Used for rules that must hold regardless of agent reasoning. Editable in a form; viewable in plain text.

```
┌── Standing rules · static ───────────────────────────────────────────┐
│ Specialty(ies):   [general surgery] [+ paeds surgery]                │
│ Service radius:   [90 miles ▾]                                       │
│ Hours:            [Mon–Fri 18:00–06:00] [Sat–Sun anytime] [+ block]  │
│ Bounty floor:     $ [1,200]                                          │
│ Auto-decline if:  [☑ in OR with a case running ≥30min over]          │
│                   [☑ less than 60min between assignment and start]   │
│ Auto-accept if:   [☐ at my home hospital and on-call] (off by def.)  │
│ Capacity caps:    [max 3 active assignments]                         │
├──────────────────────────────────────────────────────────────────────┤
│  Save (chain-anchored as rule v17)        Diff vs. v16   Version log │
└──────────────────────────────────────────────────────────────────────┘
```

#### Plain-text rules (chat with the agent)

Free-form preferences expressed to the agent in conversation. The agent encodes them as machine-actionable rules with the static rules as inviolable floors.

```
┌── Standing rules · conversation ─────────────────────────────────────┐
│ user: I'm post-call tonight, only urgent paeds, and prioritise       │
│       cases at our sister hospital in Bloomington                    │
│                                                                      │
│ agent: Got it. Until 06:00 tomorrow:                                 │
│        • surface only paeds cases with acuity ≥ 2                    │
│        • prefer Bloomington (CCN 99-0042) over equally-good options  │
│        • all other prefs unchanged                                   │
│        Save as v18? (chain-anchored)                                 │
│ user: yes                                                            │
│ chain: ◐ tx 0x9a… rule v18                                           │
└──────────────────────────────────────────────────────────────────────┘
```

#### Guardrails

A separate moderation layer evaluates every rule edit (static and plain-text) before save. Rules that the layer flags are rejected with a visible reason. Categories:

- **Hateful or discriminatory content.** Rejected.
- **EMTALA-violating rules** (e.g., *"decline anyone on Medicaid", "decline anyone uninsured"*). Rejected.
- **Anti-medical-ethics rules** (e.g., *"decline based on protected characteristics"*). Rejected.
- **Ambiguous rules** that the agent cannot encode confidently. Pushed back to the user with a clarifying question.

The guardrail rejection is itself an auditable event (chain-anchored, queryable by the regulator binding) — so a malicious agent runtime cannot silently keep blocked rules.

#### Version history

Every rule edit produces a new version. Version metadata (hash, timestamp, signer, diff hash) is anchored on chain. Rule contents stay off-chain. A regulator investigating an EMTALA event reads which rule version was active at the moment of the event and verifies the version's hash on chain.

### Map embed

Used by the hospital operator and specialist bindings; consent-gated for the patient binding.

- **Nodes.** Hospitals are nodes. Solid fill = in-network for the patient on this case; outline only = out-of-network. The patient location is a single pin, only present with explicit location-sharing consent; otherwise the patient is represented by the originating hospital's location.
- **Edges.** Once a claim is finalised, a route appears between the requesting and receiving hospitals. The route is rendered against the live transport mode (ground or air) and updates as transport progresses.
- **Glanceable variant** for the multi-case dispatcher: smaller, multi-case overlay showing all active transports at once.
- **Privacy default.** Patient location is **off** until consented. The patient binding's disclosure panel is the only place that flag is toggled.

### Notification surface

Most events reach users *outside* the console — through push, SMS, pager, or an integration endpoint. The notification surface is its own subsystem, not a console panel.

#### Channels

- **Push** — the default for a logged-in console user with a paired phone. Latency goal: end-to-end under 2 seconds from chain finalisation.
- **SMS** — fallback when push fails or the user has opted into SMS as a primary channel.
- **Pager** — for hospitals running pager infrastructure (still common). Format compatible with TAP/SNPP gateways.
- **Webhook** — for v1 integrations (EMR, transfer-centre platform, paging gateway). Stubbed in v0 with a JSON receipt.

#### Subscription model

Notifications are not point-to-point messages. They are **encrypted pub-sub**: event headers are public on chain; payloads are encrypted off-chain; per-event symmetric keys are wrapped with each authorised subscriber's public key. Subscribers (operator consoles, specialist consoles, patient consoles, integration endpoints) watch the chain, see all headers, and decrypt only what they're permissioned for.

A separate **notification relay tier** listens on chain and fans out to push / SMS / pager. Relays only see the trigger header, not the encrypted content; the user's device decrypts the payload after the relay wakes them.

This is the privacy property: the chain is public, but only those who know the patient (or hold the appropriate role attestation) can see what's happening *to that patient*. Anyone can run a relay; no single party owns the notification network. See [`api.md`](api.md) for the relay protocol and key-wrapping format.

#### Per-user routing

A user configures channels in console settings:

- Per-role and per-priority routing (*"P1 → push + pager; P2 → push only; P3 → digest"*).
- Quiet hours and on-call windows.
- Fallback chains (push fails for 30s → SMS → pager).
- Per-case overrides set from the agent companion (*"this case, ping me on pager"*).

### Disclosure controls

Driven by the patient agent's consent scopes — or, in v0, the hospital agent acting as patient proxy under standing emergency-care defaults. Every console renders a small *"what this viewer can see"* panel attached to the case detail.

- The panel lists data classes (clinical summary, identity, location, payer, prior cases, vitals stream, imaging) and shows each as released / withheld / pending consent for this viewer.
- Releases and revocations are themselves on-chain events with chain-state glyphs.
- The patient binding (v1) is the only role that can change a disclosure scope. Other roles can request a change; the request appears in the patient's inbox. In v0 the hospital operator binding has scope-change authority under the patient-proxy framework.

### Ledger ticker

A persistent strip across the bottom of any console where it makes sense — and across the whole stage screen during the demo.

- One line per chain event. Format: `T+<elapsed> <glyph> <event-summary> <abbreviated-hash>`.
- Auto-scrolls during live activity. Pausable. Searchable on hover.
- The ticker is the same data source that drives the regulator's inbox; it is just rendered as a stream rather than as a queryable inbox.

---

## Memory model

The agent has working memory. **Memory is local to the agent runtime.** Never on chain (cost + privacy + the no-PHI-onchain rule). Storage location depends on whose agent it is:

- **Hospital agents** — memory in hospital-controlled infrastructure (the same boundary as their EMR). Encrypted at rest. Access logged.
- **Specialist preference state** — held by the specialist's hospital agent in v0 (specialists don't run their own daemon). Specialists see and edit their own slice through the console; they don't see others'.
- **Patient agent (v1)** — local to the patient's host (a Curie consumer app, a payer's app, MyChart). Encrypted at rest, keyed to the patient.
- **Locum / staffing org agents** — same as hospital agents, just at smaller scale.

Memory is not a UI surface, but the console must show **what the agent currently believes** about the user where it changes behaviour: the active rule version, the active session preferences ("post-call until 06:00"), the active case context. This belief surface lives in the companion's settings drawer and is editable through the same chat-with-agent flow as standing rules.

A regulator reading the audit binding can verify *that* the agent had access to a given rule version at a given moment (via the on-chain rule-version event), but cannot read the agent's working memory. That requires a subpoena to the operator (hospital, payer, etc.) hosting the agent.

---

## Intervention semantics

A user can override a prior agent decision at any time. **The override is a new chain event** linked to the original; the original is preserved (and visually marked `⊘` superseded).

Examples:

- **Accept what the agent declined.** Hospital operator on the inbound side sees the agent auto-declined a case; types *"accept this, I have time now"* into the companion. The companion submits a new bid event; the auto-decline event gets a `⊘` glyph linked to the new bid hash.
- **Decline what the agent accepted.** Specialist taps decline on an auto-accepted assignment within the rollback window. The auto-accept gets `⊘`; the new decline is the live state. (Rollback windows are short by construction — once transport is dispatched, decline becomes a different protocol event with different consequences.)
- **Re-route mid-flight.** Hospital operator changes which staff specialist gets an inbound case after the agent's initial routing. The original routing event gets `⊘`; the new routing is the live state.

Constraints:

- Every override is signed by the role authority who issued it.
- The agent's prior reasoning is preserved (memory + chain hash) — the audit trail shows both what the agent did and what the human did instead.
- Overrides past finality on dependent events (transport dispatched, bounty escrowed) require an additional confirm step and may incur protocol-level penalties; see [`curie.md`](curie.md) for the protocol-level rules.

---

## Demo-stage composition

The form the judges see. Several CurieConsole instances rendered side by side on a single screen, with one shared ledger ticker.

```
┌── Stage screen ─────────────────────────────────────────────────────────────┐
│  wall clock                                          Curie · live           │
├─────────────────────┬─────────────────────┬─────────────────────────────────┤
│ Requesting-hospital │ Hospital A operator │ Hospital A specialist (Dr Chen) │
│ operator            │   (winning bidder · │   (assignment surfaces · taps   │
│   (posts case)      │    routes to Chen)  │    accept on phone)             │
│   ...               │   ...               │   ...                           │
│                     │                     │                                 │
├─────────────────────┴─────────┬───────────┴─────────────────────────────────┤
│ Patient / family (v0 hospital │ Audit / regulator (mini)                    │
│   proxy)                      │   (ledger view; Hospital B auto-decline     │
│                               │    visible here, populated post-claim)      │
├───────────────────────────────┴─────────────────────────────────────────────┤
│ Ledger ticker · ⛓ Somnia · block N · final ~0.4s                            │
│   T+0.0s  K35.32 case posted by requesting hospital (0xab…)                 │
│   T+0.4s  ◐ → ●  finalised                                                  │
│   T+12s   Hospital A agent reviewed · roster match · Dr Chen candidate      │
│   T+13s   Hospital B agent reviewed · auto-decline (OR overrun)             │
│   T+18s   Hospital A operator approved bid · pager fired to Dr Chen         │
│   T+34s   patient consent issued (hospital-proxy) · scope $5,000 in-net     │
│           Hospital A bid submitted                                          │
│   T+47s   Dr Chen accepted assignment · Hospital A claim posted             │
│   T+47.6s ◐ → ●  finalised · bounty escrowed                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why this composition

- **Three full consoles** show the parallel work of the requesting hospital operator, the winning receiving hospital operator (Hospital A), and the assigned specialist (Dr Chen at Hospital A). The two-operator framing makes the hospital-mediated routing visible — judges see *the marketplace and the internal routing as distinct decisions* rather than imagining the specialist as a market participant.
- **Two mini consoles** for the patient view (proxy in v0) and the audit binding. The patient view is small but visible; the audit view populates live, surfaces the auto-declining Hospital B's event prominently, and gets pulled forward at the closer.
- **One shared ledger ticker** runs across the bottom. Every event from every console lands here, in real time, with chain-state glyphs. This is the proof that all five consoles are reading from one truth, not five mocks.

### Choreography

The demo storyboard ([`docs/context/agentathon-demo.md`](../context/agentathon-demo.md)) is the timed script that drives the consoles together. The console UIs are designed so the storyboard *reads off them*: a judge can watch any one console and follow what's happening, but watching all of them tells the full story.

---

## Disclosure model (UI-level)

What follows is a UI-level treatment of disclosure. It governs what each role's UI renders for a given case. Per the philosophy in [`CLAUDE.md`](../../CLAUDE.md), disclosure rules that ought to be enforced at the *protocol* layer should eventually graduate from this section into [`docs/spec/curie.md`](curie.md) as a protocol-level concern. Treat this section as the working draft of that future amendment.

### Data classes

The patient agent's consent scope (or, in v0, the hospital's patient-proxy default) is enumerated over a fixed list of data classes. Adding a class is a spec change.

| Class | Description | Default release |
|---|---|---|
| `clinical-summary-emergency` | The de-identified clinical summary needed to evaluate an emergency consult. | Released to a bidding hospital's agent for routing decisions. |
| `clinical-summary-full` | Imaging, full history, prior notes. | Released only with explicit per-case consent. |
| `identity-name` | The patient's name. | Released to the receiving hospital and assigned specialist on claim. Not released to non-bidding hospitals. |
| `identity-demographics` | Age, sex, weight (clinically relevant baseline). | Released to bidding hospitals pre-claim, derivable from clinical-summary-emergency. |
| `location-precise` | Live patient location. | **Off by default.** Consented separately. |
| `location-coarse` | ZIP centroid of the originating hospital. | Released for matching. |
| `payer-attestation` | Proof of current insurance coverage and network. | Released to bidding hospitals for in-network determination. |
| `family-cosign-relationships` | Pre-registered co-signers. | Released to the patient binding only (or v0 hospital-proxy). |

### Visibility per role

A matrix of who can see what, in the absence of any per-case override. The patient agent (or v0 hospital proxy) can tighten or loosen any cell on a per-case basis.

| Class | Hospital operator (outbound) | Hospital operator (inbound, pre-bid) | Hospital operator (inbound, post-claim) | Specialist (assigned) | Patient | Regulator |
|---|---|---|---|---|---|---|
| `clinical-summary-emergency` | ● (authored) | ● | ● | ● | ● | ✗ (hash only) |
| `clinical-summary-full` | ● | ✗ | per-case | per-case | ● | ✗ (hash only) |
| `identity-name` | ✗ | ✗ | ● | ● | ● | per-warrant |
| `identity-demographics` | ✗ | ● | ● | ● | ● | per-warrant |
| `location-precise` | ✗ | ✗ | per-case | per-case | ● | ✗ |
| `location-coarse` | ● | ● | ● | ● | ● | ● |
| `payer-attestation` | summary | summary | summary | summary | ● | per-warrant |
| `family-cosign-relationships` | ✗ | ✗ | ✗ | ✗ | ● | per-warrant |

Legend: ● released, ✗ withheld, *summary* released as an aggregate flag (e.g. "in-network: yes") rather than the underlying attestation, *per-case* released only with explicit per-case consent, *per-warrant* released only on a documented regulatory authority.

### Configurability

The disclosure model is configurable along three axes:

1. **Per data class.** The patient (or v0 hospital proxy) can flip any default release/withheld state for any class.
2. **Per role.** The patient can refine which roles see a given class — e.g. release `identity-name` to a specific hospital but not to others.
3. **Per case.** Overrides at the case level stack on top of the standing scope.

The UI must surface every override visibly. A patient who has tightened disclosure should see that they have tightened it; a specialist who is seeing less than the default should see why. Hidden disclosure is a HIPAA risk *and* a usability failure.

### What the UI must never do

- Render PHI from a class that has not been released to this viewer.
- Cache PHI in client-side storage that survives a session.
- Display patient identity in screenshots, demo reels, marketing collateral, or any artefact that crosses an institutional boundary. Demo data must be obviously synthetic.

---

## Hard rules

- **No PHI rendered in any console where the disclosure model has not released it.** This is the UI-level expression of the protocol-level no-PHI-onchain rule.
- **No real patient data in the demo.** Demo data is synthetic and labelled.
- **No invented technical claims.** Finality numbers and TPS figures are Somnia's published numbers; do not introduce new performance numbers in UI copy without a source.
- **Four-message-type agent companion.** `agent`, `chain`, `tool`, `user`. Adding a fifth is a spec change.
- **No bespoke role designs.** A new role is a CurieConsole binding, not a new layout. If it doesn't fit the frame, that's a spec discussion before it's a UI discussion.
- **Hospital-mediated routing in v0.** Specialists are not direct chain participants; their hospital agent represents them. Any change to that is a protocol change, not a UI change.
- **Memory is local.** Working memory and rule contents stay off-chain. Only versions and hashes are anchored.

---

## Non-goals

- A general-purpose hospital EMR UI. Curie is the consult-coordination surface, not the chart.
- A clinical decision-support UI. The agent companion narrates *availability and consent* reasoning, not medical reasoning.
- A wallet UI. Onchain identity, signing, and key management for hospital identities are handled by standard EVM wallets external to the console; the console assumes those exist and integrates with them.
- A blockchain explorer. The ledger ticker is a curated activity stream; deep chain inspection is delegated to a real explorer via the explorer-link affordance.
- An integration platform. v0 is a destination web app; integrations (EMR, paging gateway, transfer-centre) are v1 surfaces stubbed by webhook receipts.
- A patient consumer app (v0). The patient binding is the hospital-proxy view; v1 introduces a self-sovereign host (Curie consumer app, MyChart, payer app).

---

## Open questions

- **Mobile.** The specialist binding is the most likely to be used on a phone (a clinician glancing during rounds). The specification above is desktop-shaped; a mobile parameterisation of CurieConsole that collapses inbox + companion behind tabs is implied but not yet specified.
- **Real-time vitals streaming.** If a patient is being transported by ground while a consult is in progress, the receiving specialist may want a vitals stream embedded in the case detail. This is a likely amendment, not a v0 concern.
- **Multi-language.** The agent companion's plain-English style is designed for the English-speaking US healthcare market. Localisation of the companion grammar (especially the prefix words `agent:`, `chain:`, `tool:`, `user:`) is a downstream question.
- **Disclosure graduation.** When does the disclosure model in this UI spec move into [`docs/spec/curie.md`](curie.md) as a protocol-level enforcement concern? Probably as soon as a second implementation exists; both implementations need to agree on the data classes.
- **Patient self-sovereignty path.** v1 needs a host for the patient agent. MyChart partnership, payer app, standalone Curie consumer app — these are real product decisions not yet made.
- **Cross-hospital specialist visibility.** Today specialists can't see other hospitals' rosters and vice versa. v1+ may surface a federated specialist directory for hospitals doing community-call planning. Out of scope for v0.
