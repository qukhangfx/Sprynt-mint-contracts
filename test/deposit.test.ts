import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as helpers from "@nomicfoundation/hardhat-network-helpers";

import {
  DepositFactoryContract,
  ReceiveFactoryContract,
  ERC1155,
  TestToken,
  DepositContract,
  RPaymentContract,
  StaticDataFeed,
  ChainLinkPriceFeed,
} from "../typechain-types";

import { getBigNumber } from "./utils";
import { BigNumber } from "ethers";

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const isFloatEqual = (a: number, b: number) => {
  return Math.abs(a - b) < 0.00001; // 0.00001 is the precision, 1 x 10^(-5)
}

const USD_DECIMALS = 8;

const STATIC_PRICE_ = {
  ETH_USD: 187354820000, // decimal 8
  AVAX_USD: 1341998900, // decimal 8
  USDC_USD: 100000000, // decimal 8
};

console.log("ETH to USD:", STATIC_PRICE_.ETH_USD / 10 ** 8);
console.log("AVAX to USD:", STATIC_PRICE_.AVAX_USD / 10 ** 8);
console.log("USDC to USD:", STATIC_PRICE_.USDC_USD / 10 ** 8);

const STATIC_NATIVE_PRICE = STATIC_PRICE_.ETH_USD;
const STATIC_TOKEN_PRICE = STATIC_PRICE_.USDC_USD;

