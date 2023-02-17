// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";
import "@layerzerolabs/solidity-examples/contracts/util/BytesLib.sol";
import "./PolarysNftContract.sol";

contract PolarysFactoryContract is NonblockingLzApp {
  using BytesLib for bytes;

  mapping(address => address) public nftContracts;  // seller=>nftContract address

  uint8 public constant PAYLOAD_CREATE_NFT_CONTRACT = 0;
  uint8 public constant PAYLOAD_MINT_NFT = 1;

  constructor(
    address _layerZeroEndpoint
  ) NonblockingLzApp(_layerZeroEndpoint)
  {
  }

  function _nonblockingLzReceive(
    uint16, 
    bytes memory, 
    uint64, 
    bytes memory _payload
  ) internal override {
    uint8 payloadType = _payload.toUint8(0);
    if (payloadType == PAYLOAD_CREATE_NFT_CONTRACT) {
      (
        uint8 pType,
        bytes32 name,
        bytes32 symbol,
        bytes32 tokenUri,
        uint256 totalSupply,
        address seller
      ) = abi.decode(
        _payload,
        (
          uint8,
          bytes32,
          bytes32,
          bytes32,
          uint256,
          address
        )
      );
      PolarysNftContract newNftContract = new PolarysNftContract(
        string(abi.encode(name)),
        string(abi.encode(symbol)),
        string(abi.encode(tokenUri)),
        totalSupply
      );
      address newContractAddress = address(newNftContract);
      nftContracts[seller] = newContractAddress;
      newNftContract.setFactoryContractAddress(newContractAddress);
      
    } else if (payloadType == PAYLOAD_MINT_NFT) {
      (
        uint8 pType,
        uint256 mintQuantity,
        address seller
      ) = abi.decode(
        _payload,
        (
          uint8,
          uint256,
          address
        )
      );
    } else {
      revert("Unknown payload type");
    }
  }
}
