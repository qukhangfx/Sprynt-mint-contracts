import { load, save } from "../utils";
import deployChains from "../constants/deployChains.json";
import usdcAddresses from "../constants/usdcAddresses.json";
import layerzeroConfig from "../constants/layerzeroConfig.json";
import { DepositFactoryContract } from "../typechain-types";

export const deployChildContractsBySeller = async (taskArgs: any, hre: any) => {
  const sendChains:string[] = (taskArgs.schains).split(",");
  const mintChain:string = taskArgs.dchain
  
  let lzSendContractsData = await load('LzSendContractsData');
  let nftMintContractsData = await load('NftMintContractsData');
  for(const sendChain of sendChains) {
    try {
      if (hre.network.name !== sendChain) {
        await hre.changeNetwork(sendChain);
        console.log(`Deployer: switched on ${sendChain}`);
      }
      
      const depositFactoryContractAddress = (await load('DepositFactoryContracts'))[sendChain];
      const receiveFactoryContractAddress = (await load('ReceiveFactoryContracts'))[mintChain];
      const depositFactoryContract = (
        await hre.ethers.getContractAt(
          'DepositFactoryContract', 
          depositFactoryContractAddress
          )
        ) as DepositFactoryContract;
      console.log(`Creating LzSendContract to ${sendChain}`);
      const tx = await depositFactoryContract.createLZsenderContractBySeller(
        layerzeroConfig[sendChain].lzEndpoint,
        receiveFactoryContractAddress,
        layerzeroConfig[mintChain].chainId,
      );
      const txResult = await(tx).wait();
      console.log(txResult);
    } catch (e) {
      console.log(e);
      continue;
    }
  }
  
  // await save('DepositFactoryContracts', depositFactoryContractData);
  // await save('ReceiveFactoryContracts', receiveFactoryContractData);
}