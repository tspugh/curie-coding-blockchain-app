# TEE Attestation On-Chain Verification: Phala + Somnia

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-14 — Can Phala Network TEE attestation reports be verified on Somnia's EVM at acceptable gas cost, or does the TEE attestation link need to live in a separate off-chain verifiable-credential registry?

### Finding 1: Naive on-chain DCAP verification is prohibitively expensive on any EVM — especially Somnia

- Direct Intel SGX/TDX DCAP quote verification on-chain requires parsing ~20 KB of X.509 certificate chain JSON and P256 signature checks. Naive full-chain on-chain execution costs **3–8 million gas** on standard Ethereum (depending on whether RIP-7212 P256 precompile is available).
  — [Automata DCAP attestation GitHub](https://github.com/automata-network/automata-dcap-attestation); [Flashbots: Demystifying remote attestation on-chain](https://collective.flashbots.net/t/demystifying-remote-attestation-by-taking-it-on-chain/2629)
- On Somnia, this is compounded by the **ecPairing 250× multiplier** and the **ecAdd 50× multiplier**. A 3–8M gas Ethereum operation scales to roughly **150–400M effective-gas-equivalent** on Somnia. This is economically prohibitive and likely approaches or exceeds Somnia's per-transaction gas limits.
  — [Somnia Gas Differences to Ethereum](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)

### Finding 2: SNARK-compressed DCAP verification costs ~250–500k gas on Ethereum — but ecPairing still kills it on Somnia

- Two mature projects offer SNARK-compressed on-chain DCAP verification:
  - **Phala zkDCAP** (via RiscZero zkVM): Executes DCAP verification off-chain in a zkVM, generates a Groth16 SNARK proof, submits the ~250k gas Groth16 verifier call on-chain. [Phala: Verifying TEE on-chain with RiscZero](https://phala.com/posts/verifying_tee_onchain_with_risczero_zkvm)
  - **Automata DCAP attestation** (audited by Trail of Bits, March 2025): Supports SP1 Groth16 (~493k gas) or SP1 Plonk (~569k gas) on-chain verification paths, plus RiscZero. [Automata DCAP GitHub](https://github.com/automata-network/automata-dcap-attestation); [datachainlab zkdcap](https://github.com/datachainlab/zkdcap)
- **Critical constraint**: Groth16 verification requires multiple **ecPairing** operations. On Ethereum, Groth16 with ℓ public inputs costs ~(181 + 6ℓ)k gas. On Somnia, the 250× ecPairing multiplier makes a standard Groth16 verifier cost **~45–150M gas-equivalent** — still economically infeasible for per-claim use.
  — [Groth16 gas cost analysis, HackMD](https://hackmd.io/@nebra-one/ByoMB8Zf6); [Somnia Gas Differences](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)

### Finding 3: zkVerify — a dedicated ZKP verification L1 — is the lowest-cost path and supports multi-chain attestation posting

- **zkVerify** (Horizen Labs, mainnet launched October 2025) is a dedicated L1 blockchain for ZK proof verification that accepts native Risc Zero STARK proofs (no additional Groth16 wrapping required) and publishes Merkle-root attestations to EVM chains.
  — [zkVerify docs](https://docs.zkverify.io/); [zkVerify TEE proof guide](https://docs.zkverify.io/overview/explorations/tee-proof)
- Current confirmed EVM destination chains: Ethereum mainnet, Base, Arbitrum, Optimism, Sepolia (testnet). **Somnia is not listed** as a supported destination. However, zkVerify's attestation posting is generic — any EVM chain that deploys the zkVerify `IZkVerify` receiver contract can receive attestations. Somnia is EVM-compatible and could receive zkVerify attestations once the receiver contract is deployed.
  — [zkVerify docs: what is zkVerify](https://docs.zkverify.io/)
- The on-chain cost on the destination EVM chain is a **Merkle proof inclusion check** (~50–80k gas on Ethereum), not a pairing operation. This is the only operation that hits the destination chain. **This avoids Somnia's ecPairing multiplier entirely.** The expensive ZK verification happens on the zkVerify L1, not on Somnia.
  — [Horizen Labs: True Cost of ZK Verification](https://medium.com/horizen-labs/how-much-does-it-cost-to-verify-a-zero-knowledge-proof-on-chain-and-what-does-it-mean-exactly-2cefd68cf204); [zkVerify docs](https://docs.zkverify.io/)
- Phala is a confirmed zkVerify partner/user (2025 cohort), meaning the Phala → zkVerify → EVM attestation pipeline is a documented integration, not a theoretical one.
  — [zkVerify docs: partners](https://docs.zkverify.io/)

### Finding 4: Phala's KMS uses an on-chain governance contract for code-hash whitelisting — this is a lightweight ECDSA pattern

- Phala's dstack KMS architecture uses a smart contract on Ethereum (or EVM-compatible chain) that stores **whitelisted enclave code hashes** (not full attestation reports). When a TEE worker starts, it presents its attestation to the KMS; the KMS verifies the attestation off-chain and checks the code hash against the on-chain whitelist before releasing keys.
  — [Phala: TEEs Secured by Ethereum](https://phala.com/posts/TEEs-Secured-by-Ethereum); [Phala KMS docs](https://docs.phala.com/phala-cloud/key-management/key-management-protocol)
- The on-chain contract only stores the **code hash** (a bytes32 value) and performs equality checks — no pairing or signature verification on-chain. Gas cost is a standard SLOAD + comparison: **~5–10k gas** per check.
  — Derived from standard EVM SLOAD cost (2,100 gas cold, 100 warm) × Somnia multipliers (still O(10k) range)
- **This is the most gas-efficient on-chain anchor pattern**: the expensive DCAP verification is entirely off-chain (done by the Phala KMS TEE itself), and the chain simply serves as a tamper-resistant registry of approved code hashes.

### Finding 5: The ERC-8004 TEE Agent Registry standard provides a deployable on-chain pattern

- Phala's ERC-8004 reference implementation deploys two contracts: `IdentityRegistry` (agent code hashes + TDX attestation proof anchors) and `ReputationRegistry`. Currently demonstrated on Ethereum Sepolia only, but the contracts are generic EVM.
  — [Phala ERC-8004 GitHub](https://github.com/Phala-Network/erc-8004-tee-agent)
- For cliqueue, this registry pattern maps directly: each deployment of the off-chain ICD-10 coding agent (Corti Symphony MCP + HMAC signing logic) would register its enclave code hash in an `IdentityRegistry` on Somnia. The `ClaimsAdjudicator` contract would check `msg.sender` attestation identity before accepting a coding result.

### Finding 6: No confirmed Phala ↔ Somnia integration exists as of May 2026

- No published integration, bridge, or deployment of Phala's KMS or dstack attestation contracts on Somnia mainnet (chain ID 5031) was found. Phala's KMS governance contracts are deployed on Ethereum; no cross-chain KMS deployment to Somnia is documented.
  — [Phala Network overview](https://docs.phala.com/network/overview/phala-network); [Phala GitHub](https://github.com/Phala-Network)
- Phala's `dstack` framework is an open-source Linux Foundation project that can run on any cloud (AWS, GCP, Phala infrastructure). The dstack KMS can, in principle, use any EVM-compatible chain for its governance contract. Deploying the governance contract on Somnia would require a Phala community deployment (not a first-party integration).
  — [dstack GitHub](https://github.com/Dstack-TEE/dstack)

---

### Recommended Architecture for cliqueue TEE Attestation

Three viable paths in ascending gas-efficiency order on Somnia:

**Path A: Phala KMS code-hash whitelist on Somnia (recommended for MVP)**
- Deploy Phala dstack KMS governance contract on Somnia. Store approved coding-agent code hashes.
- `ClaimsAdjudicator` does a single SLOAD + equality check (~10k gas, negligible cost).
- Off-chain DCAP attestation verified by the Phala KMS TEE itself; no ZK proof on-chain.
- **Weakness**: trust is partially in Phala's KMS TEE infrastructure (still an honest-majority assumption). No independent verifier can confirm on-chain that the TEE ran — they rely on the code-hash match.

**Path B: zkVerify → Somnia Merkle attestation (recommended for post-MVP trust upgrade)**
- Generate Risc Zero STARK proof of DCAP quote off-chain (via zkVerify pipeline).
- Submit to zkVerify L1 for native STARK verification (no Groth16 wrapping needed).
- zkVerify publishes Merkle root; cliqueue deploys `IZkVerify` receiver on Somnia.
- `ClaimsAdjudicator` checks Merkle inclusion (~50–80k gas on Ethereum equivalent; Somnia multipliers apply to keccak/storage, not ecPairing — likely ~50–200k actual gas on Somnia).
- **Somnia deployment requires deploying the zkVerify receiver contract** — not currently first-party supported but technically feasible.

**Path C: Direct SNARK (Groth16/Plonk) on Somnia (not recommended)**
- ~45–150M effective-gas-equivalent on Somnia due to ecPairing 250× multiplier. Economically infeasible.

---

**Design implication:** cliqueue should use Phala KMS code-hash whitelisting (Path A) for the MVP TEE anchor — a single SLOAD on Somnia per claim (~10k gas, ~$0.00055 at current SOMI pricing). No ZK proofs on Somnia are needed for the initial trust model. For post-MVP trustless verification, cliqueue should request zkVerify deploy its receiver contract on Somnia (or deploy it via community governance), enabling Path B's Merkle attestation model without Groth16 pairings touching Somnia.

**Open questions generated:**
1. Has zkVerify deployed or does it plan to deploy its receiver contract on Somnia mainnet (chain ID 5031)? If not, can cliqueue deploy it permissionlessly, or is first-party zkVerify team involvement required?
2. Does Phala's dstack KMS support multi-chain governance contract deployment (e.g., primary on Ethereum + mirror on Somnia), or is the KMS governance chain a singleton that must be chosen at deploy time?
3. Under the proposed 2026 HIPAA Security Rule NPRM, does anchoring enclave code hashes (not PHI) on Somnia constitute a "disclosure" to the chain's validator set, or does the non-PHI nature of code hashes make it HIPAA-neutral?

---

**See also** — [[../topics/somnia-substrate|Somnia substrate hub]] · [[../topics/corti|Corti hub]] · [[../topics/settlement-stablecoin|settlement hub]] · [[../topics/dispute-window|dispute-window hub]]
