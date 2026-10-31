package com.vfxt.wallet.data.demo

import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

/**
 * DEMO ONLY. Simulated VFXT/USDT market data for the trading preview.
 *
 * Nothing here reflects a real market and nothing here may be mixed with wallet balances.
 * Every UI surface that renders these values must carry a DEMO label. Doubles are acceptable
 * because these numbers are never used for accounting.
 */
enum class ChartInterval(val label: String, val millis: Long) {
    M1("1m", 60_000),
    M5("5m", 5 * 60_000),
    M15("15m", 15 * 60_000),
    H1("1h", 3_600_000),
    H4("4h", 4 * 3_600_000),
    D1("1D", 86_400_000),
    W1("1W", 7 * 86_400_000),
}

data class DemoCandle(
    val openTimeMillis: Long,
    val open: Double,
    val high: Double,
    val low: Double,
    val close: Double,
    val volume: Double,
)

data class DemoTicker(
    val lastPrice: Double,
    val changePercent: Double,
    val high: Double,
    val low: Double,
    val volume: Double,
)

object DemoMarketData {
    const val PAIR = "VFXT/USDT"
    private const val BASE_PRICE = 0.0420

    /** Deterministic per interval so the chart doesn't reshuffle on recomposition or rotation. */
    fun candles(interval: ChartInterval, count: Int = 48, nowMillis: Long = System.currentTimeMillis()): List<DemoCandle> {
        val random = Random(seed = 7919 * (interval.ordinal + 1))
        // Larger intervals get proportionally larger swings.
        val volatility = 0.006 * (1 + interval.ordinal * 0.6)
        val start = nowMillis - (nowMillis % interval.millis) - (count - 1) * interval.millis
        var price = BASE_PRICE * (0.9 + random.nextDouble() * 0.2)
        return List(count) { i ->
            val open = price
            val drift = (random.nextDouble() - 0.48) * volatility * 2
            val close = max(0.0001, open * (1 + drift))
            val high = max(open, close) * (1 + random.nextDouble() * volatility)
            val low = min(open, close) * (1 - random.nextDouble() * volatility)
            price = close
            DemoCandle(start + i * interval.millis, open, high, low, close, 50_000 + random.nextDouble() * 250_000)
        }
    }

    fun ticker(candles: List<DemoCandle>): DemoTicker {
        val first = candles.first()
        val last = candles.last()
        return DemoTicker(
            lastPrice = last.close,
            changePercent = (last.close - first.open) / first.open * 100,
            high = candles.maxOf { it.high },
            low = candles.minOf { it.low },
            volume = candles.sumOf { it.volume },
        )
    }

    /** Starting balance of the isolated demo account. Not related to the user's wallet. */
    const val DEMO_USDT_BALANCE = 1_000.0
}
