# Somnia Native Agents vs. somnia-agent-kit

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — Is there a Somnia first-party agent framework that supersedes `somnia-agent-kit` for production?

### Finding 1: `somnia-agent-kit` is a community hackathon project — not first-party, not production-ready

- `somnia-agent-kit` (npm: `somnia-agent-kit`, GitHub: `xuanbach0212/somnia-agent-kit`) is a **community-built SDK**, not an official Somnia/Improbable product. The maintainer is an independent contributor; the repository has 0 stars, 0 forks, 0 watchers as of May 2026.
  — [GitHub: xuanbach0212/somnia-agent-kit](https://github.com/xuanbach0212/somnia-agent-kit)
- The kit was first submitted to a DoraHacks hackathon and later published as a package. Latest release: v3.0.11 (October 24, 2025). No confirmed mainnet deployments in any publicly disclosed project.
  — [DoraHacks: somnia-agent-kit buidl](https://dorahacks.io/buidl/35314)
- All smart contract addresses in the kit README reference **testnet only** (Chain ID 50312, `dream-rpc.somnia.network`). No mainnet contract addresses are documented in the README.
  — [GitHub: xuanbach0212/somnia-agent-kit](https://github.com/xuanbach0212/somnia-agent-kit)

### Finding 2: Somnia's first-party native Agents framework launched on mainnet in April 2026

- In April 2026, Somnia launched **Somnia Agents** as a first-party protocol feature and rebranded as the "Agentic L1." This is the official, chain-native framework for AI computation from smart contracts.
  — [PlayToEarn: Somnia repositioning as Agentic L1](https://playtoearn.com/news/somnia-network-completes-repositioning-as-agentic-l1-with-somnia-agents-live-and-ai-compute-running-onchain)
- The first-party runtime exposes `createRequest(agentId, callbackAddress, callbackSelector, payload)` and `createAdvancedRequest(...)` from Solidity. Platform contract addresses are first-party Somnia infrastructure:
  - Mainnet (chain ID 5031): `0x5E5205CF39E766118C01636bED000A54D93163E6`
  - Testnet (chain ID 50312): `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`
  — [Somnia Docs: Invoking Agents from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)
- The native runtime uses **multi-validator consensus**: elected validator nodes independently execute the same agent call and submit results; the platform calls the requesting contract's callback once consensus (majority or threshold) is reached. This is cryptographically stronger than a single off-chain oracle.
  — [Somnia Docs: Agents README](https://docs.somnia.network/agents/readme.md)

### Finding 3: Native Agents are explicitly marked "prototype state" — API stability not guaranteed

- The official Somnia Agents documentation warns: **"Somnia Agents is prototype software deployed on both Somnia Mainnet and Testnet. Features and APIs may change as development progresses."**
  — [Somnia Docs: Agents README](https://docs.somnia.network/agents/readme.md)
- This means the first-party runtime is live on mainnet but is not yet API-stable. Contracts built against the current `createRequest` interface may need updates when Phase 2 launches.

### Finding 4: Phase 1 has a curated, fixed agent set — custom agents require Phase 2 (2026)

- **Phase 1 (current)** provides a fixed set of core agents only: JSON API Request, Idempotent Request, LLM Inference, LLM Parse Website, and Find URL for Topic. These are Somnia-controlled; developers cannot deploy custom agent logic.
  — [Somnia Docs: Agents README](https://docs.somnia.network/agents/readme.md)
- **Phase 2 (2026 roadmap)**: "Support for fully custom, user-defined Agents will launch" alongside a "Full Agent SDK" and "Advanced Tooling." No specific date given beyond "2026."
  — [Somnia Docs: Agents README](https://docs.somnia.network/agents/readme.md)
- **Critical implication for cliqueue**: the ICD-10 coding agent cannot be a custom on-chain agent under Phase 1. In Phase 1, the coding logic must live off-chain, using the LLM Inference base agent (`inferString`/`inferChat`/`inferToolsChat`) as the consensus oracle that validates the off-chain result, not as the coder itself.

### Finding 5: Exact fee structure for native Agents (SOMI-denominated, USD-convertible)

- Agent invocation costs in SOMI (mainnet gas token, ~$0.176/SOMI as of 2026-05-14):
  - **JSON API Request**: 0.03 SOMI/agent × subcommittee size + 0.01 SOMI/agent floor
  - **LLM Inference**: 0.07 SOMI/agent × subcommittee size + 0.01 SOMI/agent floor
  - **LLM Parse Website**: 0.10 SOMI/agent × subcommittee size + 0.01 SOMI/agent floor
  — [Somnia Docs: Gas Fees for Agents](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)
- **USD cost for LLM Inference with subcommittee=3** (default): total `msg.value` = 0.24 SOMI ≈ **$0.042 per claim** at current SOMI price.
- **USD cost for LLM Inference with subcommittee=5** (higher confidence): total `msg.value` = 0.40 SOMI ≈ **$0.070 per claim** at current SOMI price.
- These costs sit well below the $4–10/claim outsourced coding benchmark. Even at 10× SOMI appreciation ($1.76), the subcommittee=5 cost is $0.70/claim — still 6–14× cheaper than outsourced coding.
  — SOMI price from [CoinMarketCap: Somnia](https://coinmarketcap.com/currencies/somnia/) as of 2026-05-14; benchmark from prior research at `docs/research/market/coding-market-size-and-denial-losses.md`
- **Important caveat**: SOMI price has ranged $0.148–$1.84 (all-time low to high). At ATH, subcommittee=5 costs $0.74/claim. Economics remain favorable vs. incumbent pricing through most of the price range.

### Finding 6: `somnia-agent-kit` vs. native runtime — divergent architectures

- `somnia-agent-kit` wraps `AgentRegistry`, `AgentManager`, `AgentVault`, `AgentExecutor` — these are community contracts on testnet, not the same as the first-party `SomniaAgents` platform contract.
- The native runtime is **protocol-level**: validators execute agents as part of the consensus loop. The kit is an **application-level** wrapper that uses those same protocol contracts but adds TypeScript abstractions.
- The two are not mutually exclusive: the kit's `AgentVault` (escrow/daily-limit) and `AgentRegistry` (identity) abstractions can coexist with direct `createRequest` calls to the platform contract. However, the kit's testnet-only contract addresses mean its on-chain components cannot be used on mainnet until the kit is updated.

**Design implication:** cliqueue should use the **first-party native Agents runtime** (`createRequest`/`handleResponse` via the platform contract) as the primary coding-attestation mechanism — not `somnia-agent-kit`. Under Phase 1, the ICD-10 coding agent must run off-chain (TypeScript), with the `LLM Inference` base agent serving as a multi-validator consensus oracle to attest the coding result on-chain. The `AgentVault` escrow abstraction from the kit may be worth porting to mainnet contract addresses once Phase 2 lands; in the meantime, a thin `ClaimsAdjudicator` wrapper with explicit SOMI deposit logic is the safer path. The "prototype state" warning means cliqueue should abstract the platform address behind a single config variable so it can be swapped when Phase 2 breaks the API.

**Open questions generated:**
1. What LLM models does Somnia's native `LLM Inference` base agent expose (Phase 1 curated set)? Are they sufficient for ICD-10 coding accuracy, or does cliqueue need Phase 2 custom agents with a fine-tuned medical coding model? — priority: high
2. Does the Phase 2 "Full Agent SDK" allow deploying a fine-tuned model (e.g., a Llama variant fine-tuned on ICD-10 coding) as a custom on-chain agent, or only general-purpose LLMs? What is the expected Phase 2 timeline within 2026? — priority: high
3. Can the `inferToolsChat` function in the LLM Inference agent call back to on-chain contract state (e.g., read prior claim records) as a "tool," enabling the coding agent to perform modifier-code lookups without PHI leaving the TEE boundary? — priority: medium

---

**See also** — [[../topics/somnia-substrate|Somnia substrate hub]] · [[../topics/settlement-stablecoin|settlement hub]]
