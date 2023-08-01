import layerzeroConfig from "../constants/layerzeroConfig.json";
import { load, save } from "../utils";

import {
    DepositFactoryContract,
    ReceiveFactoryContract,
    SimplePay,
    DepositContract,
    ERC1155Contract,
    ChainLinkPriceFeed,
    RPaymentContract,
} from "../typechain-types";

const EMPTY_ADDRESS: string = "0x0000000000000000000000000000000000000000";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function tryUntilSucceed(fn: any, maxTries: number = 4) {
    try {
        return await fn();
    } catch (e) {
        if (maxTries > 0) {
            return tryUntilSucceed(fn, maxTries - 1);
        }
        throw e;
    }
}

const usdc: any = {
    "polygonMumbai": '0xf75E983a2aa3BbB1671B7736d666689FAa712eFf',
    "sepolia": "0x7255F860Ab81C0b0B9D50f1f06cE88D5C6af7D40",
    "avalancheFujiTestnet": "0xE007e03cB091f81F34Cbb18667625D153cb8913D",
    "ftmTestnet": "0x06b193D42662B7a48641b31f9BAC9C06f48c019C",
    "bscTestnet": "0x7255f860ab81c0b0b9d50f1f06ce88d5c6af7d40",
    // Below are mainnet addresses
    "polygon": "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    "bsc": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    "avalanche": "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
    "opera": "0x04068da6c83afcfa0e13ba15a6696662335d5b75",
    "mainnet": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
};

const nativeTokenPriceFeedAddress: any = {
    "polygon": "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
    "bsc": "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
    "avalanche": "0x0A77230d17318075983913bC2145DB16C7366156",
    "opera": "0xf4766552D15AE4d256Ad41B6cf2933482B0680dc",
    "mainnet": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
};

const chainLink: any = {
    "mainnet": {
        AVAX_USD: '0xFF3EEb22B5E3dE6e705b44749C2559d704923FD7',
        BNB_USD: '0x14e613AC84a31f709eadbdF89C6CC390fDc9540A',
        ETH_USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
        FTM_USD: '0x2DE7E4a9488488e0058B95854CC2f7955B35dC9b',
        MATIC_USD: '0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676',
        USDC_USD: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    },
    "bsc": {
        BNB_USD: '0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526',
        USDC_USD: '0x51597f405303C4377E36123cBc172b13269EA163'
    }
};

export const setupAll = async (taskArgs: any, hre: any) => {
    // const networks: string[] = ["sepolia", "avalancheFujiTestnet", "ftmTestnet", "bscTestnet"];
    // const networks: string[] = ["mainnet"]; // "polygon", "bsc", "avalanche", "opera"

    const networks: string[] = ["polygon"];

    let ContractAddresses = await load("ContractAddresses");

    // for (let index = 0; index < networks.length; ++index) {
    //     const mintChain = networks[index];

    //     await hre.changeNetwork(mintChain);

    //     const [signer] = await hre.ethers.getSigners();

    //     const rPaymentContract = (await hre.ethers.getContractAt(
    //         "RPaymentContract",
    //         ContractAddresses["RPaymentContract"][mintChain]
    //     )) as RPaymentContract;

    //     await rPaymentContract.connect(signer).updateSupportToken(
    //         EMPTY_ADDRESS,
    //         true
    //     );
    // }
}