# Drug Coverage-Exception Process — Real-World Grounding

Domain reference for [A-0003](../amendments/0003-ai-mediated-drug-coverage-exception-arbitration.md).
Imported from the outer spec repo (PM portfolio research, 2026-05-26) with a human in the loop
per the cross-repo policy. No PHI on-chain; only de-identified/synthetic notes, public
references, hashes, rulings, and settlement.

---

## How drug coverage / prior-auth / exception actually works

### Finding 1: The request is a "coverage determination"; an "exception" is a kind of it

In Medicare Part D, the patient/prescriber/pharmacy asks the plan for a **coverage
determination**. An **exception** is a coverage determination that asks the plan to (a) cover
a **non-formulary** drug, or (b) **waive a utilization-management rule** — step therapy,
prior authorization, or a quantity limit — for a formulary drug. A standard "Model Coverage
Determination Request" form exists.
— [CMS: Exceptions](https://www.cms.gov/medicare/appeals-grievances/prescription-drug/exceptions); [Medicare: Drug plan rules](https://www.medicare.gov/health-drug-plans/part-d/what-drug-plans-cover/plan-rules)

### Finding 2: The pivotal evidence is the prescriber's supporting statement

For an exception, **the prescriber must provide a supporting statement** giving the medical
reason — e.g., that other formulary drugs would be ineffective or harmful for the patient.
This statement is the heart of the back-and-forth, and it is inherently **patient-specific
(PHI)**.
— [CMS: Exceptions](https://www.cms.gov/medicare/appeals-grievances/prescription-drug/exceptions)

### Finding 3: Decision timelines are hours-to-days

Standard Part D coverage decisions: **72 hours**; expedited: **24 hours**. Commercial
peer-to-peer reviews are typically scheduled **5–10 business days** out.
— [Medicare: Drug-plan appeals](https://www.medicare.gov/providers-services/claims-appeals-complaints/appeals/drug-plans); [Pharmacy Times: PA appeals](https://www.pharmacytimes.com/view/navigating-prior-authorization-denials-a-clinical-pharmacist-s-approach-to-appeals)

> **Implication for Somnia.** Real decisions take hours-to-days. The on-chain agent's
> seconds-to-minutes callback is comfortably inside that envelope — **latency is not a
> constraint** for this product.

### Finding 4: The Part D appeal ladder is a named, multi-level escalation

If denied, the appeal proceeds through fixed levels:

1. **Redetermination** — by the plan itself. First-level appeal of the initial denial; the
   plan reviews the same packet (plus any new evidence/supporting statement) with a different
   reviewer or escalated medical director.
2. **Reconsideration** — by an **Independent Review Entity (IRE)**. 60 days from the
   plan's redetermination decision to file. The IRE is a CMS-contracted neutral that the plan
   does not employ. Strongest "new evidence" leverage point.
3. **ALJ / OMHA hearing** — Administrative Law Judge at the Office of Medicare Hearings and
   Appeals. Available if the amount in controversy meets the threshold (**~$200 in 2026**).
   ~90 days for a decision (10 days expedited). Both sides can call witnesses; transcripts
   become record.
4. **Medicare Appeals Council** — quasi-judicial review of the ALJ decision.
5. **Federal court** — judicial review of the Council decision.

— [Medicare: Drug-plan appeals](https://www.medicare.gov/providers-services/claims-appeals-complaints/appeals/drug-plans); [NCOA: Appealing a Part D denial](https://www.ncoa.org/article/appealing-part-d-coverage-denial/)

### Finding 5: Commercial plans add step therapy, peer-to-peer, and external review

Commercial prior authorization layers in: **step therapy** (try the cheaper preferred drug
first), a **letter of medical necessity**, a **peer-to-peer review** (a call between the
prescriber and the insurer's medical director), and ultimately an **external review** by a
state-regulated independent reviewer. The phase *names* and *thresholds* differ from Part D —
commercial doesn't have IRE/ALJ/OMHA — but the **shape** (internal appeal → external review)
is structurally similar.

— [Solace: When your PA is denied](https://www.solace.health/articles/prior-authorization-denied); [Pharmacy Times: PA appeals](https://www.pharmacytimes.com/view/navigating-prior-authorization-denials-a-clinical-pharmacist-s-approach-to-appeals)

### Finding 6: How A-0003's state machine maps — and where it abstracts

The real process is structurally exactly our model:

| Real-world stage | A-0003 state |
|---|---|
| Coverage determination / exception request + prescriber supporting statement | `Requested` |
| Plan asks for more documentation | `EvidenceRequested` → resubmit |
| Plan decision | `Approved` / `Denied` |
| Redetermination → IRE Reconsideration → ALJ | `Denied` → appeal rounds |
| Coverage granted, drug paid | `Settled` |

**Where we abstract — and must say so plainly.** In reality the supporting statement is
**patient-specific medical necessity = PHI**. Our design substitutes a **de-identified or
synthetic patient note** as the shared factual substrate, and keeps the parties' arguments
anchored to that note plus **public** evidence (clinical guidelines, FDA labels, comparative
effectiveness) and the **public** formulary. We faithfully model the *process structure*
while replacing the *private clinical justification* with a publicly-releasable note + public
evidence.

> **De-identification is a real obligation, not a regex.** Free-text clinical notes are
> notoriously hard to fully de-identify; anything placed on a public, permanent chain exposes
> residual identifiers forever. For the demo, use **synthetic** notes (zero risk, fully
> controlled). For any real note, HIPAA **Safe Harbor (18 identifiers) or Expert
> Determination** is required before it can be called publicly releasable.

## Design implications carried into SPEC-0004

- **Fidelity at the UI/domain layer:** use the real named stages
  (**Redetermination → IRE Reconsideration → ALJ/OMHA → Medicare Appeals Council**) for
  Part D plans, and the commercial-line equivalents (**Internal Appeal → External Review**)
  for commercial plans — labelled per the payer profile.
- **Shared factual substrate:** the de-identified/synthetic note is committed once and both
  parties argue against *that* note. The contract holds the hash; both sides verify their
  copy matches byte-for-byte.
- **Evidence packet:** public references (formulary excerpt, FDA label, guideline, price
  benchmark) are cited by URL + content hash at submission time. The arbiter rules against
  the *frozen* packet — no on-chain fetch sub-calls.
- **Public formulary:** real Part D formulary data, single source, deterministic read. See
  SPEC-0004 §2.2.

## Open questions deferred to SPEC-0004

- Whether the **contract** carries the named appeal-stage label or treats them as
  `appeal round N`, with the UI doing the translation per payer profile. (Q2 in the
  conversation; SPEC-0004 §2.4 — pending decision.)
- Sourcing path for a **real de-identified note corpus** beyond the synthetic demo set.
  (SPEC-0004 §8 — tracked task.)
