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
