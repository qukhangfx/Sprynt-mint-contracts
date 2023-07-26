// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../library/Domain.sol";
import {DepositItem} from "../library/Structs.sol";
import {DepositFactoryContract} from "../parents/DepositFactoryContract.sol";

import "hardhat/console.sol";

contract DepositContract is ReentrancyGuard {
    address private _sellerAddress;
    address public tokenAddress;
    uint256 public dstChainId;
    uint256 public mintPrice;
    uint256 public whiteListMintPrice;
    uint256 public minMintQuantity;
    uint256 public maxMintQuantity;
    uint256 public totalSupply;
    uint256 public deadline;
    address private _factoryContractAddress;

    uint256 public depositDeadline;

    uint256 public currentStage;

    bool public initialized;

    uint256 private _mintedTokens;

    mapping(address => bool) public whiteList;

    mapping(uint256 => bool) private _isReceived;

    struct DepositItemStruct {
        address owner;
        uint256 deadline;
        uint256 value;
        uint256 amount;
    }
    uint256 private _depositItemCounter = 0;
    mapping(uint256 => DepositItemStruct) public _depositItems;

    using SafeERC20 for IERC20;
    using Address for address payable;

    event Received(address sender, uint256 value);

    event WithdrawDeposit(address sender, uint256 depositItemId);

    event Deposit(
        uint256 depositItemId,
        address owner,
        uint256 amount,
        uint256 value,
        uint256 deadline
    );

    event SetReceiveStatus(address sender, uint256 depositItemId);

    constructor() {}

    function init(
        address sellerAddress,
        address tokenAddress_,
        uint256 dstChainId_,
        uint256 mintPrice_,
        uint256 whiteListMintPrice_,
        uint256 minMintQuantity_,
        uint256 maxMintQuantity_,
        uint256 totalSupply_,
        uint256 deadline_,
        uint256 depositDeadline_,
        address factoryContractAddress,
        address[] memory whiteList_
    ) external {
        require(!initialized, "Contract is already initialized");
        currentStage = 0;
        _sellerAddress = sellerAddress;
        tokenAddress = tokenAddress_;
        dstChainId = dstChainId_;
        mintPrice = mintPrice_;
        whiteListMintPrice = whiteListMintPrice_;
        minMintQuantity = minMintQuantity_;
        maxMintQuantity = maxMintQuantity_;
        totalSupply = totalSupply_;
        deadline = deadline_;
        depositDeadline = depositDeadline_;
        _factoryContractAddress = factoryContractAddress;
        if (whiteList_.length > 0) {
            for (uint256 i = 0; i < whiteList_.length; i++) {
                whiteList[whiteList_[i]] = true;
            }
        }

        initialized = true;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function mint(DepositItem calldata depositItem) public payable {
        require(block.timestamp <= deadline, "The deadline has been exceeded!");

        require(currentStage != 0, "We have not ready yet!");

        require(depositItem.sellerAddress == _sellerAddress, "Invalid seller!");

        require(
            depositItem.mintQuantity >= minMintQuantity &&
                depositItem.mintQuantity <= maxMintQuantity,
            "Invalid mint quantity!"
        );

        require(
            _mintedTokens + depositItem.mintQuantity <= totalSupply,
            "Exceed total supply!"
        );

        if (currentStage == 1) {
            require(whiteList[msg.sender], "You are not in white list!");
            require(
                depositItem.mintPrice == whiteListMintPrice,
                "Invalid mint price!"
            );
        } else {
            require(depositItem.mintPrice == mintPrice, "Invalid mint price!");
        }

        uint256 value = depositItem.mintPrice * depositItem.mintQuantity;

        if (tokenAddress == address(0)) {
            require(msg.value >= value, "Insufficient native token balances");
            require(msg.value == value, "Value must be exact");
        }

        if (tokenAddress == address(0)) {
            Address.sendValue(payable(address(this)), msg.value);
        } else {
            IERC20(tokenAddress).safeTransferFrom(
                tx.origin,
                payable(address(this)),
                value
            );
        }

        uint256 currentIndex = ++_depositItemCounter;
        DepositItemStruct memory newDepositItem = DepositItemStruct({
            owner: msg.sender,
            deadline: block.timestamp + depositDeadline,
            value: value,
            amount: depositItem.mintQuantity
        });
        _depositItems[currentIndex] = newDepositItem;

        emit Deposit(
            currentIndex,
            msg.sender,
            depositItem.mintQuantity,
            value,
            block.timestamp + depositDeadline
        );
    }

    modifier onlyPermissioned() {
        require(
            msg.sender == _sellerAddress ||
                msg.sender == _factoryContractAddress,
            "No permission!"
        );
        _;
    }

    function setReceiveStatus(uint256 depositItemId) external {
        require(
            msg.sender == _factoryContractAddress,
            "Caller is not a factory contract"
        );

        require(
            _isReceived[depositItemId] == false,
            "This deposit item is already received!"
        );

        require(
            _depositItems[depositItemId].owner != address(0),
            "This deposit item is not exist!"
        );

        _isReceived[depositItemId] = true;

        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );

        uint256 value = _depositItems[depositItemId].value;

        uint256 platformFeeMintAmount = depositFactoryContract
            .calcMintFeeAmount(value);

        uint256 userProfit = value - platformFeeMintAmount;

        if (tokenAddress == address(0)) {
            Address.sendValue(
                payable(depositFactoryContract.getAdminWallet()),
                platformFeeMintAmount
            );
            Address.sendValue(payable(_sellerAddress), userProfit);
        } else {
            IERC20(tokenAddress).safeTransferFrom(
                payable(address(this)),
                depositFactoryContract.getAdminWallet(),
                platformFeeMintAmount
            );
            IERC20(tokenAddress).safeTransferFrom(
                payable(address(this)),
                _sellerAddress,
                userProfit
            );
        }

        _mintedTokens += _depositItems[depositItemId].amount;

        require(_mintedTokens <= totalSupply, "Exceed total supply!");

        emit SetReceiveStatus(msg.sender, depositItemId);
    }

    function withdrawDeposit(uint256 depositItemIndex) public {
        require(_depositItems[depositItemIndex].owner == msg.sender, "No permission!");
        require(
            _depositItems[depositItemIndex].deadline < block.timestamp,
            "The deadline has not been exceeded!"
        );
        require(
            _isReceived[depositItemIndex] != true,
            "This deposit item is already received!"
        );

        uint256 value = _depositItems[depositItemIndex].value;
        if (tokenAddress == address(0)) {
            Address.sendValue(payable(msg.sender), value);
        } else {
            IERC20(tokenAddress).safeTransferFrom(
                payable(address(this)),
                payable(msg.sender),
                value
            );
        }

        emit WithdrawDeposit(msg.sender, depositItemIndex);

        _depositItems[depositItemIndex] = DepositItemStruct({
            owner: address(0),
            deadline: _depositItems[depositItemIndex].deadline,
            value: _depositItems[depositItemIndex].value,
            amount: _depositItems[depositItemIndex].amount
        });
    }

    function changeMintPrice(uint256 mintPrice_) public onlyPermissioned {
        mintPrice = mintPrice_;
    }

    function changeMinMintQuantity(
        uint256 minMintQuantity_
    ) public onlyPermissioned {
        minMintQuantity = minMintQuantity_;
    }

    function changeMaxMintQuantity(
        uint256 maxMintQuantity_
    ) public onlyPermissioned {
        maxMintQuantity = maxMintQuantity_;
    }

    function changeDeadline(uint256 deadline_) public onlyPermissioned {
        deadline = deadline_;
    }

    function changeDepositDeadline(uint256 deadline_) public onlyPermissioned {
        depositDeadline = deadline_;
    }

    function changeTotalSupply(uint256 totalSupply_) public onlyPermissioned {
        require(totalSupply_ >= _mintedTokens, "Invalid total supply!");
        totalSupply = totalSupply_;
    }

    function changeWhiteListMintPrice(
        uint256 whiteListMintPrice_
    ) public onlyPermissioned {
        whiteListMintPrice = whiteListMintPrice_;
    }

    function getTotalMintedToken() public view returns (uint256) {
        return _mintedTokens;
    }

    function addWhiteList(address[] memory buyers) public onlyPermissioned {
        if (buyers.length > 0) {
            for (uint256 i = 0; i < buyers.length; i++) {
                whiteList[buyers[i]] = true;
            }
        }
    }

    function removeWhiteList(address[] memory buyers) public onlyPermissioned {
        if (buyers.length > 0) {
            for (uint256 i = 0; i < buyers.length; i++) {
                whiteList[buyers[i]] = false;
            }
        }
    }

    function changeStage(uint256 stage) public onlyPermissioned {
        currentStage = stage;
    }

    function getFactoryContractAddress() public view returns (address) {
        return _factoryContractAddress;
    }

    function getNumberOfDepositItems() public view returns (uint256) {
        return _depositItemCounter;
    }

    function getAllDepositItems()
        public
        view
        returns (DepositItemStruct[] memory)
    {
        DepositItemStruct[] memory depositItems = new DepositItemStruct[](
            _depositItemCounter
        );
        for (uint256 i = 0; i < _depositItemCounter; i++) {
            depositItems[i] = _depositItems[i + 1];
        }
        return depositItems;
    }

    function getDepositItemById(
        uint256 depositItemId
    ) public view returns (DepositItemStruct memory) {
        require(depositItemId > 0, "Invalid deposit item id!");
        require(
            depositItemId <= _depositItemCounter,
            "Invalid deposit item id!"
        );
        return _depositItems[depositItemId];
    }

    function getAllInfo()
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return (
            maxMintQuantity,
            depositDeadline,
            totalSupply,
            mintPrice,
            whiteListMintPrice,
            deadline,
            _mintedTokens,
            currentStage
        );
    }
}
