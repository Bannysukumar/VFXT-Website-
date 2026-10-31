package com.vfxt.wallet.domain.models

import java.math.BigDecimal
import java.math.BigInteger

enum class TokenKind { Native, Bep20 }

data class TokenInfo(
    val symbol: String,
    val name: String,
    val decimals: Int,
    val networkId: String,
    val kind: TokenKind,
    /** Null for native coins, and for BEP-20 tokens whose contract is not configured yet. */
    val contractAddress: String?,
    /** CoinGecko id when a reliable market price exists; null means "no price", never zero. */
    val priceId: String? = null,
    val isCustom: Boolean = false,
) {
    /**
     * Stable key unique per network: lower-cased contract address, "native" for the network coin,
     * or "pending:SYMBOL" for a built-in token whose contract isn't configured yet.
     */
    val key: String get() = contractAddress?.lowercase() ?: if (kind == TokenKind.Native) "native" else "pending:${symbol.lowercase()}"

    /** A BEP-20 entry without a configured contract can't be queried or sent. */
    val isAvailable: Boolean get() = kind == TokenKind.Native || contractAddress != null
}

data class WalletAccount(
    val id: String,
    val name: String,
    /** EIP-55 checksummed public address. Never a secret. */
    val address: String,
)

/**
 * A token position. Every market/balance field is nullable: null means "unknown", which the
 * UI renders as unavailable instead of showing a made-up zero.
 */
data class Holding(
    val token: TokenInfo,
    /** Balance in the token's smallest unit (wei-style integer). */
    val rawBalance: BigInteger?,
    val fiatValue: BigDecimal?,
    val change24hPercent: BigDecimal?,
    val unitPrice: BigDecimal? = null,
)

enum class ActivityType { Received, Sent, MiningReward, Claim }

enum class ActivityStatus { Pending, Confirmed, Failed }

data class ActivityItem(
    val id: String,
    val type: ActivityType,
    val tokenSymbol: String,
    /** Human-readable amount already scaled by token decimals. */
    val amount: BigDecimal,
    val status: ActivityStatus,
    val timestampMillis: Long,
    /** Only present for real on-chain transactions. */
    val txHash: String?,
    val counterparty: String? = null,
    val networkId: String? = null,
    val fee: BigDecimal? = null,
)

data class WalletOverview(
    val account: WalletAccount?,
    val holdings: List<Holding>,
    val activity: List<ActivityItem>,
    val totalFiatValue: BigDecimal?,
    val change24hPercent: BigDecimal?,
    val fiatCurrency: String = "USD",
    /** Set when balances couldn't be refreshed (offline, RPC down); UI shows a banner. */
    val syncError: String? = null,
)
