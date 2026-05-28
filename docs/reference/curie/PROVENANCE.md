# Provenance

This directory is a verbatim copy of the `docs/` tree from [github.com/tspugh/curie](https://github.com/tspugh/curie), imported on **2026-05-14**.

## Why it's here

Curie is a separate project — a neutral protocol for emergency specialist consults (EMTALA transfers) on the Somnia L1 blockchain. It is **not** this project's spec. It is kept here as **reference material** because:

- It is built on the same chain (Somnia) that this project targets, so its on-chain/off-chain split, identity model, event schema, encrypted pub-sub design, and agent runtime in [`spec/api.md`](spec/api.md) are directly mineable patterns.
- It encodes a healthcare-domain "PHI never on-chain" discipline that applies identically here (claim data has PHI; only hashes/attestations belong on-chain).
- Its `.claude/agents/` roster (copied separately into the project's `.claude/agents/`) and its ADR-style amendment process are reusable working patterns.

## Read it as reference, not as spec

- **Domain mismatch**: Curie is about emergency *consults*, not coding + *claim adjudication*. Don't confuse the actor model (hospital agent / specialist agent / patient agent / regulator) with this project's actor model (coding agent / hospital / insurer / auditor). They overlap structurally but the cases and money flows differ.
- **Stack mismatch**: Curie examples and the imported `.claude/agents/` are Python-oriented. Per [`/AGENTS.md`](../../../AGENTS.md) this project is TypeScript-only on `somnia-agent-kit`.
- **No edits**: Treat this subtree as read-only. If you want to evolve a pattern for this project, write it into the project's own `docs/` (spec, wiki, or research), citing back here.

## Contents

| Path | Original purpose |
|---|---|
| `README.md` | Curie's docs-tree index and conventions |
| `spec/curie.md` | Curie protocol + product spec (problem, agents, on/off-chain table, demo storyboard) |
| `spec/api.md` | Backend contract: identity model, chain events, encrypted pub-sub, agent runtime, standing-rules data model |
| `spec/demo-ui.md` | CurieConsole UI pattern, role bindings, chain-state glyphs, demo-stage composition |
| `context/somnia-agentathon.md` | Somnia Agentathon programme and Somnia L1 platform background |
| `context/agentathon-demo.md` | Live demo staging plan: stage layout, choreography, fallbacks, practice plan |
| `amendments/README.md` | ADR lifecycle: Proposed → Accepted (folded into spec) → kept as decision record |
