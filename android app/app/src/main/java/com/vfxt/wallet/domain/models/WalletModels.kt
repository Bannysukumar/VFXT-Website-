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
)

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
)

data class WalletOverview(
    val account: WalletAccount?,
    val holdings: List<Holding>,
    val activity: List<ActivityItem>,
    val totalFiatValue: BigDecimal?,
    val change24hPercent: BigDecimal?,
    val fiatCurrency: String = "USD",
)
