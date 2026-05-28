# Curie Negotiation Protocol — Vision

**One-liner.** Curie Negotiation Protocol is an agent-mediated drug coverage-exception
arbitration protocol on Somnia: provider and payer workflow teams submit positions
asynchronously, an on-chain **AI necessity arbiter** rules each round against *public*
formulary, clinical evidence, and price benchmarks, and approved coverage settles
through escrow — with **no protected health information on-chain**.

## Where this product sits

Curie Negotiation Protocol is the first concrete product of the Curie suite —
**protocols and agents that sit at the interfaces between healthcare's parties**
(providers, payers, PBMs, regulators, patients). Each product in the suite formalises a
specific inter-party exchange that today runs on faxes, portals, and phone calls. This
one tackles **drug coverage exceptions and prior authorization for non-formulary or
step-therapy-gated drugs.**

## The problem

Getting a non-formulary or gated drug covered is a slow, opaque, asynchronous
paperwork shuffle. The provider's prior-auth team files a request, the payer's UM desk
asks for justification, decisions take days, denials escalate through multi-level
appeals, and the criteria each side applies — and the evidence that would satisfy them
— are rarely visible to the other side. The patient is the messenger, not a party. No
neutral, auditable record exists.

The framing is **not** "doctor and insurer hop on an app and argue live." Per
[A-0004](amendments/0004-actors-are-workflow-teams-async-not-live-individuals.md),
the realistic actors are **workflow teams** working **asynchronously**:

- **Provider PA Team** — front office, PA specialist, MA, RCM, specialty-pharmacy
  liaison (or an agent acting from a submitted clinical packet).
- **Payer UM Desk** — UM workflow, PA vendor, PBM/formulary system, nurse reviewer,
  medical-director escalation.
- **AI Mediator** — the on-chain necessity arbiter.
- **Patient Status** — a read-only status view; the patient is *not* a signer.

## The product

A coverage-exception request flows through the protocol as an asynchronous,
packet-based exchange anchored on Somnia. A **de-identified note** is hash-committed
once as shared factual ground truth — both sides verify they hold the byte-identical
note via the on-chain hash. The Provider PA Team submits a packet requesting coverage
or a formulary exception for a drug (RxNorm/NDC), citing **public** evidence (clinical
guideline, FDA label, comparative-effectiveness data) **by reference**. The AI
Mediator reads the **public** formulary criteria and the cited public evidence and
rules: **approve**, **deny** (with reasons), or **request more evidence**. Each
ruling is an on-chain state transition with an auditable receipt. The parties loop
until resolved or the appeal path is exhausted; on approval, **escrow settles** at a
price within a public-benchmark band.

### The FDA-label gotcha

A request for a drug **on-label for the diagnosis** generally does not need this
protocol — the payer's own formulary path covers it. The value lands on
**off-label**, **step-therapy override**, **non-formulary**, or **non-preferred-tier
exception** requests — exactly the cases that today get bounced through paperwork. The
mediator must be explicit about which lane a given request sits in and rule
accordingly (see [SPEC-0001](specs/0001-mvp0-coverage-negotiation.md) and
[A-0003](amendments/0003-ai-mediated-drug-coverage-exception-arbitration.md)).

## What's load-bearing about the chain

Somnia provides **the chain and the agent layer in one place** — high-throughput,
sub-second finality fast enough that an asynchronous exchange still resolves quickly,
plus native agent primitives the mediator runs on. The AI Mediator's reasoning is
**consensus-verified** by the same validators that order the transactions, and its
ruling receipt is public on-chain.

A smart contract holds the coverage-exception lifecycle state machine, the
de-identified-note hash commitment, and the settlement escrow. Provider and payer
clients hold on-chain identities and submit signed transactions; public evidence stays
at its public source and is fetched on demand. Only references, rulings, the exchange
transcript, and settlement touch the chain.

## Privacy — a hard rule

**No PHI on-chain, and none through the AI Mediator.** The mediator's inputs and
outputs are public on-chain by construction; the protocol therefore operates on a
**de-identified note** plus **public references** only. Arguments stay at the drug +
diagnosis class + formulary + public-evidence level, never a real patient chart.
Robust de-identification (HIPAA Safe Harbor / Expert Determination) is a production
obligation; current development uses **synthetic notes**.

## Where to read next

- Specs: [`docs/specs/`](specs/) — current build target is
  [`SPEC-0001 — MVP0 Coverage Negotiation`](specs/0001-mvp0-coverage-negotiation.md).
- Decisions: [`docs/amendments/`](amendments/) — A-0001 through A-0004.
- Domain reference: [`docs/domain/payer-architecture.md`](domain/payer-architecture.md).
- Reference material: [`docs/reference/`](reference/).
- Tech-stack and persona constraints for coding agents: [`AGENTS.md`](../AGENTS.md).
