import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL ?? "";
const BSC_RPC_URL = process.env.BSC_RPC_URL ?? "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY ?? "";

const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts,
    },
    bsc: {
      url: BSC_RPC_URL || "https://bsc-dataseed.binance.org",
      chainId: 56,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      bsc: BSCSCAN_API_KEY || ETHERSCAN_API_KEY || "",
      sepolia: ETHERSCAN_API_KEY || "",
    },
  },
};

export default config;
