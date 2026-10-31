package com.vfxt.wallet.data.remote

import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import com.vfxt.wallet.domain.models.ActiveMiningBooster
import com.vfxt.wallet.domain.models.BoosterPurchaseOrder
import com.vfxt.wallet.domain.models.MiningBooster
import com.vfxt.wallet.domain.models.MiningConfig
import com.vfxt.wallet.domain.models.MiningHistoryItem
import com.vfxt.wallet.domain.models.MiningOverview
import com.vfxt.wallet.domain.models.MiningSession
import com.vfxt.wallet.domain.models.MiningStatus
import com.vfxt.wallet.domain.models.RewardSummary
import kotlinx.coroutines.tasks.await
import java.math.BigDecimal
import javax.inject.Inject
import javax.inject.Singleton

class MiningApiException(message: String) : Exception(message)

@Singleton
class MiningApi @Inject constructor(
    private val functions: FirebaseFunctions,
) {
    suspend fun status(): MiningOverview {
        val data = call("miningStatus")
        return parseOverview(data)
    }

    suspend fun start() {
        call("miningStart")
    }

    suspend fun stop() {
        call("miningStop")
    }

    suspend fun history(): List<MiningHistoryItem> {
        val data = call("miningHistory")
        val items = data["items"] as? List<*> ?: emptyList<Any>()
        return items.mapNotNull { raw ->
            val m = raw as? Map<*, *> ?: return@mapNotNull null
            MiningHistoryItem(
                sessionId = m.str("sessionId") ?: return@mapNotNull null,
                startTimeMillis = m.long("startTimeMillis") ?: 0L,
                endTimeMillis = m.long("endTimeMillis"),
                reward = m.decimal("reward"),
                claimed = m["claimed"] as? Boolean ?: false,
            )
        }
    }

    suspend fun claim(destinationAddress: String?, idempotencyKey: String): Map<*, *> {
        val payload = mutableMapOf<String, Any>("idempotencyKey" to idempotencyKey)
        if (!destinationAddress.isNullOrBlank()) payload["destinationAddress"] = destinationAddress
        return call("rewardsClaim", payload)
    }

    suspend fun listBoosters(): List<MiningBooster> {
        val data = call("listMiningBoosters")
        val items = data["items"] as? List<*> ?: emptyList<Any>()
        return items.mapNotNull { raw ->
            val m = raw as? Map<*, *> ?: return@mapNotNull null
            if (m["enabled"] == false) return@mapNotNull null
            MiningBooster(
                boosterId = m.str("boosterId") ?: return@mapNotNull null,
                name = m.str("name") ?: return@mapNotNull null,
                description = m.str("description").orEmpty(),
                bonusRatePerHour = m.decimal("bonusRatePerHour") ?: BigDecimal.ZERO,
                durationSeconds = m.long("durationSeconds") ?: 0L,
                priceUsdt = m.str("priceUsdt") ?: return@mapNotNull null,
            )
        }
    }

    suspend fun purchaseBooster(boosterId: String): BoosterPurchaseOrder {
        val data = call("purchaseMiningBooster", mapOf("boosterId" to boosterId))
        return BoosterPurchaseOrder(
            purchaseId = data.str("purchaseId") ?: throw MiningApiException("Missing purchaseId"),
            boosterName = data.str("boosterName").orEmpty(),
            priceUsdt = data.str("priceUsdt") ?: throw MiningApiException("Missing price"),
            expectedUsdtWei = data.str("expectedUsdtWei") ?: throw MiningApiException("Missing amount"),
            paymentWallet = data.str("paymentWallet") ?: throw MiningApiException("Missing payment wallet"),
            paymentToken = data.str("paymentToken") ?: "USDT_BEP20",
            expiresAtMillis = data.long("expiresAtMillis") ?: 0L,
        )
    }

    suspend fun confirmBoosterPayment(purchaseId: String, txHash: String?): Map<*, *> {
        val payload = mutableMapOf<String, Any>("purchaseId" to purchaseId)
        if (!txHash.isNullOrBlank()) payload["txHash"] = txHash
        return call("confirmMiningBoosterPayment", payload)
    }

    private fun parseOverview(data: Map<*, *>): MiningOverview {
        val configMap = data["config"] as? Map<*, *>
        val rewardsMap = data["rewards"] as? Map<*, *>
        val sessionMap = data["session"] as? Map<*, *>
        val boostersRaw = data["boosters"] as? List<*> ?: emptyList<Any>()

        val config = if (configMap != null) {
            MiningConfig(
                enabled = configMap["enabled"] as? Boolean ?: false,
                ratePerHour = configMap.decimal("ratePerHour") ?: BigDecimal.ZERO,
                durationSeconds = configMap.long("durationSeconds") ?: 0L,
                minimumClaim = configMap.decimal("minimumClaim") ?: BigDecimal.ZERO,
                allowStop = configMap["allowStop"] as? Boolean ?: false,
            )
        } else {
            null
        }

        val rewards = if (rewardsMap != null) {
            RewardSummary(
                available = rewardsMap.decimal("available") ?: BigDecimal.ZERO,
                lifetime = rewardsMap.decimal("lifetime") ?: BigDecimal.ZERO,
                claimed = rewardsMap.decimal("claimed") ?: BigDecimal.ZERO,
            )
        } else {
            null
        }

        val activeBoosters = boostersRaw.mapNotNull { raw ->
            val m = raw as? Map<*, *> ?: return@mapNotNull null
            ActiveMiningBooster(
                userBoosterId = m.str("userBoosterId") ?: return@mapNotNull null,
                boosterName = m.str("boosterName").orEmpty(),
                bonusRatePerHour = m.decimal("bonusRatePerHour") ?: BigDecimal.ZERO,
                expiresAtMillis = m.long("expiresAtMillis") ?: 0L,
            )
        }

        val status: MiningStatus = when {
            config == null -> MiningStatus.ServiceUnavailable("Mining configuration unavailable.")
            !config.enabled -> MiningStatus.Disabled(config)
            sessionMap != null -> MiningStatus.Active(
                config = config,
                session = MiningSession(
                    sessionId = sessionMap.str("sessionId") ?: "",
                    startTimeMillis = sessionMap.long("startTimeMillis") ?: 0L,
                    endTimeMillis = sessionMap.long("endTimeMillis") ?: 0L,
                    rateSnapshotPerHour = sessionMap.decimal("rateSnapshotPerHour") ?: config.ratePerHour,
                ),
            )
            else -> MiningStatus.Idle(config)
        }

        return MiningOverview(
            status = status,
            rewards = rewards,
            history = emptyList(),
            activeBoosters = activeBoosters,
            effectiveRatePerHour = configMap?.decimal("effectiveRatePerHour"),
        )
    }

    private suspend fun call(name: String, data: Map<String, Any?> = emptyMap()): Map<*, *> {
        try {
            val result = functions.getHttpsCallable(name).call(data).await()
            @Suppress("UNCHECKED_CAST")
            return (result.data as? Map<*, *>) ?: emptyMap<Any, Any>()
        } catch (e: FirebaseFunctionsException) {
            throw MiningApiException(e.message ?: "Mining request failed (${e.code})")
        }
    }

    private fun Map<*, *>.str(key: String): String? = this[key]?.toString()
    private fun Map<*, *>.long(key: String): Long? = when (val v = this[key]) {
        is Number -> v.toLong()
        is String -> v.toLongOrNull()
        else -> null
    }
    private fun Map<*, *>.decimal(key: String): BigDecimal? = this[key]?.toString()?.let {
        runCatching { BigDecimal(it) }.getOrNull()
    }
}
