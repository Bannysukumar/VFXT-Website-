package com.vfxt.wallet.domain.models

import java.math.BigDecimal

/** Admin-controlled mining configuration, read from the backend. */
data class MiningConfig(
    val enabled: Boolean,
    val ratePerHour: BigDecimal,
    val durationSeconds: Long,
    val minimumClaim: BigDecimal,
    val allowStop: Boolean,
)

/** A session as recorded by the server. Timestamps are server-authoritative. */
data class MiningSession(
    val sessionId: String,
    val startTimeMillis: Long,
    val endTimeMillis: Long,
    val rateSnapshotPerHour: BigDecimal,
)

data class RewardSummary(
    val available: BigDecimal,
    val lifetime: BigDecimal,
    val claimed: BigDecimal,
)

sealed interface MiningStatus {
    /** The mining backend is not reachable or not configured. */
    data class ServiceUnavailable(val reason: String) : MiningStatus
    data class Disabled(val config: MiningConfig) : MiningStatus
    data class Idle(val config: MiningConfig) : MiningStatus
    data class Active(val config: MiningConfig, val session: MiningSession) : MiningStatus
}

data class MiningHistoryItem(
    val sessionId: String,
    val startTimeMillis: Long,
    val endTimeMillis: Long?,
    val reward: BigDecimal?,
    val claimed: Boolean,
)

data class MiningOverview(
    val status: MiningStatus,
    val rewards: RewardSummary?,
    val history: List<MiningHistoryItem>,
    val activeBoosters: List<ActiveMiningBooster> = emptyList(),
    val effectiveRatePerHour: BigDecimal? = null,
)

/** Catalog item from admin — paid with USDT BEP-20. */
data class MiningBooster(
    val boosterId: String,
    val name: String,
    val description: String,
    val bonusRatePerHour: BigDecimal,
    val durationSeconds: Long,
    val priceUsdt: String,
)

/**
 * Exact payment instructions for one purchase.
 * Payment is signed and sent only from the in-app VFXT Wallet (USDT BEP-20).
 */
data class BoosterPurchaseOrder(
    val purchaseId: String,
    val boosterName: String,
    val priceUsdt: String,
    val expectedUsdtWei: String,
    val paymentWallet: String,
    val paymentToken: String,
    val expiresAtMillis: Long,
)

data class ActiveMiningBooster(
    val userBoosterId: String,
    val boosterName: String,
    val bonusRatePerHour: BigDecimal,
    val expiresAtMillis: Long,
)
