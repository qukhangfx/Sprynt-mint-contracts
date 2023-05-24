import { load, save } from "../utils";
import {
  DepositFactoryContract,
  ReceiveFactoryContract,
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

  const MINT_CHAIN_RPC_URL = process.env.TEST_ETH_RPC_URL || "";

  const sellerAddress = process.env.SELLER_ADDRESS || "";
  const sellerPk = process.env.SELLER_PK || "";
  const ethProvider = await new hre.ethers.providers.JsonRpcProvider(
    MINT_CHAIN_RPC_URL
  );
  let seller = new hre.ethers.Wallet(sellerPk, ethProvider);

  let nftMintContractsData = await load("NftMintContractsData");

  const network_environment = taskArgs.e;
  const depositChains = deployChains[network_environment];

  const depositTokenDecimals = 6;

  let receiveFactoryContractData = await load("ReceiveFactoryContracts");
  let depositFactoryContractData = await load("DepositFactoryContracts");
  let depositContractData = await load("DepositContracts");

  try {
    if (hre.network.name !== mintChain) {
      await hre.changeNetwork(mintChain);
      console.log(`Deployer: switched on ${mintChain}`);
    }

    const receiveFactoryContractAddress = (
      await load("ReceiveFactoryContracts")
    )[mintChain];

    const receiveFactoryContract = (await hre.ethers.getContractAt(
      "ReceiveFactoryContract",
      receiveFactoryContractAddress
    )) as ReceiveFactoryContract;

    // console.log(`Creating ERC1155NFTsContract to ${mintChain}`);

    // const txResult = await (
    //   await receiveFactoryContract
    //     .connect(seller)
    //     .createNftContractBySeller(tokenURI)
    // ).wait();

    // if (txResult.status == 1) {
    //   const events = txResult.events;
    //   if (events && events.length) {
    //     for (const eventObject of events) {
    //       if (eventObject.event == "CreatedNftContract") {
    //         const nftContractAddress = eventObject.args["nftContractAddress"];
    //         nftMintContractsData[mintChain] = {
    //           nftContract: nftContractAddress,
    //           factoryContract: receiveFactoryContractAddress,
    //           tokenURI,
    //         };
    //         console.log(`NftContract is deployed at: ${nftContractAddress}`);
    //         break;
    //       }
    //     }
    //   }
    // }

    for (const depositChain of depositChains) {
      if (hre.network.name !== mintChain) {
        await hre.changeNetwork(mintChain);
        console.log(`Deployer: switched on ${mintChain}`);
      }

      console.log(`Creating DepositContract to ${depositChain}`);

      const latestBlock = await ethProvider.getBlock("latest");
      const startedAt = latestBlock.timestamp;
      const deadline = startedAt + 10 * 60;

      let adapterParams = hre.ethers.utils.solidityPack(
        ["uint16", "uint256"],
        [1, 899_000]
      );

      const maxAcceptValue = 3;
      const encodedPayload = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "bool", "address"],
        [maxAcceptValue, true, usdcAddresses[depositChain]]
      );

      const gasFee = await receiveFactoryContract.estimateFee(
        layerzeroConfig[depositChain].chainId,
        false,
        adapterParams,
        encodedPayload
      );

      let payContractCreation = await (
        await receiveFactoryContract
          .connect(seller)
          .createPayContractBySeller(
            maxAcceptValue,
            true,
            usdcAddresses[depositChain],
            layerzeroConfig[depositChain].chainId,
            adapterParams,
            { value: gasFee.nativeFee }
          )
      ).wait();

      if (payContractCreation.status == 1) {
        const events = payContractCreation.events;
        if (events && events.length) {
          for (const eventObject of events) {
            if (eventObject.event == "SimplePayContractCreated") {
              const payContractAddress = eventObject.args["simplePayContractAddress"];
              console.log(`Pay Contract is deployed at: ${payContractAddress}`);
              break;
            }
          }
        }
      }
      // if (hre.network.name !== depositChain) {
      //   await hre.changeNetwork(depositChain);
      //   console.log(`Deployer: switched on ${depositChain}`);
      // }

      // let depositFactoryContractAddress =
      //   depositFactoryContractData[depositChain];

      // let depositFactoryContract = (await hre.ethers.getContractAt(
      //   "DepositFactoryContract",
      //   depositFactoryContractAddress
      // )) as DepositFactoryContract;

      // let depositContractAddress =
      //   await depositFactoryContract.getLatestDepositContract();

      // console.log(
      //   `depositContractAddress on ${depositChain} is: `,
      //   depositContractAddress
      // );

      // depositContractData[depositChain] = depositContractAddress;
    }
  } catch (e) {
    console.log(e);
  }

  // await save("DepositContracts", depositContractData);
  // await save("NftMintContractsData", nftMintContractsData);
};
