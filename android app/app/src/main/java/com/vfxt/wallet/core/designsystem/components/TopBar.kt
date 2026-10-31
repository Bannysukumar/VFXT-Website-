package com.vfxt.wallet.core.designsystem.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme

/** Back-arrow top bar for pushed (non-tab) screens. */
@Composable
fun VfxtTopBar(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.lg, vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        VfxtIconButton(Icons.AutoMirrored.Filled.ArrowBack, "Back", onBack)
        Text(
            title,
            style = MaterialTheme.typography.titleLarge,
            color = VfxtTheme.colors.textPrimary,
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = Spacing.md)
                .semantics { heading() },
        )
        // Keeps the title optically centered between equal-width slots.
        if (trailing != null) trailing() else Spacer(Modifier.size(42.dp))
    }
}
