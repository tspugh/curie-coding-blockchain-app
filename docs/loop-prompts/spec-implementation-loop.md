# Spec implementation loop (generalized)

Generalized form of [`spec-4-implementation-loop.md`](spec-4-implementation-loop.md):
the same plan → build → verify → commit tick, but parameterized over *which*
specs, *which* gates, and *which* branch/repo. The loop itself is a **Workflow**
fronted by the **`spec-implementation-loop` skill** — see
[`.claude/skills/spec-implementation-loop/SKILL.md`](../../.claude/skills/spec-implementation-loop/SKILL.md).

## One tick

Tell Claude to run it (it calls the Workflow tool — not a shell script):

> `/spec-implementation-loop`  ·  or  ·  "run the implementation loop on specs 0005 and 0006, review gates only, dry run"

Args (all optional; defaults reproduce the spec-4 loop) are documented in the
skill: `specs`, `focusSpecs`, `repoPath`, `branch`, `baseRef`, `gates`, `focus`,
`mode`, `maxRounds`, `commit`.

## Continuous operation

To run tick after tick the way the spec-4 prompt was used, wrap it in `/loop`
with no interval (model self-paces):

> `/loop run the spec-implementation-loop on the current branch`

Each tick is one Workflow run: it plans one focused unit, builds it test-first,
runs the configured gates in parallel, retries the build until green (or
`maxRounds`), then commits + pushes. Stop the loop to stop.

## How it differs from the spec-4 prompt

- **Deterministic control flow.** Phase order, the gate set, and the
  build-until-green retry are JS in the Workflow, not instructions the model
  re-derives each tick — so a tick can't silently skip a phase or a gate.
- **TDD before dev.** The original fanned them out in parallel then reconciled;
  the Workflow shares one working tree, so it runs true red→green.
- **Gates auto-select** by what the planned unit touches (no Solidity review on a
  docs-only change), overridable with `gates`.

The hard invariants are unchanged: no PHI on-chain or in fixtures, no secrets in
commits, no `--no-verify`/`--force-push`, one focused unit per tick.
