import { Contract } from "ethers";
import layerzeroConfig from "../constants/layerzeroConfig.json";
import { load, save } from "../utils";


import {
    DepositFactoryContract,
    ReceiveFactoryContract,
    SimplePay,
    DepositContract,
    ERC1155Contract,
} from "../typechain-types";

const EMPTY_ADDRESS: string = "0x0000000000000000000000000000000000000000";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function tryUntilSucceed(fn: any, maxTries: number = 4) {
    try {
        return await fn();
    } catch (e) {
        if (maxTries > 0) {
            return tryUntilSucceed(fn, maxTries - 1);
        }
        throw e;
    }
}

const usdc: any = {
    "polygonMumbai": '0xf75E983a2aa3BbB1671B7736d666689FAa712eFf',
    "sepolia": "0x7255F860Ab81C0b0B9D50f1f06cE88D5C6af7D40",
    "avalancheFujiTestnet": "0xE007e03cB091f81F34Cbb18667625D153cb8913D",
    "ftmTestnet": "0x06b193D42662B7a48641b31f9BAC9C06f48c019C",
    "bscTestnet": "0x7255f860ab81c0b0b9d50f1f06ce88d5c6af7d40",
    // Below are mainnet addresses
    "polygon": "",
    "bsc": "",
    "avalanche": "",
    "opera": "",
    "mainnet": "",
};

