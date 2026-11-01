package com.vfxt.wallet.ui.transfer

import android.content.ClipData
import android.content.Intent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.common.QrCodes
import com.vfxt.wallet.core.designsystem.components.EmptyState
import com.vfxt.wallet.core.designsystem.components.PillTone
import com.vfxt.wallet.core.designsystem.components.SkeletonListRow
import com.vfxt.wallet.core.designsystem.components.StatusPill
import com.vfxt.wallet.core.designsystem.components.TokenIcon
import com.vfxt.wallet.core.designsystem.components.NetworkIcon
import com.vfxt.wallet.core.common.TokenLogos
import com.vfxt.wallet.core.designsystem.components.VfxtBottomSheet
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtTextButton
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.domain.models.ActivityItem
import com.vfxt.wallet.domain.models.ActivityStatus
import com.vfxt.wallet.domain.models.ActivityType
import com.vfxt.wallet.ui.common.ActivityRow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.util.Date

@Composable
private fun ToolScaffold(title: String, onBack: () -> Unit, content: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxSize()
            .background(VfxtTheme.colors.background)
            .safeDrawingPadding(),
    ) {
        VfxtTopBar(title, onBack)
        content()
    }
}

// --- Receive ---------------------------------------------------------------------------------

@Composable
fun ReceiveScreen(onBack: () -> Unit, viewModel: ReceiveViewModel = hiltViewModel()) {
    val colors = VfxtTheme.colors
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    var copied by remember { mutableStateOf(false) }
    val address = state.account?.address

    val qr by produceState<android.graphics.Bitmap?>(null, address) {
        value = address?.let { withContext(Dispatchers.Default) { QrCodes.render(it, 720) } }
    }

    ToolScaffold("Receive", onBack) {
        Column(
            Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            state.network?.let { network ->
                StatusPill(network.name, tone = if (network.isTestnet) PillTone.Warning else PillTone.Primary, showDot = true)
            }
            Spacer(Modifier.height(Spacing.xl))
            Box(
                Modifier
                    .size(260.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color.White)
                    .padding(Spacing.md),
                contentAlignment = Alignment.Center,
            ) {
                qr?.let { Image(it.asImageBitmap(), contentDescription = "QR code for your wallet address", modifier = Modifier.fillMaxSize()) }
                    ?: CircularProgressIndicator(color = colors.primary)
            }
            Spacer(Modifier.height(Spacing.xl))
            Text(state.account?.name.orEmpty(), style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
            Spacer(Modifier.height(Spacing.xs))
            Text(address.orEmpty(), style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary, textAlign = TextAlign.Center)
            Spacer(Modifier.height(Spacing.xl))
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
                VfxtSecondaryButton(
                    if (copied) "Copied" else "Copy",
                    {
                        address ?: return@VfxtSecondaryButton
                        scope.launch { clipboard.setClipEntry(ClipEntry(ClipData.newPlainText("Wallet address", address))) }
                        copied = true
                    },
                    Modifier.weight(1f),
                    icon = if (copied) Icons.Filled.CheckCircle else Icons.Outlined.ContentCopy,
                )
                VfxtSecondaryButton(
                    "Share",
                    {
                        address ?: return@VfxtSecondaryButton
                        val send = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, address)
                        }
                        context.startActivity(Intent.createChooser(send, "Share wallet address"))
                    },
                    Modifier.weight(1f),
                    icon = Icons.Outlined.Share,
                )
            }
            Spacer(Modifier.height(Spacing.xl))
            if (state.network?.isTestnet == true) {
                VfxtCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.Top) {
                        Icon(Icons.Outlined.WarningAmber, null, tint = colors.warning, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(Spacing.md))
                        Text(
                            "Test network selected. Do not deposit real funds here — switch to BNB Smart Chain (or another mainnet) first.",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textPrimary,
                        )
                    }
                }
                Spacer(Modifier.height(Spacing.md))
            }
            VfxtCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.Top) {
                    Icon(Icons.Outlined.WarningAmber, null, tint = colors.warning, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(Spacing.md))
                    Column {
                        Text(
                            "Only send ${state.network?.nativeSymbol ?: "BNB"} and tokens on ${state.network?.name ?: "BNB Smart Chain"} to this address. " +
                                "Assets sent from the wrong network (e.g. Ethereum, Tron) may be lost forever.",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textSecondary,
                        )
                        Spacer(Modifier.height(Spacing.sm))
                        Text(
                            "This is a self-custody wallet. Deposits are irreversible. Back up your recovery phrase before sending large amounts.",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textSecondary,
                        )
                    }
                }
                if (state.tokens.isNotEmpty()) {
                    Spacer(Modifier.height(Spacing.md))
                    Text(
                        "Supported here: ${state.tokens.joinToString { it.symbol }}",
                        style = MaterialTheme.typography.labelMedium,
                        color = colors.textMuted,
                    )
                }
            }
            Spacer(Modifier.height(Spacing.xl))
        }
    }
}

