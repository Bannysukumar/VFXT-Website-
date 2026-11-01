package com.vfxt.wallet.ui.swap

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SwapVert
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.swap.SwapGuard
import com.vfxt.wallet.blockchain.swap.SwapProgress
import com.vfxt.wallet.blockchain.swap.SwapToken
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.designsystem.components.IconTile
import com.vfxt.wallet.core.designsystem.components.PillTone
import com.vfxt.wallet.core.designsystem.components.StatusPill
import com.vfxt.wallet.core.designsystem.components.TokenIcon
import com.vfxt.wallet.core.designsystem.components.NetworkIcon
import com.vfxt.wallet.core.designsystem.components.VfxtBottomSheet
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtChip
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.theme.AmountTextStyle
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.ui.security.AuthenticateSheet
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode

@Composable
fun SwapScreen(
    onBack: () -> Unit,
    onActivity: () -> Unit,
    viewModel: SwapViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var authenticating by remember { mutableStateOf(false) }

    BackHandler(enabled = state.stage != SwapStage.Edit) {
        when (state.stage) {
            SwapStage.Review -> viewModel.backToEdit()
            SwapStage.Finished -> onBack()
            else -> Unit // Never abandon a swap mid-execution.
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
                SwapStage.Edit -> "Swap"
                SwapStage.Review -> "Review swap"
                SwapStage.Executing -> "Swapping"
                SwapStage.Finished -> if (state.progress is SwapProgress.Done) "Swap complete" else "Swap result"
            },
            onBack = {
                when (state.stage) {
                    SwapStage.Edit, SwapStage.Finished -> onBack()
                    SwapStage.Review -> viewModel.backToEdit()
                    SwapStage.Executing -> Unit
                }
            },
        )
        if (state.loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = VfxtTheme.colors.primary) }
            return@Column
        }
        AnimatedContent(targetState = state.stage, label = "swapStage", modifier = Modifier.weight(1f)) { stage ->
            when (stage) {
                SwapStage.Edit -> EditStep(state, viewModel)
                SwapStage.Review -> ReviewStep(state, viewModel, onConfirm = { authenticating = true })
                SwapStage.Executing -> ExecutingStep(state)
                SwapStage.Finished -> FinishedStep(state, onDone = onBack, onActivity = onActivity)
            }
        }
    }

    if (authenticating) {
        val p = state.preview
        AuthenticateSheet(
            reason = "Approve swapping ${p?.quote?.fromAmountDecimal?.let { Formatters.tokenAmount(it) }} ${p?.quote?.fromToken?.symbol} for ${p?.quote?.toToken?.symbol}",
            onAuthenticated = {
                authenticating = false
                viewModel.confirmAndExecute()
            },
            onDismiss = { authenticating = false },
        )
    }
}

// --- Edit -----------------------------------------------------------------------------------

