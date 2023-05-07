// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";
import "@layerzerolabs/solidity-examples/contracts/util/BytesLib.sol";
import "../childs/ERC1155.sol";
import "hardhat/console.sol";

contract ReceiveFactoryContract is NonblockingLzApp {
    using BytesLib for bytes;

    uint256 private _mintedTokens;

    event CreatedNftContract(
        string tokenUri,
        address seller,
        address nftContractAddress
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

    function _nonblockingLzReceive(
        uint16,
        bytes memory,
        uint64,
        bytes memory _payload
    ) internal override {
        (
            address clientAddress,
            uint256 mintQuantity,
            string memory data,
            address seller
        ) = abi.decode(_payload, (address, uint256, string, address));
        address nftContractAddress = nftContracts[seller];
        require(nftContractAddress != address(0), "NftContract is not created");

        uint256[] memory ids = new uint256[](mintQuantity);
        for (uint i = 1; i <= ids.length; i++) {
            ids[i] = _mintedTokens + i;
        }

        ERC1155Contract(nftContractAddress).mintBatchToken(
            clientAddress,
            ids,
            bytes(data)
        );

        _mintedTokens += mintQuantity;

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

    function getTotalMintedToken() public view returns (uint256) {
        return _mintedTokens;
    }
}
