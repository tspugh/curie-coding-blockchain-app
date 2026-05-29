# Specs

Fleshed-out specifications for what to build — one per file, named
`NNNN-kebab-title.md`. Every spec follows a standard structure (summary & user story,
requirements, technical documentation, deliverables, test cases, pass/fail criteria,
out of scope, open questions), enforced by the **`spec-author` skill**
(`.claude/skills/spec-author/`). Invoke it whenever writing or reviewing a spec.

Status is tracked inline below. Statuses: **done** (built and merged), **to implement**
(spec written, code not yet built), **draft** (spec still in motion).

- **done** · [`0001-mvp0-coverage-negotiation.md`](0001-mvp0-coverage-negotiation.md) — MVP0 coverage-exception negotiation loop.
- **done** · [`0002-demo-experience-and-integration-seam.md`](0002-demo-experience-and-integration-seam.md) — Live demo experience + FDA-label "gotcha" + CDS-Hooks seam.
- **to implement** · [`0003-token-flow-visibility.md`](0003-token-flow-visibility.md) — Design-decisions log for the UI surface: token-flow visibility (§2.1–§2.2), action coherence (§2.3), layout/error/parity polish (§2.4), wallet connection & onboarding (§2.5 — folded from former SPEC-0005), submit-amount gating by balance (§2.6), AI-reasoning + agent-receipt visibility (§2.7). Lower priority than 0004 (presentational vs functional) but bundles everything UI-surface.
- **to implement** · [`0004-data-and-evidence-model.md`](0004-data-and-evidence-model.md) — Shared-facts model: synthetic-note scenarios, real Part D formulary, frozen evidence packet, single-ruling-per-round, Medicaid MCO ladder. **Highest priority** of the in-flight two (functional).

See [`../../CLAUDE.md`](../../CLAUDE.md) for the full convention.
