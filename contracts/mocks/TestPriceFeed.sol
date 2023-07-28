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

contract StaticDataFeed is AggregatorV3Interface, Ownable {
  int256 internal answer;
  int256 internal diff;

  constructor(int256 _answer, int256 _diff) {
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