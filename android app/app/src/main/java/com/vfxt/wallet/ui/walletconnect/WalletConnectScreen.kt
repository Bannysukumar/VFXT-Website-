package com.vfxt.wallet.ui.walletconnect

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.LinkOff
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.vfxt.wallet.blockchain.walletconnect.WalletConnectSessionManager
import com.vfxt.wallet.blockchain.walletconnect.WcConnectionState
import com.vfxt.wallet.blockchain.walletconnect.WcProposal
import com.vfxt.wallet.blockchain.walletconnect.WcRequest
import com.vfxt.wallet.blockchain.walletconnect.WcRequestDetail
import com.vfxt.wallet.blockchain.walletconnect.WcTrust
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.common.QrCodes
import com.vfxt.wallet.core.designsystem.components.EmptyState
import com.vfxt.wallet.core.designsystem.components.IconTile
import com.vfxt.wallet.core.designsystem.components.PillTone
import com.vfxt.wallet.core.designsystem.components.StatusPill
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtTextButton
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.ui.security.AuthenticateSheet
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class WalletConnectViewModel @Inject constructor(
    private val manager: WalletConnectSessionManager,
) : ViewModel() {
    val state = manager.state
    val proposal = manager.proposal
    val requests = manager.requests
    val busy = manager.busy
    val message = manager.message

    fun pair(raw: String?) {
        if (raw == null) return
        manager.submitPairingUri(raw).onFailure { manager.clearMessage(); error.value = it.message }
            .onSuccess { error.value = null }
    }

    val error = kotlinx.coroutines.flow.MutableStateFlow<String?>(null)

    fun disconnect(topic: String) = manager.disconnect(topic)
    fun disconnectAll() = manager.disconnectAll()
    fun approveProposal() = manager.approveProposal()
    fun rejectProposal() = manager.rejectProposal()
    fun approveRequest(r: WcRequest) = manager.approveRequest(r)
    fun rejectRequest(r: WcRequest) = manager.rejectRequest(r)
    fun clearMessage() = manager.clearMessage()
}

@Composable
fun WalletConnectScreen(
    onBack: () -> Unit,
    viewModel: WalletConnectViewModel = hiltViewModel(),
) {
    val colors = VfxtTheme.colors
    val context = LocalContext.current
    val state by viewModel.state.collectAsStateWithLifecycle()
    val message by viewModel.message.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val scan = { QrCodes.scan(context) { viewModel.pair(it) } }

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .safeDrawingPadding(),
    ) {
        VfxtTopBar("WalletConnect", onBack)
        Column(
            Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
        ) {
            VfxtCard(Modifier.fillMaxWidth()) {
                Text(
                    "Connect VFXT Wallet to dApps like PancakeSwap or Uniswap. Open the dApp, choose WalletConnect, " +
                        "and scan its QR code. You'll review every connection and signature — nothing is approved automatically.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textSecondary,
                )
            }
            (error ?: message)?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = if (error != null) colors.error else colors.textSecondary)
            }
            when (val s = state) {
                is WcConnectionState.Disabled -> EmptyState(
                    icon = Icons.Outlined.Link,
                    title = "WalletConnect not configured",
                    message = "This build has no Reown Project ID, so dApp connections are turned off.",
                )
                is WcConnectionState.Idle -> {
                    EmptyState(
                        icon = Icons.Outlined.QrCodeScanner,
                        title = "No connected dApps",
                        message = "Scan a WalletConnect QR code from a dApp to connect.",
                    )
                    VfxtPrimaryButton("Scan QR to connect", scan, Modifier.fillMaxWidth(), icon = Icons.Outlined.QrCodeScanner)
                }
                is WcConnectionState.Connected -> {
                    VfxtPrimaryButton("Scan QR to connect", scan, Modifier.fillMaxWidth(), icon = Icons.Outlined.QrCodeScanner)
                    Text("Connected dApps", style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                    s.sessions.forEach { session ->
                        VfxtCard(Modifier.fillMaxWidth()) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                PeerIcon(session.peerIcon)
                                Spacer(Modifier.width(Spacing.md))
                                Column(Modifier.weight(1f)) {
                                    Text(session.peerName, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                                    session.peerUrl?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                                    if (session.chains.isNotEmpty()) {
                                        Text(session.chains.joinToString(), style = MaterialTheme.typography.bodySmall, color = colors.textMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    }
                                }
                                IconButton(onClick = { viewModel.disconnect(session.topic) }) {
                                    Icon(Icons.Outlined.LinkOff, contentDescription = "Disconnect ${session.peerName}", tint = colors.error)
                                }
                            }
                        }
                    }
                    VfxtSecondaryButton("Disconnect all", viewModel::disconnectAll, Modifier.fillMaxWidth())
                }
            }
            Spacer(Modifier.height(Spacing.xxl))
        }
    }
}

