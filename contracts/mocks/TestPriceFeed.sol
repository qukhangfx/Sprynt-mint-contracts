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

  function getData(AggregatorV3Interface dataFeed)
    internal
    view
    returns (uint256)
  {
    (, int256 answer, , uint256 updatedAt, ) = dataFeed.latestRoundData();
    uint256 value = uint256(answer);

    require(answer >= MIN_VALUE, "DF: value too low");
    require(answer <= MAX_VALUE, "DF: value too high");
    require(updatedAt <= block.timestamp, "DF: future timestamp");
    require(updatedAt >= block.timestamp - MAX_DELAY, "DF: timestamp too old");

    return value;
  }
}

contract StaticDataFeed is AggregatorV3Interface, Ownable {
  int256 internal answer;
  int256 internal diff;

  constructor(int256 _answer, int256 _diff) {
    answer = _answer;
    diff = _diff;
  }

  function setValues(int256 _answer, int256 _diff) external onlyOwner {
    answer = _answer;
    diff = _diff;
  }

  function latestRoundData()
    external
    view
    override
    returns (
      uint80,
      int256,
      uint256,
      uint256,
      uint80
    )
  {
    uint256 updatedAt = uint256(int256(block.timestamp) + diff);
    return (0, answer, 0, updatedAt, 0);
  }
}

contract TestDataFeedClient {
  using DataFeedClient for AggregatorV3Interface;

  function getData(AggregatorV3Interface dataFeed)
    external
    view
    returns (uint256)
  {
    return dataFeed.getData();
  }
}