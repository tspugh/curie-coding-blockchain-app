# Amendment 0011 — Targeted multi-extraction + compendia rubric

**Status:** Proposed (2026-06-06)
**Affects:** SPEC-0006 §3.6 (two-agent flow), Amendment 0007 (`_fireScrape`/`_fireDecide`),
Amendment 0009 (evidence URL). Implements SPEC-0007 R2–R4, R8.

## Context

The scrape fires `ExtractString` with an **empty `allowedValues` and a generic prompt**
("Extract the drug's FDA approval status, indication, and medical necessity evidence").
This makes the agent emit a **lossy free-text summary**. Recovered on-chain
(`debug_traceTransaction` of the scrape-callback), the Humira summary was:

> "…indications for rheumatoid arthritis, psoriatic arthritis, ankylosing spondylitis,
> Crohn's disease, ulcerative colitis, hidradenitis suppurativa, and uveitis…"

— **plaque psoriasis omitted**, though it appears 43× in the source. The judge then
correctly denied a covered drug. The defect is the *vague, lossy* extraction, not
truncation (the indication sits at byte 5283, 1% into the response).

## Decision

Replace the single generic scrape with **targeted, parameterized extraction**:

- The scrape question names the parameter being checked, e.g. *"Per this label, is
  `<diagnosis>` an FDA-approved or recognized-compendia indication for `<drug>`?"* and
  *"Is `<quantity>` over `<days-supply>` within the approved dosing?"* — using
  `ExtractString`'s `allowedValues` to constrain the verdict (`yes`/`no`/`uncertain`)
  while still returning the supporting snippet.
- The negotiation carries the **claimed diagnosis** as a field used to build the
  indication question (a clinical *term*, not a patient fact — PHI-free).
- The decide rubric broadens to **FDA-approved OR recognized-compendia/guideline support**
  (SPEC-0007 R4) so legitimate off-label use, evidenced on appeal (A0009), can pass.
- Architecture is **Option A** (one targeted extraction per public clause) or **Option B**
  (one verbatim-section scrape + one decide) — resolved by SPEC-0007 OQ1 before build.

## Consequences

- The indication that is *present in the source* is no longer dropped — the openFDA
  regression is fixed.
- Option A multiplies scrape fees by the number of public clauses; the fee model
  (`requestAdjudication` value) must fund N scrape calls + 1 decide. Option B keeps the
  2-call cost. (OQ1.)
- No new PHI surface: the diagnosis term and the source URL are public; the extraction
  reads only public text.
- Backward-incompatible with the A0007 prompt shape → **redeploy required**; off-chain
  decoders and the drug-evidence map update in lockstep.

## Test impact

Pins SPEC-0007 T1–T5, T7. Add a hardhat assertion that the scrape payload's prompt
contains the diagnosis parameter; an off-chain test that the indication verdict for
plaque psoriasis is `yes` against the curated source.
