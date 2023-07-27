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
  let usdcToken: TestToken;

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
    usdcToken = (await TestTokenFactory.deploy(
      erc20TokenName,
      erc20TokenSymbol,
      depositTokenDecimals
    )) as TestToken;
    await usdcToken.deployed();

    console.log("TestToken deployed to:", usdcToken.address);

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

    await usdcToken.mint(
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
        usdcToken.address,
      ],
      depositFactoryContract.address,
      chainlinkPriceFeed.address,
    ) as RPaymentContract;
    await rPaymentContract.deployed();

    console.log("RPaymentContract deployed to:", rPaymentContract.address);
  });

  describe("Test", async () => {
    it("[ERC1155Contract] Seller cann't create more than one NFT contract", async () => {
      await expect(
        receiveFactoryContract
        .connect(sellerWallet)
        .createNftContractBySeller(
          tokenURI,
          1 * 10 ** USD_DECIMALS, // 1 USD
        )
      ).to.be.fulfilled;

      await expect(
        receiveFactoryContract
          .connect(sellerWallet)
          .createNftContractBySeller(
            tokenURI,
            1 * 10 ** USD_DECIMALS, // 1 USD
          )
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
      ).to.be.revertedWith("Already paid!");
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

      const [tokenSymbol, tokenDecimals] = await chainlinkPriceFeed.getTokenInfo(usdcToken.address);
      expect(tokenSymbol).to.be.equal("USDC");
      expect(tokenDecimals).to.be.equal(6);

      await expect(
        rPaymentContract.getPrice(usdValue, usdcToken.address)
      ).to.be.revertedWith("PriceFeed: invalid symbol");

      await expect(
        chainlinkPriceFeed.setPriceFeedAddress(tokenSymbol, staticCustomTokenFeed.address)
      ).to.be.fulfilled;

      expect(
        await chainlinkPriceFeed.getPriceFeedAddress(tokenSymbol)
      ).to.be.equal(staticCustomTokenFeed.address)

      const price = await rPaymentContract.getPrice(usdValue, usdcToken.address);
      expect(price.div(10 ** tokenDecimals)).to.be.equal(usdValue / 10 ** USD_DECIMALS);

      await expect(
        rPaymentContract.connect(clientWallet).subscribe(
          sellerWalletAddress,
          subscriptionId,
          vpId,
          usdcToken.address, {
            value: 0,
          }
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");

      await expect(
        usdcToken.connect(clientWallet).approve(rPaymentContract.address, price)
      ).to.be.fulfilled;

      await expect(
        rPaymentContract.connect(clientWallet).subscribe(
          sellerWalletAddress,
          subscriptionId,
          vpId,
          usdcToken.address,
          {
            value: 0,
          }
        )
      ).to.be.fulfilled;

      const lastestPayment = await rPaymentContract.lastestPayment(clientWalletAddress, vpId);
      expect(lastestPayment.seller).to.be.equal(sellerWalletAddress);
      expect(lastestPayment.buyer).to.be.equal(clientWalletAddress);
      expect(lastestPayment.subscriptionId).to.be.equal(subscriptionId);
      expect(lastestPayment.token).to.be.equal(usdcToken.address);
      expect(lastestPayment.value).to.be.equal(price);
      expect(lastestPayment.renew).to.be.true;
      

      await expect(
        rPaymentContract.connect(clientWallet).subscribe(
          sellerWalletAddress,
          subscriptionId,
          vpId,
          usdcToken.address, {
            value: 0,
          }
        )
      ).to.be.revertedWith("Already subscribe!");

      const newVpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_vp_id"));

      await expect(
        rPaymentContract.connect(clientWallet).subscribe(
          sellerWalletAddress,
          subscriptionId,
          newVpId,
          usdcToken.address, {
            value: 0,
          }
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("[Recurring Payment] renew / custom token: fulfilled", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("vp_id"));

      await expect(
        rPaymentContract.connect(sellerWallet).renew(
          clientWalletAddress,
          vpId,
        )
      ).to.be.revertedWith("Not yet time!");

      await delay(5_000);

      await expect(
        rPaymentContract.connect(sellerWallet).renew(
          clientWalletAddress,
          vpId,
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");

      await expect(
        usdcToken.connect(clientWallet).approve(rPaymentContract.address, 1_000_000)
      ).to.be.fulfilled;

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

      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("vp_id"));

      await expect(
        rPaymentContract.connect(sellerWallet).renew(
          clientWalletAddress,
          vpId,
        )
      ).to.be.revertedWith("Subscription is disabled!");
    });

    const maxAcceptedUsdValue = 3 * 10 ** USD_DECIMALS; // 3 USD
    const deadline = 15; // 20 seconds

    it("[DepositFactoryContract] createPayContractBySeller: fulfilled", async () => {
      const tokenAddresses = [ethers.constants.AddressZero];

      await expect(
        depositFactoryContract.connect(owner).createPayContractBySeller(
          maxAcceptedUsdValue,
          tokenAddresses,
          sellerWalletAddress,
          deadline,
          chainlinkPriceFeed.address,
        )
      ).to.be.fulfilled;

      const payContractAddress = await depositFactoryContract.getPayContract(sellerWalletAddress);
      expect(payContractAddress).to.not.be.equal(ethers.constants.AddressZero);
    });

    it("[SimplePay] initialized" , async () => {
      const payContractAddress = await depositFactoryContract.getPayContract(sellerWalletAddress);
      const simplePayContract = await ethers.getContractAt("SimplePay", payContractAddress);
      expect(simplePayContract.address).to.be.equal(payContractAddress);
      expect(await simplePayContract.initialized()).to.be.true;
      expect(await simplePayContract.deadline()).to.be.equal(deadline);
      expect(await simplePayContract.maxAcceptedUsdValue()).to.be.equal(maxAcceptedUsdValue);
      expect(await simplePayContract.seller()).to.be.equal(sellerWalletAddress);
      expect(await simplePayContract.supportedTokenAddress(ethers.constants.AddressZero)).to.be.true;
      expect(await simplePayContract.supportedTokenAddress(usdcToken.address)).to.be.false;
    });

    it("[SimplePay] deposit" , async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("pay_vp_id"));

      const payContractAddress = await depositFactoryContract.getPayContract(sellerWalletAddress);
      const simplePayContract = await ethers.getContractAt("SimplePay", payContractAddress);

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          ethers.constants.AddressZero,
          maxAcceptedUsdValue + 1,
          vpId
        )
      ).to.be.revertedWith("USD value is greater than max accepted usd value");

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          usdcToken.address,
          maxAcceptedUsdValue,
          vpId
        )
      ).to.be.revertedWith("Not supported token!");

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          ethers.constants.AddressZero,
          1 * 10 ** USD_DECIMALS,
          vpId, {
            value: 0,
          }
        )
      ).to.be.revertedWith("Insufficient native token balances");

      const price = await simplePayContract.getPrice(1 * 10 ** USD_DECIMALS, ethers.constants.AddressZero); // wei

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          ethers.constants.AddressZero,
          1 * 10 ** USD_DECIMALS,
          vpId, {
            value: price,
          }
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(sellerWallet).updateSupportTokenOfPayContract(
          usdcToken.address,
          true,
          sellerWalletAddress
        )
      ).to.be.fulfilled;

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          usdcToken.address,
          maxAcceptedUsdValue,
          vpId
        )
      ).to.be.revertedWith("vpID is already used");

      const newVpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_pay_vp_id"));

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          usdcToken.address,
          maxAcceptedUsdValue,
          newVpId
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");

      const usdcPrice = await simplePayContract.getPrice(1 * 10 ** USD_DECIMALS, usdcToken.address); // wei

      await expect(
        usdcToken.connect(clientWallet).approve(simplePayContract.address, usdcPrice)
      ).to.be.fulfilled;

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          usdcToken.address,
          1 * 10 ** USD_DECIMALS,
          newVpId
        )
      ).to.be.fulfilled;

      await expect(
        simplePayContract.connect(sellerWallet).setReceiveStatus(vpId)
      ).to.be.revertedWith("Caller is not a factory contract");

      await expect(
        depositFactoryContract.connect(sellerWallet).setPayReceiveStatus(vpId, sellerWalletAddress)
      ).to.be.revertedWith("AccessControl: account 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc is missing role 0x21702c8af46127c7fa207f89d0b0a8441bb32959a0ac7df790e9ab1a25c98926");

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setPayReceiveStatus(vpId, sellerWalletAddress)
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setPayReceiveStatus(vpId, sellerWalletAddress)
      ).to.be.revertedWith("This depositItem is already paid");
    });

    it("[SimplePay] withdrawDeposit" , async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("pay_vp_id"));
      const newVpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_pay_vp_id"));

      const payContractAddress = await depositFactoryContract.getPayContract(sellerWalletAddress);
      const simplePayContract = await ethers.getContractAt("SimplePay", payContractAddress);

      const depositItemIndex1 = await simplePayContract.vpOfDepositItems(vpId);
      expect(depositItemIndex1).to.be.equal(1);

      await expect(
        simplePayContract.connect(sellerWallet).withdrawDeposit(depositItemIndex1)
      ).to.be.revertedWith("Caller is not a buyer");

      await expect(
        simplePayContract.connect(clientWallet).withdrawDeposit(depositItemIndex1)
      ).to.be.revertedWith("Deadline is not passed");

      await delay(6_000);

      await expect(
        simplePayContract.connect(clientWallet).withdrawDeposit(depositItemIndex1)
      ).to.be.revertedWith("This depositItem is already delivered");

      const depositItemIndex2 = await simplePayContract.vpOfDepositItems(newVpId);
      expect(depositItemIndex2).to.be.equal(2);

      await expect(
        simplePayContract.connect(clientWallet).withdrawDeposit(depositItemIndex2)
      ).to.be.revertedWith("Deadline is not passed");

      await delay(10_000);

      console.log("balanceOf", (await usdcToken.balanceOf(simplePayContract.address)).toString());
      const allowance = await usdcToken.allowance(simplePayContract.address, clientWalletAddress);
      console.log("allowance", allowance.toString());

      await expect(
        simplePayContract.connect(clientWallet).withdrawDeposit(depositItemIndex2)
      ).to.be.revertedWith("ERC20: insufficient allowance");

      await expect(
        simplePayContract.connect(clientWallet).withdrawDeposit(depositItemIndex2)
      ).to.be.revertedWith("Caller is not a buyer");
    });
  });
});