# Curie

**A neutral protocol for emergency specialist consults — built on Somnia.**

> When the right specialist is the difference between a recovery and a tragedy,
> finding them shouldn't be a phone tree.

---

## TL;DR for the judges

- **Problem.** When a hospital can't treat what just walked through the door — appendicitis with no surgeon on call, stroke with no neurologist, ortho trauma with no one credentialed for it — finding the right specialist somewhere else is a series of phone calls between people with conflicting incentives. Acceptance rates on inter-hospital transfer requests run **47–64%**. Federal law (EMTALA) makes this a *required* workflow with $50,000-per-violation fines. The matching is broken.
- **Existing solutions are siloed.** Telestroke vendors (Sevaro, TeleSpecialists, Access TeleCare) solve the response-time problem inside their own panel. A hospital that contracts with one cannot fail over to another. There is no inter-vendor, inter-hospital, neutral marketplace.
- **Curie is that marketplace.** Hospitals' agents post structured, de-identified case requests on the outbound side and bid on cases they can take on the inbound side, each one consulting its on-rotation specialists' standing rules and verified onchain credentials to decide who to propose. In v0 the receiving hospital routes the assignment internally to a staff specialist; specialists are not direct chain participants. Patients are represented by their hospital under a registration-consent proxy in v0, with self-sovereign patient agency planned for v1. Every offer, bid, claim, and decline is recorded onchain as an EMTALA-grade audit trail.
- **Why Somnia.** Sub-second finality (you cannot wait 30s for consensus when a stroke is bleeding), 1M+ TPS (this is intended as national infrastructure), EVM compatibility (standard wallets and credential attestations), and *neutrality* (no hospital system would accept a competitor owning this layer; a public chain is genuinely the right architecture).

---

## The problem

Modern emergency medicine has a coordination problem that scales with the size of the country.

A patient with acute appendicitis arrives at a small rural ED in southern Indiana at 11pm. The hospital has no general surgeon on call tonight. Under EMTALA the patient must be transferred to a hospital with the capability — so the on-call ED physician picks up the phone and calls the regional transfer center. The transfer center calls a hospitalist at the nearest tertiary center; the hospitalist needs to track down the on-call surgeon; the surgeon may or may not pick up; if they do, they may decline the case (post-call, OR running long, or for economic reasons that are technically EMTALA violations but rarely prosecuted). The transfer center moves to the next hospital. Acceptance rates on these requests run between **47% and 64%** in published studies — meaning roughly one in three transfer attempts gets rejected and the requester starts over.

