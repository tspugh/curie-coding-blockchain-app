---
name: spec-implementation-loop
description: Implement one or more docs/specs through the gated plan→build→verify→commit loop — a generalization of docs/loop-prompts/spec-4-implementation-loop.md across any spec(s), gate set, branch, or repo. Use when asked to "run the implementation loop", "implement spec NNNN", "do a loop tick", or to drive specs to a green-gates steady state. Invokes the bundled Workflow; do not run it as a shell script.
---

# Spec implementation loop

Runs **one tick** of the spec-implementation loop: plan a single focused unit of
work from the target spec(s), build it test-first (TDD red → dev green), run the
configured verification gates in parallel, retry the build until every gate is
green (or `maxRounds` is hit), then commit + push. It is the generalized,
parameterized form of [`docs/loop-prompts/spec-4-implementation-loop.md`](../../../docs/loop-prompts/spec-4-implementation-loop.md):
same phases and gates, but *which* specs, *which* gates, and *which* branch/repo
are all arguments.

## How it runs (important)

This skill is **not a shell script**. The loop lives in a **Workflow** —
`spec-implementation-loop.js` next to this file — written in the Claude Code
Workflow DSL, which only the harness interprets (`agent()`/`parallel()`/`phase()`
are runtime-injected). It runs *inside* an agent session and fans out subagents.

So the entry points are:

- **You tell Claude** — `/spec-implementation-loop` (optionally with which specs),
  or "run the implementation loop on specs 0005 and 0006". Claude then calls the
  Workflow tool (below). This is the normal path.
- **Continuous operation** — wrap the same instruction in `/loop` (no interval,
  self-paced) to re-fire it tick after tick, exactly how the spec-4 prompt was
  used. Each tick is one Workflow run.

You never invoke the `.js` from a terminal.

## What Claude does when this skill triggers

1. Parse the request into the args below (which specs, gate subset, branch, repo,
   dry-run vs commit). Defaults reproduce the spec-4 loop, so bare invocations work.
2. Call the **Workflow tool** with the bundled script by path:

   ```
   Workflow({
     scriptPath: ".claude/skills/spec-implementation-loop/spec-implementation-loop.js",
     args: { /* see below; omit for spec-4 defaults */ }
   })
   ```

   (The Workflow tool requires the user to have opted into orchestration — the
   word "workflow", an explicit request, or this skill's invocation all satisfy
   that. Watch live progress with `/workflows`.)
3. Relay the returned summary (unit, rounds, per-gate verdicts, whether it
   committed, any open findings) to the user.

## Args

All optional. With none, it implements every whole-number spec under
`docs/specs/` and auto-selects gates.

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `specs` | string[] | all `docs/specs/NNNN-*.md` | Spec files/globs to implement (skips `NNNN.N` fractional ledgers). |
| `focusSpecs` | string[] | — | Subset to prioritize this tick, e.g. `["0005","0006"]`. |
| `repoPath` | string | `"."` | Repo root the agents operate in. |
| `branch` | string | current | Working branch to assert + push to. |
| `baseRef` | string | `"origin/main"` | Diff base the gates review against. |
| `gates` | string[] | auto by what the unit touches | Subset of `tests coverage design secret solidity security strict browser`. |
| `focus` | string | — | Explicit unit description; skips the planning agent. |
| `mode` | string | `"impl"` | `"impl"` or `"creativity"` (explore unspecced roadmap ideas on a `creativity/*` branch + PR). |
| `maxRounds` | number | `3` | Build→verify retries before giving up. |
| `commit` | boolean | `true` | Commit + push when green; `false` = dry run, leaves the change in the tree. |

### Gate auto-selection

When `gates` is omitted, a gate runs only if the planned unit touches its tree:
`solidity` ⇐ `contracts/` changed, `design`/`browser` ⇐ `web/` changed,
`coverage` ⇐ any code tree. `tests`, `secret`, `security`, `strict` always run.
The Opus stickler gates (`solidity`, `security`, `strict`) require **zero
findings**; `coverage` ≥ 85% line+branch; `design` ≥ 90% conformance.

## Examples

- Default tick on the current branch: `/spec-implementation-loop`
- Two specs, review-only gates, dry run:
  `args: { focusSpecs: ["0005","0006"], gates: ["tests","secret","security","strict"], commit: false }`
- Fix a known finding without planning:
  `args: { focus: "Address strict-review finding: timeline doesn't backfill prior events on Detail mount", maxRounds: 2 }`
- A different repo entirely:
  `args: { repoPath: "../other-spec-repo", specs: ["docs/specs/0001-*.md"] }`

## Constraints carried from the spec-4 loop

- PHI never on-chain or in fixtures (synthetic only); no secrets in any commit;
  never `--no-verify` / `--force-push`.
- TDD runs *before* dev (true red→green); gates fan out in parallel because they
  are read-only reviews of the same diff.
- One focused unit per tick; no half-state left in the tree.

## Optional: invoke by name instead of path

To call it as `Workflow({ name: "spec-implementation-loop" })`, copy (or symlink)
`spec-implementation-loop.js` into `.claude/workflows/`. That dir is gitignored
in this repo, so the bundled-in-skill copy invoked by `scriptPath` is the
tracked, canonical one.
