// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IPolarysNftContract {
  function setTokenURI(uint256 tokenId, string memory tokenURI_) external ; 
  function setMarketplaceAddress(address _marketplaceAddress) external ;
  function mintToken(
    address account,
    uint256 tokenId,
    uint96 royalty,
    string memory tokenURI_
  ) external ;
  function royaltyInfo(uint256 _tokenId, uint256 _salePrice) external view returns (address, uint256);
  function ownerOf(uint256 tokenId) external view returns (address);
}