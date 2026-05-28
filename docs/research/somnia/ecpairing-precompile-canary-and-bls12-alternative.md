# Somnia ecPairing Precompile: Canary Test Methodology and BLS12-381 Alternative Analysis

## 2026-05-15 — Does Somnia mainnet's `ecPairing` precompile (address `0x08`, EIP-197) execute correctly — and what canary test should be added to the pre-deployment runbook, and is BLS12-381 (EIP-2537) cheaper for Groth16 CV range proof verification?

### Finding 1: ecPairing (0x08) and BLS12-381 precompiles are listed in Somnia's official gas table — implying they are supported

- Somnia's official developer documentation ("Somnia Gas Differences To Ethereum") lists **all** standard EVM precompiles with explicit gas multipliers vs Ethereum. ecPairing (0x08) is listed at **250× Ethereum's calculated gas**, confirming Somnia's implementation recognises it. The table also includes `point_evaluation (0x0a)` (EIP-4844, Cancun) at 50× and the full BLS12-381 suite (0x0b–0x11, EIP-2537, Prague/Pectra) at 50–330×.
  — [Somnia Gas Differences To Ethereum | Somnia Docs](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)

- The presence of precompiles from three distinct hardfork generations (London: 0x01–0x09, Cancun: 0x0a, Prague/Pectra: 0x0b–0x11) in the gas table contradicts the earlier research finding that Somnia targets Paris EVM for opcode compilation. The resolution: Somnia's **AOT EVM compiler** targets Paris-level opcodes (PUSH0 absent, TLOAD/TSTORE absent) because third-party precompiles "use the same code as Ethereum" and are independent of the EVM compiler's hardfork target. Precompile implementations are compiled natively; EVM opcodes are AOT-compiled to x86. These two concerns are decoupled.
  — [Accelerated Sequential Execution | Somnia Codex](https://codex.somnia.network/somnia-blockchain/accelerated-sequential-execution)

### Finding 2: ecPairing gas cost on Somnia in absolute USD terms is acceptable despite the 250× multiplier

- The Ethereum gas formula for BN254 ecPairing (EIP-197) is: `34,000 × k + 45,000` where k = number of (G1, G2) pairs. A standard Groth16 verifier for a CV range proof (3–5 public inputs) uses k = 4 pairing pairs: `34,000 × 4 + 45,000 = 181,000 gas` on Ethereum.
  — [Groth16 Verification Gas Cost | NEBRA Docs](https://hackmd.io/@nebra-one/ByoMB8Zf6)

- On Somnia at 250×: `181,000 × 250 = 45,250,000 gas` for the pairing component. Plus MSM (ecMul at 10× Ethereum, ~20,000 Ethereum gas → ~200,000 Somnia gas). Total Groth16 verification on Somnia: **~45.5M gas per proof**.

- At Somnia's base gas price of `$0.00000000616/gas` (base, 0 TPS) and minimum of `$0.000000000616/gas` (400 TPS), the per-proof USD cost is:
  - Base rate: `45,500,000 × $0.00000000616 = **~$0.00028**`
  - 400 TPS rate: `45,500,000 × $0.000000000616 = **~$0.000028**`
  — [Gas Fees | Concepts — Somnia Docs](https://docs.somnia.network/concepts/tokenomics/gas-fees)

- **Conclusion: Even at 250× Ethereum, Groth16 verification on Somnia costs <$0.001 per proof in USD terms.** The 250× multiplier matters primarily relative to *other* Somnia operations (e.g., a standard claim state transition costs ~$0.0023), not in absolute cost to the operator.

### Finding 3: BLS12-381 (EIP-2537) is likely 4–5× cheaper than BN254 for Groth16 verification on Somnia, but carries significant tooling risk

- Somnia's gas table sets `BLS12_PAIRING_CHECK (0x0f)` at **50× Ethereum**. EIP-2537 defines the pairing check cost formula as `43,000 × k + 65,000` (where k = number of G1/G2 pairs). For a Groth16 verifier with k = 4: `43,000 × 4 + 65,000 = 237,000 gas` on Ethereum. On Somnia at 50×: `237,000 × 50 = **11,850,000 gas**`.
  — [EIP-2537: Precompile for BLS12-381 curve operations](https://eips.ethereum.org/EIPS/eip-2537)

- Comparison: BN254 Groth16 on Somnia ≈ 45.5M gas; BLS12-381 Groth16 on Somnia ≈ 11.85M gas. BLS12-381 is **~3.8× cheaper** for the pairing component on Somnia's mainnet pricing.

- However, BLS12-381 Groth16 tooling carries significant risk:
  - snarkjs generates BN254 verifiers by default; BLS12-381 requires the gnark or Arkworks toolchain.
  - BLS12-381 offers 128-bit security vs BN254's 80-bit; the security upgrade is irrelevant for a CV range proof (the adversary gains nothing from a forged CV proof beyond passing a batch suppression check that they control as the hospital).
  - EIP-2537 was only included in Ethereum's Pectra hardfork (April 2025); tooling maturity is months ahead of BN254 tooling which has years of Groth16 production use.
  — [Will BLS12-381 precompiles change everything? | distributed-lab](https://medium.com/distributed-lab/will-bls12-381-precompiles-change-everything-74336c751a9f)

- **Design recommendation: Use BN254 (snarkjs/circom) for the CV range proof MVP.** The ~$0.00028 per-proof absolute cost is well within the $0.054–0.095 per-claim cost budget. Migrate to BLS12-381 only if gas costs become a real constraint (requires BLS12-381 precompile confirmed functional on Somnia mainnet via canary test).

### Finding 4: Canary test methodology for ecPairing precompile correctness on Somnia mainnet

- EIP-197 specifies that an **empty input** to address `0x08` must return `0x0000...0001` (the identity result, representing e(∅) = 1). This is the minimal correctness test requiring zero G1/G2 point knowledge.
  — [EIP-197: Precompiled contracts for optimal ate pairing check on the elliptic curve alt_bn128](https://eips.ethereum.org/EIPS/eip-197)

- A canary contract with the following interface should be added to `test/canary/CanaryECPairing.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// evmVersion: paris

contract CanaryECPairing {
    /// @notice Test 1: Empty input → must return 1 (EIP-197 identity)
    function testEmptyInput() external view returns (bool success, bytes32 result) {
        (success,) = address(8).staticcall("");
        // On correct implementation: success=true, return data is 0x...01
    }

    /// @notice Test 2: Known valid G1/G2 pairing — generator points
    /// Input: (P1, Q1) where P1=G1 generator, Q1=G2 generator
    /// e(G1, G2) ≠ 1, but e(G1, G2) * e(-G1, G2) == 1 (negation check)
    function testGeneratorNegation() external view returns (bool success, uint256 result) {
        // 192 bytes: (G1_x, G1_y, G2_x_i, G2_x_r, G2_y_i, G2_y_r,
        //             neg_G1_x, neg_G1_y, G2_x_i, G2_x_r, G2_y_i, G2_y_r)
        // Well-known BN254 generator coordinates — known safe public inputs
        bytes memory input = abi.encodePacked(
            // G1 generator
            uint256(1),
            uint256(2),
            // G2 generator (x component, imaginary then real)
            uint256(0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2),
            uint256(0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed),
            // G2 generator (y component)
            uint256(0x090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b),
            uint256(0x12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa),
            // -G1 (negation: same x, y = field_prime - 2)
            uint256(1),
            uint256(0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd45),
            // G2 generator again
            uint256(0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2),
            uint256(0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed),
            uint256(0x090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b),
            uint256(0x12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa)
        );
        (success, bytes memory out) = address(8).staticcall(input);
        if (success && out.length == 32) {
            result = uint256(bytes32(out));
            // Must be 1 (valid negation pairing check)
        }
    }
}
```

- **Deployment runbook addition:** After the existing Paris opcode canary tests (PUSH0, TSTORE, immutable), add:
  1. Deploy `CanaryECPairing` with `evmVersion: paris`
  2. Call `testEmptyInput()` — assert `success == true` and return data ends in `0x01`
  3. Call `testGeneratorNegation()` — assert `success == true` and `result == 1`
  4. If either call reverts or returns wrong result: **DO NOT deploy `ClaimsAdjudicator`** — the ZK proof path is broken; escalate to Somnia team via `developers@somnia.foundation`

- **The canary tests are currently unconfirmed on Somnia mainnet.** No developer forum post, GitHub issue, or third-party report was found confirming ecPairing correctness on Somnia mainnet as of May 2026. The gas table implies it is implemented, but absence of any verification report is a gap.

### Finding 5: The Paris–precompile contradiction is resolved — precompile support is hardfork-independent on Somnia

- Ethereum couples precompile availability with hardfork level (BLS12-381 requires Pectra+, point evaluation requires Cancun+). **Somnia decouples these**: the gas table includes all three generations of precompiles in its current documentation, implemented via third-party libraries independent of the AOT EVM compiler's hardfork target. This means:
  - `ecPairing (0x08)` — available (supported since Byzantium, carried forward to Paris)
  - `point_evaluation (0x0a)` — listed but Cancun-era; availability on Somnia Paris-EVM is **unconfirmed by testing**
  - BLS12-381 (0x0b–0x11) — listed but Prague/Pectra-era; availability unconfirmed by testing
  — [Somnia Gas Differences To Ethereum | Somnia Docs](https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum)

- For cliqueue's CV range proof: Only `ecPairing (0x08)` is needed for the BN254 Groth16 path. This precompile is present in all Ethereum forks from Byzantium (2017) onward, making it the safest assumption on a Paris-level chain.

**Design implication:** The CV range proof via self-hosted BN254 Groth16 verifier is architecturally sound: ecPairing costs ~$0.00028/proof in USD at base gas rate — well within per-claim budget. The canary test must be added to the deployment runbook as a **blocking gate** before ClaimsAdjudicator deployment, since no external confirmation of ecPairing correctness on Somnia mainnet exists. BLS12-381 as an alternative is cheaper (3.8×) but tooling-immature and requires its own canary test of the BLS12_PAIRING_CHECK precompile.

**Open questions generated:**
1. Has any developer publicly confirmed ecPairing (0x08) executing correctly on Somnia mainnet — is there a block explorer tx, GitHub issue, or Discord report of a successful staticcall to address(8) on chain ID 5031? — Priority: high
2. Does Somnia's point_evaluation (0x0a) precompile execute correctly at the listed 50× multiplier, or is it listed in the gas table as a future-state item? Testing required before any EIP-4844-adjacent cryptographic primitives are used. — Priority: medium
3. Given that BLS12-381 is 3.8× cheaper on Somnia for pairings, should the post-MVP ZK path use a gnark-compiled BLS12-381 Groth16 verifier rather than circom/snarkjs BN254, contingent on BLS12_PAIRING_CHECK canary test passing? — Priority: medium

---

**See also** — [[../topics/somnia-substrate|Somnia substrate hub]]
