/**
 * Canonical Somnia network parameters.
 *
 * Source of truth for human-facing display and RPC/explorer URLs. Values are
 * taken verbatim from the official docs (https://docs.somnia.network) as of
 * 2026-05-25. `somnia-agent-kit` carries its own bundled network configs
 * (including contract addresses); this module exists so the rest of the app has
 * one typed place to read network metadata, build explorer links, etc.
 */

export interface SomniaNetwork {
  /** Human-readable network name. */
  readonly name: string;
  /** EVM chain ID. */
  readonly chainId: number;
  /** Native currency ticker. */
  readonly currencySymbol: string;
  /** HTTP JSON-RPC endpoint. */
  readonly rpcUrl: string;
  /** WebSocket JSON-RPC endpoint (for event subscriptions). */
  readonly wsUrl: string;
  /** Block explorer base URL. */
  readonly explorerUrl: string;
  /** Faucet URL, where one exists. */
  readonly faucetUrl?: string;
}

export const SOMNIA_TESTNET: SomniaNetwork = {
  name: "Somnia Testnet (Shannon)",
  chainId: 50312,
  currencySymbol: "STT",
  rpcUrl: "https://api.infra.testnet.somnia.network/",
  wsUrl: "wss://api.infra.testnet.somnia.network/ws",
  explorerUrl: "https://shannon-explorer.somnia.network/",
  faucetUrl: "https://testnet.somnia.network/",
};

export const SOMNIA_MAINNET: SomniaNetwork = {
  name: "Somnia Mainnet",
  chainId: 5031,
  currencySymbol: "SOMI",
  rpcUrl: "https://api.infra.mainnet.somnia.network/",
  wsUrl: "wss://api.infra.mainnet.somnia.network/ws",
  explorerUrl: "https://explorer.somnia.network/",
  faucetUrl: "https://stakely.io/faucet/somnia-somi",
};

export const SOMNIA_NETWORKS = {
  testnet: SOMNIA_TESTNET,
  mainnet: SOMNIA_MAINNET,
} as const;

export type SomniaNetworkName = keyof typeof SOMNIA_NETWORKS;

/** Build an explorer URL for a transaction hash on the given network. */
export function txUrl(network: SomniaNetwork, txHash: string): string {
  return `${network.explorerUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

/** Build an explorer URL for an address on the given network. */
export function addressUrl(network: SomniaNetwork, address: string): string {
  return `${network.explorerUrl.replace(/\/$/, "")}/address/${address}`;
}
