/**
 * Somnia connection core. Everything in the app reaches the chain through a
 * `SomniaAgentKit` produced here — there is no REST layer and no hand-rolled
 * ethers/viem plumbing. The kit wraps RPC, signing, contract bindings
 * (AgentRegistry/AgentManager/AgentExecutor/AgentVault), and event streams.
 */
import { SomniaAgentKit, SOMNIA_NETWORKS as KIT_NETWORKS } from "somnia-agent-kit";

import { loadConfig, type AppConfig } from "../config/env.js";

/**
 * Constructs and initialises a `SomniaAgentKit` from validated config.
 *
 * The kit's bundled network config is used so contract addresses resolve; an
 * RPC override from the environment, if present, takes precedence.
 */
export async function createKit(config: AppConfig = loadConfig()): Promise<SomniaAgentKit> {
  const kit = new SomniaAgentKit({
    network: KIT_NETWORKS[config.network],
    ...(config.privateKey !== undefined ? { privateKey: config.privateKey } : {}),
    ...(config.rpcUrl !== undefined ? { rpcUrl: config.rpcUrl } : {}),
  });

  await kit.initialize();
  return kit;
}
