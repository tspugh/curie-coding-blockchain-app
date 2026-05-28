# Docs

This directory is the source of truth for Curie. Everything needed to design, evaluate, and regenerate the system lives here.

## Layout

- `spec/` — the protocol, product, and architecture specs. These are the regeneration source: any branch with code is built from a snapshot of these specs.
- `context/` — background research, hackathon framing, platform notes, market analysis. Inputs to specs, not specs themselves.
- `amendments/` — ADR-style proposed changes to the spec. Written by the `spec-amendment-proposer` subagent (or by humans). Lifecycle: Proposed → Accepted (then folded into `spec/`) → kept as a permanent decision record.

## Conventions

- **Specs are durable**, context is exploratory. Promote material into `spec/` only when it has stabilised.
- **One concern per file.** Splitting is cheap; merging is costly.
- **Cross-link, don't duplicate.** If a fact lives in one place, link to it; don't restate it.
- **PRs to `main` are usually markdown.** Code is the output of these specs, not the input.
- **Be explicit about onchain vs. off-chain** anywhere you describe data flow. PHI never goes onchain.

## Index

### Specs
- [`spec/curie.md`](spec/curie.md) — Curie protocol and product spec
- [`spec/demo-ui.md`](spec/demo-ui.md) — Demo UI: one CurieConsole pattern, role bindings (hospital operator, specialist, patient/family, regulator), cross-cutting components, demo-stage composition
- [`spec/api.md`](spec/api.md) — Backend contract: identity model, chain events, encrypted pub-sub and notification relay, long-running agent runtime, standing-rules data model, storage, auth

### Context
- [`context/somnia-agentathon.md`](context/somnia-agentathon.md) — Somnia Agentathon programme and Somnia platform background
- [`context/agentathon-demo.md`](context/agentathon-demo.md) — Live demo staging plan: stage layout, choreography, fallbacks, practice plan

### Amendments
- [`amendments/`](amendments/) — proposed changes to the spec. See [`amendments/README.md`](amendments/README.md) for the lifecycle and format.
