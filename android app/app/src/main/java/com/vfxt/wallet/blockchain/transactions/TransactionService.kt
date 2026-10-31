package com.vfxt.wallet.blockchain.transactions

import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.rpc.EvmRpc
import com.vfxt.wallet.blockchain.rpc.RpcException
import com.vfxt.wallet.blockchain.tokens.Erc20Abi
import com.vfxt.wallet.blockchain.wallet.WalletKeyService
import com.vfxt.wallet.data.local.ChainStore
import com.vfxt.wallet.data.local.TxRecord
import com.vfxt.wallet.data.local.WalletVault
import com.vfxt.wallet.domain.models.TokenInfo
import com.vfxt.wallet.domain.models.TokenKind
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import org.web3j.crypto.Credentials
import org.web3j.crypto.RawTransaction
import org.web3j.crypto.TransactionEncoder
import org.web3j.utils.Numeric
import java.math.BigDecimal
import java.math.BigInteger
import javax.inject.Inject
import javax.inject.Singleton

/** Everything the user reviews before approving. Amounts are exact base units. */
data class TransferQuote(
    val network: EvmNetwork,
    val token: TokenInfo,
    val from: String,
    val recipient: String,
    val amountRaw: BigInteger,
    val gasLimit: BigInteger,
    val gasPrice: BigInteger,
    /** Value field of the transaction (amount for native, 0 for tokens). */
    val txValue: BigInteger,
    /** Transaction `to` (recipient for native, token contract for BEP-20). */
    val txTo: String,
    val data: String?,
    val nativeBalance: BigInteger,
    val tokenBalance: BigInteger,
) {
    val feeRaw: BigInteger get() = gasLimit * gasPrice
    val amount: BigDecimal get() = BigDecimal(amountRaw).movePointLeft(token.decimals)
    val fee: BigDecimal get() = BigDecimal(feeRaw).movePointLeft(network.nativeDecimals)

    /** Null when the transfer is affordable; otherwise a user-facing reason. */
    val problem: String? get() = when {
        amountRaw.signum() <= 0 -> "Enter an amount greater than zero."
        token.kind == TokenKind.Native && amountRaw + feeRaw > nativeBalance ->
            "Insufficient ${network.nativeSymbol} for amount plus network fee."
        token.kind == TokenKind.Bep20 && amountRaw > tokenBalance -> "Insufficient ${token.symbol} balance."
        token.kind == TokenKind.Bep20 && feeRaw > nativeBalance ->
            "You need ${network.nativeSymbol} to pay the network fee."
        else -> null
    }
}

class TransferException(message: String) : Exception(message)

/**
 * Builds, signs and broadcasts transfers. The private key is decrypted only inside [send],
 * used to sign locally, and never leaves this class; only the signed transaction is sent
 * to the RPC node. Signing uses EIP-155 (chain id baked into the signature) so a transaction
 * for BSC can't be replayed on another chain.
 */
