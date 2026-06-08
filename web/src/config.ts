/**
 * Web-layer configuration constants sourced from Vite env vars.
 *
 * Keep this file dependency-free (no React imports) so it can be consumed
 * by hooks, components, and tests alike.
 */

/**
 * The agent fee reserve required for the next-step `requestAdjudication`
 * (SPEC-0003 §2.6 R31; SPEC-0005 R19). This is the wallet's affordability
 * pre-check; it MUST equal the value `client.ts` actually forwards on the
 * `requestAdjudication` call (its `agentFeeValue`, see client.ts). Both read
 * `VITE_AGENT_FEE_WEI`, so their DEFAULT fallbacks must not drift either — an
 * undercount here lets an unaffordable adjudication slip past the pre-check and
 * revert on-chain.
 *
 * Default 0.70 STT covers the two-agent flow (Amendment 0007): each agent call
 * funds a platform deposit + validator reward, so the request needs 2×deposit.
 */
export const AGENT_FEE_RESERVE_WEI: bigint = BigInt(
  import.meta.env.VITE_AGENT_FEE_WEI ?? "700000000000000000",
);

/**
 * Headroom kept aside for transaction gas when validating that a wallet can
 * afford a value-bearing call (e.g. the insurer's escrow at `insurerEngage`).
 * Somnia testnet gas is cheap (a few mSTT per call); 0.02 STT is generous
 * headroom so the balance check never lets a tx fail for gas after passing.
 */
export const GAS_RESERVE_WEI: bigint = BigInt(
  import.meta.env.VITE_GAS_RESERVE_WEI ?? "20000000000000000",
);
