package com.vfxt.wallet.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.math.BigDecimal
import java.math.RoundingMode
import javax.inject.Inject
import javax.inject.Singleton

data class Price(val usd: BigDecimal, val change24hPercent: BigDecimal?)

/**
 * Live USD market prices for display only (never used for accounting).
 *
 * Sources (tried in order):
 * 1. CoinGecko simple/price (by coin id) and simple/token_price (by contract)
 * 2. Binance public 24h ticker for well-known symbols when CoinGecko is rate-limited
 *
 * Results are cached briefly; failures yield "no price" rather than a guessed value.
 */
@Singleton
class PriceService @Inject constructor(private val http: OkHttpClient) {

    private val json = Json { ignoreUnknownKeys = true }
    private var idCache: Pair<Long, Map<String, Price>>? = null
    private var contractCache: Pair<Long, Map<String, Price>>? = null

    suspend fun prices(ids: Set<String>): Map<String, Price> {
        if (ids.isEmpty()) return emptyMap()
        idCache?.let { (at, map) ->
            if (System.currentTimeMillis() - at < CACHE_MS && map.keys.containsAll(ids)) {
                return ids.associateWith { map.getValue(it) }
            }
        }
        return withContext(Dispatchers.IO) {
            val fromGecko = fetchCoinGeckoIds(ids)
            val missing = ids - fromGecko.keys
            val fromBinance = if (missing.isEmpty()) emptyMap() else fetchBinanceForIds(missing)
            val merged = fromGecko + fromBinance
            if (merged.isNotEmpty()) {
                val previous = idCache?.second.orEmpty()
                idCache = System.currentTimeMillis() to (previous + merged)
            }
            merged
        }
    }

    /**
     * Contract → price for tokens on a CoinGecko asset platform (e.g. "ethereum").
     * Keys in the result are lower-cased contract addresses.
     */
    suspend fun tokenPrices(platform: String, contracts: Set<String>): Map<String, Price> {
        if (platform.isBlank() || contracts.isEmpty()) return emptyMap()
        val normalized = contracts.map { it.lowercase() }.toSet()
        contractCache?.let { (at, map) ->
            val keyed = normalized.map { "$platform:$it" }
            if (System.currentTimeMillis() - at < CACHE_MS && map.keys.containsAll(keyed)) {
                return normalized.mapNotNull { c -> map["$platform:$c"]?.let { c to it } }.toMap()
            }
        }
        return withContext(Dispatchers.IO) {
            val fetched = fetchCoinGeckoContracts(platform, normalized)
            if (fetched.isNotEmpty()) {
                val previous = contractCache?.second.orEmpty()
                val stamped = fetched.mapKeys { (c, _) -> "$platform:$c" }
                contractCache = System.currentTimeMillis() to (previous + stamped)
            }
            fetched
        }
    }

    private fun fetchCoinGeckoIds(ids: Set<String>): Map<String, Price> = runCatching {
        val url = "https://api.coingecko.com/api/v3/simple/price".toHttpUrl().newBuilder()
            .addQueryParameter("ids", ids.sorted().joinToString(","))
            .addQueryParameter("vs_currencies", "usd")
            .addQueryParameter("include_24hr_change", "true")
            .build()
        http.newCall(Request.Builder().url(url).header("Accept", "application/json").build()).execute().use { response ->
            if (!response.isSuccessful) return@runCatching emptyMap()
            val root = json.parseToJsonElement(response.body.string()).jsonObject
            ids.mapNotNull { id ->
                val entry = root[id]?.jsonObject ?: return@mapNotNull null
                val usd = entry["usd"]?.jsonPrimitive?.contentOrNull?.toBigDecimalOrNull() ?: return@mapNotNull null
                val change = entry["usd_24h_change"]?.jsonPrimitive?.contentOrNull?.toBigDecimalOrNull()
                id to Price(usd, change)
            }.toMap()
        }
    }.getOrDefault(emptyMap())