@Singleton
class TransactionService @Inject constructor(
    private val rpc: EvmRpc,
    private val vault: WalletVault,
    private val chainStore: ChainStore,
) {
    fun parseAmount(input: String, decimals: Int): BigInteger? = Companion.parseAmount(input, decimals)

    suspend fun balances(network: EvmNetwork, token: TokenInfo, owner: String): Pair<BigInteger, BigInteger> {
        val native = rpc.nativeBalance(network, owner)
        val tokenBal = when (token.kind) {
            TokenKind.Native -> native
            TokenKind.Bep20 -> rpc.tokenBalance(network, requireNotNull(token.contractAddress), owner) ?: BigInteger.ZERO
        }
        return native to tokenBal
    }

    suspend fun quote(network: EvmNetwork, token: TokenInfo, from: String, recipient: String, amountRaw: BigInteger): TransferQuote {
        if (!WalletKeyService.isValidAddress(recipient)) throw TransferException("Enter a valid BNB Smart Chain address.")
        if (token.networkId != network.id) throw TransferException("This token belongs to another network.")
        if (!token.isAvailable) throw TransferException("${token.symbol} isn't deployed on ${network.name} yet.")

        val (nativeBalance, tokenBalance) = balances(network, token, from)
        val gasPrice = rpc.gasPrice(network)
        val (txTo, value, data) = when (token.kind) {
            TokenKind.Native -> Triple(recipient, amountRaw, null)
            TokenKind.Bep20 -> Triple(requireNotNull(token.contractAddress), BigInteger.ZERO, Erc20Abi.transfer(recipient, amountRaw))
        }
        val gasLimit = try {
            val estimate = rpc.estimateGas(network, from, txTo, value, data)
            // 20% headroom for token transfers whose cost can shift slightly between estimate and inclusion.
            if (token.kind == TokenKind.Native) estimate else estimate * BigInteger.valueOf(12) / BigInteger.TEN
        } catch (e: RpcException) {
            // Estimation reverts when the balance is too low; fall back to standard limits so the
            // user still sees a fee and a clear "insufficient balance" message instead of a raw error.
            if (token.kind == TokenKind.Native) NATIVE_GAS else TOKEN_GAS_FALLBACK
        }
        return TransferQuote(network, token, from, recipient, amountRaw, gasLimit, gasPrice, value, txTo, data, nativeBalance, tokenBalance)
    }

    /** Largest sendable amount: full token balance, or native balance minus the fee. */
    fun maxAmount(quote: TransferQuote): BigInteger = when (quote.token.kind) {
        TokenKind.Bep20 -> quote.tokenBalance
        TokenKind.Native -> (quote.nativeBalance - quote.feeRaw).max(BigInteger.ZERO)
    }

    /**
     * Signs locally and broadcasts. Caller must have re-authenticated the user immediately before.
     * Returns the transaction hash.
     */
    suspend fun send(quote: TransferQuote, walletId: String): String {
        quote.problem?.let { throw TransferException(it) }
        val wallet = vault.wallets.value.orEmpty().firstOrNull { it.id == walletId }
            ?: throw TransferException("Wallet not found.")
        if (!wallet.address.equals(quote.from, ignoreCase = true)) throw TransferException("Wallet mismatch.")

        val nonce = rpc.pendingNonce(quote.network, quote.from)
        val raw = if (quote.data == null) {
            RawTransaction.createEtherTransaction(nonce, quote.gasPrice, quote.gasLimit, quote.txTo, quote.txValue)
        } else {
            RawTransaction.createTransaction(nonce, quote.gasPrice, quote.gasLimit, quote.txTo, quote.txValue, quote.data)
        }

        val signedHex = withContext(Dispatchers.Default) {
            val credentials = Credentials.create(vault.revealPrivateKey(walletId))
            check(credentials.address.equals(quote.from, ignoreCase = true)) { "Key does not match sender" }
            Numeric.toHexString(TransactionEncoder.signMessage(raw, quote.network.chainId, credentials))
        }

        val hash = try {
            rpc.sendRawTransaction(quote.network, signedHex)
        } catch (e: RpcException) {
            throw TransferException(friendlyRpcError(e.message))
        }

        chainStore.upsertTransaction(
            TxRecord(
                hash = hash,
                networkId = quote.network.id,
                from = quote.from,
                to = quote.recipient,
                tokenSymbol = quote.token.symbol,
                tokenContract = quote.token.contractAddress,
                amount = quote.amount.stripTrailingZeros().toPlainString(),
                status = STATUS_PENDING,
                timestamp = System.currentTimeMillis(),
                fee = quote.fee.stripTrailingZeros().toPlainString(),
            ),
        )
        return hash
    }

    /** Polls for the receipt until mined or [timeoutMs] passes; updates the local record. */
    suspend fun awaitReceipt(network: EvmNetwork, hash: String, timeoutMs: Long = 180_000): String {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            val receipt = runCatching { rpc.receipt(network, hash) }.getOrNull()
            if (receipt != null) {
                val status = if (receipt.success) STATUS_CONFIRMED else STATUS_FAILED
                updateStatus(network.id, hash, status)
                return status
            }
            delay(3_000)
        }
        return STATUS_PENDING
    }

    /** Re-checks any locally pending transactions (e.g. after the app was closed mid-confirmation). */
    suspend fun refreshPending() {
        chainStore.transactions.first().filter { it.status == STATUS_PENDING }.forEach { tx ->
            val network = chainStore.resolveNetwork(tx.networkId) ?: return@forEach
            val receipt = runCatching { rpc.receipt(network, tx.hash) }.getOrNull() ?: return@forEach
            updateStatus(tx.networkId, tx.hash, if (receipt.success) STATUS_CONFIRMED else STATUS_FAILED)
        }
    }

    private suspend fun updateStatus(networkId: String, hash: String, status: String) {
        val existing = chainStore.transactions.first().firstOrNull { it.hash.equals(hash, true) && it.networkId == networkId } ?: return
        chainStore.upsertTransaction(existing.copy(status = status))
    }

    private fun friendlyRpcError(message: String): String {
        val m = message.lowercase()
        return when {
            "insufficient funds" in m -> "Insufficient balance to cover the amount and network fee."
            "nonce too low" in m || "already known" in m -> "A previous transaction is still being processed. Try again shortly."
            "underpriced" in m -> "Network fee too low. Please try again."
            else -> "The network rejected this transaction: $message"
        }
    }

    companion object {
        /** Parses a user-entered decimal amount into base units; null if malformed or too precise. */
        fun parseAmount(input: String, decimals: Int): BigInteger? {
            val value = input.trim().replace(",", "").toBigDecimalOrNull() ?: return null
            if (value.signum() < 0 || value.stripTrailingZeros().scale() > decimals) return null
            return value.movePointRight(decimals).toBigIntegerExact()
        }

        const val STATUS_PENDING = "pending"
        const val STATUS_CONFIRMED = "confirmed"
        const val STATUS_FAILED = "failed"
        private val NATIVE_GAS = BigInteger.valueOf(21_000)
        private val TOKEN_GAS_FALLBACK = BigInteger.valueOf(100_000)
    }
}
