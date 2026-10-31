package com.vfxt.wallet.data.repository

import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.rpc.EvmRpc
import com.vfxt.wallet.blockchain.tokens.TokenRegistry
import com.vfxt.wallet.blockchain.transactions.TransactionService
import com.vfxt.wallet.data.local.ChainStore
import com.vfxt.wallet.data.local.TxDirection
import com.vfxt.wallet.data.local.TxRecord
import com.vfxt.wallet.data.local.WalletSummary
import com.vfxt.wallet.data.local.WalletVault
import com.vfxt.wallet.data.remote.ExplorerService
import com.vfxt.wallet.data.remote.PriceService
import com.vfxt.wallet.domain.models.ActivityItem
import com.vfxt.wallet.domain.models.ActivityStatus
import com.vfxt.wallet.domain.models.ActivityType
import com.vfxt.wallet.domain.models.Holding
import com.vfxt.wallet.domain.models.TokenInfo
import com.vfxt.wallet.domain.models.TokenKind
import com.vfxt.wallet.domain.models.WalletAccount
import com.vfxt.wallet.domain.models.WalletOverview
import com.vfxt.wallet.domain.repository.WalletRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.math.BigDecimal
import java.math.MathContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wallet data: accounts from the local vault, balances read directly from BNB Smart Chain,
 * prices from CoinGecko, activity from the local transaction log (plus the explorer API when
 * configured). Nothing here trusts a server for balances.
 */
