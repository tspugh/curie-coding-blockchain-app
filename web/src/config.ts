/**
 * Web-layer configuration constants sourced from Vite env vars.
 *
 * Keep this file dependency-free (no React imports) so it can be consumed
 * by hooks, components, and tests alike.
 */

/**
 * The agent fee reserve required for the next-step `requestAdjudication`
 * (SPEC-0003 §2.6 R31; SPEC-0005 R19). Matches the value `client.ts`
 * forwards on the actual `requestAdjudication` call (see client.ts:160).
 *
 * Default 0.33 STT = 0.03 STT platform deposit + 3 × 0.10 STT validator
 * fees per the deployed AgentPlatform.
 */
export const AGENT_FEE_RESERVE_WEI: bigint = BigInt(
  import.meta.env.VITE_AGENT_FEE_WEI ?? "330000000000000000",
);
