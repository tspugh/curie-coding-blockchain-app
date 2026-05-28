# AGENTS.md

Guidance for AI coding agents (Claude, Codex, Cursor, etc.) working in this repository.

## Project direction

This repository is being repurposed. The previous seed content under `docs/` came from an unrelated medical-coding project (`icd-10-parser`) and should be treated as **historical reference only** until it is pruned or rewritten — none of it constrains the new design.

The project going forward builds AI agents on the **Somnia blockchain**.

## Tech stack

- **Language:** TypeScript. All application code is TypeScript — no Rust, no Python services, no polyglot backend.
- **Core SDK:** [`somnia-agent-kit`](https://github.com/xuanbach0212/somnia-agent-kit) — production SDK for Somnia. Provides `SomniaAgentKit`, on-chain contract bindings (`AgentRegistry`, `AgentManager`, `AgentExecutor`, `AgentVault`), LLM adapters (Ollama, OpenAI), token managers (ERC20, ERC721), and the autonomous `Agent` runtime.
  - npm: `somnia-agent-kit`
  - Docs (upstream): https://somnia-agent-kit.gitbook.io/somnia-agent-kit
  - **Docs (local, read first):** [`docs/reference/somnia-agent-kit/`](docs/reference/somnia-agent-kit/) — AI-summarised capture of the contracts overview, per-contract reference (`AgentRegistry`, `AgentManager`, `AgentVault`, `AgentExecutor`), and SDK usage (2026-05-14). This is the **core SDK reference** for day-to-day work; the upstream gitbook is authoritative when in doubt.

- **Core platform-concept guide:** [`docs/reference/curie/context/medical-blockchain.md`](docs/reference/curie/context/medical-blockchain.md) — comprehensive concept doc for a blockchain-driven medical coding & payment platform (smart contracts, cryptographic identity, off-chain secure data handling, automated agreement workflows, deterministic compliance checks, shared payment verification, immutable audit). **This is the primary product framing for cliqueue-coding-blockchain** — read alongside this file when designing or researching. The research agent at `.claude/skills/research/SKILL.md` anchors its design decisions against it.
- **Infrastructure as code:** allowed and encouraged for any deployed/persistent infrastructure. Choice of tool is open.

## Architectural constraints

- **No REST.** Do not introduce REST APIs, Express/Fastify/Koa REST routes, or HTTP-CRUD layers. State lives on-chain; clients interact via RPC, signed transactions, view calls, and event subscriptions through `somnia-agent-kit`. If a non-chain interface is genuinely required, propose it (gRPC, WebSocket events, tRPC, message queue) before building.
- **Chain-native first.** Reads come from contract calls or event streams; writes come from signed transactions. Off-chain glue is for orchestration, not a system of record.

## Working notes for agents

- The existing `docs/` tree is from the prior project. Do **not** treat its contents (HIPAA, ICD-10, AWS Comprehend, RDS, SQS, Rust error handling, etc.) as requirements for this project.
- When asked to scaffold or restructure: confirm scope first, because pruning the seeded docs is irreversible.
- Prefer the official `somnia-agent-kit` abstractions over hand-rolling ethers/viem calls — the kit already wraps contract addresses, ABIs, and the agent runtime.
