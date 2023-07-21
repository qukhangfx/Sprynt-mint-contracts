// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import {DepositFactoryContract} from "../parents/DepositFactoryContract.sol";

contract SimplePay is AccessControl, ReentrancyGuard {
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    uint256 public maxAcceptedValue;
    address[] public supportedTokenList;
    address public seller;
    uint256 public deadline;
    address private _factoryContractAddress;

    mapping(address => bool) public supportedTokenAddress;
    mapping(bytes32 => bool) public vpIDs;

    struct DepositItemStruct {
        uint256 depositItemId;
        address buyer;
        uint256 deadline;
        uint256 value;
        address token;
    }
    uint256 private _depositItemCounter = 0;

    mapping(uint256 => DepositItemStruct) public depositItems;
    mapping(address => uint256[]) public unReceivedItems;
    mapping(uint256 => bool) public isReceived;
    mapping(bytes32 => uint256) public vpOfDepositItems;

    event Pay(address indexed token, address indexed from, uint256 value);
    event Received(address sender, uint256 value);

    bool public initialized;

    mapping(address => uint256) public allowances;

    using SafeERC20 for IERC20;
    using Address for address payable;

    constructor() {}

    function init(
        uint256 maxAcceptedValue_,
        address[] memory supportedTokenAddresses,
        address owner,
        uint256 deadline_
    ) external {
        require(!initialized, "Contract is already initialized");
        _grantRole(OWNER_ROLE, owner);
        _factoryContractAddress = msg.sender;
        seller = owner;
        deadline = deadline_;
        maxAcceptedValue = maxAcceptedValue_;
        for (uint256 i = 0; i < supportedTokenAddresses.length; i++) {
            supportedTokenAddress[supportedTokenAddresses[i]] = true;
            supportedTokenList.push(supportedTokenAddresses[i]);
        }
        initialized = true;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function updateDeadline(uint256 deadline_) external onlyRole(OWNER_ROLE) {
        deadline = deadline_;
    }

    function updateMaxAcceptedValue(
        uint256 maxAcceptedValue_
    ) external onlyRole(OWNER_ROLE) {
        maxAcceptedValue = maxAcceptedValue_;
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

    function deposit(
        address token,
        uint256 value,
        bytes32 vpID
    ) public payable {
        require(
            value <= maxAcceptedValue,
            "Value is greater than max accepted value"
        );
        require(supportedTokenAddress[token], "This token is not supported");
        require(!vpIDs[vpID], "vpID is already used");

        if (token == address(0)) {
            require(msg.value >= value, "Insufficient native token balances");
            Address.sendValue(payable(address(this)), msg.value);
            value = msg.value;
        } else {
            IERC20(token).safeTransferFrom(
                msg.sender,
                payable(address(this)),
                value
            );
        }
        uint256 currentIndex = ++_depositItemCounter;
        uint256 depositDeadline = block.timestamp + deadline;
        DepositItemStruct memory depositItem = DepositItemStruct({
            depositItemId: currentIndex,
            buyer: msg.sender,
            deadline: depositDeadline,
            value: value,
            token: token
        });
        depositItems[currentIndex] = depositItem;
        unReceivedItems[msg.sender].push(currentIndex);
        vpOfDepositItems[vpID] = currentIndex;
        vpIDs[vpID] = true;
    }

    function setReceiveStatus(bytes32 vpID) external {
        uint256 depositItemId = vpOfDepositItems[vpID];
        require(
            msg.sender == _factoryContractAddress,
            "Caller is not a factory contract"
        );
        require(
            isReceived[depositItemId] == false,
            "This depositItem is already paid"
        );
        require(
            depositItems[depositItemId].buyer != address(0),
            "This deposit item is not exist!"
        );

        address buyer = depositItems[depositItemId].buyer;

        isReceived[depositItemId] = true;

        for (uint256 i = 0; i < unReceivedItems[buyer].length; ) {
            unchecked {
                if (unReceivedItems[buyer][i] == depositItemId) {
                    unReceivedItems[buyer][i] = unReceivedItems[buyer][
                        unReceivedItems[buyer].length - 1
                    ];
                    unReceivedItems[buyer].pop();
                    break;
                }
                i++;
            }
        }

        allowances[depositItems[depositItemId].token] += depositItems[
            depositItemId
        ].value;
    }

    function withdrawFund(
        address token,
        uint256 value
    ) external onlyRole(OWNER_ROLE) {
        require(value <= allowances[token], "Insufficient fund");

        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );
        uint256 platformFeePayAmount = depositFactoryContract.calcPayFeeAmount(
            value
        );
        if (token == address(0)) {
            if (platformFeePayAmount > 0) {
                Address.sendValue(
                    payable(depositFactoryContract.getAdminWallet()),
                    platformFeePayAmount
                );
            }
            Address.sendValue(payable(seller), value - platformFeePayAmount);
        } else {
            if (platformFeePayAmount > 0) {
                IERC20(token).safeTransferFrom(
                    payable(address(this)),
                    depositFactoryContract.getAdminWallet(),
                    platformFeePayAmount
                );
            }
            IERC20(token).safeTransferFrom(
                payable(address(this)),
                seller,
                value - platformFeePayAmount
            );
        }
        emit Pay(token, msg.sender, value);
        allowances[token] -= value;
    }

    function refund(address token) public payable {
        uint256 total;
        for (uint256 i = 0; i < unReceivedItems[msg.sender].length; ) {
            unchecked {
                if (
                    block.timestamp >
                    depositItems[unReceivedItems[msg.sender][i]].deadline &&
                    depositItems[unReceivedItems[msg.sender][i]].token ==
                    token &&
                    isReceived[
                        depositItems[unReceivedItems[msg.sender][i]]
                            .depositItemId
                    ] ==
                    false
                ) {
                    depositItems[
                        unReceivedItems[msg.sender][i]
                    ] = DepositItemStruct({
                        depositItemId: depositItems[
                            unReceivedItems[msg.sender][i]
                        ].depositItemId,
                        buyer: address(0),
                        deadline: depositItems[unReceivedItems[msg.sender][i]]
                            .deadline,
                        value: depositItems[unReceivedItems[msg.sender][i]]
                            .value,
                        token: depositItems[unReceivedItems[msg.sender][i]].token
                    });
                    total += depositItems[unReceivedItems[msg.sender][i]].value;
                    if (i != unReceivedItems[msg.sender].length - 1) {
                        unReceivedItems[msg.sender][i] = unReceivedItems[
                            msg.sender
                        ][unReceivedItems[msg.sender].length - 1];
                    }
                    unReceivedItems[msg.sender].pop();
                }
                i++;
            }
        }

        if (token == address(0)) {
            Address.sendValue(payable(msg.sender), total);
        } else {
            IERC20(token).safeTransferFrom(
                payable(address(this)),
                payable(msg.sender),
                total
            );
        }
    }

    function refundAll(address[] memory tokens) public {
        for (uint8 i = 0; i < tokens.length; ) {
            unchecked {
                refund(tokens[i]);
                i++;
            }
        }
    }

    function withdrawDeposit(uint256 depositItemIndex) public {
        require(
            depositItems[depositItemIndex].buyer == msg.sender,
            "Caller is not a buyer"
        );
        require(
            block.timestamp > depositItems[depositItemIndex].deadline,
            "Deadline is not passed"
        );
        require(
            isReceived[depositItemIndex] == false,
            "This depositItem is already delivered"
        );
        uint256 value = depositItems[depositItemIndex].value;
        address token = depositItems[depositItemIndex].token;
        if (token == address(0)) {
            Address.sendValue(payable(msg.sender), value);
        } else {
            IERC20(token).safeTransferFrom(
                payable(address(this)),
                payable(msg.sender),
                value
            );
        }
        for (uint256 i = 0; i < unReceivedItems[msg.sender].length; ) {
            unchecked {
                if (unReceivedItems[msg.sender][i] == depositItemIndex) {
                    unReceivedItems[msg.sender][i] = unReceivedItems[
                        msg.sender
                    ][unReceivedItems[msg.sender].length - 1];
                    unReceivedItems[msg.sender].pop();
                    break;
                }
                i++;
            }
        }

        // Fix multiple withdraw bug
        depositItems[depositItemIndex] = DepositItemStruct({
            depositItemId: depositItems[depositItemIndex].depositItemId,
            buyer: address(0),
            deadline: depositItems[depositItemIndex].deadline,
            value: depositItems[depositItemIndex].value,
            token: depositItems[depositItemIndex].token
        });
    }

    function getSupportedTokenList() external view returns (address[] memory) {
        return supportedTokenList;
    }
}