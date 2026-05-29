# CLAUDE.md

Guidance for Claude Code sessions in the Curie **application repo** (agent-mediated
drug coverage-exception arbitration on Somnia). It covers the working philosophy,
folder layout, architectural constraints, the spec-driven workflow, and the
cross-repo policy.

**Tech-stack and on-chain interface decisions are authoritative in
[`AGENTS.md`](AGENTS.md) — read it first.** If anything below contradicts
`AGENTS.md`, `AGENTS.md` wins. Product framing lives in
[`docs/VISION.md`](docs/VISION.md).

## Spec-driven development

This project is **spec-driven**: work starts as a spec in [`docs/specs/`](docs/specs/),
authored to the standard in the **`spec-author` skill**. A spec's requirements,
technical documentation, and pass/fail criteria are the source of truth for a unit of
work — implementation is built to satisfy them, and the spec is updated before or
alongside the code, never left to drift. The current build target is
[`docs/specs/0001-mvp0-coverage-negotiation.md`](docs/specs/0001-mvp0-coverage-negotiation.md).

## Layout

```
.
├── AGENTS.md      # authoritative tech-stack + on-chain interface constraints (read first)
├── CLAUDE.md      # this file — working philosophy, layout, constraints, cross-repo policy
├── LICENSE        # proprietary; all rights reserved
├── README.md
├── .mcp.json      # Context7 MCP server (anonymous; live Somnia docs via /websites/somnia_network)
├── .claude/       # tooling: context7-mcp (Context7 docs) + spec-author (docs/specs/ standard)
├── src/           # TypeScript source. Entry: src/index.ts; Somnia core in src/somnia/.
└── docs/
    ├── VISION.md            # product vision (start here for the product)
    ├── ROADMAP.md
    ├── specs/               # what to build (see below)
    ├── amendments/          # ADR-style decision records (A-NNNN)
    ├── progress/            # implementation progress notes
    ├── domain/              # healthcare-domain reference (e.g. payer architecture)
    ├── technical-design/    # technical design notes
    ├── demo/                # demo materials (synthetic only)
    ├── research/            # what we're still researching (see below)
    ├── reference/           # external reference material copied down (curie, somnia-agent-kit)
    └── documentation/       # copied-down hard API/code docs (see below)
```

## Architectural constraints

- **TypeScript only.** No polyglot backend.
- **No REST.** Reach the chain via RPC, signed transactions, view calls, and
  event subscriptions through `somnia-agent-kit`. Propose any non-chain interface
  (gRPC, WebSocket, tRPC, queue) before building.
- **Chain-native first.** Reads come from contract calls or event streams; writes
  from signed transactions. Off-chain glue orchestrates; it is not the system of
  record.
- **No clinical data on-chain.** Only opaque IDs, hashes, amounts, and settlement.
- Prefer `somnia-agent-kit` abstractions over hand-rolling ethers/viem.

## Cross-repo policy

This app repo is nested inside an external spec/research repo
(`curie-coding-blockchain`). **Do not copy proprietary content from that repo
into this one without a human in the loop** — except documentation a human
explicitly asks to be authored here. Enforced by the `external-repo-policy`
skill, which lives in the spec repo.

## The `docs/` tree — what each folder holds

These three folders are deliberately distinct. Put content in the right one.

### `docs/specs/` — build specs (the source of truth for what to build)

Fleshed-out specifications for what an agent needs to build, one per file
(`NNNN-kebab-title.md`). Every spec follows the standard structure enforced by the
**`spec-author` skill** (`.claude/skills/spec-author/`): summary & user story,
requirements, technical documentation, deliverables, test cases, pass/fail criteria,
out of scope, and open questions. Invoke that skill whenever writing or reviewing a
spec. First spec: [`specs/0001-mvp0-coverage-negotiation.md`](specs/0001-mvp0-coverage-negotiation.md).

Each spec's status (**done** / **to implement** / **draft**) is tracked inline in
[`specs/README.md`](specs/README.md); keep it current when a spec lands or its
implementation merges.

### `docs/research/` — research (what we haven't decided yet)

Information researched regarding what we're going to build, before it has been
decided. Open-ended notes, options, comparisons, and findings.

This folder **may include small sub-portions copied from the original/external
research** — but only with a **human in the loop**, per the
[Cross-repo policy](#cross-repo-policy) above. Nothing has been copied in yet.

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
