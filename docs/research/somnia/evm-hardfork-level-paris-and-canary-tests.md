# Somnia EVM Hardfork Level: Paris Confirmed — Canary Contract Tests for Deployment Runbook

## 2026-05-15 — Does Somnia's AOT EVM compilation support Cancun-level opcodes (TLOAD, TSTORE, MCOPY), and what canary contract tests should the deployment runbook require before production deployment of `ClaimsAdjudicator`?

### Finding 1: Somnia officially targets the Paris EVM — primary source confirmed

- Somnia's official developer documentation (`verifying-via-explorer`) explicitly specifies `"evm_version": "paris"` with `compiler_version: "v0.8.24+commit.e11b9ed9"` in the canonical contract verification payload for Somnia mainnet. This is the only first-party statement of an EVM hardfork level in Somnia's published documentation; the general FAQs state only "fully EVM-compatible" without specifying a fork level.
  — [Verifying via Explorer | Somnia Docs](https://docs.somnia.network/developer/development-frameworks/verifying-via-explorer)

- No Somnia documentation page, developer FAQ, or technical whitepaper specifies Cancun, Shanghai, or any post-Paris EVM level as supported. The llms-full.txt export (the complete documentation corpus) contains zero references to "cancun," "shanghai," "TLOAD," "TSTORE," "MCOPY," "PUSH0," or "evmVersion" as a configuration parameter. The hardfork gap is undocumented — not confirmed Cancun, not confirmed Paris explicitly in narrative — but the verification example is the strongest available signal.
  — [Somnia Docs full corpus](https://docs.somnia.network/llms-full.txt); [Developer FAQs](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs)

### Finding 2: Paris EVM does NOT include the Cancun opcodes — the gap is significant

- The Ethereum **Paris** hardfork (September 2022, The Merge) introduced only two EVM changes: EIP-3675 (PoS consensus transition) and EIP-4399 (`DIFFICULTY` → `PREVRANDAO`). It added no new execution-layer opcodes beyond what London already provided.
  — [EIP-3675](https://eips.ethereum.org/EIPS/eip-3675); [EIP-4399](https://eips.ethereum.org/EIPS/eip-4399); [EIPs in Ethereum Hardforks, Medium 2024](https://medium.com/@Yao_Xiang/eips-included-in-ethereum-hardforks-in-past-7-years-6ed8b73322ef)

- The following opcodes are **NOT available** on a Paris-level EVM and will cause contracts to revert or fail to deploy if emitted:
  - **PUSH0** (EIP-3855, Shanghai) — emitted by Solidity ≥0.8.20 when `evmVersion=shanghai` (the compiler default since 0.8.20). If cliqueue compiles with Solidity 0.8.20+ and does not explicitly set `evmVersion: "paris"`, the compiler will emit PUSH0 and deployed bytecode will fail on Somnia.
  - **TSTORE / TLOAD** (EIP-1153, Cancun) — transient storage opcodes. OpenZeppelin's `ReentrancyGuardTransient` uses these; it must not be used on Somnia at Paris level.
  - **MCOPY** (EIP-5656, Cancun) — memory copy instruction. Not emitted by high-level Solidity but may appear in optimized Yul/assembly.
  - **BLOBHASH / BLOBBASEFEE** (EIP-4844 / EIP-7516, Cancun) — blob-related opcodes. Not relevant for cliqueue but confirmed absent.
  — [EIP-1153](https://eips.ethereum.org/EIPS/eip-1153); [EIP-3855](https://eips.ethereum.org/EIPS/eip-3855); [EIP-5656](https://eips.ethereum.org/EIPS/eip-5656); [Foundry issue #6943 on PUSH0 and paris](https://github.com/foundry-rs/foundry/issues/6943)

- The following ARE available on Paris (carried forward from London): `block.basefee` (EIP-3198), `block.prevrandao` (EIP-4399), standard storage opcodes (SLOAD/SSTORE/MLOAD/MSTORE), all pre-London opcodes including CREATE2, CHAINID, SELFBALANCE.
  — [Solidity 0.8.21 compiler docs — evmVersion table](https://docs.soliditylang.org/en/v0.8.21/using-the-compiler.html)

### Finding 3: ERC-7201 namespaced storage and `immutable` variables are Paris-safe

- **ERC-7201 namespaced storage** (used by OZ 5.x upgradeable contracts including `TransparentUpgradeableProxy`) is a Solidity slot-computation pattern — `keccak256(id) - 1` — not an opcode. It is fully compatible with Paris EVM. OZ deliberately set its release target to `evmVersion: paris` to maintain cross-chain compatibility; OZ 5.x `TransparentUpgradeableProxy` and all upgradeable contracts using ERC-7201 are Paris-safe.
  — [OZ GitHub Issue #4503 — Set EVM to Paris for release](https://github.com/OpenZeppelin/openzeppelin-contracts/issues/4503); [Introducing OZ Contracts 5.0](https://blog.openzeppelin.com/introducing-openzeppelin-contracts-5.0); [ERC-7201 Namespaced Storage Layout](https://eips.ethereum.org/EIPS/eip-7201)

- **`immutable` variables** are a Solidity compiler optimization (value baked into bytecode at deploy time); they do not use any specific opcode unavailable in Paris. They are fully Paris-compatible.

- **`block.basefee`** is Paris-safe (introduced in London, EIP-3198). The `ClaimsAdjudicator` can read it for gas-price awareness without issue.

### Finding 4: The PUSH0 footgun is the immediate deployment risk

- Solidity's default `evmVersion` changed from `london` to `shanghai` in Solidity 0.8.20 (released July 2023). Any project that pins `pragma solidity ^0.8.20` or higher and does NOT explicitly override `evmVersion` in its Hardhat or Foundry config will emit PUSH0 bytecode. On Somnia mainnet (Paris-level), this produces an **invalid opcode** at runtime, causing all function calls to revert.
  — [Hardhat issue #4232 — Set default evmVersion to paris](https://github.com/NomicFoundation/hardhat/issues/4232); [OZ Forum — PUSH0 invalid opcode on BSC testnet](https://forum.openzeppelin.com/t/remix-ide-bsc-testnet-error-invalid-opcode-push0-or-evm-version-used-by-the-selected-environment-is-not-compatible-with-the-compiler-evm-version/38458)

- Foundry defaults `evm_version` to `paris` (correct for Somnia). Hardhat defaults to `london` or `paris` depending on version. Both must be explicitly configured to prevent accidental PUSH0 emission when Solidity ≥0.8.20 is used.

### Finding 5: Canary contract test suite for the deployment runbook

Based on the above, the following canary test suite is recommended for `cliqueue`'s deployment runbook. Each canary is a minimal contract deployed and called before `ClaimsAdjudicator` deployment:

| Canary | What it tests | Expected result on Paris-level Somnia | Failure action |
|---|---|---|---|
| **PUSH0 canary** | Deploy a contract compiled with Solidity 0.8.20+ and `evmVersion=shanghai`; call any function | REVERT (invalid opcode) — confirms Somnia is NOT Cancun/Shanghai | Block deployment; fix compiler config |
| **Paris baseline canary** | Deploy with `evmVersion=paris`; call `block.basefee` and `block.prevrandao` | SUCCESS — confirms Paris opcodes work | Proceed |
| **TSTORE canary** | Inline assembly calling TSTORE(0, 1) then TLOAD(0) | REVERT on Paris — confirms Cancun opcodes absent | Do not use `ReentrancyGuardTransient` |
| **Immutable canary** | Contract with `address immutable ADDR = address(this)` | SUCCESS on Paris — immutables are not opcode-dependent | Proceed |
| **ERC-7201 storage canary** | OZ-style `_getStorage()` using `assembly { $.slot := STORAGE_LOCATION }` | SUCCESS on Paris — slot-based, no special opcode | Proceed |
| **CREATE2 canary** | Factory deploying child contract via CREATE2 | SUCCESS — available since Constantinople | Proceed |

The canary contracts should be published in the repo at `test/canary/` and the deployment runbook should require all canaries to be run via `forge script` against Somnia mainnet before any production contract deployment.

**Design implication:** cliqueue must set `evmVersion: "paris"` (Hardhat) and `evm_version = "paris"` (Foundry) explicitly in all project config files. OZ 5.x `TransparentUpgradeableProxy` + `TimelockController` are Paris-compatible. `ReentrancyGuardTransient` is prohibited. The deployment runbook must include the canary suite as a blocking pre-deployment gate.

**Open questions generated:**
1. Has Somnia published or committed to a timeline for upgrading to Shanghai or Cancun EVM level — and should cliqueue's contract architecture plan for a `PUSH0`-enabling upgrade that could break Paris-compiled bytecode already deployed? (Priority: medium)
2. Does Somnia's AOT EVM-to-x86 compilation layer handle the `PREVRANDAO` opcode correctly — i.e., is `block.prevrandao` usable as a weak randomness source for non-critical on-chain decisions (e.g., tie-breaking in subcommittee selection), or does AOT compilation introduce an opcode-mapping gap? (Priority: low)
3. Should cliqueue include a post-deployment smoke test that calls every public function of `ClaimsAdjudicator` from a Somnia mainnet fork before directing hospital systems to the live contract address — and should this be automated in the CI pipeline? (Priority: high)

---

**See also** — [[../topics/somnia-substrate|Somnia substrate hub]] · [[../topics/upgradeable-proxy|upgradeable-proxy hub]]
