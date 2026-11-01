package com.vfxt.wallet.ui.swap

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.blockchain.swap.DeskPreview
import com.vfxt.wallet.blockchain.swap.DeskProgress
import com.vfxt.wallet.blockchain.swap.DeskSide
import com.vfxt.wallet.blockchain.swap.DeskState
import com.vfxt.wallet.blockchain.swap.SwapException
import com.vfxt.wallet.blockchain.swap.VfxtDeskService
import com.vfxt.wallet.blockchain.transactions.TransactionService
import com.vfxt.wallet.core.designsystem.components.TokenIcon
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.core.common.TokenLogos
import com.vfxt.wallet.domain.repository.WalletRepository
import com.vfxt.wallet.ui.security.AuthenticateSheet
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import javax.inject.Inject

data class DeskUiState(
    val side: DeskSide = DeskSide.Buy,
    val input: String = "",
    val loading: Boolean = true,
    val desk: DeskState? = null,
    val preview: DeskPreview? = null,
    val quoting: Boolean = false,
    val error: String? = null,
    val progress: DeskProgress? = null,
    val noWallet: Boolean = false,
)

@HiltViewModel
class VfxtDeskViewModel @Inject constructor(
    private val desk: VfxtDeskService,
    private val repository: WalletRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(DeskUiState())
    val state: StateFlow<DeskUiState> = _state.asStateFlow()

    private var quoteJob: Job? = null

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val account = repository.activeAccount.first()
            if (account == null) {
                _state.update { it.copy(loading = false, noWallet = true) }
                return@launch
            }
            try {
                val d = desk.state(account.address)
                _state.update { it.copy(loading = false, desk = d, error = null) }
                requote()
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = "Couldn't load the VFXT swap. Check your connection.") }
            }
        }
    }

    fun setSide(side: DeskSide) {
        if (_state.value.side == side || _state.value.progress != null) return
        _state.update { it.copy(side = side, input = "", preview = null, error = null) }
    }

    fun setInput(value: String) {
        val cleaned = value.replace(',', '.').filter { it.isDigit() || it == '.' }
        if (cleaned.count { it == '.' } > 1) return
        _state.update { it.copy(input = cleaned, preview = null, error = null) }
        requote()
    }

    fun setMax() {
        val d = _state.value.desk ?: return
        val raw = if (_state.value.side == DeskSide.Buy) d.userUsdt else d.userVfxt
        setInput(BigDecimal(raw).movePointLeft(18).setScale(6, RoundingMode.DOWN).stripTrailingZeros().toPlainString())
    }

    private fun requote() {
        quoteJob?.cancel()
        val s = _state.value
        val d = s.desk ?: return
        val amount = parse(s.input)
        if (amount == null || amount.signum() == 0) {
            _state.update { it.copy(preview = null, quoting = false) }
            return
        }
        quoteJob = viewModelScope.launch {
            delay(300)
            _state.update { it.copy(quoting = true) }
            val account = repository.activeAccount.first() ?: return@launch
            try {
                val p = desk.preview(s.side, amount, account.address, d)
                _state.update { it.copy(preview = p, quoting = false, error = null) }
            } catch (e: SwapException) {
                _state.update { it.copy(preview = null, quoting = false, error = e.message) }
            } catch (e: Exception) {
                _state.update { it.copy(preview = null, quoting = false, error = "Couldn't get a quote. Check your connection.") }
            }
        }
    }

    /** Call only after PIN/biometric re-authentication. */
    fun execute() {
        val p = _state.value.preview ?: return
        viewModelScope.launch {
            val account = repository.activeAccount.first() ?: return@launch
            desk.execute(p, account.id, account.address).collect { progress ->
                _state.update { it.copy(progress = progress) }
            }
        }
    }

    fun reset() {
        _state.update { it.copy(progress = null, input = "", preview = null, error = null) }
        refresh()
    }

    private fun parse(input: String): BigInteger? = TransactionService.parseAmount(input, 18)
}

