import hre from 'hardhat'
import { Deployer } from "./Deployer";
import { load, save } from "../utils";
import deployChains from "../constants/deployChains.json";
import usdcAddresses from "../constants/usdcAddresses.json";
import layerzeroConfig from "../constants/layerzeroConfig.json";

async function main() {
  const networks = deployChains["testnet"]
  const deployer = new Deployer();
  const ownerAccount = process.env.OWNER_ADDRESS || "";
  const adminWalletAccount = process.env.ADMIN_WALLET_ADDRESS || "";
  const depositRoleAccount = process.env.DEPOSIT_ROLE_ACCOUNT || "";
  let depositFactoryContractData = {};
  let receiveFactoryContractData = {};
  const factory = await hre.ethers.getContractFactory("DepositFactoryContract");
  const contract = await factory.deploy(
    usdcAddresses["goerli"],
    ownerAccount, 
    adminWalletAccount,
    depositRoleAccount,
  );
  await contract.deployed();
  console.log(contract.address)
  // await Promise.all(
  //   networks.map(async (network: string) => {
  //     deployer.switchNetwork(network);
  //     const networkName = hre.network.name;

  //     console.log(
  //       `Deploying DepositFactoryContract to ${network}`
  //     );
  //     const depositFactoryContract = await deployer.deploy(
  //       "DepositFactoryContract",
  //       [
  //         usdcAddresses[network], 
  //         ownerAccount, 
  //         adminWalletAccount,
  //         depositRoleAccount,
  //       ]
  //     );

  //     depositFactoryContractData[networkName] = depositFactoryContract.address;

  //     console.log(
  //       `Deploying ReceiveFactoryContract to ${network}`
  //     );
  //     const receiveFactoryContract = await deployer.deploy(
  //       "ReceiveFactoryContract",
  //       [
  //         layerzeroConfig[network].lzEndpoint
  //       ]
  //     );

  //     receiveFactoryContractData[networkName] = receiveFactoryContract.address;
  //   })
  // )
  // await save('DepositFactoryContracts', depositFactoryContractData);
  // await save('ReceiveFactoryContracts', receiveFactoryContractData);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});