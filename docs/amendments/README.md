# Amendments

Proposed changes to the spec, and a record of historical pre-pivot decisions. One file per amendment, ADR-style.

## Lifecycle

1. **Proposed** — written by the `spec-amendment-proposer` subagent or by a human. Lives here as a standalone document.
2. **Accepted** — the user marks status `Accepted`. The amendment is folded into the relevant `docs/` spec in a follow-up commit; the amendment file remains here as a durable decision record.
3. **Rejected** — kept here with status `Rejected` and a brief reason. Useful so we don't relitigate.
4. **Superseded** — replaced by a later amendment or by a direction change. Status updated to `Superseded by A-NNNN` (for a later amendment) or `Superseded by <pivot name>` (for a direction change). The contents stay here as a historical record.

## File naming

`NNNN-short-kebab-title.md`, where `NNNN` is the next free four-digit sequence number. Numbers are never reused.

## Format

Briefly:

- Title: `# A-NNNN: <short title>`
- Status block (blockquote at top): Status, Date, Affects, Supersedes (or Superseded by), short context
- Sections: Context, Decision, Consequences, Alternatives, Open questions

For richer guidance see the spec-amendment-proposer subagent prompt at [`.claude/agents/spec-amendment-proposer.md`](../../.claude/agents/spec-amendment-proposer.md) and the upstream lifecycle notes at [`docs/reference/curie/amendments/README.md`](../reference/curie/amendments/README.md).

## Rules

- One concern per amendment.
- No PHI in examples.
- Acceptance and folding into the spec are separate, human-reviewed steps. Don't edit upstream spec files from here.

## Index

| # | Title | Status |
|---|-------|--------|
| [A-0001](0001-original-phase-1-tasks.md) | Original Phase 1 tasks (entity extraction) | Superseded by Somnia chain-native pivot (2026-05-14) |
| [A-0002](0002-architecture-brainstorm-2026-04-05.md) | Original architecture brainstorm | Superseded by Somnia chain-native pivot (2026-05-14) |
| [A-0003](0003-ai-mediated-drug-coverage-exception-arbitration.md) | AI-mediated drug coverage-exception arbitration | Proposed |
