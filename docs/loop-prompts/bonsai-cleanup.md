# Bonsai Cleanup Loop Prompt

For sub-agents whose job is to **incrementally refine the project's non-research docs** — small careful trims, not destructive deletion. Designed to run alongside the `/research` skill in a recurring cron iteration.

## Goal

Given the project's evolving vision (ICD-10 coding by AI agents + decentralised insurance↔hospital agreement and fund release on the Somnia blockchain, drawing patterns from [`docs/reference/curie/`](../reference/curie/) and [`docs/reference/somnia-agent-kit/`](../reference/somnia-agent-kit/)), incrementally prune and consolidate the **non-research** documentation tree. The metaphor is bonsai: each iteration removes a few small cuttings, consolidates a redundancy, and tightens the shape — *never* a clear-cut.

## Constraints (hard)

- **Do NOT touch:**
  - `src/`, `package.json`, `package-lock.json`, `tsconfig.json`, `.env.example`, `node_modules/` — code and config.
  - `docs/research/` — research findings are the other sub-agent's territory.
  - `docs/reference/` — read-only external reference.
  - `docs/amendments/` — historical decision records.
  - `docs/raw/new/*audit*.md` — generated audit reports.
  - `.claude/` — Claude scaffolding (subagents, skills).
  - `AGENTS.md`, `CLAUDE.md`, `README.md` — authoritative project framing.
- **Do at most 3 substantive edits per run.** This is bonsai pruning, not a rewrite. Pick the highest-value cuts and leave the rest for the next iteration.
- **No file deletions without a clear consolidation target.** If you remove content from file A because it duplicates file B, link to it from B and only then delete A. If a file is wholly obsolete, archive it to `docs/raw/archived/` rather than `git rm`.
- **Cite the vision.** Every edit must trace back to a sentence in `AGENTS.md`, `CLAUDE.md`, `docs/ROADMAP.md`, `docs/reference/curie/context/medical-blockchain.md`, or `docs/domain/payer-architecture.md`. Do not cite `docs/PRODUCT.md`, `docs/VISION.md`, or `docs/PROTOTYPE_SPEC.md` — all three are superseded stubs or human-gated pre-pivot documents and cannot serve as valid citation sources. If you cannot cite from the authoritative set, do not edit.
- **PHI never on-chain.** If you encounter a doc that describes data flow without distinguishing on-chain from off-chain, **flag** it but do not "fix" — leave for human review.
- **Never use `rm`** — always `git rm` or `git mv`. Plain `rm` loses the index trail and has bitten this repo before.
- **Reframe over archive for domain content.** Before archiving any file containing user research, expert interviews, market/competitor analysis, regulatory facts, or other content with shelf life **beyond the current product framing**, default to **reframe** — add a historical-context header at the top (the way `docs/prior-analysis/medical-doctor-interview.md` is treated). Archive only if the content is *dominated* by stack-specific framing with no recoverable domain value. When in doubt, reframe. The competitor list, denial-rate figures, payer behaviours, and clinical workflow facts inside a stack-flavoured doc are still worth preserving in place.
- **`docs/prior-analysis/` is reframe-only.** Files in `docs/prior-analysis/` contain user-research / expert-interview / domain-discovery content with long shelf life. **Never archive a `docs/prior-analysis/` file** without an explicit human approval flag in the bonsai log first (see "Awaiting human approval" in the log format below). Add a historical-context header instead.
- **Confidence floor.** If you are < 70% confident a cut is correct, **defer it**. Add the proposed cut to the bonsai log under "Awaiting human approval" with the unresolved question that makes confidence borderline. Do not cut on a 51/49 judgment.
- **Pacing.** If the prior 2 entries in the bonsai log were no-ops or single micro-edits, default to **0–1 cuts** this run. Sustained activity in a near-clean repo is a smell. A 3-cut run after two no-ops needs a strong, distinct cite for each cut — and if you can't write one, you don't have three cuts.

## Scope (what's in)

The non-research, non-reference, non-amendment surface of `docs/`:

- `docs/VISION.md`, `docs/PRODUCT.md`, `docs/PROTOTYPE_SPEC.md`, `docs/ROADMAP.md`, `docs/COMPETITIVE.md` — top-level product docs.
- `docs/business-strategy/`, `docs/concepts/`, `docs/domain/` — knowledge salvaged from the old wiki.
- `docs/technical-design/` — historical tech-design records (most stale; tread carefully).
- `docs/linear-cards/` — historical Linear tickets (mostly stale; prune liberally where they reference dead workstreams).
- `docs/loop-prompts/` — running loop prompts (light edits only).
- `docs/prior-analysis/` — discovery-phase interviews and prior product design. **Reframe-only — see constraint above.**
- `docs/raw/archived/`, `docs/raw/new/` (excluding audits and reports), `docs/raw/todos/` — working notes; safe to consolidate or archive.
- `docs/demo/` — demo material (light touches).

