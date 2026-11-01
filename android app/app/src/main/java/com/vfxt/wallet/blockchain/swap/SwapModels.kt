package com.vfxt.wallet.blockchain.swap

import java.math.BigDecimal
import java.math.BigInteger
import java.math.MathContext

/** Address LI.FI uses for a chain's native coin (BNB, ETH, POL, AVAX…). */
const val NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000"

data class SwapToken(
    val chainId: Long,
    /** [NATIVE_TOKEN_ADDRESS] for the native coin. */
    val address: String,
    val symbol: String,
    val name: String,
    val decimals: Int,
    val priceUsd: BigDecimal? = null,
    /** True when LI.FI's security screening marked it verified, or it comes from the wallet's own list. */
    val verified: Boolean = true,
    /** Logo from the aggregator list; only shown if on a trusted host. */
    val listLogoUrl: String? = null,
) {
    /**
     * Aggregator logo when it's on a trusted host (CoinGecko), otherwise Trust Wallet artwork keyed by
     * contract address. Both are address-bound, so a look-alike token never inherits a real logo.
     */
    val logoUrl: String? get() =
        com.vfxt.wallet.core.common.TokenLogos.trusted(listLogoUrl)
            ?: com.vfxt.wallet.core.common.TokenLogos.token(chainId, address)

    val isNative: Boolean get() = address.equals(NATIVE_TOKEN_ADDRESS, ignoreCase = true)
    val key: String get() = "$chainId:${address.lowercase()}"
}

data class SwapFee(val name: String, val amountUsd: BigDecimal?, val percentage: BigDecimal?, val included: Boolean)

/** The transaction the aggregator wants signed. Validated by [SwapGuard] before use. */
data class SwapTxRequest(
    val chainId: Long,
    val to: String,
    val data: String,
    val value: BigInteger,
    val gasLimit: BigInteger?,
    val gasPrice: BigInteger?,
)

data class SwapQuote(
    val id: String,
    val tool: String,
    val toolName: String,
    val fromToken: SwapToken,
    val toToken: SwapToken,
    val fromAmount: BigInteger,
    val toAmount: BigInteger,
    val toAmountMin: BigInteger,
    val slippage: BigDecimal,
    val approvalAddress: String?,
    val executionDurationSeconds: Int,
    val fromAmountUsd: BigDecimal?,
    val toAmountUsd: BigDecimal?,
    val gasCostUsd: BigDecimal?,
    val fees: List<SwapFee>,
    val tx: SwapTxRequest,
    val fetchedAtMillis: Long = System.currentTimeMillis(),
) {
    val isCrossChain: Boolean get() = fromToken.chainId != toToken.chainId

    val fromAmountDecimal: BigDecimal get() = BigDecimal(fromAmount).movePointLeft(fromToken.decimals)
    val toAmountDecimal: BigDecimal get() = BigDecimal(toAmount).movePointLeft(toToken.decimals)
    val toAmountMinDecimal: BigDecimal get() = BigDecimal(toAmountMin).movePointLeft(toToken.decimals)

    /** 1 [fromToken] = rate [toToken]. */
    val rate: BigDecimal? get() =
        if (fromAmount.signum() == 0) null else toAmountDecimal.divide(fromAmountDecimal, MathContext.DECIMAL64)

    /**
     * Value lost between what is paid and what is received, in percent, including provider fees
     * and pool price impact. Null when either USD value is unknown (then the UI warns instead).
     */
    val valueLossPercent: BigDecimal? get() {
        val from = fromAmountUsd ?: return null
        val to = toAmountUsd ?: return null
        if (from.signum() <= 0) return null
        return (from - to).divide(from, MathContext.DECIMAL64).multiply(BigDecimal(100))
    }

    /** Native coin sent beyond the swap amount itself (cross-chain bridge fee), in base units. */
    val extraNativeValue: BigInteger get() =
        (tx.value - (if (fromToken.isNative) fromAmount else BigInteger.ZERO)).max(BigInteger.ZERO)

    val providerFeeUsd: BigDecimal? get() =
        fees.mapNotNull { it.amountUsd }.takeIf { it.isNotEmpty() }?.fold(BigDecimal.ZERO, BigDecimal::add)
}

/**
 * Indicative price for display while the user types. Contains no transaction and is never signed;
 * it works even when the wallet can't afford the swap yet.
 */
data class SwapEstimate(
    val toAmount: BigInteger,
    val toAmountMin: BigInteger,
    val toDecimals: Int,
    val fromAmountUsd: BigDecimal?,
    val toAmountUsd: BigDecimal?,
    val gasCostUsd: BigDecimal?,
    val toolName: String,
    val executionDurationSeconds: Int,
) {
    val toAmountDecimal: BigDecimal get() = BigDecimal(toAmount).movePointLeft(toDecimals)
    val toAmountMinDecimal: BigDecimal get() = BigDecimal(toAmountMin).movePointLeft(toDecimals)

    val valueLossPercent: BigDecimal? get() {
        val from = fromAmountUsd ?: return null
        val to = toAmountUsd ?: return null
        if (from.signum() <= 0) return null
        return (from - to).divide(from, MathContext.DECIMAL64).multiply(BigDecimal(100))
    }
}

enum class CrossChainStatus { Pending, Done, Failed, NotFound }

data class SwapStatus(
    val status: CrossChainStatus,
    val substatusMessage: String?,
    val receivingTxHash: String?,
)

class SwapException(message: String) : Exception(message)
