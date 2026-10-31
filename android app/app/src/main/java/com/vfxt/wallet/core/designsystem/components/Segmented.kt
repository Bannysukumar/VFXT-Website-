package com.vfxt.wallet.core.designsystem.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme

/** Pill-style segmented control. Segments share the width equally. */
@Composable
fun VfxtSegmentedControl(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = VfxtTheme.colors
    Row(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(colors.card)
            .border(1.dp, colors.border, RoundedCornerShape(14.dp))
            .padding(4.dp)
            .selectableGroup(),
    ) {
        options.forEachIndexed { index, label ->
            val selected = index == selectedIndex
            val bg by animateColorAsState(if (selected) colors.primary else colors.card, label = "segBg")
            val fg by animateColorAsState(if (selected) colors.onPrimary else colors.textSecondary, label = "segFg")
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(bg)
                    .selectable(selected = selected, role = Role.Tab, onClick = { onSelect(index) })
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(label, style = MaterialTheme.typography.labelLarge, color = fg, maxLines = 1)
            }
        }
    }
}

/** Compact chip used for chart intervals and filters. */
@Composable
fun VfxtChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = VfxtTheme.colors
    val bg by animateColorAsState(if (selected) colors.primary.copy(alpha = 0.18f) else colors.card, label = "chipBg")
    val fg by animateColorAsState(if (selected) colors.primary else colors.textSecondary, label = "chipFg")
    Box(
        modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(1.dp, if (selected) colors.primary.copy(alpha = 0.5f) else colors.border, RoundedCornerShape(10.dp))
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 7.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = fg)
    }
}
