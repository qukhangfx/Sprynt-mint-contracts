import { ethers } from 'hardhat'
import { load, save } from "../utils"

import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const marketplaceAddress = (await load('GBMarketplace')).address;

    const factory = await ethers.getContractFactory("GB721Contract");
    const contract = await factory.deploy(
        "Givabit ERC-721Contract",
        "GBC",
        marketplaceAddress
    );
    await contract.deployed();
    console.log("GB721Contract deployed to:", contract.address);
    await save('GB721Contract', {
        address: contract.address
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});