This pattern repeats across specialties. Neurology, neurosurgery, ortho, plastics, hand, OB, ophthalmology, dermatology — these are the specialties where on-call coverage is hardest to secure, and rural hospitals often have *zero* coverage. CMS has explicitly endorsed [community call plans](https://www.vonbriesen.com/legal-news/1909/cms-reverses-course-for-the-emtala-obligations-of-hospitals-with-specialized-care-and-eases-the-burdens-of-on-call-coverage) — multi-hospital specialty coverage sharing — as a regulatory mechanism to address this. **There is no protocol layer for it.**

What does exist:

- **Telestroke vendors** (Sevaro, TeleSpecialists, Access TeleCare, Equum, Vituity, NeuroX) — connect a hospital to a board-certified specialist on video in under 45 seconds. They are excellent. They are also closed panels: a hospital reaches *only* the specialists their vendor employs or contracts. If the vendor's panel is saturated, the hospital waits or calls the transfer center.
- **Locum tenens marketplaces** ([LocumTenens.com](http://LocumTenens.com), Nomad Health, CompHealth) — match physicians to assignments lasting days to months. They are job boards. They do not handle real-time per-case dispatch.
- **Hospital scheduling tools** (Lightning Bolt, Mesh AI, MetricAid) — combinatorial optimization to build call schedules. They do not negotiate per-case acceptance with other hospitals.
- **Communication platforms** (Pulsara, Juvare) — once you have decided who is on the case, these handle the messaging. They do not solve discovery or matching.

Each of these is a vertical slice. None of them is the inter-vendor, inter-hospital, agent-mediated marketplace.

---

## How Curie works

Curie is a protocol on Somnia, plus a reference implementation of the agents that talk to it. There are three classes of agents and one shared ledger.

### Hospital agent

Each participating hospital runs an agent that handles **both sides** of the marketplace. The human in the loop is the **transfer-centre coordinator** (or charge nurse, depending on the facility) — the operator authorised to act for the hospital's onchain identity. The clinician dictates the case; the operator runs the console.

**Outbound** (we can't treat this). The operator describes the need in plain text or structured form — *"14yo, suspected appendicitis with possible perforation, unstable, transfer-ready in 30min, no peds surgery on site."* The agent:

1. Hashes the de-identified clinical summary and stores the full encrypted version off-chain (IPFS or hospital-controlled).
2. Posts a structured case request onchain: ICD-10 (K35.32), acuity tier, geographic radius, time window, capability requirements (peds, surgical, OR access), and a starting bounty.
3. Watches for bids. Auto-escalates the bounty or expands the radius within operator-set ceilings; surfaces ceiling extensions for approval.
4. Confirms the claim on contract execution and triggers downstream logistics (transport, EMR handoff).

**Inbound** (we can take this). The agent watches the chain for cases the hospital might bid on. For each candidate:

1. Checks the case against the hospital's specialty roster and against each on-rotation specialist's standing rules and current calendar.
2. Drafts a candidate bid (proposed specialist, proposed bounty) and surfaces it to the operator.
3. On operator approval, signs and submits the bid — referencing the proposed specialist's onchain attestations (NPI, license, board certification, hospital privileges) and the specialist's representation attestation that authorises the hospital to bid on their behalf.
4. On a winning claim, dispatches the assignment to the specialist (off-chain, via the hospital's paging path) and accepts the operator's interventions (re-route, decline, hand to a colleague) until handoff is complete.

### Specialist agent

In v0, **specialists are not direct chain participants** — their hospital represents them in the marketplace. What lives on chain about a specialist is a continuously-refreshed bundle of attestations bound to their NPI; what lives off chain is their preferences, their assignment history, and their working memory.

Each credentialed clinician at a participating hospital publishes:

- **Credential attestations.** Signed by issuing authority (state medical board, ABMS, hospital privileging committee, DEA). Portable across vendors and hospitals — a specialist's qualifications are proven in milliseconds without a 90-day re-credentialing cycle. The chain enforces freshness; bids referencing stale or revoked attestations are rejected at the protocol level.
- **Standing rules.** Plain-language policies the specialist writes themselves: *"I'll take pediatric appendicitis cases at hospitals within 90 miles between 6pm and 6am, minimum bounty $X. Auto-decline if my OR has a case scheduled in the next 60 minutes. Surface to me for approval if it's borderline."* Authored by the specialist; executed by the hospital agent on the specialist's behalf. Every rule edit is chain-anchored as a version event.
- **A representation attestation** that authorises a specific hospital identity to bid on the specialist's behalf. Revocable in a single on-chain transaction.

When a hospital agent considers bidding on a case, it consults each on-rotation specialist's rules and reasons about the match in plain text — visible in both the hospital operator's console and the specialist's console:

- Are there scheduling conflicts? (Calendar integration, including the case currently in OR and the elective scheduled for tomorrow morning.)
- Is the prior case running long? (Real-time signals — "current case crossed the expected duration 15 minutes ago.")
- Does the case match the specialist's actual capability and recent practice? (Has the specialist done a peds appendicitis in the past 12 months? Privileges may say yes, but standing rules may say "I'd rather route to a colleague.")
- Should this auto-decline, surface to the operator with a candidate bid, or surface directly to the specialist for one-tap approval?

The specialist's surface is for authoring standing rules, watching their assignment queue, and accepting or declining individual assignments routed to them. Auto-claim authority is opt-in and narrow; the v0 default is *"agent surfaces, human approves."* Independent locums who don't belong to a participating hospital are wrapped as **staffing orgs** (a one-person staffing org for a true independent), so the same chain protocol applies. v1 introduces direct specialist participation for clinicians who want to sign their own bids.

### Patient agent

The headline feature, and the part nobody else is doing in emergencies — but the host of the patient agent shifts between v0 and v1.

**v0: hospital-proxy.** At registration, the patient signs a HIPAA-aligned consent that authorises their treating hospital to act as their patient agent in emergencies — the same legal artefact hospitals already collect, lifted onto the chain as a `patient-proxy` attestation (the signed paper or e-sign artefact stays in the hospital's records; only the hash and metadata go on chain). The hospital's agent then handles, on the patient's behalf:

- **Pre-authorised consent scopes** with safe defaults for emergency consults. Granular and revocable — *"Emergency surgical consult OK up to $5,000. In-network preferred. Out-of-network OK if no in-network specialist available within 10 minutes. Family co-sign rights to the registered relationships."*
- **Insurance attestation.** A cryptographic proof of current coverage, payer, and network. Eliminates the back-and-forth eligibility check that today eats 20+ minutes per emergency.
- **Family co-sign rights.** For incapacitated patients, designated family members can approve consults via their own session.

**v1: self-sovereign patient agent.** The same scope — consent, insurance, family co-sign — held by the patient themselves through one of three plausible hosts: a Curie consumer app, a MyChart-style EMR partnership, or a payer's existing app. The protocol distinguishes proxy-issued consent tokens from self-issued ones; both validate, but post-v0 a hospital cannot mint a token a patient has self-issued differently.

In either version, when a hospital agent considers a case, the patient agent (proxy or self-sovereign) runs in parallel:

- Identifies which bidders are in-network and surfaces them preferentially.
- Releases payer micropayments per consult automatically when consent scope is satisfied.
- Records the consent transaction onchain so there is no later dispute about what the patient (or proxy) agreed to.

### The shared ledger

What lives onchain on Somnia:

| Onchain | Off-chain |
|---|---|
| Specialist and facility credential attestations | All actual PHI |
| Standing-rule version events (hash + signer + version) | Standing-rule contents (encrypted) |
| Case requests (hash + ICD-10 + acuity tier + region + bounty) | Encrypted clinical summary at IPFS pointer |
| Bid / claim / decline / escrow / completion | The medical reasoning itself |
| Consent tokens and scope attestations | The consult conversation |
| Intervention overrides | Working memory of every agent |
| Audit trail (offer, bid, claim, decline, completion, timestamps) | Anything that could re-identify a patient |

This separation is non-negotiable. Onchain holds *pointers, permissions, payments*; never PHI itself.

---

## Trust and verification — how we keep bad actors out

A medically-informed judge will ask the obvious attack question: *what stops a bad actor from joining the network, claiming to be a board-certified neurosurgeon, accepting a stroke transfer, and routing a critical patient to a fake address while the helicopter burns its window?* The answer is that we don't invent a new trust system — we use the existing primary-source verification (PSV) infrastructure that hospital credentialing offices, payers, and the Joint Commission already trust, and we make those verifications portable and tamper-evident on chain.

### The existing verification authorities (we don't replace them)

For individual clinicians:

- **NPPES / NPI registry** (CMS) — every billing healthcare provider in the US has a 10-digit National Provider Identifier issued by the Centers for Medicare & Medicaid Services. Public, federal, queryable.
- **State medical boards** — issue and revoke licenses to practice. Status (active, suspended, revoked, sanctioned) is the gate. Aggregated by the **Federation of State Medical Boards (FSMB)**.
- **ABMS** (American Board of Medical Specialties) — primary source for board certification across 24 specialty boards covering ~997,000 US physicians, refreshed daily. Recognized by the Joint Commission, NCQA, and URAC as PSV-grade.
- **AOA** (American Osteopathic Association) — the equivalent for osteopathic specialty certification.
- **DEA** — controlled-substance prescribing authority.
- **Hospital privileging committees** — what specific procedures a physician is credentialed to perform at a specific facility.

For facilities (this is the part that addresses "a place that doesn't exist"):

- **CMS Certification Number (CCN)** — every Medicare-participating hospital, critical-access hospital, and emergency department has a 6-digit federally-issued facility identifier. State code embedded in the first two digits.
- **State licensure** for the facility itself (varies by state).
- **Joint Commission accreditation** for the subset of hospitals that hold it.

### How Curie binds these verifications onchain

Every actor on the network must bind their public key to one or more of these existing identifiers, with attestations that anchor back to the primary source.

**For specialists, four layers of verification that all must hold:**

1. **Identity attestation** — the specialist's onchain identity is bound to their NPI. The NPI itself is verified against NPPES at issuance. This is sybil-resistance: there are ~1.5M active NPIs, each tied to a real human at a real address with a real Social Security Number on file at CMS.
2. **License attestation** — current active license in the relevant state(s), with a freshness window (re-attested at minimum every 30 days, automatically revoked if FSMB shows the license has been suspended). Without an active license, any bid referencing the specialist is rejected at the protocol level.
3. **Capability attestation** — board certification (ABMS or AOA) for the specialty being claimed, plus, where applicable, hospital privileges for the specific procedure. A hospital bid proposing this specialist for a pediatric appendicitis case must reference a current attestation for general surgery (or pediatric surgery) and the privileges to operate at the receiving facility. The attestation includes an expiration; expired attestations are unusable.
4. **Representation attestation** — authorises a specific hospital identity to bid on the specialist's behalf. Signed by the specialist (off-chain in v0 via a UX wrapper that doesn't require gas management). Revocable in a single transaction; bids submitted by hospitals without a current representation attestation are rejected at the protocol level.

**For facilities, the same logic but anchored to the CCN:**

1. The receiving hospital's onchain identity is bound to its CMS Certification Number.
2. Facility-level attestations cover what services the hospital is certified to provide (ED, surgical, peds, ICU level, trauma designation).
3. A "place that doesn't exist" cannot get a CCN; CMS issues them through a survey and certification process that takes months and involves on-site inspection.

**For patients (when self-sovereign):** lower-stakes verification — typically a payer-issued attestation of insurance coverage. Family co-signers are linked through pre-registered relationships, not ad-hoc.

### Who runs the attestation services?

Anyone, in principle — that's the point of a public chain. In practice, the attestations that get accepted by hospital agents and patient agents are the ones issued by trusted authorities. Curie's reference implementation includes:

- **A CMS attestation oracle** that watches NPPES and the public CMS data dissemination feed, signs attestations of `(NPI, key, status, timestamp)`, and posts them onchain. NPPES is FOIA-public and downloadable; CMS doesn't need to participate for this to work, though it's better if they eventually do.
- **An ABMS / AOA attestation oracle** for board certification status. ABMS already exposes a primary-source verification API (CertiFACTS, ABMS Direct Connect) used by major credentialing platforms (Axuall, Verifiable, symplr). We sit downstream of these.
- **State-board attestation oracles** for license status. FSMB's data is the obvious aggregation point.
- **Hospital privileging attestation services** — issued by the hospital's own credentialing office, signed by their onchain identity. This is the slowest-changing layer and the most institutionally local.

The trust pattern is the same one used in the existing US healthcare system: hospitals don't independently verify a surgeon's medical school transcript every time they grant privileges — they trust the chain of attestations from primary sources. We are taking that pattern and making it cryptographically signed, time-bounded, and globally queryable, instead of being faxed PDFs and back-office databases.

### Why this is genuinely better than the status quo

Today, when a teleconsult vendor onboards a new specialist, a credentialing team spends 60–120 days running primary-source verifications, calling state boards, faxing forms. The result is a proprietary record locked inside that vendor's database. When the same specialist signs up at a second vendor, the entire process repeats. There is no portable, tamper-evident credential.

Curie's onchain attestations:

- **Are portable.** A specialist verified once is verifiable everywhere. New hospitals and vendors check signatures, not faxed transcripts.
- **Are tamper-evident.** A revoked license at the state board propagates to a revoked attestation onchain within hours, not whenever the next credentialer happens to look.
- **Are time-bounded.** No one can replay a stale attestation from 2022; agents reject expired credentials at the protocol level.
- **Are auditable.** A regulator investigating an EMTALA case can see exactly which attestations were valid at the moment a specialist accepted or declined a transfer.

> ⚠️ **Honest scope note.** None of this is itself a *medical* judgment about whether a specific specialist is the right person for a specific case. It's a check that the specialist is who they claim to be, currently licensed, currently certified, and currently privileged — the same checks a hospital credentialing office does, just continuous, portable, and machine-readable.

---

## Why blockchain — the answers to the skeptical judge

A hackathon judge will reflexively ask: *if I removed the blockchain, would this still work?* Three honest answers:

**1. Neutrality is the wedge.** The whole pitch is *no single vendor owns the panel.* Sevaro will not let TeleSpecialists' specialists claim Sevaro's hospital cases. UPMC will not let Cleveland Clinic see their on-call list and rejection rates. A centralized SaaS sits in the middle of competing health systems and competing teleconsult vendors and is rejected by all of them. A public chain is the only architecture that is credibly neutral. This is the OpenTable lesson: no restaurant chain could have built it because the value is in not being any of them.

**2. EMTALA-grade audit trail across institutional boundaries.** When a teleconsult vendor's neurologist gives advice and the patient is then transferred to a hospital with neurosurgery, the chain of who-knew-what-when crosses three EMRs and a private vendor's logs. There is no integrated, tamper-evident record of the full chain that satisfies EMTALA documentation. A blockchain settles this — every offer, every decline, every accept is permanent and queryable. A regulator investigating a specialist who's been ducking calls has a forensic record. A hospital defending an EMTALA complaint has cryptographic proof of who they offered the case to and when.

**3. Portable credentials, portable reputation.** A locum specialist's credentials and track record — accept rate, response time, complication rate — are locked inside whatever staffing platform they use. Onchain attestations make them portable across vendors and hospitals. Credentialing today is a 90-day process per institution; it does not have to be.

**Why Somnia specifically:**

- **Sub-second finality.** Stroke alerts cannot wait for consensus. The first hospital to claim a case must *know* they have it before another bid lands. Probabilistic finality is unacceptable here.
- **1M+ TPS.** Thousands of standing-rules being evaluated against every posted case across the country, in parallel, all the time.
- **EVM compatibility.** Off-the-shelf wallets and tooling for credential attestations; existing ZK and identity primitives slot in.
- **Built for agents.** Somnia's positioning as the Agentic L1 means we're targeting a chain whose other apps are designed for the same machine-speed coordination patterns we need.

---

## The 90-second live demo

A single scenario. One screen with several CurieConsole instances composed side by side: the requesting hospital's operator, two receiving hospitals' operators, the patient view, and an audit/regulator panel. The Somnia ledger ticks across the bottom. Everything below happens live and is timed against the wall clock.

### 0:00–0:10 — The trigger
Camera on the requesting-hospital console. The transfer-centre coordinator (us, on-stage; the on-call ED physician dictated the case to her seconds before) types into Curie:

> *"14yo female, RLQ pain 18hrs, WBC 16k, CT shows acute appendicitis with possible perforation. ASA III. No peds surgery on site tonight. Stable to transport, prefer transfer within 60min."*

The hospital agent translates this into a structured request: **ICD-10 K35.32, acuity tier 2, peds-surgical capability, 90mi radius, 60min window, opening bounty $1,200.**

### 0:10–0:20 — The ledger writes
The bottom-of-screen ledger ticker shows the case-request transaction landing on Somnia. **Hash committed in 0.4s.** The encrypted clinical summary lands in IPFS; the chain holds only the hash and the structured fields.

### 0:20–0:35 — Hospital agents reason out loud
Two receiving-hospital consoles light up. We expose each hospital agent's reasoning in plain text on screen so the judges can read along. Each agent's first action is a roster check against its own staff specialists, with credential and representation attestations verified on chain:

**Hospital A (40mi away):**
> *Roster check: Dr Chen on peds-surgery rotation tonight. Credentials current — NPI 1538291471, license active in IN/KY, ABMS general surgery + paeds surgery (current), privileges at this facility (current). Representation attestation valid.*
> *Standing-rule match: Dr Chen's rules accept paeds appendicitis at this acuity, in-window, bounty above floor. Calendar: prior case in OR ended 22min ago, post-op writing notes; morning elective at 6am, no overlap. Surfacing candidate bid to operator with Dr Chen as proposed specialist.*

**Hospital B (65mi away):**
> *Roster check: Dr Patel on peds-surgery rotation tonight. Credentials current. Representation attestation valid.*
> *Standing-rule match: paeds appendicitis acceptable. Conflict: Dr Patel currently in OR, case running 25min over expected. Auto-decline.*

### 0:35–0:50 — The patient agent (hospital-proxy in v0)
Patient view. The patient is 14; her father holds her co-sign rights via the registration-consent proxy held by the requesting hospital.

**Requesting hospital's agent (acting as patient proxy):**
> *Pre-authorised consent at intake: emergency surgical consult up to $5,000, in-network preferred. Hospital A: in-network. Hospital B: out-of-network (and auto-declined anyway). Consent token written under proxy authority on receipt of bid.*

The father's phone buzzes with a confirmation notification — already acknowledged, already on chain. The patient view shows what was consented on her behalf and links to the proxy attestation.

### 0:50–1:00 — Bid, claim, internal assignment
Hospital A's operator taps approve on the candidate bid; the bid transaction lands. The requesting hospital's agent confirms the claim against the only viable bidder. **Smart contract execution: 0.6s.** Bounty escrowed.

Inside Hospital A: the agent dispatches the internal assignment to Dr Chen via pager and the specialist console. Dr Chen taps accept on her phone. The losing hospital's auto-decline gets `⊘` on the case row in the regulator panel.

### 1:00–1:15 — Logistics chain
The requesting hospital's agent triggers the downstream chain: helicopter dispatch request, EMR handoff packet sent to Hospital A, anaesthesia notified, OR booked. All of these are existing systems — Curie hands them the structured packet they need.

### 1:15–1:25 — The audit trail
Pull up the audit/regulator view. Every event is there:

```
T+0.0s   Case posted by requesting hospital (0xab…)
T+0.4s   Tx confirmed
T+12s    Hospital A — reviewed, rule match, surfacing operator with Dr Chen
T+13s    Hospital B — auto-declined (OR overrun)
T+34s    Patient consent issued via proxy (scope: emergency surgical, $5000, in-network)
T+38s    Hospital A bid submitted (proposed specialist Dr Chen, attestations verified)
T+42s    Requesting hospital claim posted
T+47s    Dr Chen accepted internal assignment
T+47.6s  Tx confirmed; bounty escrowed
T+62s    Logistics handoff complete
```

This is the EMTALA record. A regulator three years from now can pull this. Every party signed their own actions; nothing was "lost in the phone system."

### 1:25–1:30 — The closer
> *"This is a 62-second total: from 'we cannot treat this here' to 'patient is en route to a confirmed accepting specialist.' Today's median is 45 minutes. There are three thousand US hospitals that can't keep specialty coverage 24/7 and ten thousand specialists who are willing to take overflow if the matching weren't broken. Curie is the protocol layer that connects them — neutral, standardised, and built for machine-speed coordination on Somnia."*

---

## Wow moments — what to engineer for

The demo lives or dies on a few specific beats. These are the bits we polish until they're sharp.

1. **The agent reasoning displayed as plain text on screen.** Most blockchain demos show JSON or contract calls. We show the agents' reasoning in English. Judges read along and *understand the system without being told.* This is the single biggest differentiator from a generic "agents on chain" demo.

2. **The wall clock vs. the status quo.** Stamp the timer prominently. Reference the 45-minute median repeatedly. The visceral gap is unforgettable.

3. **The patient agent acting in parallel.** Most healthcare demos treat consent and billing as bureaucratic afterthoughts. We make it a first-class actor (hospital-proxy in v0, self-sovereign in v1) that runs alongside the specialist matching, so the consent and in-network routing are *already done* by the time the receiving hospital claims the case. This is the part where a judge thinks "wait, this is actually missing from real telehealth today."

4. **The losing agent standing down gracefully.** Show the second receiving-hospital agent get the "claim taken" event and update its state. This signals the protocol is real, not a happy-path script.

5. **The audit trail at the end.** Pull up the ledger as a forensic record. Mention EMTALA and $50k fines. This is the moment the medical-domain judge nods.

6. **The honest constraint: PHI never touches the chain.** Mention this explicitly. Judges with healthcare backgrounds are watching for whether we understand HIPAA. The on-chain/off-chain separation is the slide that signals competence.

7. **The credential check, visible.** Before either receiving hospital's agent even surfaces a candidate bid, it verifies NPI, state license, board certification, hospital privileges, and the specialist's representation attestation from onchain attestations. This pre-empts the "what stops a bad actor from joining and accepting patients" question — judges see the check happen rather than having to take our word for it.

---

## What we are *not* claiming

A short list of the things we won't oversell — included here because surviving Q&A is half the battle:

- We are not a clinical decision-making system. The agents triage *availability and consent*, not medical correctness.
- We do not replace credentialing bodies. We use their attestations as inputs.
- We do not replace teleconsult vendors. They can plug into the protocol — their specialists become routable alongside independent locums and hospital-employed specialists, represented by a staffing-org or hospital identity. They lose the closed-panel monopoly but gain access to the entire network.
- We do not store PHI on chain. Ever.
- We do not require every specialist to manage a wallet, gas, or chain transactions in v0. Hospitals (and staffing orgs for locums) bid on specialists' behalf using their representation attestations. Direct specialist participation is v1.
- We do not require patients to install a Curie app in v0. Hospitals act as patient proxy under the same registration consent they already collect. Self-sovereign patient agents are v1, with MyChart-style and payer-app integrations as plausible hosts.
- We are not a v1-ready production system. We are a working prototype demonstrating the protocol, with a credible path to clinical pilot.

---

## First 100 users — the go-to-market

Not part of the live demo, but the slide judges will ask about.

- **Beachhead: critical-access hospitals (CAHs) in states with mature community-call frameworks.** ~1,300 CAHs in the US, average ~25 beds, structurally cannot keep 24/7 specialty coverage. They are the most pain-aware buyers and the most regulator-exposed.
- **Specialist supply: independent locum tenens specialists who currently use one or two staffing platforms.** ~50,000+ active locums. We give them a portable reputation and per-case income that doesn't require an agency taking 30%.
- **Teleconsult vendors as channel partners, not competitors.** A vendor that integrates with Curie gets overflow access when their own panel is saturated. They go from monopoly inside their contracts to network effects across the country.
- **Regulatory tailwind.** [CMS's 2024 prior auth rule](https://www.cms.gov/newsroom/press-releases/cms-finalizes-rule-expand-access-health-information-and-improve-prior-authorization-process) and the [community-call provisions](https://www.vonbriesen.com/legal-news/1909/cms-reverses-course-for-the-emtala-obligations-of-hospitals-with-specialized-care-and-eases-the-burdens-of-on-call-coverage) are pushing in our direction. We do not need to invent the regulatory category — CMS already did.

---

## The team ask

What we want from a sponsor / investor / prize judge is straightforward: a path to a clinical pilot at one critical-access hospital and one regional medical center, with three to five participating specialists. Six weeks, real cases, instrumented end-to-end. We bring the protocol; they bring the patients and the EMTALA exposure.

If the prize from this hackathon is funding, the funding goes here. If the prize is a hire, we'd like to be hired by the team building Somnia's healthcare vertical.

---

*Curie. Because the right specialist shouldn't be a phone tree.*
