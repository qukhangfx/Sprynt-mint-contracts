// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

// solhint-disable not-rely-on-time
import "@openzeppelin/contracts/access/Ownable.sol";

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

contract ChainLinkPriceFeed {
    using DataFeedClient for AggregatorV3Interface;

    uint256 internal constant USD_LIMIT = 15000 * 10 ** 8;

    constructor() {}

    /**
     * Convert USD value to token amount
     * @param usdValue USD value
     * @param tokenPriceFeedAddress Chainlink price feed address
     * @return tokenPrice Token price in USD
     * @return usdValueToTokenAmount USD value to token amount
     */
    function convertUsdToTokenAmount(
        uint256 usdValue,
        address tokenPriceFeedAddress
    ) public view returns (uint256, uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            tokenPriceFeedAddress
        );

        uint256 tokenPrice = priceFeed.getData();
        uint256 usdValueToTokenAmount = (usdValue * 1 ether) / tokenPrice;

        return (tokenPrice, usdValueToTokenAmount);
    }

    /**
     * Convert token amount to USD value
     * @param tokenAmount Token amount
     * @param tokenPriceFeedAddress  Chainlink price feed address
     * @return tokenPrice Token price in USD
     * @return tokenAmountToUsdValue Token amount to USD value
     */
    function convertTokenAmountToUsd(
        uint256 tokenAmount,
        address tokenPriceFeedAddress
    ) public view returns (uint256, uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            tokenPriceFeedAddress
        );

        uint256 tokenPrice = priceFeed.getData();
        uint256 tokenAmountToUsdValue = (tokenAmount * tokenPrice) / 1 ether;

        return (tokenPrice, tokenAmountToUsdValue);
    }
}