// --- Activity / transaction history ----------------------------------------------------------

@Composable
fun ActivityScreen(onBack: () -> Unit, viewModel: ActivityViewModel = hiltViewModel()) {
    val colors = VfxtTheme.colors
    val state by viewModel.state.collectAsStateWithLifecycle()
    val uri = LocalUriHandler.current
    var filter by remember { mutableStateOf(0) }
    var selected by remember { mutableStateOf<ActivityItem?>(null) }
    val filters = listOf("All", "Received", "Sent", "Pending", "Failed")
    val shown = state.items.filter {
        when (filter) {
            1 -> it.type == ActivityType.Received
            2 -> it.type == ActivityType.Sent
            3 -> it.status == ActivityStatus.Pending
            4 -> it.status == ActivityStatus.Failed
            else -> true
        }
    }

    ToolScaffold("Transactions", onBack) {
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen, vertical = Spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            filters.forEachIndexed { i, label ->
                com.vfxt.wallet.core.designsystem.components.VfxtChip(label, selected = filter == i, onClick = { filter = i })
            }
        }
        PullToRefreshBox(isRefreshing = state.loading && state.items.isNotEmpty(), onRefresh = viewModel::refresh, modifier = Modifier.fillMaxSize()) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = Spacing.screen, vertical = Spacing.sm)) {
                if (!state.explorerConfigured) {
                    item {
                        VfxtCard(Modifier.fillMaxWidth().padding(bottom = Spacing.md)) {
                            Row(verticalAlignment = Alignment.Top) {
                                Icon(Icons.Outlined.Info, null, tint = colors.primary, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(Spacing.sm))
                                Column {
                                    Text(
                                        "Showing transfers sent from this app. Incoming transfers are visible on the explorer.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = colors.textSecondary,
                                    )
                                    val network = state.network
                                    val address = state.address
                                    if (network != null && address != null) {
                                        Text(
                                            "Open full history on BscScan",
                                            style = MaterialTheme.typography.labelLarge,
                                            color = colors.primary,
                                            modifier = Modifier
                                                .padding(top = Spacing.xs)
                                                .clickable(role = Role.Button) { uri.openUri(network.explorerAddressUrl(address)) },
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                when {
                    state.loading && state.items.isEmpty() -> items(4) { SkeletonListRow() }
                    shown.isEmpty() -> item {
                        EmptyState(
                            icon = Icons.AutoMirrored.Outlined.ReceiptLong,
                            title = "No transactions",
                            message = if (filter == 0) "Transfers you make will appear here." else "Nothing matches this filter.",
                        )
                    }
                    else -> items(shown, key = { it.id }) { item ->
                        VfxtCard(Modifier.fillMaxWidth().padding(bottom = Spacing.sm), contentPadding = PaddingValues(Spacing.xs)) {
                            ActivityRow(item, onClick = { selected = item })
                        }
                    }
                }
            }
        }
    }

    selected?.let { item -> TransactionDetailsSheet(item, state.network, onDismiss = { selected = null }) }
}

@Composable
fun TransactionDetailsSheet(item: ActivityItem, network: com.vfxt.wallet.blockchain.networks.EvmNetwork?, onDismiss: () -> Unit) {
    val colors = VfxtTheme.colors
    val uri = LocalUriHandler.current
    VfxtBottomSheet(onDismiss) {
        Text(
            when (item.type) {
                ActivityType.Received -> "Received ${item.tokenSymbol}"
                ActivityType.Swap -> "Swap ${item.tokenSymbol} → ${item.toSymbol ?: "?"}"
                ActivityType.Approval -> "Approve ${item.tokenSymbol}"
                else -> "Sent ${item.tokenSymbol}"
            },
            style = MaterialTheme.typography.headlineSmall,
            color = colors.textPrimary,
        )
        Spacer(Modifier.height(Spacing.xs))
        StatusPill(
            item.status.name,
            tone = when (item.status) {
                ActivityStatus.Confirmed -> PillTone.Success
                ActivityStatus.Failed -> PillTone.Error
                ActivityStatus.Pending -> PillTone.Warning
            },
            showDot = true,
        )
        Spacer(Modifier.height(Spacing.lg))
        DetailRow(if (item.type == ActivityType.Swap) "You paid" else "Amount", "${Formatters.tokenAmount(item.amount, 8)} ${item.tokenSymbol}")
        if (item.type == ActivityType.Swap && item.toSymbol != null) {
            DetailRow("You receive (minimum)", "${item.toAmount?.let { Formatters.tokenAmount(it, 8) } ?: "—"} ${item.toSymbol}")
        }
        item.counterparty?.let {
            DetailRow(
                when (item.type) {
                    ActivityType.Received -> "From"
                    ActivityType.Swap, ActivityType.Approval -> "Swap contract"
                    else -> "To"
                },
                it,
            )
        }
        item.fee?.let { DetailRow("Network fee", "${Formatters.tokenAmount(it, 8)} ${network?.nativeSymbol ?: ""}") }
        DetailRow("Date", DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(item.timestampMillis)))
        network?.let { DetailRow("Network", it.name) }
        item.txHash?.let { DetailRow("Transaction hash", it) }
        Spacer(Modifier.height(Spacing.lg))
        if (item.txHash != null && network != null) {
            VfxtPrimaryButton("View on explorer", { uri.openUri(network.explorerTxUrl(item.txHash)) }, Modifier.fillMaxWidth(), icon = Icons.AutoMirrored.Filled.OpenInNew)
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = Spacing.sm)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = VfxtTheme.colors.textSecondary)
        Text(value, style = MaterialTheme.typography.bodyMedium, color = VfxtTheme.colors.textPrimary)
    }
    HorizontalDivider(color = VfxtTheme.colors.border.copy(alpha = 0.5f))
}

// --- Token details ---------------------------------------------------------------------------

@Composable
fun TokenDetailsScreen(
    onBack: () -> Unit,
    onSend: (String) -> Unit,
    onReceive: () -> Unit,
    onSwap: (String) -> Unit = {},
    viewModel: TokenDetailsViewModel = hiltViewModel(),
) {
    val colors = VfxtTheme.colors
    val state by viewModel.state.collectAsStateWithLifecycle()
    val uri = LocalUriHandler.current
    val holding = state.holding
    ToolScaffold(holding?.token?.symbol ?: "Token", onBack) {
        if (state.loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = colors.primary) }
            return@ToolScaffold
        }
        if (holding == null) {
            EmptyState(Icons.Outlined.Info, "Token not found", "It may have been hidden or belongs to another network.")
            return@ToolScaffold
        }
        val token = holding.token
        Column(
            Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(Spacing.lg))
            TokenIcon(token.symbol, size = 72.dp, logoUrl = token.logoUrl)
            Spacer(Modifier.height(Spacing.md))
            Text(
                holding.rawBalance?.let { "${Formatters.tokenAmount(it, token.decimals, 8)} ${token.symbol}" } ?: "Balance unavailable",
                style = MaterialTheme.typography.displaySmall,
                color = colors.textPrimary,
                textAlign = TextAlign.Center,
            )
            holding.fiatValue?.let { Text(Formatters.fiat(it), style = MaterialTheme.typography.titleMedium, color = colors.textSecondary) }
            Spacer(Modifier.height(Spacing.xl))
            if (token.isAvailable) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
                    VfxtPrimaryButton("Send", { onSend(token.key) }, Modifier.weight(1f))
                    VfxtSecondaryButton("Receive", onReceive, Modifier.weight(1f))
                }
                // Swaps run through LI.FI on supported mainnets only.
                if (state.network?.let { !it.isTestnet && !it.isCustom } == true) {
                    Spacer(Modifier.height(Spacing.md))
                    VfxtSecondaryButton("Swap ${token.symbol}", { onSwap(token.key) }, Modifier.fillMaxWidth())
                }
                Spacer(Modifier.height(Spacing.xl))
            }
            VfxtCard(Modifier.fillMaxWidth()) {
                DetailRow("Name", token.name)
                DetailRow("Symbol", token.symbol)
                DetailRow("Decimals", token.decimals.toString())
                DetailRow("Network", state.network?.name.orEmpty())
                DetailRow("Type", if (token.contractAddress == null && token.kind.name == "Native") "Native coin" else "BEP-20 token")
                holding.unitPrice?.let { price ->
                    val change = holding.change24hPercent?.let { " · ${Formatters.percent(it)}" }.orEmpty()
                    DetailRow("Live price", "${Formatters.unitPrice(price)}$change")
                }
                if (token.kind.name == "Bep20") {
                    DetailRow("Contract address", token.contractAddress ?: "Not deployed yet")
                }
            }
            Spacer(Modifier.height(Spacing.lg))
            val network = state.network
            if (token.contractAddress != null && network != null) {
                VfxtSecondaryButton("View contract on explorer", { uri.openUri(network.explorerTokenUrl(token.contractAddress)) }, Modifier.fillMaxWidth(), icon = Icons.AutoMirrored.Filled.OpenInNew)
                Spacer(Modifier.height(Spacing.sm))
            }
            if (token.kind.name != "Native") {
                VfxtSecondaryButton(
                    if (token.isCustom) "Remove token" else "Hide token",
                    { viewModel.hide(onBack) },
                    Modifier.fillMaxWidth(),
                    icon = Icons.Outlined.VisibilityOff,
                )
            }
            Spacer(Modifier.height(Spacing.xl))
        }
    }
}

