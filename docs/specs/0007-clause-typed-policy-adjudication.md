# SPEC-0007: Clause-typed policy adjudication (multi-extraction + de-identified attestation)

Status: Draft · Owner: Curie team · Date: 2026-06-06

## 1. Summary & user story

Today the agent runs a single, vague "is this drug approved?" check that produces a
**lossy free-text summary** — and that summary can silently drop the very indication
being requested (the openFDA Humira/plaque-psoriasis denial: the source lists plaque
psoriasis 43×, but the scrape's summary omitted it, so the judge denied a covered
drug).

This spec replaces that with a **clause-typed policy**. A policy is a list of clauses,
each tagged **`public`** (the agent adjudicates it from an authoritative public source
via a *targeted* extraction) or **`attested`** (the provider supplies a **de-identified,
non-PHI** yes/no the agent records but cannot independently verify). The agent runs
**multiple targeted extractions** — one per public clause (e.g. *approved-indication*,
*dosing-within-label*) — and combines them with the attestations to rule. On appeal,
new evidence (e.g. compendia support for an off-label use) is re-extracted and the
decision can flip.

> As an **insurer**, I want my prior-authorization criteria expressed as typed clauses,
> so the agent rigorously checks the *public* ones against FDA/compendia sources and
> records *de-identified attestations* for the patient-specific ones — with no PHI ever
> on-chain.
>
> As a **provider**, I want an off-label denial to be re-decidable when I supply
> recognized compendia/guideline evidence.

## 2. Requirements

- **R1 (MUST) Clause typing.** A policy is a list of clauses; every clause carries
  `type ∈ {public, attested}`.
- **R2 (MUST) Public clauses are agent-adjudicated from a named source.** A public
  clause names a check `kind` (`indication` | `dosing`), the parameter it checks (the
  claimed diagnosis; the requested quantity + days-supply), and an authoritative source
  URL. The agent evaluates the clause from that source — not from a global summary.
- **R3 (MUST) Targeted multi-extraction (no lossy summary).** The agent performs a
  *targeted* extraction per public clause whose question names the parameter, e.g.:
  *"Per this label, is `<diagnosis>` an FDA-approved or recognized-compendia indication
  for `<drug>`?"* and *"Per this label, is `<quantity>` over `<days-supply>` within the
  approved dosing for `<drug>`?"* Extractions return a constrained verdict
  (`yes`/`no`/`uncertain`) **plus the supporting snippet**, not a freehand paraphrase.
- **R4 (MUST) Indication = FDA-approved OR compendia-supported.** The indication clause
  passes if the source establishes *either* an FDA-approved indication *or* recognized
  compendia/guideline support (NCCN, AHFS DI, DrugDex, or a society guideline) for the
  diagnosis. (This is how real payers cover legitimate off-label use.)
- **R5 (MUST) De-identified attestation channel.** Attested clauses are satisfied by a
  provider-supplied **de-identified** structured attestation `{clauseId, attested: bool}`
  carrying **none of the 18 HIPAA Safe-Harbor identifiers** and **no free-text clinical
  narrative**. The agent records and trusts the attestation; it does not independently
  verify it.
- **R6 (MUST) No PHI on-chain (inherited from the suite invariant).** Neither the
  extractions nor the attestations may carry PHI — only de-identified structured
  booleans and public source text/snippets.
- **R7 (MUST) Ruling = conjunction of clauses.** Approve **iff** every public clause is
  satisfied by its evidence **and** every attested clause has an affirmative attestation.
  Otherwise the ruling is deny / needs-more-info, attributed to the failing clause(s).
- **R8 (MUST) Appeal re-extracts new evidence with the *same source-agnostic goal*.**
  `appeal` / `submitEvidence` with a new source URL re-runs the same diagnosis-targeted
  extraction (§3.2) against it (A0009 already repoints the scrape). No separate appeal
  prompt: because the goal asks "is `<drug>` approved **or supported** for `<diagnosis>`",
  a compendia/guideline URL on appeal yields the backup evidence that flips an off-label
  denial to approve. The extraction goal MUST NOT be FDA-section-specific (it must work on
  prose compendia sources too).
- **R9 (SHOULD) Synthesis call produces a rationale.** A final inference call combines
  the per-clause verdicts + attestations + policy into the decision and a short,
  PHI-free rationale string for the timeline.
