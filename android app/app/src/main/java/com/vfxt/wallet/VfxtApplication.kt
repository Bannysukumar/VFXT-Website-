package com.vfxt.wallet

import android.app.Application
import com.vfxt.wallet.core.security.AppLockManager
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class VfxtApplication : Application() {

    @Inject lateinit var appLockManager: AppLockManager

    override fun onCreate() {
        super.onCreate()
        appLockManager.start()
    }
}
