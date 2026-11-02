package com.vfxt.wallet.ui.home

import android.content.ClipData
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.CallMade
import androidx.compose.material.icons.automirrored.filled.CallReceived
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import com.vfxt.wallet.core.common.QrCodes
import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.domain.models.TokenKind
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.vfxt.wallet.blockchain.tokens.TokenRegistry
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.common.HIDDEN_BALANCE
import com.vfxt.wallet.core.designsystem.components.ComingSoonSheet
import com.vfxt.wallet.core.designsystem.components.EmptyState
import com.vfxt.wallet.core.designsystem.components.ErrorState
import com.vfxt.wallet.core.designsystem.components.PillTone
import com.vfxt.wallet.core.designsystem.components.QuickActionButton
import com.vfxt.wallet.core.designsystem.components.RowDivider
import com.vfxt.wallet.core.designsystem.components.SectionHeader
import com.vfxt.wallet.core.designsystem.components.SkeletonBlock
import com.vfxt.wallet.core.designsystem.components.SkeletonListRow
import com.vfxt.wallet.core.designsystem.components.StatusPill
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtIconButton
import com.vfxt.wallet.core.designsystem.components.VfxtLogoMark
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.domain.models.ActivityItem
import com.vfxt.wallet.domain.models.ActivityStatus
import com.vfxt.wallet.domain.models.ActivityType
import com.vfxt.wallet.domain.models.Holding
import com.vfxt.wallet.domain.models.WalletAccount
import com.vfxt.wallet.domain.models.WalletOverview
import com.vfxt.wallet.ui.common.ActivityRow
import com.vfxt.wallet.ui.common.AssetRow
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.math.BigInteger

@Composable
fun HomeScreen(
    onCreateWallet: () -> Unit,
    onImportWallet: () -> Unit,
    onManageWallets: () -> Unit,
    onSend: (tokenKey: String?, recipient: String?) -> Unit,
    onReceive: () -> Unit,
    onSwap: () -> Unit,
    onActivity: () -> Unit,
    onTokenDetails: (String) -> Unit,
    onNetwork: () -> Unit,
    onNotifications: () -> Unit,
    onNotify: (String) -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val accounts by viewModel.accounts.collectAsStateWithLifecycle()
    val unread by viewModel.unreadNotifications.collectAsStateWithLifecycle()
    val context = LocalContext.current
    HomeContent(
        onNotifications = onNotifications,
        hasUnreadNotifications = unread > 0,
        onSend = { onSend(null, null) },
        onReceive = onReceive,
        onSwap = onSwap,
        onActivity = onActivity,
        onTokenDetails = onTokenDetails,
        onNetwork = onNetwork,
        onScan = {
            QrCodes.scan(context) { raw ->
                val address = raw?.let(QrCodes::extractAddress)
                when {
                    raw?.startsWith("wc:", ignoreCase = true) == true -> viewModel.pairWalletConnect(raw).let { error ->
                        onNotify(error ?: "Connecting to dApp…")
                    }
                    address != null -> onSend(null, address)
                    raw != null -> onNotify("That QR code doesn't contain a wallet address or WalletConnect link.")
                }
            }
        },
        state = state,
        accounts = accounts,
        onRefresh = viewModel::refresh,
        onToggleBalance = viewModel::toggleBalanceVisibility,
        onSelectAccount = viewModel::selectAccount,
        onManageWallets = onManageWallets,
        onCreateWallet = onCreateWallet,
        onImportWallet = onImportWallet,
        onNotify = onNotify,
    )
}