@Composable
private fun EditStep(state: SwapUiState, viewModel: SwapViewModel) {
    val colors = VfxtTheme.colors
    val focus = LocalFocusManager.current
    var picker by remember { mutableStateOf<SwapSide?>(null) }
    var networkPicker by remember { mutableStateOf<SwapSide?>(null) }
    var slippageSheet by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
        ) {
            if (state.activeNetworkIsTestnet) {
                Banner(
                    "Swaps run on mainnet networks with real funds. Your active network is a testnet, so a mainnet network is selected here.",
                    colors.warning,
                )
                Spacer(Modifier.height(Spacing.md))
            }

            Box {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                    // From
                    SwapCard(
                        label = "You pay",
                        network = state.fromNetwork,
                        token = state.fromToken,
                        balance = state.fromBalance,
                        onNetwork = { networkPicker = SwapSide.From },
                        onToken = { picker = SwapSide.From },
                    ) {
                        AmountInput(state.amountInput, viewModel::onAmountChange)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                state.estimate?.fromAmountUsd?.let { "≈ ${Formatters.fiat(it)}" } ?: " ",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.textSecondary,
                                modifier = Modifier.weight(1f),
                            )
                            listOf(25, 50, 100).forEach { pct ->
                                Text(
                                    if (pct == 100) "MAX" else "$pct%",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = colors.primary,
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .clickable(enabled = state.fromBalance != null, role = Role.Button) { viewModel.setPercentOfBalance(pct) }
                                        .padding(horizontal = 8.dp, vertical = 4.dp),
                                )
                            }
                        }
                    }
                    // To
                    SwapCard(
                        label = "You receive",
                        network = state.toNetwork,
                        token = state.toToken,
                        balance = state.toBalance,
                        onNetwork = { networkPicker = SwapSide.To },
                        onToken = { picker = SwapSide.To },
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.heightIn(min = 44.dp)) {
                            if (state.estimating) {
                                CircularProgressIndicator(color = colors.primary, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                                Spacer(Modifier.width(Spacing.sm))
                                Text("Finding best price…", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
                            } else {
                                Text(
                                    state.estimate?.let { Formatters.tokenAmount(it.toAmountDecimal, 6) } ?: "0",
                                    style = AmountTextStyle.copy(fontSize = 28.sp),
                                    color = if (state.estimate != null) colors.textPrimary else colors.textMuted,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                        Text(
                            state.estimate?.toAmountUsd?.let { "≈ ${Formatters.fiat(it)}" } ?: " ",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textSecondary,
                        )
                    }
                }
                // Flip button overlapping both cards.
                Box(
                    Modifier
                        .align(Alignment.Center)
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(colors.primary)
                        .border(4.dp, colors.background, CircleShape)
                        .clickable(role = Role.Button) { viewModel.flip() }
                        .semantics { contentDescription = "Flip tokens" },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.SwapVert, contentDescription = null, tint = colors.onPrimary)
                }
            }

            Spacer(Modifier.height(Spacing.lg))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(role = Role.Button) { slippageSheet = true }
                    .padding(vertical = Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Tune, null, tint = colors.textSecondary, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(Spacing.sm))
                Text("Slippage tolerance", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary, modifier = Modifier.weight(1f))
                Text(percent(state.slippage), style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                Icon(Icons.Filled.KeyboardArrowDown, null, tint = colors.textMuted)
            }

            state.estimate?.let { est ->
                Spacer(Modifier.height(Spacing.sm))
                VfxtCard(Modifier.fillMaxWidth()) {
                    val fromSym = state.fromToken?.symbol.orEmpty()
                    val toSym = state.toToken?.symbol.orEmpty()
                    val amount = state.amountInput.toBigDecimalOrNull()
                    if (amount != null && amount.signum() > 0) {
                        DetailLine("Rate", "1 $fromSym ≈ ${Formatters.tokenAmount(est.toAmountDecimal.divide(amount, 12, RoundingMode.DOWN), 6)} $toSym")
                    }
                    DetailLine("Minimum received", "${Formatters.tokenAmount(est.toAmountMinDecimal, 6)} $toSym")
                    est.valueLossPercent?.let { DetailLine("Price impact (incl. fees)", percentText(it), lossColor(it)) }
                    DetailLine("Provider fee", "0.25% (LI.FI, included)")
                    est.gasCostUsd?.let { DetailLine("Est. network fee", Formatters.fiat(it)) }
                    DetailLine("Route", est.toolName.ifBlank { "Best available" })
                    if (state.isCrossChain && est.executionDurationSeconds > 0) {
                        DetailLine("Estimated time", durationText(est.executionDurationSeconds))
                    }
                }
            }
            Spacer(Modifier.height(Spacing.lg))
        }

        val message = state.error ?: state.estimateError
        message?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, color = colors.error, modifier = Modifier.padding(horizontal = Spacing.screen, vertical = Spacing.xs))
        }
        VfxtPrimaryButton(
            text = when {
                state.insufficient -> "Insufficient ${state.fromToken?.symbol}"
                state.amountRaw == null -> "Enter an amount"
                else -> "Review swap"
            },
            onClick = {
                focus.clearFocus()
                viewModel.review()
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
            enabled = state.amountRaw != null && !state.insufficient && state.estimate != null && !state.estimating && state.account != null,
            loading = state.reviewing,
        )
    }

    picker?.let { side ->
        val network = if (side == SwapSide.From) state.fromNetwork else state.toNetwork
        if (network != null) {
            TokenPickerSheet(
                network = network,
                viewModel = viewModel,
                onPick = { viewModel.selectToken(side, it); picker = null },
                onDismiss = { picker = null },
            )
        }
    }
    networkPicker?.let { side ->
        NetworkPickerSheet(
            networks = state.networks,
            selected = if (side == SwapSide.From) state.fromNetwork else state.toNetwork,
            title = if (side == SwapSide.From) "Pay from network" else "Receive on network",
            onPick = { viewModel.selectNetwork(side, it); networkPicker = null },
            onDismiss = { networkPicker = null },
        )
    }
    if (slippageSheet) {
        SlippageSheet(state.slippage, onPick = { viewModel.setSlippage(it); slippageSheet = false }, onDismiss = { slippageSheet = false })
    }
}

