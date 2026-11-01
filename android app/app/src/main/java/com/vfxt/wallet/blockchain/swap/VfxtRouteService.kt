package com.vfxt.wallet.blockchain.swap

import com.vfxt.wallet.blockchain.networks.Networks
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.math.BigDecimal
import java.math.BigInteger
import javax.inject.Inject
import javax.inject.Singleton

/**
 * A swap into or out of VFXT. VFXT has no DEX liquidity, so it trades only against USDT on the
 * VFXTSwap desk; any other BSC token is first routed to/from USDT through LI.FI.
 */
data class VfxtRoute(
    val kind: Kind,
    val fromToken: SwapToken,
    val toToken: SwapToken,
    val amountIn: BigInteger,
    /** USDT that goes into (buy) or comes out of (sell) the desk, using the conservative leg minimum. */
    val usdtAmount: BigInteger,
    val amountOut: BigInteger,
    val amountOutMin: BigInteger,
    /** Desk price used (USDT per VFXT, 1e18-scaled). */
    val deskPrice: BigInteger,
    /** LI.FI leg estimate when the route has two steps. */
    val leg: SwapEstimate?,
    val slippage: BigDecimal,
    /** Set when the price is known but the trade can't run right now (e.g. no desk liquidity, trade limits). */
    val problem: String? = null,
) {
    enum class Kind { BuyDirect, SellDirect, BuyViaUsdt, SellViaUsdt }

    val isTwoStep: Boolean get() = kind == Kind.BuyViaUsdt || kind == Kind.SellViaUsdt
    val isBuy: Boolean get() = kind == Kind.BuyDirect || kind == Kind.BuyViaUsdt

    fun toEstimate(): SwapEstimate = SwapEstimate(
        toAmount = amountOut,
        toAmountMin = amountOutMin,
        toDecimals = toToken.decimals,
        fromAmountUsd = leg?.fromAmountUsd ?: if (isBuy) usd(usdtAmount) else usd(usdtAmount),
        toAmountUsd = leg?.toAmountUsd ?: usd(usdtAmount),
        gasCostUsd = leg?.gasCostUsd,
        toolName = if (isTwoStep) "${leg?.toolName?.ifBlank { null } ?: "LI.FI"} + VFXT Swap" else "VFXT Swap (fixed price)",
        executionDurationSeconds = 0,
    )

    private fun usd(usdt: BigInteger): BigDecimal = BigDecimal(usdt).movePointLeft(18)
}

sealed interface VfxtRouteProgress {
    /** [step] is 1-based out of [total]. */
    data class Step(val step: Int, val total: Int, val label: String, val hash: String? = null) : VfxtRouteProgress
    data class Done(val hash: String) : VfxtRouteProgress
    data class Failed(val message: String, val hash: String? = null) : VfxtRouteProgress
}

