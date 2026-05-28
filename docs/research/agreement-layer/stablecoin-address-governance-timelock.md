# Settlement Token Governance — Timelock, Multisig, and Notice Period

## 2026-05-15 — What governance mechanism should control the `stablecoinAddress` parameter in `ClaimsAdjudicator`, and what minimum notice period prevents rug-pull risk?

**Context:** `ClaimsAdjudicator` holds USDC escrow and releases settlement payments to hospitals on `Settled` events. The `stablecoinAddress` parameter determines which ERC-20 token is accepted for deposits and released on settlement. A compromised or maliciously-updated `stablecoinAddress` could redirect all in-flight settlement funds to a worthless token — the classic rug-pull vector. The prior stablecoin research ([[usdc-vs-usdso-settlement-stablecoin]]) recommended storing this as a configurable parameter, but did not specify the governance mechanism.

### Findings

- **Timelock is the canonical defense against rapid parameter attacks.** OpenZeppelin documentation recommends "a typical delay of one to three days" for governance operations. The minimum defensible floor for a high-value parameter change (token address) is 48 hours. Source: [OpenZeppelin — Protect Your Users With Smart Contract Timelocks](https://www.openzeppelin.com/news/protect-your-users-with-smart-contract-timelocks)

- **Industry benchmarks for timelock delay:** Compound uses a 48-hour (2-day) minimum + 30-day maximum; MakerDAO increased its timelock from 12 to 72 hours after flash-voting vulnerabilities were exploited; Aave uses a 24-hour delay. For an enterprise B2B context where counterparties are hospitals and payers (not DeFi retail), 48–72 hours is the defensible range. The Beanstalk hack (March 2022, $182M) is the canonical cautionary example — its 24-hour timelock was unmonitored and insufficient to trigger community response. Sources: [Compound v2 Governance Docs](https://docs.compound.finance/v2/governance/), [Timelock Contracts and DeFi Security — Medium](https://medium.com/@srinivasjoshi66/timelock-contracts-and-defi-security-lessons-from-compound-fe24f3e4574b)

- **Multisig must gate timelock proposal submission.** A timelock alone is insufficient if a single key can queue proposals. The proposer role must require a threshold multisig (recommended: 3-of-5 for a network-scoped settlement contract). Role segregation is mandatory: proposer, executor, and canceller must be separate multisig wallets or actors. A single entity should never control all three roles. Sources: [Trail of Bits — Maturing Smart Contracts Beyond Private Key Risk](https://blog.trailofbits.com/2025/06/25/maturing-your-smart-contracts-beyond-private-key-risk/), [Synergetics — Strengthening Contract Security with Timelock and Multisig](https://synergetics.ai/strengthening-contract-security-with-timelock-and-multisig/)

- **Emergency pause must bypass the timelock.** The `PAUSER` role (which can freeze claim submissions and settlement releases in a breach scenario) must not be behind a timelock — it needs a low multisig threshold (2-of-3) for rapid response. This is distinct from the `stablecoinAddress` change path, which is non-emergency and should require the full 48-72 hour notice. Source: [Trail of Bits — Maturing Smart Contracts](https://blog.trailofbits.com/2025/06/25/maturing-your-smart-contracts-beyond-private-key-risk/)

- **GENIUS Act (signed July 2025) implications.** The US federal stablecoin framework requires issuers to establish "clear governance frameworks for decision-making, documentation and oversight of reserve management." While this primarily applies to stablecoin *issuers* (Circle/USDC), not settlement contract operators, cliqueue's governance policy document should reference it for enterprise legal review. The GENIUS Act does not prescribe on-chain timelock mechanisms. Implementation regulations are due July 2026. Source: [Latham & Watkins — GENIUS Act of 2025](https://www.lw.com/en/insights/the-genius-act-of-2025-stablecoin-legislation-adopted-in-the-us)

- **Monitoring is as important as delay duration.** The Trail of Bits framework states: "proper monitoring and alerting of the timelock is critical; without it, the control is worthless." cliqueue must deploy on-chain monitoring (Tenderly Alerts or equivalent) to watch for `CallScheduled` events on the TimelockController before any queued operation reaches its execution window. A 48-hour notice period is only effective if someone watches it.

- **Recommended concrete configuration for `ClaimsAdjudicator` `stablecoinAddress` governance:**
  - **Timelock minimum delay:** 48 hours (172,800 seconds) — aligns with Compound standard and provides the minimum defensible floor for enterprise contexts
  - **Proposer role:** 3-of-5 multisig (hospital consortium representatives or cliqueue + founding hospital partners)
  - **Executor role:** 2-of-3 multisig (distinct key set from proposer)
  - **Canceller role:** Single cliqueue admin key (allows emergency cancellation without multisig delay)
  - **Emergency pause:** 2-of-3 multisig, NOT behind timelock
  - **`stablecoinAddress` change emits:** `SettlementTokenChangeScheduled(address oldToken, address newToken, uint256 executeAfter)` — gives off-chain adapters and hospital legal teams 48 hours to review

**Design implication:** The `ClaimsAdjudicator` should wrap its `stablecoinAddress` setter behind an OpenZeppelin `TimelockController` with a 48-hour minimum delay and a 3-of-5 multisig proposer. An explicit `SettlementTokenPolicy` document (listing current settlement token, custodian, reserve backing, and upgrade notice period) should be published as a governance artifact and linked from `ClaimsAdjudicator`'s NatSpec. This satisfies both technical rug-pull prevention and enterprise procurement reviewers who need a paper trail.

**Open questions generated:**
- Should the `TimelockController` minimum delay be stored as a mutable parameter (updatable only through the timelock itself, per OpenZeppelin's pattern) or hard-coded as an immutable constant to prevent a future governance decision from shortening the notice period below the enterprise-safe floor?
- Should cliqueue publish a formal on-chain `SettlementTokenPolicy` document hash (EIP-712 typed data) anchored in `ClaimsAdjudicator`'s storage, linking to an off-chain governance PDF that hospital procurement teams can reference?
- At what USDC escrow balance threshold (e.g., >$10M total locked) should the multisig threshold be automatically escalated (e.g., from 3-of-5 to 4-of-7) — and can this escalation itself be governed by the timelock?

---

**See also** — [[../topics/settlement-stablecoin|settlement hub]] · [[../topics/upgradeable-proxy|upgradeable-proxy hub]]
