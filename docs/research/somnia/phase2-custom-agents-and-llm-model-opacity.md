# Somnia Phase 2 Custom Agents, LLM Model Opacity, and inferToolsChat Architecture

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-15 — Does Somnia Phase 2 "Full Agent SDK" allow deploying a fine-tuned model (e.g., ICD-10–specific Llama) as a custom on-chain agent, and what is the Phase 2 timeline?

### Finding 1: Phase 2 is confirmed but undated — "2026" only, no quarter specified

- The official Somnia Agents documentation (`docs.somnia.network/agents/readme.md`) states Phase 2 will introduce "Custom User-Defined Agents" and a "Full Agent SDK" with "Advanced Tooling." The only timeline given is **"2026"** — no Q1/Q2/Q3/Q4 breakdown appears anywhere in the official docs, blog, or litepaper as of May 2026.
  — [Somnia Docs: Agents README](https://docs.somnia.network/agents/readme.md)
- The "Ingot" hard fork (April 15, 2026) activated Phase 1 Agents on mainnet. No subsequent hard fork for Phase 2 is scheduled or announced.
  — [PlayToEarn: Somnia Agentic L1 launch](https://playtoearn.com/news/somnia-network-completes-repositioning-as-agentic-l1-with-somnia-agents-live-and-ai-compute-running-onchain)
- **Risk for cliqueue**: if Phase 2 does not arrive before the hackathon submission or MVP launch window (H2 2026), cliqueue cannot rely on a custom on-chain coding agent. The off-chain Corti Symphony pipeline is not a temporary workaround — it may be the permanent architecture for 12+ months.

### Finding 2: Phase 2 docs say "custom user-defined agents" — no specification that fine-tuned models are supported

- The roadmap language is "Custom User-Defined Agents" and "Full Agent SDK." There is **no mention** in any public documentation of:
  - Bringing a fine-tuned or domain-specific model (e.g., Llama fine-tuned on ICD-10 coding).
  - Specifying a particular model vendor or version.
  - Deploying a private or enterprise model endpoint as a Somnia agent.
  - TEE-gated inference for custom models.
  — [Somnia Docs: Agents README](https://docs.somnia.network/agents/readme.md)
- It is plausible that "custom agents" means custom *logic* (arbitrary TypeScript/Rust computation with multi-validator consensus) rather than custom *models*. Bringing a domain-specific ICD-10 model would require the compute infrastructure to support arbitrary GPU-backed inference on validator nodes — a non-trivial requirement that is not referenced anywhere in the roadmap.
  — **Weakly sourced / uncertain**: this interpretation is inferred from the absence of model-selection language; it cannot be confirmed until Phase 2 specification is published.

### Finding 3: Phase 1 LLM Inference uses a single opaque, fixed model — no model selection parameter exists

- The `inferString`, `inferChat`, and `inferToolsChat` functions on the LLM Inference base agent have **no model selection parameter**. The payload encodes the prompt, system message, and conversation history — not a model choice.
  — [Somnia Docs: LLM Inference base agent](https://docs.somnia.network/agents/base-agents/llm-inference.md)
- Somnia's documentation describes LLM Inference as using "deterministic outputs" via "fixed random seeds and controlled temperature parameters" to enable consensus across validators. The underlying model is described only as "GPU-backed" — no vendor name, no version string is published.
  — [Somnia Docs: Gas Fees for Agents](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)
- **Implication for ICD-10 accuracy**: prior research (`docs/research/ai-models/llm-icd10-accuracy-and-somnia-model-availability.md`) documented that base LLMs (GPT-4, Claude) achieve only 15–35% agreement with human coders on ICD-10 without fine-tuning. The Somnia LLM Inference agent's model is likely a general-purpose LLM. This confirms it cannot serve as the primary coder — only as a consensus validation oracle for Corti Symphony output.

### Finding 4: `inferToolsChat` exposes MCP server URLs — enables off-chain coding agent calls from within Somnia consensus

- The `inferToolsChat` function signature includes a `string[] mcpServerUrls` parameter, which allows the on-chain LLM agent to **call MCP servers** as tools during its reasoning loop. The full signature:
  ```
  inferToolsChat(roles, messages, mcpServerUrls, onchainTools, maxIterations, chainOfThought)
  ```
  — [Somnia Docs: LLM Inference base agent](https://docs.somnia.network/agents/base-agents/llm-inference.md)
- This is a significant capability: cliqueue could embed the Corti Symphony MCP endpoint (`https://api.corti.ai/v1/mcp`) as an `mcpServerUrl`, directing the Somnia LLM Inference agent to call Corti Symphony *as a tool* during consensus execution. This would make Corti coding calls happen inside the Somnia validator consensus loop, not just off-chain.
- **Critical caveat — PHI risk**: if `mcpServerUrls` points to a Corti endpoint that receives the clinical note, PHI would travel from the validator cluster to Corti's API endpoint during consensus execution. This violates cliqueue's PHI-never-on-chain constraint if the "on-chain" boundary includes validator execution. The clinical note cannot be passed through this pathway; only the claim hash or ICD-10 code array (already de-identified) can be passed. This limits `inferToolsChat` to post-coding validation tasks (e.g., "confirm this ICD-10 code array is clinically consistent with this diagnosis description"), not primary coding.
  — PHI constraint: [CLAUDE.md hard rules](../../../CLAUDE.md)

### Finding 5: `onchainTools` parameter enables contract-state reads within LLM consensus — important for modifier-code lookups

- The `inferToolsChat` signature includes `OnchainTool[] onchainTools`, allowing the validator LLM to **call on-chain view functions** as tools during its reasoning. This enables the coding oracle to query prior claim records, ICD-10 code registries, or other on-chain state without requiring PHI.
  — [Somnia Docs: LLM Inference base agent](https://docs.somnia.network/agents/base-agents/llm-inference.md)
- For cliqueue's modifier-code lookup use case (e.g., checking whether a modifier code was applied to a prior claim for the same patient encounter), the `onchainTools` path is PHI-safe: only claim hashes and code arrays are on-chain, and those are already de-identified.
- **Unconfirmed**: whether `onchainTools` calls are included in the `msg.value` fee or billed separately. Increased `maxIterations` increases total inference cost proportionally.

### Finding 6: Two-tier architecture is confirmed as the permanent design, not a Phase 1 workaround

- Given Phase 2's undated timeline and the absence of fine-tuned model language in the roadmap, cliqueue's two-tier architecture should be treated as the **permanent production design**, not a temporary Phase 1 workaround:
  - **Tier 1 (off-chain)**: Corti Symphony (via MCP) performs ICD-10 coding from the clinical note. Output: structured code array + evidence. PHI stays within the Corti HIPAA BAA boundary.
  - **Tier 2 (on-chain, consensus-validated)**: Somnia `inferString` or `inferToolsChat` receives the code array hash and a de-identified code description string; performs multi-validator consensus validation ("is this code set clinically plausible given this diagnosis description?"). PHI never enters this tier.
  - **Post-Phase 2 path**: if Phase 2 enables custom compute (not just custom logic), cliqueue could optionally migrate a Llama fine-tuned ICD-10 model to Tier 2, eliminating the Corti dependency for outpatient claims. This is a post-MVP research investment, not a current design dependency.

**Design implication:** Phase 2 Custom Agents are undated (only "2026") with no specification that fine-tuned domain models will be supported. The Phase 1 LLM Inference agent uses an opaque fixed model that cannot be selected or customized. The two-tier architecture (Corti off-chain + Somnia consensus oracle on-chain) is the permanent design. `inferToolsChat`'s MCP support and `onchainTools` parameter offer powerful composition opportunities: Corti MCP for de-identified code validation, on-chain tools for modifier-code lookups — both are PHI-safe if the clinical note is never passed to the on-chain tier.

**Open questions generated:**
1. Does Somnia's `inferToolsChat` `mcpServerUrls` parameter allow specifying a hospital-local MCP endpoint (not a public URL), or does it require a publicly reachable URL — and if the latter, does this create a data-exfiltration risk even for de-identified code arrays passing through validator nodes in non-EU jurisdictions? — priority: medium
2. Does the `onchainTools` parameter in `inferToolsChat` count toward the `maxIterations` budget, and what is the practical maximum `maxIterations` before the default 15-minute timeout is exceeded for a 5-validator subcommittee? — priority: medium
3. When Phase 2 "Custom User-Defined Agents" launches, will the agent registration process require Somnia team approval (permissioned) or be permissionless — and does a permissioned model create a procurement/legal bottleneck for a healthcare-specific agent deployment? — priority: high (add to backlog when Phase 2 announcement arrives)

---

**See also** — [[../topics/corti|Corti hub]] · [[../topics/somnia-substrate|Somnia substrate hub]]