// --- Add custom token ------------------------------------------------------------------------

@Composable
fun AddTokenScreen(onBack: () -> Unit, viewModel: AddTokenViewModel = hiltViewModel()) {
    val colors = VfxtTheme.colors
    val state by viewModel.state.collectAsStateWithLifecycle()
    ToolScaffold("Add custom token", onBack) {
        Column(Modifier.fillMaxSize()) {
            Column(
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.screen),
                verticalArrangement = Arrangement.spacedBy(Spacing.md),
            ) {
                state.network?.let { StatusPill(it.name, tone = if (it.isTestnet) PillTone.Warning else PillTone.Primary, showDot = true) }
                Text(
                    "Paste the token's contract address. Name, symbol and decimals are read directly from the blockchain.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textSecondary,
                )
                OutlinedTextField(
                    value = state.address,
                    onValueChange = viewModel::onAddressChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Contract address") },
                    placeholder = { Text("0x…", color = colors.textMuted) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(autoCorrectEnabled = false),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = colors.primary,
                        unfocusedBorderColor = colors.border,
                        focusedContainerColor = colors.card,
                        unfocusedContainerColor = colors.card,
                        cursorColor = colors.primary,
                        focusedTextColor = colors.textPrimary,
                        unfocusedTextColor = colors.textPrimary,
                        focusedLabelColor = colors.primary,
                        unfocusedLabelColor = colors.textSecondary,
                    ),
                )
                if (state.checking) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(color = colors.primary, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(Spacing.sm))
                        Text("Checking contract on-chain…", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                    }
                }
                state.error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = colors.error) }
                state.preview?.let { token ->
                    VfxtCard(Modifier.fillMaxWidth()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            TokenIcon(token.symbol, size = 40.dp, logoUrl = TokenLogos.token(token.networkId, token.contract))
                            Spacer(Modifier.width(Spacing.md))
                            Column {
                                Text(token.symbol, style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
                                Text(token.name, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                            }
                        }
                        Spacer(Modifier.height(Spacing.md))
                        Text("Decimals: ${token.decimals}", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                    }
                    Row(verticalAlignment = Alignment.Top) {
                        Icon(Icons.Outlined.WarningAmber, null, tint = colors.warning, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(Spacing.sm))
                        Text(
                            "Anyone can create a token with any name, including fake copies of popular tokens. Only add tokens you trust.",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textSecondary,
                        )
                    }
                }
            }
            VfxtPrimaryButton(
                "Add token",
                { viewModel.add(onBack) },
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
                enabled = state.preview != null,
            )
        }
    }
}

