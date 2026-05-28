# Somnia Native LLM Inference — On-Chain Public Data Exposure

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-26 — Does the LLM prompt and reasoning end up on-chain (and public) when a smart contract uses Somnia's native LLM Inference agent?

**Question.** If a Somnia smart contract invokes the native LLM Inference base agent, do the prompt/input and the model's output (and any reasoning) get recorded on-chain where anyone can read them? This matters because (a) PHI must never be public, and (b) we want to avoid leaking that the domain is ICD-10 medical coding — presenting instead as a generic healthcare application.

**Short answer: Yes.** For the *native, on-chain* LLM Inference agent, both the request payload (the prompt/messages) and the validator-agreed result are emitted in events and stored in on-chain state, retrievable by anyone via a node/explorer. There is no privacy or encryption layer for agent inputs or outputs in Somnia's documentation. Any clinical text, ICD-10 rationale, or payer-policy text fed into the on-chain agent is therefore public and permanent.

### Finding 1: The request payload (prompt/messages) is emitted on-chain and stored

- A contract invokes an agent via `createRequest(agentId, callbackAddress, callbackSelector, payload)` (or `createAdvancedRequest(...)`). The `payload` is the ABI-encoded input — for LLM Inference this carries the `roles`/`messages` (the prompt).
  — [Somnia Docs: Invoking from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)
