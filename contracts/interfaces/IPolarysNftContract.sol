// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IPolarysNftContract {
  event SetBaseURI(string uri);

  function setBaseURI(string calldata uri) external ;
  function setFactoryContractAddress(address _factoryContractAddress) external ;
  function mintToken(
    address to,
    uint256 quantity
  ) external ;
}