# Evidence source provenance & reputability — research note

**Status:** Research / brainstorm (2026-06-07). Prompted by the SPEC-0007 R12 off-label
worked example (bupropion × ADHD) live-verification.

## 1. What the R12 live test taught us

The bupropion × ADHD appeal was live-verified on contract
`0x0064CA9a22A327F09570D0090573A0b0259Cb6c8` (reqId 2):

- **Deny path — correct.** openFDA `WELLBUTRIN` label → **Denied** (ADHD is genuinely
  off-label for bupropion; not in `indications_and_usage`).
- **Appeal path — denied, but the system reasoned correctly.** Appeal with StatPearls
  `NBK470212`. The scrape **succeeded** and (recovered via `debug_traceTransaction` of the
  scrape callback) returned, verbatim:

  > "Off-Label Uses: Antidepressant-induced sexual dysfunction, Attention-deficit/
  > hyperactivity disorder (ADHD), Depression associated with bipolar disorder, Obesity,
  > ADHD in pediatric patients. The usual starting dose is 3 mg/kg daily…"

  The decide then **denied** — because the A0011 rubric approves only when the drug is
  *FDA-approved OR **supported by recognized clinical compendia/guidelines***, and the
  extracted passage establishes that ADHD is **used off-label**, not that the use is
  **supported by evidence**. The page *does* carry the supporting evidence (systematic
  reviews, AACAP practice parameters), but the verbatim extractor picked the narrow
  "Off-Label Uses" list + dosing, not the evidence-base section.

**Conclusion:** this is the agent being *appropriately rigorous* — "used off-label" ≠
"compendia-supported." The fix is not to weaken the rubric; it is to (a) point the appeal
at a source whose extractable passage states the *support*, and (b) build a mechanism that
ensures sources are *reputable* (the rest of this note).

## 2. Real, reputable, scraper-friendly sources (thread A)

The key realization: the inputs that scrape reliably are **small + structured API
responses**, not large HTML. `api.fda.gov/drug/label.json` works for the same reason the
scholarly-literature APIs do.

### NCBI E-utilities `efetch` — the FDA-JSON of the literature

`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=<PMID>&rettype=abstract&retmode=text`
returns a **clean, compact, structured** abstract (title, journal, authors,
BACKGROUND/METHODS/RESULTS/CONCLUSIONS). Compact (~5 KB), so the verbatim extractor lands
the conclusion instead of summarizing a 100 KB page.

**Confirmed source for bupropion × ADHD support (highest evidence tier):**

- **Cochrane systematic review** — PMID **28965364**, *Cochrane Database Syst Rev* 2017
  ("Antidepressants for attention deficit hyperactivity disorder (ADHD) in adults").
  efetch payload ≈ 5.6 KB; **CONCLUSIONS** state verbatim:
  > "bupropion decreased the severity of ADHD symptoms and moderately increased the
  > proportion of participants achieving a significant clinical improvement in ADHD
  > symptoms."

  This is recognized evidence-synthesis support (Cochrane = gold standard), PMID-anchored,
  public, and scraper-friendly. Pointing the R12 appeal at the efetch URL for PMID 28965364
  should flip the decision to **Approve** under the existing rubric — no rubric change.

Other reputable, mostly-public source families (tiered in §3):
- **FDA / DailyMed** (`api.fda.gov`, `dailymed.nlm.nih.gov`) — labels (on-label only).
- **PubMed / PMC E-utilities** — peer-reviewed literature; DOI/PMID-anchored.
- **Specialty-society guidelines** — AACAP, NICE (`nice.org.uk`), USPSTF.
- **Licensed compendia** — AHFS DI, Micromedex/DrugDex, Lexicomp, Clinical Pharmacology.
  These are the *payer-recognized* off-label authorities but are **paywalled** → reachable
  only via licensed APIs, not public scraping (the core real-world constraint).

## 3. Source-reputability mechanism (thread B) — brainstorm

