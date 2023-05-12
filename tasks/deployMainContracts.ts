import { load, save } from "../utils";
import deployChains from "../constants/deployChains.json";
import usdcAddresses from "../constants/usdcAddresses.json";
import layerzeroConfig from "../constants/layerzeroConfig.json";

export const deployMainContractsByAdmin = async (taskArgs: any, hre: any) => {
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

  for (const networkName of networks) {
    if (hre.network.name !== networkName) {
      await hre.changeNetwork(networkName);
      console.log(`Deployer: switched on ${networkName}`);
    }

    // deploy contracts
    console.log(`Deploying DepositFactoryContract to ${networkName}`);
    const [signer] = await hre.ethers.getSigners();
    const depositFactory = await hre.ethers.getContractFactory(
      "DepositFactoryContract"
    );

    const depositFactoryContract = await depositFactory
      .connect(signer)
      .deploy(
        layerzeroConfig[networkName].lzEndpoint,
        usdcAddresses[networkName],
        ownerAccount,
        adminWalletAccount,
        depositRoleAccount
      );
    await depositFactoryContract.deployed();

    console.log(
      `DepositFactoryContract is deployed at: ${depositFactoryContract.address}`
    );

    depositFactoryContractData[networkName] = depositFactoryContract.address;

    console.log(`Deploying ReceiveFactoryContract to ${networkName}`);
    const receiveFactory = await hre.ethers.getContractFactory(
      "ReceiveFactoryContract"
    );

    const receiveFactoryContract = await receiveFactory
      .connect(signer)
      .deploy(layerzeroConfig[networkName].lzEndpoint);
    await receiveFactoryContract.deployed();

    console.log(
      `ReceiveFactoryContract is deployed at: ${receiveFactoryContract.address}`
    );

    receiveFactoryContractData[networkName] = receiveFactoryContract.address;
  }

  await save("DepositFactoryContracts", depositFactoryContractData);
  await save("ReceiveFactoryContracts", receiveFactoryContractData);
};
