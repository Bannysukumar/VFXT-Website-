package com.vfxt.wallet.domain.repository

import com.vfxt.wallet.domain.models.MiningOverview
import com.vfxt.wallet.domain.models.WalletAccount
import com.vfxt.wallet.domain.models.WalletOverview
import kotlinx.coroutines.flow.Flow

interface WalletRepository {
    /** The currently selected account, or null when no wallet exists. */
    val activeAccount: Flow<WalletAccount?>

    /** All accounts in the vault, in creation order. */
    val accounts: Flow<List<WalletAccount>>

    /** Active account, balances and recent activity. Balances come from the chain, never the server. */
    suspend fun loadOverview(): WalletOverview

    suspend fun selectAccount(id: String)
}

interface MiningRepository {
    /** Mining state as reported by the backend; the client never computes authoritative rewards. */
    suspend fun loadOverview(): MiningOverview
}
