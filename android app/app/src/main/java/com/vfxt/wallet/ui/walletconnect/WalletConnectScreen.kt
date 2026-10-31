package com.vfxt.wallet.ui.walletconnect

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.blockchain.walletconnect.WcConnectionState
import com.vfxt.wallet.blockchain.walletconnect.WalletConnectSessionManager
import com.vfxt.wallet.core.designsystem.components.EmptyState
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn

@HiltViewModel
class WalletConnectViewModel @Inject constructor(
    private val manager: WalletConnectSessionManager,
) : ViewModel() {
    val state = manager.state.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), manager.state.value)
    fun reject() = manager.rejectPending()
    fun disconnect() = manager.disconnectAll()
}

@Composable
fun WalletConnectScreen(
    onBack: () -> Unit,
    onScanQr: () -> Unit,
    viewModel: WalletConnectViewModel = hiltViewModel(),
) {
    val colors = VfxtTheme.colors
    val state by viewModel.state.collectAsStateWithLifecycle()
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        VfxtTopBar("WalletConnect", onBack)
        Column(
            Modifier.padding(horizontal = Spacing.screen),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
        ) {
            VfxtCard(Modifier.fillMaxWidth()) {
                Text(
                    "VFXT never auto-approves requests. Review every transaction and message before signing.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textSecondary,
                )
            }
            when (val s = state) {
                is WcConnectionState.Disabled -> EmptyState(
                    icon = Icons.Outlined.Link,
                    title = "WalletConnect not configured",
                    message = "Add vfxt.walletConnectProjectId to local.properties to enable pairing with Reown Cloud.",
                )
                is WcConnectionState.Idle -> {
                    EmptyState(
                        icon = Icons.Outlined.QrCodeScanner,
                        title = "No active sessions",
                        message = "Scan a WalletConnect QR from a dApp to request a connection. Chain ID must match your selected network.",
                    )
                    VfxtPrimaryButton("Scan QR to connect", onScanQr, Modifier.fillMaxWidth())
                }
                is WcConnectionState.PendingApproval -> {
                    VfxtCard(Modifier.fillMaxWidth()) {
                        Text("Connection request", style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
                        Spacer(Modifier.height(Spacing.sm))
                        Text(s.peerName, style = MaterialTheme.typography.bodyLarge, color = colors.textPrimary)
                        Text(s.uri.take(48) + "…", style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
                        Spacer(Modifier.height(Spacing.lg))
                        Text(
                            "Full WalletConnect SDK pairing completes once the Project ID and SDK dependency are enabled. Requests are never approved automatically.",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textSecondary,
                        )
                        Spacer(Modifier.height(Spacing.lg))
                        VfxtSecondaryButton("Reject", viewModel::reject, Modifier.fillMaxWidth())
                    }
                }
                is WcConnectionState.Connected -> {
                    Text("${s.sessions.size} session(s)", style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                    VfxtSecondaryButton("Disconnect all", viewModel::disconnect, Modifier.fillMaxWidth())
                }
            }
            Spacer(Modifier.height(Spacing.xxl))
        }
    }
}
