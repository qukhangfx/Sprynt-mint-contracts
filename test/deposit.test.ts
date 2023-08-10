import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";

import {
  DepositFactoryContract,
  ReceiveFactoryContract,
  ERC1155,
  TestToken,
  DepositContract,
  RPaymentContract,
  StaticDataFeed,
  ChainLinkPriceFeed,
  SimplePay,
  ERC1155Contract,
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

const getUsdNumber = (amount: number) => {
  return getBigNumber(amount, USD_DECIMALS);
}

const getUsdcNumber = (amount: number) => {
  return getBigNumber(amount, 6);
}

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

const AccessControlInterfaceId = "0x01ffc9a7";
const ERC1155InterfaceId = "0xd9b67a26";
const ERC721InterfaceId = "0x80ac58cd";

describe("Test multichain minting engine", () => {
  let usdcToken: TestToken;

  let depositFactoryContract: DepositFactoryContract;
  let receiveFactoryContract: ReceiveFactoryContract;

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

  let nftName = "Banh tet La Cam";
  let nftSymbol = "bTET";

  const tokenURI = "https://bafybeidyj2ases25wrcwyisxsbnfo6qe7oe4re5ql77uspoo6d33benknq.ipfs.nftstorage.link/";
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

    const StaticCustomTokenFeedFactory = await ethers.getContractFactory("StaticDataFeed");
    staticCustomTokenFeed = (await StaticCustomTokenFeedFactory.deploy(STATIC_TOKEN_PRICE, -1)) as StaticDataFeed;
    await staticCustomTokenFeed.deployed();

    const ChainlinkPriceFeed = await ethers.getContractFactory("ChainLinkPriceFeed");
    chainlinkPriceFeed = (await ChainlinkPriceFeed.connect(owner).deploy(
      staticNativeTokenFeed.address
    )) as ChainLinkPriceFeed;
    await chainlinkPriceFeed.deployed();

    await expect(
      chainlinkPriceFeed.connect(owner).transferOwner(validatorRoleAccountAddress)
    ).to.be.fulfilled;

    await expect(
      chainlinkPriceFeed.connect(validatorRoleAccount).transferOwner(ownerAddress)
    ).to.be.fulfilled;

    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    usdcToken = (await TestTokenFactory.deploy(
      erc20TokenName,
      erc20TokenSymbol,
      depositTokenDecimals
    )) as TestToken;
    await usdcToken.deployed();

    const DepositFactoryContractFactory = await ethers.getContractFactory(
      "DepositFactoryContract"
    );

    depositFactoryContract = (await DepositFactoryContractFactory.deploy(
      ownerAddress,
      adminWalletAddress,
      validatorRoleAccountAddress
    )) as DepositFactoryContract;
    await depositFactoryContract.deployed();

    await depositFactoryContract
      .connect(owner)
      .setupValidatorRole(validatorRoleAccountAddress);

    await expect(depositFactoryContract
      .connect(owner)
      .revokeValidatorRole(validatorRoleAccountAddress)).to.be.fulfilled;

    await expect(depositFactoryContract
      .connect(owner)
      .setupValidatorRole(validatorRoleAccountAddress)).to.be.fulfilled;

    await expect(depositFactoryContract
      .connect(owner)
      .setAdminWallet(adminWalletAddress)).to.be.fulfilled;

    await expect(depositFactoryContract.supportsInterface(AccessControlInterfaceId)).to.be.fulfilled;
    expect(await depositFactoryContract.supportsInterface(AccessControlInterfaceId)).to.be.true;

    const ReceiveFactoryContractFactory = await ethers.getContractFactory(
      "ReceiveFactoryContract"
    );

    receiveFactoryContract = (await ReceiveFactoryContractFactory.connect(owner).deploy()) as ReceiveFactoryContract;
    await receiveFactoryContract.deployed();

    await usdcToken.mint(
      clientWalletAddress,
      getBigNumber(10000000, depositTokenDecimals)
    );

    await receiveFactoryContract
      .connect(owner)
      .setupValidatorRole(validatorRoleAccountAddress);

    await expect(receiveFactoryContract
      .connect(owner)
      .revokeValidatorRole(validatorRoleAccountAddress)).to.be.fulfilled;

    await expect(receiveFactoryContract
      .connect(owner)
      .setupValidatorRole(validatorRoleAccountAddress)).to.be.fulfilled;

    const ERC1155Contract = await ethers.getContractFactory("ERC1155Contract");
    const erc1155Contract = await ERC1155Contract.deploy();
    await erc1155Contract.deployed();

    expect(await erc1155Contract.supportsInterface(AccessControlInterfaceId)).to.be.true;
    expect(await erc1155Contract.supportsInterface(ERC1155InterfaceId)).to.be.true;

    await (
      await receiveFactoryContract.setMasterNftContractAddress(
        erc1155Contract.address
      )
    ).wait();

    const DepositContract = await ethers.getContractFactory("DepositContract");
    const depositContract = await DepositContract.deploy();
    await depositContract.deployed();

    await (
      await depositFactoryContract.setMasterDepositContractAddress(
        depositContract.address
      )
    ).wait();

    expect(await depositContract.supportsInterface(ERC721InterfaceId)).to.be.true;

    const SimplePayContract = await ethers.getContractFactory("SimplePay");
    const simplePayContract = await SimplePayContract.deploy();
    await simplePayContract.deployed();

    await (
      await depositFactoryContract.setMasterPayContractAddress(
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
  });

  describe("Test", async () => {
    it("[ReceiveFactoryContract] seller can not create more than one NFT contract", async () => {
      await expect(
        receiveFactoryContract
          .connect(sellerWallet)
          .createNftContractBySeller(
            tokenURI,
            getUsdNumber(1)
          )
      ).to.be.fulfilled;

      await expect(
        receiveFactoryContract
          .connect(sellerWallet)
          .createNftContractBySeller(
            tokenURI,
            getUsdNumber(1)
          )
      ).to.be.revertedWith("ReceiveFactoryContract: already created nft contract.");

      const nftContractAddress = await receiveFactoryContract.getNftContractsOfAccount(
        sellerWalletAddress
      );

      expect(nftContractAddress).to.not.be.equal(ethers.constants.AddressZero);

      const nftContract = await ethers.getContractAt(
        "ERC1155Contract",
        nftContractAddress
      ) as ERC1155Contract;

      await expect(
        nftContract.getNumberOfMintedTokens()
      ).to.be.fulfilled;

      await expect(nftContract.connect(clientWallet).setFactoryContractAddress(depositFactoryContract.address)).to.be.revertedWith("ERC1155: caller is not a seller");
      await expect(nftContract.connect(sellerWallet).setFactoryContractAddress(depositFactoryContract.address)).to.be.fulfilled;

      const tokenURI_ = await nftContract.uri(1);
      expect(tokenURI_).to.be.equal(`${tokenURI}1`);

      const usdPrice = await nftContract.usdPrice();
      expect(usdPrice).to.be.equal(getUsdNumber(1));

      const owner_ = await nftContract.owner();
      expect(owner_).to.be.equal(sellerWalletAddress);

      await expect(
        nftContract.connect(sellerWallet).setName(nftName)
      ).to.be.fulfilled;

      const nftName_ = await nftContract.name();
      expect(nftName_).to.be.equal(nftName);

      await expect(
        nftContract.connect(sellerWallet).setSymbol(nftSymbol)
      ).to.be.fulfilled;

      const nftSymbol_ = await nftContract.symbol();
      expect(nftSymbol_).to.be.equal(nftSymbol);

      await expect(receiveFactoryContract.connect(validatorRoleAccount).setBaseURI(
        nftContract.address,
        tokenURI
      )).to.be.fulfilled;

      await expect(receiveFactoryContract.connect(validatorRoleAccount).setName(
        nftContract.address,
        nftName
      )).to.be.fulfilled;

      await expect(receiveFactoryContract.connect(validatorRoleAccount).setSymbol(
        nftContract.address,
        nftSymbol
      )).to.be.fulfilled;

      await expect(receiveFactoryContract.connect(validatorRoleAccount).mint(
        sellerWalletAddress,
        clientWalletAddress,
        1,
        "0x"
      )).to.be.fulfilled;

      await expect(receiveFactoryContract.connect(validatorRoleAccount).mint(
        sellerWalletAddress,
        clientWalletAddress,
        2,
        "0x"
      )).to.be.fulfilled;

      await expect(receiveFactoryContract.connect(validatorRoleAccount).mint(
        sellerWalletAddress,
        ethers.constants.AddressZero,
        2,
        "0x"
      )).to.be.revertedWith("ERC1155: address must not be zero address");
    });

    it("[StaticDataFeed] latest round data", async () => {
      let price: BigNumber;
      [, price, , ,] = await staticNativeTokenFeed.latestRoundData();
      expect(price).to.be.equal(STATIC_NATIVE_PRICE);
    });

    it("[PriceFeed] convert USD to token amount", async () => {
      const usdValue = getUsdNumber(1);
      const usdValueToNativeToken = await chainlinkPriceFeed.convertUsdToTokenPrice(usdValue, ethers.constants.AddressZero);
      const nativeToken = Number(usdValueToNativeToken) / 10 ** 18;
      expect(isFloatEqual(nativeToken, 0.00053)).to.be.true;
    });

    it("[PriceFeed] convert token amount to USD", async () => {
      const ethToUsd = await chainlinkPriceFeed.convertTokenPriceToUsd(getBigNumber(0.000533746609774971), ethers.constants.AddressZero);
      const usdValue = Number(ethToUsd) / 10 ** 8;
      expect(isFloatEqual(usdValue, 1.0)).to.be.true;

      await expect(
        chainlinkPriceFeed.connect(owner).setNativeTokenPriceFeedAddress(staticNativeTokenFeed.address)
      ).to.be.fulfilled;

      await expect(
        chainlinkPriceFeed.convertTokenPriceToUsd(getBigNumber(1, 6), usdcToken.address)
      ).to.be.revertedWith("PriceFeed: not supported token!");
    });

    it("[Paylink] pay: revert with 'Paylink: not supported token!'", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));

      const usdValue = getUsdNumber(1);

      await expect(
        rPaymentContract.connect(clientWallet).pay(
          "0x0000000000000000000000000000000000000001",
          sellerWalletAddress,
          usdValue,
          vpId
        )
      ).to.be.revertedWith("Paylink: not supported token!");
    });

    it("[Paylink] pay: revert with 'Paylink: insufficient native token balances'", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));

      const usdValue = getUsdNumber(1);

      await expect(
        rPaymentContract.connect(clientWallet).pay(
          ethers.constants.AddressZero,
          sellerWalletAddress,
          usdValue,
          vpId
        )
      ).to.be.revertedWith("Paylink: insufficient native token balances");
    });

    it("[Paylink] pay: revert with 'Paylink: Insufficient native token balances'", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));

      const usdValue = getUsdNumber(1);

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
      ).to.be.revertedWith("Paylink: insufficient native token balances");
    });

    it("[Paylink] pay: happy case", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));

      const usdValue = getUsdNumber(1);

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

    it("[Paylink] pay: revert with 'Paylink: already paid!'", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));

      const usdValue = getUsdNumber(1);

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
      ).to.be.revertedWith("Paylink: already paid!");
    });

    it("[Recurring Payment] setup by sprynt's validator", async () => {
      const subscriptionId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("subscription_id"));
      const usdValue = getUsdNumber(1);
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

      const sellerAddress_ = await rPaymentContract.subscriptionOwner(subscriptionId);
      expect(sellerAddress_).to.be.equal(sellerWalletAddress);
    });

    it("[Recurring Payment] subscribe / native token: revert with 'RPaymentContract: not supported native token!'", async () => {
      const subscriptionId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("subscription_id"));
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("vp_id"));

      const usdValue = getUsdNumber(1);
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
      ).to.be.revertedWith("RPaymentContract: not supported native token!");
    });

    it("[Recurring Payment] subscribe / custom token", async () => {
      const subscriptionId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("subscription_id"));
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("vp_id"));

      const usdValue = getUsdNumber(1);

      const [tokenSymbol, tokenDecimals] = await chainlinkPriceFeed.getTokenInfo(usdcToken.address);
      expect(tokenSymbol).to.be.equal("USDC");
      expect(tokenDecimals).to.be.equal(6);

      await expect(
        rPaymentContract.getPrice(usdValue, usdcToken.address)
      ).to.be.revertedWith("PriceFeed: not supported token!");

      await expect(
        chainlinkPriceFeed.setPriceFeedAddress(tokenSymbol, staticCustomTokenFeed.address)
      ).to.be.fulfilled;

      expect(
        await chainlinkPriceFeed.getPriceFeedAddress(tokenSymbol)
      ).to.be.equal(staticCustomTokenFeed.address)

      const price = await rPaymentContract.getPrice(usdValue, usdcToken.address);
      expect(price.div(10 ** tokenDecimals)).to.be.equal(usdValue.div(10 ** USD_DECIMALS));

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
      ).to.be.revertedWith("RPaymentContract: already subscribe!");

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

    it("[Recurring Payment] renew / custom token", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("vp_id"));

      await expect(
        rPaymentContract.connect(sellerWallet).renew(
          clientWalletAddress,
          vpId,
        )
      ).to.be.revertedWith("RPaymentContract: not yet time to renew!");

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

    it("[Recurring Payment] disable", async () => {
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
      ).to.be.revertedWith("RPaymentContract: subscription is disabled!");
    });

    const maxAcceptedUsdValue = getUsdNumber(3);
    const deadline = 0; // 0 seconds

    it("[DepositFactoryContract] createPayContractBySeller", async () => {
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

    it("[Simple Pay] initialized", async () => {
      const payContractAddress = await depositFactoryContract.getPayContract(sellerWalletAddress);
      const simplePayContract = await ethers.getContractAt("SimplePay", payContractAddress) as SimplePay;
      expect(simplePayContract.address).to.be.equal(payContractAddress);
      expect(await simplePayContract.initialized()).to.be.true;
      expect(await simplePayContract.deadline()).to.be.equal(deadline);
      expect(await simplePayContract.maxAcceptedUsdValue()).to.be.equal(maxAcceptedUsdValue);
      expect(await simplePayContract.seller()).to.be.equal(sellerWalletAddress);
      expect(await simplePayContract.supportedTokenAddress(ethers.constants.AddressZero)).to.be.true;
      expect(await simplePayContract.supportedTokenAddress(usdcToken.address)).to.be.false;

      // await expect(
      //   simplePayContract.connect(clientWallet).transferOwner(clientWalletAddress)
      // ).to.be.revertedWith("SimplePay: caller is not a seller");

      // await expect(
      //   simplePayContract.connect(clientWallet).transferOwner(clientWalletAddress)
      // ).to.be.revertedWith("SimplePay: caller is not a seller");

      // await expect(
      //   simplePayContract.connect(clientWallet).transferOwner(clientWalletAddress)
      // ).to.be.revertedWith("SimplePay: caller is not a seller");

      const calcPayFeeAmount = await depositFactoryContract.calcPayFeeAmount(0);
      expect(calcPayFeeAmount).to.be.equal(0);

      await expect(
        depositFactoryContract.connect(owner).setPayChainlinkPriceFeedAddress(
          sellerWalletAddress,
          chainlinkPriceFeed.address
        )
      ).to.be.fulfilled;

      await expect(
        simplePayContract.connect(sellerWallet).updateMaxAcceptedUsdValue(
          maxAcceptedUsdValue
        )
      ).to.be.fulfilled;

      await expect(
        simplePayContract.connect(sellerWallet).updateDeadline(
          deadline
        )
      ).to.be.fulfilled;

      await expect(
        simplePayContract.getSupportedTokenList()
      ).to.be.fulfilled;
    });

    it("[Simple Pay] deposit", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("pay_vp_id"));

      const payContractAddress = await depositFactoryContract.getPayContract(sellerWalletAddress);
      const simplePayContract = await ethers.getContractAt("SimplePay", payContractAddress) as SimplePay;

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          ethers.constants.AddressZero,
          maxAcceptedUsdValue.add(1),
          vpId
        )
      ).to.be.revertedWith("SimplePay: USD value is greater than max accepted usd value");

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          usdcToken.address,
          maxAcceptedUsdValue,
          vpId
        )
      ).to.be.revertedWith("SimplePay: not supported token!");

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          ethers.constants.AddressZero,
          getUsdNumber(1),
          vpId,
          {
            value: 0,
          }
        )
      ).to.be.revertedWith("SimplePay: insufficient native token balances");

      const price = await simplePayContract.getPrice(getUsdNumber(1), ethers.constants.AddressZero); // wei

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          ethers.constants.AddressZero,
          getUsdNumber(1),
          vpId,
          {
            value: price,
          }
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).updateSupportTokenOfPayContract(
          sellerWalletAddress,
          usdcToken.address,
          true
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).updateSupportTokenOfPayContract(
          sellerWalletAddress,
          usdcToken.address,
          false
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).updateSupportTokenOfPayContract(
          sellerWalletAddress,
          usdcToken.address,
          true
        )
      ).to.be.fulfilled;

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          usdcToken.address,
          maxAcceptedUsdValue,
          vpId
        )
      ).to.be.revertedWith("SimplePay: vp id is already used");

      const newVpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_pay_vp_id"));

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          usdcToken.address,
          maxAcceptedUsdValue,
          newVpId
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");

      const usdcPrice = await simplePayContract.getPrice(getUsdNumber(1), usdcToken.address); // wei

      await expect(
        usdcToken.connect(clientWallet).approve(simplePayContract.address, usdcPrice)
      ).to.be.fulfilled;

      let balanceOf_ = await usdcToken.balanceOf(simplePayContract.address);
      expect(balanceOf_).to.be.equal(0);

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          usdcToken.address,
          getUsdNumber(1),
          newVpId
        )
      ).to.be.fulfilled;

      balanceOf_ = await usdcToken.balanceOf(simplePayContract.address);
      expect(balanceOf_).to.be.equal(getUsdcNumber(1));

      await expect(
        simplePayContract.connect(sellerWallet).setReceiveStatus(vpId)
      ).to.be.revertedWith("SimplePay: caller is not a factory contract");

      await expect(
        depositFactoryContract.connect(sellerWallet).setPayReceiveStatus(sellerWalletAddress, vpId)
      ).to.be.revertedWith("DepositFactoryContract: sender does not have the required role");

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setPayReceiveStatus(sellerWalletAddress, vpId)
      ).to.be.fulfilled;

      const depositItemIndex1 = await simplePayContract.vpOfDepositItems(vpId);
      expect(depositItemIndex1).to.be.equal(1);
      expect(await simplePayContract.isReceived(depositItemIndex1)).to.be.true;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setPayReceiveStatus(sellerWalletAddress, vpId)
      ).to.be.revertedWith("SimplePay: this deposit item is already paid");
    });

    it("[Simple Pay] withdraw deposit", async () => {
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("pay_vp_id"));
      const newVpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_pay_vp_id"));

      const payContractAddress = await depositFactoryContract.getPayContract(sellerWalletAddress);
      const simplePayContract = await ethers.getContractAt("SimplePay", payContractAddress) as SimplePay;

      const depositItemIndex1 = await simplePayContract.vpOfDepositItems(vpId);
      expect(depositItemIndex1).to.be.equal(1);
      expect(await simplePayContract.isReceived(depositItemIndex1)).to.be.true;

      await expect(
        simplePayContract.connect(sellerWallet).withdrawDeposit(depositItemIndex1)
      ).to.be.revertedWith("SimplePay: caller is not a buyer");

      await expect(
        simplePayContract.connect(clientWallet).withdrawDeposit(depositItemIndex1)
      ).to.be.revertedWith("SimplePay: this depositItem is already delivered");

      const depositItemIndex2 = await simplePayContract.vpOfDepositItems(newVpId);
      expect(depositItemIndex2).to.be.equal(2);

      let balanceOf_ = await usdcToken.balanceOf(simplePayContract.address);
      expect(balanceOf_).to.be.equal(getUsdcNumber(1));

      await expect(
        simplePayContract.connect(clientWallet).withdrawDeposit(depositItemIndex2)
      ).to.be.fulfilled;

      balanceOf_ = await usdcToken.balanceOf(simplePayContract.address);
      expect(balanceOf_).to.be.equal(0);

      await expect(
        simplePayContract.connect(clientWallet).withdrawDeposit(depositItemIndex2)
      ).to.be.revertedWith("SimplePay: caller is not a buyer");
    });

    it("[Simple Pay] withdraw fund", async () => {
      const payContractAddress = await depositFactoryContract.getPayContract(sellerWalletAddress);
      const simplePayContract = await ethers.getContractAt("SimplePay", payContractAddress) as SimplePay;

      expect(await simplePayContract.allowances(ethers.constants.AddressZero)).to.be.equal(533746609774971);
      expect(await simplePayContract.allowances(usdcToken.address)).to.be.equal(0);

      const usdValue = getUsdNumber(2);

      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_pay_vp_id_withdraw_fund"));
      const price = await simplePayContract.getPrice(usdValue, usdcToken.address);
      await expect(
        usdcToken.connect(clientWallet).approve(simplePayContract.address, price)
      ).to.be.fulfilled;

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          usdcToken.address,
          usdValue,
          vpId
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setPayReceiveStatus(sellerWalletAddress, vpId)
      ).to.be.fulfilled;

      expect(await simplePayContract.allowances(usdcToken.address)).to.be.equal(price);

      await expect(
        simplePayContract.connect(clientWallet).withdrawFund(usdcToken.address)
      ).to.be.revertedWith("SimplePay: caller is not a seller");

      await expect(
        simplePayContract.connect(sellerWallet).withdrawFund(usdcToken.address)
      ).to.be.fulfilled;

      expect(await simplePayContract.allowances(usdcToken.address)).to.be.equal(0);

      expect(await simplePayContract.allowances(ethers.constants.AddressZero)).to.be.equal(533746609774971);

      await expect(
        simplePayContract.connect(sellerWallet).withdrawFund(ethers.constants.AddressZero)
      ).to.be.fulfilled;

      expect(await simplePayContract.allowances(ethers.constants.AddressZero)).to.be.equal(0);
    });

    it("[Simple Pay] buyer - refund", async () => {
      const payContractAddress = await depositFactoryContract.getPayContract(sellerWalletAddress);
      const simplePayContract = await ethers.getContractAt("SimplePay", payContractAddress) as SimplePay;

      const usdValue = getUsdNumber(3);

      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_pay_vp_id_refund"));
      const price = await simplePayContract.getPrice(usdValue, usdcToken.address);
      await expect(
        usdcToken.connect(clientWallet).approve(simplePayContract.address, price)
      ).to.be.fulfilled;

      await expect(
        simplePayContract.connect(clientWallet).deposit(
          usdcToken.address,
          usdValue,
          vpId
        )
      ).to.be.fulfilled;

      await expect(simplePayContract.connect(clientWallet).refund(ethers.constants.AddressZero)).to.be.fulfilled;

      {
        const beforeRefund = await usdcToken.balanceOf(clientWalletAddress);

        await expect(
          simplePayContract.connect(clientWallet).refund(usdcToken.address)
        ).to.be.fulfilled;

        const afterRefund = await usdcToken.balanceOf(clientWalletAddress);
        expect(afterRefund.sub(beforeRefund)).to.be.equal(price);
      }
    });

    it("[Deposit Contract] initialize", async () => {
      const usdMintPrice = getUsdNumber(2);
      const usdWhitelistMintPrice = getUsdNumber(1);
      const deadline = Math.floor(Date.now() / 1000) + 2; // 2 seconds

      await expect(
        depositFactoryContract.connect(owner).createDepositContractBySeller(
          validatorRoleAccountAddress,
          [ethers.constants.AddressZero],
          usdMintPrice,
          usdWhitelistMintPrice,
          1,
          3,
          10,
          deadline,
          1,
          [
            validatorRoleAccount.address,
          ],
          chainlinkPriceFeed.address
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(owner).createDepositContractBySeller(
          sellerWalletAddress,
          [ethers.constants.AddressZero],
          usdMintPrice.add(1),
          usdWhitelistMintPrice.add(1),
          0,
          2,
          12,
          deadline + 1,
          2,
          [],
          chainlinkPriceFeed.address
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(owner).createDepositContractBySeller(
          sellerWalletAddress,
          [ethers.constants.AddressZero],
          usdMintPrice,
          usdWhitelistMintPrice,
          1,
          3,
          10,
          deadline,
          1,
          [
            validatorRoleAccount.address,
          ],
          chainlinkPriceFeed.address
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).updateSupportTokenOfDepositContract(
          clientWalletAddress,
          usdcToken.address,
          true
        )
      ).to.be.revertedWith("DepositFactoryContract: deposit contract is not created.");

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setTokenName(
          sellerWalletAddress,
          nftName
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setTokenBaseURI(
          sellerWalletAddress,
          tokenURI
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setTokenSymbol(
          sellerWalletAddress,
          nftSymbol
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).changeMintPrice(
          sellerWalletAddress,
          usdMintPrice,
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).changeWhiteListMintPrice(
          sellerWalletAddress,
          usdWhitelistMintPrice,
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).changeDeadline(
          sellerWalletAddress,
          deadline + 120 // 2 minutes
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).changeDepositDeadline(
          sellerWalletAddress,
          1
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).changeTotalSupply(
          sellerWalletAddress,
          12
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).changeStage(
          sellerWalletAddress,
          0
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setTokenURI(
          sellerWalletAddress,
          1,
          `${tokenURI}1`
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setTokenBaseURI(
          sellerWalletAddress,
          tokenURI
        )
      ).to.be.fulfilled;

      const calcMintFeeAmount = await depositFactoryContract.calcMintFeeAmount(usdMintPrice);
      expect(calcMintFeeAmount).to.be.equal(0);

      await expect(
        depositFactoryContract.connect(owner).pause()
      ).to.be.revertedWith("DepositFactoryContract: caller is not the admin wallet");

      await expect(
        depositFactoryContract.connect(adminWallet).pause()
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(adminWallet).pause()
      ).to.be.revertedWith("Pausable: paused");

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).changeStage(
          sellerWalletAddress,
          0
        )
      ).to.be.revertedWith("Pausable: paused");

      await expect(
        depositFactoryContract.connect(sellerWallet).unpause()
      ).to.be.revertedWith("DepositFactoryContract: caller is not the admin wallet");

      await expect(
        depositFactoryContract.connect(adminWallet).unpause()
      ).to.be.fulfilled;
    });

    it("[Deposit Contract] mint / native token", async () => {
      const depositItem = {
        sellerAddress: sellerWalletAddress,
        mintQuantity: 1,
        mintPrice: getUsdNumber(2),
      };

      const depositContractAddress = await depositFactoryContract.getDepositContract(
        depositItem.sellerAddress
      );
      expect(depositContractAddress).to.not.be.equal(ethers.constants.AddressZero);

      const depositContract = await ethers.getContractAt(
        "DepositContract",
        depositContractAddress
      ) as DepositContract;

      expect(
        await depositContract.name()
      ).to.be.equal(nftName);

      expect(
        await depositContract.symbol()
      ).to.be.equal(nftSymbol);

      expect(
        await depositContract.tokenURI(0)
      ).to.be.equal(`${tokenURI}0`);

      await expect(
        depositContract.connect(clientWallet).mint(
          depositItem,
          ethers.constants.AddressZero,
        )
      ).to.be.revertedWith("DepositContract: we have not ready yet!");

      expect(
        await depositContract.initialized()
      ).to.be.true;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).changeStage(
          sellerWalletAddress,
          1
        )
      ).to.be.fulfilled;

      await expect(
        depositContract.connect(clientWallet).mint(
          {
            ...depositItem,
            sellerAddress: validatorRoleAccountAddress,
          },
          ethers.constants.AddressZero,
        )
      ).to.be.revertedWith("DepositContract: invalid seller!");

      await expect(
        depositContract.connect(clientWallet).mint(
          {
            ...depositItem,
            mintQuantity: 100,
          },
          ethers.constants.AddressZero,
        )
      ).to.be.revertedWith("DepositContract: invalid mint quantity!");

      await expect(
        depositContract.connect(clientWallet).mint(
          depositItem,
          ethers.constants.AddressZero,
        )
      ).to.be.revertedWith("DepositContract: you are not in white list!");

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).addWhiteList(
          sellerWalletAddress,
          [clientWalletAddress]
        )
      ).to.be.fulfilled;

      await expect(
        depositContract.connect(clientWallet).mint(
          depositItem,
          ethers.constants.AddressZero,
        )
      ).to.be.revertedWith("DepositContract: invalid white list mint price!");

      await expect(
        depositContract.connect(clientWallet).mint(
          {
            ...depositItem,
            mintPrice: getUsdNumber(1),
          },
          usdcToken.address,
        )
      ).to.be.revertedWith("DepositContract: not supported token!");

      await expect(
        depositContract.connect(clientWallet).mint(
          {
            ...depositItem,
            mintPrice: getUsdNumber(1),
          },
          ethers.constants.AddressZero,
        )
      ).to.be.revertedWith("DepositContract: insufficient native token balances");

      const price = await depositContract.getPrice(
        getUsdNumber(1),
        ethers.constants.AddressZero,
      );

      await expect(
        depositContract.connect(clientWallet).mint(
          {
            ...depositItem,
            mintPrice: getUsdNumber(1),
          },
          ethers.constants.AddressZero,
          {
            value: price,
          }
        )
      ).to.be.fulfilled;

      const [owner_, deadline_, value_, amount_, token_] = await depositContract._depositItems(1);
      expect(owner_).to.be.equal(clientWalletAddress);
      expect(value_).to.be.equal(price);
      expect(amount_).to.be.equal(1);
      expect(token_).to.be.equal(ethers.constants.AddressZero);
    });

    it("[Deposit Contract] mint / custom token", async () => {
      const depositItem = {
        sellerAddress: sellerWalletAddress,
        mintQuantity: 1,
        mintPrice: getUsdNumber(2),
      };

      const depositContractAddress = await depositFactoryContract.getDepositContract(
        depositItem.sellerAddress
      );
      expect(depositContractAddress).to.not.be.equal(ethers.constants.AddressZero);

      const depositContract = await ethers.getContractAt(
        "DepositContract",
        depositContractAddress
      ) as DepositContract;

      const price = await depositContract.getPrice(
        getUsdNumber(1),
        usdcToken.address,
      );

      await expect(
        depositContract.connect(clientWallet).mint(
          {
            ...depositItem,
            mintPrice: getUsdNumber(1),
          },
          usdcToken.address,
        )
      ).to.be.revertedWith("DepositContract: not supported token!");

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).updateSupportTokenOfDepositContract(
          sellerWalletAddress,
          usdcToken.address,
          true,
        )
      ).to.be.fulfilled;

      await expect(
        depositContract.connect(clientWallet).mint(
          {
            ...depositItem,
            mintPrice: getUsdNumber(1),
          },
          usdcToken.address,
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");

      await expect(
        usdcToken.connect(clientWallet).approve(
          depositContract.address,
          price,
        )
      ).to.be.fulfilled;

      await expect(
        depositContract.connect(clientWallet).mint(
          {
            ...depositItem,
            mintPrice: getUsdNumber(1),
          },
          usdcToken.address,
        )
      ).to.be.fulfilled;

      const [owner_, deadline_, value_, amount_, token_] = await depositContract._depositItems(2);
      expect(owner_).to.be.equal(clientWalletAddress);
      expect(value_).to.be.equal(price);
      expect(amount_).to.be.equal(1);
      expect(token_).to.be.equal(usdcToken.address);

      await expect(
        usdcToken.connect(clientWallet).approve(
          depositContract.address,
          price,
        )
      ).to.be.fulfilled;

      await expect(
        depositContract.connect(clientWallet).mint(
          {
            ...depositItem,
            mintPrice: getUsdNumber(1),
          },
          usdcToken.address,
        )
      ).to.be.fulfilled;
    });

    it("[Deposit Contract] set receive status", async () => {
      const depositContractAddress = await depositFactoryContract.getDepositContract(
        sellerWalletAddress
      );
      expect(depositContractAddress).to.not.be.equal(ethers.constants.AddressZero);

      const depositContract = await ethers.getContractAt(
        "DepositContract",
        depositContractAddress
      ) as DepositContract;

      await expect(
        depositContract.connect(clientWallet).setReceiveStatus(1)
      ).to.be.revertedWith("DepositContract: caller is not a factory contract");

      await expect(
        depositContract.connect(sellerWallet).setReceiveStatus(1)
      ).to.be.revertedWith("DepositContract: caller is not a factory contract");

      await expect(
        depositContract.connect(validatorRoleAccount).setReceiveStatus(1)
      ).to.be.revertedWith("DepositContract: caller is not a factory contract");

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setReceiveStatus(
          sellerWalletAddress,
          1
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setReceiveStatus(
          sellerWalletAddress,
          1
        )
      ).to.be.revertedWith("DepositContract: this deposit item is already received!");

      let _mintedTokens = await depositContract.getTotalMintedToken();
      expect(_mintedTokens).to.be.equal(1);

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).changeTotalSupply(
          sellerWalletAddress,
          1
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setReceiveStatus(
          sellerWalletAddress,
          2
        )
      ).to.be.revertedWith("DepositContract: exceed total supply!");

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).changeTotalSupply(
          sellerWalletAddress,
          3
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setReceiveStatus(
          sellerWalletAddress,
          2
        )
      ).to.be.fulfilled;

      _mintedTokens = await depositContract.getTotalMintedToken();
      expect(_mintedTokens).to.be.equal(2);
    });

    it("[Deposit Contract] withdraw deposit", async () => {
      const depositContractAddress = await depositFactoryContract.getDepositContract(
        sellerWalletAddress
      );
      expect(depositContractAddress).to.not.be.equal(ethers.constants.AddressZero);

      const depositContract = await ethers.getContractAt(
        "DepositContract",
        depositContractAddress
      ) as DepositContract;

      await expect(
        depositContract.connect(clientWallet).withdrawDeposit(1)
      ).to.be.revertedWith("DepositContract: this deposit item is already received!");

      await expect(
        depositContract.connect(clientWallet).withdrawDeposit(2)
      ).to.be.revertedWith("DepositContract: this deposit item is already received!");

      const prevBalanceOf = await usdcToken.balanceOf(clientWalletAddress);

      await expect(
        depositContract.connect(clientWallet).withdrawDeposit(3)
      ).to.be.fulfilled;

      const curBalanceOf = await usdcToken.balanceOf(clientWalletAddress);
      expect(curBalanceOf).to.be.equal(prevBalanceOf.add(getUsdcNumber(1))); // Plus 1 USDC

      await expect(
        depositContract.connect(clientWallet).withdrawDeposit(3)
      ).to.be.revertedWith("DepositContract: caller is not the owner of this deposit item!");
    });

    it("[Deposit Contract] utils", async () => {
      const depositContractAddress = await depositFactoryContract.getDepositContract(
        sellerWalletAddress
      );
      expect(depositContractAddress).to.not.be.equal(ethers.constants.AddressZero);

      const depositContract = await ethers.getContractAt(
        "DepositContract",
        depositContractAddress
      ) as DepositContract;

      await expect(
        depositContract.getAllDepositItems()
      ).to.be.fulfilled;

      await expect(
        depositContract.getDepositItemByIndex(1)
      ).to.be.fulfilled;

      await expect(
        depositContract.getNumberOfDepositItems()
      ).to.be.fulfilled;

      await expect(
        depositContract.getFactoryContractAddress()
      ).to.be.fulfilled;

      await expect(
        depositContract.removeWhiteList([clientWalletAddress])
      ).to.be.revertedWith("DepositContract: no permission!");

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).removeWhiteList(sellerWalletAddress, [clientWalletAddress])
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).addWhiteList(sellerWalletAddress, [clientWalletAddress])
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).updateSupportTokenOfDepositContract(sellerWalletAddress, ethers.constants.AddressZero, false)
      ).to.be.fulfilled;

      expect(await depositContract.supportedTokenAddress(ethers.constants.AddressZero)).to.be.equal(false);
    });

    it("[Deposit Contract] ERC721's function", async () => {
      const depositContractAddress = await depositFactoryContract.getDepositContract(
        sellerWalletAddress
      );
      expect(depositContractAddress).to.not.be.equal(ethers.constants.AddressZero);

      const depositContract = await ethers.getContractAt(
        "DepositContract",
        depositContractAddress
      ) as DepositContract;

      await expect(
        depositContract.baseURI()
      ).to.be.fulfilled;

      await expect(
        depositContract.connect(clientWallet).setOwner(clientWalletAddress, [1])
      ).to.be.revertedWith("DepositContract: caller is not a factory contract");

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).setTokenOwner(sellerWalletAddress, clientWalletAddress, [1])
      ).to.be.fulfilled;

      const balanceOf = await depositContract.balanceOf(clientWalletAddress);
      expect(balanceOf).to.be.equal(1);

      const ownerOf = await depositContract.ownerOf(1);
      expect(ownerOf).to.be.equal(clientWalletAddress);

      expect(await depositContract.ownerOf(2)).to.be.equal(ethers.constants.AddressZero);

      expect(await depositContract.balanceOf(validatorRoleAccountAddress)).to.be.equal(0);

      await expect(
        depositContract.connect(validatorRoleAccount).transfer(clientWalletAddress, validatorRoleAccountAddress, 1)
      ).to.be.revertedWith("DepositContract: caller is not a factory contract");

      expect(await depositContract.balanceOf(validatorRoleAccountAddress)).to.be.equal(0);

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).transferToken(sellerWalletAddress, clientWalletAddress, validatorRoleAccountAddress, 1)
      ).to.be.fulfilled;

      expect(await depositContract.balanceOf(validatorRoleAccountAddress)).to.be.equal(1);
      expect(await depositContract.balanceOf(clientWalletAddress)).to.be.equal(1);
    });

    it("[Deposit Factory Contract] utils", async () => {
      await expect(
        depositFactoryContract.getAdminWallet()
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).changeMinMintQuantity(
          sellerWalletAddress,
          1
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(validatorRoleAccount).changeMaxMintQuantity(
          sellerWalletAddress,
          3
        )
      ).to.be.fulfilled;

      await expect(
        usdcToken.balanceOf(adminWalletAddress)
      ).to.be.fulfilled

      await expect(
        depositFactoryContract.connect(owner).setPlatformFeeMint(
          150
        )
      ).to.be.fulfilled;

      await expect(
        depositFactoryContract.connect(owner).setPlatformFeePay(
          150
        )
      ).to.be.fulfilled;
    });

    it("[Recurring Payment] utils", async () => {
      const subscriptionId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("subscription_id"));
      const newSubscriptionId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_subscription_id_2"));
      const clientSubscriptionId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_subscription_id_3"));
      const vpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_vp_id"));

      await expect(
        rPaymentContract.connect(sellerWallet).cancelByValidator(
          subscriptionId,
          vpId,
          clientWalletAddress
        )
      ).to.be.revertedWith("RPaymentContract: caller is not the validator!");

      await expect(
        rPaymentContract.connect(validatorRoleAccount).cancelByValidator(
          subscriptionId,
          vpId,
          clientWalletAddress
        )
      ).to.be.revertedWith("RPaymentContract: cancelled!");

      await expect(
        rPaymentContract.connect(sellerWallet).cancelBySeller(
          subscriptionId,
          vpId,
          clientWalletAddress
        )
      ).to.be.revertedWith("RPaymentContract: cancelled!");

      await expect(
        rPaymentContract.connect(sellerWallet).updateSupportToken(
          ethers.constants.AddressZero,
          false
        )
      ).to.be.revertedWith("RPaymentContract: caller is not the owner");

      const usdValue = getUsdNumber(1);

      await expect(
        rPaymentContract.connect(sellerWallet).setup(
          newSubscriptionId,
          usdValue,
          0
        )
      ).to.be.revertedWith("RPaymentContract: duration must be greater than 0!");


      await expect(
        rPaymentContract.connect(sellerWallet).setup(
          subscriptionId,
          usdValue,
          1
        )
      ).to.be.revertedWith("RPaymentContract: already setup!");

      await expect(
        rPaymentContract.connect(clientWallet).setup(
          clientSubscriptionId,
          usdValue,
          1
        )
      ).to.be.fulfilled;

      await expect(
        rPaymentContract.getLastestPayment(
          clientWalletAddress,
          vpId,
        )
      ).to.be.fulfilled;

      await expect(
        rPaymentContract.connect(clientWallet).unsubscribe(
          vpId,
        )
      ).to.be.revertedWith("RPaymentContract: caller is not the buyer!");

      const clientVpId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("client_vp_id"));

      await expect(
        rPaymentContract.connect(sellerWallet).subscribe(
          clientWalletAddress,
          clientSubscriptionId,
          clientVpId,
          usdcToken.address,
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");

      await expect(
        rPaymentContract.connect(owner).transferOwner(validatorRoleAccountAddress)
      ).to.be.fulfilled;

      await expect(
        rPaymentContract.connect(owner).transferOwner(validatorRoleAccountAddress)
      ).to.be.revertedWith("RPaymentContract: caller is not the owner");

      await expect(
        rPaymentContract.connect(validatorRoleAccount).setFactoryContractAddress(depositFactoryContract.address)
      ).to.be.fulfilled;

      await expect(
        rPaymentContract.connect(validatorRoleAccount).transferOwner(ownerAddress)
      ).to.be.fulfilled;

      await expect(
        rPaymentContract.connect(owner).updateSupportToken(
          usdcToken.address,
          false
        )
      ).to.be.fulfilled;

      expect(
        await rPaymentContract.supportedTokenAddress(usdcToken.address)
      ).to.be.false;

      await expect(
        rPaymentContract.connect(owner).updateSupportToken(
          usdcToken.address,
          true
        )
      ).to.be.fulfilled;

      expect(
        await rPaymentContract.supportedTokenAddress(usdcToken.address)
      ).to.be.true;

      await expect(
        usdcToken.connect(sellerWallet).approve(rPaymentContract.address, 3_000_000)
      ).to.be.fulfilled;

      await expect(
        rPaymentContract.connect(sellerWallet).subscribe(
          clientWalletAddress,
          clientSubscriptionId,
          clientVpId,
          usdcToken.address,
        )
      ).to.be.fulfilled;

      await expect(
        rPaymentContract.connect(sellerWallet).unsubscribe(
          clientVpId,
        )
      ).to.be.fulfilled;

      await expect(
        rPaymentContract.connect(sellerWallet).subscribe(
          clientWalletAddress,
          clientSubscriptionId,
          clientVpId,
          usdcToken.address,
        )
      ).to.be.revertedWith("RPaymentContract: already subscribe!");

      await expect(
        rPaymentContract.connect(sellerWallet).subscribe(
          clientWalletAddress,
          clientSubscriptionId,
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_vp_id_4")),
          usdcToken.address,
        )
      ).to.be.fulfilled;

      await expect(
        rPaymentContract.connect(clientWallet).cancelBySeller(
          clientSubscriptionId,
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_vp_id_4")),
          sellerWalletAddress,
        )
      ).to.be.fulfilled;

      await expect(
        rPaymentContract.connect(sellerWallet).subscribe(
          clientWalletAddress,
          clientSubscriptionId,
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_vp_id_5")),
          usdcToken.address,
        )
      ).to.be.fulfilled;

      await expect(
        rPaymentContract.connect(clientWallet).cancelByValidator(
          clientSubscriptionId,
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_vp_id_5")),
          sellerWalletAddress,
        )
      ).to.be.revertedWith("RPaymentContract: caller is not the validator!");

      await expect(
        rPaymentContract.connect(validatorRoleAccount).cancelByValidator(
          clientSubscriptionId,
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new_vp_id_5")),
          sellerWalletAddress,
        )
      ).to.be.fulfilled;
    });
  });
});