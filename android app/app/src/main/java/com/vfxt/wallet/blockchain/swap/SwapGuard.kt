package com.vfxt.wallet.blockchain.swap

import java.math.BigDecimal

/**
 * Independent safety checks on aggregator output. The wallet never signs a swap just because an
 * API returned it: the target contract, chain, value and slippage must all match what the user
 * asked for.
 */
object SwapGuard {

    /**
     * LI.FI Diamond router. Verified to be the same deployed contract (identical 5,176-byte proxy)
     * on BSC, Ethereum, Polygon, Arbitrum, Optimism, Base and Avalanche. Any quote targeting a
     * different contract, or asking to approve a different spender, is rejected.
     */
    val TRUSTED_ROUTERS: Set<String> = setOf("0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae")

    /** Highest slippage the UI allows the user to choose. */
    val MAX_SLIPPAGE: BigDecimal = BigDecimal("0.05")

    /** Above this loss (fees + price impact) the user must explicitly acknowledge the risk. */
    val HIGH_IMPACT_PERCENT: BigDecimal = BigDecimal("5")

    /** Above this loss the swap is refused outright: it is almost certainly a bad pool or bad price. */
    val BLOCK_IMPACT_PERCENT: BigDecimal = BigDecimal("30")

    fun isTrustedRouter(address: String?): Boolean = address != null && address.lowercase() in TRUSTED_ROUTERS

    /** Throws [SwapException] when [quote] does not match the user's request. */
    fun validate(
        quote: SwapQuote,
        expectedFromChainId: Long,
        expectedFromToken: String,
        expectedToToken: String,
        expectedToChainId: Long,
        expectedAmount: java.math.BigInteger,
    ) {
        if (quote.tx.chainId != expectedFromChainId) fail("Quote is for the wrong network.")
        if (!isTrustedRouter(quote.tx.to)) fail("Quote targets an unrecognized contract. Swap blocked for your safety.")
        if (!quote.fromToken.address.equals(expectedFromToken, ignoreCase = true)) fail("Quote is for a different token.")
        if (!quote.toToken.address.equals(expectedToToken, ignoreCase = true) || quote.toToken.chainId != expectedToChainId) {
            fail("Quote returns a different token than requested.")
        }
        if (quote.fromAmount != expectedAmount) fail("Quote amount doesn't match what you entered.")
        if (quote.toAmountMin.signum() <= 0 || quote.toAmountMin > quote.toAmount) fail("Quote has an invalid minimum received.")
        if (quote.slippage > MAX_SLIPPAGE) fail("Quote slippage is higher than allowed.")
        if (quote.tx.data.length < 10 || !quote.tx.data.startsWith("0x")) fail("Quote has no transaction data.")

        // Same-chain: value must be exactly the native amount (or zero for token swaps).
        // Cross-chain: some bridges add a native bridge fee on top; that extra is allowed but is
        // surfaced to the user as [SwapQuote.extraNativeValue] on the review screen.
        val baseValue = if (quote.fromToken.isNative) quote.fromAmount else java.math.BigInteger.ZERO
        if (quote.tx.value < baseValue) fail("Quote sends an unexpected amount.")
        if (!quote.isCrossChain && quote.tx.value != baseValue) fail("Quote sends an unexpected amount.")

        if (!quote.fromToken.isNative) {
            val spender = quote.approvalAddress ?: fail("Quote is missing the approval address.")
            if (!isTrustedRouter(spender)) fail("Quote asks to approve an unrecognized contract. Swap blocked.")
        }
        quote.valueLossPercent?.let { if (it > BLOCK_IMPACT_PERCENT) fail("This swap would lose over ${BLOCK_IMPACT_PERCENT.toPlainString()}% of its value. Blocked.") }
    }

    /**
     * A re-fetched quote must be at least as good as the one the user reviewed (within one basis
     * point of rounding), otherwise the user must review again.
     */
    fun isStillAcceptable(reviewed: SwapQuote, fresh: SwapQuote): Boolean =
        fresh.toAmountMin * java.math.BigInteger.valueOf(10_000) >= reviewed.toAmountMin * java.math.BigInteger.valueOf(9_999)

    private fun fail(message: String): Nothing = throw SwapException(message)
}
