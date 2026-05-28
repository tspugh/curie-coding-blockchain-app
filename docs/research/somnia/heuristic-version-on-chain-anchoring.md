# Heuristic Version On-Chain Anchoring — OIG Audit Trail and Gas Cost Analysis

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should the `CodingConfidenceHeuristic` module version be anchored on-chain (as a `bytes32 heuristicVersion` field in `ClaimSubmitted`) to create a permanent OIG-inspectable audit record?

**Context:** The prior iteration (`docs/research/ai-models/coding-confidence-heuristic-spec.md`) established that the `CodingConfidenceHeuristic` module must be versioned and that the version must be logged in the off-chain claim audit record at submission time to satisfy OIG documentation requirements. This iteration investigates whether the version should also be anchored on-chain in the `ClaimSubmitted` event — creating a tamper-proof, OIG-auditable record accessible without accessing off-chain systems.

---

### Finding 1: OIG and DOJ now treat undocumented AI algorithm versions as a "reckless disregard" FCA risk vector

- The DOJ's emerging "reckless disregard" theory of False Claims Act liability, applied to AI in healthcare (White & Case healthcare fraud enforcement analysis, 2025), requires that every AI-influenced billing output be traceable to a specific model version with a documented validation record. DOJ's National Healthcare Fraud Takedown (2025) charged 324 defendants with $14.6B intended loss — the enforcement environment is active and expanding to AI-generated claims.
  — [White & Case: Healthcare Fraud Enforcement 2025](https://www.whitecase.com/insight-our-thinking/healthcare-fraud-enforcement-2025-year-aggressive-action-expanding-risk)
  — Assessment: High confidence. DOJ posture on AI version control in healthcare billing is documented.

- The FDA's December 2024 final guidance on Predetermined Change Control Plans formalized that "the interface should expose the current model version in each AI output so reviewers can map each output to the corresponding modification record." This applies to AI/ML-enabled medical devices; cliqueue's coding agent is not an FDA-regulated device, but the principle of output-linked version identification is the emerging standard across all federal healthcare AI oversight frameworks.
  — [AI Design for Regulated Industries 2026 — Fuselab Creative](https://fuselabcreative.com/ai-design-regulated-industries/)
  — Assessment: Medium confidence (FDA guidance cited by industry; original FDA document not directly retrieved).

- Censinet's documentation standard for healthcare AI (2025) explicitly requires: "Comprehensive documentation should explain which algorithms were used, what features influenced the decision, and the specific model version in play." Further: audit trails must include "parameter settings, model versions, and manual adjustments, with timestamps." This is the operational baseline that hospital procurement teams will request from cliqueue.
  — [Censinet: The Audit Trail Imperative](https://censinet.com/perspectives/audit-trail-imperative-documentation-standards-healthcare-ai)
  — Assessment: High confidence. Censinet is a leading healthcare AI risk/compliance advisory firm.

### Finding 2: Blockchain-anchored algorithm version records are an emerging best practice for tamper-proof audit trails — and specifically address the "who changed the routing logic and when" question that off-chain logs cannot answer

- Swept AI's audit trail standard for AI systems specifies that a proper audit log captures: "inputs/prompts, outputs/responses, model version, timestamp, user identity, decision rationale, guardrail actions, errors, and any human approvals or overrides." Swept notes that an immutable (tamper-proof) log is required for compliance — traditional mutable databases fail this requirement because they can be altered before audit.
  — [Swept AI: AI Audit Trail](https://www.swept.ai/ai-audit-trail)
  — Assessment: High confidence for the off-chain audit requirement; the tamper-proof requirement is what motivates on-chain anchoring.

- A 2025 ResearchGate study ("Blockchain-enabled Audit Trails for AI Models") documents a layered architecture where AI model lifecycle events (version releases, parameter changes) are anchored to an immutable ledger as `bytes32` content hashes, with selective privacy for IP. The architecture decouples the audit anchor (on-chain, tamper-proof) from the audit detail (off-chain, rich). This is directly applicable to cliqueue's `heuristicVersion` design.
  — [ResearchGate: Blockchain-enabled Audit Trails for AI Models](https://www.researchgate.net/publication/395415248_Blockchain-enabled_Audit_Trails_for_AI_Models)
  — Assessment: Medium confidence (academic; primary source retrieved but not deeply reviewed).

- The critical compliance property of on-chain version anchoring is **irrefutability**: an OIG auditor inspecting a specific claim event on Somnia can independently verify which routing version was active at submission time, without requesting off-chain records from cliqueue or the hospital. Off-chain audit logs, even if signed, require the OIG to trust that the log has not been modified since submission — the on-chain anchor removes that trust requirement.
  — Analytical inference from Swept AI and Censinet findings above.
  — Assessment: High confidence architectural inference.

### Finding 3: Somnia's event log gas pricing makes adding `bytes32 heuristicVersion` as non-indexed data cost approximately 5,120 additional gas per `ClaimSubmitted` event — negligible vs. claim economics

- Somnia's event log gas formula (from official docs): `3200 + 5120 * topic_count + 160 * size`. This is significantly more expensive per topic than Ethereum (Ethereum: `375 + 375 * topic_count + 8 * size`). Specifically, each indexed topic on Somnia costs 5,120 gas vs. Ethereum's 375 gas — a 13.7x premium per indexed parameter.
  — [Somnia Docs: Gas Differences to Ethereum](https://docs.somnia.network/developer/somnia-gas-differences-to-ethereum)
  — Assessment: High confidence. Primary source from Somnia documentation.

- **Adding `heuristicVersion` as non-indexed data (32 bytes):** incremental cost = `160 * 32 = 5,120 gas`. At Somnia's current mainnet SOMI price and gas economics (prior research: ~$0.001/gas equivalent for context), this adds approximately **$0.005 per claim submission** — less than 0.1% of the $4–10 outsourced coding benchmark. The gas cost is not a blocking constraint.
  — Gas calculation based on Somnia formula above; cost estimate is directional (SOMI price volatile).
  — Assessment: High confidence for formula; medium confidence for dollar cost (SOMI price dependent).

- **Adding `heuristicVersion` as an indexed topic (4th topic):** incremental cost = `5,120 gas` — identical to non-indexed 32-byte data on Somnia. However, indexing `heuristicVersion` enables O(1) log filtering by version (e.g., "find all claims submitted with heuristicVersion v1.2.3") without scanning all `ClaimSubmitted` events. This is directly useful for OIG auditors or cliqueue's own audit tooling during a version migration.
  — Analytical inference from Somnia event gas docs and Solidity indexing semantics.
  — Assessment: High confidence.

- **Recommendation on indexing:** `heuristicVersion` should be **indexed** in `ClaimSubmitted`. The gas cost is identical to non-indexed but the filter capability is valuable for post-hoc audit queries. Somnia's cold-SLOAD surcharge does not apply to event logs (events are not contract state slots); the 1M-gas cold-SLOAD penalty is irrelevant here.
  — Assessment: High confidence architectural inference.

### Finding 4: The `heuristicVersion` value should be a `keccak256` hash of the NPM package version string — not a raw version string — to fit in `bytes32` and enable deterministic on-chain verification

- Solidity `bytes32` can hold exactly 32 bytes. A SemVer version string like `"@cliqueue/coding-confidence-heuristic@1.0.0"` is 42 characters — it does not fit directly in a `bytes32` slot without truncation. The canonical approach is to emit `keccak256(abi.encodePacked(versionString))` from the off-chain TypeScript agent and store/compare that hash on-chain.
  — [Solidity ABI Specification](https://docs.soliditylang.org/en/latest/abi-spec.html)
  — Assessment: High confidence.

- A registry pattern (optional, additive): `ClaimsAdjudicator` could maintain a `mapping(bytes32 => string) public heuristicVersionRegistry` allowing the governance multisig to register canonical version strings on-chain for each hash. OIG auditors could then call `heuristicVersionRegistry(versionHash)` to decode the human-readable version string without off-chain lookups. This is additive and can be deferred to post-MVP.
  — Analytical synthesis.
  — Assessment: Medium confidence (design synthesis, not externally validated).

---

**Design implication:** `ClaimSubmitted` should include a fourth indexed `bytes32 heuristicVersion` field, set to `keccak256(abi.encodePacked(MODULE_VERSION))` in the off-chain TypeScript agent before committing the claim. The incremental Somnia gas cost is ~5,120 gas per submission (negligible). This creates a tamper-proof, OIG-auditable record of which routing version governed each claim — directly addressing the DOJ "reckless disregard" FCA risk and hospital procurement teams' audit trail requirements. An optional `heuristicVersionRegistry` mapping can be added post-MVP to decode version hashes on-chain.

**Open questions generated:**
1. Should cliqueue's hospital BAA include a Calibration Attestation Exhibit — a signed document stating the hospital's chosen `MIN_EVIDENCES` and `MAX_ALTERNATIVES` values and the validation study conducted before setting those values — to document that cliqueue is not the party that chose the routing threshold for that hospital's claim mix?
2. Should `ClaimsAdjudicator` maintain an on-chain `heuristicVersionRegistry` mapping (`bytes32 hash → string versionString`) governed by the `TimelockController`, so that OIG auditors can decode human-readable version strings without off-chain lookups — and does adding this registry create a DASP risk under the GENIUS Act if version registration is treated as a material upgrade to the protocol?
3. Does Somnia's block explorer (or Ormi's indexer) support filtering `ClaimSubmitted` events by indexed `bytes32` topic — enabling cliqueue's audit tooling to query "all claims submitted with heuristic version v1.2.3" via a standard `eth_getLogs` filter without a separate off-chain index?

---

**See also** — [[../topics/dispute-window|dispute-window hub]] · [[../topics/somnia-substrate|Somnia substrate hub]]