// --- Network selection -----------------------------------------------------------------------

@Composable
fun NetworkScreen(onBack: () -> Unit, viewModel: NetworkViewModel = hiltViewModel()) {
    val colors = VfxtTheme.colors
    val state by viewModel.state.collectAsStateWithLifecycle()
    val mainnets = state.networks.filter { !it.isTestnet && !it.isCustom }
    val testnets = state.networks.filter { it.isTestnet && !it.isCustom }
    val custom = state.networks.filter { it.isCustom }

    ToolScaffold("Network", onBack) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen)
                .padding(bottom = Spacing.xxl),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            Text(
                "Switch networks for balances and transfers. Custom RPCs are verified on-device before saving.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSecondary,
            )
            VfxtSecondaryButton("Add custom network", viewModel::openAdd, Modifier.fillMaxWidth())

            if (mainnets.isNotEmpty()) {
                Text("Mainnets", style = MaterialTheme.typography.labelLarge, color = colors.textMuted)
                mainnets.forEach { network ->
                    NetworkRow(
                        network = network,
                        selected = network.id == state.active?.id,
                        onSelect = { viewModel.select(network) },
                    )
                }
            }
            if (custom.isNotEmpty()) {
                Text("Custom", style = MaterialTheme.typography.labelLarge, color = colors.textMuted)
                custom.forEach { network ->
                    NetworkRow(
                        network = network,
                        selected = network.id == state.active?.id,
                        onSelect = { viewModel.select(network) },
                        onRemove = { viewModel.removeCustom(network) },
                    )
                }
            }
            if (testnets.isNotEmpty()) {
                Text("Testnets", style = MaterialTheme.typography.labelLarge, color = colors.textMuted)
                testnets.forEach { network ->
                    NetworkRow(
                        network = network,
                        selected = network.id == state.active?.id,
                        onSelect = { viewModel.select(network) },
                    )
                }
                Text(
                    "Testnet tokens have no real market value. Use them only for practice transfers.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
        }
    }

    if (state.showAdd) {
        AddCustomNetworkSheet(
            state = state,
            onDismiss = viewModel::closeAdd,
            onName = viewModel::onName,
            onRpc = viewModel::onRpc,
            onChainId = viewModel::onChainId,
            onSymbol = viewModel::onSymbol,
            onExplorer = viewModel::onExplorer,
            onSave = viewModel::saveCustom,
        )
    }
}

