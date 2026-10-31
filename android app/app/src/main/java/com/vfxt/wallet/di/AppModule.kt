package com.vfxt.wallet.di

import com.vfxt.wallet.data.repository.FirebaseMiningRepository
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

    @Binds
    @Singleton
    abstract fun bindMiningRepository(impl: FirebaseMiningRepository): MiningRepository
}
