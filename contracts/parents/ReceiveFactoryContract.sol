// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";
import "../childs/ERC1155.sol";

import "hardhat/console.sol";

contract ReceiveFactoryContract is NonblockingLzApp {
    event CreatedNftContract(
        string tokenUri,
        address seller,
        address nftContractAddress
    );
    event CreatedDepositContract(
        address sellerAddress,
        address tokenAddress,
        uint16 dstChainId,
        uint256 mintPrice,
        uint256 whiteListMintPrice,
        uint256 minMintQuantity,
        uint256 maxMintQuantity,
        uint256 totalSupply,
        uint256 deadline
    );
    event MintedNfts(
        address nftContractAddress,
        address clientAddress,
        address sellerAddress,
        uint256 mintQuantity
    );

    mapping(address => address) public nftContracts; // seller => nftContract address

    constructor(
        address _layerZeroEndpoint
    ) NonblockingLzApp(_layerZeroEndpoint) {}

    function createNftContractBySeller(string calldata tokenUri) external {
        require(
            nftContracts[msg.sender] == address(0),
            "already created nft contract."
        );
        ERC1155Contract newNftContract = new ERC1155Contract(
            tokenUri,
            address(this)
        );
        nftContracts[msg.sender] = address(newNftContract);

        emit CreatedNftContract(tokenUri, msg.sender, address(newNftContract));
    }

    function createDepositContractBySeller(
        uint16 dstChainId,
        address sellerAddress,
        address tokenAddress,
        uint16 depositContractDstChainId,
        uint256 mintPrice,
        uint256 whiteListMintPrice,
        uint256 minMintQuantity,
        uint256 maxMintQuantity,
        uint256 totalSupply,
        uint256 deadline,
        bytes calldata adapterParams
    ) external payable {
        bytes memory encodedPayload = abi.encode(
            sellerAddress,
            tokenAddress,
            depositContractDstChainId,
            mintPrice,
            whiteListMintPrice,
            minMintQuantity,
            maxMintQuantity,
            totalSupply,
            deadline
        );
        (uint nativeFee, uint zroFee) = estimateFee(
            dstChainId,
            false,
            adapterParams,
            encodedPayload
        );
        require(msg.value >= nativeFee, "Insufficient fee");

        _lzSend(
            dstChainId,
            encodedPayload,
            payable(tx.origin),
            address(0x0),
            adapterParams,
            nativeFee
        );
    }

    function _nonblockingLzReceive(
        uint16,
        bytes memory,
        uint64,
        bytes memory _payload
    ) internal override {
        (
            address clientAddress,
            uint256 mintQuantity,
            bytes memory data,
            address seller
        ) = abi.decode(_payload, (address, uint256, bytes, address));
        address nftContractAddress = nftContracts[seller];
        require(nftContractAddress != address(0), "NftContract is not created");
        

        ERC1155Contract(nftContractAddress).mintBatchToken(
            clientAddress,
            mintQuantity,
            data
        );

        emit MintedNfts(
            nftContractAddress,
            clientAddress,
            seller,
            mintQuantity
        );
    }

    function getNftContractsOfAccount(
        address owner
    ) public view returns (address) {
        return nftContracts[owner];
    }

    function estimateFee(
        uint16 dstChainId_,
        bool _useZro,
        bytes calldata _adapterParams,
        bytes memory encodedPayload
    ) public view returns (uint nativeFee, uint zroFee) {
        return
            lzEndpoint.estimateFees(
                dstChainId_,
                address(this),
                encodedPayload,
                _useZro,
                _adapterParams
            );
    }
}