- The platform **emits `RequestCreated(... bytes payload, ... subcommittee)`** so off-chain validator runners can pick up the work. The docs describe this as emitting "details for off-chain runners." Because the prompt must reach the validators to be executed, it is disclosed on-chain in this event.
  — [Somnia Docs: Gas Fees for Agents](https://docs.somnia.network/agents/invoking-agents/gas-fees.md)
- Request data is also queryable after the fact via `getRequest(uint256 requestId)`, which returns the full `Request` struct (requester, callback, subcommittee, responses, status). The input therefore persists in on-chain state, not just in a transient log.
  — [Somnia Docs: Invoking from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)

### Finding 2: The model output is stored on-chain and handed back in the callback

- Consensus output is delivered to `handleResponse(uint256 requestId, Response[] responses, ResponseStatus status, Request details)`. The contract decodes `responses[0].result` (e.g., `abi.decode(responses[0].result, (string))`) — the LLM's output text.
  — [Somnia Docs: LLM Parse Website](https://docs.somnia.network/agents/base-agents/llm-parse-website); [Somnia Docs: Invoking from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)
- The `Response[]` structs are stored inside the `Request` struct (readable via `getRequest`) and the callback also receives the original `Request details` — so both the **output and the original input** are on-chain at callback time, visible on block explorers.

### Finding 3: "Reasoning" — what consensus covers vs. what is exposed

- Inference is **deterministic** (Qwen3-30B, `temperature=0`, fixed seeds) so validators produce byte-identical outputs. Validators reach **consensus on the final result**. Per-node "receipt" steps (how a node computed the result) are described as **subjective** — they may vary slightly between nodes and are shown for transparency, not agreed by consensus.
  — ["Building on the Agentic L1: A Developer's Guide"](https://blog.somnia.network/p/building-on-the-agentic-l1-a-developers); see [[somnia-agentic-l1 skill]]
- Implication: chain-of-thought is not the consensus object, but it does **not** follow that reasoning is private. (a) The **prompt** is public (Finding 1). (b) The **output** is public (Finding 2) — if you ask the model to emit a rationale, that rationale is public. (c) Receipts are exposed for transparency. The safe assumption is that anything the model reads or writes through the native agent is public.

### Finding 4: No privacy / encryption mechanism exists for agent data

- Somnia's documentation contains **no confidentiality, encryption, or off-chain-payload mechanism** for agent prompts or outputs. The only "security/private" material in the docs concerns operational secrets — RPC URLs, `PRIVATE_KEY`, explorer API keys in `.env` — which is unrelated to agent data confidentiality.
  — [Somnia Docs: Node/Infra Security](https://docs.somnia.network/developer/security/node-infra-security); [Go-Live Checklist](https://docs.somnia.network/developer/deployment-and-production/go-live-checklist)

### Finding 5: The `mcpServerUrls` path is not a clean privacy escape

- `inferToolsChat(roles, messages, mcpServerUrls, onchainTools, ...)` lets the validator-run LLM fetch additional context from off-chain MCP servers; only the URL (not the fetched data) sits in calldata. This *looks* like a way to keep sensitive context off-chain.
  — [Somnia Docs: LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference)
- But it does not solve exposure: (a) the `messages` themselves remain on-chain; (b) the final `result` remains on-chain; (c) prior internal research found `inferToolsChat`/`mcpServerUrls` has **no auth-header mechanism** for the validator→MCP leg, so an off-chain endpoint cannot authenticate the caller cleanly — and we already concluded Symphony (the real coding reasoning) must NOT route through `inferToolsChat`. See [[infer-tools-chat-mcp-endpoint-network-requirements]] and [[mcp-reverse-proxy-auth-without-url-key]].

---

## Reasoning and design implications

**The hackathon's headline primitive is fundamentally public.** Somnia's differentiator is consensus-verified, on-chain LLM inference. By construction the inputs and outputs are published on-chain so independent validators can agree on them. That is the opposite of confidential.

**1. Keep all substantive reasoning off-chain (unchanged from ROADMAP).** The provider/payer coding reasoning runs off-chain (off-chain model or `somnia-agent-kit` off-chain LLM adapters); only **hashes, lifecycle state, settlement amounts, and signatures** are anchored on-chain. This is already the project's no-PHI-on-chain design. The native on-chain agent must not be fed clinical notes, ICD-10 codes, code descriptions, or payer-policy text.
  — [ROADMAP.md: on-chain/off-chain boundary](../../ROADMAP.md)

**2. If we use the native on-chain agent at all (for the judging angle), feed it only opaque/synthetic data.** Inputs limited to hashes, opaque identifiers, or generic booleans; outputs limited to a domain-neutral enum (e.g., `Approve | RequestEvidence | Downcode | Dispute`) or a numeric score — never free-text rationale, never an ICD-10 code or its description. Use synthetic, non-identifying demo data only.

**3. Domain-leakage is a separate risk from PHI.** Even PHI-free on-chain data can reveal the application domain. Function selectors, event names, decoded strings, and code values would betray "ICD-10 medical coding" to anyone reading the chain. To credibly present as a generic "healthcare lens" without disclosing the ICD-10 focus, on-chain payloads/outputs must use **opaque identifiers and hashes** — no medical code systems, descriptions, or recognizable schema in clear text.

**4. There is a real tension to manage.** "Showcase Somnia's on-chain LLM inference" (judges want the headline primitive used as a real ingredient) pulls against "keep reasoning private and hide the ICD-10 domain." Resolution: use the native on-chain agent for a **narrow, non-sensitive, demonstrable step on synthetic/opaque data** (e.g., a generic policy classification over a hashed/abstracted claim attribute), and keep the substantive coding reasoning off-chain with only commitments anchored. This preserves both the demo story and the privacy/secrecy requirements.

**Design implication:** Treat the native LLM Inference agent as a *public* compute oracle. Never route PHI or ICD-10-identifying content through it. The substantive agent reasoning stays off-chain; the chain stores hashes, state, settlement, and at most domain-neutral, synthetic adjudication signals.

## Open questions generated

1. Can the on-chain agent step be reduced to operating purely over a **commitment (hash)** plus a domain-neutral output, such that an explorer reader learns nothing about the domain or the underlying claim? — priority: high
2. Are per-node **receipts** publicly retrievable (and could they leak more than the final `result`, e.g., intermediate tokens or fetched MCP context)? — priority: medium
3. For the demo, is there any value in the native agent at all, or is an **off-chain attestation hashed on-chain** strictly safer and still judge-credible? — priority: medium