- **R10 (MUST) Plaque-psoriasis worked example ships end-to-end.** The adalimumab ×
  plaque-psoriasis case runs through the new flow with: the source URL (§3.5), two public
  clauses (indication + dosing), two attestations (step-therapy + safety), and the
  example policy (§3.6).
- **R11 (MUST) PHI is routed off-protocol, never carried.** If a clause genuinely cannot
  be reduced to a public check or a de-identified boolean attestation — i.e. it would
  require actual PHI to adjudicate — the protocol **flags it as "requires direct off-chain
  communication"** (handled provider↔payer out-of-band) and **does not** put the PHI on
  any path. The demo version carries **no PHI at all**: every attested clause is a
  de-identified boolean; no PHI-bearing clause type is built.
- **R12 (MUST) Off-label worked example ships end-to-end.** The bupropion × ADHD case
  (§3.7) demonstrates the off-label→compendia appeal: on-label FDA source → deny; appeal
  with a public compendia/guideline source → approve.

## 3. Technical documentation

### 3.1 Clause & attestation model (off-chain types)

```ts
type ClauseType = "public" | "attested";
type PublicCheckKind = "indication" | "dosing";

interface PolicyClause {
  id: string;
  text: string;             // human-readable criterion (shown in UI)
  type: ClauseType;
  // present iff type === "public":
  check?: {
    kind: PublicCheckKind;
    param: string;          // the diagnosis (indication) or "qty/days" (dosing)
    sourceUrl: string;      // authoritative public source for THIS clause
  };
}

// Provider-supplied, de-identified. NO patient identifiers, NO free narrative.
interface Attestation {
  clauseId: string;
  attested: boolean;
}
```

### 3.2 Flow — **DECISION: Option B (verbatim sections + one decide)**

**Chosen 2026-06-06 (resolves OQ1):** the root cause of the openFDA denial was
**summary vs verbatim**, not extraction *count*. So:

One `ExtractString` pulls, **verbatim (do not summarize)**, the passage(s) in the source
bearing on **whether `<drug>` is FDA-approved or compendia/guideline-supported for
`<diagnosis>`, plus any dosing limits** → one `inferString` decide evaluates **all** public
clauses + the de-identified attestations against that verbatim text → approve / deny /
needs-more-info + rationale (R9).

