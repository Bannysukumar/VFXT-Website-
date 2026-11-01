package com.vfxt.wallet.blockchain.swap

import com.vfxt.wallet.blockchain.networks.EvmNetwork
import com.vfxt.wallet.blockchain.networks.Networks
import com.vfxt.wallet.blockchain.rpc.EvmRpc
import com.vfxt.wallet.blockchain.rpc.RpcException
import com.vfxt.wallet.blockchain.tokens.Erc20Abi
import com.vfxt.wallet.blockchain.tokens.TokenRegistry
import com.vfxt.wallet.blockchain.transactions.TransactionService
import com.vfxt.wallet.blockchain.transactions.TransferException
import com.vfxt.wallet.data.local.ChainStore
import com.vfxt.wallet.data.local.TxRecord
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.math.BigDecimal
import java.math.BigInteger
import javax.inject.Inject
import javax.inject.Singleton

enum class DeskSide { Buy, Sell }

/** Live state of the VFXTSwap contract plus the user's balances. All amounts in base units (18 dp). */
data class DeskState(
    val buyPrice: BigInteger,
    val sellPrice: BigInteger,
    val paused: Boolean,
    val vfxtReserve: BigInteger,
    val usdtReserve: BigInteger,
    val minUsdtPerTrade: BigInteger,
    val maxUsdtPerTrade: BigInteger,
    val userVfxt: BigInteger,
    val userUsdt: BigInteger,
    val userBnb: BigInteger,
)

data class DeskPreview(
    val side: DeskSide,
    val amountIn: BigInteger,
    val amountOut: BigInteger,
    val price: BigInteger,
    val needsApproval: Boolean,
    val gasPrice: BigInteger,
    val estimatedFee: BigInteger,
) {
    val inSymbol: String get() = if (side == DeskSide.Buy) "USDT" else "VFXT"
    val outSymbol: String get() = if (side == DeskSide.Buy) "VFXT" else "USDT"
}

sealed interface DeskProgress {
    data object Approving : DeskProgress
    data class WaitingForApproval(val hash: String) : DeskProgress
    data object Swapping : DeskProgress
    data class WaitingForSwap(val hash: String) : DeskProgress
    data class Done(val hash: String) : DeskProgress
    data class Failed(val message: String, val hash: String? = null) : DeskProgress
}

/**
 * Fixed-price VFXT ↔ USDT desk on BSC ([VFXT_SWAP]). Prices and liquidity are set by the VFXT admin;
 * the contract enforces them, and every trade passes the exact quoted output as its minimum so an
 * admin price change between review and mining makes the trade revert instead of filling worse.
 */
