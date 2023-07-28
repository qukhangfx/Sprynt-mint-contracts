import { Deployer } from "./Deployer";
import { save } from "../utils";
import deployChains from "../constants/deployChains.json";
import usdcAddresses from "../constants/usdcAddresses.json";
import layerzeroConfig from "../constants/layerzeroConfig.json";

export const deployMainContracts = async (taskArgs: any, hre: any) => {
  const networks = deployChains[taskArgs.e];
  if (!taskArgs.e || networks.length === 0) {
    console.log(`Invalid environment argument: ${taskArgs.e}`);
  }
  const deployer = new Deployer();
  const ownerAccount = process.env.OWNER_ADDRESS || "";
  const adminWalletAccount = process.env.ADMIN_WALLET_ADDRESS || "";
  const depositRoleAccount = process.env.DEPOSIT_ROLE_ACCOUNT || "";
  let depositFactoryContractData = {};
  let receiveFactoryContractData = {};
  await Promise.all(
    networks.map(async (network: string) => {
      if (hre.network.name !== network) {
        await hre.changeNetwork(network);
        console.log(`Deployer: switched on ${network}`);
      }
      const networkName = hre.network.name;
      console.log(networkName, network);

      console.log(`Deploying DepositFactoryContract to ${network}`);
      const depositFactoryContract = await deployer.deploy(
        "DepositFactoryContract",
        [
          usdcAddresses[network],
          ownerAccount,
          adminWalletAccount,
          depositRoleAccount,
        ]
      );

      depositFactoryContractData[networkName] = depositFactoryContract.address;

      console.log(`Deploying ReceiveFactoryContract to ${network}`);
      const receiveFactoryContract = await deployer.deploy(
        "ReceiveFactoryContract",
        []
      );

      receiveFactoryContractData[networkName] = receiveFactoryContract.address;

      console.log("depositFactoryContractData", depositFactoryContract.address);
      console.log("receiveFactoryContractData", receiveFactoryContract.address);
    })
  );

  await save("DepositFactoryContracts", depositFactoryContractData);
  await save("ReceiveFactoryContracts", receiveFactoryContractData);
};
