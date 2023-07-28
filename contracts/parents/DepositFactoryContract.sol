// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../childs/SimplePay.sol";

import {CloneFactory} from "../library/CloneFactory.sol";
import {DepositItem} from "../library/Structs.sol";
import {DepositContract} from "../childs/DepositContract.sol";
import {SimplePay} from "../childs/SimplePay.sol";

import "hardhat/console.sol";

contract DepositFactoryContract is
    AccessControl,
    ReentrancyGuard,
    Pausable,
    CloneFactory
{
    using SafeERC20 for IERC20;

    bytes32 public constant SPRYNT_VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant SPRYNT_OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant SPRYNT_ADMIN_WALLET_ROLE =
        keccak256("ADMIN_WALLET_ROLE");

    uint96 public platformFeeMint = 0; // 0% platform fee
    uint96 public platformFeePay = 0; // 0% platform fee

    address public adminWallet;

    address private _masterDepositContract;
    address private _masterPayContract;

    mapping(address => bool) private _depositContracts;
    mapping(address => bool) private _payContracts;

    mapping(address => address) public payContracts;
    mapping(address => address) public depositContracts;

    event SetAdminWallet(address adminWallet);

    event SetPlatformFeeMint(uint96 platformFeeMint);

    event SetPlatformFeePay(uint96 platformFeePay);

    event MasterDepositContractCreated(address masterDepositContractAddress);

    event DepositContractCreated(address depositContractAddress);

    event DepositContractUpdated(
        address depositContractAddress,
        uint256 mintPrice,
        uint256 whiteListMintPrice,
        uint256 minMintQuantity,
        uint256 maxMintQuantity,
        uint256 totalSupply,
        uint256 deadline
    );

    event SimplePayContractCreated(address simplePayContractAddress);

    address public _chainlinkPriceFeedAddress;

    constructor(address owner, address adminWallet_, address validator) {
        adminWallet = adminWallet_;

        _setupRole(SPRYNT_OWNER_ROLE, owner);
        _setupRole(SPRYNT_VALIDATOR_ROLE, validator);
        _setupRole(SPRYNT_ADMIN_WALLET_ROLE, adminWallet);
    }

    function setupValidatorRole(address account) external onlySpryntOwner {
        _grantRole(SPRYNT_VALIDATOR_ROLE, account);
    }

    function revokeValidatorRole(address account) external onlySpryntOwner {
        _revokeRole(SPRYNT_VALIDATOR_ROLE, account);
    }

    function setAdminWallet(address adminWallet_) external onlySpryntOwner {
        require(
            adminWallet_ != address(0),
            "DepositFactoryContract: admin wallet address must not be zero address"
        );

        adminWallet = adminWallet_;

        emit SetAdminWallet(adminWallet_);
    }

    modifier onlySprynt() {
        _requireNotPaused();

        require(
            hasRole(SPRYNT_OWNER_ROLE, msg.sender) ||
                hasRole(SPRYNT_VALIDATOR_ROLE, msg.sender),
            "DepositFactoryContract: sender does not have the required role"
        );
        _;
    }

    modifier onlySpryntOwner() {
        require(
            hasRole(SPRYNT_OWNER_ROLE, msg.sender),
            "DepositFactoryContract: caller is not a owner"
        );
        _;
    }

    modifier isValidPayContract(address seller) {
        require(
            payContracts[seller] != address(0),
            "DepositFactoryContract: pay contract is not created."
        );

        require(
            _payContracts[payContracts[seller]],
            "DepositFactoryContract: only pay contracts created by this factory can call the function!"
        );

        _;
    }

    modifier isValidDepositContract(address seller) {
        require(
            depositContracts[seller] != address(0),
            "DepositFactoryContract: deposit contract is not created."
        );

        require(
            _depositContracts[depositContracts[seller]],
            "DepositFactoryContract: only deposit contracts created by this factory can call the function!"
        );

        _;
    }

    /** SIMPLE PAY CONTRACT **/

    function setMasterPayContractAddress(
        address masterPayContract
    ) public onlySpryntOwner {
        _masterPayContract = masterPayContract;
    }

    function setPlatformFeePay(
        uint96 platformFeePay_
    ) external onlySpryntOwner {
        require(
            platformFeePay_ > 0,
            "DepositFactoryContract: platform fee pay must be greater than zero"
        );

        require(
            platformFeePay_ < 10000,
            "DepositFactoryContract: platform fee pay must be less than 100%"
        );

        platformFeePay = platformFeePay_;

        emit SetPlatformFeePay(platformFeePay_);
    }

    function getPayContract(address seller) public view returns (address) {
        return payContracts[seller];
    }

    function createPayContractBySeller(
        uint256 maxAcceptedUsdValue,
        address[] memory tokenAddresses,
        address sellerAddress,
        uint256 deadline,
        address chainlinkPriceFeedAddress
    ) public onlySprynt {
        require(
            payContracts[sellerAddress] == address(0),
            "DepositFactoryContract: already created pay contract."
        );

        require(
            _masterPayContract != address(0),
            "DepositFactoryContract: master pay contract address is not set."
        );

        address clone = createClone(_masterPayContract);

        SimplePay(payable(clone)).init(
            maxAcceptedUsdValue,
            tokenAddresses,
            sellerAddress,
            deadline,
            chainlinkPriceFeedAddress
        );

        payContracts[sellerAddress] = address(clone);
        _payContracts[clone] = true;

        emit SimplePayContractCreated(address(clone));
    }

    function setPayChainlinkPriceFeedAddress(
        address seller,
        address chainlinkPriceFeedAddress
    ) public onlySprynt isValidPayContract(seller) {
        SimplePay(payable(payContracts[seller])).setChainlinkPriceFeedAddress(
            chainlinkPriceFeedAddress
        );
    }

    function updateSupportTokenOfPayContract(
        address seller,
        address supportedTokenAddress_,
        bool isSupported
    ) external onlySprynt isValidPayContract(seller) {
        SimplePay(payable(payContracts[seller])).updateSupportToken(
            supportedTokenAddress_,
            isSupported
        );
    }

    function setPayReceiveStatus(
        address seller,
        bytes32 vpId
    ) external onlySprynt isValidPayContract(seller) {
        SimplePay(payable(payContracts[seller])).setReceiveStatus(vpId);
    }

    /** DEPOSIT CONTRACT **/

    function setMasterDepositContractAddress(
        address masterDepositContract
    ) public onlySpryntOwner {
        _masterDepositContract = masterDepositContract;
    }

    function setPlatformFeeMint(
        uint96 platformFeeMint_
    ) external onlySpryntOwner {
        require(
            platformFeeMint_ > 0,
            "DepositFactoryContract: platform fee mint must be greater than zero"
        );
        require(
            platformFeeMint_ < 10000,
            "DepositFactoryContract: platform fee mint must be less than 100%"
        );
        platformFeeMint = platformFeeMint_;
        emit SetPlatformFeeMint(platformFeeMint_);
    }

    function createDepositContractBySeller(
        address sellerAddress,
        address[] memory tokenAddress,
        uint256 mintPrice,
        uint256 whiteListMintPrice,
        uint256 minMintQuantity,
        uint256 maxMintQuantity,
        uint256 totalSupply,
        uint256 deadline,
        uint256 depositDeadline,
        address[] memory whiteList_,
        address chainlinkPriceFeedAddress
    ) public onlySprynt {
        if (depositContracts[sellerAddress] != address(0)) {
            address depositContractAddress = depositContracts[sellerAddress];

            DepositContract depositContract = DepositContract(
                payable(depositContractAddress)
            );

            if (depositContract.mintPrice() != mintPrice) {
                changeMintPrice(sellerAddress, mintPrice);
            }
            if (depositContract.whiteListMintPrice() != whiteListMintPrice) {
                changeWhiteListMintPrice(sellerAddress, whiteListMintPrice);
            }
            if (depositContract.minMintQuantity() != minMintQuantity) {
                changeMinMintQuantity(sellerAddress, minMintQuantity);
            }
            if (depositContract.maxMintQuantity() != maxMintQuantity) {
                changeMaxMintQuantity(sellerAddress, maxMintQuantity);
            }
            if (depositContract.totalSupply() != totalSupply) {
                changeTotalSupply(sellerAddress, totalSupply);
            }
            if (depositContract.deadline() != deadline) {
                changeDeadline(sellerAddress, deadline);
            }
            if (depositContract.depositDeadline() != depositDeadline) {
                changeDepositDeadline(sellerAddress, depositDeadline);
            }
            if (whiteList_.length > 0) {
                addWhiteList(sellerAddress, whiteList_);
            }

            if (tokenAddress.length > 0) {
                for (uint256 i = 0; i < tokenAddress.length; i++) {
                    updateSupportTokenOfDepositContract(
                        sellerAddress,
                        tokenAddress[i],
                        true
                    );
                }
            }

            setDepositChainlinkPriceFeedAddress(
                sellerAddress,
                chainlinkPriceFeedAddress
            );

            emit DepositContractUpdated(
                address(depositContract),
                mintPrice,
                whiteListMintPrice,
                minMintQuantity,
                maxMintQuantity,
                totalSupply,
                deadline
            );
        } else {
            require(
                _masterDepositContract != address(0),
                "Master deposit contract address is not set."
            );

            address clone = createClone(_masterDepositContract);

            DepositContract(payable(clone)).init(
                sellerAddress,
                tokenAddress,
                mintPrice,
                whiteListMintPrice,
                minMintQuantity,
                maxMintQuantity,
                totalSupply,
                deadline,
                depositDeadline,
                address(this),
                whiteList_,
                chainlinkPriceFeedAddress
            );

            _depositContracts[clone] = true;
            depositContracts[sellerAddress] = clone;

            emit DepositContractCreated(clone);
        }
    }

    function setDepositChainlinkPriceFeedAddress(
        address seller,
        address chainlinkPriceFeedAddress
    ) public onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller]))
            .setChainlinkPriceFeedAddress(chainlinkPriceFeedAddress);
    }

    function updateSupportTokenOfDepositContract(
        address seller,
        address supportedTokenAddress_,
        bool isSupported
    ) public onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).updateSupportToken(
            supportedTokenAddress_,
            isSupported
        );
    }

    function addWhiteList(
        address seller,
        address[] memory whiteList
    ) public onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).addWhiteList(
            whiteList
        );
    }

    function removeWhiteList(
        address seller,
        address[] memory whiteList
    ) public onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).removeWhiteList(
            whiteList
        );
    }

    function changeMintPrice(
        address seller,
        uint256 mintPrice
    ) public onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).changeMintPrice(
            mintPrice
        );
    }

    function changeWhiteListMintPrice(
        address seller,
        uint256 whiteListMintPrice
    ) public onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller]))
            .changeWhiteListMintPrice(whiteListMintPrice);
    }

    function changeMinMintQuantity(
        address seller,
        uint256 minMintQuantity
    ) public onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller]))
            .changeMinMintQuantity(minMintQuantity);
    }

    function changeMaxMintQuantity(
        address seller,
        uint256 maxMintQuantity
    ) public onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller]))
            .changeMaxMintQuantity(maxMintQuantity);
    }

    function changeDeadline(
        address seller,
        uint256 deadline
    ) public onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).changeDeadline(
            deadline
        );
    }

    function changeDepositDeadline(
        address seller,
        uint256 depositDeadline
    ) public onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller]))
            .changeDepositDeadline(depositDeadline);
    }

    function changeTotalSupply(
        address seller,
        uint256 totalSupply
    ) public onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).changeTotalSupply(
            totalSupply
        );
    }

    function getDepositContract(address seller) public view returns (address) {
        return depositContracts[seller];
    }

    function changeStage(
        address seller,
        uint256 stage
    ) public onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).changeStage(stage);
    }

    function setReceiveStatus(
        address seller,
        uint256 depositItemIndex
    ) external onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).setReceiveStatus(
            depositItemIndex
        );
    }

    function setTokenName(
        address seller,
        string memory name
    ) external onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).setName(name);
    }

    function setTokenSymbol(
        address seller,
        string memory symbol
    ) external onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).setSymbol(symbol);
    }

    function setTokenOwner(
        address seller,
        address owner,
        uint256[] memory tokenIds
    ) external onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).setOwner(
            owner,
            tokenIds
        );
    }

    function setTokenURI(
        address seller,
        uint256 tokenId,
        string memory uri
    ) external onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).setTokenURI(
            tokenId,
            uri
        );
    }

    function transferToken(
        address seller,
        address from,
        address to,
        uint256 tokenId
    ) external onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).transfer(
            from,
            to,
            tokenId
        );
    }

    function setTokenBaseURI(
        address seller,
        string memory baseURI
    ) external onlySprynt isValidDepositContract(seller) {
        DepositContract(payable(depositContracts[seller])).setBaseURI(baseURI);
    }

    /** UTILS **/

    function calcPayFeeAmount(uint256 amount) public view returns (uint256) {
        return _calcFeeAmount(amount, platformFeePay);
    }

    function calcMintFeeAmount(uint256 amount) public view returns (uint256) {
        return _calcFeeAmount(amount, platformFeeMint);
    }

    function getAdminWallet() external view returns (address) {
        return adminWallet;
    }

    modifier onlyAdminWallet() {
        require(
            hasRole(SPRYNT_ADMIN_WALLET_ROLE, msg.sender),
            "DepositFactoryContract: caller is not the admin wallet"
        );
        _;
    }

    function pause() public virtual onlyAdminWallet {
        _pause();
    }

    function unpause() public virtual onlyAdminWallet {
        _unpause();
    }

    /** OTHERS **/

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _calcFeeAmount(
        uint256 amount,
        uint96 fee
    ) internal pure returns (uint256) {
        unchecked {
            return (amount * fee) / 10000;
        }
    }
}
