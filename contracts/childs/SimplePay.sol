// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {DepositFactoryContract} from "../parents/DepositFactoryContract.sol";
import {ChainLinkPriceFeed} from "./PriceFeed.sol";

contract SimplePay is AccessControl, ReentrancyGuard {
    bytes32 public constant SELLER_ROLE = keccak256("SELLER_ROLE");

    uint256 public maxAcceptedUsdValue;
    address[] public supportedTokenList;
    address public seller;
    uint256 public deadline;

    address private _factoryContractAddress;
    address private _chainlinkPriceFeedAddress;

    mapping(address => bool) public supportedTokenAddress;
    mapping(bytes32 => bool) public vpIds;

    struct DepositItemStruct {
        uint256 depositItemIndex;
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

    event WithdrawFund(
        address indexed token,
        address indexed from,
        uint256 value
    );
    event Received(address sender, uint256 value);

    bool public initialized;

    mapping(address => uint256) public allowances;

    using SafeERC20 for IERC20;
    using Address for address payable;

    constructor() {}

    function init(
        uint256 maxAcceptedUsdValue_,
        address[] memory supportedTokenAddresses,
        address seller_,
        uint256 deadline_,
        address chainlinkPriceFeedAddress
    ) external {
        require(!initialized, "SimplePay: contract is already initialized");

        _grantRole(SELLER_ROLE, seller_);

        _factoryContractAddress = msg.sender;
        _chainlinkPriceFeedAddress = chainlinkPriceFeedAddress;

        seller = seller_;
        deadline = deadline_;

        maxAcceptedUsdValue = maxAcceptedUsdValue_;

        for (uint256 i = 0; i < supportedTokenAddresses.length; i++) {
            supportedTokenAddress[supportedTokenAddresses[i]] = true;
            supportedTokenList.push(supportedTokenAddresses[i]);
        }

        initialized = true;
    }

    function setChainlinkPriceFeedAddress(
        address chainlinkPriceFeedAddress
    ) external onlyFactoryContract {
        _chainlinkPriceFeedAddress = chainlinkPriceFeedAddress;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    modifier sellerOrFactoryContract() {
        require(
            msg.sender == seller || msg.sender == _factoryContractAddress,
            "SimplePay: no permission!"
        );
        _;
    }

    modifier onlyFactoryContract() {
        require(
            msg.sender == _factoryContractAddress,
            "SimplePay: caller is not a factory contract"
        );
        _;
    }

    modifier onlySeller() {
        require(
            hasRole(SELLER_ROLE, msg.sender),
            "SimplePay: caller is not a seller"
        );
        _;
    }

    function transferOwner(address newOwner) public onlySeller {
        _setupRole(SELLER_ROLE, newOwner);
        _revokeRole(SELLER_ROLE, msg.sender);
    }

    function updateDeadline(uint256 deadline_) external onlySeller {
        deadline = deadline_;
    }

    function updateMaxAcceptedUsdValue(
        uint256 maxAcceptedUsdValue_
    ) external onlySeller {
        maxAcceptedUsdValue = maxAcceptedUsdValue_;
    }

    function updateSupportToken(
        address supportedTokenAddress_,
        bool isSupported
    ) external sellerOrFactoryContract {
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

    function getPrice(
        uint256 usdValue,
        address token
    ) public view returns (uint256) {
        return
            ChainLinkPriceFeed(_chainlinkPriceFeedAddress)
                .convertUsdToTokenPrice(usdValue, token);
    }

    function deposit(
        address token,
        uint256 usdValue,
        bytes32 vpId
    ) public payable {
        require(
            usdValue <= maxAcceptedUsdValue,
            "SimplePay: USD value is greater than max accepted usd value"
        );

        require(
            supportedTokenAddress[token],
            "SimplePay: not supported token!"
        );
        require(!vpIds[vpId], "SimplePay: vp id is already used");

        uint256 value = getPrice(usdValue, token);

        if (token == address(0)) {
            require(
                msg.value >= value,
                "SimplePay: insufficient native token balances"
            );
            value = msg.value;

            Address.sendValue(payable(address(this)), msg.value);
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
            depositItemIndex: currentIndex,
            buyer: msg.sender,
            deadline: depositDeadline,
            value: value,
            token: token
        });

        depositItems[currentIndex] = depositItem;
        unReceivedItems[msg.sender].push(currentIndex);
        vpOfDepositItems[vpId] = currentIndex;

        vpIds[vpId] = true;
    }

    function setReceiveStatus(bytes32 vpId) external onlyFactoryContract {
        uint256 depositItemIndex = vpOfDepositItems[vpId];

        require(
            isReceived[depositItemIndex] == false,
            "SimplePay: this deposit item is already paid"
        );

        require(
            depositItems[depositItemIndex].buyer != address(0),
            "SimplePay: this deposit item is not exist!"
        );

        address buyer = depositItems[depositItemIndex].buyer;

        isReceived[depositItemIndex] = true;

        for (uint256 i = 0; i < unReceivedItems[buyer].length; ) {
            unchecked {
                if (unReceivedItems[buyer][i] == depositItemIndex) {
                    unReceivedItems[buyer][i] = unReceivedItems[buyer][
                        unReceivedItems[buyer].length - 1
                    ];
                    unReceivedItems[buyer].pop();
                    break;
                }
                i++;
            }
        }

        allowances[depositItems[depositItemIndex].token] += depositItems[
            depositItemIndex
        ].value;
    }

    function withdrawFund(address token) external onlySeller {
        uint256 value = allowances[token];

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
                IERC20(token).transfer(
                    depositFactoryContract.getAdminWallet(),
                    platformFeePayAmount
                );
            }

            IERC20(token).transfer(seller, value - platformFeePayAmount);
        }

        emit WithdrawFund(token, msg.sender, value);

        allowances[token] = 0;
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
                            .depositItemIndex
                    ] ==
                    false
                ) {
                    depositItems[
                        unReceivedItems[msg.sender][i]
                    ] = DepositItemStruct({
                        depositItemIndex: depositItems[
                            unReceivedItems[msg.sender][i]
                        ].depositItemIndex,
                        buyer: address(0),
                        deadline: depositItems[unReceivedItems[msg.sender][i]]
                            .deadline,
                        value: depositItems[unReceivedItems[msg.sender][i]]
                            .value,
                        token: depositItems[unReceivedItems[msg.sender][i]]
                            .token
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
            IERC20(token).transfer(msg.sender, total);
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

    modifier onlyBuyer(uint256 depositItemIndex) {
        require(
            depositItems[depositItemIndex].buyer == msg.sender,
            "SimplePay: caller is not a buyer"
        );

        _;
    }

    function withdrawDeposit(
        uint256 depositItemIndex
    ) public onlyBuyer(depositItemIndex) {
        // require(
        //     depositItems[depositItemIndex].buyer == msg.sender,
        //     "SimplePay: caller is not a buyer"
        // );

        require(
            block.timestamp > depositItems[depositItemIndex].deadline,
            "SimplePay: deadline is not passed"
        );

        require(
            isReceived[depositItemIndex] == false,
            "SimplePay: this depositItem is already delivered"
        );

        uint256 value = depositItems[depositItemIndex].value;
        address token = depositItems[depositItemIndex].token;

        if (token == address(0)) {
            Address.sendValue(payable(msg.sender), value);
        } else {
            IERC20(token).transfer(msg.sender, value);
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

        depositItems[depositItemIndex] = DepositItemStruct({
            depositItemIndex: depositItems[depositItemIndex].depositItemIndex,
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
