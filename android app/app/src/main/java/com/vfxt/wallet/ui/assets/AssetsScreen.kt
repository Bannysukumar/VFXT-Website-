package com.vfxt.wallet.ui.assets

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.SearchOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.vfxt.wallet.blockchain.networks.Networks
import com.vfxt.wallet.blockchain.tokens.TokenRegistry
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.common.UNKNOWN_VALUE
import com.vfxt.wallet.core.designsystem.components.EmptyState
import com.vfxt.wallet.core.designsystem.components.ErrorState
import com.vfxt.wallet.core.designsystem.components.RowDivider
import com.vfxt.wallet.core.designsystem.components.ScreenHeader
import com.vfxt.wallet.core.designsystem.components.SkeletonListRow
import com.vfxt.wallet.core.designsystem.components.StatItem
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtIconButton
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.domain.models.Holding
import com.vfxt.wallet.domain.models.WalletOverview
import com.vfxt.wallet.ui.common.AssetRow

@Composable
fun AssetsScreen(
    onNotify: (String) -> Unit,
    viewModel: AssetsViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    AssetsContent(state, onQueryChange = viewModel::updateQuery, onRetry = viewModel::load, onNotify = onNotify)
}

@Composable
fun AssetsContent(
    state: AssetsUiState,
    onQueryChange: (String) -> Unit,
    onRetry: () -> Unit,
    onNotify: (String) -> Unit,
) {
    val colors = VfxtTheme.colors
    val addToken = { onNotify("Custom BEP-20 tokens can be added once on-chain validation is available.") }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = Spacing.xxl)) {
        item {
            ScreenHeader(
                "Assets",
                subtitle = "Tokens on your active network",
                trailing = { VfxtIconButton(Icons.Filled.Add, "Add custom token", addToken) },
            )
        }
        item {
            SummaryCard(state.overview, Modifier.padding(horizontal = Spacing.screen))
            Spacer(Modifier.height(Spacing.lg))
        }
        item {
            OutlinedTextField(
                value = state.query,
                onValueChange = onQueryChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.screen),
                placeholder = { Text("Search tokens", color = colors.textMuted) },
                leadingIcon = { Icon(Icons.Filled.Search, null, tint = colors.textSecondary) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
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
            Spacer(Modifier.height(Spacing.lg))
        }
        item {
            VfxtCard(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.screen),
                contentPadding = PaddingValues(Spacing.xs),
            ) {
                val holdings = state.visibleHoldings
                when {
                    state.isLoading -> repeat(3) { SkeletonListRow(Modifier.padding(horizontal = Spacing.md)) }
                    state.overview == null -> ErrorState(state.errorMessage ?: "Assets are unavailable.", onRetry)
                    holdings.isEmpty() -> EmptyState(
                        icon = Icons.Outlined.SearchOff,
                        title = "No tokens found",
                        message = "No supported token matches \"${state.query.trim()}\".",
                    )
                    else -> holdings.forEachIndexed { i, holding ->
                        if (i > 0) RowDivider()
                        AssetRow(
                            holding,
                            hideBalance = false,
                            onClick = { onNotify("Token details arrive with BSC integration.") },
                        )
                    }
                }
            }
        }
        item {
            Spacer(Modifier.height(Spacing.lg))
            VfxtSecondaryButton(
                "Add custom token",
                addToken,
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.screen),
                icon = Icons.Filled.Add,
            )
        }
    }
}

@Composable
private fun SummaryCard(overview: WalletOverview?, modifier: Modifier = Modifier) {
    val colors = VfxtTheme.colors
    VfxtCard(modifier.fillMaxWidth()) {
        Text("Total asset value", style = MaterialTheme.typography.labelMedium, color = colors.textSecondary)
        Spacer(Modifier.height(Spacing.xs))
        Text(
            overview?.totalFiatValue?.let { Formatters.fiat(it) } ?: UNKNOWN_VALUE,
            style = MaterialTheme.typography.displaySmall,
            color = colors.textPrimary,
        )
        if (overview?.account == null) {
            Text("Set up a wallet to see balances", style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
        }
        Spacer(Modifier.height(Spacing.lg))
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
            StatItem("Tokens", "${overview?.holdings?.size ?: 0}", Modifier.weight(1f))
            StatItem("Network", Networks.BscMainnet.shortName, Modifier.weight(1f))
            StatItem("Chain ID", "${Networks.BscMainnet.chainId}", Modifier.weight(1f))
        }
    }
}

@Preview
@Composable
private fun AssetsPreview() {
    val holdings = TokenRegistry.defaultTokens(TokenRegistry.defaultNetwork).map { Holding(it, null, null, null) }
    VfxtTheme {
        Box(Modifier.background(VfxtTheme.colors.background)) {
            AssetsContent(
                AssetsUiState(isLoading = false, overview = WalletOverview(null, holdings, emptyList(), null, null)),
                {}, {}, {},
            )
        }
    }
}
