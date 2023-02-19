// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface ILZSenderContract {

  function sendNftMithMessage(
    bytes calldata encodedPayload,
    address refundAddress
  ) external payable;

  function estimateFee(uint16 _dstChainId, bool _useZro, bytes calldata _adapterParams) external view returns (uint nativeFee, uint zroFee);
}