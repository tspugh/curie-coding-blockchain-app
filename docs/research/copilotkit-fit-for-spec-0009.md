# CopilotKit fit for SPEC-0009 (research → recommendation)

> **Status:** research note · **Date:** 2026-06-06 · **For:** [SPEC-0009](../specs/0009-party-copilots-and-agent-chat-view.md).
> Background + sources: [`copilotkit-overview.md`](copilotkit-overview.md).
>
> **TL;DR — strong *technical* fit, but the backend is the catch.** CopilotKit's **CoAgents**
> matches the exact shape SPEC-0009 describes (**LangGraph agent + React copilot chat**,
> shared state, streaming, **human-in-the-loop**, **browser-side frontend actions** that line
> up with our BYOK signing — R52). **However**, its *backend* (CopilotRuntime + CoAgents +
> AG-UI streaming) leans on **managed services** (Copilot Cloud + LangGraph Platform) and runs
> **against the Lambda grain** — see *Hosting & backend complexity* below. **DECIDED (2026-06-07):
> hand-roll a simple chat UI on our own plain Lambda (OQ-7 = A); CopilotKit stays a documented
> fallback (self-hosted, or its free Cloud Developer tier), not a v0 dependency.**

## How it maps to SPEC-0009

| SPEC-0009 element | CopilotKit primitive | Notes |
|---|---|---|
| Co-pilot chat = **primary** surface (R26/R30) | `<CopilotChat>` (main pane) | Themeable; the contract info is our own collapsible right drawer beside it. |
| Live status line + "thinking" + token streaming (R29a) | Built-in streaming + `useCoAgentStateRender` (intermediate state) | The "what the agent is doing" line is native; no custom transport needed. |
| Four message types `agent/chain/tool/user` (R28) | Chat messages + tool-call render + custom render | `chain`/`tool` blurbs render via generative-UI / custom message renderers; keep the 4-type rule ours. |
| **Write-tools = party actions, signed in the browser** (R7/R52) | `useCopilotAction({ handler })` — **handler runs client-side** | The handler calls our existing `PartyAgent`/client → **browser signs** with the SPEC-0008 BYOK key. This is the key win. |
| Human-in-the-loop / manual interrupt (R15) | `useCopilotAction({ renderAndWaitForResponse })` + LangGraph `interrupt()` | Approve/edit/reject the proposed action before it signs. |
| Read context: case, policy, chain state, attestations (R6/R16) | `useCopilotReadable` | Expose the de-identified case/policy/chain context to the copilot. |
| LangGraph copilot graph (R12) | **CoAgents** | Our `src/copilot/graph.ts` *is* the CoAgent. |
| Lambda decide/narrate brain (R13) | **CopilotRuntime** endpoint (self-hosted on a Lambda Function URL) | Runtime bridges the SPA ↔ the LangGraph agent; deploys serverless. |
| Bedrock as the model (R14) | `@langchain/aws` **inside the CoAgent node** | Sidesteps the missing first-class Bedrock *service adapter* (overview §LLM providers). |
| Standing-rules editor + auto toggle + kill-switch (R20/R23/R33) | Custom UI + `useCoAgent` state | CopilotKit renders; the auto-loop/guardrails stay our logic. |
| Mock DB / evidence tools (R6/R46) | `useCopilotAction`/`useCopilotReadable` over our `CaseStore`/`PolicyStore` | Tools layer unchanged. |

## Architecture with CopilotKit (browser signs; Lambda is the brain)

```
Browser (static SPA, S3+CloudFront)                         AWS
┌───────────────────────────────────────────┐     ┌───────────────────────────────┐
│ <CopilotKit runtimeUrl=…>                   │     │ Lambda Function URL            │
│  ├─ <CopilotChat>  (PRIMARY surface)        │◀───▶│  CopilotRuntime                │
│  ├─ ContractDrawer (collapsible, right)     │ AG- │   └─ CoAgent = LangGraph graph │
│  ├─ useCopilotReadable(case/policy/chain)   │ UI  │        └─ decide via Bedrock   │
│  └─ useCopilotAction(handler = SIGN+SEND) ──┼─────┼──▶ (no party key in Lambda)    │
│        ▲ browser signs w/ SPEC-0008 BYOK    │     │     Bedrock creds only         │
└────────┼────────────────────────────────────┘     └───────────────────────────────┘
         └─ executes write-tool via existing PartyAgent/client → Somnia tx
```

- The **decide/narrate** half (the CoAgent / LangGraph + Bedrock) runs in the **Lambda**
  (the CopilotRuntime endpoint). The **act** half (`useCopilotAction` handlers) runs in the
  **browser** and signs with the SPEC-0008 key. Matches SPEC-0009 R13/R52 exactly.
- **PHI/firewall invariants are unchanged and still ours to enforce:** the tools layer
  still hashes content (R8); the **R3/R4 arbiter firewall** still holds — the CoAgent never
  calls `handleResponse`/`createRequest`, and using Bedrock keeps `@anthropic-ai/sdk` out of
  the copilot path (the firewall static test runs over `src/copilot/**` regardless of
  CopilotKit).

## Why adopt (pros)

- **CoAgents = our exact pattern**, off the shelf: LangGraph + chat + shared state + HITL +
  streaming. Saves building the narration stream (R17), the four-type renderer, the
  thinking/streaming UX (R29a), and the HITL interrupt plumbing (R15) by hand.