@Composable
private fun NetworkRow(
    network: com.vfxt.wallet.blockchain.networks.EvmNetwork,
    selected: Boolean,
    onSelect: () -> Unit,
    onRemove: (() -> Unit)? = null,
) {
    val colors = VfxtTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(if (selected) colors.primary.copy(alpha = 0.10f) else colors.card)
            .border(1.dp, if (selected) colors.primary else colors.border, RoundedCornerShape(18.dp))
            .clickable(role = Role.RadioButton, onClick = onSelect)
            .padding(Spacing.lg),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        NetworkIcon(network, size = 40.dp)
        Spacer(Modifier.width(Spacing.md))
        Column(Modifier.weight(1f)) {
            Text(network.name, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
            Text(
                "Chain ID ${network.chainId} · ${network.nativeSymbol}",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSecondary,
            )
        }
        when {
            network.isTestnet -> StatusPill("Test", tone = PillTone.Warning)
            network.isCustom -> StatusPill("Custom", tone = PillTone.Neutral)
        }
        if (selected) {
            Spacer(Modifier.width(Spacing.sm))
            Icon(Icons.Filled.CheckCircle, contentDescription = "Selected", tint = colors.primary)
        }
        if (onRemove != null) {
            Spacer(Modifier.width(Spacing.sm))
            VfxtTextButton("Remove", onRemove)
        }
    }
}

