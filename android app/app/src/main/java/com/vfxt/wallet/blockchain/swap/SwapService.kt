package com.vfxt.wallet.blockchain.swap

import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.rpc.EvmRpc
import com.vfxt.wallet.blockchain.rpc.RpcException
import com.vfxt.wallet.blockchain.tokens.Erc20Abi
import com.vfxt.wallet.blockchain.transactions.TransactionService
import com.vfxt.wallet.data.local.ChainStore
import com.vfxt.wallet.data.local.TxRecord
import com.vfxt.wallet.data.remote.LiFiApi
import com.vfxt.wallet.domain.models.TokenInfo
import com.vfxt.wallet.domain.models.TokenKind
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.math.BigDecimal
import java.math.BigInteger
import javax.inject.Inject
import javax.inject.Singleton

/** A validated quote plus everything needed to decide whether the user can afford it. */
data class SwapPreview(
    val quote: SwapQuote,
    val fromNetwork: EvmNetwork,
    val toNetwork: EvmNetwork,
    val needsApproval: Boolean,
    val fromBalance: BigInteger,
    val nativeBalance: BigInteger,
    val gasPrice: BigInteger,
    val swapGasLimit: BigInteger,
    val approvalGasLimit: BigInteger,
) {
    val networkFeeRaw: BigInteger get() =
        gasPrice * (swapGasLimit + if (needsApproval) approvalGasLimit else BigInteger.ZERO)

    val networkFee: BigDecimal get() = BigDecimal(networkFeeRaw).movePointLeft(fromNetwork.nativeDecimals)

    /** Native coin needed in total: swap amount (if native) + bridge fee + gas. */
    private val nativeRequired: BigInteger get() =
        (if (quote.fromToken.isNative) quote.fromAmount else BigInteger.ZERO) + quote.extraNativeValue + networkFeeRaw

    val problem: String? get() = when {
        quote.fromAmount > fromBalance -> "Insufficient ${quote.fromToken.symbol} balance."
        nativeRequired > nativeBalance ->
            if (quote.fromToken.isNative) "Not enough ${fromNetwork.nativeSymbol} for the amount plus network fee. Try a smaller amount."
            else "You need ${fromNetwork.nativeSymbol} on ${fromNetwork.name} to pay the network fee."
        else -> null
    }
}

sealed interface SwapProgress {
    data object Approving : SwapProgress
    data class WaitingForApproval(val hash: String) : SwapProgress
    data object Requoting : SwapProgress
    data object Swapping : SwapProgress
    data class WaitingForSwap(val hash: String) : SwapProgress
    data class Bridging(val hash: String, val message: String?) : SwapProgress
    data class Done(val hash: String, val receivingHash: String?) : SwapProgress
    data class Failed(val message: String, val hash: String? = null) : SwapProgress
    /** The market moved against the user since review; they must look at the new quote. */
    data class PriceChanged(val fresh: SwapPreview) : SwapProgress
}

/**
 * Same-chain swaps and cross-chain bridges through the LI.FI aggregator, signed locally.
 *
 * Safety model:
 *  1. Every quote passes [SwapGuard.validate] (trusted router, right chain/token/amount/value).
 *  2. Token approvals are for the exact swap amount, never unlimited.
 *  3. Right before signing, a fresh quote is fetched; if its minimum output is worse than what the
 *     user reviewed, execution stops and the user must review again.
 *  4. The swap is simulated with eth_estimateGas first; a revert stops execution before signing.
 */