@Singleton
class VfxtDeskService @Inject constructor(
    private val rpc: EvmRpc,
    private val transactions: TransactionService,
    private val chainStore: ChainStore,
) {
    val network: EvmNetwork = Networks.BscMainnet

    suspend fun state(owner: String): DeskState {
        val reserves = rpc.ethCall(network, VFXT_SWAP, RESERVES)?.removePrefix("0x").orEmpty()
        return DeskState(
            buyPrice = uint(BUY_PRICE),
            sellPrice = uint(SELL_PRICE),
            paused = uint(PAUSED) == BigInteger.ONE,
            vfxtReserve = reserves.word(0),
            usdtReserve = reserves.word(1),
            minUsdtPerTrade = uint(MIN_USDT),
            maxUsdtPerTrade = uint(MAX_USDT),
            userVfxt = rpc.tokenBalance(network, VFXT, owner) ?: BigInteger.ZERO,
            userUsdt = rpc.tokenBalance(network, USDT, owner) ?: BigInteger.ZERO,
            userBnb = rpc.nativeBalance(network, owner),
        )
    }

    /** VFXT received for [usdtIn] at the current buy price (contract math). */
    suspend fun quoteBuy(usdtIn: BigInteger): BigInteger = quote(QUOTE_BUY, usdtIn)

    /** USDT received for [vfxtIn] at the current sell price (contract math). */
    suspend fun quoteSell(vfxtIn: BigInteger): BigInteger = quote(QUOTE_SELL, vfxtIn)

    private suspend fun quote(selector: String, amount: BigInteger): BigInteger =
        Erc20Abi.decodeUint(rpc.ethCall(network, VFXT_SWAP, "0x$selector${Erc20Abi.encodeUint(amount)}"))
            ?: throw SwapException("Couldn't get a VFXT quote. Check your connection.")

    /** Validates the trade against live contract state and returns exactly what the user will get. */
    suspend fun preview(side: DeskSide, amountIn: BigInteger, owner: String, state: DeskState): DeskPreview {
        if (amountIn.signum() <= 0) throw SwapException("Enter an amount greater than zero.")
        if (state.paused) throw SwapException("VFXT trading is paused by the admin. Try again later.")
        val price = if (side == DeskSide.Buy) state.buyPrice else state.sellPrice
        if (price.signum() == 0) throw SwapException(if (side == DeskSide.Buy) "Buying VFXT is currently disabled." else "Selling VFXT is currently disabled.")

        val balance = if (side == DeskSide.Buy) state.userUsdt else state.userVfxt
        if (amountIn > balance) throw SwapException("Insufficient ${if (side == DeskSide.Buy) "USDT" else "VFXT"} balance.")

        val amountOut = Erc20Abi.decodeUint(
            rpc.ethCall(network, VFXT_SWAP, "0x${if (side == DeskSide.Buy) QUOTE_BUY else QUOTE_SELL}${Erc20Abi.encodeUint(amountIn)}"),
        ) ?: throw SwapException("Couldn't get a quote. Check your connection.")
        if (amountOut.signum() == 0) throw SwapException("Amount is too small.")

        val usdtValue = if (side == DeskSide.Buy) amountIn else amountOut
        if (state.minUsdtPerTrade.signum() > 0 && usdtValue < state.minUsdtPerTrade) {
            throw SwapException("Minimum trade is ${display(state.minUsdtPerTrade)} USDT.")
        }
        if (state.maxUsdtPerTrade.signum() > 0 && usdtValue > state.maxUsdtPerTrade) {
            throw SwapException("Maximum trade is ${display(state.maxUsdtPerTrade)} USDT.")
        }
        val reserve = if (side == DeskSide.Buy) state.vfxtReserve else state.usdtReserve
        if (amountOut > reserve) {
            throw SwapException("Not enough ${if (side == DeskSide.Buy) "VFXT" else "USDT"} liquidity right now (available: ${display(reserve)}).")
        }

        val tokenIn = if (side == DeskSide.Buy) USDT else VFXT
        val needsApproval = rpc.tokenAllowance(network, tokenIn, owner, VFXT_SWAP) < amountIn
        val gasPrice = rpc.gasPrice(network)
        val fee = (if (needsApproval) APPROVE_GAS + SWAP_GAS else SWAP_GAS) * gasPrice
        if (fee > state.userBnb) throw SwapException("You need a little BNB to pay the network fee.")
        return DeskPreview(side, amountIn, amountOut, price, needsApproval, gasPrice, fee)
    }

    /** Approve (exact amount, if needed) → swap. Caller must have re-authenticated the user. */
    fun execute(p: DeskPreview, walletId: String, owner: String): Flow<DeskProgress> = flow {
        val tokenIn = if (p.side == DeskSide.Buy) USDT else VFXT
        try {
            if (rpc.tokenAllowance(network, tokenIn, owner, VFXT_SWAP) < p.amountIn) {
                emit(DeskProgress.Approving)
                val data = Erc20Abi.approve(VFXT_SWAP, p.amountIn)
                val gas = runCatching { rpc.estimateGas(network, owner, tokenIn, BigInteger.ZERO, data) }.getOrDefault(APPROVE_GAS).headroom()
                val gasPrice = rpc.gasPrice(network)
                val hash = transactions.signAndBroadcast(network, walletId, owner, tokenIn, BigInteger.ZERO, data, gas, gasPrice)
                chainStore.upsertTransaction(
                    TxRecord(
                        hash = hash, networkId = network.id, from = owner, to = VFXT_SWAP,
                        tokenSymbol = p.inSymbol, tokenContract = tokenIn, amount = display(p.amountIn),
                        status = TransactionService.STATUS_PENDING, timestamp = System.currentTimeMillis(),
                        fee = display(gas * gasPrice), kind = TxRecord.KIND_APPROVE,
                    ),
                )
                emit(DeskProgress.WaitingForApproval(hash))
                if (transactions.awaitReceipt(network, hash) != TransactionService.STATUS_CONFIRMED) {
                    emit(DeskProgress.Failed("The approval failed on-chain. Nothing was swapped.", hash))
                    return@flow
                }
            }

            emit(DeskProgress.Swapping)
            val deadline = BigInteger.valueOf(System.currentTimeMillis() / 1000 + DEADLINE_SECONDS)
            val selector = if (p.side == DeskSide.Buy) BUY else SELL
            // minOut = the exact reviewed output: if the admin changes the price first, the trade reverts.
            val data = "0x$selector${Erc20Abi.encodeUint(p.amountIn)}${Erc20Abi.encodeUint(p.amountOut)}${Erc20Abi.encodeUint(deadline)}"
            val gas = try {
                rpc.estimateGas(network, owner, VFXT_SWAP, BigInteger.ZERO, data).headroom()
            } catch (e: RpcException) {
                emit(DeskProgress.Failed(friendlyRevert(e.message)))
                return@flow
            }
            val gasPrice = rpc.gasPrice(network)
            val hash = transactions.signAndBroadcast(network, walletId, owner, VFXT_SWAP, BigInteger.ZERO, data, gas, gasPrice)
            chainStore.upsertTransaction(
                TxRecord(
                    hash = hash, networkId = network.id, from = owner, to = VFXT_SWAP,
                    tokenSymbol = p.inSymbol, tokenContract = tokenIn, amount = display(p.amountIn),
                    status = TransactionService.STATUS_PENDING, timestamp = System.currentTimeMillis(),
                    fee = display(gas * gasPrice), kind = TxRecord.KIND_SWAP,
                    toSymbol = p.outSymbol, toAmount = display(p.amountOut), toNetworkId = network.id, tool = "vfxt-desk",
                ),
            )
            emit(DeskProgress.WaitingForSwap(hash))
            when (transactions.awaitReceipt(network, hash)) {
                TransactionService.STATUS_CONFIRMED -> emit(DeskProgress.Done(hash))
                TransactionService.STATUS_FAILED -> emit(DeskProgress.Failed("The trade reverted on-chain (the price or liquidity may have changed). Only the network fee was spent.", hash))
                else -> emit(DeskProgress.Failed("Still waiting for confirmation. Check Activity in a minute.", hash))
            }
        } catch (e: TransferException) {
            emit(DeskProgress.Failed(e.message ?: "Transaction failed"))
        } catch (e: RpcException) {
            emit(DeskProgress.Failed(friendlyRevert(e.message)))
        }
    }

    private suspend fun uint(selector: String): BigInteger =
        Erc20Abi.decodeUint(rpc.ethCall(network, VFXT_SWAP, selector)) ?: throw SwapException("Couldn't reach the VFXT swap contract.")

    private fun String.word(i: Int): BigInteger =
        substring(i * 64, (i + 1) * 64).takeIf { length >= (i + 1) * 64 }?.let { BigInteger(it, 16) } ?: BigInteger.ZERO

    private fun BigInteger.headroom(): BigInteger = this * BigInteger.valueOf(12) / BigInteger.TEN

    companion object {
        /** VFXTSwap on BSC mainnet; owner = VFXT treasury. */
        const val VFXT_SWAP = "0xD0fe8d149D4Cb91Bc30036f8c0C799859C0A1F24"
        const val VFXT = TokenRegistry.VFXT_BSC_MAINNET
        const val USDT = "0x55d398326f99059fF775485246999027B3197955"

        private const val BUY = "40993b26" // buy(uint256,uint256,uint256)
        private const val SELL = "d3c9727c" // sell(uint256,uint256,uint256)
        private const val QUOTE_BUY = "4beb394c" // quoteBuy(uint256)
        private const val QUOTE_SELL = "a64190c4" // quoteSell(uint256)
        private const val RESERVES = "0x75172a8b" // reserves()
        private const val BUY_PRICE = "0x8620410b" // buyPrice()
        private const val SELL_PRICE = "0x4b750334" // sellPrice()
        private const val PAUSED = "0x5c975abb" // paused()
        private const val MIN_USDT = "0x5317580c" // minUsdtPerTrade()
        private const val MAX_USDT = "0x98ff9144" // maxUsdtPerTrade()

        private const val DEADLINE_SECONDS = 20 * 60L
        private val APPROVE_GAS = BigInteger.valueOf(60_000)
        private val SWAP_GAS = BigInteger.valueOf(120_000)

        /** Both VFXT and BSC USDT use 18 decimals. */
        fun display(raw: BigInteger): String = BigDecimal(raw).movePointLeft(18).stripTrailingZeros().toPlainString()

        /** USDT per VFXT for a 1e18-scaled contract price. */
        fun priceDisplay(price: BigInteger): String = display(price)

        /** Maps VFXTSwap custom-error selectors in a revert message to plain language. */
        fun friendlyRevert(message: String?): String {
            val m = message.orEmpty().lowercase()
            return when {
                "a17e11d5" in m -> "Not enough liquidity in the swap right now."
                "2746152a" in m -> "The price changed before your trade. Review the new price and try again."
                "d93c0665" in m -> "VFXT trading is paused by the admin."
                "bcb8b8fb" in m -> "This side of the swap is currently disabled."
                "516c1946" in m -> "Trade amount is below the minimum."
                "54f271e1" in m -> "Trade amount is above the maximum."
                "203d82d8" in m -> "The trade expired. Please try again."
                "insufficient funds" in m -> "You need a little BNB to pay the network fee."
                else -> "The trade would fail: ${message ?: "unknown error"}"
            }
        }
    }
}
