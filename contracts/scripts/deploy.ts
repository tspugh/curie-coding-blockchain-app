import { ethers, network } from "hardhat";

/**
 * Deploy CoverageNegotiation to the configured network.
 *
 * Constructor args come from env:
 *   - AGENT_PLATFORM_ADDRESS — Somnia agent-platform (IAgentRequester) address.
 *   - AGENT_ID               — registered dispute-resolution agent id.
 *
 * On Somnia testnet (chain 50312) PRIVATE_KEY must be set (see hardhat.config.ts).
 */
async function main() {
  const platform = process.env.AGENT_PLATFORM_ADDRESS;
  const agentIdRaw = process.env.AGENT_ID;

  if (!platform) {
    throw new Error("AGENT_PLATFORM_ADDRESS is required");
  }
  const agentId = BigInt(agentIdRaw ?? "0");

  const [deployer] = await ethers.getSigners();
  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Platform: ${platform}  AgentId: ${agentId}`);

  const Factory = await ethers.getContractFactory("CoverageNegotiation");
  const contract = await Factory.deploy(platform, agentId);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`CoverageNegotiation deployed at: ${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
