import { ethers } from "hardhat";
async function main() {
  const proxy = process.env.PROBE_ADDR ?? "0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A";
  // EIP-1967 implementation slot: keccak256("eip1967.proxy.implementation") - 1
  const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const raw = await ethers.provider.getStorage(proxy, IMPL_SLOT);
  // Last 20 bytes = address.
  const impl = ethers.getAddress("0x" + raw.slice(-40));
  console.log(`proxy:          ${proxy}`);
  console.log(`raw slot:       ${raw}`);
  console.log(`implementation: ${impl}`);
  const implCode = await ethers.provider.getCode(impl);
  console.log(`impl bytecode:  ${implCode.length} chars / ${(implCode.length - 2) / 2} bytes`);
}
main();
