// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IPolarysNftContract.sol";

contract PolarysNftContract is IPolarysNftContract, ERC721A, AccessControl, ReentrancyGuard {
  
  bytes32 public constant FACTORY_CONTRACT_ROLE = keccak256("FACTORY_CONTRACT_ROLE");

  string private baseURI;
  uint256 public immutable MAX_SUPPLY;

  constructor(
    string memory name, 
    string memory symbol,
    string memory tokenURI,
    uint256 maxSupply,
    address factoryContractAddress
  ) ERC721A(name, symbol) {
    baseURI = tokenURI;
    MAX_SUPPLY = maxSupply;
    _grantRole(FACTORY_CONTRACT_ROLE, factoryContractAddress);
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
    uint256 totalSupply = totalSupply();
    require(totalSupply <= MAX_SUPPLY, "Cannot mint more than MAX_SUPPLY NFTs");
    _mint(to, quantity);
  }

}