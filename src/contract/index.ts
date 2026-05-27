/**
 * Contract layer public surface + backend factory.
 *
 * `createCoverageClient` picks the backend from the wallet's mode (R11): a
 * {@link SimulatedBackend} for `simulated`, a {@link RealBackend} for `real`.
 * Both implement the identical {@link CoverageNegotiationClient}, so callers
 * never branch on mode.
 */
import type { Wallet, RealWallet } from "../wallet/wallet.js";
import { RealBackend, type RealBackendOptions } from "./real.js";
import { SimulatedBackend, type SimulatedAgentOptions } from "./simulated.js";
import type { CoverageNegotiationClient } from "./types.js";

export {
  type CoverageNegotiationClient,
  type CreateContractParams,
  type PolicyCommitment,
  type PriceBasis,
  type EventFilter,
} from "./types.js";
export { SimulatedBackend, type SimulatedAgentOptions, ZERO_HASH, ANY_CALLER } from "./simulated.js";
export { RealBackend, type RealBackendOptions } from "./real.js";
export { COVERAGE_NEGOTIATION_ABI } from "./abi.js";

/** Options for {@link createCoverageClient}. */
export interface CoverageClientOptions {
  /** Mocked-agent config for the simulated backend. */
  readonly simulated?: SimulatedAgentOptions;
  /** Deployed-contract config for the real backend. */
  readonly real?: RealBackendOptions;
}

/**
 * Build a {@link CoverageNegotiationClient} for the given wallet's mode. The
 * returned client exposes one interface regardless of mode (R11).
 */
export function createCoverageClient(
  wallet: Wallet,
  options: CoverageClientOptions = {},
): CoverageNegotiationClient {
  if (wallet.mode === "real") {
    return new RealBackend(wallet as RealWallet, options.real);
  }
  // R11 parity (Finding-2): bind the simulated backend's acting address to the
  // wallet so it enforces the SAME gates the contract does, unless the caller has
  // explicitly pinned a `caller` in the simulated options.
  const simulated =
    options.simulated?.caller !== undefined
      ? options.simulated
      : { ...options.simulated, caller: wallet.address };
  return new SimulatedBackend(simulated);
}
