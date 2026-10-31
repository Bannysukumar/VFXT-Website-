package com.vfxt.wallet.data.repository

import com.vfxt.wallet.blockchain.tokens.TokenRegistry
import com.vfxt.wallet.data.local.WalletSummary
import com.vfxt.wallet.data.local.WalletVault
import com.vfxt.wallet.domain.models.Holding
import com.vfxt.wallet.domain.models.WalletAccount
import com.vfxt.wallet.domain.models.WalletOverview
import com.vfxt.wallet.domain.repository.WalletRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wallet data backed by the local vault. On-chain balances and history are not wired yet
 * (Phase 3), so holdings report unknown balances rather than zero.
 */
@Singleton
class VaultWalletRepository @Inject constructor(
    private val vault: WalletVault,
) : WalletRepository {

    override val accounts: Flow<List<WalletAccount>> =
        vault.wallets.filterNotNull().map { list -> list.map { it.toAccount() } }

    override val activeAccount: Flow<WalletAccount?> =
        combine(vault.wallets.filterNotNull(), vault.activeWalletId) { list, activeId ->
            (list.firstOrNull { it.id == activeId } ?: list.firstOrNull())?.toAccount()
        }

    override suspend fun loadOverview(): WalletOverview {
        val list = vault.wallets.value ?: run { vault.load(); vault.wallets.value.orEmpty() }
        val active = list.firstOrNull { it.id == vault.activeWalletId.value } ?: list.firstOrNull()
        return WalletOverview(
            account = active?.toAccount(),
            holdings = TokenRegistry.defaultTokens(TokenRegistry.defaultNetwork).map {
                Holding(token = it, rawBalance = null, fiatValue = null, change24hPercent = null)
            },
            activity = emptyList(),
            totalFiatValue = null,
            change24hPercent = null,
        )
    }

    override suspend fun selectAccount(id: String) = vault.setActive(id)

    private fun WalletSummary.toAccount() = WalletAccount(id = id, name = name, address = address)
}
