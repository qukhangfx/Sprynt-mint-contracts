import { load, save } from "../utils";
import { ReceiveFactoryContract } from "../typechain-types";

const tokenURI =
  "https://bafybeidyj2ases25wrcwyisxsbnfo6qe7oe4re5ql77uspoo6d33benknq.ipfs.nftstorage.link/";

export const deployChildContractsBySeller = async (taskArgs: any, hre: any) => {
  const mintChain: string = taskArgs.mchain;

  let nftMintContractsData = await load("NftMintContractsData");
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
    console.log(`Creating ERC1155NFTsContract to ${mintChain}`);
    const txResult = await (
      await receiveFactoryContract.createNftContractBySeller(tokenURI)
    ).wait();
    if (txResult.status == 1) {
      const events = txResult.events;
      if (events && events.length) {
        for (const eventObject of events) {
          if (eventObject.event == "CreatedNftContract") {
            const nftContractAddress = eventObject.args["nftContractAddress"];
            nftMintContractsData[mintChain] = {
              nftContract: nftContractAddress,
              factoryContract: receiveFactoryContractAddress,
              tokenURI,
            };
            console.log(`NftContract is deployed at: ${nftContractAddress}`);
            break;
          }
        }
      }
    }
  } catch (e) {
    console.log(e);
  }

  await save("NftMintContractsData", nftMintContractsData);
};