@Composable
fun VfxtDeskScreen(
    onBack: () -> Unit,
    onActivity: () -> Unit,
    viewModel: VfxtDeskViewModel = hiltViewModel(),
) {
    val colors = VfxtTheme.colors
    val state by viewModel.state.collectAsStateWithLifecycle()
    var authenticating by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .safeDrawingPadding()
            .imePadding(),
    ) {
        VfxtTopBar("Buy / Sell VFXT", onBack)
        when {
            state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = colors.primary) }
            state.noWallet -> Message("Create or import a wallet to trade VFXT.")
            state.progress != null -> ProgressView(state.progress!!, onDone = viewModel::reset, onActivity = onActivity)
            else -> EditView(state, viewModel, onReview = { authenticating = true })
        }
    }

    if (authenticating) {
        val p = state.preview
        AuthenticateSheet(
            reason = p?.let { "${if (it.side == DeskSide.Buy) "Buy" else "Sell"} VFXT: ${VfxtDeskService.display(it.amountIn)} ${it.inSymbol} → ${VfxtDeskService.display(it.amountOut)} ${it.outSymbol}" }
                ?: "Confirm trade",
            onAuthenticated = {
                authenticating = false
                viewModel.execute()
            },
            onDismiss = { authenticating = false },
        )
    }
}

@Composable
private fun EditView(state: DeskUiState, viewModel: VfxtDeskViewModel, onReview: () -> Unit) {
    val colors = VfxtTheme.colors
    val d = state.desk
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.screen),
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        SideTabs(state.side, viewModel::setSide)

        if (d != null) {
            VfxtCard(Modifier.fillMaxWidth()) {
                val price = if (state.side == DeskSide.Buy) d.buyPrice else d.sellPrice
                Text("Price", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                Text(
                    if (price.signum() == 0) "Not available" else "1 VFXT = ${VfxtDeskService.display(price)} USDT",
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.textPrimary,
                )
                if (d.paused) Text("Trading is paused by the admin.", style = MaterialTheme.typography.bodySmall, color = colors.warning)
            }
        }

        val inSymbol = if (state.side == DeskSide.Buy) "USDT" else "VFXT"
        val outSymbol = if (state.side == DeskSide.Buy) "VFXT" else "USDT"
        val balance = d?.let { if (state.side == DeskSide.Buy) it.userUsdt else it.userVfxt }

        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("You pay", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary, modifier = Modifier.weight(1f))
                balance?.let {
                    Text(
                        "Balance: ${trim(it)} $inSymbol",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.primary,
                        modifier = Modifier.clickable(onClick = viewModel::setMax),
                    )
                }
            }
            Spacer(Modifier.height(Spacing.xs))
            OutlinedTextField(
                value = state.input,
                onValueChange = viewModel::setInput,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("0.0", color = colors.textMuted) },
                leadingIcon = { TokenIcon(inSymbol, size = 28.dp, logoUrl = logo(inSymbol)) },
                suffix = { Text(inSymbol, color = colors.textSecondary) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
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
        }

        VfxtCard(Modifier.fillMaxWidth()) {
            Text("You receive", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
            Spacer(Modifier.height(Spacing.xs))
            Row(verticalAlignment = Alignment.CenterVertically) {
                TokenIcon(outSymbol, size = 28.dp, logoUrl = logo(outSymbol))
                Spacer(Modifier.width(Spacing.sm))
                when {
                    state.quoting -> CircularProgressIndicator(Modifier.size(18.dp), color = colors.primary, strokeWidth = 2.dp)
                    else -> Text(
                        "${state.preview?.let { trim(it.amountOut) } ?: "0"} $outSymbol",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = colors.textPrimary,
                    )
                }
            }
            state.preview?.let { p ->
                Spacer(Modifier.height(Spacing.sm))
                Text(
                    "Network fee ≈ ${trim(p.estimatedFee)} BNB" + if (p.needsApproval) " (includes a one-time $inSymbol approval)" else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
        }

        state.error?.let {
            Row(verticalAlignment = Alignment.Top) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = colors.error, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(Spacing.sm))
                Text(it, style = MaterialTheme.typography.bodySmall, color = colors.error)
            }
        }

        d?.let {
            Row(verticalAlignment = Alignment.Top) {
                Icon(Icons.Outlined.Info, null, tint = colors.textMuted, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(Spacing.sm))
                Text(
                    "Fixed-price swap run by VFXT on BNB Smart Chain. Available: ${trim(it.vfxtReserve)} VFXT · ${trim(it.usdtReserve)} USDT.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
        }

        VfxtPrimaryButton(
            if (state.side == DeskSide.Buy) "Buy VFXT" else "Sell VFXT",
            onReview,
            Modifier.fillMaxWidth(),
            enabled = state.preview != null && !state.quoting,
        )
        Spacer(Modifier.height(Spacing.lg))
    }
}

@Composable
private fun SideTabs(side: DeskSide, onSelect: (DeskSide) -> Unit) {
    val colors = VfxtTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(colors.card)
            .padding(4.dp),
    ) {
        DeskSide.entries.forEach { s ->
            val selected = s == side
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (selected) (if (s == DeskSide.Buy) colors.success else colors.error).copy(alpha = 0.18f) else colors.card)
                    .clickable { onSelect(s) }
                    .padding(vertical = Spacing.md),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (s == DeskSide.Buy) "Buy" else "Sell",
                    style = MaterialTheme.typography.titleSmall,
                    color = if (selected) (if (s == DeskSide.Buy) colors.success else colors.error) else colors.textSecondary,
                )
            }
        }
    }
}

