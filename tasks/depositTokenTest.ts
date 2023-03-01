import { load, save } from "../utils";
import deployChains from "../constants/deployChains.json";
import usdcAddresses from "../constants/usdcAddresses.json";
import layerzeroConfig from "../constants/layerzeroConfig.json";
import { DepositFactoryContract, ERC20 } from "../typechain-types";
import { getBigNumber, signDepositItemData } from "../test/utils";
import { formatUnits } from "ethers/lib/utils";

export const depositTokenByClient = async (taskArgs: any, hre: any) => {
  try {
    const depositChain = taskArgs.dchain;
    const mintChain = taskArgs.mchain;
    const backendNonce = taskArgs.bnonce;

    const depositTokenDecimals = 6;
    const depositRolePK = process.env.DEPOSIT_ROLE_PK || "";
    const DEPOSIT_CHAIN_RPC_URL = process.env.TEST_ETH_RPC_URL || "";
  
    let depositFactoryContractData = await load('DepositFactoryContracts');
    
    if (hre.network.name !== depositChain) {
      await hre.changeNetwork(depositChain);
      console.log(`Test: switched on ${depositChain}`);
    }
  
    const [signer] = await hre.ethers.getSigners();
    const signerAddress = await signer.getAddress();
    const ethProvider = await new hre.ethers.providers.JsonRpcProvider(DEPOSIT_CHAIN_RPC_URL);
    let depositRoleAccount = new hre.ethers.Wallet(depositRolePK, ethProvider);
    let depositFactoryContractAddress = depositFactoryContractData[depositChain];
    const depositFactoryContract = (
      await hre.ethers.getContractAt(
        'DepositFactoryContract', 
        depositFactoryContractAddress
        )
      ) as DepositFactoryContract;
      const latestBlock = await ethProvider.getBlock("latest");
      const startedAt = latestBlock.timestamp;
      const deadline = startedAt + 10 * 60;
      const depositItemData = {
        // mintPrice: getBigNumber(1000, depositTokenDecimals),
        mintPrice: getBigNumber(5),
        mintQuantity: 5,
        sellerAddress: signerAddress,
        dstChainId: layerzeroConfig[mintChain].chainId,
        isMintAvailable: true,
        nonce: backendNonce,
        deadline: deadline,
      };
      const {['nonce']: nonce, ...depositItem} = depositItemData;
      const signature = signDepositItemData(
        depositItemData,
        depositFactoryContract,
        depositRoleAccount
      );
      let adapterParams = hre.ethers.utils.solidityPack(['uint16', 'uint256'], [1, 2000000])
      const _payload = hre.ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'address'],
        [signerAddress, depositItemData.mintQuantity, depositItemData.sellerAddress]
        // [ethers.constants.AddressZero, 0, ethers.constants.AddressZero]
      )
      const estimatedFee = await depositFactoryContract.estimateFee(layerzeroConfig[mintChain].chainId, false, adapterParams)
      console.log('estimateFee is: ', formatUnits(estimatedFee.nativeFee))
      await (
        await depositFactoryContract
        .connect(signer)
        .depositTokenByClient(
          depositItem,
          signature,
          estimatedFee.nativeFee,
          true,
          {value: estimatedFee.nativeFee.add(depositItemData.mintPrice) }
        )
      ).wait();
      // await testTokenContract.connect(signer).approve(
      //   depositFactoryContract.address, 
      //   depositItemData.mintPrice
      // );
  } catch(e) {
    console.log(e);
  }
  
  
}