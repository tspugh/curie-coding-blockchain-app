import { ethers, network } from "hardhat";

/**
 * Deploy MockAgentPlatform to Somnia testnet.
 *
 * After deploying:
 *   1. Set AGENT_PLATFORM_ADDRESS=<deployed address> in root .env
 *   2. Run deploy:somnia to redeploy CoverageNegotiation with the mock
 *
 * The mock implements IAgentRequester with getRequestDeposit() = 0.001 ether,
 * so requestAdjudication() works without the real Somnia AgentExecutor.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const Factory = await ethers.getContractFactory("MockAgentPlatform");
  const mock = await Factory.deploy();
  await mock.waitForDeployment();

  const address = await mock.getAddress();
  console.log(`MockAgentPlatform deployed at: ${address}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Set AGENT_PLATFORM_ADDRESS=${address} in root .env`);
  console.log(`  2. npm --prefix contracts run deploy:somnia`);
  console.log(`  3. Update COVERAGE_CONTRACT_ADDRESS + VITE_CONTRACT_ADDRESS in .env`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
