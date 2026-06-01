import { ethers } from "hardhat";
async function main() {
  const addr = process.env.PROBE_ADDR ?? "0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A";
  const code = await ethers.provider.getCode(addr);
  console.log(`address: ${addr}`);
  console.log(`bytecode length: ${code.length} (= ${(code.length - 2) / 2} bytes of code)`);
  console.log(`first 60 chars: ${code.slice(0, 60)}`);
}
main();
