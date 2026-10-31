package com.vfxt.wallet.blockchain.rpc

import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.tokens.Erc20Abi
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.math.BigInteger
import javax.inject.Inject
import javax.inject.Singleton

enum class AccountKind { Wallet, DelegatedWallet, Contract }

data class TxReceipt(val success: Boolean, val blockNumber: BigInteger?, val gasUsed: BigInteger?)

/** Typed wrappers over the JSON-RPC methods the wallet uses. All quantities are exact integers. */
@Singleton
class EvmRpc @Inject constructor(private val client: JsonRpcClient) {

    suspend fun nativeBalance(network: EvmNetwork, address: String): BigInteger =
        quantity(client.call(network, "eth_getBalance", params(address, "latest")))

    suspend fun tokenBalance(network: EvmNetwork, contract: String, owner: String): BigInteger? =
        Erc20Abi.decodeUint(ethCall(network, contract, Erc20Abi.balanceOf(owner)))

    suspend fun tokenDecimals(network: EvmNetwork, contract: String): Int? =
        Erc20Abi.decodeUint(ethCall(network, contract, Erc20Abi.DECIMALS))?.toInt()

    suspend fun tokenSymbol(network: EvmNetwork, contract: String): String? =
        Erc20Abi.decodeString(ethCall(network, contract, Erc20Abi.SYMBOL))

    suspend fun tokenName(network: EvmNetwork, contract: String): String? =
        Erc20Abi.decodeString(ethCall(network, contract, Erc20Abi.NAME))

    /**
     * Classifies an address by its on-chain code:
     *  - [AccountKind.Wallet]: no code (externally owned account)
     *  - [AccountKind.DelegatedWallet]: EIP-7702 delegation designator `0xef0100 || address` — still a
     *    normal wallet controlled by its private key, just with smart-account features enabled
     *  - [AccountKind.Contract]: real deployed bytecode
     */
    suspend fun accountKind(network: EvmNetwork, address: String): AccountKind {
        val code = client.call(network, "eth_getCode", params(address, "latest")).jsonPrimitive.contentOrNull.orEmpty()
            .removePrefix("0x").lowercase()
        return when {
            code.trim('0').isEmpty() -> AccountKind.Wallet
            code.startsWith("ef0100") && code.length == 46 -> AccountKind.DelegatedWallet
            else -> AccountKind.Contract
        }
    }

    suspend fun isContract(network: EvmNetwork, address: String): Boolean = accountKind(network, address) == AccountKind.Contract

    /** Probes an HTTPS RPC URL and returns the chain id it serves. */
    suspend fun probeChainId(rpcUrl: String): Long = client.probeChainId(rpcUrl)

    suspend fun gasPrice(network: EvmNetwork): BigInteger = quantity(client.call(network, "eth_gasPrice", JsonArray(emptyList())))

    suspend fun pendingNonce(network: EvmNetwork, address: String): BigInteger =
        quantity(client.call(network, "eth_getTransactionCount", params(address, "pending")))

    suspend fun estimateGas(network: EvmNetwork, from: String, to: String, value: BigInteger, data: String?): BigInteger {
        val tx = buildJsonObject {
            put("from", from)
            put("to", to)
            put("value", hex(value))
            if (data != null) put("data", data)
        }
        return quantity(client.call(network, "eth_estimateGas", JsonArray(listOf(tx))))
    }

    /** Broadcasts a signed transaction and returns its hash. */
    suspend fun sendRawTransaction(network: EvmNetwork, signedHex: String): String =
        client.call(network, "eth_sendRawTransaction", params(signedHex)).jsonPrimitive.content

    /** Null while the transaction is still pending. */
    suspend fun receipt(network: EvmNetwork, txHash: String): TxReceipt? {
        val result = client.call(network, "eth_getTransactionReceipt", params(txHash))
        if (result is JsonNull) return null
        val obj = result.jsonObject
        return TxReceipt(
            success = obj.hexField("status") == BigInteger.ONE,
            blockNumber = obj.hexField("blockNumber"),
            gasUsed = obj.hexField("gasUsed"),
        )
    }

    private suspend fun ethCall(network: EvmNetwork, to: String, data: String): String? {
        val call = buildJsonObject {
            put("to", to)
            put("data", data)
        }
        return client.call(network, "eth_call", JsonArray(listOf(call, JsonPrimitive("latest")))).jsonPrimitive.contentOrNull
    }

    private fun params(vararg values: String) = JsonArray(values.map { JsonPrimitive(it) })

    private fun quantity(element: kotlinx.serialization.json.JsonElement): BigInteger =
        BigInteger(element.jsonPrimitive.content.removePrefix("0x").ifEmpty { "0" }, 16)

    private fun JsonObject.hexField(name: String): BigInteger? =
        this[name]?.jsonPrimitive?.contentOrNull?.removePrefix("0x")?.ifEmpty { null }?.let { BigInteger(it, 16) }

    companion object {
        fun hex(value: BigInteger): String = "0x" + value.toString(16)
    }
}
