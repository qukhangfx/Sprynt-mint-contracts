// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../childs/ERC1155.sol";
import {CloneFactory} from "../library/CloneFactory.sol";

import "hardhat/console.sol";

contract ReceiveFactoryContract is
    NonblockingLzApp,
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

    constructor(
        address _layerZeroEndpoint
    ) NonblockingLzApp(_layerZeroEndpoint) {}

    function createNftContractBySeller(string calldata tokenUri) external {
        require(
            nftContracts[msg.sender] == address(0),
            "already created nft contract."
        );

        require(
            _masterNftContractAddress != address(0),
            "master nft contract address is not set."
        );

        address clone = createClone(_masterNftContractAddress);
        ERC1155Contract(clone).init(tokenUri, address(this));
        nftContracts[msg.sender] = clone;
        emit CreatedNftContract(tokenUri, msg.sender, clone);
    }

    function setMasterNftContractAddress(
        address masterNftContractAddress
    ) external onlyOwner {
        _masterNftContractAddress = masterNftContractAddress;
    }

    function mint(
        address seller,
        address to,
        uint256 amount,
        bytes memory data
    ) public onlyValidator {
        require(
            nftContracts[seller] != address(0),
            "nft contract is not created."
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

    function createPayContractBySeller(
        uint256 maxAcceptedValue,
        bool forwarded,
        address[] memory tokenAddresses,
        uint16 dstChainId,
        bytes calldata adapterParams
    ) public payable {
        bytes memory encodedPayload = abi.encode(
            1,
            maxAcceptedValue,
            forwarded,
            tokenAddresses,
            msg.sender
        );

        (uint nativeFee, uint zroFee) = estimateFee(
            dstChainId,
            false,
            adapterParams,
            encodedPayload
        );

        require(msg.value >= nativeFee, "Insufficient fee");

        _lzSend(
            dstChainId,
            encodedPayload,
            payable(msg.sender),
            address(0x0),
            adapterParams,
            nativeFee
        );
    }

    function createDepositContractBySeller(
        uint16 dstChainId,
        address sellerAddress,
        address tokenAddress,
        uint16 depositContractDstChainId,
        uint256 mintPrice,
        uint256 whiteListMintPrice,
        uint256 minMintQuantity,
        uint256 maxMintQuantity,
        uint256 totalSupply,
        uint256 deadline,
        uint256 depositDeadline,
        address[] memory whiteList,
        bytes calldata adapterParams
    ) external payable {
        bytes memory encodedPayload = abi.encode(
            2,
            sellerAddress,
            tokenAddress,
            depositContractDstChainId,
            mintPrice,
            whiteListMintPrice,
            minMintQuantity,
            maxMintQuantity,
            totalSupply,
            deadline,
            depositDeadline,
            whiteList
        );
        (uint nativeFee, uint zroFee) = estimateFee(
            dstChainId,
            false,
            adapterParams,
            encodedPayload
        );
        require(msg.value >= nativeFee, "Insufficient fee");

        _lzSend(
            dstChainId,
            encodedPayload,
            payable(tx.origin),
            address(0x0),
            adapterParams,
            nativeFee
        );
    }

    function getNftContractsOfAccount(
        address owner
    ) public view returns (address) {
        return nftContracts[owner];
    }

    function estimateFee(
        uint16 dstChainId_,
        bool _useZro,
        bytes calldata _adapterParams,
        bytes memory encodedPayload
    ) public view returns (uint nativeFee, uint zroFee) {
        return
            lzEndpoint.estimateFees(
                dstChainId_,
                address(this),
                encodedPayload,
                _useZro,
                _adapterParams
            );
    }

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) internal virtual override {}

    function setName(address _nftContractAddress, string memory _name)
        external
        onlyOwner
    {
        ERC1155Contract(_nftContractAddress).setName(_name);
    }

    function setSymbol(address _nftContractAddress, string memory _symbol)
        external
        onlyOwner
    {
        ERC1155Contract(_nftContractAddress).setSymbol(_symbol);
    }

    function setBaseURI(address _nftContractAddress, string memory _baseURI)
        external
        onlyOwner
    {
        ERC1155Contract(_nftContractAddress).setBaseURI(_baseURI);
    }
}
