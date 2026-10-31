package com.vfxt.wallet

import com.vfxt.wallet.blockchain.swap.NATIVE_TOKEN_ADDRESS
import com.vfxt.wallet.blockchain.swap.SwapException
import com.vfxt.wallet.blockchain.swap.SwapGuard
import com.vfxt.wallet.blockchain.swap.SwapQuote
import com.vfxt.wallet.blockchain.swap.SwapToken
import com.vfxt.wallet.blockchain.swap.SwapTxRequest
import com.vfxt.wallet.blockchain.tokens.Erc20Abi
import com.vfxt.wallet.data.remote.LiFiApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.math.BigDecimal
import java.math.BigInteger

class SwapGuardTest {
    private val router = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE"
    private val usdt = "0x55d398326f99059fF775485246999027B3197955"
    private val cake = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"
    private val bnb = SwapToken(56, NATIVE_TOKEN_ADDRESS, "BNB", "BNB", 18)
    private val usdtToken = SwapToken(56, usdt, "USDT", "Tether USD", 18)
    private val cakeToken = SwapToken(56, cake, "Cake", "PancakeSwap", 18)
    private val amount = BigInteger("10000000000000000")

    private fun quote(
        from: SwapToken = bnb,
        to: SwapToken = usdtToken,
        txTo: String = router,
        chainId: Long = 56,
        value: BigInteger = amount,
        approval: String? = null,
        fromUsd: String? = "7.06",
        toUsd: String? = "7.04",
    ) = SwapQuote(
        id = "q", tool = "sushiswap", toolName = "SushiSwap", fromToken = from, toToken = to,
        fromAmount = amount, toAmount = BigInteger("7046623964680068096"), toAmountMin = BigInteger("7011390844856667755"),
        slippage = BigDecimal("0.005"), approvalAddress = approval, executionDurationSeconds = 0,
        fromAmountUsd = fromUsd?.toBigDecimal(), toAmountUsd = toUsd?.toBigDecimal(), gasCostUsd = null, fees = emptyList(),
        tx = SwapTxRequest(chainId, txTo, "0xabcdef0123", value, BigInteger.valueOf(300_000), null),
    )

    private fun expectBlocked(q: SwapQuote, from: String = NATIVE_TOKEN_ADDRESS, to: String = usdt) {
        try {
            SwapGuard.validate(q, 56, from, to, 56, amount)
            fail("Expected the guard to block this quote")
        } catch (_: SwapException) {
        }
    }

    @Test
    fun acceptsValidNativeSwap() {
        SwapGuard.validate(quote(), 56, NATIVE_TOKEN_ADDRESS, usdt, 56, amount)
    }

    @Test
    fun acceptsValidTokenSwapWithTrustedApproval() {
        SwapGuard.validate(quote(from = usdtToken, to = cakeToken, value = BigInteger.ZERO, approval = router), 56, usdt, cake, 56, amount)
    }

    @Test
    fun blocksUntrustedRouter() = expectBlocked(quote(txTo = "0x000000000000000000000000000000000000dEaD"))

    @Test
    fun blocksWrongChain() = expectBlocked(quote(chainId = 1))

    @Test
    fun blocksUnexpectedValue() = expectBlocked(quote(value = amount * BigInteger.TWO))

    @Test
    fun blocksUntrustedApprovalSpender() =
        expectBlocked(quote(from = usdtToken, to = cakeToken, value = BigInteger.ZERO, approval = "0x000000000000000000000000000000000000dEaD"), from = usdt, to = cake)

    @Test
    fun blocksTokenSubstitution() = expectBlocked(quote(to = cakeToken))

    @Test
    fun blocksCatastrophicValueLoss() = expectBlocked(quote(fromUsd = "100", toUsd = "50"))

    @Test
    fun requoteMustNotBeWorse() {
        val reviewed = quote()
        assertTrue(SwapGuard.isStillAcceptable(reviewed, reviewed))
        val worse = reviewed.copy(toAmountMin = reviewed.toAmountMin * BigInteger.valueOf(99) / BigInteger.valueOf(100))
        assertFalse(SwapGuard.isStillAcceptable(reviewed, worse))
    }

    @Test
    fun valueLossIncludesFees() {
        assertEquals(0, BigDecimal("50").compareTo(quote(fromUsd = "100", toUsd = "50").valueLossPercent!!))
        assertNull(quote(toUsd = null).valueLossPercent)
    }

    @Test
    fun approveAndAllowanceEncoding() {
        assertEquals("0x095ea7b3" + "1231deb6f5749ef6ce6943a275a1d3e7486f4eae".padStart(64, '0') + "1".padStart(64, '0'), Erc20Abi.approve(router, BigInteger.ONE))
        assertTrue(Erc20Abi.allowance(router, router).startsWith("0xdd62ed3e"))
    }

    @Test
    fun parsesLiFiQuoteAndDropsFlaggedTokens() {
        val json = """
            {"id":"abc","tool":"sushiswap","toolDetails":{"name":"SushiSwap"},
             "action":{"fromToken":{"address":"0x0000000000000000000000000000000000000000","chainId":56,"symbol":"BNB","decimals":18,"name":"BNB","priceUSD":"706.4","verificationStatus":"verified"},
                       "toToken":{"address":"$usdt","chainId":56,"symbol":"USDT","decimals":18,"name":"Tether USD","priceUSD":"0.9996","verificationStatus":"verified"},
                       "fromAmount":"10000000000000000","slippage":0.005},
             "estimate":{"toAmount":"7046623964680068096","toAmountMin":"7011390844856667755","approvalAddress":"$router",
                         "executionDuration":0,"fromAmountUSD":"7.0636","toAmountUSD":"7.0395",
                         "feeCosts":[{"name":"LIFI Fixed Fee","amountUSD":"0.0177","percentage":"0.0025","included":true}],
                         "gasCosts":[{"amountUSD":"0.0097"}]},
             "transactionRequest":{"to":"$router","data":"0x1234abcd","value":"0x2386f26fc10000","gasLimit":"0x6c2f0","chainId":56}}
        """.trimIndent()
        val q = LiFiApi.parseQuote(Json.parseToJsonElement(json).jsonObject)
        assertEquals(amount, q.fromAmount)
        assertEquals(amount, q.tx.value) // 0x2386f26fc10000 == 0.01 BNB
        assertEquals(BigInteger.valueOf(0x6c2f0), q.tx.gasLimit)
        assertEquals(BigDecimal("0.0177"), q.providerFeeUsd)
        SwapGuard.validate(q, 56, NATIVE_TOKEN_ADDRESS, usdt, 56, amount)

        val flagged = Json.parseToJsonElement("""{"address":"$cake","chainId":56,"symbol":"FAKE","decimals":18,"verificationStatus":"flagged"}""")
        assertNull(LiFiApi.parseToken(flagged, requireVerified = false))
    }
}
