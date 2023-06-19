import layerzeroConfig from "../constants/layerzeroConfig.json";
import { load, save } from "../utils";

import {
    DepositFactoryContract,
    ReceiveFactoryContract,
    SimplePay,
    DepositContract,
    ERC1155Contract,
} from "../typechain-types";

const EMPTY_ADDRESS: string = "0x0000000000000000000000000000000000000000";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const mintDepositItemsBySeller = async (taskArgs: any, hre: any) => {
    const networks: string[] = [
        "polygonMumbai", 
        // "sepolia", 
        // "avalancheFujiTestnet", 
        // "ftmTestnet"
    ];
    console.log(hre.ethers.utils.parseEther("0.0001"));

    // let ContractAddresses = await load("ContractAddresses");

    // for (let index = 0; index < networks.length; ++index) {
    //     const mintChain = networks[index];

    //     await hre.changeNetwork(mintChain);
    //     console.log(`Switched to ${mintChain}`);

    //     const [signer] = await hre.ethers.getSigners();

    //     const depositFactoryContract = (await hre.ethers.getContractAt(
    //         "DepositFactoryContract",
    //         ContractAddresses["DepositFactoryContract"][mintChain]
    //     )) as DepositFactoryContract;

    //     const receiveFactoryContract = (await hre.ethers.getContractAt(
    //         "ReceiveFactoryContract",
    //         ContractAddresses["ReceiveFactoryContract"][mintChain]
    //     )) as ReceiveFactoryContract;

    //     const address = await signer.getAddress();

    //     const depositContractAddress = await depositFactoryContract.getDepositContract(
    //         layerzeroConfig[mintChain].chainId,
    //         address
    //     );

    //     console.log(`DepositContract address: ${depositContractAddress}`);

    //     await depositFactoryContract.changeStage(
    //         depositContractAddress,
    //         1,
    //     );

    //     await delay(3000);

    //     const depositContract = (await hre.ethers.getContractAt(
    //         "DepositContract",
    //         depositContractAddress
    //     )) as DepositContract;

    //     const deadline = 1686899600;

    //     const depositItem = {
    //         mintPrice: hre.ethers.utils.parseEther("0.0001"),
    //         mintQuantity: index + 1,
    //         sellerAddress: address
    //     };

    //     console.log(depositItem);

    //     const mintTx = await depositContract
    //         .connect(signer)
    //         .mint(depositItem, { value: depositItem.mintPrice * depositItem.mintQuantity });
        
    //     console.log(`Mint tx: ${mintTx.hash}`);
    // }
}

// Switched to polygonMumbai
// DepositContract address: 0xAa6022085C000CA38b1b3368d7ff6D1988D70EfE
// {
//   mintPrice: BigNumber { value: "100000000000000" },
//   mintQuantity: 1,
//   sellerAddress: '0xf4fFfaC51c9af844e472C26A7AF5F9e6F2DcBf77'
// }
// Mint tx: 0x9bf2df778deacaa3153a204e7b659161f568a9fac689fc867fba392a7b94ab1b

// Switched to ftmTestnet
// DepositContract address: 0x83b154C0Cf5e10A7E7A9e0608b59e63EE15E82Ea
// {
//   mintPrice: BigNumber { value: "100000000000000" },
//   mintQuantity: 1,
//   sellerAddress: '0xf4fFfaC51c9af844e472C26A7AF5F9e6F2DcBf77'
// }
// Mint tx: 0xe66fd36060919f5c4d09c333277e8b3f4964833a42faf25918fccdc32c1aa77d