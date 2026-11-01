package com.vfxt.wallet.data.remote

import com.vfxt.wallet.core.common.FiatCurrency
import com.vfxt.wallet.core.common.FiatDisplay
import com.vfxt.wallet.data.local.AppPreferences
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import java.math.BigDecimal
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Keeps [FiatDisplay] in sync with the user's chosen currency and a daily USD exchange rate
 * from open.er-api.com (free, no key). The last rates are persisted so conversion works offline.
 */
@Singleton
class CurrencyService @Inject constructor(
    private val http: OkHttpClient,
    private val preferences: AppPreferences,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val json = Json { ignoreUnknownKeys = true }
    @Volatile private var rates: Map<String, BigDecimal> = emptyMap()
    @Volatile private var ratesAt: Long = 0

    fun start() {
        scope.launch {
            preferences.cachedRates.first()?.let { (at, raw) ->
                rates = parseRates(raw)
                ratesAt = at
            }
            preferences.currency.collect { currency ->
                FiatDisplay.update(currency, rates[currency.code])
                if (currency != FiatCurrency.USD) refreshIfStale()
            }
        }
    }

    suspend fun select(currency: FiatCurrency) {
        preferences.setCurrency(currency)
        if (currency != FiatCurrency.USD) refreshIfStale()
    }

    private suspend fun refreshIfStale() {
        if (System.currentTimeMillis() - ratesAt < MAX_AGE_MS && rates.isNotEmpty()) {
            FiatDisplay.update(FiatDisplay.selected, rates[FiatDisplay.selected.code])
            return
        }
        val fetched = withContext(Dispatchers.IO) {
            runCatching {
                http.newCall(Request.Builder().url(URL).build()).execute().use { response ->
                    if (!response.isSuccessful) return@runCatching null
                    response.body.string()
                }
            }.getOrNull()
        } ?: return
        val parsed = parseRates(fetched)
        if (parsed.isEmpty()) return
        rates = parsed
        ratesAt = System.currentTimeMillis()
        preferences.setCachedRates(ratesAt, fetched)
        FiatDisplay.update(FiatDisplay.selected, rates[FiatDisplay.selected.code])
    }

    private fun parseRates(raw: String): Map<String, BigDecimal> = runCatching {
        val root = json.parseToJsonElement(raw).jsonObject
        if (root["result"]?.jsonPrimitive?.contentOrNull != "success") return@runCatching emptyMap()
        (root["rates"] as? JsonObject).orEmpty().mapNotNull { (code, v) ->
            v.jsonPrimitive.contentOrNull?.toBigDecimalOrNull()?.takeIf { it.signum() > 0 }?.let { code to it }
        }.toMap()
    }.getOrDefault(emptyMap())

    private companion object {
        const val URL = "https://open.er-api.com/v6/latest/USD"
        const val MAX_AGE_MS = 12 * 60 * 60_000L
    }
}
