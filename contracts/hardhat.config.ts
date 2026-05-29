import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load from the repo root .env (one level up from contracts/).
dotenv.config({ path: resolve(__dirname, "../.env") });

// Somnia testnet (Shannon) — values mirror ../src/config/networks.ts.
// chainId 50312, RPC https://api.infra.testnet.somnia.network/.
const SOMNIA_TESTNET_CHAIN_ID = 50312;
const SOMNIA_TESTNET_RPC = "https://api.infra.testnet.somnia.network/";

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // viaIR is required since tick 49 — the 8-element abi.decode tuple in
      // CoverageNegotiation.handleResponse (including the new uint16[]
      // policyVoidedClauseIndices field per SPEC-0004 R23 / amendment 0005)
      // pushes the standard codegen past the EVM stack limit. The Yul IR
      // pipeline manages stack pressure for us. Note for redeployment +
      // Blockscout verification: this flag MUST match across all environments.
      viaIR: true,
    },
  },
  networks: {
    somniaTestnet: {
      url: process.env.SOMNIA_RPC_URL || SOMNIA_TESTNET_RPC,
      chainId: SOMNIA_TESTNET_CHAIN_ID,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};

export default config;
