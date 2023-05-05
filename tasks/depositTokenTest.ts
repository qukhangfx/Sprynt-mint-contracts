import { load } from "../utils";
import layerzeroConfig from "../constants/layerzeroConfig.json";
import usdcAddresses from "../constants/usdcAddresses.json";
import NftMintContractsData from "../addresses/NftMintContractsData.json";
import {
  DepositFactoryContract,
  DepositContract,
  ERC1155,
} from "../typechain-types";
import { getBigNumber, signDepositItemData } from "../test/utils";
import { formatUnits } from "ethers/lib/utils";

export const depositTokenByClient = async (taskArgs: any, hre: any) => {
  try {
    const depositChain = taskArgs.dchain;
    const mintChain = taskArgs.mchain;
    const backendNonce = 0;

    const depositTokenDecimals = 6;
    const depositRolePK = process.env.DEPOSIT_ROLE_PK || "";
    const DEPOSIT_CHAIN_RPC_URL = process.env.TEST_ETH_RPC_URL || "";

    let depositFactoryContractData = await load("DepositFactoryContracts");

    if (hre.network.name !== depositChain) {
      await hre.changeNetwork(depositChain);
      console.log(`Test: switched on ${depositChain}`);
    }

    const [signer] = await hre.ethers.getSigners();
    const signerAddress = await signer.getAddress();
    const ethProvider = await new hre.ethers.providers.JsonRpcProvider(
      DEPOSIT_CHAIN_RPC_URL
    );
    let depositRoleAccount = new hre.ethers.Wallet(depositRolePK, ethProvider);
    let depositFactoryContractAddress =
      depositFactoryContractData[depositChain];
    const depositFactoryContract = (await hre.ethers.getContractAt(
      "DepositFactoryContract",
      depositFactoryContractAddress
    )) as DepositFactoryContract;
    const latestBlock = await ethProvider.getBlock("latest");
    const startedAt = latestBlock.timestamp;
    const deadline = startedAt + 10 * 60;
    const depositItemData = {
      // mintPrice: getBigNumber(1000, depositTokenDecimals),
      mintPrice: getBigNumber(1),
      mintQuantity: 10,
      sellerAddress: signerAddress,
      dstChainId: layerzeroConfig[mintChain].chainId,
      isMintAvailable: true,
      nonce: backendNonce,
      deadline: deadline,
    };
    const { ["nonce"]: nonce, ...depositItem } = depositItemData;
    const signature = signDepositItemData(
      depositItemData,
      depositFactoryContract,
      depositRoleAccount
    );
    let adapterParams = hre.ethers.utils.solidityPack(
      ["uint16", "uint256"],
      [1, 2000000]
    );
    const estimatedFee = await depositFactoryContract.estimateFee(
      layerzeroConfig[mintChain].chainId,
      false,
      adapterParams
    );
    console.log("estimateFee is: ", formatUnits(estimatedFee.nativeFee));
    let masterDepositContractAddress = await (
      await depositFactoryContract.createNewDepositContract(
        signerAddress,
        usdcAddresses[depositChain],
        layerzeroConfig[mintChain].chainId,
        // getBigNumber(1000, depositTokenDecimals),
        // getBigNumber(1000, depositTokenDecimals),
        getBigNumber(1),
        getBigNumber(1),
        1,
        100,
        10,
        deadline
      )
    ).wait();
    masterDepositContractAddress =
      masterDepositContractAddress.events[0].args.masterDepositContractAddress;
    const depositContract = (await hre.ethers.getContractAt(
      "DepositContract",
      masterDepositContractAddress
    )) as DepositContract;

    await (
      await depositContract
        .connect(signer)
        .mint(depositItem, signature, estimatedFee.nativeFee, true, {
          value: estimatedFee.nativeFee.add(depositItemData.mintPrice),
        })
    ).wait();
  } catch (e) {
    console.log(e);
  }
};