describe("Test multichain minting engine", () => {
  let testTokenContract: TestToken;

  let depositContract: DepositContract;

  let depositFactoryContract: DepositFactoryContract;
  let receiveFactoryContract: ReceiveFactoryContract;

  let depositFactoryContractB: DepositFactoryContract;
  let receiveFactoryContractB: ReceiveFactoryContract;

  let NftContract: ERC1155;
  let NftContractB: ERC1155;

  let rPaymentContract: RPaymentContract;

  let staticNativeTokenFeed: StaticDataFeed;
  let staticCustomTokenFeed: StaticDataFeed;

  let chainlinkPriceFeed: ChainLinkPriceFeed;

  let owner: SignerWithAddress;
  let adminWallet: SignerWithAddress;
  let sellerWallet: SignerWithAddress;
  let clientWallet: SignerWithAddress;
  let validatorRoleAccount: SignerWithAddress;

  let ownerAddress: string;
  let adminWalletAddress: string;
  let sellerWalletAddress: string;
  let clientWalletAddress: string;
  let validatorRoleAccountAddress: string;

  let ftName = "Banh tet La Cam";
  let nftSymbol = "bTET";

  const tokenURI =
    "https://bafybeidyj2ases25wrcwyisxsbnfo6qe7oe4re5ql77uspoo6d33benknq.ipfs.nftstorage.link/";
  const totalSupply = 100;

  const erc20TokenName = "USDC";
  const erc20TokenSymbol = "USDC";
  const depositTokenDecimals = 6;

  const chainIdSrc = 1;
  const chainIdDst = 43114;

  before(async () => {
    [owner, adminWallet, sellerWallet, clientWallet, validatorRoleAccount] =
      await ethers.getSigners();

    ownerAddress = await owner.getAddress();
    adminWalletAddress = await adminWallet.getAddress();
    sellerWalletAddress = await sellerWallet.getAddress();
    clientWalletAddress = await clientWallet.getAddress();
    validatorRoleAccountAddress = await validatorRoleAccount.getAddress();

    const StaticNativeTokenFeedFactory = await ethers.getContractFactory("StaticDataFeed");
    staticNativeTokenFeed = (await StaticNativeTokenFeedFactory.deploy(STATIC_NATIVE_PRICE, -1)) as StaticDataFeed;
    await staticNativeTokenFeed.deployed();

    console.log("StaticNativeTokenFeedFactory deployed to:", staticNativeTokenFeed.address);

    const StaticCustomTokenFeedFactory = await ethers.getContractFactory("StaticDataFeed");
    staticCustomTokenFeed = (await StaticCustomTokenFeedFactory.deploy(STATIC_TOKEN_PRICE, -1)) as StaticDataFeed;
    await staticCustomTokenFeed.deployed();

    console.log("StaticCustomTokenFeedFactory deployed to:", staticCustomTokenFeed.address);

    const ChainlinkPriceFeed = await ethers.getContractFactory("ChainLinkPriceFeed");
    chainlinkPriceFeed = (await ChainlinkPriceFeed.deploy(
      staticNativeTokenFeed.address
    )) as ChainLinkPriceFeed;
    await chainlinkPriceFeed.deployed();

    console.log("ChainlinkPriceFeed deployed to:", chainlinkPriceFeed.address);

    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    testTokenContract = (await TestTokenFactory.deploy(
      erc20TokenName,
      erc20TokenSymbol,
      depositTokenDecimals
    )) as TestToken;
    await testTokenContract.deployed();

    console.log("TestToken deployed to:", testTokenContract.address);

    const DepositFactoryContractFactory = await ethers.getContractFactory(
      "DepositFactoryContract"
    );

    depositFactoryContract = (await DepositFactoryContractFactory.deploy(
      ethers.constants.AddressZero,
      ownerAddress,
      adminWalletAddress,
      validatorRoleAccountAddress
    )) as DepositFactoryContract;
    await depositFactoryContract.deployed();

    console.log(
      "DepositFactoryContract deployed to:",
      depositFactoryContract.address
    );

    depositFactoryContractB = (await DepositFactoryContractFactory.deploy(
      ethers.constants.AddressZero,
      ownerAddress,
      adminWalletAddress,
      validatorRoleAccountAddress
    )) as DepositFactoryContract;
    await depositFactoryContractB.deployed();

    console.log(
      "DepositFactoryContractB deployed to:",
      depositFactoryContractB.address
    );

    const ReceiveFactoryContractFactory = await ethers.getContractFactory(
      "ReceiveFactoryContract"
    );

    receiveFactoryContract = (await ReceiveFactoryContractFactory.deploy(
      ethers.constants.AddressZero
    )) as ReceiveFactoryContract;
    await receiveFactoryContract.deployed();

    console.log(
      "ReceiveFactoryContract deployed to:",
      receiveFactoryContract.address
    );

    receiveFactoryContractB = (await ReceiveFactoryContractFactory.deploy(
      ethers.constants.AddressZero
    )) as ReceiveFactoryContract;
    await receiveFactoryContractB.deployed();

    console.log(
      "ReceiveFactoryContract deployed to:",
      receiveFactoryContractB.address
    );

    await testTokenContract.mint(
      clientWalletAddress,
      getBigNumber(10000000, depositTokenDecimals)
    );

    await receiveFactoryContract
      .connect(owner)
      .setupValidatorRole(validatorRoleAccountAddress);

    const ERC1155Contract = await ethers.getContractFactory("ERC1155Contract");
    const erc1155Contract = await ERC1155Contract.deploy();
    await erc1155Contract.deployed();

    console.log("ERC1155Contract deployed to:", erc1155Contract.address);

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

    const DepositContract = await ethers.getContractFactory("DepositContract");
    const depositContract = await DepositContract.deploy();
    await depositContract.deployed();

    console.log("DepositContract deployed to:", depositContract.address);

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

    const SimplePayContract = await ethers.getContractFactory("SimplePay");
    const simplePayContract = await SimplePayContract.deploy();
    await simplePayContract.deployed();

    console.log("SimplePayContract deployed to:", simplePayContract.address);

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

    const RPaymentContract = await ethers.getContractFactory("RPaymentContract");
    rPaymentContract = await RPaymentContract.deploy(
      [
        ethers.constants.AddressZero,
        testTokenContract.address,
      ],
      depositFactoryContract.address,
      chainlinkPriceFeed.address,
    ) as RPaymentContract;
    await rPaymentContract.deployed();

    console.log("RPaymentContract deployed to:", rPaymentContract.address);
  });

  describe("Test", async () => {
    it("[ERC1155Contract] Seller cann't create more than one NFT contract", async () => {
      await receiveFactoryContract
        .connect(sellerWallet)
        .createNftContractBySeller(tokenURI);

      await expect(
        receiveFactoryContract
          .connect(sellerWallet)
          .createNftContractBySeller(tokenURI)
      ).to.be.revertedWith("already created nft contract.");
    });

    it("[StaticDataFeed] latestRoundData", async () => {
      let price: BigNumber;
      [, price, , ,] = await staticNativeTokenFeed.latestRoundData();
      expect(price).to.be.equal(STATIC_NATIVE_PRICE);
    });

    it("[PriceFeed] convertUsdToTokenPrice", async () => {
      const usdValue = 1 * 10 ** USD_DECIMALS; // 1 USD
      const usdValueToNativeToken = await chainlinkPriceFeed.convertUsdToTokenPrice(usdValue, ethers.constants.AddressZero);
      const nativeToken = Number(usdValueToNativeToken) / 10 ** 18; // 18 is the decimals of native token
      expect(isFloatEqual(nativeToken, 0.00053)).to.be.true; // ETH
      // expect(isFloatEqual(nativeToken, 0.07452)).to.be.true; // AVAX
    });

    it("[Paylink] pay: revert with 'Not supported token!'", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));

      const usdValue = 1 * 10 ** USD_DECIMALS; // 1 USD

      await expect(
        rPaymentContract.connect(clientWallet).pay(
          "0x0000000000000000000000000000000000000001",
          sellerWalletAddress,
          usdValue,
          vpId
        )
      ).to.be.revertedWith("Not supported token!"); 
    });

    it("[Paylink] pay: revert with 'Insufficient native token balances'", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));

      const usdValue = 1 * 10 ** USD_DECIMALS; // 1 USD

      await expect(
        rPaymentContract.connect(clientWallet).pay(
          ethers.constants.AddressZero,
          sellerWalletAddress,
          usdValue,
          vpId
        )
      ).to.be.revertedWith("Insufficient native token balances");
    });

    it("[Paylink] pay: revert with 'Insufficient native token balances'", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));

      const usdValue = 1 * 10 ** USD_DECIMALS; // 1 USD

      const price: BigNumber = await rPaymentContract.getPrice(usdValue, ethers.constants.AddressZero);

      await expect(
        rPaymentContract.connect(clientWallet).pay(
          ethers.constants.AddressZero,
          sellerWalletAddress,
          usdValue,
          vpId, {
            value: price.sub(1),
          }
        )
      ).to.be.revertedWith("Insufficient native token balances");
    });

    it("[Paylink] pay: fulfilled", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));

      const usdValue = 1 * 10 ** USD_DECIMALS; // 1 USD

      const price: BigNumber = await rPaymentContract.getPrice(usdValue, ethers.constants.AddressZero);

      await expect(
        rPaymentContract.connect(clientWallet).pay(
          ethers.constants.AddressZero,
          sellerWalletAddress,
          usdValue,
          vpId, {
            value: price,
          }
        )
      ).to.be.fulfilled;

      const [tokenAddress_, sellerAddress_, value_, blockNumber_] = await rPaymentContract.vpInfo(vpId);
      expect(tokenAddress_).to.be.equal(ethers.constants.AddressZero);
      expect(sellerAddress_).to.be.equal(sellerWalletAddress);
      expect(value_).to.be.equal(price);
    });

    it("[Paylink] pay: revert with 'Already paid!'", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));

      const usdValue = 1 * 10 ** USD_DECIMALS; // 1 USD

      const price: BigNumber = await rPaymentContract.getPrice(usdValue, ethers.constants.AddressZero);

      await expect(
        rPaymentContract.connect(clientWallet).pay(
          ethers.constants.AddressZero,
          sellerWalletAddress,
          usdValue,
          vpId, {
            value: price,
          }
        )
      ).to.be.rejectedWith("Already paid!");
    });

    it("[Recurring Payment] setupByValidator: fulfilled", async () => {
      const subscriptionId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("subscription_id"));
      const usdValue = 1 * 10 ** USD_DECIMALS; // 1 USD
      const duration = 5; // 5 seconds

      await expect(
        rPaymentContract.connect(validatorRoleAccount).setupByValidator(
          sellerWalletAddress,
          subscriptionId,
          usdValue,
          duration
        )
      ).to.be.fulfilled;

      const [usdValue_, duration_] = await rPaymentContract.setupPayment(sellerWalletAddress, subscriptionId);
      expect(usdValue_).to.be.equal(usdValue);
      expect(duration_).to.be.equal(duration);

      const sellerAddress_ = await rPaymentContract.ownerOfSubscription(subscriptionId);
      expect(sellerAddress_).to.be.equal(sellerWalletAddress);
    });

    it("[Recurring Payment] subscribe / native token: revert with 'Not supported native token!'", async () => {
      const subscriptionId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("subscription_id"));
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("vp_id"));
      
      const usdValue = 1 * 10 ** USD_DECIMALS; // 1 USD
      const price = await rPaymentContract.getPrice(usdValue, ethers.constants.AddressZero);

      await expect(
        rPaymentContract.connect(clientWallet).subscribe(
          sellerWalletAddress,
          subscriptionId,
          vpId,
          ethers.constants.AddressZero,
          {
            value: price,
          }
        )
      ).to.be.revertedWith("Not supported native token!");
    });

    it("[Recurring Payment] subscribe / custom token: fulfilled", async () => {
      const subscriptionId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("subscription_id"));
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("vp_id"));
      
      const usdValue = 1 * 10 ** USD_DECIMALS; // 1 USD

      const [tokenSymbol, tokenDecimals] = await chainlinkPriceFeed.getTokenInfo(testTokenContract.address);
      expect(tokenSymbol).to.be.equal("USDC");
      expect(tokenDecimals).to.be.equal(6);

      await expect(
        rPaymentContract.getPrice(usdValue, testTokenContract.address)
      ).to.be.rejectedWith("PriceFeed: invalid symbol");

      await expect(
        chainlinkPriceFeed.setPriceFeedAddress(tokenSymbol, staticCustomTokenFeed.address)
      ).to.be.fulfilled;

      expect(
        await chainlinkPriceFeed.getPriceFeedAddress(tokenSymbol)
      ).to.be.equal(staticCustomTokenFeed.address)

      const price = await rPaymentContract.getPrice(usdValue, testTokenContract.address);
      expect(price.div(10 ** tokenDecimals)).to.be.equal(usdValue / 10 ** USD_DECIMALS);

      await expect(
        rPaymentContract.connect(clientWallet).subscribe(
          sellerWalletAddress,
          subscriptionId,
          vpId,
          testTokenContract.address, {
            value: 0,
          }
        )
      ).to.be.rejectedWith("ERC20: insufficient allowance");

      await testTokenContract.connect(clientWallet).approve(rPaymentContract.address, price);

      await expect(
        rPaymentContract.connect(clientWallet).subscribe(
          sellerWalletAddress,
          subscriptionId,
          vpId,
          testTokenContract.address,
          {
            value: 0,
          }
        )
      ).to.be.fulfilled;

      const lastestPayment = await rPaymentContract.lastestPayment(clientWalletAddress, vpId);
      expect(lastestPayment.seller).to.be.equal(sellerWalletAddress);
      expect(lastestPayment.buyer).to.be.equal(clientWalletAddress);
      expect(lastestPayment.subscriptionId).to.be.equal(subscriptionId);
      expect(lastestPayment.token).to.be.equal(testTokenContract.address);
      expect(lastestPayment.value).to.be.equal(price);
      expect(lastestPayment.renew).to.be.true;
      

      await expect(
        rPaymentContract.connect(clientWallet).subscribe(
          sellerWalletAddress,
          subscriptionId,
          vpId,
          testTokenContract.address, {
            value: 0,
          }
        )
      ).to.be.rejectedWith("Already subscribe!");

      const newVpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_vp_id"));

      await expect(
        rPaymentContract.connect(clientWallet).subscribe(
          sellerWalletAddress,
          subscriptionId,
          newVpId,
          testTokenContract.address, {
            value: 0,
          }
        )
      ).to.be.rejectedWith("ERC20: insufficient allowance");
    });

    it("[Recurring Payment] renew / custom token: fulfilled", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("vp_id"));

      await expect(
        rPaymentContract.connect(sellerWallet).renew(
          clientWalletAddress,
          vpId,
        )
      ).to.be.rejectedWith("Not yet time!");

      await delay(5_000);

      await expect(
        rPaymentContract.connect(sellerWallet).renew(
          clientWalletAddress,
          vpId,
        )
      ).to.be.rejectedWith("ERC20: insufficient allowance");

      await testTokenContract.connect(clientWallet).approve(rPaymentContract.address, 1_000_000);

      await expect(
        rPaymentContract.connect(sellerWallet).renew(
          clientWalletAddress,
          vpId,
        )
      ).to.be.fulfilled;
    });

    it("[Recurring Payment] disable: fulfilled", async () => {
      const subscriptionId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("subscription_id"));

      await expect(
        rPaymentContract.connect(sellerWallet).disable(subscriptionId)
      ).to.be.fulfilled;
    });
  });
});