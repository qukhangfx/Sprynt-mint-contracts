// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";
import "../childs/ERC1155.sol";
import {CloneFactory} from "../library/CloneFactory.sol";

import "hardhat/console.sol";

contract ReceiveFactoryContract is NonblockingLzApp, CloneFactory {
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

    constructor(
        address _layerZeroEndpoint
    ) NonblockingLzApp(_layerZeroEndpoint) {}

    function createNftContractBySeller(string calldata tokenUri) external {
        require(
            nftContracts[msg.sender] == address(0),
            "already created nft contract."
        );

        if (_masterNftContractAddress == address(0)) {
            ERC1155Contract newNftContract = new ERC1155Contract(
                tokenUri,
                address(this)
            );
            _masterNftContractAddress = address(newNftContract);
            nftContracts[msg.sender] = address(newNftContract);
            emit CreatedNftContract(
                tokenUri,
                msg.sender,
                address(newNftContract)
            );
        } else {
            address clone = createClone(_masterNftContractAddress);
            ERC1155Contract(clone).init(tokenUri, address(this));
            nftContracts[msg.sender] = clone;
            emit CreatedNftContract(tokenUri, msg.sender, clone);
        }
    }

    function createPayContractBySeller(
        uint256 maxAcceptedValue,
        bool forwarded,
        address tokenAddress,
        uint16 dstChainId,
        bytes calldata adapterParams
    ) public payable {
        bytes memory encodedPayload = abi.encode(
            1,
            maxAcceptedValue,
            forwarded,
            tokenAddress
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
            payable(msg.sender),
            address(0x0),
            adapterParams,
            nativeFee
        );
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
        address[] memory whiteList,
        bytes calldata adapterParams
    ) external payable {
        bytes memory encodedPayload = abi.encode(
            2,
            sellerAddress,
            tokenAddress,
            depositContractDstChainId,
            mintPrice,
            whiteListMintPrice,
            minMintQuantity,
            maxMintQuantity,
            totalSupply,
            deadline,
            whiteList
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

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) internal virtual override {}
}
