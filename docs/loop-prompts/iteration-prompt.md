# Iteration prompt for the headless research + bonsai loop

This is the prompt fed to `claude -p` by the Linux cron entry on the Pi (see [`scripts/cliqueue-loop.sh`](../../scripts/cliqueue-loop.sh)).

**Headless-mode constraints:** `claude -p` does not auto-discover skills under `.claude/skills/`. So this prompt uses `Agent` for *both* sub-agents (pointing each at its respective spec file) rather than `Skill(skill: "research")`. The sub-agents then read and follow their respective markdown files.

---

Two-agent iteration of the cliqueue research + bonsai loop. Spawn both sub-agents in parallel via two `Agent` tool calls in one message:

a. **RESEARCH** — call the `Agent` tool with:
   - `subagent_type`: `"general-purpose"`
   - `model`: `"sonnet"`
   - `description`: `"Research iteration"`
   - `prompt`: "You are the research sub-agent for one iteration of the research+bonsai loop. Read `/srv/ssd/Projects/cliqueue-coding-blockchain/.claude/skills/research/SKILL.md` and follow its Orient → Investigate → Document phases strictly. You may spawn ONE further sub-agent per Phase 2. At the end, commit findings to `docs/research/` with the format documented in the SKILL.md. Return a ≤300-word summary: the open question investigated, the key findings, design implications, next-iteration priorities."

b. **BONSAI** — call the `Agent` tool with:
   - `subagent_type`: `"general-purpose"`
   - `model`: `"sonnet"`
   - `description`: `"Bonsai cleanup iteration"`
   - `prompt`: "You are the bonsai sub-agent. Read `/srv/ssd/Projects/cliqueue-coding-blockchain/docs/loop-prompts/bonsai-cleanup.md` and follow its constraints strictly — at most 3 substantive edits, cite a vision sentence for every cut, never `rm` (only `git rm`/`git mv`), update `docs/raw/new/bonsai-log.md`, commit with message format `bonsai: <summary> — YYYY-MM-DD`. Return a ≤200-word summary."

After both complete, print a ≤200-word summary covering: the research question investigated, the bonsai cuts made, and anything flagged for human review.

---

**See also** — [[../research/research-questions|research-questions]] (the backlog this loop draws from) · [[../research/topics/README|topic-hub index]] (where investigated questions land in the navigation graph) · [[bonsai-cleanup|bonsai-cleanup prompt]] (the companion prompt this iteration invokes)
