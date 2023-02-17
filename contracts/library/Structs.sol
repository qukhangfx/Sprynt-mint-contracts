// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

struct DepositItem {
  uint256 mintPrice;
  uint256 mintQuantity;
  address sellerAddress;
  uint16 dstChainId;
  bool isMintAvailable;
  uint256 deadline;
}