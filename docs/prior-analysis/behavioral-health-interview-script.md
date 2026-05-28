# Behavioral Health Discovery Interview Script

> **Purpose:** 30-minute discovery interview with a small private behavioral health / ADHD outpatient practice owner.
> This is **discovery, not a sales call.** The interviewer is validating the friction story behind [[ROADMAP]] (Curie Claims Protocol MVP-1) — small specialty practices, F-code-heavy claim mix — and the broader thesis in [[VISION]] / [[PRODUCT]].
>
> **Mode:** listen. The interviewee should be talking ~80% of the time.
>
> **Hard rules:**
> - Do **not** pitch. Do **not** describe the product unless asked at the very end, and even then keep it to two sentences.
> - Do **not** use the word "blockchain." If they use it, mirror it back; otherwise stay in the language of "settlement," "audit trail," or "shared record."
> - Do **not** assume RCM jargon. Mirror their vocabulary. If they say "superbill" use "superbill"; if they say "claim" use "claim."
> - Behavioral-health solo/small practices often do their own billing. Don't presume a billing department exists.
> - If the answer to a probing question is obvious from a previous answer, **skip it.** Don't run the script for its own sake.
>
> **Recording:** ask permission at the top. If declined, take notes in the same structure as this script.
> **Companion docs:** [[medical-doctor-interview]] (prior interview with a different specialty), [[payer-architecture]] (payer-side ownership reference), [[research-questions]] (open questions this interview may resolve).

---

## 0. Before the interview (interviewer prep, 5 min)

- Confirm the interviewee's role: are they the owner-clinician, the practice manager, or both?
- Confirm rough size: number of providers, approximate weekly visit volume, in-network vs. cash-pay mix if known.
- Have a one-line non-pitch ready in case they ask "what are you building?" — e.g., *"I'm exploring whether AI agents could handle the back-and-forth between small specialty practices and payers more cleanly than what exists today. I'm in the listening phase, not selling anything."*
- Open a blank notes doc with the four friction buckets pre-headed: **workflow**, **denials**, **cash flow**, **payer pain.**

---

## 1. Warm-up — 2 minutes

**Goal:** establish rapport, set expectations, get permission to record, calibrate jargon level.

**Primary question:**
> "Thanks for making time. Before I ask anything specific — can you walk me through what a typical week looks like for you and the practice right now? How many providers, what kinds of patients, how busy are you?"

**Probing follow-ups (use only if they give a short answer):**
- "Is it just you, or do you have other clinicians and admin staff?"
- "Are you mostly in-network with commercial payers, or do you take cash-pay / sliding scale too?"
- "Do you take any Medicaid or Medicare patients?"

**Listen for:**
- **Size signal** — solo vs. group, W-2 clinicians vs. 1099. MVP-1 target is 1–10 providers.
- **Payer mix signal** — heavy commercial = MHPAEA parity territory; heavy Medicaid managed care = different denial profile; cash-pay-only = **not a fit, note it.**
- **Jargon level** — do they say "CPT," "ICD-10," "EAP," "CMS-1500," or do they say "the form," "the codes"? Mirror their level.
- **Operator vs. delegator** — do they sound like they handle billing themselves, or do they refer to "my biller" / "the billing service"?

**Transition line:** *"Great, that helps. I want to spend most of our time on the unglamorous middle — billing, codes, payers. Mind if we go there?"*

---

## 2. Current state — 10 minutes

**Goal:** map the current billing workflow end-to-end without leading. Who codes? What tools? Where do claims go?

### 2a. Primary question — workflow

> "Walk me through what happens after you see a patient — from the moment the session ends to the moment the money shows up in the bank account. Who does what, and what tools are involved?"

**Probing follow-ups:**
- "Who actually picks the ICD-10 code and the CPT code? Is that you, or someone else?" (only if not already clear)
- "Where does the claim physically go after it leaves your system? Do you submit directly, through a clearinghouse, through your EHR?"
- "If something needs a correction, who catches it — you, the EHR, the clearinghouse, the payer?"