private enum class SoonFeature { Buy }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeContent(
    state: HomeUiState,
    onRefresh: () -> Unit,
    onToggleBalance: () -> Unit,
    onCreateWallet: () -> Unit,
    onImportWallet: () -> Unit,
    onNotify: (String) -> Unit,
    accounts: List<WalletAccount> = emptyList(),
    onSelectAccount: (String) -> Unit = {},
    onManageWallets: () -> Unit = {},
    onSend: () -> Unit = {},
    onReceive: () -> Unit = {},
    onSwap: () -> Unit = {},
    onActivity: () -> Unit = {},
    onTokenDetails: (String) -> Unit = {},
    onNetwork: () -> Unit = {},
    onScan: () -> Unit = {},
    onNotifications: () -> Unit = {},
    hasUnreadNotifications: Boolean = false,
) {
    val colors = VfxtTheme.colors
    val overview = state.overview
    val account = overview?.account
    var soonFeature by remember { mutableStateOf<SoonFeature?>(null) }
    var showWalletPicker by remember { mutableStateOf(false) }
    val pullState = rememberPullToRefreshState()

    PullToRefreshBox(
        isRefreshing = state.isRefreshing,
        onRefresh = onRefresh,
        state = pullState,
        modifier = Modifier.fillMaxSize(),
        indicator = {
            PullToRefreshDefaults.Indicator(
                state = pullState,
                isRefreshing = state.isRefreshing,
                modifier = Modifier.align(Alignment.TopCenter),
                containerColor = colors.card,
                color = colors.primary,
            )
        },
    ) {
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = Spacing.xxl),
        ) {
            item {
                HomeTopBar(
                    account = account,
                    onWalletSelector = { if (account == null) onCreateWallet() else showWalletPicker = true },
                    onScan = { if (account == null) onNotify("Create or import a wallet first.") else onScan() },
                    onNotifications = onNotifications,
                    hasUnread = hasUnreadNotifications,
                )
            }
            item {
                PortfolioCard(
                    state = state,
                    onToggleBalance = onToggleBalance,
                    onCreateWallet = onCreateWallet,
                    onImportWallet = onImportWallet,
                    modifier = Modifier.padding(horizontal = Spacing.screen),
                )
            }
            item {
                val needsWallet = { onNotify("Create or import a wallet first.") }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    QuickActionButton(Icons.AutoMirrored.Filled.CallMade, "Send", if (account == null) needsWallet else onSend, Modifier.weight(1f))
                    QuickActionButton(Icons.AutoMirrored.Filled.CallReceived, "Receive", if (account == null) needsWallet else onReceive, Modifier.weight(1f))
                    QuickActionButton(Icons.Filled.SwapHoriz, "Swap", if (account == null) needsWallet else onSwap, Modifier.weight(1f))
                    QuickActionButton(Icons.Filled.ShoppingCart, "Buy", { soonFeature = SoonFeature.Buy }, Modifier.weight(1f), comingSoon = true)
                }
            }

            item {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.screen),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SectionHeader("My assets", Modifier.weight(1f))
                    state.network?.let { network ->
                        StatusPill(
                            network.shortName,
                            tone = if (network.isTestnet) PillTone.Warning else PillTone.Primary,
                            showDot = true,
                            modifier = Modifier.clickable(role = Role.Button, onClick = onNetwork),
                        )
                    }
                }
                overview?.syncError?.let {
                    Spacer(Modifier.height(Spacing.sm))
                    Text(it, style = MaterialTheme.typography.bodySmall, color = colors.warning, modifier = Modifier.padding(horizontal = Spacing.screen))
                }
                Spacer(Modifier.height(Spacing.sm))
            }
            item {
                VfxtCard(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.screen),
                    contentPadding = PaddingValues(Spacing.xs),
                ) {
                    when {
                        state.isLoading -> repeat(3) { SkeletonListRow(Modifier.padding(horizontal = Spacing.md)) }
                        state.errorMessage != null && overview == null -> ErrorState(state.errorMessage, onRefresh)
                        else -> overview?.holdings.orEmpty().forEachIndexed { i, holding ->
                            if (i > 0) RowDivider()
                            AssetRow(
                                holding,
                                hideBalance = state.balanceHidden,
                                onClick = if (account != null) { { onTokenDetails(holding.token.key) } } else null,
                            )
                        }
                    }
                }
            }

            item {
                Spacer(Modifier.height(Spacing.xxl))
                SectionHeader(
                    "Recent activity",
                    Modifier.padding(horizontal = Spacing.screen),
                    actionLabel = if (overview?.activity.isNullOrEmpty()) null else "View all",
                    onAction = onActivity,
                )
                Spacer(Modifier.height(Spacing.sm))
            }
            item {
                VfxtCard(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.screen),
                    contentPadding = PaddingValues(Spacing.xs),
                ) {
                    val activity = overview?.activity.orEmpty()
                    when {
                        state.isLoading -> repeat(2) { SkeletonListRow(Modifier.padding(horizontal = Spacing.md)) }
                        activity.isEmpty() -> EmptyState(
                            icon = Icons.AutoMirrored.Outlined.ReceiptLong,
                            title = "No activity yet",
                            message = "Transfers, mining rewards and claims will appear here.",
                        )
                        else -> activity.take(5).forEachIndexed { i, item ->
                            if (i > 0) RowDivider()
                            ActivityRow(item, onClick = onActivity)
                        }
                    }
                }
            }
        }
    }

    if (showWalletPicker) {
        WalletPickerSheet(
            accounts = accounts,
            activeId = account?.id,
            onSelect = { onSelectAccount(it); showWalletPicker = false },
            onManage = { showWalletPicker = false; onManageWallets() },
            onDismiss = { showWalletPicker = false },
        )
    }

    when (soonFeature) {
        SoonFeature.Buy -> ComingSoonSheet(
            title = "Buy crypto is coming soon",
            message = "Card and bank purchases through a licensed provider are planned for a future release.",
            icon = Icons.Filled.ShoppingCart,
            onDismiss = { soonFeature = null },
        )
        null -> Unit
    }
}

