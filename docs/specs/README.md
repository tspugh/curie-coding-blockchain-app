# Specs

Fleshed-out specifications for what to build — one per file, named
`NNNN-kebab-title.md`. Every spec follows a standard structure (summary & user story,
requirements, technical documentation, deliverables, test cases, pass/fail criteria,
out of scope, open questions), enforced by the **`spec-author` skill**
(`.claude/skills/spec-author/`). Invoke it whenever writing or reviewing a spec.

- [`0001-mvp0-coverage-negotiation.md`](0001-mvp0-coverage-negotiation.md) — MVP0 coverage-exception negotiation loop.
- [`0002-demo-experience-and-integration-seam.md`](0002-demo-experience-and-integration-seam.md) — Live demo experience + FDA-label "gotcha" + CDS-Hooks seam.
- [`0003-token-flow-visibility.md`](0003-token-flow-visibility.md) — Design-decisions log for UI token-flow visibility (balance, per-tx cost, attribution).
- [`0004-data-and-evidence-model.md`](0004-data-and-evidence-model.md) — Shared-facts model: synthetic-note scenarios, real Part D formulary, frozen evidence packet, single-ruling-per-round.

See [`../../CLAUDE.md`](../../CLAUDE.md) for the full convention.
