import { ethers, network } from "hardhat";

/**
 * Triggers an AI Approve ruling via MockAgentPlatform after submitEvidence has
 * been called. The mock records the last createRequest and we call triggerRuling
 * with that requestId to drive the handleResponse callback into CoverageNegotiation.
 *
 * Run AFTER the user submits evidence in the UI:
 *   npm --prefix contracts run trigger-ruling:somnia
 */
async function main() {
  const contractAddress = process.env.COVERAGE_CONTRACT_ADDRESS;
  if (!contractAddress) throw new Error("COVERAGE_CONTRACT_ADDRESS is required");

  const MOCK_ADDRESS = "0x8Ff3AAF89a6D861ceBd820B6E5Ae23219a8E754a";

  const [deployer] = await ethers.getSigners();
  console.log(`Network: ${network.name}`);

  const mock = await ethers.getContractAt("MockAgentPlatform", MOCK_ADDRESS, deployer);

  const lastRequestId: bigint = await (mock as any).lastRequestId();
  const lastCallback: string = await (mock as any).lastCallbackAddress();
  const createCalls: bigint = await (mock as any).createRequestCalls();

  console.log(`Mock createRequest calls: ${createCalls}`);
  console.log(`Last requestId: ${lastRequestId}`);
  console.log(`Last callbackAddress: ${lastCallback}`);

  if (createCalls === 0n) {
    console.error("❌  No createRequest calls recorded — submit evidence in the UI first.");
    process.exitCode = 1;
    return;
  }

  console.log(`\nTriggering Approve ruling for requestId ${lastRequestId} on ${lastCallback}…`);
  const tx = await (mock as any).triggerRuling(lastCallback, lastRequestId, "approve");
  await tx.wait();
  console.log("✅  Ruling triggered — contract should now be in Approved state.");
  console.log("    Reload the UI and both parties can Accept → Settle.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
