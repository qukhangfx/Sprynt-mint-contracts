import { load, save } from "../utils";
import layerzeroConfig from "../constants/layerzeroConfig.json";
import usdcAddresses from "../constants/usdcAddresses.json";
import { DepositFactoryContract, DepositContract } from "../typechain-types";
import deployChains from "../constants/deployChains.json";
import { getBigNumber, signDepositItemData } from "../test/utils";
import { formatUnits } from "ethers/lib/utils";

export const depositTokenByClient = async (taskArgs: any, hre: any) => {
  try {
    const depositChainTarget = taskArgs.dchain;

    const mintChain = taskArgs.mchain;
    const backendNonce = 0;

    const depositTokenDecimals = 6;

    const depositRolePK = process.env.DEPOSIT_ROLE_PK || "";

    const sellerAddress = process.env.SELLER_ADDRESS || "";

    const DEPOSIT_CHAIN_RPC_URL = process.env.TEST_ETH_RPC_URL || "";

    const ethDepositProvider = await new hre.ethers.providers.JsonRpcProvider(
      DEPOSIT_CHAIN_RPC_URL
    );

    let depositRoleAccount = new hre.ethers.Wallet(
      depositRolePK,
      ethDepositProvider
    );

    let depositFactoryContractData = await load("DepositFactoryContracts");
    let depositContractData = await load("DepositContracts");

    const depositContractAddress = depositContractData[depositChainTarget];

    const depositContract = (await hre.ethers.getContractAt(
      "DepositContract",
      depositContractAddress
    )) as DepositContract;

    let depositFactoryContractAddress =
      depositFactoryContractData[depositChainTarget];

    const depositFactoryContract = (await hre.ethers.getContractAt(
      "DepositFactoryContract",
      depositFactoryContractAddress
    )) as DepositFactoryContract;

    const depositItemData = {
      mintPrice: getBigNumber(1, depositTokenDecimals),
      mintQuantity: 4,
      sellerAddress: sellerAddress,
      dstChainId: layerzeroConfig[mintChain].chainId,
      isMintAvailable: true,
      nonce: backendNonce,
      deadline: depositContract.deadline,
    };
    const { ["nonce"]: nonce, ...depositItem } = depositItemData;

    const signature = signDepositItemData(
      depositItemData,
      depositFactoryContract,
      depositRoleAccount
    );

    let adapterParams = hre.ethers.utils.solidityPack(
      ["uint16", "uint256"],
      [1, 1_000_000]
    );

    const estimatedFee = await depositFactoryContract.estimateFee(
      layerzeroConfig[mintChain].chainId,
      false,
      adapterParams,
      depositItem
    );
    console.log("estimateFee is: ", formatUnits(estimatedFee.nativeFee));

    const mintTransaction = await (
      await depositContract
        .connect(depositRoleAccount)
        .mint(depositItem, signature, estimatedFee.nativeFee, false, {
          value: estimatedFee.nativeFee,
        })
    ).wait();

    console.log(mintTransaction);
  } catch (e) {
    console.log(e);
  }
};
