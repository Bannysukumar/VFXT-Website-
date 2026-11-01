package com.vfxt.wallet.core.common

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.math.BigDecimal

/** Display currencies offered in Settings. [fractionDigits] follows ISO 4217 minor units. */
enum class FiatCurrency(val code: String, val symbol: String, val label: String, val fractionDigits: Int = 2) {
    USD("USD", "$", "US Dollar"),
    EUR("EUR", "€", "Euro"),
    GBP("GBP", "£", "British Pound"),
    INR("INR", "₹", "Indian Rupee"),
    AED("AED", "AED ", "UAE Dirham"),
    SAR("SAR", "SAR ", "Saudi Riyal"),
    PKR("PKR", "Rs ", "Pakistani Rupee"),
    BDT("BDT", "৳", "Bangladeshi Taka"),
    NGN("NGN", "₦", "Nigerian Naira"),
    TRY("TRY", "₺", "Turkish Lira"),
    RUB("RUB", "₽", "Russian Ruble"),
    JPY("JPY", "¥", "Japanese Yen", 0),
    CNY("CNY", "CN¥", "Chinese Yuan"),
    KRW("KRW", "₩", "South Korean Won", 0),
    IDR("IDR", "Rp ", "Indonesian Rupiah", 0),
    PHP("PHP", "₱", "Philippine Peso"),
    VND("VND", "₫", "Vietnamese Dong", 0),
    THB("THB", "฿", "Thai Baht"),
    SGD("SGD", "S$", "Singapore Dollar"),
    AUD("AUD", "A$", "Australian Dollar"),
    CAD("CAD", "C$", "Canadian Dollar"),
    BRL("BRL", "R$", "Brazilian Real"),
    MXN("MXN", "MX$", "Mexican Peso"),
    ZAR("ZAR", "R ", "South African Rand"),
    CHF("CHF", "CHF ", "Swiss Franc"),
    ;

    companion object {
        fun fromCode(code: String?): FiatCurrency = entries.firstOrNull { it.code == code } ?: USD
    }
}

/**
 * App-wide display currency. Market prices are fetched in USD and converted here for display
 * only. Backed by Compose state so every price on screen updates when the user switches currency.
 *
 * If the exchange rate for the chosen currency isn't known yet, USD is shown rather than a
 * number in the wrong currency.
 */
object FiatDisplay {
    var selected by mutableStateOf(FiatCurrency.USD)
        internal set

    /** Units of [selected] per 1 USD; null until a rate has been loaded. */
    var rate by mutableStateOf<BigDecimal?>(BigDecimal.ONE)
        internal set

    /** Currency actually used for display right now. */
    val effective: FiatCurrency get() = if (selected == FiatCurrency.USD || rate != null) selected else FiatCurrency.USD

    fun convert(usd: BigDecimal): BigDecimal =
        if (effective == FiatCurrency.USD) usd else usd.multiply(rate ?: BigDecimal.ONE)

    fun update(currency: FiatCurrency, usdRate: BigDecimal?) {
        selected = currency
        rate = if (currency == FiatCurrency.USD) BigDecimal.ONE else usdRate
    }
}
