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
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";
import { DepositItem } from "./library/Structs.sol";
import "./library/Domain.sol";

interface AggregatorV3Interface {
  function latestRoundData()
    external
    view
    returns (
        uint80 roundId,
        int answer,
        uint startedAt,
        uint updatedAt,
        uint80 answeredInRound
    );
}

contract PolarysDepositContract is AccessControl, NonblockingLzApp, EIP712, ReentrancyGuard, Pausable {
  using SafeERC20 for IERC20;

  event SetAdminWallet(address adminWallet);
  event SetPlatformFee(uint96 platformFee);
  event CreatedNftContract(string name, string symbol, string tokenUri, uint256 totalSupply, uint16 dstChainId);
  event DepositedToken(DepositItem depositItem);
  
  bytes32 public constant DEPOSIT_ROLE = keccak256("DEPOSIT_ROLE");

  uint96 public platformFee = 250;   // 2.5% platform fee
  uint8 public constant PAYLOAD_CREATE_NFT_CONTRACT = 0;
  uint8 public constant PAYLOAD_MINT_NFT = 1;
  address private _adminWallet;
  address private immutable _acceptToken;
  AggregatorV3Interface internal immutable priceFeed;
  
  mapping(address => uint256) private _accountNonces;

  constructor(
    address _layerZeroEndpoint,
    address acceptToken, 
    address owner,
    address adminWallet,
    address priceAggregator, 
    address depositRoleAccount
  ) NonblockingLzApp(_layerZeroEndpoint) EIP712("MultichainMintingEngine", "1.0.0") {
    require(acceptToken != address(0), "AcceptToken cannot be zero address");
    require(priceAggregator != address(0), "PriceAggregator cannot be zero address");
    _acceptToken = acceptToken;
    _adminWallet = adminWallet;
    priceFeed = AggregatorV3Interface(priceAggregator);
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

  function depositToken(
    DepositItem calldata depositItem,
    bytes calldata signature
  ) external nonReentrant whenNotPaused payable {
    require(msg.sender == tx.origin, "Contract address is not allowed");
    require(block.timestamp <= depositItem.deadline, "Invalid expiration in deposit");
    require(depositItem.isMintAvailable, "Mint is not available");
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
      PAYLOAD_MINT_NFT,
      depositItem.mintQuantity,
      depositItem.sellerAddress
    );
    IERC20(_acceptToken).safeTransferFrom(msg.sender, _adminWallet, platformFeeAmount);
    IERC20(_acceptToken).safeTransferFrom(msg.sender, depositItem.sellerAddress, userProfit);
    _lzSend(depositItem.dstChainId, encodedPayload, payable(msg.sender), address(0x0), bytes(""), msg.value);
    emit DepositedToken(depositItem);
  }

  function createNftContract(
    string memory name, 
    string memory symbol,
    string memory tokenUri,
    uint256 totalSupply,
    uint16 dstChainId
  ) external payable {
    bytes memory encodedPayload = abi.encodePacked(
      PAYLOAD_CREATE_NFT_CONTRACT,
      keccak256(bytes(name)),
      keccak256(bytes(symbol)),
      keccak256(bytes(tokenUri)),
      totalSupply,
      msg.sender
    );
    _lzSend(dstChainId, encodedPayload, payable(msg.sender), address(0x0), bytes(""), msg.value);
    emit CreatedNftContract(name, symbol, tokenUri, totalSupply, dstChainId);
  }

  function estimateFee(uint16 _dstChainId, bool _useZro, bytes calldata _adapterParams) public view returns (uint nativeFee, uint zroFee) {
    bytes memory encodedPayload = abi.encodePacked(
      uint8(0),
      bytes32(0),
      bytes32(0),
      bytes32(0),
      uint256(0),
      address(0)
    );
    return lzEndpoint.estimateFees(_dstChainId, address(this), encodedPayload, _useZro, _adapterParams);
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