@Singleton
class VaultWalletRepository @Inject constructor(
    private val vault: WalletVault,
    private val chainStore: ChainStore,
    private val rpc: EvmRpc,
    private val prices: PriceService,
    private val explorer: ExplorerService,
    private val transactions: TransactionService,
) : WalletRepository {

    override val accounts: Flow<List<WalletAccount>> =
        vault.wallets.filterNotNull().map { list -> list.map { it.toAccount() } }

    override val activeAccount: Flow<WalletAccount?> =
        combine(vault.wallets.filterNotNull(), vault.activeWalletId) { list, activeId ->
            (list.firstOrNull { it.id == activeId } ?: list.firstOrNull())?.toAccount()
        }

    override val network: Flow<EvmNetwork> = chainStore.activeNetwork

    override val tokens: Flow<List<TokenInfo>> =
        combine(chainStore.activeNetwork, chainStore.customTokens, chainStore.hiddenTokens) { net, custom, hidden ->
            visibleTokens(net, custom.filter { it.networkId == net.id }.map {
                TokenInfo(it.symbol, it.name, it.decimals, net.id, TokenKind.Bep20, it.contract, isCustom = true)
            }, hidden)
        }

    override val changes: Flow<Unit> =
        combine(chainStore.activeNetwork, tokens, chainStore.transactions.map { it.size to it.count { t -> t.status == "pending" } }) { _, _, _ -> }
            .distinctUntilChanged()

    private fun visibleTokens(network: EvmNetwork, custom: List<TokenInfo>, hidden: Set<String>): List<TokenInfo> =
        (TokenRegistry.defaultTokens(network) + custom)
            .distinctBy { it.key }
            .filterNot { "${network.id}:${it.key}" in hidden }

    private suspend fun activeSummary(): WalletSummary? {
        val list = vault.wallets.value ?: run { vault.load(); vault.wallets.value.orEmpty() }
        return list.firstOrNull { it.id == vault.activeWalletId.value } ?: list.firstOrNull()
    }

    override suspend fun loadOverview(): WalletOverview = coroutineScope {
        val network = chainStore.currentNetwork()
        val tokenList = tokens.first()
        val account = activeSummary()?.toAccount()
            ?: return@coroutineScope WalletOverview(null, tokenList.map { Holding(it, null, null, null) }, emptyList(), null, null)

        runCatching { transactions.refreshPending() }

        var syncError: String? = null
        val balances = tokenList.map { token ->
            async {
                if (!token.isAvailable) return@async null
                runCatching {
                    when (token.kind) {
                        TokenKind.Native -> rpc.nativeBalance(network, account.address)
                        TokenKind.Bep20 -> rpc.tokenBalance(network, token.contractAddress!!, account.address)
                    }
                }.onFailure { syncError = "Couldn't refresh balances from ${network.name}. Pull down to retry." }.getOrNull()
            }
        }.awaitAll()

        // Live market quotes (CoinGecko → Binance/CryptoCompare fallback). Still fetched on
        // testnets so unit prices show; portfolio totals stay hidden for testnets below.
        val priceIds = tokenList.mapNotNull { it.priceId }.toSet()
        val priceById = prices.prices(priceIds)
        val contractsNeedingPrice = tokenList
            .filter { it.priceId == null && it.contractAddress != null && !network.isTestnet }
            .mapNotNull { it.contractAddress?.lowercase() }
            .toSet()
        val priceByContract = network.coingeckoPlatform
            ?.let { prices.tokenPrices(it, contractsNeedingPrice) }
            .orEmpty()

        val holdings = tokenList.zip(balances) { token, raw ->
            val price = token.priceId?.let { priceById[it] }
                ?: token.contractAddress?.lowercase()?.let { priceByContract[it] }
            val amount = raw?.let { BigDecimal(it).movePointLeft(token.decimals) }
            Holding(
                token = token,
                rawBalance = raw,
                fiatValue = if (amount != null && price != null) amount.multiply(price.usd) else null,
                change24hPercent = price?.change24hPercent,
                unitPrice = price?.usd,
            )
        }

        val priced = holdings.filter { it.fiatValue != null }
        val total = when {
            network.isTestnet -> null
            priced.isEmpty() -> null
            else -> priced.fold(BigDecimal.ZERO) { acc, h -> acc + h.fiatValue!! }
        }
        // Portfolio change = value-weighted average of each priced asset's 24h change.
        val change = if (total == null || total.signum() == 0) null else priced
            .filter { it.change24hPercent != null }
            .fold(BigDecimal.ZERO) { acc, h -> acc + h.fiatValue!! * h.change24hPercent!! }
            .divide(total, MathContext.DECIMAL64)

        WalletOverview(
            account = account,
            holdings = holdings,
            activity = localActivity(network, account.address).take(5),
            totalFiatValue = total,
            change24hPercent = change,
            syncError = syncError,
        )
    }

    override suspend fun loadActivity(): List<ActivityItem> {
        val network = chainStore.currentNetwork()
        val account = activeSummary() ?: return emptyList()
        val local = chainStore.transactions.first().filter { it.belongsTo(network, account.address) }
        val remote = runCatching { explorer.history(network, account.address) }.getOrDefault(emptyList())
        // Local records win (they carry the fee and pending status); remote fills in incoming transfers.
        val merged = (local + remote.filterNot { r -> local.any { it.hash.equals(r.hash, true) } })
            .sortedByDescending { it.timestamp }
        return merged.map { it.toActivity(account.address) }
    }

    private suspend fun localActivity(network: EvmNetwork, address: String): List<ActivityItem> =
        chainStore.transactions.first().filter { it.belongsTo(network, address) }.map { it.toActivity(address) }

    private fun TxRecord.belongsTo(network: EvmNetwork, address: String) =
        networkId == network.id && (from.equals(address, true) || to.equals(address, true))

    private fun TxRecord.toActivity(owner: String): ActivityItem {
        val incoming = direction == TxDirection.Incoming || (!from.equals(owner, true) && to.equals(owner, true))
        return ActivityItem(
            id = "$networkId:$hash:$tokenSymbol",
            type = if (incoming) ActivityType.Received else ActivityType.Sent,
            tokenSymbol = tokenSymbol,
            amount = amount.toBigDecimalOrNull() ?: BigDecimal.ZERO,
            status = when (status) {
                TransactionService.STATUS_CONFIRMED -> ActivityStatus.Confirmed
                TransactionService.STATUS_FAILED -> ActivityStatus.Failed
                else -> ActivityStatus.Pending
            },
            timestampMillis = timestamp,
            txHash = hash,
            counterparty = if (incoming) from else to,
            networkId = networkId,
            fee = fee?.toBigDecimalOrNull(),
        )
    }

    override suspend fun selectAccount(id: String) = vault.setActive(id)

    private fun WalletSummary.toAccount() = WalletAccount(id = id, name = name, address = address)
}
