package com.vfxt.wallet.ui.wallet

import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.vfxt.wallet.core.designsystem.components.PillTone
import com.vfxt.wallet.core.designsystem.components.StatusPill
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtIconButton
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtSegmentedControl
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.core.security.SecureScreen

/** Fast format checks for UI hints; full BIP-39 checksum and secp256k1 range checks run in [ImportWalletViewModel]. */
internal object ImportInputRules {
    private val PRIVATE_KEY = Regex("^(0x)?[0-9a-fA-F]{64}$")
    private val WORD = Regex("^[a-z]+$")
    val ACCEPTED_WORD_COUNTS = setOf(12, 24)

    fun words(input: String): List<String> = input.trim().lowercase().split(Regex("\\s+")).filter { it.isNotEmpty() }

    fun isPhraseShapeValid(input: String): Boolean {
        val w = words(input)
        return w.size in ACCEPTED_WORD_COUNTS && w.all { WORD.matches(it) }
    }

    fun isPrivateKeyShapeValid(input: String) = PRIVATE_KEY.matches(input.trim())
}

@Composable
fun ImportWalletScreen(
    onBack: () -> Unit,
    onWalletAdded: (WalletAddedNext) -> Unit,
    viewModel: ImportWalletViewModel = hiltViewModel(),
) {
    // Block screenshots/recents previews while secrets may be on screen.
    SecureScreen()

    val colors = VfxtTheme.colors
    var mode by rememberSaveable { mutableIntStateOf(0) }
    // Secrets are kept in plain `remember` (never rememberSaveable) so they are not written into
    // the saved-instance-state bundle, and are dropped as soon as this screen leaves composition.
    var phrase by remember { mutableStateOf("") }
    var privateKey by remember { mutableStateOf("") }
    var showKey by remember { mutableStateOf(false) }
    var accountIndex by rememberSaveable { mutableIntStateOf(0) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(mode, phrase, privateKey, accountIndex) {
        viewModel.onInputChanged(isPhrase = mode == 0, input = if (mode == 0) phrase else privateKey, accountIndex = accountIndex)
    }
    LaunchedEffect(Unit) { viewModel.added.collect(onWalletAdded) }

    val wordCount = ImportInputRules.words(phrase).size
    val shapeOk = if (mode == 0) ImportInputRules.isPhraseShapeValid(phrase) else ImportInputRules.isPrivateKeyShapeValid(privateKey)
    val engineOk = if (mode == 0) state.phraseValid else state.keyValid
    val canImport = shapeOk && engineOk && !state.saving

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .safeDrawingPadding()
            .imePadding(),
    ) {
        VfxtTopBar("Import wallet", onBack)
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
        ) {
            Text("Bring your wallet", style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary)
            Spacer(Modifier.height(Spacing.xs))
            Text(
                "Works with MetaMask, Trust Wallet and other EVM wallets. Your secret never leaves this device.",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textSecondary,
            )
            Spacer(Modifier.height(Spacing.xl))
            VfxtSegmentedControl(
                options = listOf("Recovery phrase", "Private key"),
                selectedIndex = mode,
                onSelect = { mode = it },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(Spacing.xl))

            val fieldColors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = colors.primary,
                unfocusedBorderColor = colors.border,
                focusedContainerColor = colors.card,
                unfocusedContainerColor = colors.card,
                cursorColor = colors.primary,
                focusedTextColor = colors.textPrimary,
                unfocusedTextColor = colors.textPrimary,
            )
            // KeyboardType.Password asks the IME not to learn or suggest these words.
            val secretKeyboard = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                autoCorrectEnabled = false,
                imeAction = ImeAction.Done,
            )

            if (mode == 0) {
                OutlinedTextField(
                    value = phrase,
                    onValueChange = { phrase = it },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 140.dp),
                    placeholder = { Text("Enter your 12 or 24 word recovery phrase, separated by spaces", color = colors.textMuted) },
                    keyboardOptions = secretKeyboard,
                    shape = RoundedCornerShape(16.dp),
                    colors = fieldColors,
                    textStyle = MaterialTheme.typography.bodyLarge,
                )
                Spacer(Modifier.height(Spacing.sm))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val tone = when {
                        wordCount == 0 -> PillTone.Neutral
                        state.phraseValid -> PillTone.Success
                        else -> PillTone.Warning
                    }
                    StatusPill("$wordCount words", tone = tone)
                    Spacer(Modifier.width(Spacing.sm))
                    Text(
                        when {
                            state.phraseValid -> "Valid recovery phrase"
                            shapeOk && !state.phraseValid -> "Checksum doesn't match. Check each word."
                            else -> "12 or 24 words accepted"
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = if (shapeOk && !state.phraseValid) colors.warning else colors.textMuted,
                    )
                }
                Spacer(Modifier.height(Spacing.xl))
                DerivationCard(accountIndex = accountIndex, onIndexChange = { accountIndex = it })
            } else {
                OutlinedTextField(
                    value = privateKey,
                    onValueChange = { privateKey = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("64-character hex private key", color = colors.textMuted) },
                    singleLine = true,
                    keyboardOptions = secretKeyboard,
                    visualTransformation = if (showKey) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { showKey = !showKey }) {
                            Icon(
                                if (showKey) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                contentDescription = if (showKey) "Hide private key" else "Show private key",
                                tint = colors.textSecondary,
                            )
                        }
                    },
                    shape = RoundedCornerShape(16.dp),
                    colors = fieldColors,
                )
                Spacer(Modifier.height(Spacing.sm))
                Text(
                    if (shapeOk && !state.keyValid) {
                        "This isn't a valid secp256k1 private key."
                    } else {
                        "With or without the 0x prefix. A private key imports a single account."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (shapeOk && !state.keyValid) colors.warning else colors.textMuted,
                )
            }

            state.previewAddress?.let { address ->
                Spacer(Modifier.height(Spacing.xl))
                VfxtCard(Modifier.fillMaxWidth()) {
                    Text("Wallet address", style = MaterialTheme.typography.labelMedium, color = colors.textSecondary)
                    Spacer(Modifier.height(Spacing.xs))
                    Text(address, style = MaterialTheme.typography.bodyMedium, color = colors.textPrimary)
                    Spacer(Modifier.height(Spacing.xs))
                    Text(
                        "Confirm this matches the address shown in your other wallet.",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                    )
                }
            }
            state.error?.let {
                Spacer(Modifier.height(Spacing.md))
                Text(it, style = MaterialTheme.typography.bodyMedium, color = colors.error)
            }

            Spacer(Modifier.height(Spacing.xl))
            Row(verticalAlignment = Alignment.Top) {
                Icon(Icons.Outlined.Info, null, tint = colors.warning, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(Spacing.sm))
                Text(
                    "VFXT will never ask for your recovery phrase or private key over chat, email or phone.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textSecondary,
                )
            }
            Spacer(Modifier.height(Spacing.xl))
        }
        VfxtPrimaryButton(
            text = "Import wallet",
            onClick = { viewModel.import(isPhrase = mode == 0, input = if (mode == 0) phrase else privateKey, accountIndex = accountIndex) },
            enabled = canImport,
            loading = state.saving,
            icon = Icons.Outlined.Download,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
        )
    }
}

