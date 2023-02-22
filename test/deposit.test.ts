import { expect } from 'chai';
import { ethers, network } from 'hardhat';
const hre = require("hardhat");
import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import { parseUnits, formatUnits, parseEther } from "ethers/lib/utils";
import { DepositFactoryContract, LZEndpointMock, ReceiveFactoryContract, PolarysNftContract, TestToken } from "../typechain-types";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import {
  DepositItemData,
  getBigNumber,
  signDepositItemData,
} from './utils'
import { BigNumber, Contract, Signer } from 'ethers';

describe('Test multichain minting engine', () => {
  let depositFactoryContract: DepositFactoryContract
  let receiveFactoryContract: ReceiveFactoryContract
  let polarysNftContract: PolarysNftContract
  let lzEndpointMockSrc: LZEndpointMock
  let lzEndpointMockDst: LZEndpointMock
  let testTokenContract: TestToken
  let owner: SignerWithAddress
  let adminWallet: SignerWithAddress
  let seller: SignerWithAddress
  let client: SignerWithAddress
  let depositRoleAccount: SignerWithAddress
  
  let ownerAddress: string
  let adminWalletAddress: string
  let sellerAddress: string
  let clientAddress: string
  let depositRoleAddress: string

  const nftName = "Polarys test NFTS";
  const nftSymbol = "PTN";
  const tokenURI = "https://bafybeidyj2ases25wrcwyisxsbnfo6qe7oe4re5ql77uspoo6d33benknq.ipfs.nftstorage.link/";
  const totalSupply = 100;
  
  // use this chainId
  const chainIdSrc = 1;
  const chainIdDst = 2;
  const depositTokenDecimals = 6;
  let backendNonce = 0;

  before(async () => {
    [
      owner,
      adminWallet,
      seller,
      client,
      depositRoleAccount
    ] = await ethers.getSigners()
    ownerAddress = await owner.getAddress()
    adminWalletAddress = await adminWallet.getAddress()
    sellerAddress = await seller.getAddress()
    clientAddress = await client.getAddress()
    depositRoleAddress = await depositRoleAccount.getAddress()
    console.log('===================Deploying Contract=====================')


    // create a LayerZero Endpoint mock for testing
    const LayerZeroEndpointMock = await ethers.getContractFactory("LZEndpointMock")
    lzEndpointMockSrc = await LayerZeroEndpointMock.deploy(chainIdSrc)
    await lzEndpointMockSrc.deployed();
    lzEndpointMockDst = await LayerZeroEndpointMock.deploy(chainIdDst)
    await lzEndpointMockDst.deployed();
    
    // create test token contract
    const testTokenFactory = await ethers.getContractFactory("TestToken")
    testTokenContract = (await testTokenFactory.deploy("test", "TTT", depositTokenDecimals)) as TestToken
    await testTokenContract.deployed();

    // admin deploys depositFactoryContract
    const depositFactory = await ethers.getContractFactory("DepositFactoryContract")
    depositFactoryContract = (await depositFactory.deploy(
      lzEndpointMockSrc.address,
      testTokenContract.address,
      ownerAddress,
      adminWalletAddress,
      depositRoleAddress
    )) as DepositFactoryContract
    await depositFactoryContract.deployed()
    console.log('DepositFactoryContract deployed: ', depositFactoryContract.address)

    const receiveFactory = await ethers.getContractFactory("ReceiveFactoryContract")
    receiveFactoryContract = (await receiveFactory.deploy(
      lzEndpointMockDst.address
    )) as ReceiveFactoryContract
    await receiveFactoryContract.deployed()
    console.log('ReceiveFactoryContract deployed: ', receiveFactoryContract.address)

    await lzEndpointMockSrc.setDestLzEndpoint(receiveFactoryContract.address, lzEndpointMockDst.address)
    await lzEndpointMockDst.setDestLzEndpoint(depositFactoryContract.address, lzEndpointMockSrc.address)

    depositFactoryContract.setTrustedRemote(
      chainIdDst,
      ethers.utils.solidityPack(["address", "address"], [receiveFactoryContract.address, depositFactoryContract.address])
    )
    
    receiveFactoryContract.setTrustedRemote(
      chainIdSrc,
      ethers.utils.solidityPack(["address", "address"], [depositFactoryContract.address, receiveFactoryContract.address])
    )

    // admin mint test tokens to the client
    await testTokenContract.mint(clientAddress, getBigNumber(10000000, depositTokenDecimals));

    // seller creates nft contracts
    const receiveFactoryContractTransaction = await(await receiveFactoryContract.connect(seller).createNftContractBySeller(
      nftName,
      nftSymbol,
      tokenURI,
      totalSupply
    )).wait();

    if (receiveFactoryContractTransaction.status == 1) {
      const events = receiveFactoryContractTransaction.events;
      if (events && events.length) {
        for (const eventObject of events) {
          if (eventObject.event == "CreatedNftContract") {
            const nftContractAddress = eventObject.args["nftContractAddress"];
            polarysNftContract = (
              await ethers.getContractAt(
                'PolarysNftContract', 
                nftContractAddress
                )
              ) as PolarysNftContract;
            console.log(`PolarysNftContract is deployed at: ${nftContractAddress}`);
            break;
          }
        }
      }
    } else {
      console.log("error creating PolarysNftContract")
    }

  })

  describe('Client test', async () => {
    it('client deposit ERC20 tokens', async () => {
      const currentTimestamp = await helpers.time.latest();
      const deadline = currentTimestamp + 10 * 60;
      const depositItemData = {
        mintPrice: getBigNumber(1000, depositTokenDecimals),
        mintQuantity: 10,
        sellerAddress: sellerAddress,
        dstChainId: chainIdDst,
        isMintAvailable: true,
        nonce: backendNonce,
        deadline: deadline,
      };
      const {['nonce']: nonce, ...depositItem} = depositItemData;
      const signature = signDepositItemData(
        depositItemData,
        depositFactoryContract,
        depositRoleAccount
      );
      let adapterParams = ethers.utils.solidityPack(['uint16', 'uint256'], [1, 2000000])
      const _payload = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'address'],
        [clientAddress, depositItemData.mintQuantity, depositItemData.sellerAddress]
        // [ethers.constants.AddressZero, 0, ethers.constants.AddressZero]
      )
      const estimatedFee = await lzEndpointMockSrc.estimateFees(chainIdDst, depositFactoryContract.address, _payload, false, adapterParams)
      console.log('estimateFee is: ', formatUnits(estimatedFee.nativeFee))
      await testTokenContract.connect(client).approve(
        depositFactoryContract.address, 
        depositItemData.mintPrice
      );
      expect(formatUnits(await testTokenContract.balanceOf(clientAddress), depositTokenDecimals)).to.be.equal("10000000.0") // initial value
      expect(formatUnits(await testTokenContract.balanceOf(adminWalletAddress), depositTokenDecimals)).to.be.equal("0.0") // initial value
      expect(formatUnits(await testTokenContract.balanceOf(sellerAddress), depositTokenDecimals)).to.be.equal("0.0") // initial value

      await expect(depositFactoryContract.connect(client).depositTokenByClient(
        depositItem,
        signature,
        estimatedFee.nativeFee,
        false,
        {value: estimatedFee.nativeFee}
      )).to.be.not.reverted;
      console.log("admin wallet balance is: ", formatUnits(await testTokenContract.balanceOf(adminWalletAddress), depositTokenDecimals));
      expect(formatUnits(await testTokenContract.balanceOf(adminWalletAddress), depositTokenDecimals)).to.be.equal("25.0") // initial value
      expect(formatUnits(await testTokenContract.balanceOf(sellerAddress), depositTokenDecimals)).to.be.equal("975.0") // initial value
      const nftBalance = await polarysNftContract.balanceOf(clientAddress);
      console.log(`client has ${nftBalance} NFTs`);
    })

    it('client deposit native tokens', async () => {
      backendNonce += 1;
      const currentTimestamp = await helpers.time.latest();
      const deadline = currentTimestamp + 10 * 60;
      const depositItemData = {
        mintPrice: getBigNumber(100),
        mintQuantity: 20,
        sellerAddress: sellerAddress,
        dstChainId: chainIdDst,
        isMintAvailable: true,
        nonce: backendNonce,
        deadline: deadline,
      };
      const {['nonce']: nonce, ...depositItem} = depositItemData;
      const signature = signDepositItemData(
        depositItemData,
        depositFactoryContract,
        depositRoleAccount
      );
      let adapterParams = ethers.utils.solidityPack(['uint16', 'uint256'], [1, 2000000])
      const _payload = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'address'],
        [clientAddress, depositItemData.mintQuantity, depositItemData.sellerAddress]
        // [ethers.constants.AddressZero, 0, ethers.constants.AddressZero]
      )
      const estimatedFee = await lzEndpointMockSrc.estimateFees(chainIdDst, depositFactoryContract.address, _payload, false, adapterParams)
      console.log('estimateFee is: ', formatUnits(estimatedFee.nativeFee))
      await testTokenContract.connect(client).approve(
        depositFactoryContract.address, 
        depositItemData.mintPrice
      );
      console.log("client balance before tx: ", formatUnits(await client.getBalance()));
      console.log("adminWallet balance before tx: ", formatUnits(await adminWallet.getBalance()));
      console.log("seller balance before tx: ", formatUnits(await seller.getBalance()));
      await expect(
        depositFactoryContract
        .connect(client)
        .depositTokenByClient(
          depositItem,
          signature,
          estimatedFee.nativeFee,
          true,
          {value: estimatedFee.nativeFee.add(depositItemData.mintPrice) }
        )
      ).to.be.not.reverted;

      console.log("client balance after tx: ", formatUnits(await client.getBalance()));
      console.log("adminWallet balance after tx: ", formatUnits(await adminWallet.getBalance()));
      console.log("seller balance after tx: ", formatUnits(await seller.getBalance()));
      const nftBalance = await polarysNftContract.balanceOf(clientAddress);
      console.log(`client has ${nftBalance} NFTs`);
    })
  })
});