@Singleton
class VfxtRouteService @Inject constructor(
    private val desk: VfxtDeskService,
    private val swaps: SwapService,
) {
    private val bsc = Networks.BscMainnet

    val usdt = SwapToken(56, VfxtDeskService.USDT, "USDT", "Tether USD", 18)

    fun involvesVfxt(from: SwapToken?, to: SwapToken?): Boolean = isVfxt(from) || isVfxt(to)

    fun isVfxt(t: SwapToken?): Boolean = t != null && t.chainId == 56L && t.address.equals(VfxtDeskService.VFXT, ignoreCase = true)

    private fun isUsdt(t: SwapToken): Boolean = t.chainId == 56L && t.address.equals(VfxtDeskService.USDT, ignoreCase = true)

    /** Prices the route against live desk state. Throws [SwapException] with a user-facing reason. */
    suspend fun quote(from: SwapToken, to: SwapToken, amountIn: BigInteger, owner: String, slippage: BigDecimal): VfxtRoute {
        if (from.chainId != 56L || to.chainId != 56L) {
            throw SwapException("VFXT trades on BNB Smart Chain only. Pick BSC for both sides.")
        }
        val state = desk.state(owner)
        if (state.paused) throw SwapException("VFXT trading is paused by the admin. Try again later.")
        return if (isVfxt(to)) {
            if (state.buyPrice.signum() == 0) throw SwapException("Buying VFXT is currently disabled.")
            if (isUsdt(from)) {
                val out = desk.quoteBuy(amountIn)
                val problem = checkDesk(amountIn, out, state.vfxtReserve, "VFXT", state)
                VfxtRoute(VfxtRoute.Kind.BuyDirect, from, to, amountIn, amountIn, out, out, state.buyPrice, null, slippage, problem)
            } else {
                val leg = swaps.estimate(bsc, bsc, from, usdt, amountIn, owner, slippage)
                    ?: throw SwapException("No route from ${from.symbol} to USDT right now. Try USDT or another token.")
                val out = desk.quoteBuy(leg.toAmount)
                val min = desk.quoteBuy(leg.toAmountMin)
                val problem = checkDesk(leg.toAmount, out, state.vfxtReserve, "VFXT", state)
                VfxtRoute(VfxtRoute.Kind.BuyViaUsdt, from, to, amountIn, leg.toAmountMin, out, min, state.buyPrice, leg, slippage, problem)
            }
        } else {
            if (state.sellPrice.signum() == 0) throw SwapException("Selling VFXT is currently disabled.")
            val usdtOut = desk.quoteSell(amountIn)
            val problem = checkDesk(usdtOut, usdtOut, state.usdtReserve, "USDT", state)
            if (isUsdt(to)) {
                VfxtRoute(VfxtRoute.Kind.SellDirect, from, to, amountIn, usdtOut, usdtOut, usdtOut, state.sellPrice, null, slippage, problem)
            } else {
                val leg = swaps.estimate(bsc, bsc, usdt, to, usdtOut, owner, slippage)
                    ?: throw SwapException("No route from USDT to ${to.symbol} right now. Try receiving USDT instead.")
                VfxtRoute(VfxtRoute.Kind.SellViaUsdt, from, to, amountIn, usdtOut, leg.toAmount, leg.toAmountMin, state.sellPrice, leg, slippage, problem)
            }
        }
    }

    /** Null when the desk can fill the trade; otherwise why not (the price is still shown). */
    private fun checkDesk(usdtValue: BigInteger, deskOut: BigInteger, reserve: BigInteger, outSymbol: String, s: DeskState): String? {
        if (deskOut.signum() == 0) throw SwapException("Amount is too small.")
        return when {
            s.minUsdtPerTrade.signum() > 0 && usdtValue < s.minUsdtPerTrade ->
                "Minimum VFXT trade is ${VfxtDeskService.display(s.minUsdtPerTrade)} USDT."
            s.maxUsdtPerTrade.signum() > 0 && usdtValue > s.maxUsdtPerTrade ->
                "Maximum VFXT trade is ${VfxtDeskService.display(s.maxUsdtPerTrade)} USDT."
            deskOut > reserve ->
                "Not enough $outSymbol liquidity in the VFXT swap right now (available: ${VfxtDeskService.display(reserve)})."
            else -> null
        }
    }

    /** Runs every step of [route]. Caller must have re-authenticated the user. */
    fun execute(route: VfxtRoute, walletId: String, owner: String): Flow<VfxtRouteProgress> = flow {
        when (route.kind) {
            VfxtRoute.Kind.BuyDirect, VfxtRoute.Kind.SellDirect -> {
                val side = if (route.isBuy) DeskSide.Buy else DeskSide.Sell
                val result = runDesk(side, route.amountIn, route.amountOutMin, owner, walletId, step = 1, total = 1)
                when (result) {
                    is DeskOutcome.Fail -> emit(result.failure)
                    is DeskOutcome.Ok -> emit(VfxtRouteProgress.Done(result.hash))
                }
            }

            VfxtRoute.Kind.BuyViaUsdt -> {
                // Step 1: token -> USDT through LI.FI.
                val before = swaps.balance(bsc, usdt, owner)
                emit(VfxtRouteProgress.Step(1, 2, "Swapping ${route.fromToken.symbol} to USDT"))
                val legHash = runLifiLeg(route.fromToken, usdt, route.amountIn, owner, walletId, route.slippage, step = 1) ?: return@flow
                val received = (swaps.balance(bsc, usdt, owner) - before).max(BigInteger.ZERO)
                if (received.signum() == 0) {
                    emit(VfxtRouteProgress.Failed("The first step finished but no USDT arrived yet. Check Activity before retrying.", legHash))
                    return@flow
                }
                // Step 2: USDT -> VFXT on the desk, never below what the user reviewed.
                emit(VfxtRouteProgress.Step(2, 2, "Buying VFXT with ${VfxtDeskService.display(received)} USDT", legHash))
                val result = runDesk(DeskSide.Buy, received, route.amountOutMin, owner, walletId, step = 2, total = 2)
                when (result) {
                    is DeskOutcome.Fail -> emit(
                        result.failure.copy(message = result.failure.message + " Your ${VfxtDeskService.display(received)} USDT from step 1 is in your wallet."),
                    )
                    is DeskOutcome.Ok -> emit(VfxtRouteProgress.Done(result.hash))
                }
            }

            VfxtRoute.Kind.SellViaUsdt -> {
                // Step 1: VFXT -> USDT on the desk.
                val before = swaps.balance(bsc, usdt, owner)
                val first = runDesk(DeskSide.Sell, route.amountIn, route.usdtAmount, owner, walletId, step = 1, total = 2)
                if (first is DeskOutcome.Fail) {
                    emit(first.failure)
                    return@flow
                }
                val deskHash = (first as DeskOutcome.Ok).hash
                val received = (swaps.balance(bsc, usdt, owner) - before).max(BigInteger.ZERO)
                // Step 2: USDT -> target token through LI.FI.
                emit(VfxtRouteProgress.Step(2, 2, "Swapping ${VfxtDeskService.display(received)} USDT to ${route.toToken.symbol}", deskHash))
                val legHash = runLifiLeg(usdt, route.toToken, received, owner, walletId, route.slippage, step = 2, keptNote = "Your VFXT was sold; the ${VfxtDeskService.display(received)} USDT is in your wallet.")
                    ?: return@flow
                emit(VfxtRouteProgress.Done(legHash))
            }
        }
    }

    private sealed interface DeskOutcome {
        data class Ok(val hash: String) : DeskOutcome
        data class Fail(val failure: VfxtRouteProgress.Failed) : DeskOutcome
    }

    /** Desk trade with a guaranteed minimum; emits step progress and returns the outcome. */
    private suspend fun kotlinx.coroutines.flow.FlowCollector<VfxtRouteProgress>.runDesk(
        side: DeskSide,
        amountIn: BigInteger,
        minOut: BigInteger,
        owner: String,
        walletId: String,
        step: Int,
        total: Int,
    ): DeskOutcome {
        val state = try {
            desk.state(owner)
        } catch (_: Exception) {
            return DeskOutcome.Fail(VfxtRouteProgress.Failed("Couldn't reach the VFXT swap contract."))
        }
        val preview = try {
            desk.preview(side, amountIn, owner, state)
        } catch (e: SwapException) {
            return DeskOutcome.Fail(VfxtRouteProgress.Failed(e.message ?: "VFXT swap unavailable."))
        }
        if (preview.amountOut < minOut) {
            return DeskOutcome.Fail(VfxtRouteProgress.Failed("The VFXT price changed since you reviewed it. Nothing was traded on the VFXT swap."))
        }
        val label = if (side == DeskSide.Buy) "Buying VFXT" else "Selling VFXT"
        var outcome: DeskOutcome = DeskOutcome.Fail(VfxtRouteProgress.Failed("The VFXT trade didn't complete."))
        desk.execute(preview, walletId, owner).collect { p ->
            when (p) {
                DeskProgress.Approving -> emit(VfxtRouteProgress.Step(step, total, "Approving ${preview.inSymbol}"))
                is DeskProgress.WaitingForApproval -> emit(VfxtRouteProgress.Step(step, total, "Approving ${preview.inSymbol}", p.hash))
                DeskProgress.Swapping -> emit(VfxtRouteProgress.Step(step, total, label))
                is DeskProgress.WaitingForSwap -> emit(VfxtRouteProgress.Step(step, total, label, p.hash))
                is DeskProgress.Done -> outcome = DeskOutcome.Ok(p.hash)
                is DeskProgress.Failed -> outcome = DeskOutcome.Fail(VfxtRouteProgress.Failed(p.message, p.hash))
            }
        }
        return outcome
    }

    /** LI.FI leg; returns the swap hash, or null after emitting a Failed. */
    private suspend fun kotlinx.coroutines.flow.FlowCollector<VfxtRouteProgress>.runLifiLeg(
        from: SwapToken,
        to: SwapToken,
        amount: BigInteger,
        owner: String,
        walletId: String,
        slippage: BigDecimal,
        step: Int,
        keptNote: String? = null,
    ): String? {
        val suffix = keptNote?.let { " $it" }.orEmpty()
        var preview = try {
            swaps.preview(bsc, bsc, from, to, amount, owner, slippage)
        } catch (e: Exception) {
            emit(VfxtRouteProgress.Failed((e.message ?: "Couldn't get a ${from.symbol} → ${to.symbol} quote.") + suffix))
            return null
        }
        preview.problem?.let {
            emit(VfxtRouteProgress.Failed(it + suffix))
            return null
        }
        for (attempt in 0..1) {
            var result: String? = null
            var failure: SwapProgress.Failed? = null
            var repriced: SwapPreview? = null
            swaps.execute(preview, walletId, owner).collect { p ->
                when (p) {
                    SwapProgress.Approving, is SwapProgress.WaitingForApproval ->
                        emit(VfxtRouteProgress.Step(step, 2, "Approving ${from.symbol}", (p as? SwapProgress.WaitingForApproval)?.hash))
                    SwapProgress.Requoting -> emit(VfxtRouteProgress.Step(step, 2, "Refreshing ${from.symbol} → ${to.symbol} price"))
                    SwapProgress.Swapping -> emit(VfxtRouteProgress.Step(step, 2, "Swapping ${from.symbol} to ${to.symbol}"))
                    is SwapProgress.WaitingForSwap -> emit(VfxtRouteProgress.Step(step, 2, "Swapping ${from.symbol} to ${to.symbol}", p.hash))
                    is SwapProgress.Bridging -> emit(VfxtRouteProgress.Step(step, 2, "Swapping ${from.symbol} to ${to.symbol}", p.hash))
                    is SwapProgress.Done -> result = p.hash
                    is SwapProgress.Failed -> failure = p
                    is SwapProgress.PriceChanged -> repriced = p.fresh
                }
            }
            failure?.let {
                emit(VfxtRouteProgress.Failed(it.message + suffix, it.hash))
                return null
            }
            result?.let { return it }
            // The market moved slightly before signing: retry once with the fresh quote (still slippage-protected).
            val fresh = repriced
            if (fresh == null || attempt == 1) break
            preview = fresh
        }
        emit(VfxtRouteProgress.Failed("The ${from.symbol} → ${to.symbol} price moved. Nothing was swapped in this step." + suffix))
        return null
    }
}
