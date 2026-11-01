package com.vfxt.wallet.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.vfxt.wallet.data.local.WalletVault
import com.vfxt.wallet.data.remote.FirebaseWalletAuth
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

data class AppNotification(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val read: Boolean,
    val createdAtMillis: Long?,
)

sealed interface NotificationsState {
    data object Loading : NotificationsState
    data class Ready(val items: List<AppNotification>) : NotificationsState
    data class Unavailable(val message: String) : NotificationsState
}

/**
 * The user's server-written notifications at `users/{uid}/notifications` (deposits, withdrawals,
 * mining, security). Firestore rules allow the owner to read them and to set `read`/`readAt` only.
 * Uses the same wallet-signature Firebase sign-in as mining; no secret leaves the device.
 */
@Singleton
class NotificationsRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseWalletAuth,
    private val vault: WalletVault,
) {
    /** Live list, newest first. Signs in on first collection if needed. */
    fun observe(): Flow<NotificationsState> = callbackFlow {
        trySend(NotificationsState.Loading)
        val uid = try {
            signedInUid()
        } catch (e: Exception) {
            trySend(NotificationsState.Unavailable(e.message ?: "Couldn't sign in to load notifications."))
            close()
            return@callbackFlow
        }
        if (uid == null) {
            trySend(NotificationsState.Unavailable("Create or import a wallet to receive notifications."))
            close()
            return@callbackFlow
        }
        val registration = collection(uid)
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(100)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(NotificationsState.Unavailable("Notifications are unavailable right now."))
                    return@addSnapshotListener
                }
                val items = snapshot?.documents.orEmpty().map { doc ->
                    AppNotification(
                        id = doc.id,
                        type = doc.getString("type").orEmpty(),
                        title = doc.getString("title").orEmpty().ifBlank { "Notification" },
                        body = doc.getString("body").orEmpty(),
                        read = doc.getBoolean("read") ?: false,
                        createdAtMillis = (doc.get("createdAt") as? Timestamp)?.toDate()?.time,
                    )
                }
                trySend(NotificationsState.Ready(items))
            }
        awaitClose { registration.remove() }
    }

    suspend fun markRead(id: String) {
        val uid = auth.currentUid ?: return
        collection(uid).document(id).update(mapOf("read" to true, "readAt" to FieldValue.serverTimestamp())).await()
    }

    suspend fun markAllRead(items: List<AppNotification>) {
        val uid = auth.currentUid ?: return
        val unread = items.filterNot { it.read }
        if (unread.isEmpty()) return
        val batch = firestore.batch()
        unread.forEach { batch.update(collection(uid).document(it.id), mapOf("read" to true, "readAt" to FieldValue.serverTimestamp())) }
        batch.commit().await()
    }

    private suspend fun signedInUid(): String? {
        val list = vault.wallets.value ?: run { vault.load(); vault.wallets.value.orEmpty() }
        val wallet = list.firstOrNull { it.id == vault.activeWalletId.value } ?: list.firstOrNull() ?: return null
        auth.ensureSignedIn(wallet.id, wallet.address)
        return auth.currentUid
    }

    private fun collection(uid: String) = firestore.collection("users").document(uid).collection("notifications")
}
