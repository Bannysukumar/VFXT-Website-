package com.vfxt.wallet.ui.security

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vfxt.wallet.core.designsystem.components.IconTile
import com.vfxt.wallet.core.designsystem.components.PinDots
import com.vfxt.wallet.core.designsystem.components.PinPad
import com.vfxt.wallet.core.designsystem.components.VfxtBottomSheet
import com.vfxt.wallet.core.designsystem.components.VfxtLogoMark
import com.vfxt.wallet.core.designsystem.components.VfxtPrimaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtTextButton
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.components.lockoutLabel
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.core.security.BiometricAuthenticator
import com.vfxt.wallet.core.security.PinManager
import kotlinx.coroutines.delay

@Composable
private fun rememberNow(active: Boolean): Long {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(active) {
        while (active) {
            now = System.currentTimeMillis()
            delay(1000)
        }
    }
    return now
}

/** Shared PIN entry body: title, dots, status line and keypad. */
@Composable
private fun PinEntryBody(
    title: String,
    subtitle: String,
    state: PinEntryState,
    onDigit: (Char) -> Unit,
    onBackspace: () -> Unit,
    onBiometric: (() -> Unit)?,
) {
    val colors = VfxtTheme.colors
    val lockedUntil = state.lockedUntil
    val now = rememberNow(lockedUntil != null)
    val lockedOut = lockedUntil != null && lockedUntil > now
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, style = MaterialTheme.typography.headlineSmall, color = colors.textPrimary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(Spacing.xs))
        Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(Spacing.xxl))
        PinDots(state.entered, PinManager.PIN_LENGTH, isError = state.error != null, errorKey = state.errorKey)
        Spacer(Modifier.height(Spacing.md))
        Text(
            when {
                lockedOut -> lockoutLabel(lockedUntil!!, now)
                else -> state.error.orEmpty()
            },
            style = MaterialTheme.typography.bodySmall,
            color = colors.error,
            modifier = Modifier.height(18.dp),
        )
        Spacer(Modifier.height(Spacing.xl))
        PinPad(onDigit, onBackspace, onBiometric = onBiometric, enabled = !lockedOut && !state.busy)
    }
}

/** Full-screen lock shown over the app on launch and after auto-lock. */
@Composable
fun LockScreen(
    verifyViewModel: PinVerifyViewModel = hiltViewModel(key = "lock"),
    lockViewModel: LockViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val state by verifyViewModel.state.collectAsStateWithLifecycle()
    val biometric by verifyViewModel.biometricEnabled.collectAsStateWithLifecycle()
    val canUseBiometric = biometric && remember { BiometricAuthenticator.isAvailable(context) }
    val promptBiometric = {
        BiometricAuthenticator.authenticate(
            context,
            title = "Unlock VFXT Wallet",
            onSuccess = verifyViewModel::onBiometricSuccess,
        )
    }

    LaunchedEffect(Unit) { verifyViewModel.verified.collect { lockViewModel.unlock() } }
    LaunchedEffect(canUseBiometric) { if (canUseBiometric) promptBiometric() }
    // Back from the lock screen leaves the app rather than revealing content underneath.
    BackHandler { (context as? Activity)?.moveTaskToBack(true) }

    Box(
        Modifier
            .fillMaxSize()
            .background(VfxtTheme.colors.background)
            // Swallow touches so nothing underneath is reachable.
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
            .safeDrawingPadding(),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            VfxtLogoMark(size = 56.dp)
            Spacer(Modifier.height(Spacing.xxl))
            PinEntryBody(
                title = "Welcome back",
                subtitle = "Enter your PIN to unlock",
                state = state,
                onDigit = verifyViewModel::onDigit,
                onBackspace = verifyViewModel::onBackspace,
                onBiometric = if (canUseBiometric) promptBiometric else null,
            )
        }
    }
}

/**
 * Bottom sheet that re-authenticates the user (PIN or biometrics) before a sensitive action such
 * as revealing a recovery phrase. [onAuthenticated] runs only after a successful check.
 */
