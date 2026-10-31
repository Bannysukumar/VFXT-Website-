package com.vfxt.wallet.domain.repository

import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.domain.models.ActivityItem
import com.vfxt.wallet.domain.models.BoosterPurchaseOrder
import com.vfxt.wallet.domain.models.MiningBooster
import com.vfxt.wallet.domain.models.MiningOverview
import com.vfxt.wallet.domain.models.TokenInfo
import com.vfxt.wallet.domain.models.WalletAccount
import com.vfxt.wallet.domain.models.WalletOverview
import kotlinx.coroutines.flow.Flow

interface WalletRepository {
    /** The currently selected account, or null when no wallet exists. */
    val activeAccount: Flow<WalletAccount?>

    /** All accounts in the vault, in creation order. */
    val accounts: Flow<List<WalletAccount>>

    val network: Flow<EvmNetwork>

    /** Visible tokens on the active network (built-in + custom, minus hidden). */
    val tokens: Flow<List<TokenInfo>>

    /** Emits whenever balances should be reloaded (network, tokens or local transactions changed). */
    val changes: Flow<Unit>

    /** Active account, balances and recent activity. Balances come from the chain, never the server. */
    suspend fun loadOverview(): WalletOverview

    /** Full activity list for the active account (local + explorer when configured). */
    suspend fun loadActivity(): List<ActivityItem>

    suspend fun selectAccount(id: String)
}

interface MiningRepository {
    /** Mining state as reported by the backend; the client never computes authoritative rewards. */
    suspend fun loadOverview(): MiningOverview

    /** Starts a server-authoritative mining session for the signed-in wallet user. */
    suspend fun startMining()

    /** Stops the active session early when the admin config allows it. */
    suspend fun stopMining()

    /** Submits a claim for the available reward balance. Returns a user-facing status message. */
    suspend fun claimRewards(): String

    /** Enabled booster products from the admin catalog. */
    suspend fun listBoosters(): List<MiningBooster>

    /** Creates a purchase with an exact USDT amount + admin receive wallet. */
    suspend fun createBoosterPurchase(boosterId: String): BoosterPurchaseOrder

    /**
     * Pays the purchase by signing a USDT BEP-20 transfer with the active VFXT wallet only,
     * then asks the server to verify the tx and activate the boost.
     * External wallets (MetaMask / Trust) are not supported for booster purchases.
     */
    suspend fun payBoosterWithVfxtWallet(order: BoosterPurchaseOrder): String
}
