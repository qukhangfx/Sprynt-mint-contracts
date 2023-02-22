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
import { DepositItem } from "../library/Structs.sol";
import "../library/Domain.sol";
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

import "hardhat/console.sol";
contract DepositFactoryContract is AccessControl, NonblockingLzApp, EIP712, ReentrancyGuard, Pausable {
  using SafeERC20 for IERC20;

  event SetAdminWallet(address adminWallet);
  event SetPlatformFee(uint96 platformFee);
  event DepositedToken(DepositItem depositItem, uint256 lzGasFee, bool isNativeToken);
  
  bytes32 public constant DEPOSIT_ROLE = keccak256("DEPOSIT_ROLE");

  uint96 public platformFee = 250;   // 2.5% platform fee
  address private _adminWallet;
  address private immutable _acceptToken;
  
  mapping(address => uint256) private _accountNonces;

  constructor(
    address _layerZeroEndpoint,
    address acceptToken, 
    address owner,
    address adminWallet,
    address depositRoleAccount
  ) NonblockingLzApp(_layerZeroEndpoint) EIP712("DepositFactoryContract", "1.0.0") {
    require(acceptToken != address(0), "AcceptToken cannot be zero address");
    _acceptToken = acceptToken;
    _adminWallet = adminWallet;
    _setupRole(DEFAULT_ADMIN_ROLE, owner);
    _setupRole(DEPOSIT_ROLE, depositRoleAccount);
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  /**
  @dev Setup deposit role
  */
  function setupDepositRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
      _grantRole(DEPOSIT_ROLE, account);
  }

  function setAdminWallet(address adminWallet_) external onlyRole(DEFAULT_ADMIN_ROLE)
  {
    require (adminWallet_ != address(0), "adminWallet address must not be zero address");
    _adminWallet = adminWallet_;
    emit SetAdminWallet(adminWallet_);
  }

  function setPlatformFee(uint96 platformFee_) external onlyRole(DEFAULT_ADMIN_ROLE)
  {
    require (platformFee_ > 0, "platformFee must be greater than zero");
    require (platformFee_ < 10000, "platformFee must be less than 100%");
    platformFee = platformFee_;
    emit SetPlatformFee(platformFee_);
  }

  function depositTokenByClient(
    DepositItem calldata depositItem,
    bytes calldata signature,
    uint256 lzGasFee,
    bool isNativeToken
  ) external nonReentrant whenNotPaused payable {
    require(msg.sender == tx.origin, "Contract address is not allowed");
    require(block.timestamp <= depositItem.deadline, "Invalid expiration in deposit");
    require(depositItem.isMintAvailable, "Mint is not available");
    if (isNativeToken) {
      require(msg.value >= lzGasFee + depositItem.mintPrice, "Insufficient native token balances");
    } else {
      require(msg.value >= lzGasFee, "Insufficient native token balances");
    }
    require(
      _verify(
        _hashTypedDataV4(
          Domain._hashDepositItem(
            depositItem, 
            _accountNonces[msg.sender]
          )),
      signature
    ), "Invalid signature");
    unchecked {
      ++ _accountNonces[msg.sender];
    }
    uint256 platformFeeAmount = _calcFeeAmount(depositItem.mintPrice, platformFee);
    uint256 userProfit = depositItem.mintPrice - platformFeeAmount;
    bytes memory encodedPayload = abi.encode(
      msg.sender,
      depositItem.mintQuantity,
      depositItem.sellerAddress
    );
    
    _lzSend(depositItem.dstChainId, encodedPayload, payable(msg.sender), address(0x0), bytes(""), lzGasFee);

    if (isNativeToken) {
      Address.sendValue(payable(_adminWallet), platformFeeAmount);
      Address.sendValue(payable(depositItem.sellerAddress), userProfit);
    } else {
      IERC20(_acceptToken).safeTransferFrom(msg.sender, _adminWallet, platformFeeAmount);
      IERC20(_acceptToken).safeTransferFrom(msg.sender, depositItem.sellerAddress, userProfit);
    }

    emit DepositedToken(depositItem, lzGasFee, isNativeToken);
  }
  
  function estimateFee(uint16 dstChainId_, bool _useZro, bytes calldata _adapterParams) public view returns (uint nativeFee, uint zroFee) {
    bytes memory encodedPayload = abi.encode(
      address(0),
      uint256(0),
      address(0)
    );
    return lzEndpoint.estimateFees(dstChainId_, address(this), encodedPayload, _useZro, _adapterParams);
  }

  function _nonblockingLzReceive(uint16, bytes memory, uint64, bytes memory) internal override {}

  function _calcFeeAmount(uint256 amount, uint96 fee) internal pure returns (uint256) {
    unchecked { return amount * fee / 10000; }
  }

  function _verify(bytes32 digest, bytes memory signature)
  internal view returns (bool)
  {
    return hasRole(DEPOSIT_ROLE, ECDSA.recover(digest, signature));
  }

  function pause() public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
      _pause();
  }

  function unpause() public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
      _unpause();
  }
}