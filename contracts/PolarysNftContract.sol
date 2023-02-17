// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract PolarysNftContract is ERC721A, AccessControl, ReentrancyGuard {
  event SetBaseURI(string uri);

  bytes32 public constant FACTORY_CONTRACT_ROLE = keccak256("FACTORY_CONTRACT_ROLE");

  string private baseURI;
  uint256 public immutable MAX_SUPPLY;

  constructor(
    string memory name, 
    string memory symbol,
    string memory tokenUri,
    uint256 maxSupply
  ) ERC721A(name, symbol) {
    baseURI = tokenUri;
    MAX_SUPPLY = maxSupply;
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, ERC721A) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  function setBaseURI(string calldata uri) external onlyRole(FACTORY_CONTRACT_ROLE) {
    baseURI = uri;
    emit SetBaseURI(uri);
  }

  function _baseURI() internal view virtual override returns (string memory) {
    return baseURI;
  }

  function getBaseURI() external view returns (string memory) {
    return baseURI;
  }

  function setFactoryContractAddress(address factoryContractAddress) external onlyRole(FACTORY_CONTRACT_ROLE)
  {
    require(factoryContractAddress != address(0), "contract address must not be zero address");
    _grantRole(FACTORY_CONTRACT_ROLE, factoryContractAddress);
  }

  function mintToken(
    address to,
    uint256 quantity
  ) external onlyRole(FACTORY_CONTRACT_ROLE) nonReentrant {
    require(to != address(0), "Address must not be zero address");
    // require(royaltyFee <= 10000, "RoyaltyFee must not be greater than 100%");
    uint256 totalSupply = totalSupply();
    require(totalSupply <= MAX_SUPPLY, "Cannot mint more than MAX_SUPPLY NFTs");
    // _setDefaultRoyalty(msg.sender, royaltyFee); 
    _mint(to, quantity);
  }

}