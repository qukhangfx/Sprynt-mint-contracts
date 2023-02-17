import hre from "hardhat";
import { ethers } from 'hardhat'
import { load } from "./utils"

import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const marketplaceAddress = (await load('GBMarketplace')).address;

    const contractAddress = (await load('GB721Contract')).address
    console.log(contractAddress)
    await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [
            "Givabit ERC-721Contract",
            "GBC",
            marketplaceAddress
        ],
    });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});