import layerzeroConfig from "../constants/layerzeroConfig.json";
import { load, save } from "../utils";


import {
    DepositFactoryContract,
    ReceiveFactoryContract,
    SimplePay,
    DepositContract,
    ERC1155Contract,
    ChainLinkPriceFeed,
    RPaymentContract,
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
    "polygon": "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    "bsc": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    "avalanche": "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
    "opera": "0x04068da6c83afcfa0e13ba15a6696662335d5b75",
    "mainnet": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
};

const nativeTokenPriceFeedAddress: any = {
    "polygon": "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
    "bsc": "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
    "avalanche": "0x0A77230d17318075983913bC2145DB16C7366156",
    "opera": "0xf4766552D15AE4d256Ad41B6cf2933482B0680dc",
    "mainnet": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",

    "avalancheFujiTestnet": "0x5498BB86BC934c8D34FDA08E81D444153d0D06aD",
    "polygonMumbai": "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada",
    "bscTestnet": "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526",
    "ftmTestnet": "0xe04676B9A9A2973BCb0D1478b5E1E9098BBB7f3D",
    "sepolia": "0x694AA1769357215DE4FAC081bf1f309aDC325306",
};

export const deployAll = async (taskArgs: any, hre: any) => {
    // const networks: string[] = ["sepolia", "avalancheFujiTestnet", "ftmTestnet", "bscTestnet"];
    // const networks: string[] = ["mainnet"]; // "polygon", "bsc", "avalanche", "opera", 
    // "arbitrumGoerli", "arbitrumOne"
    // const networks: string[] = ["polygonMumbai", "sepolia", "avalancheFujiTestnet", "ftmTestnet", "bscTestnet"];
    const networks: string[] = ["polygon"];

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

        // await tryUntilSucceed(DeployDeposit);

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

        async function DeployPriceFeedContract() {
            console.log("Deploying ChainLinkPriceFeed");

            const priceFeedContract = await hre.ethers.getContractFactory(
                "ChainLinkPriceFeed"
            );

            const priceFeedContractInstance = await priceFeedContract
                .connect(signer)
                .deploy(
                    nativeTokenPriceFeedAddress[mintChain],
                );
            await priceFeedContractInstance.deployed();

            if (!ContractAddresses["PriceFeedContract"]) {
                ContractAddresses["PriceFeedContract"] = {};
            }
            ContractAddresses["PriceFeedContract"][mintChain] = priceFeedContractInstance.address;
            await save("ContractAddresses", ContractAddresses);

            console.log(
                "PriceFeedContract deployed to:",
                priceFeedContractInstance.address
            );
        }

        // await tryUntilSucceed(DeployPriceFeedContract);

        async function DeployRPaymentContract() {
            console.log("Deploying RPaymentContract");

            const rPaymentContract = await hre.ethers.getContractFactory(
                "RPaymentContract"
            );

            const rPaymentContractInstance = await rPaymentContract
                .connect(signer)
                .deploy(
                    [usdc[mintChain], EMPTY_ADDRESS],
                    ContractAddresses["DepositFactoryContract"][mintChain],
                    ContractAddresses["PriceFeedContract"][mintChain],
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

        // await tryUntilSucceed(DeployERC1155);
    }

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
        // await SetMasterDepositContractAddress();

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
        // await SetMasterERC1155ContractAddress();

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

    // 1. Deploy Deposit Factory Contract
    // 2. Deploy Receive Factory Contract
    // 3. Deploy Deposit Contract
    // 4. Deploy Pay Contract
    // 5. Deploy ERC1155 Contract
    // 6. Set All Trust Remotes
    // 7. Set Master Deposit Contract Address
    // 8. Set Master Pay Contract Address
    // 9. Set Master ERC1155 Contract Address
    // 10. Setup Validator Role
    // 11. Create Nft Contract By Seller
    // 12. Create Deposit Contract By Seller
    // 13. Create Pay Contract By Seller

    // 14. Verify ChainLink Price Feed Contract
    for (let index = 0; index < networks.length; ++index) {
        const mintChain = networks[index];

        await hre.changeNetwork(mintChain);

        const [signer] = await hre.ethers.getSigners();

        console.log("🚀 Verify price feed contract:", ContractAddresses["PriceFeedContract"][mintChain]);

        const priceFeedContract = (await hre.ethers.getContractAt(
            "ChainLinkPriceFeed",
            ContractAddresses["PriceFeedContract"][mintChain]
        )) as ChainLinkPriceFeed;

        await hre.run("verify:verify", {
            address: ContractAddresses["PriceFeedContract"][mintChain],
            constructorArguments: [
                nativeTokenPriceFeedAddress[mintChain]
            ],
        });
    }

    for (let index = 0; index < networks.length; ++index) {
        const mintChain = networks[index];

        await hre.changeNetwork(mintChain);

        const [signer] = await hre.ethers.getSigners();

        // const rPaymentContract = (await hre.ethers.getContractAt(
        //     "RPaymentContract",
        //     ContractAddresses["RPaymentContract"][mintChain]
        // )) as RPaymentContract;

        // const priceFeed = await rPaymentContract.getPrice(
        //     1 * 10 ** 8,
        //     usdc[mintChain],
        // );

        // console.log(mintChain, "🚀 priceFeed:", Number(priceFeed) / 10 ** 6);

        // const depositFactoryContract = (await hre.ethers.getContractAt(
        //     "DepositFactoryContract",
        //     ContractAddresses["DepositFactoryContract"][mintChain]
        // )) as DepositFactoryContract;

        // const validatorRole = await depositFactoryContract.SPRYNT_VALIDATOR_ROLE();
        // console.log(mintChain, "🚀 validatorRole:", validatorRole);

        // console.log(mintChain, "🚀 depositFactoryContract:", depositFactoryContract.address);
        // const hasRole = await depositFactoryContract.hasRole(
        //     validatorRole,
        //     signer.address
        // );

        // console.log(mintChain, "🚀 hasRole:", hasRole);
    }

    // const mintChain = "polygonMumbai";
    // await hre.changeNetwork(mintChain);

    // const [signer] = await hre.ethers.getSigners();

    // const chainLinkPriceFeed = (await hre.ethers.getContractAt(
    //     "ChainLinkPriceFeed",
    //     ContractAddresses["PriceFeedContract"][mintChain]
    // )) as ChainLinkPriceFeed;

    // const tx = await chainLinkPriceFeed.setPriceFeedAddress(
    //     'USDC',
    //     '0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0'
    // );

    // console.log("🚀 tx:", tx);
}