@Singleton
class SwapService @Inject constructor(
    private val lifi: LiFiApi,
    private val rpc: EvmRpc,
    private val transactions: TransactionService,
    private val chainStore: ChainStore,
) {
    fun isSupported(network: EvmNetwork): Boolean = !network.isTestnet && network.chainId in SUPPORTED_CHAIN_IDS

    fun toSwapToken(token: TokenInfo, network: EvmNetwork): SwapToken? {
        if (!token.isAvailable) return null
        return SwapToken(
            chainId = network.chainId,
            address = if (token.kind == TokenKind.Native) NATIVE_TOKEN_ADDRESS else token.contractAddress!!,
            symbol = token.symbol,
            name = token.name,
            decimals = token.decimals,
            verified = true,
        )
    }

    suspend fun tokens(network: EvmNetwork): List<SwapToken> = lifi.tokens(network.chainId)

    suspend fun estimate(
        fromNetwork: EvmNetwork,
        toNetwork: EvmNetwork,
        fromToken: SwapToken,
        toToken: SwapToken,
        amount: BigInteger,
        owner: String,
        slippage: BigDecimal,
    ): SwapEstimate? = lifi.estimate(
        fromNetwork.chainId, toNetwork.chainId, fromToken.address, toToken.address, amount, owner, slippage, toToken.decimals,
    )

    suspend fun balance(network: EvmNetwork, token: SwapToken, owner: String): BigInteger =
        if (token.isNative) rpc.nativeBalance(network, owner) else rpc.tokenBalance(network, token.address, owner) ?: BigInteger.ZERO

    suspend fun preview(
        fromNetwork: EvmNetwork,
        toNetwork: EvmNetwork,
        fromToken: SwapToken,
        toToken: SwapToken,
        amount: BigInteger,
        owner: String,
        slippage: BigDecimal,
    ): SwapPreview {
        if (!isSupported(fromNetwork) || !isSupported(toNetwork)) throw SwapException("Swaps are available on mainnet networks only.")
        if (fromToken.key == toToken.key) throw SwapException("Choose two different tokens.")
        if (amount.signum() <= 0) throw SwapException("Enter an amount greater than zero.")
        if (slippage.signum() <= 0 || slippage > SwapGuard.MAX_SLIPPAGE) throw SwapException("Slippage must be between 0.1% and 5%.")

        val quote = lifi.quote(fromNetwork.chainId, toNetwork.chainId, fromToken.address, toToken.address, amount, owner, slippage)
        SwapGuard.validate(quote, fromNetwork.chainId, fromToken.address, toToken.address, toNetwork.chainId, amount)

        val nativeBalance = rpc.nativeBalance(fromNetwork, owner)
        val fromBalance = if (fromToken.isNative) nativeBalance else rpc.tokenBalance(fromNetwork, fromToken.address, owner) ?: BigInteger.ZERO
        val needsApproval = !fromToken.isNative &&
            rpc.tokenAllowance(fromNetwork, fromToken.address, owner, quote.approvalAddress!!) < amount
        val gasPrice = rpc.gasPrice(fromNetwork)
        val approvalGas = if (needsApproval) {
            runCatching { rpc.estimateGas(fromNetwork, owner, fromToken.address, BigInteger.ZERO, Erc20Abi.approve(quote.approvalAddress, amount)) }
                .getOrDefault(APPROVAL_GAS_FALLBACK).withHeadroom()
        } else {
            BigInteger.ZERO
        }
        return SwapPreview(
            quote = quote,
            fromNetwork = fromNetwork,
            toNetwork = toNetwork,
            needsApproval = needsApproval,
            fromBalance = fromBalance,
            nativeBalance = nativeBalance,
            gasPrice = gasPrice,
            swapGasLimit = quote.tx.gasLimit ?: SWAP_GAS_FALLBACK,
            approvalGasLimit = approvalGas,
        )
    }

    /** Runs the reviewed swap. Caller must have re-authenticated the user immediately before. */
    fun execute(reviewed: SwapPreview, walletId: String, owner: String): Flow<SwapProgress> = flow {
        val q = reviewed.quote
        val net = reviewed.fromNetwork
        try {
            reviewed.problem?.let { throw SwapException(it) }

            // 1. Approval (tokens only), for the exact amount.
            if (!q.fromToken.isNative) {
                val spender = q.approvalAddress!!
                if (!SwapGuard.isTrustedRouter(spender)) throw SwapException("Untrusted approval address.")
                val current = rpc.tokenAllowance(net, q.fromToken.address, owner, spender)
                if (current < q.fromAmount) {
                    emit(SwapProgress.Approving)
                    // Tokens like USDT on Ethereum revert when changing a non-zero allowance.
                    if (current.signum() > 0 && q.fromToken.address.lowercase() in RESET_ALLOWANCE_TOKENS) {
                        val resetHash = approve(net, walletId, owner, q.fromToken, spender, BigInteger.ZERO)
                        emit(SwapProgress.WaitingForApproval(resetHash))
                        requireConfirmed(net, resetHash, "Resetting the token approval failed.")
                    }
                    val hash = approve(net, walletId, owner, q.fromToken, spender, q.fromAmount)
                    emit(SwapProgress.WaitingForApproval(hash))
                    requireConfirmed(net, hash, "The token approval failed on-chain.")
                }
            }

            // 2. Fresh quote; must be at least as good as what the user approved.
            emit(SwapProgress.Requoting)
            val fresh = preview(net, reviewed.toNetwork, q.fromToken, q.toToken, q.fromAmount, owner, q.slippage)
            if (!SwapGuard.isStillAcceptable(q, fresh.quote)) {
                emit(SwapProgress.PriceChanged(fresh))
                return@flow
            }
            fresh.problem?.let { throw SwapException(it) }
            val tx = fresh.quote.tx

            // 3. Simulate before signing; a revert here costs nothing.
            val estimate = try {
                rpc.estimateGas(net, owner, tx.to, tx.value, tx.data)
            } catch (e: RpcException) {
                throw SwapException("The swap would fail on-chain (${e.message.take(120)}). Nothing was sent.")
            }
            val gasLimit = estimate.withHeadroom().max(tx.gasLimit ?: BigInteger.ZERO)

            // 4. Sign locally and broadcast.
            emit(SwapProgress.Swapping)
            val hash = transactions.signAndBroadcast(net, walletId, owner, tx.to, tx.value, tx.data, gasLimit, fresh.gasPrice)
            chainStore.upsertTransaction(
                TxRecord(
                    hash = hash,
                    networkId = net.id,
                    from = owner,
                    to = tx.to,
                    tokenSymbol = q.fromToken.symbol,
                    tokenContract = q.fromToken.address.takeUnless { q.fromToken.isNative },
                    amount = fresh.quote.fromAmountDecimal.stripTrailingZeros().toPlainString(),
                    status = TransactionService.STATUS_PENDING,
                    timestamp = System.currentTimeMillis(),
                    fee = BigDecimal(gasLimit * fresh.gasPrice).movePointLeft(net.nativeDecimals).stripTrailingZeros().toPlainString(),
                    kind = TxRecord.KIND_SWAP,
                    toSymbol = q.toToken.symbol,
                    toAmount = fresh.quote.toAmountMinDecimal.stripTrailingZeros().toPlainString(),
                    toNetworkId = reviewed.toNetwork.id,
                    tool = fresh.quote.tool,
                ),
            )
            emit(SwapProgress.WaitingForSwap(hash))
            when (transactions.awaitReceipt(net, hash)) {
                TransactionService.STATUS_FAILED -> {
                    emit(SwapProgress.Failed("The swap reverted on-chain. Your tokens were not swapped; the network fee was charged.", hash))
                    return@flow
                }
                TransactionService.STATUS_PENDING -> {
                    emit(SwapProgress.Failed("Still waiting for confirmation. Check the transaction on the explorer.", hash))
                    return@flow
                }
            }

            // 5. Cross-chain: wait for the bridge to deliver on the destination chain.
            if (fresh.quote.isCrossChain) {
                val deadline = System.currentTimeMillis() + BRIDGE_TIMEOUT_MS
                while (System.currentTimeMillis() < deadline) {
                    val status = lifi.status(hash, net.chainId, reviewed.toNetwork.chainId, fresh.quote.tool)
                    when (status.status) {
                        CrossChainStatus.Done -> {
                            emit(SwapProgress.Done(hash, status.receivingTxHash))
                            return@flow
                        }
                        CrossChainStatus.Failed -> {
                            emit(SwapProgress.Failed(status.substatusMessage ?: "The bridge reported a failure. Funds are usually refunded on the source chain.", hash))
                            return@flow
                        }
                        else -> emit(SwapProgress.Bridging(hash, status.substatusMessage))
                    }
                    delay(10_000)
                }
                emit(SwapProgress.Failed("The bridge is taking longer than usual. Track it on the explorer; funds are not lost.", hash))
                return@flow
            }
            emit(SwapProgress.Done(hash, null))
        } catch (e: SwapException) {
            emit(SwapProgress.Failed(e.message ?: "Swap failed."))
        } catch (e: com.vfxt.wallet.blockchain.transactions.TransferException) {
            emit(SwapProgress.Failed(e.message ?: "Swap failed."))
        } catch (e: java.io.IOException) {
            emit(SwapProgress.Failed("Network error. Check your connection; if a transaction was sent, it will appear in Activity."))
        }
    }

    private suspend fun approve(
        net: EvmNetwork,
        walletId: String,
        owner: String,
        token: SwapToken,
        spender: String,
        amount: BigInteger,
    ): String {
        val data = Erc20Abi.approve(spender, amount)
        val gas = runCatching { rpc.estimateGas(net, owner, token.address, BigInteger.ZERO, data) }.getOrDefault(APPROVAL_GAS_FALLBACK).withHeadroom()
        val gasPrice = rpc.gasPrice(net)
        val hash = transactions.signAndBroadcast(net, walletId, owner, token.address, BigInteger.ZERO, data, gas, gasPrice)
        chainStore.upsertTransaction(
            TxRecord(
                hash = hash,
                networkId = net.id,
                from = owner,
                to = spender,
                tokenSymbol = token.symbol,
                tokenContract = token.address,
                amount = BigDecimal(amount).movePointLeft(token.decimals).stripTrailingZeros().toPlainString(),
                status = TransactionService.STATUS_PENDING,
                timestamp = System.currentTimeMillis(),
                fee = BigDecimal(gas * gasPrice).movePointLeft(net.nativeDecimals).stripTrailingZeros().toPlainString(),
                kind = TxRecord.KIND_APPROVE,
            ),
        )
        return hash
    }

    private suspend fun requireConfirmed(net: EvmNetwork, hash: String, failure: String) {
        if (transactions.awaitReceipt(net, hash) != TransactionService.STATUS_CONFIRMED) throw SwapException(failure)
    }

    private fun BigInteger.withHeadroom(): BigInteger = this * BigInteger.valueOf(125) / BigInteger.valueOf(100)

    companion object {
        /** Mainnets where the LI.FI router was verified (see [SwapGuard.TRUSTED_ROUTERS]). */
        val SUPPORTED_CHAIN_IDS: Set<Long> = setOf(56, 1, 137, 42161, 10, 8453, 43114)

        /** USDT on Ethereum requires allowance → 0 before setting a new non-zero value. */
        private val RESET_ALLOWANCE_TOKENS = setOf("0xdac17f958d2ee523a2206206994597c13d831ec7")

        private val APPROVAL_GAS_FALLBACK = BigInteger.valueOf(80_000)
        private val SWAP_GAS_FALLBACK = BigInteger.valueOf(400_000)
        private const val BRIDGE_TIMEOUT_MS = 45 * 60_000L
    }
}
