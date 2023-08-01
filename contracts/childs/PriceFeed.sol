// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

// solhint-disable not-rely-on-time
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

// import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

library DataFeedClient {
    int256 internal constant MIN_VALUE = 10 ** 7; // 0.1 USD
    int256 internal constant MAX_VALUE = 1000000 * 10 ** 8; // 1,000,000 USD
    uint256 internal constant MAX_DELAY = 2592000; // 1 month

    function getData(
        AggregatorV3Interface dataFeed
    ) internal view returns (uint256) {
        (, int256 answer, , uint256 updatedAt, ) = dataFeed.latestRoundData();
        uint256 value = uint256(answer);

        require(answer >= MIN_VALUE, "DF: value too low");
        require(answer <= MAX_VALUE, "DF: value too high");
        require(updatedAt <= block.timestamp, "DF: future timestamp");
        require(
            updatedAt >= block.timestamp - MAX_DELAY,
            "DF: timestamp too old"
        );

        return value;
    }
}

contract ChainLinkPriceFeed is AccessControl {
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    using DataFeedClient for AggregatorV3Interface;

    uint8 internal constant USD_DECIMALS = 8;

    mapping(string => address) private _priceFeedAddress;

    address public _nativeTokenPriceFeedAddress;
    address public owner;

    constructor(address nativeTokenPriceFeedAddress) {
        _setupRole(OWNER_ROLE, msg.sender);
        owner = msg.sender;

        _nativeTokenPriceFeedAddress = nativeTokenPriceFeedAddress;
    }

    modifier onlyOwner() {
        require(
            hasRole(OWNER_ROLE, msg.sender),
            "PriceFeed: caller is not the owner"
        );
        _;
    }

    function setNativeTokenPriceFeedAddress(
        address nativeTokenPriceFeedAddress
    ) external onlyOwner {
        _nativeTokenPriceFeedAddress = nativeTokenPriceFeedAddress;
    }

    function transferOwner(address newOwner) public onlyOwner {
        _setupRole(OWNER_ROLE, newOwner);
        _revokeRole(OWNER_ROLE, msg.sender);
    }

    function setPriceFeedAddress(
        string memory symbol,
        address priceFeed
    ) external onlyOwner {
        _priceFeedAddress[symbol] = priceFeed;
    }

    function getPriceFeedAddress(
        string memory symbol
    ) public view returns (address) {
        require(
            _priceFeedAddress[symbol] != address(0),
            "PriceFeed: not supported token!"
        );
        return _priceFeedAddress[symbol];
    }

    function getTokenInfo(
        address tokenAddress
    ) public view returns (string memory, uint8) {
        ERC20 token = ERC20(tokenAddress);
        string memory symbol = token.symbol();
        uint8 decimals = token.decimals();
        return (symbol, decimals);
    }

    function convertTokenPriceToUsd(
        uint256 tokenAmount,
        address tokenAddress
    ) public view returns (uint256) {
        if (tokenAddress == address(0)) {
            (, uint256 nativeTokenAmountToUsdValue) = _convertTokenPriceToUsd(
                tokenAmount,
                _nativeTokenPriceFeedAddress,
                18
            );
            return nativeTokenAmountToUsdValue;
        }

        (string memory tokenSymbol, uint8 tokenDecimals) = getTokenInfo(
            tokenAddress
        );
        address priceFeedAddress = getPriceFeedAddress(tokenSymbol);
        (, uint256 tokenAmountToUsdValue) = _convertTokenPriceToUsd(
            tokenAmount,
            priceFeedAddress,
            tokenDecimals
        );
        return tokenAmountToUsdValue;
    }

    function convertUsdToTokenPrice(
        uint256 usdValue,
        address tokenAddress
    ) public view returns (uint256) {
        if (tokenAddress == address(0)) {
            (, uint256 usdValueToNativeToken) = _convertUsdToTokenPrice(
                usdValue,
                _nativeTokenPriceFeedAddress,
                18
            );
            return usdValueToNativeToken;
        }

        (string memory tokenSymbol, uint8 tokenDecimals) = getTokenInfo(
            tokenAddress
        );
        address priceFeedAddress = getPriceFeedAddress(tokenSymbol);
        (, uint256 usdValueToTokenAmount) = _convertUsdToTokenPrice(
            usdValue,
            priceFeedAddress,
            tokenDecimals
        );
        return usdValueToTokenAmount;
    }

    /**
     * Convert USD value to token amount
     * @param usdValue USD value
     * @param tokenPriceFeedAddress Chainlink price feed address
     * @param tokenDecimals Token decimals
     * @return tokenPrice Token price in USD
     * @return usdValueToTokenAmount USD value to token amount
     */
    function _convertUsdToTokenPrice(
        uint256 usdValue,
        address tokenPriceFeedAddress,
        uint8 tokenDecimals
    ) public view returns (uint256, uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            tokenPriceFeedAddress
        );

        uint256 tokenPrice = priceFeed.getData();
        uint256 usdValueToTokenAmount = (usdValue * 10 ** tokenDecimals) /
            tokenPrice;

        return (tokenPrice, usdValueToTokenAmount);
    }

    function _convertTokenPriceToUsd(
        uint256 tokenAmount,
        address tokenPriceFeedAddress,
        uint8 tokenDecimals
    ) public view returns (uint256, uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            tokenPriceFeedAddress
        );

        uint256 tokenPrice = priceFeed.getData();
        uint256 tokenAmountToUsdValue = (tokenAmount * tokenPrice) /
            10 ** tokenDecimals;

        return (tokenPrice, tokenAmountToUsdValue);
    }
}
