# Specs

Fleshed-out specifications for what to build — one per file, named
`NNNN-kebab-title.md`. Every spec follows a standard structure (summary & user story,
requirements, technical documentation, deliverables, test cases, pass/fail criteria,
out of scope, open questions), enforced by the **`spec-author` skill**
(`.claude/skills/spec-author/`). Invoke it whenever writing or reviewing a spec.

Status is tracked inline below. Statuses: **done** (built and merged), **to implement**
(spec written, code not yet built), **draft** (spec still in motion).

- **done** · [`0001-mvp0-coverage-negotiation.md`](0001-mvp0-coverage-negotiation.md) — MVP0 coverage-exception negotiation loop.
- **draft** · [`0004-data-and-evidence-model.md`](0004-data-and-evidence-model.md) — Shared-facts model: cases (one per payer line) + custom path, real per-line formulary, structured-slice evidence packet + Merkle root + Curie packet store (S3+Lambda), ladder labels with R14a sequencing only (R14b enforcement deferred to V1.5), §2.6 arbiter policy defaults, R2b multi-wallet config. **Highest priority** of the in-flight specs (functional). Grilled 2026-05-29.

**To do next:** wallet/session work (formerly SPEC-0005, now folded into SPEC-0003 §2.5).
Tracked on the `spec-2-implementation` branch in this repo; will land via its own PR.

See [`../../CLAUDE.md`](../../CLAUDE.md) for the full convention.
