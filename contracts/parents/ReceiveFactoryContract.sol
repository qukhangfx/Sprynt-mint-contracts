// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../childs/ERC1155.sol";
import {CloneFactory} from "../library/CloneFactory.sol";

import "hardhat/console.sol";

contract ReceiveFactoryContract is
    CloneFactory,
    AccessControl
{
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    event CreatedNftContract(
        string tokenUri,
        address seller,
        address nftContractAddress
    );

    event CreatedDepositContract(
        address sellerAddress,
        address tokenAddress,
        uint16 dstChainId,
        uint256 mintPrice,
        uint256 whiteListMintPrice,
        uint256 minMintQuantity,
        uint256 maxMintQuantity,
        uint256 totalSupply,
        uint256 deadline
    );

    mapping(address => address) public nftContracts; // seller => nftContract address
    address private _masterNftContractAddress;

    constructor() {
        _setupRole(OWNER_ROLE, msg.sender);
    }

    /** NFT CONTRACT **/
    
    function mint(
        address seller,
        address to,
        uint256 amount,
        bytes memory data
    ) public onlyPermissioned {
        require(
            nftContracts[seller] != address(0),
            "Nft contract is not created."
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
        string calldata tokenUri,
        uint256 usdPrice_
    ) external {
        require(
            nftContracts[msg.sender] == address(0),
            "Already created nft contract."
        );

        require(
            _masterNftContractAddress != address(0),
            "Master nft contract address is not set."
        );

        address clone = createClone(_masterNftContractAddress);
        ERC1155Contract(clone).init(tokenUri, usdPrice_, address(this));
        nftContracts[msg.sender] = clone;
        emit CreatedNftContract(tokenUri, msg.sender, clone);
    }

    function setMasterNftContractAddress(
        address masterNftContractAddress
    ) external onlyOwner {
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
    ) external onlyPermissioned {
        ERC1155Contract(_nftContractAddress).setName(_name);
    }

    function setSymbol(
        address _nftContractAddress,
        string memory _symbol
    ) external onlyPermissioned {
        ERC1155Contract(_nftContractAddress).setSymbol(_symbol);
    }

    function setBaseUri(
        address _nftContractAddress,
        string memory _baseUri
    ) external onlyPermissioned {
        ERC1155Contract(_nftContractAddress).setBaseUri(_baseUri);
    }

    /** UTILS */

    modifier onlyPermissioned() {
        require(
            hasRole(OWNER_ROLE, msg.sender) ||
                hasRole(VALIDATOR_ROLE, msg.sender),
            "Sender does not have the required role"
        );
        _;
    }

    modifier onlyOwner() {
        require(
            hasRole(OWNER_ROLE, msg.sender),
            "Caller is not a owner"
        );
        _;
    }

    modifier onlyValidator() {
        require(
            hasRole(VALIDATOR_ROLE, msg.sender),
            "Caller is not a validator"
        );
        _;
    }

    function setupValidatorRole(address account) external onlyOwner {
        _grantRole(VALIDATOR_ROLE, account);
    }

    function revokeValidatorRole(address account) external onlyOwner {
        _revokeRole(VALIDATOR_ROLE, account);
    }
}
