package com.vfxt.wallet.data.remote

import com.vfxt.wallet.blockchain.swap.CrossChainStatus
import com.vfxt.wallet.blockchain.swap.SwapException
import com.vfxt.wallet.blockchain.swap.SwapEstimate
import com.vfxt.wallet.blockchain.swap.SwapFee
import com.vfxt.wallet.blockchain.swap.SwapQuote
import com.vfxt.wallet.blockchain.swap.SwapStatus
import com.vfxt.wallet.blockchain.swap.SwapToken
import com.vfxt.wallet.blockchain.swap.SwapTxRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.math.BigDecimal
import java.math.BigInteger
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Client for the LI.FI aggregation API (same-chain DEX swaps and cross-chain bridges).
 *
 * LI.FI only *suggests* transactions; nothing here signs anything. Every quote is validated by
 * SwapGuard before the wallet signs it locally. No API key is required; LI.FI deducts a fixed
 * 0.25% fee that is included in the quote and shown to the user.
 */
@Singleton
class LiFiApi @Inject constructor(private val http: OkHttpClient) {

    private val json = Json { ignoreUnknownKeys = true }
    private val tokenCache = ConcurrentHashMap<Long, Pair<Long, List<SwapToken>>>()

    /** Verified, non-flagged tokens LI.FI can route on [chainId]. Cached for 30 minutes. */
    suspend fun tokens(chainId: Long): List<SwapToken> {
        tokenCache[chainId]?.let { (at, list) -> if (System.currentTimeMillis() - at < TOKEN_CACHE_MS) return list }
        return withContext(Dispatchers.IO) {
            val url = BASE.toHttpUrl().newBuilder().addPathSegments("v1/tokens").addQueryParameter("chains", chainId.toString()).build()
            val root = get(url.toString())
            val list = root["tokens"]?.jsonObject?.get(chainId.toString())?.jsonArray.orEmpty()
                .mapNotNull { parseToken(it, requireVerified = true) }
            list.also { tokenCache[chainId] = System.currentTimeMillis() to it }
        }
    }

    suspend fun quote(
        fromChainId: Long,
        toChainId: Long,
        fromToken: String,
        toToken: String,
        fromAmount: BigInteger,
        fromAddress: String,
        slippage: BigDecimal,
    ): SwapQuote = withContext(Dispatchers.IO) {
        val url = BASE.toHttpUrl().newBuilder()
            .addPathSegments("v1/quote")
            .addQueryParameter("fromChain", fromChainId.toString())
            .addQueryParameter("toChain", toChainId.toString())
            .addQueryParameter("fromToken", fromToken)
            .addQueryParameter("toToken", toToken)
            .addQueryParameter("fromAmount", fromAmount.toString())
            .addQueryParameter("fromAddress", fromAddress)
            .addQueryParameter("toAddress", fromAddress)
            .addQueryParameter("slippage", slippage.toPlainString())
            .addQueryParameter("integrator", INTEGRATOR)
            .addQueryParameter("order", "CHEAPEST")
            .build()
        parseQuote(get(url.toString()))
    }