**Listen for:**
- **Who codes:** owner-clinician (most common in small BH), part-time biller, outsourced billing service (e.g., a percentage-of-collections shop), or EHR-included billing.
- **EHR / PM system:** SimplePractice, TheraNest, TherapyNotes, Tebra (formerly Kareo), AdvancedMD, athenahealth, Valant, ICANotes. **TherapyNotes / SimplePractice / Valant are BH-specific signals** and matter a lot for our positioning.
- **Clearinghouse exposure:** do they know what a clearinghouse is? Do they name Change Healthcare / Optum, Availity, Office Ally, Trizetto? Awareness of the 2024 Change Healthcare outage is a strong sophistication signal.
- **Manual steps:** copy-paste between systems, paper superbills, faxed appeals — every one is friction.

### 2b. Primary question — coding overhead

> "How long does a typical claim take from end of session to submission, and how much of that is your time versus someone else's?"

**Probing follow-ups:**
- "Are there sessions where you're not sure what code to use? What do you do in that case?"
- "Do you ever have to bill add-on codes — like the interactive complexity add-on, or prolonged-service codes — and how does that go?"
- "If you outsource billing, what does that cost you — a percentage of collections, per-claim, monthly?"

**Listen for:**
- **Time per claim:** behavioral-health claims are usually simple (90791 intake, 90834/90837 therapy, 99214 med management for ADHD). If they say "a few minutes" — that's the baseline our automation has to beat. If they say "I batch them on Friday for two hours" — that's the wedge.
- **Cost per claim:** outsourced billers typically run 4–8% of collections, sometimes flat per-claim. If they say "$1/claim" — **red flag, see red flags section.**
- **Coding ambiguity:** ADHD (F90.x), MDD (F32.x / F33.x), GAD (F41.1), adjustment disorders (F43.x) — listen for whether they ever struggle to pick the right specifier.
- **Add-on / E/M complexity:** prescribers doing ADHD med management are billing 99213/99214 plus sometimes 90833 (psychotherapy add-on) — this is denial-prone territory.

### 2c. Transition

*"Okay — that gives me a picture of the happy path. I want to spend the next chunk on what goes wrong."*

---

## 3. Specific friction — 10 minutes

**Goal:** quantify pain. Denials, cash flow, payer-specific behavior, parity / medical-necessity disputes.

### 3a. Primary question — denials

> "When a claim doesn't pay on the first pass — what does that usually look like? What are the most common reasons you see?"

**Probing follow-ups:**
- "Roughly what percentage of claims come back with a problem — denied, underpaid, or pended for more info?"
- "Have you ever had a payer deny a session because they said it wasn't medically necessary, or because the patient had used too many sessions?"
- "When you appeal, who writes the appeal letter, and how often does the appeal actually overturn the denial?"

**Listen for:**
- **Denial rate:** small BH practices often quote 5–15%. The CAQH 2024 Index pegs national first-pass denial around 11–12% (see [[coding-market-size-and-denial-losses]]). Higher than that = strong signal; lower = either very clean panel or under-tracking.
- **Denial reasons:** code-mismatch / missing modifier (boring but common), **medical-necessity denials** (MHPAEA parity gold), **session-limit / visit-cap denials** (also parity territory), credentialing-lapse denials, eligibility / coverage-changed denials.
- **MHPAEA tells:** "they said the patient had used their sessions" / "they wanted a treatment plan" / "they required prior auth for therapy but not for primary care" — these are the parity-violation patterns. Don't volunteer the term "MHPAEA"; let them describe the experience.
- **Appeal burden:** if appeals are written by the clinician themselves, that's expensive professional time. If appeals are skipped because "it's not worth the hour" — that's silent leakage worth quantifying.

### 3b. Primary question — cash flow

