# A-0004: Actors are workflow *teams* doing *async* work — not two individuals arguing live

> **Status:** Accepted (product owner + reviewer feedback, 2026-05-28)
> **Date:** 2026-05-28
> **Affects:** SPEC-0001 (actors / user stories / framing), SPEC-0003 (registry roles), `docs/motivation.md`, the web-app actor labels.
> **Origin:** Review feedback from Violet (project co-worker).

## Context

The prior framing cast the parties as a **doctor** and an **insurance agent** who "hop on an app and argue in real time." Review feedback (Violet) — the realistic workflow is **asynchronous and team/workflow-driven**, not a live two-person debate:

- Most prior-auth / appeal back-and-forth is **paperwork routed by staff**, with the **patient often the frustrated messenger** between sides. Doctors occasionally call the payer, but the per-request "clinician ↔ insurer live in an app" premise — especially for non-life-threatening drugs/procedures — **isn't realistic**.
- **Real provider-side actors:** front office, prior-auth specialist, MA, RCM team, specialty-pharmacy liaison — *or an agent acting from a submitted clinical packet*.
- **Real payer-side actors:** UM workflow, PA vendor, PBM/formulary system, nurse reviewer, medical-director escalation.
- **Patient:** the messenger/status-watcher, not a transacting party.

## Decision

Reframe the actors as **workflow roles**, and the premise as **async, packet-based mediation** (not a live chat). Canonical actor labels (replacing "Doctor"/"Insurer"):

| Old | New | Who it really is |
|---|---|---|
| Doctor / Provider | **Provider PA Team** | front office, PA specialist, MA, RCM, specialty-pharmacy liaison, or an agent acting from a submitted clinical packet |
| Insurer | **Payer UM Desk** | UM workflow, PA vendor, PBM/formulary system, nurse reviewer, medical-director escalation |
| (the agent) | **AI Mediator** | the on-chain necessity arbiter (unchanged mechanics) |
| (n/a) | **Patient Status** | the patient as a read-only status/messenger view — not a signer/party |

**Premise:** parties submit packets / positions / evidence **asynchronously**; the AI Mediator adjudicates against public criteria; status is **observable** by all (incl. the patient). The protocol's value is **replacing the async paperwork shuffle with a neutral, auditable, automatable record** — not putting two people in a room.

## Consequences

- **No change to contract/adjudication mechanics** (SPEC-0001 necessity arbiter, deterministic cap, `PolicyInvalidated`, state machine) — this is **framing, labels, and async emphasis**.
- **Reinforces the V1 autonomous-policy-agents direction** (SPEC-0003 / V1): an agent acting *from a submitted clinical packet* on each side is now the *primary* mode, not a nice-to-have — it matches how the work is actually staffed.
- **Relabel** the web-app tabs/roles to Provider PA Team / Payer UM Desk / AI Mediator / Patient Status (cheap; deferred with the next UI pass — not now).
- **Folds into:** SPEC-0001 user stories (rewrite around teams + async submission), SPEC-0003 registry (parties are **orgs/teams**, not individuals; a role can be a service account / agent), and `docs/motivation.md` (the "neutral async substrate that replaces paperwork routing" framing).
- **Patient as a (read-only) participant** becomes a concrete V1 consideration (a status view; possibly an invited observer), where before the patient was absent.

## Alternatives considered

- **Keep the individual "doctor vs insurer, live" framing** — rejected: unrealistic for the staffed, async reality of PA/appeals; undersells the automation value.

## Open questions

1. Does **Patient Status** get an actual (read-only) role/view in V1, or stay purely a label? — priority: medium
2. Async **packet submission** UX (a provider PA team submits a clinical packet once; the agent works from it) vs. the current per-action flow — how much to model in V1. — priority: medium
3. Registry (SPEC-0003) role granularity — org-level vs. seat/sub-account (e.g., a PA specialist acting for a practice). — priority: low