    /** Best indicative route (no transaction, no balance needed). Null when no route exists. */
    suspend fun estimate(
        fromChainId: Long,
        toChainId: Long,
        fromToken: String,
        toToken: String,
        fromAmount: BigInteger,
        fromAddress: String,
        slippage: BigDecimal,
        toDecimals: Int,
    ): SwapEstimate? = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("fromChainId", fromChainId)
            put("toChainId", toChainId)
            put("fromTokenAddress", fromToken)
            put("toTokenAddress", toToken)
            put("fromAmount", fromAmount.toString())
            put("fromAddress", fromAddress)
            put("toAddress", fromAddress)
            put(
                "options",
                buildJsonObject {
                    put("slippage", slippage.toDouble())
                    put("order", "CHEAPEST")
                    put("integrator", INTEGRATOR)
                },
            )
        }
        val request = Request.Builder()
            .url("$BASE/v1/advanced/routes")
            .post(json.encodeToString(JsonObject.serializer(), payload).toRequestBody("application/json".toMediaType()))
            .build()
        val root = http.newCall(request).execute().use { response ->
            val body = response.body.string()
            val parsed = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull()
            if (!response.isSuccessful) throw SwapException(friendlyError(response.code, parsed))
            parsed ?: throw SwapException("Unexpected response from the swap service.")
        }
        parseBestRoute(root, toDecimals)
    }

    suspend fun status(txHash: String, fromChainId: Long, toChainId: Long, tool: String?): SwapStatus = withContext(Dispatchers.IO) {
        val url = BASE.toHttpUrl().newBuilder()
            .addPathSegments("v1/status")
            .addQueryParameter("txHash", txHash)
            .addQueryParameter("fromChain", fromChainId.toString())
            .addQueryParameter("toChain", toChainId.toString())
            .apply { if (tool != null) addQueryParameter("bridge", tool) }
            .build()
        val root = runCatching { get(url.toString()) }.getOrElse { return@withContext SwapStatus(CrossChainStatus.NotFound, null, null) }
        SwapStatus(
            status = when (root.str("status")) {
                "DONE" -> CrossChainStatus.Done
                "FAILED", "INVALID" -> CrossChainStatus.Failed
                "PENDING" -> CrossChainStatus.Pending
                else -> CrossChainStatus.NotFound
            },
            substatusMessage = root.str("substatusMessage"),
            receivingTxHash = root["receiving"]?.jsonObject?.str("txHash"),
        )
    }

    private fun get(url: String): JsonObject {
        http.newCall(Request.Builder().url(url).header("Accept", "application/json").build()).execute().use { response ->
            val body = response.body.string()
            val parsed = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull()
            if (!response.isSuccessful) throw SwapException(friendlyError(response.code, parsed))
            return parsed ?: throw SwapException("Unexpected response from the swap service.")
        }
    }

    companion object {
        private const val BASE = "https://li.quest"
        private const val INTEGRATOR = "vfxt-wallet"
        private const val TOKEN_CACHE_MS = 30 * 60_000L

        internal fun friendlyError(code: Int, body: JsonObject?): String {
            val message = body?.str("message").orEmpty()
            val lifiCode = body?.get("code")?.jsonPrimitive?.intOrNull
            return when {
                code == 429 -> "The swap service is busy. Please wait a moment and try again."
                lifiCode == 1002 || "No available quotes" in message -> "No route found for this pair and amount. Try a different amount or token."
                lifiCode == 1001 || "could successfully generate" in message ->
                    "No route could be built. Check your balance covers the amount and network fee, or try another amount."
                lifiCode == 1011 || "slippage" in message.lowercase() -> "Price moves too much for this amount. Try a smaller amount or higher slippage."
                message.isNotBlank() -> "Swap service: $message"
                else -> "The swap service is unavailable (HTTP $code). Please try again."
            }
        }

        /** Parses a token; drops LI.FI-flagged tokens and garbage metadata. */
        internal fun parseToken(element: JsonElement, requireVerified: Boolean): SwapToken? {
            val o = element as? JsonObject ?: return null
            val status = o.str("verificationStatus")
            if (status == "flagged") return null
            if (requireVerified && status != null && status != "verified") return null
            val symbol = o.str("symbol")?.filter { !it.isISOControl() }?.trim()?.takeIf { it.isNotEmpty() && it.length <= 16 } ?: return null
            val address = o.str("address")?.takeIf { it.length == 42 && it.startsWith("0x") } ?: return null
            val decimals = o["decimals"]?.jsonPrimitive?.intOrNull?.takeIf { it in 0..36 } ?: return null
            return SwapToken(
                chainId = o["chainId"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: return null,
                address = address,
                symbol = symbol,
                name = o.str("name")?.filter { !it.isISOControl() }?.take(48) ?: symbol,
                decimals = decimals,
                priceUsd = o.str("priceUSD")?.toBigDecimalOrNull()?.takeIf { it.signum() > 0 },
                verified = status == null || status == "verified",
            )
        }

        internal fun parseQuote(root: JsonObject): SwapQuote {
            val action = root["action"]?.jsonObject ?: throw SwapException("Incomplete quote.")
            val estimate = root["estimate"]?.jsonObject ?: throw SwapException("Incomplete quote.")
            val txObj = root["transactionRequest"]?.jsonObject ?: throw SwapException("The quote has no transaction to sign.")
            val fromToken = action["fromToken"]?.let { parseToken(it, requireVerified = false) } ?: throw SwapException("Unknown source token.")
            val toToken = action["toToken"]?.let { parseToken(it, requireVerified = false) } ?: throw SwapException("Unknown destination token.")
            return SwapQuote(
                id = root.str("id").orEmpty(),
                tool = root.str("tool").orEmpty(),
                toolName = root["toolDetails"]?.jsonObject?.str("name") ?: root.str("tool").orEmpty(),
                fromToken = fromToken,
                toToken = toToken,
                fromAmount = bigInt(action.str("fromAmount")) ?: throw SwapException("Quote has no amount."),
                toAmount = bigInt(estimate.str("toAmount")) ?: throw SwapException("Quote has no output amount."),
                toAmountMin = bigInt(estimate.str("toAmountMin")) ?: throw SwapException("Quote has no minimum output."),
                slippage = action.str("slippage")?.toBigDecimalOrNull() ?: BigDecimal("0.005"),
                approvalAddress = estimate.str("approvalAddress"),
                executionDurationSeconds = estimate.str("executionDuration")?.toBigDecimalOrNull()?.toInt() ?: 0,
                fromAmountUsd = estimate.str("fromAmountUSD")?.toBigDecimalOrNull(),
                toAmountUsd = estimate.str("toAmountUSD")?.toBigDecimalOrNull(),
                gasCostUsd = (estimate["gasCosts"] as? JsonArray)?.mapNotNull { (it as? JsonObject)?.str("amountUSD")?.toBigDecimalOrNull() }
                    ?.takeIf { it.isNotEmpty() }?.fold(BigDecimal.ZERO, BigDecimal::add),
                fees = (estimate["feeCosts"] as? JsonArray).orEmpty().mapNotNull { fee ->
                    val f = fee as? JsonObject ?: return@mapNotNull null
                    SwapFee(
                        name = f.str("name") ?: "Fee",
                        amountUsd = f.str("amountUSD")?.toBigDecimalOrNull(),
                        percentage = f.str("percentage")?.toBigDecimalOrNull(),
                        included = f.str("included")?.toBooleanStrictOrNull() ?: true,
                    )
                },
                tx = SwapTxRequest(
                    chainId = txObj.str("chainId")?.toLongOrNull() ?: throw SwapException("Quote has no chain id."),
                    to = txObj.str("to") ?: throw SwapException("Quote has no target."),
                    data = txObj.str("data") ?: throw SwapException("Quote has no data."),
                    value = bigInt(txObj.str("value")) ?: BigInteger.ZERO,
                    gasLimit = bigInt(txObj.str("gasLimit")),
                    gasPrice = bigInt(txObj.str("gasPrice")),
                ),
            )
        }

        internal fun parseBestRoute(root: JsonObject, toDecimals: Int): SwapEstimate? {
            val route = (root["routes"] as? JsonArray)?.firstOrNull() as? JsonObject ?: return null
            val steps = (route["steps"] as? JsonArray).orEmpty().mapNotNull { it as? JsonObject }
            return SwapEstimate(
                toAmount = bigInt(route.str("toAmount")) ?: return null,
                toAmountMin = bigInt(route.str("toAmountMin")) ?: return null,
                toDecimals = toDecimals,
                fromAmountUsd = route.str("fromAmountUSD")?.toBigDecimalOrNull(),
                toAmountUsd = route.str("toAmountUSD")?.toBigDecimalOrNull(),
                gasCostUsd = route.str("gasCostUSD")?.toBigDecimalOrNull(),
                toolName = steps.joinToString(" → ") { s -> s["toolDetails"]?.jsonObject?.str("name") ?: s.str("tool").orEmpty() },
                executionDurationSeconds = steps.sumOf { s ->
                    s["estimate"]?.jsonObject?.str("executionDuration")?.toBigDecimalOrNull()?.toInt() ?: 0
                },
            )
        }

        /** Accepts both "0x…" hex quantities and decimal strings. */
        internal fun bigInt(value: String?): BigInteger? {
            if (value.isNullOrBlank()) return null
            return if (value.startsWith("0x") || value.startsWith("0X")) {
                value.substring(2).ifEmpty { "0" }.toBigIntegerOrNull(16)
            } else {
                value.toBigIntegerOrNull()
            }
        }

        private fun JsonObject.str(key: String): String? = (this[key] as? kotlinx.serialization.json.JsonPrimitive)?.contentOrNull
    }
}
