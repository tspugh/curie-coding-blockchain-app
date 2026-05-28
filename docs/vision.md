# Curie Negotiation Protocol — Strategic Vision

> **Converged 2026-05-28.** Produced through three rounds of adversarial co-design;
> Codex CLI played the adversarial reviewer. This document is the *strategic* vision
> (where the product goes, who buys it, what proves it works) — companion to
> [`docs/VISION.md`](VISION.md) (the product overview / what this product is).

---

## Foundation (where we are)

Coverage-exception protocol on Somnia ([SPEC-0001](specs/0001-mvp0-coverage-negotiation.md)):

- **Actors** ([A-0004](amendments/0004-actors-are-workflow-teams-async-not-live-individuals.md)): **Provider PA Team** ↔ **Payer UM Desk** ↔ **AI Mediator** ↔ **Patient Status**. Async, packet-driven. Agents act *on behalf of* staffed teams (front office, PA specialist, RCM, specialty-pharmacy liaison, UM workflow, PA vendor, PBM/formulary, nurse reviewer, medical-director escalation; patient as messenger).
- **Mechanic**: necessity arbiter (`approve | deny | need_more_evidence`) weighing the provider's cited public evidence against the insurer's attached policy criteria. A relied-on clause contradicting a cited public standard (FDA label) **voids** the contract (`PolicyInvalidated`).
- **Amount (v0)**: deterministic `min(requested, CostPlus × quantity)` — never AI-chosen.
- **Hard invariant**: PHI never on-chain or in the agent payload. v0 = synthetic.
- **Live demo**: <https://d2inaytdsjck4j.cloudfront.net/> (sim, no funds).
- **Verified live**: 50 STT on the Somnia testnet wallet.

## Roadmap horizon

- **V0** — protocol + demo, shipped.
- **V1.0** — judge-ready by ~2026-06-08. Real chain, real native-agent round-trip, functional UI, A-0004 framing.
- **V1.5** — Pair A pilot (below) + polish + autonomous policy-agents.
- **V2** — Suite expansion (A2 denial appeals as the first vector).
- **V3** — Deeper privacy + real settlement + real CDS-Hooks/CMS-0057-F integration.

---

## The product thesis (locked)

**Curie V1.5+ is Specialty Exception Arbitration**: an AI-mediated arbiter for medically-necessary drug coverage-exceptions involving specialty/biologic products.

- **Dispute**: necessity (not amount).
- **Ground truth**: policy criteria + FDA label + published guidelines (not public price).
- **Workflow**: specialty-pharmacy-led (the real operational centre).

**Generic-reimbursement-transparency** stays as: (a) the V1.0 demo's price-cap fixture — the legible mechanic for judges; (b) an *optional* later product if Pair A signals demand for transparent benchmark arbitration; (c) NOT a parallel build track.

## Privacy spine (locked)

**Hybrid: off-chain clinical reasoning + on-chain commitments + native agent for the public-data half only.**

For V1.5, a *new* contract entry-point — `recordClinicalAttestation(reqId, decision, rationaleHash, clauseRef, standardRef, attestationHash, attestor)` — enters [`CoverageNegotiation.sol`](../contracts/contracts/CoverageNegotiation.sol). It bypasses `_fireAgent` / `createRequest` / `handleResponse`; requires an authorized attestor signature (or both-party co-sign); drives the same terminal state transitions as `handleResponse`.

`requestAdjudication → handleResponse` stays intact, but the agent payload restricts to **public data only**: NADAC / Cost-Plus lookup, policy-clause-vs-FDA-label comparison, cited public-evidence URL fetch.

**Trust shifts** for the PHI half: from Somnia-validator-consensus (public, deterministic, byte-identical output) to **signed attestation** (an authorized off-chain reasoner). The neutral arbiter becomes *partly operator-mediated* for PHI-bearing reasoning — the explicit cost of HIPAA-compatible clinical reasoning.

Files affected for V1.5: `contracts/contracts/CoverageNegotiation.sol`; `src/contract/{types,real,simulated,abi}.ts`; a new spec for the attestation flow.

## GTM: Pair A pilot (defined)

**Pair A** = **specialty pharmacy / provider PA team** (operational owner) **+** **self-insured employer plan via benefits consultant / TPA** (observer-buyer with fiduciary interest).

Why this pair:
- Specialty pharmacy already coordinates provider ↔ payer ↔ manufacturer ↔ patient.
- Self-insured employers have direct cost interest; TPAs / benefits consultants have *fiduciary cover* for accepting an audit-grade recommendation.
- Avoids voluntary commercial payer adoption (presumed false — see GTM Honesty below).
- Avoids Medicaid-MCO procurement burden for a small team.

### Pilot spec

| Field | Value |
|---|---|
| **Scope** | 20–30 specialty exception cases, 4–6 weeks, one drug class |
| **Mode** | Shadow / non-binding — Curie recommends; the workflow side acts; outcomes observed |
| **Operators** | Specialty pharmacy PA team produces packet + acts on recommendation. TPA / benefits consultant treats the audit trail as appeal/escalation evidence. Patient gets read-only status. |
| **Metrics** | packet completion time; staff touches per case; missing-evidence rate; time to first payer response; recommendation-vs-final-outcome concordance; TPA willingness to accept the audit trail as fiduciary escalation material |
| **Falsification thresholds** *(hypothesis values — pilot-setup calibration required)* | < 30% actionable recommendations OR < 20% staff-time reduction → **pivot, not refine** |
| Out of scope | On-chain settlement (still an event marker in v0) |

## V1.0 demo framing

**Explicit vision demo + named V1.5 hypotheses.** Honesty signals product-thinking to judges and protects post-judge GTM (partner conversations need honesty, not theatrical certainty).

