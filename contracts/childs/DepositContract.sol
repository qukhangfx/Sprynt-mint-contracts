// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "../library/Domain.sol";
import {DepositItem} from "../library/Structs.sol";
import {DepositFactoryContract} from "../parents/DepositFactoryContract.sol";

import {ChainLinkPriceFeed} from "./PriceFeed.sol";

import "hardhat/console.sol";

contract DepositContract is ReentrancyGuard {
    address private _sellerAddress;
    address[] public tokenAddress;
    uint256 public dstChainId;
    uint256 public mintPrice;
    uint256 public whiteListMintPrice;
    uint256 public minMintQuantity;
    uint256 public maxMintQuantity;
    uint256 public totalSupply;
    uint256 public deadline;
    
    address private _factoryContractAddress;
    address private _chainlinkPriceFeedAddress;

    uint256 public depositDeadline;

    uint256 public currentStage;

    bool public initialized;

    uint256 private _mintedTokens;

    mapping(address => bool) public whiteList;

    mapping(uint256 => bool) private _isReceived;

    mapping(address => bool) public supportedTokenAddress;

     mapping(address => uint256[]) private _tokensOfAccounts;

    mapping(uint256 => address) private _owners;

    mapping(uint256 => string) private _tokenURIs;

    string private _baseURI = "";

    struct DepositItemStruct {
        address owner;
        uint256 deadline;
        uint256 value;
        uint256 amount;
        address token;
    }
    uint256 private _depositItemCounter = 0;
    mapping(uint256 => DepositItemStruct) public _depositItems;

    using SafeERC20 for IERC20;
    using Address for address payable;

    event Received(address sender, uint256 value);
    event Transferred(address from, address to, uint256 tokenId);

    event WithdrawDeposit(address sender, uint256 depositItemIndex);

    event Deposit(
        uint256 depositItemIndex,
        address owner,
        uint256 amount,
        uint256 value,
        uint256 deadline,
        address token
    );

    event SetReceiveStatus(address sender, uint256 depositItemIndex);

    constructor() {}

    function init(
        address sellerAddress,
        address[] memory tokenAddress_,
        uint256 dstChainId_,
        uint256 mintPrice_,
        uint256 whiteListMintPrice_,
        uint256 minMintQuantity_,
        uint256 maxMintQuantity_,
        uint256 totalSupply_,
        uint256 deadline_,
        uint256 depositDeadline_,
        address factoryContractAddress,
        address[] memory whiteList_,
        address chainlinkPriceFeedAddress
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
        
        if (whiteList_.length > 0) {
            for (uint256 i = 0; i < whiteList_.length; i++) {
                whiteList[whiteList_[i]] = true;
            }
        }

        for (uint256 i = 0; i < tokenAddress_.length; i++) {
            supportedTokenAddress[tokenAddress_[i]] = true;
        }

        _factoryContractAddress = factoryContractAddress;
        _chainlinkPriceFeedAddress = chainlinkPriceFeedAddress;

        initialized = true;
    }

    function setChainlinkPriceFeedAddress(
        address chainlinkPriceFeedAddress
    ) public onlyFactoryContract {
        _chainlinkPriceFeedAddress = chainlinkPriceFeedAddress;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function mint(
        DepositItem calldata depositItem,
        address token
    ) public payable {
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

        require(supportedTokenAddress[token] == true, "Not supported token!");

        (, uint256 newPrice) = ChainLinkPriceFeed(_chainlinkPriceFeedAddress).convertUsdToTokenPrice(depositItem.mintPrice, token);
        uint256 value = newPrice * depositItem.mintQuantity;

        if (token == address(0)) {
            require(msg.value >= value, "Insufficient native token balances");
        }

        if (token == address(0)) {
            Address.sendValue(payable(address(this)), msg.value);
        } else {
            IERC20(token).safeTransferFrom(
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
            amount: depositItem.mintQuantity,
            token: token
        });
        _depositItems[currentIndex] = newDepositItem;

        emit Deposit(
            currentIndex,
            msg.sender,
            depositItem.mintQuantity,
            value,
            block.timestamp + depositDeadline,
            token
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

    modifier onlyFactoryContract() {
        require(
            msg.sender == _factoryContractAddress,
            "Caller is not a factory contract"
        );
        _;
    }

    function setReceiveStatus(uint256 depositItemIndex) external {
        require(
            msg.sender == _factoryContractAddress,
            "Caller is not a factory contract"
        );

        require(
            _isReceived[depositItemIndex] == false,
            "This deposit item is already received!"
        );

        require(
            _depositItems[depositItemIndex].owner != address(0),
            "This deposit item is not exist!"
        );

        _isReceived[depositItemIndex] = true;

        DepositFactoryContract depositFactoryContract = DepositFactoryContract(
            _factoryContractAddress
        );

        uint256 value = _depositItems[depositItemIndex].value;

        uint256 platformFeeMintAmount = depositFactoryContract
            .calcMintFeeAmount(value);

        uint256 userProfit = value - platformFeeMintAmount;

        address token = _depositItems[depositItemIndex].token;

        if (token == address(0)) {
            Address.sendValue(
                payable(depositFactoryContract.getAdminWallet()),
                platformFeeMintAmount
            );
            Address.sendValue(payable(_sellerAddress), userProfit);
        } else {
            IERC20(token).safeTransferFrom(
                payable(address(this)),
                depositFactoryContract.getAdminWallet(),
                platformFeeMintAmount
            );
            IERC20(token).safeTransferFrom(
                payable(address(this)),
                _sellerAddress,
                userProfit
            );
        }

        _mintedTokens += _depositItems[depositItemIndex].amount;

        require(_mintedTokens <= totalSupply, "Exceed total supply!");

        emit SetReceiveStatus(msg.sender, depositItemIndex);
    }

    function withdrawDeposit(uint256 depositItemIndex) public {
        require(
            _depositItems[depositItemIndex].owner == msg.sender,
            "No permission!"
        );
        require(
            _depositItems[depositItemIndex].deadline < block.timestamp,
            "The deadline has not been exceeded!"
        );
        require(
            _isReceived[depositItemIndex] != true,
            "This deposit item is already received!"
        );

        uint256 value = _depositItems[depositItemIndex].value;
        address token = _depositItems[depositItemIndex].token;

        if (token == address(0)) {
            Address.sendValue(payable(msg.sender), value);
        } else {
            IERC20(token).safeTransferFrom(
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
            amount: _depositItems[depositItemIndex].amount,
            token: _depositItems[depositItemIndex].token
        });
    }

    /*** ERC-721 FUNCTIONS */

    function setTokenURI(uint256 tokenId, string memory uri) external {
        require(
            msg.sender == _factoryContractAddress,
            "Caller is not a factory contract"
        );
        _tokenURIs[tokenId] = uri;
    }

    function setBaseURI(string memory baseURI_) external {
        require(
            msg.sender == _factoryContractAddress,
            "Do not have permission"
        );
        _baseURI = baseURI_;
    }

    function setOwner(address owner, uint256 tokenId) external {
        require(
            msg.sender == _factoryContractAddress,
            "Do not have permission"
        );
        _owners[tokenId] = owner;
        _tokensOfAccounts[owner].push(tokenId);
    }

    function baseURI() external view returns (string memory) {
        return _baseURI;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (bytes(_tokenURIs[tokenId]).length == 0) {
            return
                string(abi.encodePacked(_baseURI, Strings.toString(tokenId)));
        } else {
            return _tokenURIs[tokenId];
        }
    }

    function balanceOf(address owner) external view returns (uint256 balance) {
        return _tokensOfAccounts[owner].length;
    }

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        return _owners[tokenId];
    }

    function transfer(address from, address to, uint256 tokenId) external {
        require(
            msg.sender == _factoryContractAddress,
            "Do not have permission"
        );
        require(
            _owners[tokenId] == from,
            "This account does not have the required tokenID"
        );
        _owners[tokenId] = to;
        for (uint256 i = 0; i < _tokensOfAccounts[from].length; i++) {
            if (_tokensOfAccounts[from][i] == tokenId) {
                delete _tokensOfAccounts[from][i];
            }
        }
        _tokensOfAccounts[to].push(tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external {
        require(
            _owners[tokenId] == from,
            "This account does not have the required tokenID"
        );
        emit Transferred(from, to, tokenId);
    }

    function burn(address owner, uint256 tokenId) external {
        require(
            msg.sender == _factoryContractAddress,
            "Do not have permission"
        );
        require(
            _owners[tokenId] == owner,
            "This account does not have the required tokenID"
        );
        _owners[tokenId] = address(0);

        for (uint256 i = 0; i < _tokensOfAccounts[owner].length; i++) {
            if (_tokensOfAccounts[owner][i] == tokenId) {
                delete _tokensOfAccounts[owner][i];
            }
        }
    }

    /** WITHDRAW */

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

    /** UTILS */

    function updateSupportToken(
        address supportedTokenAddress_,
        bool isSupported
    ) public onlyPermissioned {
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

     function getTotalMintedToken() public view returns (uint256) {
        return _mintedTokens;
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

    function getDepositItemByIndex(
        uint256 depositItemIndex
    ) public view returns (DepositItemStruct memory) {
        require(depositItemIndex > 0, "Invalid deposit item id!");
        require(
            depositItemIndex <= _depositItemCounter,
            "Invalid deposit item id!"
        );
        return _depositItems[depositItemIndex];
    }
}
