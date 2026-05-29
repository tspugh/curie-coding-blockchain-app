# SPEC-0004 research prompts

Three self-contained research prompts to hand to Perplexity / Claude / a research
subagent. Outputs land as the concrete inputs to SPEC-0004 §2.1 (curated cases) and
§2.2 (formulary sources).

Status: **open**, owner: tspugh, requested: 2026-05-29.

Each prompt is independently runnable — copy/paste verbatim.

---

## Prompt 1 — Three concrete case candidates

```text
For a demo of an AI-mediated drug coverage-exception arbitration protocol on Somnia
blockchain (curie-coding-blockchain-app), I need three concrete, realistic case
scenarios with synthetic-but-real-shape clinical data — one for each U.S. payer line.

For each case, deliver:
  - Real drug name + NDC code + RxNorm CUI
  - FDA-approved indications (cite the FDA label section)
  - Whether the requested use is on-label or off-label
  - A typical formulary entry shape (tier, PA flag, step-therapy, quantity limit) for
    that payer line
  - 2-3 cited public clinical-guideline references (NCCN, NICE, USPSTF, FDA label,
    UpToDate-equivalent) the parties would cite in evidence
  - A 200-400-word synthetic clinical note: diagnosis, prior treatments tried,
    current presentation, requested treatment, clinical rationale. (Synthetic =
    author-written, NOT scrubbed real notes. No PHI patterns.)
  - A current NADAC or Cost Plus or GoodRx price reference for the drug, with date
  - The *expected* ruling under a fair, evidence-grounded arbiter, with rationale

CASE 1 — Medicare Part D, clean approvable medical-necessity case.
  A drug + indication where the request is on-label, the plan's formulary covers the
  drug (possibly with PA), and the clinical note supports medical necessity such that
  a fair arbiter would approve. Avoid edge-of-formulary drugs.

CASE 2 — Commercial (ACA-regulated), "policy-void" / FDA-contradicting case.
  The payer's policy denies an FDA-on-label use on incorrect grounds (e.g., labels the
  indication "experimental/investigational" despite the FDA label including it). Cite
  the actual policy language pattern (Aetna / UnitedHealthcare / Cigna policies are
  public) and the FDA label section that contradicts it. The arbiter is expected to
  approve and rule the policy clause void.

CASE 3 — Medicaid MCO (managed-care), denied-then-appealed.
  Initial denial on PA-criteria grounds at round (Medicaid, 0). New evidence is
  introduced in round (Medicaid, 1) Plan Internal Appeal that should shift the
  outcome. Use a real MCO's published PA criteria as the basis for the initial denial.

Cite every claim. Public sources only. Output as Markdown, one section per case.
```

---

## Prompt 2 — NDC → alternatives / equivalents APIs

```text
Identify public APIs an off-chain agent can use to resolve an NDC drug request to
its alternatives, for use in a coverage-exception arbitration system. Coverage:

  1. NDC → RxNorm CUI mapping (NLM RxNav: which endpoint, what auth, rate limits)
  2. AB-rated generics (FDA Orange Book — is there an API, or only the file? data
     shape; update cadence)
  3. Same-class therapeutic alternatives (RxNav RxClass, DrugBank, OpenFDA — which is
     freely accessible, which requires API keys, which is deterministic across calls)
  4. DailyMed for current FDA labels (endpoint, data shape, how to extract the
     indications section)

For each API:
  - Endpoint URL pattern
  - Auth / key requirements
  - Rate limits
  - JSON schema (or pointer to schema) of the alternatives response
  - Determinism: does the same input return the same output across days/weeks, or
    does the API mutate?
  - How to cite a specific point-in-time response (e.g., is there a version pin or
    snapshot URL?)

Concrete test case: for Aimovig (NDC 55513-841-01, erenumab-aooe), find:
  (a) any AB-rated generics
  (b) other CGRP inhibitors (the same class)
  (c) older alternatives for migraine prophylaxis (triptans, beta-blockers, etc.)
  via these APIs and report the calls and responses.

Goal: pick the *one* API stack that's the most deterministic + freely-accessible +
documentable, so the protocol's evidence packet can cite alternatives with stable
content hashes.
```

---

## Prompt 3 — Authoritative formulary / policy sources per payer line

```text
For v0 of the demo, I need the *specific* authoritative data sources to pin a real
formulary slice for each payer line.

  1. Medicare Part D
     - Which CMS publication has the per-plan formulary file (drug list, tier,
       PA/ST/QL flags)? Specific URL (CMS Drug Plan Finder, Plan Finder Quarterly
       Files, or formulary file submission API).
     - Monthly release cadence; how to identify the "current" release.
     - Data format (JSON / CSV / XML / DB).
     - For a specific contract+PBP (e.g., a real Aetna SilverScript plan ID), pull
       the formulary entry for one specific drug (e.g., Aimovig). Cite the file and
       the row.

  2. Commercial — pick ONE large national payer for v0 (recommend Aetna, UHC, or
     Cigna based on public availability of formularies + coverage policies):
     - Where the formulary file is published (Aetna's "Medication Search,"
       UnitedHealthcare's "Prescription Drug List," Cigna's drug list).
     - Where the coverage-policy documents are published (the prose policies that
       drive denials — these are the artifact the "policy-void" case attacks).
     - Update cadence, machine-readability (likely PDFs — flag that).

  3. Medicaid MCO — pick ONE large-state MCO:
     - Recommend Centene's Medi-Cal (California), Molina (multiple states), or
       UnitedHealthcare Community Plan.
     - Where the formulary + PA criteria are publicly posted.
     - Data format and update cadence.

For each: a directly-citable URL, the data shape, and an honest assessment of how
deterministically a programmatic agent could consume it. Flag PDFs vs. structured.

Goal: a recommended pinned data source per payer line for the curated v0 demo cases.
Cite everything.
```
