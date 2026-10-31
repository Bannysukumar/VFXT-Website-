package com.vfxt.wallet

import com.vfxt.wallet.data.demo.ChartInterval
import com.vfxt.wallet.data.demo.DemoMarketData
import com.vfxt.wallet.ui.trading.TradingViewModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DemoMarketDataTest {
    private val now = 1_761_900_000_000L

    @Test
    fun candles_areDeterministicPerInterval() {
        assertEquals(
            DemoMarketData.candles(ChartInterval.H1, nowMillis = now),
            DemoMarketData.candles(ChartInterval.H1, nowMillis = now),
        )
    }

    @Test
    fun candles_areInternallyConsistent() {
        ChartInterval.entries.forEach { interval ->
            DemoMarketData.candles(interval, nowMillis = now).forEach { c ->
                assertTrue(c.high >= maxOf(c.open, c.close))
                assertTrue(c.low <= minOf(c.open, c.close))
                assertTrue(c.low > 0)
            }
        }
    }

    @Test
    fun amountInput_rejectsMalformedNumbers() {
        val vm = TradingViewModel()
        vm.updateAmount("12.5")
        assertEquals("12.5", vm.uiState.value.amountInput)
        vm.updateAmount("12.5.1")
        assertEquals("12.5", vm.uiState.value.amountInput)
        vm.updateAmount("abc")
        assertEquals("12.5", vm.uiState.value.amountInput)
    }
}
