package com.vfxt.wallet.data.remote

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import com.vfxt.wallet.data.local.WalletVault
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

class AuthException(message: String) : Exception(message)

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
) {
    val currentUid: String? get() = auth.currentUser?.uid

    suspend fun ensureSignedIn(walletId: String, address: String) {
        val normalized = address.lowercase()
        val existing = auth.currentUser
        if (existing != null) {
            val claims = existing.getIdToken(false).await().claims
            val claimAddress = (claims["walletAddress"] as? String)?.lowercase()
            if (claimAddress == normalized || existing.uid == "w_${normalized.removePrefix("0x")}") {
                return
            }
            auth.signOut()
        }

        val nonceRes = callMap("getWalletAppNonce", mapOf("address" to normalized))
        val message = nonceRes["message"] as? String
            ?: throw AuthException("Login challenge missing message")

        val privateKeyHex = vault.revealPrivateKey(walletId)
        val signature = try {
            val key = keys.parsePrivateKey(privateKeyHex)
                ?: throw AuthException("Could not unlock wallet for sign-in")
            keys.signPersonalMessage(key, message)
        } finally {
            // Best-effort: hex string will be GC'd; avoid retaining BigInteger refs here.
        }

        val login = callMap(
            "verifyWalletAppLogin",
            mapOf("address" to normalized, "signature" to signature),
        )
        val customToken = login["customToken"] as? String
            ?: throw AuthException("Sign-in token missing from server")
        auth.signInWithCustomToken(customToken).await()
    }

    suspend fun signOut() {
        auth.signOut()
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
