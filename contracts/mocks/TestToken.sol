// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    event MintedToken(address indexed to, uint256 amount);

    uint8 public _decimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _ddecimals
    ) ERC20(_name, _symbol) {
        _decimals = _ddecimals;
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function setupDecimals(uint8 _ddecimals) public {
        _decimals = _ddecimals;
    }

    function mint(address _to, uint256 _amount) public {
        require(_amount > 0, "amount is 0");
        _mint(_to, _amount);
        
        emit MintedToken(_to, _amount);
    }
}