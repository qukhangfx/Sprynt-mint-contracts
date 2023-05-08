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
  ERC1155Contract,
  DepositContract,
} from "../typechain-types";

import { getBigNumber, signDepositItemData } from "./utils";
import { formatUnits } from "ethers/lib/utils";

describe("Test multichain minting engine", () => {
  let testTokenContract: TestToken;
  let depositContract: DepositContract;
  let depositFactoryContract: DepositFactoryContract;
  let receiveFactoryContract: ReceiveFactoryContract;
  let NftContract: ERC1155;
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

    // setDestLzEndpoint for lzEndpointMockSrc
    await lzEndpointMockSrc.setDestLzEndpoint(
      receiveFactoryContract.address,
      lzEndpointMockDst.address
    );

    // setDestLzEndpoint for lzEndpointMockDst
    await lzEndpointMockDst.setDestLzEndpoint(
      depositFactoryContract.address,
      lzEndpointMockSrc.address
    );

    // setTRustedRemote for depositFactoryContract and receiveFactoryContract
    depositFactoryContract.setTrustedRemote(
      chainIdDst,
      ethers.utils.solidityPack(
        ["address", "address"],
        [receiveFactoryContract.address, depositFactoryContract.address]
      )
    );

    receiveFactoryContract.setTrustedRemote(
      chainIdSrc,
      ethers.utils.solidityPack(
        ["address", "address"],
        [depositFactoryContract.address, receiveFactoryContract.address]
      )
    );

    // admin mints testToken to clientWallet
    await testTokenContract.mint(
      clientWalletAddress,
      getBigNumber(10000000, depositTokenDecimals)
    );

    // seller creates NftContract
    const receiveFactoryContractTransaction = await (
      await receiveFactoryContract
        .connect(sellerWallet)
        .createNftContractBySeller(tokenURI)
    ).wait();

    if (receiveFactoryContractTransaction.status == 1) {
      const events = receiveFactoryContractTransaction.events;
      if (events && events.length) {
        for (const eventObject of events) {
          if (eventObject.event == "CreatedNftContract") {
            const nftContractAddress = eventObject.args[2];
            NftContract = (await ethers.getContractAt(
              "ERC1155Contract",
              nftContractAddress
            )) as ERC1155Contract;

            console.log("NftContract deployed to:", NftContract.address);
            console.log(
              "NftContract deployed by:",
              sellerWalletAddress,
              await receiveFactoryContract
                .connect(sellerWallet)
                .getNftContractsOfAccount(sellerWalletAddress)
            );

            break;
          }
        }
      }
    } else {
      console.log("Error when create NftContract");
    }
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
      await expect(
        receiveFactoryContract
          .connect(sellerWallet)
          .createNftContractBySeller(tokenURI)
      ).to.be.revertedWith("already created nft contract.");
    });

    it("check client deposit erc20 tokens", async () => {
      const currentTimestamp = await helpers.time.latest();
      const deadline = currentTimestamp + 10 * 60;

      let masterDepositContractAddress = await (
        await depositFactoryContract.createNewDepositContract(
          sellerWalletAddress,
          lzEndpointMockDst.address,
          chainIdDst,
          getBigNumber(1000, depositTokenDecimals),
          getBigNumber(1000, depositTokenDecimals),
          1,
          100,
          totalSupply,
          deadline
        )
      ).wait();
      masterDepositContractAddress =
        masterDepositContractAddress.events[0].args
          .masterDepositContractAddress;
      console.log(
        "Master Deposit Contract Address: ",
        masterDepositContractAddress
      );

      const depositItemData = {
        mintPrice: getBigNumber(1000, depositTokenDecimals),
        mintQuantity: 2,
        sellerAddress: sellerWalletAddress,
        dstChainId: chainIdDst,
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

      let adapterParams = ethers.utils.solidityPack(
        ["uint16", "uint256"],
        [1, 2000000]
      );

      const _payload = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "bytes", "address"],
        [
          clientWalletAddress,
          depositItemData.mintQuantity,
          Buffer.from(""),
          depositItemData.sellerAddress,
        ]
      );

      const estimatedFee = await lzEndpointMockSrc.estimateFees(
        chainIdDst,
        depositFactoryContract.address,
        _payload,
        false,
        adapterParams
      );

      await testTokenContract
        .connect(clientWallet)
        .approve(depositFactoryContract.address, depositItemData.mintPrice);

      expect(
        formatUnits(
          await testTokenContract.balanceOf(clientWalletAddress),
          depositTokenDecimals
        )
      ).to.be.equal("10000000.0"); // initial value

      expect(
        formatUnits(
          await testTokenContract.balanceOf(adminWalletAddress),
          depositTokenDecimals
        )
      ).to.be.equal("0.0"); // initial value

      expect(
        formatUnits(
          await testTokenContract.balanceOf(sellerWalletAddress),
          depositTokenDecimals
        )
      ).to.be.equal("0.0"); // initial value

      depositContract = (await ethers.getContractAt(
        "DepositContract",
        masterDepositContractAddress
      )) as DepositContract;

      console.log("estimateFee is: ", formatUnits(estimatedFee.nativeFee));

      await expect(
        await depositContract
          .connect(clientWallet)
          .mint(depositItem, signature, estimatedFee.nativeFee, false, {
            value: estimatedFee.nativeFee,
          })
      ).to.be.not.reverted;

      console.log(
        "admin wallet balance is: ",
        formatUnits(
          await testTokenContract.balanceOf(adminWalletAddress),
          depositTokenDecimals
        )
      );

      expect(
        formatUnits(
          await testTokenContract.balanceOf(adminWalletAddress),
          depositTokenDecimals
        )
      ).to.be.equal("25.0");

      expect(
        formatUnits(
          await testTokenContract.balanceOf(sellerWalletAddress),
          depositTokenDecimals
        )
      ).to.be.equal("975.0");

      expect(await depositContract.getTotalMintedToken()).to.be.equal(2);
      expect(
        await NftContract.getNumberOfMintedTokens()
      ).to.be.equal(2);
    });
  });
});
