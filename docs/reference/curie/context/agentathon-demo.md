# Agentathon demo

**The 90-second live performance of Curie that judges actually see, plus the stage logistics behind it.**

> A protocol that nobody can describe in 90 seconds is a protocol that nobody can adopt in 90 days.

This document is **context, not spec.** The protocol behaviour lives in [`docs/spec/curie.md`](../spec/curie.md). The user interface lives in [`docs/spec/demo-ui.md`](../spec/demo-ui.md). This is the staging plan that puts those two on a screen in front of judges.

---

## Why a separate document

The 90-second storyboard sketched in [`curie.md`](../spec/curie.md#the-90-second-live-demo) is the **protocol-level** narrative — it describes which on-chain events happen in what order. This document is the **stage-level** plan: who clicks what, on which screen, with what fallbacks, against which judging criteria. The two should stay aligned but the spec changes more slowly than the rehearsal does.

---

## Goals of the live demo

The judging criteria for the Somnia Agentathon emphasise three things:

1. **Use of blockchain** — is the chain doing real work, or is it deployment-target theatre?
2. **AI agents** — are the agents reasoning, or are they if-statements wearing a costume?
3. **Audit and trust** — does the resulting system give a non-developer something they can hold up to a regulator?

The demo is engineered so that each of these is *visibly answered* during the 90 seconds, not just claimed in the slide deck.

| Judging criterion | The bit of the demo that addresses it |
|---|---|
| Blockchain doing real work | The ledger ticker, populated live with chain-state-glyph-prefixed events from five consoles. Sub-second `◐ → ●` transitions, on screen, against the wall clock. |
| AI agents reasoning | The agent companion in each console — plain-English reasoning streamed alongside chain transactions, in the grammar judges already know from chat tools. The losing specialist agent's auto-decline is the proof point that this isn't a scripted happy path. |
| Audit and trust | The regulator/audit console populates as the demo runs. At the closer, we pull it forward and show the EMTALA-grade trail; the wall clock has been visible the whole time, so the gap between "62 seconds" and "today's 45 minutes" lands without explanation. |

---

## Stage screen

One physical screen. Five CurieConsole instances composed per [Demo-stage composition](../spec/demo-ui.md#demo-stage-composition):

| Position | Console | Notes |
|---|---|---|
| Top-left (full) | Requesting-hospital operator | The transfer-centre coordinator's case-posting and bidder-watching view. |
| Top-centre (full) | Hospital A operator (winning bidder) | The receiving hospital's inbound roster check + candidate-bid + internal-routing view. |
| Top-right (full) | Dr Chen at Hospital A | The assigned specialist's view; she taps *Accept* on her phone. |
| Bottom-left (mini) | Patient / family (v0 hospital proxy) | Read-mostly consent shown as minted by the requesting hospital under proxy authority. |
| Bottom-right (mini) | Audit / regulator | Read-only timeline. Hospital B's auto-decline is prominent here; panel is pulled forward at the closer. |
| Bottom strip | Ledger ticker | Spans the full screen width. The single shared truth. |

A persistent **wall clock** in the top-right corner, started on the first keystroke and never paused. The demo's headline number (`62 seconds total`) is read off this clock.

---

## Cast and choreography

Three on-stage roles. The demo is performed, not narrated. The on-call ED physician at the requesting hospital dictated the case to the transfer coordinator seconds before T+0:00; the physician is not on stage.

| Role | Who | What they do |
|---|---|---|
| **Transfer-centre coordinator** (requesting hospital) | Presenter 1 | Types the case description into the requesting-hospital console. Speaks the closer. |
| **Hospital A operator** (winning bidder) | Presenter 2 | One-taps approval on the agent's candidate bid when it surfaces. Watches as Dr Chen is paged. |
| **Dr Chen** (specialist at Hospital A) | Presenter 3 (or Presenter 2's secondary phone — see fallbacks) | Taps *Accept* on the internal assignment from a phone. |
| **Father (co-signer)** | Simulated | Receives the consent confirmation push. Visible on the patient console. |

Hospital B's operator console (auto-decline) and the regulator panel are unattended — they react to chain state on their own.

---

## The 90 seconds, beat by beat

This refines the storyboard in [`curie.md`](../spec/curie.md#the-90-second-live-demo) with stage-level detail. The protocol-level events listed there are authoritative; the stage detail below is how we render them.

### 0:00 — Scene set (5 seconds, before the clock starts)

Presenter 1 stands at the requesting-hospital console.

> *"This is a small ED in southern Indiana. It's 11pm. A patient just walked in we cannot treat here. Watch the wall clock."*

Hits enter on a pre-loaded prompt. The wall clock starts.

### 0:00–0:10 — The trigger

Requesting-hospital console: free-text case description appears in the prompt area; the hospital agent transforms it into the structured case in the agent companion. The case-posted transaction lands on the ledger ticker as `◌`. Then `◐`. Then `●`. **0.4s** between `◐` and `●` is visible on the ticker.

### 0:10–0:20 — The ledger writes

The ticker shows `CasePosted` finalised on Somnia. The encrypted clinical summary lands in IPFS; the chain holds only the hash and the structured fields. Hospital A and Hospital B consoles begin reacting in parallel.

### 0:20–0:35 — Hospital agents reason out loud

Hospital A and Hospital B operator consoles light up. Both companions stream `tool` and `agent` messages: roster check against on-rotation specialists, attestation verification (NPI, license, ABMS, privileges, representation), standing-rule evaluation, calendar conflict detection.

- **Hospital A** finds a match (Dr Chen, no conflicts, post-op writing notes) and surfaces a candidate bid to its operator with Dr Chen as proposed specialist.
- **Hospital B** finds Dr Patel on rotation but auto-declines (current OR case running 25min over expected). The auto-decline lands as a chain event visible on the ticker and in the audit panel.

### 0:35–0:50 — The patient agent (hospital-proxy in v0)

Patient console: the requesting hospital's agent, acting as patient proxy under the registration-consent attestation, drafts a consent token. The companion narrates the in-network determination (Hospital A in-network; Hospital B out-of-network and auto-declined anyway). Token transitions through `◌ → ◐ → ●` on issuance. The father's phone (simulated) shows the confirmation.

### 0:50–1:00 — Bid, claim, internal assignment

Hospital A operator (Presenter 2) one-taps approval on the candidate bid. The `BidSubmitted` transaction lands; the requesting hospital's agent confirms a `Claim` against the only viable bidder. **Smart contract execution: 0.6s.** Bounty escrowed.

Hospital A's agent immediately dispatches the internal assignment to Dr Chen via pager and the specialist console. Dr Chen (Presenter 3) taps *Accept* on her phone. The claim row moves to live state on Hospital A's console; Hospital B's auto-decline gets `⊘` on its case row.

This is the moment we point at: a real protocol with real losers, a real internal routing decision, a real one-tap accept on a real phone.

### 1:00–1:15 — Logistics chain

Requesting-hospital console: the agent fires the downstream chain — transport request, EMR handoff to Hospital A, anaesthesia notification, OR booking. These are not on chain; they are off-chain integrations the agent owns. The agent companion shows them as `tool:` messages so judges see the seam between on-chain coordination and off-chain plumbing.

### 1:15–1:25 — The audit pull

Bottom-right (regulator) console pulled to full screen. The ledger ticker highlights the events of this case — case posted, Hospital B's auto-decline, Hospital A's bid, the claim, the consent, Dr Chen's acceptance, the bounty escrow, the logistics handoff. Wall clock visible the whole time.

### 1:25–1:30 — The closer

Presenter 1, off the keyboard, to the room:

> *"Sixty-two seconds. The current median is forty-five minutes. Three thousand US hospitals can't keep specialty coverage twenty-four-seven. Ten thousand specialists are willing to take overflow if the matching weren't broken. Curie is the protocol that connects them — neutral, on Somnia, machine-speed."*

Cut.

---

## Tech checklist

What must work for the demo to run.

- **Five console instances** — three full (requesting-hospital operator, Hospital A operator, Dr Chen's specialist console), two mini (patient, regulator) — running against one Somnia testnet deployment.
- **One shared ledger ticker** subscribed to the same chain. If it isn't reading from the same chain as the consoles, judges will (correctly) suspect mock data.
- **A real specialist phone** for Dr Chen's tap, on the same network as the laptop driving the consoles. (Tethered if conference Wi-Fi is unreliable; see fallbacks.)
- **A pre-loaded transfer-coordinator prompt.** Presenter 1 types it live, but the case data behind it is staged. We are demonstrating the protocol, not real-time clinical reasoning.
- **Pre-deployed and pre-funded** chain identities for the requesting hospital, Hospital A, and Hospital B. No "let me just import this wallet" on stage. Specialists are not chain participants in v0; their credentials are attested.
- **Pre-published credential attestations** for Dr Chen at Hospital A and Dr Patel at Hospital B (NPI, license, ABMS, privileges) plus their representation attestations to their respective hospitals, the patient's payer attestation, and each hospital's CCN-bound facility identity. The credential and representation checks must hit attestations that already exist on the chain.
- **Pre-issued patient-proxy attestation** binding the requesting hospital to the (synthetic) patient under v0 proxy authority.
- **Wall clock** visible on the stage screen, not on the presenter's phone.
- **A pre-recorded video** of the same 90 seconds, ready to cut to if anything live fails. Honesty if asked: "the live demo is flaky on conference Wi-Fi, this is the same flow recorded against the same testnet earlier today."

---

## Failure modes and fallbacks

The probability that something goes wrong on stage is roughly 1. Plan for each.

| Failure | Detection | Fallback |
|---|---|---|
| Conference Wi-Fi drops the laptop | Ledger ticker stops advancing | Switch to phone hotspot (pre-paired). |
| Dr Chen's phone doesn't get the page | Hospital A specialist console card doesn't appear within 5s | Presenter 2 taps *Accept* inside the Dr Chen specialist console directly. The chain doesn't care which device signed; the storyboard still works. |
| Hospital A's bid approval doesn't propagate | `BidSubmitted` doesn't appear on the ticker within 3s | Presenter 2 retries from the candidate-bid affordance. If still failing, fall through to the pre-recorded video. |
| Somnia testnet is degraded | Ledger ticker glyphs stuck at `◐` | Cut to the pre-recorded video. State explicitly that we're showing the recording. Continue to the closer. |
| An attestation oracle is down | Agent companion shows `tool: NPPES query failed` or `tool: representation attestation lookup failed` | Fall back to the pre-cached attestation bundle baked into the demo deployment. The companion still narrates honestly: `tool: using cached attestation, last refreshed 4h ago`. |
| Presenter 1 fumbles the prompt | First 10 seconds look uncertain | Restart the clock once. Do not restart twice. |

The single most important rule: **do not pretend a failure didn't happen.** If we cut to the recording, we say so. The judges respect a team that knows the difference between the demo and the system; they punish a team that obscures it.

---

## Synthetic data conventions

The demo data is synthetic. Conventions:

- **Patient.** A 14-year-old female, ICD-10 K35.32, ASA III. Same case as in [`curie.md`](../spec/curie.md#000010--the-trigger). Name shown in the patient console: *Demo Patient*. Father's name: *Demo Co-Signer*. Patient-proxy attestation pre-issued to the requesting hospital.
- **Hospitals.** Three synthetic facilities — the requesting hospital plus Hospital A (winning bidder, 40mi away) and Hospital B (auto-declining, 65mi away). All with valid-looking but obviously synthetic CCN values (prefixed `99-`, conventionally reserved). Geographic locations real (so the map embed renders convincingly), names made up.
- **Specialists.** Two synthetic NPIs in a reserved testing range, attested but not chain-participating: *Dr Chen* (paediatric surgery) at Hospital A, *Dr Patel* (paediatric surgery) at Hospital B. Real-looking ABMS specialty names (general surgery + paediatric surgery). All credentials pre-attested on the testnet, with representation attestations binding each to their respective hospital.
- **Bounties and consent caps.** Round numbers ($1,200 opening, $5,000 cap). No real-money implication.

This is in service of the hard rule in [`docs/spec/demo-ui.md`](../spec/demo-ui.md#hard-rules): no real patient data, ever, and synthetic data must be obviously synthetic.

---

## Practice plan

The demo is engineered, not improvised.

| When | Pass | Goal |
|---|---|---|
| **T-7 days** | Dry run 1, on the actual stage hardware if possible. | Identify the timing wobbles. The wall-clock total should land between **55 and 75 seconds**. |
| **T-3 days** | Dry run 2, full cast, including the phone-tap moment. | Hit the 60-second mark cold three times in a row. |
| **T-1 day** | Dress rehearsal with the recorded-video fallback exercised once on purpose. | Make sure the cut is smooth and the team can talk through it without getting flustered. |
| **T-30 min** | Final attestation refresh. | Make sure no on-chain credential we depend on is expiring during the demo window. |

If any practice pass exceeds **90 seconds** consistently, the storyboard is too crowded — cut a beat. Beats most safely cut: the logistics chain (1:00–1:15) compresses to a single `tool:` line; the audit pull (1:15–1:25) can be shortened to "*the trail is on screen, here it is*" without losing the EMTALA point.

---

## After the demo: the questions we expect

The live performance is half the score. Q&A is the other half. The questions a domain-aware judge is most likely to ask, with the short version of each answer (long versions live in [`curie.md`](../spec/curie.md)):

- *"What stops a fake specialist from joining?"* → Four on-chain attestations: NPI, license, board cert, plus a representation attestation that authorises a specific hospital to bid on the specialist's behalf. Bids referencing stale or revoked attestations are rejected at the protocol level. See [Trust and verification](../spec/curie.md#trust-and-verification--how-we-keep-bad-actors-out).
- *"Where does PHI live?"* → Off-chain, encrypted, at IPFS or hospital-controlled storage. The chain holds pointers, hashes, permissions, and payments. Never PHI. See the on-chain/off-chain table in [`curie.md`](../spec/curie.md#the-shared-ledger).
- *"Why blockchain at all?"* → Three reasons: neutrality (no single vendor owns the panel), EMTALA-grade audit across institutional boundaries, portable credentials. See [Why blockchain](../spec/curie.md#why-blockchain--the-answers-to-the-skeptical-judge).
- *"Why Somnia specifically?"* → Sub-second finality (stroke alerts cannot wait), 1M+ TPS (national infrastructure), EVM compatibility, agent-native positioning. Same reference.
- *"Is this clinical decision-making?"* → No. Availability and consent. See [What we are not claiming](../spec/curie.md#what-we-are-not-claiming).
- *"Why aren't specialists direct chain participants in v0?"* → Hospitals already have the legal authority and operational infrastructure to act on their staff's behalf — paging, scheduling, EMTALA accountability all sit at the hospital level today. Specialists express preferences and accept assignments; their hospital agent represents them. v1 introduces direct specialist participation for clinicians who want to sign their own bids. Locums participate through a staffing-org wrapper (a one-person staffing org for true independents).
- *"Where does the patient agent live?"* → v0: hospital-proxy under the registration consent the hospital already collects; the proxy is anchored on chain as a `patient-proxy` attestation. v1: self-sovereign, hosted by a Curie consumer app, a MyChart-style EMR partnership, or a payer's existing app. Both versions distinguish proxy-issued from self-issued consent tokens.
- *"First 100 users?"* → Critical-access hospitals in community-call states; independent locum specialists wrapped as staffing orgs; teleconsult vendors as channel partners. See [First 100 users](../spec/curie.md#first-100-users--the-go-to-market).

Practise these as a team. Two-sentence answers. The longer version is for the meeting after.