/**
 * Global host for dApp prompts: the connection request dialog and the signing request dialog.
 * Placed above navigation so requests appear on any screen once the wallet is unlocked.
 */
@Composable
fun WalletConnectPrompts(viewModel: WalletConnectViewModel = hiltViewModel(key = "wc-prompts")) {
    val proposal by viewModel.proposal.collectAsStateWithLifecycle()
    val requests by viewModel.requests.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()

    proposal?.let { ProposalDialog(it, busy, viewModel::approveProposal, viewModel::rejectProposal) }
    if (proposal == null) {
        requests.firstOrNull()?.let { req ->
            RequestDialog(req, busy, onApprove = { viewModel.approveRequest(req) }, onReject = { viewModel.rejectRequest(req) })
        }
    }
}

@Composable
private fun ProposalDialog(p: WcProposal, busy: Boolean, onApprove: () -> Unit, onReject: () -> Unit) {
    val colors = VfxtTheme.colors
    val blocked = p.trust == WcTrust.Scam || p.unsupportedChains.isNotEmpty()
    AlertDialog(
        onDismissRequest = {},
        containerColor = colors.surface,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PeerIcon(p.icon)
                Spacer(Modifier.width(Spacing.md))
                Column {
                    Text(p.name, style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
                    Text(p.url, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                TrustBanner(p.trust)
                Text("wants to connect to your wallet", style = MaterialTheme.typography.bodyMedium, color = colors.textPrimary)
                Text(
                    "It will see your wallet address and balances, and can ask you to sign messages and transactions. " +
                        "It cannot move funds without your approval.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textSecondary,
                )
                if (p.chains.isNotEmpty()) {
                    Text("Networks: ${p.chains.joinToString()}", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                }
                if (p.unsupportedChains.isNotEmpty()) {
                    Text(
                        "This dApp requires networks VFXT Wallet doesn't support (${p.unsupportedChains.joinToString()}).",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.error,
                    )
                }
            }
        },
        confirmButton = {
            if (!blocked) VfxtPrimaryButton("Connect", onApprove, loading = busy, enabled = !busy)
        },
        dismissButton = { VfxtTextButton(if (blocked) "Close" else "Reject", onReject, color = colors.textSecondary) },
    )
}

@Composable
private fun RequestDialog(r: WcRequest, busy: Boolean, onApprove: () -> Unit, onReject: () -> Unit) {
    val colors = VfxtTheme.colors
    var authenticating by remember(r.id) { mutableStateOf(false) }
    val title = when (r.detail) {
        is WcRequestDetail.SendTransaction -> "Confirm transaction"
        is WcRequestDetail.SignTypedData -> "Signature request"
        is WcRequestDetail.SignMessage -> "Sign message"
    }
    AlertDialog(
        onDismissRequest = {},
        containerColor = colors.surface,
        title = { Text(title, color = colors.textPrimary) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    PeerIcon(r.peerIcon, size = 32)
                    Spacer(Modifier.width(Spacing.sm))
                    Column {
                        Text(r.peerName, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                        r.peerUrl?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                    }
                }
                TrustBanner(r.trust)
                DetailLine("Network", r.network.name)
                DetailLine("Wallet", Formatters.shortAddress(r.account))
                when (val d = r.detail) {
                    is WcRequestDetail.SendTransaction -> {
                        DetailLine("To", d.to?.let(Formatters::shortAddress) ?: "—")
                        DetailLine("Amount", d.valueDisplay)
                        if (d.hasData) {
                            Text(
                                "This transaction calls a smart contract. It may move tokens or grant spending approval — only continue if you trust this dApp.",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.warning,
                            )
                            d.dataPreview?.let { MonoBox("$it…") }
                        }
                        Text("Network fee is paid in ${r.network.nativeSymbol}.", style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
                    }
                    is WcRequestDetail.SignTypedData -> {
                        d.domain?.let { DetailLine("App", it) }
                        d.primaryType?.let { DetailLine("Type", it) }
                        if (d.primaryType?.contains("Permit", ignoreCase = true) == true) {
                            Text(
                                "This is a token permit. Signing it lets the dApp spend your tokens without another confirmation.",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.warning,
                            )
                        }
                        MonoBox(d.json.take(1_500))
                    }
                    is WcRequestDetail.SignMessage -> MonoBox(d.message.take(2_000))
                }
            }
        },
        confirmButton = {
            if (r.trust != WcTrust.Scam) {
                VfxtPrimaryButton(
                    if (r.detail is WcRequestDetail.SendTransaction) "Confirm" else "Sign",
                    { authenticating = true },
                    loading = busy,
                    enabled = !busy,
                )
            }
        },
        dismissButton = { VfxtTextButton("Reject", onReject, color = colors.textSecondary) },
    )

    if (authenticating) {
        AuthenticateSheet(
            reason = "Approve request from ${r.peerName}",
            onAuthenticated = {
                authenticating = false
                onApprove()
            },
            onDismiss = { authenticating = false },
        )
    }
}

@Composable
private fun TrustBanner(trust: WcTrust) {
    val colors = VfxtTheme.colors
    when (trust) {
        WcTrust.Verified -> StatusPill("Verified domain", tone = PillTone.Success, showDot = true)
        WcTrust.Unknown -> StatusPill("Unverified domain", tone = PillTone.Warning, showDot = true)
        WcTrust.Mismatch, WcTrust.Scam -> Row(verticalAlignment = Alignment.Top) {
            Icon(Icons.Outlined.WarningAmber, null, tint = colors.error, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(Spacing.sm))
            Text(
                if (trust == WcTrust.Scam) "Known scam site. VFXT Wallet blocked this request."
                else "This site's domain doesn't match what it claims. It may be impersonating another dApp.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.error,
            )
        }
    }
}

@Composable
private fun DetailLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = VfxtTheme.colors.textSecondary, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodySmall, color = VfxtTheme.colors.textPrimary)
    }
}

@Composable
private fun MonoBox(text: String) {
    val colors = VfxtTheme.colors
    Box(
        Modifier
            .fillMaxWidth()
            .heightIn(max = 220.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(colors.card)
            .verticalScroll(rememberScrollState())
            .padding(Spacing.sm),
    ) {
        Text(text, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace, color = colors.textPrimary)
    }
}

@Composable
private fun PeerIcon(url: String?, size: Int = 40) {
    val colors = VfxtTheme.colors
    if (url.isNullOrBlank() || !url.startsWith("https://")) {
        IconTile(Icons.Outlined.Link, colors.accent, size = size.dp)
    } else {
        AsyncImage(
            model = url,
            contentDescription = null,
            modifier = Modifier
                .size(size.dp)
                .clip(RoundedCornerShape(10.dp)),
        )
    }
}
