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
- **draft** · [`0004-data-and-evidence-model.md`](0004-data-and-evidence-model.md) — Shared-facts model: cases (one per payer line) + custom path, real per-line formulary, structured-slice evidence packet + Merkle root + Curie packet store (S3+Lambda), ladder labels with R14a sequencing only (R14b enforcement deferred to V1.5), §2.6 arbiter policy defaults, R2b multi-wallet config. **Highest priority** of the in-flight specs (functional). Grilled 2026-05-29.
- **draft** · [`0005-usability-and-integration.md`](0005-usability-and-integration.md) — Usability criteria + the **headline integration gate**: full real-wallet, real-chain run from field-request to settled on Somnia testnet. Layout invariants verified by screenshot at named viewports (top-bar density, insurer Detail single-column, view-switch returns to Overview). Generalized N-user runtime registry; curated policy library + free-text override. Authored 2026-05-30 in response to user direction "the core priority now is integration test, not just unit tests".

**To do next:** SPEC-0005 R1 (integration-test script) is the new headline gate; SPEC-0005 R6-R8 (layout fixes verified by screenshots) are paired.

See [`../../CLAUDE.md`](../../CLAUDE.md) for the full convention.
