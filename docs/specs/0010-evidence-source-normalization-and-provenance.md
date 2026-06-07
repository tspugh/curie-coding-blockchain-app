# SPEC-0010: Evidence-source normalization & provenance

Status: Draft · Owner: Curie · Date: 2026-06-07

## 1. Summary & user story

A layer that sits between a provider's submitted evidence and the adjudication agent. It
(a) **normalizes** an authoritative source into compact, *support-forward* content the
scraper reliably extracts, and (b) **gates** evidence on **source reputability** so the
agent can't be steered by a self-hosted or SEO/LLM-optimized page. Motivated by the
SPEC-0007 R12 live tests (see `docs/research/evidence-source-provenance.md`): the scrape
agent returns a single short snippet — for bupropion×ADHD always the "used off-label"
*background* line, never the buried efficacy *conclusion* — so linking a real paper does
not flip an off-label appeal; and any URL is currently accepted as "evidence."

> As an **insurer/payer**, I want coverage decisions to rest only on **recognized,
> authoritative** evidence, so that a provider cannot win approval by pointing the agent at
> a page they control.

> As a **provider**, I want to cite a real source (e.g. an FDA label or a Cochrane review by
> PMID) and have the **decision-relevant support** reliably reach the agent, so that a
> legitimate off-label case is adjudicated on its merits rather than lost to a lossy scrape.

> As an **auditor**, I want every ruling to carry the **provenance** of its evidence
> (identifier, tier, retrieval time, content hash), so that the basis of the decision is
> verifiable after the fact.

## 2. Requirements

- **R1 (MUST) Evidence-normalization step.** Before the agent reads evidence, an off-chain
  normalizer resolves the submitted source and produces **compact, support-forward content**
  — the passage that establishes *FDA-approval* or *compendia/guideline support for the
  requested indication* is the **prominent** extractable text. (Directly fixes the
  "scraper returns the background `used off-label` line" failure.)
- **R2 (MUST) Authoritative-source allowlist.** Public evidence is accepted only from a
  curated set of recognized authorities (e.g. openFDA/DailyMed, PubMed/PMC via NCBI
  E-utilities, NICE, USPSTF, and licensed compendia APIs). A source outside the allowlist is
  **not** accepted as public evidence.
- **R3 (MUST) Identifier-anchored literature.** Literature evidence is referenced by **DOI**
  or **PMID** and resolved through the canonical resolver (NCBI / Crossref), not an arbitrary
  URL. A self-hosted page has no DOI/PMID and cannot fake indexing.
- **R4 (MUST) Source-tier classification, surfaced in the rationale.** Each source is
  assigned a tier — *FDA label > Cochrane/systematic review > specialty-society guideline >
  narrative review > preprint > unvetted* — and the decide rationale (SPEC-0007 R9) **states
  the tier**. An **off-label** approval requires evidence **at or above a threshold tier**
  (default: systematic review / guideline).
- **R5 (MUST) Support, not mere usage.** Normalized content must establish *support* (an
  efficacy/guideline statement), not merely that a use exists. "Used off-label" alone does
  not satisfy the indication clause (SPEC-0007 R4/R7 — the decide is correctly rigorous).
- **R6 (MUST) Provenance metadata.** Normalized evidence carries `{ sourceType (doi|pmid|
  url), id, tier, retrievedAt, contentHash }`. The `contentHash` is committable on-chain
  (parallel to the A0009 `evidenceUri` keccak), so the ruling is auditable.
- **R7 (MUST) Irrelevant / unresolvable / non-allowlisted → never silently approved.** A
  source that does not pertain to the requested drug+indication, cannot be resolved, or is
  not allowlisted results in **deny or a flag for off-protocol handling** — never an
  approve. (The negative control: a bupropion paper offered for an adalimumab claim denies.)
- **R8 (MUST) No PHI.** Normalized evidence and provenance contain none of the 18 HIPAA
  identifiers and no clinical narrative beyond public source text (suite invariant).
- **R9 (SHOULD) Source-vetting agent.** A guardrail step that assesses provenance + relevance
  and returns `{ reputable, tier, reason }`, composing as **vet → normalize → decide**.
- **R10 (SHOULD) Cross-corroboration.** An off-label approval MAY require ≥2 **independent**
  allowlisted sources to concur, so one source cannot carry a ruling.
