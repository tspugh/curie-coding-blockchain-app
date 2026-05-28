# Oracle Attestation Schemes for Off-Chain Coding Agent Output

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — What attestation scheme bridges off-chain ICD-10 coding agent output to on-chain adjudication without PHI on-chain?

This question is the critical trust boundary for the entire cliqueue-coding-blockchain design: the coding agent runs off-chain (it must, because it processes PHI), but the adjudication contract on Somnia must trust its ICD-10 code assignments before releasing funds.

### The fundamental problem: AI output non-determinism conflicts with blockchain consensus

- LLMs and AI coding models are probabilistic by nature. Non-zero temperature sampling means repeated invocations of the same model on the same clinical note may produce different ICD-10 assignments. This directly conflicts with blockchain's requirement for deterministic consensus: validators cannot independently re-execute the AI to verify a submitted result.
  — [Frontiers in Blockchain 2025: Can AI solve the oracle problem?](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1682623/full); [arXiv:2507.02125](https://arxiv.org/abs/2507.02125)
- Fixing temperature to zero partially mitigates non-determinism but degrades output quality and does not eliminate model-weight version drift. The oracle problem for AI outputs is therefore *epistemological* (validators cannot know the ground truth), not just technical.
  — [Frontiers in Blockchain 2025: Can AI solve the oracle problem?](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1682623/full)
- The paper concludes: "AI should be understood as a complementary layer of inference and filtering within a broader oracle design, not a substitute for trust assumptions." AI does not eliminate the need for an attestation layer; it is one node in that layer.
  — [Frontiers in Blockchain 2025](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1682623/full)

### Scheme 1: Multi-sig n-of-m (baseline)

- Classic approach: n independent coding agents (or human coders) each sign the coding result; the smart contract requires m-of-n signatures. Each signer's pubkey is known; the contract verifies each signature independently.
- **On EVM/Somnia, multi-sig is gas-expensive**: on-chain verification of 4,096 signers costs >23 million gas. For a 3-of-5 or 5-of-9 scheme with small n, costs are manageable, but multi-sig scales poorly and exposes the signer set publicly on-chain.
  — [MPC Wallets vs Multi-Sig Wallets 2025](https://www.chainup.com/blog/mpc-wallets-vs-multi-sig-wallets/)
- For the cliqueue use case with Somnia's LOG-cost surcharge (~13× Ethereum), a 3-of-5 multi-sig attestation is technically feasible but operationally fragile if any of the five independent coding agents is unavailable or compromised.

### Scheme 2: BLS threshold signatures (preferred for gas efficiency)

- **BLS threshold signatures aggregate n individual agent signatures into a single compact proof** that the smart contract verifies with a single ecPairing call (though Somnia's ecPairing precompile is 250× more expensive than Ethereum — see gas constraint below).
- The Supra Threshold AI Oracle system (announced May 2025) uses exactly this pattern: a randomized subcommittee of oracle nodes each run the AI model, deliberate, and aggregate into a compact BLS threshold signature, which the contract verifies in a single call.
  — [Supra: Threshold AI Oracles (academy post)](https://supra.com/academy/threshold-ai-oracles-brings-intelligence-on-chain/); [Chainwire: Supra launches Threshold AI Oracle](https://chainwire.org/2025/05/22/supra-introduces-their-new-ai-oracle-protocol-making-web3-smarter-and-more-secure/)
- The MTAS (Multi-Threshold Aggregate Signature) scheme derived from Schnorr adds block-height-based temporal binding (`Mr = (R + blockHeight) mod p`), preventing replay attacks. It uses an adaptive threshold formula rather than a fixed n-of-m ratio, and delivers 724 TPS throughput at <2.5M gas peak in benchmarks.
  — [PMC: MTAS oracle reputation mechanism](https://pmc.ncbi.nlm.nih.gov/articles/PMC10818358/); [MDPI Sensors 24(2):502](https://www.mdpi.com/1424-8220/24/2/502)
- **Somnia gas constraint**: Somnia's ecPairing precompile costs 250× Ethereum's. BLS signature verification (which requires ecPairing) on Somnia is therefore economically costly per-claim. At current Somnia gas pricing, a single BLS verification on-chain could cost $0.15–0.75 — which is material relative to the $4–10 per-claim outsourced coding benchmark. This is a significant constraint unique to Somnia vs. standard EVM chains.
  — [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)

### Scheme 3: Somnia native Agents consensus (most natural for this chain)

- Somnia's first-party agent invocation protocol (`createRequest` / `createAdvancedRequest`) already implements a multi-validator consensus pattern without requiring custom BLS verification on-chain. The platform elects a subcommittee of validators who each execute the agent; consensus is reached off-chain and the callback delivers the agreed result with the callback verifying `msg.sender == platformAddress`.
  — [Somnia Docs: Invoking Agents from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)
- `createAdvancedRequest()` accepts configurable `subcommitteeSize`, `threshold`, and `consensusType` (Majority or Threshold). The callback contract receives all validator responses, enabling on-chain detection of outlier submissions. Payment mechanics (median-reported executionCost) create implicit honesty incentives.
  — [Somnia Docs: Invoking Agents from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)
- **Critical gap**: Somnia's native agent documentation does not describe cryptographic slashing, stake requirements per validator, or reputation-based exclusion. The trust model is currently *platform-trust* (you trust Somnia's validator set), not cryptoeconomic-adversarial. This is adequate for early deployment but not for a permissionless agent network.
  — [Somnia Docs: Invoking Agents from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity)

### Scheme 4: TEE-based attestation (Phala / Intel SGX)

- A Trusted Execution Environment (TEE) runs the coding agent inside a hardware-attested enclave (Intel SGX or AMD SEV-SNP). The enclave produces a signed attestation report proving: (a) the exact model binary that ran, (b) the input hash (clinical note hash, no PHI on-chain), and (c) the output ICD-10 codes. This report is verifiable without re-running the model.
  — [Phala Network TEE documentation](https://phala.com/posts/phala-network-5-years-of-pioneering-tee-verifier-solutions); [OpenMetal: Secure Oracles and Confidential Computing](https://openmetal.io/resources/blog/secure-oracles-and-smart-contracts-the-role-of-confidential-computing-in-decentralized-trust/)
- Phala Network is the most production-ready decentralized TEE oracle: SOC 2 Type I certified, HIPAA compliant (ISO 27001 in progress), EVM-compatible, processed ~30,000 contract calls/day in early 2025, with ~2,000 active workers.
  — [Phala: TEEs Secured by Ethereum](https://phala.com/posts/TEEs-Secured-by-Ethereum); [Messari: Understanding Phala Network](https://messari.io/report/understanding-phala-network-a-comprehensive-overview)
- TEE attestation sidesteps the non-determinism problem: validators don't need to re-run the model; they verify the TEE report. The trust assumption shifts from "multiple parties agreed" to "Intel/AMD hardware attestation is unforgeable." This is a different (and arguably stronger) trust model for AI outputs than threshold signatures.
  — [Phala Network overview](https://docs.phala.com/network/overview/phala-network)

### Scheme 5: Optimistic Proof of Computation (OpPC)

- OpPC takes an optimistic approach: the coding agent submits its ICD-10 assignment and a challenge window opens (e.g., 24–72 hours). Any whitelisted challenger (payer auditor, compliance agent) can dispute the output by providing counter-evidence. If unchallenged, the result is accepted and funds release.
  — [Optimistic Proof of Computation: Decentralized AI Oracle](https://internationalpubls.com/index.php/pmj/article/download/5884/3324/10461)
- **Gas advantage**: OpPC minimizes on-chain computation to the happy path (submission + release). ZK proofs require expensive cryptographic operations every time; OpPC only incurs dispute-verification cost when challenged. For healthcare coding where the 84% "avoidable" denial rate suggests most clean claims are unchallenged, this is attractive.
  — [OpPC paper](https://internationalpubls.com/index.php/pmj/article/download/5884/3324/10461)
- **Healthcare-specific advantage**: the challenge window naturally accommodates payer clinical review processes, pre-authorization checks, and coding compliance audits — workflows that already exist in the current EDI flow. The window can be set to match the 14-calendar-day documentation attachment window mandated by payers.
  — [OpPC paper](https://internationalpubls.com/index.php/pmj/article/download/5884/3324/10461)
- **Risk**: if the challenge window is short (to minimize payment latency), sophisticated fraud may go undetected. If long, it eliminates the latency advantage of blockchain settlement.

### ZK proofs: technically sound but economically prohibitive on Somnia

- ZK proofs of correct ICD-10 coding (proving an AI model correctly applied coding guidelines to an input without revealing the clinical note) would be the gold standard for trustless, PHI-safe attestation.
  — [PMC: Ethical AI with ZKPs and Smart Contracts](https://pmc.ncbi.nlm.nih.gov/articles/PMC12650700/); [Nature: ZK-rollups for healthcare data exchange](https://www.nature.com/articles/s41598-026-35289-9)
- However, Somnia's ecPairing precompile costs 250× Ethereum. ZK proof verification (e.g., Groth16, PLONK) requires pairing operations. On Somnia, this is economically prohibitive for per-claim verification — a finding confirmed in the Somnia gas model research.
  — [Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)
- ZK prover overhead is also high: prover times for complex AI model execution traces are still measured in minutes (2026 outlook for improvement per PMC 2025 review). Not suitable for real-time claim throughput.
  — [PMC 2025: Privacy preservation in blockchain healthcare](https://pmc.ncbi.nlm.nih.gov/articles/PMC12534302/)

### Recommended architecture for cliqueue

The research points to a **layered attestation design**:

1. **Primary path (Somnia native Agents, Majority/Threshold consensus, 3-of-5 subcommittee)**: Use `createAdvancedRequest()` with subcommitteeSize=5, threshold=3, consensusType=Majority. Each Somnia validator node runs the ICD-10 coding agent (deterministic, temperature=0, pinned model hash). The coding result + confidence score is the agent response. Cost: ~0.03 SOMI/invocation per platform docs; no custom BLS verification needed on-chain.
2. **Dispute path (OpPC-style challenge window)**: After the native Agents consensus resolves and the adjudication contract stores the result, a 48-hour challenge window opens for the payer's compliance agent to dispute the coding. Dispute evidence goes to an off-chain arbitration agent; only the final dispute resolution hits the chain.
3. **TEE for PHI handling**: The coding agent itself runs in a Phala TEE (HIPAA compliant), with the TEE attestation report hash stored on-chain alongside the ICD-10 codes. This proves to auditors that PHI was processed in a HIPAA-compliant enclave without any PHI touching the chain.

**Design implication:** cliqueue-coding-blockchain should avoid custom BLS threshold signature verification on-chain (Somnia's 250× ecPairing cost makes it uneconomic), avoid ZK proof verification per claim (same reason), and instead rely on Somnia's native 5-state agent invocation consensus for the primary attestation path with an OpPC-style challenge window for the dispute phase. PHI handling belongs in a Phala TEE-attested off-chain enclave, with only the TEE attestation report hash and ICD-10 code hash anchored on-chain.

**Open questions generated:**
1. What is the actual per-claim gas cost (in USD) for a Somnia native `createAdvancedRequest(subcommitteeSize=5)` call compared to the $4–10 outsourced coding benchmark? Does the $0.03/invocation example in docs cover the full claim lifecycle including callback?
2. Can Phala Network's TEE attestation reports be verified on Somnia's EVM at acceptable gas cost, or does the TEE attestation link need to live in a separate layer (e.g., an off-chain verifiable credential registry)?
3. How does the challenge window duration interact with Somnia's state expiry and cold-SLOAD surcharge? If a claim record is challenged 48 hours after submission, is it still in the hot cache (128M slot window) or does dispute resolution require reading a cold slot at 1M gas?

---

**See also** — [[../topics/dispute-window|dispute-window hub]] · [[../topics/corti|Corti hub]]