@Composable
private fun HomeTopBar(
    account: WalletAccount?,
    onWalletSelector: () -> Unit,
    onScan: () -> Unit,
    onNotifications: () -> Unit,
    hasUnread: Boolean = false,
) {
    val colors = VfxtTheme.colors
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.screen, vertical = Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        VfxtLogoMark(size = 30.dp)
        Spacer(Modifier.width(Spacing.md))
        Column(Modifier.weight(1f)) {
            Row(
                Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .clickable(role = Role.Button, onClick = onWalletSelector)
                    .padding(vertical = 2.dp, horizontal = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    account?.name ?: "No wallet",
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.textPrimary,
                )
                Icon(Icons.Filled.KeyboardArrowDown, contentDescription = "Switch wallet", tint = colors.textSecondary, modifier = Modifier.size(20.dp))
            }
            if (account != null) {
                Row(
                    Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(role = Role.Button) {
                            scope.launch { clipboard.setClipEntry(ClipEntry(ClipData.newPlainText("Wallet address", account.address))) }
                        }
                        .padding(horizontal = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(Formatters.shortAddress(account.address), style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                    Spacer(Modifier.width(4.dp))
                    Icon(Icons.Filled.ContentCopy, contentDescription = "Copy address", tint = colors.textMuted, modifier = Modifier.size(12.dp))
                }
            } else {
                Text("Set up a wallet to get started", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
            }
        }
        VfxtIconButton(Icons.Filled.QrCodeScanner, "Scan QR code", onScan)
        Spacer(Modifier.width(Spacing.sm))
        VfxtIconButton(
            Icons.Outlined.Notifications,
            if (hasUnread) "Notifications, unread" else "Notifications",
            onNotifications,
            showDot = hasUnread,
        )
    }
}

@Composable
private fun PortfolioCard(
    state: HomeUiState,
    onToggleBalance: () -> Unit,
    onCreateWallet: () -> Unit,
    onImportWallet: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = VfxtTheme.colors
    val shape = RoundedCornerShape(26.dp)
    Box(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colors.heroGradient),
    ) {
        // Decorative light shapes, drawn behind the content.
        Canvas(Modifier.matchParentSize()) {
            drawCircle(Color.White.copy(alpha = 0.08f), radius = size.height * 0.75f, center = Offset(size.width * 1.02f, -size.height * 0.1f))
            drawCircle(Color.White.copy(alpha = 0.05f), radius = size.height * 0.55f, center = Offset(size.width * 0.15f, size.height * 1.25f))
        }
        Column(Modifier.padding(Spacing.xl)) {
            val overview = state.overview
            when {
                state.isLoading -> {
                    SkeletonBlock(Modifier.width(120.dp).height(14.dp))
                    Spacer(Modifier.height(Spacing.md))
                    SkeletonBlock(Modifier.width(200.dp).height(36.dp))
                    Spacer(Modifier.height(Spacing.md))
                    SkeletonBlock(Modifier.width(90.dp).height(20.dp))
                }
                overview?.account == null -> NoWalletHero(onCreateWallet, onImportWallet)
                else -> BalanceHero(overview, state.network, state.balanceHidden, onToggleBalance)
            }
        }
    }
}

@Composable
private fun NoWalletHero(onCreateWallet: () -> Unit, onImportWallet: () -> Unit) {
    Text("GET STARTED", style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.75f))
    Spacer(Modifier.height(Spacing.sm))
    Text("Your wallet, your keys", style = MaterialTheme.typography.headlineMedium, color = Color.White)
    Spacer(Modifier.height(Spacing.xs))
    Text(
        "Create a new wallet or import one from MetaMask or Trust Wallet to see your balance.",
        style = MaterialTheme.typography.bodyMedium,
        color = Color.White.copy(alpha = 0.85f),
    )
    Spacer(Modifier.height(Spacing.lg))
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        HeroButton("Create wallet", filled = true, onClick = onCreateWallet, modifier = Modifier.weight(1f))
        HeroButton("Import", filled = false, onClick = onImportWallet, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun HeroButton(text: String, filled: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(14.dp)
    Box(
        modifier
            .height(46.dp)
            .clip(shape)
            .background(if (filled) Color.White else Color.White.copy(alpha = 0.14f))
            .then(if (filled) Modifier else Modifier.border(1.dp, Color.White.copy(alpha = 0.3f), shape))
            .clickable(role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = MaterialTheme.typography.labelLarge, color = if (filled) VfxtTheme.colors.primary else Color.White)
    }
}

@Composable
private fun BalanceHero(overview: WalletOverview, network: EvmNetwork?, hidden: Boolean, onToggleBalance: () -> Unit) {
    // Testnet coins have no market value, so show the native balance itself instead of a fiat total.
    val testnet = network?.isTestnet == true
    val nativeHolding = overview.holdings.firstOrNull { it.token.kind == TokenKind.Native }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            if (testnet) "${network?.name} balance" else "Total balance · ${com.vfxt.wallet.core.common.FiatDisplay.effective.code}",
            style = MaterialTheme.typography.labelMedium,
            color = Color.White.copy(alpha = 0.8f),
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = onToggleBalance, modifier = Modifier.size(32.dp)) {
            Icon(
                if (hidden) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                contentDescription = if (hidden) "Show balance" else "Hide balance",
                tint = Color.White,
                modifier = Modifier.size(20.dp),
            )
        }
    }
    Spacer(Modifier.height(Spacing.xs))
    val total = overview.totalFiatValue
    Text(
        when {
            hidden -> HIDDEN_BALANCE
            testnet && nativeHolding?.rawBalance != null ->
                "${Formatters.tokenAmount(nativeHolding.rawBalance, nativeHolding.token.decimals, 4)} ${nativeHolding.token.symbol}"
            total != null -> Formatters.fiat(total)
            else -> "—"
        },
        style = MaterialTheme.typography.displayMedium,
        color = Color.White,
    )
    Spacer(Modifier.height(Spacing.sm))
    val change = overview.change24hPercent
    if (change != null && !hidden) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.16f))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            ) {
                Text(Formatters.percent(change), style = MaterialTheme.typography.labelMedium, color = Color.White)
            }
            Spacer(Modifier.width(Spacing.sm))
            Text("24h", style = MaterialTheme.typography.labelMedium, color = Color.White.copy(alpha = 0.75f))
        }
    } else if (testnet) {
        StatusPill("Test network · no market value", tone = PillTone.Neutral)
    } else if (total == null) {
        StatusPill("Price data unavailable", tone = PillTone.Neutral)
    }
}

