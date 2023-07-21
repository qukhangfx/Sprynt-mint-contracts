// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import {ReceiveFactoryContract} from "../parents/ReceiveFactoryContract.sol";

contract ERC1155Contract is ERC1155, AccessControl, ReentrancyGuard, Ownable {
    bytes32 public constant FACTORY_CONTRACT_ROLE =
        keccak256("FACTORY_CONTRACT_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    string private baseURI;
    string public name;
    string public symbol;

    uint256 private _mintedTokens;
    address private _factoryContractAddress;

    bool public initialized;

    constructor() ERC1155("") {}

    function init(
        string memory tokenURI,
        address factoryContractAddress
    ) external {
        require(!initialized, "Contract is already initialized");
        baseURI = tokenURI;
        _factoryContractAddress = factoryContractAddress;
        _grantRole(FACTORY_CONTRACT_ROLE, factoryContractAddress);
        _setURI(tokenURI);

        name = "";
        symbol = "";

        _transferOwnership(tx.origin);

        initialized = true;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControl, ERC1155) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function setBaseURI(string calldata _uri) external onlyPermissioned {
        baseURI = _uri;
        _setURI(_uri);
    }

    function setName(string calldata _name) external onlyPermissioned {
        name = _name;
    }

    function setSymbol(string calldata _symbol) external onlyPermissioned {
        symbol = _symbol;
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
         ReceiveFactoryContract receiveFactoryContract = ReceiveFactoryContract(
            _factoryContractAddress
         );

        require(
            owner() == _msgSender() ||
                hasRole(FACTORY_CONTRACT_ROLE, msg.sender)
                || receiveFactoryContract.hasRole(VALIDATOR_ROLE, msg.sender),
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

    function uri(uint256 tokenId) public view override returns (string memory) {
        return
            string(
                abi.encodePacked(this.getBaseURI(), Strings.toString(tokenId))
            );
    }
}
