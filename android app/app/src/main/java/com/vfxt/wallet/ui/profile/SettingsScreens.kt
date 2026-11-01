package com.vfxt.wallet.ui.profile

import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.vfxt.wallet.BuildConfig
import com.vfxt.wallet.blockchain.walletconnect.WalletConnectSessionManager
import com.vfxt.wallet.blockchain.walletconnect.WcConnectionState
import com.vfxt.wallet.core.common.FiatCurrency
import com.vfxt.wallet.core.common.FiatDisplay
import com.vfxt.wallet.core.common.Formatters
import com.vfxt.wallet.core.designsystem.components.IconTile
import com.vfxt.wallet.core.designsystem.components.PillTone
import com.vfxt.wallet.core.designsystem.components.SectionHeader
import com.vfxt.wallet.core.designsystem.components.StatusPill
import com.vfxt.wallet.core.designsystem.components.VfxtCard
import com.vfxt.wallet.core.designsystem.components.VfxtSecondaryButton
import com.vfxt.wallet.core.designsystem.components.VfxtTextButton
import com.vfxt.wallet.core.designsystem.components.VfxtTopBar
import com.vfxt.wallet.core.designsystem.theme.Spacing
import com.vfxt.wallet.core.designsystem.theme.VfxtTheme
import com.vfxt.wallet.data.remote.AccountDevice
import com.vfxt.wallet.data.remote.AccountSession
import com.vfxt.wallet.data.remote.AuthException
import com.vfxt.wallet.data.remote.CurrencyService
import com.vfxt.wallet.data.remote.FirebaseWalletAuth
import com.vfxt.wallet.domain.repository.WalletRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

// --- Currency --------------------------------------------------------------------------------

@HiltViewModel
class CurrencyViewModel @Inject constructor(private val currencies: CurrencyService) : ViewModel() {
    fun select(currency: FiatCurrency) {
        viewModelScope.launch { currencies.select(currency) }
    }
}

@Composable
fun CurrencyScreen(onBack: () -> Unit, viewModel: CurrencyViewModel = hiltViewModel()) {
    val colors = VfxtTheme.colors
    var query by remember { mutableStateOf("") }
    val selected = FiatDisplay.selected
    val shown = FiatCurrency.entries.filter {
        query.isBlank() || it.code.contains(query.trim(), true) || it.label.contains(query.trim(), true)
    }
    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .safeDrawingPadding(),
    ) {
        VfxtTopBar("Currency", onBack)
        Column(Modifier.padding(horizontal = Spacing.screen)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search currency", color = colors.textMuted) },
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
            Text(
                "Prices are fetched in USD and converted with daily exchange rates (open.er-api.com). Values are for display only.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
            if (selected != FiatDisplay.effective) {
                Spacer(Modifier.height(Spacing.xs))
                Text("Loading ${selected.code} rate… showing USD until it's available.", style = MaterialTheme.typography.bodySmall, color = colors.warning)
            }
        }
        LazyColumn(contentPadding = PaddingValues(horizontal = Spacing.screen, vertical = Spacing.sm)) {
            items(shown, key = { it.code }) { currency ->
                val isSel = currency == selected
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isSel) colors.primary.copy(alpha = 0.10f) else colors.background)
                        .clickable(role = Role.RadioButton) { viewModel.select(currency) }
                        .padding(horizontal = Spacing.md, vertical = Spacing.md),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(currency.symbol.trim(), style = MaterialTheme.typography.titleMedium, color = colors.primary, modifier = Modifier.width(56.dp))
                    Column(Modifier.weight(1f)) {
                        Text(currency.code, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                        Text(currency.label, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                    }
                    if (isSel) Icon(Icons.Filled.CheckCircle, contentDescription = "Selected", tint = colors.primary)
                }
                HorizontalDivider(color = colors.border.copy(alpha = 0.4f))
            }
        }
    }
}

// --- Active sessions -------------------------------------------------------------------------

