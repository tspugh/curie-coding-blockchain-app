# CopilotKit — overview & capabilities (research)

> **Status:** research note · **Date:** 2026-06-06 · **For:** [SPEC-0009](../specs/0009-party-copilots-and-agent-chat-view.md)
> (off-chain party copilots + agent chat view).
>
> **Method / caveat.** Researched 2026-06-06 via WebSearch + the project-public GitHub
> README. The official docs domain (`docs.copilotkit.ai`) **bot-blocks automated fetch
> (HTTP 403)**, so the exact, current API signatures below should be **confirmed against
> the live docs** before implementation. Version-sensitive names are flagged. Sources at
> the bottom. This is a *research note* (undecided), not a build spec — see
> [`copilotkit-fit-for-spec-0009.md`](copilotkit-fit-for-spec-0009.md) for the fit
> assessment + recommendation.

## What it is

**CopilotKit** is an open-source (**MIT**) framework for building **in-app AI copilots /
agent-native applications** — chat UI, generative UI, shared state, and human-in-the-loop —
with a React frontend and a server-side runtime that bridges the app to LLMs and/or agent
frameworks. It is the team **behind the AG-UI protocol** (an open agent↔UI event protocol
reportedly adopted across Google, LangChain, AWS, Microsoft). Frontends: React/Next.js (GA),
plus Angular, Vue, React Native; also Slack / MS Teams surfaces.

## Packages

- `@copilotkit/react-core` — the `<CopilotKit>` provider + hooks (`useCopilotAction`,
  `useCopilotReadable`, `useCopilotChat`, `useCoAgent` / `useAgent`, `useCoAgentStateRender`).
- `@copilotkit/react-ui` — prebuilt chat UI: `<CopilotChat>`, `<CopilotSidebar>`,
  `<CopilotPopup>`, `<CopilotTextarea>` (+ CSS). Fully themeable / replaceable.
- `@copilotkit/runtime` — **CopilotRuntime**, the Node server-side middle layer between the
  frontend, the LLM(s), and backend agents. Exposed as an HTTP endpoint the frontend points
  at via `runtimeUrl` (or Copilot Cloud via a public API key).

## Core building blocks

| Concept | What it does |
|---|---|
| `<CopilotKit runtimeUrl=… />` | Provider that wraps the app and points at the runtime (self-hosted) or Cloud. |
| `<CopilotChat>` / `<CopilotSidebar>` / `<CopilotPopup>` | Drop-in chat surfaces — streaming, tool-call rendering, message history. |
| `useCopilotReadable({description, value})` | **Exposes app state to the copilot** as context the model can read. |
| `useCopilotAction({name, parameters, handler, render / renderAndWaitForResponse})` | **Frontend action** the copilot may call. `handler` runs **client-side**; `renderAndWaitForResponse` renders custom UI and **blocks for human approval** (human-in-the-loop). |
| `useCoAgent()` / `useAgent()` *(name evolving)* | **Shared state** with a LangGraph agent — bidirectional state sync between the agent and the React app. |
| `useCoAgentStateRender()` | Renders the agent's **intermediate/streaming state** in the chat (live "what the agent is doing"). |
| Generative UI | The agent renders custom React components at runtime (e.g. per tool call / per step). |

## CoAgents — the LangGraph integration (the relevant part)

**CoAgents** is CopilotKit's first-class integration for **LangGraph** agents (TypeScript/JS
**and** Python). It gives, out of the box:

- **Shared state** between the LangGraph agent and the UI (`useCoAgent` / `useAgent`).
- **Intermediate-state streaming** — show the agent's progress mid-run (`useCoAgentStateRender`).
- **Agentic generative UI** — the agent drives UI as it works.
- **Human-in-the-loop** — pause the graph for approval, via LangGraph's `interrupt()` and/or
  `useCopilotAction(renderAndWaitForResponse)` breakpoints.
- **Frontend actions** — the LangGraph agent can call actions defined in the React app
  (`useCopilotAction`), whose `handler` executes **in the browser**.

Connection shapes (verify current names against docs):
- **LangGraph (JS/TS)** in-process or as a remote endpoint, wired through `CopilotRuntime`
  (e.g. a `langGraphPlatformEndpoint` / `remoteEndpoints` config), or
- **LangGraph Platform** / self-hosted (`langgraph-cli`, FastAPI for Python) referenced by URL.

Under the hood the agent↔UI traffic is the **AG-UI protocol** (events: state deltas, tool
calls, messages, interrupts).

## Runtime, self-hosting & LLM providers

- **Self-hosting:** `@copilotkit/runtime` is OSS and free to self-host (e.g. a Next.js route,
  a Node server, or a serverless function). **Copilot Cloud** is the optional **paid** hosted
  runtime.
- **LLM service adapters** (for the *direct-to-LLM*, non-agent path): OpenAI, Anthropic,
  Google, LangChain (wraps many), etc. **AWS Bedrock has no first-class service adapter** as
  of the last check — there is an open feature request (GitHub issue **#1744**, May 2025);
  by mid-2026 confirm whether it shipped. **This matters less for CoAgents:** in the
  CoAgents/LangGraph path the **LLM is called *inside* the LangGraph agent**, so Bedrock via
  `@langchain/aws` (`ChatBedrockConverse`) is used **in the agent node**, and the
  CopilotRuntime service-adapter is effectively a passthrough.

## Licensing

- Core framework: **MIT**, free to self-host.
- Copilot Cloud + some enterprise features: hosted / paid (optional).

## Sources

- [CopilotKit GitHub (README, MIT, packages, AG-UI)](https://github.com/CopilotKit/CopilotKit) · [raw README](https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/README.md)
- [CoAgents intro (docs)](https://docs.copilotkit.ai/coagents) · [LangGraph integration (docs)](https://docs.copilotkit.ai/langgraph)
- [Self-hosting (Copilot Runtime) (docs)](https://docs.copilotkit.ai/concepts/self-hosting)
- [Bedrock service-adapter feature request — issue #1744](https://github.com/CopilotKit/CopilotKit/issues/1744)
- [CopilotKit pricing](https://www.copilotkit.ai/pricing) · [product](https://www.copilotkit.ai/product)
- [Blog: Everything you need to build agent-native apps (CoAgents + LangGraph)](https://www.copilotkit.ai/blog/everything-you-need-to-build-agent-native-applications)
