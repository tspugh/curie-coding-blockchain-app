# UI QA Loop — SUPERSEDED

This loop prompt described a QA sweep of the old React/Axum UI (`localhost:5173`) and
REST endpoints (`/api/v1/tasks`, `/api/v1/codes/search`, etc.) from the `icd-10-parser`
project. It directly conflicts with the current `AGENTS.md` "No REST" constraint and
references paths in `/srv/ssd/Projects/icd-10-parser/` that belong to the prior codebase.

Archived to: `docs/raw/archived/loop-prompts-ui-qa.md`

A replacement QA loop for the Somnia chain-native system should target contract call
round-trips, event subscription correctness, and `somnia-agent-kit` integration — not
HTTP REST endpoints. Write that prompt once the first Somnia contracts are deployed.

---

**See also** — superseded. The active loop prompt is [[iteration-prompt]].