/**
 * Shows the BIP-44 path that will be derived. MetaMask and Trust Wallet both use
 * m/44'/60'/0'/0/{index}; account 1 in those apps is index 0 here.
 */
@Composable
private fun DerivationCard(accountIndex: Int, onIndexChange: (Int) -> Unit) {
    val colors = VfxtTheme.colors
    VfxtCard(Modifier.fillMaxWidth()) {
        Text("Derivation path", style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
        Spacer(Modifier.height(Spacing.xs))
        Text(
            "m/44'/60'/0'/0/$accountIndex",
            style = MaterialTheme.typography.titleMedium,
            color = colors.electric,
        )
        Spacer(Modifier.height(Spacing.xs))
        Text(
            "Standard Ethereum path used by MetaMask and Trust Wallet. Pick a higher index to restore additional accounts.",
            style = MaterialTheme.typography.bodySmall,
            color = colors.textSecondary,
        )
        Spacer(Modifier.height(Spacing.md))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Account", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary, modifier = Modifier.weight(1f))
            VfxtIconButton(Icons.Filled.Remove, "Previous account", onClick = { if (accountIndex > 0) onIndexChange(accountIndex - 1) })
            Text(
                "${accountIndex + 1}",
                style = MaterialTheme.typography.titleMedium,
                color = colors.textPrimary,
                modifier = Modifier.padding(horizontal = Spacing.lg),
            )
            VfxtIconButton(Icons.Filled.Add, "Next account", onClick = { if (accountIndex < 99) onIndexChange(accountIndex + 1) })
        }
    }
}

@Preview
@Composable
private fun ImportWalletPreview() {
    VfxtTheme { ImportWalletScreen(onBack = {}, onWalletAdded = {}) }
}
