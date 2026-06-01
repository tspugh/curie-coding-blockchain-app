import { ethers } from "hardhat";

async function main() {
  const addr = "0x2c561f339a0A15cf0550cb9a0880Bb341488ac93";
  const orchestrator = "0x204031FA1ad46a2D453b7c54fC28Ff1787Bd9128";
  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt("CoverageNegotiation", addr, signer);

  console.log(`Pre-call: selfHosted=${await contract.selfHosted()}, platform=${await contract.platform()}`);
  const tx = await contract.setPlatformSelfHosted(orchestrator);
  console.log(`tx: ${tx.hash}`);
  await tx.wait();
  console.log(`Post-call: selfHosted=${await contract.selfHosted()}, platform=${await contract.platform()}`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
