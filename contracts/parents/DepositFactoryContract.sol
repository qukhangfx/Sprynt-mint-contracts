// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";
import "../childs/SimplePay.sol";

import {CloneFactory} from "../library/CloneFactory.sol";
import {DepositItem} from "../library/Structs.sol";
import {DepositContract} from "../childs/DepositContract.sol";
import {SimplePay} from "../childs/SimplePay.sol";
import "hardhat/console.sol";

contract DepositFactoryContract is
    AccessControl,
    NonblockingLzApp,
    ReentrancyGuard,
    Pausable,
    CloneFactory
{
    using SafeERC20 for IERC20;

    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    uint96 public platformFeeMint = 0; // 1.5% platform fee
    uint96 public platformFeePay = 0; // 1.5% platform fee
    address public adminWallet;
    address private _masterDepositContract;
    address private _masterPayContract;

    mapping(address => bool) private _depositContracts;
    mapping(address => bool) private _payContracts;
    mapping(address => address) public payContracts;

    mapping(uint16 => mapping(address => address))
        public deployedDepositContracts;

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

    constructor(
        address _layerZeroEndpoint,
        address owner,
        address adminWallet_,
        address depositRoleAccount
    ) NonblockingLzApp(_layerZeroEndpoint) {
        adminWallet = adminWallet_;
        _setupRole(OWNER_ROLE, owner);
        _setupRole(VALIDATOR_ROLE, depositRoleAccount);
    }

    function setupValidatorRole(address account) external onlyRole(OWNER_ROLE) {
        _grantRole(VALIDATOR_ROLE, account);
    }

    function revokeValidatorRole(
        address account
    ) external onlyRole(OWNER_ROLE) {
        _revokeRole(VALIDATOR_ROLE, account);
    }

    function setAdminWallet(
        address adminWallet_
    ) external onlyRole(OWNER_ROLE) {
        require(
            adminWallet_ != address(0),
            "adminWallet address must not be zero address"
        );
        adminWallet = adminWallet_;
        emit SetAdminWallet(adminWallet_);
    }

    modifier onlyPermissioned() {
        require(
            hasRole(OWNER_ROLE, msg.sender) ||
                hasRole(VALIDATOR_ROLE, msg.sender),
            "Sender does not have the required role"
        );
        _;
    }

    /** SIMPLE PAY CONTRACT **/

    function setMasterPayContractAddress(
        address masterPayContract
    ) public onlyRole(OWNER_ROLE) {
        _masterPayContract = masterPayContract;
    }

    function setPlatformFeePay(
        uint96 platformFeePay_
    ) external onlyRole(OWNER_ROLE) {
        require(
            platformFeePay_ > 0,
            "platformFeePay must be greater than zero"
        );
        require(
            platformFeePay_ < 10000,
            "platformFeePay must be less than 100%"
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
    ) public {
        require(
            payContracts[sellerAddress] == address(0),
            "already created pay contract."
        );

        require(
            _masterPayContract != address(0),
            "master pay contract address is not set."
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

    function updateSupportTokenOfPayContract(
        address supportedTokenAddress_,
        bool isSupported,
        address seller
    ) external onlyPay {
        require(
            payContracts[seller] != address(0),
            "pay contract is not created."
        );

        SimplePay(payable(payContracts[seller])).updateSupportToken(
            supportedTokenAddress_,
            isSupported
        );
    }

    function setPayReceiveStatus(
        bytes32 vpID,
        address seller
    ) external onlyRole(VALIDATOR_ROLE) {
        require(
            payContracts[seller] != address(0),
            "deposit contract is not created."
        );
        SimplePay(payable(payContracts[seller])).setReceiveStatus(vpID);
    }

    /** DEPOSIT CONTRACT **/

    function setMasterDepositContractAddress(
        address masterDepositContract
    ) public onlyRole(OWNER_ROLE) {
        _masterDepositContract = masterDepositContract;
    }

    function setPlatformFeeMint(
        uint96 platformFeeMint_
    ) external onlyRole(OWNER_ROLE) {
        require(
            platformFeeMint_ > 0,
            "platformFeeMint must be greater than zero"
        );
        require(
            platformFeeMint_ < 10000,
            "platformFeeMint must be less than 100%"
        );
        platformFeeMint = platformFeeMint_;
        emit SetPlatformFeeMint(platformFeeMint_);
    }

    function createDepositContractBySeller(
        address sellerAddress,
        address[] memory tokenAddress,
        uint16 dstChainId,
        uint256 mintPrice,
        uint256 whiteListMintPrice,
        uint256 minMintQuantity,
        uint256 maxMintQuantity,
        uint256 totalSupply,
        uint256 deadline,
        uint256 depositDeadline,
        address[] memory whiteList_,
        address chainlinkPriceFeedAddress
    ) public {
        if (deployedDepositContracts[dstChainId][sellerAddress] != address(0)) {
            address depositContractAddress = deployedDepositContracts[
                dstChainId
            ][sellerAddress];

            DepositContract depositContract = DepositContract(
                payable(depositContractAddress)
            );
            if (depositContract.mintPrice() != mintPrice) {
                changeMintPrice(depositContractAddress, mintPrice);
            }
            if (depositContract.whiteListMintPrice() != whiteListMintPrice) {
                changeWhiteListMintPrice(
                    depositContractAddress,
                    whiteListMintPrice
                );
            }
            if (depositContract.minMintQuantity() != minMintQuantity) {
                changeMinMintQuantity(depositContractAddress, minMintQuantity);
            }
            if (depositContract.maxMintQuantity() != maxMintQuantity) {
                changeMaxMintQuantity(depositContractAddress, maxMintQuantity);
            }
            if (depositContract.totalSupply() != totalSupply) {
                changeTotalSupply(depositContractAddress, totalSupply);
            }
            if (depositContract.deadline() != deadline) {
                changeDeadline(depositContractAddress, deadline);
            }

            if (depositContract.depositDeadline() != depositDeadline) {
                changeDepositDeadline(depositContractAddress, depositDeadline);
            }
            if (whiteList_.length > 0) {
                depositContract.addWhiteList(whiteList_);
            }

            if (tokenAddress.length > 0) {
                for (uint256 i = 0; i < tokenAddress.length; i++) {
                    depositContract.updateSupportToken(tokenAddress[i], true);
                }
            }

            setChainlinkPriceFeedAddress(
                depositContractAddress,
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
                "master deposit contract address is not set."
            );
            address clone = createClone(_masterDepositContract);
            DepositContract(payable(clone)).init(
                sellerAddress,
                tokenAddress,
                dstChainId,
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
            deployedDepositContracts[dstChainId][sellerAddress] = clone;
            emit DepositContractCreated(clone);
        }
    }

    function setChainlinkPriceFeedAddress(
        address depositContractAddress,
        address chainlinkPriceFeedAddress
    ) public onlyPermissioned {
        DepositContract(payable(depositContractAddress))
            .setChainlinkPriceFeedAddress(chainlinkPriceFeedAddress);
    }

    function addWhiteList(
        address depositContractAddress,
        address[] memory whiteList
    ) public onlyPermissioned {
        DepositContract(payable(depositContractAddress)).addWhiteList(
            whiteList
        );
    }

    function removeWhiteList(
        address depositContractAddress,
        address[] memory whiteList
    ) public onlyPermissioned {
        DepositContract(payable(depositContractAddress)).removeWhiteList(
            whiteList
        );
    }

    function changeMintPrice(
        address depositContractAddress,
        uint256 mintPrice
    ) public onlyPermissioned {
        DepositContract(payable(depositContractAddress)).changeMintPrice(
            mintPrice
        );
    }

    function changeWhiteListMintPrice(
        address depositContractAddress,
        uint256 whiteListMintPrice
    ) public onlyPermissioned {
        DepositContract(payable(depositContractAddress))
            .changeWhiteListMintPrice(whiteListMintPrice);
    }

    function changeMinMintQuantity(
        address depositContractAddress,
        uint256 minMintQuantity
    ) public onlyPermissioned {
        DepositContract(payable(depositContractAddress)).changeMinMintQuantity(
            minMintQuantity
        );
    }

    function changeMaxMintQuantity(
        address depositContractAddress,
        uint256 maxMintQuantity
    ) public onlyPermissioned {
        DepositContract(payable(depositContractAddress)).changeMaxMintQuantity(
            maxMintQuantity
        );
    }

    function changeDeadline(
        address depositContractAddress,
        uint256 deadline
    ) public onlyPermissioned {
        DepositContract(payable(depositContractAddress)).changeDeadline(
            deadline
        );
    }

    function changeDepositDeadline(
        address depositContractAddress,
        uint256 depositDeadline
    ) public onlyPermissioned {
        DepositContract(payable(depositContractAddress)).changeDepositDeadline(
            depositDeadline
        );
    }

    function changeTotalSupply(
        address depositContractAddress,
        uint256 totalSupply
    ) public onlyPermissioned {
        DepositContract(payable(depositContractAddress)).changeTotalSupply(
            totalSupply
        );
    }

    function getDepositContract(
        uint16 dstChainId,
        address seller
    ) public view returns (address) {
        return deployedDepositContracts[dstChainId][seller];
    }

    function changeStage(
        address depositContractAddress,
        uint256 stage
    ) public onlyPermissioned {
        DepositContract(payable(depositContractAddress)).changeStage(stage);
    }

    function getAdminWallet() external view returns (address) {
        return adminWallet;
    }

    function withdraw(
        address token,
        uint256 value
    ) external onlyRole(OWNER_ROLE) {
        if (token == address(0)) {
            Address.sendValue(payable(adminWallet), value);
        } else {
            IERC20(token).safeTransferFrom(address(this), adminWallet, value);
        }
    }

    function withdrawAll(address token) external onlyRole(OWNER_ROLE) {
        if (token == address(0)) {
            Address.sendValue(payable(adminWallet), address(this).balance);
        } else {
            IERC20(token).safeTransferFrom(
                address(this),
                payable(adminWallet),
                IERC20(token).balanceOf(address(this))
            );
        }
    }

    function setReceiveStatus(
        uint256 depositItemID,
        uint16 dstChainId,
        address seller
    ) external onlyRole(VALIDATOR_ROLE) {
        require(
            deployedDepositContracts[dstChainId][seller] != address(0),
            "deposit contract is not created."
        );
        DepositContract(payable(deployedDepositContracts[dstChainId][seller]))
            .setReceiveStatus(depositItemID);
    }

    function setTokenOwner(
        address owner,
        uint256 tokenId,
        uint16 dstChainId,
        address seller
    ) external onlyPermissioned {
        require(
            deployedDepositContracts[dstChainId][seller] != address(0),
            "deposit contract is not created."
        );
        DepositContract(payable(deployedDepositContracts[dstChainId][seller]))
            .setOwner(owner, tokenId);
    }

    function setTokenURI(
        uint256 tokenId,
        string memory uri,
        uint16 dstChainId,
        address seller
    ) external onlyPermissioned {
        require(
            deployedDepositContracts[dstChainId][seller] != address(0),
            "deposit contract is not created."
        );
        DepositContract(payable(deployedDepositContracts[dstChainId][seller]))
            .setTokenURI(tokenId, uri);
    }

    function burnToken(
        address owner,
        uint256 tokenId,
        uint16 dstChainId,
        address seller
    ) external onlyPermissioned {
        require(
            deployedDepositContracts[dstChainId][seller] != address(0),
            "deposit contract is not created."
        );
        DepositContract(payable(deployedDepositContracts[dstChainId][seller]))
            .burn(owner, tokenId);
    }

    function transferToken(
        address from,
        address to,
        uint256 tokenId,
        uint16 dstChainId,
        address seller
    ) external onlyPermissioned {
        require(
            deployedDepositContracts[dstChainId][seller] != address(0),
            "deposit contract is not created."
        );
        DepositContract(payable(deployedDepositContracts[dstChainId][seller]))
            .transfer(from, to, tokenId);
    }

    function setTokenBaseURI(
        string memory baseUri,
        uint16 dstChainId,
        address seller
    ) external onlyPermissioned {
        require(
            deployedDepositContracts[dstChainId][seller] != address(0),
            "deposit contract is not created."
        );
        DepositContract(payable(deployedDepositContracts[dstChainId][seller]))
            .setBaseURI(baseUri);
    }

    /** UTILS **/
    modifier onlyContract() {
        require(
            _depositContracts[msg.sender],
            "Only contracts created by this factory can call the function!"
        );
        _;
    }

    modifier onlyPay() {
        require(
            _payContracts[msg.sender],
            "Only pay contracts created by this factory can call the function!"
        );
        _;
    }

    function calcPayFeeAmount(uint256 amount) public view returns (uint256) {
        return _calcFeeAmount(amount, platformFeePay);
    }

    function calcMintFeeAmount(uint256 amount) public view returns (uint256) {
        return _calcFeeAmount(amount, platformFeeMint);
    }

    function pause() public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /** OTHERS **/
    function _nonblockingLzReceive(
        uint16,
        bytes memory,
        uint64,
        bytes memory _payload
    ) internal override {
        uint256 taskType;
        assembly {
            taskType := mload(add(_payload, 32))
        }

        if (taskType == 1) {
            (
                ,
                uint256 maxAcceptedUsdValue,
                address[] memory tokenAddresses_,
                address sellerAddress,
                uint256 deadline,
                address chainlinkPriceFeedAddress
            ) = abi.decode(
                    _payload,
                    (uint256, uint256, address[], address, uint256, address)
                );
            createPayContractBySeller(
                maxAcceptedUsdValue,
                tokenAddresses_,
                sellerAddress,
                deadline,
                chainlinkPriceFeedAddress
            );
        } else if (taskType == 2) {
            (
                ,
                address sellerAddress,
                address[] memory tokenAddress,
                uint16 dstChainId,
                uint256 mintPrice,
                uint256 whiteListMintPrice,
                uint256 minMintQuantity,
                uint256 maxMintQuantity,
                uint256 totalSupply,
                uint256 deadline,
                uint256 depositDeadline,
                address[] memory whiteList_,
                address chainlinkPriceFeedAddress
            ) = abi.decode(
                    _payload,
                    (
                        uint256,
                        address,
                        address[],
                        uint16,
                        uint256,
                        uint256,
                        uint256,
                        uint256,
                        uint256,
                        uint256,
                        uint256,
                        address[],
                        address
                    )
                );

            createDepositContractBySeller(
                sellerAddress,
                tokenAddress,
                dstChainId,
                mintPrice,
                whiteListMintPrice,
                minMintQuantity,
                maxMintQuantity,
                totalSupply,
                deadline,
                depositDeadline,
                whiteList_,
                chainlinkPriceFeedAddress
            );
        }
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function estimateFee(
        uint16 dstChainId_,
        bool _useZro,
        bytes calldata _adapterParams,
        DepositItem calldata depositItem
    ) public view returns (uint nativeFee, uint zroFee) {
        bytes memory encodedPayload = abi.encode(
            tx.origin,
            depositItem.mintQuantity,
            bytes(""),
            depositItem.sellerAddress
        );
        return
            lzEndpoint.estimateFees(
                dstChainId_,
                address(this),
                encodedPayload,
                _useZro,
                _adapterParams
            );
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
