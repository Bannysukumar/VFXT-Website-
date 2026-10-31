package com.vfxt.wallet.blockchain.rpc

import com.vfxt.wallet.blockchain.networks.EvmNetwork
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/** The node answered with a JSON-RPC error (e.g. "insufficient funds", "nonce too low"). */
class RpcException(val code: Long?, override val message: String) : Exception(message)

/** No endpoint for the network was reachable or all reported the wrong chain. */
class NetworkUnavailableException(message: String, cause: Throwable? = null) : IOException(message, cause)

/**
 * Minimal Ethereum JSON-RPC 2.0 client.
 *
 * - Tries each of the network's endpoints in order, remembering the last one that worked.
 * - Verifies `eth_chainId` once per endpoint; an endpoint serving a different chain is never used.
 * - Node-level errors ([RpcException]) are returned immediately and not retried on other endpoints,
 *   because they describe the request (bad nonce, insufficient funds), not the endpoint.
 */
class JsonRpcClient(
    private val http: OkHttpClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    private val ids = AtomicLong(1)
    private val verified = ConcurrentHashMap<String, Boolean>()
    private val preferred = ConcurrentHashMap<String, String>()

    suspend fun call(network: EvmNetwork, method: String, params: JsonArray): JsonElement =
        withContext(Dispatchers.IO) {
            val ordered = preferred[network.id]?.let { best -> listOf(best) + (network.rpcUrls - best) } ?: network.rpcUrls
            var lastError: Throwable? = null
            for (url in ordered) {
                try {
                    ensureChain(url, network)
                    val result = post(url, method, params)
                    preferred[network.id] = url
                    return@withContext result
                } catch (e: RpcException) {
                    throw e
                } catch (e: Exception) {
                    lastError = e
                }
            }
            throw NetworkUnavailableException("Couldn't reach ${network.name}. Check your connection.", lastError)
        }

    /** Reads eth_chainId from a raw HTTPS RPC URL without requiring a known network first. */
    suspend fun probeChainId(rpcUrl: String): Long = withContext(Dispatchers.IO) {
        val reported = post(rpcUrl.trim(), "eth_chainId", JsonArray(emptyList())).jsonPrimitive.contentOrNull
            ?.removePrefix("0x")?.toLongOrNull(16)
        reported ?: throw IOException("RPC did not return a chain id")
    }

    private fun ensureChain(url: String, network: EvmNetwork) {
        if (verified[url] == true) return
        val reported = post(url, "eth_chainId", JsonArray(emptyList())).jsonPrimitive.contentOrNull
            ?.removePrefix("0x")?.toLongOrNull(16)
        if (reported != network.chainId) {
            throw IOException("Endpoint $url reports chain $reported, expected ${network.chainId}")
        }
        verified[url] = true
    }

    private fun post(url: String, method: String, params: JsonArray): JsonElement {
        val payload = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", ids.getAndIncrement())
            put("method", method)
            put("params", params)
        }
        val request = Request.Builder()
            .url(url)
            .post(json.encodeToString(JsonObject.serializer(), payload).toRequestBody(JSON_MEDIA))
            .build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("HTTP ${response.code} from RPC")
            val body = response.body.string()
            val obj = json.parseToJsonElement(body).jsonObject
            obj["error"]?.takeIf { it !is JsonNull }?.jsonObject?.let { err ->
                throw RpcException(
                    err["code"]?.jsonPrimitive?.longOrNull,
                    err["message"]?.jsonPrimitive?.contentOrNull ?: "RPC error",
                )
            }
            return obj["result"] ?: JsonNull
        }
    }

    private companion object {
        val JSON_MEDIA = "application/json".toMediaType()
    }
}