- **R11 (MUST) Explicit trust model.** The normalizer is off-chain glue, **not** the system
  of record; its output is auditable (provenance + content hash travel with the ruling). The
  spec states who is trusted to run it and what that trust covers.

## 3. Technical documentation

### 3.1 Where it sits

```
provider submits  ─►  NORMALIZER (off-chain)  ─►  agentEvidenceUrl + provenance  ─►  createContract / appeal
  DOI | PMID |          1. vet (R2/R3/R9)            (compact, support-forward,         (on-chain; unchanged
  allowlisted URL       2. resolve (efetch/                hosted doc)                    A0009 evidenceUri
                           Crossref/openFDA)                                              keccak = contentHash)
                        3. extract support (R1/R5)                                ─►  scrape → decide (SPEC-0007)
                        4. classify tier (R4)
                        5. publish scraper-friendly doc + provenance (R6)
```

The contract surface is **unchanged** for the basic version: the normalizer simply produces
a better `agentEvidenceUrl` (a small, support-forward, reliably-fetchable doc) plus
provenance. Allowlist/tier **enforcement** may later move on-chain (registry) — see Open
Questions.

### 3.2 Resolvers (allowlisted authorities)

- **openFDA** `api.fda.gov/drug/label.json` — structured JSON; the indication list is the
  prominent match (already reliable; the baseline that works).
- **NCBI E-utilities** `efetch`/`esummary` (PubMed/PMC) — DOI/PMID-anchored abstracts.
  *Note:* NCBI throttles/blocks automated fetchers (a live `efetch` scrape hung 8+ min), so
  the normalizer fetches server-side **with an API key + backoff**, then republishes the
  extracted passage — the agent never fetches eutils directly.
- **Crossref** `api.crossref.org/works/{doi}` — DOI metadata/abstracts.
- **NICE**, **USPSTF** — guideline bodies (HTML; normalizer extracts the recommendation).
- **Licensed compendia** (AHFS DI, Micromedex/DrugDex, Lexicomp) — the *payer-recognized*
  off-label authorities, reachable only via licensed APIs (out of scope here; R2 leaves room).

### 3.3 Support extraction (R1/R5)

