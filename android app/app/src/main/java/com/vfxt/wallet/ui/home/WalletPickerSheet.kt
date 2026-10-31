package com.vfxt.wallet.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.designsystem.components.VfxtBottomSheet
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.domain.models.WalletAccount

@Composable
fun WalletPickerSheet(
    accounts: List<WalletAccount>,
    activeId: String?,
    onSelect: (String) -> Unit,
    onManage: () -> Unit,
    onDismiss: () -> Unit,
) {
    val colors = VfxtTheme.colors
    VfxtBottomSheet(onDismiss) {
        Text("Select wallet", style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
        Spacer(Modifier.height(Spacing.lg))
        Column {
            accounts.forEach { account ->
                val active = account.id == activeId
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = Spacing.xs)
                        .clip(RoundedCornerShape(16.dp))
                        .background(if (active) colors.primary.copy(alpha = 0.10f) else colors.card)
                        .border(1.dp, if (active) colors.primary else colors.border, RoundedCornerShape(16.dp))
                        .clickable(role = Role.RadioButton) { onSelect(account.id) }
                        .padding(Spacing.md),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(colors.brandGradient),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(account.name.take(1).uppercase(), style = MaterialTheme.typography.titleMedium, color = colors.onPrimary)
                    }
                    Spacer(Modifier.width(Spacing.md))
                    Column(Modifier.weight(1f)) {
                        Text(account.name, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                        Text(Formatters.shortAddress(account.address), style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                    }
                    if (active) Icon(Icons.Filled.CheckCircle, contentDescription = "Selected", tint = colors.primary)
                }
            }
        }
        Spacer(Modifier.height(Spacing.lg))
        VfxtSecondaryButton("Manage wallets", onManage, Modifier.fillMaxWidth(), icon = Icons.Outlined.Settings)
    }
}
