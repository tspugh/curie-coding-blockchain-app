# Somnia inferToolsChat mcpServerUrls — Public vs. Private Endpoint Requirements

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-17 — Does `inferToolsChat` `mcpServerUrls` require publicly reachable endpoints, and what are the GDPR/HIPAA data-residency implications?

- **`mcpServerUrls` accepts any URL with no documented public-vs-private distinction.** The Somnia LLM Inference docs describe the parameter as "URLs of MCP servers whose tools the LLM may call" with no explicit "must be publicly reachable" requirement. The docs query interface returned: "use reachable MCP server URLs — no docs requirement for public vs private."
  — [Somnia Docs: LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference)

- **The official example URL `http://weather-service:80/` is a Docker Compose internal hostname.** This is a private service name (resolvable only within a Docker network), not a public internet URL. This strongly implies the Somnia team's reference architecture co-deploys the MCP server within the same container network as the service initiating the `inferToolsChat` call — NOT within the validator infrastructure. The smart contract invokes `inferToolsChat` on-chain; the Somnia agent platform orchestrates the MCP fetch from its own infra, not from the hospital side.
  — [Somnia Docs: LLM Inference (inferToolsChat example)](https://docs.somnia.network/agents/base-agents/llm-inference)

- **Validators are globally distributed across cloud regions (Frankfurt EU, New York US, Singapore APAC) with no published static egress IP ranges.** Confirmed validator operators include Hacken, Nethermind, ValidationCloud, Nodit — all enterprise cloud-hosted. No documentation exists for allowlisting validator IPs at a hospital firewall.
  — [GetBlock: Somnia Mainnet](https://getblock.io/blog/getblock-adds-somnia-mainnet-rpc-api-support/); [Hacken Somnia Validator](https://hacken.io/network/somnia/); [Nethermind Somnia Validator](https://www.nethermind.io/blog/nethermind-supports-somnia-launch-as-a-validator); [ValidationCloud Somnia](https://www.validationcloud.io/somnia)

- **"Reachable" means reachable from the Somnia agent orchestrator's network, not from validators directly.** The MCP fetch is executed by the agent platform (Somnia's managed infrastructure), not by each validator independently. Validators verify consensus on the response, but the actual HTTP call to the MCP server appears to originate from Somnia's agent orchestration layer. This is a critical architectural distinction — it means a single public-internet endpoint is sufficient (the orchestrator calls it), not N separate validator connections.
  — WEAK: Somnia docs do not explicitly confirm this orchestrator-calls-MCP vs. each-validator-calls-MCP distinction. Direct confirmation from Somnia DevRel required (`developers@somnia.foundation`).

- **HIPAA data-residency analysis: De-identified ICD-10 arrays are not PHI.** HIPAA's data-residency considerations apply to Protected Health Information. If `inferToolsChat` is called with de-identified ICD-10 code arrays (no patient name, DOB, MRN, claim ID in plain text) — which is cliqueue's intended architecture — then transmission through Somnia's orchestrator nodes in US or EU regions does not constitute a HIPAA disclosure. The ICD-10 codes themselves are not PHI under §164.514(b). Hashed `claimId` (HMAC-derived `bytes32`) transmitted as context is HIPAA-neutral.
  — [HIPAA University: Blockchain in Healthcare](https://hipaauniversity.com/blog/blockchain-in-healthcare/); [45 CFR §164.514(b)](https://www.law.cornell.edu/cfr/text/45/164.514)

- **GDPR analysis: ICD-10 codes without patient identifiers are not personal data under GDPR Art. 4(1).** EU validators processing a de-identified ICD-10 code array with no link to a natural person do not trigger GDPR data-processing obligations. The PHI→de-identified code transformation must occur before the `inferToolsChat` call (Corti Symphony runs hospital-side before on-chain submission). If the full clinical note were passed as context, GDPR Art. 9 (special category health data) would apply — another reason clinical notes must never appear in `inferToolsChat` message payloads.
  — WEAK: No GDPR enforcement authority has specifically addressed de-identified medical codes passing through blockchain validator networks.

- **No MCP authentication header mechanism documented.** The `inferToolsChat` signature (`mcpServerUrls string[]`, `onchainTools OnchainTool[]`, `maxIterations uint256`, `chainOfThought bool`) does not include an authentication parameter for MCP server calls. If Corti Symphony's MCP endpoint requires an API key, that key cannot be passed via the current on-chain interface without embedding it in the URL (e.g., `https://symphony.corti.ai/mcp?apiKey=...`) — which would expose the API key on-chain as a public transaction input. This is a critical security gap.
  — [Somnia Docs: LLM Inference](https://docs.somnia.network/agents/base-agents/llm-inference)

**Design implication:** cliqueue's architecture must NOT route Corti Symphony MCP calls through `inferToolsChat` — the Symphony API key would be exposed on-chain. The correct pattern is: (1) hospital agent calls Corti Symphony off-chain before `submitClaim()`; (2) `inferToolsChat` is used only for a second-opinion de-identified ICD-10 review against the Somnia native LLM (no Symphony API key, no PHI in message payload). This was already implied by the ROADMAP pre-computation pattern but is now a confirmed security requirement, not just a latency optimization.

**Open questions generated:**
1. Does the Somnia agent orchestrator (not individual validators) make the MCP HTTP call — and if so, can cliqueue obtain a static egress IP for the orchestrator to allowlist at a hospital-deployed MCP gateway (enabling hospital-side Symphony without public internet exposure)?
2. Is there a documented mechanism to pass per-request authentication secrets to MCP servers in `inferToolsChat` without embedding them in the URL — or is a reverse proxy pattern (hospital publishes a URL that validates requests via mTLS before forwarding to Symphony) the only option?
3. If `inferToolsChat` is restricted to de-identified ICD-10 context (no Symphony API key, no PHI), what is the practical accuracy of Somnia's native LLM for second-opinion ICD-10 code verification compared to Corti Symphony — and is a lower-accuracy second opinion still valuable for the audit trail?

---

**See also** — [[../topics/corti|Corti hub]] · [[../topics/somnia-substrate|Somnia substrate hub]]
