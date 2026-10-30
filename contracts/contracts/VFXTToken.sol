// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title VFXTToken
 * @notice Virtual FX Trades (VFXT) — standard ERC-20 token.
 *
 * ## Minting policy (fixed supply)
 * The entire `initialSupply` is minted **once** in the constructor to `treasury`.
 * There is **no** public mint, owner mint, or AccessControl mint role.
 * Total supply is immutable after deployment; further issuance requires a new token.
 *
 * Off-chain trading / FX logic lives in Firebase (or other app backends), not in this contract.
 */
contract VFXTToken is ERC20 {
    /// @param initialSupply Total token amount (wei units, 18 decimals) minted to `treasury`.
    /// @param treasury Address that receives the fixed initial supply. Must be non-zero.
    constructor(uint256 initialSupply, address treasury) ERC20("Virtual FX Trades", "VFXT") {
        require(treasury != address(0), "VFXT: treasury is zero address");
        _mint(treasury, initialSupply);
    }
}