**Threat model.** A submitter points "evidence" at a page they control — or an
SEO/LLM-optimized page — that *asserts* support without real backing. A naive agent
extracts the assertion and approves. We need to ensure evidence comes from a *reputable,
authoritative* source, and not be fooled by a page crafted to please an LLM.

Layered options, roughly weakest→strongest:

1. **Authoritative-source allowlist (registry).** Evidence URL must match a
   governance-curated set of trusted endpoints (api.fda.gov, dailymed, eutils/PMC,
   nice.org.uk, USPSTF, licensed-compendia APIs). On-chain registry (owner/governance) or
   off-chain validator list. *Pro:* simple, robust, kills "random website." *Con:* rigid;
   must be maintained; rejects novel-but-valid sources.

2. **Identifier-anchored evidence (DOI / PMID), not raw URLs.** Require evidence to be a
   **DOI** (resolved via Crossref) or **PMID** (resolved via NCBI), fetched through the
   canonical publisher API. A self-hosted page has **no** DOI/PMID and cannot fake MEDLINE
   indexing, so this ties evidence to the peer-reviewed scholarly record. *Pro:* strong
   anti-spoofing, content is publisher-controlled. *Con:* labels/guidelines lack a
   DOI/PMID → combine with (1).

3. **Source-tier scoring, surfaced in the rationale.** Classify each source into a tier
   — FDA label > Cochrane/systematic review > specialty-society guideline > narrative
   review > preprint > unvetted — and require evidence **at/above a threshold tier** for an
   off-label approval. The decide must *state the tier* (auditable trust basis, R9).

4. **Dedicated source-vetting agent (a third agent).** Before extraction, a guardrail agent
   assesses provenance — is the domain an authority? peer-reviewed/indexed? does the
   publisher actually match the claim? — and returns `{reputable, tier, reason}`. Composes
   with the existing pipeline: **vet → scrape → decide**. Catches gamed/self-hosted pages
   even where the allowlist has gaps. *Con:* +1 agent fee per adjudication.

5. **Cross-corroboration (N-of-M independent sources).** Require ≥2 *independent* reputable
   sources to concur for an off-label approval, so one gamed source can't carry a ruling.

6. **Signed evidence / oracle attestation.** The compendia publisher (or a trusted oracle)
   signs the evidence payload; the contract verifies the signature on-chain. Eliminates
   spoofing, but needs publisher/oracle participation. *Future.*

7. **Stake-and-dispute (economic).** The submitter stakes; a challenge window lets anyone
   dispute the source's authority; bad evidence slashes the stake. Fits the on-chain
   settlement ethos; complex; *future.*

**On the "don't just see the LLM bot" worry:** an allowlist (1) + identifier-anchoring (2)
structurally defeat the "craft an LLM-friendly page" attack — the agent reads only from
canonical publisher APIs, never arbitrary submitter pages. The vetting agent (4) adds
defense-in-depth for whatever slips through.

### Recommended path

- **Near-term (demo + V1):** allowlist of authoritative APIs (1) **+** PMID/DOI anchoring
  for literature (2), **+** source-tier in the rationale (3). Directly answers "don't
  accept a random website" with minimal machinery. The Cochrane efetch source (§2) fits
  this exactly — it's allowlisted (eutils), PMID-anchored, and top-tier.
- **V2:** add the source-vetting agent (4) + cross-corroboration (5).
- **Future:** signed-oracle attestation (6) and/or stake-and-dispute (7) for trustless
  provenance, plus licensed-compendia API integrations (AHFS/DrugDex) for true
  payer-recognized off-label authority.

## 4. Immediate follow-ups

- **R12 worked example:** switch the appeal source to the Cochrane efetch URL (PMID
  28965364) in `docs/specs/0007-…` §3.7, `src/data/policies.ts`, and the demo evidence map;
  re-verify the deny→appeal→approve flip live.
- **Spec:** capture the chosen provenance mechanism (likely allowlist + PMID/DOI anchoring +
  tiering) as a new spec / amendment before building it — it changes what counts as a valid
  `agentEvidenceUrl`.
