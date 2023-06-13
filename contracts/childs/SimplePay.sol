// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {DepositFactoryContract} from "../parents/DepositFactoryContract.sol";

contract SimplePay is AccessControl {
    uint256 public maxAcceptedValue;
    bool public forwarded;
    mapping(address => bool) public supportedTokenAddress;
    address[] public supportedTokenList;
    address public seller;
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    address private _factoryContractAddress;
    mapping(bytes32 => bool) public vpIDs;

    event Pay(
        address indexed token,
        address indexed from,
        bytes32 indexed vpID,
        uint256 value
    );

    bool public initialized;

    using SafeERC20 for IERC20;

    constructor() {}

    function init(
        uint256 maxAcceptedValue_,
        bool forwarded_,
        address[] memory supportedTokenAddress_,
        address owner
    ) external {
        require(!initialized, "Contract is already initialized");
        _grantRole(OWNER_ROLE, owner);
        _factoryContractAddress = msg.sender;
        seller = owner;
        maxAcceptedValue = maxAcceptedValue_;
        for (uint256 i = 0; i < supportedTokenAddress_.length; i++) {
            supportedTokenAddress[supportedTokenAddress_[i]] = true;
            supportedTokenList.push(supportedTokenAddress_[i]);
        }
        forwarded = forwarded_;
        initialized = true;
    }

    function updateMaxAcceptedValue(
        uint256 maxAcceptedValue_
    ) external onlyRole(OWNER_ROLE) {
        maxAcceptedValue = maxAcceptedValue_;
    }

    function updateForwarded(bool forwarded_) external onlyRole(OWNER_ROLE) {
        forwarded = forwarded_;
    }

    function updateSupportToken(
        address supportedTokenAddress_,
        bool isSupported
    ) external onlyRole(OWNER_ROLE) {
        supportedTokenAddress[supportedTokenAddress_] = isSupported;
        if (isSupported) {
            supportedTokenList.push(supportedTokenAddress_);
        } else {
            for (uint256 i = 0; i < supportedTokenList.length; i++) {
                if (supportedTokenList[i] == supportedTokenAddress_) {
                    supportedTokenList[i] = supportedTokenList[
                        supportedTokenList.length - 1
                    ];
                    supportedTokenList.pop();
                    break;
                }
            }
        }
    }

    function pay(address token, uint256 value, bytes32 vpID) public payable {
        require(!vpIDs[vpID], "vpID is already paid");
        require(
            value <= maxAcceptedValue,
            "Value is greater than max accepted value"
        );
        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );
        uint256 platformFeePayAmount = depositFactoryContract.calcPayFeeAmount(
            value
        );
        if (token == address(0)) {
            require(msg.value >= value, "Insufficient native token balances");
            Address.sendValue(
                payable(depositFactoryContract.getAdminWallet()),
                platformFeePayAmount
            );
            Address.sendValue(payable(seller), value - platformFeePayAmount);
        } else {
            IERC20(token).safeTransferFrom(
                tx.origin,
                depositFactoryContract.getAdminWallet(),
                platformFeePayAmount
            );
            IERC20(token).safeTransferFrom(
                tx.origin,
                seller,
                value - platformFeePayAmount
            );
        }

        emit Pay(token, tx.origin, vpID, value);
        vpIDs[vpID] = true;
    }

    function getSupportedTokenList() external view returns (address[] memory) {
        return supportedTokenList;
    }

    function withdraw(address token, uint256 value) external {
        require(
            msg.sender == _factoryContractAddress,
            "Caller is not a factory contract"
        );
        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );
        if (token == address(0)) {
            Address.sendValue(
                payable(depositFactoryContract.getAdminWallet()),
                value
            );
        } else {
            IERC20(token).safeTransferFrom(
                address(this),
                depositFactoryContract.getAdminWallet(),
                value
            );
        }
    }

    function withdrawAll(address token) external {
        require(
            msg.sender == _factoryContractAddress,
            "Caller is not a factory contract"
        );
        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );
        if (token == address(0)) {
            Address.sendValue(
                payable(depositFactoryContract.getAdminWallet()),
                address(this).balance
            );
        } else {
            IERC20(token).safeTransferFrom(
                address(this),
                payable(depositFactoryContract.getAdminWallet()),
                IERC20(token).balanceOf(address(this))
            );
        }
    }
}
