import { expect } from 'chai';
import { ethers, network } from 'hardhat';
const hre = require("hardhat");
import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import { parseUnits, formatUnits, parseEther } from "ethers/lib/utils";
import { LZEndpointMock, OmniCounter, PolarysNftContract, ReceiveFactoryContract, TestToken } from "../typechain-types";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import {
  DepositItemData,
  getBigNumber,
  signDepositItemData,
} from './utils'
import { BigNumber, Contract, Signer } from 'ethers';

describe('Omni test', () => {
  let omniCounterA: OmniCounter
  let omniCounterB: OmniCounter
  let receiveFactoryContract: ReceiveFactoryContract
  let lzEndpointMock: LZEndpointMock
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

  let totalPrice: BigNumber = getBigNumber(0);
  
  // use this chainId
  const chainId = 123;
  const depositTokenDecimals = 18;
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
    lzEndpointMock = await LayerZeroEndpointMock.deploy(chainId)
    await lzEndpointMock.deployed();
    
    const omniCounterFactory = await ethers.getContractFactory("OmniCounter")
    omniCounterA = await omniCounterFactory.deploy(lzEndpointMock.address)
    await omniCounterA.deployed()
    omniCounterB = await omniCounterFactory.deploy(lzEndpointMock.address)
    await omniCounterB.deployed()
    
    const receiveFactory = await ethers.getContractFactory("ReceiveFactoryContract")
    receiveFactoryContract = (await receiveFactory.deploy(
      lzEndpointMock.address
    )) as ReceiveFactoryContract
    await receiveFactoryContract.deployed()
    console.log('ReceiveFactoryContract deployed: ', receiveFactoryContract.address)
    
    await lzEndpointMock.setDestLzEndpoint(omniCounterA.address, lzEndpointMock.address)
    await lzEndpointMock.setDestLzEndpoint(receiveFactoryContract.address, lzEndpointMock.address)
    // await lzEndpointMock.setDestLzEndpoint(omniCounterB.address, lzEndpointMock.address)
    omniCounterA.setTrustedRemote(
      chainId,
      ethers.utils.solidityPack(["address", "address"], [receiveFactoryContract.address, omniCounterA.address])
    )
    receiveFactoryContract.setTrustedRemote(
        chainId,
        ethers.utils.solidityPack(["address", "address"], [omniCounterA.address, receiveFactoryContract.address])
    )
    // omniCounterB.setTrustedRemote(
    //     chainId,
    //     ethers.utils.solidityPack(["address", "address"], [omniCounterA.address, omniCounterB.address])
    // )
    // // when list nfts, generate signature using alice account
    // for (const order of ordersData) {
    //   const signature = await signOrderItemData(
    //     order.orderItem,
    //     gbMarketplace,
    //     alice
    //   );
    //   order.signature = signature;
    //   const price = BigNumber.from(order.orderItem.itemPrice).add(order.additionalAmount);
    //   totalPrice = totalPrice.add(price);
    //   // console.log(order);
    // }

  })

  describe('Client test', async () => {
    it("increment the counter of the destination OmniCounter", async function () {
      // ensure theyre both starting from 0
      expect(await omniCounterA.counter()).to.be.equal(0) // initial value
      expect(await omniCounterB.counter()).to.be.equal(0) // initial value

      // instruct each OmniCounter to increment the other OmniCounter
      // counter A increments counter B
      const babc = await receiveFactoryContract.counter();
      console.log("babc is : ", babc);
      await omniCounterA.incrementCounter(chainId, { value: ethers.utils.parseEther("0.5") })
      expect(await omniCounterA.counter()).to.be.equal(0) // still 0
      // expect(await omniCounterB.counter()).to.be.equal(1) // still 0
      expect(await receiveFactoryContract.counter()).to.be.equal(1) // now its 1
      const abc = await receiveFactoryContract.counter();
      console.log("abc is : ", abc);

      // counter B increments counter A
      // await omniCounterB.incrementCounter(chainId, { value: ethers.utils.parseEther("0.5") })
      // expect(await omniCounterA.counter()).to.be.equal(1) // now its 1
      // expect(await omniCounterB.counter()).to.be.equal(1) // still 1
      // const abc1 = await omniCounterB.counter();
      // console.log("abc1 is : ", abc1);
    })
  })
});
