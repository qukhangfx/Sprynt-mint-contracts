// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;
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

    uint256 private _mintedTokens;

    mapping(address => bool) public whiteList;

    constructor(
        address sellerAddress,
        address tokenAddress_,
        uint256 dstChainId_,
        uint256 mintPrice_,
        uint256 whiteListMintPrice_,
        uint256 minMintQuantity_,
        uint256 maxMintQuantity_,
        uint256 totalSupply_,
        uint256 deadline_,
        address factoryContractAddress
    ) {
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
    }

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
        address factoryContractAddress
    ) external {
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
    }

    function mint(
        DepositItem calldata depositItem,
        bytes calldata signature,
        uint256 lzGasFee,
        bool isNativeToken,
        bytes calldata adapterParams
    ) public payable {
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

        if (whiteList[msg.sender]) {
            require(
                depositItem.mintPrice == whiteListMintPrice,
                "Invalid mint price!"
            );
        } else {
            require(depositItem.mintPrice == mintPrice, "Invalid mint price!");
        }

        DepositFactoryContract(_factoryContractAddress).depositTokenByClient{
            value: msg.value
        }(depositItem, signature, lzGasFee, isNativeToken, adapterParams);

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

    function addWhiteList(address buyer) public onlyPermissioned {
        whiteList[buyer] = true;
    }

    function removeWhiteList(address buyer) public onlyPermissioned {
        whiteList[buyer] = false;
    }
}
