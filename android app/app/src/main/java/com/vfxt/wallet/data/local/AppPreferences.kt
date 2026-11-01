package com.vfxt.wallet.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.vfxt.wallet.core.common.FiatCurrency
import com.vfxt.wallet.core.designsystem.theme.ThemeMode
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

private val Context.appDataStore: DataStore<Preferences> by preferencesDataStore(name = "app_preferences")

/** Auto-lock choices offered in Security settings. */
enum class AutoLock(val millis: Long, val label: String) {
    Immediately(0, "Immediately"),
    OneMinute(60_000, "1 min"),
    FiveMinutes(5 * 60_000, "5 min"),
    FifteenMinutes(15 * 60_000, "15 min"),
}

/** Non-sensitive UI and security preferences only. Wallet secrets never go through DataStore. */
@Singleton
class AppPreferences @Inject constructor(@ApplicationContext context: Context) {
    private val store = context.applicationContext.appDataStore

    val onboardingComplete: Flow<Boolean> = store.data.map { it[ONBOARDING_COMPLETE] ?: false }

    val themeMode: Flow<ThemeMode> = store.data.map { prefs ->
        prefs[THEME_MODE]?.let { runCatching { ThemeMode.valueOf(it) }.getOrNull() } ?: ThemeMode.Dark
    }

    val biometricEnabled: Flow<Boolean> = store.data.map { it[BIOMETRIC_ENABLED] ?: false }

    val autoLock: Flow<AutoLock> = store.data.map { prefs ->
        val millis = prefs[AUTO_LOCK_MS] ?: AutoLock.OneMinute.millis
        AutoLock.entries.firstOrNull { it.millis == millis } ?: AutoLock.OneMinute
    }

    val currency: Flow<FiatCurrency> = store.data.map { FiatCurrency.fromCode(it[CURRENCY]) }

    /** Last known USD→currency rate, kept so prices show correctly offline. */
    val cachedRates: Flow<Pair<Long, String>?> = store.data.map { prefs ->
        val at = prefs[RATES_AT] ?: return@map null
        val json = prefs[RATES_JSON] ?: return@map null
        at to json
    }

    /** Random per-install id used to list and remotely sign out devices. Not tied to hardware. */
    suspend fun installId(): String {
        store.data.first()[INSTALL_ID]?.let { return it }
        var id = ""
        store.edit { prefs ->
            id = prefs[INSTALL_ID] ?: UUID.randomUUID().toString().also { prefs[INSTALL_ID] = it }
        }
        return id
    }

    suspend fun setCurrency(currency: FiatCurrency) {
        store.edit { it[CURRENCY] = currency.code }
    }

    suspend fun setCachedRates(at: Long, json: String) {
        store.edit {
            it[RATES_AT] = at
            it[RATES_JSON] = json
        }
    }

    suspend fun setOnboardingComplete() {
        store.edit { it[ONBOARDING_COMPLETE] = true }
    }

    suspend fun setThemeMode(mode: ThemeMode) {
        store.edit { it[THEME_MODE] = mode.name }
    }

    suspend fun setBiometricEnabled(enabled: Boolean) {
        store.edit { it[BIOMETRIC_ENABLED] = enabled }
    }

    suspend fun setAutoLock(autoLock: AutoLock) {
        store.edit { it[AUTO_LOCK_MS] = autoLock.millis }
    }

    private companion object {
        val ONBOARDING_COMPLETE = booleanPreferencesKey("onboarding_complete")
        val THEME_MODE = stringPreferencesKey("theme_mode")
        val BIOMETRIC_ENABLED = booleanPreferencesKey("biometric_enabled")
        val AUTO_LOCK_MS = longPreferencesKey("auto_lock_ms")
        val CURRENCY = stringPreferencesKey("display_currency")
        val RATES_AT = longPreferencesKey("fx_rates_at")
        val RATES_JSON = stringPreferencesKey("fx_rates_json")
        val INSTALL_ID = stringPreferencesKey("install_id")
    }
}
