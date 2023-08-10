import "@typechain/hardhat";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-change-network";
import "hardhat-dependency-compiler";
import "@nomicfoundation/hardhat-toolbox";
import "./tasks";

import * as dotenv from "dotenv";
dotenv.config();
const chainIds = {
  // ethereum
  mainnet: 1,
  sepolia: 11155111,
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

const PRIVATE_KEY = process.env.PK || "";

const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY || "";
const POLYGONSCAN_KEY = process.env.POLYGONSCAN_KEY || "";
const BSCSCAN_KEY = process.env.BSCSCAN_KEY || "";
const AVALANCHESCAN_KEY = process.env.AVALANCHESCAN_KEY || "";
const FANTOM_KEY = process.env.FANTOMSCAN_KEY || "";
const ARBISCAN_KEY = process.env.ARBISCAN_KEY || "";

const TEST_ETH_RPC_URL = process.env.TEST_ETH_RPC_URL;
const TEST_BSC_RPC_URL = process.env.TEST_BSC_RPC_URL;
const TEST_POLYGON_RPC_URL = process.env.TEST_POLYGON_RPC_URL;
const TEST_AVAX_RPC_URL = process.env.TEST_AVAX_RPC_URL;
const TEST_FANTOM_RPC_URL = process.env.TEST_FANTOM_RPC_URL;
const TEST_ARBITRUM_RPC_URL = process.env.TEST_ARBITRUM_RPC_URL;
const TEST_METIS_RPC_URL = process.env.TEST_METIS_RPC_URL;

const MAIN_ETH_RPC_URL = process.env.MAIN_ETH_RPC_URL;
const MAIN_BSC_RPC_URL = process.env.MAIN_BSC_RPC_URL;
const MAIN_POLYGON_RPC_URL = process.env.MAIN_POLYGON_RPC_URL;
const MAIN_AVAX_RPC_URL = process.env.MAIN_AVAX_RPC_URL;
const MAIN_FANTOM_RPC_URL = process.env.MAIN_FANTOM_RPC_URL;
const MAIN_ARBITRUM_RPC_URL = process.env.MAIN_ARBITRUM_RPC_URL;
const MAIN_METIS_RPC_URL = process.env.MAIN_METIS_RPC_URL;

const COIN_MARKET_CAP_KEY = process.env.COIN_MARKET_CAP_KEY || "";

const config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // blockGasLimit: 200_000_000,
    },
    gnosis: {
      url: "https://rpc.gnosischain.com",
      accounts: [PRIVATE_KEY],
    },
    chiado: {
      url: "https://rpc.chiadochain.net",
      gasPrice: 1000000000,
      accounts: [PRIVATE_KEY],
    },
    mainnet: {
      url: MAIN_ETH_RPC_URL,
      chainId: chainIds.mainnet,
      accounts: [PRIVATE_KEY],
      gasMultiplier: 1.25,
    },
    sepolia: {
      url: TEST_ETH_RPC_URL,
      chainId: chainIds.sepolia,
      accounts: [PRIVATE_KEY],
      gasMultiplier: 1.25,
      allowUnlimitedContractSize: true,
    },
    polygon: {
      url: MAIN_POLYGON_RPC_URL,
      chainId: chainIds.polygon,
      accounts: [PRIVATE_KEY],
      gasMultiplier: 1.5,
    },
    polygonMumbai: {
      url: TEST_POLYGON_RPC_URL,
      chainId: chainIds.mumbai,
      accounts: [PRIVATE_KEY],
      gasMultiplier: 1.25,
      allowUnlimitedContractSize: true,
    },
    bsc: {
      url: MAIN_BSC_RPC_URL,
      chainId: chainIds.bsc,
      accounts: [PRIVATE_KEY],
      gasMultiplier: 1.25,
    },
    bscTestnet: {
      url: TEST_BSC_RPC_URL,
      chainId: chainIds.bscTestnet,
      accounts: [PRIVATE_KEY],
      gasMultiplier: 1.25,
    },
    avalanche: {
      url: MAIN_AVAX_RPC_URL,
      chainId: chainIds.avalanche,
      accounts: [PRIVATE_KEY],
      gasMultiplier: 1.25,
    },
    avalancheFujiTestnet: {
      url: TEST_AVAX_RPC_URL,
      chainId: chainIds.fuji,
      accounts: [PRIVATE_KEY],
      gasMultiplier: 1.25,
    },
    opera: {
      url: MAIN_FANTOM_RPC_URL,
      chainId: chainIds.opera,
      accounts: [PRIVATE_KEY],
      gasMultiplier: 1.25,
    },
    ftmTestnet: {
      url: TEST_FANTOM_RPC_URL,
      chainId: chainIds.ftmTestnet,
      accounts: [PRIVATE_KEY],
      gasMultiplier: 1.25,
    },
    andromeda: {
      url: MAIN_METIS_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: chainIds.andromeda,
      gasMultiplier: 1.25,
    },
    metisgoerli: {
      url: TEST_METIS_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: chainIds.metisgoerli,
      gasMultiplier: 1.25,
    },
    arbitrumOne: {
      url: MAIN_ARBITRUM_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: chainIds.arbitrum,
      gasMultiplier: 1.25,
    },
    arbitrumGoerli: {
      url: TEST_ARBITRUM_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: chainIds.arbitrumGoerli,
      gasMultiplier: 1.25,
    },
  },
  etherscan: {
    apiKey: {
      // gnosis
      chiado: "your key",
      gnosis: "HESMMDE9TICEIM697YEKHQJ9KEVBHRHTVW",
      // ethereum
      mainnet: ETHERSCAN_KEY,
      sepolia: ETHERSCAN_KEY,
      // polygon
      polygon: POLYGONSCAN_KEY,
      polygonMumbai: POLYGONSCAN_KEY,
      // binance smart chain
      bsc: BSCSCAN_KEY,
      bscTestnet: BSCSCAN_KEY,
      // avalanche
      avalanche: AVALANCHESCAN_KEY,
      avalancheFujiTestnet: AVALANCHESCAN_KEY,
      // fantom
      opera: FANTOM_KEY,
      ftmTestnet: FANTOM_KEY,
      // metis
      metisAndromeda: ETHERSCAN_KEY,
      andromeda: ETHERSCAN_KEY,
      metisgoerli: ETHERSCAN_KEY,
      //arbitrum
      arbitrumOne: ARBISCAN_KEY,
      arbitrumGoerli: ARBISCAN_KEY,
    },
    customChains: [
      {
        network: "andromeda",
        chainId: chainIds.andromeda,
        urls: {
          apiURL: "https://andromeda-explorer.metis.io/api",
          browserURL: "https://andromeda-explorer.metis.io",
        },
      },
      {
        network: "metisgoerli",
        chainId: chainIds.metisgoerli,
        urls: {
          apiURL: "https://goerli.explorer.metisdevops.link/api",
          browserURL: "https://goerli.explorer.metisdevops.link",
        },
      },
      {
        network: "chiado",
        chainId: 10200,
        urls: {
          // Blockscouts
          apiURL: "https://blockscout.com/gnosis/chiado/api",
          browserURL: "https://blockscout.com/gnosis/chiado",
        },
      },
      {
        network: "gnosis",
        chainId: 100,
        urls: {
          apiURL: "https://api.gnosisscan.io/api",
          browserURL: "https://gnosisscan.io/",
          // Blockscout
          // apiURL: "https://blockscout.com/xdai/mainnet/api",
          // browserURL: "https://blockscout.com/xdai/mainnet",
        },
      },
    ],
  },
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
          viaIR: true,
        },
      },
    ],
  },
  mocha: {
    timeout: 30000,
  },
  gasReporter: {
    coinmarketcap: COIN_MARKET_CAP_KEY,
    enabled: true,
    currency: "USD",
    showTimeSpent: true,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true,
  },
  dependencyCompiler: {
    paths: [],
  },
};

export default config;
