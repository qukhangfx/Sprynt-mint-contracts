import { load, save } from "../utils";
import {
  DepositFactoryContract,
  ReceiveFactoryContract,
  DepositContract,
  SimplePay,
  ERC1155Contract,
} from "../typechain-types";
import deployChains from "../constants/deployChains.json";
import layerzeroConfig from "../constants/layerzeroConfig.json";
import usdcAddresses from "../constants/usdcAddresses.json";
import { getBigNumber } from "../test/utils";
import { ethers } from "ethers";

const tokenURI =
  "https://bafybeidyj2ases25wrcwyisxsbnfo6qe7oe4re5ql77uspoo6d33benknq.ipfs.nftstorage.link/";

export const deployChildContractsBySeller = async (taskArgs: any, hre: any) => {
  const mintChain: string = taskArgs.mchain;
  console.log(`Deployer: mintChain is ${mintChain}`);

  const MINT_CHAIN_RPC_URL = process.env.TEST_ETH_RPC_URL || "";
  const TEST_POLYGON_RPC_URL = process.env.TEST_POLYGON_RPC_URL || "";
  const TEST_FANTOM_RPC_URL = "https://rpc.testnet.fantom.network";
  const TEST_AVAX_RPC_URL = "https://api.avax-test.network/ext/C/rpc";
  const MAIN_BSC_RPC_URL = "https://data-seed-prebsc-1-s3.binance.org:8545";

  const sellerAddress = process.env.SELLER_ADDRESS || "";
  const sellerPk = process.env.SELLER_PK || "";

  const ethProvider = await new hre.ethers.providers.JsonRpcProvider(
    TEST_FANTOM_RPC_URL
  );
  let seller = new hre.ethers.Wallet(sellerPk, ethProvider);

  const [signer] = await hre.ethers.getSigners();

  let nftMintContractsData = await load("NftMintContractsData");

  const network_environment = taskArgs.e;
  const depositChains = deployChains[network_environment];

  const depositTokenDecimals = 6;

  let receiveFactoryContractData = await load("ReceiveFactoryContracts");
  let depositFactoryContractData = await load("DepositFactoryContracts");
  let depositContractData = await load("DepositContracts");

  // 1. DepositFactoryContract
  console.log("------ DepositFactoryContract ------");
  try {
    if (hre.network.name !== mintChain) {
      await hre.changeNetwork(mintChain);
      console.log(`Deployer: switched on ${mintChain}`);
    }

    const depositFactoryContractAddress = (
      await load("DepositFactoryContracts")
    )[mintChain];

    const depositFactoryContract = (await hre.ethers.getContractAt(
      "DepositFactoryContract",
      depositFactoryContractAddress
    )) as DepositFactoryContract;

    const network_environment = taskArgs.e;
    const networks = deployChains[network_environment];

    const [signer] = await hre.ethers.getSigners();
    const signerAddress = await signer.getAddress();

    // const nftToken = await hre.ethers.getContractFactory(
    //   "ERC1155Contract",
    // );
    // const nftTokenContract = await nftToken
    //   .connect(signer)
    //   .deploy(
    //     tokenURI,
    //     signerAddress,
    //   );
    // await nftTokenContract.deployed();
    // console.log(`ERC1155Contract deployed to: ${nftTokenContract.address}`);

    // console.log(`Creating SimplePay`);
    // const simplePay = await hre.ethers.getContractFactory(
    //   "SimplePay",
    // );
    // const simplePayContract = await simplePay
    //   .connect(signer)
    //   .deploy();
    // await simplePayContract.deployed();
    // console.log(`SimplePay deployed to: ${simplePayContract.address}`);

    // let simplePayContractsData = await load("SimplePayContracts");
    // simplePayContractsData[mintChain] = simplePayContract.address;

    console.log(`Creating DepositContract`);
    const depositContract = await hre.ethers.getContractFactory(
      "DepositContract",
    );
    const depositContractContract = await depositContract
      .connect(signer)
      .deploy();
    await depositContractContract.deployed();
    console.log(`DepositContract deployed to: ${depositContractContract.address}`);

    let depositContractsData = await load("DepositContracts");

    depositContractsData[mintChain] = depositContractContract.address;

    await (
      await depositFactoryContract
        .connect(signer)
        .setMasterDepositContractAddress(depositContractContract.address)
    ).wait();

    // await (
    //   await depositFactoryContract
    //     .connect(signer)
    //     .setMasterPayContractAddress(simplePayContract.address)
    // ).wait();

    await save("DepositContracts", depositContractsData);
    // await save("SimplePayContracts", simplePayContractsData);

    process.exit(0);
  } catch (e) {
    console.log(e);
  }

  // 2. ReceiveFactoryContract
  // console.log("------ ReceiveFactoryContract ------");
  // try {
  //   if (hre.network.name !== mintChain) {
  //     await hre.changeNetwork(mintChain);
  //     console.log(`Deployer: switched on ${mintChain}`);
  //   }

  //   const receiveFactoryContractAddress = (
  //     await load("ReceiveFactoryContracts")
  //   )[mintChain];

  //   const receiveFactoryContract = (await hre.ethers.getContractAt(
  //     "ReceiveFactoryContract",
  //     receiveFactoryContractAddress
  //   )) as ReceiveFactoryContract;

  //   console.log(receiveFactoryContractAddress);

  //   const txResult = await (await receiveFactoryContract
	// 		.connect(signer)
	// 		.setupValidatorRole(
  //       sellerAddress
  //     )
  //   ).wait();

  //   console.log("txResult", txResult);


  // } catch (e) {
  //   console.log(e);
  // }
};