    private fun fetchCoinGeckoContracts(platform: String, contracts: Set<String>): Map<String, Price> = runCatching {
        val url = "https://api.coingecko.com/api/v3/simple/token_price/$platform".toHttpUrl().newBuilder()
            .addQueryParameter("contract_addresses", contracts.sorted().joinToString(","))
            .addQueryParameter("vs_currencies", "usd")
            .addQueryParameter("include_24hr_change", "true")
            .build()
        http.newCall(Request.Builder().url(url).header("Accept", "application/json").build()).execute().use { response ->
            if (!response.isSuccessful) return@runCatching emptyMap()
            val root = json.parseToJsonElement(response.body.string()).jsonObject
            contracts.mapNotNull { contract ->
                val entry = root[contract]?.jsonObject
                    ?: root.entries.firstOrNull { it.key.equals(contract, true) }?.value?.jsonObject
                    ?: return@mapNotNull null
                val usd = entry["usd"]?.jsonPrimitive?.contentOrNull?.toBigDecimalOrNull() ?: return@mapNotNull null
                val change = entry["usd_24h_change"]?.jsonPrimitive?.contentOrNull?.toBigDecimalOrNull()
                contract to Price(usd, change)
            }.toMap()
        }
    }.getOrDefault(emptyMap())

    private fun fetchBinanceForIds(ids: Set<String>): Map<String, Price> {
        val out = mutableMapOf<String, Price>()
        for (id in ids) {
            val symbol = ID_TO_BINANCE[id] ?: continue
            if (symbol == "STABLE") {
                out[id] = Price(BigDecimal.ONE, BigDecimal.ZERO)
                continue
            }
            runCatching {
                val url = "https://api.binance.com/api/v3/ticker/24hr".toHttpUrl().newBuilder()
                    .addQueryParameter("symbol", symbol)
                    .build()
                http.newCall(Request.Builder().url(url).header("Accept", "application/json").build()).execute().use { response ->
                    if (!response.isSuccessful) return@runCatching
                    val obj = json.parseToJsonElement(response.body.string()).jsonObject
                    val last = obj["lastPrice"]?.jsonPrimitive?.contentOrNull?.toBigDecimalOrNull() ?: return@runCatching
                    val change = obj["priceChangePercent"]?.jsonPrimitive?.contentOrNull?.toBigDecimalOrNull()
                    out[id] = Price(last, change?.setScale(4, RoundingMode.HALF_UP))
                }
            }
        }
        // CryptoCompare batch fallback for anything still missing.
        val stillMissing = ids - out.keys
        if (stillMissing.isNotEmpty()) {
            out += fetchCryptoCompareForIds(stillMissing)
        }
        return out
    }

    private fun fetchCryptoCompareForIds(ids: Set<String>): Map<String, Price> {
        val symbols = ids.mapNotNull { id -> ID_TO_CC_SYMBOL[id]?.let { id to it } }.toMap()
        if (symbols.isEmpty()) return emptyMap()
        return runCatching {
            val url = "https://min-api.cryptocompare.com/data/pricemultifull".toHttpUrl().newBuilder()
                .addQueryParameter("fsyms", symbols.values.distinct().joinToString(","))
                .addQueryParameter("tsyms", "USD")
                .build()
            http.newCall(Request.Builder().url(url).header("Accept", "application/json").build()).execute().use { response ->
                if (!response.isSuccessful) return@runCatching emptyMap()
                val raw = json.parseToJsonElement(response.body.string()).jsonObject
                val rawNode = raw["RAW"]?.jsonObject ?: return@runCatching emptyMap()
                symbols.mapNotNull { (id, sym) ->
                    val usd = rawNode[sym]?.jsonObject?.get("USD")?.jsonObject ?: return@mapNotNull null
                    val price = usd["PRICE"]?.jsonPrimitive?.contentOrNull?.toBigDecimalOrNull() ?: return@mapNotNull null
                    val change = usd["CHANGEPCT24HOUR"]?.jsonPrimitive?.contentOrNull?.toBigDecimalOrNull()
                    id to Price(price, change)
                }.toMap()
            }
        }.getOrDefault(emptyMap())
    }

    private companion object {
        const val CACHE_MS = 45_000L

        val ID_TO_BINANCE = mapOf(
            "binancecoin" to "BNBUSDT",
            "ethereum" to "ETHUSDT",
            "matic-network" to "POLUSDT",
            "avalanche-2" to "AVAXUSDT",
            "tether" to "STABLE",
            "usd-coin" to "STABLE",
        )

        val ID_TO_CC_SYMBOL = mapOf(
            "binancecoin" to "BNB",
            "ethereum" to "ETH",
            "matic-network" to "POL",
            "avalanche-2" to "AVAX",
            "tether" to "USDT",
            "usd-coin" to "USDC",
        )
    }
}
