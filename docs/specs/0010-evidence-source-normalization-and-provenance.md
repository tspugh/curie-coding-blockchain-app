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
- **R2 (MUST) Authoritative-source allowlist with curated defaults.** Public evidence is
  accepted only from sources on an **allowlist**. The app ships a **default set** of
  recognized authorities (openFDA/DailyMed, PubMed/PMC via NCBI E-utilities, NICE, USPSTF,
  and — where licensed — compendia APIs). A source that matches no enabled allowlist entry is
  **not** accepted as public evidence (→ R7). The default entries are always present and
  **resettable**; they MAY be disabled but not deleted. (Data model + defaults: §3.6.)
- **R2a (MUST) Allowlist is viewable and extensible in Settings.** The app surfaces the
  allowlist in **Settings** as a list — each entry showing its label, match rule, source
  tier (R4), and enabled state — and lets the operator **add**, **remove** (custom entries
  only), **enable/disable**, and **reset to defaults**. (UI: §3.6 / R12.)
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
- **R12 (MUST) Approved-sources Settings panel.** Settings includes an **"Approved evidence
  sources"** panel that renders the allowlist: defaults + custom entries, each with label,
  match rule, tier, and an enable toggle; an **add-source** form (label, match rule, tier);
  **remove** (custom only); and **reset to defaults**. Built-in defaults are visually marked
  and cannot be deleted (only disabled). The panel is the human-facing view of R2/R2a.
- **R13 (MUST) Allowlist edits are a governance action, not a provider action.** Adding a
  source widens what counts as authoritative, so it MUST NOT be a control a *claim submitter*
  (provider) can use to self-approve their own evidence — that would reintroduce the very
  attack R2 prevents. In the **demo/local** build the panel writes a client-side list
  (operator convenience), **clearly labeled** as a stand-in. In **production**, allowlist
  membership is **payer/governance-controlled** (e.g. an insurer-scoped list or an on-chain
  registry); a provider-proposed source enters only after approval. The UI MUST state this
  boundary so the demo's local-edit affordance is not mistaken for the production trust model.

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

### 3.6 Approved-source allowlist — data model, defaults, matching, Settings UI

**Source tiers (R4).** Ordered, so an approval can require `tier >= threshold`:

```ts
enum SourceTier {
  FDA_LABEL = 5,          // openFDA / DailyMed structured label
  SYSTEMATIC_REVIEW = 4,  // Cochrane / meta-analysis (PMID/DOI)
  GUIDELINE = 3,          // specialty-society / national guideline (AACAP, NICE, USPSTF)
  PEER_REVIEWED = 2,      // indexed primary literature (PMID/DOI)
  NARRATIVE = 1,          // narrative review / reference page
  UNVETTED = 0,           // anything else — never satisfies an off-label approval
}
```

**Allowlist entry.**

```ts
interface ApprovedSource {
  id: string;            // stable id (e.g. "openfda", "ncbi-eutils")
  label: string;         // human label shown in Settings ("openFDA drug label")
  match: SourceMatch;    // how a submitted source is matched (below)
  tier: SourceTier;      // tier assigned to evidence from this source
  builtin: boolean;      // true = shipped default (cannot be deleted, only disabled)
  enabled: boolean;      // operator/governance toggle
}

type SourceMatch =
  | { kind: "host"; host: string }            // exact host, e.g. "api.fda.gov"
  | { kind: "urlPrefix"; prefix: string }     // URL starts-with, e.g. "https://eutils.ncbi.nlm.nih.gov/"
  | { kind: "identifier"; scheme: "pmid" | "doi" }; // resolved via the canonical resolver (R3)
```

**Curated defaults (shipped, `builtin: true`).**

| id | label | match | tier |
|----|-------|-------|------|
| `openfda` | openFDA drug label | host `api.fda.gov` | FDA_LABEL |
| `dailymed` | DailyMed label | host `dailymed.nlm.nih.gov` | FDA_LABEL |
| `pubmed` | PubMed (PMID) | identifier `pmid` (resolves via NCBI E-utilities) | PEER_REVIEWED* |
| `pmc` | PubMed Central | urlPrefix `https://www.ncbi.nlm.nih.gov/pmc/` | PEER_REVIEWED* |
| `crossref` | Crossref (DOI) | identifier `doi` | PEER_REVIEWED* |
| `nice` | NICE guidance | host `www.nice.org.uk` | GUIDELINE |
| `uspstf` | USPSTF | host `www.uspreventiveservicestaskforce.org` | GUIDELINE |

\* The *delivered* tier for a PMID/DOI is refined by publication type — a Cochrane/
systematic review resolves to `SYSTEMATIC_REVIEW`, a guideline to `GUIDELINE` — read from
the resolver metadata; `PEER_REVIEWED` is the floor.

