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
- **to implement** · [`0003-token-flow-visibility.md`](0003-token-flow-visibility.md) — Design-decisions log for UI token-flow visibility (balance, per-tx cost, attribution) + §2.3 action coherence + §2.4 layout/error/parity polish. Lowest priority of the in-flight three (presentational).
- **to implement** · [`0004-data-and-evidence-model.md`](0004-data-and-evidence-model.md) — Shared-facts model: synthetic-note scenarios, real Part D formulary, frozen evidence packet, single-ruling-per-round, Medicaid MCO ladder. **Highest priority** of the in-flight three (functional).
- **draft** · [`0005-wallet-connection-and-session-model.md`](0005-wallet-connection-and-session-model.md) — Stub. Production wallet onboarding (embedded wallet + SSO + SIWE), demo path, profile-vs-wallet-vs-org. Functional foundation; sits between 0004 and 0003 in priority.

See [`../../CLAUDE.md`](../../CLAUDE.md) for the full convention.
