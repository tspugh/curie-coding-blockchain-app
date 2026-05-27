/**
 * Curie Negotiation Protocol — MVP0 library public API (SPEC-0001).
 *
 * Framework-agnostic TypeScript the UI imports. One interface, two modes
 * (simulated ↔ real), wired together by {@link createClient}. No REST, no UI;
 * the chain is reached via ethers against the deployed contract (real mode) or
 * an in-memory mirror (simulated mode).
 */

// --- Re-exports: types ---
export * from "./types/coverage.types.js";

// --- Re-exports: layers ---
export {
  type Wallet,
  type CreateWalletOptions,
  SimulatedWallet,
  RealWallet,
  createWallet,
} from "./wallet/index.js";

export {
  type Profile,
  type ProfileRegistryOptions,
  ProfileRegistry,
  DEFAULT_PROFILES,
} from "./profiles/index.js";

export {
  type StoredContent,
  ContentStore,
  hashContent,
  verifyContent,
} from "./content/index.js";

export {
  type CoverageNegotiationClient,
  type CreateContractParams,
  type PolicyCommitment,
  type EventFilter,
  type CoverageClientOptions,
  type SimulatedAgentOptions,
  type RealBackendOptions,
  SimulatedBackend,
  RealBackend,
  ZERO_HASH,
  COVERAGE_NEGOTIATION_ABI,
  createCoverageClient,
} from "./contract/index.js";

export {
  SOMNIA_NETWORKS,
  SOMNIA_TESTNET,
  SOMNIA_MAINNET,
  type SomniaNetwork,
  type SomniaNetworkName,
  txUrl,
  addressUrl,
} from "./config/networks.js";

// --- Re-exports: off-chain party actors + orchestrator (§4) ---
export {
  PartyAgent,
  type PartyAgentDeps,
  type FileRequestInput,
  type AgentClient,
  createProviderAgent,
  createInsurerAgent,
  createPayerAgent,
} from "./agents/index.js";

export {
  runNegotiation,
  type NegotiationScript,
  type NegotiationTranscript,
  type PostRulingAction,
} from "./orchestrator.js";

import {
  createCoverageClient,
  type CoverageClientOptions,
  type CoverageNegotiationClient,
} from "./contract/index.js";
import { ContentStore } from "./content/index.js";
import {
  ProfileRegistry,
  type ProfileRegistryOptions,
} from "./profiles/index.js";
import { createWallet, type CreateWalletOptions, type Wallet } from "./wallet/index.js";

/** Configuration for {@link createClient}. */
export interface ClientConfig {
  /** Wallet selection (mode/key/rpc/seed). Defaults to simulated mode. */
  readonly wallet?: CreateWalletOptions;
  /** Initial profiles + active profile (R12). */
  readonly profiles?: ProfileRegistryOptions;
  /** Backend options (mocked-agent config / deployed-contract config). */
  readonly contract?: CoverageClientOptions;
}

/**
 * The bootstrapped app surface: wallet + profiles + content store + contract
 * client, wired together by mode. This is the single object the UI holds.
 */
export interface CurieClient {
  /** The active wallet (simulated or real). */
  readonly wallet: Wallet;
  /** App-level profiles bound to the wallet; supports switching (R12). */
  readonly profiles: ProfileRegistry;
  /** Off-chain content store + hashing (keeps PHI off-chain — R3/R4). */
  readonly content: ContentStore;
  /** The coverage-negotiation client (one interface across modes — R11). */
  readonly negotiation: CoverageNegotiationClient;
  /** Release resources (real backend: detaches listeners, closes provider). */
  close(): Promise<void>;
}

/**
 * Bootstrap the whole library by mode (R11). Selects the wallet from config /
 * env (default simulated), builds the matching contract backend, and wires in
 * the profile registry and off-chain content store. The same returned shape
 * works end-to-end in both modes.
 */
export function createClient(config: ClientConfig = {}): CurieClient {
  const wallet = createWallet(config.wallet ?? {});
  const profiles = new ProfileRegistry(wallet, config.profiles ?? {});
  const content = new ContentStore();
  const negotiation = createCoverageClient(wallet, config.contract ?? {});

  return {
    wallet,
    profiles,
    content,
    negotiation,
    async close(): Promise<void> {
      await negotiation.close();
    },
  };
}