> "From the day you see the patient to the day that money actually lands in the practice account — what's that timeline look like on a good claim? And on a bad one?"

**Probing follow-ups:**
- "Has cash flow from claims ever caused you a real problem — like delaying payroll, delaying paying yourself, or making you reconsider taking insurance at all?"
- "Do you carry a line of credit, factor receivables, or have a buffer to ride out slow payers?"
- "Are there specific payers where you basically expect to wait 60+ days?"

**Listen for:**
- **Days to payment (DTP):** clean electronic claims to commercial payers should pay in 14–30 days. Medicaid managed care often runs 30–60+. Anything quoted at 60+ days as routine is significant.
- **Existential cash-flow stress:** "I almost couldn't make payroll" / "I considered going cash-pay-only" are gold quotes — they validate the ROI ceiling.
- **Coping mechanisms:** lines of credit, personal guarantees, going cash-pay for some services, dropping a payer. Each one is a tax we could relieve.

### 3c. Primary question — payer pain

> "If you had to name the one or two payers that cause you the most grief — not necessarily the lowest rates, but the most operational pain — who are they and why?"

**Probing follow-ups:**
- "Anyone you've dropped from your panel because dealing with them wasn't worth it?"
- "What's your cash-pay percentage, and is that going up or down?"
- "Anyone on Medicaid managed care — and if so, which MCO?"

**Listen for:**
- **Named payers:** behavioral-health small-practice pain often clusters around Optum / United Behavioral Health (sheer size + Optum carve-outs), Anthem/Elevance BH, Magellan, Beacon (now Carelon), Cigna/Evernorth BH. State Medicaid MCOs vary wildly.
- **Carve-out awareness:** do they know their commercial payer's behavioral health is carved out to Optum / Carelon / etc.? This is a sophistication tell and matters for [[payer-architecture]].
- **Cash-pay drift:** rising cash-pay % is a "I'm giving up on insurance" signal — strong validation of the underlying pain, but also a sign they may eventually exit our addressable market.
- **Dropped panels:** which payer did they drop and why? This is the strongest possible signal of unsolved friction.

### 3d. (Optional, only if time) parity-specific probe

> "Have you ever felt like you had to fight harder for a behavioral health claim than you would have for a physical health claim — for the same patient, same plan?"

**Listen for:** unprompted description of MHPAEA-violation patterns: NQTL disparities (prior auth, concurrent review, medical-necessity criteria) applied to BH but not to med/surg.

---

## 4. Openness to change — 5 minutes

**Goal:** test appetite for new tools, AI, and (only if they raise it) novel settlement mechanisms.

### 4a. Primary question — what they've tried

> "Have you tried — or seriously evaluated — any tools that promised to make this part of the practice easier? AI-driven coding, automated denial management, anything like that? What happened?"

**Probing follow-ups:**
- "Has anyone in your peer network — other small practice owners — found something that actually works?"
- "When a new vendor pitches you, what's the first thing that makes you tune out?"
- "Have you ever used ChatGPT or a similar AI tool for anything in the practice — notes, letters, anything?"

**Listen for:**
- **Specific products tried:** SimplePractice's AI scribe, TherapyNotes' billing module, third-party AI coders (Fathom, CodaMetrix — though those are more inpatient/hospital), DeepScribe, Heidi, Freed. RCM-side: Tebra, Kareo, AdvancedMD billing modules.
- **AI sentiment:** are they curious, burned-out-on-hype, scared of HIPAA risk, or already using ChatGPT informally (a HIPAA red flag they may not realize)?
- **Decision-maker behavior:** do they evaluate vendors themselves, ask a peer group, hire a consultant? Solo owners often buy on peer recommendation — implies channel strategy.

### 4b. Primary question — what would tempt them

> "If a tool existed that could meaningfully reduce the time you spend on billing and the rate at which claims come back denied — what would it have to look like for you to even pilot it? What would make you immediately say no?"