@Composable
private fun AddCustomNetworkSheet(
    state: NetworkUiState,
    onDismiss: () -> Unit,
    onName: (String) -> Unit,
    onRpc: (String) -> Unit,
    onChainId: (String) -> Unit,
    onSymbol: (String) -> Unit,
    onExplorer: (String) -> Unit,
    onSave: () -> Unit,
) {
    val colors = VfxtTheme.colors
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = colors.primary,
        unfocusedBorderColor = colors.border,
        focusedTextColor = colors.textPrimary,
        unfocusedTextColor = colors.textPrimary,
        cursorColor = colors.primary,
    )
    VfxtBottomSheet(onDismiss) {
        Text("Add custom network", style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
        Spacer(Modifier.height(Spacing.sm))
        Text(
            "Paste an HTTPS RPC URL and chain ID from the network docs. We verify the RPC before saving.",
            style = MaterialTheme.typography.bodySmall,
            color = colors.textSecondary,
        )
        Spacer(Modifier.height(Spacing.lg))
        OutlinedTextField(
            value = state.name,
            onValueChange = onName,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Network name") },
            placeholder = { Text("My Chain") },
            colors = fieldColors,
        )
        Spacer(Modifier.height(Spacing.sm))
        OutlinedTextField(
            value = state.rpcUrl,
            onValueChange = onRpc,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("RPC URL") },
            placeholder = { Text("https://…") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            colors = fieldColors,
        )
        Spacer(Modifier.height(Spacing.sm))
        OutlinedTextField(
            value = state.chainId,
            onValueChange = onChainId,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Chain ID") },
            placeholder = { Text("56") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            colors = fieldColors,
        )
        Spacer(Modifier.height(Spacing.sm))
        OutlinedTextField(
            value = state.symbol,
            onValueChange = onSymbol,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Currency symbol") },
            placeholder = { Text("ETH") },
            colors = fieldColors,
        )
        Spacer(Modifier.height(Spacing.sm))
        OutlinedTextField(
            value = state.explorerUrl,
            onValueChange = onExplorer,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Block explorer URL (optional)") },
            placeholder = { Text("https://…") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            colors = fieldColors,
        )
        state.error?.let {
            Spacer(Modifier.height(Spacing.sm))
            Text(it, style = MaterialTheme.typography.bodySmall, color = colors.error)
        }
        Spacer(Modifier.height(Spacing.lg))
        if (state.verifying || state.saving) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = colors.primary, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
            }
        } else {
            VfxtPrimaryButton("Verify & save", onSave, Modifier.fillMaxWidth())
        }
    }
}
