import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumberish, Contract } from "ethers";
import { parseUnits } from "ethers/lib/utils";
const { BigNumber } = require("ethers");

// Defaults to e18 using amount * 10^18
export function getBigNumber(amount: number | string, decimals = 18) {
  return parseUnits(amount.toString(), decimals);
}

const POLARYS_DEPOSIT_CONTRACT_NAME = "DepositFactoryContract";
const POLARYS_DEPOSIT_CONTRACT_VERSION = "1.0.0";
const DEPOSIT_ITEM_DATA_TYPE = {
  DepositItem: [
    { name: "mintPrice", type: "uint256" },
    { name: "mintQuantity", type: "uint256" },
    { name: "sellerAddress", type: "address" },
    { name: "nonce", type: "uint256" },
  ],
};

export type DepositItemData = {
  mintPrice: BigNumberish;
  mintQuantity: BigNumberish;
  sellerAddress: BigNumberish;
};

export async function signDepositItemData(
  depositItemData: Object,
  depositContract: Contract,
  signer: SignerWithAddress
): Promise<string> {
  const domain = {
    name: POLARYS_DEPOSIT_CONTRACT_NAME,
    version: POLARYS_DEPOSIT_CONTRACT_VERSION,
    chainId: await signer.getChainId(),
    verifyingContract: depositContract.address,
  };
  return await signer._signTypedData(
    domain,
    DEPOSIT_ITEM_DATA_TYPE,
    depositItemData
  );
}
