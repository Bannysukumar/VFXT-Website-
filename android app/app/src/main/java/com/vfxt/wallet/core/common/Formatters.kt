package com.vfxt.wallet.core.common

import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

const val HIDDEN_BALANCE = "••••••"
const val UNKNOWN_VALUE = "—"

object Formatters {
    private val symbols = DecimalFormatSymbols(Locale.US)

    fun fiat(value: BigDecimal, currencySymbol: String = "$"): String =
        currencySymbol + DecimalFormat("#,##0.00", symbols).format(value.setScale(2, RoundingMode.HALF_UP))

    /** Converts an integer base-unit balance to a display string without floating point. */
    fun tokenAmount(raw: BigInteger, decimals: Int, maxFraction: Int = 6): String =
        tokenAmount(BigDecimal(raw).movePointLeft(decimals), maxFraction)

    fun tokenAmount(value: BigDecimal, maxFraction: Int = 6): String {
        val pattern = "#,##0." + "#".repeat(maxFraction)
        return DecimalFormat(pattern, symbols).apply { roundingMode = RoundingMode.DOWN }.format(value)
    }

    fun percent(value: BigDecimal): String {
        val sign = if (value.signum() > 0) "+" else ""
        return sign + value.setScale(2, RoundingMode.HALF_UP).toPlainString() + "%"
    }

    /** 0x1234…abcd */
    fun shortAddress(address: String): String =
        if (address.length <= 12) address else "${address.take(6)}…${address.takeLast(4)}"
}
