// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {DepositFactoryContract} from "../parents/DepositFactoryContract.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title RPaymentContract
 * @author quockhangfuixlabs
 */
contract RPaymentContract is AccessControl {
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    struct Bytes32Set {
        bytes32[] values;
        mapping(bytes32 => bool) isIn;
    }

    function addToBytes32Set(
        Bytes32Set storage set,
        bytes32 value
    ) private returns (bool) {
        if (set.isIn[value]) return false;
        set.values.push(value);
        set.isIn[value] = true;
        return true;
    }

    struct AddressSet {
        address[] values;
        mapping(address => bool) isIn;
    }

    function addToAddressSet(
        AddressSet storage set,
        address value
    ) private returns (bool) {
        if (set.isIn[value]) return false;
        set.values.push(value);
        set.isIn[value] = true;
        return true;
    }

    mapping(bytes32 => bool) public vpIds;

    mapping(bytes32 => AddressSet) private _buyersOfSubscription;
    mapping(address => Bytes32Set) private _subscriptionsOfBuyer;
    mapping(bytes32 => address) public ownerOfSubscription;

    mapping(bytes32 => bool) public disabledSubscription;

    address private _factoryContractAddress;

    address[] public supportedTokenList;
    mapping(address => bool) public supportedTokenAddress;

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
        uint256 value;
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
        uint256 value
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

    event EnabledSubscription(
        address indexed seller,
        bytes32 indexed subscriptionId
    );

    event DisabledSubscription(
        address indexed seller,
        bytes32 indexed subscriptionId
    );

    event Paylink(
        address indexed seller,
        address indexed buyer,
        bytes32 indexed vpId,
        uint256 value
    );

    bool public initialized;

    address public priceFeedUSDCAddress;
    mapping(string => address) private _priceFeedAddress;

    function setPriceFeedAddress(
        string memory symbol,
        address priceFeed
    ) external onlyRole(OWNER_ROLE) {
        _priceFeedAddress[symbol] = priceFeed;
    }

    function getTokenInfo(
        address tokenAddress_
    ) public view returns (string memory, uint8) {
        ERC20 token = ERC20(tokenAddress_);
        string memory symbol = token.symbol();
        uint8 decimals = token.decimals();
        return (symbol, decimals);
    }

    function getLastestData(address chainLink) public view returns (int256) {
        AggregatorV3Interface dataFeed = AggregatorV3Interface(chainLink);
        // prettier-ignore
        (
            /* uint80 roundID */,
            int answer,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = dataFeed.latestRoundData();
        return answer;
    }

    function finalValueCalculate(
        uint256 amount,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public view returns (uint256) {
        // AggregatorV3Interface priceFeedUSDC = AggregatorV3Interface(
        //     priceFeedUSDCAddress
        // );
        // (, int256 priceUSDC, , , ) = priceFeedUSDC.latestRoundData();

        // AggregatorV3Interface priceFeedTarget = AggregatorV3Interface(
        //     _priceFeedAddress[tokenSymbol]
        // );
        // (, int256 priceTarget, , , ) = priceFeedTarget.latestRoundData();

        int256 priceUSDC = getLastestData(priceFeedUSDCAddress);
        int256 priceTarget = getLastestData(_priceFeedAddress[tokenSymbol]);

        uint256 exchangeRate = uint256(priceUSDC / priceTarget);

        uint256 finalValue = (amount * exchangeRate) / (10 ** tokenDecimals);

        return finalValue;
    }

    constructor(
        address[] memory supportedTokenAddresses,
        address factoryContractAddress_
    ) {
        require(!initialized, "Contract is already initialized");

        _factoryContractAddress = factoryContractAddress_;
        _grantRole(OWNER_ROLE, msg.sender);

        for (uint256 i = 0; i < supportedTokenAddresses.length; i++) {
            supportedTokenAddress[supportedTokenAddresses[i]] = true;
            supportedTokenList.push(supportedTokenAddresses[i]);
        }

        initialized = true;
    }

    function transferOwner(address newOwner) public onlyRole(OWNER_ROLE) {
        _setupRole(OWNER_ROLE, newOwner);
        _revokeRole(OWNER_ROLE, msg.sender);
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

    function setFactoryContractAddress(
        address factoryContractAddress_
    ) public onlyRole(OWNER_ROLE) {
        _factoryContractAddress = factoryContractAddress_;
    }

    function pay(
        address token_,
        address seller,
        uint256 value,
        bytes32 vpId
    ) public payable {
        require(!vpIds[vpId], "Already paid!");

        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );

        uint256 platformFeePayAmount = depositFactoryContract.calcPayFeeAmount(
            value
        );

        require(supportedTokenAddress[token_], "This token is not supported");

        if (token_ == address(0)) {
            require(msg.value == value, "Value not equal!");

            Address.sendValue(
                payable(depositFactoryContract.getAdminWallet()),
                platformFeePayAmount
            );
            Address.sendValue(payable(seller), value - platformFeePayAmount);
        } else {
            IERC20(token_).safeTransferFrom(
                msg.sender,
                depositFactoryContract.getAdminWallet(),
                platformFeePayAmount
            );
            IERC20(token_).safeTransferFrom(
                msg.sender,
                seller,
                value - platformFeePayAmount
            );
        }

        vpIds[vpId] = true;

        vpInfo[vpId] = VpInfo({
            token: token_,
            seller: seller,
            value: value,
            blockNumber: block.number
        });

        emit Paylink(seller, msg.sender, vpId, value);
    }

    function renew(address buyer, bytes32 vpId) public payable {
        RPaymentStruct memory lastestPayment_ = lastestPayment[buyer][vpId];

        require(lastestPayment_.buyer == buyer, "Not found subscription!");

        require(lastestPayment_.renew, "Unsubscribe!");

        require(
            supportedTokenAddress[lastestPayment_.token],
            "This token is not supported"
        );

        if (lastestPayment_.token == address(0)) {
            revert("This token is not supported");
        }

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

        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );

        uint256 platformFeePayAmount = depositFactoryContract.calcPayFeeAmount(
            lastestPayment_.value
        );

        IERC20(lastestPayment_.token).safeTransferFrom(
            buyer,
            depositFactoryContract.getAdminWallet(),
            platformFeePayAmount
        );

        IERC20(lastestPayment_.token).safeTransferFrom(
            buyer,
            lastestPayment_.seller,
            lastestPayment_.value - platformFeePayAmount
        );

        lastestPayment[buyer][vpId] = RPaymentStruct({
            seller: lastestPayment_.seller,
            buyer: buyer,
            value: setupPaymentStruct.value,
            timestamp: lastestPayment_.timestamp + setupPaymentStruct.duration, // next time renew
            subscriptionId: lastestPayment_.subscriptionId,
            renew: true,
            token: lastestPayment_.token
        });

        emit RPaymentResubscribe(
            lastestPayment_.seller,
            buyer,
            vpId,
            lastestPayment_.value
        );
    }

    function setupByValidator(
        address seller,
        bytes32 subscriptionId,
        uint256 value,
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
            "Not validator!"
        );

        setupPayment[seller][subscriptionId] = SetupPaymentStruct({
            value: value,
            duration: duration
        });
        ownerOfSubscription[subscriptionId] = seller;

        emit SetupSubscription(seller, subscriptionId, value);
    }

    // function enable(bytes32 subscriptionId) public {
    //     require(
    //         ownerOfSubscription[subscriptionId] == msg.sender,
    //         "Not owner!"
    //     );

    //     disabledSubscription[subscriptionId] = false;

    //     emit EnabledSubscription(msg.sender, subscriptionId);
    // }

    function disable(bytes32 subscriptionId) public {
        require(
            ownerOfSubscription[subscriptionId] == msg.sender,
            "Not owner!"
        );

        disabledSubscription[subscriptionId] = true;

        emit DisabledSubscription(msg.sender, subscriptionId);
    }

    function setup(
        bytes32 subscriptionId,
        uint256 value,
        uint256 duration
    ) public {
        require(
            setupPayment[msg.sender][subscriptionId].duration == 0,
            "Already setup!"
        );

        require(duration > 0, "Duration must be greater than 0!");

        setupPayment[msg.sender][subscriptionId] = SetupPaymentStruct({
            value: value,
            duration: duration
        });
        ownerOfSubscription[subscriptionId] = msg.sender;

        emit SetupSubscription(msg.sender, subscriptionId, value);
    }

    function subscribe(
        address token_,
        address seller,
        bytes32 subscriptionId,
        bytes32 vpId
    ) public payable {
        require(supportedTokenAddress[token_], "This token is not supported");

        if (token_ == address(0)) {
            revert("This token is not supported");
        }

        require(
            !disabledSubscription[subscriptionId],
            "Subscription is disabled!"
        );

        require(!vpIds[vpId], "Already subscribe!");

        require(
            setupPayment[seller][subscriptionId].duration > 0,
            "Subscription is not setup!"
        );

        SetupPaymentStruct memory setupPaymentStruct = setupPayment[seller][
            subscriptionId
        ];

        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );

        uint256 platformFeePayAmount = depositFactoryContract.calcPayFeeAmount(
            setupPaymentStruct.value
        );

        IERC20(token_).safeTransferFrom(
            msg.sender,
            depositFactoryContract.getAdminWallet(),
            platformFeePayAmount
        );
        IERC20(token_).safeTransferFrom(
            msg.sender,
            seller,
            setupPaymentStruct.value - platformFeePayAmount
        );

        lastestPayment[msg.sender][vpId] = RPaymentStruct({
            seller: seller,
            buyer: msg.sender,
            value: setupPaymentStruct.value,
            timestamp: block.timestamp,
            subscriptionId: subscriptionId,
            renew: true,
            token: token_
        });

        // Add subscriptionId to _subscriptionsOfBuyer
        addToBytes32Set(_subscriptionsOfBuyer[msg.sender], subscriptionId);

        // Add buyer to _buyersOfSubscription
        addToAddressSet(_buyersOfSubscription[subscriptionId], msg.sender);

        vpIds[vpId] = true;

        emit RPaymentSubscribe(
            seller,
            msg.sender,
            subscriptionId,
            vpId,
            setupPaymentStruct.value
        );
    }

    function unsubscribe(bytes32 vpId) public {
        require(
            lastestPayment[msg.sender][vpId].buyer == msg.sender,
            "Not found subscription!"
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

    function cancelBySeller(
        bytes32 subscriptionId,
        bytes32 vpId,
        address buyer
    ) public {
        RPaymentStruct memory lastestPayment_ = lastestPayment[buyer][vpId];

        require(lastestPayment_.renew, "Cancelled!");

        require(
            ownerOfSubscription[subscriptionId] == msg.sender,
            "Not found subscription!"
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
            "Not validator!"
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

    function getAllSubscriptionsOfBuyer(
        address buyer
    ) public view returns (bytes32[] memory) {
        return _subscriptionsOfBuyer[buyer].values;
    }

    function getAllBuyersOfSubscription(
        bytes32 subscriptionId
    ) public view returns (address[] memory) {
        return _buyersOfSubscription[subscriptionId].values;
    }
    
    function getLastestPayment(
        address buyer,
        bytes32 vpId
    ) public view returns (RPaymentStruct memory) {
        return lastestPayment[buyer][vpId];
    }
}