@HiltViewModel
class SessionsViewModel @Inject constructor(
    private val auth: FirebaseWalletAuth,
    walletRepository: WalletRepository,
    private val walletConnect: WalletConnectSessionManager,
) : ViewModel() {
    private val accountState = MutableStateFlow(auth.session)
    val account: StateFlow<AccountSession?> = accountState.asStateFlow()

    val walletAddress: StateFlow<String?> =
        walletRepository.activeAccount.map { it?.address }.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val dapps: StateFlow<WcConnectionState> = walletConnect.state

    private val devicesState = MutableStateFlow<OtherDevices>(OtherDevices.Loading)
    val otherDevices: StateFlow<OtherDevices> = devicesState.asStateFlow()

    private val messageState = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = messageState.asStateFlow()

    init {
        refreshDevices()
    }

    fun refreshDevices() {
        if (auth.session == null) {
            devicesState.value = OtherDevices.SignedOut
            return
        }
        devicesState.value = OtherDevices.Loading
        viewModelScope.launch {
            devicesState.value = try {
                OtherDevices.Loaded(auth.otherDevices())
            } catch (e: AuthException) {
                OtherDevices.Error(e.message ?: "Couldn't load devices")
            }
        }
    }

    fun signOutOtherDevices() {
        devicesState.value = OtherDevices.Working
        viewModelScope.launch {
            try {
                val count = auth.signOutOtherDevices()
                messageState.value = if (count == 0) "No other devices were signed in." else "Signed out $count other device${if (count == 1) "" else "s"}."
            } catch (e: AuthException) {
                messageState.value = e.message ?: "Couldn't sign out other devices"
            }
            accountState.value = auth.session
            refreshDevices()
        }
    }

    fun signOut() {
        viewModelScope.launch {
            auth.signOut()
            accountState.value = auth.session
            devicesState.value = OtherDevices.SignedOut
        }
    }

    fun disconnectDapps() = walletConnect.disconnectAll()
}

sealed interface OtherDevices {
    data object Loading : OtherDevices
    data object Working : OtherDevices
    data object SignedOut : OtherDevices
    data class Loaded(val devices: List<AccountDevice>) : OtherDevices
    data class Error(val message: String) : OtherDevices
}

