// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";
import "@layerzerolabs/solidity-examples/contracts/util/BytesLib.sol";
import "../childs/PolarysNftContract.sol";

import "../interfaces/IPolarysNftContract.sol";
import "hardhat/console.sol";

contract ReceiveFactoryContract is NonblockingLzApp {
    using BytesLib for bytes;

    event CreatedNftContract(
        string name,
        string symbol,
        string tokenUri,
        uint256 totalSupply,
        address seller,
        address nftContractAddress
    );
    event MintedNfts(
        address nftContractAddress,
        address clientAddress,
        address sellerAddress,
        uint256 mintQuantity
    );

    mapping(address => address) public nftContracts; // seller=>nftContract address

    constructor(
        address _layerZeroEndpoint
    ) NonblockingLzApp(_layerZeroEndpoint) {}

    function createNftContractBySeller(
        string calldata name,
        string calldata symbol,
        string calldata tokenUri,
        uint256 totalSupply
    ) external {
        require(
            nftContracts[msg.sender] == address(0),
            "already created nft contract."
        );
        PolarysNftContract newNftContract = new PolarysNftContract(
            name,
            symbol,
            tokenUri,
            totalSupply,
            address(this)
        );
        nftContracts[msg.sender] = address(newNftContract);

        emit CreatedNftContract(
            name,
            symbol,
            tokenUri,
            totalSupply,
            msg.sender,
            address(newNftContract)
        );
    }

    function createPayContractBySeller(
        uint256 maxAcceptedValue,
        bool forwarded,
        address tokenAddress,
        uint16 dstChainId,
        bytes memory adapterParams,
        uint256 lzGasFee
    ) public payable {
        bytes memory encodedPayload = abi.encode(
            maxAcceptedValue,
            forwarded,
            tokenAddress
        );

        _lzSend(
            dstChainId,
            encodedPayload,
            payable(msg.sender),
            address(0x0),
            adapterParams,
            lzGasFee
        );
    }

    function _nonblockingLzReceive(
        uint16,
        bytes memory,
        uint64,
        bytes memory _payload
    ) internal override {
        (address clientAddress, uint256 mintQuantity, address seller) = abi
            .decode(_payload, (address, uint256, address));
        address nftContractAddress = nftContracts[seller];
        require(nftContractAddress != address(0), "NftContract is not created");
        IPolarysNftContract(nftContractAddress).mintToken(
            clientAddress,
            mintQuantity
        );

        emit MintedNfts(
            nftContractAddress,
            clientAddress,
            seller,
            mintQuantity
        );
    }
}