**Probing follow-ups:**
- "Would you trust an AI to pick the diagnosis code, if you reviewed before submission? What about without review?"
- "What's a price that would feel like a no-brainer vs. a price that would make you walk away?"
- "Who else would have to sign off — a partner, a biller, a compliance person?"

**Listen for:**
- **Trust ceiling on AI:** "I'd trust it if I reviewed everything" is normal; "I'd trust it on autopilot" is rare and probably overconfident. We're designing for human-in-the-loop.
- **Price anchor:** behavioral-health small practices are price-sensitive. Anchor: outsourced billing at 4–8% of collections = roughly $40–$120 per visit on a $150–$200 commercial therapy claim. Anything credibly better than that is interesting.
- **Deal-breakers:** "if it doesn't integrate with TherapyNotes," "if my biller has to learn a new system," "if it touches my notes," "if it's not HIPAA-compliant on day one."
- **Surfaced novel concepts (let them lead):** if they bring up "blockchain," "smart contracts," "crypto," "tokens," "Web3" — mirror neutrally ("interesting, what makes you bring that up?") and document. Otherwise **do not introduce these terms.**

### 4c. Compliance burden (squeeze in if time, otherwise move to wrap)

> "When a new vendor wants to touch any patient data, what does the compliance side of that look like for you — BAAs, security review, anything?"

**Listen for:**
- **BAA fluency:** do they know what a BAA is? Have they signed many? Have they ever **refused** to sign one with a vendor and why?
- **Recent audits / breaches:** any HIPAA incident, OCR letter, state audit, payer audit? Strong context for risk tolerance.
- **Blocked vendors:** is there anything they wanted to use but couldn't because of compliance? That's our exact failure mode to avoid.

---

## 5. Wrap — 3 minutes

**Goal:** pilot interest, what would make them say no, referrals, follow-up artifacts.

### 5a. Primary question — pilot interest

> "If, hypothetically, I came back to you in a few months with something to try — would you be open to piloting it on a small slice of your claims? What would you need to see before you'd say yes — and what would make you say no on the spot?"

**Probing follow-ups:**
- "Who else in your peer group should I be talking to? Anyone running a similar practice who's especially vocal about billing pain?"
- "Would you be willing to share a redacted EOB, a denial letter, or an appeal you've written — just so I can study the actual shape of these documents?"
- "Can I come back in a few weeks with follow-up questions as my thinking sharpens?"

**Listen for:**
- **Pilot conditions:** typically "low risk to my current workflow," "doesn't touch live claims at first," "you indemnify me," "free or near-free for the pilot." All reasonable.
- **Network effect:** if they offer 2+ referrals unprompted, that's a strong signal this person is a future design partner / early evangelist.
- **Artifact access:** if they offer to share a redacted EOB or denial letter — **say yes immediately and follow up the same day.** These documents are gold for spec work.

### 5b. Closing

> "Thank you — this was incredibly useful. I want to be clear I'm not asking you to buy anything; I'm trying to understand the problem before I touch the solution. If I do build something I think you'd benefit from, I'll come back and ask. Anything you want to ask me before we wrap?"

If they ask "so what are you building?" — give the prepared one-liner from section 0. **Two sentences max.** Do not say "blockchain." If they ask follow-ups, answer briefly and steer back to thanking them.

---

## Compressed 5-question version (if running short)

If the conversation runs long earlier and you have <10 minutes left, collapse to these:

1. *(Workflow + coding)* "Who picks the codes and submits the claims, and what system do they live in?"
2. *(Denials)* "Roughly what share of your claims come back with a problem, and what's the most common reason?"
3. *(Cash flow)* "From session to money-in-the-bank, what's the timeline — and has it ever caused a real problem?"
4. *(Payer pain)* "Which one or two payers cause the most grief, and have you ever dropped one because of it?"
5. *(Appetite)* "If a tool could materially reduce that pain, what would it have to look like — and what would make you say no?"