## Per-run workflow

1. **Scan.** Run `git log --since="2 weeks ago" --oneline docs/` and `git status` to see what's recent. Open `docs/raw/new/bonsai-log.md` (create if missing) to avoid re-litigating prior runs. **Check the pacing constraint** — if the prior 2 entries were no-ops or single micro-edits, default to 0–1 cuts this run.
2. **Pick candidate targets (≤3).** Prioritise:
   - Direct contradictions between two docs (one must yield).
   - Stale references to retired stacks (Rust, AWS Comprehend, RDS, SQS, REST, SageMaker) that earlier audits didn't catch.
   - Vision-incongruent claims — e.g., a doc says "the product ends at coding" when the vision now extends to agreement & fund release on Somnia.
   - Linear-card content that is fully superseded by the pivot.
   - Concepts that should be unified with patterns from [`docs/reference/curie/`](../reference/curie/) (on-chain/off-chain split, attestation model, encrypted pub-sub) or [`docs/reference/somnia-agent-kit/`](../reference/somnia-agent-kit/) (contract roles for `AgentRegistry`, `AgentManager`, `AgentVault`, `AgentExecutor`).
3. **Apply the reframe/archive test.** For each candidate, ask: does it contain domain content (user research, competitor analysis, regulatory facts) with shelf life beyond the current product framing? If yes → reframe (header), not archive. If no, or if content is dominated by stack-specific framing → archive to `docs/raw/archived/`.
4. **Edit minimally.** Prefer rephrasing over deletion. When deleting, leave a one-line breadcrumb pointing to where the content moved.
5. **Cite each cut.** In your bonsai-log entry, name the vision sentence that justified the change. If you can't cite from the authoritative set, defer or skip.
6. **Update the bonsai log** at `docs/raw/new/bonsai-log.md` with a dated entry per run (format below).
7. **Commit.** `git add docs/ && git commit -m "bonsai: <one-line summary> — YYYY-MM-DD"`.
8. **Self-audit (every 5th run).** Count the entries in the bonsai log. If this run's number ends in 0 or 5 (5, 10, 15, 20, …), re-read the **prior 5 bonsai-log entries** and flag any cut you would have made differently knowing the current state. **Do not auto-reverse** any prior cut. Append the findings to your bonsai-log entry under a "Self-audit findings" section for the user to review.

## Bonsai log entry format

```markdown
## YYYY-MM-DD HH:MM — [one-line summary]

**Cuts** (≤3):
1. `docs/path/file.md:NN-MM` — what was changed in one sentence. *Justification:* "[quoted vision sentence]" — `AGENTS.md`/`CLAUDE.md`/`ROADMAP.md`/`medical-blockchain.md`/`payer-architecture.md`.
2. ...

**Consolidations:**
- `docs/A.md` ↔ `docs/B.md` — what duplication was resolved, which file became canonical.

**Awaiting human approval:** *(optional — for borderline cuts deferred under the confidence-floor rule, or for any proposed `docs/prior-analysis/` archive)*
- `docs/path/file.md` — the proposed cut and the unresolved question that makes confidence < 70%.

**Flagged for human review:** *(optional — for issues that need human action beyond this loop's scope)*
- `docs/path/file.md` — what's wrong but unsafe to auto-edit.

**Self-audit findings:** *(only on every-5th runs)*
- *Cut from pass N (date) — would I make this cut today?* Yes / no / uncertain + one-sentence reason.

**Next-iteration targets:**
- One or two candidates spotted but not pulled this run.
```

## Output

After the workflow, return a ≤200-word summary:

- Cuts made (file + one line each).
- Consolidations performed.
- Awaiting-approval items, if any.
- Flags raised for human review.
- Self-audit findings, if this was a 5th-run audit.
- 2–3 candidates for the next iteration.

Then exit. The next iteration will reorient.

---

**See also** — [[../research/topics/README|topic-hub index]] (the navigation graph this loop should keep healthy when files are added or removed) · [[iteration-prompt|iteration-prompt]] (the parent loop that invokes this one)
