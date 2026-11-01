// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VFXTSwap
 * @notice Fixed-price VFXT <-> USDT swap desk, funded and priced by the admin.
 *
 * Users:
 *  - `buy`:  pay USDT, receive VFXT at `buyPrice`.
 *  - `sell`: pay VFXT, receive USDT at `sellPrice`.
 *  Both take a minimum-output and a deadline, so a price change or delay between quoting and
 *  mining can never fill a user worse than they agreed to.
 *
 * Admin (owner, from the admin panel):
 *  - set / update buy and sell prices (or let a separate `priceManager` wallet do it),
 *  - deposit VFXT and USDT liquidity into the contract,
 *  - withdraw VFXT, USDT (or any token sent here by mistake) to any address, including itself,
 *  - pause / unpause trading. Withdrawals keep working while paused.
 *
 * Prices are USDT per 1 whole VFXT, scaled by 1e18 (`PRICE_PRECISION`).
 * Example: 0.002 USDT per VFXT => price = 0.002e18 = 2e15.
 * A price of 0 disables that side (buying or selling).
 * `sellPrice` may not exceed `buyPrice`, so nobody can profit by buying and immediately selling back.
 *
 * Ownership uses a two-step transfer so the admin role can't be handed to a mistyped address.
 */
contract VFXTSwap is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant PRICE_PRECISION = 1e18;

    IERC20 public immutable vfxt;
    IERC20 public immutable usdt;

    /// @dev 10**decimals of each token, read once at deployment.
    uint256 private immutable vfxtUnit;
    uint256 private immutable usdtUnit;

    /// @notice USDT (scaled 1e18) a user pays per 1 VFXT when buying. 0 = buying disabled.
    uint256 public buyPrice;
    /// @notice USDT (scaled 1e18) a user receives per 1 VFXT when selling. 0 = selling disabled.
    uint256 public sellPrice;

    /// @notice Optional extra wallet allowed to update prices only (e.g. a backend bot). Can't move funds.
    address public priceManager;

    /// @notice Per-transaction limits in token base units. 0 = no limit.
    uint256 public minUsdtPerTrade;
    uint256 public maxUsdtPerTrade;

    event Bought(address indexed user, uint256 usdtIn, uint256 vfxtOut, uint256 price);
    event Sold(address indexed user, uint256 vfxtIn, uint256 usdtOut, uint256 price);
    event PricesUpdated(uint256 oldBuyPrice, uint256 oldSellPrice, uint256 newBuyPrice, uint256 newSellPrice, address indexed by);
    event PriceManagerUpdated(address indexed oldManager, address indexed newManager);
    event TradeLimitsUpdated(uint256 minUsdt, uint256 maxUsdt);
    event Deposited(address indexed token, address indexed from, uint256 amount);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error SameToken();
    error InvalidPrices();
    error InvalidLimits();
    error TradingDisabled();
    error Expired();
    error Slippage(uint256 amountOut, uint256 minAmountOut);
    error InsufficientLiquidity(uint256 available, uint256 required);
    error TradeTooSmall(uint256 usdtValue, uint256 minUsdt);
    error TradeTooLarge(uint256 usdtValue, uint256 maxUsdt);
    error NotPriceAdmin();
    error UnsupportedToken();

    modifier onlyPriceAdmin() {
        if (msg.sender != owner() && msg.sender != priceManager) revert NotPriceAdmin();
        _;
    }

    /**
     * @param vfxt_ VFXT token (BSC: 0x4A08EF10e6f4aa077A74496793467d2192061969).
     * @param usdt_ USDT token (BSC: 0x55d398326f99059fF775485246999027B3197955, 18 decimals).
     * @param admin Owner / admin wallet.
     * @param buyPrice_ Initial buy price (USDT per VFXT, 1e18-scaled). May be 0.
     * @param sellPrice_ Initial sell price (USDT per VFXT, 1e18-scaled). May be 0; must be <= buyPrice_.
     */
    constructor(address vfxt_, address usdt_, address admin, uint256 buyPrice_, uint256 sellPrice_)
        Ownable(admin)
    {
        if (vfxt_ == address(0) || usdt_ == address(0)) revert ZeroAddress();
        if (vfxt_ == usdt_) revert SameToken();
        vfxt = IERC20(vfxt_);
        usdt = IERC20(usdt_);
        vfxtUnit = 10 ** IERC20Metadata(vfxt_).decimals();
        usdtUnit = 10 ** IERC20Metadata(usdt_).decimals();
        _setPrices(buyPrice_, sellPrice_);
    }

    // ---------------------------------------------------------------------------------------
    // User swaps
    // ---------------------------------------------------------------------------------------

    /// @notice Buys VFXT with `usdtIn` USDT. Caller must approve this contract for `usdtIn` USDT first.
    function buy(uint256 usdtIn, uint256 minVfxtOut, uint256 deadline)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 vfxtOut)
    {
        if (block.timestamp > deadline) revert Expired();
        uint256 price = buyPrice;
        if (price == 0) revert TradingDisabled();
        if (usdtIn == 0) revert ZeroAmount();
        _checkLimits(usdtIn);

        // Measure what actually arrived, so a fee-on-transfer token can't over-credit the user.
        uint256 received = _pull(usdt, msg.sender, usdtIn);
        vfxtOut = _usdtToVfxt(received, price);
        if (vfxtOut == 0) revert ZeroAmount();
        if (vfxtOut < minVfxtOut) revert Slippage(vfxtOut, minVfxtOut);

        uint256 available = vfxt.balanceOf(address(this));
        if (available < vfxtOut) revert InsufficientLiquidity(available, vfxtOut);

        vfxt.safeTransfer(msg.sender, vfxtOut);
        emit Bought(msg.sender, received, vfxtOut, price);
    }

    /// @notice Sells `vfxtIn` VFXT for USDT. Caller must approve this contract for `vfxtIn` VFXT first.
    function sell(uint256 vfxtIn, uint256 minUsdtOut, uint256 deadline)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 usdtOut)
    {
        if (block.timestamp > deadline) revert Expired();
        uint256 price = sellPrice;
        if (price == 0) revert TradingDisabled();
        if (vfxtIn == 0) revert ZeroAmount();

        uint256 received = _pull(vfxt, msg.sender, vfxtIn);
        usdtOut = _vfxtToUsdt(received, price);
        if (usdtOut == 0) revert ZeroAmount();
        _checkLimits(usdtOut);
        if (usdtOut < minUsdtOut) revert Slippage(usdtOut, minUsdtOut);

        uint256 available = usdt.balanceOf(address(this));
        if (available < usdtOut) revert InsufficientLiquidity(available, usdtOut);

        usdt.safeTransfer(msg.sender, usdtOut);
        emit Sold(msg.sender, received, usdtOut, price);
    }

    // ---------------------------------------------------------------------------------------
    // Views (for the app and admin panel)
    // ---------------------------------------------------------------------------------------

    /// @notice VFXT received for `usdtIn` USDT at the current buy price (0 if buying is disabled).
    function quoteBuy(uint256 usdtIn) external view returns (uint256) {
        return buyPrice == 0 ? 0 : _usdtToVfxt(usdtIn, buyPrice);
    }

    /// @notice USDT received for `vfxtIn` VFXT at the current sell price (0 if selling is disabled).
    function quoteSell(uint256 vfxtIn) external view returns (uint256) {
        return sellPrice == 0 ? 0 : _vfxtToUsdt(vfxtIn, sellPrice);
    }

    /// @notice Liquidity currently held by the contract.
    function reserves() external view returns (uint256 vfxtBalance, uint256 usdtBalance) {
        return (vfxt.balanceOf(address(this)), usdt.balanceOf(address(this)));
    }

    // ---------------------------------------------------------------------------------------
    // Admin: prices
    // ---------------------------------------------------------------------------------------

    /// @notice Sets both prices (USDT per VFXT, 1e18-scaled). 0 disables a side. sell must be <= buy.
    function setPrices(uint256 newBuyPrice, uint256 newSellPrice) external onlyPriceAdmin {
        _setPrices(newBuyPrice, newSellPrice);
    }

    function setPriceManager(address newManager) external onlyOwner {
        emit PriceManagerUpdated(priceManager, newManager);
        priceManager = newManager;
    }

    /// @notice Per-trade USDT-value limits in USDT base units. 0 = no limit.
    function setTradeLimits(uint256 minUsdt, uint256 maxUsdt) external onlyOwner {
        if (maxUsdt != 0 && minUsdt > maxUsdt) revert InvalidLimits();
        minUsdtPerTrade = minUsdt;
        maxUsdtPerTrade = maxUsdt;
        emit TradeLimitsUpdated(minUsdt, maxUsdt);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------------------------------
    // Admin: liquidity
    // ---------------------------------------------------------------------------------------

    /// @notice Deposits VFXT or USDT liquidity from the admin wallet (approve the amount first).
    function deposit(address token, uint256 amount) external onlyOwner nonReentrant {
        if (token != address(vfxt) && token != address(usdt)) revert UnsupportedToken();
        if (amount == 0) revert ZeroAmount();
        uint256 received = _pull(IERC20(token), msg.sender, amount);
        emit Deposited(token, msg.sender, received);
    }

    /**
     * @notice Withdraws `amount` of `token` to `to` — the admin's own wallet or any other address.
     * Works for VFXT, USDT, or any other ERC-20 sent here by mistake. Allowed while paused.
     */
    function withdraw(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, to, amount);
    }

    /// @notice Withdraws this contract's whole balance of `token` to `to`.
    function withdrawAll(address token, address to) external onlyOwner nonReentrant {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        uint256 amount = IERC20(token).balanceOf(address(this));
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, to, amount);
    }

    /// @notice The admin role can't be renounced: that would lock all liquidity in the contract.
    function renounceOwnership() public view override onlyOwner {
        revert("VFXTSwap: renounce disabled");
    }

    // ---------------------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------------------

    function _setPrices(uint256 newBuyPrice, uint256 newSellPrice) private {
        // A sell price above the buy price would let anyone drain USDT by round-tripping.
        if (newBuyPrice != 0 && newSellPrice > newBuyPrice) revert InvalidPrices();
        // Selling only with buying disabled is allowed (buyPrice 0), e.g. a buy-back program.
        emit PricesUpdated(buyPrice, sellPrice, newBuyPrice, newSellPrice, msg.sender);
        buyPrice = newBuyPrice;
        sellPrice = newSellPrice;
    }

    function _checkLimits(uint256 usdtValue) private view {
        uint256 minU = minUsdtPerTrade;
        uint256 maxU = maxUsdtPerTrade;
        if (minU != 0 && usdtValue < minU) revert TradeTooSmall(usdtValue, minU);
        if (maxU != 0 && usdtValue > maxU) revert TradeTooLarge(usdtValue, maxU);
    }

    /// @dev Rounds down, in the contract's favour.
    function _usdtToVfxt(uint256 usdtAmount, uint256 price) private view returns (uint256) {
        return (usdtAmount * PRICE_PRECISION * vfxtUnit) / (price * usdtUnit);
    }

    /// @dev Rounds down, in the contract's favour.
    function _vfxtToUsdt(uint256 vfxtAmount, uint256 price) private view returns (uint256) {
        return (vfxtAmount * price * usdtUnit) / (PRICE_PRECISION * vfxtUnit);
    }

    function _pull(IERC20 token, address from, uint256 amount) private returns (uint256 received) {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        received = token.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();
    }
}