---

## Red flags — answers that would invalidate the hypothesis

If you hear any of these clearly, **the MVP-1 segment hypothesis is wrong for this practice** (and possibly the cohort). Note them honestly; do not rationalize.

- **"We basically have no denials — under 2%."** Either they're a unicorn or under-tracking, but in either case the ROI on denial reduction collapses for them.
- **"Our outsourced biller charges us $1 per claim and handles everything."** That's below our automated cost floor; we cannot compete on price for that practice.
- **"We're 100% cash-pay" / "We're dropping insurance entirely next quarter."** Out of segment. Note as anti-signal for in-network thesis.
- **"Cash flow has never been an issue. We get paid in 14 days on everything."** The wedge in [[ROADMAP]] is partly cash-flow compression; if that's not pain, the value prop is thinner.
- **"I love our EHR's billing module, I would never switch or add anything that touches it."** Distribution risk — the EHR is the moat, and we'd have to integrate, not displace.
- **"My biller is my spouse / sibling / best friend and they love doing it."** Decision-making is emotional, not economic; segment is unwinnable regardless of product quality.
- **"We've tried AI tools and none of them worked / we don't trust AI for clinical decisions, full stop."** Not necessarily disqualifying, but a much longer sales cycle and possibly the wrong early adopter.
- **They surface "blockchain" unprompted and recoil ("ugh, crypto scam stuff").** Doesn't kill the product — we don't need them to like the substrate — but it means the marketing surface cannot mention it, ever, for this segment.
- **MHPAEA-style parity denials are not a thing in their experience.** That weakens one of our strongest narrative wedges; revisit whether parity should anchor the pitch or just be a tailwind.

---

## Follow-up artifacts to request

Ask gently at the end, framed as "would help me understand the actual paperwork." Each one materially sharpens [[PROTOTYPE_SPEC]] / [[ROADMAP]] work:

1. **A redacted EOB (Explanation of Benefits / 835)** from a routine paid claim and from a denied claim. Highest priority — shows exact denial codes (CARC/RARC) and adjustment groups.
2. **A denial / appeal letter pair** — what the payer sent, what the practice wrote back. Shows the language battle and the time cost.
3. **A redacted CMS-1500 or the equivalent screen in their PM system** for a typical visit. Shows which fields they actually populate.
4. **A screenshot of their EHR's billing dashboard** (denial rate, A/R aging buckets, days-to-payment) — anything they're willing to share. Confirms self-reported numbers.
5. **Their fee schedule or a recent contract with their top-pain payer** (almost certainly will not share, but worth asking — informs settlement-amount modeling).
6. **A list of which payers they're in-network with**, even at the brand level (not contract terms). Maps to [[payer-architecture]].
7. **An introduction to their biller** (if they outsource) — the biller is the actual day-to-day user we'd be designing for in many cases.

Log everything received into `docs/raw/new/` with the date and the practice anonymized.

---

## Post-interview checklist (interviewer, 15 min after)

- [ ] Dump raw notes into `docs/raw/new/behavioral-health-interview-<date>-<anonymized-id>.md` within 24 hours, while memory is fresh.
- [ ] Score the practice against the MVP-1 segment fit: providers, payer mix, denial rate, EHR, BH-specific?
- [ ] Extract 3–5 verbatim quotes worth using in [[ROADMAP]] / [[PRODUCT]] (with permission to anonymize).
- [ ] Update [[research-questions]] with any new open questions surfaced.
- [ ] If artifacts were promised, send the follow-up email **same day** with a one-line reminder.
- [ ] If they offered referrals, send intro requests within 48 hours.
- [ ] Decide: is this person a future design partner, a one-time data point, or out-of-segment? Note in `docs/raw/new/`.

---

**See also** — historical discovery script. For the current domain background that motivates segment selection see [[../research/medical-coding-domain|medical-coding-domain]] and [[../research/topics/corti|Corti hub]].