// --- Previews (sample data is confined to previews) ---------------------------------------

// A function, not a top-level val: a val would run when this file's class loads on real devices
// (crashing the app if the token list ever outgrows the sample values).
private fun previewHoldings(): List<Holding> {
    val amounts = listOf(3L, 250L, 12000L)
    val fiat = listOf("1830.12", "250.00", "504.00")
    val change = listOf("2.41", "0.01", "-1.30")
    return TokenRegistry.defaultTokens(TokenRegistry.defaultNetwork).mapIndexed { i, token ->
        Holding(
            token = token,
            rawBalance = BigInteger.TEN.pow(token.decimals).multiply(BigInteger.valueOf(amounts[i % amounts.size])),
            fiatValue = BigDecimal(fiat[i % fiat.size]),
            change24hPercent = BigDecimal(change[i % change.size]),
        )
    }
}

@Preview(name = "Home – no wallet")
@Composable
private fun HomeNoWalletPreview() {
    VfxtTheme {
        Box(Modifier.background(VfxtTheme.colors.background)) {
            HomeContent(
                state = HomeUiState(
                    isLoading = false,
                    overview = WalletOverview(null, previewHoldings().map { it.copy(rawBalance = null, fiatValue = null, change24hPercent = null) }, emptyList(), null, null),
                ),
                onRefresh = {}, onToggleBalance = {}, onCreateWallet = {}, onImportWallet = {}, onNotify = {},
            )
        }
    }
}

@Preview(name = "Home – PREVIEW SAMPLE DATA")
@Composable
private fun HomeSamplePreview() {
    VfxtTheme {
        Box(Modifier.background(VfxtTheme.colors.background)) {
            HomeContent(
                state = HomeUiState(
                    isLoading = false,
                    overview = WalletOverview(
                        account = WalletAccount("1", "Main wallet", "0x0000000000000000000000000000000000000001"),
                        holdings = previewHoldings(),
                        activity = listOf(
                            ActivityItem("a", ActivityType.Received, "USDT", BigDecimal("120"), ActivityStatus.Confirmed, 1_761_900_000_000, null),
                            ActivityItem("b", ActivityType.MiningReward, "VFXT", BigDecimal("42.5"), ActivityStatus.Pending, 1_761_800_000_000, null),
                        ),
                        totalFiatValue = BigDecimal("2584.12"),
                        change24hPercent = BigDecimal("1.86"),
                    ),
                ),
                onRefresh = {}, onToggleBalance = {}, onCreateWallet = {}, onImportWallet = {}, onNotify = {},
            )
        }
    }
}
