package com.vfxt.wallet.ui.transfer

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.CallMade
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ContentPaste
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vfxt.wallet.blockchain.transactions.TransactionService
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.common.QrCodes
import com.vfxt.wallet.core.designsystem.components.IconTile
import com.vfxt.wallet.core.designsystem.components.StatusPill
import com.vfxt.wallet.core.designsystem.components.TokenIcon
import com.vfxt.wallet.core.designsystem.components.VfxtBottomSheet
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtTextButton
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.components.PillTone
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.domain.models.TokenInfo
import com.vfxt.wallet.ui.security.AuthenticateSheet
import kotlinx.coroutines.launch

@Composable
fun SendScreen(
    onBack: () -> Unit,
    onDone: () -> Unit,
    viewModel: SendViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var authenticating by remember { mutableStateOf(false) }

    // While broadcasting, don't let Back abandon the flow halfway.
    BackHandler(enabled = state.stage != SendStage.Edit) {
        when (state.stage) {
            SendStage.Review -> viewModel.backToEdit()
            SendStage.Done -> onDone()
            else -> Unit
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(VfxtTheme.colors.background)
            .safeDrawingPadding()
            .imePadding(),
    ) {
        VfxtTopBar(
            title = when (state.stage) {
                SendStage.Edit -> "Send"
                SendStage.Review -> "Review transfer"
                SendStage.Broadcasting -> "Sending"
                SendStage.Done -> "Transfer submitted"
            },
            onBack = {
                when (state.stage) {
                    SendStage.Edit -> onBack()
                    SendStage.Review -> viewModel.backToEdit()
                    SendStage.Done -> onDone()
                    SendStage.Broadcasting -> Unit
                }
            },
        )
        AnimatedContent(targetState = state.stage, label = "sendStage", modifier = Modifier.weight(1f)) { stage ->
            when (stage) {
                SendStage.Edit -> EditStep(state, viewModel)
                SendStage.Review -> ReviewStep(state, onConfirm = { authenticating = true })
                SendStage.Broadcasting -> BroadcastingStep()
                SendStage.Done -> DoneStep(state, onDone)
            }
        }
    }

    if (authenticating) {
        AuthenticateSheet(
            reason = "Approve sending ${state.quote?.amount?.let { Formatters.tokenAmount(it) }} ${state.token?.symbol}",
            onAuthenticated = {
                authenticating = false
                viewModel.confirmAndSend()
            },
            onDismiss = { authenticating = false },
        )
    }
}

@Composable
private fun EditStep(state: SendUiState, viewModel: SendViewModel) {
    val colors = VfxtTheme.colors
    val context = LocalContext.current
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current
    var pickToken by remember { mutableStateOf(false) }
    var scanError by remember { mutableStateOf<String?>(null) }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = colors.primary,
        unfocusedBorderColor = colors.border,
        focusedContainerColor = colors.card,
        unfocusedContainerColor = colors.card,
        cursorColor = colors.primary,
        focusedTextColor = colors.textPrimary,
        unfocusedTextColor = colors.textPrimary,
    )

    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
        ) {
            state.network?.let { network ->
                StatusPill(
                    if (network.isTestnet) "${network.name} · test funds only" else network.name,
                    tone = if (network.isTestnet) PillTone.Warning else PillTone.Primary,
                    showDot = true,
                )
            }

            Label("Asset")
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(colors.card)
                    .border(1.dp, colors.border, RoundedCornerShape(16.dp))
                    .clickable(role = Role.Button) { pickToken = true }
                    .padding(Spacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                state.token?.let { TokenIcon(it.symbol, size = 36.dp) }
                Spacer(Modifier.width(Spacing.md))
                Column(Modifier.weight(1f)) {
                    Text(state.token?.symbol ?: "Select", style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                    Text(
                        state.balanceText?.let { "Balance: ${Formatters.tokenAmount(it.toBigDecimal())}" } ?: "Loading balance…",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textSecondary,
                    )
                }
                Icon(Icons.Filled.KeyboardArrowDown, contentDescription = "Change asset", tint = colors.textSecondary)
            }

            Label("Recipient address")
            OutlinedTextField(
                value = state.recipient,
                onValueChange = viewModel::onRecipientChange,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("0x…", color = colors.textMuted) },
                singleLine = true,
                isError = state.recipient.isNotEmpty() && !state.recipientValid,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii, autoCorrectEnabled = false),
                trailingIcon = {
                    Row {
                        IconButton(onClick = {
                            scope.launch {
                                val text = clipboard.getClipEntry()?.clipData?.getItemAt(0)?.text?.toString()
                                text?.let { QrCodes.extractAddress(it) ?: it.trim() }?.let(viewModel::onRecipientChange)
                            }
                        }) { Icon(Icons.Outlined.ContentPaste, contentDescription = "Paste address", tint = colors.textSecondary) }
                        IconButton(onClick = {
                            QrCodes.scan(context) { raw ->
                                val address = raw?.let(QrCodes::extractAddress)
                                if (address != null) viewModel.onRecipientChange(address)
                                else if (raw != null) scanError = "That QR code doesn't contain a valid address."
                            }
                        }) { Icon(Icons.Outlined.QrCodeScanner, contentDescription = "Scan QR code", tint = colors.textSecondary) }
                    }
                },
                shape = RoundedCornerShape(16.dp),
                colors = fieldColors,
            )
            if (state.recipient.isNotEmpty() && !state.recipientValid) {
                Hint("Not a valid address. Addresses start with 0x and have 42 characters.", colors.error)
            }
            state.recipientWarning?.let { Hint(it, colors.warning) }
            scanError?.let { Hint(it, colors.error) }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Label("Amount", Modifier.weight(1f))
                VfxtTextButton("Max", viewModel::useMax)
            }
            OutlinedTextField(
                value = state.amountInput,
                onValueChange = viewModel::onAmountChange,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("0.0", color = colors.textMuted) },
                singleLine = true,
                suffix = { Text(state.token?.symbol.orEmpty(), color = colors.textSecondary) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                shape = RoundedCornerShape(16.dp),
                colors = fieldColors,
            )
        }
        state.error?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, color = colors.error, modifier = Modifier.padding(horizontal = Spacing.screen, vertical = Spacing.xs))
        }
        VfxtPrimaryButton(
            "Review",
            onClick = {
                focus.clearFocus()
                viewModel.review()
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
            enabled = state.token != null && state.recipient.isNotBlank() && state.amountInput.isNotBlank(),
            loading = state.quoting,
        )
    }

    if (pickToken) {
        TokenPickerSheet(state.tokens, onPick = { viewModel.selectToken(it); pickToken = false }, onDismiss = { pickToken = false })
    }
}

