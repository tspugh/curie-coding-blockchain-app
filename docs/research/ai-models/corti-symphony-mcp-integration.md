# Corti Symphony MCP Integration as Off-Chain Coder

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — Can cliqueue's off-chain coding agent call Corti Symphony via MCP, with the result hash passed to Somnia's native `inferString` for consensus validation, creating a two-tier pipeline? What are the cost and latency implications?

### Finding 1: Corti Symphony is MCP-native and directly pluggable into multi-agent systems

- Corti launched the **Corti Agentic Framework** in February 2026 with "full compatibility for both Agent-to-Agent (A2A) and Model Context Protocol (MCP) standards, enabling plug-and-play interoperability without sacrificing control."
  — [SiliconANGLE: Corti launches multi-agent AI framework for healthcare](https://siliconangle.com/2026/02/03/corti-launches-multi-agent-ai-framework-healthcare/)
- Symphony for Medical Coding (launched April 1, 2026) is "available not only as an API endpoint but as an MCP that plugs directly into multi-agent systems via Corti's Agents Library." This means cliqueue's off-chain coding agent can call Symphony as an MCP tool call without any custom integration code.
  — [Corti: Introducing Symphony for Medical Coding](https://www.corti.ai/stories/introducing-symphony-for-medical-coding)
- The A2A support also enables Symphony to act as a downstream orchestration layer: Symphony's structured intermediate outputs (evidence spans, candidate codes, rejected alternatives) can be consumed directly by subsequent validation or compliance agents without re-parsing raw clinical text.
  — [Corti newsroom: Symphony ships](https://www.corti.ai/newsroom/corti-ships-symphony-for-medical-coding-accuracy-over-openai-anthropic)

### Finding 2: Symphony's API response structure is well-suited for on-chain hashing

- The `/tools/coding/` endpoint (POST) returns two arrays: `codes` (billable predictions given clinical context and coding guidelines) and `candidates` (clinically present but non-billable codes per coding rules). Each code includes:
  - `evidences` array with text spans, character offsets, and `contextIndex` mapping to source clinical text
  - `alternatives` array showing codes considered and rejected
  - A written justification for inclusion/exclusion
  — [Corti: Developer's guide to integrating medical coding](https://www.corti.ai/guides/a-developers-guide-to-integrating-medical-coding-capabilities)
- This structured output is ideal for hashing: cliqueue's off-chain agent can deterministically serialize the `codes` array into a canonical JSON string and compute an HMAC-SHA256 of (claimId + ICD10CodeArray + evidenceHashes). Only this hash goes on-chain as `icd10CodeHash`.
  — Cross-referenced with prior research at `docs/research/agreement-layer/on-chain-claim-struct-835-interoperability.md`

### Finding 3: Corti Symphony per-claim cost is ~$0.01–0.03 — well below incumbent benchmarks

- Corti uses a token-based credit model: **$4 per million input tokens** and **$16 per million output tokens** (current 2026 rates, reduced 20% from prior rates).
  — [Corti: We lowered prices](https://www.corti.ai/stories/we-lowered-prices-to-help-developers-build-healthcare-ai-apps-faster); [Corti pricing](https://www.corti.ai/pricing)
- A typical inpatient coding request involves approximately 1,000–2,000 input tokens (clinical note summary) and 300–500 output tokens (code assignments + evidence + justifications). Estimated per-claim cost:
  - Input (1,500 tokens): $0.006
  - Output (400 tokens): $0.0064
  - **Estimated total per claim: ~$0.012–0.025**
- This sits between the Somnia native LLM inference cost ($0.042–$0.070/claim for subcommittee=5) and is well below the $4–10/claim outsourced coding benchmark (200–800× cheaper).
  — Benchmark cross-reference: `docs/research/market/coding-market-size-and-denial-losses.md`; `docs/research/somnia/native-agents-vs-agent-kit.md`
- **Important caveat**: Corti does not publish per-call coding API pricing separately from general text token pricing. The above estimate assumes the coding endpoint is billed on text tokens, which matches their published credit model but has not been confirmed via official pricing documentation for the coding-specific endpoint. Enterprise contracts may differ.
  — [Corti pricing page](https://www.corti.ai/pricing)

### Finding 4: Corti Symphony accuracy exceeds the commercial CAC threshold on ambulatory data

- On 2.25 million clinical notes from a large US provider system, Symphony achieves **65.2% F1** vs. 58.8% for the next-best system — a 10.9% relative improvement on the hardest (full clinical note) coding task.
  — [PR Newswire: Symphony ships](https://www.prnewswire.com/news-releases/corti-ships-symphony-for-medical-coding-with-more-than-25-accuracy-edge-over-openai-and-anthropic-302730387.html)
- Symphony is built on the "Code Like Humans" framework (EMNLP 2025) trained on 5.8 million patient encounters. Its four-agent pipeline (evidence identification → hierarchy reasoning → guideline validation → ambiguity reconciliation) mirrors the professional coding workflow, not single-prompt extraction.
  — [Corti newsroom](https://www.corti.ai/newsroom/corti-ships-symphony-for-medical-coding-accuracy-over-openai-anthropic)
- **Limitation**: 65.2% F1 on full clinical notes is below the 95%+ automation rates claimed by commercial CAC vendors (Fathom, Nym, CodaMetrix) for specialized coding domains (radiology, ED). Symphony appears strongest on ambulatory/outpatient data; inpatient DRG performance is not published separately.
  — Cross-reference: `docs/research/market/inpatient-coding-performance-and-market-consolidation.md`

### Finding 5: HIPAA compliance is confirmed; BAA availability implied but not explicit

- Corti states Symphony is available with "sovereign cloud deployments for organisations handling protected health information" and the platform has "HIPAA and GDPR compliant infrastructure."
  — [Corti: AI Medical Coding API](https://www.corti.ai/medical-coding); [Corti Symphony page](https://www.corti.ai/symphony)
- Corti is confirmed GDPR and HIPAA compliant and "uses rigorous data redaction techniques to ensure that audio training data is stripped of PII."
  — [SiliconANGLE article](https://siliconangle.com/2026/02/03/corti-launches-multi-agent-ai-framework-healthcare/)
- No explicit BAA documentation is published publicly. Enterprise deployments with sovereign cloud suggest BAAs are available but must be executed separately. This is a required step before cliqueue can send PHI to the Symphony API from a hospital's environment.
  — **Weakly sourced** — BAA must be confirmed with Corti's legal team before production deployment.

### Finding 6: Somnia native `inferString` callback timing is undocumented — 5–30 seconds estimated

- Somnia's native Agents documentation does not publish specific latency figures for `createRequest` → `handleResponse` round-trip time. The only stated commitment is sub-second finality for standard transactions and block production at 100ms intervals.
  — [Somnia Docs: Invoking from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity); [Somnia: The Agentic L1](https://blog.somnia.network/p/somnia-the-agentic-l1-blockchain)
- The `createAdvancedRequest` function accepts a `timeout` parameter (unit undocumented), implying agent requests can time out if consensus is not reached within a configured window. This suggests agent round-trips are expected to take multiple blocks (not single-block).
  — [Somnia Docs: Invoking from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)
- **Estimated latency reasoning**: A Somnia LLM Inference `inferString` call requires (a) platform to elect subcommittee (~1 block = 100ms), (b) each validator node to call an LLM API and receive a response (LLM TTFT ~100–500ms for short prompts on modern inference providers), (c) consensus aggregation (~1–2 blocks), and (d) callback transaction mined (~100ms). Rough estimate: **5–30 seconds** end-to-end for subcommittee=5 with an external LLM backing the validators. This is unconfirmed from primary sources.
  — **Flagged as uncertain** — no primary source for agent callback latency; requires empirical measurement on Somnia mainnet.
- The two-tier pipeline (Corti Symphony → result hash → Somnia `inferString` validation) adds Somnia's unconfirmed 5–30 second callback to Symphony's synchronous API response time. For claim adjudication (not real-time), this is acceptable. For physician-query workflows requiring <5 second turnaround, it may be a blocker.

### Finding 7: The two-tier pipeline architecture is technically feasible

The proposed architecture:

1. Off-chain coder agent calls **Corti Symphony** via MCP tool call → receives structured ICD-10 codes + evidence
2. Agent computes `icd10CodeHash = HMAC-SHA256(claimId || serialize(codes))` off-chain
3. Agent submits hash to `ClaimsAdjudicator.submitCodes(claimId, icd10CodeHash, symphonyAttestationHash)` on Somnia
4. Adjudicator calls `createAdvancedRequest(LLM_INFERENCE_AGENT_ID, ...)` passing a validation prompt: "Given this ICD-10 code set [codes] and this clinical category [DRG family hash], are these codes internally consistent and plausible?" — a simpler validation task than full coding
5. Somnia validators run `inferString` → consensus validation result → `handleResponse` fires
6. On consensus pass, claim moves to `Adjudicated` state; on fail, dispute window opens

This pipeline isolates PHI handling entirely within Corti's HIPAA-compliant environment; only code arrays and hashes reach Somnia's public chain. The Somnia `inferString` validation serves as a decentralized sanity check rather than the primary coder.
  — Architecture synthesized from: [Corti developer guide](https://www.corti.ai/guides/a-developers-guide-to-integrating-medical-coding-capabilities); [Somnia Docs](https://docs.somnia.network/agents/invoking-agents/from-solidity); prior research at `docs/research/agreement-layer/oracle-attestation-schemes.md`

**Design implication:** cliqueue should adopt Corti Symphony as the primary off-chain ICD-10 coder via MCP integration, replacing the need to build or fine-tune a custom model. Symphony's MCP-native architecture makes it a plug-in component; its evidence-linked output maps cleanly onto the `icd10CodeHash` on-chain field; and its cost (~$0.012–0.025/claim) combined with Somnia native LLM validation ($0.042–0.070/claim) yields a total per-claim AI cost of ~$0.054–0.095 — still 40–185× cheaper than the $4–10 outsourced coding benchmark. The critical open item is confirming a BAA with Corti before PHI can flow to the Symphony API.

**Open questions generated:**
1. What is the actual BAA process and data processing agreement structure for using Corti Symphony in a US hospital context? Does Corti's HIPAA-compliant sovereign cloud deployment eliminate the need for the clinical note to leave the hospital's on-premise environment, or does it require sending PHI to Corti's cloud?
2. Does Corti Symphony's 65.2% F1 on full clinical notes hold for inpatient DRG-determination coding, or does the performance gap vs. commercial CAC (Fathom/CodaMetrix 95%+) require Symphony to be supplemented with a human-attestor agent role for inpatient claims?
3. What is the empirical end-to-end latency for a Somnia `createAdvancedRequest(subcommitteeSize=5)` LLM Inference callback on mainnet? Is the undocumented `timeout` parameter configurable in seconds or blocks, and what is a safe default that avoids stuck claims?

---

**See also** — [[../topics/corti|Corti hub]]
