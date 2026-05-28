# LLM Model Availability on Somnia and ICD-10 Coding Accuracy

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — What LLM models does Somnia's native LLM Inference base agent expose, and are they sufficient for ICD-10 coding accuracy without Phase 2 custom agents?

### Finding 1: Somnia Phase 1 does not publish a model catalog — underlying models are opaque

- **Somnia's official documentation explicitly does not name specific LLM model families or variants** for the Phase 1 LLM Inference agent. The docs state the platform provides "deterministic on-chain AI models" but offer no model ID, model name, or model version to Solidity callers. The interface (`inferString`, `inferNumber`, `inferChat`, `inferToolsChat`) is purely prompt-in / text-out with no model selection parameter.
  — [Somnia Docs: LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference.md)
- Determinism is achieved through "fixed random seeds and controlled temperature parameters" applied uniformly across validator nodes — the model selection and pinning is an internal Somnia infrastructure concern, invisible to the contract developer.
  — [Somnia Docs: LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference.md)
- **Critical implication**: cliqueue cannot select a medically fine-tuned model (e.g., a Llama fine-tuned on ICD-10 data) through the Phase 1 native agent interface. The model used for coding attestation consensus is whatever Somnia's validators run — a black box from the contract's perspective.
  — [Somnia Docs: Agents README](https://docs.somnia.network/agents/readme.md)

### Finding 2: Base LLMs (GPT-4, Claude) perform poorly at ICD-10 coding without fine-tuning

- **NEJM AI 2023 benchmark**: GPT-4 achieved only 33.9% exact match rate against ICD-10 code descriptions and 15.2% agreement with human coders for full clinical note coding. For primary diagnosis, Claude 3 performed best among base models at 26% agreement with human coders.
  — [NEJM AI: Large Language Models Are Poor Medical Coders](https://ai.nejm.org/doi/full/10.1056/AIdbp2300040)
- **The systematic problem is not model size, it is workflow alignment**: GPT-4 generates "codes conveying imprecise or fabricated information" when prompted naively. Production-quality ICD-10 coding requires alignment with the official coder workflow (alphabetic index → tabular list → guidelines check), not a single-prompt extraction.
  — [PMC: ICD-10 Coding Assistant RoBERTa + GPT-4](https://pmc.ncbi.nlm.nih.gov/articles/PMC11835781/); [NEJM AI](https://ai.nejm.org/doi/full/10.1056/AIdbp2300040)

### Finding 3: Fine-tuned LLMs dramatically improve accuracy — but require domain-specific training data

- **PMC May 2025 (domain-specific fine-tuning study)**: Fine-tuning on 74,260 ICD-10 code–description pairs increased exact matching from <1% (baseline) to **97.48%** (GPT-4o mini) and **98.80–98.83%** (Llama-3.2-1B/3B/3.1-8B) on isolated code descriptions. On full real-world clinical notes (the harder, production-relevant task), a fine-tuned Llama-3.2-1B achieved **69.20% exact match** and **87.16% category-level match**.
  — [PMC / npj Health Systems: Enhancing medical coding efficiency through domain-specific fine-tuned LLMs](https://pmc.ncbi.nlm.nih.gov/articles/PMC12045799/)
- **arXiv March 2026 (privacy-preserving synthetic data fine-tuning)**: Fine-tuned Llama-3-70B-Instruct on synthetically generated clinical note / ICD-10 pairs (no PHI) achieved F1 of **0.704** for ICD-10-CM exact code matching (up from 0.180 baseline) and F1 of **0.736** for CPT coding. High recall (0.86–0.93) with lower precision (0.32–0.40) — useful as a candidate-surfacing tool requiring human validation.
  — [arXiv: Training a LLM for Medical Coding Using Privacy-Preserving Synthetic Clinical Data](https://arxiv.org/html/2603.23515v1)

### Finding 4: Agentic (multi-step) LLM pipelines outperform single-prompt LLM coding

- **MDPI March 2026 study on 19,801 MIMIC-IV discharge summaries**: Compared three approaches: (1) PLM-ICD deep learning alone (55.8% precision, 15 codes per case), (2) LLM-only generation (1.5–34.6% precision, inconsistent output), (3) agentic audit — PLM-ICD drafts candidates, LLM verifies/rejects. The agentic approach delivered the best precision/recall trade-off: Llama-3.2-3B-Instruct improved from **1.5% precision as a generator to 55.1% as a verifier**, trimming false positives by 73%, returning 2–8 high-confidence codes per case.
  — [MDPI Informatics 2026: Integrating Agentic AI to Automate ICD-10 Coding](https://www.mdpi.com/2227-9709/13/3/39)
- **Corti Symphony (April 2026)**: A domain-specific agentic framework (four-agent pipeline: evidence identification → hierarchy reasoning → guideline validation → ambiguity reconciliation) trained on 5.8 million patient encounters outperforms GPT-4/Claude/Gemini by **>25% in clinical accuracy benchmarks**. Built on the "Code Like Humans" framework (EMNLP 2025). Available via API with A2A and MCP standard support.
  — [Corti press release](https://www.corti.ai/newsroom/corti-ships-symphony-for-medical-coding-accuracy-over-openai-anthropic); [HIT Consultant](https://hitconsultant.net/2026/04/02/corti-symphony-medical-coding-ai-outperforms-openai-google/)

### Finding 5: RAG significantly improves base LLM performance for ICD-10 coding

- **PubMed / Emergency Department RAG study (2024, published 2025)**: RAG-enhanced LLMs evaluated on 500 ED visits against a retrieval database of 1,038,066 prior visits. Human reviewers preferred GPT-4+RAG outputs over provider-assigned codes in **447 of 724 discrepant cases** (vs. 277 for human coders, p<0.001). Llama-3.1-70B+RAG preferred in 218 vs. 90 instances. Qwen-2-7B improved from 0.8% to 17.6% exact match; Gemma-2-9b improved from 7.2% to 26.4%.
  — [PubMed: RAG LLM vs. Human Coders in ED ICD-10 Coding](https://pubmed.ncbi.nlm.nih.gov/39484238/)
- RAG retrieval from a historical claims/coding database (not PHI) is compatible with cliqueue's off-chain architecture: the coding agent can query a FHIR-backed code lookup or ICD-10 tabular index without bringing PHI on-chain.

### Finding 6: The Somnia Phase 1 opaque model is likely inadequate for production ICD-10 coding accuracy

- Given Findings 2–4, an undisclosed general-purpose LLM running at fixed temperature on Somnia's Phase 1 agent will almost certainly fall in the 15–35% accuracy range characteristic of unaugmented base models on ICD-10 tasks — well below the 95%+ autonomy rates achieved by commercial CAC vendors.
- cliqueue's Phase 1 architecture **cannot rely on Somnia's native LLM Inference agent as the primary coding engine**. Instead, the off-chain coding agent must run a fine-tuned or RAG-enhanced model (Llama fine-tuned, Corti Symphony API, or similar), with the Somnia native `inferString`/`inferChat` serving only as the **consensus oracle** that validates a submitted coding result — not as the coder itself. This aligns with the previously documented design (see `docs/research/somnia/native-agents-vs-agent-kit.md`).
  — Cross-referenced with [Somnia Docs: Agents README](https://docs.somnia.network/agents/readme.md) and prior research findings at `docs/research/somnia/native-agents-vs-agent-kit.md`

**Design implication:** cliqueue must deploy its ICD-10 coding logic off-chain using a fine-tuned or RAG-enhanced model (e.g., a Llama variant fine-tuned on coding data, or a third-party API like Corti Symphony which now supports MCP standard). The Somnia native LLM Inference agent should be scoped to a **coding-result validation prompt** (e.g., "given these ICD-10 codes and this clinical summary hash, are these codes plausible for the stated diagnosis category?") rather than full ICD-10 assignment — a simpler task more compatible with a general-purpose LLM. Full ICD-10 code assignment requires a specialized model or agentic pipeline running off-chain.

**Open questions generated:**
1. Corti Symphony now supports MCP standard — can cliqueue's off-chain coding agent call Corti Symphony via MCP, with the result hash passed to Somnia's native `inferString` for consensus validation, creating a two-tier pipeline? What are the cost and latency implications?
2. For the off-chain RAG retrieval database backing the coding agent, what is the minimum ICD-10 code description + historical-claims dataset required to achieve commercial CAC-comparable accuracy (>90% automation rate), and is a FHIR Terminology Server sufficient as the retrieval corpus?
3. Does Somnia Phase 2 "Full Agent SDK" allow deploying a fine-tuned model (e.g., Llama-3-70B fine-tuned on ICD-10 coding) as a custom on-chain agent? What is the expected Phase 2 timeline and compute cost for a 70B-parameter model?

---

**See also** — [[../topics/corti|Corti hub]] · [[../topics/somnia-substrate|Somnia substrate hub]]
