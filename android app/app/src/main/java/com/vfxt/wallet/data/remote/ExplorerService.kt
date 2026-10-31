package com.vfxt.wallet.data.remote

import com.vfxt.wallet.BuildConfig
import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.data.local.TxDirection
import com.vfxt.wallet.data.local.TxRecord
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.math.BigDecimal
import java.math.BigInteger
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Full on-chain history (including incoming transfers) via the Etherscan V2 multichain API.
 *
 * Plain JSON-RPC can't list an address's past transactions, so this needs an API key supplied at
 * build time (`bscscan.apiKey` in local.properties). Without a key, history falls back to
 * transactions sent from this app plus a link to the explorer.
 */
@Singleton
class ExplorerService @Inject constructor(private val http: OkHttpClient) {

    private val json = Json { ignoreUnknownKeys = true }

    val isConfigured: Boolean get() = BuildConfig.BSCSCAN_API_KEY.isNotBlank()

    suspend fun history(network: EvmNetwork, address: String): List<TxRecord> {
        if (!isConfigured) return emptyList()
        return withContext(Dispatchers.IO) {
            val native = fetch(network, address, "txlist")
            val tokens = fetch(network, address, "tokentx")
            (native + tokens).distinctBy { it.hash + it.tokenSymbol }.sortedByDescending { it.timestamp }
        }
    }

    private fun fetch(network: EvmNetwork, address: String, action: String): List<TxRecord> = runCatching {
        val url = "https://api.etherscan.io/v2/api".toHttpUrl().newBuilder()
            .addQueryParameter("chainid", network.chainId.toString())
            .addQueryParameter("module", "account")
            .addQueryParameter("action", action)
            .addQueryParameter("address", address)
            .addQueryParameter("page", "1")
            .addQueryParameter("offset", "50")
            .addQueryParameter("sort", "desc")
            .addQueryParameter("apikey", BuildConfig.BSCSCAN_API_KEY)
            .build()
        http.newCall(Request.Builder().url(url).build()).execute().use { response ->
            if (!response.isSuccessful) return@runCatching emptyList()
            val result = json.parseToJsonElement(response.body.string()).jsonObject["result"] as? JsonArray
                ?: return@runCatching emptyList()
            result.mapNotNull { element ->
                val o = element.jsonObject
                fun s(key: String) = o[key]?.jsonPrimitive?.contentOrNull
                val from = s("from") ?: return@mapNotNull null
                val to = s("to") ?: return@mapNotNull null
                val isToken = action == "tokentx"
                val decimals = if (isToken) s("tokenDecimal")?.toIntOrNull() ?: 18 else network.nativeDecimals
                val value = s("value")?.toBigIntegerOrNull() ?: BigInteger.ZERO
                if (!isToken && value.signum() == 0) return@mapNotNull null // contract calls with no value
                val failed = s("isError") == "1"
                TxRecord(
                    hash = s("hash") ?: return@mapNotNull null,
                    networkId = network.id,
                    from = from,
                    to = to,
                    tokenSymbol = if (isToken) s("tokenSymbol")?.filter { !it.isISOControl() }?.take(16) ?: "?" else network.nativeSymbol,
                    tokenContract = if (isToken) s("contractAddress") else null,
                    amount = BigDecimal(value).movePointLeft(decimals).stripTrailingZeros().toPlainString(),
                    direction = if (to.equals(address, ignoreCase = true)) TxDirection.Incoming else TxDirection.Outgoing,
                    status = if (failed) "failed" else "confirmed",
                    timestamp = (s("timeStamp")?.toLongOrNull() ?: 0L) * 1000,
                )
            }
        }
    }.getOrDefault(emptyList())
}
