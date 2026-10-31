package com.vfxt.wallet.blockchain.walletconnect

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * WalletConnect v2 preparation layer.
 *
 * Full Reown/WalletConnect Android SDK pairing requires a Cloud Project ID
 * (`vfxt.walletConnectProjectId` in local.properties). Until that ID is configured and the
 * SDK is enabled, this manager exposes session state for the UI and rejects automatic approvals.
 *
 * Never auto-approve transaction or message signing requests.
 */
data class WcSessionSummary(
    val topic: String,
    val peerName: String,
    val peerUrl: String?,
    val chains: List<String>,
)

sealed interface WcConnectionState {
    data object Disabled : WcConnectionState
    data object Idle : WcConnectionState
    data class PendingApproval(val peerName: String, val uri: String) : WcConnectionState
    data class Connected(val sessions: List<WcSessionSummary>) : WcConnectionState
}

@Singleton
class WalletConnectSessionManager @Inject constructor() {
    private val _state = MutableStateFlow<WcConnectionState>(
        if (hasProjectId()) WcConnectionState.Idle else WcConnectionState.Disabled,
    )
    val state: StateFlow<WcConnectionState> = _state.asStateFlow()

    fun isConfigured(): Boolean = hasProjectId()

    /**
     * Accepts a WalletConnect URI from the QR scanner. Without a Project ID this records a
     * pending approval preview only — no remote pairing is performed.
     */
    fun submitPairingUri(uri: String): Result<Unit> {
        if (!uri.startsWith("wc:", ignoreCase = true)) {
            return Result.failure(IllegalArgumentException("Not a WalletConnect URI"))
        }
        if (!hasProjectId()) {
            return Result.failure(
                IllegalStateException("WalletConnect Project ID is not configured yet."),
            )
        }
        _state.value = WcConnectionState.PendingApproval(peerName = "dApp", uri = uri)
        return Result.success(Unit)
    }

    fun rejectPending() {
        _state.value = if (hasProjectId()) WcConnectionState.Idle else WcConnectionState.Disabled
    }

    fun disconnectAll() {
        _state.value = if (hasProjectId()) WcConnectionState.Idle else WcConnectionState.Disabled
    }

    private fun hasProjectId(): Boolean =
        com.vfxt.wallet.BuildConfig.WALLETCONNECT_PROJECT_ID.isNotBlank()
}
