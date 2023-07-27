// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ChainLinkPriceFeed} from "./PriceFeed.sol";
import {DepositFactoryContract} from "../parents/DepositFactoryContract.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "hardhat/console.sol";

contract RPaymentContract is AccessControl {
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    mapping(bytes32 => bool) public vpIds;
    mapping(bytes32 => address) public ownerOfSubscription;

    mapping(bytes32 => bool) public disabledSubscription;

    address private _factoryContractAddress;
    address private _chainlinkPriceFeedAddress;

    struct RPaymentStruct {
        address seller;
        address buyer;
        uint256 value;
        bytes32 subscriptionId;
        uint256 timestamp;
        bool renew;
        address token;
    }

    struct SetupPaymentStruct {
        uint256 usdValue;
        uint256 duration;
    }

    struct VpInfo {
        address token;
        address seller;
        uint256 value;
        uint256 blockNumber;
    }

    mapping(address => mapping(bytes32 => SetupPaymentStruct))
        public setupPayment;

    mapping(address => mapping(bytes32 => RPaymentStruct))
        public lastestPayment;

    mapping(bytes32 => VpInfo) public vpInfo;

    using SafeERC20 for IERC20;
    using Address for address payable;

    event SetupSubscription(
        address indexed seller,
        bytes32 indexed subscriptionId,
        uint256 usdValue
    );

    event RPaymentUnsubscribe(
        address indexed buyer,
        bytes32 indexed subscriptionId,
        bytes32 indexed vpId
    );

    event RPaymentSubscribe(
        address indexed seller,
        address indexed buyer,
        bytes32 subscriptionId,
        bytes32 indexed vpId,
        uint256 value
    );

    event RPaymentResubscribe(
        address indexed seller,
        address indexed buyer,
        bytes32 indexed vpId,
        uint256 value
    );

    event RPaymentCancel(
        address indexed seller,
        address indexed buyer,
        bytes32 indexed vpId,
        bytes32 subscriptionId
    );

    event DisabledSubscription(
        address indexed seller,
        bytes32 indexed subscriptionId
    );

    event Paylink(
        address indexed seller,
        address indexed buyer,
        bytes32 indexed vpId,
        uint256 usdValue,
        uint256 value
    );

    address[] public tokenAddress;
    mapping(address => bool) public supportedTokenAddress;

    constructor(
        address[] memory tokenAddress_,
        address factoryContractAddress_,
        address chainLinkPriceFeedAddress_
    ) {
        tokenAddress = tokenAddress_;

         for (uint256 i = 0; i < tokenAddress_.length; i++) {
            supportedTokenAddress[tokenAddress_[i]] = true;
        }

        _factoryContractAddress = factoryContractAddress_;
        _chainlinkPriceFeedAddress = chainLinkPriceFeedAddress_;
        
        _grantRole(OWNER_ROLE, msg.sender);
    }

    function transferOwner(address newOwner) public onlyRole(OWNER_ROLE) {
        _setupRole(OWNER_ROLE, newOwner);
        _revokeRole(OWNER_ROLE, msg.sender);
    }

    function updateSupportToken(
        address supportedTokenAddress_,
        bool isSupported
    ) public onlyRole(OWNER_ROLE) {
        supportedTokenAddress[supportedTokenAddress_] = isSupported;
        if (isSupported) {
            tokenAddress.push(supportedTokenAddress_);
        } else {
            for (uint256 i = 0; i < tokenAddress.length; i++) {
                if (tokenAddress[i] == supportedTokenAddress_) {
                    tokenAddress[i] = tokenAddress[tokenAddress.length - 1];
                    tokenAddress.pop();
                    break;
                }
            }
        }
    }

    function setFactoryContractAddress(
        address factoryContractAddress_
    ) public onlyRole(OWNER_ROLE) {
        _factoryContractAddress = factoryContractAddress_;
    }

    function getPrice(
        uint256 usdValue,
        address token
    ) public view returns (uint256) {
        return ChainLinkPriceFeed(_chainlinkPriceFeedAddress).convertUsdToTokenPrice(usdValue, token);
    }

    /** PAY LINK **/

    function pay(
        address token,
        address seller,
        uint256 usdValue,
        bytes32 vpId
    ) public payable {
        require(!vpIds[vpId], "Already paid!");

        require(supportedTokenAddress[token], "Not supported token!");

         DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );

        uint256 value = getPrice(usdValue, token);

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
                msg.sender,
                depositFactoryContract.getAdminWallet(),
                platformFeePayAmount
            );

            IERC20(token).safeTransferFrom(
                msg.sender,
                seller,
                value - platformFeePayAmount
            );
        }

        vpIds[vpId] = true;

        vpInfo[vpId] = VpInfo({
            token: token,
            seller: seller,
            value: value,
            blockNumber: block.number
        });

        emit Paylink(seller, msg.sender, vpId, usdValue, value);
    }

    /** RECURRING PAYMENT **/

    function setupByValidator(
        address seller,
        bytes32 subscriptionId,
        uint256 usdValue,
        uint256 duration
    ) public {
        require(
            setupPayment[seller][subscriptionId].duration == 0,
            "Already setup!"
        );

        require(duration > 0, "Duration must be greater than 0!");

        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );

        require(
            depositFactoryContract.hasRole(VALIDATOR_ROLE, msg.sender),
            "Call is not the validator!"
        );

        setupPayment[seller][subscriptionId] = SetupPaymentStruct({
            usdValue: usdValue,
            duration: duration
        });

        ownerOfSubscription[subscriptionId] = seller;

        emit SetupSubscription(seller, subscriptionId, usdValue);
    }

    function setup(
        bytes32 subscriptionId,
        uint256 usdValue,
        uint256 duration
    ) public {
        require(
            setupPayment[msg.sender][subscriptionId].duration == 0,
            "Already setup!"
        );

        require(duration > 0, "Duration must be greater than 0!");

        setupPayment[msg.sender][subscriptionId] = SetupPaymentStruct({
            usdValue: usdValue,
            duration: duration
        });

        ownerOfSubscription[subscriptionId] = msg.sender;

        emit SetupSubscription(msg.sender, subscriptionId, usdValue);
    }

    function subscribe(
        address seller,
        bytes32 subscriptionId,
        bytes32 vpId,
        address token
    ) public payable {
        require(
            !disabledSubscription[subscriptionId],
            "Subscription is disabled!"
        );

        require(!vpIds[vpId], "Already subscribe!");

        require(
            setupPayment[seller][subscriptionId].duration > 0,
            "Not found!"
        );

        SetupPaymentStruct memory setupPaymentStruct = setupPayment[seller][
            subscriptionId
        ];

        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );

        require(
            token != address(0),
            "Not supported native token!"
        );

        require(supportedTokenAddress[token], "Not supported token!");

        uint256 value = ChainLinkPriceFeed(_chainlinkPriceFeedAddress).convertUsdToTokenPrice(setupPaymentStruct.usdValue, token);

        uint256 platformFeePayAmount = depositFactoryContract.calcPayFeeAmount(
            value
        );

        IERC20(token).safeTransferFrom(
            msg.sender,
            depositFactoryContract.getAdminWallet(),
            platformFeePayAmount
        );
        IERC20(token).safeTransferFrom(
            msg.sender,
            seller,
            value - platformFeePayAmount
        );

        lastestPayment[msg.sender][vpId] = RPaymentStruct({
            seller: seller,
            buyer: msg.sender,
            value: value,
            timestamp: block.timestamp,
            subscriptionId: subscriptionId,
            renew: true,
            token: token
        });

        vpIds[vpId] = true;

        emit RPaymentSubscribe(
            seller,
            msg.sender,
            subscriptionId,
            vpId,
            value
        );
    }

    function renew(address buyer, bytes32 vpId) public payable {
        RPaymentStruct memory lastestPayment_ = lastestPayment[buyer][vpId];

        require(lastestPayment_.buyer == buyer, "Not found subscription!");

        require(lastestPayment_.renew, "Unsubscribe!");

        SetupPaymentStruct memory setupPaymentStruct = setupPayment[
            lastestPayment_.seller
        ][lastestPayment_.subscriptionId];

        require(
            !disabledSubscription[lastestPayment_.subscriptionId],
            "Subscription is disabled!"
        );

        require(
            block.timestamp - lastestPayment_.timestamp >=
                setupPaymentStruct.duration,
            "Not yet time!"
        );

        address token = lastestPayment_.token;

        require(token != address(0), "Not supported native token!");
        require(supportedTokenAddress[token], "Not supported token!");

        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );

        uint256 platformFeePayAmount = depositFactoryContract.calcPayFeeAmount(
            lastestPayment_.value
        );

        IERC20(token).safeTransferFrom(
            buyer,
            depositFactoryContract.getAdminWallet(),
            platformFeePayAmount
        );

        IERC20(token).safeTransferFrom(
            buyer,
            lastestPayment_.seller,
            lastestPayment_.value - platformFeePayAmount
        );

        lastestPayment[buyer][vpId].timestamp =
            lastestPayment_.timestamp +
            setupPaymentStruct.duration;

        emit RPaymentResubscribe(
            lastestPayment_.seller,
            buyer,
            vpId,
            lastestPayment_.value
        );
    }

    function unsubscribe(bytes32 vpId) public {
        require(
            lastestPayment[msg.sender][vpId].buyer == msg.sender,
            "Caller is not the buyer!"
        );

        RPaymentStruct memory lastestPayment_ = lastestPayment[msg.sender][
            vpId
        ];

        lastestPayment[msg.sender][vpId] = RPaymentStruct({
            seller: lastestPayment_.seller,
            buyer: lastestPayment_.buyer,
            value: lastestPayment_.value,
            timestamp: lastestPayment_.timestamp,
            subscriptionId: lastestPayment_.subscriptionId,
            renew: false,
            token: lastestPayment_.token
        });

        emit RPaymentUnsubscribe(
            msg.sender,
            lastestPayment_.subscriptionId,
            vpId
        );
    }

    function disable(bytes32 subscriptionId) public {
        require(
            ownerOfSubscription[subscriptionId] == msg.sender,
            "Caller is not the owner!"
        );

        disabledSubscription[subscriptionId] = true;

        emit DisabledSubscription(msg.sender, subscriptionId);
    }

    function cancelBySeller(
        bytes32 subscriptionId,
        bytes32 vpId,
        address buyer
    ) public {
        RPaymentStruct memory lastestPayment_ = lastestPayment[buyer][vpId];

        require(lastestPayment_.renew, "Cancelled!");

        require(
            ownerOfSubscription[subscriptionId] == msg.sender,
            "Caller is not the owner!" 
        );

        lastestPayment[buyer][vpId] = RPaymentStruct({
            seller: lastestPayment_.seller,
            buyer: lastestPayment_.buyer,
            value: lastestPayment_.value,
            timestamp: lastestPayment_.timestamp,
            subscriptionId: lastestPayment_.subscriptionId,
            renew: false,
            token: lastestPayment_.token
        });

        emit RPaymentCancel(msg.sender, buyer, vpId, subscriptionId);
    }

    function cancelByValidator(
        bytes32 subscriptionId,
        bytes32 vpId,
        address buyer
    ) public {
        RPaymentStruct memory lastestPayment_ = lastestPayment[buyer][vpId];

        require(lastestPayment_.renew, "Cancelled!");

        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );

        require(
            depositFactoryContract.hasRole(VALIDATOR_ROLE, msg.sender),
            "Caller is not the validator!"
        );

        lastestPayment[buyer][vpId] = RPaymentStruct({
            seller: lastestPayment_.seller,
            buyer: lastestPayment_.buyer,
            value: lastestPayment_.value,
            timestamp: lastestPayment_.timestamp,
            subscriptionId: lastestPayment_.subscriptionId,
            renew: false,
            token: lastestPayment_.token
        });

        emit RPaymentCancel(msg.sender, buyer, vpId, subscriptionId);
    }

    function getLastestPayment(
        address buyer,
        bytes32 vpId
    ) public view returns (RPaymentStruct memory) {
        return lastestPayment[buyer][vpId];
    }
}