The V1.0 judge demo shows: a working chain-native arbitration primitive on Somnia testnet, synthetic data, the protocol pieces (necessity arbiter, deterministic cap as a *generic*-fixture mechanic, `PolicyInvalidated`, `ProviderRefused`, deposit-funded `createRequest` round-trip with the verified 50 STT wallet).

The demo's framing **also names what V1.5 still has to prove**:
- **H1 — Privacy hypothesis**: the hybrid spine is workable for PHI-bearing cases without losing audit-trail value.
- **H2 — Counterparty hypothesis**: Pair A can be recruited and will execute the 20–30-case shadow pilot.
- **H3 — Workflow hypothesis**: Curie's recommendation is actionable in real specialty exception cases (≥ 30% actionable, ≥ 20% staff-time reduction).

## GTM honesty: what we are NOT betting on

**Voluntary commercial payer adoption is presumed false.** The KFF data on PA adjudication (≈ 50M MA PA determinations in 2023, 6.4% denied, only 11.7% appealed, but 82% of appeals overturned) does not say payers are wrong — it says *friction is a feature for them*. A neutral arbiter that reduces friction and exposes inconsistency is what they actively resist. Stop pretending.

**CMS-0057-F is integration tailwind, not payer-pull.** API-exposure mandates (FHIR PA APIs by 2027) compel *plumbing*, NOT acceptance of third-party adjudication logic. Curie can integrate with the mandated PAS endpoint as an audit/recommendation source; the payer is not required to act on Curie's output.

**Credible adoption vectors** (in order of plausibility for a small team):
1. Self-insured employers + TPAs / benefits consultants — fiduciary transparency demand.
2. Specialty pharmacies as workflow centre.
3. Provider-side single-sided product (appeal-packet automation + audit trail without a payer counterparty).
4. Medicaid MCO + state oversight pilot (deferred — procurement-heavy).
5. CMS-0057-F PAS plug-in (interoperability tailwind, not adoption force).

## First ePA partnership target

**Specialty-pharmacy PA operations + smaller specialty-access workflow vendors.** NOT CoverMyMeds / Surescripts (too big, channel-conflicted, procurement-heavy). Hypothesis: specialty-access workflow vendors compete on access-workflow efficiency rather than payer-adjudication control, making them more receptive to an audit/recommendation layer.

## Updated stakeholder map

| Stakeholder | Role | Status |
|---|---|---|
| Specialty pharmacy PA operations | Workflow owner; produces packet; acts on recommendation | **Primary operator** |
| TPA / benefits consultant | Audit-trail consumer; fiduciary cover | **Primary buyer** |
| Self-insured employer | Cost interest; budget authority | Secondary buyer |
| Provider PA team | Submitter (often co-located with specialty pharmacy) | Operator |
| Patient | Status / messenger | Observer (read-only) |
| Payer / PBM | Receives appeal/escalation packet | External (not on rail in V1.5) |
| Manufacturer hub services | Adjacent in specialty access workflow | Context |
| Medicaid MCO + state oversight | Alternative pilot path | Deferred |
| RCM / AAPC / practice-management vendors | Distribution channels into provider workflow | Post-pilot |
| Patient advocacy orgs | Pressure / evidence | Not buyers |

## Direction priorities

- **V1.0 demo** — chain-native arbitration primitive + named hypotheses. Don't add features.
- **V1.5 build** — contract-surface fork for off-chain attestation; specialty-exception verticalization; recruit Pair A; run the 20–30-case pilot.
- **V2** — suite expansion: **A2 (denial appeals)** as first vector (KFF 82%-overturn wedge).
- **V3** — platform / SDK; real settlement; real CDS-Hooks / CMS-0057-F integration; second suite member.

## Legal posture

Curie produces an **audit-grade recommendation + negotiated-settlement record** for constrained disputes. **Not binding medical adjudication.** Binding status only arrives via explicit contract between specific counterparties for specific categories. Determinism guarantees repeatability, not correctness.

## Open items — human-decidable (next decisions)

These are explicitly *not* further reasoning to do; they require external input or human judgment:

1. **Pair A recruitment** — which specific specialty-pharmacy + TPA orgs to approach. Network + intros.
2. **Falsification threshold calibration** — 30% / 20% are hypothesis values; operators need to validate them for the specific drug class before pilot start.
3. **V1.5 implementation sequencing** — land the contract-surface fork before, alongside, or after the Pair A pilot starts. Engineering vs validation tradeoff.
4. **Off-chain LLM provider** for the hybrid spine — third-party API, self-hosted, or attested compute. Affects trust story + operating cost.
5. **Generics research branch** — keep as side track or drop entirely. Bandwidth question.
6. **Demo framing wording for judges** — write the "what V1.0 proves vs what V1.5 must prove" panel; needs human voice.

## Retired / rejected (be explicit)

- Voluntary commercial payer adoption as GTM — rejected.
- Doctor-vs-Insurer live-arbitration UI framing — rejected (A-0004 / Violet's reframe).
- Both-products-in-parallel (generic + specialty) — rejected.
- Architecture B with real PHI as the long-term spine — rejected (hybrid is the spine).
- CMS-0057-F as primary GTM force — rejected (integration tailwind only).
- CoverMyMeds / Surescripts as first ePA partner — rejected (too big, slow, conflicted).
- Platform / SDK play in V1–V2 — deferred (not before vertical proves).
- "V1.0 demo blends, V1.5 forks on signal" as a thesis strategy — rejected (deferral disguised as discipline).

---

*Produced through 3 rounds of adversarial co-design with the Codex CLI as adversarial reviewer. Round-3 verdict: CONVERGED.*
