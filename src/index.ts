/**
 * Entry point. Connects to Somnia and prints a short connection summary —
 * the smoke test that the chain plumbing works before any protocol logic is
 * layered on top.
 */
import { loadConfig } from "./config/env.js";
import { SOMNIA_NETWORKS } from "./config/networks.js";
import { createKit } from "./somnia/kit.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const network = SOMNIA_NETWORKS[config.network];

  console.log(
    `Curie Claims Protocol — connecting to ${network.name} ` +
      `(chainId ${network.chainId}, ${network.currencySymbol})`,
  );
  console.log(`RPC: ${config.rpcUrl ?? network.rpcUrl}`);
  console.log(`Explorer: ${network.explorerUrl}`);
  console.log(config.privateKey ? "Mode: read/write (signer configured)" : "Mode: read-only");

  const kit = await createKit(config);

  const totalAgents = await kit.contracts.registry.getTotalAgents();
  console.log(`Connected. Registered agents on AgentRegistry: ${totalAgents}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
