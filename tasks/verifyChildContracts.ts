import { load, save } from "../utils";
import deployChains from "../constants/deployChains.json";
import usdcAddresses from "../constants/usdcAddresses.json";
import layerzeroConfig from "../constants/layerzeroConfig.json";
import { DepositFactoryContract, ReceiveFactoryContract } from "../typechain-types";

export const verifyChildContractsBySeller = async (taskArgs: any, hre: any) => {  
  let nftMintContractsData = await load('NftMintContractsData');
  console.log("Verifying NftContracts");
  const mintChain = Object.keys(nftMintContractsData)[0];
  const deploymentData = nftMintContractsData[mintChain];
  if (hre.network.name !== mintChain) {
    await hre.changeNetwork(mintChain);
    console.log(`Verifier: switched on ${mintChain}`);
  }
  
  // verify contract
  await hre.run("verify:verify", {
    address: deploymentData.nftContract,
    constructorArguments: [
      deploymentData.nftName,
      deploymentData.nftSymbol,
      deploymentData.tokenURI,
      deploymentData.totalSupply,
      deploymentData.factoryContract,
    ],
  });
}