**Matching algorithm.** For a submitted source: (1) if it is a bare `pmid`/`doi`, match the
`identifier` entries and resolve via R3; (2) else parse the URL and match `host` then
`urlPrefix` entries; (3) the first **enabled** matching entry assigns the tier; (4) **no
enabled match → reject** (R7). Disabled and deleted-custom entries never match.

**Storage.** Defaults live in code (`src/evidence/allowlist.ts`). Custom + toggle/override
state persists client-side under `curie:approvedSources` (localStorage), merged over the
defaults at load — exactly the `keyOverride` pattern (SPEC-0008). "Reset to defaults" clears
the override key. (Production: this store is replaced by the payer-governed list / on-chain
registry per R13 — same merge shape, different source of truth.)

**Settings UI (R12).** An "Approved evidence sources" panel:
- a **list** of entries (defaults first, marked `built-in`; then custom), each row: label ·
  match rule · tier badge · enable toggle · remove (custom only);
- an **add-source** form: label, match kind + value, tier (validated — e.g. a host must be a
  bare hostname, a urlPrefix must be https);
- **reset to defaults**;
- a **trust banner** stating R13: in this build the list is a local operator convenience; in
  production it is payer/governance-controlled and a provider cannot self-approve a source.

testids (for the agent-browser e2e): `approved-sources-panel`, `approved-source-row-<id>`,
`approved-source-toggle-<id>`, `approved-source-add`, `approved-source-reset`.

## 4. Deliverables

- `src/evidence/normalizer.ts` — the normalization pipeline (vet → resolve → extract → tier → publish).
- `src/evidence/allowlist.ts` — `SourceTier`, `ApprovedSource`/`SourceMatch` types, the curated
  **defaults** (§3.6 table), the **match** function (returns tier or reject), and the
  defaults⊕override **merge** (localStorage `curie:approvedSources`).
- `web/src/views/Settings` "Approved evidence sources" panel — list + add + remove + toggle +
  reset + the R13 trust banner (testids per §3.6).
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
- **T9 (R2/R2a)** the curated **defaults** are present at first load; `match()` returns the right tier for each (openFDA→FDA_LABEL, a Cochrane PMID→SYSTEMATIC_REVIEW, NICE→GUIDELINE); a source matching no enabled entry is rejected.
- **T10 (R2a/R12)** Settings: add a custom source → it matches; **disable** a default → sources from it are now rejected; **remove** a custom entry → it no longer matches; a built-in cannot be removed; **reset** restores defaults and clears the override.
- **T11 (R13)** built-ins are marked non-deletable; the trust banner is present; (production-shape) a provider-role cannot mutate the allowlist — only the governance/operator path can.
- **T12 (R2a)** add-source validation: a `host` rule rejects a full URL / path; a `urlPrefix` rule requires `https://`; an invalid entry is not added.

## 6. Pass / fail criteria

**PASS — all must hold:**
- [ ] Evidence flows through the normalizer; the agent reads only normalized, support-forward content (R1/R5).
- [ ] Only allowlisted authorities are accepted; literature is DOI/PMID-anchored (R2/R3).
- [ ] Each ruling carries provenance `{sourceType,id,tier,retrievedAt,contentHash}`; tier appears in the rationale (R4/R6).
- [ ] Off-label approval requires ≥ threshold tier; "used off-label" alone never approves (R4/R5).
- [ ] Irrelevant / unresolvable / non-allowlisted source → deny or flag, never approve (R7); throttled authority fails gracefully (T5).
- [ ] T2 bupropion×ADHD appeal **flips to Approve** via the normalized Cochrane source; T3 negative control denies.
- [ ] No PHI in normalized evidence or provenance (R8).
- [ ] Curated defaults ship and match to correct tiers; Settings lists them and supports add / remove (custom) / enable-disable / reset (R2/R2a/R12).
- [ ] Built-in defaults cannot be deleted (only disabled); a disabled source is rejected; the R13 trust banner is shown.

**FAIL — any triggers rejection:**
- An arbitrary/self-hosted URL is accepted as public evidence (R2 bypassed).
- A claim-submitter (provider) can add to the allowlist and self-approve their own source (R13 bypassed).
- A built-in default can be deleted, or "reset" does not restore defaults.
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
- **OQ5 (HIGH) Who governs the allowlist in production (R13)?** Options: a single
  protocol-curated default set; a **per-insurer** scoped list (each payer approves its own
  sources); or an **on-chain registry** mutated by a governance role. The demo uses a local
  client-side list as a stand-in — the production owner of "what counts as authoritative"
  must be decided before V1, since it is the crux of the trust model.
