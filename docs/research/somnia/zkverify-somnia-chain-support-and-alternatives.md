# zkVerify — Somnia Chain Support Status and ZK Proof Alternatives

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-15 — Has zkVerify deployed its `IZkVerify` receiver contract on Somnia mainnet (chain ID 5031)? If not, can cliqueue deploy it permissionlessly, or is first-party zkVerify team involvement required?

**Context:** Prior research ([[../regulatory/batch-aggregation-homogeneous-provider-cv-l-diversity|batch-aggregation-homogeneous-provider-cv-l-diversity]], [[../regulatory/re-identification-risk-low-volume-provider-batching|re-identification-risk-low-volume-provider-batching]]) raised the open question of whether a ZK range proof pattern could allow `ClaimsAdjudicator` to publish a provably correct `totalBilledCents` while simultaneously proving CV≥20% without revealing the individual claim distribution. This requires an on-chain ZK verifier on Somnia. zkVerify is the leading modular ZK verification layer. This research pass establishes whether zkVerify is usable on Somnia or whether an alternative path is required.

---

### Finding 1: zkVerify mainnet launched September 30, 2025 — Somnia is NOT among the supported destination chains

- zkVerify mainnet launched on September 30, 2025, as the first blockchain purpose-built for ZK proof verification, processing proofs at an annualized rate exceeding 35M.
  — [zkVerify Mainnet Launch PR Newswire](https://www.prnewswire.com/news-releases/zkverify-mainnet-launches-as-first-dedicated-blockchain-for-zero-knowledge-proof-verification-302570087.html); [zkVerify 2025 Year in Review](https://zkverify.io/blog/zkverify-2025-year-in-review)

- The confirmed destination chains for zkVerify mainnet attestation contracts (as of May 2026) are: **Ethereum, Base, Arbitrum, Optimism, Horizen, Ape, Flow**. Somnia (chain ID 5031) is **not listed** on the zkVerify homepage, documentation, or any public blog post.
  — [zkVerify.io homepage](https://zkverify.io/); [zkVerify Documentation](https://docs.zkverify.io/overview/contract-addresses)

- The VFY token was deployed on Base in 2025 as an expansion milestone. No announcement of Somnia integration was found in any zkVerify blog post or year-in-review through May 2026.
  — [zkVerify 2025 Year in Review](https://zkverify.io/blog/zkverify-2025-year-in-review)

### Finding 2: The zkVerify receiver contract is NOT permissionlessly deployable — it requires first-party team involvement

- The zkVerify attestation smart contract uses `onlyRole(OPERATOR)` access control on its `submitAggregation()` and `submitAggregationBatchByDomainId()` functions. The `OPERATOR` role is reserved for the **zkVerify authorized relayer bot** (operated by Horizen Labs at `relayer-api-mainnet.horizenlabs.io`).
  — [zkVerify Smart Contract Architecture Docs](https://docs.zkverify.io/architecture/proof-verification-smart-contract)

- A third party can deploy the contract bytecode to Somnia, but without the zkVerify relayer being updated to route attestations to that contract, no proof aggregations will ever be posted. The smart contract is inert without the authorized relayer. This means adding Somnia requires **first-party zkVerify/Horizen Labs involvement** to:
  (a) deploy the receiver contract to Somnia chain ID 5031, and
  (b) configure the relayer to relay aggregations to that contract.
  — [zkVerify Relayer Documentation](https://docs.zkverify.io/overview/getting-started/relayer)

- **Weakly sourced caveat:** No public-facing "chain request" or "chain integration request" process was found in zkVerify documentation or GitHub. The process for requesting a new destination chain is undocumented publicly. Contact via `relayer-support@horizenlabs.io` or Discord appears to be the only available channel.

### Finding 3: The zkVerify Relayer API does not list Somnia as a supported `chainId` parameter

- The zkVerify Relayer API accepts a `chainId` parameter when submitting proof verification requests. The documented example uses `chainId: 11155111` (Ethereum Sepolia) and refers users to the supported networks page for valid values.
  — [Verifying proofs with Relayer](https://docs.zkverify.io/overview/getting-started/relayer)

- Submitting a request with `chainId: 5031` (Somnia) would fail — no contract is deployed at that chain, and the relayer has no route for it. This blocks any cliqueue integration with zkVerify on Somnia mainnet today.

### Finding 4: An alternative path exists — native Groth16 on-chain verification on Somnia using `bn254` pairing precompile

- Somnia's EVM level is Paris (confirmed in prior research: [[evm-hardfork-level-paris-and-canary-tests]]). The Paris EVM includes the `bn128` pairing precompile (`ecPairing`, address `0x08`) — this precompile supports **BN254/alt_bn128 Groth16 on-chain verification** natively without any external relay.
  — [EIP-197: Precompiled contracts for elliptic curve BN128](https://eips.ethereum.org/EIPS/eip-197); [Ethereum Yellow Paper, Paris EVM spec]

- A self-hosted Groth16 verifier contract (e.g., using snarkjs-generated verifier.sol or Foundry's `groth16` verifier template) can be deployed directly on Somnia. The `ClaimsAdjudicator` can call `verifyProof(pA, pB, pC, pubSignals)` directly with no external relayer dependency. Gas cost for Groth16 on-chain verification on EVM chains (ecPairing check) is approximately 100,000–200,000 gas per proof, well within Somnia's gas model.
  — [SnarkJS on-chain verifier](https://github.com/iden3/snarkjs#7-generate-a-solidity-verifier); [EIP-197 gas schedule: 80,000 + 34,000 per pair]

- For the CV range proof use case (proving CV≥20% without revealing individual claim values), a ZK circuit can be constructed using Circom/snarkjs or Noir, generating a Groth16 proof that `ClaimsAdjudicator` verifies inline at batch settlement. This path requires cliqueue to maintain the ZK circuit and trusted setup, but does not require any third-party chain integration.

- **Weakly sourced caveat:** Somnia's `bn128` precompile support has not been independently confirmed on mainnet (no test call result in research docs). Given Paris EVM level is confirmed, EIP-197 should be available, but a canary test (calling `ecPairing` with known inputs) is required before relying on it.

### Finding 5: zkVerify's zkML/healthcare positioning is adjacent but not a deployment blocker

- zkVerify has positioned itself for healthcare-adjacent use cases (privacy-preserving ML, patient data authentication) and has published blog posts on ZK proof use in regulated industries.
  — [zkVerify: Privacy-Preserving ML Blog](https://zkverify.io/blog/revolutionizing-privacy-preserving-machine-learning-with-zk-proof-verification)

- A 2025 ScienceDirect paper describes ZKP-based anonymous patient authentication using STARKs and anonymous credentials on public/private blockchains — the research confirms ZK proofs in healthcare are academically active but does not use zkVerify or Somnia.
  — [ZKP Anonymous Patient Auth on Blockchain](https://www.sciencedirect.com/article/pii/S2590005625002176)

- No published integration between zkVerify and any healthcare claims platform was found.

---

**Design implication:** zkVerify is NOT available on Somnia today and requires first-party Horizen Labs involvement to add chain ID 5031 — making it an unreliable dependency for MVP. cliqueue should implement ZK range proof verification for the CV-suppression pattern using a **self-hosted Groth16 verifier contract deployed directly on Somnia**, leveraging the Paris EVM `bn128/ecPairing` precompile. This eliminates the cross-chain relayer dependency entirely. Before shipping, a canary test must confirm the `ecPairing` precompile (address `0x08`) executes correctly on Somnia mainnet. Separately, cliqueue may initiate a chain integration request to zkVerify for future composability, but it must not gate the ZK feature on that approval.

**Open questions generated:**
1. Does Somnia mainnet's `ecPairing` precompile (address `0x08`, EIP-197) execute correctly — a canary test calling `staticcall(0x08, ...)` with a known valid BN254 pairing should be added to the pre-deployment runbook alongside the existing Paris-level opcode canary tests. — priority: high
2. For the CV range proof circuit, what is the proving time on a commodity server (for the off-chain prover run by the payer agent) and does it fit within the expected batch settlement window — can a Circom/snarkjs circuit proving `CV(amounts) >= 20` with n=11 claims complete in <5 seconds wall clock? — priority: medium
3. Should cliqueue proactively request Somnia chain support from zkVerify/Horizen Labs (via `relayer-support@horizenlabs.io`) as a parallel track, so that the zkVerify path is available post-MVP if the self-hosted verifier proves difficult to maintain? — priority: low

---

**See also** — [[../topics/somnia-substrate|Somnia substrate hub]]