@Composable
private fun ProgressView(progress: DeskProgress, onDone: () -> Unit, onActivity: () -> Unit) {
    val colors = VfxtTheme.colors
    val uri = LocalUriHandler.current
    val explorer = { hash: String -> uri.openUri("https://bscscan.com/tx/$hash") }
    Column(
        Modifier
            .fillMaxSize()
            .padding(Spacing.screen),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        val (title, hash) = when (progress) {
            DeskProgress.Approving -> "Approving token…" to null
            is DeskProgress.WaitingForApproval -> "Waiting for approval to confirm…" to progress.hash
            DeskProgress.Swapping -> "Submitting trade…" to null
            is DeskProgress.WaitingForSwap -> "Waiting for confirmation…" to progress.hash
            is DeskProgress.Done -> "Trade complete" to progress.hash
            is DeskProgress.Failed -> progress.message to progress.hash
        }
        when (progress) {
            is DeskProgress.Done -> Icon(Icons.Filled.CheckCircle, null, tint = colors.success, modifier = Modifier.size(64.dp))
            is DeskProgress.Failed -> Icon(Icons.Outlined.ErrorOutline, null, tint = colors.error, modifier = Modifier.size(64.dp))
            else -> CircularProgressIndicator(color = colors.primary)
        }
        Spacer(Modifier.height(Spacing.lg))
        Text(title, style = MaterialTheme.typography.titleMedium, color = colors.textPrimary, textAlign = TextAlign.Center)
        hash?.let {
            Spacer(Modifier.height(Spacing.sm))
            Text("View on BscScan", style = MaterialTheme.typography.bodyMedium, color = colors.primary, modifier = Modifier.clickable { explorer(it) })
        }
        if (progress is DeskProgress.Done || progress is DeskProgress.Failed) {
            Spacer(Modifier.height(Spacing.xl))
            VfxtPrimaryButton("Done", onDone, Modifier.fillMaxWidth())
            Spacer(Modifier.height(Spacing.sm))
            VfxtSecondaryButton("View activity", onActivity, Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun Message(text: String) {
    Box(Modifier.fillMaxSize().padding(Spacing.screen), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.bodyLarge, color = VfxtTheme.colors.textSecondary, textAlign = TextAlign.Center)
    }
}

private fun logo(symbol: String): String? =
    TokenLogos.token(56, if (symbol == "USDT") VfxtDeskService.USDT else VfxtDeskService.VFXT)

private fun trim(raw: BigInteger): String =
    BigDecimal(raw).movePointLeft(18).setScale(6, RoundingMode.DOWN).stripTrailingZeros().toPlainString()
