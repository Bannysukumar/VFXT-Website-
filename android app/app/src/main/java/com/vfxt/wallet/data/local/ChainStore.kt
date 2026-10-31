package com.vfxt.wallet.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.networks.Networks
import com.vfxt.wallet.blockchain.tokens.TokenRegistry
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

private val Context.chainDataStore: DataStore<Preferences> by preferencesDataStore(name = "chain_data")

@Serializable
data class StoredToken(
    val networkId: String,
    val contract: String,
    val symbol: String,
    val name: String,
    val decimals: Int,
)

@Serializable
data class StoredNetwork(
    val id: String,
    val name: String,
    val shortName: String,
    val chainId: Long,
    val nativeSymbol: String,
    val rpcUrl: String,
    val explorerBaseUrl: String,
    val isTestnet: Boolean = false,
) {
    fun toEvmNetwork(): EvmNetwork = EvmNetwork(
        id = id,
        name = name,
        shortName = shortName.ifBlank { name.take(12) },
        chainId = chainId,
        nativeSymbol = nativeSymbol,
        nativeName = nativeSymbol,
        nativeDecimals = 18,
        isTestnet = isTestnet,
        explorerBaseUrl = explorerBaseUrl.trim().trimEnd('/').ifBlank { "https://example.com" },
        rpcUrls = listOf(rpcUrl.trim()),
        nativePriceId = null,
        coingeckoPlatform = null,
        isCustom = true,
    )
}

enum class TxDirection { Outgoing, Incoming }

/** A transaction this app broadcast (or later, one fetched from an explorer). Public data only. */
@Serializable
data class TxRecord(
    val hash: String,
    val networkId: String,
    val from: String,
    val to: String,
    val tokenSymbol: String,
    val tokenContract: String? = null,
    /** Amount as a plain decimal string, already scaled by token decimals. */
    val amount: String,
    val direction: TxDirection = TxDirection.Outgoing,
    /** "pending" | "confirmed" | "failed" */
    val status: String,
    val timestamp: Long,
    val fee: String? = null,
)

/**
 * Public, non-secret chain data: active network, custom networks, user-added tokens, hidden tokens
 * and the local transaction log. Stored in DataStore (no keys or phrases ever go here).
 */
@Singleton
class ChainStore @Inject constructor(@ApplicationContext context: Context) {
    private val store = context.applicationContext.chainDataStore
    private val json = Json { ignoreUnknownKeys = true }
    private val tokensSerializer = ListSerializer(StoredToken.serializer())
    private val networksSerializer = ListSerializer(StoredNetwork.serializer())
    private val txSerializer = ListSerializer(TxRecord.serializer())

    val customNetworks: Flow<List<StoredNetwork>> = store.data.map { decode(it[CUSTOM_NETWORKS], networksSerializer) }

    val allNetworks: Flow<List<EvmNetwork>> = customNetworks.map { custom ->
        Networks.all + custom.map { it.toEvmNetwork() }
    }

    val activeNetwork: Flow<EvmNetwork> = store.data.map { prefs ->
        val id = prefs[ACTIVE_NETWORK]
        val custom = decode(prefs[CUSTOM_NETWORKS], networksSerializer)
        resolve(id, custom) ?: TokenRegistry.defaultNetwork
    }

    suspend fun currentNetwork(): EvmNetwork = activeNetwork.first()

    /** Resolve a network id against built-ins + stored custom networks. */
    suspend fun resolveNetwork(id: String): EvmNetwork? {
        Networks.byId(id)?.let { return it }
        return customNetworks.first().firstOrNull { it.id == id }?.toEvmNetwork()
    }

    suspend fun setActiveNetwork(network: EvmNetwork) {
        store.edit { it[ACTIVE_NETWORK] = network.id }
    }

