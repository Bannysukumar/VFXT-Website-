package com.vfxt.wallet

import android.app.Application
import com.vfxt.wallet.blockchain.walletconnect.WalletConnectSessionManager
import com.vfxt.wallet.core.security.AppLockManager
import com.vfxt.wallet.data.remote.CurrencyService
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class VfxtApplication : Application() {

    @Inject lateinit var appLockManager: AppLockManager
    @Inject lateinit var currencyService: CurrencyService
    @Inject lateinit var walletConnect: WalletConnectSessionManager

    override fun onCreate() {
        super.onCreate()
        appLockManager.start()
        currencyService.start()
        walletConnect.initialize(this)
    }
}
