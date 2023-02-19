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
import "../childs/LZSenderContract.sol";
import "../interfaces/ILZSenderContract.sol";

contract DepositFactoryContract is AccessControl, EIP712, ReentrancyGuard, Pausable {
  using SafeERC20 for IERC20;

  event SetAdminWallet(address adminWallet);
  event SetPlatformFee(uint96 platformFee);
  event DepositedToken(DepositItem depositItem, uint256 lzGasFee, bool isNativeToken);
  event CreatedLZSenderContract(address seller, address receiveFactoryContract, uint16 dstChainId);
  
  bytes32 public constant DEPOSIT_ROLE = keccak256("DEPOSIT_ROLE");

  uint96 public platformFee = 250;   // 2.5% platform fee
  address private _adminWallet;
  address private immutable _acceptToken;
  
  mapping(address => uint256) private _accountNonces;

  mapping(address => mapping(uint16 => address)) public lzSenderContracts;

  constructor(
    address acceptToken, 
    address owner,
    address adminWallet,
    address depositRoleAccount
  ) EIP712("MultichainMintingEngine", "1.0.0") {
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

  function createLZsenderContractBySeller(
    address layerZeroEndpoint,
    address receiveFactoryContract,
    uint16 dstChainId
  ) 
  external {
    LZSenderContract newSenderContract = new LZSenderContract(
      layerZeroEndpoint,
      dstChainId
    );
    address newContractAddress = address(newSenderContract);
    bytes memory _path = abi.encodePacked(receiveFactoryContract, newContractAddress);
    newSenderContract.setTrustedRemote(dstChainId, _path);
    lzSenderContracts[msg.sender][dstChainId] = newContractAddress;

    emit CreatedLZSenderContract(msg.sender, receiveFactoryContract, dstChainId);
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
    address lzSenderContractAddress = lzSenderContracts[depositItem.sellerAddress][depositItem.dstChainId];
    require(lzSenderContractAddress != address(0), "LZSender contract is not created");
    if (isNativeToken) {
      require(msg.value >= lzGasFee + depositItem.mintPrice, "Insufficient native token balances");
    }
    require(
      _verify(
        _hashTypedDataV4(
          Domain._hashDepositItem(
            depositItem, 
            _accountNonces[msg.sender]
          )
        ),
      signature
    ), "Invalid signature");
    unchecked {
      ++ _accountNonces[msg.sender];
    }
    uint256 platformFeeAmount = _calcFeeAmount(depositItem.mintPrice, platformFee);
    uint256 userProfit = depositItem.mintPrice - platformFeeAmount;
    bytes memory encodedPayload = abi.encodePacked(
      msg.sender,
      depositItem.mintQuantity,
      depositItem.sellerAddress
    );
    Address.functionCallWithValue(
      lzSenderContractAddress, 
      abi.encodeWithSignature(
        "sendNftMithMessage(bytes calldata, address)", 
        encodedPayload, msg.sender
      ),
      lzGasFee,
      "Failed to send LZ message"
    );
    if (isNativeToken) {
      Address.sendValue(payable(_adminWallet), platformFeeAmount);
      Address.sendValue(payable(depositItem.sellerAddress), userProfit);
    } else {
      IERC20(_acceptToken).safeTransferFrom(msg.sender, _adminWallet, platformFeeAmount);
      IERC20(_acceptToken).safeTransferFrom(msg.sender, depositItem.sellerAddress, userProfit);
    }
    
    emit DepositedToken(depositItem, lzGasFee, isNativeToken);
  }

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