import { load } from "../utils";
import deployChains from "../constants/deployChains.json";
import usdcAddresses from "../constants/usdcAddresses.json";
import layerzeroConfig from "../constants/layerzeroConfig.json";

export const verifyMainContractsByAdmin = async (taskArgs: any, hre: any) => {
  const network_environment = taskArgs.e;
  const networks = deployChains[network_environment];
  if (!taskArgs.e || networks.length === 0) {
    console.log(`Invalid environment argument: ${taskArgs.e}`);
  }
  const ownerAccount = process.env.OWNER_ADDRESS || "";
  const adminWalletAccount = process.env.ADMIN_WALLET_ADDRESS || "";
  const depositRoleAccount = process.env.DEPOSIT_ROLE_ACCOUNT || "";
  let depositFactoryContractData = await load("DepositFactoryContracts");
  let receiveFactoryContractData = await load("ReceiveFactoryContracts");

  console.log("Verifying DepositFactoryContracts");
  for (const [networkName, contractAddress] of Object.entries(
    depositFactoryContractData
  )) {
    if (hre.network.name !== networkName) {
      await hre.changeNetwork(networkName);
      console.log(`Verifier: switched on ${networkName}`);
    }

    // verify contracts
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [
        layerzeroConfig[networkName].lzEndpoint,
        ownerAccount,
        adminWalletAccount,
        depositRoleAccount,
      ],
    });
  }

  console.log("Verifying ReceiveFactoryContracts");
  for (const [networkName, contractAddress] of Object.entries(
    receiveFactoryContractData
  )) {
    if (hre.network.name !== networkName) {
      await hre.changeNetwork(networkName);
      console.log(`Verifier: switched on ${networkName}`);
    }

    // verify contracts
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [layerzeroConfig[networkName].lzEndpoint],
    });
  }
};
