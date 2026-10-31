package com.vfxt.wallet.data.local

import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import com.vfxt.wallet.core.security.SecureFileStore
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

enum class WalletSource { CreatedMnemonic, ImportedMnemonic, ImportedPrivateKey }

/** Public, non-secret view of a stored wallet. Safe to keep in memory and show in UI. */
data class WalletSummary(
    val id: String,
    val name: String,
    val address: String,
    val source: WalletSource,
    val accountIndex: Int?,
    val createdAt: Long,
    val backedUp: Boolean,
) {
    val hasRecoveryPhrase: Boolean get() = source != WalletSource.ImportedPrivateKey
}

@Serializable
private data class StoredWallet(
    val id: String,
    val name: String,
    val address: String,
    val source: WalletSource,
    val accountIndex: Int? = null,
    /** BIP-39 phrase for mnemonic wallets, 0x-hex private key otherwise. */
    val secret: String,
    val createdAt: Long,
    val backedUp: Boolean,
)

@Serializable
private data class VaultContents(
    val version: Int = 1,
    val wallets: List<StoredWallet> = emptyList(),
    val activeWalletId: String? = null,
)

class DuplicateWalletException(val existingName: String) : Exception("Wallet already exists")

/**
 * Self-custody wallet storage.
 *
 * The entire vault (including secrets) is a single JSON document encrypted with the Android
 * Keystore AES-GCM key via [SecureFileStore]; it lives in noBackupFilesDir and is never synced.
 * Only [WalletSummary] objects (no secrets) are held in memory. Secrets are decrypted on demand
 * for a single operation via [revealSecret] and the caller must have authenticated the user first.
 */
@Singleton
class WalletVault internal constructor(
    private val store: SecureFileStore,
    private val keys: WalletKeyService,
    private val io: CoroutineDispatcher,
) {
    @Inject constructor(store: SecureFileStore, keys: WalletKeyService) : this(store, keys, Dispatchers.IO)

    private val mutex = Mutex()
    private val json = Json { ignoreUnknownKeys = true }

    private val _wallets = MutableStateFlow<List<WalletSummary>?>(null)
    /** Null until the vault has been read for the first time. */
    val wallets: StateFlow<List<WalletSummary>?> = _wallets.asStateFlow()

    private val _activeWalletId = MutableStateFlow<String?>(null)
    val activeWalletId: StateFlow<String?> = _activeWalletId.asStateFlow()

    suspend fun load() = mutex.withLock { publish(readContents()) }

    suspend fun addMnemonicWallet(name: String, mnemonic: String, accountIndex: Int, created: Boolean): WalletSummary =
        mutex.withLock {
            val normalized = keys.normalizeMnemonic(mnemonic)
            require(keys.isValidMnemonic(normalized)) { "Invalid recovery phrase" }
            val address = withContext(io) { keys.deriveFromMnemonic(normalized, accountIndex).address }
            insert(
                name = name,
                address = address,
                source = if (created) WalletSource.CreatedMnemonic else WalletSource.ImportedMnemonic,
                accountIndex = accountIndex,
                secret = normalized,
                // A created wallet only reaches here after the user verified the phrase; an
                // imported one is by definition already backed up by the user.
                backedUp = true,
            )
        }

    suspend fun addPrivateKeyWallet(name: String, privateKeyInput: String): WalletSummary = mutex.withLock {
        val key = requireNotNull(keys.parsePrivateKey(privateKeyInput)) { "Invalid private key" }
        val address = keys.deriveFromPrivateKey(key).address
        insert(name, address, WalletSource.ImportedPrivateKey, null, keys.privateKeyHex(key), backedUp = true)
    }

    private suspend fun insert(
        name: String,
        address: String,
        source: WalletSource,
        accountIndex: Int?,
        secret: String,
        backedUp: Boolean,
    ): WalletSummary {
        val contents = readContents()
        contents.wallets.firstOrNull { it.address.equals(address, ignoreCase = true) }?.let {
            throw DuplicateWalletException(it.name)
        }
        val stored = StoredWallet(
            id = UUID.randomUUID().toString(),
            name = name.trim().ifEmpty { "Wallet ${contents.wallets.size + 1}" }.take(MAX_NAME),
            address = address,
            source = source,
            accountIndex = accountIndex,
            secret = secret,
            createdAt = System.currentTimeMillis(),
            backedUp = backedUp,
        )
        val updated = contents.copy(wallets = contents.wallets + stored, activeWalletId = stored.id)
        writeContents(updated)
        return stored.toSummary()
    }

    suspend fun rename(id: String, name: String) = update { c ->
        c.copy(wallets = c.wallets.map { if (it.id == id) it.copy(name = name.trim().take(MAX_NAME).ifEmpty { it.name }) else it })
    }

    suspend fun setActive(id: String) = update { c ->
        require(c.wallets.any { it.id == id }) { "Unknown wallet" }
        c.copy(activeWalletId = id)
    }

    suspend fun remove(id: String) = update { c ->
        val remaining = c.wallets.filterNot { it.id == id }
        c.copy(
            wallets = remaining,
            activeWalletId = if (c.activeWalletId == id) remaining.firstOrNull()?.id else c.activeWalletId,
        )
    }

    /** Returns the recovery phrase (mnemonic wallets) or 0x private key. Authenticate the user first. */
    suspend fun revealSecret(id: String): String = mutex.withLock {
        readContents().wallets.first { it.id == id }.secret
    }

    /** Private key for any wallet type. Authenticate the user first. */
    suspend fun revealPrivateKey(id: String): String = mutex.withLock {
        val wallet = readContents().wallets.first { it.id == id }
        when (wallet.source) {
            WalletSource.ImportedPrivateKey -> wallet.secret
            else -> withContext(io) {
                keys.privateKeyHex(keys.deriveFromMnemonic(wallet.secret, wallet.accountIndex ?: 0).privateKey)
            }
        }
    }

    private suspend fun update(transform: (VaultContents) -> VaultContents) = mutex.withLock {
        writeContents(transform(readContents()))
    }

    private suspend fun readContents(): VaultContents = withContext(io) {
        store.read(FILE)?.let { bytes ->
            try {
                json.decodeFromString(VaultContents.serializer(), bytes.decodeToString())
            } finally {
                bytes.fill(0)
            }
        } ?: VaultContents()
    }

    private suspend fun writeContents(contents: VaultContents) {
        withContext(io) {
            val bytes = json.encodeToString(VaultContents.serializer(), contents).encodeToByteArray()
            try {
                store.write(FILE, bytes)
            } finally {
                bytes.fill(0)
            }
        }
        publish(contents)
    }

    private fun publish(contents: VaultContents) {
        _wallets.value = contents.wallets.map { it.toSummary() }
        _activeWalletId.value = contents.activeWalletId ?: contents.wallets.firstOrNull()?.id
    }

    private fun StoredWallet.toSummary() = WalletSummary(id, name, address, source, accountIndex, createdAt, backedUp)

    private companion object {
        const val FILE = "wallet_vault"
        const val MAX_NAME = 32
    }
}
