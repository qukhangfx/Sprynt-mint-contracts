// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../library/Domain.sol";
import {DepositItem} from "../library/Structs.sol";
import {DepositFactoryContract} from "../parents/DepositFactoryContract.sol";

contract DepositContract {
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
    }
    uint256 private _depositItemCounter;
    mapping(uint256 => DepositItemStruct) private _depositItems;

    using SafeERC20 for IERC20;

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
        _factoryContractAddress = factoryContractAddress;
        if (whiteList_.length > 0) {
            for (uint256 i = 0; i < whiteList_.length; i++) {
                whiteList[whiteList_[i]] = true;
            }
        }

        initialized = true;
    }

    function mint(DepositItem calldata depositItem) public payable {
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

        require(depositItem.dstChainId == dstChainId, "Invalid dst chain id!");

        require(depositItem.deadline <= deadline, "Invalid deadline!");

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
        }

        if (tokenAddress == address(0)) {
            Address.sendValue(payable(address(this)), value);
        } else {
            IERC20(tokenAddress).safeTransferFrom(
                tx.origin,
                payable(address(this)),
                value
            );
        }

        uint256 currentIndex = _depositItemCounter++;
        DepositItemStruct memory newDepositItem = DepositItemStruct({
            owner: msg.sender,
            deadline: block.timestamp + depositDeadline,
            value: value
        });
        _depositItems[currentIndex] = newDepositItem;

        _mintedTokens += depositItem.mintQuantity;
    }

    modifier onlyPermissioned() {
        require(
            msg.sender == _sellerAddress ||
                msg.sender == _factoryContractAddress,
            "No permission!"
        );
        _;
    }

    function setReceiveStatus(uint256 depositItemId) public onlyPermissioned {
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
    }

    function withdrawDeposit(uint256 depositItemIndex) public {
        if (
            _depositItems[depositItemIndex].owner == msg.sender &&
            block.timestamp > _depositItems[depositItemIndex].deadline &&
            _isReceived[depositItemIndex] != true
        ) {
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
        }
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
