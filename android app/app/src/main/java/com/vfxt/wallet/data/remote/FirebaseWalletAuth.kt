package com.vfxt.wallet.data.remote

import android.os.Build
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import com.vfxt.wallet.BuildConfig
import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import com.vfxt.wallet.data.local.AppPreferences
import com.vfxt.wallet.data.local.WalletVault
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

class AuthException(message: String) : Exception(message)

data class AccountSession(
    val uid: String,
    val email: String?,
    val createdAtMillis: Long?,
    val lastSignInMillis: Long?,
)

/** Another install signed in to the same VFXT account. */
data class AccountDevice(
    val installId: String,
    val model: String,
    val osVersion: String,
    val appVersion: String,
    val firstSeenMillis: Long?,
    val lastSeenMillis: Long?,
)

/**
 * Signs the user into Firebase using a wallet personal_sign challenge.
 * Private keys never leave the device; only the signature is sent to Cloud Functions.
 */
@Singleton
class FirebaseWalletAuth @Inject constructor(
    private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions,
    private val vault: WalletVault,
    private val keys: WalletKeyService,
    private val prefs: AppPreferences,
) {
    private val signInLock = Mutex()

    /** uid whose device registration has been confirmed in this process. */
    @Volatile private var registeredUid: String? = null

    val currentUid: String? get() = auth.currentUser?.uid

    /** Public details of this device's Firebase session, or null when signed out. */
    val session: AccountSession? get() = auth.currentUser?.let { user ->
        AccountSession(
            uid = user.uid,
            email = user.email?.takeIf { it.isNotBlank() },
            createdAtMillis = user.metadata?.creationTimestamp,
            lastSignInMillis = user.metadata?.lastSignInTimestamp,
        )
    }

    suspend fun installId(): String = prefs.installId()

    suspend fun ensureSignedIn(walletId: String, address: String) = signInLock.withLock {
        val normalized = address.lowercase()
        val existing = auth.currentUser
        if (existing != null) {
            val claims = existing.getIdToken(false).await().claims
            val claimAddress = (claims["walletAddress"] as? String)?.lowercase()
            if (claimAddress == normalized || existing.uid == "w_${normalized.removePrefix("0x")}") {
                registerDeviceOnce(existing.uid)
                return@withLock
            }
            auth.signOut()
        }
        signInWithWallet(walletId, normalized)
        auth.currentUser?.uid?.let { registerDeviceOnce(it) }
    }

    /** Other installs signed in to this account (excludes this device). */
    suspend fun otherDevices(): List<AccountDevice> {
        val self = installId()
        val res = callMap("listWalletDevices", emptyMap())
        return (res["devices"] as? List<*>).orEmpty().mapNotNull { raw ->
            val d = raw as? Map<*, *> ?: return@mapNotNull null
            val id = d["installId"] as? String ?: return@mapNotNull null
            if (id == self) return@mapNotNull null
            AccountDevice(
                installId = id,
                model = d["model"] as? String ?: "Android device",
                osVersion = d["osVersion"] as? String ?: "",
                appVersion = d["appVersion"] as? String ?: "",
                firstSeenMillis = (d["firstSeenAt"] as? Number)?.toLong(),
                lastSeenMillis = (d["lastSeenAt"] as? Number)?.toLong(),
            )
        }
    }

    /**
     * Signs out every other install. The server revokes all refresh tokens, so this device
     * immediately signs in again with a fresh wallet signature. Returns how many were signed out.
     */
    suspend fun signOutOtherDevices(): Int = signInLock.withLock {
        val list = vault.wallets.value ?: run { vault.load(); vault.wallets.value.orEmpty() }
        val wallet = list.firstOrNull { it.id == vault.activeWalletId.value } ?: list.firstOrNull()
            ?: throw AuthException("No wallet available")
        val res = callMap("signOutOtherWalletDevices", mapOf("installId" to installId()))
        auth.signOut()
        registeredUid = null
        signInWithWallet(wallet.id, wallet.address.lowercase())
        auth.currentUser?.uid?.let { registerDeviceOnce(it) }
        (res["revokedCount"] as? Number)?.toInt() ?: 0
    }

    suspend fun signOut() {
        auth.signOut()
        registeredUid = null
    }

    private suspend fun signInWithWallet(walletId: String, normalized: String) {
        val nonceRes = callMap("getWalletAppNonce", mapOf("address" to normalized))
        val message = nonceRes["message"] as? String
            ?: throw AuthException("Login challenge missing message")

        val privateKeyHex = vault.revealPrivateKey(walletId)
        val key = keys.parsePrivateKey(privateKeyHex)
            ?: throw AuthException("Could not unlock wallet for sign-in")
        val signature = keys.signPersonalMessage(key, message)

        val login = callMap(
            "verifyWalletAppLogin",
            mapOf("address" to normalized, "signature" to signature, "installId" to installId()),
        )
        val customToken = login["customToken"] as? String
            ?: throw AuthException("Sign-in token missing from server")
        auth.signInWithCustomToken(customToken).await()
    }

    /**
     * Records this install once per process. If another device signed it out, the still-valid
     * ID token is dropped right away.
     */
    private suspend fun registerDeviceOnce(uid: String) {
        if (registeredUid == uid) return
        val res = try {
            callMap(
                "registerWalletDevice",
                mapOf(
                    "installId" to installId(),
                    "model" to "${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}".take(80),
                    "osVersion" to Build.VERSION.RELEASE.take(20),
                    "appVersion" to BuildConfig.VERSION_NAME.take(20),
                ),
            )
        } catch (_: AuthException) {
            return // Registration is best-effort; never block mining on it.
        }
        if (res["revoked"] == true) {
            auth.signOut()
            throw AuthException("This device was signed out of your VFXT account from another device.")
        }
        registeredUid = uid
    }

    private suspend fun callMap(name: String, data: Map<String, Any?>): Map<*, *> {
        try {
            val result = functions.getHttpsCallable(name).call(data).await()
            @Suppress("UNCHECKED_CAST")
            return (result.data as? Map<*, *>) ?: emptyMap<Any, Any>()
        } catch (e: FirebaseFunctionsException) {
            throw AuthException(e.message ?: "Authentication failed (${e.code})")
        }
    }
}
