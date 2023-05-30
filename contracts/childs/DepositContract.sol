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
        address factoryContractAddress,
        address[] memory whiteList_
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
        if (whiteList_.length > 0) {
            for (uint256 i = 0; i < whiteList_.length; i++) {
                whiteList[whiteList_[i]] = true;
            }
        }
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
        address factoryContractAddress,
        address[] memory whiteList_
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
        if (whiteList_.length > 0) {
            for (uint256 i = 0; i < whiteList_.length; i++) {
                whiteList[whiteList_[i]] = true;
            }
        }
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
}
