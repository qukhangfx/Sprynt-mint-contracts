import { load } from "../utils";
import layerzeroConfig from "../constants/layerzeroConfig.json";
import {
  DepositFactoryContract,
  ReceiveFactoryContract,
} from "../typechain-types";

export const setAllTrustRemotes = async (taskArgs: any, hre: any) => {
  let depositFactoryContractData = await load("DepositFactoryContracts");
  let receiveFactoryContractData = await load("ReceiveFactoryContracts");

  // set trustRemote from source to dest chains
  console.log("set trustRemote from source to dest chains");
  for (const [srcNetworkName, sourceContractAddress] of Object.entries(
    depositFactoryContractData
  )) {
    if (hre.network.name !== srcNetworkName) {
      await hre.changeNetwork(srcNetworkName);
      console.log(`setAllTrustRemote: switched on ${srcNetworkName}`);
    }

    const depositFactoryContract = (await hre.ethers.getContractAt(
      "DepositFactoryContract",
      sourceContractAddress
    )) as DepositFactoryContract;

    for (const [dstNetworkName, destContractAddress] of Object.entries(
      receiveFactoryContractData
    )) {
      console.log(
        `Set trustRemote from ${srcNetworkName} to ${dstNetworkName}`
      );
      await (
        await depositFactoryContract.setTrustedRemote(
          layerzeroConfig[dstNetworkName].chainId,
          hre.ethers.utils.solidityPack(
            ["address", "address"],
            [destContractAddress, sourceContractAddress]
          )
        )
      ).wait();
    }
  }

  // set trustRemote from dest to source chains
  console.log("set trustRemote from dest to source chains");
  for (const [dstNetworkName, destContractAddress] of Object.entries(
    receiveFactoryContractData
  )) {
    if (hre.network.name !== dstNetworkName) {
      await hre.changeNetwork(dstNetworkName);
      console.log(`setAllTrustRemote: switched on ${dstNetworkName}`);
    }

    const receiveFactoryContract = (await hre.ethers.getContractAt(
      "ReceiveFactoryContract",
      destContractAddress
    )) as ReceiveFactoryContract;
    for (const [srcNetworkName, sourceContractAddress] of Object.entries(
      depositFactoryContractData
    )) {
      console.log(
        `Set trustRemote from ${dstNetworkName} to ${srcNetworkName}`
      );
      await (
        await receiveFactoryContract.setTrustedRemote(
          layerzeroConfig[srcNetworkName].chainId,
          hre.ethers.utils.solidityPack(
            ["address", "address"],
            [sourceContractAddress, destContractAddress]
          )
        )
      ).wait();
    }
  }
};
