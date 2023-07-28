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
    string public name;
    string public symbol;

    uint256 public usdPrice;

    uint256 private _mintedTokens;
    address private _factoryContractAddress;

    bool public initialized;

    constructor() ERC1155("") {}

    function init(
        string memory tokenURI,
        uint256 usdPrice_,
        address factoryContractAddress
    ) external {
        require(!initialized, "ERC1155: contract is already initialized");

        usdPrice = usdPrice_;
        baseURI = tokenURI;

        _factoryContractAddress = factoryContractAddress;
        _grantRole(FACTORY_CONTRACT_ROLE, factoryContractAddress);

        _setURI(tokenURI);

        name = "";
        symbol = "";

        _transferOwnership(tx.origin);

        initialized = true;
    }

    function setBaseURI(string calldata _uri) external sellerOrFactoryContract {
        baseURI = _uri;
        _setURI(_uri);
    }

    function setName(string calldata _name) external sellerOrFactoryContract {
        name = _name;
    }

    function setSymbol(
        string calldata _symbol
    ) external sellerOrFactoryContract {
        symbol = _symbol;
    }

    function getBaseURI() external view returns (string memory) {
        return baseURI;
    }

    function setFactoryContractAddress(
        address factoryContractAddress
    ) external onlySeller {
        require(
            factoryContractAddress != address(0),
            "ERC1155: receive factory contract address is zero address"
        );

        _grantRole(FACTORY_CONTRACT_ROLE, factoryContractAddress);
    }

    modifier onlySeller() {
        require(owner() == _msgSender(), "ERC1155: caller is not a seller");
        _;
    }

    modifier sellerOrFactoryContract() {
        require(
            owner() == _msgSender() ||
                hasRole(FACTORY_CONTRACT_ROLE, msg.sender),
            "ERC1155: sender does not have the required role"
        );
        _;
    }

    function mintToken(
        address to,
        bytes memory data
    ) external sellerOrFactoryContract nonReentrant {
        require(to != address(0), "ERC1155: address must not be zero address");
        _mint(to, ++_mintedTokens, 1, data);
    }

    function mintBatchToken(
        address to,
        uint256 quantity,
        bytes memory data
    ) external sellerOrFactoryContract nonReentrant {
        require(to != address(0), "ERC1155: address must not be zero address");

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

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControl, ERC1155) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