@Composable
private fun SwapCard(
    label: String,
    network: EvmNetwork?,
    token: SwapToken?,
    balance: BigInteger?,
    onNetwork: () -> Unit,
    onToken: () -> Unit,
    content: @Composable () -> Unit,
) {
    val colors = VfxtTheme.colors
    VfxtCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = colors.textSecondary, modifier = Modifier.weight(1f))
            Row(
                Modifier
                    .clip(RoundedCornerShape(50))
                    .background(colors.cardRaised)
                    .clickable(role = Role.Button, onClick = onNetwork)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(network?.shortName ?: "Network", style = MaterialTheme.typography.labelMedium, color = colors.textPrimary)
                Icon(Icons.Filled.KeyboardArrowDown, contentDescription = "Change network", tint = colors.textSecondary, modifier = Modifier.size(16.dp))
            }
        }
        Spacer(Modifier.height(Spacing.sm))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) { Column { content() } }
            Spacer(Modifier.width(Spacing.sm))
            Row(
                Modifier
                    .clip(RoundedCornerShape(50))
                    .background(colors.cardRaised)
                    .border(1.dp, colors.border, RoundedCornerShape(50))
                    .clickable(role = Role.Button, onClick = onToken)
                    .padding(start = 6.dp, end = 10.dp, top = 6.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TokenIcon(token?.symbol ?: "?", size = 28.dp, logoUrl = token?.logoUrl)
                Spacer(Modifier.width(6.dp))
                Text(token?.symbol ?: "Select", style = MaterialTheme.typography.titleSmall, color = colors.textPrimary, maxLines = 1)
                Icon(Icons.Filled.KeyboardArrowDown, contentDescription = "Change token", tint = colors.textSecondary)
            }
        }
        Spacer(Modifier.height(Spacing.xs))
        Text(
            "Balance: " + (if (balance != null && token != null) Formatters.tokenAmount(balance, token.decimals, 6) else "—"),
            style = MaterialTheme.typography.bodySmall,
            color = colors.textMuted,
        )
    }
}

@Composable
private fun AmountInput(value: String, onChange: (String) -> Unit) {
    val colors = VfxtTheme.colors
    Box(Modifier.heightIn(min = 44.dp), contentAlignment = Alignment.CenterStart) {
        if (value.isEmpty()) Text("0", style = AmountTextStyle.copy(fontSize = 28.sp), color = colors.textMuted)
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = true,
            textStyle = AmountTextStyle.copy(fontSize = 28.sp, color = colors.textPrimary),
            cursorBrush = SolidColor(colors.primary),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Amount to swap" },
        )
    }
}

// --- Review ---------------------------------------------------------------------------------

