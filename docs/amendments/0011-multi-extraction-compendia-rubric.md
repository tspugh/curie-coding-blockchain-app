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

Replace the single generic scrape with **targeted, VERBATIM extraction**:

- The scrape prompt instructs the agent to extract **verbatim** (quote, do NOT summarize)
  any passage establishing whether the drug is FDA-approved or compendia/guideline-supported
  **for the indication in this request**, plus dosing limits. Verbatim-not-summary is the
  fix for the lossy denial.
- **Diagnosis source — implemented via `agentPromptHint`, NOT a new struct field**
  (decision 2026-06-07). The per-negotiation `agentPromptHint` already carries the
  indication ("…requests adalimumab for plaque psoriasis…"), so the scrape embeds it to
  target the extraction. This avoids a `createContract` signature change rippling through
  ~40 call sites (contract + ABI + real/sim backends + UI + ~37 hardhat callers + e2e) for
  no behavioral gain — the indication term is already on-chain in the hint. (The original
  draft proposed a dedicated `diagnosis` field; the hint-based form satisfies R3 with far
  less surface.) `allowedValues` stays empty for the scrape (free-text verbatim passage).
- The decide rubric broadens to **FDA-approved OR recognized-compendia/guideline support**
  (SPEC-0007 R4) so legitimate off-label use, evidenced on appeal (A0009), can pass — added
  as an explicit clause in the `inferString` decide prompt (alongside the existing per-neg
  `agentPromptHint` rubric), so the six curated hints need no rewrite.
- Architecture: **Option B chosen (SPEC-0007 §3.2, OQ1 resolved 2026-06-06)** — one
  *verbatim* scrape + one decide evaluating all public clauses. Keeps the 2-call cost; the
  fix is verbatim-not-summary, which is what dropped plaque psoriasis.
- **Source-agnostic, diagnosis-targeted scrape goal (not FDA-section-specific).** The
  prompt extracts *verbatim* the passage(s) bearing on whether `<drug>` is FDA-approved
  **or compendia/guideline-supported for `<diagnosis>`**, plus dosing limits — "do not
  summarize". Keying on the *diagnosis* (not on label section names) means the **same**
  goal works on an FDA label and on a prose compendia page, so an **appeal needs only a
  new URL** (A0009) to pull backup off-label evidence — no second prompt. A section-name
  prompt is explicitly rejected (it would whiff on the non-FDA appeal source).

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
