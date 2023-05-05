import { load } from "../utils";

export const verifyChildContractsBySeller = async (taskArgs: any, hre: any) => {
  let nftMintContractsData = await load("NftMintContractsData");
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
      deploymentData.tokenURI,
      deploymentData.factoryContract,
    ],
  });
};
