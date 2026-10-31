package com.vfxt.wallet

import com.vfxt.wallet.core.common.Formatters
import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigDecimal
import java.math.BigInteger

class FormattersTest {
    @Test
    fun tokenAmount_scalesBaseUnitsWithoutFloatingPoint() {
        // 1.5 BNB in wei
        val raw = BigInteger("1500000000000000000")
        assertEquals("1.5", Formatters.tokenAmount(raw, 18))
    }

    @Test
    fun tokenAmount_truncatesInsteadOfRoundingUp() {
        // Never display more than the user actually has.
        val raw = BigInteger("999999999999999999") // 0.999999999999999999
        assertEquals("0.999999", Formatters.tokenAmount(raw, 18))
    }

    @Test
    fun tokenAmount_groupsThousands() {
        assertEquals("12,000", Formatters.tokenAmount(BigDecimal("12000")))
    }

    @Test
    fun fiat_alwaysTwoDecimals() {
        assertEquals("$2,584.10", Formatters.fiat(BigDecimal("2584.1")))
    }

    @Test
    fun percent_hasExplicitSign() {
        assertEquals("+1.86%", Formatters.percent(BigDecimal("1.856")))
        assertEquals("-0.50%", Formatters.percent(BigDecimal("-0.5")))
    }

    @Test
    fun shortAddress_keepsPrefixAndSuffix() {
        assertEquals("0x1234…abcd", Formatters.shortAddress("0x1234567890000000000000000000000000abcd"))
    }
}
