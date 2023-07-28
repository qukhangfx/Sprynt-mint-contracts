// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../childs/ERC1155.sol";
import {CloneFactory} from "../library/CloneFactory.sol";

import "hardhat/console.sol";

contract ReceiveFactoryContract is CloneFactory, AccessControl {
    bytes32 public constant SPRYNT_VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant SELLER_ROLE = keccak256("SELLER_ROLE");

    event CreatedNftContract(
        string tokenURI,
        address seller,
        address nftContractAddress
    );

    mapping(address => address) public nftContracts;
    address private _masterNftContractAddress;

    constructor() {
        _setupRole(SELLER_ROLE, msg.sender);
    }

    /** NFT CONTRACT **/

    function mint(
        address seller,
        address to,
        uint256 amount,
        bytes memory data
    ) public sellerOrSpryntValidator {
        require(
            nftContracts[seller] != address(0),
            "ReceiveFactoryContract: nft contract is not created."
        );
        if (amount == 1) {
            ERC1155Contract(nftContracts[seller]).mintToken(to, data);
        } else {
            ERC1155Contract(nftContracts[seller]).mintBatchToken(
                to,
                amount,
                data
            );
        }
    }

    function createNftContractBySeller(
        string calldata tokenURI,
        uint256 usdPrice_
    ) external {
        require(
            nftContracts[msg.sender] == address(0),
            "ReceiveFactoryContract: already created nft contract."
        );

        require(
            _masterNftContractAddress != address(0),
            "ReceiveFactoryContract: master nft contract address is not set."
        );

        address clone = createClone(_masterNftContractAddress);

        ERC1155Contract(clone).init(tokenURI, usdPrice_, address(this));

        nftContracts[msg.sender] = clone;

        emit CreatedNftContract(tokenURI, msg.sender, clone);
    }

    function setMasterNftContractAddress(
        address masterNftContractAddress
    ) external onlySeller {
        _masterNftContractAddress = masterNftContractAddress;
    }

    function getNftContractsOfAccount(
        address owner
    ) public view returns (address) {
        return nftContracts[owner];
    }

    function setName(
        address _nftContractAddress,
        string memory _name
    ) external sellerOrSpryntValidator {
        ERC1155Contract(_nftContractAddress).setName(_name);
    }

    function setSymbol(
        address _nftContractAddress,
        string memory _symbol
    ) external sellerOrSpryntValidator {
        ERC1155Contract(_nftContractAddress).setSymbol(_symbol);
    }

    function setBaseURI(
        address _nftContractAddress,
        string memory _baseURI
    ) external sellerOrSpryntValidator {
        ERC1155Contract(_nftContractAddress).setBaseURI(_baseURI);
    }

    /** UTILS */

    modifier sellerOrSpryntValidator() {
        require(
            hasRole(SELLER_ROLE, msg.sender) ||
                hasRole(SPRYNT_VALIDATOR_ROLE, msg.sender),
            "ReceiveFactoryContract: sender does not have the required role"
        );
        _;
    }

    modifier onlySeller() {
        require(
            hasRole(SELLER_ROLE, msg.sender),
            "ReceiveFactoryContract: caller is not a seller"
        );
        _;
    }

    function setupValidatorRole(address account) external onlySeller {
        _grantRole(SPRYNT_VALIDATOR_ROLE, account);
    }

    function revokeValidatorRole(address account) external onlySeller {
        _revokeRole(SPRYNT_VALIDATOR_ROLE, account);
    }
}