The normalizer pulls the **decision-relevant** passage — the CONCLUSIONS/recommendation,
not the BACKGROUND — keyed to the requested drug + indication, and emits a compact doc whose
*whole content* is that support (so a single-snippet scraper cannot land the wrong line). It
quotes the source verbatim and attributes it (e.g. "Per the Cochrane systematic review,
PMID 28965364: 'bupropion decreased the severity of ADHD symptoms…'").

### 3.4 Provenance shape (R6)

```ts
interface EvidenceProvenance {
  sourceType: "doi" | "pmid" | "url";
  id: string;            // e.g. "28965364" | "10.1002/14651858.CD009504.pub2" | allowlisted URL
  tier: SourceTier;      // FDA_LABEL | SYSTEMATIC_REVIEW | GUIDELINE | NARRATIVE | PREPRINT | UNVETTED
  retrievedAt: number;   // unix seconds
  contentHash: string;   // keccak256 of the normalized doc (commit on-chain, parallels evidenceUri)
}
```

### 3.5 On-chain boundary

Unchanged from SPEC-0007/A0009: `agentEvidenceUrl` (the normalized doc URL) + its keccak
audit hash (`evidenceUri`) cross on-chain; the `contentHash` IS that keccak. No new PHI
surface. A future amendment MAY add an on-chain allowlist/tier registry + a guard requiring
`tier >= threshold` for approval.

## 4. Deliverables

- `src/evidence/normalizer.ts` — the normalization pipeline (vet → resolve → extract → tier → publish).
- `src/evidence/allowlist.ts` — the authoritative-source allowlist + tier map (governance-editable).
- `src/evidence/resolvers/` — openFDA, NCBI E-utilities, Crossref clients (server-side, keyed, backoff).
- `EvidenceProvenance` type + a `contentHash` helper (reuses `hashContent`).
- A scraper-friendly **published-doc** publisher (e.g. to the curie S3/CloudFront) for normalized evidence.
- (R9, optional) a source-vetting agent prompt/integration.
- Worked example: bupropion × ADHD normalized from **Cochrane PMID 28965364** → support-forward doc → appeal **Approve**; the adalimumab × plaque-psoriasis case continues to work via openFDA.
- Unit + integration tests (below); research note already in `docs/research/evidence-source-provenance.md`.

## 5. Test cases

- **T1 (R1/R2)** openFDA label normalizes — the indication list is surfaced as the prominent content.
- **T2 (R1/R3/R5)** Cochrane **PMID 28965364** normalizes — the efetch CONCLUSIONS passage (efficacy) is the prominent content; the bupropion×ADHD **appeal flips to Approve**.
- **T3 (R7) negative control** — a source about a *different* drug (bupropion paper for an adalimumab/psoriasis claim) → **deny / flag**, never approve.
- **T4 (R2/R3)** a non-allowlisted / self-hosted domain, or a bare URL with no DOI/PMID for literature → **rejected** (not accepted as public evidence).
- **T5 (R7)** a throttled/unreachable authority (e.g. eutils rate-limit) → **graceful failure** (retry/needs-more-info), never a wrong approve, never an indefinite hang.
- **T6 (R8)** normalized evidence + provenance contain no PHI / none of the 18 identifiers.
- **T7 (R4)** a low-tier source (narrative blog) does not satisfy an **off-label** approval even if reachable; the rationale states the tier.
- **T8 (R6)** provenance round-trips: `contentHash` equals the on-chain `evidenceUri` keccak for the published doc.

## 6. Pass / fail criteria

**PASS — all must hold:**
- [ ] Evidence flows through the normalizer; the agent reads only normalized, support-forward content (R1/R5).
- [ ] Only allowlisted authorities are accepted; literature is DOI/PMID-anchored (R2/R3).
- [ ] Each ruling carries provenance `{sourceType,id,tier,retrievedAt,contentHash}`; tier appears in the rationale (R4/R6).
- [ ] Off-label approval requires ≥ threshold tier; "used off-label" alone never approves (R4/R5).
- [ ] Irrelevant / unresolvable / non-allowlisted source → deny or flag, never approve (R7); throttled authority fails gracefully (T5).
- [ ] T2 bupropion×ADHD appeal **flips to Approve** via the normalized Cochrane source; T3 negative control denies.
- [ ] No PHI in normalized evidence or provenance (R8).

**FAIL — any triggers rejection:**
- An arbitrary/self-hosted URL is accepted as public evidence (R2 bypassed).
- An off-label case approves on "used off-label" with no support / below-threshold tier (R4/R5).
- An irrelevant source yields an approve (R7).
- PHI appears in normalized evidence or provenance.
- A ruling lacks evidence provenance.
- A throttled source causes an indefinite hang instead of graceful failure.

## 7. Out of scope

- **Licensed-compendia paid API integration** (AHFS/DrugDex/Lexicomp) — the true
  payer-recognized off-label authorities; deferred (R2 leaves room).
- **Signed-oracle attestation** and **stake-and-dispute** provenance — future, trustless
  variants (sketched in the research note).
- **Fully on-chain allowlist/tier enforcement** — basic version keeps the allowlist off-chain;
  an on-chain registry + approval guard is a later amendment.
- Changes to the decide **rubric** — SPEC-0007 R4/R7 stand; this spec changes *what the agent
  is shown*, not how it decides.

## 8. Open questions

- **OQ1 (HIGH) Trust in the normalizer.** Who runs it, and what does trusting it cover? It is
  off-chain glue (R11), but it chooses the support passage — does that need its own audit
  trail / second-agent check (R9) before V1?
- **OQ2 (MED) On-chain vs off-chain allowlist enforcement.** Start off-chain (config) and
  move to an on-chain registry + `tier >= threshold` guard later, or build the registry now?
- **OQ3 (MED) Replace vs augment the scrape.** Does the normalized doc *replace* the LLM
  Parse Website scrape (normalizer extracts; agent only decides), or feed it (normalizer
  publishes; scrape still runs)? Replacing removes the lossy-snippet failure entirely.
- **OQ4 (LOW) Paywalled payer-recognized compendia.** How to honor AHFS/DrugDex as the real
  authorities when they're not publicly fetchable — licensed API, or a curated mirror?
