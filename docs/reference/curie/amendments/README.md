# Amendments

Proposed changes to the Curie spec. One file per amendment, ADR-style.

## Lifecycle

1. **Proposed** — written by the `spec-amendment-proposer` subagent or by a human. Lives here as a standalone document.
2. **Accepted** — the user marks status `Accepted`. The amendment is then folded into `docs/spec/curie.md` in a follow-up commit; the amendment file remains here as a durable decision record.
3. **Rejected** — kept here with status `Rejected` and a brief reason. Useful so we don't relitigate.
4. **Superseded** — replaced by a later amendment. Status updated to `Superseded by A-NNNN`.

## File naming

`NNNN-short-kebab-title.md`, where `NNNN` is the next free four-digit sequence number. Numbers are never reused.

## Format

See the template in [`.claude/agents/spec-amendment-proposer.md`](../../.claude/agents/spec-amendment-proposer.md). Briefly:

- Title (`# A-NNNN: ...`)
- Status, Date, Affects, Supersedes
- Context, Decision, Consequences, Alternatives, Open questions

## Rules

- One concern per amendment.
- No PHI in examples.
- Acceptance and folding into the spec are separate, human-reviewed steps. Don't edit `docs/spec/curie.md` from here.

No amendments yet.
