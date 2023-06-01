import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as helpers from "@nomicfoundation/hardhat-network-helpers";

import {
	DepositFactoryContract,
	ReceiveFactoryContract,
	ERC1155,
	LZEndpointMock,
	TestToken,
	DepositContract,
} from "../typechain-types";

import { getBigNumber, signDepositItemData } from "./utils";
import { formatUnits } from "ethers/lib/utils";
import { ownerWindow } from "@mui/material";

describe("Test multichain minting engine", () => {
	let testTokenContract: TestToken;
	let depositContract: DepositContract;
	let depositFactoryContract: DepositFactoryContract;
	let receiveFactoryContract: ReceiveFactoryContract;
	let depositFactoryContractB: DepositFactoryContract;
	let receiveFactoryContractB: ReceiveFactoryContract;
	let NftContract: ERC1155;
	let NftContractB: ERC1155;
	let lzEndpointMockSrc: LZEndpointMock;
	let lzEndpointMockDst: LZEndpointMock;

	let owner: SignerWithAddress;
	let adminWallet: SignerWithAddress;
	let sellerWallet: SignerWithAddress;
	let clientWallet: SignerWithAddress;
	let depositRoleAccount: SignerWithAddress;

	let ownerAddress: string;
	let adminWalletAddress: string;
	let sellerWalletAddress: string;
	let clientWalletAddress: string;
	let depositRoleAccountAddress: string;

	const nftName = "Polarys test NFTs";
	const nftSymbol = "PNT";
	const tokenURI =
		"https://bafybeidyj2ases25wrcwyisxsbnfo6qe7oe4re5ql77uspoo6d33benknq.ipfs.nftstorage.link/";
	const totalSupply = 100;

	const erc20TokenName = "TestToken";
	const erc20TokenSymbol = "TT";
	const depositTokenDecimals = 6;

	const chainIdSrc = 1;
	const chainIdDst = 2;

	let backendNonce = 0;

	before(async () => {
		[owner, adminWallet, sellerWallet, clientWallet, depositRoleAccount] =
			await ethers.getSigners();

		ownerAddress = await owner.getAddress();
		adminWalletAddress = await adminWallet.getAddress();
		sellerWalletAddress = await sellerWallet.getAddress();
		clientWalletAddress = await clientWallet.getAddress();
		depositRoleAccountAddress = await depositRoleAccount.getAddress();

		// Deploy TestToken contract
		const TestTokenFactory = await ethers.getContractFactory("TestToken");
		testTokenContract = (await TestTokenFactory.deploy(
			erc20TokenName,
			erc20TokenSymbol,
			depositTokenDecimals
		)) as TestToken;
		await testTokenContract.deployed();
		console.log("TestToken deployed to:", testTokenContract.address);

		// Deploy LZEndpointMock contract
		const LZEndpointMockFactory = await ethers.getContractFactory(
			"LZEndpointMock"
		);

		lzEndpointMockSrc = (await LZEndpointMockFactory.deploy(
			chainIdSrc
		)) as LZEndpointMock;
		await lzEndpointMockSrc.deployed();

		lzEndpointMockDst = (await LZEndpointMockFactory.deploy(
			chainIdDst
		)) as LZEndpointMock;
		await lzEndpointMockDst.deployed();

		// Deploy DepositFactory contract
		const DepositFactoryContractFactory = await ethers.getContractFactory(
			"DepositFactoryContract"
		);

		depositFactoryContract = (await DepositFactoryContractFactory.deploy(
			lzEndpointMockSrc.address,
			testTokenContract.address,
			ownerAddress,
			adminWalletAddress,
			depositRoleAccountAddress
		)) as DepositFactoryContract;
		await depositFactoryContract.deployed();
		console.log(
			"DepositFactoryContract deployed to:",
			depositFactoryContract.address
		);

		depositFactoryContractB = (await DepositFactoryContractFactory.deploy(
			lzEndpointMockDst.address,
			testTokenContract.address,
			ownerAddress,
			adminWalletAddress,
			depositRoleAccountAddress
		)) as DepositFactoryContract;
		await depositFactoryContractB.deployed();
		console.log(
			"DepositFactoryContractB deployed to:",
			depositFactoryContractB.address
		);

		// Deploy ReceiveFactory contract
		const ReceiveFactoryContractFactory = await ethers.getContractFactory(
			"ReceiveFactoryContract"
		);

		receiveFactoryContract = (await ReceiveFactoryContractFactory.deploy(
			lzEndpointMockDst.address
		)) as ReceiveFactoryContract;
		await receiveFactoryContract.deployed();
		console.log(
			"ReceiveFactoryContract deployed to:",
			receiveFactoryContract.address
		);

		receiveFactoryContractB = (await ReceiveFactoryContractFactory.deploy(
			lzEndpointMockSrc.address
		)) as ReceiveFactoryContract;
		await receiveFactoryContractB.deployed();
		console.log(
			"ReceiveFactoryContract deployed to:",
			receiveFactoryContractB.address
		);

		// setDestLzEndpoint for lzEndpointMockSrc
		await lzEndpointMockSrc.setDestLzEndpoint(
			receiveFactoryContract.address,
			lzEndpointMockDst.address
		);

		// setDestLzEndpoint for lzEndpointMockSrc
		await lzEndpointMockSrc.setDestLzEndpoint(
			receiveFactoryContractB.address,
			lzEndpointMockSrc.address
		);

		// setDestLzEndpoint for lzEndpointMockDst
		await lzEndpointMockDst.setDestLzEndpoint(
			depositFactoryContract.address,
			lzEndpointMockSrc.address
		);

		await lzEndpointMockDst.setDestLzEndpoint(
			depositFactoryContractB.address,
			lzEndpointMockDst.address
		);

		// setTRustedRemote for depositFactoryContract and receiveFactoryContract
		depositFactoryContract.setTrustedRemote(
			chainIdDst,
			ethers.utils.solidityPack(
				["address", "address"],
				[receiveFactoryContract.address, depositFactoryContract.address]
			)
		);

		depositFactoryContract.setTrustedRemote(
			chainIdSrc,
			ethers.utils.solidityPack(
				["address", "address"],
				[
					receiveFactoryContractB.address,
					depositFactoryContract.address,
				]
			)
		);

		depositFactoryContractB.setTrustedRemote(
			chainIdDst,
			ethers.utils.solidityPack(
				["address", "address"],
				[
					receiveFactoryContract.address,
					depositFactoryContractB.address,
				]
			)
		);

		depositFactoryContractB.setTrustedRemote(
			chainIdSrc,
			ethers.utils.solidityPack(
				["address", "address"],
				[
					receiveFactoryContractB.address,
					depositFactoryContractB.address,
				]
			)
		);

		receiveFactoryContract.setTrustedRemote(
			chainIdSrc,
			ethers.utils.solidityPack(
				["address", "address"],
				[depositFactoryContract.address, receiveFactoryContract.address]
			)
		);

		receiveFactoryContract.setTrustedRemote(
			chainIdDst,
			ethers.utils.solidityPack(
				["address", "address"],
				[
					depositFactoryContractB.address,
					receiveFactoryContract.address,
				]
			)
		);

		receiveFactoryContractB.setTrustedRemote(
			chainIdSrc,
			ethers.utils.solidityPack(
				["address", "address"],
				[
					depositFactoryContract.address,
					receiveFactoryContractB.address,
				]
			)
		);

		receiveFactoryContractB.setTrustedRemote(
			chainIdDst,
			ethers.utils.solidityPack(
				["address", "address"],
				[
					depositFactoryContractB.address,
					receiveFactoryContractB.address,
				]
			)
		);

		// admin mints testToken to clientWallet
		await testTokenContract.mint(
			clientWalletAddress,
			getBigNumber(10000000, depositTokenDecimals)
		);

		// seller creates NftContract
		const ERC1155Contract = await ethers.getContractFactory(
			"ERC1155Contract"
		);
		const erc1155Contract = await ERC1155Contract.deploy(
			"",
			receiveFactoryContract.address
		);
		await erc1155Contract.deployed();
		console.log("erc1155Contract deployed to:", erc1155Contract.address);
		await (
			await receiveFactoryContract.setMasterNftContractAddress(
				erc1155Contract.address
			)
		).wait();

		await (
			await receiveFactoryContractB.setMasterNftContractAddress(
				erc1155Contract.address
			)
		).wait();

		// owner deploys depositContract
		const DepositContract = await ethers.getContractFactory(
			"DepositContract"
		);
		const depositContract = await DepositContract.deploy(
			"0x0000000000000000000000000000000000000000",
			"0x0000000000000000000000000000000000000000",
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			"0x0000000000000000000000000000000000000000",
			["0x0000000000000000000000000000000000000000"]
		);
		await depositContract.deployed();
		console.log("depositContract deployed to:", depositContract.address);

		await (
			await depositFactoryContract.setMasterDepositContractAddress(
				depositContract.address
			)
		).wait();

		await (
			await depositFactoryContractB.setMasterDepositContractAddress(
				depositContract.address
			)
		).wait();

		// owner deploys simplePayContract
		const SimplePayContract = await ethers.getContractFactory("SimplePay");
		const simplePayContract = await SimplePayContract.deploy(
			0,
			true,
			"0x0000000000000000000000000000000000000000"
		);
		await simplePayContract.deployed();
		console.log(
			"simplePayContract deployed to:",
			simplePayContract.address
		);

		await (
			await depositFactoryContract.setMasterPayContractAddress(
				simplePayContract.address
			)
		).wait();

		await (
			await depositFactoryContractB.setMasterPayContractAddress(
				simplePayContract.address
			)
		).wait();
	});

	describe("Test", async () => {
		it("check decimal", async () => {
			expect(await testTokenContract.decimals()).to.be.equal(6);
		});

		it("check modified decimal", async () => {
			await testTokenContract.setupDecimals(7);
			expect(await testTokenContract.decimals()).to.be.equal(7);
		});

		it("check mint fail", async () => {
			await expect(
				testTokenContract.mint(clientWalletAddress, 0)
			).to.be.revertedWith("amount is 0");
		});

		it("check already created contract", async () => {
			await receiveFactoryContract
				.connect(sellerWallet)
				.createNftContractBySeller(tokenURI);
			await expect(
				receiveFactoryContract
					.connect(sellerWallet)
					.createNftContractBySeller(tokenURI)
			).to.be.revertedWith("already created nft contract.");
		});

		it("check client create pay contract", async () => {
			const currentTimestamp = await helpers.time.latest();
			const deadline = currentTimestamp + 10 * 60;
			let adapterParams = ethers.utils.solidityPack(
				["uint16", "uint256"],
				[1, 200_000]
			);

			const maxAcceptValue = 3;
			const encodedPayload = ethers.utils.defaultAbiCoder.encode(
				["uint256", "uint256", "bool", "address"],
				[1, maxAcceptValue, true, testTokenContract.address]
			);

			const gasFee = await lzEndpointMockDst.estimateFees(
				chainIdSrc,
				receiveFactoryContract.address,
				encodedPayload,
				false,
				adapterParams
			);

			const transaction = await (
				await receiveFactoryContract
					.connect(sellerWallet)
					.createPayContractBySeller(
						maxAcceptValue,
						true,
						testTokenContract.address,
						chainIdSrc,
						adapterParams,
						{ value: gasFee.nativeFee }
					)
			).wait();
		});

		it("check client create deposit contract", async () => {
			const currentTimestamp = await helpers.time.latest();
			const deadline = currentTimestamp + 10 * 60;
			let adapterParams = ethers.utils.solidityPack(
				["uint16", "uint256"],
				[1, 200_000]
			);

			const maxAcceptValue = 3;
			const encodedPayload = ethers.utils.defaultAbiCoder.encode(
				[
					"uint256",
					"address",
					"address",
					"uint256",
					"uint256",
					"uint256",
					"uint256",
					"uint256",
					"uint256",
					"uint256",
					"address[]",
				],
				[
					2,
					sellerWalletAddress,
					"0x0000000000000000000000000000000000000000",
					chainIdDst,
					ethers.utils.parseEther("0.0001"),
					ethers.utils.parseEther("0.0001"),
					1,
					5,
					100,
					deadline,
					[testTokenContract.address],
				]
			);

			const gasFee = await lzEndpointMockDst.estimateFees(
				chainIdSrc,
				receiveFactoryContract.address,
				encodedPayload,
				false,
				adapterParams
			);

			let depositContractCreation = await (
				await receiveFactoryContract
					.connect(sellerWallet)
					.createDepositContractBySeller(
						chainIdSrc,
						sellerWalletAddress,
						"0x0000000000000000000000000000000000000000",
						chainIdDst,
						ethers.utils.parseEther("0.0001"),
						ethers.utils.parseEther("0.0001"),
						1,
						5,
						100,
						deadline,
						[testTokenContract.address],
						adapterParams,
						{ value: gasFee.nativeFee }
					)
			).wait();
		});
	});
});