@Composable
private fun ReviewStep(state: SwapUiState, viewModel: SwapViewModel, onConfirm: () -> Unit) {
    val colors = VfxtTheme.colors
    val preview = state.preview ?: return
    val q = preview.quote
    val loss = q.valueLossPercent
    val highImpact = loss != null && loss > SwapGuard.HIGH_IMPACT_PERCENT
    val unknownValue = loss == null
    val needsAck = highImpact || unknownValue || !q.toToken.verified

    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
        ) {
            state.notice?.let {
                Banner(it, colors.warning)
                Spacer(Modifier.height(Spacing.md))
            }
            VfxtCard(Modifier.fillMaxWidth()) {
                LegRow("You pay", q.fromToken.symbol, Formatters.tokenAmount(q.fromAmountDecimal, 8), preview.fromNetwork.name, q.fromAmountUsd, q.fromToken.logoUrl)
                Box(Modifier.fillMaxWidth().padding(vertical = Spacing.xs), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.SwapVert, null, tint = colors.textMuted)
                }
                LegRow("You receive (est.)", q.toToken.symbol, Formatters.tokenAmount(q.toAmountDecimal, 8), preview.toNetwork.name, q.toAmountUsd, q.toToken.logoUrl)
            }
            Spacer(Modifier.height(Spacing.md))
            VfxtCard(Modifier.fillMaxWidth()) {
                DetailLine("Minimum received", "${Formatters.tokenAmount(q.toAmountMinDecimal, 8)} ${q.toToken.symbol}")
                DetailLine("Slippage tolerance", percent(q.slippage))
                loss?.let { DetailLine("Price impact (incl. fees)", percentText(it), lossColor(it)) }
                DetailLine("Provider fee", q.providerFeeUsd?.let { "${Formatters.fiat(it)} (0.25%, LI.FI)" } ?: "0.25% (LI.FI)")
                DetailLine(
                    if (preview.needsApproval) "Network fees (approve + swap)" else "Network fee",
                    "${Formatters.tokenAmount(preview.networkFee, 6)} ${preview.fromNetwork.nativeSymbol}" +
                        (q.gasCostUsd?.let { " ≈ ${Formatters.fiat(it)}" } ?: ""),
                )
                if (q.extraNativeValue.signum() > 0) {
                    DetailLine(
                        "Bridge fee",
                        "${Formatters.tokenAmount(q.extraNativeValue, preview.fromNetwork.nativeDecimals, 6)} ${preview.fromNetwork.nativeSymbol}",
                    )
                }
                DetailLine("Route", q.toolName)
                if (q.isCrossChain) DetailLine("Estimated time", durationText(q.executionDurationSeconds))
                DetailLine("Contract", Formatters.shortAddress(q.tx.to) + " (LI.FI, verified)")
            }
            if (preview.needsApproval) {
                Spacer(Modifier.height(Spacing.md))
                Banner(
                    "First you'll approve ${q.fromToken.symbol} for this exact amount only (not unlimited). This is one extra transaction.",
                    colors.primary,
                )
            }
            if (q.isCrossChain) {
                Spacer(Modifier.height(Spacing.md))
                Banner(
                    "This is a cross-chain swap. ${q.toToken.symbol} arrives on ${preview.toNetwork.name} after the bridge completes, usually within ${durationText(q.executionDurationSeconds)}.",
                    colors.primary,
                )
            }
            if (needsAck) {
                Spacer(Modifier.height(Spacing.md))
                Banner(
                    when {
                        !q.toToken.verified -> "${q.toToken.symbol} isn't on the verified token list. Anyone can create a token with any name. Make sure this is the contract you intend."
                        unknownValue -> "The USD value of this swap couldn't be determined, so price impact is unknown."
                        else -> "You lose about ${percentText(loss)} of value in this swap (price impact plus fees). Consider a smaller amount."
                    },
                    colors.error,
                )
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .clickable(role = Role.Checkbox) { viewModel.acknowledgeHighImpact(!state.highImpactAcknowledged) }
                        .padding(vertical = Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(
                        checked = state.highImpactAcknowledged,
                        onCheckedChange = null,
                        colors = CheckboxDefaults.colors(checkedColor = colors.error, uncheckedColor = colors.border),
                    )
                    Spacer(Modifier.width(Spacing.sm))
                    Text("I understand the risk and want to continue", style = MaterialTheme.typography.bodyMedium, color = colors.textPrimary)
                }
            }
            Spacer(Modifier.height(Spacing.md))
            Text(
                "Swaps are executed by third-party liquidity sources and can't be reversed. Quotes refresh just before signing; if the price gets worse you'll be asked again.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
            Spacer(Modifier.height(Spacing.lg))
        }
        state.error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = colors.error, modifier = Modifier.padding(horizontal = Spacing.screen)) }
        VfxtPrimaryButton(
            if (preview.needsApproval) "Approve & swap" else "Confirm swap",
            onConfirm,
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
            enabled = preview.problem == null && (!needsAck || state.highImpactAcknowledged),
        )
    }
}

