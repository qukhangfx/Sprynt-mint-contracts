// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../library/Domain.sol";
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

import {CloneFactory} from "../library/CloneFactory.sol";
import {DepositItem} from "../library/Structs.sol";
import {DepositContract} from "../childs/DepositContract.sol";

import "hardhat/console.sol";

contract DepositFactoryContract is
    AccessControl,
    NonblockingLzApp,
    EIP712,
    ReentrancyGuard,
    Pausable,
    CloneFactory
{
    using SafeERC20 for IERC20;

    bytes32 public constant DEPOSIT_ROLE = keccak256("DEPOSIT_ROLE");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    uint96 public platformFee = 250; // 2.5% platform fee
    address private _adminWallet;
    address private immutable _acceptToken;
    address private _masterDepositContract;

    mapping(address => uint256) private _accountNonces;

    mapping(address => bool) private _depositContracts;

    mapping(uint16 => mapping(address => address))
        public deployedDepositContracts;

    address[] private _depositContractsList;

    event SetAdminWallet(address adminWallet);
    event SetPlatformFee(uint96 platformFee);
    event DepositedToken(
        DepositItem depositItem,
        uint256 lzGasFee,
        bool isNativeToken
    );
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

    constructor(
        address _layerZeroEndpoint,
        address acceptToken,
        address owner,
        address adminWallet,
        address depositRoleAccount
    )
        NonblockingLzApp(_layerZeroEndpoint)
        EIP712("DepositFactoryContract", "1.0.0")
    {
        require(
            acceptToken != address(0),
            "AcceptToken cannot be zero address"
        );
        _acceptToken = acceptToken;
        _adminWallet = adminWallet;
        _setupRole(OWNER_ROLE, owner);
        _setupRole(DEPOSIT_ROLE, depositRoleAccount);
    }

    function setMasterDepositContractAddress(
        address masterDepositContract
    ) public onlyRole(OWNER_ROLE) {
        _masterDepositContract = masterDepositContract;
    }

    function _nonblockingLzReceive(
        uint16,
        bytes memory,
        uint64,
        bytes memory _payload
    ) internal override {
        (
            address sellerAddress,
            address tokenAddress,
            uint16 dstChainId,
            uint256 mintPrice,
            uint256 whiteListMintPrice,
            uint256 minMintQuantity,
            uint256 maxMintQuantity,
            uint256 totalSupply,
            uint256 deadline
        ) = abi.decode(
                _payload,
                (
                    address,
                    address,
                    uint16,
                    uint256,
                    uint256,
                    uint256,
                    uint256,
                    uint256,
                    uint256
                )
            );

        if (deployedDepositContracts[dstChainId][sellerAddress] != address(0)) {
            address depositContractAddress = deployedDepositContracts[
                dstChainId
            ][sellerAddress];

            DepositContract depositContract = DepositContract(
                depositContractAddress
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
            if (_masterDepositContract != address(0)) {
                address clone = createClone(_masterDepositContract);
                DepositContract(clone).init(
                    sellerAddress,
                    tokenAddress,
                    dstChainId,
                    mintPrice,
                    whiteListMintPrice,
                    minMintQuantity,
                    maxMintQuantity,
                    totalSupply,
                    deadline,
                    address(this)
                );
                _depositContracts[clone] = true;
                _depositContractsList.push(clone);
                deployedDepositContracts[dstChainId][sellerAddress] = clone;
                emit DepositContractCreated(clone);
            } else {
                address masterDepositContractAddress = address(
                    new DepositContract(
                        sellerAddress,
                        tokenAddress,
                        dstChainId,
                        mintPrice,
                        whiteListMintPrice,
                        minMintQuantity,
                        maxMintQuantity,
                        totalSupply,
                        deadline,
                        address(this)
                    )
                );

                _depositContracts[masterDepositContractAddress] = true;
                _masterDepositContract = masterDepositContractAddress;
                _depositContractsList.push(masterDepositContractAddress);
                deployedDepositContracts[dstChainId][
                    sellerAddress
                ] = masterDepositContractAddress;
                emit MasterDepositContractCreated(masterDepositContractAddress);
            }
        }
    }

    function getLatestDepositContract() external view returns (address) {
        require(_depositContractsList.length > 0, "No items in the mapping");
        return _depositContractsList[_depositContractsList.length - 1];
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
  @dev Setup deposit role
  */
    function setupDepositRole(address account) external onlyRole(OWNER_ROLE) {
        _grantRole(DEPOSIT_ROLE, account);
    }

    function revokeDepositRole(address account) external onlyRole(OWNER_ROLE) {
        _revokeRole(DEPOSIT_ROLE, account);
    }

    function setAdminWallet(
        address adminWallet_
    ) external onlyRole(OWNER_ROLE) {
        require(
            adminWallet_ != address(0),
            "adminWallet address must not be zero address"
        );
        _adminWallet = adminWallet_;
        emit SetAdminWallet(adminWallet_);
    }

    function setPlatformFee(uint96 platformFee_) external onlyRole(OWNER_ROLE) {
        require(platformFee_ > 0, "platformFee must be greater than zero");
        require(platformFee_ < 10000, "platformFee must be less than 100%");
        platformFee = platformFee_;
        emit SetPlatformFee(platformFee_);
    }

    modifier onlyContract() {
        require(
            _depositContracts[msg.sender],
            "Only contracts created by this factory can call the function!"
        );
        _;
    }

    function depositTokenByClient(
        DepositItem calldata depositItem,
        bytes calldata signature,
        uint256 lzGasFee,
        bool isNativeToken,
        bytes calldata adapterParams
    ) external payable nonReentrant whenNotPaused onlyContract {
        require(
            block.timestamp <= depositItem.deadline,
            "Invalid expiration in deposit"
        );
        require(depositItem.isMintAvailable, "Mint is not available");
        if (isNativeToken) {
            require(
                msg.value >=
                    lzGasFee + depositItem.mintPrice * depositItem.mintQuantity,
                "Insufficient native token balances"
            );
        } else {
            require(msg.value >= lzGasFee, "Insufficient ERC20 token balances");
        }
        require(
            _verify(
                _hashTypedDataV4(
                    Domain._hashDepositItem(
                        depositItem,
                        _accountNonces[tx.origin]
                    )
                ),
                signature
            ),
            "Invalid signature"
        );
        unchecked {
            ++_accountNonces[tx.origin];
        }
        uint256 platformFeeAmount = _calcFeeAmount(
            depositItem.mintPrice,
            platformFee
        );
        uint256 userProfit = depositItem.mintPrice - platformFeeAmount;
        bytes memory encodedPayload = abi.encode(
            tx.origin,
            depositItem.mintQuantity,
            bytes(""),
            depositItem.sellerAddress
        );

        _lzSend(
            depositItem.dstChainId,
            encodedPayload,
            payable(tx.origin),
            address(0x0),
            adapterParams,
            lzGasFee
        );

        if (isNativeToken) {
            Address.sendValue(payable(_adminWallet), platformFeeAmount);
            Address.sendValue(payable(depositItem.sellerAddress), userProfit);
        } else {
            IERC20(_acceptToken).safeTransferFrom(
                tx.origin,
                _adminWallet,
                platformFeeAmount
            );
            IERC20(_acceptToken).safeTransferFrom(
                tx.origin,
                depositItem.sellerAddress,
                userProfit
            );
        }

        emit DepositedToken(depositItem, lzGasFee, isNativeToken);
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

    function _verify(
        bytes32 digest,
        bytes memory signature
    ) internal view returns (bool) {
        return hasRole(DEPOSIT_ROLE, ECDSA.recover(digest, signature));
    }

    function pause() public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    modifier onlyPermissioned() {
        require(
            hasRole(OWNER_ROLE, msg.sender) ||
                hasRole(DEPOSIT_ROLE, msg.sender),
            "Sender does not have the required role"
        );
        _;
    }

    function changeMintPrice(
        address depositContractAddress,
        uint256 mintPrice
    ) public onlyPermissioned {
        DepositContract(depositContractAddress).changeMintPrice(mintPrice);
    }

    function changeWhiteListMintPrice(
        address depositContractAddress,
        uint256 whiteListMintPrice
    ) public onlyPermissioned {
        DepositContract(depositContractAddress).changeWhiteListMintPrice(
            whiteListMintPrice
        );
    }

    function changeMinMintQuantity(
        address depositContractAddress,
        uint256 minMintQuantity
    ) public onlyPermissioned {
        DepositContract(depositContractAddress).changeMinMintQuantity(
            minMintQuantity
        );
    }

    function changeMaxMintQuantity(
        address depositContractAddress,
        uint256 maxMintQuantity
    ) public onlyPermissioned {
        DepositContract(depositContractAddress).changeMaxMintQuantity(
            maxMintQuantity
        );
    }

    function changeDeadline(
        address depositContractAddress,
        uint256 deadline
    ) public onlyPermissioned {
        DepositContract(depositContractAddress).changeDeadline(deadline);
    }

    function changeTotalSupply(
        address depositContractAddress,
        uint256 totalSupply
    ) public onlyPermissioned {
        DepositContract(depositContractAddress).changeTotalSupply(totalSupply);
    }

    function getDepositContract(
        uint16 dstChainId,
        address seller
    ) public view returns (address) {
        return deployedDepositContracts[dstChainId][seller];
    }
}