- **Client-side action handlers** make **browser-side signing** (R52) idiomatic, not a hack.
- **MIT + self-hostable**: the runtime deploys to our own Lambda; no dependency on Copilot
  Cloud, no secrets in the bundle (R42).
- **AG-UI** is an open, multi-vendor protocol — lower lock-in risk.

## Risks / watch-outs (cons)

- **New, fast-moving dep surface** (`react-core`/`react-ui`/`runtime` + CoAgents). API names
  evolve (`useCoAgent`↔`useAgent`); pin versions and re-verify against live docs.
- **Bedrock**: no first-class *service adapter* (issue #1744) — fine for CoAgents (model lives
  in the LangGraph node), but if we ever wanted the *direct-to-LLM* path we'd need a custom
  adapter or LangChain adapter. Confirm current state at build time.
- **Runtime on Lambda**: CopilotRuntime is typically shown on Next.js/Node servers; running it
  behind a **Lambda Function URL with response streaming** needs a small adapter + a
  streaming check. De-risk with a spike before committing.
- **Replaces some of our hand-rolled R17/R28/R29a plumbing** — net simplification, but the
  spec's component list (§3.7) shifts from `CopilotDrawer.tsx` to CopilotKit components +
  `useCopilotAction` wiring. Update the spec if adopted.
- **Don't let it dilute invariants:** generative UI must still not render raw de-identified
  bodies inline (R34); actions must stay within the typed write-tool set (R7/R10); per-party
  scoping (R5) is enforced in our handlers, not assumed from CopilotKit.

## Hosting & backend complexity (researched 2026-06-07)

The frontend is easy; **the backend is where the complexity lives**, and CopilotKit's
documented happy path leans on **managed services**.

- **CopilotKit always needs a runtime endpoint.** There is no pure-frontend mode — the chat
  UI talks to either a self-hosted **CopilotRuntime** (Node) or **Copilot Cloud** (hosted).
  (A server side is unavoidable anyway — our Bedrock creds must be server-side.)
- **CoAgents wires the runtime to a LangGraph agent via:** LangGraph Studio (`langgraph dev`),
  **LangGraph Platform** (managed), or **self-hosted** (FastAPI for Python; **LangGraph-JS**
  can run in the Node runtime). The docs **emphasize LangGraph Platform + Copilot Cloud**;
  full self-hosting is supported but less trodden, and community threads report friction on
  the self-hosted LangGraph↔CopilotKit edge.
- **It runs against the Lambda grain.** Most examples assume a long-running Next.js/Node
  server. `CopilotRuntime` + a LangGraph-JS CoAgent + **AG-UI streaming** behind a **Lambda
  Function URL** is doable but **off the beaten path** and needs a spike.

Options by setup cost:

| Option | Backend infra | Setup | Notes |
|---|---|---|---|
| **A. Hand-roll UI + plain Lambda** | the 1 Lambda we already need + our own SSE/JSON + LangGraph-JS in-process | **Lowest, fully in-app** | No new framework/SaaS. We build the chat UX — but the mockup already designs it. |
| B. CopilotKit UI + self-host runtime | same 1 Lambda, now running CopilotRuntime + CoAgents + AG-UI streaming | **Medium** | Saves chat-UX work; adds runtime/CoAgents/streaming wiring against the Lambda grain. |
| C. CopilotKit + managed (Copilot Cloud) | external SaaS | Lowest *infra*; **Copilot Cloud free Developer tier** (1 seat / 50 MAU / 200 threads / 1 GB / 3-day retention) covers a demo | Still an external dep + data egress (de-id data softens it); **you still host the LangGraph/Bedrock agent** (Cloud hosts the runtime, not your custom CoAgent). Public API key is bundle-safe. Avoid LangGraph Platform. |

## Recommendation (revised 2026-06-07)

Constraint: **keep it simple and self-contained** — avoid CopilotKit's *backend* complication
and managed services.

- **Default (v0): Option A — hand-roll the chat UI on our own plain Lambda** (the brain we
  already accepted), LangGraph-JS in-process, our own small SSE/JSON narration stream
  (R17/R28/R29a), and client-side action handlers that **sign in the browser** (R52). No
  CopilotKit backend, no LangGraph Platform, no Copilot Cloud — **no new infra beyond the
  Lambda.** The mockup already specifies the UX.
- **CopilotKit-UI stays an optional add** — either **self-hosted** (after a Lambda-streaming
  spike) or via **Copilot Cloud's free Developer tier** (1 seat / 50 MAU / 200 threads / 1 GB /
  3-day retention — fine for a demo; managed dep + egress, de-identified data only; you still
  host the LangGraph/Bedrock agent). **Avoid LangGraph Platform (managed) regardless.** **DECIDED
  (OQ-7): (A) hand-roll for v0; CopilotKit is the documented fallback, not a dependency.**

## Decision (SPEC-0009 OQ-7) — DECIDED 2026-06-07

- **(A) Hand-roll** the copilot chat UI + narration stream on our own Lambda — **no CopilotKit
  dependency, no managed backend.** Simplest + self-contained, and the mockup already specifies
  the UX. CopilotKit (self-hosted, or its free Copilot Cloud Developer tier — 50 MAU / 200 threads
  / 3-day retention) stays a documented fallback if the hand-rolled UX proves costly.

## Sources

See [`copilotkit-overview.md`](copilotkit-overview.md#sources).
