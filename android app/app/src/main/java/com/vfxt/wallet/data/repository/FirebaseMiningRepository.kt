package com.vfxt.wallet.data.repository

import com.vfxt.wallet.blockchain.networks.Networks
import com.vfxt.wallet.blockchain.tokens.TokenRegistry
import com.vfxt.wallet.blockchain.transactions.TransactionService
import com.vfxt.wallet.blockchain.transactions.TransferException
import com.vfxt.wallet.data.local.ChainStore
import com.vfxt.wallet.data.local.WalletVault
import com.vfxt.wallet.data.remote.AuthException
import com.vfxt.wallet.data.remote.FirebaseWalletAuth
import com.vfxt.wallet.data.remote.MiningApi
import com.vfxt.wallet.data.remote.MiningApiException
import com.vfxt.wallet.domain.models.BoosterPurchaseOrder
import com.vfxt.wallet.domain.models.MiningBooster
import com.vfxt.wallet.domain.models.MiningOverview
import com.vfxt.wallet.domain.models.MiningStatus
import com.vfxt.wallet.domain.models.TokenKind
import com.vfxt.wallet.domain.repository.MiningRepository
import kotlinx.coroutines.flow.first
import java.math.BigInteger
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FirebaseMiningRepository @Inject constructor(
    private val auth: FirebaseWalletAuth,
    private val api: MiningApi,
    private val vault: WalletVault,
    private val transactions: TransactionService,
    private val chainStore: ChainStore,
) : MiningRepository {

    private suspend fun withAuth(block: suspend () -> MiningOverview): MiningOverview {
        val wallet = activeWalletOrNull()
            ?: return MiningOverview(
                status = MiningStatus.ServiceUnavailable("Create or import a wallet to use mining."),
                rewards = null,
                history = emptyList(),
            )
        return try {
            auth.ensureSignedIn(wallet.id, wallet.address)
            block()
        } catch (e: AuthException) {
            MiningOverview(
                status = MiningStatus.ServiceUnavailable(e.message ?: "Could not sign in to mining."),
                rewards = null,
                history = emptyList(),
            )
        } catch (e: MiningApiException) {
            MiningOverview(
                status = MiningStatus.ServiceUnavailable(e.message ?: "Mining service error."),
                rewards = null,
                history = emptyList(),
            )
        }
    }

    override suspend fun loadOverview(): MiningOverview = withAuth {
        val status = api.status()
        val history = runCatching { api.history() }.getOrDefault(emptyList())
        status.copy(history = history)
    }

    override suspend fun startMining() {
        ensureReady()
        api.start()
    }

    override suspend fun stopMining() {
        ensureReady()
        api.stop()
    }

    override suspend fun claimRewards(): String {
        ensureReady()
        val result = api.claim(destinationAddress = null, idempotencyKey = UUID.randomUUID().toString())
        val amount = result["amount"]?.toString() ?: "0"
        val status = result["status"]?.toString() ?: "pending"
        return "Claim submitted for $amount VFXT ($status)."
    }

    override suspend fun listBoosters(): List<MiningBooster> {
        ensureReady()
        return api.listBoosters()
    }

    override suspend fun createBoosterPurchase(boosterId: String): BoosterPurchaseOrder {
        ensureReady()
        return api.purchaseBooster(boosterId)
    }

    override suspend fun payBoosterWithVfxtWallet(order: BoosterPurchaseOrder): String {
        val wallet = ensureReady()
        // USDT BEP-20 booster payments are on BSC mainnet.
        val network = Networks.BscMainnet
        chainStore.setActiveNetwork(network)
        val usdt = TokenRegistry.defaultTokens(network).firstOrNull {
            it.symbol.equals("USDT", ignoreCase = true) && it.kind == TokenKind.Bep20 && it.isAvailable
        } ?: throw MiningApiException("USDT (BEP-20) is not available on this build.")

        val amountRaw = runCatching { BigInteger(order.expectedUsdtWei) }.getOrNull()
            ?: throw MiningApiException("Invalid payment amount from server.")
        if (amountRaw.signum() <= 0) throw MiningApiException("Invalid payment amount.")

        val quote = try {
            transactions.quote(network, usdt, wallet.address, order.paymentWallet, amountRaw)
        } catch (e: TransferException) {
            throw MiningApiException(e.message ?: "Could not prepare USDT transfer.")
        }
        quote.problem?.let { throw MiningApiException(it) }

        val txHash = try {
            transactions.send(quote, wallet.id)
        } catch (e: TransferException) {
            throw MiningApiException(e.message ?: "USDT transfer failed.")
        }

        // Wait briefly for inclusion, then ask the server to activate (authoritative).
        runCatching { transactions.awaitReceipt(network, txHash, timeoutMs = 90_000) }
        val result = api.confirmBoosterPayment(order.purchaseId, txHash)
        val status = result["status"]?.toString() ?: "activated"
        return "Boost activated ($status). Tx ${txHash.take(10)}…"
    }

    private suspend fun activeWalletOrNull() = run {
        val wallets = vault.wallets.value ?: run {
            vault.load()
            vault.wallets.first { it != null }!!
        }
        val activeId = vault.activeWalletId.value
        wallets.firstOrNull { it.id == activeId } ?: wallets.firstOrNull()
    }

    private suspend fun ensureReady(): com.vfxt.wallet.data.local.WalletSummary {
        val wallet = activeWalletOrNull() ?: throw MiningApiException("No wallet available")
        auth.ensureSignedIn(wallet.id, wallet.address)
        return wallet
    }
}