    suspend fun addCustomNetwork(network: StoredNetwork) = store.edit { prefs ->
        val current = decode(prefs[CUSTOM_NETWORKS], networksSerializer)
        val deduped = current.filterNot { it.id == network.id || it.chainId == network.chainId }
        prefs[CUSTOM_NETWORKS] = json.encodeToString(networksSerializer, deduped + network)
        prefs[ACTIVE_NETWORK] = network.id
    }

    suspend fun removeCustomNetwork(id: String) = store.edit { prefs ->
        val current = decode(prefs[CUSTOM_NETWORKS], networksSerializer)
        prefs[CUSTOM_NETWORKS] = json.encodeToString(networksSerializer, current.filterNot { it.id == id })
        if (prefs[ACTIVE_NETWORK] == id) {
            prefs[ACTIVE_NETWORK] = TokenRegistry.defaultNetwork.id
        }
    }

    val customTokens: Flow<List<StoredToken>> = store.data.map { decode(it[CUSTOM_TOKENS], tokensSerializer) }

    suspend fun addCustomToken(token: StoredToken) = store.edit { prefs ->
        val current = decode(prefs[CUSTOM_TOKENS], tokensSerializer)
        val deduped = current.filterNot { it.networkId == token.networkId && it.contract.equals(token.contract, true) }
        prefs[CUSTOM_TOKENS] = json.encodeToString(tokensSerializer, deduped + token)
    }

    suspend fun removeCustomToken(networkId: String, contract: String) = store.edit { prefs ->
        val current = decode(prefs[CUSTOM_TOKENS], tokensSerializer)
        prefs[CUSTOM_TOKENS] = json.encodeToString(tokensSerializer, current.filterNot { it.networkId == networkId && it.contract.equals(contract, true) })
    }

    /** Keys ("networkId:tokenKey") of tokens the user hid from lists. */
    val hiddenTokens: Flow<Set<String>> = store.data.map { prefs ->
        prefs[HIDDEN_TOKENS]?.split('|')?.filter { it.isNotBlank() }?.toSet().orEmpty()
    }

    suspend fun setTokenHidden(networkId: String, tokenKey: String, hidden: Boolean) = store.edit { prefs ->
        val current = prefs[HIDDEN_TOKENS]?.split('|')?.filter { it.isNotBlank() }?.toMutableSet() ?: mutableSetOf()
        val key = "$networkId:$tokenKey"
        if (hidden) current += key else current -= key
        prefs[HIDDEN_TOKENS] = current.joinToString("|")
    }

    val transactions: Flow<List<TxRecord>> = store.data.map { decode(it[TRANSACTIONS], txSerializer) }

    suspend fun upsertTransaction(record: TxRecord) = store.edit { prefs ->
        val current = decode(prefs[TRANSACTIONS], txSerializer)
        val updated = (current.filterNot { it.hash.equals(record.hash, true) && it.networkId == record.networkId } + record)
            .sortedByDescending { it.timestamp }
            .take(MAX_TX)
        prefs[TRANSACTIONS] = json.encodeToString(txSerializer, updated)
    }

    private fun resolve(id: String?, custom: List<StoredNetwork>): EvmNetwork? {
        if (id == null) return null
        return Networks.byId(id) ?: custom.firstOrNull { it.id == id }?.toEvmNetwork()
    }

    private fun <T> decode(raw: String?, serializer: kotlinx.serialization.KSerializer<List<T>>): List<T> =
        raw?.let { runCatching { json.decodeFromString(serializer, it) }.getOrNull() }.orEmpty()

    private companion object {
        val ACTIVE_NETWORK = stringPreferencesKey("active_network")
        val CUSTOM_NETWORKS = stringPreferencesKey("custom_networks")
        val CUSTOM_TOKENS = stringPreferencesKey("custom_tokens")
        val HIDDEN_TOKENS = stringPreferencesKey("hidden_tokens")
        val TRANSACTIONS = stringPreferencesKey("transactions")
        const val MAX_TX = 500
    }
}
