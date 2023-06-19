import { load, save } from "../utils";

import {
  DepositFactoryContract,
  ReceiveFactoryContract,
  DepositContract,
  SimplePay,
  ERC1155Contract,
} from "../typechain-types";

export const verifyChildContractsBySeller = async (taskArgs: any, hre: any) => {
  let depositContracts = await load("DepositContracts");
  let NftMintContracts = await load("NftMintContractsData");
  let simplePayContracts = await load("SimplePayContracts");

  // console.log("Verifying SimplePayContracts");

  // for (const [networkName, contractAddress] of Object.entries(
  //   simplePayContracts
  // )) {
  //   if (hre.network.name !== networkName) {
  //     await hre.changeNetwork(networkName);
  //     console.log(`Verifier: switched on ${networkName}`);
  //   }

  //   // verify contract
  //   await hre.run("verify:verify", {
  //     address: contractAddress,
  //     constructorArguments: [],
  //   });
  // }

  // console.log("Verifying DepositContracts");

  // for (const [networkName, contractAddress] of Object.entries(
  //   depositContracts
  // )) {
  //   if (hre.network.name !== networkName) {
  //     await hre.changeNetwork(networkName);
  //     console.log(`Verifier: switched on ${networkName}`);
  //   }

  //   // verify contract
  //   await hre.run("verify:verify", {
  //     address: contractAddress,
  //     constructorArguments: [],
  //   });
  // }

  // console.log("Verifying NftMintContracts");

  // for (const [networkName, _] of Object.entries(
  //   depositContracts
  // )) {
    // if (["sepolia", "sepolia"].includes(networkName)) {
    //   console.log(`Skipping ${networkName}`);
    //   continue;
    // }

    // if (hre.network.name !== networkName) {
    //   await hre.changeNetwork(networkName);
    //   console.log(`Verifier: switched on ${networkName}`);
    // }

    // const [signer] = await hre.ethers.getSigners();
    // const erc1155 = await hre.ethers.getContractFactory(
    //   "ERC1155Contract"
    // );

    // const erc1155Contract = await erc1155
    //   .connect(signer)
    //   .deploy();
    
    // await erc1155Contract.deployed();

    // console.log(
    //   `ERC1155Contract is deployed at: ${erc1155Contract.address}`
    // );

    // NftMintContracts[networkName] = erc1155Contract.address;

    // verify contract
    // await hre.run("verify:verify", {
    //   address: NftMintContracts[networkName],
    //   constructorArguments: [],
    // });
  // }

  // await save("NftMintContractsData", NftMintContracts);

  await hre.changeNetwork("sepolia");
  // sepolia
  const [signer] = await hre.ethers.getSigners();
  console.log("🚀 ~ file: verifyChildContracts.ts:94 ~ verifyChildContractsBySeller ~ signer:", signer)
  
  const depositContract = (await hre.ethers.getContractAt(  
    "DepositContract",
    depositContracts["sepolia"]
  )) as DepositContract;
  console.log("🚀", depositContracts["sepolia"]);

  const chainIdDst = 10161;
  // const currentTimestamp = Math.floor(Date.now() / 1000);
  const deadline = 1686810777;

  const depositItemData = {
    mintPrice: hre.ethers.utils.parseEther("0.0001"),
    mintQuantity: 3,
    sellerAddress: '0xf4fFfaC51c9af844e472C26A7AF5F9e6F2DcBf77',
    dstChainId: chainIdDst,
    isMintAvailable: true,
    deadline: deadline,
  };
  
  console.log("🚀 ~ file: verifyChildContracts.ts:97 ~ verifyChildContractsBySeller ~ depositItemData:", depositItemData)

  const depositContractInstance = await (
    await depositContract
    .connect(signer).mint(depositItemData, {
      value: hre.ethers.utils.parseEther("0.0003"),
    })
  ).wait();
  console.log("🚀 ~ file: verifyChildContracts.ts:109 ~ verifyChildContractsBySeller ~ depositContractInstance:", depositContractInstance)
};