The extraction goal is keyed to the requested **diagnosis**, **not** to FDA-label section
names — so the *same* goal works on an FDA label (answer lives in `indications_and_usage`)
**and** on a compendia/guideline page on appeal (answer lives in prose). This is why an
**appeal needs only a new URL, not a new extraction goal**: the goal is source-agnostic,
and a compendia URL automatically yields "backup evidence" for the off-label use (§3.7).
(Avoid section-name-specific prompts — they'd whiff on the non-FDA appeal source.)

- Cost: **1 scrape + 1 decide** (unchanged from today) — no per-clause fee multiplication.
- Fixes the lossiness because the requested indication is *present in the verbatim text*
  and cannot be summarized away.
- Rejected **Option A** (one targeted extraction per public clause) for now: max per-clause
  precision but N× the scrape fee, and B already fixes the observed failure. A stays
  available if a future clause needs precision the verbatim text can't supply.

Both keep PHI off-chain: the scrape sees only the public URL; the decide sees only public
text + de-identified attestation booleans.

### 3.3 On-chain / off-chain boundary

- **Public, on-chain:** drug ref, claimed diagnosis (a clinical *term*, not a patient
  fact — "plaque psoriasis"), quantity, days-supply, per-clause source URL(s).
- **De-identified, agent-readable:** the attestation booleans. They may ride on-chain as
  small structured data (PHI-guarded — booleans + clause ids only) or be committed as a
  hash and revealed; see Open Questions.
- **PHI, never on-chain:** the underlying chart facts behind an attestation. The provider
  asserts "step therapy satisfied: true"; the *evidence* for that assertion stays in the
  provider's system.

### 3.4 Contract changes (amendments required)

This spec needs **two amendments** to the SPEC-0006 / A0007 / A0009 contract:

- **Amendment 0011 — multi-extraction + compendia rubric.** Replace the single generic
  scrape prompt with targeted per-clause extraction (R3); broaden the decide rubric to
  *FDA-approved OR compendia-supported* (R4); carry the claimed diagnosis as a field used
  in the indication question; evaluate dosing against the label (R2). Choose Option A or B
  (Open Question 1).
- **Amendment 0012 — de-identified attestation channel.** Add a PHI-guarded attestation
  input on the negotiation (clause-id → bool), surfaced to the decide synthesis (R5), with
  the existing name-pattern PHI guard extended to reject narrative text.

### 3.5 Source research (the plaque-psoriasis evidence URL)

- **On-label (primary):** the FDA label. Two viable forms:
  - **openFDA** `https://api.fda.gov/drug/label.json?search=openfda.brand_name:HUMIRA&limit=1`
    — verified scrapeable on Somnia (requestId 4986545 → Success); plaque psoriasis appears
    43× in `indications_and_usage`. JSON is large (~350 KB) but the targeted extraction
    (R3) reads the indication directly, avoiding the lossy-summary failure.
  - **DailyMed** (FDA's official SPL repository) — prose HTML per drug, smaller and
    indication-forward; needs a per-drug `setid`. A good **alternative/complement** to
    openFDA for the on-label check; recommended to evaluate as the cleaner source.
- **Off-label / compendia (for the appeal demo):** NCCN, AHFS DI, IBM Micromedex DrugDex
  are the payer-recognized compendia but are **paywalled / not freely scrapeable** — for
  the demo, a public **society guideline** (e.g. the AAD–NPF psoriasis guideline page) is
  a workable stand-in to demonstrate the off-label→compendia appeal. (Plaque psoriasis is
  *on*-label for adalimumab, so the off-label path is demonstrated with a different
  diagnosis; see Open Question 3.)
- **Dosing:** same FDA label, `dosage_and_administration` section.

### 3.6 Plaque-psoriasis example policy (synthetic; no PHI)

> **"Specialty biologic — moderate-to-severe plaque psoriasis (Commercial PA)"**
> 1. *(public · indication)* The drug is **FDA-approved or compendia-supported** for
>    plaque psoriasis. → checked against §3.5 source.
> 2. *(public · dosing)* Requested quantity is **within FDA-labeled dosing** (≤ 2 pens /
>    28 days). → checked against the label dosing section.
> 3. *(attested)* Trial-and-failure or contraindication to **≥ 1 conventional systemic
>    therapy** (e.g. methotrexate). → provider attests `true/false`.
> 4. *(attested)* **TB screening performed** and no active serious infection (HUMIRA
>    boxed-warning criterion). → provider attests `true/false`.

Clauses 1–2 the agent adjudicates from the public source; 3–4 are de-identified provider
attestations the agent records but cannot independently verify.

### 3.7 Off-label worked example — bupropion × ADHD (the appeal demo)

Demonstrates R4/R8 (FDA-approved **OR** compendia-supported) with a fully **public**
evidence trail:

- **Initial source (deny path):** openFDA `WELLBUTRIN` label —
  `https://api.fda.gov/drug/label.json?search=openfda.brand_name:WELLBUTRIN&limit=1`.
  Its `indications_and_usage` lists **only major depressive disorder + seasonal affective
  disorder — not ADHD** (verified 2026-06-06). So the indication clause for ADHD **fails
  on the FDA label → Deny** (correct: ADHD is off-label for bupropion).
- **Appeal source (approve path):** the provider appeals (A0009) with a public
  compendia-style reference supporting bupropion for ADHD —
  **StatPearls (NCBI Bookshelf)** `https://www.ncbi.nlm.nih.gov/books/NBK470212/`, which
  lists ADHD among bupropion's off-label uses with a stated evidence base; a corroborating
  review is PMC `https://pmc.ncbi.nlm.nih.gov/articles/PMC6485546/` ("Bupropion for ADHD
  in adults"). Under the broadened rubric (R4), compendia/guideline support satisfies the
  indication clause → **Approve** on appeal.
- Both NCBI sources are **free, public, and HTML** — they stand in for the payer-recognized
  but paywalled compendia (NCNN/AHFS/DrugDex), keeping the whole demo PHI-free and
  scrapeable. (Resolves OQ3.)

> **"Non-stimulant for ADHD (Commercial PA)"** — example policy
> 1. *(public · indication)* The drug is FDA-approved **or compendia-supported** for ADHD.
> 2. *(public · dosing)* Requested quantity is within labeled dosing.
> 3. *(attested)* Trial-and-failure or contraindication to a **preferred stimulant** —
>    provider attests.

## 4. Deliverables

- This spec (`docs/specs/0007-clause-typed-policy-adjudication.md`).
- Amendments `docs/amendments/0011-multi-extraction-compendia-rubric.md` and
  `0012-deidentified-attestation-channel.md` (ADRs accompanying this spec).
- Off-chain clause/attestation types (`PolicyClause.type`, `Attestation`) + the
  plaque-psoriasis (§3.6) **and** bupropion×ADHD (§3.7) example policies + their source-URL
  constants (openFDA HUMIRA/WELLBUTRIN, NCBI StatPearls `NBK470212`) in `src/data/`.
- Contract: targeted multi-extraction + compendia rubric (A0011); attestation field
  (A0012).
- Tests per §5.

## 5. Test cases

- **T1 (R3/R4/R7) Happy path.** Plaque-psoriasis: indication ✓ + dosing ✓ + both
  attestations affirmative → **Approve**.
- **T2 (R3, regression of the openFDA bug).** The indication extraction for plaque
  psoriasis returns **yes** (the present indication is no longer dropped by a lossy
  summary).
- **T3 (R5/R7) Missing attestation.** Step-therapy attestation absent/false → ruling is
  needs-more-info/deny attributed to clause 3 (not Approve).
- **T4 (R4/R8/R12) Off-label appeal (bupropion × ADHD).** With the openFDA WELLBUTRIN
  source (no ADHD) → **Deny**; `appeal` with the NCBI StatPearls source (off-label ADHD
  support) → **Approve**.
- **T5 (R2) Dosing over limit.** Quantity above the labeled dose → deny on the dosing
  clause even if the indication passes.
- **T6 (R6) No-PHI.** Attestations + extraction inputs/outputs contain none of the 18
  HIPAA identifiers and no free clinical narrative; the contract guard rejects narrative.
- **T7 (R7) Conjunction.** A single failing clause blocks Approve.

## 6. Pass / fail criteria

**PASS — all must hold:**
- [ ] Policy clauses carry `type`; public clauses adjudicated from a named source, attested clauses from de-identified booleans (R1/R2/R5).
- [ ] Targeted per-clause extraction returns a verdict + snippet; the plaque-psoriasis indication check returns "approved" — the lossy-summary regression is fixed (R3/T2).
- [ ] Indication clause accepts FDA-approved **or** compendia-supported (R4).
- [ ] Ruling is the conjunction of all clauses; one failure blocks approval (R7/T7).
- [ ] Off-label appeal with compendia evidence can flip a denial (R8/T4).
- [ ] No PHI on-chain; attestations are de-identified structured booleans; the guard rejects narrative (R6/T6).
- [ ] The plaque-psoriasis worked example runs end-to-end (R10/T1).

**FAIL — any triggers rejection:**
- Any PHI or free clinical narrative committed on-chain.
- The indication check still drops a present indication (lossy summary persists).
- A failing clause does not block approval.
- Attestation treated as independently verified (trust model misrepresented in UI/spec).

## 7. Out of scope

- **Multiple simultaneous source URLs per clause** — one source per clause for now.
- **Independent verification of attestations** (cryptographic attestation / ZK proofs) —
  the trust model is "provider asserts a de-identified boolean"; verification is deferred.
- **Real compendia API integration** (NCCN/DrugDex are paywalled) — a public guideline
  stand-in demonstrates the off-label appeal.
- **Reauthorization / renewal criteria** (DAS28-at-6-months style clauses).
- **Quantity unit reconciliation** (NDC pack size vs labeled dose math) beyond a simple
  within-limit check.

## 8. Open questions

- **OQ1 (HIGH) — RESOLVED 2026-06-06 → Option B (verbatim scrape + one decide).** The
  failure was summary-vs-verbatim, not extraction count; B fixes it at the current 2-call
  cost. See §3.2. Option A deferred.
- **OQ2 (MED) — RESOLVED 2026-06-06 → on-chain structured booleans.** Attestations are
  stored on-chain as `{clauseId, bool}` (no hash/reveal indirection). They are obviously
  non-PHI (a clause id + a boolean), cheap, and directly readable by the decide synthesis.
  See §3.3 / A0012.
- **OQ3 (MED) — RESOLVED 2026-06-06 → bupropion × ADHD, StatPearls source.** Off-label
  example + public compendia stand-in chosen; see §3.7. (openFDA WELLBUTRIN has no ADHD →
  deny; NCBI StatPearls supports off-label ADHD → approve on appeal.)
- **OQ4 (LOW) — RESOLVED 2026-06-06 → PHI never on the protocol (R11).** Attestations stay
  **structured booleans** (Safe-Harbor-clean by construction); any clause that would need
  actual PHI is flagged "requires direct off-chain communication" and is **out of scope for
  the demo** — no PHI path is built, so no Expert-Determination question arises.