export const deployAll = async (taskArgs: any, hre: any) => {
    // const networks: string[] = ["sepolia", "avalancheFujiTestnet", "ftmTestnet", "bscTestnet"];

    const networks: string[] = ["mainnet"]; // "polygon", "bsc", "avalanche", "opera"

    // const networks: string[] = ["polygonMumbai"];

    let ContractAddresses = await load("ContractAddresses");

    for (let index = 0; index < networks.length; ++index) {
        const mintChain = networks[index];

        await hre.changeNetwork(mintChain);
        console.log(`Switched to ${mintChain}`);

        const [signer] = await hre.ethers.getSigners();
        console.log("Signer", signer.address);

        async function DeployDepositFactory() {
            console.log("Deploying DepositFactoryContract");

            const depositFactoryContract = await hre.ethers.getContractFactory(
                "DepositFactoryContract"
            );

            const depositFactoryContractInstance = await depositFactoryContract
                .connect(signer)
                .deploy(
                    signer.address,  // owner
                    signer.address, // adminWallet_
                    signer.address,// depositRoleAccount
                );
            await depositFactoryContractInstance.deployed();

            if (!ContractAddresses["DepositFactoryContract"]) {
                ContractAddresses["DepositFactoryContract"] = {};
            }
            ContractAddresses["DepositFactoryContract"][mintChain] = depositFactoryContractInstance.address;
            await save("ContractAddresses", ContractAddresses);

            console.log(
                "DepositFactoryContract deployed to:",
                depositFactoryContractInstance.address
            );
        }

        // await tryUntilSucceed(DeployDepositFactory);

        async function DeployReceiveFactory() {
            console.log("Deploying ReceiveFactoryContract");

            const receiveFactoryContract = await hre.ethers.getContractFactory(
                "ReceiveFactoryContract"
            );

            const receiveFactoryContractInstance = await receiveFactoryContract
                .connect(signer)
                .deploy();
            await receiveFactoryContractInstance.deployed();

            if (!ContractAddresses["ReceiveFactoryContract"]) {
                ContractAddresses["ReceiveFactoryContract"] = {};
            }
            ContractAddresses["ReceiveFactoryContract"][mintChain] = receiveFactoryContractInstance.address;
            await save("ContractAddresses", ContractAddresses);

            console.log(
                "ReceiveFactoryContract deployed to:",
                receiveFactoryContractInstance.address
            );
        }

        // await tryUntilSucceed(DeployReceiveFactory);

        async function DeployDeposit() {
            console.log("Deploying DepositContract");

            const depositContract = await hre.ethers.getContractFactory(
                "DepositContract"
            );

            const depositContractInstance = await depositContract
                .connect(signer)
                .deploy();
            await depositContractInstance.deployed();

            if (!ContractAddresses["DepositContract"]) {
                ContractAddresses["DepositContract"] = {};
            }
            ContractAddresses["DepositContract"][mintChain] = depositContractInstance.address;
            await save("ContractAddresses", ContractAddresses);

            console.log(
                "DepositContract deployed to:",
                depositContractInstance.address
            );
        }

        await tryUntilSucceed(DeployDeposit);

        async function DeploySimplePay() {
            console.log("Deploying SimplePayContract");

            const simplePayContract = await hre.ethers.getContractFactory(
                "SimplePay"
            );

            const simplePayContractInstance = await simplePayContract
                .connect(signer)
                .deploy();
            await simplePayContractInstance.deployed();

            if (!ContractAddresses["SimplePayContract"]) {
                ContractAddresses["SimplePayContract"] = {};
            }
            ContractAddresses["SimplePayContract"][mintChain] = simplePayContractInstance.address;
            await save("ContractAddresses", ContractAddresses);

            console.log(
                "SimplePayContract deployed to:",
                simplePayContractInstance.address
            );
        }

        // await tryUntilSucceed(DeploySimplePay);

        async function DeployRPaymentContract() {
            console.log("Deploying RPaymentContract");

            const rPaymentContract = await hre.ethers.getContractFactory(
                "RPaymentContract"
            );

            const rPaymentContractInstance = await rPaymentContract
                .connect(signer)
                .deploy(
                    usdc[mintChain],
                    ContractAddresses["DepositFactoryContract"][mintChain],
                );
            await rPaymentContractInstance.deployed();

            if (!ContractAddresses["RPaymentContract"]) {
                ContractAddresses["RPaymentContract"] = {};
            }
            ContractAddresses["RPaymentContract"][mintChain] = rPaymentContractInstance.address;
            await save("ContractAddresses", ContractAddresses);

            console.log(
                "RPaymentContract deployed to:",
                rPaymentContractInstance.address
            );
        }

        // await tryUntilSucceed(DeployRPaymentContract);

        async function DeployERC1155() {
            console.log("Deploying ERC1155Contract");

            const erc1155Contract = await hre.ethers.getContractFactory(
                "ERC1155Contract"
            );

            const erc1155ContractInstance = await erc1155Contract
                .connect(signer)
                .deploy();
            await erc1155ContractInstance.deployed();

            if (!ContractAddresses["ERC1155Contract"]) {
                ContractAddresses["ERC1155Contract"] = {};
            }
            ContractAddresses["ERC1155Contract"][mintChain] = erc1155ContractInstance.address;
            await save("ContractAddresses", ContractAddresses);

            console.log(
                "ERC1155Contract deployed to:",
                erc1155ContractInstance.address
            );
        }

        await tryUntilSucceed(DeployERC1155);
    }

    // for (let index = 0; index < networks.length; ++index) {
    //     const mintChain = networks[index];

    //     await hre.changeNetwork(mintChain);
    //     console.log(`Switched to ${mintChain}`);

    //     const [signer] = await hre.ethers.getSigners();

    //     async function Verify() {
    //         console.log("Verifying DepositFactoryContract");
    //         const depositFactoryContract = (await hre.ethers.getContractAt(
    //             "DepositFactoryContract",
    //             ContractAddresses["DepositFactoryContract"][mintChain]
    //         )) as DepositFactoryContract;

    //         try {
    //             await hre.run("verify:verify", {
    //                 address: depositFactoryContract.address,
    //                 constructorArguments: [
    //                     signer.address,
    //                     signer.address,
    //                     signer.address,
    //                 ],
    //             });
    //         } catch (error) {
    //             console.log("Error verifying DepositFactoryContract")
    //             console.log(error);
    //         }

    //         console.log("Verifying ReceiveFactoryContract");
    //         const receiveFactoryContract = (await hre.ethers.getContractAt(
    //             "ReceiveFactoryContract",
    //             ContractAddresses["ReceiveFactoryContract"][mintChain]
    //         )) as ReceiveFactoryContract;

    //         try {
    //             await hre.run("verify:verify", {
    //                 address: receiveFactoryContract.address,
    //                 constructorArguments: [],
    //             });
    //         } catch (error) {
    //             console.log("Error verifying ReceiveFactoryContract")
    //             console.log(error);
    //         }

    //         console.log("Verifying DepositContract");
    //         const depositContract = (await hre.ethers.getContractAt(
    //             "DepositContract",
    //             ContractAddresses["DepositContract"][mintChain]
    //         )) as DepositContract;

    //         try {
    //             await hre.run("verify:verify", {
    //                 address: depositContract.address,
    //                 constructorArguments: [],
    //             });
    //         } catch (error) {
    //             console.log("Error verifying DepositContract")
    //             console.log(error);
    //         }

    //         console.log("Verifying SimplePayContract");
    //         const simplePayContract = (await hre.ethers.getContractAt(
    //             "SimplePay",
    //             ContractAddresses["SimplePayContract"][mintChain]
    //         )) as SimplePay;

    //         try {
    //             await hre.run("verify:verify", {
    //                 address: simplePayContract.address,
    //                 constructorArguments: [],
    //             });
    //         } catch (error) {
    //             console.log("Error verifying SimplePayContract")
    //             console.log(error);
    //         }

    //         console.log("Verifying RPaymentContract");
    //         const rPaymentContract = (await hre.ethers.getContractAt(
    //             "RPaymentContract",
    //             ContractAddresses["RPaymentContract"][mintChain]
    //         )) as SimplePay;

    //         try {
    //             await hre.run("verify:verify", {
    //                 address: rPaymentContract.address,
    //                 constructorArguments: [
    //                     usdc[mintChain],
    //                     ContractAddresses["DepositFactoryContract"][mintChain],
    //                 ],
    //             });
    //         } catch (error) {
    //             console.log("Error verifying RPaymentContract")
    //             console.log(error);
    //         }

    //         console.log("Verifying ERC1155Contract");
    //         const erc1155Contract = (await hre.ethers.getContractAt(
    //             "ERC1155Contract",
    //             ContractAddresses["ERC1155Contract"][mintChain]
    //         )) as ERC1155Contract;

    //         try {
    //             await hre.run("verify:verify", {
    //                 address: erc1155Contract.address,
    //                 constructorArguments: [],
    //             });
    //         } catch (error) {
    //             console.log("Error verifying ERC1155Contract")
    //             console.log(error);
    //         }
    //     }
    //     // await Verify();
    // }

    // await delay(5000);

    async function SetAllTrustRemotes() {
        for (const [srcNetworkName, sourceContractAddress] of Object.entries(
            ContractAddresses["DepositFactoryContract"]
        )) {
            if (hre.network.name !== srcNetworkName) {
                await hre.changeNetwork(srcNetworkName);
                console.log(`Switched on ${srcNetworkName}`);
            }

            const depositFactoryContract = (await hre.ethers.getContractAt(
                "DepositFactoryContract",
                sourceContractAddress
            )) as DepositFactoryContract;

            for (const [dstNetworkName, destContractAddress] of Object.entries(
                ContractAddresses["ReceiveFactoryContract"]
            )) {
                console.log(
                    `Set trust remote from ${srcNetworkName} to ${dstNetworkName}`
                );

                try {
                    await tryUntilSucceed(async () => {
                        await (
                            await depositFactoryContract.setTrustedRemote(
                                layerzeroConfig[dstNetworkName].chainId,
                                hre.ethers.utils.solidityPack(
                                    ["address", "address"],
                                    [destContractAddress, sourceContractAddress]
                                )
                            )
                        ).wait();
                    });
                } catch (e) {
                    console.log(e);
                }
            }
        }

        for (const [dstNetworkName, destContractAddress] of Object.entries(
            ContractAddresses["ReceiveFactoryContract"]
        )) {
            if (hre.network.name !== dstNetworkName) {
                await hre.changeNetwork(dstNetworkName);
                console.log(`Switched on ${dstNetworkName}`);
            }

            const receiveFactoryContract = (await hre.ethers.getContractAt(
                "ReceiveFactoryContract",
                destContractAddress
            )) as ReceiveFactoryContract;
            for (const [srcNetworkName, sourceContractAddress] of Object.entries(
                ContractAddresses["DepositFactoryContract"]
            )) {
                console.log(
                    `Set trust remote from ${dstNetworkName} to ${srcNetworkName}`
                );

                try {
                    await tryUntilSucceed(async () => {
                        await (
                            await receiveFactoryContract.setTrustedRemote(
                                layerzeroConfig[srcNetworkName].chainId,
                                hre.ethers.utils.solidityPack(
                                    ["address", "address"],
                                    [sourceContractAddress, destContractAddress]
                                )
                            )
                        ).wait();
                    });
                } catch (e) {
                    console.log(e);
                }
            }
        }
    }
    
    // await SetAllTrustRemotes();

    for (let index = 0; index < networks.length; ++index) {
        const mintChain = networks[index];

        await hre.changeNetwork(mintChain);
        console.log(`Switched to ${mintChain}`);

        const [signer] = await hre.ethers.getSigners();

        const depositFactoryContract = (await hre.ethers.getContractAt(
            "DepositFactoryContract",
            ContractAddresses["DepositFactoryContract"][mintChain]
        )) as DepositFactoryContract;

        const receiveFactoryContract = (await hre.ethers.getContractAt(
            "ReceiveFactoryContract",
            ContractAddresses["ReceiveFactoryContract"][mintChain]
        )) as ReceiveFactoryContract;

        // const depositContract = (await hre.ethers.getContractAt(
        //     "DepositContract",
        //     ContractAddresses["DepositContract"][mintChain]
        // )) as DepositContract;

        async function SetMasterDepositContractAddress() {
            console.log("Set Master Deposit Contract Address");

            const masterDepositContractAddress = ContractAddresses["DepositContract"][mintChain];

            await tryUntilSucceed(async () => {
                await (
                    await depositFactoryContract
                        .connect(signer)
                        .setMasterDepositContractAddress(
                            masterDepositContractAddress
                        )
                ).wait();
            }, 3);
        }
        await SetMasterDepositContractAddress();

        async function SetMasterPayContractAddress() {
            console.log("Set Master Pay Contract Address");

            const masterPayContractAddress = ContractAddresses["SimplePayContract"][mintChain];

            await tryUntilSucceed(async () => {
                await (
                    await depositFactoryContract
                        .connect(signer)
                        .setMasterPayContractAddress(
                            masterPayContractAddress
                        )
                ).wait();
            }, 3);
        }
        // await SetMasterPayContractAddress();

        async function SetMasterERC1155ContractAddress() {
            console.log("Set Master ERC1155 Contract Address");

            const masterERC1155ContractAddress = ContractAddresses["ERC1155Contract"][mintChain];

            await tryUntilSucceed(async () => {
                await (
                    await receiveFactoryContract
                        .connect(signer)
                        .setMasterNftContractAddress(
                            masterERC1155ContractAddress
                        )
                ).wait();
            }, 3);
        }
        await SetMasterERC1155ContractAddress();

        async function SetupValidatorRole() {
            console.log("Setup Validator Role");

            await tryUntilSucceed(async () => {
                await (
                    await depositFactoryContract
                        .connect(signer)
                        .setupValidatorRole(
                            signer.address
                        )
                ).wait();
            }, 3);

            await tryUntilSucceed(async () => {
                await (
                    await receiveFactoryContract
                        .connect(signer)
                        .setupValidatorRole(
                            signer.address
                        )
                ).wait();
            }, 3);
        }
        // await SetupValidatorRole();

        async function CreateNftContractBySeller() {
            console.log("Create Nft Contract By Seller");

            const tokenURI: string = "https://bafybeidyj2ases25wrcwyisxsbnfo6qe7oe4re5ql77uspoo6d33benknq.ipfs.nftstorage.link/{id}";

            const NftContract = await (
                await receiveFactoryContract
                    .createNftContractBySeller(tokenURI)
            ).wait();
            console.log("🚀 NftContract:", NftContract);
        }
        // await CreateNftContractBySeller();

        const currentTimestamp = Math.floor(Date.now() / 1000);
        const deadline = currentTimestamp + 60 * 60 * 24; // 24 hours

        async function CreateDepositContractBySeller() {
            console.log("Create Deposit Contract By Seller");

            const DepositContract = await (
                await depositFactoryContract
                    .connect(signer)
                    .createDepositContractBySeller(
                        signer.address,
                        EMPTY_ADDRESS,
                        layerzeroConfig[mintChain].chainId,
                        hre.ethers.utils.parseEther("0.0001"),
                        hre.ethers.utils.parseEther("0.0001"),
                        1,
                        3,
                        10,
                        deadline,
                        deadline,
                        [
                            signer.address,
                        ]
                    )
            ).wait();
            console.log("🚀 DepositContract:", DepositContract);
        }
        // await CreateDepositContractBySeller();

        async function CreatePayContractBySeller() {
            console.log("Create Pay Contract By Seller");

            const PayContract = await (
                await depositFactoryContract
                    .connect(signer)
                    .createPayContractBySeller(
                        3,
                        true,
                        [EMPTY_ADDRESS],
                        signer.address,
                        deadline,
                    )
            ).wait();
            console.log("🚀 PayContract:", PayContract);
        }
        // await CreatePayContractBySeller();

        async function SetupPlatformFeeMint() {
            console.log("Setup PlatformFeeMint");

            await tryUntilSucceed(async () => {
                await (
                    await depositFactoryContract
                        .connect(signer)
                        .setPlatformFeeMint(
                            signer.address
                        )
                ).wait();
            }, 3);
        }
        // await SetupPlatformFeeMint();
    }

    // 1. Deploy and verify Deposit Factory Contract
    // 2. Deploy and verify Receive Factory Contract
    // 3. Deploy and verify Deposit Contract
    // 4. Deploy and verify Pay Contract
    // 5. Deploy and verify ERC1155 Contract
    // 6. Set All Trust Remotes
    // 7. Set Master Deposit Contract Address
    // 8. Set Master Pay Contract Address
    // 9. Set Master ERC1155 Contract Address
    // 10. Setup Validator Role
    // 11. Create Nft Contract By Seller
    // 12. Create Deposit Contract By Seller
    // 13. Create Pay Contract By Seller
}