@Composable
private fun ReviewStep(state: SendUiState, onConfirm: () -> Unit) {
    val colors = VfxtTheme.colors
    val quote = state.quote ?: return
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(Spacing.lg))
            TokenIcon(quote.token.symbol, size = 64.dp)
            Spacer(Modifier.height(Spacing.md))
            Text(
                "${Formatters.tokenAmount(quote.amount, 8)} ${quote.token.symbol}",
                style = MaterialTheme.typography.displaySmall,
                color = colors.textPrimary,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(Spacing.xl))
            VfxtCard(Modifier.fillMaxWidth()) {
                ReviewRow("From", Formatters.shortAddress(quote.from))
                ReviewDivider()
                Column(Modifier.padding(vertical = Spacing.sm)) {
                    Text("To", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
                    Spacer(Modifier.height(2.dp))
                    // Full address on review so the user can compare every character.
                    Text(quote.recipient, style = MaterialTheme.typography.bodyMedium, color = colors.textPrimary)
                }
                ReviewDivider()
                ReviewRow("Network", quote.network.name)
                ReviewDivider()
                ReviewRow("Network fee", "${Formatters.tokenAmount(quote.fee, 8)} ${quote.network.nativeSymbol}")
                ReviewDivider()
                ReviewRow(
                    "Total",
                    if (quote.token.contractAddress == null) {
                        "${Formatters.tokenAmount(quote.amount + quote.fee, 8)} ${quote.network.nativeSymbol}"
                    } else {
                        "${Formatters.tokenAmount(quote.amount, 8)} ${quote.token.symbol} + fee"
                    },
                    emphasize = true,
                )
            }
            Spacer(Modifier.height(Spacing.lg))
            Row(verticalAlignment = Alignment.Top) {
                Icon(Icons.Outlined.WarningAmber, null, tint = colors.warning, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(Spacing.sm))
                Text(
                    "Blockchain transfers can't be reversed. Check the address and network carefully.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textSecondary,
                )
            }
            state.error?.let {
                Spacer(Modifier.height(Spacing.md))
                Text(it, style = MaterialTheme.typography.bodyMedium, color = colors.error)
            }
        }
        VfxtPrimaryButton(
            "Confirm & send",
            onConfirm,
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
            icon = Icons.AutoMirrored.Filled.CallMade,
        )
    }
}

