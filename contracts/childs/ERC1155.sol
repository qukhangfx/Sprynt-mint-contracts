// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

contract ERC1155Contract is ERC1155, AccessControl, ReentrancyGuard, Ownable {
    bytes32 public constant FACTORY_CONTRACT_ROLE =
        keccak256("FACTORY_CONTRACT_ROLE");
    string private baseURI;

    uint256 private _mintedTokens;

    bool public initialized;

    string public name = "Sprynt.io ERC1155 by Fuixlabs";

    constructor() ERC1155("") {}

    function init(
        string memory tokenURI,
        address factoryContractAddress
    ) external {
        require(!initialized, "Contract is already initialized");
        baseURI = tokenURI;
        _grantRole(FACTORY_CONTRACT_ROLE, factoryContractAddress);
        _setURI(tokenURI);

        _transferOwnership(tx.origin);

        initialized = true;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControl, ERC1155) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        baseURI = uri;
        _setURI(uri);
    }

    function getBaseURI() external view returns (string memory) {
        return baseURI;
    }

    function setFactoryContractAddress(
        address factoryContractAddress
    ) external onlyOwner {
        require(
            factoryContractAddress != address(0),
            "contract address must not be zero address"
        );
        _grantRole(FACTORY_CONTRACT_ROLE, factoryContractAddress);
    }

    modifier onlyPermissioned() {
        require(
            owner() == _msgSender() ||
                hasRole(FACTORY_CONTRACT_ROLE, msg.sender),
            "Sender does not have the required role"
        );
        _;
    }

    function mintToken(
        address to,
        bytes memory data
    ) external onlyPermissioned nonReentrant {
        require(to != address(0), "Address must not be zero address");
        _mint(to, ++_mintedTokens, 1, data);
    }

    function mintBatchToken(
        address to,
        uint256 quantity,
        bytes memory data
    ) external onlyPermissioned nonReentrant {
        require(to != address(0), "Address must not be zero address");
        uint256[] memory amounts = new uint256[](quantity);
        uint256[] memory ids = new uint256[](quantity);
        for (uint256 i = 0; i < ids.length; i++) {
            ids[i] = ++_mintedTokens;
            amounts[i] = 1;
        }
        _mintBatch(to, ids, amounts, data);
    }

    function getNumberOfMintedTokens() external view returns (uint256) {
        return _mintedTokens;
    }
}
