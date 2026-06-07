# CopilotKit fit for SPEC-0009 (research → recommendation)

> **Status:** research note · **Date:** 2026-06-06 · **For:** [SPEC-0009](../specs/0009-party-copilots-and-agent-chat-view.md).
> Background + sources: [`copilotkit-overview.md`](copilotkit-overview.md).
>
> **TL;DR — strong fit.** CopilotKit's **CoAgents** is purpose-built for the exact shape
> SPEC-0009 describes: a **LangGraph agent + a React copilot chat** with shared state,
> intermediate-state streaming, **human-in-the-loop**, and **frontend actions that run in
> the browser**. The last point lines up with SPEC-0009's biggest constraint —
> **browser-side BYOK signing (R52)** — almost for free. Recommendation: **adopt CopilotKit
> for the copilot UI + agent↔UI plumbing**, keep our own tools/firewall/privacy invariants.

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

## Recommendation

**Adopt CopilotKit (CoAgents) for SPEC-0009's UI + agent↔UI plumbing**, with our tools layer,
firewall, privacy, and auto-mode logic kept as Curie-owned code. Concretely:
1. Spike: CopilotRuntime behind a Lambda Function URL (streaming) + a trivial CoAgent on
   Bedrock + one `useCopilotAction` that signs a no-op tx with the SPEC-0008 key.
2. If the spike is clean, fold CopilotKit into SPEC-0009 §3.7/§3.8 (component + dep changes)
   and resolve **OQ-7** "yes."
3. If the Lambda-streaming or Bedrock path is rough, fall back to the hand-rolled drawer +
   narration stream already specified — the spec stands without CopilotKit.

## Open decision (feeds SPEC-0009 OQ-7)

- **OQ-7:** Use CopilotKit/CoAgents, or hand-roll the copilot UI + narration stream? **Lean:
  CopilotKit**, pending the Lambda-runtime + Bedrock spike above.

## Sources

See [`copilotkit-overview.md`](copilotkit-overview.md#sources).
