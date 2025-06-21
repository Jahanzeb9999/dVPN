// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract dVPNToken is ERC20, Ownable {
    uint256 public constant INITIAL_SUPPLY = 10000000 * 10**18; // 10 million tokens
    uint256 public constant REWARD_SUPPLY = 5000000 * 10**18; // 5 million for rewards

    constructor() ERC20("dVPN Token", "DVPN") Ownable(msg.sender) {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    function mintRewards(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= INITIAL_SUPPLY + REWARD_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}