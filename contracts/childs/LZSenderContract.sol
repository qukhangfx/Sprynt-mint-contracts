// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";
import "../interfaces/ILZSenderContract.sol";

contract LZSenderContract is ILZSenderContract, Ownable, NonblockingLzApp, ReentrancyGuard {
  uint16 public immutable dstChainId;

  constructor(
    address _layerZeroEndpoint,
    uint16 _dstChainId
  ) NonblockingLzApp(_layerZeroEndpoint) {
    dstChainId = _dstChainId;
  }

  function sendNftMitMessage(
    bytes calldata encodedPayload,
    address refundAddress
  ) external nonReentrant payable {
    _lzSend(dstChainId, encodedPayload, payable(refundAddress), address(0x0), bytes(""), msg.value);
  }

  function estimateFee(uint16 _dstChainId, bool _useZro, bytes calldata _adapterParams) public view returns (uint nativeFee, uint zroFee) {
    bytes memory encodedPayload = abi.encodePacked(
      address(0),
      uint256(0),
      address(0)
    );
    return lzEndpoint.estimateFees(_dstChainId, address(this), encodedPayload, _useZro, _adapterParams);
  }

  function _nonblockingLzReceive(uint16, bytes memory, uint64, bytes memory) internal override {}
  
}