@Composable
fun SessionsScreen(onBack: () -> Unit, viewModel: SessionsViewModel = hiltViewModel()) {
    val colors = VfxtTheme.colors
    val account by viewModel.account.collectAsStateWithLifecycle()
    val address by viewModel.walletAddress.collectAsStateWithLifecycle()
    val dapps by viewModel.dapps.collectAsStateWithLifecycle()
    val others by viewModel.otherDevices.collectAsStateWithLifecycle()
    val message by viewModel.message.collectAsStateWithLifecycle()
    var confirmSignOut by remember { mutableStateOf(false) }
    var confirmOthers by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .safeDrawingPadding(),
    ) {
        VfxtTopBar("Active sessions", onBack)
        Column(
            Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
        ) {
            SectionHeader("This device")
            VfxtCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconTile(Icons.Outlined.PhoneAndroid, colors.primary, size = 44.dp)
                    Spacer(Modifier.width(Spacing.md))
                    Column(Modifier.weight(1f)) {
                        Text("${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}", style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                        Text("Android ${Build.VERSION.RELEASE} · VFXT Wallet ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                    }
                    StatusPill("Current", tone = PillTone.Success, showDot = true)
                }
                Spacer(Modifier.height(Spacing.md))
                HorizontalDivider(color = colors.border.copy(alpha = 0.5f))
                Spacer(Modifier.height(Spacing.md))
                InfoLine("Wallet", address?.let(Formatters::shortAddress) ?: "None")
                InfoLine("VFXT account", if (account != null) "Signed in" else "Signed out")
                account?.lastSignInMillis?.let { InfoLine("Last sign-in", Formatters.dateTime(it)) }
                account?.createdAtMillis?.let { InfoLine("Account created", Formatters.dateTime(it)) }
                account?.email?.let { InfoLine("Email", it) }
                if (account != null) {
                    Spacer(Modifier.height(Spacing.md))
                    VfxtSecondaryButton("Sign out of VFXT account", { confirmSignOut = true }, Modifier.fillMaxWidth(), icon = Icons.AutoMirrored.Outlined.Logout)
                }
            }

            SectionHeader("Other devices")
            VfxtCard(Modifier.fillMaxWidth()) {
                when (val o = others) {
                    OtherDevices.Loading, OtherDevices.Working -> Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.size(18.dp), color = colors.primary, strokeWidth = 2.dp)
                        Spacer(Modifier.width(Spacing.md))
                        Text(
                            if (o == OtherDevices.Working) "Signing out other devices…" else "Loading devices…",
                            style = MaterialTheme.typography.bodyMedium,
                            color = colors.textSecondary,
                        )
                    }
                    OtherDevices.SignedOut -> Text(
                        "Sign in to your VFXT account (open Mining) to see other devices.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textSecondary,
                    )
                    is OtherDevices.Error -> {
                        Text(o.message, style = MaterialTheme.typography.bodyMedium, color = colors.error)
                        VfxtTextButton("Retry", viewModel::refreshDevices)
                    }
                    is OtherDevices.Loaded -> {
                        if (o.devices.isEmpty()) {
                            Text("No other devices are signed in to this account.", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
                        }
                        o.devices.forEach { d ->
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = Spacing.xs)) {
                                IconTile(Icons.Outlined.PhoneAndroid, colors.textSecondary, size = 36.dp)
                                Spacer(Modifier.width(Spacing.md))
                                Column(Modifier.weight(1f)) {
                                    Text(d.model, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                                    val meta = listOfNotNull(
                                        d.osVersion.takeIf { it.isNotBlank() }?.let { "Android $it" },
                                        d.appVersion.takeIf { it.isNotBlank() }?.let { "v$it" },
                                        d.lastSeenMillis?.let { "Last active ${Formatters.dateTime(it)}" },
                                    ).joinToString(" · ")
                                    if (meta.isNotEmpty()) Text(meta, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                                }
                            }
                        }
                        if (o.devices.isNotEmpty()) {
                            Spacer(Modifier.height(Spacing.md))
                            VfxtSecondaryButton("Sign out all other devices", { confirmOthers = true }, Modifier.fillMaxWidth(), icon = Icons.AutoMirrored.Outlined.Logout)
                        }
                    }
                }
                message?.let {
                    Spacer(Modifier.height(Spacing.sm))
                    Text(it, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
                }
            }

            SectionHeader("Connected dApps")
            VfxtCard(Modifier.fillMaxWidth()) {
                when (val d = dapps) {
                    is WcConnectionState.Connected -> {
                        d.sessions.forEach { s ->
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = Spacing.xs)) {
                                IconTile(Icons.Outlined.Link, colors.accent, size = 36.dp)
                                Spacer(Modifier.width(Spacing.md))
                                Column(Modifier.weight(1f)) {
                                    Text(s.peerName, style = MaterialTheme.typography.titleSmall, color = colors.textPrimary)
                                    s.peerUrl?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary) }
                                }
                            }
                        }
                        Spacer(Modifier.height(Spacing.sm))
                        VfxtTextButton("Disconnect all", viewModel::disconnectDapps, color = colors.error)
                    }
                    else -> Row(verticalAlignment = Alignment.CenterVertically) {
                        IconTile(Icons.Outlined.CloudOff, colors.textSecondary, size = 36.dp)
                        Spacer(Modifier.width(Spacing.md))
                        Text("No dApps are connected to this wallet.", style = MaterialTheme.typography.bodyMedium, color = colors.textSecondary)
                    }
                }
            }

            VfxtCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.Top) {
                    Icon(Icons.Outlined.WarningAmber, null, tint = colors.warning, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(Spacing.sm))
                    Text(
                        "Your wallet is self-custody: anyone with your recovery phrase controls the funds on any device. " +
                            "If you think your phrase was exposed, signing out won't protect it. Create a new wallet and move your funds.",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textSecondary,
                    )
                }
            }
            Spacer(Modifier.height(Spacing.lg))
        }
    }

    if (confirmOthers) {
        AlertDialog(
            onDismissRequest = { confirmOthers = false },
            containerColor = colors.surface,
            title = { Text("Sign out all other devices?", color = colors.textPrimary) },
            text = {
                Text(
                    "Other devices lose access to mining and notifications on this VFXT account and can't sign back in " +
                        "without reinstalling the app. This device stays signed in. Their wallets and funds are not affected.",
                    color = colors.textSecondary,
                )
            },
            confirmButton = { VfxtTextButton("Sign out others", { confirmOthers = false; viewModel.signOutOtherDevices() }, color = colors.error) },
            dismissButton = { VfxtTextButton("Cancel", { confirmOthers = false }, color = colors.textSecondary) },
        )
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            containerColor = colors.surface,
            title = { Text("Sign out of VFXT account?", color = colors.textPrimary) },
            text = {
                Text(
                    "This signs this device out of mining and notifications. Your wallet and funds stay on this device. " +
                        "You'll be signed back in automatically (by wallet signature) the next time you open Mining.",
                    color = colors.textSecondary,
                )
            },
            confirmButton = { VfxtTextButton("Sign out", { confirmSignOut = false; viewModel.signOut() }, color = colors.error) },
            dismissButton = { VfxtTextButton("Cancel", { confirmSignOut = false }, color = colors.textSecondary) },
        )
    }
}

@Composable
private fun InfoLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = VfxtTheme.colors.textSecondary, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodySmall, color = VfxtTheme.colors.textPrimary)
    }
}
