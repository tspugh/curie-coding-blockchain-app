/**
 * Pluggable wallet abstraction (SPEC-0001 R11/R12).
 *
 * Exposes ONE `Wallet` interface with two implementations selected by mode:
 *
 *  - {@link SimulatedWallet} — a deterministic fake address with no real keys
 *    and no funds, for the dev loop / CI. There is no `signer`.
 *  - {@link RealWallet} — an ethers v6 `Wallet` built from a private key and
 *    connected to a Somnia JSON-RPC provider, for MVP v0 on testnet.
 *
 * The contract client picks its backend from `wallet.mode`, so the same
 * calling code path runs in both modes.
 */
import { ethers } from "ethers";

import { SOMNIA_NETWORKS, type SomniaNetworkName } from "../config/networks.js";
import type { WalletMode } from "../types/coverage.types.js";

/** Common surface shared by both wallet implementations. */
export interface Wallet {
  /** Operating mode — drives which contract backend is used. */
  readonly mode: WalletMode;
  /** The wallet's address (deterministic fake in simulated mode). */
  readonly address: string;
  /**
   * An ethers signer for on-chain writes. `null` in simulated mode (no keys,
   * no funds) — the simulated backend never needs one.
   */
  readonly signer: ethers.Signer | null;
  /**
   * A read provider for on-chain views/events. `null` in simulated mode.
   */
  readonly provider: ethers.Provider | null;
}

/**
 * In-memory simulated wallet: a deterministic address derived from a seed, no
 * private key, no funds. Lets the entire app run end-to-end locally with no
 * chain (R11).
 */
export class SimulatedWallet implements Wallet {
  readonly mode = "simulated" as const;
  readonly address: string;
  readonly signer = null;
  readonly provider = null;

  /**
   * @param seed Stable string used to derive the fake address; the same seed
   *             always yields the same address (useful for two-party demos).
   */
  constructor(seed = "curie-simulated-wallet") {
    // keccak256(seed) -> take the trailing 20 bytes as a checksummed address.
    const digest = ethers.keccak256(ethers.toUtf8Bytes(seed));
    this.address = ethers.getAddress(`0x${digest.slice(-40)}`);
  }
}

/**
 * Real wallet: an ethers v6 `Wallet` from a private key, connected to a Somnia
 * RPC provider. Used for MVP v0 against the deployed contract on testnet.
 */
export class RealWallet implements Wallet {
  readonly mode = "real" as const;
  readonly address: string;
  readonly signer: ethers.Wallet;
  readonly provider: ethers.JsonRpcProvider;

  /**
   * @param privateKey 0x-prefixed 32-byte hex private key (a dedicated dev key).
   * @param rpcUrl     JSON-RPC endpoint; defaults to the configured network's.
   * @param network    Which Somnia network to default the RPC from.
   */
  constructor(
    privateKey: string,
    rpcUrl?: string,
    network: SomniaNetworkName = "testnet",
  ) {
    const url = rpcUrl ?? SOMNIA_NETWORKS[network].rpcUrl;
    this.provider = new ethers.JsonRpcProvider(url, SOMNIA_NETWORKS[network].chainId);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.address = this.signer.address;
  }
}

/** Options for {@link createWallet}. */
export interface CreateWalletOptions {
  /**
   * Force a mode. When omitted, the factory reads `SOMNIA_WALLET_MODE`
   * (`simulated` | `real`) from the environment, defaulting to `simulated`.
   */
  readonly mode?: WalletMode;
  /** Private key for real mode; falls back to `PRIVATE_KEY` from the env. */
  readonly privateKey?: string;
  /** RPC override for real mode; falls back to `SOMNIA_RPC_URL` / network default. */
  readonly rpcUrl?: string;
  /** Network for real mode; falls back to `SOMNIA_NETWORK` / `testnet`. */
  readonly network?: SomniaNetworkName;
  /** Seed for the simulated wallet's deterministic address. */
  readonly seed?: string;
}

function resolveMode(explicit: WalletMode | undefined): WalletMode {
  if (explicit !== undefined) return explicit;
  const raw = (process.env.SOMNIA_WALLET_MODE ?? "simulated").trim().toLowerCase();
  if (raw === "real") return "real";
  if (raw === "simulated") return "simulated";
  throw new Error(
    `Invalid SOMNIA_WALLET_MODE="${process.env.SOMNIA_WALLET_MODE}". Expected "simulated" or "real".`,
  );
}

function resolveNetwork(explicit: SomniaNetworkName | undefined): SomniaNetworkName {
  if (explicit !== undefined) return explicit;
  const raw = (process.env.SOMNIA_NETWORK ?? "testnet").trim().toLowerCase();
  if (raw in SOMNIA_NETWORKS) return raw as SomniaNetworkName;
  return "testnet";
}

/**
 * Factory that builds a {@link Wallet} for the selected mode (R11). Defaults to
 * simulated so the app runs locally with no funded key. In real mode a private
 * key is required (option or `PRIVATE_KEY` env), validated as 0x + 64 hex.
 */
export function createWallet(options: CreateWalletOptions = {}): Wallet {
  const mode = resolveMode(options.mode);

  if (mode === "simulated") {
    return options.seed !== undefined
      ? new SimulatedWallet(options.seed)
      : new SimulatedWallet();
  }

  const privateKey = options.privateKey ?? process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error(
      "Real wallet mode requires a private key (createWallet({ privateKey }) or PRIVATE_KEY env).",
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("Private key must be a 0x-prefixed 32-byte hex string.");
  }

  const network = resolveNetwork(options.network);
  const rpcUrl = options.rpcUrl ?? (process.env.SOMNIA_RPC_URL?.trim() || undefined);
  return new RealWallet(privateKey, rpcUrl, network);
}