@Composable
private fun BroadcastingStep() {
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        CircularProgressIndicator(color = VfxtTheme.colors.primary, modifier = Modifier.size(56.dp))
        Spacer(Modifier.height(Spacing.xl))
        Text("Signing and broadcasting…", style = MaterialTheme.typography.titleMedium, color = VfxtTheme.colors.textPrimary)
        Text("Your key never leaves this device.", style = MaterialTheme.typography.bodySmall, color = VfxtTheme.colors.textSecondary)
    }
}

@Composable
private fun DoneStep(state: SendUiState, onDone: () -> Unit) {
    val colors = VfxtTheme.colors
    val uri = LocalUriHandler.current
    val (icon, tint, title, message) = when (state.txStatus) {
        TransactionService.STATUS_CONFIRMED -> Quad(Icons.Outlined.CheckCircle, colors.success, "Transfer confirmed", "The transaction was included in a block.")
        TransactionService.STATUS_FAILED -> Quad(Icons.Outlined.ErrorOutline, colors.error, "Transfer failed", "The transaction was mined but reverted. The network fee was still charged.")
        else -> Quad(Icons.Outlined.Schedule, colors.warning, "Waiting for confirmation", "Broadcast to the network. This usually takes a few seconds on BNB Smart Chain.")
    }
    Column(
        Modifier
            .fillMaxSize()
            .padding(horizontal = Spacing.screen),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(1f))
        Box(contentAlignment = Alignment.Center) {
            IconTile(icon, tint, size = 96.dp)
            if (state.txStatus == TransactionService.STATUS_PENDING) {
                CircularProgressIndicator(color = tint, strokeWidth = 2.dp, modifier = Modifier.size(110.dp))
            }
        }
        Spacer(Modifier.height(Spacing.xl))
        Text(title, style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
        Spacer(Modifier.height(Spacing.xs))
        Text(message, style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(Spacing.xl))
        state.txHash?.let { hash ->
            VfxtCard(Modifier.fillMaxWidth()) {
                Text("Transaction hash", style = MaterialTheme.typography.labelMedium, color = colors.textSecondary)
                Spacer(Modifier.height(2.dp))
                Text(hash, style = MaterialTheme.typography.bodySmall, color = colors.textPrimary)
            }
            Spacer(Modifier.height(Spacing.md))
            state.network?.let { network ->
                VfxtSecondaryButton(
                    "View on ${if (network.isTestnet) "BscScan Testnet" else "BscScan"}",
                    { uri.openUri(network.explorerTxUrl(hash)) },
                    Modifier.fillMaxWidth(),
                    icon = Icons.AutoMirrored.Filled.OpenInNew,
                )
            }
        }
        Spacer(Modifier.weight(1f))
        VfxtPrimaryButton("Done", onDone, Modifier.fillMaxWidth().padding(vertical = Spacing.lg))
    }
}

private data class Quad(val icon: androidx.compose.ui.graphics.vector.ImageVector, val tint: Color, val title: String, val message: String)

@Composable
private fun TokenPickerSheet(tokens: List<TokenInfo>, onPick: (TokenInfo) -> Unit, onDismiss: () -> Unit) {
    val colors = VfxtTheme.colors
    VfxtBottomSheet(onDismiss) {
        Text("Select asset", style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
        Spacer(Modifier.height(Spacing.md))
        tokens.forEach { token ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(role = Role.Button) { onPick(token) }
                    .padding(vertical = Spacing.md, horizontal = Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TokenIcon(token.symbol, size = 36.dp)
                Spacer(Modifier.width(Spacing.md))
                Column {
                    Text(token.symbol, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                    Text(token.name, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                }
            }
        }
    }
}

@Composable
private fun Label(text: String, modifier: Modifier = Modifier) =
    Text(text, style = MaterialTheme.typography.titleSmall, color = VfxtTheme.colors.textPrimary, modifier = modifier)

@Composable
private fun Hint(text: String, color: Color) =
    Text(text, style = MaterialTheme.typography.bodySmall, color = color)

@Composable
private fun ReviewRow(label: String, value: String, emphasize: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(vertical = Spacing.sm), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = VfxtTheme.colors.textSecondary, modifier = Modifier.weight(1f))
        Text(
            value,
            style = if (emphasize) MaterialTheme.typography.titleSmall else MaterialTheme.typography.bodyMedium,
            color = VfxtTheme.colors.textPrimary,
            textAlign = TextAlign.End,
        )
    }
}

@Composable
private fun ReviewDivider() = HorizontalDivider(color = VfxtTheme.colors.border.copy(alpha = 0.6f))
