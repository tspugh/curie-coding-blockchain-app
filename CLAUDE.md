# CLAUDE.md

Guidance for Claude Code sessions in the Curie Claims Protocol **application
repo**. This file covers working philosophy and the folder layout. **Tech stack,
architectural constraints, and the cross-repo policy live in
[`AGENTS.md`](AGENTS.md) — read it first;** if anything here contradicts it,
`AGENTS.md` wins.

## Layout

```
.
├── AGENTS.md      # tech stack, architectural constraints, cross-repo policy (authoritative)
├── CLAUDE.md      # this file — working philosophy + folder layout
├── LICENSE        # proprietary; all rights reserved
├── README.md
├── .mcp.json      # Context7 MCP server (anonymous; live Somnia docs via /websites/somnia_network)
├── .claude/       # tooling: context7-mcp skill (how/when to use the Context7 MCP)
├── src/           # TypeScript source. Entry: src/index.ts; Somnia core in src/somnia/.
└── docs/
    ├── specs/          # what to build (see below)
    ├── research/       # what we're still researching (see below)
    └── documentation/  # copied-down hard API/code docs (see below)
```

## The `docs/` tree — what each folder holds

These three folders are deliberately distinct. Put content in the right one.

### `docs/specs/` — build specs (the source of truth for what to build)

Fleshed-out specifications for what an agent needs to build. Each spec should
cover:

- **Requirements** — the general and functional requirements for the feature.
- **Test cases** — what needs to be tested (the cases to cover, not the
  implementation of the tests).
- **Acceptance criteria** — the conditions that mark the work complete.

Specs follow a **standard structure that will be enforced by a skill**
(forthcoming — to be defined). Until that skill lands, keep the sections above.

### `docs/research/` — research (what we haven't decided yet)

Information researched regarding what we're going to build, before it has been
decided. Open-ended notes, options, comparisons, and findings.

This folder **may include small sub-portions copied from the original/external
research** — but only with a **human in the loop**, per the cross-repo policy in
[`AGENTS.md`](AGENTS.md). Nothing has been copied in yet.

### `docs/documentation/` — hard reference docs (copied down)

Hard documentation copied down from **Somnia's APIs** — API reference and **code
documentation**, not research articles or prose write-ups. Rule of thumb: if it
reads like a fun little research article, it belongs in `docs/research/`; if it
is authoritative API/code reference, it belongs here.

## Looking up library / SDK docs — use the Context7 MCP

For current docs on any library, SDK, framework, or API — **especially Somnia**
— use the **Context7 MCP** (server configured in [`.mcp.json`](.mcp.json))
instead of relying on training data, which may be stale. The `context7-mcp`
skill covers how and when. For Somnia, query the library ID
`/websites/somnia_network` directly.
