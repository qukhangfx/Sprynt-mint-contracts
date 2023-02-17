import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";
import "solidity-coverage";

import * as dotenv from "dotenv";
dotenv.config();

const chainIds = {
  // ethereum
  mainnet: 1,
  rinkeby: 4,
  goerli: 5,
  ropsten: 3,
  // polygon
  mumbai: 80001,
  polygon: 137,
  // bsc
  bsc: 56,
  bscTestnet: 97,
  // avalanche
  avalanche: 43114,
  fuji: 43113,
  // fantom
  opera: 250,
  ftmTestnet: 4002,
  // metis
  metisgoerli: 599,
  andromeda: 1088,
  // arbitrum
  arbitrum: 42161,
  arbitrumGoerli: 421613,
};

const MUMBAI_ALCHEMY_KEY = process.env.MUMBAI_ALCHEMY_KEY || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";;
const POLYGONSCAN_KEY = process.env.POLYGONSCAN_KEY || "";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "";

const config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // chainId: 1337
    },
    polygon: {
      url: POLYGON_RPC_URL,
      chainId: chainIds.polygon,
      accounts: [PRIVATE_KEY],
      gasMultiplier: 1.25
    },
    polygonMumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${MUMBAI_ALCHEMY_KEY}`,
      chainId: chainIds.mumbai,
      accounts: [PRIVATE_KEY],
      gasMultiplier: 1.25
    },
  },
  etherscan: {
    apiKey: { 
      polygon: POLYGONSCAN_KEY,
      polygonMumbai: POLYGONSCAN_KEY,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 30000,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  }
};

export default config;
