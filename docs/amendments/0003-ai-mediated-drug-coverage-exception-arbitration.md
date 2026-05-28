# A-0003: AI-mediated drug coverage-exception arbitration

> **Status:** Proposed
> **Date:** 2026-05-26
> **Affects:** [`ROADMAP.md`](../ROADMAP.md) (north-star, demo loop, product scope), the app repo's `README.md` / `CLAUDE.md`, the contract spec.
> **Replaces:** the interim "patient-facing bill split & instant settlement" framing that briefly held this slot — never accepted, superseded by this after further design exploration.
>
> Curie becomes an **AI-mediated drug coverage-exception arbitration** protocol: a payer↔provider exchange where an on-chain AI mediator adjudicates a drug coverage/exception request against a **public** formulary, **public** clinical evidence, and **public** price benchmarks, over an auditable back-and-forth, settling through escrow. No PHI; insurer-provider in spirit.

---

## Context

A sequence of design explorations converged here. Two hard constraints did the steering:

1. **On-chain agent I/O is public.** Research [`on-chain-llm-inference-public-data-exposure.md`](../research/somnia/on-chain-llm-inference-public-data-exposure.md) confirmed Somnia's native agents emit inputs/outputs/receipts on-chain with no privacy layer. So the agent may only operate on **public data**, and nothing clinical/identifying can pass through it.
2. **We want the agent to be load-bearing, and we want real back-and-forth.** A judge (or a user) should see a negotiation, not a one-shot green check. That rules out lookups (fair-price, license checks — deterministic, no AI) and one-shot verdicts (no rounds).

Prior authorization has the ideal back-and-forth *shape* (request → "insufficient, justify" → rebut → rule → appeal → settle) but is the most PHI-soaked process in healthcare. **We borrow its shape and make every object public.**

Set aside along the way (see Alternatives): patient-facing bill split (agent not load-bearing), wellness micropayments (crowded), fair-price/credential marketplace (lookups, not AI-worthy), one-shot price arbiter (no rounds), procedures vertical (CPT licensing + PHI).

## Decision

Build **Curie: AI-mediated drug coverage-exception arbitration.**

**Vertical: drugs.** Public anchors are clean — published formularies, public price refs (NADAC, Mark Cuban Cost Plus, GoodRx, Medicare/Medicaid dashboards), drug identity via **RxNorm/NDC (free)**, and public drug-level evidence (clinical guidelines, **openFDA/DailyMed** labels, comparative-effectiveness). Drug formulary-exception / step-therapy / tier-exception is the most structured, repeatable PA argument. (Procedures rejected: CPT is AMA-copyrighted, criteria are more PHI-bound.)

**Actors.** Provider (requests coverage/exception) ↔ Payer = **insurer/plan** (whose published formulary sets the criteria) ↔ **AI mediator** (adjudicates each round).

**The exchange is a contract state machine; the AI mediator rules at each transition:**

```
Requested ──▶ (mediator rules) ──▶ { Approved | Denied | EvidenceRequested }
EvidenceRequested ──▶ provider submits public evidence ──▶ (re-rule)
Denied ──▶ provider appeals with new public evidence ──▶ (re-rule)
Approved ──▶ escrow settles (bounded by public price benchmark)
            also: Withdrawn
```

The back-and-forth comes from the lifecycle; the agent is invoked each round.

**What the AI actually does (the irreplaceable judgment):** weigh a **free-text clinical-evidence argument** against **free-text formulary criteria**. The formulary says, in prose, e.g. *"non-preferred; covered by exception on documented failure/contraindication of two preferred alternatives per guideline."* The provider cites public evidence; the mediator reads both and rules `approve | deny | need_more_evidence` with a rationale. This is text-vs-text reasoning a script cannot do.

**Mechanism (confirmed in Somnia docs via Context7):**
- **Reading public evidence:** `LLM Parse Website` → `ExtractString(key, description, options[], prompt, url, resolveUrl, numPages)` — fetch a formulary/guideline/label/price URL and return a constrained verdict (`options=["approve","deny","need_more_evidence"]`). — [docs](https://docs.somnia.network/agents/base-agents/llm-parse-website)
- **Multi-step reasoning:** `inferToolsChat(...)` supports conversation resume (`updatedRoles`/`updatedMessages`) and `mcpServerUrls`. — [docs](https://docs.somnia.network/agents/base-agents/llm-inference)
- **On-chain transcript:** Somnia **Data Streams** `streams.set([{ id, schemaId, data }])` for the schema'd, auditable exchange record. — [docs](https://docs.somnia.network/developer/data-streams/sdk-methods-guide)

**Where evidence is stored (no PHI anywhere):**
- Cited public evidence lives at its **public URL**; the agent fetches it on demand. On-chain: the **URL reference + the mediator's ruling/rationale + the receipt**.
- The exchange record (offers, rebuttals, rulings) → **Data Streams / events**.
- Bulky submitted documents → IPFS with the **hash** anchored on-chain.
- All cases **synthetic and non-identifying**; arguments stay at the drug + formulary + public-evidence level — never a patient chart.

**On-chain (public-safe):** non-identifying drug request descriptor (RxNorm/NDC, requested tier/exception type, amount), public-evidence URL references, each ruling + rationale, the exchange transcript, escrow + settlement events.

**Presentation directive:** public-facing artifacts (README, app, CLAUDE.md) must read as a **professional product**, not a hackathon demo. No "judges / 90-second demo / Agentathon" framing in the public repo. (Hackathon context stays internal, here and in the ROADMAP.)

## Consequences

- **Public-safe and PHI-free by construction** — sidesteps the on-chain exposure problem entirely.
- **The agent is genuinely load-bearing** (free-text evidence vs. free-text criteria) and **back-and-forth is structural** (the PA-shaped lifecycle).
- **Reuses the claim-lifecycle state-machine pattern** from prior specs, retargeted to a coverage-exception lifecycle; escrow + settlement carry over.
- **Narrative:** transparent, auditable drug-coverage adjudication grounded in public evidence — a money/coverage story, not a coding story.
- **Folding work (human-reviewed):** update `ROADMAP.md` north-star + scope + lifecycle; update the spec set toward the coverage-exception model.
- **Unchanged:** no-PHI-on-chain, TypeScript-only, `somnia-agent-kit`-first, no-REST, chain-native.

## Alternatives

- **Patient-facing bill split** (prior A-0003 framing) — the insurer/provider reasoning was off-chain; the native agent wasn't load-bearing.
- **Wellness micropayments** — crowded Web2 (insurer rewards) and Web3 (move-to-earn).
- **Fair-price + license-verification marketplace** — both are deterministic lookups, not AI-worthy.
- **One-shot price arbiter** — no back-and-forth.
- **Procedures vertical** — CPT licensing snag, criteria more PHI-bound, thinner public evidence.

## Open questions

1. How is the **settlement amount** set on approval — the requested price, or capped at a public benchmark (NADAC/Cost Plus)? — priority: high
2. **Reputation / appeal limits** — bound the number of rounds; track provider/payer behavior? — priority: medium
3. **Naming** — keep "Curie" (drop "Claims Protocol")? Package is still `curie-claims-protocol`. — priority: low
4. Which **public formulary source** anchors the demo (a published Medicare Part D formulary vs. a synthetic published formulary fixture)? — priority: high
