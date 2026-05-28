# TransparentUpgradeableProxy v5 + ProxyAdmin + TimelockController — Deployment Pattern

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-15 — Should cliqueue use OZ `TransparentUpgradeableProxy` (which auto-deploys a `ProxyAdmin`) or a custom ProxyAdmin contract with the `TimelockController` as its owner — and does the auto-deployed ProxyAdmin pattern work with Hardhat/Foundry deploy scripts on Somnia?

**Context:** Prior research ([[timelock-uups-proxy-upgrade-path]]) concluded that `ClaimsAdjudicator` should use a **transparent proxy + OZ `TimelockController`** (with `MIN_DELAY_FLOOR = 48h` override on `updateDelay()`), rejecting UUPS due to its unrecoverable deadlock risk (OZ Issue #6362). That finding left open: (1) whether the OZ v5 auto-deployed `ProxyAdmin` can be connected to a `TimelockController`, (2) what the deployment sequence looks like, and (3) whether Hardhat/Foundry scripts support this on Somnia.

---

### Finding 1: OZ v5 `TransparentUpgradeableProxy` auto-deploys a `ProxyAdmin` via `initialOwner` — `TimelockController` IS a supported owner

- In OZ Contracts v5.0+, the `TransparentUpgradeableProxy` constructor is `constructor(address _logic, address initialOwner, bytes memory _data)`. It creates a new `ProxyAdmin` internally via `_admin = address(new ProxyAdmin(initialOwner))`. The `initialOwner` is passed directly to the `ProxyAdmin` constructor, which sets `initialOwner` as the `Ownable` owner of the `ProxyAdmin`.
  — [OZ TransparentUpgradeableProxy.sol (master)](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/transparent/TransparentUpgradeableProxy.sol)
- **Passing the `TimelockController` address as `initialOwner` is explicitly supported** — the `ProxyAdmin` is an `Ownable` contract; there is no restriction on its owner being a contract. The `TimelockController` then controls upgrades by calling `ProxyAdmin.upgradeAndCall()` after the timelock delay.
  — [OZ Upgrades Plugins API docs: `initialOwner`](https://docs.openzeppelin.com/upgrades-plugins/api-hardhat-upgrades)
- **Alternative two-step deployment:** Deploy the proxy with a deployer EOA as `initialOwner`, then call `ProxyAdmin.transferOwnership(address(timelockController))` post-deployment. This is the standard pattern where `TimelockController` is deployed first (before the proxy), or in cases where the `TimelockController` address is not known at proxy deploy time. Both one-step (`initialOwner = timelock`) and two-step (`transferOwnership` post-deploy) are valid and well-precedented.
  — [OZ Forum: Transparent proxy upgrade with timelock](https://forum.openzeppelin.com/t/transparent-proxy-upgrade-with-timelock/42743)

### Finding 2: OZ v5 introduced a breaking change — `ProxyAdmin` is stored in a private `_admin` immutable variable; its address is only readable via ERC-1967 storage slot or `AdminChanged` event

- In OZ v4.x, `ProxyAdmin` was a standalone contract that could be pre-deployed and passed to the proxy. In OZ v5.0+, the `ProxyAdmin` is deployed inside the `TransparentUpgradeableProxy` constructor and its address is stored in the private `_admin` immutable — there is no external getter function for the proxy admin address.
  — [OZ Forum: How to easily get the ProxyAdmin address of TransparentUpgradeableProxy v5](https://forum.openzeppelin.com/t/how-to-easily-get-the-proxyadmin-address-of-the-transparentupgradeableproxy-v5/38214)
- To obtain the `ProxyAdmin` address post-deployment: read the ERC-1967 admin storage slot (`0xb53127684a568b3173ae13b9f8a6016e243e63b6...`) directly, or listen for the `AdminChanged(address previousAdmin, address newAdmin)` event emitted at proxy construction (where `newAdmin` is the auto-deployed `ProxyAdmin` address).
  — [ERC-1967 spec](https://eips.ethereum.org/EIPS/eip-1967)
- **This means cliqueue cannot pre-deploy a custom `ProxyAdmin`** and pass it to the v5 `TransparentUpgradeableProxy`. The `ProxyAdmin` is always auto-generated. The correct approach is to accept the auto-generated `ProxyAdmin` and transfer its ownership to the `TimelockController` (either at deploy time via `initialOwner`, or post-deploy via `transferOwnership`).

### Finding 3: Hardhat upgrades plugin supports `initialOwner` option for transparent proxies — passing `TimelockController` is the standard governance pattern

- The `@openzeppelin/hardhat-upgrades` plugin's `upgrades.deployProxy()` function accepts an `opts` object with an `initialOwner` field: `await upgrades.deployProxy(ClaimsAdjudicator, [args], { kind: 'transparent', initialOwner: timelockController.address })`. This sets the `TimelockController` as the owner of the auto-deployed `ProxyAdmin` in a single transaction.
  — [OZ Hardhat Upgrades API docs](https://docs.openzeppelin.com/upgrades-plugins/api-hardhat-upgrades)
- The Hardhat plugin tracks deployed implementation addresses in `.openzeppelin/<network>.json`, enabling `upgrades.upgradeProxy()` to validate storage layout safety before upgrading. This `.openzeppelin/` tracking file is compatible with any EVM chain, including Somnia — it does not rely on chain-specific infrastructure.
  — [OZ Upgrades Plugins documentation](https://docs.openzeppelin.com/upgrades-plugins)

### Finding 4: Foundry upgrades plugin requires `initialOwner` at deploy time — no `transferOwnership` helper; but standard `Ownable.transferOwnership` works

- The `@openzeppelin/foundry-upgrades` plugin exposes `deployTransparentProxy(string contractName, address initialOwner, bytes initializerData)`. Passing the `TimelockController` address as `initialOwner` sets it as the `ProxyAdmin` owner at deployment. There is no Foundry plugin helper for post-deploy `transferOwnership`, but the deployer can call `proxyAdmin.transferOwnership(timelockController)` directly via Foundry's `vm.broadcast()` after obtaining the `ProxyAdmin` address from the `AdminChanged` event log.
  — [RareSkills: Smart Contract Foundry Upgrades with the OpenZeppelin Plugin](https://rareskills.io/post/openzeppelin-foundry-upgrades)
- **Key Foundry difference:** Foundry does not auto-track implementations — it requires `@custom:oz-upgrades-from ContractV1` NatSpec annotation in the new implementation for storage layout validation. This is a deployment script discipline requirement, not a protocol constraint.
  — [OZ Upgrades Plugins documentation](https://docs.openzeppelin.com/upgrades-plugins)

### Finding 5: Known OZ v5 limitation — integrating `TimelockController` as `ProxyAdmin` owner is harder in v5 than v4.x; the recommended workaround is `initialOwner` parameter

- Multiple OZ forum threads and GitHub issues document the friction introduced by the v5 auto-deployment of `ProxyAdmin`. The mETH protocol used `TimelockController` as `ProxyAdmin` directly (without a separate `ProxyAdmin` contract) — this was possible in OZ v4.x but is no longer possible in v5 because the `ProxyAdmin` is always auto-deployed.
  — [OZ Forum: Version 5 ProxyAdmin discussion](https://forum.openzeppelin.com/t/version-5-how-can-should-the-proxyadmin-of-the-transparentupgradableproxy-be-used/38127)
- The OZ team's official v5 recommendation is: "the dedicated account [ProxyAdmin owner] should be an instance of the ProxyAdmin contract" — meaning the `TimelockController` owns the `ProxyAdmin`, which owns the proxy. The three-layer ownership chain (TimelockController → ProxyAdmin → TransparentUpgradeableProxy → ClaimsAdjudicator implementation) is the canonical v5 governance architecture.
  — [OZ Contracts v5.0.0 release notes](https://github.com/OpenZeppelin/openzeppelin-contracts/releases/tag/v5.0.0)

### Finding 6: Somnia EVM hardfork level is undocumented — Hardhat config example uses Solidity 0.8.28; `evmVersion` is unspecified

- Somnia's official developer documentation uses `solidity: "0.8.28"` in Hardhat config examples but does **not specify** an `evmVersion` setting. The developer FAQs state Somnia is "fully EVM-compatible" with "all Solidity features work identically" and "same gas mechanics and opcodes" — but no specific hardfork level (Istanbul / London / Paris / Shanghai / Cancun) is published in the docs.
  — [Somnia Deploy with Hardhat docs](https://docs.somnia.network/developer/development-frameworks/deploy-with-hardhat), [Somnia Developer FAQs](https://docs.somnia.network/developer/deployment-and-production/support-and-community/developer-faqs)
- Solidity 0.8.28 defaults to compiling for the `cancun` EVM version when no `evmVersion` is specified. Cancun-specific opcodes include `PUSH0` (from Shanghai, already in 0.8.20+), `TLOAD`/`TSTORE` (transient storage), `MCOPY`, and `BLOBHASH`/`BLOBBASEFEE`. Whether Somnia's AOT compiler supports all Cancun opcodes is **unconfirmed**.
  — [Solidity 0.8.28 docs](https://docs.soliditylang.org/en/v0.8.28/using-the-compiler.html), [EIP-1153: TLOAD/TSTORE](https://eips.ethereum.org/EIPS/eip-1153)
- **Practical risk:** If cliqueue compiles `ClaimsAdjudicator` with `evmVersion: "cancun"` (the Solidity 0.8.28 default) and Somnia does not support `PUSH0` or `TLOAD`/`TSTORE`, deployment will fail with an "invalid opcode" error at runtime. OZ v5 `TimelockController` does not itself use transient storage, but `ReentrancyGuardTransient` (OZ v5 feature) does — cliqueue must not use `ReentrancyGuardTransient` until Somnia's Cancun support is confirmed.
  — [OZ GitHub Issue #4205: ReentrancyGuard with TSTORE/TLOAD](https://github.com/OpenZeppelin/openzeppelin-contracts/issues/4205)

### Recommended Deployment Sequence for `ClaimsAdjudicator` on Somnia

```
Step 1: Deploy TimelockController
  - minDelay = 172800 (48h)
  - proposers = [multisig3of5]
  - executors = [multisig2of3]
  - admin = address(0) (renounced after setup)

Step 2: Deploy TransparentUpgradeableProxy
  - via Hardhat: upgrades.deployProxy(ClaimsAdjudicator, [initArgs],
      { kind: 'transparent', initialOwner: timelockController.address })
  - This auto-deploys ProxyAdmin with TimelockController as owner.
  - Emit AdminChanged event → capture ProxyAdmin address from logs.

Step 3: Verify ownership chain
  - ProxyAdmin.owner() == address(timelockController) ✓
  - Read ERC-1967 admin slot of proxy == address(proxyAdmin) ✓

Step 4: Canary test before production (Somnia EVM validation)
  - Deploy a canary contract exercising: immutable variables,
    block.basefee, keccak256 in constructor, ERC-7201 namespaced
    storage slots (NOT TLOAD/TSTORE until Somnia Cancun confirmed).
  - Compile with evmVersion: "paris" as safe default until Somnia
    documents Cancun support. Paris is post-PUSH0, pre-TLOAD.

Step 5: Hardhat .openzeppelin/ tracking file
  - Commit .openzeppelin/somnia-mainnet.json to repo (not gitignored)
    to preserve implementation address history for future upgrade
    storage layout validation.
```

---

**Design implication:** The OZ v5 `TransparentUpgradeableProxy` auto-deployed `ProxyAdmin` pattern works correctly with `TimelockController` as owner — pass the `TimelockController` address as `initialOwner` via Hardhat's `upgrades.deployProxy()` option. The three-layer chain (TimelockController → ProxyAdmin → proxy → implementation) is the canonical v5 governance architecture used by major DeFi protocols. Foundry requires extracting the `ProxyAdmin` address from the `AdminChanged` event log after deploy. Compile with `evmVersion: "paris"` as the safe default for Somnia until the Somnia team explicitly confirms Cancun opcode support — using Solidity 0.8.28's default `cancun` target risks deployment failure on Somnia if `TLOAD`/`TSTORE` opcodes are unsupported.

**Open questions generated:**
1. Does Somnia's AOT EVM compilation support Cancun-level opcodes (`TLOAD`, `TSTORE`, `MCOPY`) — and should cliqueue publish a canary contract test result (pass/fail per opcode) in the deployment runbook before any production deployment? — priority: high
2. Should the `.openzeppelin/somnia-mainnet.json` tracking file be committed to the cliqueue repo (to preserve upgrade history) or stored externally (e.g., in a separate deployment artifact repo) — and does exposing implementation addresses in a public repo create any security risk for the on-chain contracts? — priority: low
3. Should cliqueue's deployment runbook include a step for the hospital's legal/audit team to independently verify the `TimelockController` address registered as `ProxyAdmin.owner()` via the Somnia block explorer before the first claim submission, so the governance chain is hospital-auditable without cliqueue cooperation? — priority: medium

---

**See also** — [[../topics/upgradeable-proxy|upgradeable-proxy hub]]