@Composable
fun AuthenticateSheet(
    reason: String,
    onAuthenticated: () -> Unit,
    onDismiss: () -> Unit,
    viewModel: PinVerifyViewModel = hiltViewModel(key = "auth"),
) {
    val context = LocalContext.current
    val state by viewModel.state.collectAsStateWithLifecycle()
    val biometric by viewModel.biometricEnabled.collectAsStateWithLifecycle()
    val canUseBiometric = biometric && remember { BiometricAuthenticator.isAvailable(context) }

    LaunchedEffect(Unit) {
        viewModel.reset()
        viewModel.verified.collect { onAuthenticated() }
    }

    VfxtBottomSheet(onDismiss) {
        PinEntryBody(
            title = "Confirm it's you",
            subtitle = reason,
            state = state,
            onDigit = viewModel::onDigit,
            onBackspace = viewModel::onBackspace,
            onBiometric = if (canUseBiometric) {
                { BiometricAuthenticator.authenticate(context, title = "Confirm it's you", subtitle = reason, onSuccess = viewModel::onBiometricSuccess) }
            } else {
                null
            },
        )
    }
}

/** Create (or change) the app PIN. */
@Composable
fun PinSetupScreen(
    onDone: () -> Unit,
    onBack: (() -> Unit)?,
    title: String = "Create a PIN",
    viewModel: PinSetupViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.done.collect { onDone() } }
    // First-time setup can't be skipped: a wallet must not exist without a PIN.
    if (onBack == null) BackHandler {}

    Column(
        Modifier
            .fillMaxSize()
            .background(VfxtTheme.colors.background)
            .safeDrawingPadding(),
    ) {
        if (onBack != null) VfxtTopBar(title, onBack) else Spacer(Modifier.height(Spacing.huge))
        Spacer(Modifier.weight(1f))
        PinEntryBody(
            title = if (state.stage == PinSetupStage.Enter) title else "Confirm your PIN",
            subtitle = if (state.stage == PinSetupStage.Enter) {
                "Choose a ${PinManager.PIN_LENGTH}-digit PIN to unlock your wallet and approve transactions."
            } else {
                "Enter the same PIN again."
            },
            state = PinEntryState(entered = state.entered, error = state.error, errorKey = state.errorKey, busy = state.saving),
            onDigit = viewModel::onDigit,
            onBackspace = viewModel::onBackspace,
            onBiometric = null,
        )
        Spacer(Modifier.weight(1f))
    }
}

/** Offered once after PIN setup when the device has strong biometrics enrolled. */
@Composable
fun BiometricSetupScreen(
    onDone: () -> Unit,
    viewModel: SecuritySettingsViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val colors = VfxtTheme.colors
    BackHandler { onDone() }
    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .safeDrawingPadding()
            .padding(horizontal = Spacing.screen),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Spacer(Modifier.weight(1f))
        IconTile(Icons.Outlined.Fingerprint, colors.primary, size = 96.dp)
        Spacer(Modifier.height(Spacing.xxl))
        Text("Unlock with biometrics", style = MaterialTheme.typography.headlineMedium, color = colors.textPrimary)
        Spacer(Modifier.height(Spacing.sm))
        Text(
            "Use your fingerprint or face to unlock VFXT Wallet. Your PIN always works as a backup.",
            style = MaterialTheme.typography.bodyLarge,
            color = colors.textSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.weight(1f))
        VfxtPrimaryButton(
            "Enable biometrics",
            onClick = {
                BiometricAuthenticator.authenticate(
                    context,
                    title = "Enable biometric unlock",
                    onSuccess = {
                        viewModel.setBiometric(true)
                        onDone()
                    },
                )
            },
            modifier = Modifier.fillMaxWidth(),
            icon = Icons.Outlined.Fingerprint,
        )
        Spacer(Modifier.height(Spacing.sm))
        VfxtTextButton("Not now", onDone, color = colors.textSecondary)
        Spacer(Modifier.height(Spacing.lg).size(0.dp))
    }
}
