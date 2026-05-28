# Healthcare Payer Architecture — Domain Reference

The standard ownership split in US healthcare payer architectures for prior authorization, contracts, benefits, medical policy, and related artefacts.

**Project context:** cliqueue-coding-blockchain replaces parts of the **agreement and fund-release flow** between hospitals and payers. Understanding which payer subsystem owns which decision is foundational for the on-chain agreement design — the `ClaimsAdjudicator` consumes outputs from several of these systems but should not re-implement them.

---

## Prior authorization ownership

Prior authorization is handled by **Utilization Management (UM)**.

That may live inside the health plan, PBM, delegated medical group, or a third-party PA vendor. Providers submit the request, but the **payer-side UM / prior-auth system owns** the review workflow, medical necessity checks, approvals, denials, and auth status.

## Contract ownership

The contract is owned **outside** prior auth. The owning system depends on which contract you mean:

| Contract type | Typical owner / system |
|---|---|
| Provider contract | Provider network / contract management system |
| Member benefit plan / coverage contract | Benefits administration / plan configuration system |
| Employer group contract | Group / account administration system |
| Drug / formulary / rebate contract | PBM / formulary / rebate management |
| Vendor contract | Legal / procurement / vendor management |

## Clean domain model

In most payer architectures, **prior auth consumes contract, benefit, coverage, network, and medical policy data — it should not be the source of truth for the contract.**

A clean domain model:

- **Contract system** — negotiated terms, network participation, rates, effective dates, plan/group terms.
- **Benefits / configuration system** — coverage rules, copays, exclusions, limits.
- **Medical policy / UM rules system** — criteria for medical necessity.
- **Prior auth system** — auth requests, reviews, decisions, status, correspondence, and audit trail.

---

## Implications for cliqueue

The on-chain agreement layer most naturally interfaces with:

- The **claim adjudication** flow (downstream of prior auth, when a claim is submitted with codes).
- The **contract system** (for rate / network / effective-date checks consumed by adjudication).
- The **benefits / configuration system** (for coverage / copay / limit checks consumed by adjudication).

The on-chain `ClaimsAdjudicator` should treat prior-auth outcomes as **inputs** (an auth-status hash referenced by the claim) rather than re-implement UM workflow. Contract terms and benefit rules feed the adjudication policy attestation, but their source of truth remains in the payer's contract / benefits systems off-chain.

**Adjacent ownership map:**

| Subsystem | Owned by | cliqueue's relationship |
|---|---|---|
| Prior auth status | Payer UM / PA vendor | Input (hashed auth reference) |
| Contract terms / rates | Payer contract management | Input (referenced by adjudication policy) |
| Benefit rules / copays | Benefits administration | Input (referenced by adjudication policy) |
| Medical necessity criteria | Medical policy / UM rules | Input (referenced where applicable) |
| Claim coding | Hospital coding agent (Symphony + Somnia native LLM Inference attestation) | **Owned on-chain** (HMAC-hashed codes + attestor) |
| Claim adjudication state | cliqueue `ClaimsAdjudicator` | **Owned on-chain** (5-state machine + dispute tier) |
| Payment release | cliqueue USDC escrow contract | **Owned on-chain** (triggered on `Settled`) |
| EDI 837/835 reconciliation | Hospital + payer adapters | Bridged off-chain by adapters reading on-chain events |

---

**See also** — [[../research/topics/x12|X12 EDI hub]] · [[../research/topics/prior-auth|Prior auth (PA) hub]] · [[../research/topics/cda|HL7 CDA hub]] · [[../research/topics/hipaa|HIPAA hub]]
