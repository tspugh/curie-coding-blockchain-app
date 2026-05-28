import { ethers, network } from "hardhat";

/**
 * Admin: configure the deployed CoverageNegotiation contract.
 *
 * - Reads COVERAGE_CONTRACT_ADDRESS and AGENT_REWARD from env.
 * - Calls setAgentReward() so the contract forwards enough ETH to the
 *   Somnia LLM Parse Website agent (0.10 ether × 3 validators = 0.30 ether).
 * - Also queries getRequestDeposit() from the platform so you know the total
 *   msg.value required for requestAdjudication.
 *
 * Run: npm --prefix contracts run admin:somnia
 */
async function main() {
  const contractAddress = process.env.COVERAGE_CONTRACT_ADDRESS;
  if (!contractAddress) throw new Error("COVERAGE_CONTRACT_ADDRESS is required");

  const platformAddress = process.env.AGENT_PLATFORM_ADDRESS;
  if (!platformAddress) throw new Error("AGENT_PLATFORM_ADDRESS is required");

  const [deployer] = await ethers.getSigners();
  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Contract: ${contractAddress}`);

  const contract = await ethers.getContractAt("CoverageNegotiation", contractAddress, deployer);

  // Query the platform's floor deposit
  const platform = new ethers.Contract(
    platformAddress,
    ["function getRequestDeposit() external view returns (uint256)"],
    deployer,
  );
  const floor = await platform.getRequestDeposit() as bigint;
  console.log(`\nPlatform getRequestDeposit(): ${ethers.formatEther(floor)} STT`);

  // Set agentReward = 0.10 ether × 3 validators (Somnia default subcommittee)
  const perAgent = ethers.parseEther("0.10");
  const agentReward = perAgent * 3n;
  console.log(`Setting agentReward to ${ethers.formatEther(agentReward)} STT (0.10 × 3 validators)`);
  const tx = await (contract as any).setAgentReward(agentReward);
  await tx.wait();
  console.log(`✅  setAgentReward confirmed`);

  const totalFee = floor + agentReward;
  console.log(`\nTotal fee per requestAdjudication: ${ethers.formatEther(totalFee)} STT`);
  console.log(`Set VITE_AGENT_FEE_WEI=${totalFee.toString()} in .env`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
