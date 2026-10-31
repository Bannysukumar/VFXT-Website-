package com.vfxt.wallet.core.common

import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

const val HIDDEN_BALANCE = "••••••"
const val UNKNOWN_VALUE = "—"

object Formatters {
    private val symbols = DecimalFormatSymbols(Locale.US)

    fun fiat(value: BigDecimal, currencySymbol: String = "$"): String =
        currencySymbol + DecimalFormat("#,##0.00", symbols).format(value.setScale(2, RoundingMode.HALF_UP))

    /** Per-token market price (Trust/MetaMask style: more decimals when the price is small). */
    fun unitPrice(value: BigDecimal, currencySymbol: String = "$"): String {
        val abs = value.abs()
        val pattern = when {
            abs >= BigDecimal("1000") -> "#,##0.00"
            abs >= BigDecimal.ONE -> "#,##0.00##"
            abs >= BigDecimal("0.01") -> "#,##0.00####"
            else -> "#,##0.00########"
        }
        return currencySymbol + DecimalFormat(pattern, symbols).apply {
            roundingMode = RoundingMode.HALF_UP
            minimumFractionDigits = 2
        }.format(value)
    }

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

    fun dateTime(millis: Long): String =
        SimpleDateFormat("MMM d, yyyy · HH:mm", Locale.US).format(Date(millis))
}
