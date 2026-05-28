# Provenance

The files in this directory are AI-summarised fetches from the [Somnia Agent Kit gitbook](https://somnia-agent-kit.gitbook.io/somnia-agent-kit/), captured on **2026-05-14**.

## How they were captured

Each file was fetched via the `WebFetch` tool, which converts HTML to markdown and runs the content through a small, fast model with a structured prompt asking for: function signatures verbatim, data structures, events, addresses, access controls. The result is a faithful structured summary — **not a verbatim copy** of the source HTML.

## Implications

- **Treat as reference, not source of truth.** When in doubt, follow the upstream URL.
- **Function signatures are quoted from the page.** If a signature is wrong here, the AI summariser introduced a transcription error — open the upstream URL.
- **Code examples may be paraphrased.** Code blocks that appear here may have been rewritten for clarity; cross-check upstream before copying into production code.
- **Mainnet addresses are not yet published** upstream. Testnet only (chain ID 50311).

## Source URLs

| Local file | Source URL |
|---|---|
| `contracts-overview.md` | https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/contracts-overview |
| `agent-registry.md` | https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/agent-registry |
| `agent-manager.md` | https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/agent-manager |
| `agent-vault.md` | https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/agent-vault |
| `agent-executor.md` | https://somnia-agent-kit.gitbook.io/somnia-agent-kit/smart-contracts/agent-executor |
| `sdk-usage.md` | https://somnia-agent-kit.gitbook.io/somnia-agent-kit/sdk-usage/sdk-usage |

## Not yet captured

The upstream `sdk-usage` page references two further pages — **LLM Integration** (`sdk-llm`) and **Autonomous Runtime** (`sdk-runtime`) — under "Advanced Features". These were not fetched in this pass; a future refresh should pull them in.

## Re-fetching

Future refresh: bulk-fetch the URLs above via `WebFetch` and overwrite the corresponding files. The directory layout, `README.md`, and this `PROVENANCE.md` should remain stable across refreshes.
