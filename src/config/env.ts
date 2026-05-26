/**
 * Environment loading and validation. The single entry point for reading
 * runtime configuration from `.env` / the process environment.
 */
import "dotenv/config";

import { SOMNIA_NETWORKS, type SomniaNetworkName } from "./networks.js";

export interface AppConfig {
  /** Which Somnia network to target. */
  readonly network: SomniaNetworkName;
  /** Signing key, if write access is required. Absent => read-only. */
  readonly privateKey?: string;
  /** Optional RPC override; falls back to the network default. */
  readonly rpcUrl?: string;
}

function parseNetwork(raw: string | undefined): SomniaNetworkName {
  const value = (raw ?? "testnet").trim().toLowerCase();
  if (value in SOMNIA_NETWORKS) {
    return value as SomniaNetworkName;
  }
  const allowed = Object.keys(SOMNIA_NETWORKS).join(", ");
  throw new Error(
    `Invalid SOMNIA_NETWORK="${raw}". Expected one of: ${allowed}.`,
  );
}

/**
 * Reads and validates configuration from the environment. Throws on malformed
 * input rather than silently defaulting, so misconfiguration fails loudly.
 */
export function loadConfig(): AppConfig {
  const network = parseNetwork(process.env.SOMNIA_NETWORK);

  const privateKey = process.env.PRIVATE_KEY?.trim() || undefined;
  if (privateKey !== undefined && !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(
      "PRIVATE_KEY is set but is not a 0x-prefixed 32-byte hex string.",
    );
  }

  const rpcUrl = process.env.SOMNIA_RPC_URL?.trim() || undefined;

  return {
    network,
    ...(privateKey !== undefined ? { privateKey } : {}),
    ...(rpcUrl !== undefined ? { rpcUrl } : {}),
  };
}