@Composable
private fun LegRow(label: String, symbol: String, amount: String, network: String, usd: BigDecimal?, logoUrl: String?) {
    val colors = VfxtTheme.colors
    Text(label, style = MaterialTheme.typography.labelMedium, color = colors.textSecondary)
    Spacer(Modifier.height(Spacing.xs))
    Row(verticalAlignment = Alignment.CenterVertically) {
        TokenIcon(symbol, size = 36.dp, logoUrl = logoUrl)
        Spacer(Modifier.width(Spacing.md))
        Column(Modifier.weight(1f)) {
            Text("$amount $symbol", style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
            Text(network + (usd?.let { " · ≈ ${Formatters.fiat(it)}" } ?: ""), style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
        }
    }
}

// --- Executing ------------------------------------------------------------------------------

@Composable
private fun ExecutingStep(state: SwapUiState) {
    val colors = VfxtTheme.colors
    val preview = state.preview
    val p = state.progress
    val approvalNeeded = preview?.needsApproval == true
    val cross = preview?.quote?.isCrossChain == true
    val approvalDone = p != null && p !is SwapProgress.Approving && p !is SwapProgress.WaitingForApproval
    val swapDone = p is SwapProgress.Bridging || p is SwapProgress.Done

    Column(
        Modifier
            .fillMaxSize()
            .padding(horizontal = Spacing.screen),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(Spacing.xxl))
        CircularProgressIndicator(color = colors.primary, modifier = Modifier.size(56.dp))
        Spacer(Modifier.height(Spacing.xl))
        Text("Don't close the app", style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
        Text("Each step is signed on this device. Your key never leaves it.", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(Spacing.xxl))
        VfxtCard(Modifier.fillMaxWidth()) {
            if (approvalNeeded) {
                StepRow(
                    "Approve ${preview?.quote?.fromToken?.symbol}",
                    done = approvalDone,
                    active = p is SwapProgress.Approving || p is SwapProgress.WaitingForApproval,
                    detail = (p as? SwapProgress.WaitingForApproval)?.let { "Waiting for confirmation…" },
                )
            }
            StepRow(
                "Check latest price",
                done = p is SwapProgress.Swapping || p is SwapProgress.WaitingForSwap || swapDone,
                active = p is SwapProgress.Requoting || p == null,
            )
            StepRow(
                "Swap",
                done = swapDone,
                active = p is SwapProgress.Swapping || p is SwapProgress.WaitingForSwap,
                detail = (p as? SwapProgress.WaitingForSwap)?.let { "Waiting for confirmation…" },
            )
            if (cross) {
                StepRow(
                    "Bridge to ${preview?.toNetwork?.name}",
                    done = p is SwapProgress.Done,
                    active = p is SwapProgress.Bridging,
                    detail = (p as? SwapProgress.Bridging)?.message ?: if (p is SwapProgress.Bridging) "In progress…" else null,
                )
            }
        }
    }
}

@Composable
private fun StepRow(title: String, done: Boolean, active: Boolean, detail: String? = null) {
    val colors = VfxtTheme.colors
    Row(Modifier.fillMaxWidth().padding(vertical = Spacing.sm), verticalAlignment = Alignment.CenterVertically) {
        when {
            done -> Icon(Icons.Outlined.CheckCircle, null, tint = colors.success, modifier = Modifier.size(22.dp))
            active -> CircularProgressIndicator(color = colors.primary, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
            else -> Icon(Icons.Outlined.RadioButtonUnchecked, null, tint = colors.textMuted, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.width(Spacing.md))
        Column {
            Text(title, style = MaterialTheme.typography.titleSmall, color = if (done || active) colors.textPrimary else colors.textMuted)
            detail?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary) }
        }
    }
}

// --- Finished -------------------------------------------------------------------------------

@Composable
private fun FinishedStep(state: SwapUiState, onDone: () -> Unit, onActivity: () -> Unit) {
    val colors = VfxtTheme.colors
    val uri = LocalUriHandler.current
    val preview = state.preview
    val done = state.progress as? SwapProgress.Done
    val failed = state.progress as? SwapProgress.Failed
    val hash = done?.hash ?: failed?.hash

    Column(
        Modifier
            .fillMaxSize()
            .padding(horizontal = Spacing.screen),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(1f))
        IconTile(
            if (done != null) Icons.Outlined.CheckCircle else Icons.Outlined.ErrorOutline,
            if (done != null) colors.success else colors.error,
            size = 96.dp,
        )
        Spacer(Modifier.height(Spacing.xl))
        Text(
            if (done != null) "Swap complete" else "Swap not completed",
            style = MaterialTheme.typography.headlineSmall,
            color = colors.textPrimary,
        )
        Spacer(Modifier.height(Spacing.xs))
        Text(
            when {
                done != null && preview != null ->
                    "You received at least ${Formatters.tokenAmount(preview.quote.toAmountMinDecimal, 6)} ${preview.quote.toToken.symbol} on ${preview.toNetwork.name}."
                failed != null -> failed.message
                else -> ""
            },
            style = MaterialTheme.typography.bodyMedium,
            color = colors.textSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(Spacing.xl))
        if (hash != null && preview != null) {
            VfxtSecondaryButton(
                "View on explorer",
                { uri.openUri(preview.fromNetwork.explorerTxUrl(hash)) },
                Modifier.fillMaxWidth(),
                icon = Icons.AutoMirrored.Filled.OpenInNew,
            )
            done?.receivingHash?.let { recv ->
                Spacer(Modifier.height(Spacing.sm))
                VfxtSecondaryButton(
                    "View on ${preview.toNetwork.shortName}",
                    { uri.openUri(preview.toNetwork.explorerTxUrl(recv)) },
                    Modifier.fillMaxWidth(),
                    icon = Icons.AutoMirrored.Filled.OpenInNew,
                )
            }
            Spacer(Modifier.height(Spacing.sm))
        }
        VfxtSecondaryButton("View activity", onActivity, Modifier.fillMaxWidth())
        Spacer(Modifier.weight(1f))
        VfxtPrimaryButton("Done", onDone, Modifier.fillMaxWidth().padding(vertical = Spacing.lg))
    }
}

// --- Sheets ---------------------------------------------------------------------------------

@Composable
private fun TokenPickerSheet(
    network: EvmNetwork,
    viewModel: SwapViewModel,
    onPick: (SwapToken) -> Unit,
    onDismiss: () -> Unit,
) {
    val colors = VfxtTheme.colors
    var query by remember { mutableStateOf("") }
    var mine by remember { mutableStateOf<List<SwapToken>>(emptyList()) }
    var listed by remember { mutableStateOf<List<SwapToken>?>(null) }
    var pasted by remember { mutableStateOf<SwapToken?>(null) }
    var lookingUp by remember { mutableStateOf(false) }

    LaunchedEffect(network.id) {
        val (m, l) = viewModel.pickerTokens(network)
        mine = m
        listed = l
    }
    LaunchedEffect(query, listed) {
        pasted = null
        val q = query.trim()
        val all = mine + listed.orEmpty()
        if (q.length == 42 && q.startsWith("0x") && all.none { it.address.equals(q, true) }) {
            lookingUp = true
            pasted = viewModel.lookupToken(network, q)
            lookingUp = false
        }
    }

    val q = query.trim()
    fun matches(t: SwapToken) = q.isEmpty() || t.symbol.contains(q, true) || t.name.contains(q, true) || t.address.equals(q, true)
    val mineShown = mine.filter(::matches)
    val listedShown = listed.orEmpty().filter(::matches).take(200)

    VfxtBottomSheet(onDismiss) {
        Text("Select token on ${network.name}", style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
        Spacer(Modifier.height(Spacing.md))
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Search name, symbol or paste address", color = colors.textMuted) },
            leadingIcon = { Icon(Icons.Filled.Search, null, tint = colors.textSecondary) },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = colors.primary,
                unfocusedBorderColor = colors.border,
                focusedContainerColor = colors.card,
                unfocusedContainerColor = colors.card,
                cursorColor = colors.primary,
                focusedTextColor = colors.textPrimary,
                unfocusedTextColor = colors.textPrimary,
            ),
        )
        Spacer(Modifier.height(Spacing.sm))
        LazyColumn(Modifier.heightIn(max = 460.dp)) {
            if (lookingUp) item { Text("Checking contract on-chain…", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary, modifier = Modifier.padding(Spacing.sm)) }
            pasted?.let { t -> item { TokenRow(t, onPick) } }
            if (mineShown.isNotEmpty()) {
                item { SectionLabel("Your tokens") }
                items(mineShown, key = { "m" + it.key }) { TokenRow(it, onPick) }
            }
            item { SectionLabel(if (listed == null) "Loading tokens…" else "All verified tokens") }
            items(listedShown, key = { "l" + it.key }) { TokenRow(it, onPick) }
            if (listed != null && listedShown.isEmpty() && mineShown.isEmpty() && pasted == null && !lookingUp) {
                item { Text("No tokens match. Paste a contract address to look it up.", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary, modifier = Modifier.padding(Spacing.sm)) }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = VfxtTheme.colors.textMuted,
        modifier = Modifier.padding(top = Spacing.md, bottom = Spacing.xs, start = Spacing.xs),
    )
}

@Composable
private fun TokenRow(token: SwapToken, onPick: (SwapToken) -> Unit) {
    val colors = VfxtTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(role = Role.Button) { onPick(token) }
            .padding(vertical = Spacing.sm, horizontal = Spacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TokenIcon(token.symbol, size = 36.dp, logoUrl = token.logoUrl)
        Spacer(Modifier.width(Spacing.md))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(token.symbol, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                if (!token.verified) {
                    Spacer(Modifier.width(6.dp))
                    StatusPill("Unverified", tone = PillTone.Warning)
                }
            }
            Text(
                if (token.isNative) token.name else "${token.name} · ${Formatters.shortAddress(token.address)}",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        token.priceUsd?.let { Text(Formatters.fiat(it), style = MaterialTheme.typography.bodySmall, color = colors.textSecondary) }
    }
}

@Composable
private fun NetworkPickerSheet(
    networks: List<EvmNetwork>,
    selected: EvmNetwork?,
    title: String,
    onPick: (EvmNetwork) -> Unit,
    onDismiss: () -> Unit,
) {
    val colors = VfxtTheme.colors
    VfxtBottomSheet(onDismiss) {
        Text(title, style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
        Spacer(Modifier.height(Spacing.md))
        networks.forEach { net ->
            val isSel = net.id == selected?.id
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (isSel) colors.primary.copy(alpha = 0.10f) else Color.Transparent)
                    .clickable(role = Role.RadioButton) { onPick(net) }
                    .padding(Spacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                NetworkIcon(net, size = 32.dp)
                Spacer(Modifier.width(Spacing.md))
                Column(Modifier.weight(1f)) {
                    Text(net.name, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                    Text("Chain ID ${net.chainId}", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                }
                if (isSel) Icon(Icons.Outlined.CheckCircle, contentDescription = "Selected", tint = colors.primary)
            }
        }
        Spacer(Modifier.height(Spacing.sm))
        Text("Pick a different receive network to bridge across chains.", style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
    }
}

@Composable
private fun SlippageSheet(current: BigDecimal, onPick: (BigDecimal) -> Unit, onDismiss: () -> Unit) {
    val colors = VfxtTheme.colors
    var custom by remember { mutableStateOf("") }
    val presets = listOf("0.001", "0.005", "0.01", "0.03").map(::BigDecimal)
    VfxtBottomSheet(onDismiss) {
        Text("Slippage tolerance", style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
        Text(
            "Your swap is cancelled if the price moves against you by more than this. Lower is safer; very low values can fail on volatile tokens.",
            style = MaterialTheme.typography.bodySmall,
            color = colors.textSecondary,
        )
        Spacer(Modifier.height(Spacing.lg))
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            presets.forEach { p -> VfxtChip(percent(p), selected = p.compareTo(current) == 0, onClick = { onPick(p) }) }
        }
        Spacer(Modifier.height(Spacing.lg))
        OutlinedTextField(
            value = custom,
            onValueChange = { if (it.isEmpty() || Regex("^\\d{0,2}(\\.\\d{0,2})?$").matches(it)) custom = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Custom %") },
            suffix = { Text("%", color = colors.textSecondary) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = colors.primary,
                unfocusedBorderColor = colors.border,
                cursorColor = colors.primary,
                focusedTextColor = colors.textPrimary,
                unfocusedTextColor = colors.textPrimary,
                focusedLabelColor = colors.primary,
                unfocusedLabelColor = colors.textSecondary,
            ),
        )
        val customValue = custom.toBigDecimalOrNull()?.movePointLeft(2)
        val valid = customValue != null && customValue.signum() > 0 && customValue <= SwapGuard.MAX_SLIPPAGE
        if (custom.isNotEmpty() && !valid) {
            Text("Enter between 0.01% and 5%.", style = MaterialTheme.typography.bodySmall, color = colors.error)
        } else if (customValue != null && customValue > BigDecimal("0.03")) {
            Text("High slippage: you may receive noticeably less.", style = MaterialTheme.typography.bodySmall, color = colors.warning)
        }
        Spacer(Modifier.height(Spacing.md))
        VfxtPrimaryButton("Save", { customValue?.let(onPick) }, Modifier.fillMaxWidth(), enabled = valid)
    }
}

// --- Helpers --------------------------------------------------------------------------------

@Composable
private fun Banner(text: String, tint: Color) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(tint.copy(alpha = 0.10f))
            .border(1.dp, tint.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
            .padding(Spacing.md),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(if (tint == VfxtTheme.colors.primary) Icons.Outlined.Info else Icons.Outlined.WarningAmber, null, tint = tint, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(Spacing.sm))
        Text(text, style = MaterialTheme.typography.bodySmall, color = VfxtTheme.colors.textPrimary)
    }
}

@Composable
private fun DetailLine(label: String, value: String, valueColor: Color = VfxtTheme.colors.textPrimary) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.Top) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = VfxtTheme.colors.textSecondary, modifier = Modifier.weight(1f))
        Spacer(Modifier.width(Spacing.sm))
        Text(value, style = MaterialTheme.typography.bodySmall, color = valueColor, textAlign = TextAlign.End, modifier = Modifier.weight(1.4f))
    }
}

@Composable
private fun lossColor(loss: BigDecimal): Color = when {
    loss > SwapGuard.HIGH_IMPACT_PERCENT -> VfxtTheme.colors.error
    loss > BigDecimal("2") -> VfxtTheme.colors.warning
    else -> VfxtTheme.colors.success
}

private fun percent(fraction: BigDecimal): String = fraction.movePointRight(2).stripTrailingZeros().toPlainString() + "%"

private fun percentText(value: BigDecimal): String =
    if (value < BigDecimal("0.01")) "<0.01%" else value.setScale(2, RoundingMode.HALF_UP).toPlainString() + "%"

private fun durationText(seconds: Int): String = when {
    seconds <= 0 -> "under a minute"
    seconds < 60 -> "$seconds sec"
    else -> "${(seconds + 59) / 60} min"
}
