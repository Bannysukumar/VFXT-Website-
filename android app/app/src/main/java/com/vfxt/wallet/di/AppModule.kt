package com.vfxt.wallet.di

import com.vfxt.wallet.data.repository.PendingMiningRepository
import com.vfxt.wallet.data.repository.VaultWalletRepository
import com.vfxt.wallet.domain.repository.MiningRepository
import com.vfxt.wallet.domain.repository.WalletRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class AppModule {

    @Binds
    @Singleton
    abstract fun bindWalletRepository(impl: VaultWalletRepository): WalletRepository

    /** PENDING (Phase 4): replaced by the Cloud Run backed implementation. */
    @Binds
    @Singleton
    abstract fun bindMiningRepository(impl: PendingMiningRepository): MiningRepository
}
