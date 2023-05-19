// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SimplePay is AccessControl {
    uint256 private _maxAcceptedValue;
    bool private _forwarded;
    address private _tokenAddress;
    address private _owner;
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    using SafeERC20 for IERC20;

    constructor(
        uint256 maxAcceptedValue,
        bool forwarded,
        address tokenAddress
    ) {
        _grantRole(OWNER_ROLE, tx.origin);
        _owner = tx.origin;
        _maxAcceptedValue = maxAcceptedValue;
        _forwarded = forwarded;
        _tokenAddress = tokenAddress;
    }

    function updateMaxAcceptedValue(
        uint256 maxAcceptedValue
    ) external onlyRole(OWNER_ROLE) {
        _maxAcceptedValue = maxAcceptedValue;
    }

    function updateForwarded(bool forwarded) external onlyRole(OWNER_ROLE) {
        _forwarded = forwarded;
    }

    function depositByClient(bool isNativeToken, uint256 value) public payable {
        require(value <= _maxAcceptedValue, "Value too high");
        if (isNativeToken) {
            if (_forwarded) {
                Address.sendValue(_owner, value);
            } else {
                Address.sendValue(address(this), value)
            }
        } else {
            IERC20(_tokenAddress).safeTransferFrom(tx.origin, _owner, value);
        }
    }
}
