// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ERC1155Contract is ERC1155, AccessControl, ReentrancyGuard {
    bytes32 public constant FACTORY_CONTRACT_ROLE =
        keccak256("FACTORY_CONTRACT_ROLE");

    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    string private baseURI;

    mapping(address => uint256) private _mintedTokens;

    constructor(
        string memory tokenURI,
        address factoryContractAddress
    ) ERC1155(tokenURI) {
        baseURI = tokenURI;
        _grantRole(OWNER_ROLE, tx.origin);
        _grantRole(FACTORY_CONTRACT_ROLE, factoryContractAddress);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControl, ERC1155) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function setBaseURI(string calldata uri) external onlyRole(OWNER_ROLE) {
        baseURI = uri;
    }

    function getBaseURI() external view returns (string memory) {
        return baseURI;
    }

    function setFactoryContractAddress(
        address factoryContractAddress
    ) external onlyRole(OWNER_ROLE) {
        require(
            factoryContractAddress != address(0),
            "contract address must not be zero address"
        );
        _grantRole(FACTORY_CONTRACT_ROLE, factoryContractAddress);
    }

    function mintToken(
        address to,
        uint256 id,
        bytes memory data
    ) external onlyRole(FACTORY_CONTRACT_ROLE) nonReentrant {
        require(to != address(0), "Address must not be zero address");
        _mint(to, id, 1, data);
    }

    function mintBatchToken(
        address to,
        uint256[] memory ids,
        bytes memory data
    ) external onlyRole(FACTORY_CONTRACT_ROLE) nonReentrant {
        require(to != address(0), "Address must not be zero address");
        uint256[] memory amounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            amounts[i] = 1;
        }

        _mintBatch(to, ids, amounts, data);
        _mintedTokens[to] += ids.length;
    }

    function getNumberOfMintedTokens(
        address account
    ) external view returns (uint256) {
        return _mintedTokens[account];
    }
}
