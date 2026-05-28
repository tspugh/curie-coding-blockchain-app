# Curie Negotiation Protocol — Motivation & Pitch

*Companion to **SPEC-0001** (the build spec lives in the application repo:
`curie-coding-blockchain-app/docs/specs/0001-mvp0-coverage-negotiation.md`). This doc is
the **why** — the problem, the value proposition, and the presentation narrative. Every
quantitative claim carries a source (per the repo's no-unsourced-claims rule); see
**Sourcing notes** for figures still pending a primary citation.*

Status: Draft · Date: 2026-05-27 · Owner: tspugh

---

## Thesis (the 30-second version)

> Drug-coverage and reimbursement disputes are decided **unilaterally by payers** through
> **opaque logic** that denies a meaningful fraction of claims, is **almost never
> appealed**, and is **overturned ~82% of the time when it is** — a system that works by
> exhausting clinicians and patients into giving up. **Curie** replaces that with an
> **impartial AI arbiter** that sets the *covered amount* grounded in **public** drug-price
> benchmarks (NADAC, Mark Cuban Cost Plus, Medicare Part D), records the decision and its
> reasoning on a **tamper-evident ledger neither party controls**, and gives both sides a
> **bounded appeal** — turning an opaque, one-sided adjudication into a neutral,
> auditable, asynchronous negotiation. **PHI never goes on-chain.**

---

## 1. The problem: prior authorization is a broken, distrusted, one-sided process

**It's a massive clinician-time sink.** US physicians complete ~**39 PA requests per week**
and spend ~**13 hours/week** on PA ([AMA 2025 survey](https://www.ama-assn.org/practice-management/prior-authorization/fixing-prior-auth-nearly-40-prior-authorizations-week-way));
**89%** say it drives burnout ([AMA 2024](https://www.ama-assn.org/press-center/ama-press-releases/ama-survey-indicates-prior-authorization-wreaks-havoc-patient-care)).

**The administrative cost is enormous.** The US spends ~**$1T/year (~25% of health spend)
on administration**, with ~**$266B/year** of billing-and-insurance-related waste ([JAMA 2019, Shrank et al. — via ACDIS](https://acdis.org/articles/news-roughly-25-healthcare-money-used-billing-process-jama-study-finds); [Center for American Progress](https://www.americanprogress.org/article/excess-administrative-costs-burden-u-s-health-care-system/)).
A single PA transaction costs providers **$10.97 manual** vs **$5.79 electronic** (specialists up to **$15.12**), with ~**$20B/yr** of automation savings still on the table ([2023 CAQH Index](https://www.caqh.org/hubfs/43908627/drupal/2024-01/2023_CAQH_Index_Report.pdf)).

**The denials are frequent — and unreliable.** In Medicare Advantage, insurers made nearly
**50M PA determinations in 2023**, denying **6.4%**; only **11.7%** of denials were
appealed, but **81.7% of appeals were overturned** ([KFF, Jan 2025](https://www.kff.org/medicare/nearly-50-million-prior-authorization-requests-were-sent-to-medicare-advantage-insurers-in-2023/)).
On HealthCare.gov, insurers **denied ~19–20% of in-network claims** (insurer rates ranged
**1%–54%**), and consumers appealed **<1%** ([KFF, Jan 2025](https://www.kff.org/private-insurance/healthcare-gov-insurers-denied-nearly-1-in-5-in-network-claims-in-2023-but-information-about-reasons-is-limited-in-public-data/)).

> **The killer stat:** denials are *rarely challenged* yet *usually wrong when challenged*.
> The adjudication itself is unreliable, and the status quo depends on people giving up.

**It harms patients.** Per [AMA 2024](https://www.ama-assn.org/press-center/ama-press-releases/ama-survey-indicates-prior-authorization-wreaks-havoc-patient-care):
**94%** of physicians say PA delays care, **78%** say it causes patients to **abandon
treatment**, and **24%** report PA led to a **serious adverse event**.

## 2. Why incumbents don't fix it

Electronic prior auth (CoverMyMeds, NCPDP SCRIPT / Surescripts) speeds *transmission* of a
request — but **nearly half of PAs still fall back to fax/phone**, ePA covers
pharmacy-benefit (not most medical-benefit) drugs, and critically it's **plumbing for a
payer-controlled decision**: the payer still adjudicates unilaterally against private
criteria ([IntuitionLabs on NCPDP SCRIPT ePA](https://intuitionlabs.ai/articles/ncpdp-script-epa-surescripts)).
The opacity is structural: in the regulator's own data, **"Other" is the single most common
denial reason at 34%** — even the government can't tell you *why* a fifth of claims were
denied ([KFF 2023](https://www.kff.org/private-insurance/healthcare-gov-insurers-denied-nearly-1-in-5-in-network-claims-in-2023-but-information-about-reasons-is-limited-in-public-data/)).

| Capability | ePA / payer portals | Curie |
|---|---|---|
| Neutral between adversarial parties | ✗ payer owns the logic | ✓ impartial arbiter agent |
| Shared tamper-evident audit trail | ✗ payer's internal logs | ✓ on-chain commitment |
| Agent-to-agent automation | partial (form transmission) | ✓ provider ↔ arbiter ↔ payer |
| Grounded in a *public* price benchmark | ✗ private formulary | ✓ NADAC / Cost Plus / Part D |
| Programmable settlement of the amount | ✗ separate remittance cycle | ✓ (future) tied to the decision |
| Inspectable reasoning | ✗ opaque ("Other" = 34%) | ✓ reasoning vs. an immutable record |

## 3. Why a neutral *public* price benchmark matters

The disputed quantity — "what is this drug worth / what should be covered" — has **no
shared reference point** today. And the spread is enormous: generic cash-price **coefficient
of variation is 43% (61% for neuropsychiatric)**, with a **3.7× average** and up to a
**54.7× high-to-low** range for the same molecule ([Hauptman et al., *PLoS One* 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6860932/)).
Medicare could have **saved ~$3.6B in one year on just 77 generics** at Cost Plus prices
([Lalani et al., *Annals* 2022 — via Fortune/USC](https://fortune.com/2022/06/21/medicare-costs-compared-mark-cubans-pharmacy/)).
**NADAC** (CMS's survey of what pharmacies actually pay, [Medicaid.gov](https://www.medicaid.gov/medicaid/nadac))
and **Cost Plus** (transparent cost + 15% + fees) give an impartial agent a **public,
defensible price floor** to ground its decision in. The dispersion *is* the proof a neutral
benchmark is needed.

## 4. What Curie does (the spec, in brief)

A provider-side PA or revenue-cycle workflow **files a claim** — drug + a
**de-identified** clinical note (necessity justification, stored off-chain; only its hash
on-chain) + the **billed amount** — against a named **insurer** and its policy. The
payer-side UM workflow submits the **amount it would allow** when the case reaches that
queue. With both positions in, the contract fires a **native Somnia AI agent** that acts
as an **arbiter**: it reasons over the de-identified note + the public benchmarks and
returns a **covered amount** (an integer; `0` = denied) plus a reasoning commitment. Both
parties **accept** or **appeal** (structured: direction + coded reason + a hashed doc);
each appeal **re-fires the agent**, which recomputes — the amount and reasoning
**visibly evolve**. When **both accept**, the claim **settles** at that amount (an event
marker in v0), with the agent fee **split 50/50**. If they can't agree within **N
rounds**, it ends **`Deadlocked`**.

Hard invariants: **no PHI on-chain or in the agent payload** (only hashes, refs, amounts,
state); **wallet-gated** so only the two named parties can act while anyone can *view*; runs
in both a **simulated** (no-funds dev) and **real** (testnet) wallet mode. Full requirements,
state machine, and test cases: **SPEC-0001** in the app repo (`tspugh/curie-coding-blockchain-app`).

## 5. Why blockchain / Somnia specifically

A normal SaaS arbiter **re-introduces the trust problem** — whoever runs the server controls
the logs and the logic, and a payer won't trust a provider-run service (or vice-versa). The
properties that matter are intrinsic to a public chain:
- **Trust minimization between adversaries** — no counterparty (nor the operator) can
  silently alter the rules, inputs, or outcome.
- **Immutable, independently-verifiable audit trail** — exactly what an appeals body or
  regulator needs.
- **Programmable, atomic settlement** — the decision and the payment can bind in one
  verifiable transaction, collapsing the costly separate remittance cycle.

**Why Somnia:** its **Agentic L1** runs the AI arbiter as a **native, validator-executed,
consensus-verified** primitive — inference runs deterministically so validators agree on a
byte-identical output, and the JSON-API agent can pull NADAC/Cost Plus into the same verified
flow ([Somnia "Building on the Agentic L1"](https://blog.somnia.network/p/building-on-the-agentic-l1-a-developers)).
The arbiter's output is **trustable on-chain by construction**, not because a vendor promises it.

> **Honest limitation (we say this in the deck):** native on-chain agent execution is
> **publicly visible** — inputs/reasoning passed to validators are not private. So **PHI must
> never go on-chain**; v0 sends only a **de-identified** extract and runs on **synthetic**
> data. Real-PHI de-identification and **private/tiered on-chain reasoning are v1 — and a
> concrete ask of the Somnia platform.** This is a hard constraint, and it intersects with
> HIPAA (see risks).

## 6. The pitch & the beachhead

**Beachhead: generic-drug reimbursement-amount disputes** (not coverage yes/no for novel
biologics). It's the sharpest wedge because:
- A **public, defensible benchmark already exists** (NADAC + Cost Plus) for the ~90% of
  prescriptions that are generic — the arbiter has hard ground truth.
- The **money is real and provable** (3.7–54.7× dispersion; $3.6B Medicare overpayment).
- It **sidesteps subjective medical-necessity calls**, keeping decisions auditable and grounded.

## 7. Risks we pre-empt

1. **"Payers have no incentive to submit to a neutral arbiter."** *The* central GTM risk —
   denials are a margin lever, and the 82% overturn rate suggests the status quo benefits
   whoever controls the decision. Counters: regulatory tailwind (CMS interoperability/PA
   rules, state PA reform — [AMA](https://www.ama-assn.org/press-center/ama-press-releases/ama-survey-prior-authorization-reform-pledge-falls-short-physicians)); payers' own admin cost; and a likely **provider-pull / Medicaid / employer-plan** entry that *wants* the NADAC benchmark, rather than commercial-payer-pull. Be honest that voluntary commercial adoption is unproven.
2. **HIPAA / re-identification.** The justification text sent to the public on-chain LLM is
   the exposure surface; de-identification must meet Safe Harbor / Expert Determination and
   needs legal review. Hash-only-on-chain helps but isn't sufficient alone.
3. **Adoption friction.** Providers live in EHR + ePA workflows; a new on-chain rail is yet
   another integration in an industry that's still ~half fax/phone for PA.
4. **Arbiter legitimacy / liability.** Deterministic consensus guarantees the *same* output,
   not a *correct* or legally-binding one. Framing it as a **benchmark-grounded recommendation
   + audit layer** (not binding adjudication) is safer initially.
5. **Transparent reasoning is gameable.** On-chain logic can be reverse-engineered to game inputs.
6. **Benchmark limits.** NADAC/Cost Plus cover generics well but **not most cold-chain
   injectables/insulin or novel branded biologics** — ground truth shrinks exactly where
   disputes are most expensive.

---

## Sourcing notes (upgrade before any external/published use)

Per the repo's no-unsourced-claims rule, these figures are cited via **secondary** sources and
should be swapped for the **primary** before this leaves the team:
- **$266B / "25% of spend"** — primary is *JAMA* 2019 (Shrank et al.); cited here via ACDIS / CAP (JAMA paywalled). Pull the DOI.
- **$3.6B Medicare/Cost Plus on 77 generics** — primary is *Annals of Internal Medicine* 2022 (Lalani et al.); cited here via Fortune/USC. Substitute the Annals citation.
- **AMA survey vintages** — 2024 (43 PAs/~12 hrs) vs 2025 (39 PAs/~13 hrs); cite the year explicitly.
- **MA figures** — 81.7% overturn is the 2019–2023 cumulative rate; 11.7% is the 2023 appeal rate; don't conflate.

## Bibliography

- AMA, *2025 Prior Authorization Physician Survey*. https://www.ama-assn.org/practice-management/prior-authorization/fixing-prior-auth-nearly-40-prior-authorizations-week-way
- AMA press release, June 2024. https://www.ama-assn.org/press-center/ama-press-releases/ama-survey-indicates-prior-authorization-wreaks-havoc-patient-care
- AMA — PA reform pledge falls short. https://www.ama-assn.org/press-center/ama-press-releases/ama-survey-prior-authorization-reform-pledge-falls-short-physicians
- CAQH, *2023 CAQH Index Report*. https://www.caqh.org/hubfs/43908627/drupal/2024-01/2023_CAQH_Index_Report.pdf
- JAMA 2019 (Shrank et al.) admin waste — via ACDIS https://acdis.org/articles/news-roughly-25-healthcare-money-used-billing-process-jama-study-finds ; CAP https://www.americanprogress.org/article/excess-administrative-costs-burden-u-s-health-care-system/
- KFF, Jan 2025 — Medicare Advantage PA 2023. https://www.kff.org/medicare/nearly-50-million-prior-authorization-requests-were-sent-to-medicare-advantage-insurers-in-2023/
- KFF, Jan 2025 — HealthCare.gov claim denials 2023. https://www.kff.org/private-insurance/healthcare-gov-insurers-denied-nearly-1-in-5-in-network-claims-in-2023-but-information-about-reasons-is-limited-in-public-data/
- Hauptman et al., *PLoS One* 2019 — generic price dispersion. https://pmc.ncbi.nlm.nih.gov/articles/PMC6860932/
- Lalani et al., *Annals* 2022 — Cost Plus vs Medicare — via Fortune https://fortune.com/2022/06/21/medicare-costs-compared-mark-cubans-pharmacy/ ; USC Schaeffer https://schaeffer.usc.edu/research/u-s-consumers-overpay-for-generic-drugs/
- CMS / Medicaid — NADAC. https://www.medicaid.gov/medicaid/nadac
- CoverMyMeds — What is ePA. https://www.covermymeds.com/main/support/general/what-is-electronic-prior-authorization/
- IntuitionLabs — NCPDP SCRIPT / Surescripts ePA. https://intuitionlabs.ai/articles/ncpdp-script-epa-surescripts
- Somnia — Building on the Agentic L1. https://blog.somnia.network/p/building-on-the-agentic-l1-a-developers ; docs https://docs.somnia.network/agents
